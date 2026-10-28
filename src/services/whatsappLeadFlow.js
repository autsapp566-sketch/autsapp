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
import { resolveInstance } from './whatsappInstanceStore.js';
import { BILLING_MESSAGES } from './billing/billingErrors.js';
import { consumeAiMessage, releaseAiMessage } from './billing/subscriptionService.js';
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
 * A conversation is unique per (WhatsApp number, customer phone): the same customer writing to two of
 * our numbers gets two independent conversations.
 * Always tenant-scoped: a customer phone is only ever matched inside its own organization.
 * @param {string} organizationId
 * @param {string} phone
 * @param {string | null | undefined} pushName
 * @param {string | null | undefined} instanceId database id of the WhatsApp number that received it
 */
export async function findOrCreateLead(organizationId, phone, pushName, instanceId = null) {
  let lead = await prisma.lead.findFirst({
    where: { organizationId, phone, instanceId: instanceId ?? null },
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
      organizationId,
      phone,
      name: pushName ?? null,
      status: 'NEW',
      instanceId: instanceId ?? null,
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
 *   imageContext?: string | null,
 *   organizationId?: string, instanceDbId?: string,
 * }} input `organizationId` / `instanceDbId` are resolved from `instance` when not provided
 */
export async function processIncomingWhatsAppMessage(input) {
  // Strict isolation: the conversation is bound to the number that received the message, and the
  // number decides the tenant. A message for a number nobody registered has no owner => dropped.
  const resolved =
    input.organizationId && input.instanceDbId
      ? { id: input.instanceDbId, organizationId: input.organizationId }
      : await resolveInstance(input.instance);
  if (!resolved) {
    console.warn(`[whatsapp] message for unregistered instance "${input.instance}" ignored (no tenant)`);
    return { leadId: null, skippedAi: true, reason: 'UNREGISTERED_INSTANCE' };
  }
  const { organizationId } = resolved;
  const lead = await findOrCreateLead(organizationId, input.phone, input.pushName, resolved.id);

  // Customer came from an ad / sent a product link: work out which product it is.
  const adContext = input.ad ? await resolveAdContext(input.ad, organizationId) : null;

  const baseContent = input.isVoiceNote
    ? `[رسالة صوتية] ${input.text}`
    : input.isEdited
      ? `✏️ (رسالة معدّلة) ${input.text}`
      : input.text;
  // The note stays in the history so follow-up messages still know which product the ad was about.
  const userContent = [baseContent, adContext?.note, input.imageContext ? '📷 صورة منتج' : null]
    .filter(Boolean)
    .join('\n');

  const userMessage = await prisma.message.create({
    data: {
      organizationId,
      leadId: lead.id,
      instanceId: lead.instanceId,
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

  // ── Tier enforcement ────────────────────────────────────────────────────────────────────────
  // Reserve ONE AI message of the organization's plan before the paid OpenAI call. One atomic SQL
  // statement, so parallel webhooks cannot exceed the quota. Blocked tenants keep receiving (and
  // storing) customer messages, but the bot stays silent until they renew / upgrade.
  const usage = await consumeAiMessage(organizationId);
  if (!usage.allowed) {
    await createAdminAlert({
      organizationId,
      kind: usage.reason === 'PLAN_LIMIT_AI_MESSAGES' ? 'AI_QUOTA_EXCEEDED' : 'SUBSCRIPTION_INACTIVE',
      message: `⛔ ${BILLING_MESSAGES[usage.reason] ?? 'تم إيقاف الردود الآلية.'} (رسائل الزبائن تُحفظ لكن البوت متوقف)`,
    });
    return { leadId: lead.id, skippedAi: true, reason: usage.reason };
  }

  let qualification;
  try {
    qualification = await qualifyLead(conversationHistory, {
      organizationId,
      leadName: lead.name,
      leadPhone: lead.phone,
      adContext: [adContext?.prompt, input.imageContext].filter(Boolean).join('\n\n') || null,
    });
  } catch (err) {
    // Nothing was answered: do not charge the customer's quota for a failed AI call.
    await releaseAiMessage(organizationId, usage.periodStart);
    throw err;
  }

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
      organizationId,
      leadId: lead.id,
      instanceId: lead.instanceId,
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
      organizationId,
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
      organizationId,
      kind: err.quota ? 'GREEN_QUOTA' : 'SEND_FAILED',
      leadId: lead.id,
      message: `⚠️ لم يصل رد البوت إلى ${updatedLead.name || updatedLead.phone} (+${updatedLead.phone}): ${err.message.slice(0, 300)}`,
    });
  }

  for (const imageUrl of delivered ? imageUrls : []) {
    try {
      await sendWhatsAppImage({
        organizationId,
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
          organizationId,
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
