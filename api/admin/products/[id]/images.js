import { sql } from "../../../_lib/db.js";
import { requireAdmin } from "../../../_lib/auth.js";

// Accepts a base64-encoded photo (no multipart parsing needed): the admin
// panel reads the chosen file with FileReader and posts { data_base64, mime, variant_id? }.
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const productId = Number(req.query.id);
  const { data_base64, mime, variant_id, sort_order } = req.body || {};
  if (!Number.isInteger(productId) || !data_base64 || !mime) {
    res.status(400).json({ error: "product id, data_base64 and mime are required" });
    return;
  }

  const buffer = Buffer.from(data_base64, "base64");
  const variantId = variant_id ? Number(variant_id) : null;

  const [row] = await sql`
    INSERT INTO product_images (product_id, variant_id, image_data, image_mime, sort_order)
    VALUES (${productId}, ${variantId}, ${buffer}, ${mime}, ${sort_order || 0})
    RETURNING id, variant_id
  `;

  res.status(201).json({ id: row.id, variant_id: row.variant_id, url: `/api/images/${row.id}` });
}

export default requireAdmin(handler);
