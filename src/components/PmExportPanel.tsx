import { useMemo, useRef, useState } from "react";
import { flipDecimal, sheetsToTsv, type PmSheet } from "../lib/pmExport";

type Props = {
  sheets: PmSheet[];
  headline?: string;
};

export function PmExportPanel({ sheets, headline }: Props) {
  const [comma, setComma] = useState(true);
  const [msg, setMsg] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const tsv = useMemo(() => {
    const raw = sheetsToTsv(sheets);
    return comma ? raw : flipDecimal(raw, false);
  }, [sheets, comma]);

  const selectAll = () => {
    const el = areaRef.current;
    if (!el) return;
    el.focus();
    el.select();
    setMsg("Seleccionado. Pulse Ctrl+C para copiar.");
  };

  const copyAll = async () => {
    const el = areaRef.current;
    try {
      await navigator.clipboard.writeText(tsv);
      setMsg("Copiado. En Excel o Google Sheets: Ctrl+V.");
      if (el) {
        el.focus();
        el.select();
      }
    } catch {
      selectAll();
      setMsg("Seleccione el recuadro y pulse Ctrl+C.");
    }
  };

  if (!sheets.length) return null;

  return (
    <section className="pm-export" aria-label="Datos del diagrama para copiar">
      <header className="pm-export-head">
        <div>
          <h3>Datos P–M–M para hoja de cálculo</h3>
          <p>
            {headline || "Envolventes, barrido de Whitney, barras y demandas."} Seleccione todo
            (Ctrl+A) y copie (Ctrl+C), o use el botón. Al pegar en Excel cada columna cae en su celda.
          </p>
        </div>
        <div className="pm-export-actions">
          <fieldset className="pm-export-dec">
            <legend>Decimal</legend>
            <label>
              <input type="radio" name="pmdec" checked={comma} onChange={() => setComma(true)} />
              Coma (Excel PE)
            </label>
            <label>
              <input type="radio" name="pmdec" checked={!comma} onChange={() => setComma(false)} />
              Punto
            </label>
          </fieldset>
          <button type="button" className="btn secondary" onClick={selectAll}>
            Seleccionar todo
          </button>
          <button type="button" className="btn" onClick={() => void copyAll()}>
            Copiar todo
          </button>
        </div>
      </header>
      {msg ? <p className="pm-export-msg">{msg}</p> : null}
      <textarea
        ref={areaRef}
        className="pm-export-tsv"
        readOnly
        spellCheck={false}
        value={tsv}
        onFocus={(e) => e.currentTarget.select()}
        onClick={(e) => e.currentTarget.select()}
        aria-label="Tabla P-M-M lista para copiar"
      />
      <p className="pm-export-hint">
        Hojas: {sheets.map((s) => s.title).join(" · ")}. La primera columna de cada bloque es el
        encabezado; las siguientes son φPn (t) y φMn (t·m) para graficar.
      </p>
    </section>
  );
}
