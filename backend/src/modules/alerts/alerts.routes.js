import { Router } from 'express';
import * as service from './alerts.service.js';
import { asyncHandler, parsePositiveInt, parseLimit } from '../../lib/http.js';

export const router = Router();

// GET /api/alerts?unread=true&limit=50
router.get('/alerts', asyncHandler(async (req, res) => {
  const items = await service.list({
    unreadOnly: req.query.unread === 'true',
    limit: parseLimit(req.query.limit, { fallback: 50, max: 500 }),
  });
  res.json({ items, unreadCount: await service.unreadCount() });
}));

// POST /api/alerts/:id/read
router.post('/alerts/:id/read', asyncHandler(async (req, res) => {
  await service.markRead(parsePositiveInt(req.params.id, 'id'));
  res.json({ unreadCount: await service.unreadCount() });
}));

// POST /api/alerts/read-all
router.post('/alerts/read-all', asyncHandler(async (req, res) => {
  await service.markAllRead();
  res.json({ unreadCount: 0 });
}));
