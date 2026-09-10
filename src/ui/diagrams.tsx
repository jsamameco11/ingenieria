const ink = "#0b1f33";
const brass = "#8a6a32";
const water = "#6a93b0";
const conc = "#d9d1c3";

function Dim({
  x1, y1, x2, y2, label, vertical = false,
}: {
  x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const tx = vertical ? mx - 10 : mx;
  const ty = vertical ? my + 3 : my - 7;
  const w = Math.max(36, label.length * 6.2);
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={brass} strokeWidth="1" markerStart="url(#tick)" markerEnd="url(#tick)" />
      <rect
        x={vertical ? tx - w : tx - w / 2}
        y={ty - 11}
        width={w}
        height="14"
        fill="#fbf8f1"
        fillOpacity="0.92"
      />
      <text
        x={tx}
        y={ty}
        fill={brass}
        fontSize="11"
        fontFamily="IBM Plex Sans"
        textAnchor={vertical ? "end" : "middle"}
      >
        {label}
      </text>
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <marker id="tick" markerWidth="6" markerHeight="8" refX="3" refY="4" orient="auto">
        <path d="M1,1 L5,7 M1,7 L5,1" stroke={brass} />
      </marker>
    </defs>
  );
}

export function CanaletaSvg({ b, h, y }: { b: number; h: number; y: number }) {
  const W = 560;
  const Hsvg = 320;
  const bw = 168;
  const bh = 128;
  const x = 108;
  const y0 = 48;
  const waterH = Math.max(10, Math.min(bh - 18, (y / Math.max(h, 1)) * bh));
  const holgura = Math.max(0, h - y);
  const yWater = y0 + bh - waterH;
  return (
    <div className="diagram diagram-canaleta">
      <svg viewBox={`0 0 ${W} ${Hsvg}`} preserveAspectRatio="xMidYMid meet">
        <Defs />
        <text x="16" y="22" fill={ink} fontSize="13" fontFamily="IBM Plex Sans" fontWeight="600">
          Sección de canaleta — tirante y holgura
        </text>
        <path d={`M${x} ${y0} L${x} ${y0 + bh} L${x + bw} ${y0 + bh} L${x + bw} ${y0}`} fill={conc} stroke={ink} strokeWidth="2.2" />
        <rect x={x + 2} y={yWater} width={bw - 4} height={waterH} fill={water} opacity="0.55" />
        <line x1={x + 2} y1={yWater} x2={x + bw - 2} y2={yWater} stroke="#3d6d8c" strokeDasharray="4 3" />
        <text x={x + bw + 86} y={yWater + 4} fill="#3d6d8c" fontSize="11" fontFamily="IBM Plex Sans">
          nivel de agua
        </text>
        <text x={x + bw + 86} y={y0 + 14} fill={brass} fontSize="11" fontFamily="IBM Plex Sans">
          holgura a = H − y
        </text>
        <Dim x1={x} y1={y0 + bh + 22} x2={x + bw} y2={y0 + bh + 22} label={`b = ${b} cm`} />
        <Dim x1={x + bw + 22} y1={y0} x2={x + bw + 22} y2={y0 + bh} label={`H = ${h} cm`} vertical />
        <Dim x1={x - 28} y1={yWater} x2={x - 28} y2={y0 + bh} label={`y = ${y} cm`} vertical />
        <Dim x1={x + bw + 56} y1={y0} x2={x + bw + 56} y2={yWater} label={`a = ${holgura.toFixed(0)} cm`} vertical />
        <foreignObject x="16" y="268" width="528" height="44">
          <p className="diagram-note">
            La canaleta no se diseña llena: el agua circula a tirante y y se reserva holgura contra rebose, hojas y oleaje.
          </p>
        </foreignObject>
      </svg>
    </div>
  );
}

