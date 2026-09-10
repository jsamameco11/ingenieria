import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { claveSubcapitulo, compararCapitulos, etiquetaSubcapitulo, partesTituloCapitulo } from "../presupuesto/rnMetrados";
import { SISTEMA_CONTRATACION_META, type PresupuestoState } from "../presupuesto/types";
import type { ItemCalc, LiquidacionPeriodo, ResumenAdelantos, ResumenPenalidad, ResumenPeriodo } from "./engine";
import type { ReajustePeriodo } from "./reajuste";
import type { ValorPeriodo } from "./types";

const NAVY = "FF1B3650";
const NAVY_DARK = "FF14293F";
const CREAM = "FFE8E0D2";
const TAN = "FFF4EFE4";
const WHITE = "FFFFFFFF";
const BORDER_THIN = { style: "thin" as const, color: { argb: "FFB8B8B8" } };
const BORDERS_ALL = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };

type SubBloqueX = { clave: string; titulo: string; items: ItemCalc[] };
type CapBloqueX = { capitulo: string; num: string; nombre: string; items: ItemCalc[]; subs: SubBloqueX[] };
type EspBloqueX = { especialidad: string; items: ItemCalc[]; capitulos: CapBloqueX[] };

/** Agrupa las partidas contractuales por especialidad → capítulo → subcapítulo, igual que en pantalla (Valorización
 *  de obra) y en la Hoja de Presupuesto, a partir del capítulo/especialidad fijados en cada ítem al importar. */
function agruparParaExcel(items: ItemCalc[]): { especialidades: EspBloqueX[]; sinCapitulo: ItemCalc[] } {
  const porEsp = new Map<string, EspBloqueX>();
  const sinCapitulo: ItemCalc[] = [];
  for (const it of items) {
    if (!it.capitulo) {
      sinCapitulo.push(it);
      continue;
    }
    const label = it.especialidad || "Sin especialidad";
    let esp = porEsp.get(label);
    if (!esp) {
      esp = { especialidad: label, items: [], capitulos: [] };
      porEsp.set(label, esp);
    }
    esp.items.push(it);
    let cap = esp.capitulos.find((c) => c.capitulo === it.capitulo);
    if (!cap) {
      const tit = partesTituloCapitulo(it.capitulo);
      cap = { capitulo: it.capitulo, num: tit.num, nombre: tit.nombre, items: [], subs: [] };
      esp.capitulos.push(cap);
    }
    cap.items.push(it);
  }
  for (const esp of porEsp.values()) {
    esp.capitulos.sort((a, b) => compararCapitulos(a.capitulo, b.capitulo));
    for (const cap of esp.capitulos) {
      const gruposSub = new Map<string, ItemCalc[]>();
      for (const it of cap.items) {
        const key = (it.origenCodigo ? claveSubcapitulo(it.origenCodigo) : "") || "_";
        const arr = gruposSub.get(key) ?? [];
        arr.push(it);
        gruposSub.set(key, arr);
      }
      cap.subs = [...gruposSub.entries()].map(([clave, subItems]) => ({
        clave,
        titulo: (subItems[0]?.origenCodigo ? etiquetaSubcapitulo(subItems[0].origenCodigo) : "") || "",
        items: subItems,
      }));
    }
  }
  const especialidades = [...porEsp.values()];
  return { especialidades, sinCapitulo };
}

