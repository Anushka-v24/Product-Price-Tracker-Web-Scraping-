/**
 * Catalog feature: keep a local, searchable copy of the store's products.
 * The sync takes ~1 minute (rate limits), so it runs in the background and the
 * API reports progress through status().
 */
import * as repo from './catalog.repository.js';
import { getScraper } from '../../scraper/index.js';
import { logger } from '../../lib/logger.js';
import { HttpError } from '../../lib/errors.js';

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const sync = { running: false, found: 0, total: null, lastError: null, finishedAt: null };

export async function status() {
  const { count, lastSyncedAt } = await repo.stats();
  return { count, lastSyncedAt, sync: { ...sync } };
}

/** Start a sync in the background. Returns immediately. */
export function startSync() {
  if (sync.running) return false;
  Object.assign(sync, { running: true, found: 0, total: null, lastError: null });
  runSync().catch(() => {});
  return true;
}

async function runSync() {
  const startedAt = Date.now();
  try {
    const { products, total } = await getScraper().crawlCatalog({
      onProgress: ({ found, total: t }) => Object.assign(sync, { found, total: t }),
    });
    await repo.upsertMany(products);
    logger.info('catalog synced', { products: products.length, total, ms: Date.now() - startedAt });
  } catch (error) {
    sync.lastError = error.message;
    logger.error('catalog sync failed', { error: error.message });
  } finally {
    sync.running = false;
    sync.finishedAt = new Date().toISOString();
  }
}

/** On boot: sync if the catalog is empty or older than a day. */
export async function syncIfStale() {
  const { count, lastSyncedAt } = await repo.stats();
  const stale = !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > STALE_AFTER_MS;
  if (count === 0 || stale) startSync();
}

export async function search(query, limit) {
  if (!query || query.trim().length < 2) throw new HttpError(400, 'Search needs at least 2 characters');
  return repo.search(query, limit);
}

/**
 * Make sure one product exists in the local catalog (used when tracking a product
 * before the full sync has finished). Fetches it from the store if needed.
 */
export async function ensureProduct(storeProductId) {
  const existing = await repo.getById(storeProductId);
  if (existing) return existing;
  try {
    const product = await getScraper().storeApi.getProduct(storeProductId);
    await repo.upsertMany([product]);
    return repo.getById(storeProductId);
  } catch (error) {
    if (error.code === 'NOT_FOUND') throw new HttpError(404, `Store has no product with id ${storeProductId}`);
    throw new HttpError(502, `Could not reach the store: ${error.message}`);
  }
}
