import { INSUMOS, INSUMO_BY_ID } from "./insumos";
import { INDICES_UNIFICADOS } from "./indicesUnificados";
import { esMoCatalogoOficial } from "./manoObraOficial";
import { KIND_META, type Insumo, type RecursoKind } from "./types";

export const UNIDADES_INSUMO = [
  "hh",
  "hm",
  "jornal",
  "und",
  "m",
  "m²",
  "m³",
  "kg",
  "t",
  "L",
  "gal",
  "bls",
  "glb",
  "pza",
  "bolsa",
  "día",
  "%",
  "viaje",
  "pto",
  "pnto",
  "juego",
  "kit",
  "rollo",
  "mes",
] as const;

export const IU_GRUPO_LABEL: Record<(typeof INDICES_UNIFICADOS)[number]["grupo"], string> = {
  "mano-obra": "Mano de obra",
  materiales: "Materiales",
  maquinaria: "Maquinaria y equipo",
  equipos: "Equipos y herramientas",
  servicios: "Fletes y servicios",
  general: "Índice general",
};

export function iuSugerido(kind: RecursoKind) {
  if (kind === "mo") return 47;
  if (kind === "maq") return 48;
  if (kind === "eq") return 37;
  return 39;
}

export function categoriaSugerida(kind: RecursoKind) {
  if (kind === "mo") return "Mano de obra";
  if (kind === "maq") return "Maquinaria";
  if (kind === "eq") return "Equipos y herramientas";
  return "Agregados";
}

export function undSugerida(kind: RecursoKind) {
  if (kind === "mo") return "hh";
  if (kind === "maq") return "hm";
  return "und";
}

export function indicesParaKind(kind: RecursoKind) {
  const grupo =
    kind === "mo" ? "mano-obra" : kind === "maq" ? "maquinaria" : kind === "eq" ? "equipos" : "materiales";
  const preferidos = INDICES_UNIFICADOS.filter((i) => i.grupo === grupo);
  const resto = INDICES_UNIFICADOS.filter((i) => i.grupo !== grupo);
  return { preferidos, resto };
}

export function esInsumoPropio(id: string) {
  return id.startsWith("OWN-");
}

export function catalogoInsumos(propios: Insumo[] | undefined): Insumo[] {
  const extra = Array.isArray(propios) ? propios : [];
  const base = INSUMOS.filter((i) => esMoCatalogoOficial(i));
  if (!extra.length) return base;
  const seen = new Set(extra.map((i) => i.id));
  return [...extra, ...base.filter((i) => !seen.has(i.id))];
}

export function mapaInsumos(propios: Insumo[] | undefined): Record<string, Insumo> {
  const extra = Array.isArray(propios) ? propios : [];
  if (!extra.length) return INSUMO_BY_ID;
  return { ...INSUMO_BY_ID, ...Object.fromEntries(extra.map((x) => [x.id, x])) };
}

function numCodigo(codigo: string, prefix: string) {
  const m = String(codigo).trim().toUpperCase().match(new RegExp(`^${prefix}-(\\d+)$`));
  return m ? Number(m[1]) : 0;
}

export function siguienteCodigo(kind: RecursoKind, propios: Insumo[] | undefined) {
  const prefix = KIND_META[kind].corto;
  let max = 0;
  for (const i of catalogoInsumos(propios)) {
    if (i.kind !== kind) continue;
    max = Math.max(max, numCodigo(i.codigo, prefix));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export function sanitizarInsumosPropios(raw: unknown): Insumo[] {
  if (!Array.isArray(raw)) return [];
  const kinds: RecursoKind[] = ["mo", "mat", "maq", "eq"];
  const out: Insumo[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Partial<Insumo>;
    if (!o.id || !o.codigo || !o.nombre) continue;
    if (!kinds.includes(o.kind as RecursoKind)) continue;
    out.push({
      id: String(o.id),
      codigo: String(o.codigo),
      kind: o.kind as RecursoKind,
      nombre: String(o.nombre),
      und: String(o.und || "und"),
      precio: Number.isFinite(Number(o.precio)) ? Number(o.precio) : 0,
      iu: Number.isFinite(Number(o.iu)) ? Number(o.iu) : iuSugerido(o.kind as RecursoKind),
      categoria: String(o.categoria || categoriaSugerida(o.kind as RecursoKind)),
    });
  }
  return out;
}

export function codigoUnico(
  kind: RecursoKind,
  codigoWanted: string,
  propios: Insumo[] | undefined,
  exceptId?: string
) {
  const prefix = KIND_META[kind].corto;
  const all = catalogoInsumos(propios).filter((i) => i.id !== exceptId);
  let n = numCodigo(codigoWanted, prefix);
  if (n <= 0) {
    n = 0;
    for (const i of all) {
      if (i.kind !== kind) continue;
      n = Math.max(n, numCodigo(i.codigo, prefix));
    }
    n += 1;
  }
  while (all.some((i) => i.codigo.toUpperCase() === `${prefix}-${String(n).padStart(3, "0")}`)) n += 1;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

export function crearInsumoObra(
  draft: Omit<Insumo, "id"> & { id?: string },
  propios: Insumo[] | undefined
): Insumo {
  const codigo = codigoUnico(draft.kind, draft.codigo, propios, draft.id);
  const id = draft.id && esInsumoPropio(draft.id) ? draft.id : `OWN-${codigo}`;
  return {
    id,
    kind: draft.kind,
    codigo,
    nombre: draft.nombre.trim(),
    und: draft.und.trim() || undSugerida(draft.kind),
    precio: Math.max(0, Number(draft.precio) || 0),
    iu: Number.isFinite(Number(draft.iu)) ? Number(draft.iu) : iuSugerido(draft.kind),
    categoria: draft.categoria.trim() || categoriaSugerida(draft.kind),
  };
}
