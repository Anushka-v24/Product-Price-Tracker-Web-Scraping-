import { Router } from 'express';
import * as service from './catalog.service.js';
import { asyncHandler, parseLimit } from '../../lib/http.js';

export const router = Router();

// GET /api/catalog/search?q=trackpad&limit=20
router.get('/catalog/search', asyncHandler(async (req, res) => {
  const results = await service.search(String(req.query.q ?? ''), parseLimit(req.query.limit, { fallback: 20, max: 50 }));
  res.json({ results, catalog: await service.status() });
}));

// GET /api/catalog/status
router.get('/catalog/status', asyncHandler(async (req, res) => {
  res.json(await service.status());
}));

// POST /api/catalog/sync  -> starts a background re-sync
router.post('/catalog/sync', asyncHandler(async (req, res) => {
  const started = service.startSync();
  res.status(202).json({ started, ...(await service.status()) });
}));
