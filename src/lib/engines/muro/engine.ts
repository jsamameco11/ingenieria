/**
 * Muro de sostenimiento en voladizo — expediente completo.
 *
 * §1 geometría y materiales · §2 perfil geotécnico multicapa · §3 combinaciones
 * · §4 empuje sísmico · §5 estabilidad externa · §6 modelo de elementos finitos
 * propio · §7 diseño del refuerzo E.060 · §8 contraste analítico vs FEM ·
 * §9 despiece.
 *
 * Normas: RNE E.050 §39.13 · RNE E.060 · RNE E.030 · CE.020 · ACI 318 ·
 * Das "Principios de ingeniería de cimentaciones" · Morales "Diseño en concreto
 * armado" cap. 13.
 */

import {
  barByName,
  fmt,
  num,
  str,
  type CalcCheck,
  type CalcOutput,
  type CalcStep,
  type Engine,
} from "../../types";
import {
  calcularSismo,
  coefK,
  construirPerfil,
  k0Jaky,
  kaCoulomb,
  kaRankine,
  kpRankine,
  presionEstatica,
  presionSismo,
  type Estrato,
  type PerfilInput,
} from "./perfil";
import {
  COMBINACIONES,
  alturaTotal,
  anchoZapata,
  construirCargas,
  construirMalla,
  resolverMuroFem,
  serieFuste,
  serieZapata,
  valorEn,
  type FemOpciones,
  type MuroGeom,
} from "./fem";
import { calcularEstabilidad, presionContacto, type Estabilidad } from "./estabilidad";
import {
  EcKPa,
  ES_MPA,
  SEPARACIONES_PULG,
  anclaje,
  disenarFranja,
  elegirBarra,
  elegirMallaCon,
  frMPa,
  inerciaEfectiva,
  inerciasFranja,
  type DisenoFranja,
} from "./diseno";
import { crearUnidades, serializar, type Sistema, type Unidades } from "./unidades";
import { calcularDespiece } from "./despiece";

const f2 = (n: number) => fmt(n, 2);
const f1 = (n: number) => fmt(n, 1);
const f3 = (n: number) => fmt(n, 3);

function ok(label: string, value: string, limit: string, pass: boolean): CalcCheck {
  return { label, value, limit, ok: pass };
}

/* ═════════════════ Lectura de datos ═════════════════ */

function leerEstratos(raw: Record<string, string>, U: Unidades): Estrato[] {
  const out: Estrato[] = [];
  for (let i = 1; i <= 4; i++) {
    const esp = U.iL(num(raw, `esp${i}`, 0));
    if (esp <= 1e-6) continue;
    out.push({
      nombre: str(raw, `cap${i}`, `Estrato ${i}`),
      espesor: esp,
      gamma: U.iW(num(raw, `gam${i}`, U.W(18.6))),
      gammaSat: U.iW(num(raw, `gsat${i}`, U.W(20))),
      phi: num(raw, `phi${i}`, 32),
      c: U.iP(num(raw, `coh${i}`, 0)),
    });
  }
  if (!out.length) {
    out.push({ nombre: "Relleno granular", espesor: 6, gamma: 18.6, gammaSat: 20, phi: 32, c: 0 });
  }
  return out;
}

/** Peso específico y φ equivalentes del relleno, ponderados por espesor. */
function equivalente(estratos: Estrato[], H: number) {
  let acc = 0;
  let gs = 0;
  let ps = 0;
  for (const e of estratos) {
    const t = Math.min(e.espesor, Math.max(0, H - acc));
    if (t <= 0) break;
    gs += e.gamma * t;
    ps += e.phi * t;
    acc += t;
  }
  if (acc < H - 1e-6 && estratos.length) {
    const u = estratos[estratos.length - 1];
    const t = H - acc;
    gs += u.gamma * t;
    ps += u.phi * t;
    acc = H;
  }
  return { gamma: acc > 0 ? gs / acc : 18.6, phi: acc > 0 ? ps / acc : 32 };
}

/* ═════════════════ Reparto analítico por combinación ═════════════════ */

type Factores = { CM: number; CV: number; CE: number; CS: number };

type ResultanteULS = {
  nombre: string;
  Nu: number;
  Mu: number;
  e: number;
  q1: number;
  q2: number;
  tercio: number;
  /** Presión última a la distancia x del pie. */
  p: (x: number) => number;
};

/**
 * Resultante amplificada en la base con una combinación dada. Reutiliza los
 * bloques de peso de la estabilidad para que la vía analítica y la FEM partan
 * exactamente de las mismas acciones.
 */
function resultanteFactorizada(est: Estabilidad, fac: Factores, kv: number): ResultanteULS {
  const B = est.B;
  let Nu = 0;
  let Mtoe = 0; // momento estabilizador respecto a la arista de la puntera
  for (const b of est.bloques) {
    const f = b.nombre.startsWith("Sobrecarga") ? fac.CV : fac.CM;
    const w = b.W * f - fac.CS * kv * b.W; // el alivio vertical es parte del sismo
    Nu += w;
    Mtoe += w * b.x;
  }
  Nu += fac.CE * est.Ev - fac.CM * est.U;
  Mtoe += fac.CE * est.Ev * B - fac.CM * est.U * (B / 2);

  const Mvol =
    fac.CE * est.Eh * est.yEh + fac.CS * (est.dPae * est.ySismo + est.Fi * est.yFi);

  const Mres = Mtoe - Mvol;
  const e = B / 2 - Mres / Math.max(Nu, 1e-9);
  const tercio = B / 6;
  const dentro = Math.abs(e) <= tercio + 1e-9;
  const q1 = dentro ? (Nu / B) * (1 + (6 * e) / B) : (2 * Nu) / (3 * Math.max(B / 2 - Math.abs(e), 1e-9));
  const q2 = dentro ? (Nu / B) * (1 - (6 * e) / B) : 0;

  const p = (x: number) => {
    if (Nu <= 0) return 0;
    if (dentro) return q1 + ((q2 - q1) * x) / B;
    const b = 3 * Math.max(B / 2 - Math.abs(e), 1e-9);
    const qm = (2 * Nu) / b;
    if (e >= 0) return x <= b ? qm * (1 - x / b) : 0;
    const x0 = B - b;
    return x >= x0 ? (qm * (x - x0)) / b : 0;
  };

  return { nombre: "", Nu, Mu: Mres, e, q1, q2, tercio, p };
}

function integrar(a: number, b: number, n: number, f: (x: number) => number) {
  if (b - a <= 1e-12) return { F: 0, M: 0 };
  let F = 0;
  let M = 0;
  for (let i = 0; i < n; i++) {
    const x0 = a + ((b - a) * i) / n;
    const x1 = a + ((b - a) * (i + 1)) / n;
    const xm = (x0 + x1) / 2;
    const dF = f(xm) * (x1 - x0);
    F += dF;
    M += dF * xm;
  }
  return { F, M };
}

/* ═════════════════ Motor ═════════════════ */

