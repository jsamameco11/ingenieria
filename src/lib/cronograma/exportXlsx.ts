import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { calcularPresupuesto } from "../presupuesto/engine";
import type { PresupuestoState } from "../presupuesto/types";
import { curvaSMensual, monthLabel } from "../valorizaciones/curvaS";
import { addDays, isWorking, parseISO, toISO } from "./calendar";
import { formatPred, schedule } from "./cpm";
import type { CronogramaState } from "./types";

const NAVY = "FF1B3650";
const NAVY_DARK = "FF14293F";
const CREAM = "FFE8E0D2";
const WHITE = "FFFFFFFF";
const BORDER_THIN = { style: "thin" as const, color: { argb: "FFB8B8B8" } };
const BORDERS_ALL = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };
const MONEY_FMT = "#,##0.00;[RED]-#,##0.00";
const PCT_FMT = "0.0%";

function tituloHoja(ws: ExcelJS.Worksheet, texto: string, cols = 9) {
  ws.mergeCells(1, 2, 1, cols);
  const c = ws.getCell(1, 2);
  c.value = texto;
  c.font = { name: "Calibri", size: 14, bold: true, color: { argb: NAVY } };
  ws.getRow(1).height = 24;
}

function encabezado(ws: ExcelJS.Worksheet, row: number, heads: string[]) {
  for (let i = 0; i < heads.length; i++) {
    const c = ws.getCell(row, 2 + i);
    c.value = heads[i];
    c.font = { name: "Calibri", size: 9, bold: true, color: { argb: WHITE } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = BORDERS_ALL;
  }
  ws.getRow(row).height = 24;
}

/** Hoja "Cronograma (Gantt)": WBS, tarea, inicio, fin, duración, predecesoras, % avance y ruta crítica — el
 *  diagrama de Gantt en formato tabla, imprimible y editable, ya que hoy PRE-03 no tiene ninguna exportación. */
function hojaGantt(wb: ExcelJS.Workbook, state: CronogramaState) {
  const ws = wb.addWorksheet("Cronograma", { views: [{ showGridLines: false }] });
  const widths: Record<number, number> = { 1: 2, 2: 10, 3: 44, 4: 12, 5: 12, 6: 10, 7: 12, 8: 9, 9: 9 };
  for (const [c, w] of Object.entries(widths)) ws.getColumn(Number(c)).width = w;
  tituloHoja(ws, `CRONOGRAMA DE OBRA — ${state.proyecto || ""}`);
  let row = 3;
  encabezado(ws, row, ["WBS", "Tarea", "Inicio", "Fin", "Duración (d)", "Predecesoras", "% Avance", "Crítica"]);
  row += 1;
  const computed = schedule(state);
  for (const t of computed) {
    if (t.hidden) continue;
    ws.getCell(row, 2).value = t.wbs;
    ws.getCell(row, 3).value = t.name;
    ws.getCell(row, 3).alignment = { indent: t.indent };
    ws.getCell(row, 4).value = t.es;
    ws.getCell(row, 5).value = t.ef;
    ws.getCell(row, 6).value = t.isMilestone ? 0 : t.duration;
    ws.getCell(row, 7).value = formatPred(t.pred, state.tasks);
    ws.getCell(row, 8).value = t.pct / 100;
    ws.getCell(row, 8).numFmt = PCT_FMT;
    ws.getCell(row, 9).value = t.critical ? "Sí" : "";
    for (let col = 2; col <= 9; col++) {
      const c = ws.getCell(row, col);
      c.border = BORDERS_ALL;
      c.font = { name: "Calibri", size: 9, bold: t.isSummary };
      if (t.isSummary) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CREAM } };
      if (col >= 6 && col !== 9) c.alignment = { ...(c.alignment ?? {}), horizontal: "right" };
      if (col === 9 && t.critical) c.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF9B1C1C" } };
    }
    row += 1;
  }
  ws.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];
}

/** Hoja "Curva S mensual": programado acumulado por mes (S/. y %) según el cronograma (Gantt/CPM) — el calendario
 *  de avance de obra programado del expediente técnico. */
