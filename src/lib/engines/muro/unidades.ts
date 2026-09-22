/**
 * Sistema de unidades del expediente del muro.
 *
 * El motor calcula siempre en SI estructural (m, kN, kPa, kN·m, MPa, cm²) y
 * este módulo se ocupa de dos traducciones:
 *
 *  · de lo que escribe el usuario a las unidades internas (`i*`), y
 *  · de las unidades internas a lo que se imprime en la memoria (`f*`).
 *
 * Así el núcleo numérico no tiene ni una sola constante de conversión, y la
 * elección de unidades no puede alterar un resultado: solo su rótulo.
 *
 * Sistemas:
 *  · `tnf`      — Tnf, m, kg/cm² (el habitual en el Perú, por defecto)
 *  · `kn`       — kN, m, MPa (SI estricto del RNE)
 *  · `imperial` — kip, pie, pulgada, psi (ACI 318 en unidades inglesas)
 */

import { fmt } from "../../types";

export type Sistema = "tnf" | "kn" | "imperial";

export const SISTEMAS: { value: Sistema; label: string; desc: string }[] = [
  { value: "tnf", label: "Tnf · m · kg/cm²", desc: "Toneladas fuerza y metros; f'c y fy en kg/cm². Uso corriente en el Perú." },
  { value: "kn", label: "kN · m · MPa", desc: "SI estricto, tal como está escrito el RNE." },
  { value: "imperial", label: "kip · pie · pulg · psi", desc: "Unidades inglesas del ACI 318: kip, pie, pulgada y psi." },
];

/* ── Factores exactos (kN, m) por unidad de destino ── */
const KN_POR_TNF = 9.80665; // 1 Tnf = 1000 kgf · 9.80665 m/s²
const KN_POR_KIP = 4.4482216152605;
const M_POR_PIE = 0.3048;
const CM_POR_PULG = 2.54;
const MPA_POR_KGCM2 = 0.0980665;
const MPA_POR_PSI = 0.00689475729316836;

type Mag =
  | "L" // longitud
  | "Lc" // longitud corta: recubrimientos, separaciones
  | "F" // fuerza por metro de muro [F/L]
  | "P" // presión [F/L²]
  | "M" // momento por metro de muro [F·L/L]
  | "W" // peso específico [F/L³]
  | "K" // módulo de balasto [F/L³]
  | "Fc" // resistencia del material
  | "As"; // área de acero por metro

export type Unidades = {
  sis: Sistema;
  /** Rótulo de cada magnitud, para las etiquetas de los campos y las tablas. */
  u: Record<Mag, string>;

  /* ── Entrada: unidades del usuario → SI interno ── */
  iL: (x: number) => number;
  iLc: (x: number) => number;
  iF: (x: number) => number;
  iP: (x: number) => number;
  iW: (x: number) => number;
  iK: (x: number) => number;
  iFc: (x: number) => number;

  /* ── Salida: SI interno → unidades del usuario (valor desnudo) ── */
  L: (x: number) => number;
  Lc: (x: number) => number;
  F: (x: number) => number;
  P: (x: number) => number;
  M: (x: number) => number;
  W: (x: number) => number;
  K: (x: number) => number;
  Fc: (x: number) => number;
  As: (x: number) => number;

  /* ── Salida con rótulo, ya formateada ── */
  fL: (x: number, d?: number) => string;
  fLc: (x: number, d?: number) => string;
  fF: (x: number, d?: number) => string;
  fP: (x: number, d?: number) => string;
  fM: (x: number, d?: number) => string;
  fW: (x: number, d?: number) => string;
  fK: (x: number, d?: number) => string;
  fFc: (x: number, d?: number) => string;
  fAs: (x: number, d?: number) => string;
  /** Módulo de elasticidad: mismas unidades que f'c, sin decimales. */
  fE: (x: number) => string;
  /** Valor sin rótulo, con los decimales propios del sistema. */
  nL: (x: number, d?: number) => string;
  nF: (x: number, d?: number) => string;
  nP: (x: number, d?: number) => string;
  nM: (x: number, d?: number) => string;
  nAs: (x: number, d?: number) => string;
};

/**
 * Descriptor serializable para las figuras. Todas las conversiones son lineales,
 * así que con el rótulo y el factor de cada magnitud el croquis puede rotular en
 * las unidades elegidas sin arrastrar el módulo entero.
 */
export type UnidadesSerial = { sis: Sistema; u: Record<Mag, string>; k: Record<Mag, number> };

export function serializar(U: Unidades): UnidadesSerial {
  const mags: Mag[] = ["L", "Lc", "F", "P", "M", "W", "K", "Fc", "As"];
  const k = {} as Record<Mag, number>;
  for (const m of mags) k[m] = (U[m] as (x: number) => number)(1);
  return { sis: U.sis, u: U.u, k };
}

