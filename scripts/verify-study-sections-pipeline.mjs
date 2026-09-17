import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import dns from "node:dns/promises";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
const FOLIO_REF = "qfvgksstvdrxcugbdwkv";
const SLUG = "test-verificacion-secciones";

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

async function tryClient(cfg) {
  const client = new Client({ ...cfg, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  await client.connect();
  return client;
}

async function connect() {
  const env = loadEnv(FOLIO_ENV);
  const parsed = new URL(env.DATABASE_URL);
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
  throw new Error("No se pudo conectar a Postgres de Folio.");
}

const client = await connect();
try {
  // Limpieza de una corrida anterior, si quedó algo.
  await client.query(
    `delete from casa_study_contents where section_id in (
       select id from casa_study_sections where study_id in (select id from casa_studies where slug = $1)
     )`,
    [SLUG]
  );
  await client.query(`delete from casa_study_sections where study_id in (select id from casa_studies where slug = $1)`, [SLUG]);
  await client.query(`delete from casa_studies where slug = $1`, [SLUG]);

  // 1) Cabecera del estudio — exactamente los campos que llena StudyForm.
  const { rows: [study] } = await client.query(
    `insert into casa_studies (slug, title, subtitle, description, status)
     values ($1, 'Verificación de secciones (prueba)', 'Creado por script para verificar el pipeline admin -> público', 'Descripción general del estudio.', 'published')
     returning id, slug`,
    [SLUG]
  );
  console.log("Estudio creado:", study);

  // 2) Sección con título — exactamente lo que llena SectionCard.
  const { rows: [section] } = await client.query(
    `insert into casa_study_sections (study_id, title, subtitle, position, is_visible, layout)
     values ($1, 'Confianza en medio de la tormenta', 'Lo que Marcos 4 enseña sobre el miedo', 0, true, 'standard')
     returning id`,
    [study.id]
  );
  console.log("Sección creada:", section.id);

  // 3) Bloque de versículo CON su párrafo de reflexión — exactamente lo que
  //    llena VerseEditor (libro, capítulo, versículo, texto, reflexión).
  const { rows: [verseContent] } = await client.query(
    `insert into casa_study_contents (section_id, type, position, is_visible, title)
     values ($1, 'verse', 0, true, 'La calma de Jesús')
     returning id`,
    [section.id]
  );
  await client.query(
    `insert into casa_study_content_verses
       (content_id, book_slug, chapter_start, verse_start, translation_code, text, show_reference,
        reflection_enabled, reflection_title, reflection_content)
     values ($1, 'marcos', 4, 39, 'RVR1960',
       'Y levantándose, reprendió al viento, y dijo al mar: Calla, enmudece. Y cesó el viento, y se hizo grande bonanza.',
       true, true, 'Para meditar',
       'Este es el párrafo de reflexión que va junto al versículo: la misma voz que calmó el mar sigue calmando toda tormenta hoy.')`,
    [verseContent.id]
  );
  console.log("Bloque de versículo (con párrafo de reflexión) creado:", verseContent.id);

  // 4) Bloque de TEXTO aparte — un párrafo independiente, sin versículo.
  const { rows: [textContent] } = await client.query(
    `insert into casa_study_contents (section_id, type, position, is_visible, title, body)
     values ($1, 'text', 1, true, 'Para tu vida esta semana',
       'Este es un párrafo de texto completamente independiente del versículo de arriba.\n\nPuede tener varios párrafos, separados por una línea en blanco, igual que en el editor.')
     returning id`,
    [section.id]
  );
  console.log("Bloque de texto aparte creado:", textContent.id);

  console.log("\nListo. URL pública para revisar:");
  console.log(`  https://casadelapalabra.miacademiapreu.com/estudios/${SLUG}`);
  console.log("\n(Se eliminará automáticamente al final de esta verificación.)");
} finally {
  await client.end();
}
