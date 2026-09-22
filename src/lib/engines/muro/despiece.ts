/**
 * Despiece del refuerzo del muro en voladizo.
 *
 * Aquí se decide la forma de cada barra —dónde arranca, hacia dónde dobla, qué
 * longitud recta necesita y cuánto mide en total— a partir de las longitudes de
 * desarrollo y de los ganchos estándar de la E.060. La misma estructura alimenta
 * el cuadro de despiece de la memoria y el dibujo, de modo que el plano no puede
 * contradecir al cálculo: la figura traza exactamente estas polilíneas.
 *
 * Sistema de coordenadas (metros, el mismo de las demás figuras):
 *   x = 0 en la arista exterior de la puntera, creciendo hacia el talón
 *   y = 0 en el fondo de la zapata, creciendo hacia la corona
 *
 * Normas: E.060 §7.1 y §7.2 (ganchos y diámetros de doblado), §12.2 (ℓd),
 * §12.3 (ℓdc), §12.5 (ℓdh), §12.10.3 (prolongación más allá del punto teórico),
 * §12.15 (traslapes), §14.3 (refuerzo mínimo de muros) y §7.6.5 (separaciones).
 */

import type { BarDef } from "../../types";
import { anclaje, type Anclaje } from "./diseno";

/** Densidad del acero: 1 cm² de sección pesa 0.785 kg por metro lineal. */
const KG_POR_CM2_M = 0.785;

export type Tramo = { etiqueta: string; L: number };

export type Pieza = {
  pos: string;
  elemento: string;
  descripcion: string;
  bar: BarDef;
  /** Separación en cm; 0 cuando la pieza no se reparte con separación. */
  s: number;
  /** Forma normalizada, para el cuadro y para el dibujo. */
  forma: "recta" | "L" | "U" | "Z";
  /** Tramos rectos acotados, en el orden en que se recorre la barra. */
  tramos: Tramo[];
  /** Longitud total de corte, incluido el desarrollo de los dobleces (m). */
  Ltotal: number;
  /** Longitud de acero por metro de muro (m/m). */
  LporMetro: number;
  /** Peso por metro de muro (kg/m). */
  peso: number;
  /** Polilínea de la barra en coordenadas del muro, para el dibujo. */
  puntos: [number, number][];
  /** Justificación numérica: qué norma fija cada longitud. */
  justificacion: string[];
};

export type DespieceInput = {
  geom: { hp: number; hf: number; ttop: number; tbase: number; Ltoe: number; Lheel: number };
  B: number;
  recFuste: number;
  recZap: number;
  fc: number;
  fy: number;
  /** Malla vertical del trasdós en el arranque (la que resiste el momento máximo). */
  fuste: { bar: BarDef; s: number; AsReq: number };
  /** Requerimiento por encima del punto de corte. */
  fusteSup: { AsReq: number };
  /** Altura sobre la zapata hasta donde hace falta el refuerzo del arranque. */
  Lcorte: number;
  puntera: { bar: BarDef; s: number };
  talon: { bar: BarDef; s: number };
  /** Malla horizontal del fuste y vertical de la cara frontal. */
  horizontal: { bar: BarDef; s: number; capas: number };
  frontal: { bar: BarDef; s: number };
  zapLong: { bar: BarDef; s: number };
  una: { prof: number; ancho: number };
  /** Longitud del paño entre juntas, para las barras que corren a lo largo. */
  Lpanel: number;
};

export type Despiece = {
  piezas: Pieza[];
  /** Peso total del acero por metro de muro (kg/m). */
  peso: number;
  /** Anclajes calculados, por si la memoria los quiere citar. */
  anc: { fuste: Anclaje; zapata: Anclaje; horizontal: Anclaje };
  /** Separación entre la barra continua del trasdós y el bastón (cm). */
  sContinua: number;
  sBaston: number;
  /** Avisos cuando una longitud disponible obliga a doblar. */
  avisos: string[];
};

