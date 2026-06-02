import { buildApp } from './app';
import { env } from './config/env';
import { getRepository } from './models/db';
import { getSessionStore } from './services/redisService';

/** Boots the server, wiring datastores and a graceful shutdown handler. */
async function main(): Promise<void> {
  // Initialize datastores eagerly so health reflects real connectivity.
  const repo = await getRepository();
  const store = await getSessionStore();

  const app = await buildApp();

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(
    `Voice2Spec server listening on ${env.HOST}:${env.PORT} ` +
      `(db=${repo.mode}, redis=${store.mode})`,
  );

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    await store.close();
    await repo.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
