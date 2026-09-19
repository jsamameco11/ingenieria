import { barByName } from "../../types";
import {
  nAlong,
  nDraw,
  pathBothHooks90,
  ptsStr,
  STEEL_FLEX,
  STEEL_TEMP,
  STEEL_DIST,
  type SteelDraftSpec,
  type SteelLayer,
} from "../../steelDraft";
import { parseGrid, type GridModel } from "../../layoutGrid";
import {
  cellOn,
  colXY,
  collectGradeBeams,
  defaultModel,
  ensureGradeBeams,
  nxOf,
  nyOf,
  parseMae,
} from "./types";
import { ldTension } from "./steel";

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
  const sp = parseFloat((s?.[1] ?? "15").replace(",", "."));
  return { bar: barByName(bar).name, s: Number.isFinite(sp) && sp > 0 ? sp : 15, db: barByName(bar).db };
}
function bendR(dbCm: number, sc: number) {
  return Math.min(7.5, Math.max(3.2, 2.2 * (dbCm / 100) * sc));
}
function hookLen(dbCm: number, sc: number) {
  return Math.min(15, Math.max(7, 5.5 * (dbCm / 100) * sc));
}

type Cell = { id: string; x0: number; y0: number; x1: number; y1: number };
type Col = { id: string; x: number; y: number; t1: number; t2: number };
type Beam = { id: string; x0: number; y0: number; x1: number; y1: number };

