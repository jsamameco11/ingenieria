import type { NormalizedAnswer } from "./types";
import { foldAlias } from "./taxonomy";

export function normalizeAnswer(raw: unknown, hint: "TEXT" | "NUMBER" | "TEXT[]" | "AUTO" = "AUTO"): NormalizedAnswer {
  if (raw == null) return { value: null, data_type: "EMPTY", confidence: 1 };
  if (Array.isArray(raw)) {
    const values = raw.map((x) => String(x).trim()).filter(Boolean);
    if (!values.length) return { value: null, data_type: "EMPTY", confidence: 1 };
    return { value: values, data_type: "TEXT[]", confidence: 0.99 };
  }
  const text = String(raw).trim();
  if (!text) return { value: null, data_type: "EMPTY", confidence: 1 };
  if (hint === "TEXT") return { value: text, data_type: "TEXT", confidence: 0.99 };
  if (hint === "NUMBER" || hint === "AUTO") {
    const compact = text.replace(",", ".");
    const n = Number(compact);
    if (hint === "NUMBER" && Number.isFinite(n)) {
      return { value: n, unit: /año|anio|year/i.test(text) ? "years" : undefined, data_type: "NUMBER", confidence: 0.98 };
    }
    if (hint === "AUTO" && /^-?\d+(?:[.,]\d+)?$/.test(text) && Number.isFinite(n)) {
      return { value: n, data_type: "NUMBER", confidence: 0.97 };
    }
  }
  return { value: text, data_type: "TEXT", confidence: 0.95 };
}

export function normalizeToken(raw: string): string {
  return foldAlias(raw);
}
