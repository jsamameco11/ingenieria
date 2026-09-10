import type { UsageEvent, UserInsight, WorkplaceRole } from "./types";

const MODULE_RUBRO: Record<string, string> = {
  hidraulica: "hidraulica",
  hidrologia: "hidrologia",
  "hidro-estudio": "hidrologia",
  "hidro-puente": "hidrologia",
  "hidro-defensa": "hidrologia",
  "hidro-baden": "hidrologia",
  "hidro-mineria": "hidrologia",
  "hidro-bocatoma-est": "hidrologia",
  "hidro-industrial": "hidrologia",
  canaleta: "hidraulica",
  canal: "hidraulica",
  sifon: "hidraulica",
  "alcantarilla-hid": "hidraulica",
  cuneta: "hidraulica",
  desarenador: "hidraulica",
  bocatoma: "hidraulica",
  rapida: "hidraulica",
  aliviadero: "hidraulica",
  acueducto: "hidraulica",
  riego: "hidraulica",
  orificio: "hidraulica",
  "agua-potable": "saneamiento",
  "ap-dotacion": "saneamiento",
  "ap-sistema": "saneamiento",
  "ap-sedimentador": "saneamiento",
  "ap-prefiltro": "saneamiento",
  "ap-filtro-lento": "saneamiento",
  "ap-impulsion": "saneamiento",
  "ap-reservorio": "saneamiento",
  "ap-cloracion": "saneamiento",
  "ap-red": "saneamiento",
  topografia: "topografia",
  taquimetro: "topografia",
  "libreta-topo": "topografia",
  "mov-tierras": "mov-tierras",
  "seccion-transversal": "mov-tierras",
  "volumenes-tierras": "mov-tierras",
  presupuestos: "presupuestos",
  "presupuesto-pdf": "presupuestos",
  "vincular-revit": "presupuestos",
  "mis-presupuestos": "presupuestos",
  "formula-polinomica": "presupuestos",
  cronograma: "presupuestos",
  edificaciones: "estructuras",
  puentes: "puentes",
  geotecnia: "geotecnia",
  saneamiento: "saneamiento",
  carreteras: "viales",
  "acb-caminos": "viales",
  pavimentos: "pavimentos",
  mezclas: "mezclas",
  "diseno-mezcla-aci": "mezclas",
  "diseno-mezcla-walker": "mezclas",
  "diseno-mezcla-inverso": "mezclas",
  "ajuste-triangular": "mezclas",
  "mezcla-ejecucion": "mezclas",
  instalaciones: "electricas",
  tasaciones: "tasaciones",
  "tasacion-inmueble": "tasaciones",
  "tasacion-terreno": "tasaciones",
  analisis: "estructuras",
};

const CONTRACTOR_MODULES = new Set([
  "presupuestos",
  "presupuesto-pdf",
  "vincular-revit",
  "mis-presupuestos",
  "formula-polinomica",
  "cronograma",
  "acb-caminos",
  "costo-horario",
]);

const DESIGNER_HINTS = [
  "estructuras",
  "puentes",
  "hidraulica",
  "hidrologia",
  "saneamiento",
  "geotecnia",
  "pavimentos",
  "mezclas",
];

export function rubroOf(slug: string, specialty = ""): string {
  return MODULE_RUBRO[slug] || MODULE_RUBRO[specialty] || specialty || "general";
}

function ageBand(age: number | null): string {
  if (!age) return "";
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  if (age < 65) return "55-64";
  return "65+";
}

