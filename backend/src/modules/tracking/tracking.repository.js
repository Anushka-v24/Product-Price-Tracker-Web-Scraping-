/** All SQL for tracked products lives here. */
import { db } from '../../db/pool.js';
import { toCamel, rowsToCamel } from '../../lib/case.js';

/**
 * Base query: each tracked product + its catalog info + its latest snapshot + its latest run.
 * LATERAL joins pick "the newest row per product" efficiently thanks to the indexes.
 */
const SELECT_TRACKED = `
  SELECT t.*,
         c.name, c.brand, c.category, c.sku, c.slug,
         s.price      AS latest_price,
         s.mrp        AS latest_mrp,
         s.currency   AS latest_currency,
         s.in_stock   AS latest_in_stock,
         s.stock_quantity AS latest_stock_quantity,
         s.captured_at    AS latest_captured_at,
         r.status     AS last_run_status,
         r.error_code AS last_run_error_code,
         r.started_at AS last_run_started_at
  FROM tracked_products t
  JOIN catalog_products c ON c.id = t.store_product_id
  LEFT JOIN LATERAL (
    SELECT * FROM price_snapshots ps WHERE ps.tracked_product_id = t.id ORDER BY captured_at DESC LIMIT 1
  ) s ON TRUE
  LEFT JOIN LATERAL (
    SELECT * FROM check_runs cr WHERE cr.tracked_product_id = t.id ORDER BY started_at DESC LIMIT 1
  ) r ON TRUE`;

export async function list() {
  const { rows } = await db.query(`${SELECT_TRACKED} ORDER BY t.created_at DESC`);
  return rowsToCamel(rows);
}

export async function getById(id) {
  const { rows } = await db.query(`${SELECT_TRACKED} WHERE t.id = $1`, [id]);
  return toCamel(rows[0]);
}

export async function getByStoreProductId(storeProductId) {
  const { rows } = await db.query('SELECT * FROM tracked_products WHERE store_product_id = $1', [storeProductId]);
  return toCamel(rows[0]);
}

export async function create({ storeProductId, checkIntervalMinutes }) {
  const { rows } = await db.query(
    `INSERT INTO tracked_products (store_product_id, check_interval_minutes)
     VALUES ($1, $2)
     RETURNING *`,
    [storeProductId, checkIntervalMinutes],
  );
  return toCamel(rows[0]);
}

/** Only the fields passed in are changed. */
export async function update(id, { checkIntervalMinutes, isActive }) {
  const { rows } = await db.query(
    `UPDATE tracked_products SET
       check_interval_minutes = COALESCE($2, check_interval_minutes),
       is_active              = COALESCE($3, is_active),
       -- a new interval takes effect from the last check (or now, if never checked)
       next_check_at = CASE WHEN $2::int IS NULL THEN next_check_at
                            ELSE COALESCE(last_checked_at, now()) + make_interval(mins => $2::int) END
     WHERE id = $1
     RETURNING id`,
    [id, checkIntervalMinutes ?? null, isActive ?? null],
  );
  return rows[0] ? getById(id) : null;
}

export async function remove(id) {
  const { rowCount } = await db.query('DELETE FROM tracked_products WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function history(id, limit) {
  const { rows } = await db.query(
    `SELECT id, check_run_id, price, mrp, currency, in_stock, stock_quantity, captured_at
     FROM price_snapshots
     WHERE tracked_product_id = $1
     ORDER BY captured_at DESC
     LIMIT $2`,
    [id, limit],
  );
  return rowsToCamel(rows).reverse(); // oldest first, which is what charts want
}
