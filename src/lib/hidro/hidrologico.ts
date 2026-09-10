import { round } from "../num";
import {
  ZONAS_IILA,
  calcA,
  calcKg,
  curvaIdf,
  intensidad,
  tcKirpich,
  type IdfRow,
} from "./canaleta";

/** Criterio de adopción entre caudales de avenida. */
export type CriterioQ = "maximo" | "promedio" | "ponderado";

export type TipoCauce = "rio" | "quebrada" | "torrente" | "arroyo";

/**
 * Finalidad del estudio — define T sugerido y entregables.
 * No se limita a puentes: minería, bocatoma, defensas, etc.
 */
export type FinalidadEstudio =
  | "puente"
  | "defensa-riberena"
  | "badén-alcantarilla"
  | "mineria-aurifera"
  | "bocatoma-riego"
  | "captacion-industrial"
  | "estudio-general";

export interface HidrologicoInput {
  /** Identificación / SENAMHI */
  estacionSenamhi: string;
  codigoEstacion: string;
  rio: string;
  tipoCauce: TipoCauce;
  finalidad: FinalidadEstudio;
  departamento: string;
  provincia: string;
  distrito: string;
  elevacionMsnm: number;
  lat: number;
  lon: number;
  zonaId: string;
  nIila: number;
  tg: number;
  eg: number;
  bParam: number;
  Tret: number;
  /** Precipitación máxima en 24 h (mm) — SENAMHI / isoyetas */
  P24max: number;
  /** Precipitación media anual (mm) */
  Pma: number;
  /** Años de registro pluviométrico */
  anosRegistro: number;

  /** Cowan — componentes de n */
  cowanMaterial: "A" | "B" | "C" | "D";
  cowanIrreg: "A" | "B" | "C" | "D";
  cowanSeccion: "A" | "B" | "C";
  cowanObstruc: "A" | "B" | "C" | "D";
  cowanVeget: "A" | "B" | "C" | "D";
  cowanSinuos: "A" | "B" | "C";
  nScobey: number;
  forzarN: number;

  /** Método A — sección y pendiente (Manning) */
  cotaName: number;
  Aa: number;
  P: number;
  S: number;
  Ba: number;

  /** Método B — velocidad y área */
  coefHa: number;
  Vs: number;
  hActual: number;
  /** Ancho actual del espejo (estiaje / aforo) */
  Bactual: number;

  /** Método C — racional + IDF */
  Aha: number;
  C: number;
  Lcuenca: number;
  Scuenca: number;
  Hcuenca: number;
  usarTc: boolean;
  tMinFijo: number;
  iForzada: number;

  /** Método D — SCS / Curve Number (cuencas medianas) */
  usarSCS: boolean;
  CN: number;
  /** P recipiente de diseño (mm) ≈ I·t/60 si 0 */
  PdisenoMm: number;

  /** Método E — fórmula regional tipo Creager Q = C·A^n (A en km²) */
  usarRegional: boolean;
  Ccreager: number;
  nCreager: number;

  criterio: CriterioQ;
  wA: number;
  wB: number;
  wC: number;
  wD: number;
  wE: number;

  /** Entrega hidráulica / borde libre */
  bordeLibre: number;
  factorP: number;

  /**
   * Demanda de agua (minería / industria / riego).
   * QdemandaLps en L/s; horasOperacion para m³/día.
   */
  QdemandaLps: number;
  horasOperacion: number;
  /** Factor de seguridad de disponibilidad (oferta/demanda) */
  FSagua: number;
  /** Fracción del caudal de estiaje que se puede captar (licencia / ecológico) */
  fraccionCaptacion: number;
}

