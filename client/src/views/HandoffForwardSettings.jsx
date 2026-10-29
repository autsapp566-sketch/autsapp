import { useEffect, useState } from 'react';
import { fetchHandoffForward, saveHandoffForward, testHandoffForward } from '../api/client.js';

function formatNumber(n) {
  return `+${n}`;
}

export default function HandoffForwardSettings() {
  const [enabled, setEnabled] = useState(true);
  const [numbers, setNumbers] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetchHandoffForward()
      .then((data) => {
        setEnabled(data.enabled !== false);
        setNumbers(data.numbers ?? []);
      })
      .catch((err) => setError(err.message ?? 'تعذر تحميل الإعدادات'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function addNumber() {
    const value = draft.trim();
    if (!value) return;
    const digits = value.replace(/\D/g, '');
    if (digits.length < 8) {
      setError('أدخل رقم واتساب صحيحاً مع مفتاح الدولة (مثال: 212612345678 أو 0612345678)');
      return;
    }
    setError('');
    setNumbers((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setDraft('');
    setDirty(true);
  }

  function removeNumber(n) {
    setNumbers((prev) => prev.filter((x) => x !== n));
    setDirty(true);
  }

  async function persist() {
    const pending = draft.trim() ? [...numbers, draft.trim()] : numbers;
    const saved = await saveHandoffForward({ enabled, numbers: pending });
    setNumbers(saved.numbers ?? []);
    setEnabled(saved.enabled !== false);
    setDraft('');
    setDirty(false);
    return saved;
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await persist();
      setToast('تم حفظ أرقام التحويل ✔');
    } catch (err) {
      setError(err.message ?? 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError('');
    try {
      if (dirty || draft.trim()) await persist();
      const result = await testHandoffForward();
      if (result.failed?.length) {
        setError(`تعذر الإرسال إلى: ${result.failed.map((f) => `${formatNumber(f.number)} (${f.error})`).join('، ')}`);
      }
      if (result.sent?.length) {
        setToast(`تم إرسال رسالة اختبار إلى ${result.sent.map(formatNumber).join('، ')}`);
      }
    } catch (err) {
      setError(err.message ?? 'تعذر إرسال رسالة الاختبار');
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="max-w-2xl space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div>
        <h3 className="text-lg font-bold text-white">📲 تحويل المحادثات إلى رقم واتساب آخر</h3>
        <p className="mt-1 text-sm text-slate-400">
          عندما تنتقل محادثة إلى «تحكم بشري» أو «تحت التسليم»، يُرسل لهذه الأرقام على واتساب: اسم العميل ورقمه
          ورابط فتح المحادثة وملخصها وآخر الرسائل — لتكمل الموظفة من هاتفها.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">جاري التحميل…</p>
      ) : (
        <>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setDirty(true);
              }}
              className="h-4 w-4 accent-emerald-500"
            />
            تفعيل التحويل
          </label>

          <div className="flex gap-2">
            <input
              dir="ltr"
              inputMode="tel"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addNumber();
                }
              }}
              placeholder="212612345678 أو 0612345678"
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={addNumber}
              className="shrink-0 rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              إضافة
            </button>
          </div>

          {numbers.length ? (
            <ul className="flex flex-wrap gap-2">
              {numbers.map((n) => (
                <li
                  key={n}
                  className="flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-200"
                >
                  <span dir="ltr">{formatNumber(n)}</span>
                  <button
                    type="button"
                    onClick={() => removeNumber(n)}
                    className="text-emerald-300/70 hover:text-red-300"
                    aria-label="حذف"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">لم تُضف أي رقم بعد.</p>
          )}

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>
          ) : null}
          {toast ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {toast}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || testing}
              className="rounded-xl bg-ember-500 px-5 py-2 text-sm font-semibold text-white hover:bg-ember-400 disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ…' : 'حفظ'}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={saving || testing || (!numbers.length && !draft.trim())}
              className="rounded-xl border border-slate-600 px-5 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              {testing ? 'جاري الإرسال…' : 'إرسال رسالة اختبار'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
