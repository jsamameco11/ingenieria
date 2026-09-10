import { G, clamp, round } from "../num";

export type PotableKind =
  | "dotacion"
  | "sistema"
  | "sedimentador"
  | "prefiltro"
  | "filtro-lento"
  | "impulsion"
  | "reservorio"
  | "cloracion";

export type Region = "costa" | "sierra" | "selva";
export type Crecimiento = "aritmetico" | "geometrico";
export type MaterialTubo = "pvc" | "pe" | "prfv" | "ac" | "hd" | "fe" | "conc" | "fg";

export const DOTACION_RURAL: Record<Region, { sin: number; con: number }> = {
  costa: { sin: 60, con: 90 },
  sierra: { sin: 50, con: 80 },
  selva: { sin: 70, con: 100 },
};

/** Coeficiente C de Hazen–Williams (tubería nueva, valores de diseño habituales). */
export const C_HAZEN: Record<MaterialTubo, number> = {
  pvc: 150,
  pe: 140,
  prfv: 140,
  ac: 140,
  hd: 130,
  fe: 120,
  conc: 120,
  fg: 100,
};

export const MAT_LABEL: Record<MaterialTubo, string> = {
  pvc: "PVC · C 150",
  pe: "PEAD · C 140",
  prfv: "PRFV · C 140",
  ac: "Asbesto-cemento · C 140",
  hd: "Hierro dúctil · C 130",
  fe: "Acero · C 120",
  conc: "Concreto · C 120",
  fg: "F°G° usado · C 100",
};

export const MATERIALES_TUBO: MaterialTubo[] = ["pvc", "pe", "prfv", "ac", "hd", "fe", "conc", "fg"];

export function cHazenDe(mat: MaterialTubo) {
  return C_HAZEN[mat] ?? 150;
}

export const PULG_COMERCIAL = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 6, 8, 10, 12];

/** Diámetro interno F°G° Serie I (ISO 65), m. */
export const FG_INTERNO: Record<string, number> = {
  "1": 0.0279,
  "1.5": 0.0425,
  "2": 0.0539,
  "2.5": 0.0666,
  "3": 0.0817,
  "4": 0.1063,
};

export const VOL_TIPO = [5, 8, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 250, 300, 400, 500];

function fin(n: number, fb = 0) {
  return Number.isFinite(n) ? n : fb;
}

export function pulgAm(p: number) {
  return p * 0.0254;
}

export function comercialPulg(DreqM: number) {
  return PULG_COMERCIAL.find((p) => pulgAm(p) >= DreqM - 1e-9) ?? 12;
}

export function redondearVolumen(v: number) {
  const x = Math.max(0, v);
  return VOL_TIPO.find((t) => t >= x - 1e-9) ?? Math.ceil(x / 10) * 10;
}

export function fgInterno(pulg: number) {
  const keys = Object.keys(FG_INTERNO).map(Number).sort((a, b) => a - b);
  const k = keys.find((p) => p >= pulg - 1e-9) ?? keys[keys.length - 1];
  return FG_INTERNO[String(k)] ?? pulgAm(pulg);
}

/** Hazen–Williams SI: Q m³/s, D m → Sf m/m (fórmula del Excel de impulsión). */
export function hazenSf(Q: number, D: number, C: number) {
  const q = Math.max(Q, 0);
  const d = Math.max(D, 1e-6);
  const c = Math.max(C, 1);
  const den = 0.2785 * c * Math.pow(d, 2.63);
  if (den <= 0) return 0;
  return Math.pow(q / den, 1 / 0.54);
}

export function hazenD(Q: number, S: number, C: number) {
  const q = Math.max(Q, 0);
  const s = Math.max(S, 1e-9);
  const c = Math.max(C, 1);
  const den = 0.2785 * c * Math.pow(s, 0.54);
  if (den <= 0) return 0;
  return Math.pow(q / den, 1 / 2.63);
}

export function areaCirc(D: number) {
  return (Math.PI * D * D) / 4;
}

export function velQ(Q: number, D: number) {
  const A = areaCirc(D);
  return A > 0 ? Q / A : 0;
}

export function poblacionFutura(Po: number, rPct: number, t: number, tipo: Crecimiento) {
  const po = Math.max(Po, 0);
  const r = rPct / 100;
  const n = Math.max(t, 0);
  return tipo === "geometrico" ? po * Math.pow(1 + r, n) : po * (1 + r * n);
}

export function caudales(Pf: number, dot: number, K1: number, K2: number) {
  const Qp = (Math.max(Pf, 0) * Math.max(dot, 0)) / 86400;
  const Qmd = K1 * Qp;
  const Qmh = K2 * Qp;
  return { Qp, Qmd, Qmh };
}

export function volRegulacion(QpLs: number, frac = 0.25) {
  return Math.max(QpLs, 0) * 86.4 * frac;
}

export type DotacionInput = {
  modo: "urbano" | "rural";
  nLotesPeq: number;
  nLotesGrand: number;
  Dp: number;
  dotPeq: number;
  dotGrand: number;
  Av: number;
  Ae: number;
  dotV: number;
  dotE: number;
  cRet: number;
  K1: number;
  K2: number;
  Vi: number;
  fracReg: number;
  Po: number;
  r: number;
  t: number;
  crecimiento: Crecimiento;
  region: Region;
  arrastre: boolean;
  perdidas: number;
  Ep: number;
  Es: number;
  Dep: number;
  Des: number;
};

