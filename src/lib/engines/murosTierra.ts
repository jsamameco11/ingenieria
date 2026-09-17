import {
  type CalcCheck,
  type CalcOutput,
  type CalcStep,
  type Engine,
  barByName,
  beta1,
  fmt,
  num,
  rad,
  spacingFor,
  str,
} from "../types";
import { layoutMuroVoladizo } from "../metradoZonas";
import { deflexionPantallaVoladizo, snapEspesor5cm } from "../deflexion";

function out(
  headline: string,
  adoption: string,
  steps: CalcStep[],
  checks: CalcCheck[],
  extras?: CalcOutput["extras"],
  dims?: Record<string, string>
): CalcOutput {
  return { headline, adoption, steps, checks, extras, dims };
}
function ok(label: string, value: string, limit: string, pass: boolean): CalcCheck {
  return { label, value, limit, ok: pass };
}

const PI = Math.PI;

function kaRankine(phi: number) {
  return Math.tan(rad(45 - phi / 2)) ** 2;
}
function kpRankine(phi: number) {
  return Math.tan(rad(45 + phi / 2)) ** 2;
}
function NqTerzaghi(phi: number) {
  return Math.tan(rad(45 + phi / 2)) ** 2 * Math.exp(PI * Math.tan(rad(phi)));
}
function NcTerzaghi(phi: number, Nq: number) {
  if (Math.abs(phi) < 1e-9) return 5.7;
  return ((Nq - 1) / Math.tan(rad(phi)));
}
function NgTerzaghi(phi: number, Nq: number) {
  return 2 * (Nq + 1) * Math.tan(rad(phi));
}

function snapSpacing(sMax: number) {
  const opts = [25, 20, 15, 12, 10, 8];
  return opts.find((x) => x <= sMax + 1e-9) ?? 8;
}

/**
 * Coeficiente sísmico de empuje activo de Mononobe–Okabe (extensión pseudo-estática de Coulomb),
 * para un muro de cara vertical (i=90°) con fricción muro–suelo δ y relleno con talud β.
 * Devuelve también el ángulo de inercia θ=atan(Kh/(1−Kv)), usado para acotar β<φ−θ (backslope
 * admisible bajo el sismo de diseño).
 */
function kaeMononobeOkabe(phi: number, delta: number, beta: number, Kh: number, Kv: number) {
  const theta = (Math.atan(Kh / Math.max(1e-9, 1 - Kv)) * 180) / PI;
  const iMuro = 90;
  const phiD = phi - theta;
  const numKae = Math.sin(rad(phi + delta - theta)) ** 2;
  const denKae =
    Math.cos(rad(theta)) ** 2 *
    Math.sin(rad(iMuro)) ** 2 *
    Math.sin(rad(iMuro + delta)) *
    (1 +
      Math.sqrt(
        Math.max(
          0,
          (Math.sin(rad(phi + delta)) * Math.sin(rad(phiD - beta))) /
            Math.max(1e-9, Math.sin(rad(iMuro + delta)) * Math.sin(rad(iMuro + beta)))
        )
      )) ** 2;
  const Kae = denKae > 1e-12 ? numKae / denKae : kaRankine(phi) * 1.3;
  return { Kae, theta, phiD };
}

/** Diseño de franja de 1.00 m (E.060) para pantalla, punta o talón. */
export function designFranja(p: {
  h_m: number;
  rec_cm: number;
  Mu: number;
  Vu: number;
  fc: number;
  fy: number;
  barName?: string;
}) {
  const bar = barByName(p.barName ?? '5/8"');
  const h = Math.max(p.h_m * 100, 8);
  const d = Math.max(h - p.rec_cm - 0.95 - bar.db / 2, 4);
  const b = 100;
  const phiF = 0.9;
  const phiV = 0.85;
  const Rn = (p.Mu * 100000) / Math.max(1e-9, phiF * b * d * d);
  const disc = Math.max(0, 1 - (2 * Rn) / (0.85 * p.fc));
  const rho = (0.85 * p.fc / p.fy) * (1 - Math.sqrt(disc));
  const rhoMin = Math.max(0.0012, 0.8 * Math.sqrt(p.fc) / p.fy, 14 / p.fy);
  const rhoB = (0.85 * beta1(p.fc) * p.fc / p.fy) * (6300 / (6300 + p.fy));
  const rhoMax = 0.75 * rhoB;
  const rhoUse = Math.min(Math.max(rho, rhoMin), Math.max(rhoMax, rhoMin));
  const As = rhoUse * b * d;
  const a = (As * p.fy) / (0.85 * p.fc * b);
  const phiMn = (phiF * As * p.fy * (d - a / 2)) / 100000;
  const sCalc = spacingFor(As, bar.as, 100);
  const s = snapSpacing(sCalc);
  const AsProv = (bar.as / s) * 100;
  const Vc = (0.53 * Math.sqrt(p.fc) * b * d) / 1000;
  const phiVc = phiV * Vc;
  return {
    h,
    d,
    bar,
    Rn,
    rho,
    rhoMin,
    rhoMax,
    rhoUse,
    As,
    AsProv,
    a,
    phiMn,
    s,
    Vc,
    phiVc,
    okM: phiMn + 0.01 >= p.Mu,
    okV: phiVc + 0.01 >= p.Vu,
    okRho: rhoUse <= rhoMax + 1e-9,
    text: `Ø ${bar.name} @ ${s} cm`,
  };
}

/* ═══════════════════════════════════════════════════════════════
   MURO DE CONTENCIÓN — sobrecarga + sismo (Mononobe–Okabe)
   Estabilidad + diseño E.060 de alma, punta (pata) y talón
   ═══════════════════════════════════════════════════════════════ */
