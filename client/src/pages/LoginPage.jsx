import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function validate(email, password) {
  const errors = {};
  const trimmed = email.trim();

  if (!trimmed) {
    errors.email = 'البريد الإلكتروني مطلوب';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    errors.email = 'صيغة البريد الإلكتروني غير صحيحة';
  }

  if (!password) {
    errors.password = 'كلمة المرور مطلوبة';
  } else if (password.length < 8) {
    errors.password = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
  }

  return errors;
}

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');

    const errors = validate(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setSubmitError(err.message ?? 'فشل تسجيل الدخول');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 px-4 py-12" dir="rtl">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold text-brand-600">WhatsApp AI Handoff</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-slate-500">للوكلاء ومديري النظام فقط</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {submitError ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {submitError}
            </div>
          ) : null}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={[
                'w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-brand-500/30',
                fieldErrors.email ? 'border-red-300 bg-red-50/50' : 'border-slate-200 bg-white',
              ].join(' ')}
              placeholder="agent@example.com"
            />
            {fieldErrors.email ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
              كلمة المرور
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={[
                'w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-brand-500/30',
                fieldErrors.password ? 'border-red-300 bg-red-50/50' : 'border-slate-200 bg-white',
              ].join(' ')}
              placeholder="••••••••"
            />
            {fieldErrors.password ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          تجريبي: admin@example.com / Admin123! · agent@example.com / Agent123!
        </p>
      </div>
    </div>
  );
}