export function calcularDotacion(inp: DotacionInput) {
  const K1 = fin(inp.K1, 1.3);
  const K2 = fin(inp.K2, 1.8);
  const cRet = clamp(fin(inp.cRet, 0.8), 0, 1);
  const fracReg = clamp(fin(inp.fracReg, 0.25), 0, 1);
  const perd = clamp(fin(inp.perdidas, 0), 0, 0.5);

  if (inp.modo === "urbano") {
    const nPeq = Math.max(0, fin(inp.nLotesPeq));
    const nGrand = Math.max(0, fin(inp.nLotesGrand));
    const nTot = nPeq + nGrand;
    const Dp = Math.max(0, fin(inp.Dp, 5));
    const PfPeq = Dp * nPeq;
    const PfGrand = Dp * nGrand;
    const Pf = PfPeq + PfGrand;
    const QvivPeq = (PfPeq * fin(inp.dotPeq, 150)) / 86400;
    const QvivGrand = (PfGrand * fin(inp.dotGrand, 220)) / 86400;
    const Qv = (fin(inp.Av) * fin(inp.dotV, 2)) / 86400;
    const Qe = (fin(inp.Ae) * fin(inp.dotE, 6)) / 86400;
    const Qp = QvivPeq + QvivGrand + Qv + Qe;
    const Qmd = K1 * Qp;
    const Qmh = K2 * Qp;
    const Vreg = volRegulacion(Qp, fracReg);
    const Vr = Vreg / 3;
    const Vi = Math.max(0, fin(inp.Vi));
    const Vt = Vreg + Vi + Vr;
    const Vadop = redondearVolumen(Vt);
    const Qal = cRet * Qp;
    const QalMh = cRet * Qmh;
    return {
      nTot, PfPeq, PfGrand, Pf, QvivPeq, QvivGrand, Qv, Qe,
      Qp, Qmd, Qmh, Vreg, Vr, Vi, Vt, Vadop, Qal, QalMh, cRet, K1, K2, fracReg,
      dotEq: Pf > 0 ? (Qp * 86400) / Pf : 0,
    };
  }

  const tabla = DOTACION_RURAL[inp.region] ?? DOTACION_RURAL.sierra;
  const dotHab = inp.arrastre ? tabla.con : tabla.sin;
  const Pf = poblacionFutura(fin(inp.Po, 200), fin(inp.r, 2), fin(inp.t, 20), inp.crecimiento);
  const Qhab = (Pf * dotHab) / 86400;
  const Qedu = (fin(inp.Ep) * fin(inp.Dep, 20) + fin(inp.Es) * fin(inp.Des, 25)) / 86400;
  const Qneto = Qhab + Qedu;
  const Qp = perd < 0.99 ? Qneto / (1 - perd) : Qneto;
  const Qmd = K1 * Qp;
  const Qmh = K2 * Qp;
  const Vreg = volRegulacion(Qp, fracReg);
  const Vr = 0;
  const Vi = Math.max(0, fin(inp.Vi));
  const Vt = Vreg + Vi + Vr;
  const Vadop = redondearVolumen(Vt);
  const Qal = cRet * Qp;
  const QalMh = cRet * Qmh;
  return {
    nTot: 0, PfPeq: 0, PfGrand: 0, Pf, QvivPeq: Qhab, QvivGrand: 0, Qv: 0, Qe: Qedu,
    Qp, Qmd, Qmh, Vreg, Vr, Vi, Vt, Vadop, Qal, QalMh, cRet, K1, K2, fracReg,
    dotEq: Pf > 0 ? (Qp * 86400) / Pf : dotHab,
    dotHab,
  };
}

export type NudoTipo =
  | "captacion"
  | "intermedio"
  | "ventosa"
  | "purga"
  | "valvula"
  | "camara"
  | "reservorio";

export type AccesorioTipo =
  | "reja"
  | "entrada"
  | "valvula_compuerta"
  | "valvula_mariposa"
  | "valvula_check"
  | "codo90"
  | "codo45"
  | "te"
  | "reduccion"
  | "ampliacion"
  | "ventosa"
  | "purga"
  | "salida_tanque";

export type CaptacionTipo = "manantial" | "bocatoma" | "galeria";

export const NUDO_LABEL: Record<NudoTipo, string> = {
  captacion: "Captación",
  intermedio: "Vértice / nudo",
  ventosa: "Ventosa",
  purga: "Purga",
  valvula: "Cámara de válvulas",
  camara: "Cámara rompe-carga",
  reservorio: "Reservorio",
};

export const CAPTACION_LABEL: Record<CaptacionTipo, string> = {
  manantial: "Cámara de manantial",
  bocatoma: "Bocatoma de río / quebrada",
  galeria: "Galería filtrante",
};

