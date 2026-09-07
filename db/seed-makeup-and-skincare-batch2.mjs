// One-off script: adds the second batch of client-supplied product photos —
// 7 more skincare items (generic OEM brightening line) and 9 makeup products
// (several with real "Soin de Soie" branded packaging in multiple color
// shades, modeled as product_variants). No prices — the client sets those
// herself in the admin panel. Run once:
//   node db/seed-makeup-and-skincare-batch2.mjs

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

const desktop = "C:/Users/user/Desktop";
const assetsDir = path.join(root, "assets/img/products");

// ---------- Skincare: simple, no variants ----------
const skincareDir = `${desktop}/Soin de Soie products photos advanced brightening skincare`;
const skincareSimple = [
  {
    file: "10% Vitamin C serum.jpeg",
    name: "10% Vitamin C Brightening Serum",
    description: "A 10% vitamin C brightening serum that helps even tone and boost radiance. Net 30ml.",
  },
  {
    file: "3x Acid Anti Acne repairing and moisturizing cream.jpeg",
    name: "3X Acid Anti-Acne Repairing and Moisturizing Cream",
    description: "A gentle triple-acid cream that helps repair blemish-prone skin while moisturizing. Net 30g.",
  },
  {
    file: "5 in 1 advanced brightening serum (night time use).jpeg",
    name: "5-in-1 Advanced Brightening Serum (Night Time Use)",
    description: "A 5-in-1 overnight serum formulated to brighten and even out skin tone while you sleep. Net 30ml.",
  },
  {
    file: "Alpha Arbutin brightening and nurishing cream + UV protection.jpeg",
    name: "Alpha Arbutin Brightening and Nourishing Cream + UV Protection",
    description: "An Alpha Arbutin cream that brightens and nourishes the skin, with added UV protection.",
  },
  {
    file: "MSH Niacinamide Serum.jpeg",
    name: "10% MSH Niacinamide Brightening Glow Serum",
    description: "A 10% niacinamide serum that brightens and revives skin's natural glow. Net 30ml.",
  },
  {
    file: "Salmon DNA and Centella Asiatica Serum.jpeg",
    name: "Salmon DNA & Centella Asiatica Brightening Glow Serum",
    description: "A soothing glow serum with salmon DNA and centella asiatica to brighten and calm the skin. Net 30ml.",
  },
  {
    file: "brightening and spot repairing cream.jpeg",
    name: "Brightening and Spot-Repairing Mask Cream",
    description: "A brightening mask cream that helps repair the look of dark spots overnight. Net 100g.",
  },
];

// ---------- Makeup: simple, no variants ----------
const picsDir = `${desktop}/soin de soie products pics`;
const makeupSimple = [
  {
    name: "Mega Volume Mascara",
    description: "A mega-volume mascara that builds bold, clump-free lashes.",
    images: [{ file: `${picsDir}/mascara.jpg` }],
  },
  {
    name: "Intense Black Liquid Eyeliner",
    description: "A precision felt-tip liquid eyeliner in intense black for a crisp, long-wearing line.",
    images: [{ file: `${picsDir}/eyeliner.jpg` }, { file: `${picsDir}/eyeliner1.jpg` }],
  },
];

// ---------- Makeup: variant products ----------
const blushDir = `${desktop}/Fwd soin de soie liquid blush photos`;
const lipglossDir = `${desktop}/Lipgloss soin de soie`;
const linerDir = `${desktop}/LIP LINER soin de soie`;
const shimmerDir = `${desktop}/liquid shimmer and highlighter soin de soie products photos`;

