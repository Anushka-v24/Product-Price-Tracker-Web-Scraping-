import { db } from '../../db/pool.js';
import { rowsToCamel } from '../../lib/case.js';

/**
 * Pick the products whose check is due, and "claim" them in the same statement by pushing
 * next_check_at forward (a lease). If cron-job.org calls us twice in a row, or two server
 * instances run, the same product can't be picked twice. The real next_check_at is written
 * when the check finishes.
 *
 * FOR UPDATE SKIP LOCKED = rows another transaction is claiming right now are skipped, not waited on.
 */
export async function claimDue({ limit, graceMinutes, leaseMinutes }) {
  const { rows } = await db.query(
    `UPDATE tracked_products t
     SET next_check_at = now() + make_interval(mins => $3::int)
     WHERE t.id IN (
       SELECT id FROM tracked_products
       WHERE is_active AND next_check_at <= now() + make_interval(mins => $2::int)
       ORDER BY next_check_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING t.id, t.store_product_id`,
    [limit, graceMinutes, leaseMinutes],
  );
  return rowsToCamel(rows);
}

export async function upcoming(limit = 20) {
  const { rows } = await db.query(
    `SELECT t.id, c.name, t.next_check_at, t.check_interval_minutes
     FROM tracked_products t JOIN catalog_products c ON c.id = t.store_product_id
     WHERE t.is_active ORDER BY t.next_check_at LIMIT $1`,
    [limit],
  );
  return rowsToCamel(rows);
}
