import { prisma } from '../lib/prisma.js';
import { getAppSetting, setAppSetting } from './appSettings.js';
import { sendWhatsAppText } from './whatsappMessaging.js';

const SETTING_KEY = 'handoffForward';
const MAX_NUMBERS = 5;

/**
 * Normalise a phone typed by a human into international digits (no +).
 * Moroccan local format 06xxxxxxxx / 07xxxxxxxx becomes 2126xxxxxxxx.
 * @param {unknown} input
 * @returns {string | null}
 */
export function normalizeWhatsappNumber(input) {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    digits = `212${digits.slice(1)}`;
  }
  if (digits.length < 8 || digits.length > 15) {
    return null;
  }
  return digits;
}

export async function getHandoffForwardSettings() {
  const stored = await getAppSetting(SETTING_KEY);
  const numbers = Array.isArray(stored?.numbers)
    ? stored.numbers.map(normalizeWhatsappNumber).filter(Boolean)
    : [];
  return { enabled: stored?.enabled !== false, numbers: [...new Set(numbers)].slice(0, MAX_NUMBERS) };
}

/**
 * @param {{ enabled?: boolean, numbers?: unknown[] }} input
 */
export async function saveHandoffForwardSettings(input) {
  const raw = Array.isArray(input?.numbers) ? input.numbers : [];
  const numbers = [];
  const invalid = [];
  for (const n of raw) {
    const normalized = normalizeWhatsappNumber(n);
    if (normalized) {
      if (!numbers.includes(normalized)) numbers.push(normalized);
    } else if (String(n ?? '').trim()) {
      invalid.push(String(n));
    }
  }
  if (invalid.length) {
    const err = new Error(`رقم غير صالح: ${invalid.join('، ')}`);
    err.status = 400;
    err.expose = true;
    throw err;
  }
  if (numbers.length > MAX_NUMBERS) {
    const err = new Error(`الحد الأقصى ${MAX_NUMBERS} أرقام`);
    err.status = 400;
    err.expose = true;
    throw err;
  }
  const value = { enabled: input?.enabled !== false, numbers };
  await setAppSetting(SETTING_KEY, value);
  return value;
}

const SENDER_LABEL = { USER: 'العميل', BOT: 'البوت', AGENT: 'الموظفة' };

function clip(text, max) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function describeMessage(content) {
  return /^\[VOICE:/.test(content) ? '🎤 رسالة صوتية' : clip(content, 160);
}

async function buildForwardText(lead, reason) {
  const recent = await prisma.message.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });
  const history = recent
    .reverse()
    .map((m) => `${SENDER_LABEL[m.sender] ?? m.sender}: ${describeMessage(m.content)}`)
    .join('\n');

  const lines = [
    '🔔 محادثة جديدة تحتاج متابعة بشرية',
    reason ? `📌 السبب: ${reason}` : null,
    `👤 العميل: ${lead.name || 'غير معروف'}`,
    `📞 الرقم: +${lead.phone}`,
    `💬 افتح المحادثة: https://wa.me/${String(lead.phone).replace(/\D/g, '')}`,
    lead.summary ? `📝 الملخص: ${clip(lead.summary, 300)}` : null,
    history ? `\n— آخر الرسائل —\n${history}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * Notify the configured WhatsApp numbers that a chat moved to human control / handoff.
 * Never throws: forwarding problems must not break the bot flow.
 * @param {{ id: string, phone: string, name?: string | null, summary?: string | null }} lead
 * @param {{ reason?: string, force?: boolean, instance?: string }} [opts]
 * @returns {Promise<{ sent: string[], failed: { number: string, error: string }[] }>}
 */
export async function forwardHandoffToAgents(lead, opts = {}) {
  const result = { sent: [], failed: [] };
  try {
    const settings = await getHandoffForwardSettings();
    if ((!settings.enabled && !opts.force) || settings.numbers.length === 0) {
      return result;
    }
    const text = await buildForwardText(lead, opts.reason);
    for (const number of settings.numbers) {
      // Never message the customer's own number (would look like a loop).
      if (number === String(lead.phone).replace(/\D/g, '')) {
        continue;
      }
      try {
        await sendWhatsAppText({ phone: number, text, instance: opts.instance });
        result.sent.push(number);
      } catch (err) {
        console.error('[handoff-forward] send failed:', number, err.message);
        result.failed.push({ number, error: err.message });
      }
    }
  } catch (err) {
    console.error('[handoff-forward] failed:', err.message);
  }
  return result;
}

/** Send a sample message to every configured number (used by the "test" button). */
export async function sendHandoffForwardTest() {
  const settings = await getHandoffForwardSettings();
  if (settings.numbers.length === 0) {
    const err = new Error('أضف رقماً واحداً على الأقل ثم احفظ');
    err.status = 400;
    err.expose = true;
    throw err;
  }
  const text =
    '🔔 اختبار: ستصلك هنا إشعارات المحادثات التي تنتقل إلى التحكم البشري أو التسليم، مع رقم العميل ورابط فتح المحادثة.';
  const result = { sent: [], failed: [] };
  for (const number of settings.numbers) {
    try {
      await sendWhatsAppText({ phone: number, text });
      result.sent.push(number);
    } catch (err) {
      result.failed.push({ number, error: err.message });
    }
  }
  return result;
}