const r3 = (x: number) => Number(x.toFixed(3));
/** Longitud de una polilínea, que es la longitud real de corte de la barra. */
function largo(pts: [number, number][]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return L;
}

export function calcularDespiece(inp: DespieceInput): Despiece {
  const { geom, B, recFuste, recZap, fc, fy } = inp;
  const avisos: string[] = [];

  const aF = anclaje(inp.fuste.bar, fc, fy);
  const aZ = anclaje(inp.puntera.bar, fc, fy);
  const aH = anclaje(inp.horizontal.bar, fc, fy);
  const aT = anclaje(inp.talon.bar, fc, fy);

  /** Cara posterior del fuste (trasdós) a la altura y. */
  const xTras = (y: number) =>
    geom.Ltoe + geom.tbase + ((geom.ttop - geom.tbase) * Math.max(0, y - geom.hf)) / Math.max(geom.hp, 1e-9);
  const yCorona = geom.hf + geom.hp;

  /* ── ① y ② Malla vertical del trasdós ──
   * El momento del fuste decrece con la altura, así que la mitad de las barras
   * se corta en el punto de corte de §7.2 y la otra mitad sigue hasta la corona.
   * La continua tiene que cubrir por sí sola el requerimiento de arriba; si no,
   * no se corta ninguna.
   */
  const asBar = inp.fuste.bar.as;
  const sBase = inp.fuste.s;
  const sDoble = Math.min(2 * sBase, 45);
  const AsContinua = (asBar / sDoble) * 100;
  const corta = AsContinua + 1e-6 >= inp.fusteSup.AsReq && inp.Lcorte < geom.hp - 0.05;
  const sContinua = corta ? sDoble : sBase;
  const sBaston = corta ? sDoble : 0;

  /*
   * Anclaje del arranque en la zapata: la barra baja hasta la malla inferior,
   * dobla 90° y su pata se dirige hacia la puntera, que es donde el nudo está
   * comprimido. Lo que se desarrolla es la longitud del gancho ℓdh medida desde
   * la cara superior de la zapata [E.060 12.5].
   */
  const yMallaInf = recZap + aZ.db + aF.db / 2;
  const vertEnZapata = geom.hf - yMallaInf; // tramo vertical dentro de la zapata
  const dispHorizontal = Math.max(geom.Ltoe + geom.tbase - recZap - aF.db, 0);
  const patoNecesario = Math.max(aF.ext90, aF.ldh - vertEnZapata - aF.arco90);
  const pato = Math.min(patoNecesario, dispHorizontal);
  if (patoNecesario > dispHorizontal + 1e-6) {
    avisos.push(
      `El gancho del arranque del fuste necesita una pata de ${patoNecesario.toFixed(2)} m y solo caben ${dispHorizontal.toFixed(2)} m dentro de la zapata. Aumenta h_f o la puntera, o reduce el diámetro de la barra.`,
    );
  }
  const anclajeProv = vertEnZapata + aF.arco90 + pato;

  const xBase = xTras(geom.hf) - recFuste - aH.db - aF.db / 2;
  const xTop = xTras(yCorona) - recFuste - aH.db - aF.db / 2;
  const yTope = yCorona - recFuste;
  /** Punto del eje de la barra vertical a la altura y (sigue el talud del trasdós). */
  const xEje = (y: number) =>
    xBase + ((xTop - xBase) * (y - geom.hf)) / Math.max(yCorona - recFuste - geom.hf, 1e-9);

  const piezas: Pieza[] = [];

  const continua: [number, number][] = [
    [r3(xBase - pato), r3(yMallaInf)],
    [r3(xBase), r3(yMallaInf)],
    [r3(xTop), r3(yTope)],
  ];
  piezas.push({
    pos: "①",
    elemento: "Fuste",
    descripcion: "Malla vertical del trasdós — barra continua hasta la corona",
    bar: inp.fuste.bar,
    s: sContinua,
    forma: "L",
    tramos: [
      { etiqueta: "Pata del gancho de 90° en la zapata", L: r3(pato) },
      { etiqueta: "Tramo vertical dentro de la zapata", L: r3(vertEnZapata) },
      { etiqueta: "Tramo recto hasta la corona", L: r3(Math.hypot(xTop - xBase, yTope - geom.hf)) },
    ],
    Ltotal: r3(largo(continua)),
    LporMetro: r3((100 / sContinua) * largo(continua)),
    peso: r3((100 / sContinua) * largo(continua) * asBar * KG_POR_CM2_M),
    puntos: continua,
    justificacion: [
      `Gancho estándar de 90°: pata de 12db = ${(aF.ext90).toFixed(3)} m, diámetro de doblado ${(aF.Dbend).toFixed(3)} m = ${aF.Dbend / aF.db >= 7.9 ? "8" : "6"}db [E.060 7.1.1 y 7.2.1].`,
      `Desarrollo del gancho ℓdh = ${(aF.ldh).toFixed(3)} m; provisto ${(anclajeProv).toFixed(3)} m (vertical ${(vertEnZapata).toFixed(3)} + arco ${(aF.arco90).toFixed(3)} + pata ${(pato).toFixed(3)}) [E.060 12.5].`,
      `La pata se dirige hacia la puntera: es el lado donde el nudo fuste–zapata está comprimido y la barra no puede desprender el recubrimiento.`,
      `Separación ${sContinua.toFixed(1)} cm = ${corta ? "el doble de la del arranque, alternando con el bastón ②" : "la misma del arranque; no se corta ninguna barra porque la continua sola no cubre el requerimiento superior"}.`,
    ],
  });

  if (corta) {
    const yFinBaston = geom.hf + inp.Lcorte;
    const baston: [number, number][] = [
      [r3(xBase - pato), r3(yMallaInf)],
      [r3(xBase), r3(yMallaInf)],
      [r3(xEje(yFinBaston)), r3(yFinBaston)],
    ];
    piezas.push({
      pos: "②",
      elemento: "Fuste",
      descripcion: "Malla vertical del trasdós — bastón de arranque",
      bar: inp.fuste.bar,
      s: sBaston,
      forma: "L",
      tramos: [
        { etiqueta: "Pata del gancho de 90° en la zapata", L: r3(pato) },
        { etiqueta: "Tramo vertical dentro de la zapata", L: r3(vertEnZapata) },
        { etiqueta: "Tramo recto sobre la zapata", L: r3(Math.hypot(xEje(yFinBaston) - xBase, yFinBaston - geom.hf)) },
      ],
      Ltotal: r3(largo(baston)),
      LporMetro: r3((100 / sBaston) * largo(baston)),
      peso: r3((100 / sBaston) * largo(baston) * asBar * KG_POR_CM2_M),
      puntos: baston,
      justificacion: [
        `Corta a ${inp.Lcorte.toFixed(2)} m sobre la zapata: el punto donde el momento ya no lo necesita más la prolongación de d o 12db que exige la E.060 12.10.3.`,
        `Por encima del corte queda ① sola, con As = ${AsContinua.toFixed(2)} cm²/m ≥ ${inp.fusteSup.AsReq.toFixed(2)} cm²/m requerido.`,
        `El gancho inferior es el mismo de ①.`,
      ],
    });
  }

  /* ── ③ Malla vertical de la cara frontal ── */
  const aFr = anclaje(inp.frontal.bar, fc, fy);
  const embFrontal = Math.min(aFr.ldc, geom.hf - yMallaInf);
  const patoFrontal = embFrontal + 1e-6 < aFr.ldc ? Math.max(aFr.ext90, aFr.ldc - embFrontal) : 0;
  const xFrontal = geom.Ltoe + recFuste + aH.db + aFr.db / 2;
  const frontalPts: [number, number][] = patoFrontal > 0
    ? [
        [r3(xFrontal + patoFrontal), r3(geom.hf - embFrontal)],
        [r3(xFrontal), r3(geom.hf - embFrontal)],
        [r3(xFrontal), r3(yCorona - recFuste)],
      ]
    : [
        [r3(xFrontal), r3(geom.hf - embFrontal)],
        [r3(xFrontal), r3(yCorona - recFuste)],
      ];
  piezas.push({
    pos: "③",
    elemento: "Fuste",
    descripcion: "Malla vertical de la cara frontal — montaje y temperatura",
    bar: inp.frontal.bar,
    s: inp.frontal.s,
    forma: patoFrontal > 0 ? "L" : "recta",
    tramos: [
      ...(patoFrontal > 0 ? [{ etiqueta: "Pata de 90° en la zapata", L: r3(patoFrontal) }] : []),
      { etiqueta: "Empotramiento en la zapata", L: r3(embFrontal) },
      { etiqueta: "Tramo vertical hasta la corona", L: r3(yCorona - recFuste - (geom.hf - embFrontal) - embFrontal) },
    ],
    Ltotal: r3(largo(frontalPts)),
    LporMetro: r3((100 / inp.frontal.s) * largo(frontalPts)),
    peso: r3((100 / inp.frontal.s) * largo(frontalPts) * inp.frontal.bar.as * KG_POR_CM2_M),
    puntos: frontalPts,
    justificacion: [
      `Esta cara no tiene tracción por flexión: lleva el mínimo vertical ρ = 0.0015 de la E.060 14.3.3 y sirve para amarrar la malla horizontal.`,
      `Ancla en la zapata la longitud de desarrollo en compresión ℓdc = ${(aFr.ldc).toFixed(3)} m [E.060 12.3.2]${patoFrontal > 0 ? `, que no cabe recta en h_f y se completa con una pata de ${patoFrontal.toFixed(3)} m` : ""}.`,
    ],
  });

  /* ── ④ Malla horizontal del fuste ── */
  const nHoriz = (geom.hp / (inp.horizontal.s / 100)) * inp.horizontal.capas;
  const Lhoriz = inp.Lpanel + aH.traslape;
  piezas.push({
    pos: "④",
    elemento: "Fuste",
    descripcion: `Malla horizontal — ${inp.horizontal.capas} capa(s), ambas caras`,
    bar: inp.horizontal.bar,
    s: inp.horizontal.s,
    forma: "recta",
    tramos: [
      { etiqueta: "Longitud del paño", L: r3(inp.Lpanel) },
      { etiqueta: "Traslape clase B", L: r3(aH.traslape) },
    ],
    Ltotal: r3(Lhoriz),
    LporMetro: r3(nHoriz * (1 + aH.traslape / Math.max(inp.Lpanel, 1e-9))),
    peso: r3(nHoriz * (1 + aH.traslape / Math.max(inp.Lpanel, 1e-9)) * inp.horizontal.bar.as * KG_POR_CM2_M),
    puntos: [],
    justificacion: [
      `Corre a lo largo del muro; el cómputo por metro toma ${nHoriz.toFixed(1)} barras (h_p / s × ${inp.horizontal.capas} capas) más el traslape repartido.`,
      `Traslape en tracción clase B = 1.3·ℓd = ${(aH.traslape).toFixed(3)} m, no menor de 0.30 m [E.060 12.15.1].`,
    ],
  });

  /* ── ⑤ Malla inferior de la zapata ──
   * Es la que resiste el momento de la puntera. La sección crítica está en la
   * cara del fuste y la barra tiene que desarrollar ℓd desde allí hacia la
   * punta; si no le alcanza, termina en gancho de 90°.
   */
  const yInf = recZap + aZ.db / 2;
  const dispPuntera = geom.Ltoe - recZap;
  const necesitaGanchoP = dispPuntera + 1e-6 < aZ.ld;
  const patoP = necesitaGanchoP ? Math.max(aZ.ext90, aZ.ldh - dispPuntera - aZ.arco90) : 0;
  const patoTal = Math.max(aZ.ext90, 0); // el extremo del talón siempre se cierra
  const infPts: [number, number][] = [
    ...(patoP > 0 ? ([[r3(recZap), r3(yInf + patoP)]] as [number, number][]) : []),
    [r3(recZap), r3(yInf)],
    [r3(B - recZap), r3(yInf)],
    [r3(B - recZap), r3(yInf + patoTal)],
  ];
  if (necesitaGanchoP) {
    avisos.push(
      `La puntera solo ofrece ${dispPuntera.toFixed(2)} m desde la cara del fuste y ℓd = ${aZ.ld.toFixed(2)} m: la malla inferior se remata con gancho de 90° de ${patoP.toFixed(2)} m [E.060 12.5].`,
    );
  }
  piezas.push({
    pos: "⑤",
    elemento: "Zapata",
    descripcion: "Malla inferior transversal — momento de la puntera",
    bar: inp.puntera.bar,
    s: inp.puntera.s,
    forma: patoP > 0 ? "U" : "L",
    tramos: [
      ...(patoP > 0 ? [{ etiqueta: "Gancho de 90° en la punta", L: r3(patoP) }] : []),
      { etiqueta: "Tramo recto B − 2·rec", L: r3(B - 2 * recZap) },
      { etiqueta: "Gancho de 90° en el talón", L: r3(patoTal) },
    ],
    Ltotal: r3(largo(infPts)),
    LporMetro: r3((100 / inp.puntera.s) * largo(infPts)),
    peso: r3((100 / inp.puntera.s) * largo(infPts) * inp.puntera.bar.as * KG_POR_CM2_M),
    puntos: infPts,
    justificacion: [
      `Sección crítica en la cara del fuste, x = ${geom.Ltoe.toFixed(2)} m [E.060 15.4.2(a)].`,
      `Disponible hacia la punta ${dispPuntera.toFixed(3)} m frente a ℓd = ${(aZ.ld).toFixed(3)} m ${necesitaGanchoP ? "→ hace falta gancho" : "→ la barra recta desarrolla sin gancho"}.`,
      `La barra es continua en todo el ancho: no se corta bajo el fuste, donde la malla inferior también hace de tirante del nudo.`,
    ],
  });

  /* ── ⑥ Malla superior de la zapata ── */
  const ySup = geom.hf - recZap - aT.db / 2;
  const xCaraTalon = geom.Ltoe + geom.tbase;
  const xInicioSup = Math.max(recZap, xCaraTalon - Math.max(aT.ld, 12 * aT.db));
  const supPts: [number, number][] = [
    [r3(xInicioSup), r3(ySup)],
    [r3(B - recZap), r3(ySup)],
    [r3(B - recZap), r3(ySup - Math.max(aT.ext90, 0))],
  ];
  piezas.push({
    pos: "⑥",
    elemento: "Zapata",
    descripcion: "Malla superior transversal — momento del talón",
    bar: inp.talon.bar,
    s: inp.talon.s,
    forma: "L",
    tramos: [
      { etiqueta: "Prolongación más allá de la cara del fuste", L: r3(xCaraTalon - xInicioSup) },
      { etiqueta: "Tramo sobre el talón", L: r3(B - recZap - xCaraTalon) },
      { etiqueta: "Gancho de 90° en el extremo del talón", L: r3(Math.max(aT.ext90, 0)) },
    ],
    Ltotal: r3(largo(supPts)),
    LporMetro: r3((100 / inp.talon.s) * largo(supPts)),
    peso: r3((100 / inp.talon.s) * largo(supPts) * inp.talon.bar.as * KG_POR_CM2_M),
    puntos: supPts,
    justificacion: [
      `Sección crítica en la cara posterior del fuste, x = ${xCaraTalon.toFixed(2)} m: allí el talón cuelga y la tracción está arriba.`,
      `Se prolonga ${(xCaraTalon - xInicioSup).toFixed(3)} m hacia la puntera = máx(ℓd ; 12db) = máx(${aT.ld.toFixed(3)} ; ${(12 * aT.db).toFixed(3)}) [E.060 12.10.3 y 12.12.3].`,
      `Gancho de 90° hacia abajo en el borde del talón, que es un extremo libre.`,
    ],
  });

  /* ── ⑦ Malla longitudinal de la zapata ── */
  const aL = anclaje(inp.zapLong.bar, fc, fy);
  const nLong = (B / (inp.zapLong.s / 100)) * 2; // dos mallas
  const Llong = inp.Lpanel + aL.traslape;
  piezas.push({
    pos: "⑦",
    elemento: "Zapata",
    descripcion: "Malla longitudinal — retracción y temperatura, ambas mallas",
    bar: inp.zapLong.bar,
    s: inp.zapLong.s,
    forma: "recta",
    tramos: [
      { etiqueta: "Longitud del paño", L: r3(inp.Lpanel) },
      { etiqueta: "Traslape clase B", L: r3(aL.traslape) },
    ],
    Ltotal: r3(Llong),
    LporMetro: r3(nLong * (1 + aL.traslape / Math.max(inp.Lpanel, 1e-9))),
    peso: r3(nLong * (1 + aL.traslape / Math.max(inp.Lpanel, 1e-9)) * inp.zapLong.bar.as * KG_POR_CM2_M),
    puntos: [],
    justificacion: [
      `ρ = 0.0018 de retracción y temperatura en las dos mallas [E.060 9.7.2].`,
      `${nLong.toFixed(1)} barras por metro de muro (B/s en cada una de las dos mallas).`,
    ],
  });

  /* ── ⑧ Uña ── */
  if (inp.una.prof > 1e-6 && inp.una.ancho > 1e-6) {
    const xu0 = geom.Ltoe + geom.tbase / 2 - inp.una.ancho / 2;
    const xu1 = xu0 + inp.una.ancho;
    const uPts: [number, number][] = [
      [r3(xu0 + recZap), r3(yInf + aZ.ldh)],
      [r3(xu0 + recZap), r3(-inp.una.prof + recZap)],
      [r3(xu1 - recZap), r3(-inp.una.prof + recZap)],
      [r3(xu1 - recZap), r3(yInf + aZ.ldh)],
    ];
    piezas.push({
      pos: "⑧",
      elemento: "Uña",
      descripcion: "Estribo en U que envuelve la uña y se ancla en la zapata",
      bar: inp.puntera.bar,
      s: inp.puntera.s,
      forma: "U",
      tramos: [
        { etiqueta: "Rama vertical anclada en la zapata", L: r3(inp.una.prof - recZap + yInf + aZ.ldh) },
        { etiqueta: "Fondo de la uña", L: r3(inp.una.ancho - 2 * recZap) },
        { etiqueta: "Rama vertical anclada en la zapata", L: r3(inp.una.prof - recZap + yInf + aZ.ldh) },
      ],
      Ltotal: r3(largo(uPts)),
      LporMetro: r3((100 / inp.puntera.s) * largo(uPts)),
      peso: r3((100 / inp.puntera.s) * largo(uPts) * inp.puntera.bar.as * KG_POR_CM2_M),
      puntos: uPts,
      justificacion: [
        `La uña trabaja como un diente en voladizo empujado por el pasivo: el estribo en U toma esa tracción y se ancla en la zapata la longitud del gancho ℓdh = ${(aZ.ldh).toFixed(3)} m.`,
        `Se coloca con la separación de la malla inferior para poder amarrarlo a ella.`,
      ],
    });
  }

  const peso = piezas.reduce((a, p) => a + p.peso, 0);
  return {
    piezas,
    peso: r3(peso),
    anc: { fuste: aF, zapata: aZ, horizontal: aH },
    sContinua,
    sBaston,
    avisos,
  };
}