export const ACCESORIO_CATALOG: Record<AccesorioTipo, { k: number; label: string }> = {
  reja: { k: 1.5, label: "Reja de captación" },
  entrada: { k: 0.5, label: "Entrada de tubería (boca)" },
  valvula_compuerta: { k: 0.2, label: "Válvula de compuerta (abierta)" },
  valvula_mariposa: { k: 0.45, label: "Válvula mariposa (abierta)" },
  valvula_check: { k: 2.0, label: "Válvula check" },
  codo90: { k: 0.9, label: "Codo 90°" },
  codo45: { k: 0.4, label: "Codo 45°" },
  te: { k: 1.8, label: "Tee (paso lateral)" },
  reduccion: { k: 0.25, label: "Reducción gradual" },
  ampliacion: { k: 0.3, label: "Ampliación gradual" },
  ventosa: { k: 0.5, label: "Ventosa (paso)" },
  purga: { k: 0.4, label: "Purga (derivación)" },
  salida_tanque: { k: 1.0, label: "Salida / ingreso al reservorio" },
};

export const ACCESORIO_TIPOS = Object.keys(ACCESORIO_CATALOG) as AccesorioTipo[];
export const NUDO_TIPOS = Object.keys(NUDO_LABEL) as NudoTipo[];

export type NudoConduccionIn = {
  id: string;
  codigo: string;
  tipo: NudoTipo;
  pk: number;
  z: number;
};

export type TramoConduccionIn = {
  id: string;
  de: string;
  a: string;
  L: number;
  Dpulg: number;
  material: MaterialTubo;
};

export type AccesorioConduccionIn = {
  id: string;
  nudoId: string;
  tipo: AccesorioTipo;
  n: number;
  K: number;
};

export type SistemaInput = {
  Po: number;
  r: number;
  t: number;
  crecimiento: Crecimiento;
  dot: number;
  K1: number;
  K2: number;
  perdidas: number;
  Qf: number;
  bombeo: boolean;
  horasBombeo: number;
  Hcil: number;
  captacionTipo: CaptacionTipo;
  zCaptNAA: number;
  recubrimiento: number;
  material: MaterialTubo;
  nudos: NudoConduccionIn[];
  tramos: TramoConduccionIn[];
  accesorios: AccesorioConduccionIn[];
};

export type PerfilConduccion = {
  id: string;
  codigo: string;
  tipo: NudoTipo;
  pk: number;
  zTerreno: number;
  zTubo: number;
  hgl: number;
  presion: number;
  Kloc: number;
  Hfacc: number;
};

export type TramoConduccionOut = {
  id: string;
  codigo: string;
  de: string;
  a: string;
  deCod: string;
  aCod: string;
  L: number;
  material: MaterialTubo;
  C: number;
  DcalcPulg: number;
  Dpulg: number;
  D: number;
  Dmm: number;
  V: number;
  Sf: number;
  Hf: number;
  okV: boolean;
};

export type AccesorioConduccionOut = {
  id: string;
  nudoId: string;
  nudoCod: string;
  tipo: AccesorioTipo;
  label: string;
  n: number;
  Kunit: number;
  Ktot: number;
  V: number;
  hVel: number;
  Hf: number;
  Leq: number;
};

export function semillaSistemaAbierto(material: MaterialTubo = "pvc"): {
  nudos: NudoConduccionIn[];
  tramos: TramoConduccionIn[];
  accesorios: AccesorioConduccionIn[];
} {
  const nudos: NudoConduccionIn[] = [
    { id: "n1", codigo: "N-01", tipo: "captacion", pk: 0, z: 545 },
    { id: "n2", codigo: "N-02", tipo: "ventosa", pk: 80, z: 538 },
    { id: "n3", codigo: "N-03", tipo: "valvula", pk: 175, z: 528 },
    { id: "n4", codigo: "N-04", tipo: "purga", pk: 260, z: 518 },
    { id: "n5", codigo: "N-05", tipo: "reservorio", pk: 350, z: 510 },
  ];
  return {
    nudos,
    tramos: syncTramosConduccion(nudos, [], material),
    accesorios: [
      { id: "a1", nudoId: "n1", tipo: "reja", n: 1, K: 0 },
      { id: "a2", nudoId: "n1", tipo: "entrada", n: 1, K: 0 },
      { id: "a3", nudoId: "n1", tipo: "valvula_compuerta", n: 1, K: 0 },
      { id: "a4", nudoId: "n2", tipo: "ventosa", n: 1, K: 0 },
      { id: "a5", nudoId: "n3", tipo: "valvula_compuerta", n: 1, K: 0 },
      { id: "a6", nudoId: "n3", tipo: "codo90", n: 2, K: 0 },
      { id: "a7", nudoId: "n4", tipo: "purga", n: 1, K: 0 },
      { id: "a8", nudoId: "n5", tipo: "salida_tanque", n: 1, K: 0 },
    ],
  };
}

