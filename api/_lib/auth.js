import crypto from "node:crypto";
import { parse, serialize } from "cookie";

const COOKIE_NAME = "sds_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hmac(value) {
  return crypto.createHmac("sha256", process.env.SESSION_SECRET).update(value).digest("hex");
}

export function verifyPassword(password) {
  const [salt, hash] = (process.env.ADMIN_PASSWORD_HASH || "").split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(candidate, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function createSessionCookie() {
  const expiry = Date.now() + SESSION_TTL_MS;
  const signature = hmac(String(expiry));
  const value = `${expiry}.${signature}`;
  return serialize(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie() {
  return serialize(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export function isAuthenticated(req) {
  const cookies = parse(req.headers.cookie || "");
  const value = cookies[COOKIE_NAME];
  if (!value) return false;
  const [expiry, signature] = value.split(".");
  if (!expiry || !signature) return false;
  if (Number(expiry) < Date.now()) return false;
  return hmac(expiry) === signature;
}

// Wraps a handler so it 401s unless the admin session cookie is valid.
export function requireAdmin(handler) {
  return async (req, res) => {
    if (!isAuthenticated(req)) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    return handler(req, res);
  };
}
