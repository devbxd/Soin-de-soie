// Soin de Soie — generic category page (category.html?slug=...). The grid's
// data-category attribute is set by an inline script in category.html
// (synchronously, before DOMContentLoaded) so products.js's own
// DOMContentLoaded handler picks it up in time. This file just fills in the
// human-readable heading once the category list has loaded.

document.addEventListener("DOMContentLoaded", async () => {
  const slug = document.getElementById("category-grid")?.dataset.category;
  const heading = document.getElementById("category-heading");
  if (!slug || !heading) return;

  try {
    const categories = await fetch("/api/categories").then((r) => r.json());
    const category = categories.find((c) => c.slug === slug);
    if (category) {
      heading.textContent = category.name;
      document.title = `${category.name} — Soin de Soie`;
    } else {
      heading.textContent = slug;
    }
  } catch {
    heading.textContent = slug;
  }
});
