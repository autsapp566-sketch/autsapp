import { prisma } from '../../lib/prisma.js';

/**
 * Single source of truth for the pricing tiers.
 * `null` limit = unlimited. Prices are placeholders (Enterprise = custom, billed manually).
 * `stripePriceId` / `paddlePriceId` are read from the environment so plans map to checkout prices.
 *
 * @type {Record<'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE', {
 *   id: string, name: string, priceMonthlyCents: number, currency: string,
 *   maxWhatsAppInstances: number | null, monthlyAiMessages: number | null, sortOrder: number,
 * }>}
 */
export const PLAN_DEFINITIONS = {
  STARTER: {
    id: 'plan_starter',
    name: 'Starter',
    priceMonthlyCents: 2900,
    currency: 'USD',
    maxWhatsAppInstances: 1,
    monthlyAiMessages: 1000,
    sortOrder: 1,
  },
  PROFESSIONAL: {
    id: 'plan_professional',
    name: 'Professional',
    priceMonthlyCents: 7900,
    currency: 'USD',
    maxWhatsAppInstances: 3,
    monthlyAiMessages: 5000,
    sortOrder: 2,
  },
  ENTERPRISE: {
    id: 'plan_enterprise',
    name: 'Enterprise',
    priceMonthlyCents: 0,
    currency: 'USD',
    maxWhatsAppInstances: null,
    monthlyAiMessages: null,
    sortOrder: 3,
  },
};

export const PLAN_TIERS = Object.keys(PLAN_DEFINITIONS);

function priceIdFromEnv(provider, tier) {
  const value = process.env[`${provider}_PRICE_${tier}`]?.trim();
  return value || null;
}

/**
 * Idempotently create/update the three plans (limits + names + optional checkout price ids).
 * Safe to run on every deploy / seed.
 * @param {import('@prisma/client').PrismaClient} [db] client to use (the seed script passes its own)
 */
export async function ensurePlans(db = prisma) {
  const plans = [];
  for (const [tier, def] of Object.entries(PLAN_DEFINITIONS)) {
    const stripePriceId = priceIdFromEnv('STRIPE', tier);
    const paddlePriceId = priceIdFromEnv('PADDLE', tier);
    const data = {
      name: def.name,
      priceMonthlyCents: def.priceMonthlyCents,
      currency: def.currency,
      maxWhatsAppInstances: def.maxWhatsAppInstances,
      monthlyAiMessages: def.monthlyAiMessages,
      sortOrder: def.sortOrder,
      isActive: true,
      // Only overwrite price ids when configured, so manual DB edits are not wiped.
      ...(stripePriceId ? { stripePriceId } : {}),
      ...(paddlePriceId ? { paddlePriceId } : {}),
    };
    plans.push(
      await db.plan.upsert({
        where: { tier },
        update: data,
        create: { id: def.id, tier, ...data },
      })
    );
  }
  return plans;
}
