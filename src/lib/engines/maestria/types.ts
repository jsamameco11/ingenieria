/** Modelo de taller (losa / zapata corrida / platea): grilla, paños, uniones y apoyos clicados. */

export type MaeMode = "losa" | "zapata" | "platea";
export type AxisKind = "viga" | "muro" | "libre";
export type MaeTool = "celda" | "columna" | "unir" | "apoyo" | "viga";
export type LosaTipo = "maciza" | "aligerada";
export type LosaRelleno = "ladrillo" | "eps";
export type EdgeKind = "continuo" | "discontinuo" | "libre";

export type MaeCol = {
  id: string;
  ix: number;
  iy: number;
  t1: number;
  t2: number;
  /** Corte FX (ETABS F1), t. */
  P1: number;
  /** Corte FY (ETABS F2), t. */
  P2: number;
  /** Axial FZ (ETABS F3), t. Compresión positiva. */
  P3: number;
  /** Torsión MZ, t·m. */
  M1: number;
  /** Flexión MX → ey, t·m. */
  M2: number;
  /** Flexión MY → ex, t·m. */
  M3: number;
  ex: number;
  ey: number;
  centered: boolean;
  /** nudo = en el entrecruce; esquinera / borde = pedestal entero sobre el concreto (punzonamiento). */
  seat?: "nudo" | "esquinera" | "borde";
};

export type MaeModel = {
  axesX: number[];
  axesY: number[];
  cells: boolean[][];
  /** Une la celda (ix, iy) con (ix+1, iy). */
  mergeH: boolean[][];
  /** Une la celda (ix, iy) con (ix, iy+1). */
  mergeV: boolean[][];
  cols: MaeCol[];
  axisXKind: AxisKind[];
  axisYKind: AxisKind[];
  /** Viga de cimentación vertical (eje X constante): [iy][iEjeX], ny × (nx+1). */
  beamV: boolean[][];
  /** Viga de cimentación horizontal (eje Y constante): [iEjeY][ix], (ny+1) × nx. */
  beamH: boolean[][];
  volN: number;
  volS: number;
  volE: number;
  volW: number;
};

export type MaeMat = {
  hCm: number;
  recCm: number;
  D: number;
  L: number;
  fy: number;
  fc: number;
  qadm: number;
  Df: number;
  gt: number;
  sc: number;
  Ks: number;
  bBeam: number;
  hBeam: number;
};

export type RectPane = {
  ix0: number;
  iy0: number;
  ix1: number;
  iy1: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  lx: number;
  ly: number;
  id: string;
};

export type IdentifiedPane = RectPane & {
  edges: { L: EdgeKind; R: EdgeKind; B: EdgeKind; T: EdgeKind };
  caso: string;
  twoWay: boolean;
  tipo: LosaTipo;
};

export type IdentifiedStrip = {
  id: string;
  dir: "x" | "y";
  /** Fila (franja X) o columna (franja Y) de celdas. */
  line: number;
  i0: number;
  i1: number;
  spans: number[];
  /** Índices de eje de cada nudo del pórtico (longitud = spans+1). Unir omite el apoyo interior. */
  nodes: number[];
  paneIds: string[];
  b: number;
  why: string;
};

export type LosaBarRun = {
  kind: "pos" | "neg";
  dir: "x" | "y";
  line: number;
  i0: number;
  i1: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  paneIds: string[];
  why: string;
};

export type IdentifiedVoid = {
  ix: number;
  iy: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  id: string;
};

export type XY = { x: number; y: number };

export function emptyBool(ny: number, nx: number, on = false): boolean[][] {
  return Array.from({ length: Math.max(1, ny) }, () => Array.from({ length: Math.max(1, nx) }, () => on));
}

/** Vecino pintado de un segmento de eje: vertical (constante X) u horizontal (constante Y). */
export function beamSegTouchesPaint(m: MaeModel, kind: "v" | "h", iAxis: number, iCell: number) {
  if (kind === "v") {
    const left = iAxis > 0 && cellOn(m, iAxis - 1, iCell);
    const right = iAxis < nxOf(m) && cellOn(m, iAxis, iCell);
    return left || right;
  }
  const bot = iAxis > 0 && cellOn(m, iCell, iAxis - 1);
  const top = iAxis < nyOf(m) && cellOn(m, iCell, iAxis);
  return bot || top;
}

export function hasGradeBeam(m: MaeModel, kind: "v" | "h", iAxis: number, iCell: number) {
  if (!beamSegTouchesPaint(m, kind, iAxis, iCell)) return false;
  if (kind === "v") return Boolean(m.beamV[iCell]?.[iAxis]);
  return Boolean(m.beamH[iAxis]?.[iCell]);
}

/** Tamaño correcto y, si faltan datos, vigas en todo borde de zapata pintada. */
export function ensureGradeBeams(m: MaeModel, opts?: { reset?: boolean }): MaeModel {
  const nx = nxOf(m);
  const ny = nyOf(m);
  const storedV = !opts?.reset && m.beamV?.length === ny && (m.beamV[0]?.length ?? 0) === nx + 1;
  const storedH = !opts?.reset && m.beamH?.length === ny + 1 && (m.beamH[0]?.length ?? 0) === nx;
  const beamV = emptyBool(ny, nx + 1, false);
  const beamH = emptyBool(ny + 1, nx, false);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix <= nx; ix++) {
      if (!beamSegTouchesPaint(m, "v", ix, iy)) continue;
      beamV[iy][ix] = storedV ? Boolean(m.beamV[iy][ix]) : true;
    }
  }
  for (let iy = 0; iy <= ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      if (!beamSegTouchesPaint(m, "h", iy, ix)) continue;
      beamH[iy][ix] = storedH ? Boolean(m.beamH[iy][ix]) : true;
    }
  }
  return { ...m, beamV, beamH };
}

export function toggleGradeBeam(m: MaeModel, hit: { kind: "v" | "h"; iAxis: number; iCell: number }): MaeModel {
  const next = ensureGradeBeams(m);
  if (hit.kind === "v") {
    const iy = hit.iCell;
    const ix = hit.iAxis;
    if (next.beamV[iy] && ix >= 0 && ix < next.beamV[iy].length) {
      next.beamV[iy] = next.beamV[iy].slice();
      next.beamV[iy][ix] = !next.beamV[iy][ix];
    }
  } else {
    const iy = hit.iAxis;
    const ix = hit.iCell;
    if (next.beamH[iy] && ix >= 0 && ix < next.beamH[iy].length) {
      next.beamH[iy] = next.beamH[iy].slice();
      next.beamH[iy][ix] = !next.beamH[iy][ix];
    }
  }
  return next;
}

/** Al pintar una celda se encienden sus cuatro bordes; al apagar, se limpian los que ya no tocan zapata. */
export function markCellBeams(m: MaeModel, ix: number, iy: number, on: boolean): MaeModel {
  const next = ensureGradeBeams(m);
  if (on && next.beamV[iy] && next.beamH[iy]) {
    next.beamV[iy] = next.beamV[iy].slice();
    next.beamV[iy][ix] = true;
    next.beamV[iy][ix + 1] = true;
    next.beamH[iy] = next.beamH[iy].slice();
    next.beamH[iy][ix] = true;
    if (next.beamH[iy + 1]) {
      next.beamH[iy + 1] = next.beamH[iy + 1].slice();
      next.beamH[iy + 1][ix] = true;
    }
  }
  return ensureGradeBeams(next);
}

