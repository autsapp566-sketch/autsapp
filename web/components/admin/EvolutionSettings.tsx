'use client';

import { useState } from 'react';
import { Alert } from '@/components/auth/ui';
import {
  refreshEvolutionAction,
  saveEvolutionPublicUrlAction,
  syncEvolutionWebhooksAction,
} from '@/app/admin/evolution/actions';
import { Card } from './ui';

export type EvolutionAdminStatus = {
  configured: boolean;
  baseUrl: string | null;
  apiKeyMasked: string | null;
  reachable: boolean;
  version: string | null;
  keyValid: boolean;
  error: string | null;
  webhookUrl: string | null;
  appPublicUrl: string;
};

export function EvolutionSettings({ initial }: { initial: EvolutionAdminStatus }) {
  const [status, setStatus] = useState(initial);
  const [publicUrl, setPublicUrl] = useState(initial.appPublicUrl ?? '');
  const [pending, setPending] = useState<'save' | 'sync' | 'check' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const ready = status.configured && status.reachable && status.keyValid;

  async function refresh() {
    setPending('check');
    setError('');
    setMessage('');
    const res = await refreshEvolutionAction();
    if (!res.ok) setError(res.error);
    else {
      setStatus(res.data);
      setPublicUrl(res.data.appPublicUrl ?? '');
    }
    setPending(null);
  }

  async function saveUrl(e: React.FormEvent) {
    e.preventDefault();
    setPending('save');
    setError('');
    setMessage('');
    const res = await saveEvolutionPublicUrlAction(publicUrl);
    if (!res.ok) setError(res.error);
    else setMessage(res.data.message ?? 'تم الحفظ');
    setPending(null);
  }

  async function syncWebhooks() {
    setPending('sync');
    setError('');
    setMessage('');
    const res = await syncEvolutionWebhooksAction();
    if (!res.ok) setError(res.error);
    else setMessage(res.data.message ?? 'تم ضبط Webhook');
    setPending(null);
  }

  return (
    <div className="space-y-4">
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card className="space-y-3 p-5 text-sm">
        <p className="font-semibold text-white">حالة الاتصال</p>
        <p className={ready ? 'text-cyan-300' : 'text-amber-300'}>
          {ready ? 'Evolution API متصل والمفتاح صحيح' : 'Evolution API غير جاهز'}
          {status.version ? ` — v${status.version}` : ''}
        </p>
        <p className="text-slate-400" dir="ltr">
          Server: <span className="text-slate-200">{status.baseUrl || '(غير مضبوط)'}</span>
        </p>
        <p className="text-slate-400" dir="ltr">
          API key: <span className="text-slate-200">{status.apiKeyMasked || '(غير مضبوط)'}</span>
        </p>
        {!ready && status.error ? <p className="text-amber-200">{status.error}</p> : null}
        {status.webhookUrl ? (
          <p className="break-all text-slate-400" dir="ltr">
            Webhook: <span className="text-slate-200">{status.webhookUrl}</span>
          </p>
        ) : (
          <p className="text-slate-500">رابط الـ Webhook يُحسب من النسخة المنشورة، وليس من localhost.</p>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={pending !== null}
          className="rounded-lg border border-slate-600 px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          {pending === 'check' ? 'جاري الفحص…' : 'اختبار الاتصال'}
        </button>
      </Card>

      <form onSubmit={saveUrl} className="space-y-3">
        <label className="block text-xs text-slate-400" htmlFor="appPublicUrl">
          رابط التطبيق العام (اختياري)
        </label>
        <input
          id="appPublicUrl"
          dir="ltr"
          value={publicUrl}
          onChange={(e) => setPublicUrl(e.target.value)}
          placeholder="https://your-app.vercel.app"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
        />
        <button
          type="submit"
          disabled={pending !== null}
          className="rounded-xl bg-ember-500 px-4 py-2 text-sm font-semibold text-white hover:bg-ember-400 disabled:opacity-50"
        >
          {pending === 'save' ? 'جاري الحفظ…' : 'حفظ'}
        </button>
      </form>

      <Card className="space-y-3 p-5 text-sm">
        <p className="font-semibold text-white">استقبال الرسائل (Webhook)</p>
        <p className="text-slate-400">
          يُضبط تلقائياً عند ربط رقم جديد. الزر يعيد ضبطه على كل أرقام Evolution. نفّذه من الواجهة المنشورة وليس من localhost.
          العنوان والمفتاح يُقرآن من <span dir="ltr">EVOLUTION_API_URL</span> و <span dir="ltr">EVOLUTION_API_KEY</span>.
        </p>
        <button
          type="button"
          onClick={syncWebhooks}
          disabled={pending !== null || !ready}
          className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {pending === 'sync' ? 'جاري الضبط…' : 'إعادة ضبط Webhook لكل الأرقام'}
        </button>
      </Card>
    </div>
  );
}
