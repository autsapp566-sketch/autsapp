import { getAiSettings } from './aiSettings.js';
import { getOpenAIClient } from './openaiClient.js';

/**
 * @param {Buffer} audioBuffer
 * @param {string} [mimeType]
 */
export async function transcribeWhatsAppAudio(audioBuffer, mimeType = 'audio/ogg') {
  const settings = await getAiSettings();
  if (!settings.sttEnabled) {
    throw new Error('Speech-to-text is disabled in AI settings');
  }

  const client = await getOpenAIClient();
  const ext = mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('wav') ? 'wav' : 'ogg';
  const file = new File([audioBuffer], `voice.${ext}`, { type: mimeType });

  const result = await client.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'ar',
  });

  return result.text?.trim() ?? '';
}

/**
 * @param {string} text
 */
export async function synthesizeWhatsAppSpeech(text) {
  const settings = await getAiSettings();
  if (!settings.ttsEnabled) {
    return null;
  }

  const client = await getOpenAIClient();
  const speech = await client.audio.speech.create({
    model: 'tts-1',
    voice: settings.ttsVoice,
    input: text.slice(0, 4096),
  });

  const arrayBuffer = await speech.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
