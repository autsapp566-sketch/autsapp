import { prisma } from '../../lib/prisma.js';
import { periodGraceMs } from '../billing/subscriptionService.js';
import { getSystemHealth } from './systemHealth.js';

/** Providers whose subscriptions are real recurring revenue (MANUAL = trials / comped / invoiced). */
const PAYING_PROVIDERS = ['STRIPE', 'PADDLE'];

/** Prisma filter: subscription is ACTIVE and its period has not lapsed (same grace as enforcement). */
function liveSubscriptionWhere(now = new Date()) {
  return {
    status: 'ACTIVE',
    OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date(now.getTime() - periodGraceMs()) } }],
  };
}

/**
 * MRR = Σ monthly list price of every live, provider-billed subscription.
 * Annual billing is normalised to monthly by the plan's `priceMonthlyCents`, so it is already "per month".
 */
export async function computeMrr(now = new Date()) {
  const [groups, plans] = await Promise.all([
    prisma.subscription.groupBy({
      by: ['planId'],
      where: { ...liveSubscriptionWhere(now), provider: { in: PAYING_PROVIDERS } },
      _count: { _all: true },
    }),
    prisma.plan.findMany({ select: { id: true, tier: true, name: true, priceMonthlyCents: true, currency: true } }),
  ]);

  const byId = new Map(plans.map((p) => [p.id, p]));
  const byPlan = groups
    .map((g) => {
      const plan = byId.get(g.planId);
      const count = g._count._all;
      return plan
        ? { tier: plan.tier, name: plan.name, subscribers: count, mrrCents: plan.priceMonthlyCents * count }
        : null;
    })
    .filter(Boolean);

  return {
    cents: byPlan.reduce((sum, p) => sum + p.mrrCents, 0),
    currency: plans[0]?.currency ?? 'USD',
    payingOrganizations: byPlan.reduce((sum, p) => sum + p.subscribers, 0),
    byPlan,
  };
}

export async function getOverview() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const activeUserWhere = {
    emailVerifiedAt: { not: null },
    bannedAt: null,
    organization: { suspendedAt: null, subscription: { is: liveSubscriptionWhere(now) } },
  };

  const [totalUsers, activeUsers, bannedUsers, newUsers7d, suspendedOrgs, totalNumbers, mrr, health] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: activeUserWhere }),
      prisma.user.count({ where: { OR: [{ bannedAt: { not: null } }, { organization: { suspendedAt: { not: null } } }] } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.organization.count({ where: { suspendedAt: { not: null } } }),
      prisma.whatsAppInstance.count(),
      computeMrr(now),
      getSystemHealth(),
    ]);

  return {
    generatedAt: now.toISOString(),
    users: { total: totalUsers, active: activeUsers, banned: bannedUsers, newLast7Days: newUsers7d },
    organizations: { suspended: suspendedOrgs },
    mrr,
    whatsapp: {
      registered: totalNumbers,
      // `null` when Evolution cannot be queried: we never show a made-up "0 connected".
      connected: health.evolution.reachable && health.evolution.apiKeyOk ? health.summary.openTracked : null,
      connecting: health.summary.connecting,
    },
    system: { status: health.status },
  };
}
