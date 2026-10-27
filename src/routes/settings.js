import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getAiSettings,
  serializeAiSettings,
  serializeSystemSettings,
  TEXT_MODELS,
  TEXT_MODEL_OPTIONS,
  TTS_VOICES,
  updateAiSettings,
} from '../services/aiSettings.js';
import {
  getHandoffForwardSettings,
  saveHandoffForwardSettings,
  sendHandoffForwardTest,
} from '../services/handoffForward.js';
import {
  getGreenSettings,
  setGreenWebhook,
  invalidateGreenStateCache,
} from '../services/greenApi.js';
import { prisma } from '../lib/prisma.js';
import {
  buildEvolutionWebhookUrl,
  isEvolutionConfigured,
  setInstanceWebhook,
} from '../services/evolutionService.js';
import {
  invalidateGreenApiConfigCache,
  resolveGreenApiConfigAsync,
} from '../services/greenApiConfig.js';

const router = express.Router();

router.use(authenticate, attachUser, requireAdmin);

const WEBHOOK_PATH = '/api/webhook/green-api';

/** Public base URL of THIS API (not the frontend), derived from the incoming request. */
function requestBaseUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https')
    .split(',')[0]
    .trim();
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '')
    .split(',')[0]
    .trim();
  return host ? `${proto}://${host}` : '';
}

function isLocalHost(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
}

async function loadCreds() {
  invalidateGreenApiConfigCache();
  const cfg = await resolveGreenApiConfigAsync();
  return {
    instanceId: cfg.instanceId,
    apiToken: cfg.apiToken,
    baseUrl: cfg.baseUrl,
    configured: cfg.configured,
  };
}

router.get('/', async (_req, res, next) => {
  try {
    const row = await getAiSettings();
    res.json({
      ...serializeSystemSettings(row),
      settings: serializeAiSettings(row),
      options: { textModels: TEXT_MODELS, textModelOptions: TEXT_MODEL_OPTIONS, ttsVoices: TTS_VOICES },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const row = await updateAiSettings({
      openAiApiKey: body.openaiApiKey ?? body.openAiApiKey,
      appPublicUrl: body.appPublicUrl,
      greenApiInstanceId: body.greenApiInstanceId ?? body.greenInstanceId ?? body.idInstance,
      greenApiToken: body.greenApiToken ?? body.apiTokenInstance,
      greenApiUrl: body.greenApiUrl ?? body.apiUrl,
      textModel: body.textModel,
      sttEnabled: body.sttEnabled,
      ttsEnabled: body.ttsEnabled,
      ttsVoice: body.ttsVoice,
      systemPrompt: body.systemPrompt,
      employeePrompt: body.employeePrompt ?? body.systemPrompt,
      qualificationPrompt: body.qualificationPrompt,
    });
    res.json({
      ...serializeSystemSettings(row),
      settings: serializeAiSettings(row),
      message: 'تم حفظ البرومبت والإعدادات بنجاح',
    });
  } catch (err) {
    next(err);
  }
});

/** WhatsApp numbers that get notified when a chat moves to human control / handoff. */
router.get('/handoff-forward', async (_req, res, next) => {
  try {
    res.json(await getHandoffForwardSettings());
  } catch (err) {
    next(err);
  }
});

router.put('/handoff-forward', async (req, res, next) => {
  try {
    const saved = await saveHandoffForwardSettings({
      enabled: req.body?.enabled,
      numbers: req.body?.numbers,
    });
    res.json({ ...saved, message: 'تم حفظ أرقام التحويل' });
  } catch (err) {
    next(err);
  }
});

router.post('/handoff-forward/test', async (_req, res, next) => {
  try {
    res.json(await sendHandoffForwardTest());
  } catch (err) {
    next(err);
  }
});

/** Re-register this API's webhook on every Evolution instance (e.g. after the API URL changed). */
router.post('/evolution/webhook/sync', async (req, res, next) => {
  try {
    if (!isEvolutionConfigured()) {
      return res.status(400).json({ error: 'EVOLUTION_API_URL و EVOLUTION_API_KEY غير مضبوطين' });
    }
    const base = requestBaseUrl(req);
    if (!base || isLocalHost(base)) {
      return res.status(400).json({
        error: 'لا يمكن ضبط Webhook من localhost — نفّذ هذا الإجراء من الواجهة المنشورة على Vercel',
      });
    }
    const webhookUrl = buildEvolutionWebhookUrl(base);
    const rows = await prisma.whatsAppInstance.findMany({ where: { provider: { not: 'green' } } });
    const results = [];
    for (const row of rows) {
      try {
        await setInstanceWebhook(row.instanceName, webhookUrl);
        results.push({ instanceName: row.instanceName, ok: true });
      } catch (err) {
        results.push({ instanceName: row.instanceName, ok: false, error: err.message });
      }
    }
    const okCount = results.filter((r) => r.ok).length;
    return res.json({
      ok: results.every((r) => r.ok),
      results,
      message: rows.length
        ? `تم ضبط Webhook على ${okCount} من ${rows.length} رقم`
        : 'لا توجد أرقام Evolution مربوطة بعد',
    });
  } catch (err) {
    err.expose = true;
    next(err);
  }
});

/** Show what Green API currently has configured for the webhook. */
router.get('/green-webhook', async (req, res, next) => {
  try {
    const creds = await loadCreds();
    const expectedUrl = `${requestBaseUrl(req)}${WEBHOOK_PATH}`;
    if (!creds.configured) {
      return res.json({ configured: false, expectedUrl });
    }
    const current = await getGreenSettings(creds);
    const currentUrl = String(current?.webhookUrl ?? '');
    return res.json({
      configured: true,
      expectedUrl,
      webhookUrl: currentUrl,
      incomingWebhook: current?.incomingWebhook ?? null,
      matches: currentUrl === expectedUrl && current?.incomingWebhook === 'yes',
    });
  } catch (err) {
    err.expose = true;
    next(err);
  }
});

/** Register this API's webhook URL in Green API and enable incoming messages. */
router.post('/green-webhook/sync', async (req, res, next) => {
  try {
    const creds = await loadCreds();
    if (!creds.configured) {
      return res.status(400).json({ error: 'احفظ Instance ID و API Token أولاً' });
    }

    const base = requestBaseUrl(req);
    if (!base || isLocalHost(base)) {
      return res.status(400).json({
        error: 'لا يمكن ضبط Webhook من localhost — نفّذ هذا الإجراء من الواجهة المنشورة على Vercel',
      });
    }

    const webhookUrl = `${base}${WEBHOOK_PATH}`;
    const result = await setGreenWebhook(creds, webhookUrl);
    invalidateGreenStateCache(creds);

    return res.json({
      ok: Boolean(result?.saveSettings ?? true),
      webhookUrl,
      message:
        'تم ضبط الـ Webhook في Green API. قد يعيد Green تشغيل الحساب (حتى 5 دقائق) قبل أن يبدأ الرد.',
    });
  } catch (err) {
    err.expose = true;
    next(err);
  }
});

export default router;
