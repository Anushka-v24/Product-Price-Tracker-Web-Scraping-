import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startMockStore } from './mock-store/server.js';
import { createStoreApi } from '../src/scraper/storeApi.js';
import { crawlCatalog } from '../src/scraper/catalogCrawler.js';

test('crawler collects every product even though pages are random samples with 429s', async () => {
  const store = await startMockStore({ catalog429Rate: 0.3 });
  try {
    const api = createStoreApi({ baseUrl: store.url, attempts: 10 });
    const { products, total } = await crawlCatalog(api);
    assert.equal(total, 120);
    assert.equal(products.length, 120);
    assert.equal(new Set(products.map((p) => p.id)).size, 120);
  } finally {
    await store.close();
  }
});
