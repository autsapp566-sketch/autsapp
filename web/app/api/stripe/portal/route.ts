import { redirectToStripe } from '@/lib/stripeRoutes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/stripe/portal — redirects the signed-in tenant admin to the Stripe Customer Portal. */
export async function POST(req: Request) {
  return redirectToStripe(req, '/api/billing/portal');
}
