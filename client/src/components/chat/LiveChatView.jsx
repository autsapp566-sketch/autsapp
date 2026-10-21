import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchLead,
  fetchLeads,
  sendLeadMessage,
  toggleLeadAi,
} from '../../api/client.js';
import { useSocket } from '../../context/SocketContext.jsx';
import { useLeadRealtime, useLeadsListRealtime } from '../../hooks/useLeadRealtime.js';

const QUICK_REPLIES = [
  'تأكيد الطلب 🚚',
  'طلب العنوان الكامل 📍',
  'إرسال رابط الكتالوج 📦',
  'شكراً لتواصلك، نرجو منك الانتظار قليلاً ⏳',
];

const FILTER_TABS = [
  { id: 'all', label: 'الكل', statuses: ['NEW', 'QUALIFYING', 'QUALIFIED', 'HANDED_OFF', 'REJECTED'] },
  { id: 'qualified', label: 'مؤهل', statuses: ['QUALIFIED'] },
  { id: 'handoff', label: 'تحت التسليم', statuses: ['HANDED_OFF'] },
  { id: 'human', label: 'تحكم بشري', statuses: ['HANDED_OFF'], humanOnly: true },
];

const SENDER_META = {
  USER: { label: 'العميل', tag: 'Customer' },
  BOT: { label: 'الذكاء الاصطناعي', tag: 'AI Agent' },
  AGENT: { label: 'الوكيل البشري', tag: 'Human Agent' },
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

function formatListTime(iso) {
  if (!iso) {
    return '';
  }
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ar-MA', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function formatBubbleTime(iso) {
  try {
    return new Date(iso).toLocaleString('ar-MA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function qualificationBadge(status) {
  if (status === 'HANDED_OFF') {
    return { text: 'تحت التسليم', className: 'bg-violet-500/20 text-violet-200 ring-violet-500/30' };
  }
  if (status === 'QUALIFIED') {
    return { text: 'مؤهل', className: 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/30' };
  }
  return { text: status, className: 'bg-slate-700/80 text-slate-300 ring-slate-600' };
}

function aiModeBadge(leadOrStatus) {
  const paused =
    typeof leadOrStatus === 'object'
      ? Boolean(leadOrStatus?.aiPaused)
      : leadOrStatus === 'HANDED_OFF';
  if (paused) {
    return { text: 'تحكم بشري 👤', sub: 'AI متوقف', className: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/30' };
  }
  return { text: 'AI Active', sub: 'البوت نشط', className: 'bg-sky-500/15 text-sky-200' };
}

function ChatToast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) {
      return undefined;
    }
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-xl border border-emerald-500/40 bg-[#111b21] px-4 py-3 text-sm text-[#e9edef] shadow-2xl shadow-black/50"
    >
      {message}
    </div>
  );
}

function previewText(msg) {
  if (!msg?.content) {
    return 'لا توجد رسائل بعد';
  }
  const t = msg.content.replace(/\s+/g, ' ').trim();
  return t.length > 72 ? `${t.slice(0, 72)}…` : t;
}

function bubbleClasses(sender) {
  const outbound = sender === 'BOT' || sender === 'AGENT';
  if (outbound) {
    if (sender === 'BOT') {
      return 'ms-auto bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-br-md shadow-md';
    }
    return 'ms-auto bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-br-md shadow-md ring-1 ring-indigo-400/30';
  }
  return 'me-auto bg-[#202c33] text-[#e9edef] rounded-2xl rounded-bl-md shadow-sm border border-[#2a3942]';
}

function ConversationPanel({ leadId, onLeadChange, onMobileBack, onToast }) {
  const [lead, setLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [takeoverBusy, setTakeoverBusy] = useState(false);
  const bottomRef = useRef(null);
  const socket = useSocket();

  const loadLead = useCallback(async () => {
    if (!leadId) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchLead(leadId);
      setLead(data.lead);
      setMessages(data.messages);
      onLeadChange?.(data.lead, data.messages);
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
  }, [messages, leadId]);

  useEffect(() => {
    if (!leadId || socket) {
      return undefined;
    }
    const id = setInterval(() => {
      fetchLead(leadId)
        .then((data) => {
          setLead(data.lead);
          setMessages(data.messages);
          onLeadChange?.(data.lead, data.messages);
        })
        .catch(() => {});
    }, 8000);
    return () => clearInterval(id);
  }, [leadId, socket, onLeadChange]);

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

  const isAiPaused = Boolean(lead?.aiPaused);
  const qual = lead ? qualificationBadge(lead.status) : null;

  async function handleTakeoverToggle(pauseAi) {
    setTakeoverBusy(true);
    setError('');
    try {
      const { lead: updated } = await toggleLeadAi(leadId, pauseAi);
      applyLead(updated);
      onToast?.(
        pauseAi
          ? 'تم إيقاف البوت بنجاح — يمكنك الآن التحدث مع الزبون مباشرة'
          : 'تم إعادة تفعيل الرد الآلي للذكاء الاصطناعي'
      );
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
      <div className="flex h-full min-h-[480px] flex-col items-center justify-center bg-[#0b141a]">
        <div className="h-10 w-10 animate-pulse rounded-full bg-[#202c33]" />
        <p className="mt-4 text-sm text-[#8696a0]">جاري تحميل المحادثة...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0b141a] p-6 text-sm text-red-300">
        {error || 'العميل غير موجود'}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b141a]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#2a3942] bg-[#202c33] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {onMobileBack ? (
            <button
              type="button"
              onClick={onMobileBack}
              className="rounded-lg p-2 text-[#aebac1] hover:bg-[#2a3942] lg:hidden"
              aria-label="رجوع"
            >
              ←
            </button>
          ) : null}
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#6b7c85] text-lg font-bold text-white"
            aria-hidden
          >
            {(lead.name ?? lead.phone).slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[#e9edef]">{lead.name ?? 'عميل'}</p>
            <p className="truncate text-xs text-[#8696a0]" dir="ltr">
              {lead.phone}
            </p>
          </div>
          {qual ? (
            <span
              className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 sm:inline ${qual.className}`}
            >
              {qual.text}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAiPaused ? (
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-100 ring-1 ring-amber-500/40">
              تحكم بشري 👤
            </span>
          ) : null}
          {isAiPaused ? (
            <button
              type="button"
              disabled={takeoverBusy}
              onClick={() => handleTakeoverToggle(false)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <span aria-hidden>▶</span>
              {takeoverBusy ? '...' : 'إعادة تفعيل الذكاء الاصطناعي (Resume AI)'}
            </button>
          ) : (
            <button
              type="button"
              disabled={takeoverBusy}
              onClick={() => handleTakeoverToggle(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-orange-500/50 bg-orange-600/90 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-orange-900/25 transition hover:bg-orange-500 disabled:opacity-50"
            >
              <span aria-hidden>⏸</span>
              {takeoverBusy ? '...' : 'إيقاف البوت / استلام بشري (Takeover)'}
            </button>
          )}
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(0,92,75,0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgba(32,44,51,0.5), transparent 45%)',
        }}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#8696a0]">ابدأ المحادثة — لا توجد رسائل بعد.</p>
          ) : (
            messages.map((msg) => {
              const meta = SENDER_META[msg.sender] ?? { label: msg.sender, tag: msg.sender };
              const outbound = msg.sender === 'BOT' || msg.sender === 'AGENT';
              return (
                <div
                  key={msg.id}
                  className={`flex max-w-[min(100%,28rem)] flex-col ${outbound ? 'items-end ms-auto' : 'items-start me-auto'}`}
                >
                  <div className={`px-3 py-2 ${bubbleClasses(msg.sender)}`}>
                    <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-[#8696a0]">
                      <span>{meta.label}</span>
                      <span className="opacity-60">·</span>
                      <span className="opacity-80">{meta.tag}</span>
                    </p>
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                    <p className="mt-1 text-end text-[10px] text-[#8696a0]/90">{formatBubbleTime(msg.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {error ? (
        <div className="mx-4 mb-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      ) : null}

      <footer className="shrink-0 border-t border-[#2a3942] bg-[#202c33] px-3 py-3 sm:px-4">
        <div className="mb-2 flex flex-wrap gap-2">
          <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-[#8696a0] sm:w-auto">
            الردود السريعة
          </span>
          {QUICK_REPLIES.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => setDraft(text)}
              className="rounded-full border border-[#2a3942] bg-[#2a3942] px-3 py-1 text-xs text-[#d1d7db] transition hover:border-emerald-600/50 hover:bg-[#233138]"
            >
              {text}
            </button>
          ))}
        </div>
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder={
              isAiPaused
                ? 'اكتب ردك — سيُرسل مباشرة عبر واتساب للزبون'
                : 'للرد اليدوي يُفضّل إيقاف البوت أولاً (استلام بشري)'
            }
            className="max-h-32 min-h-[44px] flex-1 resize-y rounded-xl border border-[#2a3942] bg-[#2a3942] px-3 py-2.5 text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0] focus:border-emerald-600/60 focus:ring-1 focus:ring-emerald-600/30"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="shrink-0 rounded-xl bg-[#00a884] px-4 py-2.5 text-sm font-bold text-[#111b21] transition hover:bg-[#06cf9c] disabled:opacity-40"
          >
            {sending ? '...' : 'إرسال عبر الواتساب'}
          </button>
        </form>
      </footer>
    </div>
  );
}

function EmptyChatPlaceholder() {
  return (
    <div className="flex h-full min-h-[480px] flex-col items-center justify-center bg-[#222e35] px-8 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#2a3942] text-5xl opacity-90">
        💬
      </div>
      <h3 className="text-xl font-semibold text-[#e9edef]">اختر عميلاً لعرض المحادثة</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[#8696a0]">
        من القائمة على اليمين، اختر محادثة لمتابعة الرسائل، إيقاف البوت، أو الرد يدوياً عبر واتساب.
      </p>
      <p className="mt-4 text-xs text-[#667781]">التحديثات تصل فوراً عند اتصال Socket — أو كل 8 ثوانٍ كاحتياط.</p>
    </div>
  );
}

export default function LiveChatView({ title = 'محادثات مباشرة', subtitle }) {
  const [filterId, setFilterId] = useState('all');
  const [search, setSearch] = useState('');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [takeoverId, setTakeoverId] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [toast, setToast] = useState('');
  const socket = useSocket();

  const activeFilter = FILTER_TABS.find((t) => t.id === filterId) ?? FILTER_TABS[0];

  const loadLeads = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      setError('');
      try {
        const data = await fetchLeads(activeFilter.statuses);
        setLeads(data.leads);
      } catch (err) {
        setError(err.message ?? 'تعذر تحميل العملاء');
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [activeFilter.statuses]
  );

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    if (socket) {
      return undefined;
    }
    const id = setInterval(() => loadLeads(true), 8000);
    return () => clearInterval(id);
  }, [socket, loadLeads]);

  const onLeadUpdated = useCallback(
    (payload) => {
      if (!payload?.lead) {
        return;
      }
      setLeads((prev) => mergeLead(prev, payload.lead));
    },
    []
  );

  const onQualified = useCallback((payload) => {
    if (payload?.lead) {
      setLeads((prev) => mergeLead(prev, payload.lead));
    }
  }, []);

  const onMessage = useCallback(
    (payload) => {
      if (!payload?.leadId || !payload?.message) {
        loadLeads();
        return;
      }
      setLeads((prev) =>
        prev.map((l) =>
          l.id === payload.leadId
            ? {
                ...l,
                updatedAt: payload.message.createdAt,
                lastMessage: {
                  content: payload.message.content,
                  sender: payload.message.sender,
                  createdAt: payload.message.createdAt,
                },
              }
            : l
        )
      );
    },
    [loadLeads]
  );

  useLeadsListRealtime({ onLeadUpdated, onQualified, onMessage });

  const visibleLeads = useMemo(() => {
    let list = [...leads];
    if (activeFilter.humanOnly) {
      list = list.filter((l) => l.aiPaused && l.assignedToId);
    }
    const q = search.trim().toLowerCase();
    if (!q) {
      return list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    return list
      .filter((l) => {
        const name = (l.name ?? '').toLowerCase();
        const phone = (l.phone ?? '').toLowerCase();
        return name.includes(q) || phone.includes(q);
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [leads, search, activeFilter.humanOnly]);

  const handleLeadChange = useCallback((lead, messages) => {
    setLeads((prev) => {
      const lastMsg =
        messages?.length > 0
          ? messages[messages.length - 1]
          : lead.lastMessage && lead.lastMessage.content
            ? lead.lastMessage
            : null;
      return mergeLead(prev, {
        ...lead,
        ...(lastMsg
          ? {
              lastMessage: {
                content: lastMsg.content,
                sender: lastMsg.sender,
                createdAt: lastMsg.createdAt,
              },
            }
          : {}),
      });
    });
  }, []);

  async function handleTakeOver(leadId, e) {
    e.stopPropagation();
    setTakeoverId(leadId);
    setError('');
    try {
      const { lead } = await toggleLeadAi(leadId, true);
      setLeads((prev) => mergeLead(prev, lead));
      setSelectedId(leadId);
      setMobileShowChat(true);
      setToast('تم إيقاف البوت بنجاح — يمكنك الآن التحدث مع الزبون مباشرة');
    } catch (err) {
      setError(err.message ?? 'تعذر تفعيل التسليم');
    } finally {
      setTakeoverId(null);
    }
  }

  function selectLead(id) {
    setSelectedId(id);
    setMobileShowChat(true);
  }

  return (
    <section className="flex h-[calc(100vh-7.5rem)] min-h-[560px] flex-col gap-3">
      <div className="shrink-0 px-1">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p> : null}
      </div>

      {error ? (
        <div className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl border border-[#2a3942] shadow-xl lg:grid-cols-[1fr_minmax(300px,380px)]">
        {/* Left: active conversation (WhatsApp chat pane) */}
        <div
          className={[
            'min-h-0 border-[#2a3942] lg:border-e',
            mobileShowChat && selectedId ? 'flex flex-col' : 'hidden lg:flex lg:flex-col',
          ].join(' ')}
        >
          {selectedId ? (
            <ConversationPanel
              leadId={selectedId}
              onLeadChange={handleLeadChange}
              onMobileBack={() => setMobileShowChat(false)}
              onToast={setToast}
            />
          ) : (
            <EmptyChatPlaceholder />
          )}
        </div>

        {/* Right: conversation list */}
        <aside
          className={[
            'flex min-h-0 flex-col bg-[#111b21]',
            mobileShowChat && selectedId ? 'hidden lg:flex' : 'flex',
          ].join(' ')}
        >
          <div className="shrink-0 space-y-3 border-b border-[#2a3942] bg-[#202c33] p-3">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[#8696a0]">
                🔍
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو الهاتف..."
                className="w-full rounded-lg border border-[#2a3942] bg-[#2a3942] py-2.5 pe-3 ps-10 text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0] focus:border-emerald-600/50"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterId(tab.id)}
                  className={[
                    'rounded-full px-3 py-1 text-[11px] font-semibold transition',
                    filterId === tab.id
                      ? 'bg-[#00a884] text-[#111b21]'
                      : 'bg-[#2a3942] text-[#aebac1] hover:bg-[#233138]',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-[#202c33]" />
                ))}
              </div>
            ) : visibleLeads.length === 0 ? (
              <p className="p-8 text-center text-sm text-[#8696a0]">لا توجد محادثات لهذا الفلتر.</p>
            ) : (
              <ul className="divide-y divide-[#2a3942]/80">
                {visibleLeads.map((lead) => {
                  const selected = selectedId === lead.id;
                  const qual = qualificationBadge(lead.status);
                  const ai = aiModeBadge(lead);
                  const ts = lead.lastMessage?.createdAt ?? lead.updatedAt;
                  return (
                    <li key={lead.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => selectLead(lead.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectLead(lead.id);
                          }
                        }}
                        className={[
                          'w-full cursor-pointer px-3 py-3 text-start transition',
                          selected
                            ? 'bg-[#2a3942]/90 shadow-[inset_3px_0_0_0_#00a884] ring-1 ring-emerald-500/25'
                            : 'hover:bg-[#202c33]',
                        ].join(' ')}
                      >
                        <div className="flex gap-3">
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#6b7c85] text-lg font-bold text-white"
                            aria-hidden
                          >
                            {(lead.name ?? lead.phone).slice(0, 1)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate font-semibold text-[#e9edef]">{lead.name ?? '—'}</p>
                              <span className="shrink-0 text-[10px] text-[#8696a0]">{formatListTime(ts)}</span>
                            </div>
                            <p className="text-xs text-[#8696a0]" dir="ltr">
                              {lead.phone}
                            </p>
                            <p className="mt-1 line-clamp-1 text-xs text-[#aebac1]">{previewText(lead.lastMessage)}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ${qual.className}`}
                              >
                                {qual.text}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${ai.className}`}>
                                {ai.text}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleTakeOver(lead.id, e)}
                                disabled={takeoverId === lead.id || lead.aiPaused}
                                className="ms-auto rounded-md bg-[#00a884]/90 px-2 py-0.5 text-[10px] font-semibold text-[#111b21] disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                {takeoverId === lead.id ? '...' : 'استلام'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
      <ChatToast message={toast} onDismiss={() => setToast('')} />
    </section>
  );
}
