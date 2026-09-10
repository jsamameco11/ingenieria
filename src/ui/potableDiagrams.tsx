const ink = "#0b1f33";
const brass = "#8a6a32";
const water = "#6a93b0";
const conc = "#d9d1c3";
const sand = "#c4b08a";
const gravel = "#9a8b73";

function Dim({
  x1, y1, x2, y2, label, vertical = false, side = 1,
}: {
  x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean; side?: number;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={brass} strokeWidth="1" />
      <line x1={x1 - (vertical ? 3 : 0)} y1={y1 - (vertical ? 0 : 3)} x2={x1 + (vertical ? 3 : 0)} y2={y1 + (vertical ? 0 : 3)} stroke={brass} strokeWidth="1" />
      <line x1={x2 - (vertical ? 3 : 0)} y1={y2 - (vertical ? 0 : 3)} x2={x2 + (vertical ? 3 : 0)} y2={y2 + (vertical ? 0 : 3)} stroke={brass} strokeWidth="1" />
      <text
        x={vertical ? mx - 7 * side : mx}
        y={vertical ? my : my - 5}
        fill={brass}
        fontSize="10"
        fontFamily="IBM Plex Sans"
        textAnchor={vertical ? (side > 0 ? "end" : "start") : "middle"}
      >
        {label}
      </text>
    </g>
  );
}

function Title({ t }: { t: string }) {
  return (
    <text x="16" y="20" fill={ink} fontSize="11" fontFamily="IBM Plex Sans" fontWeight="600" letterSpacing="0.08em">
      {t}
    </text>
  );
}

export function DotacionBarrasSvg({
  Qp, Qmd, Qmh,
}: {
  Qp: number; Qmd: number; Qmh: number;
}) {
  const W = 520, H = 198;
  const max = Math.max(Qmh, Qmd, Qp, 0.01);
  const bar = (x: number, q: number, color: string, label: string) => {
    const h = (q / max) * 118;
    const y = 156 - h;
    return (
      <g>
        <rect x={x} y={y} width="54" height={h} fill={color} opacity="0.85" />
        <text x={x + 27} y={y - 8} textAnchor="middle" fontSize="11" fill={ink} fontFamily="IBM Plex Sans" fontWeight="600">
          {q.toFixed(3)} L/s
        </text>
        <text x={x + 27} y={174} textAnchor="middle" fontSize="10" fill={brass} fontFamily="IBM Plex Sans">
          {label}
        </text>
      </g>
    );
  };
  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <Title t="CAUDALES DE DISEÑO  ·  Qp · Qmd · Qmh" />
        <line x1="40" y1="156" x2="490" y2="156" stroke={ink} strokeWidth="1.2" />
        {bar(90, Qp, "#3d6d8c", "Qp  medio")}
        {bar(220, Qmd, "#1a4473", "Qmd  máx. diario")}
        {bar(350, Qmh, "#8a6a32", "Qmh  máx. horario")}
      </svg>
    </div>
  );
}

