import { useState } from 'react';
import { clearToken } from '../../api/client.js';

/**
 * Shown while a platform super admin is looking at a customer's account. "Exit" asks the Next.js
 * gateway to drop the impersonation cookie (the admin's own session was never replaced) and returns
 * to the admin panel.
 */
export default function ImpersonationBanner({ email }) {
  const [busy, setBusy] = useState(false);

  async function exit() {
    setBusy(true);
    try {
      await fetch('/api/session/exit-impersonation', { method: 'POST', credentials: 'same-origin' });
    } finally {
      clearToken();
      window.location.assign('/admin/users');
    }
  }

  return (
    <div
      role="status"
      className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-red-500/40 bg-red-600/90 px-4 py-2 text-sm text-white sm:px-6"
    >
      <p>
        <span className="font-bold">وضع الانتحال:</span> أنت تتصفّح حساب{' '}
        <span dir="ltr" className="font-semibold">
          {email}
        </span>{' '}
        بصلاحيات مدير المنصة. كل ما تفعله يُنفَّذ على هذا الحساب وتنتهي الجلسة تلقائياً بعد ساعة.
      </p>
      <button
        type="button"
        onClick={exit}
        disabled={busy}
        className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
      >
        {busy ? '…' : 'إنهاء الانتحال'}
      </button>
    </div>
  );
}
