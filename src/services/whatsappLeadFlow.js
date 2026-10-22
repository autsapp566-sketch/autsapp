import { qualifyLead } from './aiQualifier.js';
import { isLeadAiPaused } from './leadTakeover.js';
import { sendWhatsAppAudio, sendWhatsAppImage, sendWhatsAppText } from './whatsappMessaging.js';
import { extractImagesFromBotText, fileNameForImageUrl } from '../lib/botImages.js';
import { getAiSettings } from './aiSettings.js';
import { synthesizeWhatsAppSpeech } from './voiceAi.js';
import { broadcastLeadUpdated, broadcastMessageCreated, notifyLeadQualified } from './notifications.js';
import { forwardHandoffToAgents } from './handoffForward.js';
import { createAdminAlert } from './adminAlerts.js';
import { resolveAdContext } from './adContext.js';
import { prisma } from '../lib/prisma.js';

/** @type {Record<string, import('@prisma/client').LeadStatus>} */
const AI_STATUS_TO_LEAD = {
  QUALIFIED: 'QUALIFIED',
  QUALIFYING: 'QUALIFYING',
  REJECTED: 'REJECTED',
};

const HANDOFF_LABELS = {
  READY_TO_BUY: 'جاهز للشراء — للتأكيد',
  WANTS_HUMAN: 'طلب التحدث مع موظفة',
  WANTS_VIDEO_CALL: 'طلب مكالمة فيديو',
};

/**
 * @param {string} phone
 * @param {string | null | undefined} pushName
 */
export async function findOrCreateLead(phone, pushName) {
  let lead = await prisma.lead.findFirst({
    where: { phone },
    orderBy: { createdAt: 'desc' },
  });

  if (lead) {
    if (!lead.name && pushName) {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { name: pushName },
      });
    }
    return lead;
  }

  return prisma.lead.create({
    data: {
      phone,
      name: pushName ?? null,
      status: 'NEW',
    },
  });
}

/**
 * @param {string} leadId
 */