export function SistemaEsquemaSvg({
  Qmd, Vadop, Dpulg, Hf, presion,
}: {
  Qmd: number; Vadop: number; Dpulg: number; Hf: number; presion: number;
}) {
  return (
    <div className="diagram">
      <svg viewBox="0 0 640 230">
        <Title t="ESQUEMA DEL SISTEMA ABIERTO DE AGUA POTABLE" />
        <path d="M40 150 L90 120 L140 150 Z" fill="#7a9bb0" stroke={ink} strokeWidth="1.4" />
        <text x="90" y="168" textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">Captación</text>
        <text x="90" y="182" textAnchor="middle" fontSize="9" fill={brass} fontFamily="IBM Plex Sans">{`Qmd ${Qmd.toFixed(3)} L/s`}</text>
        <line x1="140" y1="135" x2="250" y2="118" stroke="#1a4473" strokeWidth="3" />
        <text x="195" y="108" textAnchor="middle" fontSize="9" fill={brass} fontFamily="IBM Plex Sans">{`Ø ${Dpulg}" · Hf ${Hf.toFixed(2)} m`}</text>
        <rect x="250" y="78" width="70" height="52" fill={conc} stroke={ink} strokeWidth="1.6" />
        <text x="285" y="100" textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">PTAP</text>
        <text x="285" y="114" textAnchor="middle" fontSize="9" fill={brass} fontFamily="IBM Plex Sans">sed. + filtro</text>
        <line x1="320" y1="104" x2="400" y2="92" stroke="#1a4473" strokeWidth="3" />
        <rect x="400" y="58" width="86" height="58" rx="2" fill={conc} stroke={ink} strokeWidth="1.6" />
        <rect x="408" y="78" width="70" height="30" fill={water} opacity="0.7" />
        <text x="443" y="74" textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">Reservorio</text>
        <text x="443" y="128" textAnchor="middle" fontSize="9" fill={brass} fontFamily="IBM Plex Sans">{`${Vadop} m³`}</text>
        <line x1="486" y1="92" x2="580" y2="150" stroke="#1a4473" strokeWidth="2.4" />
        <circle cx="560" cy="158" r="6" fill="#1a4473" />
        <circle cx="590" cy="168" r="6" fill="#1a4473" />
        <circle cx="530" cy="172" r="6" fill="#1a4473" />
        <text x="560" y="198" textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">Red de distribución</text>
        <text x="560" y="212" textAnchor="middle" fontSize="9" fill={brass} fontFamily="IBM Plex Sans">{`p = ${presion.toFixed(1)} m.c.a.`}</text>
      </svg>
    </div>
  );
}

export function SistemaPerfilSvg({
  perfil, tramos, Qmd, Vadop, Hftot, presion,
}: {
  perfil: { codigo: string; tipo: string; pk: number; zTerreno: number; zTubo: number; hgl: number; presion: number }[];
  tramos: { codigo: string; Dpulg: number; L: number }[];
  Qmd: number;
  Vadop: number;
  Hftot: number;
  presion: number;
}) {
  const W = 640, H = 268;
  const pad = { l: 52, r: 18, t: 36, b: 36 };
  const pts = perfil.length >= 2 ? perfil : [
    { codigo: "N-01", tipo: "captacion", pk: 0, zTerreno: 545, zTubo: 544, hgl: 545, presion: 1 },
    { codigo: "N-02", tipo: "reservorio", pk: 350, zTerreno: 510, zTubo: 509, hgl: 520, presion: 11 },
  ];
  const pk0 = pts[0].pk;
  const pk1 = pts[pts.length - 1].pk;
  const zs = pts.flatMap((p) => [p.zTerreno, p.zTubo, p.hgl]);
  const zMin = Math.min(...zs) - 2;
  const zMax = Math.max(...zs) + 2;
  const x = (pk: number) => pad.l + ((pk - pk0) / Math.max(pk1 - pk0, 1)) * (W - pad.l - pad.r);
  const y = (z: number) => pad.t + (1 - (z - zMin) / Math.max(zMax - zMin, 1)) * (H - pad.t - pad.b);
  const poly = (key: "zTerreno" | "zTubo" | "hgl") => pts.map((p) => `${x(p.pk).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const Øtxt = [...new Set(tramos.map((t) => t.Dpulg))].map((d) => `${d}"`).join(" / ");
  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <Title t="PERFIL HIDRÁULICO  ·  TERRENO · TUBO · HGL" />
        <polyline points={poly("zTerreno")} fill="none" stroke={sand} strokeWidth="2.2" />
        <polyline points={poly("zTubo")} fill="none" stroke="#1a4473" strokeWidth="2.4" />
        <polyline points={poly("hgl")} fill="none" stroke={water} strokeWidth="1.8" strokeDasharray="5 3" />
        {pts.map((p) => (
          <g key={p.codigo}>
            <circle cx={x(p.pk)} cy={y(p.zTerreno)} r="3.2" fill={ink} />
            <text x={x(p.pk)} y={H - 14} textAnchor="middle" fontSize="9" fill={ink} fontFamily="IBM Plex Sans">{p.codigo}</text>
          </g>
        ))}
        <text x="16" y={H - 4} fontSize="9" fill={brass} fontFamily="IBM Plex Sans">
          {`Qmd ${Qmd.toFixed(3)} L/s  ·  Ø ${Øtxt || "—"}  ·  Hf ${Hftot.toFixed(2)} m  ·  P llegada ${presion.toFixed(1)} m  ·  ${Vadop} m³`}
        </text>
        <text x={W - 14} y="34" textAnchor="end" fontSize="9" fill={sand} fontFamily="IBM Plex Sans">terreno</text>
        <text x={W - 14} y="46" textAnchor="end" fontSize="9" fill="#1a4473" fontFamily="IBM Plex Sans">tubo</text>
        <text x={W - 14} y="58" textAnchor="end" fontSize="9" fill={water} fontFamily="IBM Plex Sans">HGL</text>
      </svg>
    </div>
  );
}