export function BajanteSvg({ dNom, nBajantes }: { dNom: number; nBajantes: number }) {
  const W = 560;
  const H = 260;
  return (
    <div className="diagram diagram-canaleta">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <Defs />
        <text x="16" y="22" fill={ink} fontSize="13" fontFamily="IBM Plex Sans" fontWeight="600">
          Canaleta, salida y bajante PVC
        </text>
        <path d="M80 56 H250 V86 H80 Z" fill={conc} stroke={ink} strokeWidth="2" />
        <rect x="84" y="70" width="162" height="12" fill={water} opacity="0.55" />
        <text x="258" y="76" fontSize="11" fill={ink} fontFamily="IBM Plex Sans">canaleta</text>
        <rect x="168" y="86" width="22" height="16" fill={conc} stroke={ink} />
        <text x="258" y="104" fontSize="11" fill={brass} fontFamily="IBM Plex Sans">embudo / rejilla</text>
        <rect x="172" y="102" width="14" height="86" fill="#c5d4c0" stroke={ink} strokeWidth="1.6" />
        <text x="258" y="150" fontSize="12" fill={ink} fontFamily="IBM Plex Sans" fontWeight="600">
          bajante Ø {dNom} mm · {nBajantes === 2 ? "2 salidas" : "1 salida"}
        </text>
        <text x="258" y="170" fontSize="11" fill={brass} fontFamily="IBM Plex Sans">
          Q = Cd · (π d²/4) · √(2 g y)   ·   Cd = 0.62
        </text>
        <foreignObject x="16" y="208" width="528" height="42">
          <p className="diagram-note">
            Rejilla en la boca, rebose de alivio y descarga lejos de la cimentación.
          </p>
        </foreignObject>
      </svg>
    </div>
  );
}

export function TrazadoPluvialSvg({ caso }: { caso: 1 | 2 }) {
  return (
    <div className="diagram diagram-canaleta">
      <svg viewBox="0 0 560 240" preserveAspectRatio="xMidYMid meet">
        <Defs />
        <text x="16" y="22" fill={ink} fontSize="13" fontFamily="IBM Plex Sans" fontWeight="600">
          {caso === 1 ? "Caso 1 — un sistema, una bajante" : "Caso 2 — dos sistemas, dos bajantes"}
        </text>
        <rect x="48" y="44" width="140" height="72" fill="#efe6d4" stroke={ink} />
        <rect x="198" y="44" width="120" height="72" fill="#e4d4b8" stroke={ink} />
        <text x="118" y="86" textAnchor="middle" fontSize="13" fill={ink} fontWeight="600">A1</text>
        <text x="258" y="86" textAnchor="middle" fontSize="13" fill={ink} fontWeight="600">A2</text>
        {caso === 1 ? (
          <>
            <path d="M48 124 H330" stroke={ink} strokeWidth="6" />
            <rect x="318" y="124" width="14" height="44" fill="#c5d4c0" stroke={ink} />
            <text x="348" y="150" fontSize="11" fill={brass} fontFamily="IBM Plex Sans">1 bajante</text>
          </>
        ) : (
          <>
            <path d="M48 124 H170" stroke={ink} strokeWidth="6" />
            <path d="M198 124 H330" stroke={ink} strokeWidth="6" />
            <rect x="48" y="124" width="14" height="44" fill="#c5d4c0" stroke={ink} />
            <rect x="316" y="124" width="14" height="44" fill="#c5d4c0" stroke={ink} />
            <text x="348" y="150" fontSize="11" fill={brass} fontFamily="IBM Plex Sans">2 bajantes</text>
          </>
        )}
        <foreignObject x="16" y="186" width="528" height="44">
          <p className="diagram-note">
            {caso === 1
              ? "Canaleta continua: todo el caudal llega a una sola bajante."
              : "A1 y A2 independientes: menos rebose y más fácil de mantener."}
          </p>
        </foreignObject>
      </svg>
    </div>
  );
}

export function CanalTrapezSvg({ b, y, z, BL }: { b: number; y: number; z: number; BL: number }) {
  return <CanalSeccionSvg tipo="trapezoidal" b={b} y={y} z={z} BL={BL} D={0} T={b + 2 * z * y} />;
}

