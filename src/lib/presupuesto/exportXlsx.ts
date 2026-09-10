import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { calcularPresupuesto, consolidarInsumos, type CalcPresupuesto, type LineaCalc } from "./engine";
import { claveSubcapitulo, etiquetaSubcapitulo, partesTituloCapitulo } from "./rnMetrados";
import { ESPECIALIDAD_META, moneyMon, SISTEMA_CONTRATACION_META, type PresupuestoState } from "./types";

const NAVY = "FF1B3650";
const NAVY_DARK = "FF14293F";
const CREAM = "FFE8E0D2";
const TAN = "FFF4EFE4";
const WHITE = "FFFFFFFF";
const BORDER_THIN = { style: "thin" as const, color: { argb: "FFB8B8B8" } };
const BORDERS_ALL = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };
const MONEY_FMT = "#,##0.00;[RED]-#,##0.00";
const QTY_FMT = "#,##0.0000";

const KIND_LABEL: Record<string, string> = { mo: "Mano de obra", mat: "Materiales", maq: "Maquinaria y equipo", eq: "Equipos y herramientas" };

function tituloHoja(ws: ExcelJS.Worksheet, texto: string) {
  ws.mergeCells(1, 2, 1, 8);
  const c = ws.getCell(1, 2);
  c.value = texto;
  c.font = { name: "Calibri", size: 14, bold: true, color: { argb: NAVY } };
  ws.getRow(1).height = 24;
}

function tituloSeccion(ws: ExcelJS.Worksheet, row: number, texto: string, cols = 8) {
  ws.mergeCells(row, 2, row, cols);
  const c = ws.getCell(row, 2);
  c.value = texto;
  c.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  c.alignment = { vertical: "middle" };
  c.border = BORDERS_ALL;
  ws.getRow(row).height = 19;
}

/** Bloque "Datos generales" tipo carátula (Obra, Entidad, Contratista, Residente, Supervisor, Ubicación, Sistema
 *  de contratación, fecha) — mismo formato que la carátula de valorizaciones. */
function escribirDatosGenerales(ws: ExcelJS.Worksheet, filaTop: number, pre: PresupuestoState, calc: CalcPresupuesto): number {
  let row = filaTop;
  const sistema = SISTEMA_CONTRATACION_META[pre.sistemaContratacion] || pre.sistemaContratacion;
  const ubicacion = [pre.direccion, pre.distrito, pre.provincia, pre.departamento].filter(Boolean).join(", ") || pre.lugar;
  const filas: [string, string, string, string][] = [
    ["Obra", pre.obra || "—", "Sistema de contratación", sistema],
    ["Entidad", pre.entidad || pre.cliente || "—", "Moneda", pre.moneda],
    ["Contratista", pre.contratista || "—", "Costo directo", calc.costoDirecto.toFixed(2)],
    ["Residente de obra", pre.residente || "—", "Presupuesto total", calc.total.toFixed(2)],
    ["Supervisor / proyectista", pre.proyectista || "—", "RUC", pre.rucCliente || "—"],
    ["Ubicación", ubicacion || "—", "Fecha de emisión", new Date().toLocaleDateString("es-PE")],
  ];
  for (const [lab1, val1, lab2, val2] of filas) {
    ws.mergeCells(row, 2, row, 3);
    ws.mergeCells(row, 4, row, 5);
    ws.mergeCells(row, 6, row, 6);
    ws.mergeCells(row, 7, row, 8);
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
    const c3 = ws.getCell(row, 6);
    c3.value = lab2.toUpperCase();
    c3.font = { name: "Calibri", size: 9, bold: true, color: { argb: WHITE } };
    c3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c3.alignment = { vertical: "middle" };
    c3.border = BORDERS_ALL;
    const c4 = ws.getCell(row, 7);
    c4.value = val2;
    c4.font = { name: "Calibri", size: 9.5 };
    c4.alignment = { vertical: "middle" };
    c4.border = BORDERS_ALL;
    ws.getRow(row).height = 16;
    row += 1;
  }
  return row + 1;
}

type SubBloqueX = { clave: string; titulo: string; lineas: LineaCalc[] };

function agruparSubcapitulos(lineas: LineaCalc[]): SubBloqueX[] {
  const grupos = new Map<string, LineaCalc[]>();
  for (const l of lineas) {
    const key = claveSubcapitulo(l.partida.codigo) || "_";
    const arr = grupos.get(key) ?? [];
    arr.push(l);
    grupos.set(key, arr);
  }
  return [...grupos.entries()].map(([clave, ls]) => ({
    clave,
    titulo: etiquetaSubcapitulo(ls[0]?.partida.codigo ?? "") || "",
    lineas: ls,
  }));
}