export type GradeBeamRun = {
  id: string;
  kind: "h" | "v";
  iAxis: number;
  i0: number;
  i1: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  L: number;
  b: number;
};

function nHOnCell(m: MaeModel, ix: number, iy: number) {
  return (hasGradeBeam(m, "h", iy, ix) ? 1 : 0) + (hasGradeBeam(m, "h", iy + 1, ix) ? 1 : 0);
}

function nVOnCell(m: MaeModel, ix: number, iy: number) {
  return (hasGradeBeam(m, "v", ix, iy) ? 1 : 0) + (hasGradeBeam(m, "v", ix + 1, iy) ? 1 : 0);
}

function tribH(m: MaeModel, ay: number, i0: number, i1: number) {
  let sum = 0;
  let n = 0;
  for (let ix = i0; ix <= i1; ix++) {
    let t = 0;
    if (ay > 0 && cellOn(m, ix, ay - 1)) {
      t += (m.axesY[ay] - m.axesY[ay - 1]) / Math.max(nHOnCell(m, ix, ay - 1), 1);
    }
    if (ay < nyOf(m) && cellOn(m, ix, ay)) {
      t += (m.axesY[ay + 1] - m.axesY[ay]) / Math.max(nHOnCell(m, ix, ay), 1);
    }
    if (t > 0) {
      sum += t;
      n += 1;
    }
  }
  return Math.max(n ? sum / n : 0.4, 0.3);
}

function tribV(m: MaeModel, ax: number, i0: number, i1: number) {
  let sum = 0;
  let n = 0;
  for (let iy = i0; iy <= i1; iy++) {
    let t = 0;
    if (ax > 0 && cellOn(m, ax - 1, iy)) {
      t += (m.axesX[ax] - m.axesX[ax - 1]) / Math.max(nVOnCell(m, ax - 1, iy), 1);
    }
    if (ax < nxOf(m) && cellOn(m, ax, iy)) {
      t += (m.axesX[ax + 1] - m.axesX[ax]) / Math.max(nVOnCell(m, ax, iy), 1);
    }
    if (t > 0) {
      sum += t;
      n += 1;
    }
  }
  return Math.max(n ? sum / n : 0.4, 0.3);
}

/** Tramos continuos de viga de cimentación sobre la zapata pintada. */
export function collectGradeBeams(m: MaeModel): GradeBeamRun[] {
  const nx = nxOf(m);
  const ny = nyOf(m);
  const runs: GradeBeamRun[] = [];
  let n = 0;
  for (let ay = 0; ay <= ny; ay++) {
    let i = 0;
    while (i < nx) {
      while (i < nx && !hasGradeBeam(m, "h", ay, i)) i += 1;
      if (i >= nx) break;
      const i0 = i;
      while (i + 1 < nx && hasGradeBeam(m, "h", ay, i + 1)) i += 1;
      const i1 = i;
      n += 1;
      runs.push({
        id: `VC${n}`,
        kind: "h",
        iAxis: ay,
        i0,
        i1,
        x0: m.axesX[i0],
        y0: m.axesY[ay],
        x1: m.axesX[i1 + 1],
        y1: m.axesY[ay],
        L: m.axesX[i1 + 1] - m.axesX[i0],
        b: tribH(m, ay, i0, i1),
      });
      i += 1;
    }
  }
  for (let ax = 0; ax <= nx; ax++) {
    let i = 0;
    while (i < ny) {
      while (i < ny && !hasGradeBeam(m, "v", ax, i)) i += 1;
      if (i >= ny) break;
      const i0 = i;
      while (i + 1 < ny && hasGradeBeam(m, "v", ax, i + 1)) i += 1;
      const i1 = i;
      n += 1;
      runs.push({
        id: `VC${n}`,
        kind: "v",
        iAxis: ax,
        i0,
        i1,
        x0: m.axesX[ax],
        y0: m.axesY[i0],
        x1: m.axesX[ax],
        y1: m.axesY[i1 + 1],
        L: m.axesY[i1 + 1] - m.axesY[i0],
        b: tribV(m, ax, i0, i1),
      });
      i += 1;
    }
  }
  return runs;
}

/** Columnas sobre el eje del tramo (se asignan al VC más cercano de esa dirección). */
export function loadsOnGradeBeam(
  run: GradeBeamRun,
  loads: { x: number; y: number; P: number; M2?: number; M3?: number }[],
  peers: GradeBeamRun[] = [run],
): { x: number; P: number; M?: number }[] {
  const family = peers.filter((r) => r.kind === run.kind);
  const dist = (c: { x: number; y: number }, r: GradeBeamRun) => distToSeg(c.x, c.y, r.x0, r.y0, r.x1, r.y1);
  const along = (c: { x: number; y: number }, r: GradeBeamRun) => (r.kind === "h" ? c.x : c.y);
  const tol = Math.max(run.b + 0.15, 0.85);
  return loads
    .filter((c) => {
      const s = along(c, run);
      const lo = run.kind === "h" ? Math.min(run.x0, run.x1) : Math.min(run.y0, run.y1);
      const hi = run.kind === "h" ? Math.max(run.x0, run.x1) : Math.max(run.y0, run.y1);
      if (s < lo - 0.35 || s > hi + 0.35) return false;
      const dThis = dist(c, run);
      if (dThis > tol) return false;
      const nearest = family.reduce((a, r) => (dist(c, r) < dist(c, a) ? r : a), run);
      return nearest.id === run.id;
    })
    .map((c) =>
      run.kind === "h"
        ? { x: c.x - run.x0, P: c.P, M: c.M3 }
        : { x: c.y - run.y0, P: c.P, M: c.M2 },
    );
}

export function setAllGradeBeams(m: MaeModel, on: boolean): MaeModel {
  const next = ensureGradeBeams(m, { reset: true });
  if (on) return next;
  return {
    ...next,
    beamV: next.beamV.map((row) => row.map(() => false)),
    beamH: next.beamH.map((row) => row.map(() => false)),
  };
}

/** Apaga todos los vanos de un tramo continuo (una viga, no toda la planta). */
export function clearGradeBeamRun(m: MaeModel, run: GradeBeamRun): MaeModel {
  const next = ensureGradeBeams(m);
  if (run.kind === "h") {
    const row = (next.beamH[run.iAxis] ?? []).slice();
    for (let ix = run.i0; ix <= run.i1; ix++) row[ix] = false;
    const beamH = next.beamH.slice();
    beamH[run.iAxis] = row;
    return { ...next, beamH };
  }
  const beamV = next.beamV.map((row) => row.slice());
  for (let iy = run.i0; iy <= run.i1; iy++) {
    if (beamV[iy]) beamV[iy][run.iAxis] = false;
  }
  return { ...next, beamV };
}

