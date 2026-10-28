import dotenv from 'dotenv';

dotenv.config();

const required = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]?.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  whatsappProvider: process.env.WHATSAPP_PROVIDER?.trim() || 'green',
  greenApiInstanceId: process.env.GREEN_API_INSTANCE_ID?.trim() || '',
  greenApiToken: process.env.GREEN_API_TOKEN?.trim() || '',
  greenApiUrl: process.env.GREEN_API_URL?.trim() || '',
  evolutionApiUrl: (process.env.EVOLUTION_API_URL?.trim() || '').replace(/\/+$/, ''),
  evolutionApiKey: process.env.EVOLUTION_API_KEY?.trim() || '',
  appPublicUrl: process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, '') || '',
  /** Public URL of the Next.js site (used in verification / reset links). */
  webPublicUrl: (process.env.WEB_PUBLIC_URL?.trim() || 'http://localhost:3001').replace(/\/+$/, ''),
  /** e.g. smtps://user:pass@smtp.example.com — when empty, e-mails are only logged (dev). */
  smtpUrl: process.env.SMTP_URL?.trim() || '',
  mailFrom: process.env.MAIL_FROM?.trim() || 'Autsapp <no-reply@localhost>',
  /** Redis used by the Evolution API container (health monitor only), e.g. redis://:pass@host:6379 */
  redisUrl: process.env.REDIS_URL?.trim() || '',
  /** Stripe billing (secret key `sk_...`, webhook signing secret `whsec_...`). */
  stripeSecretKey: process.env.STRIPE_SECRET_KEY?.trim() || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || '',
  /** Optional Billing Portal configuration id (`bpc_...`); Stripe's default configuration otherwise. */
  stripePortalConfigurationId: process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim() || '',
  trialDays: Math.max(0, Number(process.env.TRIAL_DAYS ?? 14) || 0),
};
