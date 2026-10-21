import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const users = [
  {
    email: 'admin@example.com',
    password: 'Admin123!',
    role: 'ADMIN',
  },
  {
    email: 'agent@example.com',
    password: 'Agent123!',
    role: 'CONFIRMATION_AGENT',
  },
];

async function main() {
  for (const entry of users) {
    const password = await bcrypt.hash(entry.password, 12);
    await prisma.user.upsert({
      where: { email: entry.email },
      update: { password, role: entry.role },
      create: {
        email: entry.email,
        password,
        role: entry.role,
      },
    });
  }

  console.log('Seeded users:', users.map((u) => u.email).join(', '));

  const knowledgeCount = await prisma.knowledgeItem.count();
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
      ],
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
