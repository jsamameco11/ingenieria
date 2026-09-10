/**
 * Fix: casa_* tables/views created via a direct Postgres migration never got
 * the standard Supabase bootstrap grants (SELECT/INSERT/UPDATE/DELETE to
 * anon/authenticated) that PostgREST needs before RLS policies even apply.
 * Reuses the same Folio connection convention as apply-casa-migrations-folio.mjs.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import dns from "node:dns/promises";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
const FOLIO_REF = "qfvgksstvdrxcugbdwkv";

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

async function tryClient(cfg) {
  const client = new Client({ ...cfg, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  await client.connect();
  return client;
}

const env = loadEnv(FOLIO_ENV);
const databaseUrl = String(env.DATABASE_URL || "").trim();
const parsed = new URL(databaseUrl);
const password = decodeURIComponent(parsed.password);
const directUser = decodeURIComponent(parsed.username);
const poolUser = `postgres.${FOLIO_REF}`;

const candidates = [
  { label: "direct", host: parsed.hostname, port: Number(parsed.port || 5432), user: directUser },
  ...[
    "aws-0-us-east-1.pooler.supabase.com",
    "aws-0-us-east-2.pooler.supabase.com",
    "aws-0-us-west-2.pooler.supabase.com",
    "aws-1-us-west-2.pooler.supabase.com",
    "aws-0-sa-east-1.pooler.supabase.com",
  ].flatMap((host) => [
    { label: "pooler-tx", host, port: 6543, user: poolUser },
    { label: "pooler-session", host, port: 5432, user: poolUser },
  ]),
];

let client = null;
for (const c of candidates) {
  try {
    await dns.lookup(c.host);
  } catch {
    continue;
  }
  try {
    client = await tryClient({ host: c.host, port: c.port, user: c.user, password });
    console.log("CONECTADO", c.label, `${c.host}:${c.port}`);
    break;
  } catch (e) {
    console.log("FALLA", c.host + ":" + c.port, String(e.message || e).slice(0, 140));
  }
}
if (!client) {
  console.error("No se pudo conectar.");
  process.exit(1);
}

try {
  await client.query("begin");

  // Only casa_* relations (tables + views) — never touches other apps' objects.
  const { rows } = await client.query(`
    select table_name, table_type
    from information_schema.tables
    where table_schema = 'public' and table_name like 'casa_%'
  `);
  console.log(`Relaciones casa_* encontradas: ${rows.length}`);

  for (const { table_name } of rows) {
    await client.query(`grant select, insert, update, delete on table public.${table_name} to anon, authenticated`);
  }

  const { rows: seqs } = await client.query(`
    select sequence_name from information_schema.sequences
    where sequence_schema = 'public' and sequence_name like 'casa_%'
  `);
  console.log(`Secuencias casa_* encontradas: ${seqs.length}`);
  for (const { sequence_name } of seqs) {
    await client.query(`grant usage, select on sequence public.${sequence_name} to anon, authenticated`);
  }

  await client.query("commit");
  console.log("COMMIT completo — grants aplicados.");

  const probe = await client.query(`
    select grantee, count(*)::int as tablas
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name like 'casa_%' and grantee in ('anon','authenticated') and privilege_type = 'SELECT'
    group by grantee
  `);
  console.table(probe.rows);
} catch (e) {
  await client.query("rollback");
  console.error("ERROR, rollback:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
