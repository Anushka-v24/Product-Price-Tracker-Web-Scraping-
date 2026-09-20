/**
 * Reads the price + stock of ONE product by driving the real product page with Playwright.
 *
 * Why a browser is needed here (and only here):
 *   The price API (/api/products/:id/price) requires a proof-of-work challenge, a browser
 *   fingerprint (canvas/WebGL), recorded mouse movements, a session token, and returns an
 *   ENCRYPTED body that the page's own JavaScript decrypts. Re-implementing that over plain
 *   HTTP would be fragile and would break whenever the store changes its script. Letting a
 *   real browser run the store's own code is simpler and far more robust.
 *
 * Steps (each one is a small function below so it's easy to change or remove):
 *   1. open the product page and remember the /api/layout response the page receives
 *   2. dismiss the cookie banner
 *   3. hover the price box like a human (the Reveal button stays disabled otherwise)
 *   4. click "Reveal price", re-clicking if the click was silently swallowed
 *   5. wait for success/error (the page retries the price API itself, up to 6 times)
 *   6. if the price is still "Updating…", refresh it
 *   7. collect the raw text and parse it on the Node side (with decoy-proof cross-checks)
 */
import { SELECTORS, TIMING } from './selectors.js';
import { extractPriceBlock } from './extractPriceBlock.js';
import { parsePrice } from './parsers/price.js';
import { parseStock } from './parsers/stock.js';
import { RetryableError } from '../lib/errors.js';
import { sleep } from '../lib/retry.js';

/**
 * @returns {Promise<{observation, details}>}
 * @throws RetryableError with a `code` describing what went wrong
 */
export async function readPriceFromPage(page, { baseUrl, productId, showSteps = false, log = () => {} }) {
  const step = async (label) => {
    log(label);
    if (showSteps) await showStepBanner(page, label);
  };

  // 1. Open page, capture the layout config the page itself loads.
  let layoutPromise = Promise.resolve(null);
  page.on('response', (response) => {
    if (response.url().endsWith('/api/layout') && response.ok()) {
      layoutPromise = response.json().catch(() => null);
    }
  });

  await step(`Opening product ${productId}`);
  const response = await page
    .goto(`${baseUrl}/product/${productId}`, { waitUntil: 'domcontentloaded', timeout: TIMING.navigationTimeoutMs })
    .catch((error) => {
      throw new RetryableError(`page did not load: ${error.message}`, { code: 'NAVIGATION_TIMEOUT' });
    });
  if (response && response.status() >= 500) {
    throw new RetryableError(`product page returned ${response.status()}`, { code: 'STORE_5XX' });
  }

  // The cookie overlay can appear at any moment and blocks the mouse. Playwright calls this
  // handler automatically before any locator action (click, etc.) whenever the overlay is visible.
  await page.addLocatorHandler(page.locator(SELECTORS.cookieOverlay), () => dismissCookieBanner(page), { noWaitAfter: true });

  await step('Waiting for the price block to render');
  await page.waitForSelector(SELECTORS.priceBlock, { timeout: TIMING.priceBlockTimeoutMs }).catch(async () => {
    const text = (await page.locator('main').innerText().catch(() => '')).slice(0, 200);
    if (/couldn.t load this product/i.test(text)) {
      throw new RetryableError(`store could not load the product: ${text}`, { code: 'STORE_PRODUCT_ERROR' });
    }
    // Page loaded but the element we rely on never appeared -> the store's HTML probably changed.
    throw new RetryableError('price block not found on page', { code: 'LAYOUT_CHANGED' });
  });

  // 2. Cookie banner (declining is the privacy-friendly choice; it doesn't affect prices).
  await dismissCookieBanner(page);

  // 3 + 4. Hover, then click Reveal (with re-clicks).
  await step('Hovering over the price area');
  await hoverLikeAHuman(page);
  await step('Clicking "Reveal price"');
  const clickTries = await clickRevealUntilItTakes(page);

  // 5. Wait for the final state.
  await step('Waiting for the store to return the price');
  await waitForFinalState(page);

  // 6. "Updating…" = price not final yet -> refresh.
  let extracted = await extract(page);
  for (let i = 0; extracted.pending && i < TIMING.maxPendingRefreshes; i++) {
    await step('Price still updating - refreshing');
    await page.getByRole('button', { name: SELECTORS.refreshButtonText }).click();
    await waitForFinalState(page);
    extracted = await extract(page);
  }
  if (extracted.pending) throw new RetryableError('price stayed in "Updating…" state', { code: 'PRICE_PENDING' });

  // 7. Parse + cross-check.
  const layout = await layoutPromise;
  const decided = decidePrice(extracted);
  const stock = parseStock({ text: extracted.stockText, isOutOfStockBadge: extracted.stockOutClass });
  if (!stock) throw new RetryableError(`could not read stock from "${extracted.stockText}"`, { code: 'STOCK_UNREADABLE' });

  const mrp = parsePrice(extracted.mrpText)?.value ?? null;
  await step(`Found ${decided.price.currency} ${decided.price.value}, ${stock.inStock ? 'in stock' : 'out of stock'}`);

  return {
    observation: {
      price: decided.price.value,
      currency: decided.price.currency,
      mrp,
      inStock: stock.inStock,
      stockQuantity: stock.quantity,
    },
    details: {
      method: decided.method,
      rawPriceText: decided.rawText,
      rawStockText: extracted.stockText,
      storeAttempts: parseStoreAttempts(extracted.metaText),
      clickTries,
      layoutRevision: layout?.revision ?? null,
      layoutVariant: layout?.variant ?? null,
    },
  };

  async function extract(p) {
    const result = await p.evaluate(extractPriceBlock, {
      layout: await layoutPromise,
      selectors: {
        successState: SELECTORS.successState,
        priceMain: SELECTORS.priceMain,
        stockBadge: SELECTORS.stockBadge,
        outOfStockClass: SELECTORS.outOfStockClass,
        attemptsMeta: SELECTORS.attemptsMeta,
      },
    });
    if (!result.found || !result.hasMain) {
      throw new RetryableError('price block has an unexpected structure', { code: 'LAYOUT_CHANGED' });
    }
    return result;
  }
}

