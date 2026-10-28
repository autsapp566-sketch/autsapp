const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return 'البريد الإلكتروني مطلوب';
  if (email.length > 254 || !EMAIL_RE.test(email)) return 'صيغة البريد الإلكتروني غير صحيحة';
  return undefined;
}

/** Mirrors the API rules (src/routes/auth.js) so users get instant feedback; the API stays the authority. */
export function validateNewPassword(value: string): string | undefined {
  if (!value) return 'كلمة المرور مطلوبة';
  if (value.length < 8) return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
  if (new TextEncoder().encode(value).length > 72) return 'كلمة المرور طويلة جدًا';
  if (!/[A-Za-z\u0600-\u06FF]/.test(value) || !/\d/.test(value)) return 'كلمة المرور يجب أن تحتوي على حرف ورقم';
  return undefined;
}

/** Only same-site relative paths — prevents open redirects through ?callbackUrl=. */
export function safeCallbackUrl(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