export function SedimentadorSvg({
  B, H, L1, L2, LT, H1,
}: {
  B: number; H: number; L1: number; L2: number; LT: number; H1: number;
}) {
  const W = 560, Hv = 250;
  const x0 = 50, y0 = 48, bw = 460, bh = 140;
  const x1 = x0 + (L1 / Math.max(LT, 0.1)) * bw;
  const yFondo = y0 + bh;
  const yTolva = y0 + bh + 28;
  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${Hv}`}>
        <Title t="SEDIMENTADOR  ·  CORTE LONGITUDINAL" />
        <path
          d={`M${x0} ${y0} L${x0} ${yFondo} L${x1} ${yFondo} L${x0 + bw} ${yTolva} L${x0 + bw} ${y0} Z`}
          fill={conc}
          stroke={ink}
          strokeWidth="1.8"
        />
        <path
          d={`M${x0 + 6} ${y0 + 18} L${x0 + 6} ${yFondo - 8} L${x1} ${yFondo - 8} L${x0 + bw - 6} ${yTolva - 10} L${x0 + bw - 6} ${y0 + 18} Z`}
          fill={water}
          opacity="0.55"
        />
        <line x1={x1} y1={y0} x2={x1} y2={yFondo} stroke={ink} strokeDasharray="4 3" />
        <circle cx={x1} cy={y0 + 40} r="3" fill={ink} />
        <circle cx={x1} cy={y0 + 62} r="3" fill={ink} />
        <circle cx={x1} cy={y0 + 84} r="3" fill={ink} />
        <text x={x1 + 10} y={y0 + 66} fontSize="9" fill={ink} fontFamily="IBM Plex Sans">orificios</text>
        <Dim x1={x0} y1={yTolva + 22} x2={x1} y2={yTolva + 22} label={`L1 = ${L1.toFixed(2)} m`} />
        <Dim x1={x1} y1={yTolva + 22} x2={x0 + bw} y2={yTolva + 22} label={`L2 = ${L2.toFixed(2)} m`} />
        <Dim x1={x0 - 16} y1={y0} x2={x0 - 16} y2={yFondo} label={`H = ${H.toFixed(2)} m`} vertical />
        <text x={x0 + bw + 8} y={yTolva - 4} fontSize="9" fill={brass} fontFamily="IBM Plex Sans">{`H1 = ${H1.toFixed(2)} m`}</text>
        <text x={x0 + 24} y={y0 + 14} fontSize="9" fill={brass} fontFamily="IBM Plex Sans">{`B = ${B.toFixed(2)} m  ·  LT = ${LT.toFixed(2)} m`}</text>
      </svg>
    </div>
  );
}

export function PrefiltroSvg({
  B, H, L1, L2, L3, Lt,
}: {
  B: number; H: number; L1: number; L2: number; L3: number; Lt: number;
}) {
  const W = 580, Hv = 230;
  const x0 = 40, y0 = 44, bw = 500, bh = 120;
  const s = bw / Math.max(Lt, 0.1);
  const w1 = L1 * s, w2 = L2 * s, w3 = L3 * s;
  const tones = ["#b7a078", "#c4b08a", "#d4c4a0"];
  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${Hv}`}>
        <Title t="PREFILTRO DE GRAVA  ·  PLANTA (3 TRAMOS · OS.020)" />
        <rect x={x0} y={y0} width={bw} height={bh} fill={conc} stroke={ink} strokeWidth="1.8" />
        <rect x={x0 + 4} y={y0 + 8} width={w1 - 6} height={bh - 16} fill={tones[0]} />
        <rect x={x0 + w1} y={y0 + 8} width={w2 - 4} height={bh - 16} fill={tones[1]} />
        <rect x={x0 + w1 + w2} y={y0 + 8} width={Math.max(8, w3 - 8)} height={bh - 16} fill={tones[2]} />
        <text x={x0 + w1 / 2} y={y0 + 70} textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">3–4 cm</text>
        <text x={x0 + w1 + w2 / 2} y={y0 + 70} textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">2–3 cm</text>
        <text x={x0 + w1 + w2 + w3 / 2} y={y0 + 70} textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">1–2 cm</text>
        <Dim x1={x0} y1={y0 + bh + 22} x2={x0 + w1} y2={y0 + bh + 22} label={`L1 = ${L1.toFixed(2)} m`} />
        <Dim x1={x0 + w1} y1={y0 + bh + 22} x2={x0 + w1 + w2} y2={y0 + bh + 22} label={`L2 = ${L2.toFixed(2)} m`} />
        <Dim x1={x0 + w1 + w2} y1={y0 + bh + 22} x2={x0 + bw} y2={y0 + bh + 22} label={`L3 = ${L3.toFixed(2)} m`} />
        <Dim x1={x0 + bw + 16} y1={y0} x2={x0 + bw + 16} y2={y0 + bh} label={`H = ${H.toFixed(2)} m`} vertical={true} side={-1} />
        <text x={x0} y={y0 + bh + 48} fontSize="10" fill={brass} fontFamily="IBM Plex Sans">{`B = ${B.toFixed(2)} m   ·   Lt = ${Lt.toFixed(2)} m`}</text>
      </svg>
    </div>
  );
}

