import { useEffect, useMemo, useState } from 'react';

/* ---------------------------------------------------------------- small building blocks */

function H({ children }) {
  return <h4 className="mb-2 mt-6 text-base font-bold text-white first:mt-0">{children}</h4>;
}

function P({ children }) {
  return <p className="mb-3 text-sm leading-7 text-slate-300">{children}</p>;
}

function UL({ items }) {
  return (
    <ul className="mb-4 list-disc space-y-1.5 pe-1 ps-6 text-sm leading-7 text-slate-300 marker:text-emerald-500">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function OL({ items }) {
  return (
    <ol className="mb-4 list-decimal space-y-1.5 pe-1 ps-6 text-sm leading-7 text-slate-300 marker:font-bold marker:text-emerald-400">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

const NOTE_STYLES = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
  tip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
};
const NOTE_ICONS = { info: 'ℹ️', tip: '💡', warn: '⚠️' };

function Note({ kind = 'info', children }) {
  return (
    <div className={`mb-4 flex gap-3 rounded-xl border px-4 py-3 text-sm leading-7 ${NOTE_STYLES[kind]}`}>
      <span aria-hidden>{NOTE_ICONS[kind]}</span>
      <div>{children}</div>
    </div>
  );
}

function Code({ children }) {
  return (
    <code dir="ltr" className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[12px] text-emerald-300">
      {children}
    </code>
  );
}

function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-800 text-slate-300',
    admin: 'bg-amber-500/15 text-amber-300',
    green: 'bg-emerald-500/15 text-emerald-300',
    red: 'bg-red-500/15 text-red-300',
    violet: 'bg-violet-500/15 text-violet-300',
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

/** Vertical pipeline: each step is a numbered card connected by a line. */
function Flow({ steps }) {
  return (
    <ol className="mb-4 space-y-0">
      {steps.map((s, i) => (
        <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
          {i < steps.length - 1 ? (
            <span className="absolute start-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-slate-700" aria-hidden />
          ) : null}
          <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ember-500 text-xs font-bold text-white">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
            <p className="text-sm font-semibold text-white">{s.title}</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-400">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Table({ head, rows }) {
  return (
    <div className="mb-4 overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[480px] text-start text-sm">
        <thead className="bg-slate-900 text-xs text-slate-400">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 text-start font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-2.5 leading-6 ${j === 0 ? 'font-medium text-white' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Boxes connected by arrows, e.g. WhatsApp → Evolution API → Server. */
function Diagram({ nodes }) {
  return (
    <div className="mb-4 flex flex-wrap items-stretch gap-2 text-center" dir="rtl">
      {nodes.map((n, i) => (
        <div key={n.title} className="flex items-center gap-2">
          <div className="min-w-[110px] rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3">
            <p className="text-xl" aria-hidden>
              {n.icon}
            </p>
            <p className="mt-1 text-xs font-bold text-white">{n.title}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{n.text}</p>
          </div>
          {i < nodes.length - 1 ? <span className="text-slate-600">◀</span> : null}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- the documentation content */

const SECTIONS = [
  {
    id: 'overview',
    icon: '🧭',
    title: 'نظرة عامة على النظام',
    keywords: 'مقدمة ما هو النظام معمارية architecture واتساب evolution api openai',
    body: (
      <>
        <P>
          هاد النظام كيخلي <strong className="text-white">بوت ذكي</strong> يجاوب على زبناء المتجر فـ واتساب بالدارجة المغربية،
          يفهم شنو بغاو (حتى لو بعتو نوت صوتي أو إعلان)، يعطيهم معلومات من الكتالوج، ويقيّم شحال جادين فـ الشراء. ملي
          الزبون يكون جاهز، كيتحول للموظفة (وكيل التأكيد) باش تكمل معاه من الداشبورد بحال واتساب عادي.
        </P>
        <H>المكونات</H>
        <Diagram
          nodes={[
            { icon: '📱', title: 'واتساب', text: 'الزبون' },
            { icon: '🟢', title: 'Evolution API', text: 'جسر واتساب (مستضاف عندك)' },
            { icon: '⚙️', title: 'السيرفر (API)', text: 'Express على Vercel' },
            { icon: '🧠', title: 'OpenAI', text: 'الفهم والرد' },
            { icon: '🗄️', title: 'قاعدة البيانات', text: 'PostgreSQL / Supabase' },
            { icon: '🖥️', title: 'الداشبورد', text: 'React' },
          ]}
        />
        <UL
          items={[
            <>
              <strong className="text-white">Evolution API</strong>: خادم واتساب مستضاف عندك؛ كل رقم عبارة عن «جلسة» (instance). كيوصّل الرسائل
              للسيرفر عبر webhook وكيبعت الردود للزبون.
            </>,
            <>
              <strong className="text-white">السيرفر</strong>: كيستقبل الرسائل، كيحفظها، كيستعمل OpenAI، وكيبعت الرد.
            </>,
            <>
              <strong className="text-white">OpenAI</strong>: كيفهم المحادثة (النص، الصوت، صور الإعلانات) ويصيغ الجواب ويعطي تقييم من 1 لـ 10.
            </>,
            <>
              <strong className="text-white">الداشبورد</strong>: واجهة الفريق لمتابعة المحادثات، الاستلام البشري، تعديل الكتالوج وضبط الإعدادات.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'quickstart',
    icon: '🚀',
    title: 'البداية السريعة',
    keywords: 'تشغيل خطوات تسجيل الدخول env seed إعداد',
    body: (
      <>
        <H>تسجيل الدخول</H>
        <P>
          حسابات الأدمين والوكيل الأول كيتصاوبو من ملف <Code>.env</Code> (المتغيرات <Code>ADMIN_EMAIL</Code> و{' '}
          <Code>ADMIN_PASSWORD</Code> و<Code>AGENT_EMAIL</Code> و<Code>AGENT_PASSWORD</Code>) عند تشغيل <Code>npm run db:seed</Code>. ما
          كيبانوش فـ صفحة الدخول. باقي الوكلاء كيصاوبهم الأدمين من صفحة «الفريق والصلاحيات».
        </P>
        <H>ترتيب الإعداد للمرة الأولى</H>
        <OL
          items={[
            <>
              <strong className="text-white">إعدادات الحساب</strong> ← أدخل مفتاح OpenAI واختر النموذج.
            </>,
            <>
              <strong className="text-white">ربط أرقام واتساب</strong> ← أنشئ جلسة وامسح QR (Evolution API).
            </>,
            <>
              <strong className="text-white">الكتالوج والأسئلة</strong> ← زيد المنتجات (بصورها وألوانها وأثمنتها) والأسئلة الشائعة.
            </>,
            <>
              <strong className="text-white">إعدادات الحساب</strong> ← عدّل «برومبت الموظفة» (شخصية البوت) وأضف رقم(أرقام) تحويل المحادثات.
            </>,
            <>
              <strong className="text-white">اختبار البوت</strong> ← جرّب محادثات قبل ما تفتح الرقم للزبناء.
            </>,
            <>
              <strong className="text-white">الفريق والصلاحيات</strong> ← صاوب حسابات الموظفات وحدد ما يقدرو يديرو.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'analytics',
    icon: '▣',
    title: 'الرئيسية والتحليلات',
    keywords: 'إحصائيات تحليلات conversion نسبة التحويل sentiment نشاط',
    body: (
      <>
        <P>لوحة إحصائيات حية كتلخص النشاط. كتتحسب من قاعدة البيانات كل مرة تحل الصفحة.</P>
        <Table
          head={['المؤشر', 'شنو كيعني']}
          rows={[
            ['إجمالي الرسائل', 'عدد كل الرسائل المحفوظة (زبون + بوت + وكيل).'],
            ['الرسائل الصوتية', 'عدد رسائل الزبناء اللي كانت نوت صوتي (تحولات لنص).'],
            ['الطلبات', 'عدد العملاء اللي حالتهم «مؤهل» أو «تحت التسليم».'],
            ['نسبة التحويل', 'الطلبات ÷ مجموع العملاء × 100.'],
            ['تحليل الانطباع', 'إيجابي = مؤهلون، محايد = جدد وقيد التأهيل، سلبي = مرفوضون ومسلَّمون.'],
            ['نشاط 7 أيام', 'رسائل الزبناء النصية والصوتية فـ كل يوم من آخر أسبوع.'],
            ['يحتاجون تدخل', 'العملاء «تحت التسليم» أو «المرفوضين».'],
          ]}
        />
        <Note kind="info">تظهر هاد الصفحة فقط للمستخدمين اللي عندهم صلاحية «الرئيسية والتحليلات».</Note>
      </>
    ),
  },
  {
    id: 'leads',
    icon: '◉',
    title: 'إدارة الطلبات والعملاء',
    keywords: 'عملاء مؤهلون leads ملخص score استلام takeover',
    body: (
      <>
        <P>قائمة بطاقات للعملاء المؤهلين والمسلَّمين، كل بطاقة فيها الاسم والهاتف والدرجة من 10 وملخص الذكاء الاصطناعي.</P>
        <UL
          items={[
            'اضغط على البطاقة باش تفتح المحادثة وتقرا الملخص والرسائل.',
            'زر «استلام / Take Over» كيوقف البوت ويسند المحادثة ليك — من دابا انتي اللي كتجاوبي.',
            'درجة التأهيل (1–10) كيعطيها OpenAI بحسب جدية العميل: كلما زادت قرب الشراء.',
            'الملخص كيتحدث مع كل رسالة جديدة ويقول المنتج المطلوب والمدينة والاستعجال إلى توفرو.',
          ]}
        />
        <Note kind="tip">إلا كان الوكيل ما عندوش صلاحية «الاستلام البشري» أو «الرد»، الأزرار والخانة كتختفي ويبقى عرض فقط.</Note>
      </>
    ),
  },
  {
    id: 'chats',
    icon: '💬',
    title: 'محادثات الواتساب الحية',
    keywords: 'chat محادثات حية استلام بشري ميكرو صوت رد سريع نوت',
    body: (
      <>
        <P>واجهة بحال واتساب ويب: لائحة المحادثات على جنب والمحادثة المفتوحة فـ الوسط.</P>
        <H>الفلاتر</H>
        <UL
          items={[
            <>
              <Badge tone="green">الكل</Badge> كل المحادثات.
            </>,
            <>
              <Badge tone="green">مؤهل</Badge> العملاء اللي بلغو مرحلة التأهيل.
            </>,
            <>
              <Badge tone="violet">تحت التسليم</Badge> المحادثات اللي حولها البوت للموظفة.
            </>,
            <>
              <Badge tone="red">تحكم بشري</Badge> المحادثات اللي البوت فيها موقوف.
            </>,
          ]}
        />
        <H>الاستلام البشري</H>
        <OL
          items={[
            'اضغط «إيقاف البوت / استلام بشري» فـ المحادثة (أو «استلام» فـ اللائحة).',
            'البوت يتوقف عن الرد فوراً فـ هاد المحادثة، وتبان شارة «تحكم بشري 👤».',
            'جاوب الزبون بالنص، أو بالردود السريعة، أو بنوت صوتي.',
            'ملي تسالي، اضغط «إعادة تفعيل الذكاء الاصطناعي» باش يرجع البوت يكمل.',
          ]}
        />
        <H>الرد بالصوت (الميكرو 🎤)</H>
        <UL
          items={[
            'متاح غير فـ حالة التحكم البشري. اضغط الميكرو، هدر، ثم «إرسال».',
            'التسجيل كيتحول لـ MP3 فـ المتصفح وكيتبعت للزبون عبر واتساب.',
            'كيبان عند الزبون كنوت صوتي (PTT) عبر Evolution، وكيتسجل فـ المحادثة كمشغّل صوت.',
          ]}
        />
        <Note kind="info">
          المحادثات كتتحدث تلقائياً كل بضع ثوان. الرسائل الصوتية للزبناء كتبان نصها المكتوب، والإعلانات كتبان بسطر «📢 إعلان».
        </Note>
      </>
    ),
  },
  {
    id: 'knowledge',
    icon: '📚',
    title: 'الكتالوج والأسئلة (Knowledge)',
    keywords: 'منتجات كتالوج faq أسئلة شائعة صور ألوان مقاسات ثمن ai copilot',
    body: (
      <>
        <P>
          هنا كتحط كل ما يعرفو البوت على متجرك. <strong className="text-white">كل العناصر كتتحقن فـ تعليمات البوت</strong> فـ كل رد،
          فـ أي تعديل كيطبق فورا.
        </P>
        <H>المنتجات</H>
        <UL
          items={[
            'الحقول: العنوان، الوصف، الثمن (DH)، الصور، الألوان، المقاسات.',
            'زر «تحليل الصور بالذكاء الاصطناعي»: OpenAI كيقرا صور المنتج ويقترح العنوان والوصف والألوان.',
            'الألوان: اختر من الدرجات أو من المربع (color picker) أو خلي AI يختار بحرية.',
            'ملي البوت يذكر رابط صورة فـ رده، كيتبعت للزبون كصورة حقيقية ماشي كرابط.',
          ]}
        />
        <H>الأسئلة الشائعة</H>
        <P>سؤال وجواب (التوصيل، الدفع، الاسترجاع…). البوت كيعتمد عليها باش يجاوب بنفس صيغتك.</P>
        <H>مساعد الكتالوج (AI Copilot)</H>
        <P>كتكتب وصف قصير للمتجر وهو كيولّد منتجات وأسئلة نموذجية تعدّل عليها.</P>
        <Note kind="warn">
          إضافة وتعديل وحذف العناصر كتحتاج صلاحية «تعديل الكتالوج». الوكيل بصلاحية «قراءة الكتالوج» كيشوف فقط.
        </Note>
      </>
    ),
  },
  {
    id: 'playground',
    icon: '🧪',
    title: 'اختبار البوت (Playground)',
    keywords: 'تجربة اختبار playground محاكاة',
    body: (
      <>
        <P>
          كتجرب نفس منطق التأهيل اللي كيستعملو البوت الحقيقي (نفس البرومبت ونفس الكتالوج) <strong className="text-white">من غير ما
          يتبعت شي حاجة لواتساب</strong>. مفيد باش تشوف الردود والتقييم قبل ما تعدّل البرومبت أو تفتح الرقم.
        </P>
        <UL items={['اكتب بحال زبون وشوف رد البوت ودرجة التأهيل.', 'تقدر تجرب الصوت (STT/TTS) حسب الإعدادات.']} />
      </>
    ),
  },
  {
    id: 'whatsapp',
    icon: '📱',
    title: 'ربط أرقام واتساب (Evolution API)',
    badge: 'للمدير',
    keywords: 'evolution api instance qr webhook ربط رقم أكثر من رقم pairing code جلسة',
    body: (
      <>
        <H>الإعداد الأولي (مرة وحدة)</H>
        <P>
          عنوان خادم Evolution والمفتاح العام كيتحطو فـ متغيرات البيئة ديال السيرفر: <Code>EVOLUTION_API_URL</Code> و{' '}
          <Code>EVOLUTION_API_KEY</Code>. صفحة «ربط أرقام واتساب» كاتبيّن غير واش الخادم متصل، بلا العنوان وبلا المفتاح.
        </P>
        <H>ربط رقم</H>
        <OL
          items={[
            'فـ الصفحة كتب اسم للرقم إلا بغيتي (اختياري)؛ اسم الجلسة التقني كيتصاوب بوحدو.',
            'اضغط «إنشاء الجلسة وعرض QR» وامسح QR من واتساب ← الأجهزة المرتبطة. الحالة كتولي «متصل». الربط كيتم فقط عبر مسح QR.',
            'السيرفر كيضبط الـ webhook (/api/webhook/evolution) بوحدو (غير فـ الإنتاج، ماشي localhost).',
          ]}
        />
        <H>ربط أكثر من رقم</H>
        <P>
          بعد أول رقم كيبان زر «➕ ربط رقم واتساب آخر». كل رقم هو جلسة بسميتها. البوت كيرد دائماً{' '}
          <strong className="text-white">بنفس الرقم اللي كتب ليه الزبون</strong>. واحد منهم كيكون «افتراضي» (للرسائل اللي ما عندهاش رقم محدد).
        </P>
        <H>إدارة الأرقام</H>
        <UL
          items={[
            'عرض QR جديد، Restart، Webhook (إعادة ضبط)، Logout، تعيين كافتراضي، أو حذف (كيمسح الجلسة من Evolution أيضاً).',
            'بطاقة كل رقم كتبين حالتو (متصل / جاري الربط — امسح QR / غير متصل / الجلسة غير موجودة / Evolution غير متاح).',
            'الأرقام القديمة ديال Green API كتبقى خدامة حتى تربط رقم Evolution (كيولي هو الافتراضي أوتوماتيكياً). عليها علامة «Green API (قديم)».',
          ]}
        />
        <Note kind="warn">
          إلا كان Evolution غير متاح (Timeout أو 500) السيرفر كيرجع رسالة واضحة، والردود ما كتوصلش حتى يرجع الخادم. تفقد حالة الاتصال فـ «إعدادات
          الحساب» ← Evolution API.
        </Note>
      </>
    ),
  },
  {
    id: 'team',
    icon: '👥',
    title: 'الفريق والصلاحيات',
    badge: 'للمدير',
    keywords: 'وكلاء agents roles permissions أدوار صلاحيات حساب تعطيل',
    body: (
      <>
        <P>الأدمين كيصاوب حسابات الوكلاء ويحدد لكل واحد بالضبط شنو يقدر يشوف ويدير.</P>
        <Table
          head={['الصلاحية', 'شنو كتعطي']}
          rows={[
            ['الرئيسية والتحليلات', 'رؤية الإحصائيات.'],
            ['إدارة الطلبات والعملاء', 'رؤية العملاء المؤهلين والمسلَّمين.'],
            ['محادثات الواتساب الحية', 'قراءة المحادثات.'],
            ['الاستلام البشري', 'إيقاف البوت وإعادته.'],
            ['الرد على العملاء', 'إرسال رسائل ونوت صوتي.'],
            ['الكتالوج (قراءة)', 'رؤية المنتجات والأسئلة.'],
            ['تعديل الكتالوج', 'إضافة وتعديل وحذف.'],
            ['اختبار البوت', 'استعمال Playground.'],
          ]}
        />
        <H>الأدوار الجاهزة</H>
        <UL
          items={[
            <>
              <strong className="text-white">وكيل تأكيد</strong>: كل شيء ما عدا تعديل الكتالوج.
            </>,
            <>
              <strong className="text-white">مشرف</strong>: كل الصلاحيات.
            </>,
            <>
              <strong className="text-white">مراقب</strong>: قراءة فقط (تحليلات، عملاء، محادثات، كتالوج).
            </>,
            <>
              <strong className="text-white">مسؤول الكتالوج</strong>: الكتالوج + الاختبار.
            </>,
          ]}
        />
        <UL
          items={[
            'تقدر تعطل حساباً (ما يبقاش يدخل)، تبدّل كلمة مروره، أو تحذفه. المحادثات المسندة ليه كتبقى.',
            'التغييرات كتطبق فـ حوالي 5 ثواني، والصلاحية كتتفرض على السيرفر (ماشي غير إخفاء أزرار).',
            'الأدمين عندو كل الصلاحيات دائماً، وما كيتعدلش.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'settings',
    icon: '⚙',
    title: 'إعدادات الحساب',
    keywords: 'إعدادات openai مفتاح نموذج stt tts برومبت تحويل المحادثات رقم',
    body: (
      <>
        <P>كل واحد كيشوف بريدو ودورو. الأدمين كيشوف بزيادة:</P>
        <H>
          تحويل المحادثات لرقم واتساب آخر <Badge tone="admin">للمدير</Badge>
        </H>
        <P>
          ملي محادثة كتتحول للتحكم البشري (من البوت أو بالاستلام اليدوي)، النظام كيبعت إشعار فـ واتساب لأرقام إضافية (حتى 5): اسم الزبون ورقمو
          وملخص. كتكتب الرقم بصيغة دولية أو مغربية (<Code>06…</Code>)، وفيه زر «اختبار».
        </P>
        <H>
          إعدادات Evolution API <Badge tone="admin">سوبر أدمين</Badge>
        </H>
        <P>
          حالة الاتصال، اختبار الاتصال، ورابط الـ Webhook كاينين غير فـ لوحة تحكم السوبر أدمين. العنوان والمفتاح كيتبدلو من{' '}
          <Code>EVOLUTION_API_URL</Code> و<Code>EVOLUTION_API_KEY</Code>.
        </P>
        <H>
          الذكاء الاصطناعي والصوت <Badge tone="admin">للمدير</Badge>
        </H>
        <UL
          items={[
            'مفتاح OpenAI من متغير البيئة OPENAI_API_KEY فقط، والنموذج النصي (مثلا gpt-4o-mini) من هنا.',
            'تحويل صوت الزبون لنص (STT): فهم النوت الصوتي بالدارجة.',
            'الرد بصوت طبيعي (TTS): بعد كل رد نصي كيتبعت تسجيل صوتي (اختياري، كيزيد التكلفة).',
            'برومبت الموظفة: شخصية البوت وأسلوبو. قواعد التأهيل: كيفاش يقيّم ويحول.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'alerts',
    icon: '🔔',
    title: 'التنبيهات والأصوات',
    keywords: 'إشعار صوتي رنة ringtone تنبيه admin alerts',
    body: (
      <>
        <P>
          فـ الشريط العلوي زر «🔔 الصوت مفعّل / 🔕 الصوت متوقف» لتشغيل الإشعارات الصوتية، وزر «اختيار الرنات» لضبط النغمات.
        </P>
        <UL
          items={[
            <>
              حدثين: <Badge tone="red">تحكم بشري مطلوب</Badge> (نغمة قوية) و <Badge tone="violet">عميل جديد تحت التسليم</Badge> (نغمة مختلفة).
            </>,
            'لكل حدث 10 رنات من الخفيفة للحادة، مع زر معاينة. الاختيار كيتحفظ فـ المتصفح.',
            'كيبان شريط ملون فـ الصفحة مع زر «فتح المحادثات».',
            'التشغيل كيتطلب نقرة وحدة على الصفحة (قيد المتصفحات على الصوت).',
          ]}
        />
        <H>
          إشعارات النظام <Badge tone="admin">للمدير فقط</Badge>
        </H>
        <P>أخطاء تقنية بحال: «لم يصل رد البوت للزبون» أو «تعذر الإرسال عبر Evolution API» كتبان فـ شريط أصفر عند الأدمين فقط. ما كيتكتبوش أبداً فـ محادثة الزبون.</P>
      </>
    ),
  },
  {
    id: 'pipeline',
    icon: '🔄',
    title: 'كيفاش كيعالج النظام المعلومات',
    keywords: 'معالجة pipeline webhook flow تدفق رسالة بوت openai score handoff صوت stt إعلان',
    body: (
      <>
        <P>هادي هي الرحلة الكاملة ديال رسالة زبون من لحظة ما كتوصل حتى يتبعت الرد:</P>
        <Flow
          steps={[
            {
              title: 'استقبال الـ webhook',
              text: 'Evolution API كيبعت الحدث MESSAGES_UPSERT لـ /api/webhook/evolution (محمي بـ token). كيقبل: نص، رسالة صوتية، رسالة معدّلة، ورسالة فيها رابط/معاينة إعلان. المجموعات كتتجاهل. حدث CONNECTION_UPDATE كيحدّث حالة الاتصال.',
            },
            {
              title: 'تحديد الرقم والزبون',
              text: 'كنعرفو الرقم (instance) اللي وصلات ليه الرسالة باش الرد يخرج منو. كنقلبو على الزبون برقم هاتفو، وإلا ما كاينش كنصاوبو بحالة «جديد».',
            },
            {
              title: 'تحويل الصوت لنص (إلا كانت نوت صوتي)',
              text: 'كنحمل الملف ونرسلو لـ gpt-4o-transcribe (بديل: whisper-1) مع تلميحات الدارجة المغربية، ثم تمرير تصحيح لغوي. النص كيتحفظ بعلامة [رسالة صوتية]. إلا فشل، البوت كيطلب من الزبون يكتب.',
            },
            {
              title: 'فهم الإعلان (إلا كان رابط/معاينة)',
              text: 'كنفتح الرابط بأمان، ونقرا العنوان والوصف والصورة، وكنقارن الصورة بصور الكتالوج عبر OpenAI vision. النتيجة كتتحفظ كسطر «📢 إعلان» وكتنضاف للسياق.',
            },
            {
              title: 'حفظ الرسالة',
              text: 'كتتسجل فـ جدول Message كرسالة «زبون» وكتبان فورا فـ الداشبورد.',
            },
            {
              title: 'هل البوت موقوف؟',
              text: 'إلا كانت المحادثة تحت التحكم البشري أو التسليم، كنوقفو هنا: الرسالة كتوصل للموظفة والبوت ما كيجاوبش.',
            },
            {
              title: 'بناء التعليمات والتحليل',
              text: 'كنركبو: شخصية البوت + الكتالوج كامل + قواعد التأهيل + آخر 10 رسائل (+ سياق الإعلان). OpenAI كيرجع JSON فيه: score، status، summary، extractedInfo، handoff، botResponse.',
            },
            {
              title: 'تحديث العميل',
              text: 'كنحدثو الدرجة والحالة والملخص والاسم المستخرج. إلا score ≥ 8 أو طلب موظفة أو مكالمة فيديو ← handoff وإيقاف البوت.',
            },
            {
              title: 'إرسال الرد',
              text: 'الرد كيتبعت عبر Evolution API من نفس الرقم (الجلسة). روابط الصور فـ الرد كتتبعت كصور حقيقية، ورد صوتي (TTS) إلا كان مفعّل. إلا فشل الإرسال كيتسجل تنبيه للأدمين.',
            },
            {
              title: 'عند التسليم',
              text: 'إشعار صوتي/شريط فـ الداشبورد + رسالة واتساب للأرقام الإضافية المحددة فـ الإعدادات.',
            },
          ]}
        />
        <Note kind="info">
          السيرفر كيرجع دائماً <Code>200</Code> لـ Evolution API حتى فـ حالة خطأ، باش ما يعاودش يبعت نفس الرسالة كل دقيقة ويتكرر الرد.
        </Note>

        <H>الدرجة والحالة</H>
        <Table
          head={['الدرجة', 'الحالة', 'المعنى']}
          rows={[
            ['8 – 10', <Badge key="q" tone="green">QUALIFIED</Badge>, 'جاد فـ الشراء ← تسليم تلقائي لموظفة التأكيد.'],
            ['4 – 7', <Badge key="g" tone="slate">QUALIFYING</Badge>, 'كنجمعو معلومات (منتج، مدينة، عنوان…).'],
            ['1 – 3', <Badge key="r" tone="red">REJECTED</Badge>, 'غير مهتم أو سبام.'],
          ]}
        />
        <H>أسباب التسليم (handoff)</H>
        <UL
          items={[
            <>
              <Badge tone="green">READY_TO_BUY</Badge> الزبون حدد المنتج وعطى بياناتو أو قال بغيت نطلب.
            </>,
            <>
              <Badge tone="violet">WANTS_HUMAN</Badge> طلب يهدر مع موظفة أو إنسان.
            </>,
            <>
              <Badge tone="violet">WANTS_VIDEO_CALL</Badge> طلب مكالمة أو فيديو مباشر.
            </>,
          ]}
        />
        <H>حالات العميل</H>
        <Table
          head={['الحالة', 'المعنى']}
          rows={[
            ['NEW', 'أول رسالة، لم يُقيَّم بعد.'],
            ['QUALIFYING', 'قيد التأهيل مع البوت.'],
            ['QUALIFIED', 'جاهز (غالباً كيتحول فورا لـ HANDED_OFF).'],
            ['HANDED_OFF', 'تحت التسليم: البوت موقوف والموظفة كتكمل.'],
            ['REJECTED', 'مرفوض / غير مهتم.'],
          ]}
        />
        <Note kind="tip">
          مجرد السؤال عن منتج من إعلان ماشي نية شراء مؤكدة: البوت كيعطي درجة متوسطة وما كيحولش حتى يعطي الزبون بياناتو.
        </Note>
      </>
    ),
  },
  {
    id: 'ads',
    icon: '📢',
    title: 'الزبناء القادمون من الإعلانات',
    keywords: 'إعلان ad click to whatsapp رابط منتج تعرف صورة facebook instagram',
    body: (
      <>
        <P>إلا وصلات رسالة فيها رابط إعلان (فيسبوك، إنستغرام…) أو معاينة إعلان، النظام كيحاول يعرف المنتج ويجاوب عليه مباشرة:</P>
        <OL
          items={[
            'قراءة الرابط والمعاينة (العنوان، الوصف، الصورة الصغيرة).',
            'جلب صفحة الرابط كأننا crawler ديال فيسبوك للحصول على صورة ونص الإعلان.',
            'OpenAI كيقارن صورة الإعلان بصور ووصف منتجات الكتالوج ويعطي رقم المنتج المطابق بثقة.',
            'إلا لقا تطابق: البوت كيجاوب بالثمن والألوان والمقاسات ويبعت الصورة. إلا لا: ما كيخترعش، كيعتذر بلطف ويطلب اسم/صورة المنتج.',
          ]}
        />
        <Note kind="warn">
          بعض الإعلانات كتطلب تسجيل الدخول فـ فيسبوك ولا يمكن قراءتها. هنا النظام كيعتمد على الصورة المصغّرة اللي بعت واتساب، وإلا ما لقاش شي حاجة كيسول الزبون على المنتج. الروابط الداخلية/المحلية كتتمنع حماية للسيرفر.
        </Note>
      </>
    ),
  },
  {
    id: 'data',
    icon: '🗄️',
    title: 'قاعدة البيانات والتخزين',
    keywords: 'database جداول prisma supabase postgres تخزين صور user lead message appsetting',
    body: (
      <>
        <P>كل شي مخزن فـ PostgreSQL (Supabase) عبر Prisma.</P>
        <Table
          head={['الجدول', 'شنو فيه']}
          rows={[
            ['User', 'حسابات الأدمين والوكلاء (كلمات المرور مشفّرة بـ bcrypt).'],
            ['Lead', 'العميل: الهاتف، الاسم، الحالة، الدرجة، الملخص، «aiPaused»، الوكيل المسند.'],
            ['Message', 'كل رسائل المحادثات (USER / BOT / AGENT).'],
            ['KnowledgeItem', 'المنتجات والأسئلة الشائعة.'],
            ['AiSettings', 'مفتاح OpenAI، النموذج، البرومبتات، إعدادات الصوت.'],
            ['WhatsAppInstance', 'أرقام واتساب المربوطة (اسم الجلسة، الهاتف، الافتراضي، المزوّد).'],
            ['UploadedImage *', 'صور المنتجات والنوت الصوتي (مخزنة فـ DB لأن Vercel ما فيه تخزين دائم).'],
            ['AppSetting *', 'إعدادات JSON: أرقام التحويل، صلاحيات الوكلاء…'],
            ['AdminAlert *', 'تنبيهات النظام الخاصة بالأدمين.'],
          ]}
        />
        <P>(*) كتتصاوب بوحدها عند أول استعمال، ما خاصك تدير migration.</P>
      </>
    ),
  },
  {
    id: 'security',
    icon: '🔐',
    title: 'الأمان',
    keywords: 'أمان security jwt bcrypt env حماية',
    body: (
      <UL
        items={[
          'تسجيل الدخول بـ JWT ينتهي حسب JWT_EXPIRES_IN (افتراضياً 7 أيام). كلمات المرور مشفرة.',
          'بيانات الأدمين/الوكيل الأول كتجي من .env وما كتبانش فـ الواجهة ولا فـ الكود.',
          'كل مسار حساس فـ السيرفر كيتحقق من الدور والصلاحية، ماشي غير إخفاء الأزرار فـ الواجهة.',
          'الحساب المعطّل كيتقطع عنو الدخول فورا.',
          'روابط الإعلانات اللي كيبعتها الزبناء كتفحص باش ما توصلش لعناوين داخلية (SSRF).',
          'أخطاء النظام والتوكنات ما كتبانش للزبون أو للوكلاء العاديين.',
        ]}
      />
    ),
  },
  {
    id: 'env',
    icon: '🧩',
    title: 'متغيرات البيئة (.env)',
    badge: 'للمدير',
    keywords: 'env variables متغيرات database_url jwt cors',
    body: (
      <>
        <Table
          head={['المتغير', 'الاستعمال']}
          rows={[
            [<Code key="1">DATABASE_URL</Code>, 'اتصال قاعدة البيانات وقت التشغيل (pooler 6543).'],
            [<Code key="2">DIRECT_URL</Code>, 'اتصال مباشر 5432 للـ migrations والـ seed.'],
            [<Code key="3">JWT_SECRET</Code>, 'مفتاح توقيع الجلسات — خاصو يكون طويل وعشوائي.'],
            [<Code key="4">JWT_EXPIRES_IN</Code>, 'مدة الجلسة (مثلا 7d).'],
            [<Code key="5">CORS_ORIGIN</Code>, 'عناوين الداشبورد المسموح لها (مفصولة بفاصلة).'],
            [<Code key="6">ADMIN_EMAIL / ADMIN_PASSWORD</Code>, 'حساب الأدمين (8 أحرف على الأقل). حط القيمة بين "" إلا فيها # أو فراغ.'],
            [<Code key="7">AGENT_EMAIL / AGENT_PASSWORD</Code>, 'حساب الوكيل الأول (اختياري).'],
            [<Code key="8">VITE_API_URL</Code>, 'فـ مشروع الواجهة: عنوان الـ API فـ الإنتاج.'],
            [<Code key="9">APP_PUBLIC_URL</Code>, 'العنوان العام للسيرفر (للـ webhook والملفات الصوتية).'],
          ]}
        />
        <Note kind="info">
          بعد تغيير بيانات الأدمين/الوكيل فـ <Code>.env</Code> شغّل <Code>npm run db:seed</Code> باش تتحدث فـ القاعدة.
        </Note>
      </>
    ),
  },
  {
    id: 'troubleshooting',
    icon: '🛠️',
    title: 'حل المشاكل الشائعة',
    keywords: 'مشكل خطأ troubleshooting لا يرد البوت لا يصل webhook 466 quota صوت localhost',
    body: (
      <>
        <Table
          head={['المشكل', 'السبب المحتمل / الحل']}
          rows={[
            [
              'الرد كيبان فـ الداشبورد ولكن ما كيوصلش لواتساب',
              <>
                غالباً الجلسة غير متصلة أو Evolution API متوقف. شوف حالة الرقم فـ «ربط أرقام واتساب» (امسح QR من جديد إلا كان «غير متصل») وحالة
                الاتصال فـ الإعدادات، وإشعارات الأدمين.
              </>,
            ],
            [
              'ما كتوصلش الرسائل للنظام',
              'تحقق أن الرقم «متصل»، وأن الـ webhook ضابط على عنوان السيرفر العام (ماشي localhost). فـ الإنتاج كيتضبط وقت الربط.',
            ],
            [
              'البوت ما كيجاوبش',
              'شوف واش المحادثة «تحكم بشري» أو «تحت التسليم»، أو مفتاح OpenAI ناقص/مستنفد، أو الرقم ما بقاش متصل.',
            ],
            [
              'النوت الصوتي ما فهمش مزيان',
              'تأكد من تفعيل STT وأن مفتاح OpenAI صالح. الدارجة المخلوطة بالضوضاء كتضعف الدقة؛ جرّب نموذج الصوت الأحدث.',
            ],
            [
              'ما كتبانش الصور المنتج عند الزبون',
              'الصور خاصها تكون مرفوعة فـ الكتالوج ويكون APP_PUBLIC_URL صحيح (رابط عام ماشي localhost).',
            ],
            [
              'ظهر «Not Found» وأنا كنربط رقم',
              'اسم الجلسة غير موجود فـ Evolution (مثلاً تحذفات من الخادم). احذف الرقم من اللوحة وأعد ربطه.',
            ],
            [
              'رسالة معدّلة من الزبون',
              'كتتعامل كرسالة جديدة بعلامة ✏️ (واتساب ما كيسمحش بتعديل رد سبق).',
            ],
            [
              'وكيل ما كيشوفش صفحة',
              'الصلاحيات من «الفريق والصلاحيات»: عطيه الصلاحية الناقصة.',
            ],
          ]}
        />
      </>
    ),
  },
  {
    id: 'limits',
    icon: '📌',
    title: 'حدود معروفة',
    keywords: 'حدود limitations ملاحظات',
    body: (
      <UL
        items={[
          'الرد الصوتي من الداشبورد كيتسجل MP3 فـ المتصفح وكيتبعت كنوت صوتي عبر Evolution؛ إلا فشل التحويل كيوصل كملف صوتي.',
          'على Vercel ما كاينش Socket.IO: التحديث كيتم بالاستعلام الدوري كل بضع ثوان.',
          'Evolution API كيعتمد على واتساب غير الرسمي (Baileys): استعمل أرقام مخصصة وتجنب الإرسال الجماعي باش ما يتحظرش الرقم.',
          'قراءة الإعلانات المغلقة بتسجيل الدخول محدودة (الصورة المصغّرة هي البديل).',
          'تقييم «الانطباع» فـ التحليلات مبني على حالة العميل ماشي تحليل نصي للمشاعر.',
        ]}
      />
    ),
  },
];

/* ---------------------------------------------------------------- page */

export default function DocsPage() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(SECTIONS[0].id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) => `${s.title} ${s.keywords}`.toLowerCase().includes(q));
  }, [query]);

  // Highlight the section being read.
  useEffect(() => {
    const els = filtered.map((s) => document.getElementById(`doc-${s.id}`)).filter(Boolean);
    if (!els.length || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace('doc-', ''));
      },
      { rootMargin: '-80px 0px -65% 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [filtered]);

  function goTo(id) {
    document.getElementById(`doc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  }

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">📖 التوثيق</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
          شرح كامل لأقسام النظام، كيفاش تستعملو، وكيفاش كيعالج المعلومات من لحظة ما كتوصل رسالة الزبون حتى كيتبعت الرد.
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔎 قلب فـ التوثيق (مثلا: صوت، صلاحيات، 466)…"
          className="mt-4 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-500"
        />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav
          aria-label="فهرس التوثيق"
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-2 lg:sticky lg:top-24 lg:w-64 lg:shrink-0"
        >
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {filtered.map((s) => (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goTo(s.id)}
                  className={[
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-[13px] transition',
                    active === s.id
                      ? 'bg-emerald-500/15 font-semibold text-emerald-300'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                  ].join(' ')}
                >
                  <span aria-hidden>{s.icon}</span>
                  <span className="whitespace-nowrap lg:whitespace-normal">{s.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1 space-y-5">
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
              ما لقينا شي نتيجة لـ «{query}».
            </p>
          ) : null}
          {filtered.map((s) => (
            <article
              key={s.id}
              id={`doc-${s.id}`}
              className="scroll-mt-28 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6"
            >
              <header className="mb-4 flex flex-wrap items-center gap-3 border-b border-slate-800 pb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-xl" aria-hidden>
                  {s.icon}
                </span>
                <h3 className="text-lg font-bold text-white">{s.title}</h3>
                {s.badge ? <Badge tone="admin">{s.badge}</Badge> : null}
              </header>
              {s.body}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
