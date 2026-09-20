/**
 * End-to-end scraper tests against the mock store (real Chromium, no internet needed).
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startMockStore } from './mock-store/server.js';
import { createScraper } from '../src/scraper/index.js';

const stores = [];
after(() => Promise.all(stores.map((s) => s.close())));

async function check(storeOptions, scraperOptions = {}) {
  const store = await startMockStore(storeOptions);
  stores.push(store);
  const scraper = createScraper({ baseUrl: store.url, headless: true, maxAttempts: 2, ...scraperOptions });
  return { result: await scraper.checkPrice(1), store };
}

test('reads the real price, ignoring every decoy', async () => {
  const { result } = await check({});
  assert.equal(result.ok, true, result.errorMessage);
  assert.equal(result.observation.price, 2690);
  assert.equal(result.observation.mrp, 3022);
  assert.equal(result.observation.inStock, true);
  assert.equal(result.observation.stockQuantity, 19);
  assert.equal(result.details.method, 'layout-class');
});

for (const format of ['spaced', 'euro', 'trailing', 'unicode', 'nbsp', 'lakh']) {
  test(`parses the "${format}" price format`, async () => {
    const { result } = await check({ format, priceTag: 'strong' });
    assert.equal(result.ok, true, result.errorMessage);
    assert.equal(result.observation.price, 2690);
  });
}

test('re-clicks when clicks are swallowed', async () => {
  const { result } = await check({ ignoredClicks: 2 });
  assert.equal(result.ok, true, result.errorMessage);
  assert.equal(result.details.clickTries, 3);
});

test('closes a cookie overlay that appears mid-hover and needs 3 clicks', async () => {
  const { result } = await check({ cookieDelayMs: 500, cookieClicks: 3 });
  assert.equal(result.ok, true, result.errorMessage);
  assert.equal(result.observation.price, 2690);
});

test('demo mode: recovers from simulated slow + failing responses', async () => {
  const { result } = await check({}, { simulateErrors: true, maxAttempts: 3 });
  assert.equal(result.ok, true, result.errorMessage);
  assert.equal(result.attempts, 2);
  assert.equal(result.details.attemptLog[0].code, 'STORE_PRICE_ERROR');
  assert.equal(result.details.storeAttempts, 2);
});

test('survives store 503s (page-level retries)', async () => {
  const { result } = await check({ priceFailures: 3 });
  assert.equal(result.ok, true, result.errorMessage);
  assert.equal(result.details.storeAttempts, 4);
});

test('retries with a fresh page when the store gives up completely', async () => {
  const { result } = await check({ priceFailures: 6 }); // first page load fails all 6 tries, second works
  assert.equal(result.ok, true, result.errorMessage);
  assert.equal(result.attempts, 2);
  assert.equal(result.details.attemptLog[0].code, 'STORE_PRICE_ERROR');
});

test('refreshes an "Updating…" price', async () => {
  const { result } = await check({ pendingFirst: true });
  assert.equal(result.ok, true, result.errorMessage);
  assert.equal(result.observation.price, 2690);
});

test('works without the layout config (fallback method)', async () => {
  const { result } = await check({ layoutFails: true });
  assert.equal(result.ok, true, result.errorMessage);
  assert.equal(result.details.method, 'visible-element');
});

test('detects out of stock', async () => {
  const { result } = await check({ stock: 0 });
  assert.equal(result.ok, true, result.errorMessage);
  assert.equal(result.observation.inStock, false);
  assert.equal(result.observation.stockQuantity, 0);
});

test('reports a layout change as a failure and never returns a price', async () => {
  const { result } = await check({ removePriceBlock: true }, { maxAttempts: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'LAYOUT_CHANGED');
  assert.equal(result.observation, undefined);
});
