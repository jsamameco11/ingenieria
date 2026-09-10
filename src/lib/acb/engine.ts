import {
  INTERVENCION,
  VEH,
  type VehKey,
  lookupCov,
} from "./data";

export type Conteo = Record<VehKey, number[]>;

export type Partidas = {
  prelim: number;
  tierras: number;
  pavimentos: number;
  arte: number;
  senal: number;
  transporte: number;
  ambiental: number;
};

export type AltDesign = {
  nombre: string;
  tramo: string;
  superficie: string;
  ancho: number;
  berma: number;
  vel: number;
  radio: number;
  peralte: number;
  pendiente: number;
  bombeo: number;
  plazoletas: string;
  taludes: string;
  senalUnid: number;
  pontones: string;
  badenes: string;
  muros: string;
  alcantarillas: string;
  seccionAlc: string;
  tajeas: string;
  seccionTaj: string;
  cunetas: string;
  seccionCun: string;
  canaleta: string;
  seccionCan: string;
  campamento: string;
  patio: string;
  botaderos: string;
};

export type AcbInput = {
  proyecto: string;
  depto: string;
  provincia: string;
  distrito: string;
  zona: string;
  horizonte: number;
  mes: number;
  peajeLig: string;
  peajePes: string;
  fcLig: number;
  fcPes: number;
  rvp: number;
  rvc: number;
  intervencion: string;
  pctGenerado: number;
  conteo: Conteo;
  superficie: string;
  tipologia: string;
  longitud: number;
  materialSup: string;
  anchoActual: number;
  estadoSin: string;
  estadoCon: string;
  tipoDano: string;
  pendienteActual: number;
  bombeoActual: string;
  canteras: string;
  plazoletasN: string;
  senalizacion: string;
  puentes: string;
  estPuentes: string;
  pontones: string;
  estPontones: string;
  badenes: string;
  estBadenes: string;
  muros: string;
  estMuros: string;
  alcantarillas: string;
  estAlc: string;
  tajeas: string;
  estTajeas: string;
  cunetas: string;
  estCunetas: string;
  canaleta: string;
  botaderos: string;
  localidad: string;
  alt1: AltDesign;
  alt2: AltDesign;
  part1: Partidas;
  part2: Partidas;
  gg: number;
  util: number;
  igv: number;
  superv: number;
  estudio: number;
  rutSin: number;
  perSin: number;
  rutCon: number;
  perCon: number;
  fcInv: number;
  fcOm: number;
  tc: number;
  tasa: number;
  residual: number;
};

const emptyWeek = (): number[] => [0, 0, 0, 0, 0, 0, 0];

