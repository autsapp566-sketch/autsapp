import Link from 'next/link';
import type { PublicPlan, SubscriptionSummary } from '@/lib/billingApi';
import { formatMoney, formatNumber } from '@/lib/format';
import { ActionForm } from './ActionForm';

export function PlanCards({
  plans,
  current,
  subscription,
  canManage,
}: {
  plans: PublicPlan[];
  current: SubscriptionSummary['plan'];
  subscription: SubscriptionSummary['subscription'];
  /** Tenant ADMIN, not impersonating. */
  canManage: boolean;
}) {
  const liveOnStripe = subscription?.provider === 'STRIPE' && subscription.status !== 'CANCELED';
  const paidUp = subscription?.status === 'ACTIVE';

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = current?.id === plan.id;
        const highlight = isCurrent && paidUp;
        return (
          <div
            key={plan.id}
            className={`flex flex-col rounded-2xl border p-6 ${highlight ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/70'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              {highlight ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
                  باقتك الحالية
                </span>
              ) : null}
            </div>
            <p className="mt-3" dir="ltr" style={{ textAlign: 'right' }}>
              {plan.priceMonthlyCents > 0 ? (
                <>
                  <span className="text-3xl font-bold text-white">{formatMoney(plan.priceMonthlyCents, plan.currency)}</span>
                  <span className="text-sm text-slate-500"> / mo</span>
                </>
              ) : (
                <span className="text-xl font-bold text-white">سعر مخصّص</span>
              )}
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-300">
              <li>
                {plan.maxWhatsAppInstances === null ? 'أرقام واتساب غير محدودة' : `${formatNumber(plan.maxWhatsAppInstances)} ${plan.maxWhatsAppInstances === 1 ? 'رقم واتساب' : 'أرقام واتساب'}`}
              </li>
              <li>
                {plan.monthlyAiMessages === null ? 'رسائل ذكاء اصطناعي غير محدودة' : `${formatNumber(plan.monthlyAiMessages)} رسالة ذكاء اصطناعي / شهر`}
              </li>
            </ul>
            <div className="mt-6">
              <PlanAction
                plan={plan}
                highlight={highlight}
                liveOnStripe={liveOnStripe}
                canManage={canManage}
                isCurrent={isCurrent}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlanAction({
  plan,
  highlight,
  liveOnStripe,
  canManage,
  isCurrent,
}: {
  plan: PublicPlan;
  highlight: boolean;
  liveOnStripe: boolean;
  canManage: boolean;
  isCurrent: boolean;
}) {
  if (highlight) return null;

  if (!plan.checkoutAvailable) {
    return (
      <Link href="/#pricing" className="block rounded-xl border border-slate-600 px-5 py-2.5 text-center text-sm font-semibold text-slate-100 transition hover:border-slate-400">
        تواصل مع المبيعات
      </Link>
    );
  }

  const blocked = !canManage;
  const title = blocked ? 'متاح لمدير الحساب فقط' : undefined;

  // Live Stripe subscription: changing plan = proration handled by the Billing Portal, not a 2nd checkout.
  if (liveOnStripe) {
    return (
      <ActionForm action="/api/stripe/portal" label="تغيير الباقة من إدارة الاشتراك" variant="secondary" disabled={blocked} title={title} />
    );
  }

  return (
    <ActionForm
      action="/api/stripe/checkout"
      fields={{ planId: plan.id }}
      label={isCurrent ? 'إعادة تفعيل الاشتراك' : 'اشترك الآن'}
      disabled={blocked}
      title={title}
    />
  );
}
