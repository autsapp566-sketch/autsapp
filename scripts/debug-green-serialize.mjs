import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import { maskGreenToken, isGreenConnectedState } from '../src/services/greenApi.js';

function buildGreenWebhookUrl() {
  const base = env.appPublicUrl?.trim() || process.env.APP_PUBLIC_URL?.trim() || '';
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/api/webhook/green-api`;
}

function serializeGreenInstance(row, connectionState, extra = {}) {
  const connected = isGreenConnectedState(connectionState);
  return {
    id: row.id,
    instanceName: row.instanceName,
    label: row.label,
    phone: row.phone,
    provider: 'green-api',
    greenInstanceId: row.greenInstanceId,
    greenApiUrl: row.greenApiUrl,
    greenApiTokenMasked: row.greenApiToken ? maskGreenToken(row.greenApiToken) : null,
    hasGreenToken: Boolean(row.greenApiToken),
    isDefault: row.isDefault,
    connectionState,
    connected,
    mock: false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    webhookUrl: buildGreenWebhookUrl(),
    ...extra,
  };
}

const row = await prisma.whatsAppInstance.findFirst({
  where: { instanceName: 'green-710722775456' },
});
const payload = {
  provider: 'green-api',
  instance: serializeGreenInstance(row, 'authorized'),
  qr: { base64: null },
  qrcode: null,
  connected: true,
  simulationMode: false,
  message: undefined,
  webhookUrl: buildGreenWebhookUrl(),
};
console.log(JSON.stringify(payload));

await prisma.$disconnect();
