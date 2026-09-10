import type { UsageEvent, UserProfile } from "../auth/types";
import {
  interestFromRubro,
  interestFromSpecialty,
  knownProfessionLabel,
  knownRoleLabel,
  knownRubroLabel,
  parseYears,
  professionFromOnboarding,
  resolveAllAliases,
  skillFromRole,
  technologyFromModule,
} from "./taxonomy";
import { normalizeAnswer } from "./normalize";
import { EXTRACTOR_VERSION, type AnswerDraft, type EvidenceDraft, type ExtractionPacket, type PipelineDebug } from "./types";

const FORBIDDEN = new Set([
  "religion",
  "race",
  "ethnicity",
  "sexual_orientation",
  "health_condition",
  "political_affiliation",
  "ideology",
  "password",
  "credential",
]);

function push(list: EvidenceDraft[], item: EvidenceDraft) {
  if (!item.catalog_code || FORBIDDEN.has(item.catalog_code)) return;
  list.push(item);
}

function answersFromProfile(profile: UserProfile): AnswerDraft[] {
  const out: AnswerDraft[] = [];
  const add = (question_id: string, raw: unknown, hint: "TEXT" | "NUMBER" | "TEXT[]" | "AUTO" = "AUTO") => {
    if (raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0)) return;
    const normalized = normalizeAnswer(raw, hint);
    if (normalized.data_type === "EMPTY") return;
    out.push({
      question_id,
      module_id: "onboarding",
      raw_answer: Array.isArray(raw) ? raw.join(", ") : String(raw),
      source_type: "QUESTION",
      normalized,
    });
  };
  add("q.craft_family", profile.craft_family);
  add("q.profession", profile.profession_label || profile.profession_id);
  add("q.age", profile.age, "NUMBER");
  if (profile.sex && profile.sex !== "Prefiero no decir") add("q.sex", profile.sex);
  add("q.experience_years", profile.experience_years, "NUMBER");
  add("q.phone", profile.phone);
  add("q.workplace_role", profile.workplace_role);
  add("q.practice_mode", profile.practice_mode);
  add("q.cip", profile.cip);
  add("q.organization", profile.organization);
  add("q.university", profile.university);
  add("q.country", profile.country);
  add("q.department", profile.department);
  add("q.province", profile.province);
  add("q.district", profile.district);
  add("q.specialty_focus", profile.specialty_focus, "TEXT[]");
  return out;
}