export const COWAN_MATERIAL: Record<string, { label: string; n: number }> = {
  A: { label: "Terroso", n: 0.02 },
  B: { label: "Rocoso", n: 0.025 },
  C: { label: "Gravoso fino", n: 0.024 },
  D: { label: "Gravoso grueso", n: 0.028 },
};
export const COWAN_IRREG: Record<string, { label: string; n: number }> = {
  A: { label: "Ninguna", n: 0 },
  B: { label: "Leve", n: 0.005 },
  C: { label: "Regular", n: 0.01 },
  D: { label: "Severa", n: 0.02 },
};
export const COWAN_SECCION: Record<string, { label: string; n: number }> = {
  A: { label: "Leve", n: 0 },
  B: { label: "Regular", n: 0.005 },
  C: { label: "Severa", n: 0.01 },
};
export const COWAN_OBSTRUC: Record<string, { label: string; n: number }> = {
  A: { label: "Despreciables", n: 0 },
  B: { label: "Menor", n: 0.01 },
  C: { label: "Apreciable", n: 0.02 },
  D: { label: "Severo", n: 0.03 },
};
export const COWAN_VEGET: Record<string, { label: string; n: number }> = {
  A: { label: "Ninguna", n: 0 },
  B: { label: "Poca", n: 0.005 },
  C: { label: "Regular", n: 0.01 },
  D: { label: "Alta", n: 0.025 },
};
export const COWAN_SINUOS: Record<string, { label: string; m: number }> = {
  A: { label: "Insignificante", m: 1.0 },
  B: { label: "Regular", m: 1.15 },
  C: { label: "Considerable", m: 1.3 },
};

export const C_ESCO_HIDRO = [
  { id: "A", C: 0.5, label: "Cultivos generales, topografía ondulada (S = 5–10 %)" },
  { id: "B", C: 0.6, label: "Cultivos generales, topografía inclinada (S = 10–30 %)" },
  { id: "C", C: 0.4, label: "Pastos, topografía ondulada (S = 5–10 %)" },
  { id: "D", C: 0.5, label: "Pastos, topografía inclinada (S = 10–30 %)" },
  { id: "E", C: 0.3, label: "Bosques, topografía ondulada (S = 5–10 %)" },
  { id: "F", C: 0.4, label: "Bosques, topografía inclinada (S = 10–30 %)" },
  { id: "G", C: 0.7, label: "Áreas desnudas, topografía ondulada (S = 5–10 %)" },
  { id: "H", C: 0.9, label: "Áreas desnudas, topografía inclinada (S = 10–30 %)" },
  { id: "I", C: 0.85, label: "Minería / desmonte / botadero (alta escorrentía)" },
  { id: "J", C: 0.95, label: "Roca desnuda / torrente de quebrada" },
];

export const TIPO_CAUCE_LABEL: Record<TipoCauce, string> = {
  rio: "Río",
  quebrada: "Quebrada",
  torrente: "Torrente",
  arroyo: "Arroyo / riachuelo",
};

export const FINALIDAD_META: Record<
  FinalidadEstudio,
  { label: string; T: number; blurb: string }
> = {
  puente: {
    label: "Puente / obra de arte vial",
    T: 100,
    blurb: "Qmáx, N.A.M.E., tirante, velocidad y cota de intradós.",
  },
  "defensa-riberena": {
    label: "Defensa ribereña / encauzamiento",
    T: 50,
    blurb: "Qmáx y N.A.M.E. para enrocado, gaviones o muro.",
  },
  "badén-alcantarilla": {
    label: "Badén / alcantarilla",
    T: 25,
    blurb: "Caudal de diseño y tirante para luz y altura libre.",
  },
  "mineria-aurifera": {
    label: "Explotación minera aurífera (agua de proceso)",
    T: 50,
    blurb: "Qavenida (seguridad) + Qestiaje / captación vs demanda de lavado-beneficio.",
  },
  "bocatoma-riego": {
    label: "Bocatoma / riego",
    T: 25,
    blurb: "Qavenida (protección) y caudal disponible en estiaje para concesión.",
  },
  "captacion-industrial": {
    label: "Captación industrial / campamento",
    T: 25,
    blurb: "Oferta en estiaje vs demanda operativa (L/s y m³/día).",
  },
  "estudio-general": {
    label: "Estudio hidrológico general",
    T: 100,
    blurb: "Informe completo multi-método para expediente técnico.",
  },
};

export const T_RETORNO_HIDRO: { T: number; finalidad: FinalidadEstudio; label: string }[] = [
  { T: 10, finalidad: "badén-alcantarilla", label: "10 años — verificación / drenaje menor" },
  { T: 25, finalidad: "badén-alcantarilla", label: "25 años — badén, alcantarilla, bocatoma menor" },
  { T: 50, finalidad: "defensa-riberena", label: "50 años — defensa ribereña / minería (avenida)" },
  { T: 100, finalidad: "puente", label: "100 años — puente / río principal" },
  { T: 200, finalidad: "puente", label: "200 años — obra crítica / infraestructura estratégica" },
  { T: 500, finalidad: "estudio-general", label: "500 años — verificación extraordinaria" },
];

