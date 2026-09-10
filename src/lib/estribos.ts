import { barByName, fmt, type BarDef } from "./types";

/** Espaciamientos comerciales de estribo (cm). */
export const S_COMERCIAL = [5, 6, 7.5, 8, 10, 12, 15, 20, 25, 30] as const;

export function adoptarS(sRaw: number, sMax: number, sMin = 5): number {
  const cap = Math.min(Math.max(sRaw, sMin), Math.max(sMax, sMin));
  let best = sMin;
  for (const s of S_COMERCIAL) {
    if (s <= cap + 1e-9) best = s;
  }
  return best;
}

/** Primer estribo a 5 cm del paño; luego n = 1 + ⌈(ℓ − 5)/s⌉. */
export function nDesdePaño(Lcm: number, s: number, primer = 5): number {
  if (Lcm <= 0) return 0;
  if (Lcm <= primer) return 1;
  return 1 + Math.ceil((Lcm - primer) / Math.max(s, 1));
}

/** Estribos de un tramo interior (sin contar los de borde de zona). */
export function nTramo(Lcm: number, s: number): number {
  if (Lcm < Math.max(s, 1) * 0.45) return 0;
  return Math.max(0, Math.ceil(Lcm / Math.max(s, 1)) - 1);
}

/** Extensión del gancho sísmico 135°: máx(6 db, 7.5 cm). E.060 7.1.3 / 21.1. */
export function gancho135(db: number): number {
  return Math.max(6 * db, 7.5);
}

/** Longitud de un estribo cerrado (cm): 2(b′+h′) + 2 ganchos. */
export function largoEstribo(b: number, h: number, rec: number, dest: number): number {
  const bi = Math.max(4, b - 2 * rec);
  const hi = Math.max(4, h - 2 * rec);
  return 2 * bi + 2 * hi + 2 * gancho135(dest);
}

export function kgPorMetro(bar: BarDef): number {
  return bar.as * 0.785;
}

export function pesoEstribos(bar: BarDef, LunitCm: number, n: number): number {
  return n * (LunitCm / 100) * kgPorMetro(bar);
}

