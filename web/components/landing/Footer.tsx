import Link from 'next/link';
import { Logo } from '@/components/Logo';

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:px-6 md:flex-row">
        <Logo />
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500" aria-label="روابط التذييل">
          <a href="#features" className="hover:text-slate-300">المميزات</a>
          <a href="#pricing" className="hover:text-slate-300">الأسعار</a>
          <a href="#faq" className="hover:text-slate-300">الأسئلة الشائعة</a>
          <Link href="/login" className="hover:text-slate-300">تسجيل الدخول</Link>
        </nav>
        <p className="text-xs text-slate-600">© {new Date().getFullYear()} WhatsApp AI Agent. جميع الحقوق محفوظة.</p>
      </div>
    </footer>
  );
}
