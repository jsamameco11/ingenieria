import { useId } from "react";
import { centroid, type LeaderSide, type SteelDraftSpec, type SteelLayer } from "../lib/steelDraft";

function filletedD(pts: { x: number; y: number }[], radius: number) {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  const r = Math.max(4, radius);
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const d1 = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const d2 = Math.hypot(c.x - b.x, c.y - b.y) || 1;
    const t = Math.min(r, d1 * 0.46, d2 * 0.46);
    const p1 = { x: b.x - ((b.x - a.x) / d1) * t, y: b.y - ((b.y - a.y) / d1) * t };
    const p2 = { x: b.x + ((c.x - b.x) / d2) * t, y: b.y + ((c.y - b.y) / d2) * t };
    d += ` L ${p1.x} ${p1.y} Q ${b.x} ${b.y} ${p2.x} ${p2.y}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function dimTicks(x1: number, y1: number, x2: number, y2: number, side: LeaderSide, label: string, a1 = false) {
  const vert = Math.abs(x2 - x1) < 0.8;
  const t = a1 ? 9 : 7;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const lx = vert ? x1 + (side === "left" ? -22 : 22) : mx;
  const ly = vert ? my + 5 : y1 + (side === "top" ? (a1 ? -16 : -13) : a1 ? 22 : 18);
  const fs = a1 ? 12.5 : 10.5;
  const plateW = Math.max(a1 ? 64 : 52, label.length * (a1 ? 7.4 : 6.6));
  const sw = a1 ? 1.35 : 1.15;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#163a63" strokeWidth={sw} />
      <line x1={x1 - (vert ? t : 0)} y1={y1 - (vert ? 0 : t)} x2={x1 + (vert ? t : 0)} y2={y1 + (vert ? 0 : t)} stroke="#163a63" strokeWidth={sw} />
      <line x1={x2 - (vert ? t : 0)} y1={y2 - (vert ? 0 : t)} x2={x2 + (vert ? t : 0)} y2={y2 + (vert ? 0 : t)} stroke="#163a63" strokeWidth={sw} />
      <rect x={lx - plateW / 2} y={ly - (a1 ? 13 : 11)} width={plateW} height={a1 ? 18 : 15} rx="2" fill="#f7f3ea" />
      <text x={lx} y={ly} textAnchor="middle" fontSize={fs} fill="#163a63" fontFamily="IBM Plex Mono, ui-monospace, monospace">
        {label}
      </text>
    </g>
  );
}

function attachOf(layer: SteelLayer) {
  if (layer.attach) return layer.attach;
  if (layer.barPath?.length) return centroid(layer.barPath);
  return centroid(layer.bars);
}

function calloutOf(layer: SteelLayer, index: number, W: number, H: number) {
  if (layer.callout) return layer.callout;
  if (layer.side === "right") return { x: W - 16, y: 56 + index * 78, anchor: "end" as const };
  if (layer.side === "left") return { x: 16, y: 56 + index * 78, anchor: "start" as const };
  if (layer.side === "top") return { x: attachOf(layer).x, y: 28, anchor: "middle" as const };
  return { x: attachOf(layer).x, y: H - 28, anchor: "middle" as const };
}

function leaderD(from: { x: number; y: number }, box: { x: number; y: number; anchor: "start" | "middle" | "end" }) {
  const gap = box.anchor === "end" ? -16 : box.anchor === "start" ? 16 : 0;
  const xEnd = box.x + gap;
  const yEnd = box.y;
  if (box.anchor === "middle") {
    const yJoin = yEnd < from.y ? yEnd + 14 : yEnd - 14;
    return `M ${from.x} ${from.y} L ${from.x} ${yJoin}`;
  }
  const dx = xEnd - from.x;
  const dy = yEnd - from.y;
  if (Math.hypot(dx, dy) < 36) return `M ${from.x} ${from.y} L ${xEnd} ${yEnd}`;
  const elbow = Math.min(32, Math.max(10, Math.abs(dx) * 0.28));
  const elbowX = dx < 0 ? from.x - elbow : from.x + elbow;
  if (Math.abs(dy) < 10) return `M ${from.x} ${from.y} L ${xEnd} ${from.y}`;
  return `M ${from.x} ${from.y} L ${elbowX} ${from.y} L ${elbowX} ${yEnd} L ${xEnd} ${yEnd}`;
}

function polyD(pts: { x: number; y: number }[], width: number) {
  if (pts.length > 4) return `M ${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")}`;
  return filletedD(pts, Math.max(5, width * 1.8));
}

function endTick(p: { x: number; y: number }, q: { x: number; y: number }, len: number) {
  const L = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  const nx = (-(q.y - p.y) / L) * len;
  const ny = ((q.x - p.x) / L) * len;
  return { x1: p.x - nx, y1: p.y - ny, x2: p.x + nx, y2: p.y + ny };
}

function BarCut({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <g>
      <circle cx={x + 0.35} cy={y + 0.45} r={r + 0.45} fill="#1a0c0c" opacity="0.18" />
      <circle cx={x} cy={y} r={r} fill={color} stroke="#120808" strokeWidth="0.7" />
      <circle cx={x} cy={y} r={r * 0.52} fill="#2a1010" />
      <circle cx={x - r * 0.22} cy={y - r * 0.28} r={Math.max(0.55, r * 0.22)} fill="#f4ead8" opacity="0.85" />
    </g>
  );
}

function RebarLine({ pts, color, width }: { pts: { x: number; y: number }[]; color: string; width: number }) {
  if (pts.length < 2) return null;
  const d = polyD(pts, width);
  const cap = Math.max(1.1, width * 0.42);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const t0 = endTick(first, pts[1], Math.max(1.6, width * 0.7));
  const t1 = endTick(last, pts[pts.length - 2], Math.max(1.6, width * 0.7));
  return (
    <g>
      <path d={d} fill="none" stroke="#120808" strokeWidth={width + 1.05} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#f6e6d0" strokeWidth={Math.max(0.5, width * 0.22)} strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
      <line {...t0} stroke="#120808" strokeWidth="0.7" />
      <line {...t1} stroke="#120808" strokeWidth="0.7" />
      <circle cx={first.x} cy={first.y} r={cap} fill={color} stroke="#120808" strokeWidth="0.55" />
      <circle cx={last.x} cy={last.y} r={cap} fill={color} stroke="#120808" strokeWidth="0.55" />
    </g>
  );
}

function LayerCallout({
  layer,
  from,
  box,
  a1 = false,
}: {
  layer: SteelLayer;
  from: { x: number; y: number };
  box: { x: number; y: number; anchor: "start" | "middle" | "end" };
  a1?: boolean;
}) {
  const extra = a1 && (layer.asReq != null || layer.ldCm != null || layer.recCm != null);
  const plateW = Math.min(a1 ? 220 : 168, Math.max(a1 ? 188 : 118, layer.name.length * (a1 ? 8.2 : 7.2) + (a1 ? 62 : 44)));
  const plateH = extra ? 82 : a1 ? 58 : 34;
  const plateX = box.anchor === "end" ? box.x - plateW : box.anchor === "start" ? box.x : box.x - plateW / 2;
  const badgeR = a1 ? 15 : 9.2;
  const badge = box.anchor === "end" ? box.x - 14 : box.anchor === "start" ? box.x + 14 : plateX + 16;
  const tx = box.anchor === "end" ? box.x - 34 : box.anchor === "start" ? box.x + 34 : plateX + 34;
  const textAnchor = box.anchor === "middle" ? "start" : box.anchor;
  const nameY = box.y - (extra ? 28 : a1 ? 12 : 6);
  const asLine =
    layer.asReq != null
      ? `As req ${layer.asReq.toFixed(2)}  ·  As disp ${layer.asProv.toFixed(2)} ${layer.asUnit}`
      : `As disp ${layer.asProv.toFixed(2)} ${layer.asUnit}`;
  const ldLine = [
    layer.ldCm != null ? `ℓd ${layer.ldCm.toFixed(0)} cm` : null,
    layer.recCm != null ? `rec ${layer.recCm.toFixed(1)} cm` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <g>
      <path d={leaderD(from, box)} fill="none" stroke={layer.color} strokeWidth={a1 ? 1.45 : 1.15} />
      <rect x={plateX} y={box.y - plateH / 2} width={plateW} height={plateH} rx="3" fill="#fffcf6" stroke={layer.color} strokeWidth="1.35" />
      <circle cx={badge} cy={box.y} r={badgeR} fill="#fff" stroke={layer.color} strokeWidth="2" />
      <text x={badge} y={box.y + 5} textAnchor="middle" fontSize={a1 ? 14.5 : 10.5} fontWeight="700" fill={layer.color} fontFamily="IBM Plex Sans, sans-serif">
        {layer.mark}
      </text>
      <text x={tx} y={nameY} textAnchor={textAnchor} fontSize={a1 ? 14.5 : 11} fill={layer.color} fontFamily="IBM Plex Sans, sans-serif" fontWeight="700">
        {layer.name}
      </text>
      <text x={tx} y={nameY + (a1 ? 22 : 13)} textAnchor={textAnchor} fontSize={a1 ? 19 : 10.5} fontWeight={a1 ? 700 : 500} fill={layer.color} fontFamily="IBM Plex Mono, ui-monospace, monospace">
        Ø {layer.bar} @ {layer.sCm.toFixed(0)} cm
      </text>
      {extra ? (
        <>
          <text x={tx} y={nameY + 42} textAnchor={textAnchor} fontSize={11.5} fill="#5a4a28" fontFamily="IBM Plex Mono, ui-monospace, monospace">
            {asLine}
          </text>
          {ldLine ? (
            <text x={tx} y={nameY + 58} textAnchor={textAnchor} fontSize={11.5} fill="#5a4a28" fontFamily="IBM Plex Mono, ui-monospace, monospace">
              {ldLine}
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

function ScaleBar({ x, y, pxPerM, a1 = false }: { x: number; y: number; pxPerM: number; a1?: boolean }) {
  const m = pxPerM >= 140 ? 1 : pxPerM >= 90 ? 1 : 0.5;
  const w = m * pxPerM;
  const half = w / 2;
  const fs = a1 ? 10.5 : 8.5;
  return (
    <g>
      <text x={x} y={y - 8} fontSize={fs} fill="#5a4a28" fontFamily="IBM Plex Sans, sans-serif">
        Escala gráfica
      </text>
      <line x1={x} y1={y} x2={x + w} y2={y} stroke="#163a63" strokeWidth="1.45" />
      <line x1={x} y1={y - 6} x2={x} y2={y + 6} stroke="#163a63" strokeWidth="1.45" />
      <line x1={x + half} y1={y - 4} x2={x + half} y2={y + 4} stroke="#163a63" strokeWidth="1.15" />
      <line x1={x + w} y1={y - 6} x2={x + w} y2={y + 6} stroke="#163a63" strokeWidth="1.45" />
      <rect x={x} y={y} width={half} height="5" fill="#163a63" />
      <text x={x} y={y + 18} fontSize={fs} fill="#163a63" fontFamily="IBM Plex Mono, ui-monospace, monospace" textAnchor="middle">
        0
      </text>
      <text x={x + w} y={y + 18} fontSize={fs} fill="#163a63" fontFamily="IBM Plex Mono, ui-monospace, monospace" textAnchor="middle">
        {m.toFixed(1)} m
      </text>
    </g>
  );
}

export function SteelSectionFig({ spec }: { spec: SteelDraftSpec }) {
  const uid = useId().replace(/:/g, "");
  const hatch = `steel-hatch-${uid}`;
  const soil = `steel-soil-${uid}`;
  const conc = `steel-conc-${uid}`;
  const shadow = `steel-sh-${uid}`;
  const clipWall = `steel-clip-${uid}`;
  const a1 = spec.sheet === "a1";
  const plan = spec.mode === "plan";
  const scale = spec.barScale ?? 1;
  const leftLayers = spec.layers.filter((l) => l.side === "left");
  const rightLayers = spec.layers.filter((l) => l.side === "right");
  const gy = spec.groundY ?? spec.H - 28;
  const longLayers = spec.layers.filter((l) => Boolean(l.barPaths?.length || (l.draw === "bar" && l.barPath?.length)));
  const cutLayers = spec.layers.filter((l) => !l.barPaths?.length && !(l.draw === "bar" && l.barPath?.length));
  return (
    <div className={`croquis croquis-steel${a1 ? " croquis-a1" : ""}`} data-fig-part="momento">
      <div className="croquis-head">
        <p>{spec.title}</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={`0 0 ${spec.W} ${spec.H}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id={conc} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f3ead4" />
              <stop offset="1" stopColor="#d4c7ab" />
            </linearGradient>
            <pattern id={hatch} width={a1 ? 8 : 7} height={a1 ? 8 : 7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#b7a57a" strokeWidth="0.7" />
            </pattern>
            <pattern id={soil} width="11" height="11" patternUnits="userSpaceOnUse">
              <path d="M0 9 H11 M1.5 4 H9.5" stroke="#a89268" strokeWidth="0.85" fill="none" />
            </pattern>
            <filter id={shadow} x="-4%" y="-3%" width="108%" height="110%">
              <feDropShadow dx="0.8" dy="2.2" stdDeviation="1.8" floodColor="#3a2a12" floodOpacity="0.2" />
            </filter>
            <clipPath id={clipWall}>
              {spec.regions?.length
                ? spec.regions.filter((r) => r.hatch !== false && r.fill !== "#f4efe4").map((r, i) => <polygon key={i} points={r.points} />)
                : <polygon points={spec.outline} />}
            </clipPath>
          </defs>
          <rect x="0" y="0" width={spec.W} height={spec.H} fill="#f4efe4" />
          <rect x="10" y="10" width={spec.W - 20} height={spec.H - 20} fill="none" stroke="#163a63" strokeWidth={a1 ? 2 : 1.4} />
          <rect x="14" y="14" width={spec.W - 28} height={spec.H - 28} fill="none" stroke="#163a63" strokeWidth="0.7" />
          {a1 ? null : (
            <text x={spec.W / 2} y="38" textAnchor="middle" fontSize={13} fill="#163a63" fontWeight="600" fontFamily="IBM Plex Sans, sans-serif">
              {spec.subtitle}
            </text>
          )}
          {plan ? null : spec.soil ? <polygon points={spec.soil} fill={`url(#${soil})`} opacity="0.78" /> : null}
          {plan ? null : spec.soilFront ? <polygon points={spec.soilFront} fill={`url(#${soil})`} opacity="0.78" /> : null}
          {plan ? null : <line x1="36" y1={gy} x2={spec.W - 36} y2={gy} stroke="#7d6c48" strokeWidth={a1 ? 3.1 : 2.6} />}
          {plan
            ? null
            : Array.from({ length: a1 ? 28 : 22 }, (_, i) => {
                const x = 44 + i * ((spec.W - 88) / (a1 ? 27 : 21));
                return <line key={i} x1={x} y1={gy} x2={x - 8} y2={gy + 9} stroke="#7d6c48" strokeWidth="1.2" />;
              })}
          {spec.regions?.length ? (
            spec.regions.map((r, i) => (
              <g key={`rg-${i}`}>
                <polygon points={r.points} fill={r.fill ?? `url(#${conc})`} stroke={r.stroke ?? "#163a63"} strokeWidth={r.dash ? 1.35 : a1 ? 2.4 : 2} strokeDasharray={r.dash} />
                {r.hatch ? <polygon points={r.points} fill={`url(#${hatch})`} opacity="0.38" /> : null}
              </g>
            ))
          ) : (
            <>
              <polygon points={spec.outline} fill={`url(#${conc})`} stroke="#163a63" strokeWidth={a1 ? 2.8 : 2.25} filter={`url(#${shadow})`} />
              <polygon points={spec.outline} fill={`url(#${hatch})`} opacity="0.42" />
            </>
          )}
          {spec.guides?.map((g, i) => (
            <line
              key={`gd-${i}`}
              x1={g.x1}
              y1={g.y1}
              x2={g.x2}
              y2={g.y2}
              stroke={g.color ?? "#1a4473"}
              strokeWidth={g.width ?? 1.1}
              strokeDasharray={g.dash}
            />
          ))}
          {spec.cover ? <polygon points={spec.cover} fill="none" stroke="#7a6240" strokeWidth={a1 ? 1.15 : 0.95} strokeDasharray="6 3" /> : null}
          {longLayers.map((layer) => {
            const paths = layer.barPaths?.length ? layer.barPaths : layer.barPath?.length ? [layer.barPath] : [];
            return (
              <g key={`rb-${layer.mark}`}>
                {paths.map((pts, i) => (
                  <RebarLine key={`${layer.mark}-${i}`} pts={pts} color={layer.color} width={barWidthOf(layer, scale, spec.pxPerM, a1)} />
                ))}
              </g>
            );
          })}
          <g clipPath={`url(#${clipWall})`}>
          {cutLayers.map((layer) => (
            <g key={`ct-${layer.mark}`}>
              {layer.bars.map((p, i) => (
                <BarCut key={`${layer.mark}-${i}`} x={p.x} y={p.y} r={barRadiusOf(layer, scale, spec.pxPerM, a1)} color={layer.color} />
              ))}
            </g>
          ))}
          </g>
          {spec.dims.map((d, i) => (
            <g key={`d-${i}`}>{dimTicks(d.x1, d.y1, d.x2, d.y2, d.side, d.label, a1)}</g>
          ))}
          {spec.hideCallouts
            ? null
            : spec.layers.map((layer) => {
            const slot =
              layer.side === "right" ? rightLayers.indexOf(layer) : layer.side === "left" ? leftLayers.indexOf(layer) : spec.layers.indexOf(layer);
            const box = calloutOf(layer, slot, spec.W, spec.H);
            return <LayerCallout key={`ld-${layer.mark}`} layer={layer} from={attachOf(layer)} box={box} a1={a1} />;
          })}
          {(spec.annos ?? []).map((a, i) => (
            <text
              key={`an-${i}`}
              x={a.x}
              y={a.y}
              textAnchor={a.anchor ?? "middle"}
              fontSize={a1 ? 13 : 10.5}
              fontWeight="700"
              fill={a.fill ?? "#163a63"}
              stroke="#f4efe4"
              strokeWidth="4"
              paintOrder="stroke"
              fontFamily="IBM Plex Sans, sans-serif"
            >
              {a.text}
            </text>
          ))}
          {spec.pxPerM ? (
            <ScaleBar
              x={a1 ? spec.W / 2 - (spec.pxPerM >= 90 ? spec.pxPerM / 2 : spec.pxPerM * 0.25) : 28}
              y={a1 ? spec.H - 80 : spec.H - 42}
              pxPerM={spec.pxPerM}
              a1={a1}
            />
          ) : null}
          {a1 ? (
            <g>
              <rect x={spec.W / 2 - 120} y={spec.H - 44} width="240" height="30" fill="#fffcf6" stroke="#163a63" strokeWidth="1.1" />
              <text x={spec.W / 2 - 108} y={spec.H - 31} fontSize="10" fill="#5a4a28" fontFamily="IBM Plex Sans, sans-serif">
                {plan ? "PLANTA · HOJA A1" : "CORTE A-A · HOJA A1"}
              </text>
              <text x={spec.W / 2 - 108} y={spec.H - 17} fontSize="11" fill="#163a63" fontFamily="IBM Plex Sans, sans-serif" fontWeight="700">
                {plan ? "Despiece · aceros por paño" : "Despiece de aceros · 1,00 m"}
              </text>
            </g>
          ) : (
            <text x="16" y={spec.H - 14} fontSize="9" fill="#5a4a28" fontFamily="IBM Plex Sans, sans-serif">
              Flexión en el plano · temperatura en corte · dentellón solo si desliza
            </text>
          )}
        </svg>
      </div>
      <table className="steel-schedule">
        <thead>
          <tr>
            <th>Marca</th>
            <th>Lecho</th>
            <th>Cara</th>
            <th>Ø</th>
            <th>db</th>
            <th>@</th>
            <th>n / ml</th>
            <th>As req</th>
            <th>As disp</th>
            <th>ℓd</th>
            <th>rec</th>
          </tr>
        </thead>
        <tbody>
          {spec.layers.map((l) => (
            <tr key={l.mark}>
              <td>{l.mark}</td>
              <td>{l.name}</td>
              <td>{l.face}</td>
              <td>Ø {l.bar}</td>
              <td>{l.dbCm.toFixed(2)} cm</td>
              <td>{l.sCm.toFixed(0)} cm</td>
              <td>{l.nReal}</td>
              <td>{l.asReq != null ? `${l.asReq.toFixed(2)} ${l.asUnit}` : "—"}</td>
              <td>
                {l.asProv.toFixed(2)} {l.asUnit}
              </td>
              <td>{l.ldCm != null ? `${l.ldCm.toFixed(0)} cm` : "—"}</td>
              <td>{l.recCm != null ? `${l.recCm.toFixed(1)} cm` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="croquis-cap">{spec.caption}</p>
    </div>
  );
}

function barRadiusOf(layer: SteelLayer, _scale: number, pxPerM?: number, a1 = false) {
  const dbM = layer.dbCm / 100;
  const lo = a1 ? 2.6 : 2.0;
  const hi = a1 ? 6.2 : 4.0;
  if (pxPerM) return Math.max(lo, Math.min(hi, dbM * pxPerM * (a1 ? 1.85 : 1.25)));
  return Math.max(lo, Math.min(hi, layer.dbCm * (a1 ? 1.35 : 1.05)));
}

function barWidthOf(layer: SteelLayer, _scale: number, pxPerM?: number, a1 = false) {
  const dbM = layer.dbCm / 100;
  const lo = a1 ? 3.4 : 2.2;
  const hi = a1 ? 9.2 : 5.0;
  if (pxPerM) return Math.max(lo, Math.min(hi, dbM * pxPerM * (a1 ? 2.35 : 1.45)));
  return Math.max(lo, Math.min(hi, layer.dbCm * (a1 ? 1.55 : 1.2)));
}

