'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction, resendVerificationAction, type FormState } from '@/app/actions/auth';
import { Alert, Field, SubmitButton } from './ui';

const initial: FormState = {};

function ResendVerification({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerificationAction, initial);
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="email" value={email} />
      {state.success ? (
        <p className="text-cyan-300">{state.message}</p>
      ) : (
        <>
          <button type="submit" className="font-semibold text-red-200 underline underline-offset-4 hover:text-white">
            إعادة إرسال رسالة التأكيد
          </button>
          {state.error ? <p className="mt-1 text-xs text-red-300">{state.error}</p> : null}
        </>
      )}
    </form>
  );
}

export function LoginForm({ callbackUrl, notice }: { callbackUrl: string; notice?: 'reset' | 'verified' }) {
  const [state, action] = useActionState(loginAction, initial);

  return (
    <div className="space-y-5">
      {notice === 'reset' ? <Alert tone="success">تم تغيير كلمة المرور بنجاح. سجّل الدخول بكلمتك الجديدة.</Alert> : null}
      {notice === 'verified' ? <Alert tone="success">تم تأكيد بريدك الإلكتروني. يمكنك تسجيل الدخول الآن.</Alert> : null}

      {state.error ? (
        <Alert tone="error">
          {state.error}
          {/* A separate <form>, so it must live outside the login form below (no nested forms). */}
          {state.code === 'EMAIL_NOT_VERIFIED' && state.email ? <ResendVerification email={state.email} /> : null}
        </Alert>
      ) : null}

      <form action={action} className="space-y-5" noValidate>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Field label="البريد الإلكتروني" name="email" type="email" autoComplete="email" placeholder="name@company.com" defaultValue={state.email} error={state.fieldErrors?.email} />
        <Field
          label="كلمة المرور"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={state.fieldErrors?.password}
          labelAside={
            <Link href="/forgot-password" className="text-xs font-medium text-cyan-400 hover:text-cyan-300">
              نسيت كلمة المرور؟
            </Link>
          }
        />
        <SubmitButton pendingLabel="جارٍ الدخول...">تسجيل الدخول</SubmitButton>
      </form>
    </div>
  );
}
