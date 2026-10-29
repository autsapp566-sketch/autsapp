import { useCallback, useEffect, useMemo, useState } from 'react';
import { createTeamMember, deleteTeamMember, fetchTeam, updateTeamMember } from '../../api/client.js';

function sameSet(a, b) {
  return a.length === b.length && a.every((k) => b.includes(k));
}

function enabledKeys(permissions) {
  return Object.keys(permissions ?? {}).filter((k) => permissions[k]);
}

function toMap(catalog, keys) {
  return Object.fromEntries(catalog.map((p) => [p.key, keys.includes(p.key)]));
}

function presetIdFor(presets, permissions) {
  const keys = enabledKeys(permissions);
  return presets.find((p) => sameSet(p.permissions, keys))?.id ?? 'custom';
}

/** null = every number; array = only the listed WhatsApp numbers */
function sameInstanceScope(a, b) {
  if (a === null || b === null) return a === b;
  return sameSet(a, b);
}

function InstanceAccessEditor({ instances, value, onChange, disabled }) {
  const restricted = Array.isArray(value);

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div>
        <p className="text-sm font-medium text-white">أرقام واتساب المسموحة</p>
        <p className="text-xs text-slate-400">
          الأرقام التي يستطيع الوكيل رؤية محادثاتها والرد عليها في «محادثات الواتساب الحية». أي رقم غير محدد لا يظهر له نهائياً.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-slate-200">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            checked={!restricted}
            disabled={disabled}
            onChange={() => onChange(null)}
            className="h-4 w-4 accent-emerald-500"
          />
          كل الأرقام (بما فيها الأرقام الجديدة)
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            checked={restricted}
            disabled={disabled}
            onChange={() => onChange(instances.map((i) => i.id))}
            className="h-4 w-4 accent-emerald-500"
          />
          أرقام محددة فقط
        </label>
      </div>

      {restricted ? (
        instances.length === 0 ? (
          <p className="text-xs text-amber-300">لا توجد أرقام واتساب مربوطة بعد.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {instances.map((inst) => {
              const checked = value.includes(inst.id);
              return (
                <label
                  key={inst.id}
                  className={[
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition',
                    checked ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(e.target.checked ? [...value, inst.id] : value.filter((id) => id !== inst.id))
                    }
                    className="h-4 w-4 accent-emerald-500"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">
                      {inst.label}
                      {inst.legacy ? <span className="ms-2 text-[10px] text-amber-300">Green (قديم)</span> : null}
                    </span>
                    <span className="block text-xs text-slate-400" dir="ltr">
                      {inst.phone ? `+${inst.phone}` : '—'}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )
      ) : null}

      {restricted && value.length === 0 && instances.length > 0 ? (
        <p className="text-xs text-amber-300">لم تحدد أي رقم: لن يرى هذا الوكيل أي محادثة.</p>
      ) : null}
    </div>
  );
}

function PermissionEditor({ catalog, presets, permissions, onChange, disabled }) {
  const presetId = presetIdFor(presets, permissions);

  return (
    <div className="space-y-3">
      <label className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <span className="font-medium">الدور:</span>
        <select
          value={presetId}
          disabled={disabled}
          onChange={(e) => {
            const preset = presets.find((p) => p.id === e.target.value);
            if (preset) onChange(toMap(catalog, preset.permissions));
          }}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="custom">مخصص</option>
        </select>
        <span className="text-xs text-slate-500">اختر دوراً جاهزاً ثم عدّل الصلاحيات كما تريد.</span>
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        {catalog.map((p) => (
          <label
            key={p.key}
            className={[
              'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition',
              permissions[p.key]
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-slate-800 bg-slate-950/50 hover:border-slate-700',
            ].join(' ')}
          >
            <input
              type="checkbox"
              checked={Boolean(permissions[p.key])}
              disabled={disabled}
              onChange={(e) => onChange({ ...permissions, [p.key]: e.target.checked })}
              className="mt-1 h-4 w-4 accent-emerald-500"
            />
            <span>
              <span className="block text-sm font-medium text-white">{p.label}</span>
              <span className="block text-xs text-slate-400">{p.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function MemberCard({ member, catalog, presets, instances = [], onSaved, onDeleted, onError }) {
  const [permissions, setPermissions] = useState(member.permissions);
  const [instanceIds, setInstanceIds] = useState(member.instanceIds ?? null);
  const [active, setActive] = useState(member.active);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const isAdmin = member.role === 'ADMIN';
  const dirty =
    password.length > 0 ||
    active !== member.active ||
    !sameInstanceScope(instanceIds, member.instanceIds ?? null) ||
    !sameSet(enabledKeys(permissions), enabledKeys(member.permissions));

  const summary = useMemo(() => {
    if (isAdmin) return 'كل الصلاحيات';
    const count = enabledKeys(permissions).length;
    const preset = presets.find((p) => p.id === presetIdFor(presets, permissions));
    const scope = Array.isArray(instanceIds) ? ` · ${instanceIds.length} رقم واتساب` : '';
    return `${preset?.label ?? 'دور مخصص'} · ${count}/${catalog.length} صلاحيات${scope}`;
  }, [isAdmin, permissions, instanceIds, presets, catalog.length]);

  async function save() {
    setSaving(true);
    onError('');
    try {
      const payload = { active, permissions, instanceIds };
      if (password) payload.password = password;
      const { member: saved } = await updateTeamMember(member.id, payload);
      setPassword('');
      onSaved(saved);
    } catch (err) {
      onError(err.message ?? 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`حذف الحساب ${member.email} نهائياً؟`)) return;
    try {
      await deleteTeamMember(member.id);
      onDeleted(member.id);
    } catch (err) {
      onError(err.message ?? 'تعذر الحذف');
    }
  }

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-start"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-lg">
            {isAdmin ? '👑' : '🧑‍💼'}
          </span>
          <span>
            <span className="block font-semibold text-white" dir="ltr">
              {member.email}
            </span>
            <span className="block text-xs text-slate-400">{summary}</span>
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs">
          {isAdmin ? (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 font-semibold text-amber-300">مدير النظام</span>
          ) : (
            <span
              className={[
                'rounded-full px-2.5 py-1 font-semibold',
                member.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300',
              ].join(' ')}
            >
              {member.active ? 'نشط' : 'معطّل'}
            </span>
          )}
          <span className="text-slate-500">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open ? (
        <div className="space-y-5 border-t border-slate-800 px-5 py-5">
          {isAdmin ? (
            <p className="text-sm text-slate-400">
              المدير يملك كل الصلاحيات دائماً ولا يمكن تقييدها. بيانات دخوله من ملف <code dir="ltr">.env</code>.
            </p>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                الحساب مفعّل (يمكنه تسجيل الدخول)
              </label>

              <PermissionEditor
                catalog={catalog}
                presets={presets}
                permissions={permissions}
                onChange={setPermissions}
              />

              <InstanceAccessEditor instances={instances} value={instanceIds} onChange={setInstanceIds} />

              <label className="block max-w-sm text-sm text-slate-300">
                <span className="mb-1 block font-medium">كلمة مرور جديدة (اختياري)</span>
                <input
                  type="password"
                  name="member-new-password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 أحرف على الأقل"
                  dir="ltr"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-500"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty || saving}
                  className="rounded-xl bg-ember-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ember-400 disabled:opacity-40"
                >
                  {saving ? '...' : 'حفظ الصلاحيات'}
                </button>
                <button
                  type="button"
                  onClick={remove}
                  className="rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10"
                >
                  حذف الحساب
                </button>
              </div>
              {member.assignedLeads ? (
                <p className="text-xs text-slate-500">
                  عنده {member.assignedLeads} محادثة مسندة — تبقى المحادثات بعد حذف الحساب.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

function NewMemberForm({ catalog, presets, instances = [], onCreated, onCancel, onError }) {
  const defaultPreset = presets[0];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState(toMap(catalog, defaultPreset?.permissions ?? []));
  // null = every WhatsApp number (including numbers linked later)
  const [instanceIds, setInstanceIds] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    onError('');
    try {
      const { member } = await createTeamMember({ email, password, permissions, instanceIds });
      onCreated(member);
    } catch (err) {
      onError(err.message ?? 'تعذر إنشاء الحساب');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-emerald-500/30 bg-slate-900/60 p-5">
      <h3 className="font-bold text-white">وكيل جديد</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          <span className="mb-1 block font-medium">البريد الإلكتروني</span>
          <input
            type="email"
            name="new-member-email"
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-500"
          />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="mb-1 block font-medium">كلمة المرور</span>
          <input
            type="password"
            name="new-member-password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 أحرف على الأقل"
            dir="ltr"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <PermissionEditor catalog={catalog} presets={presets} permissions={permissions} onChange={setPermissions} />

      <InstanceAccessEditor instances={instances} value={instanceIds} onChange={setInstanceIds} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-ember-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ember-400 disabled:opacity-40"
        >
          {saving ? '...' : 'إنشاء الحساب'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [presets, setPresets] = useState([]);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchTeam();
      setMembers(data.members ?? []);
      setCatalog(data.catalog ?? []);
      setPresets(data.presets ?? []);
      setInstances(data.instances ?? []);
    } catch (err) {
      setError(err.message ?? 'تعذر تحميل الفريق');
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

  const admins = members.filter((m) => m.role === 'ADMIN');
  const agents = members.filter((m) => m.role !== 'ADMIN');

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">الفريق والصلاحيات</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            حدّد لكل وكيل ما يستطيع رؤيته وفعله: رؤية التحليلات، قراءة المحادثات، الاستلام البشري، الرد على العملاء، وتعديل
            الكتالوج. التغييرات تُطبَّق فوراً.
          </p>
        </div>
        {!adding && catalog.length ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-xl bg-ember-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ember-400"
          >
            ➕ إضافة وكيل
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {toast ? (
        <p role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {toast}
        </p>
      ) : null}

      {adding ? (
        <NewMemberForm
          catalog={catalog}
          presets={presets}
          instances={instances}
          onError={setError}
          onCancel={() => setAdding(false)}
          onCreated={(member) => {
            setMembers((prev) => [...prev, member]);
            setAdding(false);
            setToast(`تم إنشاء حساب ${member.email}`);
          }}
        />
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-400">جاري التحميل...</p>
      ) : (
        <div className="space-y-3">
          {[...admins, ...agents].map((member) => (
            <MemberCard
              key={`${member.id}:${member.active}:${enabledKeys(member.permissions).join(',')}:${
                member.instanceIds === null ? 'all' : (member.instanceIds ?? []).join(',')
              }`}
              member={member}
              catalog={catalog}
              presets={presets}
              instances={instances}
              onError={setError}
              onSaved={(saved) => {
                setMembers((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
                setToast(`تم حفظ صلاحيات ${saved.email}`);
              }}
              onDeleted={(id) => {
                setMembers((prev) => prev.filter((m) => m.id !== id));
                setToast('تم حذف الحساب');
              }}
            />
          ))}
          {agents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-400">
              لا يوجد وكلاء بعد. أضف أول وكيل وحدّد صلاحياته.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
