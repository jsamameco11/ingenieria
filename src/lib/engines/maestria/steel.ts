import { BARS, fmt, layoutJoistBars, spacingFor, type CalcCheck, type CalcOutput, type CalcStep } from "../../types";

export function round05(x: number) {
  return Math.ceil(x * 20 - 1e-9) / 20;
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

export function pickSlabBar(As: number, hCm: number) {
  const sMax = Math.min(45, Math.max(8, Math.floor(3 * hCm)));
  const tryBars = BARS.filter((b) => b.db <= 1.91);
  for (const bar of tryBars) {
    const s = spacingFor(As, bar.as, 100);
    if (s >= 10 && s <= sMax) return { bar: bar.name, s, asBar: bar.as, db: bar.db, asProv: (100 / s) * bar.as };
  }
  const bar = BARS[1];
  const s = Math.min(sMax, spacingFor(As, bar.as, 100));
  return { bar: bar.name, s, asBar: bar.as, db: bar.db, asProv: (100 / s) * bar.as };
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

export type PunchGeom = {
  b0: number;
  Acrit: number;
  sides: number;
  kind: "interior" | "borde" | "esquina";
  alphaS: number;
  poly: { x: number; y: number }[];
};

/** Perímetro crítico a d/2, recortado al contorno [0,L]×[0,B]. */
export function punchGeom(cx: number, cy: number, c1: number, c2: number, dM: number, B: number, L: number): PunchGeom {
  const hx = c2 / 2 + dM / 2;
  const hy = c1 / 2 + dM / 2;
  const left = cx - hx;
  const right = cx + hx;
  const bot = cy - hy;
  const top = cy + hy;
  const x0 = Math.max(0, left);
  const x1 = Math.min(L, right);
  const y0 = Math.max(0, bot);
  const y1 = Math.min(B, top);
  const clipL = Math.max(0, x1 - x0);
  const clipB = Math.max(0, y1 - y0);
  const openL = left > 0.02;
  const openR = right < L - 0.02;
  const openB = bot > 0.02;
  const openT = top < B - 0.02;
  const sides = Number(openL) + Number(openR) + Number(openB) + Number(openT);
  const kind: PunchGeom["kind"] = sides >= 4 ? "interior" : sides === 3 ? "borde" : "esquina";
  const alphaS = kind === "interior" ? 40 : kind === "borde" ? 30 : 20;
  const b0m = clipL * (Number(openB) + Number(openT)) + clipB * (Number(openL) + Number(openR));
  const poly = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  return { b0: Math.max(b0m, 0.01) * 100, Acrit: clipL * clipB, sides, kind, alphaS, poly };
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
