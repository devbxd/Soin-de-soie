import { sql } from "../../_lib/db.js";
import { requireAdmin } from "../../_lib/auth.js";

async function handler(req, res) {
  if (req.method !== "DELETE") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const id = Number(req.query.id);
  await sql`DELETE FROM product_images WHERE id = ${id}`;
  res.status(200).json({ ok: true });
}

export default requireAdmin(handler);
