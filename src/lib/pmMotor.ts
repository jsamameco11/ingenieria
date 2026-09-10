import { type ColproPt } from "./colpro-data";
import { parseEtabsForceTable, rowsWithForces } from "./etabsTable";
import { barByName, beta1, fmt } from "./types";

export type PMRow = {
  c: number;
  a: number;
  phi: number;
  Pn: number;
  Mn: number;
  et: number;
  control: "compresión" | "transición" | "tracción";
};

export type PMKey = { P: number; M: number; label: string };

export type PMDiagram = {
  pts: ColproPt[];
  rows: PMRow[];
  keys: PMKey[];
  Po: number;
  Pnmax: number;
  phiC: number;
  alfa: number;
};

export type PMCode = "E060" | "ACI";

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

function codeParams(code: PMCode, spiral: boolean) {
  if (code === "ACI") {
    const phiC = spiral ? 0.75 : 0.65;
    const alfa = spiral ? 0.85 : 0.8;
    return { phiC, alfa };
  }
  const phiC = spiral ? 0.75 : 0.7;
  const alfa = spiral ? 0.85 : 0.8;
  return { phiC, alfa };
}

type Layer = { y: number; As: number };

function rectLayers(b: number, h: number, nBar: number, As: number, cc: number): Layer[] {
  const n = Math.max(4, Math.round(nBar));
  const x0 = -b / 2 + cc;
  const x1 = b / 2 - cc;
  const y0 = -h / 2 + cc;
  const y1 = h / 2 - cc;
  const w = Math.max(x1 - x0, 1e-3);
  const ht = Math.max(y1 - y0, 1e-3);
  const per = 2 * (w + ht);
  const map = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    let s = (i / n) * per;
    let y: number;
    if (s <= w) y = y1;
    else if (s <= w + ht) y = y1 - (s - w);
    else if (s <= 2 * w + ht) y = y0;
    else y = y0 + (s - 2 * w - ht);
    const key = y.toFixed(3);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const tot = [...map.values()].reduce((a, v) => a + v, 0);
  return [...map.entries()].map(([k, v]) => ({ y: Number(k), As: (v / tot) * As }));
}

function circLayers(D: number, nBar: number, As: number, cc: number): Layer[] {
  const n = Math.max(6, Math.round(nBar));
  const R = Math.max(D / 2 - cc, 0.4);
  const map = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const y = R * Math.sin(ang);
    const key = y.toFixed(3);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const tot = [...map.values()].reduce((a, v) => a + v, 0);
  return [...map.entries()].map(([k, v]) => ({ y: Number(k), As: (v / tot) * As }));
}

function circCompression(R: number, a: number): { A: number; y: number } {
  const h = Math.max(0, Math.min(a, 2 * R));
  if (h <= 1e-9) return { A: 0, y: R };
  if (h >= 2 * R - 1e-9) return { A: Math.PI * R * R, y: 0 };
  const d = R - h;
  const theta = 2 * Math.acos(Math.max(-1, Math.min(1, d / R)));
  const A = 0.5 * R * R * (theta - Math.sin(theta));
  const y = (4 * R * Math.pow(Math.sin(theta / 2), 3)) / (3 * (theta - Math.sin(theta)));
  return { A, y: d >= 0 ? y : -y };
}

function sweepC(h: number, dTens: number, extra: number[]) {
  const cs: number[] = [...extra];
  for (let i = 0; i <= 48; i++) cs.push(0.03 * h + (i / 48) * 2.8 * h);
  cs.push(dTens * 0.15, dTens * 0.4, dTens, 1.4 * dTens, 2.2 * dTens);
  return [...new Set(cs.map((c) => Math.round(c * 1e4) / 1e4))].filter((c) => c > 0.02).sort((a, b) => a - b);
}