function hojaCurvaS(wb: ExcelJS.Workbook, pre: PresupuestoState) {
  const { puntos, totalContrato } = curvaSMensual(pre);
  if (!puntos.length) return;
  const ws = wb.addWorksheet("Curva S mensual", { views: [{ showGridLines: false }] });
  ws.getColumn(1).width = 2;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 10;
  tituloHoja(ws, "CALENDARIO DE AVANCE DE OBRA PROGRAMADO (CURVA S)", 5);
  let row = 3;
  ws.mergeCells(row, 2, row, 5);
  ws.getCell(row, 2).value = `Monto total del contrato: ${totalContrato.toFixed(2)}`;
  ws.getCell(row, 2).font = { name: "Calibri", size: 9.5, italic: true };
  row += 2;
  encabezado(ws, row, ["Mes", "Programado del mes", "Programado acumulado", "% Acumulado"]);
  row += 1;
  for (const p of puntos) {
    ws.getCell(row, 2).value = p.label;
    ws.getCell(row, 3).value = p.programadoPeriodo;
    ws.getCell(row, 3).numFmt = MONEY_FMT;
    ws.getCell(row, 4).value = p.programadoAcumulado;
    ws.getCell(row, 4).numFmt = MONEY_FMT;
    ws.getCell(row, 5).value = p.programadoPct / 100;
    ws.getCell(row, 5).numFmt = PCT_FMT;
    for (let col = 2; col <= 5; col++) {
      const c = ws.getCell(row, col);
      c.border = BORDERS_ALL;
      c.font = { name: "Calibri", size: 9.5 };
      if (col >= 3) c.alignment = { horizontal: "right" };
    }
    row += 1;
  }
}

type ProgramaMensualPartida = {
  meses: string[];
  porPartida: { codigo: string; descripcion: string; porMes: Record<string, number>; total: number }[];
  totalPorMes: Record<string, number>;
  totalGeneral: number;
};

/** Distribuye el monto programado (con GG+utilidad+IGV) de cada partida entre los meses de su ejecución (según el
 *  CPM), igual que `programaDiario` de valorizaciones pero conservando el código de partida — para el calendario
 *  de avance de obra valorizado por partida × mes, documento habitual del expediente técnico. */
function programaMensualPorPartida(pre: PresupuestoState): ProgramaMensualPartida {
  const cronograma = pre.cronograma;
  const computed = schedule(cronograma);
  const calc = calcularPresupuesto(pre);
  const factor = calc.costoDirecto > 0 ? calc.total / calc.costoDirecto : 0;
  const parcialPorLineaId = new Map(calc.lineas.map((l) => [l.linea.id, l.parcial]));
  const descPorCodigo = new Map(calc.lineas.map((l) => [l.partida.codigo, l.linea.descripcion || l.partida.descripcion]));

  const porPartidaMes = new Map<string, Map<string, number>>();
  const mesesSet = new Set<string>();

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
    let porMes = porPartidaMes.get(t.partidaCodigo);
    if (!porMes) {
      porMes = new Map();
      porPartidaMes.set(t.partidaCodigo, porMes);
    }
    for (const iso of dias) {
      const mes = iso.slice(0, 7);
      mesesSet.add(mes);
      porMes.set(mes, (porMes.get(mes) || 0) + cuota);
    }
  }

  const meses = [...mesesSet].sort();
  const porPartida = [...porPartidaMes.entries()]
    .map(([codigo, mapa]) => {
      const porMes: Record<string, number> = {};
      let total = 0;
      for (const m of meses) {
        const v = mapa.get(m) || 0;
        porMes[m] = v;
        total += v;
      }
      return { codigo, descripcion: descPorCodigo.get(codigo) || codigo, porMes, total };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "es"));

  const totalPorMes: Record<string, number> = {};
  let totalGeneral = 0;
  for (const m of meses) {
    totalPorMes[m] = r2(porPartida.reduce((s, p) => s + p.porMes[m], 0));
    totalGeneral += totalPorMes[m];
  }
  return { meses, porPartida, totalPorMes, totalGeneral: r2(totalGeneral) };
}

