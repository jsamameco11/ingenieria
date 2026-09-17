/** Deflexión de servicio: Branson + elástica de voladizo. Unidades t, m, ml. */

export function snapEspesor5cm(m: number) {
  return Math.max(0.2, Math.ceil(m * 20 - 1e-9) / 20);
}

export function ecConcreto(fc: number) {
  const Ec_kgcm2 = 15000 * Math.sqrt(Math.max(fc, 1));
  return { Ec_kgcm2, Ec: Ec_kgcm2 * 10 };
}

export function frConcreto(fc: number) {
  const fr_kgcm2 = 2.01 * Math.sqrt(Math.max(fc, 1));
  return { fr_kgcm2, fr: fr_kgcm2 * 10 };
}

/** Inercia efectiva de Branson (E.060 / ACI 9.5.2.3), franja 1.00 m. */
export function ieBranson(Ig: number, Icr: number, Mcr: number, Ma: number) {
  const ra = Ma > 1e-9 ? Math.min(1, Mcr / Ma) : 1;
  const ratio = ra ** 3 + (1 - ra ** 3) * (Icr / Math.max(Ig, 1e-9));
  const Ie = Math.min(Ig, Math.max(Icr, ratio * Ig));
  return { ra, ratio, Ie, agrietada: Ma > Mcr + 1e-9 };
}

export type CargaPantallaFn = (xDesdeBase: number) => number;

/**
 * Flecha en el extremo libre de un voladizo empotrado:
 * δ = ∫ M(x)(L−x) / (Ec Ie(x)) dx, x desde el empotramiento.
 */
export function flechaVoladizo(p: {
  L: number;
  Ec: number;
  w: CargaPantallaFn;
  Ie: (x: number) => number;
  nMom?: number;
  nInt?: number;
}) {
  const nMom = p.nMom ?? 24;
  const nInt = p.nInt ?? 60;
  const momento = (xi: number) => {
    const subDx = (p.L - xi) / nMom;
    if (subDx <= 1e-12) return 0;
    let acc = 0;
    let prev = 0;
    for (let j = 1; j <= nMom; j++) {
      const xj = xi + j * subDx;
      const val = p.w(xj) * (xj - xi);
      acc += ((prev + val) / 2) * subDx;
      prev = val;
    }
    return acc;
  };
  const xs: number[] = [];
  for (let i = 0; i <= nInt; i++) xs.push((i * p.L) / nInt);
  const y = xs.map((xi) => (momento(xi) * (p.L - xi)) / (p.Ec * Math.max(p.Ie(xi), 1e-12)));
  let delta = 0;
  for (let i = 1; i < xs.length; i++) delta += ((y[i] + y[i - 1]) / 2) * (xs[i] - xs[i - 1]);
  return { delta, momentoBase: momento(0) };
}

export type DeflexionPantalla = {
  Ec_kgcm2: number;
  Ec: number;
  nModular: number;
  fr_kgcm2: number;
  fr: number;
  Ig0: number;
  Mcr0: number;
  Icr0: number;
  cNA: number;
  Ie0: number;
  IeRatio: number;
  raMcr: number;
  MaServ: number;
  agrietada: boolean;
  deltaAlma: number;
  deltaAlma_cm: number;
  deltaAdmAlma: number;
  deltaAdmAlma_cm: number;
  okDeflexionAlma: boolean;
};

export function deflexionPantallaVoladizo(p: {
  Hs: number;
  F: number;
  Bp: number;
  fc: number;
  d_cm: number;
  AsProv_cm2m: number;
  Ka: number;
  gammaRelleno: number;
  c: number;
  hwStem: number;
  gammaW: number;
  PqStem: number;
  MaServ: number;
}): DeflexionPantalla {
  const { Ec_kgcm2, Ec } = ecConcreto(p.fc);
  const { fr_kgcm2, fr } = frConcreto(p.fc);
  const nModular = (2_000_000 * 10) / Math.max(Ec, 1e-9);
  const Ig0 = (1.0 * p.F ** 3) / 12;
  const Mcr0 = (fr * Ig0) / Math.max(p.F / 2, 1e-9);
  const dAlma_m = p.d_cm / 100;
  const AsAlma_m2 = p.AsProv_cm2m / 10000;
  const rhoN = (AsAlma_m2 / Math.max(dAlma_m, 1e-9)) * nModular;
  const cNA = Math.max(0.005, (Math.sqrt(rhoN * rhoN + 2 * rhoN) - rhoN) * dAlma_m);
  const Icr0 = (1.0 * cNA ** 3) / 3 + nModular * AsAlma_m2 * (dAlma_m - cNA) ** 2;
  const ie = ieBranson(Ig0, Icr0, Mcr0, p.MaServ);
  const wAlma = (x: number) => {
    const depth = p.Hs - x;
    const wEarth = p.Ka * p.gammaRelleno * depth - 2 * p.c * Math.sqrt(Math.max(p.Ka, 0));
    const wWater = x <= p.hwStem ? p.gammaW * (p.hwStem - x) : 0;
    const wSur = p.Hs > 1e-9 ? p.PqStem / p.Hs : 0;
    return Math.max(0, wEarth) + wWater + wSur;
  };
  const tAlma = (x: number) => Math.max(0.05, p.F - (p.F - p.Bp) * (x / Math.max(p.Hs, 1e-9)));
  const { delta } = flechaVoladizo({
    L: p.Hs,
    Ec,
    w: wAlma,
    Ie: (x) => ie.ratio * ((1.0 * tAlma(x) ** 3) / 12),
  });
  const deltaAdm = p.Hs / 150;
  return {
    Ec_kgcm2,
    Ec,
    nModular,
    fr_kgcm2,
    fr,
    Ig0,
    Mcr0,
    Icr0,
    cNA,
    Ie0: ie.Ie,
    IeRatio: ie.ratio,
    raMcr: ie.ra,
    MaServ: p.MaServ,
    agrietada: ie.agrietada,
    deltaAlma: delta,
    deltaAlma_cm: delta * 100,
    deltaAdmAlma: deltaAdm,
    deltaAdmAlma_cm: deltaAdm * 100,
    okDeflexionAlma: delta <= deltaAdm + 1e-9,
  };
}
