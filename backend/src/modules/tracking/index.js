/**
 * Tracking module: add/remove tracked products, change their check interval, read history.
 * Routes: GET/POST /api/tracked, GET/PATCH/DELETE /api/tracked/:id, GET /api/tracked/:id/history
 */
import { router } from './tracking.routes.js';

export default {
  name: 'tracking',
  router,
};
