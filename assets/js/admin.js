// Soin de Soie — admin panel: login, categories/sub-categories, unified
// product form (main photo + inline colors, each with its own photo), orders.

let categoriesTree = []; // [{id, slug, name, subcategories:[{id, slug, name}]}]
let productsCache = null;
let ordersCache = null;

// ---------- low-level helpers ----------

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

// Resizes + re-encodes a photo client-side before upload: phone camera
// photos (often 5-15MB) were hitting the server's request-size limit and
// failing with a cryptic error. Downscaling to 1600px / JPEG ~85% keeps
// quality good for product photos while staying well under any limit.
function compressImage(file, maxDim = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ data_base64: reader.result.split(",")[1], mime: "image/jpeg", previewUrl: URL.createObjectURL(blob) });
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Disables a button and swaps its label while an async action runs, so
// slow requests (the free-tier database can take a moment to wake up)
// visibly show "working" instead of looking frozen.
async function withBusy(btn, busyLabel, fn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = busyLabel;
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// ---------- auth ----------

function showLogin() {
  document.getElementById("admin-login").hidden = false;
  document.getElementById("admin-dashboard").hidden = true;
}

async function showDashboard() {
  document.getElementById("admin-login").hidden = true;
  document.getElementById("admin-dashboard").hidden = false;
  try {
    categoriesTree = await api("GET", "/api/admin?action=categories");
  } catch (err) {
    alert("Couldn't load categories: " + err.message);
  }
  renderCategoryTree();
  loadProducts();
}

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
  } catch {
    errorEl.textContent = "Incorrect password.";
    errorEl.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await api("POST", "/api/admin?action=logout");
  showLogin();
});

// ---------- sidebar navigation ----------

document.querySelectorAll(".admin-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll("[id^='section-']").forEach((s) => (s.hidden = true));
    btn.classList.add("active");
    document.getElementById(`section-${btn.dataset.section}`).hidden = false;
    if (btn.dataset.section === "orders" && !ordersCache) loadOrders();
  });
});

// ========================================================================
// CATEGORIES
// ========================================================================

function renderCategoryTree() {
  const el = document.getElementById("category-tree");
  if (categoriesTree.length === 0) {
    el.innerHTML = `<p style="color:var(--ink-soft); font-size:14px;">No categories yet — add one below.</p>`;
    return;
  }

  el.innerHTML = categoriesTree
    .map(
      (c) => `
      <div class="category-block" data-category-id="${c.id}">
        <div class="category-block-head">
          <span class="name">${c.name}</span>
          <button type="button" class="icon-btn" data-action="rename-category" data-id="${c.id}" title="Rename">✎</button>
          <button type="button" class="icon-btn" data-action="delete-category" data-id="${c.id}" title="Delete">&times;</button>
        </div>
        <div class="subcategory-list">
          ${c.subcategories
            .map(
              (s) => `
            <div class="subcategory-row" data-subcategory-id="${s.id}">
              <span class="name">↳ ${s.name}</span>
              <button type="button" class="icon-btn" data-action="rename-subcategory" data-id="${s.id}" title="Rename">✎</button>
              <button type="button" class="icon-btn" data-action="delete-subcategory" data-id="${s.id}" title="Delete">&times;</button>
            </div>`
            )
            .join("")}
        </div>
        <div class="add-subcategory-row">
          <button type="button" class="btn" style="padding:6px 12px; font-size:11px;" data-action="add-subcategory" data-category-id="${c.id}">+ Add sub-category</button>
        </div>
      </div>`
    )
    .join("");

  el.querySelectorAll('[data-action="rename-category"]').forEach((btn) =>
    btn.addEventListener("click", async () => {
      const cat = categoriesTree.find((c) => c.id === Number(btn.dataset.id));
      const name = prompt("Rename category:", cat?.name || "");
      if (!name || !name.trim()) return;
      try {
        await api("PUT", `/api/admin?action=category&id=${btn.dataset.id}`, { name });
        await refreshCategories();
      } catch (err) {
        alert("Couldn't rename category: " + err.message);
      }
    })
  );

  el.querySelectorAll('[data-action="delete-category"]').forEach((btn) =>
    btn.addEventListener("click", async () => {
      const cat = categoriesTree.find((c) => c.id === Number(btn.dataset.id));
      if (!confirm(`Delete category "${cat?.name}"? Its sub-categories are deleted too.`)) return;
      try {
        await api("DELETE", `/api/admin?action=category&id=${btn.dataset.id}`);
        await refreshCategories();
      } catch (err) {
        alert(err.message);
      }
    })
  );

  el.querySelectorAll('[data-action="rename-subcategory"]').forEach((btn) =>
    btn.addEventListener("click", async () => {
      const sub = categoriesTree.flatMap((c) => c.subcategories).find((s) => s.id === Number(btn.dataset.id));
      const name = prompt("Rename sub-category:", sub?.name || "");
      if (!name || !name.trim()) return;
      try {
        await api("PUT", `/api/admin?action=subcategory&id=${btn.dataset.id}`, { name });
        await refreshCategories();
      } catch (err) {
        alert("Couldn't rename sub-category: " + err.message);
      }
    })
  );

  el.querySelectorAll('[data-action="delete-subcategory"]').forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this sub-category? Products in it just lose the sub-category tag.")) return;
      try {
        await api("DELETE", `/api/admin?action=subcategory&id=${btn.dataset.id}`);
        await refreshCategories();
      } catch (err) {
        alert("Couldn't delete sub-category: " + err.message);
      }
    })
  );

  el.querySelectorAll('[data-action="add-subcategory"]').forEach((btn) =>
    btn.addEventListener("click", async () => {
      const name = prompt("New sub-category name:");
      if (!name || !name.trim()) return;
      try {
        await api("POST", "/api/admin?action=subcategories", { category_id: Number(btn.dataset.categoryId), name });
        await refreshCategories();
      } catch (err) {
        alert("Couldn't add sub-category: " + err.message);
      }
    })
  );
}

