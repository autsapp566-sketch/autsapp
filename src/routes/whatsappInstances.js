import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireAgent } from '../middleware/requireAgent.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { getWhatsAppProvider } from '../services/whatsappMessaging.js';
import { resolveGreenApiConfig } from '../services/greenApiConfig.js';
import {
  getQrCode,
  getStateInstance,
  isGreenConnectedState,
  invalidateGreenStateCache,
  logoutInstance,
  maskGreenToken,
  rebootInstance,
  resolveGreenCredentials,
} from '../services/greenApi.js';
import {
  deleteEvolutionInstance,
  fetchEvolutionInstances,
  getEvolutionConnectionState,
  isEvolutionMockMode,
  normalizeConnectionState,
} from '../services/evolutionApi.js';
import { resolveInstanceQr } from '../services/whatsappEvolutionQr.js';
import { resolveEvolutionConfig } from '../services/evolutionConfig.js';
import { getAiSettings } from '../services/aiSettings.js';
import { getEvolutionConfigFromSettings } from '../services/platformSettings.js';

const router = express.Router();
const INSTANCE_NAME_RE = /^[a-z0-9_-]{3,40}$/;

function pickGreenField(...values) {
  for (const value of values) {
    if (value == null) {
      continue;
    }
    const trimmed = String(value).trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

/** @param {Record<string, unknown>} body */
function parseGreenBody(body) {
  const envCfg = resolveGreenApiConfig();
  const greenInstanceId = pickGreenField(
    body?.greenInstanceId,
    body?.idInstance,
    envCfg.instanceId
  );
  const greenApiToken = pickGreenField(
    body?.greenApiToken,
    body?.apiTokenInstance,
    envCfg.apiToken
  );
  const greenApiUrl =
    pickGreenField(body?.greenApiUrl, body?.apiUrl, envCfg.baseUrl) || null;

  return {
    greenInstanceId,
    greenApiToken,
    greenApiUrl,
    label: typeof body?.label === 'string' ? body.label.trim() : null,
    instanceName: String(body?.instanceName ?? '')
      .trim()
      .toLowerCase(),
  };
}

function sendGreenRouteError(res, err, fallbackStatus = 502) {
  const status = typeof err.status === 'number' ? err.status : fallbackStatus;
  return res.status(status).json({
    error: err.message || 'Green API request failed',
    provider: 'green-api',
  });
}

function useGreenProvider() {
  return getWhatsAppProvider() === 'green-api';
}

function buildGreenWebhookUrl() {
  const base = env.appPublicUrl?.trim() || process.env.APP_PUBLIC_URL?.trim() || '';
  if (!base) {
    return null;
  }
  return `${base.replace(/\/$/, '')}/api/webhook/green-api`;
}

function serializeGreenInstance(row, connectionState, extra = {}) {
  const connected = isGreenConnectedState(connectionState);
  return {
    id: row.id,
    instanceName: row.instanceName,
    label: row.label,
    phone: row.phone,
    provider: 'green-api',
    greenInstanceId: row.greenInstanceId,
    greenApiUrl: row.greenApiUrl,
    greenApiTokenMasked: row.greenApiToken ? maskGreenToken(row.greenApiToken) : null,
    hasGreenToken: Boolean(row.greenApiToken),
    isDefault: row.isDefault,
    connectionState,
    connected,
    mock: false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    webhookUrl: buildGreenWebhookUrl(),
    ...extra,
  };
}

function serializeEvolutionInstance(row, connectionState, phoneFromEvolution, extra = {}) {
  const mock = Boolean(extra.mock ?? isEvolutionMockMode());
  const s = (connectionState ?? '').toLowerCase();
  const connected = !mock && (s === 'open' || s === 'connected');
  return {
    id: row.id,
    instanceName: row.instanceName,
    label: row.label,
    phone: row.phone ?? phoneFromEvolution ?? null,
    provider: 'evolution',
    isDefault: row.isDefault,
    connectionState,
    connected,
    mock,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extra,
  };
}

async function buildEvolutionWebhookUrl() {
  const settings = await getAiSettings();
  const { appPublicUrl, webhookSecret } = await getEvolutionConfigFromSettings(settings);
  if (!appPublicUrl) {
    return null;
  }
  return webhookSecret
    ? `${appPublicUrl}/api/webhook/whatsapp?secret=${encodeURIComponent(webhookSecret)}`
    : `${appPublicUrl}/api/webhook/whatsapp`;
}

function findEvolutionMeta(fetchResult, instanceName) {
  const list = Array.isArray(fetchResult) ? fetchResult : fetchResult?.instances ?? fetchResult ?? [];
  const item = list.find((i) => {
    const name = i?.instanceName ?? i?.name ?? i?.instance?.instanceName;
    return name === instanceName;
  });
  if (!item) {
    return { phone: null };
  }
  const phone =
    item.ownerJid?.split('@')?.[0] ??
    item.number ??
    item.instance?.owner ??
    item.profileName ??
    null;
  return { phone: phone ? String(phone).replace(/\D/g, '') || phone : null };
}

router.use(authenticate, attachUser, requireAgent);

router.get('/integration', requireAdmin, async (_req, res, next) => {
  try {
    if (useGreenProvider()) {
      const config = resolveGreenApiConfig();
      return res.json({
        provider: 'green-api',
        configured: config.configured,
        baseUrl: config.baseUrl || null,
        instanceId: config.instanceId || null,
        webhookUrl: buildGreenWebhookUrl(),
      });
    }
    const config = await resolveEvolutionConfig();
    return res.json({
      provider: 'evolution',
      mock: isEvolutionMockMode(),
      configured: config.configured,
      baseUrl: config.baseUrl || null,
      credentialSource: config.source,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const rows = await prisma.whatsAppInstance.findMany({ orderBy: { createdAt: 'desc' } });

    if (useGreenProvider()) {
      const instances = await Promise.all(
        rows.map(async (row) => {
          const creds = resolveGreenCredentials(row);
          let connectionState = 'unknown';
          let connectionError;
          try {
            if (creds.configured) {
              const { state } = await getStateInstance(creds);
              connectionState = state;
            } else {
              connectionState = 'notConfigured';
              connectionError =
                'Instance ID أو API Token ناقص — استخدم apiTokenInstance (ليس Admin token) أو .env';
            }
          } catch (err) {
            connectionState = 'unreachable';
            connectionError =
              err?.message ??
              'تعذر الاتصال بـ Green API — تحقق من Token و URL';
          }
          return serializeGreenInstance(row, connectionState, {
            connectionError,
          });
        })
      );
      return res.json({ provider: 'green-api', instances });
    }

    let evolutionList = [];
    try {
      evolutionList = await fetchEvolutionInstances();
    } catch {
      evolutionList = [];
    }

    const instances = await Promise.all(
      rows.map(async (row) => {
        let connectionState = 'unknown';
        try {
          const stateRaw = await getEvolutionConnectionState(row.instanceName);
          connectionState = normalizeConnectionState(stateRaw);
        } catch {
          connectionState = 'unreachable';
        }
        const meta = findEvolutionMeta(evolutionList, row.instanceName);
        if (meta.phone && meta.phone !== row.phone) {
          await prisma.whatsAppInstance.update({
            where: { id: row.id },
            data: { phone: meta.phone },
          });
          row.phone = meta.phone;
        }
        return serializeEvolutionInstance(row, connectionState, meta.phone, {
          mock: isEvolutionMockMode(),
        });
      })
    );

    res.json({ provider: 'evolution', instances, mock: isEvolutionMockMode() });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    if (useGreenProvider()) {
      const parsed = parseGreenBody(req.body ?? {});
      const envCfg = resolveGreenApiConfig();
      const finalId = parsed.greenInstanceId;
      let finalToken = parsed.greenApiToken;
      const greenApiUrl = parsed.greenApiUrl;
      const label = parsed.label;

      if (!finalId || !finalToken) {
        return res.status(400).json({
          error: 'Green API: Instance ID (idInstance) و API Token (apiTokenInstance) مطلوبان أو .env',
          provider: 'green-api',
        });
      }

      let instanceName = parsed.instanceName;
      if (!instanceName) {
        instanceName = `green-${finalId}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40);
      }
      if (!INSTANCE_NAME_RE.test(instanceName)) {
        return res.status(400).json({
          error: 'اسم داخلي: 3-40 حرف (a-z, 0-9, _ أو -)',
        });
      }

      const existingGreen = await prisma.whatsAppInstance.findFirst({
        where: { greenInstanceId: finalId },
      });
      if (existingGreen && existingGreen.instanceName !== instanceName) {
        return res.status(409).json({ error: 'هذا Instance ID مسجّل مسبقاً' });
      }

      let row = await prisma.whatsAppInstance.findUnique({ where: { instanceName } });

      if (!finalToken && row?.greenApiToken?.trim()) {
        finalToken = row.greenApiToken.trim();
      }
      if (!finalToken) {
        finalToken = envCfg.apiToken;
      }

      if (!finalId || !finalToken) {
        return res.status(400).json({
          error:
            'Green API: Instance ID و apiTokenInstance مطلوبان (من لوحة Green API، ليس Admin token) أو عرّفهما في .env',
          provider: 'green-api',
        });
      }

      const credsProbe = resolveGreenCredentials({
        greenInstanceId: finalId,
        greenApiToken: finalToken,
        greenApiUrl: greenApiUrl ?? envCfg.baseUrl,
      });
      let probedState;
      try {
        probedState = await getStateInstance(credsProbe);
      } catch (err) {
        return sendGreenRouteError(res, err, 400);
      }

      const count = await prisma.whatsAppInstance.count();
      const data = {
        instanceName,
        label: label || `Green ${finalId}`,
        provider: 'green',
        greenInstanceId: finalId,
        greenApiToken: finalToken,
        greenApiUrl: greenApiUrl ?? envCfg.baseUrl,
        isDefault: count === 0 && !row,
      };

      if (!row) {
        row = await prisma.whatsAppInstance.create({ data });
      } else {
        row = await prisma.whatsAppInstance.update({
          where: { id: row.id },
          data: {
            label: data.label,
            greenInstanceId: finalId,
            greenApiToken: finalToken,
            greenApiUrl: data.greenApiUrl,
            provider: 'green',
          },
        });
      }

      const creds = resolveGreenCredentials(row);
      let qr = { base64: null, pairingCode: null, message: null };
      const connectionState = probedState.state;
      let message;

      try {
        if (!isGreenConnectedState(connectionState)) {
          qr = await getQrCode(creds);
          message = qr.message ?? undefined;
        } else {
          message = 'Instance already authorized — WhatsApp is connected.';
        }
      } catch (err) {
        return sendGreenRouteError(res, err);
      }

      return res.status(201).json({
        provider: 'green-api',
        instance: serializeGreenInstance(row, connectionState),
        qr,
        qrcode: qr.base64,
        connected: isGreenConnectedState(connectionState),
        simulationMode: false,
        message,
        webhookUrl: buildGreenWebhookUrl(),
      });
    }

    let instanceName = String(req.body?.instanceName ?? '')
      .trim()
      .toLowerCase();
    if (!instanceName) {
      instanceName = `shop-${Date.now().toString(36).slice(-8)}`;
    }
    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : null;

    if (!INSTANCE_NAME_RE.test(instanceName)) {
      return res.status(400).json({
        error: 'اسم ال instance: 3-40 حرف (a-z, 0-9, _ أو -)',
      });
    }

    let row = await prisma.whatsAppInstance.findUnique({ where: { instanceName } });
    let createdNew = false;
    const webhookUrl = await buildEvolutionWebhookUrl();

    if (!row) {
      createdNew = true;
      const count = await prisma.whatsAppInstance.count();
      row = await prisma.whatsAppInstance.create({
        data: {
          instanceName,
          label: label || instanceName,
          provider: 'evolution',
          isDefault: count === 0,
        },
      });
    } else if (label) {
      row = await prisma.whatsAppInstance.update({
        where: { id: row.id },
        data: { label },
      });
    }

    const { qr, simulationMode, message } = await resolveInstanceQr(instanceName, webhookUrl, {
      skipCreate: !createdNew,
    });

    const mock = isEvolutionMockMode() || simulationMode;
    const connectionState = simulationMode ? 'simulation' : qr?.base64 ? 'connecting' : 'unreachable';

    res.status(createdNew ? 201 : 200).json({
      provider: 'evolution',
      instance: serializeEvolutionInstance(row, connectionState, row.phone, { mock }),
      qr,
      qrcode: qr?.base64 ?? null,
      connected: false,
      mock,
      simulationMode,
      message: message ?? undefined,
      webhookConfigured: Boolean(webhookUrl),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const row = await prisma.whatsAppInstance.findUnique({ where: { id: req.params.id } });
    if (!row) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const data = {};
    if (typeof req.body?.label === 'string') {
      data.label = req.body.label.trim();
    }
    if (req.body?.greenInstanceId != null) {
      data.greenInstanceId = String(req.body.greenInstanceId).trim();
    }
    if (req.body?.greenApiToken != null) {
      data.greenApiToken = String(req.body.greenApiToken).trim();
    }
    if (req.body?.greenApiUrl != null) {
      data.greenApiUrl = String(req.body.greenApiUrl).trim() || null;
    }

    const updated = await prisma.whatsAppInstance.update({
      where: { id: row.id },
      data,
    });

    res.json({ instance: serializeGreenInstance(updated, 'unknown') });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/connect', requireAdmin, async (req, res, next) => {
  try {
    const row = await prisma.whatsAppInstance.findUnique({ where: { id: req.params.id } });
    if (!row) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    if (useGreenProvider()) {
      const creds = resolveGreenCredentials(row);
      try {
        const { state } = await getStateInstance(creds);
        if (isGreenConnectedState(state)) {
          return res.json({
            provider: 'green-api',
            qr: { base64: null },
            qrcode: null,
            instanceName: row.instanceName,
            greenInstanceId: row.greenInstanceId,
            connectionState: state,
            connected: true,
            simulationMode: false,
            message: 'Instance already authorized — no QR required.',
          });
        }
        const qr = await getQrCode(creds);
        return res.json({
          provider: 'green-api',
          qr,
          qrcode: qr.base64,
          instanceName: row.instanceName,
          greenInstanceId: row.greenInstanceId,
          connectionState: state,
          connected: false,
          simulationMode: false,
          message: qr.message ?? undefined,
        });
      } catch (err) {
        return sendGreenRouteError(res, err);
      }
    }

    const webhookUrl = await buildEvolutionWebhookUrl();
    const { qr, simulationMode, message } = await resolveInstanceQr(row.instanceName, webhookUrl, {
      skipCreate: true,
    });

    res.json({
      provider: 'evolution',
      qr,
      qrcode: qr?.base64 ?? null,
      instanceName: row.instanceName,
      connected: false,
      mock: isEvolutionMockMode() || simulationMode,
      simulationMode,
      message: message ?? undefined,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/status', async (req, res, next) => {
  try {
    const row = await prisma.whatsAppInstance.findUnique({ where: { id: req.params.id } });
    if (!row) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    if (useGreenProvider()) {
      const creds = resolveGreenCredentials(row);
      try {
        const { state, raw } = await getStateInstance(creds);
        return res.json({
          provider: 'green-api',
          instanceName: row.instanceName,
          greenInstanceId: row.greenInstanceId,
          connectionState: state,
          connected: isGreenConnectedState(state),
          mock: false,
          simulationMode: false,
          raw,
        });
      } catch (err) {
        return res.json({
          provider: 'green-api',
          instanceName: row.instanceName,
          connectionState: 'unreachable',
          connected: false,
          message: err.message,
        });
      }
    }

    const config = await resolveEvolutionConfig();
    try {
      const stateRaw = await getEvolutionConnectionState(row.instanceName);
      const connectionState = normalizeConnectionState(stateRaw);
      return res.json({
        provider: 'evolution',
        instanceName: row.instanceName,
        connectionState,
        connected: ['open', 'connected'].includes(connectionState),
        mock: isEvolutionMockMode(),
        raw: stateRaw,
      });
    } catch {
      return res.json({
        provider: 'evolution',
        instanceName: row.instanceName,
        connectionState: 'unreachable',
        connected: false,
        mock: isEvolutionMockMode() || !config.configured,
      });
    }
  } catch (err) {
    next(err);
  }
});

router.post('/:id/logout', requireAdmin, async (req, res, next) => {
  try {
    if (!useGreenProvider()) {
      return res.status(400).json({ error: 'Logout supported for Green API only' });
    }
    const row = await prisma.whatsAppInstance.findUnique({ where: { id: req.params.id } });
    if (!row) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    const creds = resolveGreenCredentials(row);
    const result = await logoutInstance(creds);
    invalidateGreenStateCache(creds);
    res.json({ ok: true, result });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reboot', requireAdmin, async (req, res, next) => {
  try {
    if (!useGreenProvider()) {
      return res.status(400).json({ error: 'Reboot supported for Green API only' });
    }
    const row = await prisma.whatsAppInstance.findUnique({ where: { id: req.params.id } });
    if (!row) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    const creds = resolveGreenCredentials(row);
    const result = await rebootInstance(creds);
    invalidateGreenStateCache(creds);
    res.json({ ok: true, result });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/default', requireAdmin, async (req, res, next) => {
  try {
    const row = await prisma.whatsAppInstance.findUnique({ where: { id: req.params.id } });
    if (!row) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    await prisma.$transaction([
      prisma.whatsAppInstance.updateMany({ data: { isDefault: false } }),
      prisma.whatsAppInstance.update({
        where: { id: row.id },
        data: { isDefault: true },
      }),
    ]);

    const updated = await prisma.whatsAppInstance.findUnique({ where: { id: row.id } });
    res.json({ instance: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const row = await prisma.whatsAppInstance.findUnique({ where: { id: req.params.id } });
    if (!row) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    if (!useGreenProvider()) {
      try {
        await deleteEvolutionInstance(row.instanceName);
      } catch {
        /* ignore */
      }
    }

    await prisma.whatsAppInstance.delete({ where: { id: row.id } });

    const remaining = await prisma.whatsAppInstance.findFirst({ orderBy: { createdAt: 'asc' } });
    if (remaining) {
      const hasDefault = await prisma.whatsAppInstance.findFirst({ where: { isDefault: true } });
      if (!hasDefault) {
        await prisma.whatsAppInstance.update({
          where: { id: remaining.id },
          data: { isDefault: true },
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
