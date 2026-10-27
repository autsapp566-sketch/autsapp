import { extractAdFromMessage, phoneFromGreenChatId } from './greenApiPayload.js';

/** "messages.upsert" / "MESSAGES_UPSERT" -> "MESSAGES_UPSERT" */
export function normalizeEvolutionEvent(event) {
  return String(event ?? '')
    .trim()
    .toUpperCase()
    .replace(/[.\-\s]/g, '_');
}

const WRAPPERS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'documentWithCaptionMessage',
  'deviceSentMessage',
];

/** Disappearing / view-once / edited messages wrap the real content one or two levels deep. */
function unwrapMessage(message) {
  let current = message && typeof message === 'object' ? message : {};
  let edited = false;
  for (let depth = 0; depth < 5; depth += 1) {
    const wrapper = WRAPPERS.find((w) => current[w]?.message);
    if (wrapper) {
      current = current[wrapper].message;
      continue;
    }
    const editedInner = current.editedMessage?.message;
    if (editedInner) {
      const proto = editedInner.protocolMessage;
      current = proto?.editedMessage ?? editedInner;
      edited = true;
      continue;
    }
    if (current.protocolMessage?.editedMessage) {
      current = current.protocolMessage.editedMessage;
      edited = true;
      continue;
    }
    break;
  }
  return { message: current, edited };
}

function textOf(message) {
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    ''
  );
}

/**
 * Parse an Evolution API v2 webhook (MESSAGES_UPSERT / MESSAGES_EDITED) into the same shape
 * as `parseGreenApiWebhook`, so both providers share one processing pipeline.
 * @param {unknown} body
 * @returns {null | {
 *   remoteJid: string, phone: string, text: string, pushName: string | null,
 *   idMessage: string | null, instanceId: string | null, isEdited: boolean, isGroup: false,
 *   ad: ReturnType<typeof extractAdFromMessage>,
 *   audio?: { messageId: string, mimeType: string, base64: string | null },
 * }}
 */
export function parseEvolutionWebhook(body) {
  if (!body || typeof body !== 'object') return null;

  const event = normalizeEvolutionEvent(body.event);
  if (event !== 'MESSAGES_UPSERT' && event !== 'MESSAGES_EDITED') return null;

  const data = Array.isArray(body.data) ? body.data[0] : body.data;
  const key = data?.key;
  if (!key || key.fromMe) return null;

  const remoteJid = String(key.remoteJid ?? '');
  if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@broadcast') || remoteJid.startsWith('status@')) {
    return null;
  }

  // New WhatsApp accounts are addressed by an opaque LID; the real phone travels in an alt field.
  const phoneJid = /@lid$/i.test(remoteJid)
    ? String(key.remoteJidAlt ?? key.senderPn ?? data.senderPn ?? remoteJid)
    : remoteJid;

  const { message, edited } = unwrapMessage(data.message);
  const instanceId = body.instance != null ? String(body.instance) : null;
  const common = {
    remoteJid,
    phone: phoneFromGreenChatId(phoneJid),
    pushName: data.pushName ? String(data.pushName) : null,
    idMessage: key.id ? String(key.id) : null,
    instanceId,
    isGroup: false,
  };

  if (message.audioMessage) {
    return {
      ...common,
      text: '',
      isEdited: false,
      ad: null,
      audio: {
        messageId: String(key.id ?? ''),
        mimeType: String(message.audioMessage.mimetype ?? 'audio/ogg'),
        base64: typeof data.message?.base64 === 'string' ? data.message.base64 : null,
      },
    };
  }

  const text = String(textOf(message)).trim();
  if (!text) return null;

  return {
    ...common,
    text,
    isEdited: edited || event === 'MESSAGES_EDITED',
    ad: extractAdFromMessage(message, text),
  };
}

/**
 * @param {unknown} body CONNECTION_UPDATE webhook
 * @returns {null | { instance: string, state: string, statusReason: number | null }}
 */
export function parseEvolutionConnectionUpdate(body) {
  if (!body || typeof body !== 'object') return null;
  if (normalizeEvolutionEvent(body.event) !== 'CONNECTION_UPDATE') return null;
  const data = Array.isArray(body.data) ? body.data[0] : body.data;
  const instance = String(body.instance ?? data?.instance ?? '');
  const state = String(data?.state ?? data?.status ?? '').toLowerCase();
  if (!instance || !state) return null;
  const reason = Number(data?.statusReason);
  return { instance, state, statusReason: Number.isFinite(reason) ? reason : null };
}
