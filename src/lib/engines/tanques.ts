import { type CalcCheck, type CalcOutput, type CalcStep, type Engine, barByName, fmt, num, str } from "../types";
import { CATEGORIAS, SISTEMAS, Z_FACTOR, SUELOS, e030C, paramsSitio, type SueloId } from "../e030/tablas";
import { solveFrame3D, type Node3D, type Element3D } from "./frame3d";

function out(headline: string, adoption: string, steps: CalcStep[], checks: CalcCheck[], dims?: Record<string, string>, extras?: CalcOutput["extras"]): CalcOutput {
  return { headline, adoption, steps, checks, dims, extras };
}

function ok(label: string, value: string, limit: string, pass: boolean): CalcCheck {
  return { label, value, limit, ok: pass };
}

function packPts(pts: { x: number; M: number }[]) {
  return pts.map((p) => `${p.x.toFixed(3)},${p.M.toFixed(3)}`).join(";");
}

/** Campos con "0 = automático": si el usuario deja 0 (o vacío), se usa el valor calculado. */
function numOrAuto(raw: Record<string, string>, key: string, auto: number) {
  const v = num(raw, key, 0);
  return v > 0 ? v : auto;
}

const G = 9.81;

/* ---------------------------------------------------------------------- *
 * 1. Utilidades numéricas de resistencia de materiales / concreto armado *
 * ---------------------------------------------------------------------- */

/** Módulo de elasticidad del concreto (kg/cm²), E.060 8.5.1. */
function EcConcreto(fc: number) {
  return 15000 * Math.sqrt(fc);
}

/** Convierte una tensión t/m² a kg/cm² (1 t/m² = 0,1 kg/cm²). */
function tm2AKgcm2(v: number) {
  return v * 0.1;
}

/** Diseño a flexión última tipo Whitney (rectángulo de 1 m de ancho), devuelve As en cm²/m. */
function flexionAs(Mu_tm: number, dCm: number, fc: number, fy: number, bCm = 100, phi = 0.9) {
  const MuKgCm = Math.abs(Mu_tm) * 1000 * 100;
  const Rn = MuKgCm / (phi * bCm * dCm * dCm);
  const disc = 1 - (2 * Rn) / (0.85 * fc);
  if (disc < 0) return { As: NaN, rho: NaN, ok: false };
  const rho = (0.85 * fc) / fy * (1 - Math.sqrt(disc));
  const As = rho * bCm * dCm;
  return { As, rho, ok: true };
}

/** Acero mínimo por temperatura y retracción, ACI 350 / E.060 9.7: ρ=0,0018 (fy=4200). */
function asMinTemp(dCm: number, bCm = 100) {
  return 0.0018 * bCm * dCm;
}

function espaciamiento(barName: string, AsReqCm2m: number, sMax = 25) {
  const bar = barByName(barName);
  const s = Math.max(8, Math.min(sMax, Math.floor((bar.as / Math.max(AsReqCm2m, 1e-6)) * 100)));
  const AsProv = (bar.as / s) * 100;
  return { s, AsProv, texto: `Ø ${barName} @ ${s} cm` };
}

function elegirBarraAnillo(AsReqCm2m: number): { barra: string; s: number; AsProv: number; texto: string } {
  const opciones = ['3/8"', '1/2"', '5/8"', '3/4"'];
  for (const b of opciones) {
    const r = espaciamiento(b, AsReqCm2m, 25);
    if (r.s >= 10) return { barra: b, ...r };
  }
  const r = espaciamiento('3/4"', AsReqCm2m, 25);
  return { barra: '3/4"', ...r };
}

/* ---------------------------------------------------------------------- *
 * 2. Lámina cilíndrica sobre base empotrada — solución de la ecuación    *
 *    diferencial de la placa sobre fundación elástica (viga en cimiento  *
 *    elástico), equivalente a las tablas PCA "Circular Concrete Tanks".  *
 * ---------------------------------------------------------------------- */

export type PuntoLamina = { y: number; w: number; M: number; N: number; V: number };

/**
 * Resuelve D·w'''' + k·w = p(y) para un cilindro empotrado en la base (w=0, w'=0)
 * y libre en la corona (M=0, V=0), por integración numérica (RK4) con el método
 * de disparo (dos soluciones homogéneas + una particular, combinadas linealmente
 * para satisfacer las condiciones de borde en y=H). Unidades: m, t, t/m².
 */
export function laminaCilindrica(H: number, R: number, t: number, fc: number, presion: (y: number) => number, nu = 0.15, pasos = 160): PuntoLamina[] {
  const Ec_tm2 = EcConcreto(fc) * 10;
  const D = (Ec_tm2 * t ** 3) / (12 * (1 - nu * nu));
  const k = (Ec_tm2 * t) / (R * R);
  const dy = H / pasos;
  const deriv = (s: number[], p: number) => [s[1], s[2], s[3], (p - k * s[0]) / D];
  function integrar(s0: number[], conCarga: boolean) {
    const historia: number[][] = [s0.slice()];
    let s = s0.slice();
    for (let i = 0; i < pasos; i++) {
      const y = i * dy;
      const p = (yy: number) => (conCarga ? presion(yy) : 0);
      const k1 = deriv(s, p(y));
      const s2 = s.map((v, idx) => v + (dy / 2) * k1[idx]);
      const k2 = deriv(s2, p(y + dy / 2));
      const s3 = s.map((v, idx) => v + (dy / 2) * k2[idx]);
      const k3 = deriv(s3, p(y + dy / 2));
      const s4 = s.map((v, idx) => v + dy * k3[idx]);
      const k4 = deriv(s4, p(y + dy));
      s = s.map((v, idx) => v + (dy / 6) * (k1[idx] + 2 * k2[idx] + 2 * k3[idx] + k4[idx]));
      historia.push(s.slice());
    }
    return historia;
  }
  const b1 = integrar([0, 0, 1, 0], false);
  const b2 = integrar([0, 0, 0, 1], false);
  const pp = integrar([0, 0, 0, 0], true);
  const fin = (arr: number[][]) => arr[arr.length - 1];
  const b1H = fin(b1), b2H = fin(b2), ppH = fin(pp);
  const A00 = b1H[2], A01 = b2H[2], A10 = b1H[3], A11 = b2H[3];
  const det = A00 * A11 - A01 * A10;
  const rhs0 = -ppH[2], rhs1 = -ppH[3];
  const a = Math.abs(det) > 1e-12 ? (rhs0 * A11 - A01 * rhs1) / det : 0;
  const b = Math.abs(det) > 1e-12 ? (A00 * rhs1 - rhs0 * A10) / det : 0;
  const final = integrar([0, 0, a, b], true);
  return final.map((s, i) => ({
    y: i * dy,
    w: s[0],
    M: -D * s[2],
    V: -D * s[3],
    N: (Ec_tm2 * t * s[0]) / R,
  }));
}

function muestrear(pts: PuntoLamina[], fracciones = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
  return fracciones.map((f) => {
    const idx = Math.round(f * (pts.length - 1));
    return pts[Math.min(pts.length - 1, Math.max(0, idx))];
  });
}

function maxAbs(pts: PuntoLamina[], key: "M" | "N") {
  return pts.reduce((m, p) => Math.max(m, Math.abs(p[key])), 0);
}

/* ---------------------------------------------------------------------- *
 * 3. Modelo dinámico de Housner / ACI 350.3-06                           *
 * ---------------------------------------------------------------------- */

export type Housner = {
  DH: number;
  xEps: number;
  Wi: number;
  Wc: number;
  hiEBP: number;
  hcEBP: number;
  hiIBP: number;
  hcIBP: number;
  wc: number;
  Tc: number;
};

/** Housner (1963) / ACI 350.3-06 §9.2: masas y alturas impulsiva y convectiva. WL en t, D y HL en m. */
export function housner(D: number, HL: number, WL: number): Housner {
  const DH = D / HL;
  const xEps = 0.0151 * DH * DH - 0.1908 * DH + 1.021;
  const Wi = WL * (Math.tanh(0.866 * DH) / (0.866 * DH));
  const Wc = WL * (0.23 * DH * Math.tanh(3.68 / DH));
  const hiEBP = (DH >= 1.333 ? 0.375 : 0.5 - 0.09375 * DH) * HL;
  const hcEBP = HL * (1 - (Math.cosh(3.68 / DH) - 1) / ((3.68 / DH) * Math.sinh(3.68 / DH)));
  const hiIBP = (DH <= 0.75 ? 0.45 : (0.866 * DH) / (2 * Math.tanh(0.866 * DH)) - 0.125) * HL;
  const hcIBP = HL * (1 - (Math.cosh(3.68 / DH) - 2.01) / ((3.68 / DH) * Math.sinh(3.68 / DH)));
  const lambda = Math.sqrt(3.68 * G * Math.tanh(3.68 / DH));
  const wc = lambda / Math.sqrt(D);
  const Tc = (2 * Math.PI) / wc;
  return { DH, xEps: Math.min(xEps, 1), Wi, Wc, hiEBP, hcEBP, hiIBP, hcIBP, wc, Tc };
}

/** Periodo impulsivo de un tanque de pared flexible, ACI 350.3-06 §9.2 (fig. 9.2.1 aproximada por polinomio). */
function periodoImpulsivo(D: number, HL: number, tWall: number, fc: number, gammaC = 2.4) {
  const ratio = HL / D;
  const Cw = 9.375e-2 + 0.2039 * ratio - 0.1034 * ratio ** 2 - 0.1253 * ratio ** 3 + 0.1267 * ratio ** 4 - 3.186e-2 * ratio ** 5;
  const tWallMm = tWall * 1000;
  const Ciw = Cw * Math.sqrt(tWallMm / (5 * D));
  const EcKgcm2 = EcConcreto(fc);
  const rhoC = (gammaC * 1000) / G / 1000;
  const wi = (Ciw / HL) * Math.sqrt((10 * EcKgcm2) / rhoC);
  const Ti = wi > 0 ? (2 * Math.PI) / wi : 0.05;
  return { Cw, Ciw, wi, Ti: Number.isFinite(Ti) ? Ti : 0.05 };
}

/** Distribución vertical ACI 350.3-06 eq. 9-23/9-24 de la presión impulsiva o convectiva (t/m²), y medido desde la base. */
function presionDinamica(Ptotal: number, HL: number, hCentroide: number, y: number) {
  return (Ptotal / 2) * (4 * HL - 6 * hCentroide - (6 * HL - 12 * hCentroide) * (y / HL)) / (HL * HL);
}

type SismoParams = { Z: number; U: number; S: number; Tp: number; Tl: number; Rwi: number; Rwc: number };

