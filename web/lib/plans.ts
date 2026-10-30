/**
 * Marketing copy for the pricing table. Limits mirror the API plans (src/services/billing/plans.js);
 * prices are in Moroccan dirhams — change both together when final pricing is decided.
 */
export type PlanId = 'starter' | 'professional' | 'enterprise';
export type BillingInterval = 'monthly' | 'annual';

export type MarketingPlan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Dirhams per month when paid monthly. `null` = custom quote. */
  monthly: number | null;
  /** Annual billing = 10 months for the price of 12. */
  highlight?: boolean;
  features: string[];
};

export const ANNUAL_MONTHS_PAID = 10;
export const TRIAL_DAYS = 14;

export const PLANS: MarketingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'للمشاريع التي تبدأ رحلتها مع الأتمتة',
    monthly: 290,
    features: ['رقم واتساب واحد', '1,000 رسالة ذكاء اصطناعي شهريًا', 'تأهيل العملاء المحتملين تلقائيًا', 'قاعدة معرفة للمنتجات والأسئلة', 'دعم عبر البريد الإلكتروني'],
  },
  {
    id: 'professional',
    name: 'Pro',
    tagline: 'للفرق التي تدير أكثر من نشاط أو فرع',
    monthly: 790,
    highlight: true,
    features: ['3 أرقام واتساب', '5,000 رسالة ذكاء اصطناعي شهريًا', 'تحويل المحادثة لموظف بنقرة واحدة', 'فريق متعدد الموظفين بصلاحيات', 'تحليلات المبيعات والتأهيل', 'دعم أولوية'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'للشركات ذات الحجم الكبير والاحتياجات الخاصة',
    monthly: null,
    features: ['أرقام واتساب غير محدودة', 'رسائل ذكاء اصطناعي غير محدودة', 'إعداد وتهيئة مخصصة', 'مدير حساب مخصص', 'اتفاقية مستوى خدمة (SLA)'],
  },
];

export function priceFor(plan: MarketingPlan, interval: BillingInterval) {
  if (plan.monthly === null) return null;
  const perMonth = interval === 'annual' ? (plan.monthly * ANNUAL_MONTHS_PAID) / 12 : plan.monthly;
  return {
    perMonth: Math.round(perMonth),
    billedYearly: interval === 'annual' ? plan.monthly * ANNUAL_MONTHS_PAID : null,
  };
}
