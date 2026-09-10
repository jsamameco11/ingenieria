import { G, round } from "../num";

export type SeccionTipo = "rectangular" | "trapezoidal" | "triangular" | "circular" | "parabolica";
export type CanalModo = "verificar" | "optima";

export interface CanalInput {
  Q: number;
  n: number;
  S: number;
  tipo: SeccionTipo;
  b: number;
  z: number;
  D: number;
  yAsumido?: number;
}

export interface Geometria {
  y: number;
  A: number;
  P: number;
  R: number;
  T: number;
  Dhid: number;
}

export const GAMMA_AGUA = 9810;
export const NU_AGUA = 1e-6;

export function geom(tipo: SeccionTipo, y: number, b: number, z: number, D: number): Geometria {
  const yy = Math.max(y, 0);
  let A = 0;
  let P = 0;
  let T = 0;
  if (tipo === "rectangular") {
    A = b * yy;
    P = b + 2 * yy;
    T = b;
  } else if (tipo === "trapezoidal") {
    A = (b + z * yy) * yy;
    P = b + 2 * yy * Math.sqrt(1 + z * z);
    T = b + 2 * z * yy;
  } else if (tipo === "triangular") {
    A = z * yy * yy;
    P = 2 * yy * Math.sqrt(1 + z * z);
    T = 2 * z * yy;
  } else if (tipo === "parabolica") {
    const k = Math.max(z, 1e-6);
    T = 2 * k * Math.sqrt(yy);
    A = (2 / 3) * T * yy;
    P = T > 1e-9 ? T + (8 * yy * yy) / (3 * T) : 0;
  } else {
    const r = D / 2;
    const yCap = Math.min(yy, D * 0.999);
    const theta = 2 * Math.acos(clamp1((r - yCap) / Math.max(r, 1e-9)));
    A = (r * r / 2) * (theta - Math.sin(theta));
    P = r * theta;
    T = D * Math.sin(theta / 2);
  }
  const R = P > 0 ? A / P : 0;
  return { y: yy, A, P, R, T, Dhid: T > 0 ? A / T : 0 };
}

function clamp1(x: number) {
  return Math.min(1, Math.max(-1, x));
}

export function manningQ(g: Geometria, n: number, S: number) {
  if (g.A <= 0 || g.R <= 0 || S <= 0 || n <= 0) return 0;
  return (1 / n) * g.A * Math.pow(g.R, 2 / 3) * Math.sqrt(S);
}

export function manningV(g: Geometria, n: number, S: number) {
  const Q = manningQ(g, n, S);
  return g.A > 0 ? Q / g.A : 0;
}

export function chezyC(n: number, R: number) {
  return n > 0 && R > 0 ? (1 / n) * Math.pow(R, 1 / 6) : 0;
}

export function energiaEspecifica(y: number, V: number) {
  return y + (V * V) / (2 * G);
}

