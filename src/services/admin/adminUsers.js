import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { createHttpError } from '../../lib/httpErrors.js';
import { prisma } from '../../lib/prisma.js';
import { PLAN_TIERS } from '../billing/plans.js';
import { evaluateSubscription, upsertSubscription } from '../billing/subscriptionService.js';
import { disconnectSockets } from '../notifications.js';
import { recordAudit } from './auditLog.js';
import { getEvolutionSnapshot } from './systemHealth.js';

export const IMPERSONATION_TTL_SECONDS = 3600;
const SUBSCRIPTION_STATUSES = ['ACTIVE', 'PAST_DUE', 'CANCELED'];
const DAY_MS = 24 * 3600 * 1000;

/* ------------------------------------------------------------------ list */

/**
 * @param {{ search?: string, status?: string, page?: number, pageSize?: number }} query
 */
export async function listUsers(query = {}) {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(query.pageSize) || 25)));
  const search = String(query.search ?? '').trim().slice(0, 100);
  const status = String(query.status ?? '').toUpperCase();

  const and = [];
  if (search) {
    and.push({
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { organization: { name: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }
  if (status === 'BANNED') {
    and.push({ OR: [{ bannedAt: { not: null } }, { organization: { suspendedAt: { not: null } } }] });
  } else if (SUBSCRIPTION_STATUSES.includes(status)) {
    and.push({ organization: { subscription: { is: { status } } } });
  } else if (status === 'NONE') {
    and.push({ organization: { subscription: { is: null } } });
  }
  const where = and.length ? { AND: and } : {};

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        role: true,
        platformRole: true,
        createdAt: true,
        emailVerifiedAt: true,
        bannedAt: true,
        bannedReason: true,
        organization: {
          select: {
            id: true,
            name: true,
            suspendedAt: true,
            subscription: { include: { plan: true } },
          },
        },
      },
    }),
  ]);

  const orgIds = [...new Set(rows.map((r) => r.organization.id))];
  const [instances, evolution] = await Promise.all([
    orgIds.length
      ? prisma.whatsAppInstance.findMany({
          where: { organizationId: { in: orgIds } },
          select: { organizationId: true, instanceName: true, provider: true },
        })
      : [],
    getEvolutionSnapshot(),
  ]);

  const evolutionReady = evolution.reachable && evolution.apiKeyOk;
  const openNames = new Set(evolution.instances.filter((i) => i.state === 'open').map((i) => i.name));
  /** @type {Map<string, { total: number, connected: number | null }>} */
  const perOrg = new Map();
  for (const inst of instances) {
    const entry = perOrg.get(inst.organizationId) ?? { total: 0, connected: evolutionReady ? 0 : null };
    entry.total += 1;
    if (evolutionReady && inst.provider !== 'green' && openNames.has(inst.instanceName)) entry.connected += 1;
    perOrg.set(inst.organizationId, entry);
  }

  const users = rows.map((u) => {
    const sub = u.organization.subscription;
    const verdict = evaluateSubscription(sub ? { ...sub, organization: u.organization } : null);
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      platformRole: u.platformRole,
      createdAt: u.createdAt,
      emailVerified: Boolean(u.emailVerifiedAt),
      banned: u.bannedAt ? { at: u.bannedAt, reason: u.bannedReason } : null,
      organization: {
        id: u.organization.id,
        name: u.organization.name,
        suspended: Boolean(u.organization.suspendedAt),
      },
      subscription: sub
        ? {
            planTier: sub.plan.tier,
            planName: sub.plan.name,
            status: sub.status,
            provider: sub.provider,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            effective: verdict,
          }
        : null,
      instances: perOrg.get(u.organization.id) ?? { total: 0, connected: evolutionReady ? 0 : null },
    };
  });

  return { users, total, page, pageSize, evolutionAvailable: Boolean(evolutionReady) };
}

/* ------------------------------------------------------------------ helpers */

async function loadTarget(userId) {
  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: {
      id: true,
      email: true,
      role: true,
      platformRole: true,
      organizationId: true,
      bannedAt: true,
      organization: { select: { id: true, name: true, suspendedAt: true } },
    },
  });
  if (!user) throw createHttpError('المستخدم غير موجود', 404);
  return user;
}

function assertNotSelfOrAdmin(actor, target, verb) {
  if (target.id === actor.id) throw createHttpError(`لا يمكنك ${verb} حسابك الخاص`, 400);
  if (target.platformRole === 'SUPER_ADMIN') throw createHttpError(`لا يمكن ${verb} مدير منصة آخر`, 403);
}

/* ------------------------------------------------------------------ ban / unban */

/**
 * @param {{ id: string, email: string }} actor
 * @param {string} userId
 * @param {{ reason?: string, suspendOrganization?: boolean }} input
 */
export async function banUser(actor, userId, { reason, suspendOrganization = false } = {}) {
  const target = await loadTarget(userId);
  assertNotSelfOrAdmin(actor, target, 'تعطيل');

  const cleanReason = reason ? String(reason).trim().slice(0, 300) : null;
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { bannedAt: target.bannedAt ?? now, bannedReason: cleanReason } }),
    ...(suspendOrganization && !target.organization.suspendedAt
      ? [prisma.organization.update({ where: { id: target.organizationId }, data: { suspendedAt: now } })]
      : []),
  ]);

  await recordAudit(actor, 'USER_BAN', {
    targetUserId: target.id,
    targetOrgId: target.organizationId,
    metadata: { reason: cleanReason, suspendOrganization: Boolean(suspendOrganization) },
  });

  await disconnectSockets(suspendOrganization ? { organizationId: target.organizationId } : { userId: target.id });
  return { id: target.id, banned: true, organizationSuspended: suspendOrganization || Boolean(target.organization.suspendedAt) };
}

