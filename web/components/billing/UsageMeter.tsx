import { formatNumber } from '@/lib/format';

/** "2 / 3" style meter. `limit === null` means unlimited (Enterprise). */
export function UsageMeter({
  label,
  used,
  limit,
  unit,
  footnote,
}: {
  label: string;
  used: number;
  limit: number | null;
  unit: string;
  footnote?: string;
}) {
  const unlimited = limit === null;
  const ratio = unlimited || limit === 0 ? 0 : Math.min(1, used / limit);
  const over = !unlimited && used >= limit;
  const tone = over ? 'bg-red-500' : ratio >= 0.8 ? 'bg-amber-400' : 'bg-cyan-500';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-slate-300">{label}</h3>
        <p className="text-sm text-slate-400">
          <span className="text-2xl font-bold text-white" dir="ltr">
            {formatNumber(used)}
          </span>
          <span dir="ltr">{unlimited ? ' / ∞' : ` / ${formatNumber(limit)}`}</span> {unit}
        </p>
      </div>
      <div
        className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={unlimited ? undefined : limit}
        aria-valuenow={used}
      >
        <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: unlimited ? '6%' : `${Math.max(ratio * 100, used > 0 ? 3 : 0)}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {over ? 'وصلت إلى الحد الأقصى — رقّ باقتك للمتابعة.' : unlimited ? 'غير محدود في باقتك.' : (footnote ?? '\u00A0')}
      </p>
    </div>
  );
}