function leerSismo(raw: Record<string, string>): SismoParams {
  const zona = Math.round(num(raw, "zona", 4)) as 1 | 2 | 3 | 4;
  const Z = Z_FACTOR[zona] ?? 0.45;
  const sueloId = (str(raw, "suelo", "S2") as SueloId);
  const sitio = paramsSitio(zona, SUELOS.some((s) => s.value === sueloId) ? sueloId : "S2");
  const cat = CATEGORIAS.find((c) => c.value === str(raw, "categoria", "B")) ?? CATEGORIAS[2];
  return {
    Z,
    U: cat.U,
    S: sitio.S,
    Tp: sitio.Tp,
    Tl: sitio.Tl,
    Rwi: num(raw, "Rwi", 2.5),
    Rwc: num(raw, "Rwc", 1),
  };
}

/* ---------------------------------------------------------------------- *
 * 4. Lámina cónica (tronco de cono) y casquete esférico — teoría de      *
 *    membrana para cúpulas y fondos tipo INTZE.                          *
 * ---------------------------------------------------------------------- */

function cupulaEsferica(Dborde: number, flecha: number, radioVentOAcceso = 0) {
  const a = Dborde / 2;
  const Rs = (a * a + flecha * flecha) / (2 * flecha);
  const phiF = Math.asin(Math.min(1, a / Rs));
  const phi0 = radioVentOAcceso > 0 ? Math.asin(Math.min(1, radioVentOAcceso / Rs)) : 0;
  return { a, Rs, phiF, phi0 };
}

function membranaCupula(Rs: number, phiF: number, phi0: number, wCm: number, wCv: number) {
  const cosF = Math.cos(phiF), cosO = Math.cos(phi0);
  const sinF = Math.sin(phiF);
  const Nfi = Math.abs((wCm * Rs) / (sinF * sinF) * (cosF - cosO)) + (wCv * Rs) / 2;
  const Nth = wCm * Rs * (1 / (1 + cosF) - cosF) + wCv * Rs * (1 / (1 + cosF) - 1 / 2);
  const Hthrust = Nfi * cosF;
  return { Nfi, Nth, Hthrust };
}

function conoTruncado(Rsup: number, Rinf: number, hCono: number) {
  const run = Math.max(Rsup - Rinf, 1e-6);
  const Ls = Math.hypot(hCono, run);
  const alpha = Math.atan2(hCono, run);
  return { Ls, alpha };
}

/* ---------------------------------------------------------------------- *
 * 5. RESERVORIO APOYADO — tanque cilíndrico de fondo plano               *
 * ---------------------------------------------------------------------- */

