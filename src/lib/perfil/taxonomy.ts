import { INTEREST_RUBROS, PROFESSIONS, WORKPLACE_ROLES } from "../auth/professions";

export type EntityType = "profession" | "skill" | "technology" | "interest" | "role" | "industry";

const PROFESSION_MAP: Record<string, { profession: string; specialization?: string }> = {
  arq: { profession: "ARQ" },
  "arq-urbanista": { profession: "arch-urban" },
  "arq-paisajista": { profession: "arch-paisaje" },
  "arq-interiores": { profession: "arch-interior" },
  icivil: { profession: "eng-civil" },
  iestructural: { profession: "eng-civil", specialization: "eng-civil-est" },
  igeotecnia: { profession: "eng-civil", specialization: "eng-civil-geo" },
  ihidraulico: { profession: "eng-civil", specialization: "eng-civil-hid" },
  itransportes: { profession: "eng-civil", specialization: "eng-civil-trans" },
  icaminos: { profession: "eng-civil", specialization: "eng-civil-trans" },
  iconstructivo: { profession: "eng-civil", specialization: "eng-civil-const" },
  icatastral: { profession: "eng-civil", specialization: "eng-civil-top" },
  itopografo: { profession: "eng-civil", specialization: "eng-civil-top" },
  isanitario: { profession: "eng-san", specialization: "eng-civil-san" },
  iambiental: { profession: "eng-env" },
  iagricola: { profession: "eng-agr" },
  iindustrial: { profession: "eng-ind" },
  imecanico: { profession: "eng-mech" },
  ielectrico: { profession: "eng-elec" },
  ielectronico: { profession: "eng-electron" },
  isistemas: { profession: "eng-sys" },
  iinformatico: { profession: "eng-sys" },
  constructor: { profession: "eng-civil", specialization: "eng-civil-const" },
  "bachiller-civil": { profession: "eng-civil" },
  estudiante: { profession: "eng-civil" },
};

const INTEREST_MAP: Record<string, string> = {
  estructuras: "eng-civil-est",
  puentes: "eng-civil-puentes",
  hidraulica: "eng-civil-hid",
  hidrologia: "eng-civil-hidro",
  saneamiento: "eng-civil-san",
  geotecnia: "eng-civil-geo",
  viales: "eng-civil-trans",
  pavimentos: "eng-civil-pav",
  mezclas: "eng-civil-mix",
  presupuestos: "eng-civil-cost",
  tasaciones: "eng-civil-tas",
  topografia: "eng-civil-top",
  electricas: "eng-civil-inst",
  electromecanicas: "eng-civil-inst",
  "mov-tierras": "eng-civil-mov",
  interiores: "arch-interior",
  arquitectura: "arch-general",
};

const SPECIALTY_INTEREST: Record<string, string> = {
  edificaciones: "eng-civil-est",
  "estructuras-especiales": "eng-civil-est",
  puentes: "eng-civil-puentes",
  geotecnia: "eng-civil-geo",
  hidraulica: "eng-civil-hid",
  saneamiento: "eng-civil-san",
  carreteras: "eng-civil-trans",
  pavimentos: "eng-civil-pav",
  mezclas: "eng-civil-mix",
  instalaciones: "eng-civil-inst",
  tasaciones: "eng-civil-tas",
  analisis: "eng-civil-est",
};

const MODULE_TECH: Record<string, string> = {
  "diagrama-interaccion": "etabs",
  "vincular-revit": "revit",
  presupuestos: "excel",
  "presupuesto-pdf": "excel",
  "mis-presupuestos": "excel",
  cronograma: "msproject",
};

const ROLE_SKILL: Record<string, string> = {
  proyectista: "eng-proy",
  residente: "eng-residente",
  supervisor: "eng-sup",
  contratista: "eng-budget",
  gerente: "eng-pm",
  tasador: "eng-civil-tas",
  docente: "eng",
};

