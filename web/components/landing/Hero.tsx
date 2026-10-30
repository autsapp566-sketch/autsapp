import Link from 'next/link';
import { ProductStage } from '@/components/landing/ProductStage';
import { TRIAL_DAYS } from '@/lib/plans';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(42%_55%_at_18%_0%,rgba(46,212,222,0.16),transparent),radial-gradient(42%_55%_at_82%_0%,rgba(242,107,29,0.16),transparent)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
        <div className="animate-fade-up text-center lg:text-start">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium text-cyan-300 lg:mx-0">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            مدعوم بالذكاء الاصطناعي · يعمل على واتساب
          </p>

          <h1 className="mt-6 text-4xl font-bold leading-[1.25] tracking-tight text-white sm:text-5xl lg:text-6xl">
            أتمتة محادثات الواتساب بالذكاء الاصطناعي لمشروعك
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-slate-400 sm:text-lg lg:mx-0">
            مساعد ذكي يرد على عملائك فورًا على مدار الساعة، يؤهّل العملاء المحتملين، ويسلّم المحادثة لفريقك في اللحظة المناسبة — دون أن تفوّت فرصة بيع واحدة.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link href="/signup" className="w-full rounded-xl bg-ember-500 px-8 py-3.5 text-center text-base font-semibold text-white shadow-lg shadow-ember-700/40 transition hover:bg-ember-400 sm:w-auto">
              ابدأ تجربتك المجانية
            </Link>
            <a href="#pricing" className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-8 py-3.5 text-center text-base font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 sm:w-auto">
              شاهد الأسعار
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500 lg:justify-start">
            {[`تجربة مجانية ${TRIAL_DAYS} يومًا`, 'بدون بطاقة ائتمان', 'إعداد خلال دقائق'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-cyan-500" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <ProductStage />
      </div>
    </section>
  );
}