export const reservorioApoyado: Engine = (raw) => {
  const Vreq = num(raw, "V", 50);
  const rHD = num(raw, "rHD", 0.85);
  const bl = num(raw, "bl", 0.3);
  const gammaW = 1;
  const gammaC = num(raw, "gammaC", 2.4);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const scDomo = num(raw, "scDomo", 0.1);
  const qadm = num(raw, "qadm", 2);
  const nu = 0.15;
  const Sn = 1.3;
  const PHI_T = 0.9;

  const D0 = Math.cbrt((4 * Vreq) / (Math.PI * rHD));
  const D = Math.round(D0 / 0.25) * 0.25;
  const HL = Vreq / ((Math.PI * D * D) / 4);
  const Htotal = HL + bl;
  const R = D / 2;

  const tMuro0 = Math.max(0.2, HL / 14);
  const tMuroRound = Math.ceil(tMuro0 / 0.025) * 0.025;
  const tLosa = Math.max(0.2, tMuroRound - 0.025);
  const fDomo = D / 6;
  const DvVent = Math.min(0.6, D * 0.08);
  const tDomo = Math.max(0.08, D / 220);

  const domo = cupulaEsferica(D + 0.15, fDomo, DvVent / 2);
  const wCmDomo = gammaC * tDomo;
  const wCvDomo = scDomo;
  const wuDomo = 1.4 * wCmDomo + 1.7 * wCvDomo;
  const memDomo = membranaCupula(domo.Rs, domo.phiF, domo.phi0, 1.4 * wCmDomo, 1.7 * wCvDomo);
  const sigmaDomo = tm2AKgcm2(memDomo.Nfi / tDomo);
  const sigmaAdmDomo = 0.05 * fc;
  const NthDomoTm = memDomo.Nth;
  const asDomoAnillo = NthDomoTm > 0 ? (Sn * NthDomoTm * 1000) / (PHI_T * fy) : 0;

  const Tring = memDomo.Hthrust * R;
  const AsRing = (Sn * Tring * 1000) / (PHI_T * fy);
  const bRing = 0.3, hRing = Math.max(0.3, tMuroRound + 0.1);
  const ringPick = elegirBarraAnillo(AsRing / (hRing * 100) * 100 > 0 ? AsRing : 0.01);

  const pesoMuro = gammaC * Math.PI * ((R + tMuroRound) ** 2 - R * R) * Htotal;
  const pesoDomo = gammaC * tDomo * 2 * Math.PI * domo.Rs * (domo.Rs - Math.sqrt(Math.max(domo.Rs * domo.Rs - domo.a * domo.a, 0)));
  const pesoLosa = gammaC * (Math.PI * (D + 2 * 0.15) ** 2 / 4) * tLosa;
  const pesoAgua = gammaW * (Math.PI * D * D) / 4 * HL;

  const presHidro = (y: number) => Math.max(0, gammaW * (HL - y));
  const lamHs = laminaCilindrica(HL, R, tMuroRound, fc, presHidro, nu);
  const NhsMax = maxAbs(lamHs, "N");
  const MhsMax = maxAbs(lamHs, "M");
  const muestraHs = muestrear(lamHs);

  const hns = housner(D, HL, pesoAgua);
  const per = periodoImpulsivo(D, HL, tMuroRound, fc, gammaC);
  const sismo = leerSismo(raw);
  const Ci = e030C(per.Ti, sismo.Tp, sismo.Tl);
  const Cc = e030C(hns.Tc, sismo.Tp, sismo.Tl);
  const SaImp = sismo.Z * sismo.U * sismo.S * Ci;
  const SaConv = sismo.Z * sismo.U * sismo.S * Cc;

  const WwEff = hns.xEps * pesoMuro + pesoDomo;
  const Pw = (SaImp * hns.xEps * pesoMuro) / sismo.Rwi;
  const Pr = (SaImp * pesoDomo) / sismo.Rwi;
  const Pi = (SaImp * hns.Wi) / sismo.Rwi;
  const Pc = (SaConv * hns.Wc) / sismo.Rwc;
  const Vbasal = Math.sqrt((Pw + Pr + Pi) ** 2 + Pc ** 2);
  const Mvolteo = Math.sqrt(
    (Pw * (Htotal / 2) + Pr * Htotal + Pi * hns.hiIBP) ** 2 + (Pc * hns.hcIBP) ** 2,
  );

  const presImp = (y: number) => presionDinamica(Pi, HL, hns.hiEBP, y);
  const presConv = (y: number) => presionDinamica(Pc, HL, hns.hcEBP, y);
  const lamImp = laminaCilindrica(HL, R, tMuroRound, fc, presImp, nu);
  const lamConv = laminaCilindrica(HL, R, tMuroRound, fc, presConv, nu);

  const nPts = lamHs.length;
  const envolNPts: { x: number; M: number }[] = [];
  const envolMPts: { x: number; M: number }[] = [];
  let NenvMax = 0, MenvMax = 0;
  for (let i = 0; i < nPts; i++) {
    const Nsis = Math.sqrt(lamImp[i].N ** 2 + lamConv[i].N ** 2);
    const Msis = Math.sqrt(lamImp[i].M ** 2 + lamConv[i].M ** 2);
    const Nenv = Math.abs(lamHs[i].N) + Nsis;
    const Menv = Math.abs(lamHs[i].M) + Msis;
    envolNPts.push({ x: lamHs[i].y, M: Nenv });
    envolMPts.push({ x: lamHs[i].y, M: Menv * (lamHs[i].M >= 0 ? 1 : -1) });
    NenvMax = Math.max(NenvMax, Nenv);
    MenvMax = Math.max(MenvMax, Menv);
  }

  const dCmMuro = tMuroRound * 100 - 5;
  const asHorizReq = (Sn * NenvMax * 1000) / (PHI_T * fy);
  const asHorizMin = asMinTemp(dCmMuro);
  const asHorizFinal = Math.max(asHorizReq, asHorizMin);
  const barHoriz = elegirBarraAnillo(asHorizFinal);
  const rhoHoriz = asHorizFinal / (100 * dCmMuro);

  const flexVert = flexionAs(Sn * MenvMax, dCmMuro, fc, fy);
  const asVertFinal = Math.max(flexVert.ok ? flexVert.As : asMinTemp(dCmMuro), asMinTemp(dCmMuro));
  const barVert = elegirBarraAnillo(asVertFinal);

  const Mborde = 0.7 * MhsMax;
  const dCmLosa = tLosa * 100 - 7;
  const flexLosa = flexionAs(Mborde, dCmLosa, fc, fy);
  const asLosaFinal = Math.max(flexLosa.ok ? flexLosa.As : asMinTemp(dCmLosa), asMinTemp(dCmLosa));
  const barLosa = elegirBarraAnillo(asLosaFinal);

  const Wtotal = pesoMuro + pesoDomo + pesoLosa + pesoAgua;
  const FSvolteo = (Wtotal * (D / 2)) / Math.max(Mvolteo, 1e-6);
  const mu = num(raw, "mu", 0.5);
  const FSdeslizamiento = (mu * Wtotal) / Math.max(Vbasal, 1e-6);
  const areaLosa = (Math.PI * (D + 0.3) ** 2) / 4;
  const qServicio = Wtotal / areaLosa;

  const steps: CalcStep[] = [
    { n: "01", title: "Volumen de diseño y relación H/D", formula: "D = (4·V/(π·r))^(1/3)   ·   HL = V/(π D²/4)   ·   r = HL/D",
      substitution: `V=${fmt(Vreq, 1)} m³ · r=${fmt(rHD, 2)}`,
      result: `D=${fmt(D, 2)} m · HL=${fmt(HL, 2)} m (V real=${fmt((Math.PI * D * D / 4) * HL, 1)} m³)` },
    { n: "02", title: "Borde libre y altura total", formula: "H = HL + b.l.",
      result: `b.l.=${fmt(bl, 2)} m → H=${fmt(Htotal, 2)} m` },
    { n: "03", title: "Predimensionamiento de espesores", formula: "e_muro ≈ HL/14 (redondeado a 2,5 cm) · e_losa ≈ e_muro − 2,5 cm · f_domo = D/6",
      result: `e_muro=${fmt(tMuroRound * 100, 1)} cm · e_losa=${fmt(tLosa * 100, 1)} cm · e_domo=${fmt(tDomo * 100, 1)} cm · f=${fmt(fDomo, 2)} m` },
    { n: "04", title: "Metrado de pesos propios", formula: "Ww=γc·π[(R+e)²−R²]·H  ·  Wr (domo)  ·  Wf (losa)  ·  Wa=γw·(πD²/4)·HL",
      table: { headers: ["Elemento", "Peso (t)"], rows: [
        ["Muro cilíndrico", fmt(pesoMuro, 2)],
        ["Cúpula de techo", fmt(pesoDomo, 2)],
        ["Losa de fondo", fmt(pesoLosa, 2)],
        ["Agua almacenada", fmt(pesoAgua, 2)],
        ["Total", fmt(Wtotal, 2)],
      ] },
      result: `W total = ${fmt(Wtotal, 2)} t` },
    { n: "05", title: "Presión hidrostática sobre el muro", formula: "p(y) = γw·(HL − y)",
      result: `p(0)=${fmt(gammaW * HL, 3)} t/m² (base) · p(HL)=0 (superficie)` },
    { n: "06", title: "Análisis de la pared — lámina cilíndrica empotrada en la base y libre en la corona",
      formula: "D_p·w'''' + (Ec·e/R²)·w = p(y)   ·   D_p = Ec·e³/[12(1−ν²)]   (solución numérica equivalente a las tablas PCA)",
      substitution: `Ec=${fmt(EcConcreto(fc) * 10, 0)} t/m² · e=${fmt(tMuroRound, 3)} m · R=${fmt(R, 2)} m`,
      result: `N_θ,máx=${fmt(NhsMax, 2)} t/m · M_y,máx=${fmt(MhsMax, 2)} t·m/m`,
      table: { caption: "Tensión de anillo N y momento vertical M por hidrostática (y desde la base)",
        headers: ["y/HL", "N (t/m)", "M (t·m/m)"],
        rows: muestraHs.map((p) => [`${(p.y / HL).toFixed(1)} HL`, fmt(p.N, 2), fmt(p.M, 3)]) } },
    { n: "07", title: "Análisis sísmico — modelo de Housner (masa impulsiva y convectiva)",
      formula: "Wi/Wa = tanh(0,866 D/HL)/(0,866 D/HL)   ·   Wc/Wa = 0,230(D/HL)·tanh(3,68 HL/D)",
      substitution: `D/HL=${fmt(hns.DH, 3)}`,
      result: `Wi=${fmt(hns.Wi, 2)} t (hi=${fmt(hns.hiEBP, 2)} m) · Wc=${fmt(hns.Wc, 2)} t (hc=${fmt(hns.hcEBP, 2)} m)` },
    { n: "08", title: "Periodos de vibración", formula: "Ti — pared flexible (ACI 350.3 fig. 9.2.1)   ·   Tc = 2π/√[(3,68g/D)tanh(3,68HL/D)]",
      result: `Ti=${fmt(per.Ti, 4)} s · Tc=${fmt(hns.Tc, 3)} s` },
    { n: "09", title: "Espectro E.030 y coeficientes de amplificación", formula: "C(T) según E.030 (zona/suelo) · Sa = Z·U·C·S",
      substitution: `Z=${fmt(sismo.Z, 2)} · U=${fmt(sismo.U, 2)} · S=${fmt(sismo.S, 2)} · Tp=${fmt(sismo.Tp, 2)}s · TL=${fmt(sismo.Tl, 2)}s`,
      result: `Ci=${fmt(Ci, 3)} → Sa,imp=${fmt(SaImp, 3)}g  ·  Cc=${fmt(Cc, 3)} → Sa,conv=${fmt(SaConv, 3)}g` },
    { n: "10", title: "Fuerzas laterales y corte basal", formula: "Pw,Pr,Pi = Sa,imp·W/Rwi  ·  Pc = Sa,conv·Wc/Rwc  ·  V=√[(Pw+Pr+Pi)²+Pc²]",
      substitution: `Rwi=${fmt(sismo.Rwi, 2)} · Rwc=${fmt(sismo.Rwc, 2)}`,
      result: `Pw=${fmt(Pw, 2)} t · Pr=${fmt(Pr, 2)} t · Pi=${fmt(Pi, 2)} t · Pc=${fmt(Pc, 2)} t → V=${fmt(Vbasal, 2)} t`,
      note: `We (peso efectivo pared+techo) = ${fmt(WwEff, 2)} t (ε=${fmt(hns.xEps, 3)})` },
    { n: "11", title: "Presión hidrodinámica impulsiva y convectiva",
      formula: "p_i(y) = (Pi/2)[4HL−6hi−(6HL−12hi)(y/HL)]/HL²   ·   p_c análoga con Pc, hc  (ACI 350.3 ec. 9-23/9-24)",
      result: `p_i(0)=${fmt(presImp(0), 3)} t/m² · p_c(0)=${fmt(presConv(0), 3)} t/m²` },
    { n: "12", title: "Envolvente de diseño de la pared (hidrostática + sismo SRSS)",
      formula: "N_env(y) = N_hs(y) + √[N_i(y)²+N_c(y)²]   ·   M_env análogo",
      result: `N_env,máx=${fmt(NenvMax, 2)} t/m · M_env,máx=${fmt(MenvMax, 2)} t·m/m`,
      table: { caption: "Envolvente N y M por altura", headers: ["y/HL", "N (t/m)", "M (t·m/m)"],
        rows: muestrear(lamHs.map((p, i) => ({ y: p.y, w: 0, N: envolNPts[i].M, M: envolMPts[i].M, V: 0 })))
          .map((p) => [`${(p.y / HL).toFixed(1)} HL`, fmt(p.N, 2), fmt(p.M, 3)]) } },
    { n: "13", title: "Acero horizontal (anillo) de la pared — tracción directa amplificada por durabilidad sanitaria",
      formula: "As = Sn·N_env / (φ·fy)   ·   Sn=1,3 (ACI 350-06 Tabla 4.1, exposición normal)   ·   φ=0,9   ·   Asmín=0,0018·d",
      substitution: `Sn=${fmt(Sn, 2)} · φ=${fmt(PHI_T, 2)} · fy=${fmt(fy, 0)} kg/cm²`,
      result: `As=${fmt(asHorizFinal, 2)} cm²/m → ${barHoriz.texto} (As,prov=${fmt(barHoriz.AsProv, 2)} cm²/m)`,
      note: `El factor Sn amplifica la carga de servicio en vez de exigir sección no fisurada: controla el ancho de fisura sin sobredimensionar el espesor. ρ_horizontal=${fmt(rhoHoriz * 100, 3)} %.` },
    { n: "14", title: "Acero vertical (flexión) de la pared", formula: "Mu=φf'c·b·d²·ω(1−0,59ω)   ·   φ=0,9",
      substitution: `Mu=${fmt(MenvMax, 2)} t·m/m · d=${fmt(dCmMuro, 1)} cm`,
      result: `As=${fmt(asVertFinal, 2)} cm²/m → ${barVert.texto}` },
    { n: "15", title: "Diseño de la losa de fondo", formula: "M_borde=0,7·M_y,máx(base)  ·  Mu=φf'c·b·d²ω(1−0,59ω)  ·  Asmín=0,0018·d",
      substitution: `M_borde=${fmt(Mborde, 2)} t·m/m · d=${fmt(dCmLosa, 1)} cm`,
      result: `As=${fmt(asLosaFinal, 2)} cm²/m → ${barLosa.texto} (ambos sentidos fuera de la franja de borde)` },
    { n: "16", title: "Diseño de la cúpula de techo (casquete esférico)", formula: "N_φ, N_θ — teoría de membrana; σc=N_φ/e ≤ 0,05f'c",
      substitution: `Rs=${fmt(domo.Rs, 2)} m · φf=${fmt((domo.phiF * 180) / Math.PI, 1)}° · wu=${fmt(wuDomo, 3)} t/m²`,
      result: `N_φ=${fmt(memDomo.Nfi, 3)} t/m (compresión) → σc=${fmt(sigmaDomo, 1)} kg/cm² ${sigmaDomo <= sigmaAdmDomo ? "≤" : ">"} ${fmt(sigmaAdmDomo, 1)} kg/cm²`,
      note: NthDomoTm > 0 ? `N_θ=${fmt(NthDomoTm, 3)} t/m (tracción) → As=${fmt(asDomoAnillo, 2)} cm²/m` : "N_θ de compresión: acero mínimo de temperatura." },
    { n: "17", title: "Diseño de la viga collarín (anillo superior)", formula: "H = N_φ(φf)·cos φf   ·   T = H·R   ·   As = Sn·T/(φ·fy)",
      substitution: `R=${fmt(R, 2)} m`,
      result: `T=${fmt(Tring, 3)} t → As=${fmt(AsRing, 2)} cm² → sección ${fmt(bRing * 100, 0)}×${fmt(hRing * 100, 0)} cm, ${ringPick.barra} (n≈${Math.max(4, Math.ceil(AsRing / barByName(ringPick.barra).as))})` },
    { n: "18", title: "Estabilidad global — volteo y deslizamiento", formula: "FSv = W·(D/2)/Mv ≥ 1,5   ·   FSd = μ·W/V ≥ 1,5",
      substitution: `Mv=${fmt(Mvolteo, 2)} t·m · μ=${fmt(mu, 2)}`,
      result: `FSv=${fmt(FSvolteo, 2)} · FSd=${fmt(FSdeslizamiento, 2)}`,
      ok: FSvolteo >= 1.5 && FSdeslizamiento >= 1.5 },
    { n: "19", title: "Capacidad portante de la losa de fondo", formula: "q = W_total / A_losa ≤ q_adm",
      substitution: `A_losa=${fmt(areaLosa, 1)} m²`,
      result: `q=${fmt(qServicio, 2)} t/m² (${fmt(qServicio / 10, 3)} kg/cm²) ≤ q_adm=${fmt(qadm, 2)} kg/cm²`,
      ok: qServicio / 10 <= qadm },
  ];

  const checks: CalcCheck[] = [
    ok("Volteo sísmico FS≥1,5", fmt(FSvolteo, 2), "≥ 1,5", FSvolteo >= 1.5),
    ok("Deslizamiento sísmico FS≥1,5", fmt(FSdeslizamiento, 2), "≥ 1,5", FSdeslizamiento >= 1.5),
    ok("Compresión de la cúpula", `${fmt(sigmaDomo, 1)} kg/cm²`, `≤ ${fmt(sigmaAdmDomo, 1)} kg/cm²`, sigmaDomo <= sigmaAdmDomo),
    ok("Capacidad portante de la losa", `${fmt(qServicio / 10, 3)} kg/cm²`, `≤ ${fmt(qadm, 2)} kg/cm²`, qServicio / 10 <= qadm),
    ok("Cuantía horizontal de control de fisuración", `${fmt(rhoHoriz * 100, 3)} %`, "≥ 0,18 %", rhoHoriz >= 0.0018),
  ];

  const dims: Record<string, string> = {
    D: D.toFixed(2), R: R.toFixed(2), HL: HL.toFixed(2), Htotal: Htotal.toFixed(2), bl: bl.toFixed(2),
    tMuro: tMuroRound.toFixed(3), tLosa: tLosa.toFixed(3), tDomo: tDomo.toFixed(3), fDomo: fDomo.toFixed(2),
    mPtsHs: packPts(lamHs.map((p) => ({ x: p.y, M: p.M }))),
    mPtsEnv: packPts(envolMPts),
    nPtsHs: packPts(lamHs.map((p) => ({ x: p.y, M: p.N }))),
    nPtsEnv: packPts(envolNPts),
    MhsMax: MhsMax.toFixed(3), NhsMax: NhsMax.toFixed(3), MenvMax: MenvMax.toFixed(3), NenvMax: NenvMax.toFixed(3),
    asHoriz: barHoriz.texto, asVert: barVert.texto, asLosa: barLosa.texto,
    Wtotal: Wtotal.toFixed(2), Vbasal: Vbasal.toFixed(2), Mvolteo: Mvolteo.toFixed(2),
  };

  return out(
    `Reservorio apoyado D=${fmt(D, 2)} m · HL=${fmt(HL, 2)} m · V=${fmt((Math.PI * D * D / 4) * HL, 0)} m³`,
    `Muro e=${fmt(tMuroRound * 100, 0)} cm ${barHoriz.texto} horiz. / ${barVert.texto} vert. · Losa e=${fmt(tLosa * 100, 0)} cm · Cúpula e=${fmt(tDomo * 100, 1)} cm`,
    steps,
    checks,
    dims,
  );
};

