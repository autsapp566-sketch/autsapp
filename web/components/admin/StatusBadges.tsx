import type { AdminUser, SubscriptionStatus, SystemStatus } from '@/lib/adminTypes';
import { Badge, type Tone } from './ui';

const SYSTEM: Record<SystemStatus, { tone: Tone; label: string }> = {
  operational: { tone: 'emerald', label: 'يعمل بشكل طبيعي' },
  degraded: { tone: 'amber', label: 'أداء متدهور' },
  down: { tone: 'red', label: 'متوقف' },
};

export function SystemStatusBadge({ status }: { status: SystemStatus }) {
  const s = SYSTEM[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

const SUB: Record<SubscriptionStatus, { tone: Tone; label: string }> = {
  ACTIVE: { tone: 'emerald', label: 'نشط' },
  PAST_DUE: { tone: 'amber', label: 'متأخر الدفع' },
  CANCELED: { tone: 'red', label: 'ملغى' },
};

const PROVIDER: Record<string, string> = { STRIPE: 'Stripe', PADDLE: 'Paddle', MANUAL: 'يدوي' };

export function SubscriptionBadge({ subscription }: { subscription: AdminUser['subscription'] }) {
  if (!subscription) return <Badge tone="slate">بدون اشتراك</Badge>;
  const base = SUB[subscription.status];
  if (subscription.effective.reason === 'ACCOUNT_SUSPENDED') {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <Badge tone="red" dot>
          معلّق من الإدارة
        </Badge>
        <span className="text-[11px] text-slate-500">{PROVIDER[subscription.provider] ?? subscription.provider}</span>
      </span>
    );
  }
  // ACTIVE on paper but the paid period has lapsed (beyond the grace window): flag it.
  const lapsed = subscription.status === 'ACTIVE' && !subscription.effective.active;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Badge tone={lapsed ? 'amber' : base.tone} dot>
        {lapsed ? 'منتهي الفترة' : base.label}
      </Badge>
      <span className="text-[11px] text-slate-500">{PROVIDER[subscription.provider] ?? subscription.provider}</span>
    </span>
  );
}

export function PlanBadge({ subscription }: { subscription: AdminUser['subscription'] }) {
  if (!subscription) return <span className="text-slate-600">—</span>;
  const tone: Tone = subscription.planTier === 'ENTERPRISE' ? 'violet' : subscription.planTier === 'PROFESSIONAL' ? 'sky' : 'slate';
  return <Badge tone={tone}>{subscription.planName}</Badge>;
}

export function AccountBadge({ user }: { user: AdminUser }) {
  if (user.banned) return <Badge tone="red" dot>معطّل</Badge>;
  if (user.organization.suspended) return <Badge tone="red" dot>منظمة معلّقة</Badge>;
  if (!user.emailVerified) return <Badge tone="amber" dot>بريد غير مؤكد</Badge>;
  return <Badge tone="emerald" dot>فعّال</Badge>;
}
