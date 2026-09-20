import { db } from '../../db/pool.js';
import { toCamel, rowsToCamel } from '../../lib/case.js';

export async function create({ trackedProductId, type, message, oldValue, newValue }) {
  const { rows } = await db.query(
    `INSERT INTO alerts (tracked_product_id, type, message, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [trackedProductId, type, message, oldValue, newValue],
  );
  return toCamel(rows[0]);
}

export async function list({ unreadOnly, limit }) {
  const { rows } = await db.query(
    `SELECT a.*, c.name AS product_name
     FROM alerts a
     JOIN tracked_products t ON t.id = a.tracked_product_id
     JOIN catalog_products c ON c.id = t.store_product_id
     ${unreadOnly ? 'WHERE a.read_at IS NULL' : ''}
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rowsToCamel(rows);
}

export async function unreadCount() {
  const { rows } = await db.query('SELECT count(*)::int AS count FROM alerts WHERE read_at IS NULL');
  return rows[0].count;
}

export async function markRead(id) {
  const { rowCount } = await db.query('UPDATE alerts SET read_at = now() WHERE id = $1 AND read_at IS NULL', [id]);
  return rowCount;
}

export async function markAllRead() {
  const { rowCount } = await db.query('UPDATE alerts SET read_at = now() WHERE read_at IS NULL');
  return rowCount;
}
