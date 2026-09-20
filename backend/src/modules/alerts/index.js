/**
 * Alerts module (optional): in-app alerts for price drops and back-in-stock.
 * Routes: GET /api/alerts, POST /api/alerts/:id/read, POST /api/alerts/read-all
 */
import { router } from './alerts.routes.js';
import { onStart } from './alerts.service.js';

export default {
  name: 'alerts',
  router,
  onStart,
};
