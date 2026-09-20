/**
 * All configuration lives here. Every other file imports `config` instead of
 * reading process.env directly, so there is exactly one place to see (and change)
 * what the app can be configured with.
 */

// Load backend/.env if it exists (Node >= 20.12 has this built in, no dotenv needed).
try {
  process.loadEnvFile?.(new URL('../../.env', import.meta.url).pathname);
} catch {
  /* no .env file - rely on real environment variables (e.g. on Render) */
}

const bool = (value, fallback) => (value === undefined ? fallback : value === 'true');
const int = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  port: int(process.env.PORT, 4000),
  corsOrigins: (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim()),

  db: {
    url: process.env.DATABASE_URL,
    ssl: bool(process.env.DATABASE_SSL, false),
  },

  scheduler: {
    cronSecret: process.env.CRON_SECRET || '',
    maxChecksPerRun: int(process.env.MAX_CHECKS_PER_RUN, 10),
    defaultIntervalMinutes: int(process.env.DEFAULT_CHECK_INTERVAL_MINUTES, 120),
    minIntervalMinutes: 15,
    // Local development only: a built-in timer that runs due checks every N minutes, so the app
    // works on your laptop without cron-job.org. OFF in production (NODE_ENV=production, set in
    // the Dockerfile) because Render's free server sleeps and would never fire it - there the
    // external cron calls /api/cron/run-due instead. Set LOCAL_SCHEDULER_MINUTES=0 to disable.
    localTimerMinutes: int(process.env.LOCAL_SCHEDULER_MINUTES, process.env.NODE_ENV === 'production' ? 0 : 1),
  },

  store: {
    baseUrl: (process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com').replace(/\/$/, ''),
  },

  scraper: {
    headless: bool(process.env.SCRAPER_HEADLESS, true),
    slowMoMs: int(process.env.SCRAPER_SLOW_MO, 0),
    maxAttempts: int(process.env.SCRAPER_MAX_ATTEMPTS, 3),
    chromiumPath: process.env.CHROMIUM_PATH || undefined,
  },
};

export function assertDatabaseConfigured() {
  if (!config.db.url) {
    throw new Error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.');
  }
}
