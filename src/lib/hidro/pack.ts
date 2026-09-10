import { G } from "../num";
import { geom, tiranteNormal } from "./canal";

export type HidroPackKind =
  | "desarenador"
  | "bocatoma"
  | "rapida"
  | "aliviadero"
  | "acueducto"
  | "riego"
  | "orificio";

export const HIDRO_PACK_META: Record<HidroPackKind, { code: string; title: string; norma: string; blurb: string }> = {
  desarenador: {
    code: "HID-06",
    title: "Desarenador de riego",
    norma: "Camp · USBR · Stokes",
    blurb: "Cámara de asiento: Vs, longitud, vertedero de salida y lavado. Unifica desarenador, vertedero y canales de riego.",
  },
  bocatoma: {
    code: "HID-07",
    title: "Bocatoma",
    norma: "Kiselov · Creager · Kratz–Hansen",
    blurb: "Ventana de captación (estiaje y avenida), barraje, remanso y desripiador. No duplica el reservorio (AP-07).",
  },
  rapida: {
    code: "HID-08",
    title: "Rápida y resalto",
    norma: "USBR · Chow · Chanson",
    blurb: "Canal de aproximación, control crítico, rápida, trayectoria, resalto y pozo. Incluye caída vertical y escalonada.",
  },
  aliviadero: {
    code: "HID-09",
    title: "Aliviadero lateral",
    norma: "Forchheimer · Weisbach · De Marchi",
    blurb: "Longitud de cresta para evacuar el excedente del canal sin ahogar la plantilla.",
  },
  acueducto: {
    code: "HID-10",
    title: "Acueducto",
    norma: "Manning · AISC cables",
    blurb: "Conducción en canal o tubo sobre depresión: hidráulica y, si es colgante, cables y viento.",
  },
  riego: {
    code: "HID-11",
    title: "Demanda y riego parcelario",
    norma: "FAO-56 · Hazen–Williams",
    blurb: "ETo, cédula, caudal de diseño y laterales de aspersión, goteo o cinta. No es dotación urbana (AP-01).",
  },
  orificio: {
    code: "HID-12",
    title: "Orificio y compuerta",
    norma: "Torricelli · Rouse",
    blurb: "Gasto y velocidad por orificio libre, sumergido o de pared delgada.",
  },
};

const NU = 1.0e-6;

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function ynRect(Q: number, n: number, S: number, b: number, z = 0) {
  return tiranteNormal({ Q, n, S, tipo: z > 0 ? "trapezoidal" : "rectangular", b, z, D: 0 });
}

/** Velocidad de caída de partícula (Stokes si Re<1; Rubey si no). */
export function velocidadCaida(dMm: number, Gs = 2.65, T = 20) {
  const d = Math.max(dMm, 0.01) / 1000;
  const nu = NU * (1 + 0.033 * (20 - T) * 0.1);
  const vsStokes = ((Gs - 1) * 9.81 * d * d) / (18 * nu);
  const ReS = (vsStokes * d) / nu;
  if (ReS < 1) return { Vs: vsStokes, Re: ReS, ley: "Stokes" as const };
  const F = Math.sqrt((2 / 3) + (36 * nu * nu) / ((Gs - 1) * 9.81 * d ** 3));
  const Vs = (Math.sqrt((Gs - 1) * 9.81 * d) * (F - Math.sqrt(F * F - 2 / 3))) || vsStokes * 0.45;
  return { Vs: Math.max(Vs, vsStokes * 0.2), Re: (Vs * d) / nu, ley: "Rubey" as const };
}

export type DesarenadorIn = {
  Q: number;
  dMm: number;
  Gs: number;
  H: number;
  Vh: number;
  alfa: number;
  CdVert: number;
  hVert: number;
  Sfondo: number;
  nLavado: number;
  T: number;
  nCeldas: number;
  Qbypass: number;
  Ltrans: number;
};

