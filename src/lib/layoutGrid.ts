/** Grillas de paños (losa / platea) y línea de columnas de zapata corrida. */

export type GridCol = {
  ix: number;
  iy: number;
  t1: number;
  t2: number;
  P1: number;
  P2: number;
  P3: number;
  M1: number;
  M2: number;
  M3: number;
};

export type GridModel = {
  axesX: number[];
  axesY: number[];
  panes: boolean[][];
  cols: GridCol[];
  /** Si true, las columnas son solo las clicadas (no se rellenan nudos vacíos). */
  placed?: boolean;
};

export type CorridaCol = {
  id: string;
  x: number;
  ey: number;
  centered: boolean;
  t1: number;
  t2: number;
  P1: number;
  P2: number;
  P3: number;
  M1: number;
  M2: number;
  M3: number;
};

export type CorridaModel = {
  cols: CorridaCol[];
  hBeam: number;
  bBeam: number;
};

function numList(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return fallback;
  const xs = raw.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  return xs.length >= 2 ? xs : fallback;
}

export function uniformAxes(nBay: number, span: number, origin = 0): number[] {
  const n = Math.max(1, Math.round(nBay));
  const s = Math.max(0.3, span);
  return Array.from({ length: n + 1 }, (_, i) => origin + i * s);
}

export function emptyPanes(nx: number, ny: number, on = true): boolean[][] {
  return Array.from({ length: Math.max(1, ny) }, () => Array.from({ length: Math.max(1, nx) }, () => on));
}

export function defaultCols(axesX: number[], axesY: number[], seed?: Partial<GridCol>): GridCol[] {
  const t1 = seed?.t1 ?? 0.4;
  const t2 = seed?.t2 ?? 0.4;
  const P3 = seed?.P3 ?? 80;
  const cols: GridCol[] = [];
  for (let iy = 0; iy < axesY.length; iy++) {
    for (let ix = 0; ix < axesX.length; ix++) {
      cols.push({
        ix,
        iy,
        t1,
        t2,
        P1: seed?.P1 ?? 0,
        P2: seed?.P2 ?? 0,
        P3,
        M1: seed?.M1 ?? 0,
        M2: seed?.M2 ?? 0,
        M3: seed?.M3 ?? 0,
      });
    }
  }
  return cols;
}

export function defaultGrid(nBayX = 3, nBayY = 3, Sx = 4, Sy = 5, ox = 0): GridModel {
  const axesX = uniformAxes(nBayX, Sx, ox);
  const axesY = uniformAxes(nBayY, Sy, ox);
  return {
    axesX,
    axesY,
    panes: emptyPanes(nBayX, nBayY, true),
    cols: defaultCols(axesX, axesY),
  };
}

export function parseGrid(raw: string | undefined, fallback: GridModel): GridModel {
  if (!raw?.trim()) return fallback;
  try {
    const j = JSON.parse(raw) as Partial<GridModel>;
    const axesX = numList(j.axesX, fallback.axesX).slice().sort((a, b) => a - b);
    const axesY = numList(j.axesY, fallback.axesY).slice().sort((a, b) => a - b);
    const nx = Math.max(1, axesX.length - 1);
    const ny = Math.max(1, axesY.length - 1);
    const panes = emptyPanes(nx, ny, true);
    if (Array.isArray(j.panes)) {
      for (let iy = 0; iy < ny; iy++) {
        const row = Array.isArray(j.panes[iy]) ? j.panes[iy] : [];
        for (let ix = 0; ix < nx; ix++) panes[iy][ix] = row[ix] !== false;
      }
    }
    const colsIn = Array.isArray(j.cols) ? j.cols : [];
    const placed = j.placed === true;
    const cols = placed
      ? colsIn.map((hit) => ({
          ix: Number(hit.ix) || 0,
          iy: Number(hit.iy) || 0,
          t1: Number(hit.t1) || 0.4,
          t2: Number(hit.t2) || 0.4,
          P1: Number(hit.P1) || 0,
          P2: Number(hit.P2) || 0,
          P3: Number(hit.P3) || 0,
          M1: Number(hit.M1) || 0,
          M2: Number(hit.M2) || 0,
          M3: Number(hit.M3) || 0,
        }))
      : defaultCols(axesX, axesY);
    if (!placed) {
      for (const c of cols) {
        const hit = colsIn.find((q) => Number(q.ix) === c.ix && Number(q.iy) === c.iy);
        if (!hit) continue;
        c.t1 = Number(hit.t1) || c.t1;
        c.t2 = Number(hit.t2) || c.t2;
        c.P1 = Number(hit.P1) || 0;
        c.P2 = Number(hit.P2) || 0;
        c.P3 = Number(hit.P3) || c.P3;
        c.M1 = Number(hit.M1) || 0;
        c.M2 = Number(hit.M2) || 0;
        c.M3 = Number(hit.M3) || 0;
      }
    }
    return { axesX, axesY, panes, cols, placed };
  } catch {
    return fallback;
  }
}

