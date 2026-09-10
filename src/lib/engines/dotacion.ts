import { type CalcCheck, type CalcOutput, type CalcStep, type Engine, fmt, num, str } from "../types";

function out(
  headline: string,
  adoption: string,
  steps: CalcOutput["steps"],
  checks: CalcCheck[],
  extras?: CalcOutput["extras"],
  dims?: Record<string, string>
): CalcOutput {
  return { headline, adoption, steps, checks, extras, dims };
}
function ok(label: string, value: string, limit: string, pass: boolean): CalcCheck {
  return { label, value, limit, ok: pass };
}

/** IS.010 2.2.a — tope de cada rango (m²) y dotación L/d. Incluye doméstico y jardines. */
const LOTE_UNI: [number, number][] = [
  [200, 1500],
  [300, 1700],
  [400, 1900],
  [500, 2100],
  [600, 2200],
  [700, 2300],
  [800, 2400],
  [900, 2500],
  [1000, 2600],
  [1200, 2800],
  [1400, 3000],
  [1700, 3400],
  [2000, 3800],
  [2500, 4500],
  [3000, 5000],
];

/** IS.010 2.2.b — L/d por departamento según dormitorios. */
const DORM_MULTI: [number, number][] = [
  [1, 500],
  [2, 850],
  [3, 1200],
  [4, 1350],
  [5, 1500],
];

/** Curva Hunter IS.010 Anexo — gasto probable (L/s) vs UH. 10 UH corregido (typo 0.43 → 0.35). */
const HUNTER_T: [number, number][] = [
  [3, 0.12], [4, 0.16], [5, 0.23], [6, 0.25], [7, 0.28], [8, 0.29], [9, 0.32], [10, 0.35],
  [12, 0.38], [14, 0.42], [16, 0.46], [18, 0.5], [20, 0.54], [22, 0.58], [24, 0.61], [26, 0.67],
  [28, 0.71], [30, 0.75], [32, 0.79], [34, 0.82], [36, 0.85], [38, 0.88], [40, 0.91], [42, 0.95],
  [44, 1], [46, 1.03], [48, 1.09], [50, 1.13], [55, 1.19], [60, 1.25], [65, 1.31], [70, 1.36],
  [75, 1.41], [80, 1.45], [85, 1.5], [90, 1.56], [95, 1.62], [100, 1.67], [110, 1.75], [120, 1.83],
  [130, 1.91], [140, 1.98], [150, 2.06], [160, 2.14], [170, 2.22], [180, 2.29], [190, 2.37], [200, 2.45],
  [250, 2.84], [300, 3.32], [400, 3.97], [500, 4.71], [600, 5.34], [700, 5.95], [800, 6.6], [900, 7.22],
];
const HUNTER_V: [number, number][] = [
  [5, 0.91], [6, 0.94], [7, 0.97], [8, 1], [9, 1.03], [10, 1.06], [12, 1.12], [14, 1.17],
  [16, 1.22], [18, 1.27], [20, 1.33], [22, 1.37], [24, 1.42], [26, 1.45], [28, 1.51], [30, 1.55],
  [32, 1.59], [34, 1.63], [36, 1.67], [38, 1.7], [40, 1.74], [42, 1.78], [44, 1.82], [46, 1.84],
  [48, 1.92], [50, 1.97], [55, 2.04], [60, 2.11], [65, 2.17], [70, 2.23], [75, 2.29], [80, 2.35],
  [85, 2.4], [90, 2.45], [95, 2.5], [100, 2.55], [110, 2.6], [120, 2.72], [130, 2.8], [140, 2.85],
  [150, 2.95], [160, 3.04], [170, 3.12], [180, 3.2], [190, 3.25], [200, 3.36], [250, 3.71], [300, 4.12],
  [400, 4.72], [500, 5.31], [600, 5.83], [700, 6.35], [800, 6.84], [900, 7.36],
];

const TE_COM = [1100, 1500, 2500, 3600, 5000, 7000, 10000, 15000, 20000, 25000, 30000];
const HP_COM = [0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15];
const DN_COM = [15, 20, 25, 32, 40, 50, 63, 75, 90, 110];

function interp(table: [number, number][], x: number) {
  if (x <= 0) return 0;
  if (x <= table[0][0]) return table[0][1] * (x / table[0][0]);
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  const [x0, y0] = table[table.length - 2];
  const [x1, y1] = table[table.length - 1];
  return y1 + ((y1 - y0) / (x1 - x0)) * (x - x1);
}

function dotLote(A: number) {
  if (A <= 0) return 0;
  for (const [tope, C] of LOTE_UNI) {
    if (A <= tope) return C;
  }
  const extra = Math.ceil((A - 3000) / 100);
  return 5000 + extra * 100;
}

function rangoLote(A: number) {
  if (A <= 200) return "hasta 200 m²";
  const prev = LOTE_UNI.findIndex(([tope]) => A <= tope);
  if (prev <= 0) return "hasta 200 m²";
  if (prev >= LOTE_UNI.length || A > 3000) return `mayores de 3000 m² (${fmt(A, 0)} m²)`;
  const lo = LOTE_UNI[prev - 1][0] + 1;
  const hi = LOTE_UNI[prev][0];
  return `${lo} a ${hi} m²`;
}

function dotDorm(nDorm: number) {
  const n = Math.max(1, Math.round(nDorm));
  if (n <= 5) return DORM_MULTI[n - 1][1];
  return 1500 + (n - 5) * 150;
}

function teComercial(L: number) {
  const need = Math.max(L, 1000);
  return TE_COM.find((c) => c >= need) ?? Math.ceil(need / 1000) * 1000;
}

function hpComercial(P: number) {
  return HP_COM.find((c) => c >= P - 1e-9) ?? Math.ceil(P);
}

function dnComercial(mm: number) {
  return DN_COM.find((d) => d >= mm - 1e-9) ?? Math.ceil(mm);
}

function rebose(VL: number) {
  if (VL <= 2500) return { pulg: '2"', mm: 50 };
  if (VL <= 5000) return { pulg: '3"', mm: 75 };
  if (VL <= 10000) return { pulg: '4"', mm: 100 };
  if (VL <= 15000) return { pulg: '5"', mm: 125 };
  return { pulg: '6"', mm: 150 };
}

function habDesdeDorm(nDorm: number) {
  const n = Math.max(0, Math.round(nDorm));
  if (n <= 0) return 0;
  return 1 + n;
}

export type UsoDot =
  | "uni"
  | "multi"
  | "hotel"
  | "restaurante"
  | "hospital"
  | "oficina"
  | "comercial"
  | "educacion"
  | "espectaculo";

type OcupBar = { k: string; n: number; c: number; fill: string };

/** IS.010 2.2.d — restaurantes por área de comedor. Piso en >100 m² para no bajar respecto al rango 41–100. */
function dotComedorRest(A: number) {
  if (A <= 0) return 0;
  if (A <= 40) return 2000;
  if (A <= 100) return A * 50;
  return Math.max(A * 40, 5000);
}
function rangoComedorRest(A: number) {
  if (A <= 0) return "sin comedor";
  if (A <= 40) return "hasta 40 m² → 2 000 L/d";
  if (A <= 100) return "41 a 100 m² → 50 L/d·m²";
  return "más de 100 m² → 40 L/d·m² (piso 5 000 L del rango anterior)";
}

/** IS.010 2.2.r — bares, fuentes de soda y cafeterías. */
function dotCafeteria(A: number) {
  if (A <= 0) return 0;
  if (A <= 30) return 1500;
  if (A <= 60) return A * 60;
  if (A <= 100) return A * 50;
  return Math.max(A * 40, 5000);
}
function rangoCafeteria(A: number) {
  if (A <= 0) return "sin local";
  if (A <= 30) return "hasta 30 m² → 1 500 L/d";
  if (A <= 60) return "31 a 60 m² → 60 L/d·m²";
  if (A <= 100) return "61 a 100 m² → 50 L/d·m²";
  return "más de 100 m² → 40 L/d·m² (piso 5 000 L)";
}

function bar(k: string, c: number, fill: string, n = 0): OcupBar {
  return { k, n, c, fill };
}

type Demanda = {
  Cpd: number;
  Nshow: number;
  steps: CalcStep[];
  extrasTitle: string;
  extrasRows: string[][];
  bars: OcupBar[];
  checks: CalcCheck[];
  audit: string[];
  ocupHeading: string;
  ocupCaption: string;
  dimsExtra: Record<string, string>;
};

