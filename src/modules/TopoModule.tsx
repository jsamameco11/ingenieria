import { useMemo, useState } from "react";
import {
  LIBRETA_DEFAULTS,
  TAQUI_DEFAULTS,
  calcularTaquimetria,
  filaEstacion,
  filaVisada,
  fmtAz,
  informeTopo,
  type DiModo,
  type FilaTopo,
  type TopoInput,
  type TopoModo,
  type VerticalModo,
} from "../lib/topo/taquimetria";
import { fmt, fmtFixed } from "../lib/num";
import { Field, Num, Text } from "../ui/Field";
import { CalcDirtyNote, CalcularButton, MemoriaPendiente, useMemoriaOnCalcular } from "../ui/calcular";
import { Paper } from "../ui/Paper";
import { TopoPerfilSvg, TopoPlanSvg } from "../ui/topoDiagrams";
import { exportarWord } from "../lib/exportWord";
import { printMemoria } from "../lib/printDoc";

function cloneInp(src: TopoInput): TopoInput {
  return { ...src, filas: src.filas.map((f) => ({ ...f })) };
}

export function TopoModule({ modo }: { modo: TopoModo }) {
  const [inp, setInp] = useState<TopoInput>(() => cloneInp(modo === "taqui" ? TAQUI_DEFAULTS : LIBRETA_DEFAULTS));
  const set = <K extends keyof TopoInput>(k: K, v: TopoInput[K]) => setInp((s) => ({ ...s, [k]: v }));
  const r = useMemo(() => calcularTaquimetria(inp), [inp]);
  const doc = useMemo(() => informeTopo(modo, inp, r), [modo, inp, r]);
  const livePack = useMemo(() => ({ doc, inp, r, modo }), [doc, inp, r, modo]);
  const { doc: pack, dirty, calcular } = useMemoriaOnCalcular(livePack, modo);
  const memoria = pack.doc;
  const stadia = modo === "libreta";

  const patch = (id: string, p: Partial<FilaTopo>) =>
    setInp((s) => ({ ...s, filas: s.filas.map((f) => (f.id === id ? { ...f, ...p } : f)) }));
  const remove = (id: string) => setInp((s) => ({ ...s, filas: s.filas.filter((f) => f.id !== id) }));
  const addEst = () => {
    const last = [...inp.filas].reverse().find((f) => f.tipo === "estacion") ?? inp.filas[inp.filas.length - 1];
    const name = last?.est ? String.fromCharCode(Math.min(90, (last.est.charCodeAt(0) || 64) + 1)) : "E";
    setInp((s) => ({ ...s, filas: [...s.filas, filaEstacion(name, last?.est ?? "", last?.hi || 1.4)] }));
  };
  const addVis = () => {
    const est = [...inp.filas].reverse().find((f) => f.est)?.est ?? "A";
    setInp((s) => ({ ...s, filas: [...s.filas, filaVisada(est, "")] }));
  };

  return (
    <>
      <aside id="app-panel" className="panel">
        <h2>{modo === "taqui" ? "Taquimetría" : "Libreta de radiación"}</h2>
        <p className="lead">
          {modo === "taqui"
            ? "Ejemplo desarrollado. Edite la cartera y pulse Calcular para actualizar el informe (Dh, Dv, cota y coordenadas)."
            : "Ejemplo desarrollado. Edite la libreta y pulse Calcular para actualizar el informe (radiación y coordenadas X–Y–Z)."}
        </p>
        <CalcDirtyNote dirty={dirty} />

        <fieldset className="fieldset">
          <legend>Memoria</legend>
          <Field label="Proyecto">
            <Text value={inp.proyecto} onChange={(v) => set("proyecto", v)} />
          </Field>
          <Field label="Ubicación">
            <Text value={inp.ubicacion} onChange={(v) => set("ubicacion", v)} />
          </Field>
          <div className="grid-2">
            <Field label="Fecha">
              <Text value={inp.fecha} onChange={(v) => set("fecha", v)} />
            </Field>
            <Field label="Profesional">
              <Text value={inp.profesional} onChange={(v) => set("profesional", v)} />
            </Field>
          </div>
          <Field label="Instrumental">
            <Text value={inp.instrumento} onChange={(v) => set("instrumento", v)} />
          </Field>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Origen y criterio</legend>
          <div className="grid-2">
            <Field label="X₀ este" unit="m">
              <Num value={inp.x0} onChange={(v) => set("x0", v)} />
            </Field>
            <Field label="Y₀ norte" unit="m">
              <Num value={inp.y0} onChange={(v) => set("y0", v)} />
            </Field>
            <Field label="Z₀ (BM)" unit="m">
              <Num value={inp.z0} onChange={(v) => set("z0", v)} />
            </Field>
            <Field label="Azimut del 0°" unit="°">
              <Num value={inp.az0} onChange={(v) => set("az0", v)} />
            </Field>
          </div>
          <Field label="Ángulo vertical">
            <select value={inp.vertical} onChange={(e) => set("vertical", e.target.value as VerticalModo)}>
              <option value="cenital">Cenital (Wild / 90° = horizonte)</option>
              <option value="altura">De altura (0° = horizonte)</option>
            </select>
          </Field>
          <Field label="Distancia Di">
            <select value={inp.diModo} onChange={(e) => set("diModo", e.target.value as DiModo)}>
              <option value="generatriz">Generatriz medida (wincha / Di)</option>
              <option value="estadia">Estadía Di = K · (HS − HI)</option>
            </select>
          </Field>
          {stadia || inp.diModo === "estadia" ? (
            <Field label="Constante de estadía K">
              <Num value={inp.kEstadia} onChange={(v) => set("kEstadia", v)} step="1" />
            </Field>
          ) : null}
          <p className="lead" style={{ marginTop: 8 }}>
            {r.nVisadas} visadas · {r.estaciones.length} estaciones · ΔH {fmt(r.dz, 2)} m
          </p>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Cartera de campo</legend>
          <p className="lead">Rojo de campo: estación, P.V., Di, Hz, V, Hi, Lm. El resto se calcula.</p>
          {inp.filas.map((f) => (
            <div key={f.id} className={`topo-card${f.tipo === "estacion" ? " is-est" : ""}`}>
              <div className="topo-card-head">
                <select
                  value={f.tipo}
                  onChange={(e) => patch(f.id, { tipo: e.target.value as FilaTopo["tipo"] })}
                >
                  <option value="estacion">Ocupación</option>
                  <option value="visada">Visada</option>
                </select>
                <button type="button" className="topo-x" onClick={() => remove(f.id)} aria-label="Quitar fila">
                  ×
                </button>
              </div>
              <div className="grid-2">
                <Field label="Est.">
                  <input value={f.est} onChange={(e) => patch(f.id, { est: e.target.value })} />
                </Field>
                <Field label={f.tipo === "estacion" ? "Espalda / P.V." : "P.V."}>
                  <input value={f.pv} onChange={(e) => patch(f.id, { pv: e.target.value })} />
                </Field>
              </div>
              {f.tipo === "estacion" ? (
                <>
                  <div className="grid-2">
                    <Field label="Hi" unit="m">
                      <Num value={f.hi} onChange={(v) => patch(f.id, { hi: v })} />
                    </Field>
                    <Field label="Cota BM" unit="m">
                      <input
                        type="number"
                        step="any"
                        placeholder="(de visada previa)"
                        value={f.cotaBm ?? ""}
                        onChange={(e) => patch(f.id, { cotaBm: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      />
                    </Field>
                  </div>
                  <div className="topo-dms">
                    <span>Hz</span>
                    <Num value={f.hzG} onChange={(v) => patch(f.id, { hzG: v })} step="1" />
                    <span>°</span>
                    <Num value={f.hzM} onChange={(v) => patch(f.id, { hzM: v })} step="1" />
                    <span>′</span>
                    <Num value={f.hzS} onChange={(v) => patch(f.id, { hzS: v })} step="1" />
                  </div>
                  <p className="lead" style={{ margin: "0 0 4px" }}>
                    Hz de la espalda (0° si se cierra el círculo en el punto visado).
                  </p>
                </>
              ) : (
                <>
                  <div className="grid-2">
                    <Field label="Di" unit="m">
                      <Num value={f.di} onChange={(v) => patch(f.id, { di: v })} />
                    </Field>
                    <Field label="Lm mira" unit="m">
                      <Num value={f.lm} onChange={(v) => patch(f.id, { lm: v })} />
                    </Field>
                  </div>
                  {stadia ? (
                    <div className="grid-2">
                      <Field label="H.S." unit="m">
                        <Num value={f.hs} onChange={(v) => patch(f.id, { hs: v })} />
                      </Field>
                      <Field label="H.I." unit="m">
                        <Num value={f.hiHilo} onChange={(v) => patch(f.id, { hiHilo: v })} />
                      </Field>
                    </div>
                  ) : null}
                  <div className="topo-dms">
                    <span>Hz</span>
                    <Num value={f.hzG} onChange={(v) => patch(f.id, { hzG: v })} step="1" />
                    <span>°</span>
                    <Num value={f.hzM} onChange={(v) => patch(f.id, { hzM: v })} step="1" />
                    <span>′</span>
                    <Num value={f.hzS} onChange={(v) => patch(f.id, { hzS: v })} step="1" />
                  </div>
                  <div className="topo-dms">
                    <span>V</span>
                    <Num value={f.vzG} onChange={(v) => patch(f.id, { vzG: v })} step="1" />
                    <span>°</span>
                    <Num value={f.vzM} onChange={(v) => patch(f.id, { vzM: v })} step="1" />
                    <span>′</span>
                    <Num value={f.vzS} onChange={(v) => patch(f.id, { vzS: v })} step="1" />
                  </div>
                  <div className="grid-2">
                    <Field label="Hi (vacío = estación)" unit="m">
                      <Num
                        value={f.hi > 0 ? f.hi : inp.filas.find((x) => x.tipo === "estacion" && x.est === f.est)?.hi || 0}
                        onChange={(v) => patch(f.id, { hi: v })}
                      />
                    </Field>
                    <Field label="Observación">
                      <input value={f.obs} onChange={(e) => patch(f.id, { obs: e.target.value })} />
                    </Field>
                  </div>
                </>
              )}
            </div>
          ))}
          <div className="tas-row-actions" style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn secondary" onClick={addEst}>
              + Ocupación
            </button>
            <button type="button" className="btn secondary" onClick={addVis}>
              + Visada
            </button>
          </div>
        </fieldset>

        <div className="actions">
          <CalcularButton onClick={calcular} dirty={dirty} />
          <button className="btn" disabled={!memoria} onClick={() => memoria && exportarWord(memoria)}>
            Exportar Word
          </button>
          <button className="btn secondary" disabled={!memoria} onClick={() => memoria && printMemoria(memoria.titulo)}>
            Imprimir / PDF
          </button>
        </div>
      </aside>

      {memoria ? <Paper
        doc={memoria}
        extra={
          <div className="croquis-board croquis-board-compact">
            <div className="croquis">
              <TopoPlanSvg r={pack.r} />
            </div>
            <aside className="ficha">
              <div className="ficha-head">
                <span>Resumen del levantamiento</span>
                <span>{pack.modo === "taqui" ? "TOP-01" : "TOP-02"}</span>
              </div>
              <table>
                <tbody>
                  {(
                    [
                      ["Proyecto", pack.inp.proyecto, ""],
                      ["Estaciones", String(pack.r.estaciones.length), ""],
                      ["Visadas", String(pack.r.nVisadas), ""],
                      ["Σ Dh", fmt(pack.r.longRed, 2), "m"],
                      ["Z mín", fmtFixed(pack.r.zMin, 2), "m"],
                      ["Z máx", fmtFixed(pack.r.zMax, 2), "m"],
                      ["Desnivel", fmt(pack.r.dz, 2), "m"],
                      ["Origen", `(${fmt(pack.inp.x0, 1)}; ${fmt(pack.inp.y0, 1)})`, "m"],
                      ["Az₀", fmtAz(pack.inp.az0), ""],
                      [
                        "Vertical",
                        pack.inp.vertical === "cenital" ? "Cenital" : "Altura",
                        "",
                      ],
                    ] as [string, string, string][]
                  ).map(([k, v, u]) => (
                    <tr key={k}>
                      <td className="k">{k}</td>
                      <td className="v">{v}</td>
                      <td className="u">{u}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </aside>
            <div className="ficha-adopt">
              <span>Criterio</span>
              <strong>
                Dh = Di cos² α · Z = Zest + Hi + Dv − Lm
              </strong>
            </div>
          </div>
        }
        renderFigure={(part) => (part === "perfil" ? <TopoPerfilSvg r={pack.r} /> : null)}
      /> : <MemoriaPendiente />}
    </>
  );
}
