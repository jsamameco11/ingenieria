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

// Placeholder neutro (no es una foto real ni de stock) para poder verificar
// que el layout "imagen al costado" funciona, sin inventar una fotografía
// que no nos pertenece. El editor lo reemplaza subiendo su propia imagen.
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#e2e6e0"/>
  <circle cx="200" cy="115" r="34" fill="none" stroke="#9a9488" stroke-width="4"/>
  <circle cx="200" cy="115" r="14" fill="#9a9488"/>
  <text x="200" y="200" font-family="sans-serif" font-size="18" fill="#6b6255" text-anchor="middle">Agrega tu imagen aquí</text>
</svg>`;
const PLACEHOLDER_IMAGE = `data:image/svg+xml,${encodeURIComponent(PLACEHOLDER_SVG)}`;

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
  const { rows: [study] } = await client.query(`select id from casa_studies where slug = $1`, [SLUG]);
  if (!study) throw new Error(`No existe el estudio ${SLUG}. Corre primero create-abraham-study.mjs.`);

  // Limpia una corrida anterior de este script (secciones 5 y 6 en adelante).
  await client.query(
    `delete from casa_study_contents where section_id in (
       select id from casa_study_sections where study_id = $1 and position >= 5
     )`,
    [study.id]
  );
  await client.query(`delete from casa_study_sections where study_id = $1 and position >= 5`, [study.id]);

  const genesis22_14 = await fetchVerse(client, "genesis", 22, 14);

  async function addSection(title, subtitle, position) {
    const { rows: [s] } = await client.query(
      `insert into casa_study_sections (study_id, title, subtitle, position, is_visible, layout)
       values ($1, $2, $3, $4, true, 'standard') returning id`,
      [study.id, title, subtitle, position]
    );
    return s.id;
  }

  // Sección 6 — subtítulo + un párrafo de TEXTO justo debajo (independiente
  // del versículo), y un versículo con diseño "al costado".
  const s6 = await addSection(
    "Una promesa que se cumple",
    "Años después, en el momento más difícil, Dios provee justo donde parecía que no habría salida.",
    5
  );
  await client.query(
    `insert into casa_study_contents (section_id, type, position, is_visible, body)
     values ($1, 'text', 0, true, $2)`,
    [
      s6,
      "Este párrafo va debajo del subtítulo de la sección: sirve para desarrollar la idea antes de llegar al versículo. (Contenido generado/explicativo por IA.)",
    ]
  );
  const { rows: [c6] } = await client.query(
    `insert into casa_study_contents (section_id, type, position, is_visible, title)
     values ($1, 'verse', 1, true, 'Jehová proveerá')
     returning id`,
    [s6]
  );
  await client.query(
    `insert into casa_study_content_verses
       (content_id, book_slug, chapter_start, verse_start, chapter_end, verse_end, translation_code, text, show_reference)
     values ($1, 'genesis', 22, 14, 22, 14, 'RVR1909', $2, true)`,
    [c6.id, genesis22_14]
  );
  // "side" = diseño lateral (versículo al costado, composición en fila).
  await client.query(`update casa_study_contents set configuration = '{"layout":"side"}'::jsonb where id = $1`, [c6.id]);

  // Sección 7 — imagen al costado del texto (image-text con alineación a la
  // derecha) y una reflexión independiente (no depende de un versículo).
  const s7 = await addSection("Su legado permanece", null, 6);
  await client.query(
    `insert into casa_study_contents (section_id, type, position, is_visible, title, body, media_url, media_alt, configuration)
     values ($1, 'image-text', 0, true, 'Padre de multitud de naciones',
       'Este bloque combina una imagen al costado con un párrafo de texto — útil para fotos de contexto, mapas o arte relacionado con el pasaje. (Contenido generado/explicativo por IA.)',
       $2, 'Ilustración de referencia (el editor la reemplaza por su propia imagen)', '{"alignment":"right"}')`,
    [s7, PLACEHOLDER_IMAGE]
  );
  await client.query(
    `insert into casa_study_contents (section_id, type, position, is_visible, title, body)
     values ($1, 'reflection', 1, true, 'Una reflexión final',
       'La fe de Abraham no fue perfecta desde el inicio: creció paso a paso, promesa tras promesa. Su legado no es la ausencia de dudas, sino la decisión de seguir confiando. (Contenido generado/explicativo por IA.)')`,
    [s7]
  );

  console.log("Secciones 06 y 07 agregadas: versículo al costado, texto bajo subtítulo, imagen al costado, reflexión independiente.");
  console.log(`URL: http://localhost:3001/estudios/${SLUG}`);
} finally {
  await client.end();
}
