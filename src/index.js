import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initRealtimeNotifications } from './services/notifications.js';
import { refreshGreenApiConfigCache } from './services/greenApiConfig.js';
import { getEvolutionConfig } from './services/evolutionService.js';

const app = createApp();
const server = http.createServer(app);

initRealtimeNotifications(server);

const evolution = getEvolutionConfig();
if (evolution.configured) {
  console.log(`[WhatsApp] Provider: Evolution API (${evolution.baseUrl})`);
  console.log('[WhatsApp] Webhook URL: /api/webhook/evolution');
} else {
  console.warn('[WhatsApp] Evolution API not configured — set EVOLUTION_API_URL and EVOLUTION_API_KEY in .env');
}

// Legacy Green API numbers keep working until they are replaced.
const green = await refreshGreenApiConfigCache();
if (green.configured) {
  console.log(`[WhatsApp] Legacy Green API configured (instance ${green.instanceId})`);
}

server.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
