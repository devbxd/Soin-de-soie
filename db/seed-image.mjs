// One-off script: loads the real product photo into the database.
// Run once, after schema.sql + migrations + seed.sql, with DATABASE_URL set:
//   node db/seed-image.mjs

import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL. Set it in your shell or a .env file before running this script.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const file = await readFile(new URL("../assets/img/products/pout-perfection-lipgloss.png", import.meta.url));

const [product] = await sql`SELECT id FROM products WHERE slug = 'pout-perfection-lipgloss'`;
if (!product) {
  console.error("Product 'pout-perfection-lipgloss' not found — run db/seed.sql first.");
  process.exit(1);
}

const existing = await sql`SELECT id FROM product_images WHERE product_id = ${product.id}`;
if (existing.length > 0) {
  console.log("Photo already present for this product, skipping.");
  process.exit(0);
}

await sql`
  INSERT INTO product_images (product_id, variant_id, image_data, image_mime, sort_order)
  VALUES (${product.id}, NULL, ${file}, 'image/png', 0)
`;

console.log("Product photo loaded into the database.");