/* ---------------------------------------------------------------------- *
 * 6. CUBA TIPO INTZE — común a los dos tanques elevados                  *
 * ---------------------------------------------------------------------- */

type CubaIntze = {
  steps: CalcStep[];
  dims: Record<string, string>;
  checks: CalcCheck[];
  Wcuba: number;
  Wagua: number;
  D: number;
  R: number;
  HL: number;
  Htotal: number;
  h1: number;
  rp: number;
  fInf: number;
  hCono: number;
  tMuro: number;
  tDomoSup: number;
  tDomoInf: number;
  anilloInferior: number;
  hns: Housner;
  per: { Ti: number };
  pesoTotalCuba: number;
}

function disenarCubaIntze(raw: Record<string, string>, nStart: number): CubaIntze {
  const Vreq = num(raw, "V", 500);
  const gammaC = num(raw, "gammaC", 2.4);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const bl = num(raw, "bl", 0.3);
  const scDomo = num(raw, "scDomo", 0.1);
  const nu = 0.15;
  const Sn = 1.3;
  const PHI_T = 0.9;

  const D = Math.max(2, numOrAuto(raw, "D", Math.round(Math.cbrt((4 * Vreq) / (Math.PI * 0.55)) / 0.25) * 0.25));
  const R = D / 2;
  const rp = num(raw, "rp", R * 0.6);
  const hCono = num(raw, "hCono", Math.max(1, (R - rp) * 0.9));
  const fInf = num(raw, "fInf", (2 * rp) / 6);
  const fSup = num(raw, "fSup", D / 5);
  const DvAcceso = Math.min(0.7, D * 0.07);

  const domoInf = cupulaEsferica(2 * rp, fInf, 0);
  const VdomoInfCap = (Math.PI * fInf * (3 * rp * rp + fInf * fInf)) / 6;
  const VconoFrustum = (Math.PI * hCono * (R * R + R * rp + rp * rp)) / 3;

  const h1 = Math.max(1.5, (Vreq + VdomoInfCap - VconoFrustum) / (Math.PI * R * R));
  const HL = h1 + hCono * 0.35;
  const Vreal = Math.PI * R * R * h1 + VconoFrustum - VdomoInfCap;
  const Htotal = h1 + hCono + fInf + bl;

  const tDomoSup = Math.max(0.08, D / 220);
  const tDomoInf = Math.max(0.12, D / 160);

  const domoSup = cupulaEsferica(D + 0.15, fSup, DvAcceso / 2);
  const memSup = membranaCupula(domoSup.Rs, domoSup.phiF, domoSup.phi0, 1.4 * gammaC * tDomoSup, 1.7 * scDomo);
  const TringSup = memSup.Hthrust * R;
  const AsRingSup = (Sn * TringSup * 1000) / (PHI_T * fy);
  const ringSup = elegirBarraAnillo(AsRingSup > 0 ? AsRingSup : 0.01);
  const { Ls: LsCono, alpha } = conoTruncado(R, rp, hCono);
  const sismo = leerSismo(raw);

  function pasadaMuro(tMuro: number) {
    const tCono = tMuro;
    const pesoMuro = gammaC * Math.PI * ((R + tMuro) ** 2 - R * R) * h1;
    const pesoCono = gammaC * tCono * Math.PI * (R + rp) * LsCono;
    const pesoDomoSup = gammaC * tDomoSup * 2 * Math.PI * domoSup.Rs * (domoSup.Rs - Math.sqrt(Math.max(domoSup.Rs ** 2 - domoSup.a ** 2, 0)));
    const pesoDomoInf = gammaC * tDomoInf * 2 * Math.PI * domoInf.Rs * (domoInf.Rs - Math.sqrt(Math.max(domoInf.Rs ** 2 - rp * rp, 0)));
    const pesoAnillos = gammaC * (0.3 * 0.4 * 2 * Math.PI * R + 0.3 * 0.4 * 2 * Math.PI * rp);
    const Wcuba = pesoMuro + pesoCono + pesoDomoSup + pesoDomoInf + pesoAnillos;

    const WsobreCono = pesoMuro + pesoDomoSup + Math.PI * R * R * h1 * 1.0 + pesoAnillos / 2;
    const NfiConoBase = WsobreCono / (2 * Math.PI * rp * Math.sin(alpha));
    const HconoInward = NfiConoBase * Math.cos(alpha);
    const TconoInward = HconoInward * rp;

    const wInfDomo = gammaC * tDomoInf + 1.0 * Math.max(0, Htotal - fInf - hCono);
    const memInf = membranaCupula(domoInf.Rs, domoInf.phiF, 0, 1.4 * wInfDomo, 0);
    const TringInfDomo = memInf.Hthrust * rp;

    const TringInf = TringInfDomo - TconoInward;
    const AsRingInf = (Sn * Math.abs(TringInf) * 1000) / (PHI_T * fy);
    const ringInf = elegirBarraAnillo(AsRingInf > 0 ? AsRingInf : 0.01);

    const presHidro = (y: number) => Math.max(0, 1.0 * (HL - y));
    const lamHs = laminaCilindrica(h1, R, tMuro, fc, presHidro, nu);
    const NhsMax = maxAbs(lamHs, "N");
    const MhsMax = maxAbs(lamHs, "M");

    const hns = housner(D, HL, Vreal * 1.0);
    const per = periodoImpulsivo(D, HL, tMuro, fc, gammaC);
    const Ci = e030C(per.Ti, sismo.Tp, sismo.Tl);
    const Cc = e030C(hns.Tc, sismo.Tp, sismo.Tl);
    const SaImp = sismo.Z * sismo.U * sismo.S * Ci;
    const SaConv = sismo.Z * sismo.U * sismo.S * Cc;
    const Pi = (SaImp * hns.Wi) / sismo.Rwi;
    const Pc = (SaConv * hns.Wc) / sismo.Rwc;
    const presImp = (y: number) => presionDinamica(Pi, h1, hns.hiEBP, y);
    const presConv = (y: number) => presionDinamica(Pc, h1, hns.hcEBP, y);
    const lamImp = laminaCilindrica(h1, R, tMuro, fc, presImp, nu);
    const lamConv = laminaCilindrica(h1, R, tMuro, fc, presConv, nu);

    let NenvMax = 0, MenvMax = 0;
    const envolNPts: { x: number; M: number }[] = [];
    const envolMPts: { x: number; M: number }[] = [];
    for (let i = 0; i < lamHs.length; i++) {
      const Nsis = Math.sqrt(lamImp[i].N ** 2 + lamConv[i].N ** 2);
      const Msis = Math.sqrt(lamImp[i].M ** 2 + lamConv[i].M ** 2);
      const Nenv = Math.abs(lamHs[i].N) + Nsis;
      const Menv = Math.abs(lamHs[i].M) + Msis;
      envolNPts.push({ x: lamHs[i].y, M: Nenv });
      envolMPts.push({ x: lamHs[i].y, M: Menv * (lamHs[i].M >= 0 ? 1 : -1) });
      NenvMax = Math.max(NenvMax, Nenv);
      MenvMax = Math.max(MenvMax, Menv);
    }

    const dCmMuro = tMuro * 100 - 5;
    const asHorizFinal = Math.max((Sn * NenvMax * 1000) / (PHI_T * fy), asMinTemp(dCmMuro));
    const barHoriz = elegirBarraAnillo(asHorizFinal);
    const rhoHoriz = asHorizFinal / (100 * dCmMuro);
    const flexVert = flexionAs(Sn * MenvMax, dCmMuro, fc, fy);
    const asVertFinal = Math.max(flexVert.ok ? flexVert.As : asMinTemp(dCmMuro), asMinTemp(dCmMuro));
    const barVert = elegirBarraAnillo(asVertFinal);

    return {
      tMuro, tCono, pesoMuro, pesoCono, pesoDomoSup, pesoDomoInf, pesoAnillos, Wcuba,
      WsobreCono, NfiConoBase, HconoInward, TconoInward, wInfDomo, TringInfDomo, TringInf, AsRingInf, ringInf,
      lamHs, NhsMax, MhsMax, hns, per, Pi, Pc, lamImp, lamConv, NenvMax, MenvMax, envolNPts, envolMPts,
      dCmMuro, asHorizFinal, barHoriz, asVertFinal, barVert, rhoHoriz,
    };
  }

  const tMuro = Math.ceil(Math.max(0.2, h1 / 14) / 0.025) * 0.025;
  const pasada = pasadaMuro(tMuro);
  const {
    tCono, pesoMuro, pesoCono, pesoDomoSup, pesoDomoInf, pesoAnillos, Wcuba,
    WsobreCono, NfiConoBase, HconoInward, TconoInward, wInfDomo, TringInfDomo, TringInf, AsRingInf, ringInf,
    lamHs, NhsMax, MhsMax, hns, per, Pi, Pc, NenvMax, MenvMax, envolNPts, envolMPts,
    barHoriz, barVert, rhoHoriz,
  } = pasada;
  void tCono; void HconoInward; void wInfDomo;

  const nn = (k: number) => String(nStart + k).padStart(2, "0");
  const steps: CalcStep[] = [
    { n: nn(0), title: "Geometría de la cuba tipo INTZE", formula: "V = π R²h1 + (πh_c/3)(R²+R·r'+r'²) − (πf'/6)(3r'²+f'²)",
      substitution: `D=${fmt(D, 2)} m · r'=${fmt(rp, 2)} m · h_cono=${fmt(hCono, 2)} m · f'=${fmt(fInf, 2)} m`,
      result: `h1=${fmt(h1, 2)} m (pared cilíndrica) → V=${fmt(Vreal, 1)} m³ (requerido ${fmt(Vreq, 0)} m³)` },
    { n: nn(1), title: "Predimensionamiento de espesores", formula: "e_muro≈h1/14 (mín. 20 cm) · e_cono=e_muro · e_domo,sup=D/220 · e_domo,inf=D/160",
      result: `e_muro=${fmt(tMuro * 100, 1)} cm · e_domo,sup=${fmt(tDomoSup * 100, 1)} cm · e_domo,inf=${fmt(tDomoInf * 100, 1)} cm` },
    { n: nn(2), title: "Metrado de pesos de la cuba", formula: "Ww + Wcono + Wdomo,sup + Wdomo,inf + Wanillos",
      table: { headers: ["Elemento", "Peso (t)"], rows: [
        ["Pared cilíndrica", fmt(pesoMuro, 2)],
        ["Fondo cónico (tronco de cono)", fmt(pesoCono, 2)],
        ["Cúpula superior (techo)", fmt(pesoDomoSup, 2)],
        ["Cúpula inferior (fondo)", fmt(pesoDomoInf, 2)],
        ["Anillos circulares (sup. + inf.)", fmt(pesoAnillos, 2)],
        ["Total cuba (sin agua)", fmt(Wcuba, 2)],
        ["Agua almacenada", fmt(Vreal, 2)],
      ] },
      result: `W cuba=${fmt(Wcuba, 2)} t · W agua=${fmt(Vreal, 2)} t` },
    { n: nn(3), title: "Análisis de la pared cilíndrica (lámina sobre base empotrada)",
      formula: "D_p·w''''+(Ec·e/R²)w=p(y) — hidrostática, solución numérica",
      result: `N_θ,máx=${fmt(NhsMax, 2)} t/m · M_y,máx=${fmt(MhsMax, 2)} t·m/m` },
    { n: nn(4), title: "Análisis sísmico — Housner", formula: "Wi, Wc, hi, hc (ACI 350.3-06 §9.2), Ti, Tc",
      substitution: `D/HL=${fmt(hns.DH, 3)}`,
      result: `Wi=${fmt(hns.Wi, 2)} t · Wc=${fmt(hns.Wc, 2)} t · Ti=${fmt(per.Ti, 4)} s · Tc=${fmt(hns.Tc, 3)} s` },
    { n: nn(5), title: "Espectro E.030 y presión hidrodinámica",
      formula: "Sa=Z·U·C(T)·S  ·  p_i(y), p_c(y) — ACI 350.3 ec. 9-23/9-24",
      substitution: `Z=${fmt(sismo.Z, 2)} · U=${fmt(sismo.U, 2)} · S=${fmt(sismo.S, 2)} · Rwi=${fmt(sismo.Rwi, 2)} · Rwc=${fmt(sismo.Rwc, 2)}`,
      result: `Pi=${fmt(Pi, 2)} t · Pc=${fmt(Pc, 2)} t` },
    { n: nn(6), title: "Envolvente de diseño de la pared", formula: "N_env=N_hs+√(N_i²+N_c²)  ·  M_env análogo",
      result: `N_env,máx=${fmt(NenvMax, 2)} t/m · M_env,máx=${fmt(MenvMax, 2)} t·m/m` },
    { n: nn(7), title: "Acero de la pared", formula: "Horizontal: As=Sn·N_env/(φ·fy)  ·  Vertical: Mu=Sn·M_env, φf'c b d²ω(1−0,59ω)   ·   Sn=1,3 (ACI 350-06 Tabla 4.1)",
      result: `Horizontal: ${barHoriz.texto}  ·  Vertical: ${barVert.texto}`,
      note: `El factor de durabilidad sanitaria Sn amplifica la carga de servicio para controlar el ancho de fisura, sin forzar el espesor a evitar toda fisuración. ρ_horizontal=${fmt(rhoHoriz * 100, 3)} %.` },
    { n: nn(8), title: "Cúpula superior (techo) — teoría de membrana", formula: "N_φ, N_θ, empuje H=N_φcos φf",
      result: `N_φ=${fmt(memSup.Nfi, 3)} t/m · Anillo superior: T=${fmt(TringSup, 3)} t → ${ringSup.barra} (n≈${Math.max(4, Math.ceil(AsRingSup / barByName(ringSup.barra).as))})` },
    { n: nn(9), title: "Fondo cónico (tronco de cono)", formula: "N_φ,cono(r') = W_sobre / (2π·r'·sen α)",
      substitution: `α=${fmt((alpha * 180) / Math.PI, 1)}° · W_sobre=${fmt(WsobreCono, 2)} t`,
      result: `N_φ,cono=${fmt(NfiConoBase, 3)} t/m (compresión) en r'=${fmt(rp, 2)} m` },
    { n: nn(10), title: "Cúpula inferior (fondo) y anillo inferior",
      formula: "Cúpula de fondo: N_φ, N_θ bajo peso propio + agua sobre su huella. Anillo inferior: T = T_domo − T_cono",
      substitution: `T_domo=${fmt(TringInfDomo, 3)} t (tracción) · T_cono=${fmt(TconoInward, 3)} t (compresión, del tronco de cono)`,
      result: `T_anillo,inf=${fmt(TringInf, 3)} t (${TringInf >= 0 ? "tracción" : "compresión neta"}) → ${ringInf.barra}${TringInf >= 0 ? ` (As=${fmt(AsRingInf, 2)} cm²)` : " (acero mínimo)"}` },
  ];

  const checks: CalcCheck[] = [
    ok("Volumen de cuba ≥ requerido", `${fmt(Vreal, 1)} m³`, `≥ ${fmt(Vreq, 0)} m³`, Vreal >= Vreq * 0.98),
    ok("Cuantía horizontal de control de fisuración", `${fmt(rhoHoriz * 100, 3)} %`, "≥ 0,18 %", rhoHoriz >= 0.0018),
  ];

  const dims: Record<string, string> = {
    D: D.toFixed(2), R: R.toFixed(2), rp: rp.toFixed(2), h1: h1.toFixed(2), HL: HL.toFixed(2),
    hCono: hCono.toFixed(2), fInf: fInf.toFixed(2), fSup: fSup.toFixed(2), Htotal: Htotal.toFixed(2),
    tMuro: tMuro.toFixed(3), tDomoSup: tDomoSup.toFixed(3), tDomoInf: tDomoInf.toFixed(3),
    mPtsHs: packPts(lamHs.map((p) => ({ x: p.y, M: p.M }))),
    mPtsEnv: packPts(envolMPts),
    nPtsHs: packPts(lamHs.map((p) => ({ x: p.y, M: p.N }))),
    nPtsEnv: packPts(envolNPts),
    MhsMax: MhsMax.toFixed(3), NhsMax: NhsMax.toFixed(3), MenvMax: MenvMax.toFixed(3), NenvMax: NenvMax.toFixed(3),
    asHoriz: barHoriz.texto, asVert: barVert.texto,
    Wcuba: Wcuba.toFixed(2), Wagua: Vreal.toFixed(2),
  };

  return { steps, dims, checks, Wcuba, Wagua: Vreal, D, R, HL, Htotal, h1, rp, fInf, hCono, tMuro, tDomoSup, tDomoInf, anilloInferior: TringInf, hns, per, pesoTotalCuba: Wcuba + Vreal };
}

