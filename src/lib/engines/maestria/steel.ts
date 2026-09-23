import { fmt, layoutJoistBars, type BarDef, type CalcCheck, type CalcOutput, type CalcStep } from "../../types";

export function round05(x: number) {
  return Math.ceil(x * 20 - 1e-9) / 20;
}

/** Ø de malla de losa (pulgadas) y s de norma E.060. */
export const SLAB_MESH_BARS: BarDef[] = [
  { name: '3/8"', db: 0.95, as: 0.71 },
  { name: '1/2"', db: 1.27, as: 1.29 },
  { name: '5/8"', db: 1.59, as: 1.99 },
  { name: '3/4"', db: 1.91, as: 2.84 },
  { name: '1"', db: 2.54, as: 5.07 },
  { name: '1 1/4"', db: 3.18, as: 7.92 },
  { name: '1 1/2"', db: 3.81, as: 11.4 },
];

export const SLAB_S_STD = [10, 12.5, 15, 20, 25, 30, 35, 40, 45];

export type MeshPick = {
  bar: string;
  s: number;
  asBar: number;
  db: number;
  asProv: number;
};

export function sMaxSlab(hCm: number) {
  return Math.min(45, Math.max(10, Math.floor(3 * hCm)));
}

function asProvOf(bar: BarDef, s: number) {
  return (100 / Math.max(s, 1e-6)) * bar.as;
}

function legalS(hCm: number) {
  const sMax = sMaxSlab(hCm);
  return SLAB_S_STD.filter((s) => s + 1e-9 >= 10 && s <= sMax + 1e-9);
}

/** Una zona: Ø mínimo y s de norma con As_disp ≥ As_req. */
export function pickSlabBar(As: number, hCm: number): MeshPick {
  const need = Math.max(As, 1e-6);
  const ss = legalS(hCm);
  for (const bar of SLAB_MESH_BARS) {
    for (const s of [...ss].sort((a, b) => b - a)) {
      const asProv = asProvOf(bar, s);
      if (asProv + 1e-9 >= need) return { bar: bar.name, s, asBar: bar.as, db: bar.db, asProv };
    }
  }
  const bar = SLAB_MESH_BARS[SLAB_MESH_BARS.length - 1];
  const s = ss[0] ?? 10;
  return { bar: bar.name, s, asBar: bar.as, db: bar.db, asProv: asProvOf(bar, s) };
}

/**
 * Una malla: Ø base = el mínimo que cubre la zona más suave.
 * Si un paño pide más momento, se reduce s o se sube Ø SOLO ahí.
 */
export function pickMeshFamily(asReq: number[], hCm: number): MeshPick[] {
  if (!asReq.length) return [];
  const positive = asReq.map((a) => Math.max(0, a));
  const asMin = Math.min(...positive.filter((a) => a > 1e-6), positive[0] ?? 0);
  const base = pickSlabBar(Math.max(asMin, 1e-6), hCm);
  const baseBar = SLAB_MESH_BARS.find((b) => b.name === base.bar) ?? SLAB_MESH_BARS[0];
  const baseIdx = Math.max(0, SLAB_MESH_BARS.findIndex((b) => b.name === baseBar.name));
  const ss = legalS(hCm);
  const sAsc = [...ss].sort((a, b) => a - b);
  const sDesc = [...ss].sort((a, b) => b - a);

  return positive.map((need) => {
    if (need <= 1e-8) {
      return { bar: baseBar.name, s: sDesc[0] ?? 20, asBar: baseBar.as, db: baseBar.db, asProv: 0 };
    }
    for (const s of sDesc) {
      const asProv = asProvOf(baseBar, s);
      if (asProv + 1e-9 >= need) return { bar: baseBar.name, s, asBar: baseBar.as, db: baseBar.db, asProv };
    }
    for (let i = baseIdx + 1; i < SLAB_MESH_BARS.length; i++) {
      const bar = SLAB_MESH_BARS[i];
      for (const s of sDesc) {
        const asProv = asProvOf(bar, s);
        if (asProv + 1e-9 >= need) return { bar: bar.name, s, asBar: bar.as, db: bar.db, asProv };
      }
    }
    const bar = SLAB_MESH_BARS[SLAB_MESH_BARS.length - 1];
    const s = sAsc[0] ?? 10;
    return { bar: bar.name, s, asBar: bar.as, db: bar.db, asProv: asProvOf(bar, s) };
  });
}