export const muroContencionSismo: Engine = (raw) => {
  const H = num(raw, "H", 4);
  const hSat = num(raw, "hSat", 2);
  const D = num(raw, "D", 0.8);
  const A = num(raw, "A", 2);
  const Fuser = num(raw, "F", 0.4);
  const BpUser = num(raw, "Bp", 0.2);
  const C = num(raw, "C", 1.2);
  const esp = num(raw, "esp", 0.4);
  const beta = num(raw, "beta", 10);
  const gammaRelleno = num(raw, "gammaRelleno", 1.8);
  const gammaConc = num(raw, "gammaConc", 2.5);
  const gammaSat = num(raw, "gammaSat", 2.0);
  const gammaW = num(raw, "gammaW", 1.0);
  const c = num(raw, "c", 0);
  const phi = num(raw, "phi", 32);
  const phiBase = num(raw, "phiBase", 2);
  const cohesBase = num(raw, "cohesBase", 1);
  const Kh = num(raw, "Kh", 0.3);
  const Kv = num(raw, "Kv", Kh * 0.7);
  const qFranja = num(raw, "qFranja", 40);
  const aFranja = num(raw, "aFranja", 2);
  const bFranja = num(raw, "bFranja", 1);
  const FS_desl = num(raw, "FSdesl", 1.5);
  const FS_volt = num(raw, "FSvolt", 2.0);
  const FS_cap = num(raw, "FScap", 2.0);
  const FS_deslSis = num(raw, "FSdeslSis", 1.1);
  const FS_voltSis = num(raw, "FSvoltSis", 1.5);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const rec = num(raw, "rec", 5);
  const recZap = num(raw, "recZap", 7.5);

  const Hs = Math.max(0.05, H - esp);
  const Ka = kaRankine(phi);
  const Kp = kpRankine(phi);
  const delta = phi * 2 / 3;

  function estadoDe(F: number, Bp: number, hk = 0) {
  const BpUse = Math.min(Math.max(0.12, Bp), Math.max(0.12, F - 0.05));
  const B1 = Math.max(0, (F - BpUse) / 2);
  const Ap = A + B1;
  const hCuna = Ap * Math.tan(rad(beta));
  const B = A + C + F;
  const Hact = H + hCuna;
  const hkUse = Math.max(0, hk);
  const bkUse = hkUse > 0.02 ? Math.min(F, Math.max(0.3, F)) : 0;

  const A_rell = A * Hs + B1 * Hs * 0.5 + Ap * hCuna;
  const A_alma = BpUse * Hs + B1 * Hs;
  const A_punta = Math.max(0, D - esp) * C;
  const A_base = B * esp;
  const A_key = bkUse * hkUse;
  const Wrelleno = A_rell * gammaRelleno;
  const Wpunta = A_punta * gammaRelleno;
  const Wbase = A_base * gammaConc;
  const Walma = A_alma * gammaConc;
  const Wkey = A_key * gammaConc;
  const Pa = Math.max(0, 0.5 * Hact ** 2 * Ka * gammaRelleno - 2 * c * Hact * Math.sqrt(Math.max(Ka, 0)));
  const Pw = 0.5 * hSat ** 2 * gammaW;
  const PaV = Pa * Math.sin(rad(beta));
  const Wtot = Wrelleno + Wpunta + Wbase + Walma + Wkey + PaV;

  const xRell = C + F + (A * Hs * (A / 2) + B1 * Hs * 0.5 * (A + B1 / 3) + Ap * hCuna * (Ap / 2)) / Math.max(A_rell, 1e-9);
  const xPunta = C / 2;
  const xBase = B / 2;
  const xAlma = C + F / 2;
  const xKey = C + bkUse / 2;
  const xPaV = B;
  const yRell = esp + (Hs + hCuna) / 2;
  const yPunta = esp + Math.max(0, D - esp) / 2;
  const yBase = esp / 2;
  const yAlma = esp + Hs / 2;
  const yW = (Wrelleno * yRell + Wpunta * yPunta + Wbase * yBase + Walma * yAlma + Wkey * 0) / Math.max(Wtot - PaV, 1e-9);

  const MrRell = Wrelleno * xRell;
  const MrPunta = Wpunta * xPunta;
  const MrBase = Wbase * xBase;
  const MrAlma = Walma * xAlma;
  const MrKey = Wkey * xKey;
  const MrPaV = PaV * xPaV;
  const Mr = MrRell + MrPunta + MrBase + MrAlma + MrKey + MrPaV;
  const yPa = Hact / 3;
  const yPw = hSat / 3;
  const MaPa = Pa * yPa;
  const MaPw = Pw * yPw;
  const Ma = MaPa + MaPw;
  const FSv = Mr / Math.max(1e-9, Ma);

  const resistFric = Wtot * Math.tan(rad(phiBase));
  const resistC = cohesBase * B;
  const Dpas = D + hkUse;
  const pasivo = 0.5 * Dpas ** 2 * Kp * gammaSat;
  const HactSt = Pa + Pw;
  const FSd = (resistC + resistFric + pasivo) / Math.max(1e-9, HactSt);

  const xBar = (Mr - Ma) / Math.max(1e-9, Wtot);
  const e = B / 2 - xBar;
  const eLim = B / 6;
  const eAbs = Math.abs(e);
  const nucleo = eAbs <= eLim + 1e-6;
  let qToe = (Wtot / B) * (1 + (6 * e) / B);
  let qHeel = (Wtot / B) * (1 - (6 * e) / B);
  let Lcontact = B;
  if (qHeel < 0 || qToe < 0) {
    Lcontact = Math.min(B, Math.max(0.15, 3 * (B / 2 - eAbs)));
    const qPeak = (2 * Wtot) / Lcontact;
    if (e >= 0) {
      qToe = qPeak;
      qHeel = 0;
    } else {
      qHeel = qPeak;
      qToe = 0;
    }
  }
  const qMax = Math.max(qToe, qHeel);

  const Nq = NqTerzaghi(phiBase);
  const Nc = NcTerzaghi(phiBase, Nq);
  const Ng = NgTerzaghi(phiBase, Nq);
  const qu = cohesBase * Nc + gammaRelleno * Dpas * Nq + 0.5 * gammaRelleno * B * Ng;
  const qa = qu / Math.max(FS_cap, 1e-9);
  const FSc = qu / Math.max(1e-9, qMax);

  const { Kae, theta } = kaeMononobeOkabe(phi, delta, beta, Kh, Kv);
  const Pae = 0.5 * gammaSat * H * H * (1 - Kv) * Kae;
  const dPae = Math.max(0, Pae - Pa);
  const yPae = 0.6 * H;

  const z = Math.max(0.5, H / 3);
  const eta1 = (Math.asin(Math.min(1, bFranja / Math.hypot(z, bFranja))) * 180) / PI;
  const eta2 = (Math.asin(Math.min(1, (bFranja + aFranja) / Math.hypot(z, bFranja + aFranja))) * 180) / PI;
  const dEta = eta2 - eta1;
  const sigmaQ = ((2 * qFranja) / PI) * ((dEta * PI) / 180 - Math.sin(rad(dEta)) * Math.cos(rad(eta1 + eta2)));
  const Pq = Math.max(0, sigmaQ) * H * 0.5;
  const yPq = H / 2;

  const PIR = Kh * Wtot;
  const Veq = Wtot * (1 - Kv);
  const resistFricEq = Veq * Math.tan(rad(phiBase));
  const HactEq = Pa + Pw + dPae + Pq + PIR;
  const FSdEq = (resistC + resistFricEq + 0.5 * pasivo) / Math.max(1e-9, HactEq);
  const MaEq = Ma + dPae * yPae + Pq * yPq + PIR * yW;
  const MrEq = MrRell * (1 - Kv) + MrPunta * (1 - Kv) + MrBase * (1 - Kv) + MrAlma * (1 - Kv) + MrPaV;
  const FSvEq = MrEq / Math.max(1e-9, MaEq);

  const qAt = (x: number) => qToe + (qHeel - qToe) * (x / Math.max(B, 1e-9));
  const qStemF = qAt(C);
  const qStemB = qAt(C + F);

  const PaStem = Math.max(0, 0.5 * Ka * gammaRelleno * Hs ** 2 - 2 * c * Hs * Math.sqrt(Math.max(Ka, 0)));
  const hwStem = Math.max(0, Math.min(Hs, hSat - esp));
  const PwStem = 0.5 * hwStem ** 2 * gammaW;
  const dPaeStem = dPae * (Hs / Math.max(H, 1e-9));
  const PqStem = Pq * (Hs / Math.max(H, 1e-9));
  const MsStemSt = PaStem * (Hs / 3) + PwStem * (hwStem / 3) + PqStem * (Hs / 2);
  const MsStemEq = MsStemSt + dPaeStem * (0.6 * Hs);
  const VsStemSt = PaStem + PwStem + PqStem;
  const VsStemEq = VsStemSt + dPaeStem;
  const MuStem = Math.max(1.7 * MsStemSt, 1.0 * MsStemEq);
  const VuStem = Math.max(1.7 * VsStemSt, 1.0 * VsStemEq);
  const alma = designFranja({ h_m: F, rec_cm: rec, Mu: MuStem, Vu: VuStem, fc, fy });
  const AsTemp = 0.002 * 100 * (F * 100);
  const barH = barByName('3/8"');
  const sTemp = snapSpacing(spacingFor(AsTemp, barH.as, 100));
  const AsIntra = 0.0012 * 100 * (F * 100) * 0.5;
  const barIntra = barByName('3/8"');
  const sIntra = snapSpacing(spacingFor(AsIntra, barIntra.as, 100));
  const AsZapDist = 0.0012 * 100 * (esp * 100);
  const sZapDist = snapSpacing(spacingFor(AsZapDist, barH.as, 100));

  const defx = deflexionPantallaVoladizo({
    Hs,
    F,
    Bp: BpUse,
    fc,
    d_cm: alma.d,
    AsProv_cm2m: alma.AsProv,
    Ka,
    gammaRelleno,
    c,
    hwStem,
    gammaW,
    PqStem,
    MaServ: MsStemSt,
  });

  return {
    F,
    Bp: BpUse,
    hk: hkUse,
    bk: bkUse,
    A_key,
    Wkey,
    xKey,
    MrKey,
    Dpas,
    B1,
    Ap,
    hCuna,
    B,
    Hact,
    A_rell,
    A_alma,
    A_punta,
    A_base,
    Wrelleno,
    Wpunta,
    Wbase,
    Walma,
    Pa,
    Pw,
    PaV,
    Wtot,
    xRell,
    xPunta,
    xBase,
    xAlma,
    xPaV,
    yRell,
    yPunta,
    yBase,
    yAlma,
    yW,
    MrRell,
    MrPunta,
    MrBase,
    MrAlma,
    MrPaV,
    Mr,
    yPa,
    yPw,
    MaPa,
    MaPw,
    Ma,
    FSv,
    resistFric,
    resistC,
    pasivo,
    HactSt,
    FSd,
    xBar,
    e,
    eLim,
    eAbs,
    nucleo,
    qToe,
    qHeel,
    Lcontact,
    qMax,
    Nq,
    Nc,
    Ng,
    qu,
    qa,
    FSc,
    Kae,
    theta,
    Pae,
    dPae,
    yPae,
    z,
    eta1,
    eta2,
    dEta,
    sigmaQ,
    Pq,
    yPq,
    PIR,
    Veq,
    resistFricEq,
    HactEq,
    FSdEq,
    MaEq,
    MrEq,
    FSvEq,
    qStemF,
    qStemB,
    PaStem,
    hwStem,
    PwStem,
    dPaeStem,
    PqStem,
    MsStemSt,
    MsStemEq,
    VsStemSt,
    VsStemEq,
    MuStem,
    VuStem,
    alma,
    AsTemp,
    barH,
    sTemp,
    AsIntra,
    barIntra,
    sIntra,
    AsZapDist,
    sZapDist,
    dAlma_m: alma.d / 100,
    AsAlma_m2: alma.AsProv / 10000,
    ...defx,
  };
  }

  const Fmax = Math.min(1.2, Math.max(0.85, snapEspesor5cm(Hs / 4)));
  const ensayos: { F: number; delta: number; adm: number; ok: boolean }[] = [];
  let st = estadoDe(Fuser, BpUser);
  for (let i = 0; i < 20; i++) {
    ensayos.push({ F: st.F, delta: st.deltaAlma_cm, adm: st.deltaAdmAlma_cm, ok: st.okDeflexionAlma });
    if (st.okDeflexionAlma) break;
    const scale = Math.pow(st.deltaAlma_cm / Math.max(st.deltaAdmAlma_cm * 0.98, 0.05), 1 / 3);
    const next = Math.min(Fmax, snapEspesor5cm(Math.max(st.F + 0.05, st.F * scale)));
    if (next <= st.F + 1e-12) break;
    st = estadoDe(next, Math.min(BpUser, next - 0.05));
  }

  const FSdSinDentellon = st.FSd;
  const FSdEqSinDentellon = st.FSdEq;
  const pasivoSin = 0.5 * D ** 2 * Kp * gammaSat;
  const deslizaSin = st.FSd + 1e-9 < FS_desl || st.FSdEq + 1e-9 < FS_deslSis;
  const hkPre = Math.max(0.3, snapEspesor5cm(esp));
  const ensayosDentellon: { hk: number; FSd: number; FSdEq: number; ok: boolean }[] = [];
  if (deslizaSin) {
    const hkMax = 0.9;
    for (let htry = hkPre; htry <= hkMax + 1e-9; htry = Math.round((htry + 0.05) * 100) / 100) {
      st = estadoDe(st.F, st.Bp, htry);
      const okKey = st.FSd + 1e-9 >= FS_desl && st.FSdEq + 1e-9 >= FS_deslSis;
      ensayosDentellon.push({ hk: htry, FSd: st.FSd, FSdEq: st.FSdEq, ok: okKey });
      if (okKey) break;
    }
  }

  const {
    F,
    Bp,
    hk,
    bk,
    A_key,
    Wkey,
    xKey,
    MrKey,
    Dpas,
    B1,
    Ap,
    hCuna,
    B,
    Hact,
    A_rell,
    A_alma,
    A_punta,
    A_base,
    Wrelleno,
    Wpunta,
    Wbase,
    Walma,
    Pa,
    Pw,
    PaV,
    Wtot,
    xRell,
    xPunta,
    xBase,
    xAlma,
    xPaV,
    yW,
    MrRell,
    MrPunta,
    MrBase,
    MrAlma,
    MrPaV,
    Mr,
    yPa,
    yPw,
    MaPa,
    MaPw,
    Ma,
    FSv,
    resistFric,
    resistC,
    pasivo,
    HactSt,
    FSd,
    xBar,
    e,
    eLim,
    eAbs,
    nucleo,
    qToe,
    qHeel,
    Lcontact,
    qMax,
    Nq,
    Nc,
    Ng,
    qu,
    qa,
    FSc,
    Kae,
    theta,
    Pae,
    dPae,
    yPae,
    z,
    eta1,
    eta2,
    dEta,
    sigmaQ,
    Pq,
    PIR,
    Veq,
    resistFricEq,
    HactEq,
    FSdEq,
    MaEq,
    MrEq,
    FSvEq,
    qStemF,
    qStemB,
    PaStem,
    hwStem,
    PwStem,
    dPaeStem,
    PqStem,
    MsStemSt,
    MsStemEq,
    MuStem,
    VuStem,
    alma,
    AsTemp,
    barH,
    sTemp,
    AsIntra,
    barIntra,
    sIntra,
    AsZapDist,
    sZapDist,
    dAlma_m,
    AsAlma_m2,
    Ec_kgcm2,
    Ec,
    nModular,
    fr_kgcm2,
    Ig0,
    Mcr0,
    Icr0,
    cNA,
    Ie0,
    IeRatio,
    MaServ,
    agrietada,
    deltaAlma_cm,
    deltaAdmAlma_cm,
    okDeflexionAlma,
  } = st;
  const Fajustado = Math.abs(F - Fuser) > 0.02;

  const MupToe = qToe * (C ** 2) / 3 + qStemF * (C ** 2) / 6;
  const VupToe = ((qToe + qStemF) / 2) * C;
  const WslabToe = C * esp * gammaConc;
  const WsoilToe = Wpunta;
  const MdnToe = (WslabToe + WsoilToe) * (C / 2);
  const VdnToe = WslabToe + WsoilToe;
  const MsToe = Math.max(0, MupToe - MdnToe);
  const VsToe = Math.max(0, VupToe - VdnToe);
  const MuToe = 1.4 * MsToe;
  const VuToe = 1.4 * VsToe;
  const dZap_m = Math.max(0.05, esp - recZap / 100 - 0.02);
  const VuToe_d = Math.max(0, VuToe * Math.max(0, C - dZap_m) / Math.max(C, 1e-9));
  const pata = designFranja({ h_m: esp, rec_cm: recZap, Mu: MuToe, Vu: VuToe_d, fc, fy });

  const hFillHeel = Hs + hCuna * 0.5;
  const wFillHeel = gammaRelleno * hFillHeel;
  const wSlabHeel = gammaConc * esp;
  const MdnHeel = (wFillHeel + wSlabHeel) * (A ** 2) / 2;
  const VdnHeel = (wFillHeel + wSlabHeel) * A;
  const MupHeel = qHeel * (A ** 2) / 3 + qStemB * (A ** 2) / 6;
  const VupHeel = ((qHeel + qStemB) / 2) * A;
  const MsHeel = Math.max(0, MdnHeel - MupHeel);
  const VsHeel = Math.max(0, VdnHeel - VupHeel);
  const MuHeel = 1.4 * MsHeel;
  const VuHeel = 1.4 * VsHeel;
  const VuHeel_d = Math.max(0, VuHeel * Math.max(0, A - dZap_m) / Math.max(A, 1e-9));
  const talon = designFranja({ h_m: esp, rec_cm: recZap, Mu: MuHeel, Vu: VuHeel_d, fc, fy });

  const ld = (0.075 * fy * alma.bar.db) / Math.max(Math.sqrt(fc), 1);
  const okEspAlma = F * 100 >= alma.d + rec + 2;
  const okEspZap = esp * 100 >= Math.max(pata.d, talon.d) + recZap + 2;
  const PpKey = Math.max(0, pasivo - pasivoSin);
  const MuKey = 1.4 * PpKey * (Math.max(hk, 0.01) / 2);
  const VuKey = 1.4 * PpKey;
  const llave = designFranja({ h_m: Math.max(bk, hkPre), rec_cm: recZap, Mu: MuKey, Vu: VuKey, fc, fy });
  const okDentellonEst = !deslizaSin || (FSd + 1e-9 >= FS_desl && FSdEq + 1e-9 >= FS_deslSis);
  const okDentellonSec = hk < 0.02 || (llave.okM && llave.okV);

  const steps: CalcStep[] = [
    {
      n: "01",
      title: "Geometría del muro y de la cimentación",
      formula: "B = C + F + A    ·    Hs = H − e    ·    B1 = (F − B′)/2    ·    h''' = (A+B1)·tan β",
      formulaTex: String.raw`B=C+F+A\qquad H_s=H-e\qquad B_1=\dfrac{F-B'}{2}\qquad h'''=(A+B_1)\tan\beta`,
      substitution: `H=${fmt(H, 2)} · e=${fmt(esp, 2)} · A=${fmt(A, 2)} · C=${fmt(C, 2)} · F ensayo=${fmt(Fuser, 2)} · F adoptado=${fmt(F, 2)} · B′=${fmt(Bp, 2)} · D=${fmt(D, 2)} m${hk > 0.02 ? ` · dentellón ${fmt(bk, 2)}×${fmt(hk, 2)} m` : ""}`,
      result: `B = ${fmt(B, 2)} m    ·    Hs = ${fmt(Hs, 2)} m    ·    F = ${fmt(F, 2)} m    ·    B′ = ${fmt(Bp, 2)} m    ·    B1 = ${fmt(B1, 2)} m${hk > 0.02 ? `    ·    dentellón ${fmt(bk, 2)} × ${fmt(hk, 2)} m` : ""}`,
      desarrollo: [
        "El muro es en voladizo: alma (fuste) con talud en ambas caras, zapata corrida de 1.00 m de franja, puntera hacia el desmonte y talón bajo el relleno.",
        `Ancho de cimentación B = C + F + A = ${fmt(C, 2)} + ${fmt(F, 2)} + ${fmt(A, 2)} = ${fmt(B, 2)} m.`,
        `Peralte de zapata e = ${fmt(esp, 2)} m. Profundidad de desplante / suelo de puntera D = ${fmt(D, 2)} m.`,
        `Altura de pantalla Hs = H − e = ${fmt(H, 2)} − ${fmt(esp, 2)} = ${fmt(Hs, 2)} m.`,
        `El alma es trapezoidal: espesor F = ${fmt(F, 2)} m en la base y B′ = ${fmt(Bp, 2)} m en coronación. El talud de cada cara es B1 = (F−B′)/2 = ${fmt(B1, 2)} m.`,
        Fajustado
          ? `F de ensayo = ${fmt(Fuser, 2)} m no cumplía la flecha de servicio (paso 16). Se adoptó F = ${fmt(F, 2)} m (múltiplos de 5 cm) y se recalculó geometría, estabilidad y acero.`
          : `Espesor de alma F = ${fmt(F, 2)} m (ensayo = adoptado).`,
        `Cuña de talud h''' = ${fmt(Ap, 2)} · tan(${fmt(beta, 1)}°) = ${fmt(hCuna, 2)} m. Altura activa H+h''' = ${fmt(Hact, 2)} m.`,
        hk > 0.02
          ? `El muro deslizaba sin llave (paso 07). Se dispone dentellón (taco) bajo el fuste: bk = ${fmt(bk, 2)} m × hk = ${fmt(hk, 2)} m, para forzar el plano de deslizamiento a D+hk = ${fmt(Dpas, 2)} m.`
          : "El FS al deslizamiento cumple sin llave; no se dispone dentellón.",
      ],
      table: {
        caption: "Inventario geométrico por metro lineal",
        headers: ["Parte", "Símbolo", "Medida", "Función"],
        rows: [
          ["Alma / fuste", "Hs × F / B′", `${fmt(Hs, 2)} × ${fmt(F, 2)} / ${fmt(Bp, 2)} m`, "Pantalla en voladizo, caras con talud"],
          ["Puntera (pata)", "C × e", `${fmt(C, 2)} × ${fmt(esp, 2)} m`, "Voladizo delantero de la zapata"],
          ["Talón", "A × e", `${fmt(A, 2)} × ${fmt(esp, 2)} m`, "Voladizo bajo el relleno"],
          ["Zapata (cimiento)", "B × e", `${fmt(B, 2)} × ${fmt(esp, 2)} m`, "Losa de cimentación corrida"],
          ["Suelo sobre puntera", "(D−e) × C", `${fmt(Math.max(0, D - esp), 2)} × ${fmt(C, 2)} m`, "Peso y pasivo de puntera"],
          ...(hk > 0.02
            ? [["Dentellón (taco)", "bk × hk", `${fmt(bk, 2)} × ${fmt(hk, 2)} m`, "Llave de cortante bajo el fuste"]]
            : []),
        ],
      },
      note: "Todas las cotas se leen en el croquis. Los brazos de palanca se miden desde la arista delantera de la pata.",
    },
    {
      n: "02",
      title: "Coeficientes de empuje Rankine",
      formula: "Ka = tan²(45° − φ/2)    ·    Kp = tan²(45° + φ/2)    ·    δ ≈ ⅔ φ",
      formulaTex: String.raw`K_a=\tan^{2}\!\left(45^{\circ}-\dfrac{\varphi}{2}\right)\qquad K_p=\tan^{2}\!\left(45^{\circ}+\dfrac{\varphi}{2}\right)\qquad \delta\approx\tfrac{2}{3}\varphi`,
      substitution: `φ relleno = ${fmt(phi, 1)}°`,
      result: `Ka = ${fmt(Ka, 4)}    ·    Kp = ${fmt(Kp, 3)}    ·    δ = ${fmt(delta, 1)}°`,
      desarrollo: [
        `Ka = tan²(45 − ${fmt(phi, 1)}/2) = ${fmt(Ka, 4)}. Gobierna el empuje activo del trasdós.`,
        `Kp = tan²(45 + ${fmt(phi, 1)}/2) = ${fmt(Kp, 3)}. Interviene en el pasivo del suelo de punta (altura D).`,
        `Ángulo de fricción muro–suelo δ = ⅔φ = ${fmt(delta, 1)}° (Mononobe–Okabe).`,
      ],
    },
    {
      n: "03",
      title: "Empuje activo estático y empuje de agua",
      formula: "Pa = ½ (H+h''')² Ka γ − 2c(H+h''')√Ka    ·    Pw = ½ h''² γw    ·    Pa,v = Pa sen β",
      formulaTex: String.raw`P_a=\tfrac12(H+h''')^{2}K_a\gamma-2c(H+h''')\sqrt{K_a}\qquad P_w=\tfrac12 h''^{2}\gamma_w\qquad P_{a,v}=P_a\sin\beta`,
      substitution: `γ=${fmt(gammaRelleno, 2)} t/m³ · c=${fmt(c, 2)} t/m² · h''=${fmt(hSat, 2)} m · γw=${fmt(gammaW, 2)}`,
      result: `Pa = ${fmt(Pa, 2)} t/ml    ·    Pw = ${fmt(Pw, 2)} t/ml    ·    Pa,v = ${fmt(PaV, 2)} t/ml`,
      desarrollo: [
        `H+h''' = ${fmt(Hact, 2)} m. Término de tierra: ½·${fmt(Hact, 2)}²·${fmt(Ka, 4)}·${fmt(gammaRelleno, 2)} = ${fmt(0.5 * Hact ** 2 * Ka * gammaRelleno, 2)} t/ml.`,
        `Término de cohesión (−): 2·${fmt(c, 2)}·${fmt(Hact, 2)}·√${fmt(Ka, 4)} = ${fmt(2 * c * Hact * Math.sqrt(Math.max(Ka, 0)), 2)} t/ml.`,
        `Pa = ${fmt(Pa, 2)} t/ml, aplicado a (H+h''')/3 = ${fmt(yPa, 2)} m desde la base.`,
        `Pw = ½·${fmt(hSat, 2)}²·${fmt(gammaW, 2)} = ${fmt(Pw, 2)} t/ml, a h''/3 = ${fmt(yPw, 2)} m. Pa,v = Pa·sen ${fmt(beta, 1)}° = ${fmt(PaV, 2)} t/ml (estabilizante).`,
      ],
      note: "Rankine con cohesión: la c reduce el empuje activo. El agua se toma hidrostática hasta h''.",
    },
    {
      n: "04",
      title: "Sobrecarga de franja en el trasdós (Boussinesq)",
      formula: "σq = (2q/π)[Δη − senΔη·cos(η1+η2)]    ·    Pq ≈ σq · H / 2",
      formulaTex: String.raw`\sigma_q=\dfrac{2q}{\pi}\bigl[\Delta\eta-\sin\Delta\eta\cdot\cos(\eta_1+\eta_2)\bigr]\qquad P_q\approx\sigma_q\dfrac{H}{2}`,
      substitution: `q=${fmt(qFranja, 1)} t/m² · a'=${fmt(aFranja, 2)} m · b'=${fmt(bFranja, 2)} m · z=H/3=${fmt(z, 2)} m`,
      result: `η1=${fmt(eta1, 1)}° · η2=${fmt(eta2, 1)}° · σq=${fmt(Math.max(0, sigmaQ), 2)} t/m² · Pq=${fmt(Pq, 2)} t/ml`,
      desarrollo: [
        `Ángulos al borde cercano y lejano de la franja, a la profundidad representativa z = H/3.`,
        `Δη = ${fmt(eta2, 1)}° − ${fmt(eta1, 1)}° = ${fmt(dEta, 1)}°. σq se integra como empuje Pq a H/2.`,
      ],
    },
    {
      n: "05",
      title: "Pesos estabilizantes y brazos desde la pata",
      formula: "Wi = Ai · γi    ·    xi desde la arista delantera de la punta    ·    ΣW = Σ Wi",
      formulaTex: String.raw`W_i=A_i\,\gamma_i\qquad x_i\text{ desde la pata}\qquad \sum W=\sum W_i`,
      result: `ΣW = ${fmt(Wtot, 2)} t/ml    ·    ȳ del c.g. ≈ ${fmt(yW, 2)} m`,
      table: {
        caption: "Metrado de pesos por metro lineal (brazos desde la pata)",
        headers: ["N.º", "Elemento", "Área (m²/m)", "γ (t/m³)", "W (t/ml)", "x (m)", "Mr (t·m/ml)"],
        rows: [
          ["1", "Relleno sobre talón + cuña", fmt(A_rell, 3), fmt(gammaRelleno, 2), fmt(Wrelleno, 2), fmt(xRell, 3), fmt(MrRell, 2)],
          ["2", "Suelo sobre la puntera", fmt(A_punta, 3), fmt(gammaRelleno, 2), fmt(Wpunta, 2), fmt(xPunta, 3), fmt(MrPunta, 2)],
          ["3", "Zapata de concreto", fmt(A_base, 3), fmt(gammaConc, 2), fmt(Wbase, 2), fmt(xBase, 3), fmt(MrBase, 2)],
          ["4", "Alma / fuste", fmt(A_alma, 3), fmt(gammaConc, 2), fmt(Walma, 2), fmt(xAlma, 3), fmt(MrAlma, 2)],
          ...(hk > 0.02
            ? [["6", "Dentellón (taco)", fmt(A_key, 3), fmt(gammaConc, 2), fmt(Wkey, 2), fmt(xKey, 3), fmt(MrKey, 2)]]
            : []),
          ["5", "Componente vertical Pa", "—", "—", fmt(PaV, 2), fmt(xPaV, 3), fmt(MrPaV, 2)],
          ["Σ", "Total", "—", "—", fmt(Wtot, 2), "—", fmt(Mr, 2)],
        ],
        zonas: layoutMuroVoladizo({ H, D, A, C, F, Bp, esp, beta, hk, bk }),
      },
      note: "El momento resistente ΣMr se toma respecto a la arista delantera de la pata (volteo hacia el desmonte).",
    },
    {
      n: "06",
      title: "Momentos actuantes de empuje (estático)",
      formula: "Ma = Pa·(H+h''')/3 + Pw·h''/3",
      formulaTex: String.raw`M_a=P_a\dfrac{H+h'''}{3}+P_w\dfrac{h''}{3}`,
      substitution: `Pa=${fmt(Pa, 2)} · y=${fmt(yPa, 2)} m    ·    Pw=${fmt(Pw, 2)} · y=${fmt(yPw, 2)} m`,
      result: `ΣMa = ${fmt(Ma, 2)} t·m/ml    ·    ΣMr = ${fmt(Mr, 2)} t·m/ml`,
      desarrollo: [
        `Ma,tierra = ${fmt(Pa, 2)} × ${fmt(yPa, 2)} = ${fmt(MaPa, 2)} t·m/ml.`,
        `Ma,agua = ${fmt(Pw, 2)} × ${fmt(yPw, 2)} = ${fmt(MaPw, 2)} t·m/ml.`,
        `ΣMa = ${fmt(Ma, 2)} t·m/ml. ΣMr (paso 05) = ${fmt(Mr, 2)} t·m/ml.`,
      ],
    },
    {
      n: "07",
      title: "Estabilidad al deslizamiento (estático)",
      formula: "FS_d = (c_base·B + W·tan φ_base + Pp) / (Pa + Pw)    ·    Pp = ½ (D+hk)² Kp γsat",
      formulaTex: String.raw`FS_d=\dfrac{c_{\mathrm{base}}B+W\tan\varphi_{\mathrm{base}}+P_p}{P_a+P_w}\qquad P_p=\tfrac12(D+h_k)^{2}K_p\gamma_{\mathrm{sat}}`,
      substitution: `c_base=${fmt(cohesBase, 2)} t/m² · φ_base=${fmt(phiBase, 1)}° · D=${fmt(D, 2)} m · hk=${fmt(hk, 2)} m`,
      result: `FS_d = ${fmt(FSd, 2)}    (mín. ${fmt(FS_desl, 2)})${hk > 0.02 ? `    ·    dentellón ${fmt(bk, 2)}×${fmt(hk, 2)} m` : "    ·    sin dentellón"}`,
      ok: FSd + 1e-9 >= FS_desl,
      desarrollo: [
        `Sin llave: FS_d = ${fmt(FSdSinDentellon, 2)}    ·    FS_d,sis = ${fmt(FSdEqSinDentellon, 2)}.`,
        deslizaSin
          ? `No cumple el mínimo. Se coloca dentellón (taco / diente de cimentación) bajo el fuste: bk = F = ${fmt(bk, 2)} m, hk se itera de 5 en 5 cm.`
          : "Cumple sin llave; no se dispone dentellón.",
        `Fricción en la base: W·tan φ = ${fmt(Wtot, 2)} · tan(${fmt(phiBase, 1)}°) = ${fmt(resistFric, 2)} t/ml.`,
        `Adherencia: c·B = ${fmt(cohesBase, 2)} × ${fmt(B, 2)} = ${fmt(resistC, 2)} t/ml.`,
        `Pasivo con plano en la base del dentellón: Pp = ½·${fmt(Dpas, 2)}²·${fmt(Kp, 3)}·${fmt(gammaSat, 2)} = ${fmt(pasivo, 2)} t/ml  (D+hk = ${fmt(D, 2)}+${fmt(hk, 2)}).`,
        `ΣHr = ${fmt(resistC + resistFric + pasivo, 2)} t/ml.  ΣHa = Pa+Pw = ${fmt(HactSt, 2)} t/ml.`,
        `FS_d = ${fmt(resistC + resistFric + pasivo, 2)} / ${fmt(HactSt, 2)} = ${fmt(FSd, 2)}.`,
      ],
      note: hk > 0.02
        ? "El dentellón se prediseña y verifica en el paso siguiente. Aquí solo se actualiza FS_d con D+hk."
        : "Se toma el pasivo completo del suelo de puntera. Si el terreno frontal puede excavarse, reduzca Pp o anule D.",
    },
    {
      n: "07b",
      title: "Predimensionamiento y verificación del dentellón (taco)",
      formula: "bk = F    ·    hk,pre = máx(e, 0,30 m)    ·    Pp = ½ Kp γ (D+hk)²    ·    Vu = 1,4 ΔPp    ·    Mu = Vu·hk/2",
      formulaTex: String.raw`b_k=F\qquad h_{k,\mathrm{pre}}=\max(e,\ 0{,}30\,\mathrm{m})\qquad P_p=\tfrac12 K_p\gamma(D+h_k)^{2}\qquad V_u=1{,}4\Delta P_p\qquad M_u=V_u\dfrac{h_k}{2}`,
      substitution: `F=${fmt(F, 2)} m · e=${fmt(esp, 2)} m · hk,pre=${fmt(hkPre, 2)} m · D=${fmt(D, 2)} m · Kp=${fmt(Kp, 3)}`,
      result: hk > 0.02
        ? `Dentellón ${fmt(bk, 2)} × ${fmt(hk, 2)} m    ·    FS_d ${fmt(FSdSinDentellon, 2)} → ${fmt(FSd, 2)}    ·    ${llave.text}    ·    φVc = ${fmt(llave.phiVc, 2)} t`
        : `No se dispone    ·    FS_d = ${fmt(FSd, 2)} ≥ ${fmt(FS_desl, 2)} sin llave`,
      ok: okDentellonEst && okDentellonSec,
      desarrollo: [
        "El dentellón (taco / diente de cimentación) es una llave de cortante bajo el fuste. No se coloca bajo la puntera: ahí el pasivo ya se cuenta con D y el brazo de la llave sería menor.",
        `Predimensionamiento: bk = F = ${fmt(F, 2)} m (mismo ancho que el alma). hk,pre = máx(e, 0,30) = ${fmt(hkPre, 2)} m. Se itera de 5 en 5 cm hasta FS_d y FS_d,sis.`,
        deslizaSin
          ? `Sin llave el muro desliza: FS_d = ${fmt(FSdSinDentellon, 2)} (mín. ${fmt(FS_desl, 2)}) y FS_d,sis = ${fmt(FSdEqSinDentellon, 2)} (mín. ${fmt(FS_deslSis, 2)}).`
          : `Sin llave ya cumple. No se vierte concreto de taco.`,
        hk > 0.02
          ? `Se adopta hk = ${fmt(hk, 2)} m. Peso Wk = bk·hk·γc = ${fmt(A_key, 3)}·${fmt(gammaConc, 2)} = ${fmt(Wkey, 2)} t/ml, brazo xk = C+bk/2 = ${fmt(xKey, 2)} m.`
          : "Sin taco no hay Wk ni ΔPp.",
        `Pasivo sin llave: Pp0 = ½·${fmt(D, 2)}²·${fmt(Kp, 3)}·${fmt(gammaSat, 2)} = ${fmt(pasivoSin, 2)} t/ml.`,
        hk > 0.02
          ? `Pasivo con llave (plano en D+hk = ${fmt(Dpas, 2)} m): Pp = ${fmt(pasivo, 2)} t/ml.  ΔPp = ${fmt(PpKey, 2)} t/ml actúa en la cara delantera del taco.`
          : `Pp = ${fmt(pasivo, 2)} t/ml (sin incremento).`,
        `FS_d con llave = ${fmt(FSd, 2)}    ·    FS_d,sis = ${fmt(FSdEq, 2)}.`,
        hk > 0.02
          ? `Sección del taco como voladizo corto (espesor bk, altura hk, franja 1,00 m): Vu = 1,4·ΔPp = ${fmt(VuKey, 2)} t    ·    Mu = Vu·hk/2 = ${fmt(MuKey, 2)} t·m.  d = ${fmt(llave.d, 1)} cm.  ${llave.text} (As,prov ${fmt(llave.AsProv, 2)} cm²/m).  φMn = ${fmt(llave.phiMn, 2)} t·m ${llave.okM ? "≥ Mu" : "< Mu"}.  φVc = ${fmt(llave.phiVc, 2)} t ${llave.okV ? "≥ Vu" : "< Vu"}.`
          : "Sin verificación de sección: no hay taco.",
      ],
      table: deslizaSin
        ? {
            caption: "Iteración de hk (prediseño) y verificación de estabilidad",
            headers: ["Ensayo", "hk (m)", "FS_d", "FS_d,sis", "Veredicto"],
            rows: ensayosDentellon.map((it, i) => [
              String(i + 1),
              fmt(it.hk, 2),
              fmt(it.FSd, 2),
              fmt(it.FSdEq, 2),
              it.ok ? "CUMPLE" : "NO CUMPLE",
            ]),
          }
        : {
            caption: "Criterio de adopción del dentellón",
            headers: ["Dato", "Valor", "Criterio"],
            rows: [
              ["FS_d sin llave", fmt(FSdSinDentellon, 2), `mín. ${fmt(FS_desl, 2)}`],
              ["FS_d,sis sin llave", fmt(FSdEqSinDentellon, 2), `mín. ${fmt(FS_deslSis, 2)}`],
              ["Adopción", "no se dispone", "ambos FS cumplen"],
            ],
          },
      note: "El acero del taco se ancla en la zapata. Recubrimiento de zapata recZap. Si φVc no alcanza, aumente bk (hasta F) o hk.",
    },
    {
      n: "08",
      title: "Estabilidad al volteo (estático)",
      formula: "FS_v = ΣMr / ΣMa",
      formulaTex: String.raw`FS_v=\dfrac{\sum M_r}{\sum M_a}`,
      substitution: `Mr=${fmt(Mr, 2)} t·m/ml · Ma=${fmt(Ma, 2)} t·m/ml`,
      result: `FS_v = ${fmt(FSv, 2)}    (mín. ${fmt(FS_volt, 2)})`,
      ok: FSv + 1e-9 >= FS_volt,
      desarrollo: [
        `FS_v = ${fmt(Mr, 2)} / ${fmt(Ma, 2)} = ${fmt(FSv, 2)}.`,
        "El volteo se verifica respecto a la arista delantera de la pata. El talón y el relleno son los estabilizantes principales.",
      ],
    },
    {
      n: "09",
      title: "Excentricidad y presiones de contacto en la zapata",
      formula: "x̄ = (Mr − Ma)/W    ·    e = B/2 − x̄    ·    |e| ≤ B/6    ·    q = (W/B)(1 ± 6e/B)",
      formulaTex: String.raw`\bar{x}=\dfrac{M_r-M_a}{W}\qquad e=\dfrac{B}{2}-\bar{x}\qquad \lvert e\rvert\le\dfrac{B}{6}\qquad q=\dfrac{W}{B}\left(1\pm\dfrac{6e}{B}\right)`,
      result: `x̄ = ${fmt(xBar, 3)} m    ·    e = ${fmt(e, 3)} m    ·    B/6 = ${fmt(eLim, 3)} m    ·    qpata = ${fmt(qToe, 2)}    ·    qtalón = ${fmt(qHeel, 2)} t/m²`,
      ok: nucleo,
      desarrollo: [
        `Resultante vertical a x̄ = (${fmt(Mr, 2)} − ${fmt(Ma, 2)}) / ${fmt(Wtot, 2)} = ${fmt(xBar, 3)} m desde la pata.`,
        `e = B/2 − x̄ = ${fmt(B / 2, 3)} − ${fmt(xBar, 3)} = ${fmt(e, 3)} m. Núcleo central B/6 = ${fmt(eLim, 3)} m.`,
        nucleo
          ? `Trapecio de contacto en todo B: q(x) lineal entre la pata (${fmt(qToe, 2)}) y el talón (${fmt(qHeel, 2)}) t/m².`
          : ` |e| > B/6: se abandona el núcleo. Longitud de contacto L' = 3(B/2−|e|) = ${fmt(Lcontact, 2)} m y qmín = 0.`,
      ],
      table: {
        caption: "Presiones de servicio bajo la zapata",
        headers: ["Sección", "x desde pata (m)", "q (t/m²)"],
        rows: [
          ["Arista de la pata", "0.00", fmt(qToe, 2)],
          ["Cara frontal del alma", fmt(C, 2), fmt(qStemF, 2)],
          ["Cara posterior del alma", fmt(C + F, 2), fmt(qStemB, 2)],
          ["Arista del talón", fmt(B, 2), fmt(qHeel, 2)],
        ],
      },
      note: "Estas presiones cargan la punta hacia arriba y alivian el talón. Sirven al diseño estructural de la zapata.",
    },
    {
      n: "10",
      title: "Capacidad portante de la cimentación (Terzaghi)",
      formula: "qu = c Nc + γ D Nq + ½ γ B Nγ    ·    qa = qu/FS    ·    FS_c = qu / qmáx",
      formulaTex: String.raw`q_u=c N_c+\gamma D N_q+\tfrac12\gamma B N_\gamma\qquad q_a=q_u/FS\qquad FS_c=q_u/q_{\max}`,
      substitution: `φ_base=${fmt(phiBase, 1)}° · Nc=${fmt(Nc, 2)} · Nq=${fmt(Nq, 2)} · Nγ=${fmt(Ng, 2)} · D+hk=${fmt(Dpas, 2)} m`,
      result: `qu = ${fmt(qu, 2)} t/m²    ·    qa = ${fmt(qa, 2)} t/m²    ·    FS_c = ${fmt(FSc, 2)}    (mín. ${fmt(FS_cap, 2)})`,
      ok: FSc + 1e-9 >= FS_cap,
      desarrollo: [
        "Factores de capacidad para zapata corrida (1.00 m) sobre el suelo de contacto de la base.",
        `qu = ${fmt(cohesBase, 2)}·${fmt(Nc, 2)} + ${fmt(gammaRelleno, 2)}·${fmt(Dpas, 2)}·${fmt(Nq, 2)} + ½·${fmt(gammaRelleno, 2)}·${fmt(B, 2)}·${fmt(Ng, 2)} = ${fmt(qu, 2)} t/m².`,
        `qmáx de servicio = ${fmt(qMax, 2)} t/m². FS_c = ${fmt(qu, 2)} / ${fmt(qMax, 2)} = ${fmt(FSc, 2)}.`,
      ],
    },
    {
      n: "11",
      title: "Empuje sísmico Mononobe–Okabe",
      formula: "θ = arctan[Kh/(1−Kv)]    ·    Pae = ½ γsat H² (1−Kv) Kae    ·    ΔPae = Pae − Pa",
      formulaTex: String.raw`\theta=\arctan\dfrac{K_h}{1-K_v}\qquad P_{ae}=\tfrac12\gamma_{\mathrm{sat}}H^{2}(1-K_v)K_{ae}\qquad \Delta P_{ae}=P_{ae}-P_a`,
      substitution: `Kh=${fmt(Kh, 3)} · Kv=${fmt(Kv, 3)} · θ=${fmt(theta, 2)}° · δ=${fmt(delta, 1)}° · i=90°`,
      result: `Kae = ${fmt(Kae, 4)}    ·    Pae = ${fmt(Pae, 2)} t/ml    ·    ΔPae = ${fmt(dPae, 2)} t/ml`,
      desarrollo: [
        `θ = arctan(${fmt(Kh, 3)}/(1−${fmt(Kv, 3)})) = ${fmt(theta, 2)}°.`,
        `Kae (M–O, muro vertical) = ${fmt(Kae, 4)}. Pae = ½·${fmt(gammaSat, 2)}·${fmt(H, 2)}²·(1−${fmt(Kv, 3)})·${fmt(Kae, 4)} = ${fmt(Pae, 2)} t/ml.`,
        dPae < 0.05
          ? `ΔPae = máx(0, Pae−Pa) = 0 t/ml porque Pae (${fmt(Pae, 2)}) ≤ Pa (${fmt(Pa, 2)}). El sismo de tierra no incrementa el empuje activo: no se dibuja fuerza extra a 0,6 H.`
          : `Incremento sísmico ΔPae = ${fmt(dPae, 2)} t/ml, aplicado a 0,6 H = ${fmt(yPae, 2)} m (práctica COVENIN / hoja).`,
        `La acción sísmica que sí gobierna es la inercia del muro y relleno: PIR = Kh·W = ${fmt(Kh, 3)}·${fmt(Wtot, 2)} = ${fmt(PIR, 2)} t/ml, aplicada en el centro de gravedad ȳ = ${fmt(yW, 2)} m (no en 0,6 H).`,
        `Kv·W = ${fmt(Kv, 3)}·${fmt(Wtot, 2)} = ${fmt(Kv * Wtot, 2)} t/ml alivia el peso (empuje vertical hacia arriba en el c.g.).`,
      ],
      note: "COVENIN 1756: Kv ≈ 0,7 Kh. El empuje total sísmico no se superpone al estático: se usa Pae o Pa+ΔPae. Si ΔPae=0, el croquis marca 0,6 H a trazos y destaca PIR en ȳ.",
    },
    {
      n: "12",
      title: "Estabilidad sísmica (deslizamiento y volteo)",
      formula: "FS_d,sis = [cB + W(1−Kv)tanφ + ½Pp] / (Pa+Pw+ΔPae+Pq+PIR)    ·    FS_v,sis = Mr(1−Kv) / Ma,sis",
      formulaTex: String.raw`FS_{d,\mathrm{sis}}=\dfrac{cB+W(1-K_v)\tan\varphi+\tfrac12 P_p}{P_a+P_w+\Delta P_{ae}+P_q+P_{IR}}\qquad FS_{v,\mathrm{sis}}=\dfrac{M_r(1-K_v)}{M_{a,\mathrm{sis}}}`,
      result: `FS_d,sis = ${fmt(FSdEq, 2)}    (mín. ${fmt(FS_deslSis, 2)})    ·    FS_v,sis = ${fmt(FSvEq, 2)}    (mín. ${fmt(FS_voltSis, 2)})`,
      ok: FSdEq + 1e-9 >= FS_deslSis && FSvEq + 1e-9 >= FS_voltSis,
      desarrollo: [
        `V sísmico = W(1−Kv) = ${fmt(Veq, 2)} t/ml. Pasivo reducido a 50 % = ${fmt(0.5 * pasivo, 2)} t/ml.`,
        `ΣHa,sis = ${fmt(Pa, 2)}+${fmt(Pw, 2)}+${fmt(dPae, 2)}+${fmt(Pq, 2)}+${fmt(PIR, 2)} = ${fmt(HactEq, 2)} t/ml.`,
        `FS_d,sis = ${fmt(resistC + resistFricEq + 0.5 * pasivo, 2)} / ${fmt(HactEq, 2)} = ${fmt(FSdEq, 2)}.`,
        `Ma,sis = ${fmt(Ma, 2)} + ΔPae·0,6H + Pq·H/2 + PIR·ȳ = ${fmt(MaEq, 2)} t·m/ml.`,
        `Mr,sis = Σ Wi(1−Kv)·xi = ${fmt(MrEq, 2)} t·m/ml.  FS_v,sis = ${fmt(FSvEq, 2)}.`,
      ],
      note: "Factores sísmicos habituales: 1,10 al deslizamiento y 1,50 al volteo (menores que en estático).",
    },
    {
      n: "13",
      title: "Solicitaciones de la pantalla (alma) y combinaciones E.060",
      formula: "Ms = Pa,s·Hs/3 + Pw,s·hw/3 + Pq,s·Hs/2    ·    Mu = máx(1,7 Ms ; 1,0 Ms,sis)",
      formulaTex: String.raw`M_s=P_{a,s}\dfrac{H_s}{3}+P_{w,s}\dfrac{h_w}{3}+P_{q,s}\dfrac{H_s}{2}\qquad M_u=\max(1{,}7\,M_s;\ 1{,}0\,M_{s,\mathrm{sis}})`,
      result: `Ms = ${fmt(MsStemSt, 2)} t·m/ml    ·    Ms,sis = ${fmt(MsStemEq, 2)}    ·    Mu = ${fmt(MuStem, 2)} t·m    ·    Vu = ${fmt(VuStem, 2)} t`,
      desarrollo: [
        `La pantalla es un voladizo de altura Hs = ${fmt(Hs, 2)} m, empotrado en la zapata. Franja de 1.00 m.`,
        `Pa,pantalla = ½ Ka γ Hs² − 2c Hs√Ka = ${fmt(PaStem, 2)} t/ml. Pw,s = ${fmt(PwStem, 2)} t/ml (hw=${fmt(hwStem, 2)} m).`,
        `Pq,s = ${fmt(PqStem, 2)} t/ml. ΔPae,s = ${fmt(dPaeStem, 2)} t/ml.`,
        `Ms estático = ${fmt(MsStemSt, 2)} t·m/ml.  Ms sísmico = ${fmt(MsStemEq, 2)} t·m/ml.`,
        `U estático 1,7H: Mu = 1,7×${fmt(MsStemSt, 2)} = ${fmt(1.7 * MsStemSt, 2)}.  U sismo 1,0E: Mu = ${fmt(MsStemEq, 2)}.`,
        `Gobierna Mu = ${fmt(MuStem, 2)} t·m/ml y Vu = ${fmt(VuStem, 2)} t/ml en la base del alma.`,
      ],
      note: "E.060: empuje de tierra 1,70 (equivalente a H). Sismo 1,00. Se toma la envolvente.",
    },
    {
      n: "14",
      title: "Acero de flexión de la pantalla (vertical, cara de tierra / trasdós)",
      formula: "d = h − rec − Øest − db/2    ·    ρ = (0,85 f'c/fy)[1−√(1−2Rn/0,85f'c)]    ·    a = As fy/(0,85 f'c b)    ·    c = a/β1",
      formulaTex: String.raw`d=h-\mathrm{rec}-\varnothing_{\mathrm{est}}-\dfrac{d_b}{2}\qquad \rho=\dfrac{0{,}85 f'_c}{f_y}\Bigl[1-\sqrt{1-\dfrac{2R_n}{0{,}85 f'_c}}\Bigr]\qquad a=\dfrac{A_s f_y}{0{,}85 f'_c b}\qquad c=\dfrac{a}{\beta_1}`,
      substitution: `h=F=${fmt(F * 100, 1)} cm · rec=${fmt(rec, 1)} cm · f'c=${fmt(fc, 0)} · fy=${fmt(fy, 0)} · b=100 cm  ·  Rn=${fmt(alma.Rn, 2)} kg/cm²  ·  ρreq=${fmt(alma.rho, 5)}  ·  ρmín=máx(0,0012; 0,8√f'c/fy; 14/fy)=${fmt(alma.rhoMin, 5)}  ·  ρmáx=0,75 ρb=${fmt(alma.rhoMax, 5)}  ·  ρ usar=${fmt(alma.rhoUse, 5)}  ·  As=${fmt(alma.As, 2)} cm²/m  ·  a=${fmt(alma.a, 2)} cm  ·  c=${fmt(alma.a / beta1(fc), 2)} cm`,
      result: `d = ${fmt(alma.d, 1)} cm    ·    As = ${fmt(alma.As, 2)} cm²/m    ·    ${alma.text}    ·    φMn = ${fmt(alma.phiMn, 2)} t·m`,
      ok: alma.okM && alma.okRho && okEspAlma,
      desarrollo: [
        `Peralte efectivo d = ${fmt(F * 100, 1)} − ${fmt(rec, 1)} − 0,95 − ${fmt(alma.bar.db, 2)}/2 = ${fmt(alma.d, 1)} cm.`,
        `Rn = Mu/(φ b d²) = ${fmt(alma.Rn, 2)} kg/cm².`,
        `ρreq = (0,85 f'c/fy)[1−√(1−2 Rn/(0,85 f'c))] = ${fmt(alma.rho, 5)}.`,
        `ρmín = máx(0,0012 ; 0,8√f'c/fy ; 14/fy) = ${fmt(alma.rhoMin, 5)}  (0,8√${fmt(fc, 0)}/${fmt(fy, 0)} = ${fmt((0.8 * Math.sqrt(fc)) / fy, 5)}  ·  14/fy = ${fmt(14 / fy, 5)}).`,
        `ρmáx = 0,75 ρb = ${fmt(alma.rhoMax, 5)}.  ρ usar = ${fmt(alma.rhoUse, 5)}.`,
        `As = ρ b d = ${fmt(alma.As, 2)} cm²/m → se adopta ${alma.text} (As,prov = ${fmt(alma.AsProv, 2)} cm²/m).`,
        `a = As fy /(0,85 f'c b) = ${fmt(alma.a, 2)} cm.  φMn = 0,90·As·fy·(d−a/2)/1e5 = ${fmt(alma.phiMn, 2)} t·m  ${alma.okM ? "≥ Mu" : "< Mu"}.`,
        "El acero principal va vertical, en la cara del trasdós (tracción). Se ancla en la zapata con ganchos estándar.",
      ],
      note: "ρmín de muro = máx(0,0012 ; 0,8√f'c/fy ; 14/fy). Si φMn < Mu, aumente F o el acero.",
    },
    {
      n: "15",
      title: "Acero de corte y temperatura del alma (horizontal, ambas caras)",
      formula: "φVc = 0,85 × 0,53√f'c b d    ·    As,temp = 0,002 b h    (horizontal)",
      formulaTex: String.raw`\phi V_c=0{,}85\times 0{,}53\sqrt{f'_c}\,b\,d\qquad A_{s,\mathrm{temp}}=0{,}002\,b\,h`,
      substitution: `Vu=${fmt(VuStem, 2)} t · b=100 cm · d=${fmt(alma.d, 1)} cm`,
      result: `φVc = ${fmt(alma.phiVc, 2)} t    ·    As,h = ${fmt(AsTemp, 2)} cm²/m    ·    Ø ${barH.name} @ ${sTemp} cm`,
      ok: alma.okV,
      desarrollo: [
        `Vc = 0,53√${fmt(fc, 0)}·100·${fmt(alma.d, 1)} / 1000 = ${fmt(alma.Vc, 2)} t.  φVc = 0,85 Vc = ${fmt(alma.phiVc, 2)} t.`,
        alma.okV
          ? `Vu = ${fmt(VuStem, 2)} t ≤ φVc. El concreto absorbe el corte; no se requieren estribos de alma (muro).`
          : `Vu = ${fmt(VuStem, 2)} t > φVc. Aumente el espesor F o disponga conectores / mayor f'c.`,
        `Acero horizontal de retracción: 0,002·100·${fmt(F * 100, 1)} = ${fmt(AsTemp, 2)} cm²/m → Ø ${barH.name} @ ${sTemp} cm en ambas caras si F ≥ 25 cm, o en la cara de tierra si es más delgado.`,
        `Longitud de desarrollo del vertical: ℓd ≈ 0,075 fy db / √f'c = ${fmt(ld, 1)} cm. Doble el acero de pantalla hacia el talón (tracción superior de zapata).`,
      ],
    },
    {
      n: "16",
      title: "Deflexión de servicio del alma (voladizo empotrado)",
      formula: "Ec=15000√f'c    ·    fr=2,01√f'c    ·    Ig=b F³/12    ·    Mcr=fr Ig/(F/2)    ·    Ie=(Mcr/Ma)³Ig+[1−(Mcr/Ma)³]Icr    ·    δ=∫ M(x)(Hs−x)/(Ec Ie(x)) dx    ·    δadm=Hs/150",
      formulaTex: String.raw`E_c=15000\sqrt{f'_c}\qquad f_r=2{,}01\sqrt{f'_c}\qquad I_g=\dfrac{b F^{3}}{12}\qquad M_{cr}=\dfrac{f_r I_g}{F/2}\qquad I_e=\left(\dfrac{M_{cr}}{M_a}\right)^{3}I_g+\left[1-\left(\dfrac{M_{cr}}{M_a}\right)^{3}\right]I_{cr}\qquad \delta=\displaystyle\int_{0}^{H_s}\dfrac{M(x)(H_s-x)}{E_c I_e(x)}\,dx\qquad \delta_{\mathrm{adm}}=\dfrac{H_s}{150}`,
      substitution: `f'c=${fmt(fc, 0)} kg/cm² · F=${fmt(F, 2)} m · Hs=${fmt(Hs, 2)} m · As,prov=${fmt(alma.AsProv, 2)} cm²/m · d=${fmt(alma.d, 1)} cm · Ec=${fmt(Ec, 0)} t/m²`,
      result: `${okDeflexionAlma ? "CUMPLE" : "NO CUMPLE"}    ·    δmáx = ${fmt(deltaAlma_cm, 3)} cm    ·    δadm = ${fmt(deltaAdmAlma_cm, 3)} cm    ·    F adoptado = ${fmt(F, 2)} m`,
      ok: okDeflexionAlma,
      desarrollo: [
        "La pantalla se modela como voladizo de 1,00 m de franja, empotrado en la zapata y libre en coronación. La flecha se calcula en servicio (empujes sin factorar: Pa + Pw + Pq, sin sismo).",
        `1. Módulo de elasticidad del concreto (E.060): Ec = 15000 √f'c = 15000 √${fmt(fc, 0)} = ${fmt(Ec_kgcm2, 0)} kg/cm² = ${fmt(Ec, 0)} t/m².`,
        `2. Módulo de rotura: fr = 2,01 √f'c = ${fmt(fr_kgcm2, 2)} kg/cm². Relación modular n = Es/Ec = 2×10⁶ / ${fmt(Ec_kgcm2, 0)} = ${fmt(nModular, 1)}.`,
        `3. Inercia bruta en la base (b = 1,00 m): Ig = b F³ / 12 = 1,00·${fmt(F, 2)}³ / 12 = ${fmt(Ig0 * 1e8, 0)} cm⁴/ml.`,
        `4. Momento de agrietamiento: Mcr = fr·Ig / (F/2) = ${fmt(Mcr0, 3)} t·m/ml.`,
        `5. Momento de servicio en la base (paso 13, sin factorar): Ma = Ms = ${fmt(MaServ, 3)} t·m/ml ${agrietada ? " > Mcr → la sección se agrieta y gobierna Ie < Ig." : " ≤ Mcr → sección no agrietada, Ie = Ig."}`,
        `6. Sección fisurada transformada: ρ = As/(b d) = ${fmt(AsAlma_m2 / dAlma_m, 5)}, eje neutro k d = ${fmt(cNA * 100, 2)} cm, Icr = bc³/3 + n As (d−c)² = ${fmt(Icr0 * 1e8, 0)} cm⁴/ml.`,
        `7. Inercia efectiva de Branson (E.060 / ACI): Ie = (Mcr/Ma)³ Ig + [1−(Mcr/Ma)³] Icr = ${fmt(Ie0 * 1e8, 0)} cm⁴/ml    (Ie/Ig = ${fmt(IeRatio, 3)}).`,
        `8. Elástica: δ(Hs) = ∫₀^Hs M(x)(Hs−x) / (Ec Ie(x)) dx, con M(x) del empuje triangular/trapezoidal (tierra + agua + sobrecarga) y espesor variable t(x) de F a B′. Integración trapezoidal en 60 tramos.`,
        `9. Límite de servicio: δadm = Hs/150 = ${fmt(Hs, 2)}/150 = ${fmt(deltaAdmAlma_cm, 3)} cm (criterio usual de muros en voladizo; E.060 9.6 no fija un límite propio para este elemento).`,
        `10. Verificación: δmáx = ${fmt(deltaAlma_cm, 3)} cm ${okDeflexionAlma ? "≤" : ">"} ${fmt(deltaAdmAlma_cm, 3)} cm  →  ${okDeflexionAlma ? "CUMPLE." : "NO CUMPLE."}`,
        Fajustado
          ? `11. Ajuste de espesor: F ensayo = ${fmt(Fuser, 2)} m producía δ > δadm. Se incrementó F de 5 en 5 cm (Ie ∝ F³) y se reiteró el cálculo hasta cumplir. F adoptado = ${fmt(F, 2)} m.`
          : `11. El F de ensayo = ${fmt(F, 2)} m ya cumple; no fue necesario engrosar la pantalla.`,
      ],
      table: {
        caption: "Iteración del espesor F hasta δ ≤ Hs/150",
        headers: ["Ensayo", "F (m)", "δmáx (cm)", "δadm (cm)", "Veredicto"],
        rows: ensayos.map((it, i) => [
          String(i + 1),
          fmt(it.F, 2),
          fmt(it.delta, 3),
          fmt(it.adm, 3),
          it.ok ? "CUMPLE" : "NO CUMPLE",
        ]),
      },
      note: okDeflexionAlma
        ? "La flecha se revisa de inmediato. Si no cumple, el motor aumenta F (múltiplos de 5 cm) y recalcula geometría, estabilidad y acero hasta δ ≤ Hs/150."
        : `Se alcanzó Fmáx = ${fmt(Fmax, 2)} m y la flecha sigue por encima de Hs/150. Revise Hs, la napa o la sobrecarga de franja.`,
    },
    {
      n: "17",
      title: "Acero de la pata (inferior, voladizo hacia el desmonte)",
      formula: "M↑ = qpata C²/3 + qalma C²/6    ·    M↓ = (Wlos+Wsuelo)·C/2    ·    Mu = 1,4 (M↑−M↓)",
      formulaTex: String.raw`M^{\uparrow}=q_{\mathrm{pata}}\dfrac{C^{2}}{3}+q_{\mathrm{alma}}\dfrac{C^{2}}{6}\qquad M^{\downarrow}=(W_{\mathrm{los}}+W_{\mathrm{suelo}})\dfrac{C}{2}\qquad M_u=1{,}4(M^{\uparrow}-M^{\downarrow})`,
      substitution: `C=${fmt(C, 2)} m · qpata=${fmt(qToe, 2)} · q@alma=${fmt(qStemF, 2)} t/m² · e=${fmt(esp, 2)} m`,
      result: `Ms = ${fmt(MsToe, 2)} t·m/ml    ·    Mu = ${fmt(MuToe, 2)}    ·    ${pata.text}    ·    φMn = ${fmt(pata.phiMn, 2)} t·m`,
      ok: pata.okM && pata.okV,
      desarrollo: [
        "La pata es un voladizo empotrado en la cara frontal del alma. La reacción del suelo empuja hacia arriba; el peso propio y el suelo de punta empujan hacia abajo.",
        `M↑ = ${fmt(qToe, 2)}·${fmt(C, 2)}²/3 + ${fmt(qStemF, 2)}·${fmt(C, 2)}²/6 = ${fmt(MupToe, 2)} t·m/ml.`,
        `W↓ = e·C·γc + (D−e)·C·γ = ${fmt(WslabToe, 2)} + ${fmt(WsoilToe, 2)} = ${fmt(VdnToe, 2)} t/ml.  M↓ = ${fmt(MdnToe, 2)} t·m/ml.`,
        `Ms = máx(0, M↑−M↓) = ${fmt(MsToe, 2)} t·m/ml.  Vu,cara = ${fmt(VsToe, 2)} t/ml.  Vu a d = ${fmt(VuToe_d, 2)} t (E.060 11.1.3).`,
        `Mu = 1,4 Ms = ${fmt(MuToe, 2)} t·m.  d = ${fmt(pata.d, 1)} cm.  As = ${fmt(pata.As, 2)} cm²/m → ${pata.text} (As,prov ${fmt(pata.AsProv, 2)}).`,
        `φMn = ${fmt(pata.phiMn, 2)} t·m ${pata.okM ? "≥ Mu" : "< Mu"}.  φVc = ${fmt(pata.phiVc, 2)} t ${pata.okV ? "≥ Vu(d)" : "< Vu(d)"}.`,
        "Acero principal: inferior, paralelo al voladizo (hacia el desmonte). Recubrimiento de zapata recZap.",
      ],
      note: "Si φMn o φVc no alcanzan, aumente el peralte e de la zapata o acorte C redistribuyendo B.",
    },
    {
      n: "18",
      title: "Acero del talón (superior, cara del relleno)",
      formula: "M↓ = (γ Hs,eq + γc e) A²/2    ·    M↑ = qtalón A²/3 + qalma A²/6    ·    Mu = 1,4 (M↓−M↑)",
      formulaTex: String.raw`M^{\downarrow}=(\gamma H_{s,\mathrm{eq}}+\gamma_c e)\dfrac{A^{2}}{2}\qquad M^{\uparrow}=q_{\mathrm{talon}}\dfrac{A^{2}}{3}+q_{\mathrm{alma}}\dfrac{A^{2}}{6}\qquad M_u=1{,}4(M^{\downarrow}-M^{\uparrow})`,
      substitution: `A=${fmt(A, 2)} m · Hs,eq=${fmt(hFillHeel, 2)} m · qtalón=${fmt(qHeel, 2)} · q@alma=${fmt(qStemB, 2)} t/m²`,
      result: `Ms = ${fmt(MsHeel, 2)} t·m/ml    ·    Mu = ${fmt(MuHeel, 2)}    ·    ${talon.text}    ·    φMn = ${fmt(talon.phiMn, 2)} t·m`,
      ok: talon.okM && talon.okV,
      desarrollo: [
        "El talón es un voladizo empotrado en la cara posterior del alma. El relleno y la losa empujan hacia abajo; la reacción del suelo alivia.",
        `w↓ = ${fmt(gammaRelleno, 2)}·${fmt(hFillHeel, 2)} + ${fmt(gammaConc, 2)}·${fmt(esp, 2)} = ${fmt(wFillHeel + wSlabHeel, 2)} t/m².`,
        `M↓ = w↓·A²/2 = ${fmt(MdnHeel, 2)} t·m/ml.  V↓ = ${fmt(VdnHeel, 2)} t/ml.`,
        `M↑ = ${fmt(qHeel, 2)}·${fmt(A, 2)}²/3 + ${fmt(qStemB, 2)}·${fmt(A, 2)}²/6 = ${fmt(MupHeel, 2)} t·m/ml.`,
        `Ms = máx(0, M↓−M↑) = ${fmt(MsHeel, 2)} t·m/ml.  Vu a d = ${fmt(VuHeel_d, 2)} t.`,
        `Mu = 1,4 Ms = ${fmt(MuHeel, 2)} t·m.  As = ${fmt(talon.As, 2)} cm²/m → ${talon.text} (As,prov ${fmt(talon.AsProv, 2)}).`,
        `φMn = ${fmt(talon.phiMn, 2)} t·m ${talon.okM ? "≥ Mu" : "< Mu"}.  φVc = ${fmt(talon.phiVc, 2)} t ${talon.okV ? "≥ Vu(d)" : "< Vu(d)"}.`,
        "Acero principal: superior (cara del relleno). Los ganchos de la pantalla se solapan con este lecho.",
      ],
    },
    {
      n: "19",
      title: "Peralte y cortante de la losa de cimentación",
      formula: "d ≥ recZap + Ø/2 + holgura    ·    Vu se toma a una distancia d de la cara del alma",
      formulaTex: String.raw`d\ge \mathrm{rec}_{zap}+\dfrac{\varnothing}{2}+\mathrm{holgura}\qquad V_u\text{ a distancia }d\text{ de la cara del alma}`,
      result: `e = ${fmt(esp, 2)} m    ·    d = ${fmt(Math.min(pata.d, talon.d), 1)} cm    ·    φVc,pata = ${fmt(pata.phiVc, 2)} t    ·    φVc,talón = ${fmt(talon.phiVc, 2)} t`,
      ok: okEspZap && pata.okV && talon.okV,
      desarrollo: [
        `Peralte de zapata e = ${fmt(esp * 100, 1)} cm. Recubrimiento inferior/superior recZap = ${fmt(recZap, 1)} cm (contacto con suelo).`,
        `d,pata = ${fmt(pata.d, 1)} cm.  d,talón = ${fmt(talon.d, 1)} cm.`,
        `Cortante unidireccional (franja 1.00 m) a d de cada cara del alma: Vu,pata=${fmt(VuToe_d, 2)} t · Vu,talón=${fmt(VuHeel_d, 2)} t.`,
        okEspZap
          ? "El peralte adoptado cubre flexión y corte de ambos voladizos."
          : "Aumente e: el peralte efectivo no alcanza para el recubrimiento más el Ø.",
        "No hay punzonamiento de columna: la zapata es corrida. Revise asiento diferencial si el relleno del talón se coloca por tongadas.",
      ],
      note: hk > 0.02
        ? `Dentellón adoptado ${fmt(bk, 2)} × ${fmt(hk, 2)} m bajo el fuste (paso 07). El peralte e cubre flexión y corte de puntera y talón.`
        : "Sin dentellón: el FS al deslizamiento ya cumplía. El peralte e cubre flexión y corte de ambos voladizos.",
    },
    {
      n: "20",
      title: "Cuadro de aceros por metro lineal",
      formula: "s = (as / As) · 100 cm    ·    s ≤ 3h y ≤ 25 cm (distribución de muro)",
      formulaTex: String.raw`s=\dfrac{a_s}{A_s}\cdot 100\,\mathrm{cm}\qquad s\le 3h\ \text{y}\ \le 25\,\mathrm{cm}`,
      result: `Pantalla ${alma.text}    ·    Pata ${pata.text} inf.    ·    Talón ${talon.text} sup.    ·    Temp. Ø ${barH.name} @ ${sTemp} cm`,
      table: {
        caption: "Despiece de refuerzo — franja 1.00 m",
        headers: ["Elemento", "Cara", "As req. (cm²/m)", "Adopción", "As prov.", "φMn (t·m)", "φVc (t)"],
        rows: [
          ["Alma / pantalla", "Trasdós, vertical", fmt(alma.As, 2), alma.text, fmt(alma.AsProv, 2), fmt(alma.phiMn, 2), fmt(alma.phiVc, 2)],
          ["Alma, intradós", "Intradós, vertical", fmt(AsIntra, 2), `Ø ${barIntra.name} @ ${sIntra} cm`, fmt((barIntra.as / sIntra) * 100, 2), "—", "—"],
          ["Alma, temperatura", "Horizontal, ambas caras", fmt(AsTemp, 2), `Ø ${barH.name} @ ${sTemp} cm`, fmt((barH.as / sTemp) * 100, 2), "—", "—"],
          ["Punta (pata)", "Inferior", fmt(pata.As, 2), pata.text, fmt(pata.AsProv, 2), fmt(pata.phiMn, 2), fmt(pata.phiVc, 2)],
          ["Punta, repartición", "Superior", fmt(AsZapDist, 2), `Ø ${barH.name} @ ${sZapDist} cm`, fmt((barH.as / sZapDist) * 100, 2), "—", "—"],
          ["Talón", "Superior", fmt(talon.As, 2), talon.text, fmt(talon.AsProv, 2), fmt(talon.phiMn, 2), fmt(talon.phiVc, 2)],
          ["Talón, repartición", "Inferior", fmt(AsZapDist, 2), `Ø ${barH.name} @ ${sZapDist} cm`, fmt((barH.as / sZapDist) * 100, 2), "—", "—"],
          ...(hk > 0.02
            ? [["Dentellón", "U bajo el fuste", fmt(llave.As, 2), llave.text, fmt(llave.AsProv, 2), fmt(llave.phiMn, 2), fmt(llave.phiVc, 2)]]
            : []),
          ["Repartición zapata", "Ortogonal", fmt(AsZapDist, 2), `Ø 3/8" @ ${sZapDist} cm`, "—", "—", "—"],
        ],
      },
      note: `Anclaje de pantalla en zapata: ℓd ≈ ${fmt(ld, 0)} cm. Doble el vertical hacia el talón. Recubrimiento alma ${fmt(rec, 1)} cm · zapata ${fmt(recZap, 1)} cm.`,
    },
  ];

  return out(
    `Muro H=${fmt(H, 2)} m · B=${fmt(B, 2)} m · F=${fmt(F, 2)} m · B′=${fmt(Bp, 2)} m · FSd=${fmt(FSd, 2)} · FSv=${fmt(FSv, 2)} · ${alma.text}${hk > 0.02 ? ` · dentellón ${fmt(hk, 2)} m` : ""}`,
    `Muro en voladizo con zapata corrida B=${fmt(B, 2)} m (puntera C=${fmt(C, 2)} m, talón A=${fmt(A, 2)} m, e=${fmt(esp, 2)} m, F=${fmt(F, 2)} m / B′=${fmt(Bp, 2)} m${Fajustado ? ` adoptado por deflexión; ensayo ${fmt(Fuser, 2)} m` : ""})${hk > 0.02 ? `. Dentellón ${fmt(bk, 2)}×${fmt(hk, 2)} m bajo el fuste (sin llave FSd=${fmt(FSdSinDentellon, 2)}).` : "."} Estabilidad: FSd=${fmt(FSd, 2)}, FSv=${fmt(FSv, 2)}, FSc=${fmt(FSc, 2)}. Deflexión: δ=${fmt(deltaAlma_cm, 2)} cm ${okDeflexionAlma ? "≤" : ">"} Hs/150=${fmt(deltaAdmAlma_cm, 2)} cm. Acero: pantalla ${alma.text} al trasdós; puntera ${pata.text} inf.; talón ${talon.text} sup.`,
    steps,
    [
      ok("Deslizamiento estático", fmt(FSd, 2), `≥ ${fmt(FS_desl, 2)}`, FSd >= FS_desl),
      ok("Volteo estático", fmt(FSv, 2), `≥ ${fmt(FS_volt, 2)}`, FSv >= FS_volt),
      ok("Núcleo |e| ≤ B/6", `${fmt(eAbs, 3)} m`, `≤ ${fmt(eLim, 3)} m`, nucleo),
      ok("Capacidad de la zapata", fmt(FSc, 2), `≥ ${fmt(FS_cap, 2)}`, FSc >= FS_cap),
      ok("Deslizamiento sísmico", fmt(FSdEq, 2), `≥ ${fmt(FS_deslSis, 2)}`, FSdEq >= FS_deslSis),
      ok("Volteo sísmico", fmt(FSvEq, 2), `≥ ${fmt(FS_voltSis, 2)}`, FSvEq >= FS_voltSis),
      ok(
        hk > 0.02 ? `Dentellón ${fmt(bk, 2)}×${fmt(hk, 2)} m` : "Dentellón (taco)",
        hk > 0.02 ? "dispuesto" : "no requiere",
        deslizaSin ? "si FSd < mín." : "FSd ya cumple",
        !deslizaSin || (FSd >= FS_desl && FSdEq >= FS_deslSis),
      ),
      ok("Flexión del alma φMn ≥ Mu", fmt(alma.phiMn, 2), `≥ ${fmt(MuStem, 2)} t·m`, alma.okM),
      ok("Corte del alma φVc ≥ Vu", fmt(alma.phiVc, 2), `≥ ${fmt(VuStem, 2)} t`, alma.okV),
      ok("Deflexión de servicio del alma", `${fmt(deltaAlma_cm, 3)} cm`, `≤ ${fmt(deltaAdmAlma_cm, 3)} cm (Hs/150)`, okDeflexionAlma),
      ok("Espesor F de pantalla", `${fmt(F, 2)} m`, Fajustado ? `ensayo ${fmt(Fuser, 2)} m → adoptado` : "ensayo = adoptado", true),
      ok("Flexión de la pata", fmt(pata.phiMn, 2), `≥ ${fmt(MuToe, 2)} t·m`, pata.okM),
      ok("Corte de la pata (a d)", fmt(pata.phiVc, 2), `≥ ${fmt(VuToe_d, 2)} t`, pata.okV),
      ok("Flexión del talón", fmt(talon.phiMn, 2), `≥ ${fmt(MuHeel, 2)} t·m`, talon.okM),
      ok("Corte del talón (a d)", fmt(talon.phiVc, 2), `≥ ${fmt(VuHeel_d, 2)} t`, talon.okV),
      ...(hk > 0.02
        ? [
            ok("Flexión del dentellón φMn ≥ Mu", fmt(llave.phiMn, 2), `≥ ${fmt(MuKey, 2)} t·m`, llave.okM),
            ok("Corte del dentellón φVc ≥ Vu", fmt(llave.phiVc, 2), `≥ ${fmt(VuKey, 2)} t`, llave.okV),
          ]
        : []),
    ],
    [
      {
        title: "Resumen de estabilidad y diseño",
        rows: [
          ["Verificación", "Valor", "Límite"],
          ["FS deslizamiento", fmt(FSd, 2), fmt(FS_desl, 2)],
          ["FS volteo", fmt(FSv, 2), fmt(FS_volt, 2)],
          ["Dentellón hk × bk", hk > 0.02 ? `${fmt(hk, 2)} × ${fmt(bk, 2)} m` : "no requiere", deslizaSin ? `sin llave FSd=${fmt(FSdSinDentellon, 2)}` : "FSd cumple"],
          ["Excentricidad e", `${fmt(e, 3)} m`, `±${fmt(eLim, 3)} m`],
          ["q pata / q talón", `${fmt(qToe, 2)} / ${fmt(qHeel, 2)} t/m²`, `qa=${fmt(qa, 2)}`],
          ["FS capacidad", fmt(FSc, 2), fmt(FS_cap, 2)],
          ["FS desliz. sismo", fmt(FSdEq, 2), fmt(FS_deslSis, 2)],
          ["FS volteo sismo", fmt(FSvEq, 2), fmt(FS_voltSis, 2)],
          ["Pantalla", alma.text, `Mu=${fmt(MuStem, 2)} t·m`],
          ["Deflexión δ / δadm", `${fmt(deltaAlma_cm, 2)} / ${fmt(deltaAdmAlma_cm, 2)} cm`, okDeflexionAlma ? "CUMPLE Hs/150" : "NO CUMPLE"],
          ["F pantalla", `${fmt(F, 2)} m`, Fajustado ? `ensayo ${fmt(Fuser, 2)} m` : "sin ajuste"],
          ["Pata", pata.text, `Mu=${fmt(MuToe, 2)} t·m`],
          ["Talón", talon.text, `Mu=${fmt(MuHeel, 2)} t·m`],
          ["Dentellón", hk > 0.02 ? `${fmt(bk, 2)}×${fmt(hk, 2)} m · ${llave.text}` : "no requiere", hk > 0.02 ? `ΔPp=${fmt(PpKey, 2)} t` : "FSd cumple"],
        ],
      },
    ],
    {
      C: C.toFixed(3),
      A: A.toFixed(3),
      F: F.toFixed(3),
      Fuser: Fuser.toFixed(3),
      Fajustado: Fajustado ? "1" : "0",
      okDeflex: okDeflexionAlma ? "1" : "0",
      B: B.toFixed(3),
      Hs: Hs.toFixed(3),
      H: H.toFixed(3),
      D: D.toFixed(3),
      Bp: Bp.toFixed(3),
      esp: esp.toFixed(3),
      hk: hk.toFixed(3),
      bk: bk.toFixed(3),
      hkPre: hkPre.toFixed(3),
      dentellon: hk > 0.02 ? "1" : "0",
      FSd0: FSdSinDentellon.toFixed(3),
      FSdEq: FSdEq.toFixed(3),
      FSdesl: FS_desl.toFixed(3),
      pasivoSin: pasivoSin.toFixed(3),
      PpKey: PpKey.toFixed(3),
      Kh: Kh.toFixed(3),
      Kv: Kv.toFixed(3),
      Pae: Pae.toFixed(3),
      beta: beta.toFixed(1),
      hSat: hSat.toFixed(3),
      hCuna: hCuna.toFixed(3),
      Pa: Pa.toFixed(3),
      Pw: Pw.toFixed(3),
      Pq: Pq.toFixed(3),
      dPae: dPae.toFixed(3),
      PaV: PaV.toFixed(3),
      PIR: PIR.toFixed(3),
      Wtot: Wtot.toFixed(3),
      Walma: Walma.toFixed(3),
      Wbase: Wbase.toFixed(3),
      Wrelleno: Wrelleno.toFixed(3),
      Wpunta: Wpunta.toFixed(3),
      xBar: xBar.toFixed(3),
      qToe: qToe.toFixed(3),
      qHeel: qHeel.toFixed(3),
      yPa: yPa.toFixed(3),
      yPw: yPw.toFixed(3),
      yPae: yPae.toFixed(3),
      yW: yW.toFixed(3),
      Ka: Ka.toFixed(4),
      FSd: FSd.toFixed(3),
      FSv: FSv.toFixed(3),
      MuStem: MuStem.toFixed(3),
      MuToe: MuToe.toFixed(3),
      MuHeel: MuHeel.toFixed(3),
      asAlma: alma.text,
      asPata: pata.text,
      asTalon: talon.text,
      asLlave: llave.text,
      AsAlma: alma.As.toFixed(2),
      AsPata: pata.As.toFixed(2),
      AsTalon: talon.As.toFixed(2),
      AsLlave: llave.As.toFixed(2),
      barAlma: alma.bar.name,
      dbAlma: String(alma.bar.db),
      sAlma: String(alma.s),
      barPata: pata.bar.name,
      dbPata: String(pata.bar.db),
      sPata: String(pata.s),
      barTalon: talon.bar.name,
      dbTalon: String(talon.bar.db),
      sTalon: String(talon.s),
      barLlave: llave.bar.name,
      dbLlave: String(llave.bar.db),
      sLlave: String(llave.s),
      barTemp: barH.name,
      dbTemp: String(barH.db),
      sTemp: String(sTemp),
      barIntra: barIntra.name,
      dbIntra: String(barIntra.db),
      sIntra: String(sIntra),
      AsIntra: AsIntra.toFixed(2),
      barDist: barH.name,
      dbDist: String(barH.db),
      sDist: String(sZapDist),
      AsDist: AsZapDist.toFixed(2),
      VuStem: VuStem.toFixed(3),
      deltaAlma: deltaAlma_cm.toFixed(3),
      deltaAdm: deltaAdmAlma_cm.toFixed(3),
    }
  );
};

