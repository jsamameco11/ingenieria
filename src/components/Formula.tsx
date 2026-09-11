import { useMemo } from "react";
import katex from "katex";

/**
 * Renderiza una fórmula en LaTeX con KaTeX. Si `tex` no viene (o falla al compilar), cae de vuelta
 * al texto plano de `fallback` — así ningún paso se queda sin fórmula visible.
 */
export function Formula({ tex, fallback, display = true }: { tex?: string; fallback?: string; display?: boolean }) {
  const html = useMemo(() => {
    if (!tex) return null;
    try {
      return katex.renderToString(tex, { throwOnError: false, displayMode: display, strict: "ignore" });
    } catch {
      return null;
    }
  }, [tex, display]);

  if (html) return <div className="eq eq-tex" dangerouslySetInnerHTML={{ __html: html }} />;
  return <div className="eq">{fallback}</div>;
}
