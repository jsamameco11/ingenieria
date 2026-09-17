import { modeloDclMuro } from "../lib/dcl/muroVoladizo";
import { CargaDistribuida } from "./DclCargas";

const LOAD = "#8b1e1e";
const SURC = "#a14a1a";
const WATER = "#2f6a8f";
const SEIS = "#7a3e12";
const WGT = "#1a4473";
const REACT = "#1f6b3a";
const INK = "#1a4473";
const FONT = "IBM Plex Sans, sans-serif";

function Arrow({
  x1,
  y1,
  x2,
  y2,
  color,
  width = 1.8,
  marker,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width?: number;
  marker: string;
}) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} markerEnd={`url(#${marker})`} />;
}

function CgMark({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="5.5" fill="#fbf8f1" stroke={WGT} strokeWidth="1.2" />
      <line x1={x - 5.5} y1={y} x2={x + 5.5} y2={y} stroke={WGT} strokeWidth="1" />
      <line x1={x} y1={y - 5.5} x2={x} y2={y + 5.5} stroke={WGT} strokeWidth="1" />
    </g>
  );
}

function Cota({
  x1,
  y1,
  x2,
  y2,
  label,
  side = 22,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  side?: number;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * Math.sign(side || 1);
  const oy = (dx / len) * Math.sign(side || 1);
  const d = Math.abs(side);
  const a1x = x1 + ox * d;
  const a1y = y1 + oy * d;
  const a2x = x2 + ox * d;
  const a2y = y2 + oy * d;
  const mx = (a1x + a2x) / 2 + ox * 11;
  const my = (a1y + a2y) / 2 + oy * 11;
  const tick = 3.4;
  return (
    <g>
      <line x1={x1 + ox * 2} y1={y1 + oy * 2} x2={x1 + ox * (d + 3)} y2={y1 + oy * (d + 3)} stroke={INK} strokeWidth="0.8" />
      <line x1={x2 + ox * 2} y1={y2 + oy * 2} x2={x2 + ox * (d + 3)} y2={y2 + oy * (d + 3)} stroke={INK} strokeWidth="0.8" />
      <line x1={a1x} y1={a1y} x2={a2x} y2={a2y} stroke={INK} strokeWidth="0.9" />
      <line x1={a1x - tick} y1={a1y + tick} x2={a1x + tick} y2={a1y - tick} stroke={INK} strokeWidth="0.9" />
      <line x1={a2x - tick} y1={a2y + tick} x2={a2x + tick} y2={a2y - tick} stroke={INK} strokeWidth="0.9" />
      <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={INK} fontFamily={FONT}>
        {label}
      </text>
    </g>
  );
}

function Plaque({
  x,
  y,
  lines,
  color,
  anchor = "middle",
}: {
  x: number;
  y: number;
  lines: { text: string; size?: number; weight?: number }[];
  color: string;
  anchor?: "start" | "middle" | "end";
}) {
  const width = Math.max(...lines.map((l) => l.text.length * (l.size ?? 9) * 0.62), 52) + 14;
  const height = lines.length * 12 + 8;
  const bx = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
  const by = y;
  return (
    <g>
      <rect x={bx} y={by} width={width} height={height} rx="3.5" fill="#fbf8f1" stroke={color} strokeWidth="0.85" />
      {lines.map((l, i) => (
        <text
          key={i}
          x={bx + width / 2}
          y={by + 13 + i * 12}
          textAnchor="middle"
          fontSize={l.size ?? 9}
          fontWeight={l.weight ?? 700}
          fill={color}
          fontFamily={FONT}
        >
          {l.text}
        </text>
      ))}
    </g>
  );
}

type LoadLane = {
  id: string;
  color: string;
  w0: number;
  w1: number;
  y0: number;
  y1: number;
  yRes: number;
  title: string;
  sub: string;
  dash?: string;
};

/**
 * Diagrama de cuerpo libre en elevación (franja 1.00 m): sección acotada,
 * empujes en columnas laterales (sin superponer), pesos, presiones y reacciones.
 */
export function DclMuroVoladizo({ values }: { values: Record<string, string> }) {
  const m = modeloDclMuro(values);
  const padL = 86;
  const padT = 58;
  const padB = m.hk > 0.02 ? 132 : 108;
  const wallBox = 368;
  const colW = 86;
  const colGap = 10;
  const Ht = 540;
  const sx = wallBox / Math.max(m.B, 2.2);
  const sy = (Ht - padT - padB) / Math.max(m.H + Math.max(0, m.hk), 2.4);
  const x0 = padL;
  const yBot = Ht - padB;
  const yTop = yBot - m.H * sy;
  const yBase = yBot - m.esp * sy;
  const yFront = yBot - Math.min(m.D, m.H) * sy;
  const yKey = yBot + Math.max(0, m.hk) * sy;
  const xP = x0;
  const xSF = x0 + m.C * sx;
  const xSB = x0 + (m.C + m.F) * sx;
  const xH = x0 + m.B * sx;
  const B1 = Math.max(0, (m.F - m.Bp) / 2);
  const xTopF = xSF + B1 * sx;
  const xTopB = xSB - B1 * sx;
  const xKeyR = xSF + Math.min(m.F, Math.max(m.bk, 0.01)) * sx;
  const wall =
    m.hk > 0.02
      ? `${xP},${yBase} ${xP},${yBot} ${xSF},${yBot} ${xSF},${yKey} ${xKeyR},${yKey} ${xKeyR},${yBot} ${xH},${yBot} ${xH},${yBase} ${xSB},${yBase} ${xTopB},${yTop} ${xTopF},${yTop} ${xSF},${yBase}`
      : `${xP},${yBase} ${xP},${yBot} ${xH},${yBot} ${xH},${yBase} ${xSB},${yBase} ${xTopB},${yTop} ${xTopF},${yTop} ${xSF},${yBase}`;
  const slope = Math.tan((m.beta * Math.PI) / 180);
  const yFillTop = yTop - slope * ((xH - xTopB) / Math.max(sx, 1)) * sy;
  const yWater = yBot - Math.min(m.hSat, m.H) * sy;
  const yPa = yBot - m.yPa * sy;
  const yPw = yBot - m.yPw * sy;
  const yPae = yBot - m.yPae * sy;
  const yCg = yBot - m.yW * sy;
  const xCg = xP + Math.min(Math.max(m.xBar, 0.05), m.B) * sx;
  const qMax = Math.max(m.qToe, m.qHeel, 0.01);
  const qH = 36;
  const qToeH = (m.qToe / qMax) * qH;
  const qHeelH = (m.qHeel / qMax) * qH;

  const mag = Math.max(m.Pa, m.Pq, m.Pw, m.dPae, 1);
  const colFig = (v: number, lo: number, hi: number) => lo + (hi - lo) * Math.min(1, Math.max(0.25, v / mag));

  const lanes: LoadLane[] = [];
  if (m.Pa > 0.02) {
    const peak = colFig(m.Pa, 34, 52);
    lanes.push({
      id: "dcl-pa",
      color: LOAD,
      w0: 5,
      w1: peak,
      y0: yTop,
      y1: yBot,
      yRes: yPa,
      title: `Pa ${m.Pa.toFixed(2)}`,
      sub: `H/3=${m.yPa.toFixed(2)} m`,
    });
  }
  if (m.Pq > 0.05) {
    const peak = colFig(m.Pq, 22, 40);
    lanes.push({
      id: "dcl-pq",
      color: SURC,
      w0: peak,
      w1: peak,
      y0: yTop,
      y1: yBot,
      yRes: (yTop + yBot) / 2,
      title: `Pq ${m.Pq.toFixed(2)}`,
      sub: "uniforme",
    });
  }
  if (m.Pw > 0.05) {
    const peak = colFig(m.Pw, 22, 38);
    lanes.push({
      id: "dcl-pw",
      color: WATER,
      w0: 5,
      w1: peak,
      y0: yWater,
      y1: yBot,
      yRes: yPw,
      title: `Pw ${m.Pw.toFixed(2)}`,
      sub: `h″/3=${m.yPw.toFixed(2)} m`,
    });
  }
  if (m.dPae > 0.01) {
    const peak = colFig(m.dPae, 24, 40);
    lanes.push({
      id: "dcl-pae",
      color: SEIS,
      w0: peak,
      w1: 8,
      y0: yTop,
      y1: yBot,
      yRes: yPae,
      title: `ΔPae ${m.dPae.toFixed(2)}`,
      sub: `0,6H=${m.yPae.toFixed(2)} m`,
      dash: "4.5,2.5",
    });
  }

  const xLoad0 = xH + 22;
  const loadBand = lanes.length === 0 ? 48 : lanes.length * colW + Math.max(0, lanes.length - 1) * colGap;
  const W = xLoad0 + loadBand + 18;

  return (
    <div className="croquis" data-fig-part="momento">
      <div className="croquis-head">
        <p>Diagrama de cuerpo libre — elevación, franja 1.00 m</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={`0 0 ${W} ${Ht}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="dcl-wgt" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={WGT} />
            </marker>
            <marker id="dcl-react" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={REACT} />
            </marker>
            <pattern id="dcl-conc" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#d9d2c3" />
              <circle cx="2" cy="3" r="0.6" fill="#6b6458" />
              <circle cx="6" cy="6" r="0.5" fill="#6b6458" />
            </pattern>
            <pattern id="dcl-soil" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <rect width="9" height="9" fill="#d8c9a6" />
              <line x1="0" y1="0" x2="0" y2="9" stroke="#8a7344" strokeWidth="0.7" />
            </pattern>
            <pattern id="dcl-front" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
              <rect width="8" height="8" fill="#cbb892" />
              <line x1="0" y1="0" x2="0" y2="8" stroke="#7a6a48" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={W} height={Ht} fill="#fbf8f1" />

          <text x={xP - 8} y={16} fontSize="9" fill={INK} fontFamily={FONT}>
            DESMONTE
          </text>
          <text x={(xSB + xH) / 2} y={16} textAnchor="middle" fontSize="9" fill={INK} fontFamily={FONT}>
            TRASDÓS · RELLENO
          </text>

          <polygon
            points={`${xSB},${yBase} ${xH},${yBase} ${xH},${Math.min(yBase, yFillTop)} ${xH},${Math.min(yTop - 8, yFillTop)} ${xTopB},${yTop}`}
            fill="url(#dcl-soil)"
            stroke="#8a7344"
            strokeWidth="0.9"
          />
          {m.hSat > 0.05 ? (
            <polygon
              points={`${xSB},${yBase} ${xH},${yBase} ${xH},${Math.max(yWater, yTop)} ${xSB},${Math.max(yWater, yBase)}`}
              fill="#6a9cc9"
              opacity="0.28"
            />
          ) : null}
          <polygon points={`${xP - 14},${yFront} ${xP},${yFront} ${xP},${m.hk > 0.02 ? yKey : yBot} ${xP - 14},${m.hk > 0.02 ? yKey : yBot}`} fill="url(#dcl-front)" stroke="#8a7344" strokeWidth="0.8" />
          <line x1={xP - 48} y1={m.hk > 0.02 ? yKey : yBot} x2={xH + 10} y2={m.hk > 0.02 ? yKey : yBot} stroke="#8a7a55" strokeWidth="2.2" />
          <polygon points={wall} fill="url(#dcl-conc)" stroke={INK} strokeWidth="1.7" />

          {lanes.length > 0 ? (
            <g>
              <rect
                x={xLoad0 - 10}
                y={20}
                width={loadBand + 20}
                height={yBot - 20 + 8}
                rx="8"
                fill="#f3eee3"
                stroke="#d2c7b0"
                strokeWidth="0.9"
              />
              <line x1={xH + 14} y1={yTop} x2={xH + 14} y2={yBot} stroke="#c4b79a" strokeWidth="0.9" strokeDasharray="3,3" />
            </g>
          ) : null}

          {lanes.map((lane, i) => {
            const xCol = xLoad0 + i * (colW + colGap);
            const figW = Math.max(lane.w0, lane.w1);
            const xFace = xCol + Math.max(6, (colW - figW) / 2);
            return (
              <g key={lane.id}>
                <CargaDistribuida
                  id={lane.id}
                  x0={xFace}
                  y0={lane.y0}
                  y1={lane.y1}
                  w0={lane.w0}
                  w1={lane.w1}
                  toward="left"
                  color={lane.color}
                  arrows={5}
                  fillOpacity={0.14}
                  strokeDasharray={lane.dash}
                />
                <circle cx={xFace} cy={lane.yRes} r="2.4" fill="#fbf8f1" stroke={lane.color} strokeWidth="1.3" />
                <Plaque
                  x={xCol + colW / 2}
                  y={24}
                  color={lane.color}
                  lines={[
                    { text: lane.title, size: 9, weight: 700 },
                    { text: lane.sub, size: 8, weight: 500 },
                  ]}
                />
              </g>
            );
          })}

          <CgMark x={xCg} y={yCg} />
          <line
            x1={(xSB + xH) / 2}
            y1={yTop + 40}
            x2={xCg}
            y2={yCg - 8}
            stroke={WGT}
            strokeWidth="0.9"
            strokeDasharray="3,2"
          />
          <Arrow x1={xCg} y1={yCg - 28} x2={xCg} y2={yCg - 8} color={WGT} width={2.2} marker="dcl-wgt" />
          <Plaque
            x={(xSB + xH) / 2}
            y={yTop + 8}
            color={WGT}
            lines={[
              { text: `W = ${m.Wtot.toFixed(2)} t/ml`, size: 9, weight: 700 },
              { text: `x̄ = ${m.xBar.toFixed(2)} m`, size: 8, weight: 500 },
            ]}
          />

          <CargaDistribuida
            id="dcl-q"
            x0={xP}
            y0={yBot + 6}
            x1={xH}
            y1={yBot + 6}
            w0={Math.max(10, qToeH)}
            w1={Math.max(10, qHeelH)}
            toward="up"
            color={REACT}
            fillOpacity={0.14}
          />
          <text x={xP} y={yBot + 6 + qToeH + 12} fontSize="8" fill={REACT} fontFamily={FONT}>
            {`qpata ${m.qToe.toFixed(2)}`}
          </text>
          <text x={xH} y={yBot + 6 + qHeelH + 12} textAnchor="end" fontSize="8" fill={REACT} fontFamily={FONT}>
            {`qtalón ${m.qHeel.toFixed(2)} t/m²`}
          </text>

          <Arrow x1={xCg} y1={yBot + 6 + Math.max(qToeH, qHeelH) + 28} x2={xCg} y2={yBot + 8} color={REACT} width={2.2} marker="dcl-react" />
          <text x={xCg + 10} y={yBot + 20} fontSize="9.5" fill={REACT} fontWeight="700" fontFamily={FONT}>
            {`Rv = ${m.Wtot.toFixed(2)} t/ml`}
          </text>
          <Arrow x1={xP - 62} y1={yBot - 10} x2={xP - 8} y2={yBot - 10} color={REACT} width={2.1} marker="dcl-react" />
          <text x={xP - 64} y={yBot - 18} textAnchor="end" fontSize="9.5" fill={REACT} fontWeight="700" fontFamily={FONT}>
            Rh
          </text>
          <text x={xP - 64} y={yBot - 5} textAnchor="end" fontSize="8.5" fill={REACT} fontFamily={FONT}>
            deslizamiento
          </text>

          <text x={(xP + xSF) / 2} y={yBase - 7} textAnchor="middle" fontSize="9" fill={INK} fontWeight="700">
            PUNTERA
          </text>
          <text x={(xSF + xSB) / 2} y={yTop + 36} textAnchor="middle" fontSize="9" fill={INK} fontWeight="700">
            PANTALLA
          </text>
          <text x={(xSB + xH) / 2} y={yBase - 7} textAnchor="middle" fontSize="9" fill={INK} fontWeight="700">
            TALÓN
          </text>
          {m.hk > 0.02 ? (
            <text x={(xSF + xKeyR) / 2} y={(yBot + yKey) / 2 + 3} textAnchor="middle" fontSize="8.5" fill="#8b1e1e" fontWeight="700">
              DENTELLÓN
            </text>
          ) : null}

          <Cota x1={xP} y1={yBot} x2={xSF} y2={yBot} label={`C=${m.C.toFixed(2)} m`} side={52} />
          <Cota x1={xSF} y1={yBot} x2={xSB} y2={yBot} label={`F=${m.F.toFixed(2)} m`} side={72} />
          <Cota x1={xSB} y1={yBot} x2={xH} y2={yBot} label={`A=${m.A.toFixed(2)} m`} side={52} />
          <Cota x1={xP} y1={yBot} x2={xH} y2={yBot} label={`B=${m.B.toFixed(2)} m`} side={92} />
          <Cota x1={xP} y1={yTop} x2={xP} y2={yBot} label={`H=${m.H.toFixed(2)} m`} side={-40} />
          <Cota x1={xSF} y1={yTop} x2={xSF} y2={yBase} label={`Hs=${m.Hs.toFixed(2)} m`} side={28} />
          <Cota x1={xH} y1={yBase} x2={xH} y2={yBot} label={`e=${m.esp.toFixed(2)} m`} side={18} />
          <Cota x1={xP - 16} y1={yFront} x2={xP - 16} y2={yBot} label={`D=${m.D.toFixed(2)} m`} side={-22} />
          <Cota x1={xTopF} y1={yTop} x2={xTopB} y2={yTop} label={`B′=${m.Bp.toFixed(2)} m`} side={-18} />
          {m.hk > 0.02 ? <Cota x1={xSF} y1={yKey} x2={xSF} y2={yBot} label={`hk=${m.hk.toFixed(2)} m`} side={-22} /> : null}

          <g fontFamily={FONT} fontSize="8.5">
            <line x1={18} y1={Ht - 22} x2={36} y2={Ht - 22} stroke={LOAD} strokeWidth="2.2" />
            <text x="40" y={Ht - 19} fill={LOAD}>
              empujes
            </text>
            <line x1={108} y1={Ht - 22} x2={126} y2={Ht - 22} stroke={WGT} strokeWidth="2.2" />
            <text x="130" y={Ht - 19} fill={WGT}>
              peso W
            </text>
            <line x1={198} y1={Ht - 22} x2={216} y2={Ht - 22} stroke={REACT} strokeWidth="2.2" />
            <text x="220" y={Ht - 19} fill={REACT}>
              reacciones y q(x)
            </text>
            <line x1={348} y1={Ht - 22} x2={366} y2={Ht - 22} stroke={WATER} strokeWidth="2.2" />
            <text x="370" y={Ht - 19} fill={WATER}>
              agua
            </text>
            <line x1={430} y1={Ht - 22} x2={448} y2={Ht - 22} stroke={SEIS} strokeWidth="2.2" strokeDasharray="4,2" />
            <text x="452" y={Ht - 19} fill={SEIS}>
              sismo ΔPae
            </text>
          </g>
        </svg>
      </div>
      <p className="croquis-cap">{`DCL 2D · empujes en columnas · Pa=${m.Pa.toFixed(2)} t/ml a H/3 · W=${m.Wtot.toFixed(2)} t/ml · Rv en x̄=${m.xBar.toFixed(2)} m · FSd=${m.FSd.toFixed(2)} · FSv=${m.FSv.toFixed(2)}`}</p>
    </div>
  );
}
