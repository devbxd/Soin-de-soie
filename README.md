# Soin de Soie

Luxury skincare & makeup storefront — static site + Vercel serverless API + Neon (Postgres) database.

## Stack

- **Frontend**: plain HTML/CSS/JS, no framework/build step.
- **Backend**: Vercel serverless functions under `/api`.
- **Database**: [Neon](https://neon.tech) (serverless Postgres). Product photos are stored directly in the database.
- **Email**: [Resend](https://resend.com) — order notifications.
- **Geocoding**: OpenStreetMap Nominatim (free, no key), proxied through `/api/geocode`.

## Local development

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, RESEND_API_KEY, etc.
node scripts/dev-server.mjs
```

Open http://localhost:5600 — this dev server runs both the static site and the `/api` functions locally against your real Neon database, so it behaves like production.

## Database setup (one-time, already done for the live Neon project)

Run, in order, via `node db/run-sql-file.mjs <path>` (or paste into Neon's SQL editor):

1. `db/schema.sql`
2. `db/migrations/002_variants_and_images.sql`
3. `db/migrations/003_payment_method.sql`
4. `db/seed.sql`
5. `node db/seed-image.mjs` (loads the real product photo)

## Admin panel

`/admin.html` — password-protected (see `ADMIN_PASSWORD_HASH` below). Add/edit/remove products, upload multiple photos per product, add color variants (each can have its own photo), set discounts, and view/manage orders.

To generate a new admin password hash:

```bash
node scripts/hash-password.mjs "your new password"
```

Put the output in `ADMIN_PASSWORD_HASH` (locally in `.env`, and in Vercel's Project Settings → Environment Variables).

## Environment variables

See `.env.example` for the full list. On Vercel, set the same variables in Project Settings → Environment Variables, then redeploy.

## Deploying

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. On [vercel.com](https://vercel.com), "Add New Project" → import this repo → Framework preset "Other" → Deploy.
3. Add the environment variables (Project Settings → Environment Variables) and redeploy.

## Folder structure

- `*.html` — site pages (static)
- `assets/` — CSS, JS, images
- `api/` — serverless functions (products, orders, geocoding, admin)
- `db/` — schema, migrations, seed data, one-off scripts
- `scripts/` — local dev server + admin password hashing helper
