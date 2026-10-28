/**
 * Grant / revoke the SUPER_ADMIN platform role. This is deliberately a CLI-only operation:
 * no HTTP endpoint can ever change `platformRole`.
 *
 *   npm run admin:grant  -- owner@example.com
 *   npm run admin:revoke -- owner@example.com
 */
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL.trim();

const [mode, rawEmail] = process.argv.slice(2);
const email = String(rawEmail ?? '').trim().toLowerCase();

if (!['grant', 'revoke'].includes(mode) || !email) {
  console.error('Usage: node scripts/set-platform-role.mjs <grant|revoke> <email>');
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exitCode = 1;
  } else {
    const platformRole = mode === 'grant' ? 'SUPER_ADMIN' : 'USER';
    await prisma.user.update({ where: { id: user.id }, data: { platformRole } });
    console.log(`${email} is now ${platformRole}`);
  }
} finally {
  await prisma.$disconnect();
}