export function syncTramosConduccion(
  nudos: NudoConduccionIn[],
  prev: TramoConduccionIn[],
  material: MaterialTubo,
): TramoConduccionIn[] {
  const sorted = [...nudos].sort((a, b) => a.pk - b.pk);
  const out: TramoConduccionIn[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const de = sorted[i];
    const a = sorted[i + 1];
    const found =
      prev.find((t) => t.de === de.id && t.a === a.id) ??
      prev.find((t) => t.de === a.id && t.a === de.id);
    out.push({
      id: found?.id ?? `t-${de.id}-${a.id}`,
      de: de.id,
      a: a.id,
      L: found?.L ?? 0,
      Dpulg: found?.Dpulg ?? 0,
      material: found?.material ?? material,
    });
  }
  return out;
}

function kAccesorio(tipo: AccesorioTipo, K: number) {
  const cat = ACCESORIO_CATALOG[tipo] ?? ACCESORIO_CATALOG.entrada;
  return K > 0 ? K : cat.k;
}

export function calcularSistema(inp: SistemaInput) {
  const Po = fin(inp.Po, 150);
  const r = fin(inp.r, 2);
  const t = fin(inp.t, 20);
  const Pf = poblacionFutura(Po, r, t, inp.crecimiento);
  const dot = fin(inp.dot, 80);
  const K1 = clamp(fin(inp.K1, 1.3), 1.2, 1.5);
  const K2 = clamp(fin(inp.K2, 2), 1.8, 2.5);
  const perd = clamp(fin(inp.perdidas, 0.25), 0, 0.45);
  const Qneto = (Pf * dot) / 86400;
  const Qp = perd < 0.99 ? Qneto / (1 - perd) : Qneto;
  const Qmd = K1 * Qp;
  const Qmh = K2 * Qp;
  const Qdia = Qmd * 86.4;
  const Qf = fin(inp.Qf, 1);
  const frac = inp.bombeo ? 0.3 : 0.25;
  const Vcalc = volRegulacion(Qmd, frac);
  const Vadop = redondearVolumen(Vcalc);
  const Hcil = Math.max(fin(inp.Hcil, 2.6), 0.8);
  const Rcil = Math.sqrt(Vadop / (Math.PI * Hcil));
  const Dcil = 2 * Rcil;
  const Aplanta = Math.PI * Rcil * Rcil;
  const perimetro = 2 * Math.PI * Rcil;
  const recubrimiento = clamp(fin(inp.recubrimiento, 1), 0.6, 2.5);
  const captacionTipo = inp.captacionTipo ?? "manantial";
  const Q = Qmd / 1000;
  const seed = semillaSistemaAbierto(inp.material);
  const nudosIn = (inp.nudos?.length ?? 0) >= 2 ? inp.nudos : seed.nudos;
  const sorted = [...nudosIn].sort((a, b) => a.pk - b.pk);
  const tramosIn = syncTramosConduccion(sorted, inp.tramos ?? [], inp.material);
  const accesoriosIn = inp.accesorios?.length ? inp.accesorios : seed.accesorios;

  const nudoById = new Map(sorted.map((n) => [n.id, n]));
  const tramosCalc: TramoConduccionOut[] = tramosIn.map((tr, i) => {
    const de = nudoById.get(tr.de) ?? sorted[i];
    const a = nudoById.get(tr.a) ?? sorted[i + 1];
    const L = Math.max(tr.L > 0 ? tr.L : Math.abs(a.pk - de.pk), 0.1);
    const mat = tr.material ?? inp.material;
    const C = C_HAZEN[mat] ?? 150;
    const Sgeom = Math.max((de.z - a.z) / L, 1e-6);
    const DcalcM = hazenD(Q, Sgeom, C);
    const DcalcPulg = DcalcM / 0.0254;
    const Dpulg = tr.Dpulg > 0 ? tr.Dpulg : comercialPulg(DcalcM);
    const D = pulgAm(Dpulg);
    const V = velQ(Q, D);
    const Sf = hazenSf(Q, D, C);
    const Hf = Sf * L;
    return {
      id: tr.id,
      codigo: `T-${String(i + 1).padStart(2, "0")}`,
      de: de.id,
      a: a.id,
      deCod: de.codigo,
      aCod: a.codigo,
      L, material: mat, C, DcalcPulg, Dpulg, D, Dmm: D * 1000, V, Sf, Hf,
      okV: V >= 0.6 && V <= 3,
    };
  });

  const velNudo = (id: string) => {
    const out = tramosCalc.find((t) => t.de === id);
    const inn = tramosCalc.find((t) => t.a === id);
    return out?.V ?? inn?.V ?? 0;
  };
  const tramoNudo = (id: string) => tramosCalc.find((t) => t.de === id) ?? tramosCalc.find((t) => t.a === id);

  const accesoriosCalc: AccesorioConduccionOut[] = accesoriosIn.map((ac) => {
    const nudo = nudoById.get(ac.nudoId);
    const n = Math.max(fin(ac.n, 1), 0);
    const Kunit = kAccesorio(ac.tipo, fin(ac.K));
    const Ktot = n * Kunit;
    const V = velNudo(ac.nudoId);
    const hVel = (V * V) / (2 * G);
    const Hf = Ktot * hVel;
    const tr = tramoNudo(ac.nudoId);
    const Leq = tr && tr.Sf > 1e-12 ? Hf / tr.Sf : 0;
    const cat = ACCESORIO_CATALOG[ac.tipo] ?? ACCESORIO_CATALOG.entrada;
    return {
      id: ac.id,
      nudoId: ac.nudoId,
      nudoCod: nudo?.codigo ?? "—",
      tipo: ac.tipo,
      label: cat.label,
      n, Kunit, Ktot, V, hVel, Hf, Leq,
    };
  });

  const KlocNudo = (id: string) =>
    accesoriosCalc.filter((a) => a.nudoId === id).reduce((s, a) => s + a.Ktot, 0);
  const HfaccNudo = (id: string) =>
    accesoriosCalc.filter((a) => a.nudoId === id).reduce((s, a) => s + a.Hf, 0);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const cotaCap = first.z;
  const cotaRes = last.z;
  const L = Math.max(last.pk - first.pk, tramosCalc.reduce((s, t) => s + t.L, 0), 1);
  const dh = cotaCap - cotaRes;
  const S = dh / L;
  const zCaptNAA = fin(inp.zCaptNAA, cotaCap + 0.4);
  let hgl = zCaptNAA;
  const perfil: PerfilConduccion[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i];
    if (i === 0) hgl -= HfaccNudo(n.id);
    else {
      const tr = tramosCalc.find((t) => t.a === n.id && t.de === sorted[i - 1].id) ?? tramosCalc[i - 1];
      hgl -= (tr?.Hf ?? 0) + HfaccNudo(n.id);
    }
    const zTubo = n.z - recubrimiento;
    perfil.push({
      id: n.id,
      codigo: n.codigo,
      tipo: n.tipo,
      pk: n.pk,
      zTerreno: n.z,
      zTubo,
      hgl,
      presion: hgl - zTubo,
      Kloc: KlocNudo(n.id),
      Hfacc: HfaccNudo(n.id),
    });
  }

  const Hf = tramosCalc.reduce((s, t) => s + t.Hf, 0);
  const Hfacc = accesoriosCalc.reduce((s, a) => s + a.Hf, 0);
  const Hftot = Hf + Hfacc;
  const Kacc = accesoriosCalc.reduce((s, a) => s + a.Ktot, 0);
  const Vref = tramosCalc[0]?.V ?? 0;
  const hVel = (Vref * Vref) / (2 * G);
  const C = tramosCalc[0] ? C_HAZEN[tramosCalc[0].material] : C_HAZEN[inp.material];
  const Dpulg = tramosCalc.length
    ? Math.max(...tramosCalc.map((t) => t.Dpulg))
    : 1;
  const DcalcPulg = tramosCalc[0]?.DcalcPulg ?? 0;
  const D = pulgAm(Dpulg);
  const Dmm = D * 1000;
  const V = Vref;
  const Sf = tramosCalc[0]?.Sf ?? 0;
  const Hpiez = perfil[perfil.length - 1]?.hgl ?? zCaptNAA - Hftot;
  const zLlegada = cotaRes - recubrimiento;
  const presion = perfil[perfil.length - 1]?.presion ?? Hpiez - zLlegada;
  const linea = perfil.filter((p) => p.tipo !== "captacion");
  const pMin = (linea.length ? linea : perfil).reduce((m, p) => Math.min(m, p.presion), Infinity);
  const pMax = perfil.reduce((m, p) => Math.max(m, p.presion), -Infinity);
  const okFuente = Qf + 1e-9 >= Qmd;
  const okV = tramosCalc.every((t) => t.okV);
  const okP = presion >= 5 && pMax <= 50 && pMin >= 0;
  const okS = S > 0;
  const okK2 = K2 >= 1.8 && K2 <= 2.5;
  const okHgl = perfil.every((p) => p.hgl + 1e-6 >= p.zTubo);

  const zFondo = cotaRes;
  const zMin = zFondo + 0.15;
  const zNAA = zFondo + Hcil;
  const zReb = zNAA + 0.1;
  const zTecho = zReb + 0.2;
  const DsalPulg = comercialPulg(hazenD(Qmh / 1000, Math.max(S, 0.005), C || 150) || pulgAm(1));
  const nVentosa = Math.max(
    sorted.filter((n) => n.tipo === "ventosa").length,
    1,
  );
  const nPurga = Math.max(
    sorted.filter((n) => n.tipo === "purga").length,
    1,
  );
  const Dtxt = [...new Set(tramosCalc.map((t) => t.Dpulg))].map((d) => `${d}"`).join(" / ");

  return {
    Po, r, t, Pf, dot, K1, K2, perd, Qneto, Qp, Qmd, Qmh, Qdia, Qf, frac, Vcalc, Vadop,
    Hcil, Dcil, Rcil, Aplanta, perimetro,
    cotaCap, cotaRes, L, dh, S, C, Dcalc: pulgAm(DcalcPulg), DpulgCalc: DcalcPulg, Dpulg, D, Dmm, V, Sf, Hf, Kacc, hVel, Hfacc, Hftot,
    Hpiez, recubrimiento, zLlegada, presion, pMin, pMax,
    zFondo, zMin, zNAA, zReb, zTecho, DsalPulg, nVentosa, nPurga, perfil,
    okFuente, okV, okP, okS, okK2, okHgl, bombeo: inp.bombeo, horasBombeo: fin(inp.horasBombeo, 12),
    captacionTipo, zCaptNAA, Dtxt,
    nudos: sorted,
    tramos: tramosCalc,
    accesorios: accesoriosCalc,
  };
}

