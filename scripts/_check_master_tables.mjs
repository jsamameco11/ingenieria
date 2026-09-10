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
  port: 6543,
  user: "postgres.qfvgksstvdrxcugbdwkv",
  password: decodeURIComponent(u.password),
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const wanted = ["users", "user_profiles", "user_platforms", "platforms"];
const existing = await client.query(`
  select table_name from information_schema.tables
  where table_schema = 'public' and table_name = any($1::text[])
  order by 1
`, [wanted]);
const have = new Set(existing.rows.map((r) => r.table_name));
console.log("EXISTEN", [...have].join(", ") || "(ninguna)");
console.log("FALTAN", wanted.filter((t) => !have.has(t)).join(", ") || "(ninguna)");
for (const t of wanted) {
  if (!have.has(t)) continue;
  const n = await client.query(`select count(*)::int as n from public.${t}`);
  console.log(`COUNT ${t} ${n.rows[0].n}`);
}
await client.end();
