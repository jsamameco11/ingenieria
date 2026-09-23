import { dumpGrid, type GridModel } from "../../layoutGrid";
import { dumpMae, extent, kindLabel, nxOf, nyOf, type MaeCol, type MaeMode, type MaeModel } from "./types";

export function maeToGrid(m: MaeModel, placed = true): GridModel {
  return {
    axesX: m.axesX,
    axesY: m.axesY,
    panes: m.cells,
    cols: m.cols.map((c) => ({
      ix: c.ix,
      iy: c.iy,
      t1: c.t1,
      t2: c.t2,
      P1: c.P1,
      P2: c.P2,
      P3: c.P3,
      M1: c.M1,
      M2: c.M2,
      M3: c.M3,
    })),
    placed,
  } as GridModel;
}

export function dumpBoth(m: MaeModel) {
  return { studioJson: dumpMae(m), gridJson: dumpGrid(maeToGrid(m, true)) };
}

export type PlanBar = {
  d: string;
  sw: number;
  color: string;
  label: string;
};

export type PunchSpec = {
  L?: number;
  B?: number;
  Lx?: number;
  Ly?: number;
  d: number;
  slab?: { x0: number; y0: number; x1: number; y1: number }[];
  col: { x: number; y: number; t1: number; t2: number; id: string };
  poly: { x: number; y: number }[];
  segs?: { x1: number; y1: number; x2: number; y2: number }[];
  Vu: number;
  phiVn: number;
  b0: number;
  kind: string;
  ok: boolean;
};

export function punchPlanSize(spec: PunchSpec) {
  const L = [spec.L, spec.Lx].map(Number).find((v) => Number.isFinite(v) && v > 0) ?? 1;
  const B = [spec.B, spec.Ly].map(Number).find((v) => Number.isFinite(v) && v > 0) ?? 1;
  return { L, B };
}

export function barWidth(dbCm: number, scale: number) {
  return Math.max(2.4, Math.min(14, dbCm * scale * 1.15));
}

export function parsePunch(raw: string | undefined): PunchSpec | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as PunchSpec;
  } catch {
    return null;
  }
}

export function colAtHit(m: MaeModel, ix: number, iy: number): MaeCol | undefined {
  return m.cols.find((c) => c.ix === ix && c.iy === iy);
}

export function nearestAxis(m: MaeModel, x: number, y: number, tol: number) {
  let bestX = { i: -1, d: 1e9 };
  m.axesX.forEach((ax, i) => {
    const d = Math.abs(ax - x);
    if (d < bestX.d) bestX = { i, d };
  });
  let bestY = { i: -1, d: 1e9 };
  m.axesY.forEach((ay, i) => {
    const d = Math.abs(ay - y);
    if (d < bestY.d) bestY = { i, d };
  });
  const hitX = bestX.d <= tol;
  const hitY = bestY.d <= tol;
  return { hitX, hitY, iX: bestX.i, iY: bestY.i, dX: bestX.d, dY: bestY.d };
}

export function cellHit(m: MaeModel, x: number, y: number) {
  const nx = nxOf(m);
  const ny = nyOf(m);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      if (x >= m.axesX[ix] && x <= m.axesX[ix + 1] && y >= m.axesY[iy] && y <= m.axesY[iy + 1]) {
        return { ix, iy };
      }
    }
  }
  return null;
}

export function modeHint(mode: MaeMode) {
  if (mode === "losa") {
    return "1) Crear ejes (todos los paños quedan techo). 2) Paño on/off = pulse un paño verde para marcarlo hueco. 3) Unir/separar = clic en la línea interior entre dos techos: quita la viga y fusiona el paño. 4) Apoyo = viga / muro / libre.";
  }
  if (mode === "zapata") {
    return "1) Vanos X / Vanos Y = número de tramos (1 a 12). 2) Crear grilla rehace los ejes. 3) Cada vano se acota abajo (ℓx, ℓy). 4) Pintar planta. 5) Viga cim.: clic en un tramo grueso para borrarlo (uno a uno) o en un borde discontinuo para colocarlo. El vacío no es estructura. 6) Columnas en nudos. En la ficha: esquinera / borde mete el pedestal entero en la zapata (punzonamiento αs=20/30). Clic en una columna abre P1…M3.";
  }
  return "1) Vanos X / Vanos Y definen la malla. 2) Crear grilla. 3) Pintar platea. 4) Columnas en nudos. Esquinera / borde: pedestal entero sobre el concreto para punzonamiento. El gráfico muestra b0, Vu, φVn y OK/NO.";
}

export function axisCaption(m: MaeModel) {
  return `Ejes X: ${m.axisXKind.map(kindLabel).join(" · ")}    ·    Ejes Y: ${m.axisYKind.map(kindLabel).join(" · ")}`;
}

