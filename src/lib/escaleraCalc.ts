import { barByName, spacingFor, type BarDef } from "./types";

export type EscaleraSteel = {
  As: number;
  AsFlex: number;
  AsMin: number;
  AsUse: number;
  bar: string;
  s: number;
  AsProv: number;
  text: string;
};

export type EscaleraTramo = {
  id: "T1" | "T2" | "D";
  label: string;
  nC: number;
  H: number;
  Lh: number;
  Li: number;
  alphaDeg: number;
  cosA: number;
  gLosa: number;
  gGrada: number;
  CM: number;
  wu: number;
  MuPos: number;
  MuNeg: number;
  Vu: number;
  pos: EscaleraSteel;
  neg: EscaleraSteel;
};

export type EscaleraModelo = {
  H: number;
  L: number;
  a: number;
  e: number;
  rec: number;
  d: number;
  nC: number;
  n1: number;
  n2: number;
  cCm: number;
  bCm: number;
  blanco: number;
  acab: number;
  cv: number;
  fc: number;
  fy: number;
  phi: number;
  j: number;
  t1: EscaleraTramo;
  t2: EscaleraTramo;
  desc: EscaleraTramo;
  dist: EscaleraSteel;
  AsMinTemp: number;
  sMaxTransv: number;
  dirLong: string;
  dirTransv: string;
  phiVc: number;
  VuMax: number;
};

function q(n: number, dec: number) {
  const k = 10 ** dec;
  return Math.round(n * k) / k;
}

function asFlex(Mu_tm: number, fy: number, d: number, phi = 0.9, j = 0.9) {
  if (Mu_tm <= 0 || d <= 0) return 0;
  return (Mu_tm * 100000) / (phi * fy * j * d);
}

function asMinFlex(fc: number, fy: number, d: number) {
  return Math.max((0.7 * Math.sqrt(fc)) / fy, 14 / fy) * 100 * d;
}

function asMinTemp(fy: number, e: number) {
  return (fy >= 4200 ? 0.0018 : 0.002) * 100 * e;
}

function elegirAcero(AsNeed: number, prefer: BarDef[] = [barByName('3/8"'), barByName('1/2"')]): EscaleraSteel {
  const need = Math.max(AsNeed, 1e-6);
  let best: EscaleraSteel | null = null;
  for (const bar of prefer) {
    const s = spacingFor(need, bar.as, 100);
    const AsProv = (bar.as / s) * 100;
    const cand: EscaleraSteel = {
      As: need,
      AsFlex: need,
      AsMin: need,
      AsUse: need,
      bar: bar.name,
      s,
      AsProv,
      text: `Ø ${bar.name} @ ${s} cm`,
    };
    if (AsProv + 1e-6 >= need) return cand;
    if (!best || AsProv > best.AsProv) best = cand;
  }
  return best ?? {
    As: need,
    AsFlex: need,
    AsMin: need,
    AsUse: need,
    bar: '1/2"',
    s: 8,
    AsProv: (1.29 / 8) * 100,
    text: 'Ø 1/2" @ 8 cm',
  };
}

function armar(Mu: number, fc: number, fy: number, d: number, e: number, phi: number, j: number): EscaleraSteel {
  const AsF = asFlex(Mu, fy, d, phi, j);
  const AsMf = asMinFlex(fc, fy, d);
  const AsMt = asMinTemp(fy, e);
  const AsUse = Math.max(AsF, AsMf, AsMt);
  const st = elegirAcero(AsUse);
  return { ...st, As: AsF, AsFlex: AsF, AsMin: Math.max(AsMf, AsMt), AsUse };
}

function tramoInclinado(p: {
  id: "T1" | "T2";
  label: string;
  nC: number;
  H: number;
  Lh: number;
  eM: number;
  acab: number;
  cv: number;
  fc: number;
  fy: number;
  d: number;
  eCm: number;
  phi: number;
  j: number;
}): EscaleraTramo {
  const Li = Math.sqrt(p.Lh ** 2 + p.H ** 2);
  const alpha = Math.atan2(p.H, p.Lh);
  const cosA = Math.cos(alpha);
  const gLosa = 2400 * (p.eM / Math.max(cosA, 0.35));
  const gGrada = 2400 * (p.H / Math.max(p.nC, 1)) * 0.5;
  const CM = gLosa + gGrada + p.acab;
  const wu = 1.4 * CM + 1.7 * p.cv;
  const MuPos = (wu / 1000) * (p.Lh ** 2) / 8;
  const MuNeg = (wu / 1000) * (p.Lh ** 2) / 10;
  const Vu = (wu / 1000) * p.Lh / 2;
  return {
    id: p.id,
    label: p.label,
    nC: p.nC,
    H: p.H,
    Lh: p.Lh,
    Li,
    alphaDeg: (alpha * 180) / Math.PI,
    cosA,
    gLosa,
    gGrada,
    CM,
    wu,
    MuPos,
    MuNeg,
    Vu,
    pos: armar(MuPos, p.fc, p.fy, p.d, p.eCm, p.phi, p.j),
    neg: armar(MuNeg, p.fc, p.fy, p.d, p.eCm, p.phi, p.j),
  };
}