function packDiagram(
  raw: { Pn: number; Mn: number; et: number; c: number; a: number }[],
  Po: number,
  As: number,
  fy: number,
  phiC: number,
  alfa: number,
): PMDiagram {
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
    rows.push({
      c: r.c,
      a: r.a,
      phi,
      Pn: P,
      Mn: M,
      et: r.et,
      control: controlOf(r.et),
    });
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

export function generateRectPM(opts: {
  b: number;
  h: number;
  As: number;
  nBar: number;
  rec: number;
  fc: number;
  fy: number;
  db?: number;
  destDb?: number;
  code?: PMCode;
  spiral?: boolean;
}): PMDiagram {
  const { b, h, As, nBar, rec, fc, fy } = opts;
  const db = opts.db ?? 1.91;
  const dest = opts.destDb ?? 0.95;
  const { phiC, alfa } = codeParams(opts.code ?? "E060", Boolean(opts.spiral));
  const cc = rec + dest + db / 2;
  const layers = rectLayers(b, h, nBar, As, cc);
  const Ag = b * h;
  const Es = 2_000_000;
  const ecu = 0.003;
  const b1 = beta1(fc);
  const Po = 0.85 * fc * (Ag - As) + fy * As;
  const yMin = Math.min(...layers.map((L) => L.y));
  const dTens = h / 2 - yMin;
  const extra = [(ecu * dTens) / (ecu + fy / Es)];
  const raw: { Pn: number; Mn: number; et: number; c: number; a: number }[] = [];
  for (const c of sweepC(h, dTens, extra)) {
    const a = Math.min(b1 * c, h);
    const Cc = 0.85 * fc * b * a;
    let Pn = Cc;
    let Mn = Cc * (h / 2 - a / 2);
    let et = 0;
    for (const bar of layers) {
      const dComp = h / 2 - bar.y;
      const eps = (ecu * (c - dComp)) / Math.max(c, 1e-9);
      let fs = Math.max(-fy, Math.min(fy, Es * eps));
      if (dComp <= a + 1e-9) fs -= 0.85 * fc;
      Pn += bar.As * fs;
      Mn += bar.As * fs * bar.y;
      if (Math.abs(bar.y - yMin) < 0.08) et = Math.max(et, -eps);
    }
    raw.push({ Pn, Mn: Math.abs(Mn), et, c, a });
  }
  return packDiagram(raw, Po, As, fy, phiC, alfa);
}

export function generateCircPM(opts: {
  D: number;
  As: number;
  nBar: number;
  rec: number;
  fc: number;
  fy: number;
  db?: number;
  destDb?: number;
  code?: PMCode;
  spiral?: boolean;
}): PMDiagram {
  const D = opts.D;
  const { As, nBar, rec, fc, fy } = opts;
  const db = opts.db ?? 1.91;
  const dest = opts.destDb ?? 0.95;
  const { phiC, alfa } = codeParams(opts.code ?? "E060", opts.spiral !== false);
  const cc = rec + dest + db / 2;
  const layers = circLayers(D, nBar, As, cc);
  const R = D / 2;
  const Ag = Math.PI * R * R;
  const Es = 2_000_000;
  const ecu = 0.003;
  const b1 = beta1(fc);
  const Po = 0.85 * fc * (Ag - As) + fy * As;
  const yMin = Math.min(...layers.map((L) => L.y));
  const dTens = R - yMin;
  const extra = [(ecu * dTens) / (ecu + fy / Es)];
  const raw: { Pn: number; Mn: number; et: number; c: number; a: number }[] = [];
  for (const c of sweepC(D, dTens, extra)) {
    const a = Math.min(b1 * c, D);
    const blk = circCompression(R, a);
    const Cc = 0.85 * fc * blk.A;
    let Pn = Cc;
    let Mn = Cc * blk.y;
    let et = 0;
    for (const bar of layers) {
      const dComp = R - bar.y;
      const eps = (ecu * (c - dComp)) / Math.max(c, 1e-9);
      let fs = Math.max(-fy, Math.min(fy, Es * eps));
      if (dComp <= a + 1e-9) fs -= 0.85 * fc;
      Pn += bar.As * fs;
      Mn += bar.As * fs * bar.y;
      if (Math.abs(bar.y - yMin) < 0.08) et = Math.max(et, -eps);
    }
    raw.push({ Pn, Mn: Math.abs(Mn), et, c, a });
  }
  return packDiagram(raw, Po, As, fy, phiC, alfa);
}

export function generateColumnPM(opts: {
  shape: string;
  b: number;
  h: number;
  As: number;
  nBar: number;
  rec: number;
  fc: number;
  fy: number;
  db?: number;
  destDb?: number;
  code?: PMCode;
  spiral?: boolean;
}): { m3: PMDiagram; m2: PMDiagram } {
  const circ = opts.shape === "circ";
  if (circ) {
    const d = generateCircPM({
      D: opts.b,
      As: opts.As,
      nBar: opts.nBar,
      rec: opts.rec,
      fc: opts.fc,
      fy: opts.fy,
      db: opts.db,
      destDb: opts.destDb,
      code: opts.code,
      spiral: opts.spiral ?? false,
    });
    return { m3: d, m2: d };
  }
  const m3 = generateRectPM(opts);
  const m2 = generateRectPM({ ...opts, b: opts.h, h: opts.b });
  return { m3, m2 };
}

/** D/C radial: escala el rayo (Pu, Mu) hasta la envolvente. */
export function dcRadial(curve: ColproPt[], Pu: number, Mu: number): { dc: number; Mn: number; ok: boolean } {
  if (curve.length < 2) return { dc: 99, Mn: 0, ok: false };
  const pMax = curve[0][0];
  const pMin = curve[curve.length - 1][0];
  if (Pu > pMax + 0.2) return { dc: Pu / Math.max(pMax, 1e-6), Mn: 0, ok: false };
  if (Pu < pMin - 0.2) return { dc: Math.abs(Pu / Math.min(pMin, -1e-6)), Mn: 0, ok: false };
  const absM = Math.abs(Mu);
  if (absM < 1e-6) {
    const dc = Pu >= 0 ? Pu / Math.max(pMax, 1e-6) : Math.abs(Pu / Math.min(pMin, -1e-6));
    return { dc, Mn: 0, ok: dc <= 1 + 1e-6 };
  }
  const e = absM / Math.max(Math.abs(Pu), 1e-9);
  let hit: { P: number; M: number } | null = null;
  for (let i = 0; i < curve.length - 1; i++) {
    const [p1, m1] = curve[i];
    const [p2, m2] = curve[i + 1];
    const f = (p: number, m: number) => m - e * Math.abs(p);
    const a = f(p1, m1);
    const b = f(p2, m2);
    if (a === 0) {
      hit = { P: p1, M: m1 };
      break;
    }
    if (a * b <= 0) {
      const t = a / (a - b || 1e-9);
      hit = { P: p1 + t * (p2 - p1), M: m1 + t * (m2 - m1) };
      break;
    }
  }
  if (!hit) {
    const Mn = mnAtSafe(curve, Pu);
    const dc = Mn <= 1e-9 ? 99 : absM / Mn;
    return { dc, Mn, ok: dc <= 1.001 };
  }
  const t = Pu === 0 ? absM / Math.max(hit.M, 1e-9) : Pu / (hit.P || 1e-9);
  const dc = Math.abs(t);
  return { dc, Mn: hit.M, ok: dc <= 1.001 };
}

function mnAtSafe(curve: ColproPt[], Pu: number): number {
  const pMax = curve[0][0];
  const pMin = curve[curve.length - 1][0];
  const P = Math.min(pMax, Math.max(pMin, Pu));
  for (let i = 0; i < curve.length - 1; i++) {
    const [p1, m1] = curve[i];
    const [p2, m2] = curve[i + 1];
    const lo = Math.min(p1, p2);
    const hi = Math.max(p1, p2);
    if (P >= lo - 1e-9 && P <= hi + 1e-9) {
      const t = Math.abs(p2 - p1) < 1e-9 ? 0 : (P - p1) / (p2 - p1);
      return Math.abs(m1 + t * (m2 - m1));
    }
  }
  return Math.abs(curve[curve.length - 1][1]);
}

/** Capacidad axial uniaxial a una excentricidad e = M/P (cm de consistencia t y t·m → e en m). */
function PnAtE(curve: ColproPt[], e_m: number): number {
  const e = Math.abs(e_m);
  if (e < 1e-6) return curve[0][0];
  for (let i = 0; i < curve.length - 1; i++) {
    const [p1, m1] = curve[i];
    const [p2, m2] = curve[i + 1];
    const e1 = Math.abs(p1) < 1e-6 ? 1e9 : m1 / Math.abs(p1);
    const e2 = Math.abs(p2) < 1e-6 ? 1e9 : m2 / Math.abs(p2);
    if ((e - e1) * (e - e2) <= 1e-12 || (e >= Math.min(e1, e2) && e <= Math.max(e1, e2))) {
      const t = Math.abs(e2 - e1) < 1e-9 ? 0 : (e - e1) / (e2 - e1);
      return p1 + t * (p2 - p1);
    }
  }
  return curve[curve.length - 1][0];
}

/**
 * D/C PMM estilo ETABS: Bresler recíproco si hay axial, elipse de momentos si Pu≈0.
 * P a compresión positivo (convenio de la memoria).
 */
export function dcPMM(
  curveM2: ColproPt[],
  curveM3: ColproPt[],
  Po_phi: number,
  Pu: number,
  M2: number,
  M3: number,
): { dc: number; method: string; ok: boolean } {
  const a2 = Math.abs(M2);
  const a3 = Math.abs(M3);
  if (Math.abs(Pu) < 0.25) {
    const Mn2 = mnAtSafe(curveM2, 0);
    const Mn3 = mnAtSafe(curveM3, 0);
    const dc = Math.hypot(Mn2 > 1e-6 ? a2 / Mn2 : 0, Mn3 > 1e-6 ? a3 / Mn3 : 0);
    return { dc, method: "elipse M2–M3 (Pu≈0)", ok: dc <= 1.001 };
  }
  if (a2 < 1e-4 && a3 < 1e-4) {
    const cap = Pu >= 0 ? curveM3[0][0] : curveM3[curveM3.length - 1][0];
    const dc = Math.abs(Pu / (cap || 1e-6));
    return { dc, method: "axial puro", ok: dc <= 1.001 };
  }
  if (a2 < 1e-4) {
    const r = dcRadial(curveM3, Pu, a3);
    return { dc: r.dc, method: "uniaxial M3", ok: r.ok };
  }
  if (a3 < 1e-4) {
    const r = dcRadial(curveM2, Pu, a2);
    return { dc: r.dc, method: "uniaxial M2", ok: r.ok };
  }
  const e2 = a2 / Math.abs(Pu);
  const e3 = a3 / Math.abs(Pu);
  const Pnx = Math.max(PnAtE(curveM3, e3), 1e-6);
  const Pny = Math.max(PnAtE(curveM2, e2), 1e-6);
  const Po = Math.max(Po_phi, 1e-6);
  const inv = 1 / Pnx + 1 / Pny - 1 / Po;
  const Pn = inv > 1e-9 ? 1 / inv : Math.min(Pnx, Pny);
  const dc = Math.abs(Pu) / Math.max(Pn, 1e-6);
  return { dc, method: "Bresler 1/Pn = 1/Pnx + 1/Pny − 1/Po", ok: dc <= 1.001 };
}

export function parseEtabsPaste(
  raw: string,
  sign: "etabs" | "memoria",
): { name: string; p: number; m2: number; m3: number }[] {
  return rowsWithForces(parseEtabsForceTable(raw)).map((r, i) => ({
    name: [r.label, r.load, r.station].filter(Boolean).join(" · ") || `ETABS ${i + 1}`,
    p: sign === "etabs" ? -r.p : r.p,
    m2: r.m2,
    m3: r.m3,
  }));
}

export function steelDb(name: string): number {
  return barByName(name).db;
}

export function fmtPMTable(rows: PMRow[]): string[][] {
  const out: string[][] = [["c (cm)", "a (cm)", "φ", "φPn (t)", "φMn (t·m)", "εt", "Control"]];
  const step = Math.max(1, Math.floor(rows.length / 16));
  rows.forEach((r, i) => {
    if (i % step !== 0 && i !== rows.length - 1 && r.control === rows[Math.max(0, i - 1)]?.control) return;
    out.push([fmt(r.c, 2), fmt(r.a, 2), fmt(r.phi, 2), fmt(r.Pn, 2), fmt(r.Mn, 2), fmt(r.et, 4), r.control]);
  });
  return out;
}
