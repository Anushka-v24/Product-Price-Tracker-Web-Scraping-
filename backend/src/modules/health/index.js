/**
 * Health module: GET /api/health. Render uses it to know the server is up, and it is a
 * cheap URL for "is the backend awake?" checks.
 */
import { Router } from 'express';
import { db } from '../../db/pool.js';
import { browserLock } from '../../lib/lock.js';
import { asyncHandler } from '../../lib/http.js';

const router = Router();

router.get('/health', asyncHandler(async (req, res) => {
  let database = 'ok';
  try {
    await db.query('SELECT 1');
  } catch {
    database = 'unreachable';
  }
  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ok' : 'degraded',
    database,
    browserJobsWaiting: browserLock.pending,
    uptimeSeconds: Math.round(process.uptime()),
  });
}));

export default { name: 'health', router };
