import { mapaInsumos, sanitizarInsumosPropios } from "./insumosObra";
import { aliasMo } from "./manoObraOficial";
import { PARTIDAS } from "./partidas";
import { compararCapitulos, compararCodigoPartida } from "./rnMetrados";
import { codigoPartidaEquipamiento } from "./partidasEquipamiento";
import { defaultIndicesMap } from "./indicesUnificados";
import { ESPECIALIDAD_META, JORNADA_BASE, KIND_ORDER, esMoneda, money } from "./types";
import type { EspecialidadPre, FormulaPolinomicaState, Insumo, LineaPresupuesto, OrgNodo, Partida, PresupuestoState, RecetaItem, RecursoKind, SistemaContratacion } from "./types";
import { defaultCronograma, hydrateCronograma } from "../cronograma/state";
import { defaultValorizaciones, hydrateValorizaciones } from "../valorizaciones/state";

export function defaultFormula(): FormulaPolinomicaState {
  const now = new Date();
  const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    area: 1,
    mesBase: mes,
    mesVal: mes,
    indicesIo: defaultIndicesMap("io"),
    indicesIr: defaultIndicesMap("ir"),
    umbralPct: 5,
    maxMonomios: 8,
    valorizacion: 0,
    creada: false,
    destino: {},
    coeficientes: {},
    generadaCon: null,
  };
}

export function insumoPrecio(ins: Insumo, precios: Record<string, number>) {
  const v = precios[ins.id];
  return Number.isFinite(v) ? v : ins.precio;
}

export type RecursoApu = {
  insumo: Insumo;
  cantidad: number;
  precio: number;
  parcial: number;
  cuadrilla: number;
  rendimiento: number;
  usaJornada: boolean;
};

export function usaJornadaInsumo(ins: Insumo) {
  if (ins.id === "EQ-HIN") return false;
  if (ins.kind === "mo" || ins.kind === "maq") return true;
  return ins.kind === "eq" && ins.und === "hm";
}

export function cuadrillaDe(rec: RecetaItem) {
  return rec.cuadrilla && rec.cuadrilla > 0 ? rec.cuadrilla : 1;
}

/** Rendimiento en und. de partida / día. Si no está guardado, se deduce del coeficiente a jornada base. */
export function rendimientoDe(rec: RecetaItem, jornadaBase = JORNADA_BASE) {
  if (rec.rendimiento && rec.rendimiento > 0) return rec.rendimiento;
  if (!(rec.cantidad > 0)) return 0;
  return (cuadrillaDe(rec) * jornadaBase) / rec.cantidad;
}

export function cantidadDeRecurso(rec: RecetaItem, ins: Insumo, jornada: number) {
  if (ins.id === "EQ-HIN" || !usaJornadaInsumo(ins)) return rec.cantidad;
  const rend = rendimientoDe(rec);
  if (!(rend > 0)) return rec.cantidad;
  const h = jornada > 0 ? jornada : JORNADA_BASE;
  return (cuadrillaDe(rec) * h) / rend;
}

export type ApuCalculado = {
  partida: Partida;
  recursos: RecursoApu[];
  porKind: Record<RecursoKind, { items: RecursoApu[]; subtotal: number }>;
  herramientas: number;
  pu: number;
};

function emptyPorKind(): ApuCalculado["porKind"] {
  return {
    mo: { items: [], subtotal: 0 },
    mat: { items: [], subtotal: 0 },
    maq: { items: [], subtotal: 0 },
    eq: { items: [], subtotal: 0 },
  };
}

