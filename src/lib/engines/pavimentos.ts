import { type CalcCheck, type CalcOutput, type Engine, fmt, num, str } from "../types";

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

/** Inverse Φ. Zr AASHTO = Φ⁻¹(1 − R). */
function normsInv(p: number) {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577459590407e2, -3.066479806614736e1, 2.506628277459239];
  const b = [-5.447609652725104e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  const x = Math.min(0.999999, Math.max(1e-12, p));
  let q: number;
  let r: number;
  if (x < pLow) {
    q = Math.sqrt(-2 * Math.log(x));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (x <= pHigh) {
    q = x - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - x));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

function zrR(Rpct: number) {
  return normsInv(1 - Math.min(0.999, Math.max(0.5, Rpct / 100)));
}

type Clase = {
  key: string;
  label: string;
  lefF: number;
  lefR: number;
};

const CLASES: Clase[] = [
  { key: "nAuto", label: "Automóvil / taxi", lefF: 0.0004, lefR: 0.0002 },
  { key: "nPick", label: "Camioneta / SUV", lefF: 0.005, lefR: 0.003 },
  { key: "nMicro", label: "Microbús / combi", lefF: 0.40, lefR: 0.50 },
  { key: "nBus2", label: "Ómnibus 2 ejes", lefF: 0.90, lefR: 1.10 },
  { key: "nBus3", label: "Ómnibus 3 ejes", lefF: 1.20, lefR: 1.50 },
  { key: "nC2", label: "Camión C2 (2 ejes)", lefF: 1.30, lefR: 1.70 },
  { key: "nC3", label: "Camión C3 (3 ejes)", lefF: 2.80, lefR: 3.50 },
  { key: "nT2S1", label: "Semirremolque T2S1", lefF: 1.80, lefR: 2.30 },
  { key: "nT3S2", label: "Semirremolque T3S2", lefF: 3.20, lefR: 4.20 },
  { key: "nT3S3", label: "Semirremolque T3S3", lefF: 4.50, lefR: 5.80 },
];

function laneFactor(nCarr: number) {
  if (nCarr <= 1) return 1;
  if (nCarr === 2) return 0.9;
  if (nCarr === 3) return 0.7;
  return 0.6;
}

function growthFactor(r: number, n: number) {
  if (Math.abs(r) < 1e-8) return n;
  return (Math.pow(1 + r, n) - 1) / r;
}

function mrPsi(cbr: number) {
  if (cbr <= 10) return 1500 * cbr;
  return 2555 * Math.pow(cbr, 0.64);
}

function kPci(cbr: number) {
  const pts: [number, number][] = [
    [2, 75],
    [3, 100],
    [5, 150],
    [8, 185],
    [10, 200],
    [15, 250],
    [20, 280],
    [30, 350],
    [50, 500],
  ];
  if (cbr <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (cbr <= pts[i][0]) {
      const t = (cbr - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
      return pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1]);
    }
  }
  return 550;
}

export function transito(raw: Record<string, string>, modo: "flex" | "rig") {
  const nYears = Math.max(1, num(raw, "nYears", 20));
  const rPct = num(raw, "r", 4);
  const r = rPct / 100;
  const nCarr = Math.max(1, Math.round(num(raw, "nCarr", 2)));
  const sentido = str(raw, "sentido", "bi");
  const Fd = sentido === "uni" ? 1 : 0.5;
  const Fc = laneFactor(nCarr);
  const GF = growthFactor(r, nYears);
  let tpda = 0;
  let esalDia = 0;
  const rows: string[][] = [["Clase", "N (veh/día)", "%", `fE ${modo === "flex" ? "flex" : "ríg"}`, "ESAL/día (ambos)"]];
  const detalle: { label: string; n: number; lef: number; esal: number }[] = [];
  for (const c of CLASES) {
    const ni = Math.max(0, num(raw, c.key, 0));
    tpda += ni;
    const lef = modo === "flex" ? c.lefF : c.lefR;
    const esal = ni * lef;
    esalDia += esal;
    detalle.push({ label: c.label, n: ni, lef, esal });
  }
  for (const d of detalle) {
    const pct = tpda > 0 ? (100 * d.n) / tpda : 0;
    rows.push([d.label, fmt(d.n, 0), fmt(pct, 1), fmt(d.lef, 4), fmt(d.esal, 2)]);
  }
  const fE = tpda > 0 ? esalDia / tpda : 0;
  const esalCarrilDia = esalDia * Fd * Fc;
  const W18 = esalCarrilDia * 365 * GF;
  return { nYears, rPct, r, nCarr, sentido, Fd, Fc, GF, tpda, esalDia, esalCarrilDia, fE, W18, rows, detalle };
}

