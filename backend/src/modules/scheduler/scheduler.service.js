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

const lastRun = { at: null, claimed: 0, started: 0, source: null };

export async function runDueChecks({ graceMinutes = GRACE_MINUTES, source = 'cron' } = {}) {
  const due = await repo.claimDue({
    limit: config.scheduler.maxChecksPerRun,
    graceMinutes,
    leaseMinutes: LEASE_MINUTES,
  });
  const { runs } = await startChecks(due, 'schedule');
  Object.assign(lastRun, { at: new Date().toISOString(), claimed: due.length, started: runs.length, source });
  if (due.length || source === 'cron') logger.info('scheduler run', { source, due: due.length, started: runs.length });
  return { due: due.length, started: runs.length, runIds: runs.map((r) => r.id) };
}

export async function status() {
  return {
    lastRun: { ...lastRun },
    localTimerMinutes: config.scheduler.localTimerMinutes,
    upcoming: await repo.upcoming(),
  };
}

/**
 * Local development convenience (see config.scheduler.localTimerMinutes). Does the same thing
 * cron-job.org does in production: every N minutes, run whatever is due.
 */
export function startLocalTimer() {
  const minutes = config.scheduler.localTimerMinutes;
  if (!minutes) return;
  logger.info('local scheduler timer on (development only)', { everyMinutes: minutes });
  const tick = () =>
    runDueChecks({ graceMinutes: 0, source: 'local-timer' }).catch((error) =>
      logger.error('local scheduler tick failed', { error: error.message }),
    );
  setTimeout(tick, 5_000).unref();
  setInterval(tick, minutes * 60_000).unref();
}
