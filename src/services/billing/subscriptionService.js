import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { BillingError } from './billingErrors.js';
import { PLAN_DEFINITIONS } from './plans.js';

const AI_METRIC = 'AI_MESSAGES';
const HOUR_MS = 60 * 60 * 1000;

/**
 * How long after `currentPeriodEnd` an ACTIVE subscription keeps working while we wait for the
 * payment provider's renewal webhook (webhooks can be delayed/retried). Default 72h.
 */
export function periodGraceMs() {
  const hours = Number(process.env.BILLING_PERIOD_GRACE_HOURS ?? 72);
  return (Number.isFinite(hours) && hours >= 0 ? hours : 72) * HOUR_MS;
}

/* ------------------------------------------------------------------ pure rules */

/**
 * Is this subscription allowed to use the product right now? Pure function (unit-testable).
 *  - only status ACTIVE passes (PAST_DUE and CANCELED are blocked)
 *  - an ACTIVE subscription whose period ended more than the grace window ago is expired
 *    (`currentPeriodEnd = null` means "no expiry": manual / enterprise accounts)
 *
 * @param {{ status: string, currentPeriodEnd: Date | null } | null | undefined} subscription
 * @returns {{ active: boolean, reason: string | null }} reason = a BILLING_MESSAGES key when blocked
 */
export function evaluateSubscription(subscription, now = new Date(), graceMs = periodGraceMs()) {
  if (!subscription) return { active: false, reason: 'NO_SUBSCRIPTION' };
  // A super-admin suspension beats any plan/status: the bot stops and nothing can be connected.
  if (subscription.organization?.suspendedAt) return { active: false, reason: 'ACCOUNT_SUSPENDED' };
  if (subscription.status === 'CANCELED') return { active: false, reason: 'SUBSCRIPTION_CANCELED' };
  if (subscription.status === 'PAST_DUE') return { active: false, reason: 'SUBSCRIPTION_PAST_DUE' };
  if (subscription.status !== 'ACTIVE') return { active: false, reason: 'NO_SUBSCRIPTION' };
  const end = subscription.currentPeriodEnd;
  if (end && now.getTime() > new Date(end).getTime() + graceMs) {
    return { active: false, reason: 'SUBSCRIPTION_EXPIRED' };
  }
  return { active: true, reason: null };
}

/**
 * Billing window the usage counters belong to: the subscription's own period, or the UTC calendar
 * month when the subscription has no end date. The window start is the counter's identity, so it
 * must stay stable until the provider renews the subscription.
 */
export function usageWindow(subscription, now = new Date()) {
  if (subscription?.currentPeriodEnd) {
    return { start: new Date(subscription.currentPeriodStart), end: new Date(subscription.currentPeriodEnd) };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/* ------------------------------------------------------------------ loading */

/** Subscription + plan of an organization (null when it has none). */
export async function loadSubscription(organizationId) {
  if (!organizationId) return null;
  return prisma.subscription.findUnique({
    where: { organizationId },
    include: { plan: true, organization: { select: { suspendedAt: true } } },
  });
}

function limitsOf(plan) {
  return { maxWhatsAppInstances: plan.maxWhatsAppInstances, monthlyAiMessages: plan.monthlyAiMessages };
}

/**
 * Throws a BillingError unless the organization has a usable subscription.
 * @returns {Promise<{ subscription: object, plan: object }>}
 */
export async function assertActiveSubscription(organizationId) {
  const subscription = await loadSubscription(organizationId);
  const verdict = evaluateSubscription(subscription);
  if (!verdict.active) {
    throw new BillingError(verdict.reason, subscription ? { planTier: subscription.plan.tier } : {});
  }
  return { subscription, plan: subscription.plan };
}

/* ------------------------------------------------------------------ WhatsApp numbers */

/**
 * Atomically check the subscription + the plan's number limit and insert the WhatsApp number.
 * A per-organization advisory lock serialises concurrent "link a number" requests, so two parallel
 * requests can never both take the last free slot. The first number of an org becomes its default.
 *
 * @param {string} organizationId
 * @param {Omit<import('@prisma/client').Prisma.WhatsAppInstanceUncheckedCreateInput, 'organizationId' | 'isDefault'>} data
 */
export async function createWhatsAppInstanceWithinQuota(organizationId, data) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wa-instances:${organizationId}`}))`;

    const subscription = await tx.subscription.findUnique({
      where: { organizationId },
      include: { plan: true, organization: { select: { suspendedAt: true } } },
    });
    const verdict = evaluateSubscription(subscription);
    if (!verdict.active) {
      throw new BillingError(verdict.reason, subscription ? { planTier: subscription.plan.tier } : {});
    }

    const used = await tx.whatsAppInstance.count({ where: { organizationId } });
    const max = subscription.plan.maxWhatsAppInstances;
    if (max !== null && used >= max) {
      throw new BillingError('PLAN_LIMIT_WHATSAPP_INSTANCES', {
        planTier: subscription.plan.tier,
        used,
        limit: max,
      });
    }

    return tx.whatsAppInstance.create({
      data: { ...data, organizationId, isDefault: used === 0 },
    });
  });
}

