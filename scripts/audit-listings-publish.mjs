/**
 * Auditoría: políticas RLS listings + filas públicas + origen.
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

const rls = await client.query(`
  select c.relname as table, c.relrowsecurity as rls_on
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('listings','listing_threads','listing_messages')
`);
console.log("=== RLS flags ===");
console.log(rls.rows);

const pols = await client.query(`
  select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
  where tablename in ('listings','listing_threads','listing_messages')
  order by tablename, policyname
`);
console.log("=== Policies ===");
for (const p of pols.rows) {
  console.log(JSON.stringify({
    table: p.tablename,
    name: p.policyname,
    cmd: p.cmd,
    roles: p.roles,
    using: p.qual,
    check: p.with_check,
  }));
}

const grants = await client.query(`
  select grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema='public' and table_name='listings'
    and grantee in ('anon','authenticated','public','service_role')
  order by grantee, privilege_type
`);
console.log("=== Grants listings ===");
console.log(grants.rows);

const cols = await client.query(`
  select column_name, is_nullable, data_type
  from information_schema.columns
  where table_schema='public' and table_name='listings'
  order by ordinal_position
`);
console.log("=== Columns ===");
console.log(cols.rows.map((r) => `${r.column_name}:${r.data_type}${r.is_nullable === "NO" ? "!" : ""}`).join(", "));

const rows = await client.query(`
  select id, name, kind, active, hidden, origin_app, offer_kind, category,
         seller_email, user_id::text, visible_until, created_at
  from public.listings
  order by created_at desc nulls last
  limit 20
`);
console.log("=== Listings sample ===");
console.log(JSON.stringify(rows.rows, null, 2));

const counts = await client.query(`
  select
    count(*)::int as total,
    count(*) filter (where active and not hidden and coalesce(kind,'product')='product')::int as vitrina_product,
    count(*) filter (where origin_app = 'ingenieria')::int as from_ingenieria,
    count(*) filter (where origin_app = 'folio-pdf' or origin_app is null)::int as from_folio_or_null,
    count(*) filter (where visible_until is not null and visible_until <= now())::int as expired
  from public.listings
`);
console.log("=== Counts ===");
console.log(counts.rows[0]);

const storage = await client.query(`
  select id, name, public from storage.buckets where id in ('listings','ads')
`);
console.log("=== Storage buckets ===");
console.log(storage.rows);

const storPol = await client.query(`
  select policyname, cmd, qual, with_check
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and (qual ilike '%listings%' or with_check ilike '%listings%' or qual ilike '%ads%' or with_check ilike '%ads%' or policyname ilike '%listing%' or policyname ilike '%ads%')
`);
console.log("=== Storage policies (listings/ads) ===");
console.log(storPol.rows);

await client.end();
