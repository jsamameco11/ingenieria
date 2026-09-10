/**
 * Aplica el parche RLS (sin recursión) de memorcalc_budgets en Folio.
 * Lee DATABASE_URL de Folio license-server/.env
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
const FOLIO_REF = "qfvgksstvdrxcugbdwkv";
const SQL_FILE = join(ROOT, "supabase", "memorcalc-billing-rls-fix.sql");

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
  while (i < sql.length) {
    if (!inDollar && sql[i] === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
      continue;
    }
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
    if (!inDollar && sql[i] === ";") {
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
  const client = new Client({
    ...cfg,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  });
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
  ...["aws-0-us-east-1.pooler.supabase.com", "aws-1-us-east-1.pooler.supabase.com", "aws-0-us-east-2.pooler.supabase.com"].flatMap(
    (host) => [
      { label: `${host}:5432`, host, port: 5432, user: poolUser },
      { label: `${host}:6543`, host, port: 6543, user: poolUser },
    ],
  ),
];

let client = null;
let used = "";
for (const c of candidates) {
  try {
    client = await tryClient({ host: c.host, port: c.port, user: c.user, password });
    used = c.label;
    break;
  } catch (e) {
    console.warn("fail", c.label, e instanceof Error ? e.message : e);
  }
}
if (!client) {
  console.error("No se pudo conectar a Postgres Folio");
  process.exit(1);
}
console.log("conectado", used);

const sql = readFileSync(SQL_FILE, "utf8");
for (const stmt of splitSql(sql)) {
  process.stdout.write(`→ ${stmt.slice(0, 70).replace(/\s+/g, " ")}… `);
  await client.query(stmt);
  console.log("ok");
}
await client.end();
console.log("RLS_FIX_OK");