/* ═══════════════════════════════════════════════════════════════
   PILOTES — helpers profesionales (Tomlinson · Meyerhof · Labarre)
   ═══════════════════════════════════════════════════════════════ */
type CapaPilote = {
  tipo: "GRANULAR" | "COHESIVO";
  e: number;
  gamma: number;
  gammaSat: number;
  phi: number;
  cu: number;
  ca: number;
  alpha: number;
};

/** α Tomlinson aproximado (cu en t/m²; pa ≈ 10 t/m²). */
function alphaTomlinson(cu: number) {
  if (cu <= 0) return 1;
  const ratio = cu / 10;
  if (ratio <= 0.25) return 1;
  if (ratio >= 4) return 0.4;
  return Math.max(0.4, Math.min(1, 1 - 0.12 * Math.sqrt(ratio)));
}

/** K lateral según instalación (Jaky × factor). */
function Kshaft(phi: number, instalacion: "HINCADO" | "EXCAVADO") {
  const K0 = Math.max(0.2, 1 - Math.sin(rad(Math.max(0, phi))));
  return instalacion === "HINCADO" ? 1.5 * K0 : 0.75 * K0;
}

/** σ'v a profundidad z (m) con NF y γ / γsat. */
function sigmaEfectivaHasta(
  capas: { e: number; gamma: number; gammaSat: number }[],
  zTarget: number,
  NF: number,
  gammaW: number
) {
  let z = 0;
  let sig = 0;
  for (const c of capas) {
    const z0 = z;
    const z1 = z + c.e;
    const seg = Math.min(z1, zTarget) - z0;
    if (seg <= 0) break;
    const mid = z0 + seg / 2;
    const g = mid <= NF ? c.gamma : Math.max(0.4, c.gammaSat - gammaW);
    sig += g * seg;
    z = z1;
    if (zTarget <= z1) break;
  }
  return sig;
}

