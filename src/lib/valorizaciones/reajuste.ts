import { calcularFormula } from "../presupuesto/formulaPolinomica";
import { codigoIU, nombreIU, simboloIU } from "../presupuesto/indicesUnificados";
import type { PresupuestoState } from "../presupuesto/types";
import type { FormulaManualState, ValorPeriodo } from "./types";

export type MonomioReajuste = {
  letra: string;
  iu: number;
  codigoIu: string;
  simbolo: string;
  nombre: string;
  coeficiente: number;
  io: number;
  ir: number;
  ratio: number;
};

export type ReajustePeriodo = {
  /** false si en Fórmula polinómica (PRE-02) todavía no se generó la fórmula del presupuesto. */
  aplicable: boolean;
  k: number;
  texto: string;
  monomios: MonomioReajuste[];
  costoDirectoBase: number;
  reajuste: number;
  costoDirectoReajustado: number;
};

function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function r4(n: number) {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/** Reajusta con una fórmula armada a mano en Valorizaciones (sin depender del presupuesto): por ejemplo, la fórmula
 *  ya aprobada que trae el expediente técnico con el que se va a valorizar la obra. */
function calcularReajusteManual(periodo: ValorPeriodo, costoDirectoPeriodo: number, formulaManual: FormulaManualState): ReajustePeriodo {
  const indicesIr = periodo.indicesIrPeriodo || {};
  const monomios: MonomioReajuste[] = formulaManual.monomios.map((m) => {
    const io = m.io > 0 ? m.io : 100;
    const ir = indicesIr[String(m.codigoIU)] ?? io;
    return {
      letra: m.letra,
      iu: m.codigoIU,
      codigoIu: codigoIU(m.codigoIU),
      simbolo: simboloIU(m.codigoIU),
      nombre: nombreIU(m.codigoIU),
      coeficiente: m.coeficiente,
      io,
      ir,
      ratio: io > 0 ? ir / io : 1,
    };
  });
  const aplicable = monomios.length > 0;
  const k = r4(monomios.reduce((s, m) => s + m.coeficiente * m.ratio, 0)) || (aplicable ? 0 : 1);
  const kUse = aplicable ? k : 1;
  const reajustado = r2(costoDirectoPeriodo * kUse);
  const texto = !aplicable
    ? "Fórmula manual sin monomios"
    : `K = ${monomios.map((m) => `${m.coeficiente.toFixed(3)} (${m.simbolo}r/${m.simbolo}o)`).join(" + ")}`;
  return {
    aplicable,
    k: kUse,
    texto,
    monomios,
    costoDirectoBase: costoDirectoPeriodo,
    reajuste: r2(reajustado - costoDirectoPeriodo),
    costoDirectoReajustado: reajustado,
  };
}

/** Reajusta el costo directo del periodo por fórmula polinómica (D.S. N.° 011-79-VC), usando el mes y los índices Ir
 *  propios de este periodo. Usa la fórmula manual de Valorizaciones si `formulaManual` está indicada y creada
 *  (por ejemplo, la del expediente técnico); si no, la fórmula armada en Fórmula polinómica (PRE-02) a partir del
 *  presupuesto. */
export function calcularReajustePeriodo(
  periodo: ValorPeriodo,
  costoDirectoPeriodo: number,
  pre: PresupuestoState,
  formulaManual?: FormulaManualState,
): ReajustePeriodo {
  if (formulaManual?.creada) return calcularReajusteManual(periodo, costoDirectoPeriodo, formulaManual);
  const indicesIr =
    periodo.indicesIrPeriodo && Object.keys(periodo.indicesIrPeriodo).length ? periodo.indicesIrPeriodo : pre.formula.indicesIr;
  const formula = {
    ...pre.formula,
    mesVal: periodo.mesValorizacion || pre.formula.mesVal,
    indicesIr,
    valorizacion: costoDirectoPeriodo,
  };
  const resultado = calcularFormula({ ...pre, formula });
  return {
    aplicable: resultado.creada && resultado.monomios.length > 0,
    k: resultado.k,
    texto: resultado.texto,
    monomios: resultado.monomios.map((m) => ({
      letra: m.letra,
      iu: m.iu,
      codigoIu: codigoIU(m.iu),
      simbolo: m.simbolo,
      nombre: m.nombre,
      coeficiente: m.coeficiente,
      io: m.io,
      ir: indicesIr[String(m.iu)] ?? m.ir,
      ratio: m.ratio,
    })),
    costoDirectoBase: costoDirectoPeriodo,
    reajuste: resultado.diferencial,
    costoDirectoReajustado: resultado.reajustado,
  };
}

export function patchIndiceIrPeriodo(periodo: ValorPeriodo, iu: number, valor: number): Record<string, number> {
  const base = { ...(periodo.indicesIrPeriodo || {}) };
  base[String(iu)] = Math.max(0, valor) || 0;
  return base;
}

export type FusionIndicesIrResultado = {
  indicesIrPeriodo: Record<string, number>;
  aplicados: number;
  noEncontrados: number;
};

/** Fusiona filas leídas de un CSV (letra, código IU o número de índice + Ir) sobre los índices Ir vigentes del periodo,
 *  sin necesidad de editarlos uno por uno en pantalla. Las filas cuya referencia no calce con ningún monomio se ignoran. */
export function fusionarIndicesIrCsv(
  periodo: ValorPeriodo,
  monomios: MonomioReajuste[],
  filas: { ref: string; ir: number }[],
): FusionIndicesIrResultado {
  const indicesIrPeriodo = { ...(periodo.indicesIrPeriodo || {}) };
  let aplicados = 0;
  let noEncontrados = 0;
  for (const fila of filas) {
    const refNorm = fila.ref.trim().toLowerCase();
    const m = monomios.find(
      (mm) => mm.codigoIu.toLowerCase() === refNorm || mm.letra.toLowerCase() === refNorm || String(mm.iu) === refNorm,
    );
    if (!m) {
      noEncontrados += 1;
      continue;
    }
    indicesIrPeriodo[String(m.iu)] = Math.max(0, fila.ir) || 0;
    aplicados += 1;
  }
  return { indicesIrPeriodo, aplicados, noEncontrados };
}

function toCsvField(v: string | number) {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exporta los monomios vigentes (con su Ir actual) como plantilla .csv: se edita la columna Ir en Excel y se reimporta. */
export function exportIndicesIrPlantillaCsv(monomios: MonomioReajuste[]) {
  const headers = ["Letra", "Codigo IU", "Nombre", "Io", "Ir"];
  const lines = [headers.map(toCsvField).join(",")];
  for (const m of monomios) {
    lines.push([m.letra, m.codigoIu, m.nombre, m.io.toFixed(2), m.ir.toFixed(2)].map(toCsvField).join(","));
  }
  return "﻿" + lines.join("\n");
}
