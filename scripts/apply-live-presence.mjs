import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { Client } = createRequire(import.meta.url)("pg");

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const folio = resolve("C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf");
const env = loadEnv(resolve(folio, "license-server/.env"));
const sql = readFileSync(resolve(folio, "supabase/migrations/20260922030000_live_master_presence.sql"), "utf8");
if (!env.DATABASE_URL) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

const url = new URL(env.DATABASE_URL);
const client = new Client({
  host: url.hostname,
  port: Number(url.port || 5432),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, "") || "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

await client.connect();
try {
  await client.query(sql);
  const plats = await client.query(
    "select platform_code from public.platforms where status = 'live' order by platform_code",
  );
  const sess = await client.query("select count(*)::int as n from public.user_sessions");
  const up = await client.query("select count(*)::int as n from public.user_platforms");
  console.log("ok platforms", plats.rows.map((row) => row.platform_code).join(","));
  console.log("user_platforms", up.rows[0].n, "user_sessions", sess.rows[0].n);
} finally {
  await client.end();
}
