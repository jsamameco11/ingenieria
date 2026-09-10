import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
const SQL = "C:/Users/Renzo/Desktop/WEB MEMORIAS DESCRIPTIVAS/supabase/plaza-shared.sql";

const env = {};
for (const line of readFileSync(FOLIO_ENV, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}
const u = new URL(env.DATABASE_URL);
const client = new Client({
  host: "aws-0-us-east-1.pooler.supabase.com",
  port: 6543,
  user: "postgres.qfvgksstvdrxcugbdwkv",
  password: decodeURIComponent(u.password),
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(readFileSync(SQL, "utf8"));
const col = await client.query(`
  select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'listings' and column_name = 'origin_app'`);
console.log(col.rows.length ? "OK origin_app" : "FAIL origin_app");
await client.end();