export function calcularApu(
  partida: Partida,
  precios: Record<string, number>,
  recetaOv?: RecetaItem[],
  extras?: Insumo[],
  jornada: number = JORNADA_BASE
): ApuCalculado {
  const receta = recetaOv ?? partida.receta;
  const byId = mapaInsumos(extras);
  const recursos: RecursoApu[] = [];
  let mo = 0;
  for (const rec of receta) {
    if (rec.insumoId === "EQ-HIN") continue;
    const oficial = aliasMo(rec.insumoId);
    const ins = byId[oficial] ?? byId[rec.insumoId];
    if (!ins) continue;
    const cantidad = cantidadDeRecurso(rec, ins, jornada);
    const precio = insumoPrecio(ins, precios);
    const parcial = cantidad * precio;
    const porJornada = usaJornadaInsumo(ins);
    recursos.push({
      insumo: ins,
      cantidad,
      precio,
      parcial,
      cuadrilla: porJornada ? cuadrillaDe(rec) : 0,
      rendimiento: porJornada ? rendimientoDe(rec) : 0,
      usaJornada: porJornada,
    });
    if (ins.kind === "mo") mo += parcial;
  }
  const fusionados = new Map<string, RecursoApu>();
  for (const rec of recursos) {
    const prev = fusionados.get(rec.insumo.id);
    if (!prev) {
      fusionados.set(rec.insumo.id, { ...rec });
      continue;
    }
    prev.cantidad += rec.cantidad;
    prev.parcial += rec.parcial;
    if (rec.usaJornada) {
      prev.cuadrilla += rec.cuadrilla;
    }
  }
  recursos.length = 0;
  recursos.push(...fusionados.values());
  const hinItem = receta.find((rec) => rec.insumoId === "EQ-HIN");
  const herramientas = hinItem ? (mo * hinItem.cantidad) / 100 : 0;
  if (herramientas > 0) {
    const ins = byId["EQ-HIN"];
    if (ins) {
      recursos.push({
        insumo: ins,
        cantidad: hinItem!.cantidad,
        precio: mo / 100,
        parcial: herramientas,
        cuadrilla: 0,
        rendimiento: 0,
        usaJornada: false,
      });
    }
  }
  const porKind = emptyPorKind();
  for (const rec of recursos) {
    porKind[rec.insumo.kind].items.push(rec);
    porKind[rec.insumo.kind].subtotal += rec.parcial;
  }
  const pu = recursos.reduce((s, rec) => s + rec.parcial, 0);
  return { partida, recursos, porKind, herramientas, pu };
}

function codigoTierrasEst(codigo: string) {
  return codigo.startsWith("ARQ-02.") ? `EST-02.${codigo.slice(7)}` : codigo;
}

export function migrarLineaTierrasEst(linea: LineaPresupuesto): LineaPresupuesto {
  const codigo = codigoTierrasEst(linea.codigo);
  const origenCodigo = linea.origenCodigo ? codigoTierrasEst(linea.origenCodigo) : linea.origenCodigo;
  if (codigo === linea.codigo && origenCodigo === linea.origenCodigo) return linea;
  return { ...linea, codigo, origenCodigo };
}

export function partidaPorCodigo(codigo: string) {
  const tierras = codigoTierrasEst(codigo);
  const canon = codigoPartidaEquipamiento(tierras);
  return (
    PARTIDAS.find((p) => p.codigo === tierras) ??
    PARTIDAS.find((p) => p.codigo === codigo) ??
    PARTIDAS.find((p) => p.codigo === canon)
  );
}

