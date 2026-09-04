-- Soin de Soie — database schema (run once in the Neon SQL editor)

CREATE TABLE IF NOT EXISTS products (
  id             SERIAL PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL CHECK (category IN ('skincare','makeup','gifts')),
  description    TEXT NOT NULL DEFAULT '',
  price_cents    INTEGER NOT NULL DEFAULT 0,
  discount_type  TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none','percent','fixed')),
  discount_value INTEGER NOT NULL DEFAULT 0,
  image_data     BYTEA,
  image_mime     TEXT,
  in_stock       BOOLEAN NOT NULL DEFAULT true,
  is_featured    BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  channel         TEXT NOT NULL CHECK (channel IN ('website','whatsapp')),
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  address_text    TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  subtotal_cents  INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','confirmed','fulfilled','cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id                SERIAL PRIMARY KEY,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name      TEXT NOT NULL,
  unit_price_cents  INTEGER NOT NULL,
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
