/**
 * Entry point: migrate the database, start every module, then listen for requests.
 */
import { config } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { db } from './db/pool.js';
import { createApp } from './app.js';
import { modules } from './modules/index.js';
import { logger } from './lib/logger.js';

async function main() {
  await runMigrations();

  for (const mod of modules) {
    if (mod.onStart) {
      try {
        await mod.onStart();
      } catch (error) {
        // One broken optional feature should not take the whole API down.
        logger.error(`module "${mod.name}" failed to start`, { error: error.message });
      }
    }
  }

  const app = createApp(modules);
  const server = app.listen(config.port, () => {
    logger.info('server listening', {
      port: config.port,
      modules: modules.map((m) => m.name),
      headless: config.scraper.headless,
    });
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => db.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error('server failed to start', { error: error.message });
  process.exit(1);
});
