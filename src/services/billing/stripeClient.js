import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { createHttpError } from '../../lib/httpErrors.js';

/** @type {import('stripe').Stripe | null} */
let client = null;
/** @type {any} */
let override = null;

/**
 * Development / CI only: STRIPE_API_BASE_URL=http://localhost:12111 points the SDK at a local
 * Stripe mock (e.g. `stripe-mock`) instead of api.stripe.com. Ignored in production.
 */
function mockServerConfig() {
  const raw = process.env.STRIPE_API_BASE_URL?.trim();
  if (!raw || env.nodeEnv === 'production') return {};
  try {
    const url = new URL(raw);
    return {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
    };
  } catch {
    return {};
  }
}

export function isStripeConfigured() {
  return Boolean(override || env.stripeSecretKey);
}

/**
 * Shared Stripe SDK instance. The API version is left to the SDK's pinned default; the webhook
 * code below tolerates both the legacy and the newer (`items`-level) subscription period fields.
 */
export function getStripe() {
  if (override) return override;
  if (!env.stripeSecretKey) {
    throw createHttpError('بوابة الدفع غير مفعّلة على هذا الخادم (STRIPE_SECRET_KEY).', 503);
  }
  client ??= new Stripe(env.stripeSecretKey, {
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: 'whatsapp-ai-agent' },
    ...mockServerConfig(),
  });
  return client;
}

/** Test hook: inject a fake Stripe client (pass null to restore the real one). */
export function setStripeClientForTests(fake) {
  override = fake;
}