export function dumpGrid(g: GridModel): string {
  return JSON.stringify({
    axesX: g.axesX.map((x) => Math.round(x * 1000) / 1000),
    axesY: g.axesY.map((x) => Math.round(x * 1000) / 1000),
    panes: g.panes,
    cols: g.cols,
    placed: g.placed === true,
  });
}

export function paneOn(g: GridModel, ix: number, iy: number) {
  return Boolean(g.panes[iy]?.[ix]);
}

export function colLive(g: GridModel, ix: number, iy: number) {
  const nx = g.axesX.length - 1;
  const ny = g.axesY.length - 1;
  const neighbors = [
    [ix - 1, iy - 1],
    [ix, iy - 1],
    [ix - 1, iy],
    [ix, iy],
  ];
  return neighbors.some(([i, j]) => i >= 0 && j >= 0 && i < nx && j < ny && paneOn(g, i, j));
}

export function paneContinuity(g: GridModel, ix: number, iy: number) {
  const nx = g.axesX.length - 1;
  const ny = g.axesY.length - 1;
  const L = ix > 0 && paneOn(g, ix - 1, iy);
  const R = ix < nx - 1 && paneOn(g, ix + 1, iy);
  const B = iy > 0 && paneOn(g, ix, iy - 1);
  const T = iy < ny - 1 && paneOn(g, ix, iy + 1);
  const n = Number(L) + Number(R) + Number(B) + Number(T);
  const opp = (L && R) || (B && T);
  const adj = (L && B) || (L && T) || (R && B) || (R && T);
  const caso = n >= 4 ? "cccc" : n === 3 ? "cccd" : n === 2 ? (adj && !opp ? "ccdd" : "cccd") : n === 1 ? "cddd" : "dddd";
  return { L, R, B, T, n, caso, lx: g.axesX[ix + 1] - g.axesX[ix], ly: g.axesY[iy + 1] - g.axesY[iy] };
}

export function gridExtent(g: GridModel) {
  const xs = g.axesX;
  const ys = g.axesY;
  return { x0: xs[0], x1: xs[xs.length - 1], y0: ys[0], y1: ys[ys.length - 1], Lx: xs[xs.length - 1] - xs[0], Ly: ys[ys.length - 1] - ys[0] };
}

export function defaultCorrida(nTramos = 3, sCol = 4, t1 = 0.3, t2 = 0.4, P3 = 64): CorridaModel {
  const n = Math.max(1, Math.round(nTramos));
  const cols: CorridaCol[] = Array.from({ length: n + 1 }, (_, i) => ({
    id: `C${i + 1}`,
    x: i * sCol,
    ey: 0,
    centered: true,
    t1,
    t2,
    P1: 0,
    P2: 0,
    P3,
    M1: 0,
    M2: 0,
    M3: 0,
  }));
  return { cols, hBeam: 0.6, bBeam: 0.4 };
}

export function parseCorrida(raw: string | undefined, fallback: CorridaModel): CorridaModel {
  if (!raw?.trim()) return fallback;
  try {
    const j = JSON.parse(raw) as Partial<CorridaModel>;
    const colsIn = Array.isArray(j.cols) ? j.cols : [];
    const cols: CorridaCol[] = colsIn.map((c, i) => ({
      id: String(c.id || `C${i + 1}`),
      x: Number(c.x) || 0,
      ey: Number(c.ey) || 0,
      centered: c.centered !== false && Math.abs(Number(c.ey) || 0) < 1e-4,
      t1: Number(c.t1) || fallback.cols[0]?.t1 || 0.3,
      t2: Number(c.t2) || fallback.cols[0]?.t2 || 0.4,
      P1: Number(c.P1) || 0,
      P2: Number(c.P2) || 0,
      P3: Number(c.P3) || 0,
      M1: Number(c.M1) || 0,
      M2: Number(c.M2) || 0,
      M3: Number(c.M3) || 0,
    }));
    if (cols.length < 2) return fallback;
    cols.sort((a, b) => a.x - b.x);
    return {
      cols,
      hBeam: Number(j.hBeam) > 0.2 ? Number(j.hBeam) : fallback.hBeam,
      bBeam: Number(j.bBeam) > 0.2 ? Number(j.bBeam) : fallback.bBeam,
    };
  } catch {
    return fallback;
  }
}

export function dumpCorrida(m: CorridaModel): string {
  return JSON.stringify(m);
}

export function puCol(c: { P1: number; P2: number; P3: number }) {
  const P3 = Math.max(c.P3, 0);
  return { Pserv: P3, Pu: 1.5 * P3, Hx: c.P1, Hy: c.P2, Hxy: Math.hypot(c.P1, c.P2) };
}

export function momentsAtFooting(c: { P1: number; P2: number; M1: number; M2: number; M3: number }, hf: number) {
  return {
    M1: c.M1,
    M2: c.M2 + c.P2 * hf,
    M3: c.M3 + c.P1 * hf,
  };
}

export function setAxisSpan(axes: number[], iBay: number, span: number) {
  const s = Math.max(0.3, span);
  const next = axes.slice();
  const i = Math.max(0, Math.min(iBay, next.length - 2));
  const d = s - (next[i + 1] - next[i]);
  for (let k = i + 1; k < next.length; k++) next[k] += d;
  return next;
}
