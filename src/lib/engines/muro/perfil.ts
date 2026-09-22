/**
 * Perfil geotécnico del relleno y empujes laterales sobre el muro.
 *
 * Unidades SI coherentes: longitudes en m, pesos específicos en kN/m³,
 * presiones en kPa, empujes en kN por metro de muro.
 *
 * Referencias: RNE E.050 §39.13 · Das, "Principios de ingeniería de
 * cimentaciones" cap. 7 y §13.6 · Morales, "Diseño en concreto armado" cap. 13.
 */

export const rad = (g: number) => (g * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;

export type Estrato = {
  nombre: string;
  espesor: number;
  /** Peso específico natural (kN/m³). */
  gamma: number;
  /** Peso específico saturado (kN/m³). */
  gammaSat: number;
  /** Ángulo de fricción interna (°). */
  phi: number;
  /** Cohesión (kPa). */
  c: number;
};

export type CondicionMuro = "activo" | "reposo";
export type MetodoK = "rankine" | "coulomb";

export type PerfilInput = {
  estratos: Estrato[];
  /** Altura de empuje: corona → fondo de zapata (m). */
  H: number;
  /** Profundidad del nivel freático desde la corona (m). ≥ H equivale a "sin NF". */
  nf: number;
  gammaW: number;
  /** Sobrecarga uniforme sobre el relleno (kPa). */
  q: number;
  condicion: CondicionMuro;
  /** Talud del relleno (°). */
  i: number;
  /** Fricción muro–suelo δ (°); 0 para Rankine consistente. */
  delta: number;
  metodoK: MetodoK;
};

/** Rankine activo con relleno inclinado (Das ec. 7.29). Con i = 0 se reduce a tan²(45−φ/2). */
export function kaRankine(phi: number, i: number) {
  const ci = Math.cos(rad(i));
  const cp = Math.cos(rad(phi));
  const r = ci * ci - cp * cp;
  if (r <= 0) return Number.NaN; // talud mayor que el ángulo de reposo
  const s = Math.sqrt(r);
  return (ci * (ci - s)) / (ci + s);
}

/** Coulomb activo para muro de cara vertical (Das ec. 7.44). */
export function kaCoulomb(phi: number, delta: number, i: number) {
  const p = rad(phi);
  const d = rad(delta);
  const b = rad(i);
  const num = Math.cos(p) ** 2;
  const raiz = Math.sqrt(
    Math.max(0, (Math.sin(p + d) * Math.sin(p - b)) / (Math.cos(d) * Math.cos(b))),
  );
  const den = Math.cos(d) * (1 + raiz) ** 2;
  return num / den;
}

/** Reposo de Jaky. */
export function k0Jaky(phi: number, i: number) {
  return (1 - Math.sin(rad(phi))) * (1 + Math.sin(rad(i)));
}

/** Rankine pasivo (relleno horizontal delante de la puntera). */
export function kpRankine(phi: number) {
  return Math.tan(rad(45 + phi / 2)) ** 2;
}

/**
 * Coeficiente sísmico activo de Mononobe–Okabe (Das ec. 7.65), extensión
 * pseudo-estática de Coulomb con muro de cara vertical.
 */
export function kaeMononobeOkabe(
  phi: number,
  delta: number,
  i: number,
  kh: number,
  kv: number,
) {
  const theta = Math.atan(kh / Math.max(1e-9, 1 - kv));
  const p = rad(phi);
  const d = rad(delta);
  const b = rad(i);
  if (deg(theta) + i >= phi) return { Kae: Number.NaN, theta: deg(theta) };
  const num = Math.cos(p - theta) ** 2;
  const raiz = Math.sqrt(
    Math.max(
      0,
      (Math.sin(p + d) * Math.sin(p - theta - b)) / (Math.cos(d + theta) * Math.cos(b)),
    ),
  );
  const den = Math.cos(theta) * Math.cos(d + theta) * (1 + raiz) ** 2;
  return { Kae: num / den, theta: deg(theta) };
}

export type PuntoPerfil = {
  /** Profundidad desde la corona (m). */
  z: number;
  /** Estrato al que pertenece. */
  capa: number;
  /** Esfuerzo vertical efectivo (kPa). */
  sv: number;
  /** Coeficiente de empuje aplicado. */
  K: number;
  /** Empuje horizontal efectivo del suelo (kPa, ≥ 0). */
  sh: number;
  /** Presión de poros (kPa). */
  u: number;
  /** Presión lateral total (kPa). */
  p: number;
};

export type Perfil = {
  puntos: PuntoPerfil[];
  /** Empuje estático total (kN/m) y su punto de aplicación desde el fondo. */
  E: number;
  Eh: number;
  Ev: number;
  ybar: number;
  /** Componente de agua del empuje (kN/m). */
  Eu: number;
  /** Subpresión bajo la zapata si hay NF (kPa en el fondo). */
  uFondo: number;
  pMax: number;
  /** Inclinación de la resultante respecto a la horizontal (°). */
  inclinacion: number;
  advertencias: string[];
};

/** K de cada estrato según método y condición del muro. */
export function coefK(e: Estrato, inp: PerfilInput) {
  if (inp.condicion === "reposo") return k0Jaky(e.phi, inp.i);
  return inp.metodoK === "coulomb"
    ? kaCoulomb(e.phi, inp.delta, inp.i)
    : kaRankine(e.phi, inp.i);
}

const NSAMPLE = 240;

/**
 * Integra el perfil de presiones laterales. El perfil resultante es
 * discontinuo en los contactos entre estratos (cada uno con su K y su peso),
 * por eso se muestrea con paso fino y se integra por trapecios sobre tramos
 * que no cruzan un contacto.
 */
export function construirPerfil(inp: PerfilInput): Perfil {
  const { H, nf, gammaW, q } = inp;
  const advertencias: string[] = [];

  // Espesores acumulados; el último estrato se estira si el perfil no cubre H.
  const capas = inp.estratos.filter((e) => e.espesor > 1e-6);
  if (!capas.length) {
    return {
      puntos: [], E: 0, Eh: 0, Ev: 0, ybar: 0, Eu: 0, uFondo: 0, pMax: 0,
      inclinacion: 0, advertencias: ["No hay estratos definidos."],
    };
  }
  const total = capas.reduce((a, e) => a + e.espesor, 0);
  if (total < H - 1e-6) {
    advertencias.push(
      `El perfil cubre ${total.toFixed(2)} m y la altura de empuje es ${H.toFixed(2)} m: el último estrato se prolonga hasta el fondo.`,
    );
  }
  const limites: number[] = [];
  let acc = 0;
  for (const e of capas) {
    acc += e.espesor;
    limites.push(acc);
  }
  limites[limites.length - 1] = Math.max(limites[limites.length - 1], H);

  const capaDe = (z: number) => {
    for (let i = 0; i < limites.length; i++) if (z <= limites[i] + 1e-9) return i;
    return limites.length - 1;
  };

  const Ks = capas.map((e) => coefK(e, inp));
  Ks.forEach((k, idx) => {
    if (!Number.isFinite(k)) {
      advertencias.push(
        `Estrato ${idx + 1}: el talud i = ${inp.i}° supera φ = ${capas[idx].phi}°, Rankine no tiene solución. Reduce el talud o usa Coulomb.`,
      );
    }
  });

  // Puntos de muestreo: contactos duplicados (salto de K) + NF + paso uniforme.
  const zs = new Set<number>([0, H]);
  for (const l of limites) if (l > 1e-9 && l < H - 1e-9) { zs.add(l - 1e-7); zs.add(l + 1e-7); }
  if (nf > 1e-9 && nf < H - 1e-9) { zs.add(nf - 1e-7); zs.add(nf + 1e-7); }
  for (let i = 0; i <= NSAMPLE; i++) zs.add((H * i) / NSAMPLE);
  const zOrden = [...zs].filter((z) => z >= 0 && z <= H).sort((a, b) => a - b);

  // Esfuerzo vertical efectivo acumulado.
  const puntos: PuntoPerfil[] = [];
  let sv = q;
  let zPrev = 0;
  for (const z of zOrden) {
    const dz = z - zPrev;
    if (dz > 0) {
      const zm = (zPrev + z) / 2;
      const cap = capas[capaDe(zm)];
      const sumergido = zm > nf;
      const gEf = sumergido ? cap.gammaSat - gammaW : cap.gamma;
      sv += gEf * dz;
      zPrev = z;
    }
    const ic = capaDe(z);
    const cap = capas[ic];
    const K = Ks[ic];
    const shBruto = Number.isFinite(K) ? K * sv - 2 * cap.c * Math.sqrt(Math.max(K, 0)) : 0;
    const sh = Math.max(0, shBruto);
    const u = z > nf ? gammaW * (z - nf) : 0;
    puntos.push({ z, capa: ic, sv, K: Number.isFinite(K) ? K : 0, sh, u, p: sh + u });
  }

  // Integración por trapecios (los saltos quedan capturados por los pares de puntos).
  let E = 0;
  let Mfondo = 0;
  let Eu = 0;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    const dz = b.z - a.z;
    if (dz <= 0) continue;
    const dE = ((a.p + b.p) / 2) * dz;
    // Brazo del trapecio respecto al fondo.
    const yA = H - a.z;
    const yB = H - b.z;
    const denom = a.p + b.p;
    const yc = denom > 1e-12 ? (yA * (2 * a.p + b.p) + yB * (a.p + 2 * b.p)) / (3 * denom) : (yA + yB) / 2;
    E += dE;
    Mfondo += dE * yc;
    Eu += ((a.u + b.u) / 2) * dz;
  }
  const ybar = E > 1e-9 ? Mfondo / E : H / 3;

  // Dirección de la resultante: Rankine inclinado sigue el talud; Coulomb, δ.
  const incl = inp.condicion === "reposo" ? 0 : inp.metodoK === "coulomb" ? inp.delta : inp.i;
  // El agua siempre empuja horizontal.
  const Esuelo = E - Eu;
  const Eh = Esuelo * Math.cos(rad(incl)) + Eu;
  const Ev = Esuelo * Math.sin(rad(incl));

  return {
    puntos,
    E,
    Eh,
    Ev,
    ybar,
    Eu,
    uFondo: H > nf ? gammaW * (H - nf) : 0,
    pMax: Math.max(...puntos.map((p) => p.p), 0),
    inclinacion: incl,
    advertencias,
  };
}

