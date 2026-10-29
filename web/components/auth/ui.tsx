'use client';

import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Logo } from '@/components/Logo';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(47,224,222,0.16),transparent)]" />
      <Logo className="mb-8" />
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p> : null}
        </div>
        {children}
      </div>
      {footer ? <div className="mt-6 text-center text-sm text-slate-400">{footer}</div> : null}
    </div>
  );
}

export function Alert({ tone, children }: { tone: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-red-500/30 bg-red-500/10 text-red-300',
    success: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm leading-6 ${styles}`}>
      {children}
    </div>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
  dir?: 'ltr' | 'rtl';
  labelAside?: ReactNode;
};

export function Field({ label, name, type = 'text', autoComplete, placeholder, defaultValue, error, hint, dir, labelAside }: FieldProps) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={name} className="text-sm font-medium text-slate-300">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={isPassword && reveal ? 'text' : type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          defaultValue={defaultValue}
          dir={dir ?? (type === 'email' || isPassword ? 'ltr' : undefined)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={[
            'w-full rounded-xl border bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:ring-2 focus:ring-cyan-500/30',
            // Password inputs are forced LTR, so reserve room on the physical left where the toggle sits.
            isPassword ? 'pl-16' : '',
            error ? 'border-red-500/60' : 'border-slate-700 focus:border-cyan-500/60',
          ].join(' ')}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-pressed={reveal}
            className="absolute inset-y-0 left-0 px-4 text-xs font-medium text-slate-500 hover:text-slate-300"
          >
            {reveal ? 'إخفاء' : 'إظهار'}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-cyan-600 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
