// Soin de Soie — category links (main nav, footer, homepage strip) are
// rendered from the database so new categories the admin creates show up
// everywhere automatically, with no HTML to edit per page.

async function loadCategories() {
  try {
    const res = await fetch("/api/categories");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function categoryUrl(cat) {
  return `category.html?slug=${encodeURIComponent(cat.slug)}`;
}

// A second, bolder row of category links right under the header — injected
// here (rather than duplicated in every HTML file) so it appears everywhere
// and stays in sync with whatever categories the admin has created.
function injectSubnav(categories) {
  if (categories.length === 0 || document.querySelector(".subnav-bar")) return;
  const header = document.querySelector(".site-header");
  if (!header) return;
  const bar = document.createElement("div");
  bar.className = "subnav-bar";
  bar.innerHTML = `<div class="wrap subnav-row">${categories.map((c) => `<a href="${categoryUrl(c)}">${c.name}</a>`).join("")}</div>`;
  header.after(bar);
}

document.addEventListener("DOMContentLoaded", async () => {
  const categories = await loadCategories();
  injectSubnav(categories);

  const navSlot = document.getElementById("nav-categories");
  if (navSlot) {
    navSlot.innerHTML = categories.map((c) => `<a href="${categoryUrl(c)}">${c.name}</a>`).join("");
  }

  const footerSlot = document.getElementById("footer-categories");
  if (footerSlot) {
    footerSlot.innerHTML = categories.map((c) => `<a href="${categoryUrl(c)}">${c.name}</a>`).join("");
  }

  const strip = document.getElementById("category-strip");
  if (strip) {
    strip.innerHTML = categories
      .map((c) => `<a href="${categoryUrl(c)}"><h3>${c.name}</h3></a>`)
      .join("");
  }
});
