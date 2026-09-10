/**
 * Imports the full Reina-Valera 1909 Spanish Bible (public domain, CC0 —
 * https://github.com/BibleAquifer/ReinaValera1909, confirmed via that
 * repo's own README) into casa_bible_verses on the Folio PDF Supabase
 * project. Does not touch any other translation or any non-casa_ table.
 * Safe to re-run: verse rows are upserted by (chapter_id, translation_id,
 * verse_number).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import https from "node:https";
import dns from "node:dns/promises";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
const FOLIO_REF = "qfvgksstvdrxcugbdwkv";
const SOURCE_BASE = "https://raw.githubusercontent.com/BibleAquifer/ReinaValera1909/main/spa/json";
const TRANSLATION_CODE = "RVR1909";

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

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function cleanVerseText(html) {
  return html
    .replace(/<sup>\d+<\/sup>/g, "")
    .replace(/<\/?p>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function tryClient(cfg) {
  const client = new Client({ ...cfg, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  await client.connect();
  return client;
}

async function connect() {
  const env = loadEnv(FOLIO_ENV);
  const databaseUrl = String(env.DATABASE_URL || "").trim();
  if (!databaseUrl) throw new Error("Falta DATABASE_URL en Folio license-server/.env");

  const parsed = new URL(databaseUrl);
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
  throw new Error("No se pudo conectar a Postgres de Folio (directo ni pooler).");
}

async function main() {
  const client = await connect();

  try {
    const tr = await client.query("select id from casa_bible_translations where code = $1", [TRANSLATION_CODE]);
    if (tr.rows.length === 0) throw new Error(`Traducción ${TRANSLATION_CODE} no encontrada — ¿se aplicaron las migraciones?`);
    const translationId = tr.rows[0].id;

    const books = await client.query("select id, book_number from casa_bible_books");
    const bookIdByNumber = new Map(books.rows.map((r) => [r.book_number, r.id]));

    const chapters = await client.query("select id, book_id, chapter_number from casa_bible_chapters");
    const chapterIdByKey = new Map(chapters.rows.map((r) => [`${r.book_id}:${r.chapter_number}`, r.id]));

    console.log(`Descargando y preparando 66 libros desde ${SOURCE_BASE} ...`);
    const rows = []; // [chapter_id, translation_id, verse_number, text]
    let skipped = 0;

    for (let bookNumber = 1; bookNumber <= 66; bookNumber++) {
      const num = String(bookNumber).padStart(2, "0");
      const data = await fetchJson(`${SOURCE_BASE}/${num}.content.json`);
      const bookId = bookIdByNumber.get(bookNumber);
      if (!bookId) {
        console.warn(`Libro ${bookNumber} no existe en casa_bible_books, se omite (${data.length} versículos).`);
        skipped += data.length;
        continue;
      }
      for (const v of data) {
        const ref = v.index_reference; // BBCCCVVV
        const chapterNumber = parseInt(ref.slice(2, 5), 10);
        const verseNumber = parseInt(ref.slice(5, 8), 10);
        const chapterId = chapterIdByKey.get(`${bookId}:${chapterNumber}`);
        if (!chapterId) {
          skipped += 1;
          continue;
        }
        rows.push([chapterId, translationId, verseNumber, cleanVerseText(v.content)]);
      }
      process.stdout.write(".");
    }
    console.log(`\nPreparados ${rows.length} versículos (omitidos: ${skipped}).`);

    await client.query("begin");

    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = [];
      const params = [];
      batch.forEach((row, idx) => {
        const base = idx * 4;
        values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
        params.push(...row);
      });
      await client.query(
        `insert into casa_bible_verses (chapter_id, translation_id, verse_number, text)
         values ${values.join(", ")}
         on conflict (chapter_id, translation_id, verse_number)
         do update set text = excluded.text`,
        params
      );
      process.stdout.write(`\rInsertados ${Math.min(i + batchSize, rows.length)} / ${rows.length}`);
    }
    console.log();

    await client.query(
      `update casa_bible_chapters c set verse_count = sub.cnt
       from (
         select chapter_id, count(*) as cnt
         from casa_bible_verses
         where translation_id = $1
         group by chapter_id
       ) sub
       where c.id = sub.chapter_id`,
      [translationId]
    );

    await client.query("update casa_bible_translations set is_active = true where id = $1", [translationId]);
    await client.query("update casa_site_settings set default_bible_translation_id = $1 where id = 1", [translationId]);

    await client.query("commit");
    console.log("COMMIT completo.");

    const verify = await client.query(
      `select
         (select count(*)::int from casa_bible_verses where translation_id = $1) as verses,
         (select count(distinct chapter_id)::int from casa_bible_verses where translation_id = $1) as chapters_with_text,
         (select is_active from casa_bible_translations where id = $1) as translation_active`,
      [translationId]
    );
    console.log("=== VERIFICACIÓN ===");
    console.table(verify.rows[0]);
  } catch (error) {
    console.error("ERROR:", error.message);
    await client.query("rollback").catch(() => {});
    console.error("ROLLBACK completo — nada quedó aplicado.");
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