export type SismoInput = {
  metodo: "simplificado" | "mononobe";
  kh: number;
  kv: number;
  /** Peso específico representativo del relleno (kN/m³). */
  gammaEq: number;
  H: number;
  phiEq: number;
  delta: number;
  i: number;
  /** Empuje activo estático de suelo (sin agua), para el caso M-O completo. */
  Ea: number;
  Ka: number;
};

export type Sismo = {
  /** Incremento dinámico del empuje (kN/m). */
  dPae: number;
  /** Altura de aplicación desde el fondo (m). */
  y: number;
  /** Presión en la corona y en el fondo del trapecio equivalente (kPa). */
  pTop: number;
  pBot: number;
  Kae: number;
  theta: number;
  formula: string;
  advertencias: string[];
};

/**
 * Incremento dinámico del empuje.
 *
 * - "simplificado": ΔPae = ⅜·kh·γ·H² aplicado a 0.6H del fondo
 *   [E.050 §39.13.4 · Das ec. 6.35]. Es el criterio del RNE.
 * - "mononobe": ΔPae = ½γH²(Kae − Ka)(1 − kv), también a 0.6H [Seed & Whitman].
 *
 * La distribución equivalente es un trapecio con la resultante en 0.6H, lo que
 * exige p_fondo = 0.25·p_corona y p_corona = 1.6·ΔPae/H.
 */
