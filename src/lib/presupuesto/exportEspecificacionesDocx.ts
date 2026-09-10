import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import type { EspecificacionTecnica, LineaApuSpec } from "./especificacion";
import { etiquetaKind } from "./especificacion";
import { SISTEMA_CONTRATACION_META, type PresupuestoState } from "./types";

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

function h2(text: string) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, font: "Calibri", size: 20, bold: true, color: navy })],
  });
}

function p(text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 276 },
    children: [new TextRun({ text, font: "Times New Roman", size: opts.size ?? 21, bold: opts.bold, italics: opts.italics, color: "000000" })],
  });
}

function bullets(items: string[]) {
  if (!items.length) return [p("—", { italics: true, size: 19 })];
  return items.map(
    (t) =>
      new Paragraph({
        spacing: { after: 60, line: 264 },
        bullet: { level: 0 },
        children: [new TextRun({ text: t, font: "Times New Roman", size: 20 })],
      }),
  );
}

function numbered(items: string[]) {
  if (!items.length) return [p("Sin procedimiento detallado registrado.", { italics: true, size: 19 })];
  return items.map(
    (t, i) =>
      new Paragraph({
        spacing: { after: 70, line: 264 },
        children: [new TextRun({ text: `${i + 1}. ${t}`, font: "Times New Roman", size: 20 })],
      }),
  );
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
    shading: { fill: opts.header ? navy : "FFFFFF" },
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: [
      new Paragraph({
        alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            font: opts.header ? "Calibri" : "Times New Roman",
            size: opts.header ? 15 : 17,
            bold: opts.header || opts.bold,
            color: opts.header ? "FFFFFF" : "000000",
          }),
        ],
      }),
    ],
  });
}

function tablaIndice(fichas: { spec: EspecificacionTecnica; metrado?: number }[]) {
  const widths = [700, 1700, 5200, 900, 1400];
  const header = new TableRow({
    tableHeader: true,
    children: [
      cell("N.°", widths[0], { header: true }),
      cell("Código", widths[1], { header: true }),
      cell("Descripción", widths[2], { header: true }),
      cell("Und", widths[3], { header: true }),
      cell("Metrado", widths[4], { header: true, right: true }),
    ],
  });
  const rows = fichas.map(
    (x, i) =>
      new TableRow({
        children: [
          cell(String(i + 1).padStart(3, "0"), widths[0]),
          cell(x.spec.codigo, widths[1]),
          cell(x.spec.titulo, widths[2]),
          cell(x.spec.unidad, widths[3]),
          cell(x.metrado != null ? x.metrado.toLocaleString("es-PE", { maximumFractionDigits: 3 }) : "—", widths[4], { right: true }),
        ],
      }),
  );
  return new Table({ width: { size: 9900, type: WidthType.DXA }, rows: [header, ...rows] });
}

function tablaApu(apu: LineaApuSpec[], undPartida: string) {
  const widths = [1400, 5000, 1400, 2100];
  const header = new TableRow({
    tableHeader: true,
    children: [
      cell("Tipo", widths[0], { header: true }),
      cell("Insumo", widths[1], { header: true }),
      cell("Und", widths[2], { header: true }),
      cell(`Cantidad / ${undPartida}`, widths[3], { header: true, right: true }),
    ],
  });
  const rows = apu.map(
    (r) =>
      new TableRow({
        children: [
          cell(etiquetaKind(r.kind), widths[0]),
          cell(`${r.codigo} · ${r.nombre}`, widths[1]),
          cell(r.und, widths[2]),
          cell(r.cantidad.toLocaleString("es-PE", { maximumFractionDigits: 4 }), widths[3], { right: true }),
        ],
      }),
  );
  return new Table({ width: { size: 9900, type: WidthType.DXA }, rows: [header, ...(rows.length ? rows : [])] });
}

