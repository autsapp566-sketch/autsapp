import { resolveGreenCredentials, getStateInstance, getQrCode } from '../src/services/greenApi.js';
import { prisma } from '../src/lib/prisma.js';

const row = await prisma.whatsAppInstance.findFirst();
const creds = resolveGreenCredentials(row);
console.log('state', await getStateInstance(creds));
console.log('qr len', (await getQrCode(creds)).base64?.length);
await prisma.$disconnect();
