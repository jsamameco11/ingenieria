import type { CronogramaState } from "../cronograma/types";
import type { ValorizacionesState } from "../valorizaciones/types";
import type { VinculoRevit } from "./revit/types";

export type RecursoKind = "mo" | "mat" | "maq" | "eq";

export type EspecialidadPre =
  | "arquitectura"
  | "estructuras"
  | "sanitarias"
  | "electricas"
  | "comunicaciones"
  | "mecanicas"
  | "equipamiento"
  | "electromecanicas"
  | "pavimentos"
  | "saneamiento"
  | "carreteras"
  | "puentes"
  | "hidraulica"
  | "habilitaciones";

export type Insumo = {
  id: string;
  codigo: string;
  kind: RecursoKind;
  nombre: string;
  und: string;
  precio: number;
  /** Código del Índice Unificado INEI (IUPC) para fórmula polinómica. */
  iu: number;
  categoria: string;
};

export type FormulaPolinomicaState = {
  area: number;
  mesBase: string;
  mesVal: string;
  indicesIo: Record<string, number>;
  indicesIr: Record<string, number>;
  umbralPct: number;
  maxMonomios: number;
  valorizacion: number;
  /** La fórmula quedó registrada en la obra (no es solo un análisis). */
  creada: boolean;
  /**
   * Agrupación: código IU origen → código IU destino.
   * Si origen = destino, el índice es monomio propio.
   */
  destino: Record<string, number>;
  /** Coeficientes editados a mano, por IU del monomio. El resto se calcula de la incidencia. */
  coeficientes: Record<string, number>;
  /** Umbral y máximo usados al generar o regenerar. */
  generadaCon: { umbralPct: number; maxMonomios: number } | null;
};

export type RecetaItem = {
  insumoId: string;
  /** Coeficiente a jornada base (8 h): hh, hm o consumo de material por unidad de la partida. */
  cantidad: number;
  /** Personas o equipos de este recurso en la cuadrilla. Por defecto 1. */
  cuadrilla?: number;
  /** Producción diaria del recurso (und. de la partida / día). Cant. = cuadrilla × jornada / rendimiento. */
  rendimiento?: number;
};

export type Partida = {
  codigo: string;
  especialidad: EspecialidadPre;
  capitulo: string;
  descripcion: string;
  und: string;
  receta: RecetaItem[];
};

export type LineaPresupuesto = {
  id: string;
  codigo: string;
  metrado: number;
  /** Receta propia de la partida en obra. Si falta, se usa la del catálogo. */
  receta?: RecetaItem[];
  /** Código del catálogo del que se copió esta línea. Si existe, el APU y la receta base salen de ahí. */
  origenCodigo?: string;
  /** Descripción de obra. Si falta, se usa la del catálogo. El catálogo nunca se reescribe. */
  descripcion?: string;
  /** Unidad de obra. Si falta, se usa la del catálogo. */
  und?: string;
  /** Nota de metrado (lectura de plano, fórmula o partida adicional). */
  nota?: string;
  /** Vínculo al grupo del modelo Revit (UniqueId + campo medido). */
  vinculoRevit?: VinculoRevit;
};

export type OrgNodoTipo = "grupo" | "persona" | "gasto";
export type GgModo = "porcentaje" | "organigrama";

export type OrgNodo = {
  id: string;
  parentId: string | null;
  cargo: string;
  nombre: string;
  tipo: OrgNodoTipo;
  n: number;
  sueldo: number;
  meses: number;
  monto: number;
};

export type MonedaCodigo = "PEN" | "USD" | "EUR";

export const MONEDA_META: Record<MonedaCodigo, { codigo: MonedaCodigo; simbolo: string; nombre: string; iso: string }> = {
  PEN: { codigo: "PEN", simbolo: "S/", nombre: "Sol peruano", iso: "PEN" },
  USD: { codigo: "USD", simbolo: "US$", nombre: "Dólar estadounidense", iso: "USD" },
  EUR: { codigo: "EUR", simbolo: "€", nombre: "Euro", iso: "EUR" },
};

export const MONEDAS: MonedaCodigo[] = ["PEN", "USD", "EUR"];

export type SistemaContratacion = "precios-unitarios" | "suma-alzada" | "costo-mas-porcentaje";

export const SISTEMA_CONTRATACION_META: Record<SistemaContratacion, string> = {
  "precios-unitarios": "Precios unitarios",
  "suma-alzada": "Suma alzada",
  "costo-mas-porcentaje": "Costo más porcentaje",
};

/** Jornada (h/día) con la que están calibrados los rendimientos del catálogo. */
export const JORNADA_BASE = 8;

export const JORNADAS_TIPICAS = [7, 8, 8.5, 9, 10] as const;

