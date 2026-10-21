import { prisma } from '../lib/prisma.js';
import { broadcastLeadUpdated } from './notifications.js';
import { forwardHandoffToAgents } from './handoffForward.js';

/**
 * @param {{ aiPaused?: boolean, status?: string }} lead
 */
export function isLeadAiPaused(lead) {
  if (!lead) {
    return false;
  }
  if (lead.aiPaused === true) {
    return true;
  }
  return lead.status === 'HANDED_OFF';
}

/**
 * @param {import('@prisma/client').Lead} lead
 */
function resumeStatus(lead) {
  if (lead.qualificationScore != null && lead.qualificationScore >= 8) {
    return 'QUALIFIED';
  }
  if (lead.status === 'NEW' || lead.status === 'REJECTED') {
    return lead.status;
  }
  return 'QUALIFYING';
}

/**
 * @param {string} leadId
 * @param {boolean} aiPaused
 * @param {string} userId
 */
export async function setLeadAiPaused(leadId, aiPaused, userId) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: aiPaused
      ? {
          aiPaused: true,
          status: 'HANDED_OFF',
          assignedToId: userId,
        }
      : {
          aiPaused: false,
          status: resumeStatus(lead),
          assignedToId: userId,
        },
  });

  broadcastLeadUpdated(updated);

  if (aiPaused && !isLeadAiPaused(lead)) {
    await forwardHandoffToAgents(updated, { reason: 'استلام بشري (إيقاف البوت يدوياً)' });
  }
  return updated;
}
