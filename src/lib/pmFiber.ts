import { type ColproPt } from "./colpro-data";
import { barByName, beta1 } from "./types";
import { type PMCode, type PMDiagram, type PMKey, type PMRow, dcPMM, dcRadial } from "./pmMotor";

export type Pt = { x: number; y: number };
export type BarPt = { x: number; y: number; As: number };
export type SectionModel = {
  name: string;
  outer: Pt[];
  holes: Pt[][];
  bars: BarPt[];
  Ag: number;
  As: number;
  cx: number;
  cy: number;
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
};

export type FiberResult = {
  m3: PMDiagram;
  m2: PMDiagram;
  m3n: PMDiagram;
  m2n: PMDiagram;
  Ag: number;
  As: number;
  rho: number;
  Po: number;
  Pnmax: number;
  phiC: number;
  alfa: number;
  Ix: number;
  Iy: number;
};

const ES = 2_000_000;
const ECU = 0.003;

function areaPoly(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function centroidPoly(poly: Pt[]): { A: number; cx: number; cy: number } {
  let A = 0;
  let cx = 0;
  let cy = 0;
  if (poly.length < 3) return { A: 0, cx: 0, cy: 0 };
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const cross = p.x * q.y - q.x * p.y;
    A += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  A /= 2;
  if (Math.abs(A) < 1e-12) return { A: 0, cx: 0, cy: 0 };
  return { A, cx: cx / (6 * A), cy: cy / (6 * A) };
}

function inertiaPoly(poly: Pt[], cx: number, cy: number): { Ix: number; Iy: number } {
  let Ix = 0;
  let Iy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = { x: poly[i].x - cx, y: poly[i].y - cy };
    const q = { x: poly[(i + 1) % poly.length].x - cx, y: poly[(i + 1) % poly.length].y - cy };
    const cross = p.x * q.y - q.x * p.y;
    Ix += (p.y * p.y + p.y * q.y + q.y * q.y) * cross;
    Iy += (p.x * p.x + p.x * q.x + q.x * q.x) * cross;
  }
  return { Ix: Math.abs(Ix) / 12, Iy: Math.abs(Iy) / 12 };
}

function closeCCW(poly: Pt[]): Pt[] {
  if (poly.length < 3) return poly;
  const A = areaPoly(poly);
  const out = A < 0 ? [...poly].reverse() : [...poly];
  return out;
}

