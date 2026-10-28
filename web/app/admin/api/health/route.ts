import { NextResponse } from 'next/server';
import { adminFetch } from '@/lib/adminApi';
import type { SystemHealth } from '@/lib/adminTypes';

export const dynamic = 'force-dynamic';

/**
 * Polling endpoint for the live health monitor. It is only a thin pass-through: the Express API
 * verifies SUPER_ADMIN from the database, and non-admins receive a 404 (also enforced by middleware).
 */
export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1';
  const res = await adminFetch<SystemHealth>(`/health${refresh ? '?refresh=1' : ''}`);
  const headers = { 'Cache-Control': 'private, no-store, max-age=0' };

  if (!res.ok) {
    const status = res.status === 403 ? 404 : res.status === 0 ? 502 : res.status;
    return NextResponse.json({ error: res.error }, { status, headers });
  }
  return NextResponse.json(res.data, { headers });
}