export function FiltroLentoSvg({
  A, B, hAgua, hLecho, hSop, hDren, BL, Htot,
}: {
  A: number; B: number; hAgua: number; hLecho: number; hSop: number; hDren: number; BL: number; Htot: number;
}) {
  const W = 520, H = 260;
  const x = 80, y = 36, bw = 300, bh = 170;
  const scale = bh / Math.max(Htot, 0.1);
  const y1 = y + BL * scale;
  const y2 = y1 + hAgua * scale;
  const y3 = y2 + hLecho * scale;
  const y4 = y3 + hSop * scale;
  const y5 = y4 + hDren * scale;
  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <Title t="FILTRO LENTO DE ARENA  ·  CORTE" />
        <rect x={x} y={y} width={bw} height={bh} fill={conc} stroke={ink} strokeWidth="1.8" />
        <rect x={x + 4} y={y1} width={bw - 8} height={Math.max(4, y2 - y1)} fill={water} opacity="0.55" />
        <rect x={x + 4} y={y2} width={bw - 8} height={Math.max(4, y3 - y2)} fill={sand} />
        <rect x={x + 4} y={y3} width={bw - 8} height={Math.max(4, y4 - y3)} fill={gravel} />
        <rect x={x + 4} y={y4} width={bw - 8} height={Math.max(4, y5 - y4 - 2)} fill="#6d7c8a" />
        <text x={x + bw / 2} y={(y1 + y2) / 2 + 4} textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">capa de agua</text>
        <text x={x + bw / 2} y={(y2 + y3) / 2 + 4} textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">lecho de arena</text>
        <text x={x + bw / 2} y={(y3 + y4) / 2 + 4} textAnchor="middle" fontSize="10" fill="#fff" fontFamily="IBM Plex Sans">grava soporte</text>
        <text x={x + bw / 2} y={(y4 + y5) / 2 + 4} textAnchor="middle" fontSize="10" fill="#fff" fontFamily="IBM Plex Sans">drenes</text>
        <Dim x1={x + bw + 18} y1={y1} x2={x + bw + 18} y2={y2} label={`${hAgua.toFixed(2)} m`} vertical={true} side={-1} />
        <Dim x1={x + bw + 18} y1={y2} x2={x + bw + 18} y2={y3} label={`${hLecho.toFixed(2)} m`} vertical={true} side={-1} />
        <Dim x1={x} y1={y + bh + 18} x2={x + bw} y2={y + bh + 18} label={`A = ${A.toFixed(2)} m  ·  B = ${B.toFixed(2)} m`} />
        <text x={16} y={y + 14} fontSize="9" fill={brass} fontFamily="IBM Plex Sans">{`BL ${BL.toFixed(2)} m`}</text>
      </svg>
    </div>
  );
}