function modelFromValues(values: Record<string, string>): { cells: Cell[]; cols: Col[]; beams: Beam[]; x0: number; x1: number; y0: number; y1: number } {
  const studio = sv(values, "studioJson");
  if (studio) {
    try {
      const m = parseMae(studio, defaultModel("platea"));
      const cells: Cell[] = [];
      for (let iy = 0; iy < nyOf(m); iy++)
        for (let ix = 0; ix < nxOf(m); ix++) {
          if (!cellOn(m, ix, iy)) continue;
          cells.push({ id: `${ix + 1},${iy + 1}`, x0: m.axesX[ix], y0: m.axesY[iy], x1: m.axesX[ix + 1], y1: m.axesY[iy + 1] });
        }
      if (cells.length) {
        const mm = ensureGradeBeams(m);
        const runs = collectGradeBeams(mm);
        const cols = m.cols.map((c) => {
          const p = colXY(m, c);
          return { id: c.id, x: p.x, y: p.y, t1: c.t1, t2: c.t2 };
        });
        return {
          cells,
          cols,
          beams: runs.map((r) => ({ id: r.id, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 })),
          x0: Math.min(...cells.map((c) => c.x0)),
          x1: Math.max(...cells.map((c) => c.x1)),
          y0: Math.min(...cells.map((c) => c.y0)),
          y1: Math.max(...cells.map((c) => c.y1)),
        };
      }
    } catch {
      /* fallback a gridJson */
    }
  }
  const gridRaw = sv(values, "gridJson");
  const nx = Math.max(1, Math.round(nv(values, "nBayX", 3)));
  const ny = Math.max(1, Math.round(nv(values, "nBayY", 3)));
  const Sx = nv(values, "Sx", 5);
  const Sy = nv(values, "Sy", 5);
  const ox = nv(values, "ox", 0.5);
  const oy = nv(values, "oy", 0.5);
  const fb: GridModel = {
    axesX: Array.from({ length: nx + 1 }, (_, i) => ox + i * Sx),
    axesY: Array.from({ length: ny + 1 }, (_, i) => oy + i * Sy),
    panes: Array.from({ length: ny }, () => Array.from({ length: nx }, () => true)),
    cols: [],
  };
  const g = gridRaw ? parseGrid(gridRaw, fb) : fb;
  const cells: Cell[] = [];
  for (let iy = 0; iy < g.axesY.length - 1; iy++)
    for (let ix = 0; ix < g.axesX.length - 1; ix++) {
      if (!g.panes[iy]?.[ix]) continue;
      cells.push({ id: `${ix + 1},${iy + 1}`, x0: g.axesX[ix], y0: g.axesY[iy], x1: g.axesX[ix + 1], y1: g.axesY[iy + 1] });
    }
  const cols: Col[] = (g.cols ?? []).map((c, i) => ({
    id: `C${i + 1}`,
    x: (g.axesX[c.ix] + g.axesX[Math.min(c.ix + 1, g.axesX.length - 1)]) / 2,
    y: (g.axesY[c.iy] + g.axesY[Math.min(c.iy + 1, g.axesY.length - 1)]) / 2,
    t1: c.t1,
    t2: c.t2,
  }));
  // Vigas = ejes interiores y de borde que tocan paños pintados (igual que la planta izquierda).
  const beams: Beam[] = [];
  let n = 0;
  for (let ay = 0; ay < g.axesY.length; ay++) {
    let i = 0;
    const nnx = g.axesX.length - 1;
    while (i < nnx) {
      const touches = (g.panes[ay]?.[i] ? 1 : 0) + (g.panes[ay - 1]?.[i] ? 1 : 0) > 0;
      if (!touches) {
        i += 1;
        continue;
      }
      const i0 = i;
      while (i + 1 < nnx && ((g.panes[ay]?.[i + 1] ? 1 : 0) + (g.panes[ay - 1]?.[i + 1] ? 1 : 0) > 0)) i += 1;
      n += 1;
      beams.push({ id: `VC${n}`, x0: g.axesX[i0], y0: g.axesY[ay], x1: g.axesX[i + 1], y1: g.axesY[ay] });
      i += 1;
    }
  }
  for (let ax = 0; ax < g.axesX.length; ax++) {
    let i = 0;
    const nny = g.axesY.length - 1;
    while (i < nny) {
      const touches = (g.panes[i]?.[ax] ? 1 : 0) + (g.panes[i]?.[ax - 1] ? 1 : 0) > 0;
      if (!touches) {
        i += 1;
        continue;
      }
      const i0 = i;
      while (i + 1 < nny && ((g.panes[i + 1]?.[ax] ? 1 : 0) + (g.panes[i + 1]?.[ax - 1] ? 1 : 0) > 0)) i += 1;
      n += 1;
      beams.push({ id: `VC${n}`, x0: g.axesX[ax], y0: g.axesY[i0], x1: g.axesX[ax], y1: g.axesY[i0 + 1] });
      i += 1;
    }
  }
  const xs = cells.flatMap((c) => [c.x0, c.x1]);
  const ys = cells.flatMap((c) => [c.y0, c.y1]);
  return { cells, cols, beams, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

function mkLayer(opts: {
  mark: number; name: string; face: string; bar: string; sCm: number; color: string;
  side: SteelLayer["side"]; paths: { x: number; y: number }[][]; recCm: number; nReal: number; ldCm?: number;
  callout?: SteelLayer["callout"];
}): SteelLayer {
  const def = barByName(opts.bar);
  const path = opts.paths[0] ?? [];
  const attach = path[Math.floor(path.length / 2)] ?? { x: 0, y: 0 };
  return {
    mark: opts.mark, name: opts.name, face: opts.face, bar: def.name, dbCm: def.db, sCm: opts.sCm,
    nReal: opts.nReal, asProv: (def.as / Math.max(opts.sCm, 1e-6)) * 100, asUnit: "cm²/m",
    recCm: opts.recCm, ldCm: opts.ldCm, color: opts.color, side: opts.side, draw: "bar",
    bars: [attach], barPath: path.length > 1 ? path : undefined,
    barPaths: opts.paths.filter((p) => p.length > 1), attach, callout: opts.callout,
  };
}

/**
 * Motor de renderizado dedicado — despiece de platea en planta A1.
 * Fiel a la planta izquierda: mismos paños pintados, mismas columnas
 * (C1…Cn en sus nudos) y mismas vigas VC1…VCn sobre los ejes que tocan
 * concreto. Mallas inf. continuas + sup. cortadas sobre ejes de columnas,
 * cajas de marca DENTRO del concreto, gancho 90° corto y varilla fina.
 */
export function buildPlateaDespieceSpec(values: Record<string, string>): SteelDraftSpec {
  const plan = modelFromValues(values);
  const rec = nv(values, "rec", 7.5);
  const t = nv(values, "t", 0.5);
  const fy = nv(values, "fy", 4200);
  const fc = nv(values, "fc", 210);
  const infX = parseBar(sv(values, "asInfX", sv(values, "asPos", 'Ø 1" @ 12,5 cm')), '1"');
  const infY = parseBar(sv(values, "asInfY", sv(values, "asPosY", sv(values, "asPos", 'Ø 1" @ 12,5 cm'))), '1"');
  const supX = parseBar(sv(values, "asSupX", sv(values, "asNeg", 'Ø 5/8" @ 12,5 cm')), '5/8"');
  const supY = parseBar(sv(values, "asSupY", sv(values, "asNegY", sv(values, "asNeg", 'Ø 5/8" @ 12,5 cm'))), '5/8"');

  const Lx = Math.max(plan.x1 - plan.x0, 2);
  const Ly = Math.max(plan.y1 - plan.y0, 2);
  const padL = 120;
  const padR = 170;
  const padT = 92;
  const padB = 100;
  const sc = Math.min(1080 / Lx, 640 / Ly);
  const W = Math.ceil(padL + Lx * sc + padR);
  const H = Math.ceil(padT + Ly * sc + padB);
  const xy = (x: number, y: number) => ({ x: padL + (x - plan.x0) * sc, y: padT + (plan.y1 - y) * sc });
  const recM = rec / 100;

  const x0s = xy(plan.x0, plan.y0).x;
  const x1s = xy(plan.x1, plan.y0).x;
  const yTopS = xy(plan.x0, plan.y1).y;
  const yBotS = xy(plan.x0, plan.y0).y;
  const clampX = (x: number) => Math.min(x1s - 78, Math.max(x0s + 78, x));
  const clampY = (y: number) => Math.min(yBotS - 30, Math.max(yTopS + 30, y));

  const regions = plan.cells.map((c) => ({
    points: ptsStr([xy(c.x0, c.y0), xy(c.x1, c.y0), xy(c.x1, c.y1), xy(c.x0, c.y1)]),
    fill: "#e6d9b8",
    stroke: "#163a63",
    hatch: true,
  }));
  for (const c of plan.cols) {
    const hx = c.t2 / 2;
    const hy = c.t1 / 2;
    regions.push({
      points: ptsStr([xy(c.x - hx, c.y - hy), xy(c.x + hx, c.y - hy), xy(c.x + hx, c.y + hy), xy(c.x - hx, c.y + hy)]),
      fill: "#c5d4e6",
      stroke: "#1a4473",
      hatch: false,
    });
  }

  // Mallas inferiores continuas (fondo): varias líneas finas por dirección.
  const spanX = Math.max(Lx - 2 * recM, 0.5);
  const spanY = Math.max(Ly - 2 * recM, 0.5);
  const nInfXReal = nAlong(spanY * 100, infX.s);
  const nInfYReal = nAlong(spanX * 100, infY.s);
  const nInfXShow = Math.min(nDraw(nInfXReal, 8), 8);
  const nInfYShow = Math.min(nDraw(nInfYReal, 8), 8);
  const rIX = bendR(infX.db, sc);
  const hIX = hookLen(infX.db, sc);
  const rIY = bendR(infY.db, sc);
  const hIY = hookLen(infY.db, sc);
  const infXPaths: { x: number; y: number }[][] = [];
  for (let i = 0; i < nInfXShow; i++) {
    const tt = nInfXShow === 1 ? 0.5 : i / (nInfXShow - 1);
    const y = plan.y0 + recM + tt * spanY;
    infXPaths.push(pathBothHooks90(xy(plan.x0 + recM, y), xy(plan.x1 - recM, y), "up", "up", rIX, hIX));
  }
  const infYPaths: { x: number; y: number }[][] = [];
  for (let i = 0; i < nInfYShow; i++) {
    const tt = nInfYShow === 1 ? 0.5 : i / (nInfYShow - 1);
    const x = plan.x0 + recM + tt * spanX;
    infYPaths.push(pathBothHooks90(xy(x, plan.y0 + recM), xy(x, plan.y1 - recM), "right", "right", rIY, hIY));
  }

  // Superiores cortados sobre ejes de columnas (L_teo + ℓd a cada lado del eje).
  const colXs = [...new Set(plan.cols.map((c) => c.x))].sort((a, b) => a - b);
  const colYs = [...new Set(plan.cols.map((c) => c.y))].sort((a, b) => a - b);
  const stepX = colXs.length >= 2 ? Math.min(...colXs.slice(1).map((x, i) => x - colXs[i])) : Lx / 2;
  const stepY = colYs.length >= 2 ? Math.min(...colYs.slice(1).map((y, i) => y - colYs[i])) : Ly / 2;
  const ldSX = ldTension(fy, fc, supX.db);
  const ldSY = ldTension(fy, fc, supY.db);
  const cutX = 0.25 * Math.max(stepX, 1) + ldSX / 100;
  const cutY = 0.25 * Math.max(stepY, 1) + ldSY / 100;
  const rSX = bendR(supX.db, sc);
  const hSX = hookLen(supX.db, sc);
  const rSY = bendR(supY.db, sc);
  const hSY = hookLen(supY.db, sc);
  const nSupXReal = nAlong(spanY * 100, supX.s);
  const nSupYReal = nAlong(spanX * 100, supY.s);
  const nSupXShow = Math.min(nDraw(nSupXReal, 4), 4);
  const nSupYShow = Math.min(nDraw(nSupYReal, 4), 4);
  const supXPaths: { x: number; y: number }[][] = [];
  const axesY = colYs.length ? colYs : [(plan.y0 + plan.y1) / 2];
  for (const ay of axesY) {
    for (let i = 0; i < nSupXShow; i++) {
      const tt = nSupXShow === 1 ? 0.5 : i / (nSupXShow - 1);
      const y = ay + (tt - 0.5) * Math.min(0.5, spanY * 0.06);
      if (y < plan.y0 + recM || y > plan.y1 - recM) continue;
      const xs0 = colXs.length ? colXs : [plan.x0, plan.x1];
      for (const ax of xs0) {
        const xa = Math.max(plan.x0 + recM, ax - cutX);
        const xb = Math.min(plan.x1 - recM, ax + cutX);
        if (xb - xa < 0.4) continue;
        supXPaths.push(pathBothHooks90(xy(xa, y), xy(xb, y), "down", "down", rSX, hSX));
      }
    }
  }
  const supYPaths: { x: number; y: number }[][] = [];
  const axesX = colXs.length ? colXs : [(plan.x0 + plan.x1) / 2];
  for (const ax of axesX) {
    for (let i = 0; i < nSupYShow; i++) {
      const tt = nSupYShow === 1 ? 0.5 : i / (nSupYShow - 1);
      const x = ax + (tt - 0.5) * Math.min(0.5, spanX * 0.06);
      if (x < plan.x0 + recM || x > plan.x1 - recM) continue;
      const ys0 = colYs.length ? colYs : [plan.y0, plan.y1];
      for (const ay of ys0) {
        const ya = Math.max(plan.y0 + recM, ay - cutY);
        const yb = Math.min(plan.y1 - recM, ay + cutY);
        if (yb - ya < 0.4) continue;
        supYPaths.push(pathBothHooks90(xy(x, ya), xy(x, yb), "left", "left", rSY, hSY));
      }
    }
  }

  const qx = (x0s + x1s) / 2;
  const qy = (yTopS + yBotS) / 2;
  const layers: SteelLayer[] = [
    mkLayer({
      mark: 1, name: "Inferior X", face: "fondo · sentido X · continua", bar: infX.bar, sCm: infX.s,
      color: STEEL_FLEX, side: "bottom", paths: infXPaths, recCm: rec, nReal: nInfXReal,
      ldCm: ldTension(fy, fc, infX.db), callout: { x: clampX(qx), y: clampY(yBotS - 30), anchor: "middle" },
    }),
    mkLayer({
      mark: 2, name: "Inferior Y", face: "fondo · sentido Y · continua", bar: infY.bar, sCm: infY.s,
      color: STEEL_DIST, side: "left", paths: infYPaths, recCm: rec, nReal: nInfYReal,
      ldCm: ldTension(fy, fc, infY.db), callout: { x: clampX(x0s + 150), y: clampY(qy), anchor: "middle" },
    }),
    mkLayer({
      mark: 3, name: "Superior X", face: "cara sup. · X sobre ejes · L_teo + ℓd", bar: supX.bar, sCm: supX.s,
      color: STEEL_TEMP, side: "top", paths: supXPaths.length ? supXPaths : infXPaths.slice(0, 1), recCm: rec, nReal: nSupXReal,
      ldCm: ldSX, callout: { x: clampX(qx), y: clampY(yTopS + 30), anchor: "middle" },
    }),
    mkLayer({
      mark: 4, name: "Superior Y", face: "cara sup. · Y sobre ejes · L_teo + ℓd", bar: supY.bar, sCm: supY.s,
      color: STEEL_TEMP, side: "right", paths: supYPaths.length ? supYPaths : infYPaths.slice(0, 1), recCm: rec, nReal: nSupYReal,
      ldCm: ldSY, callout: { x: clampX(x1s - 150), y: clampY(qy), anchor: "middle" },
    }),
  ];

  const guides = plan.beams.map((b) => ({
    x1: xy(b.x0, b.y0).x, y1: xy(b.x0, b.y0).y, x2: xy(b.x1, b.y1).x, y2: xy(b.x1, b.y1).y,
    color: "#163a63", dash: undefined as string | undefined, width: 2.4,
  }));

  const annos = [
    ...plan.cells.map((c) => {
      const p = xy((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2);
      return { x: p.x, y: p.y + 4, text: c.id, anchor: "middle" as const, fill: "#163a63" };
    }),
    ...plan.cols.map((c) => {
      const p = xy(c.x, c.y);
      return { x: p.x, y: p.y - Math.max(10, (c.t1 * sc) / 2 + 10), text: c.id, anchor: "middle" as const, fill: "#8b1e1e" };
    }),
    ...plan.beams.map((b) => {
      const p = xy((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
      return { x: p.x, y: p.y - 12, text: b.id, anchor: "middle" as const, fill: "#163a63" };
    }),
  ];

  return {
    title: "PLANTA — DESPIECE DE PLATEA DE CIMENTACIÓN · HOJA A1",
    subtitle: "Mallas inf. continuas + sup. cortadas sobre ejes · paños, columnas y VC de la planta",
    caption: `1 Ø ${infX.bar} @ ${infX.s.toFixed(1).replace(".", ",")} cm inf. X   ·   2 Ø ${infY.bar} @ ${infY.s.toFixed(1).replace(".", ",")} cm inf. Y   ·   3 Ø ${supX.bar} @ ${supX.s.toFixed(1).replace(".", ",")} cm sup. X   ·   4 Ø ${supY.bar} @ ${supY.s.toFixed(1).replace(".", ",")} cm sup. Y   ·   t = ${t.toFixed(2)} m   ·   ${plan.beams.length} VC   ·   ${plan.cols.length} col.`,
    note: "Despiece fiel a la planta: solo paños pintados llevan acero. Inferior X/Y continuo de borde a borde con gancho 90° corto. Superior X/Y cortado sobre cada eje de columnas (L_teo 0,25 vano + ℓd). Vigas VC sobre los ejes que tocan concreto. Rec ≥ 7,5 cm (E.060 7.7.1).",
    W, H, sheet: "a1", mode: "plan", pxPerM: sc, lineScale: 0.55, markBoxes: true,
    outline: ptsStr([xy(plan.x0, plan.y0), xy(plan.x1, plan.y0), xy(plan.x1, plan.y1), xy(plan.x0, plan.y1)]),
    regions, guides,
    dims: [
      { x1: xy(plan.x0, plan.y0).x, y1: xy(plan.x0, plan.y0).y + 28, x2: xy(plan.x1, plan.y0).x, y2: xy(plan.x0, plan.y0).y + 28, label: `Lx = ${Lx.toFixed(2)} m`, side: "bottom" },
      { x1: xy(plan.x0, plan.y0).x - 22, y1: xy(plan.x0, plan.y1).y, x2: xy(plan.x0, plan.y0).x - 22, y2: xy(plan.x0, plan.y0).y, label: `Ly = ${Ly.toFixed(2)} m`, side: "left" },
    ],
    layers, annos,
  };
}
