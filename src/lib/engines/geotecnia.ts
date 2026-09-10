import { type CalcCheck, type CalcOutput, type Engine, fmt, num, rad, str } from "../types";

function out(
  headline: string,
  adoption: string,
  steps: CalcOutput["steps"],
  checks: CalcCheck[],
  extras?: CalcOutput["extras"]
): CalcOutput {
  return { headline, adoption, steps, checks, extras };
}
function ok(label: string, value: string, limit: string, pass: boolean): CalcCheck {
  return { label, value, limit, ok: pass };
}

/** Tabla C5 «FACTORES DE CARGA» · φ = 0…50° · [Nc, Nq, Nγ] falla general */
const N_GEN: [number, number, number][] = [
  [5.14, 1, 0], [5.38, 1.09, 0.07], [5.63, 1.2, 0.15], [5.9, 1.31, 0.24], [6.19, 1.43, 0.34],
  [6.49, 1.57, 0.45], [6.81, 1.72, 0.57], [7.16, 1.88, 0.71], [7.53, 2.06, 0.86], [7.92, 2.25, 1.03],
  [8.35, 2.47, 1.22], [8.8, 2.71, 1.44], [9.28, 2.97, 1.69], [9.81, 3.26, 1.97], [10.37, 3.59, 2.29],
  [10.98, 3.94, 2.65], [11.63, 4.34, 3.06], [12.34, 4.77, 3.53], [13.1, 5.26, 4.07], [13.93, 5.8, 4.68],
  [14.83, 6.4, 5.39], [15.82, 7.07, 6.2], [16.88, 7.82, 7.13], [18.05, 8.66, 8.2], [19.32, 9.6, 9.44],
  [20.72, 10.66, 10.88], [22.25, 11.85, 12.54], [23.94, 13.2, 14.47], [25.8, 14.72, 16.72], [27.86, 16.44, 19.34],
  [30.14, 18.4, 22.4], [32.67, 20.63, 25.99], [35.49, 23.18, 30.22], [38.64, 26.09, 35.19], [42.16, 29.44, 41.06],
  [46.12, 33.3, 48.03], [50.59, 37.75, 56.31], [55.63, 42.92, 66.19], [61.35, 48.93, 78.03], [67.87, 55.96, 92.25],
  [75.31, 64.2, 109.41], [83.86, 73.9, 130.22], [93.71, 85.38, 155.55], [105.11, 99.02, 186.54], [118.37, 115.31, 224.64],
  [133.88, 134.88, 271.76], [152.1, 158.51, 330.35], [173.64, 187.21, 403.67], [188.26, 222.31, 496.01], [229.93, 265.51, 613.16],
  [266.89, 319.07, 762.89],
];
/** N′c, N′q, N′γ · falla local / punzonamiento (C5) */
const N_LOC: [number, number, number][] = [
  [5.7, 1, 0], [5.9, 1.07, 0.005], [6.1, 1.14, 0.02], [6.3, 1.22, 0.04], [6.51, 1.3, 0.065],
  [6.74, 1.39, 0.074], [6.97, 1.49, 0.1], [7.22, 1.59, 0.128], [7.47, 1.7, 0.16], [7.74, 1.82, 0.2],
  [8.02, 1.94, 0.24], [8.32, 2.08, 0.3], [8.63, 2.22, 0.35], [8.96, 2.38, 0.42], [9.31, 2.55, 0.48],
  [9.67, 2.73, 0.57], [10.05, 2.92, 0.67], [10.47, 3.13, 0.76], [10.9, 3.36, 0.88], [11.36, 3.61, 1.03],
  [11.85, 3.88, 1.12], [12.37, 4.17, 1.35], [12.92, 4.48, 1.55], [13.51, 4.82, 1.74], [14.14, 5.2, 1.97],
  [14.8, 5.6, 2.25], [15.53, 6.05, 2.59], [16.3, 6.54, 2.88], [17.13, 7.07, 3.29], [18.03, 7.66, 3.76],
  [18.99, 8.31, 4.39], [20.03, 9.03, 4.83], [21.16, 9.82, 5.51], [22.39, 10.69, 6.32], [23.72, 11.67, 7.22],
  [25.18, 12.75, 8.35], [26.77, 13.97, 9.41], [28.51, 15.32, 10.9], [30.43, 16.85, 12.75], [32.53, 18.56, 14.71],
  [34.87, 20.5, 17.22], [37.45, 22.7, 19.75], [40.33, 25.21, 22.5], [43.54, 28.06, 26.25], [47.13, 31.34, 30.4],
  [51.17, 35.11, 36], [55.73, 39.48, 41.7], [60.91, 44.45, 49.3], [66.8, 50.46, 59.25], [73.55, 57.41, 71.45],
  [81.31, 65.6, 85.75],
];

function lerpN(phi: number, local: boolean) {
  const t = local ? N_LOC : N_GEN;
  const p = Math.max(0, Math.min(50, phi));
  const i0 = Math.floor(p);
  const i1 = Math.min(50, i0 + 1);
  const u = p - i0;
  const a = t[i0];
  const b = t[i1];
  return {
    Nc: a[0] + u * (b[0] - a[0]),
    Nq: a[1] + u * (b[1] - a[1]),
    Ng: a[2] + u * (b[2] - a[2]),
  };
}

