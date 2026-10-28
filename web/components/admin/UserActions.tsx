'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  banUserAction,
  changeSubscriptionAction,
  impersonateUserAction,
  unbanUserAction,
} from '@/app/admin/actions';
import type { ActionResult, AdminUser } from '@/lib/adminTypes';
import { Modal } from './Modal';

const BTN = 'rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40';
const BTN_NEUTRAL = `${BTN} border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white`;

type Dialog = 'plan' | 'ban' | 'unban' | null;

export function UserActions({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = useCallback(() => setDialog(null), []);

  if (user.platformRole === 'SUPER_ADMIN') {
    return <span className="text-xs text-slate-500">{isSelf ? 'حسابك' : 'مدير منصة'}</span>;
  }

  const blocked = Boolean(user.banned) || user.organization.suspended;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <form action={impersonateUserAction}>
        <input type="hidden" name="userId" value={user.id} />
        <ImpersonateButton disabled={blocked} />
      </form>
      <button type="button" className={BTN_NEUTRAL} onClick={() => setDialog('plan')}>
        الاشتراك
      </button>
      {blocked ? (
        <button
          type="button"
          className={`${BTN} border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10`}
          onClick={() => setDialog('unban')}
        >
          رفع التعطيل
        </button>
      ) : (
        <button
          type="button"
          className={`${BTN} border border-red-500/40 text-red-300 hover:bg-red-500/10`}
          onClick={() => setDialog('ban')}
        >
          تعطيل
        </button>
      )}

      {dialog === 'plan' ? <PlanDialog user={user} onClose={close} /> : null}
      {dialog === 'ban' ? <BanDialog user={user} onClose={close} /> : null}
      {dialog === 'unban' ? <UnbanDialog user={user} onClose={close} /> : null}
    </div>
  );
}

function ImpersonateButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      title={disabled ? 'لا يمكن انتحال حساب معطّل' : 'فتح لوحة تحكم هذا المستخدم لمدة ساعة'}
      className={BTN_NEUTRAL}
    >
      {pending ? '…' : 'انتحال'}
    </button>
  );
}

/* ------------------------------------------------------------------ shared bits */

