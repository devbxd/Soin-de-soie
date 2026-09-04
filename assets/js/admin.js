// Soin de Soie — admin panel (login, categories, product CRUD incl. photos/variants, orders).

let categories = [];

function categoryOptionsHtml(selectedSlug) {
  return categories
    .map((c) => `<option value="${c.slug}" ${c.slug === selectedSlug ? "selected" : ""}>${c.name}</option>`)
    .join("");
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  if (res.status === 401) {
    showLogin();
    throw new Error("Not authenticated");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

function formatPrice(cents) {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- Auth screens ----------

function showLogin() {
  document.getElementById("admin-login").hidden = false;
  document.getElementById("admin-dashboard").hidden = true;
}

async function showDashboard() {
  document.getElementById("admin-login").hidden = true;
  document.getElementById("admin-dashboard").hidden = false;
  await loadCategories();
  loadProducts();
  loadOrders();
}

async function loadCategories() {
  categories = await api("GET", "/api/categories");
  renderCategoryChips();
  const select = document.querySelector('#add-product-form select[name="category"]');
  if (select) select.innerHTML = categoryOptionsHtml();
}

function renderCategoryChips() {
  const el = document.getElementById("category-chips");
  if (!el) return;
  el.innerHTML = categories.map((c) => `<span class="variant-chip">${c.name}</span>`).join("") || "<p style='font-size:13px;color:var(--ink-soft);'>No categories yet — add one below.</p>";
}

document.getElementById("add-category-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  if (!name) return;
  await api("POST", "/api/admin?action=categories", { name });
  f.reset();
  await loadCategories();
});

async function checkSession() {
  const { authenticated } = await fetch("/api/admin?action=session").then((r) => r.json());
  if (authenticated) showDashboard();
  else showLogin();
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  try {
    await api("POST", "/api/admin?action=login", { password });
    errorEl.hidden = true;
    showDashboard();
  } catch (err) {
    errorEl.textContent = "Incorrect password.";
    errorEl.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await api("POST", "/api/admin?action=logout");
  showLogin();
});

// ---------- Tabs ----------

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.hidden = true);
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).hidden = false;
  });
});

// ---------- Products ----------

document.getElementById("add-product-toggle").addEventListener("click", () => {
  const form = document.getElementById("add-product-form");
  form.hidden = !form.hidden;
});

document.getElementById("add-product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const payload = {
    name: f.name.value.trim(),
    category: f.category.value,
    description: f.description.value.trim(),
    price_cents: Math.round(Number(f.price.value || 0) * 100),
    discount_type: f.discount_type.value,
    discount_value: Number(f.discount_value.value || 0),
    in_stock: f.in_stock.checked,
    is_featured: f.is_featured.checked,
  };
  await api("POST", "/api/admin?action=products", payload);
  f.reset();
  document.getElementById("add-product-form").hidden = true;
  loadProducts();
});

async function loadProducts() {
  const list = document.getElementById("product-list");
  list.innerHTML = `<p>Loading…</p>`;
  const products = await api("GET", "/api/admin?action=products");
  list.innerHTML = "";
  if (products.length === 0) {
    list.innerHTML = `<p>No products yet — add your first one above.</p>`;
    return;
  }
  products.forEach((p) => list.appendChild(buildProductRow(p)));
}

function buildProductRow(product) {
  const row = document.createElement("div");
  row.className = "admin-row";

  const thumb = product.images.find((i) => i.variant_id === null)?.url || product.images[0]?.url;

  row.innerHTML = `
    <div class="admin-row-main">
      <div class="admin-thumb">${thumb ? `<img src="${thumb}" alt="">` : ""}</div>
      <div class="admin-row-info">
        <div class="admin-row-name">${product.name}</div>
        <div class="admin-row-meta">${product.category} · ${formatPrice(product.price_cents)}${product.discount_type !== "none" ? ` · ${product.discount_type === "percent" ? product.discount_value + "% off" : formatPrice(product.discount_value) + " off"}` : ""} ${!product.is_active ? " · <span style='color:var(--wine)'>hidden</span>" : ""}</div>
      </div>
      <div class="admin-row-actions">
        <button type="button" class="btn" data-action="edit">Edit</button>
        <button type="button" class="btn" data-action="manage">Photos &amp; Colors</button>
        <button type="button" class="btn" data-action="delete">Remove</button>
      </div>
    </div>
    <div class="admin-row-edit" hidden></div>
    <div class="admin-row-manage" hidden></div>
  `;

  row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    if (!confirm(`Remove "${product.name}"? It will be hidden from the site (order history is kept).`)) return;
    await api("DELETE", `/api/admin?action=product&id=${product.id}`);
    loadProducts();
  });

  row.querySelector('[data-action="edit"]').addEventListener("click", () => {
    const editEl = row.querySelector(".admin-row-edit");
    editEl.hidden = !editEl.hidden;
    if (!editEl.hidden) editEl.innerHTML = buildEditFormHtml(product);
    wireEditForm(editEl, product, row);
  });

  row.querySelector('[data-action="manage"]').addEventListener("click", () => {
    const manageEl = row.querySelector(".admin-row-manage");
    manageEl.hidden = !manageEl.hidden;
    if (!manageEl.hidden) renderManagePanel(manageEl, product);
  });

  return row;
}