export const SCOBEY_N = [
  { n: 0.025, label: "Tierra natural limpia, buen alineamiento" },
  { n: 0.03, label: "Piedra fragmentada, sección variable (ceja de selva)" },
  { n: 0.035, label: "Grava/gravilla, baja pendiente (ceja de selva)" },
  { n: 0.045, label: "Canto rodado suelto (sierra / ceja de selva)" },
  { n: 0.06, label: "Maleza y sección irregular (selva)" },
  { n: 0.075, label: "Maleza densa, cauce muy obstruido" },
];

export const CN_TIPICOS = [
  { CN: 55, label: "Bosque bueno, suelo B" },
  { CN: 70, label: "Pastizal / cultivo, suelo C" },
  { CN: 78, label: "Cultivo pobre / eriazo, suelo C" },
  { CN: 85, label: "Desmonte / minería, suelo D" },
  { CN: 90, label: "Roca / urbano / botadero" },
  { CN: 95, label: "Impermeable casi total" },
];

function nCowan(inp: HidrologicoInput) {
  const n0 =
    COWAN_MATERIAL[inp.cowanMaterial].n +
    COWAN_IRREG[inp.cowanIrreg].n +
    COWAN_SECCION[inp.cowanSeccion].n +
    COWAN_OBSTRUC[inp.cowanObstruc].n +
    COWAN_VEGET[inp.cowanVeget].n;
  return n0 * COWAN_SINUOS[inp.cowanSinuos].m;
}

/** Escorrentía SCS (mm) a partir de P (mm) y CN. */
export function escorrentiaSCS(Pmm: number, CN: number) {
  const cn = Math.min(98, Math.max(30, CN));
  const S = (25400 / cn) - 254;
  const Ia = 0.2 * S;
  if (Pmm <= Ia) return { Qmm: 0, S, Ia };
  const Qmm = ((Pmm - Ia) ** 2) / (Pmm - Ia + S);
  return { Qmm, S, Ia };
}

export interface HidrologicoResult {
  nCowan: number;
  nScobey: number;
  nAdopt: number;
  Rh: number;
  Qmanning: number;
  Ha: number;
  Va: number;
  Qvel: number;
  TcMin: number;
  tDisenoMin: number;
  a: number;
  K: number;
  I: number;
  Imanual: number;
  Qracional: number;
  QracionalManual: number;
  Qscs: number;
  Pscs: number;
  QmmScs: number;
  Qregional: number;
  Qmax: number;
  Qprom: number;
  Qpond: number;
  Qadopt: number;
  criterioLabel: string;
  dA: number;
  dH: number;
  cotaNameNueva: number;
  Vadopt: number;
  yName: number;
  cotaIntradósMin: number;
  /** Caudal actual / estiaje (aforo) */
  Aactual: number;
  Qestiaje: number;
  QestiajeLps: number;
  Qcaptacion: number;
  QcaptacionLps: number;
  QdemandaLps: number;
  QdemandaM3dia: number;
  ratioOfertaDemanda: number;
  balanceOk: boolean;
  volumenAvenidaM3aprox: number;
  idf: IdfRow[];
  zona: (typeof ZONAS_IILA)[number] | null;
  avisos: string[];
  faltantes: string[];
  listoDiseno: {
    Qdiseño: number;
    Qestiaje: number;
    Qcaptacion: number;
    N_AME: number;
    tirante: number;
    velocidad: number;
    bordeLibre: number;
    cotaIntradós: number;
    n: number;
    S: number;
    T: number;
    I: number;
    Tc: number;
    balanceOk: boolean;
    ratioOfertaDemanda: number;
  };
}