/** qp límite Meyerhof (t/m²): 50·Nq·tanφ (capado). */
function qpLimiteMeyerhof(phi: number, Nq: number, qpMaxUser: number) {
  if (qpMaxUser > 0) return qpMaxUser;
  return 50 * Nq * Math.tan(rad(Math.max(1, phi)));
}

function parseCapas(raw: Record<string, string>, nMax = 6): CapaPilote[] {
  const outC: CapaPilote[] = [];
  for (let i = 1; i <= nMax; i++) {
    const e = num(raw, `e${i}`, 0);
    if (e <= 0) continue;
    const tipo = str(raw, `tipo${i}`, i % 2 === 0 ? "COHESIVO" : "GRANULAR").toUpperCase().startsWith("C")
      ? "COHESIVO"
      : "GRANULAR";
    const gamma = num(raw, `g${i}`, 1.8);
    const gammaSat = num(raw, `gsat${i}`, Math.max(gamma, 1.9));
    const phi = num(raw, `phi${i}`, tipo === "GRANULAR" ? 30 : 0);
    const cu = num(raw, `cu${i}`, tipo === "COHESIVO" ? 8 : 0);
    const alphaIn = num(raw, `alpha${i}`, 0);
    const alpha = alphaIn > 0 ? alphaIn : alphaTomlinson(cu);
    const caIn = num(raw, `ca${i}`, 0);
    const ca = caIn > 0 ? caIn : tipo === "COHESIVO" ? alpha * Math.max(cu, 0) : 0;
    outC.push({ tipo, e, gamma, gammaSat, phi, cu, ca, alpha });
  }
  if (!outC.length) {
    outC.push(
      { tipo: "GRANULAR", e: 7, gamma: 1.8, gammaSat: 2.0, phi: 25, cu: 0, ca: 0, alpha: 1 },
      { tipo: "COHESIVO", e: 5, gamma: 1.8, gammaSat: 1.95, phi: 0, cu: 8, ca: 8, alpha: 1 },
      { tipo: "GRANULAR", e: 4.5, gamma: 1.9, gammaSat: 2.05, phi: 32, cu: 0, ca: 0, alpha: 1 }
    );
  }
  return outC;
}

