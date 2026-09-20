# Price Tracker — INE Software Engineer Intern Assignment

Track the price and stock of products on the INE demo store (<https://demo.inelabteamdev.com>).
Search a product, start tracking it, and the app checks it automatically every 2 hours,
keeping a price/stock history (chart + table) and an honest log of every check
(**success**, **retried** or **failed**).

| Part | Tech | Hosted on |
|---|---|---|
| Frontend | React 18 + Vite + React Router | Vercel |
| Backend | Node.js 22 + Express + Playwright | Render (Docker, free tier) |
| Database | PostgreSQL | Supabase |
| Scheduler | cron-job.org → `GET /api/cron/run-due` | cron-job.org |

- **Live app:** _add Vercel URL_
- **API:** _add Render URL_ (health check: `/api/health`)
- **Demo video:** _add link_
- **Design note:** [docs/DESIGN.md](docs/DESIGN.md)
- **How to add or remove a feature:** [docs/FEATURES.md](docs/FEATURES.md)

---

## Features

- **Search** the catalog by full or partial name (“copper track”) or SKU (“COP-10195”), then **Track**.
- **Automatic checks** of price + stock every 2 hours (per-product interval, 15 min – 7 days).
- **History** as a step chart (green dot = in stock, red = out of stock) and a table with price changes.
- **Check log**: time, trigger (schedule/manual), result, attempts, duration, error code, and per-attempt details.
- **Check now** button, pause/resume, stop tracking.
- **Bonus:** price-drop and back-in-stock alerts (in-app), multi-product dashboard, layout-change
  detection (`LAYOUT_CHANGED` in the log + warning on the dashboard), per-product check interval,
  GitHub Actions CI (tests + build) with auto-deploy by Render/Vercel.

## Project structure

```
price-tracker/
├── backend/
│   ├── src/
│   │   ├── server.js            start-up: migrate DB → start modules → listen
│   │   ├── app.js               builds Express from the module list
│   │   ├── config/env.js        ALL environment variables, in one place
│   │   ├── db/                  connection pool, migration runner, migrations/*.sql
│   │   ├── lib/                 small shared helpers (retry, errors, logger, events, lock)
│   │   ├── middleware/          CORS, request log, error handler
│   │   ├── modules/             ONE FOLDER PER FEATURE  ← see docs/FEATURES.md
│   │   │   ├── index.js         the list of enabled features
│   │   │   ├── catalog/         local copy of the store catalog + search
│   │   │   ├── tracking/        tracked products, intervals, history
│   │   │   ├── checks/          runs checks, writes the check log + snapshots
│   │   │   ├── scheduler/       endpoint called by cron-job.org
│   │   │   ├── alerts/          optional: price-drop / back-in-stock alerts
│   │   │   └── health/          /api/health
│   │   └── scraper/             everything that talks to the store
│   │       ├── index.js         public API: checkPrices(), crawlCatalog()
│   │       ├── storeApi.js      plain-HTTP JSON client (catalog, product, layout)
│   │       ├── catalogCrawler.js
│   │       ├── pricePage.js     Playwright steps for the price (hover, click, wait, read)
│   │       ├── extractPriceBlock.js   runs in the browser, collects raw text
│   │       ├── selectors.js     every store-specific selector + timing in ONE file
│   │       ├── parsers/         price / stock / text normalisation
│   │       └── validate.js      last gate before saving
│   ├── scripts/                 scrape-once.js (headed mode), sync-catalog.js
│   ├── tests/                   unit + real-browser tests against a mock store
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── features/index.jsx   the list of pages
│       ├── features/<feature>/  one folder per page
│       ├── components/          shared UI (chart, badges, banner)
│       ├── api/client.js        every backend call
│       └── hooks/, utils/
├── docs/                        DESIGN.md, FEATURES.md
├── render.yaml                  Render blueprint
└── .github/workflows/ci.yml
```

## Run it locally

Requirements: Node.js 20.12+ and a PostgreSQL database (a free Supabase project works, or a local Postgres).

```bash
# 1. Backend
cd backend
cp .env.example .env            # then set DATABASE_URL (and DATABASE_SSL=true for Supabase)
npm install
npx playwright install chromium # downloads the browser used for price checks
npm test                        # 31 tests, incl. real-browser tests against a mock store
npm run dev                     # http://localhost:4000 — migrates the DB and syncs the catalog (~1 min)

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env            # VITE_API_URL=http://localhost:4000
npm install
npm run dev                     # http://localhost:5173
```

### Headed mode (watch the scraper work)

```bash
cd backend
npm run scrape:headed -- 458        # opens a visible Chromium, shows each step in a label on the page
npm run scrape:headed -- 458 --simulate-errors   # demo: price service made slow + failing on purpose
npm run scrape -- 458 12 77         # same thing headless, several products
SCRAPER_HEADLESS=false npm run dev  # the whole server uses a visible browser for its checks
```

`458` is the store's product id (the number in `/product/458`). No database is needed for
`npm run scrape`. `SCRAPER_SLOW_MO=300` slows it down further for recordings.

The real store fails at random, so a short recording might not catch a failure.
`--simulate-errors` (demo only, never used by the server) makes every price request of the first
attempt slow and 503, so the store page gives up and **our page-level retry** starts a fresh page;
on the second attempt the first request is very slow and fails, the page retries, and the real
price is read. See `backend/src/scraper/simulateErrors.js`.

## Environment variables

**Backend** (`backend/.env`, or Render → Environment)

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `DATABASE_URL` | yes | – | Postgres connection string (Supabase → Connect → **Session pooler**) |
| `DATABASE_SSL` | – | `false` | `true` for Supabase / any hosted Postgres |
| `CRON_SECRET` | yes (prod) | – | Shared secret the cron service must send |
| `CORS_ORIGIN` | – | `*` | Frontend URL(s), comma-separated, e.g. `https://your-app.vercel.app` |
| `PORT` | – | `4000` | Render sets this automatically |
| `DEFAULT_CHECK_INTERVAL_MINUTES` | – | `120` | Interval for newly tracked products |
| `MAX_CHECKS_PER_RUN` | – | `10` | Max products checked per cron call (keeps memory/time bounded) |
| `STORE_BASE_URL` | – | demo store | Store to scrape |
| `SCRAPER_HEADLESS` | – | `true` | `false` = visible browser (headed mode, needs a screen) |
| `SCRAPER_SLOW_MO` | – | `0` | ms between browser actions (for demos) |
| `SCRAPER_MAX_ATTEMPTS` | – | `3` | Full page-level attempts per check |
| `CHROMIUM_PATH` | – | – | Use a specific Chromium binary |

**Frontend** (`frontend/.env`, or Vercel → Settings → Environment Variables)

| Variable | Meaning |
|---|---|
| `VITE_API_URL` | Backend URL, e.g. `https://price-tracker-api.onrender.com` |

## Deploy

1. **Supabase** – create a project, copy the *Session pooler* connection string (port 5432).
   Tables are created automatically on first start (`backend/src/db/migrations`).
2. **Render** – New → Blueprint → select this repo (uses `render.yaml`), or New → Web Service →
   *Docker*, root directory `backend`. Set `DATABASE_URL`, `DATABASE_SSL=true`, `CRON_SECRET`, `CORS_ORIGIN`.
3. **Vercel** – import the repo, root directory `frontend`, framework *Vite*, set `VITE_API_URL`.
   `vercel.json` makes page refreshes on `/products/3` work.
4. **cron-job.org** – see below.

Render and Vercel redeploy automatically on every push to `main`; GitHub Actions runs the tests and build.

## Scheduling

Render's free server sleeps after ~15 idle minutes, and a sleeping server runs no timers, so there is
**no timer inside the app**. Instead cron-job.org calls:

```
GET https://<your-render-app>.onrender.com/api/cron/run-due
Header: x-cron-secret: <CRON_SECRET>          (or append ?key=<CRON_SECRET> to the URL)
Schedule: every 15 minutes
```

- The call wakes the server, claims the products whose `next_check_at` is due, starts checking them
  in the background and answers **202** straight away (cron-job.org times out after 30 s).
- Each product has its own interval (**default 120 min = every 2 hours**), so calling every
  15 minutes simply means "check whatever is due". A 5-minute grace window absorbs timing drift.
  If you prefer, schedule it exactly every 2 hours instead; it works the same.
- A failed check is retried after 30 minutes instead of waiting a full interval.
- Claimed products get a 20-minute lease, so overlapping cron calls never check a product twice.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/catalog/search?q=` | Search the synced catalog |
| GET | `/api/catalog/status` · POST `/api/catalog/sync` | Catalog size / re-sync |
| GET / POST | `/api/tracked` | List / start tracking `{ storeProductId }` |
| GET / PATCH / DELETE | `/api/tracked/:id` | Details / `{ checkIntervalMinutes, isActive }` / stop |
| GET | `/api/tracked/:id/history` | Price + stock snapshots |
| POST | `/api/tracked/:id/check` | Check now |
| GET | `/api/checks?trackedId=` · `/api/checks/:id` | Check log |
| GET/POST | `/api/cron/run-due` | Scheduler entry point (needs secret) |
| GET | `/api/scheduler/status` | Last cron call, upcoming checks |
| GET | `/api/alerts` · POST `/api/alerts/:id/read` · `/api/alerts/read-all` | Alerts |
| GET | `/api/health` | Health check |
