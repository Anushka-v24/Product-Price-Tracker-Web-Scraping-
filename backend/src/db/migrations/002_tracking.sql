-- Products the user chose to track, and everything we learn about them.

CREATE TABLE IF NOT EXISTS tracked_products (
  id                      SERIAL PRIMARY KEY,
  store_product_id        INTEGER NOT NULL UNIQUE REFERENCES catalog_products(id),
  check_interval_minutes  INTEGER NOT NULL DEFAULT 120 CHECK (check_interval_minutes >= 15),
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  next_check_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracked_products_due_idx ON tracked_products (next_check_at) WHERE is_active;

-- One row per check attempt, successful or not. This is the "check log".
--   success = worked on the first page attempt
--   retried = worked, but only after one or more retries
--   failed  = gave up; NO price row is written for this run
--   running = in progress (a run stuck here after a restart is marked failed on boot)
CREATE TABLE IF NOT EXISTS check_runs (
  id                  BIGSERIAL PRIMARY KEY,
  tracked_product_id  INTEGER NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  trigger             TEXT NOT NULL CHECK (trigger IN ('schedule', 'manual')),
  status              TEXT NOT NULL CHECK (status IN ('running', 'success', 'retried', 'failed')),
  attempts            INTEGER NOT NULL DEFAULT 0,
  error_code          TEXT,
  error_message       TEXT,
  details             JSONB NOT NULL DEFAULT '{}'::jsonb,   -- per-attempt notes, raw text we parsed, layout revision...
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at         TIMESTAMPTZ,
  duration_ms         INTEGER
);

CREATE INDEX IF NOT EXISTS check_runs_product_idx ON check_runs (tracked_product_id, started_at DESC);
CREATE INDEX IF NOT EXISTS check_runs_started_idx ON check_runs (started_at DESC);

-- Price/stock history. Only written for successful runs, and the CHECK constraints are a
-- last line of defence: the database itself refuses a zero/negative price.
CREATE TABLE IF NOT EXISTS price_snapshots (
  id                  BIGSERIAL PRIMARY KEY,
  tracked_product_id  INTEGER NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  check_run_id        BIGINT NOT NULL UNIQUE REFERENCES check_runs(id) ON DELETE CASCADE,
  price               NUMERIC(12, 2) NOT NULL CHECK (price > 0),
  mrp                 NUMERIC(12, 2) CHECK (mrp > 0),
  currency            TEXT NOT NULL DEFAULT 'INR',
  in_stock            BOOLEAN NOT NULL,
  stock_quantity      INTEGER CHECK (stock_quantity >= 0),
  captured_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_snapshots_product_idx ON price_snapshots (tracked_product_id, captured_at DESC);