export function asFlex(Mu: number, bCm: number, dCm: number, fc: number, fy: number, hCm: number) {
  const Asmin = Math.max(0.0018 * bCm * Math.max(hCm, dCm), (14 / Math.max(fy, 1)) * bCm * dCm);
  if (Mu <= 1e-6 || dCm < 4) return { As: Asmin, rho: Asmin / Math.max(bCm * dCm, 1), Asmin, phiMn: 0, Rn: 0 };
  const phi = 0.9;
  const Rn = (Mu * 100000) / (phi * bCm * dCm * dCm);
  const disc = 1 - (2 * Rn) / (0.85 * Math.max(fc, 1));
  const rho = disc > 0 ? (0.85 * fc / fy) * (1 - Math.sqrt(Math.max(0, disc))) : 0.025;
  const As = Math.max(rho * bCm * dCm, Asmin);
  const a = (As * fy) / (0.85 * Math.max(fc, 1) * bCm);
  const phiMn = (phi * As * fy * (dCm - a / 2)) / 100000;
  return { As, rho: As / (bCm * dCm), Asmin, phiMn, Rn };
}

export type SlabFace = {
  Mu: number;
  bCm: number;
  dCm: number;
  As: number;
  Asmin: number;
  rho: number;
  Rn: number;
  phiMn: number;
  bar: string;
  s: number;
  db: number;
  asProv: number;
  n: number;
  perRib: boolean;
  label: string;
  detalle: string;
  ok: boolean;
};

/** Cara de losa: Whitney por metro (maciza / negativo) o por nervio (aligerada +). */
export function designSlabFace(opts: {
  Mu: number;
  dCm: number;
  fc: number;
  fy: number;
  hCm: number;
  perRib?: boolean;
  sAli?: number;
  bwCm?: number;
}): SlabFace {
  const perRib = Boolean(opts.perRib);
  const sAli = Math.max(20, opts.sAli ?? 40);
  const bw = Math.max(8, opts.bwCm ?? 10);
  const bCm = perRib ? bw : 100;
  const MuSec = perRib ? opts.Mu * (sAli / 100) : opts.Mu;
  const flex = asFlex(MuSec, bCm, opts.dCm, opts.fc, opts.fy, opts.hCm);
  if (perRib) {
    const joist = layoutJoistBars(flex.As);
    const sEq = joist.n <= 1 ? sAli : Math.max(8, Math.round(sAli / joist.n));
    const asProvM = (joist.AsProv * 100) / sAli;
    return {
      Mu: opts.Mu,
      bCm,
      dCm: opts.dCm,
      As: flex.As,
      Asmin: flex.Asmin,
      rho: flex.rho,
      Rn: flex.Rn,
      phiMn: flex.phiMn,
      bar: joist.bar.name,
      s: sEq,
      db: joist.bar.db,
      asProv: asProvM,
      n: joist.n,
      perRib: true,
      label: `Ø ${joist.bar.name} @ ${sEq} cm`,
      detalle: `${joist.n} Ø ${joist.bar.name} / nervio (s=${fmt(sAli, 0)} cm) · As=${fmt(joist.AsProv, 2)} cm²/nervio ≡ ${fmt(asProvM, 2)} cm²/m`,
      ok: joist.AsProv + 1e-6 >= flex.As,
    };
  }
  const pick = pickSlabBar(flex.As, opts.hCm);
  return {
    Mu: opts.Mu,
    bCm: 100,
    dCm: opts.dCm,
    As: flex.As,
    Asmin: flex.Asmin,
    rho: flex.rho,
    Rn: flex.Rn,
    phiMn: flex.phiMn,
    bar: pick.bar,
    s: pick.s,
    db: pick.db,
    asProv: pick.asProv,
    n: 0,
    perRib: false,
    label: fmtBar(pick),
    detalle: `Ø ${pick.bar} @ ${pick.s} cm · As,prov=${fmt(pick.asProv, 2)} cm²/m`,
    ok: pick.asProv + 1e-6 >= flex.As,
  };
}

