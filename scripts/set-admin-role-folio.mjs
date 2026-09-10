/**
 * Grants super_admin role in casa_profiles to Renzo's own account, so the
 * new email+password admin login can actually access the panel.
 * Reuses the established Folio Postgres connection convention.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import dns from "node:dns/promises";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
const FOLIO_REF = "qfvgksstvdrxcugbdwkv";
const USER_ID = "12f68ed8-435f-4c2e-a555-8481fa9f6d7a";

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
const parsed = new URL(String(env.DATABASE_URL || "").trim());
const password = decodeURIComponent(parsed.password);
const directUser = decodeURIComponent(parsed.username);
const poolUser = `postgres.${FOLIO_REF}`;

const candidates = [
  { label: "direct", host: parsed.hostname, port: Number(parsed.port || 5432), user: directUser },
  ...["aws-0-us-east-1.pooler.supabase.com", "aws-0-us-east-2.pooler.supabase.com", "aws-0-us-west-2.pooler.supabase.com", "aws-1-us-west-2.pooler.supabase.com", "aws-0-sa-east-1.pooler.supabase.com"].flatMap((host) => [
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
    console.log("CONECTADO", c.label);
    break;
  } catch (e) {
    console.log("FALLA", c.host, String(e.message || e).slice(0, 120));
  }
}
if (!client) {
  console.error("No se pudo conectar.");
  process.exit(1);
}

try {
  const res = await client.query(
    `insert into casa_profiles (id, role) values ($1, 'super_admin')
     on conflict (id) do update set role = 'super_admin'
     returning id, role`,
    [USER_ID],
  );
  console.log("Actualizado:", res.rows[0]);
} finally {
  await client.end();
}
