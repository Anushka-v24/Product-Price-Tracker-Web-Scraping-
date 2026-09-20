import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import * as service from './scheduler.service.js';
import { config } from '../../config/env.js';
import { asyncHandler } from '../../lib/http.js';
import { HttpError } from '../../lib/errors.js';

export const router = Router();

/**
 * Only callers that know CRON_SECRET may trigger checks. cron-job.org sends it as a header
 * (x-cron-secret) or, if you prefer, as ?key=... in the URL.
 */
function requireCronSecret(req, res, next) {
  const expected = config.scheduler.cronSecret;
  const given = req.get('x-cron-secret') || req.query.key || '';
  if (!expected) return next(new HttpError(503, 'CRON_SECRET is not configured on the server'));
  const a = Buffer.from(String(given));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return next(new HttpError(401, 'Invalid cron secret'));
  next();
}

// GET or POST /api/cron/run-due  -> starts due checks and answers right away (202).
// Answering fast matters: cron-job.org gives up after 30 seconds, and a check can take longer.
const runDue = asyncHandler(async (req, res) => {
  res.status(202).json(await service.runDueChecks());
});
router.get('/cron/run-due', requireCronSecret, runDue);
router.post('/cron/run-due', requireCronSecret, runDue);

// GET /api/scheduler/status  -> last cron call + the next products in line (for the UI)
router.get('/scheduler/status', asyncHandler(async (req, res) => {
  res.json(await service.status());
}));
