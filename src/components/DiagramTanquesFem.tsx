import type { ReactNode } from "react";
import { TorreMatricial3D } from "./DiagramTanques";

const NAVY = "#1a4473";
const INK = "#4a4030";
const FLEX = "#1a4473";
const RING = "#8b3a1e";
const SHEAR = "#2f6a8f";

function nv(values: Record<string, string>, key: string, fb: number) {
  const s = String(values[key] ?? "").trim();
  if (s === "") return fb;
  const x = Number(s.replace(",", "."));
  return Number.isFinite(x) ? x : fb;
}

function unpackPts(s: string) {
  return String(s || "")
    .split(";")
    .map((row) => {
      const [x, M] = row.split(",").map(Number);
      return { x, M };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.M));
}

function jet(t: number) {
  const v = Math.max(0, Math.min(1, t));
  const stops: { p: number; c: [number, number, number] }[] = [
    { p: 0, c: [40, 90, 168] },
    { p: 0.4, c: [43, 140, 90] },
    { p: 0.7, c: [214, 169, 45] },
    { p: 1, c: [178, 40, 40] },
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (v >= stops[i].p && v <= stops[i + 1].p) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const f = (v - a.p) / Math.max(1e-6, b.p - a.p);
  const r = Math.round(a.c[0] + (b.c[0] - a.c[0]) * f);
  const g = Math.round(a.c[1] + (b.c[1] - a.c[1]) * f);
  const bl = Math.round(a.c[2] + (b.c[2] - a.c[2]) * f);
  return `rgb(${r},${g},${bl})`;
}

function unpackMesh(s: string) {
  const raw = String(s || "").trim();
  if (!raw) return null;
  const [head, a, b] = raw.split("|");
  const [nx, nz] = (head || "").split("x").map(Number);
  if (!Number.isFinite(nx) || !Number.isFinite(nz) || nx < 2 || nz < 2) return null;
  const mxx = (a || "").split(",").map(Number).filter((v) => Number.isFinite(v));
  const myy = (b || "").split(",").map(Number).filter((v) => Number.isFinite(v));
  if (mxx.length !== nx * nz || myy.length !== nx * nz) return null;
  return { nx, nz, mxx, myy };
}

function FemMarco({
  title,
  cap,
  w,
  h,
  children,
}: {
  title: string;
  cap: string;
  w: number;
  h: number;
  children: ReactNode;
}) {
  return (
    <div className="croquis croquis-fem" data-fig-part="esfuerzos">
      <div className="croquis-head">
        <p>{title}</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
          <rect x="0" y="0" width={w} height={h} fill="#fbf8f1" />
          {children}
        </svg>
      </div>
      <p className="croquis-cap">{cap}</p>
    </div>
  );
}

function peakOf(pts: { x: number; M: number }[]) {
  if (!pts.length) return { x: 0, M: 0 };
  return pts.reduce((b, p) => (Math.abs(p.M) > Math.abs(b.M) ? p : b), pts[0]);
}

/** Diagrama 1D sobre un fuste/muro vertical: x del pack = cota desde la base. */
function BandVertical({
  pts,
  x0,
  yTop,
  yBot,
  amp,
  title,
  unit,
  color,
  nElem,
}: {
  pts: { x: number; M: number }[];
  x0: number;
  yTop: number;
  yBot: number;
  amp: number;
  title: string;
  unit: string;
  color: string;
  nElem: number;
}) {
  const Hwall = yBot - yTop;
  const xmin = pts[0]?.x ?? 0;
  const xmax = pts[pts.length - 1]?.x ?? 1;
  const peak = Math.max(0.01, ...pts.map((p) => Math.abs(p.M)));
  const yOf = (x: number) => yBot - ((x - xmin) / Math.max(xmax - xmin, 1e-6)) * Hwall;
  const xOf = (M: number) => x0 + (M / peak) * amp;
  const pk = peakOf(pts);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.M).toFixed(1)} ${yOf(p.x).toFixed(1)}`).join(" ");
  const fill = pts.length >= 2
    ? `${d} L ${x0.toFixed(1)} ${yOf(xmax).toFixed(1)} L ${x0.toFixed(1)} ${yOf(xmin).toFixed(1)} Z`
    : "";
  const ticks = Math.max(4, Math.min(nElem, 16));
  return (
    <g>
      <text x={x0} y={yTop - 16} fontSize="10" fill={NAVY} fontWeight="700">{title}</text>
      <text x={x0} y={yTop - 4} fontSize="8" fill="#6b6458">{unit}</text>
      <rect x={x0 - 10} y={yTop} width="10" height={Hwall} fill="#d9d2c3" stroke={NAVY} strokeWidth="1.1" />
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const y = yTop + (Hwall * i) / ticks;
        return <line key={i} x1={x0 - 10} y1={y} x2={x0} y2={y} stroke={NAVY} strokeWidth="0.4" opacity="0.55" />;
      })}
      <line x1={x0} y1={yTop} x2={x0} y2={yBot} stroke={NAVY} strokeWidth="1.3" />
      <line x1={x0} y1={yBot} x2={x0 + amp + 18} y2={yBot} stroke={NAVY} strokeWidth="0.8" />
      {fill ? <path d={fill} fill={color} opacity="0.22" /> : null}
      {pts.length >= 2 ? <path d={d} fill="none" stroke={color} strokeWidth="2" /> : (
        <text x={x0 + 16} y={(yTop + yBot) / 2} fontSize="8.5" fill="#8a7344">Sin serie FEM</text>
      )}
      {pts.length >= 2 ? (
        <text x={xOf(pk.M) + (pk.M >= 0 ? 6 : -6)} y={yOf(pk.x) + 3} fontSize="9" fill={color} fontWeight="700" textAnchor={pk.M >= 0 ? "start" : "end"}>
          {pk.M >= 0 ? "+" : ""}{pk.M.toFixed(2)}
        </text>
      ) : null}
      <text x={x0 - 14} y={yBot + 4} fontSize="8" fill={INK} textAnchor="end">base</text>
      <text x={x0 - 14} y={yTop + 3} fontSize="8" fill={INK} textAnchor="end">corona</text>
    </g>
  );
}

function BandHorizontal({
  pts,
  x0,
  y0,
  w,
  amp,
  title,
  unit,
  color,
}: {
  pts: { x: number; M: number }[];
  x0: number;
  y0: number;
  w: number;
  amp: number;
  title: string;
  unit: string;
  color: string;
}) {
  const xmin = pts[0]?.x ?? 0;
  const xmax = pts[pts.length - 1]?.x ?? 1;
  const peak = Math.max(0.01, ...pts.map((p) => Math.abs(p.M)));
  const xOf = (x: number) => x0 + ((x - xmin) / Math.max(xmax - xmin, 1e-6)) * w;
  const yOf = (M: number) => y0 - (M / peak) * amp;
  const pk = peakOf(pts);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.x).toFixed(1)} ${yOf(p.M).toFixed(1)}`).join(" ");
  const fill = pts.length >= 2
    ? `${d} L ${xOf(xmax).toFixed(1)} ${y0.toFixed(1)} L ${xOf(xmin).toFixed(1)} ${y0.toFixed(1)} Z`
    : "";
  return (
    <g>
      <text x={x0} y={y0 - amp - 16} fontSize="10" fill={NAVY} fontWeight="700">{title}</text>
      <text x={x0} y={y0 - amp - 4} fontSize="8" fill="#6b6458">{unit}</text>
      <line x1={x0} y1={y0} x2={x0 + w} y2={y0} stroke={NAVY} strokeWidth="1.3" />
      <rect x={x0} y={y0} width={w} height="8" fill="#d9d2c3" stroke={NAVY} strokeWidth="1" />
      {fill ? <path d={fill} fill={color} opacity="0.22" /> : null}
      {pts.length >= 2 ? <path d={d} fill="none" stroke={color} strokeWidth="2" /> : null}
      {pts.length >= 2 ? (
        <text x={xOf(pk.x)} y={yOf(pk.M) + (pk.M >= 0 ? -6 : 12)} fontSize="9" fill={color} fontWeight="700" textAnchor="middle">
          {pk.M >= 0 ? "+" : ""}{pk.M.toFixed(2)}
        </text>
      ) : null}
      <text x={x0} y={y0 + 22} fontSize="8" fill={INK}>esquina</text>
      <text x={x0 + w} y={y0 + 22} fontSize="8" fill={INK} textAnchor="end">esquina</text>
    </g>
  );
}

