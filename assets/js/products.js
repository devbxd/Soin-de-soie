// Soin de Soie — renders products fetched from /api/products into the
// existing .product-grid / spotlight markup: photo gallery + color-variant
// swatches (click a swatch, the photo for that color appears), linking to
// the product detail page and wiring up Add to Cart.

// Categories are admin-defined and can be anything, so this is just a
// readable fallback label built from the slug (e.g. "gift-sets" -> "Gift Sets").
const CATEGORY_LABELS = {};

function categoryLabel(slug) {
  if (CATEGORY_LABELS[slug]) return CATEGORY_LABELS[slug];
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function priceMarkup(product) {
  if (!product.in_stock) return `— <small>Coming soon</small>`;
  if (product.discounted) {
    return `<s>${formatPrice(product.price_cents)}</s> ${formatPrice(product.effective_price_cents)}`;
  }
  if (product.price_cents === 0) {
    return `${formatPrice(product.price_cents)} <small>Price to be confirmed</small>`;
  }
  return formatPrice(product.effective_price_cents);
}

// Images shown for a given variant selection (null = general photos, not tied
// to a color). Falls back to general photos if that variant has none of its own.
function imagesForVariant(product, variantId) {
  const forVariant = product.images.filter((img) => img.variant_id === variantId);
  if (forVariant.length > 0) return forVariant;
  if (variantId !== null) return product.images.filter((img) => img.variant_id === null);
  return [];
}

// The photo + dot-navigation + color-swatch block, shared between grid cards,
// the homepage spotlight, and the product detail page.
// `onVariantChange(variantId, images)` lets a caller (the detail page) react
// to the selection, e.g. to enable/disable Add to Cart per variant.
function buildMediaBlock(product, { onVariantChange } = {}) {
  const wrap = document.createElement("div");

  const media = document.createElement("div");
  media.className = "product-media";

  const dots = document.createElement("div");
  dots.className = "media-dots";

  const swatches = document.createElement("div");
  swatches.className = "variant-swatches";

  const state = { variantId: null, index: 0 };

  function renderMedia() {
    const images = imagesForVariant(product, state.variantId);
    media.innerHTML = "";
    dots.innerHTML = "";

    if (images.length === 0) {
      media.classList.add("placeholder");
      media.textContent = "Photo coming soon";
    } else {
      media.classList.remove("placeholder");
      const img = document.createElement("img");
      img.className = "product-photo";
      img.src = images[Math.min(state.index, images.length - 1)].url;
      img.alt = `Soin de Soie ${product.name}`;
      media.appendChild(img);
      window.wireProductPhotoFallback(media);

      if (images.length > 1) {
        images.forEach((_, i) => {
          const dot = document.createElement("button");
          dot.type = "button";
          dot.className = "dot" + (i === state.index ? " active" : "");
          dot.setAttribute("aria-label", `Photo ${i + 1}`);
          dot.addEventListener("click", () => { state.index = i; renderMedia(); });
          dots.appendChild(dot);
        });
      }
    }

    if (onVariantChange) onVariantChange(state.variantId, images);
  }

  function renderSwatches() {
    swatches.innerHTML = "";
    product.variants.forEach((variant) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "swatch" + (state.variantId === variant.id ? " active" : "");
      swatch.style.background = variant.color_hex || "var(--surface-2)";
      swatch.title = variant.name;
      swatch.setAttribute("aria-label", variant.name);
      swatch.addEventListener("click", () => {
        state.variantId = variant.id;
        state.index = 0;
        renderMedia();
        renderSwatches();
      });
      swatches.appendChild(swatch);
    });
  }

  renderMedia();
  renderSwatches();

  wrap.appendChild(media);
  if (product.images.length > 1) wrap.appendChild(dots);
  if (product.variants.length > 0) wrap.appendChild(swatches);

  return wrap;
}

function productUrl(product) {
  return `product.html?slug=${encodeURIComponent(product.slug)}`;
}

