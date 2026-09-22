/**
 * Estabilidad externa del muro: deslizamiento, volteo, excentricidad y presión
 * de contacto, en condición estática y pseudo-dinámica.
 *
 * RNE E.050 §39.13.6 (FS mínimos: 1.50 estático y 1.25 pseudo-dinámico; q ≤
 * q_adm estático y ≤ 1.25·q_adm con sismo) · Das cap. 7 ec. 7.11, 7.2 y 7.9 ·
 * Morales cap. 13 §2.3. Los momentos se toman respecto a la arista de la
 * puntera y las cargas son de servicio, sin amplificar.
 */

import { kpRankine, rad, type Perfil, type Sismo } from "./perfil";
import { alturaTotal, anchoZapata, type MuroGeom } from "./fem";

export type Bloque = {
  n: number;
  nombre: string;
  tipo: "concreto" | "suelo" | "sobrecarga";
  /** Peso por metro de muro (kN/m). */
  W: number;
  /** Brazo al eje de la puntera (m). */
  x: number;
  /** Altura del centro de gravedad sobre el fondo de la zapata (m). */
  y: number;
};

export type EstabilidadInput = {
  geom: MuroGeom;
  perfil: Perfil;
  sismo: Sismo;
  gammaC: number;
  /** Peso específico del relleno sobre el talón (kN/m³) y sobre la puntera. */
  gammaRelleno: number;
  gammaFront: number;
  /** Sobrecarga (kPa). */
  q: number;
  /** Suelo de cimentación. */
  phiBase: number;
  cBase: number;
  /** Fricción de contacto δ (°) y adherencia c_b (kPa). */
  deltaBase: number;
  adherencia: number;
  /** Capacidad admisible (kPa). */
  qadm: number;
  kh: number;
  kv: number;
  /** Incluir el relleno sobre el talón en la masa inercial del muro. */
  inerciaRelleno: boolean;
  inerciaSobrecarga: boolean;
  /** Uña de cimentación. */
  unaProf: number;
  unaAncho: number;
  /** Considerar el empuje pasivo delante de la puntera. */
  usarPasivo: boolean;
  /** Factor de reducción del pasivo (movilización parcial). */
  factorPasivo: number;
  fsDeslMin: number;
  fsVoltMin: number;
  fsDeslSisMin: number;
  fsVoltSisMin: number;
};

export type Estabilidad = {
  bloques: Bloque[];
  /** Resultantes verticales (kN/m). */
  sumaW: number;
  Ev: number;
  U: number;
  N: number;
  Ns: number;
  /** Momentos respecto a la puntera (kN·m/m). */
  Mr: number;
  Mo: number;
  Mrs: number;
  Mos: number;
  /** Fuerzas horizontales (kN/m). */
  Eh: number;
  /** Brazo del empuje estático sobre el fondo de la zapata (m). */
  yEh: number;
  dPae: number;
  /** Brazo del incremento sísmico (0.6H). */
  ySismo: number;
  Fi: number;
  yFi: number;
  Ep: number;
  /** Factores de seguridad. */
  fsDesl: number;
  fsVolt: number;
  fsDeslSis: number;
  fsVoltSis: number;
  /** Excentricidad y presiones (m, kPa). */
  e: number;
  es: number;
  q1: number;
  q2: number;
  qMax: number;
  qMaxSis: number;
  tercioCentral: boolean;
  tercioCentralSis: boolean;
  /** Ancho comprimido efectivo con sismo (m). */
  Bcomp: number;
  B: number;
  H: number;
  Kp: number;
  advertencias: string[];
};

