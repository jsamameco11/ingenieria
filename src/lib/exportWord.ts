import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
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
import { noteExport } from "./exportAd";
import type { Block, MemoriaDoc } from "./memoria";
import type { CapturedGraphic } from "./captureGraphics";

const navy = "003D82";
const brass = "5C5C5C";
const rule = { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8" };
const thin = { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8" };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const noB = { top: none, bottom: none, left: none, right: none };

function dataUrlToImage(src: string, width = 468, height = 280) {
  const m = src.match(/^data:image\/([\w+]+);base64,(.+)$/);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const type = raw.includes("png") ? "png" : raw.includes("gif") ? "gif" : "jpg";
  const bin = atob(m[2]);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  return new ImageRun({ type, data, transformation: { width, height } });
}

function graphicParagraphs(g: CapturedGraphic) {
  const out: (Paragraph | Table)[] = [];
  const img = dataUrlToImage(g.dataUrl, 500, 320);
  if (img) {
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 40 }, children: [img] }));
  }
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: g.caption, font: "Times New Roman", size: 18, italics: true, color: brass })],
    })
  );
  return out;
}

function p(text: string) {
  return new Paragraph({
    spacing: { after: 160, line: 276 },
    children: [new TextRun({ text, font: "Times New Roman", size: 22, color: "000000" })],
  });
}

function cell(text: string, width: number, header = false, center = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: { fill: "FFFFFF" },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            font: header ? "Calibri" : "Times New Roman",
            size: header ? 18 : 20,
            bold: header,
            color: header ? navy : "000000",
          }),
        ],
      }),
    ],
  });
}