export function extractFromProfile(profile: UserProfile): ExtractionPacket {
  const evidence: EvidenceDraft[] = [];
  const answers = answersFromProfile(profile);
  const mapped = professionFromOnboarding(profile.profession_id, profile.profession_label);
  if (mapped?.profession) {
    push(evidence, {
      catalog_code: mapped.profession,
      target_type: "profession",
      evidence_kind: "declared",
      strength: 1,
      confidence: 0.99,
      evidence_text: profile.profession_label || knownProfessionLabel(profile.profession_id),
      source_type: "QUESTION",
      interaction_level: "EXPLICIT",
      weight_code: "PROFILE_FORM",
      rule_id: "onboarding.profession",
    });
  }
  if (mapped?.specialization) {
    push(evidence, {
      catalog_code: mapped.specialization,
      target_type: "specialization",
      evidence_kind: "declared",
      strength: 0.95,
      confidence: 0.97,
      evidence_text: profile.profession_label,
      source_type: "QUESTION",
      interaction_level: "EXPLICIT",
      weight_code: "PROFILE_FORM",
      rule_id: "onboarding.specialization-from-profession",
    });
    push(evidence, {
      catalog_code: mapped.specialization,
      target_type: "interest",
      evidence_kind: "declared",
      strength: 0.8,
      confidence: 0.9,
      evidence_text: profile.profession_label,
      source_type: "QUESTION",
      interaction_level: "EXPLICIT",
      weight_code: "EXPLICIT_INTEREST",
      rule_id: "onboarding.interest-from-specialty",
    });
  }
  const years = profile.experience_years != null ? { years: profile.experience_years, confidence: 0.98 } : parseYears(String(profile.experience_years ?? ""));
  if (years) {
    push(evidence, {
      catalog_code: "years_of_experience",
      target_type: "experience",
      evidence_kind: "declared",
      strength: 1,
      confidence: years.confidence,
      evidence_text: String(years.years),
      source_type: "QUESTION",
      interaction_level: "EXPLICIT",
      weight_code: "QUESTION_ANSWERED",
      rule_id: "onboarding.years",
    });
  }
  if (profile.workplace_role) {
    const skill = skillFromRole(profile.workplace_role);
    push(evidence, {
      catalog_code: profile.workplace_role,
      target_type: "role",
      evidence_kind: "declared",
      strength: 1,
      confidence: 0.98,
      evidence_text: knownRoleLabel(profile.workplace_role),
      source_type: "QUESTION",
      interaction_level: "EXPLICIT",
      weight_code: "PROFILE_FORM",
      rule_id: "onboarding.role",
    });
    if (skill) {
      push(evidence, {
        catalog_code: skill,
        target_type: "skill",
        evidence_kind: "extracted",
        strength: 0.85,
        confidence: 0.88,
        evidence_text: knownRoleLabel(profile.workplace_role),
        source_type: "QUESTION",
        interaction_level: "HIGH",
        weight_code: "QUESTION_ANSWERED",
        rule_id: "onboarding.role-skill",
      });
    }
  }
  if (profile.practice_mode) {
    push(evidence, {
      catalog_code: `practice_${profile.practice_mode}`,
      target_type: "preference",
      evidence_kind: "declared",
      strength: 1,
      confidence: 0.97,
      evidence_text: profile.practice_mode,
      source_type: "QUESTION",
      interaction_level: "EXPLICIT",
      weight_code: "PROFILE_FORM",
      rule_id: "onboarding.practice",
    });
  }
  if (profile.university) {
    push(evidence, {
      catalog_code: "university",
      target_type: "education",
      evidence_kind: "declared",
      strength: 0.9,
      confidence: 0.93,
      evidence_text: profile.university,
      source_type: "QUESTION",
      interaction_level: "EXPLICIT",
      weight_code: "QUESTION_ANSWERED",
      rule_id: "onboarding.university",
    });
  }
  if (profile.organization) {
    push(evidence, {
      catalog_code: "organization",
      target_type: "organization",
      evidence_kind: "declared",
      strength: 0.85,
      confidence: 0.9,
      evidence_text: profile.organization,
      source_type: "QUESTION",
      interaction_level: "EXPLICIT",
      weight_code: "QUESTION_ANSWERED",
      rule_id: "onboarding.org",
    });
  }
  if (profile.country) {
    push(evidence, {
      catalog_code: "country",
      target_type: "location",
      evidence_kind: "declared",
      strength: 1,
      confidence: 0.99,
      evidence_text: profile.country,
      source_type: "QUESTION",
      interaction_level: "EXPLICIT",
      weight_code: "PROFILE_FORM",
      rule_id: "onboarding.country",
    });
  }
  for (const rubro of profile.specialty_focus || []) {
    const code = interestFromRubro(rubro);
    if (!code) continue;
    push(evidence, {
      catalog_code: code,
      target_type: "interest",
      evidence_kind: "declared",
      strength: 0.92,
      confidence: 0.96,
      evidence_text: knownRubroLabel(rubro),
      source_type: "QUESTION",
      interaction_level: "EXPLICIT",
      weight_code: "EXPLICIT_INTEREST",
      rule_id: "onboarding.rubro",
    });
    if (code.startsWith("eng-civil-") || code.startsWith("arch-")) {
      push(evidence, {
        catalog_code: code,
        target_type: "specialization",
        evidence_kind: "extracted",
        strength: 0.7,
        confidence: 0.8,
        evidence_text: knownRubroLabel(rubro),
        source_type: "QUESTION",
        interaction_level: "HIGH",
        weight_code: "QUESTION_ANSWERED",
        rule_id: "onboarding.rubro-spec",
      });
    }
  }
  const debug: PipelineDebug = {
    input: `onboarding:${profile.profession_id}:${(profile.specialty_focus || []).join(",")}`,
    normalized: normalizeAnswer(profile.profession_label || profile.profession_id),
    extracted: evidence,
    matched: evidence.map((e) => e.catalog_code),
    confidence: evidence.map((e) => e.confidence),
    signals: evidence.map((e) => `${e.target_type}:${e.catalog_code}:${e.evidence_kind}`),
  };
  return {
    platform_code: "INGENIERIA",
    source_type: "QUESTION",
    module_id: "onboarding",
    answers,
    evidence,
    extractor_version: EXTRACTOR_VERSION,
    debug,
  };
}