function distToSeg(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const L2 = dx * dx + dy * dy || 1e-9;
  let t = ((x - ax) * dx + (y - ay) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

export function hitGradeBeam(
  m: MaeModel,
  x: number,
  y: number,
  tol: number,
): { kind: "v" | "h"; iAxis: number; iCell: number } | null {
  const nx = nxOf(m);
  const ny = nyOf(m);
  let best: { kind: "v" | "h"; iAxis: number; iCell: number; d: number } | null = null;
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix <= nx; ix++) {
      if (!beamSegTouchesPaint(m, "v", ix, iy)) continue;
      const d = distToSeg(x, y, m.axesX[ix], m.axesY[iy], m.axesX[ix], m.axesY[iy + 1]);
      if (d <= tol && (!best || d < best.d)) best = { kind: "v", iAxis: ix, iCell: iy, d };
    }
  }
  for (let iy = 0; iy <= ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      if (!beamSegTouchesPaint(m, "h", iy, ix)) continue;
      const d = distToSeg(x, y, m.axesX[ix], m.axesY[iy], m.axesX[ix + 1], m.axesY[iy]);
      if (d <= tol && (!best || d < best.d)) best = { kind: "h", iAxis: iy, iCell: ix, d };
    }
  }
  return best ? { kind: best.kind, iAxis: best.iAxis, iCell: best.iCell } : null;
}

export const MIN_VANO_M = 0.3;

export function uniformAxes(nBay: number, span: number, origin = 0): number[] {
  const n = Math.max(1, Math.round(nBay));
  const s = Math.max(MIN_VANO_M, span);
  return Array.from({ length: n + 1 }, (_, i) => origin + i * s);
}

export function defaultModel(mode: MaeMode): MaeModel {
  if (mode === "losa") {
    const axesX = uniformAxes(3, 4);
    const axesY = uniformAxes(2, 5);
    const nx = axesX.length - 1;
    const ny = axesY.length - 1;
    return {
      axesX,
      axesY,
      cells: emptyBool(ny, nx, true),
      mergeH: emptyBool(ny, nx, false),
      mergeV: emptyBool(ny, nx, false),
      cols: [],
      axisXKind: Array.from({ length: axesX.length }, () => "viga"),
      axisYKind: Array.from({ length: axesY.length }, () => "viga"),
      beamV: emptyBool(ny, nx + 1, false),
      beamH: emptyBool(ny + 1, nx, false),
      volN: 0,
      volS: 0,
      volE: 0,
      volW: 0,
    };
  }
  if (mode === "zapata") {
    const axesX = uniformAxes(4, 4);
    const axesY = uniformAxes(2, 1.2);
    const nx = axesX.length - 1;
    const ny = axesY.length - 1;
    return {
      axesX,
      axesY,
      cells: emptyBool(ny, nx, false),
      mergeH: emptyBool(ny, nx, false),
      mergeV: emptyBool(ny, nx, false),
      cols: [],
      axisXKind: Array.from({ length: axesX.length }, () => "viga"),
      axisYKind: Array.from({ length: axesY.length }, () => "viga"),
      beamV: emptyBool(ny, nx + 1, false),
      beamH: emptyBool(ny + 1, nx, false),
      volN: 0,
      volS: 0,
      volE: 0,
      volW: 0,
    };
  }
  const axesX = uniformAxes(3, 5, 0.5);
  const axesY = uniformAxes(3, 5, 0.5);
  const nx = axesX.length - 1;
  const ny = axesY.length - 1;
  return {
    axesX,
    axesY,
    cells: emptyBool(ny, nx, false),
    mergeH: emptyBool(ny, nx, false),
    mergeV: emptyBool(ny, nx, false),
    cols: [],
    axisXKind: Array.from({ length: axesX.length }, () => "viga"),
    axisYKind: Array.from({ length: axesY.length }, () => "viga"),
    beamV: emptyBool(ny, nx + 1, false),
    beamH: emptyBool(ny + 1, nx, false),
    volN: 0,
    volS: 0,
    volE: 0,
    volW: 0,
  };
}

export function exampleModel(mode: MaeMode): MaeModel {
  const m = defaultModel(mode);
  if (mode === "losa") {
    m.axesX = [0, 1, 4.4, 8.3];
    m.axesY = [0, 5, 10];
    const nx = 3;
    const ny = 2;
    m.cells = [
      [true, false, true],
      [true, true, true],
    ];
    m.mergeH = emptyBool(ny, nx, false);
    m.mergeV = emptyBool(ny, nx, false);
    m.axisXKind = Array.from({ length: nx + 1 }, () => "viga" as AxisKind);
    m.axisYKind = Array.from({ length: ny + 1 }, () => "viga" as AxisKind);
    m.volN = 0;
    m.volS = 0;
    m.volE = 0;
    m.volW = 0;
    return ensureGradeBeams(m, { reset: true });
  }
  const nx = m.axesX.length - 1;
  const ny = m.axesY.length - 1;
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) m.cells[iy][ix] = true;
  if (mode === "zapata" && ny > 1) {
    for (let ix = 0; ix < nx - 1; ix++) m.cells[1][ix] = false;
  }
  return ensureGradeBeams(placeColsOnPainted(m, mode), { reset: true });
}

export function plantReady(m: MaeModel, mode: MaeMode): boolean {
  const nCells = m.cells.flat().filter(Boolean).length;
  if (nCells < 1) return false;
  if (mode === "losa") return true;
  return m.cols.some((c) => c.ix >= 0 && c.iy >= 0);
}

/** Sin planta dibujada se usa el ejemplo de expediente; no se emite un informe vacío. */
export function resolveMaeModel(
  raw: Record<string, string>,
  mode: MaeMode,
  fromGrid?: (fb: MaeModel) => MaeModel,
): { model: MaeModel; usedExample: boolean; pending: boolean } {
  if (raw.studioJson?.trim()) {
    const model = parseMae(raw.studioJson, exampleModel(mode));
    if (plantReady(model, mode)) return { model, usedExample: false, pending: false };
    return { model, usedExample: false, pending: true };
  }
  if (fromGrid) {
    const model = fromGrid(exampleModel(mode));
    if (plantReady(model, mode)) return { model, usedExample: false, pending: false };
  }
  return { model: exampleModel(mode), usedExample: true, pending: false };
}

export function dumpMae(m: MaeModel): string {
  return JSON.stringify({
    axesX: m.axesX.map((x) => Math.round(x * 1000) / 1000),
    axesY: m.axesY.map((x) => Math.round(x * 1000) / 1000),
    cells: m.cells,
    mergeH: m.mergeH,
    mergeV: m.mergeV,
    cols: m.cols,
    axisXKind: m.axisXKind,
    axisYKind: m.axisYKind,
    beamV: m.beamV,
    beamH: m.beamH,
    volN: m.volN,
    volS: m.volS,
    volE: m.volE,
    volW: m.volW,
  });
}

function numList(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return fallback;
  const xs = raw.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  return xs.length >= 2 ? xs : fallback;
}

