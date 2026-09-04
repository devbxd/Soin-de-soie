import { sql, toPublicProduct, attachVariantsAndImages } from "./_lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { category, featured, slug } = req.query;

  try {
    let rows;
    if (slug) {
      rows = await sql`
        SELECT * FROM products WHERE is_active = true AND slug = ${slug}
      `;
    } else if (featured === "true") {
      rows = await sql`
        SELECT * FROM products
        WHERE is_active = true AND is_featured = true
        ORDER BY sort_order ASC, id ASC
      `;
    } else if (category) {
      rows = await sql`
        SELECT * FROM products
        WHERE is_active = true AND category = ${category}
        ORDER BY sort_order ASC, id ASC
      `;
    } else {
      rows = await sql`
        SELECT * FROM products
        WHERE is_active = true
        ORDER BY category ASC, sort_order ASC, id ASC
      `;
    }

    const { variantsByProduct, imagesByProduct } = await attachVariantsAndImages(rows);

    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
    res.status(200).json(rows.map((row) => toPublicProduct(row, variantsByProduct, imagesByProduct)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load products" });
  }
}
