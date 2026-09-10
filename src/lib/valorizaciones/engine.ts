import { calcularApu, calcularPresupuesto, partidaPorCodigo, r2 } from "../presupuesto/engine";
import { ESPECIALIDAD_META, type PresupuestoState, type RecursoKind } from "../presupuesto/types";
import { calcularReajustePeriodo } from "./reajuste";
import {
  FRECUENCIA_META,
  type AdelantosState,
  type FrecuenciaValorizacion,
  type ItemTipo,
  type ValorItem,
  type ValorPeriodo,
  type ValorizacionesState,
} from "./types";
import { uidItem, uidPeriodo } from "./state";

/** Tramos de aprobación de prestaciones adicionales de obra (Ley N.° 32069, Ley General de Contrataciones Públicas,
 *  art. 64, y su Reglamento aprobado por D.S. N.° 009-2025-EF, arts. 194-196). El % se calcula neto de los
 *  presupuestos deductivos vinculados, sobre el monto del contrato original. Referencial: valide con el área legal. */
export const LIMITE_ADICIONAL_NIVEL1_PCT = 15;
export const LIMITE_ADICIONAL_NIVEL2_PCT = 30;
export const LIMITE_ADICIONAL_MAXIMO_PCT = 50;

/** Tope acumulado de penalidad (mora + otras) sobre el monto del contrato vigente (art. 119-120 del Reglamento). */
export const PENALIDAD_MORA_TOPE_PCT = 10;

