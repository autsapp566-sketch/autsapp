import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { serializeLead, serializeMessage } from '../lib/serializers.js';
import { prisma } from '../lib/prisma.js';
import { canSeeInstance, getUserAccess } from './agentAccess.js';
/** @type {import('socket.io').Server | null} */
let io = null;

/** Realtime room of an organization's agents. Rooms are per tenant: events never cross organizations. */
const agentsRoom = (organizationId) => `org:${organizationId}:agents`;

/**
 * Is this socket's user allowed to see this conversation? Same organization first (hard tenant wall),
 * then the agent's per-number allow-list (admin / unrestricted = every number of the organization).
 */
async function socketCanSee(socket, lead) {
  if (!lead?.organizationId || socket.data.organizationId !== lead.organizationId) return false;
  const access = await getUserAccess({ id: socket.data.userId, role: socket.data.userRole });
  return access.active && canSeeInstance(access.instanceIds, lead.instanceId);
}

/** Emit to a room, but only to sockets whose user may see that conversation (tenant + number). */
async function emitScoped(room, event, payload, lead) {
  if (!io) return;
  try {
    const sockets = await io.in(room).fetchSockets();
    await Promise.all(
      sockets.map(async (s) => {
        try {
          if (await socketCanSee(s, lead)) s.emit(event, payload);
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

  io.use(async (socket, next) => {
    let payload;
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      return next(new Error('Invalid token'));
    }
    try {
      // The organization is read from the DB (never trusted from the token): it decides which rooms
      // and which conversations this socket may ever receive.
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          organizationId: true,
          role: true,
          passwordChangedAt: true,
          bannedAt: true,
          organization: { select: { suspendedAt: true } },
        },
      });
      if (!user) return next(new Error('Invalid token'));
      if (user.bannedAt || user.organization?.suspendedAt) return next(new Error('Account suspended'));
      if (user.passwordChangedAt && Number(payload.iat) < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
        return next(new Error('Invalid token'));
      }
      socket.data.userId = payload.sub;
      socket.data.userRole = user.role;
      socket.data.organizationId = user.organizationId;
      return next();
    } catch (err) {
      console.error('[socket] auth lookup failed:', err.message);
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const role = socket.data.userRole;
    if (role === 'CONFIRMATION_AGENT' || role === 'ADMIN') {
      socket.join(agentsRoom(socket.data.organizationId));
    }
    socket.join(`user:${socket.data.userId}`);

    socket.on('lead:subscribe', async (leadId) => {
      if (typeof leadId !== 'string' || leadId.length === 0) return;
      try {
        // Same organization only, and agents limited to some WhatsApp numbers cannot follow another number's conversation.
        const lead = await prisma.lead.findFirst({
          where: { id: leadId, organizationId: socket.data.organizationId },
          select: { organizationId: true, instanceId: true },
        });
        if (lead && (await socketCanSee(socket, lead))) {
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

/** Drop live sockets after a ban / suspension (the handshake check only covers new connections). */
export async function disconnectSockets({ userId, organizationId }) {
  if (!io) return;
  const sockets = await io.fetchSockets();
  for (const socket of sockets) {
    if ((userId && socket.data.userId === userId) || (organizationId && socket.data.organizationId === organizationId)) {
      socket.disconnect(true);
    }
  }
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
    await emitScoped(`user:${lead.assignedToId}`, 'lead:qualified', payload, lead);
    return;
  }

  await emitScoped(agentsRoom(lead.organizationId), 'lead:qualified', payload, lead);
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
    emitScoped(agentsRoom(lead.organizationId), 'lead:updated', payload, lead),
    emitScoped(`lead:${lead.id}`, 'lead:updated', payload, lead),
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
    emitScoped(`lead:${lead.id}`, 'message:new', payload, lead),
    emitScoped(agentsRoom(lead.organizationId), 'message:new', payload, lead),
  ]);
}