export const ACB_DEFAULTS: AcbInput = {
  proyecto: "Mejoramiento del Camino Vecinal Huascapampa - Allpamarca - Tayagasca",
  depto: "Huánuco",
  provincia: "Pachitea",
  distrito: "Panao",
  zona: "Sierra",
  horizonte: 10,
  mes: 7,
  peajeLig: "P003",
  peajePes: "P019",
  fcLig: 0.9799078492,
  fcPes: 0.9748968965,
  rvp: 1.6,
  rvc: 0.6,
  intervencion: "mejoramiento",
  pctGenerado: 15,
  conteo: {
    auto: [32, 32, 32, 33, 33, 34, 34],
    camioneta: [20, 20, 20, 20, 22, 22, 22],
    cr: [10, 11, 11, 12, 12, 13, 13],
    micro: [7, 7, 7, 7, 8, 8, 9],
    bus: [5, 5, 5, 5, 7, 7, 8],
    c2e: [3, 3, 3, 3, 4, 4, 4],
    c3e: [1, 1, 1, 2, 2, 2, 2],
  },
  superficie: "AFI",
  tipologia: "A",
  longitud: 27,
  materialSup: "Tierra - afirmado",
  anchoActual: 3.6,
  estadoSin: "M",
  estadoCon: "B",
  tipoDano: "Encalaminado",
  pendienteActual: 8,
  bombeoActual: "No",
  canteras: "01",
  plazoletasN: "02",
  senalizacion: "No",
  puentes: "-",
  estPuentes: "-",
  pontones: "02-(8m)",
  estPontones: "Malo",
  badenes: "02",
  estBadenes: "Regular",
  muros: "04",
  estMuros: "Malo",
  alcantarillas: "05",
  estAlc: "Regular",
  tajeas: "04",
  estTajeas: "Malo",
  cunetas: "sí",
  estCunetas: "sin mantenimiento",
  canaleta: "No",
  botaderos: "Sí",
  localidad: "LOCALIDAD A - LOCALIDAD B",
  alt1: {
    nombre: "Afirmado granular",
    tramo: "TRAMO I. e=20 cm",
    superficie: "Afirmado e = 0.20 m",
    ancho: 4,
    berma: 0.6,
    vel: 40,
    radio: 50,
    peralte: 8,
    pendiente: 9,
    bombeo: 3,
    plazoletas: "c/500 m (mín.)",
    taludes: "H 1 : V 3",
    senalUnid: 16,
    pontones: "Madera",
    badenes: "C° f'c = 175 kg/cm²",
    muros: "Mampostería de piedra",
    alcantarillas: "Losa C° f'c = 175 kg/cm²",
    seccionAlc: "Rectangular / 0.40 × 0.60",
    tajeas: "Madera",
    seccionTaj: "Rectangular / 0.40 × 0.40",
    cunetas: "Tierra",
    seccionCun: "Triangular / 0.30 × 0.60",
    canaleta: "Tierra",
    seccionCan: "Rectangular / 0.40 × 0.40",
    campamento: "Sí",
    patio: "Sí",
    botaderos: "Sí",
  },
  alt2: {
    nombre: "Afirmado estabilizado",
    tramo: "TRAMO I. e=20 cm",
    superficie: "Afirmado estabilizado e = 0.20 m",
    ancho: 4,
    berma: 0.6,
    vel: 40,
    radio: 50,
    peralte: 8,
    pendiente: 9,
    bombeo: 3,
    plazoletas: "c/500 m (mín.)",
    taludes: "H 1 : V 3",
    senalUnid: 16,
    pontones: "Madera",
    badenes: "C° f'c = 175 kg/cm²",
    muros: "Mampostería de piedra",
    alcantarillas: "Losa C° f'c = 175 kg/cm²",
    seccionAlc: "Rectangular / 0.40 × 0.60",
    tajeas: "Madera",
    seccionTaj: "Rectangular / 0.40 × 0.40",
    cunetas: "Tierra",
    seccionCun: "Triangular / 0.30 × 0.60",
    canaleta: "Tierra",
    seccionCan: "Rectangular / 0.40 × 0.40",
    campamento: "Sí",
    patio: "Sí",
    botaderos: "Sí",
  },
  part1: {
    prelim: 57567.5,
    tierras: 1250652.19,
    pavimentos: 700303.28,
    arte: 200959.48,
    senal: 8689.24,
    transporte: 72890,
    ambiental: 87574.31,
  },
  part2: {
    prelim: 50567.5,
    tierras: 1266652.19,
    pavimentos: 721303.28,
    arte: 241959.48,
    senal: 8689.24,
    transporte: 72890,
    ambiental: 87574.31,
  },
  gg: 0.1,
  util: 0.05,
  igv: 0.18,
  superv: 0.05,
  estudio: 0.06,
  rutSin: 1144.06,
  perSin: 1724.98,
  rutCon: 2288.12,
  perCon: 3449.96,
  fcInv: 0.79,
  fcOm: 0.75,
  tc: 2.87,
  tasa: 0.1,
  residual: 0.1,
};

export function cloneDefaults(): AcbInput {
  return structuredClone(ACB_DEFAULTS);
}

export function emptyConteo(): Conteo {
  return {
    auto: emptyWeek(),
    camioneta: emptyWeek(),
    cr: emptyWeek(),
    micro: emptyWeek(),
    bus: emptyWeek(),
    c2e: emptyWeek(),
    c3e: emptyWeek(),
  };
}

function sum(a: number[]) {
  return a.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);
}

function round0(n: number) {
  return Math.round(n);
}

export function npv(rate: number, flows: number[]) {
  return flows.reduce((s, cf, t) => s + cf / Math.pow(1 + rate, t), 0);
}

export function irr(flows: number[]) {
  let r = 0.1;
  for (let i = 0; i < 80; i++) {
    let f = 0;
    let df = 0;
    for (let t = 0; t < flows.length; t++) {
      const d = Math.pow(1 + r, t);
      f += flows[t] / d;
      if (t > 0) df -= (t * flows[t]) / Math.pow(1 + r, t + 1);
    }
    if (Math.abs(df) < 1e-18) break;
    const next = r - f / df;
    if (!Number.isFinite(next) || next <= -0.99) {
      r = 0.12;
      continue;
    }
    if (Math.abs(next - r) < 1e-12) return next;
    r = next;
  }
  return r;
}

export type PresupuestoAlt = {
  cd: number;
  gg: number;
  util: number;
  sub: number;
  igv: number;
  obra: number;
  superv: number;
  estudio: number;
  inversion: number;
  usd: number;
  usdKm: number;
  social: number;
};

