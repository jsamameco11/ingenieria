import type { SeccionResult, VolumenResult } from "../lib/movtierras";
import { fmtPk } from "../lib/movtierras";

const ink = "#0b1f33";
const brass = "#8a6a32";
const cut = "#8b1e1e";
const fill = "#1f6b3a";

function poly(pts: { x: number; y: number }[]) {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

export function SeccionMovSvg({
  r,
  zr,
  B,
  nCorte,
  nRelleno,
  pkLabel,
}: {
  r: SeccionResult;
  zr: number;
  B: number;
  nCorte: number;
  nRelleno: number;
  pkLabel: string;
}) {
  const all = [...r.terreno, ...r.via];
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const xMin = Math.min(...xs) - 0.6;
  const xMax = Math.max(...xs) + 0.6;
  const yMin = Math.min(...ys) - 0.8;
  const yMax = Math.max(...ys) + 0.8;
  const W = 640;
  const H = 340;
  const padL = 54;
  const padR = 24;
  const padT = 36;
  const padB = 44;
  const xOf = (x: number) => padL + ((x - xMin) / Math.max(xMax - xMin, 0.5)) * (W - padL - padR);
  const yOf = (y: number) => padT + ((yMax - y) / Math.max(yMax - yMin, 0.5)) * (H - padT - padB);
  const to = (p: { x: number; y: number }) => ({ x: xOf(p.x), y: yOf(p.y) });
  const terr = r.terreno.map(to);
  const via = r.via.map(to);
  const groundFill = [
    ...terr,
    { x: terr[terr.length - 1].x, y: H - padB + 8 },
    { x: terr[0].x, y: H - padB + 8 },
  ];

  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <pattern id="hatchCut" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" stroke={cut} strokeWidth="1.2" />
          </pattern>
          <pattern id="hatchFill" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="7" stroke={fill} strokeWidth="1.2" />
          </pattern>
          <linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cbb892" />
            <stop offset="100%" stopColor="#a89068" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="#fbf8f1" />
        <text x="16" y="22" fill={ink} fontSize="13" fontFamily="IBM Plex Sans" fontWeight="600">
          Sección transversal {pkLabel}  ·  rasante {zr.toFixed(2)} m
        </text>

        <polygon points={poly(groundFill)} fill="url(#soilGrad)" opacity="0.35" />

        {r.franjas.map((f, i) => {
          const pts = [
            { x: xOf(f.x1), y: yOf(f.t1) },
            { x: xOf(f.x2), y: yOf(f.t2) },
            { x: xOf(f.x2), y: yOf(f.v2) },
            { x: xOf(f.x1), y: yOf(f.v1) },
          ];
          return (
            <polygon
              key={i}
              points={poly(pts)}
              fill={f.kind === "corte" ? "url(#hatchCut)" : "url(#hatchFill)"}
              opacity="0.85"
            />
          );
        })}

        <polyline points={poly(terr)} fill="none" stroke="#6b5344" strokeWidth="2.4" />
        <polyline points={poly(via)} fill="none" stroke={ink} strokeWidth="2.6" />

        <line
          x1={xOf(r.pavL.x)}
          y1={yOf(r.pavL.y)}
          x2={xOf(r.pavR.x)}
          y2={yOf(r.pavR.y)}
          stroke="#2c2c2c"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <line
          x1={xOf(0)}
          y1={yOf(yMin)}
          x2={xOf(0)}
          y2={yOf(yMax)}
          stroke={brass}
          strokeDasharray="4 3"
          strokeWidth="1"
        />

        <circle cx={xOf(0)} cy={yOf(zr)} r="3.5" fill={brass} />
        <text x={xOf(0) + 6} y={yOf(zr) - 8} fontSize="10" fill={brass} fontFamily="IBM Plex Sans">
          eje
        </text>

        <line x1={xOf(r.pavL.x)} y1={H - 28} x2={xOf(r.pavR.x)} y2={H - 28} stroke={brass} strokeWidth="1" />
        <text x={(xOf(r.pavL.x) + xOf(r.pavR.x)) / 2} y={H - 14} textAnchor="middle" fontSize="11" fill={brass} fontFamily="IBM Plex Sans">
          {`B = ${B.toFixed(2)} m`}
        </text>

        <text x={xOf(r.catchL.x) + 8} y={yOf(r.catchL.y) - 6} fontSize="10" fill={r.catchL.y >= r.pavL.y ? cut : fill} fontFamily="IBM Plex Sans">
          {r.catchL.y >= r.pavL.y ? `talud corte ${nCorte}:1` : `talud relleno ${nRelleno}:1`}
        </text>
        <text x={xOf(r.catchR.x) - 8} y={yOf(r.catchR.y) - 6} textAnchor="end" fontSize="10" fill={r.catchR.y >= r.pavR.y ? cut : fill} fontFamily="IBM Plex Sans">
          {r.catchR.y >= r.pavR.y ? `talud corte ${nCorte}:1` : `talud relleno ${nRelleno}:1`}
        </text>

        <g fontFamily="IBM Plex Sans" fontSize="11">
          <rect x="16" y="40" width="12" height="10" fill="url(#hatchCut)" stroke={cut} />
          <text x="32" y="49" fill={cut}>{`Corte Ac = ${r.Ac.toFixed(2)} m²`}</text>
          <rect x="16" y="56" width="12" height="10" fill="url(#hatchFill)" stroke={fill} />
          <text x="32" y="65" fill={fill}>{`Relleno Ar = ${r.Ar.toFixed(2)} m²`}</text>
        </g>
      </svg>
    </div>
  );
}