function boolGrid(raw: unknown, ny: number, nx: number, fill: boolean): boolean[][] {
  const out = emptyBool(ny, nx, fill);
  if (!Array.isArray(raw)) return out;
  for (let iy = 0; iy < ny; iy++) {
    const row = Array.isArray((raw as unknown[])[iy]) ? ((raw as unknown[])[iy] as unknown[]) : [];
    for (let ix = 0; ix < nx; ix++) {
      if (row[ix] === undefined) continue;
      out[iy][ix] = row[ix] !== false && row[ix] !== 0;
    }
  }
  return out;
}

export function parseMae(raw: string | undefined, fallback: MaeModel): MaeModel {
  if (!raw?.trim()) return fallback;
  try {
    const j = JSON.parse(raw) as Partial<MaeModel>;
    const axesX = numList(j.axesX, fallback.axesX).slice().sort((a, b) => a - b);
    const axesY = numList(j.axesY, fallback.axesY).slice().sort((a, b) => a - b);
    const nx = Math.max(1, axesX.length - 1);
    const ny = Math.max(1, axesY.length - 1);
    const cells = boolGrid(j.cells, ny, nx, fallback.cells[0]?.[0] ?? false);
    const mergeH = boolGrid(j.mergeH, ny, nx, false);
    const mergeV = boolGrid(j.mergeV, ny, nx, false);
    const colsIn = Array.isArray(j.cols) ? j.cols : [];
    const cols: MaeCol[] = colsIn.map((c, i) => ({
      id: String(c.id || `C${i + 1}`),
      ix: Math.max(0, Math.min(nx, Number(c.ix) || 0)),
      iy: Math.max(0, Math.min(ny, Number(c.iy) || 0)),
      t1: Number(c.t1) > 0.1 ? Number(c.t1) : 0.4,
      t2: Number(c.t2) > 0.1 ? Number(c.t2) : 0.4,
      P1: Number(c.P1) || 0,
      P2: Number(c.P2) || 0,
      P3: Number(c.P3) || 0,
      M1: Number(c.M1) || 0,
      M2: Number(c.M2) || 0,
      M3: Number(c.M3) || 0,
      ex: Number(c.ex) || 0,
      ey: Number(c.ey) || 0,
      centered: c.centered !== false && Math.abs(Number(c.ex) || 0) < 1e-4 && Math.abs(Number(c.ey) || 0) < 1e-4,
      seat: c.seat === "esquinera" || c.seat === "borde" ? c.seat : "nudo",
    }));
    const axisXKind = Array.from({ length: axesX.length }, (_, i) => (j.axisXKind?.[i] as AxisKind) || "viga");
    const axisYKind = Array.from({ length: axesY.length }, (_, i) => (j.axisYKind?.[i] as AxisKind) || "viga");
    const stored = Array.isArray(j.beamV) && Array.isArray(j.beamH);
    return ensureGradeBeams(
      {
        axesX,
        axesY,
        cells,
        mergeH,
        mergeV,
        cols,
        axisXKind,
        axisYKind,
        beamV: stored ? boolGrid(j.beamV, ny, nx + 1, false) : emptyBool(ny, nx + 1, false),
        beamH: stored ? boolGrid(j.beamH, ny + 1, nx, false) : emptyBool(ny + 1, nx, false),
        volN: Number(j.volN) || 0,
        volS: Number(j.volS) || 0,
        volE: Number(j.volE) || 0,
        volW: Number(j.volW) || 0,
      },
      { reset: !stored },
    );
  } catch {
    return fallback;
  }
}

export function nxOf(m: MaeModel) {
  return Math.max(1, m.axesX.length - 1);
}
export function nyOf(m: MaeModel) {
  return Math.max(1, m.axesY.length - 1);
}

export function cellOn(m: MaeModel, ix: number, iy: number) {
  return Boolean(m.cells[iy]?.[ix]);
}

/** Unión horizontal entre (ix, iy) y (ix+1, iy): quita la viga vertical de esa arista. */
export function mergedH(m: MaeModel, ix: number, iy: number) {
  return Boolean(m.mergeH[iy]?.[ix]);
}

/** Unión vertical entre (ix, iy) y (ix, iy+1): quita la viga horizontal de esa arista. */
export function mergedV(m: MaeModel, ix: number, iy: number) {
  return Boolean(m.mergeV[iy]?.[ix]);
}

/**
 * Segmento de eje con viga o muro (no libre y no unido).
 * dir "x" = eje vertical en axesX[axis], tramo de la fila iy.
 * dir "y" = eje horizontal en axesY[axis], tramo de la columna ix.
 */
export function segmentHasBeam(m: MaeModel, dir: "x" | "y", axis: number, cell: number) {
  if (dir === "x") {
    const left = axis > 0 && cellOn(m, axis - 1, cell);
    const right = axis < nxOf(m) && cellOn(m, axis, cell);
    if (!left && !right) return false;
    if (axis > 0 && axis < nxOf(m) && left && right && mergedH(m, axis - 1, cell)) return false;
    return (m.axisXKind[axis] ?? "viga") !== "libre";
  }
  const bot = axis > 0 && cellOn(m, cell, axis - 1);
  const top = axis < nyOf(m) && cellOn(m, cell, axis);
  if (!bot && !top) return false;
  if (axis > 0 && axis < nyOf(m) && bot && top && mergedV(m, cell, axis - 1)) return false;
  return (m.axisYKind[axis] ?? "viga") !== "libre";
}

/** Pinta todos los vanos como techo (`true`) o hueco (`false`). */
export function fillLosaRoof(m: MaeModel, on = true): MaeModel {
  return ensureGradeBeams({ ...m, cells: m.cells.map((row) => row.map(() => on)) }, { reset: true });
}

/** Una grilla de solo huecos no es losa: se adopta techo en todos los vanos. */
export function adoptRoofIfEmpty(m: MaeModel): { model: MaeModel; adopted: boolean } {
  if (m.cells.some((row) => row.some(Boolean))) return { model: m, adopted: false };
  return { model: fillLosaRoof(m, true), adopted: true };
}

export function resizeModel(m: MaeModel, nBayX: number, nBayY: number): MaeModel {
  return createGridAxes(m, nBayX, nBayY, { resetCells: false, paint: false });
}

export function setSpan(axes: number[], iBay: number, span: number) {
  const s = Math.max(MIN_VANO_M, span);
  const next = axes.slice();
  const i = Math.max(0, Math.min(iBay, next.length - 2));
  const d = s - (next[i + 1] - next[i]);
  for (let k = i + 1; k < next.length; k++) next[k] += d;
  return next;
}

