// Local dev-only server: serves the static site AND runs the /api serverless
// functions (same handler files Vercel will run in production), so the whole
// site can be tested on one machine before a Vercel account is linked.
// Not deployed — Vercel only picks up files matching its own routing rules.
//
// Usage: node scripts/dev-server.mjs   (reads .env for DATABASE_URL etc.)

import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PORT = process.env.PORT || 5600;

// Minimal .env loader (no dependency): KEY=VALUE per line, ignores blanks/comments.
const envPath = path.join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
process.env.NODE_ENV = process.env.NODE_ENV || "development";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function makeRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  };
  res.send = (body) => { res.end(body); };
  return res;
}

// Mimics Vercel's file-based /api routing: dynamic [param] segments, nested
// dynamic folders, and catch-all [...param].js routes.
function resolveApiFile(parts) {
  let dir = path.join(root, "api");
  const params = {};

  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    const isLast = i === parts.length - 1;

    if (!isLast) {
      const literalDir = path.join(dir, seg);
      if (existsSync(literalDir) && statSync(literalDir).isDirectory()) {
        dir = literalDir;
        continue;
      }
      const entries = existsSync(dir) ? readdirSync(dir) : [];
      const bracketDir = entries.find(
        (e) => /^\[[^.].*\]$/.test(e) && statSync(path.join(dir, e)).isDirectory()
      );
      if (bracketDir) {
        params[bracketDir.slice(1, -1)] = seg;
        dir = path.join(dir, bracketDir);
        continue;
      }
      const catchAll = entries.find((e) => /^\[\.\.\..+\]\.js$/.test(e));
      if (catchAll) {
        const paramName = catchAll.slice(4, catchAll.indexOf("]"));
        params[paramName] = parts.slice(i);
        return { file: path.join(dir, catchAll), params };
      }
      return null;
    }

    // last segment
    const literalFile = path.join(dir, seg + ".js");
    if (existsSync(literalFile)) return { file: literalFile, params };

    const literalDir = path.join(dir, seg);
    if (existsSync(literalDir) && statSync(literalDir).isDirectory()) {
      const index = path.join(literalDir, "index.js");
      if (existsSync(index)) return { file: index, params };
    }

    const entries = existsSync(dir) ? readdirSync(dir) : [];
    const bracketFile = entries.find((e) => /^\[[^.][^\]]*\]\.js$/.test(e));
    if (bracketFile) {
      const paramName = bracketFile.slice(1, bracketFile.indexOf("]"));
      params[paramName] = seg;
      return { file: path.join(dir, bracketFile), params };
    }

    const catchAll = entries.find((e) => /^\[\.\.\..+\]\.js$/.test(e));
    if (catchAll) {
      const paramName = catchAll.slice(4, catchAll.indexOf("]"));
      params[paramName] = [seg];
      return { file: path.join(dir, catchAll), params };
    }
  }

  return null;
}

async function handleApi(req, res, pathname) {
  const parts = pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
  const resolved = resolveApiFile(parts);

  if (!resolved) {
    res.status(404).json({ error: "No API route for " + pathname });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const query = { ...resolved.params };
  for (const [k, v] of url.searchParams) query[k] = v;

  let body = "";
  for await (const chunk of req) body += chunk;
  let parsedBody;
  if (body) {
    try { parsedBody = JSON.parse(body); } catch { parsedBody = body; }
  }

  req.query = query;
  req.body = parsedBody;
  makeRes(res);

  const mod = await import(pathToFileURL(resolved.file).href + `?t=${Date.now()}`);
  try {
    await mod.default(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: "Internal error" });
  }
}

async function handleStatic(req, res, pathname) {
  let filePath = path.join(root, pathname === "/" ? "index.html" : pathname);
  if (!existsSync(filePath)) {
    if (existsSync(filePath + ".html")) filePath += ".html";
    else {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
  }
  const ext = path.extname(filePath);
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  res.end(await readFile(filePath));
}

const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  try {
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
    } else {
      await handleStatic(req, res, pathname);
    }
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end("Internal error");
  }
});

server.listen(PORT, () => {
  console.log(`Dev server running at http://127.0.0.1:${PORT}`);
});
