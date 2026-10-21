import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  createWhatsAppInstance,
  deleteWhatsAppInstance,
  fetchWhatsAppConnectQr,
  fetchWhatsAppInstanceStatus,
  fetchWhatsAppInstances,
  fetchWhatsAppIntegration,
  logoutWhatsAppInstance,
  rebootWhatsAppInstance,
  setDefaultWhatsAppInstance,
} from '../../api/client.js';

const stateLabels = {
  authorized: 'متصل',
  open: 'متصل',
  connected: 'متصل',
  notauthorized: 'غير مصرّح — امسح QR',
  notAuthorized: 'غير مصرّح — امسح QR',
  close: 'غير متصل',
  connecting: 'جاري الربط…',
  starting: 'جاري التشغيل…',
  blocked: 'محظور',
  sleepmode: 'وضع السكون',
  unreachable: 'Green API غير متاح',
  notconfigured: 'غير مضبوط',
  unknown: 'غير معروف',
};

function StateBadge({ state }) {
  const normalized = (state ?? 'unknown').toLowerCase();
  const isConnected =
    normalized === 'authorized' || normalized === 'open' || normalized === 'connected';
  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
        isConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300',
      ].join(' ')}
    >
      {stateLabels[normalized] ?? stateLabels[state] ?? state}
    </span>
  );
}

function isConnectedState(state) {
  const s = (state ?? '').toLowerCase();
  return s === 'authorized' || s === 'open' || s === 'connected';
}