function logW18Flex(SN: number, Zr: number, So: number, dPSI: number, MR: number) {
  const sn1 = SN + 1;
  const a = Zr * So + 9.36 * Math.log10(sn1) - 0.2;
  const b = Math.log10(Math.max(dPSI, 0.05) / (4.2 - 1.5)) / (0.4 + 1094 / Math.pow(sn1, 5.19));
  const c = 2.32 * Math.log10(Math.max(MR, 500)) - 8.07;
  return a + b + c;
}

function snRequerido(W18: number, Zr: number, So: number, dPSI: number, MR: number) {
  let lo = 0.5;
  let hi = 14;
  const target = Math.log10(Math.max(W18, 10));
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (logW18Flex(mid, Zr, So, dPSI, MR) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function logW18Rig(
  D: number,
  Zr: number,
  So: number,
  dPSI: number,
  p0: number,
  Sc: number,
  Cd: number,
  J: number,
  Ec: number,
  k: number
) {
  const d1 = D + 1;
  const a = Zr * So + 7.35 * Math.log10(d1) - 0.06;
  const b = Math.log10(Math.max(dPSI, 0.05) / (4.5 - 1.5)) / (1 + 1.624e7 / Math.pow(d1, 8.46));
  const termA = Math.pow(D, 0.75) - 1.132;
  const termB = Math.pow(D, 0.75) - 18.42 / Math.pow(Math.max(Ec / Math.max(k, 20), 10), 0.25);
  const arg = (Sc * Cd * Math.max(termA, 0.01)) / (215.63 * J * Math.max(termB, 0.01));
  const c = (4.22 - 0.32 * p0) * Math.log10(Math.max(arg, 1e-6));
  return a + b + c;
}

function dRequerido(
  W18: number,
  Zr: number,
  So: number,
  dPSI: number,
  p0: number,
  Sc: number,
  Cd: number,
  J: number,
  Ec: number,
  k: number
) {
  let lo = 5;
  let hi = 22;
  const target = Math.log10(Math.max(W18, 10));
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (logW18Rig(mid, Zr, So, dPSI, p0, Sc, Cd, J, Ec, k) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function mDrain(code: string) {
  if (code === "exc") return 1.4;
  if (code === "bueno") return 1.2;
  if (code === "pobre") return 0.8;
  if (code === "muy") return 0.6;
  return 1;
}

function cmToIn(cm: number) {
  return cm / 2.54;
}

function inToCm(inch: number) {
  return inch * 2.54;
}

function trafficSteps(T: ReturnType<typeof transito>, modo: string) {
  return [
    {
      n: "01",
      title: "Conteo vehicular clasificado (TPDA de apertura)",
      formula: "TPDA = Σ Ni    ·    clases MTC / AASHTO (vehículos/día en ambos sentidos)",
      substitution: T.detalle.filter((d) => d.n > 0).map((d) => `${d.label} ${fmt(d.n, 0)}`).join("  ·  ") || "sin tránsito ingresado",
      result: `TPDA₀ = ${fmt(T.tpda, 0)} veh/día`,
      note: "El conteo es el tránsito medio diario anual de apertura. Los fE son factores de equivalencia a eje simple de 18 kip (80 kN) AASHTO 93, para SN≈5 (flexible) o D≈9\" (rígido) y pt=2.5.",
    },
    {
      n: "02",
      title: "Factor de equivalencia ponderado fE",
      formula: "fE = Σ (Ni · fEi) / TPDA",
      substitution: `Σ Ni fEi = ${fmt(T.esalDia, 2)} ESAL/día (ambos sentidos)`,
      result: `fE (${modo}) = ${fmt(T.fE, 4)} ESAL/vehículo`,
    },
    {
      n: "03",
      title: "Factores direccional y de carril",
      formula: "Fd = 0.50 (bidireccional) ó 1.00 (un sentido)    ·    Fc tabla AASHTO (1 carril 1.00 · 2 → 0.90 · 3 → 0.70 · ≥4 → 0.60)",
      substitution: `sentido ${T.sentido === "uni" ? "unidireccional" : "bidireccional"}    n carriles = ${T.nCarr}`,
      result: `Fd = ${fmt(T.Fd, 2)}    ·    Fc = ${fmt(T.Fc, 2)}`,
    },
    {
      n: "04",
      title: "Factor de crecimiento y W18 de diseño",
      formula: "GF = [(1+r)ⁿ − 1]/r    ·    W18 = 365 · TPDA₀ · fE · Fd · Fc · GF",
      substitution: `r = ${fmt(T.rPct, 2)} %    n = ${fmt(T.nYears, 0)} años    GF = ${fmt(T.GF, 2)}`,
      result: `W18 = ${fmt(T.W18, 0)} ESAL de 18 kip en el carril de diseño`,
      note: "AASHTO Guide 1993, Parte II. El ESAL se calcula para el carril más cargado en el periodo de diseño.",
    },
  ];
}

export const esalAashto: Engine = (raw) => {
  const Tf = transito(raw, "flex");
  const Tr = transito(raw, "rig");
  return out(
    `W18 flex = ${fmt(Tf.W18, 0)}    ·    W18 ríg = ${fmt(Tr.W18, 0)}    ·    TPDA₀ = ${fmt(Tf.tpda, 0)} veh/día`,
    `n = ${fmt(Tf.nYears, 0)} años  ·  r = ${fmt(Tf.rPct, 1)} %  ·  Fd=${fmt(Tf.Fd, 2)}  Fc=${fmt(Tf.Fc, 2)}  GF=${fmt(Tf.GF, 2)}`,
    [
      ...trafficSteps(Tf, "flexible"),
      {
        n: "05",
        title: "ESAL rígido (fE distintos)",
        formula: "Los fE rígidos son mayores en camiones: la losa es más sensible al eje dual/tándem",
        result: `fE ríg = ${fmt(Tr.fE, 4)}    ·    W18 ríg = ${fmt(Tr.W18, 0)} ESAL`,
      },
    ],
    [
      ok("TPDA > 0", fmt(Tf.tpda, 0), "> 0", Tf.tpda > 0),
      ok("W18 flex calculado", fmt(Tf.W18, 0), "ESAL", Tf.W18 > 0),
    ],
    [
      { title: "Desglose — factores flexibles", rows: Tf.rows },
      { title: "Desglose — factores rígidos", rows: Tr.rows },
    ],
    {
      pavKind: "esal",
      W18f: String(Math.round(Tf.W18)),
      W18r: String(Math.round(Tr.W18)),
      tpda: String(Math.round(Tf.tpda)),
    }
  );
};

export const pavimentoFlexible: Engine = (raw) => {
  const T = transito(raw, "flex");
  const CBR = num(raw, "CBR", 6);
  const R = num(raw, "R", 90);
  const So = num(raw, "So", 0.45);
  const p0 = num(raw, "p0", 4.2);
  const pt = num(raw, "pt", 2.5);
  const a1 = num(raw, "a1", 0.44);
  const a2 = num(raw, "a2", 0.14);
  const a3 = num(raw, "a3", 0.11);
  const m2 = mDrain(str(raw, "dren2", "reg"));
  const m3 = mDrain(str(raw, "dren3", "reg"));
  const D1 = num(raw, "D1", 10);
  const D2 = num(raw, "D2", 20);
  const D3 = num(raw, "D3", 25);
  const CBR2 = num(raw, "CBR2", 80);
  const CBR3 = num(raw, "CBR3", 30);
  const Zr = zrR(R);
  const dPSI = Math.max(0.2, p0 - pt);
  const MR = mrPsi(CBR);
  const MR2 = mrPsi(CBR2);
  const MR3 = mrPsi(CBR3);
  const SNreq = snRequerido(T.W18, Zr, So, dPSI, MR);
  const SN1req = snRequerido(T.W18, Zr, So, dPSI, MR2);
  const SN2req = snRequerido(T.W18, Zr, So, dPSI, MR3);
  const SN1 = a1 * cmToIn(D1);
  const SN2 = a2 * cmToIn(D2) * m2;
  const SN3 = a3 * cmToIn(D3) * m3;
  const SNprov = SN1 + SN2 + SN3;
  const D1star = inToCm(SN1req / Math.max(a1, 0.01));
  const D2star = inToCm(Math.max(0, SN2req - SN1) / Math.max(a2 * m2, 0.01));
  const D3star = inToCm(Math.max(0, SNreq - SN1 - SN2) / Math.max(a3 * m3, 0.01));
  const D3min = Math.max(15, D3star);
  return out(
    `SN req = ${fmt(SNreq, 2)}    ·    SN prov = ${fmt(SNprov, 2)}    ·    W18 = ${fmt(T.W18, 0)}`,
    `Carpeta ${fmt(D1, 0)} cm  ·  base ${fmt(D2, 0)} cm  ·  subbase ${fmt(D3, 0)} cm  ·  CBR ${fmt(CBR, 1)} %`,
    [
      ...trafficSteps(T, "flexible"),
      {
        n: "05",
        title: "Módulo resiliente de subrasante",
        formula: "CBR ≤ 10:  MR (psi) = 1500 CBR      CBR > 10:  MR = 2555 CBR^0.64",
        substitution: `CBR = ${fmt(CBR, 1)} %`,
        result: `MR = ${fmt(MR, 0)} psi  (${fmt(MR / 145.04, 1)} MPa)`,
        note: "AASHTO 1993 correlaciona MR con CBR para suelos de grano fino. Verificar con ensayo resiliente cuando el proyecto lo exija.",
      },
      {
        n: "06",
        title: "Confiabilidad y desviación estándar",
        formula: "Zr = Φ⁻¹(1−R)    ·    So típico flexible 0.40–0.50",
        substitution: `R = ${fmt(R, 0)} %    So = ${fmt(So, 2)}`,
        result: `Zr = ${fmt(Zr, 3)}`,
      },
      {
        n: "07",
        title: "Pérdida de serviciabilidad",
        formula: "ΔPSI = p0 − pt    ·    p0 = 4.2 (flexible)    pt = 2.0 a 2.5",
        result: `ΔPSI = ${fmt(dPSI, 2)}    (p0=${fmt(p0, 2)}  pt=${fmt(pt, 2)})`,
      },
      {
        n: "08",
        title: "Número estructural requerido SN",
        formula: "log W18 = Zr So + 9.36 log(SN+1) − 0.20 + log[ΔPSI/2.7] / [0.40+1094/(SN+1)^5.19] + 2.32 log MR − 8.07",
        substitution: `W18 = ${fmt(T.W18, 0)}    MR = ${fmt(MR, 0)} psi    Zr So = ${fmt(Zr * So, 3)}`,
        result: `SN requerido = ${fmt(SNreq, 2)}`,
        note: "Se resuelve SN por bisección sobre la ecuación de la Guía AASHTO 1993, Parte II, pavimento flexible.",
      },
      {
        n: "09",
        title: "SN provisto por el paquete",
        formula: "SN = a1 D1 + a2 D2 m2 + a3 D3 m3     Di en pulgadas",
        substitution: `a1=${fmt(a1, 2)} D1=${fmt(cmToIn(D1), 2)}"    a2=${fmt(a2, 2)} m2=${fmt(m2, 2)} D2=${fmt(cmToIn(D2), 2)}"    a3=${fmt(a3, 2)} m3=${fmt(m3, 2)} D3=${fmt(cmToIn(D3), 2)}"`,
        result: `SN = ${fmt(SN1, 2)} + ${fmt(SN2, 2)} + ${fmt(SN3, 2)} = ${fmt(SNprov, 2)}`,
        note: "a1=0.44 mezcla asfáltica densa; a2=0.14 base granular triturada; a3=0.11 subbase. m = coeficiente de drenaje AASHTO.",
      },
      {
        n: "10",
        title: "Diseño por capas (AASHTO 93)",
        formula: "SN1 sobre la base (MR base)    ·    SN2 sobre la subbase    ·    SN3 sobre la subrasante",
        substitution: `CBR base ${fmt(CBR2, 0)} % → MR=${fmt(MR2, 0)} psi    ·    CBR subbase ${fmt(CBR3, 0)} % → MR=${fmt(MR3, 0)} psi`,
        result: `SN1=${fmt(SN1req, 2)}  SN2=${fmt(SN2req, 2)}  SN3=${fmt(SNreq, 2)}`,
        note: "Cada SN se calcula con la misma ecuación flexible, tomando como «subrasante» el módulo de la capa inmediata inferior. Así se dimensiona carpeta, base y subbase por separado.",
      },
      {
        n: "11",
        title: "Espesores de capa y mínimos",
        formula: "D1* = SN1/a1    ·    D2* = (SN2−a1D1)/(a2 m2)    ·    D3* = (SN3−a1D1−a2D2 m2)/(a3 m3)     Di en pulgadas",
        substitution: `D1* = ${fmt(D1star, 1)} cm    D2* = ${fmt(D2star, 1)} cm    D3* = ${fmt(D3star, 1)} cm`,
        result: `Adoptado D1=${fmt(D1, 0)}  D2=${fmt(D2, 0)}  D3=${fmt(D3, 0)} cm    ·    D3 mín constructivo ${fmt(D3min, 1)} cm`,
        note: "Mínimos usuales: carpeta ≥ 7.5 cm, base y subbase ≥ 15 cm. Si D* sale menor, rige el mínimo constructivo.",
      },
    ],
    [
      ok("SN prov ≥ SN req", fmt(SNprov, 2), `≥ ${fmt(SNreq, 2)}`, SNprov + 0.02 >= SNreq),
      ok("D1 ≥ máx(7.5, D1*)", `${fmt(D1, 1)} cm`, `≥ ${fmt(Math.max(7.5, D1star), 1)} cm`, D1 + 0.05 >= Math.max(7.5, D1star)),
      ok("D2 ≥ máx(15, D2*)", `${fmt(D2, 1)} cm`, `≥ ${fmt(Math.max(15, D2star), 1)} cm`, D2 + 0.05 >= Math.max(15, D2star)),
      ok("D3 ≥ máx(15, D3*)", `${fmt(D3, 1)} cm`, `≥ ${fmt(Math.max(15, D3star), 1)} cm`, D3 + 0.05 >= Math.max(15, D3star)),
    ],
    [{ title: "Desglose del conteo y fE flexibles", rows: T.rows }],
    { pavKind: "flex", D1: String(D1), D2: String(D2), D3: String(D3), CBR: String(CBR) }
  );
};

export const pavimentoRigido: Engine = (raw) => {
  const T = transito(raw, "rig");
  const CBR = num(raw, "CBR", 6);
  const R = num(raw, "R", 90);
  const So = num(raw, "So", 0.35);
  const p0 = num(raw, "p0", 4.5);
  const pt = num(raw, "pt", 2.5);
  const fc = num(raw, "fc", 280);
  const Dcm = num(raw, "D", 22);
  const Cd = num(raw, "Cd", 1);
  const J = num(raw, "J", 3.2);
  const eBase = num(raw, "eBase", 15);
  const Zr = zrR(R);
  const dPSI = Math.max(0.2, p0 - pt);
  const fcPsi = fc * 14.2233;
  const Sc = 9 * Math.sqrt(fcPsi);
  const Ec = 57000 * Math.sqrt(fcPsi);
  const k = kPci(CBR);
  const DreqIn = dRequerido(T.W18, Zr, So, dPSI, p0, Sc, Cd, J, Ec, k);
  const DreqCm = inToCm(DreqIn);
  const Duse = Math.max(Dcm, Math.ceil(DreqCm / 0.5) * 0.5);
  const phiDowel = Math.max(2.5, Math.round((Duse / 8) * 10) / 10);
  const Ldowel = Math.max(40, Math.round(phiDowel * 18));
  const Ljunta = Math.min(6, Math.max(3.5, 0.21 * Duse));
  const bCarr = num(raw, "bCarr", 3.6);
  const Atie = (1.3 * (bCarr * 100) * Duse) / (2 * 1400);
  const as12 = 1.27;
  const sTie = Math.max(30, Math.min(75, Math.round((as12 / Math.max(Atie, 0.05)) * 100 / 5) * 5));
  return out(
    `D req = ${fmt(DreqCm, 1)} cm    ·    D adoptado = ${fmt(Duse, 1)} cm    ·    W18 = ${fmt(T.W18, 0)}`,
    `Losa f'c=${fmt(fc, 0)} kg/cm²  ·  pasadores Ø ${fmt(phiDowel, 1)} cm  ·  junta ${fmt(Ljunta, 2)} m  ·  k=${fmt(k, 0)} pci`,
    [
      ...trafficSteps(T, "rígido"),
      {
        n: "05",
        title: "Módulo de reacción de subrasante k",
        formula: "k correlacionado con CBR (PCA / AASHTO Fig. 3.3), pci",
        substitution: `CBR = ${fmt(CBR, 1)} %`,
        result: `k = ${fmt(k, 0)} pci  (${fmt(k * 0.2714, 1)} MPa/m)`,
        note: "Si hay subbase granular, k efectivo aumenta. Aquí se usa k de subrasante; la subbase se verifica como apoyo y drenaje.",
      },
      {
        n: "06",
        title: "Resistencia a flexotracción Sc y Ec",
        formula: "Sc = 9 √f'c    ·    Ec = 57 000 √f'c     (psi)",
        substitution: `f'c = ${fmt(fc, 0)} kg/cm² = ${fmt(fcPsi, 0)} psi`,
        result: `Sc = ${fmt(Sc, 0)} psi    ·    Ec = ${fmt(Ec, 0)} psi`,
      },
      {
        n: "07",
        title: "Confiabilidad, So y ΔPSI",
        formula: "Zr = Φ⁻¹(1−R)    ·    So rígido 0.30–0.40    ·    p0 = 4.5",
        substitution: `R=${fmt(R, 0)} %  So=${fmt(So, 2)}  pt=${fmt(pt, 2)}`,
        result: `Zr = ${fmt(Zr, 3)}    ΔPSI = ${fmt(dPSI, 2)}`,
      },
      {
        n: "08",
        title: "Espesor de losa D — AASHTO 93 rígido",
        formula: "log W18 = Zr So + 7.35 log(D+1) − 0.06 + log(ΔPSI/3) / [1+1.624·10⁷/(D+1)^8.46] + (4.22−0.32 p0) log[Sc Cd (D^0.75−1.132) / (215.63 J (D^0.75−18.42/(Ec/k)^0.25))]",
        substitution: `J=${fmt(J, 2)} (pasadores)    Cd=${fmt(Cd, 2)}    D prueba en pulgadas`,
        result: `D requerido = ${fmt(DreqIn, 2)} in = ${fmt(DreqCm, 1)} cm    ·    adoptar ${fmt(Duse, 1)} cm`,
        note: "J=3.2 losa con pasadores; J=3.8–4.2 sin pasadores. Cd=1.0 drenaje regular. D en pulgadas en la ecuación.",
      },
      {
        n: "09",
        title: "Pasadores y barras de amarre",
        formula: "Ø pasador ≈ D/8    L pasador ≈ 18Ø    ·    As amarre = 1.3 b h / (2 fs)   fs=1400 kg/cm²   b = ancho a borde libre",
        substitution: `D=${fmt(Duse, 1)} cm    b carril = ${fmt(bCarr, 2)} m    junta transversal ≈ ${fmt(Ljunta, 2)} m`,
        result: `Pasadores Ø ${fmt(phiDowel, 1)} cm × ${fmt(Ldowel, 0)} cm @ 30 cm    ·    As amarre = ${fmt(Atie, 2)} cm²/m    ·    Ø 1/2″ @ ${fmt(sTie, 0)} cm en junta longitudinal`,
        note: "Pasadores en juntas transversales de contracción (transferencia de carga, J=3.2). Barras de amarre en junta longitudinal para mantener el contacto de losas.",
      },
      {
        n: "10",
        title: "Subbase",
        formula: "Subbase granular ≥ 15 cm bajo losa (drenaje y apoyo uniforme)",
        result: `Subbase adoptada ${fmt(eBase, 0)} cm`,
      },
    ],
    [
      ok("D adoptado ≥ D req", `${fmt(Duse, 1)} cm`, `≥ ${fmt(DreqCm, 1)} cm`, Duse + 0.05 >= DreqCm),
      ok("D ≥ 15 cm", `${fmt(Duse, 1)} cm`, "≥ 15 cm", Duse >= 15),
      ok("Subbase ≥ 15 cm", `${fmt(eBase, 0)} cm`, "≥ 15 cm", eBase >= 15),
    ],
    [{ title: "Desglose del conteo y fE rígidos", rows: T.rows }],
    { pavKind: "rig", D1: String(Duse), D2: String(eBase), D3: "0", CBR: String(CBR) }
  );
};

export const pavimentoIntertrabado: Engine = (raw) => {
  const sistema = str(raw, "sistema", "adoquin");
  const T = transito(raw, sistema === "mixto" ? "rig" : "flex");
  const CBR = num(raw, "CBR", 6);
  const R = num(raw, "R", 90);
  const So = num(raw, "So", sistema === "mixto" ? 0.35 : 0.45);
  const pt = num(raw, "pt", 2.5);
  const Zr = zrR(R);
  const MR = mrPsi(CBR);
  const k = kPci(CBR);

  if (sistema === "mixto") {
    const p0 = 4.5;
    const dPSI = Math.max(0.2, p0 - pt);
    const fc = num(raw, "fc", 280);
    const eAC = num(raw, "eAC", 5);
    const Dcm = num(raw, "D", 20);
    const eBase = num(raw, "eBase", 15);
    const Cd = num(raw, "Cd", 1);
    const J = num(raw, "J", 3.2);
    const fcPsi = fc * 14.2233;
    const Sc = 9 * Math.sqrt(fcPsi);
    const Ec = 57000 * Math.sqrt(fcPsi);
    const DreqIn = dRequerido(T.W18, Zr, So, dPSI, p0, Sc, Cd, J, Ec, k);
    const DreqCm = inToCm(DreqIn);
    const Duse = Math.max(Dcm, Math.ceil(DreqCm / 0.5) * 0.5);
    return out(
      `Mixto: losa ${fmt(Duse, 1)} cm + carpeta ${fmt(eAC, 1)} cm    ·    W18 = ${fmt(T.W18, 0)}`,
      `La losa toma el ESAL rígido; la carpeta es de rodadura e impermeabilización (no se descuenta D)`,
      [
        ...trafficSteps(T, "rígido (mixto)"),
        {
          n: "05",
          title: "Concepto de pavimento mixto nuevo",
          formula: "D losa con AASHTO 93 rígido    +    carpeta asfáltica de rodadura eAC ≥ 4 cm",
          result: `D req = ${fmt(DreqCm, 1)} cm    ·    eAC = ${fmt(eAC, 1)} cm`,
          note: "En pavimento mixto nuevo la losa es estructural (AASHTO 93 rígido). La carpeta no reduce D; mejora regularidad y sella juntas. Un overlay de rehabilitación usaría la Parte III (no aplica aquí).",
        },
        {
          n: "06",
          title: "Losa de concreto",
          formula: "Misma ecuación de losa que el pavimento rígido, J con pasadores",
          substitution: `f'c=${fmt(fc, 0)}  k=${fmt(k, 0)} pci  Zr=${fmt(Zr, 3)}`,
          result: `Adoptar losa ${fmt(Duse, 1)} cm sobre subbase ${fmt(eBase, 0)} cm`,
        },
        {
          n: "07",
          title: "Carpeta asfáltica de rodadura",
          formula: "eAC ≥ 4 cm (riego de liga + mezcla densa)    ·    no estructural en este esquema",
          result: `eAC = ${fmt(eAC, 1)} cm ${eAC >= 4 ? "CUMPLE" : "aumentar carpeta"}`,
        },
      ],
      [
        ok("D losa ≥ D req", `${fmt(Duse, 1)} cm`, `≥ ${fmt(DreqCm, 1)} cm`, Duse + 0.05 >= DreqCm),
        ok("Carpeta ≥ 4 cm", `${fmt(eAC, 1)} cm`, "≥ 4 cm", eAC >= 4),
        ok("Subbase ≥ 15 cm", `${fmt(eBase, 0)} cm`, "≥ 15 cm", eBase >= 15),
      ],
      [{ title: "Desglose del conteo y fE rígidos", rows: T.rows }],
      { pavKind: "mixto", D1: String(eAC), D2: String(Duse), D3: String(eBase), CBR: String(CBR) }
    );
  }

  const p0 = 4.2;
  const dPSI = Math.max(0.2, p0 - pt);
  const eAdoq = num(raw, "eAdoq", 8);
  const eArena = num(raw, "eArena", 4);
  const D2 = num(raw, "D2", 20);
  const D3 = num(raw, "D3", 25);
  const CBR2 = num(raw, "CBR2", 80);
  const CBR3 = num(raw, "CBR3", 30);
  const aP = eAdoq >= 10 ? 0.45 : 0.44;
  const a2 = num(raw, "a2", 0.14);
  const a3 = num(raw, "a3", 0.11);
  const m2 = mDrain(str(raw, "dren2", "reg"));
  const m3 = mDrain(str(raw, "dren3", "reg"));
  const SNreq = snRequerido(T.W18, Zr, So, dPSI, MR);
  const SN1req = snRequerido(T.W18, Zr, So, dPSI, mrPsi(CBR2));
  const SN2req = snRequerido(T.W18, Zr, So, dPSI, mrPsi(CBR3));
  const SN1 = aP * cmToIn(eAdoq);
  const SN2 = a2 * cmToIn(D2) * m2;
  const SN3 = a3 * cmToIn(D3) * m3;
  const SNprov = SN1 + SN2 + SN3;
  const D2star = inToCm(Math.max(0, SN2req - SN1) / Math.max(a2 * m2, 0.01));
  const D3star = inToCm(Math.max(0, SNreq - SN1 - SN2) / Math.max(a3 * m3, 0.01));
  const eMin = T.W18 > 1e6 ? 8 : T.W18 > 1e5 ? 8 : 6;
  return out(
    `SN req = ${fmt(SNreq, 2)}    ·    SN prov = ${fmt(SNprov, 2)}    ·    adoquín ${fmt(eAdoq, 0)} cm`,
    `Adoquín ${fmt(eAdoq, 0)} + arena ${fmt(eArena, 0)} + base ${fmt(D2, 0)} + subbase ${fmt(D3, 0)} cm  ·  W18 = ${fmt(T.W18, 0)}`,
    [
      ...trafficSteps(T, "flexible (intertrabado)"),
      {
        n: "05",
        title: "Equivalencia AASHTO 93 / ICPI",
        formula: "El intertrabado se diseña como flexible: SN = ap Dp + a2 D2 m2 + a3 D3 m3",
        substitution: `ap = ${fmt(aP, 2)} (adoquín de concreto ${fmt(eAdoq, 0)} cm)    ·    la arena de asiento no aporta SN`,
        result: `SN adoquín = ${fmt(SN1, 2)}`,
        note: "ICPI Tech Spec 4 y práctica MTC: pieza de 80 mm ≈ a=0.44 (como carpeta AC). Cama de arena 3–5 cm no estructural. Se exige confinamiento perimetral.",
      },
      {
        n: "06",
        title: "SN requerido (misma ecuación flexible)",
        formula: "log W18 = f(SN, Zr, So, ΔPSI, MR)",
        substitution: `MR = ${fmt(MR, 0)} psi    R=${fmt(R, 0)} %    Zr=${fmt(Zr, 3)}`,
        result: `SN requerido = ${fmt(SNreq, 2)}`,
      },
      {
        n: "07",
        title: "SN del paquete intertrabado",
        formula: "SN = ap Dp + a2 D2 m2 + a3 D3 m3",
        substitution: `Dp=${fmt(cmToIn(eAdoq), 2)}"    D2=${fmt(cmToIn(D2), 2)}" m2=${fmt(m2, 2)}    D3=${fmt(cmToIn(D3), 2)}" m3=${fmt(m3, 2)}`,
        result: `SN = ${fmt(SN1, 2)}+${fmt(SN2, 2)}+${fmt(SN3, 2)} = ${fmt(SNprov, 2)}`,
      },
      {
        n: "08",
        title: "Espesor de pieza y cama de arena",
        formula: "Peatonal ≥ 6 cm    ·    vehicular ≥ 8 cm    ·    W18>10⁶: 8–10 cm + base de calidad",
        substitution: `W18 = ${fmt(T.W18, 0)}    arena de asiento ${fmt(eArena, 1)} cm (rango 3–5 cm)`,
        result: `e adoquín mín ${fmt(eMin, 0)} cm    ·    adoptado ${fmt(eAdoq, 0)} cm`,
      },
      {
        n: "09",
        title: "Base y subbase por capas",
        formula: "D2* = (SN2−ap Dp)/(a2 m2)    ·    D3* = (SN3−ap Dp−a2 D2 m2)/(a3 m3)",
        substitution: `SN1 sobre base = ${fmt(SN1req, 2)}    SN2 sobre subbase = ${fmt(SN2req, 2)}    SN3 = ${fmt(SNreq, 2)}`,
        result: `D2* = ${fmt(D2star, 1)} cm    D3* = ${fmt(D3star, 1)} cm    ·    adoptado ${fmt(D2, 0)} / ${fmt(D3, 0)} cm`,
        note: "Confinamiento perimetral obligatorio (sardinel o solera). Colocación en espina de pez a 45° en vías vehiculares (ICPI).",
      },
    ],
    [
      ok("SN prov ≥ SN req", fmt(SNprov, 2), `≥ ${fmt(SNreq, 2)}`, SNprov + 0.02 >= SNreq),
      ok("Espesor de adoquín", `${fmt(eAdoq, 0)} cm`, `≥ ${fmt(eMin, 0)} cm`, eAdoq + 0.05 >= eMin),
      ok("Arena 3–5 cm", `${fmt(eArena, 1)} cm`, "3–5 cm", eArena >= 3 && eArena <= 5.5),
      ok("Base ≥ máx(15, D2*)", `${fmt(D2, 0)} cm`, `≥ ${fmt(Math.max(15, D2star), 1)} cm`, D2 + 0.05 >= Math.max(15, D2star)),
      ok("Subbase ≥ máx(15, D3*)", `${fmt(D3, 0)} cm`, `≥ ${fmt(Math.max(15, D3star), 1)} cm`, D3 + 0.05 >= Math.max(15, D3star)),
    ],
    [{ title: "Desglose del conteo y fE flexibles", rows: T.rows }],
    { pavKind: "adoquin", D1: String(eAdoq), D2: String(D2), D3: String(D3), eArena: String(eArena), CBR: String(CBR) }
  );
};

export const pavimentosAashto: Record<string, Engine> = {
  esalAashto,
  pavimentoFlexible,
  pavimentoRigido,
  pavimentoIntertrabado,
};