/** Arma ejes X/Y. `paint` rellena celdas nuevas; `resetCells` rehace toda la planta. */
export function createGridAxes(
  m: MaeModel,
  nBayX: number,
  nBayY: number,
  opts: { resetCells?: boolean; paint?: boolean } = {},
): MaeModel {
  const resetCells = opts.resetCells ?? true;
  const paint = opts.paint ?? false;
  const nx = Math.max(1, Math.min(12, Math.round(nBayX)));
  const ny = Math.max(1, Math.min(12, Math.round(nBayY)));
  const spanX = (i: number) => {
    if (i < nxOf(m)) return Math.max(MIN_VANO_M, m.axesX[i + 1] - m.axesX[i]);
    return Math.max(MIN_VANO_M, nxOf(m) > 0 ? m.axesX[1] - m.axesX[0] : 4);
  };
  const spanY = (i: number) => {
    if (i < nyOf(m)) return Math.max(MIN_VANO_M, m.axesY[i + 1] - m.axesY[i]);
    return Math.max(MIN_VANO_M, nyOf(m) > 0 ? m.axesY[1] - m.axesY[0] : 5);
  };
  const axesX = [m.axesX[0] ?? 0];
  for (let i = 0; i < nx; i++) axesX.push(axesX[i] + spanX(i));
  const axesY = [m.axesY[0] ?? 0];
  for (let i = 0; i < ny; i++) axesY.push(axesY[i] + spanY(i));
  const cells = emptyBool(ny, nx, paint);
  const mergeH = emptyBool(ny, nx, false);
  const mergeV = emptyBool(ny, nx, false);
  if (!resetCells) {
    const ox = Math.min(nxOf(m), nx);
    const oy = Math.min(nyOf(m), ny);
    for (let iy = 0; iy < oy; iy++) {
      for (let ix = 0; ix < ox; ix++) {
        cells[iy][ix] = m.cells[iy]?.[ix] ?? paint;
        mergeH[iy][ix] = m.mergeH[iy]?.[ix] ?? false;
        mergeV[iy][ix] = m.mergeV[iy]?.[ix] ?? false;
      }
    }
  }
  return ensureGradeBeams(
    {
      ...m,
      axesX,
      axesY,
      cells,
      mergeH,
      mergeV,
      cols: m.cols.filter((c) => c.ix <= nx && c.iy <= ny),
      axisXKind: Array.from({ length: nx + 1 }, (_, i) => m.axisXKind[i] ?? "viga"),
      axisYKind: Array.from({ length: ny + 1 }, (_, i) => m.axisYKind[i] ?? "viga"),
    },
    { reset: resetCells },
  );
}

/** Arma la grilla de losa. `resetCells` pinta todos los paños como techo (flujo Crear ejes). */
export function createLosaAxes(m: MaeModel, nBayX: number, nBayY: number, resetCells = true): MaeModel {
  return createGridAxes(m, nBayX, nBayY, { resetCells, paint: true });
}

export function colXY(m: MaeModel, c: MaeCol): XY {
  const nudo = { x: m.axesX[c.ix], y: m.axesY[c.iy] };
  if (c.seat === "esquinera" || c.seat === "borde") {
    const o = colInwardOffset(m, c);
    return { x: nudo.x + o.ex, y: nudo.y + o.ey };
  }
  return { x: nudo.x + (c.centered ? 0 : c.ex), y: nudo.y + (c.centered ? 0 : c.ey) };
}

/** Desplaza el centro del pedestal hacia el concreto pintado para que quede entero sobre la zapata/platea. */
export function colInwardOffset(m: MaeModel, c: Pick<MaeCol, "ix" | "iy" | "t1" | "t2" | "seat">): { ex: number; ey: number } {
  const paintedR = (c.ix < nxOf(m) && c.iy < nyOf(m) && cellOn(m, c.ix, c.iy)) || (c.ix < nxOf(m) && c.iy > 0 && cellOn(m, c.ix, c.iy - 1));
  const paintedL = (c.ix > 0 && c.iy < nyOf(m) && cellOn(m, c.ix - 1, c.iy)) || (c.ix > 0 && c.iy > 0 && cellOn(m, c.ix - 1, c.iy - 1));
  const paintedT = (c.iy < nyOf(m) && c.ix < nxOf(m) && cellOn(m, c.ix, c.iy)) || (c.iy < nyOf(m) && c.ix > 0 && cellOn(m, c.ix - 1, c.iy));
  const paintedB = (c.iy > 0 && c.ix < nxOf(m) && cellOn(m, c.ix, c.iy - 1)) || (c.iy > 0 && c.ix > 0 && cellOn(m, c.ix - 1, c.iy - 1));
  let sx = 0;
  if (paintedR && !paintedL) sx = 1;
  else if (paintedL && !paintedR) sx = -1;
  let sy = 0;
  if (paintedT && !paintedB) sy = 1;
  else if (paintedB && !paintedT) sy = -1;
  const hx = Math.max(c.t2 / 2, 0.05);
  const hy = Math.max(c.t1 / 2, 0.05);
  if (c.seat === "borde") {
    if (Math.abs(sx) >= Math.abs(sy)) return { ex: sx * hx, ey: 0 };
    return { ex: 0, ey: sy * hy };
  }
  return { ex: sx * hx, ey: sy * hy };
}

export function nodeTouchesPaint(m: MaeModel, ix: number, iy: number) {
  const nx = nxOf(m);
  const ny = nyOf(m);
  return [
    [ix - 1, iy - 1],
    [ix, iy - 1],
    [ix - 1, iy],
    [ix, iy],
  ].some(([i, j]) => i >= 0 && j >= 0 && i < nx && j < ny && cellOn(m, i, j));
}

export function defaultCol(mode: MaeMode, ix: number, iy: number, nAxesX: number, nAxesY: number, id: string): MaeCol {
  const edge = iy === 0 || ix === 0 || iy === nAxesY - 1 || ix === nAxesX - 1;
  return {
    id,
    ix,
    iy,
    t1: 0.4,
    t2: 0.4,
    P1: mode === "platea" ? 3 : 2,
    P2: mode === "platea" ? 2 : 1.5,
    P3: mode === "platea" ? (edge ? 55 : 90) : 50,
    M1: 0,
    M2: mode === "platea" ? 8 : 5,
    M3: mode === "platea" ? 10 : 6,
    ex: 0,
    ey: 0,
    centered: true,
    seat: "nudo",
  };
}

/** Una columna en cada nudo que toca zapata/platea pintada. Conserva P y M ya digitados. */
export function placeColsOnPainted(m: MaeModel, mode: MaeMode): MaeModel {
  const prev = new Map(m.cols.map((c) => [`${c.ix},${c.iy}`, c]));
  const cols: MaeCol[] = [];
  let n = 0;
  for (let iy = 0; iy < m.axesY.length; iy++) {
    for (let ix = 0; ix < m.axesX.length; ix++) {
      if (!nodeTouchesPaint(m, ix, iy)) continue;
      n += 1;
      const hit = prev.get(`${ix},${iy}`);
      cols.push(hit ? { ...hit, id: hit.id || `C${n}` } : defaultCol(mode, ix, iy, m.axesX.length, m.axesY.length, `C${n}`));
    }
  }
  return { ...m, cols };
}

export function puCol(c: Pick<MaeCol, "P1" | "P2" | "P3">) {
  const P3 = Math.max(c.P3, 0);
  return { Pserv: P3, Pu: 1.5 * P3, Hx: c.P1, Hy: c.P2 };
}

export function momentsAt(c: MaeCol, h: number) {
  return { M1: c.M1, M2: c.M2 + c.P2 * h, M3: c.M3 + c.P1 * h };
}