function buildInfoBlock(product, { spotlight = false } = {}) {
  const wrap = document.createElement("div");

  const cat = document.createElement("span");
  cat.className = "product-cat";
  cat.textContent = spotlight
    ? `${categoryLabel(product.category)} — Featured`
    : categoryLabel(product.category);

  const name = document.createElement("h3");
  name.className = "product-name";
  const nameLink = document.createElement("a");
  nameLink.href = productUrl(product);
  nameLink.style.color = "inherit";
  nameLink.style.textDecoration = "none";
  nameLink.textContent = product.name;
  name.appendChild(nameLink);

  const desc = document.createElement("p");
  if (!spotlight) desc.style.fontSize = "13px";
  desc.textContent = product.description;

  const price = document.createElement("div");
  price.className = "product-price";
  price.innerHTML = priceMarkup(product);

  wrap.append(cat, name, desc, price);

  if (product.in_stock) {
    const ctaWrap = spotlight ? document.createElement("div") : null;
    if (spotlight) {
      ctaWrap.className = "hero-cta";
      ctaWrap.style.marginTop = "16px";
    }

    if (product.variants.length > 0) {
      const link = document.createElement("a");
      link.className = "btn solid";
      link.href = productUrl(product);
      link.textContent = "Choose a Color";
      if (spotlight) { link.style.marginTop = ""; ctaWrap.appendChild(link); wrap.appendChild(ctaWrap); }
      else { link.style.alignSelf = "flex-start"; link.style.marginTop = "4px"; wrap.appendChild(link); }
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn solid";
      if (!spotlight) { btn.style.alignSelf = "flex-start"; btn.style.marginTop = "4px"; }
      btn.textContent = "Add to Cart";
      btn.addEventListener("click", () => {
        Cart.add({
          product_id: product.id,
          name: product.name,
          unit_price_cents: product.effective_price_cents,
          image_url: product.images.find((i) => i.variant_id === null)?.url || product.images[0]?.url || null,
        });
        btn.textContent = "Added ✓";
        setTimeout(() => { btn.textContent = "Add to Cart"; }, 1200);
      });
      if (spotlight) { ctaWrap.appendChild(btn); wrap.appendChild(ctaWrap); }
      else { wrap.appendChild(btn); }
    }
  }

  return wrap;
}

function buildCard(product, { spotlight = false } = {}) {
  const card = document.createElement("div");
  card.className = "product-card";

  const mediaBlock = buildMediaBlock(product);
  const infoBlock = buildInfoBlock(product, { spotlight });

  if (spotlight) {
    card.style.display = "grid";
    card.style.gridTemplateColumns = "260px 1fr";
    card.style.gap = "32px";
    card.style.alignItems = "start";
    card.append(mediaBlock, infoBlock);
  } else {
    // Grid cards render media, then the info fields flat (matches the
    // original hand-written markup / CSS, which targets .product-card > *).
    card.append(...mediaBlock.children);
    card.append(...infoBlock.children);
  }

  return card;
}

async function fetchProducts(params) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`/api/products${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
  return res.json();
}

async function renderGrid(grid) {
  const category = grid.dataset.category;
  try {
    const products = await fetchProducts({ category });
    grid.innerHTML = "";
    if (products.length === 0) {
      grid.innerHTML = `<p style="padding:24px;">More products coming soon.</p>`;
    } else {
      products.forEach((product) => grid.appendChild(buildCard(product)));
    }
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p style="padding:24px;">Couldn't load products right now — please refresh.</p>`;
  }
}

async function renderSpotlight(el) {
  try {
    const [product] = await fetchProducts({ featured: "true" });
    if (!product) {
      el.closest("section")?.remove();
      return;
    }
    el.replaceWith(buildCard(product, { spotlight: true }));
  } catch (err) {
    console.error(err);
    el.closest("section")?.remove();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".product-grid[data-category]").forEach(renderGrid);
  const spotlight = document.getElementById("spotlight-product");
  if (spotlight) renderSpotlight(spotlight);
});
