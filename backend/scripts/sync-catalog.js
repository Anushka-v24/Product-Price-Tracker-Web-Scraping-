/**
 * Download the store's whole catalog into the database (the server also does this on boot
 * when the catalog is empty or older than a day).
 *
 *   npm run sync-catalog
 */
import { runMigrations } from '../src/db/migrate.js';
import { db } from '../src/db/pool.js';
import { getScraper } from '../src/scraper/index.js';
import { upsertMany } from '../src/modules/catalog/catalog.repository.js';

try {
  await runMigrations();
  const { products, total } = await getScraper().crawlCatalog({
    onProgress: ({ found, total: t }) => console.log(`found ${found}/${t}`),
  });
  await upsertMany(products);
  console.log(`saved ${products.length} of ${total} products`);
} catch (error) {
  console.error('catalog sync failed:', error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
