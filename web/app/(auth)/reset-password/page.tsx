import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell, Alert } from '@/components/auth/ui';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = { title: 'إعادة تعيين كلمة المرور', robots: { index: false } };

type Search = Promise<{ token?: string }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: Search }) {
  const { token } = await searchParams;

  return (
    <AuthShell title="كلمة مرور جديدة" subtitle="اختر كلمة مرور قوية لحسابك.">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-4">
          <Alert tone="error">رابط إعادة التعيين غير مكتمل.</Alert>
          <Link href="/forgot-password" className="block text-center text-sm font-semibold text-cyan-400 hover:text-cyan-300">
            اطلب رابطًا جديدًا
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
