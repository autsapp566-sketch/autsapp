import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireAgent } from '../middleware/requireAgent.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
import { requireActiveSubscription } from '../middleware/subscription.js';
import { createWhatsAppInstanceWithinQuota } from '../services/billing/subscriptionService.js';
import { prisma } from '../lib/prisma.js';
import {
  buildEvolutionWebhookUrl,
  connectInstance,
  createInstance,
  deleteInstance,
  fetchInstanceInfo,
  getConnectionState,
  getEvolutionConfig,
  invalidateEvolutionStateCache,
  isEvolutionConfigured,
  isEvolutionConnectedState,
  logoutInstance,
  maskEvolutionKey,
  pingEvolution,
  restartInstance,
  setInstanceWebhook,
  verifyEvolutionKey,
} from '../services/evolutionService.js';
import { listEvolutionHits } from '../services/evolutionWebhookLog.js';
import { getStateInstance, isGreenConnectedState, resolveGreenCredentials } from '../services/greenApi.js';
import { isLegacyGreenRow, promoteDefaultIfLegacy } from '../services/whatsappInstanceStore.js';

const router = express.Router();
const INSTANCE_NAME_RE = /^[a-z0-9_-]{3,40}$/;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

function isLocalBase(url) {
  return /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url);
}

/** Public base URL of THIS API, derived from the incoming request. */
function requestBaseUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '').split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}

/** Webhook URL for this deployment, or null when running on localhost (Evolution could not reach it). */
function webhookUrlFor(req) {
  const base = requestBaseUrl(req);
  return base && !isLocalBase(base) ? buildEvolutionWebhookUrl(base) : null;
}

function requireEvolution() {
  if (!isEvolutionConfigured()) {
    throw httpError(400, 'Evolution API غير مضبوط — أضف EVOLUTION_API_URL و EVOLUTION_API_KEY في .env (وفي إعدادات Vercel)');
  }
}

function sendRouteError(res, err, fallbackStatus = 502) {
  const status = typeof err.status === 'number' ? err.status : fallbackStatus;
  return res.status(status).json({ error: err.message || 'Evolution API request failed', provider: 'evolution' });
}

function serializeInstance(row, connectionState, extra = {}) {
  const legacy = isLegacyGreenRow(row);
  return {
    id: row.id,
    instanceName: row.instanceName,
    label: row.label,
    phone: row.phone,
    provider: legacy ? 'green-api' : 'evolution',
    legacy,
    greenInstanceId: legacy ? row.greenInstanceId : null,
    isDefault: row.isDefault,
    connectionState,
    connected: legacy ? isGreenConnectedState(connectionState) : isEvolutionConnectedState(connectionState),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extra,
  };
}

/** Connection state of any row (Evolution or legacy Green). Never throws. */
async function stateOf(row) {
  try {
    if (isLegacyGreenRow(row)) {
      const creds = resolveGreenCredentials(row);
      if (!creds.configured) return { state: 'notConfigured' };
      return { state: (await getStateInstance(creds)).state };
    }
    if (!isEvolutionConfigured()) return { state: 'notConfigured', error: 'Evolution API غير مضبوط' };
    return { state: (await getConnectionState(row.instanceName)).state };
  } catch (err) {
    // A 404 from Evolution means the instance does not exist on the server (deleted / never created).
    if (err.evolutionStatus === 404) {
      return { state: 'missing', error: 'هذه الجلسة غير موجودة في Evolution API — أعد ربطها' };
    }
    return { state: 'unreachable', error: err?.message ?? 'تعذر الاتصال' };
  }
}

/** Tenant-scoped: an instance of another organization is simply "not found". */
async function loadRow(id, organizationId) {
  const row = await prisma.whatsAppInstance.findFirst({ where: { id, organizationId } });
  if (!row) throw httpError(404, 'Instance not found');
  return row;
}

function requireEvolutionRow(row) {
  if (isLegacyGreenRow(row)) {
    throw httpError(400, 'هذا الرقم مرتبط عبر Green API (قديم). أضف الرقم من جديد عبر Evolution ثم احذف القديم.');
  }
}

router.use(authenticate, attachUser, requireAgent);

// Platform diagnostics (shared Evolution server + raw webhook payloads of ALL tenants): operator only.
router.get('/integration', requirePlatformAdmin, async (req, res, next) => {
  try {
    const cfg = getEvolutionConfig();
    const [ping, key] = cfg.configured ? await Promise.all([pingEvolution(), verifyEvolutionKey()]) : [null, null];
    res.json({
      provider: 'evolution',
      configured: cfg.configured,
      baseUrl: cfg.baseUrl || null,
      apiKeyMasked: maskEvolutionKey(cfg.apiKey),
      reachable: ping?.reachable ?? false,
      version: ping?.version ?? null,
      keyValid: key?.ok ?? false,
      error: !cfg.configured ? 'EVOLUTION_API_URL / EVOLUTION_API_KEY غير مضبوطين' : ping?.error ?? key?.error ?? null,
      webhookUrl: webhookUrlFor(req) ?? '(يُضبط تلقائياً عند الربط من النسخة المنشورة)',
    });
  } catch (err) {
    next(err);
  }
});

