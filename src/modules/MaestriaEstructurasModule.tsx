import { useMemo, useState } from "react";
import { MaeCanvas, LosaIdentificacion, PlantIdentificacion } from "../components/maestria/MaeCanvas";
import { MaeMomentStrip, MaePunchFromDims, MaeReport, MaeSteelPlan } from "../components/maestria/MaeFigs";
import { calcLosa2d } from "../lib/engines/maestria/losa2dCalc";
import { calcPlatea } from "../lib/engines/maestria/plateaCalc";
import { calcZapataCorrida } from "../lib/engines/maestria/zapataCalc";
import { dumpBoth } from "../lib/engines/maestria/drawCommon";
import {
  createGridAxes,
  createLosaAxes,
  defaultModel,
  dumpMae,
  exampleModel,
  fillLosaRoof,
  placeColsOnPainted,
  setAllGradeBeams,
  type MaeMat,
  type MaeMode,
  type MaeModel,
  type MaeTool,
} from "../lib/engines/maestria/types";
import type { CalcOutput } from "../lib/types";

const TABS: { id: MaeMode; title: string; blurb: string }[] = [
  { id: "losa", title: "Losa en dos direcciones", blurb: "Crear ejes, marcar techos/huecos, unir paños. ACI-3 + Marcus + franjas reales (no 2 genéricas)." },
  { id: "zapata", title: "Zapata corrida", blurb: "Pinte la planta (L o irregular). Clic en nudos para columnas con 6 GDL." },
  { id: "platea", title: "Platea de cimentación", blurb: "Franjas, Westergaard, espesor iterado y punzonamiento con perímetro crítico." },
];

const MAT0: Record<MaeMode, MaeMat> = {
  losa: { hCm: 15, recCm: 2.5, D: 0, L: 250, fy: 4200, fc: 210, qadm: 2, Df: 1.5, gt: 1.8, sc: 0.3, Ks: 8, bBeam: 0.4, hBeam: 0.6 },
  zapata: { hCm: 45, recCm: 7.5, D: 0, L: 0, fy: 4200, fc: 210, qadm: 2, Df: 1.5, gt: 1.8, sc: 0.3, Ks: 8, bBeam: 0.4, hBeam: 0.6 },
  platea: { hCm: 50, recCm: 7.5, D: 0, L: 0, fy: 4200, fc: 210, qadm: 1.5, Df: 1.2, gt: 1.8, sc: 0.3, Ks: 8, bBeam: 0.4, hBeam: 0.6 },
};

function toRaw(mode: MaeMode, model: MaeModel, mat: MaeMat, extra: Record<string, string> = {}): Record<string, string> {
  const both = dumpBoth(model);
  const h = mode === "losa" ? mat.hCm : mat.hCm / 100;
  return {
    ...both,
    studioJson: dumpMae(model),
    h: String(mode === "losa" ? mat.hCm : h),
    t: String(mode === "platea" ? h : mat.hCm / 100),
    hf: String(mat.hCm / 100),
    rec: String(mat.recCm),
    cm: String(mat.D),
    cv: String(mat.L),
    fy: String(mat.fy),
    fc: String(mat.fc),
    qadm: String(mat.qadm),
    Df: String(mat.Df),
    gt: String(mat.gt),
    sc: String(mat.sc),
    Ks: String(mat.Ks),
    bBeam: String(mat.bBeam),
    hBeam: String(mat.hBeam),
    tipo: "columnas",
    nX: String(Math.max(1, model.axesX.length - 1)),
    nY: String(Math.max(1, model.axesY.length - 1)),
    nBayX: String(Math.max(1, model.axesX.length - 1)),
    nBayY: String(Math.max(1, model.axesY.length - 1)),
    ...extra,
  };
}

function run(mode: MaeMode, raw: Record<string, string>): CalcOutput {
  if (mode === "losa") return calcLosa2d(raw);
  if (mode === "zapata") return calcZapataCorrida(raw);
  return calcPlatea(raw);
}