export function tiranteNormal(inp: CanalInput): number {
  const { Q, n, S, tipo, b, z, D } = inp;
  if (Q <= 0 || n <= 0 || S <= 0) return 0;
  const ymax = tipo === "circular" ? D * 0.99 : Math.max(8, Q * 4, 1);
  let lo = 1e-4;
  let hi = ymax;
  for (let i = 0; i < 90; i++) {
    const mid = (lo + hi) / 2;
    const q = manningQ(geom(tipo, mid, b, z, D), n, S);
    if (q < Q) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function tiranteCritico(inp: CanalInput): number {
  const { Q, tipo, b, z, D } = inp;
  if (Q <= 0) return 0;
  const target = (Q * Q) / G;
  const ymax = tipo === "circular" ? D * 0.99 : Math.max(8, Q * 4, 1);
  let lo = 1e-4;
  let hi = ymax;
  for (let i = 0; i < 90; i++) {
    const mid = (lo + hi) / 2;
    const g = geom(tipo, mid, b, z, D);
    const val = g.T > 0 ? (g.A ** 3) / g.T : 0;
    if (val < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function pendienteCritica(inp: CanalInput, yc: number) {
  const g = geom(inp.tipo, yc, inp.b, inp.z, inp.D);
  const V = g.A > 0 ? inp.Q / g.A : 0;
  if (g.R <= 0) return 0;
  return (inp.n * V / Math.pow(g.R, 2 / 3)) ** 2;
}

export function froude(V: number, Dhid: number) {
  return Dhid > 0 ? V / Math.sqrt(G * Dhid) : 0;
}

export function bordeLibreUSBR(y: number, V: number) {
  const bl = 0.6 + 0.04 * V * Math.sqrt(Math.max(y, 0));
  return Math.max(0.15, round(bl, 3));
}

export function seccionOptimaTrapezoidal(z: number) {
  return seccionOptima("trapezoidal", z);
}

export function seccionOptima(tipo: SeccionTipo, z: number) {
  if (tipo === "rectangular") {
    return { bSobreY: 2, nota: "Sección rectangular óptima: b = 2y  (R = y/2, semiángulo 45° en el prisma hidráulico)." };
  }
  if (tipo === "triangular") {
    return { bSobreY: 0, nota: "La triangular ya es un prisma; el óptimo geométrico corresponde a z = 1 (45°), R = y√2/4." };
  }
  if (tipo === "parabolica") {
    return { bSobreY: 0, nota: "En parábola el óptimo se expresa como T = 2√2 y. El factor k se ajusta para T(y) = 2k√y." };
  }
  if (tipo === "circular") {
    return { bSobreY: 0, nota: "Máxima conducción cerca de y ≈ 0.94 D; en diseño se suele adoptar y = 0.80 D para no trabajar a tubo lleno." };
  }
  return {
    bSobreY: 2 * (Math.sqrt(1 + z * z) - z),
    nota: "Trapecio hidráulicamente óptimo: R = y/2  →  b/y = 2(√(1+z²) − z).",
  };
}

export function disenarSeccionOptima(Q: number, n: number, S: number, tipo: SeccionTipo, z: number): { b: number; y: number; D: number; z: number } {
  const opt = seccionOptima(tipo, z);
  if (tipo === "circular") {
    let lo = 0.05;
    let hi = Math.max(2, Math.pow(Q, 0.4) * 3);
    for (let i = 0; i < 80; i++) {
      const D = (lo + hi) / 2;
      const q = manningQ(geom("circular", 0.8 * D, 0, 0, D), n, S);
      if (q < Q) lo = D;
      else hi = D;
    }
    const D = (lo + hi) / 2;
    return { b: 0, y: 0.8 * D, D, z: 0 };
  }
  if (tipo === "triangular") {
    const zz = z > 0 ? z : 1;
    let lo = 1e-3;
    let hi = Math.max(2, Q * 3);
    for (let i = 0; i < 80; i++) {
      const y = (lo + hi) / 2;
      const q = manningQ(geom("triangular", y, 0, zz, 0), n, S);
      if (q < Q) lo = y;
      else hi = y;
    }
    const y = (lo + hi) / 2;
    return { b: 0, y, D: 0, z: zz };
  }
  if (tipo === "parabolica") {
    const k = z > 0 ? z : 2;
    let lo = 1e-3;
    let hi = Math.max(2, Q * 3);
    for (let i = 0; i < 80; i++) {
      const y = (lo + hi) / 2;
      const q = manningQ(geom("parabolica", y, 0, k, 0), n, S);
      if (q < Q) lo = y;
      else hi = y;
    }
    const y = (lo + hi) / 2;
    return { b: 0, y, D: 0, z: k };
  }
  const ratio = tipo === "rectangular" ? 2 : Math.max(0.15, opt.bSobreY);
  let lo = 1e-3;
  let hi = Math.max(2, Q * 3);
  for (let i = 0; i < 90; i++) {
    const y = (lo + hi) / 2;
    const b = ratio * y;
    const q = manningQ(geom(tipo, y, b, z, 0), n, S);
    if (q < Q) lo = y;
    else hi = y;
  }
  const y = (lo + hi) / 2;
  return { b: ratio * y, y, D: 0, z };
}

export function tiranteConjugado(y1: number, Fr1: number) {
  if (y1 <= 0 || Fr1 <= 0) return 0;
  return (y1 / 2) * (-1 + Math.sqrt(1 + 8 * Fr1 * Fr1));
}

export type Revestimiento = {
  id: string;
  grupo: string;
  label: string;
  n: number;
  Vmin: number;
  Vmax: number;
  tauMax: number;
};

export const REVESTIMIENTOS: Revestimiento[] = [
  { id: "hdpe", grupo: "Sintético", label: "HDPE / geomembrana lisa", n: 0.009, Vmin: 0.6, Vmax: 5.0, tauMax: 80 },
  { id: "concreto-pulido", grupo: "Concreto", label: "Concreto pulido (acabado de cimbras)", n: 0.012, Vmin: 0.6, Vmax: 6.0, tauMax: 120 },
  { id: "concreto", grupo: "Concreto", label: "Concreto acabado USBR (típico)", n: 0.013, Vmin: 0.6, Vmax: 4.5, tauMax: 100 },
  { id: "concreto-aspero", grupo: "Concreto", label: "Concreto revestido, ligeramente áspero", n: 0.017, Vmin: 0.6, Vmax: 4.0, tauMax: 80 },
  { id: "mamposteria", grupo: "Albañilería", label: "Mampostería de piedra / laja", n: 0.025, Vmin: 0.6, Vmax: 3.5, tauMax: 40 },
  { id: "grava", grupo: "Tierra", label: "Lecho de grava gruesa (Fortier)", n: 0.025, Vmin: 0.75, Vmax: 1.8, tauMax: 15 },
  { id: "tierra-firme", grupo: "Tierra", label: "Tierra firme, alineada y uniforme", n: 0.0225, Vmin: 0.45, Vmax: 1.2, tauMax: 7.2 },
  { id: "tierra", grupo: "Tierra", label: "Tierra ordinaria (limo-arcillosa)", n: 0.025, Vmin: 0.4, Vmax: 0.9, tauMax: 4.8 },
  { id: "tierra-arenosa", grupo: "Tierra", label: "Tierra arenosa suelta", n: 0.027, Vmin: 0.35, Vmax: 0.6, tauMax: 2.4 },
  { id: "tierra-maleza", grupo: "Tierra", label: "Tierra con maleza / no mantenida", n: 0.035, Vmin: 0.3, Vmax: 0.7, tauMax: 3.5 },
];

export const N_MANNING = REVESTIMIENTOS.map((r) => ({ id: r.id, n: r.n, label: r.label }));

export const SECCION_LABEL: Record<SeccionTipo, string> = {
  rectangular: "Rectangular",
  trapezoidal: "Trapezoidal",
  triangular: "Triangular",
  circular: "Circular",
  parabolica: "Parabólica",
};

export type FilaY = {
  y: number;
  A: number;
  P: number;
  R: number;
  T: number;
  Q: number;
  V: number;
  Fr: number;
  E: number;
};

export function filaHidraulica(inp: CanalInput, y: number): FilaY {
  const g = geom(inp.tipo, y, inp.b, inp.z, inp.D);
  const Q = manningQ(g, inp.n, inp.S);
  const V = g.A > 0 ? Q / g.A : 0;
  return {
    y,
    A: g.A,
    P: g.P,
    R: g.R,
    T: g.T,
    Q,
    V,
    Fr: froude(V, g.Dhid),
    E: energiaEspecifica(y, V),
  };
}

export type CanalCalculo = {
  inp: CanalInput;
  revest: Revestimiento;
  yn: number;
  yc: number;
  g: Geometria;
  gc: Geometria;
  Qn: number;
  V: number;
  Vc: number;
  Fr: number;
  Sc: number;
  C: number;
  E: number;
  Emin: number;
  BL: number;
  H: number;
  Ttop: number;
  Aexc: number;
  Alin: number;
  tau: number;
  Re: number;
  y2: number;
  dEsalto: number;
  Qlleno: number;
  opt: { bSobreY: number; nota: string };
  bOpt: number;
  yOpt: number;
  regimen: "subcrítico" | "crítico" | "supercrítico";
  iter: FilaY[];
  elementos: FilaY[];
  curvaE: { y: number; E: number }[];
};

export function calcularCanal(
  raw: CanalInput,
  opts?: { modo?: CanalModo; revestId?: string; Vmin?: number; Vmax?: number }
): CanalCalculo {
  const revest = REVESTIMIENTOS.find((r) => r.id === opts?.revestId) ?? REVESTIMIENTOS.find((r) => Math.abs(r.n - raw.n) < 1e-6) ?? REVESTIMIENTOS[2];
  let inp: CanalInput = { ...raw, n: raw.n || revest.n };
  if (opts?.modo === "optima") {
    const d = disenarSeccionOptima(inp.Q, inp.n, inp.S, inp.tipo, inp.tipo === "rectangular" ? 0 : inp.z);
    inp = { ...inp, b: d.b, z: d.z, D: d.D || inp.D };
  }
  const yn = tiranteNormal(inp);
  const yc = tiranteCritico(inp);
  const g = geom(inp.tipo, yn, inp.b, inp.z, inp.D);
  const gc = geom(inp.tipo, yc, inp.b, inp.z, inp.D);
  const Qn = manningQ(g, inp.n, inp.S);
  const V = g.A > 0 ? inp.Q / Math.max(g.A, 1e-12) : 0;
  const Vc = gc.A > 0 ? inp.Q / gc.A : 0;
  const Fr = froude(V, g.Dhid);
  const Sc = pendienteCritica(inp, yc);
  const C = chezyC(inp.n, g.R);
  const E = energiaEspecifica(yn, V);
  const Emin = energiaEspecifica(yc, Vc);
  const BL = bordeLibreUSBR(yn, V);
  const H = yn + BL;
  const gH = geom(inp.tipo, H, inp.b, inp.z, inp.tipo === "circular" ? inp.D : 0);
  const Ttop = inp.tipo === "circular" ? inp.D : gH.T;
  const Aexc = gH.A;
  const Alin = g.P;
  const tau = GAMMA_AGUA * g.R * inp.S;
  const Re = (V * 4 * g.R) / NU_AGUA;
  const y2 = Fr > 1.05 ? tiranteConjugado(yn, Fr) : tiranteConjugado(yc, 1.01);
  const dEsalto = Fr > 1.05 && y2 > yn ? ((y2 - yn) ** 3) / (4 * yn * y2) : 0;
  const Qlleno = manningQ(gH, inp.n, inp.S);
  const opt = seccionOptima(inp.tipo, inp.z);
  const dOpt = disenarSeccionOptima(inp.Q, inp.n, inp.S, inp.tipo, inp.z);
  const factores = [0.4, 0.55, 0.7, 0.85, 1, 1.15, 1.3, 1.5];
  const iter = factores.map((f) => filaHidraulica(inp, Math.max(0.02, yn * f)));
  const elementos = [0.2, 0.4, 0.6, 0.8, 1, 1.2].map((f) => filaHidraulica(inp, Math.max(0.02, yn * f)));
  const yLo = Math.max(0.04, yc * 0.22);
  const yMaxE = Math.max(yn, yc, 0.2) * 2.6;
  const curvaE: { y: number; E: number }[] = [];
  for (let i = 0; i <= 40; i++) {
    const y = yLo + (i / 40) * (yMaxE - yLo);
    const gg = geom(inp.tipo, y, inp.b, inp.z, inp.D);
    const vv = gg.A > 0 ? inp.Q / gg.A : 0;
    const Ept = energiaEspecifica(y, vv);
    if (Number.isFinite(Ept) && Ept < yMaxE * 8) curvaE.push({ y, E: Ept });
  }
  const regimen: CanalCalculo["regimen"] = Fr >= 1.05 ? "supercrítico" : Fr <= 0.95 ? "subcrítico" : "crítico";
  return {
    inp,
    revest,
    yn,
    yc,
    g,
    gc,
    Qn,
    V,
    Vc,
    Fr,
    Sc,
    C,
    E,
    Emin,
    BL,
    H,
    Ttop,
    Aexc,
    Alin,
    tau,
    Re,
    y2,
    dEsalto,
    Qlleno,
    opt,
    bOpt: dOpt.b,
    yOpt: dOpt.y,
    regimen,
    iter,
    elementos,
    curvaE,
  };
}