export function viewBoxOf(m: MaeModel, pad = 48) {
  const e = extent(m);
  const sc = Math.min(640 / Math.max(e.Lx, 1), 420 / Math.max(e.Ly, 1));
  return { pad, sc, W: pad * 2 + e.Lx * sc + 8, H: pad * 2 + e.Ly * sc + 8, e };
}

export function toPx(m: MaeModel, x: number, y: number, pad: number, sc: number) {
  const e = extent(m);
  return { x: pad + (x - e.x0) * sc, y: pad + (e.y1 - y) * sc };
}

export type PlantRect = { x0: number; y0: number; x1: number; y1: number };

function mergeIvs(ivs: [number, number][]) {
  const s = ivs.filter((a) => a[1] - a[0] > 0.04).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const iv of s) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1] + 0.08) last[1] = Math.max(last[1], iv[1]);
    else out.push([iv[0], iv[1]]);
  }
  return out;
}

/** Tramos horizontales de una barra que caen sobre concreto pintado (no cruza el vacío de una L). */
export function clipHOnRects(y: number, x0: number, x1: number, rects: PlantRect[], recM = 0): { x0: number; x1: number }[] {
  const ivs: [number, number][] = [];
  for (const r of rects) {
    if (y < r.y0 + recM - 1e-9 || y > r.y1 - recM + 1e-9) continue;
    const a = Math.max(x0, r.x0);
    const b = Math.min(x1, r.x1);
    if (b - a > 0.04) ivs.push([a, b]);
  }
  return mergeIvs(ivs).map(([a, b]) => ({ x0: a, x1: b }));
}

/** Tramos verticales de una barra sobre concreto pintado. */
export function clipVOnRects(x: number, y0: number, y1: number, rects: PlantRect[], recM = 0): { y0: number; y1: number }[] {
  const ivs: [number, number][] = [];
  for (const r of rects) {
    if (x < r.x0 + recM - 1e-9 || x > r.x1 - recM + 1e-9) continue;
    const a = Math.max(y0, r.y0);
    const b = Math.min(y1, r.y1);
    if (b - a > 0.04) ivs.push([a, b]);
  }
  return mergeIvs(ivs).map(([a, b]) => ({ y0: a, y1: b }));
}

/** Contorno exterior de la unión de rectángulos (planta en L / irregular). */
export function orthoUnionOutline(rects: PlantRect[]): { x: number; y: number }[] {
  if (!rects.length) return [];
  const xs = [...new Set(rects.flatMap((r) => [r.x0, r.x1]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((r) => [r.y0, r.y1]))].sort((a, b) => a - b);
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  if (nx < 1 || ny < 1) {
    const r = rects[0];
    return [
      { x: r.x0, y: r.y0 },
      { x: r.x1, y: r.y0 },
      { x: r.x1, y: r.y1 },
      { x: r.x0, y: r.y1 },
    ];
  }
  const on = Array.from({ length: ny }, () => Array(nx).fill(false));
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      on[j][i] = rects.some((r) => cx >= r.x0 - 1e-9 && cx <= r.x1 + 1e-9 && cy >= r.y0 - 1e-9 && cy <= r.y1 + 1e-9);
    }
  }
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!on[j][i]) continue;
      if (j === 0 || !on[j - 1][i]) edges.push({ x1: xs[i], y1: ys[j], x2: xs[i + 1], y2: ys[j] });
      if (j === ny - 1 || !on[j + 1][i]) edges.push({ x1: xs[i + 1], y1: ys[j + 1], x2: xs[i], y2: ys[j + 1] });
      if (i === 0 || !on[j][i - 1]) edges.push({ x1: xs[i], y1: ys[j + 1], x2: xs[i], y2: ys[j] });
      if (i === nx - 1 || !on[j][i + 1]) edges.push({ x1: xs[i + 1], y1: ys[j], x2: xs[i + 1], y2: ys[j + 1] });
    }
  }
  if (!edges.length) return [];
  const used = new Set<number>();
  const eq = (a: { x: number; y: number }, x: number, y: number) => Math.hypot(a.x - x, a.y - y) < 1e-6;
  const poly: { x: number; y: number }[] = [{ x: edges[0].x1, y: edges[0].y1 }];
  used.add(0);
  let guard = 0;
  while (used.size < edges.length && guard++ < edges.length + 2) {
    const last = poly[poly.length - 1];
    let hit = -1;
    for (let k = 0; k < edges.length; k++) {
      if (used.has(k)) continue;
      if (eq(last, edges[k].x1, edges[k].y1)) {
        hit = k;
        poly.push({ x: edges[k].x2, y: edges[k].y2 });
        break;
      }
      if (eq(last, edges[k].x2, edges[k].y2)) {
        hit = k;
        poly.push({ x: edges[k].x1, y: edges[k].y1 });
        break;
      }
    }
    if (hit < 0) break;
    used.add(hit);
  }
  if (poly.length >= 2 && eq(poly[0], poly[poly.length - 1].x, poly[poly.length - 1].y)) poly.pop();
  return poly;
}
