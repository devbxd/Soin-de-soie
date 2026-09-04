import { sql, toPublicProduct, attachVariantsAndImages } from "../../_lib/db.js";
import { requireAdmin } from "../../_lib/auth.js";

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function handler(req, res) {
  if (req.method === "GET") {
    const rows = await sql`SELECT * FROM products ORDER BY category ASC, sort_order ASC, id ASC`;
    const { variantsByProduct, imagesByProduct } = await attachVariantsAndImages(rows);
    res.status(200).json(
      rows.map((row) => ({
        ...toPublicProduct(row, variantsByProduct, imagesByProduct),
        is_active: row.is_active,
        discount_type: row.discount_type,
        discount_value: row.discount_value,
        sort_order: row.sort_order,
      }))
    );
    return;
  }

  if (req.method === "POST") {
    const b = req.body || {};
    if (!b.name || !b.category) {
      res.status(400).json({ error: "name and category are required" });
      return;
    }
    const slug = b.slug ? slugify(b.slug) : slugify(b.name);

    const [row] = await sql`
      INSERT INTO products (slug, name, category, description, price_cents, discount_type, discount_value, in_stock, is_featured, sort_order)
      VALUES (
        ${slug}, ${b.name}, ${b.category}, ${b.description || ""},
        ${b.price_cents || 0}, ${b.discount_type || "none"}, ${b.discount_value || 0},
        ${b.in_stock !== false}, ${!!b.is_featured}, ${b.sort_order || 0}
      )
      RETURNING *
    `;
    res.status(201).json({ ...row, variants: [], images: [] });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

export default requireAdmin(handler);
