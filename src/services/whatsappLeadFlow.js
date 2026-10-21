import { qualifyLead } from './aiQualifier.js';
import { isLeadAiPaused } from './leadTakeover.js';
import { sendWhatsAppAudio, sendWhatsAppText } from './whatsappMessaging.js';
import { getAiSettings } from './aiSettings.js';
import { synthesizeWhatsAppSpeech } from './voiceAi.js';
import { broadcastLeadUpdated, broadcastMessageCreated, notifyLeadQualified } from './notifications.js';
import { prisma } from '../lib/prisma.js';

/** @type {Record<string, import('@prisma/client').LeadStatus>} */
const AI_STATUS_TO_LEAD = {
  QUALIFIED: 'QUALIFIED',
  QUALIFYING: 'QUALIFYING',
  REJECTED: 'REJECTED',
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
 * }} input
 */
export async function processIncomingWhatsAppMessage(input) {
  const lead = await findOrCreateLead(input.phone, input.pushName);

  const userContent = input.isVoiceNote ? `[رسالة صوتية] ${input.text}` : input.text;

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
  });

  const nextStatus = resolveLeadStatus(qualification.status, lead.status, lead.aiPaused);
  const extractedName = qualification.extractedInfo?.name;

  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: nextStatus,
      qualificationScore: qualification.score,
      summary: qualification.summary,
      name: lead.name ?? extractedName ?? undefined,
    },
  });

  const botMessage = await prisma.message.create({
    data: {
      leadId: lead.id,
      sender: 'BOT',
      content: qualification.botResponse,
    },
  });
  broadcastMessageCreated(updatedLead, botMessage);
  broadcastLeadUpdated(updatedLead);

  const aiSettings = await getAiSettings();

  await sendWhatsAppText({
    remoteJid: input.remoteJid,
    phone: input.phone,
    text: qualification.botResponse,
    instance: input.instance,
  });

  if (aiSettings.ttsEnabled) {
    try {
      const audioBuffer = await synthesizeWhatsAppSpeech(qualification.botResponse);
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

  if (nextStatus === 'QUALIFIED') {
    await notifyLeadQualified(updatedLead);
  }

  return {
    leadId: lead.id,
    skippedAi: false,
    qualification,
    lead: updatedLead,
  };
}