export function addDiasISO(iso: string, dias: number) {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Signo aritmético del tipo de partida: los deductivos restan del costo directo valorizado. */
export function signoTipo(tipo: ItemTipo) {
  return tipo === "deductivo" ? -1 : 1;
}

export type ItemCalc = ValorItem & {
  metradoAcumulado: number;
  montoAnterior: number;
  montoPeriodo: number;
  montoAcumulado: number;
  montoContractual: number;
  /** % de avance acumulado a la fecha (mes anterior + este periodo), sobre el metrado contractual. */
  avancePct: number;
  /** % de avance acumulado al cierre del periodo anterior (antes de este periodo). */
  avancePctAnterior: number;
  /** % que aporta este periodo, sobre el metrado contractual (avancePct − avancePctAnterior). */
  avancePctPeriodo: number;
  saldoMetrado: number;
  /** Saldo por valorizar en soles (costo contractual menos lo acumulado a la fecha). 0 en adicionales/deductivos. */
  saldoMonto: number;
};

export function calcularItem(item: ValorItem): ItemCalc {
  const signo = signoTipo(item.tipo);
  const metradoAcumulado = r2(item.metradoAnterior + item.metradoPeriodo);
  const montoContractual = r2(item.metradoContractual * item.precioUnitario);
  const montoAnterior = r2(signo * item.metradoAnterior * item.precioUnitario);
  const montoPeriodo = r2(signo * item.metradoPeriodo * item.precioUnitario);
  const montoAcumulado = r2(signo * metradoAcumulado * item.precioUnitario);
  const esContractual = item.tipo === "contractual" && item.metradoContractual > 0;
  const avancePct = esContractual ? Math.min(999, (metradoAcumulado / item.metradoContractual) * 100) : 0;
  const avancePctAnterior = esContractual ? Math.min(999, (item.metradoAnterior / item.metradoContractual) * 100) : 0;
  const avancePctPeriodo = r2(Math.max(0, avancePct - avancePctAnterior));
  const saldoMetrado = item.tipo === "contractual" ? r2(Math.max(0, item.metradoContractual - metradoAcumulado)) : 0;
  const saldoMonto = item.tipo === "contractual" ? r2(Math.max(0, montoContractual - montoAcumulado)) : 0;
  return {
    ...item,
    metradoAcumulado,
    montoAnterior,
    montoPeriodo,
    montoAcumulado,
    montoContractual,
    avancePct,
    avancePctAnterior,
    avancePctPeriodo,
    saldoMetrado,
    saldoMonto,
  };
}

/** Factor de relación de precios (K) del mes de un periodo frente al mes base del presupuesto, según la fórmula
 *  polinómica (D.S. N.° 011-79-VC). Sirve para deflactar montos de adicionales/deductivos pactados a precios de la
 *  fecha, y compararlos en igualdad de condiciones con el monto del contrato original. K = 1 si aún no se creó la
 *  fórmula polinómica del presupuesto (no hay cómo deflactar; se asume el mismo nivel de precios). */
export function factorRelacionPeriodo(periodo: ValorPeriodo, pre: PresupuestoState): number {
  const k = calcularReajustePeriodo(periodo, 0, pre).k;
  return k > 0 ? k : 1;
}

function acumuladoDeflatadoPorTipo(
  periodos: ValorPeriodo[],
  hastaId: string,
  pre: PresupuestoState,
  tipo: "adicional" | "deductivo",
): { nominal: number; deflatado: number } {
  let nominal = 0;
  let deflatado = 0;
  for (const p of periodos) {
    const k = factorRelacionPeriodo(p, pre);
    for (const it of p.items) {
      if (it.tipo !== tipo) continue;
      const monto = r2(it.metradoPeriodo * it.precioUnitario);
      nominal += monto;
      deflatado += monto / k;
    }
    if (p.id === hastaId) break;
  }
  return { nominal: r2(nominal), deflatado: r2(deflatado) };
}

export type AlertaAdicional = "ninguna" | "nivel1" | "nivel2" | "nivel3" | "supera-maximo";

export type ResumenPeriodo = {
  costoDirectoContractual: number;
  costoDirectoPeriodo: number;
  costoDirectoAcumulado: number;
  costoDirectoAdicionalPeriodo: number;
  costoDirectoAdicionalAcumulado: number;
  costoDirectoDeductivoPeriodo: number;
  costoDirectoDeductivoAcumulado: number;
  /** Adicionales menos deductivos vinculados, a precios nominales (de la fecha en que se ejecutó cada uno). */
  costoDirectoAdicionalNetoAcumulado: number;
  /** Adicionales menos deductivos, deflactados al nivel de precios del presupuesto base (mes Io), para comparar
   *  contra el monto del contrato original en igualdad de condiciones (Ley N.° 32069, art. 64). */
  costoDirectoAdicionalNetoAcumuladoDeflatado: number;
  costoDirectoContractualVigente: number;
  gg: number;
  utilidad: number;
  subtotal: number;
  igv: number;
  totalPeriodo: number;
  totalAcumulado: number;
  totalContractual: number;
  avanceFisicoPct: number;
  avanceValorizadoPct: number;
  /** % de adicionales netos deflactados sobre el monto del contrato original (base de los tramos de aprobación). */
  pctAdicionalSobreContrato: number;
  alertaAdicional: AlertaAdicional;
};

export function resumenDePeriodo(periodo: ValorPeriodo, periodos: ValorPeriodo[], pre: PresupuestoState): ResumenPeriodo {
  const items = periodo.items.map(calcularItem);
  const contractuales = items.filter((i) => i.tipo === "contractual");
  const adicionales = items.filter((i) => i.tipo === "adicional");
  const deductivos = items.filter((i) => i.tipo === "deductivo");
  const costoDirectoContractual = r2(contractuales.reduce((s, i) => s + i.montoContractual, 0));
  const costoDirectoPeriodo = r2(items.reduce((s, i) => s + i.montoPeriodo, 0));
  const costoDirectoAcumulado = r2(items.reduce((s, i) => s + i.montoAcumulado, 0));
  const costoDirectoAdicionalPeriodo = r2(adicionales.reduce((s, i) => s + i.montoPeriodo, 0));
  const costoDirectoAdicionalAcumulado = r2(adicionales.reduce((s, i) => s + i.montoAcumulado, 0));
  const costoDirectoDeductivoPeriodo = r2(deductivos.reduce((s, i) => s + Math.abs(i.montoPeriodo), 0));
  const costoDirectoDeductivoAcumulado = r2(deductivos.reduce((s, i) => s + Math.abs(i.montoAcumulado), 0));
  const costoDirectoContractualVigente = calcularPresupuesto(pre).costoDirecto;
  const ggPct = pre.ggModo === "organigrama" && costoDirectoContractual > 0 ? 0 : pre.gg;
  const factorAcumulado = costoDirectoContractual > 0 ? costoDirectoAcumulado / costoDirectoContractual : 0;

  const { deflatado: adicionalDeflatado } = acumuladoDeflatadoPorTipo(periodos, periodo.id, pre, "adicional");
  const { deflatado: deductivoDeflatado } = acumuladoDeflatadoPorTipo(periodos, periodo.id, pre, "deductivo");
  const costoDirectoAdicionalNetoAcumulado = r2(costoDirectoAdicionalAcumulado - costoDirectoDeductivoAcumulado);
  const costoDirectoAdicionalNetoAcumuladoDeflatado = r2(adicionalDeflatado - deductivoDeflatado);

  const calcTotal = (costoDirecto: number) => {
    const gg = r2((costoDirecto * ggPct) / 100);
    const utilidad = r2((costoDirecto * pre.utilidad) / 100);
    const subtotal = r2(costoDirecto + gg + utilidad);
    const igv = r2((subtotal * pre.igv) / 100);
    const total = r2(subtotal + igv);
    return { gg, utilidad, subtotal, igv, total };
  };

  const acumulado = calcTotal(costoDirectoAcumulado);
  const periodoCalc = calcTotal(costoDirectoPeriodo);
  const contractual = calcTotal(costoDirectoContractual);

  const pctAdicionalSobreContrato =
    costoDirectoContractualVigente > 0 ? (costoDirectoAdicionalNetoAcumuladoDeflatado / costoDirectoContractualVigente) * 100 : 0;
  const alertaAdicional: AlertaAdicional =
    pctAdicionalSobreContrato > LIMITE_ADICIONAL_MAXIMO_PCT
      ? "supera-maximo"
      : pctAdicionalSobreContrato > LIMITE_ADICIONAL_NIVEL2_PCT
        ? "nivel3"
        : pctAdicionalSobreContrato > LIMITE_ADICIONAL_NIVEL1_PCT
          ? "nivel2"
          : pctAdicionalSobreContrato > 0
            ? "nivel1"
            : "ninguna";

  return {
    costoDirectoContractual,
    costoDirectoPeriodo,
    costoDirectoAcumulado,
    costoDirectoAdicionalPeriodo,
    costoDirectoAdicionalAcumulado,
    costoDirectoDeductivoPeriodo,
    costoDirectoDeductivoAcumulado,
    costoDirectoAdicionalNetoAcumulado,
    costoDirectoAdicionalNetoAcumuladoDeflatado,
    costoDirectoContractualVigente,
    gg: acumulado.gg,
    utilidad: acumulado.utilidad,
    subtotal: acumulado.subtotal,
    igv: acumulado.igv,
    totalPeriodo: periodoCalc.total,
    totalAcumulado: acumulado.total,
    totalContractual: contractual.total,
    avanceFisicoPct: costoDirectoContractual > 0 ? Math.min(100, factorAcumulado * 100) : 0,
    avanceValorizadoPct: costoDirectoContractual > 0 ? Math.min(100, factorAcumulado * 100) : 0,
    pctAdicionalSobreContrato,
    alertaAdicional,
  };
}

/** Suma, por código de partida, lo ya ejecutado en los periodos anteriores al indicado (o en todos, si no se indica). */
function acumuladoPrevioPorCodigo(periodos: ValorPeriodo[], antesDeId?: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of periodos) {
    if (antesDeId && p.id === antesDeId) break;
    for (const it of p.items) {
      map.set(it.codigo, (map.get(it.codigo) || 0) + it.metradoPeriodo);
    }
  }
  return map;
}

