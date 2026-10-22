/**
 * @param {string} chatId
 */
export function phoneFromGreenChatId(chatId) {
  const id = String(chatId ?? '').trim();
  if (!id) {
    return '';
  }
  const local = id.split('@')[0] ?? id;
  return local.replace(/\D/g, '') || local;
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/i;

/** URLs that are never a product/ad link. */
const IGNORED_URL_RE =
  /^https?:\/\/(?:(?:www\.)?(?:wa\.me|chat\.whatsapp\.com|api\.whatsapp\.com)|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl|(?:www\.)?google\.[a-z.]+\/maps)/i;

export function firstUrlInText(text) {
  const match = URL_RE.exec(String(text ?? ''));
  if (!match) return null;
  const url = match[0].replace(/[.,;!?،؛]+$/, '');
  return IGNORED_URL_RE.test(url) ? null : url;
}

/** Collects every value stored under one of `keys` anywhere in a (small) JSON object. */
function collectByKey(node, keys, out = [], depth = 0) {
  if (!node || typeof node !== 'object' || depth > 5) return out;
  for (const [k, v] of Object.entries(node)) {
    if (keys.has(k) && typeof v === 'string' && v.trim()) out.push([k, v.trim()]);
    else if (v && typeof v === 'object') collectByKey(v, keys, out, depth + 1);
  }
  return out;
}

const AD_KEYS = new Set([
  'title',
  'description',
  'body',
  'jpegThumbnail',
  'thumbnail',
  'thumbnailUrl',
  'mediaUrl',
  'sourceUrl',
  'canonicalUrl',
  'matchedText',
]);

/**
 * Link / ad info carried by a customer message: the link inside the text and whatever preview
 * WhatsApp attached (title, description, thumbnail) — typical for "Click to WhatsApp" ads.
 * @returns {null | { url: string | null, title: string, description: string, thumbnailBase64: string | null, thumbnailUrl: string | null }}
 */
export function extractAdFromMessage(messageData, text) {
  const found = collectByKey(messageData ?? {}, AD_KEYS);
  const pick = (...names) => found.find(([k]) => names.includes(k))?.[1] ?? '';

  const sourceUrl = pick('sourceUrl', 'canonicalUrl', 'matchedText');
  const url = firstUrlInText(text) ?? firstUrlInText(sourceUrl) ?? null;
  const title = pick('title');
  const description = pick('description', 'body');
  const rawThumb = pick('jpegThumbnail', 'thumbnail');
  const thumbnailBase64 = rawThumb && !/^https?:/i.test(rawThumb) ? rawThumb.replace(/^data:[^,]+,/, '') : null;
  const thumbUrlCandidate = pick('thumbnailUrl', 'mediaUrl') || (/^https?:/i.test(rawThumb) ? rawThumb : '');
  const thumbnailUrl = /^https?:\/\//i.test(thumbUrlCandidate) ? thumbUrlCandidate : null;

  if (!url && !title && !thumbnailBase64 && !thumbnailUrl) {
    return null;
  }
  return { url, title, description, thumbnailBase64, thumbnailUrl };
}

/**
 * Parse Green API webhook (incomingMessageReceived).
 * @param {unknown} body
 * @returns {null | {
 *   typeWebhook: string,
 *   remoteJid: string,
 *   phone: string,
 *   text: string,
 *   pushName: string | null,
 *   idMessage: string | null,
 *   instanceId: string | null,
 *   isGroup: boolean,
 * }}
 */
export function parseGreenApiWebhook(body) {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const typeWebhook = body.typeWebhook;
  if (typeWebhook !== 'incomingMessageReceived') {
    return null;
  }

  const senderData = body.senderData ?? {};
  const chatId = senderData.chatId ?? senderData.sender ?? '';
  if (!chatId || String(chatId).includes('@g.us')) {
    return null;
  }

  const messageData = body.messageData ?? {};
  const typeMessage = messageData.typeMessage;

  let text = '';
  let isEdited = false;
  if (typeMessage === 'audioMessage') {
    const file = messageData.fileMessageData ?? {};
    if (!file.downloadUrl) {
      return null;
    }
    return {
      typeWebhook,
      remoteJid: chatId,
      phone: phoneFromGreenChatId(chatId),
      text: '',
      audio: {
        downloadUrl: String(file.downloadUrl),
        mimeType: String(file.mimeType ?? 'audio/ogg'),
      },
      pushName:
        senderData.senderName ?? senderData.senderContactName ?? senderData.chatName ?? null,
      idMessage: body.idMessage ? String(body.idMessage) : null,
      instanceId:
        body.instanceData?.idInstance != null ? String(body.instanceData.idInstance) : null,
      isGroup: false,
    };
  } else if (typeMessage === 'textMessage') {
    text = messageData.textMessageData?.textMessage ?? '';
  } else if (typeMessage === 'extendedTextMessage') {
    text =
      messageData.extendedTextMessageData?.text ??
      messageData.extendedTextMessageData?.textMessage ??
      '';
  } else if (typeMessage === 'quotedMessage') {
    text = messageData.quotedMessage?.textMessage ?? '';
  } else if (typeMessage === 'editedMessage') {
    // Customer edited a message: handle the new text like a fresh message (flagged as edited).
    text = messageData.editedMessageData?.textMessage ?? '';
    isEdited = true;
  } else {
    return null;
  }

  text = String(text).trim();
  if (!text) {
    return null;
  }

  const pushName =
    senderData.senderName ??
    senderData.senderContactName ??
    senderData.chatName ??
    null;

  return {
    typeWebhook,
    remoteJid: chatId,
    phone: phoneFromGreenChatId(chatId),
    text,
    isEdited,
    ad: extractAdFromMessage(messageData, text),
    pushName: pushName ? String(pushName) : null,
    idMessage: body.idMessage ? String(body.idMessage) : null,
    instanceId: body.instanceData?.idInstance != null ? String(body.instanceData.idInstance) : null,
    isGroup: false,
  };
}
