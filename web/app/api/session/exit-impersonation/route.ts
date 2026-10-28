import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/sameOrigin';
import { impersonationCookieName } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Ends an impersonation: drops the impersonation cookie; the admin's own session was never touched. */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  (await cookies()).delete(impersonationCookieName(await headers()));
  return NextResponse.json({ ok: true, redirect: '/admin/users' }, { headers: { 'Cache-Control': 'no-store' } });
}
