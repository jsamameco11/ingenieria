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

const wanted = [
  "profiles",
  "installs",
  "install_accounts",
  "user_identities",
  "user_tastes",
  "user_profession_scores",
  "user_category_scores",
  "identity_categories",
  "identity_taste_catalog",
  "listings",
  "listing_reach",
  "listing_threads",
  "listing_messages",
  "memorcalc_profiles",
  "memorcalc_plans",
  "memorcalc_device_lock",
  "memorcalc_budgets",
  "memorcalc_payments",
  "memorcalc_insights",
  "memorcalc_budget_members",
  "memorcalc_pdf_jobs",
];

const existing = await client.query(`
  select table_name from information_schema.tables
  where table_schema = 'public' and table_name = any($1::text[])
  order by 1
`, [wanted]);
const have = new Set(existing.rows.map((r) => r.table_name));
console.log("EXISTEN", [...have].join(", "));
console.log("FALTAN", wanted.filter((t) => !have.has(t)).join(", ") || "(ninguna)");

for (const t of wanted) {
  if (!have.has(t)) {
    console.log(`COUNT ${t} MISSING`);
    continue;
  }
  const n = await client.query(`select count(*)::int as n from public.${t}`);
  console.log(`COUNT ${t} ${n.rows[0].n}`);
}

const authN = await client.query(`select count(*)::int as n from auth.users`);
console.log(`COUNT auth.users ${authN.rows[0].n}`);

if (have.has("installs")) {
  const apps = await client.query(`select coalesce(nullif(app,''),'folio-pdf') as app, count(*)::int as n from public.installs group by 1 order by 2 desc`);
  console.log("INSTALL_APPS", JSON.stringify(apps.rows));
}
if (have.has("listings")) {
  const kinds = await client.query(`select kind, count(*)::int as n from public.listings group by 1`);
  console.log("LISTING_KINDS", JSON.stringify(kinds.rows));
  const origin = await client.query(`
    select column_name from information_schema.columns
    where table_schema='public' and table_name='listings' and column_name in ('origin_app','origin')
  `);
  console.log("LISTING_ORIGIN_COLS", origin.rows.map((r) => r.column_name).join(",") || "(no)");
}
if (have.has("profiles")) {
  const plans = await client.query(`select plan, status, count(*)::int as n from public.profiles group by 1,2 order by 3 desc`);
  console.log("FOLIO_PLANS", JSON.stringify(plans.rows));
}
if (have.has("memorcalc_plans")) {
  const plans = await client.query(`select plan, count(*)::int as n from public.memorcalc_plans group by 1`);
  console.log("MC_PLANS", JSON.stringify(plans.rows));
}

await client.end();
