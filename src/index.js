import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initEvolutionIntegration } from './services/evolutionBoot.js';
import { initRealtimeNotifications } from './services/notifications.js';
import { getWhatsAppProvider } from './services/whatsappMessaging.js';
import { resolveGreenApiConfig } from './services/greenApiConfig.js';

const app = createApp();
const server = http.createServer(app);

initRealtimeNotifications(server);

await initEvolutionIntegration();

const green = resolveGreenApiConfig();
if (getWhatsAppProvider() === 'green-api' && green.configured) {
  console.log(`[WhatsApp] Provider: Green API (instance ${green.instanceId})`);
  console.log('[WhatsApp] Webhook URL: /api/webhook/green-api');
}

server.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
