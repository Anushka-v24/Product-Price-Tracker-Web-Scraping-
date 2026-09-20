/**
 * Public entry point of the scraper. The rest of the app only uses these functions:
 *
 *   const scraper = createScraper();
 *   await scraper.checkPrices([458, 12], { onResult });   // one browser, products checked in turn
 *   await scraper.crawlCatalog();                          // plain HTTP, no browser
 *
 * Each product gets up to SCRAPER_MAX_ATTEMPTS page-level attempts. Every attempt uses a
 * fresh browser context (new cookies/session), because a failed session is often "burned".
 */
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { withRetry } from '../lib/retry.js';
import { browserLock } from '../lib/lock.js';
import { RetryableError } from '../lib/errors.js';
import { createStoreApi } from './storeApi.js';
import { crawlCatalog } from './catalogCrawler.js';
import { launchBrowser, newContext } from './browser.js';
import { readPriceFromPage } from './pricePage.js';
import { validateObservation } from './validate.js';
import { simulateErrors } from './simulateErrors.js';

export function createScraper(overrides = {}) {
  const options = { ...config.scraper, baseUrl: config.store.baseUrl, ...overrides };
  const storeApi = createStoreApi({ baseUrl: options.baseUrl });

  /** Check several products with ONE browser (cheaper than one browser per product). */
  function checkPrices(productIds, { onResult = () => {}, headless = options.headless } = {}) {
    return browserLock.run(async () => {
      const browser = await launchBrowser({ ...options, headless });
      const results = [];
      try {
        for (const productId of productIds) {
          const result = await checkOne(browser, productId, { showSteps: !headless });
          results.push(result);
          await onResult(result);
        }
      } finally {
        await browser.close().catch(() => {});
      }
      return results;
    });
  }

  async function checkOne(browser, productId, { showSteps }) {
    const startedAt = Date.now();
    const attemptLog = [];

    try {
      const { observation, details } = await withRetry(
        async (attempt) => {
          const attemptStart = Date.now();
          const context = await newContext(browser, { blockHeavyResources: !showSteps });
          if (options.simulateErrors) await simulateErrors(context, attempt, (msg) => logger.warn(msg, { productId }));
          const page = await context.newPage();
          try {
            const result = await readPriceFromPage(page, {
              baseUrl: options.baseUrl,
              productId,
              showSteps,
              log: (msg) => logger.debug(msg, { productId, attempt }),
            });
            const problems = validateObservation(result.observation);
            if (problems.length) {
              throw new RetryableError(`invalid data: ${problems.join('; ')}`, { code: 'INVALID_DATA' });
            }
            attemptLog.push({ attempt, ok: true, ms: Date.now() - attemptStart });
            return result;
          } catch (error) {
            attemptLog.push({ attempt, ok: false, code: error.code ?? 'UNEXPECTED', message: error.message, ms: Date.now() - attemptStart });
            // Unknown errors (e.g. Playwright crashed) are treated as temporary too.
            if (error.retryable === undefined) error.retryable = true;
            throw error;
          } finally {
            await context.close().catch(() => {});
          }
        },
        {
          attempts: options.maxAttempts,
          baseDelayMs: 2_000,
          onRetry: ({ attempt, error, delayMs }) =>
            logger.warn('price check attempt failed, retrying', { productId, attempt, code: error.code, delayMs }),
        },
      );

      return {
        ok: true,
        productId,
        observation,
        attempts: attemptLog.length,
        durationMs: Date.now() - startedAt,
        details: { ...details, attemptLog },
      };
    } catch (error) {
      logger.error('price check failed', { productId, code: error.code, message: error.message });
      return {
        ok: false,
        productId,
        attempts: attemptLog.length,
        durationMs: Date.now() - startedAt,
        errorCode: error.code ?? 'UNEXPECTED',
        errorMessage: error.message,
        details: { attemptLog },
      };
    }
  }

  return {
    checkPrices,
    checkPrice: async (productId, opts) => (await checkPrices([productId], opts))[0],
    crawlCatalog: (opts) => crawlCatalog(storeApi, opts),
    storeApi,
  };
}

/** One shared scraper for the whole server (created on first use). */
let shared;
export function getScraper() {
  shared ??= createScraper();
  return shared;
}
