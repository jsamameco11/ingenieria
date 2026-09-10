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
const tech = await client.query(`select code, slug from public.technology_catalog where slug = 'bim' or code = 'bim'`);
console.log("BIM", JSON.stringify(tech.rows));
const skills = await client.query(`select code, slug from public.skills where code in ('eng-est-sismo') or slug in ('diseno-sismico','etabs')`);
console.log("SKILLS", JSON.stringify(skills.rows));
const ic = await client.query(`select code, slug from public.interest_categories where code like 'eng-civil%' or slug in ('etabs','bim','concreto-armado')`);
console.log("INTERESTS", JSON.stringify(ic.rows));
await client.end();
console.log("SESSION_OK");
