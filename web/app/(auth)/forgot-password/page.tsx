import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/ui';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = { title: 'نسيت كلمة المرور', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="نسيت كلمة المرور؟"
      subtitle="أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيينها."
      footer={
        <Link href="/login" className="font-semibold text-cyan-400 hover:text-cyan-300">
          العودة إلى تسجيل الدخول
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
