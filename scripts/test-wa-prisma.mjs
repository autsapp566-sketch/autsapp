import { prisma } from '../src/lib/prisma.js';

try {
  const rows = await prisma.whatsAppInstance.findMany({ take: 1 });
  console.log('findMany ok', rows[0] ? Object.keys(rows[0]) : 'empty');
} catch (e) {
  console.error('findMany fail', e.message);
}

try {
  await prisma.whatsAppInstance.create({
    data: {
      organizationId: 'org_legacy',
      instanceName: `test-${Date.now()}`,
      label: 'test',
      provider: 'green',
      greenInstanceId: '999',
      greenApiToken: 'tok',
    },
  });
  console.log('create ok');
} catch (e) {
  console.error('create fail', e.message);
}

await prisma.$disconnect();
