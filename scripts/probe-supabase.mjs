import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const password =
  process.env.DIRECT_URL?.match(/\/\/(?:postgres(?:\.[^:/]+)?):([^@]+)@/)?.[1] ?? '';
const refs = ['cdrvueomkuqbvzlmtrwf', 'jcdexwavyumvnlybqsji'];
const regions = ['eu-west-1', 'eu-central-1', 'us-east-1', 'ap-southeast-1'];

if (!password) {
  console.error('Set DIRECT_URL in .env first');
  process.exit(1);
}

for (const ref of refs) {
for (const region of regions) {
  for (const port of [5432, 6543]) {
    const user = `postgres.${ref}`;
    const suffix = port === 6543 ? '?pgbouncer=true' : '';
    const url = `postgresql://${user}:${password}@aws-0-${region}.pooler.supabase.com:${port}/postgres${suffix}`;
    const p = new PrismaClient({ datasources: { db: { url } } });
    try {
      await p.$queryRaw`SELECT 1 AS ok`;
      console.log('OK', ref, region, port, url.replace(password, '***'));
      await p.$disconnect();
      process.exit(0);
    } catch (e) {
      const msg = String(e.message ?? e).replace(/\s+/g, ' ').slice(0, 90);
      console.log('x', ref, region, port, msg);
    } finally {
      await p.$disconnect().catch(() => {});
    }
  }
  }
}

for (const ref of refs) {
  const directHost = `postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`;
  const p2 = new PrismaClient({ datasources: { db: { url: directHost } } });
  try {
    await p2.$queryRaw`SELECT 1`;
    console.log('OK direct', ref);
    await p2.$disconnect();
    process.exit(0);
  } catch (e) {
    console.log('x direct', ref, String(e.message).slice(0, 60));
  } finally {
    await p2.$disconnect().catch(() => {});
  }
}

console.log('No working Supabase URL — copy Connection string from Supabase dashboard.');
