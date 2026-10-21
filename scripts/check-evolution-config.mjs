import { prisma } from '../src/lib/prisma.js';
import { resolveEvolutionConfig } from '../src/services/evolutionConfig.js';
import { isEvolutionMockMode } from '../src/services/evolutionMockMode.js';

const config = await resolveEvolutionConfig();
const row = await prisma.aiSettings.findUnique({ where: { id: 'default' } });

console.log('mockMode', isEvolutionMockMode());
console.log('resolved', {
  configured: config.configured,
  baseUrl: config.baseUrl,
  apiKeyPreview: config.apiKey ? `${config.apiKey.slice(0, 4)}…${config.apiKey.slice(-4)}` : null,
  source: config.source,
});
console.log('db', {
  evolutionBaseUrl: row?.evolutionBaseUrl ?? null,
  dbKeyPreview: row?.evolutionApiKey
    ? `${row.evolutionApiKey.slice(0, 4)}…${row.evolutionApiKey.slice(-4)}`
    : null,
});

if (config.configured) {
  try {
    const res = await fetch(`${config.baseUrl}/instance/fetchInstances`, {
      headers: { apikey: config.apiKey },
      signal: AbortSignal.timeout(10000),
    });
    console.log('probe', res.status, res.statusText);
    const text = await res.text();
    console.log('bodyPreview', text.slice(0, 200));
  } catch (e) {
    console.log('probeError', e.message);
  }
}

await prisma.$disconnect();
