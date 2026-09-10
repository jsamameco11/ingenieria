import type { ReactNode } from "react";

const NAVY = "#1a4473";
const INK = "#4a4030";

function nv(values: Record<string, string>, key: string, fb: number) {
  const s = String(values[key] ?? "").trim();
  if (s === "") return fb;
  const x = Number(s.replace(",", "."));
  return Number.isFinite(x) ? x : fb;
}

function Defs() {
  return (
    <defs>
      <pattern id="tq-conc" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#d9d2c3" />
        <circle cx="2" cy="3" r="0.6" fill="#6b6458" />
        <circle cx="6" cy="6" r="0.5" fill="#6b6458" />
      </pattern>
      <pattern id="tq-water" width="14" height="10" patternUnits="userSpaceOnUse">
        <rect width="14" height="10" fill="#c9dce8" />
        <path d="M0 5 Q3.5 2 7 5 T14 5" fill="none" stroke="#4a7a96" strokeWidth="0.9" />
      </pattern>
      <pattern id="tq-soil" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#cbb892" />
        <path d="M0 10 Q5 4 10 10" fill="none" stroke="#8a7344" strokeWidth="0.7" />
      </pattern>
    </defs>
  );
}

function Cota({ x1, y1, x2, y2, text, side = 16, vertical = false }: { x1: number; y1: number; x2: number; y2: number; text: string; side?: number; vertical?: boolean }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const s = Math.sign(side) || 1;
  const ox = nx * s * Math.abs(side), oy = ny * s * Math.abs(side);
  const a1x = x1 + ox, a1y = y1 + oy, a2x = x2 + ox, a2y = y2 + oy;
  const mx = (a1x + a2x) / 2, my = (a1y + a2y) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={a1x} y2={a1y} stroke={NAVY} strokeWidth="0.6" />
      <line x1={x2} y1={y2} x2={a2x} y2={a2y} stroke={NAVY} strokeWidth="0.6" />
      <line x1={a1x} y1={a1y} x2={a2x} y2={a2y} stroke={NAVY} strokeWidth="0.9" markerStart="url(#tq-tick)" markerEnd="url(#tq-tick)" />
      <text x={mx + (vertical ? 9 : 0)} y={my + (vertical ? 0 : -4)} fontSize="9" fill={NAVY} fontFamily="IBM Plex Mono, monospace" textAnchor="middle" transform={vertical ? `rotate(-90 ${mx + 9} ${my})` : undefined}>
        {text}
      </text>
    </g>
  );
}

function TickMarkers() {
  return (
    <marker id="tq-tick" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
      <line x1="0" y1="0" x2="6" y2="6" stroke={NAVY} strokeWidth="1.1" />
    </marker>
  );
}

function Frame({ caption, heading, layers }: { caption: string; heading: string; layers: { viewBox: string; children: ReactNode }[] }) {
  return (
    <div className="croquis">
      <div className="croquis-head">
        <p>{heading}</p>
      </div>
      <div className={`croquis-stage${layers.length > 1 ? " croquis-stage-stack" : ""}`}>
        {layers.map((l, i) => (
          <svg key={i} viewBox={l.viewBox} preserveAspectRatio="xMidYMid meet">
            <defs>
              <TickMarkers />
            </defs>
            <Defs />
            <rect x="0" y="0" width="9999" height="9999" fill="#fbf8f1" />
            {l.children}
          </svg>
        ))}
      </div>
      <p className="croquis-cap">{caption}</p>
    </div>
  );
}

/* ---------------- Reservorio apoyado ---------------- */

