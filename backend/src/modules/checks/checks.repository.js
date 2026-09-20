/** All SQL for check runs (the check log) and price snapshots lives here. */
import { db, withTransaction } from '../../db/pool.js';
import { toCamel, rowsToCamel } from '../../lib/case.js';

export async function createRun(trackedProductId, trigger) {
  const { rows } = await db.query(
    `INSERT INTO check_runs (tracked_product_id, trigger, status) VALUES ($1, $2, 'running') RETURNING *`,
    [trackedProductId, trigger],
  );
  return toCamel(rows[0]);
}

export async function hasRunningCheck(trackedProductId) {
  const { rows } = await db.query(
    `SELECT 1 FROM check_runs WHERE tracked_product_id = $1 AND status = 'running' LIMIT 1`,
    [trackedProductId],
  );
  return rows.length > 0;
}

export async function latestSnapshot(trackedProductId) {
  const { rows } = await db.query(
    `SELECT * FROM price_snapshots WHERE tracked_product_id = $1 ORDER BY captured_at DESC LIMIT 1`,
    [trackedProductId],
  );
  return toCamel(rows[0]);
}

/**
 * A successful check: close the run, save the snapshot, schedule the next check.
 * One transaction, so we never end up with a snapshot whose run still says "running".
 */
export async function saveSuccess({ runId, trackedProductId, status, attempts, durationMs, details, observation }) {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE check_runs SET status = $2, attempts = $3, duration_ms = $4, details = $5, finished_at = now()
       WHERE id = $1`,
      [runId, status, attempts, durationMs, details],
    );
    const { rows } = await client.query(
      `INSERT INTO price_snapshots (tracked_product_id, check_run_id, price, mrp, currency, in_stock, stock_quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        trackedProductId, runId, observation.price, observation.mrp, observation.currency,
        observation.inStock, observation.stockQuantity,
      ],
    );
    await client.query(
      `UPDATE tracked_products
       SET last_checked_at = now(), next_check_at = now() + make_interval(mins => check_interval_minutes)
       WHERE id = $1`,
      [trackedProductId],
    );
    return toCamel(rows[0]);
  });
}

/** A failed check: close the run with the reason. NO snapshot is written. Retry sooner than usual. */
export async function saveFailure({ runId, trackedProductId, attempts, durationMs, errorCode, errorMessage, details, retryInMinutes }) {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE check_runs
       SET status = 'failed', attempts = $2, duration_ms = $3, error_code = $4, error_message = $5,
           details = $6, finished_at = now()
       WHERE id = $1`,
      [runId, attempts, durationMs, errorCode, errorMessage?.slice(0, 1000), details],
    );
    await client.query(
      `UPDATE tracked_products
       SET last_checked_at = now(),
           next_check_at = now() + make_interval(mins => LEAST(check_interval_minutes, $2::int))
       WHERE id = $1`,
      [trackedProductId, retryInMinutes],
    );
  });
}

/** Runs left "running" by a crash/restart can never finish - mark them failed on boot. */
export async function failInterruptedRuns() {
  const { rowCount } = await db.query(
    `UPDATE check_runs
     SET status = 'failed', error_code = 'INTERRUPTED',
         error_message = 'Server restarted while this check was running', finished_at = now()
     WHERE status = 'running'`,
  );
  return rowCount;
}

export async function listRuns({ trackedProductId, limit }) {
  const params = [limit];
  let where = '';
  if (trackedProductId) {
    params.push(trackedProductId);
    where = 'WHERE r.tracked_product_id = $2';
  }
  const { rows } = await db.query(
    `SELECT r.id, r.tracked_product_id, r.trigger, r.status, r.attempts, r.error_code, r.error_message,
            r.details, r.started_at, r.finished_at, r.duration_ms,
            c.name AS product_name, s.price, s.in_stock
     FROM check_runs r
     JOIN tracked_products t ON t.id = r.tracked_product_id
     JOIN catalog_products c ON c.id = t.store_product_id
     LEFT JOIN price_snapshots s ON s.check_run_id = r.id
     ${where}
     ORDER BY r.started_at DESC
     LIMIT $1`,
    params,
  );
  return rowsToCamel(rows);
}

export async function getRun(id) {
  const { rows } = await db.query('SELECT * FROM check_runs WHERE id = $1', [id]);
  return toCamel(rows[0]);
}
