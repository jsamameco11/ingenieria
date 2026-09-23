export type Fuente = {
  /** Medio o entidad verificada. */
  medio: string;
  /** Detalle de la verificación (fecha, documento, declaración) o URL. */
  nota: string;
  /** Enlace a la fuente oficial (maestra). */
  url?: string;
};

export type Noticia = {
  id: string;
  /** Id de categoría (ver categorias.ts). */
  cat: string;
  titular: string;
  bajada: string;
  /** 4 a 6 párrafos concisos. */
  cuerpo: string[];
  /** Fuentes verificadas antes de publicar. */
  fuentes: Fuente[];
  /** Fecha de publicación (texto corto, es-PE). */
  fecha: string;
  autor: string;
  /** Minutos de lectura estimados. */
  lectura: number;
  /** URL de imagen principal IA (opcional: si falta, se dibuja portada editorial). */
  imagenIA?: string;
  /** Hasta 2 imágenes de apoyo web (opcional). */
  apoyo?: string[];
  /** Aviso legal para casos en investigación (lenguaje condicional). */
  notaLegal?: string;
  /** Slug canónico en la maestra Folio (solo modo en vivo). */
  slug?: string;
  /** Fecha/hora de verificación (maestra: verified_at). */
  verificadaEn?: string;
  /** Nota de verificación de la maestra. */
  notaVerificacion?: string;
  /** URL canónica: folio-pdf.miacademiapreu.com/noticias/{cat}/{slug}. */
  canonica?: string;
  /** Vistas acumuladas (maestra). */
  vistas?: number;
  /** true = viene de la base maestra; false/ausente = paquete local. */
  enVivo?: boolean;
};

/** Fábrica compacta: id `${cat}-${n}` y lectura estimada por longitud. */
export function art(
  cat: string,
  n: number,
  titular: string,
  bajada: string,
  cuerpo: string[],
  fuentes: Fuente[],
  fecha: string,
  autor = "Redacción Ingeniería",
  notaLegal = "",
): Noticia {
  const palabras = [titular, bajada, ...cuerpo].join(" ").split(/\s+/).length;
  return {
    id: `${cat}-${n}`,
    cat,
    titular,
    bajada,
    cuerpo,
    fuentes,
    fecha,
    autor,
    lectura: Math.max(2, Math.round(palabras / 180)),
    ...(notaLegal ? { notaLegal } : {}),
  };
}

export function paginar<T>(items: T[], pagina: number, porPagina: number): { page: T[]; total: number; paginas: number; actual: number } {
  const total = items.length;
  const paginas = Math.max(1, Math.ceil(total / Math.max(1, porPagina)));
  const actual = Math.min(Math.max(1, pagina), paginas);
  const ini = (actual - 1) * porPagina;
  return { page: items.slice(ini, ini + porPagina), total, paginas, actual };
}
