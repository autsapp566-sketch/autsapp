import 'server-only';
import { headers } from 'next/headers';
import { readApiSession } from './session';

const API_URL = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export type AdminResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; code?: string };

/**
 * Server-to-server call to the Express /api/admin routes using the CURRENT admin's own API token
 * (never an impersonation token). Express re-verifies the role from the database on every call,
 * so this helper adds no trust of its own.
 */
export async function adminFetch<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<AdminResult<T>> {
  const session = await readApiSession(await headers());
  if (!session) return { ok: false, status: 401, error: 'انتهت الجلسة. سجّل الدخول من جديد.' };

  try {
    const res = await fetch(`${API_URL}/api/admin${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${session.apiToken}`,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof data.error === 'string' ? data.error : `خطأ ${res.status}`,
        code: typeof data.code === 'string' ? data.code : undefined,
      };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch {
    return { ok: false, status: 0, error: 'تعذر الاتصال بخادم الـ API.' };
  }
}