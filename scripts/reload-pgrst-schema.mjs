import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const env = {};
for (const line of readFileSync(
  "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env",
  "utf8"
).split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq < 1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const parsed = new URL(env.DATABASE_URL);
const client = new Client({
  host: parsed.hostname,
  port: Number(parsed.port || 5432),
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();
await client.query("NOTIFY pgrst, 'reload schema'");
console.log("Schema reload notified.");
await client.end();
