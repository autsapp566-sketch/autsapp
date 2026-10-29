import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchLeads, setLeadTakeover } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../lib/access.js';
import { useLeadsListRealtime } from '../../hooks/useLeadRealtime.js';
import LeadChatPanel from './LeadChatPanel.jsx';

const STATUS_FILTERS = [
  { value: 'QUALIFIED', label: 'مؤهل' },
  { value: 'HANDED_OFF', label: 'تحت التسليم' },
];

const statusBadge = {
  QUALIFIED: 'bg-emerald-500/20 text-emerald-300',
  HANDED_OFF: 'bg-violet-500/20 text-violet-300',
};

function mergeLead(list, lead) {
  const idx = list.findIndex((l) => l.id === lead.id);
  if (idx === -1) {
    return [lead, ...list];
  }
  const next = [...list];
  next[idx] = { ...next[idx], ...lead };
  return next;
}

export default function LeadManagementView({ title, subtitle }) {
  const [activeStatuses, setActiveStatuses] = useState(['QUALIFIED', 'HANDED_OFF']);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [takeoverId, setTakeoverId] = useState(null);
  const { user } = useAuth();
  const canTakeover = can(user, 'takeover');

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchLeads(activeStatuses);
      setLeads(data.leads);
    } catch (err) {
      setError(err.message ?? 'تعذر تحميل العملاء');
    } finally {
      setLoading(false);
    }
  }, [activeStatuses]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const onLeadUpdated = useCallback(
    (payload) => {
      if (!payload?.lead) {
        return;
      }
      setLeads((prev) => {
        const merged = mergeLead(prev, payload.lead);
        return merged.filter((l) => activeStatuses.includes(l.status));
      });
    },
    [activeStatuses]
  );

  const onQualified = useCallback(
    (payload) => {
      if (payload?.lead && activeStatuses.includes('QUALIFIED')) {
        setLeads((prev) => mergeLead(prev, payload.lead));
      }
    },
    [activeStatuses]
  );

  const onMessage = useCallback(() => {
    loadLeads();
  }, [loadLeads]);

  useLeadsListRealtime({ onLeadUpdated, onQualified, onMessage });

  const visibleLeads = useMemo(() => leads, [leads]);

  function toggleStatus(value) {
    setActiveStatuses((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((s) => s !== value);
        return next.length ? next : prev;
      }
      return [...prev, value];
    });
  }

  async function handleTakeOver(leadId, e) {
    e.stopPropagation();
    setTakeoverId(leadId);
    setError('');
    try {
      const { lead } = await setLeadTakeover(leadId, true);
      setLeads((prev) => mergeLead(prev, lead));
      setSelectedId(leadId);
    } catch (err) {
      setError(err.message ?? 'تعذر تفعيل التسليم');
    } finally {
      setTakeoverId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = activeStatuses.includes(f.value);
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => toggleStatus(f.value)}
              className={[
                'rounded-full px-4 py-1.5 text-xs font-medium transition',
                active ? 'bg-ember-500 text-white' : 'bg-slate-800 text-slate-300 ring-1 ring-slate-700',
              ].join(' ')}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          {loading ? (
            <p className="text-sm text-slate-500">جاري التحميل...</p>
          ) : visibleLeads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
              لا يوجد عملاء لهذه الفلاتر.
            </div>
          ) : (
            visibleLeads.map((lead) => (
              <article
                key={lead.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(lead.id)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedId(lead.id)}
                className={[
                  'cursor-pointer rounded-2xl border bg-slate-900/70 p-4 transition hover:border-emerald-500/40',
                  selectedId === lead.id ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-800',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{lead.name ?? '—'}</p>
                    <p className="text-sm text-slate-400" dir="ltr">
                      {lead.phone}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge[lead.status] ?? 'bg-slate-100 text-slate-600'}`}
                  >
                    {lead.status}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">
                  {lead.summary ?? 'بدون ملخص'}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-400">
                    {lead.qualificationScore != null ? `${lead.qualificationScore}/10` : '—'}
                  </span>
                  {canTakeover ? (
                    <button
                      type="button"
                      onClick={(e) => handleTakeOver(lead.id, e)}
                      disabled={takeoverId === lead.id || lead.status === 'HANDED_OFF'}
                      className="rounded-lg bg-ember-500 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {takeoverId === lead.id ? '...' : 'استلام / Take Over'}
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>

        <div className="lg:col-span-3">
          {selectedId ? (
            <LeadChatPanel
              leadId={selectedId}
              onClose={() => setSelectedId(null)}
              onLeadChange={(lead) => setLeads((prev) => mergeLead(prev, lead))}
            />
          ) : (
            <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
              اختر عميلاً لعرض المحادثة والرد عبر واتساب
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
