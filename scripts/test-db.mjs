import { prisma } from '../src/lib/prisma.js';

try {
  const n = await prisma.user.count();
  console.log('OK users:', n);
} catch (e) {
  console.error('FAIL', e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
