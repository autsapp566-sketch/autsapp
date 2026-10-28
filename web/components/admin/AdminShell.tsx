import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { AdminNav } from './AdminNav';
import { AdminSignOut } from './AdminSignOut';

export function AdminShell({ adminEmail, children }: { adminEmail: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-300 ring-1 ring-red-500/30">
              Super Admin
            </span>
          </div>
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
            <AdminNav />
          </div>
          <div className="mr-auto flex items-center gap-3 sm:mr-0">
            <span className="hidden max-w-[16rem] truncate text-xs text-slate-400 md:inline" dir="ltr">
              {adminEmail}
            </span>
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              لوحة التحكم
            </Link>
            <AdminSignOut />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
