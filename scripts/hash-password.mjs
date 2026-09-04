// Generates an ADMIN_PASSWORD_HASH value for .env / Vercel env vars.
// Usage: node scripts/hash-password.mjs "the chosen password"
import crypto from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "your password"');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(password, salt, 64).toString("hex");
console.log(`${salt}:${hash}`);
