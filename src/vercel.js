import { createApp } from './app.js';

/** Vercel serverless entry — no server.listen(), no Socket.IO. */
const app = createApp();
export default app;
