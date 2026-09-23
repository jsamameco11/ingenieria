import { FOLIO_URL, folioHeaders } from "../folio";
import type { Noticia } from "./tipos";

/**
 * Fuente maestra Folio (Supabase, SOLO LECTURA con publishable key).
 * JAMÁS embebar service_role ni claves Postgres: RLS bloquea toda escritura.
 */

export const CANONICA_BASE = "https://folio-pdf.miacademiapreu.com/noticias";

export type CategoriaMaestra = {
  id: number;
  slug: string;
  nombre: string;
  grupo: string;
  descripcion: string;
  color: string;
  orden: number;
};

type FilaCategoria = {
  id: number;
  slug: string;
  name: string;
  group: string;
  description: string;
  color: string;
  sort_order: number;
};

type FilaLista = {
  slug: string;
  title: string;
  excerpt: string;
  image_main: string;
  news_category_id: number;
  published_at: string;
  reading_minutes: number;
};

type FilaDetalle = FilaLista & {
  id: number;
  body: string;
  image_support_1: string | null;
  image_support_2: string | null;
  sources: { name: string; url: string }[] | null;
  author: string;
  status: string;
  verified_at: string | null;
  verification_note: string | null;
  featured: boolean;
  views: number | null;
};

const TTL_CATS = 24 * 3600 * 1000;
const TTL_LIST = 5 * 60 * 1000;

type Cache<T> = { at: number; val: T };
const mem = new Map<string, Cache<unknown>>();

function leerCache<T>(k: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(`noti:${k}`);
    if (!raw) return mem.get(k) as T | null ?? null;
    const c = JSON.parse(raw) as Cache<T>;
    if (Date.now() - c.at > ttl) return null;
    mem.set(k, c);
    return c.val;
  } catch {
    const c = mem.get(k) as Cache<T> | undefined;
    return c && Date.now() - c.at <= ttl ? c.val : null;
  }
}

function guardarCache(k: string, val: unknown) {
  const c = { at: Date.now(), val };
  mem.set(k, c);
  try {
    localStorage.setItem(`noti:${k}`, JSON.stringify(c));
  } catch {
    /* almacenamiento lleno o privado: solo memoria */
  }
}

async function get<T>(path: string, count = false): Promise<{ rows: T[]; total: number }> {
  const res = await fetch(`${FOLIO_URL}/rest/v1/${path}`, {
    headers: folioHeaders(count ? { Prefer: "count=exact" } : undefined),
  });
  if (!res.ok) throw new Error(`Maestra ${res.status}`);
  const rows = (await res.json()) as T[];
  let total = rows.length;
  const cr = res.headers.get("Content-Range");
  if (cr) {
    const m = cr.split("/")[1];
    const n = Number(m);
    if (Number.isFinite(n)) total = n;
  }
  return { rows, total };
}

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

export function parrafosDe(body: string): string[] {
  return String(body || "")
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Categorías oficiales ordenadas por sort_order. Cache 24 h. */
export async function obtenerCategorias(): Promise<CategoriaMaestra[]> {
  const hit = leerCache<CategoriaMaestra[]>("cats", TTL_CATS);
  if (hit) return hit;
  const { rows } = await get<FilaCategoria>(
    "news_categories?select=id,slug,name,group,description,color,sort_order&order=sort_order",
  );
  const cats = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    nombre: r.name,
    grupo: r.group,
    descripcion: r.description ?? "",
    color: r.color ?? "#1a4473",
    orden: r.sort_order ?? r.id,
  }));
  guardarCache("cats", cats);
  return cats;
}

const SEL_LISTA = "select=slug,title,excerpt,image_main,news_category_id,published_at,reading_minutes";

function aNotaLista(r: FilaLista, cats: CategoriaMaestra[]): Noticia {
  const c = cats.find((x) => x.id === r.news_category_id);
  const slugCat = c?.slug ?? String(r.news_category_id);
  return {
    id: r.slug,
    slug: r.slug,
    cat: slugCat,
    titular: r.title,
    bajada: r.excerpt ?? "",
    cuerpo: [],
    fuentes: [],
    fecha: fechaCorta(r.published_at),
    autor: "",
    lectura: Math.max(2, Math.round(Number(r.reading_minutes) || 3)),
    imagenIA: r.image_main || undefined,
    canonica: `${CANONICA_BASE}/${slugCat}/${r.slug}`,
    enVivo: true,
  };
}