async function refreshCategories() {
  categoriesTree = await api("GET", "/api/admin?action=categories");
  renderCategoryTree();
  if (document.getElementById("product-form-container").children.length > 0) {
    populateCategorySelect(document.getElementById("pf-category").value);
  }
}

document.getElementById("add-category-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  if (!name) return;
  try {
    await api("POST", "/api/admin?action=categories", { name });
    f.reset();
    await refreshCategories();
  } catch (err) {
    alert("Couldn't add category: " + err.message);
  }
});

// ========================================================================
// PRODUCTS
// ========================================================================

async function loadProducts() {
  const list = document.getElementById("product-list");
  list.innerHTML = `<p>Loading…</p>`;
  try {
    productsCache = await api("GET", "/api/admin?action=products");
    renderProductList();
  } catch (err) {
    list.innerHTML = `<p>Couldn't load products: ${err.message}</p>`;
  }
}

function renderProductList() {
  const list = document.getElementById("product-list");
  if (productsCache.length === 0) {
    list.innerHTML = `<p style="color:var(--ink-soft); font-size:14px;">No products yet — add your first one above.</p>`;
    return;
  }
  list.innerHTML = "";
  productsCache.forEach((p) => list.appendChild(buildProductRow(p)));
}

function buildProductRow(product) {
  const row = document.createElement("div");
  row.className = "admin-row";
  const thumb = product.images.find((i) => i.variant_id === null)?.url || product.images[0]?.url;
  const catLabel = product.subcategory_name ? `${product.category_name} › ${product.subcategory_name}` : product.category_name;

  row.innerHTML = `
    <div class="admin-row-main">
      <div class="admin-thumb">${thumb ? `<img src="${thumb}" alt="">` : ""}</div>
      <div class="admin-row-info">
        <div class="admin-row-name">${product.name}</div>
        <div class="admin-row-meta">${catLabel} · ${formatPrice(product.price_cents)}${product.discount_type !== "none" ? ` · ${product.discount_type === "percent" ? product.discount_value + "% off" : formatPrice(product.discount_value) + " off"}` : ""}${!product.in_stock ? " · <span style='color:var(--wine)'>coming soon</span>" : ""}</div>
      </div>
      <div class="admin-row-actions">
        <button type="button" class="btn" data-action="edit">Edit</button>
        <button type="button" class="btn" data-action="remove">Remove</button>
      </div>
    </div>
  `;

  row.querySelector('[data-action="edit"]').addEventListener("click", () => openProductForm(product));

  row.querySelector('[data-action="remove"]').addEventListener("click", async (e) => {
    if (!confirm(`Delete "${product.name}" permanently? This can't be undone.`)) return;
    try {
      await withBusy(e.target, "Removing…", () => api("DELETE", `/api/admin?action=product&id=${product.id}`));
      productsCache = productsCache.filter((p) => p.id !== product.id);
      row.remove();
      if (productsCache.length === 0) renderProductList();
    } catch (err) {
      alert("Couldn't remove product: " + err.message);
    }
  });

  return row;
}

