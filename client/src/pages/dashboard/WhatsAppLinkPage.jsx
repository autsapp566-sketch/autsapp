import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  createWhatsAppInstance,
  deleteWhatsAppInstance,
  fetchEvolutionWebhookLog,
  fetchWhatsAppConnectQr,
  fetchWhatsAppInstanceStatus,
  fetchWhatsAppInstances,
  fetchWhatsAppIntegration,
  logoutWhatsAppInstance,
  rebootWhatsAppInstance,
  setDefaultWhatsAppInstance,
  syncWhatsAppInstanceWebhook,
} from '../../api/client.js';

const stateLabels = {
  open: 'متصل',
  authorized: 'متصل',
  connected: 'متصل',
  connecting: 'جاري الربط — امسح QR',
  close: 'غير متصل — امسح QR',
  notauthorized: 'غير مصرّح — امسح QR',
  starting: 'جاري التشغيل…',
  blocked: 'محظور',
  missing: 'الجلسة غير موجودة في Evolution',
  unreachable: 'Evolution API غير متاح',
  notconfigured: 'غير مضبوط',
  unknown: 'غير معروف',
};

/** Session names are internal: generated automatically (a-z0-9-, 3–40 chars). */
function generateInstanceName() {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `wa-${rand}`;
}

function isConnectedState(state) {
  const s = (state ?? '').toLowerCase();
  return s === 'open' || s === 'authorized' || s === 'connected';
}

function StateBadge({ state }) {
  const normalized = (state ?? 'unknown').toLowerCase();
  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
        isConnectedState(state) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300',
      ].join(' ')}
    >
      {stateLabels[normalized] ?? state}
    </span>
  );
}