export type SedimentadorInput = {
  QmdLs: number;
  B: number;
  L1: number;
  H: number;
  Sfondo: number;
  Vo: number;
  Dorif: number;
  A2: number;
  VS: number;
  autoB: boolean;
};

export function calcularSedimentador(inp: SedimentadorInput) {
  const Q = Math.max(fin(inp.QmdLs, 0.45), 1e-6) / 1000;
  const VS = Math.max(fin(inp.VS, 0.00017), 1e-8);
  const AS = Q / VS;
  let B = Math.max(fin(inp.B, 0.5), 0.3);
  if (inp.autoB) B = Math.max(0.5, round(Math.sqrt(AS / 4), 2));
  const L2calc = AS / B;
  const L2 = Math.ceil(L2calc * 2) / 2 || L2calc;
  const L1 = Math.max(fin(inp.L1, 0.8), 0.3);
  const LT = L1 + L2;
  const H = Math.max(fin(inp.H, 1), 0.6);
  const L2B = L2 / B;
  const L2H = L2 / H;
  const VH = (100 * Q) / (B * H);
  const To = (AS * H) / (3600 * Q);
  const Sfondo = fin(inp.Sfondo, 0.1);
  const H1 = H + Sfondo * L2;
  const H2 = Math.pow(Q / (1.84 * B), 2 / 3);
  const Vo = Math.max(fin(inp.Vo, 0.1), 0.02);
  const Ao = Q / Vo;
  const Dorif = Math.max(fin(inp.Dorif, 0.025), 0.01);
  const ao = 0.7854 * Dorif * Dorif;
  const nOrif = ao > 0 ? Ao / ao : 0;
  const nUse = Math.max(4, Math.ceil(nOrif));
  const hCort = H - (2 / 5) * H;
  const N2 = Math.max(2, Math.round(Math.sqrt(nUse * (hCort / Math.max(B, 0.1)))));
  const N1 = Math.max(2, Math.ceil(nUse / N2));
  const a = hCort / N2;
  const a1 = (B - a * (N1 - 1)) / 2;
  const A2 = Math.max(fin(inp.A2, 0.02), 0.005);
  const T1 = (60 * AS * Math.sqrt(H)) / (4850 * A2);
  const qDes = (1000 * LT * B * H2) / (60 * Math.max(T1, 1e-6));
  return {
    Q, VS, AS, B, L1, L2calc, L2, LT, H, L2B, L2H, VH, To, Sfondo, H1, H2,
    Vo, Ao, Dorif, ao, nOrif, nUse, hCort, N1, N2, a, a1, A2, T1, qDes,
    okL2B: L2B >= 2.8 && L2B <= 6,
    okL2H: L2H >= 6 && L2H <= 20,
    okVH: VH < 0.55,
    okTo: To >= 1.5 && To <= 4,
  };
}

