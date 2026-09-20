# Design note

## 1. What the store does to scrapers (what I found before writing code)

The homepage HTML is an empty shell. A React app loads everything from JSON endpoints:

| Data | Endpoint | Protection |
|---|---|---|
| Catalog | `GET /api/catalog?page&pageSize` | Random sample each call, `pageSize` capped at 60, frequent 429 (with `Retry-After`) and 503 |
| Product details | `GET /api/product/:id` | Same rate limiting. **No price in it** |
| Layout | `GET /api/layout` | Rotating CSS class names + price tag for the price block |
| **Price + stock** | `/api/challenge` → `POST /api/session` → `GET /api/products/:id/price` | Proof-of-work (WASM), canvas/WebGL fingerprint, recorded mouse movements, bearer token, **encrypted** response body |

On the product page the price stays hidden until the mouse has made at least 8 moves (at least 40 ms
apart) and hovered for at least 600 ms. About 1 in 6 "Reveal price" clicks is silently ignored or delayed.
The price API fails often (my first manual try went 503 → 503 → 500 → 200). Once shown, the price
block contains **decoys**: a hidden `.price-value`, a hidden `[data-price]`, a struck-through MRP and
sometimes a "Deal price". The real price uses one of 7 formats (`₹2,690`, `₹2 690`, `₹2.690,00`,
`Rs. 2,690.00`, full-width digits, zero-width characters between digits, trailing "/- incl. taxes").

## 2. Approach: HTTP where possible, a browser only for the price

- **Catalog, search, product details, layout: plain HTTP** (`scraper/storeApi.js`). Cheap and fast.
  The brief prefers this path.
- **Price: Playwright** (`scraper/pricePage.js`). Re-implementing the challenge, fingerprint, token
  and decryption over HTTP would copy the store's obfuscated JavaScript into our code. It would
  break the moment they change it, and it's hard to explain or maintain. A real browser runs the
  store's own code, so we only have to act like a user: hover, click, wait, read.

The store has no search endpoint, so the catalog (1000 products) is synced into Postgres and searched
there. Because every catalog call returns a *random* sample, walking pages 1..N misses products (in
testing, 3 full passes found 946 of 1000). The crawler repeats passes and then fetches any missing id
directly from `/api/product/:id`, which reliably gets all 1000.

## 3. How reliability is achieved

**Retries at three levels, each for a different failure:**

1. HTTP calls: exponential backoff + jitter, honouring `Retry-After` on 429 (`lib/retry.js`).
   Only *retryable* errors (timeouts, 429, 5xx) are retried. A 404 fails immediately.
2. Inside the page: the store's own script retries the price API up to 6 times. We wait for it and
   record how many tries it took ("store attempts").
3. Whole-page attempts (default 3): a fresh browser context each time, because a failed session is
   usually "burned".

Plus: re-clicking when a click is swallowed (checked by watching the block leave its idle state),
refreshing an "Updating…" price, and explicit timeouts on every wait.

**Never storing bad data:**

- The price is read by **two independent methods**: the element carrying the class that
  `/api/layout` says is the price, and "the only visible, not struck-through, unlabelled
  price-looking element". If they disagree, the attempt fails (`PRICE_MISMATCH`). We never guess.
- Every value is parsed after normalising text (full-width digits, zero-width and non-breaking
  characters). Parsers return `null` rather than 0.
- `validate.js` rejects missing, zero, negative or absurd prices and missing stock status.
- A failed check writes **no** snapshot. The database also enforces `price > 0` with a CHECK
  constraint as a last line of defence.
- Snapshot + run status are written in one transaction.

