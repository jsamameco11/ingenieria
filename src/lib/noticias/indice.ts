import { CATEGORIAS, catPorId } from "./categorias";
import { NOTICIAS_ECONOMIA } from "./datos-economia";
import { NOTICIAS_TECNO } from "./datos-tecno";
import { NOTICIAS_DEPORTE, NOTICIAS_SEGURIDAD } from "./datos-seguridad-deporte";
import { NOTICIAS_MUNDO } from "./datos-mundo";
import { NOTICIAS_POLITICA } from "./datos-politica";
import { NOTICIAS_ESCANDALO } from "./datos-escandalo";
import { paginar, type Noticia } from "./tipos";

export const NOTICIAS: Noticia[] = [
  ...NOTICIAS_ECONOMIA,
  ...NOTICIAS_TECNO,
  ...NOTICIAS_SEGURIDAD,
  ...NOTICIAS_DEPORTE,
  ...NOTICIAS_MUNDO,
  ...NOTICIAS_POLITICA,
  ...NOTICIAS_ESCANDALO,
];

/** Noticia principal de portada (hero). */
export const HERO_ID = "transporte-1";

export const noticiaPorId = (id: string): Noticia | undefined =>
  NOTICIAS.find((n) => n.id === id);

export const heroNoticia = (): Noticia =>
  noticiaPorId(HERO_ID) ?? NOTICIAS[0];

export function noticiasPorCategoria(cat: string): Noticia[] {
  return NOTICIAS.filter((n) => n.cat === cat);
}

export function conteoPorCategoria(): Record<string, number> {
  const m: Record<string, number> = {};
  for (const n of NOTICIAS) m[n.cat] = (m[n.cat] ?? 0) + 1;
  return m;
}

export function buscarNoticias(q: string, cat = ""): Noticia[] {
  const t = q.trim().toLowerCase();
  return NOTICIAS.filter((n) => {
    if (cat && n.cat !== cat) return false;
    if (!t) return true;
    const c = catPorId(n.cat);
    return [n.titular, n.bajada, c.nombre, ...n.cuerpo].join(" ").toLowerCase().includes(t);
  });
}

export function relacionadas(noticia: Noticia, n = 3): Noticia[] {
  const mismaCat = NOTICIAS.filter((x) => x.cat === noticia.cat && x.id !== noticia.id);
  if (mismaCat.length >= n) return mismaCat.slice(0, n);
  const grupo = catPorId(noticia.cat).grupo;
  const mismoGrupo = NOTICIAS.filter(
    (x) => x.id !== noticia.id && x.cat !== noticia.cat && catPorId(x.cat).grupo === grupo,
  );
  return [...mismaCat, ...mismoGrupo].slice(0, n);
}

export const TOTAL_NOTICIAS = NOTICIAS.length;
export const TOTAL_CATEGORIAS = CATEGORIAS.length;
export const POR_PAGINA = 9;

export { CATEGORIAS, catPorId, paginar };
export type { Noticia };