/** Paños rectangulares: celdas activas unidas por mergeH/mergeV. */
export function rectPanes(m: MaeModel): RectPane[] {
  const nx = nxOf(m);
  const ny = nyOf(m);
  const seen = emptyBool(ny, nx, false);
  const out: RectPane[] = [];
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      if (!cellOn(m, ix, iy) || seen[iy][ix]) continue;
      let x1 = ix;
      while (x1 + 1 < nx && cellOn(m, x1 + 1, iy) && m.mergeH[iy][x1]) x1 += 1;
      let y1 = iy;
      growY: while (y1 + 1 < ny) {
        for (let x = ix; x <= x1; x++) {
          if (!cellOn(m, x, y1 + 1) || !m.mergeV[y1][x]) break growY;
          if (x < x1 && !m.mergeH[y1 + 1][x]) break growY;
        }
        y1 += 1;
      }
      for (let y = iy; y <= y1; y++) for (let x = ix; x <= x1; x++) seen[y][x] = true;
      out.push({
        ix0: ix,
        iy0: iy,
        ix1: x1,
        iy1: y1,
        x0: m.axesX[ix],
        y0: m.axesY[iy],
        x1: m.axesX[x1 + 1],
        y1: m.axesY[y1 + 1],
        lx: m.axesX[x1 + 1] - m.axesX[ix],
        ly: m.axesY[y1 + 1] - m.axesY[iy],
        id: `${ix + 1}.${iy + 1}` + (x1 > ix || y1 > iy ? `–${x1 + 1}.${y1 + 1}` : ""),
      });
    }
  }
  return out;
}

export function paintedArea(m: MaeModel) {
  let A = 0;
  const nx = nxOf(m);
  const ny = nyOf(m);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      if (!cellOn(m, ix, iy)) continue;
      A += (m.axesX[ix + 1] - m.axesX[ix]) * (m.axesY[iy + 1] - m.axesY[iy]);
    }
  }
  return A;
}

export function paintedCentroid(m: MaeModel) {
  let A = 0;
  let Sx = 0;
  let Sy = 0;
  const nx = nxOf(m);
  const ny = nyOf(m);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      if (!cellOn(m, ix, iy)) continue;
      const dx = m.axesX[ix + 1] - m.axesX[ix];
      const dy = m.axesY[iy + 1] - m.axesY[iy];
      const dA = dx * dy;
      A += dA;
      Sx += (m.axesX[ix] + dx / 2) * dA;
      Sy += (m.axesY[iy] + dy / 2) * dA;
    }
  }
  return { A, xc: A > 1e-9 ? Sx / A : 0, yc: A > 1e-9 ? Sy / A : 0 };
}

/** Inercias de la unión de rectángulos respecto del centroide. */
export function paintedInertia(m: MaeModel) {
  const { A, xc, yc } = paintedCentroid(m);
  let Ixx = 0;
  let Iyy = 0;
  const nx = nxOf(m);
  const ny = nyOf(m);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      if (!cellOn(m, ix, iy)) continue;
      const dx = m.axesX[ix + 1] - m.axesX[ix];
      const dy = m.axesY[iy + 1] - m.axesY[iy];
      const cx = m.axesX[ix] + dx / 2;
      const cy = m.axesY[iy] + dy / 2;
      Ixx += (dx * dy ** 3) / 12 + dx * dy * (cy - yc) ** 2;
      Iyy += (dy * dx ** 3) / 12 + dx * dy * (cx - xc) ** 2;
    }
  }
  return { A, xc, yc, Ixx, Iyy };
}

export function extent(m: MaeModel) {
  const x0 = m.axesX[0] - Math.max(0, m.volW);
  const x1 = m.axesX[m.axesX.length - 1] + Math.max(0, m.volE);
  const y0 = m.axesY[0] - Math.max(0, m.volS);
  const y1 = m.axesY[m.axesY.length - 1] + Math.max(0, m.volN);
  return { x0, x1, y0, y1, Lx: x1 - x0, Ly: y1 - y0 };
}

export function cycleKind(k: AxisKind): AxisKind {
  if (k === "viga") return "muro";
  if (k === "muro") return "libre";
  return "viga";
}

export function kindLabel(k: AxisKind) {
  if (k === "muro") return "muro / empotrado";
  if (k === "libre") return "libre (hueco)";
  return "viga / continuo";
}

function edgeOf(hasNeighbor: boolean, kind: AxisKind): EdgeKind {
  if (hasNeighbor) return "continuo";
  if (kind === "libre") return "libre";
  if (kind === "muro") return "continuo";
  return "discontinuo";
}

function casoFromEdges(e: IdentifiedPane["edges"]) {
  const n = Number(e.L === "continuo") + Number(e.R === "continuo") + Number(e.B === "continuo") + Number(e.T === "continuo");
  const opp = (e.L === "continuo" && e.R === "continuo") || (e.B === "continuo" && e.T === "continuo");
  const adj =
    (e.L === "continuo" && e.B === "continuo") ||
    (e.L === "continuo" && e.T === "continuo") ||
    (e.R === "continuo" && e.B === "continuo") ||
    (e.R === "continuo" && e.T === "continuo");
  if (n >= 4) return "cccc";
  if (n === 3) return "cccd";
  if (n === 2) return adj && !opp ? "ccdd" : "cccd";
  if (n === 1) return "cddd";
  return "dddd";
}

function neighborRoof(m: MaeModel, p: RectPane, side: "L" | "R" | "B" | "T") {
  const nx = nxOf(m);
  const ny = nyOf(m);
  if (side === "L") {
    if (p.ix0 <= 0) return false;
    for (let iy = p.iy0; iy <= p.iy1; iy++) if (cellOn(m, p.ix0 - 1, iy)) return true;
    return false;
  }
  if (side === "R") {
    if (p.ix1 + 1 >= nx) return false;
    for (let iy = p.iy0; iy <= p.iy1; iy++) if (cellOn(m, p.ix1 + 1, iy)) return true;
    return false;
  }
  if (side === "B") {
    if (p.iy0 <= 0) return false;
    for (let ix = p.ix0; ix <= p.ix1; ix++) if (cellOn(m, ix, p.iy0 - 1)) return true;
    return false;
  }
  if (p.iy1 + 1 >= ny) return false;
  for (let ix = p.ix0; ix <= p.ix1; ix++) if (cellOn(m, ix, p.iy1 + 1)) return true;
  return false;
}

export function voidsOf(m: MaeModel): IdentifiedVoid[] {
  const nx = nxOf(m);
  const ny = nyOf(m);
  const out: IdentifiedVoid[] = [];
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      if (cellOn(m, ix, iy)) continue;
      out.push({
        ix,
        iy,
        x0: m.axesX[ix],
        y0: m.axesY[iy],
        x1: m.axesX[ix + 1],
        y1: m.axesY[iy + 1],
        id: `H${ix + 1}.${iy + 1}`,
      });
    }
  }
  return out;
}

function paneAt(
  panes: { id: string; ix0: number; iy0: number; ix1: number; iy1: number }[],
  ix: number,
  iy: number,
) {
  return panes.find((p) => ix >= p.ix0 && ix <= p.ix1 && iy >= p.iy0 && iy <= p.iy1);
}

