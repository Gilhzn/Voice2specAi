import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { audioController } from './controllers/audioController';
import { specController } from './controllers/specController';
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

  registerPiiMasking(app);
  app.setErrorHandler(errorHandler);

  // REST controllers.
  await app.register(audioController);
  await app.register(specController);

  // WebSocket endpoint (must be registered after the websocket plugin).
  await app.register(streamHandler);

  return app;
}
