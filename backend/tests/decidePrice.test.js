import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidePrice } from '../src/scraper/pricePage.js';

test('uses the layout-class element when it agrees with the visible price', () => {
  const r = decidePrice({ layoutText: '₹2,690', candidates: ['₹2,690'] });
  assert.equal(r.price.value, 2690);
  assert.equal(r.method, 'layout-class');
});

test('fails instead of guessing when layout and visible prices disagree', () => {
  assert.throws(() => decidePrice({ layoutText: '₹2,690', candidates: ['₹3,302'] }), { code: 'PRICE_MISMATCH' });
});

test('falls back to the single visible price when layout config is missing', () => {
  const r = decidePrice({ layoutText: null, candidates: ['₹2,690'] });
  assert.equal(r.price.value, 2690);
  assert.equal(r.method, 'visible-element');
});

test('refuses ambiguous or empty pages', () => {
  assert.throws(() => decidePrice({ layoutText: null, candidates: ['₹1', '₹2'] }), { code: 'PRICE_AMBIGUOUS' });
  assert.throws(() => decidePrice({ layoutText: null, candidates: [] }), { code: 'PRICE_NOT_FOUND' });
});
