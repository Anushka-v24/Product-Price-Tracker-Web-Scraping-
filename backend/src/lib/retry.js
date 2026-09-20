/**
 * Generic retry helper with exponential backoff + jitter.
 *
 *   const result = await withRetry(() => fetchSomething(), { attempts: 5 });
 *
 * - Only errors with `retryable === true` are retried (see lib/errors.js).
 *   Anything else is thrown immediately - no point hammering a 404.
 * - If the error carries `retryAfterMs` (from a 429 Retry-After header) we wait at least that long.
 * - `onRetry` lets callers log each retry, which is how "retried" shows up in the check log.
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry(fn, options = {}) {
  const {
    attempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 15_000,
    onRetry = () => {},
  } = options;

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const canRetry = error?.retryable === true && attempt < attempts;
      if (!canRetry) break;

      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.random() * backoff * 0.3;
      const delay = Math.max(error.retryAfterMs ?? 0, backoff + jitter);
      onRetry({ attempt, error, delayMs: Math.round(delay) });
      await sleep(delay);
    }
  }
  if (lastError && typeof lastError === 'object') lastError.attempts ??= attempts;
  throw lastError;
}
