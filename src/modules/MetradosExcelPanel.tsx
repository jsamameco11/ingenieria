import { useState } from "react";
import { money } from "../lib/presupuesto/types";
import type { MetradoLibro } from "../lib/presupuesto/metradoExcel";

export function MetradosExcelPanel({
  libro,
  pie,
}: {
  libro: MetradoLibro;
  pie?: string;
}) {
  const [hoja, setHoja] = useState(libro.hojas[0]?.id ?? "");
  const actual = libro.hojas.find((h) => h.id === hoja) ?? libro.hojas[0];
  if (!actual) return <p className="pre-lib-hint">Esta plantilla aún no tiene hoja de metrados.</p>;

  return (
    <div className="pre-xls">
      <header className="pre-xls-head">
        <p className="pre-xls-kicker">{libro.norma}</p>
        <h3>{libro.titulo}</h3>
        <p>{libro.subtitulo}</p>
      </header>
      <div className="pre-xls-tabs" role="tablist" aria-label="Hojas de metrado">
        {libro.hojas.map((h) => (
          <button
            key={h.id}
            type="button"
            role="tab"
            aria-selected={actual.id === h.id}
            className={actual.id === h.id ? "on" : ""}
            onClick={() => setHoja(h.id)}
          >
            {h.nombre}
          </button>
        ))}
      </div>
      <ol className="pre-xls-proc">
        {actual.procedimiento.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      <div className="pre-xls-wrap">
        <table className="pre-xls-table">
          <thead>
            <tr>
              <th>Ítem</th>
              <th>Descripción</th>
              <th>Und</th>
              <th>Fórmula</th>
              <th>Reemplazo</th>
              <th>Metrado</th>
              <th>Nota / norma</th>
            </tr>
          </thead>
          <tbody>
            {actual.filas.map((f) => (
              <tr key={`${f.codigo}-${f.descripcion}`} className={`pre-xls-${f.tipo}`}>
                <td className="mono">{f.codigo}</td>
                <td>{f.descripcion}</td>
                <td>{f.und}</td>
                <td className="mono">{f.formula}</td>
                <td className="mono">{f.reemplazo}</td>
                <td className="n mono">{f.metrado ? money(f.metrado, f.metrado % 1 ? 2 : 1) : "—"}</td>
                <td>{f.norma}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pie ? <p className="pre-xls-foot">{pie}</p> : null}
    </div>
  );
}
