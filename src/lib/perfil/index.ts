export { EXTRACTOR_VERSION, NORMALIZER_VERSION, TAXONOMY_VERSION } from "./types";
export { extractFromEvent, extractFromProfile, extractFreeText } from "./extract";
export { ingestObservedEvent, ingestOnboarding } from "./pipeline";
export { fetchProfileEvidence, fetchScoreExplanation, fetchUser360, recalculateProfile } from "./client";
export { extractionDebugEnabled, readDebugFrames } from "./debug";
export { detectProfessionConflict, parseYears, resolveAlias, resolveAllAliases } from "./taxonomy";
export { normalizeAnswer } from "./normalize";
export { localCompleteness } from "./completeness";
export { explainFromContributions } from "./explain";