function buildEditFormHtml(p) {
  return `
    <form class="admin-form admin-edit-form">
      <label class="label">Name</label>
      <input type="text" name="name" value="${p.name.replace(/"/g, "&quot;")}" required>

      <label class="label" style="margin-top:12px;">Category</label>
      <select name="category">
        ${categoryOptionsHtml(p.category)}
      </select>

      <label class="label" style="margin-top:12px;">Description</label>
      <textarea name="description" rows="2">${p.description || ""}</textarea>

      <label class="label" style="margin-top:12px;">Price (USD)</label>
      <input type="number" name="price" step="0.01" min="0" value="${((p.price_cents || 0) / 100).toFixed(2)}">

      <label class="label" style="margin-top:12px;">Discount</label>
      <div style="display:flex; gap:10px;">
        <select name="discount_type" style="flex:1;">
          <option value="none" ${p.discount_type === "none" ? "selected" : ""}>No discount</option>
          <option value="percent" ${p.discount_type === "percent" ? "selected" : ""}>Percent off</option>
          <option value="fixed" ${p.discount_type === "fixed" ? "selected" : ""}>Fixed amount off</option>
        </select>
        <input type="number" name="discount_value" min="0" value="${p.discount_value || 0}" style="flex:1;" placeholder="e.g. 15">
      </div>

      <label class="checkbox-row"><input type="checkbox" name="in_stock" ${p.in_stock ? "checked" : ""}> In stock (visible with an Add to Cart button)</label>
      <label class="checkbox-row"><input type="checkbox" name="is_featured" ${p.is_featured ? "checked" : ""}> Featured on homepage</label>
      <label class="checkbox-row"><input type="checkbox" name="is_active" ${p.is_active ? "checked" : ""}> Active (unchecked = hidden from site)</label>

      <div class="hero-cta" style="margin-top:16px;">
        <button type="submit" class="btn solid">Save changes</button>
      </div>
    </form>
  `;
}

function wireEditForm(container, product, row) {
  const form = container.querySelector("form");
  if (!form || form.dataset.wired) return;
  form.dataset.wired = "true";
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    await api("PUT", `/api/admin?action=product&id=${product.id}`, {
      name: f.name.value.trim(),
      category: f.category.value,
      description: f.description.value.trim(),
      price_cents: Math.round(Number(f.price.value || 0) * 100),
      discount_type: f.discount_type.value,
      discount_value: Number(f.discount_value.value || 0),
      in_stock: f.in_stock.checked,
      is_featured: f.is_featured.checked,
      is_active: f.is_active.checked,
    });
    loadProducts();
  });
}

