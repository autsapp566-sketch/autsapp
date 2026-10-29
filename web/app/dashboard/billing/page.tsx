import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Alert } from '@/components/auth/ui';
import { ActionForm } from '@/components/billing/ActionForm';
import { CheckoutPoller } from '@/components/billing/CheckoutPoller';
import { PlanCards } from '@/components/billing/PlanCards';
import { UsageMeter } from '@/components/billing/UsageMeter';
import { Logo } from '@/components/Logo';
import {
  billingFetch,
  type MeResponse,
  type PublicPlan,
  type SubscriptionSummary,
} from '@/lib/billingApi';
import { formatDate, formatMoney } from '@/lib/format';
import { resolveDashboardToken } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'الاشتراك والفوترة', robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

const ERRORS: Record<string, string> = {
  already_subscribed: 'لديك اشتراك فعّال بالفعل. لتغيير الباقة أو وسيلة الدفع استخدم «إدارة الاشتراك».',
  not_purchasable: 'هذه الباقة غير متاحة للشراء المباشر — تواصل مع فريق المبيعات.',
  no_account: 'لا يوجد حساب فوترة بعد. اشترك في إحدى الباقات أولاً.',
  forbidden: 'هذا الإجراء متاح لمدير الحساب فقط.',
  impersonating: 'لا يمكن تنفيذ عمليات الدفع أثناء وضع الانتحال.',
  invalid: 'طلب غير صالح.',
  unavailable: 'بوابة الدفع غير مفعّلة حالياً. حاول لاحقاً.',
  failed: 'تعذّر الاتصال ببوابة الدفع. حاول مرة أخرى بعد قليل.',
};

const BLOCK_REASONS: Record<string, string> = {
  NO_SUBSCRIPTION: 'لا يوجد اشتراك فعّال على هذا الحساب.',
  SUBSCRIPTION_CANCELED: 'تم إلغاء الاشتراك. اختر باقة لإعادة التفعيل.',
  SUBSCRIPTION_PAST_DUE: 'فشلت عملية الدفع الأخيرة. حدّث وسيلة الدفع من «إدارة الاشتراك» لاستعادة الخدمة.',
  SUBSCRIPTION_EXPIRED: 'انتهت فترة الاشتراك. جدّد اشتراكك لاستعادة الخدمة.',
  ACCOUNT_SUSPENDED: 'تم تعليق هذا الحساب من قِبل إدارة المنصة.',
};

const STATUS_BADGE = {
  ACTIVE: { label: 'نشط', cls: 'bg-cyan-500/10 text-cyan-300 ring-cyan-500/30' },
  PAST_DUE: { label: 'متأخر الدفع', cls: 'bg-amber-500/10 text-amber-300 ring-amber-500/30' },
  CANCELED: { label: 'ملغى', cls: 'bg-red-500/10 text-red-300 ring-red-500/30' },
} as const;

function renewalLine(sub: NonNullable<SubscriptionSummary['subscription']>, active: boolean): string {
  if (sub.status === 'CANCELED') return sub.canceledAt ? `أُلغي في ${formatDate(sub.canceledAt)}` : 'ملغى';
  if (!sub.currentPeriodEnd) return 'بدون تاريخ انتهاء';
  const date = formatDate(sub.currentPeriodEnd);
  if (sub.cancelAtPeriodEnd) return `ينتهي في ${date} ولن يُجدَّد`;
  if (!active) return `انتهت الفترة في ${date}`;
  return sub.provider === 'MANUAL' ? `الفترة الحالية تنتهي في ${date}` : `يتجدد في ${date}`;
}

