import { DiagramaCuerpoLibreFig, ElementoDiagramaFig, TorreMatricial3D, type DiagramaSpec } from "./DiagramTanques";
import { DclMuroVoladizo } from "./DclMuroVoladizo";
import { SteelSectionFig } from "./SteelSectionFig";
import { DentellonMuroFig, SismoEstriboFig, SismoMuroFig } from "./MuroDidactica";
import { specAnilloViga, specCascaron1m, specColumnaCircular, specFranja1m, specFustePared, specMuroVoladizo, specVigaRect } from "../lib/steelDraft";
import {
  specEstriboPantalla,
  specLosaFromValues,
  specPlateaFromValues,
  specVigaCimentacion,
  specZapataCorridaTrans,
} from "../lib/steelEngine";
import { parseGrid } from "../lib/layoutGrid";
import { CorridaIsoFig } from "./CorridaColumnas";
import { MaeMomentStrip, MaePunchFromDims } from "./maestria/MaeFigs";

export function unpackMomentos(s: string) {
  return String(s || "")
    .split(";")
    .map((row) => {
      const [x, M] = row.split(",").map(Number);
      return { x, M };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.M));
}

export function packMomentos(pts: { x: number; M: number }[]) {
  return pts.map((p) => `${p.x.toFixed(3)},${p.M.toFixed(3)}`).join(";");
}

type Shape = "cantilever" | "simple" | "fixed" | "polyline";

type Props = {
  zona: string;
  formula: string;
  L: number;
  shape: Shape;
  /** Pico positivo (tracción inferior / vano), t·m o t·m/m */
  MuPos?: number;
  /** Pico negativo (tracción superior / apoyo), valor absoluto */
  MuNeg?: number;
  /** Polilínea x [m], M [t·m] */
  pts?: { x: number; M: number }[];
  acero: string;
  As?: string;
  cara: string;
  unidad?: string;
  note?: string;
  leftLabel?: string;
  rightLabel?: string;
  kind?: "M" | "V";
};

function sampleShape(shape: Shape, L: number, MuPos: number, MuNeg: number, n = 32) {
  const pts: { x: number; M: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = t * L;
    let M = 0;
    if (shape === "cantilever") M = MuPos * t * t;
    else if (shape === "simple") M = 4 * MuPos * t * (1 - t);
    else M = 4 * MuPos * t * (1 - t) - MuNeg * (1 - 4 * t * (1 - t));
    pts.push({ x, M });
  }
  return pts;
}

