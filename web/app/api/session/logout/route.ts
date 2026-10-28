import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { signOut } from '@/auth';
import { isSameOriginRequest } from '@/lib/sameOrigin';
import { impersonationCookieName } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Used by the dashboard's "تسجيل الخروج" button to end the web session (clears the cookie). */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  // Never leave an impersonation token behind after the admin signs out.
  (await cookies()).delete(impersonationCookieName(await headers()));
  await signOut({ redirect: false });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
