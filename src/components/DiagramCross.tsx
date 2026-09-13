import type { ReactNode } from "react";
import { solveCross, solveCrossFrame, type CrossSpan, type FrameMember, type FrameJointDef } from "../lib/crossMethod";

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

function jointId(level: number, col: number) {
  return level * 10 + col;
}
function frameLabel(own: number, other: number) {
  return `M${own}-${other}`;
}

/** Nudo de la grilla: círculo numerado (libre) o empotramiento (base, nivel 0). */
function GridJoint({ x, y, id, fixed }: { x: number; y: number; id: number; fixed: boolean }) {
  if (fixed) {
    return (
      <g>
        <rect x={x - 15} y={y - 3} width={30} height={12} fill="url(#cr-hatch)" stroke={NAVY} strokeWidth="1" />
        <line x1={x - 15} y1={y - 3} x2={x - 15} y2={y + 9} stroke={NAVY} strokeWidth="1.1" />
        <line x1={x + 15} y1={y - 3} x2={x + 15} y2={y + 9} stroke={NAVY} strokeWidth="1.1" />
      </g>
    );
  }
  return (
    <g>
      <circle cx={x} cy={y} r={10} fill="#fbf8f1" stroke={NAVY} strokeWidth="1.2" />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9.5" fontWeight={700} fill={NAVY} fontFamily={FONT}>
        {id}
      </text>
    </g>
  );
}

