import { env } from '../../config/env.js';
import { createHttpError } from '../../lib/httpErrors.js';
import { prisma } from '../../lib/prisma.js';
import { PLAN_TIERS } from './plans.js';
import { getStripe } from './stripeClient.js';
import {
  findOrganizationIdByCustomer,
  loadSubscription,
  upsertSubscription,
} from './subscriptionService.js';

/* ------------------------------------------------------------------ helpers */

/** Stripe expandable fields are either an id string or the expanded object. */
const idOf = (value) => (typeof value === 'string' ? value : (value?.id ?? null));

const toDate = (unixSeconds) =>
  typeof unixSeconds === 'number' && Number.isFinite(unixSeconds) ? new Date(unixSeconds * 1000) : undefined;

function stripeFailure(err, what) {
  console.error(`[stripe] ${what} failed:`, err?.type ?? '', err?.code ?? '', err?.message ?? err);
  return createHttpError('تعذّر الاتصال ببوابة الدفع. حاول مرة أخرى بعد قليل.', 502);
}

function returnUrl(query = '') {
  return `${env.webPublicUrl}/dashboard/billing${query}`;
}

/* ------------------------------------------------------------------ checkout */

/**
 * Find a purchasable plan by our plan id (`plan_professional`) — a tier name (`PROFESSIONAL`) is
 * accepted too. The price is NEVER taken from the client: it always comes from Plan.stripePriceId.
 */
async function findPurchasablePlan(planId) {
  const key = String(planId ?? '').trim();
  if (!key || key.length > 100) throw createHttpError('planId مطلوب', 400);

  const tier = key.toUpperCase();
  const plan = await prisma.plan.findFirst({
    where: { isActive: true, OR: [{ id: key }, ...(PLAN_TIERS.includes(tier) ? [{ tier }] : [])] },
  });
  if (!plan) throw createHttpError('الباقة غير موجودة', 404);
  if (!plan.stripePriceId) {
    throw Object.assign(createHttpError('هذه الباقة غير متاحة للشراء المباشر — تواصل مع فريق المبيعات.', 400), {
      code: 'PLAN_NOT_PURCHASABLE',
    });
  }
  return plan;
}

/** One Stripe customer per organization (idempotent, race-safe against double clicks). */
async function ensureStripeCustomer(stripe, { user, subscription }) {
  if (subscription?.stripeCustomerId) return subscription.stripeCustomerId;

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { id: true, name: true },
  });

  let customer;
  try {
    customer = await stripe.customers.create(
      {
        email: user.email,
        name: organization?.name,
        metadata: { organizationId: user.organizationId, userId: user.id },
      },
      // Same key => Stripe returns the same customer for concurrent / repeated requests.
      { idempotencyKey: `autsapp-customer-${user.organizationId}` }
    );
  } catch (err) {
    throw stripeFailure(err, 'customers.create');
  }

  await prisma.subscription.updateMany({
    where: { organizationId: user.organizationId, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

/**
 * @param {{ id: string, email: string, organizationId: string }} user  the authenticated tenant admin
 * @param {string} planId
 * @returns {Promise<{ id: string, url: string }>}
 */
export async function createCheckoutSession(user, planId) {
  const stripe = getStripe();
  const plan = await findPurchasablePlan(planId);
  const subscription = await loadSubscription(user.organizationId);

  // Plan changes of a live Stripe subscription go through the Billing Portal, never a second checkout
  // (that would bill the customer twice).
  if (
    subscription?.provider === 'STRIPE' &&
    subscription.stripeSubscriptionId &&
    subscription.status !== 'CANCELED'
  ) {
    throw Object.assign(createHttpError('لديك اشتراك فعّال بالفعل — غيّر الباقة من «إدارة الاشتراك».', 409), {
      code: 'ALREADY_SUBSCRIBED',
    });
  }

  const customer = await ensureStripeCustomer(stripe, { user, subscription });
  const metadata = { userId: user.id, organizationId: user.organizationId, planId: plan.id };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: user.id,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      allow_promotion_codes: true,
      // Both objects carry the ids: the session (checkout.session.completed) and the subscription
      // (customer.subscription.* events) — so every webhook can find the tenant without a lookup.
      metadata,
      subscription_data: { metadata },
      success_url: returnUrl('?checkout=success'),
      cancel_url: returnUrl('?checkout=canceled'),
    });
    if (!session.url) throw new Error('Stripe returned a session without a URL');
    return { id: session.id, url: session.url };
  } catch (err) {
    throw stripeFailure(err, 'checkout.sessions.create');
  }
}

/* ------------------------------------------------------------------ billing portal */

export async function createPortalSession(user) {
  const stripe = getStripe();
  const subscription = await loadSubscription(user.organizationId);

  if (!subscription?.stripeCustomerId) {
    throw Object.assign(createHttpError('لا يوجد حساب فوترة بعد — اشترك في إحدى الباقات أولاً.', 409), {
      code: 'NO_BILLING_ACCOUNT',
    });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl(),
      ...(env.stripePortalConfigurationId ? { configuration: env.stripePortalConfigurationId } : {}),
    });
    return { url: session.url };
  } catch (err) {
    throw stripeFailure(err, 'billingPortal.sessions.create');
  }
}

/* ------------------------------------------------------------------ webhook → database */

/**
 * Stripe → our SubscriptionStatus.
 * `past_due` / `unpaid` / `incomplete` / `paused` all block the tenant (same rule the enforcement
 * layer applies to PAST_DUE); only `active` and `trialing` grant access.
 */
export function mapStripeStatus(status) {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'ACTIVE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED';
    default:
      return 'PAST_DUE';
  }
}

