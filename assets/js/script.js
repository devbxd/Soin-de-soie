// Soin de Soie — site behaviour

// TODO: replace with the client's real WhatsApp number (international format, no "+")
const WHATSAPP_NUMBER = "9613052374";
const WHATSAPP_MESSAGE = "Hello Soin de Soie, I'd like more information.";
window.WHATSAPP_NUMBER = WHATSAPP_NUMBER;

// Wires up WhatsApp links within `root` (defaults to the whole document).
// Exposed on window so dynamically-inserted product cards (assets/js/products.js)
// can re-run it on just the nodes they added.
function wireWhatsAppLinks(root = document) {
  root.querySelectorAll("[data-whatsapp]").forEach((link) => {
    link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
    link.target = "_blank";
    link.rel = "noopener";
  });
}
window.wireWhatsAppLinks = wireWhatsAppLinks;

// Product photos: fall back to a "photo coming soon" placeholder if the file is missing.
// Exposed on window for the same reason as wireWhatsAppLinks above.
function wireProductPhotoFallback(root = document) {
  root.querySelectorAll("img.product-photo").forEach((img) => {
    img.addEventListener("error", () => {
      const placeholder = document.createElement("div");
      placeholder.className = "product-media placeholder";
      placeholder.textContent = "Photo coming soon";
      img.replaceWith(placeholder);
    }, { once: true });
  });
}
window.wireProductPhotoFallback = wireProductPhotoFallback;

document.addEventListener("DOMContentLoaded", () => {
  wireWhatsAppLinks();
  wireProductPhotoFallback();

  // Mobile menu
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // Hero photo: just hide itself if missing, the gradient behind it still works
  document.querySelectorAll("img.hero-photo").forEach((img) => {
    img.addEventListener("error", () => { img.style.display = "none"; }, { once: true });
  });
});
