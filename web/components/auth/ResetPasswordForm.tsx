'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { resetPasswordAction, type FormState } from '@/app/actions/auth';
import { Alert, Field, SubmitButton } from './ui';

const initial: FormState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initial);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <Alert tone="error">
          {state.error}
          {state.code === 'INVALID_TOKEN' ? (
            <Link href="/forgot-password" className="mt-2 block font-semibold underline underline-offset-4">
              اطلب رابطًا جديدًا
            </Link>
          ) : null}
        </Alert>
      ) : null}
      <Field label="كلمة المرور الجديدة" name="password" type="password" autoComplete="new-password" hint="8 أحرف على الأقل، وتحتوي على حرف ورقم." error={state.fieldErrors?.password} />
      <Field label="تأكيد كلمة المرور" name="confirmPassword" type="password" autoComplete="new-password" error={state.fieldErrors?.confirmPassword} />
      <SubmitButton pendingLabel="جارٍ الحفظ...">تغيير كلمة المرور</SubmitButton>
    </form>
  );
}
