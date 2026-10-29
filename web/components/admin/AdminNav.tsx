'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'نظرة عامة', exact: true },
  { href: '/admin/users', label: 'المستخدمون', exact: false },
  { href: '/admin/system', label: 'صحة النظام', exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="أقسام لوحة المدير" className="flex gap-1 overflow-x-auto">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition',
              active ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white',
            ].join(' ')}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
