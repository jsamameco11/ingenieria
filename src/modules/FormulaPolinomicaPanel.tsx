import { useMemo, useState } from "react";
import {
  AREAS_GEOGRAFICAS,
  INDICES_UNIFICADOS,
  calcularFormula,
  codigoIU,
  estadoAlBorrarFormula,
  estadoAlCrearFormula,
  incidenciasPorIU,
  mesTexto,
  money,
  opcionesAgrupacion,
  patchDestino,
  puedeConvertirEnMonomio,
  textoTrato,
} from "../lib/presupuesto";
import type { FormulaPolinomicaState, PresupuestoState } from "../lib/presupuesto";
import { useCollapseOnScroll } from "../lib/useCollapseOnScroll";

type Props = {
  state: PresupuestoState;
  onChange: (formula: FormulaPolinomicaState) => void;
};

type ConfirmAccion = "regenerar" | "eliminar" | null;

export function FormulaPolinomicaPanel({ state, onChange }: Props) {
  const f = state.formula;
  const r = calcularFormula(state);
  const patch = (p: Partial<FormulaPolinomicaState>) => onChange({ ...f, ...p });
  const setIo = (iu: number, v: number) => patch({ indicesIo: { ...f.indicesIo, [String(iu)]: v } });
  const setIr = (iu: number, v: number) => patch({ indicesIr: { ...f.indicesIr, [String(iu)]: v } });

  const [sel, setSel] = useState<number[]>([]);
  const [agruparIu, setAgruparIu] = useState(39);
  const [aviso, setAviso] = useState("");
  const [confirm, setConfirm] = useState<ConfirmAccion>(null);
  const [busca, setBusca] = useState("");
  const [indicesOpen, setIndicesOpen] = useState(false);
  const { collapsed, onScroll } = useCollapseOnScroll();

  const usados = new Set(r.monomios.map((m) => m.iu));
  const q = busca.trim().toLowerCase();
  const incidencias = r.incidencias.filter((x) => {
    if (!q) return true;
    return (
      codigoIU(x.iu).includes(q) ||
      x.nombre.toLowerCase().includes(q) ||
      x.simbolo.toLowerCase().includes(q) ||
      textoTrato(x, r.creada).toLowerCase().includes(q)
    );
  });

  const destinosAgrupar = useMemo(() => {
    const ids = new Set<number>([39, ...r.monomios.map((m) => m.iu), ...r.incidencias.map((x) => x.iu)]);
    return INDICES_UNIFICADOS.filter((iu) => ids.has(iu.codigo));
  }, [r.monomios, r.incidencias]);

  const snapshotDestino = () => {
    const base: Record<string, number> = { ...f.destino };
    for (const x of r.incidencias) base[String(x.iu)] = x.destino;
    return base;
  };

  const crear = () => {
    if (r.costoDirecto <= 0) {
      setAviso("No hay costo directo. Agregue partidas en Presupuesto o cargue una plantilla.");
      return;
    }
    const { incidencias: raw, costoDirecto } = incidenciasPorIU(state);
    onChange(estadoAlCrearFormula(f, raw, costoDirecto));
    setSel([]);
    setAviso("");
    setConfirm(null);
  };

  const regenerar = () => {
    crear();
  };

  const eliminar = () => {
    onChange(estadoAlBorrarFormula(f));
    setSel([]);
    setAviso("");
    setConfirm(null);
  };

  const toggle = (iu: number) => {
    setSel((s) => (s.includes(iu) ? s.filter((x) => x !== iu) : [...s, iu]));
    setAviso("");
  };

  const toggleAll = () => {
    if (sel.length === incidencias.length) setSel([]);
    else setSel(incidencias.map((x) => x.iu));
  };

  const agrupar = (destIu: number) => {
    if (!r.creada) {
      setAviso("Cree la fórmula para agrupar índices.");
      return;
    }
    if (!sel.length) {
      setAviso("Marque uno o más índices en la tabla de incidencias.");
      return;
    }
    patch({ destino: patchDestino(snapshotDestino(), sel, destIu), coeficientes: {} });
    setSel([]);
    setAviso(
      sel.length === 1
        ? `Índice ${codigoIU(sel[0])} agrupado en IU ${codigoIU(destIu)}.`
        : `${sel.length} índices agrupados en IU ${codigoIU(destIu)}.`
    );
  };

  const convertirMonomio = (ius = sel) => {
    if (!r.creada) return;
    if (!ius.length) {
      setAviso("Marque los índices que deben quedar como monomio propio.");
      return;
    }
    if (!puedeConvertirEnMonomio(snapshotDestino(), r.incidencias, ius, f.maxMonomios)) {
      setAviso(`No se puede superar el máximo de ${f.maxMonomios} monomios. Agrupe otro índice antes de convertir.`);
      return;
    }
    const next = snapshotDestino();
    for (const iu of ius) next[String(iu)] = iu;
    patch({ destino: next, coeficientes: {} });
    setSel([]);
    setAviso(ius.length === 1 ? `IU ${codigoIU(ius[0])} queda como monomio.` : `${ius.length} índices quedan como monomios.`);
  };

  const reagruparFila = (iu: number, destIu: number) => {
    if (!r.creada) {
      setAviso("Cree la fórmula para editar la agrupación.");
      return;
    }
    const actual = r.incidencias.find((x) => x.iu === iu);
    if (!actual || actual.destino === destIu) return;
    if (destIu === iu) {
      convertirMonomio([iu]);
      return;
    }
    patch({ destino: patchDestino(snapshotDestino(), [iu], destIu), coeficientes: {} });
    setAviso(`IU ${codigoIU(iu)} agrupado en IU ${codigoIU(destIu)}.`);
  };

  const setCoef = (iu: number, v: number) => {
    patch({ coeficientes: { ...f.coeficientes, [String(iu)]: v } });
  };

  return (
    <div className={`fp-shell${collapsed ? " is-chrome-collapsed" : ""}`}>
      <div className="fp-scroll" onScroll={onScroll}>
        <div className="fp-chrome">
          <div className="fp-chrome-bar">
            <h3>Fórmula polinómica</h3>
            <div className="fp-chrome-actions">
              {r.creada ? (
                <span className="fp-status on">Registrada</span>
              ) : (
                <span className="fp-status">Sin fórmula</span>
              )}
              {!r.creada ? (
                <button type="button" className="btn" onClick={crear} disabled={r.costoDirecto <= 0}>
                  Crear fórmula
                </button>
              ) : (
                <>
                  <button type="button" className="btn" onClick={() => setConfirm("regenerar")}>
                    Regenerar
                  </button>
                  <button type="button" className="btn secondary" onClick={() => setConfirm("eliminar")}>
                    Eliminar
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="fp-chrome-extra" aria-hidden={collapsed}>
            <p>
              D.S. 011-79-VC · OSCE. Monomios con incidencias del costo directo de esta obra ({state.obra}), por Índice
              Unificado INEI. Coeficientes a tres decimales (suma 1.000). Máximo ocho monomios (a–h).
            </p>
            <div className="fp-toolbar">
              <label title="Solo referencial: se imprime en la hoja de fórmula polinómica. Los índices Io/Ir de cada IU siguen siendo los que usted escriba o importe — no cambian según el área elegida aquí.">
                Área geográfica (referencial, no cambia los índices)
                <select value={f.area} onChange={(e) => patch({ area: parseInt(e.target.value, 10) })}>
                  {AREAS_GEOGRAFICAS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mes del presupuesto (Io)
                <input type="month" value={f.mesBase} onChange={(e) => patch({ mesBase: e.target.value })} />
              </label>
              <label>
                Mes de la valorización (Ir)
                <input type="month" value={f.mesVal} onChange={(e) => patch({ mesVal: e.target.value })} />
              </label>
              <label>
                Umbral de absorción %
                <input
                  type="number"
                  min={0}
                  max={20}
                  step="0.1"
                  value={f.umbralPct}
                  onChange={(e) => patch({ umbralPct: parseFloat(e.target.value) || 0 })}
                />
              </label>
              <label>
                Máx. monomios
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={f.maxMonomios}
                  onChange={(e) => patch({ maxMonomios: Math.min(8, Math.max(1, parseInt(e.target.value, 10) || 8)) })}
                />
              </label>
              <label>
                Valorización V (S/)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={f.valorizacion || r.costoDirecto}
                  onChange={(e) => patch({ valorizacion: parseFloat(e.target.value) || 0 })}
                />
              </label>
            </div>
          </div>
        </div>

      {confirm ? (
        <div className="fp-confirm" role="alertdialog">
          <p>
            {confirm === "regenerar"
              ? "Regenerar vuelve a aplicar el umbral y el máximo de monomios. Se pierden las agrupaciones hechas a mano."
              : "Se elimina la fórmula de esta obra. Las incidencias y los índices Io / Ir se conservan."}
          </p>
          <button type="button" className="btn" onClick={confirm === "regenerar" ? regenerar : eliminar}>
            {confirm === "regenerar" ? "Regenerar fórmula" : "Eliminar"}
          </button>
          <button type="button" className="btn secondary" onClick={() => setConfirm(null)}>
            Cancelar
          </button>
        </div>
      ) : null}

      {aviso ? <p className="fp-aviso">{aviso}</p> : null}
      {r.paramsDesfasados ? (
        <p className="fp-aviso warn">
          El umbral o el máximo de monomios cambiaron respecto de la última generación. Pulse Regenerar para aplicarlos a la
          agrupación.
        </p>
      ) : null}
      {r.nuevasIncidencias > 0 && r.creada ? (
        <p className="fp-aviso warn">
          Hay {r.nuevasIncidencias} índice(s) nuevo(s) en el presupuesto. Quedaron con el trato automático; puede
          reagruparlos en la tabla de incidencias.
        </p>
      ) : null}
      {r.topeAplicado ? (
        <p className="fp-aviso warn">
          Se absorbieron índices menores para respetar el máximo de {f.maxMonomios} monomios.
        </p>
      ) : null}

      {!r.creada ? (
        <div className="fp-hero">
          <button type="button" className="btn" onClick={crear} disabled={r.costoDirecto <= 0}>
            Crear fórmula polinómica
          </button>
        </div>
      ) : (
        <div className="fp-k">
          <div>
            <span>Factor de reajuste K</span>
            <b>{r.k.toFixed(4)}</b>
            <small>Σ coeficientes = {r.sumaCoef.toFixed(3)} {r.sumaCoef === 1 ? "· cuadrado" : "· revisar"}</small>
          </div>
          <div>
            <span>Valorización reajustada V × K</span>
            <b>S/ {money(r.reajustado)}</b>
            <small>
              Δ = S/ {money(r.diferencial)} ({r.diferencial >= 0 ? "+" : ""}
              {r.valorizacion ? money((r.diferencial / r.valorizacion) * 100, 2) : "0.00"} %)
            </small>
          </div>
          <div className="fp-formula-text">
            <span>Fórmula</span>
            <code>{r.texto}</code>
            <small>
              Io {mesTexto(f.mesBase)} · Ir {mesTexto(f.mesVal)}
            </small>
          </div>
        </div>
      )}

        <div className={`fp-grid${r.creada ? "" : " fp-grid-solo"}`}>
          <section>
            <div className="fp-sec-head">
              <div>
                <h4>{r.creada ? "Incidencias y agrupación" : "Incidencias sobre el costo directo"}</h4>
                <p>
                  {r.creada
                    ? "Por defecto, lo menor al umbral se absorbe en el IU 39. En cada fila puede dejar el índice como monomio propio o reagruparlo en otro monomio. El coeficiente de cada letra sale del monto agrupado."
                    : "Análisis previo. El trato indicado es el que aplicará al crear la fórmula con el umbral actual."}
                </p>
              </div>
              <input
                className="pre-search fp-busca"
                placeholder="Buscar IU, símbolo o nombre…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            {r.creada ? (
              <div className="fp-reagrupar">
                <p>
                  Reagrupación de esta obra. Regenerar vuelve al criterio automático (umbral {money(f.umbralPct, 1)} % y
                  máximo {f.maxMonomios} monomios).
                </p>
                {sel.length > 0 ? (
                  <div className="fp-reagrupar-bulk">
                    <span>{sel.length} índice(s) marcado(s)</span>
                    <button type="button" className="btn secondary" onClick={() => convertirMonomio()}>
                      Convertir en monomio
                    </button>
                    <label className="fp-cmd-agrupar">
                      Agrupar selección en
                      <select value={agruparIu} onChange={(e) => setAgruparIu(parseInt(e.target.value, 10))}>
                        {destinosAgrupar.map((iu) => (
                          <option key={iu.codigo} value={iu.codigo}>
                            {codigoIU(iu.codigo)} · {iu.simbolo} · {iu.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="btn secondary" onClick={() => agrupar(agruparIu)}>
                      Aplicar
                    </button>
                    <button type="button" className="btn secondary" onClick={() => agrupar(39)}>
                      Absorber en IU 39
                    </button>
                  </div>
                ) : (
                  <p className="fp-reagrupar-hint">Marque varias filas si desea reagrupar en bloque.</p>
                )}
              </div>
            ) : null}
            <div className="pre-table-wrap fp-inc">
              <table className="pre-table">
                <thead>
                  <tr>
                    <th className="fp-check">
                      <input
                        type="checkbox"
                        checked={incidencias.length > 0 && sel.length === incidencias.length}
                        onChange={toggleAll}
                        aria-label="Marcar todos"
                      />
                    </th>
                    <th>IU</th>
                    <th>Índice unificado</th>
                    <th className="n">Monto S/</th>
                    <th className="n">% CD</th>
                    <th>Agrupar en</th>
                  </tr>
                </thead>
                <tbody>
                  {incidencias.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="pre-empty">
                        No hay costo directo. Agregue partidas en Presupuesto o cargue una plantilla.
                      </td>
                    </tr>
                  ) : (
                    incidencias.map((x) => {
                      const nuevo = r.creada && !(String(x.iu) in (f.destino ?? {}));
                      const destinos = opcionesAgrupacion(x, r.monomios);
                      return (
                        <tr
                          key={x.iu}
                          className={`${x.absorbido ? "fp-abs" : ""}${sel.includes(x.iu) ? " fp-row-on" : ""}`}
                        >
                          <td className="fp-check">
                            <input
                              type="checkbox"
                              checked={sel.includes(x.iu)}
                              onChange={() => toggle(x.iu)}
                              aria-label={`Marcar IU ${codigoIU(x.iu)}`}
                            />
                          </td>
                          <td>
                            <code>{codigoIU(x.iu)}</code>
                          </td>
                          <td>
                            <b>{x.simbolo}</b> · {x.nombre}
                            {nuevo ? <span className="fp-pill nuevo">Nuevo</span> : null}
                            {x.manual && r.creada ? <span className="fp-pill">Manual</span> : null}
                          </td>
                          <td className="n mono">{money(x.monto)}</td>
                          <td className="n mono">{money(x.pct, 2)} %</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            {r.creada ? (
                              <select
                                className={`fp-trato-select${x.absorbido ? " abs" : ""}`}
                                value={x.destino}
                                aria-label={`Agrupar IU ${codigoIU(x.iu)}`}
                                title="Cambiar el destino de este índice en la fórmula de esta obra"
                                onChange={(e) => reagruparFila(x.iu, parseInt(e.target.value, 10))}
                              >
                                {destinos.map((d) => (
                                  <option key={d.iu} value={d.iu}>
                                    {d.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className={`fp-trato${x.absorbido ? " abs" : " mono"}`}>{textoTrato(x, r.creada)}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {r.incidencias.length > 0 ? (
                  <tfoot>
                    <tr>
                      <td />
                      <td colSpan={2}>Costo directo</td>
                      <td className="n mono">{money(r.costoDirecto)}</td>
                      <td className="n mono">100.00 %</td>
                      <td />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </section>

          {r.creada ? (
            <section>
              <div className="fp-sec-head">
                <div>
                  <h4>Monomios (a–h)</h4>
                  <p>
                    K = Σ letra × (Ir / Io). Cantidad y precio no aplican aquí: edite el coeficiente (tres decimales) y los
                    índices Io / Ir del boletín INEI. Pulse Calcular para volver a los pesos del CD.
                  </p>
                </div>
                <button type="button" className="btn btn-calc" onClick={() => patch({ coeficientes: {} })}>
                  Calcular
                </button>
              </div>
              <div className="pre-table-wrap">
                <table className="pre-table">
                  <thead>
                    <tr>
                      <th>Letra</th>
                      <th>IU</th>
                      <th>Símbolo</th>
                      <th className="n">Monto S/</th>
                      <th className="n">Coef.</th>
                      <th className="n">Io</th>
                      <th className="n">Ir</th>
                      <th className="n">Ir/Io</th>
                      <th className="n">Aporte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.monomios.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="pre-empty">
                          Sin monomios.
                        </td>
                      </tr>
                    ) : (
                      r.monomios.map((m) => (
                        <tr key={m.letra}>
                          <td>
                            <b className="fp-letra">{m.letra}</b>
                          </td>
                          <td>
                            <code>{codigoIU(m.iu)}</code>
                            <small className="fp-iu-name">{m.nombre}</small>
                          </td>
                          <td>
                            {m.simbolo}r / {m.simbolo}o
                          </td>
                          <td className="n mono">{money(m.monto)}</td>
                          <td className="n">
                            <input
                              className="fp-input"
                              type="number"
                              min={0}
                              max={1}
                              step="0.001"
                              value={m.coeficiente}
                              onChange={(e) => setCoef(m.iu, parseFloat(e.target.value) || 0)}
                              title="Coeficiente a tres decimales"
                            />
                          </td>
                          <td className="n">
                            <input
                              className="fp-input"
                              type="number"
                              min={0}
                              step="0.1"
                              value={m.io}
                              onChange={(e) => setIo(m.iu, parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="n">
                            <input
                              className="fp-input"
                              type="number"
                              min={0}
                              step="0.1"
                              value={m.ir}
                              onChange={(e) => setIr(m.iu, parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="n mono">{m.ratio.toFixed(4)}</td>
                          <td className="n mono">{m.aporte.toFixed(4)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {r.monomios.length > 0 ? (
                    <tfoot>
                      <tr>
                        <td colSpan={3}>K</td>
                        <td className="n mono">{money(r.monomios.reduce((s, m) => s + m.monto, 0))}</td>
                        <td className="n mono">{r.sumaCoef.toFixed(3)}</td>
                        <td colSpan={3} />
                        <td className="n mono">{r.k.toFixed(4)}</td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </section>
          ) : null}
        </div>

        <section className="fp-indices">
          <button type="button" className="fp-indices-toggle" onClick={() => setIndicesOpen((v) => !v)}>
            <span>Tabla de índices unificados INEI (IUPC)</span>
            <span>{indicesOpen ? "Ocultar" : "Mostrar Io / Ir de todos los códigos"}</span>
          </button>
          {indicesOpen ? (
            <>
              <p>
                Base de referencia 100. Cargue los valores del boletín del área geográfica y del mes del presupuesto (Io) y
                de la valorización (Ir). Los códigos coinciden con la metodología oficial; no hay índices 15, 25, 29, 35, 36,
                58, 63, 67, 74–76 ni 79.
              </p>
              <div className="pre-table-wrap">
                <table className="pre-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Índice unificado</th>
                      <th>Símbolo</th>
                      <th>Grupo</th>
                      <th className="n">Io</th>
                      <th className="n">Ir</th>
                      <th>En fórmula</th>
                    </tr>
                  </thead>
                  <tbody>
                    {INDICES_UNIFICADOS.map((iu) => (
                      <tr key={iu.codigo} className={usados.has(iu.codigo) ? "fp-used" : ""}>
                        <td>
                          <code>{codigoIU(iu.codigo)}</code>
                        </td>
                        <td>{iu.nombre}</td>
                        <td>{iu.simbolo}</td>
                        <td>{iu.grupo}</td>
                        <td className="n">
                          <input
                            className="fp-input"
                            type="number"
                            min={0}
                            step="0.1"
                            value={f.indicesIo[String(iu.codigo)] ?? iu.io}
                            onChange={(e) => setIo(iu.codigo, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="n">
                          <input
                            className="fp-input"
                            type="number"
                            min={0}
                            step="0.1"
                            value={f.indicesIr[String(iu.codigo)] ?? iu.ir}
                            onChange={(e) => setIr(iu.codigo, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td>{usados.has(iu.codigo) ? "Monomio" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
