/**
 * Plain-HTTP client for the store's public JSON endpoints.
 *
 * This is the "lightweight" path the brief asks us to prefer. It is used for everything
 * that does NOT need a browser: the catalog (for search), product details, and the page
 * layout config. Only the price needs Playwright (see pricePage.js for why).
 *
 * The store randomly answers with 429 (rate limit, includes Retry-After) and 503/500.
 * Those become RetryableErrors and are retried with backoff by withRetry().
 */
import { RetryableError, FatalError } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import { logger } from '../lib/logger.js';

const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

export function createStoreApi({ baseUrl, fetchImpl = fetch, attempts = 6 } = {}) {
  async function requestJson(path) {
    let response;
    try {
      response = await fetchImpl(baseUrl + path, {
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // DNS failure, connection reset, or our own timeout -> worth retrying.
      throw new RetryableError(`network error on ${path}: ${error.message}`, { code: 'NETWORK' });
    }

    if (response.status === 429) {
      const retryAfterSec = Number(response.headers.get('retry-after')) || 1;
      throw new RetryableError(`rate limited on ${path}`, { code: 'RATE_LIMITED', retryAfterMs: retryAfterSec * 1000 });
    }
    if (response.status >= 500) {
      throw new RetryableError(`store returned ${response.status} on ${path}`, { code: 'STORE_5XX' });
    }
    if (response.status === 404) throw new FatalError(`not found: ${path}`, { code: 'NOT_FOUND' });
    if (!response.ok) throw new FatalError(`store returned ${response.status} on ${path}`, { code: `HTTP_${response.status}` });

    try {
      return await response.json();
    } catch {
      throw new RetryableError(`invalid JSON on ${path}`, { code: 'BAD_JSON' });
    }
  }

  const getJson = (path) =>
    withRetry(() => requestJson(path), {
      attempts,
      baseDelayMs: 400,
      onRetry: ({ attempt, error, delayMs }) =>
        logger.debug('store api retry', { path, attempt, reason: error.code, delayMs }),
    });

  return {
    /** One page of the catalog. NOTE: the store returns a random sample per call - see catalogCrawler.js */
    getCatalogPage: (page, pageSize = 60) => getJson(`/api/catalog?page=${page}&pageSize=${pageSize}`),
    /** Product details (name, sku, specs...). Contains NO price. */
    getProduct: (id) => getJson(`/api/product/${id}`),
    /** Rotating CSS class names used to render the price block. */
    getLayout: () => getJson('/api/layout'),
  };
}
