import type { Overview } from '@/lib/adminTypes';
import { formatMoney, formatNumber } from '@/lib/format';
import { Card, EmptyState, SectionTitle } from './ui';

export function MrrBreakdown({ mrr }: { mrr: Overview['mrr'] }) {
  const max = Math.max(1, ...mrr.byPlan.map((p) => p.mrrCents));
  return (
    <Card>
      <SectionTitle title="توزيع الإيرادات حسب الباقة" />
      {mrr.byPlan.length === 0 ? (
        <EmptyState>لا توجد اشتراكات مدفوعة بعد.</EmptyState>
      ) : (
        <ul className="space-y-4 p-5">
          {mrr.byPlan.map((p) => (
            <li key={p.tier}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-200">
                  {p.name} <span className="text-xs text-slate-500">· {formatNumber(p.subscribers)} مشترك</span>
                </span>
                <span className="font-semibold text-white" dir="ltr">
                  {formatMoney(p.mrrCents, mrr.currency)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(4, (p.mrrCents / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