/* ------------------------------------------------------------------ AI message metering */

/**
 * Read-only: may this organization still receive an AI reply? (No counter is touched.)
 * Used to skip expensive work (voice transcription, image analysis) for blocked tenants.
 * @returns {Promise<{ allowed: boolean, reason: string | null }>}
 */
export async function checkAiMessageAllowance(organizationId) {
  const subscription = await loadSubscription(organizationId);
  const verdict = evaluateSubscription(subscription);
  if (!verdict.active) return { allowed: false, reason: verdict.reason };

  const quota = subscription.plan.monthlyAiMessages;
  if (quota === null) return { allowed: true, reason: null };
  if (quota <= 0) return { allowed: false, reason: 'PLAN_LIMIT_AI_MESSAGES' };

  const { start } = usageWindow(subscription);
  const row = await prisma.usageLimit.findUnique({
    where: { organizationId_metric_periodStart: { organizationId, metric: AI_METRIC, periodStart: start } },
    select: { used: true },
  });
  return (row?.used ?? 0) < quota
    ? { allowed: true, reason: null }
    : { allowed: false, reason: 'PLAN_LIMIT_AI_MESSAGES' };
}

/**
 * Atomically reserve ONE AI message for the organization's current billing period.
 *
 * A single `INSERT ... ON CONFLICT DO UPDATE ... WHERE used < quota` statement both creates the
 * period counter lazily and increments it only while under quota, so concurrent webhooks can never
 * overshoot the limit (no read-modify-write race). The quota snapshot is refreshed from the plan on
 * every call, so upgrades/downgrades apply immediately.
 *
 * Call it right BEFORE the paid work (OpenAI) and `releaseAiMessage` if that work fails.
 *
 * @returns {Promise<
 *   | { allowed: true, used: number, quota: number | null, periodStart: Date }
 *   | { allowed: false, reason: string, used?: number, quota?: number | null }
 * >}
 */
export async function consumeAiMessage(organizationId) {
  const subscription = await loadSubscription(organizationId);
  const verdict = evaluateSubscription(subscription);
  if (!verdict.active) return { allowed: false, reason: verdict.reason };

  const quota = subscription.plan.monthlyAiMessages;
  if (quota !== null && quota <= 0) {
    return { allowed: false, reason: 'PLAN_LIMIT_AI_MESSAGES', used: 0, quota };
  }

  const { start, end } = usageWindow(subscription);
  const rows = await prisma.$queryRaw`
    INSERT INTO "UsageLimit" ("id", "organizationId", "metric", "periodStart", "periodEnd", "used", "quota", "updatedAt")
    VALUES (${randomUUID()}, ${organizationId}, ${AI_METRIC}::"UsageMetric", ${start}, ${end}, 1, ${quota}, CURRENT_TIMESTAMP)
    ON CONFLICT ("organizationId", "metric", "periodStart") DO UPDATE
      SET "used" = "UsageLimit"."used" + 1,
          "quota" = EXCLUDED."quota",
          "periodEnd" = EXCLUDED."periodEnd",
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE EXCLUDED."quota" IS NULL OR "UsageLimit"."used" < EXCLUDED."quota"
    RETURNING "used", "quota"
  `;

  if (!rows.length) {
    return { allowed: false, reason: 'PLAN_LIMIT_AI_MESSAGES', used: quota ?? undefined, quota };
  }
  return { allowed: true, used: Number(rows[0].used), quota, periodStart: start };
}

