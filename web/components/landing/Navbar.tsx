'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Logo } from '@/components/Logo';

const links = [
  { href: '#features', label: 'المميزات' },
  { href: '#pricing', label: 'الأسعار' },
  { href: '#testimonials', label: 'آراء العملاء' },
  { href: '#faq', label: 'الأسئلة الشائعة' },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="التنقل الرئيسي">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800/70 hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white">
            تسجيل الدخول
          </Link>
          <Link href="/signup" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500">
            ابدأ مجانًا
          </Link>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-slate-300 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open ? (
        <div id="mobile-menu" className="border-t border-slate-800 bg-slate-950 px-4 pb-5 pt-3 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="قائمة الجوال">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm text-slate-300 hover:bg-slate-800/70">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/login" className="rounded-xl border border-slate-700 py-3 text-center text-sm font-medium text-slate-200">
              تسجيل الدخول
            </Link>
            <Link href="/signup" className="rounded-xl bg-emerald-600 py-3 text-center text-sm font-semibold text-white">
              ابدأ مجانًا
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