function QrPanel({ activeQr, onRefresh, onClose }) {
  if (!activeQr) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal>
      <div className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">ربط واتساب — Evolution API</h3>
            <p className="mt-1 text-xs text-slate-400" dir="ltr">
              {activeQr.instanceName}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {activeQr.message && !activeQr.base64 ? (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {activeQr.message}
          </p>
        ) : null}

        <ol className="mt-4 list-decimal space-y-2 pr-5 text-sm text-slate-300">
          <li>افتح واتساب على هاتفك</li>
          <li>الإعدادات ← الأجهزة المرتبطة ← ربط جهاز</li>
          <li>امسح رمز QR الظاهر أدناه</li>
        </ol>

        <div className="mt-5 flex min-h-[240px] items-center justify-center rounded-xl border border-slate-700 bg-white p-3">
          {activeQr.base64 ? (
            <img src={activeQr.base64} alt="WhatsApp QR Code" className="max-h-64 w-full object-contain" />
          ) : (
            <div className="text-center text-sm text-slate-600">
              <p className="font-medium">QR غير جاهز بعد</p>
              <p className="mt-1 text-xs">اضغط «تحديث QR» بعد ثوانٍ</p>
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-xs text-emerald-400/90">يتم تحديث QR تلقائياً كل 20 ثانية…</p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="flex-1 rounded-xl bg-ember-500 py-2.5 text-sm font-semibold text-white hover:bg-ember-400"
          >
            تحديث QR
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-200"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

function IntegrationStatus({ integration }) {
  if (!integration) return null;
  const good = integration.configured && integration.reachable && integration.keyValid;
  return (
    <div
      className={[
        'rounded-xl border px-4 py-3 text-sm',
        good ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/40 bg-amber-500/10 text-amber-100',
      ].join(' ')}
    >
      <p className="font-semibold">
        {good ? '✓ Evolution API متصل' : '⚠ Evolution API غير جاهز'}
        {integration.version ? <span className="ms-2 text-xs opacity-80">v{integration.version}</span> : null}
      </p>
      {!good && integration.error ? <p className="mt-1 text-xs">{integration.error}</p> : null}
    </div>
  );
}

/** Last webhook calls received from Evolution: shows whether customer messages reach the API at all. */
function WebhookLog() {
  const [hits, setHits] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchEvolutionWebhookLog();
      setHits(data.hits ?? []);
    } catch (err) {
      setError(err.message ?? 'تعذر التحميل');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-300">آخر الأحداث الواردة من Evolution</h3>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200 disabled:opacity-50"
        >
          {loading ? '…' : 'تحديث'}
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        إلا صيفطتي رسالة للرقم وما ظهر هنا والو، يعني Evolution ما كيبعتش الأحداث لهاد الـ API (راجع Webhook وحالة الجلسة).
      </p>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {hits && hits.length === 0 ? <p className="text-xs text-amber-300">لم يصل أي حدث بعد.</p> : null}
      {hits && hits.length > 0 ? (
        <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
          {hits.map((h, i) => (
            <li
              key={`${h.at}-${i}`}
              className={['rounded-lg px-2 py-1.5', h.ok ? 'bg-slate-800/60 text-slate-300' : 'bg-red-500/10 text-red-300'].join(' ')}
            >
              <span className="text-slate-500" dir="ltr">
                {new Date(h.at).toLocaleTimeString()}
              </span>{' '}
              <span className="font-mono" dir="ltr">
                {h.event ?? '?'}
              </span>{' '}
              {h.jid ? (
                <span className="text-slate-500" dir="ltr">
                  {h.jid}
                </span>
              ) : null}{' '}
              — {h.result}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function WhatsAppLinkPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [instances, setInstances] = useState([]);
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeQr, setActiveQr] = useState(null);
  const [pollingId, setPollingId] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, integ] = await Promise.all([
        fetchWhatsAppInstances(),
        isAdmin ? fetchWhatsAppIntegration().catch(() => null) : Promise.resolve(null),
      ]);
      setInstances(data.instances ?? []);
      setIntegration(integ);
    } catch (err) {
      setError(err.message ?? 'تعذر تحميل الأرقام');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  // While the QR is open, watch for the scan.
  useEffect(() => {
    if (!pollingId) return undefined;
    const interval = setInterval(async () => {
      try {
        const status = await fetchWhatsAppInstanceStatus(pollingId);
        if (isConnectedState(status.connectionState)) {
          setPollingId(null);
          setActiveQr(null);
          setSuccessMsg('✓ تم ربط الرقم بنجاح');
          load();
        }
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingId, load]);

  useEffect(() => {
    if (!activeQr?.instanceId || !isAdmin) return undefined;
    const refreshInterval = setInterval(() => {
      refreshQr(activeQr.instanceId, { silent: true });
    }, 20000);
    return () => clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQr?.instanceId, isAdmin]);

  function applyQrResponse(instanceId, row, payload) {
    if (payload?.connected) {
      setActiveQr(null);
      setPollingId(null);
      setSuccessMsg(payload?.message ?? 'واتساب متصل — لا حاجة لـ QR.');
      return;
    }
    const qr = payload?.qr ?? {};
    setSuccessMsg('');
    setActiveQr({
      instanceId,
      instanceName: row?.instanceName ?? payload?.instanceName,
      base64: qr.base64 ?? payload?.qrcode ?? null,
      message: qr.message ?? payload?.message ?? null,
    });
    setPollingId(instanceId);
  }

  async function handleCreate(e) {
    e?.preventDefault?.();
    if (!isAdmin) return;
    setCreating(true);
    setError('');
    setSuccessMsg('');
    try {
      const data = await createWhatsAppInstance({
        instanceName: generateInstanceName(),
        label: label.trim() || undefined,
      });
      applyQrResponse(data.instance.id, data.instance, data);
      if (data.connected) {
        // message already set by applyQrResponse
      } else if (data.webhookSynced) {
        setSuccessMsg('تم إنشاء الجلسة وضبط Webhook تلقائياً — امسح QR لإكمال الربط.');
      } else if (data.webhookError) {
        setSuccessMsg(`تم إنشاء الجلسة، لكن تعذر ضبط Webhook: ${data.webhookError}`);
      }
      setLabel('');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message ?? 'تعذر إنشاء الجلسة — تحقق من Evolution API');
    } finally {
      setCreating(false);
    }
  }

  function openNewForm() {
    setLabel('');
    setError('');
    setSuccessMsg('');
    setShowForm(true);
  }

  async function refreshQr(instanceId, opts = {}) {
    if (!opts.silent) setError('');
    try {
      const data = await fetchWhatsAppConnectQr(instanceId);
      const inst = instances.find((i) => i.id === instanceId);
      applyQrResponse(instanceId, inst, data);
    } catch (err) {
      if (!opts.silent) setError(err.message ?? 'تعذر جلب QR');
    }
  }

  async function runAction(id, fn, okMessage) {
    setActionId(id);
    setError('');
    try {
      await fn(id);
      if (okMessage) setSuccessMsg(okMessage);
      await load();
    } catch (err) {
      setError(err.message ?? 'تعذر تنفيذ العملية');
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(inst) {
    const msg = inst.legacy
      ? 'حذف هذا السجل القديم (Green API) من لوحة التحكم؟'
      : `حذف الجلسة «${inst.label ?? inst.instanceName}» من Evolution API ومن لوحة التحكم؟ سيتوقف الرقم عن الرد.`;
    if (!isAdmin || !window.confirm(msg)) return;
    setError('');
    try {
      const res = await deleteWhatsAppInstance(inst.id);
      if (activeQr?.instanceId === inst.id) {
        setActiveQr(null);
        setPollingId(null);
      }
      if (res?.remoteError) {
        setError(`تم الحذف من اللوحة لكن تعذر حذف الجلسة من Evolution: ${res.remoteError}`);
      }
      await load();
    } catch (err) {
      setError(err.message ?? 'تعذر الحذف');
    }
  }

  return (
    <section className="space-y-6">
      <QrPanel
        activeQr={activeQr}
        onRefresh={() => refreshQr(activeQr.instanceId)}
        onClose={() => {
          setActiveQr(null);
          setPollingId(null);
        }}
      />

      <div>
        <h2 className="text-xl font-bold text-white">ربط أرقام واتساب — Evolution API</h2>
        <p className="mt-2 text-sm text-slate-400">
          اضغط «إنشاء الجلسة»، ثم امسح رمز QR من واتساب ← الأجهزة المرتبطة.
        </p>
      </div>

      {isAdmin ? <IntegrationStatus integration={integration} /> : null}

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</div>
      ) : null}

      {successMsg ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {successMsg}
        </div>
      ) : null}

      {isAdmin ? (
        showForm || instances.length === 0 ? (
          <form
            onSubmit={handleCreate}
            autoComplete="off"
            className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:grid-cols-2"
          >
            <div className="flex items-center justify-between md:col-span-2">
              <h3 className="text-sm font-semibold text-white">
                {instances.length === 0 ? 'ربط رقم واتساب' : 'ربط رقم واتساب جديد'}
              </h3>
              {instances.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  إلغاء ✕
                </button>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">اسم الرقم (اختياري)</label>
              <input
                name="evo-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="خط الدعم 1"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {creating ? 'جاري إنشاء الجلسة وجلب QR…' : '+ إنشاء الجلسة وعرض QR'}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={openNewForm}
            className="w-full rounded-2xl border border-dashed border-emerald-500/40 bg-emerald-500/5 py-4 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
          >
            ➕ ربط رقم واتساب آخر
          </button>
        )
      ) : (
        <p className="text-sm text-slate-500">إضافة أرقام جديدة متاحة لمدير النظام فقط.</p>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">الحسابات المسجّلة</h3>
        {loading ? (
          <p className="text-sm text-slate-500">جاري التحميل…</p>
        ) : instances.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center">
            <p className="text-4xl" aria-hidden>
              📱
            </p>
            <p className="mt-3 text-sm font-medium text-slate-300">لا توجد جلسات واتساب بعد</p>
            <p className="mt-1 text-xs text-slate-500">أنشئ جلسة ثم امسح QR</p>
          </div>
        ) : (
          instances.map((inst) => {
            const connected = isConnectedState(inst.connectionState);
            const busy = actionId === inst.id;
            return (
              <article
                key={inst.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-4"
              >
                <div>
                  <p className="font-medium text-white">
                    {inst.label ?? inst.instanceName}
                    {inst.legacy ? (
                      <span className="ms-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">
                        Green API (قديم)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500" dir="ltr">
                    {inst.instanceName}
                    {inst.phone ? ` · +${inst.phone}` : ''}
                  </p>
                  {inst.legacy ? (
                    <p className="mt-1 text-xs text-amber-300/90">
                      رقم قديم مرتبط بـ Green API — اربطه من جديد عبر Evolution ثم احذف هذا السجل.
                    </p>
                  ) : null}
                  {inst.connectionError ? (
                    <p className="mt-1 text-xs text-red-300/90">{inst.connectionError}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge state={inst.connectionState} />
                  {inst.isDefault ? (
                    <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300">افتراضي</span>
                  ) : null}
                  {isAdmin ? (
                    <>
                      {!inst.legacy && !connected && inst.connectionState !== 'missing' ? (
                        <button
                          type="button"
                          onClick={() => refreshQr(inst.id)}
                          className="rounded-lg bg-ember-500 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          QR / إعادة ربط
                        </button>
                      ) : null}
                      {!inst.legacy ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => runAction(inst.id, rebootWhatsAppInstance)}
                            className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200"
                          >
                            Restart
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => runAction(inst.id, syncWhatsAppInstanceWebhook, 'تم ضبط Webhook')}
                            className="rounded-lg border border-sky-600/50 px-3 py-1 text-xs text-sky-200"
                          >
                            Webhook
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => runAction(inst.id, logoutWhatsAppInstance)}
                            className="rounded-lg border border-amber-600/50 px-3 py-1 text-xs text-amber-200"
                          >
                            Logout
                          </button>
                        </>
                      ) : null}
                      {!inst.isDefault ? (
                        <button
                          type="button"
                          onClick={() => runAction(inst.id, setDefaultWhatsAppInstance)}
                          className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200"
                        >
                          افتراضي
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDelete(inst)}
                        className="rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-300"
                      >
                        حذف
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>

      {isAdmin ? <WebhookLog /> : null}

      <p className="text-xs text-slate-600">
        إعدادات OpenAI والبرومبت:{' '}
        <Link to="/dashboard/settings" className="text-emerald-500 hover:underline">
          إعدادات الحساب
        </Link>
      </p>
    </section>
  );
}