**Honest logging:** every check creates a `check_runs` row *before* it starts (`running`) and ends as
`success`, `retried` (worked, but needed a retry at page level or in the store's API) or `failed`,
with an error code (`STORE_PRICE_ERROR`, `CLICK_IGNORED`, `LAYOUT_CHANGED`, `PRICE_MISMATCH`, …),
per-attempt details, the raw text that was parsed, and the layout revision. Runs left `running` by
a restart are marked `failed / INTERRUPTED` on boot, so nothing is hidden.

**Layout-change detection:** if the price block never appears, or its structure is unexpected, the
check fails with `LAYOUT_CHANGED` and the dashboard shows a warning. All store-specific selectors
live in one file (`scraper/selectors.js`).

## 4. Scheduling on a sleeping server

Render's free tier sleeps, so there's no in-process timer. cron-job.org calls
`/api/cron/run-due` (secret-protected). The endpoint atomically **claims** due products
(`UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` with a 20-minute lease), starts checks in
the background and returns 202 immediately. Per-product `next_check_at` makes custom intervals
free. A failed check is retried after 30 minutes.

## 5. Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Playwright for the price | Robust to changes in the store's JS; simple to explain | ~250 MB RAM, ~5–15 s per check. One browser at a time (a mutex), products checked in sequence, `MAX_CHECKS_PER_RUN` caps work per call |
| Local catalog copy | Fast search; the store has no search API | Up to 24 h stale (auto re-sync on boot if older; manual `POST /api/catalog/sync`). Tracking a product not yet synced fetches it on demand |
| Fail instead of guess on disagreement | No wrong prices in history | Occasionally a check fails that a "best guess" would have got right. It's retried in 30 min |
| cron every 15 min + per-product due times | Custom intervals, drift-tolerant | Slightly more cron calls than "every 2 h" (each is a cheap query when nothing is due) |
| No ORM, hand-written SQL in repositories | Easy to read and change, no magic | A bit more boilerplate |
| In-process event bus for alerts | Alerts can be removed without touching checks | Events are lost if the process dies mid-handler (acceptable for in-app alerts) |
| Render free tier | Free | Cold starts of ~1 min. The UI shows a "waking up" banner |

## 6. What the AI tools got wrong the first time, and how I fixed it

*(Replace or extend with your own experience. These happened while building this project.)*

1. **"Just fetch the HTML."** The first attempt used a plain HTTP GET of the page and got an empty
   React shell with no products or prices. Fixed by inspecting the network traffic and the JS bundle
   to find the real JSON endpoints.
2. **Picked the decoy.** The obvious selector `.price-value` holds a *hidden* fake price
   (₹2,937 when the real one was ₹2,690). Fixed by reading the rotating class from `/api/layout`,
   ignoring hidden/struck-through elements, and cross-checking two methods.
3. **Hover didn't unlock the button.** Moving the pointer to a few points wasn't enough; the page
   counts ≥ 8 `mousemove` events ≥ 40 ms apart plus 600 ms dwell (found in the bundle). Fixed by moving
   in small steps with pauses and checking the button is enabled before clicking.
4. **Assumed a click always works.** The first real click did nothing (the store drops ~1 in 6
   clicks on purpose). Fixed by confirming the block left its idle state and re-clicking.
5. **Naive pagination.** A `for page in 1..17` loop returned duplicates and missed ~5% of products,
   because each page is a random sample. Fixed with repeated passes + direct fetch of missing ids.
6. **Missed the cookie banner.** The first real checks worked, then one failed with `HOVER_GATE`.
   The cause was a full-screen cookie overlay that appears on ~75% of loads at a *random moment
   1.5–5 s after load* (so sometimes mid-hover), whose buttons are named "Decline cookies" (my
   selector expected exactly "Decline"), and which sometimes needs 2–3 clicks to close. While it
   is up, mouse moves hit the overlay instead of the price box, so the price never unlocks. Fixed
   by checking for the overlay before every mouse move and click (plus a Playwright
   `addLocatorHandler`), clicking until it is really gone, and adding a mock-store test for it.
   The check log made this easy to find: the failure was recorded with a clear code, and no bad
   price was saved.
7. **Timers on a free host.** An in-process `setInterval` scheduler would silently stop when Render
   sleeps. Replaced with an external cron hitting a secret-protected endpoint that returns fast.

## 7. Testing

- `tests/parsers.test.js`, `decidePrice.test.js`, `retry.test.js`: every price format, stock phrase,
  decoy scenario and retry rule.
- `tests/scraper.test.js`: **real Chromium** against `tests/mock-store`, a local fake store that
  reproduces the hover gate, the late multi-click cookie overlay, swallowed clicks, 503s, decoys, all 7 price formats, "Updating…" prices,
  missing layout config, out-of-stock, and a removed price block (must fail, never return a price).
- `tests/catalog.test.js`: the crawler finds every product despite random pages and 429s.
- CI runs all of them on every push (`.github/workflows/ci.yml`).
