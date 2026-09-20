/**
 * Checks feature: run price checks and record every outcome in the check log.
 *
 * Flow for each product:
 *   1. insert a check_runs row with status "running"
 *   2. ask the scraper for the price (Playwright, with retries)
 *   3. success -> status "success" (or "retried" if it needed retries) + a price_snapshots row
 *      failure -> status "failed" with an error code; NO price row, so bad data never reaches history
 *   4. emit 'check.succeeded' / 'check.failed' so optional features (alerts) can react
 */
import * as repo from './checks.repository.js';
import { getScraper } from '../../scraper/index.js';
import { events } from '../../lib/events.js';
import { logger } from '../../lib/logger.js';
import { HttpError } from '../../lib/errors.js';

/** After a failure, try again within this many minutes (or the normal interval if shorter). */
const RETRY_FAILED_AFTER_MINUTES = 30;

/**
 * Start checks for several tracked products. Returns the created runs immediately;
 * the actual scraping continues in the background (it can take a while per product).
 *
 * @param {Array<{id, storeProductId}>} trackedProducts
 * @param {'schedule'|'manual'} trigger
 */
export async function startChecks(trackedProducts, trigger) {
  const jobs = [];
  for (const tracked of trackedProducts) {
    if (await repo.hasRunningCheck(tracked.id)) {
      logger.info('check skipped, one is already running', { trackedId: tracked.id });
      continue;
    }
    const run = await repo.createRun(tracked.id, trigger);
    jobs.push({ tracked, run });
  }
  if (jobs.length) {
    const done = runJobs(jobs).catch((error) => logger.error('check batch crashed', { error: error.message }));
    return { runs: jobs.map((j) => j.run), done };
  }
  return { runs: [], done: Promise.resolve() };
}

/** Manual "Check now" for one product. */
export async function checkNow(tracked) {
  if (await repo.hasRunningCheck(tracked.id)) throw new HttpError(409, 'A check for this product is already running');
  const { runs } = await startChecks([tracked], 'manual');
  return runs[0];
}

async function runJobs(jobs) {
  const byStoreId = new Map(jobs.map((job) => [job.tracked.storeProductId, job]));
  try {
    await getScraper().checkPrices([...byStoreId.keys()], {
      onResult: (result) => recordResult(byStoreId.get(result.productId), result),
    });
  } catch (error) {
    // The browser itself failed to start (e.g. out of memory). Close every run that didn't finish.
    for (const job of jobs) {
      if (!job.finished) {
        await recordResult(job, {
          ok: false, attempts: 0, durationMs: 0,
          errorCode: 'BROWSER_FAILED', errorMessage: error.message, details: {},
        });
      }
    }
  }
}

async function recordResult(job, result) {
  if (!job || job.finished) return;
  job.finished = true;
  const { tracked, run } = job;

  try {
    if (result.ok) {
      const previous = await repo.latestSnapshot(tracked.id);
      const status = neededRetries(result) ? 'retried' : 'success';
      const snapshot = await repo.saveSuccess({
        runId: run.id,
        trackedProductId: tracked.id,
        status,
        attempts: result.attempts,
        durationMs: result.durationMs,
        details: result.details,
        observation: result.observation,
      });
      logger.info('check finished', { trackedId: tracked.id, status, price: snapshot.price, inStock: snapshot.inStock });
      events.emitSafe('check.succeeded', { tracked, previous, current: snapshot });
    } else {
      await repo.saveFailure({
        runId: run.id,
        trackedProductId: tracked.id,
        attempts: result.attempts,
        durationMs: result.durationMs,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        details: result.details,
        retryInMinutes: RETRY_FAILED_AFTER_MINUTES,
      });
      logger.warn('check failed', { trackedId: tracked.id, code: result.errorCode });
      events.emitSafe('check.failed', { tracked, run: { ...run, errorCode: result.errorCode } });
    }
  } catch (error) {
    // e.g. the database rejected the snapshot. Make sure the run doesn't stay "running".
    logger.error('could not save check result', { trackedId: tracked.id, error: error.message });
    await repo
      .saveFailure({
        runId: run.id, trackedProductId: tracked.id, attempts: result.attempts ?? 0, durationMs: result.durationMs ?? 0,
        errorCode: 'SAVE_FAILED', errorMessage: error.message, details: result.details ?? {},
        retryInMinutes: RETRY_FAILED_AFTER_MINUTES,
      })
      .catch(() => {});
  }
}

/** "retried" = we needed more than one page attempt, or the store's price API failed at least once. */
function neededRetries(result) {
  return result.attempts > 1 || (result.details?.storeAttempts ?? 1) > 1;
}

export const listRuns = (filters) => repo.listRuns(filters);

export async function getRun(id) {
  const run = await repo.getRun(id);
  if (!run) throw new HttpError(404, `Check run ${id} not found`);
  return run;
}

export async function onStart() {
  const count = await repo.failInterruptedRuns();
  if (count) logger.warn('marked interrupted checks as failed', { count });

  // First check right after a product is tracked, so the user sees a price quickly.
  events.on('tracked.created', ({ tracked }) => {
    startChecks([tracked], 'manual').catch((error) =>
      logger.error('first check could not start', { trackedId: tracked.id, error: error.message }),
    );
  });
}
