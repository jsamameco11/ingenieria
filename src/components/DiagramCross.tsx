import type { ReactNode } from "react";
import { solveCross, type CrossSpan } from "../lib/crossMethod";

const NAVY = "#1a4473";
const INK = "#4a4030";
const NEG = "#8b1e1e";
const POS = "#1d5aa6";
const FONT = "IBM Plex Sans, sans-serif";

function nv(values: Record<string, string>, key: string, fb: number) {
  const s = String(values[key] ?? "").trim();
  if (s === "") return fb;
  const x = Number(s.replace(",", "."));
  return Number.isFinite(x) ? x : fb;
}

function crossLabelL(s: number) {
  return `M${s}${s + 1}`;
}
function crossLabelR(s: number) {
  return `M${s + 1}${s}`;
}

function fmt2(v: number) {
  return (Math.round(v * 100) / 100).toFixed(2);
}

function Defs() {
  return (
    <defs>
      <pattern id="cr-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#8a7a5a" strokeWidth="1" />
      </pattern>
      <pattern id="cr-conc" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#d9d2c3" />
        <circle cx="2" cy="3" r="0.6" fill="#6b6458" />
        <circle cx="6" cy="6" r="0.5" fill="#6b6458" />
      </pattern>
    </defs>
  );
}

function Frame({ caption, viewBox, children }: { caption: string; viewBox: string; children: ReactNode }) {
  return (
    <div className="croquis croquis-compact">
      <div className="croquis-head">
        <p>Geometría</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" overflow="visible">
          <Defs />
          <rect x="0" y="0" width="100%" height="100%" fill="#fbf8f1" />
          {children}
        </svg>
      </div>
      <p className="croquis-cap">{caption}</p>
    </div>
  );
}

/** Símbolo de empotramiento (nudo extremo fijo): bloque achurado perpendicular al eje. */
function FixedSupport({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 7} y={y - 17} width={14} height={34} fill="url(#cr-hatch)" stroke={NAVY} strokeWidth="1.1" />
      <line x1={x - 7} y1={y - 17} x2={x - 7} y2={y + 17} stroke={NAVY} strokeWidth="1.3" />
      <line x1={x + 7} y1={y - 17} x2={x + 7} y2={y + 17} stroke={NAVY} strokeWidth="1.3" />
    </g>
  );
}

/** Símbolo de apoyo en nudo interior (viga continua sobre apoyos). */
function InteriorSupport({ x, y }: { x: number; y: number }) {
  const h = 16;
  return (
    <g>
      <path d={`M${x},${y} L${x - h * 0.62},${y + h} L${x + h * 0.62},${y + h} Z`} fill="none" stroke={NAVY} strokeWidth="1.3" />
      <line x1={x - h * 0.9} y1={y + h} x2={x + h * 0.9} y2={y + h} stroke={NAVY} strokeWidth="1.3" />
      {[-1, -0.5, 0, 0.5, 1].map((t, i) => (
        <line key={i} x1={x + t * h * 0.9} y1={y + h} x2={x + t * h * 0.9 - 5} y2={y + h + 7} stroke={NAVY} strokeWidth="0.9" />
      ))}
    </g>
  );
}

