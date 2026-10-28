import type { AdminUser } from '@/lib/adminTypes';
import { formatDate } from '@/lib/format';
import { AccountBadge, PlanBadge, SubscriptionBadge } from './StatusBadges';
import { UserActions } from './UserActions';
import { EmptyState } from './ui';

function Instances({ user, evolutionAvailable }: { user: AdminUser; evolutionAvailable: boolean }) {
  const { total, connected } = user.instances;
  if (total === 0) return <span className="text-slate-600">0</span>;
  return (
    <span className="text-slate-200" dir="ltr">
      {evolutionAvailable && connected !== null ? (
        <>
          <span className={connected > 0 ? 'text-emerald-400' : 'text-slate-400'}>{connected}</span>
          <span className="text-slate-600"> / </span>
          {total}
        </>
      ) : (
        total
      )}
    </span>
  );
}

export function UsersTable({
  users,
  currentUserId,
  evolutionAvailable,
}: {
  users: AdminUser[];
  currentUserId?: string;
  evolutionAvailable: boolean;
}) {
  if (users.length === 0) return <EmptyState>لا يوجد مستخدمون مطابقون للبحث.</EmptyState>;

  const th = 'px-4 py-3 text-right text-xs font-medium text-slate-500';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] text-sm">
        <thead className="border-b border-slate-800 bg-slate-900/60">
          <tr>
            <th className={th}>المستخدم</th>
            <th className={th}>الباقة</th>
            <th className={th} title="المتصل / الإجمالي">
              أرقام واتساب
            </th>
            <th className={th}>الاشتراك</th>
            <th className={th}>الحساب</th>
            <th className={th}>تاريخ التسجيل</th>
            <th className={th}>إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {users.map((u) => (
            <tr key={u.id} className="align-top transition hover:bg-slate-800/30">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-100" dir="ltr" style={{ textAlign: 'right' }}>
                  {u.email}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {u.organization.name} · {u.role === 'ADMIN' ? 'مدير' : 'موظف'}
                </p>
              </td>
              <td className="px-4 py-3">
                <PlanBadge subscription={u.subscription} />
              </td>
              <td className="px-4 py-3">
                <Instances user={u} evolutionAvailable={evolutionAvailable} />
              </td>
              <td className="px-4 py-3">
                <SubscriptionBadge subscription={u.subscription} />
                {u.subscription?.currentPeriodEnd ? (
                  <p className="mt-1 text-[11px] text-slate-500">حتى {formatDate(u.subscription.currentPeriodEnd)}</p>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <AccountBadge user={u} />
                {u.banned?.reason ? <p className="mt-1 max-w-[12rem] truncate text-[11px] text-slate-500" title={u.banned.reason}>{u.banned.reason}</p> : null}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-400">{formatDate(u.createdAt)}</td>
              <td className="px-4 py-3">
                <UserActions user={u} isSelf={u.id === currentUserId} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
