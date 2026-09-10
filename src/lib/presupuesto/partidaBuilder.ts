import type { EspecialidadPre, Partida, RecetaItem } from "./types";

export function r(...pairs: [string, number][]): RecetaItem[] {
  return pairs.map(([insumoId, cantidad]) => ({ insumoId, cantidad }));
}

export function p(
  especialidad: EspecialidadPre,
  capitulo: string,
  codigo: string,
  descripcion: string,
  und: string,
  receta: RecetaItem[]
): Partida {
  return { especialidad, capitulo, codigo, descripcion, und, receta };
}