export type PresupuestoState = {
  archivoId?: string;
  archivoNombre?: string;
  obra: string;
  lugar: string;
  cliente: string;
  fecha: string;
  gg: number;
  utilidad: number;
  igv: number;
  ggModo: GgModo;
  organigrama: OrgNodo[];
  lineas: LineaPresupuesto[];
  precios: Record<string, number>;
  formula: FormulaPolinomicaState;
  /** Insumos creados en esta obra. No modifican el catálogo ni las plantillas. */
  insumosPropios: Insumo[];
  moneda: MonedaCodigo;
  /** Soles por 1 unidad de moneda extranjera. 1 si la obra está en PEN. */
  tipoCambio: number;
  /** Horas de jornada laboral. Cantidad MO/MAQ = cuadrilla × jornada / rendimiento. */
  jornada: number;
  entidad: string;
  rucCliente: string;
  /** Empresa (o consorcio) ejecutora de la obra. Distinta de la Entidad contratante. Se imprime en las valorizaciones. */
  contratista: string;
  proyectista: string;
  residente: string;
  direccion: string;
  departamento: string;
  provincia: string;
  distrito: string;
  sistemaContratacion: SistemaContratacion;
  observaciones: string;
  /** Misma obra que APU y fórmula polinómica. */
  cronograma: CronogramaState;
  /** Programación de ejecución de obra: valorizaciones por periodo. */
  valorizaciones: ValorizacionesState;
  /** Plantilla semilla (para la hoja de metrados tipo Excel). */
  plantillaId?: string;
};

export type PresupuestoArchivo = {
  id: string;
  nombre: string;
  obra: string;
  cliente: string;
  lugar: string;
  partidas: number;
  total: number;
  savedAt: string;
  origen?: "nube" | "local";
};

export const CATEGORIAS_CAPECO = [
  "Mano de obra",
  "Cementos y aglomerantes",
  "Agregados",
  "Aceros y metales",
  "Ladrillos y bloques",
  "Maderas y tableros",
  "Drywall y cielos rasos",
  "Pinturas y recubrimientos",
  "Pisos y revestimientos",
  "Vidrios y aluminio",
  "Carpintería y cerrajería",
  "Aparatos sanitarios y grifería",
  "Tuberías y accesorios",
  "Instalaciones eléctricas",
  "Instalaciones electromecánicas",
  "Comunicaciones",
  "Instalaciones mecánicas y HVAC",
  "Replanteo y topografía",
  "Insumos no detallados",
  "Impermeabilizantes y aditivos",
  "Asfaltos y pavimentos",
  "Concretos y prefabricados",
  "Combustibles y lubricantes",
  "Maquinaria",
  "Equipos y herramientas",
  "Seguridad e incendio",
  "Fletes y servicios",
  "Obras hidráulicas",
  "Puentes y estructuras metálicas",
  "Alumbrado público y urbana",
  "Áreas verdes",
] as const;

export type CategoriaCapeco = (typeof CATEGORIAS_CAPECO)[number];

export const KIND_META: Record<RecursoKind, { label: string; corto: string; className: string }> = {
  mo: { label: "Mano de obra", corto: "MO", className: "pre-mo" },
  mat: { label: "Materiales", corto: "MAT", className: "pre-mat" },
  maq: { label: "Maquinaria", corto: "MAQ", className: "pre-maq" },
  eq: { label: "Equipos y herramientas", corto: "EQ", className: "pre-eq" },
};

export const KIND_ORDER: RecursoKind[] = ["mo", "mat", "maq", "eq"];

export const ESPECIALIDAD_META: Record<EspecialidadPre, { label: string; kicker: string; orden: number }> = {
  arquitectura: { label: "Arquitectura", kicker: "ARQ", orden: 1 },
  estructuras: { label: "Estructuras", kicker: "EST", orden: 2 },
  sanitarias: { label: "Instalaciones sanitarias", kicker: "IS", orden: 3 },
  electricas: { label: "Instalaciones eléctricas", kicker: "IE", orden: 4 },
  comunicaciones: { label: "Comunicaciones", kicker: "COM", orden: 5 },
  mecanicas: { label: "Instalaciones mecánicas", kicker: "IM", orden: 6 },
  equipamiento: { label: "Equipamiento hospitalario", kicker: "EQ", orden: 7 },
  electromecanicas: { label: "Instalaciones electromecánicas", kicker: "IEM", orden: 8 },
  pavimentos: { label: "Pavimentación", kicker: "PAV", orden: 9 },
  saneamiento: { label: "Saneamiento urbano", kicker: "SAN", orden: 10 },
  carreteras: { label: "Carreteras", kicker: "CAR", orden: 11 },
  puentes: { label: "Puentes", kicker: "PTE", orden: 12 },
  hidraulica: { label: "Hidráulica", kicker: "HID", orden: 13 },
  habilitaciones: { label: "Habilitaciones urbanas", kicker: "HAB", orden: 14 },
};

export const ESPECIALIDADES: EspecialidadPre[] = (
  Object.keys(ESPECIALIDAD_META) as EspecialidadPre[]
).sort((a, b) => ESPECIALIDAD_META[a].orden - ESPECIALIDAD_META[b].orden);

export function money(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function esMoneda(v: unknown): v is MonedaCodigo {
  return v === "PEN" || v === "USD" || v === "EUR";
}

export function simboloMoneda(codigo?: string) {
  return esMoneda(codigo) ? MONEDA_META[codigo].simbolo : MONEDA_META.PEN.simbolo;
}

export function moneyMon(n: number, moneda?: string, d = 2) {
  return `${simboloMoneda(moneda)} ${money(n, d)}`;
}
