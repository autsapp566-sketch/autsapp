import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireAgent } from '../middleware/requireAgent.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { serializeLead, serializeMessage } from '../lib/serializers.js';
import { prisma } from '../lib/prisma.js';
import { sendAgentWhatsAppMessage, sendAgentWhatsAppVoice } from '../services/agentMessaging.js';
import { setLeadAiPaused } from '../services/leadTakeover.js';
import { canSeeInstance } from '../services/agentAccess.js';

const router = express.Router();

const LIST_STATUSES = new Set(['QUALIFIED', 'HANDED_OFF', 'QUALIFYING', 'NEW', 'REJECTED']);

router.use(authenticate, attachUser, requireAgent);

/**
 * Per-number isolation filter from `?instanceId=`:
 *  - missing/empty  -> no restriction (all numbers; used by cross-number alerts)
 *  - "unassigned"   -> legacy conversations that belong to no registered number
 *  - <id>           -> only that number's conversations
 */
function instanceWhere(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return {};
  if (value === 'unassigned') return { instanceId: null };
  return { instanceId: value };
}

/**
 * Combines the requested number filter with the agent's allowed numbers (set by the admin in
 * "الفريق والصلاحيات"). An agent restricted to some numbers can never read or act on another number's
 * conversations, whatever `?instanceId=` they send. `req.user.instanceIds === null` = unrestricted.
 */
function scopedInstanceWhere(req, raw) {
  const requested = instanceWhere(raw);
  const allowed = req.user.instanceIds;
  if (!Array.isArray(allowed)) return requested;
  if ('instanceId' in requested) {
    const id = requested.instanceId;
    return id && allowed.includes(id) ? { instanceId: id } : { instanceId: { in: [] } };
  }
  return { instanceId: { in: allowed } };
}

/** Per-conversation actions (read, take over, reply, voice): 404 when the number is not allowed for this agent. */
router.param('id', async (req, res, next, id) => {
  try {
    // Tenant isolation first: a conversation of another organization is always "not found".
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: req.user.organizationId },
      select: { instanceId: true },
    });
    const allowed = req.user?.instanceIds;
    if (!lead || (Array.isArray(allowed) && !canSeeInstance(allowed, lead.instanceId))) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

/** Numbers available in the live-chat selector, with conversation counts (cheap: no Evolution calls). */
router.get('/instances', requirePermission('leads', 'chats'), async (req, res, next) => {
  try {
    const allowed = req.user.instanceIds;
    const restricted = Array.isArray(allowed);
    const { organizationId } = req.user;
    const [rows, counts, unassigned] = await Promise.all([
      prisma.whatsAppInstance.findMany({
        where: { organizationId, ...(restricted ? { id: { in: allowed } } : {}) },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.lead.groupBy({
        by: ['instanceId'],
        _count: { _all: true },
        where: { organizationId, instanceId: { not: null } },
      }),
      restricted ? Promise.resolve(0) : prisma.lead.count({ where: { organizationId, instanceId: null } }),
    ]);
    const countById = new Map(counts.map((c) => [c.instanceId, c._count._all]));
    res.json({
      instances: rows.map((row) => ({
        id: row.id,
        instanceName: row.instanceName,
        label: row.label || row.instanceName,
        phone: row.phone,
        isDefault: row.isDefault,
        legacy: row.provider === 'green',
        leadCount: countById.get(row.id) ?? 0,
      })),
      unassignedCount: unassigned,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', requirePermission('leads', 'chats'), async (req, res, next) => {
  try {
    const raw = typeof req.query.status === 'string' ? req.query.status : 'QUALIFIED,HANDED_OFF';
    const statuses = raw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => LIST_STATUSES.has(s));

    const where = {
      organizationId: req.user.organizationId,
      ...(statuses.length ? { status: { in: statuses } } : { status: { in: ['QUALIFIED', 'HANDED_OFF'] } }),
      ...scopedInstanceWhere(req, req.query.instanceId),
    };

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
    // findFirst + instance filter: a conversation of another number is "not found" for this view.
    const lead = await prisma.lead.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
        ...scopedInstanceWhere(req, req.query.instanceId),
      },
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

    const { lead, message } = await sendAgentWhatsAppMessage(
      req.user.organizationId,
      req.params.id,
      content,
      instance
    );

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
    const updated = await setLeadAiPaused(req.user.organizationId, req.params.id, aiPaused, req.user.id);
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
    const updated = await setLeadAiPaused(req.user.organizationId, req.params.id, enabled, req.user.id);
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
        organizationId: req.user.organizationId,
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