/** Arma (o refresca) los ítems contractuales de un periodo a partir de las partidas del presupuesto vigente. Las
 *  partidas adicionales y deductivas ya cargadas se conservan tal cual. */
export function importarPartidasAlPeriodo(periodo: ValorPeriodo, periodos: ValorPeriodo[], pre: PresupuestoState): ValorItem[] {
  const calc = calcularPresupuesto(pre);
  const previos = acumuladoPrevioPorCodigo(periodos, periodo.id);
  const existentes = new Map(periodo.items.map((it) => [it.codigo, it]));
  const contractuales: ValorItem[] = calc.lineas.map((l) => {
    const prev = existentes.get(l.partida.codigo);
    return {
      id: prev?.id || uidItem(),
      codigo: l.partida.codigo,
      descripcion: l.linea.descripcion || l.partida.descripcion,
      und: l.linea.und || l.partida.und,
      capitulo: l.partida.capitulo,
      especialidad: ESPECIALIDAD_META[l.partida.especialidad]?.label || l.partida.especialidad,
      metradoContractual: l.linea.metrado,
      precioUnitario: l.apu.pu,
      metradoAnterior: previos.get(l.partida.codigo) || 0,
      metradoPeriodo: prev?.metradoPeriodo || 0,
      origenCodigo: l.partida.codigo,
      tipo: "contractual",
    };
  });
  const fueraDePresupuesto = periodo.items.filter((it) => it.tipo !== "contractual");
  return [...contractuales, ...fueraDePresupuesto];
}