export function calcularHidrologico(inp: HidrologicoInput): HidrologicoResult {
  const avisos: string[] = [];
  const faltantes: string[] = [];
  const zona = ZONAS_IILA.find((z) => z.id === inp.zonaId) ?? null;

  if (!inp.estacionSenamhi.trim()) faltantes.push("Nombre / referencia de estación SENAMHI");
  if (!inp.codigoEstacion.trim()) faltantes.push("Código de estación SENAMHI (si existe en el catálogo)");
  if (inp.P24max <= 0) faltantes.push("P24 máx. (mm) de SENAMHI o isoyetas CE.040");
  if (inp.anosRegistro < 10) {
    avisos.push(
      `Registro pluviométrico de ${inp.anosRegistro || 0} años es corto; para T≥100 se recomiendan ≥20–30 años o regionalización.`
    );
  }
  if (inp.elevacionMsnm <= 0) faltantes.push("Elevación del sitio (m s.n.m.)");
  if (!inp.departamento.trim()) faltantes.push("Departamento / ubicación administrativa");

  const nCow = nCowan(inp);
  const nSco = Math.max(0.02, inp.nScobey);
  let nAdopt = Math.min(nCow, nSco);
  if (inp.forzarN > 0) nAdopt = inp.forzarN;
  nAdopt = round(nAdopt, 4);

  const Aa = Math.max(0.01, inp.Aa);
  const P = Math.max(0.01, inp.P);
  const S = Math.max(1e-6, inp.S);
  const Rh = Aa / P;
  const Qmanning = (Aa * Rh ** (2 / 3) * Math.sqrt(S)) / nAdopt;

  const Ba = Math.max(0.1, inp.Ba);
  const Ha = (inp.coefHa * Aa) / Ba;
  const hAct = Math.max(0.05, inp.hActual);
  if (Ha <= hAct) avisos.push("Ha calculada ≤ h actual: revise coeficiente de amplificación o las huellas de N.A.M.E.");
  const Va = inp.Vs * (Ha / hAct);
  const Qvel = Va * Aa;
  if (Va > 8) avisos.push(`Velocidad de avenida Va = ${round(Va, 2)} m/s es muy alta; verifique Vs, Ha y h de campo.`);

  const TcMin = Math.max(5, tcKirpich(Math.max(1, inp.Lcuenca), Math.max(1e-5, inp.Scuenca)));
  const tDisenoMin = inp.usarTc ? Math.max(10, TcMin) : Math.max(10, inp.tMinFijo);
  const a = calcA(inp.tg, inp.nIila, inp.eg);
  const K = calcKg(inp.eg);
  const I = intensidad(a, K, Math.max(2, inp.Tret), tDisenoMin / 60, inp.bParam, inp.nIila);
  const Imanual = Math.max(0, inp.iForzada);
  const Aha = Math.max(0.01, inp.Aha);
  const C = Math.min(1, Math.max(0.05, inp.C));
  const Qracional = (C * I * Aha) / 360;
  const QracionalManual = Imanual > 0 ? (C * Imanual * Aha) / 360 : 0;

  // SCS
  const Pscs =
    inp.PdisenoMm > 0
      ? inp.PdisenoMm
      : inp.P24max > 0
        ? inp.P24max * (0.35 + 0.15 * Math.log10(Math.max(2, inp.Tret))) // aproximación T a partir de P24
        : (I * tDisenoMin) / 60;
  const scs = escorrentiaSCS(Pscs, inp.CN);
  // Caudal punta simplificado (mock UH triangular): qp ≈ 0.208·Akm²·Qmm/Tp ; Tp≈Tc/60/2+D/2
  const Akm2 = Aha / 100;
  const TpHr = Math.max(0.25, TcMin / 60 / 2 + tDisenoMin / 60 / 2);
  const Qscs = inp.usarSCS ? (0.208 * Akm2 * scs.Qmm) / TpHr : 0;

  // Regional Creager-like: Q = C · A^n (m³/s, A km²)
  const Qregional = inp.usarRegional ? inp.Ccreager * Akm2 ** Math.max(0.3, inp.nCreager) : 0;

  if (Aha > 500) {
    avisos.push(
      "Área > 500 ha: el racional del Excel es orientativo. Active SCS o fórmula regional, o priorice aforo / hidrograma (MTC–SENAMHI)."
    );
  }
  if (Aha > 2500 && !inp.usarSCS && !inp.usarRegional) {
    avisos.push("A > 25 km²: no use racional como único criterio; active SCS/regional o aforo.");
  }
  if (inp.tipoCauce === "quebrada" || inp.tipoCauce === "torrente") {
    avisos.push(
      "Quebrada/torrente: priorice huellas de campo (Manning) y T≥50; el racional puede subestimar picos por pendientes fuertes."
    );
  }

  const QA = Qmanning;
  const QB = Qvel;
  const QC = Imanual > 0 ? QracionalManual : Qracional;
  const QD = Qscs;
  const QE = Qregional;

  const qs = [QA, QB, QC];
  if (inp.usarSCS && QD > 0) qs.push(QD);
  if (inp.usarRegional && QE > 0) qs.push(QE);

  const Qmax = Math.max(...qs);
  const Qprom = qs.reduce((s, x) => s + x, 0) / qs.length;
  const wA = inp.wA;
  const wB = inp.wB;
  const wC = inp.wC;
  const wD = inp.usarSCS ? inp.wD : 0;
  const wE = inp.usarRegional ? inp.wE : 0;
  const wSum = Math.max(1e-9, wA + wB + wC + wD + wE);
  const Qpond = (wA * QA + wB * QB + wC * QC + wD * QD + wE * QE) / wSum;

  let Qadopt = Qmax;
  let criterioLabel = "Máximo de los métodos activos";
  if (inp.criterio === "promedio") {
    Qadopt = Qprom;
    criterioLabel = "Promedio aritmético de métodos activos";
  } else if (inp.criterio === "ponderado") {
    Qadopt = Qpond;
    criterioLabel = `Media ponderada (A=${wA}, B=${wB}, C=${wC}${wD ? `, D=${wD}` : ""}${wE ? `, E=${wE}` : ""})`;
  }

  const fP = Math.max(1, inp.factorP);
  const target = (Qadopt * nAdopt * (fP * P) ** (2 / 3)) / Math.sqrt(S);
  const Areq = Math.max(Aa, target ** (3 / 5));
  const dA = Math.max(0, Areq - Aa);
  const disc = Ba * Ba + 4 * dA;
  const dH = dA <= 0 ? 0 : (-Ba + Math.sqrt(disc)) / 2;
  const cotaNameNueva = inp.cotaName + dH;
  const Aadopt = Aa + dA;
  const Vadopt = Qadopt / Math.max(Aadopt, 1e-6);
  const yName = Ha + dH;
  const cotaIntradósMin = cotaNameNueva + Math.max(0.5, inp.bordeLibre);

  // Estiaje / aforo actual
  const Bact = Math.max(0.2, inp.Bactual || Ba * 0.45);
  const Aactual = Math.max(0.05, Bact * hAct * 0.7); // sección aproximada trapezoidal suave
  const Qestiaje = Math.max(0, inp.Vs * Aactual);
  const QestiajeLps = Qestiaje * 1000;
  const frac = Math.min(0.95, Math.max(0.05, inp.fraccionCaptacion));
  const Qcaptacion = Qestiaje * frac;
  const QcaptacionLps = Qcaptacion * 1000;
  const QdemandaLps = Math.max(0, inp.QdemandaLps);
  const horas = Math.min(24, Math.max(1, inp.horasOperacion));
  const QdemandaM3dia = (QdemandaLps / 1000) * horas * 3600;
  const FS = Math.max(1, inp.FSagua);
  const ratioOfertaDemanda = QdemandaLps > 0 ? QcaptacionLps / (QdemandaLps * FS) : Infinity;
  const balanceOk = QdemandaLps <= 0 || ratioOfertaDemanda >= 1;

  if (
    (inp.finalidad === "mineria-aurifera" ||
      inp.finalidad === "bocatoma-riego" ||
      inp.finalidad === "captacion-industrial") &&
    QdemandaLps <= 0
  ) {
    faltantes.push("Demanda de agua Qdemanda (L/s) para balance oferta/demanda");
  }
  if (!balanceOk) {
    avisos.push(
      `Oferta capturable (${round(QcaptacionLps, 1)} L/s) < demanda×FS (${round(QdemandaLps * FS, 1)} L/s). Ajuste concesión, recirculación o fuente alternativa.`
    );
  }

  // Volumen aproximado de avenida (triángulo: base 2·Tc)
  const volumenAvenidaM3aprox = 0.5 * Qadopt * (2 * (TcMin / 60) * 3600);

  if (Math.abs(QA - QC) / Math.max(Qmax, 1e-6) > 0.5) {
    avisos.push("Dispersión alta entre Manning y racional (>50 %). Revise huellas, n, C, T o estación SENAMHI.");
  }

  const idf = curvaIdf(a, K, inp.bParam, inp.nIila);

  return {
    nCowan: round(nCow, 4),
    nScobey: round(nSco, 4),
    nAdopt,
    Rh: round(Rh, 3),
    Qmanning: round(Qmanning, 3),
    Ha: round(Ha, 3),
    Va: round(Va, 3),
    Qvel: round(Qvel, 3),
    TcMin: round(TcMin, 1),
    tDisenoMin: round(tDisenoMin, 1),
    a: round(a, 4),
    K: round(K, 4),
    I: round(I, 2),
    Imanual: round(Imanual, 2),
    Qracional: round(Qracional, 3),
    QracionalManual: round(QracionalManual, 3),
    Qscs: round(Qscs, 3),
    Pscs: round(Pscs, 1),
    QmmScs: round(scs.Qmm, 2),
    Qregional: round(Qregional, 3),
    Qmax: round(Qmax, 3),
    Qprom: round(Qprom, 3),
    Qpond: round(Qpond, 3),
    Qadopt: round(Qadopt, 3),
    criterioLabel,
    dA: round(dA, 3),
    dH: round(dH, 3),
    cotaNameNueva: round(cotaNameNueva, 3),
    Vadopt: round(Vadopt, 3),
    yName: round(yName, 3),
    cotaIntradósMin: round(cotaIntradósMin, 3),
    Aactual: round(Aactual, 3),
    Qestiaje: round(Qestiaje, 4),
    QestiajeLps: round(QestiajeLps, 2),
    Qcaptacion: round(Qcaptacion, 4),
    QcaptacionLps: round(QcaptacionLps, 2),
    QdemandaLps: round(QdemandaLps, 2),
    QdemandaM3dia: round(QdemandaM3dia, 1),
    ratioOfertaDemanda: Number.isFinite(ratioOfertaDemanda) ? round(ratioOfertaDemanda, 2) : 999,
    balanceOk,
    volumenAvenidaM3aprox: round(volumenAvenidaM3aprox, 0),
    idf,
    zona,
    avisos,
    faltantes,
    listoDiseno: {
      Qdiseño: round(Qadopt, 3),
      Qestiaje: round(Qestiaje, 4),
      Qcaptacion: round(Qcaptacion, 4),
      N_AME: round(cotaNameNueva, 3),
      tirante: round(yName, 3),
      velocidad: round(Vadopt, 3),
      bordeLibre: round(Math.max(0.5, inp.bordeLibre), 2),
      cotaIntradós: round(cotaIntradósMin, 3),
      n: nAdopt,
      S: round(S, 5),
      T: inp.Tret,
      I: round(Imanual > 0 ? Imanual : I, 2),
      Tc: round(TcMin, 1),
      balanceOk,
      ratioOfertaDemanda: Number.isFinite(ratioOfertaDemanda) ? round(ratioOfertaDemanda, 2) : 999,
    },
  };
}

