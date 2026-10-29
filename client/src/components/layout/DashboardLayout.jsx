import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLeadNotifications } from '../../hooks/useLeadNotifications.js';
import { useLeadSoundAlerts } from '../../hooks/useLeadSoundAlerts.js';
import { useAdminAlerts } from '../../hooks/useAdminAlerts.js';
import SoundSettingsPanel from './SoundSettingsPanel.jsx';
import ImpersonationBanner from './ImpersonationBanner.jsx';
import { canOpenPage, PAGE_ACCESS } from '../../lib/access.js';
import { BrandLockup } from '../LogoMark.jsx';

const mainNavItems = [
  { to: '/dashboard', end: true, label: 'الرئيسية والتحليلات', icon: '▣' },
  { to: '/dashboard/qualified', label: 'إدارة الطلبات والعملاء', icon: '◉' },
  { to: '/dashboard/chats', label: 'محادثات الواتساب الحية', icon: '💬' },
  { to: '/dashboard/knowledge', label: 'الكتالوج والأسئلة (Knowledge)', icon: '📚' },
  { to: '/dashboard/playground', label: 'اختبار البوت (Playground)', icon: '🧪' },
  { to: '/dashboard/whatsapp', label: 'ربط أرقام واتساب', icon: '📱' },
  { to: '/dashboard/team', label: 'الفريق والصلاحيات', icon: '👥' },
];

const settingsNavItems = [
  { to: '/dashboard/docs', label: 'التوثيق ودليل الاستعمال', icon: '📖' },
  { to: '/dashboard/settings', label: 'إعدادات الحساب', icon: '⚙' },
];

function visibleNavItems(user, items) {
  return items.filter((item) => {
    const page = PAGE_ACCESS.find((p) => p.to === item.to);
    return page ? canOpenPage(user, page) : true;
  });
}

const roleLabels = {
  ADMIN: 'مدير النظام',
  CONFIRMATION_AGENT: 'وكيل التأكيد',
};

function NavItem({ to, end, label, icon }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition',
          isActive
            ? 'bg-ember-500/15 text-ember-400 ring-1 ring-ember-500/30'
            : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100',
        ].join(' ')
      }
    >
      <span className="text-lg leading-none" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}

/**
 * The billing page is a server-rendered page of the Next.js gateway (/dashboard/billing), not a
 * route of this SPA, so it needs a real navigation instead of a client-side <NavLink>.
 */
function BillingLink() {
  return (
    <a
      href="/dashboard/billing"
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-100"
    >
      <span className="text-lg leading-none" aria-hidden>
        💳
      </span>
      <span>الاشتراك والفوترة</span>
    </a>
  );
}

/** Platform control lives on the Next.js /admin app, so this is a full navigation, not an SPA route. */
function PlatformLink() {
  return (
    <a
      href="/admin"
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-200/90 transition hover:bg-red-500/10 hover:text-red-100"
    >
      <span className="text-lg leading-none" aria-hidden>
        🛡
      </span>
      <span>لوحة التحكم</span>
    </a>
  );
}

