import { useMemo, useState } from "react";
import {
  ESPECIALIDAD_META,
  ESPECIALIDADES,
  PARTIDAS,
  calcularPresupuesto,
  especificacionDe,
  exportarEspecificacionesDocx,
  loadPresupuesto,
  partidaDeLinea,
  SISTEMA_CONTRATACION_META,
  type EspecialidadPre,
} from "../lib/presupuesto";
import { printMemoria } from "../lib/printDoc";
import { EspecificacionFicha } from "../ui/EspecificacionFicha";

export function EspecificacionesModule() {
  const state = loadPresupuesto();
  const calc = useMemo(() => calcularPresupuesto(state), [state]);
  const [esp, setEsp] = useState<EspecialidadPre | "obra">("obra");
  const [q, setQ] = useState("");

  const deObra = useMemo(() => {
    return state.lineas
      .map((l) => {
        const p = partidaDeLinea(l);
        return p
          ? {
              metrado: l.metrado,
              spec: especificacionDe(p, { linea: l, precios: state.precios, insumosPropios: state.insumosPropios, jornada: state.jornada }),
            }
          : null;
      })
      .filter((x): x is { metrado: number; spec: ReturnType<typeof especificacionDe> } => !!x);
  }, [state.lineas, state.precios, state.insumosPropios, state.jornada]);

  const catalogo = useMemo(() => {
    const list = esp === "obra" ? [] : PARTIDAS.filter((p) => p.especialidad === esp);
    const term = q.trim().toLowerCase();
    return term ? list.filter((p) => `${p.codigo} ${p.descripcion}`.toLowerCase().includes(term)) : list;
  }, [esp, q]);

  const filtrados: { spec: ReturnType<typeof especificacionDe>; metrado?: number }[] =
    esp === "obra"
      ? deObra.filter((x) =>
          q.trim() ? `${x.spec.codigo} ${x.spec.titulo}`.toLowerCase().includes(q.trim().toLowerCase()) : true,
        )
      : catalogo.map((p) => ({ spec: especificacionDe(p) }));

  const hoy = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  const lugar = [state.direccion, state.distrito, state.provincia, state.departamento, state.lugar]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .filter((x, i, a) => a.indexOf(x) === i)
    .join(" · ");

  return (
    <div className="pdf-shell et-shell">
      <header className="pdf-hero no-print">
        <p className="doc-kicker">PRE-05 · especificaciones técnicas</p>
        <h2>Especificaciones técnicas</h2>
        <p>
          Cada partida lleva ficha de expediente: descripción del trabajo, alcance, APU, procedimiento, medición, pago,
          control y normas. El texto sale de la partida real, no de un párrafo genérico.
        </p>
      </header>
      <div className="pdf-grid no-print" style={{ gridTemplateColumns: "1fr" }}>
        <section className="pdf-main">
          <div className="pdf-fields" style={{ gridTemplateColumns: "1fr 1fr auto", alignItems: "end" }}>
            <label>
              Fuente
              <select value={esp} onChange={(e) => setEsp(e.target.value as EspecialidadPre | "obra")}>
                <option value="obra">Partidas de esta obra ({deObra.length})</option>
                {ESPECIALIDADES.map((e) => (
                  <option key={e} value={e}>
                    Catálogo {ESPECIALIDAD_META[e].kicker} · {ESPECIALIDAD_META[e].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Buscar
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código o descripción" />
            </label>
            <button
              type="button"
              className="pdf-add-esp"
              onClick={() => printMemoria(`Especificaciones técnicas — ${state.obra || "obra"}`, "et-printing")}
            >
              Imprimir / PDF
            </button>
            <button
              type="button"
              className="pdf-add-esp"
              disabled={!filtrados.length}
              title="Descarga las fichas visibles como un documento .docx editable, con carátula, índice y firmas"
              onClick={() =>
                void exportarEspecificacionesDocx(
                  state,
                  filtrados,
                  esp === "obra" ? "Partidas de esta obra" : `Catálogo ${ESPECIALIDAD_META[esp as EspecialidadPre].label}`,
                )
              }
            >
              Exportar Word (.docx)
            </button>
          </div>
          <p className="pdf-note">
            {state.obra || "Obra sin nombre"} · {calc.lineas.length} partidas en PRE-01 · {filtrados.length} fichas
            visibles
          </p>
        </section>
      </div>

      <article className="et-doc paper">
        <header className="et-cover">
          <div className="et-cover-top">
            <div>
              <p className="et-brand">MemoriaCalc</p>
              <p className="et-cover-kicker">Expediente técnico de obra</p>
            </div>
            <div className="et-cover-doc">
              <span>Documento</span>
              <strong>PRE-05</strong>
              <em>Especificaciones técnicas</em>
            </div>
          </div>
          <h1>Especificaciones técnicas de partidas</h1>
          <p className="et-cover-lead">
            Fichas de ejecución, medición y pago según el Reglamento Nacional de Metrados, el RNE y el análisis de
            precios unitarios de cada código. El precio unitario de contrato no se altera en este documento.
          </p>
          <table className="et-meta">
            <tbody>
              <tr>
                <th>Obra</th>
                <td>{state.obra || "—"}</td>
              </tr>
              <tr>
                <th>Ubicación</th>
                <td>{lugar || "—"}</td>
              </tr>
              <tr>
                <th>Cliente / entidad</th>
                <td>
                  {state.cliente || "—"}
                  {state.rucCliente ? ` · RUC ${state.rucCliente}` : ""}
                  {state.entidad ? ` · ${state.entidad}` : ""}
                </td>
              </tr>
              <tr>
                <th>Sistema</th>
                <td>
                  {SISTEMA_CONTRATACION_META[state.sistemaContratacion]} · jornada {state.jornada} h/día
                </td>
              </tr>
              <tr>
                <th>Proyectista</th>
                <td>{state.proyectista || "—"}</td>
              </tr>
              <tr>
                <th>Residente</th>
                <td>{state.residente || "—"}</td>
              </tr>
              <tr>
                <th>Fecha</th>
                <td>
                  {state.fecha || hoy} · {hoy}
                </td>
              </tr>
              <tr>
                <th>Fichas</th>
                <td>
                  {filtrados.length} partida{filtrados.length === 1 ? "" : "s"}
                  {esp === "obra" ? " de esta obra" : ` del catálogo ${ESPECIALIDAD_META[esp as EspecialidadPre].label}`}
                </td>
              </tr>
            </tbody>
          </table>
        </header>

        {filtrados.length ? (
          <section className="et-indice">
            <h2>Índice de partidas</h2>
            <table className="et-indice-table">
              <thead>
                <tr>
                  <th>N.º</th>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Und</th>
                  <th>Metrado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((x, i) => (
                  <tr key={`${x.spec.codigo}-${i}`}>
                    <td>{String(i + 1).padStart(3, "0")}</td>
                    <td>{x.spec.codigo}</td>
                    <td>{x.spec.titulo}</td>
                    <td>{x.spec.unidad}</td>
                    <td>
                      {x.metrado != null
                        ? x.metrado.toLocaleString("es-PE", { maximumFractionDigits: 3 })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <p className="et-empty">No hay partidas para mostrar. Cargue un presupuesto o elija un catálogo.</p>
        )}

        {filtrados.map((x, i) => (
          <EspecificacionFicha key={`${x.spec.codigo}-${i}`} s={x.spec} n={i + 1} metrado={x.metrado} />
        ))}

        <footer className="et-firmas">
          <div>
            <span>Proyectista</span>
            <strong>{state.proyectista || " "}</strong>
            <em>Nombre y firma</em>
          </div>
          <div>
            <span>Residente / supervisión</span>
            <strong>{state.residente || " "}</strong>
            <em>Nombre y firma</em>
          </div>
          <div>
            <span>Entidad / cliente</span>
            <strong>{state.entidad || state.cliente || " "}</strong>
            <em>Nombre y firma</em>
          </div>
        </footer>
      </article>
    </div>
  );
}