/** Last webhook calls received from Evolution (to debug "messages do not arrive"). */
router.get('/webhook-log', requirePlatformAdmin, async (_req, res, next) => {
  try {
    res.json({ hits: await listEvolutionHits() });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    // Agents restricted to some numbers only see those numbers.
    const allowed = req.user?.instanceIds;
    const rows = await prisma.whatsAppInstance.findMany({
      where: {
        organizationId: req.user.organizationId,
        ...(Array.isArray(allowed) ? { id: { in: allowed } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    const instances = await Promise.all(
      rows.map(async (row) => {
        const { state, error } = await stateOf(row);
        return serializeInstance(row, state, { connectionError: error });
      })
    );
    res.json({ provider: 'evolution', instances });
  } catch (err) {
    next(err);
  }
});

/** Link a new WhatsApp number: create the Evolution session, register the webhook, return the QR. */
router.post('/', requireAdmin, requireActiveSubscription, async (req, res, next) => {
  try {
    requireEvolution();
    const organizationId = req.user.organizationId;

    const body = req.body ?? {};
    const instanceName = String(body.instanceName ?? '').trim().toLowerCase();
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const number = String(body.number ?? '').replace(/\D/g, '');

    if (!INSTANCE_NAME_RE.test(instanceName)) {
      throw httpError(400, 'اسم الجلسة: 3-40 حرفاً (a-z و 0-9 و _ أو -) بدون فراغات');
    }
    if (number && (number.length < 8 || number.length > 15)) {
      throw httpError(400, 'رقم الهاتف غير صالح — اكتبه بصيغة دولية بدون + (مثال: 212612345678)');
    }

    let row = await prisma.whatsAppInstance.findUnique({ where: { instanceName } });
    // Session names are global on the shared Evolution server: never touch another tenant's session,
    // and do not reveal that it exists beyond "name taken".
    if (row && row.organizationId !== organizationId) {
      throw httpError(409, 'اسم الجلسة مستعمل — اختر اسماً آخر');
    }
    if (row && isLegacyGreenRow(row)) {
      throw httpError(409, 'اسم الجلسة مستعمل لرقم Green API قديم — اختر اسماً آخر');
    }

    const data = { label: label || instanceName, provider: 'evolution', phone: number || null };

    // A brand-new number consumes a plan slot. Reserve it (atomic subscription + limit check) BEFORE
    // creating the Evolution session, so a tenant at its limit never creates a session on the server.
    // Re-linking one of the organization's existing numbers needs no extra slot.
    let reservedRow = null;
    if (!row) {
      reservedRow = await createWhatsAppInstanceWithinQuota(organizationId, { instanceName, ...data });
      row = reservedRow;
    }

    let createResult;
    try {
      createResult = await createInstance({ instanceName, number: number || undefined });
    } catch (err) {
      if (reservedRow) {
        await prisma.whatsAppInstance.delete({ where: { id: reservedRow.id } }).catch(() => {});
      }
      throw err;
    }
    const { created, qr: createQr } = createResult;

    if (!reservedRow) {
      row = await prisma.whatsAppInstance.update({ where: { id: row.id }, data });
    }

    // Incoming messages / connection updates -> this API (skipped on localhost: unreachable from the internet).
    let webhookSynced = false;
    let webhookError;
    const webhookUrl = webhookUrlFor(req);
    if (webhookUrl) {
      try {
        await setInstanceWebhook(instanceName, webhookUrl);
        webhookSynced = true;
      } catch (err) {
        webhookError = err.message;
      }
    } else {
      webhookError = 'تعذر ضبط Webhook من localhost — اربط الرقم من النسخة المنشورة على Vercel';
    }

    let qr = createQr;
    let connected = false;
    let message;
    const { state } = await getConnectionState(instanceName).catch(() => ({ state: 'unknown' }));
    if (isEvolutionConnectedState(state)) {
      connected = true;
      message = 'WhatsApp متصل مسبقاً — لا حاجة لـ QR.';
      await promoteDefaultIfLegacy(row);
    } else if (!qr.base64 && !qr.pairingCode) {
      const result = await connectInstance(instanceName, number || undefined);
      qr = result.qr;
      connected = result.connected;
      message = qr.message ?? undefined;
    }

    res.status(201).json({
      provider: 'evolution',
      instance: serializeInstance(row, state),
      created,
      qr,
      qrcode: qr.base64,
      pairingCode: qr.pairingCode,
      connected,
      message,
      webhookSynced,
      webhookError,
    });
  } catch (err) {
    if (err.billing) return next(err); // 402 + machine-readable code (handled by errorHandler)
    if (err.status) return sendRouteError(res, err);
    next(err);
  }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const row = await loadRow(req.params.id, req.user.organizationId);
    const data = {};
    if (typeof req.body?.label === 'string') data.label = req.body.label.trim();
    const updated = await prisma.whatsAppInstance.update({ where: { id: row.id }, data });
    res.json({ instance: serializeInstance(updated, 'unknown') });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/connect', requireAdmin, requireActiveSubscription, async (req, res, next) => {
  try {
    const row = await loadRow(req.params.id, req.user.organizationId);
    requireEvolutionRow(row);
    requireEvolution();

    const number = typeof req.query.number === 'string' ? req.query.number : undefined;
    const { connected, qr } = await connectInstance(row.instanceName, number);
    if (connected) await promoteDefaultIfLegacy(row);
    res.json({
      provider: 'evolution',
      instanceName: row.instanceName,
      qr,
      qrcode: qr.base64,
      pairingCode: qr.pairingCode,
      connectionState: connected ? 'open' : 'connecting',
      connected,
      message: qr.message ?? undefined,
    });
  } catch (err) {
    if (err.status) return sendRouteError(res, err);
    next(err);
  }
});

router.get('/:id/status', async (req, res, next) => {
  try {
    const row = await loadRow(req.params.id, req.user.organizationId);
    const { state, error } = await stateOf(row);
    const connected = isLegacyGreenRow(row) ? isGreenConnectedState(state) : isEvolutionConnectedState(state);

    if (connected && !isLegacyGreenRow(row)) {
      await promoteDefaultIfLegacy(row);
      if (!row.phone) {
        const info = await fetchInstanceInfo(row.instanceName).catch(() => null);
        if (info?.phone) await prisma.whatsAppInstance.update({ where: { id: row.id }, data: { phone: info.phone } });
      }
    }

    res.json({
      provider: isLegacyGreenRow(row) ? 'green-api' : 'evolution',
      instanceName: row.instanceName,
      connectionState: state,
      connected,
      message: error,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/logout', requireAdmin, async (req, res, next) => {
  try {
    const row = await loadRow(req.params.id, req.user.organizationId);
    requireEvolutionRow(row);
    const result = await logoutInstance(row.instanceName);
    res.json({ ok: true, result });
  } catch (err) {
    if (err.status) return sendRouteError(res, err);
    next(err);
  }
});

router.post('/:id/reboot', requireAdmin, async (req, res, next) => {
  try {
    const row = await loadRow(req.params.id, req.user.organizationId);
    requireEvolutionRow(row);
    const result = await restartInstance(row.instanceName);
    res.json({ ok: true, result });
  } catch (err) {
    if (err.status) return sendRouteError(res, err);
    next(err);
  }
});

/** Re-register this API's webhook on the instance. */
router.post('/:id/webhook', requireAdmin, async (req, res, next) => {
  try {
    const row = await loadRow(req.params.id, req.user.organizationId);
    requireEvolutionRow(row);
    const webhookUrl = webhookUrlFor(req);
    if (!webhookUrl) {
      throw httpError(400, 'لا يمكن ضبط Webhook من localhost — نفّذ هذا من الواجهة المنشورة على Vercel');
    }
    await setInstanceWebhook(row.instanceName, webhookUrl);
    res.json({ ok: true, message: 'تم ضبط Webhook' });
  } catch (err) {
    if (err.status) return sendRouteError(res, err);
    next(err);
  }
});

router.patch('/:id/default', requireAdmin, async (req, res, next) => {
  try {
    const row = await loadRow(req.params.id, req.user.organizationId);
    await prisma.$transaction([
      prisma.whatsAppInstance.updateMany({ where: { organizationId: row.organizationId }, data: { isDefault: false } }),
      prisma.whatsAppInstance.update({ where: { id: row.id }, data: { isDefault: true } }),
    ]);
    const updated = await prisma.whatsAppInstance.findUnique({ where: { id: row.id } });
    res.json({ instance: updated });
  } catch (err) {
    next(err);
  }
});

/** Delete the session on Evolution API and remove the number from the dashboard. */
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const row = await loadRow(req.params.id, req.user.organizationId);

    let remoteDeleted = false;
    let remoteError;
    if (!isLegacyGreenRow(row) && isEvolutionConfigured()) {
      try {
        await deleteInstance(row.instanceName);
        remoteDeleted = true;
      } catch (err) {
        // Already gone on the server => nothing to delete there.
        if (err.evolutionStatus === 404) remoteDeleted = true;
        else remoteError = err.message;
      }
      invalidateEvolutionStateCache(row.instanceName);
    }

    await prisma.whatsAppInstance.delete({ where: { id: row.id } });

    const orgScope = { organizationId: row.organizationId };
    const hasDefault = await prisma.whatsAppInstance.findFirst({ where: { ...orgScope, isDefault: true } });
    if (!hasDefault) {
      const remaining = await prisma.whatsAppInstance.findFirst({
        where: { ...orgScope, provider: { not: 'green' } },
        orderBy: { createdAt: 'asc' },
      });
      const fallback =
        remaining ?? (await prisma.whatsAppInstance.findFirst({ where: orgScope, orderBy: { createdAt: 'asc' } }));
      if (fallback) {
        await prisma.whatsAppInstance.update({ where: { id: fallback.id }, data: { isDefault: true } });
      }
    }

    res.json({ ok: true, remoteDeleted, remoteError });
  } catch (err) {
    next(err);
  }
});

export default router;