/** Agrega una prestación adicional o un presupuesto deductivo (fuera del contrato original) al periodo indicado. */
export function agregarItemFueraPresupuesto(
  periodo: ValorPeriodo,
  periodos: ValorPeriodo[],
  tipo: "adicional" | "deductivo",
  patch: { codigo?: string; descripcion: string; und: string; precioUnitario: number; metradoPeriodo: number; vinculadoA?: string },
): ValorItem {
  const prefijo = tipo === "adicional" ? "ADIC" : "DEDUC";
  const numero = periodo.items.filter((it) => it.tipo === tipo).length + 1;
  const codigo = patch.codigo?.trim() || `${prefijo}-${periodo.numero}.${numero}`;
  const previos = acumuladoPrevioPorCodigo(periodos, periodo.id);
  return {
    id: uidItem(),
    codigo,
    descripcion: patch.descripcion,
    und: patch.und || "und",
    metradoContractual: 0,
    precioUnitario: Math.max(0, patch.precioUnitario) || 0,
    metradoAnterior: previos.get(codigo) || 0,
    metradoPeriodo: Math.max(0, patch.metradoPeriodo) || 0,
    tipo,
    vinculadoA: tipo === "deductivo" ? patch.vinculadoA?.trim() || undefined : undefined,
  };
}

export function nuevoPeriodo(
  state: ValorizacionesState,
  pre: PresupuestoState,
  frecuencia: FrecuenciaValorizacion,
  desdeManual?: string,
): ValorPeriodo {
  const ultimo = state.periodos[state.periodos.length - 1];
  const desde = desdeManual || (ultimo?.hasta ? addDiasISO(ultimo.hasta, 1) : pre.fecha || new Date().toISOString().slice(0, 10));
  const dias = FRECUENCIA_META[frecuencia].dias;
  const numero = state.periodos.length + 1;
  const hasta = addDiasISO(desde, dias - 1);
  const periodo: ValorPeriodo = {
    id: uidPeriodo(),
    numero,
    nombre: `Valorización N.° ${numero}`,
    frecuencia,
    desde,
    hasta,
    items: [],
    estado: "abierta",
    notas: "",
    mesValorizacion: hasta.slice(0, 7),
    plazoAdicionalDias: 0,
    sustentoPlazoAdicional: "",
    resolucionAprobacion: "",
    amortizacionDirecto: 0,
    amortizacionMateriales: 0,
    diasAtrasoInjustificado: 0,
  };
  periodo.items = importarPartidasAlPeriodo(periodo, state.periodos, pre);
  return periodo;
}