export function MaestriaEstructurasModule() {
  const [tab, setTab] = useState<MaeMode>("losa");
  const [models, setModels] = useState<Record<MaeMode, MaeModel>>({
    losa: defaultModel("losa"),
    zapata: defaultModel("zapata"),
    platea: defaultModel("platea"),
  });
  const [mats, setMats] = useState(MAT0);
  const [tool, setTool] = useState<MaeTool>("celda");
  const [sel, setSel] = useState<string | null>(null);
  const [result, setResult] = useState<CalcOutput | null>(null);
  const [losaTipo, setLosaTipo] = useState<"maciza" | "aligerada">("maciza");
  const [acab, setAcab] = useState(100);
  const [tabique, setTabique] = useState(0);
  const [sAli, setSAli] = useState(40);
  const [bwAli, setBwAli] = useState(10);
  const [hfAli, setHfAli] = useState(5);
  const [relleno, setRelleno] = useState<"ladrillo" | "eps">("ladrillo");

  const model = models[tab];
  const mat = mats[tab];

  const calcular = () => {
    const extra: Record<string, string> =
      tab === "losa"
        ? {
            tipoLosa: losaTipo,
            acab: String(acab),
            tab: String(losaTipo === "aligerada" ? tabique || 150 : tabique),
            sAli: String(sAli),
            bwAli: String(bwAli),
            hfAli: String(hfAli),
            relleno,
          }
        : {};
    setResult(run(tab, toRaw(tab, model, mat, extra)));
  };

  const patchMat = (p: Partial<MaeMat>) => setMats((s) => ({ ...s, [tab]: { ...s[tab], ...p } }));
  const setModel = (next: MaeModel) => setModels((s) => ({ ...s, [tab]: next }));

  const tools: { id: MaeTool; label: string }[] = useMemo(() => {
    if (tab === "losa") return [
      { id: "celda", label: "Paño on/off" },
      { id: "unir", label: "Unir / separar" },
      { id: "apoyo", label: "Apoyo del eje" },
    ];
    return [
      { id: "celda", label: "Pintar planta" },
      { id: "viga", label: "Viga cim." },
      { id: "columna", label: "Colocar columna" },
    ];
  }, [tab]);

  const dims = result?.dims ?? {};

  return (
    <div className="mae-studio">
      <header className="mae-head">
        <p className="mae-kicker">Maestría en estructuras · E.060 / ACI 318 · suelo E.050</p>
        <h1>Losa, zapata corrida y platea</h1>
        <p>
          Cada pestaña tiene motor de cálculo y motor de dibujo propios. Informe con fórmula, sustitución, resultado y criterio de norma.
          En zapata y platea las columnas <strong>no se generan solas</strong>: hay que clicar el entrecruce.
        </p>
      </header>
      <nav className="mae-tabs" aria-label="Módulos">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? "is-on" : ""} onClick={() => { setTab(t.id); setResult(null); setSel(null); setTool(t.id === "losa" ? "celda" : "celda"); }}>
            <strong>{t.title}</strong>
            <span>{t.blurb}</span>
          </button>
        ))}
      </nav>
      <div className="mae-body">
        <aside className="mae-side">
          <div className="mae-tools">
            {tools.map((t) => (
              <button key={t.id} type="button" className={tool === t.id ? "is-on" : ""} onClick={() => setTool(t.id)}>
                {t.label}
              </button>
            ))}
            {tab === "losa" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setModel(createLosaAxes(model, model.axesX.length - 1, model.axesY.length - 1));
                    setResult(null);
                    setTool("celda");
                  }}
                >
                  Crear ejes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModel(fillLosaRoof(model, true));
                    setResult(null);
                  }}
                >
                  Todos techo
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setModel(createGridAxes(model, model.axesX.length - 1, model.axesY.length - 1, { resetCells: true, paint: false }));
                    setResult(null);
                    setSel(null);
                    setTool("celda");
                  }}
                >
                  Crear grilla
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModel(fillLosaRoof(model, true));
                    setResult(null);
                  }}
                >
                  Pintar toda
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModel(placeColsOnPainted(model, tab));
                    setResult(null);
                    setTool("columna");
                  }}
                >
                  Columnas en nudos
                </button>
                <button type="button" onClick={() => { setModel(setAllGradeBeams(model, true)); setResult(null); }}>
                  Vigas en bordes
                </button>
              </>
            )}
            <button type="button" onClick={() => { setModel(exampleModel(tab)); setResult(null); }}>
              Cargar ejemplo de planta
            </button>
          </div>
          {tab !== "losa" && tool === "viga" ? (
            <p className="mae-hint">Viga cim.: pulse un tramo grueso para borrarlo o un borde discontinuo para colocarlo. Una viga a la vez.</p>
          ) : null}
          <div className="mae-tools">
            <label>
              {tab === "losa" ? "Paños X" : "Vanos X"}
              <input type="number" min={1} max={12} value={model.axesX.length - 1} onChange={(e) => setModel(tab === "losa" ? createLosaAxes(model, Number(e.target.value) || 1, model.axesY.length - 1, false) : createGridAxes(model, Number(e.target.value) || 1, model.axesY.length - 1, { resetCells: false, paint: false }))} />
            </label>
            <label>
              {tab === "losa" ? "Paños Y" : "Vanos Y"}
              <input type="number" min={1} max={12} value={model.axesY.length - 1} onChange={(e) => setModel(tab === "losa" ? createLosaAxes(model, model.axesX.length - 1, Number(e.target.value) || 1, false) : createGridAxes(model, model.axesX.length - 1, Number(e.target.value) || 1, { resetCells: false, paint: false }))} />
            </label>
          </div>
          {tab === "losa" ? (
            <div className="mae-vol">
              <label>Volado N (m)<input type="number" step="0.1" value={model.volN} onChange={(e) => setModel({ ...model, volN: Number(e.target.value) || 0 })} /></label>
              <label>Volado S (m)<input type="number" step="0.1" value={model.volS} onChange={(e) => setModel({ ...model, volS: Number(e.target.value) || 0 })} /></label>
              <label>Volado E (m)<input type="number" step="0.1" value={model.volE} onChange={(e) => setModel({ ...model, volE: Number(e.target.value) || 0 })} /></label>
              <label>Volado O (m)<input type="number" step="0.1" value={model.volW} onChange={(e) => setModel({ ...model, volW: Number(e.target.value) || 0 })} /></label>
            </div>
          ) : null}
          <MaeCanvas mode={tab} model={model} tool={tool} sel={sel} onSelect={setSel} onChange={(next) => setModel(next)} />
          {tab === "losa" ? <LosaIdentificacion model={model} tipo={losaTipo} /> : <PlantIdentificacion mode={tab} model={model} />}
          <fieldset className="fieldset">
            <legend>Hoja de datos</legend>
            {tab === "losa" ? (
              <>
                <label>
                  Tipo de losa
                  <select value={losaTipo} onChange={(e) => { setLosaTipo(e.target.value === "aligerada" ? "aligerada" : "maciza"); if (e.target.value === "aligerada" && mat.hCm < 17) patchMat({ hCm: 20 }); }}>
                    <option value="maciza">Losa maciza</option>
                    <option value="aligerada">Losa aligerada</option>
                  </select>
                </label>
                <label>{losaTipo === "aligerada" ? "Espesor e (cm)" : "Espesor h (cm)"}<input type="number" step="0.5" value={mat.hCm} onChange={(e) => patchMat({ hCm: Number(e.target.value) || 12 })} /></label>
                <label>Recubrimiento (cm)<input type="number" step="0.5" value={mat.recCm} onChange={(e) => patchMat({ recCm: Number(e.target.value) || 2 })} /></label>
                {losaTipo === "aligerada" ? (
                  <>
                    <label>Entre-eje s (cm)<input type="number" step="1" value={sAli} onChange={(e) => setSAli(Number(e.target.value) || 40)} /></label>
                    <label>Nervio bw (cm)<input type="number" step="1" value={bwAli} onChange={(e) => setBwAli(Number(e.target.value) || 10)} /></label>
                    <label>Loseta hf (cm)<input type="number" step="0.5" value={hfAli} onChange={(e) => setHfAli(Number(e.target.value) || 5)} /></label>
                    <label>
                      Relleno
                      <select value={relleno} onChange={(e) => setRelleno(e.target.value === "eps" ? "eps" : "ladrillo")}>
                        <option value="ladrillo">Ladrillo hueco</option>
                        <option value="eps">EPS</option>
                      </select>
                    </label>
                  </>
                ) : null}
                <label>Acabados (kg/m²)<input type="number" step="10" value={acab} onChange={(e) => setAcab(Number(e.target.value) || 0)} /></label>
                <label>Tabiquería (kg/m²)<input type="number" step="10" value={tabique} onChange={(e) => setTabique(Number(e.target.value) || 0)} /></label>
                <label>L / CV (kg/m²)<input type="number" step="10" value={mat.L} onChange={(e) => patchMat({ L: Number(e.target.value) || 0 })} /></label>
              </>
            ) : (
              <>
                <label>h / t inicial (cm)<input type="number" step="1" value={mat.hCm} onChange={(e) => patchMat({ hCm: Number(e.target.value) || 35 })} /></label>
                <label>Recubrimiento (cm)<input type="number" step="0.5" value={mat.recCm} onChange={(e) => patchMat({ recCm: Number(e.target.value) || 7.5 })} /></label>
                <label>σadm (kg/cm²)<input type="number" step="0.1" value={mat.qadm} onChange={(e) => patchMat({ qadm: Number(e.target.value) || 1 })} /></label>
                <label>Df (m)<input type="number" step="0.1" value={mat.Df} onChange={(e) => patchMat({ Df: Number(e.target.value) || 1 })} /></label>
                <label>γ terreno (t/m³)<input type="number" step="0.05" value={mat.gt} onChange={(e) => patchMat({ gt: Number(e.target.value) || 1.8 })} /></label>
                <label>s/c piso (t/m²)<input type="number" step="0.05" value={mat.sc} onChange={(e) => patchMat({ sc: Number(e.target.value) || 0 })} /></label>
              </>
            )}
            {tab === "platea" ? <label>Ks (kg/cm³)<input type="number" step="0.5" value={mat.Ks} onChange={(e) => patchMat({ Ks: Number(e.target.value) || 4 })} /></label> : null}
            {tab === "zapata" ? (
              <>
                <label>b viga (m)<input type="number" step="0.05" value={mat.bBeam} onChange={(e) => patchMat({ bBeam: Number(e.target.value) || 0.3 })} /></label>
                <label>h viga (m)<input type="number" step="0.05" value={mat.hBeam} onChange={(e) => patchMat({ hBeam: Number(e.target.value) || 0.5 })} /></label>
              </>
            ) : null}
            <label>f'c (kg/cm²)<input type="number" step="10" value={mat.fc} onChange={(e) => patchMat({ fc: Number(e.target.value) || 210 })} /></label>
            <label>fy (kg/cm²)<input type="number" step="100" value={mat.fy} onChange={(e) => patchMat({ fy: Number(e.target.value) || 4200 })} /></label>
          </fieldset>
          <div className="actions">
            <button type="button" className="btn" onClick={calcular}>
              Calcular memoria
            </button>
          </div>
        </aside>
        <section className="mae-main">
          {result ? (
            <>
              <MaeReport headline={result.headline} adoption={result.adoption} steps={result.steps} checks={result.checks} />
              <h3>Gráficos del motor de dibujo</h3>
              {tab === "losa" ? (
                <>
                  {(() => {
                    let figs: { title: string; pts: string; L: number; MuPos: number; MuNeg: number }[] = [];
                    try {
                      figs = JSON.parse(dims.stripFigsJson || "[]") as typeof figs;
                    } catch {
                      figs = [];
                    }
                    if (!figs.length) {
                      return (
                        <>
                          <MaeMomentStrip title="Franja equivalente X — momentos" formula="K u = F" ptsRaw={dims.mPtsX} L={Number(dims.bStripX) || 12} MuPos={Number(dims.mStripXMpos)} MuNeg={Number(dims.mStripXMneg)} />
                          <MaeMomentStrip title="Franja equivalente Y — momentos" formula="K u = F" ptsRaw={dims.mPtsY} L={Number(dims.bStripY) || 10} MuPos={Number(dims.mStripYMpos)} MuNeg={Number(dims.mStripYMneg)} />
                        </>
                      );
                    }
                    return figs.map((f) => (
                      <MaeMomentStrip key={f.title} title={f.title} formula="K u = F" ptsRaw={f.pts} L={f.L} MuPos={f.MuPos} MuNeg={f.MuNeg} />
                    ));
                  })()}
                  <MaeSteelPlan model={model} bars={{ infX: dims.asInfX || 'Ø 3/8" @ 20', infY: dims.asInfY || 'Ø 3/8" @ 20', supX: dims.asSupX || 'Ø 3/8" @ 20', supY: dims.asSupY || 'Ø 3/8" @ 20' }} packRaw={dims.losaSteelJson} />
                </>
              ) : null}
              {tab === "zapata" ? (
                <>
                  <MaeMomentStrip title="Zapata — viga invertida · momentos inf/sup" formula="M(x)  ·  q(x)=a+bx  ·  h=ℓn/7" ptsRaw={dims.mPts} L={Number(dims.Lbeam) || 12} MuPos={Number(dims.Mtop)} MuNeg={Number(dims.Msoil)} />
                  <MaeMomentStrip title="Zapata — viga invertida · cortante" formula="V(x)=∫q−ΣPu" ptsRaw={dims.vPts} L={Number(dims.Lbeam) || 12} MuPos={Number(dims.VmaxVC) || 0} unidad="t" kind="V" />
                  <MaePunchFromDims values={dims} />
                  <MaeSteelPlan model={model} bars={{ infX: dims.asPrin || 'Ø 1/2" @ 20', infY: dims.asLong || 'Ø 1/2" @ 20', supX: dims.asDist || 'Ø 3/8" @ 20', supY: dims.asDist || 'Ø 3/8" @ 20' }} />
                </>
              ) : null}
              {tab === "platea" ? (
                <>
                  <MaeMomentStrip title="Franja interior X — momentos inf/sup" formula="Motor FEM  ·  M(x)=∫V" ptsRaw={dims.mPtsIntX} L={Number(dims.Lx) || 16} MuPos={Number(dims.mIntXMpos)} MuNeg={Number(dims.mIntXMneg)} />
                  <MaeMomentStrip title="Franja interior X — cortante" formula="V(x)=∫q−ΣPu" ptsRaw={dims.vPtsIntX} L={Number(dims.Lx) || 16} MuPos={Number(dims.vIntXVmax)} unidad="t" kind="V" />
                  <MaeMomentStrip title="Franja borde X — momentos inf/sup" formula="Motor FEM  ·  M(x)=∫V" ptsRaw={dims.mPtsEdgX} L={Number(dims.Lx) || 16} MuPos={Number(dims.mEdgXMpos)} MuNeg={Number(dims.mEdgXMneg)} />
                  <MaeMomentStrip title="Franja borde X — cortante" formula="V(x)=∫q−ΣPu" ptsRaw={dims.vPtsEdgX} L={Number(dims.Lx) || 16} MuPos={Number(dims.vEdgXVmax)} unidad="t" kind="V" />
                  <MaeMomentStrip title="Franja interior Y — momentos inf/sup" formula="Motor FEM  ·  M(y)=∫V" ptsRaw={dims.mPtsIntY} L={Number(dims.Ly) || 16} MuPos={Number(dims.mIntYMpos)} MuNeg={Number(dims.mIntYMneg)} />
                  <MaeMomentStrip title="Franja interior Y — cortante" formula="V(y)=∫q−ΣPu" ptsRaw={dims.vPtsIntY} L={Number(dims.Ly) || 16} MuPos={Number(dims.vIntYVmax)} unidad="t" kind="V" />
                  <MaeMomentStrip title="Franja borde Y — momentos inf/sup" formula="Motor FEM  ·  M(y)=∫V" ptsRaw={dims.mPtsEdgY} L={Number(dims.Ly) || 16} MuPos={Number(dims.mEdgYMpos)} MuNeg={Number(dims.mEdgYMneg)} />
                  <MaeMomentStrip title="Franja borde Y — cortante" formula="V(y)=∫q−ΣPu" ptsRaw={dims.vPtsEdgY} L={Number(dims.Ly) || 16} MuPos={Number(dims.vEdgYVmax)} unidad="t" kind="V" />
                  <MaeMomentStrip title="Viga de cimentación — momentos · h=ℓn/7" formula="M(x)  ·  q(x)=a+bx  ·  h=ℓn/7" ptsRaw={dims.mPts} L={Number(dims.Lbeam) || 12} MuPos={Number(dims.Mtop)} MuNeg={Number(dims.Msoil)} />
                  <MaeMomentStrip title="Viga de cimentación — cortante" formula="V(x)=∫q−ΣPu" ptsRaw={dims.vPts} L={Number(dims.Lbeam) || 12} MuPos={Number(dims.VmaxVC) || Number(dims.vIntXVmax)} unidad="t" kind="V" />
                  <MaePunchFromDims values={dims} />
                  <MaeSteelPlan model={model} bars={{ infX: dims.asInfX || dims.asPos || 'Ø 1/2" @ 20', infY: dims.asInfY || 'Ø 1/2" @ 20', supX: dims.asSupX || dims.asNeg || 'Ø 1/2" @ 20', supY: dims.asSupY || 'Ø 1/2" @ 20' }} />
                </>
              ) : null}
            </>
          ) : (
            <p className="mae-empty">Dibuje la planta, complete la hoja y pulse Calcular memoria. El informe sale con fórmula, números sustituidos y criterio E.060 / ACI 318.</p>
          )}
        </section>
      </div>
    </div>
  );
}
