// Soin de Soie — product detail page (product.html?slug=...).
// Reuses buildMediaBlock / formatPrice / priceMarkup / CATEGORY_LABELS from
// products.js (loaded before this file) so the gallery + swatch behaviour
// (click a color, its photo appears) is identical to the grid cards.

async function loadProductDetail() {
  const root = document.getElementById("product-detail");
  const params = new URLSearchParams(location.search);
  const slug = params.get("slug");

  if (!slug) {
    root.innerHTML = `<p>No product specified.</p>`;
    return;
  }

  let product;
  try {
    const res = await fetch(`/api/products?slug=${encodeURIComponent(slug)}`);
    const list = await res.json();
    product = list[0];
  } catch (err) {
    console.error(err);
  }

  if (!product) {
    root.innerHTML = `<p>This product couldn't be found. <a href="index.html">Back to home</a>.</p>`;
    return;
  }

  document.title = `${product.name} — Soin de Soie`;

  let currentVariantId = null;
  let currentImages = [];

  const mediaBlock = buildMediaBlock(product, {
    onVariantChange: (variantId, images) => {
      currentVariantId = variantId;
      currentImages = images;
    },
  });
  mediaBlock.classList.add("detail-media");

  const info = document.createElement("div");
  info.className = "detail-info";

  const breadcrumb = document.createElement("a");
  breadcrumb.className = "label";
  breadcrumb.style.display = "inline-block";
  breadcrumb.style.marginBottom = "12px";
  breadcrumb.style.textDecoration = "none";
  breadcrumb.href = `category.html?slug=${encodeURIComponent(product.category_slug)}`;
  breadcrumb.textContent = `← ${categoryLabel(product)}`;

  const name = document.createElement("h1");
  name.textContent = product.name;
  name.style.fontSize = "clamp(28px, 3.6vw, 40px)";

  const price = document.createElement("div");
  price.className = "product-price";
  price.style.fontSize = "22px";
  price.innerHTML = priceMarkup(product);

  const desc = document.createElement("p");
  desc.style.fontSize = "15px";
  desc.style.maxWidth = "48ch";
  desc.textContent = product.description;

  info.append(breadcrumb, name, price, desc);

  if (product.in_stock) {
    const qtyRow = document.createElement("div");
    qtyRow.className = "detail-qty-row";
    qtyRow.innerHTML = `
      <label for="detail-qty" class="label" style="margin-right:10px;">Quantity</label>
      <div class="cart-line-qty" style="display:inline-flex;">
        <button type="button" class="qty-btn" id="detail-qty-dec">−</button>
        <span id="detail-qty-value">1</span>
        <button type="button" class="qty-btn" id="detail-qty-inc">+</button>
      </div>
    `;
    info.appendChild(qtyRow);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn solid";
    addBtn.style.marginTop = "18px";
    addBtn.textContent = "Add to Cart";

    let qty = 1;
    const qtyValueEl = () => qtyRow.querySelector("#detail-qty-value");

    qtyRow.querySelector("#detail-qty-inc").addEventListener("click", () => {
      qty += 1;
      qtyValueEl().textContent = qty;
    });
    qtyRow.querySelector("#detail-qty-dec").addEventListener("click", () => {
      qty = Math.max(1, qty - 1);
      qtyValueEl().textContent = qty;
    });

    addBtn.addEventListener("click", () => {
      if (product.variants.length > 0 && currentVariantId === null) {
        addBtn.textContent = "Please choose a color";
        setTimeout(() => { addBtn.textContent = "Add to Cart"; }, 1500);
        return;
      }
      const variant = product.variants.find((v) => v.id === currentVariantId);
      Cart.add(
        {
          product_id: product.id,
          name: product.name,
          unit_price_cents: product.effective_price_cents,
          image_url: currentImages[0]?.url || null,
          variant_id: variant ? variant.id : null,
          variant_name: variant ? variant.name : null,
        },
        qty
      );
      addBtn.textContent = "Added ✓";
      setTimeout(() => { addBtn.textContent = "Add to Cart"; }, 1200);
    });

    info.appendChild(addBtn);

    if (product.variants.length > 0) {
      const hint = document.createElement("p");
      hint.style.fontSize = "12.5px";
      hint.style.marginTop = "10px";
      hint.textContent = "Pick a color above before adding to cart.";
      info.appendChild(hint);
    }
  } else {
    const soon = document.createElement("p");
    soon.style.marginTop = "16px";
    soon.innerHTML = `<em>Coming soon</em> — not available to order yet.`;
    info.appendChild(soon);
  }

  root.innerHTML = "";
  root.className = "detail-grid";
  root.append(mediaBlock, info);
}

document.addEventListener("DOMContentLoaded", loadProductDetail);