function blocksToParagraphs(blocks: Block[], graphics: CapturedGraphic[] = []): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const byPart = new Map(graphics.filter((g) => g.part).map((g) => [g.part!, g]));
  const unusedMain = graphics.filter((g) => !g.part);
  let mainInserted = false;

  for (const b of blocks) {
    if (b.type === "cover") {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 80 },
          children: [
            new TextRun({ text: (b.kicker ?? "MEMORIA DE CÁLCULO").toUpperCase(), font: "Calibri", size: 28, bold: true, color: navy }),
          ],
        })
      );
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: brass, space: 8 } },
          children: [new TextRun({ text: b.titulo, font: "Calibri", size: 36, bold: true, color: navy })],
        })
      );
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 280 },
          children: [new TextRun({ text: b.subtitulo, font: "Times New Roman", size: 22, italics: true, color: brass })],
        })
      );
      out.push(kvTable(b.meta));
      if (!mainInserted && unusedMain.length) {
        out.push(
          new Paragraph({
            spacing: { before: 200, after: 80 },
            children: [new TextRun({ text: "Geometría", font: "Calibri", size: 24, bold: true, color: navy })],
          })
        );
        for (const g of unusedMain) out.push(...graphicParagraphs(g));
        mainInserted = true;
      }
      continue;
    }
    if (b.type === "h1") {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 360, after: 140 },
          children: [new TextRun({ text: b.text, font: "Calibri", size: 28, bold: true, color: navy })],
        })
      );
    } else if (b.type === "h2") {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 120 },
          children: [new TextRun({ text: b.text, font: "Calibri", size: 24, bold: true, color: navy })],
        })
      );
    } else if (b.type === "h3") {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: b.text, font: "Calibri", size: 22, bold: true, color: brass })],
        })
      );
    } else if (b.type === "p") {
      out.push(p(b.text));
    } else if (b.type === "note") {
      out.push(
        new Paragraph({
          spacing: { after: 180 },
          shading: { fill: "FFFFFF" },
          children: [
            new TextRun({ text: "Nota. ", font: "Times New Roman", size: 20, bold: true, italics: true }),
            new TextRun({ text: b.text, font: "Times New Roman", size: 20, italics: true }),
          ],
        })
      );
    } else if (b.type === "eq") {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 80 },
          children: [
            new TextRun({ text: b.text, font: "Cambria Math", size: 24, italics: true }),
            ...(b.num
              ? [new TextRun({ text: `     (${b.num})`, font: "Calibri", size: 18, color: brass })]
              : []),
          ],
        })
      );
    } else if (b.type === "kv") {
      out.push(kvTable(b.rows));
    } else if (b.type === "table") {
      if (b.caption) {
        out.push(
          new Paragraph({
            spacing: { before: 160, after: 60 },
            children: [new TextRun({ text: b.caption, font: "Calibri", size: 18, italics: true, color: brass })],
          })
        );
      }
      const colW = Math.floor(9360 / Math.max(b.headers.length, 1));
      out.push(
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: b.headers.map((h) => cell(h, colW, true, true)),
            }),
            ...b.rows.map(
              (r) =>
                new TableRow({
                  children: r.map((c) => cell(c, colW, false, true)),
                })
            ),
          ],
        })
      );
      out.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
    } else if (b.type === "check") {
      out.push(
        new Paragraph({
          spacing: { before: 80, after: 160 },
          shading: { fill: "FFFFFF" },
          children: [
            new TextRun({
              text: b.ok ? "  CUMPLE  " : "  NO CUMPLE  ",
              font: "Calibri",
              size: 20,
              bold: true,
              color: b.ok ? navy : brass,
            }),
            new TextRun({ text: "  " + b.text, font: "Times New Roman", size: 20 }),
          ],
        })
      );
    } else if (b.type === "list") {
      for (const item of b.items) {
        out.push(
          new Paragraph({
            spacing: { after: 80 },
            bullet: { level: 0 },
            children: [new TextRun({ text: item, font: "Times New Roman", size: 22 })],
          })
        );
      }
    } else if (b.type === "paso") {
      out.push(
        new Paragraph({
          spacing: { before: 200, after: 40 },
          children: [
            new TextRun({ text: `Paso ${b.n}.  `, font: "Calibri", size: 18, bold: true, color: brass }),
            new TextRun({ text: b.titulo, font: "Calibri", size: 22, bold: true, color: navy }),
          ],
        })
      );
      if (b.formula) {
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [new TextRun({ text: b.formula, font: "Cambria Math", size: 22, italics: true })],
          })
        );
      }
      if (b.desarrollo?.length) {
        out.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: "Desarrollo.", font: "Times New Roman", size: 22, bold: true })],
          })
        );
        for (const ln of b.desarrollo) {
          out.push(
            new Paragraph({
              spacing: { after: 40 },
              bullet: { level: 0 },
              children: [new TextRun({ text: ln, font: "Times New Roman", size: 22 })],
            })
          );
        }
      }
      if (b.sustituye) {
        out.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: "Sustituyendo. ", font: "Times New Roman", size: 22, bold: true }),
              new TextRun({ text: b.sustituye, font: "Times New Roman", size: 22 }),
            ],
          })
        );
      }
      out.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: "Resultado. ", font: "Times New Roman", size: 22, bold: true }),
            new TextRun({ text: b.resultado, font: "Times New Roman", size: 22 }),
          ],
        })
      );
      if (b.interpreta) {
        out.push(
          new Paragraph({
            spacing: { after: 160 },
            shading: { fill: "FFFFFF" },
            children: [
              new TextRun({ text: "Criterio. ", font: "Times New Roman", size: 20, bold: true, italics: true }),
              new TextRun({ text: b.interpreta, font: "Times New Roman", size: 20, italics: true }),
            ],
          })
        );
      }
    } else if (b.type === "figure") {
      const g = byPart.get(b.part) ?? unusedMain.find((x) => x.caption.toLowerCase().includes(b.part.toLowerCase()));
      if (g) out.push(...graphicParagraphs(g));
      else {
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 120 },
            shading: { fill: "FFFFFF" },
            children: [new TextRun({ text: `[Figura: ${b.part}]`, font: "Calibri", size: 18, italics: true, color: brass })],
          })
        );
      }
    } else if (b.type === "kpis") {
      out.push(
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: b.items.map((it) =>
                cell(`${it.label}\n${it.value}${it.hint ? `\n${it.hint}` : ""}`, Math.floor(9360 / Math.max(b.items.length, 1)), false, true)
              ),
            }),
          ],
        })
      );
      out.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
    } else if (b.type === "firma") {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 800, after: 80 },
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: navy, space: 18 } },
          children: [new TextRun({ text: b.perito, font: "Calibri", size: 22, bold: true, color: navy })],
        })
      );
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 280 },
          children: [new TextRun({ text: "Perito tasador", font: "Calibri", size: 18, color: brass })],
        })
      );
    } else if (b.type === "gallery") {
      for (const it of b.items) {
        const img = it.src ? dataUrlToImage(it.src) : null;
        if (img) {
          out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, children: [img] }));
        } else {
          out.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 40 },
              shading: { fill: "FFFFFF" },
              children: [new TextRun({ text: it.placeholder ?? "Inserte la fotografía", font: "Calibri", size: 18, color: brass })],
            })
          );
        }
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [new TextRun({ text: it.caption, font: "Times New Roman", size: 18, italics: true, color: brass })],
          })
        );
      }
    } else if (b.type === "photo") {
      const img = b.src ? dataUrlToImage(b.src) : null;
      if (img) {
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 40 }, children: [img] }));
      } else {
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 160, after: 40 },
            shading: { fill: "FFFFFF" },
            children: [new TextRun({ text: b.placeholder ?? "Inserte la fotografía", font: "Calibri", size: 18, color: brass })],
          })
        );
      }
      const leyenda = b.caption.match(/^(Imagen\s+\d{2}\.|Fig\.\s+\d{2}\.)\s*(.*)$/i);
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: leyenda
            ? [
                new TextRun({ text: leyenda[1] + " ", font: "Times New Roman", size: 18, bold: true, color: brass }),
                new TextRun({ text: leyenda[2], font: "Times New Roman", size: 18, italics: true, color: brass }),
              ]
            : [new TextRun({ text: b.caption, font: "Times New Roman", size: 18, italics: true, color: brass })],
        })
      );
    }
  }
  return out;
}

