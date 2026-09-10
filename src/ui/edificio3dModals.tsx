import { useEffect, useRef, useState } from "react";
import { paramsSitio, type SueloId } from "../lib/e030/tablas";
import {
  applyGridSetup,
  applySeismicToModel,
  applySpectrumTemplate,
  catalogGroups,
  computeSeismic,
  ensureCatalogPatterns,
  SEISMIC_CODES,
  SPECTRUM_TEMPLATES,
  type BuildingProject,
  type LoadKind,
  type SeismicCode,
  type SeismicReport,
  type SpectrumId,
  type SpectrumPoint,
} from "../lib/edificio3d";
import { Field, Num } from "./Field";

function fmt(n: number, d = 2) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function GridModal({
  project,
  onApply,
  onClose,
}: {
  project: BuildingProject;
  onApply: (fn: (p: BuildingProject) => void) => void;
  onClose: () => void;
}) {
  const [xs, setXs] = useState(project.gridsX.map((g) => ({ name: g.name, coord: g.coord })));
  const [ys, setYs] = useState(project.gridsY.map((g) => ({ name: g.name, coord: g.coord })));
  const [n, setN] = useState(project.stories.length);
  const [h, setH] = useState(project.stories[0]?.height ?? 2.8);
  return (
    <div className="ed3-modal" role="dialog" aria-labelledby="ed3-new-title">
      <div className="ed3-modal-card">
        <header>
          <p className="kicker">Nuevo modelo</p>
          <h2 id="ed3-new-title">Grillas y niveles</h2>
          <p>Como ETABS: ejes X (letras) y Y (números) con cota, y número de pisos.</p>
        </header>
        <div className="ed3-modal-grid">
          <section>
            <h3>Ejes X</h3>
            {xs.map((g, i) => (
              <div key={i} className="ed3-grid-row">
                <input value={g.name} onChange={(e) => setXs(xs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input type="number" step="0.1" value={g.coord} onChange={(e) => setXs(xs.map((x, j) => (j === i ? { ...x, coord: parseFloat(e.target.value) || 0 } : x)))} />
                <button type="button" onClick={() => setXs(xs.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => setXs([...xs, { name: String.fromCharCode(65 + xs.length), coord: (xs.at(-1)?.coord ?? 0) + 4 }])}>+ Eje X</button>
          </section>
          <section>
            <h3>Ejes Y</h3>
            {ys.map((g, i) => (
              <div key={i} className="ed3-grid-row">
                <input value={g.name} onChange={(e) => setYs(ys.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input type="number" step="0.1" value={g.coord} onChange={(e) => setYs(ys.map((x, j) => (j === i ? { ...x, coord: parseFloat(e.target.value) || 0 } : x)))} />
                <button type="button" onClick={() => setYs(ys.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => setYs([...ys, { name: String(ys.length + 1), coord: (ys.at(-1)?.coord ?? 0) + 4 }])}>+ Eje Y</button>
          </section>
        </div>
        <div className="ed3-modal-row">
          <Field label="Pisos">
            <Num value={n} onChange={setN} step="1" />
          </Field>
          <Field label="Altura típica" unit="m">
            <Num value={h} onChange={setH} step="0.05" />
          </Field>
        </div>
        <footer>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onApply((p) => applyGridSetup(p, xs, ys, n, h));
              onClose();
            }}
          >
            Aplicar grillas
          </button>
        </footer>
      </div>
    </div>
  );
}

export function LoadModal({
  project,
  onApply,
  onClose,
  hasTarget,
}: {
  project: BuildingProject;
  onApply: (kind: LoadKind, w1: number, w2: number, patternId: string, dir: "GX" | "GY" | "GZ") => void;
  onClose: () => void;
  hasTarget: boolean;
}) {
  const [kind, setKind] = useState<LoadKind>("lineal");
  const [w1, setW1] = useState(0.2);
  const [w2, setW2] = useState(0.4);
  const [patternId, setPatternId] = useState("CV");
  const [dir, setDir] = useState<"GX" | "GY" | "GZ">("GZ");
  const groups = catalogGroups();
  const extras = project.patterns.filter((p) => !groups.some((g) => g.items.some((i) => i.id === p.id)));
  return (
    <div className="ed3-modal" role="dialog" aria-labelledby="ed3-load-title">
      <div className="ed3-modal-card">
        <header>
          <p className="kicker">Cargas</p>
          <h2 id="ed3-load-title">Tipo y configuración</h2>
          <p>{hasTarget ? "Se aplicará al elemento o nudo seleccionado." : "Seleccione primero una viga, columna, losa o nudo."}</p>
        </header>
        <Field label="Tipo">
          <select value={kind} onChange={(e) => setKind(e.target.value as LoadKind)}>
            <option value="puntual">Puntual (nudo o elemento)</option>
            <option value="lineal">Lineal uniforme</option>
            <option value="triangular">Triangular</option>
            <option value="trapezoidal">Trapezoidal</option>
            <option value="area">Área uniforme</option>
            <option value="asimetrico">Área asimétrica</option>
          </select>
        </Field>
        <Field label="Patrón">
          <select value={patternId} onChange={(e) => setPatternId(e.target.value)}>
            {groups.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {g.items.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
            ))}
            {extras.length ? (
              <optgroup label="Del modelo">
                {extras.map((p) => (
                  <option key={p.id} value={p.id}>{p.id} · {p.name}</option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </Field>
        <Field label="Dirección">
          <select value={dir} onChange={(e) => setDir(e.target.value as "GX" | "GY" | "GZ")}>
            <option value="GZ">GZ (gravedad)</option>
            <option value="GX">GX (global X)</option>
            <option value="GY">GY (global Y)</option>
          </select>
        </Field>
        <div className="ed3-modal-row">
          <Field label="w1 / P" unit="t · t/m · t/m²">
            <Num value={w1} onChange={setW1} step="0.05" />
          </Field>
          <Field label="w2" unit="t/m">
            <Num value={w2} onChange={setW2} step="0.05" />
          </Field>
        </div>
        <p className="ed3-mini">Gravedad, vivas, viento, empuje, temperatura y sismo. SEX/SEY/SDX/SDY se generan en SIS; aquí puede aplicarlas a un elemento si lo necesita.</p>
        <footer>
          <button type="button" className="btn" onClick={onClose}>Cerrar</button>
          <button type="button" className="btn btn-primary" disabled={!hasTarget} onClick={() => { onApply(kind, w1, w2, patternId, dir); onClose(); }}>
            Insertar carga
          </button>
        </footer>
      </div>
    </div>
  );
}

function SpectrumChart({ points, T }: { points: SpectrumPoint[]; T: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !points.length) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = Math.floor(w * dpr);
    c.height = Math.floor(h * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(0, 0, w, h);
    const pad = { l: 36, r: 10, t: 10, b: 22 };
    const maxT = Math.max(...points.map((p) => p.T), 1);
    const maxSa = Math.max(...points.map((p) => p.Sa), 0.05);
    const X = (t: number) => pad.l + ((t / maxT) * (w - pad.l - pad.r));
    const Y = (sa: number) => pad.t + (1 - sa / maxSa) * (h - pad.t - pad.b);
    ctx.strokeStyle = "#e0d6c2";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const sa = (maxSa * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.l, Y(sa));
      ctx.lineTo(w - pad.r, Y(sa));
      ctx.stroke();
      ctx.fillStyle = "#6b6458";
      ctx.font = "10px ui-sans-serif";
      ctx.fillText(sa.toFixed(2), 4, Y(sa) + 3);
    }
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(X(p.T), Y(p.Sa));
      else ctx.lineTo(X(p.T), Y(p.Sa));
    });
    ctx.strokeStyle = "#8a6a32";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "#8b1e1e";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(X(T), pad.t);
    ctx.lineTo(X(T), h - pad.b);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#8b1e1e";
    ctx.fillText(`T1=${T.toFixed(2)}s`, Math.min(X(T) + 4, w - 70), 16);
    ctx.fillStyle = "#6b6458";
    ctx.fillText("T (s)", w - 36, h - 6);
    ctx.fillText("Sa", 6, 12);
  }, [points, T]);
  return <canvas ref={ref} className="ed3-spec-canvas" width={640} height={180} />;
}

export function SeismicModal({
  project,
  onApply,
  onClose,
}: {
  project: BuildingProject;
  onApply: (fn: (p: BuildingProject) => SeismicReport) => void;
  onClose: () => void;
}) {
  const [s, setS] = useState(() => {
    const base = { ...project.seismic };
    return {
      ...base,
      staticFx: base.staticFx ?? 1,
      staticFy: base.staticFy ?? 1,
      dynFx: base.dynFx ?? 1,
      dynFy: base.dynFy ?? 1,
      spectrumId: base.spectrumId ?? "e030-2025",
    };
  });
  const preview = computeSeismic({ ...project, seismic: s });
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS({ ...s, [k]: v });
  return (
    <div className="ed3-modal" role="dialog" aria-labelledby="ed3-sis-title">
      <div className="ed3-modal-card ed3-modal-sis">
        <header>
          <p className="kicker">Sismo</p>
          <h2 id="ed3-sis-title">Estático · espectro de diseño · SEX SEY SDX SDY</h2>
          <p>El peso sísmico sale del modelo (losas, pórtico y % de CV). Usted fija factores X/Y y la plantilla del espectro.</p>
        </header>

        <Field label="Norma">
          <select value={s.code} onChange={(e) => {
            const code = e.target.value as SeismicCode;
            const tpl = SPECTRUM_TEMPLATES.find((t) => t.code === code);
            setS({ ...s, code, spectrumId: tpl?.id ?? s.spectrumId });
          }}>
            {SEISMIC_CODES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <p className="ed3-mini">{SEISMIC_CODES.find((c) => c.id === s.code)?.note}</p>

        {s.code === "e030" ? (
          <div className="ed3-modal-row">
            <Field label="Zona">
              <select value={String(s.zona)} onChange={(e) => {
                const z = Number(e.target.value) as 1 | 2 | 3 | 4;
                const site = paramsSitio(z, (s.suelo as SueloId) || "S2");
                setS({ ...s, zona: z, Z: z === 4 ? 0.45 : z === 3 ? 0.35 : z === 2 ? 0.25 : 0.1, S: site.S, Tp: site.Tp, Tl: site.Tl });
              }}>
                <option value="4">Z4 · 0,45</option>
                <option value="3">Z3 · 0,35</option>
                <option value="2">Z2 · 0,25</option>
                <option value="1">Z1 · 0,10</option>
              </select>
            </Field>
            <Field label="Suelo">
              <select value={s.suelo} onChange={(e) => {
                const suelo = e.target.value;
                const site = paramsSitio(s.zona, (suelo as SueloId) || "S2");
                setS({ ...s, suelo, S: site.S, Tp: site.Tp, Tl: site.Tl });
              }}>
                <option value="S0">S0</option>
                <option value="S1">S1</option>
                <option value="S2">S2</option>
                <option value="S3">S3</option>
                <option value="S4">S4</option>
              </select>
            </Field>
            <Field label="U">
              <Num value={s.U} onChange={(n) => set("U", n)} step="0.1" />
            </Field>
            <Field label="R0">
              <Num value={s.R0} onChange={(n) => set("R0", n)} step="0.5" />
            </Field>
            <Field label="S">
              <Num value={s.S} onChange={(n) => set("S", n)} step="0.05" />
            </Field>
            <Field label="Tp" unit="s">
              <Num value={s.Tp} onChange={(n) => set("Tp", n)} step="0.1" />
            </Field>
          </div>
        ) : (
          <div className="ed3-modal-row">
            <Field label="SDS / Sa">
              <Num value={s.SDS} onChange={(n) => set("SDS", n)} step="0.05" />
            </Field>
            <Field label="Ie">
              <Num value={s.Ie} onChange={(n) => set("Ie", n)} step="0.25" />
            </Field>
            <Field label="R">
              <Num value={s.R0} onChange={(n) => set("R0", n)} step="0.5" />
            </Field>
          </div>
        )}
        <div className="ed3-modal-row">
          <Field label="Ia">
            <Num value={s.Ia} onChange={(n) => set("Ia", n)} step="0.05" />
          </Field>
          <Field label="Ip">
            <Num value={s.Ip} onChange={(n) => set("Ip", n)} step="0.05" />
          </Field>
          <Field label="Ct">
            <Num value={s.Ct} onChange={(n) => set("Ct", n)} step="1" />
          </Field>
          <Field label="% CV sísmico">
            <Num value={s.liveFrac} onChange={(n) => set("liveFrac", n)} step="0.05" />
          </Field>
        </div>

        <section className="ed3-sis-block">
          <h3>Análisis estático · factores de dirección</h3>
          <p className="ed3-mini">Escala el cortante basal de SEX y SEY. 1,00 = 100 % de V. Típico 1,00 y 0,30 en 100/30.</p>
          <div className="ed3-modal-row">
            <Field label="Factor X · SEX">
              <Num value={s.staticFx} onChange={(n) => set("staticFx", n)} step="0.05" />
            </Field>
            <Field label="Factor Y · SEY">
              <Num value={s.staticFy} onChange={(n) => set("staticFy", n)} step="0.05" />
            </Field>
          </div>
          <div className="ed3-preset-row">
            <button type="button" className="btn" onClick={() => setS({ ...s, staticFx: 1, staticFy: 1 })}>100 / 100</button>
            <button type="button" className="btn" onClick={() => setS({ ...s, staticFx: 1, staticFy: 0.3 })}>100 / 30</button>
            <button type="button" className="btn" onClick={() => setS({ ...s, staticFx: 0.3, staticFy: 1 })}>30 / 100</button>
          </div>
          <p><b>Vx = {fmt(preview.Vx, 2)} t</b> · <b>Vy = {fmt(preview.Vy, 2)} t</b> · V = {fmt(preview.V, 2)} t</p>
        </section>

        <section className="ed3-sis-block">
          <h3>Análisis dinámico · espectro de diseño</h3>
          <Field label="Plantilla">
            <select
              value={s.spectrumId}
              onChange={(e) => setS(applySpectrumTemplate(s, e.target.value as SpectrumId))}
            >
              {SPECTRUM_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <p className="ed3-mini">{SPECTRUM_TEMPLATES.find((t) => t.id === s.spectrumId)?.note}</p>
          <SpectrumChart points={preview.spectrum} T={preview.T} />
          <div className="ed3-modal-row">
            <Field label="Factor X · SDX">
              <Num value={s.dynFx} onChange={(n) => set("dynFx", n)} step="0.05" />
            </Field>
            <Field label="Factor Y · SDY">
              <Num value={s.dynFy} onChange={(n) => set("dynFy", n)} step="0.05" />
            </Field>
          </div>
          <div className="ed3-preset-row">
            <button type="button" className="btn" onClick={() => setS({ ...s, dynFx: 1, dynFy: 1 })}>100 / 100</button>
            <button type="button" className="btn" onClick={() => setS({ ...s, dynFx: 1, dynFy: 0.3 })}>100 / 30</button>
            <button type="button" className="btn" onClick={() => setS({ ...s, dynFx: 0.3, dynFy: 1 })}>30 / 100</button>
          </div>
          <p>
            T1 = {fmt(preview.T, 3)} s · C = {fmt(preview.C, 3)} · Sa(T1) = {fmt(preview.Sa, 3)} · R = {fmt(preview.R, 2)}
          </p>
          <p>
            <b>Vdin X = {fmt(preview.VdynX, 2)} t</b> · <b>Vdin Y = {fmt(preview.VdynY, 2)} t</b>
            {" "}· piso {fmt(preview.vmin, 2)} V
          </p>
        </section>

        <div className="ed3-box">
          <p>W = {fmt(preview.W, 1)} t · k = {fmt(preview.k, 2)}</p>
          <table className="ed3-table">
            <thead><tr><th>Nivel</th><th>W</th><th>Fi X</th><th>Fi Y</th></tr></thead>
            <tbody>
              {preview.stories.map((st) => (
                <tr key={st.storyId}><td>{st.storyId}</td><td>{fmt(st.w, 2)}</td><td>{fmt(st.Fx, 2)}</td><td>{fmt(st.Fy, 2)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="ed3-mini">{preview.note}</p>
        </div>
        <footer>
          <button type="button" className="btn" onClick={onClose}>Cerrar</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onApply((p) => {
                p.seismic = s;
                ensureCatalogPatterns(p);
                return applySeismicToModel(p);
              });
              onClose();
            }}
          >
            Generar SEX SEY SDX SDY
          </button>
        </footer>
      </div>
    </div>
  );
}
