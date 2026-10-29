'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { resendVerificationAction, signupAction, type FormState } from '@/app/actions/auth';
import { Alert, Field, SubmitButton } from './ui';

const initial: FormState = {};

function CheckInbox({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerificationAction, initial);
  return (
    <div className="space-y-5 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/15 text-2xl ring-1 ring-cyan-500/30" aria-hidden>
        ✉️
      </span>
      <div>
        <h2 className="text-lg font-bold text-white">تحقق من بريدك الإلكتروني</h2>
        <p className="mt-2 text-sm leading-7 text-slate-400">
          أرسلنا رابط التأكيد إلى <span dir="ltr" className="font-semibold text-slate-200">{email}</span>. اضغط عليه لتفعيل حسابك (صالح 24 ساعة).
        </p>
      </div>
      {state.success ? <Alert tone="success">{state.message}</Alert> : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <form action={action}>
        <input type="hidden" name="email" value={email} />
        <button type="submit" className="text-sm font-medium text-cyan-400 hover:text-cyan-300">
          لم تصلك الرسالة؟ أعد الإرسال
        </button>
      </form>
      <Link href="/login" className="block text-sm text-slate-500 hover:text-slate-300">
        العودة إلى تسجيل الدخول
      </Link>
    </div>
  );
}

export function SignupForm({ planLabel }: { planLabel?: string }) {
  const [state, action] = useActionState(signupAction, initial);

  if (state.success && state.email) return <CheckInbox email={state.email} />;

  return (
    <form action={action} className="space-y-5" noValidate>
      {planLabel ? (
        <Alert tone="info">
          اخترت باقة <strong>{planLabel}</strong>. تبدأ بتجربة مجانية بحدود باقة Starter، وتستطيع الترقية بعد تأكيد حسابك.
        </Alert>
      ) : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field label="اسم مشروعك أو شركتك" name="organizationName" autoComplete="organization" placeholder="متجر الأناقة" defaultValue={state.organizationName} error={state.fieldErrors?.organizationName} />
      <Field label="البريد الإلكتروني" name="email" type="email" autoComplete="email" placeholder="name@company.com" defaultValue={state.email} error={state.fieldErrors?.email} />
      <Field label="كلمة المرور" name="password" type="password" autoComplete="new-password" placeholder="8 أحرف على الأقل" hint="8 أحرف على الأقل، وتحتوي على حرف ورقم." error={state.fieldErrors?.password} />
      <Field label="تأكيد كلمة المرور" name="confirmPassword" type="password" autoComplete="new-password" placeholder="أعد كتابة كلمة المرور" error={state.fieldErrors?.confirmPassword} />

      <div>
        <label className="flex items-start gap-3 text-sm leading-6 text-slate-400">
          <input type="checkbox" name="terms" className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 accent-cyan-500" aria-invalid={Boolean(state.fieldErrors?.terms)} />
          <span>
            أوافق على{' '}
            <Link href="/terms" className="font-medium text-cyan-400 hover:text-cyan-300" target="_blank" rel="noreferrer">
              شروط الاستخدام
            </Link>{' '}
            و{' '}
            <Link href="/privacy" className="font-medium text-cyan-400 hover:text-cyan-300" target="_blank" rel="noreferrer">
              سياسة الخصوصية
            </Link>
            .
          </span>
        </label>
        {state.fieldErrors?.terms ? <p className="mt-1.5 text-xs text-red-400">{state.fieldErrors.terms}</p> : null}
      </div>

      <SubmitButton pendingLabel="جارٍ إنشاء الحساب...">إنشاء الحساب</SubmitButton>
    </form>
  );
}