function eficienciaLabarre(D: number, sep: number, nFilas: number, nCols: number) {
  const m = Math.atan(D / Math.max(sep, 0.1)) * (180 / PI);
  const eta = Math.max(
    0.35,
    Math.min(
      1,
      1 - (m * (((nFilas - 1) * nCols + (nCols - 1) * nFilas) / (90 * nFilas * nCols)))
    )
  );
  const sep100 = (1.57 * D * nFilas * nCols) / Math.max(1, nFilas + nCols - 2);
  return { m, eta, sep100 };
}

export const pilotesPuntaFuste: Engine = (raw) => {
  const D = Math.max(0.15, num(raw, "D", 0.5));
  const NF = Math.max(0, num(raw, "NF", 1));
  const gammaW = num(raw, "gammaW", 1);
  const FS = Math.max(1.5, num(raw, "FS", 2.5));
  const P = Math.max(0, num(raw, "P", 80));
  const instalacion = str(raw, "instalacion", "HINCADO").toUpperCase().startsWith("E") ? "EXCAVADO" : "HINCADO";
  const phiPunta = num(raw, "phiPunta", 30);
  const cPunta = num(raw, "cPunta", 0);
  const tipoPunta = str(raw, "tipoPunta", "COHESIVO").toUpperCase().startsWith("C") ? "COHESIVO" : "GRANULAR";
  const qpMaxUser = num(raw, "qpMax", 0);
  const deltaFac = num(raw, "deltaFac", 0.75);
  const nFilas = Math.max(1, Math.round(num(raw, "nFilas", 2)));
  const nCols = Math.max(1, Math.round(num(raw, "nCols", 3)));
  const sep = Math.max(D, num(raw, "sep", 1.5));
  const fc = num(raw, "fc", 210);
  const FSstruct = Math.max(2, num(raw, "FSstruct", 3));
  const capas = parseCapas(raw);

  const L = capas.reduce((s, c) => s + c.e, 0);
  const Ap = (PI * D * D) / 4;
  const Af = PI * D * L;

  let QfGran = 0;
  let QfCoh = 0;
  let zTop = 0;
  const rowsFuste: string[][] = [];
  for (const capa of capas) {
    const zBot = zTop + capa.e;
    const zMid = (zTop + zBot) / 2;
    let dQ = 0;
    if (capa.tipo === "COHESIVO") {
      dQ = capa.ca * PI * D * capa.e;
      QfCoh += dQ;
      rowsFuste.push([
        capa.tipo,
        fmt(capa.e, 2),
        fmt(capa.cu, 1),
        fmt(capa.alpha, 2),
        fmt(capa.ca, 2),
        "—",
        fmt(dQ, 2),
      ]);
    } else {
      const K = Kshaft(capa.phi, instalacion);
      const delta = Math.max(5, Math.min(capa.phi, deltaFac * capa.phi));
      const sigMed = sigmaEfectivaHasta(capas, zMid, NF, gammaW);
      dQ = K * sigMed * Math.tan(rad(delta)) * PI * D * capa.e;
      QfGran += dQ;
      rowsFuste.push([
        capa.tipo,
        fmt(capa.e, 2),
        "—",
        "—",
        fmt(delta, 1) + "°",
        fmt(K, 3),
        fmt(dQ, 2),
      ]);
    }
    zTop = zBot;
  }
  const Qf = QfGran + QfCoh;

  const Nq = NqTerzaghi(phiPunta);
  const Nc = NcTerzaghi(phiPunta, Nq);
  const sigmaPunta = sigmaEfectivaHasta(capas, L, NF, gammaW);
  const cuPunta =
    cPunta > 0
      ? cPunta
      : capas.filter((c) => c.tipo === "COHESIVO").slice(-1)[0]?.cu ||
        capas.filter((c) => c.tipo === "COHESIVO").slice(-1)[0]?.ca ||
        5;
  let qp = 0;
  let Qp = 0;
  if (tipoPunta === "COHESIVO") {
    qp = Nc * cuPunta;
    Qp = qp * Ap;
  } else {
    const qpLim = qpLimiteMeyerhof(phiPunta, Nq, qpMaxUser);
    qp = Math.min(Nq * sigmaPunta, qpLim);
    Qp = qp * Ap;
  }
  const QuGeotec = Qf + Qp;
  const QadmGeo = QuGeotec / FS;

  const Ac_cm2 = Ap * 1e4;
  const QuStruct = (Ac_cm2 * fc) / (FSstruct * 1000);
  const Qadm = Math.min(QadmGeo, QuStruct);
  const gobierna = QadmGeo <= QuStruct ? "geotecnia" : "sección estructural";

  const Kpil = nFilas * nCols;
  const { m, eta, sep100 } = eficienciaLabarre(D, sep, nFilas, nCols);
  const Qgrupo = eta * Kpil * Qadm;
  const Pgrupo = P * Kpil;
  const FS_serv = Qadm > 0 && P > 0 ? Qadm / P : Infinity;
  const FS_grupo = Qgrupo > 0 && Pgrupo > 0 ? Qgrupo / Pgrupo : Infinity;

  const steps: CalcStep[] = [
    {
      n: "01",
      title: "Datos del pilote y perfil",
      formula: "Ap = π D²/4    ·    Af = π D L    ·    L = Σ ei",
      substitution: `D=${fmt(D, 2)} m · NF=${fmt(NF, 2)} m · instalación=${instalacion} · Pservicio=${fmt(P, 1)} t`,
      result: `L=${fmt(L, 2)} m · Ap=${fmt(Ap, 3)} m² · Af=${fmt(Af, 2)} m² · ${capas.length} estratos`,
      note: "Perfil estratigráfico con γ / γsat, φ, cu y α (Tomlinson) o ca directa. El NF define σ'v efectiva bajo agua.",
    },
    {
      n: "02",
      title: "Capacidad por fuste (Tomlinson / β·K)",
      formula:
        "Cohesivo: ca = α·cu , dQf = ca·πD·e    ·    Granular: dQf = K·σ'v·tanδ·πD·e , δ≈0,75φ",
      result: `Qf,gran=${fmt(QfGran, 1)} t · Qf,coh=${fmt(QfCoh, 1)} t · ΣQf=${fmt(Qf, 1)} t`,
      table: {
        caption: "Aporte de fuste por estrato",
        headers: ["Tipo", "e (m)", "cu", "α", "ca o δ", "K", "dQf (t)"],
        rows: rowsFuste,
      },
      note:
        instalacion === "HINCADO"
          ? "Hincado: K ≈ 1,5·(1−senφ). Excavado usaría K ≈ 0,75·(1−senφ)."
          : "Excavado: K ≈ 0,75·(1−senφ). Si hay ca ingresada, prevalece sobre α·cu.",
    },
    {
      n: "03",
      title: "Capacidad por punta (Terzaghi + límite Meyerhof)",
      formula:
        "Granular: qp = mín(Nq·σ'v , qp,lim)    ·    Cohesivo: qp = Nc·cu    ·    Qp = qp·Ap",
      substitution: `tipo=${tipoPunta} · φ=${fmt(phiPunta, 1)}° · Nc=${fmt(Nc, 2)} · Nq=${fmt(Nq, 2)} · σ'v,punta=${fmt(sigmaPunta, 2)} t/m²`,
      result: `qp=${fmt(qp, 1)} t/m² · Qp=${fmt(Qp, 1)} t`,
      note:
        tipoPunta === "GRANULAR"
          ? `Límite Meyerhof qp,lim = ${fmt(qpLimiteMeyerhof(phiPunta, Nq, qpMaxUser), 1)} t/m² (o qp máx. usuario).`
          : `cu punta = ${fmt(cuPunta, 2)} t/m².`,
    },
    {
      n: "04",
      title: "Capacidad geotécnica y estructural",
      formula: "Qu,geo = Qf+Qp · Qadm,geo=Qu/FS · Qu,est = Ac·f'c/FS_est · Qadm=mín",
      result: `Qu,geo=${fmt(QuGeotec, 1)} t · Qadm,geo=${fmt(QadmGeo, 1)} t · Qu,est=${fmt(QuStruct, 1)} t · Qadm=${fmt(Qadm, 1)} t (${gobierna})`,
      ok: Qadm > 0,
      note: `f'c=${fmt(fc, 0)} kg/cm² · FS geotécnico=${fmt(FS, 1)} · FS estructural=${fmt(FSstruct, 1)}.`,
    },
    {
      n: "05",
      title: "Verificación de servicio (pilote aislado)",
      formula: "FS_serv = Qadm / P",
      result: P > 0 ? `P=${fmt(P, 1)} t · FS_serv=${fmt(FS_serv, 2)}` : "Sin carga P: solo se reporta Qadm.",
      ok: P <= 0 || FS_serv >= 1,
    },
    {
      n: "06",
      title: "Eficiencia de grupo (Converse–Labarre)",
      formula: "η = 1 − m·[((n−1)m'+(m'−1)n)/(90·n·m')]    ·    Qadm,g = η·K·Qadm",
      substitution: `n=${nFilas} filas · m'=${nCols} cols · s=${fmt(sep, 2)} m · m=arctan(D/s)=${fmt(m, 1)}°`,
      result: `K=${Kpil} · η=${fmt(eta, 3)} · Qadm,grupo=${fmt(Qgrupo, 1)} t · Pgrupo=${fmt(Pgrupo, 1)} t`,
      note: `Separación para η≈100 %: s ≥ ${fmt(sep100, 2)} m. FS grupo = ${Pgrupo > 0 ? fmt(FS_grupo, 2) : "—"}.`,
    },
  ];

  return out(
    `Pilote D=${fmt(D, 2)} m · Qadm=${fmt(Qadm, 1)} t (${gobierna}) · grupo η=${fmt(eta, 2)} → ${fmt(Qgrupo, 1)} t`,
    `Qu,geo=${fmt(QuGeotec, 1)} t (Qf=${fmt(Qf, 1)}+Qp=${fmt(Qp, 1)}). Qadm=${fmt(Qadm, 1)} t. Grupo ${nFilas}×${nCols}: ${fmt(Qgrupo, 1)} t.`,
    steps,
    [
      ok("Qadm pilote > 0", `${fmt(Qadm, 1)} t`, "> 0", Qadm > 0),
      ok("Servicio pilote Qadm ≥ P", `${fmt(Qadm, 1)} ≥ ${fmt(P, 1)} t`, "Qadm ≥ P", P <= 0 || Qadm + 1e-9 >= P),
      ok("Servicio grupo Qadm,g ≥ ΣP", `${fmt(Qgrupo, 1)} ≥ ${fmt(Pgrupo, 1)} t`, "Qadm,g ≥ ΣP", P <= 0 || Qgrupo + 1e-9 >= Pgrupo),
      ok("Eficiencia de grupo", fmt(eta, 3), "0,5 – 1,0", eta >= 0.5 && eta <= 1.05),
      ok("Separación s ≥ 2,5 D", `${fmt(sep, 2)} m`, `≥ ${fmt(2.5 * D, 2)} m`, sep + 1e-9 >= 2.5 * D),
    ]
  );
};

