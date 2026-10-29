import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/ui';
import { LoginForm } from '@/components/auth/LoginForm';
import { safeCallbackUrl } from '@/lib/validation';

export const metadata: Metadata = { title: 'تسجيل الدخول', robots: { index: false } };

type Search = Promise<{ callbackUrl?: string; reset?: string; verified?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const { callbackUrl, reset, verified } = await searchParams;

  return (
    <AuthShell
      title="تسجيل الدخول"
      subtitle="أهلًا بعودتك. أدخل بياناتك للوصول إلى لوحة التحكم."
      footer={
        <>
          ليس لديك حساب؟{' '}
          <Link href="/signup" className="font-semibold text-cyan-400 hover:text-cyan-300">
            أنشئ حسابًا مجانيًا
          </Link>
        </>
      }
    >
      <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} notice={reset ? 'reset' : verified ? 'verified' : undefined} />
    </AuthShell>
  );
}
