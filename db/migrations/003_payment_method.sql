-- Lebanon storefront: cash on delivery is currently the only payment method,
-- but store it explicitly so a future method doesn't require another migration.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash_on_delivery';