/**
 * Pick the real price from what the page showed, using two independent methods.
 * Exported for unit tests.
 */
export function decidePrice(extracted) {
  const fromLayout = parsePrice(extracted.layoutText);
  const fromVisible = (extracted.candidates || []).map((text) => ({ text, parsed: parsePrice(text) })).filter((c) => c.parsed);

  if (fromLayout) {
    // If the visible elements disagree with the layout-class element, something is off
    // (e.g. the layout changed under us). Don't guess - fail this attempt.
    if (fromVisible.length > 0 && !fromVisible.some((c) => c.parsed.value === fromLayout.value)) {
      throw new RetryableError(
        `layout price ${fromLayout.value} does not match visible prices [${fromVisible.map((c) => c.parsed.value)}]`,
        { code: 'PRICE_MISMATCH' },
      );
    }
    return { price: fromLayout, method: 'layout-class', rawText: extracted.layoutText };
  }

  // Layout config unavailable: fall back to "the only visible price-looking element".
  if (fromVisible.length === 1) {
    return { price: fromVisible[0].parsed, method: 'visible-element', rawText: fromVisible[0].text };
  }
  if (fromVisible.length === 0) throw new RetryableError('no price found on page', { code: 'PRICE_NOT_FOUND' });
  throw new RetryableError(`ambiguous: ${fromVisible.length} visible prices`, { code: 'PRICE_AMBIGUOUS' });
}

/**
 * Close the cookie overlay if it is showing. It sometimes needs 2-3 clicks, so keep clicking
 * "Decline" until it is really gone. Returns true if it was showing.
 */
