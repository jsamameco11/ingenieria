import { useMemo } from "react";
import katex from "katex";
import { asciiFormulaToTex, looksLikeMathLine, stackDisplayTex } from "../lib/tex";

/**
 * Fórmula profesional en KaTeX (modo display, ecuaciones apiladas).
 * Si no hay LaTeX, convierte el texto del motor. Sirve en pantalla y al imprimir.
 */
export function Formula({ tex, fallback, display = true }: { tex?: string; fallback?: string; display?: boolean }) {
  const html = useMemo(() => {
    const candidates: string[] = [];
    if (tex?.trim()) candidates.push(stackDisplayTex(tex));
    const fromAscii = asciiFormulaToTex(fallback || "");
    if (fromAscii && fromAscii !== candidates[0]) candidates.push(fromAscii);
    for (const src of candidates) {
      try {
        const out = katex.renderToString(src, {
          throwOnError: false,
          displayMode: display,
          strict: "ignore",
          trust: true,
        });
        if (out && !out.includes("katex-error")) return out;
      } catch {
        /* siguiente candidato */
      }
    }
    return null;
  }, [tex, fallback, display]);

  if (html) return <div className="eq eq-tex" dangerouslySetInnerHTML={{ __html: html }} />;
  if (fallback) return <div className="eq">{fallback}</div>;
  return null;
}

/** Una línea de cálculo o sustitución: KaTeX si es ecuación, texto si es prosa. */
export function MathLine({ text }: { text: string }) {
  if (!text) return null;
  if (looksLikeMathLine(text)) return <Formula fallback={text} />;
  return <span>{text}</span>;
}
