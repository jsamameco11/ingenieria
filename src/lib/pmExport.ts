import type { FiberResult, BarPt } from "./pmFiber";
import type { PMDiagram } from "./pmMotor";

export type PmSheet = { title: string; rows: string[][] };

function cell(v: number | string, d: number, comma: boolean): string {
  if (typeof v === "string") return v;
  if (!Number.isFinite(v)) return "";
  const s = v.toFixed(d);
  return comma ? s.replace(".", ",") : s;
}

function curveSweep(title: string, d: PMDiagram, comma: boolean): PmSheet {
  return {
    title,
    rows: [
      ["i", "c (cm)", "a (cm)", "φ", "φPn (t)", "φMn (t·m)", "εt", "Control"],
      ...d.rows.map((r, i) => [
        String(i + 1),
        cell(r.c, 3, comma),
        cell(r.a, 3, comma),
        cell(r.phi, 3, comma),
        cell(r.Pn, 4, comma),
        cell(r.Mn, 4, comma),
        cell(r.et, 5, comma),
        r.control,
      ]),
    ],
  };
}

function curveEnv(title: string, d: PMDiagram, comma: boolean): PmSheet {
  return {
    title,
    rows: [
      ["i", "φPn (t)", "φMn (t·m)"],
      ...d.pts.map((p, i) => [String(i + 1), cell(p[0], 4, comma), cell(p[1], 4, comma)]),
    ],
  };
}

export function buildPmSheets(opts: {
  comma?: boolean;
  meta: {
    titulo: string;
    norma: string;
    seccion: string;
    barras: string;
    Ag: number;
    As: number;
    rho: number;
    Po: number;
    Pnmax: number;
    phiC: number;
    alfa: number;
    fc: number;
    fy: number;
    cx?: number;
    cy?: number;
    ex?: number;
    ey?: number;
    simM3?: string;
    simM2?: string;
  };
  fib: FiberResult;
  bars: BarPt[];
  demands: { name: string; p: number; m2: number; m3: number; dc: number; dc2: number; dc3: number; ok: boolean; method: string }[];
}): PmSheet[] {
  const c = Boolean(opts.comma);
  const { meta, fib, bars, demands } = opts;
  const keys = (eje: string, d: PMDiagram) =>
    d.keys.map((k) => [eje, k.label, cell(k.P, 3, c), cell(k.M, 3, c)]);
  return [
    {
      title: "0. Resumen",
      rows: [
        ["Campo", "Valor", "Unidad"],
        ["Memoria", meta.titulo, ""],
        ["Norma", meta.norma, ""],
        ["Sección", meta.seccion, ""],
        ["Acero", meta.barras, ""],
        ["Ag", cell(meta.Ag, 1, c), "cm²"],
        ["As", cell(meta.As, 2, c), "cm²"],
        ["ρg", cell(meta.rho * 100, 3, c), "%"],
        ["f'c", cell(meta.fc, 0, c), "kg/cm²"],
        ["fy", cell(meta.fy, 0, c), "kg/cm²"],
        ["φc", cell(meta.phiC, 2, c), ""],
        ["α", cell(meta.alfa, 2, c), ""],
        ["Po", cell(meta.Po, 3, c), "t"],
        ["φPn,máx", cell(meta.Pnmax, 3, c), "t"],
        ["Ix", cell(fib.Ix, 0, c), "cm⁴"],
        ["Iy", cell(fib.Iy, 0, c), "cm⁴"],
        ["G · cx", cell(meta.cx ?? 0, 2, c), "cm"],
        ["G · cy", cell(meta.cy ?? 0, 2, c), "cm"],
        ["ex (G − centro del recuadro)", cell(meta.ex ?? 0, 2, c), "cm"],
        ["ey (G − centro del recuadro)", cell(meta.ey ?? 0, 2, c), "cm"],
        ["Simetría M3 (±)", meta.simM3 ?? "", ""],
        ["Simetría M2 (±)", meta.simM2 ?? "", ""],
        ["Puntos M3+", String(fib.m3.pts.length), ""],
        ["Puntos M2+", String(fib.m2.pts.length), ""],
        ["Convenio", "P a compresión positivo (t). Momento en t·m. φ de E.060/ACI según εt.", ""],
      ],
    },
    {
      title: "1. Puntos característicos",
      rows: [
        ["Eje", "Punto", "φPn (t)", "φMn (t·m)"],
        ...keys("M3+", fib.m3),
        ...keys("M3−", fib.m3n),
        ...keys("M2+", fib.m2),
        ...keys("M2−", fib.m2n),
      ],
    },
    curveEnv("2. Envolvente M3+", fib.m3, c),
    curveEnv("3. Envolvente M3−", fib.m3n, c),
    curveEnv("4. Envolvente M2+", fib.m2, c),
    curveEnv("5. Envolvente M2−", fib.m2n, c),
    curveSweep("6. Barrido Whitney M3+", fib.m3, c),
    curveSweep("7. Barrido Whitney M3−", fib.m3n, c),
    curveSweep("8. Barrido Whitney M2+", fib.m2, c),
    curveSweep("9. Barrido Whitney M2−", fib.m2n, c),
    {
      title: "10. Barras longitudinales",
      rows: [
        ["i", "x (cm)", "y (cm)", "As (cm²)"],
        ...bars.map((b, i) => [String(i + 1), cell(b.x, 2, c), cell(b.y, 2, c), cell(b.As, 3, c)]),
      ],
    },
    {
      title: "11. Demandas P–M–M",
      rows: [
        ["Combinación", "Pu (t)", "M2 (t·m)", "M3 (t·m)", "D/C M2", "D/C M3", "D/C PMM", "¿Cumple?", "Método"],
        ...(demands.length
          ? demands.map((d) => [
              d.name,
              cell(d.p, 3, c),
              cell(d.m2, 3, c),
              cell(d.m3, 3, c),
              cell(d.dc2, 4, c),
              cell(d.dc3, 4, c),
              cell(d.dc, 4, c),
              d.ok ? "Sí" : "No",
              d.method,
            ])
          : [["(sin demandas)", "", "", "", "", "", "", "", ""]]),
      ],
    },
  ];
}

export function sheetsToTsv(sheets: PmSheet[]): string {
  const blocks = sheets.map((s) => [`HOJA\t${s.title}`, ...s.rows.map((r) => r.join("\t"))].join("\n"));
  return blocks.join("\n\n");
}

export function flipDecimal(tsv: string, comma: boolean): string {
  if (comma) return tsv.replace(/(?<=\d)\.(?=\d)/g, ",");
  return tsv.replace(/(?<=\d),(?=\d)/g, ".");
}
