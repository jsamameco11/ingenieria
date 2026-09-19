import { useId, useMemo } from "react";
import {
  MATERIAL_META,
  centroid,
  polyArea,
  type MetradoLayout,
  type MetradoMaterial,
  type Pt,
} from "../lib/metradoZonas";

const VW = 760;
const VH = 520;
const PAD = 56;

function toSvg(layout: MetradoLayout) {
  const pts: Pt[] = [];
  for (const z of layout.zones) pts.push(...z.pts);
  for (const a of layout.arrows ?? []) pts.push(a.from, a.to);
  for (const d of layout.dims ?? []) pts.push([d.x1, d.y1], [d.x2, d.y2]);
  if (!pts.length) pts.push([0, 0], [4, 3]);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const spanX = Math.max(maxX - minX, 0.8);
  const spanY = Math.max(maxY - minY, 0.8);
  const innerW = VW - PAD * 2 - 150;
  const innerH = VH - PAD * 2;
  const s = Math.min(innerW / spanX, innerH / spanY);
  const ox = PAD + (innerW - spanX * s) / 2 - minX * s;
  const oy = PAD + (innerH - spanY * s) / 2 + maxY * s;
  const xy = (p: Pt): Pt => [ox + p[0] * s, oy - p[1] * s];
  const bboxArea = spanX * spanY;
  return { xy, s, minX, minY, maxX, maxY, bboxArea };
}

function pointsAttr(pts: Pt[], xy: (p: Pt) => Pt) {
  return pts.map((p) => xy(p).join(",")).join(" ");
}