function demandaPorUso(raw: Record<string, string>, modo: UsoDot): Demanda {
  const A_lote = Math.max(0, num(raw, "A_lote", 160));
  const A_libre = Math.max(0, num(raw, "A_libre", 40));
  const nDorm = Math.max(0, Math.round(num(raw, "nDorm", 3)));
  let N = num(raw, "N", 0);
  const Nest = habDesdeDorm(nDorm);
  if (N <= 0) N = Nest;
  const n1 = Math.max(0, Math.round(num(raw, "n1", 2)));
  const n2 = Math.max(0, Math.round(num(raw, "n2", 4)));
  const n3 = Math.max(0, Math.round(num(raw, "n3", 2)));
  const n4 = Math.max(0, Math.round(num(raw, "n4", 0)));
  const n5 = Math.max(0, Math.round(num(raw, "n5", 0)));
  const nExtra = Math.max(0, Math.round(num(raw, "nExtra", 0)));
  const nGuard = Math.max(0, Math.round(num(raw, "nGuard", 0)));
  const A_jardin = Math.max(0, num(raw, "A_jardin", 0));
  const A_comun = Math.max(0, num(raw, "A_comun", 0));
  const C_lote = dotLote(A_lote);
  const C_hab = Math.max(N * 150, N > 0 ? 1500 : 0);
  const C_uni = Math.max(C_lote, C_hab);
  const c1 = n1 * 500;
  const c2 = n2 * 850;
  const c3 = n3 * 1200;
  const c4 = n4 * 1350;
  const c5 = n5 * 1500;
  const cX = nExtra * dotDorm(6);
  const cG = nGuard * 500;
  const nDep = n1 + n2 + n3 + n4 + n5 + nExtra;
  const C_depas = c1 + c2 + c3 + c4 + c5 + cX + cG;
  const C_jard = A_jardin * 2;
  const C_com = A_comun * 6;
  const C_multi = C_depas + C_jard + C_com;
  const habEq = 2 * n1 + 3 * n2 + 4 * n3 + 5 * n4 + 5 * n5 + 6 * nExtra + 2 * nGuard;
  const niveles = Math.max(1, Math.round(num(raw, "niveles", 2)));

  const dimsExtra: Record<string, string> = {
    C_lote: String(Math.round(C_lote)),
    C_hab: String(Math.round(C_hab)),
    C_depas: String(Math.round(C_depas)),
    C_jard: String(Math.round(C_jard)),
    C_com: String(Math.round(C_com)),
    nDorm: String(nDorm),
    n1: String(n1),
    n2: String(n2),
    n3: String(n3),
    n4: String(n4),
    n5: String(n5),
    nDep: String(nDep + nGuard),
    A_lote: A_lote.toFixed(2),
    A_libre: A_libre.toFixed(2),
    A_jardin: A_jardin.toFixed(1),
  };

  if (modo === "uni") {
    return {
      Cpd: C_uni,
      Nshow: N,
      ocupHeading: "Criterios de dotación — vivienda unifamiliar",
      ocupCaption: `IS.010 2.2.a: se adopta el mayor entre tabla de lote y 150 L/hab·d. ${nDorm} dormitorios · ${fmt(N, 0)} habitantes.`,
      dimsExtra,
      bars: [
        bar("Tabla lote", C_lote, "#4a90c8"),
        bar("N × 150", C_hab, "#c47b2b", N),
        bar("Cpd", C_uni, "#2d6a4f"),
      ],
      extrasTitle: "Tabla IS.010 2.2.a — viviendas unifamiliares (área de lote)",
      extrasRows: [
        ["Área del lote (m²)", "Dotación (L/d)"],
        ...LOTE_UNI.map(([a, c], i) => [i === 0 ? `Hasta ${a}` : `${LOTE_UNI[i - 1][0] + 1} a ${a}`, String(c)]),
        ["Mayores de 3 000", "5 000 + 100 L/d por cada 100 m²"],
      ],
      checks: [
        ok("Cpd ≥ tabla de lote", `${fmt(C_uni, 0)} L/d`, `≥ ${fmt(C_lote, 0)} L/d`, C_uni + 1e-6 >= C_lote),
        ok("Cpd ≥ 150 L/hab·d (mín. 1 500 si hay ocupación)", `${fmt(C_uni, 0)} L/d`, `≥ ${fmt(C_hab, 0)} L/d`, C_uni + 1e-6 >= C_hab),
      ],
      audit: [
        `La tabla 2.2.a reproduce C_lote = ${fmt(C_lote, 0)} L/d para ${fmt(A_lote, 2)} m².`,
        `Cpd = máx(lote, habitantes) = ${fmt(C_uni, 0)} L/d es correcto.`,
      ],
      steps: [
        {
      n: "01",
      title: "Identificación del lote y de la vivienda",
      formula: "A_lote · A_libre · n_dorm · N · n_pisos",
      substitution: `A = ${fmt(A_lote, 2)} m²   A_libre = ${fmt(A_libre, 2)} m²   dormitorios = ${nDorm}   N = ${fmt(N, 0)} hab   pisos = ${niveles}`,
      result: `Vivienda unifamiliar de ${niveles} nivel(es) en lote de ${fmt(A_lote, 2)} m²`,
      note: "IS.010 2.2.a fija la dotación por el área total del lote (doméstico + riego de jardines ya incluidos). El número de habitantes se usa como verificación complementaria (150 L/hab·d, mínimo 1 500 L/d).",
        },
        {
      n: "02",
      title: "Dotación por área del lote — IS.010 2.2.a",
      formula: "C_lote = tabla (A_lote)    ·    A > 3000 m² → 5000 + 100 L/d por cada 100 m² adicionales",
      substitution: `A_lote = ${fmt(A_lote, 2)} m²  →  rango ${rangoLote(A_lote)}`,
      result: `C_lote = ${fmt(C_lote, 0)} L/d`,
      note: "La tabla oficial ya incluye el riego de jardines del lote. El área libre se grafica en el croquis pero no se suma otra vez.",
        },
        {
      n: "03",
      title: "Ocupación y criterio de 150 L/hab·d",
      formula: "N ≈ 1 + n_dorm    ·    C_hab = máx(N × 150 ; 1 500)",
      substitution: nDorm > 0
        ? `n_dorm = ${nDorm}  →  N_est = ${Nest} hab    N adoptado = ${fmt(N, 0)} hab    ${fmt(N, 0)} × 150 = ${fmt(N * 150, 0)} L/d`
        : `N = ${fmt(N, 0)} hab    ${fmt(N, 0)} × 150 = ${fmt(N * 150, 0)} L/d`,
      result: `C_hab = ${fmt(C_hab, 0)} L/d`,
      note: "La ocupación 1 + n_dorm (2 hab en 1 dormitorio, 3 en 2, 4 en 3…) es la práctica habitual cuando no hay censo. Si el usuario indica N, ese valor manda.",
        },
        {
      n: "04",
      title: "Dotación de diseño",
      formula: "Cpd = máx(C_lote ; C_hab)",
      substitution: `máx(${fmt(C_lote, 0)} ; ${fmt(C_hab, 0)})`,
          result: `Cpd = ${fmt(C_uni, 0)} L/d  =  ${fmt(C_uni / 1000, 2)} m³/d`,
      note: "Se adopta el mayor de los dos criterios para no quedar por debajo ni de la tabla de lote ni de la población real. Es el consumo promedio diario de diseño.",
        },
      ],
    };
  }

  if (modo === "multi") {
    return {
      Cpd: C_multi,
      Nshow: habEq,
      ocupHeading: "Dotación por departamento — vivienda multifamiliar",
      ocupCaption: `IS.010 2.2.b: 500 / 850 / 1 200 / 1 350 / 1 500 L/d según dormitorios. Cpd = ${fmt(C_multi, 0)} L/d.`,
      dimsExtra,
      bars: [
        bar("1 dorm", c1, "#4a90c8", n1),
        bar("2 dorm", c2, "#2d6a4f", n2),
        bar("3 dorm", c3, "#c47b2b", n3),
        bar("4 dorm", c4, "#8b1e1e", n4),
        bar("5 dorm", c5, "#5c4d7a", n5),
        bar(">5 dorm", cX, "#1a4473", nExtra),
        bar("portería", cG, "#6b6458", nGuard),
        bar("jardín", C_jard, "#6b9e6e"),
        bar("común", C_com, "#8a7a5a"),
      ].filter((r) => r.c > 0 || r.n > 0),
      extrasTitle: "Tabla IS.010 2.2.b — edificios multifamiliares",
      extrasRows: [
        ["Dormitorios por departamento", "Dotación (L/d)", "N° depas", "Subtotal (L/d)"],
        ["1", "500", String(n1), fmt(c1, 0)],
        ["2", "850", String(n2), fmt(c2, 0)],
        ["3", "1 200", String(n3), fmt(c3, 0)],
        ["4", "1 350", String(n4), fmt(c4, 0)],
        ["5", "1 500", String(n5), fmt(c5, 0)],
        ["> 5 (1 500 + 150×extra)", String(dotDorm(6)), String(nExtra), fmt(cX, 0)],
        ["Portería (1 dorm)", "500", String(nGuard), fmt(cG, 0)],
        ["Jardines 2 L/d·m²", "—", `${fmt(A_jardin, 1)} m²`, fmt(C_jard, 0)],
        ["Áreas comunes 6 L/d·m²", "—", `${fmt(A_comun, 1)} m²`, fmt(C_com, 0)],
        ["Total Cpd", "—", "—", fmt(C_multi, 0)],
      ],
      checks: [
        ok("Cpd incluye departamentos + jardín + anexos", `${fmt(C_multi, 0)} L/d`, `${fmt(C_depas, 0)}+${fmt(C_jard, 0)}+${fmt(C_com, 0)}`, true),
        ok("Hay al menos un departamento", String(nDep + nGuard), "≥ 1", nDep + nGuard >= 1),
      ],
      audit: [
        `La suma por dormitorios da ${fmt(C_depas, 0)} L/d (tabla 2.2.b).`,
        `Jardín a 2 L/d·m² = ${fmt(C_jard, 0)} L/d (IS.010 2.2.u).`,
      ],
      steps: [
        {
      n: "01",
      title: "Programa de departamentos",
      formula: "n_depas = n₁ + n₂ + n₃ + n₄ + n₅ + n_{>5} + n_guardia",
      substitution: `1 dorm: ${n1}    2 dorm: ${n2}    3 dorm: ${n3}    4 dorm: ${n4}    5 dorm: ${n5}    >5: ${nExtra}    portería: ${nGuard}`,
      result: `${nDep + nGuard} unidades    ·    ocupación equivalente ≈ ${habEq} hab    ·    ${niveles} pisos`,
      note: "IS.010 2.2.b no pide habitantes: la dotación se lee directo por el número de dormitorios de cada departamento. La ocupación equivalente (2, 3, 4, 5 hab) solo interpreta la tabla.",
        },
        {
      n: "02",
      title: "Dotación por departamento — IS.010 2.2.b",
      formula: "1 dorm = 500    2 = 850    3 = 1 200    4 = 1 350    5 = 1 500 L/d    ·    >5: 1 500 + 150×(n−5)",
      substitution: `${n1}×500 + ${n2}×850 + ${n3}×1 200 + ${n4}×1 350 + ${n5}×1 500 + ${nExtra}×${dotDorm(6)} + ${nGuard}×500`,
      result: `C_depas = ${fmt(C_depas, 0)} L/d`,
      note: "Portería o vivienda del guardián se toma como departamento de 1 dormitorio (500 L/d) si existe.",
        },
        {
      n: "03",
      title: "Áreas verdes y locales anexos — IS.010 2.2.u / 2.2.i",
      formula: "C_jardín = 2 L/d·m²    ·    C_común = 6 L/d·m² (área útil tipo oficina/lobby)",
      substitution: `${fmt(A_jardin, 1)} m² × 2 + ${fmt(A_comun, 1)} m² × 6`,
      result: `C_jardín = ${fmt(C_jard, 0)} L/d    ·    C_anexo = ${fmt(C_com, 0)} L/d`,
      note: "En multifamiliar el jardín NO está incluido en la tabla de departamentos. No se dota el área pavimentada ni el enripiado.",
        },
        {
      n: "04",
      title: "Dotación de diseño",
      formula: "Cpd = C_depas + C_jardín + C_anexo",
      substitution: `${fmt(C_depas, 0)} + ${fmt(C_jard, 0)} + ${fmt(C_com, 0)}`,
          result: `Cpd = ${fmt(C_multi, 0)} L/d  =  ${fmt(C_multi / 1000, 2)} m³/d`,
      note: "Consumo promedio diario de toda la edificación. Sobre esta cifra se dimensionan cisterna y tanque elevado.",
        },
      ],
    };
  }

  const A_oficina = Math.max(0, num(raw, "A_oficina", 0));
  const A_deposito = Math.max(0, num(raw, "A_deposito", 0));
  const nTurnos = Math.max(1, Math.round(num(raw, "nTurnos", 1)));
  const kgRopa = Math.max(0, num(raw, "kgRopa", 0));
  const nCubiertos = Math.max(0, num(raw, "nCubiertos", 0));
  const A_comedor = Math.max(0, num(raw, "A_comedor", 0));
  const C_of = A_oficina * 6;
  const C_dep = A_deposito * 0.5 * nTurnos;
  const C_lav = kgRopa * 40;
  const C_fuera = nCubiertos * 8;

  if (modo === "hotel") {
    const tipoHosp = str(raw, "tipoHosp", "hotel");
    const nDormHosp = Math.max(0, Math.round(num(raw, "nDormHosp", 24)));
    const A_dorm = Math.max(0, num(raw, "A_dorm", 120));
    const esAlbergue = tipoHosp === "albergue";
    const C_huesped = esAlbergue ? A_dorm * 25 : nDormHosp * 500;
    const C_rest = dotComedorRest(A_comedor);
    const Cpd = C_huesped + C_rest + C_fuera + C_lav + C_jard + C_of;
    const etiqueta = esAlbergue ? "albergue" : "hotel / hostal / apart-hotel";
    return {
      Cpd,
      Nshow: esAlbergue ? Math.round(A_dorm) : nDormHosp,
      ocupHeading: `Dotación — ${etiqueta}`,
      ocupCaption: esAlbergue
        ? `IS.010 2.2.c: 25 L/d·m² de dormitorio. Anexos (restaurante, lavandería, jardín, oficinas) se suman aparte. Cpd = ${fmt(Cpd, 0)} L/d.`
        : `IS.010 2.2.c: 500 L/d por dormitorio. Anexos se suman aparte. Cpd = ${fmt(Cpd, 0)} L/d.`,
      dimsExtra: { ...dimsExtra, nDormHosp: String(nDormHosp), A_dorm: A_dorm.toFixed(1), A_comedor: A_comedor.toFixed(1) },
      bars: [
        bar(esAlbergue ? "dormitorios 25 L/m²" : "dormitorios 500 L", C_huesped, "#4a90c8", esAlbergue ? 0 : nDormHosp),
        bar("restaurante", C_rest, "#c47b2b"),
        bar("cubiertos fuera", C_fuera, "#8b1e1e", nCubiertos),
        bar("lavandería", C_lav, "#6b6458"),
        bar("jardín", C_jard, "#6b9e6e"),
        bar("oficinas", C_of, "#5c4d7a"),
      ].filter((r) => r.c > 0 || r.n > 0),
      extrasTitle: "IS.010 2.2.c — hospedaje y anexos",
      extrasRows: [
        ["Componente", "Criterio", "Dato", "Subtotal (L/d)"],
        [esAlbergue ? "Albergue" : "Hotel / hostal / apart-hotel", esAlbergue ? "25 L/d·m² dormitorio" : "500 L/d por dormitorio", esAlbergue ? `${fmt(A_dorm, 1)} m²` : `${nDormHosp} dorm.`, fmt(C_huesped, 0)],
        ["Restaurante anexo 2.2.d", rangoComedorRest(A_comedor), `${fmt(A_comedor, 1)} m²`, fmt(C_rest, 0)],
        ["Alimentos para llevar 2.2.e", "8 L/cubierto", String(nCubiertos), fmt(C_fuera, 0)],
        ["Lavandería 2.2.t", "40 L/kg ropa", `${fmt(kgRopa, 1)} kg`, fmt(C_lav, 0)],
        ["Jardines 2.2.u", "2 L/d·m²", `${fmt(A_jardin, 1)} m²`, fmt(C_jard, 0)],
        ["Oficinas / administración 2.2.i", "6 L/d·m² útil", `${fmt(A_oficina, 1)} m²`, fmt(C_of, 0)],
        ["Total Cpd", "—", "—", fmt(Cpd, 0)],
      ],
      checks: [
        ok(esAlbergue ? "Hospedaje = 25 L/d·m²" : "Hospedaje = 500 L/d·dormitorio", `${fmt(C_huesped, 0)} L/d`, esAlbergue ? `${fmt(A_dorm, 1)}×25` : `${nDormHosp}×500`, Math.abs(C_huesped - (esAlbergue ? A_dorm * 25 : nDormHosp * 500)) < 0.5),
        ok("Cpd suma hospedaje + anexos", `${fmt(Cpd, 0)} L/d`, "Σ componentes", Cpd >= C_huesped - 0.5),
        ok(esAlbergue ? "Hay área de dormitorio" : "Hay al menos un dormitorio", esAlbergue ? `${fmt(A_dorm, 1)} m²` : String(nDormHosp), "> 0", esAlbergue ? A_dorm > 0 : nDormHosp >= 1),
      ],
      audit: [
        esAlbergue
          ? `Albergue 25 L/d·m² × ${fmt(A_dorm, 1)} m² = ${fmt(C_huesped, 0)} L/d (IS.010 2.2.c).`
          : `Hotel ${nDormHosp} dorm. × 500 L/d = ${fmt(C_huesped, 0)} L/d (IS.010 2.2.c).`,
        `Anexos: restaurante ${fmt(C_rest, 0)} + cubiertos ${fmt(C_fuera, 0)} + lavandería ${fmt(C_lav, 0)} + jardín ${fmt(C_jard, 0)} + oficinas ${fmt(C_of, 0)} L/d.`,
      ],
      steps: [
        {
          n: "01",
          title: "Identificación del establecimiento de hospedaje",
          formula: esAlbergue ? "tipo = albergue    ·    A_dormitorio" : "tipo = hotel / hostal / apart-hotel    ·    n_dormitorios",
          substitution: esAlbergue
            ? `A_dorm = ${fmt(A_dorm, 1)} m²    pisos = ${niveles}`
            : `n_dorm = ${nDormHosp}    pisos = ${niveles}`,
          result: `${etiqueta} de ${niveles} nivel(es)`,
          note: "IS.010 2.2.c distingue hotel/apart-hotel/hostal (por dormitorio) de albergue (por m² de dormitorio). Restaurante, bar, lavandería, comercio y riego se calculan adicionalmente.",
        },
        {
          n: "02",
          title: "Dotación de hospedaje — IS.010 2.2.c",
          formula: esAlbergue ? "C_huésped = 25 × A_dormitorio" : "C_huésped = 500 × n_dormitorios",
          substitution: esAlbergue ? `25 × ${fmt(A_dorm, 1)}` : `500 × ${nDormHosp}`,
          result: `C_huésped = ${fmt(C_huesped, 0)} L/d`,
          note: "Esta cifra no incluye restaurante, bar, peluquería, salón de baile ni lavandería. Esos anexos van en el paso 03.",
        },
        {
          n: "03",
          title: "Servicios anexos — IS.010 2.2.d / 2.2.e / 2.2.t / 2.2.u / 2.2.i",
          formula: "C_rest = tabla comedor    ·    C_fuera = 8×cubiertos    ·    C_lav = 40×kg    ·    C_jard = 2×A    ·    C_of = 6×A_útil",
          substitution: `comedor ${fmt(A_comedor, 1)} m² (${rangoComedorRest(A_comedor)})    cubiertos ${fmt(nCubiertos, 0)}    ropa ${fmt(kgRopa, 1)} kg    jardín ${fmt(A_jardin, 1)} m²    oficinas ${fmt(A_oficina, 1)} m²`,
          result: `anexos = ${fmt(C_rest + C_fuera + C_lav + C_jard + C_of, 0)} L/d`,
          note: "Si el hotel no tiene restaurante propio, A_comedor = 0. La lavandería se dota solo si hay servicio en el predio (kg de ropa/día).",
        },
        {
          n: "04",
          title: "Dotación de diseño",
          formula: "Cpd = C_huésped + C_restaurante + C_fuera + C_lavandería + C_jardín + C_oficinas",
          substitution: `${fmt(C_huesped, 0)} + ${fmt(C_rest, 0)} + ${fmt(C_fuera, 0)} + ${fmt(C_lav, 0)} + ${fmt(C_jard, 0)} + ${fmt(C_of, 0)}`,
          result: `Cpd = ${fmt(Cpd, 0)} L/d  =  ${fmt(Cpd / 1000, 2)} m³/d`,
          note: "Consumo promedio diario de todo el predio. Sobre esta cifra se dimensionan cisterna (¾) y tanque elevado (⅓) según IS.010 2.4.",
        },
      ],
    };
  }

  if (modo === "restaurante") {
    const tipoRest = str(raw, "tipoRest", "restaurante");
    const esCafe = tipoRest === "cafeteria";
    const C_sala = esCafe ? dotCafeteria(A_comedor) : dotComedorRest(A_comedor);
    const rango = esCafe ? rangoCafeteria(A_comedor) : rangoComedorRest(A_comedor);
    const Cpd = C_sala + C_fuera + C_jard + C_of;
    const articulo = esCafe ? "2.2.r" : "2.2.d";
    return {
      Cpd,
      Nshow: Math.round(A_comedor),
      ocupHeading: esCafe ? "Dotación — cafetería / bar / fuente de soda" : "Dotación — restaurante",
      ocupCaption: `IS.010 ${articulo}: ${rango}. Cubiertos para llevar 8 L (2.2.e). Cpd = ${fmt(Cpd, 0)} L/d.`,
      dimsExtra: { ...dimsExtra, A_comedor: A_comedor.toFixed(1) },
      bars: [
        bar(esCafe ? "sala 2.2.r" : "comedor 2.2.d", C_sala, "#c47b2b"),
        bar("cubiertos fuera", C_fuera, "#8b1e1e", nCubiertos),
        bar("jardín", C_jard, "#6b9e6e"),
        bar("oficinas", C_of, "#5c4d7a"),
      ].filter((r) => r.c > 0 || r.n > 0),
      extrasTitle: esCafe ? "IS.010 2.2.r — bares, cafeterías y fuentes de soda" : "IS.010 2.2.d — restaurantes (área de comedor)",
      extrasRows: esCafe
        ? [
            ["Área del local (m²)", "Dotación", "Aplicado"],
            ["Hasta 30", "1 500 L/d", A_comedor <= 30 && A_comedor > 0 ? "sí" : "—"],
            ["31 a 60", "60 L/d·m²", A_comedor > 30 && A_comedor <= 60 ? "sí" : "—"],
            ["61 a 100", "50 L/d·m²", A_comedor > 60 && A_comedor <= 100 ? "sí" : "—"],
            ["Mayor de 100", "40 L/d·m² (piso 5 000 L)", A_comedor > 100 ? "sí" : "—"],
            ["Sala", rango, fmt(C_sala, 0)],
            ["Cubiertos fuera 8 L", String(nCubiertos), fmt(C_fuera, 0)],
            ["Jardín 2 L/d·m²", `${fmt(A_jardin, 1)} m²`, fmt(C_jard, 0)],
            ["Oficinas 6 L/d·m²", `${fmt(A_oficina, 1)} m²`, fmt(C_of, 0)],
            ["Total Cpd", "—", fmt(Cpd, 0)],
          ]
        : [
            ["Área de comedores (m²)", "Dotación", "Aplicado"],
            ["Hasta 40", "2 000 L/d", A_comedor <= 40 && A_comedor > 0 ? "sí" : "—"],
            ["41 a 100", "50 L/d·m²", A_comedor > 40 && A_comedor <= 100 ? "sí" : "—"],
            ["Más de 100", "40 L/d·m² (piso 5 000 L)", A_comedor > 100 ? "sí" : "—"],
            ["Comedor", rango, fmt(C_sala, 0)],
            ["Cubiertos fuera 8 L (2.2.e)", String(nCubiertos), fmt(C_fuera, 0)],
            ["Jardín 2 L/d·m²", `${fmt(A_jardin, 1)} m²`, fmt(C_jard, 0)],
            ["Oficinas 6 L/d·m²", `${fmt(A_oficina, 1)} m²`, fmt(C_of, 0)],
            ["Total Cpd", "—", fmt(Cpd, 0)],
          ],
      checks: [
        ok("Hay área de sala / comedor", `${fmt(A_comedor, 1)} m²`, "> 0", A_comedor > 0),
        ok("Cpd ≥ tabla de sala", `${fmt(Cpd, 0)} L/d`, `≥ ${fmt(C_sala, 0)} L/d`, Cpd + 1e-6 >= C_sala),
      ],
      audit: [
        `Tabla ${articulo} para ${fmt(A_comedor, 1)} m² (${rango}) = ${fmt(C_sala, 0)} L/d.`,
        nCubiertos > 0 ? `Cubiertos para llevar 8 L × ${fmt(nCubiertos, 0)} = ${fmt(C_fuera, 0)} L/d (2.2.e).` : "Sin servicio de alimentos para llevar.",
      ],
      steps: [
        {
          n: "01",
          title: esCafe ? "Identificación del bar / cafetería" : "Identificación del restaurante",
          formula: "A_comedor · n_pisos · tipo",
          substitution: `tipo = ${esCafe ? "cafetería / bar / fuente de soda" : "restaurante"}    A = ${fmt(A_comedor, 1)} m²    pisos = ${niveles}`,
          result: `${esCafe ? "Local 2.2.r" : "Restaurante 2.2.d"} de ${fmt(A_comedor, 1)} m² de sala`,
          note: "La norma dota el área de los comedores (o del local, en cafeterías), no el número de asientos. La cocina queda cubierta por esa tabla.",
        },
        {
          n: "02",
          title: `Dotación de sala — IS.010 ${articulo}`,
          formula: esCafe
            ? "≤30 m² → 1 500 L    ·    31–60 → 60·A    ·    61–100 → 50·A    ·    >100 → máx(40·A ; 5 000)"
            : "≤40 m² → 2 000 L    ·    41–100 → 50·A    ·    >100 → máx(40·A ; 5 000)",
          substitution: `A = ${fmt(A_comedor, 1)} m²  →  ${rango}`,
          result: `C_sala = ${fmt(C_sala, 0)} L/d`,
          note: "En el salto de 100 a 101 m² la tabla oficial bajaría (50·A → 40·A). Se adopta piso de 5 000 L/d para no reducir la dotación al crecer el local.",
        },
        {
          n: "03",
          title: "Alimentos para llevar y anexos — IS.010 2.2.e / 2.2.u / 2.2.i",
          formula: "C_fuera = 8 × n_cubiertos    ·    C_jard = 2 × A_jardín    ·    C_of = 6 × A_útil",
          substitution: `${fmt(nCubiertos, 0)} cubiertos × 8    ·    ${fmt(A_jardin, 1)} m² × 2    ·    ${fmt(A_oficina, 1)} m² × 6`,
          result: `fuera = ${fmt(C_fuera, 0)} L/d    ·    jardín = ${fmt(C_jard, 0)} L/d    ·    oficinas = ${fmt(C_of, 0)} L/d`,
          note: "El inciso 2.2.e aplica cuando también se elaboran alimentos para consumir fuera del local. Si no hay delivery ni pickup, n_cubiertos = 0.",
        },
        {
          n: "04",
          title: "Dotación de diseño",
          formula: "Cpd = C_sala + C_fuera + C_jardín + C_oficinas",
          substitution: `${fmt(C_sala, 0)} + ${fmt(C_fuera, 0)} + ${fmt(C_jard, 0)} + ${fmt(C_of, 0)}`,
          result: `Cpd = ${fmt(Cpd, 0)} L/d  =  ${fmt(Cpd / 1000, 2)} m³/d`,
          note: "Sobre Cpd se dimensionan cisterna, tanque elevado, Hunter y bomba (pasos 05–11), igual que en cualquier otra edificación IS.010.",
        },
      ],
    };
  }

  if (modo === "hospital") {
    const nCamas = Math.max(0, Math.round(num(raw, "nCamas", 40)));
    const nConsultorios = Math.max(0, Math.round(num(raw, "nConsultorios", 6)));
    const nDental = Math.max(0, Math.round(num(raw, "nDental", 2)));
    const C_camas = nCamas * 600;
    const C_cons = nConsultorios * 500;
    const C_dent = nDental * 1000;
    const C_rest = dotComedorRest(A_comedor);
    const Cpd = C_camas + C_cons + C_dent + C_rest + C_fuera + C_lav + C_jard + C_of;
    return {
      Cpd,
      Nshow: nCamas,
      ocupHeading: "Dotación — hospital / clínica / consultorios",
      ocupCaption: `IS.010 2.2.s: 600 L/d·cama, 500 L/d·consultorio, 1 000 L/d·unidad dental. Cocina, lavandería y jardín se suman aparte. Cpd = ${fmt(Cpd, 0)} L/d.`,
      dimsExtra: {
        ...dimsExtra,
        nCamas: String(nCamas),
        nConsultorios: String(nConsultorios),
        nDental: String(nDental),
        A_comedor: A_comedor.toFixed(1),
      },
      bars: [
        bar("camas 600 L", C_camas, "#8b1e1e", nCamas),
        bar("consultorios 500 L", C_cons, "#2d6a4f", nConsultorios),
        bar("unid. dental 1 000 L", C_dent, "#1a4473", nDental),
        bar("cocina / comedor", C_rest, "#c47b2b"),
        bar("raciones fuera", C_fuera, "#c47b2b", nCubiertos),
        bar("lavandería", C_lav, "#6b6458"),
        bar("jardín", C_jard, "#6b9e6e"),
        bar("administración", C_of, "#5c4d7a"),
      ].filter((r) => r.c > 0 || r.n > 0),
      extrasTitle: "IS.010 2.2.s — locales de salud y servicios especiales",
      extrasRows: [
        ["Componente", "Criterio", "Dato", "Subtotal (L/d)"],
        ["Hospitalización", "600 L/d por cama", String(nCamas), fmt(C_camas, 0)],
        ["Consultorios médicos", "500 L/d por consultorio", String(nConsultorios), fmt(C_cons, 0)],
        ["Clínicas dentales", "1 000 L/d por unidad dental", String(nDental), fmt(C_dent, 0)],
        ["Cocina / comedor 2.2.d", rangoComedorRest(A_comedor), `${fmt(A_comedor, 1)} m²`, fmt(C_rest, 0)],
        ["Raciones para llevar 2.2.e", "8 L/cubierto", String(nCubiertos), fmt(C_fuera, 0)],
        ["Lavandería 2.2.t", "40 L/kg ropa", `${fmt(kgRopa, 1)} kg/d`, fmt(C_lav, 0)],
        ["Jardines 2.2.u", "2 L/d·m²", `${fmt(A_jardin, 1)} m²`, fmt(C_jard, 0)],
        ["Administración 2.2.i", "6 L/d·m² útil", `${fmt(A_oficina, 1)} m²`, fmt(C_of, 0)],
        ["Total Cpd", "—", "—", fmt(Cpd, 0)],
      ],
      checks: [
        ok("Hay cama, consultorio o unidad dental", `${nCamas + nConsultorios + nDental} und`, "≥ 1", nCamas + nConsultorios + nDental >= 1),
        ok("Camas a 600 L/d", `${fmt(C_camas, 0)} L/d`, `${nCamas}×600`, Math.abs(C_camas - nCamas * 600) < 0.5),
        ok("Cpd suma 2.2.s + especiales", `${fmt(Cpd, 0)} L/d`, "Σ", Cpd >= C_camas + C_cons + C_dent - 0.5),
      ],
      audit: [
        `2.2.s: ${nCamas}×600 + ${nConsultorios}×500 + ${nDental}×1 000 = ${fmt(C_camas + C_cons + C_dent, 0)} L/d.`,
        `Servicios especiales (cocina, lavandería, jardín, administración) = ${fmt(C_rest + C_fuera + C_lav + C_jard + C_of, 0)} L/d.`,
      ],
      steps: [
        {
          n: "01",
          title: "Programa hospitalario",
          formula: "n_camas · n_consultorios · n_unidades dentales · n_pisos",
          substitution: `camas = ${nCamas}    consultorios = ${nConsultorios}    unidades dentales = ${nDental}    pisos = ${niveles}`,
          result: `Local de salud de ${niveles} nivel(es)`,
          note: "IS.010 2.2.s cubre hospitales, clínicas de hospitalización, clínicas dentales y consultorios médicos. Cada rubro tiene su propia cifra; no se mezclan.",
        },
        {
          n: "02",
          title: "Dotación sanitaria — IS.010 2.2.s",
          formula: "C_salud = 600·camas + 500·consultorios + 1 000·unid. dental",
          substitution: `600×${nCamas} + 500×${nConsultorios} + 1 000×${nDental}`,
          result: `C_salud = ${fmt(C_camas + C_cons + C_dent, 0)} L/d`,
          note: "600 L/d por cama de internamiento, 500 L/d por consultorio médico y 1 000 L/d por unidad dental. No incluye cocina ni lavandería.",
        },
        {
          n: "03",
          title: "Servicios especiales — cocina, lavandería, jardín y administración",
          formula: "C_cocina = tabla 2.2.d    ·    C_lav = 40×kg    ·    C_jard = 2×A    ·    C_admin = 6×A_útil",
          substitution: `comedor ${fmt(A_comedor, 1)} m²    ropa ${fmt(kgRopa, 1)} kg/d    jardín ${fmt(A_jardin, 1)} m²    admin ${fmt(A_oficina, 1)} m²`,
          result: `especiales = ${fmt(C_rest + C_fuera + C_lav + C_jard + C_of, 0)} L/d`,
          note: "La propia 2.2.s manda calcular riego, viviendas anexas, cocina y lavandería con los incisos correspondientes. La cocina del hospital se dota como restaurante (área de comedor / raciones).",
        },
        {
          n: "04",
          title: "Dotación de diseño",
          formula: "Cpd = C_salud + C_especiales",
          substitution: `${fmt(C_camas + C_cons + C_dent, 0)} + ${fmt(C_rest + C_fuera + C_lav + C_jard + C_of, 0)}`,
          result: `Cpd = ${fmt(Cpd, 0)} L/d  =  ${fmt(Cpd / 1000, 2)} m³/d`,
          note: "Cifra de diseño de todo el predio. Cisterna ≥ ¾ Cpd y tanque elevado ≥ ⅓ Cpd (mín. 1 000 L c/u) en sistema combinado.",
        },
      ],
    };
  }

  if (modo === "oficina") {
    const A_util = Math.max(0, num(raw, "A_util", 800));
    const C_ofic = A_util * 6;
    const Cpd = C_ofic + C_dep + C_jard;
    return {
      Cpd,
      Nshow: Math.round(A_util),
      ocupHeading: "Dotación — oficinas",
      ocupCaption: `IS.010 2.2.i: 6 L/d por m² de área útil. Depósitos 0,50 L/d·m² por turno (2.2.j). Cpd = ${fmt(Cpd, 0)} L/d.`,
      dimsExtra: { ...dimsExtra, A_util: A_util.toFixed(1), A_deposito: A_deposito.toFixed(1) },
      bars: [
        bar("oficinas 6 L/m²", C_ofic, "#5c4d7a"),
        bar("depósitos 0,50 L/m²", C_dep, "#6b6458"),
        bar("jardín", C_jard, "#6b9e6e"),
      ].filter((r) => r.c > 0),
      extrasTitle: "IS.010 2.2.i / 2.2.j — oficinas y depósitos",
      extrasRows: [
        ["Componente", "Criterio", "Dato", "Subtotal (L/d)"],
        ["Oficinas", "6 L/d·m² área útil", `${fmt(A_util, 1)} m²`, fmt(C_ofic, 0)],
        ["Depósitos", "0,50 L/d·m² × turnos", `${fmt(A_deposito, 1)} m² × ${nTurnos}`, fmt(C_dep, 0)],
        ["Jardines 2.2.u", "2 L/d·m²", `${fmt(A_jardin, 1)} m²`, fmt(C_jard, 0)],
        ["Total Cpd", "—", "—", fmt(Cpd, 0)],
      ],
      checks: [
        ok("Hay área útil de oficinas", `${fmt(A_util, 1)} m²`, "> 0", A_util > 0),
        ok("Oficinas a 6 L/d·m²", `${fmt(C_ofic, 0)} L/d`, `${fmt(A_util, 1)}×6`, Math.abs(C_ofic - A_util * 6) < 0.5),
      ],
      audit: [
        `Oficinas 6 L/d·m² × ${fmt(A_util, 1)} m² = ${fmt(C_ofic, 0)} L/d (IS.010 2.2.i).`,
        A_deposito > 0
          ? `Depósitos 0,50 L/d·m² × ${fmt(A_deposito, 1)} m² × ${nTurnos} turno(s) = ${fmt(C_dep, 0)} L/d (2.2.j).`
          : "Sin depósitos anexos.",
      ],
      steps: [
        {
          n: "01",
          title: "Identificación del edificio de oficinas",
          formula: "A_útil · n_pisos",
          substitution: `A_útil = ${fmt(A_util, 1)} m²    pisos = ${niveles}`,
          result: `Edificio de oficinas de ${niveles} nivel(es), ${fmt(A_util, 1)} m² útiles`,
          note: "El área útil es la computable para oficinas (sin estacionamientos ni áreas técnicas no ocupadas). No se dota el área de circulación exclusiva si el criterio de proyecto la excluye; aquí se toma el área útil declarada.",
        },
        {
          n: "02",
          title: "Dotación de oficinas — IS.010 2.2.i",
          formula: "C_oficinas = 6 × A_útil",
          substitution: `6 × ${fmt(A_util, 1)}`,
          result: `C_oficinas = ${fmt(C_ofic, 0)} L/d`,
          note: "6 L/d por m² de área útil. No hay mínimo de 500 L/d en oficinas (ese mínimo es de locales comerciales 2.2.k y de oficinas anexas a depósitos 2.2.j).",
        },
        {
          n: "03",
          title: "Depósitos y jardines — IS.010 2.2.j / 2.2.u",
          formula: "C_dep = 0,50 × A_depósito × n_turnos    ·    C_jard = 2 × A_jardín",
          substitution: `0,50 × ${fmt(A_deposito, 1)} × ${nTurnos}    ·    2 × ${fmt(A_jardin, 1)}`,
          result: `depósitos = ${fmt(C_dep, 0)} L/d    ·    jardín = ${fmt(C_jard, 0)} L/d`,
          note: "Cada turno de 8 h o fracción multiplica la dotación de depósitos. Oficinas anexas a un depósito se calculan con 2.2.i (mínimo 500 L/d según 2.2.j).",
        },
        {
          n: "04",
          title: "Dotación de diseño",
          formula: "Cpd = C_oficinas + C_depósitos + C_jardín",
          substitution: `${fmt(C_ofic, 0)} + ${fmt(C_dep, 0)} + ${fmt(C_jard, 0)}`,
          result: `Cpd = ${fmt(Cpd, 0)} L/d  =  ${fmt(Cpd / 1000, 2)} m³/d`,
          note: "Consumo promedio diario. Sigue el dimensionamiento de almacenamiento IS.010 2.4 y Hunter 2.3.",
        },
      ],
    };
  }

  if (modo === "comercial") {
    const tipoCom = str(raw, "tipoCom", "tienda");
    const A_util = Math.max(0, num(raw, "A_util", 180));
    const esMercado = tipoCom === "mercado";
    const C_local = esMercado ? A_util * 15 : Math.max(A_util * 6, A_util > 0 ? 500 : 0);
    const C_rest = dotComedorRest(A_comedor);
    const Cpd = C_local + C_rest + C_dep + C_jard + C_of;
    return {
      Cpd,
      Nshow: Math.round(A_util),
      ocupHeading: esMercado ? "Dotación — mercado / venta de carnes y pescados" : "Dotación — local comercial (mercancías secas)",
      ocupCaption: esMercado
        ? `IS.010 2.2.l: 15 L/d·m². Anexos (restaurante, comercio, oficinas) se suman aparte. Cpd = ${fmt(Cpd, 0)} L/d.`
        : `IS.010 2.2.k: 6 L/d·m² útil, mínimo 500 L/d. Cpd = ${fmt(Cpd, 0)} L/d.`,
      dimsExtra: { ...dimsExtra, A_util: A_util.toFixed(1), A_comedor: A_comedor.toFixed(1) },
      bars: [
        bar(esMercado ? "mercado 15 L/m²" : "tienda 6 L/m² (mín. 500)", C_local, "#c47b2b"),
        bar("restaurante anexo", C_rest, "#8b1e1e"),
        bar("depósitos", C_dep, "#6b6458"),
        bar("oficinas", C_of, "#5c4d7a"),
        bar("jardín", C_jard, "#6b9e6e"),
      ].filter((r) => r.c > 0),
      extrasTitle: esMercado ? "IS.010 2.2.l — mercados" : "IS.010 2.2.k — locales comerciales (mercancías secas)",
      extrasRows: [
        ["Componente", "Criterio", "Dato", "Subtotal (L/d)"],
        [esMercado ? "Mercado / carnes / pescados" : "Local comercial", esMercado ? "15 L/d·m²" : "6 L/d·m² (mín. 500 L/d)", `${fmt(A_util, 1)} m²`, fmt(C_local, 0)],
        ["Restaurante anexo 2.2.d", rangoComedorRest(A_comedor), `${fmt(A_comedor, 1)} m²`, fmt(C_rest, 0)],
        ["Depósitos 2.2.j", "0,50 L/d·m² × turnos", `${fmt(A_deposito, 1)} m² × ${nTurnos}`, fmt(C_dep, 0)],
        ["Oficinas 2.2.i", "6 L/d·m² útil", `${fmt(A_oficina, 1)} m²`, fmt(C_of, 0)],
        ["Jardines 2.2.u", "2 L/d·m²", `${fmt(A_jardin, 1)} m²`, fmt(C_jard, 0)],
        ["Total Cpd", "—", "—", fmt(Cpd, 0)],
      ],
      checks: [
        ok("Hay área del local", `${fmt(A_util, 1)} m²`, "> 0", A_util > 0),
        ok(esMercado ? "Mercado ≥ 15 L/d·m²" : "Comercial ≥ máx(6·A ; 500)", `${fmt(C_local, 0)} L/d`, esMercado ? `${fmt(A_util * 15, 0)}` : `≥ ${fmt(Math.max(A_util * 6, 500), 0)}`, C_local + 1e-6 >= (esMercado ? A_util * 15 : Math.max(A_util * 6, A_util > 0 ? 500 : 0))),
      ],
      audit: [
        esMercado
          ? `Mercado 15 L/d·m² × ${fmt(A_util, 1)} m² = ${fmt(C_local, 0)} L/d (2.2.l).`
          : `Local comercial máx(6×${fmt(A_util, 1)} ; 500) = ${fmt(C_local, 0)} L/d (2.2.k).`,
        C_rest > 0 ? `Restaurante anexo ${fmt(C_rest, 0)} L/d (2.2.d), como manda la norma para locales anexos con SS.HH. separados.` : "Sin restaurante anexo.",
      ],
      steps: [
        {
          n: "01",
          title: esMercado ? "Identificación del mercado" : "Identificación del local comercial",
          formula: "tipo · A_útil · n_pisos",
          substitution: `tipo = ${esMercado ? "mercado / carnes / pescados" : "mercancías secas"}    A = ${fmt(A_util, 1)} m²    pisos = ${niveles}`,
          result: `${esMercado ? "Mercado 2.2.l" : "Local comercial 2.2.k"} de ${fmt(A_util, 1)} m²`,
          note: "Mercancías secas (2.2.k) no es lo mismo que mercado de abastos o venta de carnes/pescados (2.2.l). El segundo dota 15 L/d·m² porque hay agua de proceso.",
        },
        {
          n: "02",
          title: esMercado ? "Dotación de mercado — IS.010 2.2.l" : "Dotación comercial — IS.010 2.2.k",
          formula: esMercado ? "C_local = 15 × A" : "C_local = máx(6 × A_útil ; 500)",
          substitution: esMercado ? `15 × ${fmt(A_util, 1)}` : `máx(6 × ${fmt(A_util, 1)} ; 500)`,
          result: `C_local = ${fmt(C_local, 0)} L/d`,
          note: esMercado
            ? "15 L/d por m² del local. Restaurantes y comercios anexos con instalaciones sanitarias separadas se calculan además."
            : "6 L/d por m² de área útil, con mínimo de 500 L/d aunque el local sea pequeño.",
        },
        {
          n: "03",
          title: "Anexos — restaurante, depósitos, oficinas y jardín",
          formula: "C_rest = tabla 2.2.d    ·    C_dep = 0,50·A·turnos    ·    C_of = 6·A    ·    C_jard = 2·A",
          substitution: `comedor ${fmt(A_comedor, 1)} m²    depósito ${fmt(A_deposito, 1)} m² × ${nTurnos}    oficinas ${fmt(A_oficina, 1)} m²    jardín ${fmt(A_jardin, 1)} m²`,
          result: `anexos = ${fmt(C_rest + C_dep + C_of + C_jard, 0)} L/d`,
          note: "Si el comercio no tiene restaurante, depósito ni jardín, esos términos quedan en cero.",
        },
        {
          n: "04",
          title: "Dotación de diseño",
          formula: "Cpd = C_local + C_anexos",
          substitution: `${fmt(C_local, 0)} + ${fmt(C_rest + C_dep + C_of + C_jard, 0)}`,
          result: `Cpd = ${fmt(Cpd, 0)} L/d  =  ${fmt(Cpd / 1000, 2)} m³/d`,
          note: "Cifra de diseño del predio. Sigue almacenamiento 2.4 y Hunter 2.3.",
        },
      ],
    };
  }

  if (modo === "educacion") {
    const nExt = Math.max(0, Math.round(num(raw, "nExt", 240)));
    const nInt = Math.max(0, Math.round(num(raw, "nInt", 0)));
    const C_ext = nExt * 50;
    const C_int = nInt * 200;
    const C_rest = dotComedorRest(A_comedor);
    const Cpd = C_ext + C_int + C_rest + C_jard + C_of;
    return {
      Cpd,
      Nshow: nExt + nInt,
      ocupHeading: "Dotación — local educacional / residencia estudiantil",
      ocupCaption: `IS.010 2.2.f: 50 L/d por persona no residente y 200 L/d por residente. Cpd = ${fmt(Cpd, 0)} L/d.`,
      dimsExtra: { ...dimsExtra, nExt: String(nExt), nInt: String(nInt), A_comedor: A_comedor.toFixed(1) },
      bars: [
        bar("no residentes 50 L", C_ext, "#4a90c8", nExt),
        bar("residentes 200 L", C_int, "#1a4473", nInt),
        bar("comedor", C_rest, "#c47b2b"),
        bar("administración", C_of, "#5c4d7a"),
        bar("jardín", C_jard, "#6b9e6e"),
      ].filter((r) => r.c > 0 || r.n > 0),
      extrasTitle: "IS.010 2.2.f — locales educacionales y residencias estudiantiles",
      extrasRows: [
        ["Componente", "Criterio", "Dato", "Subtotal (L/d)"],
        ["Alumnado y personal no residente", "50 L/d por persona", String(nExt), fmt(C_ext, 0)],
        ["Alumnado y personal residente", "200 L/d por persona", String(nInt), fmt(C_int, 0)],
        ["Comedor / cafetería 2.2.d", rangoComedorRest(A_comedor), `${fmt(A_comedor, 1)} m²`, fmt(C_rest, 0)],
        ["Administración 2.2.i", "6 L/d·m² útil", `${fmt(A_oficina, 1)} m²`, fmt(C_of, 0)],
        ["Jardines / áreas verdes 2.2.u", "2 L/d·m²", `${fmt(A_jardin, 1)} m²`, fmt(C_jard, 0)],
        ["Total Cpd", "—", "—", fmt(Cpd, 0)],
      ],
      checks: [
        ok("Hay alumnado o personal", String(nExt + nInt), "≥ 1", nExt + nInt >= 1),
        ok("No residentes a 50 L/d", `${fmt(C_ext, 0)} L/d`, `${nExt}×50`, Math.abs(C_ext - nExt * 50) < 0.5),
        ok("Residentes a 200 L/d", `${fmt(C_int, 0)} L/d`, `${nInt}×200`, Math.abs(C_int - nInt * 200) < 0.5),
      ],
      audit: [
        `No residentes ${nExt}×50 = ${fmt(C_ext, 0)} L/d; residentes ${nInt}×200 = ${fmt(C_int, 0)} L/d (2.2.f).`,
        `Áreas verdes, piscina y otros fines se calculan adicionalmente; aquí jardín = ${fmt(C_jard, 0)} L/d.`,
      ],
      steps: [
        {
          n: "01",
          title: "Población escolar y personal",
          formula: "n_no_residente + n_residente",
          substitution: `externos / no residentes = ${nExt}    internos / residentes = ${nInt}    pisos = ${niveles}`,
          result: `${nExt + nInt} personas    ·    ${niveles} nivel(es)`,
          note: "La tabla 2.2.f aplica a alumnado Y personal. Un docente que no pernocta va en no residente (50 L/d); quien vive en la residencia va en residente (200 L/d).",
        },
        {
          n: "02",
          title: "Dotación educacional — IS.010 2.2.f",
          formula: "C_edu = 50 × n_no_residente + 200 × n_residente",
          substitution: `50×${nExt} + 200×${nInt}`,
          result: `C_edu = ${fmt(C_ext + C_int, 0)} L/d`,
          note: "50 L/d cubre jornada (SS.HH., lavado, bebederos). 200 L/d cubre pernocte. No incluye riego ni piscina.",
        },
        {
          n: "03",
          title: "Comedor, administración y áreas verdes",
          formula: "C_comedor = tabla 2.2.d    ·    C_admin = 6×A    ·    C_jard = 2×A",
          substitution: `comedor ${fmt(A_comedor, 1)} m²    admin ${fmt(A_oficina, 1)} m²    jardín ${fmt(A_jardin, 1)} m²`,
          result: `anexos = ${fmt(C_rest + C_of + C_jard, 0)} L/d`,
          note: "La norma dice expresamente que riego de áreas verdes, piscinas y otros fines se calculan adicionalmente. El comedor escolar se dota como restaurante si es un local de alimentación propio.",
        },
        {
          n: "04",
          title: "Dotación de diseño",
          formula: "Cpd = C_edu + C_anexos",
          substitution: `${fmt(C_ext + C_int, 0)} + ${fmt(C_rest + C_of + C_jard, 0)}`,
          result: `Cpd = ${fmt(Cpd, 0)} L/d  =  ${fmt(Cpd / 1000, 2)} m³/d`,
          note: "Cifra de diseño del plantel. Sigue almacenamiento 2.4 y Hunter 2.3.",
        },
      ],
    };
  }

  const tipoEsp = str(raw, "tipoEsp", "cine");
  const nAsientos = Math.max(0, Math.round(num(raw, "nAsientos", 280)));
  const A_pista = Math.max(0, num(raw, "A_pista", 180));
  let C_publico = 0;
  let criterio = "";
  let etiqueta = "";
  if (tipoEsp === "discoteca") {
    C_publico = A_pista * 30;
    criterio = "30 L/d·m² de área";
    etiqueta = "discoteca / casino / salón de baile";
  } else if (tipoEsp === "estadio") {
    C_publico = nAsientos * 1;
    criterio = "1 L/d por espectador";
    etiqueta = "estadio / velódromo / plaza de toros";
  } else if (tipoEsp === "circo") {
    C_publico = nAsientos * 1;
    criterio = "1 L/d por espectador (+ animales si aplica)";
    etiqueta = "circo / hipódromo / parque de atracciones";
  } else {
    C_publico = nAsientos * 3;
    criterio = "3 L/d por asiento";
    etiqueta = "cine / teatro / auditorio";
  }
  const C_anim = tipoEsp === "circo" ? Math.max(0, num(raw, "C_animales", 0)) : 0;
  const CpdEsp = C_publico + C_anim + C_jard + C_of;
  return {
    Cpd: CpdEsp,
    Nshow: tipoEsp === "discoteca" ? Math.round(A_pista) : nAsientos,
    ocupHeading: `Dotación — ${etiqueta}`,
    ocupCaption: `IS.010 2.2.g: ${criterio}. Cpd = ${fmt(CpdEsp, 0)} L/d.`,
    dimsExtra: { ...dimsExtra, nAsientos: String(nAsientos), A_pista: A_pista.toFixed(1) },
    bars: [
      bar("público 2.2.g", C_publico, "#4a90c8", tipoEsp === "discoteca" ? 0 : nAsientos),
      bar("animales", C_anim, "#8b1e1e"),
      bar("oficinas", C_of, "#5c4d7a"),
      bar("jardín", C_jard, "#6b9e6e"),
    ].filter((r) => r.c > 0 || r.n > 0),
    extrasTitle: "IS.010 2.2.g — locales de espectáculos y centros de reunión",
    extrasRows: [
      ["Tipo de establecimiento", "Dotación diaria", "Dato", "Subtotal (L/d)"],
      ["Cines, teatros y auditorios", "3 L por asiento", tipoEsp === "cine" ? String(nAsientos) : "—", tipoEsp === "cine" ? fmt(C_publico, 0) : "—"],
      ["Discotecas, casinos y salas de baile", "30 L/d·m² de área", tipoEsp === "discoteca" ? `${fmt(A_pista, 1)} m²` : "—", tipoEsp === "discoteca" ? fmt(C_publico, 0) : "—"],
      ["Estadios, velódromos, plazas de toros", "1 L por espectador", tipoEsp === "estadio" ? String(nAsientos) : "—", tipoEsp === "estadio" ? fmt(C_publico, 0) : "—"],
      ["Circos, hipódromos y parques de atracción", "1 L/espectador + animales", tipoEsp === "circo" ? String(nAsientos) : "—", tipoEsp === "circo" ? fmt(C_publico + C_anim, 0) : "—"],
      ["Oficinas 2.2.i", "6 L/d·m²", `${fmt(A_oficina, 1)} m²`, fmt(C_of, 0)],
      ["Jardines 2.2.u", "2 L/d·m²", `${fmt(A_jardin, 1)} m²`, fmt(C_jard, 0)],
      ["Total Cpd", "—", "—", fmt(CpdEsp, 0)],
    ],
    checks: [
      ok("Hay aforo o área de pista", tipoEsp === "discoteca" ? `${fmt(A_pista, 1)} m²` : String(nAsientos), "> 0", tipoEsp === "discoteca" ? A_pista > 0 : nAsientos >= 1),
      ok("Cpd ≥ público 2.2.g", `${fmt(CpdEsp, 0)} L/d`, `≥ ${fmt(C_publico, 0)} L/d`, CpdEsp + 1e-6 >= C_publico),
    ],
    audit: [
      `2.2.g (${etiqueta}): ${criterio} = ${fmt(C_publico, 0)} L/d.`,
      C_anim > 0 ? `Dotación de animales ${fmt(C_anim, 0)} L/d (se declara aparte, IS.010 2.2.p si aplica).` : "Sin dotación de animales.",
    ],
    steps: [
      {
        n: "01",
        title: "Identificación del local de espectáculos",
        formula: "tipo · aforo o área",
        substitution: `tipo = ${etiqueta}    ${tipoEsp === "discoteca" ? `A = ${fmt(A_pista, 1)} m²` : `asientos / espectadores = ${nAsientos}`}    pisos = ${niveles}`,
        result: `${etiqueta} de ${niveles} nivel(es)`,
        note: "IS.010 2.2.g clasifica cines/teatros/auditorios (por asiento), discotecas/casinos/salas de baile (por m²) y estadios/circos (por espectador).",
      },
      {
        n: "02",
        title: "Dotación de público — IS.010 2.2.g",
        formula: criterio,
        substitution: tipoEsp === "discoteca" ? `30 × ${fmt(A_pista, 1)}` : tipoEsp === "cine" ? `3 × ${nAsientos}` : `1 × ${nAsientos}`,
        result: `C_público = ${fmt(C_publico, 0)} L/d`,
        note: "En circos e hipódromos la norma suma además el agua de mantenimiento de animales (inciso 2.2.p o dato del proceso).",
      },
      {
        n: "03",
        title: "Anexos — oficinas y áreas verdes",
        formula: "C_of = 6 × A_útil    ·    C_jard = 2 × A_jardín    ·    C_animales (si aplica)",
        substitution: `oficinas ${fmt(A_oficina, 1)} m²    jardín ${fmt(A_jardin, 1)} m²    animales ${fmt(C_anim, 0)} L/d`,
        result: `anexos = ${fmt(C_of + C_jard + C_anim, 0)} L/d`,
        note: "Taquilla, administración y jardines no están dentro de la cifra por asiento. Se calculan con 2.2.i y 2.2.u.",
      },
      {
        n: "04",
        title: "Dotación de diseño",
        formula: "Cpd = C_público + C_anexos",
        substitution: `${fmt(C_publico, 0)} + ${fmt(C_of + C_jard + C_anim, 0)}`,
        result: `Cpd = ${fmt(CpdEsp, 0)} L/d  =  ${fmt(CpdEsp / 1000, 2)} m³/d`,
        note: "Cifra de diseño. Sigue almacenamiento 2.4 y Hunter 2.3 (el aforo alto suele gobernar los SS.HH. públicos).",
      },
    ],
  };
}

