import { Router } from 'express';
import * as service from './checks.service.js';
import * as tracking from '../tracking/tracking.service.js';
import { asyncHandler, parsePositiveInt, parseLimit } from '../../lib/http.js';

export const router = Router();

// POST /api/tracked/:id/check  -> "Check now". Returns 202 + the run; poll GET /api/checks/:runId.
router.post('/tracked/:id/check', asyncHandler(async (req, res) => {
  const tracked = await tracking.get(parsePositiveInt(req.params.id, 'id'));
  res.status(202).json(await service.checkNow(tracked));
}));

// GET /api/checks?trackedId=3&limit=100  -> the check log (newest first)
router.get('/checks', asyncHandler(async (req, res) => {
  const trackedProductId = req.query.trackedId ? parsePositiveInt(req.query.trackedId, 'trackedId') : undefined;
  const limit = parseLimit(req.query.limit, { fallback: 100, max: 1000 });
  res.json({ items: await service.listRuns({ trackedProductId, limit }) });
}));

// GET /api/checks/:id  -> one run, including per-attempt details
router.get('/checks/:id', asyncHandler(async (req, res) => {
  res.json(await service.getRun(parsePositiveInt(req.params.id, 'id')));
}));