export function calcularEscalera(raw: {
  H: number;
  L: number;
  nC: number;
  bHuella: number;
  a: number;
  e: number;
  fc: number;
  fy: number;
  cv: number;
  acab?: number;
  rec?: number;
}): EscaleraModelo {
  const H = Math.max(0.8, raw.H);
  const L = Math.max(0.6, raw.L);
  const nC = Math.max(4, Math.round(raw.nC));
  const n1 = Math.ceil(nC / 2);
  const n2 = Math.max(1, nC - n1);
  const bCm = raw.bHuella;
  const a = Math.max(0.8, raw.a);
  const e = Math.max(8, raw.e);
  const fc = raw.fc;
  const fy = raw.fy;
  const cv = raw.cv;
  const acab = raw.acab ?? 100;
  const rec = raw.rec ?? 2.5;
  const barP = barByName('3/8"');
  const d = Math.max(4, e - rec - barP.db / 2);
  const phi = 0.9;
  const j = 0.9;
  const cCm = (H * 100) / nC;
  const blanco = cCm + 2 * bCm;
  const H1 = n1 * (H / nC);
  const H2 = n2 * (H / nC);
  const eM = e / 100;

  const t1 = tramoInclinado({
    id: "T1",
    label: "Tramo 1 (piso → descanso)",
    nC: n1,
    H: H1,
    Lh: L,
    eM,
    acab,
    cv,
    fc,
    fy,
    d,
    eCm: e,
    phi,
    j,
  });
  const t2 = tramoInclinado({
    id: "T2",
    label: "Tramo 2 (descanso → piso superior)",
    nC: n2,
    H: H2,
    Lh: L,
    eM,
    acab,
    cv,
    fc,
    fy,
    d,
    eCm: e,
    phi,
    j,
  });

  const gDesc = 2400 * eM;
  const CMd = gDesc + acab;
  const wuD = 1.4 * CMd + 1.7 * cv;
  const Ld = a;
  const MuPosD = (wuD / 1000) * (Ld ** 2) / 8;
  const MuNegD = (wuD / 1000) * (Ld ** 2) / 12;
  const VuD = (wuD / 1000) * Ld / 2;
  const desc: EscaleraTramo = {
    id: "D",
    label: "Descanso intermedio",
    nC: 0,
    H: H1,
    Lh: Ld,
    Li: Ld,
    alphaDeg: 0,
    cosA: 1,
    gLosa: gDesc,
    gGrada: 0,
    CM: CMd,
    wu: wuD,
    MuPos: MuPosD,
    MuNeg: MuNegD,
    Vu: VuD,
    pos: armar(MuPosD, fc, fy, d, e, phi, j),
    neg: armar(MuNegD, fc, fy, d, e, phi, j),
  };

  const AsMinT = asMinTemp(fy, e);
  const sMaxTransv = Math.min(5 * e, 45);
  const dist = elegirAcero(AsMinT, [barByName('3/8"'), barByName('1/4"')]);
  dist.As = AsMinT;
  dist.AsFlex = 0;
  dist.AsMin = AsMinT;
  dist.AsUse = AsMinT;
  if (dist.s > sMaxTransv) dist.s = sMaxTransv;
  dist.text = `Ø ${dist.bar} @ ${dist.s} cm`;
  dist.AsProv = (barByName(dist.bar).as / dist.s) * 100;

  const VuMax = Math.max(t1.Vu, t2.Vu, desc.Vu);
  const phiVc = (0.85 * 0.53 * Math.sqrt(fc) * 100 * d) / 1000;

  return {
    H,
    L,
    a,
    e,
    rec,
    d: q(d, 2),
    nC,
    n1,
    n2,
    cCm,
    bCm,
    blanco,
    acab,
    cv,
    fc,
    fy,
    phi,
    j,
    t1,
    t2,
    desc,
    dist,
    AsMinTemp: AsMinT,
    sMaxTransv,
    dirLong: "sentido de la luz (pendiente del tramo / lado corto del descanso)",
    dirTransv: "perpendicular al longitudinal (ancho a): distribución de carga + retracción/temperatura",
    phiVc,
    VuMax,
  };
}
