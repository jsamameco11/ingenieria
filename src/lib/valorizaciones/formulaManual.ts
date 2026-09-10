import { codigoIU, nombreIU } from "../presupuesto/indicesUnificados";
import { uidMonomio } from "./state";
import type { FormulaManualState, MonomioManual, ValorizacionesState } from "./types";

const LETRAS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/** Cambia a la fórmula armada en Fórmula polinómica (PRE-02), sin perder lo escrito en la fórmula manual. */
export function usarFormulaDelPresupuesto(state: ValorizacionesState): ValorizacionesState {
  return { ...state, formulaOrigen: "presupuesto" };
}

/** Cambia a la fórmula manual de Valorizaciones (armada a mano, desde el expediente técnico). La marca como
 *  "creada" aunque todavía no tenga monomios, para no mostrar el mensaje de «vaya a Fórmula polinómica». */
export function usarFormulaManual(state: ValorizacionesState): ValorizacionesState {
  return { ...state, formulaOrigen: "manual", formulaManual: { ...state.formulaManual, creada: true } };
}

function nuevoMonomioManual(existentes: MonomioManual[]): MonomioManual {
  const usadas = new Set(existentes.map((m) => m.letra));
  const letra = LETRAS.find((l) => !usadas.has(l)) || LETRAS[existentes.length % LETRAS.length];
  return { id: uidMonomio(), letra, codigoIU: 39, coeficiente: 0, io: 100 };
}

/** Agrega una fila de monomio en blanco a la fórmula manual (letra siguiente, IU 39 · Índice general por defecto). */
export function agregarMonomioManual(state: ValorizacionesState): ValorizacionesState {
  const monomios = [...state.formulaManual.monomios, nuevoMonomioManual(state.formulaManual.monomios)];
  return { ...state, formulaManual: { creada: true, monomios } };
}

export function actualizarMonomioManual(
  state: ValorizacionesState,
  id: string,
  patch: Partial<Pick<MonomioManual, "letra" | "codigoIU" | "coeficiente" | "io">>,
): ValorizacionesState {
  return {
    ...state,
    formulaManual: {
      ...state.formulaManual,
      monomios: state.formulaManual.monomios.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    },
  };
}

export function quitarMonomioManual(state: ValorizacionesState, id: string): ValorizacionesState {
  return {
    ...state,
    formulaManual: { ...state.formulaManual, monomios: state.formulaManual.monomios.filter((m) => m.id !== id) },
  };
}

/** Reemplaza toda la fórmula manual (por ejemplo, tras importar un CSV con los monomios del expediente técnico). */
export function fijarMonomiosManual(state: ValorizacionesState, monomios: MonomioManual[]): ValorizacionesState {
  return { ...state, formulaOrigen: "manual", formulaManual: { creada: true, monomios } };
}

/** Convierte filas leídas de un CSV (letra opcional, código IU, coeficiente, Io) en monomios de la fórmula manual,
 *  asignando letra automática a las filas que no traigan una. */
export function monomiosDesdeCsv(filas: { letra?: string; codigoIU: number; coeficiente: number; io: number }[]): MonomioManual[] {
  const monomios: MonomioManual[] = [];
  for (const fila of filas) {
    const letra = fila.letra?.trim().toLowerCase() || nuevoMonomioManual(monomios).letra;
    monomios.push({ id: uidMonomio(), letra, codigoIU: fila.codigoIU, coeficiente: fila.coeficiente, io: fila.io });
  }
  return monomios;
}

export function sumaCoeficientesManual(formula: FormulaManualState): number {
  return Math.round(formula.monomios.reduce((s, m) => s + m.coeficiente, 0) * 1000) / 1000;
}

function toCsvField(v: string | number) {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exporta la fórmula manual vigente (o una plantilla en blanco con un monomio de ejemplo) como .csv: se completa o
 *  edita en Excel y se reimporta con «Importar fórmula (.csv)». */
export function exportFormulaManualPlantillaCsv(formula: FormulaManualState) {
  const headers = ["Letra", "Codigo IU", "Nombre", "Coeficiente", "Io"];
  const lines = [headers.map(toCsvField).join(",")];
  const filas = formula.monomios.length
    ? formula.monomios
    : [{ letra: "a", codigoIU: 47, coeficiente: 1, io: 100 }];
  for (const m of filas) {
    lines.push([m.letra, codigoIU(m.codigoIU), nombreIU(m.codigoIU), m.coeficiente.toFixed(3), m.io.toFixed(2)].map(toCsvField).join(","));
  }
  return "﻿" + lines.join("\n");
}
