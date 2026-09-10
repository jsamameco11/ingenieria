/**
 * Marks NTV as a live api_passthrough translation now that Renzo's
 * api.bible key confirms real access to it, and updates RVR1960's notes
 * with the precise next step (it's NOT yet available in his api.bible
 * account — needs a specific request, unlike NTV which came included).
 * Does not insert/store any verse text — that stays forbidden for
 * copyrighted translations; only metadata changes here.
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
  const parsed = new URL(env.DATABASE_URL);
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
  await client.query(
    `update casa_bible_translations set
       license_type = 'api_passthrough',
       is_active = true,
       external_provider = 'api.bible',
       external_identifier = $1,
       license_notes = 'Licencia confirmada vía api.bible (cuenta de Renzo, plan gratuito no comercial). Texto servido en vivo, nunca almacenado. Copyright obligatorio: Santa Biblia, Nueva Traducción Viviente, © 2010 Tyndale House Foundation. Usado con permiso de Tyndale House Publishers.'
     where code = 'NTV'`,
    ["826f63861180e056-01"]
  );
  console.log("NTV actualizada: api_passthrough, activa, bibleId 826f63861180e056-01");

  await client.query(
    `update casa_bible_translations set
       license_notes = 'Copyright Sociedades Bíblicas Unidas. Renzo ya tiene cuenta en api.bible (mismo plan que sirve NTV) pero RVR1960 NO aparece en su catálogo actual — falta solicitar acceso específico desde su dashboard de api.bible o escribiendo a support@api.bible. Una vez aprobado, activar igual que NTV (api_passthrough).'
     where code = 'RVR1960'`
  );
  console.log("RVR1960: notas actualizadas con el paso pendiente concreto.");

  const { rows } = await client.query(
    "select code, name, license_type, is_active, external_provider, external_identifier from casa_bible_translations order by position, code"
  );
  console.table(rows);
} finally {
  await client.end();
}
