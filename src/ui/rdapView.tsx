import { useEffect, useMemo, useRef, useState } from "react";
import { fmt } from "../lib/num";
import { longitudPipe } from "../lib/rdap/model";
import { colorCota, interpolarTin, rangoCotas, tinDe } from "../lib/rdap/surface";
import type { RdapNode, RdapProject, RunResult } from "../lib/rdap/types";

export type RdapTool = "select" | "pan" | "junction" | "reservoir" | "tank" | "hydrant" | "pipe" | "pump" | "valve";

function clampZoom(k: number) {
  return Math.min(8, Math.max(0.25, k));
}

/** Trackpad / rueda = pan. Shift+rueda = zoom. Pinch (ctrl) nunca cambia la escala. */
function wheelWantsZoom(e: WheelEvent) {
  return e.shiftKey && !e.ctrlKey && !e.metaKey;
}

function HandIcon() {
  return (
    <svg className="rdap-pan-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M13.2 2.1a1.6 1.6 0 0 0-1.7 1.6v7.3l-.5-6.8A1.6 1.6 0 0 0 9.4 2.6 1.6 1.6 0 0 0 7.8 4.2v8.2l-1-2.4a1.65 1.65 0 1 0-3.1 1.15L6.3 18.2A6.2 6.2 0 0 0 12 22.2h2.6A5.7 5.7 0 0 0 20.3 16.5V9a1.6 1.6 0 0 0-3.2 0v1.8h-.4V3.7A1.6 1.6 0 0 0 15.1 2.1 1.6 1.6 0 0 0 13.5 3.7v7.6h-.3V3.7a1.6 1.6 0 0 0-1.6-1.6Z"
      />
    </svg>
  );
}

function SelectIcon() {
  return (
    <svg className="rdap-pan-ico" viewBox="0 0 16 16" aria-hidden>
      <path fill="currentColor" d="M2 1 L2 13 L5.5 10 L8 15 L10 14 L7.5 9 L12 9 Z" />
    </svg>
  );
}

export type RdapHit =
  | { kind: "node"; id: string }
  | { kind: "pipe"; id: string }
  | { kind: "pump"; id: string }
  | { kind: "valve"; id: string }
  | { kind: "empty"; x: number; y: number };

export type RdapLayers = {
  tin: boolean;
  topo: boolean;
  grid: boolean;
  labels: boolean;
  results: boolean;
  flow: boolean;
};

const LAYERS_ON: RdapLayers = { tin: true, topo: true, grid: true, labels: true, results: true, flow: true };

function colorP(p: number, min: number, max: number) {
  if (p < min) return "#8a2c2c";
  if (p > max) return "#6b4a12";
  return "#1f6b3a";
}

function pathNodos(project: RdapProject, a: string, b: string): string[] {
  const adj = new Map<string, string[]>();
  for (const n of project.nodes) adj.set(n.id, []);
  for (const t of project.pipes.filter((x) => x.status === "open")) {
    adj.get(t.start)?.push(t.end);
    adj.get(t.end)?.push(t.start);
  }
  const prev = new Map<string, string | null>();
  const q = [a];
  prev.set(a, null);
  while (q.length) {
    const u = q.shift()!;
    if (u === b) break;
    for (const v of adj.get(u) ?? []) {
      if (!prev.has(v)) {
        prev.set(v, u);
        q.push(v);
      }
    }
  }
  if (!prev.has(b)) return [];
  const out = [b];
  while (out[0] !== a) {
    const p = prev.get(out[0]);
    if (!p) return [];
    out.unshift(p);
  }
  return out;
}

function extent(project: RdapProject) {
  const xs = [...project.nodes.map((n) => n.x), ...project.topoPoints.map((p) => p.x)];
  const ys = [...project.nodes.map((n) => n.y), ...project.topoPoints.map((p) => p.y)];
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 100);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 100);
  return { minX, maxX, minY, maxY, w: maxX - minX || 1, h: maxY - minY || 1 };
}

function niceStep(raw: number) {
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-6)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
}

