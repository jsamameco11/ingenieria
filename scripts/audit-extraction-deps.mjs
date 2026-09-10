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
  select table_name from information_schema.tables
  where table_schema='public'
    and table_name in (
      'data_sources','platforms','extraction_settings','extraction_evidence',
      'engagement_weights','restricted_attributes','extraction_documents',
      'user_360_evidence'
    )
  order by 1
`);
console.log("NEED", r.rows.map((x) => x.table_name).join(", ") || "(ninguna)");
const ds = await client.query(`
  select column_name from information_schema.columns
  where table_schema='public' and table_name='data_sources' order by 1
`);
console.log("data_sources cols", ds.rows.map((x) => x.column_name).join(","));
const plat = await client.query(`select platform_code from public.platforms order by 1`);
console.log("PLATFORMS", plat.rows.map((x) => x.platform_code).join(","));
await client.end();
