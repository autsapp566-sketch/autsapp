// PLACEHOLDER CONTENT: replace with real, permissioned customer quotes before launch.
const testimonials = [
  {
    quote: 'كنا نخسر طلبات كثيرة خارج ساعات العمل. الآن يرد المساعد خلال ثوانٍ، ويصلنا العميل جاهزًا للإغلاق.',
    name: 'سارة المطيري',
    role: 'مديرة متجر إلكتروني للأزياء',
  },
  {
    quote: 'ربطنا ثلاثة أرقام لفروعنا وصارت كل المحادثات في مكان واحد. التحويل للموظف بنقرة واحدة وفّر علينا وقتًا كبيرًا.',
    name: 'خالد العمري',
    role: 'مدير عمليات في سلسلة مطاعم',
  },
  {
    quote: 'أكثر ما أعجبني تصنيف العملاء تلقائيًا. فريق المبيعات لم يعد يضيع وقته مع من لا ينوي الشراء.',
    name: 'ليلى بنعلي',
    role: 'مؤسِّسة وكالة عقارية',
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="border-t border-slate-800/80 bg-slate-950 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-emerald-400">آراء العملاء</p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">فرق تثق بنا في محادثات عملائها</h2>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-7">
              <div>
                <div className="flex gap-0.5 text-amber-400" aria-label="تقييم 5 من 5" role="img">
                  {Array.from({ length: 5 }, (_, i) => (
                    <svg key={i} viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                      <path d="m10 1.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9L10 1.5Z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="mt-4 text-sm leading-7 text-slate-300">“{t.quote}”</blockquote>
              </div>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-800 pt-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                  {t.name.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
