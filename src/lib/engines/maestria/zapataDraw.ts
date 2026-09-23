import { barByName } from "../../types";
import {
  nAlong,
  nDraw,
  pathBothHooks90,
  ptsStr,
  STEEL_FLEX,
  STEEL_TEMP,
  type SteelDraftSpec,
  type SteelLayer,
} from "../../steelDraft";
import { parseCorrida } from "../../layoutGrid";
import { cellOn, collectGradeBeams, colXY, defaultModel, ensureGradeBeams, nxOf, nyOf, parseMae, plantReady, type MaeModel } from "./types";
import { ldTension, losaNegBarM, seatColumnOnPainted } from "./steel";
import { clipHOnRects, orthoUnionOutline } from "./drawCommon";

function nv(v: Record<string, string>, k: string, fb = 0) {
  const s = String(v[k] ?? "").trim().replace(",", ".");
  if (s === "") return fb;
  const x = Number(s);
  return Number.isFinite(x) ? x : fb;
}

function sv(v: Record<string, string>, k: string, fb = "") {
  return String(v[k] ?? "").trim() || fb;
}

function parseBar(text: string, fallback = '1/2"') {
  const m = String(text || "").match(/Ø\s*([^@·]+)/i);
  const s = String(text || "").match(/@\s*([\d.,]+)/);
  const bar = (m?.[1] ?? fallback).replace(/inf\.|sup\.|cm.*/gi, "").trim() || fallback;
  const sp = parseFloat((s?.[1] ?? "20").replace(",", "."));
  return { bar: barByName(bar).name, s: Number.isFinite(sp) && sp > 0 ? sp : 20, db: barByName(bar).db };
}