export function calcularDesarenador(inp: DesarenadorIn) {
  const Q = Math.max(inp.Q, 1e-6);
  const H = Math.max(inp.H, 0.2);
  const Vh = clamp(inp.Vh, 0.08, 0.45);
  const nCeldas = Math.max(1, Math.round(inp.nCeldas || 1));
  const caida = velocidadCaida(inp.dMm, inp.Gs, inp.T || 20);
  const Vs = caida.Vs;
  const A = Q / Vh;
  const B = A / H;
  const Bcelda = B / nCeldas;
  const Lteo = (Vh * H) / Math.max(Vs, 1e-6);
  const L = inp.alfa * Lteo;
  const t = L / Vh;
  const Vol = B * H * L;
  const VolLodos = B * L * 0.15;
  const Lw = inp.hVert > 0 ? Q / (inp.CdVert * (2 / 3) * Math.sqrt(2 * G) * inp.hVert ** 1.5) : 0;
  const Vlav = (1 / Math.max(inp.nLavado, 0.012)) * Math.pow((B * 0.15) / (B + 0.3), 2 / 3) * Math.sqrt(Math.max(inp.Sfondo, 0.01));
  const okV = Vh >= 0.15 && Vh <= 0.35;
  const okT = t >= 30 && t <= 180;
  const okLav = Vlav >= 0.6;
  return { ...inp, ...caida, nCeldas, A, B, Bcelda, Lteo, L, t, Vol, VolLodos, Lw, Vlav, okV, okT, okLav, ok: okV && okT };
}

export type BocatomaIn = {
  Q: number;
  Qmax: number;
  Hest: number;
  Y1: number;
  kBarrote: number;
  eBarrote: number;
  eLuz: number;
  CdOrif: number;
  Co: number;
  ho: number;
  hs: number;
  Srio: number;
  Ymax: number;
  Lbarraje: number;
  Ccreager: number;
  d50: number;
  Kreja: number;
};

export function calcularBocatoma(inp: BocatomaIn) {
  const H = Math.max(inp.Hest, 0.05);
  const Y1 = Math.max(inp.Y1, 0.05);
  const ratio = H / (H + Y1);
  const M = (0.407 + 0.045 * ratio) * (1 + 0.285 * ratio * ratio) * Math.sqrt(2 * G);
  const s = clamp(1.05 * (1 - 0.2 * 0.05) * Math.cbrt(0.15 / H), 0.45, 1);
  const k = clamp(inp.kBarrote, 0.7, 1);
  const bNeto = inp.Q / Math.max(k * s * M * H ** 1.5, 1e-6);
  const nBarr = Math.max(1, Math.round(bNeto / Math.max(inp.eLuz, 0.04) - 1));
  const bTotal = bNeto + nBarr * inp.eBarrote;
  const hOrif = inp.Q / Math.max(inp.CdOrif * bNeto * Math.sqrt(2 * G * H), 1e-6);
  const P = inp.ho + hOrif + inp.hs;
  const Cc = inp.Co + P;
  const He = inp.Lbarraje > 0 ? (inp.Qmax / (inp.Ccreager * inp.Lbarraje)) ** (2 / 3) : 0;
  const Lremanso = inp.Srio > 0 ? inp.Ymax / inp.Srio : 0;
  const htMuro = inp.Ymax + He + 0.30;
  const hReja = inp.Kreja * (inp.Q / Math.max(bNeto * H, 1e-6)) ** 2 / (2 * G);
  return { ...inp, M, s, k, bNeto, nBarr, bTotal, hOrif, P, Cc, He, Lremanso, htMuro, hReja };
}

export type RapidaTipo = "rapida" | "vertical" | "escalonada";

export type RapidaIn = {
  tipo: RapidaTipo;
  Q: number;
  b: number;
  nRap: number;
  Srap: number;
  nCanal: number;
  Scanal: number;
  bCanal: number;
  zCanal: number;
  Hdesnivel: number;
  hEscalon: number;
  lEscalon: number;
  TW: number;
  eLosa: number;
};

