import { sql } from "../../_lib/db.js";
import { requireAdmin } from "../../_lib/auth.js";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { status } = req.query;
  const orders = status
    ? await sql`SELECT * FROM orders WHERE status = ${status} ORDER BY created_at DESC`
    : await sql`SELECT * FROM orders ORDER BY created_at DESC`;

  if (orders.length === 0) {
    res.status(200).json([]);
    return;
  }

  const ids = orders.map((o) => o.id);
  const items = await sql`SELECT * FROM order_items WHERE order_id = ANY(${ids}) ORDER BY id ASC`;
  const itemsByOrder = new Map();
  for (const item of items) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push({
      product_name: item.product_name,
      unit_price_cents: item.unit_price_cents,
      quantity: item.quantity,
      line_total_cents: item.line_total_cents,
    });
  }

  res.status(200).json(orders.map((o) => ({ ...o, items: itemsByOrder.get(o.id) || [] })));
}

export default requireAdmin(handler);