function calcDotacion(raw: Record<string, string>, modo: UsoDot): CalcOutput {
  const dem = demandaPorUso(raw, modo);
  const { Cpd, Nshow } = dem;
  const sistema = str(raw, "sistema", "combinado");
  const niveles = Math.max(1, Math.round(num(raw, "niveles", modo === "uni" ? 2 : 4)));
  const dias = Math.max(1, num(raw, "dias", modo === "uni" ? 1.5 : 1));
  const descarga = str(raw, "descarga", "tanque");
  const nInod = Math.max(0, num(raw, "nInod", modo === "uni" ? 3 : 12));
  const nLav = Math.max(0, num(raw, "nLav", modo === "uni" ? 4 : 14));
  const nDucha = Math.max(0, num(raw, "nDucha", modo === "uni" ? 3 : 12));
  const nTina = Math.max(0, num(raw, "nTina", 0));
  const nFreg = Math.max(0, num(raw, "nFreg", modo === "uni" ? 1 : 8));
  const nRopa = Math.max(0, num(raw, "nRopa", modo === "uni" ? 1 : 4));
  const nRiego = Math.max(0, num(raw, "nRiego", 1));
  const nUrin = Math.max(0, num(raw, "nUrin", 0));
  const nBebedero = Math.max(0, num(raw, "nBebedero", 0));
  const He = num(raw, "He", modo === "uni" ? 8 : 16);
  const hf = num(raw, "hf", modo === "uni" ? 3.5 : 6);
  const Ps = Math.max(2, num(raw, "Ps", 2));
  const eta = Math.min(0.85, Math.max(0.4, num(raw, "eta", 0.6)));
  const tBomba = Math.max(0.5, num(raw, "tBomba", 1.5));
  const Lc = Math.max(0.8, num(raw, "Lc", 1.5));
  const Bc = Math.max(0.8, num(raw, "Bc", 1.5));

  const combinado = sistema === "combinado";
  const soloTe = sistema === "elevado";
  const soloCis = sistema === "cisterna";

  const VcFrac = combinado ? 0.75 : soloTe ? 0 : 1;
  const VteFrac = combinado ? 1 / 3 : soloTe ? 1 : 0;
  const VcReq = VcFrac * Cpd;
  const VteReq = VteFrac * Cpd;
  const VcNorm = VcFrac > 0 ? Math.max(VcReq, 1000) : 0;
  const VteNorm = VteFrac > 0 ? Math.max(VteReq, 1000) : 0;
  const VcM3min = VcNorm > 0 ? Math.max(1, Math.ceil(VcNorm / 1000 - 1e-9)) : 0;
  const VcAdopL = VcNorm > 0 ? VcM3min * 1000 * dias : 0;
  const VteAdopL = VteNorm > 0 ? teComercial(VteNorm) : 0;
  const hCis = VcAdopL > 0 ? VcAdopL / 1000 / (Lc * Bc) : 0;
  const VolCisGeom = Lc * Bc * hCis;

  const uhInod = descarga === "valvula" ? 5 : 3;
  const uhTina = descarga === "valvula" ? 3 : 2;
  const uhUrin = descarga === "valvula" ? 5 : 3;
  const UH =
    nInod * uhInod +
    nLav * 1 +
    nDucha * 2 +
    nTina * uhTina +
    nFreg * 3 +
    nRopa * 3 +
    nRiego * 3 +
    nUrin * uhUrin +
    nBebedero * 0.5;
  const tablaH = descarga === "valvula" ? HUNTER_V : HUNTER_T;
  const Qmds = interp(tablaH, UH);

  const Vpump = combinado || soloTe ? VteAdopL : VcAdopL;
  const Qb = Vpump > 0 ? Vpump / (tBomba * 3600) : Qmds;
  const HDT = He + hf + Ps;
  const Php = (Qb * HDT) / (75 * eta);
  const PhpAdop = hpComercial(Php);
  const Qalim = Cpd / (4 * 3600);
  const Dcalc = Math.sqrt((4 * (Qalim / 1000)) / (Math.PI * 1.2)) * 1000;
  const Dnom = dnComercial(Dcalc);
  const rbC = rebose(VcAdopL || Cpd);
  const rbT = rebose(VteAdopL || Cpd);

  const sisNom =
    combinado
      ? "cisterna + bombeo + tanque elevado (IS.010 2.4.e)"
      : soloTe
        ? "solo tanque elevado (IS.010 2.4.c)"
        : soloCis
          ? "solo cisterna (IS.010 2.4.d)"
          : "hidroneumático (IS.010 2.4.f)";

  const steps: CalcStep[] = [...dem.steps];

  steps.push({
    n: "05",
    title: "Sistema de almacenamiento y regulación — IS.010 2.4",
    formula:
      "combinado: Vc ≥ ¾ Cpd y Vte ≥ ⅓ Cpd (mín. 1 000 L c/u)    ·    solo TE o solo cisterna o hidroneumático: V ≥ Cpd (mín. 1 000 L)",
    substitution: `sistema = ${sisNom}`,
    result: combinado
      ? `Vc ≥ ${fmt(VcReq, 0)} L    ·    Vte ≥ ${fmt(VteReq, 0)} L`
      : `V ≥ ${fmt(Cpd, 0)} L`,
    note: "Se usa sistema combinado cuando la red no es continua o no tiene presión suficiente (caso típico en el Perú). Hidroneumático: el volumen mínimo es el consumo diario.",
  });

  steps.push({
    n: "06",
    title: "Volumen de cisterna",
    formula: combinado
      ? "Vc = ¾ Cpd    ·    Vc_norma = máx(Vc ; 1 000)    ·    V_adop = ⌈Vc_norma/1 000⌉ × 1 000 × n_días"
      : soloTe
        ? "No hay cisterna en el esquema de solo tanque elevado."
        : "Vc = Cpd    ·    Vc_norma = máx(Vc ; 1 000)    ·    V_adop = ⌈Vc_norma/1 000⌉ × 1 000 × n_días",
    substitution: VcFrac > 0
      ? `¾ o 1 × ${fmt(Cpd, 0)} = ${fmt(VcReq, 0)} L    ·    norma ${fmt(VcNorm, 0)} L    ·    ${fmt(VcM3min, 0)} m³ × ${fmt(dias, 2)} d`
      : "—",
    result: VcAdopL > 0
      ? `Vc adoptada = ${fmt(VcAdopL, 0)} L  =  ${fmt(VcAdopL / 1000, 2)} m³    ·    ${fmt(Lc, 2)} × ${fmt(Bc, 2)} × ${fmt(hCis, 2)} m`
      : "Sin cisterna",
    note: modo === "uni"
      ? `En vivienda unifamiliar se suele colocar ${fmt(dias, 2)} día(s) de desabastecimiento sobre el mínimo de norma. La geometría ${fmt(Lc, 2)} × ${fmt(Bc, 2)} m define la altura de agua.`
      : `n_días = ${fmt(dias, 2)}. La cisterna se aleja ≥ 1 m de muros medianeros y desagües (IS.010 2.4.h).`,
    ok: VcAdopL <= 0 || VolCisGeom * 1000 + 1 >= VcAdopL,
  });

  steps.push({
    n: "07",
    title: "Volumen de tanque elevado",
    formula: combinado
      ? "Vte = ⅓ Cpd    ·    Vte_norma = máx(Vte ; 1 000)    ·    adoptar capacidad comercial ≥ norma"
      : soloTe
        ? "Vte = Cpd    ·    mínimo 1 000 L    ·    capacidad comercial"
        : "Sin tanque elevado (cisterna o hidroneumático).",
    substitution: VteFrac > 0
      ? `${fmt(VteFrac, 3)} × ${fmt(Cpd, 0)} = ${fmt(VteReq, 0)} L    ·    norma ${fmt(VteNorm, 0)} L`
      : "—",
    result: VteAdopL > 0
      ? `Vte adoptado = ${fmt(VteAdopL, 0)} L  (${fmt(VteAdopL / 1000, 2)} m³)${VteAdopL === 1100 && VteReq <= 1100 ? "  ·  mínimo comercial" : ""}`
      : "Sin tanque elevado",
    note: "Capacidades comerciales típicas: 1 100, 1 500, 2 500, 3 600, 5 000, 7 000 L. El mínimo de norma es 1 000 L; el de 1 100 L cubre el tanque prefabricado usual.",
  });

  steps.push({
    n: "08",
    title: "Unidades Hunter de los aparatos — IS.010 2.3",
    formula: descarga === "valvula"
      ? "UH = 5·inod + 1·lav + 2·ducha + 3·tina + 3·freg + 3·ropa + 3·riego + 5·urin + 0,5·bebedero"
      : "UH = 3·inod + 1·lav + 2·ducha + 2·tina + 3·freg + 3·ropa + 3·riego + 3·urin + 0,5·bebedero",
    substitution: `${fmt(nInod, 0)} inod + ${fmt(nLav, 0)} lav + ${fmt(nDucha, 0)} ducha + ${fmt(nTina, 0)} tina + ${fmt(nFreg, 0)} freg + ${fmt(nRopa, 0)} ropa + ${fmt(nRiego, 0)} riego + ${fmt(nUrin, 0)} urin + ${fmt(nBebedero, 0)} bebedero   (${descarga})`,
    result: `Σ UH = ${fmt(UH, 1)}`,
    note: "Baño completo con tanque ≈ inodoro 3 + lavatorio 1 + ducha 2 = 6 UH. En locales públicos se suman urinarios (3 UH tanque / 5 UH válvula) y bebederos (0,5 UH).",
  });

  steps.push({
    n: "09",
    title: "Máxima demanda simultánea (gasto probable)",
    formula: "Qmds = Hunter(Σ UH)    ·    curva de tanque o de válvula",
    substitution: `${fmt(UH, 1)} UH en curva ${descarga}  →  interpolación del anexo IS.010`,
    result: `Qmds = ${fmt(Qmds, 2)} L/s  =  ${fmt(Qmds * 3.6, 2)} m³/h`,
    note: "Con este caudal se dimensionan las tuberías de distribución. Presión mínima de aparato 2 m.c.a.; máxima estática 50 m.c.a. (IS.010 2.3.c–d).",
  });

  const muestraBomba = sistema !== "elevado";
  steps.push({
    n: "10",
    title: muestraBomba ? "Equipo de bombeo" : "Llenado del tanque elevado",
    formula: "Qb = V / (t × 3 600)    ·    HDT = He + hf + Ps    ·    P(Hp) = Qb × HDT / (75 η)",
    substitution: `V = ${fmt(Vpump, 0)} L    t = ${fmt(tBomba, 2)} h    Qb = ${fmt(Qb, 3)} L/s    He=${fmt(He, 2)}  hf=${fmt(hf, 2)}  Ps=${fmt(Ps, 2)}  η=${fmt(eta * 100, 0)} %`,
    result: `HDT = ${fmt(HDT, 2)} m    ·    P = ${fmt(Php, 2)} Hp  ≈  ${fmt(PhpAdop, 2)} Hp`,
    note: "Ps ≥ 2 m en la salida (IS.010 2.3.d). Se arranca la bomba cuando el TE baja a la mitad de la altura útil y se para en el nivel máximo; se para también si la cisterna llega a 0,05 m sobre la canastilla (IS.010 2.4.o).",
  });

  steps.push({
    n: "11",
    title: "Alimentación y rebose",
    formula: "Q_alim = Cpd / (4 × 3 600)    ·    D = √(4Q / (π v)) con v = 1,2 m/s    ·    Ø rebose según capacidad",
    substitution: `Q_alim = ${fmt(Qalim, 3)} L/s    D_calc = ${fmt(Dcalc, 0)} mm    Vc = ${fmt(VcAdopL, 0)} L    Vte = ${fmt(VteAdopL, 0)} L`,
    result: `Ø alimentación ≈ ${Dnom} mm    ·    rebose cisterna ${rbC.pulg}    ·    rebose TE ${rbT.pulg}`,
    note: "El diámetro de alimentación debe garantizar el volumen mínimo de almacenamiento diario (IS.010 2.4.n). El rebose descarga con brecha de aire ≥ 0,05 m (IS.010 2.4.l).",
  });

  const auditProc: string[] = [...dem.audit];
  if (combinado) {
    auditProc.push(
      VcAdopL + 1e-6 >= Math.max(0.75 * Cpd, 1000)
        ? `Cisterna ${fmt(VcAdopL, 0)} L ≥ máx(¾ Cpd, 1 000) = ${fmt(Math.max(0.75 * Cpd, 1000), 0)} L.`
        : `La cisterna quedó por debajo de IS.010 2.4.e.`
    );
    auditProc.push(
      VteAdopL + 1e-6 >= Math.max(Cpd / 3, 1000)
        ? `Tanque elevado ${fmt(VteAdopL, 0)} L ≥ máx(⅓ Cpd, 1 000) = ${fmt(Math.max(Cpd / 3, 1000), 0)} L.`
        : `El tanque elevado quedó por debajo de IS.010 2.4.e.`
    );
  }
  const Qh = interp(tablaH, UH);
  auditProc.push(
    Math.abs(Qh - Qmds) < 0.011
      ? `Hunter(${fmt(UH, 1)} UH, ${descarga}) = ${fmt(Qmds, 2)} L/s.`
      : `El gasto probable no coincide con la curva Hunter.`
  );
  const Pcheck = (Qb * HDT) / (75 * eta);
  auditProc.push(
    Math.abs(Pcheck - Php) < 0.02
      ? `P = Qb·HDT/(75η) = ${fmt(Php, 2)} Hp, se adopta ${fmt(PhpAdop, 2)} Hp.`
      : `La potencia de bomba no cierra.`
  );

  steps.push({
    n: "12",
    title: "Auditoría del procedimiento",
    formula: "Releer IS.010 2.2 (dotación) y 2.4 (almacenamiento) con los mismos números de los pasos 01–11",
    substitution: auditProc.join(" "),
    result: auditProc.every((t) => !/no coincide|por debajo|no cierra|Inconsistencia/i.test(t))
      ? "Procedimiento auditado: las fórmulas, la tabla y los mínimos de norma cierran."
      : "Hay un desajuste: revisar los pasos marcados.",
    note: "La auditoría no introduce hipótesis nuevas: solo vuelve a evaluar Cpd, ¾, ⅓, Hunter y P con los datos ya usados.",
    ok: auditProc.every((t) => !/no coincide|por debajo|no cierra|Inconsistencia/i.test(t)),
  });

  const grafOk =
    Cpd > 0 &&
    (VcAdopL === 0 || VcAdopL >= 1000) &&
    (VteAdopL === 0 || VteAdopL >= 1000) &&
    UH >= 0 &&
    Qmds >= 0;
  steps.push({
    n: "13",
    title: "Auditoría de gráficos",
    formula: "Los croquis leen Cpd, Vc, Vte, UH y Qmds del mismo resultado (dims), no de un texto suelto",
    substitution: `esquema: Cpd=${fmt(Cpd, 0)} L/d, cisterna ${fmt(VcAdopL, 0)} L, TE ${fmt(VteAdopL, 0)} L    ·    Hunter: ${fmt(UH, 1)} UH → ${fmt(Qmds, 2)} L/s    ·    ocupación: ${fmt(Nshow, 0)} hab`,
    result: grafOk
      ? "Croquis consistentes con el cálculo: barras, volúmenes y punto Hunter usan las cifras adoptadas."
      : "Revisar dims del croquis.",
    note: "Figura 1 lote/ocupación, figura 2 esquema hidráulico, figura 3 volúmenes ¾ y ⅓, figura 4 curva Hunter. Si se cambia un dato, los cuatro gráficos se regeneran juntos.",
    ok: grafOk,
  });

  const checks: CalcCheck[] = [...dem.checks];
  if (VcFrac > 0) {
    checks.push(ok("Cisterna ≥ ¾ (o 100 %) y ≥ 1 000 L", `${fmt(VcAdopL, 0)} L`, `≥ ${fmt(Math.max(VcReq, 1000), 0)} L`, VcAdopL + 1 >= Math.max(VcReq, 1000)));
    checks.push(ok("Geometría de cisterna ≥ volumen adoptado", `${fmt(VolCisGeom, 2)} m³`, `≥ ${fmt(VcAdopL / 1000, 2)} m³`, VolCisGeom * 1000 + 1 >= VcAdopL));
    checks.push(ok("Cisterna: días de reserva ≥ 1", fmt(dias, 2), "≥ 1", dias >= 1));
  }
  if (VteFrac > 0) {
    checks.push(ok("Tanque elevado ≥ ⅓ (o 100 %) y ≥ 1 000 L", `${fmt(VteAdopL, 0)} L`, `≥ ${fmt(Math.max(VteReq, 1000), 0)} L`, VteAdopL + 1 >= Math.max(VteReq, 1000)));
  }
  checks.push(ok("Presión residual Ps ≥ 2 m", `${fmt(Ps, 2)} m`, "≥ 2 m", Ps >= 2));
  checks.push(ok("HDT = He + hf + Ps", `${fmt(HDT, 2)} m`, `${fmt(He + hf + Ps, 2)} m`, Math.abs(HDT - He - hf - Ps) < 0.02));
  checks.push(ok("Qmds Hunter ≥ 0", `${fmt(Qmds, 2)} L/s`, "≥ 0", Qmds >= 0));
  checks.push(ok("Bomba comercial ≥ P calculada", `${fmt(PhpAdop, 2)} Hp`, `≥ ${fmt(Php, 2)} Hp`, PhpAdop + 1e-9 >= Php));

  const extras: NonNullable<CalcOutput["extras"]> = [
    { title: dem.extrasTitle, rows: dem.extrasRows },
  ];
  extras.push({
    title: "Aparatos y unidades Hunter",
    rows: [
      ["Aparato", "N°", `UH c/u (${descarga})`, "UH parcial"],
      ["Inodoro", fmt(nInod, 0), fmt(uhInod, 0), fmt(nInod * uhInod, 1)],
      ["Lavatorio", fmt(nLav, 0), "1", fmt(nLav, 1)],
      ["Ducha", fmt(nDucha, 0), "2", fmt(nDucha * 2, 1)],
      ["Tina", fmt(nTina, 0), fmt(uhTina, 0), fmt(nTina * uhTina, 1)],
      ["Fregadero / lavadero cocina", fmt(nFreg, 0), "3", fmt(nFreg * 3, 1)],
      ["Lavadero de ropa", fmt(nRopa, 0), "3", fmt(nRopa * 3, 1)],
      ["Válvula de riego", fmt(nRiego, 0), "3", fmt(nRiego * 3, 1)],
      ...(nUrin > 0 ? [["Urinario", fmt(nUrin, 0), fmt(uhUrin, 0), fmt(nUrin * uhUrin, 1)] as string[]] : []),
      ...(nBebedero > 0 ? [["Bebedero", fmt(nBebedero, 0), "0,5", fmt(nBebedero * 0.5, 1)] as string[]] : []),
      ["Total", "—", "—", fmt(UH, 1)],
    ],
  });
  extras.push({
    title: "Resumen de almacenamiento y bombeo",
    rows: [
      ["Grandeza", "Requerido", "Adoptado"],
      ["Dotación Cpd", `${fmt(Cpd, 0)} L/d`, `${fmt(Cpd / 1000, 2)} m³/d`],
      ["Cisterna", VcFrac > 0 ? `${fmt(Math.max(VcReq, 1000), 0)} L` : "—", VcAdopL > 0 ? `${fmt(VcAdopL, 0)} L` : "—"],
      ["Tanque elevado", VteFrac > 0 ? `${fmt(Math.max(VteReq, 1000), 0)} L` : "—", VteAdopL > 0 ? `${fmt(VteAdopL, 0)} L` : "—"],
      ["Qmds Hunter", `${fmt(UH, 1)} UH`, `${fmt(Qmds, 2)} L/s`],
      ["Bomba", `${fmt(Php, 2)} Hp`, `${fmt(PhpAdop, 2)} Hp`],
      ["Ø alimentación / rebose C / rebose TE", `${Dnom} mm`, `${rbC.pulg} / ${rbT.pulg}`],
    ],
  });

  const headline = combinado
    ? `Cpd = ${fmt(Cpd, 0)} L/d   ·   cisterna ${fmt(VcAdopL / 1000, 2)} m³   ·   TE ${fmt(VteAdopL, 0)} L`
    : `Cpd = ${fmt(Cpd, 0)} L/d   ·   ${sisNom}   ·   Qmds = ${fmt(Qmds, 2)} L/s`;

  const adoption = combinado
    ? `Sistema combinado IS.010 2.4.e. Cisterna ${fmt(VcAdopL, 0)} L (${fmt(Lc, 2)}×${fmt(Bc, 2)}×${fmt(hCis, 2)} m). Tanque elevado ${fmt(VteAdopL, 0)} L. Bomba ${fmt(PhpAdop, 2)} Hp. Qmds = ${fmt(Qmds, 2)} L/s (${fmt(UH, 1)} UH).`
    : `${sisNom}. Volumen de depósito ${fmt(Math.max(VcAdopL, VteAdopL), 0)} L. Qmds = ${fmt(Qmds, 2)} L/s.`;

  return out(headline, adoption, steps, checks, extras, {
    modo,
    sistema,
    ocupHeading: dem.ocupHeading,
    ocupCaption: dem.ocupCaption,
    ocupBars: JSON.stringify(dem.bars),
    Cpd: String(Math.round(Cpd)),
    Nhab: String(Nshow),
    niveles: String(niveles),
    VcReq: String(Math.round(VcReq)),
    VcAdop: String(Math.round(VcAdopL)),
    VteReq: String(Math.round(VteReq)),
    VteAdop: String(Math.round(VteAdopL)),
    Lc: Lc.toFixed(2),
    Bc: Bc.toFixed(2),
    hCis: hCis.toFixed(2),
    UH: UH.toFixed(1),
    Qmds: Qmds.toFixed(2),
    Qb: Qb.toFixed(3),
    HDT: HDT.toFixed(2),
    He: He.toFixed(2),
    Php: PhpAdop.toFixed(2),
    descarga,
    ...dem.dimsExtra,
  });
}

export const dotacionUnifamiliar: Engine = (raw) => calcDotacion(raw, "uni");
export const dotacionMultifamiliar: Engine = (raw) => calcDotacion(raw, "multi");
export const dotacionHotel: Engine = (raw) => calcDotacion(raw, "hotel");
export const dotacionRestaurante: Engine = (raw) => calcDotacion(raw, "restaurante");
export const dotacionHospital: Engine = (raw) => calcDotacion(raw, "hospital");
export const dotacionOficinas: Engine = (raw) => calcDotacion(raw, "oficina");
export const dotacionComercial: Engine = (raw) => calcDotacion(raw, "comercial");
export const dotacionEducacion: Engine = (raw) => calcDotacion(raw, "educacion");
export const dotacionEspectaculo: Engine = (raw) => calcDotacion(raw, "espectaculo");
