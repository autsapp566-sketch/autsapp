import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

export function LegalDocument({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link href="/" className="text-sm text-slate-400 transition hover:text-white">
            العودة للرئيسية
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-sm font-semibold text-cyan-400">قانوني</p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-slate-500">آخر تحديث: {updated}</p>
        <div className="mt-10 space-y-9">{children}</div>
      </main>

      <footer className="border-t border-slate-800">
        <nav className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-4 py-8 text-sm text-slate-500 sm:px-6" aria-label="صفحات قانونية">
          <Link href="/terms" className="hover:text-slate-300">شروط الاستخدام</Link>
          <Link href="/privacy" className="hover:text-slate-300">سياسة الخصوصية</Link>
          <Link href="/signup" className="hover:text-slate-300">إنشاء حساب</Link>
        </nav>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-8 text-slate-400">{children}</div>
    </section>
  );
}
