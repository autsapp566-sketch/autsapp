import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchSettings, fetchMoroccanAiVoiceTemplate, saveSettings } from '../api/client.js';

function SaveIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

const DEFAULT_MODELS = [{ value: 'gpt-4o-mini', label: 'gpt-4o-mini (اقتصادي وسريع جداً - موصى به)' }];

export default function VoiceAISettingsView({ embedded = false }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [form, setForm] = useState({
    openAiApiKey: '',
    appPublicUrl: '',
    textModel: 'gpt-4o-mini',
    sttEnabled: true,
    ttsEnabled: false,
    employeePrompt: '',
    qualificationPrompt: '',
    openAiKeyConfigured: false,
  });
  const [modelOptions, setModelOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSettings();
      const s = data.settings ?? data;
      setForm((prev) => ({
        ...prev,
        textModel: data.textModel ?? s.textModel,
        sttEnabled: s.sttEnabled,
        ttsEnabled: s.ttsEnabled,
        employeePrompt: data.systemPrompt ?? s.employeePrompt ?? '',
        qualificationPrompt: s.qualificationPrompt ?? '',
        openAiKeyConfigured: data.openaiApiKeyConfigured ?? s.openAiKeyConfigured,
        openAiApiKey: data.openaiApiKey ?? s.openAiKeyMasked ?? '',
        appPublicUrl: s.appPublicUrl ?? '',
      }));
      setModelOptions(data.options?.textModelOptions ?? []);
    } catch (err) {
      setError(err.message ?? 'تعذر تحميل الإعدادات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      load();
    } else {
      setLoading(false);
    }
  }, [isAdmin, load]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        textModel: form.textModel,
        sttEnabled: form.sttEnabled,
        ttsEnabled: form.ttsEnabled,
        systemPrompt: form.employeePrompt,
        qualificationPrompt: form.qualificationPrompt,
        appPublicUrl: form.appPublicUrl,
      };
      if (form.openAiApiKey && form.openAiApiKey.startsWith('sk-') && !form.openAiApiKey.includes('••••')) {
        payload.openaiApiKey = form.openAiApiKey;
      }
      const data = await saveSettings(payload);
      const s = data.settings ?? {};
      setForm((prev) => ({
        ...prev,
        textModel: data.textModel ?? s.textModel ?? prev.textModel,
        employeePrompt: data.systemPrompt ?? s.employeePrompt ?? prev.employeePrompt,
        qualificationPrompt: s.qualificationPrompt ?? prev.qualificationPrompt,
        openAiKeyConfigured: data.openaiApiKeyConfigured ?? s.openAiKeyConfigured ?? prev.openAiKeyConfigured,
        openAiApiKey: data.openaiApiKey ?? s.openAiKeyMasked ?? prev.openAiApiKey,
        appPublicUrl: s.appPublicUrl ?? prev.appPublicUrl,
      }));
      setToast(data.message ?? 'تم حفظ البرومبت والإعدادات بنجاح');
    } catch (err) {
      setError(err.message ?? 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function loadMoroccanTemplate() {
    try {
      const data = await fetchMoroccanAiVoiceTemplate();
      setForm((prev) => ({ ...prev, employeePrompt: data.template }));
    } catch (err) {
      setError(err.message ?? 'تعذر تحميل القالب');
    }
  }

  if (!isAdmin) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-sm text-slate-400">
        إعدادات الصوت والذكاء الاصطناعي متاحة لمدير النظام فقط.
      </section>
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-500">جاري التحميل…</p>;
  }

  const models = modelOptions.length ? modelOptions : DEFAULT_MODELS;

  return (
    <section className={embedded ? 'space-y-6' : 'relative mx-auto max-w-5xl space-y-6'}>
      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-ember-500/40 bg-ember-500 px-5 py-3 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</div>
      ) : null}

      <form
        onSubmit={handleSave}
        className="space-y-8 rounded-[28px] border border-slate-800/90 bg-[#0f1724] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:p-8"
      >
        <header className="flex flex-col items-end gap-1 text-right">
          <h2 className="text-lg font-bold text-white sm:text-xl">
            إعدادات محرك الذكاء الاصطناعي والصوت (OpenAI & Voice AI)
          </h2>
          <p className="text-xs text-slate-400 sm:text-sm">
            ضبط المفتاح وإضافة ميزة استماع الرسائل الصوتية وتوليد الإجابة الصوتية بنبرة طبيعية
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="openAiApiKey" className="block text-sm text-slate-300">
              OpenAI API Key
            </label>
            <input
              id="openAiApiKey"
              type="password"
              dir="ltr"
              autoComplete="off"
              placeholder="sk-..."
              value={form.openAiApiKey}
              onChange={(e) => setForm((p) => ({ ...p, openAiApiKey: e.target.value }))}
              className="w-full rounded-2xl border border-slate-700/80 bg-[#0b1220] px-4 py-3.5 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="textModel" className="block text-sm text-slate-300">
              نموذج النص (Text Model)
            </label>
            <select
              id="textModel"
              value={form.textModel}
              onChange={(e) => setForm((p) => ({ ...p, textModel: e.target.value }))}
              className="w-full appearance-none rounded-2xl border border-slate-700/80 bg-[#0b1220] px-4 py-3.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {models.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-end gap-2">
            <h3 className="text-sm font-semibold text-slate-200">إعدادات الرسائل الصوتية (Voice Notes AI)</h3>
            <MicIcon />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0b1220] px-5 py-4">
              <span className="text-right">
                <span className="block text-sm font-medium text-white">تحويل صوت الزبون لنص (Whisper STT)</span>
                <span className="mt-1 block text-xs text-slate-500">فهم الرسائل الصوتية بالدارجة المغربية</span>
              </span>
              <input
                type="checkbox"
                checked={form.sttEnabled}
                onChange={(e) => setForm((p) => ({ ...p, sttEnabled: e.target.checked }))}
                className="h-5 w-5 shrink-0 rounded border-slate-600 bg-slate-900 text-emerald-500 accent-emerald-500"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0b1220] px-5 py-4">
              <span className="text-right">
                <span className="block text-sm font-medium text-white">الرد بصوت طبيعي (TTS Output)</span>
                <span className="mt-1 block text-xs text-slate-500">إرسال تسجيل صوتي أوتوماتيكي للزبون</span>
              </span>
              <input
                type="checkbox"
                checked={form.ttsEnabled}
                onChange={(e) => setForm((p) => ({ ...p, ttsEnabled: e.target.checked }))}
                className="h-5 w-5 shrink-0 rounded border-slate-600 bg-slate-900 text-emerald-500 accent-emerald-500"
              />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={loadMoroccanTemplate}
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
            >
              تحميل القالب المغربي الجاهز (الدارجة الاحترافية)
            </button>
            <label htmlFor="employeePrompt" className="text-sm font-medium text-slate-200">
              توجيهات النظام والشخصية (System Prompt / Persona)
            </label>
          </div>
          <textarea
            id="employeePrompt"
            value={form.employeePrompt}
            onChange={(e) => setForm((p) => ({ ...p, employeePrompt: e.target.value }))}
            rows={9}
            placeholder="أنت مساعد ذكي واحترافي، تقدم الخدمة بالدارجة المغربية المفهومة..."
            className="w-full rounded-2xl border border-slate-800 bg-[#080d18] px-5 py-4 text-sm leading-7 text-slate-200 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
          >
            <SaveIcon />
            {saving ? 'جاري الحفظ…' : 'حفظ إعدادات المحرك'}
          </button>
        </div>
      </form>
    </section>
  );
}