document.getElementById("add-product-btn").addEventListener("click", () => openProductForm(null));

// ---------- unified product form (create + edit) ----------

let formState = null;

function populateCategorySelect(selectedCategoryId) {
  const catSelect = document.getElementById("pf-category");
  catSelect.innerHTML = categoriesTree.map((c) => `<option value="${c.id}" ${c.id === Number(selectedCategoryId) ? "selected" : ""}>${c.name}</option>`).join("");
  populateSubcategorySelect(catSelect.value, null);
}

function populateSubcategorySelect(categoryId, selectedSubId) {
  const subSelect = document.getElementById("pf-subcategory");
  const cat = categoriesTree.find((c) => c.id === Number(categoryId));
  const subs = cat ? cat.subcategories : [];
  subSelect.innerHTML =
    `<option value="">No sub-category</option>` +
    subs.map((s) => `<option value="${s.id}" ${s.id === Number(selectedSubId) ? "selected" : ""}>${s.name}</option>`).join("");
}

function openProductForm(product) {
  formState = {
    id: product ? product.id : null,
    mainPhoto: {
      existingImageId: product ? product.images.find((i) => i.variant_id === null)?.id || null : null,
      previewUrl: product ? product.images.find((i) => i.variant_id === null)?.url || null : null,
      pending: null, // {data_base64, mime} once a new photo is chosen
      removed: false,
    },
    colors: product
      ? product.variants.map((v) => ({
          id: v.id,
          name: v.name,
          existingImageId: product.images.find((i) => i.variant_id === v.id)?.id || null,
          previewUrl: product.images.find((i) => i.variant_id === v.id)?.url || null,
          pending: null,
        }))
      : [],
  };

  const container = document.getElementById("product-form-container");
  container.innerHTML = `
    <div class="product-form-panel">
      <h3>${product ? "Edit Product" : "New Product"}</h3>
      <form id="product-form" class="admin-form">
        <div class="form-row">
          <div>
            <label class="label">Name</label>
            <input type="text" id="pf-name" value="${product ? product.name.replace(/"/g, "&quot;") : ""}" required>
          </div>
          <div>
            <label class="label">Price (USD)</label>
            <input type="number" id="pf-price" step="0.01" min="0" value="${product ? (product.price_cents / 100).toFixed(2) : "0"}">
          </div>
        </div>
        <div class="form-row">
          <div>
            <label class="label">Category</label>
            <select id="pf-category"></select>
          </div>
          <div>
            <label class="label">Sub-category</label>
            <select id="pf-subcategory"></select>
          </div>
        </div>
        <div style="margin-top:14px;">
          <label class="label">Description</label>
          <textarea id="pf-description" rows="2">${product ? product.description || "" : ""}</textarea>
        </div>
        <div class="form-row">
          <div>
            <label class="label">Discount</label>
            <div style="display:flex; gap:10px;">
              <select id="pf-discount-type" style="flex:1;">
                <option value="none">No discount</option>
                <option value="percent">Percent off</option>
                <option value="fixed">Fixed amount off</option>
              </select>
              <input type="number" id="pf-discount-value" min="0" value="${product ? product.discount_value : 0}" style="flex:1;">
            </div>
          </div>
          <div style="display:flex; align-items:flex-end; gap:18px; padding-bottom:6px;">
            <label class="checkbox-row" style="margin-top:0;"><input type="checkbox" id="pf-in-stock" ${!product || product.in_stock ? "checked" : ""}> In stock</label>
            <label class="checkbox-row" style="margin-top:0;"><input type="checkbox" id="pf-featured" ${product && product.is_featured ? "checked" : ""}> Featured</label>
          </div>
        </div>

        <div style="margin-top:20px;">
          <label class="label">Main photo</label>
          <div class="photo-picker" id="pf-main-photo-picker"></div>
        </div>

        <div style="margin-top:22px;">
          <label class="label">Colors</label>
          <div class="color-rows" id="pf-color-rows"></div>
          <button type="button" class="btn" id="pf-add-color" style="margin-top:10px;">+ Add Color</button>
        </div>

        <p class="form-error" id="pf-error" hidden></p>

        <div class="hero-cta" style="margin-top:22px;">
          <button type="submit" class="btn solid big" id="pf-save">Save</button>
          <button type="button" class="btn" id="pf-cancel">Cancel</button>
        </div>
      </form>
    </div>
  `;

  const discountSelect = document.getElementById("pf-discount-type");
  discountSelect.value = product ? product.discount_type : "none";

  populateCategorySelect(product ? product.category_id : categoriesTree[0]?.id);
  if (product && product.subcategory_id) populateSubcategorySelect(product.category_id, product.subcategory_id);
  document.getElementById("pf-category").addEventListener("change", (e) => populateSubcategorySelect(e.target.value, null));

  renderMainPhotoPicker();
  renderColorRows();

  document.getElementById("pf-add-color").addEventListener("click", () => {
    formState.colors.push({ id: null, name: "", existingImageId: null, previewUrl: null, pending: null });
    renderColorRows();
  });

  document.getElementById("pf-cancel").addEventListener("click", closeProductForm);
  document.getElementById("product-form").addEventListener("submit", handleSaveProduct);

  container.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeProductForm() {
  formState = null;
  document.getElementById("product-form-container").innerHTML = "";
}

function renderMainPhotoPicker() {
  const el = document.getElementById("pf-main-photo-picker");
  const mp = formState.mainPhoto;
  const showPreview = !mp.removed && mp.previewUrl;
  el.innerHTML = `
    <div class="photo-picker-preview">${showPreview ? `<img src="${mp.previewUrl}" alt="">` : "No photo yet"}</div>
    <label class="file-btn">
      Choose File
      <input type="file" accept="image/*" id="pf-main-photo-input">
    </label>
    ${showPreview ? `<button type="button" class="btn" id="pf-remove-main-photo">Remove photo</button>` : ""}
  `;
  document.getElementById("pf-main-photo-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { data_base64, mime, previewUrl } = await compressImage(file);
      formState.mainPhoto.pending = { data_base64, mime };
      formState.mainPhoto.previewUrl = previewUrl;
      formState.mainPhoto.removed = false;
      renderMainPhotoPicker();
    } catch {
      alert("Couldn't read that photo — try a different file.");
    }
  });
  const removeBtn = document.getElementById("pf-remove-main-photo");
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      formState.mainPhoto.removed = true;
      formState.mainPhoto.previewUrl = null;
      formState.mainPhoto.pending = null;
      renderMainPhotoPicker();
    });
  }
}