export function CrossCroquis({ values }: { values: Record<string, string> }) {
  const nSpans = Math.max(2, Math.min(4, Math.round(nv(values, "crN", 3))));
  const spans: CrossSpan[] = [];
  for (let i = 1; i <= nSpans; i++) {
    spans.push({
      L: Math.max(0.1, nv(values, `crL${i}`, 5)),
      I: Math.max(0.01, nv(values, `crI${i}`, 1)),
      femL: nv(values, `crFEM${i}L`, 0),
      femR: nv(values, `crFEM${i}R`, 0),
    });
  }
  const res = solveCross(spans);

  const W = 560;
  const xL = 46;
  const xR = 514;
  const totalL = spans.reduce((s, sp) => s + sp.L, 0) || 1;
  const jointX: number[] = [xL];
  spans.forEach((sp) => jointX.push(jointX[jointX.length - 1] + ((xR - xL) * sp.L) / totalL));

  const yBeam = 92;
  const beamH = 15;

  // Momentos finales por extremo, indexados por junta física (columna) para el gráfico de barras.
  type EndPt = { x: number; label: string; value: number };
  const ends: EndPt[] = [];
  spans.forEach((_, idx) => {
    const s = idx + 1;
    ends.push({ x: jointX[idx] + 5, label: crossLabelL(s), value: res.final[idx].L });
    ends.push({ x: jointX[idx + 1] - 5, label: crossLabelR(s), value: res.final[idx].R });
  });
  const maxAbs = Math.max(1, ...ends.map((e) => Math.abs(e.value)));
  const barBase = 300;
  const barScale = 40 / maxAbs;

  return (
    <Frame viewBox={`0 0 ${W} 410`} caption="Viga continua — nudos, apoyos y momentos finales de Cross (extremos lejanos empotrados)">
      {/* Eje de la viga */}
      <line x1={xL} y1={yBeam} x2={xR} y2={yBeam} stroke={NAVY} strokeOpacity="0.35" strokeDasharray="2 3" />
      <rect x={xL} y={yBeam - beamH / 2} width={xR - xL} height={beamH} fill="url(#cr-conc)" stroke={NAVY} strokeWidth="1.4" />

      {/* Apoyos */}
      <FixedSupport x={jointX[0]} y={yBeam} />
      <FixedSupport x={jointX[nSpans]} y={yBeam} />
      {jointX.slice(1, nSpans).map((x, i) => (
        <InteriorSupport key={i} x={x} y={yBeam + beamH / 2} />
      ))}

      {/* Nudos numerados */}
      {jointX.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={yBeam - 26} r={11} fill="#fbf8f1" stroke={NAVY} strokeWidth="1.3" />
          <text x={x} y={yBeam - 22} textAnchor="middle" fontSize="12" fontWeight={700} fill={NAVY} fontFamily={FONT}>
            {i + 1}
          </text>
        </g>
      ))}

      {/* Datos de cada tramo */}
      {spans.map((sp, idx) => {
        const xm = (jointX[idx] + jointX[idx + 1]) / 2;
        return (
          <g key={idx}>
            <line x1={jointX[idx] + 8} y1={yBeam + beamH / 2 + 10} x2={jointX[idx + 1] - 8} y2={yBeam + beamH / 2 + 10} stroke={NAVY} strokeOpacity="0.55" strokeWidth="0.8" />
            <line x1={jointX[idx] + 8} y1={yBeam + beamH / 2 + 6} x2={jointX[idx] + 8} y2={yBeam + beamH / 2 + 14} stroke={NAVY} strokeOpacity="0.55" strokeWidth="0.8" />
            <line x1={jointX[idx + 1] - 8} y1={yBeam + beamH / 2 + 6} x2={jointX[idx + 1] - 8} y2={yBeam + beamH / 2 + 14} stroke={NAVY} strokeOpacity="0.55" strokeWidth="0.8" />
            <text x={xm} y={yBeam + beamH / 2 + 26} textAnchor="middle" fontSize="10.5" fill={INK} fontFamily={FONT}>
              {`Tramo ${idx + 1}: L=${sp.L.toFixed(2)} m`}
            </text>
            <text x={xm} y={yBeam + beamH / 2 + 39} textAnchor="middle" fontSize="9.5" fill="#6b6458" fontFamily={FONT}>
              {`I=${sp.I.toFixed(2)}  ·  k=I/L=${(sp.I / sp.L).toFixed(3)}`}
            </text>
          </g>
        );
      })}

      {/* Factores de distribución en cada nudo interior */}
      {res.joints.map((jt, i) => {
        const x = jointX[jt.joint - 1];
        const left = jt.members[0];
        const right = jt.members[1];
        const wBar = 74;
        const wl = wBar * left.df;
        return (
          <g key={i}>
            <text x={x} y={156} textAnchor="middle" fontSize="9" fill={NAVY} fontFamily={FONT} fontWeight={600}>
              DF
            </text>
            <rect x={x - wBar / 2} y={162} width={wBar} height={11} fill="#eadfc4" stroke={NAVY} strokeWidth="0.8" />
            <rect x={x - wBar / 2} y={162} width={wl} height={11} fill={NEG} fillOpacity={0.55} />
            <rect x={x - wBar / 2 + wl} y={162} width={wBar - wl} height={11} fill={POS} fillOpacity={0.55} />
            <text x={x} y={186} textAnchor="middle" fontSize="9" fill={INK} fontFamily={FONT}>
              {`${crossLabelR(left.span)}: ${left.df.toFixed(2)}  ·  ${crossLabelL(right.span)}: ${right.df.toFixed(2)}`}
            </text>
          </g>
        );
      })}

      {/* Diagrama de barras: momentos finales de Cross en cada extremo */}
      <text x={xL} y={214} textAnchor="start" fontSize="9.5" fill={INK} fontFamily={FONT} fontWeight={600}>
        Momentos finales en cada extremo (t·m)
      </text>
      <line x1={xL} y1={barBase} x2={xR} y2={barBase} stroke={NAVY} strokeWidth="1.1" />
      {ends.map((e, i) => {
        const h = Math.abs(e.value) * barScale;
        const neg = e.value < 0;
        const y = neg ? barBase : barBase - h;
        const labelY = neg ? barBase + h + 14 : barBase + 14;
        return (
          <g key={i}>
            <rect x={e.x - 9} y={y} width={18} height={Math.max(1, h)} fill={neg ? NEG : POS} fillOpacity={0.75} stroke={neg ? NEG : POS} strokeWidth="0.8" />
            <text
              x={e.x}
              y={neg ? barBase + h + 27 : barBase - h - 6}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight={600}
              fill={neg ? NEG : POS}
              fontFamily={FONT}
            >
              {fmt2(e.value)}
            </text>
            <text x={e.x} y={labelY} textAnchor="middle" fontSize="8.5" fill="#6b6458" fontFamily={FONT}>
              {e.label}
            </text>
          </g>
        );
      })}

      <text x={xL} y={395} textAnchor="start" fontSize="9" fill="#6b6458" fontFamily={FONT}>
        {`DF = factor de distribución · Rojo = momento negativo · Azul = momento positivo · convergencia en ${res.cycles.length} ciclo${res.cycles.length > 1 ? "s" : ""}`}
      </text>
    </Frame>
  );
}
