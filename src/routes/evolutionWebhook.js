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
import { recordEvolutionHit } from '../services/evolutionWebhookLog.js';
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
    await recordEvolutionHit({
      event: normalizeEvolutionEvent(req.body?.event),
      body: req.body,
      result: 'رُفض: token غير صحيح (أعد ضبط Webhook)',
      ok: false,
    });
    return res.status(401).json({ ok: false, error: 'invalid webhook token' });
  }

  const event = normalizeEvolutionEvent(req.body?.event);
  try {
    if (event === 'CONNECTION_UPDATE') {
      const update = parseEvolutionConnectionUpdate(req.body);
      if (update) await handleConnectionUpdate(update);
      await recordEvolutionHit({ event, body: req.body, result: `حالة الاتصال: ${update?.state ?? '?'}` });
      return res.status(200).json({ ok: true, event });
    }

    const parsed = parseEvolutionWebhook(req.body);
    if (!parsed) {
      const key = req.body?.data?.key;
      let reason = 'حدث غير مدعوم';
      if (key?.fromMe) reason = 'تُجوهلت: رسالة صادرة من نفس الرقم (fromMe)';
      else if (String(key?.remoteJid ?? '').endsWith('@g.us')) reason = 'تُجوهلت: رسالة مجموعة';
      else if (String(key?.remoteJid ?? '').includes('status@broadcast')) reason = 'تُجوهلت: حالة (status)';
      else if (key) reason = 'تُجوهلت: نوع رسالة غير نصي/صوتي';
      await recordEvolutionHit({ event, body: req.body, result: reason });
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
    await recordEvolutionHit({
      event,
      body: req.body,
      result: result?.skippedAi ? 'استُلمت (البوت متوقف لهذه المحادثة)' : 'استُلمت وعولجت ✓',
    });
    return res.status(200).json(result);
  } catch (err) {
    // Always 200 so Evolution does not redeliver the same message in a loop.
    console.error('[evolution-webhook] processing failed:', err);
    await recordEvolutionHit({ event, body: req.body, result: `خطأ أثناء المعالجة: ${err.message}`.slice(0, 200), ok: false });
    return res.status(200).json({ ok: false, error: err.message });
  }
});

export default router;