/* ═══════════════════════════════════════════════════════════════
   PILOTES — punta granular + fuste cohesivo
   ═══════════════════════════════════════════════════════════════ */
export const pilotesPuntaGranuFuste: Engine = (raw) => {
  const D = Math.max(0.15, num(raw, "D", 0.5));
  const FS = Math.max(1.5, num(raw, "FS", 2.5));
  const P = Math.max(0, num(raw, "P", 80));
  const NF = Math.max(0, num(raw, "NF", 2));
  const gammaW = num(raw, "gammaW", 1);
  const phiPunta = num(raw, "phiPunta", 30);
  const gammaPunta = num(raw, "gammaPunta", 1.9);
  const gammaSatPunta = num(raw, "gammaSatPunta", Math.max(gammaPunta, 2.05));
  const Lpunta = Math.max(0.5, num(raw, "Lpunta", 4));
  const qpMaxUser = num(raw, "qpMax", 0);
  const nFilas = Math.max(1, Math.round(num(raw, "nFilas", 2)));
  const nCols = Math.max(1, Math.round(num(raw, "nCols", 3)));
  const sep = Math.max(D, num(raw, "sep", 1.5));
  const fc = num(raw, "fc", 210);
  const FSstruct = Math.max(2, num(raw, "FSstruct", 3));

  const capas: { e: number; ca: number; cu: number; alpha: number; gamma: number; gammaSat: number }[] = [];
  for (let i = 1; i <= 5; i++) {
    const eDef = i === 1 ? 6 : i === 2 ? 3 : 0;
    const e = num(raw, `e${i}`, eDef);
    if (e <= 0) continue;
    const cu = num(raw, `cu${i}`, i === 1 ? 4 : i === 2 ? 3.8 : 0);
    const alphaIn = num(raw, `alpha${i}`, 0);
    const alpha = alphaIn > 0 ? alphaIn : alphaTomlinson(cu);
    const caIn = num(raw, `ca${i}`, 0);
    const ca = caIn > 0 ? caIn : alpha * Math.max(cu, 0);
    const gamma = num(raw, `g${i}`, 1.8);
    const gammaSat = num(raw, `gsat${i}`, Math.max(gamma, 1.95));
    capas.push({ e, ca, cu, alpha, gamma, gammaSat });
  }
  const Lf = capas.reduce((s, c) => s + c.e, 0);
  const L = Lf + Lpunta;
  const Ap = (PI * D * D) / 4;

  let Qf = 0;
  const rows: string[][] = [];
  for (const c of capas) {
    const dQ = c.ca * PI * D * c.e;
    Qf += dQ;
    rows.push([fmt(c.e, 2), fmt(c.cu, 2), fmt(c.alpha, 2), fmt(c.ca, 2), fmt(dQ, 2)]);
  }

  const perfilSobre = [
    ...capas.map((c) => ({ e: c.e, gamma: c.gamma, gammaSat: c.gammaSat })),
    { e: Lpunta, gamma: gammaPunta, gammaSat: gammaSatPunta },
  ];
  const sigma = sigmaEfectivaHasta(perfilSobre, L, NF, gammaW);
  const Nq = NqTerzaghi(phiPunta);
  const qpLim = qpLimiteMeyerhof(phiPunta, Nq, qpMaxUser);
  const qp = Math.min(Nq * sigma, qpLim);
  const Qp = qp * Ap;
  const QuGeotec = Qf + Qp;
  const QadmGeo = QuGeotec / FS;
  const Ac_cm2 = Ap * 1e4;
  const QuStruct = (Ac_cm2 * fc) / (FSstruct * 1000);
  const Qadm = Math.min(QadmGeo, QuStruct);
  const gobierna = QadmGeo <= QuStruct ? "geotecnia" : "sección estructural";

  const Kpil = nFilas * nCols;
  const { m, eta, sep100 } = eficienciaLabarre(D, sep, nFilas, nCols);
  const Qgrupo = eta * Kpil * Qadm;
  const Pgrupo = P * Kpil;
  const FS_serv = Qadm > 0 && P > 0 ? Qadm / P : Infinity;

  const steps: CalcStep[] = [
    {
      n: "01",
      title: "Esquema punta granular + fuste cohesivo",
      formula: "L = Lfuste,coh + Lpunta,gran    ·    Ap = πD²/4",
      substitution: `NF=${fmt(NF, 2)} m · Pservicio=${fmt(P, 1)} t`,
      result: `Lf=${fmt(Lf, 2)} m · Lpunta=${fmt(Lpunta, 2)} m · L=${fmt(L, 2)} m · Ap=${fmt(Ap, 3)} m² · D=${fmt(D, 2)} m`,
      note: "Fuste en arcilla (α·cu o ca) y punta en granular con Nq y σ'v efectiva (NF).",
    },
    {
      n: "02",
      title: "Fuste cohesivo (α-método / Tomlinson)",
      formula: "ca = α·cu (si no se fija ca)    ·    Qf = Σ ca · π · D · ei",
      result: `Qf = ${fmt(Qf, 1)} t`,
      table: {
        caption: "Tramos cohesivos",
        headers: ["e (m)", "cu (t/m²)", "α", "ca (t/m²)", "dQf (t)"],
        rows,
      },
    },
    {
      n: "03",
      title: "Punta granular (Terzaghi + límite Meyerhof)",
      formula: "qp = mín(Nq·σ'v , qp,lim)    ·    Qp = qp·Ap",
      substitution: `φ=${fmt(phiPunta, 1)}° · Nq=${fmt(Nq, 2)} · σ'v=${fmt(sigma, 2)} t/m² · qp,lim=${fmt(qpLim, 1)} t/m²`,
      result: `qp=${fmt(qp, 1)} t/m² · Qp=${fmt(Qp, 1)} t`,
    },
    {
      n: "04",
      title: "Capacidad geotécnica y estructural",
      formula: "Qu,geo=Qf+Qp · Qadm,geo=Qu/FS · Qu,est=Ac·f'c/FS_est · Qadm=mín",
      result: `Qu,geo=${fmt(QuGeotec, 1)} t · Qadm,geo=${fmt(QadmGeo, 1)} t · Qu,est=${fmt(QuStruct, 1)} t · Qadm=${fmt(Qadm, 1)} t (${gobierna})`,
      ok: Qadm > 0,
    },
    {
      n: "05",
      title: "Servicio y grupo Converse–Labarre",
      formula: "FS_serv=Qadm/P · Qadm,g=η·K·Qadm",
      substitution: `n=${nFilas}×${nCols} · s=${fmt(sep, 2)} m · m=${fmt(m, 1)}° · η=${fmt(eta, 3)}`,
      result: `Qadm,g=${fmt(Qgrupo, 1)} t · Pgrupo=${fmt(Pgrupo, 1)} t · FS_serv=${P > 0 ? fmt(FS_serv, 2) : "—"} · sη100%=${fmt(sep100, 2)} m`,
    },
  ];

  return out(
    `Punta gran. + fuste coh. · Qadm=${fmt(Qadm, 1)} t · grupo ${fmt(Qgrupo, 1)} t`,
    `Qu,geo=${fmt(QuGeotec, 1)} t (Qf=${fmt(Qf, 1)}+Qp=${fmt(Qp, 1)}). Qadm=${fmt(Qadm, 1)} t (${gobierna}).`,
    steps,
    [
      ok("Qadm > 0", `${fmt(Qadm, 1)} t`, "> 0", Qadm > 0),
      ok("Servicio pilote Qadm ≥ P", `${fmt(Qadm, 1)} ≥ ${fmt(P, 1)} t`, "Qadm ≥ P", P <= 0 || Qadm + 1e-9 >= P),
      ok("Servicio grupo", `${fmt(Qgrupo, 1)} ≥ ${fmt(Pgrupo, 1)} t`, "Qadm,g ≥ ΣP", P <= 0 || Qgrupo + 1e-9 >= Pgrupo),
      ok("Separación s ≥ 2,5 D", `${fmt(sep, 2)} m`, `≥ ${fmt(2.5 * D, 2)} m`, sep + 1e-9 >= 2.5 * D),
    ]
  );
};

/* ═══════════════════════════════════════════════════════════════
   ESTABILIDAD CIRCULAR — método ordinario (Fellenius)
   Hoja: ESTABILIDAD CIRCULAR BISHOP (título interno: Fellenius)
   ═══════════════════════════════════════════════════════════════ */
