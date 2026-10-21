import dotenv from 'dotenv';

dotenv.config();

const required = ['DATABASE_URL', 'JWT_SECRET'];
if (!process.env.VERCEL) {
  required.push('PORT');
}

for (const key of required) {
  if (!process.env[key]?.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

function envFlag(name) {
  const v = process.env[name]?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  evolutionMockForce: envFlag('EVOLUTION_MOCK'),
  /** When false (default), a failed boot probe does not lock the app into mock mode. */
  evolutionMockOnProbeFailure: envFlag('EVOLUTION_MOCK_ON_PROBE_FAILURE'),
  evolutionBaseUrl: process.env.EVOLUTION_BASE_URL?.trim() || '',
  evolutionApiKey: process.env.EVOLUTION_API_KEY?.trim() || '',
  evolutionInstance: process.env.EVOLUTION_INSTANCE?.trim() || '',
  whatsappProvider: process.env.WHATSAPP_PROVIDER?.trim() || '',
  greenApiInstanceId: process.env.GREEN_API_INSTANCE_ID?.trim() || '',
  greenApiToken: process.env.GREEN_API_TOKEN?.trim() || '',
  greenApiUrl: process.env.GREEN_API_URL?.trim() || '',
  appPublicUrl: process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, '') || '',
};
