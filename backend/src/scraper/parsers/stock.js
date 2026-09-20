/**
 * Turn the stock badge into { inStock, quantity }.
 *
 * In-stock wording rotates ("In stock · 19 left", "Only 19 left", "19 in stock",
 * "Selling fast — 19 left", "Hurry, just 19 left") so we don't match exact phrases -
 * we only look for "out of stock" (or the out-stock CSS class) and otherwise pull the number.
 *
 * Returns null when the badge is missing or unreadable, so the caller can fail the check
 * instead of guessing.
 */
import { normalizeText } from './text.js';

export function parseStock({ text, isOutOfStockBadge = false } = {}) {
  const clean = normalizeText(text);
  if (!clean && !isOutOfStockBadge) return null;

  if (isOutOfStockBadge || /out of stock|sold out|unavailable/i.test(clean)) {
    return { inStock: false, quantity: 0 };
  }

  const match = clean.match(/\d[\d,]*/);
  const quantity = match ? Number(match[0].replace(/,/g, '')) : null;
  if (quantity === 0) return { inStock: false, quantity: 0 };
  if (/in stock|left|available/i.test(clean) || quantity > 0) {
    return { inStock: true, quantity };
  }
  return null;
}
