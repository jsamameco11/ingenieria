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
  const F = num(raw, "F", 0.4);
  const Bp = num(raw, "Bp", 0.2);
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

  const B1 = Math.max(0, (F - Bp) / 2);
  const Ap = A + B1;
  const hCuna = Ap * Math.tan(rad(beta));
  const B = A + C + F;
  const Hs = Math.max(0.05, H - esp);
  const Ka = kaRankine(phi);
  const Kp = kpRankine(phi);
  const delta = phi * 2 / 3;
  const Hact = H + hCuna;

  const A_rell = A * Hs + B1 * Hs * 0.5 + Ap * hCuna;
  const A_alma = Bp * Hs + B1 * Hs;
  const A_punta = Math.max(0, D - esp) * C;
  const A_base = B * esp;
  const Wrelleno = A_rell * gammaRelleno;
  const Wpunta = A_punta * gammaRelleno;
  const Wbase = A_base * gammaConc;
  const Walma = A_alma * gammaConc;
  const Pa = Math.max(0, 0.5 * Hact ** 2 * Ka * gammaRelleno - 2 * c * Hact * Math.sqrt(Math.max(Ka, 0)));
  const Pw = 0.5 * hSat ** 2 * gammaW;
  const PaV = Pa * Math.sin(rad(beta));
  const Wtot = Wrelleno + Wpunta + Wbase + Walma + PaV;

  const xRell = C + F + (A * Hs * (A / 2) + B1 * Hs * 0.5 * (A + B1 / 3) + Ap * hCuna * (Ap / 2)) / Math.max(A_rell, 1e-9);
  const xPunta = C / 2;
  const xBase = B / 2;
  const xAlma = C + F / 2;
  const xPaV = B;
  const yRell = esp + (Hs + hCuna) / 2;
  const yPunta = esp + Math.max(0, D - esp) / 2;
  const yBase = esp / 2;
  const yAlma = esp + Hs / 2;
  const yW = (Wrelleno * yRell + Wpunta * yPunta + Wbase * yBase + Walma * yAlma) / Math.max(Wtot - PaV, 1e-9);

  const MrRell = Wrelleno * xRell;
  const MrPunta = Wpunta * xPunta;
  const MrBase = Wbase * xBase;
  const MrAlma = Walma * xAlma;
  const MrPaV = PaV * xPaV;
  const Mr = MrRell + MrPunta + MrBase + MrAlma + MrPaV;
  const yPa = Hact / 3;
  const yPw = hSat / 3;
  const MaPa = Pa * yPa;
  const MaPw = Pw * yPw;
  const Ma = MaPa + MaPw;
  const FSv = Mr / Math.max(1e-9, Ma);

  const resistFric = Wtot * Math.tan(rad(phiBase));
  const resistC = cohesBase * B;
  const pasivo = 0.5 * D ** 2 * Kp * gammaSat;
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
  const qu = cohesBase * Nc + gammaRelleno * D * Nq + 0.5 * gammaRelleno * B * Ng;
  const qa = qu / Math.max(FS_cap, 1e-9);
  const FSc = qu / Math.max(1e-9, qMax);

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
  const Kae = denKae > 1e-12 ? numKae / denKae : Ka * 1.3;
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

  const steps: CalcStep[] = [
    {
      n: "01",
      title: "Geometría del muro y de la cimentación",
      formula: "B = C + F + A    ·    Hs = H − e    ·    B1 = (F − B′)/2    ·    h''' = (A+B1)·tan β",
      substitution: `H=${fmt(H, 2)} · e=${fmt(esp, 2)} · A=${fmt(A, 2)} · C=${fmt(C, 2)} · F=${fmt(F, 2)} · B′=${fmt(Bp, 2)} · D=${fmt(D, 2)} m`,
      result: `B = ${fmt(B, 2)} m    ·    Hs = ${fmt(Hs, 2)} m    ·    B1 = ${fmt(B1, 2)} m    ·    h''' = ${fmt(hCuna, 2)} m`,
      desarrollo: [
        "El muro es en voladizo: alma (fuste), zapata corrida de 1.00 m de franja, punta (pata) hacia el desmonte y talón bajo el relleno.",
        `Ancho de cimentación B = C + F + A = ${fmt(C, 2)} + ${fmt(F, 2)} + ${fmt(A, 2)} = ${fmt(B, 2)} m.`,
        `Peralte de zapata e = ${fmt(esp, 2)} m. Profundidad de desplante / suelo de punta D = ${fmt(D, 2)} m.`,
        `Altura de pantalla Hs = H − e = ${fmt(H, 2)} − ${fmt(esp, 2)} = ${fmt(Hs, 2)} m.`,
        `Cuña de talud h''' = ${fmt(Ap, 2)} · tan(${fmt(beta, 1)}°) = ${fmt(hCuna, 2)} m. Altura activa H+h''' = ${fmt(Hact, 2)} m.`,
      ],
      table: {
        caption: "Inventario geométrico por metro lineal",
        headers: ["Parte", "Símbolo", "Medida", "Función"],
        rows: [
          ["Alma / fuste", "Hs × F / B′", `${fmt(Hs, 2)} × ${fmt(F, 2)} / ${fmt(Bp, 2)} m`, "Pantalla en voladizo"],
          ["Punta (pata)", "C × e", `${fmt(C, 2)} × ${fmt(esp, 2)} m`, "Voladizo delantero de la zapata"],
          ["Talón", "A × e", `${fmt(A, 2)} × ${fmt(esp, 2)} m`, "Voladizo bajo el relleno"],
          ["Zapata (cimiento)", "B × e", `${fmt(B, 2)} × ${fmt(esp, 2)} m`, "Losa de cimentación corrida"],
          ["Suelo sobre pata", "(D−e) × C", `${fmt(Math.max(0, D - esp), 2)} × ${fmt(C, 2)} m`, "Peso y pasivo de punta"],
        ],
      },
      note: "Todas las cotas se leen en el croquis. Los brazos de palanca se miden desde la arista delantera de la pata.",
    },
    {
      n: "02",
      title: "Coeficientes de empuje Rankine",
      formula: "Ka = tan²(45° − φ/2)    ·    Kp = tan²(45° + φ/2)    ·    δ ≈ ⅔ φ",
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
      result: `ΣW = ${fmt(Wtot, 2)} t/ml    ·    ȳ del c.g. ≈ ${fmt(yW, 2)} m`,
      table: {
        caption: "Metrado de pesos por metro lineal (brazos desde la pata)",
        headers: ["Elemento", "Área (m²/m)", "γ (t/m³)", "W (t/ml)", "x (m)", "Mr (t·m/ml)"],
        rows: [
          ["Relleno sobre talón + cuña", fmt(A_rell, 3), fmt(gammaRelleno, 2), fmt(Wrelleno, 2), fmt(xRell, 3), fmt(MrRell, 2)],
          ["Suelo sobre la pata", fmt(A_punta, 3), fmt(gammaRelleno, 2), fmt(Wpunta, 2), fmt(xPunta, 3), fmt(MrPunta, 2)],
          ["Zapata de concreto", fmt(A_base, 3), fmt(gammaConc, 2), fmt(Wbase, 2), fmt(xBase, 3), fmt(MrBase, 2)],
          ["Alma / fuste", fmt(A_alma, 3), fmt(gammaConc, 2), fmt(Walma, 2), fmt(xAlma, 3), fmt(MrAlma, 2)],
          ["Componente vertical Pa", "—", "—", fmt(PaV, 2), fmt(xPaV, 3), fmt(MrPaV, 2)],
          ["Total", "—", "—", fmt(Wtot, 2), "—", fmt(Mr, 2)],
        ],
      },
      note: "El momento resistente ΣMr se toma respecto a la arista delantera de la pata (volteo hacia el desmonte).",
    },
    {
      n: "06",
      title: "Momentos actuantes de empuje (estático)",
      formula: "Ma = Pa·(H+h''')/3 + Pw·h''/3",
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
      formula: "FS_d = (c_base·B + W·tan φ_base + Pp) / (Pa + Pw)",
      substitution: `c_base=${fmt(cohesBase, 2)} t/m² · φ_base=${fmt(phiBase, 1)}° · Pp=½ D² Kp γsat`,
      result: `FS_d = ${fmt(FSd, 2)}    (mín. ${fmt(FS_desl, 2)})`,
      ok: FSd + 1e-9 >= FS_desl,
      desarrollo: [
        `Fricción en la base: W·tan φ = ${fmt(Wtot, 2)} · tan(${fmt(phiBase, 1)}°) = ${fmt(resistFric, 2)} t/ml.`,
        `Adherencia: c·B = ${fmt(cohesBase, 2)} × ${fmt(B, 2)} = ${fmt(resistC, 2)} t/ml.`,
        `Pasivo de punta: Pp = ½·${fmt(D, 2)}²·${fmt(Kp, 3)}·${fmt(gammaSat, 2)} = ${fmt(pasivo, 2)} t/ml.`,
        `ΣHr = ${fmt(resistC + resistFric + pasivo, 2)} t/ml.  ΣHa = Pa+Pw = ${fmt(HactSt, 2)} t/ml.`,
        `FS_d = ${fmt(resistC + resistFric + pasivo, 2)} / ${fmt(HactSt, 2)} = ${fmt(FSd, 2)}.`,
      ],
      note: "Se toma el pasivo completo del suelo de punta. Si el terreno frontal puede excavarse, reduzca Pp o anule D.",
    },
    {
      n: "08",
      title: "Estabilidad al volteo (estático)",
      formula: "FS_v = ΣMr / ΣMa",
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
      substitution: `φ_base=${fmt(phiBase, 1)}° · Nc=${fmt(Nc, 2)} · Nq=${fmt(Nq, 2)} · Nγ=${fmt(Ng, 2)} · D=${fmt(D, 2)} m`,
      result: `qu = ${fmt(qu, 2)} t/m²    ·    qa = ${fmt(qa, 2)} t/m²    ·    FS_c = ${fmt(FSc, 2)}    (mín. ${fmt(FS_cap, 2)})`,
      ok: FSc + 1e-9 >= FS_cap,
      desarrollo: [
        "Factores de capacidad para zapata corrida (1.00 m) sobre el suelo de contacto de la base.",
        `qu = ${fmt(cohesBase, 2)}·${fmt(Nc, 2)} + ${fmt(gammaRelleno, 2)}·${fmt(D, 2)}·${fmt(Nq, 2)} + ½·${fmt(gammaRelleno, 2)}·${fmt(B, 2)}·${fmt(Ng, 2)} = ${fmt(qu, 2)} t/m².`,
        `qmáx de servicio = ${fmt(qMax, 2)} t/m². FS_c = ${fmt(qu, 2)} / ${fmt(qMax, 2)} = ${fmt(FSc, 2)}.`,
      ],
    },
    {
      n: "11",
      title: "Empuje sísmico Mononobe–Okabe",
      formula: "θ = arctan[Kh/(1−Kv)]    ·    Pae = ½ γsat H² (1−Kv) Kae    ·    ΔPae = Pae − Pa",
      substitution: `Kh=${fmt(Kh, 3)} · Kv=${fmt(Kv, 3)} · θ=${fmt(theta, 2)}° · δ=${fmt(delta, 1)}° · i=90°`,
      result: `Kae = ${fmt(Kae, 4)}    ·    Pae = ${fmt(Pae, 2)} t/ml    ·    ΔPae = ${fmt(dPae, 2)} t/ml`,
      desarrollo: [
        `θ = arctan(${fmt(Kh, 3)}/(1−${fmt(Kv, 3)})) = ${fmt(theta, 2)}°.`,
        `Kae (M–O, muro vertical) = ${fmt(Kae, 4)}. Pae = ½·${fmt(gammaSat, 2)}·${fmt(H, 2)}²·(1−${fmt(Kv, 3)})·${fmt(Kae, 4)} = ${fmt(Pae, 2)} t/ml.`,
        `Incremento sísmico ΔPae = ${fmt(dPae, 2)} t/ml, aplicado a 0,6 H = ${fmt(yPae, 2)} m (práctica COVENIN / hoja).`,
        `Inercia del muro y relleno: PIR = Kh·W = ${fmt(Kh, 3)}·${fmt(Wtot, 2)} = ${fmt(PIR, 2)} t/ml, al c.g. ȳ=${fmt(yW, 2)} m.`,
      ],
      note: "COVENIN 1756: Kv ≈ 0,7 Kh. El empuje total sísmico no se superpone al estático: se usa Pae o Pa+ΔPae.",
    },
    {
      n: "12",
      title: "Estabilidad sísmica (deslizamiento y volteo)",
      formula: "FS_d,sis = [cB + W(1−Kv)tanφ + ½Pp] / (Pa+Pw+ΔPae+Pq+PIR)    ·    FS_v,sis = Mr(1−Kv) / Ma,sis",
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
      title: "Diseño a flexión del alma (cara de tierra)",
      formula: "d = h − rec − Øest − db/2    ·    ρ = (0,85 f'c/fy)[1−√(1−2Rn/0,85f'c)]    ·    φMn = φ As fy (d−a/2)",
      substitution: `h=F=${fmt(F * 100, 1)} cm · rec=${fmt(rec, 1)} cm · f'c=${fmt(fc, 0)} · fy=${fmt(fy, 0)} · b=100 cm`,
      result: `d = ${fmt(alma.d, 1)} cm    ·    As = ${fmt(alma.As, 2)} cm²/m    ·    ${alma.text}    ·    φMn = ${fmt(alma.phiMn, 2)} t·m`,
      ok: alma.okM && alma.okRho && okEspAlma,
      desarrollo: [
        `Peralte efectivo d = ${fmt(F * 100, 1)} − ${fmt(rec, 1)} − 0,95 − ${fmt(alma.bar.db, 2)}/2 = ${fmt(alma.d, 1)} cm.`,
        `Rn = Mu/(φ b d²) = ${fmt(alma.Rn, 2)} kg/cm².  ρreq = ${fmt(alma.rho, 5)}  ·  ρmín = ${fmt(alma.rhoMin, 5)}  ·  ρmáx = ${fmt(alma.rhoMax, 5)}.`,
        `As = ρ b d = ${fmt(alma.As, 2)} cm²/m → se adopta ${alma.text} (As,prov = ${fmt(alma.AsProv, 2)} cm²/m).`,
        `a = As fy /(0,85 f'c b) = ${fmt(alma.a, 2)} cm.  φMn = 0,90·As·fy·(d−a/2)/1e5 = ${fmt(alma.phiMn, 2)} t·m  ${alma.okM ? "≥ Mu" : "< Mu"}.`,
        "El acero principal va vertical, en la cara del trasdós (tracción). Se ancla en la zapata con ganchos estándar.",
      ],
      note: "ρmín de muro = máx(0,0012 ; 0,8√f'c/fy ; 14/fy). Si φMn < Mu, aumente F o el acero.",
    },
    {
      n: "15",
      title: "Cortante y acero de temperatura del alma",
      formula: "φVc = 0,85 × 0,53√f'c b d    ·    As,temp = 0,002 b h    (horizontal)",
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
      title: "Diseño de la punta (pata) de la zapata",
      formula: "M↑ = qpata C²/3 + qalma C²/6    ·    M↓ = (Wlos+Wsuelo)·C/2    ·    Mu = 1,4 (M↑−M↓)",
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
      n: "17",
      title: "Diseño del talón de la zapata",
      formula: "M↓ = (γ Hs,eq + γc e) A²/2    ·    M↑ = qtalón A²/3 + qalma A²/6    ·    Mu = 1,4 (M↓−M↑)",
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
      n: "18",
      title: "Peralte y cortante de la losa de cimentación",
      formula: "d ≥ recZap + Ø/2 + holgura    ·    Vu se toma a una distancia d de la cara del alma",
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
      note: "Un dentellón bajo la pata aumenta el pasivo y la cuña de deslizamiento; no se ha modelado. Si lo dispone, súmelo a D y a Pp.",
    },
    {
      n: "19",
      title: "Cuadro de aceros por metro lineal",
      formula: "s = (as / As) · 100 cm    ·    s ≤ 3h y ≤ 25 cm (distribución de muro)",
      result: `Pantalla ${alma.text}    ·    Pata ${pata.text} inf.    ·    Talón ${talon.text} sup.    ·    Temp. Ø ${barH.name} @ ${sTemp} cm`,
      table: {
        caption: "Despiece de refuerzo — franja 1.00 m",
        headers: ["Elemento", "Cara", "As req. (cm²/m)", "Adopción", "As prov.", "φMn (t·m)", "φVc (t)"],
        rows: [
          ["Alma / pantalla", "Trasdós, vertical", fmt(alma.As, 2), alma.text, fmt(alma.AsProv, 2), fmt(alma.phiMn, 2), fmt(alma.phiVc, 2)],
          ["Alma, temperatura", "Horizontal", fmt(AsTemp, 2), `Ø ${barH.name} @ ${sTemp} cm`, fmt((barH.as / sTemp) * 100, 2), "—", "—"],
          ["Punta (pata)", "Inferior", fmt(pata.As, 2), pata.text, fmt(pata.AsProv, 2), fmt(pata.phiMn, 2), fmt(pata.phiVc, 2)],
          ["Talón", "Superior", fmt(talon.As, 2), talon.text, fmt(talon.AsProv, 2), fmt(talon.phiMn, 2), fmt(talon.phiVc, 2)],
          ["Repartición zapata", "Ortogonal", fmt(0.0012 * 100 * esp * 100, 2), `Ø 3/8" @ ${snapSpacing(spacingFor(0.0012 * 100 * esp * 100, barH.as))} cm`, "—", "—", "—"],
        ],
      },
      note: `Anclaje de pantalla en zapata: ℓd ≈ ${fmt(ld, 0)} cm. Doble el vertical hacia el talón. Recubrimiento alma ${fmt(rec, 1)} cm · zapata ${fmt(recZap, 1)} cm.`,
    },
  ];

  return out(
    `Muro H=${fmt(H, 2)} m · B=${fmt(B, 2)} m · FSd=${fmt(FSd, 2)} · FSv=${fmt(FSv, 2)} · ${alma.text}`,
    `Muro en voladizo con zapata corrida B=${fmt(B, 2)} m (pata C=${fmt(C, 2)} m, talón A=${fmt(A, 2)} m, e=${fmt(esp, 2)} m). Estabilidad: FSd=${fmt(FSd, 2)}, FSv=${fmt(FSv, 2)}, FSc=${fmt(FSc, 2)}. Acero: pantalla ${alma.text} al trasdós; pata ${pata.text} inf.; talón ${talon.text} sup.`,
    steps,
    [
      ok("Deslizamiento estático", fmt(FSd, 2), `≥ ${fmt(FS_desl, 2)}`, FSd >= FS_desl),
      ok("Volteo estático", fmt(FSv, 2), `≥ ${fmt(FS_volt, 2)}`, FSv >= FS_volt),
      ok("Núcleo |e| ≤ B/6", `${fmt(eAbs, 3)} m`, `≤ ${fmt(eLim, 3)} m`, nucleo),
      ok("Capacidad de la zapata", fmt(FSc, 2), `≥ ${fmt(FS_cap, 2)}`, FSc >= FS_cap),
      ok("Deslizamiento sísmico", fmt(FSdEq, 2), `≥ ${fmt(FS_deslSis, 2)}`, FSdEq >= FS_deslSis),
      ok("Volteo sísmico", fmt(FSvEq, 2), `≥ ${fmt(FS_voltSis, 2)}`, FSvEq >= FS_voltSis),
      ok("Flexión del alma φMn ≥ Mu", fmt(alma.phiMn, 2), `≥ ${fmt(MuStem, 2)} t·m`, alma.okM),
      ok("Corte del alma φVc ≥ Vu", fmt(alma.phiVc, 2), `≥ ${fmt(VuStem, 2)} t`, alma.okV),
      ok("Flexión de la pata", fmt(pata.phiMn, 2), `≥ ${fmt(MuToe, 2)} t·m`, pata.okM),
      ok("Corte de la pata (a d)", fmt(pata.phiVc, 2), `≥ ${fmt(VuToe_d, 2)} t`, pata.okV),
      ok("Flexión del talón", fmt(talon.phiMn, 2), `≥ ${fmt(MuHeel, 2)} t·m`, talon.okM),
      ok("Corte del talón (a d)", fmt(talon.phiVc, 2), `≥ ${fmt(VuHeel_d, 2)} t`, talon.okV),
    ],
    [
      {
        title: "Resumen de estabilidad y diseño",
        rows: [
          ["Verificación", "Valor", "Límite"],
          ["FS deslizamiento", fmt(FSd, 2), fmt(FS_desl, 2)],
          ["FS volteo", fmt(FSv, 2), fmt(FS_volt, 2)],
          ["Excentricidad e", `${fmt(e, 3)} m`, `±${fmt(eLim, 3)} m`],
          ["q pata / q talón", `${fmt(qToe, 2)} / ${fmt(qHeel, 2)} t/m²`, `qa=${fmt(qa, 2)}`],
          ["FS capacidad", fmt(FSc, 2), fmt(FS_cap, 2)],
          ["FS desliz. sismo", fmt(FSdEq, 2), fmt(FS_deslSis, 2)],
          ["FS volteo sismo", fmt(FSvEq, 2), fmt(FS_voltSis, 2)],
          ["Pantalla", alma.text, `Mu=${fmt(MuStem, 2)} t·m`],
          ["Pata", pata.text, `Mu=${fmt(MuToe, 2)} t·m`],
          ["Talón", talon.text, `Mu=${fmt(MuHeel, 2)} t·m`],
        ],
      },
    ],
    {
      Hs: Hs.toFixed(3),
      H: H.toFixed(3),
      C: C.toFixed(3),
      A: A.toFixed(3),
      F: F.toFixed(3),
      MuStem: MuStem.toFixed(3),
      MuToe: MuToe.toFixed(3),
      MuHeel: MuHeel.toFixed(3),
      asAlma: alma.text,
      asPata: pata.text,
      asTalon: talon.text,
      AsAlma: alma.As.toFixed(2),
      AsPata: pata.As.toFixed(2),
      AsTalon: talon.As.toFixed(2),
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
export const muroTierraArmada: Engine = (raw) => {
  const gamma = num(raw, "gamma", 16.6);
  const phi = num(raw, "phi", 30);
  const phiBase = num(raw, "phiBase", 28);
  const cBase = num(raw, "cBase", 52);
  const gammaBase = num(raw, "gammaBase", 18);
  const H = num(raw, "H", 8);
  const Sv = num(raw, "Sv", 0.5);
  const Sh = num(raw, "Sh", 1);
  const fy = num(raw, "fy", 240000);
  const delta = num(raw, "delta", 20);
  const corr = num(raw, "corr", 0.025);
  const Vu = num(raw, "Vu", 50);
  const FSb = num(raw, "FSb", 3);
  const FSp = num(raw, "FSp", 3);
  const modo = str(raw, "modo", "CON SOBRECARGA");
  const aFranja = num(raw, "aFranja", 4);
  const bFranja = num(raw, "bFranja", 1);
  const qFranja = num(raw, "qFranja", 100);

  const Ka = kaRankine(phi);
  const z = H / 3;
  const Pa = 0.5 * gamma * Ka * H * H;
  const Vmax = gamma * H * Ka; // corte máx. por m (presión*altura simplificada hoja: γH·Ka)
  const Tmax = Vmax * Sv * Sh;
  const tReq = ((Tmax * FSb) / (fy * 1)) * 1000; // mm si fy en kN/m² y T en kN
  const tReal = tReq * (1 + corr * Vu);
  const Lgeom = (H - 0) / Math.tan(rad(45 + phi / 2));
  const sigmaV = gamma * z;
  const Lpull =
    modo.includes("SIN")
      ? Lgeom + (FSp * (gamma * z * Ka) * Sv * Sh) / (2 * fy * 0.001 * sigmaV * Math.tan(rad(delta)) + 1e-9)
      : Lgeom + 2;
  void Lpull;
  // Usar longitud típica hoja ≈ (H-z)/tan(45+φ/2) + FSp·...
  const Ltirante = (H - z) / Math.tan(rad(45 + phi / 2)) + (FSp * (gamma * z * Ka) * Sv * Sh) / Math.max(1e-6, 2 * (fy / 1000) * sigmaV * Math.tan(rad(delta)));

  const W = gamma * H * Ltirante;
  const brazo = Ltirante / 2;
  const Ma = Pa * (H / 3);
  const Mr = W * brazo + (modo.includes("CON") ? qFranja * aFranja * (bFranja + aFranja / 2) : 0);
  const FSvolt = Mr / Math.max(1e-9, Ma);
  const FSdesl = ((W + (modo.includes("CON") ? qFranja * aFranja : 0)) * Math.tan(rad((2 / 3) * phi))) / Math.max(1e-9, Pa);

  const Nq = NqTerzaghi(phiBase);
  const Nc = NcTerzaghi(phiBase, Nq);
  const Ng = NgTerzaghi(phiBase, Nq);
  const e = Ltirante / 2 - (W * brazo - Ma) / Math.max(1e-9, W);
  const Leff = Ltirante - 2 * Math.abs(e);
  const qu = cBase * Nc + 0.5 * gammaBase * Leff * Ng;
  const qmax = W / Math.max(Leff, 0.1);
  const FScap = qu / Math.max(1e-9, qmax);

  const steps: CalcStep[] = [
    {
      n: "01",
      title: "Empuje activo Rankine en el relleno armado",
      formula: "Ka = tan²(45−φ/2)    ·    Pa = ½ γ Ka H²",
      result: `Ka=${fmt(Ka, 3)} · Pa=${fmt(Pa, 1)} kN/m · H=${fmt(H, 2)} m · modo=${modo}`,
      note: "Hoja «MUROS DE TIERRA ARMADA»: el muro es un macizo de suelo reforzado con tirantes; la fachada solo confina.",
    },
    {
      n: "02",
      title: "Fuerza máxima del tirante y espesor",
      formula: "V≈γ H Ka    ·    T = V·Sv·Sh    ·    t = (T·FSB)/(fy) · (1+corr·Vu)",
      substitution: `Sv=${fmt(Sv, 2)} m · Sh=${fmt(Sh, 2)} m · fy=${fmt(fy, 0)} · FSB=${fmt(FSb, 1)} · Vu=${fmt(Vu, 0)} años`,
      result: `Tmáx=${fmt(Tmax, 2)} kN · t_req=${fmt(tReq, 2)} mm · t_real=${fmt(tReal, 2)} mm`,
      note: "FS(B)=ruptura del tirante; la corrosión aumenta el espesor con la vida útil Vu.",
    },
    {
      n: "03",
      title: "Longitud del tirante (resistencia a zafadura)",
      formula: "L = (H−z)/tan(45+φ/2) + FSP·(σh·Sv·Sh)/(2·σv·tanδ·t_cap)",
      result: `L ≈ ${fmt(Ltirante, 2)} m    (z=H/3=${fmt(z, 2)} m · FSP=${fmt(FSp, 1)})`,
    },
    {
      n: "04",
      title: "Estabilidad externa — volteo",
      formula: "FS_v = (W·L/2 [+ q·a'·brazo]) / (Pa·H/3)    ≥ 3",
      result: `FS_v = ${fmt(FSvolt, 2)}`,
      ok: FSvolt >= 3,
    },
    {
      n: "05",
      title: "Estabilidad externa — deslizamiento",
      formula: "FS_d = (W·tan(2φ/3)) / Pa    ≥ 3",
      result: `FS_d = ${fmt(FSdesl, 2)}`,
      ok: FSdesl >= 3,
    },
    {
      n: "06",
      title: "Capacidad portante de la base",
      formula: "qu = c Nc + ½ γ L' Nγ    ·    e = L/2 − (Mr−Ma)/W    ·    L' = L − 2e",
      result: `e=${fmt(e, 3)} m · L'=${fmt(Leff, 2)} m · qu=${fmt(qu, 0)} · FS_c=${fmt(FScap, 2)}`,
      ok: FScap >= 2,
    },
  ];

  return out(
    `Tierra armada H=${fmt(H, 1)} m · L=${fmt(Ltirante, 1)} m · t=${fmt(tReal, 1)} mm`,
    `MSE con tirantes L≈${fmt(Ltirante, 2)} m y espesor ${fmt(tReal, 2)} mm. FSv=${fmt(FSvolt, 1)} · FSd=${fmt(FSdesl, 1)} · FSc=${fmt(FScap, 1)}.`,
    steps,
    [
      ok("Volteo FS≥3", fmt(FSvolt, 2), "≥ 3", FSvolt >= 3),
      ok("Deslizamiento FS≥3", fmt(FSdesl, 2), "≥ 3", FSdesl >= 3),
      ok("Capacidad FS≥2", fmt(FScap, 2), "≥ 2", FScap >= 2),
    ]
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
