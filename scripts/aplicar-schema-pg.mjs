import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(join(ROOT, "supabase", "schema.sql"), "utf8");
const passwords = (process.env.PG_PASSWORDS || "")
  .split("|")
  .map((s) => s.trim())
  .filter(Boolean);
if (!passwords.length) {
  console.error("Falta PG_PASSWORDS (separadas por |).");
  process.exit(1);
}
const hosts = [
  { host: "aws-0-us-west-2.pooler.supabase.com", port: 6543, user: "postgres.kxiunxdjtaesswgexsij" },
  { host: "aws-0-us-west-2.pooler.supabase.com", port: 5432, user: "postgres.kxiunxdjtaesswgexsij" },
  { host: "aws-1-us-west-2.pooler.supabase.com", port: 6543, user: "postgres.kxiunxdjtaesswgexsij" },
  { host: "aws-0-us-west-1.pooler.supabase.com", port: 6543, user: "postgres.kxiunxdjtaesswgexsij" },
];

async function tryConnect(cfg) {
  const client = new pg.Client({
    ...cfg,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 6000,
  });
  await client.connect();
  return client;
}

let client = null;
for (const password of passwords) {
  for (const h of hosts) {
    try {
      client = await tryConnect({ ...h, password });
      console.log("CONECTADO", `${h.user}@${h.host}:${h.port}`);
      break;
    } catch (e) {
      console.log("falla", h.host, String(e.message || e).slice(0, 140).replace(/\s+/g, " "));
    }
  }
  if (client) break;
}

if (!client) {
  console.error("NO_CONNECT");
  process.exit(1);
}

try {
  await client.query(sql);
  const r = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('presupuesto_archivos','calculations','projects','module_catalog')
    order by 1
  `);
  console.log("TABLAS", r.rows.map((x) => x.table_name).join(","));
} finally {
  await client.end();
}
