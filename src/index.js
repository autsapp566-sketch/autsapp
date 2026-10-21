import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initRealtimeNotifications } from './services/notifications.js';
import { refreshGreenApiConfigCache } from './services/greenApiConfig.js';

const app = createApp();
const server = http.createServer(app);

initRealtimeNotifications(server);

const green = await refreshGreenApiConfigCache();
if (green.configured) {
  console.log(`[WhatsApp] Provider: Green API (instance ${green.instanceId})`);
  console.log('[WhatsApp] Webhook URL: /api/webhook/green-api');
} else {
  console.warn('[WhatsApp] Green API not configured — set GREEN_API_* in .env or dashboard');
}

server.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
