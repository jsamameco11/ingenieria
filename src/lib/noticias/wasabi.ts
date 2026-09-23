/**
 * Capa de imágenes Wasabi (URLs estables) con cascada profesional:
 *   1) Wasabi (estable, temática) → 2) URL maestra → 3) ilustración editorial.
 * Sin base configurada, la cascada empieza en la maestra: cero imágenes rotas.
 *
 * Convención de claves estables (no cambiar sin migrar el bucket):
 *   {BASE}/{category_slug}/{article_slug}-{a|b|c}.jpg
 * donde `a` = hero, `b`/`c` = apoyos. Ej:
 *   https://mi-bucket.s3.wasabisys.com/noticias/transporte-infraestructura/puerto-de-chancay-a.jpg
 *
 * Activación: definir VITE_NEWS_IMG_BASE en .env (solo base pública, sin claves).
 */

const BASE = ((import.meta.env.VITE_NEWS_IMG_BASE as string | undefined) ?? "").replace(/\/$/, "");

export const WASABI_ACTIVO = BASE.length > 0;

export type FotoCual = "a" | "b" | "c";

export function urlWasabi(catSlug: string, artSlug: string, cual: FotoCual): string | null {
  if (!WASABI_ACTIVO) return null;
  const cs = String(catSlug || "").trim();
  const as = String(artSlug || "").trim();
  if (!cs || !as) return null;
  return `${BASE}/${cs}/${as}-${cual}.jpg`;
}

function sinDuplicados(items: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const s of items) {
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

export type CandidatasOpts = {
  catSlug: string;
  artSlug: string;
  cual: FotoCual;
  maestra?: string | null;
  respaldo: string;
};

/** Lista ordenada de candidatas: misma imagen estable en todas las páginas. */
export function candidatas(o: CandidatasOpts): string[] {
  return sinDuplicados([urlWasabi(o.catSlug, o.artSlug, o.cual), o.maestra, o.respaldo]);
}