function presupuesto(p: Partidas, inp: AcbInput): PresupuestoAlt {
  const cd = p.prelim + p.tierras + p.pavimentos + p.arte + p.senal + p.transporte + p.ambiental;
  const gg = cd * inp.gg;
  const util = cd * inp.util;
  const sub = cd + gg + util;
  const igv = sub * inp.igv;
  const obra = sub + igv;
  const superv = cd * inp.superv;
  const estudio = cd * inp.estudio;
  const inversion = obra + superv + estudio;
  const usd = inversion / Math.max(inp.tc, 1e-9);
  const usdKm = usd / Math.max(inp.longitud, 1e-9);
  const social = inversion * inp.fcInv;
  return { cd, gg, util, sub, igv, obra, superv, estudio, inversion, usd, usdKm, social };
}

function mantAnual(year: number, rut: number, per: number, L: number, tc: number, kind: "sin" | "con") {
  const op = 1.1;
  const perYears = kind === "sin" ? [1, 4, 7, 10] : [3, 6, 9];
  const rate = perYears.includes(year) ? per : rut;
  return rate * op * L * tc;
}

export type EvalAlt = {
  inversion: number;
  residual: number;
  om: number[];
  omInc: number[];
  ben: number[];
  flujo: number[];
  van: number;
  tir: number;
  bc: number;
  vpBen: number;
  vpCos: number;
};

export type AcbResult = {
  semana: Record<VehKey, number[]>;
  totalDia: number[];
  totalSemana: Record<VehKey, number>;
  imds: Record<VehKey, number>;
  fc: Record<VehKey, number>;
  imda: Record<VehKey, number>;
  imdaTotal: number;
  dist: Record<VehKey, number>;
  sin: Record<VehKey, number[]>;
  gen: Record<VehKey, number[]>;
  con: Record<VehKey, number[]>;
  sinTot: number[];
  genTot: number[];
  conTot: number[];
  covSin: number[];
  covCon: number[];
  covUsd: { sin: number[]; con: number[] };
  covSolesSin: Record<VehKey, number[]>;
  covSolesConN: Record<VehKey, number[]>;
  covSolesConG: Record<VehKey, number[]>;
  covSinTot: number[];
  covConNTot: number[];
  covConGTot: number[];
  benInc: number[];
  pres1: PresupuestoAlt;
  pres2: PresupuestoAlt;
  omSinM: number[];
  om1M: number[];
  om2M: number[];
  omSinS: number[];
  om1S: number[];
  om2S: number[];
  eval1: EvalAlt;
  eval2: EvalAlt;
  H: number;
  L: number;
  mejor: 1 | 2;
};

function zerosH(H: number) {
  return Array.from({ length: H + 1 }, () => 0);
}
function zerosVehH(H: number): Record<VehKey, number[]> {
  return Object.fromEntries(VEH.map((v) => [v.key, zerosH(H)])) as Record<VehKey, number[]>;
}

