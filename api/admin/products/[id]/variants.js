import { sql } from "../../../_lib/db.js";
import { requireAdmin } from "../../../_lib/auth.js";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const productId = Number(req.query.id);
  const { name, color_hex, sort_order } = req.body || {};
  if (!Number.isInteger(productId) || !name) {
    res.status(400).json({ error: "product id and name are required" });
    return;
  }

  const [row] = await sql`
    INSERT INTO product_variants (product_id, name, color_hex, sort_order)
    VALUES (${productId}, ${name}, ${color_hex || null}, ${sort_order || 0})
    RETURNING id, name, color_hex
  `;

  res.status(201).json(row);
}

export default requireAdmin(handler);
