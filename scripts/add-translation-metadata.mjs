/**
 * Adds/updates casa_bible_translations metadata rows only (no verse text)
 * for translations Renzo asked about by name. The copyrighted ones stay
 * is_active = false (never shown in the public selector) with an explicit
 * license_notes explaining what's needed — visible to editors in the admin
 * so it's a tracked roadmap item, not silently dropped.
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

async function connect() {
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
  for (const c of candidates) {
    try {
      await dns.lookup(c.host);
    } catch {
      continue;
    }
    try {
      const client = await tryClient({ host: c.host, port: c.port, user: c.user, password });
      console.log("CONECTADO", c.label, `${c.host}:${c.port}`);
      return client;
    } catch (e) {
      console.log("FALLA", c.host + ":" + c.port, String(e.message || e).slice(0, 140).replace(/\s+/g, " "));
    }
  }
  throw new Error("No se pudo conectar a Postgres de Folio.");
}

const client = await connect();
try {
  const { rows: langs } = await client.query("select id, code from casa_bible_languages");
  const langId = Object.fromEntries(langs.map((l) => [l.code, l.id]));

  const entries = [
    {
      code: "NTV",
      name: "Nueva Traducción Viviente",
      short_name: "NTV",
      license_type: "proprietary_stored",
      license_notes: "Copyright Tyndale House Foundation — requiere licencia comercial antes de importar texto.",
    },
    {
      code: "PDT",
      name: "Palabra de Dios para Todos",
      short_name: "PDT",
      license_type: "proprietary_stored",
      license_notes: "Copyright Centro Mundial de Traducción de la Biblia — requiere licencia antes de importar texto.",
    },
    {
      code: "DHH",
      name: "Dios Habla Hoy (Biblia al Día)",
      short_name: "DHH",
      license_type: "proprietary_stored",
      license_notes: "Copyright Sociedades Bíblicas Unidas — requiere licencia antes de importar texto.",
    },
  ];

  for (const e of entries) {
    await client.query(
      `insert into casa_bible_translations (language_id, code, name, short_name, license_type, license_notes, is_active, position)
       values ($1, $2, $3, $4, $5, $6, false, 99)
       on conflict (code) do update set
         name = excluded.name, short_name = excluded.short_name,
         license_type = excluded.license_type, license_notes = excluded.license_notes`,
      [langId["es"], e.code, e.name, e.short_name, e.license_type, e.license_notes]
    );
    console.log("OK", e.code);
  }

  const { rows } = await client.query(
    "select code, name, license_type, is_active from casa_bible_translations order by position, code"
  );
  console.table(rows);
} finally {
  await client.end();
}