export function calcAcb(inp: AcbInput): AcbResult {
  const H = Math.max(1, Math.min(20, Math.round(inp.horizonte) || 10));
  const L = Math.max(0.1, inp.longitud);
  const pct = INTERVENCION.find((x) => x.value === inp.intervencion)?.pct ?? inp.pctGenerado;

  const semana = {} as Record<VehKey, number[]>;
  const totalSemana = {} as Record<VehKey, number>;
  const imds = {} as Record<VehKey, number>;
  const fc = {} as Record<VehKey, number>;
  const imda = {} as Record<VehKey, number>;
  const dist = {} as Record<VehKey, number>;

  const totalDia = [0, 0, 0, 0, 0, 0, 0];
  for (const v of VEH) {
    const days = (inp.conteo[v.key] ?? emptyWeek()).map((n) => Math.max(0, n));
    semana[v.key] = days;
    totalSemana[v.key] = sum(days);
    imds[v.key] = totalSemana[v.key] / 7;
    fc[v.key] = v.ligero ? inp.fcLig : inp.fcPes;
    imda[v.key] = round0(imds[v.key] * fc[v.key]);
    days.forEach((n, i) => {
      totalDia[i] += n;
    });
  }
  const imdaTotal = VEH.reduce((s, v) => s + imda[v.key], 0);
  for (const v of VEH) dist[v.key] = imdaTotal > 0 ? (imda[v.key] / imdaTotal) * 100 : 0;

  const rvp = inp.rvp / 100;
  const rvc = inp.rvc / 100;
  const sin = zerosVehH(H);
  const gen = zerosVehH(H);
  const con = zerosVehH(H);
  const sinTot = zerosH(H);
  const genTot = zerosH(H);
  const conTot = zerosH(H);

  for (const v of VEH) {
    const r = v.pasajero ? rvp : rvc;
    for (let n = 0; n <= H; n++) {
      const tn = round0(imda[v.key] * Math.pow(1 + r, n));
      sin[v.key][n] = tn;
      const g = n === 0 ? 0 : round0(tn * (pct / 100));
      gen[v.key][n] = g;
      con[v.key][n] = tn + g;
      sinTot[n] += tn;
      genTot[n] += g;
      conTot[n] += tn + g;
    }
  }

  const covSinTab = lookupCov(inp.zona, inp.tipologia, inp.superficie, inp.estadoSin) ?? [0, 0, 0, 0, 0, 0, 0];
  const covConTab = lookupCov(inp.zona, inp.tipologia, inp.superficie, inp.estadoCon) ?? [0, 0, 0, 0, 0, 0, 0];
  const covUsd = { sin: covSinTab, con: covConTab };

  const covSolesSin = zerosVehH(H);
  const covSolesConN = zerosVehH(H);
  const covSolesConG = zerosVehH(H);
  const covSinTot = zerosH(H);
  const covConNTot = zerosH(H);
  const covConGTot = zerosH(H);
  const benInc = zerosH(H);

  const k = 365 * L * inp.tc;
  for (const v of VEH) {
    const us = covUsd.sin[v.cov] ?? 0;
    const uc = covUsd.con[v.cov] ?? 0;
    for (let n = 1; n <= H; n++) {
      const s = sin[v.key][n] * k * us;
      const cn = sin[v.key][n] * k * uc;
      const cg = gen[v.key][n] * k * uc;
      covSolesSin[v.key][n] = s;
      covSolesConN[v.key][n] = cn;
      covSolesConG[v.key][n] = cg;
      covSinTot[n] += s;
      covConNTot[n] += cn;
      covConGTot[n] += cg;
    }
  }
  for (let n = 1; n <= H; n++) {
    benInc[n] = covSinTot[n] - covConNTot[n] + 0.5 * covConGTot[n];
  }

  const pres1 = presupuesto(inp.part1, inp);
  const pres2 = presupuesto(inp.part2, inp);

  const omSinM = zerosH(H);
  const om1M = zerosH(H);
  const om2M = zerosH(H);
  for (let n = 1; n <= H; n++) {
    omSinM[n] = mantAnual(n, inp.rutSin, inp.perSin, L, inp.tc, "sin");
    om1M[n] = mantAnual(n, inp.rutCon, inp.perCon, L, inp.tc, "con");
    om2M[n] = om1M[n];
  }
  const omSinS = omSinM.map((x) => x * inp.fcOm);
  const om1S = om1M.map((x) => x * inp.fcOm);
  const om2S = om2M.map((x) => x * inp.fcOm);

  const evalOf = (pres: PresupuestoAlt, omS: number[]): EvalAlt => {
    const inversion = pres.social;
    const residual = inversion * inp.residual;
    const om = zerosH(H);
    const omInc = zerosH(H);
    const ben = zerosH(H);
    const flujo = zerosH(H);
    for (let n = 1; n <= H; n++) {
      om[n] = omS[n];
      omInc[n] = omS[n] - omSinS[n];
      ben[n] = benInc[n];
    }
    flujo[0] = -inversion;
    for (let n = 1; n <= H; n++) {
      const recupero = n === H ? residual : 0;
      flujo[n] = recupero - omInc[n] + ben[n];
    }
    const van = npv(inp.tasa, flujo);
    const tirV = irr(flujo);
    const benFlow = flujo.map((_, t) => (t === 0 ? 0 : ben[t]));
    const cosFlow = flujo.map((_, t) => {
      if (t === 0) return inversion;
      if (t === H) return omInc[t] - residual;
      return omInc[t];
    });
    const vpBen = npv(inp.tasa, benFlow);
    const vpCos = npv(inp.tasa, cosFlow);
    const bc = vpCos > 0 ? vpBen / vpCos : 0;
    return { inversion, residual, om, omInc, ben, flujo, van, tir: tirV, bc, vpBen, vpCos };
  };

  const eval1 = evalOf(pres1, om1S);
  const eval2 = evalOf(pres2, om2S);
  const mejor: 1 | 2 = eval1.van >= eval2.van ? 1 : 2;

  return {
    semana,
    totalDia,
    totalSemana,
    imds,
    fc,
    imda,
    imdaTotal,
    dist,
    sin,
    gen,
    con,
    sinTot,
    genTot,
    conTot,
    covSin: covUsd.sin,
    covCon: covUsd.con,
    covUsd,
    covSolesSin,
    covSolesConN,
    covSolesConG,
    covSinTot,
    covConNTot,
    covConGTot,
    benInc,
    pres1,
    pres2,
    omSinM,
    om1M,
    om2M,
    omSinS,
    om1S,
    om2S,
    eval1,
    eval2,
    H,
    L,
    mejor,
  };
}

export function money(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function pct(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
}

export function n1(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
}