function renderColorRows() {
  const el = document.getElementById("pf-color-rows");
  el.innerHTML = formState.colors
    .map(
      (c, i) => `
    <div class="color-row" data-index="${i}">
      <div class="photo-picker-preview">${c.previewUrl ? `<img src="${c.previewUrl}" alt="">` : "No photo"}</div>
      <input type="text" placeholder="Color name (e.g. Red)" value="${(c.name || "").replace(/"/g, "&quot;")}" data-color-name="${i}">
      <label class="file-btn">
        Photo
        <input type="file" accept="image/*" data-color-photo="${i}">
      </label>
      <button type="button" class="icon-btn" data-remove-color="${i}" title="Remove color">&times;</button>
    </div>`
    )
    .join("");

  el.querySelectorAll("[data-color-name]").forEach((input) => {
    input.addEventListener("input", (e) => {
      formState.colors[Number(e.target.dataset.colorName)].name = e.target.value;
    });
  });

  el.querySelectorAll("[data-color-photo]").forEach((input) => {
    input.addEventListener("change", async (e) => {
      const idx = Number(e.target.dataset.colorPhoto);
      const file = e.target.files[0];
      if (!file) return;
      try {
        const { data_base64, mime, previewUrl } = await compressImage(file);
        formState.colors[idx].pending = { data_base64, mime };
        formState.colors[idx].previewUrl = previewUrl;
        renderColorRows();
      } catch {
        alert("Couldn't read that photo — try a different file.");
      }
    });
  });

  el.querySelectorAll("[data-remove-color]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.dataset.removeColor);
      const color = formState.colors[idx];
      if (color.id) {
        if (!confirm(`Remove color "${color.name}"? This deletes it and its photo right away.`)) return;
        try {
          await api("DELETE", `/api/admin?action=variant&id=${color.id}`);
        } catch (err) {
          alert("Couldn't remove color: " + err.message);
          return;
        }
      }
      formState.colors.splice(idx, 1);
      renderColorRows();
    });
  });
}

