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
import type { ItemCalc, ResumenPeriodo } from "./engine";
import { LIMITE_ADICIONAL_MAXIMO_PCT, LIMITE_ADICIONAL_NIVEL1_PCT, LIMITE_ADICIONAL_NIVEL2_PCT } from "./engine";
import type { ValorPeriodo } from "./types";

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

function cell(text: string, width: number, opts: { header?: boolean; right?: boolean; bold?: boolean } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: { fill: opts.header ? "003D82" : "FFFFFF" },
    margins: { top: 50, bottom: 50, left: 70, right: 70 },
    children: [
      new Paragraph({
        alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            font: opts.header ? "Calibri" : "Times New Roman",
            size: opts.header ? 16 : 18,
            bold: opts.header || opts.bold,
            color: opts.header ? "FFFFFF" : "000000",
          }),
        ],
      }),
    ],
  });
}

function tablaPartidas(items: ItemCalc[]) {
  const widths = [1600, 4200, 700, 1100, 1100, 1300];
  const header = new TableRow({
    children: [
      cell("Código", widths[0], { header: true }),
      cell("Descripción", widths[1], { header: true }),
      cell("Und", widths[2], { header: true }),
      cell("Metrado", widths[3], { header: true, right: true }),
      cell("P.U. S/", widths[4], { header: true, right: true }),
      cell("Parcial S/", widths[5], { header: true, right: true }),
    ],
  });
  const rows = items.map(
    (it) =>
      new TableRow({
        children: [
          cell(it.codigo, widths[0]),
          cell(it.descripcion, widths[1]),
          cell(it.und, widths[2]),
          cell(money(it.metradoPeriodo), widths[3], { right: true }),
          cell(money(it.precioUnitario), widths[4], { right: true }),
          cell(money(Math.abs(it.montoPeriodo)), widths[5], { right: true }),
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

export async function generarInformeAdicional(
  periodo: ValorPeriodo,
  resumen: ResumenPeriodo,
  adicionales: ItemCalc[],
  deductivos: ItemCalc[],
  pre: PresupuestoState,
) {
  const fecha = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  const costoDirectoAdicionalBruto = resumen.costoDirectoAdicionalAcumulado;
  const costoDirectoDeductivo = resumen.costoDirectoDeductivoAcumulado;
  const costoDirectoNeto = resumen.costoDirectoAdicionalNetoAcumulado;
  const gg = (costoDirectoNeto * pre.gg) / 100;
  const utilidad = (costoDirectoNeto * pre.utilidad) / 100;
  const subtotal = costoDirectoNeto + gg + utilidad;
  const igv = (subtotal * pre.igv) / 100;
  const total = subtotal + igv;
  const sistema = SISTEMA_CONTRATACION_META[pre.sistemaContratacion] || pre.sistemaContratacion;

  const nivelTexto =
    resumen.alertaAdicional === "supera-maximo"
      ? `ADVERTENCIA: el acumulado neto de adicionales, deflactado al nivel de precios del presupuesto base (${resumen.pctAdicionalSobreContrato.toFixed(2)} %), supera el ${LIMITE_ADICIONAL_MAXIMO_PCT} % del monto del contrato original. Conforme al art. 64 de la Ley N.° 32069, dicho exceso no procede como adicional ordinario; corresponde evaluar la resolución del contrato o una modificación contractual distinta, previa revisión del área legal de la Entidad.`
      : resumen.alertaAdicional === "nivel3"
        ? `El acumulado neto de adicionales, deflactado (${resumen.pctAdicionalSobreContrato.toFixed(2)} %), se ubica entre el ${LIMITE_ADICIONAL_NIVEL2_PCT} % y el ${LIMITE_ADICIONAL_MAXIMO_PCT} % del monto del contrato original, por lo que requiere autorización previa de la Contraloría General de la República (art. 64 de la Ley N.° 32069), antes de su ejecución y pago.`
        : resumen.alertaAdicional === "nivel2"
          ? `El acumulado neto de adicionales, deflactado (${resumen.pctAdicionalSobreContrato.toFixed(2)} %), se ubica entre el ${LIMITE_ADICIONAL_NIVEL1_PCT} % y el ${LIMITE_ADICIONAL_NIVEL2_PCT} % del monto del contrato original. Puede ser autorizado por el Titular de la Entidad, sujeto a la disponibilidad presupuestal correspondiente (art. 64 de la Ley N.° 32069).`
          : `El acumulado neto de adicionales, deflactado (${resumen.pctAdicionalSobreContrato.toFixed(2)} %), se encuentra dentro del ${LIMITE_ADICIONAL_NIVEL1_PCT} % del monto del contrato original, por lo que su aprobación corresponde al nivel administrativo de la Entidad, previo informe técnico y legal (art. 64 de la Ley N.° 32069).`;

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
                  new TextRun({ text: `INFORME DE ADICIONAL DE OBRA · ${periodo.nombre}`, font: "Calibri", size: 16, color: brass }),
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
                  new TextRun({ text: "Informe de adicional de obra · Documento de trabajo · Página ", font: "Calibri", size: 16, color: brass }),
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
            children: [new TextRun({ text: "INFORME DE ADICIONAL DE OBRA", font: "Calibri", size: 32, bold: true, color: navy })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 260 },
            children: [new TextRun({ text: `Correspondiente a la ${periodo.nombre}`, font: "Times New Roman", size: 22, italics: true })],
          }),

          h1("I. Datos generales"),
          campo("Obra", pre.obra),
          campo("Ubicación", [pre.direccion, pre.distrito, pre.provincia, pre.departamento].filter(Boolean).join(", ") || pre.lugar),
          campo("Entidad", pre.entidad || pre.cliente),
          campo("RUC", pre.rucCliente),
          campo("Residente de obra", pre.residente),
          campo("Proyectista / Supervisor", pre.proyectista),
          campo("Sistema de contratación", sistema),
          campo("Monto contractual vigente (costo directo)", `S/ ${money(resumen.costoDirectoContractualVigente)}`),
          campo("Periodo de valorización", `${periodo.desde} al ${periodo.hasta}`),
          campo("Mes de valorización (reajuste)", mesTexto(periodo.mesValorizacion)),
          campo("Fecha del informe", fecha),
          campo("N.° de resolución de aprobación", periodo.resolucionAprobacion),

          h1("II. Antecedentes"),
          p(
            `Durante la ejecución de la obra "${pre.obra}" se han identificado trabajos no previstos ni contemplados en el expediente técnico ni en el contrato original, cuya ejecución resulta necesaria para cumplir la finalidad del proyecto. En consecuencia, se sustenta el presente adicional de obra conforme al detalle técnico, presupuestal y legal que se desarrolla a continuación.`,
          ),

          h1("III. Sustento técnico de las partidas adicionales"),
          p("Se listan las partidas adicionales ejecutadas o por ejecutar en el periodo, con su metrado y precio unitario:"),
          tablaPartidas(adicionales),

          ...(deductivos.length
            ? [
                h1("III-B. Presupuesto deductivo vinculado"),
                p(
                  "Partidas del presupuesto original que se dejan de ejecutar como consecuencia directa del adicional (deductivo vinculado), y que se descuentan del cálculo del porcentaje de incidencia (art. 64 de la Ley N.° 32069):",
                ),
                tablaPartidas(deductivos),
              ]
            : []),

          h1("IV. Presupuesto del adicional de obra"),
          tablaPresupuesto([
            ["Costo directo de adicionales (acumulado, a precios de ejecución)", `S/ ${money(costoDirectoAdicionalBruto)}`],
            ["Menos: presupuesto deductivo vinculado (acumulado)", `- S/ ${money(costoDirectoDeductivo)}`],
            ["Costo directo neto del adicional", `S/ ${money(costoDirectoNeto)}`],
            [`Gastos generales (${pre.gg} %)`, `S/ ${money(gg)}`],
            [`Utilidad (${pre.utilidad} %)`, `S/ ${money(utilidad)}`],
            ["Subtotal", `S/ ${money(subtotal)}`],
            [`IGV (${pre.igv} %)`, `S/ ${money(igv)}`],
            ["Monto neto del adicional de obra", `S/ ${money(total)}`],
          ]),
          new Paragraph({ spacing: { before: 160, after: 60 }, children: [] }),
          p(
            `El monto neto del adicional, deflactado al nivel de precios del presupuesto base para su comparación con el contrato original, representa el ${resumen.pctAdicionalSobreContrato.toFixed(2)} % del monto del contrato original (costo directo: S/ ${money(resumen.costoDirectoContractualVigente)}).`,
            { bold: true },
          ),

          h1("V. Sustento legal"),
          p(
            "El presente adicional se sustenta en lo dispuesto por la Ley N.° 32069, Ley General de Contrataciones Públicas, y su Reglamento aprobado por Decreto Supremo N.° 009-2025-EF (arts. 194 a 196), en lo referido al cálculo del presupuesto y a la aprobación de prestaciones adicionales de obra.",
          ),
          p(
            `De acuerdo con el art. 64 de la Ley N.° 32069, las prestaciones adicionales de obra —netas de los presupuestos deductivos vinculados— hasta por el ${LIMITE_ADICIONAL_NIVEL1_PCT} % del monto del contrato original se aprueban a nivel administrativo de la Entidad. Entre el ${LIMITE_ADICIONAL_NIVEL1_PCT} % y el ${LIMITE_ADICIONAL_NIVEL2_PCT} % pueden ser autorizadas por el Titular de la Entidad, sujeto a disponibilidad presupuestal. Entre el ${LIMITE_ADICIONAL_NIVEL2_PCT} % y el ${LIMITE_ADICIONAL_MAXIMO_PCT} % se requiere, además, autorización previa de la Contraloría General de la República. En ningún caso el conjunto de adicionales puede superar el ${LIMITE_ADICIONAL_MAXIMO_PCT} % del monto del contrato original.`,
          ),
          p(nivelTexto, { bold: true }),
          p(
            "Nota: el presente sustento legal es referencial y ha sido generado como ayuda de trabajo. La Entidad, a través de su área legal y su órgano de control institucional, debe validar la normativa vigente aplicable al contrato específico, el tipo de proceso de selección y las modificaciones normativas posteriores a la fecha de este informe.",
            { italics: true, size: 19 },
          ),

          h1("VI. Plazo adicional"),
          campo("Días calendario solicitados", periodo.plazoAdicionalDias ? String(periodo.plazoAdicionalDias) : "No se solicita ampliación de plazo"),
          p(periodo.sustentoPlazoAdicional || "Sin sustento de plazo adicional registrado."),

          h1("VII. Conclusiones y recomendación"),
          p(
            `Por lo expuesto, se concluye que las partidas descritas constituyen prestaciones adicionales de obra necesarias para el cumplimiento de la meta física del proyecto, con un costo neto de S/ ${money(total)}, equivalente al ${resumen.pctAdicionalSobreContrato.toFixed(2)} % (deflactado) del monto del contrato original. Se recomienda su aprobación conforme al procedimiento descrito en la sección V, previa verificación del área legal y presupuestal de la Entidad.`,
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
  saveAs(blob, `Informe_Adicional_${safe}.docx`);
}
