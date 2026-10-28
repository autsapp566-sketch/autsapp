import { env } from '../config/env.js';
import { getStripe } from '../services/billing/stripeClient.js';
import { processStripeEvent } from '../services/billing/stripeBilling.js';

/**
 * POST /api/stripe/webhook
 *
 * MUST be mounted with `express.raw({ type: 'application/json' })` BEFORE `express.json()`:
 * Stripe signs the exact bytes it sent, so a re-serialised body can never verify.
 *
 * Responses:
 *   400  missing/invalid signature (or body already parsed) — Stripe will NOT retry usefully
 *   2xx  verified and handled / intentionally ignored / duplicate
 *   5xx  verified but we failed to process (DB down, Stripe API error…) — Stripe retries with backoff
 */
export async function stripeWebhookHandler(req, res) {
  if (!env.stripeWebhookSecret) {
    console.error('[stripe] STRIPE_WEBHOOK_SECRET is not set; refusing webhook');
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string' || !signature) {
    return res.status(400).json({ error: 'Missing Stripe-Signature header' });
  }
  if (!Buffer.isBuffer(req.body)) {
    console.error('[stripe] webhook body was parsed before signature verification (middleware order)');
    return res.status(400).json({ error: 'Raw body required' });
  }

  let stripe;
  let event;
  try {
    stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);
  } catch (err) {
    if (err?.status === 503) return res.status(503).json({ error: 'Stripe not configured' });
    console.warn('[stripe] webhook signature verification failed:', err?.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    const result = await processStripeEvent(event, stripe);
    if (result.ignored) console.log(`[stripe] ${event.type} ${event.id}: ignored (${result.ignored})`);
    return res.json({ received: true, ...(result.duplicate ? { duplicate: true } : {}) });
  } catch (err) {
    console.error(`[stripe] failed to process ${event.type} ${event.id}:`, err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
