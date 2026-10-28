import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { ensurePlans } from '../src/services/billing/plans.js';
import { LEGACY_ORGANIZATION_ID } from '../src/lib/tenancy.js';

dotenv.config();
// Pooler (6543) breaks upsert/seed — use direct 5432 when available.
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL.trim();
}

const prisma = new PrismaClient();

// Credentials come from .env (no passwords are stored in the repository).
// Tip: wrap values in quotes if they contain # or spaces, e.g. ADMIN_PASSWORD="my#pass".
function userFromEnv(prefix, role) {
  const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email && !password) {
    return null;
  }
  if (!email || !password) {
    throw new Error(`${prefix}_EMAIL and ${prefix}_PASSWORD must both be set in .env`);
  }
  if (password.length < 8) {
    throw new Error(`${prefix}_PASSWORD must be at least 8 characters`);
  }
  return { email, password, role };
}

const users = [userFromEnv('ADMIN', 'ADMIN'), userFromEnv('AGENT', 'CONFIRMATION_AGENT')].filter(Boolean);

async function main() {
  if (users.length === 0) {
    throw new Error(
      'Set ADMIN_EMAIL / ADMIN_PASSWORD (and optionally AGENT_EMAIL / AGENT_PASSWORD) in .env before seeding.'
    );
  }

  // Plan catalogue (Starter / Professional / Enterprise) — idempotent, keeps limits in sync with plans.js.
  const plans = await ensurePlans(prisma);
  console.log('Plans:', plans.map((p) => p.tier).join(', '));

  // Seeded accounts live in the default organization (created by the multi-tenant migration, Enterprise).
  // An existing user keeps its own organization.
  for (const entry of users) {
    const password = await bcrypt.hash(entry.password, 12);
    await prisma.user.upsert({
      where: { email: entry.email },
      // The seeded ADMIN is the platform owner => SUPER_ADMIN (the agent is never promoted).
      update: { password, role: entry.role, emailVerifiedAt: new Date(), ...(entry.role === 'ADMIN' ? { platformRole: 'SUPER_ADMIN' } : {}) },
      create: {
        organizationId: LEGACY_ORGANIZATION_ID,
        email: entry.email,
        password,
        role: entry.role,
        platformRole: entry.role === 'ADMIN' ? 'SUPER_ADMIN' : 'USER',
        emailVerifiedAt: new Date(),
      },
    });
  }

  console.log('Seeded users:', users.map((u) => u.email).join(', '));

  const knowledgeCount = await prisma.knowledgeItem.count({ where: { organizationId: LEGACY_ORGANIZATION_ID } });
  if (knowledgeCount === 0) {
    await prisma.knowledgeItem.createMany({
      data: [
        {
          type: 'FAQ',
          title: 'شحال الثمن واش التوصيل؟',
          answer: 'التوصيل بـ 30 درهم لجميع المدن، والمجاني فوق 400 درهم.',
        },
        {
          type: 'PRODUCT',
          title: 'سماعات Bluetooth Earbuds Pro',
          description: 'سماعات صوت عالي الدقة مع عزل الضوضاء',
          priceDh: 199,
          imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80',
        },
        {
          type: 'PRODUCT',
          title: 'ساعة ذكية SmartWatch Pro',
          description: 'ساعة مقاومة للماء مع تتبع الخطوات وتنبيهات المكالمات',
          priceDh: 299,
          imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80',
        },
      ].map((item) => ({ ...item, organizationId: LEGACY_ORGANIZATION_ID })),
    });
    console.log('Seeded knowledge base sample items');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
