'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PLANS, priceFor, TRIAL_DAYS, type BillingInterval } from '@/lib/plans';

export function Pricing() {
  const [interval, setInterval] = useState<BillingInterval>('annual');

  return (
    <section id="pricing" className="border-t border-slate-800/80 bg-slate-900/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-emerald-400">الأسعار</p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">باقات تنمو مع مشروعك</h2>
          <p className="mt-4 text-base leading-8 text-slate-400">ابدأ بتجربة مجانية لمدة {TRIAL_DAYS} يومًا. غيّر الباقة أو ألغِ في أي وقت.</p>
        </div>

        <div className="mt-10 flex justify-center">
          <div role="radiogroup" aria-label="دورة الفوترة" className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 p-1">
            {(['monthly', 'annual'] as const).map((value) => {
              const active = interval === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setInterval(value)}
                  className={[
                    'flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition',
                    active ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white',
                  ].join(' ')}
                >
                  {value === 'monthly' ? 'شهري' : 'سنوي'}
                  {value === 'annual' ? (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-emerald-500/15 text-emerald-300'}`}>
                      شهران مجانًا
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const price = priceFor(plan, interval);
            return (
              <article
                key={plan.id}
                className={[
                  'relative flex flex-col rounded-3xl border p-8',
                  plan.highlight
                    ? 'border-emerald-500/60 bg-slate-900 shadow-2xl shadow-emerald-950/40 lg:-my-3 lg:py-11'
                    : 'border-slate-800 bg-slate-900/60',
                ].join(' ')}
              >
                {plan.highlight ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-4 py-1 text-xs font-bold text-white">
                    الأكثر شعبية
                  </span>
                ) : null}

                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="mt-1.5 min-h-[2.5rem] text-sm leading-6 text-slate-400">{plan.tagline}</p>

                <div className="mt-6 min-h-[5.5rem]">
                  {price ? (
                    <>
                      <p className="flex items-baseline gap-1.5" aria-live="polite">
                        <span dir="ltr" className="text-5xl font-bold tracking-tight text-white">${price.perMonth}</span>
                        <span className="text-sm text-slate-500">/ شهريًا</span>
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {price.billedYearly ? (
                          <>
                            تُدفع سنويًا: <span dir="ltr">${price.billedYearly}</span>
                          </>
                        ) : (
                          'تُدفع شهريًا'
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-4xl font-bold text-white">مخصص</p>
                      <p className="mt-2 text-xs text-slate-500">سعر حسب حجم الاستخدام</p>
                    </>
                  )}
                </div>

                <Link
                  href={`/signup?plan=${plan.id}&billing=${interval}`}
                  className={[
                    'mt-6 block rounded-xl py-3 text-center text-sm font-semibold transition',
                    plan.highlight
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500'
                      : 'border border-slate-700 bg-slate-800/60 text-slate-100 hover:border-slate-600 hover:bg-slate-800',
                  ].join(' ')}
                >
                  ابدأ الآن
                </Link>

                <ul className="mt-8 space-y-3.5 border-t border-slate-800 pt-8 text-sm text-slate-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">جميع الأسعار بالدولار الأمريكي.</p>
      </div>
    </section>
  );
}
