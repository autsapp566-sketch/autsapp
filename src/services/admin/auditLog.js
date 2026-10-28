import { prisma } from '../../lib/prisma.js';

/**
 * Append a row to the admin audit trail. Awaited by callers on purpose: a privileged action
 * (ban, impersonation, plan change) that cannot be recorded should fail loudly.
 *
 * @param {{ id: string, email: string }} actor
 * @param {string} action e.g. USER_BAN, USER_UNBAN, SUBSCRIPTION_CHANGE, IMPERSONATE_START
 * @param {{ targetUserId?: string, targetOrgId?: string, metadata?: Record<string, unknown> }} [details]
 */
export function recordAudit(actor, action, details = {}) {
  return prisma.adminAuditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      targetUserId: details.targetUserId ?? null,
      targetOrgId: details.targetOrgId ?? null,
      metadata: details.metadata ?? undefined,
    },
  });
}

export function listAudit({ limit = 25, targetUserId } = {}) {
  return prisma.adminAuditLog.findMany({
    where: targetUserId ? { targetUserId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(Number(limit) || 25, 1), 100),
  });
}
