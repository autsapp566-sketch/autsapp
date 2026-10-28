import { redirectToStripe } from '@/lib/stripeRoutes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/checkout   body: { planId }   (form-encoded or JSON)
 *
 * Authenticates the caller from the session cookie, asks the API to create a Stripe Checkout session
 * for that plan — with the caller's `userId` (and organization) in the session + subscription metadata —
 * and redirects the browser to Stripe. The price is resolved server-side from the plan; a client can
 * only choose WHICH of our plans, never an amount.
 *
 * Deliberately POST-only (no GET): creating a session is a state-changing action.
 */
export async function POST(req: Request) {
  let planId = '';
  try {
    if ((req.headers.get('content-type') ?? '').includes('application/json')) {
      const body = (await req.json()) as { planId?: unknown };
      planId = typeof body.planId === 'string' ? body.planId : '';
    } else {
      const form = await req.formData();
      const value = form.get('planId');
      planId = typeof value === 'string' ? value : '';
    }
  } catch {
    /* fall through: empty planId is rejected by the API */
  }

  return redirectToStripe(req, '/api/billing/checkout', { planId: planId.trim().slice(0, 100) });
}
