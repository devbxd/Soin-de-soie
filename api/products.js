import { sql, toPublicProduct, attachVariantsAndImages } from "./_lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { category, subcategory, featured, slug } = req.query;

  try {
    let rows;
    if (slug) {
      rows = await sql`
        SELECT p.*, c.slug AS category_slug, c.name AS category_name,
               s.slug AS subcategory_slug, s.name AS subcategory_name
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN subcategories s ON s.id = p.subcategory_id
        WHERE p.slug = ${slug}
      `;
    } else if (featured === "true") {
      rows = await sql`
        SELECT p.*, c.slug AS category_slug, c.name AS category_name,
               s.slug AS subcategory_slug, s.name AS subcategory_name
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN subcategories s ON s.id = p.subcategory_id
        WHERE p.is_featured = true
        ORDER BY p.sort_order ASC, p.id ASC
      `;
    } else if (subcategory) {
      rows = await sql`
        SELECT p.*, c.slug AS category_slug, c.name AS category_name,
               s.slug AS subcategory_slug, s.name AS subcategory_name
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN subcategories s ON s.id = p.subcategory_id
        WHERE s.slug = ${subcategory}
        ORDER BY p.sort_order ASC, p.id ASC
      `;
    } else if (category) {
      rows = await sql`
        SELECT p.*, c.slug AS category_slug, c.name AS category_name,
               s.slug AS subcategory_slug, s.name AS subcategory_name
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN subcategories s ON s.id = p.subcategory_id
        WHERE c.slug = ${category}
        ORDER BY p.sort_order ASC, p.id ASC
      `;
    } else {
      rows = await sql`
        SELECT p.*, c.slug AS category_slug, c.name AS category_name,
               s.slug AS subcategory_slug, s.name AS subcategory_name
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN subcategories s ON s.id = p.subcategory_id
        ORDER BY c.sort_order ASC, p.sort_order ASC, p.id ASC
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