export function calcularRapida(inp: RapidaIn) {
  const q = inp.Q / Math.max(inp.b, 0.1);
  const yc = (q * q / G) ** (1 / 3);
  const ynCan = ynRect(inp.Q, inp.nCanal, inp.Scanal, inp.bCanal, inp.zCanal);
  const gCan = geom(inp.zCanal > 0 ? "trapezoidal" : "rectangular", ynCan, inp.bCanal, inp.zCanal, 0);
  const Vcan = gCan.A > 0 ? inp.Q / gCan.A : 0;
  const Ecan = ynCan + Vcan ** 2 / (2 * G);
  const ynRap = ynRect(inp.Q, inp.nRap, Math.max(inp.Srap, 0.02), inp.b, 0);
  const gRap = geom("rectangular", Math.max(ynRap, 0.05), inp.b, 0, 0);
  const V1 = gRap.A > 0 ? inp.Q / gRap.A : 0;
  const y1 = gRap.y;
  const Fr1 = y1 > 0 ? V1 / Math.sqrt(G * y1) : 0;
  const y2 = 0.5 * y1 * (Math.sqrt(1 + 8 * Fr1 * Fr1) - 1);
  const Lres = 6 * Math.max(y2 - y1, 0);
  const Lpav = 2.5 * Math.max(1.9 * y2 - y1, 0);
  const Lhoriz = inp.Srap > 0 ? inp.Hdesnivel / inp.Srap : inp.Hdesnivel;
  const V3 = V1;
  const hv3 = V3 ** 2 / (2 * G);
  const k = 0.5;
  const LT = Math.sqrt((2 * inp.Hdesnivel * 0.25) / Math.max(k * inp.Srap, 0.01));
  const alfa = Math.atan2(inp.hEscalon, Math.max(inp.lEscalon, 0.05));
  const dc = yc;
  const dco = 0.89 * Math.max(inp.hEscalon, 0.05) * Math.cos(alfa);
  const skimming = dc > dco;
  const Nesc = inp.hEscalon > 0 ? Math.max(1, Math.round(inp.Hdesnivel / inp.hEscalon)) : 0;
  const FrEsc = dc > 0 ? q / Math.sqrt(G * dc ** 3) : 0;
  const Ce = clamp(0.75 * Math.sin(alfa) ** 0.75, 0.3, 0.7);
  const Hr = 0.3 * dc * (FrEsc ** 0.6) * (1 - Ce * 0.4) + 0.5;
  return {
    ...inp,
    q,
    yc,
    ynCan,
    Vcan,
    Ecan,
    ynRap,
    y1,
    V1,
    Fr1,
    y2,
    Lres,
    Lpav,
    Lhoriz,
    hv3,
    LT,
    alfa,
    dc,
    dco,
    skimming,
    Nesc,
    FrEsc,
    Ce,
    Hr,
    tipoUSBR: Fr1 < 2.5 ? "sin resalto claro" : Fr1 < 4.5 ? "USBR I / II" : Fr1 < 9 ? "USBR III" : "USBR IV",
    resaltoAhogado: inp.TW > y2,
    okResalto: Fr1 >= 2.5 && y2 > y1 && inp.TW <= y2 + 0.05,
  };
}

export type AliviaderoIn = {
  Q: number;
  Qmax: number;
  Q2: number;
  n: number;
  z: number;
  S: number;
  b: number;
  p: number;
  muF: number;
  muW: number;
  BL: number;
};

/** Función de De Marchi (adimensional) para cresta de altura p y energía E constante. */
export function phiDeMarchi(y: number, E: number, p: number) {
  const yp = Math.max(y - p, 1e-6);
  const Ey = Math.max(E - y, 1e-9);
  const Ep = Math.max(E - p, 1e-6);
  const a = (2 * E - 3 * p) / Math.max(E, 1e-6);
  const term1 = a * Math.sqrt(Ey / yp);
  const term2 = 3 * Math.asin(Math.min(1, Math.sqrt(Ey / Ep)));
  return term1 - term2;
}

