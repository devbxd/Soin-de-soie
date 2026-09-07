// One-off script, batch 3:
// - Renames the existing "Pout Perfection Lipgloss" product to "Glisten Tint
//   Lip Gloss" (client-requested rename/typo fix).
// - Adds "Pout Perfection Matte Lipstick" with 12 shade variants from the
//   client's MATTE LIQUID LIPSTICK SHADES folder (a separate product line
//   from the gloss — not shades of the same product).
// - Adds "The Silk Essentials Gift Set" to Gift Sets, using the client's
//   promo graphic as its photo.
// Run once: node db/seed-batch3-matte-and-giftset.mjs

import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";
import { readFile as readFileP, writeFile as writeFileP } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
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
function mimeFor(file) {
  return file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

const assetsDir = path.join(root, "assets/img/products");
const desktop = "C:/Users/user/Desktop";
const matteDir = `${desktop}/MATTE LIQUID LIPSTICK SHADES`;

// ---------- 1. Rename existing gloss product ----------
const oldName = "Pout Perfection Lipgloss";
const newName = "Glisten Tint Lip Gloss";
const existingGloss = await sql`SELECT id, name FROM products WHERE name = ${oldName}`;
if (existingGloss.length > 0) {
  await sql`UPDATE products SET name = ${newName}, updated_at = now() WHERE id = ${existingGloss[0].id}`;
  console.log(`Renamed "${oldName}" -> "${newName}" (id ${existingGloss[0].id})`);
} else {
  const already = await sql`SELECT id FROM products WHERE name = ${newName}`;
  if (already.length > 0) console.log(`"${newName}" already exists (id ${already[0].id}), nothing to rename.`);
  else console.log(`WARNING: could not find "${oldName}" to rename — check product names manually.`);
}

// ---------- 2. New product: Pout Perfection Matte Lipstick, 12 variants ----------
const matteLipstickName = "Pout Perfection Matte Lipstick";
const matteExists = await sql`SELECT id FROM products WHERE name = ${matteLipstickName}`;
if (matteExists.length > 0) {
  console.log(`Skipping "${matteLipstickName}" — already exists.`);
} else {
  const [makeupCat] = await sql`SELECT id FROM categories WHERE slug = 'makeup'`;
  const [{ next: makeupSort }] = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM products WHERE category_id = ${makeupCat.id}`;

  const description = "A full-coverage matte liquid lipstick with a lightweight, non-drying finish. Available in 12 shades.";
  const slug = slugify(matteLipstickName) + "-" + Math.random().toString(36).slice(2, 6);
  const [productRow] = await sql`
    INSERT INTO products (slug, name, category_id, subcategory_id, description, price_cents, discount_type, discount_value, in_stock, is_featured, sort_order)
    VALUES (${slug}, ${matteLipstickName}, ${makeupCat.id}, NULL, ${description}, 0, 'none', 0, true, false, ${makeupSort})
    RETURNING id
  `;

  const variants = [
    { file: "matte liquid lipstick 1002.jpg", name: "Terracotta Nude", color_hex: "#B87068" },
    { file: "matte liquid lipstick 1003.jpg", name: "Rust", color_hex: "#A04838" },
    { file: "matte liquid lipstick 1009.jpg", name: "Red", color_hex: "#982820" },
    { file: "Matte liquid lipstick-1010.jpg", name: "Chestnut", color_hex: "#782820" },
    { file: "matte liquid lipstick 1013.jpg", name: "Dusty Rose", color_hex: "#B06068" },
    { file: "matte liquid lipstick 2001.jpg", name: "Brick Red", color_hex: "#B85858" },
    { file: "matte liquid lipstick 2002.jpg", name: "Fuchsia", color_hex: "#E81848" },
    { file: "matte liquid lipstick 2004.jpg", name: "Berry", color_hex: "#982848" },
    { file: "Matte liquid lipstick-3001.jpg", name: "Mauve Nude", color_hex: "#B07068" },
    { file: "Matte liquid lipstick-3003.jpg", name: "True Red", color_hex: "#A80010" },
    { file: "matte liquid lipstick 5002.jpg", name: "Hot Pink", color_hex: "#D86088" },
    { file: "Matte liquid lipstick-6005.jpg", name: "Chocolate Brown", color_hex: "#905848" },
  ];

  let vSort = 0;
  for (const v of variants) {
    const filePath = path.join(matteDir, v.file);
    const buffer = await readFileP(filePath);
    const mime = mimeFor(v.file);

    const [variantRow] = await sql`
      INSERT INTO product_variants (product_id, name, color_hex, sort_order)
      VALUES (${productRow.id}, ${v.name}, ${v.color_hex}, ${vSort})
      RETURNING id
    `;
    await sql`
      INSERT INTO product_images (product_id, variant_id, image_data, image_mime, sort_order)
      VALUES (${productRow.id}, ${variantRow.id}, ${buffer}, ${mime}, 0)
    `;
    if (vSort === 0) {
      await sql`
        INSERT INTO product_images (product_id, variant_id, image_data, image_mime, sort_order)
        VALUES (${productRow.id}, NULL, ${buffer}, ${mime}, 0)
      `;
    }
    await writeFileP(path.join(assetsDir, `${slugify(matteLipstickName)}-${slugify(v.name)}${path.extname(v.file).toLowerCase()}`), buffer);
    vSort++;
  }
  console.log(`Added "${matteLipstickName}" with ${variants.length} variants (id ${productRow.id}, sort_order ${makeupSort})`);
}

// ---------- 3. Gift Sets: The Silk Essentials Gift Set ----------
const giftName = "The Silk Essentials Gift Set";
const giftExists = await sql`SELECT id FROM products WHERE name = ${giftName}`;
if (giftExists.length > 0) {
  console.log(`Skipping "${giftName}" — already exists.`);
} else {
  const [giftsCat] = await sql`SELECT id FROM categories WHERE slug = 'gifts'`;
  const [{ next: giftSort }] = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM products WHERE category_id = ${giftsCat.id}`;

  const description = "A silk scrunchie set, silk pillowcase, and silk eye mask, beautifully boxed for effortless gifting — or a treat for yourself.";
  const slug = slugify(giftName) + "-" + Math.random().toString(36).slice(2, 6);
  const [productRow] = await sql`
    INSERT INTO products (slug, name, category_id, subcategory_id, description, price_cents, discount_type, discount_value, in_stock, is_featured, sort_order)
    VALUES (${slug}, ${giftName}, ${giftsCat.id}, NULL, ${description}, 0, 'none', 0, true, false, ${giftSort})
    RETURNING id
  `;

  const imgPath = `${desktop}/WhatsApp Image 2026-09-07 at 16.00.23.jpeg`;
  const buffer = await readFileP(imgPath);
  await sql`
    INSERT INTO product_images (product_id, variant_id, image_data, image_mime, sort_order)
    VALUES (${productRow.id}, NULL, ${buffer}, 'image/jpeg', 0)
  `;
  await writeFileP(path.join(assetsDir, `${slugify(giftName)}.jpeg`), buffer);
  console.log(`Added "${giftName}" (id ${productRow.id}, sort_order ${giftSort})`);
}

console.log("Done.");
