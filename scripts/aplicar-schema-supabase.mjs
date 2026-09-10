/**
 * Crea las tablas del proyecto MemoriaCalc en Supabase.
 * Uso:
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_…"; node scripts/aplicar-schema-supabase.mjs
 *
 * El token se crea en: https://supabase.com/dashboard/account/tokens
 * (Account → Access Tokens). No lo ponga en .env del frontend.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REF = "kxiunxdjtaesswgexsij";
const REST = `https://${REF}.supabase.co`;
const token = (process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const anon = (
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ""
).trim();

function leerEnvLocal() {
  const out = {};
  for (const name of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(join(ROOT, name), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m) out[m[1]] = m[2];
      }
    } catch {
      /* optional */
    }
  }
  return out;
}

const envFile = leerEnvLocal();
const access = token || (envFile.SUPABASE_ACCESS_TOKEN || "").trim();
const publishable =
  anon ||
  (envFile.VITE_SUPABASE_ANON_KEY || envFile.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

if (!access) {
  console.error("Falta SUPABASE_ACCESS_TOKEN. Créelo en Account → Access Tokens y páselo al comando.");
  process.exit(1);
}

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = body?.message || body?.error || body?.msg || text;
    throw new Error(`SQL ${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(body)}`);
  }
  return body;
}

async function probe(table) {
  const res = await fetch(`${REST}/rest/v1/${table}?select=id&limit=1`, {
    headers: {
      apikey: publishable,
      Authorization: `Bearer ${publishable}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  return { table, status: res.status, body: text.slice(0, 240) };
}

const sql = readFileSync(join(ROOT, "supabase", "schema.sql"), "utf8");
console.log("Aplicando supabase/schema.sql en", REF, "…");
await runSql(sql);
console.log("Schema aplicado.");

if (publishable) {
  for (const table of ["presupuesto_archivos", "calculations", "projects"]) {
    const r = await probe(table);
    const ok = r.status === 200;
    console.log(ok ? `OK  ${table}` : `FALLA ${table} (${r.status}) ${r.body}`);
    if (!ok) process.exitCode = 1;
  }
} else {
  console.log("Sin clave pública: no pude verificar REST. El schema se envió igual.");
}