const VELS_A = [0.1, 0.2, 0.4, 0.8];
const A_MID = [
  [1.2, 0.8, 0.6],
  [0.85, 0.7, 0.5],
  [0.75, 0.55, 0.425],
  [0.65, 0.45, 0.325],
];

export function moduloImpedimento(Vf: number, tramo: 0 | 1 | 2) {
  const v = clamp(Vf, 0.1, 0.8);
  let i = 0;
  while (i < VELS_A.length - 1 && v > VELS_A[i + 1]) i++;
  if (i >= VELS_A.length - 1) return A_MID[A_MID.length - 1][tramo];
  const t = (v - VELS_A[i]) / (VELS_A[i + 1] - VELS_A[i]);
  return A_MID[i][tramo] + t * (A_MID[i + 1][tramo] - A_MID[i][tramo]);
}

export type PrefiltroInput = {
  QmdLs: number;
  N: number;
  Vf: number;
  H: number;
  co: number;
  c1: number;
  c2: number;
  c3: number;
};

export function calcularPrefiltro(inp: PrefiltroInput) {
  const Qls = Math.max(fin(inp.QmdLs, 0.45), 1e-6);
  const Q = Qls / 1000;
  const N = Math.max(2, Math.round(fin(inp.N, 2)));
  const Vf = clamp(fin(inp.Vf, 0.4), 0.1, 0.8);
  const A = (3600 * Q) / (N * Vf);
  const H = Math.max(fin(inp.H, 2), 0.8);
  const B = A / H;
  const co = Math.max(fin(inp.co, 1000), 1);
  const c1 = Math.max(fin(inp.c1, 500), 1);
  const c2 = Math.max(fin(inp.c2, 100), 1);
  const c3 = Math.max(fin(inp.c3, 50), 1);
  const a1 = moduloImpedimento(Vf, 2);
  const a2 = moduloImpedimento(Vf, 1);
  const a3 = moduloImpedimento(Vf, 0);
  const L1 = -Math.log(c1 / co) / a1;
  const L2 = -Math.log(c2 / c1) / a2;
  const L3 = -Math.log(c3 / c2) / a3;
  const Lt = L1 + L2 + L3;
  return { Qls, Q, N, Vf, A, H, B, co, c1, c2, c3, a1, a2, a3, L1, L2, L3, Lt, okVf: Vf >= 0.1 && Vf <= 0.6 };
}