async function dismissCookieBanner(page) {
  const overlay = page.locator(SELECTORS.cookieOverlay);
  if (!(await overlay.isVisible().catch(() => false))) return false;
  const decline = overlay.getByRole('button', { name: SELECTORS.cookieDeclineName });
  for (let i = 0; i < TIMING.maxCookieClicks; i++) {
    // dispatchEvent avoids re-triggering the locator handler recursively
    await decline.dispatchEvent('click').catch(() => {});
    await sleep(120);
    if (!(await overlay.isVisible().catch(() => false))) return true;
  }
  throw new RetryableError('cookie banner would not close', { code: 'COOKIE_BANNER' });
}

/**
 * The store records mousemove events over the price box and only unlocks the button after
 * enough of them (>= 8, >= 40 ms apart) plus >= 600 ms of hovering. Playwright's mouse
 * produces real (trusted) events, so we just move in small steps with pauses.
 */
async function hoverLikeAHuman(page) {
  const block = page.locator(SELECTORS.priceBlock);
  const button = page.getByRole('button', { name: SELECTORS.revealButtonName });

  for (let round = 1; round <= 3; round++) {
    await block.scrollIntoViewIfNeeded();
    const box = await block.boundingBox();
    if (!box) throw new RetryableError('price block not visible', { code: 'LAYOUT_CHANGED' });

    for (let i = 0; i < TIMING.hoverMoves; i++) {
      // Moves made while the overlay covers the page never reach the price box.
      if (await dismissCookieBanner(page)) i = 0;
      const x = box.x + box.width * (0.15 + (0.6 * i) / TIMING.hoverMoves) + Math.random() * 4;
      const y = box.y + box.height * (0.35 + 0.3 * Math.sin(i)) + Math.random() * 4;
      await page.mouse.move(x, y, { steps: 2 });
      await sleep(TIMING.hoverMoveGapMs);
    }
    await sleep(TIMING.dwellMs);
    await dismissCookieBanner(page);
    if (await button.isEnabled().catch(() => false)) return;
  }
  throw new RetryableError('reveal button stayed disabled after hovering', { code: 'HOVER_GATE' });
}

/** Click, then check the block actually left the "idle" state. Re-click if the click was swallowed. */
async function clickRevealUntilItTakes(page) {
  const button = page.getByRole('button', { name: SELECTORS.revealButtonName });
  for (let tryNo = 1; tryNo <= TIMING.maxClickTries; tryNo++) {
    await dismissCookieBanner(page);
    await button.click({ timeout: 5_000 }).catch(() => {});
    const tookEffect = await page
      .waitForSelector(SELECTORS.idleState, { state: 'detached', timeout: TIMING.clickConfirmMs })
      .then(() => true)
      .catch(() => false);
    if (tookEffect) return tryNo;
  }
  throw new RetryableError('reveal click was ignored repeatedly', { code: 'CLICK_IGNORED' });
}

async function waitForFinalState(page) {
  await page.waitForSelector(SELECTORS.finalState, { timeout: TIMING.resultTimeoutMs }).catch(() => {
    throw new RetryableError('store did not return a price in time', { code: 'PRICE_TIMEOUT' });
  });
  if (await page.locator(SELECTORS.errorState).count()) {
    const message = await page.locator(SELECTORS.errorMessage).innerText().catch(() => 'unknown error');
    throw new RetryableError(`store gave up loading the price: ${message}`, { code: 'STORE_PRICE_ERROR' });
  }
}

function parseStoreAttempts(metaText) {
  const match = /loaded in (\d+) attempt/i.exec(metaText || '');
  return match ? Number(match[1]) : null;
}

/** Headed-mode helper: a label in the corner so viewers of the demo video can follow along. */
async function showStepBanner(page, label) {
  await page
    .evaluate((text) => {
      let el = document.getElementById('__scraper_step');
      if (!el) {
        el = document.createElement('div');
        el.id = '__scraper_step';
        el.style.cssText =
          'position:fixed;left:12px;bottom:12px;z-index:2147483647;pointer-events:none;' +
          'background:#111;color:#7CFC9A;font:600 14px/1.4 monospace;padding:8px 12px;border-radius:6px;opacity:.92';
        document.body.appendChild(el);
      }
      el.textContent = `🤖 ${text}`;
    }, label)
    .catch(() => {});
}