/** Spline Catmull–Rom cerrada → cúbicas SVG (casquetes y agua sin facetas). */
function smoothClosedD(pts: Pt[], xy: (p: Pt) => Pt) {
  const p = pts.map(xy);
  const n = p.length;
  if (n < 3) return "";
  const at = (i: number) => p[(i + n) % n];
  let d = `M ${at(0)[0].toFixed(2)} ${at(0)[1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return `${d} Z`;
}

function Hatch({ id, kind }: { id: string; kind: MetradoMaterial }) {
  if (kind === "concreto") {
    return (
      <pattern id={id} width="9" height="9" patternUnits="userSpaceOnUse">
        <rect width="9" height="9" fill="#d9d2c3" />
        <path d="M0 9 L9 0" stroke="#8a8174" strokeWidth="0.55" />
        <circle cx="2.2" cy="3.4" r="0.7" fill="#6b6458" />
        <circle cx="6.4" cy="6.6" r="0.55" fill="#6b6458" />
      </pattern>
    );
  }
  if (kind === "tierra") {
    return (
      <pattern id={id} width="11" height="11" patternUnits="userSpaceOnUse">
        <rect width="11" height="11" fill="#cbb892" />
        <path d="M0 11 Q5.5 5 11 11" fill="none" stroke="#8a7344" strokeWidth="0.75" />
        <circle cx="3" cy="4" r="0.55" fill="#7a6238" />
        <circle cx="8" cy="7" r="0.45" fill="#7a6238" />
      </pattern>
    );
  }
  if (kind === "agua") {
    return (
      <pattern id={id} width="14" height="10" patternUnits="userSpaceOnUse">
        <rect width="14" height="10" fill="#c5dcea" />
        <path d="M0 5 Q3.5 2 7 5 T14 5" fill="none" stroke="#4a7a96" strokeWidth="0.95" />
      </pattern>
    );
  }
  return (
    <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="#f4e6d4" />
      <line x1="0" y1="0" x2="0" y2="8" stroke="#c4a882" strokeWidth="1" />
    </pattern>
  );
}

function Badge({
  x,
  y,
  n,
  fill = "#1a4473",
}: {
  x: number;
  y: number;
  n: number | string;
  fill?: string;
}) {
  const text = String(n);
  const wide = text.length > 1;
  return (
    <g className="mz-badge">
      <circle cx={x} cy={y} r={wide ? 12 : 11} fill="#ffffff" stroke={fill} strokeWidth="2" />
      <text
        x={x}
        y={y + 4.2}
        textAnchor="middle"
        fontSize={wide ? 10 : 12}
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, Segoe UI, sans-serif"
        fill={fill}
      >
        {text}
      </text>
    </g>
  );
}

function DimLine({
  a,
  b,
  label,
}: {
  a: Pt;
  b: Pt;
  label: string;
}) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const off = 16;
  const x1 = a[0] + nx * off;
  const y1 = a[1] + ny * off;
  const x2 = b[0] + nx * off;
  const y2 = b[1] + ny * off;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g className="mz-dim">
      <line x1={a[0]} y1={a[1]} x2={x1} y2={y1} stroke="#1a4473" strokeWidth="0.6" />
      <line x1={b[0]} y1={b[1]} x2={x2} y2={y2} stroke="#1a4473" strokeWidth="0.6" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1a4473" strokeWidth="1" />
      <text
        x={mx + nx * 8}
        y={my + ny * 8 + 3}
        textAnchor="middle"
        fontSize="10"
        fill="#1a4473"
        fontFamily="ui-sans-serif, system-ui, Segoe UI, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}

export function MetradoZonasFig({ spec }: { spec: MetradoLayout }) {
  const uid = useId().replace(/:/g, "");
  const map = useMemo(() => toSvg(spec), [spec]);
  const { xy, bboxArea, minY, maxY } = map;
  const used = new Set<MetradoMaterial>();
  for (const z of spec.zones) used.add(z.material);

  const groundY = xy([0, Math.min(0, minY)])[1];
  const groundX1 = 28;
  const groundX2 = VW - 168;

  return (
    <div className="croquis mz-fig" data-fig-part={spec.id}>
      <div className="croquis-head">
        <p>{spec.title}</p>
      </div>
      <div className="croquis-stage mz-stage">
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            {([...used] as MetradoMaterial[]).map((k) => (
              <Hatch key={k} id={`${uid}-${k}`} kind={k} />
            ))}
            <marker id={`${uid}-arr`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="#8b1e1e" />
            </marker>
          </defs>
          <rect x="0" y="0" width={VW} height={VH} fill="#fbf8f1" />
          {spec.origin.toLowerCase().includes("eje") ? (
            <line
              x1={xy([0, minY])[0]}
              y1={xy([0, minY])[1]}
              x2={xy([0, maxY])[0]}
              y2={xy([0, maxY])[1]}
              stroke="#8a8a8a"
              strokeWidth="1"
              strokeDasharray="5 4"
            />
          ) : null}
          <line x1={groundX1} y1={groundY} x2={groundX2} y2={groundY} stroke="#8a7a55" strokeWidth="2.2" />
          {Array.from({ length: 14 }, (_, i) => {
            const x = groundX1 + i * ((groundX2 - groundX1) / 13);
            return <line key={i} x1={x} y1={groundY} x2={x - 7} y2={groundY + 8} stroke="#8a7a55" strokeWidth="1.1" />;
          })}
          <text x={groundX1} y={groundY + 20} fontSize="9" fill="#6e5a32" fontFamily="ui-sans-serif, system-ui, sans-serif">
            {spec.origin}
          </text>

          {spec.zones.map((z) => {
            if (z.pts.length < 3) return null;
            const meta = MATERIAL_META[z.material];
            const curved = Boolean(z.smooth);
            const common = {
              fill: `url(#${uid}-${z.material})`,
              stroke: meta.stroke,
              strokeWidth: z.material === "concreto" ? 1.7 : 1.2,
              strokeLinejoin: (z.smooth ? "round" : "miter") as "round" | "miter",
              strokeLinecap: "butt" as const,
              opacity: 0.95,
            };
            return curved ? (
              <path key={`z-${z.n}`} d={smoothClosedD(z.pts, xy)} {...common} />
            ) : (
              <polygon key={`z-${z.n}`} points={pointsAttr(z.pts, xy)} {...common} />
            );
          })}

          {spec.arrows?.map((a, i) => {
            const [x1, y1] = xy(a.from);
            const [x2, y2] = xy(a.to);
            return (
              <g key={`a-${i}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#8b1e1e"
                  strokeWidth="1.8"
                  markerEnd={`url(#${uid}-arr)`}
                />
                <text
                  x={(x1 + x2) / 2 + 10}
                  y={(y1 + y2) / 2}
                  fontSize="10"
                  fill="#8b1e1e"
                  fontWeight="700"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {a.label}
                </text>
              </g>
            );
          })}

          {spec.dims?.map((d, i) => (
            <DimLine key={`d-${i}`} a={xy([d.x1, d.y1])} b={xy([d.x2, d.y2])} label={d.label} />
          ))}

          {spec.zones.map((z, zi) => {
            const c = z.badge ?? (z.pts.length ? centroid(z.pts) : [0, 0]);
            const area = z.pts.length ? polyArea(z.pts) : 0;
            const small = area > 0 && area < bboxArea * 0.022;
            const [cx, cy] = xy(c);
            let bx = cx;
            let by = cy;
            let leader: Pt | null = null;
            if (small) {
              const ang = -0.55 - zi * 0.72;
              bx = cx + Math.cos(ang) * 28;
              by = cy + Math.sin(ang) * 24;
              leader = [cx, cy];
            }
            const color = MATERIAL_META[z.material].stroke;
            return (
              <g key={`b-${zi}-${z.n}`}>
                {leader ? (
                  <line x1={leader[0]} y1={leader[1]} x2={bx} y2={by} stroke={color} strokeWidth="1" />
                ) : null}
                <Badge x={bx} y={by} n={z.n} fill={color} />
              </g>
            );
          })}

          {spec.arrows?.map((a, i) => {
            if (a.n == null) return null;
            const [x, y] = xy(a.from);
            return <Badge key={`ab-${i}`} x={x} y={y - 14} n={a.n} fill="#8b1e1e" />;
          })}
        </svg>
        <ol className="mz-legend">
          {spec.zones.filter((z, i, arr) => arr.findIndex((x) => x.n === z.n && x.label === z.label) === i).map((z, i) => (
            <li key={`L-${i}-${z.n}`}>
              <span className={`mz-swatch mz-${z.material}`}>{z.n}</span>
              <span>
                <strong>{z.label}</strong>
                <em>{MATERIAL_META[z.material].label}</em>
              </span>
            </li>
          ))}
          {spec.arrows
            ?.filter((a) => a.n != null)
            .map((a) => (
              <li key={`La-${a.n}`}>
                <span className="mz-swatch mz-carga">{a.n}</span>
                <span>
                  <strong>{a.label}</strong>
                  <em>Componente vertical</em>
                </span>
              </li>
            ))}
        </ol>
      </div>
      <p className="croquis-cap">{spec.caption}</p>
    </div>
  );
}