function caudalPorEnergia(y: number, E: number, b: number, z: number) {
  if (y <= 0 || y >= E) return 0;
  const A = (b + z * y) * y;
  return A * Math.sqrt(2 * G * (E - y));
}

/** Tirante sobre la curva E = cte. Rama alta = subcrítico; baja = supercrítico. */
export function yEnergiaConstante(Q: number, E: number, b: number, z: number, rama: "alto" | "bajo") {
  const lo = 1e-4;
  const hi = Math.max(E - 1e-4, lo + 1e-3);
  let yc = 0.5 * (lo + hi);
  let qMax = 0;
  for (let i = 0; i <= 48; i++) {
    const y = lo + ((hi - lo) * i) / 48;
    const q = caudalPorEnergia(y, E, b, z);
    if (q > qMax) {
      qMax = q;
      yc = y;
    }
  }
  if (Q >= qMax * 0.999) return yc;
  if (rama === "alto") {
    let a = yc;
    let c = hi;
    for (let i = 0; i < 50; i++) {
      const m = 0.5 * (a + c);
      if (caudalPorEnergia(m, E, b, z) > Q) a = m;
      else c = m;
    }
    return 0.5 * (a + c);
  }
  let a = lo;
  let c = yc;
  for (let i = 0; i < 50; i++) {
    const m = 0.5 * (a + c);
    if (caudalPorEnergia(m, E, b, z) > Q) c = m;
    else a = m;
  }
  return 0.5 * (a + c);
}

export function calcularAliviadero(inp: AliviaderoIn) {
  const tipo = inp.z > 0 ? "trapezoidal" : "rectangular";
  const Qevac = Math.max(inp.Qmax - inp.Q2, 0);
  const yn = ynRect(inp.Q, inp.n, inp.S, inp.b, inp.z);
  const Ymax = ynRect(inp.Qmax, inp.n, inp.S, inp.b, inp.z);
  const Y2 = ynRect(inp.Q2, inp.n, inp.S, inp.b, inp.z);
  const h1 = Math.max(Ymax - inp.p, 0.05);
  const h2 = Math.max(Y2 - inp.p, 0.02);
  const h = 0.5 * (h1 + h2);
  const kF = inp.muF * (2 / 3) * Math.sqrt(2 * G);
  const Lforch = Qevac / Math.max(kF * h ** 1.5, 1e-6);
  const hW = Math.max(0.6 * inp.BL, 0.08);
  const kW = inp.muW * (2 / 3) * Math.sqrt(2 * G);
  const Lweis = Qevac / Math.max(kW * hW ** 1.5, 1e-6);
  const g1 = geom(tipo, Math.max(Ymax, 0.05), inp.b, inp.z, 0);
  const V1 = g1.A > 0 ? inp.Qmax / g1.A : 0;
  const D1 = g1.T > 0 ? g1.A / g1.T : Ymax;
  const Fr1 = V1 / Math.sqrt(Math.max(G * D1, 1e-9));
  const E1 = Ymax + V1 ** 2 / (2 * G);
  const rama: "alto" | "bajo" = Fr1 < 1 ? "alto" : "bajo";
  const y2e = yEnergiaConstante(Math.max(inp.Q2, 1e-6), E1, inp.b, inp.z, rama);
  const y1e = Math.max(Ymax, inp.p + 0.02);
  const y2dm = Math.max(y2e, inp.p + 0.02);
  const phi1 = phiDeMarchi(y1e, E1, inp.p);
  const phi2 = phiDeMarchi(y2dm, E1, inp.p);
  const g2e = geom(tipo, y2dm, inp.b, inp.z, 0);
  const Beq = 0.5 * (g1.T + g2e.T);
  const Cd = Math.max(inp.muW, 0.4);
  const Ldemarchi = ((1.5 * Beq) / Cd) * Math.abs(phi1 - phi2);
  const Ladopt = Math.max(Lweis, Ldemarchi, Lforch * 0.85);
  const sumergido = Y2 > inp.p + 0.8 * h1;
  return {
    ...inp,
    Qevac,
    yn,
    Ymax,
    Y2,
    h1,
    h2,
    h,
    Lforch,
    hW,
    Lweis,
    E1,
    Fr1,
    y2e: y2dm,
    Beq,
    rama,
    phi1,
    phi2,
    Ldemarchi,
    Ladopt,
    sumergido,
  };
}

