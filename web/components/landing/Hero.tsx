import Link from 'next/link';
import { TRIAL_DAYS } from '@/lib/plans';

function ChatMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-emerald-500/10 blur-3xl" />
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl shadow-emerald-950/40">
        <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-300 ring-1 ring-emerald-500/30">م</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">متجر الأناقة</p>
            <p className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              المساعد الذكي يرد الآن
            </p>
          </div>
        </div>

        <div className="space-y-3 px-5 py-6 text-sm">
          <div className="max-w-[85%] rounded-2xl rounded-ss-md bg-slate-800 px-4 py-3 text-slate-200">
            السلام عليكم، هل عندكم الحذاء الرياضي بمقاس 42؟ وكم سعره؟
          </div>
          <div className="me-auto max-w-[85%] rounded-2xl rounded-se-md bg-emerald-600 px-4 py-3 text-white">
            وعليكم السلام 👋 نعم، المقاس 42 متوفر باللونين الأسود والأبيض بسعر 320 ر.س. هل أحجز لك زوجًا؟
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-ss-md bg-slate-800 px-4 py-3 text-slate-200">
            ممتاز، الأسود. أريد التوصيل إلى الرياض.
          </div>
          <div className="me-auto max-w-[85%] rounded-2xl rounded-se-md bg-emerald-600 px-4 py-3 text-white">
            تم تسجيل طلبك ✅ سأحوّلك الآن لأحد موظفينا لتأكيد العنوان.
          </div>
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-300">
            <span aria-hidden>🔔</span> عميل مؤهَّل — تم التحويل لفريق المبيعات
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(16,185,129,0.16),transparent)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
        <div className="animate-fade-up text-center lg:text-start">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-300 lg:mx-0">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            مدعوم بالذكاء الاصطناعي · يعمل على واتساب
          </p>

          <h1 className="mt-6 text-4xl font-bold leading-[1.25] tracking-tight text-white sm:text-5xl lg:text-6xl">
            أتمتة محادثات الواتساب بالذكاء الاصطناعي لمشروعك
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-slate-400 sm:text-lg lg:mx-0">
            مساعد ذكي يرد على عملائك فورًا على مدار الساعة، يؤهّل العملاء المحتملين، ويسلّم المحادثة لفريقك في اللحظة المناسبة — دون أن تفوّت فرصة بيع واحدة.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link href="/signup" className="w-full rounded-xl bg-emerald-600 px-8 py-3.5 text-center text-base font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 sm:w-auto">
              ابدأ تجربتك المجانية
            </Link>
            <a href="#pricing" className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-8 py-3.5 text-center text-base font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 sm:w-auto">
              شاهد الأسعار
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500 lg:justify-start">
            {[`تجربة مجانية ${TRIAL_DAYS} يومًا`, 'بدون بطاقة ائتمان', 'إعداد خلال دقائق'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-emerald-500" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <ChatMockup />
      </div>
    </section>
  );
}