export function emptySlabFace(dCm: number): SlabFace {
  return {
    Mu: 0,
    bCm: 100,
    dCm,
    As: 0,
    Asmin: 0,
    rho: 0,
    Rn: 0,
    phiMn: 0,
    bar: '3/8"',
    s: 0,
    db: 0.95,
    asProv: 0,
    n: 0,
    perRib: false,
    label: "—",
    detalle: "Sin lecho: no hay apoyo viga/muro en esa dirección",
    ok: true,
  };
}

export function applyMeshPick(face: SlabFace, pick: MeshPick): SlabFace {
  if (face.As <= 1e-8 || pick.asProv <= 1e-8) return { ...face, label: "—", detalle: "Sin lecho", asProv: 0, s: 0, ok: true };
  return {
    ...face,
    bar: pick.bar,
    s: pick.s,
    db: pick.db,
    asProv: pick.asProv,
    label: fmtBar(pick),
    detalle: `Ø ${pick.bar} @ ${pick.s} cm · As,prov=${fmt(pick.asProv, 2)} cm²/m`,
    ok: pick.asProv + 1e-6 >= face.As,
  };
}

export function labelBar(p: { bar: string; s: number }) {
  return `Ø ${p.bar} @ ${p.s} cm`;
}

/** φVc una dirección, E.060 11.3: vc = 0.53 √f'c (kg/cm²), b y d en cm, resultado en t. */
export function oneWayShear(Vu: number, bCm: number, dCm: number, fc: number) {
  const phiVc = (0.85 * 0.53 * Math.sqrt(Math.max(fc, 1)) * bCm * dCm) / 1000;
  return { Vu, phiVc, ok: Vu <= phiVc + 1e-6 };
}

/**
 * Punzonamiento ACI 318 / E.060 11.12.
 * vc = mín{ 0.53(2+4/βc), 0.53(αs d/b0 + 2), 1.06 } √f'c
 * αs = 40 interior, 30 borde, 20 esquina.
 */
export function punchCapacity(fc: number, b0cm: number, dCm: number, beta: number, alphaS: number) {
  const sq = Math.sqrt(Math.max(fc, 1));
  const v1 = 0.53 * (2 + 4 / Math.max(beta, 1)) * sq;
  const v2 = 0.53 * ((alphaS * dCm) / Math.max(b0cm, 1) + 2) * sq;
  const v3 = 1.06 * sq;
  const vc = Math.min(v1, v2, v3);
  const phiVn = (0.85 * vc * b0cm * dCm) / 1000;
  return { vc, phiVn, v1, v2, v3, govern: vc === v3 ? "1.06√f'c" : vc === v1 ? "βc" : "αs d/b0" };
}

export type PunchRect = { x0: number; y0: number; x1: number; y1: number };

export type PunchSeg = { x1: number; y1: number; x2: number; y2: number };

export type PunchGeom = {
  b0: number;
  Acrit: number;
  sides: number;
  kind: "interior" | "borde" | "esquina";
  alphaS: number;
  poly: { x: number; y: number }[];
  segs: PunchSeg[];
  cx: number;
  cy: number;
};

function overlap(a: PunchRect, b: PunchRect) {
  return a.x0 < b.x1 - 1e-9 && a.x1 > b.x0 + 1e-9 && a.y0 < b.y1 - 1e-9 && a.y1 > b.y0 + 1e-9;
}