function renderManagePanel(container, product) {
  const variantOptions = product.variants.map((v) => `<option value="${v.id}">${v.name}</option>`).join("");

  container.innerHTML = `
    <div class="manage-section">
      <h4>Colors</h4>
      <div class="variant-list">
        ${product.variants
          .map(
            (v) => `<span class="variant-chip" data-variant-id="${v.id}">
              <span class="chip-swatch" style="background:${v.color_hex || "#ccc"}"></span>${v.name}
              <button type="button" data-action="delete-variant" data-id="${v.id}" aria-label="Remove color">&times;</button>
            </span>`
          )
          .join("") || "<p style='font-size:13px;color:var(--ink-soft);'>No colors yet.</p>"}
      </div>
      <form class="admin-form add-variant-form" style="margin-top:10px; flex-direction:row; gap:10px; align-items:flex-end;">
        <div style="flex:1;">
          <label class="label">Color name</label>
          <input type="text" name="name" placeholder="e.g. Red" required>
        </div>
        <div>
          <label class="label">Swatch</label>
          <input type="color" name="color_hex" value="#A8C3AE" style="height:40px; margin-top:6px;">
        </div>
        <button type="submit" class="btn">Add color</button>
      </form>
    </div>

    <div class="manage-section">
      <h4>Photos</h4>
      <div class="photo-list">
        ${product.images
          .map(
            (img) => `<span class="photo-chip" data-image-id="${img.id}">
              <img src="${img.url}" alt="">
              <button type="button" data-action="delete-image" data-id="${img.id}" aria-label="Remove photo">&times;</button>
            </span>`
          )
          .join("") || "<p style='font-size:13px;color:var(--ink-soft);'>No photos yet.</p>"}
      </div>
      <form class="admin-form add-photo-form" style="margin-top:10px; flex-direction:row; gap:10px; align-items:flex-end;">
        <div style="flex:1;">
          <label class="label">For color (optional)</label>
          <select name="variant_id">
            <option value="">General (no color)</option>
            ${variantOptions}
          </select>
        </div>
        <div>
          <label class="label">Photo</label>
          <input type="file" name="photo" accept="image/*" required style="margin-top:6px;">
        </div>
        <button type="submit" class="btn">Upload</button>
      </form>
    </div>
  `;

  container.querySelectorAll('[data-action="delete-variant"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api("DELETE", `/api/admin?action=variant&id=${btn.dataset.id}`);
      loadProducts();
    });
  });

  container.querySelectorAll('[data-action="delete-image"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api("DELETE", `/api/admin?action=image&id=${btn.dataset.id}`);
      loadProducts();
    });
  });

  container.querySelector(".add-variant-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    await api("POST", `/api/admin?action=product-variant&id=${product.id}`, {
      name: f.name.value.trim(),
      color_hex: f.color_hex.value,
    });
    loadProducts();
  });

  container.querySelector(".add-photo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const file = f.photo.files[0];
    if (!file) return;
    const data_base64 = await fileToBase64(file);
    await api("POST", `/api/admin?action=product-image&id=${product.id}`, {
      data_base64,
      mime: file.type,
      variant_id: f.variant_id.value || null,
    });
    loadProducts();
  });
}

// ---------- Orders ----------

const STATUS_OPTIONS = ["new", "confirmed", "fulfilled", "cancelled"];

async function loadOrders() {
  const list = document.getElementById("order-list");
  list.innerHTML = `<p>Loading…</p>`;
  const orders = await api("GET", "/api/admin?action=orders");
  list.innerHTML = "";
  if (orders.length === 0) {
    list.innerHTML = `<p>No orders yet.</p>`;
    return;
  }
  orders.forEach((o) => list.appendChild(buildOrderRow(o)));
}

function buildOrderRow(order) {
  const row = document.createElement("div");
  row.className = "admin-row";
  const date = new Date(order.created_at).toLocaleString();
  const itemsText = order.items.map((i) => `${i.product_name} x${i.quantity}`).join(", ");
  const mapLink = order.latitude ? `<a href="https://maps.google.com/?q=${order.latitude},${order.longitude}" target="_blank" rel="noopener">View on map</a>` : "";

  row.innerHTML = `
    <div class="admin-row-main" style="align-items:flex-start;">
      <div class="admin-row-info">
        <div class="admin-row-name">#${order.id} — ${order.customer_name} <span class="order-channel">${order.channel}</span></div>
        <div class="admin-row-meta">${date}</div>
        <div class="admin-row-meta">${order.customer_phone} ${order.address_text ? "· " + order.address_text : ""} ${mapLink}</div>
        <div class="admin-row-meta">${itemsText}</div>
        <div class="admin-row-meta">Total: ${formatPrice(order.subtotal_cents)} · Payment: cash on delivery</div>
      </div>
      <div class="admin-row-actions">
        <select class="order-status">
          ${STATUS_OPTIONS.map((s) => `<option value="${s}" ${s === order.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>
    </div>
  `;

  row.querySelector(".order-status").addEventListener("change", async (e) => {
    await api("PUT", `/api/admin?action=order&id=${order.id}`, { status: e.target.value });
  });

  return row;
}

checkSession();
