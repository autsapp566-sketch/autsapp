import {
  assertActiveSubscription,
  billingErrorFromDenial,
  consumeAiMessage,
  releaseAiMessage,
} from '../services/billing/subscriptionService.js';

/**
 * Tier enforcement middleware. Mount AFTER `authenticate, attachUser` (they set `req.user.organizationId`).
 * Failures are `BillingError`s (HTTP 402 + machine-readable `code`) handled by the global error handler.
 */

function organizationIdOf(req) {
  const id = req.user?.organizationId;
  if (!id) {
    const err = new Error('Organization context missing');
    err.status = 403;
    err.expose = true;
    throw err;
  }
  return id;
}

/**
 * The organization must have a subscription in good standing (ACTIVE and not past its period end).
 * Use on every route that reconnects/operates a WhatsApp number or otherwise needs a paying tenant.
 * (The "one more number" limit is enforced atomically inside `createWhatsAppInstanceWithinQuota`.)
 */
export async function requireActiveSubscription(req, _res, next) {
  try {
    const { subscription, plan } = await assertActiveSubscription(organizationIdOf(req));
    req.subscription = subscription;
    req.plan = plan;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * For HTTP routes that produce an AI reply (e.g. the bot playground): reserves one AI message of the
 * plan's monthly quota before the handler runs, and gives it back if the request ends in an error.
 * (WhatsApp webhooks do the same inline in `processIncomingWhatsAppMessage`.)
 */
export async function meterAiMessage(req, res, next) {
  try {
    const organizationId = organizationIdOf(req);
    const result = await consumeAiMessage(organizationId);
    if (!result.allowed) {
      throw billingErrorFromDenial(result);
    }
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        void releaseAiMessage(organizationId, result.periodStart);
      }
    });
    next();
  } catch (err) {
    next(err);
  }
}
