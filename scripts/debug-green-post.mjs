import { prisma } from '../src/lib/prisma.js';
import { resolveGreenApiConfig } from '../src/services/greenApiConfig.js';
import { getQrCode, getStateInstance, isGreenConnectedState, resolveGreenCredentials } from '../src/services/greenApi.js';

const body = {
  idInstance: '710722775456',
  apiTokenInstance: 'd7b2bfe251c54037925e1af7a98aa403287d0801e2134eb1bd',
  apiUrl: 'https://7107.api.greenapi.com',
  label: 'Main line',
};

const greenInstanceId = String(body.greenInstanceId ?? body.idInstance ?? '').trim();
const greenApiToken = String(body.greenApiToken ?? body.apiTokenInstance ?? '').trim();
const greenApiUrl = String(body.greenApiUrl ?? body.apiUrl ?? '').trim() || null;

const envCfg = resolveGreenApiConfig();
const finalId = greenInstanceId || envCfg.instanceId;
const finalToken = greenApiToken || envCfg.apiToken;

let instanceName = `green-${finalId}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40);

const existingGreen = await prisma.whatsAppInstance.findFirst({
  where: { greenInstanceId: finalId },
});
console.log('existingGreen', existingGreen?.instanceName);

if (existingGreen && existingGreen.instanceName !== instanceName) {
  console.log('would 409');
  process.exit(0);
}

let row = await prisma.whatsAppInstance.findUnique({ where: { instanceName } });
const count = await prisma.whatsAppInstance.count();

if (!row) {
  row = await prisma.whatsAppInstance.create({
    data: {
      organizationId: 'org_legacy',
      instanceName,
      label: body.label || `Green ${finalId}`,
      provider: 'green',
      greenInstanceId: finalId,
      greenApiToken: finalToken,
      greenApiUrl: greenApiUrl || envCfg.baseUrl,
      isDefault: count === 0,
    },
  });
} else {
  row = await prisma.whatsAppInstance.update({
    where: { id: row.id },
    data: {
      label: body.label,
      greenInstanceId: finalId,
      greenApiToken: finalToken,
      greenApiUrl: greenApiUrl || envCfg.baseUrl,
      provider: 'green',
    },
  });
}

console.log('row', row.id);

const creds = resolveGreenCredentials(row);
const state = await getStateInstance(creds);
console.log('state', state);
let qr = { base64: null };
if (!isGreenConnectedState(state.state)) {
  qr = await getQrCode(creds);
}
console.log('qr len', qr.base64?.length);

await prisma.$disconnect();
