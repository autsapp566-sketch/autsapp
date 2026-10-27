import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { corsOptions } from './lib/cors.js';
import authRoutes from './routes/auth.js';
import greenApiWebhookRoutes from './routes/greenApiWebhook.js';
import evolutionWebhookRoutes from './routes/evolutionWebhook.js';
import leadsRoutes from './routes/leads.js';
import whatsappInstancesRoutes from './routes/whatsappInstances.js';
import aiSettingsRoutes from './routes/aiSettings.js';
import aiVoiceSettingsRoutes from './routes/aiVoiceSettings.js';
import systemSettingsRoutes from './routes/settings.js';
import knowledgeRoutes from './routes/knowledge.js';
import analyticsRoutes from './routes/analytics.js';
import alertsRoutes from './routes/alerts.js';
import teamRoutes from './routes/team.js';
import botPlaygroundRoutes from './routes/botPlayground.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getProductUploadDir } from './lib/uploadDir.js';
import { getUploadedImage } from './services/uploadedImages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/', (_req, res) => {
    res.json({
      service: 'whatsapp-ai-qualification-handoff',
      health: '/health',
      api: '/api',
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Public: product images are embedded by <img> tags and sent to customers on WhatsApp.
  app.get('/api/uploads/images/:id', async (req, res, next) => {
    try {
      const image = await getUploadedImage(req.params.id);
      if (!image) {
        return res.status(404).json({ error: 'Image not found' });
      }
      res.setHeader('Content-Type', image.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.send(image.data);
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/webhook/green-api', greenApiWebhookRoutes);
  app.use('/api/webhook/evolution', evolutionWebhookRoutes);
  app.use('/api/leads', leadsRoutes);
  app.use('/api/whatsapp-instances', whatsappInstancesRoutes);
  app.use('/api/settings/ai', aiSettingsRoutes);
  app.use('/api/settings/ai-voice', aiVoiceSettingsRoutes);
  app.use('/api/settings', systemSettingsRoutes);
  app.use('/api/knowledge', knowledgeRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/alerts', alertsRoutes);
  app.use('/api/team', teamRoutes);
  app.use('/api/bot-playground', botPlaygroundRoutes);
  app.use('/uploads/products', express.static(getProductUploadDir()));
  app.use(errorHandler);

  return app;
}

/** Vercel's Express preset uses this module as the entrypoint and requires a default export. */
export default createApp();