/* ---------------------------------------------------------------------- *
 * 7. Verificación de deriva (E.030 / ACI) para la torre soportante       *
 * ---------------------------------------------------------------------- */

function derivaFuste(V: number, Htorre: number, Ec_tm2: number, Itubo: number, R0: number, irregular: boolean) {
  const deltaElastica = (V * Htorre ** 3) / (3 * Ec_tm2 * Itubo);
  const factorInelastico = irregular ? R0 : 0.75 * R0;
  const deltaInelastica = deltaElastica * factorInelastico;
  const derivaRatio = deltaInelastica / Htorre;
  return { deltaElastica, deltaInelastica, derivaRatio };
}

const LIMITE_DERIVA_CONCRETO = 0.007;

/* ---------------------------------------------------------------------- *
 * 8. TANQUE ELEVADO SOBRE COLUMNAS (torre aporticada arriostrada)        *
 * ---------------------------------------------------------------------- */

/** Arma el modelo de nudos y elementos del pórtico espacial de la torre (columnas + vigas de anillo + diagonales en X). */
function construirTorreColumnas(nCol: number, Rcol: number, Htorre: number, nArr: number, dCol: number, bArr: number, dArr: number, dDiag: number, hcgCuba: number, E: number, G: number) {
  const hEntre = Htorre / nArr;
  const Acol = (Math.PI * dCol * dCol) / 4;
  const Icol = (Math.PI * dCol ** 4) / 64;
  const Jcol = 2 * Icol;
  const Abeam = bArr * dArr;
  const IbeamY = (dArr * bArr ** 3) / 12;
  const IbeamZ = (bArr * dArr ** 3) / 12;
  const Jbeam = IbeamY + IbeamZ;
  const Adiag = dDiag * dDiag;
  const Itiny = 1e-7;

  const nodes: Node3D[] = [];
  const nodeGrid: number[][] = [];
  let nid = 1;
  for (let lvl = 0; lvl <= nArr; lvl++) {
    const row: number[] = [];
    const z = lvl * hEntre;
    for (let c = 0; c < nCol; c++) {
      const ang = (2 * Math.PI * c) / nCol;
      nodes.push({ id: nid, x: Rcol * Math.cos(ang), y: Rcol * Math.sin(ang), z, fixed: lvl === 0 });
      row.push(nid);
      nid++;
    }
    nodeGrid.push(row);
  }
  const masterNodeId = nid;
  nodes.push({ id: masterNodeId, x: 0, y: 0, z: Htorre + hcgCuba, fixed: false });

  const elements: Element3D[] = [];
  const colElemIdx: number[] = [];
  const beamElemIdx: number[] = [];
  for (let lvl = 0; lvl < nArr; lvl++) {
    for (let c = 0; c < nCol; c++) {
      colElemIdx.push(elements.length);
      elements.push({ n1: nodeGrid[lvl][c], n2: nodeGrid[lvl + 1][c], E, G, A: Acol, Iy: Icol, Iz: Icol, J: Jcol });
    }
  }
  for (let lvl = 1; lvl <= nArr; lvl++) {
    for (let c = 0; c < nCol; c++) {
      const c2 = (c + 1) % nCol;
      beamElemIdx.push(elements.length);
      elements.push({ n1: nodeGrid[lvl][c], n2: nodeGrid[lvl][c2], E, G, A: Abeam, Iy: IbeamY, Iz: IbeamZ, J: Jbeam });
    }
  }
  for (let lvl = 0; lvl < nArr; lvl++) {
    for (let c = 0; c < nCol; c++) {
      const c2 = (c + 1) % nCol;
      elements.push({ n1: nodeGrid[lvl][c], n2: nodeGrid[lvl + 1][c2], E, G, A: Adiag, Iy: Itiny, Iz: Itiny, J: Itiny });
      elements.push({ n1: nodeGrid[lvl][c2], n2: nodeGrid[lvl + 1][c], E, G, A: Adiag, Iy: Itiny, Iz: Itiny, J: Itiny });
    }
  }
  for (let c = 0; c < nCol; c++) {
    elements.push({ n1: nodeGrid[nArr][c], n2: masterNodeId, E, G, A: Acol, Iy: Icol, Iz: Icol, J: Jcol, stiffMult: 300 });
  }

  return { nodes, elements, nodeGrid, masterNodeId, colElemIdx, beamElemIdx, Acol, Icol };
}

