/**
 * Download the full catalog so users can search it.
 *
 * Why this is not a simple "for page = 1..N" loop:
 *   - the store has no search endpoint,
 *   - pageSize is capped at 60,
 *   - and every call returns a RANDOM sample, so walking pages 1..17 repeats some products
 *     and misses others (in testing, 3 full passes found only 946 of 1000).
 *
 * Strategy:
 *   1. Walk the pages a few times, collecting unique products by id, until we have `total`.
 *   2. Product ids are 1..total, so fetch any still-missing id directly from /api/product/:id.
 */
import { logger } from '../lib/logger.js';
import { sleep } from '../lib/retry.js';

const PAGE_SIZE = 60;
const MAX_PASSES = 4;
const POLITE_DELAY_MS = 150;

export async function crawlCatalog(storeApi, { onProgress = () => {} } = {}) {
  const products = new Map();
  const add = (item) => {
    if (isValidCatalogItem(item)) products.set(item.id, pick(item));
  };

  const first = await storeApi.getCatalogPage(1, PAGE_SIZE);
  const total = Number(first.total) || 0;
  const pages = Number(first.pages) || 1;
  first.items?.forEach(add);

  for (let pass = 1; pass <= MAX_PASSES && products.size < total; pass++) {
    for (let page = 1; page <= pages && products.size < total; page++) {
      if (pass === 1 && page === 1) continue; // already fetched above
      const data = await storeApi.getCatalogPage(page, PAGE_SIZE);
      data.items?.forEach(add);
      await sleep(POLITE_DELAY_MS);
    }
    logger.info('catalog pass finished', { pass, found: products.size, total });
    onProgress({ found: products.size, total });
  }

  // Fill the gaps one product at a time.
  for (let id = 1; id <= total && products.size < total; id++) {
    if (products.has(id)) continue;
    try {
      add(await storeApi.getProduct(id));
    } catch (error) {
      logger.warn('could not fetch catalog item', { id, reason: error.code ?? error.message });
    }
    await sleep(POLITE_DELAY_MS);
  }

  onProgress({ found: products.size, total });
  return { products: [...products.values()], total };
}

function isValidCatalogItem(item) {
  return (
    item &&
    Number.isInteger(item.id) &&
    item.id > 0 &&
    typeof item.name === 'string' &&
    item.name.trim() !== '' &&
    typeof item.sku === 'string'
  );
}

const pick = ({ id, slug, name, brand, category, sku }) => ({ id, slug: slug ?? '', name, brand, category, sku });
