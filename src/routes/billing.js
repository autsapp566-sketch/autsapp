import express from 'express';
import { createHttpError } from '../lib/httpErrors.js';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAgent } from '../middleware/requireAgent.js';
import { createCheckoutSession, createPortalSession } from '../services/billing/stripeBilling.js';
import { getSubscriptionSummary, listPublicPlans } from '../services/billing/subscriptionService.js';

const router = express.Router();

/** Public pricing catalogue (no auth: used by the marketing / pricing page). */
router.get('/plans', async (_req, res, next) => {
  try {
    res.json({ plans: await listPublicPlans() });
  } catch (err) {
    next(err);
  }
});

/**
 * Plan, subscription status, period end and live usage of the caller's organization.
 * Deliberately NOT behind `requireActiveSubscription`: a lapsed tenant must still see why it is blocked.
 */
router.get('/subscription', authenticate, attachUser, requireAgent, async (req, res, next) => {
  try {
    res.json(await getSubscriptionSummary(req.user.organizationId));
  } catch (err) {
    next(err);
  }
});

/**
 * Money-moving actions: tenant ADMIN only, and never from an impersonated session (a platform
 * operator looking at a customer's account must not be able to start purchases on their behalf).
 * Also deliberately NOT behind `requireActiveSubscription`: lapsed tenants must be able to pay.
 */
function billingActionGuard(req, _res, next) {
  if (req.impersonatorId) {
    return next(createHttpError('لا يمكن تنفيذ عمليات الدفع أثناء وضع الانتحال', 403));
  }
  return next();
}

/** Body: { planId } → { url } of a Stripe Checkout session. */
router.post('/checkout', authenticate, attachUser, requireAdmin, billingActionGuard, async (req, res, next) => {
  try {
    const { planId } = req.body ?? {};
    if (typeof planId !== 'string') throw createHttpError('planId مطلوب', 400);
    const session = await createCheckoutSession(req.user, planId);
    res.json({ url: session.url });
  } catch (err) {
    if (err.code && err.status) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    next(err);
  }
});

/** → { url } of a Stripe Billing Portal session for the caller's organization. */
router.post('/portal', authenticate, attachUser, requireAdmin, billingActionGuard, async (req, res, next) => {
  try {
    const session = await createPortalSession(req.user);
    res.json({ url: session.url });
  } catch (err) {
    if (err.code && err.status) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    next(err);
  }
});

export default router;