/** Give back a reserved AI message (the OpenAI call failed, nothing was delivered). Never throws. */
export async function releaseAiMessage(organizationId, periodStart) {
  if (!organizationId || !periodStart) return;
  try {
    await prisma.$executeRaw`
      UPDATE "UsageLimit"
      SET "used" = GREATEST("used" - 1, 0), "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${organizationId}
        AND "metric" = ${AI_METRIC}::"UsageMetric"
        AND "periodStart" = ${periodStart}
    `;
  } catch (err) {
    console.error('[billing] could not release AI message:', err.message);
  }
}

/** Convert a denied `consumeAiMessage`/`checkAiMessageAllowance` result into a throwable error. */
export function billingErrorFromDenial(denial, extra = {}) {
  return new BillingError(denial.reason, {
    ...(denial.quota !== undefined ? { limit: denial.quota } : {}),
    ...(denial.used !== undefined ? { used: denial.used } : {}),
    ...extra,
  });
}

/* ------------------------------------------------------------------ read model for the dashboard */

/**
 * Everything the billing page needs: plan, status, period, limits and current usage.
 */
export async function getSubscriptionSummary(organizationId) {
  const subscription = await loadSubscription(organizationId);
  const verdict = evaluateSubscription(subscription);

  if (!subscription) {
    return { active: false, reason: verdict.reason, subscription: null, plan: null, limits: null, usage: null };
  }

  const window = usageWindow(subscription);
  const [instanceCount, usageRow] = await Promise.all([
    prisma.whatsAppInstance.count({ where: { organizationId } }),
    prisma.usageLimit.findUnique({
      where: {
        organizationId_metric_periodStart: { organizationId, metric: AI_METRIC, periodStart: window.start },
      },
      select: { used: true },
    }),
  ]);

  const { plan } = subscription;
  return {
    active: verdict.active,
    reason: verdict.reason,
    subscription: {
      status: subscription.status,
      provider: subscription.provider,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canceledAt: subscription.canceledAt,
      /** A Stripe customer exists → the Billing Portal can be opened. */
      portalAvailable: Boolean(subscription.stripeCustomerId),
    },
    plan: {
      id: plan.id,
      tier: plan.tier,
      name: plan.name,
      priceMonthlyCents: plan.priceMonthlyCents,
      currency: plan.currency,
    },
    limits: limitsOf(plan),
    usage: {
      whatsappInstances: { used: instanceCount, limit: plan.maxWhatsAppInstances },
      aiMessages: {
        used: usageRow?.used ?? 0,
        limit: plan.monthlyAiMessages,
        periodStart: window.start,
        periodEnd: window.end,
      },
    },
  };
}

/** Public catalogue for a pricing page. */
export async function listPublicPlans() {
  const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  return plans.map((p) => ({
    id: p.id,
    tier: p.tier,
    /** Can be bought through Stripe Checkout (Enterprise / unconfigured plans: contact sales). */
    checkoutAvailable: Boolean(p.stripePriceId),
    name: p.name,
    priceMonthlyCents: p.priceMonthlyCents,
    currency: p.currency,
    maxWhatsAppInstances: p.maxWhatsAppInstances,
    monthlyAiMessages: p.monthlyAiMessages,
  }));
}

/* ------------------------------------------------------------------ provisioning & provider sync */

