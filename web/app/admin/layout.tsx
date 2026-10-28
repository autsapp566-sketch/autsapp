import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { adminFetch } from '@/lib/adminApi';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'لوحة المدير', template: '%s | لوحة المدير' },
  robots: { index: false, follow: false },
};

/**
 * Authoritative guard for every /admin page. middleware.ts is only a fast pre-filter on the cookie;
 * here the role is verified by the API against the DATABASE on every request, so a demoted admin
 * (or a forged / stale cookie) loses access immediately.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const res = await adminFetch<{ user: { id: string; email: string } }>('/session');

  if (!res.ok) {
    if (res.status === 401) redirect('/login?callbackUrl=/admin');
    if (res.status === 403 || res.status === 404) notFound();
    throw new Error(res.error); // API unreachable → admin/error.tsx
  }

  return <AdminShell adminEmail={res.data.user.email}>{children}</AdminShell>;
}
