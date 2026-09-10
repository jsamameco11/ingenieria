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
    and (
      table_name like '%user%'
      or table_name like '%extract%'
      or table_name like '%profession%'
      or table_name like '%question%'
      or table_name like '%scoring%'
      or table_name like '%interest%'
    )
  order by 1
`);
console.log("TABLES", r.rows.map((x) => x.table_name).join(", "));
const fn = await client.query(`
  select n.nspname, p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private')
    and (
      p.proname like '%touch_platform%'
      or p.proname like '%aggregate_user%'
      or p.proname like '%submit_extraction%'
      or p.proname like '%is_admin%'
      or p.proname like '%setting_num%'
    )
  order by 1, 2
`);
console.log("FNS", fn.rows.map((x) => `${x.nspname}.${x.proname}`).join(", "));
await client.end();