function QrPanel({ activeQr, onRefresh, onClose }) {
  if (!activeQr) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal>
      <div className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">ربط واتساب — Green API</h3>
            <p className="mt-1 text-xs text-slate-400" dir="ltr">
              {activeQr.greenInstanceId ?? activeQr.instanceName}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {activeQr.message && !activeQr.base64 ? (
          <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
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
              <p className="font-medium">QR غير جاهز</p>
              <p className="mt-1 text-xs">تحقق من Instance ID و API Token في Green API</p>
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-xs text-emerald-400/90">يتم تحديث QR تلقائياً كل 20 ثانية…</p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
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

export default function WhatsAppLinkPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [instances, setInstances] = useState([]);
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [greenInstanceId, setGreenInstanceId] = useState('');
  const [greenApiToken, setGreenApiToken] = useState('');
  const [greenApiUrl, setGreenApiUrl] = useState('');
  const [creating, setCreating] = useState(false);
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
    if (!integration) {
      return;
    }
    setGreenInstanceId((v) => v || integration.instanceId || '');
    setGreenApiUrl((v) => v || integration.baseUrl || '');
  }, [integration]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!pollingId) {
      return undefined;
    }

    const interval = setInterval(async () => {
      try {
        const status = await fetchWhatsAppInstanceStatus(pollingId);
        if (isConnectedState(status.connectionState)) {
          setPollingId(null);
          setActiveQr(null);
          load();
        }
      } catch {
        /* ignore */
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pollingId, load]);

  useEffect(() => {
    if (!activeQr?.instanceId || !isAdmin) {
      return undefined;
    }

    const refreshInterval = setInterval(() => {
      refreshQr(activeQr.instanceId, { silent: true });
    }, 20000);

    return () => clearInterval(refreshInterval);
  }, [activeQr?.instanceId, isAdmin]);

  function applyQrResponse(instanceId, row, payload) {
    if (payload?.connected) {
      setActiveQr(null);
      setPollingId(null);
      setSuccessMsg(
        payload?.message ?? 'واتساب متصل — لا حاجة لـ QR.'
      );
      return;
    }

    const base64 = payload?.qr?.base64 ?? payload?.qrcode ?? payload?.base64;
    const message = payload?.qr?.message ?? payload?.message;

    if (!base64 && message) {
      setActiveQr({
        instanceId,
        instanceName: row?.instanceName ?? payload?.instanceName,
        greenInstanceId: row?.greenInstanceId ?? payload?.greenInstanceId,
        base64: null,
        message,
      });
      setPollingId(null);
      return;
    }

    setSuccessMsg('');
    setActiveQr({
      instanceId,
      instanceName: row?.instanceName ?? payload?.instanceName,
      greenInstanceId: row?.greenInstanceId ?? payload?.greenInstanceId,
      base64,
      message: message ?? null,
    });
    setPollingId(instanceId);
  }

  async function handleCreate(e) {
    e?.preventDefault?.();
    if (!isAdmin) {
      return;
    }
    setCreating(true);
    setError('');
    setSuccessMsg('');
    try {
      const data = await createWhatsAppInstance({
        label: label.trim() || undefined,
        greenInstanceId: greenInstanceId.trim() || undefined,
        greenApiToken: greenApiToken.trim() || undefined,
        greenApiUrl: greenApiUrl.trim() || undefined,
      });
      applyQrResponse(data.instance.id, data.instance, data);
      setLabel('');
      if (greenApiToken) {
        setGreenApiToken('');
      }
      await load();
    } catch (err) {
      setError(err.message ?? 'تعذر إنشاء الربط — تحقق من Green API');
    } finally {
      setCreating(false);
    }
  }

  async function quickQrConnect() {
    if (!isAdmin || creating) return;
    await handleCreate({ preventDefault: () => {} });
  }

  async function refreshQr(instanceId, opts = {}) {
    if (!opts.silent) {
      setError('');
    }
    try {
      const data = await fetchWhatsAppConnectQr(instanceId);
      const inst = instances.find((i) => i.id === instanceId);
      applyQrResponse(instanceId, inst, data);
    } catch (err) {
      if (!opts.silent) {
        setError(err.message ?? 'تعذر جلب QR');
      }
    }
  }

  async function handleLogout(id) {
    setActionId(id);
    setError('');
    try {
      await logoutWhatsAppInstance(id);
      await load();
    } catch (err) {
      setError(err.message ?? 'تعذر تسجيل الخروج');
    } finally {
      setActionId(null);
    }
  }

  async function handleReboot(id) {
    setActionId(id);
    setError('');
    try {
      await rebootWhatsAppInstance(id);
      await load();
    } catch (err) {
      setError(err.message ?? 'تعذر إعادة التشغيل');
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(id) {
    if (!isAdmin || !window.confirm('حذف هذا السجل من لوحة التحكم؟ (Instance يبقى في Green API)')) {
      return;
    }
    setError('');
    try {
      await deleteWhatsAppInstance(id);
      if (activeQr?.instanceId === id) {
        setActiveQr(null);
        setPollingId(null);
      }
      await load();
    } catch (err) {
      setError(err.message ?? 'تعذر الحذف');
    }
  }

  async function handleSetDefault(id) {
    setError('');
    try {
      await setDefaultWhatsAppInstance(id);
      await load();
    } catch (err) {
      setError(err.message ?? 'تعذر تعيين الافتراضي');
    }
  }

  const hasConnected = instances.some((i) => isConnectedState(i.connectionState));
  const webhookHint = integration?.webhookUrl ?? 'http://localhost:3000/api/webhook/green-api';

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
        <h2 className="text-xl font-bold text-white">ربط أرقام واتساب — Green API</h2>
        <p className="mt-2 text-sm text-slate-400">
          أضف Instance ID و API Token من{' '}
          <a
            href="https://green-api.com"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:underline"
          >
            green-api.com
          </a>{' '}
          ثم امسح QR. Webhook الوارد:{' '}
          <span className="font-mono text-xs text-slate-300" dir="ltr">
            {webhookHint}
          </span>
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</div>
      ) : null}

      {successMsg ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {successMsg}
        </div>
      ) : null}

      {isAdmin ? (
        <>
          <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-slate-900/80 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-white">ربط سريع بـ QR Code</p>
                <p className="mt-1 text-sm text-slate-400">
                  {hasConnected
                    ? 'يمكنك إضافة instance آخر أو إعادة مسح QR.'
                    : 'املأ الحقول أدناه أو اعتمد على .env ثم اعرض QR.'}
                </p>
              </div>
              <button
                type="button"
                disabled={creating}
                onClick={quickQrConnect}
                className="shrink-0 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 disabled:opacity-50"
              >
                {creating ? 'جاري التحضير…' : '📱 عرض QR Code للربط'}
              </button>
            </div>
          </div>

          <form
            onSubmit={handleCreate}
            className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-xs text-slate-400">Instance ID (idInstance)</label>
              <input
                value={greenInstanceId}
                onChange={(e) => setGreenInstanceId(e.target.value)}
                placeholder="710722775456"
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                API Token (apiTokenInstance — ليس Admin token)
              </label>
              <input
                type="password"
                value={greenApiToken}
                onChange={(e) => setGreenApiToken(e.target.value)}
                placeholder="فارغ = .env أو Token المحفوظ"
                dir="ltr"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Green API URL (اختياري)</label>
              <input
                value={greenApiUrl}
                onChange={(e) => setGreenApiUrl(e.target.value)}
                placeholder="https://7107.api.greenapi.com"
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">اسم ظاهر (اختياري)</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="خط الدعم 1"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {creating ? 'جاري الحفظ وجلب QR…' : '+ حفظ وربط Green API'}
              </button>
            </div>
          </form>
        </>
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
            <p className="mt-3 text-sm font-medium text-slate-300">لا يوجد Green API instance بعد</p>
            <p className="mt-1 text-xs text-slate-500">أضف Instance ID و Token ثم اعرض QR</p>
          </div>
        ) : (
          instances.map((inst) => {
            const connected = isConnectedState(inst.connectionState);
            return (
              <article
                key={inst.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-4"
              >
                <div>
                  <p className="font-medium text-white">{inst.label ?? inst.instanceName}</p>
                  <p className="text-xs text-slate-500" dir="ltr">
                    idInstance: {inst.greenInstanceId ?? '—'}
                    {inst.greenApiTokenMasked ? ` · token ${inst.greenApiTokenMasked}` : ''}
                  </p>
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
                      {!connected ? (
                        <button
                          type="button"
                          onClick={() => refreshQr(inst.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          QR / إعادة ربط
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={actionId === inst.id}
                        onClick={() => handleReboot(inst.id)}
                        className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200"
                      >
                        Reboot
                      </button>
                      <button
                        type="button"
                        disabled={actionId === inst.id}
                        onClick={() => handleLogout(inst.id)}
                        className="rounded-lg border border-amber-600/50 px-3 py-1 text-xs text-amber-200"
                      >
                        Logout
                      </button>
                      {!inst.isDefault ? (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(inst.id)}
                          className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200"
                        >
                          افتراضي
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDelete(inst.id)}
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

      <p className="text-xs text-slate-600">
        إعدادات OpenAI والبرومبت:{' '}
        <Link to="/dashboard/settings" className="text-emerald-500 hover:underline">
          إعدادات الحساب
        </Link>
      </p>
    </section>
  );
}