const makeupVariants = [
  {
    name: "Pout Perfection Lipgloss",
    description: "A glassy, non-sticky lipgloss in a clear glass tube with a rose-gold cap engraved with the Soin de Soie butterfly. Available in 5 shades.",
    is_featured: true,
    variants: [
      { file: `${lipglossDir}/G01.png`, name: "Terracotta", color_hex: "#C05858" },
      { file: `${lipglossDir}/G03.png`, name: "Berry Wine", color_hex: "#781828" },
      { file: `${lipglossDir}/G04.png`, name: "Pink Nude", color_hex: "#C87070" },
      { file: `${lipglossDir}/G08.png`, name: "Classic Red", color_hex: "#780808" },
      { file: `${lipglossDir}/G11.png`, name: "Rose Mauve", color_hex: "#A05868" },
    ],
  },
  {
    name: "Plush High Shine Lip Oil",
    description: "A nourishing, high-shine lip oil that glides on sheer color with a plush, non-sticky finish. Available in 4 shades.",
    variants: [
      { file: `${picsDir}/High-shine-lip-oil-03.jpg`, name: "Soft Pink", color_hex: "#E888A0" },
      { file: `${picsDir}/High-shine-lip-oil-04.jpg`, name: "Rose Nude", color_hex: "#D08888" },
      { file: `${picsDir}/High-shine-lip-oil-05.jpg`, name: "Hot Pink", color_hex: "#E81858" },
      { file: `${picsDir}/High-shine-lip-oil-06.jpg`, name: "Coral Red", color_hex: "#E04040" },
    ],
  },
  {
    name: "Soin de Soie Lip Liner",
    description: "A smooth, long-wearing lip liner that defines and fills for a fuller-looking pout. Available in 8 shades.",
    variants: [
      { file: `${linerDir}/1002.jpg`, name: "Terracotta Nude", color_hex: "#B87068" },
      { file: `${linerDir}/1009.jpg`, name: "Red", color_hex: "#982820" },
      { file: `${linerDir}/1012.jpg`, name: "Pink Mauve", color_hex: "#C88098" },
      { file: `${linerDir}/2004.jpg`, name: "Berry", color_hex: "#982848" },
      { file: `${linerDir}/3006.jpg`, name: "True Red", color_hex: "#A82028" },
      { file: `${linerDir}/5001.jpg`, name: "Baby Pink", color_hex: "#E090B0" },
      { file: `${linerDir}/5002.jpg`, name: "Hot Pink", color_hex: "#D86088" },
      { file: `${linerDir}/6004.jpg`, name: "Chocolate Brown", color_hex: "#885850" },
    ],
  },
  {
    name: "Glimmer Charm Liquid Blush",
    description: "A weightless liquid blush that blends into a soft, glimmering flush. Available in 5 shades.",
    variants: [
      { file: `${blushDir}/LB04.jpg`, name: "Soft Pink", color_hex: "#E89098" },
      { file: `${blushDir}/LB06.jpg`, name: "Coral Pink", color_hex: "#F08080" },
      { file: `${blushDir}/LB 07.png`, name: "Rose Berry", color_hex: "#D06888" },
      { file: `${blushDir}/LB 09.png`, name: "Coral Red", color_hex: "#F84840" },
      { file: `${blushDir}/LB 11.png`, name: "Terracotta", color_hex: "#D06860" },
    ],
  },
  {
    name: "Cushion BB Cream",
    description: "A lightweight, hydrating cushion BB cream with buildable coverage for a natural finish. Available in 2 shades.",
    variants: [
      { file: `${skincareDir}/Cushion BB Cream (ivory white).jpeg`, name: "Ivory White", color_hex: "#F2E0C9" },
      { file: `${skincareDir}/Cushion BB Cream (natural skin).jpeg`, name: "Natural Skin", color_hex: "#E0B88E" },
    ],
  },
  {
    name: "Natural Camouflage Liquid Concealer",
    description: "A natural-finish liquid concealer that camouflages imperfections without creasing. Available in 3 shades.",
    variants: [
      { file: `${picsDir}/Concealer-16.jpg`, name: "Fair", color_hex: "#F0C898" },
      { file: `${picsDir}/Concealer-21.jpg`, name: "Light", color_hex: "#D8B890" },
      { file: `${picsDir}/Concealer-32.jpg`, name: "Tan", color_hex: "#D0A880" },
    ],
  },
  {
    name: "Luminance Liquid Illuminator & Shimmer",
    description: "A liquid illuminator that melts into skin for a soft-focus, luminous glow. Available in 3 shades.",
    variants: [
      { file: `${shimmerDir}/Luminance Liquid Illuminator & Shimmer H01.jpeg`, name: "Pink Shimmer", color_hex: "#E0C8D8" },
      { file: `${shimmerDir}/Luminance Liquid Illuminator & Shimmer H02.png`, name: "Rose Gold", color_hex: "#D8A888" },
      { file: `${shimmerDir}/Luminance Liquid Illuminator & Shimmer H04.jpeg`, name: "Bronze", color_hex: "#9C6840" },
    ],
  },
];

