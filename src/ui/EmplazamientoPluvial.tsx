import type { DestinoDescarga, ElementoPluvial } from "../lib/hidro/canaleta";
import { resolverEmplazamiento, type CuencaResuelta, type Pt } from "../lib/hidro/emplazamiento";

const ink = "#0b1f33";
const brass = "#8a6a32";
const paper = "#f4efe4";

function fillDe(it: CuencaResuelta, selected: boolean): string {
  if (selected) return it.el.tipo === "piso" ? "#c9b48a" : "#edd9a4";
  if (it.el.tipo === "piso") return "#d8d3c6";
  if (it.nivel >= 2) return "#efe0c4";
  return "#f0e8d6";
}

function polyPath(pts: Pt[], to: (p: Pt) => Pt): string {
  return (
    pts
      .map((p, i) => {
        const s = to(p);
        return `${i === 0 ? "M" : "L"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

function wrapLabel(text: string, max = 28): string[] {
  if (text.length <= max) return [text];
  const cut = text.lastIndexOf(" ", max);
  const at = cut > 10 ? cut : max;
  return [text.slice(0, at).trim(), text.slice(at).trim()].filter(Boolean);
}

type Callout = { id: string; x: number; y: number; w: number; h: number; lines: string[]; anchor: Pt };

function placeCallouts(items: CuencaResuelta[], to: (p: Pt) => Pt, VW: number, VH: number, padT: number, padB: number): Callout[] {
  const placed: Callout[] = [];
  const hits = (c: Callout) =>
    placed.some((p) => !(c.x + c.w < p.x || p.x + p.w < c.x || c.y + c.h < p.y || p.y + p.h < c.y));

  for (const it of items) {
    const b = {
      minX: Math.min(...it.poly.map((p) => to(p).x)),
      maxX: Math.max(...it.poly.map((p) => to(p).x)),
      minY: Math.min(...it.poly.map((p) => to(p).y)),
      maxY: Math.max(...it.poly.map((p) => to(p).y)),
    };
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const nivel = it.el.tipo === "piso" ? "piso" : `N${it.nivel}`;
    const sub = [nivel, it.ejes].filter(Boolean).join(" · ");
    const lines = [it.el.codigo, sub].filter(Boolean);
    const w = Math.max(64, ...lines.map((l) => l.length * 6.1 + 10));
    const h = 14 + lines.length * 11;
    const candidates: Pt[] = [
      { x: b.maxX + 8, y: cy - h / 2 },
      { x: b.minX - w - 8, y: cy - h / 2 },
      { x: cx - w / 2, y: b.minY - h - 8 },
      { x: cx - w / 2, y: b.maxY + 8 },
    ];
    let chosen = candidates[0];
    for (const cand of candidates) {
      const box: Callout = {
        id: it.el.id,
        x: Math.max(8, Math.min(cand.x, VW - w - 8)),
        y: Math.max(padT + 2, Math.min(cand.y, VH - padB - h - 4)),
        w,
        h,
        lines,
        anchor: { x: cx, y: cy },
      };
      if (!hits(box)) {
        chosen = { x: box.x, y: box.y };
        break;
      }
    }
    const box: Callout = {
      id: it.el.id,
      x: Math.max(8, Math.min(chosen.x, VW - w - 8)),
      y: Math.max(padT + 2, Math.min(chosen.y, VH - padB - h - 4)),
      w,
      h,
      lines,
      anchor: { x: cx, y: cy },
    };
    let guard = 0;
    while (hits(box) && guard < 10) {
      box.y = Math.min(VH - padB - h - 4, box.y + 16);
      guard += 1;
    }
    placed.push(box);
  }
  return placed;
}

function stallLines(it: CuencaResuelta, to: (p: Pt) => Pt): Pt[][] {
  if (it.el.tipo !== "piso") return [];
  const b = {
    minX: Math.min(...it.poly.map((p) => p.x)),
    maxX: Math.max(...it.poly.map((p) => p.x)),
    minY: Math.min(...it.poly.map((p) => p.y)),
    maxY: Math.max(...it.poly.map((p) => p.y)),
  };
  const step = 2.5;
  const lines: Pt[][] = [];
  for (let x = b.minX + step; x < b.maxX - 0.3; x += step) {
    lines.push([to({ x, y: b.minY + 0.25 }), to({ x, y: b.maxY - 0.25 })]);
  }
  return lines;
}

export function EmplazamientoPluvialSvg({
  elementos,
  selId,
  destino,
  distCimentacion,
  onSelect,
  compact = false,
}: {
  elementos: ElementoPluvial[];
  selId?: string;
  destino: DestinoDescarga;
  distCimentacion: number;
  onSelect?: (id: string) => void;
  compact?: boolean;
}) {
  const plano = resolverEmplazamiento(elementos, destino, distCimentacion);
  const VW = 620;
  const VH = compact ? 392 : 488;
  const PAD_L = 52;
  const PAD_R = 22;
  const PAD_T = 40;
  const PAD_B = compact ? 64 : 86;
  const bw = Math.max(plano.bounds.maxX - plano.bounds.minX, 4);
  const bh = Math.max(plano.bounds.maxY - plano.bounds.minY, 4);
  const s = Math.min((VW - PAD_L - PAD_R) / bw, (VH - PAD_T - PAD_B) / bh);

  const to = (p: Pt): Pt => ({
    x: PAD_L + (p.x - plano.bounds.minX) * s,
    y: PAD_T + (p.y - plano.bounds.minY) * s,
  });

  const uid = compact ? "ui" : "doc";
  const sorted = [...plano.items].sort((a, b) => {
    const ta = a.el.tipo === "piso" ? 0 : 1;
    const tb = b.el.tipo === "piso" ? 0 : 1;
    if (ta !== tb) return ta - tb;
    return a.nivel - b.nivel;
  });
  const sel = plano.items.find((it) => it.el.id === selId);
  const scaleM = bw > 30 ? 10 : 5;
  const scaleFrom = to({ x: plano.bounds.minX + 0.5, y: plano.bounds.maxY - 0.45 });
  const scaleTo = to({ x: plano.bounds.minX + 0.5 + scaleM, y: plano.bounds.maxY - 0.45 });
  const callouts = placeCallouts(sorted, to, VW, VH, PAD_T, PAD_B);
  const discLabel = wrapLabel(
    `${plano.descarga.label}${plano.descarga.setback > 0 ? ` · ${plano.descarga.setback.toFixed(1)} m de cimentación` : ""}`,
    36,
  );
  const discC = {
    x: (to(plano.descarga.poly[0]).x + to(plano.descarga.poly[1]).x) / 2,
    y: Math.max(...plano.descarga.poly.map((p) => to(p).y)) + 12,
  };

  return (
    <div className={`diagram diagram-canaleta pluvial-plan${compact ? " is-ui" : ""}`}>
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id={`emp-hatch-${uid}`} patternUnits="userSpaceOnUse" width="7" height="7">
            <path d="M0 7 L7 0" stroke={brass} strokeWidth="0.55" opacity="0.5" />
          </pattern>
          <pattern id={`emp-tile-${uid}`} patternUnits="userSpaceOnUse" width="10" height="10">
            <path d="M10 0 L0 0 0 10" fill="none" stroke={ink} strokeOpacity="0.08" strokeWidth="0.6" />
          </pattern>
          <marker id={`emp-flow-${uid}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0 1 L6 3.5 L0 6 Z" fill={ink} />
          </marker>
          <marker id={`emp-fall-${uid}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0 1.2 L5 3 L0 4.8 Z" fill="#5a4a28" />
          </marker>
        </defs>

        <rect x="0" y="0" width={VW} height={VH} fill={paper} />
        <rect x="0" y="0" width={VW} height="28" fill="#0f2740" />
        <text x="14" y="19" fill="#f4efe4" fontSize="12" fontFamily="IBM Plex Sans" fontWeight="600">
          Emplazamiento en planta — cuencas, canaletas y bajantes
        </text>

        {plano.ejesX.map((eje) => {
          const a = to({ x: eje.v, y: plano.bounds.minY });
          const b = to({ x: eje.v, y: plano.bounds.maxY });
          return (
            <g key={`x-${eje.label}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0b1f33" strokeOpacity="0.14" strokeDasharray="2 5" />
              <text x={a.x} y={PAD_T - 8} textAnchor="middle" fill={brass} fontSize="10" fontFamily="IBM Plex Sans">
                {eje.label}
              </text>
            </g>
          );
        })}
        {plano.ejesY.map((eje) => {
          const a = to({ x: plano.bounds.minX, y: eje.v });
          const b = to({ x: plano.bounds.maxX, y: eje.v });
          return (
            <g key={`y-${eje.label}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0b1f33" strokeOpacity="0.14" strokeDasharray="2 5" />
              <text x={PAD_L - 7} y={a.y + 3} textAnchor="end" fill={brass} fontSize="10" fontFamily="IBM Plex Sans">
                {eje.label}
              </text>
            </g>
          );
        })}

        <path
          d={polyPath(plano.descarga.poly, to)}
          fill="#c5d4c0"
          fillOpacity="0.5"
          stroke="#4a6a4a"
          strokeWidth="1.1"
          strokeDasharray="5 3"
        />
        {discLabel.map((line, i) => (
          <text
            key={line}
            x={discC.x}
            y={discC.y + i * 11}
            textAnchor="middle"
            fill="#2d4a2d"
            fontSize="9"
            fontFamily="IBM Plex Sans"
          >
            {line}
          </text>
        ))}

        {sorted.map((it) => {
          const selected = it.el.id === selId;
          const wall = it.poly.map((p) => to(p));
          return (
            <g
              key={it.el.id}
              className="cuenca"
              style={{ cursor: onSelect ? "pointer" : "default" }}
              onClick={() => onSelect?.(it.el.id)}
            >
              <path
                d={polyPath(it.poly, to)}
                fill={fillDe(it, selected)}
                stroke={selected ? brass : ink}
                strokeWidth={selected ? 2.2 : 1.15}
              />
              {it.el.tipo === "cubierta" ? <path d={polyPath(it.poly, to)} fill={`url(#emp-tile-${uid})`} stroke="none" /> : null}
              {it.nivel >= 2 ? <path d={polyPath(it.poly, to)} fill={`url(#emp-hatch-${uid})`} stroke="none" /> : null}
              {wall.map((p, i) => {
                const q = wall[(i + 1) % wall.length];
                return (
                  <line
                    key={i}
                    x1={p.x}
                    y1={p.y}
                    x2={q.x}
                    y2={q.y}
                    stroke={ink}
                    strokeOpacity="0.18"
                    strokeWidth="3.4"
                  />
                );
              })}
              {stallLines(it, to).map((ln, i) => (
                <line
                  key={`st-${i}`}
                  x1={ln[0].x}
                  y1={ln[0].y}
                  x2={ln[1].x}
                  y2={ln[1].y}
                  stroke={ink}
                  strokeOpacity="0.16"
                  strokeWidth="0.8"
                />
              ))}
              {it.ridges.map((g, i) => (
                <line
                  key={`rd-${i}`}
                  x1={to(g.a).x}
                  y1={to(g.a).y}
                  x2={to(g.b).x}
                  y2={to(g.b).y}
                  stroke="#5a4030"
                  strokeWidth="1.15"
                  strokeDasharray="5 2"
                />
              ))}
              {it.falls.map((g, i) => (
                <line
                  key={`fl-${i}`}
                  x1={to(g.a).x}
                  y1={to(g.a).y}
                  x2={to(g.b).x}
                  y2={to(g.b).y}
                  stroke="#5a4a28"
                  strokeOpacity="0.55"
                  strokeWidth="0.7"
                  markerEnd={`url(#emp-fall-${uid})`}
                />
              ))}
              {it.gutters.map((g, i) => (
                <line
                  key={`gt-${i}`}
                  x1={to(g.a).x}
                  y1={to(g.a).y}
                  x2={to(g.b).x}
                  y2={to(g.b).y}
                  stroke={selected ? "#6a3a12" : ink}
                  strokeWidth={selected ? 5.4 : 3.8}
                  strokeLinecap="square"
                  markerEnd={`url(#emp-flow-${uid})`}
                />
              ))}
              {it.bajantes.map((p, i) => {
                const q = to(p);
                return (
                  <g key={i}>
                    <circle cx={q.x} cy={q.y} r={selected ? 5.2 : 4.2} fill="#c5d4c0" stroke={ink} strokeWidth="1.3" />
                    <circle cx={q.x} cy={q.y} r="1.5" fill={ink} />
                  </g>
                );
              })}
            </g>
          );
        })}

        {callouts.map((c) => (
          <g key={`lb-${c.id}`}>
            <line
              x1={c.anchor.x}
              y1={c.anchor.y}
              x2={c.x + c.w / 2}
              y2={c.y + c.h / 2}
              stroke={ink}
              strokeOpacity="0.35"
              strokeWidth="0.7"
            />
            <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="#fffdf8" stroke={ink} strokeWidth="0.8" rx="1.5" />
            {c.lines.map((line, i) => (
              <text
                key={line}
                x={c.x + c.w / 2}
                y={c.y + 13 + i * 12}
                textAnchor="middle"
                fill={i === 0 ? ink : brass}
                fontSize={i === 0 ? 10.5 : 8.5}
                fontFamily="IBM Plex Sans"
                fontWeight={i === 0 ? 700 : 500}
              >
                {line}
              </text>
            ))}
          </g>
        ))}

        <g transform={`translate(${VW - 40} 44)`}>
          <polygon points="0,-14 4.5,0 -4.5,0" fill={ink} />
          <line x1="0" y1="0" x2="0" y2="16" stroke={ink} strokeWidth="1.5" />
          <text x="0" y="28" textAnchor="middle" fill={ink} fontSize="10" fontFamily="IBM Plex Sans" fontWeight="700">
            N
          </text>
        </g>

        <line x1={scaleFrom.x} y1={scaleFrom.y} x2={scaleTo.x} y2={scaleTo.y} stroke={brass} strokeWidth="2" />
        <line x1={scaleFrom.x} y1={scaleFrom.y - 4} x2={scaleFrom.x} y2={scaleFrom.y + 4} stroke={brass} />
        <line x1={scaleTo.x} y1={scaleTo.y - 4} x2={scaleTo.x} y2={scaleTo.y + 4} stroke={brass} />
        <text
          x={(scaleFrom.x + scaleTo.x) / 2}
          y={scaleFrom.y + 12}
          textAnchor="middle"
          fill={brass}
          fontSize="9"
          fontFamily="IBM Plex Sans"
        >
          {scaleM} m
        </text>

        {!compact ? (
          <g fontFamily="IBM Plex Sans" fontSize="9" fill={ink}>
            <rect x="12" y={VH - 58} width="10" height="8" fill="#f0e8d6" stroke={ink} />
            <text x="26" y={VH - 51}>Cubierta N1</text>
            <rect x="108" y={VH - 58} width="10" height="8" fill="#efe0c4" stroke={ink} />
            <rect x="108" y={VH - 58} width="10" height="8" fill={`url(#emp-hatch-${uid})`} />
            <text x="122" y={VH - 51}>Cubierta N2</text>
            <rect x="210" y={VH - 58} width="10" height="8" fill="#d8d3c6" stroke={ink} />
            <text x="224" y={VH - 51}>Piso / patio</text>
            <line x1="300" y1={VH - 54} x2="320" y2={VH - 54} stroke={ink} strokeWidth="3.6" />
            <text x="326" y={VH - 51}>Canaleta</text>
            <line x1="392" y1={VH - 54} x2="410" y2={VH - 54} stroke="#5a4030" strokeDasharray="4 2" />
            <text x="414" y={VH - 51}>Cumbrera</text>
            <circle cx="490" cy={VH - 54} r="3.6" fill="#c5d4c0" stroke={ink} />
            <text x="498" y={VH - 51}>Bajante</text>
            <text x="12" y={VH - 32} fill="#5c5346" fontSize="8.5">
              Norte hacia el eje 1. El trazo grueso es la canaleta; las flechas finas, la pendiente del techo; el círculo, la bajante.
            </text>
          </g>
        ) : null}

        {sel && compact ? (
          <text x="14" y={VH - 16} fill="#5c5346" fontSize="9" fontFamily="IBM Plex Sans">
            {sel.el.codigo}
            {sel.ejes ? ` · ejes ${sel.ejes}` : ""} · L₂ = {sel.el.L2.toFixed(2)} m · A₁ = {sel.el.A1.toFixed(1)} m²
          </text>
        ) : null}
      </svg>
    </div>
  );
}
