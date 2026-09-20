/** Turns thrown errors into JSON responses. Unknown errors become a generic 500. */
import { logger } from '../lib/logger.js';

export function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars -- Express needs all 4 arguments to treat this as an error handler
export function errorHandler(error, req, res, next) {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });

  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) logger.error('request failed', { method: req.method, path: req.path, error: error.message });
  res.status(status).json({ error: status >= 500 && !error.status ? 'Internal server error' : error.message });
}
