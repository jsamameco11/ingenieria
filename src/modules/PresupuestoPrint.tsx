import { Fragment } from "react";
import {
  ESPECIALIDAD_META,
  KIND_META,
  KIND_ORDER,
  calcularFormula,
  codigoIU,
  consolidarInsumos,
  costoPropioNodo,
  costoRama,
  formulaNodo,
  money,
  moneyMon,
  SISTEMA_CONTRATACION_META,
  textoTrato,
  type CalcPresupuesto,
  type PresupuestoState,
  claveSubcapitulo,
  etiquetaSubcapitulo,
  partesTituloCapitulo,
  especificacionDe,
  costosParticionados,
} from "../lib/presupuesto";
import { EspecificacionFicha } from "../ui/EspecificacionFicha";

export const PRINT_HOJAS = [
  {
    id: "formacion",
    label: "Hoja de presupuesto",
    hint: "Formación del presupuesto: costo directo, GG, utilidad, IGV y total",
    grupo: "Presupuesto",
  },
  {
    id: "detallado",
    label: "Presupuesto detallado",
    hint: "Partidas con metrado, precio unitario y parcial, por especialidad y capítulo",
    grupo: "Presupuesto",
  },
  {
    id: "resumen",
    label: "Presupuesto resumen",
    hint: "Títulos, capítulos y estructura de costos",
    grupo: "Presupuesto",
  },
  {
    id: "partidas",
    label: "Listado de partidas",
    hint: "Relación corrida de partidas de obra",
    grupo: "Presupuesto",
  },
  {
    id: "metrados",
    label: "Planilla de metrados",
    hint: "Metrado de cada partida, procedencia (plano o plantilla) y notas de medición",
    grupo: "Presupuesto",
  },
  {
    id: "apu",
    label: "Análisis de costos unitarios",
    hint: "APU de cada partida (MO, materiales, maquinaria y equipos)",
    grupo: "Análisis",
  },
  {
    id: "insumos",
    label: "Relación de insumos",
    hint: "Materiales, mano de obra y maquinaria de toda la obra",
    grupo: "Análisis",
  },
  {
    id: "insumos-partida",
    label: "Insumos por partida",
    hint: "Cantidades de obra de cada recurso",
    grupo: "Análisis",
  },
  {
    id: "particionado",
    label: "Costos particionados",
    hint: "Mano de obra, materiales, maquinaria y GG por etapa (cimentación, estructura, …)",
    grupo: "Análisis",
  },
  {
    id: "gg",
    label: "Gastos generales",
    hint: "Organigrama y desglose de GG",
    grupo: "Indirectos",
  },
  {
    id: "formula",
    label: "Fórmula polinómica",
    hint: "Incidencias IU y factor K de reajuste",
    grupo: "Indirectos",
  },
  {
    id: "especificaciones",
    label: "Especificaciones técnicas",
    hint: "Ficha de expediente por partida: alcance, APU, procedimiento, medición, pago y normas",
    grupo: "Expediente",
  },
] as const;

export type PrintHojaId = (typeof PRINT_HOJAS)[number]["id"];

/** Expediente de presupuesto desde PDF: hoja, planilla, APU, insumos y costos particionados. */
export const EXPEDIENTE_PDF_HOJAS: PrintHojaId[] = [
  "formacion",
  "detallado",
  "metrados",
  "apu",
  "insumos",
  "particionado",
];

function procedenciaMetrado(nota?: string) {
  const t = (nota || "").toLowerCase();
  if (t.includes("partida adicional")) return "Adicional · catálogo";
  if (t.includes("metrado del plano") || t.includes("fuente:")) return "Plano";
  if (t.includes("plantilla")) return "Plantilla";
  return nota ? "Expediente" : "Plantilla";
}

