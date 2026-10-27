import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import { normalizeEvolutionEvent, parseEvolutionConnectionUpdate, parseEvolutionWebhook } from '../lib/evolutionPayload.js';
import { prisma } from '../lib/prisma.js';
import { createAdminAlert } from '../services/adminAlerts.js';
import {
  evolutionWebhookToken,
  fetchInstanceInfo,
  getMediaBase64,
  rememberConnectionState,
} from '../services/evolutionService.js';
import { handleIncomingMessage } from '../services/incomingMessage.js';
import { findInstanceRow, promoteDefaultIfLegacy } from '../services/whatsappInstanceStore.js';

const router = express.Router();

function tokenMatches(received) {
  const a = Buffer.from(String(received ?? ''));
  const b = Buffer.from(evolutionWebhookToken());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Connection state changes: keep the dashboard in sync and warn the admin when a number drops. */
async function handleConnectionUpdate(update) {
  rememberConnectionState(update.instance, update.state);
  const row = await findInstanceRow(update.instance);
  if (!row) return;

  if (update.state === 'open') {
    const info = await fetchInstanceInfo(update.instance).catch(() => null);
    if (info?.phone && info.phone !== row.phone) {
      await prisma.whatsAppInstance.update({ where: { id: row.id }, data: { phone: info.phone } });
    }
    await promoteDefaultIfLegacy(row);
    return;
  }

  // 401 = logged out from the phone. Plain "close" also happens during normal reconnects, so only
  // alert for the cases that need a human (logged out / replaced by another session).
  if (update.state === 'close' && (update.statusReason === 401 || update.statusReason === 440)) {
    await createAdminAlert({
      kind: 'WHATSAPP_DISCONNECTED',
      message: `📵 انقطع ربط رقم واتساب «${row.label || row.instanceName}» (تم تسجيل الخروج). أعد ربطه بمسح QR من صفحة «ربط أرقام واتساب».`,
    });
  }
}

/**
 * Evolution API webhook. Registered per instance as
 * {API}/api/webhook/evolution?token=... (events: MESSAGES_UPSERT, MESSAGES_EDITED, CONNECTION_UPDATE).
 */
router.post('/', async (req, res) => {
  if (!tokenMatches(req.query.token)) {
    return res.status(401).json({ ok: false, error: 'invalid webhook token' });
  }

  try {
    const event = normalizeEvolutionEvent(req.body?.event);

    if (event === 'CONNECTION_UPDATE') {
      const update = parseEvolutionConnectionUpdate(req.body);
      if (update) await handleConnectionUpdate(update);
      return res.status(200).json({ ok: true, event });
    }

    const parsed = parseEvolutionWebhook(req.body);
    if (!parsed) {
      return res.status(200).json({ ok: true, ignored: true, event, reason: 'unsupported_or_empty_webhook' });
    }

    const result = await handleIncomingMessage(parsed, {
      provider: 'evolution',
      fetchAudio: parsed.audio
        ? async () => {
            const media = parsed.audio.base64
              ? { base64: parsed.audio.base64, mimeType: parsed.audio.mimeType }
              : await getMediaBase64(parsed.instanceId, parsed.audio.messageId);
            return { buffer: Buffer.from(media.base64, 'base64'), mimeType: media.mimeType };
          }
        : undefined,
    });
    return res.status(200).json(result);
  } catch (err) {
    // Always 200 so Evolution does not redeliver the same message in a loop.
    console.error('[evolution-webhook] processing failed:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
});

export default router;
