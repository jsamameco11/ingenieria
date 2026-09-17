/** Carga distribuida de expediente: envolvente + flechas hacia la cara cargada. */

export type DistToward = "left" | "right" | "up" | "down";

export type DistLoadSpec = {
  id: string;
  x0: number;
  y0: number;
  x1?: number;
  y1: number;
  /** Cara inclinada: x en y1. Si falta, la cara es vertical en x0. */
  xFace1?: number;
  w0: number;
  w1: number;
  toward: DistToward;
  color: string;
  arrows?: number;
  label?: string;
  sublabel?: string;
  fillOpacity?: number;
  /** 0–1 a lo largo del tramo; ancla la etiqueta (p. ej. H/3). */
  labelT?: number;
  /** Separación extra de la etiqueta respecto a la envolvente. */
  labelGap?: number;
  /** Desplaza la carga perpendicular a la cara (columnas al costado, sin superponer). */
  offset?: number;
  strokeDasharray?: string;
  strokeWidth?: number;
};

function intensity(w0: number, w1: number, t: number) {
  return w0 + (w1 - w0) * t;
}

function autoArrows(span: number, requested?: number) {
  if (requested != null) return Math.max(3, Math.round(requested));
  return Math.max(5, Math.min(18, Math.round(span / 12)));
}

export function CargaDistribuida({
  id,
  x0,
  y0,
  x1,
  y1,
  xFace1,
  w0,
  w1,
  toward,
  color,
  arrows,
  label,
  sublabel,
  fillOpacity = 0.13,
  labelT,
  labelGap = 8,
  offset = 0,
  strokeDasharray,
  strokeWidth = 1.15,
}: DistLoadSpec) {
  const horiz = toward === "left" || toward === "right";
  const span = horiz ? Math.abs(y1 - y0) : Math.abs((x1 ?? x0) - x0);
  const n = autoArrows(span, arrows);
  const marker = `cdl-${id}`;
  const faceX = (t: number) => {
    const x = x0 + ((xFace1 ?? x0) - x0) * t;
    if (!horiz) return x;
    return x + (toward === "left" ? offset : -offset);
  };
  const pts: { xA: number; yA: number; xB: number; yB: number; w: number }[] = [];

  if (horiz) {
    const dir = toward === "left" ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 1 : i / (n - 1);
      const w = intensity(w0, w1, t);
      if (w < 6) continue;
      const y = y0 + (y1 - y0) * t;
      const xf = faceX(t);
      pts.push({ xA: xf + dir * w, yA: y, xB: xf, yB: y, w });
    }
  } else {
    const xa = x0;
    const xb = x1 ?? x0;
    const dir = toward === "up" ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 1 : i / (n - 1);
      const w = intensity(w0, w1, t);
      if (w < 6) continue;
      const x = xa + (xb - xa) * t;
      pts.push({ xA: x, yA: y0 + dir * w, xB: x, yB: y0, w });
    }
  }

  const xf0 = faceX(0);
  const xf1 = faceX(1);
  const env = horiz
    ? `${xf0},${y0} ${xf0 + (toward === "left" ? w0 : -w0)},${y0} ${xf1 + (toward === "left" ? w1 : -w1)},${y1} ${xf1},${y1}`
    : `${x0},${y0} ${x1 ?? x0},${y0} ${x1 ?? x0},${y0 + (toward === "up" ? w1 : -w1)} ${x0},${y0 + (toward === "up" ? w0 : -w0)}`;

  const tL = labelT ?? (w1 >= w0 ? 0.78 : 0.22);
  const wL = Math.max(intensity(w0, w1, tL), Math.max(w0, w1) * 0.35);
  let lx: number;
  let ly: number;
  let anchor: "start" | "end" | "middle" = "start";
  if (horiz) {
    const xf = faceX(tL);
    const dir = toward === "left" ? 1 : -1;
    lx = xf + dir * (wL + labelGap);
    ly = y0 + (y1 - y0) * tL;
    anchor = toward === "right" ? "end" : "start";
  } else {
    const xa = x0;
    const xb = x1 ?? x0;
    lx = xa + (xb - xa) * tL + 8;
    ly = y0 + (toward === "up" ? wL + 12 : -wL - 6);
    anchor = "start";
  }

  return (
    <g className="cdl-load" pointerEvents="none">
      <defs>
        <marker id={marker} markerWidth="6.5" markerHeight="6.5" refX="5.8" refY="3.25" orient="auto">
          <path d="M0,0 L6.5,3.25 L0,6.5 Z" fill={color} />
        </marker>
      </defs>
      <polygon
        points={env}
        fill={color}
        opacity={fillOpacity}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeLinejoin="round"
      />
      {pts.map((p, i) => (
        <line
          key={i}
          x1={p.xA}
          y1={p.yA}
          x2={p.xB}
          y2={p.yB}
          stroke={color}
          strokeWidth={p.w > 28 ? 1.25 : 1.05}
          strokeLinecap="butt"
          markerEnd={`url(#${marker})`}
        />
      ))}
      {label ? (
        <text
          x={lx}
          y={ly}
          textAnchor={anchor}
          fontSize="10"
          fontWeight="700"
          fill={color}
          fontFamily="IBM Plex Sans, sans-serif"
        >
          {label}
        </text>
      ) : null}
      {sublabel ? (
        <text
          x={lx}
          y={ly + 12}
          textAnchor={anchor}
          fontSize="8"
          fill={color}
          fontFamily="IBM Plex Sans, sans-serif"
        >
          {sublabel}
        </text>
      ) : null}
    </g>
  );
}