function fechaCorta(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Encabezado profesional de 3 filas para la tabla de valorización, calcado del formato usado en obra: Item,
 *  Descripción, Und, Metrado, P.Unit/Costo, y los 3 bloques Mes anterior acumulado / Actual / Acumulado actual
 *  (cada uno Metrado, Valorización, %), más Saldo (Metrado, Costo). Columnas B..R (17 columnas de datos). */
function escribirEncabezadoTabla(ws: ExcelJS.Worksheet, filaTop: number, tituloAvance: string) {
  const r1 = filaTop;
  const r2 = filaTop + 1;
  ws.mergeCells(r1, 2, r2, 2);
  ws.mergeCells(r1, 3, r2, 3);
  ws.mergeCells(r1, 4, r2, 4);
  ws.mergeCells(r1, 5, r2, 5);
  ws.mergeCells(r1, 6, r1, 7);
  ws.mergeCells(r1, 8, r1, 10);
  ws.mergeCells(r1, 11, r1, 13);
  ws.mergeCells(r1, 14, r1, 16);
  ws.mergeCells(r1, 17, r1, 18);

  const top = [
    [2, "Item"],
    [3, "Descripción"],
    [4, "Und"],
    [5, "Metrado\ncontract."],
    [6, "Programado"],
    [8, "Mes anterior acumulado"],
    [11, tituloAvance],
    [14, "Acumulado actual"],
    [17, "Saldo"],
  ] as [number, string][];
  for (const [col, text] of top) {
    const c = ws.getCell(r1, col);
    c.value = text;
  }
  const leaf = [
    [6, "P. Unit. (S/)"],
    [7, "Costo (S/)"],
    [8, "Metrado"],
    [9, "Valoriz. (S/)"],
    [10, "%"],
    [11, "Metrado"],
    [12, "Valoriz. (S/)"],
    [13, "%"],
    [14, "Metrado"],
    [15, "Valoriz. (S/)"],
    [16, "%"],
    [17, "Metrado"],
    [18, "Costo (S/)"],
  ] as [number, string][];
  for (const [col, text] of leaf) {
    ws.getCell(r2, col).value = text;
  }
  for (const row of [r1, r2]) {
    for (let col = 2; col <= 18; col++) {
      const c = ws.getCell(row, col);
      c.font = { name: "Calibri", size: 9, bold: true, color: { argb: WHITE } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col >= 8 ? NAVY_DARK : NAVY } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = BORDERS_ALL;
    }
  }
  ws.getRow(r1).height = 26;
  ws.getRow(r2).height = 18;
  return r2 + 1;
}

const MONEY_FMT = '#,##0.00;[RED]-#,##0.00';
const QTY_FMT = "#,##0.00";
const PCT_FMT = "0.0%";

function estiloFila(ws: ExcelJS.Worksheet, row: number, opts: { bold?: boolean; fill?: string; indent?: number; size?: number } = {}) {
  for (let col = 2; col <= 18; col++) {
    const c = ws.getCell(row, col);
    c.font = { name: "Calibri", size: opts.size ?? 9.5, bold: opts.bold, color: { argb: "FF000000" } };
    c.border = BORDERS_ALL;
    if (opts.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
    if (col >= 5) c.alignment = { horizontal: "right", vertical: "middle" };
    else c.alignment = { horizontal: "left", vertical: "middle", indent: col === 3 ? opts.indent ?? 0 : 0 };
  }
}

function escribirFilaItem(ws: ExcelJS.Worksheet, row: number, it: ItemCalc) {
  ws.getCell(row, 2).value = it.codigo;
  ws.getCell(row, 3).value = it.descripcion;
  ws.getCell(row, 4).value = it.und;
  ws.getCell(row, 5).value = it.metradoContractual;
  ws.getCell(row, 6).value = it.precioUnitario;
  ws.getCell(row, 7).value = { formula: `E${row}*F${row}` };
  ws.getCell(row, 8).value = it.metradoAnterior;
  ws.getCell(row, 9).value = { formula: `H${row}*F${row}` };
  ws.getCell(row, 10).value = { formula: `IFERROR(H${row}/E${row},0)` };
  ws.getCell(row, 11).value = it.metradoPeriodo;
  ws.getCell(row, 12).value = { formula: `K${row}*F${row}` };
  ws.getCell(row, 13).value = { formula: `IFERROR(K${row}/E${row},0)` };
  ws.getCell(row, 14).value = { formula: `H${row}+K${row}` };
  ws.getCell(row, 15).value = { formula: `N${row}*F${row}` };
  ws.getCell(row, 16).value = { formula: `IFERROR(N${row}/E${row},0)` };
  ws.getCell(row, 17).value = { formula: `MAX(E${row}-N${row},0)` };
  ws.getCell(row, 18).value = { formula: `MAX(G${row}-O${row},0)` };
  estiloFila(ws, row);
  for (const col of [5, 8, 11, 14, 17]) ws.getCell(row, col).numFmt = QTY_FMT;
  for (const col of [6, 7, 9, 12, 15, 18]) ws.getCell(row, col).numFmt = MONEY_FMT;
  for (const col of [10, 13, 16]) ws.getCell(row, col).numFmt = PCT_FMT;
}

/** Fila de subtotal (subcapítulo, capítulo, especialidad o total general): la etiqueta va en la celda ancla de la
 *  combinación B:D (col. 2), y los montos son fórmulas SUM sobre las filas de partida indicadas —nunca números
 *  fijos— para que el libro se recalcule solo si el usuario edita un metrado. */
function escribirFilaSubtotal(ws: ExcelJS.Worksheet, row: number, label: string, filaRows: number[], opts: { bold: boolean; fill: string }) {
  ws.getCell(row, 2).value = label;
  ws.mergeCells(row, 2, row, 4);
  const suma = (col: string) => (filaRows.length ? { formula: filaRows.map((r) => `${col}${r}`).join("+") } : 0);
  ws.getCell(row, 7).value = suma("G");
  ws.getCell(row, 9).value = suma("I");
  ws.getCell(row, 10).value = { formula: `IFERROR(I${row}/G${row},0)` };
  ws.getCell(row, 12).value = suma("L");
  ws.getCell(row, 13).value = { formula: `IFERROR(L${row}/G${row},0)` };
  ws.getCell(row, 15).value = suma("O");
  ws.getCell(row, 16).value = { formula: `IFERROR(O${row}/G${row},0)` };
  ws.getCell(row, 18).value = suma("R");
  estiloFila(ws, row, opts);
  for (const col of [7, 9, 12, 15, 18]) ws.getCell(row, col).numFmt = MONEY_FMT;
  for (const col of [10, 13, 16]) ws.getCell(row, col).numFmt = PCT_FMT;
}

function tituloSeccion(ws: ExcelJS.Worksheet, row: number, texto: string) {
  ws.mergeCells(row, 2, row, 18);
  const c = ws.getCell(row, 2);
  c.value = texto;
  c.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  c.alignment = { horizontal: "left", vertical: "middle" };
  c.border = BORDERS_ALL;
  ws.getRow(row).height = 20;
}

function anchoColumnas(ws: ExcelJS.Worksheet) {
  const widths: Record<number, number> = { 1: 2, 2: 13, 3: 42, 4: 7, 5: 11, 6: 10, 7: 12, 8: 10, 9: 11, 10: 8, 11: 10, 12: 11, 13: 8, 14: 10, 15: 11, 16: 8, 17: 10, 18: 12 };
  for (const [col, w] of Object.entries(widths)) ws.getColumn(Number(col)).width = w;
}

/** Bloque "Datos generales" tipo carátula, igual al de una valorización profesional (Obra, Entidad, Contratista,
 *  Residente, Supervisor, Ubicación, Sistema de contratación, montos y periodo). */
function escribirDatosGenerales(ws: ExcelJS.Worksheet, filaTop: number, periodo: ValorPeriodo, resumen: ResumenPeriodo, pre: PresupuestoState) {
  let row = filaTop;
  const sistema = SISTEMA_CONTRATACION_META[pre.sistemaContratacion] || pre.sistemaContratacion;
  const ubicacion = [pre.direccion, pre.distrito, pre.provincia, pre.departamento].filter(Boolean).join(", ") || pre.lugar;
  const filas: [string, string, string, string][] = [
    ["Obra", pre.obra || "—", "Valorización N.°", String(periodo.numero)],
    ["Entidad", pre.entidad || pre.cliente || "—", "Periodo", `${fechaCorta(periodo.desde)} – ${fechaCorta(periodo.hasta)}`],
    ["Contratista", pre.contratista || "—", "Sistema de contratación", sistema],
    ["Residente de obra", pre.residente || "—", "Monto contractual (con IGV)", `S/ ${resumen.totalContractual.toFixed(2)}`],
    ["Supervisor / proyectista", pre.proyectista || "—", "RUC", pre.rucCliente || "—"],
    ["Ubicación", ubicacion || "—", "Fecha de emisión", new Date().toLocaleDateString("es-PE")],
  ];
  for (const [lab1, val1, lab2, val2] of filas) {
    ws.mergeCells(row, 2, row, 3);
    ws.mergeCells(row, 4, row, 8);
    ws.mergeCells(row, 9, row, 11);
    ws.mergeCells(row, 12, row, 18);
    const c1 = ws.getCell(row, 2);
    c1.value = lab1.toUpperCase();
    c1.font = { name: "Calibri", size: 9, bold: true, color: { argb: WHITE } };
    c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c1.alignment = { vertical: "middle" };
    c1.border = BORDERS_ALL;
    const c2 = ws.getCell(row, 4);
    c2.value = val1;
    c2.font = { name: "Calibri", size: 9.5 };
    c2.alignment = { vertical: "middle" };
    c2.border = BORDERS_ALL;
    const c3 = ws.getCell(row, 9);
    c3.value = lab2.toUpperCase();
    c3.font = { name: "Calibri", size: 9, bold: true, color: { argb: WHITE } };
    c3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c3.alignment = { vertical: "middle" };
    c3.border = BORDERS_ALL;
    const c4 = ws.getCell(row, 12);
    c4.value = val2;
    c4.font = { name: "Calibri", size: 9.5 };
    c4.alignment = { vertical: "middle" };
    c4.border = BORDERS_ALL;
    ws.getRow(row).height = 16;
    row += 1;
  }
  return row + 1;
}

function hojaValorizacionDeObra(
  wb: ExcelJS.Workbook,
  periodo: ValorPeriodo,
  resumen: ResumenPeriodo,
  itemsContractuales: ItemCalc[],
  pre: PresupuestoState,
) {
  const ws = wb.addWorksheet("Valorización de obra", { views: [{ state: "frozen", ySplit: 0, showGridLines: false }] });
  anchoColumnas(ws);
  ws.mergeCells(1, 2, 1, 18);
  const titulo = ws.getCell(1, 2);
  titulo.value = `VALORIZACIÓN DE OBRA N.° ${String(periodo.numero).padStart(2, "0")} — ${pre.obra || ""}`;
  titulo.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF1B3650" } };
  ws.getRow(1).height = 24;

  let row = 3;
  row = escribirDatosGenerales(ws, row, periodo, resumen, pre);

  const { especialidades, sinCapitulo } = agruparParaExcel(itemsContractuales);
  const mostrarEspecialidad = especialidades.length > 1;
  row = escribirEncabezadoTabla(ws, row, `Actual · ${periodo.nombre}`);
  ws.views = [{ state: "frozen", ySplit: row - 1, showGridLines: false }];

  const filasTotal: number[] = [];
  for (const esp of especialidades) {
    const filaEsp = mostrarEspecialidad ? row++ : -1;
    const filasEsp: number[] = [];
    for (const cap of esp.capitulos) {
      const filaCap = row++;
      const filasCap: number[] = [];
      const mostrarSub = cap.subs.length > 1;
      for (const sub of cap.subs) {
        const filaSub = mostrarSub && sub.clave !== "_" ? row++ : -1;
        const filasSub: number[] = [];
        for (const it of sub.items) {
          escribirFilaItem(ws, row, it);
          filasSub.push(row);
          row += 1;
        }
        if (filaSub >= 0) escribirFilaSubtotal(ws, filaSub, sub.titulo ? `${sub.clave} ${sub.titulo}` : sub.clave, filasSub, { bold: true, fill: TAN });
        filasCap.push(...filasSub);
      }
      escribirFilaSubtotal(ws, filaCap, `${cap.num ? cap.num + " " : ""}${cap.nombre}`.trim() || cap.capitulo, filasCap, { bold: true, fill: CREAM });
      filasEsp.push(...filasCap);
    }
    if (filaEsp >= 0) {
      escribirFilaSubtotal(ws, filaEsp, esp.especialidad.toUpperCase(), filasEsp, { bold: true, fill: NAVY_DARK });
      ws.getCell(filaEsp, 2).font = { name: "Calibri", size: 9.5, bold: true, color: { argb: WHITE } };
    }
    filasTotal.push(...filasEsp);
  }
  if (sinCapitulo.length) {
    const filaSin = row++;
    const filasSin: number[] = [];
    for (const it of sinCapitulo) {
      escribirFilaItem(ws, row, it);
      filasSin.push(row);
      row += 1;
    }
    escribirFilaSubtotal(ws, filaSin, "Otras partidas", filasSin, { bold: true, fill: CREAM });
    filasTotal.push(...filasSin);
  }

  escribirFilaSubtotal(ws, row, "TOTAL VALORIZACIÓN DE OBRA (COSTO DIRECTO)", filasTotal, { bold: true, fill: "FFD9CFA8" });
  for (let col = 2; col <= 18; col++) ws.getCell(row, col).font = { name: "Calibri", size: 10, bold: true };
  return ws;
}

function hojaResumenFinanciero(
  wb: ExcelJS.Workbook,
  periodo: ValorPeriodo,
  resumen: ResumenPeriodo,
  adelantos: ResumenAdelantos,
  penalidad: ResumenPenalidad,
  reajuste: ReajustePeriodo,
  liquidacion: LiquidacionPeriodo,
) {
  const ws = wb.addWorksheet("Resumen financiero", { views: [{ showGridLines: false }] });
  ws.getColumn(2).width = 46;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 16;
  ws.mergeCells(1, 2, 1, 4);
  ws.getCell(1, 2).value = `Resumen financiero · ${periodo.nombre}`;
  ws.getCell(1, 2).font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF1B3650" } };
  ws.getRow(1).height = 22;

  let row = 3;
  ws.getCell(row, 2).value = "Concepto";
  ws.getCell(row, 3).value = "Periodo (S/)";
  ws.getCell(row, 4).value = "Acumulado (S/)";
  for (let col = 2; col <= 4; col++) {
    const c = ws.getCell(row, col);
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: WHITE } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { horizontal: col === 2 ? "left" : "right", vertical: "middle" };
    c.border = BORDERS_ALL;
  }
  row += 1;

  const filas: [string, number, number | null, boolean][] = [
    ["Costo directo (contractual + adicionales − deductivos)", resumen.costoDirectoPeriodo, resumen.costoDirectoAcumulado, false],
    ...(resumen.costoDirectoAdicionalAcumulado > 0
      ? ([["· de los cuales, adicionales de obra", resumen.costoDirectoAdicionalPeriodo, resumen.costoDirectoAdicionalAcumulado, false]] as [string, number, number | null, boolean][])
      : []),
    ...(resumen.costoDirectoDeductivoAcumulado > 0
      ? ([["· de los cuales, deductivos de obra", -resumen.costoDirectoDeductivoPeriodo, -resumen.costoDirectoDeductivoAcumulado, false]] as [string, number, number | null, boolean][])
      : []),
    ["Gastos generales + Utilidad", NaN, resumen.gg + resumen.utilidad, false],
    ["IGV", NaN, resumen.igv, false],
    ["Valorización bruta", resumen.totalPeriodo, resumen.totalAcumulado, true],
    ...(reajuste.aplicable ? ([[`Reajuste por índices unificados (K = ${reajuste.k.toFixed(4)})`, reajuste.reajuste, null, false]] as [string, number, number | null, boolean][]) : []),
    ...(adelantos.amortizacionDirectoPeriodo > 0 ? ([["Amortización adelanto directo", -adelantos.amortizacionDirectoPeriodo, null, false]] as [string, number, number | null, boolean][]) : []),
    ...(adelantos.amortizacionMaterialesPeriodo > 0
      ? ([["Amortización adelanto de materiales", -adelantos.amortizacionMaterialesPeriodo, null, false]] as [string, number, number | null, boolean][])
      : []),
    ...(penalidad.penalidadPeriodo > 0 ? ([["Penalidad por mora (art. 120)", -penalidad.penalidadPeriodo, null, false]] as [string, number, number | null, boolean][]) : []),
    ["Monto neto a pagar", liquidacion.montoNetoAPagar, null, true],
  ];
  for (const [label, periodoVal, acumVal, bold] of filas) {
    ws.getCell(row, 2).value = label;
    if (!Number.isNaN(periodoVal)) ws.getCell(row, 3).value = periodoVal;
    if (acumVal !== null) ws.getCell(row, 4).value = acumVal;
    for (let col = 2; col <= 4; col++) {
      const c = ws.getCell(row, col);
      c.font = { name: "Calibri", size: 9.5, bold };
      c.border = BORDERS_ALL;
      if (bold) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TAN } };
      if (col >= 3) {
        c.numFmt = MONEY_FMT;
        c.alignment = { horizontal: "right" };
      }
    }
    row += 1;
  }
  return ws;
}

