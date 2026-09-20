/**
 * Scheduler module: the endpoint an external cron service calls.
 * Routes: GET|POST /api/cron/run-due (needs CRON_SECRET), GET /api/scheduler/status
 */
import { router } from './scheduler.routes.js';
import { startLocalTimer } from './scheduler.service.js';

export default {
  name: 'scheduler',
  router,
  onStart: startLocalTimer, // development only - does nothing in production
};