export function ImpulsionSvg({
  HgImp, Limp, DimpP, Ht, HP,
}: {
  HgImp: number; Limp: number; DimpP: number; Ht: number; HP: number;
}) {
  return (
    <div className="diagram">
      <svg viewBox="0 0 620 230">
        <Title t="PERFIL HIDRÁULICO  ·  SUCCIÓN E IMPULSIÓN" />
        <rect x="50" y="130" width="90" height="50" fill={conc} stroke={ink} strokeWidth="1.6" />
        <rect x="56" y="148" width="78" height="26" fill={water} opacity="0.65" />
        <text x="95" y="144" textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">Cisterna</text>
        <rect x="160" y="138" width="36" height="28" fill="#c9b896" stroke={ink} strokeWidth="1.3" />
        <text x="178" y="178" textAnchor="middle" fontSize="9" fill={ink} fontFamily="IBM Plex Sans">bomba</text>
        <path d="M196 152 L470 78" stroke="#1a4473" strokeWidth="3" fill="none" />
        <rect x="470" y="48" width="80" height="50" fill={conc} stroke={ink} strokeWidth="1.6" />
        <rect x="478" y="68" width="64" height="24" fill={water} opacity="0.65" />
        <text x="510" y="62" textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">Reservorio</text>
        <Dim x1={196} y1={198} x2={470} y2={198} label={`Limp = ${Limp.toFixed(0)} m  ·  Ø ${DimpP}"`} />
        <Dim x1={560} y1={78} x2={560} y2={152} label={`Hg = ${HgImp.toFixed(1)} m`} vertical={true} side={-1} />
        <text x="320" y="70" fontSize="11" fill={ink} fontFamily="IBM Plex Sans" fontWeight="600">{`Ht = ${Ht.toFixed(2)} m   ·   ${HP.toFixed(2)} HP`}</text>
      </svg>
    </div>
  );
}