function normTexto(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_PARTIDA = new Set([
  "de", "del", "la", "el", "los", "las", "en", "con", "para", "por", "un", "una", "y", "o", "al", "se", "mm", "cm", "kg",
]);

/** Busca en el catálogo una partida cuya descripción coincida con lo visto en el plano. */
export function buscarPartidaPorTexto(texto: string, especialidad?: EspecialidadPre | null): Partida | null {
  const q = normTexto(texto);
  if (q.length < 5) return null;
  const tokens = q.split(" ").filter((t) => t.length > 2 && !STOP_PARTIDA.has(t));
  if (!tokens.length) return null;
  let best: Partida | null = null;
  let bestScore = 0;
  for (const p of PARTIDAS) {
    if (especialidad && p.especialidad !== especialidad) continue;
    const d = normTexto(`${p.codigo} ${p.descripcion} ${p.capitulo}`);
    if (d.includes(q) || q.includes(d)) return p;
    const hits = tokens.filter((t) => d.includes(t)).length;
    const score = hits / tokens.length + (d.includes(tokens[0]) ? 0.15 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore >= 0.62 ? best : null;
}

export function codigoOrigenLinea(linea: LineaPresupuesto) {
  return linea.origenCodigo || linea.codigo;
}

export function partidaCatalogoDeLinea(linea: LineaPresupuesto) {
  return partidaPorCodigo(codigoOrigenLinea(linea)) ?? partidaPorCodigo(linea.codigo);
}

/** Partida efectiva en obra: catálogo + código/descripción/unidad propios. El catálogo no se muta. */
export function partidaDeLinea(linea: LineaPresupuesto): Partida | null {
  const base = partidaCatalogoDeLinea(linea);
  if (!base) return null;
  const descripcion = (linea.descripcion ?? "").trim();
  const und = (linea.und ?? "").trim();
  return {
    ...base,
    codigo: codigoPartidaEquipamiento(linea.codigo),
    descripcion: descripcion || base.descripcion,
    und: und || base.und,
  };
}

export function siguienteCodigoPartida(origen: string, lineas: LineaPresupuesto[]) {
  const used = new Set([...lineas.map((l) => l.codigo), ...PARTIDAS.map((p) => p.codigo)]);
  let n = 2;
  while (used.has(`${origen}-${n}`)) n += 1;
  return `${origen}-${n}`;
}

export function clonarLineaPartida(linea: LineaPresupuesto, lineas: LineaPresupuesto[]): LineaPresupuesto {
  const catalog = partidaCatalogoDeLinea(linea);
  const origen = catalog?.codigo ?? codigoOrigenLinea(linea);
  const receta = (linea.receta ?? catalog?.receta ?? []).map((r) => ({ ...r }));
  return {
    id: uid(),
    codigo: siguienteCodigoPartida(origen, lineas),
    origenCodigo: origen,
    metrado: linea.metrado,
    receta,
    descripcion: linea.descripcion ?? catalog?.descripcion,
    und: linea.und,
  };
}

export type LineaCalc = {
  linea: LineaPresupuesto;
  partida: Partida;
  apu: ApuCalculado;
  parcial: number;
};

export type CapituloCalc = {
  capitulo: string;
  especialidad: EspecialidadPre;
  parcial: number;
  lineas: LineaCalc[];
};

export type EspecialidadCalc = {
  especialidad: EspecialidadPre;
  parcial: number;
  capitulos: CapituloCalc[];
};

export function calcularPresupuesto(state: PresupuestoState) {
  const lineas: LineaCalc[] = [];
  for (const linea of state.lineas) {
    const partida = partidaDeLinea(linea);
    if (!partida) continue;
    const apu = calcularApu(partida, state.precios, linea.receta, state.insumosPropios, state.jornada);
    lineas.push({ linea, partida, apu, parcial: apu.pu * linea.metrado });
  }

  const ordenLinea = new Map(state.lineas.map((l, i) => [l.id, i]));
  lineas.sort((a, b) => {
    const ea = ESPECIALIDAD_META[a.partida.especialidad].orden - ESPECIALIDAD_META[b.partida.especialidad].orden;
    if (ea) return ea;
    const ca = compararCapitulos(a.partida.capitulo, b.partida.capitulo);
    if (ca) return ca;
    const co = compararCodigoPartida(a.partida.codigo, b.partida.codigo);
    if (co) return co;
    return (ordenLinea.get(a.linea.id) ?? 0) - (ordenLinea.get(b.linea.id) ?? 0);
  });

  const costoDirecto = r2(lineas.reduce((s, l) => s + l.parcial, 0));
  const organigrama = state.organigrama ?? [];
  const ggBruto = state.ggModo === "organigrama" ? totalOrganigrama(organigrama) : (costoDirecto * state.gg) / 100;
  const gg = r2(ggBruto);
  const utilidad = r2((costoDirecto * state.utilidad) / 100);
  const subtotal = r2(costoDirecto + gg + utilidad);
  const igv = r2((subtotal * state.igv) / 100);
  const total = r2(subtotal + igv);
  const ggPct = costoDirecto > 0 ? (gg / costoDirecto) * 100 : 0;

  const especialidades: EspecialidadCalc[] = [];
  for (const l of lineas) {
    let esp = especialidades.find((e) => e.especialidad === l.partida.especialidad);
    if (!esp) {
      esp = { especialidad: l.partida.especialidad, parcial: 0, capitulos: [] };
      especialidades.push(esp);
    }
    let cap = esp.capitulos.find((c) => c.capitulo === l.partida.capitulo);
    if (!cap) {
      cap = { capitulo: l.partida.capitulo, especialidad: l.partida.especialidad, parcial: 0, lineas: [] };
      esp.capitulos.push(cap);
    }
    cap.lineas.push(l);
    cap.parcial += l.parcial;
    esp.parcial += l.parcial;
  }

  for (const esp of especialidades) {
    esp.capitulos.sort((a, b) => compararCapitulos(a.capitulo, b.capitulo));
    for (const cap of esp.capitulos) {
      cap.lineas.sort((a, b) => compararCodigoPartida(a.partida.codigo, b.partida.codigo));
    }
  }

  const capitulos = especialidades.flatMap((e) => e.capitulos);

  const porKindCd: Record<RecursoKind, number> = { mo: 0, mat: 0, maq: 0, eq: 0 };
  for (const l of lineas) {
    for (const kind of KIND_ORDER) {
      porKindCd[kind] += l.apu.porKind[kind].subtotal * l.linea.metrado;
    }
  }

  return {
    lineas,
    costoDirecto,
    gg,
    utilidad,
    subtotal,
    igv,
    total,
    ggPct,
    capitulos,
    especialidades,
    porKindCd,
  };
}

export function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function hijosDe(nodos: OrgNodo[], id: string | null) {
  return nodos.filter((n) => (n.parentId ?? null) === id);
}

export function costoPropioNodo(n: OrgNodo) {
  if (n.tipo === "grupo") return 0;
  if (n.tipo === "gasto") return Math.max(0, n.n || 1) * Math.max(0, n.monto);
  return Math.max(0, n.n) * Math.max(0, n.sueldo) * Math.max(0, n.meses);
}

export function costoRama(nodos: OrgNodo[], id: string): number {
  const n = nodos.find((x) => x.id === id);
  if (!n) return 0;
  return costoPropioNodo(n) + hijosDe(nodos, id).reduce((s, h) => s + costoRama(nodos, h.id), 0);
}

export function totalOrganigrama(nodos: OrgNodo[]) {
  return hijosDe(nodos, null).reduce((s, r) => s + costoRama(nodos, r.id), 0);
}

export function formulaNodo(n: OrgNodo) {
  if (n.tipo === "grupo") return "Suma de los cargos a su cargo";
  if (n.tipo === "gasto") {
    return n.n > 1 ? `${n.n} × S/ ${money(n.monto)}` : "Monto fijo de la obra";
  }
  const mes = n.meses === 1 ? "mes" : "meses";
  return `${n.n} pers. × S/ ${money(n.sueldo)} × ${n.meses} ${mes}`;
}

export function idsDescendientes(nodos: OrgNodo[], id: string): string[] {
  const out: string[] = [];
  const walk = (pid: string) => {
    for (const h of hijosDe(nodos, pid)) {
      out.push(h.id);
      walk(h.id);
    }
  };
  walk(id);
  return out;
}

export function quitarNodo(nodos: OrgNodo[], id: string) {
  const ban = new Set([id, ...idsDescendientes(nodos, id)]);
  return nodos.filter((n) => !ban.has(n.id));
}

function asegurarConductor(nodos: OrgNodo[]): OrgNodo[] {
  if (nodos.some((n) => n.id === "p-cho" || /conductor de camioneta/i.test(n.cargo))) return nodos;
  const parentId = nodos.some((n) => n.id === "g-adm") ? "g-adm" : null;
  return [
    ...nodos,
    { id: "p-cho", parentId, cargo: "Conductor de camioneta L. A2B", nombre: "", tipo: "persona", n: 1, sueldo: 2200, meses: 4, monto: 0 },
  ];
}

export function defaultOrganigrama(): OrgNodo[] {
  return [
    { id: "g-res", parentId: null, cargo: "Residencia de obra", nombre: "", tipo: "grupo", n: 0, sueldo: 0, meses: 0, monto: 0 },
    { id: "p-res", parentId: "g-res", cargo: "Residente de obra", nombre: "", tipo: "persona", n: 1, sueldo: 6500, meses: 4, monto: 0 },
    { id: "p-asi", parentId: "g-res", cargo: "Asistente de residencia", nombre: "", tipo: "persona", n: 1, sueldo: 3500, meses: 4, monto: 0 },
    { id: "p-mae", parentId: "g-res", cargo: "Maestro de obra", nombre: "", tipo: "persona", n: 1, sueldo: 2800, meses: 4, monto: 0 },
    { id: "p-sso", parentId: "g-res", cargo: "Supervisor SSOMA", nombre: "", tipo: "persona", n: 1, sueldo: 2500, meses: 4, monto: 0 },
    { id: "g-adm", parentId: null, cargo: "Administración de obra", nombre: "", tipo: "grupo", n: 0, sueldo: 0, meses: 0, monto: 0 },
    { id: "p-alm", parentId: "g-adm", cargo: "Almacenero", nombre: "", tipo: "persona", n: 1, sueldo: 1800, meses: 4, monto: 0 },
    { id: "p-cho", parentId: "g-adm", cargo: "Conductor de camioneta L. A2B", nombre: "", tipo: "persona", n: 1, sueldo: 2200, meses: 4, monto: 0 },
    { id: "x-ofi", parentId: "g-adm", cargo: "Oficina, útiles y movilidad", nombre: "", tipo: "gasto", n: 1, sueldo: 0, meses: 0, monto: 2500 },
  ];
}

export type CalcPresupuesto = ReturnType<typeof calcularPresupuesto>;

export type InsumoConsolidado = {
  insumo: Insumo;
  cantidad: number;
  precio: number;
  parcial: number;
  partidas: number;
};

export function consolidarInsumos(lineas: LineaCalc[]): InsumoConsolidado[] {
  const map = new Map<string, InsumoConsolidado>();
  // EQ-HIN (herramientas manuales) se recibe como un % sobre la mano de obra, no como una cantidad física — sumarlo
  // como si fuera cantidad×metrado (y quedarse con el precio de la primera partida vista) no tiene sentido. Se
  // acumula aparte y se agrega al final como una sola línea informativa, solo con el monto real (S/.).
  let herramientasIns: Insumo | null = null;
  let herramientasParcial = 0;
  let herramientasPartidas = 0;
  for (const l of lineas) {
    const seen = new Set<string>();
    for (const r of l.apu.recursos) {
      if (r.insumo.id === "EQ-HIN") {
        herramientasIns = r.insumo;
        herramientasParcial += r.parcial * l.linea.metrado;
        herramientasPartidas += 1;
        continue;
      }
      const cantObra = r.cantidad * l.linea.metrado;
      const parcialObra = r.parcial * l.linea.metrado;
      const prev = map.get(r.insumo.id);
      if (!prev) {
        map.set(r.insumo.id, {
          insumo: r.insumo,
          cantidad: cantObra,
          precio: r.precio,
          parcial: parcialObra,
          partidas: 1,
        });
        seen.add(r.insumo.id);
      } else {
        prev.cantidad += cantObra;
        prev.parcial += parcialObra;
        if (!seen.has(r.insumo.id)) {
          prev.partidas += 1;
          seen.add(r.insumo.id);
        }
      }
    }
  }
  const out = [...map.values()].sort((a, b) => a.insumo.codigo.localeCompare(b.insumo.codigo, "es"));
  if (herramientasIns && herramientasParcial > 0) {
    out.push({ insumo: herramientasIns, cantidad: 0, precio: 0, parcial: r2(herramientasParcial), partidas: herramientasPartidas });
  }
  return out;
}

export function defaultPresupuesto(): PresupuestoState {
  const fecha = new Date().toISOString().slice(0, 10);
  return {
    archivoId: undefined,
    archivoNombre: "",
    obra: "Obra nueva",
    lugar: "Perú",
    cliente: "Propietario",
    fecha,
    gg: 10,
    utilidad: 8,
    igv: 18,
    ggModo: "porcentaje",
    organigrama: defaultOrganigrama(),
    lineas: [],
    precios: {},
    formula: defaultFormula(),
    insumosPropios: [],
    moneda: "PEN",
    tipoCambio: 1,
    jornada: JORNADA_BASE,
    entidad: "",
    rucCliente: "",
    contratista: "",
    proyectista: "",
    residente: "",
    direccion: "",
    departamento: "",
    provincia: "",
    distrito: "",
    sistemaContratacion: "precios-unitarios",
    observaciones: "",
    cronograma: defaultCronograma({ proyecto: "Obra nueva", start: fecha }),
    valorizaciones: defaultValorizaciones({ obra: "Obra nueva" }),
  };
}

function sanitizarJornada(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return JORNADA_BASE;
  return Math.min(24, Math.max(1, Math.round(n * 10) / 10));
}

function sanitizarSistema(v: unknown): SistemaContratacion {
  if (v === "suma-alzada" || v === "costo-mas-porcentaje" || v === "precios-unitarios") return v;
  return "precios-unitarios";
}

const KEY = "memorcalc-pre-v2";

export function loadPresupuesto(): PresupuestoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultPresupuesto();
    const o = JSON.parse(raw) as Partial<PresupuestoState>;
    if (!Array.isArray(o.lineas)) return defaultPresupuesto();
    const organigrama = asegurarConductor(
      Array.isArray(o.organigrama) && o.organigrama.length ? o.organigrama : defaultOrganigrama()
    );
    const ggModo = o.ggModo === "organigrama" ? "organigrama" : "porcentaje";
    const baseF = defaultFormula();
    const formula: FormulaPolinomicaState = {
      ...baseF,
      ...(o.formula ?? {}),
      indicesIo: { ...baseF.indicesIo, ...(o.formula?.indicesIo ?? {}) },
      indicesIr: { ...baseF.indicesIr, ...(o.formula?.indicesIr ?? {}) },
      destino: { ...baseF.destino, ...(o.formula?.destino ?? {}) },
      coeficientes: { ...baseF.coeficientes, ...(o.formula?.coeficientes ?? {}) },
      creada: typeof o.formula?.creada === "boolean" ? o.formula.creada : Boolean(o.lineas?.length),
      generadaCon: o.formula?.generadaCon ?? null,
    };
    return {
      ...defaultPresupuesto(),
      ...o,
      organigrama,
      ggModo,
      formula,
      lineas: o.lineas.map(migrarLineaTierrasEst),
      insumosPropios: sanitizarInsumosPropios(o.insumosPropios),
      moneda: esMoneda(o.moneda) ? o.moneda : "PEN",
      tipoCambio: Number.isFinite(o.tipoCambio) && (o.tipoCambio as number) > 0 ? Number(o.tipoCambio) : 1,
      jornada: sanitizarJornada(o.jornada),
      sistemaContratacion: sanitizarSistema(o.sistemaContratacion),
      cronograma: hydrateCronograma(o.cronograma),
      valorizaciones: hydrateValorizaciones(o.valorizaciones),
    };
  } catch {
    return defaultPresupuesto();
  }
}

export function savePresupuesto(s: PresupuestoState) {
  const cronograma = hydrateCronograma(s.cronograma);
  const valorizaciones = hydrateValorizaciones(s.valorizaciones);
  const next: PresupuestoState = {
    ...s,
    cronograma: {
      ...cronograma,
      proyecto: s.obra?.trim() ? s.obra : cronograma.proyecto,
      start: s.fecha || cronograma.start,
    },
    valorizaciones: {
      ...valorizaciones,
      obra: s.obra?.trim() ? s.obra : valorizaciones.obra,
    },
  };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function uid() {
  return `L${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function uidOrg() {
  return `G${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