export const muroSostenimiento: Engine = (raw) => {
  const steps: CalcStep[] = [];
  const checks: CalcCheck[] = [];
  const extras: NonNullable<CalcOutput["extras"]> = [];
  const dims: Record<string, string> = {};
  const avisos: string[] = [];

  /*
   * El usuario escribe en el sistema que elige y la memoria se imprime en ese
   * mismo sistema, pero todo el cálculo ocurre en SI (m, kN, kPa, MPa): así la
   * elección de unidades no puede mover un resultado, solo su rótulo.
   */
  const sisRaw = str(raw, "unidades", "tnf");
  const sis: Sistema = sisRaw === "kn" || sisRaw === "imperial" ? sisRaw : "tnf";
  const U = crearUnidades(sis);
  /** Separación de barras: cm en los sistemas métricos, pulgada en el inglés. */
  const rotS = (cm: number) =>
    sis === "imperial" ? `${fmt(cm / 2.54, 1)} pulg` : `${fmt(cm, Math.abs(cm % 1) < 1e-9 ? 0 : 1)} cm`;
  /** Lista de separaciones constructivas coherente con el sistema elegido. */
  const seps = sis === "imperial" ? SEPARACIONES_PULG : undefined;
  const opcSep = { separaciones: seps, rotularS: rotS };

  /* ── §1 Geometría y materiales ── */
  const geom: MuroGeom = {
    hp: U.iL(num(raw, "hp", U.L(5))),
    hf: U.iL(num(raw, "hf", U.L(0.5))),
    ttop: U.iL(num(raw, "ttop", U.L(0.3))),
    tbase: U.iL(num(raw, "tbase", U.L(0.45))),
    Ltoe: U.iL(num(raw, "Ltoe", U.L(1.0))),
    Lheel: U.iL(num(raw, "Lheel", U.L(3.5))),
    Df: U.iL(num(raw, "Df", U.L(1.0))),
  };
  const B = anchoZapata(geom);
  const H = alturaTotal(geom);
  const talud = num(raw, "talud", 0);

  const fc = U.iFc(num(raw, "fc", U.Fc(21)));
  const fy = U.iFc(num(raw, "fy", U.Fc(420)));
  const gammaC = U.iW(num(raw, "gammaC", U.W(23.5)));
  const recFuste = U.iLc(num(raw, "recFuste", U.Lc(0.05)));
  const recZap = U.iLc(num(raw, "recZap", U.Lc(0.07)));
  const Ec = EcKPa(fc);

  const relBH = B / H;
  const predimOk = relBH >= 0.5 && relBH <= 0.8;
  const tTopMin = geom.ttop >= 0.3 - 1e-9;
  const hfMin = geom.hf >= 0.3 - 1e-9;

  steps.push({
    n: "01",
    title: "1.1 Dimensiones y predimensionamiento",
    formula: "B = L_puntera + t_base + L_talón · H = h_p + h_f",
    formulaTex: String.raw`B = L_{toe} + t_{base} + L_{heel} \qquad H = h_p + h_f`,
    substitution: `B = ${f2(geom.Ltoe)} + ${f2(geom.tbase)} + ${f2(geom.Lheel)} · H = ${f2(geom.hp)} + ${f2(geom.hf)}`,
    result: `B = ${f2(B)} m · H = ${f2(H)} m · B/H = ${f2(relBH)}`,
    ok: predimOk && tTopMin && hfMin,
    desarrollo: [
      `Altura libre del fuste h_p = ${f2(geom.hp)} m · espesor de zapata h_f = ${f2(geom.hf)} m [Morales cap. 13 §7.4: h_f ≥ 0.30 m]`,
      `Fuste: t_corona = ${f2(geom.ttop)} m y t_base = ${f2(geom.tbase)} m; cara frontal vertical y talud hacia el relleno [Morales cap. 13 §2.4.2: t_corona ≥ 0.30 m]`,
      `Puntera ${f2(geom.Ltoe)} m · talón ${f2(geom.Lheel)} m · desplante D_f = ${f2(geom.Df)} m`,
      `Rango de predimensionado B/H = 0.50 a 0.80 para muros en voladizo: aquí ${f2(relBH)}`,
      talud !== 0 ? `Talud del relleno i = ${f2(talud)}° [Rankine inclinado, Morales cap. 13 §1.2]` : "Relleno horizontal (i = 0°)",
    ],
    note: predimOk
      ? undefined
      : `B/H = ${f2(relBH)} está fuera de 0.50–0.80. Es solo una referencia de partida: una base más ancha suele ser la respuesta correcta cuando gobierna el deslizamiento sísmico, y una más estrecha cuando el suelo es muy competente.`,
  });

  steps.push({
    n: "02",
    title: "1.2 Materiales",
    formula: "Ec = 4700·√f'c  [E.060 8.5.1]",
    formulaTex: String.raw`E_c = 4700\sqrt{f'_c} = 4700\sqrt{${f1(fc)}\ \text{MPa}} = ${f1(Ec / 1000)}\ \text{MPa}`,
    substitution: `f'c = ${U.fFc(fc)} · fy = ${U.fFc(fy)} · γc = ${U.fW(gammaC)}`,
    result: `Ec = ${U.fE(Ec)} · recubrimientos ${U.fLc(recFuste)} (fuste) y ${U.fLc(recZap)} (zapata)`,
    desarrollo: [
      `Unidades de la memoria: ${U.u.F} para fuerzas por metro de muro, ${U.u.P} para presiones, ${U.u.M} para momentos y ${U.u.Fc} para resistencias.`,
      `E.060 21.3.2.1: 21 ≤ f'c ≤ 55 MPa (${U.fFc(21)} a ${U.fFc(55)}) en elementos sismorresistentes${fc < 21 ? " — f'c por debajo del mínimo" : ""}`,
      `E.060 7.7: recubrimiento del fuste expuesto al suelo ≥ 50 mm`,
      `E.060 7.7.1: zapata vaciada contra el suelo, recubrimiento ≥ 70 mm`,
    ],
  });

  /* ── §2 Perfil geotécnico ── */
  const estratos = leerEstratos(raw, U);
  const nf = U.iL(num(raw, "nf", U.L(99)));
  const gammaW = U.iW(num(raw, "gammaW", U.W(9.81)));
  const q = U.iP(num(raw, "q", 0));
  const condicion = (str(raw, "condicion", "activo") === "reposo" ? "reposo" : "activo") as
    | "activo"
    | "reposo";
  const metodoK = (str(raw, "metodoK", "rankine") === "coulomb" ? "coulomb" : "rankine") as
    | "rankine"
    | "coulomb";
  const deltaMuro = num(raw, "deltaMuro", 0);

  const perfilInput: PerfilInput = {
    estratos,
    H,
    nf,
    gammaW,
    q,
    condicion,
    i: talud,
    delta: deltaMuro,
    metodoK,
  };
  const perfil = construirPerfil(perfilInput);
  avisos.push(...perfil.advertencias);
  const eq = equivalente(estratos, H);
  const KaEq = coefK({ ...estratos[0], phi: eq.phi }, perfilInput);

  steps.push({
    n: "03",
    title: "2.1 Relleno multicapa — coeficientes de empuje",
    formula:
      condicion === "reposo"
        ? "K₀ = (1 − sen φ)(1 + sen i)  [Jaky]"
        : metodoK === "coulomb"
          ? "Ka Coulomb (Das ec. 7.44)"
          : "Ka = cos i·(cos i − √(cos²i − cos²φ))/(cos i + √(cos²i − cos²φ))  [Das ec. 7.29]",
    formulaTex:
      condicion === "reposo"
        ? String.raw`K_0 = (1-\sin\varphi)(1+\sin i)`
        : metodoK === "coulomb"
          ? String.raw`K_a = \dfrac{\cos^2\varphi}{\cos\delta\left(1+\sqrt{\dfrac{\sin(\varphi+\delta)\sin(\varphi-i)}{\cos\delta\cos i}}\right)^2}`
          : String.raw`K_a = \cos i\ \dfrac{\cos i-\sqrt{\cos^2 i-\cos^2\varphi}}{\cos i+\sqrt{\cos^2 i-\cos^2\varphi}}`,
    substitution: `Condición del muro: ${condicion === "reposo" ? "no cede — reposo K₀" : "cede — activo Ka"} · método ${metodoK === "coulomb" ? "Coulomb" : "Rankine"}`,
    result: `${estratos.length} estrato(s) · K equivalente = ${f3(KaEq)}`,
    table: {
      caption: "Estratos desde la corona hacia abajo (cada uno con su K y su peso)",
      headers: [
        "#", "Estrato", `Espesor (${U.u.L})`, `γ (${U.u.W})`, `γsat (${U.u.W})`, "φ (°)", `c (${U.u.P})`, "K",
      ],
      rows: estratos.map((e, i) => [
        String(i + 1),
        e.nombre,
        U.nL(e.espesor),
        fmt(U.W(e.gamma), 2),
        fmt(U.W(e.gammaSat), 2),
        f1(e.phi),
        U.nP(e.c),
        f3(coefK(e, perfilInput)),
      ]),
    },
    desarrollo: [
      `Cada estrato aporta con su propio K y su peso; el perfil resultante es discontinuo en los contactos y da lugar a bloques trapezoidales.`,
      `Ka (Rankine, φ equivalente ${f1(eq.phi)}°) = ${f3(kaRankine(eq.phi, talud))} · K₀ (Jaky) = ${f3(k0Jaky(eq.phi, talud))} · Ka (Coulomb con δ = ${f1(deltaMuro)}°) = ${f3(kaCoulomb(eq.phi, deltaMuro, talud))}`,
      `γ equivalente del relleno = ${U.fW(eq.gamma)} sobre la altura de empuje H = ${U.fL(H)}`,
    ],
    note: "Los espesores deben cubrir H. Si el perfil se queda corto, el último estrato se prolonga hasta el fondo de la zapata.",
  });

  steps.push({
    n: "04",
    title: "2.2 Nivel freático, sobrecarga y empuje estático",
    formula: "σ'h = K·σ'v − 2c√K · u = γw·(z − z_NF) · E = ∫(σ'h + u)dz",
    formulaTex: String.raw`\sigma'_h = K\sigma'_v - 2c\sqrt{K}\ ,\qquad u=\gamma_w (z-z_{NF})\ ,\qquad E=\int_0^H (\sigma'_h+u)\,dz`,
    substitution: `NF a ${nf >= H ? "profundidad mayor que H (sin agua)" : U.fL(nf)} · q = ${U.fP(q)} · γw = ${U.fW(gammaW)}`,
    result: `E = ${U.fF(perfil.E)} · E_h = ${U.nF(perfil.Eh)} · E_v = ${U.nF(perfil.Ev)} · ȳ = ${U.fL(perfil.ybar)} desde el fondo`,
    desarrollo: [
      `Presión lateral máxima en el fondo: ${U.fP(perfil.pMax)}`,
      perfil.Eu > 1e-6
        ? `Componente hidrostática E_u = ${U.fF(perfil.Eu)}; bajo el NF se usa γ' = γsat − γw y se suma la presión de poros [Morales cap. 13 §6 · Das §1.11]`
        : "Sin nivel freático dentro de la altura de empuje: no hay presión de poros ni subpresión.",
      perfil.uFondo > 1e-6 ? `Subpresión en el fondo de la zapata u = ${U.fP(perfil.uFondo)}` : "",
      `La resultante está inclinada ${f1(perfil.inclinacion)}° respecto a la horizontal.`,
    ].filter(Boolean),
  });

  /* ── §3 Combinaciones ── */
  steps.push({
    n: "05",
    title: "3. Combinaciones de diseño (por metro de muro)",
    formula: "E.060 §9.2 con empuje de tierras CE y sismo CS",
    result: `${COMBINACIONES.filter((c) => c.tipo === "ULS").length} combinaciones de rotura + 1 de servicio`,
    table: {
      caption: "Combinaciones",
      headers: ["#", "Combinación", "Tipo", "Referencia"],
      rows: COMBINACIONES.map((c, i) => [String(i + 1), c.nombre, c.tipo, c.referencia]),
    },
    desarrollo: [
      "La estabilidad de §5 se verifica con cargas de SERVICIO y los factores de seguridad de la E.050 §39.13.6; el diseño estructural de §7 usa las combinaciones amplificadas.",
      "El empuje actúa en un solo sentido, hacia la puntera: no se considera la reversión.",
      "Las mismas combinaciones alimentan el modelo de elementos finitos de §6.",
    ],
  });

  /* ── §4 Sismo ── */
  const metodoSismo = (str(raw, "metodoSismo", "simplificado") === "mononobe"
    ? "mononobe"
    : "simplificado") as "simplificado" | "mononobe";
  const kh = num(raw, "kh", 0.18);
  const kv = num(raw, "kv", 0);
  const inerciaRelleno = str(raw, "inerciaMuro", "concreto") === "concreto+relleno";
  const inerciaSobrecarga = str(raw, "inerciaSobrecarga", "si") !== "no";

  const sismo = calcularSismo({
    metodo: metodoSismo,
    kh,
    kv,
    gammaEq: eq.gamma,
    H,
    phiEq: eq.phi,
    delta: deltaMuro,
    i: talud,
    Ea: perfil.E - perfil.Eu,
    Ka: KaEq,
  });
  avisos.push(...sismo.advertencias);

  steps.push({
    n: "06",
    title: "4. Empuje sísmico — Mononobe–Okabe / E.050",
    formula:
      sismo.formula === "mononobe"
        ? "Mononobe–Okabe completo: ΔPae = ½γH²(Kae − Ka)(1 − kv)  [Das ec. 7.65 · Seed & Whitman]"
        : "Simplificado E.050: ΔPae = ⅜·kh·γ·H²  [E.050 §39.13.4 · Das ec. 6.35]",
    formulaTex:
      sismo.formula === "mononobe"
        ? String.raw`\Delta P_{ae} = \tfrac12\gamma H^2 (K_{ae}-K_a)(1-k_v) = \tfrac12\cdot${f2(eq.gamma)}\cdot${f2(H)}^2(${f3(sismo.Kae)}-${f3(KaEq)})(1-${f2(kv)})`
        : String.raw`\Delta P_{ae} = \tfrac38 k_h \gamma H^2 = \tfrac38\cdot${f2(kh)}\cdot${f2(eq.gamma)}\cdot${f2(H)}^2`,
    substitution: `kh = ${f2(kh)} · kv = ${f2(kv)} · δ = ${f1(deltaMuro)}° · θ = ${f2(sismo.theta)}°`,
    result: `ΔPae = ${U.fF(sismo.dPae)} aplicado a ȳ = ${U.fL(sismo.y)} del fondo (0.6H)`,
    desarrollo: [
      `Coeficiente sísmico horizontal kh del EMS (práctica: ½·Z·S de la E.030) = ${f2(kh)}; vertical kv = ${f2(kv)}`,
      `Ángulo de inercia sísmica θ = atan(kh/(1−kv)) = ${f2(sismo.theta)}°`,
      Number.isFinite(sismo.Kae) ? `Kae (Mononobe–Okabe) = ${f3(sismo.Kae)} frente a Ka = ${f3(KaEq)}` : "",
      `Distribución equivalente: trapecio con p_corona = 1.6·ΔPae/H = ${U.fP(sismo.pTop)} y p_fondo = 0.25·p_corona = ${U.fP(sismo.pBot)}, que sitúa la resultante justo en 0.6H.`,
      inerciaRelleno
        ? `Inercia sísmica: kh·W sobre el concreto y el relleno sobre el talón${inerciaSobrecarga ? ", más el 25 % de la sobrecarga [E.030 art. 31]" : ""}. Ten presente que la inercia de la cuña ya está dentro de ΔPae; esta opción es conservadora.`
        : `Inercia sísmica: kh·W aplicado solo al concreto, en su centro de gravedad. La inercia de la cuña de relleno ya la contiene ΔPae y volver a sumarla la contaría dos veces.`,
    ].filter(Boolean),
  });

  /* ── §5 Estabilidad ── */
  const phiBase = num(raw, "phiBase", 30);
  const cBase = U.iP(num(raw, "cBase", 0));
  const deltaBase = num(raw, "deltaBase", (2 / 3) * phiBase);
  const adherencia = U.iP(num(raw, "adherencia", 0));
  const qadm = U.iP(num(raw, "qadm", U.P(250)));
  const gammaFront = U.iW(num(raw, "gammaFront", U.W(18)));
  const unaProf = U.iL(num(raw, "unaProf", 0));
  const unaAncho = U.iL(num(raw, "unaAncho", 0));
  const usarPasivo = str(raw, "usarPasivo", "si") !== "no";
  const factorPasivo = num(raw, "factorPasivo", 0.5);
  const fsDeslMin = num(raw, "fsDeslMin", 1.5);
  const fsVoltMin = num(raw, "fsVoltMin", 1.5);
  const fsDeslSisMin = num(raw, "fsDeslSisMin", 1.25);
  const fsVoltSisMin = num(raw, "fsVoltSisMin", 1.25);

  const est = calcularEstabilidad({
    geom,
    perfil,
    sismo,
    gammaC,
    gammaRelleno: eq.gamma,
    gammaFront,
    q,
    phiBase,
    cBase,
    deltaBase,
    adherencia,
    qadm,
    kh,
    kv,
    inerciaRelleno,
    inerciaSobrecarga,
    unaProf,
    unaAncho,
    usarPasivo,
    factorPasivo,
    fsDeslMin,
    fsVoltMin,
    fsDeslSisMin,
    fsVoltSisMin,
  });
  avisos.push(...est.advertencias);

  steps.push({
    n: "07",
    title: "5.1 Pesos y momentos respecto a la arista de la puntera",
    formula: "ΣV = ΣW + E_v − U · M_r = Σ(W·x) + E_v·B",
    formulaTex: String.raw`\Sigma V = \Sigma W + E_v - U \qquad M_r = \sum W_i x_i + E_v B`,
    result: `ΣW = ${U.fF(est.sumaW)} · N = ${U.fF(est.N)} · M_r = ${U.fM(est.Mr)} · M_o = ${U.fM(est.Mo)}`,
    table: {
      caption: "Bloques de peso por metro de muro",
      headers: ["N.°", "Elemento", `W (${U.u.F})`, `x (${U.u.L})`, `y (${U.u.L})`, `W·x (${U.u.M})`],
      rows: [
        ...est.bloques.map((b) => [
          String(b.n),
          b.nombre,
          U.nF(b.W),
          U.nL(b.x),
          U.nL(b.y),
          U.nM(b.W * b.x),
        ]),
        ["", "Σ", U.nF(est.sumaW), "", "", U.nM(est.bloques.reduce((a, b) => a + b.W * b.x, 0))],
      ],
    },
    desarrollo: [
      est.U > 1e-6 ? `Subpresión U = ${U.fF(est.U)} (resta a la vertical y añade momento volcador)` : "Sin subpresión.",
      `Componente vertical del empuje E_v = ${U.fF(est.Ev)} aplicada en el extremo del talón.`,
      `Inercia sísmica del muro F_i = kh·W = ${U.fF(est.Fi)} a ${U.fL(est.yFi)} del fondo.`,
    ],
  });

  const tanD = Math.tan((deltaBase * Math.PI) / 180);
  steps.push({
    n: "08",
    title: "5.2 Deslizamiento",
    formula: "FS_d = (N·tanδ + c_b·B + E_p) / E_h  ≥ 1.50  [E.050 §39.13.6 · Das ec. 7.11]",
    formulaTex: String.raw`FS_d=\frac{N\tan\delta + c_b B + E_p}{E_h}=\frac{${U.nF(est.N)}\times${f3(tanD)}+${U.nP(adherencia)}\times${U.nL(B)}+${U.nF(est.Ep)}}{${U.nF(est.Eh)}}`,
    substitution: `δ = ${f1(deltaBase)}° · c_b = ${U.fP(adherencia)} · E_p = ${U.fF(est.Ep)} (Kp = ${f3(est.Kp)})`,
    result: `FS_d = ${f2(est.fsDesl)} (estático) · FS_d,s = ${f2(est.fsDeslSis)} (pseudo-dinámico)`,
    ok: est.fsDesl >= fsDeslMin && est.fsDeslSis >= fsDeslSisMin,
    desarrollo: [
      `Condición sísmica: N_s = ΣW(1 − kv) + E_v − U = ${U.fF(est.Ns)}; la aceleración vertical reduce el peso disponible para la fricción.`,
      `Empuje horizontal sísmico total = E_h + ΔPae + F_i = ${U.nF(est.Eh)} + ${U.nF(est.dPae)} + ${U.nF(est.Fi)} = ${U.fF(est.Eh + est.dPae + est.Fi)}`,
      usarPasivo
        ? `El pasivo delante de la puntera se toma al ${f1(factorPasivo * 100)} % sobre una altura de ${U.fL(geom.Df + unaProf)} (desplante${unaProf > 0 ? " + uña" : ""}).`
        : "No se considera el empuje pasivo delante de la puntera (criterio conservador: el suelo puede ser retirado).",
    ],
  });

  steps.push({
    n: "09",
    title: "5.3 Volteo",
    formula: "FS_v = M_r / M_o  ≥ 1.50  [E.050 §39.13.6 · Das ec. 7.2]",
    formulaTex: String.raw`FS_v=\frac{M_r}{M_o}=\frac{${U.nM(est.Mr)}}{${U.nM(est.Mo)}}=${f2(est.fsVolt)}`,
    substitution: `Momentos respecto a la arista de la puntera. Sísmico: M_o,s = M_o + ΔPae·0.6H + F_i·y_i`,
    result: `FS_v = ${f2(est.fsVolt)} (estático) · FS_v,s = ${f2(est.fsVoltSis)} (pseudo-dinámico)`,
    ok: est.fsVolt >= fsVoltMin && est.fsVoltSis >= fsVoltSisMin,
    desarrollo: [
      `M_o,s = ${U.nM(est.Mo)} + ${U.nF(est.dPae)}×${U.nL(sismo.y)} + ${U.nF(est.Fi)}×${U.nL(est.yFi)} = ${U.fM(est.Mos)}`,
      `M_r,s = Σ W·x·(1 − kv) + E_v·B = ${U.fM(est.Mrs)}`,
    ],
  });

  steps.push({
    n: "10",
    title: "5.4 Excentricidad y presión de contacto",
    formula: "e = B/2 − (M_r − M_o)/N · q₁,₂ = N/B·(1 ± 6e/B)  [Morales cap. 13 §2.3]",
    formulaTex: String.raw`e=\frac{B}{2}-\frac{M_r-M_o}{N}=${U.nL(est.e)}\ \text{${U.u.L}}\qquad q_{1,2}=\frac{N}{B}\left(1\pm\frac{6e}{B}\right)`,
    substitution: `B/6 = ${U.fL(B / 6)} (límite del tercio central)`,
    result: `e = ${U.fL(est.e)} · q_max = ${U.fP(est.qMax)} · q_min = ${U.fP(Math.min(est.q1, est.q2))} · q_max,sismo = ${U.fP(est.qMaxSis)}`,
    ok: est.qMax <= qadm && est.qMaxSis <= 1.25 * qadm && est.tercioCentral,
    desarrollo: [
      `Estático: ${est.tercioCentral ? "la resultante cae dentro del tercio central, la distribución es trapezoidal en todo B" : `la resultante cae fuera del tercio central; la distribución es triangular sobre un ancho comprimido de ${U.fL(3 * (B / 2 - Math.abs(est.e)))}`}.`,
      `Sísmico: e_s = ${U.fL(est.es)} · ancho comprimido ${U.fL(est.Bcomp)} de ${U.fL(B)}`,
      `Límites de la E.050 §39.13.6: q_max ≤ q_adm = ${U.fP(qadm)} (estático) y ≤ 1.25·q_adm = ${U.fP(1.25 * qadm)} (con sismo).`,
    ],
  });

  const hPasivoUna = geom.Df + unaProf;
  steps.push({
    n: "11",
    title: "5.5 Uña de cimentación",
    formula: "E_p = ½·Kp·γ·h² + 2c√Kp·h  (h = D_f + profundidad de la uña)",
    formulaTex: String.raw`E_p=\tfrac12 K_p\gamma h^2 + 2c\sqrt{K_p}\,h,\qquad h=D_f+d_{u\tilde{n}a}=${U.nL(hPasivoUna)}\ \text{${U.u.L}}`,
    substitution:
      unaProf > 1e-6
        ? `Uña de ${U.nL(unaAncho)} × ${U.fL(unaProf)} bajo la puntera`
        : "Sin uña: h = D_f",
    result:
      unaProf > 1e-6
        ? `E_p movilizado = ${U.fF(est.Ep)}; el FS al deslizamiento pasa a ${f2(est.fsDesl)} (estático) y ${f2(est.fsDeslSis)} (sísmico)`
        : `Sin uña, E_p movilizado = ${U.fF(est.Ep)}`,
    note:
      est.fsDeslSis < fsDeslSisMin && unaProf <= 1e-6
        ? `El FS al deslizamiento sísmico es ${f2(est.fsDeslSis)} < ${f2(fsDeslSisMin)}. Una uña bajo la puntera moviliza pasivo profundo y suele ser más económica que ensanchar la zapata.`
        : undefined,
    desarrollo: [
      `Kp de Rankine con φ del suelo de cimentación (${f1(phiBase)}°) = ${f3(kpRankine(phiBase))}`,
      "La uña se arma con el mismo acero de la malla inferior de la zapata, prolongado y anclado en el dado.",
    ],
  });

  checks.push(ok("FS deslizamiento estático", f2(est.fsDesl), `≥ ${f2(fsDeslMin)}`, est.fsDesl >= fsDeslMin));
  checks.push(ok("FS volteo estático", f2(est.fsVolt), `≥ ${f2(fsVoltMin)}`, est.fsVolt >= fsVoltMin));
  checks.push(ok("FS deslizamiento sísmico", f2(est.fsDeslSis), `≥ ${f2(fsDeslSisMin)}`, est.fsDeslSis >= fsDeslSisMin));
  checks.push(ok("FS volteo sísmico", f2(est.fsVoltSis), `≥ ${f2(fsVoltSisMin)}`, est.fsVoltSis >= fsVoltSisMin));
  checks.push(ok("Excentricidad (tercio central)", `e = ${U.fL(est.e)}`, `≤ B/6 = ${U.fL(B / 6)}`, est.tercioCentral));
  checks.push(ok("Presión máxima estática", U.fP(est.qMax), `≤ ${U.fP(qadm)}`, est.qMax <= qadm));
  checks.push(ok("Presión máxima con sismo", U.fP(est.qMaxSis), `≤ ${U.fP(1.25 * qadm)}`, est.qMaxSis <= 1.25 * qadm));

  /* ── §6 Modelo FEM propio ── */
  const femOpts: FemOpciones = {
    Lpanel: U.iL(num(raw, "Lpanel", U.L(2))),
    nz: Math.round(num(raw, "nz", 20)),
    nToe: Math.round(num(raw, "nToe", 6)),
    nHeel: Math.round(num(raw, "nHeel", 16)),
    nx: Math.round(num(raw, "nx", 4)),
    bordeX: (str(raw, "bordeX", "simetria") === "libre" ? "libre" : "simetria") as "simetria" | "libre",
    ks: U.iK(num(raw, "ks", U.K(30000))),
    ksh: U.iK(num(raw, "ksh", num(raw, "ks", U.K(30000)) / 2)),
    Ec,
    nu: num(raw, "nu", 0.2),
    sinTraccion: str(raw, "sinTraccion", "si") !== "no",
  };
  const mesh = construirMalla(geom, femOpts);
  const cargas = construirCargas(mesh, {
    geom,
    perfilInput,
    perfil,
    sismo,
    gammaC,
    gammaFront,
    kh,
    kv,
    inerciaRelleno,
    inerciaSobrecarga,
  });
  const fem = resolverMuroFem(mesh, cargas, femOpts);
  avisos.push(...fem.advertencias);

  steps.push({
    n: "12",
    title: "6. Modelo de elementos finitos — malla, suelo y casos",
    formula: "Lámina MITC4 (flexión + membrana) sobre resortes de Winkler sin tracción",
    formulaTex: String.raw`k_v = k_s A_{trib},\qquad \mathbf{K}\mathbf{u}=\mathbf{f},\qquad \mathbf{M}=\mathbf{D}_b\boldsymbol{\kappa}`,
    substitution: `${fem.nNodos} nodos · ${fem.nElem} elementos · ${fem.nEcuaciones} ecuaciones · paño de ${U.fL(femOpts.Lpanel)}`,
    result: `${COMBINACIONES.length} combinaciones resueltas con solver directo LDLᵀ en perfil skyline`,
    ok: fem.ok,
    desarrollo: [
      `Fuste y zapata se discretizan con láminas planas de 4 nodos y 6 grados de libertad por nodo. La flexión usa la formulación MITC4 de deformación cortante supuesta (Bathe–Dvorkin), que no sufre bloqueo por cortante, y la acción de membrana se integra en el mismo elemento, de modo que el nudo fuste–zapata trabaja como el marco rígido que realmente es.`,
      `El fuste se modela con su superficie media inclinada (talud hacia el relleno) y espesor variable de ${U.nL(geom.tbase)} a ${U.fL(geom.ttop)}; se prolonga hasta el plano medio de la zapata para materializar el nudo, y ese tramo embebido no recibe carga porque su volumen ya lo aporta la zapata.`,
      `Suelo: resortes verticales k = ks·A_trib con ks = ${U.fK(femOpts.ks)} que solo trabajan a compresión, más resortes horizontales de fricción con ksh = ${U.fK(femOpts.ksh)}. El despegue del talón se resuelve con un lazo de contacto que desactiva los resortes traccionados y vuelve a resolver.`,
      `Bordes del paño: ${femOpts.bordeX === "simetria" ? "simetría en ambos extremos, equivalente a deformación plana (muro continuo)" : "libres, para un paño entre juntas"}.`,
      `Casos de carga: CM (peso propio del concreto, relleno sobre el talón, suelo sobre la puntera y subpresión), CV (sobrecarga), CE (empuje estático sobre el trasdós del fuste y sobre el canto del talón) y CS (ΔPae con la distribución de §4 más la inercia kh·W del propio muro y el alivio vertical kv).`,
      `Como los resortes no trabajan a tracción, la superposición deja de ser válida: cada combinación se resuelve con su propio vector de carga ya amplificado, no sumando resultados de casos.`,
    ],
    table: {
      caption: "Resultado por combinación",
      headers: [
        "Combinación", "Tipo", `q_max FEM (${U.u.P})`, "Nodos despegados", "Iteraciones",
        U.sis === "imperial" ? "δ_max (pulg)" : "δ_max (mm)",
      ],
      rows: fem.combos.map((c) => [
        c.combo.nombre,
        c.combo.tipo,
        U.nP(c.presionMax),
        String(c.despegue),
        String(c.iteraciones),
        U.sis === "imperial" ? fmt(U.Lc(c.desplMax), 3) : f2(c.desplMax * 1000),
      ]),
    },
  });

  // Envolvente por zonas.
  const zonaMax = (zona: string, key: "supY" | "infY" | "q") => {
    let m = 0;
    let idx = -1;
    mesh.info.forEach((e) => {
      if (e.zona !== zona || e.stub) return;
      const v = key === "q" ? fem.envolvente.q[e.idx] : fem.envolvente[key][e.idx];
      if (v > m) {
        m = v;
        idx = e.idx;
      }
    });
    return { valor: m, idx };
  };
  const envFusteNeg = zonaMax("fuste", "infY");
  const envTalonPos = zonaMax("talon", "supY");
  const envPunteraNeg = zonaMax("puntera", "infY");

  steps.push({
    n: "13",
    title: "6.1 Envolvente de momentos de diseño — Wood & Armer",
    formula: "M*x = Mx ± |Mxy| · M*y = My ± |Mxy|  (con corrección si cambia de signo)",
    formulaTex: String.raw`M^*_x = M_x + |M_{xy}|,\quad M^*_y = M_y + |M_{xy}|;\quad \text{si } M^*_x<0:\ M^*_x=0,\ M^*_y=M_y+\left|\frac{M_{xy}^2}{M_x}\right|`,
    substitution: "Envolvente de las 5 combinaciones de rotura, elemento a elemento y cara a cara",
    result: `Fuste (cara del relleno) ${U.nM(envFusteNeg.valor)} · Talón (malla superior) ${U.nM(envTalonPos.valor)} · Puntera (malla inferior) ${U.fM(envPunteraNeg.valor)}`,
    desarrollo: [
      "Wood & Armer combina Mx, My y el torsor Mxy en momentos equivalentes por dirección, de modo que la armadura ortogonal satisface el criterio de fluencia en cualquier dirección. Es el mismo criterio que usan los programas comerciales cuando reportan «dirección automática».",
      `En un muro continuo el torsor es prácticamente nulo y Wood & Armer devuelve el momento principal; deja de serlo cuando el paño tiene bordes libres o contrafuertes.`,
      `Cortante máximo de envolvente: fuste ${U.nF(zonaMax("fuste", "q").valor)} · puntera ${U.nF(zonaMax("puntera", "q").valor)} · talón ${U.fF(zonaMax("talon", "q").valor)}`,
    ],
  });

  /* ── §7 Diseño del refuerzo ── */
  const metodoDiseno = (str(raw, "metodoDiseno", "analitico") === "fem" ? "fem" : "analitico") as
    | "analitico"
    | "fem";

  // --- Vía analítica ---
  const nInt = 400;
  const intFuste = (pFn: (zc: number) => number, desde = 0) => {
    let M = 0;
    let V = 0;
    for (let i = 0; i < nInt; i++) {
      const y0 = desde + ((geom.hp - desde) * i) / nInt;
      const y1 = desde + ((geom.hp - desde) * (i + 1)) / nInt;
      const ym = (y0 + y1) / 2;
      const dF = pFn(geom.hp - ym) * (y1 - y0);
      V += dF;
      M += dF * (ym - desde);
    }
    return { M, V };
  };
  const fCE = intFuste((zc) => presionEstatica(perfil, zc));
  const fCSempuje = intFuste((zc) => presionSismo(sismo, zc, H));
  /**
   * Inercia sísmica del propio fuste sobre la sección: kh·γc·t(z) actuando
   * hacia la puntera. La E.030 art. 31 la exige y el modelo FEM la incluye de
   * oficio, así que la vía analítica tiene que llevarla para ser comparable.
   */
  const inerciaFuste = (desde: number) => {
    let M = 0;
    let V = 0;
    const n = 200;
    for (let i = 0; i < n; i++) {
      const y0 = desde + ((geom.hp - desde) * i) / n;
      const y1 = desde + ((geom.hp - desde) * (i + 1)) / n;
      const ym = (y0 + y1) / 2;
      const t = geom.tbase + ((geom.ttop - geom.tbase) * ym) / Math.max(geom.hp, 1e-9);
      const dF = kh * gammaC * t * (y1 - y0);
      V += dF;
      M += dF * (ym - desde);
    }
    return { M, V };
  };
  const fIn = inerciaFuste(0);
  const fCS = { M: fCSempuje.M + fIn.M, V: fCSempuje.V + fIn.V };

  const barFusteSel = str(raw, "barFuste", "auto");
  const barZapSel = str(raw, "barZap", "auto");

  const MuFusteAnal = Math.max(1.7 * fCE.M, 1.25 * fCE.M + 1.0 * fCS.M);
  const dFusteEstim = geom.tbase - recFuste - 0.016 / 2;
  const cortFuste = (d: number) => {
    const a = intFuste((zc) => presionEstatica(perfil, zc), d);
    const b = intFuste((zc) => presionSismo(sismo, zc, H), d);
    return Math.max(1.7 * a.V, 1.25 * a.V + 1.0 * (b.V + inerciaFuste(d).V));
  };
  const VuFusteAnal = cortFuste(dFusteEstim);

  // Zapata: envolvente analítica sobre las mismas combinaciones ULS.
  const ulsCombos = COMBINACIONES.filter((c) => c.tipo === "ULS");
  const wDownPuntera = gammaC * geom.hf + gammaFront * Math.max(0, geom.Df - geom.hf);
  const wDownTalon = gammaC * geom.hf + eq.gamma * geom.hp;
  let MuPunteraAnal = 0;
  let VuPunteraAnal = 0;
  let MuTalonAnal = 0;
  let VuTalonAnal = 0;
  const filasAnal: string[][] = [];
  const dZapEstim = geom.hf - recZap - 0.016 / 2;

  for (const c of ulsCombos) {
    const fac: Factores = {
      CM: c.factores.CM ?? 0,
      CV: c.factores.CV ?? 0,
      CE: c.factores.CE ?? 0,
      CS: c.factores.CS ?? 0,
    };
    const r = resultanteFactorizada(est, fac, kv);
    // Puntera: presión neta hacia arriba.
    const netoP = (x: number) => Math.max(0, r.p(x) - fac.CM * wDownPuntera);
    const Mp = integrarMomento(0, geom.Ltoe, 200, netoP, geom.Ltoe);
    const Vp = integrar(0, Math.max(geom.Ltoe - dZapEstim, 0), 200, netoP).F;
    // Talón: carga neta hacia abajo.
    const netoT = (x: number) =>
      Math.max(0, fac.CM * wDownTalon + fac.CV * q - r.p(x) - fac.CM * perfil.uFondo);
    const Mt = integrarMomento(geom.Ltoe + geom.tbase, B, 200, netoT, geom.Ltoe + geom.tbase);
    const Vt = integrar(geom.Ltoe + geom.tbase, B, 200, netoT).F;
    MuPunteraAnal = Math.max(MuPunteraAnal, Mp);
    VuPunteraAnal = Math.max(VuPunteraAnal, Vp);
    MuTalonAnal = Math.max(MuTalonAnal, Mt);
    VuTalonAnal = Math.max(VuTalonAnal, Vt);
    filasAnal.push([
      c.nombre,
      U.nF(r.Nu),
      U.nL(r.e),
      U.nP(r.q1),
      U.nP(r.q2),
      U.nM(Mp),
      U.nM(Mt),
    ]);
  }

  // --- Vía FEM ---
  const combULS = fem.combos.filter((c) => c.combo.tipo === "ULS");
  let MuFusteFem = 0;
  let VuFusteFem = 0;
  let MuPunteraFem = 0;
  let VuPunteraFem = 0;
  let MuTalonFem = 0;
  let VuTalonFem = 0;
  for (const c of combULS) {
    const sf = serieFuste(mesh, c.esfuerzos);
    const sz = serieZapata(mesh, c.esfuerzos);
    MuFusteFem = Math.max(MuFusteFem, Math.abs(valorEn(sf, mesh.caraFuste, "infY")));
    VuFusteFem = Math.max(VuFusteFem, Math.abs(valorEn(sf, mesh.caraFuste + dFusteEstim, "qy")));
    MuPunteraFem = Math.max(MuPunteraFem, Math.abs(valorEn(sz, mesh.caraPuntera, "infY")));
    VuPunteraFem = Math.max(
      VuPunteraFem,
      Math.abs(valorEn(sz, Math.max(mesh.caraPuntera - dZapEstim, 0), "qy")),
    );
    MuTalonFem = Math.max(MuTalonFem, Math.abs(valorEn(sz, mesh.caraTalon, "supY")));
    VuTalonFem = Math.max(VuTalonFem, Math.abs(valorEn(sz, mesh.caraTalon, "qy")));
  }

  const usaFem = metodoDiseno === "fem";
  const MuFuste = usaFem ? MuFusteFem : MuFusteAnal;
  const VuFuste = usaFem ? VuFusteFem : VuFusteAnal;
  const MuPuntera = usaFem ? MuPunteraFem : MuPunteraAnal;
  const VuPuntera = usaFem ? VuPunteraFem : VuPunteraAnal;
  const MuTalon = usaFem ? MuTalonFem : MuTalonAnal;
  const VuTalon = usaFem ? VuTalonFem : VuTalonAnal;

  steps.push({
    n: "14",
    title: "7. Diseño del acero de refuerzo (E.060) — método adoptado",
    formula: "φ = 0.90 en flexión y 0.85 en cortante  [E.060 9.3.2]",
    substitution: usaFem
      ? "Los Mu y Vu provienen de la envolvente del modelo FEM de §6 (Wood & Armer), con las combinaciones de §3 ya aplicadas."
      : "Los Mu y Vu provienen del modelo de voladizos de Morales cap. 13 §7: el fuste se empotra en la zapata y resiste el empuje; la puntera trabaja con la presión del suelo hacia arriba y el talón con el peso del relleno hacia abajo.",
    result: `Método elegido: ${usaFem ? "ELEMENTOS FINITOS (envolvente §6)" : "ANALÍTICO (voladizos)"}`,
    table: {
      caption: `Solicitaciones de diseño según el método (por metro de muro; Mu en ${U.u.M} y Vu en ${U.u.F})`,
      headers: ["Elemento", "Mu analítico", "Mu FEM", "Vu analítico", "Vu FEM", "Adoptado Mu", "Adoptado Vu"],
      rows: [
        ["Fuste — cara del relleno", U.nM(MuFusteAnal), U.nM(MuFusteFem), U.nF(VuFusteAnal), U.nF(VuFusteFem), U.nM(MuFuste), U.nF(VuFuste)],
        ["Puntera — malla inferior", U.nM(MuPunteraAnal), U.nM(MuPunteraFem), U.nF(VuPunteraAnal), U.nF(VuPunteraFem), U.nM(MuPuntera), U.nF(VuPuntera)],
        ["Talón — malla superior", U.nM(MuTalonAnal), U.nM(MuTalonFem), U.nF(VuTalonAnal), U.nF(VuTalonFem), U.nM(MuTalon), U.nF(VuTalon)],
      ],
    },
    desarrollo: [
      "Los mínimos, las separaciones máximas y las verificaciones de la E.060 se aplican igual con cualquiera de las dos vías: el método solo decide de dónde salen Mu y Vu.",
      usaFem
        ? "La vía FEM reparte la presión de contacto según la rigidez real de la zapata y del suelo, en lugar de suponerla lineal, y tiene en cuenta que el nudo fuste–zapata es un marco rígido y no dos voladizos independientes."
        : "La vía analítica supone distribución lineal de presiones y voladizos independientes. Es la que recogen los textos y suele ser la referencia de contraste.",
    ],
  });

  const barFuste = barFusteSel === "auto"
    ? elegirBarra(Math.max(MuFuste / (0.9 * (fy * 1000) * 0.9 * dFusteEstim) * 1e4, 5), 10, 25, 1)
    : barByName(barFusteSel);
  const barZap = barZapSel === "auto"
    ? elegirBarra(Math.max(Math.max(MuPuntera, MuTalon) / (0.9 * (fy * 1000) * 0.9 * dZapEstim) * 1e4, 5), 10, 25, 1)
    : barByName(barZapSel);

  const dFuste: DisenoFranja = disenarFranja({
    h: geom.tbase,
    rec: recFuste,
    Mu: MuFuste,
    Vu: VuFuste,
    fc,
    fy,
    bar: barFuste,
    sMax: Math.min(45, 3 * geom.tbase * 100),
    rhoMinTemp: 0.0015,
  ...opcSep,
  });
  const dPuntera = disenarFranja({
    h: geom.hf,
    rec: recZap,
    Mu: MuPuntera,
    Vu: VuPuntera,
    fc,
    fy,
    bar: barZap,
    sMax: Math.min(45, 3 * geom.hf * 100),
    rhoMinTemp: 0.0018,
  ...opcSep,
  });
  const dTalon = disenarFranja({
    h: geom.hf,
    rec: recZap,
    Mu: MuTalon,
    Vu: VuTalon,
    fc,
    fy,
    bar: barZap,
    sMax: Math.min(45, 3 * geom.hf * 100),
    rhoMinTemp: 0.0018,
  ...opcSep,
  });

  const paso = (
    n: string,
    title: string,
    d: DisenoFranja,
    cara: string,
    notas: string[],
  ): CalcStep => ({
    n,
    title,
    formula: "As = Mu/(φ·fy·(d − a/2))  ·  φVc = φ·0.17·√f'c·b·d  [E.060 (10-3), (11-3)]",
    formulaTex: String.raw`A_s=\frac{M_u}{\phi f_y\left(d-\frac{a}{2}\right)}=\frac{${f1(d.Mu)}\ \text{kN·m/m}}{0.90\times${f1(fy)}\times10^3\left(${f3(d.d)}-\frac{${f3(d.a)}}{2}\right)}=${f2(d.As)}\ \text{cm}^2/\text{m}`,
    substitution: `d = h − rec − db/2 = ${f3(U.L(d.h))} − ${f3(U.L(d.h === geom.tbase ? recFuste : recZap))} − ${f3(U.L(d.bar.db / 200))} = ${U.fL(d.d, 3)}`,
    result: `${cara}: ${d.texto} (As prov = ${U.fAs(d.AsProv)})`,
    ok: d.okM && d.okV,
    desarrollo: [
      `As requerido = ${U.fAs(d.As)} · As mín = ${U.fAs(d.AsMin)} · As máx (0.75ρb) = ${U.fAs(d.AsMax)}${d.rigeMin ? " → rige el mínimo" : ""}`,
      `Separación calculada ${rotS((d.bar.as / Math.max(d.As, d.AsMin)) * 100)}, adoptada ${rotS(d.s)} ≤ s_max = ${rotS(d.sMax)} [E.060 7.6.5]`,
      `φMn = 0.90·As·fy·(d − a/2) = ${U.fM(d.phiMn)} ≥ Mu = ${U.fM(d.Mu)}`,
      `φVc = 0.85×0.17√f'c×b×d = ${U.fF(d.phiVc)} ≥ Vu = ${U.fF(d.Vu)}`,
      `Longitud de desarrollo en tracción ℓd = ${U.fL(d.ld)} [E.060 12.2 Tabla 12.1]`,
      ...notas,
    ],
    note: !d.okV
      ? `El cortante no pasa sin estribos: φVc = ${U.nF(d.phiVc)} < Vu = ${U.fF(d.Vu)}. En elementos de este tipo la solución es aumentar el canto, no colocar estribos.`
      : undefined,
  });

  steps.push(
    paso("15", "7.1 Fuste — malla vertical posterior (cara del relleno)", dFuste, "Malla vertical posterior", [
      `Mu tomado en el arranque sobre la zapata; Vu a la distancia d de la base [E.060 11.1.3.1].`,
      usaFem
        ? `Valor FEM de la envolvente en Z = ${f2(mesh.caraFuste)} m (cara superior de la zapata).`
        : `Mu = máx(1.70·M_CE ; 1.25·M_CE + 1.00·M_ΔPae) = máx(${f1(1.7 * fCE.M)} ; ${f1(1.25 * fCE.M + fCS.M)}) kN·m/m`,
      `El corte de la malla posterior se define en §7.2.`,
    ]),
  );

  // 7.2 Corte del refuerzo del fuste por niveles.
  const niveles = [
    { nombre: "Inferior (base)", z: 0 },
    { nombre: "Intermedio", z: geom.hp / 2 },
    { nombre: "Superior (corona)", z: (2 * geom.hp) / 3 },
  ];
  const filasNivel = niveles.map((nv) => {
    const t = geom.tbase + ((geom.ttop - geom.tbase) * nv.z) / Math.max(geom.hp, 1e-9);
    const a = intFuste((zc) => presionEstatica(perfil, zc), nv.z);
    const bEmp = intFuste((zc) => presionSismo(sismo, zc, H), nv.z);
    const b = { M: bEmp.M + inerciaFuste(nv.z).M };
    const MuN = usaFem
      ? Math.max(
          ...combULS.map((c) => Math.abs(valorEn(serieFuste(mesh, c.esfuerzos), mesh.caraFuste + nv.z, "infY"))),
        )
      : Math.max(1.7 * a.M, 1.25 * a.M + b.M);
    const dn = disenarFranja({
      h: t,
      rec: recFuste,
      Mu: MuN,
      Vu: 0,
      fc,
      fy,
      bar: barFuste,
      sMax: Math.min(45, 3 * t * 100),
      rhoMinTemp: 0.0015,
    ...opcSep,
    });
    return { nv, t, MuN, dn };
  });
  // Altura a la que el momento cae a la mitad: punto de corte teórico.
  const Lc = (() => {
    const objetivo = MuFuste / 2;
    for (let i = 1; i <= 200; i++) {
      const z = (geom.hp * i) / 200;
      const a = intFuste((zc) => presionEstatica(perfil, zc), z);
      const b = intFuste((zc) => presionSismo(sismo, zc, H), z);
      if (Math.max(1.7 * a.M, 1.25 * a.M + b.M + inerciaFuste(z).M) <= objetivo) return z;
    }
    return geom.hp / 2;
  })();
  const LcTotal = Lc + Math.max(dFuste.d, 12 * dFuste.bar.db / 100);

  steps.push({
    n: "16",
    title: "7.2 Fuste — corte del refuerzo por niveles",
    formula: "El refuerzo se corta donde ya no se necesita, más la extensión de d o 12db  [E.060 12.10.3]",
    substitution: `Momento mitad del de la base a z = ${U.fL(Lc)}; corte efectivo a ${U.fL(LcTotal)} sobre la zapata`,
    result: `Se mantiene ${dFuste.texto} hasta ${U.fL(LcTotal)} y encima ${filasNivel[1].dn.texto}`,
    table: {
      caption: "Refuerzo requerido por nivel del fuste",
      headers: [
        "Nivel", `z sobre la zapata (${U.u.L})`, `t (${U.u.L})`, `Mu (${U.u.M})`, `As req (${U.u.As})`, "Refuerzo",
      ],
      rows: filasNivel.map((r) => [
        r.nv.nombre,
        U.nL(r.nv.z),
        U.nL(r.t),
        U.nM(r.MuN),
        U.nAs(Math.max(r.dn.As, r.dn.AsMin)),
        r.dn.texto,
      ]),
    },
    desarrollo: [
      `La barra que se corta debe prolongarse d = ${U.fL(dFuste.d)} o 12db = ${U.fL((12 * dFuste.bar.db) / 100)} más allá del punto teórico, y anclarse ℓd = ${U.fL(dFuste.ld)}.`,
      "Calcular el refuerzo en cada nivel evita mantener la cuantía de la base en toda la altura, que es donde se va el concreto y el acero de un muro alto.",
    ],
  });

  steps.push(
    paso("17", "7.3 Puntera — malla inferior", dPuntera, "Malla inferior transversal", [
      `Sección crítica de momento en la cara del fuste (x = ${U.fL(geom.Ltoe)}) y de cortante a d de esa cara [E.060 15.4.2(a) y 11.1.3.1].`,
      `Presión neta hacia arriba = q_u(x) − ${U.fP(wDownPuntera)} (peso propio de la zapata y del suelo sobre la puntera).`,
    ]),
  );
  steps.push(
    paso("18", "7.4 Talón — malla superior", dTalon, "Malla superior transversal", [
      `Sección crítica en la cara del fuste (x = ${U.fL(geom.Ltoe + geom.tbase)}). El cortante se toma en la cara, no a d, porque la carga cuelga del talón.`,
      `Carga neta hacia abajo = ${U.fP(wDownTalon)} + q − q_u(x)${perfil.uFondo > 1e-6 ? ` − u = ${U.fP(perfil.uFondo)}` : ""}.`,
    ]),
  );

  // 7.5 Refuerzo mínimo (E.060 §14.3). Separación comercial con As,prov ≥ As,req por cara.
  const rhoH = 0.0020;
  const rhoVfrontal = 0.0015;
  const AsHtot = rhoH * geom.tbase * 1e4;
  const AsVftot = rhoVfrontal * geom.tbase * 1e4;
  const capas = geom.tbase > 0.25 ? 2 : 1;
  const sMaxMuro = Math.min(45, 3 * geom.tbase * 100);
  const mallaH = elegirMallaCon(AsHtot / capas, sMaxMuro, seps);
  const mallaVf = elegirMallaCon(AsVftot / capas, sMaxMuro, seps);
  const sH = mallaH.s;
  const sVf = mallaVf.s;
  const AsH = AsHtot / capas;
  const AsVf = AsVftot / capas;
  const mallaZapLong = elegirMallaCon(0.0018 * geom.hf * 1e4, Math.min(45, 3 * geom.hf * 100), seps);

  steps.push({
    n: "19",
    title: "7.5 Refuerzo mínimo horizontal y de montaje",
    formula: "ρh ≥ 0.0020 y ρv ≥ 0.0015 en muros  [E.060 14.3.2 y 14.3.3]",
    formulaTex: String.raw`A_{s,h}=\rho_h\, t = 0.0020\times${f2(geom.tbase)}\ \text{m}\times10^4 = ${f2(AsHtot)}\ \text{cm}^2/\text{m}`,
    substitution: `t = ${U.fL(geom.tbase)} > ${U.fL(0.25)} → el refuerzo se reparte en ${capas} capas [E.060 14.3.4]`,
    result: `Horizontal Ø ${mallaH.bar.name} @ ${rotS(sH)} en ${capas} capas · vertical frontal Ø ${mallaVf.bar.name} @ ${rotS(sVf)}`,
    desarrollo: [
      `As horizontal mínimo total = ${U.fAs(AsHtot)}; por cara = ${U.fAs(AsH)} → Ø ${mallaH.bar.name} @ ${rotS(sH)} (As,prov = ${U.fAs(mallaH.AsProv)}).`,
      `As vertical de la cara frontal = ${U.fAs(AsVf)} (montaje, E.060 14.3.3) → Ø ${mallaVf.bar.name} @ ${rotS(sVf)} (As,prov = ${U.fAs(mallaVf.AsProv)}).`,
      `Separación máxima: la menor de 3t = ${rotS(3 * geom.tbase * 100)} y ${rotS(45)} [E.060 14.3.5].`,
      `Zapata: la malla que no trabaja a flexión lleva el mínimo de retracción y temperatura ρ = 0.0018 [E.060 9.7.2] → Ø ${mallaZapLong.bar.name} @ ${rotS(mallaZapLong.s)}.`,
    ],
  });

  checks.push(ok("Fuste — φMn ≥ Mu", U.fM(dFuste.phiMn), `≥ ${U.fM(dFuste.Mu)}`, dFuste.okM));
  checks.push(ok("Fuste — φVc ≥ Vu", U.fF(dFuste.phiVc), `≥ ${U.fF(dFuste.Vu)}`, dFuste.okV));
  checks.push(ok("Puntera — φMn ≥ Mu", U.fM(dPuntera.phiMn), `≥ ${U.fM(dPuntera.Mu)}`, dPuntera.okM));
  checks.push(ok("Puntera — φVc ≥ Vu", U.fF(dPuntera.phiVc), `≥ ${U.fF(dPuntera.Vu)}`, dPuntera.okV));
  checks.push(ok("Talón — φMn ≥ Mu", U.fM(dTalon.phiMn), `≥ ${U.fM(dTalon.Mu)}`, dTalon.okM));
  checks.push(ok("Talón — φVc ≥ Vu", U.fF(dTalon.phiVc), `≥ ${U.fF(dTalon.Vu)}`, dTalon.okV));

  /* ── §7.6 Deflexión de servicio del fuste ──
   * El fuste es un voladizo esbelto y lo que se le pide en servicio no es
   * resistencia sino que no se note: se integra la curvatura real, con la
   * inercia efectiva de Branson sección a sección, y se compara con h_p/150.
   */
  const nDef = 120;
  const deflex = (() => {
    const fr = frMPa(fc);
    let delta = 0;
    let MaBase = 0;
    let IeBase = 0;
    let McrBase = 0;
    const filas: string[][] = [];
    for (let i = 0; i < nDef; i++) {
      const y = (geom.hp * (i + 0.5)) / nDef; // altura del centro del tramo
      const t = geom.tbase + ((geom.ttop - geom.tbase) * y) / Math.max(geom.hp, 1e-9);
      const dSec = Math.max(t - recFuste - dFuste.bar.db / 200, 0.05);
      // Momento de servicio: empuje estático sin amplificar [E.060 9.6.2].
      const Ma = intFuste((zc) => presionEstatica(perfil, zc), y).M;
      const { Ig, Icr } = inerciasFranja(t, dSec, dFuste.AsProv, Ec);
      const Mcr = (fr * 1000 * Ig) / (t / 2); // kN·m/m
      const Ie = inerciaEfectiva(Ig, Icr, Mcr, Ma);
      const kappa = Ma / (Ec * Ie); // 1/m
      delta += kappa * (geom.hp - y) * (geom.hp / nDef);
      if (i === 0) {
        MaBase = Ma;
        IeBase = Ie;
        McrBase = Mcr;
        filas.push(["Base", U.nL(t), U.nM(Ma), U.nM(Mcr), fmt(Ig * 1e4, 2), fmt(Icr * 1e4, 2), fmt(Ie * 1e4, 2)]);
      }
      if (i === Math.floor(nDef / 2)) {
        filas.push(["Media altura", U.nL(t), U.nM(Ma), U.nM(Mcr), fmt(Ig * 1e4, 2), fmt(Icr * 1e4, 2), fmt(Ie * 1e4, 2)]);
      }
    }
    const adm = geom.hp / 150;
    return { delta, adm, MaBase, IeBase, McrBase, fr, filas, ok: delta <= adm };
  })();

  steps.push({
    n: "19b",
    title: "7.6 Deflexión del fuste en servicio",
    formula: "δ = ∫₀^hp [M(y)/(Ec·Ie(y))]·(hp − y) dy  ≤  hp/150",
    formulaTex: String.raw`\delta=\int_0^{h_p}\frac{M(y)}{E_c I_e(y)}\,(h_p-y)\,dy,\qquad I_e=I_{cr}+(I_g-I_{cr})\left(\frac{M_{cr}}{M_a}\right)^3`,
    substitution: `Ec = ${U.fE(Ec)} · fr = 0.62√f'c = ${U.fFc(deflex.fr)} · Mcr en la base = ${U.fM(deflex.McrBase)} · Ma de servicio = ${U.fM(deflex.MaBase)}`,
    result: `δ = ${fmt(deflex.delta * 1000, 1)} mm ≤ hp/150 = ${fmt(deflex.adm * 1000, 1)} mm`,
    ok: deflex.ok,
    table: {
      caption: "Inercias de la sección del fuste (×10⁴ m⁴/m)",
      headers: ["Sección", `t (${U.u.L})`, `Ma (${U.u.M})`, `Mcr (${U.u.M})`, "Ig", "Icr", "Ie"],
      rows: deflex.filas,
    },
    desarrollo: [
      `La deflexión se calcula con cargas de servicio, sin factores: el empuje estático del terreno más la sobrecarga tal como actúan [E.060 9.6.2].`,
      `Icr se obtiene por sección transformada con n = Es/Ec = ${f1(ES_MPA / (Ec / 1000))}, armadura ${dFuste.texto} en la cara del relleno.`,
      deflex.MaBase > deflex.McrBase
        ? `La base fisura (Ma = ${U.nM(deflex.MaBase)} > Mcr = ${U.nM(deflex.McrBase)}), así que ahí gobierna la inercia efectiva de Branson; en las secciones altas, donde Ma < Mcr, se conserva Ig.`
        : `Ninguna sección alcanza el momento de agrietamiento, de modo que el fuste trabaja con la inercia bruta en toda su altura.`,
      `El límite hp/150 = ${U.fL(deflex.adm, 3)} es la práctica corriente para muros de contención: no es un estado límite de la E.060 (la Tabla 9.2 no cubre muros en voladizo), sino un control de aspecto y de compatibilidad con lo que se apoye en la corona.`,
      `La deflexión diferida por flujo plástico multiplica esta cifra por 2 a 3 en el largo plazo; si el muro sostiene un elemento sensible, conviene comprobarla con λΔ [E.060 9.6.2.5].`,
    ],
    note: deflex.ok
      ? undefined
      : `δ = ${fmt(deflex.delta * 1000, 1)} mm supera hp/150 = ${fmt(deflex.adm * 1000, 1)} mm. La salida es engrosar el fuste en la base: la rigidez crece con t³, mucho más rápido que añadiendo acero.`,
  });
  checks.push(
    ok(
      "Deflexión del fuste en servicio",
      `${fmt(deflex.delta * 1000, 1)} mm`,
      `≤ hp/150 = ${fmt(deflex.adm * 1000, 1)} mm`,
      deflex.ok,
    ),
  );

  /* ── §8 Contraste ── */
  const dif = (a: number, b: number) => (Math.abs(b) < 1e-9 ? 0 : ((a - b) / b) * 100);
  steps.push({
    n: "20",
    title: "8. Contraste — cálculo analítico frente a elementos finitos",
    formula: "Diferencia = (FEM − analítico)/analítico",
    result: `Fuste ${f1(dif(MuFusteFem, MuFusteAnal))} % · Puntera ${f1(dif(MuPunteraFem, MuPunteraAnal))} % · Talón ${f1(dif(MuTalonFem, MuTalonAnal))} %`,
    table: {
      caption: `Momentos de diseño por elemento (${U.u.M})`,
      headers: ["Elemento", "Analítico", "FEM (Wood & Armer)", "Diferencia"],
      rows: [
        ["Fuste — cara del relleno", U.nM(MuFusteAnal), U.nM(MuFusteFem), `${f1(dif(MuFusteFem, MuFusteAnal))} %`],
        ["Puntera — malla inferior", U.nM(MuPunteraAnal), U.nM(MuPunteraFem), `${f1(dif(MuPunteraFem, MuPunteraAnal))} %`],
        ["Talón — malla superior", U.nM(MuTalonAnal), U.nM(MuTalonFem), `${f1(dif(MuTalonFem, MuTalonAnal))} %`],
      ],
    },
    desarrollo: [
      "En el fuste las dos vías deben coincidir: es un voladizo isostático y el momento en su arranque solo depende del empuje aplicado, no de la rigidez del apoyo. Una diferencia apreciable ahí indica un dato mal introducido.",
      "En la zapata la diferencia sí es esperable y suele ser favorable al FEM. El método analítico supone presión lineal y dos voladizos independientes; el FEM reparte la presión según la rigidez relativa zapata–suelo y reconoce que el nudo con el fuste es un marco rígido, lo que descarga las caras interiores.",
      `Presión máxima de contacto: ${U.fP(est.qMax)} por el reparto lineal frente a ${U.fP(fem.combos.find((c) => c.combo.tipo === "SLS")?.presionMax ?? 0)} del modelo de Winkler en servicio.`,
      "Ambas columnas se calculan siempre; el selector de §7 decide cuál gobierna el armado, y la memoria deja constancia de las dos.",
    ],
  });

  extras.push({
    title: "Reparto de presiones amplificado por combinación (vía analítica)",
    rows: [
      [
        "Combinación", `Nu (${U.u.F})`, `e (${U.u.L})`, `q1 (${U.u.P})`, `q2 (${U.u.P})`,
        `Mu puntera (${U.u.M})`, `Mu talón (${U.u.M})`,
      ],
      ...filasAnal,
    ],
  });

  /* ── §9 Despiece ── */
  const despiece = calcularDespiece({
    geom,
    B,
    recFuste,
    recZap,
    fc,
    fy,
    fuste: { bar: dFuste.bar, s: dFuste.s, AsReq: Math.max(dFuste.As, dFuste.AsMin) },
    fusteSup: { AsReq: Math.max(filasNivel[1].dn.As, filasNivel[1].dn.AsMin) },
    Lcorte: LcTotal,
    puntera: { bar: dPuntera.bar, s: dPuntera.s },
    talon: { bar: dTalon.bar, s: dTalon.s },
    horizontal: { bar: mallaH.bar, s: sH, capas },
    frontal: { bar: mallaVf.bar, s: sVf },
    zapLong: { bar: mallaZapLong.bar, s: mallaZapLong.s },
    una: { prof: unaProf, ancho: unaAncho },
    Lpanel: femOpts.Lpanel,
  });
  avisos.push(...despiece.avisos);

  const ancF = despiece.anc.fuste;

  steps.push({
    n: "21",
    title: "9.1 Anclajes, ganchos y traslapes",
    formula: "ℓd = fy·ψ/(2.1√f'c)·db · ℓdh = 100·db/√f'c · ℓdc = 0.24·fy·db/√f'c · traslape = 1.3·ℓd",
    formulaTex: String.raw`\ell_d=\frac{f_y\psi_t\psi_e\lambda}{2.1\sqrt{f'_c}}d_b,\quad \ell_{dh}=\frac{100\,d_b}{\sqrt{f'_c}},\quad \ell_{dc}=\frac{0.24 f_y d_b}{\sqrt{f'_c}},\quad \ell_{tr}=1.3\ell_d`,
    substitution: `f'c = ${U.fFc(fc)} · fy = ${U.fFc(fy)}`,
    result: `Fuste Ø ${dFuste.bar.name}: ℓd = ${U.fL(ancF.ld)} · ℓdh = ${U.fL(ancF.ldh)} · pata 12db = ${U.fL(ancF.ext90)} · traslape = ${U.fL(ancF.traslape)}`,
    table: {
      caption: "Longitudes de anclaje por diámetro empleado",
      headers: [
        "Ø", `ℓd tracción (${U.u.L})`, `ℓdh gancho (${U.u.L})`, `ℓdc compresión (${U.u.L})`,
        `Pata 12db (${U.u.L})`, `Ø de doblado (${U.u.L})`, `Traslape 1.3ℓd (${U.u.L})`,
      ],
      rows: [...new Map(
        [dFuste.bar, dPuntera.bar, dTalon.bar, mallaH.bar, mallaVf.bar, mallaZapLong.bar]
          .map((b) => [b.name, b] as const),
      ).values()].map((b) => {
        const a = anclaje(b, fc, fy);
        return [
          `Ø ${b.name}`, U.nL(a.ld, 3), U.nL(a.ldh, 3), U.nL(a.ldc, 3),
          U.nL(a.ext90, 3), U.nL(a.Dbend, 3), U.nL(a.traslape, 3),
        ];
      }),
    },
    desarrollo: [
      `ℓd de la Tabla 12.1 de la E.060 para barras con recubrimiento y separación normales: el coeficiente es 2.1 hasta Ø 5/8" y 1.7 para Ø 3/4" y mayores; el mínimo absoluto es 0.30 m.`,
      `ℓdh es el desarrollo de un gancho estándar de 90° o 180° medido desde la sección crítica hasta el extremo exterior del doblez, con mínimos de 8db y 0.15 m [E.060 12.5.1 y 12.5.2].`,
      `El diámetro interior de doblado es 6db hasta Ø 1" y 8db por encima [E.060 7.2.1]; la pata recta del gancho de 90° es 12db y la del de 180°, 4db pero no menos de 0.065 m [E.060 7.1].`,
      `Los traslapes son clase B (1.3·ℓd) porque en un muro se empalma más del 50 % del acero en la misma sección [E.060 12.15.2].`,
    ],
  });

  steps.push({
    n: "22",
    title: "9.2 Cuadro de despiece",
    formula: "Longitud de corte = Σ tramos rectos + desarrollo de los dobleces",
    substitution: `Paño de ${U.fL(femOpts.Lpanel)} para las barras que corren a lo largo del muro`,
    result: `${despiece.piezas.length} posiciones · ${fmt(despiece.peso, 1)} kg de acero por metro de muro`,
    table: {
      caption: `Despiece por metro de muro (longitudes en ${U.u.L})`,
      headers: ["Pos.", "Elemento", "Descripción", "Ø", "Separación", "Forma", "Tramos", "L corte", "kg/m"],
      rows: despiece.piezas.map((p) => [
        p.pos,
        p.elemento,
        p.descripcion,
        `Ø ${p.bar.name}`,
        p.s > 0 ? rotS(p.s) : "—",
        p.forma === "recta" ? "Recta" : p.forma === "L" ? "En L (un doblez)" : p.forma === "U" ? "En U (dos dobleces)" : "En Z",
        p.tramos.map((t) => U.nL(t.L, 2)).join(" + "),
        U.nL(p.Ltotal, 2),
        fmt(p.peso, 2),
      ]),
    },
    desarrollo: [
      ...despiece.piezas.flatMap((p) => [`${p.pos} ${p.descripcion}:`, ...p.justificacion.map((j) => `    ${j}`)]),
      `Peso total del refuerzo: ${fmt(despiece.peso, 1)} kg por metro de muro, equivalente a ${fmt(despiece.peso / (geom.hf * B + geom.hp * (geom.ttop + geom.tbase) / 2), 1)} kg por m³ de concreto.`,
    ],
  });

  /* ── Datos para las figuras ── */
  const nPtos = 60;
  const diagrama = Array.from({ length: nPtos + 1 }, (_, i) => {
    const z = (H * i) / nPtos;
    return {
      z: Number(z.toFixed(4)),
      e: Number(presionEstatica(perfil, z).toFixed(3)),
      s: Number(presionSismo(sismo, z, H).toFixed(3)),
    };
  });
  const uni = serializar(U);
  dims.muroGeom = JSON.stringify({
    uni,
    hp: geom.hp, hf: geom.hf, ttop: geom.ttop, tbase: geom.tbase,
    Ltoe: geom.Ltoe, Lheel: geom.Lheel, Df: geom.Df, B, H, talud,
    q, nf, estratos: estratos.map((e) => ({ n: e.nombre, t: e.espesor, g: e.gamma, phi: e.phi, c: e.c })),
    E: perfil.E, Eh: perfil.Eh, Ev: perfil.Ev, ybar: perfil.ybar, pMax: perfil.pMax,
    dPae: sismo.dPae, yS: sismo.y, pTop: sismo.pTop, pBot: sismo.pBot,
    W: est.sumaW, qMax: est.qMax, qMin: Math.min(est.q1, est.q2), e: est.e,
    diagrama,
    // Cuerpo libre y presiones de contacto para la figura de estabilidad.
    dcl: {
      bloques: est.bloques.map((b) => ({ n: b.n, nombre: b.nombre, tipo: b.tipo, W: b.W, x: b.x, y: b.y })),
      N: est.N, Ev: est.Ev, U: est.U, Fi: est.Fi, yFi: est.yFi,
      yEh: est.yEh, ySismo: est.ySismo, Ep: est.Ep, Kp: est.Kp,
      Mr: est.Mr, Mo: est.Mo, Mrs: est.Mrs, Mos: est.Mos,
      q1: est.q1, q2: est.q2, qMaxSis: est.qMaxSis, es: est.es, Bcomp: est.Bcomp,
      fsDesl: est.fsDesl, fsVolt: est.fsVolt, fsDeslSis: est.fsDeslSis, fsVoltSis: est.fsVoltSis,
      fsDeslMin, fsVoltMin, fsDeslSisMin, fsVoltSisMin,
      qadm, unaProf, unaAncho,
    },
  });
  /*
   * La figura del FEM dibuja la sección transversal del muro, así que basta la
   * franja central de la malla. Se exportan las aristas de cada celda (no los
   * centroides) para que el croquis pueda rellenar el mapa de calor sin tener
   * que reconstruir la retícula.
   */
  const ixFig = Math.floor((mesh.xGrid.length - 1) / 2);
  const env = fem.envolvente;
  const r3 = (x: number) => Number(x.toFixed(3));
  const r2 = (x: number) => Number(x.toFixed(2));
  const servicio = fem.combos.find((c) => c.combo.tipo === "SLS") ?? fem.combos[0];
  const sismico = fem.combos
    .filter((c) => c.combo.factores.CS)
    .reduce<typeof servicio | null>((a, c) => (!a || c.presionMax > a.presionMax ? c : a), null);
  dims.muroFem = JSON.stringify({
    uni,
    nNodos: fem.nNodos, nElem: fem.nElem, nEq: fem.nEcuaciones,
    Lpanel: femOpts.Lpanel, nx: femOpts.nx, ks: femOpts.ks, bordeX: femOpts.bordeX,
    sinTraccion: femOpts.sinTraccion,
    B, H, hp: geom.hp, hf: geom.hf, Ltoe: geom.Ltoe, tbase: geom.tbase, Lheel: geom.Lheel,
    caraFuste: mesh.caraFuste, caraPuntera: mesh.caraPuntera, caraTalon: mesh.caraTalon,
    zapata: mesh.elemZap[ixFig].map((idx, iy) => ({
      y0: r3(mesh.yGrid[iy]), y1: r3(mesh.yGrid[iy + 1]),
      zona: mesh.info[idx].zona,
      ms: r2(env.supY[idx]), mi: r2(env.infY[idx]), q: r2(env.q[idx]),
    })),
    fuste: mesh.elemFuste[ixFig].map((idx, iz) => ({
      z0: r3(mesh.zGrid[iz]), z1: r3(mesh.zGrid[iz + 1]),
      t: r3(mesh.info[idx].t), stub: mesh.info[idx].stub,
      ms: r2(env.supY[idx]), mi: r2(env.infY[idx]), q: r2(env.q[idx]),
    })),
    presion: mesh.yGrid.map((y, iy) => {
      const nodo = mesh.zapId[ixFig][iy];
      return {
        y: r3(y),
        lineal: r2(presionContacto(est, y)),
        fem: r2(servicio.presion.get(nodo) ?? 0),
        femSis: r2(sismico?.presion.get(nodo) ?? 0),
      };
    }),
    servicio: { nombre: servicio.combo.nombre, qMax: r2(servicio.presionMax), despegue: servicio.despegue, iter: servicio.iteraciones },
    sismico: sismico ? { nombre: sismico.combo.nombre, qMax: r2(sismico.presionMax), despegue: sismico.despegue } : null,
    qAdm: qadm,
  });
  dims.muroAcero = JSON.stringify({
    uni,
    hp: geom.hp, hf: geom.hf, ttop: geom.ttop, tbase: geom.tbase,
    Ltoe: geom.Ltoe, Lheel: geom.Lheel, B, H,
    recFuste, recZap,
    fuste: { bar: dFuste.bar.name, s: dFuste.s, As: dFuste.AsProv, Lc: LcTotal, ld: dFuste.ld, d: dFuste.d },
    fusteSup: { bar: filasNivel[1].dn.bar.name, s: filasNivel[1].dn.s, As: filasNivel[1].dn.AsProv },
    puntera: { bar: dPuntera.bar.name, s: dPuntera.s, As: dPuntera.AsProv, ld: dPuntera.ld },
    talon: { bar: dTalon.bar.name, s: dTalon.s, As: dTalon.AsProv, ld: dTalon.ld },
    temp: { bar: mallaH.bar.name, sH, barV: mallaVf.bar.name, sV: sVf, capas },
    una: { prof: unaProf, ancho: unaAncho },
    metodo: metodoDiseno,
    // El dibujo traza estas polilíneas tal cual: así el plano no puede
    // contradecir al cuadro de despiece.
    peso: despiece.peso,
    piezas: despiece.piezas.map((p) => ({
      pos: p.pos,
      el: p.elemento,
      desc: p.descripcion,
      bar: p.bar.name,
      s: p.s,
      forma: p.forma,
      L: p.Ltotal,
      pts: p.puntos,
      tramos: p.tramos.map((t) => ({ e: t.etiqueta, L: t.L })),
    })),
  });
  dims.metodoDiseno = metodoDiseno;

  if (avisos.length) {
    extras.push({ title: "Observaciones del cálculo", rows: avisos.map((a) => [a]) });
  }

  const todoOk = checks.every((c) => c.ok);
  const headline = `Muro en voladizo H = ${U.fL(H)} · B = ${U.fL(B)} · ${usaFem ? "diseño con envolvente FEM" : "diseño analítico"} · unidades ${U.u.F} / ${U.u.P} / ${U.u.Fc}`;
  const adoption = `Fuste ${dFuste.texto} · Puntera ${dPuntera.texto} · Talón ${dTalon.texto} · FS_d = ${f2(est.fsDesl)} / ${f2(est.fsDeslSis)} · FS_v = ${f2(est.fsVolt)} / ${f2(est.fsVoltSis)} · q_max = ${U.fP(est.qMax)}${todoOk ? "" : " · revisar verificaciones"}`;

  return { headline, adoption, steps, checks, extras, dims };
};

/** Momento de una carga distribuida respecto a una cara. */
function integrarMomento(
  a: number,
  b: number,
  n: number,
  f: (x: number) => number,
  cara: number,
) {
  if (b - a <= 1e-12) return 0;
  let M = 0;
  for (let i = 0; i < n; i++) {
    const x0 = a + ((b - a) * i) / n;
    const x1 = a + ((b - a) * (i + 1)) / n;
    const xm = (x0 + x1) / 2;
    M += f(xm) * (x1 - x0) * Math.abs(xm - cara);
  }
  return M;
}

export const muroSostenimientoEngines: Record<string, Engine> = {
  muroSostenimiento,
};