/** Formateador mínimo para los croquis, reconstruido desde el descriptor. */
export function desdeSerial(s: UnidadesSerial | undefined) {
  const def: UnidadesSerial = serializar(crearUnidades("tnf"));
  const d = s && s.u && s.k ? s : def;
  const dec: Record<Mag, number> = d.sis === "kn"
    ? { L: 2, Lc: 3, F: 1, P: 1, M: 1, W: 1, K: 0, Fc: 0, As: 2 }
    : d.sis === "imperial"
      ? { L: 2, Lc: 2, F: 2, P: 2, M: 2, W: 1, K: 1, Fc: 0, As: 3 }
      : { L: 2, Lc: 3, F: 2, P: 2, M: 2, W: 2, K: 0, Fc: 0, As: 2 };
  const con = (m: Mag) => (x: number, dd = dec[m]) => `${fmt(x * d.k[m], dd)} ${d.u[m]}`;
  const des = (m: Mag) => (x: number, dd = dec[m]) => fmt(x * d.k[m], dd);
  /**
   * Separación de barras. Se rotula como se replantea en obra: en centímetros
   * en los sistemas métricos y en pulgadas en el inglés, nunca en metros con
   * tres decimales, que es ilegible en un plano de despiece.
   */
  const fS = (cm: number) =>
    d.sis === "imperial"
      ? `${fmt(cm / 2.54, 1)}"`
      : `${fmt(cm, Math.abs(cm % 1) < 1e-9 ? 0 : 1)} cm`;
  return {
    sis: d.sis,
    u: d.u,
    fL: con("L"), fF: con("F"), fP: con("P"), fM: con("M"), fK: con("K"), fAs: con("As"),
    nL: des("L"), nF: des("F"), nP: des("P"), nM: des("M"), nAs: des("As"), nLc: des("Lc"),
    fS,
    vL: (x: number) => x * d.k.L, vF: (x: number) => x * d.k.F, vP: (x: number) => x * d.k.P, vM: (x: number) => x * d.k.M,
  };
}

/** Magnitud de cada campo de entrada que lleva unidades. El resto es adimensional. */
export const MAGNITUD_CAMPO: Record<string, Mag> = {
  hp: "L", hf: "L", ttop: "L", tbase: "L", Ltoe: "L", Lheel: "L", Df: "L",
  recFuste: "Lc", recZap: "Lc",
  esp1: "L", esp2: "L", esp3: "L", esp4: "L",
  gam1: "W", gam2: "W", gam3: "W", gam4: "W",
  gsat1: "W", gsat2: "W", gsat3: "W", gsat4: "W",
  coh1: "P", coh2: "P", coh3: "P", coh4: "P",
  nf: "L", gammaW: "W", q: "P",
  cBase: "P", adherencia: "P", qadm: "P", gammaFront: "W",
  ks: "K", ksh: "K",
  unaProf: "L", unaAncho: "L",
  Lpanel: "L",
  fc: "Fc", fy: "Fc", gammaC: "W",
};

/**
 * Convierte el valor de un campo entre dos sistemas, conservando el número de
 * cifras significativas útiles. Se usa cuando el usuario cambia de unidades:
 * los datos ya escritos tienen que seguir describiendo el mismo muro.
 */
export function convertirCampo(key: string, valor: number, de: Sistema, a: Sistema): number {
  const mag = MAGNITUD_CAMPO[key];
  if (!mag || de === a || !Number.isFinite(valor)) return valor;
  const U0 = crearUnidades(de);
  const U1 = crearUnidades(a);
  const si = { L: U0.iL, Lc: U0.iLc, F: U0.iF, P: U0.iP, M: U0.iP, W: U0.iW, K: U0.iK, Fc: U0.iFc, As: (x: number) => x }[mag](valor);
  const out = { L: U1.L, Lc: U1.Lc, F: U1.F, P: U1.P, M: U1.M, W: U1.W, K: U1.K, Fc: U1.Fc, As: U1.As }[mag](si);
  // Cuatro cifras significativas: bastan para un dato de entrada, evitan colas
  // como 1.8600000000000003 y hacen que la ida y vuelta entre sistemas devuelva
  // el mismo número con el que empezó.
  if (out === 0) return 0;
  const orden = Math.floor(Math.log10(Math.abs(out)));
  const p = Math.max(0, 4 - 1 - orden);
  return Number(out.toFixed(Math.min(6, p)));
}

/**
 * Rótulo de unidad que le corresponde a un campo en el sistema elegido. Los
 * campos del catálogo se escriben en Tnf·m y esta función los reetiqueta, de
 * modo que la ficha nunca pida «kN/m³» cuando el usuario está trabajando en
 * unidades inglesas.
 */
export function unidadCampo(key: string, sis: Sistema): string | undefined {
  const mag = MAGNITUD_CAMPO[key];
  if (!mag) return undefined;
  return crearUnidades(sis).u[mag];
}

