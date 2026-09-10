import { useEffect, useState } from "react";
import { extractionDebugEnabled, readDebugFrames, type DebugFrame } from "../lib/perfil/debug";

export function ExtractionDebugPanel() {
  const [frames, setFrames] = useState<DebugFrame[]>([]);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!extractionDebugEnabled()) return;
    setOn(true);
    const id = window.setInterval(() => setFrames(readDebugFrames()), 800);
    return () => window.clearInterval(id);
  }, []);
  if (!on) return null;
  const last = frames[0];
  return (
    <aside className="extract-debug" aria-label="Depuración del motor de extracción">
      <p className="extract-debug-kicker">EXTRACTION_DEBUG</p>
      <p>INPUT → NORMALIZE → EXTRACT → MATCH → EVIDENCE → SIGNAL</p>
      {!last ? <p>Sin paquetes todavía. Complete el perfil o use una hoja.</p> : null}
      {last ? (
        <pre>
{`at ${last.at}
input: ${last.input}
matched: ${last.matched.join(", ") || "—"}
signals:
${last.signals.join("\n") || "—"}
result: ${JSON.stringify(last.result || {}, null, 2).slice(0, 1200)}`}
        </pre>
      ) : null}
    </aside>
  );
}
