import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { serializeLead, serializeMessage } from '../lib/serializers.js';
import { prisma } from '../lib/prisma.js';
import { canSeeInstance, getUserAccess } from './agentAccess.js';
/** @type {import('socket.io').Server | null} */
let io = null;

/** Is this socket's user allowed to see conversations of `leadInstanceId`? (admin / unrestricted = yes) */
async function socketCanSee(socket, leadInstanceId) {
  const access = await getUserAccess({ id: socket.data.userId, role: socket.data.userRole });
  return access.active && canSeeInstance(access.instanceIds, leadInstanceId);
}

/** Emit to a room, but only to sockets whose user may see that WhatsApp number's conversations. */
async function emitScoped(room, event, payload, leadInstanceId) {
  if (!io) return;
  try {
    const sockets = await io.in(room).fetchSockets();
    await Promise.all(
      sockets.map(async (s) => {
        try {
          if (await socketCanSee(s, leadInstanceId)) s.emit(event, payload);
        } catch (err) {
          console.error('[socket] scoped emit failed:', err.message);
        }
      })
    );
  } catch (err) {
    console.error('[socket] scoped emit failed:', err.message);
  }
}

function parseCorsOrigins() {
  if (env.corsOrigin === '*') {
    return true;
  }
  return env.corsOrigin.split(',').map((o) => o.trim());
}

/**
 * @param {import('node:http').Server} httpServer
 */
export function initRealtimeNotifications(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: parseCorsOrigins(),
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const payload = jwt.verify(token, env.jwtSecret);
      socket.data.userId = payload.sub;
      socket.data.userRole = payload.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const role = socket.data.userRole;
    if (role === 'CONFIRMATION_AGENT' || role === 'ADMIN') {
      socket.join('confirmation-agents');
    }
    socket.join(`user:${socket.data.userId}`);

    socket.on('lead:subscribe', async (leadId) => {
      if (typeof leadId !== 'string' || leadId.length === 0) return;
      try {
        // Agents limited to some WhatsApp numbers cannot follow another number's conversation.
        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { instanceId: true } });
        if (lead && (await socketCanSee(socket, lead.instanceId))) {
          socket.join(`lead:${leadId}`);
        }
      } catch (err) {
        console.error('[socket] lead:subscribe failed:', err.message);
      }
    });

    socket.on('lead:unsubscribe', (leadId) => {
      if (typeof leadId === 'string' && leadId.length > 0) {
        socket.leave(`lead:${leadId}`);
      }
    });
  });

  return io;
}

export function getIo() {
  return io;
}

/**
 * @param {object} lead — Prisma lead record (serializable fields)
 */
export async function notifyLeadQualified(lead) {
  if (!io) {
    return;
  }

  const payload = {
    type: 'LEAD_QUALIFIED',
    lead: {
      id: lead.id,
      phone: lead.phone,
      name: lead.name,
      status: lead.status,
      qualificationScore: lead.qualificationScore,
      summary: lead.summary,
      assignedToId: lead.assignedToId,
      updatedAt: lead.updatedAt,
    },
    message: 'عميل مؤهل جديد — جاهز للتسليم',
    at: new Date().toISOString(),
  };

  payload.lead.instanceId = lead.instanceId ?? null;

  if (lead.assignedToId) {
    await emitScoped(`user:${lead.assignedToId}`, 'lead:qualified', payload, lead.instanceId);
    return;
  }

  await emitScoped('confirmation-agents', 'lead:qualified', payload, lead.instanceId);
}

/**
 * @param {object} lead
 */
export async function broadcastLeadUpdated(lead) {
  if (!io) {
    return;
  }
  const payload = { lead: serializeLead(lead) };
  await Promise.all([
    emitScoped('confirmation-agents', 'lead:updated', payload, lead.instanceId),
    emitScoped(`lead:${lead.id}`, 'lead:updated', payload, lead.instanceId),
  ]);
}

/**
 * @param {object} lead
 * @param {object} message
 */
export async function broadcastMessageCreated(lead, message) {
  if (!io) {
    return;
  }
  const payload = {
    leadId: lead.id,
    message: serializeMessage(message),
  };
  await Promise.all([
    emitScoped(`lead:${lead.id}`, 'message:new', payload, lead.instanceId),
    emitScoped('confirmation-agents', 'message:new', payload, lead.instanceId),
  ]);
}
