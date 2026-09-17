import { dumpCorrida, parseCorrida, type CorridaCol, type CorridaModel } from "../lib/layoutGrid";

type Props = {
  values: Record<string, string>;
  onPatch: (patch: Record<string, string>) => void;
};

function iso(x: number, y: number, z: number, o: { ox: number; oy: number; s: number }) {
  return { x: o.ox + (x - y) * 0.866 * o.s, y: o.oy + (x + y) * 0.5 * o.s - z * o.s * 0.92 };
}

function fallbackModel(values: Record<string, string>): CorridaModel {
  const nTramos = Math.max(1, Math.round(Number(values.nTramos) || 3));
  const sCol = Number(values.sCol) || 4;
  const t1 = Number(values.t1) || 0.3;
  const t2 = Number(values.t2) || 0.4;
  const P3 = (Number(values.Pd) || 12) * sCol + (Number(values.Pl) || 4) * sCol;
  return {
    cols: Array.from({ length: nTramos + 1 }, (_, i) => ({
      id: `C${i + 1}`,
      x: i * sCol,
      ey: 0,
      centered: true,
      t1,
      t2,
      P1: 0,
      P2: 0,
      P3,
      M1: 0,
      M2: 0,
      M3: 0,
    })),
    hBeam: Number(values.hBeam) || 0.6,
    bBeam: Number(values.bBeam) || 0.4,
  };
}

