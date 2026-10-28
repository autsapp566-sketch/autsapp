import { NextResponse, type NextRequest } from 'next/server';
import { isSameOriginRequest } from '@/lib/sameOrigin';
import { resolveDashboardToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

/**
 * Bridge for the Vite dashboard (served on this origin under /dashboard): hands the SPA the API
 * bearer token that lives inside the encrypted session cookie. The SPA used to obtain the very same
 * token from /api/auth/login, so this does not widen what same-origin scripts can reach.
 *
 * While a super admin is impersonating a user, the (1h) impersonation token is returned instead.
 *
 * 200 → { gateway: true, token }   401 → { gateway: true }  (no / expired session)
 */
export async function GET(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ gateway: true, error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }

  const resolved = await resolveDashboardToken(req.headers);
  if (!resolved) {
    return NextResponse.json({ gateway: true }, { status: 401, headers: NO_STORE });
  }
  return NextResponse.json({ gateway: true, token: resolved.token }, { headers: NO_STORE });
}