export function CanalSeccionSvg({
  tipo,
  b,
  y,
  z,
  BL,
  D,
  T,
}: {
  tipo: string;
  b: number;
  y: number;
  z: number;
  BL: number;
  D: number;
  T: number;
}) {
  const W = 600;
  const Hsvg = 320;
  const Htot = Math.max(y + BL, D || 0.4, 0.35);
  const scale = 132 / Htot;
  const h = y * scale;
  const bl = BL * scale;
  const base = Math.max(8, (tipo === "triangular" || tipo === "parabolica" ? 0 : tipo === "circular" ? 0 : b) * scale);
  const Tpx = Math.max(base + 16, (T > 0 ? T : b + 2 * z * y) * scale);
  const cx = W / 2;
  const yb = 232;
  const berm = 10;
  const xL = cx - Tpx / 2;
  const xR = cx + Tpx / 2;
  const x2 = cx - base / 2;
  const x3 = cx + base / 2;
  const crownL = xL - berm;
  const crownR = xR + berm;
  const yWater = yb - h;
  const yCrown = yb - h - bl;
  const soil = "#cbb892";
  const title =
    tipo === "rectangular"
      ? "Sección rectangular — solera, tirante, borde libre y espejo"
      : tipo === "triangular"
        ? "Sección triangular — taludes, tirante y borde libre"
        : tipo === "circular"
          ? "Sección circular — diámetro, tirante y borde libre"
          : tipo === "parabolica"
            ? "Sección parabólica — espejo T, tirante y borde libre"
            : "Sección trapezoidal — solera, taludes, tirante y borde libre";

  const lining =
    tipo === "circular"
      ? `M ${cx - (D * scale) / 2} ${yb} A ${(D * scale) / 2} ${(D * scale) / 2} 0 0 1 ${cx + (D * scale) / 2} ${yb}`
      : tipo === "parabolica"
        ? `M ${xL} ${yCrown} Q ${cx} ${yb + h * 0.15} ${xR} ${yCrown}`
        : `M ${crownL} ${yCrown} L ${xL} ${yCrown} L ${x2} ${yb} L ${x3} ${yb} L ${xR} ${yCrown} L ${crownR} ${yCrown}`;

  const waterPath =
    tipo === "circular"
      ? (() => {
          const r = (D * scale) / 2;
          const k = Math.min(h, r * 1.98);
          const half = Math.sqrt(Math.max(0, 2 * r * k - k * k));
          return `M ${cx - half} ${yb - k} A ${r} ${r} 0 0 0 ${cx + half} ${yb - k} L ${cx + half} ${yb - k} Z`;
        })()
      : tipo === "parabolica"
        ? `M ${cx - Tpx / 2} ${yWater} Q ${cx} ${yb + h * 0.12} ${cx + Tpx / 2} ${yWater} Z`
        : `M ${xL + (x2 - xL) * (bl / Math.max(h + bl, 1))} ${yWater} L ${x2} ${yb} L ${x3} ${yb} L ${xR - (xR - x3) * (bl / Math.max(h + bl, 1))} ${yWater} Z`;

  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${Hsvg}`}>
        <Defs />
        <rect x="0" y="0" width={W} height={Hsvg} fill="#fbf8f1" />
        <text x="16" y="20" fill={ink} fontSize="11" fontFamily="IBM Plex Sans" fontWeight="600" letterSpacing="0.12em">
          {title.toUpperCase()}
        </text>
        <rect x={crownL - 28} y={yCrown} width={crownR - crownL + 56} height={Hsvg - yCrown - 8} fill={soil} opacity="0.35" />
        <path d={lining} fill={conc} stroke={ink} strokeWidth="2.1" />
        <path d={waterPath} fill={water} opacity="0.55" />
        <line x1={xL} y1={yWater} x2={xR} y2={yWater} stroke="#3d6d8c" strokeDasharray="5 3" strokeWidth="1.2" />
        {base > 6 ? <Dim x1={x2} y1={yb + 16} x2={x3} y2={yb + 16} label={`b = ${b.toFixed(2)} m`} /> : null}
        <Dim x1={xL} y1={yCrown - 14} x2={xR} y2={yCrown - 14} label={`T = ${T.toFixed(2)} m`} />
        <Dim x1={xR + 16} y1={yWater} x2={xR + 16} y2={yb} label={`yn = ${y.toFixed(3)} m`} vertical />
        <Dim x1={xR + 52} y1={yCrown} x2={xR + 52} y2={yb} label={`H = ${ (y + BL).toFixed(2)} m`} vertical />
        <text x={cx} y={yWater - 8} textAnchor="middle" fill="#3d6d8c" fontSize="10" fontFamily="IBM Plex Sans">
          superficie libre
        </text>
        <foreignObject x="16" y="286" width="568" height="28">
          <p className="diagram-note">
            {tipo === "circular"
              ? `D = ${D.toFixed(2)} m · BL USBR = ${BL.toFixed(2)} m`
              : tipo === "parabolica"
                ? `k = ${z.toFixed(2)} m½ · BL USBR = ${BL.toFixed(2)} m · z no aplica`
                : `z = ${z.toFixed(2)}:1 (H:V) · BL USBR = ${BL.toFixed(2)} m`}
          </p>
        </foreignObject>
      </svg>
    </div>
  );
}

export function CanalEnergiaSvg({
  curva,
  yn,
  yc,
  E,
  Emin,
}: {
  curva: { y: number; E: number }[];
  yn: number;
  yc: number;
  E: number;
  Emin: number;
}) {
  const W = 520;
  const H = 250;
  const padL = 48;
  const padB = 40;
  const padT = 44;
  const padR = 24;
  const Es = curva.map((p) => p.E).filter((v) => Number.isFinite(v) && v < 1e6);
  const ys = curva.map((p) => p.y);
  const Emax = Math.max(E, Emin, ...Es, 0.2) * 1.08;
  const ymax = Math.max(yn, yc, ...ys, 0.2) * 1.02;
  const xOf = (e: number) => padL + (e / Emax) * (W - padL - padR);
  const yOf = (y: number) => H - padB - (y / ymax) * (H - padT - padB);
  const pts = curva
    .filter((p) => p.E < Emax * 1.2)
    .map((p) => `${xOf(p.E).toFixed(1)},${yOf(p.y).toFixed(1)}`)
    .join(" ");
  const cyN = yOf(yn);
  const cyC = yOf(yc);
  const ynArriba = cyN <= cyC;
  const ynTy = ynArriba ? cyN - 7 : cyN + 16;
  const ycTy = ynArriba ? cyC + 16 : cyC - 7;
  const xLab = Math.min(Math.max(xOf(E), xOf(Emin)) + 12, W - padR - 8);
  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <rect x="0" y="0" width={W} height={H} fill="#fbf8f1" />
        <text x="16" y="20" fill={ink} fontSize="11" fontFamily="IBM Plex Sans" fontWeight="600" letterSpacing="0.12em">
          ENERGÍA ESPECÍFICA E(y)
        </text>
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke={ink} strokeWidth="1.1" />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={ink} strokeWidth="1.1" />
        <polyline points={pts} fill="none" stroke="#1a4473" strokeWidth="1.7" />
        <line x1={xOf(Emin)} y1={cyC} x2={xOf(Emax)} y2={cyC} stroke="#8b1e1e" strokeDasharray="4 3" strokeWidth="1" />
        <line x1={xOf(E)} y1={cyN} x2={xOf(Emax)} y2={cyN} stroke="#1f6b3a" strokeDasharray="4 3" strokeWidth="1" />
        <circle cx={xOf(Emin)} cy={cyC} r="4" fill="#8b1e1e" />
        <circle cx={xOf(E)} cy={cyN} r="4" fill="#1f6b3a" />
        <text x={xLab} y={ycTy} fontSize="10" fill="#8b1e1e" fontFamily="IBM Plex Sans">
          {`yc = ${yc.toFixed(3)} m · Emin = ${Emin.toFixed(3)} m`}
        </text>
        <text x={xLab} y={ynTy} fontSize="10" fill="#1f6b3a" fontFamily="IBM Plex Sans">
          {`yn = ${yn.toFixed(3)} m · E = ${E.toFixed(3)} m`}
        </text>
        <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={brass} fontFamily="IBM Plex Sans">
          E = y + V²/2g  (m)
        </text>
        <text x={14} y={H / 2} fontSize="10" fill={brass} fontFamily="IBM Plex Sans" transform={`rotate(-90 14 ${H / 2})`}>
          tirante y (m)
        </text>
      </svg>
    </div>
  );
}

export function SifonSvg({
  D,
  Lh,
  Le,
  Ls,
}: {
  D: number;
  Lh: number;
  Le: number;
  Ls: number;
}) {
  return (
    <div className="diagram">
      <svg viewBox="0 0 520 220">
        <Defs />
        <text x="16" y="22" fill={ink} fontSize="12" fontFamily="IBM Plex Sans" fontWeight="600">
          Perfil longitudinal del sifón invertido
        </text>
        <path d="M40 70 L110 70 L160 150 L360 150 L410 85 L480 85" fill="none" stroke={ink} strokeWidth="3.2" />
        <path d="M40 58 L110 58" stroke={water} strokeWidth="6" opacity="0.7" />
        <path d="M410 73 L480 73" stroke={water} strokeWidth="6" opacity="0.7" />
        <circle cx="110" cy="64" r="5" fill={brass} />
        <circle cx="160" cy="150" r="5" fill={brass} />
        <circle cx="360" cy="150" r="5" fill={brass} />
        <circle cx="410" cy="79" r="5" fill={brass} />
        <text x="96" y="48" fontSize="10" fill={brass}>1-2</text>
        <text x="148" y="168" fontSize="10" fill={brass}>3</text>
        <text x="348" y="168" fontSize="10" fill={brass}>4</text>
        <text x="400" y="64" fontSize="10" fill={brass}>5-6</text>
        <Dim x1={160} y1={190} x2={360} y2={190} label={`Lh = ${Lh} m`} />
        <text x="16" y="210" fontSize="11" fill={ink} fontFamily="IBM Plex Sans">
          Ø = {(D * 1000).toFixed(0)} mm · tramos inclinados {Le} m / {Ls} m
        </text>
      </svg>
    </div>
  );
}

export function CajaSvg({ B, H, nBarriles = 1 }: { B: number; H: number; nBarriles?: number }) {
  const W = 520;
  const Ht = 228;
  const padL = 36;
  const padR = 64;
  const padT = 34;
  const padB = 44;
  const innerW = W - padL - padR;
  const innerH = Ht - padT - padB;
  const nB = Math.max(1, Math.min(4, Math.round(nBarriles) || 1));
  const gapM = 0.22;
  const spanM = B * nB + gapM * (nB - 1);
  const aspect = spanM / Math.max(H, 0.15);
  let bw = innerW * 0.78;
  let bh = bw / aspect;
  if (bh > innerH * 0.78) {
    bh = innerH * 0.78;
    bw = bh * aspect;
  }
  const x0 = padL + (innerW - bw) / 2;
  const y0 = padT + 6;
  const wall = Math.max(7, Math.min(12, bw * 0.045));
  const gap = nB > 1 ? (gapM / spanM) * bw : 0;
  const cell = (bw - gap * (nB - 1)) / nB;
  const boxes = Array.from({ length: nB }, (_, i) => {
    const x = x0 + i * (cell + gap);
    return { x, y: y0, w: cell, h: bh };
  });
  return (
    <div className="diagram diagram-fit">
      <svg viewBox={`0 0 ${W} ${Ht}`} preserveAspectRatio="xMidYMid meet">
        <Defs />
        <text x="16" y="20" fill={ink} fontSize="12" fontFamily="IBM Plex Sans" fontWeight="600">
          Alcantarilla tipo cajón{nB > 1 ? ` · ${nB} caños` : ""}
        </text>
        {boxes.map((box, i) => (
          <g key={i}>
            <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={conc} stroke={ink} strokeWidth="6" />
            <rect
              x={box.x + wall}
              y={box.y + wall}
              width={Math.max(4, box.w - wall * 2)}
              height={Math.max(4, box.h - wall * 2)}
              fill={water}
              opacity="0.38"
            />
          </g>
        ))}
        <Dim
          x1={x0}
          y1={y0 + bh + 16}
          x2={x0 + bw}
          y2={y0 + bh + 16}
          label={nB > 1 ? `${nB} × B = ${B.toFixed(2)} m` : `B = ${B.toFixed(2)} m`}
        />
        <Dim x1={x0 + bw + 16} y1={y0} x2={x0 + bw + 16} y2={y0 + bh} label={`H = ${H.toFixed(2)} m`} vertical />
      </svg>
    </div>
  );
}

export function CunetaSvg({
  zIzq,
  zDer,
  y,
  b,
  tipo,
  yMax,
}: {
  zIzq: number;
  zDer: number;
  y: number;
  b: number;
  tipo: string;
  yMax?: number;
}) {
  const W = 520;
  const Ht = 228;
  const padL = 28;
  const padR = 28;
  const padT = 32;
  const padB = 40;
  const innerW = W - padL - padR;
  const innerH = Ht - padT - padB;
  const yDraw = Math.max(yMax && yMax > 0 ? yMax : y, 0.08);
  const zL = Math.max(zIzq, 0.2);
  const zR = Math.max(zDer, 0.2);
  const bDraw = tipo === "triangular" ? 0 : Math.max(b, 0.05);
  const wM = zL * yDraw + bDraw + zR * yDraw;
  const scale = Math.min(innerW / Math.max(wM, 0.05), innerH / Math.max(yDraw, 0.05)) * 0.82;
  const wPx = wM * scale;
  const hPx = yDraw * scale;
  const x0 = padL + (innerW - wPx) / 2;
  const yb = padT + innerH * 0.9;
  const x2 = x0 + zL * yDraw * scale;
  const x3 = x2 + bDraw * scale;
  const xRight = x3 + zR * yDraw * scale;
  const yTop = yb - hPx;
  const ynFrac = Math.min(0.95, Math.max(0.05, (Number.isFinite(y) ? y : yDraw * 0.5) / yDraw));
  const hW = hPx * ynFrac;
  const x2w = x2 + (x0 - x2) * ynFrac;
  const x3w = x3 + (xRight - x3) * ynFrac;
  return (
    <div className="diagram diagram-fit">
      <svg viewBox={`0 0 ${W} ${Ht}`} preserveAspectRatio="xMidYMid meet">
        <Defs />
        <text x="16" y="20" fill={ink} fontSize="12" fontFamily="IBM Plex Sans" fontWeight="600">
          Sección de cuneta {tipo}
        </text>
        <polygon
          points={`${x0},${yTop} ${x2},${yb} ${x3},${yb} ${xRight},${yTop}`}
          fill={conc}
          stroke={ink}
          strokeWidth="2"
        />
        <polygon
          points={`${x2w},${yb - hW} ${x2},${yb} ${x3},${yb} ${x3w},${yb - hW}`}
          fill={water}
          opacity="0.5"
        />
        <text x="16" y={Ht - 12} fontSize="11" fill={brass} fontFamily="IBM Plex Sans">
          zᵢ = {zIzq}:1 · zᵈ = {zDer}:1 · yₙ ≈ {Number.isFinite(y) ? y.toFixed(3) : "—"} m{tipo !== "triangular" ? ` · b = ${b} m` : ""}
        </text>
      </svg>
    </div>
  );
}