export type FiltroLentoInput = {
  QmdLs: number;
  N: number;
  Vf: number;
  E: number;
  nRasp: number;
  Buse: number;
  Ause: number;
  hAgua: number;
  hLecho: number;
  hSop: number;
  hDren: number;
  BL: number;
};

export function calcularFiltroLento(inp: FiltroLentoInput) {
  const Qls = Math.max(fin(inp.QmdLs, 0.451), 1e-6);
  const Qmh = Qls * 3.6;
  const N = Math.max(2, Math.round(fin(inp.N, 2)));
  const Vf = clamp(fin(inp.Vf, 0.2), 0.08, 0.4);
  const AS = Qmh / (N * Vf);
  const K = (2 * N) / (N + 1);
  const Bcalc = Math.sqrt(AS * K);
  const Acalc = Math.sqrt(AS / K);
  const B = inp.Buse > 0 ? inp.Buse : round(Bcalc, 1);
  const A = inp.Ause > 0 ? inp.Ause : round(Acalc, 1);
  const E = Math.max(fin(inp.E, 0.02), 0.01);
  const nRasp = Math.max(1, fin(inp.nRasp, 6));
  const Vdep = 2 * A * B * E * nRasp;
  const VR = Qmh / (N * A * B);
  const hAgua = fin(inp.hAgua, 1.2);
  const hLecho = fin(inp.hLecho, 0.9);
  const hSop = fin(inp.hSop, 0.2);
  const hDren = fin(inp.hDren, 0.15);
  const BL = fin(inp.BL, 0.25);
  const Htot = hAgua + hLecho + hSop + hDren + BL;
  return {
    Qls, Qmh, N, Vf, AS, K, Bcalc, Acalc, B, A, E, nRasp, Vdep, VR,
    hAgua, hLecho, hSop, hDren, BL, Htot,
    okVf: VR >= 0.1 && VR <= 0.3,
    okN: N >= 2,
    okAS: AS >= 2 && AS <= 200,
  };
}

export type ImpulsionInput = {
  QmdLs: number;
  hb: number;
  HgSuc: number;
  Lsuc: number;
  DsucPulg: number;
  HgImp: number;
  Limp: number;
  DimpPulg: number;
  C: number;
  eta: number;
  Ps: number;
  Ksuc: number;
  Kimp: number;
};

export function calcularImpulsion(inp: ImpulsionInput) {
  const Qmd = Math.max(fin(inp.QmdLs, 0.28), 1e-6);
  const hb = clamp(fin(inp.hb, 14), 4, 20);
  const tb = (24 - hb) / 2;
  const Vc = (Qmd * tb * 3600) / 1000;
  const Qb = (Qmd * 24) / hb;
  const Qm3 = Qb / 1000;
  const lam = hb / 24;
  const Dbresse = 1.3 * Math.pow(lam, 0.25) * Math.sqrt(Qm3);
  const DsucP = inp.DsucPulg > 0 ? inp.DsucPulg : comercialPulg(Math.max(Dbresse, 0.025));
  const DimpP = inp.DimpPulg > 0 ? inp.DimpPulg : comercialPulg(Dbresse);
  const Dsuc = fgInterno(DsucP);
  const Dimp = fgInterno(DimpP);
  const C = fin(inp.C, 100);
  const Vsuc = velQ(Qm3, Dsuc);
  const Vimp = velQ(Qm3, Dimp);
  const SfSuc = hazenSf(Qm3, Dsuc, C);
  const SfImp = hazenSf(Qm3, Dimp, C);
  const Lsuc = Math.max(fin(inp.Lsuc, 1), 0.2);
  const Limp = Math.max(fin(inp.Limp, 250), 1);
  const hfLsuc = SfSuc * Lsuc;
  const hfLimp = SfImp * Limp;
  const Ksuc = fin(inp.Ksuc, 2.8);
  const Kimp = fin(inp.Kimp, 10.8);
  const hAccSuc = Ksuc * (Vsuc * Vsuc) / (2 * G);
  const hAccImp = Kimp * (Vimp * Vimp) / (2 * G);
  const HgSuc = fin(inp.HgSuc, 0);
  const HgImp = fin(inp.HgImp, 25);
  const Ps = fin(inp.Ps, 2);
  const HfSuc = hfLsuc + hAccSuc;
  const HfImp = hfLimp + hAccImp;
  const Ht = HgSuc + HfSuc + HgImp + HfImp + Ps;
  const eta = clamp(fin(inp.eta, 0.6), 0.3, 0.9);
  const HP = (Qb * Ht) / (76 * eta);
  const kW = HP * 0.746;
  const Smin = 2.5 * Dsuc + 0.1;
  const Shid = 2.5 * (Vsuc * Vsuc) / (2 * G) + 0.2;
  return {
    Qmd, hb, tb, Vc, Qb, Qm3, lam, Dbresse, DsucP, DimpP, Dsuc, Dimp, C,
    Vsuc, Vimp, SfSuc, SfImp, Lsuc, Limp, hfLsuc, hfLimp, Ksuc, Kimp,
    hAccSuc, hAccImp, HgSuc, HgImp, Ps, HfSuc, HfImp, Ht, eta, HP, kW, Smin, Shid,
    okVsuc: Vsuc >= 0.3 && Vsuc <= 1.5,
    okVimp: Vimp >= 0.6 && Vimp <= 2.0,
    okHP: HP > 0,
  };
}