function pushPaneId(ids: string[], pan?: { id: string }) {
  if (pan && !ids.includes(pan.id)) ids.push(pan.id);
}

/** Paños techo, huecos, franjas y tramos de acero (positivo continuo vs negativo en apoyos). */
export function identifyLosa(m: MaeModel, tipo: LosaTipo = "maciza"): {
  panes: IdentifiedPane[];
  strips: IdentifiedStrip[];
  voids: IdentifiedVoid[];
  posRuns: LosaBarRun[];
  negCuts: LosaBarRun[];
  nAnalisis: number;
} {
  const panes0 = rectPanes(m).filter((p) => p.lx > 0.05 && p.ly > 0.05);
  const panes: IdentifiedPane[] = panes0.map((p) => {
    const edges = {
      L: edgeOf(neighborRoof(m, p, "L"), m.axisXKind[p.ix0] ?? "viga"),
      R: edgeOf(neighborRoof(m, p, "R"), m.axisXKind[p.ix1 + 1] ?? "viga"),
      B: edgeOf(neighborRoof(m, p, "B"), m.axisYKind[p.iy0] ?? "viga"),
      T: edgeOf(neighborRoof(m, p, "T"), m.axisYKind[p.iy1 + 1] ?? "viga"),
    };
    const ln = Math.min(p.lx, p.ly);
    const twoWay = Math.max(p.lx, p.ly) / Math.max(ln, 0.05) <= 2 + 1e-6;
    return { ...p, edges, caso: casoFromEdges(edges), twoWay, tipo };
  });
  const strips: IdentifiedStrip[] = [];
  const nx = nxOf(m);
  const ny = nyOf(m);
  for (let iy = 0; iy < ny; iy++) {
    let ix = 0;
    while (ix < nx) {
      while (ix < nx && !cellOn(m, ix, iy)) ix += 1;
      if (ix >= nx) break;
      const i0 = ix;
      const paneIds: string[] = [];
      const spans: number[] = [];
      const nodes: number[] = [ix];
      while (ix < nx && cellOn(m, ix, iy)) {
        pushPaneId(paneIds, paneAt(panes, ix, iy));
        let L = m.axesX[ix + 1] - m.axesX[ix];
        while (ix + 1 < nx && cellOn(m, ix + 1, iy) && mergedH(m, ix, iy)) {
          ix += 1;
          L += m.axesX[ix + 1] - m.axesX[ix];
          pushPaneId(paneIds, paneAt(panes, ix, iy));
        }
        spans.push(L);
        nodes.push(ix + 1);
        ix += 1;
      }
      const i1 = ix - 1;
      const nSpan = spans.length;
      const nMerged = i1 - i0 + 1 - nSpan;
      strips.push({
        id: `FX-Y${iy + 1}-${i0 + 1}a${i1 + 1}`,
        dir: "x",
        line: iy,
        i0,
        i1,
        spans,
        nodes,
        paneIds,
        b: m.axesY[iy + 1] - m.axesY[iy],
        why:
          nSpan === 1
            ? `Franja X en vano Y${iy + 1}: 1 tramo (${paneIds.join(", ") || "celda"})${nMerged ? " — paños unidos, sin viga interior" : " — no cruza el hueco"}.`
            : `Franja X en vano Y${iy + 1}: ${nSpan} tramos ${i0 + 1}–${i1 + 1} (${paneIds.join(", ")}). El hueco corta; Unir elimina apoyos interiores.`,
      });
    }
  }
  for (let ix = 0; ix < nx; ix++) {
    let iy = 0;
    while (iy < ny) {
      while (iy < ny && !cellOn(m, ix, iy)) iy += 1;
      if (iy >= ny) break;
      const i0 = iy;
      const paneIds: string[] = [];
      const spans: number[] = [];
      const nodes: number[] = [iy];
      while (iy < ny && cellOn(m, ix, iy)) {
        pushPaneId(paneIds, paneAt(panes, ix, iy));
        let L = m.axesY[iy + 1] - m.axesY[iy];
        while (iy + 1 < ny && cellOn(m, ix, iy + 1) && mergedV(m, ix, iy)) {
          iy += 1;
          L += m.axesY[iy + 1] - m.axesY[iy];
          pushPaneId(paneIds, paneAt(panes, ix, iy));
        }
        spans.push(L);
        nodes.push(iy + 1);
        iy += 1;
      }
      const i1 = iy - 1;
      const nSpan = spans.length;
      const nMerged = i1 - i0 + 1 - nSpan;
      strips.push({
        id: `FY-X${ix + 1}-${i0 + 1}a${i1 + 1}`,
        dir: "y",
        line: ix,
        i0,
        i1,
        spans,
        nodes,
        paneIds,
        b: m.axesX[ix + 1] - m.axesX[ix],
        why:
          nSpan === 1
            ? `Franja Y en vano X${ix + 1}: 1 tramo (${paneIds.join(", ") || "celda"})${nMerged ? " — paños unidos, sin viga interior" : " — no cruza el hueco"}.`
            : `Franja Y en vano X${ix + 1}: ${nSpan} tramos ${i0 + 1}–${i1 + 1} (${paneIds.join(", ")}). El hueco corta; Unir elimina apoyos interiores.`,
      });
    }
  }
  const voids = voidsOf(m);
  const { posRuns, negCuts } = identifySteelRuns(m, panes);
  return { panes, strips, voids, posRuns, negCuts, nAnalisis: panes.length + strips.length };
}

