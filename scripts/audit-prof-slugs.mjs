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
const slugs = [
  "arquitectura","otras-tecnicas","ingenieria-mecanica","ingenieria-electrica","ingenieria-industrial",
  "ingenieria-sanitaria","ingenieria-ambiental","ingenieria-sistemas","ingenieria-geologica","ingenieria-minas",
  "ingenieria-agricola","ingenieria-quimica","ingenieria-electronica","geotecnia","hidraulica","hidrologia",
  "transportes","pavimentos","construccion","costos-presupuestos","planeamiento","gestion-proyectos",
  "saneamiento","topografia","diseno-mezclas","tasaciones","instalaciones","concreto-armado",
  "acero-estructural","albanileria","madera","puentes","arquitecto","urbanista","arquitecto-paisajista",
  "disenador-interiores","estructuras"
];
const r = await client.query(
  `select code, slug from public.professions where slug = any($1::text[]) or code = any($2::text[]) order by slug`,
  [slugs, ["arch","tech-other","eng-mech","eng-civil-geo"]],
);
console.log(r.rows.map((x) => `${x.code}:${x.slug}`).join("\n"));
const t = await client.query(`select to_regclass('public.extraction_settings') s, to_regclass('public.question_definitions') q`);
console.log("REG", t.rows[0]);
await client.end();
