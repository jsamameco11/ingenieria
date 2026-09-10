import { useRef } from "react";
import {
  displayEtabsRows,
  ETABS_FORCE_HEADERS,
  parseEtabsForceTable,
  serializeEtabsForceTable,
  type EtabsForceRow,
} from "../lib/etabsTable";

type Props = {
  value: string;
  onChange: (raw: string) => void;
  onFocus?: () => void;
  fallbackLabel?: string;
};

function fmtCell(n: number): string {
  if (!Number.isFinite(n) || n === 0) return n === 0 ? "0" : "";
  const t = Math.round(n * 1e4) / 1e4;
  return String(t);
}

export function EtabsForceTable({ value, onChange, onFocus, fallbackLabel = "C1" }: Props) {
  const fileRef = useRef<HTMLTextAreaElement>(null);
  const rows = displayEtabsRows(value, fallbackLabel);

  const commit = (next: EtabsForceRow[]) => {
    onChange(serializeEtabsForceTable(next));
  };

  const patch = (i: number, key: keyof EtabsForceRow, raw: string) => {
    const next = rows.map((r, j) => {
      if (j !== i) return r;
      if (key === "label" || key === "load" || key === "story" || key === "station") {
        return { ...r, [key]: raw };
      }
      const n = Number(String(raw).replace(",", "."));
      return { ...r, [key]: Number.isFinite(n) ? n : 0 };
    });
    commit(next);
  };

  const applyPaste = (text: string) => {
    const parsed = parseEtabsForceTable(text);
    if (!parsed.length) return false;
    commit(parsed);
    return true;
  };

  return (
    <div className="etabs-table field-wide" onFocus={onFocus}>
      <div className="etabs-table-toolbar">
        <p>
          Copie en ETABS la tabla <b>Element Forces – Columns</b> o <b>Pier Forces</b> (Dead/CM, Live/CV, CSX, CSY)
          y péguela aquí. Se reconocen P, V2, V3, T, M2 y M3.
        </p>
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            onFocus?.();
            void navigator.clipboard.readText().then((t) => {
              if (!applyPaste(t) && fileRef.current) fileRef.current.focus();
            }).catch(() => fileRef.current?.focus());
          }}
        >
          Pegar de ETABS
        </button>
      </div>
      <textarea
        ref={fileRef}
        className="etabs-table-paste"
        aria-label="Pegar tabla ETABS"
        placeholder="Haga clic y pulse Ctrl+V para pegar la tabla de ETABS"
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (applyPaste(text)) e.preventDefault();
        }}
      />
      <div className="etabs-table-wrap">
        <table>
          <thead>
            <tr>
              {ETABS_FORCE_HEADERS.map((h) => (
                <th key={h.key} title={"unit" in h ? `${h.title} (${h.unit})` : h.hint}>
                  {h.title}
                  {"unit" in h ? <small>{h.unit}</small> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.label}-${r.load}-${i}`}>
                <td>
                  <input value={r.label} onFocus={onFocus} onChange={(e) => patch(i, "label", e.target.value)} />
                </td>
                <td>
                  <input value={r.load} onFocus={onFocus} onChange={(e) => patch(i, "load", e.target.value)} />
                </td>
                {(["p", "v2", "v3", "t", "m2", "m3"] as const).map((k) => (
                  <td key={k} className="n">
                    <input
                      inputMode="decimal"
                      value={fmtCell(r[k])}
                      onFocus={onFocus}
                      onChange={(e) => patch(i, k, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
