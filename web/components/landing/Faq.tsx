'use client';

import { useId, useState } from 'react';

const faqs = [
  {
    q: 'كيف أربط رقم الواتساب الخاص بي؟',
    a: 'من لوحة التحكم تضيف رقمًا جديدًا وتمسح رمز QR بهاتفك تمامًا كما تفعل مع واتساب ويب. لا تحتاج إلى أي معرفة تقنية، ويستغرق الأمر دقائق.',
  },
  {
    q: 'هل يمكنني التدخل في المحادثة بنفسي؟',
    a: 'نعم. يمكنك إيقاف المساعد الذكي على أي محادثة بنقرة واحدة والرد يدويًا، ثم إعادة تشغيله لاحقًا. كما يحوّل المساعد المحادثة تلقائيًا إلى فريقك عندما يحتاج العميل لإنسان.',
  },
  {
    q: 'ما المقصود بـ«رسائل الذكاء الاصطناعي» في كل باقة؟',
    a: 'هي عدد الردود التي يولّدها المساعد شهريًا. رسائل الموظفين البشريين لا تُحتسب. وإذا اقتربت من الحد يمكنك الترقية في أي وقت.',
  },
  {
    q: 'هل بيانات عملائي آمنة ومعزولة عن غيري؟',
    a: 'كل مشروع يعمل في مساحة معزولة بالكامل: أرقامه ومحادثاته وعملاؤه وقاعدة معرفته لا يراها أي حساب آخر. كلمات المرور مشفّرة بخوارزمية bcrypt ولا نخزّنها نصًا.',
  },
  {
    q: 'هل أحتاج إلى بطاقة ائتمان للتجربة المجانية؟',
    a: 'لا. تبدأ تجربتك المجانية لمدة 14 يومًا فور إنشاء حسابك (بحدود باقة Starter)، دون إدخال أي بيانات دفع.',
  },
  {
    q: 'هل يمكنني إلغاء الاشتراك في أي وقت؟',
    a: 'بالتأكيد. لا توجد عقود طويلة الأجل؛ يمكنك تغيير الباقة أو الإلغاء متى شئت، وتبقى الخدمة فعّالة حتى نهاية الفترة المدفوعة.',
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id="faq" className="border-t border-slate-800/80 bg-slate-900/30 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-emerald-400">الأسئلة الشائعة</p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">إجابات لأكثر ما يُسأل عنه</h2>
        </div>

        <div className="mt-12 divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
          {faqs.map((item, i) => {
            const open = openIndex === i;
            const buttonId = `${baseId}-btn-${i}`;
            const panelId = `${baseId}-panel-${i}`;
            return (
              <div key={item.q}>
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-start text-base font-semibold text-white transition hover:bg-slate-800/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500"
                  >
                    {item.q}
                    <svg viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 text-emerald-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <path d="m5 8 5 5 5-5" />
                    </svg>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-6 text-sm leading-7 text-slate-400">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