export type AcueductoIn = {
  Q: number;
  n: number;
  S: number;
  tipo: "canal" | "tubo";
  b: number;
  z: number;
  DintMm: number;
  DextMm: number;
  L: number;
  pesoTubo: number;
  longTramo: number;
  fy: number;
  qViento: number;
  colgante: boolean;
  Csismo: number;
  flecha: number;
};

export function calcularAcueducto(inp: AcueductoIn) {
  let A = 0;
  let V = 0;
  let yn = 0;
  let hf = 0;
  if (inp.tipo === "tubo") {
    const D = Math.max(inp.DintMm, 20) / 1000;
    A = (Math.PI * D * D) / 4;
    V = A > 0 ? inp.Q / A : 0;
    const Rh = D / 4;
    const Sf = inp.n > 0 && Rh > 0 ? (inp.n * V / Math.pow(Rh, 2 / 3)) ** 2 : 0;
    hf = Sf * inp.L;
    yn = D;
  } else {
    yn = ynRect(inp.Q, inp.n, inp.S, inp.b, inp.z);
    const g = geom(inp.z > 0 ? "trapezoidal" : "rectangular", yn, inp.b, inp.z, 0);
    A = g.A;
    V = A > 0 ? inp.Q / A : 0;
    hf = inp.S * inp.L;
  }
  const Dext = Math.max(inp.DextMm, inp.DintMm) / 1000;
  const wu = inp.longTramo > 0 ? inp.pesoTubo / inp.longTramo : 0;
  const wAgua = 1000 * ((Math.PI * (inp.DintMm / 1000) ** 2) / 4);
  const Fv = wu + wAgua;
  const Cs = clamp(inp.Csismo || 0.15, 0.05, 0.45);
  const Fsismo = Cs * Fv;
  const Fviento = inp.qViento * Dext;
  const wres = Math.hypot(Fv + Fsismo, Fviento);
  const Wtot = wres * inp.L;
  const Vapoyo = Wtot / 2;
  const fs = 0.5 * inp.fy;
  const As = fs > 0 ? Vapoyo / (fs * 100) : 0;
  const fmax = inp.flecha > 0 ? inp.flecha : Math.max(inp.L / 200, 0.05);
  const Hcable = inp.L > 0 ? (wres * inp.L * inp.L) / (8 * Math.max(fmax, 0.02) * 100) : 0;
  const okV = V >= 0.6 && V <= 3.0;
  return { ...inp, A, V, yn, hf, wu, wAgua, Fv, Fsismo, Fviento, wres, Wtot, Vapoyo, fs, As, fmax, Hcable, okV };
}

const RA_LAT12: number[] = [14.5, 15.2, 15.8, 15.4, 14.6, 13.8, 14.0, 14.8, 15.5, 15.6, 15.0, 14.4];

export type RiegoMetodo = "aspersión" | "goteo" | "cinta";

export type RiegoIn = {
  areaHa: number;
  ETo: number;
  Kc: number;
  Pe: number;
  Ef: number;
  horas: number;
  metodo: RiegoMetodo;
  qEmisor: number;
  Ne: number;
  Llat: number;
  C: number;
  ETo12: number[];
  Pe12: number[];
  mesDiseno: number;
  cultivo: string;
  CC: number;
  PMP: number;
  Zr: number;
  MAD: number;
  Lf: number;
};

