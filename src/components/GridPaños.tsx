import { colLive, dumpGrid, emptyPanes, parseGrid, setAxisSpan, type GridCol, type GridModel } from "../lib/layoutGrid";

type Props = {
  mode: "losa" | "platea";
  values: Record<string, string>;
  onPatch: (patch: Record<string, string>) => void;
};

function fallback(mode: "losa" | "platea", values: Record<string, string>): GridModel {
  if (mode === "losa") {
    const nx = Math.max(1, Math.round(Number(values.nX) || 3));
    const ny = Math.max(1, Math.round(Number(values.nY) || 2));
    const A = Number(values.A) || 4;
    const B = Number(values.B) || 5;
    const axesX = Array.from({ length: nx + 1 }, (_, i) => i * A);
    const axesY = Array.from({ length: ny + 1 }, (_, i) => i * B);
    return { axesX, axesY, panes: emptyPanes(nx, ny, true), cols: [] };
  }
  const nx = Math.max(1, Math.round(Number(values.nBayX) || 3));
  const ny = Math.max(1, Math.round(Number(values.nBayY) || 3));
  const Sx = Number(values.Sx) || 5;
  const Sy = Number(values.Sy) || 5;
  const ox = Number(values.ox) || 0.5;
  const oy = Number(values.oy) || 0.5;
  const axesX = Array.from({ length: nx + 1 }, (_, i) => ox + i * Sx);
  const axesY = Array.from({ length: ny + 1 }, (_, i) => oy + i * Sy);
  const c = Number(values.c) || 0.4;
  const P3 = (Number(values.PdInt) || 80) + (Number(values.PlInt) || 30);
  const cols: GridCol[] = [];
  for (let iy = 0; iy < axesY.length; iy++) {
    for (let ix = 0; ix < axesX.length; ix++) {
      cols.push({ ix, iy, t1: c, t2: c, P1: 0, P2: 0, P3, M1: 0, M2: 0, M3: 0 });
    }
  }
  return { axesX, axesY, panes: emptyPanes(nx, ny, true), cols };
}

