/**
 * Check one or more products from the command line - no server, no database needed.
 * This is the easiest way to watch the scraper work ("headed mode") for the demo video.
 *
 *   npm run scrape -- 458              headless, prints the result
 *   npm run scrape:headed -- 458 12    opens a visible browser, slowed down so you can follow
 *   npm run scrape:headed -- 458 --simulate-errors
 *                                      also makes the price service slow + failing on purpose, to
 *                                      show the retries in a demo (see src/scraper/simulateErrors.js)
 *
 * The numbers are the STORE's product ids (the number in /product/458 on the store).
 */
import { createScraper } from '../src/scraper/index.js';

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const simulate = args.includes('--simulate-errors');
const ids = args.filter((a) => /^\d+$/.test(a)).map(Number);

if (!ids.length) {
  console.error('Usage: npm run scrape[:headed] -- <storeProductId> [more ids...]');
  process.exit(1);
}

const scraper = createScraper({
  headless: !headed,
  slowMoMs: headed ? Number(process.env.SCRAPER_SLOW_MO || 150) : 0,
  simulateErrors: simulate,
});
if (simulate) console.log('⚠ Simulating a slow, failing price service (demo mode)');

const results = await scraper.checkPrices(ids, {
  onResult: (r) => {
    if (r.ok) {
      const o = r.observation;
      console.log(
        `✔ product ${r.productId}: ${o.currency} ${o.price} (MRP ${o.mrp ?? '-'}), ` +
          `${o.inStock ? `in stock (${o.stockQuantity ?? '?'})` : 'OUT OF STOCK'} ` +
          `- ${r.attempts} page attempt(s), store needed ${r.details.storeAttempts ?? '?'} try(s), ${r.durationMs} ms`,
      );
    } else {
      console.log(`✘ product ${r.productId}: FAILED [${r.errorCode}] ${r.errorMessage} (${r.attempts} attempts)`);
    }
    console.log(JSON.stringify(r.details, null, 2));
  },
});

process.exitCode = results.every((r) => r.ok) ? 0 : 1;
