-- Optional feature: in-app alerts for price drops and back-in-stock events.
-- (Deleting the alerts module leaves this table unused but harmless.)
CREATE TABLE IF NOT EXISTS alerts (
  id                  BIGSERIAL PRIMARY KEY,
  tracked_product_id  INTEGER NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  type                TEXT NOT NULL CHECK (type IN ('price_drop', 'back_in_stock')),
  message             TEXT NOT NULL,
  old_value           NUMERIC(12, 2),
  new_value           NUMERIC(12, 2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS alerts_created_idx ON alerts (created_at DESC);