export async function unbanUser(actor, userId, { restoreOrganization = true } = {}) {
  const target = await loadTarget(userId);

  await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { bannedAt: null, bannedReason: null } }),
    ...(restoreOrganization && target.organization.suspendedAt
      ? [prisma.organization.update({ where: { id: target.organizationId }, data: { suspendedAt: null } })]
      : []),
  ]);

  await recordAudit(actor, 'USER_UNBAN', {
    targetUserId: target.id,
    targetOrgId: target.organizationId,
    metadata: { restoreOrganization: Boolean(restoreOrganization) },
  });
  return { id: target.id, banned: false };
}

/* ------------------------------------------------------------------ manual subscription */

/**
 * Manual upgrade / downgrade / status override for the user's organization.
 * @param {{ id: string, email: string }} actor
 * @param {string} userId
 * @param {{ planTier?: string, status?: string, periodDays?: number | null }} input
 *   `periodDays`: number = new period of N days from now, null = no expiry, undefined = unchanged.
 */
export async function changeSubscription(actor, userId, input = {}) {
  const target = await loadTarget(userId);
  const { planTier, status, periodDays } = input;

  if (planTier === undefined && status === undefined && periodDays === undefined) {
    throw createHttpError('لا توجد تغييرات لتطبيقها', 400);
  }
  if (planTier !== undefined && !PLAN_TIERS.includes(planTier)) throw createHttpError('الباقة غير صالحة', 400);
  if (status !== undefined && !SUBSCRIPTION_STATUSES.includes(status)) throw createHttpError('حالة الاشتراك غير صالحة', 400);
  if (periodDays !== undefined && periodDays !== null) {
    if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 3650) {
      throw createHttpError('مدة الاشتراك يجب أن تكون بين 1 و 3650 يوماً', 400);
    }
  }

  const before = await prisma.subscription.findUnique({
    where: { organizationId: target.organizationId },
    include: { plan: true },
  });
  if (!before && !planTier) throw createHttpError('لا يوجد اشتراك لهذا الحساب — اختر باقة لإنشائه', 400);

  const now = new Date();
  const update = { ...(planTier ? { planTier } : {}), ...(status ? { status } : {}) };

  if (periodDays === null) {
    update.currentPeriodEnd = null;
  } else if (periodDays !== undefined) {
    update.currentPeriodStart = now;
    update.currentPeriodEnd = new Date(now.getTime() + periodDays * DAY_MS);
  } else {
    // Re-activating (or creating) a subscription whose period already lapsed would be dead on arrival.
    const resultingStatus = status ?? before?.status ?? 'ACTIVE';
    const lapsed = !before || (before.currentPeriodEnd && before.currentPeriodEnd.getTime() <= now.getTime());
    if (resultingStatus === 'ACTIVE' && lapsed) {
      update.currentPeriodStart = now;
      update.currentPeriodEnd = new Date(now.getTime() + 30 * DAY_MS);
    }
  }
  if (!before) update.provider = 'MANUAL';

  const after = await upsertSubscription(target.organizationId, update);

  const instanceCount = await prisma.whatsAppInstance.count({ where: { organizationId: target.organizationId } });
  const maxInstances = after.plan.maxWhatsAppInstances;
  const overLimit = maxInstances !== null && instanceCount > maxInstances;

  await recordAudit(actor, 'SUBSCRIPTION_CHANGE', {
    targetUserId: target.id,
    targetOrgId: target.organizationId,
    metadata: {
      from: before ? { tier: before.plan.tier, status: before.status, periodEnd: before.currentPeriodEnd } : null,
      to: { tier: after.plan.tier, status: after.status, periodEnd: after.currentPeriodEnd },
    },
  });

  return {
    subscription: {
      planTier: after.plan.tier,
      planName: after.plan.name,
      status: after.status,
      provider: after.provider,
      currentPeriodEnd: after.currentPeriodEnd,
    },
    warnings: [
      ...(after.provider !== 'MANUAL'
        ? [`هذا الاشتراك مُدار عبر ${after.provider}؛ قد تُعيد بوابة الدفع الكتابة فوق التغيير اليدوي.`]
        : []),
      ...(overLimit
        ? [`الحساب لديه ${instanceCount} أرقام بينما تسمح الباقة الجديدة بـ ${maxInstances}. لن تُحذف الأرقام الحالية لكن لن يمكن إضافة المزيد.`]
        : []),
    ],
  };
}

/* ------------------------------------------------------------------ impersonation */

/**
 * Mint a short-lived session for the target user. The token carries `imp` = the super admin's id:
 * `requireSuperAdmin` refuses such tokens, so the impersonated session can never reach /admin.
 */
export async function startImpersonation(actor, userId) {
  const target = await loadTarget(userId);
  assertNotSelfOrAdmin(actor, target, 'انتحال');

  if (target.bannedAt || target.organization.suspendedAt) {
    throw createHttpError('لا يمكن انتحال حساب معطّل — ارفع التعطيل أولاً', 409);
  }

  const token = jwt.sign(
    { sub: target.id, org: target.organizationId, role: target.role, imp: actor.id },
    env.jwtSecret,
    { expiresIn: IMPERSONATION_TTL_SECONDS }
  );

  await recordAudit(actor, 'IMPERSONATE_START', {
    targetUserId: target.id,
    targetOrgId: target.organizationId,
    metadata: { ttlSeconds: IMPERSONATION_TTL_SECONDS },
  });

  return {
    token,
    expiresIn: IMPERSONATION_TTL_SECONDS,
    user: {
      id: target.id,
      email: target.email,
      role: target.role,
      platformRole: target.platformRole,
      organizationId: target.organizationId,
    },
  };
}