export function CorridaIsoView({
  values,
  model,
  sel = -1,
  onSelect,
}: {
  values: Record<string, string>;
  model: CorridaModel;
  sel?: number;
  onSelect?: (i: number) => void;
}) {
  const B = Number(values.B) > 0.4 ? Number(values.B) : 1.8;
  const hf = Number(values.hf) || 0.45;
  const L = Math.max(0.8, model.cols[model.cols.length - 1].x - model.cols[0].x);
  const o = { ox: 210, oy: 168, s: Math.min(46, 280 / Math.max(L, 2), 90 / Math.max(B, 1.2)) };
  const x0 = model.cols[0].x;
  const poly = (ps: { x: number; y: number }[]) => ps.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const pts = [iso(0, 0, 0, o), iso(L, 0, 0, o), iso(L, B, 0, o), iso(0, B, 0, o)];
  const top = [iso(0, 0, hf, o), iso(L, 0, hf, o), iso(L, B, hf, o), iso(0, B, hf, o)];
  return (
    <svg viewBox="0 0 420 250" className="grid-panos-svg" role="img">
      <polygon points={poly([pts[0], pts[1], top[1], top[0]])} fill="#cfc3a6" stroke="#163a63" />
      <polygon points={poly([pts[1], pts[2], top[2], top[1]])} fill="#b7aa8c" stroke="#163a63" />
      <polygon points={poly(top)} fill="#ddd3bb" stroke="#163a63" strokeWidth="1.4" />
      {model.cols.map((c, i) => {
        const cx = c.x - x0;
        const cy = B / 2 + (c.centered ? 0 : c.ey);
        const a = iso(cx - c.t2 / 2, cy - c.t1 / 2, hf, o);
        const b = iso(cx + c.t2 / 2, cy - c.t1 / 2, hf, o);
        const d = iso(cx + c.t2 / 2, cy + c.t1 / 2, hf, o);
        const a2 = iso(cx - c.t2 / 2, cy - c.t1 / 2, hf + 1.1, o);
        const b2 = iso(cx + c.t2 / 2, cy - c.t1 / 2, hf + 1.1, o);
        const d2 = iso(cx + c.t2 / 2, cy + c.t1 / 2, hf + 1.1, o);
        const e2 = iso(cx - c.t2 / 2, cy + c.t1 / 2, hf + 1.1, o);
        const on = i === sel;
        return (
          <g key={c.id} cursor={onSelect ? "pointer" : "default"} onClick={() => onSelect?.(i)}>
            <polygon points={poly([b, d, d2, b2])} fill={on ? "#8b3a3a" : "#6a7c94"} stroke="#163a63" />
            <polygon points={poly([a, b, b2, a2])} fill={on ? "#a44" : "#8a9bb0"} stroke="#163a63" />
            <polygon points={poly([a2, b2, d2, e2])} fill={on ? "#c45c5c" : "#c5d0dc"} stroke="#163a63" />
            <text x={(a2.x + d2.x) / 2} y={a2.y - 6} textAnchor="middle" fontSize="10" fill="#163a63" fontWeight="700">
              {c.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function CorridaColumnas({ values, onPatch }: Props) {
  const model = parseCorrida(values.corridaJson, fallbackModel(values));
  const sel = Math.max(0, Math.min(model.cols.length - 1, Number(values.corridaSel) || 0));
  const col = model.cols[sel];
  const L = model.cols[model.cols.length - 1].x - model.cols[0].x;

  function commit(next: CorridaModel, extra: Record<string, string> = {}) {
    onPatch({
      corridaJson: dumpCorrida(next),
      hBeam: String(next.hBeam),
      bBeam: String(next.bBeam),
      nTramos: String(Math.max(1, next.cols.length - 1)),
      ...extra,
    });
  }

  function patchCol(p: Partial<CorridaCol>) {
    const cols = model.cols.map((c, i) => (i === sel ? { ...c, ...p } : c));
    if (p.centered === true) cols[sel].ey = 0;
    commit({ ...model, cols });
  }

  return (
    <fieldset className="fieldset corrida-cols">
      <legend>Columnas de la zapata corrida</legend>
      <p className="lead" style={{ marginTop: 0 }}>
        Cada apoyo: posición, centrada/excéntrica (ey) y 6 GDL (P1=FX, P2=FY, P3=FZ, M1=T, M2, M3). La viga de cimentación se arma con b × h.
      </p>
      <div className="grid-panos-tools">
        <label>
          N° columnas
          <input
            type="number"
            min={2}
            max={10}
            value={model.cols.length}
            onChange={(e) => {
              const n = Math.max(2, Math.min(10, Number(e.target.value) || 2));
              const span = L / Math.max(model.cols.length - 1, 1);
              const cols = Array.from({ length: n }, (_, i) => {
                const old = model.cols[i];
                return old ? { ...old, x: i * span } : { ...model.cols[0], id: `C${i + 1}`, x: i * span, ey: 0, centered: true };
              });
              commit({ ...model, cols }, { corridaSel: "0" });
            }}
          />
        </label>
        <label>
          b viga (m)
          <input type="number" step="0.05" value={model.bBeam} onChange={(e) => commit({ ...model, bBeam: Number(e.target.value) || 0.4 })} />
        </label>
        <label>
          h viga (m)
          <input type="number" step="0.05" value={model.hBeam} onChange={(e) => commit({ ...model, hBeam: Number(e.target.value) || 0.5 })} />
        </label>
      </div>
      <CorridaIsoView values={values} model={model} sel={sel} onSelect={(i) => onPatch({ corridaSel: String(i), corridaJson: dumpCorrida(model) })} />
      {col ? (
        <div className="grid-panos-col">
          <strong>{col.id}</strong>
          <label>
            x (m)
            <input type="number" step="0.05" value={col.x} onChange={(e) => patchCol({ x: Number(e.target.value) || 0 })} />
          </label>
          <label>
            Tipo
            <select
              value={col.centered ? "centrada" : "excentrica"}
              onChange={(e) => patchCol({ centered: e.target.value === "centrada", ey: e.target.value === "centrada" ? 0 : col.ey || 0.15 })}
            >
              <option value="centrada">Centrada al eje</option>
              <option value="excentrica">Excéntrica / desplazada</option>
            </select>
          </label>
          <label>
            ey (m)
            <input type="number" step="0.05" value={col.ey} disabled={col.centered} onChange={(e) => patchCol({ ey: Number(e.target.value) || 0, centered: false })} />
          </label>
          <label>
            t1 (m)
            <input type="number" step="0.05" value={col.t1} onChange={(e) => patchCol({ t1: Number(e.target.value) || 0.3 })} />
          </label>
          <label>
            t2 (m)
            <input type="number" step="0.05" value={col.t2} onChange={(e) => patchCol({ t2: Number(e.target.value) || 0.3 })} />
          </label>
          <label>
            P1 FX (t)
            <input type="number" step="0.1" value={col.P1} onChange={(e) => patchCol({ P1: Number(e.target.value) || 0 })} />
          </label>
          <label>
            P2 FY (t)
            <input type="number" step="0.1" value={col.P2} onChange={(e) => patchCol({ P2: Number(e.target.value) || 0 })} />
          </label>
          <label>
            P3 FZ (t)
            <input type="number" step="0.1" value={col.P3} onChange={(e) => patchCol({ P3: Number(e.target.value) || 0 })} />
          </label>
          <label>
            M1 T (t·m)
            <input type="number" step="0.1" value={col.M1} onChange={(e) => patchCol({ M1: Number(e.target.value) || 0 })} />
          </label>
          <label>
            M2 (t·m)
            <input type="number" step="0.1" value={col.M2} onChange={(e) => patchCol({ M2: Number(e.target.value) || 0 })} />
          </label>
          <label>
            M3 (t·m)
            <input type="number" step="0.1" value={col.M3} onChange={(e) => patchCol({ M3: Number(e.target.value) || 0 })} />
          </label>
        </div>
      ) : null}
    </fieldset>
  );
}

export function CorridaIsoFig({ values }: { values: Record<string, string> }) {
  const model = parseCorrida(values.corridaJson, fallbackModel(values));
  return (
    <div className="croquis croquis-compact" data-fig-part="momento">
      <div className="croquis-head">
        <p>Isométrico — zapata corrida y columnas</p>
      </div>
      <div className="croquis-stage">
        <CorridaIsoView values={values} model={model} />
      </div>
      <p className="croquis-cap">Configuración 3D: corrida, viga de cimentación y columnas centradas o desplazadas (ey).</p>
    </div>
  );
}
