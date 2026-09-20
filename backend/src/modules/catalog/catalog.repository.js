/** All SQL for the catalog lives here. */
import { db } from '../../db/pool.js';
import { toCamel, rowsToCamel } from '../../lib/case.js';

export async function upsertMany(products, client = db) {
  if (!products.length) return 0;
  const cols = ['id', 'slug', 'name', 'brand', 'category', 'sku'];
  const arrays = cols.map((c) => products.map((p) => p[c] ?? null));
  const { rowCount } = await client.query(
    `INSERT INTO catalog_products (id, slug, name, brand, category, sku, synced_at)
     SELECT u.*, now()
     FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[])
       AS u(id, slug, name, brand, category, sku)
     ON CONFLICT (id) DO UPDATE SET
       slug = EXCLUDED.slug, name = EXCLUDED.name, brand = EXCLUDED.brand,
       category = EXCLUDED.category, sku = EXCLUDED.sku, synced_at = now()`,
    arrays,
  );
  return rowCount;
}

/**
 * Partial or full name search. Every word must appear in the name, SKU or brand.
 * "copper track" finds "Copperpot Trackpad Air"; "COP-10195" finds it by SKU.
 */
export async function search(query, limit) {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  if (!words.length) return [];

  const params = [];
  const conditions = words.map((word) => {
    params.push(`%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const p = `$${params.length}`;
    return `(c.name ILIKE ${p} OR c.sku ILIKE ${p} OR c.brand ILIKE ${p})`;
  });
  params.push(query.trim().toLowerCase(), limit);
  const exact = `$${params.length - 1}`;

  const { rows } = await db.query(
    `SELECT c.id, c.name, c.brand, c.category, c.sku, t.id AS tracked_id
     FROM catalog_products c
     LEFT JOIN tracked_products t ON t.store_product_id = c.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY (lower(c.name) = ${exact} OR lower(c.sku) = ${exact}) DESC,
              (lower(c.name) LIKE ${exact} || '%') DESC,
              c.name
     LIMIT $${params.length}`,
    params,
  );
  return rowsToCamel(rows);
}

export async function getById(id) {
  const { rows } = await db.query('SELECT * FROM catalog_products WHERE id = $1', [id]);
  return toCamel(rows[0]);
}

export async function stats() {
  const { rows } = await db.query('SELECT count(*)::int AS count, max(synced_at) AS last_synced_at FROM catalog_products');
  return toCamel(rows[0]);
}