/** Hoja "Presupuesto": jerarquía especialidad → capítulo → subcapítulo → partida, con numeración tipo obra
 *  (01, 01.01), metrado, precio unitario y parcial — más la formación del presupuesto (CD, GG, Utilidad, IGV, Total). */
function hojaPresupuesto(wb: ExcelJS.Workbook, pre: PresupuestoState, calc: CalcPresupuesto) {
  const ws = wb.addWorksheet("Presupuesto", { views: [{ showGridLines: false }] });
  ws.getColumn(1).width = 2;
  ws.getColumn(2).width = 13;
  ws.getColumn(3).width = 46;
  ws.getColumn(4).width = 8;
  ws.getColumn(5).width = 11;
  ws.getColumn(6).width = 12;
  ws.getColumn(7).width = 14;
  ws.getColumn(8).width = 14;

  tituloHoja(ws, `PRESUPUESTO DE OBRA — ${pre.obra || ""}`);
  let row = 3;
  row = escribirDatosGenerales(ws, row, pre, calc);

  const header = row;
  const heads = ["Ítem", "Descripción", "Und", "Metrado", "P. Unit.", "Parcial"];
  for (let i = 0; i < heads.length; i++) {
    const c = ws.getCell(header, 2 + i);
    c.value = heads[i];
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: WHITE } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = BORDERS_ALL;
  }
  ws.getRow(header).height = 18;
  row = header + 1;

  const mostrarEspecialidad = calc.especialidades.length > 1;
  const filasTotal: number[] = [];
  for (const esp of calc.especialidades) {
    if (mostrarEspecialidad) {
      ws.getCell(row, 2).value = ESPECIALIDAD_META[esp.especialidad].kicker;
      ws.mergeCells(row, 3, row, 5);
      ws.getCell(row, 3).value = ESPECIALIDAD_META[esp.especialidad].label;
      for (const col of [2, 3, 6]) {
        const c = ws.getCell(row, col);
        c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: WHITE } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_DARK } };
        c.border = BORDERS_ALL;
      }
      ws.getCell(row, 6).value = esp.parcial;
      ws.getCell(row, 6).numFmt = MONEY_FMT;
      ws.getCell(row, 6).alignment = { horizontal: "right" };
      row += 1;
    }
    for (const cap of esp.capitulos) {
      const tit = partesTituloCapitulo(cap.capitulo);
      const filaCap = row++;
      ws.getCell(filaCap, 2).value = tit.num;
      ws.mergeCells(filaCap, 3, filaCap, 5);
      ws.getCell(filaCap, 3).value = tit.nombre;
      for (const col of [2, 3, 6]) {
        const c = ws.getCell(filaCap, col);
        c.font = { name: "Calibri", size: 9.5, bold: true };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CREAM } };
        c.border = BORDERS_ALL;
      }
      ws.getCell(filaCap, 6).numFmt = MONEY_FMT;
      ws.getCell(filaCap, 6).alignment = { horizontal: "right" };

      const subs = agruparSubcapitulos(cap.lineas);
      const filasCap: number[] = [];
      const mostrarSub = subs.length > 1;
      for (const sub of subs) {
        let filaSub = -1;
        if (mostrarSub && sub.clave !== "_") {
          filaSub = row++;
          ws.getCell(filaSub, 2).value = sub.clave;
          ws.mergeCells(filaSub, 3, filaSub, 5);
          ws.getCell(filaSub, 3).value = sub.titulo;
          for (const col of [2, 3, 6]) {
            const c = ws.getCell(filaSub, col);
            c.font = { name: "Calibri", size: 9, bold: true };
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TAN } };
            c.border = BORDERS_ALL;
          }
          ws.getCell(filaSub, 6).numFmt = MONEY_FMT;
          ws.getCell(filaSub, 6).alignment = { horizontal: "right" };
        }
        const filasSub: number[] = [];
        for (const l of sub.lineas) {
          ws.getCell(row, 2).value = l.partida.codigo;
          ws.getCell(row, 3).value = l.linea.descripcion || l.partida.descripcion;
          ws.getCell(row, 4).value = l.linea.und || l.partida.und;
          ws.getCell(row, 5).value = l.linea.metrado;
          ws.getCell(row, 5).numFmt = QTY_FMT;
          ws.getCell(row, 6).value = l.apu.pu;
          ws.getCell(row, 6).numFmt = MONEY_FMT;
          ws.getCell(row, 7).value = { formula: `E${row}*F${row}` };
          ws.getCell(row, 7).numFmt = MONEY_FMT;
          for (let col = 2; col <= 7; col++) {
            const c = ws.getCell(row, col);
            c.font = { name: "Calibri", size: 9.5 };
            c.border = BORDERS_ALL;
            if (col >= 4) c.alignment = { horizontal: "right" };
          }
          filasSub.push(row);
          row += 1;
        }
        if (filaSub >= 0) ws.getCell(filaSub, 6).value = { formula: filasSub.map((r) => `G${r}`).join("+") };
        filasCap.push(...filasSub);
      }
      ws.getCell(filaCap, 6).value = { formula: filasCap.map((r) => `G${r}`).join("+") };
      filasTotal.push(...filasCap);
    }
  }

  row += 1;
  const formacion: [string, number, boolean][] = [
    ["Costo directo", calc.costoDirecto, false],
    [pre.ggModo === "organigrama" ? "Gastos generales (organigrama)" : `Gastos generales (${pre.gg} %)`, calc.gg, false],
    [`Utilidad (${pre.utilidad} %)`, calc.utilidad, false],
    ["Subtotal", calc.subtotal, false],
    [`IGV (${pre.igv} %)`, calc.igv, false],
    ["PRESUPUESTO TOTAL DE OBRA", calc.total, true],
  ];
  for (const [label, val, bold] of formacion) {
    ws.mergeCells(row, 2, row, 5);
    ws.getCell(row, 2).value = label;
    ws.getCell(row, 6).value = val;
    ws.getCell(row, 6).numFmt = MONEY_FMT;
    for (const col of [2, 6]) {
      const c = ws.getCell(row, col);
      c.font = { name: "Calibri", size: bold ? 11 : 9.5, bold };
      c.border = BORDERS_ALL;
      if (bold) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9CFA8" } };
      if (col === 6) c.alignment = { horizontal: "right" };
    }
    row += 1;
  }
  ws.views = [{ state: "frozen", ySplit: header, showGridLines: false }];
  void filasTotal;
}

