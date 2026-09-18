import { useEffect, useMemo, useRef, useState } from "react";
import {
  cellHit,
  colAtHit,
  dumpBoth,
  modeHint,
  nearestAxis,
  toPx,
  viewBoxOf,
} from "../../lib/engines/maestria/drawCommon";
import {
  adoptRoofIfEmpty,
  createGridAxes,
  createLosaAxes,
  cycleKind,
  dumpMae,
  edgeLabel,
  exampleModel,
  fillLosaRoof,
  hitMergeLine,
  identifyLosa,
  nxOf,
  nyOf,
  paintedInertia,
  parseMae,
  placeColsOnPainted,
  setSpan,
  toggleMerge,
  type MaeCol,
  type MaeMode,
  type MaeModel,
  type MaeTool,
} from "../../lib/engines/maestria/types";

type Props = {
  mode: MaeMode;
  model: MaeModel;
  tool: MaeTool;
  sel: string | null;
  onChange: (next: MaeModel, extra?: Record<string, string>) => void;
  onSelect: (id: string | null) => void;
};

function svgPoint(e: React.MouseEvent<SVGSVGElement>) {
  const svg = e.currentTarget;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  return pt.matrixTransform(ctm.inverse());
}

export function MaeCanvas({ mode, model, tool, sel, onChange, onSelect }: Props) {
  const { pad, sc, W, H, e } = useMemo(() => viewBoxOf(model), [model]);
  const nx = nxOf(model);
  const ny = nyOf(model);
  const needsCols = mode !== "losa";

  function fromPx(px: number, py: number) {
    return { x: e.x0 + (px - pad) / sc, y: e.y1 - (py - pad) / sc };
  }

  function commit(next: MaeModel, extra: Record<string, string> = {}) {
    const both = dumpBoth(next);
    onChange(next, { ...both, ...extra });
  }

  function onSvgClick(ev: React.MouseEvent<SVGSVGElement>) {
    const p = svgPoint(ev);
    const m = fromPx(p.x, p.y);
    const tol = 0.22 * Math.max(1, 80 / sc);
    const ax = nearestAxis(model, m.x, m.y, tol);

    if (tool === "columna" && needsCols && ax.hitX && ax.hitY) {
      const hit = colAtHit(model, ax.iX, ax.iY);
      if (hit) {
        onSelect(hit.id);
        return;
      }
      const n = model.cols.length + 1;
      const col: MaeCol = {
        id: `C${n}`,
        ix: ax.iX,
        iy: ax.iY,
        t1: 0.4,
        t2: 0.4,
        P1: 0,
        P2: 0,
        P3: mode === "platea" ? 80 : 50,
        M1: 0,
        M2: 0,
        M3: 0,
        ex: 0,
        ey: 0,
        centered: true,
      };
      commit({ ...model, cols: [...model.cols, col] }, { maeSel: col.id });
      onSelect(col.id);
      return;
    }

    if (tool === "apoyo") {
      if (ax.hitX && !ax.hitY) {
        const axisXKind = model.axisXKind.slice();
        axisXKind[ax.iX] = cycleKind(axisXKind[ax.iX] ?? "viga");
        commit({ ...model, axisXKind });
        return;
      }
      if (ax.hitY && !ax.hitX) {
        const axisYKind = model.axisYKind.slice();
        axisYKind[ax.iY] = cycleKind(axisYKind[ax.iY] ?? "viga");
        commit({ ...model, axisYKind });
        return;
      }
    }

    if (tool === "unir") {
      const hit = hitMergeLine(model, m.x, m.y, Math.max(tol, 0.18));
      if (!hit) return;
      commit(toggleMerge(model, hit));
      return;
    }

    if (tool === "celda") {
      const cell = cellHit(model, m.x, m.y);
      if (!cell) return;
      const cells = model.cells.map((r) => r.slice());
      cells[cell.iy][cell.ix] = !cells[cell.iy][cell.ix];
      commit({ ...model, cells });
      return;
    }

    if (tool === "columna" && needsCols) {
      const hit = model.cols.find((c) => {
        const q = toPx(model, model.axesX[c.ix] + c.ex, model.axesY[c.iy] + c.ey, pad, sc);
        return Math.hypot(q.x - p.x, q.y - p.y) < 14;
      });
      if (hit) onSelect(hit.id);
    }
  }

  const selected = model.cols.find((c) => c.id === sel);

  function patchCol(p: Partial<MaeCol>) {
    if (!selected) return;
    const cols = model.cols.map((c) => (c.id === selected.id ? { ...c, ...p } : c));
    if (p.centered === true) {
      const i = cols.findIndex((c) => c.id === selected.id);
      if (i >= 0) {
        cols[i].ex = 0;
        cols[i].ey = 0;
      }
    }
    commit({ ...model, cols });
  }

  function removeCol() {
    if (!selected) return;
    commit({ ...model, cols: model.cols.filter((c) => c.id !== selected.id) });
    onSelect(null);
  }

  return (
    <div className="mae-canvas">
      <p className="mae-hint">{modeHint(mode)}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mae-svg" role="img" onClick={onSvgClick}>
        <rect x="0" y="0" width={W} height={H} fill="#f7f3ea" />
        {model.cells.map((row, iy) =>
          row.map((on, ix) => {
            const a = toPx(model, model.axesX[ix], model.axesY[iy + 1], pad, sc);
            const b = toPx(model, model.axesX[ix + 1], model.axesY[iy], pad, sc);
            const mergedH = Boolean(model.mergeH[iy]?.[ix]);
            const mergedV = Boolean(model.mergeV[iy]?.[ix]);
            return (
              <rect
                key={`p-${ix}-${iy}`}
                x={a.x}
                y={a.y}
                width={Math.max(3, b.x - a.x)}
                height={Math.max(3, b.y - a.y)}
                fill={on ? (mode === "losa" ? "#d9e4d0" : "#d5c9a8") : "#efe8dc"}
                stroke="#1a4473"
                strokeWidth={1.1}
                strokeDasharray={on ? undefined : "5 4"}
                opacity={mergedH || mergedV ? 1 : 1}
              />
            );
          }),
        )}
        {model.axesX.map((x, i) => {
          const a = toPx(model, x, e.y0, pad, sc);
          const b = toPx(model, x, e.y1, pad, sc);
          const k = model.axisXKind[i];
          return (
            <line
              key={`vx-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={k === "muro" ? "#8b1e1e" : k === "libre" ? "#b8a078" : "#1a4473"}
              strokeWidth={k === "muro" ? 3 : 1.2}
              strokeDasharray={k === "libre" ? "4 4" : undefined}
            />
          );
        })}
        {model.axesY.map((y, i) => {
          const a = toPx(model, e.x0, y, pad, sc);
          const b = toPx(model, e.x1, y, pad, sc);
          const k = model.axisYKind[i];
          return (
            <line
              key={`hy-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={k === "muro" ? "#8b1e1e" : k === "libre" ? "#b8a078" : "#1a4473"}
              strokeWidth={k === "muro" ? 3 : 1.2}
              strokeDasharray={k === "libre" ? "4 4" : undefined}
            />
          );
        })}
        {Array.from({ length: ny }, (_, iy) =>
          Array.from({ length: Math.max(0, nx - 1) }, (_, ix) => {
            const left = Boolean(model.cells[iy]?.[ix]);
            const right = Boolean(model.cells[iy]?.[ix + 1]);
            if (!left || !right) return null;
            const merged = Boolean(model.mergeH[iy]?.[ix]);
            const a = toPx(model, model.axesX[ix + 1], model.axesY[iy], pad, sc);
            const b = toPx(model, model.axesX[ix + 1], model.axesY[iy + 1], pad, sc);
            const show = tool === "unir" || merged;
            if (!show) return null;
            return (
              <line
                key={`mh-${ix}-${iy}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={merged ? "#8b1e1e" : "#c4a35a"}
                strokeWidth={tool === "unir" ? 6 : 3.2}
                strokeDasharray={merged ? "8 4" : undefined}
                opacity={tool === "unir" ? 0.95 : 0.85}
              />
            );
          }),
        )}
        {Array.from({ length: Math.max(0, ny - 1) }, (_, iy) =>
          Array.from({ length: nx }, (_, ix) => {
            const bot = Boolean(model.cells[iy]?.[ix]);
            const top = Boolean(model.cells[iy + 1]?.[ix]);
            if (!bot || !top) return null;
            const merged = Boolean(model.mergeV[iy]?.[ix]);
            const a = toPx(model, model.axesX[ix], model.axesY[iy + 1], pad, sc);
            const b = toPx(model, model.axesX[ix + 1], model.axesY[iy + 1], pad, sc);
            const show = tool === "unir" || merged;
            if (!show) return null;
            return (
              <line
                key={`mv-${ix}-${iy}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={merged ? "#8b1e1e" : "#c4a35a"}
                strokeWidth={tool === "unir" ? 6 : 3.2}
                strokeDasharray={merged ? "8 4" : undefined}
                opacity={tool === "unir" ? 0.95 : 0.85}
              />
            );
          }),
        )}
        {model.axesX.map((x, i) => {
          const p = toPx(model, x, e.y0, pad, sc);
          return (
            <text key={`lx-${i}`} x={p.x} y={H - 10} textAnchor="middle" fontSize="11" fill="#5a4a28">
              {x.toFixed(2)}
            </text>
          );
        })}
        {model.axesY.map((y, i) => {
          const p = toPx(model, e.x0, y, pad, sc);
          return (
            <text key={`ly-${i}`} x={12} y={p.y + 4} fontSize="11" fill="#5a4a28">
              {y.toFixed(2)}
            </text>
          );
        })}
        {needsCols
          ? model.axesX.flatMap((x, ix) =>
              model.axesY.map((y, iy) => {
                const p = toPx(model, x, y, pad, sc);
                const has = colAtHit(model, ix, iy);
                return (
                  <circle
                    key={`n-${ix}-${iy}`}
                    cx={p.x}
                    cy={p.y}
                    r={has ? 0 : 5}
                    fill="none"
                    stroke="#8b1e1e"
                    strokeWidth="1"
                    opacity={tool === "columna" ? 0.55 : 0.15}
                  />
                );
              }),
            )
          : null}
        {model.cols.map((c) => {
          const p = toPx(model, model.axesX[c.ix] + (c.centered ? 0 : c.ex), model.axesY[c.iy] + (c.centered ? 0 : c.ey), pad, sc);
          const on = c.id === sel;
          return (
            <g key={c.id}>
              <rect
                x={p.x - Math.max(5, (c.t2 * sc) / 2)}
                y={p.y - Math.max(5, (c.t1 * sc) / 2)}
                width={Math.max(10, c.t2 * sc)}
                height={Math.max(10, c.t1 * sc)}
                fill={on ? "#8b1e1e" : "#1a4473"}
                stroke="#fff"
                strokeWidth="1.2"
              />
              <text x={p.x} y={p.y - Math.max(8, (c.t1 * sc) / 2) - 4} textAnchor="middle" fontSize="11" fill="#8b1e1e" fontWeight="700">
                {c.id}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mae-spans">
        {model.axesX.slice(0, -1).map((_, i) => (
          <label key={`sx-${i}`}>
            Vano X{i + 1}
            <input
              type="number"
              step="0.1"
              min={0.3}
              value={Number((model.axesX[i + 1] - model.axesX[i]).toFixed(2))}
              onChange={(ev) => commit({ ...model, axesX: setSpan(model.axesX, i, Number(ev.target.value) || 0.3) })}
            />
          </label>
        ))}
        {model.axesY.slice(0, -1).map((_, i) => (
          <label key={`sy-${i}`}>
            Vano Y{i + 1}
            <input
              type="number"
              step="0.1"
              min={0.3}
              value={Number((model.axesY[i + 1] - model.axesY[i]).toFixed(2))}
              onChange={(ev) => commit({ ...model, axesY: setSpan(model.axesY, i, Number(ev.target.value) || 0.3) })}
            />
          </label>
        ))}
      </div>
      {selected && needsCols ? (
        <div className="mae-ficha">
          <strong>
            Ficha {selected.id} — 6 GDL (ETABS: P1=FX, P2=FY, P3=FZ, M1=T, M2, M3)
          </strong>
          <label>
            t1 Y (m)
            <input type="number" step="0.05" value={selected.t1} onChange={(ev) => patchCol({ t1: Number(ev.target.value) || 0.3 })} />
          </label>
          <label>
            t2 X (m)
            <input type="number" step="0.05" value={selected.t2} onChange={(ev) => patchCol({ t2: Number(ev.target.value) || 0.3 })} />
          </label>
          <label>
            Posición
            <select
              value={selected.centered ? "c" : "e"}
              onChange={(ev) => patchCol({ centered: ev.target.value === "c", ey: ev.target.value === "c" ? 0 : selected.ey || 0.15 })}
            >
              <option value="c">Centrada en el nudo</option>
              <option value="e">Desfasada / borde</option>
            </select>
          </label>
          <label>
            ex (m)
            <input type="number" step="0.05" value={selected.ex} disabled={selected.centered} onChange={(ev) => patchCol({ ex: Number(ev.target.value) || 0, centered: false })} />
          </label>
          <label>
            ey (m)
            <input type="number" step="0.05" value={selected.ey} disabled={selected.centered} onChange={(ev) => patchCol({ ey: Number(ev.target.value) || 0, centered: false })} />
          </label>
          <label>
            P1 FX (t)
            <input type="number" step="0.1" value={selected.P1} onChange={(ev) => patchCol({ P1: Number(ev.target.value) || 0 })} />
          </label>
          <label>
            P2 FY (t)
            <input type="number" step="0.1" value={selected.P2} onChange={(ev) => patchCol({ P2: Number(ev.target.value) || 0 })} />
          </label>
          <label>
            P3 FZ (t)
            <input type="number" step="0.1" value={selected.P3} onChange={(ev) => patchCol({ P3: Number(ev.target.value) || 0 })} />
          </label>
          <label>
            M1 T (t·m)
            <input type="number" step="0.1" value={selected.M1} onChange={(ev) => patchCol({ M1: Number(ev.target.value) || 0 })} />
          </label>
          <label>
            M2 (t·m)
            <input type="number" step="0.1" value={selected.M2} onChange={(ev) => patchCol({ M2: Number(ev.target.value) || 0 })} />
          </label>
          <label>
            M3 (t·m)
            <input type="number" step="0.1" value={selected.M3} onChange={(ev) => patchCol({ M3: Number(ev.target.value) || 0 })} />
          </label>
          <button type="button" className="btn secondary" onClick={removeCol}>
            Quitar columna
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function LosaIdentificacion({ model, tipo = "maciza" }: { model: MaeModel; tipo?: "maciza" | "aligerada" }) {
  const found = identifyLosa(model, tipo);
  if (!found.panes.length) {
    return <p className="mae-ident">Todos los vanos están como hueco. Pulse «Todos techo» o «Crear ejes» (quedan como techo) para calcular aceros.</p>;
  }
  return (
    <div className="mae-ident">
      <p>
        <strong>
          {found.panes.length} paño(s) techo · {found.voids.length} hueco(s) · {found.strips.length} franja(s)
        </strong>
        {" — "}
        {found.nAnalisis} análisis (no 2 genéricos X e Y).
      </p>
      {found.panes.length ? (
        <ul>
          {found.panes.map((p) => (
            <li key={p.id}>
              Paño {p.id}: {p.lx.toFixed(2)}×{p.ly.toFixed(2)} m · {p.twoWay ? "2 dir." : "1 dir."} · bordes L/R/B/T{" "}
              {edgeLabel(p.edges.L)}/{edgeLabel(p.edges.R)}/{edgeLabel(p.edges.B)}/{edgeLabel(p.edges.T)} · caso {p.caso}
            </li>
          ))}
        </ul>
      ) : null}
      {found.strips.length ? (
        <ul>
          {found.strips.map((s) => (
            <li key={s.id}>{s.why}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PlantIdentificacion({ mode, model }: { mode: MaeMode; model: MaeModel }) {
  const nx = nxOf(model);
  const ny = nyOf(model);
  const nCells = model.cells.flat().filter(Boolean).length;
  const geom = paintedInertia(model);
  const nudos = (nx + 1) * (ny + 1);
  let nudosLive = 0;
  for (let iy = 0; iy < model.axesY.length; iy++) {
    for (let ix = 0; ix < model.axesX.length; ix++) {
      const live = [
        [ix - 1, iy - 1],
        [ix, iy - 1],
        [ix - 1, iy],
        [ix, iy],
      ].some(([i, j]) => i >= 0 && j >= 0 && i < nx && j < ny && Boolean(model.cells[j]?.[i]));
      if (live) nudosLive += 1;
    }
  }
  const spansX = model.axesX
    .slice(0, -1)
    .map((x, i) => (model.axesX[i + 1] - x).toFixed(2))
    .join(" + ");
  const spansY = model.axesY
    .slice(0, -1)
    .map((y, i) => (model.axesY[i + 1] - y).toFixed(2))
    .join(" + ");
  const kind = mode === "platea" ? "platea" : "zapata";
  if (nCells < 1) {
    return (
      <p className="mae-ident">
        Grilla {nx} vanos X × {ny} vanos Y, sin {kind} pintada. Pulse «Pintar toda» o pinte celdas; luego «Columnas en nudos».
      </p>
    );
  }
  return (
    <div className="mae-ident">
      <p>
        <strong>
          Grilla {nx}×{ny} vanos · {nCells} celda(s) · A={geom.A.toFixed(2)} m² · {model.cols.length} columna(s)
        </strong>
        {nudosLive > model.cols.length
          ? ` — faltan ${nudosLive - model.cols.length} columna(s) en nudos pintados.`
          : ` — ${nudos} nudos de malla.`}
      </p>
      <ul>
        <li>Vanos X: {spansX} m</li>
        <li>Vanos Y: {spansY} m</li>
        <li>
          Centroide xc={geom.xc.toFixed(2)} m · yc={geom.yc.toFixed(2)} m · Ixx={geom.Ixx.toFixed(2)} m⁴ · Iyy={geom.Iyy.toFixed(2)} m⁴
        </li>
      </ul>
    </div>
  );
}

function patchStudio(model: MaeModel, extra: Record<string, string> = {}) {
  return {
    ...dumpBoth(model),
    studioJson: dumpMae(model),
    nBayX: String(Math.max(1, model.axesX.length - 1)),
    nBayY: String(Math.max(1, model.axesY.length - 1)),
    nX: String(Math.max(1, model.axesX.length - 1)),
    nY: String(Math.max(1, model.axesY.length - 1)),
    ...extra,
  };
}

export function MaeCatalogHost({
  mode,
  values,
  onPatch,
}: {
  mode: MaeMode;
  values: Record<string, string>;
  onPatch: (patch: Record<string, string>) => void;
}) {
  const parsed = parseMae(values.studioJson, exampleModel(mode));
  const adopted0 = mode === "losa" ? adoptRoofIfEmpty(parsed) : { model: parsed, adopted: false };
  const model = adopted0.model;
  const [tool, setTool] = useState<MaeTool>("celda");
  const adoptedRoofRef = useRef(false);
  useEffect(() => {
    if (mode !== "losa" || adoptedRoofRef.current || !adopted0.adopted) return;
    adoptedRoofRef.current = true;
    onPatch(patchStudio(adopted0.model));
  }, [mode, adopted0.adopted, values.studioJson]);
  const nX = model.axesX.length - 1;
  const nY = model.axesY.length - 1;
  const tools: { id: MaeTool; label: string }[] =
    mode === "losa"
      ? [
          { id: "celda", label: "Paño on/off" },
          { id: "unir", label: "Unir / separar" },
          { id: "apoyo", label: "Apoyo del eje" },
        ]
      : [
          { id: "celda", label: "Pintar planta" },
          { id: "columna", label: "Colocar columna" },
        ];
  return (
    <div>
      <div className="mae-tools">
        <label>
          {mode === "losa" ? "Paños X" : "Vanos X"}
          <input
            type="number"
            min={1}
            max={12}
            value={nX}
            onChange={(ev) => {
              const nx = Number(ev.target.value) || 1;
              const next =
                mode === "losa"
                  ? createLosaAxes(model, nx, nY, false)
                  : createGridAxes(model, nx, nY, { resetCells: false, paint: false });
              onPatch(patchStudio(next));
            }}
          />
        </label>
        <label>
          {mode === "losa" ? "Paños Y" : "Vanos Y"}
          <input
            type="number"
            min={1}
            max={12}
            value={nY}
            onChange={(ev) => {
              const ny = Number(ev.target.value) || 1;
              const next =
                mode === "losa"
                  ? createLosaAxes(model, nX, ny, false)
                  : createGridAxes(model, nX, ny, { resetCells: false, paint: false });
              onPatch(patchStudio(next));
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            const next =
              mode === "losa"
                ? createLosaAxes(model, nX, nY, true)
                : createGridAxes(model, nX, nY, { resetCells: true, paint: false });
            onPatch(patchStudio(next, { maeSel: "" }));
            setTool("celda");
          }}
        >
          {mode === "losa" ? "Crear ejes" : "Crear grilla"}
        </button>
        {mode === "losa" ? (
          <button type="button" onClick={() => onPatch(patchStudio(fillLosaRoof(model, true)))}>
            Todos techo
          </button>
        ) : (
          <>
            <button type="button" onClick={() => onPatch(patchStudio(fillLosaRoof(model, true)))}>
              Pintar toda
            </button>
            <button
              type="button"
              onClick={() => onPatch(patchStudio(fillLosaRoof({ ...model, cols: [] }, false), { maeSel: "" }))}
            >
              Limpiar planta
            </button>
            <button
              type="button"
              onClick={() => {
                const next = placeColsOnPainted(model, mode);
                onPatch(patchStudio(next));
                setTool("columna");
              }}
            >
              Columnas en nudos
            </button>
          </>
        )}
        {tools.map((t) => (
          <button key={t.id} type="button" className={tool === t.id ? "is-on" : ""} onClick={() => setTool(t.id)}>
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const next = exampleModel(mode);
            onPatch(patchStudio(next, { maeSel: "" }));
          }}
        >
          Cargar ejemplo
        </button>
      </div>
      {mode === "losa" && tool === "unir" ? (
        <p className="mae-hint">Modo unir: pulse la línea interior dorada entre dos paños verdes. Rojo discontinuo = ya unidos (clic otra vez separa). No une contra un hueco.</p>
      ) : null}
      <MaeCanvas
        mode={mode}
        model={model}
        tool={tool}
        sel={values.maeSel || null}
        onSelect={(id) => onPatch({ maeSel: id || "" })}
        onChange={(next, extra) => onPatch(patchStudio(next, extra))}
      />
      {mode === "losa" ? (
        <LosaIdentificacion model={model} tipo={values.tipoLosa === "aligerada" ? "aligerada" : "maciza"} />
      ) : (
        <PlantIdentificacion mode={mode} model={model} />
      )}
    </div>
  );
}
