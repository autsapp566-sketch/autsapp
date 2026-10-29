import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLead, sendLeadMessage, setLeadTakeover } from '../../api/client.js';
import { useLeadRealtime } from '../../hooks/useLeadRealtime.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../lib/access.js';

const senderStyles = {
  USER: 'ms-auto bg-slate-800 text-slate-100',
  BOT: 'me-auto bg-emerald-500/15 text-emerald-100 border border-emerald-500/25',
  AGENT: 'me-auto bg-indigo-600 text-white',
};

const senderLabels = {
  USER: 'العميل',
  BOT: 'البوت',
  AGENT: 'الوكيل',
};

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString('ar-MA', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return '';
  }
}

export default function LeadChatPanel({ leadId, onClose, onLeadChange }) {
  const [lead, setLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [takeoverBusy, setTakeoverBusy] = useState(false);
  const { user } = useAuth();
  const canTakeover = can(user, 'takeover');
  const canReply = can(user, 'reply');
  const bottomRef = useRef(null);

  const loadLead = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchLead(leadId);
      setLead(data.lead);
      setMessages(data.messages);
      onLeadChange?.(data.lead);
    } catch (err) {
      setError(err.message ?? 'تعذر تحميل المحادثة');
    } finally {
      setLoading(false);
    }
  }, [leadId, onLeadChange]);

  useEffect(() => {
    loadLead();
  }, [loadLead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const appendMessage = useCallback((message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });
  }, []);

  const applyLead = useCallback(
    (nextLead) => {
      setLead((prev) => ({ ...prev, ...nextLead }));
      onLeadChange?.(nextLead);
    },
    [onLeadChange]
  );

  useLeadRealtime({
    leadId,
    onMessage: appendMessage,
    onLeadUpdated: applyLead,
  });

  const isHandedOff = lead?.status === 'HANDED_OFF';

  async function handleTakeoverToggle() {
    setTakeoverBusy(true);
    setError('');
    try {
      const { lead: updated } = await setLeadTakeover(leadId, !isHandedOff);
      applyLead(updated);
    } catch (err) {
      setError(err.message ?? 'تعذر تحديث وضع التسليم');
    } finally {
      setTakeoverBusy(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) {
      return;
    }

    setSending(true);
    setError('');
    try {
      const { message, lead: updatedLead } = await sendLeadMessage(leadId, text);
      appendMessage(message);
      applyLead(updatedLead);
      setDraft('');
    } catch (err) {
      setError(err.message ?? 'تعذر إرسال الرسالة');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/70">
        <p className="text-sm text-slate-500">جاري تحميل المحادثة...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error || 'العميل غير موجود'}</div>
    );
  }

  return (
    <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <p className="text-lg font-bold text-white">{lead.name ?? lead.phone}</p>
          <p className="text-xs text-slate-500" dir="ltr">
            {lead.phone}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canTakeover ? (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={isHandedOff}
                disabled={takeoverBusy}
                onChange={handleTakeoverToggle}
              />
              <span>{isHandedOff ? 'التسليم مفعّل (AI متوقف)' : 'تفعيل التسليم / إيقاف AI'}</span>
            </label>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 lg:hidden"
            >
              إغلاق
            </button>
          ) : null}
        </div>
      </div>

      <div className="border-b border-slate-100 bg-amber-50/80 px-4 py-3">
        <p className="text-xs font-semibold text-amber-800">ملخص الذكاء الاصطناعي</p>
        <p className="mt-1 text-sm leading-relaxed text-amber-950">
          {lead.summary ?? 'لا يوجد ملخص بعد — سيظهر بعد أول تأهيل.'}
        </p>
        {lead.qualificationScore != null ? (
          <p className="mt-2 text-xs text-amber-800">درجة التأهيل: {lead.qualificationScore}/10</p>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${senderStyles[msg.sender] ?? ''}`}>
            <p className="mb-1 text-[10px] font-semibold opacity-70">{senderLabels[msg.sender] ?? msg.sender}</p>
            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            <p className="mt-1 text-[10px] opacity-60">{formatTime(msg.createdAt)}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <div className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      ) : null}

      {!canReply ? (
        <p className="border-t border-slate-800 p-4 text-center text-xs text-slate-500">
          عرض فقط — ليست لديك صلاحية الرد على العملاء.
        </p>
      ) : (
      <form onSubmit={handleSend} className="border-t border-slate-800 p-4">
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="اكتب ردك للعميل على واتساب..."
            className="min-h-[44px] flex-1 resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="self-end rounded-xl bg-ember-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {sending ? '...' : 'إرسال'}
          </button>
        </div>
        {!isHandedOff ? (
          <p className="mt-2 text-[11px] text-slate-500">لإيقاف البوت تلقائياً، فعّل «التسليم» قبل أو أثناء الرد.</p>
        ) : null}
      </form>
      )}
    </div>
  );
}