export function GridPaños({ mode, values, onPatch }: Props) {
  const key = "gridJson";
  const g = parseGrid(values[key], fallback(mode, values));
  const nx = Math.max(1, g.axesX.length - 1);
  const ny = Math.max(1, g.axesY.length - 1);
  const Lx = g.axesX[g.axesX.length - 1] - g.axesX[0];
  const Ly = g.axesY[g.axesY.length - 1] - g.axesY[0];
  const pad = 36;
  const sc = Math.min(420 / Math.max(Lx, 1), 280 / Math.max(Ly, 1));
  const W = pad * 2 + Lx * sc + 8;
  const H = pad * 2 + Ly * sc + 8;
  const xy = (x: number, y: number) => ({ x: pad + (x - g.axesX[0]) * sc, y: pad + (g.axesY[g.axesY.length - 1] - y) * sc });
  const sel = String(values.gridSel || "0,0");
  const [sx, sy] = sel.split(",").map(Number);
  const selected = g.cols.find((c) => c.ix === sx && c.iy === sy) ?? g.cols[0];

  function commit(next: GridModel, extra: Record<string, string> = {}) {
    onPatch({
      gridJson: dumpGrid(next),
      nX: String(next.axesX.length - 1),
      nY: String(next.axesY.length - 1),
      nBayX: String(next.axesX.length - 1),
      nBayY: String(next.axesY.length - 1),
      A: String(Math.round((next.axesX[1] - next.axesX[0]) * 100) / 100),
      B: String(Math.round((next.axesY[1] - next.axesY[0]) * 100) / 100),
      Sx: String(Math.round((next.axesX[1] - next.axesX[0]) * 100) / 100),
      Sy: String(Math.round((next.axesY[1] - next.axesY[0]) * 100) / 100),
      ...extra,
    });
  }

  function setBays(nxN: number, nyN: number) {
    const spanX = Lx / nx;
    const spanY = Ly / ny;
    const axesX = Array.from({ length: nxN + 1 }, (_, i) => g.axesX[0] + i * spanX);
    const axesY = Array.from({ length: nyN + 1 }, (_, i) => g.axesY[0] + i * spanY);
    const panes = emptyPanes(nxN, nyN, true);
    for (let iy = 0; iy < Math.min(ny, nyN); iy++) {
      for (let ix = 0; ix < Math.min(nx, nxN); ix++) panes[iy][ix] = g.panes[iy][ix] !== false;
    }
    const seed = g.cols[0];
    const cols: GridCol[] = [];
    if (mode === "platea") {
      for (let iy = 0; iy < axesY.length; iy++) {
        for (let ix = 0; ix < axesX.length; ix++) {
          const old = g.cols.find((c) => c.ix === ix && c.iy === iy);
          cols.push(old ?? { ix, iy, t1: seed?.t1 ?? 0.4, t2: seed?.t2 ?? 0.4, P1: 0, P2: 0, P3: seed?.P3 ?? 80, M1: 0, M2: 0, M3: 0 });
        }
      }
    }
    commit({ axesX, axesY, panes, cols });
  }

  function patchCol(p: Partial<GridCol>) {
    if (!selected) return;
    const cols = g.cols.map((c) => (c.ix === selected.ix && c.iy === selected.iy ? { ...c, ...p } : c));
    commit({ ...g, cols }, { gridSel: `${selected.ix},${selected.iy}` });
  }

  const nOn = g.panes.flat().filter(Boolean).length;

  return (
    <fieldset className="fieldset grid-panos">
      <legend>{mode === "platea" ? "Grilla de platea" : "Grilla de paños techados"}</legend>
      <p className="lead" style={{ marginTop: 0 }}>
        Pulse un paño para {mode === "platea" ? "incluirlo o excluirlo de la platea" : "marcarlo techado"}. {mode === "platea" ? "Pulse una columna: P3 es el axial FZ; P1/P2 cortes FX/FY; M1 torsión, M2 y M3 flexión (convenio ETABS)." : "La continuidad de cada paño se toma de los vecinos techados."}
      </p>
      <div className="grid-panos-tools">
        <label>
          Paños X
          <input type="number" min={1} max={8} value={nx} onChange={(e) => setBays(Math.max(1, Number(e.target.value) || 1), ny)} />
        </label>
        <label>
          Paños Y
          <input type="number" min={1} max={8} value={ny} onChange={(e) => setBays(nx, Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <span>{nOn} paños activos · {Lx.toFixed(2)} × {Ly.toFixed(2)} m</span>
      </div>
      <div className="grid-panos-tools">
        {g.axesX.slice(0, -1).map((_, i) => (
          <label key={`sx-${i}`}>
            Vano X{i + 1}
            <input
              type="number"
              step="0.1"
              min={0.5}
              value={Number((g.axesX[i + 1] - g.axesX[i]).toFixed(2))}
              onChange={(e) => commit({ ...g, axesX: setAxisSpan(g.axesX, i, Number(e.target.value) || 0.5) })}
            />
          </label>
        ))}
        {g.axesY.slice(0, -1).map((_, i) => (
          <label key={`sy-${i}`}>
            Vano Y{i + 1}
            <input
              type="number"
              step="0.1"
              min={0.5}
              value={Number((g.axesY[i + 1] - g.axesY[i]).toFixed(2))}
              onChange={(e) => commit({ ...g, axesY: setAxisSpan(g.axesY, i, Number(e.target.value) || 0.5) })}
            />
          </label>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="grid-panos-svg" role="img">
        {g.panes.map((row, iy) =>
          row.map((on, ix) => {
            const a = xy(g.axesX[ix], g.axesY[iy + 1]);
            const b = xy(g.axesX[ix + 1], g.axesY[iy]);
            return (
              <rect
                key={`p-${ix}-${iy}`}
                x={a.x}
                y={a.y}
                width={Math.max(4, b.x - a.x)}
                height={Math.max(4, b.y - a.y)}
                fill={on ? "#d9e4d0" : "#efe8dc"}
                stroke="#1a4473"
                strokeWidth="1.1"
                cursor="pointer"
                onClick={() => {
                  const panes = g.panes.map((r) => r.slice());
                  panes[iy][ix] = !panes[iy][ix];
                  commit({ ...g, panes });
                }}
              />
            );
          }),
        )}
        {mode === "platea"
          ? g.cols.map((c) => {
              if (!colLive(g, c.ix, c.iy)) return null;
              const p = xy(g.axesX[c.ix], g.axesY[c.iy]);
              const on = c.ix === selected?.ix && c.iy === selected?.iy;
              return (
                <rect
                  key={`c-${c.ix}-${c.iy}`}
                  x={p.x - 6}
                  y={p.y - 6}
                  width="12"
                  height="12"
                  fill={on ? "#8b1e1e" : "#1a4473"}
                  stroke="#fff"
                  strokeWidth="1"
                  cursor="pointer"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onPatch({ gridSel: `${c.ix},${c.iy}`, gridJson: dumpGrid(g) });
                  }}
                />
              );
            })
          : null}
      </svg>
      {mode === "platea" && selected ? (
        <div className="grid-panos-col">
          <strong>
            Columna {selected.ix + 1},{selected.iy + 1}
          </strong>
          <label>t1 (m)<input type="number" step="0.05" value={selected.t1} onChange={(e) => patchCol({ t1: Number(e.target.value) || 0.3 })} /></label>
          <label>t2 (m)<input type="number" step="0.05" value={selected.t2} onChange={(e) => patchCol({ t2: Number(e.target.value) || 0.3 })} /></label>
          <label>P1 FX (t)<input type="number" step="0.1" value={selected.P1} onChange={(e) => patchCol({ P1: Number(e.target.value) || 0 })} /></label>
          <label>P2 FY (t)<input type="number" step="0.1" value={selected.P2} onChange={(e) => patchCol({ P2: Number(e.target.value) || 0 })} /></label>
          <label>P3 FZ (t)<input type="number" step="0.1" value={selected.P3} onChange={(e) => patchCol({ P3: Number(e.target.value) || 0 })} /></label>
          <label>M1 T (t·m)<input type="number" step="0.1" value={selected.M1} onChange={(e) => patchCol({ M1: Number(e.target.value) || 0 })} /></label>
          <label>M2 (t·m)<input type="number" step="0.1" value={selected.M2} onChange={(e) => patchCol({ M2: Number(e.target.value) || 0 })} /></label>
          <label>M3 (t·m)<input type="number" step="0.1" value={selected.M3} onChange={(e) => patchCol({ M3: Number(e.target.value) || 0 })} /></label>
        </div>
      ) : null}
    </fieldset>
  );
}