const ETO_COSTA = [4.8, 5.0, 5.2, 4.6, 3.8, 3.2, 3.0, 3.2, 3.6, 4.0, 4.4, 4.6];
const PE_COSTA = [0.1, 0.1, 0.2, 0.3, 0.4, 0.6, 0.8, 0.6, 0.3, 0.2, 0.1, 0.1];

export function calcularRiego(inp: RiegoIn) {
  const mes = clamp(Math.round(inp.mesDiseno || 1), 1, 12);
  const ETo12 = (inp.ETo12?.length === 12 ? inp.ETo12 : ETO_COSTA).map((v) => Math.max(v, 0));
  const Pe12 = (inp.Pe12?.length === 12 ? inp.Pe12 : PE_COSTA).map((v) => Math.max(v, 0));
  const ETo = ETo12[mes - 1] || inp.ETo;
  const Pe = Pe12[mes - 1] ?? inp.Pe;
  const ETc = inp.Kc * ETo;
  const DnMm = Math.max(ETc - Pe, 0);
  const TAW = Math.max((inp.CC - inp.PMP) / 100, 0) * Math.max(inp.Zr, 0.1) * 1000;
  const RAW = clamp(inp.MAD || 0.5, 0.2, 0.8) * TAW;
  const freq = ETc > 0 ? RAW / ETc : 0;
  const Lf = clamp(inp.Lf || 0, 0, 0.25);
  const DnM3 = (DnMm / 1000) * inp.areaHa * 10000;
  const Ef = clamp(inp.Ef, 0.25, 0.95);
  const DbM3 = DnM3 / (Ef * (1 - Lf));
  const Qcont = DbM3 / 86400;
  const Qriego = inp.horas > 0 ? DbM3 / (inp.horas * 3600) : Qcont;
  const qLat = Math.max(inp.qEmisor, 0) * Math.max(inp.Ne, 1);
  const Qlat = qLat / 1000;
  const hfAdm = Math.max(0.2, 0.01 * Math.max(inp.Llat, 1));
  const D_m = Qlat > 0
    ? ((10.67 * inp.Llat * Qlat ** 1.852) / (Math.max(inp.C, 80) ** 1.852 * hfAdm)) ** (1 / 4.87)
    : 0.016;
  const Dmm = Math.max(D_m * 1000, 16);
  const Dpulg = Dmm / 25.4;
  return {
    ...inp,
    ETo,
    Pe,
    ETo12,
    Pe12,
    mes,
    ETc,
    DnMm,
    TAW,
    RAW,
    freq,
    DnM3,
    DbM3,
    Qcont,
    Qriego,
    qLat,
    hfAdm,
    Dmm,
    Dpulg,
    RaRef: RA_LAT12,
  };
}

export type OrificioRegimen = "libre" | "sumergido";

export type OrificioIn = {
  regimen: OrificioRegimen;
  forma: "circular" | "rectangular";
  Cd: number;
  D: number;
  b: number;
  h: number;
  H: number;
  H2: number;
  nOrif: number;
  Kreja: number;
  Vaprox: number;
  apertura: number;
};

export function calcularOrificio(inp: OrificioIn) {
  const ap = clamp(inp.apertura || 1, 0.05, 1);
  const A1 = inp.forma === "circular" ? (Math.PI * inp.D * inp.D) / 4 : inp.b * inp.h;
  const A = A1 * ap;
  const nOrif = Math.max(1, Math.round(inp.nOrif || 1));
  const dHbruto = inp.regimen === "sumergido" ? Math.max(inp.H - inp.H2, 0.01) : Math.max(inp.H, 0.01);
  const hReja = inp.Kreja * (inp.Vaprox || 0) ** 2 / (2 * G);
  const dH = Math.max(dHbruto - hReja, 0.01);
  const Vteo = Math.sqrt(2 * G * dH);
  const V = inp.Cd * Vteo;
  const Q1 = inp.Cd * A * Vteo;
  const Q = Q1 * nOrif;
  const Re = (V * (inp.forma === "circular" ? inp.D : (2 * inp.b * inp.h) / Math.max(inp.b + inp.h, 1e-6))) / NU;
  return { ...inp, A, A1, nOrif, ap, dHbruto, hReja, dH, Vteo, V, Q1, Q, Re, Cv: 0.98, Cc: inp.Cd / 0.98 };
}