export function ReservorioSvg({
  b, L, hu, Hint, Vadop, Dent, Dsal, Dreb,
}: {
  b: number; L: number; hu: number; Hint: number; Vadop: number; Dent: number; Dsal: number; Dreb: number;
}) {
  const W = 520, H = 250;
  const x = 90, y = 40, bw = 280, bh = 150;
  const aguaH = (hu / Math.max(Hint, 0.1)) * (bh - 18);
  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <Title t="RESERVORIO APOYADO  ·  CORTE" />
        <rect x={x} y={y} width={bw} height={bh} fill={conc} stroke={ink} strokeWidth="1.8" />
        <rect x={x + 6} y={y + bh - 12 - aguaH} width={bw - 12} height={aguaH} fill={water} opacity="0.6" />
        <line x1={x + 6} y1={y + bh - 12 - aguaH} x2={x + bw - 6} y2={y + bh - 12 - aguaH} stroke="#3d6d8c" strokeDasharray="4 3" />
        <line x1={x - 18} y1={y + 28} x2={x} y2={y + 28} stroke="#1a4473" strokeWidth="2.2" />
        <text x={x - 22} y={y + 24} textAnchor="end" fontSize="9" fill={ink} fontFamily="IBM Plex Sans">{`Øe ${Dent}"`}</text>
        <line x1={x + bw} y1={y + bh - 28} x2={x + bw + 22} y2={y + bh - 28} stroke="#1a4473" strokeWidth="2.2" />
        <text x={x + bw + 26} y={y + bh - 24} fontSize="9" fill={ink} fontFamily="IBM Plex Sans">{`Øs ${Dsal}"`}</text>
        <line x1={x + bw - 40} y1={y + 22} x2={x + bw - 40} y2={y - 8} stroke="#1a4473" strokeWidth="2" />
        <text x={x + bw - 36} y={y - 12} fontSize="9" fill={ink} fontFamily="IBM Plex Sans">{`Ør ${Dreb}"`}</text>
        <Dim x1={x} y1={y + bh + 18} x2={x + bw} y2={y + bh + 18} label={`b = ${b.toFixed(2)} m`} />
        <Dim x1={x - 22} y1={y} x2={x - 22} y2={y + bh} label={`Hint = ${Hint.toFixed(2)} m`} vertical />
        <Dim x1={x + bw + 8} y1={y + bh - 12 - aguaH} x2={x + bw + 8} y2={y + bh - 12} label={`hu = ${hu.toFixed(2)} m`} vertical={true} side={-1} />
        <text x={x + bw / 2} y={y + bh + 40} textAnchor="middle" fontSize="10" fill={brass} fontFamily="IBM Plex Sans">
          {`V = ${Vadop} m³   ·   L = ${L.toFixed(2)} m`}
        </text>
      </svg>
    </div>
  );
}

export function CloradorSvg({
  Vs, qs, d, rAct,
}: {
  Vs: number; qs: number; d: number; rAct: number;
}) {
  return (
    <div className="diagram">
      <svg viewBox="0 0 540 220">
        <Title t="CLORACIÓN POR GOTEO  ·  HIPOCLORITO" />
        <rect x="70" y="50" width="90" height="110" rx="4" fill={conc} stroke={ink} strokeWidth="1.6" />
        <rect x="78" y="90" width="74" height="62" fill="#c5d6c8" opacity="0.8" />
        <text x="115" y="78" textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">solución</text>
        <text x="115" y="178" textAnchor="middle" fontSize="9" fill={brass} fontFamily="IBM Plex Sans">{`Vs ${Vs.toFixed(1)} L`}</text>
        <path d="M160 140 C200 140, 200 100, 250 100" stroke="#1a4473" strokeWidth="2" fill="none" />
        <circle cx="168" cy="148" r="3" fill="#1a4473" />
        <circle cx="168" cy="158" r="2.2" fill="#1a4473" opacity="0.5" />
        <rect x="250" y="70" width="160" height="90" fill={conc} stroke={ink} strokeWidth="1.6" />
        <rect x="258" y="108" width="144" height="44" fill={water} opacity="0.55" />
        <text x="330" y="98" textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">cámara / tubería</text>
        <text x="330" y="178" textAnchor="middle" fontSize="9" fill={brass} fontFamily="IBM Plex Sans">{`qs = ${qs.toFixed(2)} L/h   ·   d = ${d} mg/L   ·   ${rAct}% Cl`}</text>
      </svg>
    </div>
  );
}