/** Tramos de positivo (continuo en techos sin hueco) y cortes de negativo (solo viga/muro). */
export function identifySteelRuns(
  m: MaeModel,
  panes?: { id: string; ix0: number; iy0: number; ix1: number; iy1: number }[],
): { posRuns: LosaBarRun[]; negCuts: LosaBarRun[] } {
  const found = panes ?? rectPanes(m);
  const nx = nxOf(m);
  const ny = nyOf(m);
  const posRuns: LosaBarRun[] = [];
  const negCuts: LosaBarRun[] = [];
  for (let iy = 0; iy < ny; iy++) {
    let ix = 0;
    while (ix < nx) {
      while (ix < nx && !cellOn(m, ix, iy)) ix += 1;
      if (ix >= nx) break;
      const i0 = ix;
      const paneIds: string[] = [];
      while (ix < nx && cellOn(m, ix, iy)) {
        pushPaneId(paneIds, paneAt(found, ix, iy));
        ix += 1;
      }
      const i1 = ix - 1;
      posRuns.push({
        kind: "pos",
        dir: "x",
        line: iy,
        i0,
        i1,
        x0: m.axesX[i0],
        y0: m.axesY[iy],
        x1: m.axesX[i1 + 1],
        y1: m.axesY[iy + 1],
        paneIds,
        why: `+X continuo en Y${iy + 1}, vanos ${i0 + 1}–${i1 + 1} (${paneIds.join(", ") || "techo"}). Se corta en hueco o borde, no en viga interior.`,
      });
    }
  }
  for (let ix = 0; ix < nx; ix++) {
    let iy = 0;
    while (iy < ny) {
      while (iy < ny && !cellOn(m, ix, iy)) iy += 1;
      if (iy >= ny) break;
      const i0 = iy;
      const paneIds: string[] = [];
      while (iy < ny && cellOn(m, ix, iy)) {
        pushPaneId(paneIds, paneAt(found, ix, iy));
        iy += 1;
      }
      const i1 = iy - 1;
      posRuns.push({
        kind: "pos",
        dir: "y",
        line: ix,
        i0,
        i1,
        x0: m.axesX[ix],
        y0: m.axesY[i0],
        x1: m.axesX[ix + 1],
        y1: m.axesY[i1 + 1],
        paneIds,
        why: `+Y continuo en X${ix + 1}, vanos ${i0 + 1}–${i1 + 1} (${paneIds.join(", ") || "techo"}). Se corta en hueco o borde, no en viga interior.`,
      });
    }
  }
  for (let ax = 0; ax < m.axesX.length; ax++) {
    for (let iy = 0; iy < ny; iy++) {
      if (!segmentHasBeam(m, "x", ax, iy)) continue;
      const paneIds: string[] = [];
      if (ax > 0) pushPaneId(paneIds, paneAt(found, ax - 1, iy));
      if (ax < nx) pushPaneId(paneIds, paneAt(found, ax, iy));
      const kind = m.axisXKind[ax] ?? "viga";
      negCuts.push({
        kind: "neg",
        dir: "x",
        line: iy,
        i0: ax,
        i1: ax,
        x0: m.axesX[ax],
        y0: m.axesY[iy],
        x1: m.axesX[ax],
        y1: m.axesY[iy + 1],
        paneIds,
        why: `−X en apoyo ${kind} x=${m.axesX[ax].toFixed(2)} m, vano Y${iy + 1}. No hay negativo si Unir quitó la viga o el eje es libre.`,
      });
    }
  }
  for (let ay = 0; ay < m.axesY.length; ay++) {
    for (let ix = 0; ix < nx; ix++) {
      if (!segmentHasBeam(m, "y", ay, ix)) continue;
      const paneIds: string[] = [];
      if (ay > 0) pushPaneId(paneIds, paneAt(found, ix, ay - 1));
      if (ay < ny) pushPaneId(paneIds, paneAt(found, ix, ay));
      const kind = m.axisYKind[ay] ?? "viga";
      negCuts.push({
        kind: "neg",
        dir: "y",
        line: ix,
        i0: ay,
        i1: ay,
        x0: m.axesX[ix],
        y0: m.axesY[ay],
        x1: m.axesX[ix + 1],
        y1: m.axesY[ay],
        paneIds,
        why: `−Y en apoyo ${kind} y=${m.axesY[ay].toFixed(2)} m, vano X${ix + 1}. No hay negativo si Unir quitó la viga o el eje es libre.`,
      });
    }
  }
  return { posRuns, negCuts };
}

/** Línea interior entre dos paños techo (para Unir/separar). */
export function hitMergeLine(
  m: MaeModel,
  x: number,
  y: number,
  tol: number,
): { dir: "h" | "v"; ix: number; iy: number } | null {
  const nx = nxOf(m);
  const ny = nyOf(m);
  let best: { dir: "h" | "v"; ix: number; iy: number; d: number } | null = null;
  for (let ix = 1; ix < nx; ix++) {
    const ax = m.axesX[ix];
    for (let iy = 0; iy < ny; iy++) {
      if (!cellOn(m, ix - 1, iy) || !cellOn(m, ix, iy)) continue;
      const d = distToSeg(x, y, ax, m.axesY[iy], ax, m.axesY[iy + 1]);
      if (d <= tol && (!best || d < best.d)) best = { dir: "h", ix: ix - 1, iy, d };
    }
  }
  for (let iy = 1; iy < ny; iy++) {
    const ay = m.axesY[iy];
    for (let ix = 0; ix < nx; ix++) {
      if (!cellOn(m, ix, iy - 1) || !cellOn(m, ix, iy)) continue;
      const d = distToSeg(x, y, m.axesX[ix], ay, m.axesX[ix + 1], ay);
      if (d <= tol && (!best || d < best.d)) best = { dir: "v", ix, iy: iy - 1, d };
    }
  }
  return best ? { dir: best.dir, ix: best.ix, iy: best.iy } : null;
}

/** Hit-test en coordenadas de pantalla/SVG (misma que las líneas doradas dibujadas). */
export function hitMergeLineFromPx(
  m: MaeModel,
  px: number,
  py: number,
  worldToPx: (x: number, y: number) => { x: number; y: number },
  tolPx: number,
): { dir: "h" | "v"; ix: number; iy: number } | null {
  const nx = nxOf(m);
  const ny = nyOf(m);
  let best: { dir: "h" | "v"; ix: number; iy: number; d: number } | null = null;
  for (let ix = 1; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      if (!cellOn(m, ix - 1, iy) || !cellOn(m, ix, iy)) continue;
      const a = worldToPx(m.axesX[ix], m.axesY[iy]);
      const b = worldToPx(m.axesX[ix], m.axesY[iy + 1]);
      const d = distToSeg(px, py, a.x, a.y, b.x, b.y);
      if (d <= tolPx && (!best || d < best.d)) best = { dir: "h", ix: ix - 1, iy, d };
    }
  }
  for (let iy = 1; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      if (!cellOn(m, ix, iy - 1) || !cellOn(m, ix, iy)) continue;
      const a = worldToPx(m.axesX[ix], m.axesY[iy]);
      const b = worldToPx(m.axesX[ix + 1], m.axesY[iy]);
      const d = distToSeg(px, py, a.x, a.y, b.x, b.y);
      if (d <= tolPx && (!best || d < best.d)) best = { dir: "v", ix, iy: iy - 1, d };
    }
  }
  return best ? { dir: best.dir, ix: best.ix, iy: best.iy } : null;
}

export function toggleMerge(m: MaeModel, hit: { dir: "h" | "v"; ix: number; iy: number }): MaeModel {
  const nx = nxOf(m);
  const ny = nyOf(m);
  const mergeH = emptyBool(ny, nx, false);
  const mergeV = emptyBool(ny, nx, false);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      mergeH[iy][ix] = Boolean(m.mergeH[iy]?.[ix]);
      mergeV[iy][ix] = Boolean(m.mergeV[iy]?.[ix]);
    }
  }
  if (hit.dir === "h") {
    if (hit.iy >= 0 && hit.iy < ny && hit.ix >= 0 && hit.ix < nx - 1) {
      mergeH[hit.iy][hit.ix] = !mergeH[hit.iy][hit.ix];
    }
  } else if (hit.iy >= 0 && hit.iy < ny - 1 && hit.ix >= 0 && hit.ix < nx) {
    mergeV[hit.iy][hit.ix] = !mergeV[hit.iy][hit.ix];
  }
  return { ...m, mergeH, mergeV };
}

export function edgeLabel(k: EdgeKind) {
  if (k === "continuo") return "cont.";
  if (k === "libre") return "libre";
  return "disc.";
}