function mimeFor(file) {
  return file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

async function nextSortOrder(categoryId) {
  const [{ next }] = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM products WHERE category_id = ${categoryId}`;
  return next;
}

async function insertSimpleProduct(categoryId, name, description, images, sortOrder) {
  const existing = await sql`SELECT id FROM products WHERE name = ${name}`;
  if (existing.length > 0) {
    console.log(`Skipping "${name}" — already exists.`);
    return false;
  }
  const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 6);
  const [row] = await sql`
    INSERT INTO products (slug, name, category_id, subcategory_id, description, price_cents, discount_type, discount_value, in_stock, is_featured, sort_order)
    VALUES (${slug}, ${name}, ${categoryId}, NULL, ${description}, 0, 'none', 0, true, false, ${sortOrder})
    RETURNING id
  `;
  let i = 0;
  for (const img of images) {
    const buffer = await readFileP(img.file);
    await sql`
      INSERT INTO product_images (product_id, variant_id, image_data, image_mime, sort_order)
      VALUES (${row.id}, NULL, ${buffer}, ${mimeFor(img.file)}, ${i})
    `;
    const localName = `${slugify(name)}${images.length > 1 ? "-" + (i + 1) : ""}${path.extname(img.file).toLowerCase()}`;
    await writeFileP(path.join(assetsDir, localName), buffer);
    i++;
  }
  console.log(`Added "${name}" (id ${row.id}, sort_order ${sortOrder})`);
  return true;
}

async function insertVariantProduct(categoryId, product, sortOrder) {
  const existing = await sql`SELECT id FROM products WHERE name = ${product.name}`;
  if (existing.length > 0) {
    console.log(`Skipping "${product.name}" — already exists.`);
    return false;
  }
  const slug = slugify(product.name) + "-" + Math.random().toString(36).slice(2, 6);
  const [row] = await sql`
    INSERT INTO products (slug, name, category_id, subcategory_id, description, price_cents, discount_type, discount_value, in_stock, is_featured, sort_order)
    VALUES (${slug}, ${product.name}, ${categoryId}, NULL, ${product.description}, 0, 'none', 0, true, ${!!product.is_featured}, ${sortOrder})
    RETURNING id
  `;

  let vSort = 0;
  for (const v of product.variants) {
    const [variantRow] = await sql`
      INSERT INTO product_variants (product_id, name, color_hex, sort_order)
      VALUES (${row.id}, ${v.name}, ${v.color_hex}, ${vSort})
      RETURNING id
    `;
    const buffer = await readFileP(v.file);
    const mime = mimeFor(v.file);

    await sql`
      INSERT INTO product_images (product_id, variant_id, image_data, image_mime, sort_order)
      VALUES (${row.id}, ${variantRow.id}, ${buffer}, ${mime}, 0)
    `;
    // First variant's photo doubles as the general (no-variant-selected) photo,
    // so the card/detail page shows something before a swatch is picked.
    if (vSort === 0) {
      await sql`
        INSERT INTO product_images (product_id, variant_id, image_data, image_mime, sort_order)
        VALUES (${row.id}, NULL, ${buffer}, ${mime}, 0)
      `;
    }

    const localName = `${slugify(product.name)}-${slugify(v.name)}${path.extname(v.file).toLowerCase()}`;
    await writeFileP(path.join(assetsDir, localName), buffer);

    vSort++;
  }
  console.log(`Added "${product.name}" with ${product.variants.length} variants (id ${row.id}, sort_order ${sortOrder})`);
  return true;
}

const [skincareCat] = await sql`SELECT id FROM categories WHERE slug = 'skincare'`;
const [makeupCat] = await sql`SELECT id FROM categories WHERE slug = 'makeup'`;
if (!skincareCat || !makeupCat) {
  console.error("Category not found.");
  process.exit(1);
}

let sortOrder = await nextSortOrder(skincareCat.id);
for (const p of skincareSimple) {
  const added = await insertSimpleProduct(skincareCat.id, p.name, p.description, [{ file: path.join(skincareDir, p.file) }], sortOrder);
  if (added) sortOrder++;
}

sortOrder = await nextSortOrder(makeupCat.id);
for (const p of makeupVariants) {
  const added = await insertVariantProduct(makeupCat.id, p, sortOrder);
  if (added) sortOrder++;
}
for (const p of makeupSimple) {
  const added = await insertSimpleProduct(makeupCat.id, p.name, p.description, p.images, sortOrder);
  if (added) sortOrder++;
}

console.log("Done.");
