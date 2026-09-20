/** One log line per request: method, path, status, duration. */
import { logger } from '../lib/logger.js';

export function requestLog(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path === '/api/health') return; // too noisy
    logger.info(`${req.method} ${req.originalUrl.replace(/key=[^&]+/, 'key=***')}`, { status: res.statusCode, ms: Date.now() - start });
  });
  next();
}
