const MESSAGE_EVENTS = new Set(['messages.upsert', 'MESSAGES_UPSERT']);

/**
 * @param {unknown} payload
 * @returns {{
 *   instance: string,
 *   remoteJid: string,
 *   text: string | null,
 *   fromMe: boolean,
 *   pushName: string | null,
 *   messageId: string | null,
 *   audioBase64: string | null,
 *   audioMimeType: string | null,
 * } | null}
 */
export function parseEvolutionWhatsAppMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const event = payload.event;
  if (event && !MESSAGE_EVENTS.has(event)) {
    return null;
  }

  const data = payload.data ?? payload;
  const key = data.key ?? {};
  let remoteJid = key.remoteJidAlt ?? key.remoteJid ?? '';

  if (typeof remoteJid !== 'string' || !remoteJid) {
    return null;
  }

  if (remoteJid.includes('@g.us')) {
    return null;
  }

  if (remoteJid.endsWith('@lid') && key.remoteJidAlt) {
    remoteJid = key.remoteJidAlt;
  }

  const fromMe = Boolean(key.fromMe);
  if (fromMe) {
    return null;
  }

  const message = data.message ?? {};
  const audio = message.audioMessage ?? null;
  const textRaw =
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.speechToText ??
    audio?.speechToText ??
    null;

  const text = typeof textRaw === 'string' && textRaw.trim() ? textRaw.trim() : null;

  let audioBase64 =
    audio?.base64 ??
    message.base64 ??
    data.base64 ??
    null;
  if (typeof audioBase64 === 'string' && audioBase64.includes('base64,')) {
    audioBase64 = audioBase64.split('base64,')[1];
  }

  const audioMimeType =
    typeof audio?.mimetype === 'string' ? audio.mimetype : audio ? 'audio/ogg' : null;

  if (!text && !audioBase64) {
    return null;
  }

  return {
    instance: typeof payload.instance === 'string' ? payload.instance : '',
    remoteJid,
    text,
    fromMe,
    pushName: typeof data.pushName === 'string' ? data.pushName.trim() : null,
    messageId: typeof key.id === 'string' ? key.id : null,
    audioBase64: typeof audioBase64 === 'string' ? audioBase64 : null,
    audioMimeType,
  };
}

/**
 * @param {string} remoteJid
 */
export function phoneFromRemoteJid(remoteJid) {
  const local = remoteJid.split('@')[0] ?? remoteJid;
  return local.replace(/\D/g, '') || local;
}
