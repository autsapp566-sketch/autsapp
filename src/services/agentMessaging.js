import { prisma } from '../lib/prisma.js';
import { sendWhatsAppText } from './whatsappMessaging.js';
import { broadcastMessageCreated } from './notifications.js';

/**
 * @param {string} leadId
 * @param {string} content
 * @param {string} [instance]
 */
export async function sendAgentWhatsAppMessage(leadId, content, instance) {
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) {
    throw new Error('Message content is required');
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }

  const message = await prisma.message.create({
    data: {
      leadId: lead.id,
      sender: 'AGENT',
      content: text,
    },
  });

  await sendWhatsAppText({
    phone: lead.phone,
    text,
    instance,
  });

  broadcastMessageCreated(lead, message);

  return { lead, message };
}
