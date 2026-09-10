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
const auth = await client.query(`
  select id, email, created_at
  from auth.users
  where lower(email) like '%jrenzo%' or lower(email) like '%samco%'
`);
console.log("AUTH", JSON.stringify(auth.rows));
if (auth.rows[0]) {
  const id = auth.rows[0].id;
  const mc = await client.query(`select * from public.memorcalc_profiles where user_id = $1`, [id]);
  console.log("MC", mc.rows.length, mc.rows[0] ? Object.keys(mc.rows[0]).join(",") : "none");
  const usr = await client.query(`select id, onboarding_completed, public_user_code from public.users where id = $1`, [id]);
  console.log("USERS", JSON.stringify(usr.rows));
}
await client.end();
