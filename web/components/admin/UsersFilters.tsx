import Link from 'next/link';

const STATUSES = [
  { value: '', label: 'كل الحالات' },
  { value: 'ACTIVE', label: 'اشتراك نشط' },
  { value: 'PAST_DUE', label: 'متأخر الدفع' },
  { value: 'CANCELED', label: 'ملغى' },
  { value: 'NONE', label: 'بدون اشتراك' },
  { value: 'BANNED', label: 'معطّل / معلّق' },
];

/** Plain GET form → the URL is the single source of truth (shareable, back-button friendly). */
export function UsersFilters({ search, status }: { search: string; status: string }) {
  const dirty = Boolean(search || status);
  return (
    <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
      <input
        type="search"
        name="search"
        defaultValue={search}
        placeholder="بحث بالبريد أو اسم المنظمة…"
        maxLength={100}
        aria-label="بحث"
        className="min-w-[14rem] flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/30"
      />
      <select
        name="status"
        defaultValue={status}
        aria-label="حالة الاشتراك"
        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/60"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500">
        تطبيق
      </button>
      {dirty ? (
        <Link href="/admin/users" className="text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline">
          مسح
        </Link>
      ) : null}
    </form>
  );
}
