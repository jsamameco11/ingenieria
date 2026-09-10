import { MODULES, SPECIALTIES } from "../catalog";

export const QUOTA_MAX = 6;

export type QuotaEngine = {
  id: string;
  label: string;
  family: string;
  hint: string;
  modules: string[];
  defaultLimit: number;
};

const EXTRA: QuotaEngine[] = [
  {
    id: "presupuestos",
    label: "Presupuesto y APU",
    family: "Presupuesto",
    hint: "Un expediente de metrados y precios unitarios.",
    modules: ["presupuestos", "mis-presupuestos"],
    defaultLimit: 1,
  },
  {
    id: "presupuesto-pdf",
    label: "Presupuesto desde PDF",
    family: "Presupuesto",
    hint: "La lectura con IA ya se cobra por hoja. Deje 0 si no quiere cupo extra.",
    modules: ["presupuesto-pdf"],
    defaultLimit: 0,
  },
  {
    id: "vincular-revit",
    label: "Importación Revit",
    family: "Presupuesto",
    hint: "Una vinculación de modelo a partidas.",
    modules: ["vincular-revit"],
    defaultLimit: 1,
  },
  {
    id: "formula-polinomica",
    label: "Fórmula polinómica",
    family: "Presupuesto",
    hint: "Una fórmula de reajuste.",
    modules: ["formula-polinomica"],
    defaultLimit: 1,
  },
  {
    id: "cronograma",
    label: "Cronograma de obra",
    family: "Presupuesto",
    hint: "Un programa CPM / Gantt.",
    modules: ["cronograma"],
    defaultLimit: 1,
  },
  {
    id: "especificaciones",
    label: "Especificaciones técnicas",
    family: "Presupuesto",
    hint: "Un juego de fichas de expediente.",
    modules: ["especificaciones"],
    defaultLimit: 1,
  },
  {
    id: "mano-obra",
    label: "Mano de obra y jornales",
    family: "Presupuesto",
    hint: "Tablas de jornales de construcción civil.",
    modules: ["mano-obra"],
    defaultLimit: 1,
  },
  {
    id: "canaleta",
    label: "Drenaje pluvial",
    family: "Hidráulica",
    hint: "Una hoja de canaletas y bajantes.",
    modules: ["canaleta"],
    defaultLimit: 1,
  },
  {
    id: "canal",
    label: "Canal abierto",
    family: "Hidráulica",
    hint: "Una sección de canal.",
    modules: ["canal"],
    defaultLimit: 1,
  },
  {
    id: "sifon",
    label: "Sifón invertido",
    family: "Hidráulica",
    hint: "Un ramal invertido.",
    modules: ["sifon"],
    defaultLimit: 1,
  },
  {
    id: "alcantarilla-hid",
    label: "Alcantarilla hidráulica",
    family: "Hidráulica",
    hint: "Un cruce hidráulico.",
    modules: ["alcantarilla-hid"],
    defaultLimit: 1,
  },
  {
    id: "hidrologico",
    label: "Cálculo hidrológico",
    family: "Hidrología",
    hint: "Memorias de avenida/estiaje (puente, defensa, minería, bocatoma, etc.).",
    modules: [
      "hidro-estudio",
      "hidro-puente",
      "hidro-defensa",
      "hidro-baden",
      "hidro-mineria",
      "hidro-bocatoma-est",
      "hidro-industrial",
      "hidrologico",
    ],
    defaultLimit: 3,
  },
  {
    id: "cuneta",
    label: "Cuneta",
    family: "Hidráulica",
    hint: "Una cuneta de vía.",
    modules: ["cuneta"],
    defaultLimit: 1,
  },
  {
    id: "ap-dotacion",
    label: "Dotación y caudales",
    family: "Agua potable",
    hint: "Una hoja de demanda.",
    modules: ["ap-dotacion"],
    defaultLimit: 1,
  },
  {
    id: "ap-sistema",
    label: "Sistema abierto",
    family: "Agua potable",
    hint: "Una conducción / reservorio.",
    modules: ["ap-sistema"],
    defaultLimit: 1,
  },
  {
    id: "ap-red",
    label: "Red de agua potable",
    family: "Agua potable",
    hint: "Un diseño de red mallada o ramificada.",
    modules: ["ap-red"],
    defaultLimit: 1,
  },
  {
    id: "ap-sedimentador",
    label: "Sedimentador",
    family: "Agua potable",
    hint: "Una unidad de sedimentación.",
    modules: ["ap-sedimentador"],
    defaultLimit: 1,
  },
  {
    id: "ap-prefiltro",
    label: "Prefiltro de grava",
    family: "Agua potable",
    hint: "Un prefiltro.",
    modules: ["ap-prefiltro"],
    defaultLimit: 1,
  },
  {
    id: "ap-filtro-lento",
    label: "Filtro lento",
    family: "Agua potable",
    hint: "Un filtro lento.",
    modules: ["ap-filtro-lento"],
    defaultLimit: 1,
  },
  {
    id: "ap-impulsion",
    label: "Impulsión y bombeo",
    family: "Agua potable",
    hint: "Una impulsión.",
    modules: ["ap-impulsion"],
    defaultLimit: 1,
  },
  {
    id: "ap-reservorio",
    label: "Reservorio apoyado",
    family: "Agua potable",
    hint: "Un reservorio.",
    modules: ["ap-reservorio"],
    defaultLimit: 1,
  },
  {
    id: "ap-cloracion",
    label: "Cloración",
    family: "Agua potable",
    hint: "Una dosificación.",
    modules: ["ap-cloracion"],
    defaultLimit: 1,
  },
  {
    id: "taquimetro",
    label: "Levantamiento taquimétrico",
    family: "Topografía",
    hint: "Una cartera de estadía.",
    modules: ["taquimetro"],
    defaultLimit: 1,
  },
  {
    id: "libreta-topo",
    label: "Libreta de radiación",
    family: "Topografía",
    hint: "Una libreta de campo.",
    modules: ["libreta-topo"],
    defaultLimit: 1,
  },
  {
    id: "seccion-transversal",
    label: "Sección transversal",
    family: "Movimiento de tierras",
    hint: "Una sección de vía.",
    modules: ["seccion-transversal"],
    defaultLimit: 1,
  },
  {
    id: "volumenes-tierras",
    label: "Volúmenes de tierras",
    family: "Movimiento de tierras",
    hint: "Un diagrama de masas.",
    modules: ["volumenes-tierras"],
    defaultLimit: 1,
  },
];