export function fmtSmetros(cm: number): string {
  const m = cm / 100;
  if (Math.abs(m * 100 - Math.round(m * 100)) < 1e-9) return m.toFixed(2);
  return m.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function arregloZona(n: number, s: number, primer = 5): string {
  if (n <= 0) return "—";
  if (n === 1) return `1 @ ${primer} cm`;
  return `1 @ ${primer} cm + ${n - 1} @ ${s} cm`;
}

export function arregloPlano(nConf: number, sConf: number, sRest: number): string {
  return `1 @ 0.05 + ${Math.max(0, nConf - 1)} @ ${fmtSmetros(sConf)} + r @ ${fmtSmetros(sRest)}`;
}

export type BeamStirrupIn = {
  b: number;
  h: number;
  d: number;
  rec: number;
  fc: number;
  fy: number;
  Vu: number;
  VA: number;
  Av: number;
  L: number;
  destName: string;
  destDb: number;
  dbLong: number;
  nRamas: number;
  sismico: boolean;
};

export type BeamStirrupOut = {
  phi: number;
  Vc: number;
  phiVc: number;
  Vs: number;
  VsMax: number;
  vsLim: number;
  avsMin: number;
  avs: number;
  needDesign: boolean;
  needMin: boolean;
  sFromVs: number;
  sFromMin: number;
  sMaxApoyo: number;
  sMaxCentro: number;
  sMaxSis: number;
  sApoyo: number;
  sCentro: number;
  Lzona: number;
  Lcentro: number;
  lo: number;
  Lshear: number;
  nEnd: number;
  nCentro: number;
  nTotal: number;
  sectionOk: boolean;
  primer: number;
  arregloApoyo: string;
  arregloCentro: string;
  arregloPlano: string;
  Lunit: number;
  peso: number;
  regimen: string;
  criterioZona: string;
  estLabel: string;
};

export function designBeamStirrups(p: BeamStirrupIn): BeamStirrupOut {
  const phi = 0.85;
  const sqrtFc = Math.sqrt(Math.max(p.fc, 1));
  const Vc = (0.53 * sqrtFc * p.b * p.d) / 1000;
  const phiVc = phi * Vc;
  const VsMax = (2.1 * sqrtFc * p.b * p.d) / 1000;
  const vsLim = (1.1 * sqrtFc * p.b * p.d) / 1000;
  const avsMin = (Math.max(3.5, 0.75 * sqrtFc) * p.b) / Math.max(p.fy, 1);
  const needDesign = p.Vu > phiVc + 1e-9;
  const needMin = p.Vu > phiVc / 2 + 1e-9;
  const Vs = needDesign ? Math.max(0, p.Vu / phi - Vc) : 0;
  const sFromVs = needDesign && Vs > 1e-6 ? (p.Av * p.fy * p.d) / (Vs * 1000) : 1e9;
  const sFromMin = p.Av / Math.max(avsMin, 1e-9);
  const sMaxOrd = Vs > vsLim + 1e-9 ? Math.min(p.d / 4, 30) : Math.min(p.d / 2, 60);
  const sMaxSis = Math.min(p.d / 4, 8 * p.dbLong, 24 * p.destDb, 30);
  const sMaxApoyo = p.sismico ? Math.min(sMaxOrd, sMaxSis) : sMaxOrd;
  const sMaxCentro = Math.min(p.d / 2, 60);
  const sApoyoRaw = needDesign
    ? Math.min(sFromVs, sMaxApoyo, sFromMin)
    : needMin
      ? Math.min(sMaxApoyo, sFromMin)
      : Math.min(sMaxApoyo, sMaxCentro);
  const sCentroRaw = Math.min(sMaxCentro, sFromMin);
  const sApoyo = adoptarS(sApoyoRaw, sMaxApoyo);
  const sCentro = adoptarS(sCentroRaw, sMaxCentro);

  const Lshear =
    p.VA > phiVc + 1e-9
      ? Math.min(p.L / 4, Math.max(p.d / 100, (p.L / 2) * (1 - phiVc / Math.max(p.VA, 1e-6))))
      : Math.min(p.L / 4, (2 * p.d) / 100);
  const lo = (2 * p.h) / 100;
  const Lzona = Math.min(p.L / 2 - 0.04, p.sismico ? Math.max(lo, Lshear) : Lshear);
  const Lcentro = Math.max(0, p.L - 2 * Lzona);
  const primer = 5;
  const nEnd = Math.max(2, nDesdePaño(Lzona * 100, sApoyo, primer));
  const nCentro = nTramo(Lcentro * 100, sCentro);
  const sectionOk = p.Vu <= phi * (Vc + VsMax) + 1e-9 && Vs <= VsMax + 1e-9;
  const avs = p.Av / Math.max(sApoyo, 1);
  const bar = barByName(p.destName);
  const Lunit = largoEstribo(p.b, p.h, p.rec, p.destDb);
  const nTotal = 2 * nEnd + nCentro;
  const estLabel = `${p.nRamas}Ø ${p.destName}`;
  const arregloApoyo = arregloZona(nEnd, sApoyo, primer);
  const arregloCentro = `resto @ ${sCentro} cm`;
  const arregloPlanoStr = arregloPlano(nEnd, sApoyo, sCentro);

  const regimen = needDesign
    ? "Vu > φVc — el acero toma Vs = Vu/φ − Vc"
    : needMin
      ? "φVc/2 < Vu ≤ φVc — estribos mínimos de norma"
      : "Vu ≤ φVc/2 — estribos constructivos (s ≤ d/2)";
  const criterioZona = p.sismico
    ? `Zona densa ℓo = 2h = ${fmt(lo, 2)} m (E.060 21.3.3), no menor que el tramo hasta Vu ≈ φVc (${fmt(Lshear, 2)} m)`
    : `Zona densa hasta Vu ≈ φVc (≤ L/4), ℓ = ${fmt(Lzona, 2)} m`;

  return {
    phi,
    Vc,
    phiVc,
    Vs,
    VsMax,
    vsLim,
    avsMin,
    avs,
    needDesign,
    needMin,
    sFromVs,
    sFromMin,
    sMaxApoyo,
    sMaxCentro,
    sMaxSis,
    sApoyo,
    sCentro,
    Lzona,
    Lcentro,
    lo,
    Lshear,
    nEnd,
    nCentro,
    nTotal,
    sectionOk,
    primer,
    arregloApoyo,
    arregloCentro,
    arregloPlano: arregloPlanoStr,
    Lunit,
    peso: pesoEstribos(bar, Lunit, nTotal),
    regimen,
    criterioZona,
    estLabel,
  };
}

export type ColStirrupIn = {
  b: number;
  h: number;
  rec: number;
  Lu: number;
  fc: number;
  fy: number;
  destName: string;
  destDb: number;
  destAs: number;
  dbLong: number;
  nBar: number;
  nRamas: number;
  sismico: boolean;
};

export type ColStirrupOut = {
  destOk: boolean;
  destMin: number;
  nRamas: number;
  hx: number;
  so: number;
  hc: number;
  bc: number;
  Ach: number;
  Ag: number;
  Ash: number;
  avs1: number;
  avs2: number;
  avsReq: number;
  sFromAsh: number;
  sMaxConf: number;
  sMaxRest: number;
  sMaxOrd: number;
  sConf: number;
  sRest: number;
  lo: number;
  Lrest: number;
  nConf: number;
  nRest: number;
  nTotal: number;
  primer: number;
  arregloConf: string;
  arregloRest: string;
  arregloPlano: string;
  Lunit: number;
  peso: number;
  needCrosstie: boolean;
  ashOk: boolean;
  destLabel: string;
};

export function designColumnStirrups(p: ColStirrupIn): ColStirrupOut {
  const destMin = Math.max(p.dbLong / 4, 0.95);
  const destOk = p.destDb + 1e-9 >= destMin;
  const hc = Math.max(4, p.b - 2 * p.rec - p.destDb);
  const bc = Math.max(4, p.h - 2 * p.rec - p.destDb);
  const Ag = p.b * p.h;
  const Ach = hc * bc;
  const hx2 = Math.max(hc, bc);
  const needCrosstie = hx2 > 35 + 1e-9 || p.nBar >= 8;
  const avs1 = (0.09 * hc * p.fc) / Math.max(p.fy, 1);
  const avs2 = (0.3 * hc * (Ag / Math.max(Ach, 1) - 1) * p.fc) / Math.max(p.fy, 1);
  const avsReq = p.sismico ? Math.max(avs1, avs2) : 0;
  const menor = Math.min(p.b, p.h);
  const sMaxRest = p.sismico ? Math.min(6 * p.dbLong, 15) : Math.min(16 * p.dbLong, 48 * p.destDb, menor);
  const sMaxOrd = Math.min(16 * p.dbLong, 48 * p.destDb, menor);
  let nRamas = p.nRamas >= 2 ? Math.max(2, Math.round(p.nRamas)) : needCrosstie ? 4 : 2;
  const pack = (ramas: number) => {
    const nEspacios = Math.max(1, ramas / 2);
    const hx = hx2 / nEspacios;
    const so = Math.min(10, Math.max(7.5, 10 + (35 - hx) / 3));
    const sMaxConf = p.sismico ? Math.min(menor / 4, 6 * p.dbLong, so) : sMaxOrd;
    const Ash = ramas * p.destAs;
    const sFromAsh = Ash / Math.max(p.sismico ? avsReq : Ash / Math.max(sMaxOrd, 1), 1e-9);
    const sConf = adoptarS(Math.min(sFromAsh, sMaxConf), sMaxConf);
    const ashOk = Ash / Math.max(sConf, 1) + 1e-9 >= (p.sismico ? avsReq : 0);
    return { hx, so, sMaxConf, Ash, sFromAsh, sConf, ashOk };
  };
  let geom = pack(nRamas);
  if (!geom.ashOk && p.nRamas < 2 && nRamas < 4) {
    nRamas = 4;
    geom = pack(4);
  }
  const { hx, so, sMaxConf, Ash, sFromAsh, sConf, ashOk } = geom;
  const sRest = adoptarS(sMaxRest, sMaxRest);
  const lo = p.sismico ? Math.max(p.h, p.b, p.Lu / 6, 45) : Math.min(p.Lu / 2, Math.max(p.h, 45));
  const Lrest = Math.max(0, p.Lu - 2 * lo);
  const primer = 5;
  const nConf = Math.max(3, nDesdePaño(Math.min(lo, p.Lu / 2), sConf, primer));
  const nRest = Lrest > sRest * 0.4 ? nTramo(Lrest, sRest) : 0;
  const nTotal = 2 * nConf + nRest;
  const bar = barByName(p.destName);
  const Lunit = largoEstribo(p.b, p.h, p.rec, p.destDb);
  const destLabel = `${nRamas}Ø ${p.destName}`;

  return {
    destOk,
    destMin,
    nRamas,
    hx,
    so,
    hc,
    bc,
    Ach,
    Ag,
    Ash,
    avs1,
    avs2,
    avsReq,
    sFromAsh,
    sMaxConf,
    sMaxRest,
    sMaxOrd,
    sConf,
    sRest,
    lo,
    Lrest,
    nConf,
    nRest,
    nTotal,
    primer,
    arregloConf: arregloZona(nConf, sConf, primer),
    arregloRest: Lrest > 0 ? `resto @ ${sRest} cm` : "toda la altura confinada",
    arregloPlano: arregloPlano(nConf, sConf, sRest),
    Lunit,
    peso: pesoEstribos(bar, Lunit, nTotal),
    needCrosstie: needCrosstie || nRamas >= 4,
    ashOk,
    destLabel,
  };
}
