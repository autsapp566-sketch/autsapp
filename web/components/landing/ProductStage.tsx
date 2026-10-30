'use client';

import { useEffect, useState } from 'react';

const SCENES = [
  {
    name: 'يوسف',
    city: 'الدار البيضاء',
    product: 'حذاء رياضي',
    price: '320 درهم',
    customer: 'السلام عليكم، هل الحذاء الأسود مقاس 42 متوفر؟',
    reply: 'نعم، متوفر بالأسود والأبيض بـ 320 درهم. سأحوّلك الآن لتأكيد العنوان.',
    qualified: 18,
  },
  {
    name: 'سلمى',
    city: 'الرباط',
    product: 'جاكيت جلد',
    price: '450 درهم',
    customer: 'بغيت الجاكيت، والتوصيل للرباط غدًا.',
    reply: 'المقاس M وL متوفران بـ 450 درهم. حوّلتك للزميلة لتأكيد الطلب.',
    qualified: 19,
  },
  {
    name: 'أمين',
    city: 'مراكش',
    product: 'ساعة ذكية',
    price: '890 درهم',
    customer: 'كم سعر الساعة؟ وهل التوصيل لمراكش؟',
    reply: '890 درهم، والتوصيل غدًا. سأسلّم المحادثة للفريق الآن.',
    qualified: 20,
  },
] as const;

/** Looping product demo: messages arrive, the assistant replies, then the chat is handed to the team. */
export function ProductStage() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => setStep((current) => current + 1), 1500);
    return () => window.clearInterval(id);
  }, []);

  const scene = SCENES[Math.floor(step / 3) % SCENES.length];
  const phase = step % 3;

  return (
    <div className="relative mx-auto w-full max-w-xl animate-float" aria-hidden>
      <div className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-cyan-400/10 blur-3xl" />
      <div className="absolute -end-2 -top-4 hidden w-40 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-black/30 sm:block">
        <p className="text-[10px] font-semibold text-slate-400">محادثة جديدة</p>
        <p className="mt-1 text-xs font-bold text-slate-900">{scene.name}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{scene.city}</p>
      </div>

      <div className="overflow-hidden rounded-[1.6rem] border border-white/70 bg-white text-slate-900 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B1C33] text-[10px] font-bold text-[#2ED4DE]">EJ</span>
            <div>
              <p className="text-xs font-bold">لوحة واتساب</p>
              <p className="flex items-center gap-1 text-[10px] text-emerald-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                المساعد يرد الآن
              </p>
            </div>
          </div>
          <p className="rounded-full bg-ember-500/10 px-2.5 py-1 text-[11px] font-bold text-ember-600">
            {scene.qualified} مؤهَّل اليوم
          </p>
        </div>

        <div className="grid grid-cols-[7.5rem_1fr] sm:grid-cols-[9rem_1fr]">
          <ul className="space-y-1 border-e border-slate-100 bg-slate-50 p-2">
            {SCENES.map((item) => {
              const active = item.name === scene.name;
              return (
                <li
                  key={item.name}
                  className={[
                    'rounded-xl px-2 py-2 transition',
                    active ? 'bg-white shadow-sm ring-1 ring-cyan-200' : 'opacity-60',
                  ].join(' ')}
                >
                  <p className="truncate text-[11px] font-bold">{item.name}</p>
                  <p className="truncate text-[10px] text-slate-500">{item.product}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-ember-600">{item.price}</p>
                </li>
              );
            })}
          </ul>

          <div className="relative min-h-[17.5rem] space-y-2 p-3 sm:p-4">
            <div key={`${scene.name}-in`} className="max-w-[92%] animate-pop-in rounded-2xl rounded-ss-md bg-slate-100 px-3 py-2.5 text-[12px] leading-5 text-slate-700">
              {scene.customer}
            </div>
            {phase >= 1 ? (
              <div key={`${scene.name}-out`} className="ms-auto max-w-[92%] animate-pop-in rounded-2xl rounded-se-md bg-[#0B1C33] px-3 py-2.5 text-[12px] leading-5 text-white">
                {scene.reply}
              </div>
            ) : (
              <div className="ms-auto flex w-fit gap-1 rounded-full bg-slate-100 px-3 py-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
              </div>
            )}
            {phase >= 2 ? (
              <div key={`${scene.name}-hand`} className="animate-pop-in mx-auto flex w-fit items-center gap-2 rounded-full bg-ember-500 px-3 py-1.5 text-[11px] font-bold text-white">
                تم التحويل لفريق التأكيد
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
