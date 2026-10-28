import 'server-only';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isSameOriginRequest } from './sameOrigin';
import { cookieValue, impersonationCookieName, readApiSession } from './session';
import { billingFetch, type BillingResult } from './billingApi';

/** Short, fixed codes for `/dashboard/billing?error=…` (never free text from the API). */
const ERROR_BY_CODE: Record<string, string> = {
  ALREADY_SUBSCRIBED: 'already_subscribed',
  PLAN_NOT_PURCHASABLE: 'not_purchasable',
  NO_BILLING_ACCOUNT: 'no_account',
};

function errorCode(res: Extract<BillingResult<unknown>, { ok: false }>): string {
  if (res.code && ERROR_BY_CODE[res.code]) return ERROR_BY_CODE[res.code];
  if (res.status === 403) return 'forbidden';
  if (res.status === 400 || res.status === 404) return 'invalid';
  if (res.status === 503) return 'unavailable';
  return 'failed';
}

const wantsJson = (req: Request) =>
  (req.headers.get('accept') ?? '').includes('application/json') ||
  (req.headers.get('content-type') ?? '').includes('application/json');

/**
 * Shared engine of the checkout / portal endpoints: same-origin + session checks, then ask the Express
 * API (which owns Stripe + the database) for a Stripe-hosted URL and redirect the browser there.
 *
 * Forms get a 303 redirect (so the POST isn't replayed); `Accept: application/json` callers get `{ url }`.
 */
export async function redirectToStripe(
  req: Request,
  apiPath: '/api/billing/checkout' | '/api/billing/portal',
  body?: unknown,
): Promise<Response> {
  const json = wantsJson(req);
  const origin = new URL(req.url).origin;

  const fail = (status: number, code: string) =>
    json
      ? NextResponse.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } })
      : NextResponse.redirect(new URL(`/dashboard/billing?error=${code}`, origin), 303);

  if (!isSameOriginRequest(req)) return fail(403, 'forbidden');

  const h = await headers();
  const session = await readApiSession(h);
  if (!session) {
    return json
      ? NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
      : NextResponse.redirect(new URL('/login?callbackUrl=/dashboard/billing', origin), 303);
  }

  // A super admin viewing a tenant must not start payments on that tenant's behalf. We always act with
  // the caller's OWN session token, and refuse outright while an impersonation cookie is present.
  if (cookieValue(h, impersonationCookieName(h))) return fail(403, 'impersonating');

  const res = await billingFetch<{ url: string }>(apiPath, session.apiToken, { method: 'POST', body: body ?? {} });
  if (!res.ok) return fail(res.status === 0 ? 502 : res.status, errorCode(res));

  let target: URL;
  try {
    target = new URL(res.data.url);
    if (target.protocol !== 'https:' && target.protocol !== 'http:') throw new Error('bad protocol');
  } catch {
    return fail(502, 'failed');
  }

  return json
    ? NextResponse.json({ url: target.toString() }, { headers: { 'Cache-Control': 'no-store' } })
    : NextResponse.redirect(target, 303);
}
