// Soin de Soie — checkout page logic: cart review, customer info, geolocation
// (with manual fallback), and the two order paths (website / WhatsApp).

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function renderSummary() {
  const list = document.getElementById("checkout-items");
  const totalEl = document.getElementById("checkout-total");
  const items = Cart.getItems();

  if (items.length === 0) {
    list.innerHTML = `<p>Your cart is empty. <a href="index.html">Continue shopping</a>.</p>`;
    document.getElementById("checkout-form").style.display = "none";
  } else {
    list.innerHTML = items
      .map(
        (i) => `
        <div class="cart-line" data-key="${i.key}">
          <div class="cart-line-media">${i.image_url ? `<img src="${i.image_url}" alt="${i.name}">` : ""}</div>
          <div class="cart-line-info">
            <div class="cart-line-name">${i.name}${i.variant_name ? ` — ${i.variant_name}` : ""}</div>
            <div class="cart-line-price">${formatPrice(i.unit_price_cents)} × ${i.quantity}</div>
          </div>
        </div>`
      )
      .join("");
  }

  totalEl.textContent = formatPrice(Cart.getTotalCents());
}

function buildWhatsAppMessage(name, phone, address) {
  const items = Cart.getItems();
  const lines = items.map((i) => `• ${i.name}${i.variant_name ? ` (${i.variant_name})` : ""} x${i.quantity} — ${formatPrice(i.unit_price_cents * i.quantity)}`);
  return [
    `New order from ${name} (${phone})`,
    address ? `Address: ${address}` : "",
    "",
    ...lines,
    "",
    `Total: ${formatPrice(Cart.getTotalCents())}`,
    `Payment: Cash on delivery`,
  ]
    .filter(Boolean)
    .join("\n");
}

function getFormValues() {
  return {
    name: document.getElementById("checkout-name").value.trim(),
    phone: document.getElementById("checkout-phone").value.trim(),
    address: document.getElementById("checkout-address").value.trim(),
  };
}

function validateForm() {
  const { name, phone } = getFormValues();
  const errorEl = document.getElementById("checkout-error");
  if (!name || !phone) {
    errorEl.textContent = "Please enter your name and phone number.";
    errorEl.hidden = false;
    return false;
  }
  errorEl.hidden = true;
  return true;
}

async function submitOrder(channel) {
  if (!validateForm()) return;
  const { name, phone, address } = getFormValues();
  const coords = window.__checkoutCoords || {};

  const items = Cart.getItems().map((i) => ({ product_id: i.product_id, quantity: i.quantity }));

  const payload = {
    channel,
    customer_name: name,
    customer_phone: phone,
    address_text: address || null,
    latitude: coords.lat || null,
    longitude: coords.lng || null,
    items,
  };

  try {
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Order save failed:", err);
    // Non-blocking: the WhatsApp path still works even if this fails.
  }

  if (channel === "whatsapp") {
    const message = buildWhatsAppMessage(name, phone, address);
    window.open(`https://wa.me/${window.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  Cart.clear();
  document.getElementById("checkout-form").style.display = "none";
  document.getElementById("checkout-items").innerHTML = "";
  document.getElementById("checkout-confirmation").hidden = false;
}

function setupGeolocation() {
  const btn = document.getElementById("locate-btn");
  const addressField = document.getElementById("checkout-address");
  const status = document.getElementById("locate-status");

  btn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      status.textContent = "Location isn't supported on this device — please type your address below.";
      return;
    }
    status.textContent = "Locating…";
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        window.__checkoutCoords = { lat: latitude, lng: longitude };
        try {
          const res = await fetch("/api/geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          });
          const data = await res.json();
          if (data.address_text) addressField.value = data.address_text;
          status.textContent = "Location found — feel free to edit the address below.";
        } catch {
          status.textContent = "Found your location, but couldn't look up the address — please type it below.";
        }
      },
      () => {
        status.textContent = "Location access denied — please type your address below.";
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderSummary();
  setupGeolocation();
  document.getElementById("order-website-btn").addEventListener("click", () => submitOrder("website"));
  document.getElementById("order-whatsapp-btn").addEventListener("click", () => submitOrder("whatsapp"));
});

document.addEventListener("cart:change", renderSummary);
