// Consolidated admin API — every /api/admin/* route is handled here as one
// serverless function (Vercel's Hobby plan caps the number of functions per
// deployment, and the earlier one-file-per-route layout exceeded it).
import { sql, toPublicProduct, attachVariantsAndImages } from "../_lib/db.js";
import { verifyPassword, createSessionCookie, clearSessionCookie, isAuthenticated } from "../_lib/auth.js";

const STATUS_OPTIONS = ["new", "confirmed", "fulfilled", "cancelled"];

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default async function handler(req, res) {
  const path = Array.isArray(req.query.path) ? req.query.path : req.query.path ? [req.query.path] : [];
  const [resource, id, sub] = path;

  // ---------- public auth endpoints ----------
  if (resource === "login" && req.method === "POST") {
    const { password } = req.body || {};
    if (!password || !verifyPassword(password)) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    res.setHeader("Set-Cookie", createSessionCookie());
    res.status(200).json({ authenticated: true });
    return;
  }
  if (resource === "logout") {
    res.setHeader("Set-Cookie", clearSessionCookie());
    res.status(200).json({ authenticated: false });
    return;
  }
  if (resource === "session" && req.method === "GET") {
    res.status(200).json({ authenticated: isAuthenticated(req) });
    return;
  }

  // ---------- everything else requires an admin session ----------
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    // ---------- products ----------
    if (resource === "products" && !id) {
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
    }

    if (resource === "products" && id && !sub) {
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
            name = ${merged.name}, category = ${merged.category}, description = ${merged.description},
            price_cents = ${merged.price_cents}, discount_type = ${merged.discount_type}, discount_value = ${merged.discount_value},
            in_stock = ${merged.in_stock}, is_featured = ${merged.is_featured}, is_active = ${merged.is_active},
            sort_order = ${merged.sort_order}, updated_at = now()
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
    }

    if (resource === "products" && id && sub === "images" && req.method === "POST") {
      const { data_base64, mime, variant_id, sort_order } = req.body || {};
      if (!data_base64 || !mime) {
        res.status(400).json({ error: "data_base64 and mime are required" });
        return;
      }
      const buffer = Buffer.from(data_base64, "base64");
      const [row] = await sql`
        INSERT INTO product_images (product_id, variant_id, image_data, image_mime, sort_order)
        VALUES (${Number(id)}, ${variant_id ? Number(variant_id) : null}, ${buffer}, ${mime}, ${sort_order || 0})
        RETURNING id, variant_id
      `;
      res.status(201).json({ id: row.id, variant_id: row.variant_id, url: `/api/images/${row.id}` });
      return;
    }

    if (resource === "products" && id && sub === "variants" && req.method === "POST") {
      const { name, color_hex, sort_order } = req.body || {};
      if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      const [row] = await sql`
        INSERT INTO product_variants (product_id, name, color_hex, sort_order)
        VALUES (${Number(id)}, ${name}, ${color_hex || null}, ${sort_order || 0})
        RETURNING id, name, color_hex
      `;
      res.status(201).json(row);
      return;
    }

    // ---------- categories ----------
    if (resource === "categories" && !id) {
      if (req.method === "GET") {
        const rows = await sql`SELECT * FROM categories ORDER BY sort_order ASC, id ASC`;
        res.status(200).json(rows);
        return;
      }
      if (req.method === "POST") {
        const { name } = req.body || {};
        if (!name || !name.trim()) {
          res.status(400).json({ error: "name is required" });
          return;
        }
        const slug = slugify(name);
        const [{ next }] = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM categories`;
        const [row] = await sql`
          INSERT INTO categories (slug, name, sort_order)
          VALUES (${slug}, ${name.trim()}, ${next})
          ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
          RETURNING *
        `;
        res.status(201).json(row);
        return;
      }
    }

    // ---------- images ----------
    if (resource === "images" && id && req.method === "DELETE") {
      await sql`DELETE FROM product_images WHERE id = ${id}`;
      res.status(200).json({ ok: true });
      return;
    }

    // ---------- variants ----------
    if (resource === "variants" && id && req.method === "DELETE") {
      await sql`DELETE FROM product_variants WHERE id = ${id}`;
      res.status(200).json({ ok: true });
      return;
    }

    // ---------- orders ----------
    if (resource === "orders" && !id && req.method === "GET") {
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
      return;
    }

    if (resource === "orders" && id && req.method === "PUT") {
      const { status } = req.body || {};
      if (!STATUS_OPTIONS.includes(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      const [row] = await sql`UPDATE orders SET status = ${status} WHERE id = ${id} RETURNING *`;
      res.status(200).json(row);
      return;
    }

    res.status(404).json({ error: "Not found" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
}
