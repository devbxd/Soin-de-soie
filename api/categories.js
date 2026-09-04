import { sql } from "./_lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const [categories, subcategories] = await Promise.all([
      sql`SELECT id, slug, name FROM categories ORDER BY sort_order ASC, id ASC`,
      sql`SELECT id, category_id, slug, name FROM subcategories ORDER BY sort_order ASC, id ASC`,
    ]);

    const subsByCategory = new Map();
    for (const s of subcategories) {
      if (!subsByCategory.has(s.category_id)) subsByCategory.set(s.category_id, []);
      subsByCategory.get(s.category_id).push({ id: s.id, slug: s.slug, name: s.name });
    }

    const tree = categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      subcategories: subsByCategory.get(c.id) || [],
    }));

    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
    res.status(200).json(tree);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load categories" });
  }
}