function ticks(min: number, max: number, step: number) {
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

export function RdapMap({
  project,
  result,
  selected,
  tool,
  pipeFrom,
  scenarioLabel,
  chrome = true,
  onHit,
  onMoveNode,
  onTool,
}: {
  project: RdapProject;
  result: RunResult | null;
  selected: string;
  tool: RdapTool;
  pipeFrom: string | null;
  scenarioLabel?: string;
  chrome?: boolean;
  onHit: (hit: RdapHit) => void;
  onMoveNode?: (id: string, x: number, y: number) => void;
  onTool?: (tool: RdapTool) => void;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0, k: 1 });
  const [layers, setLayers] = useState<RdapLayers>(LAYERS_ON);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<string>("");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const panning = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const pendingPick = useRef<Exclude<RdapHit, { kind: "empty" }> | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef(pan);
  panRef.current = pan;
  const isPan = tool === "pan" || spaceHeld;
  const ext = extent(project);
  const pad = 56;
  const VW = 1120;
  const VH = 640;
  const toX = (x: number) => pad + ((x - ext.minX) / ext.w) * (VW - pad * 2);
  const toY = (y: number) => pad + (1 - (y - ext.minY) / ext.h) * (VH - pad * 2);
  const fromSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * VW;
    const sy = ((clientY - r.top) / r.height) * VH;
    const x = (sx - pan.x) / pan.k;
    const y = (sy - pan.y) / pan.k;
    const wx = ext.minX + ((x - pad) / (VW - pad * 2)) * ext.w;
    const wy = ext.minY + (1 - (y - pad) / (VH - pad * 2)) * ext.h;
    return { x: wx, y: wy };
  };

  function zoomAtSvg(sx: number, sy: number, factor: number) {
    setPan((p) => {
      const k2 = clampZoom(p.k * factor);
      return {
        k: k2,
        x: sx - ((sx - p.x) / p.k) * k2,
        y: sy - ((sy - p.y) / p.k) * k2,
      };
    });
  }

  function beginPan(e: React.PointerEvent) {
    const p = panRef.current;
    panning.current = { x: p.x, y: p.y, px: e.clientX, py: e.clientY, moved: false };
    setGrabbing(true);
    svgRef.current?.setPointerCapture?.(e.pointerId);
  }

  function wantsPan(e: React.PointerEvent) {
    return e.button === 1 || e.button === 2 || ((tool === "pan" || spaceHeld) && e.button === 0);
  }

  function onElementDown(e: React.PointerEvent, hit: Exclude<RdapHit, { kind: "empty" }>) {
    if (e.button === 1 || e.button === 2) return;
    e.stopPropagation();
    if (tool === "pan" || spaceHeld) {
      pendingPick.current = hit;
      beginPan(e);
      return;
    }
    pendingPick.current = null;
    if (hit.kind === "node" && tool === "select") {
      drag.current = { id: hit.id, moved: false };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    onHit(hit);
  }

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const r = svgRef.current?.getBoundingClientRect();
      if (!r) return;
      if (e.ctrlKey || e.metaKey) return;
      if (wheelWantsZoom(e)) {
        const factor = e.deltaY > 0 ? 0.9 : 1.11;
        const sx = ((e.clientX - r.left) / r.width) * VW;
        const sy = ((e.clientY - r.top) / r.height) * VH;
        zoomAtSvg(sx, sy, factor);
        return;
      }
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1;
      const sx = VW / r.width;
      const sy = VH / r.height;
      setPan((p) => ({
        ...p,
        x: p.x - e.deltaX * unit * sx,
        y: p.y - e.deltaY * unit * sy,
      }));
    };
    const killGesture = (e: Event) => e.preventDefault();
    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("gesturestart", killGesture);
    wrap.addEventListener("gesturechange", killGesture);
    wrap.addEventListener("gestureend", killGesture);
    return () => {
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("gesturestart", killGesture);
      wrap.removeEventListener("gesturechange", killGesture);
      wrap.removeEventListener("gestureend", killGesture);
    };
  }, []);

  useEffect(() => {
    const typing = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      const tag = n?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || n?.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || typing(e.target)) return;
      e.preventDefault();
      setSpaceHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const tin = useMemo(() => tinDe(project.topoPoints), [project.topoPoints]);
  const { zmin, zmax } = rangoCotas(tin.pts);
  const zCursor = cursor ? interpolarTin(cursor.x, cursor.y, project.topoPoints) : null;
  const worldPerUnit = ext.w / (VW - pad * 2) / pan.k;
  const scaleM = niceStep(80 * worldPerUnit);
  const scalePx = scaleM / worldPerUnit;
  const gridStep = niceStep(Math.max(ext.w, ext.h) / 8);
  const gx = ticks(ext.minX - gridStep, ext.maxX + gridStep, gridStep);
  const gy = ticks(ext.minY - gridStep, ext.maxY + gridStep, gridStep);
  const method =
    project.method === "darcy-weisbach" ? "Darcy–Weisbach"
      : project.method === "manning" ? "Manning"
        : "Hazen–Williams";

  function toggle(key: keyof RdapLayers) {
    setLayers((L) => ({ ...L, [key]: !L[key] }));
  }

  return (
    <div
      ref={wrapRef}
      className={`rdap-map-wrap${isPan ? " is-pan" : ""}${grabbing ? " is-panning" : ""}`}
    >
      {chrome && (
        <>
          <div className="rdap-map-hud rdap-map-hud-tl">
            <span className="rdap-chip">{project.meta.datum} {project.meta.utmZone}</span>
            <span className="rdap-chip">{method}</span>
            <span className="rdap-chip on">{scenarioLabel ?? "Qp"}</span>
          </div>
          <div className="rdap-map-hud rdap-map-hud-tr" role="toolbar" aria-label="Navegación del plano">
            <button
              type="button"
              className={tool === "select" ? "on" : ""}
              title="Seleccionar — clic en nudo, tubería, bomba o válvula para ver propiedades"
              aria-pressed={tool === "select"}
              onClick={() => onTool?.("select")}
            >
              <SelectIcon />
            </button>
            <button
              type="button"
              className={tool === "pan" ? "on" : ""}
              title="Pan — desplazar la vista (también: dos dedos en el trackpad, clic derecho o espacio)"
              aria-pressed={tool === "pan"}
              onClick={() => onTool?.("pan")}
            >
              <HandIcon />
            </button>
            <button type="button" title="Acercar" onClick={() => zoomAtSvg(VW / 2, VH / 2, 1.25)}>+</button>
            <button type="button" title="Alejar" onClick={() => zoomAtSvg(VW / 2, VH / 2, 1 / 1.25)}>−</button>
            <button type="button" title="Encajar red" onClick={() => setPan({ x: 0, y: 0, k: 1 })}>⌂</button>
            <span className="rdap-chip">{Math.round(pan.k * 100)}%</span>
          </div>
          <div className="rdap-map-layers">
            <p>Capas</p>
            {([
              ["tin", "TIN / cotas"],
              ["topo", "Puntos COGO"],
              ["grid", "Retícula UTM"],
              ["labels", "Etiquetas"],
              ["results", "Resultados"],
              ["flow", "Sentido de flujo"],
            ] as const).map(([k, lab]) => (
              <label key={k}>
                <input type="checkbox" checked={layers[k]} onChange={() => toggle(k)} />
                {lab}
              </label>
            ))}
          </div>
          <div className="rdap-map-legend">
            <p>Leyenda</p>
            <div className="rdap-legend-ramp">
              <span>Z {fmt(zmin, 1)}</span>
              <i />
              <span>{fmt(zmax, 1)} m</span>
            </div>
            <ul>
              <li><i className="jn" /> Nudo de demanda</li>
              <li><i className="rs" /> Reservorio / HGL</li>
              <li><i className="tk" /> Tanque</li>
              <li><i className="hy" /> Hidrante</li>
              <li><i className="pp" /> Tubería</li>
              <li><i className="vl" /> Válvula</li>
              <li><i className="ok" /> P en rango</li>
              <li><i className="bad" /> P fuera de criterio</li>
            </ul>
          </div>
        </>
      )}
      <svg
        ref={svgRef}
        className={`rdap-map${isPan ? " is-pan" : ""}${grabbing ? " is-panning" : ""}`}
        viewBox={`0 0 ${VW} ${VH}`}
        onPointerDown={(e) => {
          if (wantsPan(e)) {
            e.preventDefault();
            beginPan(e);
          }
        }}
        onPointerMove={(e) => {
          const w = fromSvg(e.clientX, e.clientY);
          setCursor(w);
          if (panning.current) {
            panning.current.moved = true;
            const r = svgRef.current?.getBoundingClientRect();
            const sx = r ? VW / r.width : 1;
            const sy = r ? VH / r.height : 1;
            setPan({
              ...panRef.current,
              x: panning.current.x + (e.clientX - panning.current.px) * sx,
              y: panning.current.y + (e.clientY - panning.current.py) * sy,
            });
            return;
          }
          if (drag.current && onMoveNode) {
            drag.current.moved = true;
            onMoveNode(drag.current.id, w.x, w.y);
          }
        }}
        onPointerLeave={() => setCursor(null)}
        onPointerUp={(e) => {
          if (panning.current) {
            const moved = panning.current.moved;
            const pick = pendingPick.current;
            panning.current = null;
            pendingPick.current = null;
            setGrabbing(false);
            try { svgRef.current?.releasePointerCapture?.(e.pointerId); } catch { /* already released */ }
            if (!moved && pick) {
              onHit(pick);
              return;
            }
            if (moved || tool === "pan" || spaceHeld) return;
          }
          if (drag.current) {
            const moved = drag.current.moved;
            const id = drag.current.id;
            drag.current = null;
            if (!moved) onHit({ kind: "node", id });
            return;
          }
          if (tool === "pan" || spaceHeld) return;
          const w = fromSvg(e.clientX, e.clientY);
          onHit({ kind: "empty", x: w.x, y: w.y });
        }}
        onPointerCancel={() => {
          panning.current = null;
          pendingPick.current = null;
          drag.current = null;
          setGrabbing(false);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern id="rdap-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#d8cbb3" strokeWidth="0.55" />
          </pattern>
          <linearGradient id="rdap-ramp" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={colorCota(zmin, zmin, zmax)} />
            <stop offset="1" stopColor={colorCota(zmax, zmin, zmax)} />
          </linearGradient>
          <marker id="rdap-flow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1 L 10 5 L 0 9 Z" fill="#0b3d66" />
          </marker>
          <filter id="rdap-soft">
            <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#1a140c" floodOpacity="0.18" />
          </filter>
        </defs>
        <rect width={VW} height={VH} fill="#efe6d4" />
        {layers.grid && <rect width={VW} height={VH} fill="url(#rdap-grid)" />}
        <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.k})`}>
          {layers.grid && gx.map((x) => (
            <g key={`gx-${x}`}>
              <line x1={toX(x)} y1={toY(ext.minY) + 12} x2={toX(x)} y2={toY(ext.maxY) - 12} stroke="#c4b396" strokeWidth="0.45" strokeDasharray="3 5" />
              <text x={toX(x)} y={toY(ext.minY) + 24} fontSize="8" fill="#6b5a44" textAnchor="middle">{fmt(x, 0)}</text>
            </g>
          ))}
          {layers.grid && gy.map((y) => (
            <g key={`gy-${y}`}>
              <line x1={toX(ext.minX) - 12} y1={toY(y)} x2={toX(ext.maxX) + 12} y2={toY(y)} stroke="#c4b396" strokeWidth="0.45" strokeDasharray="3 5" />
              <text x={toX(ext.minX) - 16} y={toY(y) + 3} fontSize="8" fill="#6b5a44" textAnchor="end">{fmt(y, 0)}</text>
            </g>
          ))}
          {layers.tin && tin.tris.map((t, i) => {
            const A = tin.pts[t.a];
            const B = tin.pts[t.b];
            const C = tin.pts[t.c];
            const z = (A.z + B.z + C.z) / 3;
            return (
              <polygon
                key={i}
                points={`${toX(A.x)},${toY(A.y)} ${toX(B.x)},${toY(B.y)} ${toX(C.x)},${toY(C.y)}`}
                fill={colorCota(z, zmin, zmax)}
                fillOpacity="0.42"
                stroke="#b9a888"
                strokeWidth="0.35"
              />
            );
          })}
          {layers.topo && tin.pts.map((p) => (
            <g key={p.id}>
              <circle cx={toX(p.x)} cy={toY(p.y)} r="1.8" fill="#6a4e28" opacity="0.8" />
              {layers.labels && pan.k > 1.15 && (
                <text x={toX(p.x) + 4} y={toY(p.y) - 3} fontSize="7" fill="#6a4e28">{fmt(p.z, 1)}</text>
              )}
            </g>
          ))}
          {project.pipes.map((t) => {
            const a = project.nodes.find((n) => n.id === t.start);
            const b = project.nodes.find((n) => n.id === t.end);
            if (!a || !b) return null;
            const pr = result?.pipes.find((x) => x.id === t.id);
            const col = !pr ? "#2a4a68" : pr.status === "CRITICAL" ? "#8a2c2c" : pr.status === "WARNING" ? "#b8860b" : "#1d4e89";
            const sw = Math.max(3.2, Math.min(9, t.dnMm / 28));
            const midX = (toX(a.x) + toX(b.x)) / 2;
            const midY = (toY(a.y) + toY(b.y)) / 2;
            const q = pr?.qLs ?? 0;
            const fwd = q >= 0;
            const x1 = fwd ? toX(a.x) : toX(b.x);
            const y1 = fwd ? toY(a.y) : toY(b.y);
            const x2 = fwd ? toX(b.x) : toX(a.x);
            const y2 = fwd ? toY(b.y) : toY(a.y);
            return (
              <g
                key={t.id}
                onPointerDown={(e) => onElementDown(e, { kind: "pipe", id: t.id })}
                onPointerEnter={() => setHover(t.id)}
                onPointerLeave={() => setHover("")}
                style={{ cursor: isPan ? "grab" : "pointer" }}
              >
                {selected === t.id && (
                  <line x1={toX(a.x)} y1={toY(a.y)} x2={toX(b.x)} y2={toY(b.y)} stroke="#c4a056" strokeWidth={sw + 5} strokeLinecap="round" />
                )}
                <line x1={toX(a.x)} y1={toY(a.y)} x2={toX(b.x)} y2={toY(b.y)} stroke="#efe6d4" strokeWidth={sw + 4} strokeLinecap="round" />
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={col}
                  strokeWidth={selected === t.id || hover === t.id ? sw + 1.6 : sw}
                  strokeLinecap="round"
                  strokeDasharray={t.status === "closed" ? "7 5" : undefined}
                  markerEnd={layers.flow && pr ? "url(#rdap-flow)" : undefined}
                />
                {layers.labels && (
                  <g filter="url(#rdap-soft)">
                    <rect x={midX - 46} y={midY - 22} width="92" height="16" rx="2" fill="#f7f1e4" fillOpacity="0.92" />
                    <text x={midX} y={midY - 10} fontSize="10" fill="#1f1a14" fontWeight="700" textAnchor="middle">
                      {t.id}  Ø{t.dnMm}{layers.results && pr ? `  ${fmt(pr.qLs, 2)} L/s` : ""}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          {project.pumps.map((b) => {
            const a = project.nodes.find((n) => n.id === b.start);
            const c = project.nodes.find((n) => n.id === b.end);
            if (!a || !c) return null;
            const x = (toX(a.x) + toX(c.x)) / 2;
            const y = (toY(a.y) + toY(c.y)) / 2;
            const br = result?.pumps.find((x) => x.id === b.id);
            return (
              <g key={b.id} onPointerDown={(e) => onElementDown(e, { kind: "pump", id: b.id })} style={{ cursor: isPan ? "grab" : "pointer" }}>
                {selected === b.id && <circle cx={x} cy={y} r="16" fill="none" stroke="#c4a056" strokeWidth="2" />}
                <circle cx={x} cy={y} r="11" fill="#0b4f8a" stroke="#fff" strokeWidth="1.4" />
                <polygon points={`${x - 3},${y - 6} ${x + 7},${y} ${x - 3},${y + 6}`} fill="#fff" />
                {layers.labels && (
                  <text x={x + 14} y={y + 4} fontSize="10" fill="#0b4f8a" fontWeight="700">
                    {b.id}{layers.results && br ? `  ${fmt(br.qLs, 1)} L/s` : ""}
                  </text>
                )}
              </g>
            );
          })}
          {project.valves.map((v) => {
            const a = project.nodes.find((n) => n.id === v.start);
            const c = project.nodes.find((n) => n.id === v.end);
            if (!a || !c) return null;
            const x = (toX(a.x) + toX(c.x)) / 2;
            const y = (toY(a.y) + toY(c.y)) / 2;
            const vr = result?.valves.find((x) => x.id === v.id);
            const col = vr?.mode === "CLOSED" ? "#5c5c5c" : vr?.mode === "ACTIVE" ? "#7a1f3d" : "#9a3b5c";
            return (
              <g key={v.id} onPointerDown={(e) => onElementDown(e, { kind: "valve", id: v.id })} style={{ cursor: isPan ? "grab" : "pointer" }}>
                {selected === v.id && <circle cx={x} cy={y} r="16" fill="none" stroke="#c4a056" strokeWidth="2" />}
                <line x1={toX(a.x)} y1={toY(a.y)} x2={toX(c.x)} y2={toY(c.y)} stroke={col} strokeWidth={selected === v.id ? 5 : 3} strokeDasharray="6 4" strokeLinecap="round" />
                <rect x={x - 8} y={y - 8} width="16" height="16" fill={col} stroke="#fff" transform={`rotate(45 ${x} ${y})`} />
                {layers.labels && (
                  <text x={x + 14} y={y + 4} fontSize="10" fill={col} fontWeight="700">
                    {v.id} {v.kind.toUpperCase()}{layers.results && vr ? ` ${vr.mode}` : ""}
                  </text>
                )}
              </g>
            );
          })}
          {project.nodes.map((n) => {
            const nr = result?.nodes.find((x) => x.id === n.id);
            const fill =
              n.kind === "reservoir" ? "#0b4f8a"
                : n.kind === "tank" ? "#3d6b1a"
                  : n.kind === "hydrant" ? "#b42318"
                    : colorP(nr?.pressureMca ?? 20, project.criteria.pMinMca, project.criteria.pMaxMca);
            const r = selected === n.id || pipeFrom === n.id ? 11 : 8;
            return (
              <g
                key={n.id}
                onPointerDown={(e) => onElementDown(e, { kind: "node", id: n.id })}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover("")}
                style={{ cursor: isPan ? "grab" : tool === "select" ? "grab" : "pointer" }}
              >
                {selected === n.id && <circle cx={toX(n.x)} cy={toY(n.y)} r={r + 6} fill="none" stroke="#c4a056" strokeWidth="1.4" />}
                {n.kind === "reservoir" ? (
                  <rect x={toX(n.x) - r} y={toY(n.y) - r} width={r * 2} height={r * 2} fill={fill} stroke="#1f1a14" strokeWidth="1.2" />
                ) : n.kind === "tank" ? (
                  <rect x={toX(n.x) - r} y={toY(n.y) - r} width={r * 2} height={r * 2} rx="3" fill={fill} stroke="#1f1a14" strokeWidth="1.2" />
                ) : (
                  <circle cx={toX(n.x)} cy={toY(n.y)} r={r} fill={fill} stroke="#1f1a14" strokeWidth={pipeFrom === n.id ? 2.6 : 1.15} />
                )}
                {layers.labels && (
                  <>
                    <text x={toX(n.x) + 13} y={toY(n.y) - 9} fontSize="12" fontWeight="700" fill="#1f1a14">{n.id}</text>
                    <text x={toX(n.x) + 13} y={toY(n.y) + 6} fontSize="9.5" fill="#3d3228">
                      Z {fmt(n.ground, 2)}
                      {layers.results && nr && n.kind !== "reservoir" && n.kind !== "tank" ? ` · P ${fmt(nr.pressureMca, 1)}` : ""}
                    </text>
                    {layers.results && nr && n.kind !== "reservoir" && (
                      <text x={toX(n.x) + 13} y={toY(n.y) + 18} fontSize="8.5" fill="#1d4e89">HGL {fmt(nr.hgl, 2)}</text>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </g>
        <g className="rdap-north" transform={`translate(${VW - 52} 46)`}>
          <circle r="18" fill="#f7f1e4" stroke="#1f2a38" strokeWidth="1.2" />
          <polygon points="0,-13 4,8 0,4 -4,8" fill="#7a1f3d" />
          <text y="24" fontSize="9" textAnchor="middle" fill="#1f2a38" fontWeight="700">N</text>
        </g>
      </svg>
      {chrome && (
        <>
          <div className="rdap-map-scale">
            <b>{fmt(scaleM, 0)} m</b>
            <i style={{ width: Math.max(36, Math.min(140, scalePx)) }} />
            <span>escala gráfica</span>
          </div>
          <aside className="rdap-cartela">
            <p className="k">AP-09 · MemoriaCalc</p>
            <h4>Diseño de red de agua</h4>
            <dl>
              <div><dt>Proyecto</dt><dd>{project.meta.proyecto}</dd></div>
              <div><dt>Ubicación</dt><dd>{project.meta.ubicacion || "—"}</dd></div>
              <div><dt>Sistema</dt><dd>{project.meta.tipoSistema} · {project.meta.tipoRed}</dd></div>
              <div><dt>Datum</dt><dd>{project.meta.datum} UTM {project.meta.utmZone}</dd></div>
              <div><dt>Motor</dt><dd>{method}</dd></div>
              <div><dt>Escenario</dt><dd>{scenarioLabel ?? "Qp"}</dd></div>
              <div><dt>Inventario</dt><dd>{project.nodes.length} nudos · {project.pipes.length} tramos</dd></div>
              <div><dt>Fecha</dt><dd>{project.meta.fecha}</dd></div>
            </dl>
          </aside>
        </>
      )}
      <footer className="rdap-map-status">
        <span>X {cursor ? fmt(cursor.x, 2) : "—"} m</span>
        <span>Y {cursor ? fmt(cursor.y, 2) : "—"} m</span>
        <span>Z TIN {zCursor != null ? `${fmt(zCursor, 2)} m` : "fuera de malla"}</span>
        <span>TIN {tin.tris.length} Δ · {project.topoPoints.length} pts</span>
        <span>P {project.criteria.pMinMca}–{project.criteria.pMaxMca} m.c.a.</span>
        <span>V ≤ {project.criteria.vMaxMs} m/s</span>
        <em>Seleccionar = clic en el elemento · Dos dedos = pan · Esc = volver a seleccionar</em>
      </footer>
    </div>
  );
}

export function RdapPerfil({
  project,
  result,
  from,
  to,
}: {
  project: RdapProject;
  result: RunResult | null;
  from: string;
  to: string;
}) {
  const ids = useMemo(() => pathNodos(project, from, to), [project, from, to]);
  const nodes = ids.map((id) => project.nodes.find((n) => n.id === id)).filter(Boolean) as RdapNode[];
  if (nodes.length < 2) return null;
  let acc = 0;
  const pts = nodes.map((n, i) => {
    if (i > 0) {
      const pipe = project.pipes.find(
        (t) => (t.start === nodes[i - 1].id && t.end === n.id) || (t.end === nodes[i - 1].id && t.start === n.id),
      );
      acc += longitudPipe(pipe ?? project.pipes[0], nodes[i - 1], n).L;
    }
    const nr = result?.nodes.find((x) => x.id === n.id);
    return { n, s: acc, z: n.ground, inv: n.invert ?? n.ground - 1.6, hgl: nr?.hgl ?? n.ground + 15, p: nr?.pressureMca ?? 0 };
  });
  const sMax = pts[pts.length - 1].s || 1;
  const zMin = Math.min(...pts.map((p) => p.inv), ...pts.map((p) => p.hgl)) - 2;
  const zMax = Math.max(...pts.map((p) => p.z), ...pts.map((p) => p.hgl)) + 2;
  const X = (s: number) => 64 + (s / sMax) * 820;
  const Y = (z: number) => 348 - ((z - zMin) / (zMax - zMin || 1)) * 286;
  const poly = (key: "z" | "inv" | "hgl") => pts.map((p) => `${X(p.s)},${Y(p[key])}`).join(" ");
  const zStep = niceStep((zMax - zMin) / 6);
  const sStep = niceStep(sMax / 6);
  const zTicks = ticks(Math.ceil(zMin / zStep) * zStep, zMax, zStep);
  const sTicks = ticks(0, sMax, sStep);

  return (
    <svg className="rdap-profile" viewBox="0 0 960 430">
      <rect width="960" height="430" fill="#f7f2e8" />
      <text x="64" y="28" fontSize="13" fontWeight="700" fill="#1f1a14">Perfil longitudinal {from} → {to}</text>
      <text x="64" y="46" fontSize="11" fill="#5c4a3a">
        L = {fmt(sMax, 1)} m · terreno, invert y línea piezométrica
      </text>
      {zTicks.map((z) => (
        <g key={z}>
          <line x1="64" y1={Y(z)} x2="884" y2={Y(z)} stroke="#e0d4be" />
          <text x="58" y={Y(z) + 3} fontSize="9" textAnchor="end" fill="#5c4a3a">{fmt(z, 1)}</text>
        </g>
      ))}
      {sTicks.map((s) => (
        <g key={s}>
          <line x1={X(s)} y1="62" x2={X(s)} y2="348" stroke="#eee4d2" />
          <text x={X(s)} y="366" fontSize="9" textAnchor="middle" fill="#5c4a3a">{fmt(s, 0)}</text>
        </g>
      ))}
      <polygon
        points={`${X(pts[0].s)},${Y(zMin)} ${poly("z")} ${X(pts[pts.length - 1].s)},${Y(zMin)}`}
        fill="#c4a078"
        fillOpacity="0.18"
      />
      <polyline points={poly("z")} fill="none" stroke="#8a3d12" strokeWidth="2.2" />
      <polyline points={poly("inv")} fill="none" stroke="#3d3228" strokeWidth="2.6" />
      <polyline points={poly("hgl")} fill="none" stroke="#0b4f8a" strokeWidth="2.1" strokeDasharray="7 3" />
      {pts.map((p) => (
        <g key={p.n.id}>
          <line x1={X(p.s)} y1={Y(p.z)} x2={X(p.s)} y2={Y(p.inv)} stroke="#b8aa94" />
          <circle cx={X(p.s)} cy={Y(p.z)} r="3" fill="#8a3d12" />
          <circle cx={X(p.s)} cy={Y(p.hgl)} r="2.4" fill="#0b4f8a" />
          <text x={X(p.s)} y="388" fontSize="11" fontWeight="700" textAnchor="middle" fill="#1f1a14">{p.n.id}</text>
          <text x={X(p.s)} y={Y(p.z) - 8} fontSize="8" textAnchor="middle" fill="#8a3d12">{fmt(p.z, 1)}</text>
        </g>
      ))}
      <line x1="64" y1="348" x2="884" y2="348" stroke="#1f1a14" />
      <line x1="64" y1="62" x2="64" y2="348" stroke="#1f1a14" />
      <text x="64" y="410" fontSize="10" fill="#8a3d12">Terreno</text>
      <text x="140" y="410" fontSize="10" fill="#3d3228">Invert</text>
      <text x="200" y="410" fontSize="10" fill="#0b4f8a">HGL</text>
      <text x="260" y="410" fontSize="10" fill="#5c4a3a">Estación (m) · cota (m.s.n.m.)</text>
    </svg>
  );
}
