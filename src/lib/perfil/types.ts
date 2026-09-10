export const EXTRACTOR_VERSION = "INGENIERIA-EXTRACTOR-1.0.0";
export const NORMALIZER_VERSION = "INGENIERIA-NORMALIZER-1.0.0";
export const TAXONOMY_VERSION = "tax-1.1.0-ingenieria";

export type EvidenceKind = "declared" | "extracted" | "observed" | "inferred" | "verified" | "imported" | "system";
export type TargetType =
  | "interest"
  | "profession"
  | "skill"
  | "technology"
  | "education"
  | "experience"
  | "intention"
  | "goal"
  | "preference"
  | "document_type"
  | "keyword"
  | "entity"
  | "industry"
  | "identity"
  | "role"
  | "organization"
  | "location"
  | "specialization";

export type InteractionLevel = "PASSIVE" | "LOW" | "MEDIUM" | "HIGH" | "EXPLICIT";

export type NormalizedAnswer = {
  value: string | number | string[] | null;
  unit?: string;
  data_type: "TEXT" | "NUMBER" | "TEXT[]" | "EMPTY";
  confidence: number;
};

export type EvidenceDraft = {
  catalog_code: string;
  target_type: TargetType;
  evidence_kind: EvidenceKind;
  strength: number;
  confidence: number;
  evidence_text: string;
  source_type: string;
  interaction_level: InteractionLevel;
  weight_code: string;
  rule_id: string;
};

export type AnswerDraft = {
  question_id: string;
  module_id?: string;
  raw_answer: string;
  source_type?: string;
  normalized?: NormalizedAnswer;
  extracted?: Record<string, unknown>;
};

export type PipelineDebug = {
  input: string;
  normalized: NormalizedAnswer | null;
  extracted: EvidenceDraft[];
  matched: string[];
  confidence: number[];
  signals: string[];
};

export type ExtractionPacket = {
  platform_code: string;
  source_type: string;
  module_id: string;
  answers: AnswerDraft[];
  evidence: EvidenceDraft[];
  extractor_version: string;
  debug: PipelineDebug;
};
