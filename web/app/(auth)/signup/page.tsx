import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/ui';
import { SignupForm } from '@/components/auth/SignupForm';
import { PLANS, TRIAL_DAYS } from '@/lib/plans';

export const metadata: Metadata = { title: 'إنشاء حساب', robots: { index: false } };

type Search = Promise<{ plan?: string }>;

export default async function SignupPage({ searchParams }: { searchParams: Search }) {
  const { plan } = await searchParams;
  const selected = PLANS.find((p) => p.id === plan);

  return (
    <AuthShell
      title="أنشئ حسابك"
      subtitle={`تجربة مجانية ${TRIAL_DAYS} يومًا، بدون بطاقة ائتمان.`}
      footer={
        <>
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="font-semibold text-cyan-400 hover:text-cyan-300">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <SignupForm planLabel={selected?.name} />
    </AuthShell>
  );
}
