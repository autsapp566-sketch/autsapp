import express from 'express';
import { parseGreenApiWebhook } from '../lib/greenApiPayload.js';
import { downloadAudioFromUrl, handleIncomingMessage } from '../services/incomingMessage.js';

const router = express.Router();

/**
 * Legacy Green API incoming webhook (kept for numbers still linked through Green API).
 * New numbers use Evolution API: see routes/evolutionWebhook.js.
 */
router.post('/', async (req, res) => {
  try {
    const parsed = parseGreenApiWebhook(req.body);
    if (!parsed) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'unsupported_or_empty_webhook' });
    }

    const result = await handleIncomingMessage(parsed, {
      provider: 'green-api',
      fetchAudio: parsed.audio
        ? () => downloadAudioFromUrl(parsed.audio.downloadUrl, parsed.audio.mimeType)
        : undefined,
    });
    return res.status(200).json(result);
  } catch (err) {
    // Answer 200 anyway: a 5xx makes Green API re-deliver the same webhook every minute,
    // which re-saves the customer's message and re-calls OpenAI in a loop.
    console.error('[webhook] processing failed:', err);
    res.status(200).json({ ok: false, error: err.message });
  }
});

export default router;