export function calcularSismo(inp: SismoInput): Sismo {
  const advertencias: string[] = [];
  let dPae: number;
  let Kae = Number.NaN;
  let theta = deg(Math.atan(inp.kh / Math.max(1e-9, 1 - inp.kv)));
  let formula: string;

  if (inp.metodo === "mononobe") {
    const mo = kaeMononobeOkabe(inp.phiEq, inp.delta, inp.i, inp.kh, inp.kv);
    Kae = mo.Kae;
    theta = mo.theta;
    if (!Number.isFinite(Kae)) {
      advertencias.push(
        `Mononobe–Okabe sin solución: φ = ${inp.phiEq.toFixed(1)}° no supera θ + i = ${(theta + inp.i).toFixed(1)}°. Se usa el criterio simplificado de la E.050.`,
      );
      dPae = 0.375 * inp.kh * inp.gammaEq * inp.H ** 2;
      formula = "simplificado";
    } else {
      dPae = Math.max(
        0,
        0.5 * inp.gammaEq * inp.H ** 2 * (Kae - inp.Ka) * (1 - inp.kv),
      );
      formula = "mononobe";
    }
  } else {
    dPae = 0.375 * inp.kh * inp.gammaEq * inp.H ** 2;
    formula = "simplificado";
  }

  const y = 0.6 * inp.H;
  const pTop = inp.H > 1e-9 ? (1.6 * dPae) / inp.H : 0;
  return { dPae, y, pTop, pBot: 0.25 * pTop, Kae, theta, formula, advertencias };
}

/** Presión del incremento sísmico a la profundidad z (desde la corona). */
export function presionSismo(s: Sismo, z: number, H: number) {
  if (H <= 1e-9) return 0;
  const t = Math.min(Math.max(z / H, 0), 1);
  return s.pTop + (s.pBot - s.pTop) * t;
}

/** Presión lateral estática total a la profundidad z, interpolada del perfil. */
export function presionEstatica(perfil: Perfil, z: number) {
  const pts = perfil.puntos;
  if (!pts.length) return 0;
  if (z <= pts[0].z) return pts[0].p;
  if (z >= pts[pts.length - 1].z) return pts[pts.length - 1].p;
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].z <= z) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const dz = b.z - a.z;
  return dz < 1e-12 ? b.p : a.p + ((b.p - a.p) * (z - a.z)) / dz;
}

/** Esfuerzo vertical total del relleno a la profundidad z (para cargar el talón). */
export function verticalTotal(inp: PerfilInput, z: number) {
  const capas = inp.estratos.filter((e) => e.espesor > 1e-6);
  if (!capas.length) return inp.q;
  let sv = inp.q;
  let zz = 0;
  let idx = 0;
  let restante = capas[0].espesor;
  while (zz < z - 1e-12) {
    const paso = Math.min(z - zz, restante);
    const zm = zz + paso / 2;
    const cap = capas[Math.min(idx, capas.length - 1)];
    sv += (zm > inp.nf ? cap.gammaSat : cap.gamma) * paso;
    zz += paso;
    restante -= paso;
    if (restante <= 1e-12 && idx < capas.length - 1) {
      idx++;
      restante = capas[idx].espesor;
    } else if (restante <= 1e-12) {
      restante = Infinity;
    }
  }
  return sv;
}
