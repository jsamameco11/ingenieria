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

const cols = await client.query(`
  select column_name, data_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'listings'
  order by ordinal_position`);
console.log("COLUMNS", cols.rows.map((r) => r.column_name).join(", "));

const cnt = await client.query(`
  select kind, active, hidden,
    count(*)::int as n,
    count(*) filter (where visible_until is null or visible_until > now())::int as visible_ok
  from listings
  group by 1, 2, 3
  order by 1, 2, 3`);
console.log("COUNTS");
console.log(cnt.rows);

const sample = await client.query(`
  select id::text, kind, left(name, 40) as name, active, hidden,
    visible_until, visibility_source, left(seller_name, 24) as seller, created_at
  from listings
  order by created_at desc
  limit 10`);
console.log("SAMPLE");
console.log(sample.rows);

const thr = await client.query(`select count(*)::int as n from listing_threads`);
const msg = await client.query(`select count(*)::int as n from listing_messages`);
console.log("threads", thr.rows[0].n, "messages", msg.rows[0].n);

const policies = await client.query(`
  select tablename, policyname, cmd
  from pg_policies
  where schemaname = 'public'
    and tablename in ('listings', 'listing_threads', 'listing_messages')
  order by 1, 2`);
console.log("POLICIES");
console.log(policies.rows);

await client.end();
