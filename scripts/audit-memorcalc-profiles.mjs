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
  port: 5432,
  user: "postgres.qfvgksstvdrxcugbdwkv",
  password: decodeURIComponent(u.password),
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const cols = await client.query(`
  select column_name, data_type
  from information_schema.columns
  where table_schema='public' and table_name='memorcalc_profiles'
  order by ordinal_position
`);
console.log("COLS", cols.rows.map((r) => `${r.column_name}:${r.data_type}`).join(" | "));
const n = await client.query(`select count(*)::int as n from public.memorcalc_profiles`);
console.log("COUNT", n.rows[0].n);
const sample = await client.query(`
  select user_id, email, craft_family, profession_id, workplace_role, practice_mode,
         onboarding_done, age, specialty_focus, department, district
  from public.memorcalc_profiles
  order by updated_at desc nulls last
  limit 8
`);
console.log("ROWS", JSON.stringify(sample.rows, null, 2));
const pol = await client.query(`
  select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr
  from pg_policy where polrelid = 'public.memorcalc_profiles'::regclass
`);
console.log("POL", JSON.stringify(pol.rows));
await client.end();
