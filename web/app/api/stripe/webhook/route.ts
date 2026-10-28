export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_URL = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/**
 * POST /api/stripe/webhook — the URL to register in the Stripe Dashboard.
 *
 * The database (and the Stripe SDK) live in the Express API, so this handler is a byte-exact relay:
 * Stripe signs the RAW request body, therefore it is forwarded as raw bytes together with the
 * `Stripe-Signature` header and is NEVER parsed or re-serialised here. Signature verification, event
 * de-duplication and the Subscription updates for
 *   checkout.session.completed · customer.subscription.updated · customer.subscription.deleted
 * all happen in `src/routes/stripeWebhook.js` + `src/services/billing/stripeBilling.js`.
 *
 * The API's status is passed through, so a processing failure (5xx) makes Stripe retry, and a bad
 * signature (400) is rejected. If the API is unreachable we answer 502 and Stripe retries as well.
 * (Equivalent alternative: register `<API_URL>/api/stripe/webhook` directly and skip this hop.)
 */
export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return Response.json({ error: 'Missing Stripe-Signature header' }, { status: 400 });
  }

  const raw = new Uint8Array(await req.arrayBuffer());

  try {
    const upstream = await fetch(`${API_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
      body: raw,
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[stripe webhook relay] API unreachable:', err instanceof Error ? err.message : err);
    return Response.json({ error: 'Upstream unavailable' }, { status: 502 });
  }
}