export function extractFromEvent(ev: UsageEvent): ExtractionPacket | null {
  const skip = new Set(["heartbeat", "click", "dwell", "session_start", "edit_field"]);
  if (skip.has(ev.event_type)) return null;
  const evidence: EvidenceDraft[] = [];
  const answers: AnswerDraft[] = [];
  const interest = interestFromSpecialty(ev.specialty) || interestFromSpecialty(ev.module_slug);
  const tech = technologyFromModule(ev.module_slug) || (ev.meta?.tool ? String(ev.meta.tool) : "");
  const isCalc = ev.event_type === "quota_use" || ev.event_type === "save";
  const isExport = ev.event_type === "export" || ev.event_type === "print";
  const isView = ev.event_type === "view_module";
  const toolHint = String(ev.meta?.tool || ev.meta?.action || "");

  if (isView && ev.module_slug) {
    answers.push({
      question_id: "q.module_used",
      module_id: ev.module_slug,
      raw_answer: ev.module_slug,
      source_type: "EVENT",
      normalized: normalizeAnswer(ev.module_slug, "TEXT"),
    });
  }
  if (interest) {
    push(evidence, {
      catalog_code: interest,
      target_type: "interest",
      evidence_kind: "observed",
      strength: isCalc ? 0.55 : isExport ? 0.5 : 0.28,
      confidence: isCalc ? 0.62 : isExport ? 0.58 : 0.42,
      evidence_text: `${ev.event_type}:${ev.module_slug}`,
      source_type: "EVENT",
      interaction_level: isCalc ? "MEDIUM" : isExport ? "MEDIUM" : "LOW",
      weight_code: isCalc ? "CALCULATION_COMPLETED" : isExport ? "DOCUMENT_EXPORTED" : "MODULE_VIEW",
      rule_id: `event.${ev.event_type}`,
    });
  }
  const techCode = tech === "etabs" || tech === "revit" || tech === "excel" || tech === "msproject" ? tech : toolHint === "etabs" ? "etabs" : "";
  if (techCode) {
    push(evidence, {
      catalog_code: techCode,
      target_type: "technology",
      evidence_kind: "observed",
      strength: toolHint === "etabs" || toolHint.includes("paste") ? 0.55 : 0.35,
      confidence: 0.45,
      evidence_text: `${ev.module_slug}:${toolHint || "use"}`,
      source_type: "CALCULATOR",
      interaction_level: "MEDIUM",
      weight_code: "TOOL_USED",
      rule_id: "event.tool-observed-not-expert",
    });
    answers.push({
      question_id: "q.software_observed",
      module_id: ev.module_slug,
      raw_answer: techCode,
      source_type: "EVENT",
      normalized: normalizeAnswer(techCode, "TEXT"),
    });
  }
  if (isCalc) {
    answers.push({
      question_id: "q.calculation_completed",
      module_id: ev.module_slug,
      raw_answer: ev.module_slug,
      source_type: "CALCULATOR",
    });
  }
  if (isExport) {
    answers.push({
      question_id: "q.document_exported",
      module_id: ev.module_slug,
      raw_answer: ev.event_type,
      source_type: "EVENT",
    });
  }
  if (!evidence.length && !answers.length) return null;
  const debug: PipelineDebug = {
    input: `${ev.event_type}:${ev.module_slug}:${ev.specialty}`,
    normalized: normalizeAnswer(ev.module_slug),
    extracted: evidence,
    matched: evidence.map((e) => e.catalog_code),
    confidence: evidence.map((e) => e.confidence),
    signals: evidence.map((e) => `${e.target_type}:${e.catalog_code}:${e.evidence_kind}`),
  };
  return {
    platform_code: "INGENIERIA",
    source_type: isCalc ? "CALCULATOR" : "EVENT",
    module_id: ev.module_slug || "app",
    answers,
    evidence,
    extractor_version: EXTRACTOR_VERSION,
    debug,
  };
}

export function extractFreeText(raw: string): EvidenceDraft[] {
  const evidence: EvidenceDraft[] = [];
  const years = parseYears(raw);
  if (years) {
    push(evidence, {
      catalog_code: "years_of_experience",
      target_type: "experience",
      evidence_kind: "extracted",
      strength: 0.9,
      confidence: years.confidence,
      evidence_text: String(years.years),
      source_type: "QUESTION",
      interaction_level: "HIGH",
      weight_code: "QUESTION_ANSWERED",
      rule_id: "text.years",
    });
  }
  for (const type of ["profession", "technology", "interest", "role"] as const) {
    const codes = resolveAllAliases(type, raw);
    for (const code of codes) {
    if (type === "profession" && code.startsWith("eng-civil-") && code !== "eng-civil") {
      push(evidence, {
        catalog_code: "eng-civil",
        target_type: "profession",
        evidence_kind: "extracted",
        strength: 0.75,
        confidence: 0.8,
        evidence_text: raw.slice(0, 180),
        source_type: "QUESTION",
        interaction_level: "HIGH",
        weight_code: "QUESTION_ANSWERED",
        rule_id: "text.profession-family",
      });
      push(evidence, {
        catalog_code: code,
        target_type: "specialization",
        evidence_kind: "extracted",
        strength: 0.8,
        confidence: 0.78,
        evidence_text: raw.slice(0, 180),
        source_type: "QUESTION",
        interaction_level: "HIGH",
        weight_code: "QUESTION_ANSWERED",
        rule_id: "text.specialization",
      });
      continue;
    }
    const target: EvidenceDraft["target_type"] =
      type === "profession" ? "profession" : type === "technology" ? "technology" : type === "role" ? "role" : "interest";
    push(evidence, {
      catalog_code: code,
      target_type: target,
      evidence_kind: "extracted",
      strength: 0.7,
      confidence: 0.72,
      evidence_text: raw.slice(0, 180),
      source_type: "QUESTION",
      interaction_level: "HIGH",
      weight_code: "QUESTION_ANSWERED",
      rule_id: `text.${type}`,
    });
    }
  }
  return evidence;
}
