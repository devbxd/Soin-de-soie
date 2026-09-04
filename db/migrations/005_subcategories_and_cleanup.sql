-- Sub-categories, product.category -> product.category_id (real FK instead
-- of loose text matching), and drop the soft-delete flag (Remove now really
-- deletes, per the client's request).

CREATE TABLE IF NOT EXISTS subcategories (
  id           SERIAL PRIMARY KEY,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL,
  name         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (category_id, slug)
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL;

UPDATE products p SET category_id = c.id FROM categories c WHERE p.category = c.slug AND p.category_id IS NULL;

-- Safe to enforce NOT NULL / drop the old column: no products are missing a
-- matching category_id at this point (verified before running this migration).
ALTER TABLE products ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE products DROP COLUMN IF EXISTS category;
ALTER TABLE products DROP COLUMN IF EXISTS is_active;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON products(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id, sort_order);