export const estabilidadBishop: Engine = (raw) => {
  const phi = num(raw, "phi", 25);
  const FS_min = num(raw, "FSmin", 1.5);
  const dovelas: { alpha: number; H: number; b: number; gamma: number; hw: number; c: number }[] = [];
  for (let i = 1; i <= 8; i++) {
    const alpha = num(raw, `a${i}`, NaN);
    if (!Number.isFinite(alpha) && !raw[`a${i}`]) continue;
    const defA = [57, 54, 47, 23, 5, -20, -15, -10][i - 1] ?? 0;
    const defH = [3, 4, 5, 6, 5, 5, 4, 2][i - 1] ?? 3;
    const defB = [3, 4, 4, 4, 4, 4, 3, 2][i - 1] ?? 3;
    const defG = [2, 1.8, 1.8, 1.9, 2, 1.8, 1.8, 1.9][i - 1] ?? 1.8;
    const defHw = [0, 3, 4, 4, 4, 4, 4, 2][i - 1] ?? 0;
    const defC = [3, 0, 2, 3, 0, 0, 0, 5][i - 1] ?? 0;
    dovelas.push({
      alpha: num(raw, `a${i}`, defA),
      H: num(raw, `H${i}`, defH),
      b: num(raw, `b${i}`, defB),
      gamma: num(raw, `g${i}`, defG),
      hw: num(raw, `hw${i}`, defHw),
      c: num(raw, `c${i}`, defC),
    });
  }

  let sumMov = 0;
  let sumResOrd = 0;
  // Bishop simplificado: iterar FS
  let FSb = 1.2;
  const rows: string[][] = [];
  const sliceData = dovelas.map((d, idx) => {
    const A = d.b * d.H;
    const W = A * d.gamma;
    const u = d.hw > 0 ? d.hw * 1.0 : 0; // t/m² aproximando γw=1 sobre altura hw (presión media simplificada)
    const U = u * d.b; // fuerza de poros sobre base horizontal ≈ u·b
    const L = d.b / Math.max(0.05, Math.cos(rad(d.alpha))); // longitud de arco
    const mov = W * Math.sin(rad(d.alpha));
    // Ordinario / Fellenius correcto:
    const res = d.c * L + Math.max(0, W * Math.cos(rad(d.alpha)) - U) * Math.tan(rad(phi));
    sumMov += mov;
    sumResOrd += res;
    return { idx: idx + 1, ...d, A, W, U, L, mov, res };
  });

  for (let iter = 0; iter < 25; iter++) {
    let numB = 0;
    let denB = 0;
    for (const s of sliceData) {
      const mAlpha = Math.cos(rad(s.alpha)) * (1 + (Math.tan(rad(s.alpha)) * Math.tan(rad(phi))) / Math.max(FSb, 0.05));
      if (Math.abs(mAlpha) < 1e-6) continue;
      numB += (s.c * s.b + (s.W - s.U) * Math.tan(rad(phi))) / mAlpha;
      denB += s.W * Math.sin(rad(s.alpha));
    }
    const next = denB > 1e-9 ? numB / denB : FSb;
    if (Math.abs(next - FSb) < 1e-4) {
      FSb = next;
      break;
    }
    FSb = next;
  }

  const FSo = sumMov > 1e-9 ? sumResOrd / sumMov : 0;
  for (const s of sliceData) {
    rows.push([
      String(s.idx),
      fmt(s.alpha, 1),
      fmt(s.H, 2),
      fmt(s.b, 2),
      fmt(s.W, 2),
      fmt(s.mov, 2),
      fmt(s.res, 2),
    ]);
  }

  const steps: CalcStep[] = [
    {
      n: "01",
      title: "Qué calcula esta hoja",
      formula: "Superficie circular discretizada en dovelas · FS = Σ resistentes / Σ movilizantes",
      result: `${sliceData.length} dovelas · φ=${fmt(phi, 1)}° en la superficie de falla`,
      note: "Aunque el archivo se llama «ESTABILIDAD CIRCULAR BISHOP», el título interno es método de Fellenius (ordinario). Aquí se reportan ambos: ordinario y Bishop simplificado (iterativo).",
    },
    {
      n: "02",
      title: "Peso y geometría de cada dovela",
      formula: "A = b·H    ·    W = A·γ    ·    L = b / cos α    ·    U ≈ u·b",
      result: "Ver cuadro de dovelas",
      table: {
        caption: "Dovelas",
        headers: ["#", "α (°)", "H (m)", "b (m)", "W (t/m)", "W senα", "Res. ord."],
        rows,
      },
    },
    {
      n: "03",
      title: "Método ordinario (Fellenius)",
      formula: "FS = Σ[cL + (W cosα − U) tanφ] / Σ(W senα)",
      substitution: `Σ res = ${fmt(sumResOrd, 2)}    ·    Σ mov = ${fmt(sumMov, 2)}`,
      result: `FS_ordinario = ${fmt(FSo, 3)}`,
      ok: FSo >= FS_min,
      note: "No cumple equilibrio de fuerzas horizontales entre dovelas; suele ser conservador frente a Bishop.",
    },
    {
      n: "04",
      title: "Bishop simplificado (iterativo)",
      formula: "FS = Σ[(c b + (W−U) tanφ) / mα] / Σ(W senα)    ·    mα = cosα (1 + tanα·tanφ/FS)",
      result: `FS_Bishop = ${fmt(FSb, 3)}    (después de iterar mα)`,
      ok: FSb >= FS_min,
      desarrollo: [
        "Se arranca con FS≈1,2 y se sustituye mα hasta converger (|ΔFS|<1e-4).",
        `Criterio de la hoja: FS < 1,5 → potencialmente inestable (aquí mínimo pedido ${fmt(FS_min, 2)}).`,
      ],
    },
    {
      n: "05",
      title: "Diagnóstico",
      result:
        FSb >= FS_min
          ? `Estable: FS_Bishop=${fmt(FSb, 2)} ≥ ${fmt(FS_min, 2)}`
          : `Potencialmente inestable: FS_Bishop=${fmt(FSb, 2)} < ${fmt(FS_min, 2)}. Revisar geometría, drenaje o refuerzo (anclajes).`,
      ok: FSb >= FS_min,
    },
  ];

  return out(
    `FS ordinario=${fmt(FSo, 2)} · FS Bishop=${fmt(FSb, 2)}`,
    `Análisis circular con ${sliceData.length} dovelas. Se adopta FS_Bishop=${fmt(FSb, 2)} (ordinario ${fmt(FSo, 2)}).`,
    steps,
    [
      ok("FS ordinario", fmt(FSo, 2), `≥ ${fmt(FS_min, 2)}`, FSo >= FS_min),
      ok("FS Bishop", fmt(FSb, 2), `≥ ${fmt(FS_min, 2)}`, FSb >= FS_min),
    ]
  );
};

/* ═══════════════════════════════════════════════════════════════
   ANCLAJES en talud (condición activa)
   ═══════════════════════════════════════════════════════════════ */
export const anclajesSuelo: Engine = (raw) => {
  const tipo = str(raw, "tipo", "PERMANENTE");
  const H = num(raw, "H", 30);
  const NF = num(raw, "NF", 20);
  const alpha = num(raw, "alpha", 45);
  const beta = num(raw, "beta", 76);
  const phi = num(raw, "phi", 30);
  const c = num(raw, "c", 295);
  const gammaD = num(raw, "gammaD", 24);
  const gammaSat = num(raw, "gammaSat", gammaD + 1);
  const gammaW = num(raw, "gammaW", 9.81);
  const q = num(raw, "q", 300);
  const Kh = num(raw, "Kh", 0.2);
  const Kv = Kh * 0.7;
  const FSa = tipo.toUpperCase().startsWith("P") ? num(raw, "FSa", 1.5) : num(raw, "FSa", 1.2);
  const dBarreno = num(raw, "dBarreno", 0.075);
  const As = num(raw, "As", 551);
  const EsTf = num(raw, "EsTf", 41);
  const TgTf = num(raw, "TgTf", 47);
  void TgTf;
  const tauGrout = num(raw, "tauGrout", 0.4);

  const psi1 = (NF * NF * gammaW) / 2;
  const Wfactor =
    (gammaSat / 2) * NF * NF + ((H * H - NF * NF) / 2) * gammaD + q * H;
  const deltaOpt = alpha - ((Math.atan(Math.tan(rad(phi)) / FSa) * 180) / PI);
  const Ru = Math.sqrt(Kh * Kh + (1 + Kv) ** 2);
  const theta = ((Math.atan(Kh / (1 + Kv)) * 180) / PI);
  const Uplano =
    ((NF * NF) / 2) *
    (Math.sin(rad(beta - alpha)) / Math.sin(rad(alpha)) / Math.sin(rad(beta))) *
    (1 / Math.sin(rad(alpha)));
  const R =
    (Math.sin(rad(beta - alpha)) / (Math.sin(rad(beta)) * Math.sin(rad(alpha)))) * Wfactor * Ru;
  // fuerza resistente máxima / movilizada como en hoja
  const Fres = (R * Math.cos(rad(alpha - theta)) - Uplano) * Math.tan(rad(phi)) + (c * H) / Math.sin(rad(alpha));
  const Fmov = R * Math.sin(rad(alpha - theta));
  const FSsin = Fmov > 1e-9 ? Fres / Fmov : 99;
  const coefT = FSa * Math.cos(rad(alpha - deltaOpt)) + Math.sin(rad(alpha - deltaOpt)) * Math.tan(rad(phi));
  // Si FS sin anclaje ya es alto, dFS se calcula vs FSa pedido
  const dFSreal = FSa - FSsin;
  const T = dFSreal > 0 ? (dFSreal * Fmov) / Math.max(1e-6, coefT) : 0;

  const Es_kN = EsTf * 9.81;
  const nBarras = T > 0 ? Math.ceil(T / Math.max(1, Es_kN / FSa)) : 1;
  const Lbulbo = T > 0 ? T / (Math.max(1e-6, PI * dBarreno * tauGrout * 1000)) : 0;

  const steps: CalcStep[] = [
    {
      n: "01",
      title: "Datos del talud y tipo de anclaje",
      formula: "FSa = 1,5 permanente · 1,2 provisional (hoja ANCLAJES)",
      result: `Tipo=${tipo} · H=${fmt(H, 1)} m · NF=${fmt(NF, 1)} m · α=${fmt(alpha, 1)}° · β=${fmt(beta, 1)}° · FSa=${fmt(FSa, 2)}`,
      note: "α = plano de falla; β = inclinación del talud. Unidades de la hoja: kN, kN/m², kN/m³.",
    },
    {
      n: "02",
      title: "Factores de agua y peso de la cuña",
      formula: "ψ1 = ½ NF² γw    ·    W* = ½γsat NF² + ½γd (H²−NF²) + qH",
      result: `ψ1=${fmt(psi1, 1)} kN/m · W*=${fmt(Wfactor, 1)} kN/m`,
    },
    {
      n: "03",
      title: "Inclinación óptima del anclaje",
      formula: "δ = α − arctan(tanφ / FSa)",
      result: `δ_opt = ${fmt(deltaOpt, 1)}°`,
      note: "Minimiza la fuerza de anclaje necesaria para alcanzar FSa.",
    },
    {
      n: "04",
      title: "Resultante sísmica y FS previo",
      formula: "Ru=√(Kh²+(1+Kv)²) · θ=arctan(Kh/(1+Kv)) · R ∝ W*·Ru · FS = Fres/Fmov",
      substitution: `Kh=${fmt(Kh, 2)} · Kv=${fmt(Kv, 2)} · θ=${fmt(theta, 1)}° · Ru=${fmt(Ru, 3)}`,
      result: `R=${fmt(R, 0)} kN/m · Fres=${fmt(Fres, 0)} · Fmov=${fmt(Fmov, 0)} · FS_sin=${fmt(FSsin, 2)}`,
      ok: FSsin >= FSa,
    },
    {
      n: "05",
      title: "Fuerza de anclaje por metro de talud",
      formula: "T = (FSa − FS)·Fmov / [FSa·cos(α−δ) + sen(α−δ)·tanφ]",
      result: T > 0 ? `T = ${fmt(T, 1)} kN/m` : `T = 0 (ya cumple FSa=${fmt(FSa, 2)} sin anclaje)`,
      note: "Si FS_sin ≥ FSa no se requiere anclaje activo; se puede colocar pasivo o de contingencia.",
    },
    {
      n: "06",
      title: "Barra / bulbo (tabla Pfister + adherencia)",
      formula: "n ≈ ceil(T / (Es/FSa))    ·    Lbulbo = T / (π·∅·τ)",
      substitution: `As=${fmt(As, 0)} mm² · Es=${fmt(EsTf, 1)} Tf (${fmt(Es_kN, 0)} kN) · ∅=${fmt(dBarreno * 1000, 0)} mm · τ=${fmt(tauGrout, 2)} MPa`,
      result: `Barras ≈ ${nBarras} · Lbulbo ≈ ${fmt(Lbulbo, 2)} m (orden de magnitud)`,
    },
  ];

  return out(
    T > 0 ? `Anclaje T=${fmt(T, 0)} kN/m · FS_sin=${fmt(FSsin, 2)} → FSa=${fmt(FSa, 2)}` : `Talud OK sin anclaje · FS=${fmt(FSsin, 2)} ≥ ${fmt(FSa, 2)}`,
    `Anclaje ${tipo.toLowerCase()} en condición activa. δ_opt=${fmt(deltaOpt, 1)}°. ${T > 0 ? `T=${fmt(T, 1)} kN/m.` : "No requiere fuerza activa."}`,
    steps,
    [
      ok("FS sin anclaje", fmt(FSsin, 2), `≥ ${fmt(FSa, 2)} (ideal)`, FSsin >= FSa),
      ok("FSa objetivo", fmt(FSa, 2), tipo.startsWith("P") ? "1,5 perm." : "1,2 prov.", true),
    ],
    [
      {
        title: "Resumen anclaje",
        rows: [
          ["Magnitud", "Valor"],
          ["FS sin anclaje", fmt(FSsin, 2)],
          ["FSa pedido", fmt(FSa, 2)],
          ["T (kN/m)", fmt(T, 1)],
          ["δ óptimo (°)", fmt(deltaOpt, 1)],
          ["L bulbo est. (m)", fmt(Lbulbo, 2)],
        ],
      },
    ]
  );
};

/* ═══════════════════════════════════════════════════════════════
   MUROS DE TIERRA ARMADA (MSE)
   ═══════════════════════════════════════════════════════════════ */
/**
 * Muro de tierra armada (MSE) — diseño por capas de refuerzo (FHWA-NHI-10-024/025, AASHTO LRFD):
 * estabilidad interna capa a capa (ruptura y zafadura/pullout, con sismo Mononobe–Okabe), y
 * estabilidad externa del bloque reforzado (volteo, deslizamiento con fricción de la base de
 * fundación, capacidad portante con el término de sobrecarga Nq, y su verificación sísmica).
 * Admite refuerzo inextensible (flejes/tiras metálicas) o extensible (geomalla/geosintético),
 * cada uno con su propio F* de zafadura y su chequeo de resistencia.
 */