export function ReservorioApoyadoCroquis({ values }: { values: Record<string, string> }) {
  const D = nv(values, "D", 4.25);
  const HL = nv(values, "HL", 3.5);
  const bl = nv(values, "bl", 0.3);
  const tMuro = nv(values, "tMuro", 0.25);
  const tLosa = nv(values, "tLosa", 0.2);
  const fDomo = nv(values, "fDomo", 0.7);

  const W = 420, H = 340;
  const scale = 220 / Math.max(D + 2 * tMuro, HL + bl + fDomo + 0.5);
  const cx = W / 2;
  const baseY = 290;
  const rMuroPx = (D / 2) * scale;
  const tMuroPx = Math.max(3, tMuro * scale);
  const tLosaPx = Math.max(3, tLosa * scale);
  const HLpx = HL * scale;
  const blPx = bl * scale;
  const fDomoPx = Math.max(14, fDomo * scale);

  const yLosaTop = baseY - tLosaPx;
  const yMuroTop = yLosaTop - HLpx - blPx;
  const yAgua = yLosaTop - HLpx;
  const xIzq = cx - rMuroPx - tMuroPx;
  const xDer = cx + rMuroPx + tMuroPx;

  const domoPath = `M ${xIzq} ${yMuroTop} Q ${cx} ${yMuroTop - fDomoPx * 2} ${xDer} ${yMuroTop}`;

  const elevacion = (
    <g>
      <rect x={xIzq - 40} y={baseY} width={xDer - xIzq + 80} height="14" fill="url(#tq-soil)" stroke="#8a7344" strokeWidth="0.6" />
      <rect x={xIzq - 15} y={yLosaTop} width={xDer - xIzq + 30} height={tLosaPx} fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1" />
      <rect x={xIzq} y={yMuroTop} width={tMuroPx} height={yLosaTop - yMuroTop} fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1" />
      <rect x={xDer - tMuroPx} y={yMuroTop} width={tMuroPx} height={yLosaTop - yMuroTop} fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1" />
      <rect x={cx - rMuroPx} y={yAgua} width={rMuroPx * 2} height={yLosaTop - yAgua} fill="url(#tq-water)" />
      <path d={domoPath} fill="none" stroke={NAVY} strokeWidth="2.2" />
      <line x1={xIzq - 25} y1={yAgua} x2={xIzq} y2={yAgua} stroke="#2f6a8f" strokeWidth="1" strokeDasharray="3,2" />
      <text x={xIzq - 28} y={yAgua + 3} fontSize="8" fill="#2f6a8f" textAnchor="end">
        N.A.
      </text>
      <Cota x1={xIzq} y1={baseY + 22} x2={xDer} y2={baseY + 22} text={`D = ${D.toFixed(2)} m`} side={14} />
      <Cota x1={xDer + 26} y1={yAgua} x2={xDer + 26} y2={yLosaTop} text={`HL=${HL.toFixed(2)}`} side={16} vertical />
      <Cota x1={xDer + 26} y1={yMuroTop} x2={xDer + 26} y2={yAgua} text={`b.l.=${bl.toFixed(2)}`} side={16} vertical />
      <Cota x1={xIzq - 26} y1={yLosaTop} x2={xIzq - 26} y2={baseY} text={`e=${(tLosa * 100).toFixed(0)}cm`} side={-16} vertical />
      <text x={cx} y={yMuroTop - fDomoPx * 1.15} fontSize="8.5" fill={INK} textAnchor="middle">
        Cúpula e={(fDomo && nv(values, "tDomo", 0.08) * 100).toFixed(1)} cm
      </text>
      <text x={cx} y={20} fontSize="10.5" fill={NAVY} textAnchor="middle" fontWeight="600">
        Corte — reservorio apoyado
      </text>
    </g>
  );

  const rPlantaPx = rMuroPx * 0.72;
  const planta = (
    <g transform="translate(0,-4)">
      <circle cx={cx} cy={170} r={rPlantaPx + tMuroPx * 0.72} fill="none" stroke={NAVY} strokeWidth="1" strokeDasharray="2,2" />
      <circle cx={cx} cy={170} r={rPlantaPx} fill="url(#tq-water)" stroke={NAVY} strokeWidth="2" />
      <circle cx={cx} cy={170} r="3" fill={NAVY} />
      <line x1={cx} y1={170 - rPlantaPx - 22} x2={cx} y2={170 + rPlantaPx + 22} stroke={NAVY} strokeWidth="0.5" strokeDasharray="5,3" />
      <line x1={cx - rPlantaPx - 22} y1={170} x2={cx + rPlantaPx + 22} y2={170} stroke={NAVY} strokeWidth="0.5" strokeDasharray="5,3" />
      <Cota x1={cx - rPlantaPx} y1={170 + rPlantaPx + 34} x2={cx + rPlantaPx} y2={170 + rPlantaPx + 34} text={`D = ${D.toFixed(2)} m`} side={14} />
      <text x={cx} y={26} fontSize="10.5" fill={NAVY} textAnchor="middle" fontWeight="600">
        Planta
      </text>
    </g>
  );

  return (
    <Frame
      heading="Geometría del reservorio apoyado"
      caption={`D=${D.toFixed(2)} m · HL=${HL.toFixed(2)} m · e_muro=${(tMuro * 100).toFixed(1)} cm`}
      layers={[
        { viewBox: `0 0 ${W} ${H}`, children: elevacion },
        { viewBox: `0 0 ${W} 300`, children: planta },
      ]}
    />
  );
}