async function resolveOrganizationId({ customerId, metadata, clientReferenceId }) {
  if (customerId) {
    const byCustomer = await findOrganizationIdByCustomer('STRIPE', customerId);
    if (byCustomer) return byCustomer;
  }
  const userId = metadata?.userId || clientReferenceId;
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: String(userId) }, select: { organizationId: true } });
    if (user) return user.organizationId;
  }
  if (metadata?.organizationId) {
    const org = await prisma.organization.findUnique({ where: { id: String(metadata.organizationId) }, select: { id: true } });
    if (org) return org.id;
  }
  return null;
}

/** Write a Stripe subscription object into our `Subscription` row. Idempotent. */
async function applyStripeSubscription(organizationId, stripeSub, { planIdHint } = {}) {
  const item = stripeSub.items?.data?.[0];
  const priceId = item?.price?.id ?? null;

  let plan = priceId ? await prisma.plan.findUnique({ where: { stripePriceId: priceId } }) : null;
  if (!plan && planIdHint) plan = await prisma.plan.findUnique({ where: { id: String(planIdHint) } });
  if (!plan) console.warn(`[stripe] subscription ${stripeSub.id}: price ${priceId} matches no plan; plan left unchanged`);

  const status = mapStripeStatus(stripeSub.status);
  // Newer API versions moved the period to the subscription item; older ones keep it on the object.
  const periodStart = toDate(stripeSub.current_period_start ?? item?.current_period_start);
  const periodEnd = toDate(stripeSub.current_period_end ?? item?.current_period_end);

  await upsertSubscription(organizationId, {
    ...(plan ? { planTier: plan.tier } : {}),
    status,
    provider: 'STRIPE',
    customerId: idOf(stripeSub.customer),
    providerSubscriptionId: stripeSub.id,
    ...(periodStart ? { currentPeriodStart: periodStart } : {}),
    ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
    cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end || stripeSub.cancel_at),
  });

  return { organizationId, status, plan: plan?.tier ?? null, subscriptionId: stripeSub.id };
}

async function onCheckoutCompleted(stripe, session) {
  if (session.mode !== 'subscription') return { ignored: 'not a subscription checkout' };

  const subscriptionId = idOf(session.subscription);
  if (!subscriptionId) return { ignored: 'no subscription on session' };

  const organizationId = await resolveOrganizationId({
    customerId: idOf(session.customer),
    metadata: session.metadata,
    clientReferenceId: session.client_reference_id,
  });
  if (!organizationId) {
    console.error(`[stripe] checkout ${session.id}: cannot map to an organization`);
    return { ignored: 'unmapped organization' };
  }

  // Always read the live subscription instead of trusting event ordering / payload age.
  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
  return applyStripeSubscription(organizationId, stripeSub, { planIdHint: session.metadata?.planId });
}

async function onSubscriptionChanged(stripe, eventSub, { deleted }) {
  const organizationId = await resolveOrganizationId({
    customerId: idOf(eventSub.customer),
    metadata: eventSub.metadata,
  });
  if (!organizationId) {
    console.error(`[stripe] subscription ${eventSub.id}: cannot map to an organization`);
    return { ignored: 'unmapped organization' };
  }

  // A late event about an OLD subscription must not overwrite a newer, live one.
  const current = await loadSubscription(organizationId);
  if (
    current?.stripeSubscriptionId &&
    current.stripeSubscriptionId !== eventSub.id &&
    current.provider === 'STRIPE' &&
    current.status !== 'CANCELED'
  ) {
    return { ignored: 'superseded subscription' };
  }

  let stripeSub = eventSub;
  if (!deleted) {
    try {
      stripeSub = await stripe.subscriptions.retrieve(eventSub.id);
    } catch (err) {
      if (err?.code !== 'resource_missing') throw err;
      stripeSub = { ...eventSub, status: 'canceled' }; // gone on Stripe's side
    }
  } else {
    stripeSub = { ...eventSub, status: 'canceled' };
  }

  // First payment still pending (e.g. 3-D Secure): don't knock a trial/manual tenant into PAST_DUE yet.
  if (stripeSub.status === 'incomplete' && current?.stripeSubscriptionId !== stripeSub.id) {
    return { ignored: 'awaiting first payment' };
  }

  return applyStripeSubscription(organizationId, stripeSub, { planIdHint: eventSub.metadata?.planId });
}

const HANDLED = new Set([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

/**
 * Apply one VERIFIED Stripe event. Safe to call repeatedly with the same event (Stripe retries):
 * every handler re-reads the live Stripe state and writes it idempotently, and an event ledger
 * short-circuits events that already completed.
 *
 * Throws on infrastructure failure so the HTTP layer answers 5xx and Stripe retries.
 *
 * @param {import('stripe').Stripe.Event} event
 * @returns {Promise<{ duplicate?: boolean, ignored?: string } & Record<string, unknown>>}
 */
export async function processStripeEvent(event, stripe = getStripe()) {
  if (!HANDLED.has(event.type)) return { ignored: `unhandled event type ${event.type}` };

  // Claim the event id. A unique violation means we've seen it before.
  try {
    await prisma.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
  } catch (err) {
    if (err?.code !== 'P2002') throw err;
    const seen = await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } });
    if (seen?.processedAt) return { duplicate: true };
    // Seen but never finished (earlier attempt crashed/failed): safe to run again, it's idempotent.
  }

  let result;
  switch (event.type) {
    case 'checkout.session.completed':
      result = await onCheckoutCompleted(stripe, event.data.object);
      break;
    case 'customer.subscription.updated':
      result = await onSubscriptionChanged(stripe, event.data.object, { deleted: false });
      break;
    case 'customer.subscription.deleted':
      result = await onSubscriptionChanged(stripe, event.data.object, { deleted: true });
      break;
  }

  await prisma.stripeWebhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
  return result ?? {};
}
