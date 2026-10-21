import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { serializeLead, serializeMessage } from '../lib/serializers.js';
/** @type {import('socket.io').Server | null} */
let io = null;

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

    socket.on('lead:subscribe', (leadId) => {
      if (typeof leadId === 'string' && leadId.length > 0) {
        socket.join(`lead:${leadId}`);
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

  if (lead.assignedToId) {
    io.to(`user:${lead.assignedToId}`).emit('lead:qualified', payload);
    return;
  }

  io.to('confirmation-agents').emit('lead:qualified', payload);
}

/**
 * @param {object} lead
 */
export function broadcastLeadUpdated(lead) {
  if (!io) {
    return;
  }
  const payload = { lead: serializeLead(lead) };
  io.to('confirmation-agents').emit('lead:updated', payload);
  io.to(`lead:${lead.id}`).emit('lead:updated', payload);
}

/**
 * @param {object} lead
 * @param {object} message
 */
export function broadcastMessageCreated(lead, message) {
  if (!io) {
    return;
  }
  const payload = {
    leadId: lead.id,
    message: serializeMessage(message),
  };
  io.to(`lead:${lead.id}`).emit('message:new', payload);
  io.to('confirmation-agents').emit('message:new', payload);
}
