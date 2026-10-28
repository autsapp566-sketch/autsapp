'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { adminFetch } from '@/lib/adminApi';
import type { ActionResult } from '@/lib/adminTypes';
import { cookieIsSecure, impersonationCookieName } from '@/lib/session';

/**
 * Server actions are public POST endpoints, so none of them trusts the page that rendered the button:
 * each one calls the Express API with the caller's own token, and Express re-checks SUPER_ADMIN
 * against the database (non-admins get a 404 → surfaced as "not allowed").
 */

const DENIED = 'غير مصرّح لك بتنفيذ هذا الإجراء.';

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

function failure(status: number, error: string): ActionResult {
  return { ok: false, error: status === 404 && error === 'Not found' ? DENIED : error };
}

export async function banUserAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const userId = str(form.get('userId'));
  if (!userId) return { ok: false, error: 'مستخدم غير صالح.' };

  const res = await adminFetch(`/users/${encodeURIComponent(userId)}/ban`, {
    method: 'POST',
    body: {
      reason: str(form.get('reason')).slice(0, 300) || undefined,
      suspendOrganization: form.get('suspendOrganization') === 'on',
    },
  });
  if (!res.ok) return failure(res.status, res.error);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function unbanUserAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const userId = str(form.get('userId'));
  if (!userId) return { ok: false, error: 'مستخدم غير صالح.' };

  const res = await adminFetch(`/users/${encodeURIComponent(userId)}/unban`, {
    method: 'POST',
    body: { restoreOrganization: true },
  });
  if (!res.ok) return failure(res.status, res.error);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

const TIERS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
const STATUSES = ['ACTIVE', 'PAST_DUE', 'CANCELED'];

export async function changeSubscriptionAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const userId = str(form.get('userId'));
  const planTier = str(form.get('planTier'));
  const status = str(form.get('status'));
  const period = str(form.get('period')); // keep | days | unlimited
  const days = Number(str(form.get('periodDays')));

  if (!userId) return { ok: false, error: 'مستخدم غير صالح.' };
  if (planTier && !TIERS.includes(planTier)) return { ok: false, error: 'الباقة غير صالحة.' };
  if (status && !STATUSES.includes(status)) return { ok: false, error: 'حالة الاشتراك غير صالحة.' };

  let periodDays: number | null | undefined;
  if (period === 'unlimited') periodDays = null;
  else if (period === 'days') {
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return { ok: false, error: 'مدة الاشتراك يجب أن تكون بين 1 و 3650 يوماً.' };
    }
    periodDays = days;
  }

  const res = await adminFetch<{ warnings?: string[] }>(`/users/${encodeURIComponent(userId)}/subscription`, {
    method: 'POST',
    body: { planTier: planTier || undefined, status: status || undefined, periodDays },
  });
  if (!res.ok) return failure(res.status, res.error);
  revalidatePath('/admin', 'layout');
  return { ok: true, warnings: res.data.warnings ?? [] };
}

/**
 * Starts an impersonation: the API mints a 1-hour token for the target, stored in its own httpOnly
 * cookie. The admin's real session is untouched, so "exit" simply deletes that cookie.
 */
export async function impersonateUserAction(form: FormData): Promise<void> {
  const userId = str(form.get('userId'));
  if (!userId) redirect('/admin/users?error=invalid');

  const res = await adminFetch<{ token: string; expiresIn: number }>(
    `/users/${encodeURIComponent(userId)}/impersonate`,
    { method: 'POST', body: {} },
  );
  if (!res.ok) {
    // Only a short code travels in the URL (never free text), so a crafted link can't spoof messages.
    const code = res.status === 409 ? 'blocked' : res.status === 403 || res.status === 400 ? 'forbidden' : 'failed';
    redirect(`/admin/users?error=${code}`);
  }

  const h = await headers();
  (await cookies()).set(impersonationCookieName(h), res.data.token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: cookieIsSecure(h),
    path: '/',
    maxAge: res.data.expiresIn,
  });
  redirect('/dashboard');
}
