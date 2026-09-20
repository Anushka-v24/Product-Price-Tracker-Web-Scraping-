/**
 * DEMO ONLY: make the store's price service slow and failing on purpose, so a recording is
 * guaranteed to show how the scraper copes (the real store fails at random, which may not
 * happen during a 3-minute video). Turned on with `npm run scrape:headed -- 458 --simulate-errors`.
 * Never used by the server.
 *
 *   attempt 1: every price request is slow (2 s) and then fails with 503
 *              -> the store page gives up after its 6 tries -> our page-level retry kicks in
 *   attempt 2: the first price request is very slow (6 s) and fails, later ones pass through
 *              -> the page retries once and the real price is read ("retried")
 */
import { sleep } from '../lib/retry.js';

const isPriceRequest = (url) => /\/api\/(products\/\d+\/price|price\/)/.test(url.pathname);

export async function simulateErrors(context, attempt, log = () => {}) {
  let calls = 0;
  await context.route(isPriceRequest, async (route) => {
    calls++;
    if (attempt === 1) {
      log(`[simulated] price request ${calls}: slow (2 s) then 503`);
      await sleep(2000);
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable (simulated)"}' });
    }
    if (attempt === 2 && calls === 1) {
      log('[simulated] price request 1: very slow (6 s) then 503');
      await sleep(6000);
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable (simulated)"}' });
    }
    return route.continue();
  });
}
