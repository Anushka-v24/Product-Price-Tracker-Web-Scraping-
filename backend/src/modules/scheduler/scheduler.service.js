/**
 * Scheduler feature.
 *
 * Why not setInterval / node-cron inside the server?
 *   Render's free tier puts the server to sleep after ~15 minutes without traffic, and a
 *   sleeping server runs no timers. So an EXTERNAL service (cron-job.org) calls
 *   GET /api/cron/run-due on a schedule. That request wakes the server up and starts the
 *   checks that are due.
 *
 * Each product has its own interval (default 120 min). cron-job.org can call us every
 * 15 minutes; only products that are actually due get checked.
 */
import * as repo from './scheduler.repository.js';
import { startChecks } from '../checks/checks.service.js';
import { config } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

// A product due within the next few minutes is checked now, so small cron timing drift
// doesn't push a check back by a whole cron period.
const GRACE_MINUTES = 5;
// While a check is in progress the product is "leased" for this long.
const LEASE_MINUTES = 20;

const lastRun = { at: null, claimed: 0, started: 0 };

export async function runDueChecks() {
  const due = await repo.claimDue({
    limit: config.scheduler.maxChecksPerRun,
    graceMinutes: GRACE_MINUTES,
    leaseMinutes: LEASE_MINUTES,
  });
  const { runs } = await startChecks(due, 'schedule');
  Object.assign(lastRun, { at: new Date().toISOString(), claimed: due.length, started: runs.length });
  logger.info('scheduler run', { due: due.length, started: runs.length });
  return { due: due.length, started: runs.length, runIds: runs.map((r) => r.id) };
}

export async function status() {
  return { lastRun: { ...lastRun }, upcoming: await repo.upcoming() };
}
