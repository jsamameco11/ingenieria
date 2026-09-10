import { PARTIDAS } from "../partidas";
import { aplicarPlantilla, plantillaPorId } from "../plantillas";
import { loadPresupuesto } from "../engine";
import { cronogramaDesdePresupuesto } from "../../cronograma/desdePresupuesto";
import type { LineaPresupuesto, PresupuestoState } from "../types";
import type { RevitCampo, RevitElemento, RevitFila, RevitFilaEstado, RevitGrupo, RevitPaquete, RevitRol, VinculoRevit } from "./types";
import { uid } from "../engine";

const CONCRETO: Partial<Record<RevitRol, string>> = {
  zapata: "EST-04.01.01",
  dado: "EST-04.01.09",
  viga_cimentacion: "EST-04.01.08",
  cimiento_corrido: "EST-03.02.01",
  sobrecimiento: "EST-03.02.02",
  columna: "EST-04.01.02",
  placa: "EST-04.01.05",
  muro_concreto: "EST-04.05.01",
  viga: "EST-04.01.03",
  losa_aligerada: "EST-04.01.04",
  losa_maciza: "EST-04.01.07",
  escalera: "EST-04.01.06",
  cisterna: "EST-04.01.10",
  solado: "EST-03.01.02",
};

const ENCOFRADO: Partial<Record<RevitRol, string>> = {
  zapata: "EST-04.03.05",
  columna: "EST-04.03.01",
  dado: "EST-04.03.01",
  viga: "EST-04.03.02",
  viga_cimentacion: "EST-04.03.02",
  losa_aligerada: "EST-04.03.03",
  losa_maciza: "EST-04.03.04",
  placa: "EST-04.03.04",
  muro_concreto: "EST-04.03.04",
  escalera: "EST-04.03.04",
  cisterna: "EST-04.03.04",
};

const ACERO: Partial<Record<RevitRol, string>> = {
  zapata: "EST-04.02.01",
  dado: "EST-04.02.01",
  columna: "EST-04.02.02",
  viga: "EST-04.02.03",
  viga_cimentacion: "EST-04.02.03",
  losa_aligerada: "EST-04.02.04",
  losa_maciza: "EST-04.02.04",
  escalera: "EST-04.02.04",
  placa: "EST-04.02.05",
  muro_concreto: "EST-04.02.05",
  cisterna: "EST-04.02.05",
};

const UND: Record<RevitCampo, string> = {
  concreto_m3: "m³",
  encofrado_m2: "m²",
  acero_kg: "kg",
  area_planta_m2: "m²",
  longitud_m: "m",
  unidad_und: "und",
};

function codigoDe(rol: RevitRol, campo: RevitCampo) {
  if (campo === "concreto_m3") return CONCRETO[rol] ?? null;
  if (campo === "encofrado_m2") return ENCOFRADO[rol] ?? null;
  if (campo === "acero_kg") return ACERO[rol] ?? null;
  if (campo === "area_planta_m2" && rol === "losa_aligerada") return "EST-04.04.01";
  if (campo === "area_planta_m2" && rol === "albanileria") return "ARQ-05.01.01";
  return null;
}

