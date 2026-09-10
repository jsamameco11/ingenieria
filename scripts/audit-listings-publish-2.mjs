/**
 * Prueba pública vitrina + buckets storage + control store.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
const ROOT_ENV = "C:/Users/Renzo/Desktop/WEB MEMORIAS DESCRIPTIVAS/.env";
const env = {};
for (const file of [FOLIO_ENV, ROOT_ENV, "C:/Users/Renzo/Desktop/WEB MEMORIAS DESCRIPTIVAS/server/.env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq > 0 && !env[t.slice(0, eq).trim()]) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  } catch {
    /* optional */
  }
}

const SUPABASE = (env.SUPABASE_URL || env.VITE_FOLIO_SUPABASE_URL || "https://qfvgksstvdrxcugbdwkv.supabase.co").replace(/\/$/, "");
const ANON =
  env.SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_FOLIO_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  "";
if (!ANON) throw new Error("Falta anon/publishable key");
console.log("using", SUPABASE, "anon", ANON.slice(0, 12) + "…");

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE}${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

console.log("=== Anon SELECT vitrina ===");
const sel = await rest(
  "/rest/v1/listings?select=id,name,kind,active,hidden,origin_app,offer_kind,visible_until&active=eq.true&hidden=eq.false&kind=eq.product&order=created_at.desc&limit=10",
);
console.log(sel.status, Array.isArray(sel.data) ? sel.data : sel.data);

console.log("=== Anon INSERT (debe fallar) ===");
const ins = await rest("/rest/v1/listings", {
  method: "POST",
  body: JSON.stringify({
    user_id: "00000000-0000-0000-0000-000000000000",
    kind: "product",
    name: "AUDIT_SHOULD_FAIL",
    description: "prueba",
    price_label: "S/ 1",
    category: "Construcción",
    city: "Lima",
    country: "Perú",
    country_code: "PE",
    phone: "",
    url: "",
    image: "",
    images: [],
    active: true,
    hidden: false,
    seller_email: "audit@test.local",
    seller_name: "Audit",
  }),
});
console.log(ins.status, typeof ins.data === "object" ? ins.data?.message || ins.data?.code || ins.data : String(ins.data).slice(0, 200));

console.log("=== Control store ===");
try {
  const r = await fetch("https://folio-control.miacademiapreu.com/api/v1/store", { cache: "no-store" });
  const j = await r.json();
  const items = Array.isArray(j.items) ? j.items : [];
  console.log(r.status, "items", items.length);
  console.log(
    items.slice(0, 5).map((x) => ({
      id: x.id,
      name: x.name || x.title,
      origin: x.origin_app || x.origin || x.source,
      kind: x.kind,
    })),
  );
} catch (e) {
  console.log("control error", e instanceof Error ? e.message : e);
}

console.log("=== Ingeniería health proxy (public page) ===");
try {
  const r = await fetch("https://ingenieria.miacademiapreu.com/", { method: "HEAD" });
  console.log("ingenieria", r.status);
} catch (e) {
  console.log("ingenieria", e instanceof Error ? e.message : e);
}

const u = new URL(env.DATABASE_URL);
const client = new Client({
  host: "aws-0-us-east-1.pooler.supabase.com",
  port: 6543,
  user: "postgres.qfvgksstvdrxcugbdwkv",
  password: decodeURIComponent(u.password),
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const buckets = await client.query(`select id, name, public from storage.buckets order by id`);
console.log("=== All buckets ===");
console.log(buckets.rows);

const insertFn = await client.query(`
  select proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and proname ilike '%listing%'
  order by 1
`);
console.log("=== Listing RPCs ===");
console.log(insertFn.rows.map((r) => r.proname));
await client.end();
