-- Soin de Soie — seed data (run once, after schema.sql, in the Neon SQL editor)
-- Mirrors what's on the static site today. The real product photo is loaded
-- separately by running `node db/seed-image.mjs` locally (see README-DEPLOY.md).

INSERT INTO products (slug, name, category, description, price_cents, in_stock, is_featured, sort_order)
VALUES
  ('pout-perfection-lipgloss', 'Pout Perfection Lipgloss', 'makeup',
   'A dusty rose-mauve gloss with a glassy, non-sticky finish, in a clear glass tube with a rose-gold cap engraved with the Soin de Soie butterfly.',
   0, true, true, 1),

  ('additional-shade', 'Additional Shade', 'makeup', 'Shade and price to be confirmed.', 0, false, false, 2),
  ('complexion-product', 'Complexion Product', 'makeup', 'Product to be confirmed.', 0, false, false, 3),

  ('anti-wrinkle-cream', 'Anti-Wrinkle Cream', 'skincare', 'Name, texture and ingredients to be confirmed.', 0, false, false, 1),
  ('glow-serum', 'Glow Serum', 'skincare', 'Name, texture and ingredients to be confirmed.', 0, false, false, 2),
  ('full-ritual', 'Full Ritual', 'skincare', 'Ritual contents to be confirmed.', 0, false, false, 3),

  ('signature-edition', 'Signature Edition', 'gifts', 'Box contents to be confirmed.', 0, false, false, 1),
  ('discovery-edition', 'Discovery Edition', 'gifts', 'Box contents to be confirmed.', 0, false, false, 2)
ON CONFLICT (slug) DO NOTHING;
