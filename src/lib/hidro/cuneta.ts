import { G, round } from "../num";
import {
  PERIODOS_IDF,
  ZONAS_IILA,
  calcA,
  calcKg,
  curvaIdf,
  intensidad,
  tcFAA,
  tcKirpich,
  type IdfRow,
} from "./canaleta";

export interface CunetaInput {
  Qforzado: number;
  n: number;
  S: number;
  tipo: "triangular" | "trapezoidal";
  zIzq: number;
  zDer: number;
  b: number;
  yMax: number;
  Tmax: number;
  zonaId: string;
  nIila: number;
  tg: number;
  eg: number;
  bParam: number;
  Tret: number;
  Ltramo: number;
  Bcalzada: number;
  Ccalzada: number;
  Htalud: number;
  Ctalud: number;
  usarTc: boolean;
  tMin: number;
  estacionSenamhi: string;
  codigoEstacion: string;
  periodoRegistro: string;
  cotaRasante: number;
  Stransversal: number;
  progresiva: string;
}

export interface GeomCuneta {
  y: number;
  A: number;
  P: number;
  R: number;
  T: number;
  Dhid: number;
}

export const N_CUNETA = [
  { n: 0.013, label: "Concreto f'c 175, acabado liso" },
  { n: 0.016, label: "Concreto ordinario / cuneta moldeada" },
  { n: 0.017, label: "Mampostería de piedra" },
  { n: 0.022, label: "Revestimiento asfáltico" },
  { n: 0.025, label: "Tierra compactada (sin revestir)" },
];

export const C_CUNETA = [
  { C: 0.9, label: "Pavimento asfáltico / concreto" },
  { C: 0.7, label: "Afirmado" },
  { C: 0.5, label: "Berma / talud con cobertura media" },
  { C: 0.4, label: "Talud con cobertura herbácea" },
  { C: 0.35, label: "Talud natural / monte bajo" },
];

export function geomCuneta(inp: Pick<CunetaInput, "tipo" | "zIzq" | "zDer" | "b">, y: number): GeomCuneta {
  const { zIzq, zDer, b, tipo } = inp;
  const A =
    tipo === "triangular"
      ? 0.5 * y * y * (zIzq + zDer)
      : y * (b + 0.5 * y * (zIzq + zDer));
  const P =
    tipo === "triangular"
      ? y * (Math.sqrt(1 + zIzq * zIzq) + Math.sqrt(1 + zDer * zDer))
      : b + y * (Math.sqrt(1 + zIzq * zIzq) + Math.sqrt(1 + zDer * zDer));
  const T = tipo === "triangular" ? y * (zIzq + zDer) : b + y * (zIzq + zDer);
  const R = P > 0 ? A / P : 0;
  return { y, A, P, R, T, Dhid: T > 0 ? A / T : 0 };
}

function Qm(g: GeomCuneta, n: number, S: number) {
  if (g.A <= 0 || g.R <= 0 || S <= 0 || n <= 0) return 0;
  return (1 / n) * g.A * g.R ** (2 / 3) * Math.sqrt(S);
}

function solveY(inp: CunetaInput, target: (g: GeomCuneta) => number, goal: number) {
  let lo = 1e-4;
  let hi = Math.max(inp.yMax * 3, 2);
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const val = target(geomCuneta(inp, mid));
    if (val < goal) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function calcularCuneta(inp: CunetaInput) {
  const a = round(calcA(inp.tg, inp.nIila, inp.eg), 3);
  const Kfreq = round(calcKg(inp.eg), 3);
  const Acalzada = inp.Ltramo * inp.Bcalzada;
  const Atalud = inp.Ltramo * inp.Htalud;
  const Am2 = Acalzada + Atalud;
  const Aha = Am2 / 10000;
  const C =
    Am2 > 0 ? (inp.Ccalzada * Acalzada + inp.Ctalud * Atalud) / Am2 : inp.Ccalzada;
  const Lesc = Math.max(inp.Ltramo, 1);
  const TcKir = tcKirpich(Lesc, inp.S);
  const TcFaa = tcFAA(C, Lesc, inp.S);
  const Tc = Math.max(5, TcKir > 0 ? TcKir : TcFaa);
  const tMin = inp.usarTc ? Math.max(10, Tc) : Math.max(10, inp.tMin);
  const I = intensidad(a, Kfreq, inp.Tret, tMin / 60, inp.bParam, inp.nIila);
  const Qrac = (C * I * Aha) / 360;
  const Qd = inp.Qforzado > 0 ? inp.Qforzado : Qrac;
  const idf: IdfRow[] = curvaIdf(a, Kfreq, inp.bParam, inp.nIila);

  const yn = solveY(inp, (g) => Qm(g, inp.n, inp.S), Qd);
  const yc = solveY(inp, (g) => (g.T > 0 ? g.A ** 3 / g.T : 0), (Qd * Qd) / G);
  const g = geomCuneta(inp, yn);
  const Qn = Qm(g, inp.n, inp.S);
  const V = g.A > 0 ? Qn / g.A : 0;
  const Fr = g.Dhid > 0 ? V / Math.sqrt(G * g.Dhid) : 0;
  const gMax = geomCuneta(inp, inp.yMax);
  const Qcap = Qm(gMax, inp.n, inp.S);
  const spread = yn * inp.zIzq;
  const Vmin = inp.n >= 0.022 ? 0.4 : 0.3;
  const Vmax = inp.n >= 0.022 ? 1.2 : 4.0;

  return {
    a,
    Kfreq,
    Tc,
    TcKir,
    TcFaa,
    tMin,
    I: round(I, 2),
    Acalzada,
    Atalud,
    Am2,
    Aha,
    C,
    Qrac,
    Qd,
    idf,
    periodos: PERIODOS_IDF,
    yn,
    yc,
    g,
    Qcap,
    Qn,
    V,
    Fr,
    spread,
    Vmin,
    Vmax,
    cumpleTirante: yn <= inp.yMax,
    cumpleVelMin: V >= Vmin,
    cumpleVelMax: V <= Vmax,
    cumpleSpread: spread <= inp.Tmax,
    zona: ZONAS_IILA.find((z) => z.id === inp.zonaId) ?? null,
  };
}

export type CunetaResult = ReturnType<typeof calcularCuneta>;