/** Convierte de golpe todos los datos de una ficha entre dos sistemas. */
export function convertirFicha(
  valores: Record<string, string>,
  de: Sistema,
  a: Sistema,
): Record<string, string> {
  if (de === a) return valores;
  const out = { ...valores };
  for (const key of Object.keys(MAGNITUD_CAMPO)) {
    const s = String(valores[key] ?? "").trim().replace(",", ".");
    if (s === "") continue;
    const n = Number(s);
    if (!Number.isFinite(n)) continue;
    out[key] = String(convertirCampo(key, n, de, a));
  }
  return out;
}

export function crearUnidades(sis: Sistema): Unidades {
  const id = (x: number) => x;

  if (sis === "kn") {
    const u: Record<Mag, string> = {
      L: "m", Lc: "m", F: "kN/m", P: "kPa", M: "kN·m/m", W: "kN/m³", K: "kN/m³", Fc: "MPa", As: "cm²/m",
    };
    return armar(sis, u, {
      L: id, Lc: id, F: id, P: id, M: id, W: id, K: id, Fc: id, As: id,
      E: (x) => x / 1000, // kPa → MPa
    }, { L: 2, Lc: 3, F: 1, P: 1, M: 1, W: 1, K: 0, Fc: 0, As: 2 });
  }

  if (sis === "imperial") {
    const u: Record<Mag, string> = {
      L: "pie", Lc: "pulg", F: "kip/pie", P: "ksf", M: "kip·pie/pie", W: "pcf", K: "kcf", Fc: "psi", As: "pulg²/pie",
    };
    return armar(sis, u, {
      L: (x) => x / M_POR_PIE,
      Lc: (x) => (x * 100) / CM_POR_PULG,
      // kN/m → kip/pie: fuerza a kip y ancho de m a pie.
      F: (x) => (x / KN_POR_KIP) * M_POR_PIE,
      P: (x) => (x / KN_POR_KIP) * M_POR_PIE * M_POR_PIE,
      // kN·m/m → kip·pie/pie: el ancho se cancela, queda fuerza·longitud/longitud.
      M: (x) => x / KN_POR_KIP,
      W: (x) => (x / KN_POR_KIP) * M_POR_PIE ** 3 * 1000, // kip/pie³ → lb/pie³
      K: (x) => (x / KN_POR_KIP) * M_POR_PIE ** 3,
      Fc: (x) => x / MPA_POR_PSI,
      // cm²/m → pulg²/pie: área a pulgada cuadrada y ancho de metro a pie.
      As: (x) => (x / CM_POR_PULG ** 2) * M_POR_PIE,
      E: (x) => x / 1000 / MPA_POR_PSI,
    }, { L: 2, Lc: 2, F: 2, P: 2, M: 2, W: 1, K: 1, Fc: 0, As: 3 });
  }

  const u: Record<Mag, string> = {
    L: "m", Lc: "m", F: "Tnf/m", P: "Tnf/m²", M: "Tnf·m/m", W: "Tnf/m³", K: "Tnf/m³", Fc: "kg/cm²", As: "cm²/m",
  };
  return armar(sis, u, {
    L: id, Lc: id,
    F: (x) => x / KN_POR_TNF,
    P: (x) => x / KN_POR_TNF,
    M: (x) => x / KN_POR_TNF,
    W: (x) => x / KN_POR_TNF,
    K: (x) => x / KN_POR_TNF,
    Fc: (x) => x / MPA_POR_KGCM2,
    As: id,
    E: (x) => x / 1000 / MPA_POR_KGCM2,
  }, { L: 2, Lc: 3, F: 2, P: 2, M: 2, W: 2, K: 0, Fc: 0, As: 2 });
}

function armar(
  sis: Sistema,
  u: Record<Mag, string>,
  k: Record<Mag | "E", (x: number) => number>,
  dec: Record<Mag, number>,
): Unidades {
  const inv = (m: Mag) => (x: number) => {
    // Las conversiones son lineales: basta dividir por la imagen de la unidad.
    const uno = k[m](1);
    return Math.abs(uno) < 1e-300 ? x : x / uno;
  };
  const con = (m: Mag) => (x: number, d = dec[m]) => `${fmt(k[m](x), d)} ${u[m]}`;
  const des = (m: Mag) => (x: number, d = dec[m]) => fmt(k[m](x), d);

  return {
    sis,
    u,
    iL: inv("L"), iLc: inv("Lc"), iF: inv("F"), iP: inv("P"), iW: inv("W"), iK: inv("K"), iFc: inv("Fc"),
    L: k.L, Lc: k.Lc, F: k.F, P: k.P, M: k.M, W: k.W, K: k.K, Fc: k.Fc, As: k.As,
    fL: con("L"), fLc: con("Lc"), fF: con("F"), fP: con("P"), fM: con("M"), fW: con("W"), fK: con("K"),
    fFc: con("Fc"), fAs: con("As"),
    fE: (x) => `${fmt(k.E(x), 0)} ${u.Fc}`,
    nL: des("L"), nF: des("F"), nP: des("P"), nM: des("M"), nAs: des("As"),
  };
}
