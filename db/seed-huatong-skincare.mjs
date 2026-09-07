// One-off script: adds the 6 Huatong hydrating/anti-wrinkle skincare photos
// (client-supplied) as real products in the Skincare category. No price yet —
// the client sets pricing herself in the admin panel. Run once:
//   node db/seed-huatong-skincare.mjs

import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";
import { readFile as readFileP, writeFile as writeFileP } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env loader (mirrors scripts/dev-server.mjs).
const envPath = path.join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const sourceDir = "C:/Users/user/Desktop/soin de soie products photos hydrating and anti-wrinkle skincare";

// Order: routine order agreed with the client — mask, honey essence, eye/fine-line
// essence, the two 100ml lotions/emulsions, then the cream.
const products = [
  {
    file: "Huatong Anti-Wrinkle Moisturizing Mask.jpeg",
    name: "Huatong Anti-Wrinkle Moisturizing Mask",
    description: "An anti-wrinkle sheet mask that deeply hydrates and helps smooth the look of fine lines. Net 28ml.",
  },
  {
    file: "Huatong Firming Essence.jpeg",
    name: "Huatong Firming Essence",
    description: "A nourishing honey and nectar essence that firms and smooths for softer, more supple skin. Net 30ml.",
  },
  {
    file: "Huatong Anti-Wrinkle Soothing Essence.jpeg",
    name: "Huatong Anti-Wrinkle Soothing Essence",
    description: "A soothing, moisturizing essence that visibly lightens the look of fine lines. Net 10ml.",
  },
  {
    file: "Huatong Firming Rejuvenating Essence Water.jpeg",
    name: "Huatong Firming Rejuvenating Essence Water",
    description: "A silky, fast-absorbing essence water that firms and revitalizes skin for a smoother, more radiant complexion. Net 100ml.",
  },
  {
    file: "Huatong Radiant Moisturizing Lotion.jpeg",
    name: "Huatong Radiant Moisturizing Lotion",
    description: "A lightweight, radiance-boosting lotion that deeply hydrates for a dewy, luminous glow. Net 100ml.",
  },
  {
    file: "Huatong Anti-Wrinkle Brightening Cream.jpeg",
    name: "Huatong Anti-Wrinkle Brightening Cream",
    description: "A rich anti-wrinkle cream that brightens and rejuvenates for firmer, more youthful-looking skin.",
  },
];

const [category] = await sql`SELECT id FROM categories WHERE slug = 'skincare'`;
if (!category) {
  console.error("Skincare category not found.");
  process.exit(1);
}

const [{ next }] = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM products WHERE category_id = ${category.id}`;
let sortOrder = next;

const assetsDir = path.join(root, "assets/img/products");

for (const p of products) {
  const existing = await sql`SELECT id FROM products WHERE name = ${p.name}`;
  if (existing.length > 0) {
    console.log(`Skipping "${p.name}" — already exists.`);
    continue;
  }

  const slug = slugify(p.name) + "-" + Math.random().toString(36).slice(2, 6);
  const [row] = await sql`
    INSERT INTO products (slug, name, category_id, subcategory_id, description, price_cents, discount_type, discount_value, in_stock, is_featured, sort_order)
    VALUES (${slug}, ${p.name}, ${category.id}, NULL, ${p.description}, 0, 'none', 0, true, false, ${sortOrder})
    RETURNING id
  `;

  const srcPath = path.join(sourceDir, p.file);
  const buffer = await readFileP(srcPath);

  await sql`
    INSERT INTO product_images (product_id, variant_id, image_data, image_mime, sort_order)
    VALUES (${row.id}, NULL, ${buffer}, 'image/jpeg', 0)
  `;

  // Keep a local copy alongside the existing product photo, for backup/version control.
  const localName = slugify(p.name) + ".jpeg";
  await writeFileP(path.join(assetsDir, localName), buffer);

  console.log(`Added "${p.name}" (id ${row.id}, sort_order ${sortOrder})`);
  sortOrder++;
}

console.log("Done.");
