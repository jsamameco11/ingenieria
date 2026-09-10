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
const tables = await client.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_name like 'memorcalc_%'
  order by 1
`);
console.log("TABLAS", tables.rows.map((r) => r.table_name).join(", "));
const grants = await client.query(`
  select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privs
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name in (
    'memorcalc_plans','memorcalc_payments','memorcalc_budgets','memorcalc_budget_members','memorcalc_pdf_jobs'
  )
  group by 1, 2
  order by 1, 2
`);
for (const r of grants.rows) console.log(`${r.table_name} | ${r.grantee} | ${r.privs}`);
const policies = await client.query(`
  select tablename, policyname from pg_policies
  where schemaname = 'public' and tablename like 'memorcalc_%'
  order by 1, 2
`);
console.log("POLICIES", policies.rows.length);
const funcs = await client.query(`
  select routine_name from information_schema.routines
  where routine_schema = 'public' and routine_name like 'memorcalc_%'
  order by 1
`);
console.log("FUNCS", funcs.rows.map((r) => r.routine_name).join(", "));
await client.end();
