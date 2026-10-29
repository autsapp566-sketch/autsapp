import Link from 'next/link';
import { AuditList } from '@/components/admin/AuditList';
import { MrrBreakdown } from '@/components/admin/MrrBreakdown';
import { OverviewCards } from '@/components/admin/OverviewCards';
import { Alert } from '@/components/auth/ui';
import { PageHeader } from '@/components/admin/ui';
import { adminFetch } from '@/lib/adminApi';
import type { AuditEntry, Overview } from '@/lib/adminTypes';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'نظرة عامة' };

export default async function AdminOverviewPage() {
  const [overview, audit] = await Promise.all([
    adminFetch<Overview>('/overview'),
    adminFetch<{ entries: AuditEntry[] }>('/audit?limit=8'),
  ]);

  if (!overview.ok) {
    return (
      <>
        <PageHeader title="نظرة عامة" />
        <Alert tone="error">{overview.error}</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="نظرة عامة"
        subtitle={`آخر تحديث: ${formatDateTime(overview.data.generatedAt)}`}
        aside={
          <Link
            href="/admin/users"
            className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            إدارة المستخدمين
          </Link>
        }
      />
      <OverviewCards overview={overview.data} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <MrrBreakdown mrr={overview.data.mrr} />
        <AuditList entries={audit.ok ? audit.data.entries : []} />
      </div>
    </>
  );
}
