import { addDays, isWorking, parseISO, toISO } from "../cronograma/calendar";
import { schedule } from "../cronograma/cpm";
import { calcularPresupuesto } from "../presupuesto/engine";
import type { PresupuestoState } from "../presupuesto/types";
import { resumenDePeriodo } from "./engine";
import type { ValorPeriodo } from "./types";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MESES[((m - 1) % 12 + 12) % 12]} ${y}`;
}

export type ProgramaDiario = {
  /** Monto (S/., incluye GG+utilidad+IGV) programado para cada día calendario con trabajo. */
  porDia: Map<string, number>;
  totalContrato: number;
  minDate: string;
  maxDate: string;
};

/** Distribuye el monto de cada actividad ligada a una partida entre sus días hábiles (ES→EF del CPM). */
export function programaDiario(pre: PresupuestoState): ProgramaDiario {
  const cronograma = pre.cronograma;
  const computed = schedule(cronograma);
  const calc = calcularPresupuesto(pre);
  const factor = calc.costoDirecto > 0 ? calc.total / calc.costoDirecto : 0;
  const parcialPorLineaId = new Map(calc.lineas.map((l) => [l.linea.id, l.parcial]));

  const porDia = new Map<string, number>();
  let minDate = "";
  let maxDate = "";

  for (const t of computed) {
    if (t.isSummary || t.isMilestone || !t.partidaCodigo || !t.id.startsWith("C-")) continue;
    const parcial = parcialPorLineaId.get(t.id.slice(2));
    if (!parcial) continue;
    const monto = parcial * factor;
    if (!(monto > 0)) continue;
    const dias: string[] = [];
    let cur = parseISO(t.es);
    const fin = parseISO(t.ef || t.es);
    let guard = 0;
    while (cur <= fin && guard < 4000) {
      if (isWorking(cronograma.calendar, cur)) dias.push(toISO(cur));
      cur = addDays(cur, 1);
      guard += 1;
    }
    if (!dias.length) dias.push(t.es);
    const cuota = monto / dias.length;
    for (const iso of dias) {
      porDia.set(iso, (porDia.get(iso) || 0) + cuota);
      if (!minDate || iso < minDate) minDate = iso;
      if (!maxDate || iso > maxDate) maxDate = iso;
    }
  }

  return { porDia, totalContrato: calc.total, minDate, maxDate };
}

export function acumuladoProgramadoHasta(prog: ProgramaDiario, isoHasta: string): number {
  let sum = 0;
  for (const [iso, monto] of prog.porDia) {
    if (iso <= isoHasta) sum += monto;
  }
  return Math.round(sum * 100) / 100;
}

export type PuntoCurvaMes = {
  key: string;
  label: string;
  programadoPeriodo: number;
  programadoAcumulado: number;
  programadoPct: number;
};

/** Curva S programada, agregada por mes calendario — para la vista del Cronograma. */
export function curvaSMensual(pre: PresupuestoState): { puntos: PuntoCurvaMes[]; totalContrato: number } {
  const prog = programaDiario(pre);
  const puntos: PuntoCurvaMes[] = [];
  if (prog.minDate && prog.maxDate) {
    const mensual = new Map<string, number>();
    for (const [iso, monto] of prog.porDia) {
      const key = iso.slice(0, 7);
      mensual.set(key, (mensual.get(key) || 0) + monto);
    }
    let [y, m] = prog.minDate.slice(0, 7).split("-").map(Number);
    const [yEnd, mEnd] = prog.maxDate.slice(0, 7).split("-").map(Number);
    let acumulado = 0;
    while (y < yEnd || (y === yEnd && m <= mEnd)) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const monto = mensual.get(key) || 0;
      acumulado += monto;
      puntos.push({
        key,
        label: monthLabel(key),
        programadoPeriodo: Math.round(monto * 100) / 100,
        programadoAcumulado: Math.round(acumulado * 100) / 100,
        programadoPct: prog.totalContrato > 0 ? Math.min(100, (acumulado / prog.totalContrato) * 100) : 0,
      });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
  return { puntos, totalContrato: prog.totalContrato };
}

export type PuntoCurvaPeriodo = {
  periodoId: string;
  numero: number;
  label: string;
  hasta: string;
  programadoAcumuladoPct: number;
  ejecutadoAcumuladoPct: number;
  programadoAcumuladoMonto: number;
  ejecutadoAcumuladoMonto: number;
  /** "gantt" = calculado del cronograma (Gantt/CPM); "csv" = importado manualmente y sobrescribe el del cronograma. */
  origenProgramado: "gantt" | "csv";
};

/** Curva S programada vs ejecutada, por periodo de valorización — para la pestaña Valorizaciones.
 *  El programado de cada periodo se calcula del cronograma (Gantt/CPM); si `programadoManual` trae un monto para su
 *  id, ese monto (importado por CSV) lo reemplaza — así no hace falta tener un cronograma armado en el presupuesto. */
export function curvaSPorPeriodo(
  pre: PresupuestoState,
  periodos: ValorPeriodo[],
  programadoManual?: Record<string, number>,
): { puntos: PuntoCurvaPeriodo[]; totalContrato: number } {
  const prog = programaDiario(pre);
  const puntos = periodos
    .filter((p) => p.hasta)
    .map((p) => {
      const resumen = resumenDePeriodo(p, periodos, pre);
      const manual = programadoManual?.[p.id];
      const programadoAcumuladoMonto = manual != null ? manual : acumuladoProgramadoHasta(prog, p.hasta);
      return {
        periodoId: p.id,
        numero: p.numero,
        label: p.nombre,
        hasta: p.hasta,
        programadoAcumuladoMonto,
        ejecutadoAcumuladoMonto: resumen.totalAcumulado,
        programadoAcumuladoPct: prog.totalContrato > 0 ? Math.min(100, (programadoAcumuladoMonto / prog.totalContrato) * 100) : 0,
        ejecutadoAcumuladoPct: prog.totalContrato > 0 ? Math.min(100, (resumen.totalAcumulado / prog.totalContrato) * 100) : 0,
        origenProgramado: manual != null ? "csv" : "gantt",
      } as PuntoCurvaPeriodo;
    });
  return { puntos, totalContrato: prog.totalContrato };
}

export type FusionProgramadoResultado = {
  patch: Record<string, number>;
  aplicados: number;
  noEncontrados: number;
};

/** Fusiona filas leídas de un CSV (periodo/fecha + % o monto programado) en montos programados por periodo, para
 *  aplicarlos como override manual de la curva S sin depender del cronograma. */
export function fusionarProgramadoCsv(
  periodos: ValorPeriodo[],
  totalContrato: number,
  filas: { ref?: string; hasta?: string; pct?: number; monto?: number }[],
): FusionProgramadoResultado {
  const patch: Record<string, number> = {};
  let aplicados = 0;
  let noEncontrados = 0;
  for (const fila of filas) {
    let periodo: ValorPeriodo | undefined;
    if (fila.hasta) periodo = periodos.find((p) => p.hasta === fila.hasta);
    if (!periodo && fila.ref) {
      const refNorm = fila.ref.trim().toLowerCase();
      const asNum = Number(refNorm.replace(/[^\d.]/g, ""));
      if (Number.isFinite(asNum) && asNum > 0) periodo = periodos.find((p) => p.numero === asNum);
      if (!periodo)
        periodo = periodos.find((p) => p.nombre.trim().toLowerCase() === refNorm || p.nombre.trim().toLowerCase().includes(refNorm));
    }
    if (!periodo) {
      noEncontrados += 1;
      continue;
    }
    const monto = fila.monto != null ? fila.monto : fila.pct != null ? (fila.pct / 100) * totalContrato : undefined;
    if (monto == null || !Number.isFinite(monto)) {
      noEncontrados += 1;
      continue;
    }
    patch[periodo.id] = Math.max(0, monto);
    aplicados += 1;
  }
  return { patch, aplicados, noEncontrados };
}

function toCsvField(v: string | number) {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exporta el programado vigente (calculado del cronograma, u override CSV ya aplicado) como plantilla: se edita el
 *  % en Excel y se reimporta, sin necesidad de armar o tocar el cronograma (Gantt). */
export function exportProgramadoPlantillaCsv(puntos: PuntoCurvaPeriodo[]) {
  const headers = ["Periodo", "Hasta", "Programado acumulado (%)", "Programado acumulado (S/.)"];
  const lines = [headers.map(toCsvField).join(",")];
  for (const p of puntos) {
    lines.push(
      [p.label, p.hasta, p.programadoAcumuladoPct.toFixed(2), p.programadoAcumuladoMonto.toFixed(2)].map(toCsvField).join(","),
    );
  }
  return "﻿" + lines.join("\n");
}
