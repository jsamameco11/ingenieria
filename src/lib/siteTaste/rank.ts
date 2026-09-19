export type TasteScore = { category: string; score: number };

const RUBRO_TO_STORE: Record<string, string> = {
  estructuras: "Construcción",
  puentes: "Construcción",
  hidraulica: "Construcción",
  hidrologia: "Construcción",
  saneamiento: "Construcción",
  geotecnia: "Construcción",
  viales: "Construcción",
  pavimentos: "Construcción",
  mezclas: "Construcción",
  presupuestos: "Oficina",
  tasaciones: "Servicios",
  topografia: "Construcción",
  "mov-tierras": "Construcción",
  instalaciones: "Construcción",
  concreto: "Construcción",
  acero: "Construcción",
  arquitectura: "Diseño",
  bim: "Software",
  software: "Software",
  capacitacion: "Educación",
};

export function storeCategoryFromRubro(rubro: string): string {
  return RUBRO_TO_STORE[rubro] || "";
}

export function mergeTasteScores(parts: TasteScore[][]): TasteScore[] {
  const map = new Map<string, number>();
  for (const list of parts) {
    for (const row of list) {
      if (!row.category) continue;
      map.set(row.category, (map.get(row.category) || 0) + Number(row.score || 0));
    }
  }
  return [...map.entries()]
    .map(([category, score]) => ({ category, score }))
    .sort((a, b) => b.score - a.score);
}

export function rankByCategory<T extends { category?: string; name?: string; description?: string }>(
  items: T[],
  tastes: TasteScore[],
): T[] {
  if (!tastes.length) return items;
  const weight = new Map(tastes.map((t) => [t.category.toLowerCase(), t.score]));
  const max = Math.max(...tastes.map((t) => t.score), 1);
  return items
    .map((item, index) => {
      const cat = String(item.category || "").toLowerCase();
      const blob = `${item.name || ""} ${item.description || ""}`.toLowerCase();
      let score = (weight.get(cat) || 0) / max;
      for (const [key, w] of weight) {
        if (key && blob.includes(key)) score += 0.35 * (w / max);
      }
      return { item, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item);
}

export function similarLabel(tastes: TasteScore[]): string {
  const top = tastes.filter((t) => t.score > 0).slice(0, 3).map((t) => t.category);
  if (!top.length) return "";
  return `Priorizado según su perfil y lo que consulta: ${top.join(", ")}.`;
}
