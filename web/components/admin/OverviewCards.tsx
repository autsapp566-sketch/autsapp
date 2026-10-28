import type { Overview } from '@/lib/adminTypes';
import { formatMoney, formatNumber } from '@/lib/format';
import { Icons, StatCard } from './StatCard';
import { SystemStatusBadge } from './StatusBadges';

/** The four headline numbers of the admin overview. */
export function OverviewCards({ overview }: { overview: Overview }) {
  const { users, mrr, whatsapp, system } = overview;
  const toneBySystem = system.status === 'operational' ? 'emerald' : system.status === 'degraded' ? 'amber' : 'red';

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="المستخدمون النشطون"
        icon={Icons.users}
        tone="sky"
        value={formatNumber(users.active)}
        hint={`من أصل ${formatNumber(users.total)} مسجّل · +${formatNumber(users.newLast7Days)} آخر 7 أيام · ${formatNumber(users.banned)} معطّل`}
      />
      <StatCard
        label="الإيرادات الشهرية المتكررة (MRR)"
        icon={Icons.money}
        tone="emerald"
        value={formatMoney(mrr.cents, mrr.currency)}
        hint={`${formatNumber(mrr.payingOrganizations)} منظمة مدفوعة عبر Stripe / Paddle · الاشتراكات اليدوية والتجريبية غير محتسبة`}
      />
      <StatCard
        label="أرقام واتساب المتصلة"
        icon={Icons.phone}
        tone="violet"
        value={whatsapp.connected === null ? '—' : formatNumber(whatsapp.connected)}
        hint={
          whatsapp.connected === null
            ? `تعذّر الاستعلام من Evolution API · ${formatNumber(whatsapp.registered)} رقم مسجّل`
            : `من ${formatNumber(whatsapp.registered)} رقم مسجّل · ${formatNumber(whatsapp.connecting)} قيد الاتصال`
        }
      />
      <StatCard
        label="حالة النظام"
        icon={Icons.pulse}
        tone={toneBySystem}
        value={<SystemStatusBadge status={system.status} />}
        hint="قاعدة البيانات · Evolution API · Redis"
      />
    </div>
  );
}
