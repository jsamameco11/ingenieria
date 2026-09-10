import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FOLIO_SQL = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/supabase/migrations/20260907022000_master_extraction.sql";
const ING_SQL = join(ROOT, "supabase", "migrations", "20260907023000_ingenieria_extraction.sql");
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
  port: 5432,
  user: "postgres.qfvgksstvdrxcugbdwkv",
  password: decodeURIComponent(u.password),
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  statement_timeout: 180000,
});

async function runFile(label, path) {
  const sql = readFileSync(path, "utf8");
  console.log("APPLY", label, sql.length, "chars");
  await client.query(sql);
  console.log("DONE", label);
}

await client.connect();
try {
  const has = await client.query(`
    select to_regclass('public.extraction_settings') as settings,
           to_regclass('public.question_definitions') as questions
  `);
  if (!has.rows[0].settings) {
    await runFile("folio-extraction", FOLIO_SQL);
  } else {
    console.log("SKIP folio-extraction (extraction_settings exists)");
  }
  if (!has.rows[0].questions) {
    await runFile("ingenieria-extraction", ING_SQL);
  } else {
    console.log("SKIP ingenieria-extraction (question_definitions exists) — reapplying anyway");
    await runFile("ingenieria-extraction", ING_SQL);
  }
  const tables = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'question_definitions','user_answers','entity_aliases','scoring_models',
        'extraction_evidence','extraction_settings','profile_completeness'
      )
    order by 1
  `);
  const qn = await client.query(`select count(*)::int as n from public.question_definitions`);
  const an = await client.query(`select count(*)::int as n from public.entity_aliases`);
  const fn = await client.query(`
    select routine_name from information_schema.routines
    where routine_schema = 'public'
      and routine_name in (
        'submit_platform_extraction','get_user_360_bundle','recalculate_profile_completeness',
        'explain_interest_score','submit_extraction_bundle','aggregate_user_profile_from_evidence'
      )
    order by 1
  `);
  console.log("TABLAS", tables.rows.map((r) => r.table_name).join(","));
  console.log("PREGUNTAS", qn.rows[0].n);
  console.log("ALIASES", an.rows[0].n);
  console.log("RPC", fn.rows.map((r) => r.routine_name).join(","));
  console.log("OK");
} catch (err) {
  console.error("FAIL", String(err && err.message ? err.message : err).slice(0, 1200));
  process.exit(1);
} finally {
  await client.end();
}
