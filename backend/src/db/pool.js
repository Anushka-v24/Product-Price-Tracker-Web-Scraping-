/**
 * One shared PostgreSQL connection pool for the whole app.
 *
 *   import { db } from '../../db/pool.js';
 *   const { rows } = await db.query('SELECT * FROM tracked_products WHERE id = $1', [id]);
 *
 * Always use $1, $2 placeholders (never string concatenation) to avoid SQL injection.
 */
import pg from 'pg';
import { config, assertDatabaseConfigured } from '../config/env.js';

assertDatabaseConfigured();

// Return NUMERIC columns (prices) as JS numbers instead of strings.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => (value === null ? null : Number(value)));

export const db = new pg.Pool({
  connectionString: config.db.url,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

/** Run several queries in one transaction: all succeed or none are saved. */
export async function withTransaction(work) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
