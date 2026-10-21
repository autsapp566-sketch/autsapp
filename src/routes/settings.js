import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getAiSettings,
  serializeAiSettings,
  serializeSystemSettings,
  TEXT_MODELS,
  TEXT_MODEL_OPTIONS,
  TTS_VOICES,
  updateAiSettings,
} from '../services/aiSettings.js';

const router = express.Router();

router.use(authenticate, attachUser, requireAdmin);

router.get('/', async (_req, res, next) => {
  try {
    const row = await getAiSettings();
    res.json({
      ...serializeSystemSettings(row),
      settings: serializeAiSettings(row),
      options: { textModels: TEXT_MODELS, textModelOptions: TEXT_MODEL_OPTIONS, ttsVoices: TTS_VOICES },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const row = await updateAiSettings({
      openAiApiKey: body.openaiApiKey ?? body.openAiApiKey,
      evolutionBaseUrl: body.evolutionBaseUrl,
      evolutionApiKey: body.evolutionApiKey,
      evolutionInstance: body.evolutionInstance,
      evolutionWebhookSecret: body.evolutionWebhookSecret,
      appPublicUrl: body.appPublicUrl,
      textModel: body.textModel,
      sttEnabled: body.sttEnabled,
      ttsEnabled: body.ttsEnabled,
      ttsVoice: body.ttsVoice,
      systemPrompt: body.systemPrompt,
      employeePrompt: body.employeePrompt ?? body.systemPrompt,
      qualificationPrompt: body.qualificationPrompt,
    });
    res.json({
      ...serializeSystemSettings(row),
      settings: serializeAiSettings(row),
      message: 'تم حفظ البرومبت والإعدادات بنجاح',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
