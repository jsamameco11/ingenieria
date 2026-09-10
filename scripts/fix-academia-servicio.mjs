/**
 * Fuerza Mi Academia Pre U como servicio.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
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
const r = await client.query(`
  update public.listings
  set
    offer_kind = 'servicio',
    item_condition = null,
    category = case when category = 'Oficina' then 'Educación' else category end
  where id = 'dedfba2f-07fd-41ab-86e6-6080c7248ad2'
     or lower(coalesce(name, '')) ~ 'academia\\s*pre'
  returning id, name, offer_kind, category, item_condition
`);
console.log(JSON.stringify(r.rows, null, 2));
await client.end();
