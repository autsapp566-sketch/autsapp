'use client';

import { useState } from 'react';

export function AdminSignOut() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/session/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-60"
    >
      {busy ? '…' : 'تسجيل الخروج'}
    </button>
  );
}
