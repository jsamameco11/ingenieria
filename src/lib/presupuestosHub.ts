export type PresuTab =
  | "resumen"
  | "pdf"
  | "revit"
  | "apu"
  | "nube"
  | "formula"
  | "cronograma"
  | "valorizaciones"
  | "eett"
  | "jornales";

export type PresuModulo = {
  id: PresuTab;
  code: string;
  title: string;
  short: string;
  blurb: string;
  incluye: string[];
  acceso: string;
  slug: string;
};

export const PRESU_MODULOS: PresuModulo[] = [
  {
    id: "pdf",
    code: "PRE-00",
    title: "Presupuesto desde PDF",
    short: "Desde PDF",
    blurb: "El agente lee el plano por especialidad, confronta el catálogo MemoriaCalc y metra. No inventa partidas.",
    incluye: ["Lectura por especialidad", "Catálogo propio, sin códigos inventados", "P.U. del programa", "S/ 4 por hoja (IA)"],
    acceso: "S/ 4 por hoja",
    slug: "presupuesto-pdf",
  },
  {
    id: "revit",
    code: "PRE-0R",
    title: "Vincular con Revit",
    short: "Revit",
    blurb: "Elija la plantilla, conecte el modelo y una cada elemento con su partida y metrado antes de cargar el presupuesto.",
    incluye: ["Emparejado elemento–partida", "Metrado desde el modelo", "Plantillas de expediente", "Carga al APU"],
    acceso: "Plan Pro",
    slug: "vincular-revit",
  },
  {
    id: "apu",
    code: "PRE-01",
    title: "Hoja de Presupuesto",
    short: "Hoja de Presupuesto",
    blurb: "Catálogo RN Metrados, análisis de precios unitarios (mano de obra, materiales, maquinaria) e insumos con código IU.",
    incluye: ["Catálogo RN / CAPECO", "APU completo", "Índices unificados", "Hojas de presupuesto"],
    acceso: "Libre",
    slug: "presupuestos",
  },
  {
    id: "nube",
    code: "PRE-04",
    title: "Mis presupuestos",
    short: "Nube",
    blurb: "Biblioteca en la nube e invitaciones a colegas. Una cuenta, un equipo.",
    incluye: ["Archivo en la nube", "Invitaciones a colegas", "Historial de obras", "Requiere Plan Pro"],
    acceso: "Plan Pro",
    slug: "mis-presupuestos",
  },
  {
    id: "formula",
    code: "PRE-02",
    title: "Fórmula polinómica",
    short: "Fórmula",
    blurb: "Incidencias por índice unificado INEI, monomios a–h, factor K y valorización reajustada (D.S. 011-79-VC).",
    incluye: ["Monomios a–h", "Índices INEI", "Factor K", "Valorización reajustada"],
    acceso: "Libre",
    slug: "formula-polinomica",
  },
  {
    id: "cronograma",
    code: "PRE-03",
    title: "Cronograma de obra",
    short: "Cronograma",
    blurb: "Desglose de partidas, calendario laboral, feriados, rendimientos, CPM y diagrama de Gantt.",
    incluye: ["Calendario y feriados", "Rendimientos", "Ruta crítica CPM", "Gantt de obra", "Red PERT-CPM", "Curva S"],
    acceso: "Libre",
    slug: "cronograma",
  },
  {
    id: "valorizaciones",
    code: "PRE-07",
    title: "Valorizaciones",
    short: "Valorizaciones",
    blurb: "Valorizaciones mensuales, bimestrales o trimestrales con adicionales de obra, reajuste por índices unificados e informe legal del adicional.",
    incluye: ["Adicionales de obra + informe legal", "Reajuste por índices unificados (K)", "Importar del presupuesto o Excel", "Curva S programado vs ejecutado"],
    acceso: "Libre",
    slug: "valorizaciones",
  },
  {
    id: "eett",
    code: "PRE-05",
    title: "Especificaciones técnicas",
    short: "EETT",
    blurb: "Ficha de expediente por partida: definición, alcance, APU, procedimiento, medición, pago y normas. Impresión A4.",
    incluye: ["Ficha por partida", "Alcance y procedimiento", "Medición y forma de pago", "Impresión formal"],
    acceso: "Libre",
    slug: "especificaciones",
  },
  {
    id: "jornales",
    code: "PRE-06",
    title: "Mano de obra y jornales",
    short: "Jornales",
    blurb: "Desglose CAPECO–FTCCP del operario, oficial, peón, capataz, topógrafo y operador: BUC, vestimenta, escolaridad, gratificaciones, CTS y aportes.",
    incluye: ["Jornales CAPECO–FTCCP", "BUC y beneficios", "CTS y aportes", "Impresión de hojas"],
    acceso: "Libre",
    slug: "mano-obra",
  },
];

export const PRESU_TABS: { id: PresuTab; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  ...PRESU_MODULOS.map((m) => ({ id: m.id, label: m.short })),
];

export const PRESU_SLUG_TO_TAB: Record<string, PresuTab> = Object.fromEntries(
  PRESU_MODULOS.map((m) => [m.slug, m.id]),
) as Record<string, PresuTab>;

export function tabFromSlug(slug: string): PresuTab | null {
  return PRESU_SLUG_TO_TAB[slug] ?? null;
}

export function parsePresuPath(pathname: string): PresuTab | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean !== "/presupuestos" && !clean.startsWith("/presupuestos/")) return null;
  const rest = clean.slice("/presupuestos".length).replace(/^\//, "");
  if (!rest) return "resumen";
  return PRESU_TABS.some((t) => t.id === rest) ? (rest as PresuTab) : "resumen";
}

export function presuHref(tab: PresuTab) {
  return tab === "resumen" ? "/presupuestos" : `/presupuestos/${tab}`;
}
