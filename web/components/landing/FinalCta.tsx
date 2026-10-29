import Link from 'next/link';
import { TRIAL_DAYS } from '@/lib/plans';

export function FinalCta() {
  return (
    <section className="border-t border-slate-800/80 bg-slate-950 px-4 py-20 sm:px-6 sm:py-24">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-ember-500/30 bg-gradient-to-br from-brand-900/60 via-slate-900 to-slate-900 px-6 py-14 text-center sm:px-12">
        <div className="pointer-events-none absolute -top-24 start-1/4 h-48 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -top-24 end-1/4 h-48 w-72 rounded-full bg-ember-500/25 blur-3xl" />
        <h2 className="relative text-3xl font-bold text-white sm:text-4xl">جاهز لأن يعمل واتساب لصالحك على مدار الساعة؟</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-base leading-8 text-slate-400">
          أنشئ حسابك الآن واستمتع بتجربة مجانية لمدة {TRIAL_DAYS} يومًا. بدون بطاقة ائتمان.
        </p>
        <Link href="/signup" className="relative mt-8 inline-block rounded-xl bg-ember-500 px-10 py-3.5 text-base font-semibold text-white shadow-lg shadow-ember-700/40 transition hover:bg-ember-400">
          ابدأ تجربتك المجانية
        </Link>
      </div>
    </section>
  );
}