/* ---------------- Cuba INTZE (compartida entre tanques elevados) ---------------- */

function cubaIntzePaths(cx: number, baseY: number, scale: number, values: Record<string, string>) {
  const D = nv(values, "D", 8);
  const rp = nv(values, "rp", D * 0.3);
  const h1 = nv(values, "h1", 4);
  const hCono = nv(values, "hCono", 1.5);
  const fInf = nv(values, "fInf", rp / 3);
  const fSup = nv(values, "fSup", D / 5);

  const Rpx = (D / 2) * scale;
  const rpPx = (rp / 2) * scale;
  const h1px = h1 * scale;
  const hConoPx = hCono * scale;
  const fInfPx = Math.max(10, fInf * scale);
  const fSupPx = Math.max(14, fSup * scale);

  const yAnilloInf = baseY;
  const yAnilloSup = yAnilloInf - hConoPx;
  const yTechoBase = yAnilloSup - h1px;

  const path = [
    `M ${cx - rpPx} ${yAnilloInf}`,
    `Q ${cx} ${yAnilloInf + fInfPx * 2} ${cx + rpPx} ${yAnilloInf}`,
    `L ${cx + Rpx} ${yAnilloSup}`,
    `L ${cx + Rpx} ${yTechoBase}`,
    `Q ${cx} ${yTechoBase - fSupPx * 2} ${cx - Rpx} ${yTechoBase}`,
    `L ${cx - Rpx} ${yAnilloSup}`,
    `Z`,
  ].join(" ");

  const aguaTop = yAnilloSup - h1px * 0.92;
  return { Rpx, rpPx, h1px, hConoPx, fInfPx, fSupPx, yAnilloInf, yAnilloSup, yTechoBase, path, aguaTop, D, rp, h1, hCono, fInf, fSup };
}

function CubaIntzeElevacion({ values, cx = 210, baseY = 250, scale }: { values: Record<string, string>; cx?: number; baseY?: number; scale: number }) {
  const g = cubaIntzePaths(cx, baseY, scale, values);
  return (
    <g>
      <path d={g.path} fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1.6" />
      <rect x={cx - g.Rpx} y={g.aguaTop} width={g.Rpx * 2} height={g.yAnilloSup - g.aguaTop} fill="url(#tq-water)" opacity="0.85" />
      <rect x={cx - g.rpPx * 0.55} y={g.yAnilloInf} width={g.rpPx * 0.55} height={g.yAnilloInf - (g.yAnilloInf + g.fInfPx * 0.8)} fill="none" />
      <line x1={cx - g.rpPx - 6} y1={g.yAnilloInf} x2={cx + g.rpPx + 6} y2={g.yAnilloInf} stroke={NAVY} strokeWidth="2.4" />
      <line x1={cx - g.Rpx - 6} y1={g.yAnilloSup} x2={cx + g.Rpx + 6} y2={g.yAnilloSup} stroke={NAVY} strokeWidth="2.4" />
      <text x={cx + g.Rpx + 34} y={g.yAnilloSup + 3} fontSize="8" fill={INK}>
        Anillo superior
      </text>
      <text x={cx + g.rpPx + 34} y={g.yAnilloInf + 3} fontSize="8" fill={INK}>
        Anillo inferior
      </text>
      <text x={cx - g.Rpx - 8} y={g.yAnilloSup - 6} fontSize="8" fill={INK} textAnchor="end">
        Fondo cónico
      </text>
      <Cota x1={cx - g.Rpx} y1={g.yTechoBase - g.fSupPx * 2 - 20} x2={cx + g.Rpx} y2={g.yTechoBase - g.fSupPx * 2 - 20} text={`D=${g.D.toFixed(2)} m`} side={14} />
      <Cota x1={cx + g.Rpx + 60} y1={g.yTechoBase} x2={cx + g.Rpx + 60} y2={g.yAnilloSup} text={`h1=${g.h1.toFixed(2)}`} side={16} vertical />
      <Cota x1={cx + g.Rpx + 60} y1={g.yAnilloSup} x2={cx + g.Rpx + 60} y2={g.yAnilloInf} text={`hc=${g.hCono.toFixed(2)}`} side={16} vertical />
      <Cota x1={cx - g.rpPx} y1={g.yAnilloInf + g.fInfPx * 2 + 16} x2={cx + g.rpPx} y2={g.yAnilloInf + g.fInfPx * 2 + 16} text={`r'=${(g.rp).toFixed(2)} m`} side={12} />
    </g>
  );
}

