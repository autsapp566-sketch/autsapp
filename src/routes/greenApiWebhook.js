import express from 'express';
import { parseGreenApiWebhook } from '../lib/greenApiPayload.js';
import { processIncomingWhatsAppMessage } from '../services/whatsappLeadFlow.js';
import { transcribeWhatsAppAudio } from '../services/voiceAi.js';
import { sendWhatsAppText } from '../services/whatsappMessaging.js';

const router = express.Router();

const AUDIO_DOWNLOAD_MS = 20_000;
const AUDIO_MAX_BYTES = 20 * 1024 * 1024;

const AUDIO_FAILED_REPLY =
  'سمحلي، ما قدرتش نسمع الرسالة الصوتية ديالك 🙏 عافاك كتبها ليا كتابة وغادي نجاوبك فالحين.';

async function downloadAudio(url, fallbackMime) {
  const response = await fetch(url, { signal: AbortSignal.timeout(AUDIO_DOWNLOAD_MS) });
  if (!response.ok) {
    throw new Error(`Audio download failed (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > AUDIO_MAX_BYTES) {
    throw new Error('Audio file is empty or too large');
  }
  const mimeType =
    response.headers.get('content-type')?.split(';')[0]?.trim() ||
    String(fallbackMime).split(';')[0].trim() ||
    'audio/ogg';
  return { buffer, mimeType };
}

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

    const input = {
      remoteJid: parsed.remoteJid,
      phone: parsed.phone,
      text: parsed.text,
      pushName: parsed.pushName,
      instance: parsed.instanceId ?? 'green-api',
      isVoiceNote: false,
      isEdited: Boolean(parsed.isEdited),
      ad: parsed.ad ?? null,
    };

    if (parsed.audio) {
      try {
        const { buffer, mimeType } = await downloadAudio(
          parsed.audio.downloadUrl,
          parsed.audio.mimeType
        );
        const transcript = await transcribeWhatsAppAudio(buffer, mimeType);
        if (!transcript) {
          throw new Error('Empty transcription');
        }
        input.text = transcript;
        input.isVoiceNote = true;
      } catch (err) {
        console.error('[webhook] voice note failed:', err.message);
        try {
          await sendWhatsAppText({
            remoteJid: parsed.remoteJid,
            phone: parsed.phone,
            text: AUDIO_FAILED_REPLY,
            instance: input.instance,
          });
        } catch (sendErr) {
          console.error('[webhook] could not send audio fallback:', sendErr.message);
        }
        return res.status(200).json({
          ok: true,
          provider: 'green-api',
          idMessage: parsed.idMessage,
          audioTranscribed: false,
          error: err.message,
        });
      }
    }

    const result = await processIncomingWhatsAppMessage(input);

    return res.status(200).json({
      ok: true,
      provider: 'green-api',
      idMessage: parsed.idMessage,
      ...result,
    });
  } catch (err) {
    // Answer 200 anyway: a 5xx makes Green API re-deliver the same webhook every minute,
    // which re-saves the customer's message and re-calls OpenAI in a loop.
    console.error('[webhook] processing failed:', err);
    res.status(200).json({ ok: false, error: err.message });
  }
});

export default router;
