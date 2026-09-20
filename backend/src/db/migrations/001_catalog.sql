-- Local copy of the store's catalog (1000 products). The store has no search API,
-- so we sync the catalog into our DB and search it here.
CREATE TABLE IF NOT EXISTS catalog_products (
  id          INTEGER PRIMARY KEY,           -- the store's own product id (used in /product/:id)
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  brand       TEXT,
  category    TEXT,
  sku         TEXT NOT NULL,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_products_name_idx ON catalog_products (lower(name));
CREATE INDEX IF NOT EXISTS catalog_products_sku_idx  ON catalog_products (lower(sku));