export default async function BillingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const checkout = one(sp.checkout);
  const error = ERRORS[one(sp.error)];

  // Impersonating super admins see the TENANT's billing (read-only); everyone else sees their own.
  const resolved = await resolveDashboardToken(await headers());
  if (!resolved) redirect('/login?callbackUrl=/dashboard/billing');

  const [summary, plans, me] = await Promise.all([
    billingFetch<SubscriptionSummary>('/api/billing/subscription', resolved.token),
    billingFetch<{ plans: PublicPlan[] }>('/api/billing/plans', resolved.token),
    billingFetch<MeResponse>('/api/auth/me', resolved.token),
  ]);

  if (!summary.ok && summary.status === 401) redirect('/login?callbackUrl=/dashboard/billing');

  const isAdmin = me.ok && me.data.user.role === 'ADMIN';
  const impersonating = resolved.impersonating;
  const canManage = isAdmin && !impersonating;

  const data = summary.ok ? summary.data : null;
  const sub = data?.subscription ?? null;
  const plan = data?.plan ?? null;
  // Just back from Stripe but the webhook hasn't landed yet.
  const awaitingWebhook = checkout === 'success' && sub?.provider !== 'STRIPE';

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Logo />
          <Link href="/dashboard" className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white">
            ← العودة إلى لوحة التحكم
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-white">الاشتراك والفوترة</h1>
          <p className="mt-1 text-sm text-slate-400">باقتك الحالية، تاريخ التجديد، واستهلاكك من حدود الباقة.</p>
        </div>

        {impersonating ? <Alert tone="info">وضع الانتحال: أنت تعرض فوترة هذا الحساب للقراءة فقط.</Alert> : null}
        {checkout === 'success' ? (
          awaitingWebhook ? (
            <>
              <Alert tone="info">تمت عملية الدفع بنجاح — جارٍ تفعيل اشتراكك، لحظات…</Alert>
              <CheckoutPoller />
            </>
          ) : (
            <Alert tone="success">تم تفعيل اشتراكك بنجاح. شكراً لثقتك!</Alert>
          )
        ) : null}
        {checkout === 'canceled' ? <Alert tone="info">تم إلغاء عملية الدفع — لم يتم خصم أي مبلغ.</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {!summary.ok ? <Alert tone="error">{summary.error}</Alert> : null}

        {data && sub && plan ? (
          <>
            {!data.active && data.reason ? <Alert tone="error">{BLOCK_REASONS[data.reason] ?? 'الخدمة متوقفة على هذا الحساب.'}</Alert> : null}

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">الباقة الحالية</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <h2 className="text-3xl font-bold text-white">{plan.name}</h2>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_BADGE[sub.status].cls}`}>
                      {STATUS_BADGE[sub.status].label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300" dir="ltr" style={{ textAlign: 'right' }}>
                    {plan.priceMonthlyCents > 0 ? `${formatMoney(plan.priceMonthlyCents, plan.currency)} / month` : 'سعر مخصّص'}
                    {sub.provider === 'MANUAL' ? ' · ' : ''}
                    {sub.provider === 'MANUAL' ? 'اشتراك يدوي / تجريبي' : ''}
                  </p>
                  <p className="mt-3 text-sm text-slate-400">
                    <span className="text-slate-500">التجديد: </span>
                    <span className="font-medium text-slate-200">{renewalLine(sub, data.active)}</span>
                  </p>
                </div>

                <div className="w-full sm:w-56">
                  {sub.portalAvailable ? (
                    <ActionForm
                      action="/api/stripe/portal"
                      label="إدارة الاشتراك"
                      variant="secondary"
                      disabled={!canManage}
                      title={canManage ? undefined : 'متاح لمدير الحساب فقط'}
                    />
                  ) : (
                    <p className="text-xs leading-5 text-slate-500">ستظهر «إدارة الاشتراك» (الفواتير ووسيلة الدفع والإلغاء) بعد أول اشتراك مدفوع.</p>
                  )}
                </div>
              </div>
            </section>

            {data.usage ? (
              <section aria-label="الاستهلاك" className="grid gap-4 md:grid-cols-2">
                <UsageMeter
                  label="أرقام واتساب المرتبطة"
                  used={data.usage.whatsappInstances.used}
                  limit={data.usage.whatsappInstances.limit}
                  unit="رقم"
                />
                <UsageMeter
                  label="رسائل الذكاء الاصطناعي هذه الفترة"
                  used={data.usage.aiMessages.used}
                  limit={data.usage.aiMessages.limit}
                  unit="رسالة"
                  footnote={`يُعاد العدّاد في ${formatDate(data.usage.aiMessages.periodEnd)}`}
                />
              </section>
            ) : null}
          </>
        ) : null}

        {plans.ok ? (
          <section>
            <h2 className="mb-4 text-lg font-bold text-white">الباقات المتاحة</h2>
            <PlanCards plans={plans.data.plans} current={plan} subscription={sub} canManage={canManage} />
            <p className="mt-4 text-xs text-slate-500">الدفع عبر Stripe — لا نخزّن بيانات بطاقتك. يمكنك الإلغاء في أي وقت من «إدارة الاشتراك».</p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
