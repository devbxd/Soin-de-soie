import { sql } from "../../_lib/db.js";
import { requireAdmin } from "../../_lib/auth.js";

async function handler(req, res) {
  const id = Number(req.query.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  if (req.method === "PUT") {
    const b = req.body || {};
    const [existing] = await sql`SELECT * FROM products WHERE id = ${id}`;
    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const merged = { ...existing, ...b };
    const [row] = await sql`
      UPDATE products SET
        name = ${merged.name},
        category = ${merged.category},
        description = ${merged.description},
        price_cents = ${merged.price_cents},
        discount_type = ${merged.discount_type},
        discount_value = ${merged.discount_value},
        in_stock = ${merged.in_stock},
        is_featured = ${merged.is_featured},
        is_active = ${merged.is_active},
        sort_order = ${merged.sort_order},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    res.status(200).json(row);
    return;
  }

  if (req.method === "DELETE") {
    await sql`UPDATE products SET is_active = false, updated_at = now() WHERE id = ${id}`;
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

export default requireAdmin(handler);
