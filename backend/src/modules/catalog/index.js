/**
 * Catalog module: local copy of the store's products + search.
 * Routes: GET /api/catalog/search, GET /api/catalog/status, POST /api/catalog/sync
 */
import { router } from './catalog.routes.js';
import { syncIfStale } from './catalog.service.js';

export default {
  name: 'catalog',
  router,
  onStart: syncIfStale,
};
