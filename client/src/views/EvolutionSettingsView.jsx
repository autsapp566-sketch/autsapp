import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchSettings,
  fetchWhatsAppIntegration,
  saveSettings,
  syncEvolutionWebhooks,
} from '../api/client.js';

export default function EvolutionSettingsView({ embedded = false }) {
  const [integration, setIntegration] = useState(null);
  const [appPublicUrl, setAppPublicUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const loadIntegration = useCallback(async () => {
    setChecking(true);
    try {
      setIntegration(await fetchWhatsAppIntegration());
    } catch (err) {
      setIntegration({ error: err.message ?? 'تعذر الاتصال بخدمة Evolution' });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchSettings();
        const s = data.settings ?? data;
        setAppPublicUrl(s.appPublicUrl ?? '');
      } catch (err) {
        setError(err.message ?? 'تعذر تحميل الإعدادات');
      } finally {
        setLoading(false);
      }
      loadIntegration();
    })();
  }, [loadIntegration]);

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
      const data = await saveSettings({ appPublicUrl: appPublicUrl.trim() });
      setToast(data.message ?? 'تم الحفظ');
    } catch (err) {
      setError(err.message ?? 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError('');
    try {
      const data = await syncEvolutionWebhooks();
      setToast(data.message ?? 'تم ضبط Webhook');
    } catch (err) {
      setError(err.message ?? 'تعذر ضبط Webhook');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">جاري تحميل Evolution API…</p>;

  const ready = integration?.configured && integration?.reachable && integration?.keyValid;

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

      <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-emerald-500/25 bg-slate-900/60 p-6">
        <header className="text-right">
          <h3 className="text-lg font-bold text-white">Evolution API — إعدادات واتساب</h3>
          <p className="mt-1 text-xs text-slate-400">
            عنوان الخادم والمفتاح العام يُقرآن من متغيرات البيئة{' '}
            <span className="font-mono text-slate-300" dir="ltr">
              EVOLUTION_API_URL
            </span>{' '}
            و{' '}
            <span className="font-mono text-slate-300" dir="ltr">
              EVOLUTION_API_KEY
            </span>{' '}
            (لا يُخزَّنان في قاعدة البيانات ولا يظهران كاملين هنا).
          </p>
        </header>

        <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-right text-xs">
          <p className="font-semibold text-slate-200">حالة الاتصال</p>
          {integration?.error && !integration?.configured ? (
            <p className="text-red-300">{integration.error}</p>
          ) : integration ? (
            <>
              <p className={ready ? 'text-emerald-400' : 'text-amber-300'}>
                {ready ? '✓ Evolution API متصل والمفتاح صحيح' : '⚠ Evolution API غير جاهز'}
                {integration.version ? ` — v${integration.version}` : ''}
              </p>
              <p className="text-slate-400" dir="ltr">
                Server: <span className="text-slate-300">{integration.baseUrl || '(غير مضبوط)'}</span>
              </p>
              <p className="text-slate-400" dir="ltr">
                API key: <span className="text-slate-300">{integration.apiKeyMasked || '(غير مضبوط)'}</span>
              </p>
              {!ready && integration.error ? <p className="text-amber-200">{integration.error}</p> : null}
              {integration.webhookUrl ? (
                <p className="text-slate-400" dir="ltr">
                  Webhook: <span className="text-slate-300">{integration.webhookUrl}</span>
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-slate-500">جاري التحقق…</p>
          )}
          <button
            type="button"
            onClick={loadIntegration}
            disabled={checking}
            className="rounded-lg border border-slate-600 px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {checking ? 'جاري الفحص…' : 'اختبار الاتصال'}
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">رابط التطبيق العام (اختياري)</label>
          <input
            dir="ltr"
            value={appPublicUrl}
            onChange={(e) => setAppPublicUrl(e.target.value)}
            placeholder="https://your-app.vercel.app"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-right text-xs">
          <p className="font-semibold text-slate-200">استقبال الرسائل (Webhook)</p>
          <p className="text-slate-400">
            يُضبط تلقائياً عند ربط رقم جديد. اضغط الزر لإعادة ضبطه على كل أرقام Evolution (مثلاً بعد تغيير رابط الـ API). يجب أن تضغطه من
            الواجهة المنشورة وليس من localhost.
          </p>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || !ready}
            className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {syncing ? 'جاري الضبط…' : 'إعادة ضبط Webhook لكل الأرقام'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/dashboard/whatsapp" className="text-sm text-emerald-400 hover:underline">
            → ربط QR / الحسابات
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-ember-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-ember-400 disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ…' : 'حفظ'}
          </button>
        </div>
      </form>
    </section>
  );
}
