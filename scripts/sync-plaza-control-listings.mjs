import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
const CONTROL = "https://folio-control.miacademiapreu.com/api/v1/store";
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

const store = await (await fetch(CONTROL)).json();
const items = Array.isArray(store.items) ? store.items : [];

await client.connect();
const owner = await client.query(`
  select id::text as id
  from auth.users
  where email ilike 'miacademiapreu.pe@gmail.com'
  union
  select user_id::text
  from listings
  where seller_email ilike 'miacademiapreu.pe@gmail.com'
  limit 1`);
const userId = owner.rows[0]?.id;
if (!userId) {
  console.log("FAIL no owner user");
  await client.end();
  process.exit(1);
}

let upserted = 0;
for (const it of items) {
  if (!it?.id || it.kind === "ad") continue;
  const images = Array.isArray(it.images) ? it.images.filter((x) => typeof x === "string") : [];
  const image = String(it.image || images[0] || "");
  const until = new Date();
  until.setMonth(until.getMonth() + 3);
  await client.query(
    `insert into listings (
      id, user_id, kind, name, description, price_label, currency,
      city, country, country_code, department, category, phone, url,
      image, images, active, hidden, seller_email, seller_name,
      origin_app, visible_until, visibility_source, views, details, contacts
    ) values (
      $1,$2,'product',$3,$4,$5,'PEN',
      $6,$7,$8,$9,$10,$11,$12,
      $13,$14,true,false,$15,$16,
      'folio-pdf',$17,'donation',$18,$19,$20
    )
    on conflict (id) do update set
      name = excluded.name,
      description = excluded.description,
      price_label = excluded.price_label,
      city = excluded.city,
      country = excluded.country,
      department = excluded.department,
      category = excluded.category,
      url = excluded.url,
      image = excluded.image,
      images = excluded.images,
      active = true,
      hidden = false,
      origin_app = 'folio-pdf',
      visible_until = coalesce(listings.visible_until, excluded.visible_until),
      updated_at = now()`,
    [
      it.id,
      userId,
      String(it.name || "Aviso"),
      String(it.description || ""),
      String(it.priceLabel || it.price_label || "Consultar"),
      String(it.city || "Perú"),
      String(it.country || "Perú"),
      String(it.countryCode || it.country_code || "PE"),
      String(it.department || ""),
      String(it.category || "Servicios"),
      String(it.phone || ""),
      String(it.url || ""),
      image,
      images.length ? images : image ? [image] : [],
      String(it.sellerEmail || it.seller_email || "miacademiapreu.pe@gmail.com"),
      String(it.sellerName || it.seller_name || "Folio"),
      until.toISOString(),
      Number(it.views || 0),
      Number(it.details || 0),
      Number(it.contacts || 0),
    ],
  );
  upserted += 1;
}

const cnt = await client.query(`
  select kind, active, hidden, count(*)::int as n
  from listings
  group by 1, 2, 3
  order by 1`);
console.log("UPSERTED", upserted, "OWNER", userId);
console.log(cnt.rows);
await client.end();
