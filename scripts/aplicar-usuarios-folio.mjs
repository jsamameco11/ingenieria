/**
 * Aplica tablas de usuarios y billing MemoriaCalc en la base Folio PDF.
 * Lee DATABASE_URL de Folio (license-server/.env). No copia secretos a este repo.
 *
 * Si db.*.supabase.co no resuelve (redes locales), prueba el pooler de Supabase.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns/promises";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
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
    connectionTimeoutMillis: 10000,
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
  {
    label: "direct",
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    user: directUser,
  },
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
    console.log("DNS_SKIP", c.host);
    continue;
  }
  try {
    client = await tryClient({
      host: c.host,
      port: c.port,
      user: c.user,
      password,
    });
    console.log("CONECTADO", c.label, `${c.user}@${c.host}:${c.port}`);
    break;
  } catch (e) {
    console.log("FALLA", c.host + ":" + c.port, String(e.message || e).slice(0, 140).replace(/\s+/g, " "));
  }
}

if (!client) {
  console.error("No se pudo conectar a Postgres Folio (directo ni pooler).");
  process.exit(1);
}

const files = ["memorcalc-users.sql", "memorcalc-quotas-onboarding.sql", "memorcalc-billing.sql", "memorcalc-device-lock.sql", "memorcalc-admin.sql"];
try {
  for (const file of files) {
    const sql = readFileSync(join(ROOT, "supabase", file), "utf8");
    const statements = splitSql(sql);
    console.log(`Aplicando ${file}: ${statements.length} sentencias…`);
    for (const statement of statements) {
      try {
        await client.query(statement);
      } catch (error) {
        console.error(`SQL (${file}): ${error.message}`);
        console.error(statement.slice(0, 220).replace(/\s+/g, " "));
        process.exitCode = 1;
        throw error;
      }
    }
  }
  const probe = await client.query(
    "select to_regclass('public.memorcalc_profiles') as t, to_regclass('public.memorcalc_plans') as p, to_regclass('public.memorcalc_budgets') as b, to_regclass('public.memorcalc_device_lock') as d",
  );
  console.log("memorcalc_profiles:", probe.rows[0]?.t || "NO");
  console.log("memorcalc_plans:", probe.rows[0]?.p || "NO");
  console.log("memorcalc_budgets:", probe.rows[0]?.b || "NO");
  console.log("memorcalc_device_lock:", probe.rows[0]?.d || "NO");
  console.log("Listo. Usuarios de MemoriaCalc = auth.users de Folio PDF.");
} finally {
  await client.end();
}