export function DiagramaMasasSvg({ r }: { r: VolumenResult }) {
  const pts = r.masas;
  const W = 640;
  const H = 280;
  const padL = 58;
  const padR = 20;
  const padT = 36;
  const padB = 40;
  if (pts.length < 2) {
    return (
      <div className="diagram">
        <svg viewBox={`0 0 ${W} ${H}`}>
          <rect width={W} height={H} fill="#fbf8f1" />
          <text x="24" y="40" fill={ink} fontFamily="IBM Plex Sans">
            Ingrese al menos dos estaciones para el diagrama de masas.
          </text>
        </svg>
      </div>
    );
  }
  const pks = pts.map((p) => p.pk);
  const Ms = pts.map((p) => p.Madj);
  const xMin = Math.min(...pks);
  const xMax = Math.max(...pks);
  const yMin = Math.min(0, ...Ms);
  const yMax = Math.max(0, ...Ms);
  const yPad = Math.max(20, (yMax - yMin) * 0.08);
  const y0 = yMin - yPad;
  const y1 = yMax + yPad;
  const xOf = (x: number) => padL + ((x - xMin) / Math.max(xMax - xMin, 1)) * (W - padL - padR);
  const yOf = (y: number) => padT + ((y1 - y) / Math.max(y1 - y0, 1)) * (H - padT - padB);
  const line = pts.map((p) => `${xOf(p.pk).toFixed(1)},${yOf(p.Madj).toFixed(1)}`).join(" ");
  const areaPts = [`${xOf(pts[0].pk).toFixed(1)},${yOf(0).toFixed(1)}`, line, `${xOf(pts[pts.length - 1].pk).toFixed(1)},${yOf(0).toFixed(1)}`].join(" ");

  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <rect width={W} height={H} fill="#fbf8f1" />
        <text x="16" y="22" fill={ink} fontSize="13" fontFamily="IBM Plex Sans" fontWeight="600">
          Diagrama de masas (Brückner)  ·  Σ(Vc·Fc − Vr)
        </text>
        <polygon points={areaPts} fill="#c4a05622" />
        <line x1={padL} y1={yOf(0)} x2={W - padR} y2={yOf(0)} stroke={brass} strokeWidth="1.2" />
        <polyline points={line} fill="none" stroke={ink} strokeWidth="2.2" />
        {pts.map((p, i) => (
          <circle key={i} cx={xOf(p.pk)} cy={yOf(p.Madj)} r="3" fill={p.Madj >= 0 ? cut : fill} />
        ))}
        <text x={padL - 8} y={yOf(0) + 4} textAnchor="end" fontSize="10" fill={brass} fontFamily="IBM Plex Sans">
          0
        </text>
        <text x={(padL + W - padR) / 2} y={H - 10} textAnchor="middle" fontSize="11" fill={brass} fontFamily="IBM Plex Sans">
          {`${fmtPk(xMin)}  →  ${fmtPk(xMax)}`}
        </text>
        <text x="14" y={H / 2} fontSize="10" fill={brass} fontFamily="IBM Plex Sans" transform={`rotate(-90 14 ${H / 2})`}>
          masa acumulada (m³)
        </text>
        <text x={W - padR} y={yOf(0) - 8} textAnchor="end" fontSize="10" fill={cut} fontFamily="IBM Plex Sans">
          exceso de corte
        </text>
        <text x={W - padR} y={yOf(0) + 16} textAnchor="end" fontSize="10" fill={fill} fontFamily="IBM Plex Sans">
          déficit (préstamo)
        </text>
      </svg>
    </div>
  );
}