/** Últimas publicadas (portada). Cache 5 min. */
export async function obtenerUltimas(limit = 12, offset = 0): Promise<{ notas: Noticia[]; total: number; cats: CategoriaMaestra[] }> {
  const cats = await obtenerCategorias();
  const k = `ult:${limit}:${offset}`;
  const hit = leerCache<{ notas: Noticia[]; total: number }>(k, TTL_LIST);
  if (hit) return { ...hit, cats };
  const { rows, total } = await get<FilaLista>(
    `news_articles?${SEL_LISTA}&order=published_at.desc&limit=${limit}&offset=${offset}`,
    true,
  );
  const out = { notas: rows.map((r) => aNotaLista(r, cats)), total };
  guardarCache(k, out);
  return { ...out, cats };
}

/** Notas de una categoría con paginación de servidor. Cache 5 min. */
export async function obtenerNotas(
  catId: number,
  limit = 9,
  offset = 0,
): Promise<{ notas: Noticia[]; total: number; cats: CategoriaMaestra[] }> {
  const cats = await obtenerCategorias();
  const k = `cat:${catId}:${limit}:${offset}`;
  const hit = leerCache<{ notas: Noticia[]; total: number }>(k, TTL_LIST);
  if (hit) return { ...hit, cats };
  const { rows, total } = await get<FilaLista>(
    `news_articles?news_category_id=eq.${catId}&${SEL_LISTA}&order=published_at.desc&limit=${limit}&offset=${offset}`,
    true,
  );
  const out = { notas: rows.map((r) => aNotaLista(r, cats)), total };
  guardarCache(k, out);
  return { ...out, cats };
}

/** Buscador en título y bajada. */
export async function buscarMaestra(texto: string, limit = 18, offset = 0): Promise<{ notas: Noticia[]; total: number; cats: CategoriaMaestra[] }> {
  const cats = await obtenerCategorias();
  const t = encodeURIComponent(`*${texto.trim()}*`);
  const { rows, total } = await get<FilaLista>(
    `news_articles?${SEL_LISTA}&order=published_at.desc&limit=${limit}&offset=${offset}&or=(title.ilike.${t},excerpt.ilike.${t})`,
    true,
  );
  return { notas: rows.map((r) => aNotaLista(r, cats)), total, cats };
}

/** Detalle completo por slug canónico. */
export async function obtenerDetalle(slug: string): Promise<{ nota: Noticia; cats: CategoriaMaestra[] }> {
  const cats = await obtenerCategorias();
  const { rows } = await get<FilaDetalle>(
    `news_articles?slug=eq.${encodeURIComponent(slug)}&select=slug,title,excerpt,body,image_main,image_support_1,image_support_2,sources,author,reading_minutes,status,verified_at,verification_note,published_at,featured,views,news_category_id`,
  );
  const r = rows[0];
  if (!r) throw new Error("Nota no encontrada en la maestra");
  const c = cats.find((x) => x.id === r.news_category_id);
  const slugCat = c?.slug ?? String(r.news_category_id);
  const fuentes = Array.isArray(r.sources)
    ? r.sources.map((s) => ({ medio: s.name, nota: s.url ?? "", url: s.url || undefined }))
    : [];
  const nota: Noticia = {
    id: r.slug,
    slug: r.slug,
    cat: slugCat,
    titular: r.title,
    bajada: r.excerpt ?? "",
    cuerpo: parrafosDe(r.body),
    fuentes,
    fecha: fechaCorta(r.published_at),
    autor: r.author ?? "Redacción",
    lectura: Math.max(2, Math.round(Number(r.reading_minutes) || 3)),
    imagenIA: r.image_main || undefined,
    apoyo: [r.image_support_1, r.image_support_2].filter(Boolean) as string[],
    verificadaEn: r.verified_at ? fechaCorta(r.verified_at) : undefined,
    notaVerificacion: r.verification_note ?? undefined,
    canonica: `${CANONICA_BASE}/${slugCat}/${r.slug}`,
    vistas: Number(r.views) || undefined,
    enVivo: true,
  };
  return { nota, cats };
}

/** Conteo por categoría para el desplegable (una sola consulta liviana). */
export async function conteoMaestro(): Promise<Record<string, number>> {
  const k = "conteo";
  const hit = leerCache<Record<string, number>>(k, TTL_LIST);
  if (hit) return hit;
  const cats = await obtenerCategorias();
  const { rows } = await get<{ news_category_id: number }>("news_articles?select=news_category_id&limit=200");
  const m: Record<string, number> = {};
  for (const r of rows) {
    const slug = cats.find((c) => c.id === r.news_category_id)?.slug ?? String(r.news_category_id);
    m[slug] = (m[slug] ?? 0) + 1;
  }
  guardarCache(k, m);
  return m;
}
