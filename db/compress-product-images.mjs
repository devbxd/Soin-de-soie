// One-off maintenance script: the client-supplied product photos were
// uploaded at full camera resolution (some over 1MB each, 53 images /
// ~25MB total), which made switching color swatches feel slow — every
// click fetched a fresh multi-MB image from /api/images/:id. This
// resizes every product_images row down to a sensible web size and
// re-encodes as JPEG, in place. Run once:
//   node db/compress-product-images.mjs

import { neon } from "@neondatabase/serverless";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { readFileSync, existsSync } from "node:fs";
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
const MAX_EDGE = 900;
const QUALITY = 82;

const rows = await sql`SELECT id, image_data, image_mime, length(image_data) AS bytes FROM product_images ORDER BY id`;
console.log(`Processing ${rows.length} images...`);

let totalBefore = 0;
let totalAfter = 0;

for (const row of rows) {
  totalBefore += row.bytes;
  const img = await loadImage(row.image_data);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  // Flatten onto white first — some source PNGs may carry alpha, and JPEG has none.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const buffer = canvas.toBuffer("image/jpeg", QUALITY);

  if (buffer.length >= row.bytes) {
    console.log(`  #${row.id}: already optimal (${(row.bytes / 1024).toFixed(0)}KB), skipping`);
    totalAfter += row.bytes;
    continue;
  }

  await sql`UPDATE product_images SET image_data = ${buffer}, image_mime = 'image/jpeg' WHERE id = ${row.id}`;
  totalAfter += buffer.length;
  console.log(`  #${row.id}: ${(row.bytes / 1024).toFixed(0)}KB -> ${(buffer.length / 1024).toFixed(0)}KB (${w}x${h})`);
}

console.log(`\nTotal: ${(totalBefore / 1024 / 1024).toFixed(1)}MB -> ${(totalAfter / 1024 / 1024).toFixed(1)}MB`);
