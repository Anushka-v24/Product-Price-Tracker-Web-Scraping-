import { Router } from 'express';
import * as service from './tracking.service.js';
import { asyncHandler, parsePositiveInt, parseLimit } from '../../lib/http.js';

export const router = Router();

// GET /api/tracked  -> dashboard list (each item includes latest price + last run status)
router.get('/tracked', asyncHandler(async (req, res) => {
  res.json({ items: await service.list() });
}));

// POST /api/tracked  { storeProductId: 458, checkIntervalMinutes?: 120 }
router.post('/tracked', asyncHandler(async (req, res) => {
  const tracked = await service.track({
    storeProductId: parsePositiveInt(req.body?.storeProductId, 'storeProductId'),
    checkIntervalMinutes: req.body?.checkIntervalMinutes,
  });
  res.status(201).json(tracked);
}));

// GET /api/tracked/:id
router.get('/tracked/:id', asyncHandler(async (req, res) => {
  res.json(await service.get(parsePositiveInt(req.params.id, 'id')));
}));

// PATCH /api/tracked/:id  { checkIntervalMinutes?, isActive? }
router.patch('/tracked/:id', asyncHandler(async (req, res) => {
  res.json(await service.update(parsePositiveInt(req.params.id, 'id'), req.body ?? {}));
}));

// DELETE /api/tracked/:id  (also deletes its history and check log)
router.delete('/tracked/:id', asyncHandler(async (req, res) => {
  await service.untrack(parsePositiveInt(req.params.id, 'id'));
  res.status(204).end();
}));

// GET /api/tracked/:id/history?limit=500  -> price/stock snapshots, oldest first
router.get('/tracked/:id/history', asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id, 'id');
  res.json({ items: await service.history(id, parseLimit(req.query.limit, { fallback: 500, max: 5000 })) });
}));
