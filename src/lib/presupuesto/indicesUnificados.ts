/** Índices Unificados de Precios de la Construcción (IUPC) — INEI.
 *  Códigos oficiales (hay huecos: 15, 25, 29, 35, 36, 58, 63, 67, 74–76, 79).
 *  Base histórica: julio 1992 = 100. Nueva base Dic 2025 = 100 (R.J. 016-2026-INEI).
 *  Io / Ir son editables en obra; no se copian boletines CAPECO/INEI.
 */

export type IndiceUnificado = {
  codigo: number;
  nombre: string;
  simbolo: string;
  grupo: "mano-obra" | "materiales" | "maquinaria" | "equipos" | "servicios" | "general";
  /** Valor de partida de ejemplo (base 100). Editable. */
  io: number;
  /** Valor de valorización de ejemplo (base 100). Editable. */
  ir: number;
};

export const AREAS_GEOGRAFICAS: { id: number; nombre: string }[] = [
  { id: 1, nombre: "Área 1 · Lima Metropolitana y Callao" },
  { id: 2, nombre: "Área 2 · Costa norte" },
  { id: 3, nombre: "Área 3 · Costa sur" },
  { id: 4, nombre: "Área 4 · Sierra norte" },
  { id: 5, nombre: "Área 5 · Sierra centro y sur" },
  { id: 6, nombre: "Área 6 · Selva" },
  { id: 7, nombre: "Área 7 (R.J. 016-2026-INEI)" },
  { id: 8, nombre: "Área 8 (R.J. 016-2026-INEI)" },
  { id: 9, nombre: "Área 9 (R.J. 016-2026-INEI)" },
  { id: 10, nombre: "Área 10 (R.J. 016-2026-INEI)" },
  { id: 11, nombre: "Área 11 (R.J. 016-2026-INEI)" },
  { id: 12, nombre: "Área 12 (R.J. 016-2026-INEI)" },
  { id: 13, nombre: "Área 13 (R.J. 016-2026-INEI)" },
];

