import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell, Alert } from '@/components/auth/ui';
import { VerifyEmailPanel } from '@/components/auth/VerifyEmailPanel';

export const metadata: Metadata = { title: 'تأكيد البريد الإلكتروني', robots: { index: false } };

type Search = Promise<{ token?: string }>;

export default async function VerifyEmailPage({ searchParams }: { searchParams: Search }) {
  const { token } = await searchParams;

  return (
    <AuthShell title="تأكيد بريدك الإلكتروني" subtitle="خطوة أخيرة لتفعيل حسابك.">
      {token ? (
        <VerifyEmailPanel token={token} />
      ) : (
        <div className="space-y-4">
          <Alert tone="error">رابط التأكيد غير مكتمل.</Alert>
          <Link href="/login" className="block text-center text-sm font-semibold text-emerald-400 hover:text-emerald-300">
            تسجيل الدخول
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
