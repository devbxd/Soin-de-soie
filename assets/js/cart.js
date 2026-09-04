// Soin de Soie — shared cart (localStorage) + the slide-over drawer UI.
// Loaded on every page so the cart badge/drawer are consistent everywhere.

const CART_KEY = "sds_cart";

function readCart() {
  try {
    const items = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  document.dispatchEvent(new CustomEvent("cart:change"));
}

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

const Cart = {
  getItems: readCart,

  add({ product_id, name, unit_price_cents, image_url, variant_id = null, variant_name = null }, quantity = 1) {
    const items = readCart();
    const key = `${product_id}:${variant_id ?? "none"}`;
    const existing = items.find((i) => i.key === key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({ key, product_id, name, unit_price_cents, image_url, variant_id, variant_name, quantity });
    }
    writeCart(items);
  },

  setQuantity(key, quantity) {
    let items = readCart();
    if (quantity <= 0) {
      items = items.filter((i) => i.key !== key);
    } else {
      const item = items.find((i) => i.key === key);
      if (item) item.quantity = quantity;
    }
    writeCart(items);
  },

  remove(key) {
    writeCart(readCart().filter((i) => i.key !== key));
  },

  clear() {
    writeCart([]);
  },

  getTotalCents() {
    return readCart().reduce((sum, i) => sum + i.unit_price_cents * i.quantity, 0);
  },

  getCount() {
    return readCart().reduce((sum, i) => sum + i.quantity, 0);
  },
};

window.Cart = Cart;

// ---------- Drawer UI ----------

function buildDrawer() {
  const overlay = document.createElement("div");
  overlay.className = "cart-overlay";
  overlay.id = "cart-overlay";

  const drawer = document.createElement("aside");
  drawer.className = "cart-drawer";
  drawer.id = "cart-drawer";
  drawer.innerHTML = `
    <div class="cart-drawer-head">
      <h3>Your Cart</h3>
      <button type="button" class="cart-close" aria-label="Close cart">&times;</button>
    </div>
    <div class="cart-drawer-body" id="cart-drawer-body"></div>
    <div class="cart-drawer-foot">
      <div class="cart-total"><span>Total</span><span id="cart-total-amount">$0.00</span></div>
      <a class="btn solid" href="checkout.html" id="cart-checkout-btn">Checkout</a>
    </div>
  `;

  document.body.append(overlay, drawer);

  function close() {
    overlay.classList.remove("open");
    drawer.classList.remove("open");
  }
  overlay.addEventListener("click", close);
  drawer.querySelector(".cart-close").addEventListener("click", close);

  return { overlay, drawer, close };
}

function renderDrawerBody() {
  const body = document.getElementById("cart-drawer-body");
  const totalEl = document.getElementById("cart-total-amount");
  if (!body) return;

  const items = readCart();
  if (items.length === 0) {
    body.innerHTML = `<p class="cart-empty">Your cart is empty.</p>`;
  } else {
    body.innerHTML = items
      .map(
        (i) => `
        <div class="cart-line" data-key="${i.key}">
          <div class="cart-line-media">${i.image_url ? `<img src="${i.image_url}" alt="${i.name}">` : ""}</div>
          <div class="cart-line-info">
            <div class="cart-line-name">${i.name}${i.variant_name ? ` — ${i.variant_name}` : ""}</div>
            <div class="cart-line-price">${formatPrice(i.unit_price_cents)}</div>
            <div class="cart-line-qty">
              <button type="button" class="qty-btn" data-action="dec">−</button>
              <span>${i.quantity}</span>
              <button type="button" class="qty-btn" data-action="inc">+</button>
              <button type="button" class="cart-remove" data-action="remove" aria-label="Remove">&times;</button>
            </div>
          </div>
        </div>`
      )
      .join("");

    body.querySelectorAll(".cart-line").forEach((line) => {
      const key = line.dataset.key;
      const item = items.find((i) => i.key === key);
      line.querySelector('[data-action="inc"]').addEventListener("click", () => Cart.setQuantity(key, item.quantity + 1));
      line.querySelector('[data-action="dec"]').addEventListener("click", () => Cart.setQuantity(key, item.quantity - 1));
      line.querySelector('[data-action="remove"]').addEventListener("click", () => Cart.remove(key));
    });
  }

  if (totalEl) totalEl.textContent = formatPrice(Cart.getTotalCents());
}

function updateBadge() {
  const badge = document.getElementById("cart-badge");
  if (!badge) return;
  const count = Cart.getCount();
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

function injectHeaderButton() {
  const headerRow = document.querySelector(".header-row");
  if (!headerRow || document.getElementById("cart-toggle")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "cart-toggle";
  btn.className = "cart-toggle";
  btn.setAttribute("aria-label", "Open cart");
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h2l1.2 11.2A2 2 0 0 0 9.2 19H18a2 2 0 0 0 2-1.7L21 9H7"/><circle cx="10" cy="21" r="1.2"/><circle cx="17" cy="21" r="1.2"/></svg>
    <span class="cart-badge" id="cart-badge" hidden>0</span>
  `;
  btn.addEventListener("click", () => {
    document.getElementById("cart-overlay").classList.add("open");
    document.getElementById("cart-drawer").classList.add("open");
    renderDrawerBody();
  });

  const cta = headerRow.querySelector(".header-cta");
  if (cta) cta.before(btn);
  else headerRow.appendChild(btn);
}

document.addEventListener("DOMContentLoaded", () => {
  injectHeaderButton();
  buildDrawer();
  renderDrawerBody();
  updateBadge();
});

document.addEventListener("cart:change", () => {
  renderDrawerBody();
  updateBadge();
});
