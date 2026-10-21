import express from 'express';
import { parseGreenApiWebhook } from '../lib/greenApiPayload.js';
import { processIncomingWhatsAppMessage } from '../services/whatsappLeadFlow.js';

const router = express.Router();

/**
 * Green API incoming webhook (Configure in Green console:
 * webhookUrl = {APP_PUBLIC_URL}/api/webhook/green-api)
 */
router.post('/', async (req, res, next) => {
  try {
    const parsed = parseGreenApiWebhook(req.body);
    if (!parsed) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: 'unsupported_or_empty_webhook',
      });
    }

    const result = await processIncomingWhatsAppMessage({
      remoteJid: parsed.remoteJid,
      phone: parsed.phone,
      text: parsed.text,
      pushName: parsed.pushName,
      instance: parsed.instanceId ?? 'green-api',
      isVoiceNote: false,
    });

    return res.status(200).json({
      ok: true,
      provider: 'green-api',
      idMessage: parsed.idMessage,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
