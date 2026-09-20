/**
 * Minimal migration runner.
 *
 * Every *.sql file in ./migrations runs once, in file-name order, and is recorded in
 * the `schema_migrations` table. To change the schema: add a NEW file such as
 * `004_add_email_alerts.sql` - never edit a file that has already run in production.
 *
 * Runs automatically when the server starts, and manually with `npm run migrate`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { db } from './pool.js';
import { logger } from '../lib/logger.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations/', import.meta.url));

export async function runMigrations() {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await db.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(MIGRATIONS_DIR + file, 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      logger.info('migration applied', { file });
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${error.message}`);
    } finally {
      client.release();
    }
  }
}

// Allow `node src/db/migrate.js`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => logger.info('migrations up to date'))
    .catch((error) => {
      logger.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => db.end());
}
