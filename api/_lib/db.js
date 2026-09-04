import { neon } from "@neondatabase/serverless";

let client;

export function sql(strings, ...values) {
  if (!client) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    client = neon(process.env.DATABASE_URL);
  }
  return client(strings, ...values);
}

// Effective price a customer actually pays, after any discount.
export function effectivePriceCents(product) {
  const base = product.price_cents;
  if (product.discount_type === "percent") {
    return Math.max(0, base - Math.round((base * product.discount_value) / 100));
  }
  if (product.discount_type === "fixed") {
    return Math.max(0, base - product.discount_value);
  }
  return base;
}

// Shapes a product row (plus its pre-fetched variants/images/category info)
// into the JSON the storefront and admin panel consume.
export function toPublicProduct(row, variantsByProduct, imagesByProduct) {
  const variants = variantsByProduct.get(row.id) || [];
  const images = (imagesByProduct.get(row.id) || []).map((img) => ({
    id: img.id,
    variant_id: img.variant_id,
    url: `/api/images/${img.id}`,
  }));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    price_cents: row.price_cents,
    effective_price_cents: effectivePriceCents(row),
    discounted: row.discount_type !== "none" && effectivePriceCents(row) < row.price_cents,
    in_stock: row.in_stock,
    is_featured: row.is_featured,
    category_id: row.category_id,
    category_slug: row.category_slug,
    category_name: row.category_name,
    subcategory_id: row.subcategory_id,
    subcategory_slug: row.subcategory_slug,
    subcategory_name: row.subcategory_name,
    variants: variants.map((v) => ({ id: v.id, name: v.name, color_hex: v.color_hex })),
    images,
  };
}

// Fetches variants + images for a set of product rows and groups them by product_id,
// so a product list only costs 2 extra queries total instead of N+1.
export async function attachVariantsAndImages(products) {
  if (products.length === 0) {
    return { variantsByProduct: new Map(), imagesByProduct: new Map() };
  }
  const ids = products.map((p) => p.id);

  const [variantRows, imageRows] = await Promise.all([
    sql`SELECT id, product_id, name, color_hex, sort_order FROM product_variants
        WHERE product_id = ANY(${ids}) ORDER BY sort_order ASC, id ASC`,
    sql`SELECT id, product_id, variant_id, sort_order FROM product_images
        WHERE product_id = ANY(${ids}) ORDER BY sort_order ASC, id ASC`,
  ]);

  const variantsByProduct = new Map();
  for (const v of variantRows) {
    if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
    variantsByProduct.get(v.product_id).push(v);
  }

  const imagesByProduct = new Map();
  for (const img of imageRows) {
    if (!imagesByProduct.has(img.product_id)) imagesByProduct.set(img.product_id, []);
    imagesByProduct.get(img.product_id).push(img);
  }

  return { variantsByProduct, imagesByProduct };
}