export const muroTierraArmada: Engine = (raw) => {
  // Geometría y suelo
  const H = num(raw, "H", 8);
  const D = num(raw, "D", 1);
  const beta = num(raw, "beta", 0);
  const gamma = num(raw, "gamma", 16.6);
  const phi = num(raw, "phi", 30);
  const phiBase = num(raw, "phiBase", 28);
  const cBase = num(raw, "cBase", 52);
  const gammaBase = num(raw, "gammaBase", 18);
  const delta = num(raw, "delta", 20);

  // Cargas
  const q = num(raw, "q", 0);
  const modo = str(raw, "modo", "CON SOBRECARGA");
  const aFranja = num(raw, "aFranja", 4);
  const bFranja = num(raw, "bFranja", 1);
  const qFranja = num(raw, "qFranja", 100);
  const Kh = num(raw, "Kh", 0.15);
  const Kv = num(raw, "Kv", Kh * 0.7);

  // Refuerzo
  const tipoRefuerzo = str(raw, "tipoRefuerzo", "flejes");
  const esFlejes = tipoRefuerzo !== "geomalla";
  const Sv = Math.max(0.1, num(raw, "Sv", 0.6));
  const Sh = Math.max(0.1, num(raw, "Sh", 1));
  const fy = num(raw, "fy", 240000);
  const wFleje = Math.max(0.01, num(raw, "wFleje", 5) / 100);
  const Cu = Math.max(1, num(raw, "Cu", 6));
  const corr = num(raw, "corr", 0.025);
  const Vu = num(raw, "Vu", 50);
  const Tult = num(raw, "Tult", 60);
  const RFcr = Math.max(1, num(raw, "RFcr", 2.2));
  const RFd = Math.max(1, num(raw, "RFd", 1.15));
  const RFid = Math.max(1, num(raw, "RFid", 1.1));

  // Factores de seguridad
  const FSb = Math.max(1, num(raw, "FSb", 1.5));
  const FSp = Math.max(1, num(raw, "FSp", 1.5));
  const FSvoltMin = num(raw, "FSvolt", 2.5);
  const FSdeslMin = num(raw, "FSdesl", 1.5);
  const FScapMin = num(raw, "FScap", 2.5);
  const FSvoltSisMin = num(raw, "FSvoltSis", 1.5);
  const FSdeslSisMin = num(raw, "FSdeslSis", 1.125);
  const FScapSisMin = num(raw, "FScapSis", 1.5);

  const Ka = kaRankine(phi);
  const tanPhi = Math.tan(rad(phi));

  /* ── 1) Estabilidad interna: una capa de refuerzo cada Sv, desde la corona ──
     Cada capa recibe Kr(z) (coeficiente de presión lateral — mayor cerca de la corona para
     refuerzo inextensible, FHWA fig. 3-8), su propio esfuerzo vertical σv(z)=γz+q, la fuerza
     de diseño Tmax=σh·Sv·Sh, y una longitud propia por zafadura F*·α·σv·Le·C ≥ Tmax·FSP. */
  const nCapas = Math.max(1, Math.round(H / Sv));
  const WaCuna = 0.5 * gamma * H * H * Math.tan(rad(45 - phi / 2)); // peso aprox. de la cuña activa
  const TmdTotal = Kh * WaCuna; // incremento sísmico total (AASHTO, método simplificado) a repartir

  type Capa = {
    i: number; z: number; sigmaV: number; krRatio: number; Kr: number; sigmaH: number;
    Tmax: number; TmaxSis: number; La: number; FStar: number; alpha: number; LeReq: number;
    Lmin: number; tReq: number; tReal: number; TalGeo: number; FSruptura: number; FSrupturaSis: number;
  };
  const capas: Capa[] = [];
  for (let i = 1; i <= nCapas; i++) {
    const z = Math.min(H, i * Sv - Sv / 2);
    const krRatio = esFlejes ? (z <= 6 ? 1.7 - (0.7 / 6) * z : 1.0) : 1.0;
    const Kr = Ka * krRatio;
    const sigmaV = gamma * z + q;
    const sigmaH = Kr * sigmaV;
    const Tmax = sigmaH * Sv * Sh;
    const dTmd = (TmdTotal / H) * Sv * Sh;
    const TmaxSis = Tmax + dTmd;

    const La = (H - z) * Math.tan(rad(45 - phi / 2));
    const FStar = esFlejes
      ? (z <= 6 ? (1.2 + Math.log10(Cu)) - ((1.2 + Math.log10(Cu) - tanPhi) / 6) * z : tanPhi)
      : (2 / 3) * tanPhi;
    const alpha = esFlejes ? 1.0 : 0.8;
    const C = 2;
    const LeReq = Math.max(1.0, (Tmax * FSp) / Math.max(1e-6, FStar * alpha * sigmaV * C * Sh));
    const Lmin = Math.max(La + LeReq, 0.7 * H, 2.5);

    let tReq = 0, tReal = 0, TalGeo = 0, FSruptura = 0, FSrupturaSis = 0;
    if (esFlejes) {
      const AsReq = (Tmax * FSb) / fy;
      tReq = (AsReq / wFleje) * 1000;
      tReal = tReq + corr * Vu;
      const AsProv = (tReal / 1000) * wFleje;
      const TalM = AsProv * fy; // capacidad última del acero provisto (sin reducir de nuevo por FSB: FSB ya definió As_req)
      FSruptura = TalM / Math.max(Tmax, 1e-9);
      FSrupturaSis = TalM / Math.max(TmaxSis, 1e-9);
    } else {
      TalGeo = Tult / (RFcr * RFd * RFid);
      FSruptura = TalGeo / Math.max(Tmax, 1e-9);
      FSrupturaSis = TalGeo / Math.max(TmaxSis, 1e-9);
    }

    capas.push({ i, z, sigmaV, krRatio, Kr, sigmaH, Tmax, TmaxSis, La, FStar, alpha, LeReq, Lmin, tReq, tReal, TalGeo, FSruptura, FSrupturaSis });
  }

  const capaGob = capas.reduce((a, b) => (b.Lmin > a.Lmin ? b : a), capas[0]);
  const L = capaGob.Lmin;
  const FSruptMin = Math.min(...capas.map((c) => c.FSruptura));
  const capaFSruptMin = capas.find((c) => c.FSruptura === FSruptMin)!;

  /* ── 2) Estabilidad externa del bloque reforzado (H×L) — estático ── */
  const Pa = 0.5 * gamma * Ka * H * H;
  const PaQ = q * Ka * H;
  const Ma = Pa * (H / 3) + PaQ * (H / 2);
  const W = gamma * H * L + q * L;
  const Mr0 = W * (L / 2) + (modo.includes("CON") ? qFranja * aFranja * (bFranja + aFranja / 2) : 0);
  const FSvolt = Mr0 / Math.max(1e-9, Ma);
  const PaH = Pa + PaQ;
  const FSdesl = (W * Math.tan(rad(phiBase)) + cBase * L) / Math.max(1e-9, PaH);

  const Nq = NqTerzaghi(phiBase);
  const Nc = NcTerzaghi(phiBase, Nq);
  const Ng = NgTerzaghi(phiBase, Nq);
  const e = L / 2 - (Mr0 - Ma) / Math.max(1e-9, W);
  const nucleo = Math.abs(e) <= L / 6;
  const Leff = Math.max(0.1, L - 2 * Math.abs(e));
  const qu = cBase * Nc + gammaBase * D * Nq + 0.5 * gammaBase * Leff * Ng;
  const qmax = W / Leff;
  const FScap = qu / Math.max(1e-9, qmax);

  /* ── 3) Estabilidad externa — sísmica (Mononobe–Okabe sobre el relleno retenido) ── */
  const { Kae } = kaeMononobeOkabe(phi, delta, beta, Kh, Kv);
  const Pae = 0.5 * gamma * H * H * (1 - Kv) * Kae;
  const dPae = Math.max(0, Pae - Pa);
  const PIR = Kh * W;
  const HactSis = PaH + dPae + PIR;
  const MaSis = Ma + dPae * (0.6 * H) + PIR * (H / 2);
  const MrSis = W * (1 - Kv) * (L / 2);
  const FSvoltSis = MrSis / Math.max(1e-9, MaSis);
  const FSdeslSis = (W * (1 - Kv) * Math.tan(rad(phiBase)) + cBase * L) / Math.max(1e-9, HactSis);
  const eSis = L / 2 - (MrSis - MaSis) / Math.max(1e-9, W * (1 - Kv));
  const LeffSis = Math.max(0.1, L - 2 * Math.abs(eSis));
  const quSis = cBase * Nc + gammaBase * D * Nq + 0.5 * gammaBase * LeffSis * Ng;
  const qmaxSis = (W * (1 - Kv)) / LeffSis;
  const FScapSis = quSis / Math.max(1e-9, qmaxSis);

  const nn = (k: number) => String(k).padStart(2, "0");
  const tablaCapas = {
    caption: `Diseño interno por capa (${esFlejes ? "flejes metálicos" : "geomalla"}, Sv=${fmt(Sv, 2)} m, Sh=${fmt(Sh, 2)} m) — capa 1 es la más profunda del listado (mayor z desde la corona)`,
    headers: esFlejes
      ? ["Capa", "z (m)", "σv (kN/m²)", "Kr/Ka", "Tmáx (kN)", "Tmáx sísmico (kN)", "L mín. (m)", "t requerido (mm)", "FS ruptura"]
      : ["Capa", "z (m)", "σv (kN/m²)", "Kr/Ka", "Tmáx (kN)", "Tmáx sísmico (kN)", "L mín. (m)", "Tal (kN)", "FS ruptura"],
    rows: capas.map((c) => [
      String(c.i),
      fmt(c.z, 2),
      fmt(c.sigmaV, 1),
      fmt(c.krRatio, 2),
      fmt(c.Tmax, 2),
      fmt(c.TmaxSis, 2),
      fmt(c.Lmin, 2),
      esFlejes ? fmt(c.tReal, 2) : fmt(c.TalGeo, 1),
      fmt(c.FSruptura, 2),
    ]),
  };

  const steps: CalcStep[] = [
    {
      n: nn(1),
      title: "Empuje activo de diseño y presión lateral por capa",
      formula: "Ka=tan²(45−φ/2)   ·   Kr(z)=Ka·[relación Kr/Ka]   ·   σv(z)=γz+q   ·   σh(z)=Kr·σv",
      formulaTex: String.raw`K_a=\tan^2\!\left(45-\tfrac{\varphi}{2}\right)\qquad K_r(z)=K_a\cdot\dfrac{K_r}{K_a}(z)\qquad \sigma_v(z)=\gamma z+q\qquad \sigma_h(z)=K_r\,\sigma_v`,
      substitution: `φ=${fmt(phi, 1)}° · γ=${fmt(gamma, 2)} kN/m³ · q=${fmt(q, 1)} kN/m² · Ka=${fmt(Ka, 3)}`,
      result: `${nCapas} capas cada Sv=${fmt(Sv, 2)} m entre z=0 y z=H=${fmt(H, 2)} m`,
      note: esFlejes
        ? "Para refuerzo inextensible (flejes/tiras metálicas) el coeficiente Kr/Ka NO es constante: FHWA-NHI-10-024 fig. 3-8 da Kr/Ka=1,7 en la corona (z=0) decreciendo linealmente a 1,0 en z=6 m (y constante 1,0 por debajo) — el suelo cerca de la corona empuja más sobre un refuerzo rígido que sobre uno flexible. Para geomalla (extensible) se usa Kr/Ka=1,0 en toda la altura (método simplificado AASHTO)."
        : "Para refuerzo extensible (geomalla/geosintético) se usa Kr/Ka=1,0 en toda la altura — método simplificado AASHTO/FHWA, a diferencia del refuerzo inextensible (flejes), que concentra más presión cerca de la corona.",
    },
    {
      n: nn(2),
      title: "Resistencia a la zafadura (pullout) por capa",
      formula: "La=(H−z)·tan(45−φ/2)    ·    Pr=F*·α·σv·Le·C·Sh ≥ Tmáx·FSP    ·    L=La+Le",
      formulaTex: String.raw`L_a=(H-z)\tan\!\left(45-\tfrac{\varphi}{2}\right)\qquad P_r=F^*\alpha\,\sigma_v\,L_e\,C\,S_h\ \ge\ T_{max}\,FS_P\qquad L=L_a+L_e`,
      substitution: `FSP=${fmt(FSp, 2)} · C=2 (tira/malla) · α=${esFlejes ? "1,0 (metálico)" : "0,8 (geosintético)"}${esFlejes ? ` · Cu=${fmt(Cu, 1)}` : ` · F*=⅔tanφ=${fmt((2 / 3) * tanPhi, 2)}`}`,
      result: `L mínima gobernante = ${fmt(L, 2)} m (capa ${capaGob.i}, z=${fmt(capaGob.z, 2)} m)`,
      note: "La es la longitud dentro de la cuña activa (no aporta anclaje, solo transmite carga a la fachada); Le es el tramo que debe empotrarse MÁS ALLÁ del plano de falla de Rankine para desarrollar fricción suelo-refuerzo suficiente. F* decrece con la profundidad para flejes (mayor confinamiento cerca de la corona por dilatancia) y se toma constante y conservador (⅔tanφ) para geomalla salvo que el fabricante entregue ensayos de arranque propios.",
      table: tablaCapas,
    },
    {
      n: nn(3),
      title: "Resistencia y espesor/producto de refuerzo por capa",
      formula: esFlejes
        ? "As_req=Tmáx·FSB/fy    ·    t_req=As_req/w_fleje    ·    t_real=t_req+corr·Vu (pérdida sacrificial)"
        : "Tal=Tult/(RFcr·RFd·RFid)    ·    FS_ruptura=Tal/Tmáx ≥ FSB",
      formulaTex: esFlejes
        ? String.raw`A_{s,req}=\dfrac{T_{max}FS_B}{f_y}\qquad t_{req}=\dfrac{A_{s,req}}{w_{fleje}}\qquad t_{real}=t_{req}+\text{corr}\cdot V_u`
        : String.raw`T_{al}=\dfrac{T_{ult}}{RF_{cr}\,RF_d\,RF_{id}}\qquad FS_{ruptura}=\dfrac{T_{al}}{T_{max}}\ge FS_B`,
      substitution: esFlejes
        ? `fy=${fmt(fy, 0)} kN/m² · w=${fmt(wFleje * 100, 1)} cm · corr=${fmt(corr, 3)} mm/año · Vu=${fmt(Vu, 0)} años`
        : `Tult=${fmt(Tult, 1)} kN/m · RFcr=${fmt(RFcr, 2)} · RFd=${fmt(RFd, 2)} · RFid=${fmt(RFid, 2)}`,
      result: esFlejes
        ? `Capa más exigida: ${capas.reduce((a, b) => (b.tReal > a.tReal ? b : a), capas[0]).i} → t_real=${fmt(capas.reduce((a, b) => (b.tReal > a.tReal ? b : a), capas[0]).tReal, 2)} mm`
        : `Tal=${fmt(capas[0].TalGeo, 1)} kN/m (constante) · FS ruptura mínimo=${fmt(FSruptMin, 2)} en capa ${capaFSruptMin.i}`,
      ok: FSruptMin >= FSb - 1e-6,
      note: esFlejes
        ? "corr es la pérdida de espesor sacrificial por corrosión (mm/año, típico 0,020–0,090 según agresividad del relleno — ASTM/AASHTO); se SUMA (no se multiplica) al espesor estructural requerido, porque es una pérdida de sección independiente de la carga."
        : "Los factores de reducción son acumulativos: RFcr (fluencia/creep bajo carga sostenida, el mayor de los tres), RFd (degradación química/oxidación) y RFid (daño mecánico durante la instalación y compactación del relleno) — todos ≥1, tomados de certificados del fabricante o, en su defecto, de FHWA-NHI-10-025 Tabla 4-3.",
    },
    {
      n: nn(4),
      title: "Estabilidad interna — sismo (Mononobe–Okabe, método pseudo-estático simplificado)",
      formula: "Wa≈½γH²tan(45−φ/2)    ·    Tmd,total=Kh·Wa    ·    Tmáx,sismo=Tmáx+Tmd,total·Sv·Sh/H",
      formulaTex: String.raw`W_a\approx\tfrac12\gamma H^2\tan\!\left(45-\tfrac{\varphi}{2}\right)\qquad T_{md}=K_h\,W_a\qquad T_{max,sismo}=T_{max}+\dfrac{T_{md}}{H}\,S_vS_h`,
      substitution: `Kh=${fmt(Kh, 3)} · Kv=${fmt(Kv, 3)} · Wa=${fmt(WaCuna, 1)} kN/m`,
      result: `Tmd,total=${fmt(TmdTotal, 2)} kN/m · FS ruptura sísmico mínimo=${fmt(Math.min(...capas.map((c) => c.FSrupturaSis)), 2)}`,
      ok: Math.min(...capas.map((c) => c.FSrupturaSis)) >= 0.75 * FSb - 1e-6,
      note: "El incremento dinámico Tmd representa la inercia horizontal de la cuña activa bajo el sismo de diseño; se reparte proporcionalmente a la altura tributaria de cada capa y se suma al Tmáx estático (no se combina por SRSS, siguiendo el método simplificado de AASHTO/FHWA para MSE). Se acepta un FS reducido (≈0,75·FSB) para la combinación sísmica, como en el resto de la memoria.",
    },
    {
      n: nn(5),
      title: "Longitud adoptada y mínimos normativos",
      formula: "L_adoptada = máx(L_mín de todas las capas, 0,7H, 2,5 m)",
      result: `L=${fmt(L, 2)} m ${L >= 0.7 * H ? "≥" : "<"} 0,7H=${fmt(0.7 * H, 2)} m — se adopta UNA longitud uniforme para toda la altura (más simple de construir; capas menos exigidas quedan con margen adicional de zafadura)`,
      note: "FHWA-NHI-10-024 exige L≥0,7H (muros con talud/sobrecarga suelen requerir más) y un mínimo absoluto práctico de 2,5–3,0 m para permitir el traslape y la compactación del refuerzo.",
    },
    {
      n: nn(6),
      title: "Estabilidad externa — volteo y deslizamiento (bloque reforzado H×L)",
      formula: "FS_v=Mr/Ma ≥ FSvolt    ·    FS_d=(W·tanφ_base+c_base·L)/Pa ≥ FSdesl",
      formulaTex: String.raw`FS_v=\dfrac{M_r}{M_a}\qquad FS_d=\dfrac{W\tan\varphi_{base}+c_{base}L}{P_a}`,
      substitution: `W=${fmt(W, 1)} kN/m · Pa=${fmt(Pa, 1)} kN/m (+PaQ=${fmt(PaQ, 1)} por sobrecarga q) · φbase=${fmt(phiBase, 1)}° · cbase=${fmt(cBase, 1)} kN/m²`,
      result: `FS_v=${fmt(FSvolt, 2)} · FS_d=${fmt(FSdesl, 2)}`,
      ok: FSvolt >= FSvoltMin && FSdesl >= FSdeslMin,
      note: "El deslizamiento se verifica en la interfaz entre el suelo reforzado y el suelo de FUNDACIÓN (φbase, cbase) — no en el relleno reforzado — porque esa es la superficie potencial más débil bajo la base del muro.",
    },
    {
      n: nn(7),
      title: "Capacidad portante de la base (Terzaghi, con excentricidad)",
      formula: "e=L/2−(Mr−Ma)/W ≤ L/6    ·    qu=c·Nc+γ·D·Nq+½γ·L'·Nγ    ·    FSc=qu/qmáx",
      formulaTex: String.raw`e=\dfrac{L}{2}-\dfrac{M_r-M_a}{W}\le\dfrac{L}{6}\qquad q_u=c\,N_c+\gamma D\,N_q+\tfrac12\gamma L'N_\gamma\qquad FS_c=\dfrac{q_u}{q_{max}}`,
      substitution: `D=${fmt(D, 2)} m · Nc=${fmt(Nc, 2)} · Nq=${fmt(Nq, 2)} · Nγ=${fmt(Ng, 2)}`,
      result: `e=${fmt(e, 3)} m (${nucleo ? "dentro" : "fuera"} del núcleo L/6=${fmt(L / 6, 3)} m) · L'=${fmt(Leff, 2)} m · qu=${fmt(qu, 1)} kN/m² · qmáx=${fmt(qmax, 1)} kN/m² · FSc=${fmt(FScap, 2)}`,
      ok: FScap >= FScapMin && nucleo,
      note: "El término γ·D·Nq (sobrecarga del suelo por delante/alrededor del desplante) faltaba en la hoja de cálculo original — Nq se calculaba pero nunca se sumaba a qu. L' es el ancho efectivo de Meyerhof, que concentra la presión de contacto cuando la resultante cae fuera del centro.",
    },
    {
      n: nn(8),
      title: "Estabilidad externa — verificación sísmica (Mononobe–Okabe)",
      formula: "Kae (M-O) sobre el relleno retenido    ·    FSv,sismo, FSd,sismo, FSc,sismo con ΔPae y la inercia del bloque PIR=Kh·W",
      formulaTex: String.raw`K_{ae}=\dfrac{\sin^2(\varphi+\delta-\theta)}{\cos\theta\,\sin^2\!\theta_w\,\sin(\theta_w+\delta)\left[1+\sqrt{\tfrac{\sin(\varphi+\delta)\sin(\varphi-\theta-\beta)}{\sin(\theta_w+\delta)\sin(\theta_w+\beta)}}\right]^2}\qquad P_{ae}=\tfrac12\gamma H^2(1-K_v)K_{ae}`,
      substitution: `Kh=${fmt(Kh, 3)} · Kv=${fmt(Kv, 3)} · Kae=${fmt(Kae, 3)} (Ka estático=${fmt(Ka, 3)}) · PIR=Kh·W=${fmt(PIR, 1)} kN/m`,
      result: `FSv,sismo=${fmt(FSvoltSis, 2)} · FSd,sismo=${fmt(FSdeslSis, 2)} · FSc,sismo=${fmt(FScapSis, 2)}`,
      ok: FSvoltSis >= FSvoltSisMin && FSdeslSis >= FSdeslSisMin && FScapSis >= FScapSisMin,
      note: "Además del incremento dinámico de empuje ΔPae=Pae−Pa sobre el relleno retenido, se agrega la fuerza de inercia horizontal del propio bloque reforzado PIR=Kh·W (el macizo de suelo armado también \"pesa\" y responde al sismo). Los FS sísmicos objetivo son menores que los estáticos (combinación de cargas excepcional, igual criterio que en la hoja «Muro de contención — sobrecarga y sismo»).",
    },
  ];

  const checks: CalcCheck[] = [
    ok(`Ruptura del refuerzo FS≥${fmt(FSb, 2)}`, fmt(FSruptMin, 2), `≥ ${fmt(FSb, 2)}`, FSruptMin >= FSb - 1e-6),
    ok(`Volteo FS≥${fmt(FSvoltMin, 2)}`, fmt(FSvolt, 2), `≥ ${fmt(FSvoltMin, 2)}`, FSvolt >= FSvoltMin),
    ok(`Deslizamiento FS≥${fmt(FSdeslMin, 2)}`, fmt(FSdesl, 2), `≥ ${fmt(FSdeslMin, 2)}`, FSdesl >= FSdeslMin),
    ok(`Capacidad portante FS≥${fmt(FScapMin, 2)}`, fmt(FScap, 2), `≥ ${fmt(FScapMin, 2)}`, FScap >= FScapMin),
    ok("Excentricidad dentro del núcleo central (e≤L/6)", fmt(Math.abs(e), 3), `≤ ${fmt(L / 6, 3)} m`, nucleo),
    ok(`Volteo sísmico FS≥${fmt(FSvoltSisMin, 2)}`, fmt(FSvoltSis, 2), `≥ ${fmt(FSvoltSisMin, 2)}`, FSvoltSis >= FSvoltSisMin),
    ok(`Deslizamiento sísmico FS≥${fmt(FSdeslSisMin, 2)}`, fmt(FSdeslSis, 2), `≥ ${fmt(FSdeslSisMin, 2)}`, FSdeslSis >= FSdeslSisMin),
    ok(`Capacidad sísmica FS≥${fmt(FScapSisMin, 2)}`, fmt(FScapSis, 2), `≥ ${fmt(FScapSisMin, 2)}`, FScapSis >= FScapSisMin),
  ];

  return out(
    `Tierra armada H=${fmt(H, 1)} m · L=${fmt(L, 1)} m · ${nCapas} capas @ Sv=${fmt(Sv, 2)} m`,
    `MSE con ${esFlejes ? "flejes metálicos" : "geomalla"}: L=${fmt(L, 2)} m (gobierna capa ${capaGob.i}). FSv=${fmt(FSvolt, 2)} · FSd=${fmt(FSdesl, 2)} · FSc=${fmt(FScap, 2)} · sismo: FSv=${fmt(FSvoltSis, 2)} · FSd=${fmt(FSdeslSis, 2)} · FSc=${fmt(FScapSis, 2)}.`,
    steps,
    checks,
    undefined,
    {
      H: fmt(H, 2), L: fmt(L, 2), nCapas: String(nCapas), tipoRefuerzo,
      FSvolt: fmt(FSvolt, 2), FSdesl: fmt(FSdesl, 2), FScap: fmt(FScap, 2),
    }
  );
};

export const murosTierraEngines: Record<string, Engine> = {
  muroContencionSismo,
  pilotesPuntaFuste,
  pilotesPuntaGranuFuste,
  estabilidadBishop,
  anclajesSuelo,
  muroTierraArmada,
};
