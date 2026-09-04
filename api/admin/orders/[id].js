import { sql } from "../../_lib/db.js";
import { requireAdmin } from "../../_lib/auth.js";

const VALID_STATUSES = ["new", "confirmed", "fulfilled", "cancelled"];

async function handler(req, res) {
  if (req.method !== "PUT") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const id = Number(req.query.id);
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const [row] = await sql`UPDATE orders SET status = ${status} WHERE id = ${id} RETURNING *`;
  res.status(200).json(row);
}

export default requireAdmin(handler);