function kvTable(rows: { k: string; v: string; u?: string }[]) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    rows: rows.map(
      (r) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4200, type: WidthType.DXA },
              borders: noB,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: r.k, font: "Calibri", size: 20, color: brass })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              borders: { ...noB, bottom: rule },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: r.v, font: "Calibri", size: 20, bold: true })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 1560, type: WidthType.DXA },
              borders: noB,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: r.u ?? "", font: "Calibri", size: 18, italics: true, color: brass })],
                }),
              ],
            }),
          ],
        })
    ),
  });
}

export async function exportarWord(doc: MemoriaDoc, graphics: CapturedGraphic[] = []) {
  const word = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, bottom: 1134, left: 1418, right: 1134 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: navy, space: 6 } },
                children: [
                  new TextRun({ text: "MEMORIACALC  ·  ", font: "Calibri", size: 16, bold: true, color: navy }),
                  new TextRun({ text: doc.codigo + "  ·  " + doc.norma, font: "Calibri", size: 16, color: brass }),
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
                  new TextRun({
                    text: doc.codigo.startsWith("TAS")
                      ? "Informe de tasación  ·  Documento de valuación  ·  Página "
                      : "Memoria de cálculo  ·  Documento de ingeniería  ·  Página ",
                    font: "Calibri",
                    size: 16,
                    color: brass,
                  }),
                  new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 16 }),
                ],
              }),
            ],
          }),
        },
        children: blocksToParagraphs(doc.blocks, graphics),
      },
    ],
  });
  const blob = await Packer.toBlob(word);
  const safe = doc.codigo.replace(/[^\w\-]+/g, "_");
  const kind = doc.codigo.startsWith("TAS") ? "Informe_de_Tasacion" : "Memoria_de_Calculo";
  saveAs(blob, `${safe}_${kind}.docx`);
  noteExport();
}