export function analyzeUsage(
  events: UsageEvent[],
  declared: { workplace_role?: string; specialty_focus?: string[]; profession_id?: string; age?: number | null },
): UserInsight {
  const rubros: Record<string, number> = {};
  const modules: Record<string, number> = {};
  let contractor = 0;
  let designer = 0;
  let tasador = 0;
  let edits = 0;
  let views = 0;

  for (const ev of events) {
    const w =
      ev.event_type === "heartbeat" || ev.event_type === "dwell"
        ? 0.2
        : ev.event_type === "click"
          ? 0.7
          : ev.event_type === "quota_use"
            ? 2.4
            : ev.event_type === "edit_field"
              ? 2.2
              : ev.event_type === "save"
                ? 1.6
                : 1;
    const rubro = rubroOf(ev.module_slug, ev.specialty);
    rubros[rubro] = (rubros[rubro] || 0) + w;
    if (ev.module_slug) modules[ev.module_slug] = (modules[ev.module_slug] || 0) + w;
    if (CONTRACTOR_MODULES.has(ev.module_slug)) contractor += w;
    if (DESIGNER_HINTS.includes(rubro)) designer += w;
    if (rubro === "tasaciones") tasador += w;
    if (ev.event_type === "edit_field") edits += 1;
    if (ev.event_type === "view_module") views += 1;
  }

  for (const id of declared.specialty_focus ?? []) {
    rubros[id] = (rubros[id] || 0) + 2.5;
  }

  const role_scores: Record<string, number> = {
    contratista: contractor + (declared.workplace_role === "contratista" ? 8 : 0),
    proyectista: designer + (declared.workplace_role === "proyectista" ? 8 : 0),
    residente: contractor * 0.6 + designer * 0.4 + (declared.workplace_role === "residente" ? 8 : 0),
    supervisor: contractor * 0.5 + designer * 0.5 + (declared.workplace_role === "supervisor" ? 8 : 0),
    tasador: tasador * 2 + (declared.workplace_role === "tasador" ? 8 : 0),
    estudiante: (declared.workplace_role === "estudiante" || declared.profession_id === "estudiante" ? 8 : 0) + (views > edits * 3 ? 2 : 0),
    docente: declared.workplace_role === "docente" ? 8 : 0,
    funcionario: declared.workplace_role === "funcionario" ? 8 : 0,
  };

  const rankedRoles = Object.entries(role_scores).sort((a, b) => b[1] - a[1]);
  const role_guess = rankedRoles[0]?.[0] || declared.workplace_role || "proyectista";
  const top_modules = Object.entries(modules)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k);
  const topRubros = Object.entries(rubros)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const total = Object.values(role_scores).reduce((s, n) => s + n, 0) || 1;
  const confidence = Math.min(0.97, 0.28 + Math.min(events.length, 40) / 80 + (rankedRoles[0]?.[1] || 0) / (total * 1.4));

  const labels: Record<string, string> = {
    contratista: "contratista / ejecutor",
    proyectista: "proyectista / consultor",
    residente: "residente de obra",
    supervisor: "supervisor de obra",
    tasador: "tasador",
    estudiante: "estudiante",
    docente: "docente",
    funcionario: "funcionario público",
  };
  const rubroLabels: Record<string, string> = {
    estructuras: "estructuras",
    puentes: "puentes",
    hidraulica: "hidráulica",
    hidrologia: "hidrología",
    saneamiento: "agua y saneamiento",
    geotecnia: "geotecnia",
    viales: "carreteras",
    pavimentos: "pavimentos",
    mezclas: "diseño de mezclas",
    presupuestos: "presupuestos y APU",
    tasaciones: "tasaciones",
    topografia: "topografía",
    electricas: "instalaciones eléctricas",
    "mov-tierras": "movimiento de tierras",
  };
  const rubroTxt = topRubros.map(([id]) => rubroLabels[id] || id).join(", ") || "aún sin rubro dominante";
  const band = ageBand(declared.age ?? null);
  const summary = [
    `Perfil de uso: ${labels[role_guess] || role_guess}`,
    `Rubros: ${rubroTxt}`,
    band ? `Franja de edad ${band}` : "",
    `${events.length} señales de navegación`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    role_guess,
    role_scores,
    rubros,
    top_modules,
    contractor_score: contractor,
    designer_score: designer,
    confidence,
    summary,
  };
}

export function roleLabel(role: string): string {
  const map: Record<WorkplaceRole | string, string> = {
    proyectista: "Proyectista",
    contratista: "Contratista",
    residente: "Residente",
    supervisor: "Supervisor",
    tasador: "Tasador",
    funcionario: "Funcionario",
    docente: "Docente",
    estudiante: "Estudiante",
    proveedor: "Proveedor",
    gerente: "Gerente de proyecto",
    otro: "Otro",
  };
  return map[role] || role;
}
