import express from 'express';
import { parseEvolutionWhatsAppMessage, phoneFromRemoteJid } from '../lib/evolutionPayload.js';
import { processIncomingWhatsAppMessage } from '../services/whatsappLeadFlow.js';
import { getAiSettings } from '../services/aiSettings.js';
import { getEvolutionConfigFromSettings } from '../services/platformSettings.js';
import { transcribeWhatsAppAudio } from '../services/voiceAi.js';

const router = express.Router();

async function verifyWebhookSecret(req, res, next) {
  try {
    const settings = await getAiSettings();
    const { webhookSecret } = await getEvolutionConfigFromSettings(settings);
    if (!webhookSecret) {
      return next();
    }

    const header = req.headers['x-webhook-secret'] ?? req.headers['x-evolution-webhook-secret'];
    const query = req.query.secret;

    if (header === webhookSecret || query === webhookSecret) {
      return next();
    }

    return res.status(401).json({ error: 'Invalid webhook secret' });
  } catch (err) {
    next(err);
  }
}

router.post('/whatsapp', verifyWebhookSecret, async (req, res, next) => {
  try {
    const parsed = parseEvolutionWhatsAppMessage(req.body);
    if (!parsed) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    let text = parsed.text;
    if (!text && parsed.audioBase64) {
      const settings = await getAiSettings();
      if (settings.sttEnabled) {
        const buffer = Buffer.from(parsed.audioBase64, 'base64');
        text = await transcribeWhatsAppAudio(buffer, parsed.audioMimeType ?? 'audio/ogg');
      }
    }

    if (!text?.trim()) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'no_text_or_stt_disabled' });
    }

    const phone = phoneFromRemoteJid(parsed.remoteJid);
    const result = await processIncomingWhatsAppMessage({
      remoteJid: parsed.remoteJid,
      phone,
      text: text.trim(),
      pushName: parsed.pushName,
      instance: parsed.instance || (await getEvolutionConfigFromSettings()).instance,
      isVoiceNote: Boolean(parsed.audioBase64),
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