function rectArea(r: PunchRect) {
  return Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
}

function ptOnRects(x: number, y: number, rs: PunchRect[], e = 1e-6) {
  return rs.some((r) => x >= r.x0 - e && x <= r.x1 + e && y >= r.y0 - e && y <= r.y1 + e);
}

function colOnRects(cx: number, cy: number, c1: number, c2: number, rs: PunchRect[]) {
  const hx = c2 / 2;
  const hy = c1 / 2;
  return (
    ptOnRects(cx - hx, cy - hy, rs) &&
    ptOnRects(cx + hx, cy - hy, rs) &&
    ptOnRects(cx + hx, cy + hy, rs) &&
    ptOnRects(cx - hx, cy + hy, rs)
  );
}

function areaBoxOnRects(box: PunchRect, rs: PunchRect[]) {
  let a = 0;
  for (const r of rs) {
    const x0 = Math.max(box.x0, r.x0);
    const x1 = Math.min(box.x1, r.x1);
    const y0 = Math.max(box.y0, r.y0);
    const y1 = Math.min(box.y1, r.y1);
    if (x1 > x0 && y1 > y0) a += (x1 - x0) * (y1 - y0);
  }
  return a;
}

function clipSegToRects(x1: number, y1: number, x2: number, y2: number, rs: PunchRect[]): PunchSeg[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const intervals: [number, number][] = [];
  for (const r of rs) {
    let t0 = 0;
    let t1 = 1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - r.x0, r.x1 - x1, y1 - r.y0, r.y1 - y1];
    let reject = false;
    for (let i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-12) {
        if (q[i] < -1e-9) {
          reject = true;
          break;
        }
        continue;
      }
      const t = q[i] / p[i];
      if (p[i] < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
    if (!reject && t1 > t0 + 1e-9) intervals.push([t0, t1]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], iv[1]);
    else merged.push([iv[0], iv[1]]);
  }
  return merged.map(([a, b]) => ({
    x1: x1 + dx * a,
    y1: y1 + dy * a,
    x2: x1 + dx * b,
    y2: y1 + dy * b,
  }));
}

function segLen(s: PunchSeg) {
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
}

/** El pedestal queda entero sobre la zapata (cara exterior al borde, no a caballo). */
export function seatColumnOnRect(cx: number, cy: number, c1: number, c2: number, xLo: number, yLo: number, xHi: number, yHi: number) {
  const hx = Math.max(c2 / 2, 0.05);
  const hy = Math.max(c1 / 2, 0.05);
  const xMax = Math.max(xLo + hx, xHi - hx);
  const yMax = Math.max(yLo + hy, yHi - hy);
  return {
    cx: Math.min(Math.max(cx, xLo + hx), xMax),
    cy: Math.min(Math.max(cy, yLo + hy), yMax),
  };
}

/** Asienta el pedestal sobre el concreto pintado: si el nudo deja media columna en el vacío, se corre al paño. */
export function seatColumnOnPainted(
  cx: number,
  cy: number,
  c1: number,
  c2: number,
  rects: PunchRect[],
  envelope?: PunchRect,
) {
  const slab = rects.length ? rects : envelope ? [envelope] : [];
  if (!slab.length) return { cx, cy };
  const foot: PunchRect = { x0: cx - c2 / 2, y0: cy - c1 / 2, x1: cx + c2 / 2, y1: cy + c1 / 2 };
  const hit = slab.filter((r) => overlap(foot, r));
  const use = hit.length ? hit : slab;
  if (colOnRects(cx, cy, c1, c2, use)) return { cx, cy };
  const host = use.reduce((a, b) => (rectArea(b) > rectArea(a) ? b : a));
  return seatColumnOnRect(cx, cy, c1, c2, host.x0, host.y0, host.x1, host.y1);
}

