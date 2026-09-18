import { CargaDistribuida } from "./DclCargas";
import { geoEstriboPantalla } from "../lib/steelEngine";

const INK = "#163a63";
const FLEX = "#8b1e1e";
const SEIS = "#7a3e12";
const LOAD = "#8b1e1e";
const WGT = "#1a4473";
const FONT = "IBM Plex Sans, sans-serif";

function nv(v: Record<string, string>, k: string, fb = 0) {
  const x = Number(String(v[k] ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : fb;
}

function wallPts(v: Record<string, string>, box: { sx: number; sy: number; x0: number; yBot: number }) {
  const H = Math.max(0.8, nv(v, "H", 4));
  const A = Math.max(0.25, nv(v, "A", 2));
  const C = Math.max(0.25, nv(v, "C", 1.2));
  const F = Math.max(0.2, nv(v, "F", 0.4));
  const Bp = Math.min(F, Math.max(0.12, nv(v, "Bp", 0.2)));
  const esp = Math.max(0.15, nv(v, "esp", 0.4));
  const B = nv(v, "B", A + C + F);
  const hk = Math.max(0, nv(v, "hk", 0));
  const bk = hk > 0.02 ? Math.min(F, Math.max(0.25, nv(v, "bk", F))) : 0;
  const B1 = Math.max(0, (F - Bp) / 2);
  const { sx, sy, x0, yBot } = box;
  const yBase = yBot - esp * sy;
  const yTop = yBot - H * sy;
  const yKey = yBot + hk * sy;
  const xP = x0;
  const xSF = x0 + C * sx;
  const xSB = x0 + (C + F) * sx;
  const xH = x0 + B * sx;
  const xTopF = xSF + B1 * sx;
  const xTopB = xSB - B1 * sx;
  const xKeyR = xSF + bk * sx;
  const wall =
    hk > 0.02
      ? `${xP},${yBase} ${xP},${yBot} ${xSF},${yBot} ${xSF},${yKey} ${xKeyR},${yKey} ${xKeyR},${yBot} ${xH},${yBot} ${xH},${yBase} ${xSB},${yBase} ${xTopB},${yTop} ${xTopF},${yTop} ${xSF},${yBase}`
      : `${xP},${yBase} ${xP},${yBot} ${xH},${yBot} ${xH},${yBase} ${xSB},${yBase} ${xTopB},${yTop} ${xTopF},${yTop} ${xSF},${yBase}`;
  return { H, A, C, F, Bp, esp, B, hk, bk, yBase, yTop, yBot, yKey, xP, xSF, xSB, xH, xTopF, xTopB, xKeyR, wall, sx, sy };
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
  color,
  marker,
  width = 2.2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  marker: string;
  width?: number;
}) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} markerEnd={`url(#${marker})`} />;
}

function Plate({
  x,
  y,
  lines,
  color,
  anchor = "start",
}: {
  x: number;
  y: number;
  lines: string[];
  color: string;
  anchor?: "start" | "end";
}) {
  const w = Math.max(...lines.map((t) => t.length * 6.4), 72) + 16;
  const h = lines.length * 14 + 10;
  const bx = anchor === "end" ? x - w : x;
  return (
    <g>
      <rect x={bx} y={y} width={w} height={h} rx="4" fill="#fffcf6" stroke={color} strokeWidth="1.1" />
      {lines.map((t, i) => (
        <text key={i} x={bx + 8} y={y + 16 + i * 14} fontSize="10" fill={color} fontFamily={FONT} fontWeight={i === 0 ? 700 : 500}>
          {t}
        </text>
      ))}
    </g>
  );
}

