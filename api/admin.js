// Consolidated admin API — every admin action goes through this one
// serverless function, dispatched by an `action` query param (kept flat,
// not a dynamic file-path segment, since a [...path].js catch-all did not
// resolve correctly on this deployment).
import { sql, attachVariantsAndImages } from "./_lib/db.js";
import { verifyPassword, createSessionCookie, clearSessionCookie, isAuthenticated } from "./_lib/auth.js";

const STATUS_OPTIONS = ["new", "confirmed", "fulfilled", "cancelled"];
const MAX_IMAGE_BASE64_CHARS = 6_000_000; // ~4.5MB decoded, safely under Vercel's request body limit

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function isUniqueViolation(err) {
  return err && err.code === "23505"; // Postgres unique_violation
}

export default async function handler(req, res) {
  const { action, id } = req.query;

  // ---------- public auth endpoints ----------
  if (action === "login" && req.method === "POST") {
    const { password } = req.body || {};
    if (!password || !verifyPassword(password)) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    res.setHeader("Set-Cookie", createSessionCookie());
    res.status(200).json({ authenticated: true });
    return;
  }
  if (action === "logout") {
    res.setHeader("Set-Cookie", clearSessionCookie());
    res.status(200).json({ authenticated: false });
    return;
  }
  if (action === "session" && req.method === "GET") {
    res.status(200).json({ authenticated: isAuthenticated(req) });
    return;
  }

  // ---------- everything else requires an admin session ----------
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Actions that take an id must get a real numeric one, or every id-based
  // action below (WHERE id = ...) fails with a confusing DB-level crash.
  if (id !== undefined && !/^\d+$/.test(String(id))) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    // ========== CATEGORIES ==========
    if (action === "categories") {
      if (req.method === "GET") {
        const [categories, subcategories] = await Promise.all([
          sql`SELECT id, slug, name, sort_order FROM categories ORDER BY sort_order ASC, id ASC`,
          sql`SELECT id, category_id, slug, name, sort_order FROM subcategories ORDER BY sort_order ASC, id ASC`,
        ]);
        const subsByCategory = new Map();
        for (const s of subcategories) {
          if (!subsByCategory.has(s.category_id)) subsByCategory.set(s.category_id, []);
          subsByCategory.get(s.category_id).push(s);
        }
        res.status(200).json(categories.map((c) => ({ ...c, subcategories: subsByCategory.get(c.id) || [] })));
        return;
      }
      if (req.method === "POST") {
        const { name } = req.body || {};
        if (!name || !name.trim()) {
          res.status(400).json({ error: "Category name is required" });
          return;
        }
        const slug = slugify(name);
        try {
          const [{ next }] = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM categories`;
          const [row] = await sql`
            INSERT INTO categories (slug, name, sort_order) VALUES (${slug}, ${name.trim()}, ${next}) RETURNING *
          `;
          res.status(201).json(row);
        } catch (err) {
          if (isUniqueViolation(err)) {
            res.status(409).json({ error: `A category named "${name.trim()}" already exists` });
            return;
          }
          throw err;
        }
        return;
      }
    }

    if (action === "category" && id) {
      if (req.method === "PUT") {
        const { name } = req.body || {};
        if (!name || !name.trim()) {
          res.status(400).json({ error: "Category name is required" });
          return;
        }
        const [row] = await sql`UPDATE categories SET name = ${name.trim()} WHERE id = ${id} RETURNING *`;
        res.status(200).json(row);
        return;
      }
      if (req.method === "DELETE") {
        const [{ count }] = await sql`SELECT count(*)::int AS count FROM products WHERE category_id = ${id}`;
        if (count > 0) {
          res.status(400).json({ error: `Can't delete — ${count} product(s) still use this category. Move or remove them first.` });
          return;
        }
        await sql`DELETE FROM categories WHERE id = ${id}`;
        res.status(200).json({ ok: true });
        return;
      }
    }

    // ========== SUBCATEGORIES ==========
    if (action === "subcategories" && req.method === "POST") {
      const { category_id, name } = req.body || {};
      if (!category_id || !name || !name.trim()) {
        res.status(400).json({ error: "category_id and name are required" });
        return;
      }
      const slug = slugify(name);
      try {
        const [{ next }] = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM subcategories WHERE category_id = ${category_id}`;
        const [row] = await sql`
          INSERT INTO subcategories (category_id, slug, name, sort_order)
          VALUES (${category_id}, ${slug}, ${name.trim()}, ${next})
          RETURNING *
        `;
        res.status(201).json(row);
      } catch (err) {
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: `A sub-category named "${name.trim()}" already exists in this category` });
          return;
        }
        throw err;
      }
      return;
    }

    if (action === "subcategory" && id) {
      if (req.method === "PUT") {
        const { name } = req.body || {};
        if (!name || !name.trim()) {
          res.status(400).json({ error: "Sub-category name is required" });
          return;
        }
        const [row] = await sql`UPDATE subcategories SET name = ${name.trim()} WHERE id = ${id} RETURNING *`;
        res.status(200).json(row);
        return;
      }
      if (req.method === "DELETE") {
        // Products in this subcategory just fall back to having no subcategory
        // (products.subcategory_id is ON DELETE SET NULL) — safe, non-destructive.
        await sql`DELETE FROM subcategories WHERE id = ${id}`;
        res.status(200).json({ ok: true });
        return;
      }
    }

    // ========== PRODUCTS ==========
    if (action === "products") {
      if (req.method === "GET") {
        const rows = await sql`
          SELECT p.*, c.slug AS category_slug, c.name AS category_name,
                 s.slug AS subcategory_slug, s.name AS subcategory_name
          FROM products p
          JOIN categories c ON c.id = p.category_id
          LEFT JOIN subcategories s ON s.id = p.subcategory_id
          ORDER BY c.sort_order ASC, p.sort_order ASC, p.id ASC
        `;
        const { variantsByProduct, imagesByProduct } = await attachVariantsAndImages(rows);
        res.status(200).json(
          rows.map((row) => ({
            id: row.id,
            slug: row.slug,
            name: row.name,
            description: row.description,
            price_cents: row.price_cents,
            discount_type: row.discount_type,
            discount_value: row.discount_value,
            in_stock: row.in_stock,
            is_featured: row.is_featured,
            sort_order: row.sort_order,
            category_id: row.category_id,
            category_name: row.category_name,
            subcategory_id: row.subcategory_id,
            subcategory_name: row.subcategory_name,
            variants: (variantsByProduct.get(row.id) || []).map((v) => ({ id: v.id, name: v.name, color_hex: v.color_hex })),
            images: (imagesByProduct.get(row.id) || []).map((img) => ({ id: img.id, variant_id: img.variant_id, url: `/api/images/${img.id}` })),
          }))
        );
        return;
      }
      if (req.method === "POST") {
        const b = req.body || {};
        if (!b.name || !b.category_id) {
          res.status(400).json({ error: "name and category are required" });
          return;
        }
        const slug = slugify(b.name) + "-" + Math.random().toString(36).slice(2, 6);
        const [row] = await sql`
          INSERT INTO products (slug, name, category_id, subcategory_id, description, price_cents, discount_type, discount_value, in_stock, is_featured, sort_order)
          VALUES (
            ${slug}, ${b.name}, ${b.category_id}, ${b.subcategory_id || null}, ${b.description || ""},
            ${b.price_cents || 0}, ${b.discount_type || "none"}, ${b.discount_value || 0},
            ${b.in_stock !== false}, ${!!b.is_featured}, ${b.sort_order || 0}
          )
          RETURNING *
        `;
        res.status(201).json({ ...row, variants: [], images: [] });
        return;
      }
    }

    if (action === "product" && id) {
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
            name = ${merged.name}, category_id = ${merged.category_id}, subcategory_id = ${merged.subcategory_id || null},
            description = ${merged.description}, price_cents = ${merged.price_cents},
            discount_type = ${merged.discount_type}, discount_value = ${merged.discount_value},
            in_stock = ${merged.in_stock}, is_featured = ${merged.is_featured},
            sort_order = ${merged.sort_order}, updated_at = now()
          WHERE id = ${id}
          RETURNING *
        `;
        res.status(200).json(row);
        return;
      }
      if (req.method === "DELETE") {
        // Real delete, per the client's request — order_items.product_id is
        // ON DELETE SET NULL, so past orders keep their snapshot and stay intact.
        await sql`DELETE FROM products WHERE id = ${id}`;
        res.status(200).json({ ok: true });
        return;
      }
    }

    if (action === "product-image" && id && req.method === "POST") {
      const { data_base64, mime, variant_id, sort_order } = req.body || {};
      if (!data_base64 || !mime) {
        res.status(400).json({ error: "data_base64 and mime are required" });
        return;
      }
      if (data_base64.length > MAX_IMAGE_BASE64_CHARS) {
        res.status(400).json({ error: "That photo is too large — please use a smaller one (under ~4MB)." });
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

    if (action === "product-variant" && id && req.method === "POST") {
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

    if (action === "image" && id && req.method === "DELETE") {
      await sql`DELETE FROM product_images WHERE id = ${id}`;
      res.status(200).json({ ok: true });
      return;
    }

    if (action === "variant" && id && req.method === "PUT") {
      const { name } = req.body || {};
      if (!name || !name.trim()) {
        res.status(400).json({ error: "Color name is required" });
        return;
      }
      const [row] = await sql`UPDATE product_variants SET name = ${name.trim()} WHERE id = ${id} RETURNING *`;
      res.status(200).json(row);
      return;
    }

    if (action === "variant" && id && req.method === "DELETE") {
      await sql`DELETE FROM product_variants WHERE id = ${id}`;
      res.status(200).json({ ok: true });
      return;
    }

    // ========== ORDERS ==========
    if (action === "orders" && req.method === "GET") {
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

    if (action === "order" && id && req.method === "PUT") {
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
