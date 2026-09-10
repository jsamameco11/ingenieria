import type { Insumo } from "./types";

/** Categorías oficiales de costo directo (régimen Construcción Civil). */
export const MO_OFICIAL_IDS = ["MO-PEO", "MO-OFI", "MO-OPE", "MO-CAP", "MO-TOPO", "MO-OPM"] as const;
export type MoOficialId = (typeof MO_OFICIAL_IDS)[number];

const ALIAS_MO: Record<string, MoOficialId> = {
  "MO-PEO": "MO-PEO",
  "MO-OFI": "MO-OFI",
  "MO-OPE": "MO-OPE",
  "MO-CAP": "MO-CAP",
  "MO-TOPO": "MO-TOPO",
  "MO-OPM": "MO-OPM",
  "MO-FIE": "MO-OPE",
  "MO-ENC": "MO-OPE",
  "MO-CAR": "MO-OPE",
  "MO-ALB": "MO-OPE",
  "MO-ELE": "MO-OPE",
  "MO-TEC": "MO-OPE",
  "MO-GAS": "MO-OPE",
  "MO-PIN": "MO-OPE",
  "MO-SOLD": "MO-OPE",
  "MO-DRY": "MO-OPE",
  "MO-VID": "MO-OPE",
  "MO-TEL": "MO-OPE",
  "MO-MEC": "MO-OPE",
  "MO-PLO": "MO-OPE",
  "MO-ARM": "MO-OPE",
  "MO-CON": "MO-OPE",
  "MO-CER": "MO-OPE",
  "MO-PAR": "MO-OPE",
  "MO-ASF": "MO-OPE",
  "MO-IMP": "MO-OPE",
  "MO-ESC": "MO-OPE",
  "MO-HERR": "MO-OPE",
  "MO-FRI": "MO-OPE",
  "MO-HVAC": "MO-OPE",
  "MO-GASN": "MO-OPE",
  "MO-CABL": "MO-OPE",
  "MO-BIO": "MO-OPE",
  "MO-GE": "MO-OPE",
  "MO-CI": "MO-OPE",
  "MO-PUEN": "MO-OPE",
  "MO-MONT": "MO-OPE",
  "MO-MAE": "MO-CAP",
  "MO-AYU": "MO-OFI",
  "MO-AYUG": "MO-OFI",
  "MO-AYUE": "MO-OFI",
  "MO-AYUF": "MO-OFI",
  "MO-JARD": "MO-PEO",
  "MO-ALM": "MO-PEO",
  "MO-LAB": "MO-OPE",
  "MO-OPEV": "MO-OPM",
  "MO-OPCR": "MO-OPM",
  "MO-CHO": "MO-OPM",
  "MO-VIG": "MO-OFI",
  "MO-SSO": "MO-CAP",
};

export function aliasMo(id: string): string {
  return ALIAS_MO[id] ?? id;
}

export function esMoCatalogoOficial(ins: Insumo): boolean {
  if (ins.kind !== "mo") return true;
  return (MO_OFICIAL_IDS as readonly string[]).includes(ins.id);
}

/** Vigencia y parámetros del convenio colectivo CAPECO-FTCCP para construcción civil. Los jornales y el % de BUC
 *  provienen del convenio colectivo registrado ante el MTPE (no de una resolución ministerial); verifique el
 *  pliego vigente antes de usar estos valores en un expediente real — cambian cada campaña salarial (jun-may). */
export const CC_VIGENCIA = {
  norma: "Convenio colectivo CAPECO — FTCCP (campaña vigente)",
  convenio: "Convenio colectivo CAPECO — FTCCP",
  /** El régimen de construcción civil rige por campaña salarial 1.º de junio al 31 de mayo, no por año calendario. */
  desde: "2025-06-01",
  hasta: "2026-05-31",
  jornadaHoras: 8,
  diasSemana: 6,
  movilidad: 8.6,
  escolaridadJornales: 30,
  /** 40 jornales por Fiestas Patrias + 40 por Navidad = 80 jornales básicos al año (pago íntegro, trabajador con
   *  el semestre completo laborado en la obra; se prorratea si laboró menos meses). */
  gratiJornales: 80,
  vacacionesPct: 0.1,
  ctsPct: 0.15,
  essaludPct: 0.09,
  /** Aporte CONAFOVICER: 2% del jornal básico, retenido AL TRABAJADOR (no es costo adicional del empleador; el
   *  empleador solo actúa como agente retenedor y lo deposita). Se muestra como referencia, no se suma al costo día. */
  conafovicerPct: 0.02,
  /** SCTR (Seguro Complementario de Trabajo de Riesgo), obligatorio en construcción civil por ser actividad de
   *  riesgo — íntegramente a cargo del empleador. La tasa varía según la aseguradora (EsSalud/EPS) y el nivel de
   *  riesgo de la obra (I a IV); estos % son referenciales (nivel de riesgo III-IV, típico en obras civiles) y
   *  deben verificarse con la póliza contratada para cada proyecto.  */
  sctrSaludPct: 0.013,
  sctrPensionPct: 0.0153,
};

