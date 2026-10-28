import type { ReactNode } from 'react';
import type { Tone } from './ui';

const ACCENT: Record<Tone, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30',
  amber: 'bg-amber-500/10 text-amber-400 ring-amber-500/30',
  red: 'bg-red-500/10 text-red-400 ring-red-500/30',
  sky: 'bg-sky-500/10 text-sky-400 ring-sky-500/30',
  violet: 'bg-violet-500/10 text-violet-400 ring-violet-500/30',
  slate: 'bg-slate-500/10 text-slate-400 ring-slate-500/30',
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'emerald',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-400">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${ACCENT[tone]}`} aria-hidden>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-white" dir="ltr" style={{ textAlign: 'right' }}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}

const ICON = 'h-5 w-5';
const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const Icons = {
  users: (
    <svg {...svg} className={ICON}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  money: (
    <svg {...svg} className={ICON}>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  phone: (
    <svg {...svg} className={ICON}>
      <rect x="5" y="2" width="14" height="20" rx="3" />
      <path d="M12 18h.01" />
    </svg>
  ),
  pulse: (
    <svg {...svg} className={ICON}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
};