function Head({
  state,
  hoja,
  calc,
}: {
  state: PresupuestoState;
  hoja: string;
  calc: CalcPresupuesto;
}) {
  return (
    <header className="pre-print-head">
      <p className="doc-kicker">Presupuesto de obra · S10 / CAPECO</p>
      <h1>{state.obra || "Presupuesto"}</h1>
      <p>
        {state.lugar || "—"}
        {state.direccion ? ` · ${state.direccion}` : ""}
        {" · "}
        {state.cliente || "—"}
        {state.rucCliente ? ` · RUC ${state.rucCliente}` : ""}
        {" · "}
        {state.fecha || "—"}
      </p>
      <p>
        {state.entidad ? `${state.entidad} · ` : ""}
        {SISTEMA_CONTRATACION_META[state.sistemaContratacion]} · jornada {state.jornada} h/día
        {state.proyectista ? ` · Proyectista: ${state.proyectista}` : ""}
        {state.residente ? ` · Residente: ${state.residente}` : ""}
      </p>
      <p>
        <strong>{hoja}</strong>
        {" · "}
        CD {moneyMon(calc.costoDirecto, state.moneda)} · Total {moneyMon(calc.total, state.moneda)}
      </p>
    </header>
  );
}

function Totales({ state, calc }: { state: PresupuestoState; calc: CalcPresupuesto }) {
  return (
    <table className="data">
      <tbody>
        <tr>
          <td colSpan={6}>Costo directo</td>
          <td>{money(calc.costoDirecto)}</td>
        </tr>
        <tr>
          <td colSpan={6}>
            Gastos generales (
            {state.ggModo === "organigrama" ? `${money(calc.ggPct, 2)} % del CD · organigrama` : `${state.gg} %`})
          </td>
          <td>{money(calc.gg)}</td>
        </tr>
        <tr>
          <td colSpan={6}>Utilidad ({state.utilidad} %)</td>
          <td>{money(calc.utilidad)}</td>
        </tr>
        <tr>
          <td colSpan={6}>Subtotal</td>
          <td>{money(calc.subtotal)}</td>
        </tr>
        <tr>
          <td colSpan={6}>IGV ({state.igv} %)</td>
          <td>{money(calc.igv)}</td>
        </tr>
        <tr>
          <td colSpan={6}>
            <strong>Presupuesto total</strong>
          </td>
          <td>
            <strong>{moneyMon(calc.total, state.moneda)}</strong>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function PresupuestoPrint({
  state,
  calc,
  hojas,
}: {
  state: PresupuestoState;
  calc: CalcPresupuesto;
  hojas: PrintHojaId[];
}) {
  const insumos = consolidarInsumos(calc.lineas);
  const formula = calcularFormula(state);
  const part = costosParticionados(calc);
  const hayMaq = part.maq > 0;
  const hayEq = part.eq > 0;
  const set = new Set(hojas);

  return (
    <article className="pre-print paper">
      {set.has("formacion") ? (
        <section className="pre-print-report">
          <Head state={state} calc={calc} hoja="Hoja de presupuesto" />
          <p>
            Formación del presupuesto de obra: costo directo, gastos generales, utilidad, subtotal, IGV y total. Los
            precios unitarios salen del catálogo MemoriaCalc; los metrados, de la plantilla de expediente y de la lectura
            de planos.
          </p>
          <table className="data">
            <tbody>
              <tr>
                <td>Costo directo (suma de partidas)</td>
                <td>{moneyMon(calc.costoDirecto, state.moneda)}</td>
              </tr>
              <tr>
                <td>
                  Gastos generales
                  {state.ggModo === "organigrama"
                    ? ` (${money(calc.ggPct, 2)} % del CD · organigrama)`
                    : ` (${state.gg} %)`}
                </td>
                <td>{moneyMon(calc.gg, state.moneda)}</td>
              </tr>
              <tr>
                <td>Utilidad ({state.utilidad} %)</td>
                <td>{moneyMon(calc.utilidad, state.moneda)}</td>
              </tr>
              <tr>
                <td>Subtotal</td>
                <td>{moneyMon(calc.subtotal, state.moneda)}</td>
              </tr>
              <tr>
                <td>IGV ({state.igv} %)</td>
                <td>{moneyMon(calc.igv, state.moneda)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Presupuesto total de obra</strong>
                </td>
                <td>
                  <strong>{moneyMon(calc.total, state.moneda)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          <h2>Costo directo por especialidad</h2>
          <table className="data">
            <thead>
              <tr>
                <th>Especialidad</th>
                <th>Partidas</th>
                <th>Parcial S/</th>
                <th>% CD</th>
              </tr>
            </thead>
            <tbody>
              {calc.especialidades.map((e) => (
                <tr key={e.especialidad}>
                  <td>
                    {ESPECIALIDAD_META[e.especialidad].kicker} · {ESPECIALIDAD_META[e.especialidad].label}
                  </td>
                  <td>{e.capitulos.reduce((n, c) => n + c.lineas.length, 0)}</td>
                  <td>{money(e.parcial)}</td>
                  <td>{calc.costoDirecto ? money((e.parcial / calc.costoDirecto) * 100, 1) : "0.0"} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {set.has("detallado") ? (
        <section className="pre-print-report">
          <Head state={state} calc={calc} hoja="Presupuesto detallado" />
          {calc.especialidades.map((e) => {
            let n = 0;
            return (
              <div key={`d-${e.especialidad}`}>
                <h2>
                  {ESPECIALIDAD_META[e.especialidad].kicker} · {ESPECIALIDAD_META[e.especialidad].label}
                  <span> {moneyMon(e.parcial, state.moneda)}</span>
                </h2>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Ítem</th>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th>Und</th>
                      <th>Metrado</th>
                      <th>P.U. S/</th>
                      <th>Parcial S/</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.capitulos.map((c) => {
                      const tit = partesTituloCapitulo(c.capitulo);
                      const groups = new Map<string, typeof c.lineas>();
                      for (const l of c.lineas) {
                        const key = claveSubcapitulo(l.partida.codigo) || "_";
                        const arr = groups.get(key) ?? [];
                        arr.push(l);
                        groups.set(key, arr);
                      }
                      const subs = [...groups.entries()];
                      return (
                      <Fragment key={c.capitulo}>
                        <tr className="pre-print-cap">
                          <td />
                          <td>
                            <strong>{tit.num}</strong>
                          </td>
                          <td colSpan={4}>
                            <strong>{tit.nombre}</strong>
                          </td>
                          <td>
                            <strong>{money(c.parcial)}</strong>
                          </td>
                        </tr>
                        {subs.map(([clave, items]) => (
                          <Fragment key={`${c.capitulo}-${clave}`}>
                            {subs.length > 1 && clave !== "_" ? (
                              <tr className="pre-print-sub">
                                <td />
                                <td>{clave}</td>
                                <td colSpan={4}>{etiquetaSubcapitulo(items[0]?.partida.codigo ?? "")}</td>
                                <td>{money(items.reduce((s, x) => s + x.parcial, 0))}</td>
                              </tr>
                            ) : null}
                            {items.map((l) => {
                              n += 1;
                              return (
                                <tr key={l.linea.id}>
                                  <td>{n}</td>
                                  <td>{l.partida.codigo}</td>
                                  <td>{l.linea.descripcion ?? l.partida.descripcion}</td>
                                  <td>{l.partida.und}</td>
                                  <td>{money(l.linea.metrado, 2)}</td>
                                  <td>{money(l.apu.pu)}</td>
                                  <td>{money(l.parcial)}</td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        ))}
                      </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
          <Totales state={state} calc={calc} />
        </section>
      ) : null}

      {set.has("resumen") ? (
        <section className="pre-print-report">
          <Head state={state} calc={calc} hoja="Presupuesto resumen" />
          <table className="data">
            <thead>
              <tr>
                <th>Especialidad</th>
                <th>Capítulo</th>
                <th>Partidas</th>
                <th>Parcial S/</th>
                <th>% CD</th>
              </tr>
            </thead>
            <tbody>
              {calc.especialidades.map((e) => (
                <Fragment key={`r-${e.especialidad}`}>
                  <tr>
                    <td colSpan={3}>
                      <strong>
                        {ESPECIALIDAD_META[e.especialidad].kicker} · {ESPECIALIDAD_META[e.especialidad].label}
                      </strong>
                    </td>
                    <td>
                      <strong>{money(e.parcial)}</strong>
                    </td>
                    <td>
                      <strong>{calc.costoDirecto ? money((e.parcial / calc.costoDirecto) * 100, 1) : "0.0"} %</strong>
                    </td>
                  </tr>
                  {e.capitulos.map((c) => (
                    <tr key={c.capitulo}>
                      <td />
                      <td>{c.capitulo}</td>
                      <td>{c.lineas.length}</td>
                      <td>{money(c.parcial)}</td>
                      <td>{calc.costoDirecto ? money((c.parcial / calc.costoDirecto) * 100, 1) : "0.0"} %</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <Totales state={state} calc={calc} />
        </section>
      ) : null}

      {set.has("partidas") ? (
        <section className="pre-print-report">
          <Head state={state} calc={calc} hoja="Listado de partidas" />
          <table className="data">
            <thead>
              <tr>
                <th>Ítem</th>
                <th>Código</th>
                <th>Descripción</th>
                <th>Und</th>
                <th>Metrado</th>
                <th>P.U. S/</th>
                <th>Parcial S/</th>
              </tr>
            </thead>
            <tbody>
              {calc.lineas.map((l, i) => (
                <tr key={l.linea.id}>
                  <td>{i + 1}</td>
                  <td>{l.partida.codigo}</td>
                  <td>{l.partida.descripcion}</td>
                  <td>{l.partida.und}</td>
                  <td>{money(l.linea.metrado, 2)}</td>
                  <td>{money(l.apu.pu)}</td>
                  <td>{money(l.parcial)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Totales state={state} calc={calc} />
        </section>
      ) : null}

      {set.has("metrados") ? (
        <section className="pre-print-report">
          <Head state={state} calc={calc} hoja="Planilla de metrados" />
          <p>
            Planilla de metrados del expediente. El metrado del plano sustituye al de plantilla cuando la lámina lo
            cuantifica. Las partidas de la plantilla que no aparecen en el PDF se conservan. Las cantidades adicionales
            se mapean al catálogo MemoriaCalc; no se inventan códigos.
          </p>
          {calc.especialidades.map((e) => {
            let n = 0;
            return (
              <div key={`m-${e.especialidad}`}>
                <h2>
                  {ESPECIALIDAD_META[e.especialidad].kicker} · {ESPECIALIDAD_META[e.especialidad].label}
                  <span>
                    {e.capitulos.reduce((s, c) => s + c.lineas.length, 0)} partidas
                  </span>
                </h2>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Ítem</th>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th>Und</th>
                      <th>Metrado</th>
                      <th>Procedencia</th>
                      <th>Notas de medición</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.capitulos.map((c) => {
                      const tit = partesTituloCapitulo(c.capitulo);
                      return (
                        <Fragment key={`m-${c.capitulo}`}>
                          <tr className="pre-print-cap">
                            <td />
                            <td>
                              <strong>{tit.num}</strong>
                            </td>
                            <td colSpan={5}>
                              <strong>{tit.nombre}</strong>
                            </td>
                          </tr>
                          {c.lineas.map((l) => {
                            n += 1;
                            return (
                              <tr key={l.linea.id}>
                                <td>{n}</td>
                                <td>{l.partida.codigo}</td>
                                <td>{l.linea.descripcion ?? l.partida.descripcion}</td>
                                <td>{l.partida.und}</td>
                                <td>{money(l.linea.metrado, 3)}</td>
                                <td>{procedenciaMetrado(l.linea.nota)}</td>
                                <td>{l.linea.nota || "—"}</td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </section>
      ) : null}

      {set.has("apu") ? (
        <section className="pre-print-report">
          <Head state={state} calc={calc} hoja="Análisis de costos unitarios" />
          {calc.lineas.map((l) => (
            <div key={`apu-${l.linea.id}`} className="pre-print-apu">
              <h2>
                {l.partida.codigo} · {l.partida.descripcion}
                <span>
                  {l.partida.und} · P.U. {moneyMon(l.apu.pu, state.moneda)}
                </span>
              </h2>
              {KIND_ORDER.map((k) => {
                const g = l.apu.porKind[k];
                if (!g.items.length) return null;
                return (
                  <table key={k} className="data">
                    <thead>
                      <tr>
                        <th colSpan={8}>
                          {KIND_META[k].label} · {moneyMon(g.subtotal, state.moneda)}
                        </th>
                      </tr>
                      <tr>
                        <th>Código</th>
                        <th>Recurso</th>
                        <th>Und</th>
                        <th>Cuad.</th>
                        <th>Rend. ({l.partida.und}/d)</th>
                        <th>Cantidad</th>
                        <th>Precio</th>
                        <th>Parcial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((r) => (
                        <tr key={r.insumo.id}>
                          <td>{r.insumo.codigo}</td>
                          <td>{r.insumo.nombre}</td>
                          <td>{r.insumo.id === "EQ-HIN" ? "%" : r.insumo.und}</td>
                          <td>{r.usaJornada ? money(r.cuadrilla, 2) : "—"}</td>
                          <td>{r.usaJornada ? money(r.rendimiento, 2) : "—"}</td>
                          <td>{money(r.cantidad, 4)}</td>
                          <td>{money(r.precio)}</td>
                          <td>{money(r.parcial)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })}
            </div>
          ))}
        </section>
      ) : null}

      {set.has("insumos") ? (
        <section className="pre-print-report">
          <Head state={state} calc={calc} hoja="Relación de insumos" />
          <p>
            Consolidado de recursos de toda la obra: mano de obra, materiales y maquinaria (y equipos, si aplica). Las
            cantidades son metrado × consumo del análisis de costo unitario.
          </p>
          {KIND_ORDER.map((k) => {
            const items = insumos.filter((i) => i.insumo.kind === k);
            if (!items.length) return null;
            const sub = items.reduce((s, i) => s + i.parcial, 0);
            return (
              <div key={`ins-${k}`}>
                <h2>
                  {KIND_META[k].label}
                  <span> {moneyMon(sub, state.moneda)}</span>
                </h2>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th>Und</th>
                      <th>Cantidad</th>
                      <th>Precio</th>
                      <th>Parcial S/</th>
                      <th>Partidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.insumo.id}>
                        <td>{i.insumo.codigo}</td>
                        <td>
                          {i.insumo.nombre}
                          {i.insumo.id === "EQ-HIN" ? " (% sobre mano de obra, no es cantidad física)" : ""}
                        </td>
                        <td>{i.insumo.id === "EQ-HIN" ? "—" : i.insumo.und}</td>
                        <td>{i.insumo.id === "EQ-HIN" ? "—" : money(i.cantidad, 3)}</td>
                        <td>{i.insumo.id === "EQ-HIN" ? "—" : money(i.precio)}</td>
                        <td>{money(i.parcial)}</td>
                        <td>{i.partidas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </section>
      ) : null}

      {set.has("insumos-partida") ? (
        <section className="pre-print-report">
          <Head state={state} calc={calc} hoja="Insumos por partida" />
          {calc.lineas.map((l) => (
            <div key={`ip-${l.linea.id}`}>
              <h2>
                {l.partida.codigo} · {l.partida.descripcion}
                <span>
                  Metrado {money(l.linea.metrado, 2)} {l.partida.und}
                </span>
              </h2>
              <table className="data">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Recurso</th>
                    <th>Und</th>
                    <th>Cuadrilla</th>
                    <th>Cant. obra</th>
                    <th>Parcial S/</th>
                  </tr>
                </thead>
                <tbody>
                  {l.apu.recursos.map((r) => (
                    <tr key={r.insumo.id}>
                      <td>{r.insumo.codigo}</td>
                      <td>{r.insumo.nombre}</td>
                      <td>{r.insumo.und}</td>
                      <td>{money(r.cantidad, 4)}</td>
                      <td>{money(r.cantidad * l.linea.metrado, 3)}</td>
                      <td>{money(r.parcial * l.linea.metrado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      ) : null}

      {set.has("particionado") ? (
        <section className="pre-print-report">
          <Head state={state} calc={calc} hoja="Costos particionados por etapa de construcción" />
          <p>
            Desglose del costo directo en mano de obra, materiales, maquinaria y equipos, con gastos generales
            prorrateados por partida. Cada etapa (cimentación, estructura, albañilería, …) se abre en sus rubros de
            obra: zapatas y platea, vigas de cimentación, columnas, solados, y lo que corresponda.
          </p>
          <table className="data">
            <thead>
              <tr>
                <th>Resumen de obra</th>
                <th>Mano de obra</th>
                <th>Materiales</th>
                {hayMaq ? <th>Maquinaria</th> : null}
                {hayEq ? <th>Equipos</th> : null}
                <th>Costo directo</th>
                <th>GG</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Costo directo particionado</td>
                <td>{money(part.mo)}</td>
                <td>{money(part.mat)}</td>
                {hayMaq ? <td>{money(part.maq)}</td> : null}
                {hayEq ? <td>{money(part.eq)}</td> : null}
                <td>{money(part.directo)}</td>
                <td>{money(part.gg)}</td>
                <td>{money(part.directo + part.gg)}</td>
              </tr>
              <tr>
                <td>Utilidad ({state.utilidad} %)</td>
                <td colSpan={4 + (hayMaq ? 1 : 0) + (hayEq ? 1 : 0)} />
                <td>{money(part.utilidad)}</td>
              </tr>
              <tr>
                <td>Subtotal</td>
                <td colSpan={4 + (hayMaq ? 1 : 0) + (hayEq ? 1 : 0)} />
                <td>{money(part.subtotal)}</td>
              </tr>
              <tr>
                <td>IGV ({state.igv} %)</td>
                <td colSpan={4 + (hayMaq ? 1 : 0) + (hayEq ? 1 : 0)} />
                <td>{money(part.igv)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Presupuesto total</strong>
                </td>
                <td colSpan={4 + (hayMaq ? 1 : 0) + (hayEq ? 1 : 0)} />
                <td>
                  <strong>{moneyMon(part.total, state.moneda)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          {part.etapas.map((etapa) => (
            <div key={etapa.id} className="pre-print-etapa">
              <h2>
                {etapa.titulo}
                <span>
                  {etapa.partidas} partidas · CD {moneyMon(etapa.directo, state.moneda)}
                </span>
              </h2>
              <table className="data">
                <thead>
                  <tr>
                    <th>Rubro</th>
                    <th>Partidas</th>
                    <th>Mano de obra</th>
                    <th>Materiales</th>
                    {hayMaq ? <th>Maquinaria</th> : null}
                    {hayEq ? <th>Equipos</th> : null}
                    <th>Costo directo</th>
                    <th>GG prorrateados</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {etapa.rubros.map((r) => (
                    <tr key={r.id}>
                      <td>{r.titulo}</td>
                      <td>{r.partidas}</td>
                      <td>{money(r.mo)}</td>
                      <td>{money(r.mat)}</td>
                      {hayMaq ? <td>{money(r.maq)}</td> : null}
                      {hayEq ? <td>{money(r.eq)}</td> : null}
                      <td>{money(r.directo)}</td>
                      <td>{money(r.gg)}</td>
                      <td>{money(r.total)}</td>
                    </tr>
                  ))}
                  <tr className="pre-print-cap">
                    <td>
                      <strong>Total {etapa.titulo}</strong>
                    </td>
                    <td>
                      <strong>{etapa.partidas}</strong>
                    </td>
                    <td>
                      <strong>{money(etapa.mo)}</strong>
                    </td>
                    <td>
                      <strong>{money(etapa.mat)}</strong>
                    </td>
                    {hayMaq ? (
                      <td>
                        <strong>{money(etapa.maq)}</strong>
                      </td>
                    ) : null}
                    {hayEq ? (
                      <td>
                        <strong>{money(etapa.eq)}</strong>
                      </td>
                    ) : null}
                    <td>
                      <strong>{money(etapa.directo)}</strong>
                    </td>
                    <td>
                      <strong>{money(etapa.gg)}</strong>
                    </td>
                    <td>
                      <strong>{money(etapa.total)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </section>
      ) : null}

      {set.has("gg") ? (
        <section className="pre-print-report">
          <Head state={state} calc={calc} hoja="Gastos generales" />
          <p>
            {state.ggModo === "organigrama"
              ? "Los gastos generales se calculan con el organigrama de obra."
              : `Los gastos generales se aplican como ${state.gg} % del costo directo. El organigrama se adjunta como referencia.`}
          </p>
          <table className="data">
            <thead>
              <tr>
                <th>Cargo</th>
                <th>Persona</th>
                <th>Cálculo</th>
                <th>Parcial S/</th>
              </tr>
            </thead>
            <tbody>
              {(state.organigrama ?? []).map((n) => (
                <tr key={n.id}>
                  <td>{n.cargo}</td>
                  <td>{n.nombre || "—"}</td>
                  <td>{formulaNodo(n)}</td>
                  <td>{money(n.tipo === "grupo" ? costoRama(state.organigrama, n.id) : costoPropioNodo(n))}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3}>
                  <strong>Total organigrama</strong>
                </td>
                <td>
                  <strong>
                    S/{" "}
                    {money(
                      (state.organigrama ?? [])
                        .filter((n) => !n.parentId)
                        .reduce((s, n) => s + costoRama(state.organigrama ?? [], n.id), 0)
                    )}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}

      {set.has("formula") ? (
        <section className="pre-print-report">
          <Head state={state} calc={calc} hoja="Fórmula polinómica de reajuste" />
          {formula.creada ? (
            <>
              <p>{formula.texto}</p>
              <p>
                K = {formula.k.toFixed(4)} · V × K = {moneyMon(formula.reajustado, state.moneda)} · Σ coeficientes ={" "}
                {formula.sumaCoef.toFixed(3)}
              </p>
              <table className="data">
                <thead>
                  <tr>
                    <th>Letra</th>
                    <th>IU</th>
                    <th>Índice</th>
                    <th>Monto S/</th>
                    <th>Coeficiente</th>
                    <th>Io</th>
                    <th>Ir</th>
                    <th>Ir/Io</th>
                    <th>Aporte</th>
                  </tr>
                </thead>
                <tbody>
                  {formula.monomios.map((m) => (
                    <tr key={m.letra}>
                      <td>{m.letra}</td>
                      <td>{m.iu}</td>
                      <td>
                        {m.simbolo} · {m.nombre}
                      </td>
                      <td>{money(m.monto)}</td>
                      <td>{m.coeficiente.toFixed(3)}</td>
                      <td>{money(m.io, 2)}</td>
                      <td>{money(m.ir, 2)}</td>
                      <td>{m.ratio.toFixed(4)}</td>
                      <td>{m.aporte.toFixed(4)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3}>
                      <strong>K</strong>
                    </td>
                    <td>{money(formula.monomios.reduce((s, m) => s + m.monto, 0))}</td>
                    <td>{formula.sumaCoef.toFixed(3)}</td>
                    <td colSpan={3} />
                    <td>
                      <strong>{formula.k.toFixed(4)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
              <h3>Incidencias y agrupación</h3>
              <table className="data">
                <thead>
                  <tr>
                    <th>IU</th>
                    <th>Índice</th>
                    <th>Monto S/</th>
                    <th>% CD</th>
                    <th>Trato</th>
                  </tr>
                </thead>
                <tbody>
                  {formula.incidencias.map((x) => (
                    <tr key={x.iu}>
                      <td>{codigoIU(x.iu)}</td>
                      <td>
                        {x.simbolo} · {x.nombre}
                      </td>
                      <td>{money(x.monto)}</td>
                      <td>{money(x.pct, 2)} %</td>
                      <td>{textoTrato(x, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p>Fórmula polinómica no generada. Créela en el módulo de fórmula polinómica a partir del costo directo.</p>
          )}
        </section>
      ) : null}

      {set.has("especificaciones") ? (
        <section className="pre-print-report et-print-report">
          <header className="et-cover et-cover-print">
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
              Fichas de ejecución, medición y pago de cada partida del presupuesto. El precio unitario de contrato no se
              altera en este documento.
            </p>
            <table className="et-meta">
              <tbody>
                <tr>
                  <th>Obra</th>
                  <td>{state.obra || "—"}</td>
                </tr>
                <tr>
                  <th>Ubicación</th>
                  <td>
                    {state.lugar || "—"}
                    {state.direccion ? ` · ${state.direccion}` : ""}
                  </td>
                </tr>
                <tr>
                  <th>Cliente</th>
                  <td>
                    {state.cliente || "—"}
                    {state.rucCliente ? ` · RUC ${state.rucCliente}` : ""}
                  </td>
                </tr>
                <tr>
                  <th>Sistema</th>
                  <td>
                    {SISTEMA_CONTRATACION_META[state.sistemaContratacion]} · {state.fecha || "—"}
                  </td>
                </tr>
                <tr>
                  <th>Fichas</th>
                  <td>{calc.lineas.length} partidas</td>
                </tr>
              </tbody>
            </table>
          </header>
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
              {calc.lineas.map((l, i) => {
                const s = especificacionDe(l.partida);
                return (
                  <tr key={l.linea.id}>
                    <td>{String(i + 1).padStart(3, "0")}</td>
                    <td>{s.codigo}</td>
                    <td>{s.titulo}</td>
                    <td>{s.unidad}</td>
                    <td>{l.linea.metrado}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {calc.lineas.map((l, i) => (
            <EspecificacionFicha
              key={l.linea.id}
              s={especificacionDe(l.partida)}
              n={i + 1}
              metrado={l.linea.metrado}
            />
          ))}
        </section>
      ) : null}
    </article>
  );
}
