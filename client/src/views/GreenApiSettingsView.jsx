import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSettings, saveSettings } from '../api/client.js';

export default function GreenApiSettingsView({ embedded = false }) {
  const [form, setForm] = useState({
    greenApiInstanceId: '',
    greenApiToken: '',
    greenApiUrl: '',
    appPublicUrl: '',
    greenApiConfigured: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSettings();
      const s = data.settings ?? data;
      setForm({
        greenApiInstanceId: s.greenApiInstanceId ?? '',
        greenApiToken: s.greenApiTokenMasked ?? '',
        greenApiUrl: s.greenApiUrl ?? '',
        appPublicUrl: s.appPublicUrl ?? '',
        greenApiConfigured: Boolean(s.greenApiConfigured),
      });
    } catch (err) {
      setError(err.message ?? 'تعذر تحميل إعدادات Green API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        greenApiInstanceId: form.greenApiInstanceId.trim(),
        greenApiUrl: form.greenApiUrl.trim(),
        appPublicUrl: form.appPublicUrl.trim(),
      };
      if (form.greenApiToken && !form.greenApiToken.includes('••••')) {
        payload.greenApiToken = form.greenApiToken.trim();
      }
      const data = await saveSettings(payload);
      const s = data.settings ?? {};
      setForm((prev) => ({
        ...prev,
        greenApiInstanceId: s.greenApiInstanceId ?? prev.greenApiInstanceId,
        greenApiUrl: s.greenApiUrl ?? prev.greenApiUrl,
        greenApiToken: s.greenApiTokenMasked ?? prev.greenApiToken,
        appPublicUrl: s.appPublicUrl ?? prev.appPublicUrl,
        greenApiConfigured: Boolean(s.greenApiConfigured),
      }));
      setToast(data.message ?? 'تم حفظ Green API');
    } catch (err) {
      setError(err.message ?? 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  }

  const webhookPath = '/api/webhook/green-api';
  const webhookPreview = form.appPublicUrl
    ? `${form.appPublicUrl.replace(/\/$/, '')}${webhookPath}`
    : `https://your-domain.com${webhookPath}`;

  if (loading) {
    return <p className="text-sm text-slate-500">جاري تحميل Green API…</p>;
  }

  return (
    <section className={embedded ? 'space-y-4' : 'mx-auto max-w-3xl space-y-4'}>
      {toast ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {toast}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</div>
      ) : null}

      <form
        onSubmit={handleSave}
        className="space-y-5 rounded-2xl border border-emerald-500/25 bg-slate-900/60 p-6"
      >
        <header className="text-right">
          <h3 className="text-lg font-bold text-white">Green API — إعدادات واتساب</h3>
          <p className="mt-1 text-xs text-slate-400">
            Instance ID و API Token من{' '}
            <a href="https://green-api.com" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
              green-api.com
            </a>{' '}
            (apiTokenInstance — ليس Admin token). تُخزَّن في قاعدة البيانات وتُستخدم لكل الرسائل.
          </p>
          {form.greenApiConfigured ? (
            <p className="mt-2 text-xs font-medium text-emerald-400">✓ Green API مضبوط من لوحة التحكم</p>
          ) : (
            <p className="mt-2 text-xs text-amber-400/90">أكمل الحقول أدناه لتفعيل واتساب</p>
          )}
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Instance ID (idInstance)</label>
            <input
              dir="ltr"
              value={form.greenApiInstanceId}
              onChange={(e) => setForm((p) => ({ ...p, greenApiInstanceId: e.target.value }))}
              placeholder="710722775456"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">API Token (apiTokenInstance)</label>
            <input
              type="password"
              dir="ltr"
              autoComplete="off"
              value={form.greenApiToken}
              onChange={(e) => setForm((p) => ({ ...p, greenApiToken: e.target.value }))}
              placeholder={form.greenApiConfigured ? '•••• محفوظ — اتركه أو الصق token جديد' : 'الصق Token هنا'}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Green API URL (اختياري)</label>
            <input
              dir="ltr"
              value={form.greenApiUrl}
              onChange={(e) => setForm((p) => ({ ...p, greenApiUrl: e.target.value }))}
              placeholder="https://7107.api.greenapi.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">رابط التطبيق العام (Webhook)</label>
            <input
              dir="ltr"
              value={form.appPublicUrl}
              onChange={(e) => setForm((p) => ({ ...p, appPublicUrl: e.target.value }))}
              placeholder="https://your-app.vercel.app أو http://localhost:3000"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
            />
          </div>
        </div>

        <p className="text-xs text-slate-500" dir="ltr">
          Webhook في Green API: <span className="text-slate-300">{webhookPreview}</span>
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/dashboard/whatsapp" className="text-sm text-emerald-400 hover:underline">
            → ربط QR / الحسابات
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ…' : 'حفظ Green API'}
          </button>
        </div>
      </form>
    </section>
  );
}