export type InsumoPeriodo = {
  id: string;
  nombre: string;
  kind: RecursoKind;
  und: string;
  cantidad: number;
  precio: number;
  monto: number;
};

/** Calendario de adquisición de materiales y utilización de equipos del periodo, a partir de la receta APU. */
export function insumosDePeriodo(periodo: ValorPeriodo, pre: PresupuestoState): InsumoPeriodo[] {
  const acc = new Map<string, InsumoPeriodo>();
  for (const item of periodo.items) {
    if (!item.origenCodigo || !(item.metradoPeriodo > 0)) continue;
    const partida = partidaPorCodigo(item.origenCodigo);
    if (!partida) continue;
    const apu = calcularApu(partida, pre.precios, undefined, pre.insumosPropios, pre.jornada);
    for (const kind of ["mat", "maq", "eq"] as RecursoKind[]) {
      for (const r of apu.porKind[kind].items) {
        const cantidad = r.cantidad * item.metradoPeriodo;
        const prev = acc.get(r.insumo.id);
        if (prev) {
          prev.cantidad = r2(prev.cantidad + cantidad);
          prev.monto = r2(prev.monto + cantidad * r.precio);
        } else {
          acc.set(r.insumo.id, {
            id: r.insumo.id,
            nombre: r.insumo.nombre,
            kind,
            und: r.insumo.und,
            cantidad: r2(cantidad),
            precio: r.precio,
            monto: r2(cantidad * r.precio),
          });
        }
      }
    }
  }
  return [...acc.values()].sort((a, b) => b.monto - a.monto);
}

export function eliminarPeriodo(state: ValorizacionesState, id: string): ValorizacionesState {
  const periodos = state.periodos.filter((p) => p.id !== id).map((p, i) => ({ ...p, numero: i + 1 }));
  const selPeriodoId = state.selPeriodoId === id ? periodos[periodos.length - 1]?.id || "" : state.selPeriodoId;
  const programadoManual = { ...(state.programadoManual || {}) };
  delete programadoManual[id];
  return { ...state, periodos, selPeriodoId, programadoManual };
}

/** Aplica (fusiona) el programado acumulado importado por CSV para uno o más periodos, para la curva S. */
export function fijarProgramadoManual(state: ValorizacionesState, patch: Record<string, number>): ValorizacionesState {
  return { ...state, programadoManual: { ...(state.programadoManual || {}), ...patch } };
}

/** Quita el programado manual de un periodo (vuelve a usar el calculado del cronograma), o de todos si no se indica. */
export function limpiarProgramadoManual(state: ValorizacionesState, periodoId?: string): ValorizacionesState {
  if (!periodoId) return { ...state, programadoManual: {} };
  const programadoManual = { ...(state.programadoManual || {}) };
  delete programadoManual[periodoId];
  return { ...state, programadoManual };
}

export function actualizarAdelantos(state: ValorizacionesState, patch: Partial<AdelantosState>): ValorizacionesState {
  return { ...state, adelantos: { ...state.adelantos, ...patch } };
}

export function actualizarPlazoContractual(state: ValorizacionesState, dias: number): ValorizacionesState {
  return { ...state, plazoContractualDias: Math.max(0, dias) || 0 };
}

