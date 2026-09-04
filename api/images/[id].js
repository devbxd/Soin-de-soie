import { sql } from "../_lib/db.js";

export default async function handler(req, res) {
  const id = Number(req.query.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid image id" });
    return;
  }

  try {
    const rows = await sql`
      SELECT image_data, image_mime FROM product_images WHERE id = ${id}
    `;
    const row = rows[0];
    if (!row) {
      res.status(404).end();
      return;
    }

    res.setHeader("Content-Type", row.image_mime || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.status(200).send(Buffer.from(row.image_data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load image" });
  }
}