/**
 * Perímetro crítico a d/2 (E.060 11.12 / ACI 22.6).
 * El pedestal se asienta entero sobre la zapata: un nudo en el vértice no deja media columna fuera.
 * Esquina: b0 = (c1 + d/2) + (c2 + d/2). Borde: tres lados. Interior: cuatro.
 * b0 y Acrit se recortan a la unión de paños pintados (L / irregular), no al rectángulo envolvente.
 */
export function punchGeom(
  cx: number,
  cy: number,
  c1: number,
  c2: number,
  dM: number,
  B: number,
  L: number,
  painted?: PunchRect[],
): PunchGeom {
  const envelope: PunchRect = { x0: 0, y0: 0, x1: Math.max(L, 0.2), y1: Math.max(B, 0.2) };
  const slab = painted && painted.length ? painted : [envelope];
  const seated = seatColumnOnPainted(cx, cy, c1, c2, slab, envelope);
  const hx = c2 / 2 + dM / 2;
  const hy = c1 / 2 + dM / 2;
  const box: PunchRect = {
    x0: seated.cx - hx,
    y0: seated.cy - hy,
    x1: seated.cx + hx,
    y1: seated.cy + hy,
  };
  const sideDefs = [
    { x1: box.x0, y1: box.y0, x2: box.x1, y2: box.y0 },
    { x1: box.x1, y1: box.y0, x2: box.x1, y2: box.y1 },
    { x1: box.x1, y1: box.y1, x2: box.x0, y2: box.y1 },
    { x1: box.x0, y1: box.y1, x2: box.x0, y2: box.y0 },
  ];
  const segs = sideDefs.flatMap((s) => clipSegToRects(s.x1, s.y1, s.x2, s.y2, slab).filter((g) => segLen(g) > 0.015));
  const sides = sideDefs.filter((s) => clipSegToRects(s.x1, s.y1, s.x2, s.y2, slab).some((g) => segLen(g) > 0.02)).length;
  const kind: PunchGeom["kind"] = sides >= 4 ? "interior" : sides === 3 ? "borde" : "esquina";
  const alphaS = kind === "interior" ? 40 : kind === "borde" ? 30 : 20;
  const b0m = segs.reduce((s, g) => s + segLen(g), 0);
  let x0 = box.x1;
  let x1 = box.x0;
  let y0 = box.y1;
  let y1 = box.y0;
  for (const r of slab) {
    const ix0 = Math.max(box.x0, r.x0);
    const ix1 = Math.min(box.x1, r.x1);
    const iy0 = Math.max(box.y0, r.y0);
    const iy1 = Math.min(box.y1, r.y1);
    if (ix1 > ix0 && iy1 > iy0) {
      x0 = Math.min(x0, ix0);
      x1 = Math.max(x1, ix1);
      y0 = Math.min(y0, iy0);
      y1 = Math.max(y1, iy1);
    }
  }
  if (x1 <= x0 || y1 <= y0) {
    x0 = Math.max(envelope.x0, box.x0);
    x1 = Math.min(envelope.x1, box.x1);
    y0 = Math.max(envelope.y0, box.y0);
    y1 = Math.min(envelope.y1, box.y1);
  }
  const poly = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  return {
    b0: Math.max(b0m, 0.01) * 100,
    Acrit: Math.max(areaBoxOnRects(box, slab), 0.001),
    sides,
    kind,
    alphaS,
    poly,
    segs,
    cx: seated.cx,
    cy: seated.cy,
  };
}

export function ok(label: string, value: string, limit: string, pass: boolean): CalcCheck {
  return { label, value, limit, ok: pass };
}

export function out(
  headline: string,
  adoption: string,
  steps: CalcStep[],
  checks: CalcCheck[],
  extras?: CalcOutput["extras"],
  dims?: Record<string, string>,
): CalcOutput {
  return { headline, adoption, steps, checks, extras, dims };
}

export function step(
  n: string,
  title: string,
  formula: string,
  formulaTex: string,
  substitution: string,
  result: string,
  note: string,
  extra?: Partial<CalcStep>,
): CalcStep {
  return { n, title, formula, formulaTex, substitution, result, note, ...extra };
}