export type ZapataPlanCell = { id: string; x0: number; y0: number; x1: number; y1: number };
export type ZapataPlanCol = { id: string; x: number; y: number; t1: number; t2: number };
export type ZapataPlan = {
  cells: ZapataPlanCell[];
  cols: ZapataPlanCol[];
  beams: { id: string; x0: number; y0: number; x1: number; y1: number }[];
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

function fromMae(m: MaeModel): ZapataPlan | null {
  const cells: ZapataPlanCell[] = [];
  for (let iy = 0; iy < nyOf(m); iy++) {
    for (let ix = 0; ix < nxOf(m); ix++) {
      if (!cellOn(m, ix, iy)) continue;
      cells.push({
        id: `P${ix + 1}-${iy + 1}`,
        x0: m.axesX[ix],
        y0: m.axesY[iy],
        x1: m.axesX[ix + 1],
        y1: m.axesY[iy + 1],
      });
    }
  }
  if (!cells.length) return null;
  const env = {
    x0: Math.min(...cells.map((c) => c.x0)),
    x1: Math.max(...cells.map((c) => c.x1)),
    y0: Math.min(...cells.map((c) => c.y0)),
    y1: Math.max(...cells.map((c) => c.y1)),
  };
  const painted = cells.map((c) => ({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }));
  const cols = m.cols
    .filter((c) => c.ix >= 0 && c.iy >= 0)
    .map((c) => {
      const p = colXY(m, c);
      const s = seatColumnOnPainted(p.x, p.y, c.t1, c.t2, painted, env);
      return { id: c.id, x: s.cx, y: s.cy, t1: c.t1, t2: c.t2 };
    });
  return {
    cells,
    cols,
    beams: collectGradeBeams(ensureGradeBeams(m)).map((r) => ({
      id: r.id,
      x0: r.x0,
      y0: r.y0,
      x1: r.x1,
      y1: r.y1,
    })),
    x0: env.x0,
    x1: env.x1,
    y0: env.y0,
    y1: env.y1,
  };
}

/** Planta real (studio / corrida) o franja de 4 paños de 1 m para muro. */
export function zapataPlantFromValues(values: Record<string, string>): ZapataPlan {
  const studio = sv(values, "studioJson");
  if (studio) {
    const m = parseMae(studio, defaultModel("zapata"));
    if (plantReady(m, "zapata")) {
      const p = fromMae(m);
      if (p) return p;
    }
  }
  const B = Math.max(nv(values, "B", 1.6), 0.8);
  const corrida = sv(values, "corridaJson");
  if (corrida) {
    const model = parseCorrida(corrida, { cols: [], hBeam: 0.6, bBeam: 0.4 });
    if (model.cols.length >= 2) {
      const xs = model.cols.map((c) => c.x);
      const cells: ZapataPlanCell[] = [];
      for (let i = 0; i < model.cols.length - 1; i++) {
        cells.push({
          id: `P${i + 1}`,
          x0: model.cols[i].x,
          y0: 0,
          x1: model.cols[i + 1].x,
          y1: B,
        });
      }
      const painted = cells.map((c) => ({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }));
      const env = { x0: Math.min(...xs), x1: Math.max(...xs), y0: 0, y1: B };
      return {
        cells,
        cols: model.cols.map((c) => {
          const s = seatColumnOnPainted(c.x, B / 2 + (c.ey || 0), c.t1, c.t2, painted, env);
          return { id: c.id, x: s.cx, y: s.cy, t1: c.t1, t2: c.t2 };
        }),
        beams: [
          { id: "VC1", x0: env.x0, y0: 0, x1: env.x1, y1: 0 },
          { id: "VC2", x0: env.x0, y0: B, x1: env.x1, y1: B },
        ],
        x0: env.x0,
        x1: env.x1,
        y0: env.y0,
        y1: env.y1,
      };
    }
  }
  const nPanes = 4;
  const cells: ZapataPlanCell[] = Array.from({ length: nPanes }, (_, i) => ({
    id: `P${i + 1}`,
    x0: i,
    y0: 0,
    x1: i + 1,
    y1: B,
  }));
  const tw = nv(values, "tw", nv(values, "t1", 0.25));
  return {
    cells,
    cols: [{ id: sv(values, "tipo", "muro") === "columnas" ? "C1" : "Muro", x: 2, y: B / 2, t1: tw, t2: 1 }],
    beams: [
      { id: "VC1", x0: 0, y0: 0, x1: nPanes, y1: 0 },
      { id: "VC2", x0: 0, y0: B, x1: nPanes, y1: B },
    ],
    x0: 0,
    x1: nPanes,
    y0: 0,
    y1: B,
  };
}

function layer(opts: {
  mark: number;
  name: string;
  face: string;
  bar: string;
  sCm: number;
  color: string;
  side: SteelLayer["side"];
  paths: { x: number; y: number }[][];
  recCm: number;
  nReal: number;
  ldCm?: number;
  callout?: SteelLayer["callout"];
}): SteelLayer {
  const def = barByName(opts.bar);
  const path = opts.paths[0] ?? [];
  const attach = path[Math.floor(path.length / 2)] ?? { x: 0, y: 0 };
  return {
    mark: opts.mark,
    name: opts.name,
    face: opts.face,
    bar: def.name,
    dbCm: def.db,
    sCm: opts.sCm,
    nReal: opts.nReal,
    asProv: (def.as / Math.max(opts.sCm, 1e-6)) * 100,
    asUnit: "cm²/m",
    recCm: opts.recCm,
    ldCm: opts.ldCm,
    color: opts.color,
    side: opts.side,
    draw: "bar",
    bars: [attach],
    barPath: path.length > 1 ? path : undefined,
    barPaths: opts.paths.filter((p) => p.length > 1),
    attach,
    callout: opts.callout,
  };
}

/** Planta A1: lechos inferior y superior. No hay acero a media altura ni corte transversal. */
export function buildZapataCorridaPlanSpec(values: Record<string, string>): SteelDraftSpec {
  const plant = zapataPlantFromValues(values);
  const rec = nv(values, "rec", 7.5);
  const hf = nv(values, "hf", 0.45);
  const tipo = sv(values, "tipo", "muro");
  const longB = parseBar(sv(values, "asLong", sv(values, "asDist", 'Ø 1/2" @ 20 cm')));
  const supL = parseBar(sv(values, "asSup", sv(values, "asLong", 'Ø 1/2" @ 20 cm')));
  const Lx = Math.max(plant.x1 - plant.x0, 0.8);
  const Ly = Math.max(plant.y1 - plant.y0, 0.6);
  const padL = 96;
  const padR = 236;
  const padT = 86;
  const padB = 86;
  const sc = Math.min(1120 / Lx, 620 / Ly);
  const W = Math.ceil(padL + Lx * sc + padR);
  const H = Math.ceil(padT + Ly * sc + padB);
  const xy = (x: number, y: number) => ({
    x: padL + (x - plant.x0) * sc,
    y: padT + (plant.y1 - y) * sc,
  });
  const recM = rec / 100;
  const cells = plant.cells.map((c) => ({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }));
  const fy = nv(values, "fy", 4200);
  const fc = nv(values, "fc", 210);
  const dCm = Math.max(hf * 100 - rec, 12);
  const ldSup = ldTension(fy, fc, supL.db);
  const ldInf = ldTension(fy, fc, longB.db);
  const rLong = Math.max(7, 6 * (longB.db / 100) * sc);
  const hookLong = Math.max(16, 12 * (longB.db / 100) * sc);
  const rSupL = Math.max(7, 6 * (supL.db / 100) * sc);
  const hookSupL = Math.max(16, 12 * (supL.db / 100) * sc);

  const regions = plant.cells.map((c) => ({
    points: ptsStr([xy(c.x0, c.y0), xy(c.x1, c.y0), xy(c.x1, c.y1), xy(c.x0, c.y1)]),
    fill: "#e8dcc0",
    stroke: "#163a63",
    hatch: true,
  }));
  for (const col of plant.cols) {
    const hx = col.t2 / 2;
    const hy = col.t1 / 2;
    regions.push({
      points: ptsStr([
        xy(col.x - hx, col.y - hy),
        xy(col.x + hx, col.y - hy),
        xy(col.x + hx, col.y + hy),
        xy(col.x - hx, col.y + hy),
      ]),
      fill: "#c5d4e6",
      stroke: "#1a4473",
      hatch: false,
    });
  }

  const longPaths: { x: number; y: number }[][] = [];
  const spanY = Math.max(Ly - 2 * recM, 0.12);
  const nLongReal = nAlong(spanY * 100, longB.s);
  const nLongShow = nDraw(nLongReal, 7);
  const xA = plant.x0 + recM;
  const xB = plant.x1 - recM;
  for (let i = 0; i < nLongShow; i++) {
    const t = nLongShow === 1 ? 0.5 : i / (nLongShow - 1);
    const y = plant.y0 + recM + t * spanY;
    for (const seg of clipHOnRects(y, xA, xB, cells, recM)) {
      longPaths.push(pathBothHooks90(xy(seg.x0, y), xy(seg.x1, y), "up", "up", rLong, hookLong));
    }
  }

  const colsX = [...plant.cols].sort((a, b) => a.x - b.x);
  const longSupPaths: { x: number; y: number }[][] = [];
  const nSupLReal = nAlong(spanY * 100, supL.s);
  const nSupLShow = nDraw(nSupLReal, 5);
  const yOff = Math.min(0.08, spanY * 0.08);
  const bands: { x0: number; x1: number }[] = [];
  if (colsX.length >= 2) {
    for (let i = 0; i < colsX.length; i++) {
      const col = colsX[i];
      const lnL = i === 0 ? 0 : col.x - colsX[i - 1].x;
      const lnR = i === colsX.length - 1 ? 0 : colsX[i + 1].x - col.x;
      const ln = Math.max(lnL, lnR, 0.5);
      const Lteo = 0.3 * ln;
      const cut = losaNegBarM({ LteoM: Lteo, dbCm: supL.db, dCm, lnM: ln, recCm: rec, edge: i === 0 || i === colsX.length - 1 });
      const Lbar = Lteo + Math.max(cut.LextM, ldSup / 100);
      const left = i === 0;
      const right = i === colsX.length - 1;
      const xa = left ? plant.x0 + recM : Math.max(plant.x0 + recM, col.x - Lbar);
      const xb = right ? plant.x1 - recM : Math.min(plant.x1 - recM, col.x + Lbar);
      if (xb - xa >= 0.25) bands.push({ x0: xa, x1: xb });
    }
  } else {
    bands.push({ x0: plant.x0 + recM, x1: plant.x1 - recM });
  }
  for (const band of bands) {
    if (band.x1 - band.x0 < 0.25) continue;
    for (let i = 0; i < nSupLShow; i++) {
      const t = nSupLShow === 1 ? 0.5 : i / (nSupLShow - 1);
      const y = plant.y0 + recM + yOff + t * Math.max(spanY - 2 * yOff, 0.08);
      for (const seg of clipHOnRects(y, band.x0, band.x1, cells, recM)) {
        if (seg.x1 - seg.x0 < 0.25) continue;
        longSupPaths.push(pathBothHooks90(xy(seg.x0, y), xy(seg.x1, y), "down", "down", rSupL, hookSupL));
      }
    }
  }

  const layers: SteelLayer[] = [
    layer({
      mark: 1,
      name: "Longitudinal inf. continuo",
      face: "∥ al eje · lecho inferior · extremo a extremo, sin corte",
      bar: longB.bar,
      sCm: longB.s,
      color: STEEL_FLEX,
      side: "bottom",
      paths: longPaths,
      recCm: rec,
      nReal: nLongReal,
      ldCm: ldInf,
      callout: { x: W / 2, y: H - 28, anchor: "middle" },
    }),
    layer({
      mark: 2,
      name: "Longitudinal sup. (cortes)",
      face: "∥ al eje · lecho superior · L_teo + ℓd en apoyos y extremos",
      bar: supL.bar,
      sCm: supL.s,
      color: STEEL_TEMP,
      side: "top",
      paths: longSupPaths,
      recCm: rec,
      nReal: nSupLReal,
      ldCm: ldSup,
      callout: { x: W / 2, y: 28, anchor: "middle" },
    }),
  ];

  const guides = [
    ...plant.cells.flatMap((c) => [
      { x1: xy(c.x0, plant.y0).x, y1: xy(c.x0, plant.y0).y, x2: xy(c.x0, plant.y1).x, y2: xy(c.x0, plant.y1).y, color: "#1a4473", dash: "5 4", width: 0.9 },
      { x1: xy(c.x1, plant.y0).x, y1: xy(c.x1, plant.y0).y, x2: xy(c.x1, plant.y1).x, y2: xy(c.x1, plant.y1).y, color: "#1a4473", dash: "5 4", width: 0.9 },
    ]),
    ...plant.beams.map((b) => ({
      x1: xy(b.x0, b.y0).x,
      y1: xy(b.x0, b.y0).y,
      x2: xy(b.x1, b.y1).x,
      y2: xy(b.x1, b.y1).y,
      color: "#163a63",
      dash: undefined as string | undefined,
      width: 3.2,
    })),
  ];

  const annos = [
    ...plant.cells.map((c) => {
      const p = xy((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2);
      return { x: p.x, y: p.y + 4, text: c.id, anchor: "middle" as const, fill: "#163a63" };
    }),
    ...plant.cols.map((c) => {
      const p = xy(c.x, c.y);
      return { x: p.x, y: p.y - Math.max(10, (c.t1 * sc) / 2 + 10), text: c.id, anchor: "middle" as const, fill: "#1a4473" };
    }),
    ...plant.beams.map((b) => {
      const p = xy((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
      return { x: p.x, y: p.y - 12, text: b.id, anchor: "middle" as const, fill: "#163a63" };
    }),
  ];

  return {
    title: "PLANTA — DESPIECE DE ACEROS · ZAPATA CORRIDA · HOJA A1",
    subtitle:
      tipo === "columnas"
        ? "Lecho inferior continuo  ·  lecho superior cortado (L_teo + ℓd)  ·  sin corte transversal ni acero intermedio"
        : "Corrida de muro  ·  lecho inferior continuo  ·  lecho superior con cortes",
    caption: `1 Ø ${longB.bar} @ ${longB.s.toFixed(0)} cm inf. continuo   ·   2 Ø ${supL.bar} @ ${supL.s.toFixed(0)} cm sup. L_teo+ℓd   ·   h = ${hf.toFixed(2)} m   ·   ${plant.beams.length} VC`,
    note: "Solo dos lechos en planta. Inferior (marca 1): continuo de extremo a extremo. Superior (marca 2): cortes en cada apoyo/extremo, longitud = L_teo (0,30 ℓn) + ℓd, con extensión ≥ máx(d, 12 db, ℓn/16) y gancho 90° en borde libre. No existe acero a media altura ni corte perpendicular al eje. Recubrimiento ≥ 7,5 cm (E.060 7.7.1).",
    W,
    H,
    sheet: "a1",
    mode: "plan",
    pxPerM: sc,
    outline: ptsStr((() => {
      const poly = orthoUnionOutline(cells);
      const use = poly.length >= 3 ? poly : [
        { x: plant.x0, y: plant.y0 },
        { x: plant.x1, y: plant.y0 },
        { x: plant.x1, y: plant.y1 },
        { x: plant.x0, y: plant.y1 },
      ];
      return use.map((p) => xy(p.x, p.y));
    })()),
    regions,
    guides,
    dims: [
      { x1: xy(plant.x0, plant.y0).x, y1: xy(plant.x0, plant.y0).y + 28, x2: xy(plant.x1, plant.y0).x, y2: xy(plant.x0, plant.y0).y + 28, label: `L = ${Lx.toFixed(2)} m`, side: "bottom" },
      { x1: xy(plant.x0, plant.y0).x - 22, y1: xy(plant.x0, plant.y1).y, x2: xy(plant.x0, plant.y0).x - 22, y2: xy(plant.x0, plant.y0).y, label: `B = ${Ly.toFixed(2)} m`, side: "left" },
    ],
    layers,
    annos,
  };
}
