import { prisma } from '../../lib/prisma.js';
import { createHttpError } from '../../lib/httpErrors.js';
import { getAiSettings, updateAiSettings } from '../aiSettings.js';
import {
  buildEvolutionWebhookUrl,
  getEvolutionConfig,
  isEvolutionConfigured,
  maskEvolutionKey,
  pingEvolution,
  setInstanceWebhook,
  verifyEvolutionKey,
} from '../evolutionService.js';

function requestBaseUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '').split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}

function isLocalBase(url) {
  return /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url);
}

function webhookUrlFor(req) {
  const base = requestBaseUrl(req);
  return base && !isLocalBase(base) ? buildEvolutionWebhookUrl(base) : null;
}

export async function getEvolutionAdminStatus(req) {
  const cfg = getEvolutionConfig();
  const [ping, key] = cfg.configured ? await Promise.all([pingEvolution(), verifyEvolutionKey()]) : [null, null];
  const settings = await getAiSettings();
  return {
    configured: cfg.configured,
    baseUrl: cfg.baseUrl || null,
    apiKeyMasked: maskEvolutionKey(cfg.apiKey) || null,
    reachable: ping?.reachable ?? false,
    version: ping?.version ?? null,
    keyValid: key?.ok ?? false,
    error: !cfg.configured ? 'EVOLUTION_API_URL / EVOLUTION_API_KEY غير مضبوطين' : ping?.error ?? key?.error ?? null,
    webhookUrl: webhookUrlFor(req),
    appPublicUrl: settings.appPublicUrl ?? '',
  };
}

export async function saveEvolutionPublicUrl(appPublicUrl) {
  if (typeof appPublicUrl !== 'string') throw createHttpError('رابط التطبيق غير صالح', 400);
  const row = await updateAiSettings({ appPublicUrl: appPublicUrl.trim().slice(0, 300) });
  return { appPublicUrl: row.appPublicUrl ?? '', message: 'تم حفظ رابط التطبيق' };
}

/** Re-register the webhook on every Evolution instance, not only one tenant. */
export async function syncAllEvolutionWebhooks(req) {
  if (!isEvolutionConfigured()) {
    throw createHttpError('EVOLUTION_API_URL و EVOLUTION_API_KEY غير مضبوطين', 400);
  }
  const base = requestBaseUrl(req);
  if (!base || isLocalBase(base)) {
    throw createHttpError('لا يمكن ضبط Webhook من localhost — نفّذ هذا الإجراء من الواجهة المنشورة', 400);
  }
  const webhookUrl = buildEvolutionWebhookUrl(base);
  const rows = await prisma.whatsAppInstance.findMany({
    where: { provider: { not: 'green' } },
    select: { instanceName: true },
  });
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
  return {
    ok: results.every((r) => r.ok),
    results,
    message: rows.length
      ? `تم ضبط Webhook على ${okCount} من ${rows.length} رقم`
      : 'لا توجد أرقام Evolution مربوطة بعد',
  };
}
