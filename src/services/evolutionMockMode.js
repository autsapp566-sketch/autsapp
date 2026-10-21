import { buildMockQrPayload } from './whatsappQrFallback.js';

/** @type {boolean} */
let mockMode = process.env.EVOLUTION_MOCK === 'true' || process.env.EVOLUTION_MOCK === '1';
/** @type {string | null} */
let mockReason = mockMode ? 'EVOLUTION_MOCK env' : null;

export function isEvolutionMockMode() {
  return mockMode;
}

export function getEvolutionMockReason() {
  return mockReason;
}

/**
 * @param {string} reason
 */
export function enableEvolutionMockMode(reason) {
  if (!mockMode) {
    mockMode = true;
    mockReason = reason;
    console.warn(`[Evolution API] Mock mode enabled: ${reason}`);
  }
}

export function disableEvolutionMockMode() {
  if (mockMode && process.env.EVOLUTION_MOCK !== 'true' && process.env.EVOLUTION_MOCK !== '1') {
    mockMode = false;
    mockReason = null;
    console.log('[Evolution API] Live mode — mock disabled (credentials configured).');
  }
}

export function logEvolutionMockBootMessage() {
  if (mockMode) {
    console.log('[Evolution API] Running in MOCK MODE for local testing.');
    if (mockReason) {
      console.log(`[Evolution API] Mock reason: ${mockReason}`);
    }
  }
}

export function mockMessageId() {
  return `mock_msg_${Date.now().toString(36)}`;
}

/**
 * @param {string} instanceName
 */
export function mockCreateInstanceResponse(instanceName) {
  const qr = buildMockQrPayload(instanceName);
  return {
    instance: {
      instanceName,
      status: 'connecting',
      integration: 'WHATSAPP-BAILEYS',
    },
    qrcode: {
      base64: qr.base64.replace(/^data:image\/svg\+xml;base64,/, ''),
      pairingCode: qr.pairingCode,
    },
    base64: qr.base64,
    pairingCode: qr.pairingCode,
    mock: true,
  };
}

/**
 * @param {string} instanceName
 */
export function mockConnectResponse(instanceName) {
  const qr = buildMockQrPayload(instanceName);
  return {
    base64: qr.base64,
    pairingCode: qr.pairingCode,
    qrcode: { base64: qr.base64, pairingCode: qr.pairingCode },
    mock: true,
  };
}

export function mockConnectionStateResponse(instanceName) {
  return {
    instance: { instanceName, state: 'close' },
    state: 'close',
    mock: true,
  };
}

export function mockFetchInstancesResponse() {
  return [];
}

export function mockDeleteInstanceResponse() {
  return { status: 'SUCCESS', mock: true };
}

export function mockSendMessageResponse({ phone, text, kind = 'text' }) {
  const messageId = mockMessageId();
  console.log(`[Evolution Mock] send${kind}`, {
    to: phone,
    preview: typeof text === 'string' ? text.slice(0, 120) : '(binary)',
    messageId,
    status: 'success',
  });
  return { status: 'success', messageId, mock: true };
}

/**
 * @param {unknown} err
 */
export function shouldFallbackToEvolutionMock(err) {
  const msg = String(err?.message ?? err ?? '');
  return (
    /Evolution API|غير مضبوط|تعذر الاتصال|انتهت مهلة|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed|network/i.test(
      msg
    )
  );
}

/**
 * @param {string} path
 * @param {RequestInit} [options]
 */
export function mockEvolutionRequest(path, options = {}) {
  const method = (options.method ?? 'GET').toUpperCase();
  const connectMatch = path.match(/\/instance\/connect\/([^/?]+)/i);
  if (connectMatch) {
    return mockConnectResponse(decodeURIComponent(connectMatch[1]));
  }

  const stateMatch = path.match(/\/instance\/connectionState\/([^/?]+)/i);
  if (stateMatch) {
    return mockConnectionStateResponse(decodeURIComponent(stateMatch[1]));
  }

  const deleteMatch = path.match(/\/instance\/delete\/([^/?]+)/i);
  if (deleteMatch && method === 'DELETE') {
    return mockDeleteInstanceResponse();
  }

  if (path.includes('/instance/fetchInstances') && method === 'GET') {
    return mockFetchInstancesResponse();
  }

  if (path.includes('/instance/create') && method === 'POST') {
    let instanceName = 'mock-instance';
    try {
      const body = JSON.parse(String(options.body ?? '{}'));
      if (body.instanceName) instanceName = body.instanceName;
    } catch {
      /* keep default */
    }
    return mockCreateInstanceResponse(instanceName);
  }

  return { status: 'success', mock: true };
}
