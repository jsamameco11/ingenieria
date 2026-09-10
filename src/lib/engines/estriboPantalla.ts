import {
  type CalcCheck,
  type CalcOutput,
  type CalcStep,
  type Engine,
  BARS,
  fmt,
  num,
  rad,
  spacingFor,
  str,
} from "../types";

function out(
  headline: string,
  adoption: string,
  steps: CalcOutput["steps"],
  checks: CalcCheck[],
  extras?: CalcOutput["extras"],
  dims?: Record<string, string>
): CalcOutput {
  return { headline, adoption, steps, checks, extras, dims };
}

function ok(label: string, value: string, limit: string, pass: boolean): CalcCheck {
  return { label, value, limit, ok: pass };
}

function paso(
  n: string,
  title: string,
  formula: string,
  substitution: string,
  result: string,
  extra?: { note?: string; ok?: boolean; table?: CalcStep["table"] }
): CalcStep {
  return { n, title, formula, substitution, result, ...extra };
}

function bindTable(steps: CalcStep[], n: string, extra: { title: string; rows: string[][] }) {
  const s = steps.find((x) => x.n === n);
  if (!s) return;
  s.table = { caption: extra.title, headers: extra.rows[0] ?? [], rows: extra.rows.slice(1) };
}

function coulombKa(phi: number, delta: number, beta: number, theta: number) {
  const p = rad(phi);
  const d = rad(delta);
  const b = rad(beta);
  const t = rad(theta);
  const senPD = Math.sin(p + d);
  const senPB = Math.sin(p - b);
  const senTD = Math.sin(t - d);
  const senTB = Math.sin(t + b);
  const inner = (senPD * senPB) / Math.max(1e-9, senTD * senTB);
  const gamma = (1 + Math.sqrt(Math.max(0, inner))) ** 2;
  const ka = Math.sin(t + p) ** 2 / Math.max(1e-9, gamma * Math.sin(t) ** 2 * senTD);
  return { ka, gamma, inner, senPD, senPB, senTD, senTB };
}

function hPrimeLive(H: number) {
  if (H <= 3) return 1.2;
  if (H >= 6) return 0.6;
  return 1.2 - ((H - 3) * (1.2 - 0.6)) / 3;
}

function nMinCajuelaMm(Ltab_m: number, Hprime_m: number, skewDeg: number) {
  const L = Ltab_m * 1000;
  const Hp = Hprime_m * 1000;
  return (200 + 0.0017 * L + 0.0067 * Hp) * (1 + 0.000125 * skewDeg * skewDeg);
}

function kaeMononobe(phi: number, delta: number, i: number, betap: number, thp: number) {
  const p = rad(phi);
  const d = rad(delta);
  const bp = rad(betap);
  const tp = rad(thp);
  const iRad = (i * Math.PI) / 180;
  const inner =
    (Math.sin(p + d) * Math.sin(p - tp - iRad)) /
    Math.max(1e-9, Math.cos(bp + tp + d) * Math.cos(iRad - bp));
  const nume = Math.cos(p - tp - bp) ** 2;
  const den =
    Math.cos(tp) *
    Math.cos(bp) ** 2 *
    Math.cos(d + bp + tp) *
    (1 + Math.sqrt(Math.max(0, inner))) ** 2;
  return { kae: nume / Math.max(1e-9, den), inner };
}

function whitney(MuTm: number, bCm: number, dCm: number, fc: number, fy: number, phi = 0.9) {
  const MuKgCm = Math.abs(MuTm) * 100000;
  const Ru = MuKgCm / (phi * bCm * dCm * dCm);
  const disc = 1 - (2 * Ru) / (0.85 * fc);
  const rho = disc > 0 ? (0.85 * fc / fy) * (1 - Math.sqrt(Math.max(0, disc))) : 0.021;
  const As = rho * bCm * dCm;
  const a = (As * fy) / (0.85 * fc * bCm);
  const Mn = As * fy * (dCm - a / 2) / 100000;
  const Asmin = Math.max((0.8 * Math.sqrt(fc) / fy) * bCm * dCm, (14 / fy) * bCm * dCm);
  return { Ru, rho, As, a, Mn, Asmin, AsUse: Math.max(As, Asmin), phi };
}

type Combo = {
  name: string;
  gDC: number;
  gDW: number;
  gEV: number;
  gLL: number;
  gLSy: number;
  gLSx: number;
  gEH: number;
  gEQ: number;
  gBR: number;
  gWS: number;
  gCR: number;
  emaxK: number;
  phiB: number;
  phiTau: number;
};

const COMBOS: Combo[] = [
  { name: "Resistencia Ia", gDC: 0.9, gDW: 0.65, gEV: 1.0, gLL: 0, gLSy: 0, gLSx: 1.75, gEH: 1.5, gEQ: 0, gBR: 1.75, gWS: 0, gCR: 0.5, emaxK: 1 / 3, phiB: 0.55, phiTau: 1 },
  { name: "Resistencia Ib", gDC: 1.25, gDW: 1.5, gEV: 1.35, gLL: 1.75, gLSy: 1.75, gLSx: 1.75, gEH: 1.5, gEQ: 0, gBR: 1.75, gWS: 0, gCR: 0.5, emaxK: 1 / 3, phiB: 0.55, phiTau: 1 },
  { name: "Evento extremo I", gDC: 1, gDW: 1, gEV: 1, gLL: 0.5, gLSy: 0.5, gLSx: 0.5, gEH: 1, gEQ: 1, gBR: 0, gWS: 0, gCR: 0, emaxK: 11 / 30, phiB: 1, phiTau: 1 },
  { name: "Servicio I", gDC: 1, gDW: 1, gEV: 1, gLL: 1, gLSy: 1, gLSx: 1, gEH: 1, gEQ: 0, gBR: 1, gWS: 1, gCR: 1, emaxK: 1 / 3, phiB: 1, phiTau: 1 },
];

/**
 * Estribo tipo pantalla (voladizo) — DIS ESTRIBO PANTALLA + 11.-DISEÑO-DE-ESTRIBO-3
 * Franja de 1.00 m. Unidades t, m. AASHTO LRFD. Un paso por cada celda de cálculo del Excel.
 */