function hojaAdicionalesDeductivos(wb: ExcelJS.Workbook, adicionales: ItemCalc[], deductivos: ItemCalc[]) {
  if (!adicionales.length && !deductivos.length) return;
  const ws = wb.addWorksheet("Adicionales y deductivos", { views: [{ showGridLines: false }] });
  anchoColumnas(ws);
  let row = 1;
  const tabla = (titulo: string, items: ItemCalc[]) => {
    if (!items.length) return;
    tituloSeccion(ws, row, titulo);
    row += 1;
    ws.getCell(row, 2).value = "Código";
    ws.getCell(row, 3).value = "Descripción";
    ws.getCell(row, 4).value = "Und";
    ws.getCell(row, 6).value = "P. Unit. (S/)";
    ws.getCell(row, 11).value = "Metrado";
    ws.getCell(row, 12).value = "Monto (S/)";
    for (const col of [2, 3, 4, 6, 11, 12]) {
      const c = ws.getCell(row, col);
      c.font = { name: "Calibri", size: 9, bold: true, color: { argb: WHITE } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      c.border = BORDERS_ALL;
    }
    row += 1;
    for (const it of items) {
      ws.getCell(row, 2).value = it.codigo;
      ws.getCell(row, 3).value = it.descripcion;
      ws.getCell(row, 4).value = it.und;
      ws.getCell(row, 6).value = it.precioUnitario;
      ws.getCell(row, 6).numFmt = MONEY_FMT;
      ws.getCell(row, 11).value = it.metradoPeriodo;
      ws.getCell(row, 11).numFmt = QTY_FMT;
      ws.getCell(row, 12).value = { formula: `F${row}*K${row}` };
      ws.getCell(row, 12).numFmt = MONEY_FMT;
      for (const col of [2, 3, 4, 6, 11, 12]) ws.getCell(row, col).border = BORDERS_ALL;
      row += 1;
    }
    row += 1;
  };
  tabla("Prestaciones adicionales de obra", adicionales);
  tabla("Presupuesto deductivo", deductivos);
}

/** Arma el libro .xlsx con el mismo formato profesional usado en obra: carátula de datos generales, tabla de
 *  valorización agrupada por especialidad/capítulo/subcapítulo con fórmulas y subtotales (Metrado/Valorización/%
 *  por Mes anterior, Actual y Acumulado, más Saldo), resumen financiero del periodo y, si existen, adicionales y
 *  deductivos. Separado de `exportarValorizacionXlsx` para poder probarlo sin depender del navegador (file-saver). */
export function construirLibroValorizacion(
  periodo: ValorPeriodo,
  resumen: ResumenPeriodo,
  itemsContractuales: ItemCalc[],
  adicionales: ItemCalc[],
  deductivos: ItemCalc[],
  adelantosResumen: ResumenAdelantos,
  penalidad: ResumenPenalidad,
  reajuste: ReajustePeriodo,
  liquidacion: LiquidacionPeriodo,
  pre: PresupuestoState,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MemoriaCalc";
  wb.created = new Date();
  hojaValorizacionDeObra(wb, periodo, resumen, itemsContractuales, pre);
  hojaResumenFinanciero(wb, periodo, resumen, adelantosResumen, penalidad, reajuste, liquidacion);
  hojaAdicionalesDeductivos(wb, adicionales, deductivos);
  return wb;
}

/** Exporta la valorización a un archivo .xlsx (ver `construirLibroValorizacion`) y dispara la descarga en el navegador. */
export async function exportarValorizacionXlsx(
  periodo: ValorPeriodo,
  resumen: ResumenPeriodo,
  itemsContractuales: ItemCalc[],
  adicionales: ItemCalc[],
  deductivos: ItemCalc[],
  adelantosResumen: ResumenAdelantos,
  penalidad: ResumenPenalidad,
  reajuste: ReajustePeriodo,
  liquidacion: LiquidacionPeriodo,
  pre: PresupuestoState,
) {
  const wb = construirLibroValorizacion(
    periodo,
    resumen,
    itemsContractuales,
    adicionales,
    deductivos,
    adelantosResumen,
    penalidad,
    reajuste,
    liquidacion,
    pre,
  );
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const safe = `${pre.obra || "Obra"}_${periodo.nombre}`.replace(/[^\w-]+/g, "_");
  saveAs(blob, `Valorizacion_${safe}.xlsx`);
}
