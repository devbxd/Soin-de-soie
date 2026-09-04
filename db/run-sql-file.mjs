// One-off helper: runs a .sql file against DATABASE_URL.
// Usage: node db/run-sql-file.mjs db/schema.sql
import { Pool } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node db/run-sql-file.mjs <path-to-sql-file>");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const content = await readFile(filePath, "utf8");

await pool.query(content);
await pool.end();

console.log(`Ran ${filePath}`);
