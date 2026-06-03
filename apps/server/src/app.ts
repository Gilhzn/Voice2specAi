import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { audioController } from './controllers/audioController';
import { specController } from './controllers/specController';
import { transcribeController } from './controllers/transcribeController';
import { streamHandler } from './websockets/streamHandler';
import { errorHandler } from './middleware/errorHandler';
import { registerPiiMasking } from './middleware/piiMaskingHook';

/**
 * Builds the Fastify application with all plugins, security headers, REST
 * controllers and the WebSocket stream handler registered. Kept separate from
 * the listen() call so tests can build an app instance without binding a port.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' },
  });

  // Security headers. WebSocket upgrade is unaffected by helmet.
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(websocket);
  // Up to ~50MB recorded audio uploads.
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  registerPiiMasking(app);
  app.setErrorHandler(errorHandler);

  // REST controllers.
  await app.register(audioController);
  await app.register(specController);
  await app.register(transcribeController);

  // WebSocket endpoint (must be registered after the websocket plugin).
  await app.register(streamHandler);

  return app;
}
