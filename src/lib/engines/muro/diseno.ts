/**
 * Diseño de secciones de concreto armado del muro, franja de 1.00 m, en
 * unidades SI de la E.060 (f'c y fy en MPa, M en kN·m/m, V en kN/m).
 *
 * E.060 §9.3.2 (φ), §10.3.4 y §10.5 (cuantías), (10-3) As mín de flexión,
 * (11-3) Vc, §11.3 (cortante sin estribos), Tabla 12.1 (longitud de desarrollo),
 * §14.3 (refuerzo mínimo de muros) y §7.10/§7.6 (separaciones).
 */

import { BARS, MALLA_MURO, barByName, type BarDef } from "../../types";

export const PHI_FLEXION = 0.9;
export const PHI_CORTE = 0.85;

/** β₁ de la E.060 §10.2.7.3 con f'c en MPa. */
export function beta1MPa(fcMPa: number) {
  if (fcMPa <= 28) return 0.85;
  return Math.max(0.65, 0.85 - (0.05 * (fcMPa - 28)) / 7);
}

/** Módulo de elasticidad del concreto en kPa (E.060 §8.5.1: 4700√f'c MPa). */
export function EcKPa(fcMPa: number) {
  return 4700 * Math.sqrt(fcMPa) * 1000;
}

export type DisenoFranja = {
  /** Espesor total y canto útil (m). */
  h: number;
  d: number;
  bar: BarDef;
  /** Acero requerido y provisto (cm²/m). */
  As: number;
  AsMin: number;
  AsMax: number;
  AsProv: number;
  /** Separación adoptada y máxima admisible (cm). */
  s: number;
  sMax: number;
  rho: number;
  a: number;
  /** Resistencias (kN·m/m y kN/m). */
  phiMn: number;
  phiVc: number;
  Mu: number;
  Vu: number;
  okM: boolean;
  okV: boolean;
  rigeMin: boolean;
  /** Longitud de desarrollo en tracción (m). */
  ld: number;
  texto: string;
};

const SEPARACIONES = [30, 27.5, 25, 22.5, 20, 17.5, 15, 12.5, 10, 8, 7.5];

/**
 * Separaciones constructivas en pulgadas, expresadas en cm: cuando el
 * expediente se emite en unidades inglesas el plano tiene que poder replantearse
 * con una cinta en pulgadas, no con un 22.5 cm convertido.
 */
