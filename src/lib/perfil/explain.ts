export type ScoreContribution = {
  evidence_id?: string;
  kind: string;
  weight_code: string;
  confidence: number;
  text: string;
  created_at?: string;
};

export function explainFromContributions(
  catalog: string,
  score: number | null,
  rows: ScoreContribution[],
): { catalog: string; score: number | null; why: string[] } {
  const why: string[] = [];
  const declared = rows.filter((r) => r.kind === "declared").length;
  const observed = rows.filter((r) => r.kind === "observed").length;
  const extracted = rows.filter((r) => r.kind === "extracted").length;
  const tools = rows.filter((r) => /TOOL|etabs|revit|excel/i.test(`${r.weight_code} ${r.text}`)).length;
  if (declared) why.push(`${declared} declaración(es) explícitas`);
  if (observed) why.push(`${observed} observación(es) de uso en la plataforma`);
  if (extracted) why.push(`${extracted} valor(es) extraídos de respuestas`);
  if (tools) why.push(`${tools} usos de herramientas relacionadas`);
  if (!why.length) why.push("Aún no hay evidencia suficiente para explicar este score.");
  return { catalog, score, why };
}
