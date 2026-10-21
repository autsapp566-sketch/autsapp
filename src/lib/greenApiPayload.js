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
    pushName: pushName ? String(pushName) : null,
    idMessage: body.idMessage ? String(body.idMessage) : null,
    instanceId: body.instanceData?.idInstance != null ? String(body.instanceData.idInstance) : null,
    isGroup: false,
  };
}
