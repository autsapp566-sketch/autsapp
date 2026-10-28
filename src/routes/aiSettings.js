import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
import {
  getAiSettings,
  serializeAiSettings,
  TEXT_MODELS,
  TTS_VOICES,
  updateAiSettings,
  MOROCCAN_DARIJA_PERSONA_TEMPLATE,
} from '../services/aiSettings.js';
const router = express.Router();

// Still ONE platform-wide AiSettings record (shared OpenAI key / prompt): operator only until it is
// made per-organization.
router.use(authenticate, attachUser);

router.get('/', requirePlatformAdmin, async (req, res, next) => {
  try {
    const row = await getAiSettings();
    res.json({
      settings: serializeAiSettings(row),
      options: { textModels: TEXT_MODELS, ttsVoices: TTS_VOICES },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/', requirePlatformAdmin, async (req, res, next) => {
  try {
    const row = await updateAiSettings({
      openAiApiKey: req.body?.openAiApiKey,
      appPublicUrl: req.body?.appPublicUrl,
      greenApiInstanceId:
        req.body?.greenApiInstanceId ?? req.body?.greenInstanceId ?? req.body?.idInstance,
      greenApiToken: req.body?.greenApiToken ?? req.body?.apiTokenInstance,
      greenApiUrl: req.body?.greenApiUrl ?? req.body?.apiUrl,
      textModel: req.body?.textModel,
      sttEnabled: req.body?.sttEnabled,
      ttsEnabled: req.body?.ttsEnabled,
      ttsVoice: req.body?.ttsVoice,
      employeePrompt: req.body?.employeePrompt ?? req.body?.systemPrompt,
      qualificationPrompt: req.body?.qualificationPrompt,
    });
    res.json({ settings: serializeAiSettings(row) });
  } catch (err) {
    next(err);
  }
});

router.get('/templates/moroccan', requirePlatformAdmin, (_req, res) => {
  res.json({
    template: MOROCCAN_DARIJA_PERSONA_TEMPLATE,
  });
});

export default router;
