import { prisma } from '../lib/prisma.js';

const DAY_LABELS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export async function getAnalyticsOverview() {
  const [totalMessages, voiceMessages, orders, totalLeads, sentimentCounts, recentMessages] =
    await Promise.all([
      prisma.message.count(),
      prisma.message.count({
        where: { sender: 'USER', content: { startsWith: '[رسالة صوتية]' } },
      }),
      prisma.lead.count({
        where: { status: { in: ['QUALIFIED', 'HANDED_OFF'] } },
      }),
      prisma.lead.count(),
      Promise.all([
        prisma.lead.count({ where: { status: 'QUALIFIED' } }),
        prisma.lead.count({ where: { status: { in: ['NEW', 'QUALIFYING'] } } }),
        prisma.lead.count({ where: { status: { in: ['REJECTED', 'HANDED_OFF'] } } }),
      ]),
      prisma.message.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: { createdAt: true, content: true, sender: true },
      }),
    ]);

  const [positive, neutral, negative] = sentimentCounts;
  const sentimentTotal = positive + neutral + negative;

  const activityDays = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = startOfDay(new Date());
    date.setDate(date.getDate() - i);
    activityDays.push({
      key: date.getTime(),
      label: DAY_LABELS[date.getDay()],
      textMessages: 0,
      voiceMessages: 0,
    });
  }

  for (const msg of recentMessages) {
    const key = startOfDay(msg.createdAt).getTime();
    const bucket = activityDays.find((d) => d.key === key);
    if (!bucket || msg.sender !== 'USER') {
      continue;
    }
    if (msg.content.startsWith('[رسالة صوتية]')) {
      bucket.voiceMessages += 1;
    } else {
      bucket.textMessages += 1;
    }
  }

  const needsIntervention = await prisma.lead.count({
    where: { status: { in: ['HANDED_OFF', 'REJECTED'] } },
  });

  return {
    metrics: {
      totalMessages,
      voiceMessages,
      orders,
      conversionRate: pct(orders, totalLeads),
    },
    sentiment: {
      positive: { count: positive, percent: pct(positive, sentimentTotal) },
      neutral: { count: neutral, percent: pct(neutral, sentimentTotal) },
      negative: { count: negative, percent: pct(negative, sentimentTotal) },
    },
    activity: activityDays.map(({ label, textMessages, voiceMessages: voice }) => ({
      label,
      textMessages,
      voiceMessages: voice,
    })),
    needsIntervention,
  };
}
