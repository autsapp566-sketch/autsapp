import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireAgent } from '../middleware/requireAgent.js';
import { qualifyLead } from '../services/aiQualifier.js';
import { getAiSettings } from '../services/aiSettings.js';
import { transcribeWhatsAppAudio, synthesizeWhatsAppSpeech } from '../services/voiceAi.js';

const router = express.Router();

router.use(authenticate, attachUser, requireAgent);

router.get('/status', async (_req, res, next) => {
  try {
    const settings = await getAiSettings();
    res.json({
      openAiConfigured: Boolean(settings.openAiApiKey?.trim()),
      sttEnabled: settings.sttEnabled,
      ttsEnabled: settings.ttsEnabled,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @param {unknown} raw
 */
function normalizeHistory(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .slice(-24)
    .map((m) => ({
      sender: m.sender === 'BOT' ? 'BOT' : 'USER',
      content: m.content.trim(),
      createdAt: m.createdAt,
    }));
}

router.post('/chat', async (req, res, next) => {
  try {
    const settings = await getAiSettings();
    if (!settings.openAiApiKey?.trim()) {
      return res.status(400).json({
        error: 'مفتاح OpenAI غير مضبوط — أضفه من إعدادات الصوت والذكاء',
      });
    }

    let userText = typeof req.body?.userMessage === 'string' ? req.body.userMessage.trim() : '';
    let voiceNote = false;

    const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.trim() : '';
    if (audioBase64) {
      voiceNote = true;
      const mime = typeof req.body?.audioMime === 'string' ? req.body.audioMime : 'audio/webm';
      const buffer = Buffer.from(audioBase64, 'base64');
      const transcript = await transcribeWhatsAppAudio(buffer, mime);
      userText = transcript || '(تعذر فهم التسجيل الصوتي)';
    }

    if (!userText) {
      return res.status(400).json({ error: 'أدخل رسالة نصية أو سجّل صوتاً للاختبار' });
    }

    const history = normalizeHistory(req.body?.history);
    const conversationHistory = [
      ...history,
      {
        sender: 'USER',
        content: voiceNote ? `[رسالة صوتية] ${userText}` : userText,
        createdAt: new Date().toISOString(),
      },
    ];

    const qualification = await qualifyLead(conversationHistory, {
      leadName: 'عميل تجريبي',
      leadPhone: '+212600000000',
    });

    let replyAudioBase64 = null;
    if (settings.ttsEnabled && qualification.botResponse) {
      const audioBuffer = await synthesizeWhatsAppSpeech(qualification.botResponse);
      if (audioBuffer) {
        replyAudioBase64 = audioBuffer.toString('base64');
      }
    }

    res.json({
      userMessage: {
        sender: 'USER',
        content: voiceNote ? `[رسالة صوتية] ${userText}` : userText,
      },
      botMessage: {
        sender: 'BOT',
        content: qualification.botResponse,
      },
      qualification: {
        score: qualification.score,
        status: qualification.status,
        summary: qualification.summary,
        extractedInfo: qualification.extractedInfo,
      },
      voice: {
        transcript: voiceNote ? userText : null,
        replyAudioBase64,
        replyAudioMime: replyAudioBase64 ? 'audio/mpeg' : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