function Badge({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g>
      <rect x={x} y={y} width="248" height="28" rx="3" fill="#1a4473" />
      <text x={x + 10} y={y + 18} fontSize="9.5" fill="#fbf8f1" fontWeight="700" fontFamily="IBM Plex Mono, monospace">
        {text}
      </text>
    </g>
  );
}

function LegendJet({ x, y, vmax, unidad }: { x: number; y: number; vmax: number; unidad: string }) {
  const n = 18;
  const w = 12, h = 9;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={x} y={y + i * h} width={w} height={h + 0.4} fill={jet(1 - i / (n - 1))} stroke="none" />
      ))}
      <text x={x + w + 6} y={y + 8} fontSize="8" fill={INK}>{vmax.toFixed(2)} {unidad}</text>
      <text x={x + w + 6} y={y + n * h} fontSize="8" fill={INK}>0</text>
    </g>
  );
}

export function FemEsfuerzosCilindro({ values }: { values: Record<string, string> }) {
  const ptsM = unpackPts(values.mPtsEnv || "");
  const ptsN = unpackPts(values.nPtsEnv || "");
  const ptsV = unpackPts(values.vPtsEnv || "");
  const nElem = Math.max(8, Math.round(nv(values, "femElem", 40)));
  const nNodos = Math.max(nElem + 1, Math.round(nv(values, "femNodos", nElem + 1)));
  const H = nv(values, "h1", nv(values, "HL", 3.5));
  const W = 720, Ht = 430;
  const yTop = 64, yBot = 390, amp = 150;
  return (
    <FemMarco
      title="Diagramas de esfuerzos — FEM lámina cilíndrica (Hermite + Winkler de anillo)"
      cap={`Motor 1D de lámina: ${nElem} elem. de Hermite (w, θ) · ${nNodos} nudos · base empotrada, corona libre · envolvente hidrostática + sismo SRSS. H = ${H.toFixed(2)} m.`}
      w={W}
      h={Ht}
    >
      <Badge x={12} y={10} text="FEM  ·  D w'''' + (Ec e / R²) w = p(y)" />
      <BandVertical pts={ptsM} x0={46} yTop={yTop} yBot={yBot} amp={amp} title="Momento My(y)" unit="t·m/m" color={FLEX} nElem={nElem} />
      <BandVertical pts={ptsN} x0={268} yTop={yTop} yBot={yBot} amp={amp} title="Tensión de anillo Nθ(y)" unit="t/m" color={RING} nElem={nElem} />
      <BandVertical pts={ptsV} x0={490} yTop={yTop} yBot={yBot} amp={amp} title="Cortante V(y)" unit="t/m" color={SHEAR} nElem={nElem} />
    </FemMarco>
  );
}