export const INDICES_UNIFICADOS: IndiceUnificado[] = [
  { codigo: 1, nombre: "Aceites", simbolo: "Ac", grupo: "materiales", io: 100, ir: 101.4 },
  { codigo: 2, nombre: "Acero liso", simbolo: "Al", grupo: "materiales", io: 100, ir: 101.6 },
  { codigo: 3, nombre: "Acero corrugado", simbolo: "A", grupo: "materiales", io: 100, ir: 101.8 },
  { codigo: 4, nombre: "Agregado fino", simbolo: "Af", grupo: "materiales", io: 100, ir: 102.0 },
  { codigo: 5, nombre: "Agregado grueso", simbolo: "Ag", grupo: "materiales", io: 100, ir: 101.5 },
  { codigo: 6, nombre: "Alambre y cable de cobre desnudo", simbolo: "Cu", grupo: "materiales", io: 100, ir: 103.1 },
  { codigo: 7, nombre: "Alambre y cable TW / THW", simbolo: "Tw", grupo: "materiales", io: 100, ir: 102.4 },
  { codigo: 8, nombre: "Alambre y cable tipo WP", simbolo: "Wp", grupo: "materiales", io: 100, ir: 102.2 },
  { codigo: 9, nombre: "Alcantarilla metálica", simbolo: "Am", grupo: "materiales", io: 100, ir: 101.3 },
  { codigo: 10, nombre: "Aparatos sanitarios y grifería", simbolo: "S", grupo: "materiales", io: 100, ir: 101.9 },
  { codigo: 11, nombre: "Aparatos de alumbrado para exteriores", simbolo: "Le", grupo: "materiales", io: 100, ir: 101.7 },
  { codigo: 12, nombre: "Aparatos de alumbrado para interiores", simbolo: "Li", grupo: "materiales", io: 100, ir: 101.6 },
  { codigo: 13, nombre: "Asfalto", simbolo: "As", grupo: "materiales", io: 100, ir: 104.2 },
  { codigo: 14, nombre: "Baldosa acústica", simbolo: "Ba", grupo: "materiales", io: 100, ir: 101.1 },
  { codigo: 16, nombre: "Baldosa vinílica", simbolo: "Bv", grupo: "materiales", io: 100, ir: 101.2 },
  { codigo: 17, nombre: "Bloques y ladrillos", simbolo: "Ld", grupo: "materiales", io: 100, ir: 102.3 },
  { codigo: 18, nombre: "Cables telefónicos", simbolo: "Ct", grupo: "materiales", io: 100, ir: 101.4 },
  { codigo: 19, nombre: "Cables y conductores NYY y N2XY", simbolo: "Ny", grupo: "materiales", io: 100, ir: 102.6 },
  { codigo: 20, nombre: "Cemento asfáltico", simbolo: "Ca", grupo: "materiales", io: 100, ir: 103.8 },
  { codigo: 21, nombre: "Cemento Portland tipo I", simbolo: "C", grupo: "materiales", io: 100, ir: 102.1 },
  { codigo: 22, nombre: "Cemento Portland tipo II", simbolo: "C2", grupo: "materiales", io: 100, ir: 102.0 },
  { codigo: 23, nombre: "Cemento Portland tipo V", simbolo: "C5", grupo: "materiales", io: 100, ir: 102.2 },
  { codigo: 24, nombre: "Cerámicas", simbolo: "Ce", grupo: "materiales", io: 100, ir: 101.8 },
  { codigo: 26, nombre: "Cerrajería de producción nacional", simbolo: "Cr", grupo: "materiales", io: 100, ir: 101.5 },
  { codigo: 27, nombre: "Detonante", simbolo: "Dt", grupo: "materiales", io: 100, ir: 100.8 },
  { codigo: 28, nombre: "Dinamita", simbolo: "Dn", grupo: "materiales", io: 100, ir: 100.9 },
  { codigo: 30, nombre: "Dólares americanos más inflación de USA", simbolo: "U", grupo: "servicios", io: 100, ir: 101.2 },
  { codigo: 31, nombre: "Ducto de concreto", simbolo: "Dc", grupo: "materiales", io: 100, ir: 101.6 },
  { codigo: 32, nombre: "Flete terrestre", simbolo: "Ft", grupo: "servicios", io: 100, ir: 103.0 },
  { codigo: 33, nombre: "Flete aéreo", simbolo: "Fa", grupo: "servicios", io: 100, ir: 102.5 },
  { codigo: 34, nombre: "Gasolina", simbolo: "Gs", grupo: "materiales", io: 100, ir: 103.5 },
  { codigo: 37, nombre: "Herramienta manual", simbolo: "Hm", grupo: "equipos", io: 100, ir: 101.3 },
  { codigo: 38, nombre: "Hormigón", simbolo: "H", grupo: "materiales", io: 100, ir: 101.7 },
  { codigo: 39, nombre: "Índice general de precios al consumidor", simbolo: "I", grupo: "general", io: 100, ir: 102.4 },
  { codigo: 40, nombre: "Loseta", simbolo: "Lo", grupo: "materiales", io: 100, ir: 101.4 },
  { codigo: 41, nombre: "Madera para tiras de piso", simbolo: "Mp", grupo: "materiales", io: 100, ir: 101.9 },
  { codigo: 42, nombre: "Madera importada para encofrado y carpintería", simbolo: "Mi", grupo: "materiales", io: 100, ir: 102.1 },
  { codigo: 43, nombre: "Madera nacional para encofrado y carpintería", simbolo: "M", grupo: "materiales", io: 100, ir: 102.6 },
  { codigo: 44, nombre: "Madera terciada para encofrado y carpintería", simbolo: "Tr", grupo: "materiales", io: 100, ir: 102.0 },
  { codigo: 45, nombre: "Madera terciada para encofrado", simbolo: "Te", grupo: "materiales", io: 100, ir: 101.8 },
  { codigo: 46, nombre: "Malla de acero", simbolo: "Ma", grupo: "materiales", io: 100, ir: 101.7 },
  { codigo: 47, nombre: "Mano de obra", simbolo: "J", grupo: "mano-obra", io: 100, ir: 104.5 },
  { codigo: 48, nombre: "Maquinaria y equipo nacional", simbolo: "E", grupo: "maquinaria", io: 100, ir: 101.2 },
  { codigo: 49, nombre: "Maquinaria y equipo importado", simbolo: "Ei", grupo: "maquinaria", io: 100, ir: 101.6 },
  { codigo: 50, nombre: "Marco y tapa de fierro fundido", simbolo: "Ff", grupo: "materiales", io: 100, ir: 101.4 },
  { codigo: 51, nombre: "Perfil de acero liviano", simbolo: "Pl", grupo: "materiales", io: 100, ir: 101.5 },
  { codigo: 52, nombre: "Perfil de aluminio", simbolo: "Pa", grupo: "materiales", io: 100, ir: 102.8 },
  { codigo: 53, nombre: "Petróleo diésel", simbolo: "D", grupo: "materiales", io: 100, ir: 105.0 },
  { codigo: 54, nombre: "Pintura látex", simbolo: "P", grupo: "materiales", io: 100, ir: 102.2 },
  { codigo: 55, nombre: "Pintura temple", simbolo: "Pt", grupo: "materiales", io: 100, ir: 101.9 },
  { codigo: 56, nombre: "Plancha de acero laminado en caliente", simbolo: "Lc", grupo: "materiales", io: 100, ir: 101.6 },
  { codigo: 57, nombre: "Plancha de acero laminado en frío", simbolo: "Lf", grupo: "materiales", io: 100, ir: 101.5 },
  { codigo: 59, nombre: "Plancha de fibrocemento", simbolo: "Fc", grupo: "materiales", io: 100, ir: 101.3 },
  { codigo: 60, nombre: "Plancha de poliuretano", simbolo: "Pu", grupo: "materiales", io: 100, ir: 101.8 },
  { codigo: 61, nombre: "Plancha de acero galvanizado", simbolo: "Pg", grupo: "materiales", io: 100, ir: 102.0 },
  { codigo: 62, nombre: "Poste de concreto", simbolo: "Po", grupo: "materiales", io: 100, ir: 101.4 },
  { codigo: 64, nombre: "Terrazo", simbolo: "Tz", grupo: "materiales", io: 100, ir: 101.5 },
  { codigo: 65, nombre: "Tubería de acero negro y galvanizado", simbolo: "Tn", grupo: "materiales", io: 100, ir: 102.1 },
  { codigo: 66, nombre: "Tubería de PVC para agua y alcantarillado", simbolo: "Tv", grupo: "materiales", io: 100, ir: 101.7 },
  { codigo: 68, nombre: "Tubería de cobre", simbolo: "Tc", grupo: "materiales", io: 100, ir: 103.2 },
  { codigo: 69, nombre: "Tubería de concreto simple", simbolo: "Cs", grupo: "materiales", io: 100, ir: 101.6 },
  { codigo: 70, nombre: "Tubería de concreto reforzado", simbolo: "Crf", grupo: "materiales", io: 100, ir: 101.8 },
  { codigo: 71, nombre: "Tubería de fierro fundido", simbolo: "Tf", grupo: "materiales", io: 100, ir: 101.5 },
  { codigo: 72, nombre: "Tubería de PVC", simbolo: "Pvc", grupo: "materiales", io: 100, ir: 101.6 },
  { codigo: 73, nombre: "Tubería para ductos telefónicos de PVC", simbolo: "Td", grupo: "materiales", io: 100, ir: 101.4 },
  { codigo: 77, nombre: "Válvula de bronce", simbolo: "Vb", grupo: "materiales", io: 100, ir: 101.7 },
  { codigo: 78, nombre: "Válvula de fierro fundido", simbolo: "Vf", grupo: "materiales", io: 100, ir: 101.5 },
  { codigo: 80, nombre: "Concreto premezclado", simbolo: "Cp", grupo: "materiales", io: 100, ir: 102.3 },
];

export const IU_BY_CODIGO: Record<number, IndiceUnificado> = Object.fromEntries(
  INDICES_UNIFICADOS.map((x) => [x.codigo, x])
);

export function codigoIU(n: number) {
  return String(n).padStart(2, "0");
}

export function nombreIU(n: number) {
  return IU_BY_CODIGO[n]?.nombre ?? `Índice ${codigoIU(n)}`;
}

export function simboloIU(n: number) {
  return IU_BY_CODIGO[n]?.simbolo ?? `I${codigoIU(n)}`;
}

export const LETRAS_MONOMIO = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export function defaultIndicesMap(campo: "io" | "ir"): Record<string, number> {
  const out: Record<string, number> = {};
  for (const iu of INDICES_UNIFICADOS) out[String(iu.codigo)] = iu[campo];
  return out;
}
