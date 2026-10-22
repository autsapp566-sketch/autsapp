import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireAgent } from '../middleware/requireAgent.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { serializeLead, serializeMessage } from '../lib/serializers.js';
import { prisma } from '../lib/prisma.js';
import { sendAgentWhatsAppMessage, sendAgentWhatsAppVoice } from '../services/agentMessaging.js';
import { setLeadAiPaused } from '../services/leadTakeover.js';

const router = express.Router();

const LIST_STATUSES = new Set(['QUALIFIED', 'HANDED_OFF', 'QUALIFYING', 'NEW', 'REJECTED']);

router.use(authenticate, attachUser, requireAgent);

router.get('/', requirePermission('leads', 'chats'), async (req, res, next) => {
  try {
    const raw = typeof req.query.status === 'string' ? req.query.status : 'QUALIFIED,HANDED_OFF';
    const statuses = raw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => LIST_STATUSES.has(s));

    const where = statuses.length ? { status: { in: statuses } } : { status: { in: ['QUALIFIED', 'HANDED_OFF'] } };

    const leads = await prisma.lead.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { qualificationScore: 'desc' }],
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    res.json({
      leads: leads.map((lead) => {
        const last = lead.messages[0];
        return {
          ...serializeLead(lead),
          lastMessage: last
            ? {
                content: last.content,
                sender: last.sender,
                createdAt: last.createdAt,
              }
            : null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requirePermission('leads', 'chats'), async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        assignedTo: { select: { id: true, email: true, role: true } },
      },
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({
      lead: {
        ...serializeLead(lead),
        assignedTo: lead.assignedTo,
      },
      messages: lead.messages.map(serializeMessage),
    });
  } catch (err) {
    next(err);
  }
});

async function handleAgentSendMessage(req, res, next) {
  try {
    const content = req.body?.content ?? req.body?.text ?? req.body?.message;
    const instance = typeof req.body?.instance === 'string' ? req.body.instance : undefined;

    const { lead, message } = await sendAgentWhatsAppMessage(req.params.id, content, instance);

    res.status(201).json({
      message: serializeMessage(message),
      lead: serializeLead(lead),
    });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'Message content is required') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

router.post('/:id/toggle-ai', requirePermission('takeover'), async (req, res, next) => {
  try {
    const aiPaused = Boolean(req.body?.aiPaused);
    const updated = await setLeadAiPaused(req.params.id, aiPaused, req.user.id);
    res.json({ lead: serializeLead(updated) });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

router.patch('/:id/takeover', requirePermission('takeover'), async (req, res, next) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const updated = await setLeadAiPaused(req.params.id, enabled, req.user.id);
    res.json({ lead: serializeLead(updated) });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

/** Raw audio body (Content-Type: audio/mpeg) recorded in the dashboard. */
router.post(
  '/:id/send-voice',
  requirePermission('reply'),
  express.raw({ type: () => true, limit: '4mb' }),
  async (req, res, next) => {
    try {
      const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0].trim();
      const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '').split(',')[0].trim();
      const { lead, message } = await sendAgentWhatsAppVoice({
        leadId: req.params.id,
        buffer: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
        mimeType: req.headers['content-type'],
        requestBase: `${proto}://${host}`,
      });
      res.status(201).json({ message: serializeMessage(message), lead: serializeLead(lead) });
    } catch (err) {
      if (err.status === 404) {
        return res.status(404).json({ error: err.message });
      }
      next(err);
    }
  }
);

router.post('/:id/send-message', requirePermission('reply'), handleAgentSendMessage);

router.post('/:id/messages', requirePermission('reply'), handleAgentSendMessage);

export default router;