const ALIASES: Record<EntityType, Record<string, string>> = {
  profession: {
    "ingeniero civil": "eng-civil",
    "ingenieria civil": "eng-civil",
    "ing civil": "eng-civil",
    "ing. civil": "eng-civil",
    "civil engineer": "eng-civil",
    "ingeniero estructural": "eng-civil-est",
    "ingenieria estructural": "eng-civil-est",
    arquitecto: "ARQ",
    arquitectura: "ARQ",
    "disenador de interiores": "arch-interior",
    "ingeniero mecanico": "eng-mech",
    "ingeniero electricista": "eng-elec",
    "ingeniero industrial": "eng-ind",
    "ingeniero sanitario": "eng-san",
    "ingeniero ambiental": "eng-env",
    "ingeniero de sistemas": "eng-sys",
  },
  technology: {
    etabs: "etabs",
    "csi etabs": "etabs",
    "etabs 21": "etabs",
    sap2000: "sap2000",
    "sap 2000": "sap2000",
    safe: "safe",
    revit: "revit",
    "revit structure": "revit-structure",
    autocad: "autocad",
    "auto cad": "autocad",
    "civil 3d": "civil3d",
    civil3d: "civil3d",
    excel: "excel",
    "ms project": "msproject",
    primavera: "primavera",
    "primavera p6": "primavera",
    python: "python",
    bim: "bim",
    matlab: "matlab",
    tekla: "tekla",
    navisworks: "navisworks",
  },
  interest: {
    estructuras: "eng-civil-est",
    bim: "eng-civil-bim",
    geotecnia: "eng-civil-geo",
    hidraulica: "eng-civil-hid",
    hidrologia: "eng-civil-hidro",
    saneamiento: "eng-civil-san",
    pavimentos: "eng-civil-pav",
    presupuestos: "eng-civil-cost",
  },
  skill: {
    "diseno estructural": "eng-design-est",
    "calculo estructural": "eng-calc-est",
    metrados: "eng-metrado",
    supervision: "eng-sup",
  },
  role: {
    residente: "eng-residente",
    "residente de obra": "eng-residente",
    proyectista: "eng-proy",
    supervisor: "eng-sup",
    calculista: "eng-calc-est",
    "especialista en estructuras": "eng-design-est",
    "especialista de estructuras": "eng-design-est",
  },
  industry: {
    construccion: "const",
    constructora: "const",
  },
};

export function foldAlias(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolveAllAliases(type: EntityType, raw: string): string[] {
  const key = foldAlias(raw);
  if (!key) return [];
  const compact = key.replace(/\s+/g, "");
  const table = ALIASES[type];
  const found = new Set<string>();
  const aliases = Object.entries(table).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, code] of aliases) {
    const aliasCompact = alias.replace(/\s+/g, "");
    if (key === alias || compact === aliasCompact || (alias.length >= 4 && (key.includes(alias) || compact.includes(aliasCompact)))) {
      found.add(code);
    }
  }
  return [...found];
}

export function resolveAlias(type: EntityType, raw: string): string | null {
  const all = resolveAllAliases(type, raw);
  return all[0] || null;
}

export function professionFromOnboarding(professionId: string, label: string) {
  const mapped = PROFESSION_MAP[professionId];
  if (mapped) return mapped;
  const fromAlias = resolveAlias("profession", label || professionId);
  if (fromAlias) {
    if (fromAlias.startsWith("eng-civil-") && fromAlias !== "eng-civil") {
      return { profession: "eng-civil", specialization: fromAlias };
    }
    return { profession: fromAlias };
  }
  return null;
}

export function interestFromRubro(id: string): string | null {
  return INTEREST_MAP[id] || resolveAlias("interest", id);
}

export function interestFromSpecialty(slug: string): string | null {
  return SPECIALTY_INTEREST[slug] || INTEREST_MAP[slug] || null;
}

export function technologyFromModule(slug: string): string | null {
  return MODULE_TECH[slug] || null;
}

export function skillFromRole(role: string): string | null {
  return ROLE_SKILL[role] || resolveAlias("role", role);
}

export function knownProfessionLabel(id: string): string {
  return PROFESSIONS.find((p) => p.id === id)?.label || id;
}

export function knownRoleLabel(id: string): string {
  return WORKPLACE_ROLES.find((r) => r.id === id)?.label || id;
}

export function knownRubroLabel(id: string): string {
  return INTEREST_RUBROS.find((r) => r.id === id)?.label || id;
}

export function parseYears(raw: string): { years: number; confidence: number } | null {
  const t = foldAlias(raw);
  if (!t) return null;
  const range = t.match(/(\d+(?:[.,]\d+)?)\s*(?:a|al|hasta|-|–)\s*(\d+(?:[.,]\d+)?)/);
  if (range) {
    const a = Number(range[1].replace(",", "."));
    const b = Number(range[2].replace(",", "."));
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { years: Math.round((a + b) / 2), confidence: 0.86 };
    }
  }
  const n = t.match(/(\d+(?:[.,]\d+)?)/);
  if (!n) return null;
  const years = Number(n[1].replace(",", "."));
  if (!Number.isFinite(years) || years < 0 || years > 70) return null;
  const approx = /aprox|cerca|mas o menos|alrededor/.test(t);
  return { years: Math.round(years), confidence: approx ? 0.9 : 0.98 };
}

export function detectProfessionConflict(a: string, b: string): boolean {
  const na = foldAlias(a);
  const nb = foldAlias(b);
  if (!na || !nb || na === nb) return false;
  const ca = resolveAlias("profession", a) || na;
  const cb = resolveAlias("profession", b) || nb;
  if (ca === cb) return false;
  const family = (code: string) => code.split("-").slice(0, 2).join("-");
  if (family(ca) === "eng-civil" && family(cb) === "eng-civil") return false;
  return true;
}