export type ReservorioInput = {
  Pf: number;
  dot: number;
  fracReg: number;
  fracRes: number;
  b: number;
  L: number;
  hs: number;
  hing: number;
  hreb: number;
  hrebAgua: number;
};

export function calcularReservorio(inp: ReservorioInput) {
  const Pf = Math.max(fin(inp.Pf, 250), 1);
  const dot = Math.max(fin(inp.dot, 80), 20);
  const Qp = (Pf * dot) / 86400;
  const Qmd = 1.3 * Qp;
  const Qmh = 2 * Qp;
  const fracReg = clamp(fin(inp.fracReg, 0.25), 0.15, 0.4);
  const fracRes = clamp(fin(inp.fracRes, 0), 0, 0.5);
  const Vreg = volRegulacion(Qp, fracReg);
  const Vres = volRegulacion(Qp, fracRes);
  const Vt = Vreg + Vres;
  const Vadop = redondearVolumen(Vt);
  const b = Math.max(fin(inp.b, 0), 0);
  const L = Math.max(fin(inp.L, 0), 0);
  const lado = b > 0 && L > 0 ? 0 : Math.max(1.8, round(Math.sqrt(Vadop / 1.2), 1));
  const bi = b > 0 ? b : lado;
  const Li = L > 0 ? L : lado;
  const hu = Vadop / (bi * Li);
  const hs = fin(inp.hs, 0.1);
  const hAgua = hu + hs;
  const bh = bi / Math.max(hAgua, 0.1);
  const hing = fin(inp.hing, 0.2);
  const hreb = fin(inp.hreb, 0.15);
  const hrebAgua = fin(inp.hrebAgua, 0.1);
  const Hint = hAgua + hing + hreb + hrebAgua;
  const Dent = Qmd < 0.5 ? 1 : Qmd < 1.2 ? 1.5 : 2;
  const Dsal = Qmh < 0.6 ? 1 : Qmh < 1.5 ? 1.5 : Qmh < 3 ? 2 : 3;
  const Dreb = Dent + 0.5 >= 2 ? Math.max(2, Dent + 0.5) : 2;
  const tVac = 0.5 * 3600;
  const DlimpiaCalc = Math.sqrt((4 * Vadop) / (Math.PI * 0.8 * tVac)) * 1000 / 25.4;
  const Dlimpia = comercialPulg(pulgAm(Math.max(1.5, DlimpiaCalc)));
  return {
    Pf, dot, Qp, Qmd, Qmh, fracReg, fracRes, Vreg, Vres, Vt, Vadop,
    bi, Li, hu, hs, hAgua, bh, hing, hreb, hrebAgua, Hint,
    Dent, Dsal, Dreb, Dlimpia, DlimpiaCalc,
    okBh: bh >= 0.5 && bh <= 3,
    okHu: hu >= 0.8 && hu <= 3.5,
  };
}

export type CloracionInput = {
  QmdLs: number;
  d: number;
  rAct: number;
  c: number;
  tH: number;
  Cd: number;
  DorifMm: number;
  h: number;
  gotaL: number;
};

export function calcularCloracion(inp: CloracionInput) {
  const Qmd = Math.max(fin(inp.QmdLs, 0.3), 1e-6);
  const Qm3h = Qmd * 3.6;
  const d = Math.max(fin(inp.d, 2), 0.2);
  const P = Qm3h * d;
  const rAct = clamp(fin(inp.rAct, 65), 1, 100);
  const Pc = (P * 100) / rAct;
  const c = Math.max(fin(inp.c, 0.25), 0.05);
  const qs = (Pc / 1000) * 100 / c;
  const tH = fin(inp.tH, 12);
  const Vs = qs * tH;
  const Cd = fin(inp.Cd, 0.8);
  const Dorif = Math.max(fin(inp.DorifMm, 2), 0.4) / 1000;
  const A = Math.PI * Dorif * Dorif / 4;
  const h = Math.max(fin(inp.h, 0.2), 0.02);
  const Qg = Cd * A * Math.sqrt(2 * G * h);
  const gotaL = fin(inp.gotaL, 5e-5);
  const Qgls = Qg * 1000;
  const gotasS = gotaL > 0 ? Qgls / gotaL : 0;
  const recipiente = Vs <= 20 ? 20 : Vs <= 60 ? 60 : Vs <= 120 ? 120 : 150;
  return {
    Qmd, Qm3h, d, P, rAct, Pc, c, qs, tH, Vs, Cd, Dorif, A, h, Qg, Qgls, gotaL, gotasS, recipiente,
    okDosis: d >= 0.5 && d <= 5,
    okC: c >= 0.1 && c <= 1,
  };
}