function CubaIntzePlanta({ values, cx = 210, cy = 150, scale }: { values: Record<string, string>; cx?: number; cy?: number; scale: number }) {
  const D = nv(values, "D", 8);
  const rp = nv(values, "rp", D * 0.3);
  const Rpx = (D / 2) * scale;
  const rpPx = (rp / 2) * scale;
  return (
    <g>
      <circle cx={cx} cy={cy} r={Rpx} fill="url(#tq-water)" stroke={NAVY} strokeWidth="2" />
      <circle cx={cx} cy={cy} r={rpPx} fill="none" stroke={NAVY} strokeWidth="1" strokeDasharray="3,2" />
      <circle cx={cx} cy={cy} r="3" fill={NAVY} />
      <line x1={cx} y1={cy - Rpx - 20} x2={cx} y2={cy + Rpx + 20} stroke={NAVY} strokeWidth="0.5" strokeDasharray="5,3" />
      <line x1={cx - Rpx - 20} y1={cy} x2={cx + Rpx + 20} y2={cy} stroke={NAVY} strokeWidth="0.5" strokeDasharray="5,3" />
      <Cota x1={cx - Rpx} y1={cy + Rpx + 30} x2={cx + Rpx} y2={cy + Rpx + 30} text={`D = ${D.toFixed(2)} m`} side={14} />
    </g>
  );
}

/* ---------------- Tanque elevado sobre columnas ---------------- */