export function fmtBar(p: { bar: string; s: number }) {
  return `Ø ${p.bar} @ ${p.s} cm`;
}

/** Longitud de desarrollo a tracción, E.060 12.2 (forma simplificada). */
export function ldTension(fy: number, fc: number, dbCm: number) {
  return (0.075 * fy * dbCm) / Math.max(Math.sqrt(Math.max(fc, 1)), 1);
}

/**
 * Acero longitudinal de viga (no malla): n Ø que caben en b con recubrimiento.
 * Se usa en vigas de cimentación; nunca Ø @ s de losa.
 */
export function pickBeamBars(As: number, bCm: number, recCm = 5) {
  const names = SLAB_MESH_BARS.filter((b) => b.db <= 2.55);
  const usable = Math.max(bCm - 2 * Math.max(recCm, 4), 10);
  let best: { n: number; bar: (typeof SLAB_MESH_BARS)[number]; asProv: number; score: number } | null = null;
  for (const bar of names) {
    const pitch = Math.max(bar.db + 2.5, 6);
    const nMax = Math.max(2, Math.min(8, Math.floor(usable / pitch) + 1));
    for (let n = 2; n <= nMax; n++) {
      const asProv = n * bar.as;
      if (asProv + 1e-9 < Math.max(As, 0.4)) continue;
      const score = n * 0.12 + bar.db;
      if (!best || score < best.score - 1e-9 || (Math.abs(score - best.score) < 1e-9 && asProv < best.asProv)) {
        best = { n, bar, asProv, score };
      }
      break;
    }
  }
  if (!best) {
    const bar = names[names.length - 1] ?? SLAB_MESH_BARS[3];
    const n = Math.max(2, Math.ceil(Math.max(As, 0.4) / bar.as));
    best = { n, bar, asProv: n * bar.as, score: 99 };
  }
  return {
    n: best.n,
    bar: best.bar.name,
    db: best.bar.db,
    asBar: best.bar.as,
    asProv: best.asProv,
    text: `${best.n} Ø ${best.bar.name}`,
  };
}

/**
 * Amplificación simplificada de Vu por transferencia de momento en el perímetro
 * crítico (E.060 11.12.6 / ACI 22.6.4). Interior ≈ 1; borde y esquina se mayoran
 * porque γv Mu c / J no se resuelve aquí con el tensor J completo.
 */
export function punchMomentAmp(kind: PunchGeom["kind"]) {
  if (kind === "esquina") return 1.25;
  if (kind === "borde") return 1.15;
  return 1;
}

/** Distancia desde un punto hasta salir del concreto pintado, en una dirección. */
export function rayCantilever(cx: number, cy: number, painted: PunchRect[], dx: number, dy: number, maxLen = 40) {
  const slab = painted.length ? painted : [{ x0: -maxLen, y0: -maxLen, x1: maxLen, y1: maxLen }];
  const step = 0.02;
  let last = 0;
  for (let s = step; s <= maxLen + 1e-9; s += step) {
    if (!ptOnRects(cx + dx * s, cy + dy * s, slab, 1e-4)) return last;
    last = s;
  }
  return last;
}

/** Vuelos desde las caras del pedestal hasta el borde libre del concreto pintado. */
export function colCantilevers(cx: number, cy: number, c1: number, c2: number, painted: PunchRect[]) {
  const xP = rayCantilever(cx + c2 / 2, cy, painted, 1, 0);
  const xM = rayCantilever(cx - c2 / 2, cy, painted, -1, 0);
  const yP = rayCantilever(cx, cy + c1 / 2, painted, 0, 1);
  const yM = rayCantilever(cx, cy - c1 / 2, painted, 0, -1);
  return { xP, xM, yP, yM, lv: Math.max(xP, xM, yP, yM, 0.15) };
}