async function handleSaveProduct(e) {
  e.preventDefault();
  const errorEl = document.getElementById("pf-error");
  errorEl.hidden = true;

  const name = document.getElementById("pf-name").value.trim();
  const categoryId = Number(document.getElementById("pf-category").value);
  if (!name || !categoryId) {
    errorEl.textContent = "Name and category are required.";
    errorEl.hidden = false;
    return;
  }

  const payload = {
    name,
    category_id: categoryId,
    subcategory_id: document.getElementById("pf-subcategory").value ? Number(document.getElementById("pf-subcategory").value) : null,
    description: document.getElementById("pf-description").value.trim(),
    price_cents: Math.round(Number(document.getElementById("pf-price").value || 0) * 100),
    discount_type: document.getElementById("pf-discount-type").value,
    discount_value: Number(document.getElementById("pf-discount-value").value || 0),
    in_stock: document.getElementById("pf-in-stock").checked,
    is_featured: document.getElementById("pf-featured").checked,
  };

  const saveBtn = document.getElementById("pf-save");
  try {
    await withBusy(saveBtn, "Saving…", async () => {
      let productId = formState.id;
      if (productId) {
        await api("PUT", `/api/admin?action=product&id=${productId}`, payload);
      } else {
        const created = await api("POST", "/api/admin?action=products", payload);
        productId = created.id;
      }

      // main photo
      if (formState.mainPhoto.removed && formState.mainPhoto.existingImageId) {
        await api("DELETE", `/api/admin?action=image&id=${formState.mainPhoto.existingImageId}`);
      }
      if (formState.mainPhoto.pending) {
        await api("POST", `/api/admin?action=product-image&id=${productId}`, { ...formState.mainPhoto.pending, variant_id: null });
      }

      // colors: new ones need creating first, then their photo; existing ones
      // get their name saved too (renaming in the row didn't submit on its own).
      for (const color of formState.colors) {
        if (!color.name || !color.name.trim()) continue;
        let variantId = color.id;
        if (!variantId) {
          const created = await api("POST", `/api/admin?action=product-variant&id=${productId}`, { name: color.name.trim() });
          variantId = created.id;
        } else {
          await api("PUT", `/api/admin?action=variant&id=${variantId}`, { name: color.name.trim() });
        }
        if (color.pending) {
          await api("POST", `/api/admin?action=product-image&id=${productId}`, { ...color.pending, variant_id: variantId });
        }
      }
    });

    closeProductForm();
    await loadProducts();
  } catch (err) {
    errorEl.textContent = "Couldn't save: " + err.message;
    errorEl.hidden = false;
  }
}

// ========================================================================
// ORDERS
// ========================================================================

const STATUS_OPTIONS = ["new", "confirmed", "fulfilled", "cancelled"];

async function loadOrders() {
  const list = document.getElementById("order-list");
  list.innerHTML = `<p>Loading…</p>`;
  try {
    ordersCache = await api("GET", "/api/admin?action=orders");
    renderOrderList();
  } catch (err) {
    list.innerHTML = `<p>Couldn't load orders: ${err.message}</p>`;
  }
}

function renderOrderList() {
  const list = document.getElementById("order-list");
  if (ordersCache.length === 0) {
    list.innerHTML = `<p style="color:var(--ink-soft); font-size:14px;">No orders yet.</p>`;
    return;
  }
  list.innerHTML = "";
  ordersCache.forEach((o) => list.appendChild(buildOrderRow(o)));
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
    try {
      await api("PUT", `/api/admin?action=order&id=${order.id}`, { status: e.target.value });
    } catch (err) {
      alert("Couldn't update order status: " + err.message);
    }
  });

  return row;
}

checkSession();