/** Hoja "APU": un bloque por partida con su cuadro de análisis de precios unitarios completo — cuadrilla,
 *  rendimiento, cantidad, precio y parcial de cada recurso, agrupados por mano de obra / materiales / maquinaria y
 *  equipo / equipos y herramientas, con el costo directo unitario al pie. */
function hojaApu(wb: ExcelJS.Workbook, calc: CalcPresupuesto) {
  const ws = wb.addWorksheet("APU", { views: [{ showGridLines: false }] });
  ws.getColumn(1).width = 2;
  ws.getColumn(2).width = 40;
  ws.getColumn(3).width = 7;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 11;
  ws.getColumn(6).width = 11;
  ws.getColumn(7).width = 11;
  ws.getColumn(8).width = 12;
  tituloHoja(ws, "ANÁLISIS DE PRECIOS UNITARIOS");
  let row = 3;

  for (const l of calc.lineas) {
    tituloSeccion(ws, row, `${l.partida.codigo} · ${l.linea.descripcion || l.partida.descripcion}  (Und: ${l.linea.und || l.partida.und})`);
    row += 1;
    const heads = ["Descripción", "Und", "Cuadrilla", "Rendimiento", "Cantidad", "Precio", "Parcial"];
    for (let i = 0; i < heads.length; i++) {
      const c = ws.getCell(row, 2 + i);
      c.value = heads[i];
      c.font = { name: "Calibri", size: 9, bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TAN } };
      c.border = BORDERS_ALL;
      c.alignment = { horizontal: i === 0 ? "left" : "right" };
    }
    row += 1;
    for (const kind of ["mo", "mat", "maq", "eq"] as const) {
      const items = l.apu.porKind[kind].items;
      if (!items.length) continue;
      ws.mergeCells(row, 2, row, 8);
      ws.getCell(row, 2).value = KIND_LABEL[kind];
      ws.getCell(row, 2).font = { name: "Calibri", size: 8.5, bold: true, italic: true, color: { argb: "FF5C5346" } };
      row += 1;
      for (const r of items) {
        ws.getCell(row, 2).value = `${r.insumo.codigo} · ${r.insumo.nombre}`;
        ws.getCell(row, 3).value = r.insumo.und;
        ws.getCell(row, 4).value = r.usaJornada ? r.cuadrilla : null;
        ws.getCell(row, 5).value = r.usaJornada ? r.rendimiento : null;
        ws.getCell(row, 6).value = r.cantidad;
        ws.getCell(row, 6).numFmt = QTY_FMT;
        ws.getCell(row, 7).value = r.precio;
        ws.getCell(row, 7).numFmt = MONEY_FMT;
        ws.getCell(row, 8).value = { formula: `F${row}*G${row}` };
        ws.getCell(row, 8).numFmt = MONEY_FMT;
        for (let col = 2; col <= 8; col++) {
          const c = ws.getCell(row, col);
          c.font = { name: "Calibri", size: 9 };
          c.border = BORDERS_ALL;
          if (col >= 4) c.alignment = { horizontal: "right" };
        }
        row += 1;
      }
    }
    ws.mergeCells(row, 2, row, 7);
    ws.getCell(row, 2).value = "Costo directo unitario";
    ws.getCell(row, 8).value = l.apu.pu;
    ws.getCell(row, 8).numFmt = MONEY_FMT;
    for (const col of [2, 8]) {
      const c = ws.getCell(row, col);
      c.font = { name: "Calibri", size: 9.5, bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CREAM } };
      c.border = BORDERS_ALL;
      if (col === 8) c.alignment = { horizontal: "right" };
    }
    row += 2;
  }
}