export type LineaJornal = {
  id: string;
  concepto: string;
  detalle: string;
  diario: number;
  /** Forma parte de la "remuneración computable" (base legal de vacaciones, CTS y EsSalud). */
  computable: boolean;
  /** Es un costo real a cargo del empleador (se suma en costoDia). false = informativo, o descuento al trabajador. */
  costoEmpleador: boolean;
};

export type CategoriaCc = {
  id: MoOficialId;
  nombre: string;
  rol: string;
  jornal: number;
  bucPct: number;
  factor: number;
};

export const CATEGORIAS_CC: CategoriaCc[] = [
  { id: "MO-OPE", nombre: "Operario", rol: "Trabajador calificado (albañil, carpintero, armador, encofrador, gasfitero, electricista, pintor y oficios equivalentes).", jornal: 89.3, bucPct: 0.32, factor: 1 },
  { id: "MO-OFI", nombre: "Oficial", rol: "Ayudante del operario. No tiene especialidad propia.", jornal: 69.75, bucPct: 0.3, factor: 1 },
  { id: "MO-PEO", nombre: "Peón", rol: "Trabajador no calificado de apoyo general en obra.", jornal: 62.8, bucPct: 0.3, factor: 1 },
  { id: "MO-CAP", nombre: "Capataz", rol: "Mando de cuadrilla. Se valora sobre el jornal de operario (plus de mando).", jornal: 89.3, bucPct: 0.32, factor: 1.12 },
  { id: "MO-TOPO", nombre: "Topógrafo", rol: "Control de ejes, niveles y replanteo. Categoría de costo directo de campo.", jornal: 89.3, bucPct: 0.32, factor: 1.2 },
  { id: "MO-OPM", nombre: "Operador de maquinaria pesada", rol: "Operario de equipo pesado (excavadora, cargador, rodillo, volquete de obra).", jornal: 89.3, bucPct: 0.32, factor: 1.1 },
];

