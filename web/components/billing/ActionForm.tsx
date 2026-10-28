'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * A plain `<form method="post">` to one of our /api/stripe/* endpoints (which answer with a 303 to
 * Stripe). The button locks on submit to stop double-clicks creating two sessions, and unlocks if the
 * user comes back with the browser's Back button (bfcache restores the page as it was).
 */
export function ActionForm({
  action,
  fields,
  label,
  busyLabel = 'جارٍ التحويل…',
  variant = 'primary',
  disabled = false,
  title,
}: {
  action: string;
  fields?: Record<string, string>;
  label: ReactNode;
  busyLabel?: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const reset = () => setBusy(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  const styles =
    variant === 'primary'
      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
      : 'border border-slate-600 text-slate-100 hover:border-slate-400';

  return (
    <form method="post" action={action} onSubmit={() => setBusy(true)}>
      {Object.entries(fields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        disabled={disabled || busy}
        title={title}
        className={`w-full rounded-xl px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
      >
        {busy ? busyLabel : label}
      </button>
    </form>
  );
}