export function actualizarPeriodo(state: ValorizacionesState, id: string, patch: Partial<ValorPeriodo>): ValorizacionesState {
  return { ...state, periodos: state.periodos.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

export function actualizarItem(state: ValorizacionesState, periodoId: string, itemId: string, patch: Partial<ValorItem>): ValorizacionesState {
  return {
    ...state,
    periodos: state.periodos.map((p) =>
      p.id !== periodoId ? p : { ...p, items: p.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) },
    ),
  };
}

export function agregarItem(state: ValorizacionesState, periodoId: string, item: ValorItem): ValorizacionesState {
  return {
    ...state,
    periodos: state.periodos.map((p) => (p.id !== periodoId ? p : { ...p, items: [...p.items, item] })),
  };
}

export function quitarItem(state: ValorizacionesState, periodoId: string, itemId: string): ValorizacionesState {
  return {
    ...state,
    periodos: state.periodos.map((p) => (p.id !== periodoId ? p : { ...p, items: p.items.filter((it) => it.id !== itemId) })),
  };
}

export type ResumenAdelantos = {
  amortizacionDirectoPeriodo: number;
  amortizacionDirectoAcumulada: number;
  saldoAdelantoDirecto: number;
  amortizacionMaterialesPeriodo: number;
  amortizacionMaterialesAcumulada: number;
  saldoAdelantoMateriales: number;
  /** Cuota proporcional sugerida para este periodo (informativa; no se aplica sola). */
  cuotaDirectoSugerida: number;
};

/** Amortización de adelantos del periodo (Ley N.° 32069, arts. 178-181): la del adelanto directo se descuenta en
 *  cuotas proporcionales al monto de cada valorización; la de materiales, según su consumo real en obra. */
export function resumenAdelantos(
  periodo: ValorPeriodo,
  periodos: ValorPeriodo[],
  adelantos: AdelantosState,
  totalBrutoPeriodo: number,
): ResumenAdelantos {
  const idx = periodos.findIndex((p) => p.id === periodo.id);
  const anteriores = idx >= 0 ? periodos.slice(0, idx) : periodos.filter((p) => p.id !== periodo.id);
  const amortizacionDirectoAcumuladaAntes = r2(anteriores.reduce((s, p) => s + (p.amortizacionDirecto || 0), 0));
  const amortizacionMaterialesAcumuladaAntes = r2(anteriores.reduce((s, p) => s + (p.amortizacionMateriales || 0), 0));
  const amortizacionDirectoPeriodo = Math.max(0, periodo.amortizacionDirecto || 0);
  const amortizacionMaterialesPeriodo = Math.max(0, periodo.amortizacionMateriales || 0);
  const saldoPendienteAntesDeEstePeriodo = Math.max(0, r2(adelantos.directoMonto - amortizacionDirectoAcumuladaAntes));
  const cuotaDirectoSugerida = r2(
    Math.min(saldoPendienteAntesDeEstePeriodo, (Math.max(0, adelantos.directoPct) / 100) * Math.max(0, totalBrutoPeriodo)),
  );
  return {
    amortizacionDirectoPeriodo,
    amortizacionDirectoAcumulada: r2(amortizacionDirectoAcumuladaAntes + amortizacionDirectoPeriodo),
    saldoAdelantoDirecto: r2(Math.max(0, adelantos.directoMonto - amortizacionDirectoAcumuladaAntes - amortizacionDirectoPeriodo)),
    amortizacionMaterialesPeriodo,
    amortizacionMaterialesAcumulada: r2(amortizacionMaterialesAcumuladaAntes + amortizacionMaterialesPeriodo),
    saldoAdelantoMateriales: r2(
      Math.max(0, adelantos.materialesMonto - amortizacionMaterialesAcumuladaAntes - amortizacionMaterialesPeriodo),
    ),
    cuotaDirectoSugerida,
  };
}

function penalidadBrutaPeriodo(p: ValorPeriodo, montoContractualVigenteTotal: number, plazoContractualDias: number): number {
  if (Number.isFinite(p.penalidadMoraManual)) return Math.max(0, p.penalidadMoraManual as number);
  const dias = Math.max(0, p.diasAtrasoInjustificado || 0);
  if (!dias || !(plazoContractualDias > 0) || !(montoContractualVigenteTotal > 0)) return 0;
  const F = plazoContractualDias > 60 ? 0.25 : 0.4;
  const penalidadDiaria = (0.1 * montoContractualVigenteTotal) / (F * plazoContractualDias);
  return r2(penalidadDiaria * dias);
}

export type ResumenPenalidad = {
  /** Factor F aplicable: 0.25 si el plazo vigente es mayor a 60 días; 0.40 en caso contrario. */
  factorF: number;
  penalidadDiaria: number;
  penalidadPeriodo: number;
  penalidadAcumuladaAntes: number;
  penalidadAcumulada: number;
  /** true si la penalidad acumulada alcanzó el 10% del monto contractual vigente (causal de resolución del contrato). */
  topeAlcanzado: boolean;
};

/** Penalidad por mora del periodo (Ley N.° 32069, art. 120): 0.10 × Monto / (F × Plazo), por cada día de atraso
 *  injustificado imputable al contratista, acumulada hasta un tope del 10 % del monto del contrato vigente. */
export function calcularPenalidadPeriodo(
  periodo: ValorPeriodo,
  periodos: ValorPeriodo[],
  montoContractualVigenteTotal: number,
  plazoContractualDias: number,
): ResumenPenalidad {
  const idx = periodos.findIndex((p) => p.id === periodo.id);
  const hastaIdx = idx >= 0 ? idx : periodos.length - 1;
  const tope = r2((PENALIDAD_MORA_TOPE_PCT / 100) * montoContractualVigenteTotal);
  let acumBrutaAntes = 0;
  for (let i = 0; i < hastaIdx; i++) acumBrutaAntes += penalidadBrutaPeriodo(periodos[i], montoContractualVigenteTotal, plazoContractualDias);
  const brutaEste = penalidadBrutaPeriodo(periodo, montoContractualVigenteTotal, plazoContractualDias);
  const acumBrutaHasta = acumBrutaAntes + brutaEste;
  const penalidadAcumuladaAntes = r2(Math.min(tope, acumBrutaAntes));
  const penalidadAcumulada = r2(Math.min(tope, acumBrutaHasta));
  const F = plazoContractualDias > 60 ? 0.25 : 0.4;
  const penalidadDiaria =
    plazoContractualDias > 0 && montoContractualVigenteTotal > 0 ? r2((0.1 * montoContractualVigenteTotal) / (F * plazoContractualDias)) : 0;
  return {
    factorF: F,
    penalidadDiaria,
    penalidadPeriodo: r2(Math.max(0, penalidadAcumulada - penalidadAcumuladaAntes)),
    penalidadAcumuladaAntes,
    penalidadAcumulada,
    topeAlcanzado: acumBrutaHasta >= tope && tope > 0,
  };
}

export type LiquidacionPeriodo = {
  /** Monto bruto del periodo: costo directo (contractual + adicionales − deductivos) + GG + utilidad + IGV,
   *  más el reajuste por índices unificados, si corresponde. */
  montoBruto: number;
  reajustePeriodo: number;
  amortizacionDirecto: number;
  amortizacionMateriales: number;
  penalidad: number;
  /** Monto neto a pagar al contratista en esta valorización, luego de amortizaciones y penalidades. */
  montoNetoAPagar: number;
};

/** Liquida el monto neto a pagar de la valorización: bruto (con reajuste) menos amortización de adelantos y
 *  penalidad por mora del periodo. Es el importe que finalmente se certifica a la Entidad para el pago. */
export function calcularLiquidacionPeriodo(
  montoBrutoPeriodo: number,
  reajustePeriodo: number,
  adelantos: ResumenAdelantos,
  penalidad: ResumenPenalidad,
): LiquidacionPeriodo {
  const montoBruto = r2(montoBrutoPeriodo + reajustePeriodo);
  const montoNetoAPagar = r2(
    montoBruto - adelantos.amortizacionDirectoPeriodo - adelantos.amortizacionMaterialesPeriodo - penalidad.penalidadPeriodo,
  );
  return {
    montoBruto,
    reajustePeriodo,
    amortizacionDirecto: adelantos.amortizacionDirectoPeriodo,
    amortizacionMateriales: adelantos.amortizacionMaterialesPeriodo,
    penalidad: penalidad.penalidadPeriodo,
    montoNetoAPagar,
  };
}
