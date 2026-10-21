import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAnalyticsOverview } from '../../api/client.js';

function MetricCard({ label, value, suffix = '', icon, tone }) {
  const tones = {
    emerald: 'bg-emerald-500/15 text-emerald-400',
    sky: 'bg-sky-500/15 text-sky-400',
    orange: 'bg-orange-500/15 text-orange-400',
    violet: 'bg-violet-500/15 text-violet-400',
  };

  return (
    <article className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {value}
            {suffix ? <span className="text-xl font-semibold text-slate-300">{suffix}</span> : null}
          </p>
        </div>
        <span
          className={[
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl',
            tones[tone] ?? tones.emerald,
          ].join(' ')}
          aria-hidden
        >
          {icon}
        </span>
      </div>
    </article>
  );
}

function SentimentBar({ label, percent, emoji, barClass }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 text-slate-300">
          <span aria-hidden>{emoji}</span>
          {label}
        </span>
        <span className="font-semibold text-white">{percent}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div className={['h-full rounded-full transition-all', barClass].join(' ')} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ActivityChart({ activity }) {
  const width = 520;
  const height = 220;
  const pad = { top: 16, right: 12, bottom: 32, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxY = useMemo(() => {
    const peak = Math.max(
      1,
      ...activity.flatMap((d) => [d.textMessages, d.voiceMessages])
    );
    return Math.ceil(peak / 10) * 10 || 10;
  }, [activity]);

  const points = useMemo(() => {
    const n = activity.length;
    return activity.map((d, i) => {
      const x = pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const yText = pad.top + innerH - (d.textMessages / maxY) * innerH;
      const yVoice = pad.top + innerH - (d.voiceMessages / maxY) * innerH;
      return { x, yText, yVoice, label: d.label };
    });
  }, [activity, innerH, innerW, maxY, pad.left, pad.top]);

  const linePath = (key) =>
    points.length
      ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p[key].toFixed(1)}`).join(' ')
      : '';

  const areaPath =
    points.length > 0
      ? `${linePath('yText')} L ${points[points.length - 1].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} Z`
      : '';

  const yTicks = [0, maxY / 2, maxY];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[320px] w-full" role="img" aria-label="نشاط المحادثات">
        {yTicks.map((tick) => {
          const y = pad.top + innerH - (tick / maxY) * innerH;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#1e293b" strokeWidth="1" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize="10">
                {tick}
              </text>
            </g>
          );
        })}
        {areaPath ? <path d={areaPath} fill="url(#areaGreen)" opacity="0.35" /> : null}
        <defs>
          <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {linePath('yText') ? (
          <path d={linePath('yText')} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
        ) : null}
        {linePath('yVoice') ? (
          <path
            d={linePath('yVoice')}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        ) : null}
        {points.map((p) => (
          <text key={p.label} x={p.x} y={height - 8} textAnchor="middle" fill="#94a3b8" fontSize="10">
            {p.label}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-6 rounded bg-emerald-500" /> الرسائل المكتوبة
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-6 rounded border-t-2 border-dashed border-sky-400" /> الرسائل الصوتية (Voice)
        </span>
      </div>
    </div>
  );
}

const emptyOverview = {
  metrics: { totalMessages: 0, voiceMessages: 0, orders: 0, conversionRate: 0 },
  sentiment: {
    positive: { percent: 0 },
    neutral: { percent: 0 },
    negative: { percent: 0 },
  },
  activity: [],
  needsIntervention: 0,
};

export default function LeadsOverviewPage() {
  const [data, setData] = useState(emptyOverview);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const overview = await fetchAnalyticsOverview();
        if (!cancelled) setData(overview);
      } catch {
        if (!cancelled) setData(emptyOverview);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { metrics, sentiment, activity } = data;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">الرئيسية والتحليلات</h1>
          <p className="mt-2 text-sm text-slate-400">ملخص نشاط البوت المباشر والمبيعات</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
          البوت شغال أوتوماتيكياً
        </span>
      </header>

      {loading ? <p className="text-sm text-slate-500">جاري تحميل التحليلات…</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="إجمالي الرسائل المعالجة"
          value={metrics.totalMessages}
          icon="💬"
          tone="emerald"
        />
        <MetricCard
          label="رسائل صوتية معالجة (Voice)"
          value={metrics.voiceMessages}
          icon="🎙"
          tone="sky"
        />
        <MetricCard
          label="إجمالي الطلبات المسجلة"
          value={metrics.orders}
          icon="🛍"
          tone="orange"
        />
        <MetricCard
          label="معدل تحويل المبيعات (CR)"
          value={metrics.conversionRate}
          suffix="%"
          icon="📈"
          tone="violet"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
          <h2 className="text-base font-bold text-white">تحليل انطباع العملاء (Sentiment)</h2>
          <div className="mt-6 space-y-5">
            <SentimentBar
              label="إيجابي / مهتم بالشراء"
              percent={sentiment.positive.percent}
              emoji="🙂"
              barClass="bg-emerald-500"
            />
            <SentimentBar
              label="محايد / استفسارات"
              percent={sentiment.neutral.percent}
              emoji="😐"
              barClass="bg-amber-500"
            />
            <SentimentBar
              label="شكاوى / تدخل يدوي"
              percent={sentiment.negative.percent}
              emoji="☹️"
              barClass="bg-red-500"
            />
          </div>
          <Link
            to="/dashboard/chats"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            💬 استعراض الدردشات التي تحتاج تدخلاً
            {data.needsIntervention > 0 ? (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{data.needsIntervention}</span>
            ) : null}
          </Link>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
          <h2 className="text-base font-bold text-white">نشاط المحادثات والرسائل بالأيام</h2>
          <div className="mt-4">
            <ActivityChart
              activity={
                activity.length
                  ? activity
                  : [
                      { label: 'الاثنين', textMessages: 0, voiceMessages: 0 },
                      { label: 'الثلاثاء', textMessages: 0, voiceMessages: 0 },
                      { label: 'الأربعاء', textMessages: 0, voiceMessages: 0 },
                      { label: 'الخميس', textMessages: 0, voiceMessages: 0 },
                      { label: 'الجمعة', textMessages: 0, voiceMessages: 0 },
                      { label: 'السبت', textMessages: 0, voiceMessages: 0 },
                      { label: 'الأحد', textMessages: 0, voiceMessages: 0 },
                    ]
              }
            />
          </div>
        </article>
      </div>
    </section>
  );
}
