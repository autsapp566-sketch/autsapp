import type { ReactNode } from 'react';

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);

const features = [
  {
    title: 'ردود ذكية بالذكاء الاصطناعي',
    body: 'يفهم المساعد سؤال العميل ويجيب من كتالوج منتجاتك وأسئلتك الشائعة بلهجة تناسب علامتك — نصًا وصوتًا وحتى من صورة المنتج.',
    icon: icon(<><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><rect x="7" y="7" width="10" height="10" rx="3" /><path d="M10 12h.01M14 12h.01" /></>),
  },
  {
    title: 'دعم عدة أرقام واتساب',
    body: 'اربط أكثر من رقم لفروعك أو علاماتك التجارية، وأدِر كل المحادثات من لوحة واحدة مع عزل كامل للبيانات بين الأرقام.',
    icon: icon(<><rect x="6" y="3" width="12" height="18" rx="3" /><path d="M10 18h4" /></>),
  },
  {
    title: 'تدخّل الموظف المباشر',
    body: 'أوقف البوت على أي محادثة بنقرة وتسلّم الحوار بنفسك، ثم أعده للعمل متى شئت. فريقك يتلقى تنبيهًا فوريًا عند حاجة العميل لإنسان.',
    icon: icon(<><path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M21 20v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>),
  },
  {
    title: 'توليد العملاء المحتملين',
    body: 'يطرح البوت الأسئلة الصحيحة، يلتقط الاسم والطلب والنية، ويصنّف كل عميل (جديد، مؤهَّل، محوَّل) لتركّز فريقك على من سيشتري فعلًا.',
    icon: icon(<><path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z" /></>),
  },
];

export function Features() {
  return (
    <section id="features" className="border-t border-slate-800/80 bg-slate-950 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-cyan-400">المميزات</p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">كل ما تحتاجه لتحويل واتساب إلى قناة مبيعات</h2>
          <p className="mt-4 text-base leading-8 text-slate-400">أدوات مصمَّمة لفرق المبيعات والدعم التي تعيش داخل المحادثة.</p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {features.map((f) => (
            <article key={f.title} className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-7 transition hover:border-cyan-500/40 hover:bg-slate-900">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20 transition group-hover:bg-cyan-500/15">
                {f.icon}
              </span>
              <h3 className="mt-5 text-lg font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