export function MomentoZonaFig({
  zona,
  formula,
  L,
  shape,
  MuPos = 0,
  MuNeg = 0,
  pts: ptsIn,
  acero,
  As,
  cara,
  unidad = "t·m",
  note,
  leftLabel = "Libre / arranque",
  rightLabel = "Cara / apoyo",
  kind = "M",
}: Props) {
  const Luse = Math.max(L, 0.05);
  const raw = ptsIn && ptsIn.length >= 2 ? ptsIn : sampleShape(shape, Luse, MuPos, MuNeg);
  const peak = Math.max(0.05, ...raw.map((p) => Math.abs(p.M)), Math.abs(MuPos), Math.abs(MuNeg));
  const W = 540;
  const H = 312;
  const x0 = 64;
  const x1 = 508;
  const y0 = 132;
  const amp = 78;
  const boxY = 252;
  const boxH = 48;
  const xOf = (x: number) => x0 + ((x - raw[0].x) / Math.max(raw[raw.length - 1].x - raw[0].x, 1e-6)) * (x1 - x0);
  const yOf = (M: number) => y0 - (M / peak) * amp;
  const d = raw.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.x).toFixed(1)} ${yOf(p.M).toFixed(1)}`).join(" ");
  const fill = `${d} L ${xOf(raw[raw.length - 1].x).toFixed(1)} ${y0} L ${xOf(raw[0].x).toFixed(1)} ${y0} Z`;
  const iMax = raw.reduce((b, p, i, a) => (p.M > a[b].M ? i : b), 0);
  const iMin = raw.reduce((b, p, i, a) => (p.M < a[b].M ? i : b), 0);
  const mPlus = raw[iMax].M > 0.008 ? raw[iMax] : null;
  const mMinus = raw[iMin].M < -0.008 ? raw[iMin] : null;
  const yPlus = mPlus ? Math.max(yOf(mPlus.M) - 10, 52) : 0;
  const yMinus = mMinus ? Math.min(yOf(mMinus.M) + 16, boxY - 10) : 0;

  return (
    <div className="croquis croquis-compact croquis-momento" data-fig-part="momento">
      <div className="croquis-head">
        <p>{`${kind === "V" ? "Cortante" : "Momento flector"} · ${zona}`}</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <rect x="0" y="0" width={W} height={H} fill="#fbf8f1" />
      <text x="16" y="22" fontSize="11" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif" fontWeight="600">
        {zona}
      </text>
      <text x="16" y="38" fontSize="9" fill="#6b6458" fontFamily="IBM Plex Sans, sans-serif">
        {formula}
      </text>
      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke="#1a4473" strokeWidth="1.4" />
      <path d={fill} fill="rgba(26,68,115,0.12)" />
      <path d={d} fill="none" stroke="#1a4473" strokeWidth="1.8" />
      <line x1={x0} y1={y0 - 7} x2={x0} y2={y0 + 7} stroke="#1a4473" strokeWidth="1.3" />
      <line x1={x1} y1={y0 - 7} x2={x1} y2={y0 + 7} stroke="#1a4473" strokeWidth="1.3" />
      <text x={x0} y={y0 + 22} textAnchor="middle" fontSize="8" fill="#6b6458" fontFamily="IBM Plex Sans, sans-serif">
        {leftLabel}
      </text>
      <text x={x1} y={y0 + 22} textAnchor="middle" fontSize="8" fill="#6b6458" fontFamily="IBM Plex Sans, sans-serif">
        {rightLabel}
      </text>
      <text x={(x0 + x1) / 2} y={y0 + 22} textAnchor="middle" fontSize="8.5" fill="#1a4473" fontFamily="IBM Plex Mono, monospace">
        {`ℓ = ${Luse.toFixed(2)} m`}
      </text>
      <text x="12" y={y0 - amp + 4} fontSize="8" fill="#1f6b3a" fontFamily="IBM Plex Mono, monospace">
        {`+${peak.toFixed(2)}`}
      </text>
      <text x="12" y={y0 + 3} fontSize="8" fill="#6b6458" fontFamily="IBM Plex Mono, monospace">
        0
      </text>
      <text x="12" y={y0 + amp + 4} fontSize="8" fill="#8b1e1e" fontFamily="IBM Plex Mono, monospace">
        {`−${peak.toFixed(2)}`}
      </text>
      {mPlus ? (
        <text x={Math.min(Math.max(xOf(mPlus.x), x0 + 36), x1 - 36)} y={yPlus} textAnchor="middle" fontSize="9.5" fill="#1f6b3a" fontFamily="IBM Plex Mono, monospace" fontWeight="600">
          {`+${mPlus.M.toFixed(2)} ${unidad}`}
        </text>
      ) : null}
      {mMinus ? (
        <text x={Math.min(Math.max(xOf(mMinus.x), x0 + 44), x1 - 44)} y={yMinus} textAnchor="middle" fontSize="9.5" fill="#8b1e1e" fontFamily="IBM Plex Mono, monospace" fontWeight="600">
          {`−${Math.abs(mMinus.M).toFixed(2)} ${unidad}`}
        </text>
      ) : null}
      <rect x="14" y={boxY} width="512" height={boxH} fill="#f4efe3" stroke="#c4b48a" strokeWidth="0.8" />
      <text x="24" y={boxY + 20} fontSize="9.5" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        {`Acero de diseño: ${acero}${As ? `   ·   As = ${As} cm²/m` : ""}`}
      </text>
      <text x="24" y={boxY + 36} fontSize="8.5" fill="#5a4a28" fontFamily="IBM Plex Sans, sans-serif">
        {note ?? `Cara traccionada: ${cara}. Convención: + vano / inferior · − apoyo / superior.`}
      </text>
        </svg>
      </div>
      <p className="croquis-cap">{`${formula}  ·  Acero: ${acero}${As ? `  (As = ${As} cm²/m)` : ""}  ·  ${cara}`}</p>
    </div>
  );
}

function nv(v: Record<string, string>, k: string, fb = 0) {
  const s = String(v[k] ?? "").trim().replace(",", ".");
  if (s === "") return fb;
  const x = Number(s);
  return Number.isFinite(x) ? x : fb;
}

function sv(v: Record<string, string>, k: string, fb = "") {
  const s = String(v[k] ?? "").trim();
  return s || fb;
}

function sampleShearSimple(L: number, VA: number, n = 24) {
  const pts: { x: number; M: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: t * L, M: VA * (1 - 2 * t) });
  }
  return pts;
}

function sampleShearCantilever(L: number, Vu: number, n = 24) {
  const pts: { x: number; M: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: t * L, M: Vu * t * t });
  }
  return pts;
}

function VigaSeccionArmadaFig({ values }: { values: Record<string, string> }) {
  return <SteelSectionFig spec={specVigaRect(values)} />;
}

function MuroSeccionArmadaFig({ values }: { values: Record<string, string> }) {
  return <SteelSectionFig spec={specMuroVoladizo(values)} />;
}

function MuroDeflexFig({ values }: { values: Record<string, string> }) {
  const Hs = nv(values, "Hs", nv(values, "H", 4));
  const delta = nv(values, "deltaAlma", 0.5);
  const deltaAdm = nv(values, "deltaAdm", 2.7);
  const F = nv(values, "F", 0.4);
  const Fuser = nv(values, "Fuser", F);
  const ok = delta <= deltaAdm + 1e-9;
  const Ht = 280;
  const yTop = 40;
  const yBot = 218;
  const x0 = 88;
  const amp = Math.min(78, 16 + Math.min(delta, deltaAdm * 2.2) * (52 / Math.max(deltaAdm, 0.4)));
  const dPath = `M ${x0} ${yBot} Q ${x0 + amp * 0.35} ${(yTop + yBot) / 2} ${x0 + amp} ${yTop}`;
  return (
    <div className="croquis croquis-compact" data-fig-part="momento">
      <div className="croquis-head">
        <p>Deflexión de servicio de la pantalla</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={`0 0 460 ${Ht}`} preserveAspectRatio="xMidYMid meet">
          <rect x="0" y="0" width="460" height={Ht} fill="#fbf8f1" />
          <text x="230" y="18" textAnchor="middle" fontSize="11" fill="#1a4473" fontWeight="600">
            Voladizo empotrado — flecha en coronación
          </text>
          <line x1="46" y1={yBot} x2="210" y2={yBot} stroke="#8a7a55" strokeWidth="3" />
          <rect x={x0 - 10} y={yTop} width="20" height={yBot - yTop} fill="#d9d2c3" stroke="#1a4473" strokeWidth="1.4" />
          <path d={dPath} fill="none" stroke={ok ? "#1f6b3a" : "#8b1e1e"} strokeWidth="2" strokeDasharray="6,3" />
          <line x1={x0 + 10} y1={yTop} x2={x0 + amp} y2={yTop} stroke={ok ? "#1f6b3a" : "#8b1e1e"} strokeWidth="1" />
          <text x={x0 + amp / 2 + 16} y={yTop - 6} fontSize="9" fill={ok ? "#1f6b3a" : "#8b1e1e"} textAnchor="middle">
            δ = {delta.toFixed(2)} cm
          </text>
          <text x="236" y="86" fontSize="9" fill="#1a4473">
            {`Hs = ${Hs.toFixed(2)} m    ·    F = ${F.toFixed(2)} m`}
          </text>
          <text x="236" y="104" fontSize="9" fill="#1a4473">
            {`δadm = Hs/150 = ${deltaAdm.toFixed(2)} cm`}
          </text>
          <text x="236" y="124" fontSize="10" fontWeight="700" fill={ok ? "#1f6b3a" : "#8b1e1e"}>
            {ok ? "CUMPLE  ·  δ ≤ δadm" : "NO CUMPLE  ·  se engrosa F"}
          </text>
          {Math.abs(F - Fuser) > 0.02 ? (
            <text x="236" y="142" fontSize="8.5" fill="#1a4473">
              {`F ensayo ${Fuser.toFixed(2)} m → F adoptado ${F.toFixed(2)} m`}
            </text>
          ) : null}
          <text x="16" y="258" fontSize="8" fill="#5a4a28">
            Ie de Branson. Elástica M(x)/(Ec Ie). Si no cumple, F sube de 5 en 5 cm hasta δ ≤ Hs/150.
          </text>
        </svg>
      </div>
      <p className="croquis-cap">{`${ok ? "CUMPLE" : "NO CUMPLE"}   ·   δmáx = ${delta.toFixed(2)} cm   ·   δadm = ${deltaAdm.toFixed(2)} cm (Hs/150)   ·   F = ${F.toFixed(2)} m`}</p>
    </div>
  );
}

/** Figuras de momento por zona, según el croquis de la hoja. */
export function figuraMomento(kind: string, part: string | undefined, values: Record<string, string>) {
  if (!part?.startsWith("m")) return null;
  if (part === "mGeom" || part === "mPlant") return null;
  if (part === "mDCL") {
    if (kind === "reservorioApoyado") return <DiagramaCuerpoLibreFig values={values} variant="cilindro" />;
    if (kind === "reservorioCuadrado") return <DiagramaCuerpoLibreFig values={values} variant="caja" />;
    if (kind === "tanqueElevadoColumnas") return <DiagramaCuerpoLibreFig values={values} variant="torreColumnas" />;
    if (kind === "tanqueElevadoFuste") return <DiagramaCuerpoLibreFig values={values} variant="torre" />;
    if (kind === "muroContencion") return <DclMuroVoladizo values={values} />;
  }
  if (kind === "vigaSeccion" || kind === "vigaEstribos") {
    if (part === "mFlexM") {
      return (
        <MomentoZonaFig
          zona="Viga simplemente apoyada — momento flector M(x) que dimensiona el acero de tracción"
          formula="M(x) = wu x (L − x)/2    ·    Mu = wu L²/8 (vano)"
          L={nv(values, "L", 6)}
          shape="simple"
          MuPos={nv(values, "Mu")}
          acero={sv(values, "asLong", "lecho inferior")}
          As={sv(values, "As")}
          cara="inferior · tracción en el vano"
          unidad="t·m"
          leftLabel="Apoyo A"
          rightLabel="Apoyo B"
          note="El pico Mu al centro es el momento que entra al cálculo de As (pasos 03–06). Tracción abajo."
        />
      );
    }
    if (part === "mFlexV") {
      const L = nv(values, "L", 6);
      const VA = nv(values, "VA", nv(values, "Vu", 0));
      return (
        <ElementoDiagramaFig
          titulo="Viga simplemente apoyada — cortante V(x) que dimensiona los estribos"
          formula="V(x) = wu (L/2 − x)    ·    VA = wu L/2    ·    Vu a distancia d del paño"
          shape="franja"
          dim1={nv(values, "h", 50)}
          ejeLabel="Apoyo A → vano → apoyo B"
          diagramas={[{ etiqueta: "Cortante V(x)", unidad: "t", pts: sampleShearSimple(L, Math.max(VA, 0.01)) }]}
          aceroPrincipal={`Estribos Ø ${sv(values, "barEst", '3/8"')}  ·  ${sv(values, "arreglo", "—")}`}
          aceroSecundario="El acero de corte no es el de flexión: se calcula con Vu, Vc y Vs (pasos 07–14)."
          nota="V cambia de signo en el centro. La sección crítica a cortante está a una distancia d de la cara del apoyo."
        />
      );
    }
    if (part === "mFlexSec") return <VigaSeccionArmadaFig values={values} />;
  }
  if (kind === "zapata") {
    if (part === "mDirL") {
      return (
        <MomentoZonaFig
          zona="Zapata aislada — voladizo en X (cara de columna, sentido L)"
          formula="Mu = qu,máx · B · ℓv,X² / 2"
          L={nv(values, "lvX", 0.8)}
          shape="cantilever"
          MuPos={nv(values, "MuL")}
          acero={sv(values, "asL", 'Ø 1/2"')}
          As={sv(values, "AsL")}
          cara="inferior · cara del suelo"
          unidad="t·m"
          leftLabel="Borde libre"
          rightLabel="Cara de columna"
          note="Voladizo con presión última. Tracción en la cara del suelo: malla inferior paralela a L."
        />
      );
    }
    if (part === "mDirB") {
      return (
        <MomentoZonaFig
          zona="Zapata aislada — voladizo en Y (cara de columna, sentido B)"
          formula="Mu = qu,máx · L · ℓv,Y² / 2"
          L={nv(values, "lvY", 0.8)}
          shape="cantilever"
          MuPos={nv(values, "MuB")}
          acero={sv(values, "asB", 'Ø 1/2"')}
          As={sv(values, "AsB")}
          cara="inferior · cara del suelo"
          unidad="t·m"
          leftLabel="Borde libre"
          rightLabel="Cara de columna"
          note="Voladizo ortogonal. Tracción en la cara del suelo: malla inferior paralela a B."
        />
      );
    }
    if (part === "mSeccion") {
      const hf = nv(values, "hf", 0.5);
      return (
        <SteelSectionFig
          spec={specFranja1m({
            title: "Zapata aislada — malla inferior, franja 1,00 m",
            hCm: hf < 8 ? hf * 100 : hf,
            recCm: nv(values, "rec", 7.5),
            infText: sv(values, "asL", 'Ø 1/2" @ 15'),
            distText: sv(values, "asB", 'Ø 1/2" @ 15'),
          })}
        />
      );
    }
  }
  if (kind === "zapataComb") {
    if (part === "mLong") {
      return (
        <MomentoZonaFig
          zona="Zapata combinada — viga invertida (eje longitudinal)"
          formula="M(x) = w x²/2 − Σ Pu (x − xi) + Σ M3u"
          L={nv(values, "Lz", nv(values, "L", 7))}
          shape="polyline"
          pts={unpackMomentos(sv(values, "mPts"))}
          MuPos={nv(values, "Mtop")}
          MuNeg={nv(values, "Msoil")}
          acero={sv(values, "asLong", 'Ø 3/4" inf. / Ø 1/2" sup.')}
          As={sv(values, "AsInf")}
          cara="M− cara del suelo (inf.) · M+ vuelos (sup.)"
          unidad="t·m"
          leftLabel="Borde A"
          rightLabel="Borde B"
          note="Entre columnas el momento tracciona la cara del suelo (acero inferior continuo). En vuelos, tracción superior. M3u = λ(M3+P1·h) entra como momento concentrado en cada pedestal."
        />
      );
    }
    if (part === "mTrans") {
      return (
        <MomentoZonaFig
          zona="Zapata combinada — flexión transversal bajo columnas"
          formula="Mu = qu · ℓv² / 2   (por metro, cara de columna)"
          L={Math.max(nv(values, "lvA"), nv(values, "lvB"), 0.3)}
          shape="cantilever"
          MuPos={nv(values, "MuTr")}
          acero={sv(values, "asTr", 'Ø 1/2"')}
          As={sv(values, "AsTr")}
          cara="inferior · cara del suelo, bajo A y B"
          unidad="t·m/m"
          leftLabel="Borde transversal"
          rightLabel="Cara de columna"
          note="En el sentido corto cada pedestal trabaja como zapata aislada. Barras bajo el pedestal, ancladas ℓd más allá de la cara."
        />
      );
    }
  }
  if (kind === "zapataCorrida") {
    if (part === "mTrans") {
      const pts = unpackMomentos(sv(values, "mPtsTrans"));
      return (
        <MomentoZonaFig
          zona="Zapata corrida — voladizos transversales"
          formula="Mu(x) = qu · x² / 2   (x desde el borde libre, t·m/m)"
          L={Math.max(nv(values, "lvL"), nv(values, "lvR"), 0.3)}
          shape={pts.length >= 2 ? "polyline" : "cantilever"}
          pts={pts.length >= 2 ? pts : undefined}
          MuPos={nv(values, "MuCorr")}
          acero={sv(values, "asPrin", 'Ø 1/2"')}
          As={sv(values, "AsPrin")}
          cara="inferior · perpendicular al eje · un juego por paño"
          unidad="t·m/m"
          leftLabel="Borde de zapata"
          rightLabel="Cara del muro / columna"
          note="El vuelo se arma en el lecho inferior (cara del suelo). El despiece se dibuja en planta: no hay corte transversal de la sección T ni acero a media altura."
        />
      );
    }
    if (part === "mShear") {
      const pts = unpackMomentos(sv(values, "vPtsTrans"));
      return (
        <MomentoZonaFig
          kind="V"
          zona="Zapata corrida — cortante en una dirección"
          formula="Vu(x) = qu · x    ·    sección crítica a d de la cara"
          L={Math.max(nv(values, "lvL"), nv(values, "lvR"), 0.3)}
          shape={pts.length >= 2 ? "polyline" : "cantilever"}
          pts={pts.length >= 2 ? pts : undefined}
          MuPos={nv(values, "lvL") * Math.max(nv(values, "MuCorr"), 0.1)}
          acero={sv(values, "asPrin", 'Ø 1/2"')}
          cara="flujo transversal · E.060 11.3"
          unidad="t/m"
          leftLabel="Borde libre"
          rightLabel="Cara (x = ℓv)"
          note="V = 0 en el borde. La verificación φVc se hace a d de la cara, no en el arranque del muro."
        />
      );
    }
    if (part === "mLong") {
      const pts = unpackMomentos(sv(values, "mPts"));
      return (
        <MomentoZonaFig
          zona="Zapata corrida — viga invertida (momento)"
          formula="M(x)  ·  q(x)=a+bx con ΣV=0 y ΣM=0 (extremos libres)"
          L={nv(values, "Lbeam", nv(values, "L", 12))}
          shape={pts.length >= 2 ? "polyline" : "fixed"}
          pts={pts.length >= 2 ? pts : undefined}
          MuPos={nv(values, "Mtop")}
          MuNeg={nv(values, "Msoil")}
          acero={sv(values, "asLong", 'Ø 1/2"')}
          As={sv(values, "AsLong")}
          cara="inferior continuo entre apoyos · superior en extremos"
          unidad="t·m"
          leftLabel="Columna 1"
          rightLabel="Última columna"
          note="Viga invertida de extremos libres: q(x) se calibra a las columnas (ΣV=0, ΣM=0). M(0)=M(L)=0. Inferior continuo (M− cara del suelo); superior cortado L_teo+ℓd (M+ en vuelos). Un VC sin columnas no gobierna."
        />
      );
    }
    if (part === "mSecTrans") return <SteelSectionFig spec={specZapataCorridaTrans(values)} />;
    if (part === "mSecLong") {
      const pts = unpackMomentos(sv(values, "vPts"));
      if (pts.length >= 2) {
        return (
          <MomentoZonaFig
            kind="V"
            zona="Zapata corrida — cortante de viga invertida"
            formula="V(x) = w x − Σ Pu"
            L={nv(values, "Lbeam", nv(values, "L", 12))}
            shape="polyline"
            pts={pts}
            acero={sv(values, "asLong", 'Ø 1/2"')}
            As={sv(values, "AsLong")}
            cara="equilibrio de la línea de columnas"
            unidad="t"
            leftLabel="Extremo 1"
            rightLabel="Extremo 2"
            note="Saltos en V en cada columna. En x = L el cortante debe cerrar el equilibrio."
          />
        );
      }
      return <SteelSectionFig spec={specZapataCorridaTrans(values)} />;
    }
    if (part === "mIso") return <CorridaIsoFig values={values} />;
    if (part === "mVC") {
      return <SteelSectionFig spec={specVigaCimentacion(values)} />;
    }
  }
  if (kind === "platea") {
    const map: Record<string, { zona: string; key: string; b: string }> = {
      mIntX: { zona: "Platea — franja interior eje X · momentos inf/sup", key: "mPtsIntX", b: "bIntX" },
      mEdgX: { zona: "Platea — franja de borde eje X · momentos inf/sup", key: "mPtsEdgX", b: "bEdgX" },
      mIntY: { zona: "Platea — franja interior eje Y · momentos inf/sup", key: "mPtsIntY", b: "bIntY" },
      mEdgY: { zona: "Platea — franja de borde eje Y · momentos inf/sup", key: "mPtsEdgY", b: "bEdgY" },
    };
    const spec = map[part];
    if (spec) {
      const pts = unpackMomentos(sv(values, spec.key));
      const L = pts.length >= 2 ? pts[pts.length - 1].x : nv(values, part.includes("Y") ? "Ly" : "Lx", 16);
      return (
        <MomentoZonaFig
          zona={spec.zona}
          formula={`Motor FEM viga invertida  ·  M(x)  ·  b = ${nv(values, spec.b, 5).toFixed(2)} m`}
          L={L}
          shape={pts.length >= 2 ? "polyline" : "fixed"}
          pts={pts.length >= 2 ? pts : undefined}
          MuPos={nv(values, `${part}Mpos`)}
          MuNeg={nv(values, `${part}Mneg`)}
          acero={sv(values, part.includes("Y") ? "asInfY" : "asInfX", sv(values, "asPos", 'Ø 1/2" inf. / Ø 1/2" sup.'))}
          As={sv(values, "AsPos")}
          cara="M− lecho inf. continuo (cara del suelo) · M+ lecho sup. cortado L_teo+ℓd"
          unidad="t·m"
          leftLabel="Vuelo / borde"
          rightLabel="Vuelo / borde"
          note="Cada franja tiene motor propio. Inferior corrido de extremo a extremo. Superior cortado sobre ejes de columna: L_teo (0,30 ℓn) + ℓd, medido desde el eje al extremo de la barra."
        />
      );
    }
    const vmap: Record<string, { zona: string; key: string; vmax: string; b: string }> = {
      vIntX: { zona: "Platea — franja interior X · cortante", key: "vPtsIntX", vmax: "vIntXVmax", b: "bIntX" },
      vEdgX: { zona: "Platea — franja de borde X · cortante", key: "vPtsEdgX", vmax: "vEdgXVmax", b: "bEdgX" },
      vIntY: { zona: "Platea — franja interior Y · cortante", key: "vPtsIntY", vmax: "vIntYVmax", b: "bIntY" },
      vEdgY: { zona: "Platea — franja de borde Y · cortante", key: "vPtsEdgY", vmax: "vEdgYVmax", b: "bEdgY" },
    };
    const vspec = vmap[part];
    if (vspec) {
      const pts = unpackMomentos(sv(values, vspec.key));
      const L = pts.length >= 2 ? pts[pts.length - 1].x : nv(values, part.includes("Y") ? "Ly" : "Lx", 16);
      return (
        <MomentoZonaFig
          kind="V"
          zona={vspec.zona}
          formula={`V(x) = ∫q − Σ Pu  ·  b = ${nv(values, vspec.b, 5).toFixed(2)} m`}
          L={L}
          shape={pts.length >= 2 ? "polyline" : "fixed"}
          pts={pts.length >= 2 ? pts : undefined}
          MuPos={nv(values, vspec.vmax)}
          acero={sv(values, "asInfX", 'Ø 1/2"')}
          cara="saltos en cada columna de la franja · V(L) ≈ 0"
          unidad="t"
          leftLabel="Extremo 1"
          rightLabel="Extremo 2"
          note="Motor FEM de la misma franja que el diagrama de momentos. Los saltos de V coinciden con las Pu de la fila."
        />
      );
    }
    if (part === "mBeamM") {
      const pts = unpackMomentos(sv(values, "mPts"));
      return (
        <MomentoZonaFig
          zona="Platea — viga de cimentación (momentos) · h = ℓn/7"
          formula="M(x)  ·  q(x)=a+bx  ·  h = ℓn/7"
          L={nv(values, "Lbeam", nv(values, "Lx", 16))}
          shape={pts.length >= 2 ? "polyline" : "fixed"}
          pts={pts.length >= 2 ? pts : undefined}
          MuPos={nv(values, "Mtop")}
          MuNeg={nv(values, "Msoil")}
          acero={sv(values, "asVCInf", '3 Ø 3/4"')}
          As={sv(values, "AsVCInf")}
          cara="M− inf. continuo · M+ sup. L_teo+ℓd · predimensión ℓn/7"
          unidad="t·m"
          leftLabel="Extremo 1"
          rightLabel="Extremo 2"
          note={`Motor propio de VC. Luz libre ℓn = ${nv(values, "lnVC", 0).toFixed(2) || "—"} m → h_pred = ${nv(values, "hPred", 0).toFixed(2) || "—"} m. Inferior corrido; superior cortado desde el eje.`}
        />
      );
    }
    if (part === "mBeamV") {
      const pts = unpackMomentos(sv(values, "vPts"));
      return (
        <MomentoZonaFig
          kind="V"
          zona="Platea — viga de cimentación (cortante)"
          formula="V(x) = ∫q − Σ Pu"
          L={nv(values, "Lbeam", nv(values, "Lx", 16))}
          shape={pts.length >= 2 ? "polyline" : "fixed"}
          pts={pts.length >= 2 ? pts : undefined}
          MuPos={nv(values, "VmaxVC", nv(values, "vIntXVmax"))}
          acero={sv(values, "estVC", '2Ø 3/8"')}
          cara="equilibrio del tramo de VC"
          unidad="t"
          leftLabel="Extremo 1"
          rightLabel="Extremo 2"
          note="Saltos de V en cada columna del tramo. En x = L el cortante cierra el equilibrio (extremos libres)."
        />
      );
    }
    if (part === "mSteel") {
      const nx = Math.max(1, Math.round(nv(values, "nBayX", 3)));
      const ny = Math.max(1, Math.round(nv(values, "nBayY", 3)));
      const Sx = nv(values, "Sx", 5);
      const Sy = nv(values, "Sy", 5);
      const ox = nv(values, "ox", 0.5);
      const oy = nv(values, "oy", 0.5);
      const grid = parseGrid(sv(values, "gridJson"), {
        axesX: Array.from({ length: nx + 1 }, (_, i) => ox + i * Sx),
        axesY: Array.from({ length: ny + 1 }, (_, i) => oy + i * Sy),
        panes: Array.from({ length: ny }, () => Array.from({ length: nx }, () => true)),
        cols: [],
      });
      return <SteelSectionFig spec={specPlateaFromValues(values, grid)} />;
    }
    if (part === "mVC") {
      return <SteelSectionFig spec={specVigaCimentacion(values)} />;
    }
  }
  if (kind === "escalera") {
    const map: Record<string, { zona: string; L: string; pos: string; neg: string; as: string; asN: string; form: string }> = {
      mT1: {
        zona: "Escalera — tramo 1 (inclinado)",
        L: "Lh1",
        pos: "muT1",
        neg: "muN1",
        as: "asT1",
        asN: "asNeg",
        form: "Mu⁺ = wu Lh²/8    ·    Mu⁻ = wu Lh²/10",
      },
      mDesc: {
        zona: "Escalera — descanso (losa horizontal)",
        L: "LhD",
        pos: "muD",
        neg: "muND",
        as: "asD",
        asN: "asNegD",
        form: "Mu⁺ = wu a²/8    ·    Mu⁻ = wu a²/12",
      },
      mT2: {
        zona: "Escalera — tramo 2 (inclinado)",
        L: "Lh2",
        pos: "muT2",
        neg: "muN2",
        as: "asT2",
        asN: "asNeg2",
        form: "Mu⁺ = wu Lh²/8    ·    Mu⁻ = wu Lh²/10",
      },
    };
    const spec = map[part];
    if (spec) {
      return (
        <MomentoZonaFig
          zona={spec.zona}
          formula={spec.form}
          L={nv(values, spec.L, 3.2)}
          shape="fixed"
          MuPos={nv(values, spec.pos)}
          MuNeg={nv(values, spec.neg)}
          acero={`${sv(values, spec.as)} inf.  ·  ${sv(values, spec.asN, sv(values, "asNeg"))} sup.`}
          As={sv(values, `${spec.as}As`)}
          cara="inf. = vano (fondo de losa) · sup. = arranque al descanso / piso"
          unidad="t·m/m"
          leftLabel="Arranque"
          rightLabel="Descanso / piso"
          note={`Franja de 1,00 m. Distribución a 90°: ${sv(values, "asDist")}.`}
        />
      );
    }
  }
  if (kind === "muroContencion") {
    if (part === "mPantalla") {
      return (
        <MomentoZonaFig
          zona="Muro — pantalla (alma) en voladizo"
          formula="Mu = máx(1,7 Ms ; Ms,sis)   ·   Ms = Pa·Hs/3 + Pw·hw/3 + Pq·Hs/2"
          L={nv(values, "Hs", nv(values, "H", 4))}
          shape="cantilever"
          MuPos={nv(values, "MuStem")}
          acero={sv(values, "asAlma")}
          As={sv(values, "AsAlma")}
          cara="trasdós · acero vertical (cara de tierra)"
          unidad="t·m/ml"
          leftLabel="Coronación (M = 0)"
          rightLabel="Base del alma (Mu)"
          note="Voladizo empotrado en la zapata. El diagrama crece con Hs². Anclar el vertical en la zapata (gancho hacia el talón)."
        />
      );
    }
    if (part === "mPantallaV") {
      const Hs = nv(values, "Hs", nv(values, "H", 4));
      const Vu = nv(values, "VuStem", 1);
      return (
        <ElementoDiagramaFig
          titulo="Pantalla — cortante V(y) que verifica el alma (no es el acero de flexión)"
          formula="V(y) crece hacia la base    ·    Vu = máx(1,7 Vs ; Vs,sis)"
          shape="franja"
          dim1={nv(values, "F", 0.4) * 100}
          ejeLabel="Coronación → base del alma"
          diagramas={[{ etiqueta: "Cortante V(y)", unidad: "t/ml", pts: sampleShearCantilever(Hs, Math.max(Vu, 0.01)) }]}
          aceroPrincipal={`Flexión: ${sv(values, "asAlma", "—")} (vertical, trasdós)`}
          aceroSecundario="El concreto suele absorber Vu (φVc). Si no, aumente F."
          nota="El diagrama de corte acompaña al de momento del voladizo. El acero vertical cubre M; el corte se verifica con φVc."
        />
      );
    }
    if (part === "mSeccion") return <MuroSeccionArmadaFig values={values} />;
    if (part === "mSismo") return <SismoMuroFig values={values} />;
    if (part === "mDentellon") return <DentellonMuroFig values={values} />;
    if (part === "mDeflex") return <MuroDeflexFig values={values} />;
    if (part === "mPata") {
      return (
        <MomentoZonaFig
          zona="Muro — punta (pata) de la zapata"
          formula="Mu = 1,4 (M↑ − M↓)   ·   M↑ = qpata C²/3 + qalma C²/6"
          L={nv(values, "C", 1.2)}
          shape="cantilever"
          MuPos={nv(values, "MuToe")}
          acero={sv(values, "asPata")}
          As={sv(values, "AsPata")}
          cara="inferior · hacia el desmonte"
          unidad="t·m/ml"
          leftLabel="Borde de pata"
          rightLabel="Cara frontal del alma"
          note="La reacción del suelo flexiona la pata hacia arriba. Acero inferior, recubrimiento de zapata."
        />
      );
    }
    if (part === "mTalon") {
      return (
        <MomentoZonaFig
          zona="Muro — talón de la zapata"
          formula="Mu = 1,4 (M↓ − M↑)   ·   M↓ = (γ Hs,eq + γc e) A²/2"
          L={nv(values, "A", 2)}
          shape="cantilever"
          MuPos={nv(values, "MuHeel")}
          acero={sv(values, "asTalon")}
          As={sv(values, "AsTalon")}
          cara="superior · cara del relleno"
          unidad="t·m/ml"
          leftLabel="Borde de talón"
          rightLabel="Cara posterior del alma"
          note="El relleno pesa más que la reacción del suelo. Acero superior; los ganchos de la pantalla se solapan con este lecho."
        />
      );
    }
  }
  if (kind === "estribo") {
    if (part === "mSeccion") return <SteelSectionFig spec={specEstriboPantalla(values)} />;
    if (part === "mSismo") return <SismoEstriboFig values={values} />;
  }
  if (part === "mPunch") return <MaePunchFromDims values={values} />;
  if (kind === "losa2d") {
    if (part === "mStrips") {
      let figs: { title: string; pts: string; L: number; MuPos: number; MuNeg: number }[] = [];
      try {
        figs = JSON.parse(sv(values, "stripFigsJson") || "[]") as typeof figs;
      } catch {
        figs = [];
      }
      if (!figs.length) {
        return (
          <div>
            <MaeMomentStrip
              title="Losa — primera franja X"
              formula="K u = F"
              ptsRaw={sv(values, "mPtsX")}
              L={nv(values, "bStripX", 12)}
              MuPos={nv(values, "mStripXMpos")}
              MuNeg={nv(values, "mStripXMneg")}
            />
            <MaeMomentStrip
              title="Losa — primera franja Y"
              formula="K u = F"
              ptsRaw={sv(values, "mPtsY")}
              L={nv(values, "bStripY", 10)}
              MuPos={nv(values, "mStripYMpos")}
              MuNeg={nv(values, "mStripYMneg")}
            />
          </div>
        );
      }
      return (
        <div>
          {figs.map((f) => (
            <MaeMomentStrip key={f.title} title={f.title} formula="K u = F" ptsRaw={f.pts} L={f.L} MuPos={f.MuPos} MuNeg={f.MuNeg} />
          ))}
        </div>
      );
    }
    if (part === "mStripX" || part === "mStripY") return null;
    if (part === "mSteel") {
      const nx = Math.max(1, Math.round(nv(values, "nX", 3)));
      const ny = Math.max(1, Math.round(nv(values, "nY", 2)));
      const grid = parseGrid(sv(values, "gridJson"), {
        axesX: Array.from({ length: nx + 1 }, (_, i) => i * 4),
        axesY: Array.from({ length: ny + 1 }, (_, i) => i * 5),
        panes: Array.from({ length: ny }, () => Array.from({ length: nx }, () => true)),
        cols: [],
      });
      return <SteelSectionFig spec={specLosaFromValues(values, grid)} />;
    }
  }
  if (kind === "reservorioApoyado" || kind === "tanqueElevadoColumnas" || kind === "tanqueElevadoFuste") {
    const L = nv(values, kind === "reservorioApoyado" ? "HL" : "h1", 4);
    if (part === "mMuro") {
      const ptsM = unpackMomentos(sv(values, "mPtsEnv"));
      const ptsN = unpackMomentos(sv(values, "nPtsEnv"));
      const ptsV = unpackMomentos(sv(values, "vPtsEnv"));
      const diagramas: DiagramaSpec[] = [];
      if (ptsM.length >= 2) diagramas.push({ etiqueta: "Momento vertical M(y)", unidad: "t·m/m", pts: ptsM, nota: "M_y=−D_p·w''" });
      if (ptsN.length >= 2) diagramas.push({ etiqueta: "Tensión de anillo N(y)", unidad: "t/m", pts: ptsN, nota: "N_θ=(Ec·e/R)·w(y)" });
      if (ptsV.length >= 2) diagramas.push({ etiqueta: "Cortante V(y)", unidad: "t/m", pts: ptsV, nota: "V=−D_p·w'''" });
      return (
        <ElementoDiagramaFig
          titulo="Pared de la cuba — lámina cilíndrica"
          formula="D_p·w''''+(Ec·e/R²)w=p(y)   ·   FEM Hermite + Winkler de anillo (envolvente hidrostática + sismo SRSS)"
          shape="franja"
          dim1={nv(values, "tMuro", 0.25) * 100}
          ejeLabel={`y=0 (base) → y=${L.toFixed(2)} m (corona)`}
          diagramas={diagramas}
          aceroPrincipal={`Horizontal (anillo): ${sv(values, "asHoriz", "—")}`}
          aceroSecundario={`Vertical (flexión): ${sv(values, "asVert", "—")}`}
          nota="Motor FEM 1D de lámina cilíndrica: elementos de Hermite (w, θ) con resorte de anillo k=Ec e/R²."
        />
      );
    }
    if (part === "mSecMuro") {
      return (
        <SteelSectionFig
          spec={specFranja1m({
            title: "Pared de la cuba — franja 1,00 m (un Ø por cálculo)",
            hCm: nv(values, "tMuro", 0.25) * 100,
            recCm: nv(values, "rec", 4),
            infText: sv(values, "asHoriz", 'Ø 1/2" @ 15'),
            supText: sv(values, "asHoriz", 'Ø 1/2" @ 15'),
            distText: sv(values, "asVert", 'Ø 1/2" @ 15'),
            infName: "Anillo intradós",
            infFace: "cara húmeda",
            supName: "Anillo extradós",
            supFace: "cara seca",
            distName: "Vertical (flexión)",
            distFace: "altura de la cuba",
          })}
        />
      );
    }
    if (part === "mSecDomo") {
      return (
        <SteelSectionFig
          spec={specCascaron1m({
            title: kind === "reservorioApoyado" ? "Cúpula de techo — franja meridional 1,00 m" : "Cúpula superior (techo) — franja meridional 1,00 m",
            hCm: nv(values, kind === "reservorioApoyado" ? "tDomo" : "tDomoSup", 0.08) * 100,
            recCm: nv(values, "rec", 4),
            intraText: sv(values, "asVert", 'Ø 3/8" @ 20'),
            extraText: sv(values, "asVert", 'Ø 3/8" @ 20'),
            distText: sv(values, "asHoriz", 'Ø 3/8" @ 20'),
          })}
        />
      );
    }
    if (part === "mSecAnillo" && kind === "reservorioApoyado") {
      return (
        <SteelSectionFig
          spec={specAnilloViga({
            title: "Viga collarín de coronación",
            bCm: nv(values, "bRing", 30),
            hCm: nv(values, "hRing", 30),
            recCm: nv(values, "rec", 4),
            longText: sv(values, "asRingN", sv(values, "asRing", '6 Ø 1/2"')),
            estText: 'Ø 3/8" @ 15',
          })}
        />
      );
    }
    if (part === "mSecLosa" && kind === "reservorioApoyado") {
      return (
        <SteelSectionFig
          spec={specFranja1m({
            title: "Losa de fondo — franja 1,00 m",
            hCm: nv(values, "tLosa", 0.2) * 100,
            recCm: nv(values, "rec", 4),
            infText: sv(values, "asLosa", 'Ø 1/2" @ 20'),
            supText: sv(values, "asLosa", 'Ø 1/2" @ 20'),
            infName: "Lecho inferior",
            infFace: "cara del suelo",
            supName: "Lecho superior",
            supFace: "cara del líquido",
          })}
        />
      );
    }
    if (part === "mSecDomoInf" && kind !== "reservorioApoyado") {
      return (
        <SteelSectionFig
          spec={specCascaron1m({
            title: "Cúpula inferior (fondo) — franja meridional 1,00 m",
            hCm: nv(values, "tDomoInf", 0.12) * 100,
            recCm: nv(values, "rec", 4),
            intraText: sv(values, "asVert", 'Ø 1/2" @ 20'),
            extraText: sv(values, "asVert", 'Ø 1/2" @ 20'),
            distText: sv(values, "asHoriz", 'Ø 1/2" @ 20'),
          })}
        />
      );
    }
    if (part === "mSecCono" && kind !== "reservorioApoyado") {
      return (
        <SteelSectionFig
          spec={specCascaron1m({
            title: "Fondo cónico — franja meridional 1,00 m",
            hCm: nv(values, "tMuro", 0.25) * 100,
            recCm: nv(values, "rec", 4),
            intraText: sv(values, "asVert", 'Ø 1/2" @ 15'),
            extraText: sv(values, "asVert", 'Ø 1/2" @ 15'),
            distText: sv(values, "asHoriz", 'Ø 1/2" @ 15'),
          })}
        />
      );
    }
    if (part === "mSecAnilloSup" && kind !== "reservorioApoyado") {
      return (
        <SteelSectionFig
          spec={specAnilloViga({
            title: "Anillo superior (collarín de techo)",
            bCm: nv(values, "bRingSup", 30),
            hCm: nv(values, "hRingSup", 30),
            recCm: nv(values, "rec", 4),
            longText: sv(values, "asRingSupN", sv(values, "asRingSup", '6 Ø 5/8"')),
            estText: 'Ø 3/8" @ 15',
          })}
        />
      );
    }
    if (part === "mSecAnilloInf" && kind !== "reservorioApoyado") {
      return (
        <SteelSectionFig
          spec={specAnilloViga({
            title: "Anillo inferior (nudo de inflexión)",
            bCm: nv(values, "bRingInf", 30),
            hCm: nv(values, "hRingInf", 40),
            recCm: nv(values, "rec", 4),
            longText: sv(values, "asRingInfN", sv(values, "asRingInf", '6 Ø 5/8"')),
            estText: 'Ø 3/8" @ 12',
          })}
        />
      );
    }
  }
  if (kind === "reservorioCuadrado") {
    if (part === "mMuroVert") {
      const ptsM = unpackMomentos(sv(values, "mPtsVert"));
      const ptsV = unpackMomentos(sv(values, "vPtsVert"));
      const diagramas: DiagramaSpec[] = [];
      if (ptsM.length >= 2) diagramas.push({ etiqueta: "Momento vertical M(y)", unidad: "t·m/m", pts: ptsM, nota: "myy de la placa MITC4 (franja central)" });
      if (ptsV.length >= 2) diagramas.push({ etiqueta: "Cortante V(y)", unidad: "t/m", pts: ptsV, nota: "qy FEM" });
      return (
        <ElementoDiagramaFig
          titulo="Muro — flexión vertical FEM (dirección gobernante)"
          formula="Placa MITC4 · base empotrada · corona apoyada · envolvente hidrostática + sismo SRSS"
          shape="franja"
          dim1={nv(values, "tMuro", 0.25) * 100}
          ejeLabel={`y=0 (base) → y=${nv(values, "Htotal", nv(values, "HL", 3.5)).toFixed(2)} m (corona)`}
          diagramas={diagramas}
          aceroPrincipal={`Vertical: ${sv(values, "asVert", "—")}`}
          aceroSecundario="Motor FEM de placa: franja vertical extraída en el centro del paño"
        />
      );
    }
    if (part === "mMuroHorLy") {
      const ptsM = unpackMomentos(sv(values, "mPtsHorLy"));
      const ptsV = unpackMomentos(sv(values, "vPtsHorLy"));
      const diagramas: DiagramaSpec[] = [];
      if (ptsM.length >= 2) diagramas.push({ etiqueta: "Momento horizontal M(x)", unidad: "t·m/m", pts: ptsM });
      if (ptsV.length >= 2) diagramas.push({ etiqueta: "Cortante V(x)", unidad: "t/m", pts: ptsV });
      return (
        <ElementoDiagramaFig
          titulo="Muro de longitud Ly — flexión horizontal entre esquinas"
          formula="Placa MITC4 · franja horizontal a ~0,25 H (dirección X del sismo)"
          shape="franja"
          dim1={nv(values, "tMuro", 0.25) * 100}
          ejeLabel="Esquina izquierda → esquina derecha"
          diagramas={diagramas}
          aceroPrincipal={`Esquina: ${sv(values, "asHorEsq", "—")}`}
          aceroSecundario={`Vano: ${sv(values, "asHorVano", "—")}`}
          nota="mxx de la placa FEM: esquinas restringidas por el muro perpendicular."
        />
      );
    }
    if (part === "mMuroHorLx") {
      const ptsM = unpackMomentos(sv(values, "mPtsHorLx"));
      const ptsV = unpackMomentos(sv(values, "vPtsHorLx"));
      const diagramas: DiagramaSpec[] = [];
      if (ptsM.length >= 2) diagramas.push({ etiqueta: "Momento horizontal M(x)", unidad: "t·m/m", pts: ptsM });
      if (ptsV.length >= 2) diagramas.push({ etiqueta: "Cortante V(x)", unidad: "t/m", pts: ptsV });
      return (
        <ElementoDiagramaFig
          titulo="Muro de longitud Lx — flexión horizontal entre esquinas"
          formula="Placa MITC4 · franja horizontal a ~0,25 H (dirección Y del sismo)"
          shape="franja"
          dim1={nv(values, "tMuro", 0.25) * 100}
          ejeLabel="Esquina izquierda → esquina derecha"
          diagramas={diagramas}
          aceroPrincipal={`Esquina: ${sv(values, "asHorEsq", "—")}`}
          aceroSecundario={`Vano: ${sv(values, "asHorVano", "—")}`}
          nota="mxx de la placa FEM: esquinas restringidas por el muro perpendicular."
        />
      );
    }
    if (part === "mSecMuro") {
      return (
        <SteelSectionFig
          spec={specFranja1m({
            title: "Muro rectangular — franja 1,00 m (un Ø por cálculo)",
            hCm: nv(values, "tMuro", 0.25) * 100,
            recCm: nv(values, "rec", 4),
            infText: sv(values, "asVert", 'Ø 1/2" @ 15'),
            supText: sv(values, "asVert", 'Ø 1/2" @ 15'),
            distText: sv(values, "asHorVano", sv(values, "asHoriz", 'Ø 1/2" @ 15')),
            infName: "Vertical intradós",
            infFace: "cara húmeda",
            supName: "Vertical extradós",
            supFace: "cara seca",
            distName: "Horizontal (vano)",
            distFace: "luz entre esquinas",
          })}
        />
      );
    }
    if (part === "mTecho") {
      const ptsM = unpackMomentos(sv(values, "mPtsTecho"));
      const ptsV = unpackMomentos(sv(values, "vPtsTecho"));
      const diagramas: DiagramaSpec[] = [];
      if (ptsM.length >= 2) diagramas.push({ etiqueta: "Momento M(x)", unidad: "t·m/m", pts: ptsM });
      if (ptsV.length >= 2) diagramas.push({ etiqueta: "Cortante V(x)", unidad: "t/m", pts: ptsV });
      return (
        <ElementoDiagramaFig
          titulo="Losa de techo — una vía, luz corta"
          formula="Viga empotrada-empotrada de luz Ly bajo wu=1,4·γc·e+1,7·s/c"
          shape="franja"
          dim1={nv(values, "tTecho", 0.15) * 100}
          ejeLabel="Muro izquierdo → muro derecho (dirección Ly)"
          diagramas={diagramas}
          aceroPrincipal={`Esquina: ${sv(values, "asTechoEsq", "—")}`}
          aceroSecundario={`Vano: ${sv(values, "asTechoVano", "—")}`}
          nota="Dirección larga (Lx): malla mínima de temperatura."
        />
      );
    }
    if (part === "mSecLosa") {
      return (
        <SteelSectionFig
          spec={specFranja1m({
            title: "Losa de fondo — franja 1,00 m",
            hCm: nv(values, "tLosa", 0.2) * 100,
            recCm: nv(values, "rec", 4),
            infText: sv(values, "asLosa", 'Ø 1/2" @ 20'),
            supText: sv(values, "asLosa", 'Ø 1/2" @ 20'),
            infName: "Lecho inferior",
            infFace: "cara del suelo",
            supName: "Lecho superior",
            supFace: "cara del líquido",
          })}
        />
      );
    }
    if (part === "mSecTecho") {
      return (
        <SteelSectionFig
          spec={specFranja1m({
            title: "Losa de techo — franja 1,00 m (luz corta)",
            hCm: nv(values, "tTecho", 0.15) * 100,
            recCm: nv(values, "rec", 4),
            infText: sv(values, "asTechoVano", 'Ø 3/8" @ 20'),
            supText: sv(values, "asTechoEsq", 'Ø 1/2" @ 15'),
            infName: "Lecho inferior (vano)",
            infFace: "cara interior",
            supName: "Lecho superior (apoyo)",
            supFace: "cara exterior",
          })}
        />
      );
    }
  }
  if (kind === "tanqueElevadoColumnas") {
    if (part === "mTorre3D") {
      return <TorreMatricial3D values={values} />;
    }
    if (part === "mColumna") {
      const ptsM = unpackMomentos(sv(values, "mPtsColumna"));
      const ptsV = unpackMomentos(sv(values, "vPtsColumna"));
      const diagramas: DiagramaSpec[] = [];
      if (ptsM.length >= 2) diagramas.push({ etiqueta: "Momento M(y)", unidad: "t·m", pts: ptsM, nota: "M=√(My²+Mz²)" });
      if (ptsV.length >= 2) diagramas.push({ etiqueta: "Cortante V(y)", unidad: "t", pts: ptsV, nota: "V=√(Vy²+Vz²)" });
      return (
        <ElementoDiagramaFig
          titulo="Columna de la torre — más solicitada"
          formula="M(y), V(y) — motor FEM de pórtico espacial 12 GDL (sismo), superpuesto a la carga axial de gravedad"
          shape="circular"
          dim1={nv(values, "dCol", 0.5) * 100}
          ejeLabel={`y=0 (base) → y=${nv(values, "Htorre", 14).toFixed(2)} m (corona)`}
          diagramas={diagramas}
          aceroPrincipal="ρ=2,0 % · verificar con el diagrama de interacción P–M–M"
          aceroSecundario={`${sv(values, "nCol", "—")} columnas · ${sv(values, "femElem", "—")} elem. FEM`}
          nota="Diagrama de la columna gobernante, extraído nudo a nudo del motor FEM de la torre (pórtico espacial 12 GDL)."
        />
      );
    }
    if (part === "mSecColumna") {
      return (
        <SteelSectionFig
          spec={specColumnaCircular({
            title: "Columna de la torre — sección circular",
            dCm: nv(values, "dCol", 0.5) * 100,
            recCm: nv(values, "rec", 4),
            nLong: Math.max(6, Math.round(nv(values, "nColLong", 8))),
            barLong: sv(values, "barCol", '3/4"'),
            barEst: sv(values, "estColBar", '3/8"'),
            sEstCm: nv(values, "estColS", 10),
          })}
        />
      );
    }
    if (part === "mViga") {
      const ptsM = unpackMomentos(sv(values, "mPtsViga"));
      const ptsV = unpackMomentos(sv(values, "vPtsViga"));
      const diagramas: DiagramaSpec[] = [];
      if (ptsM.length >= 2) diagramas.push({ etiqueta: "Momento M(x)", unidad: "t·m", pts: ptsM });
      if (ptsV.length >= 2) diagramas.push({ etiqueta: "Cortante V(x)", unidad: "t", pts: ptsV });
      return (
        <ElementoDiagramaFig
          titulo="Viga de arriostre — más solicitada"
          formula="M(x), V(x) — resultado directo del elemento de anillo más solicitado bajo sismo"
          shape="franja"
          dim1={nv(values, "dArr", 0.4) * 100}
          ejeLabel="Columna izquierda → columna derecha"
          diagramas={diagramas}
          aceroPrincipal={`As=${sv(values, "asArr", "—")} cm²`}
          aceroSecundario={`Sección ${(nv(values, "bArr", 0.3) * 100).toFixed(0)}×${(nv(values, "dArr", 0.4) * 100).toFixed(0)} cm`}
          nota="Elemento entre dos columnas adyacentes en el nivel de arriostre más solicitado; se arma simétrica en ambas caras."
        />
      );
    }
    if (part === "mSecViga") {
      return (
        <SteelSectionFig
          spec={specAnilloViga({
            title: "Viga de arriostre — sección rectangular",
            bCm: nv(values, "bArr", 0.3) * 100,
            hCm: nv(values, "dArr", 0.4) * 100,
            recCm: nv(values, "rec", 4),
            longText: sv(values, "asViga", '4 Ø 5/8"'),
            estText: 'Ø 3/8" @ 15',
          })}
        />
      );
    }
  }
  if (kind === "tanqueElevadoFuste") {
    if (part === "mSecFuste") {
      const ptsM = unpackMomentos(sv(values, "mPtsFuste"));
      const ptsV = unpackMomentos(sv(values, "vPtsFuste"));
      const ptsN = unpackMomentos(sv(values, "nPtsFuste"));
      const diagramas: DiagramaSpec[] = [];
      if (ptsM.length >= 2) diagramas.push({ etiqueta: "Momento M(z)", unidad: "t·m", pts: ptsM, nota: "SRSS impulsivo+convectivo del tubo FEM" });
      if (ptsV.length >= 2) diagramas.push({ etiqueta: "Cortante V(z)", unidad: "t", pts: ptsV, nota: "perfiles del pórtico anular 12 GDL" });
      if (ptsN.length >= 2) diagramas.push({ etiqueta: "Axial N(z)", unidad: "t", pts: ptsN, nota: "peso del fuste + cuba en la corona" });
      return (
        <ElementoDiagramaFig
          titulo="Fuste — tubo anular FEM en voladizo"
          formula="k=1/δ(F=1 en hi)   ·   M(z), V(z) por SRSS de Pi (nudo maestro) y Pc sobre la malla de 12 GDL"
          shape="anular"
          dim1={nv(values, "Dfuste", 3) * 100}
          dim2={nv(values, "eFuste", 0.25) * 100}
          ejeLabel={`z=0 (base) → z=${nv(values, "Htorre", 16).toFixed(2)} m (corona)`}
          diagramas={diagramas}
          aceroPrincipal={`As=${sv(values, "AsFuste", "—")} cm² (dos capas)`}
          aceroSecundario={`${sv(values, "femElem", "—")} elem. anulares · k=${sv(values, "kEff", "—")} t/m`}
        />
      );
    }
    if (part === "mSecFustePared") {
      return (
        <SteelSectionFig
          spec={specFustePared({
            title: "Fuste — franja de 1,00 m (cara interior y exterior)",
            eCm: nv(values, "eFuste", 0.25) * 100,
            recCm: nv(values, "rec", 4),
            vertText: sv(values, "asFusteV", 'Ø 5/8" @ 15'),
            horText: sv(values, "asFusteH", 'Ø 3/8" @ 15'),
          })}
        />
      );
    }
  }
  return null;
}

