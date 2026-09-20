/**
 * The store deliberately writes numbers in awkward ways. normalizeText() undoes the tricks
 * so the other parsers only ever see plain ASCII digits and single spaces.
 *
 *   "₹２,６９０"          full-width digits     -> "₹2,690"
 *   "₹ ​2..."   non-breaking + zero-width characters between every letter -> "₹2..."
 */
const FULL_WIDTH_DIGITS = /[０-９]/g;          // ０-９
const ZERO_WIDTH = /[​-‍⁠﻿]/g;      // zero-width space/joiners, BOM
const ODD_SPACES = /[    ]/g;        // nbsp, figure/thin spaces

export function normalizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(FULL_WIDTH_DIGITS, (d) => String.fromCharCode(d.charCodeAt(0) - 0xff10 + 48))
    .replace(ZERO_WIDTH, '')
    .replace(ODD_SPACES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