export function TanqueElevadoColumnasCroquis({ values }: { values: Record<string, string> }) {
  const D = nv(values, "D", 8);
  const h1 = nv(values, "h1", 4);
  const hCono = nv(values, "hCono", 1.5);
  const fSup = nv(values, "fSup", D / 5);
  const Htorre = nv(values, "Htorre", 14);
  const nCol = Math.max(4, Math.round(nv(values, "nCol", 6)));
  const dCol = nv(values, "dCol", 0.5);
  const nArr = Math.max(1, Math.round(nv(values, "nArr", 2)));
  const Rcol = nv(values, "Rcol", D * 0.41);
  const Dcim = nv(values, "Dcim", D * 1.15);

  const W = 460, H = 430;
  const totalAltura = h1 + hCono + fSup + Htorre + 1.5;
  const scale = 300 / Math.max(totalAltura, D * 1.1);
  const cx = W / 2;
  const baseY = 400;
  const cubaBaseY = baseY - Htorre * scale;
  const RcolPx = Rcol * scale;
  const dColPx = Math.max(4, dCol * scale);
  const DcimPx = (Dcim / 2) * scale;

  const nivelesY: number[] = [];
  for (let i = 1; i <= nArr; i++) nivelesY.push(cubaBaseY - (i / (nArr + 0.001)) * 0 + (baseY - cubaBaseY) * (1 - i / (nArr + 1)));

  const elevacion = (
    <g>
      <rect x={cx - DcimPx - 30} y={baseY} width={2 * (DcimPx + 30)} height="12" fill="url(#tq-soil)" stroke="#8a7344" strokeWidth="0.6" />
      <rect x={cx - DcimPx} y={baseY - 16} width={2 * DcimPx} height="16" fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1.2" />
      {Array.from({ length: nCol }).slice(0, Math.ceil(nCol / 2) + 1).map((_, i) => {
        const frac = nCol <= 2 ? 0.5 : i / (Math.ceil(nCol / 2));
        const x = cx - RcolPx + frac * 2 * RcolPx;
        return <rect key={i} x={x - dColPx / 2} y={cubaBaseY} width={dColPx} height={baseY - 16 - cubaBaseY} fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1" />;
      })}
      {nivelesY.map((y, i) => (
        <g key={i}>
          <line x1={cx - RcolPx} y1={y} x2={cx + RcolPx} y2={y} stroke={NAVY} strokeWidth="1.6" />
          <line x1={cx - RcolPx} y1={y} x2={cx + RcolPx} y2={y - 26} stroke={NAVY} strokeWidth="0.8" strokeDasharray="4,2" />
          <line x1={cx - RcolPx} y1={y - 26} x2={cx + RcolPx} y2={y} stroke={NAVY} strokeWidth="0.8" strokeDasharray="4,2" />
        </g>
      ))}
      <CubaIntzeElevacion values={values} cx={cx} baseY={cubaBaseY} scale={scale} />
      <Cota x1={cx - RcolPx} y1={baseY + 24} x2={cx + RcolPx} y2={baseY + 24} text={`2·Rcol=${(2 * Rcol).toFixed(2)} m`} side={14} />
      <Cota x1={cx + RcolPx + 60} y1={baseY - 16} x2={cx + RcolPx + 60} y2={cubaBaseY} text={`H torre=${Htorre.toFixed(2)}`} side={16} vertical />
      <text x={cx} y={20} fontSize="10.5" fill={NAVY} textAnchor="middle" fontWeight="600">
        Elevación — tanque elevado sobre columnas
      </text>
    </g>
  );

  const cy2 = 170;
  const planta = (
    <g>
      <circle cx={cx} cy={cy2} r={DcimPx} fill="none" stroke={NAVY} strokeWidth="1" strokeDasharray="3,2" />
      <circle cx={cx} cy={cy2} r={RcolPx} fill="none" stroke={NAVY} strokeWidth="1.4" />
      {Array.from({ length: nCol }).map((_, i) => {
        const ang = (2 * Math.PI * i) / nCol;
        const x = cx + RcolPx * Math.cos(ang);
        const y = cy2 + RcolPx * Math.sin(ang);
        return <circle key={i} cx={x} cy={y} r={Math.max(3, dColPx / 2)} fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1" />;
      })}
      <circle cx={cx} cy={cy2} r={(D / 2) * scale} fill="none" stroke={NAVY} strokeWidth="1" strokeDasharray="1,3" opacity="0.6" />
      <Cota x1={cx - RcolPx} y1={cy2 + RcolPx + 28} x2={cx + RcolPx} y2={cy2 + RcolPx + 28} text={`2·Rcol=${(2 * Rcol).toFixed(2)} m`} side={14} />
      <text x={cx} y={26} fontSize="10.5" fill={NAVY} textAnchor="middle" fontWeight="600">
        Planta — {nCol} columnas Ø{(dCol * 100).toFixed(0)} cm
      </text>
    </g>
  );

  return (
    <Frame
      heading="Geometría — tanque elevado sobre columnas"
      caption={`Cuba INTZE D=${D.toFixed(2)} m · Torre: ${nCol} columnas Ø${(dCol * 100).toFixed(0)} cm · H=${Htorre.toFixed(1)} m`}
      layers={[
        { viewBox: `0 0 ${W} ${H}`, children: elevacion },
        { viewBox: `0 0 ${W} 320`, children: planta },
      ]}
    />
  );
}

/* ---------------- Tanque elevado sobre fuste ---------------- */

