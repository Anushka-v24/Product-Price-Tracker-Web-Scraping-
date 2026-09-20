# How to add, change or remove a feature

The code is organised **by feature**, the same way on both sides:

| | Backend | Frontend |
|---|---|---|
| List of features | `backend/src/modules/index.js` | `frontend/src/features/index.jsx` |
| One feature | `backend/src/modules/<name>/` | `frontend/src/features/<name>/` |

Inside every backend module the files always have the same roles:

```
<name>.routes.js      HTTP only: read the request, call the service, send JSON
<name>.service.js     the rules of the feature (validation, what happens when)
<name>.repository.js  SQL only
index.js              exports { name, router, onStart }
```

Modules don't reach into each other's tables. When one module needs to react to another, it listens
to an **event** (`src/lib/events.js`): `tracked.created`, `check.succeeded`, `check.failed`.

---

## Example 1: remove the alerts feature

1. Backend: delete the `alerts` line in `backend/src/modules/index.js` (and the `modules/alerts` folder).
2. Frontend: delete the `/alerts` line in `frontend/src/features/index.jsx` (and `features/alerts`).

Nothing else changes. Checks still emit `check.succeeded`, and nobody listens. The `alerts` table
stays in the database, unused and harmless.

## Example 2: add email alerts

1. `npm install nodemailer` (or use Resend's HTTP API with plain `fetch`).
2. Add `SMTP_URL` / `ALERT_EMAIL_TO` to `src/config/env.js` and `.env.example`.
3. In `modules/alerts/alerts.service.js`, after `repo.create(...)`, send the email.
   Or make a new module `modules/email-alerts/` that listens to `check.succeeded` and reuses
   `alertsFor()` from `alerts.rules.js`.

## Example 3: add a new alert type ("price went up")

1. New migration `backend/src/db/migrations/004_price_up_alert.sql`:
   ```sql
   ALTER TABLE alerts DROP CONSTRAINT alerts_type_check;
   ALTER TABLE alerts ADD CONSTRAINT alerts_type_check
     CHECK (type IN ('price_drop', 'back_in_stock', 'price_up'));
   ```
   Never edit an old migration. Always add a new file; it runs once, automatically, on the next start.
2. Add a rule in `modules/alerts/alerts.rules.js`.
3. Add an icon in `frontend/src/features/alerts/AlertsPage.jsx`.

## Example 4: add a column to the history (e.g. seller name)

1. Migration: `ALTER TABLE price_snapshots ADD COLUMN seller TEXT;`
2. `scraper/extractPriceBlock.js`: collect the seller text. `scraper/pricePage.js`: put it in `observation`.
3. `modules/checks/checks.repository.js` → `saveSuccess`: insert it.
4. `modules/tracking/tracking.repository.js` → `history`: select it. Show it in `ProductPage.jsx`.

## Example 5: the store changed its HTML

Start in **`backend/src/scraper/selectors.js`**. Every selector, button name and timing value is
there. The check log shows `LAYOUT_CHANGED` when the price block can't be found, and
`npm run scrape:headed -- <id>` lets you watch exactly where it stops.

## Example 6: change how often products are checked

- Default for new products: `DEFAULT_CHECK_INTERVAL_MINUTES` env var.
- Per product: the "Check every" dropdown on the product page (`PATCH /api/tracked/:id`).
- Minimum allowed: `scheduler.minIntervalMinutes` in `src/config/env.js`.
- Retry delay after a failure: `RETRY_FAILED_AFTER_MINUTES` in `modules/checks/checks.service.js`.

## Example 7: add a new page

1. Create `frontend/src/features/<name>/<Name>Page.jsx`.
2. Add `{ path: '/<name>', element: <NamePage />, nav: 'Label' }` to `features/index.jsx`.
3. If it needs data, add a function to `frontend/src/api/client.js`.

## Where to look for…

| I want to change… | File |
|---|---|
| Retry counts / backoff | `scraper/index.js` (page attempts), `scraper/storeApi.js` (HTTP), `lib/retry.js` |
| What counts as valid data | `scraper/validate.js` + CHECK constraints in `002_tracking.sql` |
| Price formats understood | `scraper/parsers/price.js` (+ a test in `tests/parsers.test.js`) |
| "success" vs "retried" rule | `neededRetries()` in `modules/checks/checks.service.js` |
| Search behaviour | `search()` in `modules/catalog/catalog.repository.js` |
| Chart look | `frontend/src/components/PriceChart.jsx` |
