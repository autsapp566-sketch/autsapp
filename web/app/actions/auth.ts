'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { apiPost } from '@/lib/api';
import { safeCallbackUrl, validateEmail, validateNewPassword } from '@/lib/validation';

export type FormState = {
  error?: string;
  /** Machine-readable reason, lets the UI offer a contextual action (e.g. resend verification). */
  code?: string;
  fieldErrors?: Partial<Record<'organizationName' | 'email' | 'password' | 'confirmPassword' | 'terms', string>>;
  success?: boolean;
  message?: string;
  email?: string;
  organizationName?: string;
};

const text = (fd: FormData, key: string) => (typeof fd.get(key) === 'string' ? (fd.get(key) as string) : '');

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  EMAIL_NOT_VERIFIED: 'يرجى تأكيد بريدك الإلكتروني أولًا. تحقق من صندوق الوارد.',
  RATE_LIMITED: 'محاولات كثيرة. حاول مرة أخرى بعد قليل.',
  UNREACHABLE: 'تعذر الاتصال بالخادم. حاول مرة أخرى بعد قليل.',
};

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, 'email').trim().toLowerCase();
  const password = text(formData, 'password');
  const fieldErrors: FormState['fieldErrors'] = {};
  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;
  if (!password) fieldErrors.password = 'كلمة المرور مطلوبة';
  if (Object.keys(fieldErrors).length) return { fieldErrors, email };

  try {
    // On success signIn() throws a redirect, which must propagate (hence the rethrow below).
    await signIn('credentials', {
      email,
      password,
      redirectTo: safeCallbackUrl(text(formData, 'callbackUrl')),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code ?? 'INVALID_CREDENTIALS';
      return { error: MESSAGES[code] ?? 'تعذر تسجيل الدخول. حاول مرة أخرى.', code, email };
    }
    throw err;
  }
  return { email };
}

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const organizationName = text(formData, 'organizationName').trim();
  const email = text(formData, 'email').trim().toLowerCase();
  const password = text(formData, 'password');
  const confirmPassword = text(formData, 'confirmPassword');

  const fieldErrors: FormState['fieldErrors'] = {};
  if (organizationName.length < 2 || organizationName.length > 80) fieldErrors.organizationName = 'اسم المشروع يجب أن يكون بين 2 و80 حرفًا';
  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;
  const passwordError = validateNewPassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  else if (password !== confirmPassword) fieldErrors.confirmPassword = 'كلمتا المرور غير متطابقتين';
  if (formData.get('terms') !== 'on') fieldErrors.terms = 'يجب الموافقة على الشروط للمتابعة';
  if (Object.keys(fieldErrors).length) return { fieldErrors, email, organizationName };

  const res = await apiPost('/api/auth/register', { organizationName, email, password });
  if (!res.ok) return { error: MESSAGES[res.data.code ?? ''] ?? res.data.error ?? 'تعذر إنشاء الحساب', code: res.data.code, email, organizationName };
  return { success: true, email };
}

export async function resendVerificationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, 'email').trim().toLowerCase();
  if (validateEmail(email)) return { error: 'صيغة البريد الإلكتروني غير صحيحة', email };
  const res = await apiPost('/api/auth/resend-verification', { email });
  if (!res.ok) return { error: MESSAGES[res.data.code ?? ''] ?? res.data.error ?? 'تعذر إرسال الرسالة', email };
  return { success: true, message: 'أرسلنا رابط تأكيد جديدًا إن كان الحساب بحاجة لذلك.', email };
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, 'email').trim().toLowerCase();
  const emailError = validateEmail(email);
  if (emailError) return { fieldErrors: { email: emailError }, email };

  const res = await apiPost('/api/auth/forgot-password', { email });
  if (!res.ok) return { error: MESSAGES[res.data.code ?? ''] ?? res.data.error ?? 'تعذر إرسال الرسالة', email };
  // Same answer whether or not the account exists.
  return { success: true, email };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = text(formData, 'token');
  const password = text(formData, 'password');
  const confirmPassword = text(formData, 'confirmPassword');

  const fieldErrors: FormState['fieldErrors'] = {};
  const passwordError = validateNewPassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  else if (password !== confirmPassword) fieldErrors.confirmPassword = 'كلمتا المرور غير متطابقتين';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const res = await apiPost('/api/auth/reset-password', { token, password });
  if (!res.ok) {
    return {
      error: res.data.error ?? 'تعذر تغيير كلمة المرور',
      code: res.data.code,
    };
  }
  redirect('/login?reset=1');
}

export async function verifyEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const res = await apiPost('/api/auth/verify-email', { token: text(formData, 'token') });
  if (!res.ok) return { error: res.data.error ?? 'رابط التأكيد غير صالح', code: res.data.code };
  return { success: true };
}