export default function DashboardLayout() {
  const { user, logout, impersonation } = useAuth();
  const navigate = useNavigate();
  const { alert, dismissAlert } = useLeadNotifications();
  const { adminAlerts, dismissAdminAlerts } = useAdminAlerts();
  const { soundEnabled, toggleSound, prefs, setRingtone, previewRingtone, banner, dismissBanner } =
    useLeadSoundAlerts();

  function handleLogout() {
    // In gateway mode logout() redirects the whole page to the Next.js login itself.
    if (!logout()) {
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100" dir="rtl">
      <aside className="hidden w-72 shrink-0 border-s border-slate-800 bg-slate-900/90 lg:flex lg:flex-col">
        <div className="border-b border-slate-800 px-6 py-5">
          <BrandLockup />
          <h1 className="mt-3 text-lg font-bold text-white">لوحة التأهيل والتسليم</h1>
          <p className="mt-1 text-[11px] text-slate-500">الإعدادات من لوحة التحكم</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {visibleNavItems(user, mainNavItems).map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          <p className="mb-1 mt-4 px-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            الإعدادات
          </p>
          {visibleNavItems(user, settingsNavItems).map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          {user?.role === 'ADMIN' ? <BillingLink /> : null}
          {user?.platformRole === 'SUPER_ADMIN' && !impersonation ? (
            <>
              <PlatformLink />
            </>
          ) : null}
        </nav>
        <div className="border-t border-slate-800 p-4 text-xs text-slate-500">
          OpenAI والصوت والبرومبت من إعدادات الحساب
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {impersonation ? <ImpersonationBanner email={user?.email} /> : null}
        <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div>
              <p className="text-sm text-slate-400">مرحباً</p>
              <p className="font-semibold text-white">{user?.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-300">
                {roleLabels[user?.role] ?? user?.role}
              </span>
              {user?.platformRole === 'SUPER_ADMIN' && !impersonation ? (
                <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-300 ring-1 ring-red-500/30">
                  سوبر أدمين
                </span>
              ) : null}
              <span className="hidden rounded-full bg-ember-500/15 px-3 py-1 text-xs text-ember-400 sm:inline">
                البوت: تأهيل أوتوماتيكي
              </span>
              <SoundSettingsPanel
                soundEnabled={soundEnabled}
                toggleSound={toggleSound}
                prefs={prefs}
                setRingtone={setRingtone}
                previewRingtone={previewRingtone}
              />
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-slate-800 px-4 py-2 lg:hidden">
            {user?.platformRole === 'SUPER_ADMIN' && !impersonation ? (
              <a
                href="/admin"
                className="whitespace-nowrap rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-200"
              >
                لوحة التحكم
              </a>
            ) : null}
            {[...visibleNavItems(user, mainNavItems), ...visibleNavItems(user, settingsNavItems)].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium',
                    isActive ? 'bg-ember-500 text-white' : 'bg-slate-800 text-slate-300',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {adminAlerts.length ? (
            <div
              role="alert"
              className="mb-4 space-y-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold">إشعارات النظام (للمدير فقط)</p>
                <button
                  type="button"
                  onClick={dismissAdminAlerts}
                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-medium text-amber-200"
                >
                  تمّ الاطلاع
                </button>
              </div>
              <ul className="space-y-1.5">
                {adminAlerts.slice(0, 3).map((a) => (
                  <li key={a.id} className="leading-relaxed">
                    {a.message}
                  </li>
                ))}
                {adminAlerts.length > 3 ? (
                  <li className="text-xs text-amber-200/80">+ {adminAlerts.length - 3} إشعارات أخرى</li>
                ) : null}
              </ul>
            </div>
          ) : null}
          {banner ? (
            <div
              role="alert"
              className={[
                'mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold',
                banner.kind === 'human'
                  ? 'border-red-500/50 bg-red-500/15 text-red-100'
                  : 'border-violet-500/40 bg-violet-500/15 text-violet-100',
              ].join(' ')}
            >
              <span>{banner.text}</span>
              <span className="flex gap-2">
                <NavLink
                  to="/dashboard/chats"
                  onClick={dismissBanner}
                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-medium text-white"
                >
                  فتح المحادثات
                </NavLink>
                <button
                  type="button"
                  onClick={dismissBanner}
                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200"
                >
                  إغلاق
                </button>
              </span>
            </div>
          ) : null}
          {alert ? (
            <div
              role="status"
              className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100"
            >
              <div>
                <p className="font-semibold">{alert.message}</p>
                <p className="mt-1 text-cyan-200/90">
                  {alert.lead?.name ?? alert.lead?.phone} — {alert.lead?.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={dismissAlert}
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-medium text-cyan-300"
              >
                إغلاق
              </button>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