function slugify(input) {
  const base = String(input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'org';
}

/**
 * Create a tenant: organization + subscription (+ optional first admin user) in one transaction.
 * Used by the seed script and (later) by sign-up / the payment provider's checkout webhook.
 *
 * @param {{
 *   name: string, slug?: string, planTier?: keyof typeof PLAN_DEFINITIONS,
 *   status?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED', provider?: 'STRIPE' | 'PADDLE' | 'MANUAL',
 *   currentPeriodEnd?: Date | null,
 *   admin?: { email: string, passwordHash: string },
 * }} input
 */
export async function provisionOrganization(input) {
  const tier = input.planTier ?? 'STARTER';
  if (!PLAN_DEFINITIONS[tier]) throw new Error(`Unknown plan tier: ${tier}`);

  const plan = await prisma.plan.findUnique({ where: { tier } });
  if (!plan) throw new Error(`Plan ${tier} is not seeded — run \`npm run db:seed\``);

  const baseSlug = input.slug ? slugify(input.slug) : slugify(input.name);
  let slug = baseSlug;
  for (let i = 2; await prisma.organization.findUnique({ where: { slug }, select: { id: true } }); i += 1) {
    slug = `${baseSlug}-${i}`;
  }

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name: input.name.trim(), slug } });
    await tx.subscription.create({
      data: {
        organizationId: organization.id,
        planId: plan.id,
        status: input.status ?? 'ACTIVE',
        provider: input.provider ?? 'MANUAL',
        currentPeriodEnd: input.currentPeriodEnd ?? null,
      },
    });
    const admin = input.admin
      ? await tx.user.create({
          data: {
            organizationId: organization.id,
            email: input.admin.email.trim().toLowerCase(),
            password: input.admin.passwordHash,
            role: 'ADMIN',
            emailVerifiedAt: input.admin.emailVerifiedAt ?? null,
          },
          select: { id: true, email: true, role: true },
        })
      : null;
    return { organization, admin };
  });
}

/**
 * Provider-agnostic subscription sync: call it from the Stripe / Paddle webhook handlers.
 * Creates the subscription if the organization has none yet. Only provided fields are changed.
 *
 * @param {string} organizationId
 * @param {{
 *   planTier?: keyof typeof PLAN_DEFINITIONS,
 *   status?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED',
 *   provider?: 'STRIPE' | 'PADDLE' | 'MANUAL',
 *   customerId?: string, providerSubscriptionId?: string,
 *   currentPeriodStart?: Date, currentPeriodEnd?: Date | null,
 *   cancelAtPeriodEnd?: boolean,
 * }} update
 */
export async function upsertSubscription(organizationId, update) {
  const data = {};

  if (update.planTier) {
    const plan = await prisma.plan.findUnique({ where: { tier: update.planTier } });
    if (!plan) throw new Error(`Plan ${update.planTier} is not seeded`);
    data.planId = plan.id;
  }
  if (update.status) {
    data.status = update.status;
    data.canceledAt = update.status === 'CANCELED' ? new Date() : null;
  }
  if (update.provider) data.provider = update.provider;
  if (update.currentPeriodStart) data.currentPeriodStart = update.currentPeriodStart;
  if (update.currentPeriodEnd !== undefined) data.currentPeriodEnd = update.currentPeriodEnd;
  if (update.cancelAtPeriodEnd !== undefined) data.cancelAtPeriodEnd = update.cancelAtPeriodEnd;

  if (update.provider === 'STRIPE') {
    if (update.customerId) data.stripeCustomerId = update.customerId;
    if (update.providerSubscriptionId) data.stripeSubscriptionId = update.providerSubscriptionId;
  } else if (update.provider === 'PADDLE') {
    if (update.customerId) data.paddleCustomerId = update.customerId;
    if (update.providerSubscriptionId) data.paddleSubscriptionId = update.providerSubscriptionId;
  }

  const existing = await prisma.subscription.findUnique({ where: { organizationId }, select: { id: true } });
  if (existing) {
    return prisma.subscription.update({ where: { organizationId }, data, include: { plan: true } });
  }
  if (!data.planId) throw new Error('planTier is required to create a subscription');
  return prisma.subscription.create({ data: { organizationId, ...data }, include: { plan: true } });
}

/** Map a payment-provider customer id back to our organization (webhook entry point). */
export async function findOrganizationIdByCustomer(provider, customerId) {
  if (!customerId) return null;
  const where = provider === 'PADDLE' ? { paddleCustomerId: customerId } : { stripeCustomerId: customerId };
  const sub = await prisma.subscription.findUnique({ where, select: { organizationId: true } });
  return sub?.organizationId ?? null;
}