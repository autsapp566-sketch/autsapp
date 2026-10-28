'use client';

import { useActionState } from 'react';
import { forgotPasswordAction, type FormState } from '@/app/actions/auth';
import { Alert, Field, SubmitButton } from './ui';

const initial: FormState = {};

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initial);

  if (state.success) {
    return (
      <Alert tone="success">
        إن كان <span dir="ltr" className="font-semibold">{state.email}</span> مسجلًا لدينا فقد أرسلنا إليه رابط إعادة تعيين كلمة المرور (صالح لمدة ساعة). تحقق أيضًا من مجلد الرسائل غير المرغوبة.
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field label="البريد الإلكتروني" name="email" type="email" autoComplete="email" placeholder="name@company.com" defaultValue={state.email} error={state.fieldErrors?.email} />
      <SubmitButton pendingLabel="جارٍ الإرسال...">أرسل رابط إعادة التعيين</SubmitButton>
    </form>
  );
}
