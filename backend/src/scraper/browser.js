/**
 * Launching Chromium, in one place.
 *
 * - headless=false gives "headed mode": a real window you can watch (used for the demo video).
 * - We try several browsers in order and use the first one that is installed:
 *     1. CHROMIUM_PATH (if you set it)           - a specific browser binary
 *     2. Playwright's full Chromium              - `npx playwright install chromium`
 *     3. Playwright's headless shell (headless only)
 *     4. Your normal Google Chrome               - works even if the Playwright download failed
 * - Images/fonts/media are blocked to save memory and bandwidth; the price doesn't need them.
 */
import { chromium } from 'playwright';
import { logger } from '../lib/logger.js';

const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'];

export async function launchBrowser({ headless = true, slowMoMs = 0, chromiumPath } = {}) {
  const base = { headless, slowMo: slowMoMs, args: ARGS };
  const candidates = chromiumPath
    ? [{ label: `CHROMIUM_PATH (${chromiumPath})`, options: { executablePath: chromiumPath } }]
    : [
        { label: 'Playwright Chromium', options: { channel: 'chromium' } },
        ...(headless ? [{ label: 'Playwright headless shell', options: {} }] : []),
        { label: 'installed Google Chrome', options: { channel: 'chrome' } },
      ];

  const problems = [];
  for (const { label, options } of candidates) {
    try {
      const browser = await chromium.launch({ ...base, ...options });
      if (problems.length) logger.info('browser fallback used', { browser: label });
      return browser;
    } catch (error) {
      // Only "not installed" is worth falling back from; anything else is a real error.
      if (!/executable doesn't exist|not found|looks like playwright|is not installed|distribution/i.test(error.message)) throw error;
      problems.push(label);
    }
  }
  throw new Error(
    `No browser found (tried: ${problems.join(', ')}). Run "npx playwright install chromium" or install Google Chrome.`,
  );
}

/** A fresh, isolated browser context (own cookies/session) for every attempt. */
export async function newContext(browser, { blockHeavyResources = true } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  });
  if (blockHeavyResources) {
    await context.route('**/*', (route) =>
      ['image', 'font', 'media'].includes(route.request().resourceType()) ? route.abort() : route.continue(),
    );
  }
  return context;
}
