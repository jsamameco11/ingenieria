/**
 * Aplica supabase/listings-offer-meta.sql en Folio (listings compartidos).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
const SQL = join(ROOT, "supabase", "listings-offer-meta.sql");

const env = {};
for (const line of readFileSync(FOLIO_ENV, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}
if (!env.DATABASE_URL) throw new Error("Falta DATABASE_URL en folio license-server .env");

const u = new URL(env.DATABASE_URL);
const hosts = [
  "aws-0-us-east-1.pooler.supabase.com",
  "aws-0-us-east-2.pooler.supabase.com",
  "aws-1-us-east-1.pooler.supabase.com",
];

let lastErr = null;
for (const host of hosts) {
  const client = new Client({
    host,
    port: 6543,
    user: "postgres.qfvgksstvdrxcugbdwkv",
    password: decodeURIComponent(u.password),
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  });
  try {
    await client.connect();
    await client.query(readFileSync(SQL, "utf8"));
    const cols = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'listings'
        and column_name in ('offer_kind', 'item_condition')
      order by column_name`);
    const counts = await client.query(`
      select
        count(*)::int as total,
        count(*) filter (where offer_kind = 'servicio')::int as servicios,
        count(*) filter (where offer_kind = 'articulo')::int as articulos
      from public.listings
      where coalesce(kind, 'product') <> 'ad'`);
    console.log("host", host);
    console.log("columns", cols.rows.map((r) => r.column_name).join(", ") || "(none)");
    console.log("counts", counts.rows[0]);
    await client.end();
    process.exit(0);
  } catch (e) {
    lastErr = e;
    try {
      await client.end();
    } catch {
      /* ok */
    }
  }
}
console.error(lastErr);
process.exit(1);
