/**
 * 1) Fixes casa_prevent_role_self_escalation() so it only blocks an
 *    AUTHENTICATED non-admin from escalating their own role — a direct
 *    service/superuser Postgres connection (auth.uid() IS NULL) was being
 *    incorrectly treated as "non-admin" and silently reverted.
 * 2) Grants super_admin to the first user (Renzo), now that the guard no
 *    longer blocks it.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import dns from "node:dns/promises";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
const FOLIO_REF = "qfvgksstvdrxcugbdwkv";
const FIRST_ADMIN_USER_ID = "12f68ed8-435f-4c2e-a555-8481fa9f6d7a"; // jrenzosamco@gmail.com

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
  await client.query("begin");

  await client.query(`
    create or replace function casa_prevent_role_self_escalation()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
      if new.role is distinct from old.role and auth.uid() is not null and not casa_is_admin() then
        new.role = old.role;
      end if;
      new.updated_at = now();
      return new;
    end;
    $fn$;
  `);
  console.log("Trigger function reemplazada.");

  await client.query(
    `insert into casa_profiles (id, role) values ($1, 'super_admin')
     on conflict (id) do update set role = 'super_admin'`,
    [FIRST_ADMIN_USER_ID]
  );
  console.log("super_admin otorgado a", FIRST_ADMIN_USER_ID);

  await client.query("commit");

  const { rows } = await client.query("select id, role, display_name from casa_profiles where id = $1", [FIRST_ADMIN_USER_ID]);
  console.table(rows);
} catch (error) {
  console.error("ERROR:", error.message);
  await client.query("rollback").catch(() => {});
  process.exitCode = 1;
} finally {
  await client.end();
}