/** Vuelo de losa (flexión/corte 1 dir.): el voladizo corto, no la luz de la corrida. */
export function transverseCantilever(cant: { xP: number; xM: number; yP: number; yM: number }) {
  const alongX = Math.max(cant.xP, cant.xM, 0);
  const alongY = Math.max(cant.yP, cant.yM, 0);
  if (alongX < 0.05) return Math.max(alongY, 0.15);
  if (alongY < 0.05) return Math.max(alongX, 0.15);
  return Math.max(Math.min(alongX, alongY), 0.15);
}

/**
 * Extensión del negativo más allá del punto de inflexión.
 * E.060 / ACI 318 9.7.3.8.4 y 7.7.3.8: ≥ máx(d, 12 db, ℓn/16).
 * Al menos 1/3 del As− se prolonga esa distancia; aquí se aplica a toda la malla.
 */
export function losaNegLextCm(dbCm: number, dCm: number, lnM: number) {
  const twelveDb = 12 * Math.max(dbCm, 0);
  const d = Math.max(dCm, 0);
  const ln16 = (Math.max(lnM, 0) * 100) / 16;
  const LextCm = Math.max(twelveDb, d, ln16);
  const gov = ln16 + 1e-9 >= twelveDb && ln16 + 1e-9 >= d ? "ℓn/16" : d + 1e-9 >= twelveDb ? "d" : "12 db";
  return { twelveDb, dCm: d, ln16, LextCm, gov };
}

export type LosaNegCutSrc = "pórtico" | "anclaje" | "0.30 ℓn";

/**
 * Corte del As− desde el eje de apoyo.
 * - pórtico: L_teo (inflexión) + máx(12 db, d, ℓn/16).
 * - anclaje: apoyo simple / M≈0 — solo L_ext (gancho 90° en borde). No se usa 0,30 ℓn.
 * - 0.30 ℓn: la regla ACI de corte ya es la longitud total; no se suma L_ext otra vez.
 */
export function losaNegBarM(opts: {
  LteoM: number;
  dbCm: number;
  dCm: number;
  lnM: number;
  recCm?: number;
  edge?: boolean;
  src?: LosaNegCutSrc;
  capRatio?: number;
}) {
  const ext = losaNegLextCm(opts.dbCm, opts.dCm, opts.lnM);
  const LextM = ext.LextCm / 100;
  const hookMinM = opts.edge ? (opts.recCm ?? 2.5) / 100 + (12 * Math.max(opts.dbCm, 0)) / 100 : 0;
  const src = opts.src ?? "pórtico";
  const ln = Math.max(opts.lnM, 0);
  let raw: number;
  if (src === "anclaje") {
    raw = Math.max(LextM, hookMinM);
  } else if (src === "0.30 ℓn") {
    const cutoff = Math.max(opts.LteoM, 0) > 1e-9 ? Math.max(opts.LteoM, 0) : 0.3 * ln;
    raw = Math.max(cutoff, hookMinM);
  } else {
    raw = Math.max(Math.max(0, opts.LteoM) + LextM, hookMinM);
  }
  const capRatio = opts.capRatio ?? (src === "anclaje" ? 0.2 : 0.45);
  const cap = ln * capRatio;
  const LbarM = cap > 1e-9 ? Math.min(raw, Math.max(cap, hookMinM)) : raw;
  return { ...ext, LteoM: Math.max(0, opts.LteoM), LextM, LbarM, hookMinM, src };
}

export function pendingPlantOut(title: string, how: string) {
  return out(
    title,
    how,
    [
      step(
        "00",
        "Planta no definida — no se emite el expediente",
        "",
        "",
        "Pinte la planta en el croquis o pulse «Cargar ejemplo».",
        "No se publica el procedimiento numérico hasta disponer de geometría y apoyos.",
        "Un recuadro con celdas = 0 no es memoria de cálculo. El expediente requiere área, inercias, cargas y verificaciones con números.",
      ),
    ],
    [],
  );
}

export { fmt };