/** Dónde se aplican Kh, Kv, ΔPae y PIR — cotas de posición. */
export function SismoMuroFig({ values }: { values: Record<string, string> }) {
  const H = Math.max(0.8, nv(values, "H", 4));
  const B = Math.max(1.2, nv(values, "B", 3.6));
  const Pa = nv(values, "Pa");
  const Pae = nv(values, "Pae");
  const dPae = nv(values, "dPae");
  const PIR = nv(values, "PIR");
  const Kh = nv(values, "Kh", 0.3);
  const Kv = nv(values, "Kv", 0.21);
  const yPa = nv(values, "yPa", H / 3);
  const yPae = nv(values, "yPae", 0.6 * H);
  const yW = nv(values, "yW", H / 2);
  const Wtot = nv(values, "Wtot");
  const nulo = dPae < 0.05;

  const W = 880;
  const Ht = 560;
  const padL = 78;
  const padB = 72;
  const sc = Math.min(340 / Math.max(B, 2.2), 380 / Math.max(H + Math.max(0, nv(values, "hk")), 2.6));
  const sx = sc;
  const sy = sc;
  const x0 = padL;
  const yBot = Ht - padB;
  const g = wallPts(values, { sx, sy, x0, yBot });
  const yCg = yBot - yW * sy;
  const xCg = g.xP + Math.min(Math.max(nv(values, "xBar", B / 2), 0.1), g.B) * sx;
  const yPaPx = yBot - yPa * sy;
  const yPaePx = yBot - yPae * sy;

  return (
    <div className="croquis croquis-didactica" data-fig-part="sismo">
      <div className="croquis-head">
        <p>Aplicación de las acciones sísmicas — posiciones</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={`0 0 ${W} ${Ht}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="sis-kh" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={SEIS} />
            </marker>
            <marker id="sis-kv" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={WGT} />
            </marker>
            <pattern id="sis-conc" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#d9d2c3" />
              <circle cx="2" cy="3" r="0.55" fill="#6b6458" />
            </pattern>
            <pattern id="sis-soil" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M0 8 H10 M2 4 H8" stroke="#b7a57a" strokeWidth="0.7" fill="none" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={W} height={Ht} fill="#f7f3ea" />
          <text x={W / 2} y="22" textAnchor="middle" fontSize="13" fill={INK} fontWeight="600" fontFamily={FONT}>
            Pseudo-estática · franja 1,00 m · cotas desde la base
          </text>
          <polygon
            points={`${g.xSB},${g.yBase} ${g.xH},${g.yBase} ${g.xH},${g.yTop - 10} ${g.xTopB},${g.yTop}`}
            fill="url(#sis-soil)"
            opacity="0.85"
          />
          <polygon points={g.wall} fill="url(#sis-conc)" stroke={INK} strokeWidth="1.8" />

          <CargaDistribuida
            id="sis-pa"
            x0={g.xTopB}
            y0={g.yTop}
            xFace1={g.xSB}
            y1={g.yBot}
            w0={8}
            w1={38}
            toward="left"
            offset={18}
            color={LOAD}
            fillOpacity={0.1}
            arrows={6}
          />
          <CargaDistribuida
            id="sis-dpae"
            x0={g.xTopB}
            y0={g.yTop}
            xFace1={g.xSB}
            y1={g.yBot}
            w0={nulo ? 22 : 10}
            w1={nulo ? 10 : 46}
            toward="left"
            offset={64}
            color={SEIS}
            fillOpacity={nulo ? 0.04 : 0.14}
            strokeDasharray={nulo ? "5,3" : undefined}
            arrows={6}
          />

          <line x1={g.xP - 36} y1={yPaPx} x2={g.xP - 8} y2={yPaPx} stroke={LOAD} strokeWidth="1" strokeDasharray="3,2" />
          <text x={g.xP - 40} y={yPaPx + 3} textAnchor="end" fontSize="9" fill={LOAD} fontFamily={FONT}>
            H/3
          </text>
          <line x1={g.xH + 8} y1={yPaePx} x2={g.xH + 118} y2={yPaePx} stroke={SEIS} strokeWidth="1" strokeDasharray="3,2" />
          <text x={g.xH + 122} y={yPaePx + 3} fontSize="9" fill={SEIS} fontFamily={FONT}>
            0,6 H
          </text>

          <circle cx={xCg} cy={yCg} r="6" fill="#f7f3ea" stroke={WGT} strokeWidth="1.4" />
          <line x1={xCg - 6} y1={yCg} x2={xCg + 6} y2={yCg} stroke={WGT} strokeWidth="1.1" />
          <line x1={xCg} y1={yCg - 6} x2={xCg} y2={yCg + 6} stroke={WGT} strokeWidth="1.1" />
          <Arrow x1={xCg + 10} y1={yCg} x2={xCg - 54} y2={yCg} color={SEIS} marker="sis-kh" width={2.4} />
          <text x={xCg - 58} y={yCg - 8} textAnchor="end" fontSize="10" fill={SEIS} fontWeight="700" fontFamily={FONT}>
            PIR = Kh·W
          </text>
          <text x={xCg - 58} y={yCg + 6} textAnchor="end" fontSize="9" fill={SEIS} fontFamily={FONT}>
            {`ȳ = ${yW.toFixed(2)} m`}
          </text>
          <Arrow x1={xCg} y1={yCg - 8} x2={xCg} y2={yCg + 42} color={WGT} marker="sis-kv" width={2} />
          <text x={xCg + 10} y={yCg + 38} fontSize="9" fill={WGT} fontFamily={FONT}>
            Kv·W (alivio)
          </text>

          {(() => {
            const xCote = g.xP - 52;
            const ticks = [
              { y: g.yBot, t: "base" },
              { y: yPaPx, t: "H/3" },
              { y: yCg, t: "ȳ" },
              { y: yPaePx, t: "0,6 H" },
              { y: g.yTop, t: "H" },
            ];
            return (
              <g>
                <line x1={xCote} y1={g.yBot} x2={xCote} y2={g.yTop} stroke={INK} strokeWidth="1.15" />
                {ticks.map((tk) => (
                  <g key={tk.t}>
                    <line x1={xCote - 5} y1={tk.y} x2={xCote + 5} y2={tk.y} stroke={INK} strokeWidth="1.1" />
                    <text x={xCote - 8} y={tk.y - 4} textAnchor="end" fontSize="8.5" fill={INK} fontFamily={FONT}>
                      {tk.t}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}

          <Arrow x1={g.xH + 168} y1={yPaPx} x2={g.xH + 98} y2={yPaPx} color={LOAD} marker="sis-kh" width={2.6} />
          <text x={g.xH + 172} y={yPaPx - 6} fontSize="10" fill={LOAD} fontWeight="700" fontFamily={FONT}>
            {`Pa = ${Pa.toFixed(2)} t/ml`}
          </text>
          <text x={g.xH + 172} y={yPaPx + 8} fontSize="8.5" fill={LOAD} fontFamily={FONT}>
            resultante a H/3
          </text>
          <Arrow
            x1={g.xH + 168}
            y1={yPaePx}
            x2={g.xH + 98}
            y2={yPaePx}
            color={SEIS}
            marker="sis-kh"
            width={nulo ? 1.4 : 2.6}
          />
          <text x={g.xH + 172} y={yPaePx - 6} fontSize="10" fill={SEIS} fontWeight="700" fontFamily={FONT}>
            {nulo ? "ΔPae = 0" : `ΔPae = ${dPae.toFixed(2)} t/ml`}
          </text>
          <text x={g.xH + 172} y={yPaePx + 8} fontSize="8.5" fill={SEIS} fontFamily={FONT}>
            {nulo ? "Pae ≤ Pa · no hay incremento" : "resultante a 0,6 H"}
          </text>

          <Plate
            x={16}
            y={36}
            color={SEIS}
            lines={[
              `Kh = ${Kh.toFixed(3)}    Kv = ${Kv.toFixed(3)}`,
              `Pae = ${Pae.toFixed(2)} t/ml    Pa = ${Pa.toFixed(2)}`,
              nulo
                ? "ΔPae = 0  (Pae ≤ Pa: no hay incremento de tierra)"
                : `ΔPae = ${dPae.toFixed(2)} t/ml  en 0,6 H`,
              `PIR = ${PIR.toFixed(2)} t/ml  en el c.g. (ȳ)`,
              Wtot > 0 ? `W = ${Wtot.toFixed(2)} t/ml` : "W del metrado",
            ]}
          />
          <text x="16" y={Ht - 18} fontSize="9" fill="#5a4a28" fontFamily={FONT}>
            Pa se aplica a H/3. El incremento sísmico de tierra, si existe, a 0,6 H (COVENIN). La inercia PIR actúa en el centro de gravedad.
          </text>
        </svg>
      </div>
      <p className="croquis-cap">
        {nulo
          ? `ΔPae nulo porque Pae (${Pae.toFixed(2)}) ≤ Pa (${Pa.toFixed(2)}). Gobierna la inercia PIR = ${PIR.toFixed(2)} t/ml en ȳ = ${yW.toFixed(2)} m.`
          : `ΔPae = ${dPae.toFixed(2)} t/ml a 0,6 H = ${yPae.toFixed(2)} m · PIR = ${PIR.toFixed(2)} t/ml en ȳ = ${yW.toFixed(2)} m.`}
      </p>
    </div>
  );
}

/** Posiciones sísmicas del estribo tipo pantalla: Pa a H/3, ΔPae a 0,6 H, PIR en el c.g. */
export function SismoEstriboFig({ values }: { values: Record<string, string> }) {
  const g = geoEstriboPantalla(values);
  const H = g.H;
  const B = g.B;
  const Pa = nv(values, "Pa");
  const Pae = nv(values, "Pae");
  const dPae = nv(values, "dPae");
  const PIR = nv(values, "PIR");
  const Kh = nv(values, "Kh", 0.18);
  const Kv = nv(values, "Kv", 0);
  const yPa = nv(values, "yPa", H / 3);
  const yPae = nv(values, "yPae", 0.6 * H);
  const yW = nv(values, "yW", H / 2);
  const Wtot = nv(values, "Wtot");
  const nulo = dPae < 0.05;

  const W = 920;
  const Ht = 580;
  const padL = 88;
  const padB = 76;
  const sc = Math.min(360 / Math.max(B, 2.2), 400 / Math.max(H, 3));
  const xA = padL + B * sc;
  const yBot = Ht - padB;
  const xy = (xa: number, h: number) => ({ x: xA - xa * sc, y: yBot - h * sc });
  const wall = g.wall.map(([xa, h]) => `${xy(xa, h).x},${xy(xa, h).y}`).join(" ");
  const yTop = xy(0, H).y;
  const xFill = xy(g.xaFill, H).x;
  const xHeel = xy(B, g.D).x;
  const yBase = xy(0, g.D).y;
  const yPaPx = yBot - yPa * sc;
  const yPaePx = yBot - yPae * sc;
  const yCg = yBot - yW * sc;
  const xCg = xy(Math.min(Math.max(nv(values, "xBar", B / 2), 0.1), B), 0).x;

  return (
    <div className="croquis croquis-didactica" data-fig-part="sismo">
      <div className="croquis-head">
        <p>Aplicación de las acciones sísmicas — estribo tipo pantalla</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={`0 0 ${W} ${Ht}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="sis-est-kh" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={SEIS} />
            </marker>
            <marker id="sis-est-kv" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={WGT} />
            </marker>
            <pattern id="sis-est-conc" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#d9d2c3" />
              <circle cx="2" cy="3" r="0.55" fill="#6b6458" />
            </pattern>
            <pattern id="sis-est-soil" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M0 8 H10 M2 4 H8" stroke="#b7a57a" strokeWidth="0.7" fill="none" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={W} height={Ht} fill="#f7f3ea" />
          <text x={W / 2} y="22" textAnchor="middle" fontSize="13" fill={INK} fontWeight="600" fontFamily={FONT}>
            Pseudo-estática · franja 1,00 m · Pa a H/3 · ΔPae a 0,6 H · PIR en ȳ
          </text>
          <polygon
            points={`${xHeel},${yBase} ${xy(B, 0).x},${yBot} ${xy(B + 0.35, H).x},${yTop - 8} ${xy(g.xaFill, H).x},${yTop}`}
            fill="url(#sis-est-soil)"
            opacity="0.85"
          />
          <polygon points={wall} fill="url(#sis-est-conc)" stroke={INK} strokeWidth="1.8" />

          <CargaDistribuida
            id="sis-est-pa"
            x0={xFill}
            y0={yTop}
            xFace1={xy(g.xaBack, g.D).x}
            y1={yBot}
            w0={8}
            w1={38}
            toward="right"
            offset={18}
            color={LOAD}
            fillOpacity={0.1}
            arrows={6}
          />
          <CargaDistribuida
            id="sis-est-dpae"
            x0={xFill}
            y0={yTop}
            xFace1={xy(g.xaBack, g.D).x}
            y1={yBot}
            w0={nulo ? 22 : 10}
            w1={nulo ? 10 : 46}
            toward="right"
            offset={64}
            color={SEIS}
            fillOpacity={nulo ? 0.04 : 0.14}
            strokeDasharray={nulo ? "5,3" : undefined}
            arrows={6}
          />

          <line x1={xy(0, 0).x + 8} y1={yPaPx} x2={xy(0, 0).x + 118} y2={yPaPx} stroke={LOAD} strokeWidth="1" strokeDasharray="3,2" />
          <text x={xy(0, 0).x + 122} y={yPaPx + 3} fontSize="9" fill={LOAD} fontFamily={FONT}>
            H/3
          </text>
          <line x1={xHeel - 8} y1={yPaePx} x2={xHeel - 118} y2={yPaePx} stroke={SEIS} strokeWidth="1" strokeDasharray="3,2" />
          <text x={xHeel - 122} y={yPaePx + 3} textAnchor="end" fontSize="9" fill={SEIS} fontFamily={FONT}>
            0,6 H
          </text>

          <circle cx={xCg} cy={yCg} r="6" fill="#f7f3ea" stroke={WGT} strokeWidth="1.4" />
          <line x1={xCg - 6} y1={yCg} x2={xCg + 6} y2={yCg} stroke={WGT} strokeWidth="1.1" />
          <line x1={xCg} y1={yCg - 6} x2={xCg} y2={yCg + 6} stroke={WGT} strokeWidth="1.1" />
          <Arrow x1={xCg - 10} y1={yCg} x2={xCg + 54} y2={yCg} color={SEIS} marker="sis-est-kh" width={2.4} />
          <text x={xCg + 58} y={yCg - 8} fontSize="10" fill={SEIS} fontWeight="700" fontFamily={FONT}>
            PIR = Kh·W
          </text>
          <text x={xCg + 58} y={yCg + 6} fontSize="9" fill={SEIS} fontFamily={FONT}>
            {`ȳ = ${yW.toFixed(2)} m`}
          </text>
          {Kv > 0.001 ? (
            <>
              <Arrow x1={xCg} y1={yCg - 8} x2={xCg} y2={yCg + 42} color={WGT} marker="sis-est-kv" width={2} />
              <text x={xCg + 10} y={yCg + 38} fontSize="9" fill={WGT} fontFamily={FONT}>
                Kv·W (alivio)
              </text>
            </>
          ) : null}

          {(() => {
            const xCote = xy(B, 0).x - 28;
            const ticks = [
              { y: yBot, t: "base" },
              { y: yPaPx, t: "H/3" },
              { y: yCg, t: "ȳ" },
              { y: yPaePx, t: "0,6 H" },
              { y: yTop, t: "H" },
            ];
            return (
              <g>
                <line x1={xCote} y1={yBot} x2={xCote} y2={yTop} stroke={INK} strokeWidth="1.15" />
                {ticks.map((tk) => (
                  <g key={tk.t}>
                    <line x1={xCote - 5} y1={tk.y} x2={xCote + 5} y2={tk.y} stroke={INK} strokeWidth="1.1" />
                    <text x={xCote - 8} y={tk.y - 4} textAnchor="end" fontSize="8.5" fill={INK} fontFamily={FONT}>
                      {tk.t}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}

          <Arrow x1={xy(0, 0).x + 168} y1={yPaPx} x2={xy(0, 0).x + 98} y2={yPaPx} color={LOAD} marker="sis-est-kh" width={2.6} />
          <text x={xy(0, 0).x + 172} y={yPaPx - 6} fontSize="10" fill={LOAD} fontWeight="700" fontFamily={FONT}>
            {`Pa = ${Pa.toFixed(2)} t/m`}
          </text>
          <text x={xy(0, 0).x + 172} y={yPaPx + 8} fontSize="8.5" fill={LOAD} fontFamily={FONT}>
            EH1X · resultante a H/3
          </text>
          <Arrow
            x1={xy(0, 0).x + 168}
            y1={yPaePx}
            x2={xy(0, 0).x + 98}
            y2={yPaePx}
            color={SEIS}
            marker="sis-est-kh"
            width={nulo ? 1.4 : 2.6}
          />
          <text x={xy(0, 0).x + 172} y={yPaePx - 6} fontSize="10" fill={SEIS} fontWeight="700" fontFamily={FONT}>
            {nulo ? "ΔPae = 0" : `ΔPae = ${dPae.toFixed(2)} t/m`}
          </text>
          <text x={xy(0, 0).x + 172} y={yPaePx + 8} fontSize="8.5" fill={SEIS} fontFamily={FONT}>
            {nulo ? "PAE ≤ EH1X · no hay incremento" : "EQterr a 0,6 H"}
          </text>

          <Plate
            x={16}
            y={36}
            color={SEIS}
            lines={[
              `Kh = ${Kh.toFixed(3)}    Kv = ${Kv.toFixed(3)}`,
              `PAE = ${Pae.toFixed(2)} t/m    Pa = ${Pa.toFixed(2)}`,
              nulo
                ? "ΔPae = 0  (PAE ≤ EH1X: no hay incremento de tierra)"
                : `ΔPae = ${dPae.toFixed(2)} t/m  en 0,6 H`,
              `PIR = ${PIR.toFixed(2)} t/m  en el c.g. (ȳ)`,
              Wtot > 0 ? `W = ${Wtot.toFixed(2)} t/m` : "W = DCestr + EV",
            ]}
          />
          <text x="16" y={Ht - 18} fontSize="9" fill="#5a4a28" fontFamily={FONT}>
            Igual criterio que el muro de contención: Pa a H/3, ΔPae a 0,6 H (si existe) y PIR = Kh·W en el centro de gravedad.
          </text>
        </svg>
      </div>
      <p className="croquis-cap">
        {nulo
          ? `ΔPae nulo porque PAE (${Pae.toFixed(2)}) ≤ EH1X (${Pa.toFixed(2)}). Gobierna la inercia PIR = ${PIR.toFixed(2)} t/m en ȳ = ${yW.toFixed(2)} m.`
          : `ΔPae = ${dPae.toFixed(2)} t/m a 0,6 H = ${yPae.toFixed(2)} m · PIR = ${PIR.toFixed(2)} t/m en ȳ = ${yW.toFixed(2)} m.`}
      </p>
    </div>
  );
}

/** Prediseño del dentellón: plano de deslizamiento, Pp y cotas bk × hk. */
export function DentellonMuroFig({ values }: { values: Record<string, string> }) {
  const H = Math.max(0.8, nv(values, "H", 4));
  const B = Math.max(1.2, nv(values, "B", 3.6));
  const D = Math.max(0.15, nv(values, "D", 0.8));
  const hk = Math.max(0, nv(values, "hk", 0));
  const bk = Math.max(0, nv(values, "bk", nv(values, "F", 0.4)));
  const PpKey = nv(values, "PpKey");
  const asLlave = String(values.asLlave ?? "");
  const hkPre = nv(values, "hkPre", Math.max(0.3, nv(values, "esp", 0.4)));
  const FSd0 = nv(values, "FSd0", nv(values, "FSdSin", 0));
  const FSd = nv(values, "FSd");
  const FSdEq = nv(values, "FSdEq");
  const FS_desl = nv(values, "FSdesl", 1.5);
  const hay = hk > 0.02;

  const W = 880;
  const Ht = 580;
  const sc = Math.min(360 / Math.max(B, 2.2), 400 / Math.max(H + Math.max(hk, 0.35), 2.8));
  const sx = sc;
  const sy = sc;
  const x0 = 118;
  const yBot = 430;
  const g = wallPts(values, { sx, sy, x0, yBot });
  const yFront = yBot - Math.min(D, H) * sy;
  const yPlane0 = g.yBot;
  const yPlane1 = hay ? g.yKey : g.yBot;

  return (
    <div className="croquis croquis-didactica" data-fig-part="dentellon">
      <div className="croquis-head">
        <p>Dentellón (taco) — prediseño y plano de deslizamiento</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={`0 0 ${W} ${Ht}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="den-pp" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#1f6b3a" />
            </marker>
            <pattern id="den-conc" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#d9d2c3" />
              <circle cx="2.2" cy="3.4" r="0.6" fill="#6b6458" />
            </pattern>
            <pattern id="den-soil" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
              <rect width="9" height="9" fill="#d8c9a6" />
              <line x1="0" y1="0" x2="0" y2="9" stroke="#8a7344" strokeWidth="0.65" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={W} height={Ht} fill="#f7f3ea" />
          <text x={W / 2} y="22" textAnchor="middle" fontSize="13" fill={INK} fontWeight="600" fontFamily={FONT}>
            {hay ? "Llave bajo el fuste · el plano baja a D+hk" : "Sin llave · el plano queda en la cara inferior de la zapata"}
          </text>
          <polygon points={`${g.xP - 40},${yFront} ${g.xP},${yFront} ${g.xP},${yPlane1} ${g.xP - 40},${yPlane1}`} fill="url(#den-soil)" />
          <line x1={g.xP - 28} y1={yFront} x2={g.xP - 28} y2={g.yBot} stroke={INK} strokeWidth="1.1" />
          <text x={g.xP - 32} y={(yFront + g.yBot) / 2} textAnchor="end" fontSize="10" fill={INK} fontFamily="IBM Plex Mono, monospace">
            {`D = ${D.toFixed(2)} m`}
          </text>
          <polygon
            points={`${g.xSB},${g.yBase} ${g.xH + 20},${g.yBase} ${g.xH + 20},${g.yTop - 8} ${g.xTopB},${g.yTop}`}
            fill="url(#den-soil)"
            opacity="0.7"
          />
          <polygon points={g.wall} fill="url(#den-conc)" stroke={INK} strokeWidth="1.85" />
          <line x1={g.xP - 48} y1={yPlane1} x2={g.xH + 28} y2={yPlane1} stroke="#8b1e1e" strokeWidth="1.6" strokeDasharray="7,4" />
          <text x={g.xH + 32} y={yPlane1 + 4} fontSize="10" fill={FLEX} fontWeight="700" fontFamily={FONT}>
            {hay ? "plano D+hk" : "plano en D"}
          </text>
          {hay ? (
            <line x1={g.xP - 48} y1={yPlane0} x2={g.xSF - 4} y2={yPlane0} stroke="#5a4a28" strokeWidth="1" strokeDasharray="3,3" />
          ) : null}

          {hay ? (
            <>
              <Arrow x1={g.xSF - 70} y1={(g.yBot + g.yKey) / 2} x2={g.xSF - 6} y2={(g.yBot + g.yKey) / 2} color="#1f6b3a" marker="den-pp" />
              <text x={g.xSF - 74} y={(g.yBot + g.yKey) / 2 - 8} textAnchor="end" fontSize="10" fill="#1f6b3a" fontWeight="700" fontFamily={FONT}>
                Pp
              </text>
              <text x={g.xSF - 74} y={(g.yBot + g.yKey) / 2 + 6} textAnchor="end" fontSize="9" fill="#1f6b3a" fontFamily={FONT}>
                ½ Kp γ (D+hk)²
              </text>
              <text x={(g.xSF + g.xKeyR) / 2} y={(g.yBot + g.yKey) / 2 + 4} textAnchor="middle" fontSize="11" fill={FLEX} fontWeight="700" fontFamily={FONT}>
                Dentellón
              </text>
              <line x1={g.xSF} y1={g.yKey + 18} x2={g.xKeyR} y2={g.yKey + 18} stroke={INK} strokeWidth="1.1" />
              <text x={(g.xSF + g.xKeyR) / 2} y={g.yKey + 32} textAnchor="middle" fontSize="10" fill={INK} fontFamily="IBM Plex Mono, monospace">
                {`bk = ${bk.toFixed(2)} m`}
              </text>
              <line x1={g.xKeyR + 16} y1={g.yKey} x2={g.xKeyR + 16} y2={g.yBot} stroke={INK} strokeWidth="1.1" />
              <text x={g.xKeyR + 22} y={(g.yBot + g.yKey) / 2 + 4} fontSize="10" fill={INK} fontFamily="IBM Plex Mono, monospace">
                {`hk = ${hk.toFixed(2)} m`}
              </text>
            </>
          ) : (
            <text x={g.xSF} y={g.yBot + 28} fontSize="11" fill="#5a4a28" fontFamily={FONT}>
              No se dispone dentellón: FS_d ya cumple.
            </text>
          )}

          <Plate
            x={W - 16}
            y={40}
            anchor="end"
            color={hay ? FLEX : INK}
            lines={
              hay
                ? [
                    "Predimensionamiento",
                    `bk = F = ${bk.toFixed(2)} m  (bajo el fuste)`,
                    `hk,pre = máx(e, 0,30) = ${hkPre.toFixed(2)} m`,
                    `hk adoptado = ${hk.toFixed(2)} m`,
                    `Sin llave  FS_d = ${FSd0.toFixed(2)}  <  ${FS_desl.toFixed(2)}`,
                    `Con llave  FS_d = ${FSd.toFixed(2)}    FS_d,sis = ${FSdEq.toFixed(2)}`,
                    PpKey > 0 ? `ΔPp = ${PpKey.toFixed(2)} t/ml  ·  ${asLlave || "acero U"}` : "ΔPp del pasivo extra",
                  ]
                : ["No requiere dentellón", `FS_d = ${FSd.toFixed(2)}  ≥  ${FS_desl.toFixed(2)}`, "El plano permanece en la zapata"]
            }
          />
          <text x="16" y={Ht - 16} fontSize="9" fill="#5a4a28" fontFamily={FONT}>
            El taco se coloca bajo el fuste, no bajo la puntera. Fuerza el deslizamiento a la base de la llave y suma su peso al W.
          </text>
        </svg>
      </div>
      <p className="croquis-cap">
        {hay
          ? `Dentellón ${bk.toFixed(2)} × ${hk.toFixed(2)} m bajo el fuste. Sin llave FS_d = ${FSd0.toFixed(2)}; con llave FS_d = ${FSd.toFixed(2)}.`
          : "Estabilidad al deslizamiento cumplida sin dentellón."}
      </p>
    </div>
  );
}