function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Hoja "Calendario valorizado": matriz partida × mes con el monto programado de cada partida en cada mes — el
 *  documento que la Entidad exige junto al Gantt (calendario de avance de obra valorizado). */
function hojaCalendarioValorizado(wb: ExcelJS.Workbook, pre: PresupuestoState) {
  const prog = programaMensualPorPartida(pre);
  if (!prog.meses.length) return;
  const ws = wb.addWorksheet("Calendario valorizado", { views: [{ showGridLines: false }] });
  ws.getColumn(1).width = 2;
  ws.getColumn(2).width = 13;
  ws.getColumn(3).width = 38;
  for (let i = 0; i < prog.meses.length; i++) ws.getColumn(4 + i).width = 12;
  const colTotal = 4 + prog.meses.length;
  ws.getColumn(colTotal).width = 13;
  tituloHoja(ws, "CALENDARIO DE AVANCE DE OBRA VALORIZADO (POR PARTIDA)", colTotal - 1);
  let row = 3;
  const heads = ["Código", "Descripción", ...prog.meses.map(monthLabel), "Total"];
  for (let i = 0; i < heads.length; i++) {
    const c = ws.getCell(row, 2 + i);
    c.value = heads[i];
    c.font = { name: "Calibri", size: 9, bold: true, color: { argb: WHITE } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = BORDERS_ALL;
  }
  row += 1;
  for (const p of prog.porPartida) {
    ws.getCell(row, 2).value = p.codigo;
    ws.getCell(row, 3).value = p.descripcion;
    for (let i = 0; i < prog.meses.length; i++) {
      const c = ws.getCell(row, 4 + i);
      c.value = r2(p.porMes[prog.meses[i]]);
      c.numFmt = MONEY_FMT;
      c.alignment = { horizontal: "right" };
    }
    const ct = ws.getCell(row, colTotal);
    ct.value = r2(p.total);
    ct.numFmt = MONEY_FMT;
    ct.font = { bold: true };
    ct.alignment = { horizontal: "right" };
    for (let col = 2; col <= colTotal; col++) ws.getCell(row, col).border = BORDERS_ALL;
    row += 1;
  }
  ws.getCell(row, 2).value = "TOTAL";
  ws.mergeCells(row, 2, row, 3);
  for (let i = 0; i < prog.meses.length; i++) {
    const c = ws.getCell(row, 4 + i);
    c.value = prog.totalPorMes[prog.meses[i]];
    c.numFmt = MONEY_FMT;
  }
  ws.getCell(row, colTotal).value = prog.totalGeneral;
  ws.getCell(row, colTotal).numFmt = MONEY_FMT;
  for (let col = 2; col <= colTotal; col++) {
    const c = ws.getCell(row, col);
    c.font = { name: "Calibri", size: 9.5, bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_DARK } };
    if (col === 2) c.font = { ...c.font, color: { argb: WHITE } };
    c.border = BORDERS_ALL;
    c.alignment = { horizontal: col <= 3 ? "left" : "right" };
  }
}

/** Arma el libro .xlsx del cronograma: Gantt en tabla, curva S mensual y calendario de avance valorizado por
 *  partida × mes. Separado de `exportarCronogramaXlsx` para poder probarlo sin depender del navegador. */
export function construirLibroCronograma(pre: PresupuestoState): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MemoriaCalc";
  wb.created = new Date();
  hojaGantt(wb, pre.cronograma);
  hojaCurvaS(wb, pre);
  hojaCalendarioValorizado(wb, pre);
  return wb;
}

/** Exporta el cronograma completo a un archivo .xlsx y dispara la descarga en el navegador. */
export async function exportarCronogramaXlsx(pre: PresupuestoState) {
  const wb = construirLibroCronograma(pre);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const safe = (pre.obra || "Obra").replace(/[^\w-]+/g, "_");
  saveAs(blob, `Cronograma_${safe}.xlsx`);
}
