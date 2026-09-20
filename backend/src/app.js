/**
 * Builds the Express app from the list of feature modules (src/modules/index.js).
 * Kept separate from server.js so tests can create the app without opening a port.
 */
import express from 'express';
import { config } from './config/env.js';
import { cors } from './middleware/cors.js';
import { requestLog } from './middleware/requestLog.js';
import { notFound, errorHandler } from './middleware/errors.js';

export function createApp(modules) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render sits behind a proxy

  app.use(cors(config.corsOrigins));
  app.use(express.json({ limit: '100kb' }));
  app.use(requestLog);

  app.get('/', (req, res) => res.json({ name: 'price-tracker-api', docs: '/api/health' }));
  for (const mod of modules) {
    if (mod.router) app.use('/api', mod.router);
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
