-- Adds support for: multiple photos per product, and color variants where
-- each variant can have its own photo(s). Run once, after schema.sql.

CREATE TABLE IF NOT EXISTS product_variants (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,           -- e.g. "Red", "Rose Gold"
  color_hex   TEXT,                    -- optional swatch color, e.g. '#B5342E'
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_images (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id  INTEGER REFERENCES product_variants(id) ON DELETE CASCADE, -- NULL = general photo, not tied to one variant
  image_data  BYTEA NOT NULL,
  image_mime  TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id, sort_order);

-- Move any photo already stored directly on products into product_images.
INSERT INTO product_images (product_id, image_data, image_mime, sort_order)
SELECT id, image_data, image_mime, 0 FROM products WHERE image_data IS NOT NULL;

ALTER TABLE products DROP COLUMN IF EXISTS image_data;
ALTER TABLE products DROP COLUMN IF EXISTS image_mime;
