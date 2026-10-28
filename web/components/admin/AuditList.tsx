import type { AuditEntry } from '@/lib/adminTypes';
import { formatDateTime } from '@/lib/format';
import { Card, EmptyState, SectionTitle } from './ui';

const LABELS: Record<string, string> = {
  USER_BAN: 'تعطيل حساب',
  USER_UNBAN: 'رفع التعطيل',
  SUBSCRIPTION_CHANGE: 'تغيير اشتراك',
  IMPERSONATE_START: 'انتحال مستخدم',
};

function detail(entry: AuditEntry): string | null {
  const m = entry.metadata;
  if (!m) return null;
  if (entry.action === 'SUBSCRIPTION_CHANGE') {
    const from = m.from as { tier?: string } | null;
    const to = m.to as { tier?: string; status?: string } | undefined;
    return `${from?.tier ?? '—'} ← ${to?.tier ?? '—'} (${to?.status ?? ''})`;
  }
  if (entry.action === 'USER_BAN' && typeof m.reason === 'string') return m.reason;
  return null;
}

export function AuditList({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card>
      <SectionTitle title="آخر الإجراءات الإدارية" />
      {entries.length === 0 ? (
        <EmptyState>لا توجد إجراءات مسجّلة.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-800">
          {entries.map((e) => {
            const extra = detail(e);
            return (
              <li key={e.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-200">{LABELS[e.action] ?? e.action}</p>
                  <p className="truncate text-xs text-slate-500" dir="ltr" style={{ textAlign: 'right' }}>
                    {e.actorEmail}
                    {extra ? ` · ${extra}` : ''}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-slate-500" dateTime={e.createdAt}>
                  {formatDateTime(e.createdAt)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