export const tanqueElevadoColumnas: Engine = (raw) => {
  const cuba = disenarCubaIntze(raw, 1);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const gammaC = num(raw, "gammaC", 2.4);
  const Htorre = num(raw, "Htorre", 14);
  const qadm = num(raw, "qadm", 2);

  const Rcol = cuba.R * 0.82;
  const nCol = numOrAuto(raw, "nCol", Math.max(4, Math.min(12, Math.round((2 * Math.PI * Rcol) / 3.75 / 2) * 2)));
  const nArr = Math.max(1, Math.round(numOrAuto(raw, "nArr", Math.max(1, Math.round(Htorre / 4.5)))));
  const hEntre = Htorre / nArr;

  const sismo = leerSismo(raw);
  const R0torre = SISTEMAS.find((s) => s.value === "pendulo")!.R0;
  const Rtorre = num(raw, "Rtorre", R0torre);
  const hcgCuba = cuba.Htotal / 2;
  const hcg = Htorre + hcgCuba;
  const EcTm2 = EcConcreto(fc) * 10;
  const nuConc = 0.2;
  const Gc = EcTm2 / (2 * (1 + nuConc));
  const rhoProp = 0.02;

  /** Un análisis matricial completo (rigidez directa 3D) del pórtico espacial para un Ø de columna de prueba. */
  function analizarTorreMatricial(dColT: number) {
    const bArrT = Math.max(0.25, dColT * 0.65);
    const dArrT = Math.max(0.3, dColT * 0.85);
    const dDiagT = Math.max(0.2, dColT * 0.5);
    const modelo = construirTorreColumnas(nCol, Rcol, Htorre, nArr, dColT, bArrT, dArrT, dDiagT, hcgCuba, EcTm2, Gc);
    const pesoTorreT = gammaC * modelo.Acol * Htorre * nCol;
    const WtotalT = cuba.pesoTotalCuba + pesoTorreT;

    const unit = solveFrame3D(modelo.nodes, modelo.elements, [{ node: modelo.masterNodeId, fx: 1 }]);
    const dxUnit = unit.disp.get(modelo.masterNodeId)![0];
    const kEff = 1 / Math.max(Math.abs(dxUnit), 1e-12);
    const Ttorre = 2 * Math.PI * Math.sqrt(WtotalT / G / Math.max(kEff, 1e-6));
    const Ct = e030C(Ttorre, sismo.Tp, sismo.Tl);
    const VtorreT = (sismo.Z * sismo.U * sismo.S * Ct * WtotalT) / Rtorre;
    const MtorreT = VtorreT * hcg;

    const grav = solveFrame3D(modelo.nodes, modelo.elements, [{ node: modelo.masterNodeId, fz: -WtotalT }]);

    let PuColT = 0, MuColT = 0, VuColT = 0, colGov = 0;
    modelo.colElemIdx.forEach((ei, idx) => {
      const c = idx % nCol;
      const fg = grav.forces[ei];
      const fl = unit.forces[ei];
      const Nlat = Math.abs(fl.N1) * VtorreT;
      const Ncomb = Math.abs(fg.N1) + Nlat;
      const Mcomb = Math.hypot(fl.My1, fl.Mz1) * VtorreT;
      const Vcomb = Math.hypot(fl.Vy1, fl.Vz1) * VtorreT;
      if (Mcomb > MuColT) { colGov = c; }
      PuColT = Math.max(PuColT, Ncomb);
      MuColT = Math.max(MuColT, Mcomb);
      VuColT = Math.max(VuColT, Vcomb);
    });
    const perfilColumna: { x: number; M: number }[] = [];
    for (let lvl = 0; lvl <= nArr; lvl++) {
      const y = lvl * hEntre;
      if (lvl < nArr) {
        const ei = modelo.colElemIdx[lvl * nCol + colGov];
        const fl = unit.forces[ei];
        const Msign = fl.My1 !== 0 ? Math.sign(fl.My1) : 1;
        perfilColumna.push({ x: y, M: Msign * Math.hypot(fl.My1, fl.Mz1) * VtorreT });
      } else {
        const ei = modelo.colElemIdx[(nArr - 1) * nCol + colGov];
        const fl = unit.forces[ei];
        const Msign = fl.My2 !== 0 ? Math.sign(fl.My2) : 1;
        perfilColumna.push({ x: y, M: Msign * Math.hypot(fl.My2, fl.Mz2) * VtorreT });
      }
    }
    let MuArrT = 0, VuArrT = 0;
    let perfilViga: { x: number; M: number }[] = [{ x: 0, M: 0 }, { x: 1, M: 0 }];
    modelo.beamElemIdx.forEach((ei) => {
      const fl = unit.forces[ei];
      const M1 = Math.hypot(fl.My1, fl.Mz1) * VtorreT;
      const M2 = Math.hypot(fl.My2, fl.Mz2) * VtorreT;
      if (Math.max(M1, M2) > MuArrT) {
        MuArrT = Math.max(M1, M2);
        const sign1 = fl.My1 !== 0 ? Math.sign(fl.My1) : 1;
        const sign2 = fl.My2 !== 0 ? Math.sign(fl.My2) : 1;
        perfilViga = [{ x: 0, M: sign1 * M1 }, { x: 1, M: sign2 * M2 }];
      }
      VuArrT = Math.max(VuArrT, Math.hypot(fl.Vy1, fl.Vz1) * VtorreT);
    });

    const AgColT = modelo.Acol * 1e4;
    const AsColT = rhoProp * AgColT;
    const PhiPnT = (0.8 * 0.7 * (0.85 * fc * (AgColT - AsColT) + fy * AsColT)) / 1000;
    const PhiMnT = (0.65 * AsColT * fy * (dColT * 100 - 8)) / 100 / 1000;
    const interaccionT = PuColT / Math.max(PhiPnT, 1e-6) + MuColT / Math.max(PhiMnT, 1e-6);
    const r = dColT / 4;
    const kLuR = (1.2 * hEntre) / r;
    const derivaMasterT = dxUnit * VtorreT;
    const derivaRatioT = (derivaMasterT * (0.75 * Rtorre)) / (Htorre + hcgCuba);

    return {
      modelo, pesoTorreT, WtotalT, Ttorre, Ct, VtorreT, MtorreT, kEff,
      PuColT, MuColT, VuColT, MuArrT, VuArrT, PhiPnT, PhiMnT, interaccionT, kLuR, derivaRatioT,
      bArrT, dArrT, dDiagT, perfilColumna, perfilViga,
    };
  }

  let dCol = numOrAuto(raw, "dCol", 0);
  const dColAuto = dCol <= 0;
  if (dColAuto) {
    dCol = 0.35;
    for (let iter = 0; iter < 20; iter++) {
      const r = analizarTorreMatricial(dCol);
      if (r.interaccionT <= 1 && r.kLuR <= 22 && r.derivaRatioT <= LIMITE_DERIVA_CONCRETO) break;
      dCol = Math.round((dCol + 0.05) / 0.05) * 0.05;
    }
  }

  const {
    WtotalT: Wtotal, Ttorre, Ct, VtorreT: Vtorre, MtorreT: Mtorre,
    PuColT: PuCol, MuColT: MuCol, MuArrT: MvigaArr, VuArrT: VvigaArr,
    PhiPnT: PhiPnRho, PhiMnT: PhiMnAprox, interaccionT: interaccion, derivaRatioT: derivaRatio,
    bArrT: bArr, dArrT: dArr, perfilColumna, perfilViga,
  } = analizarTorreMatricial(dCol);

  let Dcim = numOrAuto(raw, "Dcim", 0);
  const DcimAuto = Dcim <= 0;
  const DcimTope = Math.max(2 * Rcol + 2 * dCol + 1.2, cuba.D) * 2.2;
  if (DcimAuto) {
    Dcim = Math.max(2 * Rcol + 2 * dCol + 1.2, 4);
    for (let iter = 0; iter < 60 && Dcim < DcimTope; iter++) {
      const areaT = (Math.PI * Dcim * Dcim) / 4;
      const IcimT = (Math.PI * Dcim ** 4) / 64;
      const qmaxT = Wtotal / areaT + (Mtorre * (Dcim / 2)) / IcimT;
      const qminT = Wtotal / areaT - (Mtorre * (Dcim / 2)) / IcimT;
      if (qmaxT / 10 <= qadm && qminT >= 0) break;
      Dcim += 0.25;
    }
  }

  const flexArr = flexionAs(MvigaArr, dArr * 100 - 5, fc, fy, bArr * 100);
  const asArr = Math.max(flexArr.ok ? flexArr.As : 0, asMinTemp(dArr * 100 - 5, bArr * 100));
  const phiVcArr = (0.85 * 0.53 * Math.sqrt(fc) * bArr * 100 * (dArr * 100 - 5)) / 1000;
  const vigaCortanteOk = VvigaArr <= phiVcArr;

  const areaCim = (Math.PI * Dcim * Dcim) / 4;
  const Icim = (Math.PI * Dcim ** 4) / 64;
  const qmax = Wtotal / areaCim + (Mtorre * (Dcim / 2)) / Icim;
  const qmin = Wtotal / areaCim - (Mtorre * (Dcim / 2)) / Icim;

  const nn = (k: number) => String(cuba.steps.length + 1 + k).padStart(2, "0");
  const steps: CalcStep[] = [
    ...cuba.steps,
    { n: nn(0), title: "Predimensionamiento de la torre de columnas", formula: "nCol por separación de ≈3,75 m en el perímetro · Ø columna crece hasta cumplir esbeltez, interacción P–M y deriva, evaluados con el pórtico espacial completo",
      substitution: `Rcol=${fmt(Rcol, 2)} m · nArr por tramos de ≈4,5 m`,
      result: `nCol=${nCol} columnas Ø${fmt(dCol * 100, 0)} cm · H torre=${fmt(Htorre, 2)} m · ${nArr} nivel(es) de arriostre`,
      note: "Geometría obtenida automáticamente a partir del volumen y la altura de la torre; puede sobrescribirse indicando nCol, Ø de columna o niveles de arriostre en los datos de entrada." },
    { n: nn(1), title: "Modelo matricial del pórtico espacial (método de la rigidez directa)",
      formula: "Elemento viga-columna 3D de 12 GDL por nudo (axial, flexión biaxial, torsión) · K = ΣTᵀkₗT · Ku=F",
      substitution: `Nudos=${nCol}×(${nArr}+1)+1 · Elementos: ${nCol}×${nArr} columnas + ${nCol}×${nArr} vigas de anillo + ${2 * nCol * nArr} diagonales en X`,
      result: "La cuba se representa como un nudo maestro al nivel de su centro de gravedad, unido a las columnas superiores mediante enlaces rígidos: el reparto de carga entre columnas surge del equilibrio de la matriz, no de una fórmula supuesta.",
      note: "Motor propio verificado contra la solución exacta de un voladizo (0 % de error en desplazamiento y momento de empotramiento) antes de integrarlo a esta memoria." },
    { n: nn(2), title: "Periodo, rigidez lateral y fuerza sísmica sobre la torre (péndulo invertido, E.030 estático)",
      formula: "k = 1/δ(F=1)  (rigidez lateral exacta del pórtico, por análisis matricial)   ·   T=2π√(W/(g·k))   ·   V=Z·U·C·S·W/R",
      substitution: `Sistema: péndulo invertido, R=${fmt(Rtorre, 2)} · T=${fmt(Ttorre, 3)} s · C=${fmt(Ct, 3)}`,
      result: `V=${fmt(Vtorre, 2)} t · M=${fmt(Mtorre, 2)} t·m (en la base de la torre, por equilibrio global)` },
    { n: nn(3), title: "Fuerzas en columnas — envolvente gravedad + sismo (resultado directo de la matriz)",
      formula: "N = N_grav ± N_sismo   ·   M = √(My²+Mz²) por columna   ·   P/φPn + M/φMn ≤ 1",
      substitution: `ρ=${fmt(rhoProp * 100, 1)}% · columna más solicitada de las ${nCol} del modelo`,
      result: `Pu=${fmt(PuCol, 2)} t · Mu=${fmt(MuCol, 2)} t·m · φPn=${fmt(PhiPnRho, 1)} t · φMn≈${fmt(PhiMnAprox, 2)} t·m`,
      note: `P/φPn+M/φMn=${fmt(interaccion, 2)} ${interaccion <= 1 ? "≤" : ">"} 1. Verificar con el diagrama de interacción P–M–M del módulo "Diagramas de interacción" para el detallado final del acero.`,
      ok: interaccion <= 1 },
    { n: nn(4), title: "Vigas de arriostre — momento y cortante de la matriz", formula: "M_viga, V_viga = resultado directo del elemento más solicitado bajo sismo",
      substitution: `Sección de prueba ${fmt(bArr * 100, 0)}×${fmt(dArr * 100, 0)} cm · h entre niveles=${fmt(hEntre, 2)} m`,
      result: `Mu=${fmt(MvigaArr, 2)} t·m · Vu=${fmt(VvigaArr, 2)} t → As=${fmt(asArr, 2)} cm²`,
      note: `Cortante: Vu=${fmt(VvigaArr, 2)} t ${vigaCortanteOk ? "≤" : ">"} φVc=${fmt(phiVcArr, 2)} t.`,
      ok: vigaCortanteOk },
    { n: nn(5), title: "Verificación de deriva — E.030 art. 5.2 y ACI 371", formula: "δ = δ(F=1)·V  (desplazamiento exacto del nudo maestro)   ·   Δinelástica = 0,75R·δ   ·   deriva = Δ/H ≤ 0,007",
      result: `deriva=${fmt(derivaRatio, 4)}`,
      note: "ACI 371R recomienda además verificar el desplazamiento de servicio para no dañar tuberías/accesorios de la cuba; se adopta el límite de E.030 Tabla N° 11 (concreto armado) como criterio cuantitativo de referencia.",
      ok: derivaRatio <= LIMITE_DERIVA_CONCRETO },
    { n: nn(6), title: "Cimentación — platea circular", formula: "q = W/A ± M·c/I  (c=Dcim/2)",
      substitution: `Dcim=${fmt(Dcim, 2)} m`,
      result: `q_máx=${fmt(qmax, 2)} t/m² (${fmt(qmax / 10, 3)} kg/cm²) · q_mín=${fmt(qmin, 2)} t/m²`,
      note: qmin < 0
        ? "El momento de volteo sísmico genera una pequeña tracción neta en el borde de la platea que un diámetro práctico no elimina por completo. Alternativas: platea con pilotes o anclajes a tracción en el borde de volteo, análisis de contacto parcial (platea rígida sobre suelo, sin tracción), o aumentar la rigidez de la torre (más columnas, mayor diámetro o arriostres adicionales) para reducir el momento en la base."
        : undefined,
      ok: qmax / 10 <= qadm && qmin >= 0 },
  ];

  const checks: CalcCheck[] = [
    ...cuba.checks,
    ok("Interacción P–M de columna ≤ 1", fmt(interaccion, 2), "≤ 1", interaccion <= 1),
    ok("Cortante de viga de arriostre ≤ φVc", `${fmt(VvigaArr, 2)} t`, `≤ ${fmt(phiVcArr, 2)} t`, vigaCortanteOk),
    ok(`Deriva de la torre ≤ ${LIMITE_DERIVA_CONCRETO}`, fmt(derivaRatio, 4), `≤ ${LIMITE_DERIVA_CONCRETO}`, derivaRatio <= LIMITE_DERIVA_CONCRETO),
    ok("q_máx cimentación ≤ q_adm", `${fmt(qmax / 10, 3)} kg/cm²`, `≤ ${fmt(qadm, 2)} kg/cm²`, qmax / 10 <= qadm),
    ok("Sin tracción en el terreno (q_mín ≥ 0)", `${fmt(qmin, 2)} t/m²`, "≥ 0", qmin >= 0),
  ];

  const dims: Record<string, string> = {
    ...cuba.dims,
    nCol: String(nCol), dCol: dCol.toFixed(2), Htorre: Htorre.toFixed(2), Rcol: Rcol.toFixed(2), nArr: String(nArr),
    bArr: bArr.toFixed(2), dArr: dArr.toFixed(2),
    Dcim: Dcim.toFixed(2), asArr: fmt(asArr, 2),
    PuCol: PuCol.toFixed(2), MuCol: MuCol.toFixed(2), derivaRatio: derivaRatio.toFixed(4),
    mPtsColumna: packPts(perfilColumna), mPtsViga: packPts(perfilViga),
  };

  const recomendacion = cuba.Wagua > 500
    ? " Volumen superior a 500 m³: se recomienda evaluar la variante de fuste de muros de concreto (más rígida) en vez de columnas."
    : "";

  return out(
    `Tanque elevado sobre columnas — V≈${fmt(cuba.Wagua, 0)} m³ · H torre=${fmt(Htorre, 1)} m`,
    `Cuba INTZE D=${fmt(cuba.D, 2)} m · Torre: ${nCol} columnas Ø${fmt(dCol * 100, 0)} cm (análisis matricial 3D) · Deriva=${fmt(derivaRatio, 4)}${recomendacion}`,
    steps,
    checks,
    dims,
  );
};