export const HIDROLOGICO_DEFAULT: HidrologicoInput = {
  estacionSenamhi: "Calibrar con estación SENAMHI más cercana (isoyetas CE.040)",
  codigoEstacion: "",
  rio: "Río / quebrada del proyecto",
  tipoCauce: "quebrada",
  finalidad: "estudio-general",
  departamento: "",
  provincia: "",
  distrito: "",
  elevacionMsnm: 4190,
  lat: 0,
  lon: 0,
  zonaId: "sierra",
  nIila: 0.55,
  tg: 8,
  eg: 80,
  bParam: 0.15,
  Tret: 100,
  P24max: 45,
  Pma: 650,
  anosRegistro: 20,
  cowanMaterial: "C",
  cowanIrreg: "B",
  cowanSeccion: "B",
  cowanObstruc: "B",
  cowanVeget: "A",
  cowanSinuos: "A",
  nScobey: 0.05,
  forzarN: 0,
  cotaName: 4190.85,
  Aa: 10,
  P: 11,
  S: 0.1256,
  Ba: 10.6,
  coefHa: 2.5,
  Vs: 2,
  hActual: 0.5,
  Bactual: 4.5,
  Aha: 300,
  C: 0.9,
  Lcuenca: 3500,
  Scuenca: 0.08,
  Hcuenca: 450,
  usarTc: true,
  tMinFijo: 30,
  iForzada: 0,
  usarSCS: true,
  CN: 85,
  PdisenoMm: 0,
  usarRegional: false,
  Ccreager: 20,
  nCreager: 0.5,
  criterio: "maximo",
  wA: 1,
  wB: 1,
  wC: 1.5,
  wD: 1,
  wE: 0.8,
  bordeLibre: 1.5,
  factorP: 1.1,
  QdemandaLps: 15,
  horasOperacion: 16,
  FSagua: 1.3,
  fraccionCaptacion: 0.5,
};