export function FemEsfuerzosPlaca({ values }: { values: Record<string, string> }) {
  const mesh = unpackMesh(values.femMesh || "");
  const ptsMv = unpackPts(values.mPtsVert || "");
  const ptsVv = unpackPts(values.vPtsVert || "");
  const ptsMh = unpackPts(values.mPtsHorLy || values.mPtsHorLx || "");
  const nElem = Math.max(1, Math.round(nv(values, "femElem", 80)));
  const nNodos = Math.max(1, Math.round(nv(values, "femNodos", 99)));
  const L = nv(values, "Ly", nv(values, "Lx", 5));
  const H = nv(values, "Htotal", nv(values, "HL", 3.5));
  const W = 760, Ht = 500;
  const xM = 36, yM = 56, wM = 280, hM = 320;
  const nx = mesh?.nx ?? 8;
  const nz = mesh?.nz ?? 10;
  const field = mesh?.myy ?? [];
  const vmax = Math.max(0.01, ...field.map((v) => Math.abs(v)), ...ptsMv.map((p) => Math.abs(p.M)));
  return (
    <FemMarco
      title="Mapa de esfuerzos — FEM placa MITC4 (Bathe–Dvorkin)"
      cap={`Malla ${nx}×${nz} = ${nElem} elem. MITC4 · ${nNodos} nudos · base empotrada · esquinas θz=0 · corona apoyada. Envolvente |Mhs| + SRSS. L = ${L.toFixed(2)} m · H = ${H.toFixed(2)} m.`}
      w={W}
      h={Ht}
    >
      <Badge x={12} y={10} text="FEM  ·  placa MITC4  ·  myy / mxx de Gauss 2×2" />
      <text x={xM} y={yM - 8} fontSize="10" fill={NAVY} fontWeight="700">Muro — myy (flexión vertical)</text>
      {mesh
        ? Array.from({ length: nz }, (_, iz) =>
            Array.from({ length: nx }, (_, ix) => {
              const v = Math.abs(field[iz * nx + ix] ?? 0);
              return (
                <rect
                  key={`${iz}-${ix}`}
                  x={xM + (ix / nx) * wM}
                  y={yM + ((nz - 1 - iz) / nz) * hM}
                  width={wM / nx + 0.4}
                  height={hM / nz + 0.4}
                  fill={jet(v / vmax)}
                  stroke="#fbf8f1"
                  strokeWidth="0.3"
                />
              );
            }),
          )
        : (
          <g>
            <rect x={xM} y={yM} width={wM} height={hM} fill="#d9d2c3" stroke={NAVY} />
            {Array.from({ length: nx + 1 }, (_, i) => (
              <line key={`v${i}`} x1={xM + (i / nx) * wM} y1={yM} x2={xM + (i / nx) * wM} y2={yM + hM} stroke={NAVY} strokeWidth="0.5" opacity="0.35" />
            ))}
            {Array.from({ length: nz + 1 }, (_, i) => (
              <line key={`h${i}`} x1={xM} y1={yM + (i / nz) * hM} x2={xM + wM} y2={yM + (i / nz) * hM} stroke={NAVY} strokeWidth="0.5" opacity="0.35" />
            ))}
          </g>
        )}
      <rect x={xM} y={yM} width={wM} height={hM} fill="none" stroke={NAVY} strokeWidth="1.2" />
      <text x={xM - 8} y={yM + 4} fontSize="8" fill={INK} textAnchor="end">corona</text>
      <text x={xM - 8} y={yM + hM} fontSize="8" fill={INK} textAnchor="end">base</text>
      <LegendJet x={xM + wM + 8} y={yM} vmax={vmax} unidad="t·m/m" />
      <BandVertical pts={ptsMv} x0={360} yTop={yM} yBot={yM + hM} amp={130} title="My franja central" unit="t·m/m" color={FLEX} nElem={nz} />
      <BandVertical pts={ptsVv} x0={560} yTop={yM} yBot={yM + hM} amp={110} title="Vy franja central" unit="t/m" color={SHEAR} nElem={nz} />
      <BandHorizontal pts={ptsMh} x0={xM} y0={yM + hM + 78} w={wM} amp={48} title="Mxx franja a ~0,25 H (esquina → vano → esquina)" unit="t·m/m" color={RING} />
    </FemMarco>
  );
}