export function TanqueElevadoFusteCroquis({ values }: { values: Record<string, string> }) {
  const D = nv(values, "D", 11);
  const h1 = nv(values, "h1", 5);
  const hCono = nv(values, "hCono", 2);
  const fSup = nv(values, "fSup", D / 5);
  const Htorre = nv(values, "Htorre", 16);
  const Dfuste = nv(values, "Dfuste", D * 0.55);
  const eFuste = nv(values, "eFuste", 0.25);
  const Dcim = nv(values, "Dcim", Dfuste * 1.8);

  const W = 420, H = 430;
  const totalAltura = h1 + hCono + fSup + Htorre + 1.5;
  const scale = 300 / Math.max(totalAltura, D * 1.1);
  const cx = W / 2;
  const baseY = 400;
  const cubaBaseY = baseY - Htorre * scale;
  const DfustePx = Dfuste * scale;
  const DcimPx = Dcim * scale;
  const eFustePx = Math.max(3, eFuste * scale);

  const elevacion = (
    <g>
      <rect x={cx - DcimPx / 2 - 30} y={baseY} width={DcimPx + 60} height="12" fill="url(#tq-soil)" stroke="#8a7344" strokeWidth="0.6" />
      <rect x={cx - DcimPx / 2} y={baseY - 18} width={DcimPx} height="18" fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1.2" />
      <rect x={cx - DfustePx / 2} y={cubaBaseY} width={DfustePx} height={baseY - 18 - cubaBaseY} fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1.4" />
      <line x1={cx - DfustePx / 2 + eFustePx} y1={cubaBaseY + 4} x2={cx - DfustePx / 2 + eFustePx} y2={baseY - 18} stroke="#8a7d63" strokeWidth="0.8" strokeDasharray="2,2" />
      <line x1={cx + DfustePx / 2 - eFustePx} y1={cubaBaseY + 4} x2={cx + DfustePx / 2 - eFustePx} y2={baseY - 18} stroke="#8a7d63" strokeWidth="0.8" strokeDasharray="2,2" />
      <CubaIntzeElevacion values={values} cx={cx} baseY={cubaBaseY} scale={scale} />
      <Cota x1={cx - DfustePx / 2} y1={baseY + 24} x2={cx + DfustePx / 2} y2={baseY + 24} text={`Ø fuste=${Dfuste.toFixed(2)} m`} side={14} />
      <Cota x1={cx + DfustePx / 2 + 40} y1={baseY - 18} x2={cx + DfustePx / 2 + 40} y2={cubaBaseY} text={`H torre=${Htorre.toFixed(2)}`} side={16} vertical />
      <Cota x1={cx - DfustePx / 2 - 40} y1={baseY - 18} x2={cx - DfustePx / 2 - 40} y2={baseY} text={`Dcim=${Dcim.toFixed(2)}`} side={-16} vertical />
      <text x={cx} y={20} fontSize="10.5" fill={NAVY} textAnchor="middle" fontWeight="600">
        Elevación — tanque elevado sobre fuste
      </text>
    </g>
  );

  const cy2 = 170;
  const planta = (
    <g>
      <circle cx={cx} cy={cy2} r={DcimPx / 2} fill="none" stroke={NAVY} strokeWidth="1" strokeDasharray="3,2" />
      <circle cx={cx} cy={cy2} r={DfustePx / 2} fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1.6" />
      <circle cx={cx} cy={cy2} r={DfustePx / 2 - eFustePx} fill="#fbf8f1" stroke={NAVY} strokeWidth="1" />
      <circle cx={cx} cy={cy2} r={(D / 2) * scale} fill="none" stroke={NAVY} strokeWidth="1" strokeDasharray="1,3" opacity="0.55" />
      <Cota x1={cx - DfustePx / 2} y1={cy2 + DfustePx / 2 + 28} x2={cx + DfustePx / 2} y2={cy2 + DfustePx / 2 + 28} text={`Ø ext=${Dfuste.toFixed(2)} m`} side={14} />
      <text x={cx} y={26} fontSize="10.5" fill={NAVY} textAnchor="middle" fontWeight="600">
        Planta — sección anular del fuste
      </text>
    </g>
  );

  return (
    <Frame
      heading="Geometría — tanque elevado sobre fuste"
      caption={`Cuba INTZE D=${D.toFixed(2)} m · Fuste Ø${Dfuste.toFixed(2)} m, e=${(eFuste * 100).toFixed(0)} cm · H=${Htorre.toFixed(1)} m`}
      layers={[
        { viewBox: `0 0 ${W} ${H}`, children: elevacion },
        { viewBox: `0 0 ${W} 320`, children: planta },
      ]}
    />
  );
}

export { CubaIntzePlanta };