function intersect(a: Pt, b: Pt, ux: number, uy: number, lim: number): Pt {
  const fa = ux * a.x + uy * a.y - lim;
  const fb = ux * b.x + uy * b.y - lim;
  const t = fa / (fa - fb || 1e-12);
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

/** Conserva el lado ξ = ux x + uy y ≥ lim (bloque de Whitney). */
function clipHalf(poly: Pt[], ux: number, uy: number, lim: number): Pt[] {
  if (poly.length < 3) return [];
  const out: Pt[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const ia = ux * a.x + uy * a.y >= lim - 1e-10;
    const ib = ux * b.x + uy * b.y >= lim - 1e-10;
    if (ia && ib) out.push(b);
    else if (ia && !ib) out.push(intersect(a, b, ux, uy, lim));
    else if (!ia && ib) {
      out.push(intersect(a, b, ux, uy, lim));
      out.push(b);
    }
  }
  return out.length >= 3 ? out : [];
}

function codeParams(code: PMCode, spiral: boolean) {
  if (code === "ACI") return { phiC: spiral ? 0.75 : 0.65, alfa: spiral ? 0.85 : 0.8 };
  return { phiC: spiral ? 0.75 : 0.7, alfa: spiral ? 0.85 : 0.8 };
}

function phiTied(et: number, phiC: number) {
  if (et >= 0.005) return 0.9;
  if (et <= 0.002) return phiC;
  return phiC + ((0.9 - phiC) * (et - 0.002)) / 0.003;
}

function controlOf(et: number): PMRow["control"] {
  if (et >= 0.005) return "tracción";
  if (et <= 0.002) return "compresión";
  return "transición";
}

function uniqPts(pts: ColproPt[]): ColproPt[] {
  const seen = new Set<string>();
  const out: ColproPt[] = [];
  for (const p of pts) {
    const k = `${p[0].toFixed(3)}|${p[1].toFixed(3)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push([Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]);
  }
  out.sort((a, b) => b[0] - a[0]);
  return out;
}

function pack(raw: { Pn: number; Mn: number; et: number; c: number; a: number }[], Po: number, As: number, fy: number, phiC: number, alfa: number): PMDiagram {
  const Pnmax = (alfa * phiC * Po) / 1000;
  const rows: PMRow[] = [];
  const pts: ColproPt[] = [[Pnmax, 0]];
  for (const r of raw) {
    const phi = phiTied(r.et, phiC);
    let P = (phi * r.Pn) / 1000;
    let M = (phi * r.Mn) / 100000;
    if (P > Pnmax) {
      const t = Pnmax / Math.max(P, 1e-9);
      P = Pnmax;
      M *= t;
    }
    rows.push({ c: r.c, a: r.a, phi, Pn: P, Mn: M, et: r.et, control: controlOf(r.et) });
    pts.push([P, Math.max(0, M)]);
  }
  const PnT = (0.9 * As * fy) / 1000;
  pts.push([-PnT, 0]);
  const curve = uniqPts(pts);
  const bal = rows.filter((x) => x.control === "transición").sort((a, b) => Math.abs(a.et - 0.002) - Math.abs(b.et - 0.002))[0];
  const flex = [...curve].sort((a, b) => Math.abs(a[0]) - Math.abs(b[0]) || b[1] - a[1])[0];
  const peakM = [...curve].sort((a, b) => b[1] - a[1])[0];
  const keys: PMKey[] = [
    { P: Pnmax, M: 0, label: "φPn,máx (compresión pura)" },
    ...(bal ? [{ P: bal.Pn, M: bal.Mn, label: "Zona balanceada (εt ≈ 0.002)" }] : []),
    ...(peakM ? [{ P: peakM[0], M: peakM[1], label: "φMn máximo" }] : []),
    ...(flex ? [{ P: flex[0], M: flex[1], label: "Flexión (Pu ≈ 0)" }] : []),
    { P: -PnT, M: 0, label: "Tracción pura" },
  ];
  return { pts: curve, rows, keys, Po: Po / 1000, Pnmax, phiC, alfa };
}

function compressedBlock(sec: SectionModel, ux: number, uy: number, a: number, xiMax: number, fc: number) {
  const lim = xiMax - a;
  const outer = clipHalf(sec.outer, ux, uy, lim);
  const g0 = centroidPoly(outer);
  let A = Math.abs(g0.A);
  let Mx = Math.abs(g0.A) * g0.cx;
  let My = Math.abs(g0.A) * g0.cy;
  for (const hole of sec.holes) {
    const h = clipHalf(hole, ux, uy, lim);
    const gh = centroidPoly(h);
    const Ah = Math.abs(gh.A);
    A -= Ah;
    Mx -= Ah * gh.cx;
    My -= Ah * gh.cy;
  }
  if (A < 1e-9) return { A: 0, cx: 0, cy: 0, Cc: 0 };
  return { A, cx: Mx / A, cy: My / A, Cc: 0.85 * fc * A };
}

function analyzeNA(sec: SectionModel, ux: number, uy: number, c: number, fc: number, fy: number, b1: number) {
  let xiMax = -1e12;
  let xiMin = 1e12;
  for (const p of sec.outer) {
    const xi = ux * p.x + uy * p.y;
    if (xi > xiMax) xiMax = xi;
    if (xi < xiMin) xiMin = xi;
  }
  const H = Math.max(xiMax - xiMin, 0.5);
  const a = Math.min(b1 * c, H);
  const blk = compressedBlock(sec, ux, uy, a, xiMax, fc);
  let Pn = blk.Cc;
  let M2 = blk.Cc * (blk.cy - sec.cy);
  let M3 = blk.Cc * (blk.cx - sec.cx);
  let xiSteelMin = Infinity;
  for (const bar of sec.bars) {
    const xi = ux * bar.x + uy * bar.y;
    if (xi < xiSteelMin) xiSteelMin = xi;
  }
  let et = 0;
  for (const bar of sec.bars) {
    const xi = ux * bar.x + uy * bar.y;
    const dComp = xiMax - xi;
    const eps = (ECU * (c - dComp)) / Math.max(c, 1e-9);
    let fs = Math.max(-fy, Math.min(fy, ES * eps));
    if (xi >= xiMax - a - 1e-9) fs -= 0.85 * fc;
    const F = bar.As * fs;
    Pn += F;
    M2 += F * (bar.y - sec.cy);
    M3 += F * (bar.x - sec.cx);
    if (Number.isFinite(xiSteelMin) && Math.abs(xi - xiSteelMin) < 0.2) et = Math.max(et, -eps);
  }
  /** Momento uniaxial en el plano del barrido (no la resultante), convenio ETABS M2/M3. */
  const Mn = Math.abs(M2 * uy + M3 * ux);
  return { Pn, Mn, M2, M3, et, c, a };
}

function sweepC(H: number) {
  const cs: number[] = [];
  for (let i = 0; i <= 56; i++) cs.push(0.04 * H + (i / 56) * 3.2 * H);
  cs.push(0.08 * H, 0.15 * H, 0.25 * H, 0.4 * H, 0.6 * H, H, 1.3 * H, 2 * H);
  return [...new Set(cs.map((c) => Math.round(c * 1e4) / 1e4))].filter((c) => c > 0.04).sort((a, b) => a - b);
}

function diagramAxis(sec: SectionModel, ux: number, uy: number, fc: number, fy: number, phiC: number, alfa: number, Po: number): PMDiagram {
  const b1 = beta1(fc);
  let xiMax = -1e12;
  let xiMin = 1e12;
  for (const p of sec.outer) {
    const xi = ux * p.x + uy * p.y;
    if (xi > xiMax) xiMax = xi;
    if (xi < xiMin) xiMin = xi;
  }
  const H = Math.max(xiMax - xiMin, 1);
  const dTens = H;
  const cBal = (ECU * dTens) / (ECU + fy / ES);
  const raw = [];
  for (const c of [...sweepC(H), cBal]) {
    raw.push(analyzeNA(sec, ux, uy, c, fc, fy, b1));
  }
  return pack(raw, Po, sec.As, fy, phiC, alfa);
}

export function finalizeSection(name: string, outerIn: Pt[], holesIn: Pt[][], barsIn: BarPt[]): SectionModel {
  const outer = closeCCW(outerIn);
  const holes = holesIn.map((h) => {
    const p = closeCCW(h);
    return areaPoly(p) > 0 ? [...p].reverse() : p;
  });
  const g0 = centroidPoly(outer);
  let Ag = Math.abs(g0.A);
  let Mx = Math.abs(g0.A) * g0.cx;
  let My = Math.abs(g0.A) * g0.cy;
  for (const h of holes) {
    const gh = centroidPoly(h);
    const Ah = Math.abs(gh.A);
    Ag -= Ah;
    Mx -= Ah * gh.cx;
    My -= Ah * gh.cy;
  }
  const cx = Ag > 1e-9 ? Mx / Ag : 0;
  const cy = Ag > 1e-9 ? My / Ag : 0;
  const bars = barsIn.filter((b) => b.As > 1e-9);
  const As = bars.reduce((s, b) => s + b.As, 0);
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const p of outer) {
    xmin = Math.min(xmin, p.x);
    xmax = Math.max(xmax, p.x);
    ymin = Math.min(ymin, p.y);
    ymax = Math.max(ymax, p.y);
  }
  return { name, outer, holes, bars, Ag: Math.max(Ag, 0), As, cx, cy, xmin, xmax, ymin, ymax };
}

export type SymmetryReport = {
  cx: number;
  cy: number;
  midX: number;
  midY: number;
  ex: number;
  ey: number;
  m3p: number;
  m3n: number;
  m2p: number;
  m2n: number;
  m3eq: boolean;
  m2eq: boolean;
};

function peakMn(d: { pts: { 0: number; 1: number }[] } | { pts: [number, number][] }) {
  return Math.max(...d.pts.map((p) => p[1]), 0);
}

/** Simetría de la envolvente ± respecto de G (centroide), no del recuadro. */
export function symmetryReport(sec: SectionModel, fib: FiberResult, tol = 0.03): SymmetryReport {
  const midX = (sec.xmin + sec.xmax) / 2;
  const midY = (sec.ymin + sec.ymax) / 2;
  const m3p = peakMn(fib.m3);
  const m3n = peakMn(fib.m3n);
  const m2p = peakMn(fib.m2);
  const m2n = peakMn(fib.m2n);
  return {
    cx: sec.cx,
    cy: sec.cy,
    midX,
    midY,
    ex: sec.cx - midX,
    ey: sec.cy - midY,
    m3p,
    m3n,
    m2p,
    m2n,
    m3eq: Math.abs(m3p - m3n) <= tol * Math.max(m3p, m3n, 0.05),
    m2eq: Math.abs(m2p - m2n) <= tol * Math.max(m2p, m2n, 0.05),
  };
}

export function generateFiberPM(sec: SectionModel, opts: { fc: number; fy: number; code?: PMCode; spiral?: boolean }): FiberResult {
  const fc = opts.fc;
  const fy = opts.fy;
  const { phiC, alfa } = codeParams(opts.code ?? "E060", Boolean(opts.spiral));
  const Po = 0.85 * fc * Math.max(sec.Ag - sec.As, 0) + fy * sec.As;
  const m3 = diagramAxis(sec, 0, 1, fc, fy, phiC, alfa, Po);
  const m3n = diagramAxis(sec, 0, -1, fc, fy, phiC, alfa, Po);
  const m2 = diagramAxis(sec, 1, 0, fc, fy, phiC, alfa, Po);
  const m2n = diagramAxis(sec, -1, 0, fc, fy, phiC, alfa, Po);
  const Ig = inertiaPoly(sec.outer, sec.cx, sec.cy);
  let Ix = Ig.Ix;
  let Iy = Ig.Iy;
  for (const h of sec.holes) {
    const ih = inertiaPoly(h, sec.cx, sec.cy);
    Ix -= ih.Ix;
    Iy -= ih.Iy;
  }
  return {
    m3,
    m2,
    m3n,
    m2n,
    Ag: sec.Ag,
    As: sec.As,
    rho: sec.As / Math.max(sec.Ag, 1e-9),
    Po: Po / 1000,
    Pnmax: m3.Pnmax,
    phiC,
    alfa,
    Ix: Math.max(Ix, 0),
    Iy: Math.max(Iy, 0),
  };
}

export function checkPoint(
  fib: FiberResult,
  Pu: number,
  M2: number,
  M3: number,
): { dc: number; method: string; ok: boolean; dc2: number; dc3: number } {
  const curve2 = M2 >= 0 ? fib.m2.pts : fib.m2n.pts;
  const curve3 = M3 >= 0 ? fib.m3.pts : fib.m3n.pts;
  const r2 = dcRadial(curve2, Pu, M2);
  const r3 = dcRadial(curve3, Pu, M3);
  const pmm = dcPMM(curve2, curve3, fib.Pnmax, Pu, M2, M3);
  return { dc: pmm.dc, method: pmm.method, ok: pmm.ok, dc2: r2.dc, dc3: r3.dc };
}

export function steelDb(name: string): number {
  return barByName(name).db;
}
