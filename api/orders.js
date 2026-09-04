import { Resend } from "resend";
import { sql, effectivePriceCents } from "./_lib/db.js";

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

async function sendOwnerEmail(order, items) {
  if (!process.env.RESEND_API_KEY || !process.env.OWNER_NOTIFY_EMAIL) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const itemsHtml = items
    .map(
      (i) =>
        `<tr><td style="padding:4px 10px 4px 0;">${i.product_name}</td><td style="padding:4px 10px;">x${i.quantity}</td><td style="padding:4px 0; text-align:right;">${formatPrice(i.line_total_cents)}</td></tr>`
    )
    .join("");

  const addressHtml = order.address_text
    ? `${order.address_text}${order.latitude ? `<br><a href="https://maps.google.com/?q=${order.latitude},${order.longitude}">View on map</a>` : ""}`
    : "Not provided";

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to: process.env.OWNER_NOTIFY_EMAIL,
    subject: `New order #${order.id} — ${formatPrice(order.subtotal_cents)}`,
    html: `
      <h2>New website order</h2>
      <p><b>Customer:</b> ${order.customer_name}<br>
         <b>Phone:</b> ${order.customer_phone}<br>
         <b>Address:</b> ${addressHtml}<br>
         <b>Payment:</b> Cash on delivery</p>
      <table style="border-collapse:collapse; width:100%;">${itemsHtml}</table>
      <p><b>Total: ${formatPrice(order.subtotal_cents)}</b></p>
    `,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { channel, customer_name, customer_phone, address_text, latitude, longitude, items } = req.body || {};

  if (!["website", "whatsapp"].includes(channel)) {
    res.status(400).json({ error: "Invalid channel" });
    return;
  }
  if (!customer_name || !customer_phone) {
    res.status(400).json({ error: "Name and phone are required" });
    return;
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }

  try {
    // Never trust client-submitted prices — re-fetch current price/discount per product.
    const productIds = items.map((i) => Number(i.product_id));
    const products = await sql`SELECT * FROM products WHERE id = ANY(${productIds})`;
    const productById = new Map(products.map((p) => [p.id, p]));

    const lineItems = [];
    let subtotal = 0;
    for (const item of items) {
      const product = productById.get(Number(item.product_id));
      if (!product) continue;
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = effectivePriceCents(product);
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;
      lineItems.push({ product_id: product.id, product_name: product.name, unit_price_cents: unitPrice, quantity, line_total_cents: lineTotal });
    }

    if (lineItems.length === 0) {
      res.status(400).json({ error: "No valid items in cart" });
      return;
    }

    const [order] = await sql`
      INSERT INTO orders (channel, customer_name, customer_phone, address_text, latitude, longitude, subtotal_cents, payment_method)
      VALUES (${channel}, ${customer_name}, ${customer_phone}, ${address_text || null}, ${latitude || null}, ${longitude || null}, ${subtotal}, 'cash_on_delivery')
      RETURNING *
    `;

    for (const li of lineItems) {
      await sql`
        INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity, line_total_cents)
        VALUES (${order.id}, ${li.product_id}, ${li.product_name}, ${li.unit_price_cents}, ${li.quantity}, ${li.line_total_cents})
      `;
    }

    if (channel === "website") {
      try {
        await sendOwnerEmail(order, lineItems);
      } catch (emailErr) {
        console.error("Order email failed:", emailErr);
      }
    }

    res.status(201).json({ id: order.id, subtotal_cents: subtotal, items: lineItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create order" });
  }
}
