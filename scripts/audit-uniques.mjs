import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");
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
});
await client.connect();
for (const t of ["technology_catalog", "interest_categories", "skills", "professions"]) {
  const c = await client.query(
    `select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = $1::regclass and contype in ('u','p')`,
    [`public.${t}`],
  );
  console.log(t, c.rows.map((r) => r.def).join(" | "));
}
const slugs = await client.query(`select slug from public.interest_categories where slug in ('bim','etabs','concreto-armado','diseno-sismico')`);
console.log("interest slugs", slugs.rows);
await client.end();
