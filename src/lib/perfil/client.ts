import { folio } from "../folio";
import type { ExtractionPacket } from "./types";

export type User360Bundle = Record<string, unknown>;

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await folio.rpc(name, args);
  if (error) {
    if (/schema cache|does not exist|42P01|PGRST/i.test(error.message)) {
      return { ok: false, skipped: true, message: error.message } as T;
    }
    throw error;
  }
  return data as T;
}

export async function submitExtraction(packet: ExtractionPacket): Promise<Record<string, unknown>> {
  return rpc("submit_platform_extraction", {
    p_platform_code: packet.platform_code,
    p_source_type: packet.source_type,
    p_module_id: packet.module_id,
    p_answers: packet.answers,
    p_evidence: packet.evidence,
    p_extractor_version: packet.extractor_version,
    p_debug: packet.debug,
  });
}

export async function fetchUser360(userId?: string): Promise<User360Bundle> {
  return rpc("get_user_360_bundle", userId ? { p_user: userId } : {});
}

export async function fetchProfileEvidence(userId?: string, limit = 80): Promise<unknown> {
  return rpc("get_profile_evidence", userId ? { p_user: userId, p_limit: limit } : { p_limit: limit });
}

export async function recalculateProfile(userId?: string): Promise<Record<string, unknown>> {
  const agg = await rpc<Record<string, unknown>>("aggregate_user_profile_from_evidence", userId ? { p_user: userId } : {});
  const complete = await rpc<Record<string, unknown>>("recalculate_profile_completeness", userId ? { p_user: userId } : {});
  return { ...agg, ...complete };
}

export async function fetchScoreExplanation(catalog: string, userId?: string): Promise<Record<string, unknown>> {
  return rpc("explain_interest_score", userId ? { p_catalog_code: catalog, p_user: userId } : { p_catalog_code: catalog });
}

export async function recordWorkRole(position: string, organization?: string): Promise<Record<string, unknown>> {
  return rpc("record_work_role_change", {
    p_position: position,
    p_organization: organization || null,
    p_source: "DECLARED",
  });
}
