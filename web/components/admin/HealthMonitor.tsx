'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HealthInstance, SystemHealth } from '@/lib/adminTypes';
import { formatDateTime, formatNumber, formatUptime } from '@/lib/format';
import { SystemStatusBadge } from './StatusBadges';
import { Badge, Card, EmptyState, SectionTitle, type Tone } from './ui';

const POLL_MS = 15_000;

export function HealthMonitor({ initial }: { initial: SystemHealth }) {
  const [health, setHealth] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async (force: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/admin/api/health${force ? '?refresh=1' : ''}`, { cache: 'no-store' });
      if (res.status === 401) {
        window.location.assign('/login?callbackUrl=/admin/system');
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setHealth(body as SystemHealth);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحديث');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load(false);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const { evolution, database, redis, summary } = health;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SystemStatusBadge status={health.status} />
          <span className="text-xs text-slate-500">
            آخر فحص: {formatDateTime(health.checkedAt)} · تحديث تلقائي كل {POLL_MS / 1000} ثانية
          </span>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
        >
          {loading ? 'جارٍ الفحص…' : 'فحص الآن'}
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          تعذّر تحديث البيانات: {error}. تُعرض آخر نتيجة ناجحة.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <ServiceCard
          name="Evolution API"
          tone={!evolution.configured ? 'slate' : evolution.reachable && evolution.apiKeyOk !== false ? 'emerald' : 'red'}
          state={
            !evolution.configured && !evolution.reachable
              ? 'غير مضبوط'
              : !evolution.reachable
                ? 'لا يستجيب'
                : evolution.apiKeyOk === false
                  ? 'مفتاح/قاعدة بيانات Evolution بها خلل'
                  : 'يعمل'
          }
          rows={[
            ['الإصدار', evolution.version ?? '—'],
            ['زمن الاستجابة', evolution.latencyMs !== null ? `${evolution.latencyMs} ms` : '—'],
          ]}
          error={evolution.error}
        />
        <ServiceCard
          name="قاعدة البيانات (PostgreSQL)"
          tone={database.ok ? 'emerald' : 'red'}
          state={database.ok ? 'متصلة' : 'غير متاحة'}
          rows={[['زمن الاستجابة', database.latencyMs !== null ? `${database.latencyMs} ms` : '—']]}
          error={database.error}
        />
        <ServiceCard
          name="Redis"
          tone={!redis.configured ? 'slate' : redis.ok ? 'emerald' : 'red'}
          state={!redis.configured ? 'غير مضبوط' : redis.ok ? 'متصل' : 'غير متاح'}
          rows={[['زمن الاستجابة', redis.latencyMs !== null ? `${redis.latencyMs} ms` : '—']]}
          error={redis.error}
        />
      </div>

      <Card>
        <SectionTitle
          title="جلسات Evolution API"
          aside={
            <span className="text-xs text-slate-500">
              {formatNumber(summary.open)} متصل · {formatNumber(summary.connecting)} قيد الاتصال · {formatNumber(summary.closed)} مفصول
            </span>
          }
        />
        {summary.untracked > 0 || (summary.missingOnServer ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-2 border-b border-slate-800 px-5 py-3 text-xs">
            {summary.untracked > 0 ? (
              <Badge tone="amber">{summary.untracked} جلسة على Evolution بلا مستأجر في قاعدة البيانات</Badge>
            ) : null}
            {(summary.missingOnServer ?? 0) > 0 ? (
              <Badge tone="amber">{summary.missingOnServer} رقم مسجّل لدينا غير موجود على Evolution</Badge>
            ) : null}
          </div>
        ) : null}
        <InstancesTable instances={health.instances} reachable={evolution.reachable && evolution.apiKeyOk === true} />
      </Card>

      <p className="text-xs text-slate-600">
        خادم الـ API: تشغيل {formatUptime(health.process.uptimeSeconds)} · ذاكرة {health.process.memoryMb} MB · Node {health.process.node}
      </p>
    </div>
  );
}

function ServiceCard({
  name,
  tone,
  state,
  rows,
  error,
}: {
  name: string;
  tone: Tone;
  state: string;
  rows: [string, string][];
  error: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{name}</h3>
        <Badge tone={tone} dot>
          {state}
        </Badge>
      </div>
      <dl className="mt-4 space-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-slate-200" dir="ltr">
              {v}
            </dd>
          </div>
        ))}
      </dl>
      {error ? (
        <p className="mt-3 break-words text-xs leading-5 text-red-300" dir="ltr" style={{ textAlign: 'right' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const STATE: Record<string, { tone: Tone; label: string }> = {
  open: { tone: 'emerald', label: 'متصل' },
  connecting: { tone: 'amber', label: 'قيد الاتصال' },
  close: { tone: 'red', label: 'مفصول' },
};

function InstancesTable({ instances, reachable }: { instances: HealthInstance[]; reachable: boolean }) {
  if (!reachable) return <EmptyState>Evolution API غير متاح — لا يمكن عرض الجلسات.</EmptyState>;
  if (instances.length === 0) return <EmptyState>لا توجد جلسات على خادم Evolution.</EmptyState>;

  const th = 'px-4 py-3 text-right text-xs font-medium text-slate-500';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="border-b border-slate-800 bg-slate-900/60">
          <tr>
            <th className={th}>الجلسة</th>
            <th className={th}>الحالة</th>
            <th className={th}>الرقم</th>
            <th className={th}>الرسائل</th>
            <th className={th}>المستأجر</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {instances.map((i) => {
            const s = STATE[i.state] ?? { tone: 'slate' as Tone, label: i.state };
            return (
              <tr key={i.name}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-100" dir="ltr" style={{ textAlign: 'right' }}>
                    {i.name}
                  </p>
                  {i.profileName ? <p className="text-xs text-slate-500">{i.profileName}</p> : null}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={s.tone} dot>
                    {s.label}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-300" dir="ltr" style={{ textAlign: 'right' }}>
                  {i.number ? `+${i.number}` : '—'}
                </td>
                <td className="px-4 py-3 text-slate-400" dir="ltr" style={{ textAlign: 'right' }}>
                  {i.counts.messages !== null ? formatNumber(i.counts.messages) : '—'}
                </td>
                <td className="px-4 py-3">{i.tracked ? <Badge tone="sky">مرتبط</Badge> : <Badge tone="amber">غير مرتبط</Badge>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
