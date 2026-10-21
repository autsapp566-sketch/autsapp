import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getAiSettings,
  serializeAiSettings,
  TEXT_MODELS,
  TEXT_MODEL_OPTIONS,
  TTS_VOICES,
  updateAiSettings,
  MOROCCAN_DARIJA_PERSONA_TEMPLATE,
} from '../services/aiSettings.js';
import { QUALIFICATION_SYSTEM_PROMPT } from '../services/qualificationPrompt.js';

const router = express.Router();

router.use(authenticate, attachUser, requireAdmin);

async function readSettings(_req, res, next) {
  try {
    const row = await getAiSettings();
    res.json({
      settings: serializeAiSettings(row),
      options: { textModels: TEXT_MODELS, textModelOptions: TEXT_MODEL_OPTIONS, ttsVoices: TTS_VOICES },
    });
  } catch (err) {
    next(err);
  }
}

async function writeSettings(req, res, next) {
  try {
    const row = await updateAiSettings({
      openAiApiKey: req.body?.openAiApiKey,
      evolutionBaseUrl: req.body?.evolutionBaseUrl,
      evolutionApiKey: req.body?.evolutionApiKey,
      evolutionInstance: req.body?.evolutionInstance,
      evolutionWebhookSecret: req.body?.evolutionWebhookSecret,
      appPublicUrl: req.body?.appPublicUrl,
      textModel: req.body?.textModel,
      sttEnabled: req.body?.sttEnabled,
      ttsEnabled: req.body?.ttsEnabled,
      ttsVoice: req.body?.ttsVoice,
      employeePrompt: req.body?.employeePrompt ?? req.body?.systemPrompt,
      qualificationPrompt: req.body?.qualificationPrompt,
    });
    res.json({
      settings: serializeAiSettings(row),
      message: 'تم حفظ إعدادات المحرك بنجاح',
    });
  } catch (err) {
    next(err);
  }
}

router.get('/', readSettings);
router.post('/', writeSettings);
router.patch('/', writeSettings);

router.get('/templates/moroccan', (_req, res) => {
  res.json({ template: MOROCCAN_DARIJA_PERSONA_TEMPLATE });
});

router.get('/templates/qualification', (_req, res) => {
  res.json({ template: QUALIFICATION_SYSTEM_PROMPT });
});

export default router;
