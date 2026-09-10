import type {
  AdelantosState,
  FormulaManualState,
  FrecuenciaValorizacion,
  MonomioManual,
  ValorItem,
  ValorPeriodo,
  ValorizacionesState,
} from "./types";

export function uidPeriodo() {
  return `VP${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
export function uidItem() {
  return `VI${Math.random().toString(36).slice(2, 9)}`;
}
export function uidMonomio() {
  return `MM${Math.random().toString(36).slice(2, 9)}`;
}

function defaultAdelantos(partial?: Partial<AdelantosState>): AdelantosState {
  return {
    directoMonto: Number(partial?.directoMonto) || 0,
    directoPct: Number(partial?.directoPct) || 0,
    directoFecha: partial?.directoFecha || "",
    materialesMonto: Number(partial?.materialesMonto) || 0,
    materialesFecha: partial?.materialesFecha || "",
  };
}

function monomioManualCompleto(o: Partial<MonomioManual>): MonomioManual {
  return {
    id: o.id || uidMonomio(),
    letra: o.letra || "a",
    codigoIU: Number(o.codigoIU) || 39,
    coeficiente: Number(o.coeficiente) || 0,
    io: Number(o.io) || 100,
  };
}

function defaultFormulaManual(partial?: Partial<FormulaManualState>): FormulaManualState {
  return {
    creada: Boolean(partial?.creada),
    monomios: Array.isArray(partial?.monomios) ? partial.monomios.map(monomioManualCompleto) : [],
  };
}

function esFormulaOrigen(v: unknown): v is ValorizacionesState["formulaOrigen"] {
  return v === "presupuesto" || v === "manual";
}

export function defaultValorizaciones(partial: Partial<ValorizacionesState> = {}): ValorizacionesState {
  const periodos = partial.periodos ?? [];
  return {
    obra: partial.obra || "",
    periodos,
    selPeriodoId: partial.selPeriodoId || periodos[periodos.length - 1]?.id || "",
    programadoManual: partial.programadoManual ? { ...partial.programadoManual } : {},
    adelantos: defaultAdelantos(partial.adelantos),
    plazoContractualDias: Number(partial.plazoContractualDias) || 0,
    formulaOrigen: esFormulaOrigen(partial.formulaOrigen) ? partial.formulaOrigen : "presupuesto",
    formulaManual: defaultFormulaManual(partial.formulaManual),
  };
}

function esTipo(v: unknown): v is ValorItem["tipo"] {
  return v === "adicional" || v === "deductivo" || v === "contractual";
}

function itemCompleto(o: Partial<ValorItem>): ValorItem {
  return {
    id: o.id || uidItem(),
    codigo: o.codigo || "",
    descripcion: o.descripcion || "",
    und: o.und || "und",
    metradoContractual: Number(o.metradoContractual) || 0,
    precioUnitario: Number(o.precioUnitario) || 0,
    metradoAnterior: Number(o.metradoAnterior) || 0,
    metradoPeriodo: Number(o.metradoPeriodo) || 0,
    origenCodigo: o.origenCodigo,
    tipo: esTipo(o.tipo) ? o.tipo : "contractual",
    vinculadoA: o.vinculadoA || undefined,
  };
}

function esFrecuencia(v: unknown): v is FrecuenciaValorizacion {
  return v === "mensual" || v === "bimestral" || v === "trimestral";
}

function esMes(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v);
}

function periodoCompleto(o: Partial<ValorPeriodo>): ValorPeriodo {
  const numero = Number(o.numero) || 1;
  const hasta = o.hasta || "";
  return {
    id: o.id || uidPeriodo(),
    numero,
    nombre: o.nombre?.trim() ? o.nombre : `Valorización N.° ${numero}`,
    frecuencia: esFrecuencia(o.frecuencia) ? o.frecuencia : "mensual",
    desde: o.desde || "",
    hasta,
    items: Array.isArray(o.items) ? o.items.map(itemCompleto) : [],
    estado: o.estado === "cerrada" ? "cerrada" : "abierta",
    notas: o.notas || "",
    mesValorizacion: esMes(o.mesValorizacion) ? o.mesValorizacion : hasta.slice(0, 7),
    indicesIrPeriodo:
      o.indicesIrPeriodo && typeof o.indicesIrPeriodo === "object" ? { ...o.indicesIrPeriodo } : undefined,
    plazoAdicionalDias: Number(o.plazoAdicionalDias) || 0,
    sustentoPlazoAdicional: o.sustentoPlazoAdicional || "",
    resolucionAprobacion: o.resolucionAprobacion || "",
    amortizacionDirecto: Number(o.amortizacionDirecto) || 0,
    amortizacionMateriales: Number(o.amortizacionMateriales) || 0,
    diasAtrasoInjustificado: Math.max(0, Number(o.diasAtrasoInjustificado) || 0),
    penalidadMoraManual: Number.isFinite(o.penalidadMoraManual) ? Math.max(0, o.penalidadMoraManual as number) : undefined,
  };
}

export function hydrateValorizaciones(raw: unknown): ValorizacionesState {
  const base = defaultValorizaciones();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<ValorizacionesState>;
  const periodos = Array.isArray(o.periodos) ? o.periodos.map(periodoCompleto) : [];
  const programadoManual: Record<string, number> = {};
  if (o.programadoManual && typeof o.programadoManual === "object") {
    for (const [k, v] of Object.entries(o.programadoManual as Record<string, unknown>)) {
      const n = Number(v);
      if (periodos.some((p) => p.id === k) && Number.isFinite(n)) programadoManual[k] = n;
    }
  }
  return {
    obra: typeof o.obra === "string" ? o.obra : base.obra,
    periodos,
    selPeriodoId:
      typeof o.selPeriodoId === "string" && periodos.some((p) => p.id === o.selPeriodoId)
        ? o.selPeriodoId
        : periodos[periodos.length - 1]?.id || "",
    programadoManual,
    adelantos: defaultAdelantos(o.adelantos),
    plazoContractualDias: Number(o.plazoContractualDias) || 0,
    formulaOrigen: esFormulaOrigen(o.formulaOrigen) ? o.formulaOrigen : "presupuesto",
    formulaManual: defaultFormulaManual(o.formulaManual),
  };
}
