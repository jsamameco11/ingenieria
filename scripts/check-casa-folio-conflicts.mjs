/**
 * Read-only conflict check against the Folio PDF Supabase project before
 * applying Casa de la Palabra's casa_* migrations there. Prints only
 * object names — never the connection string or password.
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

try {
  const tables = await client.query(
    "select table_name from information_schema.tables where table_schema='public' order by 1"
  );
  const functions = await client.query(
    "select distinct p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1"
  );
  const types = await client.query(
    "select typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e' order by 1"
  );
  const buckets = await client.query("select id from storage.buckets order by 1");
  const googleIdentities = await client.query(
    "select count(*)::int as c from auth.identities where provider = 'google'"
  );
  const memorcalcTables = tables.rows.filter((r) => r.table_name.startsWith("memorcalc_"));

  const casaNames = [
    "casa_profiles", "casa_audit_logs", "casa_site_settings", "casa_devotionals",
    "casa_navigation_items", "casa_bible_languages", "casa_bible_translations",
    "casa_studies", "casa_videos", "casa_podcast_episodes", "casa_courses",
    "casa_conferences", "casa_gamification_profiles", "casa_xp_transactions",
    "casa_levels", "casa_badges", "casa_rebet_categories", "casa_rebet_questions",
    "casa_lingobible_paths", "casa_impostor_categories", "casa_impostor_words",
    "casa_impostor_rooms", "casa_game_sessions",
  ];
  const casaFunctions = [
    "casa_is_admin", "casa_is_editor", "casa_is_staff", "casa_has_role",
    "casa_current_role", "casa_set_updated_at", "casa_handle_new_user",
    "casa_award_xp", "casa_immutable_unaccent",
  ];
  const casaBuckets = [
    "casa-site-assets", "casa-bible-assets", "casa-studies", "casa-videos",
    "casa-podcasts", "casa-courses", "casa-conferences", "casa-games",
    "casa-avatars", "casa-badges",
  ];

  const existingTableNames = new Set(tables.rows.map((r) => r.table_name));
  const existingFnNames = new Set(functions.rows.map((r) => r.proname));
  const existingBucketIds = new Set(buckets.rows.map((r) => r.id));

  const tableConflicts = casaNames.filter((n) => existingTableNames.has(n));
  const fnConflicts = casaFunctions.filter((n) => existingFnNames.has(n));
  const bucketConflicts = casaBuckets.filter((n) => existingBucketIds.has(n));
  const typeConflicts = ["casa_user_role", "casa_content_status", "casa_bible_license_type"].filter((n) =>
    types.rows.some((r) => r.typname === n)
  );

  console.log("\n=== RESUMEN ===");
  console.log("Tablas existentes en public:", tables.rows.length);
  console.log("Tablas memorcalc_*:", memorcalcTables.map((r) => r.table_name).join(", ") || "(ninguna)");
  console.log("Funciones existentes en public:", functions.rows.length);
  console.log("Buckets de storage existentes:", buckets.rows.map((r) => r.id).join(", ") || "(ninguno)");
  console.log("Identidades con provider=google en auth.identities:", googleIdentities.rows[0].c);
  console.log("\n--- Conflictos con nombres casa_* planeados ---");
  console.log("Tablas en conflicto:", tableConflicts.join(", ") || "NINGUNO");
  console.log("Funciones en conflicto:", fnConflicts.join(", ") || "NINGUNO");
  console.log("Buckets en conflicto:", bucketConflicts.join(", ") || "NINGUNO");
  console.log("Tipos/enums en conflicto:", typeConflicts.join(", ") || "NINGUNO");

  const clean = tableConflicts.length === 0 && fnConflicts.length === 0 && bucketConflicts.length === 0 && typeConflicts.length === 0;
  console.log("\nSAFE_TO_PROCEED=" + clean);
} finally {
  await client.end();
}
