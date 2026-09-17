import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import dns from "node:dns/promises";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
const FOLIO_REF = "qfvgksstvdrxcugbdwkv";
const SLUG = "la-fe-de-abraham";

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

// Texto bíblico REAL, leído de la Biblia ya importada (RVR1909, dominio
// público) — nunca escrito de memoria. RVR1960 aparece en la maqueta del
// usuario pero todavía no tenemos licencia activa para su texto, así que se
// usa la traducción de dominio público que sí está legalmente disponible.
async function fetchVerse(client, bookSlug, chapter, verse) {
  const { rows } = await client.query(
    `select v.text
       from casa_bible_verses v
       join casa_bible_chapters c on c.id = v.chapter_id
       join casa_bible_books b on b.id = c.book_id
       join casa_bible_translations tr on tr.id = v.translation_id
      where b.slug = $1 and c.chapter_number = $2 and v.verse_number = $3 and tr.code = 'RVR1909'`,
    [bookSlug, chapter, verse]
  );
  if (!rows[0]) throw new Error(`No se encontró ${bookSlug} ${chapter}:${verse} en RVR1909.`);
  return rows[0].text;
}

const client = await connect();
try {
  await client.query(
    `delete from casa_study_contents where section_id in (
       select id from casa_study_sections where study_id in (select id from casa_studies where slug = $1)
     )`,
    [SLUG]
  );
  await client.query(`delete from casa_study_sections where study_id in (select id from casa_studies where slug = $1)`, [SLUG]);
  await client.query(`delete from casa_studies where slug = $1`, [SLUG]);

  const genesis12_1 = await fetchVerse(client, "genesis", 12, 1);
  const genesis15_6 = await fetchVerse(client, "genesis", 15, 6);
  const romanos4_20 = await fetchVerse(client, "romanos", 4, 20);

  const { rows: [study] } = await client.query(
    `insert into casa_studies (slug, title, subtitle, description, main_verse, level, status, position)
     values ($1, 'La fe de Abraham', 'Seis pasos para confiar como Abraham confió',
       'Un recorrido por la vida de Abraham: cómo respondió al llamado de Dios, cómo su fe fue puesta a prueba, y qué significa hoy caminar confiando en las promesas de Dios sin ver todavía el resultado.',
       $2, 'beginner', 'published', 0)
     returning id, slug`,
    [SLUG, genesis15_6]
  );
  console.log("Estudio creado:", study);

  async function addSection(title, subtitle, position) {
    const { rows: [s] } = await client.query(
      `insert into casa_study_sections (study_id, title, subtitle, position, is_visible, layout)
       values ($1, $2, $3, $4, true, 'standard') returning id`,
      [study.id, title, subtitle, position]
    );
    return s.id;
  }

  async function addVerse(sectionId, position, { title, book, chapter, verseStart, verseEnd, text, reflection }) {
    const { rows: [c] } = await client.query(
      `insert into casa_study_contents (section_id, type, position, is_visible, title)
       values ($1, 'verse', $2, true, $3) returning id`,
      [sectionId, position, title ?? null]
    );
    await client.query(
      `insert into casa_study_content_verses
         (content_id, book_slug, chapter_start, verse_start, chapter_end, verse_end, translation_code, text,
          show_reference, reflection_enabled, reflection_title, reflection_content)
       values ($1, $2, $3, $4, $3, $5, 'RVR1909', $6, true, $7, $8, $9)`,
      [c.id, book, chapter, verseStart, verseEnd ?? verseStart, text, Boolean(reflection), reflection?.title ?? null, reflection?.body ?? null]
    );
  }

  async function addText(sectionId, position, { title, body }) {
    await client.query(
      `insert into casa_study_contents (section_id, type, position, is_visible, title, body)
       values ($1, 'text', $2, true, $3, $4)`,
      [sectionId, position, title ?? null, body]
    );
  }

  async function addList(sectionId, position, { title, items }) {
    await client.query(
      `insert into casa_study_contents (section_id, type, position, is_visible, title, configuration)
       values ($1, 'list', $2, true, $3, $4)`,
      [sectionId, position, title ?? null, JSON.stringify({ items })]
    );
  }

  async function addQuote(sectionId, position, { body, author }) {
    await client.query(
      `insert into casa_study_contents (section_id, type, position, is_visible, body, configuration)
       values ($1, 'quote', $2, true, $3, $4)`,
      [sectionId, position, body, JSON.stringify({ author })]
    );
  }

  // Sección 1 — título + subtítulo (párrafo), y un versículo mostrado solo
  // como referencia (sin cita textual) para introducir el pasaje.
  const s1 = await addSection(
    "El llamado y la promesa",
    "Dios llama a Abram a salir, y le hace una promesa que cambiaría su historia y la nuestra.",
    0
  );
  await addVerse(s1, 0, { book: "genesis", chapter: 12, verseStart: 1, verseEnd: 3, text: null });

  // Sección 2 — versículo con su propio párrafo (el texto bíblico) y una
  // reflexión (párrafo aparte, explícitamente marcado como generado por IA).
  const s2 = await addSection("Un paso de obediencia", null, 1);
  await addVerse(s2, 0, {
    title: null,
    book: "genesis",
    chapter: 12,
    verseStart: 1,
    text: genesis12_1,
    reflection: {
      title: "Para meditar",
      body:
        "Abram no conocía el destino, solo conocía la voz que lo llamaba. A veces obedecer significa caminar antes de entender el plan completo. (Contenido generado/explicativo por IA.)",
    },
  });

  // Sección 3 — otro versículo con su texto, más un párrafo de texto aparte
  // (independiente del versículo), demostrando ambos tipos de bloque juntos.
  const s3 = await addSection("Una fe que confía sin ver", null, 2);
  await addVerse(s3, 0, { book: "genesis", chapter: 15, verseStart: 6, text: genesis15_6 });
  await addText(s3, 1, {
    title: "Para tu vida esta semana",
    body:
      "Este es un párrafo de texto independiente del versículo de arriba: puede usarse para aplicar el pasaje a la vida diaria, agregar contexto histórico, o invitar a la acción. (Contenido generado/explicativo por IA.)",
  });

  // Sección 4 — lista de puntos + una cita (el mismo texto bíblico real,
  // mostrado en el bloque de "cita" para lograr el layout de recuadro
  // lateral que pide la maqueta).
  const s4 = await addSection("Lo que aprendemos de Abraham", null, 3);
  await addList(s4, 0, {
    items: ["La fe se fortalece en la espera", "Dios cumple lo que promete", "Su gracia transforma nuestro camino"],
  });
  await addQuote(s4, 1, { body: romanos4_20, author: "Romanos 4:20 (RVR1909)" });

  // Sección 5 — cierre con un párrafo de oración.
  const s5 = await addSection("Oración para este estudio", null, 4);
  await addText(s5, 0, {
    body: "Señor, ayúdanos a confiar como Abraham, a obedecer tu voz y a descansar en tus promesas. Amén.",
  });

  console.log("\nEstudio 'La fe de Abraham' publicado con 5 secciones.");
  console.log(`URL pública: https://casadelapalabra.miacademiapreu.com/estudios/${SLUG}`);
  console.log("(Los campos de imagen quedaron sin usar en las secciones 3 y 5 — no hay fotos reales para subir; el editor puede agregarlas desde el admin cuando tenga las imágenes.)");
} finally {
  await client.end();
}
