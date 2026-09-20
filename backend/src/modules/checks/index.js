/**
 * Checks module: runs price checks and keeps the check log.
 * Routes: POST /api/tracked/:id/check, GET /api/checks, GET /api/checks/:id
 * Other modules use startChecks() (the scheduler) and listen to 'check.*' events (alerts).
 */
import { router } from './checks.routes.js';
import { onStart } from './checks.service.js';

export default {
  name: 'checks',
  router,
  onStart,
};
