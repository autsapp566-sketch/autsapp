import type { ReactNode } from 'react';

export type Tone = 'emerald' | 'amber' | 'red' | 'sky' | 'slate' | 'violet';

const BADGE: Record<Tone, string> = {
  emerald: 'bg-cyan-500/10 text-cyan-300 ring-cyan-500/30',
  amber: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  red: 'bg-red-500/10 text-red-300 ring-red-500/30',
  sky: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  violet: 'bg-violet-500/10 text-violet-300 ring-violet-500/30',
  slate: 'bg-slate-500/10 text-slate-300 ring-slate-500/30',
};

const DOT: Record<Tone, string> = {
  emerald: 'bg-cyan-400',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
  sky: 'bg-sky-400',
  violet: 'bg-violet-400',
  slate: 'bg-slate-400',
};

export function Badge({ tone = 'slate', dot = false, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[tone]}`}>
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-2xl border border-slate-800 bg-slate-900/70 ${className}`}>{children}</section>;
}

export function SectionTitle({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {aside}
    </div>
  );
}

export function PageHeader({ title, subtitle, aside }: { title: string; subtitle?: string; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {aside}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-slate-500">{children}</p>;
}