export const SEPARACIONES_PULG = [16, 15, 14, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((x) => x * 2.54);

/** Redondea la separación a un valor constructivo que no supere el calculado. */
export function separacionComercial(sCalc: number, sMax: number, lista = SEPARACIONES) {
  const lim = Math.min(sCalc, sMax);
  return lista.find((x) => x <= lim + 1e-9) ?? lista[lista.length - 1];
}

export type FranjaInput = {
  /** Espesor de la sección (m). */
  h: number;
  /** Recubrimiento libre (m). */
  rec: number;
  /** Momento y cortante últimos (kN·m/m, kN/m). */
  Mu: number;
  Vu: number;
  fc: number;
  fy: number;
  bar: BarDef;
  /** Separación máxima por norma (cm). */
  sMax?: number;
  /** Cuantía mínima de retracción y temperatura si no rige la de flexión. */
  rhoMinTemp?: number;
  /** Diámetro de la malla perpendicular que queda por fuera (m). */
  dbPerp?: number;
  /** Separaciones constructivas admisibles, en cm y de mayor a menor. */
  separaciones?: number[];
  /** Rótulo de la separación: permite emitir el plano en pulgadas. */
  rotularS?: (cm: number) => string;
};

/**
 * Menor barra y mayor separación de la lista constructiva que cubren As.
 * Es `elegirMalla` de la librería, pero con la lista de separaciones del
 * sistema de unidades elegido.
 */
export function elegirMallaCon(AsReq: number, sMax: number, seps = SEPARACIONES) {
  const need = Math.max(AsReq, 1e-9);
  const spaces = seps.filter((s) => s <= sMax + 1e-9);
  const lista = MALLA_MURO.map((n) => barByName(n));
  for (const bar of lista) {
    for (const s of spaces) {
      const AsProv = (bar.as / s) * 100;
      if (AsProv + 1e-6 >= need) return { bar, s, AsProv };
    }
  }
  const bar = lista[lista.length - 1];
  const s = spaces[spaces.length - 1] ?? seps[seps.length - 1];
  return { bar, s, AsProv: (bar.as / s) * 100 };
}

/** Diseño a flexión y cortante de una franja de 1.00 m. */
export function disenarFranja(inp: FranjaInput): DisenoFranja {
  const b = 1.0;
  const h = inp.h;
  const sMax = inp.sMax ?? Math.min(45, 3 * h * 100);
  const seps = inp.separaciones ?? SEPARACIONES;
  const rotS = inp.rotularS ?? ((cm: number) => `${cm.toFixed(cm % 1 === 0 ? 0 : 1)} cm`);

  const seccion = (bar: BarDef) => {
    const d = Math.max(h - inp.rec - (inp.dbPerp ?? 0) - bar.db / 200, 0.05);
    const Mn = Math.max(inp.Mu, 0) / PHI_FLEXION;
    let As = 0;
    for (let i = 0; i < 40; i++) {
      const a = (As * inp.fy) / (0.85 * inp.fc * b);
      const brazo = Math.max(d - a / 2, 1e-4);
      const nuevo = Mn / (inp.fy * 1000 * brazo);
      if (Math.abs(nuevo - As) < 1e-9) {
        As = nuevo;
        break;
      }
      As = nuevo;
    }
    const Ascm = As * 1e4;
    const AsMinFlex = ((0.22 * Math.sqrt(inp.fc)) / inp.fy) * b * d * 1e4;
    const AsMinTemp = (inp.rhoMinTemp ?? 0) * h * 1e4;
    const AsMin = Math.max(AsMinFlex, AsMinTemp);
    const rhoB = ((0.85 * beta1MPa(inp.fc) * inp.fc) / inp.fy) * (600 / (600 + inp.fy));
    const AsMax = 0.75 * rhoB * b * d * 1e4;
    const Asdis = Math.min(Math.max(Ascm, AsMin), Math.max(AsMax, AsMin));
    return { d, Ascm, AsMin, AsMax, Asdis, rigeMin: Ascm < AsMin };
  };

  let bar = inp.bar;
  let sec = seccion(bar);
  const sHint = separacionComercial((bar.as / Math.max(sec.Asdis, 1e-6)) * 100, sMax, seps);
  if ((bar.as / sHint) * 100 + 1e-6 < sec.Asdis) {
    bar = elegirMallaCon(sec.Asdis, sMax, seps).bar;
    sec = seccion(bar);
  }
  const malla = elegirMallaCon(sec.Asdis, sMax, seps);
  const sTry = separacionComercial((bar.as / Math.max(sec.Asdis, 1e-6)) * 100, sMax, seps);
  const adopt = (bar.as / sTry) * 100 + 1e-6 >= sec.Asdis
    ? { bar, s: sTry, AsProv: (bar.as / sTry) * 100 }
    : malla;
  bar = adopt.bar;
  sec = seccion(bar);
  const s = adopt.s;
  const AsProv = adopt.AsProv;

  const aProv = ((AsProv * 1e-4) * inp.fy) / (0.85 * inp.fc * b);
  const phiMn = PHI_FLEXION * AsProv * 1e-4 * inp.fy * 1000 * (sec.d - aProv / 2);
  const Vc = 0.17 * Math.sqrt(inp.fc) * b * sec.d * 1000;
  const phiVc = PHI_CORTE * Vc;

  return {
    h,
    d: sec.d,
    bar,
    As: sec.Ascm,
    AsMin: sec.AsMin,
    AsMax: sec.AsMax,
    AsProv,
    s,
    sMax,
    rho: AsProv / (b * sec.d * 1e4),
    a: aProv,
    phiMn,
    phiVc,
    Mu: inp.Mu,
    Vu: inp.Vu,
    okM: phiMn + 1e-6 >= inp.Mu && AsProv + 1e-6 >= sec.Asdis,
    okV: phiVc + 1e-6 >= inp.Vu,
    rigeMin: sec.rigeMin,
    ld: longitudDesarrollo(bar, inp.fc, inp.fy),
    texto: `Ø ${bar.name} @ ${rotS(s)}`,
  };
}

/**
 * Longitud de desarrollo en tracción, E.060 §12.2.2 Tabla 12.1 para barras
 * inferiores con separación ≥ 2db y recubrimiento ≥ db (caso general):
 * ℓd/db = fy·ψt·ψe·λ / (2.1·√f'c) en MPa. Mínimo 300 mm.
 */
export function longitudDesarrollo(bar: BarDef, fc: number, fy: number, psi = 1) {
  const db = bar.db / 100; // m
  const grande = bar.db >= 2.0; // Ø ≥ 3/4" usa el coeficiente mayor
  const coef = grande ? 1.7 : 2.1;
  const ld = ((fy * psi) / (coef * Math.sqrt(fc))) * db;
  return Math.max(ld, 0.3);
}

/** Módulo de elasticidad del acero de refuerzo (MPa), E.060 §8.5.2. */
export const ES_MPA = 200000;

/** Módulo de rotura del concreto en MPa, E.060 §9.5.2.3: fr = 0.62·√f'c. */
export function frMPa(fcMPa: number) {
  return 0.62 * Math.sqrt(fcMPa);
}

/**
 * Inercia bruta y agrietada de una franja de 1.00 m con armadura en una cara,
 * por sección transformada. Devuelve todo en m⁴/m.
 */
export function inerciasFranja(h: number, d: number, AsCm2: number, EcKPaVal: number) {
  const b = 1.0;
  const Ig = (b * h ** 3) / 12;
  const As = AsCm2 * 1e-4;
  const n = ES_MPA / (EcKPaVal / 1000);
  // Eje neutro de la sección fisurada: b·kd²/2 = n·As·(d − kd).
  const kd = (-n * As + Math.sqrt((n * As) ** 2 + 2 * b * n * As * d)) / b;
  const Icr = (b * kd ** 3) / 3 + n * As * (d - kd) ** 2;
  return { Ig, Icr, n, kd };
}

/**
 * Inercia efectiva de Branson, E.060 §9.6.2.3:
 * Ie = Icr + (Ig − Icr)·(Mcr/Ma)³, acotada a Ig cuando la sección no fisura.
 */
export function inerciaEfectiva(Ig: number, Icr: number, Mcr: number, Ma: number) {
  if (Ma <= Mcr || Ma <= 1e-9) return Ig;
  return Math.min(Ig, Icr + (Ig - Icr) * (Mcr / Ma) ** 3);
}

/**
 * Geometría de anclaje de una barra, con todo lo que hace falta para dibujar y
 * acotar el despiece.
 *
 * E.060 §7.1 (ganchos estándar), §7.2.1 (diámetros mínimos de doblado),
 * §12.5 (desarrollo del gancho en tracción), §12.3 (desarrollo en compresión)
 * y §12.15.1 (traslapes).
 */
export type Anclaje = {
  /** Diámetro de la barra (m). */
  db: number;
  /** Diámetro interior de doblado (m): 6db hasta Ø 1", 8db por encima. */
  Dbend: number;
  /** Extensión recta del gancho a 90°: 12db. */
  ext90: number;
  /** Extensión recta del gancho a 180°: 4db y no menos de 65 mm. */
  ext180: number;
  /** Longitud desarrollada del arco de 90°, medida en el eje de la barra. */
  arco90: number;
  /** Longitud de desarrollo en tracción con gancho estándar (m). */
  ldh: number;
  /** Longitud de desarrollo en tracción, barra recta (m). */
  ld: number;
  /** Longitud de desarrollo en compresión (m). */
  ldc: number;
  /** Traslape en tracción clase B (m). */
  traslape: number;
};

export function anclaje(bar: BarDef, fc: number, fy: number, psi = 1): Anclaje {
  const db = bar.db / 100; // cm → m
  const Dbend = (bar.db >= 2.9 ? 8 : 6) * db; // E.060 7.2.1
  const ext90 = 12 * db; // E.060 7.1.1
  const ext180 = Math.max(4 * db, 0.065); // E.060 7.1.2
  const arco90 = (Math.PI / 2) * (Dbend / 2 + db / 2);
  // E.060 12.5.2: ldh = 100·db/√f'c para fy = 420 MPa, escalado con fy.
  const ldh = Math.max(((fy / 420) * 100 * db) / Math.sqrt(fc), 8 * db, 0.15);
  // E.060 12.3.2: ldc = 0.24·fy·db/√f'c, y no menos de 0.043·fy·db ni de 200 mm.
  const ldc = Math.max((0.24 * fy * db) / Math.sqrt(fc), 0.043 * fy * db, 0.2);
  const ld = longitudDesarrollo(bar, fc, fy, psi);
  return { db, Dbend, ext90, ext180, arco90, ldh, ld, ldc, traslape: Math.max(1.3 * ld, 0.3) };
}

/** Elige el menor diámetro comercial que permita una separación ≥ sMin. */
export function elegirBarra(AsReq: number, sMin = 10, sMax = 30, desde = 0): BarDef {
  const lista = BARS.slice(desde);
  for (const b of lista) {
    const s = (b.as / Math.max(AsReq, 1e-6)) * 100;
    if (s >= sMin && s <= sMax + 1e-9) return b;
  }
  // Si ninguno entra en el rango, usa el que dé la separación más cercana a sMax.
  return lista.reduce((best, b) => {
    const s = (b.as / Math.max(AsReq, 1e-6)) * 100;
    const sb = (best.as / Math.max(AsReq, 1e-6)) * 100;
    return Math.abs(s - sMax) < Math.abs(sb - sMax) ? b : best;
  }, lista[0]);
}
