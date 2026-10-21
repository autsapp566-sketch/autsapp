import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import greenApiWebhookRoutes from './routes/greenApiWebhook.js';
import leadsRoutes from './routes/leads.js';
import whatsappInstancesRoutes from './routes/whatsappInstances.js';
import aiSettingsRoutes from './routes/aiSettings.js';
import aiVoiceSettingsRoutes from './routes/aiVoiceSettings.js';
import systemSettingsRoutes from './routes/settings.js';
import knowledgeRoutes from './routes/knowledge.js';
import analyticsRoutes from './routes/analytics.js';
import botPlaygroundRoutes from './routes/botPlayground.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/webhook/green-api', greenApiWebhookRoutes);
  app.use('/api/leads', leadsRoutes);
  app.use('/api/whatsapp-instances', whatsappInstancesRoutes);
  app.use('/api/settings/ai', aiSettingsRoutes);
  app.use('/api/settings/ai-voice', aiVoiceSettingsRoutes);
  app.use('/api/settings', systemSettingsRoutes);
  app.use('/api/knowledge', knowledgeRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/bot-playground', botPlaygroundRoutes);
  app.use('/uploads/products', express.static(path.join(__dirname, '../uploads/products')));

  app.use(errorHandler);

  return app;
}
