import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import { money, SISTEMA_CONTRATACION_META, type PresupuestoState } from "../presupuesto/types";
import type { ItemCalc, LiquidacionPeriodo, ResumenAdelantos, ResumenPenalidad, ResumenPeriodo } from "./engine";
import type { ReajustePeriodo } from "./reajuste";
import type { AdelantosState, ValorPeriodo } from "./types";

const navy = "003D82";
const brass = "5C5C5C";
const thin = { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8" };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

function h1(text: string) {
  return new Paragraph({
    spacing: { before: 320, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: navy, space: 3 } },
    children: [new TextRun({ text, font: "Calibri", size: 24, bold: true, color: navy })],
  });
}

function p(text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}) {
  return new Paragraph({
    spacing: { after: 140, line: 276 },
    children: [
      new TextRun({ text, font: "Times New Roman", size: opts.size ?? 22, bold: opts.bold, italics: opts.italics, color: "000000" }),
    ],
  });
}

function campo(label: string, valor: string) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}: `, font: "Calibri", size: 20, bold: true, color: navy }),
      new TextRun({ text: valor || "—", font: "Times New Roman", size: 20 }),
    ],
  });
}

function cell(text: string, width: number, opts: { header?: boolean; right?: boolean; bold?: boolean; small?: boolean } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: { fill: opts.header ? "003D82" : "FFFFFF" },
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: [
      new Paragraph({
        alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            font: opts.header ? "Calibri" : "Times New Roman",
            size: opts.header ? 15 : opts.small ? 15 : 17,
            bold: opts.header || opts.bold,
            color: opts.header ? "FFFFFF" : "000000",
          }),
        ],
      }),
    ],
  });
}

/** Tabla de valorización de obra: metrado/monto contractual, del periodo anterior, del periodo actual y acumulado. */
function tablaValorizacion(items: ItemCalc[]) {
  const widths = [1150, 3600, 550, 950, 900, 950, 950, 950, 700, 950, 950];
  const header = new TableRow({
    tableHeader: true,
    children: [
      cell("Código", widths[0], { header: true }),
      cell("Descripción", widths[1], { header: true }),
      cell("Und", widths[2], { header: true }),
      cell("Metrado contr.", widths[3], { header: true, right: true }),
      cell("P.U. S/", widths[4], { header: true, right: true }),
      cell("Metrado ant.", widths[5], { header: true, right: true }),
      cell("Metrado periodo", widths[6], { header: true, right: true }),
      cell("Metrado acum.", widths[7], { header: true, right: true }),
      cell("% Avance", widths[8], { header: true, right: true }),
      cell("Monto periodo S/", widths[9], { header: true, right: true }),
      cell("Monto acum. S/", widths[10], { header: true, right: true }),
    ],
  });
  const rows = items.map(
    (it) =>
      new TableRow({
        children: [
          cell(it.codigo, widths[0], { small: true }),
          cell(it.descripcion, widths[1], { small: true }),
          cell(it.und, widths[2], { small: true }),
          cell(money(it.metradoContractual), widths[3], { right: true, small: true }),
          cell(money(it.precioUnitario), widths[4], { right: true, small: true }),
          cell(money(it.metradoAnterior), widths[5], { right: true, small: true }),
          cell(money(it.metradoPeriodo), widths[6], { right: true, small: true }),
          cell(money(it.metradoAcumulado), widths[7], { right: true, small: true }),
          cell(`${it.avancePct.toFixed(1)}%`, widths[8], { right: true, small: true }),
          cell(money(Math.abs(it.montoPeriodo)), widths[9], { right: true, small: true }),
          cell(money(Math.abs(it.montoAcumulado)), widths[10], { right: true, small: true }),
        ],
      }),
  );
  return new Table({ width: { size: 10000, type: WidthType.DXA }, rows: [header, ...rows] });
}

function tablaPresupuesto(rows: [string, string][]) {
  const widths = [6000, 3000];
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: rows.map(
      ([label, valor], i) =>
        new TableRow({
          children: [
            cell(label, widths[0], { bold: i === rows.length - 1 }),
            cell(valor, widths[1], { right: true, bold: i === rows.length - 1 }),
          ],
        }),
    ),
  });
}

function mesTexto(ym: string) {
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
  const [y, m] = (ym || "").split("-").map(Number);
  if (!y || !m) return "—";
  return `${MESES[(m - 1 + 12) % 12]} de ${y}`;
}

function fechaLarga(iso: string) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
}

export async function generarInformeValorizacion(
  periodo: ValorPeriodo,
  resumen: ResumenPeriodo,
  itemsContractuales: ItemCalc[],
  adicionales: ItemCalc[],
  deductivos: ItemCalc[],
  adelantos: ResumenAdelantos,
  adelantosState: AdelantosState,
  penalidad: ResumenPenalidad,
  reajuste: ReajustePeriodo,
  liquidacion: LiquidacionPeriodo,
  pre: PresupuestoState,
) {
  const fecha = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  const sistema = SISTEMA_CONTRATACION_META[pre.sistemaContratacion] || pre.sistemaContratacion;
  const ubicacion = [pre.direccion, pre.distrito, pre.provincia, pre.departamento].filter(Boolean).join(", ") || pre.lugar;
  const estadoObra = resumen.avanceFisicoPct >= 99.95 ? "concluida" : "en ejecución";

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1418, right: 1134 } } },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: navy, space: 6 } },
                children: [
                  new TextRun({ text: "MEMORIACALC  ·  ", font: "Calibri", size: 16, bold: true, color: navy }),
                  new TextRun({ text: `VALORIZACIÓN DE OBRA · ${periodo.nombre}`, font: "Calibri", size: 16, color: brass }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 8, color: navy, space: 8 } },
                children: [
                  new TextRun({ text: "Informe de valorización de obra · Documento de trabajo · Página ", font: "Calibri", size: 16, color: brass }),
                  new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 16 }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 40 },
            children: [new TextRun({ text: `INFORME DE VALORIZACIÓN DE OBRA N.° ${String(periodo.numero).padStart(2, "0")}`, font: "Calibri", size: 32, bold: true, color: navy })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 260 },
            children: [
              new TextRun({
                text: `Correspondiente al periodo del ${fechaLarga(periodo.desde)} al ${fechaLarga(periodo.hasta)}`,
                font: "Times New Roman",
                size: 22,
                italics: true,
              }),
            ],
          }),

          h1("I. Datos generales"),
          campo("Obra", pre.obra),
          campo("Ubicación", ubicacion),
          campo("Entidad", pre.entidad || pre.cliente),
          campo("Contratista", pre.contratista),
          campo("Residente de obra", pre.residente),
          campo("Supervisor / proyectista", pre.proyectista),
          campo("Sistema de contratación", sistema),
          campo("Monto contractual (con IGV)", `S/ ${money(resumen.totalContractual)}`),
          campo("Valorización N.°", String(periodo.numero)),
          campo("Periodo valorizado", `${fechaLarga(periodo.desde)} al ${fechaLarga(periodo.hasta)}`),
          campo("Mes de valorización (reajuste)", mesTexto(periodo.mesValorizacion)),
          campo("Fecha del informe", fecha),

          h1("II. Resumen de la valorización"),
          p(
            `La obra "${pre.obra}" se encuentra ${estadoObra}. Al cierre de la ${periodo.nombre} (${fechaLarga(periodo.desde)} al ${fechaLarga(periodo.hasta)}), el avance físico acumulado alcanza el ${resumen.avanceFisicoPct.toFixed(2)} % del monto contractual vigente.`,
          ),
          p(
            `La presente valorización, correspondiente al periodo indicado, asciende a un valor bruto de S/ ${money(resumen.totalPeriodo)} (costo directo, gastos generales, utilidad e IGV${reajuste.aplicable ? ", más el reajuste por índices unificados" : ""}), lo que representa un valorizado acumulado de S/ ${money(resumen.totalAcumulado)} sobre un monto contractual de S/ ${money(resumen.totalContractual)}.`,
          ),
          ...(adicionales.length
            ? [
                p(
                  `Se incluyen partidas adicionales de obra por S/ ${money(resumen.costoDirectoAdicionalPeriodo)} en el periodo (S/ ${money(resumen.costoDirectoAdicionalAcumulado)} acumulado), equivalentes, netas de deductivos vinculados y deflactadas al nivel de precios del presupuesto base, al ${resumen.pctAdicionalSobreContrato.toFixed(2)} % del monto del contrato original.`,
                  { bold: resumen.alertaAdicional !== "ninguna" },
                ),
              ]
            : []),
          p(
            `El monto neto a pagar en esta valorización, luego de deducir la amortización de adelantos${penalidad.penalidadPeriodo > 0 ? " y la penalidad por mora" : ""}, es de S/ ${money(liquidacion.montoNetoAPagar)}.`,
            { bold: true },
          ),

          h1("III. Valorización de obra — partidas contractuales"),
          tablaValorizacion(itemsContractuales),

          ...(adicionales.length
            ? [h1("III-B. Partidas adicionales del periodo"), tablaValorizacion(adicionales)]
            : []),
          ...(deductivos.length
            ? [h1("III-C. Partidas deductivas del periodo"), tablaValorizacion(deductivos)]
            : []),

          h1("IV. Presupuesto de la valorización"),
          tablaPresupuesto([
            ["Costo directo (contractual + adicionales − deductivos)", `S/ ${money(resumen.costoDirectoPeriodo)}`],
            [`Gastos generales y utilidad`, `S/ ${money(resumen.gg + resumen.utilidad)}`],
            [`IGV (${pre.igv} %)`, `S/ ${money(resumen.igv)}`],
            ["Valorización bruta del periodo", `S/ ${money(resumen.totalPeriodo)}`],
            ...(reajuste.aplicable ? ([[`Reajuste por índices unificados (K = ${reajuste.k.toFixed(4)})`, `S/ ${money(reajuste.reajuste)}`]] as [string, string][]) : []),
            ...(adelantos.amortizacionDirectoPeriodo > 0 ? ([["Menos: amortización adelanto directo", `- S/ ${money(adelantos.amortizacionDirectoPeriodo)}`]] as [string, string][]) : []),
            ...(adelantos.amortizacionMaterialesPeriodo > 0
              ? ([["Menos: amortización adelanto de materiales", `- S/ ${money(adelantos.amortizacionMaterialesPeriodo)}`]] as [string, string][])
              : []),
            ...(penalidad.penalidadPeriodo > 0 ? ([["Menos: penalidad por mora (art. 120)", `- S/ ${money(penalidad.penalidadPeriodo)}`]] as [string, string][]) : []),
            ["Monto neto a pagar", `S/ ${money(liquidacion.montoNetoAPagar)}`],
          ]),

          ...(adelantosState.directoMonto || adelantosState.materialesMonto
            ? [
                h1("V. Control de amortización de adelantos"),
                ...(adelantosState.directoMonto
                  ? [
                      p(
                        `Adelanto directo: monto otorgado S/ ${money(adelantosState.directoMonto)}. Amortización del periodo: S/ ${money(adelantos.amortizacionDirectoPeriodo)}. Amortización acumulada: S/ ${money(adelantos.amortizacionDirectoAcumulada)}. Saldo pendiente de amortizar: S/ ${money(adelantos.saldoAdelantoDirecto)}.`,
                      ),
                    ]
                  : []),
                ...(adelantosState.materialesMonto
                  ? [
                      p(
                        `Adelanto de materiales: monto otorgado S/ ${money(adelantosState.materialesMonto)}. Amortización del periodo: S/ ${money(adelantos.amortizacionMaterialesPeriodo)}. Amortización acumulada: S/ ${money(adelantos.amortizacionMaterialesAcumulada)}. Saldo pendiente de amortizar: S/ ${money(adelantos.saldoAdelantoMateriales)}.`,
                      ),
                    ]
                  : []),
              ]
            : []),

          ...(penalidad.penalidadAcumulada > 0
            ? [
                h1("VI. Penalidad por mora"),
                p(
                  `Días de atraso injustificado del periodo: ${periodo.diasAtrasoInjustificado || 0}. Penalidad del periodo: S/ ${money(penalidad.penalidadPeriodo)}. Penalidad acumulada: S/ ${money(penalidad.penalidadAcumulada)}${penalidad.topeAlcanzado ? " (ha alcanzado el tope del 10 % del monto contractual vigente, causal de resolución del contrato conforme al art. 120 del Reglamento)." : "."}`,
                  { bold: penalidad.topeAlcanzado },
                ),
              ]
            : []),

          h1("VII. Conclusiones"),
          p(
            `Se eleva la presente valorización de obra N.° ${periodo.numero} por un monto neto de S/ ${money(liquidacion.montoNetoAPagar)}, para la revisión y aprobación de la Supervisión / Entidad, conforme al avance físico y financiero descrito en el presente informe.`,
          ),
          p(
            "Nota: el presente documento ha sido generado como ayuda de trabajo a partir de los datos registrados en el sistema. La Entidad, a través de su Supervisión y su área legal, debe validar los montos, plazos y la normativa vigente aplicable al contrato específico.",
            { italics: true, size: 19 },
          ),

          h1("VIII. Firmas"),
          new Paragraph({ spacing: { before: 500 }, children: [new TextRun({ text: "_______________________________", font: "Times New Roman", size: 22 })] }),
          p("Residente de obra"),
          new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "_______________________________", font: "Times New Roman", size: 22 })] }),
          p("Supervisor / Inspector de obra"),
          new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "_______________________________", font: "Times New Roman", size: 22 })] }),
          p("Entidad"),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safe = `${pre.obra || "Obra"}_${periodo.nombre}`.replace(/[^\w\-]+/g, "_");
  saveAs(blob, `Informe_Valorizacion_${safe}.docx`);
}