export const SEMILLA_DES: DesarenadorIn = {
  Q: 0.22, dMm: 0.25, Gs: 2.65, H: 1.0, Vh: 0.22, alfa: 1.7, CdVert: 0.62, hVert: 0.12, Sfondo: 0.025, nLavado: 0.016,
  T: 18, nCeldas: 2, Qbypass: 0.22, Ltrans: 3.5,
};
export const SEMILLA_BOC: BocatomaIn = {
  Q: 0.45, Qmax: 8, Hest: 0.55, Y1: 0.4, kBarrote: 0.85, eBarrote: 0.012, eLuz: 0.04, CdOrif: 0.6, Co: 1842.15, ho: 0.5, hs: 0.2, Srio: 0.012, Ymax: 1.4, Lbarraje: 18, Ccreager: 2.16,
  d50: 8, Kreja: 0.8,
};
export const SEMILLA_RAP: RapidaIn = {
  tipo: "rapida", Q: 2.3, b: 1.2, nRap: 0.013, Srap: 0.075, nCanal: 0.025, Scanal: 0.0008, bCanal: 1.8, zCanal: 1, Hdesnivel: 8.5, hEscalon: 0.4, lEscalon: 0.5,
  TW: 0.85, eLosa: 0.20,
};
export const SEMILLA_ALI: AliviaderoIn = {
  Q: 4, Qmax: 15, Q2: 6, n: 0.014, z: 1, S: 0.001, b: 2.4, p: 1, muF: 0.95, muW: 0.62, BL: 0.54,
};
export const SEMILLA_ACU: AcueductoIn = {
  Q: 0.18, n: 0.011, S: 0.004, tipo: "tubo", b: 0.6, z: 0, DintMm: 280, DextMm: 315, L: 28, pesoTubo: 42, longTramo: 6, fy: 4200, qViento: 80, colgante: true,
  Csismo: 0.18, flecha: 0.14,
};
export const SEMILLA_RIE: RiegoIn = {
  areaHa: 12, ETo: 4.2, Kc: 0.95, Pe: 0.8, Ef: 0.7, horas: 8, metodo: "aspersión", qEmisor: 0.42, Ne: 18, Llat: 48, C: 140,
  ETo12: [4.8, 5.0, 5.2, 4.6, 3.8, 3.2, 3.0, 3.2, 3.6, 4.0, 4.4, 4.6],
  Pe12: [0.1, 0.1, 0.2, 0.3, 0.4, 0.6, 0.8, 0.6, 0.3, 0.2, 0.1, 0.1],
  mesDiseno: 1, cultivo: "Maíz / grano", CC: 28, PMP: 14, Zr: 0.6, MAD: 0.5, Lf: 0.10,
};
export const SEMILLA_ORI: OrificioIn = {
  regimen: "libre", forma: "circular", Cd: 0.61, D: 0.15, b: 0.3, h: 0.2, H: 1.2, H2: 0.4,
  nOrif: 1, Kreja: 0.8, Vaprox: 0.4, apertura: 1,
};

export type PackResult =
  | ReturnType<typeof calcularDesarenador>
  | ReturnType<typeof calcularBocatoma>
  | ReturnType<typeof calcularRapida>
  | ReturnType<typeof calcularAliviadero>
  | ReturnType<typeof calcularAcueducto>
  | ReturnType<typeof calcularRiego>
  | ReturnType<typeof calcularOrificio>;
