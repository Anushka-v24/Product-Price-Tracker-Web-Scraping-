import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice } from '../src/scraper/parsers/price.js';
import { parseStock } from '../src/scraper/parsers/stock.js';
import { normalizeText } from '../src/scraper/parsers/text.js';
import { validateObservation } from '../src/scraper/validate.js';

test('parsePrice understands every format the store uses', () => {
  const cases = {
    '₹2,690': 2690,
    '₹2 690': 2690,
    '₹2.690,00': 2690,
    '₹2,690/- (incl. of all taxes)': 2690,
    'Rs. 2,690.00': 2690,
    '₹２,６９０': 2690,
    '₹ ​2 ​, ​6 ​9 ​0': 2690,
    '₹1,23,456': 123456,
    '₹499': 499,
    'Rs. 1,299.50': 1299.5,
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(parsePrice(input)?.value, expected, `failed for ${JSON.stringify(input)}`);
    assert.equal(parsePrice(input)?.currency, 'INR');
  }
});

test('parsePrice refuses empty, zero and garbage', () => {
  for (const input of ['', null, undefined, '₹0', 'Price hidden', '—', '₹0.00']) {
    assert.equal(parsePrice(input), null, `should reject ${JSON.stringify(input)}`);
  }
});

test('parseStock handles all rotating in-stock phrases', () => {
  for (const text of ['In stock · 19 left', 'Only 19 left', '19 in stock', 'Selling fast — 19 left', 'Hurry, just 19 left']) {
    assert.deepEqual(parseStock({ text }), { inStock: true, quantity: 19 }, text);
  }
});

test('parseStock detects out of stock by text or badge class', () => {
  assert.deepEqual(parseStock({ text: 'Out of stock' }), { inStock: false, quantity: 0 });
  assert.deepEqual(parseStock({ text: '', isOutOfStockBadge: true }), { inStock: false, quantity: 0 });
  assert.equal(parseStock({ text: '' }), null);
  assert.equal(parseStock({}), null);
});

test('normalizeText strips invisible characters and full-width digits', () => {
  assert.equal(normalizeText('a​b c ３'), 'ab c 3');
});

test('validateObservation blocks bad data from being saved', () => {
  const good = { price: 2690, mrp: 3022, currency: 'INR', inStock: true, stockQuantity: 19 };
  assert.deepEqual(validateObservation(good), []);
  assert.ok(validateObservation({ ...good, price: 0 }).length);
  assert.ok(validateObservation({ ...good, price: NaN }).length);
  assert.ok(validateObservation({ ...good, price: null }).length);
  assert.ok(validateObservation({ ...good, inStock: undefined }).length);
  assert.ok(validateObservation({ ...good, stockQuantity: -1 }).length);
  assert.ok(validateObservation(null).length);
});
