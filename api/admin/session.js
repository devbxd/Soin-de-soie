import { isAuthenticated } from "../_lib/auth.js";

export default async function handler(req, res) {
  res.status(200).json({ authenticated: isAuthenticated(req) });
}
