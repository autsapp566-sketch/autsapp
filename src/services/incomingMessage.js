import { describeCustomerProductImage } from './adContext.js';
import { processIncomingWhatsAppMessage } from './whatsappLeadFlow.js';
import { transcribeWhatsAppAudio } from './voiceAi.js';
import { sendWhatsAppText } from './whatsappMessaging.js';

const AUDIO_DOWNLOAD_MS = 20_000;
const AUDIO_MAX_BYTES = 20 * 1024 * 1024;

const AUDIO_FAILED_REPLY =
  'سمحلي، ما قدرتش نسمع الرسالة الصوتية ديالك 🙏 عافاك كتبها ليا كتابة وغادي نجاوبك فالحين.';

/** Download an audio file from a URL (Green API). */
export async function downloadAudioFromUrl(url, fallbackMime) {
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
 * Provider-independent handling of a parsed incoming WhatsApp message:
 * voice -> text, then the normal qualification / reply flow.
 *
 * @param {{
 *   remoteJid: string, phone: string, text: string, pushName: string | null,
 *   idMessage: string | null, instanceId: string | null, isEdited?: boolean, ad?: object | null,
 *   audio?: object,
 *   image?: { messageId: string, mimeType: string },
 * }} parsed
 * @param {{ provider: string, fetchAudio?: () => Promise<{ buffer: Buffer, mimeType: string }>, fetchImage?: () => Promise<{ buffer: Buffer, mimeType: string }> }} options
 */
export async function handleIncomingMessage(parsed, { provider, fetchAudio, fetchImage }) {
  const input = {
    remoteJid: parsed.remoteJid,
    phone: parsed.phone,
    text: parsed.text,
    pushName: parsed.pushName,
    instance: parsed.instanceId ?? provider,
    isVoiceNote: false,
    isEdited: Boolean(parsed.isEdited),
    ad: parsed.ad ?? null,
    imageContext: null,
  };

  if (parsed.audio) {
    try {
      const { buffer, mimeType } = await fetchAudio();
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
      return { ok: true, provider, idMessage: parsed.idMessage, audioTranscribed: false, error: err.message };
    }
  }

  if (parsed.image && fetchImage) {
    try {
      const { buffer, mimeType } = await fetchImage();
      const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${buffer.toString('base64')}`;
      const described = await describeCustomerProductImage(dataUrl);
      if (described) {
        input.imageContext = described.prompt;
        if (!input.text) input.text = described.note;
      }
    } catch (err) {
      console.error('[webhook] customer image failed:', err.message);
    }
    if (!input.text) input.text = '📷 صورة منتج';
  }

  const result = await processIncomingWhatsAppMessage(input);
  return { ok: true, provider, idMessage: parsed.idMessage, ...result };
}
