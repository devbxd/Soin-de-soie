-- Lets the admin create her own categories instead of being stuck with the
-- three hardcoded ones (skincare/makeup/gifts).

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO categories (slug, name, sort_order) VALUES
  ('skincare', 'Skincare', 1),
  ('makeup', 'Makeup', 2),
  ('gifts', 'Gift Sets', 3)
ON CONFLICT (slug) DO NOTHING;

-- products.category was locked to those 3 values via a CHECK constraint —
-- drop it (whatever Postgres auto-named it) so any category slug works.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'products'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%category%'
  LOOP
    EXECUTE 'ALTER TABLE products DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;