export function lineasJornal(cat: CategoriaCc): LineaJornal[] {
  const j = cat.jornal * cat.factor;
  const buc = j * cat.bucPct;
  const dominical = j / CC_VIGENCIA.diasSemana;
  const escolaridad = (j * CC_VIGENCIA.escolaridadJornales) / 360;
  const grati = (j * CC_VIGENCIA.gratiJornales) / 360;
  const vacaciones = j * CC_VIGENCIA.vacacionesPct;
  const cts = j * CC_VIGENCIA.ctsPct;
  const vestimenta = buc * 0.28;
  const herramientas = buc * 0.22;
  const alimentacion = buc * 0.3;
  const especializacion = buc * 0.2;
  const computable = j + buc + dominical + escolaridad + grati + vacaciones + cts;
  const essalud = computable * CC_VIGENCIA.essaludPct;
  const conaf = j * CC_VIGENCIA.conafovicerPct;
  const sctrSalud = j * CC_VIGENCIA.sctrSaludPct;
  const sctrPension = j * CC_VIGENCIA.sctrPensionPct;
  return [
    { id: "jornal", concepto: "Jornal básico", detalle: "Jornal diario homologado. Base de beneficios sociales.", diario: j, computable: true, costoEmpleador: true },
    { id: "buc", concepto: "BUC — Bonificación unificada de construcción", detalle: `${(cat.bucPct * 100).toFixed(0)} % del jornal: vestimenta, desgaste de herramientas, alimentación y especialización del oficio.`, diario: buc, computable: true, costoEmpleador: true },
    { id: "vest", concepto: "  · Vestimenta / desgaste de ropa", detalle: "Parte de la BUC (no se suma aparte). Ropa de faena, casco y calzado de obra.", diario: vestimenta, computable: false, costoEmpleador: false },
    { id: "herr", concepto: "  · Desgaste de herramientas de mano", detalle: "Parte de la BUC (no se suma aparte). Herramientas menores del trabajador.", diario: herramientas, computable: false, costoEmpleador: false },
    { id: "alim", concepto: "  · Alimentación y condiciones de obra", detalle: "Parte de la BUC (no se suma aparte). Refrigerio y falta de servicios en frente.", diario: alimentacion, computable: false, costoEmpleador: false },
    { id: "esp", concepto: "  · Especialización del oficio", detalle: "Parte de la BUC (no se suma aparte). Oficio calificado (no es BAE de operario especializado).", diario: especializacion, computable: false, costoEmpleador: false },
    { id: "mov", concepto: "Movilidad", detalle: "S/ 8,60 por día laborado. No es remuneración computable, pero sí costo del empleador.", diario: CC_VIGENCIA.movilidad, computable: false, costoEmpleador: true },
    { id: "dom", concepto: "Descanso semanal obligatorio", detalle: "Un jornal por cada seis días laborados (1/6 diario).", diario: dominical, computable: true, costoEmpleador: true },
    { id: "esc", concepto: "Asignación por escolaridad (1 hijo)", detalle: "30 jornales al año por hijo en edad escolar (hasta 24 años si cursa estudios técnicos o superiores).", diario: escolaridad, computable: true, costoEmpleador: true },
    { id: "gra", concepto: "Gratificaciones (Fiestas Patrias y Navidad)", detalle: "80 jornales básicos al año (40 + 40), prorrateados al día.", diario: grati, computable: true, costoEmpleador: true },
    { id: "vac", concepto: "Vacaciones truncas", detalle: "10 % del jornal básico.", diario: vacaciones, computable: true, costoEmpleador: true },
    { id: "cts", concepto: "Compensación por tiempo de servicios", detalle: "15 % del jornal básico (indemnización / CTS del régimen).", diario: cts, computable: true, costoEmpleador: true },
    { id: "ess", concepto: "EsSalud", detalle: "9 % de la remuneración computable. Aporte del empleador.", diario: essalud, computable: false, costoEmpleador: true },
    {
      id: "sctr-s",
      concepto: "SCTR Salud",
      detalle: "Seguro Complementario de Trabajo de Riesgo (salud), obligatorio en construcción civil. Íntegramente a cargo del empleador; tasa referencial, varía por aseguradora y nivel de riesgo.",
      diario: sctrSalud,
      computable: false,
      costoEmpleador: true,
    },
    {
      id: "sctr-p",
      concepto: "SCTR Pensión",
      detalle: "Seguro Complementario de Trabajo de Riesgo (pensión), obligatorio en construcción civil. Íntegramente a cargo del empleador; tasa referencial, varía por aseguradora y nivel de riesgo.",
      diario: sctrPension,
      computable: false,
      costoEmpleador: true,
    },
    {
      id: "cnf",
      concepto: "CONAFOVICER (referencial)",
      detalle: "2 % del jornal básico, retenido al TRABAJADOR (vivienda del trabajador de construcción civil). El empleador solo retiene y deposita: no es un costo adicional y no se suma al costo día.",
      diario: conaf,
      computable: false,
      costoEmpleador: false,
    },
  ];
}

/** Costo diario total a cargo del empleador (jornal + beneficios + aportes patronales, sin CONAFOVICER — que es
 *  una retención al trabajador — ni el desglose informativo de la BUC). */
export function costoDia(cat: CategoriaCc): number {
  return lineasJornal(cat)
    .filter((l) => l.costoEmpleador)
    .reduce((s, l) => s + l.diario, 0);
}

export function costoHora(cat: CategoriaCc): number {
  return costoDia(cat) / CC_VIGENCIA.jornadaHoras;
}

export function precioOficialDe(id: string): number | null {
  const cat = CATEGORIAS_CC.find((c) => c.id === (ALIAS_MO[id] ?? id));
  return cat ? Math.round(costoHora(cat) * 100) / 100 : null;
}

export const GG_CONDUCTOR = {
  cargo: "Conductor de camioneta L. A2B",
  detalle: "Personal de gastos generales: chofer de camioneta de residencia con licencia A2B. No forma parte del costo directo.",
  sueldo: 2200,
  meses: 4,
};
