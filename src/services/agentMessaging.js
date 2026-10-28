import { prisma } from '../lib/prisma.js';
import { sendWhatsAppAudioFile, sendWhatsAppText } from './whatsappMessaging.js';
import { broadcastMessageCreated } from './notifications.js';
import { saveUploadedImage } from './uploadedImages.js';
import { getAiSettings } from './aiSettings.js';
import { sendKeyForLead } from './whatsappInstanceStore.js';

/**
 * @param {string} leadId
 * @param {string} content
 * @param {string} [instance]
 */
export async function sendAgentWhatsAppMessage(organizationId, leadId, content, instance) {
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) {
    throw new Error('Message content is required');
  }

  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }

  // Strict isolation: always answer from the number this conversation belongs to (the client-supplied
  // `instance` is only a fallback for legacy conversations that have no number).
  const sendKey = (await sendKeyForLead(lead)) ?? instance;

  // Send first: if WhatsApp rejects it, nothing is saved and the agent sees the real error.
  await sendWhatsAppText({
    organizationId,
    phone: lead.phone,
    text,
    instance: sendKey,
  });

  const message = await prisma.message.create({
    data: {
      organizationId,
      leadId: lead.id,
      instanceId: lead.instanceId,
      sender: 'AGENT',
      content: text,
    },
  });

  broadcastMessageCreated(lead, message);

  return { lead, message };
}

const AUDIO_EXT = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
};

function isLocalBase(base) {
  return /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(base);
}

/**
 * Store a recorded voice note and send it to the customer on WhatsApp as an audio file.
 * Green API fetches the file from a public URL, so localhost needs APP_PUBLIC_URL (e.g. an ngrok URL).
 * @param {{ organizationId: string, leadId: string, buffer: Buffer, mimeType: string, requestBase: string, instance?: string }} params
 */
export async function sendAgentWhatsAppVoice({ organizationId, leadId, buffer, mimeType, requestBase, instance }) {
  const mime = String(mimeType ?? '').split(';')[0].trim().toLowerCase();
  const ext = AUDIO_EXT[mime];
  if (!ext) {
    const err = new Error('صيغة الصوت غير مدعومة');
    err.status = 400;
    err.expose = true;
    throw err;
  }
  if (!buffer?.length) {
    const err = new Error('التسجيل الصوتي فارغ');
    err.status = 400;
    err.expose = true;
    throw err;
  }

  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }

  let base = requestBase;
  if (isLocalBase(base)) {
    const settings = await getAiSettings();
    const configured = settings.appPublicUrl?.trim().replace(/\/$/, '');
    if (!configured || isLocalBase(configured)) {
      const err = new Error(
        'لإرسال الصوت يجب أن يكون الخادم متاحاً على الإنترنت (واتساب يحمّل الملف من رابط عام). انشر على Vercel أو اضبط APP_PUBLIC_URL.'
      );
      err.status = 400;
      err.expose = true;
      throw err;
    }
    base = configured;
  }

  const id = await saveUploadedImage(buffer, mime === 'audio/mp3' ? 'audio/mpeg' : mime);
  const audioUrl = `${base}/api/uploads/images/${id}`;

  await sendWhatsAppAudioFile({
    organizationId,
    phone: lead.phone,
    audioUrl,
    fileName: `voice-${id.slice(0, 8)}.${ext}`,
    instance: (await sendKeyForLead(lead)) ?? instance,
  });

  const message = await prisma.message.create({
    data: {
      organizationId,
      leadId: lead.id,
      instanceId: lead.instanceId,
      sender: 'AGENT',
      content: `[VOICE: ${audioUrl}]`,
    },
  });

  broadcastMessageCreated(lead, message);

  return { lead, message };
}