export function FemEsfuerzosFuste({ values }: { values: Record<string, string> }) {
  const ptsM = unpackPts(values.mPtsFuste || "");
  const ptsV = unpackPts(values.vPtsFuste || "");
  const ptsN = unpackPts(values.nPtsFuste || "");
  const nElem = Math.max(8, Math.round(nv(values, "femElem", 16)));
  const nNodos = Math.max(nElem + 1, Math.round(nv(values, "femNodos", nElem + 1)));
  const H = nv(values, "Htorre", 16);
  const W = 720, Ht = 430;
  const yTop = 64, yBot = 390, amp = 150;
  return (
    <FemMarco
      title="Diagramas de esfuerzos — FEM tubo anular en voladizo (12 GDL)"
      cap={`Motor de pórtico espacial: ${nElem} elem. anulares · ${nNodos} nudos · nudo maestro de cuba en hi/hc (enlace ×300) · SRSS impulsivo+convectivo. H = ${H.toFixed(2)} m.`}
      w={W}
      h={Ht}
    >
      <Badge x={12} y={10} text="FEM  ·  tubo anular 12 GDL  ·  k = 1/δ(F=1 en hi)" />
      <BandVertical pts={ptsM} x0={46} yTop={yTop} yBot={yBot} amp={amp} title="Momento M(z)" unit="t·m" color={FLEX} nElem={nElem} />
      <BandVertical pts={ptsV} x0={268} yTop={yTop} yBot={yBot} amp={amp} title="Cortante V(z)" unit="t" color={SHEAR} nElem={nElem} />
      <BandVertical pts={ptsN} x0={490} yTop={yTop} yBot={yBot} amp={amp} title="Axial N(z)" unit="t" color={RING} nElem={nElem} />
    </FemMarco>
  );
}

export function FemEsfuerzosTorre({ values }: { values: Record<string, string> }) {
  const nodes = String(values.nodes3D || "");
  if (!nodes) {
    return (
      <FemMarco title="Modelo matricial 3D — pórtico espacial 12 GDL" cap="Pulse Calcular para ensamblar la torre (columnas, vigas de anillo y diagonales en X) y colorear cada barra por utilización." w={560} h={220}>
        <Badge x={12} y={16} text="FEM  ·  K = Σ Tᵀ kℓ T  ·  Ku = F" />
        <text x={28} y={120} fontSize="12" fill={INK}>El motor de rigidez directa entrega M, V y N en cada elemento.</text>
      </FemMarco>
    );
  }
  return <TorreMatricial3D values={values} />;
}

export function TanqueFemBoard({
  kind,
  geom,
  values,
}: {
  kind: "reservorioApoyado" | "reservorioCuadrado" | "tanqueElevadoColumnas" | "tanqueElevadoFuste";
  geom: ReactNode;
  values: Record<string, string>;
}) {
  const fem =
    kind === "reservorioApoyado" ? <FemEsfuerzosCilindro values={values} />
    : kind === "reservorioCuadrado" ? <FemEsfuerzosPlaca values={values} />
    : kind === "tanqueElevadoColumnas" ? (
      <>
        <FemEsfuerzosCilindro values={values} />
        <FemEsfuerzosTorre values={values} />
      </>
    ) : (
      <>
        <FemEsfuerzosCilindro values={values} />
        <FemEsfuerzosFuste values={values} />
      </>
    );
  return (
    <div className="fig-stack fig-stack-tanque">
      {geom}
      {fem}
    </div>
  );
}
