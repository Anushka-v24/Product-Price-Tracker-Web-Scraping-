/** Small helpers for Express route handlers. */
import { HttpError } from './errors.js';

/** Wrap an async route so thrown errors reach the error-handling middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Parse a positive integer route/query/body value or throw a 400. */
export function parsePositiveInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `"${name}" must be a positive integer`);
  return n;
}

/** Parse an optional limit query param with a sane default and cap. */
export function parseLimit(value, { fallback = 50, max = 500 } = {}) {
  if (value === undefined) return fallback;
  const n = parsePositiveInt(value, 'limit');
  return Math.min(n, max);
}