function fichaPartida(x: { spec: EspecificacionTecnica; metrado?: number }, n: number) {
  const s = x.spec;
  const out: (Paragraph | Table)[] = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: `${String(n).padStart(3, "0")} · ${s.codigo}`, font: "Calibri", size: 18, bold: true, color: brass })],
    }),
    new Paragraph({
      spacing: { after: 160 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: navy, space: 4 } },
      children: [new TextRun({ text: s.titulo, font: "Calibri", size: 28, bold: true, color: navy })],
    }),
    campo("Especialidad", s.especialidad),
    campo("Capítulo", s.capitulo),
    campo("Unidad de medida", s.unidad),
    ...(x.metrado != null ? [campo("Metrado de esta obra", x.metrado.toLocaleString("es-PE", { maximumFractionDigits: 3 }))] : []),

    h2("1. Definición y alcance"),
    p(s.definicion),
    ...(s.incluye.length
      ? [
          new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: "Incluye:", font: "Calibri", size: 19, bold: true })] }),
          ...bullets(s.incluye),
        ]
      : []),
    ...(s.noIncluye.length
      ? [
          new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: "No incluye:", font: "Calibri", size: 19, bold: true })] }),
          ...bullets(s.noIncluye),
        ]
      : []),

    h2("2. Materiales, equipo y mano de obra"),
    p(s.materiales),
    p(s.equipo),
    p(s.manoObra),

    h2("3. Procedimiento constructivo"),
    ...numbered(s.procedimiento),

    h2("4. Método de medición"),
    p(s.metrado),

    h2("5. Condición de pago"),
    p(s.medicionPago),

    h2("6. Control de calidad y aceptación"),
    ...bullets(s.controlAceptacion),

    h2("7. Normas aplicables"),
    ...bullets(s.normas),

    h2("8. Análisis de precios unitarios (referencial)"),
    tablaApu(s.apu, s.unidad),
  ];
  return out;
}

/** Arma el documento .docx de especificaciones técnicas: carátula, índice de partidas, y una ficha completa por
 *  partida (definición, incluye/no incluye, materiales/equipo/mano de obra, procedimiento, medición, pago,
 *  control y normas, más el APU referencial), con pie de firmas — listo para entregar como expediente editable. */
export function construirDocEspecificaciones(
  pre: PresupuestoState,
  fichas: { spec: EspecificacionTecnica; metrado?: number }[],
  fuente: string,
): Document {
  const fecha = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  const lugar = [pre.direccion, pre.distrito, pre.provincia, pre.departamento, pre.lugar].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ");
  const sistema = SISTEMA_CONTRATACION_META[pre.sistemaContratacion] || pre.sistemaContratacion;

  return new Document({
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
                  new TextRun({ text: `ESPECIFICACIONES TÉCNICAS · ${pre.obra || ""}`, font: "Calibri", size: 16, color: brass }),
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
                  new TextRun({ text: "Especificaciones técnicas · PRE-05 · Página ", font: "Calibri", size: 16, color: brass }),
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
            children: [new TextRun({ text: "ESPECIFICACIONES TÉCNICAS DE PARTIDAS", font: "Calibri", size: 32, bold: true, color: navy })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 260 },
            children: [new TextRun({ text: fuente, font: "Times New Roman", size: 22, italics: true })],
          }),

          h1("Datos generales"),
          campo("Obra", pre.obra),
          campo("Ubicación", lugar || pre.lugar),
          campo("Cliente / Entidad", [pre.cliente, pre.entidad].filter(Boolean).join(" · ")),
          campo("RUC", pre.rucCliente),
          campo("Proyectista", pre.proyectista),
          campo("Residente de obra", pre.residente),
          campo("Sistema de contratación", `${sistema} · jornada ${pre.jornada} h/día`),
          campo("Fecha de emisión", fecha),
          campo("Fichas incluidas", `${fichas.length} partida${fichas.length === 1 ? "" : "s"}`),

          h1("Índice de partidas"),
          tablaIndice(fichas),

          ...fichas.flatMap((x, i) => fichaPartida(x, i + 1)),

          new Paragraph({ children: [new PageBreak()] }),
          h1("Firmas"),
          new Paragraph({ spacing: { before: 500 }, children: [new TextRun({ text: "_______________________________", font: "Times New Roman", size: 22 })] }),
          p("Proyectista"),
          new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "_______________________________", font: "Times New Roman", size: 22 })] }),
          p("Residente de obra / Supervisión"),
          new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "_______________________________", font: "Times New Roman", size: 22 })] }),
          p("Entidad / Cliente"),
        ],
      },
    ],
  });
}

/** Genera y descarga el .docx de especificaciones técnicas de las fichas indicadas. */
export async function exportarEspecificacionesDocx(
  pre: PresupuestoState,
  fichas: { spec: EspecificacionTecnica; metrado?: number }[],
  fuente: string,
) {
  const doc = construirDocEspecificaciones(pre, fichas, fuente);
  const blob = await Packer.toBlob(doc);
  const safe = `${pre.obra || "Obra"}`.replace(/[^\w-]+/g, "_");
  saveAs(blob, `Especificaciones_Tecnicas_${safe}.docx`);
}
