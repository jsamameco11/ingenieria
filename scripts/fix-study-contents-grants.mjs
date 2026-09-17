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
  // casa_study_contents y casa_study_content_verses se crearon por conexión
  // directa (no por la tooling de Supabase), así que nunca recibieron el
  // GRANT base a anon/authenticated que sí tienen el resto de tablas del
  // proyecto — la RLS ya estaba bien, pero sin el grant de tabla PostgREST
  // rechaza todo con "permission denied" antes de evaluar RLS siquiera.
  await client.query(`
    grant select, insert, update, delete on casa_study_contents to anon, authenticated;
    grant select, insert, update, delete on casa_study_content_verses to anon, authenticated;
  `);
  console.log("Grants aplicados.");

  const { rows } = await client.query(`
    select table_name, grantee, privilege_type
    from information_schema.role_table_grants
    where table_schema='public' and table_name in ('casa_study_contents','casa_study_content_verses')
      and grantee in ('anon','authenticated')
    order by table_name, grantee, privilege_type
  `);
  console.table(rows);

  await client.query(`NOTIFY pgrst, 'reload schema'`);
  console.log("Schema reload notificado.");
} finally {
  await client.end();
}