function inferRol(g: Partial<RevitGrupo>): RevitRol {
  if (g.rol && g.rol !== "desconocido") return g.rol;
  const blob = `${g.familia ?? ""} ${g.tipo ?? ""} ${g.categoriaRevit ?? ""} ${g.nivel ?? ""}`.toLowerCase();
  const mat = (g.claseMaterial || inferMaterial(g.material || "")).toString();
  if (mat === "albanileria") return "albanileria";
  if (mat === "acero" && /rebar|armadura/.test(blob)) return "acero_suelto";
  if (/zapata|footing/.test(blob)) return "zapata";
  if (/dado|pedestal/.test(blob)) return "dado";
  if (/ciment|grade.?beam|amarre/.test(blob)) return "viga_cimentacion";
  if (/sobrecimiento|stem/.test(blob)) return "sobrecimiento";
  if (/cimiento|corrido/.test(blob)) return "cimiento_corrido";
  if (/column|pilar|columna/.test(blob) || /structuralcolumns/.test(blob)) return "columna";
  if (/placa|shear|muro de corte/.test(blob)) return "placa";
  if (/escalera|stair/.test(blob)) return "escalera";
  if (/cisterna|tanque|reservorio/.test(blob)) return "cisterna";
  if (/aliger|nervad|vigueta|waffle|rib/.test(blob)) return "losa_aligerada";
  if (/maciza|solid|flat.?slab/.test(blob)) return "losa_maciza";
  if (/viga|beam|framing/.test(blob)) return "viga";
  if (/losa|floor/.test(blob)) return "losa_maciza";
  if (/muro|wall/.test(blob) && mat.startsWith("concreto")) return "muro_concreto";
  if (/solado|falso piso/.test(blob)) return "solado";
  return "desconocido";
}