const FAMILY_OF_SPECIALTY: Record<string, string> = {
  edificaciones: "Hojas · Edificaciones",
  puentes: "Hojas · Puentes",
  geotecnia: "Hojas · Geotecnia",
  saneamiento: "Hojas · Saneamiento",
  carreteras: "Hojas · Carreteras",
  pavimentos: "Hojas · Pavimentos",
  instalaciones: "Hojas · Instalaciones",
  tasaciones: "Hojas · Tasaciones",
  analisis: "Análisis estructural",
};

function sheetEngines(): QuotaEngine[] {
  return MODULES.map((m) => ({
    id: m.slug,
    label: m.title,
    family: FAMILY_OF_SPECIALTY[m.specialty] || SPECIALTIES.find((s) => s.slug === m.specialty)?.title || "Hojas de cálculo",
    hint: "Una corrida de esta hoja (el ejemplo de apertura se consulta sin cupo).",
    modules: [m.slug],
    defaultLimit: 1,
  }));
}

export const QUOTA_ENGINES: QuotaEngine[] = [...EXTRA, ...sheetEngines()];

const BY_ID = new Map(QUOTA_ENGINES.map((e) => [e.id, e]));
const BY_MODULE = new Map<string, string>();
for (const e of QUOTA_ENGINES) {
  for (const slug of e.modules) {
    if (!BY_MODULE.has(slug)) BY_MODULE.set(slug, e.id);
  }
}

export function quotaEngineById(id: string): QuotaEngine | undefined {
  return BY_ID.get(id);
}

export function quotaEngineFromPage(page: string): string {
  return BY_MODULE.get(page) || page || "general";
}

export function currentPageSlug(): string {
  if (typeof document === "undefined") return "";
  return document.documentElement.dataset.mcPage || "";
}

export function currentSpecialtySlug(): string {
  if (typeof document === "undefined") return "";
  return document.documentElement.dataset.mcSpecialty || "";
}

export function clampQuota(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.max(0, Math.min(QUOTA_MAX, Math.round(v)));
}

export function defaultQuotaMap(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of QUOTA_ENGINES) out[e.id] = e.defaultLimit;
  return out;
}

export function mergeQuotaMap(raw: Record<string, unknown> | null | undefined): Record<string, number> {
  const next = defaultQuotaMap();
  if (!raw) return next;
  for (const [id, value] of Object.entries(raw)) {
    if (id in next || BY_ID.has(id)) next[id] = clampQuota(value);
  }
  return next;
}

export function quotaFamilies(): { family: string; engines: QuotaEngine[] }[] {
  const order: string[] = [];
  const map = new Map<string, QuotaEngine[]>();
  for (const e of QUOTA_ENGINES) {
    if (!map.has(e.family)) {
      map.set(e.family, []);
      order.push(e.family);
    }
    map.get(e.family)!.push(e);
  }
  return order.map((family) => ({ family, engines: map.get(family) || [] }));
}

export function isQuotaAction(text: string): boolean {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (/ver planes|seguir consultando|iniciar sesión|guardar ficha|completar ficha/.test(t)) return false;
  return (
    /\bcalcular\b/.test(t) ||
    /\banalizar\b/.test(t) ||
    /\bresolver\b/.test(t) ||
    /nuevo presupuesto/.test(t) ||
    /importar/.test(t) ||
    /cargar modelo/.test(t) ||
    /vincular/.test(t) && /revit/.test(t)
  );
}