function Submit({ label, tone }: { label: string; tone: 'danger' | 'primary' }) {
  const { pending } = useFormStatus();
  const cls = tone === 'danger' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500';
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${cls}`}
    >
      {pending ? 'جارٍ التنفيذ…' : label}
    </button>
  );
}

function CancelButton({ onClose, label = 'إلغاء' }: { onClose: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500">
      {label}
    </button>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {message}
    </p>
  );
}

const INPUT =
  'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/30';
const LABEL = 'mb-1.5 block text-xs font-medium text-slate-400';

/** Closes the dialog once an action succeeds without warnings. */
function useCloseOnSuccess(state: ActionResult | null, onClose: () => void) {
  useEffect(() => {
    if (state?.ok && !state.warnings?.length) onClose();
  }, [state, onClose]);
}

function Target({ user }: { user: AdminUser }) {
  return (
    <p className="mb-4 rounded-xl bg-slate-950 px-3 py-2 text-sm" dir="ltr" style={{ textAlign: 'right' }}>
      <span className="text-slate-200">{user.email}</span>
      <span className="text-slate-500"> · {user.organization.name}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ ban */

function BanDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [state, action] = useActionState(banUserAction, null);
  useCloseOnSuccess(state, onClose);

  return (
    <Modal title="تعطيل الحساب" onClose={onClose}>
      <form action={action}>
        <input type="hidden" name="userId" value={user.id} />
        <Target user={user} />
        <p className="mb-4 text-sm leading-6 text-slate-400">
          سيُمنع المستخدم من تسجيل الدخول فوراً وتنتهي جلساته الحالية. يمكنك التراجع في أي وقت.
        </p>
        <FormError message={state && !state.ok ? state.error : undefined} />
        <label className={LABEL} htmlFor={`reason-${user.id}`}>
          السبب (اختياري)
        </label>
        <textarea id={`reason-${user.id}`} name="reason" rows={2} maxLength={300} className={`${INPUT} mb-4 resize-none`} placeholder="مثال: إساءة استخدام / رسائل مزعجة" />
        <label className="mb-6 flex cursor-pointer items-start gap-2.5 text-sm text-slate-300">
          <input type="checkbox" name="suspendOrganization" className="mt-1 h-4 w-4 accent-red-500" />
          <span>
            تعليق المنظمة بالكامل
            <span className="block text-xs text-slate-500">يمنع كل أعضاء «{user.organization.name}» ويوقف ردود البوت وربط الأرقام.</span>
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <CancelButton onClose={onClose} />
          <Submit label="تأكيد التعطيل" tone="danger" />
        </div>
      </form>
    </Modal>
  );
}

function UnbanDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [state, action] = useActionState(unbanUserAction, null);
  useCloseOnSuccess(state, onClose);

  return (
    <Modal title="رفع التعطيل" onClose={onClose}>
      <form action={action}>
        <input type="hidden" name="userId" value={user.id} />
        <Target user={user} />
        {user.banned?.reason ? <p className="mb-4 text-sm text-slate-400">سبب التعطيل: {user.banned.reason}</p> : null}
        <p className="mb-4 text-sm leading-6 text-slate-400">
          سيستعيد المستخدم{user.organization.suspended ? ' وكامل المنظمة' : ''} إمكانية الدخول واستخدام الخدمة.
        </p>
        <FormError message={state && !state.ok ? state.error : undefined} />
        <div className="flex justify-end gap-2">
          <CancelButton onClose={onClose} />
          <Submit label="رفع التعطيل" tone="primary" />
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ subscription */

const PLAN_OPTIONS = [
  { value: 'STARTER', label: 'Starter' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'نشط' },
  { value: 'PAST_DUE', label: 'متأخر الدفع' },
  { value: 'CANCELED', label: 'ملغى' },
];

function PlanDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [state, action] = useActionState(changeSubscriptionAction, null);
  const [period, setPeriod] = useState<'keep' | 'days' | 'unlimited'>('keep');
  useCloseOnSuccess(state, onClose);
  const sub = user.subscription;

  if (state?.ok && state.warnings?.length) {
    return (
      <Modal title="تم تحديث الاشتراك" onClose={onClose}>
        <ul className="mb-6 space-y-2">
          {state.warnings.map((w) => (
            <li key={w} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm leading-6 text-amber-200">
              {w}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <CancelButton onClose={onClose} label="إغلاق" />
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="تعديل الاشتراك" onClose={onClose}>
      <form action={action}>
        <input type="hidden" name="userId" value={user.id} />
        <Target user={user} />
        <FormError message={state && !state.ok ? state.error : undefined} />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL} htmlFor={`plan-${user.id}`}>
              الباقة
            </label>
            <select id={`plan-${user.id}`} name="planTier" defaultValue={sub?.planTier ?? 'STARTER'} className={INPUT}>
              {PLAN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor={`status-${user.id}`}>
              الحالة
            </label>
            <select id={`status-${user.id}`} name="status" defaultValue={sub?.status ?? 'ACTIVE'} className={INPUT}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="mb-4">
          <legend className={LABEL}>مدة الاشتراك</legend>
          <div className="space-y-2 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input type="radio" name="period" value="keep" checked={period === 'keep'} onChange={() => setPeriod('keep')} className="accent-emerald-500" />
              إبقاء الفترة الحالية
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="period" value="days" checked={period === 'days'} onChange={() => setPeriod('days')} className="accent-emerald-500" />
              فترة جديدة لمدة
              <input
                type="number"
                name="periodDays"
                min={1}
                max={3650}
                defaultValue={30}
                disabled={period !== 'days'}
                aria-label="عدد الأيام"
                dir="ltr"
                className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-white disabled:opacity-40"
              />
              يوم
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="period" value="unlimited" checked={period === 'unlimited'} onChange={() => setPeriod('unlimited')} className="accent-emerald-500" />
              بدون تاريخ انتهاء
            </label>
          </div>
        </fieldset>

        {sub && sub.provider !== 'MANUAL' ? (
          <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-200">
            هذا الاشتراك مُدار عبر {sub.provider === 'STRIPE' ? 'Stripe' : 'Paddle'}؛ قد تُعيد بوابة الدفع الكتابة فوق التعديل اليدوي.
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <CancelButton onClose={onClose} />
          <Submit label="حفظ التغييرات" tone="primary" />
        </div>
      </form>
    </Modal>
  );
}
