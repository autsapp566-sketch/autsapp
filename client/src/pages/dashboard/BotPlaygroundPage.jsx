import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchBotPlaygroundStatus, sendBotPlaygroundMessage } from '../../api/client.js';

const WELCOME_MESSAGE = {
  id: 'welcome',
  sender: 'BOT',
  content:
    'السلام عليكم! أنا المساعد الذكي والصوتي، أستطيع فهم الرسائل النصية والصوتية والإجابة عليها فوراً.',
  createdAt: new Date().toISOString(),
};

function formatTime(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    if (Math.abs(now - d) < 60_000) {
      return 'الآن';
    }
    return d.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'الآن';
  }
}

function newId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function BotPlaygroundPage() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openAiReady, setOpenAiReady] = useState(true);
  const [recording, setRecording] = useState(false);
  const bottomRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    fetchBotPlaygroundStatus()
      .then((s) => setOpenAiReady(Boolean(s.openAiConfigured)))
      .catch(() => setOpenAiReady(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const historyForApi = useCallback(
    () =>
      messages
        .filter((m) => m.id !== 'welcome' || messages.length > 1)
        .map((m) => ({ sender: m.sender, content: m.content, createdAt: m.createdAt })),
    [messages]
  );

  async function runChat({ userMessage, audioBase64, audioMime }) {
    setBusy(true);
    setError('');
    try {
      const data = await sendBotPlaygroundMessage({
        history: historyForApi(),
        userMessage,
        audioBase64,
        audioMime,
      });

      setMessages((prev) => {
        const next = [...prev];
        if (data.userMessage?.content) {
          next.push({
            id: newId(),
            sender: 'USER',
            content: data.userMessage.content,
            createdAt: new Date().toISOString(),
          });
        }
        if (data.botMessage?.content) {
          next.push({
            id: newId(),
            sender: 'BOT',
            content: data.botMessage.content,
            createdAt: new Date().toISOString(),
            audioBase64: data.voice?.replyAudioBase64 ?? null,
            qualification: data.qualification,
          });
        }
        return next;
      });
      setDraft('');
    } catch (err) {
      setError(err.message ?? 'تعذر الحصول على رد البوت');
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) {
      return;
    }
    await runChat({ userMessage: text });
  }

  function clearConversation() {
    setMessages([{ ...WELCOME_MESSAGE, id: 'welcome', createdAt: new Date().toISOString() }]);
    setError('');
    setDraft('');
  }

  async function startRecording() {
    if (busy || recording) {
      return;
    }
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        await runChat({ audioBase64: base64, audioMime: mime });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError('تعذر الوصول للميكروفون — تحقق من صلاحيات المتصفح');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">اختبار البوت والصوت</h2>
          <p className="mt-1 text-sm text-slate-400">تجربة الدردشة والصوتيات قبل الإطلاق</p>
        </div>
        <span className="rounded-full bg-ember-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-ember-700/30">
          البوت: شغال أوتوماتيكياً
        </span>
      </div>

      {!openAiReady ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          أضف مفتاح OpenAI من{' '}
          <a href="/dashboard/settings" className="font-semibold underline">
            إعدادات الصوت والذكاء
          </a>{' '}
          لتفعيل الردود الحقيقية.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 bg-slate-900 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-white">تجربة المساعد الذكي والصوت</h3>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              اختبر الرد بالنص، الصور، والرسائل الصوتية المحاكية للواتساب.
            </p>
          </div>
          <button
            type="button"
            onClick={clearConversation}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            <span aria-hidden>🗑</span>
            مسح المحادثة
          </button>
        </div>

        <div
          className="min-h-[360px] max-h-[52vh] space-y-3 overflow-y-auto px-5 py-6"
          style={{
            background:
              'linear-gradient(180deg, rgba(15,23,42,0.6) 0%, rgba(2,6,23,0.95) 100%)',
          }}
        >
          {messages.map((msg) => {
            const isBot = msg.sender === 'BOT';
            return (
              <div
                key={msg.id}
                className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={[
                    'max-w-[min(100%,22rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md',
                    isBot
                      ? 'rounded-bl-md bg-slate-800 text-slate-100 ring-1 ring-slate-700'
                      : 'rounded-br-md bg-emerald-700/90 text-white',
                  ].join(' ')}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.audioBase64 ? (
                    <audio
                      controls
                      className="mt-2 w-full max-w-xs"
                      src={`data:audio/mpeg;base64,${msg.audioBase64}`}
                    >
                      <track kind="captions" />
                    </audio>
                  ) : null}
                  {msg.qualification ? (
                    <p className="mt-2 border-t border-slate-600/50 pt-2 text-[10px] text-slate-400">
                      تأهيل: {msg.qualification.score}/10 — {msg.qualification.status}
                    </p>
                  ) : null}
                  <p className="mt-2 text-end text-[10px] opacity-60">{formatTime(msg.createdAt)}</p>
                </div>
              </div>
            );
          })}
          {busy ? (
            <p className="text-center text-xs text-slate-500">البوت يفكر...</p>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <div className="mx-5 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        ) : null}

        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 border-t border-slate-800 bg-slate-950/90 px-4 py-4"
        >
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-lg text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
            aria-label="إرسال"
          >
            ➤
          </button>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            placeholder="اكتب رسالتك أو جرب إرسال تسجيل صوتي..."
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
          />
          <button
            type="button"
            onClick={() => {
              if (recording) {
                stopRecording();
              } else {
                startRecording();
              }
            }}
            disabled={busy}
            className={[
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg transition',
              recording
                ? 'border-red-500 bg-red-500/20 text-red-300 animate-pulse'
                : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700',
            ].join(' ')}
            aria-label="تسجيل صوتي"
          >
            🎤
          </button>
        </form>
        <p className="border-t border-slate-800/80 px-4 py-2 text-center text-[10px] text-slate-600">
          اضغط على الميكروفون للتسجيل ثم اضغط مجدداً للإيقاف — لا يُرسل شيء إلى واتساب حقيقي
        </p>
      </div>
    </section>
  );
}