export function PorticoCroquis({ values }: { values: Record<string, string> }) {
  const nLevels = Math.max(1, Math.min(3, Math.round(nv(values, "crNL", 2))));
  const nBays = Math.max(1, Math.min(3, Math.round(nv(values, "crNB", 2))));

  const members: FrameMember[] = [];
  for (let lvl = 1; lvl <= nLevels; lvl++) {
    for (let b = 1; b <= nBays; b++) {
      members.push({
        id: `B${lvl}_${b}`,
        jointA: jointId(lvl, b),
        jointB: jointId(lvl, b + 1),
        L: Math.max(0.1, nv(values, `crBL${lvl}${b}`, 5)),
        I: Math.max(0.01, nv(values, `crBI${lvl}${b}`, 1)),
        femA: nv(values, `crBFL${lvl}${b}`, 0),
        femB: nv(values, `crBFR${lvl}${b}`, 0),
      });
    }
    for (let c = 1; c <= nBays + 1; c++) {
      members.push({
        id: `C${lvl}_${c}`,
        jointA: jointId(lvl - 1, c),
        jointB: jointId(lvl, c),
        L: Math.max(0.1, nv(values, `crCH${lvl}${c}`, 3)),
        I: Math.max(0.01, nv(values, `crCI${lvl}${c}`, 1)),
        femA: 0,
        femB: 0,
      });
    }
  }
  const joints: FrameJointDef[] = [];
  for (let lvl = 0; lvl <= nLevels; lvl++) {
    for (let c = 1; c <= nBays + 1; c++) joints.push({ id: jointId(lvl, c), fixed: lvl === 0 });
  }
  const res = solveCrossFrame(members, joints);

  const W = 620;
  const xL = 70;
  const xR = 550;
  const colX: number[] = [];
  for (let c = 1; c <= nBays + 1; c++) colX.push(xL + ((xR - xL) * (c - 1)) / nBays);

  const baseY = 330;
  const availH = 250;
  const storyH: number[] = [];
  for (let lvl = 1; lvl <= nLevels; lvl++) storyH.push(Math.max(0.1, nv(values, `crCH${lvl}1`, 3)));
  const totalH = storyH.reduce((s, h) => s + h, 0) || 1;
  const levelY: number[] = [baseY];
  storyH.forEach((h) => levelY.push(levelY[levelY.length - 1] - (availH * h) / totalH));

  const maxAbs = Math.max(1, ...members.flatMap((m) => [Math.abs(res.final[m.id].A), Math.abs(res.final[m.id].B)]));

  return (
    <Frame viewBox={`0 0 ${W} 400`} caption={`Pórtico de ${nLevels} nivel${nLevels > 1 ? "es" : ""} × ${nBays} vano${nBays > 1 ? "s" : ""} — nudos, DF y momentos finales de Cross (bases empotradas, sin sway)`}>
      {/* Columnas */}
      {members.filter((m) => m.id.startsWith("C")).map((m, i) => {
        const [, lvlS, cS] = m.id.match(/^C(\d)_(\d)$/)!;
        const lvl = Number(lvlS), c = Number(cS);
        const x = colX[c - 1];
        return <line key={i} x1={x} y1={levelY[lvl - 1]} x2={x} y2={levelY[lvl]} stroke={NAVY} strokeWidth="5" strokeOpacity="0.85" />;
      })}
      {/* Vigas */}
      {members.filter((m) => m.id.startsWith("B")).map((m, i) => {
        const [, lvlS, bS] = m.id.match(/^B(\d)_(\d)$/)!;
        const lvl = Number(lvlS), b = Number(bS);
        const y = levelY[lvl];
        return <line key={i} x1={colX[b - 1]} y1={y} x2={colX[b]} y2={y} stroke={NAVY} strokeWidth="4" strokeOpacity="0.85" />;
      })}

      {/* Nudos */}
      {joints.map((jt, i) => {
        const lvl = Math.floor(jt.id / 10);
        const c = jt.id % 10;
        return <GridJoint key={i} x={colX[c - 1]} y={levelY[lvl]} id={jt.id} fixed={jt.fixed} />;
      })}

      {/* Momentos finales en cada extremo de barra (valor + etiqueta, compacto) */}
      {members.map((m, i) => {
        const [, tS, lvlS, idxS] = m.id.match(/^([BC])(\d)_(\d)$/)!;
        const lvl = Number(lvlS);
        const isBeam = tS === "B";
        const idx = Number(idxS);
        const ax = isBeam ? colX[idx - 1] : colX[idx - 1];
        const ay = isBeam ? levelY[lvl] : levelY[lvl - 1];
        const bx = isBeam ? colX[idx] : colX[idx - 1];
        const by = isBeam ? levelY[lvl] : levelY[lvl];
        const inset = 0.22;
        const pA = { x: ax + (bx - ax) * inset, y: ay + (by - ay) * inset };
        const pB = { x: bx + (ax - bx) * inset, y: by + (ay - by) * inset };
        const dx = isBeam ? 0 : 15;
        const dy = isBeam ? -8 : 0;
        const vA = res.final[m.id].A;
        const vB = res.final[m.id].B;
        return (
          <g key={i}>
            <text x={pA.x + dx} y={pA.y + dy} textAnchor="middle" fontSize="7.5" fontWeight={700} fill={vA < 0 ? NEG : POS} fontFamily={FONT}>
              {fmt2(vA)}
            </text>
            <text x={pB.x + dx} y={pB.y + dy} textAnchor="middle" fontSize="7.5" fontWeight={700} fill={vB < 0 ? NEG : POS} fontFamily={FONT}>
              {fmt2(vB)}
            </text>
          </g>
        );
      })}

      {/* Factores de distribución en cada nudo libre */}
      {res.jointDF.map((jt, i) => {
        const lvl = Math.floor(jt.joint / 10);
        const c = jt.joint % 10;
        const x = colX[c - 1];
        const y = levelY[lvl];
        const lines = jt.members.map((m) => {
          const mem = members.find((mm) => mm.id === m.memberId)!;
          const other = m.end === "A" ? mem.jointB : mem.jointA;
          return `${frameLabel(jt.joint, other)}:${m.df.toFixed(2)}`;
        });
        return (
          <text key={i} x={x + 14} y={y - 12 - (lines.length - 1) * 8} textAnchor="start" fontSize="7" fill={INK} fontFamily={FONT}>
            {lines.map((ln, li) => (
              <tspan key={li} x={x + 14} dy={li === 0 ? 0 : 8}>
                {ln}
              </tspan>
            ))}
          </text>
        );
      })}

      <text x={xL} y={20} textAnchor="start" fontSize="9.5" fill={NAVY} fontFamily={FONT} fontWeight={600}>
        {`Nudos: M(nudo propio)(nudo lejano) · máx |M|=${fmt2(maxAbs)} t·m`}
      </text>
      <text x={xL} y={380} textAnchor="start" fontSize="9" fill="#6b6458" fontFamily={FONT}>
        {`DF = factor de distribución · Rojo = momento negativo · Azul = momento positivo · convergencia en ${res.cycles.length} ciclo${res.cycles.length > 1 ? "s" : ""} · sin corrección por desplazamiento lateral`}
      </text>
    </Frame>
  );
}

export function CrossCroquisAny({ values }: { values: Record<string, string> }) {
  const mode = String(values.crMode ?? "viga").trim();
  return mode === "portico" ? <PorticoCroquis values={values} /> : <CrossCroquis values={values} />;
}
