import { barByName } from "../../types";
import {
  nAlong,
  pathBothHooks90,
  pathHook90,
  ptsStr,
  STEEL_FLEX,
  STEEL_TEMP,
  STEEL_DIST,
  type SteelDraftSpec,
  type SteelLayer,
  type SteelDim,
  type SteelSchedule,
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
import { ldTension, losaNegBarM } from "./steel";
import { orthoUnionOutline } from "./drawCommon";

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
  asReq?: number;
}): SteelLayer {
  const def = barByName(opts.bar);
  const path = opts.paths[0] ?? [];
  const attach = path[Math.floor(path.length / 2)] ?? { x: 0, y: 0 };
  return {
    mark: opts.mark, name: opts.name, face: opts.face, bar: def.name, dbCm: def.db, sCm: opts.sCm,
    nReal: opts.nReal, asProv: (def.as / Math.max(opts.sCm, 1e-6)) * 100, asUnit: "cm²/m",
    asReq: opts.asReq, recCm: opts.recCm, ldCm: opts.ldCm, color: opts.color, side: opts.side, draw: "bar",
    bars: [attach], barPath: path.length > 1 ? path : undefined,
    barPaths: opts.paths.filter((p) => p.length > 1), attach,
  };
}

/**
 * Despiece de platea en planta A1, un juego de barras por paño.
 * Inferior cortado en el paño (gancho 90° en cada eje). Superior en tramos
 * L_teo+ℓd desde el eje hacia dentro; el resumen de taller junta los dos
 * tramos del mismo eje en una sola pieza.
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
  const cells = plan.cells.map((c) => ({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }));

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

  // Cada paño lleva sus barras. El largo y la cantidad del cuadro salen de estas piezas.
  const eps = 1e-3;
  const asReqX = nv(values, "AsInfX", nv(values, "AsPos", 0));
  const asReqY = nv(values, "AsInfY", 0);
  const asReqSX = nv(values, "AsSupX", nv(values, "AsNeg", 0));
  const asReqSY = nv(values, "AsSupY", 0);
  const bayX = plan.cells.length ? Math.min(...plan.cells.map((c) => c.x1 - c.x0)) : Lx;
  const bayY = plan.cells.length ? Math.min(...plan.cells.map((c) => c.y1 - c.y0)) : Ly;
  const ldSX = ldTension(fy, fc, supX.db);
  const ldSY = ldTension(fy, fc, supY.db);
  const dCm = Math.max(t * 100 - rec, 20);
  const cutXM = losaNegBarM({ LteoM: 0.3 * Math.max(bayX, 1), dbCm: supX.db, dCm, lnM: Math.max(bayX, 1), recCm: rec, src: "pórtico" });
  const cutYM = losaNegBarM({ LteoM: 0.3 * Math.max(bayY, 1), dbCm: supY.db, dCm, lnM: Math.max(bayY, 1), recCm: rec, src: "pórtico" });
  const cutX = Math.max(cutXM.LbarM, ldSX / 100);
  const cutY = Math.max(cutYM.LbarM, ldSY / 100);
  const rIX = bendR(infX.db, sc);
  const hIX = hookLen(infX.db, sc);
  const rIY = bendR(infY.db, sc);
  const hIY = hookLen(infY.db, sc);
  const rSX = bendR(supX.db, sc);
  const hSX = hookLen(supX.db, sc);
  const rSY = bendR(supY.db, sc);
  const hSY = hookLen(supY.db, sc);
  const hookMX = (12 * infX.db) / 100;
  const hookMY = (12 * infY.db) / 100;
  const hookMSX = (12 * supX.db) / 100;
  const hookMSY = (12 * supY.db) / 100;

  type Pt = { x: number; y: number };
  const infXPaths: Pt[][] = [];
  const infYPaths: Pt[][] = [];
  const supXPaths: Pt[][] = [];
  const supYPaths: Pt[][] = [];
  const axisDims: SteelDim[] = [];
  let dimX = false;

  type Piece = { mark: number; bar: string; L: number; n: number; forma: string };
  const taller: Piece[] = [];
  const rows: string[][] = [];

  function asTxt(v: number) {
    return v > 0.001 ? v.toFixed(2) : "—";
  }
  function sep(s: number) {
    const r = Math.round(s * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
  function qL(m: number) {
    return Math.round(Math.max(m, 0) * 100) / 100;
  }
  function addTaller(mark: number, bar: string, L: number, n: number, forma: string) {
    if (n <= 0 || L < 0.15) return;
    taller.push({ mark, bar, L: qL(L), n, forma });
  }
  function touch(a: number, b: number) {
    return Math.abs(a - b) < eps;
  }
  function overlap(a0: number, a1: number, b0: number, b1: number) {
    return Math.min(a1, b1) - Math.max(a0, b0) > 0.2;
  }
  function neighbor(c: Cell, side: "L" | "R" | "B" | "T") {
    return plan.cells.some((o) => {
      if (o.id === c.id) return false;
      if (side === "L") return touch(o.x1, c.x0) && overlap(o.y0, o.y1, c.y0, c.y1);
      if (side === "R") return touch(o.x0, c.x1) && overlap(o.y0, o.y1, c.y0, c.y1);
      if (side === "B") return touch(o.y1, c.y0) && overlap(o.x0, o.x1, c.x0, c.x1);
      return touch(o.y0, c.y1) && overlap(o.x0, o.x1, c.x0, c.x1);
    });
  }
  function pushPath(bag: Pt[][], pts: Pt[]) {
    if (pts.length > 1) bag.push(pts);
  }
  function hBar(x0: number, x1: number, y: number, hookL: boolean, hookR: boolean, r: number, h: number): Pt[] {
    if (x1 - x0 < 0.2) return [];
    const a = xy(x0, y);
    const b = xy(x1, y);
    if (hookL && hookR) return pathBothHooks90(a, b, "up", "up", r, h);
    if (hookL) return pathHook90(b, a, "up", r, h);
    if (hookR) return pathHook90(a, b, "up", r, h);
    return [a, b];
  }
  function vBar(x: number, y0: number, y1: number, hookB: boolean, hookT: boolean, r: number, h: number): Pt[] {
    if (y1 - y0 < 0.2) return [];
    const a = xy(x, y0);
    const b = xy(x, y1);
    if (hookB && hookT) return pathBothHooks90(a, b, "right", "right", r, h);
    if (hookB) return pathHook90(b, a, "right", r, h);
    if (hookT) return pathHook90(a, b, "right", r, h);
    return [a, b];
  }
  function nSpan(spans: { a: number; b: number }[], sCm: number) {
    const s = [...spans].sort((p, q) => p.a - q.a);
    let n = 0;
    let a = -1e9;
    let b = -1e9;
    for (const sp of s) {
      if (sp.a > b + 0.05) {
        if (b > a) n += nAlong((b - a) * 100, sCm);
        a = sp.a;
        b = sp.b;
      } else b = Math.max(b, sp.b);
    }
    if (b > a) n += nAlong((b - a) * 100, sCm);
    return n;
  }

  const defIX = barByName(infX.bar);
  const defIY = barByName(infY.bar);
  const defSX = barByName(supX.bar);
  const defSY = barByName(supY.bar);
  const asDisp = (as: number, s: number) => ((as / Math.max(s, 1e-6)) * 100).toFixed(2);

  type Meta = Cell & {
    nInfX: number;
    nInfY: number;
    nSupX: number;
    nSupY: number;
    clearX: number;
    clearY: number;
    reachX: number;
    reachY: number;
    fullX: boolean;
    fullY: boolean;
  };
  const metas: Meta[] = [];

  for (const c of plan.cells) {
    const lx = c.x1 - c.x0;
    const ly = c.y1 - c.y0;
    const clearX = Math.max(lx - 2 * recM, 0.3);
    const clearY = Math.max(ly - 2 * recM, 0.3);
    const reachX = Math.min(Math.max(cutX, 0.35), clearX / 2);
    const reachY = Math.min(Math.max(cutY, 0.35), clearY / 2);
    const fullX = cutX >= clearX / 2 - 1e-6;
    const fullY = cutY >= clearY / 2 - 1e-6;
    const nInfX = nAlong(Math.max(ly - 2 * recM, 0.2) * 100, infX.s);
    const nInfY = nAlong(Math.max(lx - 2 * recM, 0.2) * 100, infY.s);
    const nSupX = nAlong(Math.max(ly - 2 * recM, 0.2) * 100, supX.s);
    const nSupY = nAlong(Math.max(lx - 2 * recM, 0.2) * 100, supY.s);
    metas.push({ ...c, nInfX, nInfY, nSupX, nSupY, clearX, clearY, reachX, reachY, fullX, fullY });

    const xA = c.x0 + recM;
    const xB = c.x1 - recM;
    const yA = c.y0 + recM;
    const yB = c.y1 - recM;
    for (const y of [c.y0 + ly * 0.36, c.y0 + ly * 0.64]) pushPath(infXPaths, hBar(xA, xB, y, true, true, rIX, hIX));
    for (const x of [c.x0 + lx * 0.36, c.x0 + lx * 0.64]) pushPath(infYPaths, vBar(x, yA, yB, true, true, rIY, hIY));

    const libreL = !neighbor(c, "L");
    const libreR = !neighbor(c, "R");
    const libreB = !neighbor(c, "B");
    const libreT = !neighbor(c, "T");
    const ySup = [c.y0 + ly * 0.16, c.y0 + ly * 0.84];
    const xSup = [c.x0 + lx * 0.16, c.x0 + lx * 0.84];
    if (fullX) {
      for (const y of ySup) pushPath(supXPaths, hBar(xA, xB, y, libreL, libreR, rSX, hSX));
      if (!dimX) {
        const y = ySup[0];
        const yD = xy(xA, y).y - 14;
        axisDims.push({
          x1: xy(xA, y).x, y1: yD, x2: xy(xB, y).x, y2: yD,
          label: `L_teo+ℓd ${clearX.toFixed(2)} m`, side: "top", tiny: true,
        });
        dimX = true;
      }
    } else {
      for (const y of ySup) {
        pushPath(supXPaths, hBar(xA, xA + reachX, y, libreL, false, rSX, hSX));
        pushPath(supXPaths, hBar(xB - reachX, xB, y, false, libreR, rSX, hSX));
      }
      if (!dimX) {
        const y = ySup[0];
        const yD = xy(xA, y).y - 14;
        axisDims.push({
          x1: xy(c.x0, y).x,
          y1: yD,
          x2: xy(xA + reachX, y).x,
          y2: yD,
          label: `L_teo+ℓd ${reachX.toFixed(2)} m`,
          side: "top",
          tiny: true,
        });
        dimX = true;
      }
    }
    if (fullY) {
      for (const x of xSup) pushPath(supYPaths, vBar(x, yA, yB, libreB, libreT, rSY, hSY));
    } else {
      for (const x of xSup) {
        pushPath(supYPaths, vBar(x, yA, yA + reachY, libreB, false, rSY, hSY));
        pushPath(supYPaths, vBar(x, yB - reachY, yB, false, libreT, rSY, hSY));
      }
    }

    const LinfX = qL(clearX + 2 * hookMX);
    const LinfY = qL(clearY + 2 * hookMY);
    addTaller(1, infX.bar, LinfX, nInfX, "recta + 2 ganchos 90°");
    addTaller(2, infY.bar, LinfY, nInfY, "recta + 2 ganchos 90°");

    const formaSupX = fullX ? (libreL || libreR ? "corrida en el paño + gancho en borde" : "corrida en el paño") : "2 tramos desde el eje";
    const formaSupY = fullY ? (libreB || libreT ? "corrida en el paño + gancho en borde" : "corrida en el paño") : "2 tramos desde el eje";
    const LshowSupX = fullX ? qL(clearX + (libreL ? hookMSX : 0) + (libreR ? hookMSX : 0)) : qL(reachX);
    const LshowSupY = fullY ? qL(clearY + (libreB ? hookMSY : 0) + (libreT ? hookMSY : 0)) : qL(reachY);
    if (fullX) addTaller(3, supX.bar, LshowSupX, nSupX, formaSupX);
    if (fullY) addTaller(4, supY.bar, LshowSupY, nSupY, formaSupY);

    const pushRow = (mark: string, lecho: string, bar: string, s: number, n: number, L: number, forma: string, req: number, disp: string) => {
      rows.push([c.id, mark, lecho, `Ø ${bar}`, sep(s), String(n), L.toFixed(2), forma, asTxt(req), disp]);
    };
    pushRow("1", "inf. X", infX.bar, infX.s, nInfX, LinfX, "recta + 2 ganchos 90°", asReqX, asDisp(defIX.as, infX.s));
    pushRow("2", "inf. Y", infY.bar, infY.s, nInfY, LinfY, "recta + 2 ganchos 90°", asReqY, asDisp(defIY.as, infY.s));
    pushRow("3", "sup. X", supX.bar, supX.s, fullX ? nSupX : nSupX * 2, LshowSupX, formaSupX, asReqSX, asDisp(defSX.as, supX.s));
    pushRow("4", "sup. Y", supY.bar, supY.s, fullY ? nSupY : nSupY * 2, LshowSupY, formaSupY, asReqSY, asDisp(defSY.as, supY.s));
  }

  function joinAxis(mark: number, bar: string, horizontal: boolean, sCm: number, hookM: number) {
    const seen = new Set<string>();
    const axes = [...new Set(metas.flatMap((c) => (horizontal ? [c.x0, c.x1] : [c.y0, c.y1])))].sort((a, b) => a - b);
    for (const axis of axes) {
      const neg = metas.filter((c) => (horizontal ? touch(c.x1, axis) : touch(c.y1, axis)));
      const pos = metas.filter((c) => (horizontal ? touch(c.x0, axis) : touch(c.y0, axis)));
      const take = (o: Meta) => {
        const key = `${o.id}@${axis.toFixed(3)}@${horizontal ? "x" : "y"}`;
        if (seen.has(key)) return;
        const opp = (neg.includes(o) ? pos : neg).find((c) =>
          horizontal ? touch(c.y0, o.y0) && touch(c.y1, o.y1) : touch(c.x0, o.x0) && touch(c.x1, o.x1),
        );
        seen.add(key);
        if (opp) seen.add(`${opp.id}@${axis.toFixed(3)}@${horizontal ? "x" : "y"}`);
        const full = horizontal ? o.fullX || !!opp?.fullX : o.fullY || !!opp?.fullY;
        if (full) return;
        const spans = (neg.length ? neg : pos)
          .filter((c) => (horizontal ? touch(c.y0, o.y0) && touch(c.y1, o.y1) : touch(c.x0, o.x0) && touch(c.x1, o.x1)) || c.id === o.id)
          .map((c) => (horizontal ? { a: c.y0 + recM, b: c.y1 - recM } : { a: c.x0 + recM, b: c.x1 - recM }));
        const n = nSpan(spans.length ? spans : [horizontal ? { a: o.y0 + recM, b: o.y1 - recM } : { a: o.x0 + recM, b: o.x1 - recM }], sCm);
        const r1 = horizontal ? o.reachX : o.reachY;
        const r2 = opp ? (horizontal ? opp.reachX : opp.reachY) : 0;
        addTaller(mark, bar, r1 + r2 + (opp ? 0 : hookM), n, opp ? "recta, centrada en el eje" : "recta + gancho 90° en borde");
      };
      for (const o of neg) take(o);
      for (const o of pos) take(o);
    }
  }
  joinAxis(3, supX.bar, true, supX.s, hookMSX);
  joinAxis(4, supY.bar, false, supY.s, hookMSY);

  const grouped = new Map<string, Piece>();
  for (const p of taller) {
    const k = `${p.mark}|${p.bar}|${p.L.toFixed(2)}|${p.forma}`;
    const g = grouped.get(k);
    if (g) g.n += p.n;
    else grouped.set(k, { ...p });
  }
  const kgm = (bar: string) => barByName(bar).as * 0.785;
  const tallerRows = [...grouped.values()]
    .sort((a, b) => a.mark - b.mark || a.L - b.L)
    .map((p) => [String(p.mark), `Ø ${p.bar}`, p.forma, p.L.toFixed(2), String(p.n), (p.n * p.L * kgm(p.bar)).toFixed(1)]);
  const schedules: SteelSchedule[] = [
    {
      caption: "Cuadro de despiece por paño",
      headers: ["Paño", "Marca", "Lecho", "Ø", "@ (cm)", "n", "L (m)", "Forma", "As req", "As disp"],
      rows,
      note: "n y L son las piezas de ese paño. En el superior, L es la longitud de cada tramo desde el eje. As req es el de la franja gobernante (cm²/m) y As disp el que aporta el Ø adoptado.",
    },
    {
      caption: "Resumen de taller — piezas a cortar",
      headers: ["Marca", "Ø", "Forma", "L corte (m)", "Cant.", "kg"],
      rows: tallerRows,
      note: "El inferior se corta por paño, con dos ganchos 90°. El negativo de un eje interior es una sola barra (tramo + tramo) y entra una vez. kg = n × L × 0,785 × As de la barra.",
    },
  ];
  const sumN = (mark: number) => tallerRows.filter((r) => r[0] === String(mark)).reduce((s, r) => s + Number(r[4] || 0), 0);

  const layers: SteelLayer[] = [
    mkLayer({
      mark: 1, name: "Inferior X", face: "por paño · ganchos en los ejes", bar: infX.bar, sCm: infX.s,
      color: STEEL_FLEX, side: "bottom", paths: infXPaths, recCm: rec, nReal: Math.max(2, sumN(1)),
      ldCm: ldTension(fy, fc, infX.db), asReq: asReqX > 0 ? asReqX : undefined,
    }),
    mkLayer({
      mark: 2, name: "Inferior Y", face: "por paño · ganchos en los ejes", bar: infY.bar, sCm: infY.s,
      color: STEEL_DIST, side: "left", paths: infYPaths, recCm: rec, nReal: Math.max(2, sumN(2)),
      ldCm: ldTension(fy, fc, infY.db), asReq: asReqY > 0 ? asReqY : undefined,
    }),
    mkLayer({
      mark: 3, name: "Superior X", face: "tramos L_teo+ℓd desde el eje", bar: supX.bar, sCm: supX.s,
      color: STEEL_TEMP, side: "top", paths: supXPaths, recCm: rec, nReal: Math.max(2, sumN(3)),
      ldCm: ldSX, asReq: asReqSX > 0 ? asReqSX : undefined,
    }),
    mkLayer({
      mark: 4, name: "Superior Y", face: "tramos L_teo+ℓd desde el eje", bar: supY.bar, sCm: supY.s,
      color: "#245c78", side: "right", paths: supYPaths, recCm: rec, nReal: Math.max(2, sumN(4)),
      ldCm: ldSY, asReq: asReqSY > 0 ? asReqSY : undefined,
    }),
  ];

  const guides = plan.beams.map((b) => ({
    x1: xy(b.x0, b.y0).x, y1: xy(b.x0, b.y0).y, x2: xy(b.x1, b.y1).x, y2: xy(b.x1, b.y1).y,
    color: "#163a63", dash: undefined as string | undefined, width: 2.4,
  }));

  const annos = [
    ...metas.flatMap((c) => {
      const p = xy((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2);
      const lines = [
        { text: c.id, size: 12, fill: "#163a63", dy: -8 },
        { text: `1 Ø ${infX.bar} @ ${sep(infX.s)}   ·   2 Ø ${infY.bar} @ ${sep(infY.s)}`, size: 9, fill: "#5a2a2a", dy: 6 },
        { text: `3 Ø ${supX.bar} @ ${sep(supX.s)}   ·   4 Ø ${supY.bar} @ ${sep(supY.s)}`, size: 9, fill: "#1a4473", dy: 18 },
      ];
      return lines.map((ln) => ({ x: p.x, y: p.y + ln.dy, text: ln.text, anchor: "middle" as const, fill: ln.fill, size: ln.size }));
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
    subtitle: "Un despiece por paño · inferior cortado en el paño · superior en tramos L_teo+ℓd",
    caption: `Cada paño: 1 Ø ${infX.bar} @ ${sep(infX.s)} cm inf. X   ·   2 Ø ${infY.bar} @ ${sep(infY.s)} cm inf. Y   ·   3 Ø ${supX.bar} @ ${sep(supX.s)} cm sup. X   ·   4 Ø ${supY.bar} @ ${sep(supY.s)} cm sup. Y   ·   t = ${t.toFixed(2)} m   ·   ${plan.cells.length} paños   ·   ${plan.cols.length} col.`,
    note: "Solo los paños pintados llevan acero. El inferior de cada paño termina con gancho 90° en los ejes. El superior entra desde cada eje una longitud L_teo+ℓd; si esa longitud cubre el paño, la barra es corrida dentro del paño. El resumen de taller no duplica el negativo: los dos tramos de un eje interior son una sola barra.",
    W, H, sheet: "a1", mode: "plan", pxPerM: sc, lineScale: 0.55, hideCallouts: true,
    outline: ptsStr((() => {
      const poly = orthoUnionOutline(cells);
      const use = poly.length >= 3 ? poly : [
        { x: plan.x0, y: plan.y0 },
        { x: plan.x1, y: plan.y0 },
        { x: plan.x1, y: plan.y1 },
        { x: plan.x0, y: plan.y1 },
      ];
      return use.map((p) => xy(p.x, p.y));
    })()),
    regions, guides,
    dims: [
      { x1: xy(plan.x0, plan.y0).x, y1: xy(plan.x0, plan.y0).y + 28, x2: xy(plan.x1, plan.y0).x, y2: xy(plan.x0, plan.y0).y + 28, label: `Lx = ${Lx.toFixed(2)} m`, side: "bottom" as const },
      { x1: xy(plan.x0, plan.y0).x - 22, y1: xy(plan.x0, plan.y1).y, x2: xy(plan.x0, plan.y0).x - 22, y2: xy(plan.x0, plan.y0).y, label: `Ly = ${Ly.toFixed(2)} m`, side: "left" as const },
      ...axisDims,
    ],
    layers, annos, schedules,
  };
}