function inferMaterial(name: string): RevitGrupo["claseMaterial"] {
  const t = name.toLowerCase();
  if (/ladrillo|kk|pandereta|masonry|albañ/.test(t)) return "albanileria";
  if (/acero|steel|fy\s*4/.test(t) && !/concreto|hormig/.test(t)) return "acero";
  if (/madera|wood/.test(t)) return "madera";
  if (/simple|ciclop|fc\s*100|f'c\s*100/.test(t)) return "concreto_simple";
  if (/concreto|hormig|concrete/.test(t)) return "concreto_armado";
  return "otro";
}

function leerCantidades(raw: unknown): Partial<Record<RevitCampo, number>> {
  const cant = (raw ?? {}) as Record<string, number>;
  return {
    concreto_m3: Number(cant.concreto_m3 || 0) || undefined,
    encofrado_m2: Number(cant.encofrado_m2 || 0) || undefined,
    acero_kg: Number(cant.acero_kg || 0) || undefined,
    area_planta_m2: Number(cant.area_planta_m2 || 0) || undefined,
    longitud_m: Number(cant.longitud_m || 0) || undefined,
    unidad_und: Number(cant.unidad_und || 0) || undefined,
  };
}

function repartir(total: number | undefined, n: number, i: number) {
  if (!total || n <= 0) return undefined;
  const base = Math.round((total / n) * 1000) / 1000;
  if (i < n - 1) return base || undefined;
  const resto = Math.round((total - base * (n - 1)) * 1000) / 1000;
  return resto || undefined;
}

function parseElementos(
  raw: unknown,
  grupoId: string,
  tipo: string,
  nivel: string,
  uniqueIds: string[],
  nElementos: number,
  totales: Partial<Record<RevitCampo, number>>,
): RevitElemento[] {
  const rows = Array.isArray(raw) ? raw : [];
  if (rows.length) {
    return rows.map((row, i) => {
      const e = row as Record<string, unknown>;
      return {
        uniqueId: String(e.uniqueId || uniqueIds[i] || `${grupoId}-${i + 1}`),
        marca: String(e.marca || `${grupoId}-${String(i + 1).padStart(2, "0")}`),
        tipo: String(e.tipo || tipo),
        nivel: String(e.nivel || nivel),
        cantidades: leerCantidades(e.cantidades),
      };
    });
  }
  const n = Math.max(uniqueIds.length, nElementos, 1);
  const ids = uniqueIds.length === n ? uniqueIds : Array.from({ length: n }, (_, i) => uniqueIds[i] || `${grupoId}-${String(i + 1).padStart(2, "0")}`);
  return ids.map((id, i) => ({
    uniqueId: id,
    marca: `${grupoId}-${String(i + 1).padStart(2, "0")}`,
    tipo,
    nivel,
    cantidades: {
      concreto_m3: repartir(totales.concreto_m3, n, i),
      encofrado_m2: repartir(totales.encofrado_m2, n, i),
      acero_kg: repartir(totales.acero_kg, n, i),
      area_planta_m2: repartir(totales.area_planta_m2, n, i),
    },
  }));
}

export function elementosDeGrupo(g: RevitGrupo): RevitElemento[] {
  return g.elementos?.length ? g.elementos : parseElementos(undefined, g.grupoId, g.tipo, g.nivel, g.uniqueIds, g.nElementos, g.cantidades);
}

export function parsePaquete(raw: unknown): RevitPaquete {
  const o = (raw ?? {}) as Record<string, unknown>;
  const gruposIn = Array.isArray(o.grupos) ? o.grupos : [];
  const grupos: RevitGrupo[] = gruposIn.map((row, i) => {
    const g = row as Record<string, unknown>;
    const cant = (g.cantidades ?? {}) as Record<string, number>;
    const base: Partial<RevitGrupo> = {
      familia: String(g.familia || ""),
      tipo: String(g.tipo || ""),
      categoriaRevit: String(g.categoriaRevit || g.categoria || ""),
      material: String(g.material || ""),
      nivel: String(g.nivel || ""),
      rol: (g.rol as RevitRol) || "desconocido",
    };
    const rol = inferRol(base);
    const uniqueIds = Array.isArray(g.uniqueIds) ? g.uniqueIds.map(String) : [];
    const cantidades: Partial<Record<RevitCampo, number>> = {
      concreto_m3: Number(cant.concreto_m3 || 0) || undefined,
      encofrado_m2: Number(cant.encofrado_m2 || 0) || undefined,
      acero_kg: Number(cant.acero_kg || 0) || undefined,
      area_planta_m2: Number(cant.area_planta_m2 || 0) || undefined,
      longitud_m: Number(cant.longitud_m || 0) || undefined,
      unidad_und: Number(cant.unidad_und || 0) || undefined,
    };
    const grupoId = String(g.grupoId || `G-${i + 1}`);
    const nElementos = Number(g.nElementos || uniqueIds.length || 1) || 1;
    const parsed: RevitGrupo = {
      grupoId,
      rol,
      categoriaRevit: base.categoriaRevit || "",
      familia: base.familia || "Familia",
      tipo: base.tipo || "Tipo",
      material: base.material || "",
      claseMaterial: (g.claseMaterial as RevitGrupo["claseMaterial"]) || inferMaterial(String(g.material || "")),
      fc: typeof g.fc === "number" ? g.fc : null,
      nivel: base.nivel || "",
      nElementos,
      uniqueIds,
      cantidades,
      elementos: parseElementos(g.elementos, grupoId, base.tipo || "Tipo", base.nivel || "", uniqueIds, nElementos, cantidades),
      confianzaClasificacion: g.confianzaClasificacion === "media" || g.confianzaClasificacion === "baja" ? g.confianzaClasificacion : "alta",
      motivo: Array.isArray(g.motivo) ? g.motivo.map(String) : [`${rol} · ${base.familia} · ${base.tipo}`],
      addinVersion: g.addinVersion ? String(g.addinVersion) : undefined,
    };
    return parsed;
  });
  return {
    schema: "memoriacalc.revit.v1",
    paqueteId: String(o.paqueteId || crypto.randomUUID()),
    exportadoEn: String(o.exportadoEn || new Date().toISOString()),
    revit: (o.revit as RevitPaquete["revit"]) || {},
    obra: (o.obra as RevitPaquete["obra"]) || {},
    grupos,
    omitidos: Array.isArray(o.omitidos) ? (o.omitidos as RevitPaquete["omitidos"]) : [],
    addinVersion: o.addinVersion ? String(o.addinVersion) : undefined,
  };
}

export function cruzarPlantilla(paquete: RevitPaquete, plantillaId: string | undefined, lineas: LineaPresupuesto[]): RevitFila[] {
  const pl = plantillaId ? plantillaPorId(plantillaId) : undefined;
  const codigosPl = new Set((pl?.lineas ?? []).map((l) => l.codigo));
  const anexados = new Set(
    lineas.filter((l) => l.vinculoRevit).map((l) => `${l.vinculoRevit?.grupoId}|${l.vinculoRevit?.campo}`),
  );
  const filas: RevitFila[] = [];

  for (const g of paquete.grupos) {
    const campos = Object.entries(g.cantidades) as [RevitCampo, number | undefined][];
    for (const [campo, qty] of campos) {
      if (!qty || qty <= 0) continue;
      const codigo = codigoDe(g.rol, campo);
      const part = codigo ? PARTIDAS.find((p) => p.codigo === codigo) : undefined;
      let estado: RevitFilaEstado = "sin_identificar";
      let motivo = g.motivo[0] || "Sin regla";
      if (g.rol === "desconocido" || !codigo) {
        estado = "sin_identificar";
        motivo = "No se identificó partida. Asígela o créela en esta obra.";
      } else if (g.claseMaterial === "acero" && campo === "concreto_m3") {
        estado = "conflicto";
        motivo = "El material es acero y la cantidad es de concreto.";
      } else if (codigo && !part) {
        estado = "sin_identificar";
      } else if (codigosPl.size && !codigosPl.has(codigo)) {
        estado = "fuera_de_plantilla";
        motivo = `${codigo} · ${part?.descripcion ?? ""} · la plantilla no trajo este código.`;
      } else if (g.confianzaClasificacion !== "alta" || (g.fc == null && campo === "concreto_m3")) {
        estado = "revisar";
        motivo = `${codigo} · ${part?.descripcion ?? ""} · confirme familia y f'c.`;
      } else {
        estado = "sugerida";
        motivo = `${g.familia} · ${g.tipo} → ${codigo} ${part?.descripcion ?? ""} porque el rol es ${g.rol}.`;
      }
      if (anexados.has(`${g.grupoId}|${campo}`)) estado = "anexada";
      filas.push(filaDe(g, campo, qty, codigo, codigosPl, anexados, estado, motivo));
    }
  }

  return filas;
}

function filaDe(
  g: RevitGrupo,
  campo: RevitCampo,
  qty: number,
  codigo: string | null,
  plantilla: Set<string>,
  _anexados: Set<string>,
  estado: RevitFilaEstado,
  motivo: string,
): RevitFila {
  const part = codigo ? PARTIDAS.find((p) => p.codigo === codigo) : undefined;
  return {
    id: `${g.grupoId}-${campo}`,
    grupoId: g.grupoId,
    campo,
    rol: g.rol,
    familia: g.familia,
    tipo: g.tipo,
    nivel: g.nivel,
    und: part?.und ?? UND[campo],
    metrado: qty,
    codigo,
    descripcion: part?.descripcion ?? "Sin partida",
    estado,
    motivo,
    uniqueIds: g.uniqueIds,
    enPlantilla: Boolean(codigo && plantilla.has(codigo)),
  };
}

export function anexarFilas(lineas: LineaPresupuesto[], filas: RevitFila[], paquete: RevitPaquete): LineaPresupuesto[] {
  const elegibles = filas.filter((f) => f.codigo && f.metrado > 0 && (f.estado === "sugerida" || f.estado === "aceptada" || f.estado === "fuera_de_plantilla" || f.estado === "anexada" || f.estado === "revisar"));
  const agregados = new Map<
    string,
    { codigo: string; campo: RevitCampo; metrado: number; uniqueIds: string[]; grupoId: string; origenCodigo?: string; descripcion?: string; und?: string }
  >();
  for (const f of elegibles) {
    if (!f.codigo) continue;
    const key = `${f.codigo}|${f.campo}`;
    const prev = agregados.get(key);
    if (prev) {
      prev.metrado += f.metrado;
      prev.uniqueIds.push(...f.uniqueIds);
    } else {
      agregados.set(key, {
        codigo: f.codigo,
        campo: f.campo,
        metrado: f.metrado,
        uniqueIds: [...f.uniqueIds],
        grupoId: f.grupoId,
        origenCodigo: f.origenCodigo,
        descripcion: f.descripcion,
        und: f.und,
      });
    }
  }
  const next = lineas.map((l) => ({ ...l }));
  for (const a of agregados.values()) {
    const vinculo: VinculoRevit = {
      origen: "revit",
      paqueteId: paquete.paqueteId,
      grupoId: a.grupoId,
      campo: a.campo,
      uniqueIds: a.uniqueIds,
      exportadoEn: paquete.exportadoEn,
      metradoModelo: a.metrado,
    };
    const i = next.findIndex((l) => l.codigo === a.codigo && (!l.vinculoRevit || l.vinculoRevit.campo === a.campo));
    if (i >= 0) {
      if (next[i].vinculoRevit?.metradoManual) continue;
      next[i] = { ...next[i], metrado: a.metrado, vinculoRevit: vinculo };
    } else {
      next.push({
        id: uid(),
        codigo: a.codigo,
        origenCodigo: a.origenCodigo || a.codigo,
        descripcion: a.descripcion,
        und: a.und,
        metrado: a.metrado,
        vinculoRevit: vinculo,
      });
    }
  }
  return next;
}

export function semaforo(filas: RevitFila[]) {
  return {
    identificados: filas.filter((f) => f.estado === "sugerida" || f.estado === "aceptada" || f.estado === "anexada").length,
    revisar: filas.filter((f) => f.estado === "revisar" || f.estado === "fuera_de_plantilla" || f.estado === "hueco_modelo" || f.estado === "hueco_plantilla").length,
    anexados: filas.filter((f) => f.estado === "anexada").length,
    rojos: filas.filter((f) => f.estado === "conflicto" || f.estado === "sin_identificar").length,
    unidos: filas.filter((f) => Boolean(f.codigo)).length,
  };
}

export const CAMPO_LABEL: Record<RevitCampo, string> = {
  concreto_m3: "Concreto",
  encofrado_m2: "Encofrado",
  acero_kg: "Acero",
  area_planta_m2: "Área",
  longitud_m: "Longitud",
  unidad_und: "Unidad",
};

export const ROL_LABEL: Record<RevitRol, string> = {
  zapata: "Zapata",
  dado: "Dado",
  viga_cimentacion: "Viga de cimentación",
  cimiento_corrido: "Cimiento corrido",
  sobrecimiento: "Sobrecimiento",
  columna: "Columna",
  placa: "Placa / muro de corte",
  muro_concreto: "Muro de concreto",
  viga: "Viga",
  losa_aligerada: "Losa aligerada",
  losa_maciza: "Losa maciza",
  escalera: "Escalera",
  cisterna: "Cisterna",
  solado: "Solado",
  albanileria: "Albañilería",
  acero_suelto: "Acero suelto",
  desconocido: "Sin clasificar",
};

export type DetalleUnion = {
  uniqueId: string;
  marca: string;
  familia: string;
  tipo: string;
  nivel: string;
  grupoId: string;
  cantidad: number;
};

export type UnionPartida = {
  key: string;
  codigo: string | null;
  descripcion: string;
  campo: RevitCampo;
  und: string;
  rol: RevitRol;
  roles: RevitRol[];
  metrado: number;
  nElementos: number;
  filas: RevitFila[];
  elementos: DetalleUnion[];
  motivo: string;
  estado: RevitFilaEstado;
};

export function cantidadElemento(el: RevitElemento, campo: RevitCampo, grupoId: string, overrides: Record<string, number>) {
  const k = `${grupoId}|${el.uniqueId}|${campo}`;
  if (Object.prototype.hasOwnProperty.call(overrides, k)) return overrides[k];
  return el.cantidades[campo] ?? 0;
}

export function claveExclusion(grupoId: string, uniqueId: string, campo: string) {
  return `${grupoId}|${uniqueId}|${campo}`;
}

export function metradoGrupoCampo(
  g: RevitGrupo,
  campo: RevitCampo,
  overrides: Record<string, number>,
  extraidos?: Iterable<string>,
) {
  const skip = extraidos ? new Set(extraidos) : null;
  const all = elementosDeGrupo(g);
  const els = skip ? all.filter((el) => !skip.has(claveExclusion(g.grupoId, el.uniqueId, campo))) : all;
  if (!els.length) {
    if (skip && all.some((el) => skip.has(claveExclusion(g.grupoId, el.uniqueId, campo)))) return 0;
    return g.cantidades[campo] ?? 0;
  }
  return els.reduce((s, el) => s + cantidadElemento(el, campo, g.grupoId, overrides), 0);
}

function elementosDeFila(
  f: RevitFila,
  paquete: RevitPaquete,
  overrides: Record<string, number>,
  extraidos: Set<string>,
): DetalleUnion[] {
  const g = paquete.grupos.find((x) => x.grupoId === f.grupoId);
  if (!g) return [];
  const scoped = f.uniqueIds?.length
    ? elementosDeGrupo(g).filter((el) => f.uniqueIds.includes(el.uniqueId))
    : elementosDeGrupo(g);
  return scoped
    .filter((el) => !extraidos.has(claveExclusion(g.grupoId, el.uniqueId, f.campo)))
    .map((el) => ({
      uniqueId: el.uniqueId,
      marca: el.marca,
      familia: g.familia,
      tipo: el.tipo || g.tipo,
      nivel: el.nivel || g.nivel,
      grupoId: g.grupoId,
      cantidad: cantidadElemento(el, f.campo, g.grupoId, overrides),
    }));
}

export function unionesPorPartida(
  filas: RevitFila[],
  paquete: RevitPaquete,
  overrides: Record<string, number> = {},
  extraidos: Iterable<string> = [],
): UnionPartida[] {
  const skip = new Set(extraidos);
  const map = new Map<string, UnionPartida>();
  for (const f of filas) {
    const key = f.codigo ? `${f.codigo}|${f.campo}` : `fila:${f.id}`;
    const els = elementosDeFila(f, paquete, overrides, skip);
    const prev = map.get(key);
    if (prev) {
      prev.filas.push(f);
      prev.elementos.push(...els);
      prev.metrado += f.metrado;
      prev.nElementos += els.length || f.uniqueIds.length;
      if (!prev.roles.includes(f.rol)) prev.roles.push(f.rol);
      if (f.estado === "conflicto" || f.estado === "sin_identificar") prev.estado = f.estado;
    } else {
      map.set(key, {
        key,
        codigo: f.codigo,
        descripcion: f.descripcion,
        campo: f.campo,
        und: f.und,
        rol: f.rol,
        roles: [f.rol],
        metrado: f.metrado,
        nElementos: els.length || f.uniqueIds.length,
        filas: [f],
        elementos: els,
        motivo: f.motivo,
        estado: f.estado,
      });
    }
  }
  return [...map.values()].sort((a, b) => (a.codigo ?? "zzz").localeCompare(b.codigo ?? "zzz") || a.campo.localeCompare(b.campo));
}

export function resumenRol(filas: RevitFila[], roles: RevitRol | RevitRol[]) {
  const set = new Set(Array.isArray(roles) ? roles : [roles]);
  const campos: RevitCampo[] = ["concreto_m3", "encofrado_m2", "acero_kg", "area_planta_m2"];
  return campos
    .map((campo) => {
      const of = filas.filter((f) => set.has(f.rol) && f.campo === campo);
      const metrado = of.reduce((s, f) => s + f.metrado, 0);
      const first = of[0];
      return {
        campo,
        label: CAMPO_LABEL[campo],
        und: first?.und ?? UND[campo],
        metrado,
        codigo: first?.codigo ?? (first ? codigoDe(first.rol, campo) : null),
        descripcion: first?.descripcion ?? "",
      };
    })
    .filter((r) => r.metrado > 0);
}

function el(marca: string, uniqueId: string, tipo: string, nivel: string, cant: Partial<Record<RevitCampo, number>>): RevitElemento {
  return { uniqueId, marca, tipo, nivel, cantidades: cant };
}

function g(
  grupoId: string,
  rol: RevitRol,
  familia: string,
  tipo: string,
  nivel: string,
  elementos: RevitElemento[],
): RevitGrupo {
  const cantidades: Partial<Record<RevitCampo, number>> = {};
  for (const e of elementos) {
    for (const [k, v] of Object.entries(e.cantidades) as [RevitCampo, number | undefined][]) {
      if (v) cantidades[k] = (cantidades[k] ?? 0) + v;
    }
  }
  return {
    grupoId,
    rol,
    categoriaRevit: rol === "columna" ? "Structural Columns" : rol.startsWith("losa") ? "Floors" : "Structural Framing",
    familia,
    tipo,
    material: "Concreto f'c 210",
    claseMaterial: "concreto_armado",
    fc: 210,
    nivel,
    nElementos: elementos.length,
    uniqueIds: elementos.map((e) => e.uniqueId),
    cantidades,
    elementos,
    confianzaClasificacion: "alta",
    motivo: [`Familia ${familia}`, `Tipo ${tipo}`, "Material concreto armado"],
  };
}

function serie(grupoId: string, n: number, tipo: string, nivel: string, cant: Partial<Record<RevitCampo, number>>, marca: string): RevitElemento[] {
  return Array.from({ length: n }, (_, i) =>
    el(`${marca}-${String(i + 1).padStart(2, "0")}`, `${grupoId}-${String(i + 1).padStart(2, "0")}`, tipo, nivel, { ...cant }),
  );
}

/** Modelo de ejemplo: vivienda de 2 pisos, para ensayar la unión sin el add-in. */
export function paqueteDemoVivienda(): RevitPaquete {
  const zapatas = [
    ...serie("Z1", 5, "1.20×1.20×0.40", "Cimentación", { concreto_m3: 0.576, encofrado_m2: 1.92, acero_kg: 44 }, "Z"),
    ...serie("Z1", 3, "1.20×1.20×0.45", "Cimentación", { concreto_m3: 0.648, encofrado_m2: 2.16, acero_kg: 52 }, "Z").map((e, i) => ({
      ...e,
      marca: `Z-${String(i + 6).padStart(2, "0")}`,
      uniqueId: `Z1-${String(i + 6).padStart(2, "0")}`,
    })),
    el("Z-09", "Z1-09", "1.00×1.00×0.36", "Cimentación", { concreto_m3: 0.36, encofrado_m2: 1.44, acero_kg: 36 }),
  ];
  return {
    schema: "memoriacalc.revit.v1",
    paqueteId: "demo-vivienda-2p",
    exportadoEn: new Date().toISOString(),
    revit: { version: "2025", archivo: "Vivienda-2P-demo.rvt" },
    obra: { nombre: "Vivienda unifamiliar de 2 pisos", plantillaSugerida: "unifamiliar" },
    grupos: [
      g("Z1", "zapata", "Zapata aislada", "varias secciones", "Cimentación", zapatas),
      g("VC1", "viga_cimentacion", "Viga de cimentación", "25×40", "Cimentación", serie("VC1", 12, "25×40", "Cimentación", { concreto_m3: 0.32, encofrado_m2: 2.4, acero_kg: 43.2 }, "VC")),
      g("C1", "columna", "Columna rectangular", "25×40", "N1–N2", serie("C1", 12, "25×40", "N1–N2", { concreto_m3: 0.28, encofrado_m2: 3.36, acero_kg: 40.5 }, "C")),
      g("V1", "viga", "Viga peraltada", "25×50", "N1", serie("V1", 18, "25×50", "N1", { concreto_m3: 0.225, encofrado_m2: 1.8, acero_kg: 34 }, "V1")),
      g("V2", "viga", "Viga peraltada", "25×50", "N2", serie("V2", 18, "25×50", "N2", { concreto_m3: 0.225, encofrado_m2: 1.8, acero_kg: 34 }, "V2")),
      g("L1", "losa_aligerada", "Losa aligerada", "e=0.20 h=0.05", "N1", [
        el("L-N1-A", "L1-01", "e=0.20 h=0.05", "N1", { concreto_m3: 3.2, encofrado_m2: 4.1, acero_kg: 360, area_planta_m2: 32 }),
        el("L-N1-B", "L1-02", "e=0.20 h=0.05", "N1", { concreto_m3: 3.2, encofrado_m2: 4.1, acero_kg: 360, area_planta_m2: 32 }),
      ]),
      g("L2", "losa_aligerada", "Losa aligerada", "e=0.20 h=0.05", "N2", [
        el("L-N2-A", "L2-01", "e=0.20 h=0.05", "N2", { concreto_m3: 3.2, encofrado_m2: 4.1, acero_kg: 360, area_planta_m2: 32 }),
        el("L-N2-B", "L2-02", "e=0.20 h=0.05", "N2", { concreto_m3: 3.2, encofrado_m2: 4.1, acero_kg: 360, area_planta_m2: 32 }),
      ]),
      g("E1", "escalera", "Escalera de concreto", "Tramo 1.20", "N1–N2", [
        el("ESC-01", "E1-01", "Tramo 1.20", "N1–N2", { concreto_m3: 1.15, encofrado_m2: 6.8, acero_kg: 148 }),
      ]),
      g("X1", "desconocido", "Familia genérica", "Muro 0.15", "N1", [
        el("MX-01", "X1-01", "Muro 0.15", "N1", { area_planta_m2: 12.4 }),
        el("MX-02", "X1-02", "Muro 0.15", "N1", { area_planta_m2: 8.1 }),
        el("MX-03", "X1-03", "Tabique 0.10", "N2", { area_planta_m2: 6.6 }),
      ]),
    ],
  };
}

export function aplicarVinculosAlPresupuesto(
  plantillaId: string,
  filas: RevitFila[],
  paquete: RevitPaquete,
): PresupuestoState {
  const actual = loadPresupuesto();
  const fromPlantilla = aplicarPlantilla(plantillaId) ?? actual;
  const catalogo =
    actual.plantillaId === plantillaId && actual.lineas.length
      ? actual.lineas
      : fromPlantilla.lineas;
  // Las líneas que ya estaban vinculadas a un paquete Revit anterior y no aparecen en este nuevo paquete se ponen
  // en 0, pero se marcan `ausenteEnModelo` (en vez de perder el vínculo en silencio) para que la Hoja de
  // Presupuesto pueda advertir "sin metrado del modelo" en vez de mostrar un metrado 0 indistinguible de uno real.
  const vacias = catalogo.map((l) => {
    if (l.vinculoRevit?.metradoManual) return l;
    if (l.vinculoRevit) {
      return { ...l, metrado: 0, vinculoRevit: { ...l.vinculoRevit, ausenteEnModelo: true, metradoModelo: 0 } };
    }
    return { ...l, metrado: 0, vinculoRevit: undefined };
  });
  const aceptadas = filas.map((f) => (f.codigo && f.metrado > 0 ? { ...f, estado: "aceptada" as const } : f));
  const next: PresupuestoState = {
    ...fromPlantilla,
    ...actual,
    plantillaId,
    obra: actual.obra || fromPlantilla.obra,
    lineas: anexarFilas(vacias, aceptadas, paquete),
  };
  return { ...next, cronograma: cronogramaDesdePresupuesto(next) };
}