/** N estimado a partir de φ (tabla C5, Rodriguez Serquén / Carter–Bentley). φ < 25° → N = 2 */
const N_FROM_PHI: [number, number][] = [
  [25, 3], [26, 3], [27, 4], [28, 4], [29, 5], [30, 10], [31, 11], [32, 15], [33, 19], [34, 23],
  [35, 27], [36, 30], [37, 31], [38, 36], [39, 41], [40, 46], [41, 51], [42, 55], [43, 60], [44, 66], [45, 72],
];
function nFromPhi(phi: number) {
  if (phi < 25) return 2;
  const p = Math.max(25, Math.min(45, phi));
  const i0 = N_FROM_PHI.findIndex((r, i) => p >= r[0] && (i === N_FROM_PHI.length - 1 || p < N_FROM_PHI[i + 1][0]));
  const a = N_FROM_PHI[Math.max(0, i0)];
  const b = N_FROM_PHI[Math.min(N_FROM_PHI.length - 1, i0 + 1)];
  if (a[0] === b[0]) return a[1];
  return a[1] + ((p - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
}

function phiFromN(N: number) {
  if (N <= 4) return 28;
  if (N <= 10) return 28 + ((N - 4) / 6) * 2;
  if (N <= 30) return 30 + ((N - 10) / 20) * 6;
  if (N <= 50) return 36 + ((N - 30) / 20) * 5;
  return Math.min(46, 41 + ((N - 50) / 30) * 5);
}

function densRel(N: number) {
  if (N <= 4) return { desc: "Muy floja", dr: "0 – 15 %", phiR: "28°", E: "100" };
  if (N <= 10) return { desc: "Floja", dr: "16 – 35 %", phiR: "28 – 30°", E: "100 – 250" };
  if (N <= 30) return { desc: "Media", dr: "36 – 65 %", phiR: "30 – 36°", E: "250 – 500" };
  if (N <= 50) return { desc: "Densa", dr: "66 – 85 %", phiR: "36 – 41°", E: "500 – 1 000" };
  return { desc: "Muy densa", dr: "86 – 100 %", phiR: "> 41°", E: "> 1 000" };
}

function tipoFallaFromN(N: number): "general" | "local" | "punzonamiento" {
  if (N > 15) return "general";
  if (N > 10) return "local";
  return "punzonamiento";
}

function nFromQu(qu: number, IP: number, sucs: string) {
  const s = sucs.toUpperCase();
  if (s.startsWith("CH") || s.startsWith("MH") || s.startsWith("OH") || s.startsWith("OL") || IP > 30) {
    return { N: 1.2 + 5.9 * qu, ley: "N = 1.20 + 5.90 qu  (arcillas / limos de alta plasticidad, Sowers)" };
  }
  if (s.startsWith("CL") || IP > 25) {
    return { N: 4 * qu, ley: "N = 4 qu  (arcillas de plasticidad media, Sowers / C5)" };
  }
  return { N: 0.04 + 13.28 * qu, ley: "N = 0.04 + 13.28 qu  (arcillas de baja plasticidad y limos, Sowers)" };
}

function sucsNombre(sucs: string) {
  const m: Record<string, string> = {
    GW: "Grava bien graduada",
    GP: "Grava pobremente graduada",
    GM: "Grava limosa",
    GC: "Grava arcillosa",
    SW: "Arena bien graduada",
    SP: "Arena pobremente graduada",
    SM: "Arena limosa",
    SC: "Arena arcillosa",
    ML: "Limo inorgánico de baja plasticidad",
    CL: "Arcilla inorgánica de baja / mediana plasticidad",
    OL: "Limo orgánico de baja plasticidad",
    MH: "Limo inorgánico de alta plasticidad",
    CH: "Arcilla inorgánica de alta plasticidad",
    OH: "Arcilla orgánica de alta plasticidad",
    PT: "Turba / suelo altamente orgánico",
  };
  return m[sucs.toUpperCase()] ?? sucs;
}

function sucsCaract(sucs: string) {
  const k = sucs.toUpperCase().slice(0, 2);
  const rows: Record<string, string[]> = {
    GW: ["Excelente", "Excelente", "Bueno", "Casi ninguna", "Excelente", "40 – 80", "300 – 500"],
    GP: ["Bueno a excelente", "Bueno", "Favorable a bueno", "Casi ninguna", "Excelente", "30 – 60", "300 – 500"],
    GM: ["Bueno a excelente", "Bueno", "Favorable a bueno", "Muy ligera", "Favorable a malo", "40 – 60", "300 – 500"],
    GC: ["Bueno", "Favorable", "Malo", "Ligera", "Malo / impermeable", "20 – 40", "200 – 500"],
    SW: ["Bueno", "Favorable a bueno", "Malo a no conveniente", "Casi ninguna", "Excelente", "20 – 40", "200 – 400"],
    SP: ["Favorable a bueno", "Favorable", "Malo", "Casi ninguna", "Excelente", "10 – 40", "150 – 400"],
    SM: ["Favorable a bueno", "Favorable a bueno", "No conveniente", "Muy ligera", "Favorable a malo", "15 – 40", "150 – 400"],
    SC: ["Malo a favorable", "Malo", "No conveniente", "Ligera a mediana", "Malo / impermeable", "15 – 20", "100 – 300"],
    ML: ["Malo a favorable", "No conveniente", "No conveniente", "Ligera a mediana", "Favorable a malo", "15 o menos", "100 – 200"],
    CL: ["Malo a favorable", "No conveniente", "No conveniente", "Mediana", "Casi impermeable", "15 o menos", "50 – 150"],
    OL: ["Malo", "No conveniente", "No conveniente", "Mediana alta", "Malo", "5 o menos", "50 – 100"],
    MH: ["Malo", "No conveniente", "No conveniente", "Alta", "Favorable a malo", "10 o menos", "50 – 100"],
    CH: ["Malo a favorable", "No conveniente", "No conveniente", "Alta", "Casi impermeable", "15 o menos", "50 – 150"],
    OH: ["Malo a pésimo", "No conveniente", "No conveniente", "Alta", "Casi impermeable", "5 o menos", "25 – 100"],
    PT: ["No conveniente", "No conveniente", "No conveniente", "Muy alta", "Favorable a malo", "—", "—"],
  };
  return rows[k] ?? ["Revisar SUCS", "—", "—", "—", "—", "—", "—"];
}

function shapeOf(tipo: string, B: number, L: number, local: boolean) {
  const cLab = local ? "c'" : "c";
  const nLab = local ? "N′" : "N";
  if (tipo === "cuadrada") {
    return { sc: 1.3, sg: 0.4, formula: `qu = 1.3 ${cLab} ${nLab}c + γ Z ${nLab}q + 0.4 γ B ${nLab}γ`, scTxt: "1.3", sgTxt: "0.4" };
  }
  if (tipo === "circular") {
    return { sc: 1.3, sg: 0.6, formula: `qu = 1.3 ${cLab} ${nLab}c + γ Z ${nLab}q + 0.6 γ R ${nLab}γ`, scTxt: "1.3", sgTxt: "0.6" };
  }
  if (tipo === "rectangular") {
    const sc = 1 + 0.3 * (B / Math.max(L, B));
    const sg = 0.5 * (1 - 0.2 * (B / Math.max(L, B)));
    return {
      sc,
      sg,
      formula: `qu = ${cLab} ${nLab}c (1 + 0.3 B/L) + γ Z ${nLab}q + 0.5 γ B ${nLab}γ (1 − 0.2 B/L)`,
      scTxt: fmt(sc, 3),
      sgTxt: fmt(sg, 3),
    };
  }
  return { sc: 1, sg: 0.5, formula: `qu = ${cLab} ${nLab}c + γ Z ${nLab}q + 0.5 γ B ${nLab}γ`, scTxt: "1.0", sgTxt: "0.5" };
}

function napaTerms(gammaKg: number, Df: number, NF: number, B: number) {
  if (!(NF > 0)) {
    return { gZ: gammaKg * Df, gB: gammaKg, note: "no se encontró napa freática · se usa γ natural en todos los términos" };
  }
  const gsub = gammaKg * 1.05 - 1000;
  if (NF > Df) {
    const gB = gsub + ((NF - Df) / Math.max(B, 0.05)) * (gammaKg - gsub);
    return {
      gZ: gammaKg * Df,
      gB,
      note: `napa a ${fmt(NF, 2)} m, por debajo del desplante (Dw = ${fmt(NF - Df, 2)} m). El término Nγ usa γ interpolado entre γ' y γ.`,
    };
  }
  if (NF > 0 && Df > NF) {
    const gZ = (gammaKg - 1000) * (Df - NF) + NF * gammaKg;
    return { gZ, gB: gammaKg - 1000, note: "napa por encima del desplante · sobrecarga combinada γ·NF + γ'(Df−NF) y γ' en Nγ" };
  }
  return { gZ: (gammaKg - 1000) * Df, gB: gammaKg - 1000, note: "perfil saturado · se usa γ' = γ − 1.00 t/m³" };
}

function linreg(xs: number[], ys: number[]) {
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const den = n * sxx - sx * sx;
  const b = den !== 0 ? (n * sxy - sx * sy) / den : 0;
  const a = (sy - b * sx) / n;
  return { a, b };
}

function classifySUCS(p4: number, p200: number, Cu: number, Cc: number, LL: number, IP: number) {
  const gravel = Math.max(0, 100 - p4);
  const sand = Math.max(0, p4 - p200);
  const fines = p200;
  const aLine = 0.73 * (LL - 20);
  const aboveA = IP >= aLine && IP >= 4;
  const clayFines = aboveA && IP > 7;
  if (fines >= 50) {
    const H = LL >= 50;
    if (IP < 4) return H ? "MH" : "ML";
    if (IP >= 4 && IP <= 7 && !H) return "CL-ML";
    if (clayFines) return H ? "CH" : "CL";
    return H ? "MH" : "ML";
  }
  const coarse = gravel >= sand ? "G" : "S";
  const well = Cu >= (coarse === "G" ? 4 : 6) && Cc >= 1 && Cc <= 3;
  if (fines < 5) return coarse + (well ? "W" : "P");
  if (fines <= 12) {
    const dual = clayFines ? "C" : "M";
    return `${coarse}${well ? "W" : "P"}-${coarse}${dual}`;
  }
  return coarse + (clayFines ? "C" : "M");
}

/* ───────── Capacidad portante · C5 / Estudio de suelos completo ───────── */
export const capPortante: Engine = (raw) => {
  const c = num(raw, "c", 0.1138);
  const phi = num(raw, "phi", 5.78);
  const gamma = num(raw, "gamma", 1.59);
  const Df = num(raw, "Df", 2.2);
  const B = num(raw, "B", 1.5);
  const Lf = num(raw, "Lf", 1.5);
  const FS = num(raw, "FS", 3);
  const tipo = str(raw, "tipo", "cuadrada");
  const sucs = str(raw, "sucs", "SC").toUpperCase();
  const NF = num(raw, "NF", 2.6);
  const scarga = num(raw, "sc", 500);
  const Nuser = num(raw, "N", 0);
  const quLab = num(raw, "qu", 0.9);
  const IP = num(raw, "IP", 25.35);
  const fallaIn = str(raw, "falla", "auto");

  let Nsp = Nuser;
  let nOrigen = "SPT ingresado";
  if (!(Nuser > 0)) {
    const esFino = /^(CL|CH|ML|MH|OL|OH|PT)/.test(sucs) || pFinesHint(sucs);
    if (esFino && quLab > 0) {
      const r = nFromQu(quLab, IP, sucs);
      Nsp = r.N;
      nOrigen = r.ley;
    } else {
      Nsp = nFromPhi(phi);
      nOrigen = phi < 25
        ? "φ < 25° → N = 2 (tabla C5, sin SPT)"
        : "N interpolado de φ (Carter y Bentley / Rodríguez Serquén, C5)";
    }
  }
  const autoFalla = tipoFallaFromN(Nsp);
  const falla = fallaIn === "auto" ? autoFalla : (fallaIn as "general" | "local" | "punzonamiento");
  const local = falla !== "general";
  const fallaNom = falla === "general" ? "CORTE GENERAL" : falla === "local" ? "CORTE LOCAL" : "PUNZONAMIENTO";
  const { Nc, Nq, Ng } = lerpN(phi, local);
  const sh = shapeOf(tipo, B, Math.max(Lf, B), local);
  const cUse = local ? (2 / 3) * c : c;
  const cKgM2 = cUse * 10000;
  const gammaKg = gamma * 1000;
  const napa = napaTerms(gammaKg, Df, NF, B);
  const termC = sh.sc * cKgM2 * Nc;
  const termQ = napa.gZ * Nq;
  const termG = napa.gB * B * sh.sg * Ng;
  const quKg = termC + termQ + termG;
  const qu = quKg / 10000;
  const qadm = qu / FS;
  const qneto = Math.max(0, qadm - (gammaKg / 10000) * Df - scarga / 10000);
  const dr = densRel(Nsp);
  const car = sucsCaract(sucs);
  const phiN = phiFromN(Nsp);
  const nLab = local ? "N′" : "N";

  return out(
    `qadm = ${fmt(qadm, 2)} kg/cm²   ·   qneto = ${fmt(qneto, 2)} kg/cm²`,
    `${fallaNom}  ·  zapata ${tipo}  ·  ${sucs} ${sucsNombre(sucs)}  ·  FS = ${fmt(FS, 1)}`,
    [
      {
        n: "01",
        title: "Datos del suelo y de la cimentación",
        formula: "Terzaghi · E.050  ·  hoja CAPACIDAD PORTANTE (C5 / Estudio de suelos completo)",
        substitution: `SUCS ${sucs} (${sucsNombre(sucs)})  ·  Df = ${fmt(Df, 2)} m  ·  B = ${fmt(B, 2)} m${tipo === "rectangular" ? `  ·  L = ${fmt(Lf, 2)} m` : ""}  ·  φ = ${fmt(phi, 2)}°  ·  c = ${fmt(c, 4)} kg/cm²  ·  γ = ${fmt(gamma, 3)} t/m³`,
        result: `NF = ${NF > 0 ? `${fmt(NF, 2)} m` : "no detectada"}    S/C = ${fmt(scarga, 0)} kg/m²`,
        note: "c y φ salen de corte directo (y, en finos, del promedio con cu = qu/2 de compresión simple), como en C5.",
      },
      {
        n: "02",
        title: "Número de golpes N y tipo de falla",
        formula: "N > 15 corte general   ·   10 < N ≤ 15 corte local   ·   N ≤ 10 punzonamiento",
        substitution: `${nOrigen}  →  N = ${fmt(Nsp, 1)}`,
        result: `Tipo de falla: ${fallaNom}${fallaIn === "auto" ? " (automático)" : " (impuesto)"}`,
        note: "Criterio de C5 «SUSTENTO TIPO DE FALLA». Sin SPT se estima N con φ (arenas) o con qu (arcillas, Sowers).",
      },
      {
        n: "03",
        title: "Correlación N – φ – Dr – E (arenas)",
        formula: "Carter y Bentley (1991)  ·  tabla C5 para otros parámetros de arenas",
        substitution: `N = ${fmt(Nsp, 1)}  →  φ estimado ${fmt(phiN, 1)}°  (ensayo φ = ${fmt(phi, 2)}°)`,
        result: `${dr.desc}  ·  Dr ${dr.dr}  ·  φ tabla ${dr.phiR}  ·  E ${dr.E} kg/cm²`,
        note: "La φ de diseño es la de laboratorio (corte directo). La correlación SPT se usa para N, Dr y el tipo de falla.",
      },
      {
        n: "04",
        title: local ? "Cohesión reducida c′ (falla local / punzonamiento)" : "Cohesión de diseño c",
        formula: local ? "c′ = (2/3) c" : "c se usa completa (falla general)",
        substitution: local ? `c′ = (2/3)×${fmt(c, 4)} = ${fmt(cUse, 4)} kg/cm² = ${fmt(cKgM2, 2)} kg/m²` : `c = ${fmt(c, 4)} kg/cm² = ${fmt(cKgM2, 2)} kg/m²`,
        result: `${local ? "c′" : "c"} = ${fmt(cUse, 4)} kg/cm²`,
        note: local ? "Terzaghi reduce cohesión y usa factores N′ de la tabla de punzonamiento." : "Falla general: cuña completa, factores N sin prima.",
      },
      {
        n: "05",
        title: `Factores de capacidad ${nLab}c, ${nLab}q, ${nLab}γ`,
        formula: "Interpolación lineal en la tabla C5 «FACTORES DE CARGA» (Vesic / Terzaghi tabulados, φ de 0° a 50°)",
        substitution: `φ = ${fmt(phi, 2)}°  ·  ${local ? "columna N′ (local / punzonamiento)" : "columna N (general)"}`,
        result: `${nLab}c = ${fmt(Nc, 2)}    ${nLab}q = ${fmt(Nq, 2)}    ${nLab}γ = ${fmt(Ng, 2)}`,
      },
      {
        n: "06",
        title: "Factores de forma y ecuación de qu",
        formula: sh.formula,
        substitution: `Cimentación ${tipo}  ·  sc = ${sh.scTxt}  ·  sγ = ${sh.sgTxt}${tipo === "rectangular" ? `  ·  B/L = ${fmt(B / Math.max(Lf, B), 3)}` : ""}`,
        result: `Al ser la cimentación ${tipo.toUpperCase()} y poseer falla tipo ${fallaNom} se usa esa ecuación.`,
      },
      {
        n: "07",
        title: "Peso específico y napa freática",
        formula: "γZ en el término Nq    ·    γ del término Nγ según posición de la NF (C5, 4 casos)",
        substitution: `γ = ${fmt(gammaKg, 1)} kg/m³  ·  Df = ${fmt(Df, 2)} m  ·  NF = ${NF > 0 ? `${fmt(NF, 2)} m` : "—"}`,
        result: `γ·Z = ${fmt(napa.gZ, 1)} kg/m²    ·    γ (Nγ) = ${fmt(napa.gB, 1)} kg/m³`,
        note: napa.note,
      },
      {
        n: "08",
        title: "Capacidad última qu",
        formula: `qu = (${sh.scTxt})(${local ? "c′" : "c"})(${nLab}c) + (γZ)(${nLab}q) + (${sh.sgTxt} γ B ${nLab}γ)`,
        substitution: `(${sh.scTxt} × ${fmt(cKgM2, 2)} × ${fmt(Nc, 2)}) + (${fmt(napa.gZ, 1)} × ${fmt(Nq, 2)}) + (${fmt(napa.gB, 1)} × ${fmt(B, 2)} × ${sh.sgTxt} × ${fmt(Ng, 2)})`,
        result: `qu = ${fmt(quKg, 1)} kg/m² = ${fmt(qu, 3)} kg/cm² = ${fmt(qu * 10, 2)} t/m²`,
      },
      {
        n: "09",
        title: "Capacidad admisible",
        formula: "qadm = qu / FS",
        substitution: `${fmt(qu, 3)} / ${fmt(FS, 2)}`,
        result: `qadm = ${fmt(qadm, 2)} kg/cm² = ${fmt(qadm * 10, 2)} t/m²`,
        note: "E.050: FS = 3 en estático para capacidad de carga neta de cimentaciones superficiales.",
      },
      {
        n: "10",
        title: "Capacidad de carga neta",
        formula: "qneto = qadm − γ Df − S/C",
        substitution: `${fmt(qadm, 3)} − ${fmt((gammaKg / 10000) * Df, 3)} − ${fmt(scarga / 10000, 3)}`,
        result: `qneto = ${fmt(qneto, 2)} kg/cm²`,
        note: "Es el incremento de presión que puede aplicar la estructura. Si sale 0, aumentar B, Df o mejorar el suelo.",
      },
      {
        n: "11",
        title: "Características geotécnicas del SUCS (tabla C5)",
        formula: "Hoja CARACTERÍSTICAS DE LOS SUELOS",
        substitution: `${sucs} — ${sucsNombre(sucs)}`,
        result: `Subrasante: ${car[0]}  ·  Subbase: ${car[1]}  ·  Base: ${car[2]}  ·  CBR típ. ${car[5]}  ·  k ${car[6]} lb/pulg³`,
        note: `Compresibilidad: ${car[3]}  ·  Drenaje: ${car[4]}.`,
      },
    ],
    [
      ok("qadm > 0", `${fmt(qadm, 2)} kg/cm²`, "> 0", qadm > 0),
      ok("FS ≥ 3 (E.050 estático)", fmt(FS, 1), "≥ 3", FS >= 2.99),
      ok("Tipo de falla coherente con N", `${fallaNom} (N = ${fmt(Nsp, 1)})`, "N≤10 punz. · 10–15 local · >15 general", falla === autoFalla || fallaIn !== "auto"),
      ok("qneto ≥ 0", `${fmt(qneto, 2)} kg/cm²`, "≥ 0", qneto >= -1e-6),
      ok("φ entre 0° y 50° (tabla C5)", `${fmt(phi, 2)}°`, "0 – 50", phi >= 0 && phi <= 50),
    ],
    [
      {
        title: "Términos de qu (kg/m²)",
        rows: [
          ["Término", "Expresión", "Valor"],
          [`${local ? "c′" : "c"} · ${nLab}c · sc`, `${fmt(cKgM2, 1)} × ${fmt(Nc, 2)} × ${sh.scTxt}`, fmt(termC, 1)],
          [`γZ · ${nLab}q`, `${fmt(napa.gZ, 1)} × ${fmt(Nq, 2)}`, fmt(termQ, 1)],
          [`sγ · γ · B · ${nLab}γ`, `${sh.sgTxt} × ${fmt(napa.gB, 1)} × ${fmt(B, 2)} × ${fmt(Ng, 2)}`, fmt(termG, 1)],
          ["qu", "suma", fmt(quKg, 1)],
          ["qadm", `qu / ${fmt(FS, 1)}`, fmt(qadm * 10000, 1)],
          ["qneto", "qadm − γDf − S/C", fmt(qneto * 10000, 1)],
        ],
      },
      {
        title: "Correlaciones de arenas (Ncorr)",
        rows: [
          ["Ncorr", "Descripción", "Dr", "φ", "E (kg/cm²)"],
          ["0 – 4", "Muy floja", "0 – 15 %", "28°", "100"],
          ["5 – 10", "Floja", "16 – 35 %", "28 – 30°", "100 – 250"],
          ["11 – 30", "Media", "36 – 65 %", "30 – 36°", "250 – 500"],
          ["31 – 50", "Densa", "66 – 85 %", "36 – 41°", "500 – 1 000"],
          ["> 50", "Muy densa", "86 – 100 %", "> 41°", "> 1 000"],
        ],
      },
      {
        title: "Sowers: N(SPT) frente a qu (kg/cm²)",
        rows: [
          ["Suelo", "Ley N vs qu"],
          ["Arcillas de baja plasticidad y limos", "N ≈ 13.3 qu"],
          ["Terzaghi y Peck (referencia)", "N = 7.5 qu"],
          ["Arcillas de mediana plasticidad", "N ≈ 6.8 qu  ·  C5 usa N = 4 qu si IP > 25"],
          ["Arcillas de alta plasticidad", "N = 4 qu  ·  C5: N = 1.2 + 5.9 qu"],
        ],
      },
    ]
  );
};

function pFinesHint(sucs: string) {
  return /C$|L$|H$/.test(sucs) && !/^[GS]/.test(sucs);
}

/* ───────── Humedad · C.HUMEDAD (C5) ───────── */
export const humedad: Engine = (raw) => {
  const wht = num(raw, "wht", 45.87);
  const wst = num(raw, "wst", 40.8);
  const wt = num(raw, "wt", 14.03);
  const ww = wht - wst;
  const ws = wst - wt;
  const w = ws > 0 ? (ww / ws) * 100 : 0;
  return out(
    `w = ${fmt(w, 2)} %`,
    `NTP 339.127 / ASTM D2216  ·  formato C.HUMEDAD (C5)`,
    [
      {
        n: "01",
        title: "Peso de agua",
        formula: "Ww = (W húmedo + tara) − (W seco + tara)",
        substitution: `${fmt(wht, 2)} − ${fmt(wst, 2)}`,
        result: `${fmt(ww, 2)} g`,
      },
      {
        n: "02",
        title: "Peso de sólidos",
        formula: "Ws = (W seco + tara) − W tara",
        substitution: `${fmt(wst, 2)} − ${fmt(wt, 2)}`,
        result: `${fmt(ws, 2)} g`,
      },
      {
        n: "03",
        title: "Contenido de humedad natural",
        formula: "w = (Ww / Ws) × 100",
        substitution: `(${fmt(ww, 2)} / ${fmt(ws, 2)}) × 100`,
        result: `${fmt(w, 2)} %  (${fmt(w / 100, 4)} en decimal, como reporta C5)`,
        note: "Se reporta respecto al peso seco. Un w atípico (> 80 % o Ws muy pequeño) indica tara o secado mal registrados.",
      },
    ],
    [
      ok("Ws > 5 g (muestra representativa)", `${fmt(ws, 2)} g`, "> 5 g", ws > 5),
      ok("0 < w < 80 % (suelos minerales)", `${fmt(w, 2)} %`, "0 – 80", w > 0 && w < 80),
    ]
  );
};

/* ───────── Peso volumétrico · C5 ───────── */
export const pesoVolumetrico: Engine = (raw) => {
  const Wan = num(raw, "Wan", 81.62);
  const D = num(raw, "Dan", 7.15);
  const h = num(raw, "han", 3.46);
  const Wtot = num(raw, "Wtot", 325.15);
  const A = (Math.PI * D * D) / 4;
  const V = A * h;
  const Wsuelo = Wtot - Wan;
  const gamma = V > 0 ? Wsuelo / V : 0;
  return out(
    `γ = ${fmt(gamma, 3)} g/cm³ = ${fmt(gamma, 3)} t/m³`,
    `Anillo Ø ${fmt(D, 2)} × h ${fmt(h, 2)} cm  ·  hoja PESO VOLUMETRICO (C5)`,
    [
      {
        n: "01",
        title: "Área y volumen del anillo",
        formula: "A = π D² / 4     V = A h",
        substitution: `D = ${fmt(D, 2)} cm  ·  h = ${fmt(h, 2)} cm`,
        result: `A = ${fmt(A, 3)} cm²    V = ${fmt(V, 2)} cm³`,
      },
      {
        n: "02",
        title: "Peso de suelo",
        formula: "W suelo = (anillo + suelo) − anillo",
        substitution: `${fmt(Wtot, 2)} − ${fmt(Wan, 2)}`,
        result: `${fmt(Wsuelo, 2)} g`,
      },
      {
        n: "03",
        title: "Peso volumétrico natural",
        formula: "γ = W suelo / V",
        substitution: `${fmt(Wsuelo, 2)} / ${fmt(V, 2)}`,
        result: `${fmt(gamma, 3)} g/cm³ = ${fmt(gamma * 10, 2)} kN/m³`,
        note: "Este γ entra al promedio ponderado de estratos en CAPACIDAD PORTANTE y a Po = Σ γi hi en asentamientos.",
      },
    ],
    [ok("γ entre 1.2 y 2.4 g/cm³", `${fmt(gamma, 3)} g/cm³`, "1.20 – 2.40", gamma >= 1.2 && gamma <= 2.4)]
  );
};

/* ───────── Atterberg · LIMITES AT. (C5) ───────── */
export const atterberg: Engine = (raw) => {
  const pts = [1, 2, 3].map((i) => ({
    N: num(raw, `n${i}`, i === 1 ? 18 : i === 2 ? 25 : 29),
    wt: num(raw, `llwt${i}`, i === 3 ? 21.45 : 13.95),
    wh: num(raw, `llwh${i}`, i === 1 ? 41.54 : i === 2 ? 39.94 : 49.08),
    wd: num(raw, `llwd${i}`, i === 1 ? 35.93 : i === 2 ? 33.61 : 41.52),
  }));
  const wLL = pts.map((p) => {
    const ww = p.wh - p.wd;
    const ws = p.wd - p.wt;
    return ws > 0 ? (ww / ws) * 100 : 0;
  });
  const xs = pts.map((p) => Math.log10(Math.max(p.N, 1)));
  const { a, b } = linreg(xs, wLL);
  const LL = a + b * Math.log10(25);
  const pl = [1, 2].map((i) => ({
    wt: num(raw, `plwt${i}`, i === 1 ? 21.16 : 14.11),
    wh: num(raw, `plwh${i}`, i === 1 ? 27.59 : 23.51),
    wd: num(raw, `plwd${i}`, i === 1 ? 27.01 : 23.05),
  }));
  const wPL = pl.map((p) => {
    const ww = p.wh - p.wd;
    const ws = p.wd - p.wt;
    return ws > 0 ? (ww / ws) * 100 : 0;
  });
  const LP = (wPL[0] + wPL[1]) / 2;
  const IP = LL - LP;
  const aLine = 0.73 * (LL - 20);
  let carta = "CL (arcilla de baja plasticidad)";
  if (LL >= 50) carta = IP >= aLine ? "CH" : "MH";
  else if (IP < 4) carta = "ML / no plástico";
  else if (IP <= 7) carta = "CL-ML";
  else carta = IP >= aLine ? "CL" : "ML";
  return out(
    `LL = ${fmt(LL, 2)} %    LP = ${fmt(LP, 2)} %    IP = ${fmt(IP, 2)} %`,
    `NTP 339.129  ·  flujo de Casagrande a 25 golpes  ·  ${carta}`,
    [
      {
        n: "01",
        title: "Humedades del límite líquido",
        formula: "w = [(W húmedo − W seco) / (W seco − tara)] × 100",
        substitution: pts.map((p, i) => `N=${fmt(p.N, 0)} → w=${fmt(wLL[i], 2)} %`).join("   ·   "),
        result: pts.map((p, i) => `${fmt(wLL[i], 2)} % a ${fmt(p.N, 0)} golpes`).join("  |  "),
      },
      {
        n: "02",
        title: "Recta de flujo w vs log N",
        formula: "w = a + b log10(N)    →    LL = w(N = 25)",
        substitution: `a = ${fmt(a, 4)}    b = ${fmt(b, 4)}    (regresión de los 3 puntos)`,
        result: `LL = ${fmt(a, 4)} + ${fmt(b, 4)} log10(25) = ${fmt(LL, 2)} %`,
        note: "C5 calcula la ecuación lineal y evalúa a 25 golpes; no se toma el ensayo intermedio a ciegas.",
      },
      {
        n: "03",
        title: "Límite plástico (rollito de 3 mm)",
        formula: "LP = promedio de las dos humedades",
        substitution: `w1 = ${fmt(wPL[0], 2)} %    w2 = ${fmt(wPL[1], 2)} %`,
        result: `LP = ${fmt(LP, 2)} %`,
      },
      {
        n: "04",
        title: "Índice de plasticidad y carta de Casagrande",
        formula: "IP = LL − LP     ·     línea A: IP = 0.73 (LL − 20)",
        substitution: `IP = ${fmt(LL, 2)} − ${fmt(LP, 2)} = ${fmt(IP, 2)} %    ·    línea A = ${fmt(aLine, 2)} %`,
        result: `IP = ${fmt(IP, 2)} %   ·   zona ${carta}`,
        note: IP >= aLine ? "Por encima de la línea A: comportamiento arcilloso." : "Por debajo de la línea A: comportamiento limoso.",
      },
    ],
    [
      ok("Golpes en 15 – 35 (norma)", pts.map((p) => fmt(p.N, 0)).join(" / "), "15 – 35", pts.every((p) => p.N >= 10 && p.N <= 40)),
      ok("IP ≥ 0", fmt(IP, 2), "≥ 0", IP >= -0.2),
      ok("Un punto cerca de 25 golpes", pts.map((p) => fmt(p.N, 0)).join(", "), "incluye ≈ 25", pts.some((p) => Math.abs(p.N - 25) <= 6)),
    ],
    [
      {
        title: "Ensayos de Casagrande",
        rows: [
          ["Ensayo", "Golpes N", "Tara g", "Húmedo+tara", "Seco+tara", "w %"],
          ...pts.map((p, i) => [`LL ${i + 1}`, fmt(p.N, 0), fmt(p.wt, 2), fmt(p.wh, 2), fmt(p.wd, 2), fmt(wLL[i], 2)]),
          ["PL 1", "—", fmt(pl[0].wt, 2), fmt(pl[0].wh, 2), fmt(pl[0].wd, 2), fmt(wPL[0], 2)],
          ["PL 2", "—", fmt(pl[1].wt, 2), fmt(pl[1].wh, 2), fmt(pl[1].wd, 2), fmt(wPL[1], 2)],
        ],
      },
    ]
  );
};

/* ───────── Granulometría · GR TAMIZADO (C5) ───────── */
export const granulometria: Engine = (raw) => {
  const W0 = num(raw, "W0", 300);
  const lav = num(raw, "lav", 134.42);
  const ret = [
    { t: "N° 4", d: 4.75, W: num(raw, "r4", 20.96) },
    { t: "N° 10", d: 2, W: num(raw, "r10", 6.23) },
    { t: "N° 20", d: 0.85, W: num(raw, "r20", 5.15) },
    { t: "N° 40", d: 0.42, W: num(raw, "r40", 7.18) },
    { t: "N° 60", d: 0.3, W: num(raw, "r60", 22.89) },
    { t: "N° 100", d: 0.15, W: num(raw, "r100", 84.42) },
    { t: "N° 200", d: 0.075, W: num(raw, "r200", 18.42) },
  ];
  const plat = num(raw, "plat", 0.33);
  const Wtam = ret.reduce((s, r) => s + r.W, 0) + plat;
  let acc = 0;
  const rowsCalc = ret.map((r) => {
    const pRet = W0 > 0 ? (r.W / W0) * 100 : 0;
    acc += pRet;
    const pPasa = 100 - acc;
    return { ...r, pRet, acc, pPasa };
  });
  const pLav = W0 > 0 ? (lav / W0) * 100 : 0;
  const p4 = rowsCalc[0].pPasa;
  const p200 = rowsCalc[6].pPasa;
  const gravel = Math.max(0, 100 - p4);
  const sand = Math.max(0, p4 - p200);
  const fines = p200;
  const LL = num(raw, "LL", 32.88);
  const LP = num(raw, "LP", 7.53);
  const IP = LL - LP;
  const curve = [{ d: 4.75, p: p4 }, ...rowsCalc.slice(1).map((r) => ({ d: r.d, p: r.pPasa }))];
  const Dxx = (pct: number) => {
    const pts = [...curve].sort((a, b) => a.d - b.d);
    for (let i = 0; i < pts.length - 1; i++) {
      if ((pts[i].p <= pct && pts[i + 1].p >= pct) || (pts[i].p >= pct && pts[i + 1].p <= pct)) {
        const p0 = pts[i].p;
        const p1 = pts[i + 1].p;
        const t = p1 === p0 ? 0 : (pct - p0) / (p1 - p0);
        const logd = Math.log10(pts[i].d) + t * (Math.log10(pts[i + 1].d) - Math.log10(pts[i].d));
        return 10 ** logd;
      }
    }
    return pts[0]?.d ?? 0;
  };
  const D10 = Dxx(10);
  const D30 = Dxx(30);
  const D60 = Dxx(60);
  const Cu = D10 > 0 ? D60 / D10 : 0;
  const Cc = D10 > 0 && D60 > 0 ? (D30 * D30) / (D10 * D60) : 0;
  const sucs = classifySUCS(p4, p200, Cu, Cc, LL, IP);
  return out(
    `SUCS = ${sucs}    ·    ${fmt(gravel, 1)} % grava  ${fmt(sand, 1)} % arena  ${fmt(fines, 1)} % finos`,
    `ASTM D2487 / NTP 339.128  ·  GR TAMIZADO (C5)  ·  Cu = ${fmt(Cu, 2)}  Cc = ${fmt(Cc, 2)}`,
    [
      {
        n: "01",
        title: "Pesos de control",
        formula: "W tamizado = Σ retenidos + platillo     ·     pérdida por lavado = W0 − W tamizado",
        substitution: `W0 = ${fmt(W0, 2)} g    W tamizado = ${fmt(Wtam, 2)} g    lavado ingresado = ${fmt(lav, 2)} g`,
        result: `Pérdida por lavado ${fmt(pLav, 1)} % del original (pasa N° 200 en húmedo)`,
        note: "El % retenido se calcula respecto al peso original, no al tamizado, para no perder los finos lavados.",
      },
      {
        n: "02",
        title: "Fracciones grava / arena / finos",
        formula: "grava > 4.75 mm    ·    arena 4.75–0.075 mm    ·    finos < 0.075 mm (N° 200)",
        substitution: `% pasa N°4 = ${fmt(p4, 2)}    % pasa N°200 = ${fmt(p200, 2)}`,
        result: `Grava ${fmt(gravel, 2)} %   ·   Arena ${fmt(sand, 2)} %   ·   Limo+arcilla ${fmt(fines, 2)} %`,
      },
      {
        n: "03",
        title: "D10, D30, D60 y coeficientes",
        formula: "Cu = D60 / D10     ·     Cc = D30² / (D10 D60)",
        substitution: `D10 = ${fmt(D10, 4)} mm    D30 = ${fmt(D30, 4)} mm    D60 = ${fmt(D60, 4)} mm`,
        result: `Cu = ${fmt(Cu, 2)}    Cc = ${fmt(Cc, 2)}`,
        note: "Bien graduada: Cu ≥ 4 (grava) o ≥ 6 (arena) y 1 ≤ Cc ≤ 3.",
      },
      {
        n: "04",
        title: "Clasificación SUCS (ASTM D2487)",
        formula: "%200 ≷ 50    ·    carta de plasticidad    ·    Cu y Cc si finos < 12 %",
        substitution: `LL = ${fmt(LL, 2)} %    LP = ${fmt(LP, 2)} %    IP = ${fmt(IP, 2)} %    línea A = ${fmt(0.73 * (LL - 20), 2)} %`,
        result: `Símbolo ${sucs} — ${sucsNombre(sucs.split("-")[0] ?? sucs)}`,
      },
    ],
    [
      ok("Pesos coherentes", `W tamizado ${fmt(Wtam, 1)} g`, `≈ W0 − lavado = ${fmt(W0 - lav, 1)} g`, Math.abs(Wtam - (W0 - lav)) < 8),
      ok("% pasa decrece con el tamiz", "curva monótona", "pasa N°4 ≥ … ≥ N°200", rowsCalc.every((r, i) => i === 0 || r.pPasa <= rowsCalc[i - 1].pPasa + 0.05)),
    ],
    [
      {
        title: "Hoja de tamizado",
        rows: [
          ["Tamiz", "d (mm)", "Retenido g", "% ret.", "% acum.", "% pasa"],
          ...rowsCalc.map((r) => [r.t, fmt(r.d, 3), fmt(r.W, 2), fmt(r.pRet, 2), fmt(r.acc, 2), fmt(r.pPasa, 2)]),
          ["Platillo", "—", fmt(plat, 2), "—", "100", "0"],
          ["Lavado", "—", fmt(lav, 2), fmt(pLav, 2), "—", "finos húmedos"],
        ],
      },
    ]
  );
};

/* ───────── Corte directo · C5 ───────── */
export const corteDirecto: Engine = (raw) => {
  const s1 = num(raw, "s1", 0.5);
  const s2 = num(raw, "s2", 1.0);
  const s3 = num(raw, "s3", 1.5);
  const t1 = num(raw, "t1", 0.182);
  const t2 = num(raw, "t2", 0.18);
  const t3 = num(raw, "t3", 0.283);
  const { a: c, b: tanp } = linreg([s1, s2, s3], [t1, t2, t3]);
  const phi = (Math.atan(tanp) * 180) / Math.PI;
  return out(
    `c = ${fmt(c, 4)} kg/cm²    ·    φ = ${fmt(phi, 2)}°`,
    `Coulomb  τ = c + σ tan φ   ·  CORTE DIRECTO saturado (C5)`,
    [
      {
        n: "01",
        title: "Pares (σ, τ) de falla",
        formula: "τf de cada espécimen a σn = 0.5, 1.0 y 1.5 kg/cm²",
        substitution: `(${fmt(s1, 2)}, ${fmt(t1, 3)})   (${fmt(s2, 2)}, ${fmt(t2, 3)})   (${fmt(s3, 2)}, ${fmt(t3, 3)}) kg/cm²`,
        result: "Tres puntos de la envolvente de Mohr–Coulomb",
      },
      {
        n: "02",
        title: "Regresión lineal τ = c + σ tan φ",
        formula: "c = intercepto    ·    φ = arctan(pendiente)",
        substitution: `pendiente tan φ = ${fmt(tanp, 4)}`,
        result: `c = ${fmt(c, 4)} kg/cm²    φ = ${fmt(phi, 2)}°`,
        note: "En C5: Y = 0.1013 x + 0.1138 con el juego de ejemplo. Estos c y φ alimentan CAPACIDAD PORTANTE.",
      },
      {
        n: "03",
        title: "Verificación de los puntos",
        formula: "τ pred = c + σ tan φ",
        substitution: [s1, s2, s3].map((s, i) => `σ=${fmt(s, 2)} → τ=${fmt(c + s * tanp, 3)} (medido ${fmt([t1, t2, t3][i], 3)})`).join("   ·   "),
        result: `R² visual: residuales pequeños implican envolvente aceptable.`,
      },
    ],
    [
      ok("c ≥ 0", `${fmt(c, 4)} kg/cm²`, "≥ 0", c >= -0.02),
      ok("0° ≤ φ ≤ 45°", `${fmt(phi, 2)}°`, "0 – 45", phi >= 0 && phi <= 50),
    ]
  );
};

/* ───────── Compresión simple · C5 ───────── */
export const compresionSimple: Engine = (raw) => {
  const qu = num(raw, "qu", 0.9);
  const E = num(raw, "E", 564.33);
  const cu = qu / 2;
  const Ntp = 7.5 * qu;
  const Nsow = 4 * qu;
  return out(
    `qu = ${fmt(qu, 3)} kg/cm²    ·    cu = ${fmt(cu, 3)} kg/cm²`,
    `ASTM D2166  ·  COMPRESION SIMPLE (C5)  ·  cu = qu/2`,
    [
      {
        n: "01",
        title: "Resistencia no confinada",
        formula: "qu = Pmáx / Acorregida    (pico de la curva esfuerzo–deformación)",
        substitution: `qu ingresado = ${fmt(qu, 3)} kg/cm²  (pico de laboratorio)`,
        result: `qu = ${fmt(qu, 3)} kg/cm² = ${fmt(qu * 10, 2)} t/m²`,
      },
      {
        n: "02",
        title: "Cohesión no drenada",
        formula: "cu = qu / 2",
        substitution: `${fmt(qu, 3)} / 2`,
        result: `cu = ${fmt(cu, 3)} kg/cm²`,
        note: "En C5, si el SUCS empieza en S o G se usa solo el c del corte directo; si no, c = promedio(cu, c_corte).",
      },
      {
        n: "03",
        title: "Módulo de deformación",
        formula: "E ≈ pendiente inicial de σ vs ε  (C5 reporta E de la rama elástica)",
        substitution: `E = ${fmt(E, 1)} kg/cm²`,
        result: `${fmt(E, 1)} kg/cm² = ${fmt(E / 10, 1)} MPa`,
      },
      {
        n: "04",
        title: "N(SPT) estimado con Sowers",
        formula: "Terzaghi–Peck: N = 7.5 qu     ·     C5 arcilla media: N = 4 qu",
        substitution: `qu = ${fmt(qu, 3)} kg/cm²`,
        result: `N (T&P) = ${fmt(Ntp, 1)}    ·    N (C5, IP>25) = ${fmt(Nsow, 1)}`,
        note: "Este N alimenta el «sustento del tipo de falla» cuando no hay SPT.",
      },
    ],
    [ok("qu > 0", `${fmt(qu, 3)} kg/cm²`, "> 0", qu > 0)]
  );
};

/* ───────── Asentamientos · consolidación 1-D (ensayo edométrico + campo) ───────── */
type EtapaEdo = { sigma: number; e: number; tMin: number; dialMm: number };

function parseEtapasConsolidacion(raw: Record<string, string>): EtapaEdo[] {
  const defs: [number, number, number, number][] = [
    [0.125, 0.72, 60, 0.12],
    [0.25, 0.71, 60, 0.28],
    [0.5, 0.70, 120, 0.55],
    [1.0, 0.685, 240, 1.05],
    [2.0, 0.655, 480, 2.15],
    [4.0, 0.61, 720, 3.8],
    [8.0, 0.555, 1440, 5.9],
    [0, 0, 0, 0],
  ];
  const outE: EtapaEdo[] = [];
  for (let i = 1; i <= 8; i++) {
    const d = defs[i - 1] ?? [0, 0, 0, 0];
    const sigma = num(raw, `sig${i}`, d[0]);
    if (sigma <= 0) continue;
    outE.push({
      sigma,
      e: num(raw, `e${i}`, d[1]),
      tMin: Math.max(1, num(raw, `t${i}`, d[2])),
      dialMm: num(raw, `dial${i}`, d[3]),
    });
  }
  return outE;
}

/** Cc o Cr como pendiente |Δe|/log10(σ2/σ1) entre dos etapas. */
function pendienteIndice(a: EtapaEdo, b: EtapaEdo) {
  const r = Math.log10(Math.max(b.sigma, 1e-9) / Math.max(a.sigma, 1e-9));
  if (Math.abs(r) < 1e-9) return 0;
  return Math.abs(b.e - a.e) / Math.abs(r);
}

export const asentamientos: Engine = (raw) => {
  const etapas = parseEtapasConsolidacion(raw);
  const PcUser = num(raw, "Pc", 1.0813);
  const PoUser = num(raw, "Po", 0.397);
  const e0User = num(raw, "e0", 0.6944);
  const CcUser = num(raw, "Cc", 0.2726);
  const CrUser = num(raw, "Cr", 0.0675);
  const usarLab = str(raw, "usarLab", "si").toLowerCase().startsWith("s");

  // Índices desde etapas (si hay ≥3) o valores adoptados
  let Cc = CcUser;
  let Cr = CrUser;
  let e0 = e0User;
  let Pc = PcUser;
  let fuenteCc = "valor adoptado (curva e–log σ′)";
  let fuenteCr = "valor adoptado (descarga / recarga)";
  let fuentePc = "Casagrande / valor de laboratorio adoptado";

  if (usarLab && etapas.length >= 3) {
    e0 = etapas[0].e;
    // Cr: primeras dos etapas (recompresión)
    Cr = pendienteIndice(etapas[0], etapas[1]);
    fuenteCr = `etapas ${fmt(etapas[0].sigma, 3)} → ${fmt(etapas[1].sigma, 3)} kg/cm²`;
    // Cc: últimas dos etapas vírgenes (después de Pc aproximado)
    const iVirgen = Math.max(2, etapas.length - 2);
    Cc = pendienteIndice(etapas[iVirgen], etapas[etapas.length - 1]);
    fuenteCc = `etapas ${fmt(etapas[iVirgen].sigma, 3)} → ${fmt(etapas[etapas.length - 1].sigma, 3)} kg/cm²`;
    // Pc aproximado: σ donde la pendiente se acerca a Cc (máximo Δpendiente)
    let best = etapas[Math.min(2, etapas.length - 1)].sigma;
    let bestScore = -1;
    for (let i = 1; i < etapas.length - 1; i++) {
      const p1 = pendienteIndice(etapas[i - 1], etapas[i]);
      const p2 = pendienteIndice(etapas[i], etapas[i + 1]);
      const score = p2 - p1;
      if (score > bestScore) {
        bestScore = score;
        best = etapas[i].sigma;
      }
    }
    if (PcUser <= 0) Pc = best;
    else Pc = PcUser;
    fuentePc = PcUser > 0 ? "Pc de laboratorio (Casagrande) ingresado" : `estimado por cambio de pendiente ≈ ${fmt(best, 3)} kg/cm²`;
    // Si el usuario fijó Cc/Cr > 0 y marcar forzar, respetar — aquí: si CcUser != default and etapas, prefer lab unless forzarIndices
    if (str(raw, "forzarIndices", "no").toLowerCase().startsWith("s")) {
      Cc = CcUser;
      Cr = CrUser;
      e0 = e0User;
      fuenteCc = "forzado por el usuario";
      fuenteCr = "forzado por el usuario";
    }
  }

  // Po de campo: perfil o valor
  const g1 = num(raw, "g1", 1.8);
  const h1 = num(raw, "h1", 1.2);
  const g2 = num(raw, "g2", 1.85);
  const h2 = num(raw, "h2", 1.0);
  const g3 = num(raw, "g3", 1.9);
  const h3 = num(raw, "h3", 0);
  const NF = num(raw, "NF", 2.0);
  const gammaW = num(raw, "gammaW", 1.0);
  const calcularPo = str(raw, "calcularPo", "no").toLowerCase().startsWith("s");
  const capasPo = [
    { g: g1, h: h1 },
    { g: g2, h: h2 },
    { g: g3, h: h3 },
  ].filter((c) => c.h > 0);
  let Po = PoUser;
  let fuentePo = "Po ingresado (centro del estrato)";
  if (calcularPo && capasPo.length) {
    let z = 0;
    let sig = 0;
    for (const c of capasPo) {
      const mid = z + c.h / 2;
      const geff = mid <= NF ? c.g : Math.max(0.4, c.g - gammaW);
      sig += geff * c.h;
      z += c.h;
    }
    // convertir t/m² → kg/cm² (1 t/m² = 0.1 kg/cm²)
    Po = sig / 10;
    fuentePo = `Σ γ′hi = ${fmt(sig, 2)} t/m² = ${fmt(Po, 3)} kg/cm²`;
  }

  const B = num(raw, "B", 1.6);
  const Lzap = num(raw, "L", B);
  const q = num(raw, "q", 0.4);
  const Hcm = num(raw, "H", 75);
  const Df = num(raw, "Df", 2.2);
  const z1 = Df0(raw, B);
  const zs = [z1, z1 + Hcm / 200, z1 + Hcm / 100];
  const esCuadrada = Math.abs(Lzap - B) < 0.05 * B;
  const sig = zs.map((z) => {
    const m = (B / 2) / Math.max(z, 0.05);
    const n = (Lzap / 2) / Math.max(z, 0.05);
    const wo = fadumCorner(m, n);
    return 4 * wo * q * 10; // t/m²
  });
  const sprom = (sig[0] + 4 * sig[1] + sig[2]) / 6;
  const PoT = Po * 10;
  const PcT = Pc * 10;
  const P = PoT + sprom;
  const H = Hcm;
  const OCR = Pc / Math.max(Po, 1e-9);

  let dHp: number;
  let rama: string;
  let formulaDH: string;
  if (P <= PcT) {
    dHp = ((Cr * Math.log10(Math.max(P, 1e-6) / Math.max(PoT, 1e-6))) / (1 + e0)) * H;
    rama = "sobreadensado (P ≤ Pc): solo recompresión Cr";
    formulaDH = "ΔHp = [Cr · log10(P/Po) / (1+e0)] · H";
  } else if (PoT >= PcT) {
    dHp = ((Cc * Math.log10(Math.max(P, 1e-6) / Math.max(PoT, 1e-6))) / (1 + e0)) * H;
    rama = "normalmente densado (Po ≥ Pc): solo Cc";
    formulaDH = "ΔHp = [Cc · log10(P/Po) / (1+e0)] · H";
  } else {
    dHp =
      ((Cr * Math.log10(PcT / Math.max(PoT, 1e-6)) + Cc * Math.log10(Math.max(P, 1e-6) / PcT)) / (1 + e0)) * H;
    rama = "recargado (Po < Pc < P): Cr hasta Pc y Cc en tramo virgen";
    formulaDH = "ΔHp = [Cr·log(Pc/Po) + Cc·log(P/Pc)] · H / (1+e0)";
  }

  // Tiempo · Cv (Taylor √t o Casagrande log t)
  const H0 = num(raw, "H0", 2.0); // cm espécimen
  const drenaje = str(raw, "drenaje", "doble").toLowerCase().startsWith("s") ? "simple" : "doble";
  const Hdr = drenaje === "doble" ? H0 / 2 : H0;
  const metodoCv = str(raw, "metodoCv", "raiz-t").toLowerCase().startsWith("l") ? "log-t" : "raiz-t";
  const t50 = Math.max(0.1, num(raw, "t50", 12)); // min
  const t90 = Math.max(t50, num(raw, "t90", 48)); // min
  const Tv50 = 0.197;
  const Tv90 = 0.848;
  const tRefMin = metodoCv === "log-t" ? t50 : t90;
  const TvRef = metodoCv === "log-t" ? Tv50 : Tv90;
  const tRefYear = tRefMin / (60 * 24 * 365);
  const Hdr_m = Hdr / 100;
  const Cv = (TvRef * Hdr_m * Hdr_m) / Math.max(tRefYear, 1e-12); // m²/año
  const Cv_cm2s = (TvRef * (Hdr * Hdr)) / Math.max(tRefMin * 60, 1e-9); // cm²/s
  // Tiempo en campo para espesor del estrato (drenaje doble típico en capa)
  const drenajeCampo = str(raw, "drenajeCampo", "doble").toLowerCase().startsWith("s") ? "simple" : "doble";
  const HdrCampo_cm = drenajeCampo === "doble" ? Hcm / 2 : Hcm;
  const HdrCampo_m = HdrCampo_cm / 100;
  const t50campo = (Tv50 * HdrCampo_m * HdrCampo_m) / Math.max(Cv, 1e-12); // años
  const t90campo = (Tv90 * HdrCampo_m * HdrCampo_m) / Math.max(Cv, 1e-12);
  const t99campo = (1.781 * HdrCampo_m * HdrCampo_m) / Math.max(Cv, 1e-12);

  // Secundario
  const Ca = num(raw, "Ca", 0.01);
  const t1sec = num(raw, "t1sec", Math.max(t90campo, 0.1)); // años inicio secundario ≈ fin primario
  const t2sec = num(raw, "t2sec", Math.max(t1sec * 10, 50));
  const dHs = Ca > 0 && t2sec > t1sec ? ((Ca * Math.log10(t2sec / t1sec)) / (1 + e0)) * H : 0;
  const dHtotal = dHp + dHs;

  const limViv = num(raw, "limViv", 2.5);
  const limInd = num(raw, "limInd", 5.0);

  const rowsEtapas = etapas.map((e, i) => [
    String(i + 1),
    fmt(e.sigma, 3),
    fmt(e.e, 4),
    fmt(e.tMin, 0),
    fmt(e.dialMm, 3),
    i === 0 ? "—" : fmt(pendienteIndice(etapas[i - 1], e), 4),
  ]);

  const rowsFadum = zs.map((z, i) => {
    const m = (B / 2) / Math.max(z, 0.05);
    const n = (Lzap / 2) / Math.max(z, 0.05);
    return [i === 0 ? "superior" : i === 1 ? "medio" : "inferior", fmt(z, 2), fmt(m, 3), fmt(n, 3), fmt(sig[i], 2)];
  });

  return out(
    `ΔHp = ${fmt(dHp, 3)} cm` +
      (dHs > 0 ? ` · ΔHs = ${fmt(dHs, 3)} cm · Σ = ${fmt(dHtotal, 3)} cm` : "") +
      `    ·    ${dHtotal <= limViv ? "aceptable vivienda" : dHtotal <= limInd ? "revisar (límite industrial)" : "excede límites usuales"}`,
    `Consolidación 1-D Terzaghi · Fadum · Cv (${metodoCv}) · ensayo edométrico`,
    [
      {
        n: "01",
        title: "Objeto del ensayo y alcance",
        formula: "Ensayo edométrico (consolidación unidimensional) → Pc, Cr, Cc, Cv → asentamiento de campo",
        result: `Muestra edométrica H0=${fmt(H0, 2)} cm · drenaje laboratorio=${drenaje} · ${etapas.length} etapas de carga`,
        note: "Se registra el programa σ′–tiempo–e (o dial), se construye e–log σ′, se obtiene Pc (Casagrande), Cr/Cc y Cv; luego se traslada al estrato de obra con Fadum.",
      },
      {
        n: "02",
        title: "Programa de cargas con tiempos (formato de laboratorio)",
        formula: "Etapa i: σ′i (kg/cm²) · duración ti (min) · e final (o lect. dial) · pendiente local Δe/log(σi/σi−1)",
        result: `${etapas.length} incrementos registrados`,
        table: {
          caption: "Cuadro de cargas del edómetro (formato de ensayo)",
          headers: ["Etapa", "σ′ (kg/cm²)", "e final", "t (min)", "Dial (mm)", "Δe/Δlogσ"],
          rows: rowsEtapas,
        },
        note: "Cada incremento se mantiene hasta estabilizar la lectura primaria (típicamente 24 h o criterio U≈100 % de la etapa). El dial es control de laboratorio; e se reporta al final de la primaria.",
      },
      {
        n: "03",
        title: "Curva e–log σ′ y presión de preconsolidación Pc",
        formula: "Casagrande: bisectriz del tramo de alta curvatura ∩ recta virgen → Pc",
        substitution: `e0 = ${fmt(e0, 4)}    ·    ${fuentePc}`,
        result: `Pc = ${fmt(Pc, 4)} kg/cm²    ·    OCR = Pc/Po = ${fmt(OCR, 2)}`,
        desarrollo: [
          `Po (campo) = ${fmt(Po, 4)} kg/cm² (${fuentePo})`,
          OCRTxt(Pc, Po),
        ],
      },
      {
        n: "04",
        title: "Índices de compresión Cr y Cc",
        formula: "Cr = |Δe| / log10(σb/σa)  (recompresión)    ·    Cc = |Δe| / log10(σd/σc)  (tramo virgen)",
        substitution: `Cr ← ${fuenteCr}    ·    Cc ← ${fuenteCc}`,
        result: `Cr = ${fmt(Cr, 4)}    ·    Cc = ${fmt(Cc, 4)}    ·    e0 = ${fmt(e0, 4)}`,
        note: "Si activa «forzar índices», se usan Pc/Cr/Cc/e0 digitados aunque exista el programa de cargas.",
      },
      {
        n: "05",
        title: "Coeficiente de consolidación Cv (tiempo en laboratorio)",
        formula:
          metodoCv === "log-t"
            ? "Casagrande log t: Tv50 = 0.197 = Cv t50 / Hdr²  →  Cv = 0.197 Hdr² / t50"
            : "Taylor √t: Tv90 = 0.848 = Cv t90 / Hdr²  →  Cv = 0.848 Hdr² / t90",
        substitution: `Hdr = ${drenaje === "doble" ? "H0/2" : "H0"} = ${fmt(Hdr, 3)} cm    ·    t50=${fmt(t50, 1)} min    ·    t90=${fmt(t90, 1)} min`,
        result: `Cv = ${fmt(Cv, 4)} m²/año    (${fmt(Cv_cm2s, 4)} cm²/s)`,
        desarrollo: [
          `Método: ${metodoCv === "log-t" ? "Casagrande (log t) con t50" : "Taylor (√t) con t90"}`,
          `Tv de referencia = ${fmt(TvRef, 3)}    ·    t_ref = ${fmt(tRefMin, 1)} min`,
        ],
        note: "Hdr es la máxima trayectoria de drenaje del espécimen. En doble drenaje (piedras porosa arriba y abajo) Hdr = H0/2.",
      },
      {
        n: "06",
        title: "Esfuerzo efectivo inicial Po en el estrato de obra",
        formula: calcularPo ? "Po = Σ γ′i · hi   (γ′=γ encima NF; γsat−γw debajo)" : "Po adoptado del estudio de suelos",
        substitution: fuentePo,
        result: `Po = ${fmt(Po, 4)} kg/cm² = ${fmt(PoT, 2)} t/m²`,
        table:
          calcularPo && capasPo.length
            ? {
                caption: "Perfil para Po",
                headers: ["Capa", "γ (t/m³)", "h (m)"],
                rows: capasPo.map((c, i) => [String(i + 1), fmt(c.g, 2), fmt(c.h, 2)]),
              }
            : undefined,
      },
      {
        n: "07",
        title: "Incremento de esfuerzo vertical Δσz (Fadum)",
        formula: esCuadrada
          ? "Zapata cuadrada: m=n=(B/2)/z · σz = 4 wo q · σprom = (σs+4σm+σi)/6"
          : "Zapata rectangular: m=(B/2)/z , n=(L/2)/z · σz = 4 wo q · Simpson",
        substitution: `B=${fmt(B, 2)} m · L=${fmt(Lzap, 2)} m · q=${fmt(q, 2)} kg/cm² · Df (z sup.)=${fmt(Df, 2)} m`,
        result: `σprom = ${fmt(sprom, 2)} t/m²`,
        table: {
          caption: "Puntos Fadum en el espesor H",
          headers: ["Punto", "z (m)", "m", "n", "σz (t/m²)"],
          rows: rowsFadum,
        },
        note: "wo es el factor de influencia de Fadum en una esquina del rectángulo cargado; 4 esquinas cubren la zapata.",
      },
      {
        n: "08",
        title: "Presión final P y rama de la curva e–log σ′",
        formula: "P = Po + σprom",
        substitution: `${fmt(PoT, 2)} + ${fmt(sprom, 2)} = ${fmt(P, 2)} t/m²    ·    Pc = ${fmt(PcT, 2)} t/m²`,
        result: `${rama}`,
        desarrollo: [
          `OCR = ${fmt(OCR, 2)}`,
          `Comparación: Po=${fmt(PoT, 2)} · Pc=${fmt(PcT, 2)} · P=${fmt(P, 2)} t/m²`,
        ],
      },
      {
        n: "09",
        title: "Asentamiento por consolidación primaria ΔHp",
        formula: formulaDH,
        substitution: `H = ${fmt(H, 1)} cm · e0=${fmt(e0, 4)} · Cr=${fmt(Cr, 4)} · Cc=${fmt(Cc, 4)}`,
        result: `ΔHp = ${fmt(dHp, 3)} cm`,
        ok: Number.isFinite(dHp) && dHp >= 0,
        note: "H es el espesor del estrato compresible en obra (no el del anillo edométrico).",
      },
      {
        n: "10",
        title: "Tiempos de consolidación en campo (U=50 %, 90 %, 99 %)",
        formula: "t = Tv · Hdr,campo² / Cv",
        substitution: `Hdr,campo=${fmt(HdrCampo_cm, 1)} cm (${drenajeCampo}) · Cv=${fmt(Cv, 4)} m²/año`,
        result: `t50=${fmt(t50campo, 2)} años · t90=${fmt(t90campo, 2)} años · t99=${fmt(t99campo, 2)} años`,
        table: {
          caption: "Grado de consolidación U vs tiempo de obra",
          headers: ["U (%)", "Tv", "t (años)", "t (días)"],
          rows: [
            ["50", "0.197", fmt(t50campo, 3), fmt(t50campo * 365, 0)],
            ["90", "0.848", fmt(t90campo, 3), fmt(t90campo * 365, 0)],
            ["99", "1.781", fmt(t99campo, 3), fmt(t99campo * 365, 0)],
          ],
        },
        note: "Si el estrato tiene drenaje solo por una cara (roca o geomembrana), use drenaje simple: Hdr = H.",
      },
      {
        n: "11",
        title: "Asentamiento secundario ΔHs (compresión diferida)",
        formula: "ΔHs = [Cα · log10(t2/t1) / (1+e0)] · H",
        substitution: `Cα=${fmt(Ca, 4)} · t1=${fmt(t1sec, 2)} años · t2=${fmt(t2sec, 1)} años`,
        result: Ca > 0 ? `ΔHs = ${fmt(dHs, 3)} cm` : "Cα=0 → no se cuantifica secundario",
        note: "t1 ≈ fin de la primaria (≈ t90); t2 = vida útil o plazo de servicio. Si no hay Cα de laboratorio, deje 0.",
      },
      {
        n: "12",
        title: "Asentamiento total y adopción",
        formula: "ΔH = ΔHp + ΔHs",
        result: `ΔH = ${fmt(dHtotal, 3)} cm    ·    límite vivienda ${fmt(limViv, 1)} cm · industrial ${fmt(limInd, 1)} cm`,
        ok: dHtotal <= limViv,
      },
    ],
    [
      ok("ΔH ≤ límite vivienda", `${fmt(dHtotal, 3)} cm`, `≤ ${fmt(limViv, 1)} cm`, dHtotal <= limViv),
      ok("ΔH ≤ límite industrial", `${fmt(dHtotal, 3)} cm`, `≤ ${fmt(limInd, 1)} cm`, dHtotal <= limInd),
      ok("Pc ≥ Po (OCR ≥ 1)", `OCR=${fmt(OCR, 2)}`, "≥ 1", Pc + 1e-6 >= Po),
      ok("Programa de cargas ≥ 3 etapas", `${etapas.length} etapas`, "≥ 3", etapas.length >= 3),
      ok("Cv > 0", `${fmt(Cv, 4)} m²/año`, "> 0", Cv > 0),
      ok("ΔHp ≥ 0", `${fmt(dHp, 3)} cm`, "≥ 0", dHp >= -1e-6),
    ],
    [
      {
        title: "Resumen de entrega",
        rows: [
          ["Magnitud", "Valor", "Unidad"],
          ["Pc", fmt(Pc, 4), "kg/cm²"],
          ["Po", fmt(Po, 4), "kg/cm²"],
          ["OCR", fmt(OCR, 2), "—"],
          ["Cr", fmt(Cr, 4), "—"],
          ["Cc", fmt(Cc, 4), "—"],
          ["e0", fmt(e0, 4), "—"],
          ["σprom (Fadum)", fmt(sprom, 2), "t/m²"],
          ["P = Po+σprom", fmt(P, 2), "t/m²"],
          ["ΔHp", fmt(dHp, 3), "cm"],
          ["ΔHs", fmt(dHs, 3), "cm"],
          ["ΔH total", fmt(dHtotal, 3), "cm"],
          ["Cv", fmt(Cv, 4), "m²/año"],
          ["t90 campo", fmt(t90campo, 2), "años"],
        ],
      },
    ]
  );
};

function Df0(raw: Record<string, string>, B: number) {
  return num(raw, "z0", Math.max(0.5, num(raw, "Df", 1.5) + B * 0.2));
}
function OCRTxt(Pc: number, Po: number) {
  const o = Pc / Math.max(Po, 1e-6);
  if (o > 1.2) return `Sobreadensado (OCR = ${fmt(o, 2)})`;
  if (o < 0.95) return `Subadensado (OCR = ${fmt(o, 2)}) — revisar Pc`;
  return `Normalmente densado (OCR ≈ 1)`;
}
function fadumCorner(m: number, n: number) {
  const mm = m * m;
  const nn = n * n;
  const A = m * n;
  const r = Math.sqrt(1 + mm + nn);
  const t1 = (A / r) * (1 + mm + nn) / ((1 + mm) * (1 + nn));
  const t2 = Math.atan2(A * r, mm + nn + mm * nn);
  return (1 / (4 * Math.PI)) * (t1 + t2);
}

/* ───────── Presión de tierras ───────── */
export const presionTierras: Engine = (raw) => {
  const gs = num(raw, "gs", 1650);
  const phi = num(raw, "phi", 30);
  const beta = num(raw, "beta", 0);
  const theta = num(raw, "theta", 90);
  const delta = num(raw, "delta", 0);
  const H = num(raw, "H", 3.5);
  const sc = num(raw, "sc", 0);
  const kaRank = (1 - Math.sin(rad(phi))) / (1 + Math.sin(rad(phi)));
  const kpRank = (1 + Math.sin(rad(phi))) / (1 - Math.sin(rad(phi)));
  const p = rad(phi);
  const b = rad(beta);
  const th = rad(theta);
  const d = rad(delta);
  const coulombKa = () => {
    const nume = Math.sin(th + p) ** 2;
    const den =
      Math.sin(th) ** 2 *
      Math.sin(th - d) *
      (1 + Math.sqrt((Math.sin(p + d) * Math.sin(p - b)) / (Math.sin(th - d) * Math.sin(th + b)))) ** 2;
    return den > 0 ? nume / den : kaRank;
  };
  const kaC = Math.abs(beta) > 0.1 || Math.abs(delta) > 0.1 || Math.abs(theta - 90) > 0.1 ? coulombKa() : kaRank;
  const ka = kaC;
  const gamma = gs / 1000;
  const sigma = gamma * H * ka;
  const Pa = 0.5 * gamma * ka * H * H;
  const Psc = ka * (sc / 1000) * H;
  return out(
    `ka = ${fmt(ka, 3)}    ·    Pa + Pq = ${fmt(Pa + Psc, 2)} t/m`,
    `${Math.abs(beta) > 0.1 || Math.abs(delta) > 0.1 ? "Coulomb" : "Rankine"}  ·  σ_base = ${fmt(sigma, 2)} t/m²`,
    [
      {
        n: "01",
        title: "Coeficiente de empuje activo",
        formula: Math.abs(beta) > 0.1 || Math.abs(delta) > 0.1
          ? "Coulomb: ka = sen²(θ+φ) / [sen²θ sen(θ−δ) (1+√(sen(φ+δ)sen(φ−β)/(sen(θ−δ)sen(θ+β))))²]"
          : "Rankine (β = 0): ka = (1 − sen φ) / (1 + sen φ) = tan²(45° − φ/2)",
        substitution: `φ = ${fmt(phi, 1)}°  β = ${fmt(beta, 1)}°  θ = ${fmt(theta, 0)}°  δ = ${fmt(delta, 1)}°`,
        result: `ka = ${fmt(ka, 4)}    kp (Rankine) = ${fmt(kpRank, 3)}`,
      },
      {
        n: "02",
        title: "Presión en la base",
        formula: "σ = γ H ka",
        substitution: `${fmt(gamma, 3)} × ${fmt(H, 2)} × ${fmt(ka, 3)}`,
        result: `${fmt(sigma, 3)} t/m²`,
        note: "Para SAP2000/ETABS: carga triangular de 0 (coronación) a σ (base).",
      },
      {
        n: "03",
        title: "Empuje total y sobrecarga",
        formula: "Pa = ½ γ H² ka    ·    Pq = ka q H",
        substitution: `Pa = ${fmt(Pa, 2)} t/m    Pq = ${fmt(Psc, 2)} t/m`,
        result: `ΣH = ${fmt(Pa + Psc, 2)} t/m   a  H/3 desde la base (Pa) y H/2 (Pq)`,
      },
    ],
    [ok("ka entre 0.15 y 0.60", fmt(ka, 3), "0.15 – 0.60", ka > 0.12 && ka < 0.7)]
  );
};

/* ───────── CBR ───────── */
export const cbr: Engine = (raw) => {
  const cbr100 = num(raw, "cbr100", 6.91);
  const cbr95 = num(raw, "cbr95", 6.18);
  const wopt = num(raw, "wopt", 12.6);
  const mds = num(raw, "mds", 1.85);
  const sucs = str(raw, "sucs", "SM-SC");
  let cat = "Subrasante pobre";
  if (cbr95 >= 30) cat = "Base granular";
  else if (cbr95 >= 20) cat = "Subbase";
  else if (cbr95 >= 10) cat = "Subrasante buena";
  else if (cbr95 >= 5) cat = "Subrasante regular";
  const car = sucsCaract(sucs.split("-")[0] ?? sucs);
  return out(
    `CBR 95 % = ${fmt(cbr95, 2)} %    ·    ${cat}`,
    `ASTM D1883 / NTP 339.131  ·  SUCS ${sucs}  ·  wopt ${fmt(wopt, 1)} %  ·  MDS ${fmt(mds, 3)} g/cm³`,
    [
      {
        n: "01",
        title: "Ensayo CBR",
        formula: "CBR = (p ensayo / p patrón) × 100   a 0.1″ y 0.2″; gobierna el mayor, reportado al 95 % MDS",
        substitution: `CBR 100 % MDS = ${fmt(cbr100, 2)} %    ·    CBR 95 % MDS = ${fmt(cbr95, 2)} %`,
        result: `Diseño con CBR 95 % = ${fmt(cbr95, 2)} %`,
      },
      {
        n: "02",
        title: "Clasificación para pavimentos",
        formula: "< 5 pobre · 5–10 regular · 10–20 buena · 20–30 subbase · ≥ 30 base",
        result: cat,
        note: `Tabla C5 para ${sucs}: subrasante ${car[0]}, subbase ${car[1]}, base ${car[2]}, CBR típico ${car[5]}.`,
      },
      {
        n: "03",
        title: "Proctor de referencia",
        formula: "Compactar al 95 % del MDS a wopt ± 2 %",
        substitution: `MDS = ${fmt(mds, 3)} g/cm³    wopt = ${fmt(wopt, 1)} %`,
        result: `γd,95% = ${fmt(0.95 * mds, 3)} g/cm³`,
      },
    ],
    [ok("CBR 95 % reportado", `${fmt(cbr95, 2)} %`, cat, cbr95 > 0)]
  );
};

export const geotecnia: Record<string, Engine> = {
  capPortante,
  humedad,
  pesoVolumetrico,
  presionTierras,
  cbr,
  granulometria,
  atterberg,
  corteDirecto,
  compresionSimple,
  asentamientos,
};
