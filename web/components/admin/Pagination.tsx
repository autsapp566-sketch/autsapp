import Link from 'next/link';
import { formatNumber } from '@/lib/format';

export function Pagination({
  page,
  pageSize,
  total,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const qs = new URLSearchParams({ ...params, page: String(p) });
    return `/admin/users?${qs.toString()}`;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = 'rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium';

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-5 py-3 text-xs text-slate-400">
      <span>
        {formatNumber(from)}–{formatNumber(to)} من {formatNumber(total)}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={`${btn} text-slate-300 hover:border-slate-500 hover:text-white`}>
            السابق
          </Link>
        ) : (
          <span className={`${btn} cursor-not-allowed text-slate-600`}>السابق</span>
        )}
        <span>
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={`${btn} text-slate-300 hover:border-slate-500 hover:text-white`}>
            التالي
          </Link>
        ) : (
          <span className={`${btn} cursor-not-allowed text-slate-600`}>التالي</span>
        )}
      </div>
    </div>
  );
}
