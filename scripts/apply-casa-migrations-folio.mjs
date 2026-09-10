/**
 * Applies Casa de la Palabra's casa_* migrations (1-11) to the Folio PDF
 * Supabase project, inside a single transaction (all-or-nothing). Reads
 * DATABASE_URL from Folio's own license-server/.env — never copies it
 * anywhere. Run check-casa-folio-conflicts.mjs first.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import dns from "node:dns/promises";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
const FOLIO_REF = "qfvgksstvdrxcugbdwkv";
const MIGRATIONS_DIR = "C:/Users/Renzo/Desktop/APP BIBLIAS/casa-de-la-palabra-database/supabase/migrations";

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

function splitSql(sql) {
  const parts = [];
  let buf = "";
  let i = 0;
  let inDollar = null;
  let inSingle = false; // inside a '...' string literal (handles '' escapes)
  let inDouble = false; // inside a "..." quoted identifier
  while (i < sql.length) {
    if (!inDollar && !inSingle && !inDouble && sql[i] === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
      continue;
    }
    if (!inDollar && !inDouble && sql[i] === "'") {
      // toggle string state, but '' inside a string is an escaped quote, not a close
      if (inSingle && sql[i + 1] === "'") {
        buf += "''";
        i += 2;
        continue;
      }
      inSingle = !inSingle;
      buf += sql[i];
      i += 1;
      continue;
    }
    if (!inDollar && !inSingle && sql[i] === '"') {
      inDouble = !inDouble;
      buf += sql[i];
      i += 1;
      continue;
    }
    if (!inDollar && !inSingle && !inDouble) {
      const rest = sql.slice(i);
      const dollar = rest.match(/^\$[A-Za-z0-9_]*\$/);
      if (dollar) {
        const tag = dollar[0];
        if (inDollar === tag) inDollar = null;
        else if (!inDollar) inDollar = tag;
        buf += tag;
        i += tag.length;
        continue;
      }
    }
    if (!inDollar && !inSingle && !inDouble && sql[i] === ";") {
      const stmt = buf.trim();
      if (stmt) parts.push(stmt);
      buf = "";
      i += 1;
      continue;
    }
    buf += sql[i];
    i += 1;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

async function tryClient(cfg) {
  const client = new Client({ ...cfg, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  await client.connect();
  return client;
}

const env = loadEnv(FOLIO_ENV);
const databaseUrl = String(env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.error("Falta DATABASE_URL en Folio license-server/.env");
  process.exit(1);
}

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
    console.log("FALLA", c.host + ":" + c.port, String(e.message || e).slice(0, 140).replace(/\s+/g, " "));
  }
}

if (!client) {
  console.error("No se pudo conectar a Postgres de Folio (directo ni pooler).");
  process.exit(1);
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`\nMigraciones a aplicar (${files.length}):`);
files.forEach((f) => console.log(" -", f));

try {
  await client.query("begin");
  for (const file of files) {
    const sql = readFileSync(`${MIGRATIONS_DIR}/${file}`, "utf8");
    const statements = splitSql(sql);
    console.log(`\nAplicando ${file}: ${statements.length} sentencias…`);
    for (const statement of statements) {
      try {
        await client.query(statement);
      } catch (error) {
        console.error(`\nERROR en ${file}: ${error.message}`);
        console.error(statement.slice(0, 300).replace(/\s+/g, " "));
        await client.query("rollback");
        console.error("\nROLLBACK completo — nada quedó aplicado.");
        process.exit(1);
      }
    }
  }
  await client.query("commit");
  console.log("\nCOMMIT completo. Todas las migraciones se aplicaron.");

  const probe = await client.query(`
    select
      (select count(*)::int from information_schema.tables where table_schema='public' and table_name like 'casa_%') as casa_tables,
      (select count(*)::int from casa_bible_books) as bible_books,
      (select count(*)::int from casa_rebet_questions) as rebet_questions,
      (select count(*)::int from casa_lingobible_lessons) as lingobible_lessons,
      (select count(*)::int from casa_impostor_words) as impostor_words,
      (select count(*)::int from casa_profiles) as profiles
  `);
  console.log("\n=== VERIFICACIÓN ===");
  console.table(probe.rows[0]);
} finally {
  await client.end();
}
