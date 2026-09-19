import { folio } from "../folio";
import { emailKeywordsFrom } from "./emailKeywords";
import type { TasteScore } from "./rank";

export async function saveSiteOnboarding(input: {
  platform: string;
  answers: Record<string, unknown>;
  email?: string;
}): Promise<void> {
  const keywords = emailKeywordsFrom(input.email || String(input.answers.email || ""));
  const { error } = await folio.rpc("save_site_onboarding", {
    p_platform_code: input.platform,
    p_answers: { ...input.answers, email_keywords: keywords },
    p_email_keywords: keywords,
  });
  if (error && !/schema cache|does not exist|42P01|PGRST/i.test(error.message)) throw error;
}

export async function fetchSiteOnboarding(platform: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await folio
    .from("site_onboarding")
    .select("answers,email_keywords,completed_at")
    .eq("platform_code", platform)
    .maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function recordSiteBehavior(input: {
  platform: string;
  kind: "click" | "search" | "category" | "view";
  category?: string;
  query?: string;
  target?: string;
  weight?: number;
}): Promise<void> {
  const { error } = await folio.rpc("record_site_behavior", {
    p_platform_code: input.platform,
    p_kind: input.kind,
    p_category: input.category || null,
    p_query: input.query || null,
    p_target: input.target || null,
    p_weight: input.weight ?? 1,
  });
  if (error && !/schema cache|does not exist|42P01|PGRST/i.test(error.message)) {
    /* silencioso: la señal no debe romper la vitrina */
  }
}

export async function fetchMyTastes(platform: string): Promise<TasteScore[]> {
  const { data, error } = await folio.rpc("get_my_site_tastes", { p_platform_code: platform });
  if (error || !Array.isArray(data)) return [];
  return (data as TasteScore[]).map((row) => ({
    category: String(row.category || ""),
    score: Number(row.score || 0),
  }));
}
