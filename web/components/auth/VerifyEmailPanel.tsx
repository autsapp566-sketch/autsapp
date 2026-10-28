'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { verifyEmailAction, type FormState } from '@/app/actions/auth';
import { Alert, SubmitButton } from './ui';

const initial: FormState = {};

/**
 * Verification is an explicit click (POST), not a side-effect of loading the page, so mail
 * scanners / link previewers that pre-fetch URLs cannot burn the single-use token.
 */
export function VerifyEmailPanel({ token }: { token: string }) {
  const [state, action] = useActionState(verifyEmailAction, initial);

  if (state.success) {
    return (
      <div className="space-y-5 text-center">
        <Alert tone="success">تم تأكيد بريدك الإلكتروني وتفعيل حسابك.</Alert>
        <Link href="/login?verified=1" className="block w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <Alert tone="error">
          {state.error}
          <Link href="/login" className="mt-2 block font-semibold underline underline-offset-4">
            سجّل الدخول لإعادة إرسال رابط جديد
          </Link>
        </Alert>
      ) : null}
      <SubmitButton pendingLabel="جارٍ التأكيد...">تأكيد بريدي الإلكتروني</SubmitButton>
    </form>
  );
}
