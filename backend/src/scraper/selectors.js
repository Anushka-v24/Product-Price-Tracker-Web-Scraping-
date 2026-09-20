/**
 * EVERYTHING that depends on the store's HTML lives in this file.
 * If the store changes its page, this is the first (and usually only) file to update.
 */
export const SELECTORS = {
  priceBlock: '.price-block',
  priceMain: '.price-main',
  idleState: '.price-block.price-idle',
  finalState: '.price-block.price-success, .price-block.price-error',
  successState: '.price-block.price-success',
  errorState: '.price-block.price-error',
  errorMessage: '.price-block.price-error .price-substatus',
  refreshButtonText: /refresh price/i,
  revealButtonName: /reveal price/i,
  // Cookie banner: a full-screen overlay that shows on ~75% of loads, 1.5-5 s AFTER load
  // (so it can pop up mid-hover), and sometimes needs 2-3 clicks to close.
  cookieOverlay: '.cookie-overlay',
  cookieDeclineName: /decline/i, // the button's accessible name is "Decline cookies"
  stockBadge: '.stock-badge',
  outOfStockClass: 'out-stock',
  attemptsMeta: '.price-meta',
};

export const TIMING = {
  navigationTimeoutMs: 30_000,
  priceBlockTimeoutMs: 20_000, // the block renders only after /api/product + /api/layout load
  hoverMoves: 12, // store requires >= 8 mouse moves over the price box...
  hoverMoveGapMs: 70, // ...at least 40 ms apart (faster moves are ignored)...
  dwellMs: 800, // ...and >= 600 ms of hovering before the button unlocks
  clickConfirmMs: 2_500, // how long to wait for a click to "take" before clicking again
  maxClickTries: 4, // ~1 in 6 clicks is silently ignored on purpose
  maxCookieClicks: 5, // banner needs 1 click (70%), 2 (25%) or 3 (5%)
  resultTimeoutMs: 60_000, // the page itself retries the price API up to 6 times
  maxPendingRefreshes: 2, // "Updating…" means the price isn't final yet
};
