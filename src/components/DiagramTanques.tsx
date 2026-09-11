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

  const kApprox = 0.5523;
  const path = [
    `M ${cx - rpPx} ${yAnilloInf}`,
    `C ${cx - rpPx} ${yAnilloInf + fInfPx * kApprox * 2} ${cx + rpPx} ${yAnilloInf + fInfPx * kApprox * 2} ${cx + rpPx} ${yAnilloInf}`,
    `L ${cx + Rpx} ${yAnilloSup}`,
    `L ${cx + Rpx} ${yTechoBase}`,
    `C ${cx + Rpx} ${yTechoBase - fSupPx * kApprox * 2} ${cx - Rpx} ${yTechoBase - fSupPx * kApprox * 2} ${cx - Rpx} ${yTechoBase}`,
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
      <line x1={cx - g.rpPx - 6} y1={g.yAnilloInf} x2={cx + g.rpPx + 6} y2={g.yAnilloInf} stroke={NAVY} strokeWidth="2.4" />
      <line x1={cx - g.Rpx - 6} y1={g.yAnilloSup} x2={cx + g.Rpx + 6} y2={g.yAnilloSup} stroke={NAVY} strokeWidth="2.4" />
      <text x={cx - g.Rpx - 8} y={g.yAnilloSup - 5} fontSize="8" fill={INK} textAnchor="end">
        Anillo superior
      </text>
      <text x={cx - g.rpPx - 8} y={g.yAnilloInf - 5} fontSize="8" fill={INK} textAnchor="end">
        Anillo inferior
      </text>
      <text x={cx - g.Rpx - 8} y={(g.yAnilloSup + g.yTechoBase) / 2} fontSize="8" fill={INK} textAnchor="end">
        Fondo cónico
      </text>
      <Cota x1={cx - g.Rpx} y1={g.yTechoBase - g.fSupPx * 2 - 20} x2={cx + g.Rpx} y2={g.yTechoBase - g.fSupPx * 2 - 20} text={`D=${g.D.toFixed(2)} m`} side={14} />
      <Cota x1={cx + g.Rpx + 44} y1={g.yTechoBase} x2={cx + g.Rpx + 44} y2={g.yAnilloSup} text={`h1=${g.h1.toFixed(2)}`} side={16} vertical />
      <Cota x1={cx + g.Rpx + 44} y1={g.yAnilloSup} x2={cx + g.Rpx + 44} y2={g.yAnilloInf} text={`hc=${g.hCono.toFixed(2)}`} side={16} vertical />
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
  const hEntreCalc = Htorre / nArr;
  const Rcol = nv(values, "Rcol", D * 0.41);
  const RcolBase = nv(values, "RcolBase", Rcol * 1.35);
  const Dcim = nv(values, "Dcim", D * 1.15);

  const W = 460, H = 460;
  const totalAltura = h1 + hCono + fSup + Htorre + 1.5;
  const scale = 300 / Math.max(totalAltura, RcolBase * 2.1);
  const cx = W / 2;
  const baseY = 400;
  const cubaBaseY = baseY - Htorre * scale;
  const RcolPx = Rcol * scale;
  const RcolBasePx = RcolBase * scale;
  const dColPx = Math.max(4, dCol * scale);
  const DcimPx = (Dcim / 2) * scale;

  // Columnas abatidas: más separadas en la base, convergen al radio de la cuba en la corona (torre real, no paralela).
  const nVisible = Math.max(2, Math.ceil(nCol / 2) + 1);
  const yTop = cubaBaseY;
  const yBase = baseY - 16;
  const nivelesY: number[] = [yBase];
  for (let i = 1; i <= nArr; i++) nivelesY.push(yBase - (i / nArr) * (yBase - yTop));
  const colXPorNivel: number[][] = nivelesY.map((_, lvl) => {
    const Rlvl = RcolBasePx - (RcolBasePx - RcolPx) * (lvl / nArr);
    return Array.from({ length: nVisible }, (_, i) => {
      const t = nVisible === 1 ? 0.5 : i / (nVisible - 1);
      const ang = Math.PI * (1 - t);
      return cx + Rlvl * Math.cos(ang);
    });
  });

  const elevacion = (
    <g>
      <rect x={cx - DcimPx - 30} y={baseY} width={2 * (DcimPx + 30)} height="12" fill="url(#tq-soil)" stroke="#8a7344" strokeWidth="0.6" />
      <rect x={cx - DcimPx} y={baseY - 16} width={2 * DcimPx} height="16" fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1.2" />
      {/* Diagonales en X, por panel, entre columnas adyacentes visibles (siguen el abatimiento) */}
      {(() => {
        const panels: ReactNode[] = [];
        for (let lv = 0; lv < nivelesY.length - 1; lv++) {
          const yA = nivelesY[lv], yB = nivelesY[lv + 1];
          for (let c = 0; c < nVisible - 1; c++) {
            panels.push(
              <g key={`x-${lv}-${c}`}>
                <line x1={colXPorNivel[lv][c]} y1={yA} x2={colXPorNivel[lv + 1][c + 1]} y2={yB} stroke={NAVY} strokeWidth="1" strokeDasharray="5,2.5" opacity="0.85" />
                <line x1={colXPorNivel[lv][c + 1]} y1={yA} x2={colXPorNivel[lv + 1][c]} y2={yB} stroke={NAVY} strokeWidth="1" strokeDasharray="5,2.5" opacity="0.85" />
              </g>,
            );
          }
        }
        return panels;
      })()}
      {/* Vigas de anillo horizontales en cada nivel de arriostre */}
      {nivelesY.map((y, lvl) => (
        <line key={`beam-${lvl}`} x1={colXPorNivel[lvl][0]} y1={y} x2={colXPorNivel[lvl][nVisible - 1]} y2={y} stroke={NAVY} strokeWidth="2.2" />
      ))}
      {/* Columnas abatidas: un trapecio por tramo entre niveles, dibujadas al final para tapar las diagonales */}
      {Array.from({ length: nVisible }, (_, i) => (
        <g key={`col-${i}`}>
          {Array.from({ length: nivelesY.length - 1 }, (_, lv) => {
            const x1c = colXPorNivel[lv][i], y1c = nivelesY[lv];
            const x2c = colXPorNivel[lv + 1][i], y2c = nivelesY[lv + 1];
            const dx = x2c - x1c, dy = y2c - y1c;
            const len = Math.hypot(dx, dy) || 1;
            const nx = (-dy / len) * (dColPx / 2), ny = (dx / len) * (dColPx / 2);
            const poly = `${x1c - nx},${y1c - ny} ${x1c + nx},${y1c + ny} ${x2c + nx},${y2c + ny} ${x2c - nx},${y2c - ny}`;
            return <polygon key={lv} points={poly} fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1.1" />;
          })}
        </g>
      ))}
      <CubaIntzeElevacion values={values} cx={cx} baseY={cubaBaseY} scale={scale} />
      <Cota x1={colXPorNivel[0][0]} y1={baseY + 24} x2={colXPorNivel[0][nVisible - 1]} y2={baseY + 24} text={`2·Rcol,base=${(2 * RcolBase).toFixed(2)} m`} side={14} />
      <Cota x1={cx + RcolBasePx + 44} y1={baseY - 16} x2={cx + RcolBasePx + 44} y2={cubaBaseY} text={`H torre=${Htorre.toFixed(2)}`} side={16} vertical />
      <Cota x1={cx - RcolBasePx - 44} y1={yBase} x2={cx - RcolBasePx - 44} y2={nivelesY[1] ?? yTop} text={`h=${hEntreCalc.toFixed(2)}`} side={-16} vertical />
      <text x={cx} y={20} fontSize="10.5" fill={NAVY} textAnchor="middle" fontWeight="600">
        Elevación — tanque elevado sobre columnas
      </text>
      <text x={cx} y={baseY + 54} fontSize="8" fill={INK} textAnchor="middle">
        {nCol} columnas abatidas Ø{(dCol * 100).toFixed(0)} cm · {nArr} nivel(es) de arriostre con diagonales en X
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

/** Niveles de vigas de arriostre interiores del fuste, espaciadas 2.5-3.5 m (típico constructivo). */
function calcNivelesFuste(Htorre: number) {
  if (Htorre <= 3.6) return { n: 1, espac: Htorre };
  let n = Math.max(1, Math.round(Htorre / 3));
  let espac = Htorre / n;
  while (espac > 3.5 && n < 20) { n++; espac = Htorre / n; }
  while (espac < 2.5 && n > 1) { n--; espac = Htorre / n; }
  return { n, espac };
}

export function TanqueElevadoFusteCroquis({ values }: { values: Record<string, string> }) {
  const D = nv(values, "D", 11);
  const h1 = nv(values, "h1", 5);
  const hCono = nv(values, "hCono", 2);
  const fSup = nv(values, "fSup", D / 5);
  const Htorre = nv(values, "Htorre", 16);
  const Dfuste = nv(values, "Dfuste", D * 0.55);
  const eFuste = nv(values, "eFuste", 0.25);
  const Dcim = nv(values, "Dcim", Dfuste * 1.8);

  const W = 420, H = 460;
  const totalAltura = h1 + hCono + fSup + Htorre + 1.5;
  const scale = 300 / Math.max(totalAltura, D * 1.1);
  const cx = W / 2;
  const baseY = 400;
  const cubaBaseY = baseY - Htorre * scale;
  const DfustePx = Dfuste * scale;
  const DcimPx = Dcim * scale;
  const eFustePx = Math.max(3, eFuste * scale);
  const fusteTopY = cubaBaseY;
  const fusteBotY = baseY - 18;

  const { n: nVigas, espac: espacVigas } = calcNivelesFuste(Htorre);
  const nivelesVigaY: number[] = [];
  for (let i = 1; i < nVigas; i++) nivelesVigaY.push(fusteBotY - (i * espacVigas) * scale);
  const vigaEspesorPx = Math.max(5, DfustePx * 0.055);

  // Líneas verticales de encofrado (textura de fuste cilíndrico real) y escalera lateral.
  const nCostillas = 5;
  const costillasX = Array.from({ length: nCostillas }, (_, i) => cx - DfustePx / 2 + (DfustePx * (i + 1)) / (nCostillas + 1));

  const elevacion = (
    <g>
      <rect x={cx - DcimPx / 2 - 30} y={baseY} width={DcimPx + 60} height="12" fill="url(#tq-soil)" stroke="#8a7344" strokeWidth="0.6" />
      <rect x={cx - DcimPx / 2} y={fusteBotY} width={DcimPx} height="18" fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1.2" />
      {/* Fuste: pared cilíndrica de concreto con sombreado de borde (efecto tubo) */}
      <rect x={cx - DfustePx / 2} y={fusteTopY} width={DfustePx} height={fusteBotY - fusteTopY} fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1.6" />
      <rect x={cx - DfustePx / 2} y={fusteTopY} width={DfustePx * 0.12} height={fusteBotY - fusteTopY} fill={NAVY} opacity="0.14" />
      <rect x={cx + DfustePx / 2 - DfustePx * 0.12} y={fusteTopY} width={DfustePx * 0.12} height={fusteBotY - fusteTopY} fill={NAVY} opacity="0.14" />
      {costillasX.map((x, i) => (
        <line key={`rib-${i}`} x1={x} y1={fusteTopY + 3} x2={x} y2={fusteBotY - 3} stroke="#8a7d63" strokeWidth="0.5" opacity="0.55" />
      ))}
      <line x1={cx - DfustePx / 2 + eFustePx} y1={fusteTopY + 4} x2={cx - DfustePx / 2 + eFustePx} y2={fusteBotY} stroke="#8a7d63" strokeWidth="0.8" strokeDasharray="2,2" />
      <line x1={cx + DfustePx / 2 - eFustePx} y1={fusteTopY + 4} x2={cx + DfustePx / 2 - eFustePx} y2={fusteBotY} stroke="#8a7d63" strokeWidth="0.8" strokeDasharray="2,2" />
      {/* Escalera lateral exterior típica de fuste */}
      <line x1={cx + DfustePx / 2 + 6} y1={fusteTopY + 10} x2={cx + DfustePx / 2 + 6} y2={fusteBotY - 10} stroke={INK} strokeWidth="0.9" />
      {(() => {
        const nRungs = Math.max(3, Math.round((fusteBotY - fusteTopY) / 14));
        return Array.from({ length: nRungs }, (_, i) => {
          const y = fusteTopY + 10 + (i / (nRungs - 1)) * (fusteBotY - fusteTopY - 20);
          return <line key={`rung-${i}`} x1={cx + DfustePx / 2 + 3} y1={y} x2={cx + DfustePx / 2 + 9} y2={y} stroke={INK} strokeWidth="0.7" />;
        });
      })()}
      {/* Vigas de arriostre interiores (losas/anillos de rigidez), espaciadas 2.5-3.5 m */}
      {nivelesVigaY.map((y, i) => (
        <g key={`viga-${i}`}>
          <rect x={cx - DfustePx / 2 - 3} y={y - vigaEspesorPx / 2} width={DfustePx + 6} height={vigaEspesorPx} fill={NAVY} opacity="0.9" />
          <line x1={cx - DfustePx / 2 - 3} y1={y - vigaEspesorPx / 2} x2={cx - DfustePx / 2 - 14} y2={y - vigaEspesorPx / 2} stroke={NAVY} strokeWidth="0.7" strokeDasharray="2,2" />
          <text x={cx - DfustePx / 2 - 17} y={y - vigaEspesorPx / 2 + 2.5} fontSize="6.8" fill={INK} textAnchor="end">
            V.A. +{(Htorre - (fusteBotY - y) / scale).toFixed(1)}
          </text>
        </g>
      ))}
      <CubaIntzeElevacion values={values} cx={cx} baseY={cubaBaseY} scale={scale} />
      <Cota x1={cx - DfustePx / 2} y1={baseY + 24} x2={cx + DfustePx / 2} y2={baseY + 24} text={`Ø fuste=${Dfuste.toFixed(2)} m`} side={14} />
      <Cota x1={cx + DfustePx / 2 + 40} y1={fusteBotY} x2={cx + DfustePx / 2 + 40} y2={cubaBaseY} text={`H torre=${Htorre.toFixed(2)}`} side={16} vertical />
      {nVigas > 1 && (
        <Cota x1={cx - DfustePx / 2 - 44} y1={fusteBotY} x2={cx - DfustePx / 2 - 44} y2={nivelesVigaY[0]} text={`e=${espacVigas.toFixed(2)}`} side={-16} vertical />
      )}
      <Cota x1={cx - DfustePx / 2 - 44} y1={baseY - 18} x2={cx - DfustePx / 2 - 44} y2={baseY} text={`Dcim=${Dcim.toFixed(2)}`} side={-16} vertical />
      <text x={cx} y={20} fontSize="10.5" fill={NAVY} textAnchor="middle" fontWeight="600">
        Elevación — tanque elevado sobre fuste
      </text>
      <text x={cx} y={baseY + 54} fontSize="8" fill={INK} textAnchor="middle">
        Fuste Ø{Dfuste.toFixed(2)} m, e={(eFuste * 100).toFixed(0)} cm · {nVigas > 1 ? `${nVigas - 1} viga(s) de arriostre cada ${espacVigas.toFixed(2)} m` : "sin vigas intermedias (fuste corto)"}
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

/* ---------------- Ficha de sección por elemento (referencial, junto al predimensionamiento) ---------------- */

type FichaSeccionProps = {
  titulo: string;
  shape: "franja" | "circular" | "anular" | "curva";
  /** franja/curva: espesor en cm. circular/anular: diámetro en cm. */
  dim1: number;
  /** anular: espesor de pared en cm. curva: radio de curvatura relativo (0-1, estético). */
  dim2?: number;
  aceroPrincipal: string;
  aceroSecundario?: string;
  notas?: string;
};

/** Dibuja el elemento (franja recta, franja curva tipo cáscara, circular o anular) centrado en (cx,cy). Reutilizable. */
function dibujarElemento(cx: number, cy: number, shape: FichaSeccionProps["shape"], dim1: number, dim2: number | undefined, escala = 1) {
  if (shape === "franja" || shape === "curva") {
    const ePx = Math.max(16, Math.min(60, dim1 * 2)) * escala;
    const anchoPx = 160 * escala;
    const half = anchoPx / 2;
    const nBar = 6;
    const yBase = cy + ePx / 2;
    const rise = shape === "curva" ? ePx * 1.1 : 0;
    const domeY = (t: number, amp: number, yEdge: number) => yEdge - amp * (1 - t * t);
    if (shape === "curva") {
      const nSeg = 24;
      const outer: string[] = [];
      const inner: string[] = [];
      for (let i = 0; i <= nSeg; i++) {
        const t = -1 + (2 * i) / nSeg;
        outer.push(`${i === 0 ? "M" : "L"} ${(cx + t * half).toFixed(1)} ${domeY(t, rise, yBase - ePx).toFixed(1)}`);
      }
      for (let i = nSeg; i >= 0; i--) {
        const t = -1 + (2 * i) / nSeg;
        inner.push(`L ${(cx + t * half).toFixed(1)} ${domeY(t, rise, yBase).toFixed(1)}`);
      }
      const pathD = `${outer.join(" ")} ${inner.join(" ")} Z`;
      const tsBarras = [-0.72, -0.4, 0, 0.4, 0.72];
      return (
        <g>
          <path d={pathD} fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1.3" />
          {tsBarras.map((t, i) => (
            <g key={`bc-${i}`}>
              <circle cx={cx + t * half} cy={domeY(t, rise, yBase - ePx) + 6} r={2.6 * escala} fill={NAVY} />
              <circle cx={cx + t * half} cy={domeY(t, rise, yBase) - 6} r={2.6 * escala} fill={NAVY} />
            </g>
          ))}
          <line x1={cx - half} y1={yBase + 16} x2={cx + half} y2={yBase + 16} stroke={NAVY} strokeWidth="0.7" />
          <line x1={cx - half} y1={yBase + 10} x2={cx - half} y2={yBase + 22} stroke={NAVY} strokeWidth="0.7" />
          <line x1={cx + half} y1={yBase + 10} x2={cx + half} y2={yBase + 22} stroke={NAVY} strokeWidth="0.7" />
          <text x={cx} y={yBase + 32} fontSize={9 * escala} fill={INK} textAnchor="middle">
            e = {dim1.toFixed(1)} cm (cáscara, franja de 1,00 m)
          </text>
        </g>
      );
    }
    const x0 = cx - half, y0 = cy - ePx / 2;
    return (
      <g>
        <rect x={x0} y={y0} width={anchoPx} height={ePx} fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1.3" />
        {Array.from({ length: nBar }).map((_, i) => {
          const x = x0 + 14 * escala + (i * (anchoPx - 28 * escala)) / (nBar - 1);
          return (
            <g key={`b-${i}`}>
              <circle cx={x} cy={y0 + 6 * escala} r={2.6 * escala} fill={NAVY} />
              <circle cx={x} cy={y0 + ePx - 6 * escala} r={2.6 * escala} fill={NAVY} />
            </g>
          );
        })}
        <line x1={x0} y1={y0 + ePx + 14} x2={x0 + anchoPx} y2={y0 + ePx + 14} stroke={NAVY} strokeWidth="0.7" />
        <line x1={x0} y1={y0 + ePx + 8} x2={x0} y2={y0 + ePx + 20} stroke={NAVY} strokeWidth="0.7" />
        <line x1={x0 + anchoPx} y1={y0 + ePx + 8} x2={x0 + anchoPx} y2={y0 + ePx + 20} stroke={NAVY} strokeWidth="0.7" />
        <text x={cx} y={y0 + ePx + 30} fontSize={9 * escala} fill={INK} textAnchor="middle">
          e = {dim1.toFixed(1)} cm (franja de 1,00 m)
        </text>
      </g>
    );
  }
  const Dpx = Math.max(46, Math.min(140, dim1 * 1.05)) * escala;
  const r = Dpx / 2;
  const nBar = 8;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="url(#tq-conc)" stroke={NAVY} strokeWidth="1.3" />
      {shape === "anular" && dim2 ? (
        <circle cx={cx} cy={cy} r={Math.max(6, r - dim2 * 1.05 * escala)} fill="#fbf8f1" stroke={NAVY} strokeWidth="1" />
      ) : null}
      <circle cx={cx} cy={cy} r={r - 8 * escala} fill="none" stroke={INK} strokeWidth="0.7" strokeDasharray="2,2" />
      {Array.from({ length: nBar }).map((_, i) => {
        const ang = (2 * Math.PI * i) / nBar;
        const bx = cx + (r - 8 * escala) * Math.cos(ang);
        const by = cy + (r - 8 * escala) * Math.sin(ang);
        return <circle key={`cb-${i}`} cx={bx} cy={by} r={2.6 * escala} fill={NAVY} />;
      })}
      <text x={cx} y={cy + r + 20} fontSize={9 * escala} fill={INK} textAnchor="middle">
        {shape === "anular" ? `Ø ext=${dim1.toFixed(0)} cm · e=${(dim2 ?? 0).toFixed(0)} cm` : `Ø = ${dim1.toFixed(0)} cm`}
      </text>
    </g>
  );
}

export function FichaSeccionFig({ titulo, shape, dim1, dim2, aceroPrincipal, aceroSecundario, notas }: FichaSeccionProps) {
  const W = 260, H = 190;
  const cx = W / 2, cy = 96;
  const dibujo: ReactNode = dibujarElemento(cx, cy, shape, dim1, dim2);

  return (
    <div className="croquis croquis-compact" data-fig-part="momento">
      <div className="croquis-head">
        <p>{`Sección referencial · ${titulo}`}</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <defs><TickMarkers /><Defs /></defs>
          <rect x="0" y="0" width={W} height={H} fill="#fbf8f1" />
          <text x={cx} y={16} fontSize="9.5" fill={NAVY} textAnchor="middle" fontWeight="600">{titulo}</text>
          {dibujo}
          <rect x="10" y={H - 34} width={W - 20} height="26" fill="#f4efe3" stroke="#c4b48a" strokeWidth="0.7" />
          <text x="16" y={H - 22} fontSize="8" fill={NAVY}>{aceroPrincipal}</text>
          <text x="16" y={H - 11} fontSize="7.5" fill="#5a4a28">{aceroSecundario ?? notas ?? ""}</text>
        </svg>
      </div>
      <p className="croquis-cap">{`${aceroPrincipal}${aceroSecundario ? `  ·  ${aceroSecundario}` : ""}`}</p>
    </div>
  );
}

/* ---------------- Elemento + diagrama(s) de M/N/V en un solo gráfico ---------------- */

export type DiagramaSpec = { etiqueta: string; unidad: string; pts: { x: number; M: number }[]; nota?: string };

type ElementoDiagramaProps = {
  titulo: string;
  formula: string;
  shape: FichaSeccionProps["shape"];
  dim1: number;
  dim2?: number;
  ejeLabel: string;
  diagramas: DiagramaSpec[];
  aceroPrincipal: string;
  aceroSecundario?: string;
  nota?: string;
};

function miniDiagrama(pts: { x: number; M: number }[], x0: number, y0: number, w: number, h: number, unidad: string, etiqueta: string) {
  if (pts.length < 2) return null;
  const peak = Math.max(0.01, ...pts.map((p) => Math.abs(p.M)));
  const xmin = pts[0].x, xmax = pts[pts.length - 1].x;
  const xOf = (x: number) => x0 + ((x - xmin) / Math.max(xmax - xmin, 1e-6)) * w;
  const yMid = y0 + h / 2;
  const amp = h / 2 - 8;
  const yOf = (v: number) => yMid - (v / peak) * amp;
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.x).toFixed(1)} ${yOf(p.M).toFixed(1)}`).join(" ");
  const fill = `${d} L ${xOf(xmax).toFixed(1)} ${yMid.toFixed(1)} L ${xOf(xmin).toFixed(1)} ${yMid.toFixed(1)} Z`;
  const iMax = pts.reduce((b, p, i, a) => (Math.abs(p.M) > Math.abs(a[b].M) ? i : b), 0);
  const pk = pts[iMax];
  const labelY = Math.max(y0 + 9, Math.min(y0 + h - 3, yOf(pk.M) + (pk.M >= 0 ? -5 : 12)));
  return (
    <g>
      <text x={x0} y={y0 - 3} fontSize="8.5" fill={NAVY} fontWeight="600">{etiqueta}</text>
      <line x1={x0} y1={yMid} x2={x0 + w} y2={yMid} stroke={NAVY} strokeWidth="1" />
      <path d={fill} fill="rgba(26,68,115,0.14)" />
      <path d={d} fill="none" stroke={NAVY} strokeWidth="1.5" />
      <line x1={x0} y1={y0} x2={x0} y2={y0 + h - 10} stroke={NAVY} strokeWidth="0.6" strokeDasharray="2,2" />
      <text x={xOf(pk.x)} y={labelY} fontSize="8" fill={pk.M >= 0 ? "#1f6b3a" : "#8b1e1e"} textAnchor="middle" fontWeight="600">
        {pk.M >= 0 ? "+" : ""}{pk.M.toFixed(2)} {unidad}
      </text>
    </g>
  );
}

/** Envuelve un texto en varias líneas de hasta maxChars caracteres, partiendo por palabras. */
function wrapText(s: string, maxChars: number): string[] {
  const words = String(s || "").split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (t.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function ElementoDiagramaFig({ titulo, formula, shape, dim1, dim2, ejeLabel, diagramas, aceroPrincipal, aceroSecundario, nota }: ElementoDiagramaProps) {
  const formulaLines = wrapText(formula, 90);
  const headerH = 22 + formulaLines.length * 11;
  const diagH = 116;
  const diagGap = 20;
  const rightW = 360;
  const W = 190 + rightW + 20;
  const diagStartY = headerH + 14;
  const H = diagStartY - 10 + diagramas.length * diagH + (diagramas.length - 1) * diagGap + 44;
  const cxElem = 95, cyElem = headerH + (H - headerH - 40) / 2;

  return (
    <div className="croquis" data-fig-part="momento">
      <div className="croquis-head">
        <p>{`${titulo} — elemento y diagrama`}</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <defs><TickMarkers /><Defs /></defs>
          <rect x="0" y="0" width={W} height={H} fill="#fbf8f1" />
          <text x="10" y="16" fontSize="10" fill={NAVY} fontWeight="600">{titulo}</text>
          {formulaLines.map((line, i) => (
            <text key={i} x="10" y={28 + i * 11} fontSize="7.5" fill="#6b6458">{line}</text>
          ))}
          <line x1={175} y1="6" x2={175} y2={H - 6} stroke="#c4b48a" strokeWidth="0.8" strokeDasharray="2,2" />
          <g transform={`translate(0, 6)`}>{dibujarElemento(cxElem, cyElem, shape, dim1, dim2, 0.82)}</g>
          <text x={cxElem} y={H - 8} fontSize="7" fill={INK} textAnchor="middle">{ejeLabel}</text>
          {diagramas.map((dg, i) => (
            <g key={i}>{miniDiagrama(dg.pts, 190, diagStartY + i * (diagH + diagGap), rightW - 10, diagH, dg.unidad, dg.etiqueta)}</g>
          ))}
          <rect x="188" y={H - 34} width={W - 198} height="26" fill="#f4efe3" stroke="#c4b48a" strokeWidth="0.7" />
          <text x="194" y={H - 22} fontSize="8" fill={NAVY}>{aceroPrincipal}</text>
          <text x="194" y={H - 11} fontSize="7.5" fill="#5a4a28">{aceroSecundario ?? nota ?? ""}</text>
        </svg>
      </div>
      <p className="croquis-cap">{`${formula}  ·  ${aceroPrincipal}${aceroSecundario ? `  ·  ${aceroSecundario}` : ""}`}</p>
    </div>
  );
}

/* ---------------- Modelo matricial 3D — visualización isométrica de esfuerzos ---------------- */

type Node3DLite = { id: number; x: number; y: number; z: number };
type ElemStressLite = { n1: number; n2: number; tipo: "col" | "beam" | "diag"; val: number };

function parseNodes3D(s: string): Node3DLite[] {
  return String(s || "")
    .split(";")
    .filter(Boolean)
    .map((row) => {
      const [id, x, y, z] = row.split(",").map(Number);
      return { id, x, y, z };
    })
    .filter((n) => Number.isFinite(n.id) && Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z));
}

function parseElemStress(s: string): ElemStressLite[] {
  return String(s || "")
    .split(";")
    .filter(Boolean)
    .map((row) => {
      const [n1, n2, tipo, val] = row.split(",");
      return { n1: Number(n1), n2: Number(n2), tipo: tipo as ElemStressLite["tipo"], val: Number(val) };
    })
    .filter((e) => Number.isFinite(e.n1) && Number.isFinite(e.n2) && Number.isFinite(e.val));
}

/** Escala de color tipo "jet" simplificada: azul (bajo) → verde → ámbar → rojo (alto). t en [0,1]. */
function colorEsfuerzo(t: number) {
  const v = Math.max(0, Math.min(1, t));
  const stops: { p: number; c: [number, number, number] }[] = [
    { p: 0, c: [40, 90, 168] },
    { p: 0.4, c: [43, 140, 90] },
    { p: 0.7, c: [214, 169, 45] },
    { p: 1, c: [178, 40, 40] },
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (v >= stops[i].p && v <= stops[i + 1].p) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const f = (v - a.p) / Math.max(1e-6, b.p - a.p);
  const r = Math.round(a.c[0] + (b.c[0] - a.c[0]) * f);
  const g = Math.round(a.c[1] + (b.c[1] - a.c[1]) * f);
  const bch = Math.round(a.c[2] + (b.c[2] - a.c[2]) * f);
  return `rgb(${r},${g},${bch})`;
}

/**
 * Visualización isométrica del modelo de elementos finitos (pórtico espacial de la torre) con
 * esfuerzos por color: interacción P–M en columnas, demanda relativa en vigas y diagonales —
 * análoga a un gráfico de esfuerzos de un software de análisis estructural (SAP2000/ETABS).
 */
export function TorreMatricial3D({ values }: { values: Record<string, string> }) {
  const nodes = parseNodes3D(values.nodes3D || "");
  const elems = parseElemStress(values.elems3D || "");
  if (nodes.length === 0 || elems.length === 0) return null;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const Htorre = nv(values, "Htorre", 14);
  const hcgCuba = nv(values, "hcgCuba", 2);
  const Dcuba = nv(values, "D", 8);
  const nCol = Math.max(3, Math.round(nv(values, "nCol", 6)));

  const cosA = Math.cos(Math.PI / 6), sinA = Math.sin(Math.PI / 6);
  const proj = (x: number, y: number, z: number) => ({ sx: (x - y) * cosA, sy: (x + y) * sinA - z });

  const cubaTopNodes: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < nCol * 3; i++) {
    const ang = (2 * Math.PI * i) / (nCol * 3);
    cubaTopNodes.push({ x: (Dcuba / 2) * Math.cos(ang), y: (Dcuba / 2) * Math.sin(ang), z: Htorre + hcgCuba * 2 });
  }
  const cubaMidNodes = cubaTopNodes.map((p) => ({ ...p, z: Htorre + hcgCuba }));

  const allPts = [...nodes.map((n) => proj(n.x, n.y, n.z)), ...cubaTopNodes.map((p) => proj(p.x, p.y, p.z))];
  const xs = allPts.map((p) => p.sx), ys = allPts.map((p) => p.sy);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);

  const W = 560, H = 600, pad = 56, padTop = 30;
  const scale = Math.min((W - 2 * pad) / Math.max(1e-6, maxX - minX), (H - padTop - 100) / Math.max(1e-6, maxY - minY));
  const toScreen = (x: number, y: number, z: number) => {
    const p = proj(x, y, z);
    return { X: pad + (p.sx - minX) * scale, Y: padTop + (p.sy - minY) * scale };
  };

  const drawList = elems
    .map((e) => {
      const a = nodeMap.get(e.n1), b = nodeMap.get(e.n2);
      if (!a || !b) return null;
      const depth = a.x + a.y + a.z + b.x + b.y + b.z;
      return { e, a, b, depth };
    })
    .filter((v): v is { e: ElemStressLite; a: Node3DLite; b: Node3DLite; depth: number } => v !== null)
    .sort((p, q) => p.depth - q.depth);

  const strokeW: Record<ElemStressLite["tipo"], number> = { col: 5, beam: 3.2, diag: 1.6 };
  const dash: Record<ElemStressLite["tipo"], string | undefined> = { col: undefined, beam: undefined, diag: "4,3" };

  const groundY = Math.max(...nodes.filter((n) => n.z < 0.01).map((n) => toScreen(n.x, n.y, n.z).Y), 0);

  const legendStops = Array.from({ length: 21 }, (_, i) => i / 20);

  return (
    <div className="croquis" data-fig-part="momento">
      <div className="croquis-head">
        <p>Modelo matricial 3D — esfuerzos del pórtico espacial (vista isométrica)</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <defs><TickMarkers /><Defs /></defs>
          <rect x="0" y="0" width={W} height={H} fill="#fbf8f1" />
          <ellipse cx={W / 2} cy={groundY + 8} rx={(maxX - minX) * scale * 0.62} ry="14" fill="url(#tq-soil)" opacity="0.7" />
          {/* Cuba esquemática (referencial) sobre la corona de la torre */}
          <polygon
            points={cubaTopNodes.map((p) => { const s = toScreen(p.x, p.y, p.z); return `${s.X},${s.Y}`; }).join(" ")}
            fill="#c9dce8" opacity="0.35" stroke={NAVY} strokeWidth="0.8" strokeDasharray="2,2"
          />
          <polygon
            points={cubaMidNodes.map((p) => { const s = toScreen(p.x, p.y, p.z); return `${s.X},${s.Y}`; }).join(" ")}
            fill="#c9dce8" opacity="0.22" stroke={NAVY} strokeWidth="0.6" strokeDasharray="2,2"
          />
          {cubaTopNodes.map((p, i) => {
            const s1 = toScreen(p.x, p.y, p.z);
            const s2 = toScreen(cubaMidNodes[i].x, cubaMidNodes[i].y, cubaMidNodes[i].z);
            return <line key={`cubaEdge-${i}`} x1={s1.X} y1={s1.Y} x2={s2.X} y2={s2.Y} stroke={NAVY} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />;
          })}
          <text x={(() => { const c = toScreen(0, 0, Htorre + hcgCuba * 2); return c.X; })()} y={(() => { const c = toScreen(0, 0, Htorre + hcgCuba * 2); return c.Y - 10; })()} fontSize="8" fill="#2f6a8f" textAnchor="middle">
            Cuba (referencial)
          </text>
          {/* Elementos del modelo, coloreados por esfuerzo, ordenados por profundidad (pintor) */}
          {drawList.map(({ e, a, b }, i) => {
            const s1 = toScreen(a.x, a.y, a.z);
            const s2 = toScreen(b.x, b.y, b.z);
            const t = e.tipo === "col" ? e.val / 1.2 : e.val;
            return (
              <line
                key={i}
                x1={s1.X} y1={s1.Y} x2={s2.X} y2={s2.Y}
                stroke={colorEsfuerzo(t)}
                strokeWidth={strokeW[e.tipo]}
                strokeDasharray={dash[e.tipo]}
                strokeLinecap="round"
              />
            );
          })}
          {nodes.map((n) => {
            const s = toScreen(n.x, n.y, n.z);
            return <circle key={n.id} cx={s.X} cy={s.Y} r="2.2" fill={NAVY} opacity="0.75" />;
          })}
          <text x={W / 2} y={18} fontSize="10.5" fill={NAVY} textAnchor="middle" fontWeight="600">
            Modelo matricial 3D — esfuerzos del pórtico espacial (vista isométrica)
          </text>
          {/* Leyenda de color */}
          <defs>
            <linearGradient id="tq-legend-grad" x1="0" y1="0" x2="1" y2="0">
              {legendStops.map((t, i) => (
                <stop key={i} offset={`${(t * 100).toFixed(0)}%`} stopColor={colorEsfuerzo(t)} />
              ))}
            </linearGradient>
          </defs>
          <rect x={W / 2 - 140} y={H - 46} width="280" height="12" fill="url(#tq-legend-grad)" stroke={NAVY} strokeWidth="0.6" />
          <text x={W / 2 - 140} y={H - 52} fontSize="7.5" fill={INK}>bajo</text>
          <text x={W / 2} y={H - 52} fontSize="7.5" fill={INK} textAnchor="middle">medio</text>
          <text x={W / 2 + 140} y={H - 52} fontSize="7.5" fill={INK} textAnchor="end">alto</text>
          <text x={W / 2} y={H - 20} fontSize="7.5" fill={INK} textAnchor="middle">
            Columnas: P/φPn+M/φMn (0 → 1,2+) · Vigas y diagonales: demanda relativa al elemento más solicitado de su tipo (0 → 1)
          </text>
        </svg>
      </div>
      <p className="croquis-cap">
        Modelo de elementos finitos resuelto por rigidez directa 3D — {nodes.length} nudos, {elems.length} elementos (columnas, vigas de anillo y diagonales en X). Color por esfuerzo, análogo a un post-proceso de SAP2000/ETABS.
      </p>
    </div>
  );
}

export { CubaIntzePlanta };