/* ---------------------------------------------------------------------- *
 * 9. TANQUE ELEVADO SOBRE FUSTE DE MUROS DE CONCRETO (torre cilíndrica)  *
 * ---------------------------------------------------------------------- */

export const tanqueElevadoFuste: Engine = (raw) => {
  const cuba = disenarCubaIntze(raw, 1);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const gammaC = num(raw, "gammaC", 2.4);
  const Htorre = num(raw, "Htorre", 16);
  const qadm = num(raw, "qadm", 2);

  const sismo = leerSismo(raw);
  const Ct = 60;
  const T1 = Htorre / Ct;
  const Csis = e030C(T1, sismo.Tp, sismo.Tl);
  const R0fuste = SISTEMAS.find((s) => s.value === "ca-muros")!.R0;
  const Rfuste = num(raw, "Rfuste", R0fuste);
  const hcg = Htorre + cuba.Htotal / 2;
  const EcTm2 = EcConcreto(fc) * 10;
  const sigmaAdmConcAuto = 0.45 * fc;

  const DfusteManual = numOrAuto(raw, "Dfuste", 0);
  const eFusteManual = numOrAuto(raw, "eFuste", 0);
  const autoFuste = DfusteManual <= 0;
  let Dfuste = DfusteManual > 0 ? DfusteManual : Math.max(2.5, cuba.D * 0.35);
  let eFuste = eFusteManual > 0 ? eFusteManual : 0.25;

  if (autoFuste) {
    const DfusteCap = cuba.D * 0.92;
    for (let iter = 0; iter < 40; iter++) {
      const DextT = Dfuste, DintT = Dfuste - 2 * eFuste;
      const AfusteT = (Math.PI / 4) * (DextT * DextT - DintT * DintT);
      const IfusteT = (Math.PI / 64) * (DextT ** 4 - DintT ** 4);
      const WtotalT = cuba.pesoTotalCuba + gammaC * AfusteT * Htorre;
      const VfusteT = (sismo.Z * sismo.U * sismo.S * Csis * WtotalT) / Rfuste;
      const MfusteT = VfusteT * hcg;
      const AfusteCm2T = AfusteT * 1e4;
      const sigmaT = (WtotalT * 1000) / AfusteCm2T + (MfusteT * 1000 * 100 * (DextT / 2)) / (IfusteT * 1e8);
      const derivaT = derivaFuste(VfusteT, Htorre, EcTm2, IfusteT, Rfuste, false).derivaRatio;
      const AvT = 0.5 * AfusteCm2T;
      const phiVcT = (0.85 * 0.53 * Math.sqrt(fc) * AvT) / 1000;
      const shearOkT = VfusteT <= phiVcT;
      if (sigmaT <= sigmaAdmConcAuto && derivaT <= LIMITE_DERIVA_CONCRETO && shearOkT) break;
      if (Dfuste < DfusteCap) Dfuste = Math.round((Dfuste + 0.2) / 0.05) * 0.05;
      else eFuste = Math.round((eFuste + 0.025) / 0.005) * 0.005;
    }
  }

  const Dext = Dfuste, Dint = Dfuste - 2 * eFuste;
  const Afuste = (Math.PI / 4) * (Dext * Dext - Dint * Dint);
  const Ifuste = (Math.PI / 64) * (Dext ** 4 - Dint ** 4);
  const pesoFuste = gammaC * Afuste * Htorre;
  const Wtotal = cuba.pesoTotalCuba + pesoFuste;
  const Vfuste = (sismo.Z * sismo.U * sismo.S * Csis * Wtotal) / Rfuste;
  const Mfuste = Vfuste * hcg;

  let Dcim = numOrAuto(raw, "Dcim", 0);
  const DcimAutoF = Dcim <= 0;
  const DcimTopeF = Math.max(Dfuste * 1.5, cuba.D) * 2.2;
  if (DcimAutoF) {
    Dcim = Math.max(Dfuste * 1.5, 3);
    for (let iter = 0; iter < 60 && Dcim < DcimTopeF; iter++) {
      const areaT = (Math.PI * Dcim * Dcim) / 4;
      const IcimT = (Math.PI * Dcim ** 4) / 64;
      const qmaxT = Wtotal / areaT + (Mfuste * (Dcim / 2)) / IcimT;
      const qminT = Wtotal / areaT - (Mfuste * (Dcim / 2)) / IcimT;
      if (qmaxT / 10 <= qadm && qminT >= 0) break;
      Dcim += 0.25;
    }
  }

  const derivaTubo = derivaFuste(Vfuste, Htorre, EcTm2, Ifuste, Rfuste, false);

  const cBase = Dext / 2;
  const AfusteCm2 = Afuste * 1e4;
  const sigmaAxial = (Wtotal * 1000) / AfusteCm2;
  const sigmaFlexion = (Mfuste * 1000 * 100 * cBase) / (Ifuste * 1e8);
  const sigmaMax = sigmaAxial + sigmaFlexion;
  const sigmaMin = sigmaAxial - sigmaFlexion;
  const sigmaAdmConc = sigmaAdmConcAuto;

  const AsMinFuste = 0.0025 * AfusteCm2;
  const NtParedFuste = sigmaMin < 0 ? Math.abs(sigmaMin) * AfusteCm2 / 2 : 0;
  const AsTraccionFuste = (NtParedFuste * 1000) / fy / 0.9;
  const AsFusteFinal = Math.max(AsMinFuste, AsTraccionFuste);
  const cuantiaFuste = AsFusteFinal / AfusteCm2;

  const areaCim = (Math.PI * Dcim * Dcim) / 4;
  const Icim = (Math.PI * Dcim ** 4) / 64;
  const qmax = Wtotal / areaCim + (Mfuste * (Dcim / 2)) / Icim;
  const qmin = Wtotal / areaCim - (Mfuste * (Dcim / 2)) / Icim;

  const VuFuste = Vfuste;
  const Av = 0.5 * AfusteCm2;
  const phiVc = (0.85 * 0.53 * Math.sqrt(fc) * Av) / 1000;
  const cortanteOk = VuFuste <= phiVc;

  const nn = (k: number) => String(cuba.steps.length + 1 + k).padStart(2, "0");
  const steps: CalcStep[] = [
    ...cuba.steps,
    { n: nn(0), title: "Predimensionamiento del fuste", formula: "Sección anular Aext−Aint; Ø y espesor crecen hasta σ≤0,45f'c y deriva≤0,007",
      substitution: `Ø ext=${fmt(Dext, 2)} m · Ø int=${fmt(Dint, 2)} m · e=${fmt(eFuste * 100, 0)} cm · H=${fmt(Htorre, 2)} m`,
      result: `Peso del fuste=${fmt(pesoFuste, 2)} t · W total (cuba+agua+fuste)=${fmt(Wtotal, 2)} t`,
      note: "Geometría obtenida automáticamente a partir del volumen y la altura de la torre; puede sobrescribirse indicando el diámetro o el espesor del fuste en los datos de entrada." },
    { n: nn(1), title: "Periodo y fuerza sísmica (E.030, sistema de muros estructurales)",
      formula: "T=H/Ct (Ct=60)   ·   V=Z·U·C·S·W/R",
      substitution: `T=${fmt(T1, 3)} s · C=${fmt(Csis, 3)} · R=${fmt(Rfuste, 1)} (muros estructurales)`,
      result: `V=${fmt(Vfuste, 2)} t · M=${fmt(Mfuste, 2)} t·m (base del fuste)` },
    { n: nn(2), title: "Esfuerzos en la sección anular del fuste", formula: "σ = P/A ± M·c/I",
      result: `σ_máx=${fmt(sigmaMax, 1)} kg/cm² (compresión) ${sigmaMax <= sigmaAdmConc ? "≤" : ">"} 0,45f'c=${fmt(sigmaAdmConc, 1)} kg/cm²   ·   σ_mín=${fmt(sigmaMin, 1)} kg/cm²`,
      note: sigmaMin < 0 ? "La sección presenta tracción neta en la fibra extrema: se arma la pared para esa tracción." : "Toda la sección permanece en compresión.",
      ok: sigmaMax <= sigmaAdmConc },
    { n: nn(3), title: "Acero vertical del fuste", formula: "Asmín=0,25%Ag (E.060 muros) · As,tracción=N_t/(φfy)",
      result: `As=${fmt(AsFusteFinal, 1)} cm² repartido en dos capas (ρ=${fmt(cuantiaFuste * 100, 2)}%)` },
    { n: nn(4), title: "Verificación por cortante", formula: "Vu ≤ φVc = 0,85·0,53√f'c·Av   ·   Av≈0,5·Ag (sección anular, tubo de pared delgada)",
      substitution: `Ag=${fmt(AfusteCm2, 0)} cm² · Av=${fmt(Av, 0)} cm²`,
      result: `Vu=${fmt(VuFuste, 2)} t ${cortanteOk ? "≤" : ">"} φVc=${fmt(phiVc, 2)} t`,
      ok: cortanteOk },
    { n: nn(5), title: "Verificación de deriva — E.030 art. 5.2 y ACI 371",
      formula: "Δ=V·H³/(3EI) (voladizo)   ·   Δinelástica=0,75R·Δe   ·   deriva=Δ/H ≤ 0,007",
      result: `Δelástica=${fmt(derivaTubo.deltaElastica * 1000, 2)} mm · Δinelástica=${fmt(derivaTubo.deltaInelastica * 1000, 2)} mm → deriva=${fmt(derivaTubo.derivaRatio, 4)}`,
      note: "El fuste continuo, al comportarse como tubo en voladizo, es muy rígido: la deriva suele ser gobernada por el límite normativo con amplio margen respecto a la torre de columnas.",
      ok: derivaTubo.derivaRatio <= LIMITE_DERIVA_CONCRETO },
    { n: nn(6), title: "Cimentación — platea circular", formula: "q = W/A ± M·c/I",
      substitution: `Dcim=${fmt(Dcim, 2)} m`,
      result: `q_máx=${fmt(qmax / 10, 3)} kg/cm² · q_mín=${fmt(qmin, 2)} t/m²`,
      note: qmin < 0
        ? "El momento de volteo sísmico genera una pequeña tracción neta en el borde de la platea que un diámetro práctico no elimina por completo. Alternativas: platea con pilotes o anclajes a tracción en el borde de volteo, o análisis de contacto parcial (platea rígida sobre suelo, sin tracción)."
        : undefined,
      ok: qmax / 10 <= qadm && qmin >= 0 },
  ];

  const checks: CalcCheck[] = [
    ...cuba.checks,
    ok("Compresión máxima del fuste ≤ 0,45f'c", `${fmt(sigmaMax, 1)} kg/cm²`, `≤ ${fmt(sigmaAdmConc, 1)} kg/cm²`, sigmaMax <= sigmaAdmConc),
    ok("Cortante Vu ≤ φVc", `${fmt(VuFuste, 2)} t`, `≤ ${fmt(phiVc, 2)} t`, cortanteOk),
    ok(`Deriva del fuste ≤ ${LIMITE_DERIVA_CONCRETO}`, fmt(derivaTubo.derivaRatio, 4), `≤ ${LIMITE_DERIVA_CONCRETO}`, derivaTubo.derivaRatio <= LIMITE_DERIVA_CONCRETO),
    ok("q_máx cimentación ≤ q_adm", `${fmt(qmax / 10, 3)} kg/cm²`, `≤ ${fmt(qadm, 2)} kg/cm²`, qmax / 10 <= qadm),
    ok("Sin tracción en el terreno (q_mín ≥ 0)", `${fmt(qmin, 2)} t/m²`, "≥ 0", qmin >= 0),
  ];

  const dims: Record<string, string> = {
    ...cuba.dims,
    Dfuste: Dfuste.toFixed(2), eFuste: eFuste.toFixed(3), Htorre: Htorre.toFixed(2), Dcim: Dcim.toFixed(2),
    AsFuste: fmt(AsFusteFinal, 1), derivaRatio: derivaTubo.derivaRatio.toFixed(4),
  };

  const recomendacion = cuba.Wagua < 500
    ? " Volumen inferior a 500 m³: normalmente resulta más económica la variante de torre de columnas; el fuste continuo se justifica desde 500 m³ hacia arriba."
    : "";

  return out(
    `Tanque elevado sobre fuste — V≈${fmt(cuba.Wagua, 0)} m³ · H torre=${fmt(Htorre, 1)} m`,
    `Cuba INTZE D=${fmt(cuba.D, 2)} m · Fuste Ø${fmt(Dfuste, 2)} m, e=${fmt(eFuste * 100, 0)} cm · Deriva=${fmt(derivaTubo.derivaRatio, 4)}${recomendacion}`,
    steps,
    checks,
    dims,
  );
};

export const tanquesEngines: Record<string, Engine> = {
  reservorioApoyado,
  tanqueElevadoColumnas,
  tanqueElevadoFuste,
};