export async function getRecentConversation(leadId, take = 10) {
  return prisma.message.findMany({
    where: { leadId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

/**
 * @param {import('@prisma/client').LeadStatus} aiStatus
 * @param {import('@prisma/client').LeadStatus} currentStatus
 */
function resolveLeadStatus(aiStatus, currentStatus, aiPaused) {
  if (aiPaused || currentStatus === 'HANDED_OFF') {
    return 'HANDED_OFF';
  }
  return AI_STATUS_TO_LEAD[aiStatus] ?? currentStatus;
}

/**
 * @param {{
 *   remoteJid: string,
 *   phone: string,
 *   text: string,
 *   pushName: string | null,
 *   instance: string,
 *   isVoiceNote?: boolean,
 *   isEdited?: boolean,
 *   ad?: object | null,
 * }} input
 */
export async function processIncomingWhatsAppMessage(input) {
  const lead = await findOrCreateLead(input.phone, input.pushName);

  // Customer came from an ad / sent a product link: work out which product it is.
  const adContext = input.ad ? await resolveAdContext(input.ad) : null;

  const baseContent = input.isVoiceNote
    ? `[رسالة صوتية] ${input.text}`
    : input.isEdited
      ? `✏️ (رسالة معدّلة) ${input.text}`
      : input.text;
  // The note stays in the history so follow-up messages still know which product the ad was about.
  const userContent = adContext ? `${baseContent}\n${adContext.note}` : baseContent;

  const userMessage = await prisma.message.create({
    data: {
      leadId: lead.id,
      sender: 'USER',
      content: userContent,
    },
  });
  broadcastMessageCreated(lead, userMessage);

  if (isLeadAiPaused(lead)) {
    return {
      leadId: lead.id,
      skippedAi: true,
      reason: lead.aiPaused ? 'AI_PAUSED' : 'HANDED_OFF',
    };
  }

  const recentDesc = await getRecentConversation(lead.id, 10);
  const conversationHistory = [...recentDesc].reverse().map((m) => ({
    sender: m.sender,
    content: m.content,
    createdAt: m.createdAt,
  }));

  const qualification = await qualifyLead(conversationHistory, {
    leadName: lead.name,
    leadPhone: lead.phone,
    adContext: adContext?.prompt ?? null,
  });

  // Serious buyers (score >= 8) and anyone asking for a human / video call go to the
  // confirmation agent: the bot stops and the conversation continues from the dashboard.
  const shouldHandOff = qualification.handoff || qualification.status === 'QUALIFIED';
  const nextStatus = shouldHandOff
    ? 'HANDED_OFF'
    : resolveLeadStatus(qualification.status, lead.status, lead.aiPaused);
  const extractedName = qualification.extractedInfo?.name;

  const handoffLabel = HANDOFF_LABELS[qualification.handoffReason ?? 'READY_TO_BUY'];
  const summary = shouldHandOff ? `[${handoffLabel}] ${qualification.summary}` : qualification.summary;

  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: nextStatus,
      qualificationScore: qualification.score,
      summary,
      name: lead.name ?? extractedName ?? undefined,
      ...(shouldHandOff ? { aiPaused: true } : {}),
    },
  });

  // Image links in the reply are sent as real WhatsApp images, never as raw URLs.
  const { text: replyText, imageUrls } = extractImagesFromBotText(qualification.botResponse);
  const outboundText = replyText || (imageUrls.length ? 'تفضل الصور 👇' : qualification.botResponse);

  const botMessage = await prisma.message.create({
    data: {
      leadId: lead.id,
      sender: 'BOT',
      content: imageUrls.length ? `${outboundText}\n📷 (${imageUrls.length} صور)` : outboundText,
    },
  });
  broadcastMessageCreated(updatedLead, botMessage);
  broadcastLeadUpdated(updatedLead);

  const aiSettings = await getAiSettings();

  // A failed send (e.g. Green API quota) must not make the webhook return 5xx: Green API
  // would retry every minute and the customer's message would be processed again and again.
  let delivered = true;
  try {
    await sendWhatsAppText({
      remoteJid: input.remoteJid,
      phone: input.phone,
      text: outboundText,
      instance: input.instance,
    });
  } catch (err) {
    delivered = false;
    console.error('[whatsapp] bot reply NOT delivered:', err.message);
    // Admin-only notification — never put system errors inside the customer conversation.
    await createAdminAlert({
      kind: err.quota ? 'GREEN_QUOTA' : 'SEND_FAILED',
      leadId: lead.id,
      message: `⚠️ لم يصل رد البوت إلى ${updatedLead.name || updatedLead.phone} (+${updatedLead.phone}): ${err.message.slice(0, 300)}`,
    });
  }

  for (const imageUrl of delivered ? imageUrls : []) {
    try {
      await sendWhatsAppImage({
        remoteJid: input.remoteJid,
        phone: input.phone,
        imageUrl,
        fileName: fileNameForImageUrl(imageUrl),
        instance: input.instance,
      });
    } catch (err) {
      console.error('[whatsapp] image send failed:', imageUrl, err.message);
    }
  }

  if (delivered && aiSettings.ttsEnabled) {
    try {
      const audioBuffer = await synthesizeWhatsAppSpeech(outboundText);
      if (audioBuffer) {
        await sendWhatsAppAudio({
          phone: input.phone,
          instance: input.instance,
          audioBase64: audioBuffer.toString('base64'),
        });
      }
    } catch (err) {
      console.error('TTS send failed:', err.message);
    }
  }

  if (shouldHandOff) {
    await notifyLeadQualified(updatedLead);
    await forwardHandoffToAgents(updatedLead, { reason: handoffLabel, instance: input.instance });
  }

  return {
    leadId: lead.id,
    skippedAi: false,
    qualification,
    lead: updatedLead,
  };
}