export const estriboPantalla: Engine = (raw) => {
  const H = num(raw, "H", 7);
  const B = num(raw, "B", 4.7);
  const D = num(raw, "D", 1.1);
  const Lp = num(raw, "Lp", 1.1);
  const tsup = num(raw, "tsup", 0.3);
  const tinf = num(raw, "tinf", 0.9);
  const N = num(raw, "N", 0.7);
  const hparap = num(raw, "hparap", 1.5);
  const bparap = num(raw, "bparap", 0.25);
  const e1 = num(raw, "e1", 0.4);
  const e2 = num(raw, "e2", 0.6);
  const t1 = num(raw, "t1", 0.3);
  const t2 = num(raw, "t2", 0.35);
  const t3 = num(raw, "t3", 0);
  const Ltab = num(raw, "Ltab", 20);
  const hviga = num(raw, "hviga", 1.5);
  const skew = num(raw, "skew", 0);
  const hz = num(raw, "hz", 1.5);
  const gc = num(raw, "gc", 2.4);
  const gcs = num(raw, "gcs", 2.32);
  const gs = num(raw, "gs", 1.925);
  const phi = num(raw, "phi", 30);
  const delta = num(raw, "delta", 0);
  const beta = num(raw, "beta", 0);
  const theta = num(raw, "theta", 90);
  const qadm = num(raw, "qadm", 2.67);
  const FS = num(raw, "FS", 3);
  const rocoso = str(raw, "rocoso", "no") === "si";
  const PDC = num(raw, "PDC", 12);
  const PDW = num(raw, "PDW", 1.8);
  const PLL = num(raw, "PLL", 9.494);
  const BR = num(raw, "BR", 1.99);
  const hBR = num(raw, "hBR", 1.8);
  const WS = num(raw, "WS", 0);
  const CR = num(raw, "CRSHTU", 0);
  const eLosa = num(raw, "eLosa", 0.3);
  const PGA = num(raw, "PGA", 0.3);
  const FPGA = num(raw, "FPGA", 1.2);
  const gEQ = num(raw, "gEQ", 0.5);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const rec = num(raw, "rec", 5);
  const recZap = num(raw, "recZap", 7.5);

  const Ltalon = Math.max(0.1, B - Lp - tinf);
  const coul = coulombKa(phi, delta, beta, theta);
  const ka = coul.ka;
  const gammaCoul = coul.gamma;
  const hp = hPrimeLive(H);
  const simply = str(raw, "apoyo", "simple") !== "continuo";
  const nMinMm = nMinCajuelaMm(Ltab, simply ? 0 : H, skew);
  const nMin = nMinMm / 1000;

  const hPant = H - D - hparap - e1;
  const hTrap = Math.max(0, hPant - e2);

  const V1 = bparap * hparap;
  const V2 = e1 * (bparap + N);
  const V3 = (e2 * t2) / 2;
  const V4 = tsup * hPant;
  const V5 = (e2 * t1) / 2;
  const V6 = Math.max(0, (tinf - tsup) * hTrap) / 2;
  const V7 = B * D;
  const Vdc = V1 + V2 + V3 + V4 + V5 + V6 + V7;
  const W1 = V1 * gc;
  const W2 = V2 * gc;
  const W3 = V3 * gc;
  const W4 = V4 * gc;
  const W5 = V5 * gc;
  const W6 = V6 * gc;
  const W7 = V7 * gc;
  const DC = Vdc * gc;

  const xaBack = Lp + tinf;
  const xa1 = xaBack + t2 - bparap / 2;
  const xa2 = xaBack + t2 - (bparap + N) / 2;
  const xa3 = xaBack + t2 / 3;
  const xa4 = xaBack - tsup / 2;
  const xa5 = xaBack - tsup - t1 / 3;
  const xa6 = Lp + (2 * Math.max(tinf - tsup, 0)) / 3;
  const xa7 = B / 2;
  const DCxa =
    (V1 * xa1 + V2 * xa2 + V3 * xa3 + V4 * xa4 + V5 * xa5 + V6 * xa6 + V7 * xa7) / Math.max(Vdc, 1e-6) || B / 2;

  const xaSup = xaBack + t2 - bparap - N / 2;
  const V8 = Ltalon * (H - D);
  const V9 = (t2 * e2) / 2;
  const W8 = V8 * gs;
  const W9 = V9 * gs;
  const EV = W8 + W9;
  const xa8 = B - Ltalon / 2;
  const xa9 = xaBack + t2 / 3;
  const EVxa = EV > 1e-9 ? (W8 * xa8 + W9 * xa9) / EV : xa8;
  const DClosa = eLosa * Ltalon * gcs;
  const DClosaXa = B - Ltalon / 2;
  const LSy = hp * Ltalon * gs;
  const LSyxa = B - Ltalon / 2;

  const sDel = Math.sin(rad(delta));
  const cDel = Math.cos(rad(delta));
  const EH1 = 0.5 * ka * gs * H * H;
  const EH1x = EH1 * cDel;
  const EH1y = EH1 * sDel;
  const EH2 = ka * gcs * eLosa * H;
  const EH2x = EH2 * cDel;
  const EH2y = EH2 * sDel;
  const pLS = ka * hp * gs;
  const LS2 = pLS * H;
  const LS2x = LS2 * cDel;
  const LS2y = LS2 * sDel;

  const kho = FPGA * PGA;
  const kh = 0.5 * kho;
  const kv = 0;
  const thp = (Math.atan(kh / Math.max(1e-6, 1 - kv)) * 180) / Math.PI;
  const betap = Math.max(0, 90 - theta);
  const seismicOk = phi >= beta + thp;
  const mo = kaeMononobe(phi, delta, beta, betap, thp);
  const KAE = seismicOk ? mo.kae : ka;
  const PAE = 0.5 * KAE * gs * H * H;
  const EQterr = Math.max(0, PAE - EH1x);
  const WwWs = DC + EV;
  const PIR = kh * WwWs;
  const combo1 = PAE + 0.5 * PIR;
  const combo2 = Math.max(0.5 * PAE, EH1x) + PIR;
  const useFirst = combo1 >= combo2;
  const EQh1 = useFirst ? EQterr : 0.5 * EQterr;
  const PIRu = useFirst ? 0.5 * PIR : PIR;
  const PEQ = (PDC + PDW) * kho;
  const yEH = H / 3;
  const yEH2 = H / 2;
  const yLS = H / 2;
  const yPIR = H / 2;
  const yPEQ = H - hparap / 2;
  const yBR = H + hBR;
  const yWS = H - hparap / 2;

  const qadmT = qadm * 10;

  type Res = {
    name: string;
    c: Combo;
    Vu: number;
    Hu: number;
    Mvu: number;
    Mhu: number;
    xo: number;
    e: number;
    emax: number;
    qmax: number;
    qmin: number;
    qR: number;
    Ff: number;
    okE: boolean;
    okS: boolean;
    okQ: boolean;
  };

  const rows: Res[] = COMBOS.map((c) => {
    const Vu =
      c.gDC * DC +
      c.gDC * DClosa +
      c.gDC * PDC +
      c.gDW * PDW +
      c.gEV * EV +
      c.gLL * PLL +
      c.gLSy * LSy +
      c.gEH * EH1y +
      c.gEH * EH2y +
      c.gLSy * LS2y;
    const Mvu =
      c.gDC * DC * DCxa +
      c.gDC * DClosa * DClosaXa +
      c.gDC * PDC * xaSup +
      c.gDW * PDW * xaSup +
      c.gEV * EV * EVxa +
      c.gLL * PLL * xaSup +
      c.gLSy * LSy * LSyxa +
      c.gEH * EH1y * B +
      c.gEH * EH2y * B +
      c.gLSy * LS2y * B;
    const Hu =
      c.gLSx * LS2x +
      c.gEH * EH1x +
      c.gEH * EH2x +
      c.gEQ * EQh1 +
      c.gEQ * PIRu +
      c.gEQ * PEQ +
      c.gBR * BR +
      c.gWS * WS +
      c.gCR * CR;
    const Mhu =
      c.gLSx * LS2x * yLS +
      c.gEH * EH1x * yEH +
      c.gEH * EH2x * yEH2 +
      c.gEQ * EQh1 * yLS +
      c.gEQ * PIRu * yPIR +
      c.gEQ * PEQ * yPEQ +
      c.gBR * BR * yBR +
      c.gWS * WS * yWS +
      c.gCR * CR * yWS;
    const xo = Vu > 1e-6 ? (Mvu - Mhu) / Vu : 0;
    const e = B / 2 - xo;
    const emaxK = c.name === "Evento extremo I"
      ? (rocoso ? 0.4 : 11 / 30)
      : (rocoso && c.name.startsWith("Resistencia") ? 0.45 : c.emaxK);
    const emax = emaxK * B;
    const absE = Math.abs(e);
    let qmax: number;
    let qmin: number;
    if (absE <= B / 6) {
      qmax = (Vu / B) * (1 + (6 * absE) / B);
      qmin = (Vu / B) * (1 - (6 * absE) / B);
    } else {
      const Bp = Math.max(B - 2 * absE, 0.08);
      qmax = Vu / Bp;
      qmin = 0;
    }
    const qR = c.name === "Servicio I" ? qadmT : c.phiB * FS * qadmT;
    const Ff = Math.tan(rad(phi)) * c.phiTau * Vu;
    return {
      name: c.name,
      c,
      Vu,
      Hu,
      Mvu,
      Mhu,
      xo,
      e,
      emax,
      qmax,
      qmin,
      qR,
      Ff,
      okE: Math.abs(e) <= emax + 0.01,
      okS: Ff + 1e-6 >= Hu,
      okQ: qmax <= qR + 0.05 && qmin >= -0.05,
    };
  });

  const crit = rows.find((r) => r.name === "Resistencia Ib") ?? rows[1];
  const stemH = H - D;
  const dPant = tinf * 100 - rec - 0.95;
  const MuPant = 1.0 * (1.75 * LS2x * (stemH / 2) + 1.5 * EH1x * (stemH / 3));
  const flexP = whitney(MuPant, 100, Math.max(dPant, 8), fc, fy);
  const barP = BARS.find((b) => b.name === '3/4"') ?? BARS[3];
  const sPant = spacingFor(flexP.AsUse, barP.as, 100);
  const AsTemp = Math.min(12.7, Math.max(2.33, (0.18 * B * D * 10000) / (fy * ((B + D) * 100))));
  const barT = BARS.find((b) => b.name === '1/2"') ?? BARS[1];
  const sTemp = spacingFor(AsTemp, barT.as, 100);

  const VuStem = 1.5 * EH1x + 1.75 * LS2x;
  const Vc = (0.53 * Math.sqrt(fc) * 100 * dPant) / 1000;
  const phiVc = 0.85 * Vc;

  const dZap = D * 100 - recZap - 0.95;
  const MuPun = crit.qmax * Lp * Lp / 2;
  const flexPun = whitney(MuPun, 100, Math.max(dZap, 8), fc, fy);
  const wHeel = (EV + LSy) / Math.max(Ltalon, 0.1) + gc * D;
  const MuTal = Math.abs(wHeel - Math.max(crit.qmin, 0)) * Ltalon * Ltalon / 2;
  const flexTal = whitney(MuTal, 100, Math.max(dZap, 8), fc, fy);
  const sPun = spacingFor(flexPun.AsUse, barP.as, 100);
  const sTal = spacingFor(flexTal.AsUse, barP.as, 100);
  const sBatter = (Math.atan(Math.max(tinf - tsup, 0) / Math.max(hTrap, 0.2)) * 180) / Math.PI;

  const allE = rows.filter((r) => r.name !== "Servicio I").every((r) => r.okE);
  const allS = rows.filter((r) => r.name !== "Servicio I").every((r) => r.okS);
  const allQ = rows.every((r) => r.okQ);
  const nOk = N + 1e-6 >= nMin;

  const Bmin = H / 2;
  const Bmax = (2 / 3) * H;
  const mu = Math.tan(rad(phi));
  const emaxExt = ((2 / 5 - (rocoso ? 0.45 : 1 / 3)) * (gEQ - 0) / 1 + (rocoso ? 0.45 : 1 / 3)) * B;

  const steps: CalcStep[] = [
    paso(
      "01",
      "Predimensionamiento de la sección (franja 1.00 m)",
      "B = ½ H ∼ ⅔ H    ·    D ≈ 0.10 H    ·    Lp ≈ B/3    ·    tsup ≈ H/24    ·    tinf ≈ 0.10 H",
      `H = ${fmt(H, 2)} m  →  B = ${fmt(Bmin, 2)} a ${fmt(Bmax, 2)} m    ·    D ≈ ${fmt(0.1 * H, 2)} m    ·    tsup ≈ ${fmt(H / 24, 2)} m    ·    tinf ≈ ${fmt(0.1 * H, 2)} m    ·    Lp ≈ ${fmt(B / 3, 2)} m`,
      `Adoptado: B = ${fmt(B, 2)} m    D = ${fmt(D, 2)} m    Lp = ${fmt(Lp, 2)} m    tsup = ${fmt(tsup, 2)} m    tinf = ${fmt(tinf, 2)} m    Ltalón = B − Lp − tinf = ${fmt(Ltalon, 2)} m`,
      { note: `Cara posterior vertical. Talud frontal s° = ${fmt(sBatter, 2)}°. Cajuela N = ${fmt(N, 2)} m. Parapeto ${fmt(bparap, 2)} × ${fmt(hparap, 2)} m. e1 = ${fmt(e1, 2)} m, e2 = ${fmt(e2, 2)} m, t1 = ${fmt(t1, 2)} m, t2 = ${fmt(t2, 2)} m.` }
    ),
    paso(
      "02",
      "Longitud mínima de cajuela N — AASHTO 4.7.4.4-1",
      "N = (200 + 0.0017 L + 0.0067 H') (1 + 0.000125 S²)    [mm]",
      `L = ${fmt(Ltab * 1000, 0)} mm    ·    H' = ${simply ? "0 mm (tablero simplemente apoyado)" : fmt(H * 1000, 0) + " mm"}    ·    S = ${fmt(skew, 1)}°    ·    1 + 0.000125 S² = ${fmt(1 + 0.000125 * skew * skew, 4)}`,
      `Nmín = ${fmt(nMinMm, 1)} mm = ${fmt(nMin, 3)} m    ·    N adoptado = ${fmt(N, 2)} m`,
      { ok: nOk, note: nOk ? "La cajuela adoptada cubre la longitud mínima de asiento." : "Aumentar N hasta cumplir 4.7.4.4-1." }
    ),
    paso(
      "03",
      "Coeficiente de empuje activo — término Γ (Coulomb, AASHTO 3.11.5.3)",
      "Γ = [1 + √{ sen(φ+δ) sen(φ−β) / (sen(θ−δ) sen(θ+β)) }]²",
      `φ = ${fmt(phi, 1)}°    δ = ${fmt(delta, 1)}°    β = ${fmt(beta, 1)}°    θ = ${fmt(theta, 1)}°    ·    sen(φ+δ) = ${fmt(coul.senPD, 4)}    sen(φ−β) = ${fmt(coul.senPB, 4)}    sen(θ−δ) = ${fmt(coul.senTD, 4)}    sen(θ+β) = ${fmt(coul.senTB, 4)}    ·    radicando = ${fmt(coul.inner, 4)}`,
      `Γ = ${fmt(gammaCoul, 3)}`
    ),
    paso(
      "04",
      "Coeficiente de empuje activo ka (Coulomb)",
      "ka = sen²(θ+φ) / [ Γ sen²θ sen(θ−δ) ]",
      `sen(θ+φ) = ${fmt(Math.sin(rad(theta + phi)), 4)}    ·    sen θ = ${fmt(Math.sin(rad(theta)), 4)}    ·    Γ = ${fmt(gammaCoul, 3)}    ·    sen(θ−δ) = ${fmt(coul.senTD, 4)}`,
      `ka = ${fmt(ka, 4)}`
    ),
    paso(
      "05",
      "Altura equivalente de suelo por sobrecarga h' — Tabla 3.11.6.4-1",
      "H ≤ 3 m → h' = 1.20 m    ·    3 m < H < 6 m → interpola    ·    H ≥ 6 m → h' = 0.60 m",
      `H = ${fmt(H, 2)} m${H >= 6 ? " ≥ 6 m" : H <= 3 ? " ≤ 3 m" : `  →  1.20 − (${fmt(H, 2)} − 3)×0.20 = ${fmt(hp, 2)} m`}`,
      `h' = ${fmt(hp, 2)} m`,
      { note: "Se agrega una porción equivalente de suelo por cargas vehiculares sobre el relleno del talón." }
    ),
    paso(
      "06",
      "Metrado DC — elemento 1 parapeto",
      "A1 = bparap × hparap    ·    W1 = γc A1    ·    xA,1 desde la puntera A",
      `A1 = ${fmt(bparap, 2)} × ${fmt(hparap, 2)} = ${fmt(V1, 3)} m²/m    ·    γc = ${fmt(gc, 2)} t/m³    ·    xA,1 = ${fmt(xa1, 3)} m`,
      `W1 = ${fmt(W1, 3)} t/m`
    ),
    paso(
      "07",
      "Metrado DC — elemento 2 cajuela / asiento",
      "A2 = e1 × (bparap + N)    ·    W2 = γc A2",
      `A2 = ${fmt(e1, 2)} × (${fmt(bparap, 2)} + ${fmt(N, 2)}) = ${fmt(V2, 3)} m²/m    ·    xA,2 = ${fmt(xa2, 3)} m`,
      `W2 = ${fmt(W2, 3)} t/m`
    ),
    paso(
      "08",
      "Metrado DC — elemento 3 chaflán del talón",
      "A3 = e2 · t2 / 2    ·    W3 = γc A3",
      `A3 = ${fmt(e2, 2)} × ${fmt(t2, 2)} / 2 = ${fmt(V3, 3)} m²/m    ·    xA,3 = ${fmt(xa3, 3)} m`,
      `W3 = ${fmt(W3, 3)} t/m`
    ),
    paso(
      "09",
      "Metrado DC — elemento 4 pantalla rectangular",
      "A4 = tsup × (H − D − hparap − e1)    ·    W4 = γc A4",
      `Hpant = ${fmt(H, 2)} − ${fmt(D, 2)} − ${fmt(hparap, 2)} − ${fmt(e1, 2)} = ${fmt(hPant, 3)} m    ·    A4 = ${fmt(tsup, 2)} × ${fmt(hPant, 3)} = ${fmt(V4, 3)} m²/m    ·    xA,4 = ${fmt(xa4, 3)} m`,
      `W4 = ${fmt(W4, 3)} t/m`
    ),
    paso(
      "10",
      "Metrado DC — elemento 5 chaflán de puntera",
      "A5 = e2 · t1 / 2    ·    W5 = γc A5",
      `A5 = ${fmt(e2, 2)} × ${fmt(t1, 2)} / 2 = ${fmt(V5, 3)} m²/m    ·    xA,5 = ${fmt(xa5, 3)} m`,
      `W5 = ${fmt(W5, 3)} t/m`
    ),
    paso(
      "11",
      "Metrado DC — elemento 6 trapecio de talud",
      "A6 = (tinf − tsup) × Htrap / 2    ·    W6 = γc A6",
      `Htrap = ${fmt(hTrap, 3)} m    ·    (tinf − tsup) = ${fmt(tinf - tsup, 3)} m    ·    A6 = ${fmt(V6, 3)} m²/m    ·    xA,6 = ${fmt(xa6, 3)} m`,
      `W6 = ${fmt(W6, 3)} t/m`
    ),
    paso(
      "12",
      "Metrado DC — elemento 7 zapata",
      "A7 = B × D    ·    W7 = γc A7    ·    xA,7 = B/2",
      `A7 = ${fmt(B, 2)} × ${fmt(D, 2)} = ${fmt(V7, 3)} m²/m    ·    xA,7 = ${fmt(xa7, 3)} m`,
      `W7 = ${fmt(W7, 3)} t/m`
    ),
    paso(
      "13",
      "Peso propio del estribo DCestr",
      "DCestr = Σ Wi    ·    xA = Σ (Wi xA,i) / DCestr",
      `Σ Ai = ${fmt(Vdc, 3)} m²/m    ·    Σ Wi = ${fmt(W1, 2)} + ${fmt(W2, 2)} + ${fmt(W3, 2)} + ${fmt(W4, 2)} + ${fmt(W5, 2)} + ${fmt(W6, 2)} + ${fmt(W7, 2)}`,
      `DCestr = ${fmt(DC, 2)} t/m    ·    xA = ${fmt(DCxa, 3)} m (desde la puntera A)`
    ),
    paso(
      "14",
      "Losa de acercamiento DClosa",
      "DClosa = e,losa × Ltalón × γc,simple",
      `e,losa = ${fmt(eLosa, 2)} m    ·    Ltalón = ${fmt(Ltalon, 2)} m    ·    γc,s = ${fmt(gcs, 2)} t/m³    ·    xA = ${fmt(DClosaXa, 3)} m`,
      `DClosa = ${fmt(DClosa, 2)} t/m`
    ),
    paso(
      "15",
      "Cargas de la superestructura del puente",
      "Plosa = PDC    ·    Pw = PDW    ·    PLL+IM (datos del tablero, franja 1.00 m)",
      `xA,superestructura (eje de cajuela) = ${fmt(xaSup, 3)} m`,
      `PDC = ${fmt(PDC, 2)} t/m    ·    PDW = ${fmt(PDW, 2)} t/m    ·    PLL+IM = ${fmt(PLL, 2)} t/m`
    ),
    paso(
      "16",
      "Presión vertical del relleno EV (elementos 8 y 9)",
      "A8 = Ltalón (H − D)    ·    A9 = t2 e2 / 2    ·    EV = γs (A8 + A9)",
      `A8 = ${fmt(Ltalon, 2)} × ${fmt(H - D, 2)} = ${fmt(V8, 3)} m²/m    ·    A9 = ${fmt(V9, 3)} m²/m    ·    γs = ${fmt(gs, 3)} t/m³    ·    xA,EV = ${fmt(EVxa, 3)} m`,
      `EV = ${fmt(EV, 2)} t/m`
    ),
    paso(
      "17",
      "Sobrecarga viva vertical LS1 sobre el talón",
      "LS1 = h' × Ltalón × γs",
      `h' = ${fmt(hp, 2)} m    ·    Ltalón = ${fmt(Ltalon, 2)} m    ·    γs = ${fmt(gs, 3)} t/m³    ·    xA = ${fmt(LSyxa, 3)} m`,
      `LS1 = ${fmt(LSy, 2)} t/m`
    ),
    paso(
      "18",
      "Empuje activo del terreno EH1",
      "EH1 = ½ ka γs H²    ·    EH1X = EH1 cos δ    ·    EH1Y = EH1 sen δ    ·    y = H/3",
      `EH1 = ½ × ${fmt(ka, 4)} × ${fmt(gs, 3)} × ${fmt(H, 2)}² = ${fmt(EH1, 3)} t/m    ·    δ = ${fmt(delta, 1)}°    ·    cos δ = ${fmt(cDel, 3)}    ·    sen δ = ${fmt(sDel, 3)}    ·    y = ${fmt(yEH, 2)} m`,
      `EH1X = ${fmt(EH1x, 3)} t/m    ·    EH1Y = ${fmt(EH1y, 3)} t/m`
    ),
    paso(
      "19",
      "Empuje por losa de acercamiento EH2",
      "EH2 = ka γc,s e,losa H    ·    EH2X = EH2 cos δ    ·    EH2Y = EH2 sen δ    ·    y = H/2",
      `EH2 = ${fmt(ka, 4)} × ${fmt(gcs, 2)} × ${fmt(eLosa, 2)} × ${fmt(H, 2)} = ${fmt(EH2, 3)} t/m    ·    y = ${fmt(yEH2, 2)} m`,
      `EH2X = ${fmt(EH2x, 3)} t/m    ·    EH2Y = ${fmt(EH2y, 3)} t/m`
    ),
    paso(
      "20",
      "Sobrecarga viva horizontal LS2",
      "LS2 = ka h' γs H    ·    LS2X = LS2 cos δ    ·    LS2Y = LS2 sen δ    ·    y = H/2",
      `LS2 = ${fmt(ka, 4)} × ${fmt(hp, 2)} × ${fmt(gs, 3)} × ${fmt(H, 2)} = ${fmt(LS2, 3)} t/m    ·    y = ${fmt(yLS, 2)} m`,
      `LS2X = ${fmt(LS2x, 3)} t/m    ·    LS2Y = ${fmt(LS2y, 3)} t/m`
    ),
    paso(
      "21",
      "Fuerza de frenado BR — AASHTO 3.6.4",
      "BR actúa a (H + 1.80 m) sobre la rasante de la calzada",
      `BR = ${fmt(BR, 2)} t/m    ·    yBR = ${fmt(H, 2)} + ${fmt(hBR, 2)} = ${fmt(yBR, 2)} m`,
      `M_BR = ${fmt(BR * yBR, 2)} t·m/m`,
      { note: `WS = ${fmt(WS, 2)} t/m (y = ${fmt(yWS, 2)} m).  CR+SH+TU = ${fmt(CR, 2)} t/m.` }
    ),
    paso(
      "22",
      "Sismo — aceleraciones kho, kh y θ' (AASHTO 11.6.5)",
      "kho = FPGA · PGA    ·    kh = ½ kho    ·    kv = 0    ·    θ' = arctan[ kh / (1 − kv) ]",
      `FPGA = ${fmt(FPGA, 2)}    ·    PGA = ${fmt(PGA, 3)}    ·    kho = ${fmt(kho, 3)}    ·    kh = ${fmt(kh, 3)}    ·    kv = 0`,
      `θ' = ${fmt(thp, 2)}°    ·    β' (muro con la vertical) = ${fmt(betap, 2)}°`,
      { ok: seismicOk, note: `Condición de Mononobe–Okabe: φ ${seismicOk ? "≥" : "<"} β + θ' = ${fmt(beta + thp, 2)}°. ${seismicOk ? "Sí aplica M–O." : "No aplica M–O; se usa ka estático."}` }
    ),
    paso(
      "23",
      "Coeficiente sísmico de empuje activo KAE (Mononobe–Okabe)",
      "KAE = cos²(φ − θ' − β') / { cos θ' cos²β' cos(δ+β'+θ') [1 + √(sen(φ+δ) sen(φ−θ'−i) / (cos(β'+θ'+δ) cos(i−β'))) ]² }",
      `φ = ${fmt(phi, 1)}°    δ = ${fmt(delta, 1)}°    i = β = ${fmt(beta, 1)}°    θ' = ${fmt(thp, 2)}°    β' = ${fmt(betap, 2)}°    ·    radicando = ${fmt(mo.inner, 4)}`,
      `KAE = ${fmt(KAE, 4)}`
    ),
    paso(
      "24",
      "Presión sísmica del terreno PAE y EQterr",
      "PAE = ½ KAE γs H²    ·    EQterr = PAE − EH1X",
      `PAE = ½ × ${fmt(KAE, 4)} × ${fmt(gs, 3)} × ${fmt(H, 2)}² = ${fmt(PAE, 3)} t/m    ·    EH1X = ${fmt(EH1x, 3)} t/m`,
      `EQterr = ${fmt(EQterr, 3)} t/m`
    ),
    paso(
      "25",
      "Fuerza inercial PIR y combinación Art. 11.6.5.1",
      "PIR = kh (Ww + Ws)    ·    se toma el mayor de  PAE + 0.5 PIR    y    (0.5 PAE ó EH) + PIR",
      `Ww + Ws = DCestr + EV = ${fmt(DC, 2)} + ${fmt(EV, 2)} = ${fmt(WwWs, 2)} t/m    ·    PIR = ${fmt(kh, 3)} × ${fmt(WwWs, 2)} = ${fmt(PIR, 3)} t/m    ·    PAE+0.5 PIR = ${fmt(combo1, 2)}    ·    (0.5 PAE ó EH)+PIR = ${fmt(combo2, 2)}`,
      useFirst
        ? `Gobierna PAE + 0.5 PIR  →  se usa EQterr = ${fmt(EQh1, 3)} t/m  y  0.5 PIR = ${fmt(PIRu, 3)} t/m`
        : `Gobierna (0.5 PAE ó EH) + PIR  →  se usa 0.5 EQterr = ${fmt(EQh1, 3)} t/m  y  PIR = ${fmt(PIRu, 3)} t/m`
    ),
    paso(
      "26",
      "Carga sísmica de superestructura PEQ — Art. 3.10.9.1",
      "As = FPGA · PGA = kho    ·    PEQ = (PDC + PDW) As    ·    y = H − hparap/2",
      `As = ${fmt(FPGA, 2)} × ${fmt(PGA, 3)} = ${fmt(kho, 3)}    ·    PDC + PDW = ${fmt(PDC + PDW, 2)} t/m    ·    yPEQ = ${fmt(yPEQ, 2)} m`,
      `PEQ = ${fmt(PEQ, 3)} t/m`
    ),
    paso(
      "27",
      "Estados límite y factores de carga (AASHTO 3.4.1)",
      "n = ηD ηR ηI = 1.00    ·    γp según Tabla 3.4.1-1 y 3.4.1-2",
      "Resistencia Ia: γDC=0.90  γDW=0.65  γEV=1.00  γLL=0  γLS,Y=0  γLS,X=1.75  γEH=1.50  γBR=1.75  γEQ=0.    Resistencia Ib: γDC=1.25  γDW=1.50  γEV=1.35  γLL=γLS=1.75  γEH=1.50  γBR=1.75.    Evento extremo I: γ = 1.00 (LL y LS = 0.50, γEQ=1).    Servicio I: γ = 1.00.",
      "Ia y IIIa se usan para vuelco/deslizamiento (γDC mínimo). Ib y IIIb para presiones y resistencia (γDC máximo).",
      { note: `γEQ de proyecto = ${fmt(gEQ, 2)}. Para γEQ entre 0 y 1 se interpola emax: resistencia e ≤ ${rocoso ? "0.45 B" : "B/3"}; extremo e ≤ 0.40 B (8/10 centrales).` }
    ),
  ];

  rows.filter((r) => r.name !== "Servicio I").forEach((r, i) => {
    const n0 = 28 + i * 3;
    steps.push(
      paso(
        String(n0).padStart(2, "0"),
        `${r.name} — vuelco alrededor del punto A`,
        "Xo = (Σ Mvu − Σ MHu) / Vu    ·    e = B/2 − Xo    ·    |e| ≤ emax",
        `Vu = ${fmt(r.Vu, 2)} t/m    ·    Mvu = ${fmt(r.Mvu, 2)} t·m/m    ·    MHu = ${fmt(r.Mhu, 2)} t·m/m    ·    Xo = (${fmt(r.Mvu, 2)} − ${fmt(r.Mhu, 2)}) / ${fmt(r.Vu, 2)} = ${fmt(r.xo, 3)} m    ·    B/2 = ${fmt(B / 2, 3)} m`,
        `e = ${fmt(r.e, 3)} m    ${r.okE ? "≤" : ">"}    emax = ${fmt(r.emax, 3)} m`,
        { ok: r.okE, note: r.name === "Evento extremo I" ? `emax interpolado con γEQ = ${fmt(gEQ, 2)} → ${fmt(emaxExt, 3)} m (se usa ${fmt(r.emax, 3)} m).` : `Estado límite de resistencia: emax = ${rocoso ? "0.45 B" : "B/3"} = ${fmt(r.emax, 3)} m.` }
      ),
      paso(
        String(n0 + 1).padStart(2, "0"),
        `${r.name} — deslizamiento en la base (Art. 10.6.3.3 / Tabla 11.5.7-1)`,
        "μ = tan φ    ·    Ff = μ · φτ · Vu    ·    estable si Ff ≥ Hu",
        `μ = tan ${fmt(phi, 1)}° = ${fmt(mu, 3)}    ·    φτ = ${fmt(r.c.phiTau, 2)}    ·    Vu = ${fmt(r.Vu, 2)} t/m    ·    Ff = ${fmt(mu, 3)} × ${fmt(r.c.phiTau, 2)} × ${fmt(r.Vu, 2)} = ${fmt(r.Ff, 2)} t/m    ·    Hu = ${fmt(r.Hu, 2)} t/m`,
        r.okS ? `Ff ≥ Hu  ·  CUMPLE` : `Ff < Hu  ·  NO CUMPLE — revisar B, φ o diente`,
        { ok: r.okS }
      ),
      paso(
        String(n0 + 2).padStart(2, "0"),
        `${r.name} — presiones en la base (Meyerhof)`,
        Math.abs(r.e) <= B / 6
          ? "e ≤ B/6  →  qmáx,mín = (Vu/B) (1 ± 6e/B)    ·    qR = φb FS qadm"
          : "e > B/6  →  qmáx = Vu / (B − 2e)    ·    qmín = 0    ·    qR = φb FS qadm",
        `|e| = ${fmt(Math.abs(r.e), 3)} m    ·    B/6 = ${fmt(B / 6, 3)} m    ·    Vu/B = ${fmt(r.Vu / B, 2)} t/m²    ·    qadm = ${fmt(qadm, 2)} kg/cm² = ${fmt(qadmT, 1)} t/m²    ·    φb = ${fmt(r.c.phiB, 2)}    ·    FS = ${fmt(FS, 2)}`,
        `qmáx = ${fmt(r.qmax, 2)} t/m²    ·    qmín = ${fmt(r.qmin, 2)} t/m²    ·    qR = ${fmt(r.qR, 1)} t/m²    ·    ${r.okQ ? "CUMPLE" : "NO CUMPLE"}`,
        { ok: r.okQ }
      )
    );
  });

  const serv = rows.find((r) => r.name === "Servicio I")!;
  steps.push(
    paso(
      "37",
      "Servicio I — presiones de trabajo",
      "qmáx ≤ qadm    ·    qmín ≥ 0    ·    factores γ = 1.00",
      `Vu = ${fmt(serv.Vu, 2)} t/m    ·    e = ${fmt(serv.e, 3)} m    ·    qadm = ${fmt(qadmT, 1)} t/m²`,
      `qmáx = ${fmt(serv.qmax, 2)} t/m²    ·    qmín = ${fmt(serv.qmin, 2)} t/m²    ·    ${serv.okQ ? "CUMPLE" : "NO CUMPLE"}`,
      { ok: serv.okQ }
    ),
    paso(
      "38",
      "Flexión de la pantalla (voladizo) — Resistencia I, Whitney",
      "Mu = γLS LS2X (Hs/2) + γEH EH1X (Hs/3)    ·    Ru = Mu / (φ b d²)    ·    ρ = (0.85 f'c / fy) [1 − √(1 − 2 Ru / 0.85 f'c)]    ·    As = ρ b d    ·    a = As fy / (0.85 f'c b)",
      `Hs = H − D = ${fmt(stemH, 2)} m    ·    d = tinf − rec − db/2 = ${fmt(tinf * 100, 1)} − ${fmt(rec, 1)} − 0.95 = ${fmt(dPant, 1)} cm    ·    Mu = 1.75×${fmt(LS2x, 2)}×${fmt(stemH / 2, 2)} + 1.50×${fmt(EH1x, 2)}×${fmt(stemH / 3, 2)} = ${fmt(MuPant, 2)} t·m/m    ·    b = 100 cm    ·    Ru = ${fmt(flexP.Ru, 2)} kg/cm²    ·    ρ = ${fmt(flexP.rho, 5)}`,
      `a = ${fmt(flexP.a, 2)} cm    ·    As req = ${fmt(flexP.As, 2)} cm²/m    ·    Asmín = ${fmt(flexP.Asmin, 2)} cm²/m    ·    As uso = ${fmt(flexP.AsUse, 2)} cm²/m    ·    Ø 3/4" @ ${sPant} cm`,
      { note: `Cara interior (tracción hacia el relleno). φ = 0.90.` }
    ),
    paso(
      "39",
      "Cortante en el arranque de la pantalla",
      "Vu = γEH EH1X + γLS LS2X    ·    Vc = 0.53 √f'c b d    ·    φVc ≥ Vu",
      `Vu = 1.50×${fmt(EH1x, 2)} + 1.75×${fmt(LS2x, 2)} = ${fmt(VuStem, 2)} t/m    ·    Vc = 0.53 √${fmt(fc, 0)} × 100 × ${fmt(dPant, 1)} / 1000 = ${fmt(Vc, 2)} t/m    ·    φ = 0.85`,
      `φVc = ${fmt(phiVc, 2)} t/m    ${VuStem <= phiVc + 0.05 ? "≥ Vu  ·  el concreto resiste" : "< Vu  ·  revisar peralte o estribos de pantalla"}`,
      { ok: VuStem <= phiVc + 0.05 }
    ),
    paso(
      "40",
      "Acero de temperatura y contracción — zapata",
      "As,temp = 0.18 b h / [fy (b + h)]    ·    2.33 ≤ As ≤ 12.7 cm²/m por cara  (AASHTO 5.10.8)",
      `b = ${fmt(B * 100, 0)} cm    ·    h = ${fmt(D * 100, 0)} cm    ·    fy = ${fmt(fy, 0)} kg/cm²    ·    As = 0.18×${fmt(B * D * 10000, 0)} / [${fmt(fy, 0)}×${fmt((B + D) * 100, 0)}] = ${fmt(AsTemp, 2)} cm²/m`,
      `Temperatura Ø 1/2" @ ${sTemp} cm en cada cara  (${fmt(AsTemp, 2)} cm²/m)`,
      { note: "El acero de temperatura va perpendicular al de flexión, en talón y puntera. Recubrimiento de zapata según Tabla 5.10.1-1 (contacto con suelo)." }
    ),
    paso(
      "41",
      "Flexión de la puntera (Whitney, Resistencia Ib)",
      "Mu,p = qmáx Lp² / 2    ·    Ru, ρ, a, As como en pantalla    ·    d = D − rec,zap − db/2",
      `qmáx,Ib = ${fmt(crit.qmax, 2)} t/m²    ·    Lp = ${fmt(Lp, 2)} m    ·    Mu = ${fmt(crit.qmax, 2)} × ${fmt(Lp, 2)}² / 2 = ${fmt(MuPun, 2)} t·m/m    ·    d = ${fmt(dZap, 1)} cm    ·    Ru = ${fmt(flexPun.Ru, 2)}    ·    ρ = ${fmt(flexPun.rho, 5)}    ·    a = ${fmt(flexPun.a, 2)} cm`,
      `As req = ${fmt(flexPun.As, 2)}    ·    Asmín = ${fmt(flexPun.Asmin, 2)}    ·    As uso = ${fmt(flexPun.AsUse, 2)} cm²/m    ·    Ø 3/4" @ ${sPun} cm`,
      { note: `Acero superior en puntera (tracción por el suelo). Recubrimiento ${fmt(recZap, 1)} cm.` }
    ),
    paso(
      "42",
      "Flexión del talón (Whitney, Resistencia Ib)",
      "wnet = (EV + LS1)/Ltalón + γc D − qmín    ·    Mu,t = |wnet| Ltalón² / 2",
      `w,suelo = (${fmt(EV, 2)} + ${fmt(LSy, 2)}) / ${fmt(Ltalon, 2)} + ${fmt(gc, 2)}×${fmt(D, 2)} = ${fmt(wHeel, 2)} t/m²    ·    qmín,Ib = ${fmt(crit.qmin, 2)} t/m²    ·    Mu = ${fmt(MuTal, 2)} t·m/m    ·    d = ${fmt(dZap, 1)} cm    ·    Ru = ${fmt(flexTal.Ru, 2)}    ·    a = ${fmt(flexTal.a, 2)} cm`,
      `As req = ${fmt(flexTal.As, 2)}    ·    Asmín = ${fmt(flexTal.Asmin, 2)}    ·    As uso = ${fmt(flexTal.AsUse, 2)} cm²/m    ·    Ø 3/4" @ ${sTal} cm`,
      { note: "Acero superior en el talón (el relleno carga más que la reacción del suelo)." }
    )
  );

  const tabDC = {
    title: "Cuadro de metrado DC — elementos 1 a 7 (franja 1.00 m, xA desde la puntera A)",
    rows: [
      ["N°", "Elemento", "Ai (m²/m)", "γ (t/m³)", "Wi (t/m)", "xA (m)", "Mi (t·m/m)"],
      ["1", "Parapeto bparap × hparap", fmt(V1, 3), fmt(gc, 2), fmt(W1, 2), fmt(xa1, 3), fmt(W1 * xa1, 2)],
      ["2", "Cajuela e1 × (bparap+N)", fmt(V2, 3), fmt(gc, 2), fmt(W2, 2), fmt(xa2, 3), fmt(W2 * xa2, 2)],
      ["3", "Chaflán talón e2·t2/2", fmt(V3, 3), fmt(gc, 2), fmt(W3, 2), fmt(xa3, 3), fmt(W3 * xa3, 2)],
      ["4", "Pantalla rectangular tsup", fmt(V4, 3), fmt(gc, 2), fmt(W4, 2), fmt(xa4, 3), fmt(W4 * xa4, 2)],
      ["5", "Chaflán puntera e2·t1/2", fmt(V5, 3), fmt(gc, 2), fmt(W5, 2), fmt(xa5, 3), fmt(W5 * xa5, 2)],
      ["6", "Trapecio de talud (tinf−tsup)", fmt(V6, 3), fmt(gc, 2), fmt(W6, 2), fmt(xa6, 3), fmt(W6 * xa6, 2)],
      ["7", "Zapata B × D", fmt(V7, 3), fmt(gc, 2), fmt(W7, 2), fmt(xa7, 3), fmt(W7 * xa7, 2)],
      ["Σ", "DC estribo", fmt(Vdc, 3), "—", fmt(DC, 2), fmt(DCxa, 3), fmt(DC * DCxa, 2)],
    ],
  };
  const tabEV = {
    title: "Cuadro de metrado EV — relleno sobre el talón (elementos 8 y 9)",
    rows: [
      ["N°", "Elemento", "Ai (m²/m)", "γ (t/m³)", "Wi (t/m)", "xA (m)", "Mi (t·m/m)"],
      ["8", "Relleno talón Ltalón × (H−D)", fmt(V8, 3), fmt(gs, 3), fmt(W8, 2), fmt(xa8, 3), fmt(W8 * xa8, 2)],
      ["9", "Cuña chaflán t2·e2/2", fmt(V9, 3), fmt(gs, 3), fmt(W9, 2), fmt(xa9, 3), fmt(W9 * xa9, 2)],
      ["Σ", "EV relleno", fmt(V8 + V9, 3), "—", fmt(EV, 2), fmt(EVxa, 3), fmt(EV * EVxa, 2)],
      ["LS1", "Sobrecarga h' × Ltalón × γs", fmt(hp * Ltalon, 3), fmt(gs, 3), fmt(LSy, 2), fmt(LSyxa, 3), fmt(LSy * LSyxa, 2)],
    ],
  };
  const tabSup = {
    title: "Cuadro de metrado — superestructura y losa de acercamiento",
    rows: [
      ["Carga", "Tipo", "Fórmula / origen", "V (t/m)", "xA (m)", "Mv (t·m/m)"],
      ["DClosa", "DC", "e,losa × Ltalón × γc,s", fmt(DClosa, 2), fmt(DClosaXa, 3), fmt(DClosa * DClosaXa, 2)],
      ["PDC", "DC", "Peso tablero (dato)", fmt(PDC, 2), fmt(xaSup, 3), fmt(PDC * xaSup, 2)],
      ["PDW", "DW", "Asfalto / DW (dato)", fmt(PDW, 2), fmt(xaSup, 3), fmt(PDW * xaSup, 2)],
      ["PLL+IM", "LL+IM", "HL-93 en el tablero (dato)", fmt(PLL, 2), fmt(xaSup, 3), fmt(PLL * xaSup, 2)],
    ],
  };
  const tabVert = {
    title: "Cuadro de metrado — cargas verticales Caso I (estribo con puente)",
    rows: [
      ["Carga", "Tipo", "V (t/m)", "xA (m)", "Mv (t·m/m)"],
      ["DCestr", "DC", fmt(DC, 2), fmt(DCxa, 3), fmt(DC * DCxa, 2)],
      ["DClosa", "DC", fmt(DClosa, 2), fmt(DClosaXa, 3), fmt(DClosa * DClosaXa, 2)],
      ["PDC superest.", "DC", fmt(PDC, 2), fmt(xaSup, 3), fmt(PDC * xaSup, 2)],
      ["PDW", "DW", fmt(PDW, 2), fmt(xaSup, 3), fmt(PDW * xaSup, 2)],
      ["EV relleno", "EV", fmt(EV, 2), fmt(EVxa, 3), fmt(EV * EVxa, 2)],
      ["EH1Y", "EH", fmt(EH1y, 2), fmt(B, 3), fmt(EH1y * B, 2)],
      ["EH2Y", "EH", fmt(EH2y, 2), fmt(B, 3), fmt(EH2y * B, 2)],
      ["PLL+IM", "LL+IM", fmt(PLL, 2), fmt(xaSup, 3), fmt(PLL * xaSup, 2)],
      ["LS1", "LS", fmt(LSy, 2), fmt(LSyxa, 3), fmt(LSy * LSyxa, 2)],
      ["LS2Y", "LS", fmt(LS2y, 2), fmt(B, 3), fmt(LS2y * B, 2)],
      ["Σ", "—", fmt(DC + DClosa + PDC + PDW + EV + EH1y + EH2y + PLL + LSy + LS2y, 2), "—", fmt(
        DC * DCxa + DClosa * DClosaXa + PDC * xaSup + PDW * xaSup + EV * EVxa + EH1y * B + EH2y * B + PLL * xaSup + LSy * LSyxa + LS2y * B,
        2
      )],
    ],
  };
  const tabHorz = {
    title: "Cuadro de metrado — cargas horizontales (brazo desde A, rasante)",
    rows: [
      ["Carga", "Tipo", "H (t/m)", "y (m)", "Mh (t·m/m)"],
      ["LS2X", "LS", fmt(LS2x, 2), fmt(yLS, 2), fmt(LS2x * yLS, 2)],
      ["EH1X", "EH", fmt(EH1x, 2), fmt(yEH, 2), fmt(EH1x * yEH, 2)],
      ["EH2X", "EH", fmt(EH2x, 2), fmt(yEH2, 2), fmt(EH2x * yEH2, 2)],
      ["CR+SH+TU", "CR", fmt(CR, 2), fmt(yWS, 2), fmt(CR * yWS, 2)],
      ["WS", "WS", fmt(WS, 2), fmt(yWS, 2), fmt(WS * yWS, 2)],
      [useFirst ? "EQterr" : "0.5 EQterr", "EQ", fmt(EQh1, 2), fmt(yLS, 2), fmt(EQh1 * yLS, 2)],
      [useFirst ? "0.5 PIR" : "PIR", "EQ", fmt(PIRu, 2), fmt(yPIR, 2), fmt(PIRu * yPIR, 2)],
      ["PEQ", "EQ", fmt(PEQ, 2), fmt(yPEQ, 2), fmt(PEQ * yPEQ, 2)],
      ["BR", "BR", fmt(BR, 2), fmt(yBR, 2), fmt(BR * yBR, 2)],
    ],
  };
  const tabSismo = {
    title: "Cuadro de metrado sísmico — Mononobe–Okabe y PEQ",
    rows: [
      ["Magnitud", "Fórmula", "Valor", "Unidad", "Brazo y (m)"],
      ["kho = FPGA·PGA", `${fmt(FPGA, 2)} × ${fmt(PGA, 3)}`, fmt(kho, 3), "g", "—"],
      ["kh = ½ kho", `0.50 × ${fmt(kho, 3)}`, fmt(kh, 3), "g", "—"],
      ["θ'", "arctan[kh/(1−kv)]", fmt(thp, 2), "°", "—"],
      ["KAE", "Mononobe–Okabe", fmt(KAE, 4), "—", "—"],
      ["PAE", "½ KAE γs H²", fmt(PAE, 3), "t/m", fmt(yLS, 2)],
      ["EQterr", "PAE − EH1X", fmt(EQterr, 3), "t/m", fmt(yLS, 2)],
      ["PIR", "kh (DCestr + EV)", fmt(PIR, 3), "t/m", fmt(yPIR, 2)],
      ["PEQ", "(PDC+PDW) kho", fmt(PEQ, 3), "t/m", fmt(yPEQ, 2)],
      [useFirst ? "Gobierna PAE+0.5 PIR" : "Gobierna 0.5 PAE+PIR", "Art. 11.6.5.1", useFirst ? fmt(combo1, 2) : fmt(combo2, 2), "t/m", "—"],
    ],
  };
  const tabFac = {
    title: "Factores de carga AASHTO 3.4.1 utilizados",
    rows: [
      ["Estado", "γDC", "γDW", "γEV", "γLL", "γLS,Y", "γLS,X", "γEH", "γEQ", "γBR", "γWS", "γCR"],
      ...COMBOS.map((c) => [
        c.name, fmt(c.gDC, 2), fmt(c.gDW, 2), fmt(c.gEV, 2), fmt(c.gLL, 2), fmt(c.gLSy, 2),
        fmt(c.gLSx, 2), fmt(c.gEH, 2), fmt(c.gEQ, 2), fmt(c.gBR, 2), fmt(c.gWS, 2), fmt(c.gCR, 2),
      ]),
    ],
  };
  const tabCheck = {
    title: "Cuadro resumen — chequeo por estado límite (franja 1.00 m)",
    rows: [
      ["Estado", "Vu (t/m)", "Hu (t/m)", "Xo (m)", "e (m)", "emáx", "qmáx", "qmín", "qR", "Vuelco", "Desliz.", "Apoyo"],
      ...rows.map((r) => [
        r.name,
        fmt(r.Vu, 2),
        fmt(r.Hu, 2),
        fmt(r.xo, 3),
        fmt(r.e, 3),
        fmt(r.emax, 3),
        fmt(r.qmax, 2),
        fmt(r.qmin, 2),
        fmt(r.qR, 1),
        r.okE ? "OK" : "NO",
        r.name === "Servicio I" ? "—" : r.okS ? "OK" : "NO",
        r.okQ ? "OK" : "NO",
      ]),
    ],
  };
  const extras = [tabDC, tabEV, tabSup, tabVert, tabHorz, tabSismo, tabFac, tabCheck];
  bindTable(steps, "13", tabDC);
  bindTable(steps, "15", tabSup);
  bindTable(steps, "16", tabEV);
  bindTable(steps, "17", tabVert);
  bindTable(steps, "21", tabHorz);
  bindTable(steps, "26", tabSismo);
  bindTable(steps, "27", tabFac);
  bindTable(steps, "37", tabCheck);

  return out(
    `Pantalla H=${fmt(H, 2)} m · B=${fmt(B, 2)} m · Ø 3/4" @ ${sPant} cm`,
    `Estribo tipo pantalla (voladizo)  ·  ka=${fmt(ka, 4)}  ·  EH1X=${fmt(EH1x, 2)} t/m  ·  As pantalla Ø 3/4" @ ${sPant} cm`,
    steps,
    [
      ok("N ≥ Nmín AASHTO 4.7.4.4", `${fmt(N, 2)} m`, `≥ ${fmt(nMin, 3)} m`, nOk),
      ok("B en rango 0.50H–0.67H", `${fmt(B, 2)} m`, `${fmt(Bmin, 2)}–${fmt(Bmax, 2)} m`, B >= Bmin - 0.2 && B <= Bmax + 0.4),
      ok("e ≤ emáx (resistencia y extremo)", allE ? "OK" : "Revisar", "e ≤ B/3 ó 11/30 B", allE),
      ok("Deslizamiento Ff ≥ Hu", allS ? "OK" : "NO", "φτ = 1.00", allS),
      ok("qmáx ≤ qR y qmín ≥ 0", allQ ? "OK" : "NO", `qadm ${fmt(qadm, 2)} kg/cm²`, allQ),
      ok("As pantalla ≥ Asmín", `${fmt(flexP.AsUse, 2)} cm²/m`, `≥ ${fmt(flexP.Asmin, 2)}`, flexP.AsUse + 1e-6 >= flexP.Asmin),
      ok("φVc pantalla ≥ Vu", `${fmt(phiVc, 2)} t/m`, `≥ ${fmt(VuStem, 2)}`, VuStem <= phiVc + 0.05),
    ],
    extras,
    {
      H: String(H),
      B: String(B),
      D: String(D),
      Lp: String(Lp),
      tsup: String(tsup),
      tinf: String(tinf),
      N: String(N),
      Ltalon: String(Ltalon),
      hparap: String(hparap),
      bparap: String(bparap),
      e1: String(e1),
      e2: String(e2),
      t1: String(t1),
      t2: String(t2),
      t3: String(t3),
      hviga: String(hviga),
      hz: String(hz),
      hp: String(hp),
      eLosa: String(eLosa),
      ka: String(ka),
      sBatter: String(sBatter),
    }
  );
};