export function calcularEstabilidad(inp: EstabilidadInput): Estabilidad {
  const g = inp.geom;
  const B = anchoZapata(g);
  const H = alturaTotal(g);
  const advertencias: string[] = [];

  // Bloques de peso, numerados como en el esquema.
  const bloques: Bloque[] = [];
  const areaFuste = ((g.ttop + g.tbase) / 2) * g.hp;
  // Centroide del trapecio del fuste (cara frontal vertical en x = L_toe).
  const xFuste =
    g.Ltoe +
    (g.tbase * g.tbase + g.tbase * g.ttop + g.ttop * g.ttop) / (3 * (g.tbase + g.ttop));
  const yFuste =
    g.hf + (g.hp * (g.tbase + 2 * g.ttop)) / (3 * (g.tbase + g.ttop));

  bloques.push({ n: 1, nombre: "Fuste", tipo: "concreto", W: areaFuste * inp.gammaC, x: xFuste, y: yFuste });
  bloques.push({ n: 2, nombre: "Zapata", tipo: "concreto", W: B * g.hf * inp.gammaC, x: B / 2, y: g.hf / 2 });
  bloques.push({
    n: 3,
    nombre: "Relleno sobre el talón",
    tipo: "suelo",
    W: g.Lheel * g.hp * inp.gammaRelleno,
    x: g.Ltoe + g.tbase + g.Lheel / 2,
    y: g.hf + g.hp / 2,
  });
  const hFrontal = Math.max(0, g.Df - g.hf);
  if (hFrontal > 1e-6 && g.Ltoe > 1e-6) {
    bloques.push({
      n: 4,
      nombre: "Suelo sobre la puntera",
      tipo: "suelo",
      W: g.Ltoe * hFrontal * inp.gammaFront,
      x: g.Ltoe / 2,
      y: g.hf + hFrontal / 2,
    });
  }
  if (inp.q > 1e-9 && g.Lheel > 1e-6) {
    bloques.push({
      n: bloques.length + 1,
      nombre: "Sobrecarga sobre el talón",
      tipo: "sobrecarga",
      W: inp.q * g.Lheel,
      x: g.Ltoe + g.tbase + g.Lheel / 2,
      y: g.hf + g.hp,
    });
  }
  if (inp.unaProf > 1e-6 && inp.unaAncho > 1e-6) {
    bloques.push({
      n: bloques.length + 1,
      nombre: "Uña de cimentación",
      tipo: "concreto",
      W: inp.unaProf * inp.unaAncho * inp.gammaC,
      x: inp.unaAncho / 2,
      y: -inp.unaProf / 2,
    });
  }

  const sumaW = bloques.reduce((a, b) => a + b.W, 0);
  const Ev = inp.perfil.Ev;
  const U = inp.perfil.uFondo > 1e-9 ? (inp.perfil.uFondo * B) / 2 : 0;
  const N = sumaW + Ev - U;

  const Eh = inp.perfil.Eh;
  const yE = inp.perfil.ybar;
  const dPae = inp.sismo.dPae;
  const yS = inp.sismo.y;

  // Inercia sísmica del muro. Por defecto solo el concreto: la inercia de la
  // cuña de relleno ya está contenida en ΔPae de Mononobe–Okabe y sumarla otra
  // vez la contaría dos veces. Si el relleno sobre el talón se considera parte
  // del bloque que desliza, se puede incluir con `inerciaRelleno`.
  const participa = (b: Bloque) =>
    b.tipo === "concreto"
      ? 1
      : b.tipo === "suelo"
        ? inp.inerciaRelleno
          ? 1
          : 0
        : inp.inerciaRelleno && inp.inerciaSobrecarga
          ? 0.25
          : 0;
  const Wi = bloques.reduce((a, b) => a + participa(b) * b.W, 0);
  const Fi = inp.kh * Wi;
  const yFi =
    Wi > 1e-9 ? bloques.reduce((a, b) => a + participa(b) * b.W * b.y, 0) / Wi : 0;

  // Empuje pasivo delante de la puntera, incluida la uña.
  const Kp = kpRankine(inp.phiBase);
  const hPasivo = g.Df + inp.unaProf;
  const EpBruto =
    0.5 * Kp * inp.gammaFront * hPasivo ** 2 + 2 * inp.cBase * Math.sqrt(Kp) * hPasivo;
  const Ep = inp.usarPasivo ? inp.factorPasivo * EpBruto : 0;
  if (inp.usarPasivo && inp.factorPasivo >= 0.99) {
    advertencias.push(
      "El pasivo se está tomando íntegro: solo es realista si el suelo delante de la puntera está garantizado y no se excavará; lo habitual es afectarlo de ½ o ⅓.",
    );
  }

  // Momentos respecto a la arista de la puntera (x = 0).
  const Mr = bloques.reduce((a, b) => a + b.W * b.x, 0) + Ev * B;
  const Mo = Eh * yE + U * (B / 2);
  const fsVolt = Mo > 1e-9 ? Mr / Mo : Infinity;

  const tanD = Math.tan(rad(inp.deltaBase));
  const resist = N * tanD + inp.adherencia * B + Ep;
  const fsDesl = Eh > 1e-9 ? resist / Eh : Infinity;

  // Condición pseudo-dinámica: el peso se reduce con kv.
  const Ns = sumaW * (1 - inp.kv) + Ev - U;
  const resistS = Ns * tanD + inp.adherencia * B + Ep;
  const Ehs = Eh + dPae + Fi;
  const fsDeslSis = Ehs > 1e-9 ? resistS / Ehs : Infinity;

  const Mrs = bloques.reduce((a, b) => a + b.W * (1 - inp.kv) * b.x, 0) + Ev * B;
  const Mos = Mo + dPae * yS + Fi * yFi;
  const fsVoltSis = Mos > 1e-9 ? Mrs / Mos : Infinity;

  // Excentricidad y presiones de contacto.
  const e = B / 2 - (Mr - Mo) / Math.max(N, 1e-9);
  const es = B / 2 - (Mrs - Mos) / Math.max(Ns, 1e-9);
  const tercioCentral = Math.abs(e) <= B / 6 + 1e-9;
  const tercioCentralSis = Math.abs(es) <= B / 6 + 1e-9;

  const q1 = tercioCentral ? (N / B) * (1 + (6 * e) / B) : (2 * N) / (3 * (B / 2 - Math.abs(e)));
  const q2 = tercioCentral ? (N / B) * (1 - (6 * e) / B) : 0;
  const qMax = Math.max(q1, q2);
  const qMaxSis = tercioCentralSis
    ? (Ns / B) * (1 + (6 * Math.abs(es)) / B)
    : (2 * Ns) / (3 * Math.max(B / 2 - Math.abs(es), 1e-9));
  const Bcomp = tercioCentralSis ? B : 3 * Math.max(B / 2 - Math.abs(es), 0);

  if (!tercioCentral) {
    advertencias.push(
      `La resultante estática cae fuera del tercio central (e = ${e.toFixed(2)} m > B/6 = ${(B / 6).toFixed(2)} m): parte de la zapata trabaja a tracción y la presión se recalcula con el ancho comprimido.`,
    );
  }
  if (!Number.isFinite(inp.qadm) || inp.qadm <= 0) {
    advertencias.push("No se ha indicado la capacidad portante admisible del EMS.");
  }

  return {
    bloques,
    sumaW,
    Ev,
    U,
    N,
    Ns,
    Mr,
    Mo,
    Mrs,
    Mos,
    Eh,
    yEh: yE,
    dPae,
    ySismo: yS,
    Fi,
    yFi,
    Ep,
    fsDesl,
    fsVolt,
    fsDeslSis,
    fsVoltSis,
    e,
    es,
    q1,
    q2,
    qMax,
    qMaxSis,
    tercioCentral,
    tercioCentralSis,
    Bcomp,
    B,
    H,
    Kp,
    advertencias,
  };
}

/**
 * Presión de contacto a la distancia x de la arista de la puntera, con la
 * distribución lineal (o triangular reducida) de la condición dada.
 */
export function presionContacto(est: Estabilidad, x: number, sismo = false) {
  const B = est.B;
  const N = sismo ? est.Ns : est.N;
  const e = sismo ? est.es : est.e;
  const tercio = sismo ? est.tercioCentralSis : est.tercioCentral;
  if (N <= 0) return 0;
  if (tercio) {
    const qa = (N / B) * (1 + (6 * e) / B);
    const qb = (N / B) * (1 - (6 * e) / B);
    return qa + ((qb - qa) * x) / B;
  }
  const b = 3 * Math.max(B / 2 - Math.abs(e), 1e-9);
  const qm = (2 * N) / b;
  if (e >= 0) return x <= b ? qm * (1 - x / b) : 0;
  const x0 = B - b;
  return x >= x0 ? (qm * (x - x0)) / b : 0;
}
