/**
 * Turn the price text shown on the page into a number.
 *
 * Formats the store is known to produce (all mean 2690):
 *   "₹2,690"                         default Indian format
 *   "₹2 690"                         spaces as thousands separator
 *   "₹2.690,00"                      European style (dot thousands, comma decimals)
 *   "₹2,690/- (incl. of all taxes)"  trailing text
 *   "Rs. 2,690.00"                   "Rs." prefix with decimals
 *   "₹２,６９０" / zero-width chars    handled by normalizeText()
 *
 * Rule for separators: if the LAST "." or "," is followed by exactly two digits it is the
 * decimal point; every other "." / "," / space is a thousands separator.
 *
 * Returns { value, currency } or null when no sensible number can be found.
 * It never returns 0 or a negative number - those are treated as "could not parse".
 */
import { normalizeText } from './text.js';

export function parsePrice(raw) {
  const text = normalizeText(raw);
  if (!text) return null;

  // First run of digits, allowing separators (.,space,') between digit groups.
  const match = text.match(/\d(?:[\d.,' ]*\d)?/);
  if (!match) return null;

  const token = match[0].replace(/[ ']/g, '');
  const lastSeparator = Math.max(token.lastIndexOf('.'), token.lastIndexOf(','));

  let integerPart = token;
  let fraction = '';
  if (lastSeparator !== -1 && token.length - lastSeparator - 1 === 2) {
    integerPart = token.slice(0, lastSeparator);
    fraction = token.slice(lastSeparator + 1);
  }
  integerPart = integerPart.replace(/[.,]/g, '');
  if (!/^\d+$/.test(integerPart)) return null;

  const value = Number(fraction ? `${integerPart}.${fraction}` : integerPart);
  if (!Number.isFinite(value) || value <= 0) return null;

  return { value, currency: detectCurrency(text) };
}

function detectCurrency(text) {
  if (/₹|\bRs\.?|\bINR\b/i.test(text)) return 'INR';
  if (/\$/.test(text)) return 'USD';
  if (/€/.test(text)) return 'EUR';
  return 'INR'; // the demo store only sells in rupees
}