/** Hoja "Relación de insumos": consolidado de todo el presupuesto por tipo de recurso, con cantidad total, precio
 *  y parcial — el documento "precios y cantidades de recursos requeridos" del expediente técnico. */
function hojaInsumos(wb: ExcelJS.Workbook, calc: CalcPresupuesto, pre: PresupuestoState) {
  const ws = wb.addWorksheet("Relación de insumos", { views: [{ showGridLines: false }] });
  ws.getColumn(1).width = 2;
  ws.getColumn(2).width = 13;
  ws.getColumn(3).width = 42;
  ws.getColumn(4).width = 8;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 11;
  ws.getColumn(7).width = 12;
  ws.getColumn(8).width = 9;
  tituloHoja(ws, "RELACIÓN DE INSUMOS");
  let row = 3;
  const insumos = consolidarInsumos(calc.lineas);
  for (const kind of ["mo", "mat", "maq", "eq"] as const) {
    const items = insumos.filter((i) => i.insumo.kind === kind);
    if (!items.length) continue;
    tituloSeccion(ws, row, `${KIND_LABEL[kind]} — ${moneyMon(items.reduce((s, i) => s + i.parcial, 0), pre.moneda)}`);
    row += 1;
    const heads = ["Código", "Descripción", "Und", "Cantidad", "Precio", "Parcial", "N.° partidas"];
    for (let i = 0; i < heads.length; i++) {
      const c = ws.getCell(row, 2 + i);
      c.value = heads[i];
      c.font = { name: "Calibri", size: 9, bold: true, color: { argb: WHITE } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      c.border = BORDERS_ALL;
      c.alignment = { horizontal: i <= 1 ? "left" : "right" };
    }
    row += 1;
    for (const it of items) {
      const esHerramientas = it.insumo.id === "EQ-HIN";
      ws.getCell(row, 2).value = it.insumo.codigo;
      ws.getCell(row, 3).value = esHerramientas ? `${it.insumo.nombre} (% sobre mano de obra)` : it.insumo.nombre;
      ws.getCell(row, 4).value = esHerramientas ? "—" : it.insumo.und;
      ws.getCell(row, 5).value = esHerramientas ? null : it.cantidad;
      ws.getCell(row, 5).numFmt = QTY_FMT;
      ws.getCell(row, 6).value = esHerramientas ? null : it.precio;
      ws.getCell(row, 6).numFmt = MONEY_FMT;
      ws.getCell(row, 7).value = it.parcial;
      ws.getCell(row, 7).numFmt = MONEY_FMT;
      ws.getCell(row, 8).value = it.partidas;
      for (let col = 2; col <= 8; col++) {
        const c = ws.getCell(row, col);
        c.font = { name: "Calibri", size: 9 };
        c.border = BORDERS_ALL;
        if (col >= 4) c.alignment = { horizontal: "right" };
      }
      row += 1;
    }
    row += 1;
  }
}

/** Arma el libro .xlsx del presupuesto: hoja de formación (jerárquica, con numeración de obra), APU completo por
 *  partida, y relación de insumos consolidada. Separado de `exportarPresupuestoXlsx` para poder probarlo sin
 *  depender del navegador (file-saver). */
export function construirLibroPresupuesto(pre: PresupuestoState): ExcelJS.Workbook {
  const calc = calcularPresupuesto(pre);
  const wb = new ExcelJS.Workbook();
  wb.creator = "MemoriaCalc";
  wb.created = new Date();
  hojaPresupuesto(wb, pre, calc);
  hojaApu(wb, calc);
  hojaInsumos(wb, calc, pre);
  return wb;
}

/** Exporta el presupuesto completo a un archivo .xlsx (ver `construirLibroPresupuesto`) y dispara la descarga. */
export async function exportarPresupuestoXlsx(pre: PresupuestoState) {
  const wb = construirLibroPresupuesto(pre);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const safe = (pre.obra || "Obra").replace(/[^\w-]+/g, "_");
  saveAs(blob, `Presupuesto_${safe}.xlsx`);
}
