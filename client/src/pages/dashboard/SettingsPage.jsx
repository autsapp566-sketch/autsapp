import { useAuth } from '../../context/AuthContext.jsx';
import VoiceAISettingsView from '../../views/VoiceAISettingsView.jsx';
import GreenApiSettingsView from '../../views/GreenApiSettingsView.jsx';
import HandoffForwardSettings from '../../views/HandoffForwardSettings.jsx';

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">إعدادات الحساب</h2>
        <p className="mt-2 text-sm text-slate-400">معلومات تسجيل الدخول والدور.</p>
      </div>

      <dl className="max-w-lg divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/60">
        <div className="flex justify-between gap-4 px-5 py-4">
          <dt className="text-sm text-slate-400">البريد</dt>
          <dd className="text-sm font-medium text-white" dir="ltr">
            {user?.email}
          </dd>
        </div>
        <div className="flex justify-between gap-4 px-5 py-4">
          <dt className="text-sm text-slate-400">الدور</dt>
          <dd className="text-sm font-medium text-white">{user?.role}</dd>
        </div>
      </dl>

      {isAdmin ? (
        <>
          <HandoffForwardSettings />
          <GreenApiSettingsView embedded />
          <VoiceAISettingsView embedded />
        </>
      ) : null}
    </section>
  );
}
