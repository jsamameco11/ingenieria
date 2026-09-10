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
}: Props) {
  const Luse = Math.max(L, 0.05);
  const raw = ptsIn && ptsIn.length >= 2 ? ptsIn : sampleShape(shape, Luse, MuPos, MuNeg);
  const peak = Math.max(0.05, ...raw.map((p) => Math.abs(p.M)), Math.abs(MuPos), Math.abs(MuNeg));
  const W = 520;
  const H = 248;
  const x0 = 52;
  const x1 = 468;
  const y0 = 118;
  const amp = 68;
  const xOf = (x: number) => x0 + ((x - raw[0].x) / Math.max(raw[raw.length - 1].x - raw[0].x, 1e-6)) * (x1 - x0);
  const yOf = (M: number) => y0 - (M / peak) * amp;
  const d = raw.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.x).toFixed(1)} ${yOf(p.M).toFixed(1)}`).join(" ");
  const fill = `${d} L ${xOf(raw[raw.length - 1].x).toFixed(1)} ${y0} L ${xOf(raw[0].x).toFixed(1)} ${y0} Z`;
  const iMax = raw.reduce((b, p, i, a) => (p.M > a[b].M ? i : b), 0);
  const iMin = raw.reduce((b, p, i, a) => (p.M < a[b].M ? i : b), 0);
  const mPlus = raw[iMax].M > 0.008 ? raw[iMax] : null;
  const mMinus = raw[iMin].M < -0.008 ? raw[iMin] : null;

  return (
    <div className="croquis croquis-compact" data-fig-part="momento">
      <div className="croquis-head">
        <p>{`Momento flector · ${zona}`}</p>
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
      <text x={x0} y={y0 + 20} textAnchor="middle" fontSize="8" fill="#6b6458" fontFamily="IBM Plex Sans, sans-serif">
        {leftLabel}
      </text>
      <text x={x1} y={y0 + 20} textAnchor="middle" fontSize="8" fill="#6b6458" fontFamily="IBM Plex Sans, sans-serif">
        {rightLabel}
      </text>
      <text x={(x0 + x1) / 2} y={y0 + 20} textAnchor="middle" fontSize="8.5" fill="#1a4473" fontFamily="IBM Plex Mono, monospace">
        {`ℓ = ${Luse.toFixed(2)} m`}
      </text>
      <text x="14" y={y0 - amp + 4} fontSize="7.5" fill="#1f6b3a" fontFamily="IBM Plex Mono, monospace">
        {`+${peak.toFixed(2)}`}
      </text>
      <text x="14" y={y0 + 3} fontSize="7.5" fill="#6b6458" fontFamily="IBM Plex Mono, monospace">
        0
      </text>
      <text x="14" y={y0 + amp + 4} fontSize="7.5" fill="#8b1e1e" fontFamily="IBM Plex Mono, monospace">
        {`−${peak.toFixed(2)}`}
      </text>
      {mPlus ? (
        <text x={xOf(mPlus.x)} y={yOf(mPlus.M) - 7} textAnchor="middle" fontSize="9" fill="#1f6b3a" fontFamily="IBM Plex Mono, monospace" fontWeight="600">
          {`+${mPlus.M.toFixed(2)} ${unidad}`}
        </text>
      ) : null}
      {mMinus ? (
        <text x={xOf(mMinus.x)} y={yOf(mMinus.M) + 14} textAnchor="middle" fontSize="9" fill="#8b1e1e" fontFamily="IBM Plex Mono, monospace" fontWeight="600">
          {`−${Math.abs(mMinus.M).toFixed(2)} ${unidad}`}
        </text>
      ) : null}
      <rect x="16" y="198" width="488" height="38" fill="#f4efe3" stroke="#c4b48a" strokeWidth="0.8" />
      <text x="26" y="214" fontSize="9.5" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        {`Acero de diseño: ${acero}${As ? `   ·   As = ${As} cm²/m` : ""}`}
      </text>
      <text x="26" y="228" fontSize="8.5" fill="#5a4a28" fontFamily="IBM Plex Sans, sans-serif">
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

/** Figuras de momento por zona, según el croquis de la hoja. */
export function figuraMomento(kind: string, part: string | undefined, values: Record<string, string>) {
  if (!part?.startsWith("m")) return null;
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
      return (
        <MomentoZonaFig
          zona="Zapata corrida — voladizos transversales"
          formula="Mu = qu · ℓv² / 2   (por metro de corrida)"
          L={Math.max(nv(values, "lvL"), nv(values, "lvR"), 0.3)}
          shape="cantilever"
          MuPos={nv(values, "MuCorr")}
          acero={sv(values, "asPrin", 'Ø 1/2"')}
          As={sv(values, "AsPrin")}
          cara="inferior · perpendicular al muro"
          unidad="t·m/m"
          leftLabel="Borde de zapata"
          rightLabel="Cara del muro"
          note="Acero principal continuo de vuelo a vuelo, cara del suelo, con gancho en los extremos."
        />
      );
    }
    if (part === "mLong") {
      const pts = unpackMomentos(sv(values, "mPts"));
      return (
        <MomentoZonaFig
          zona="Zapata corrida — viga invertida (línea de columnas)"
          formula="M(x) = w x²/2 − Σ Pu (x − xi)"
          L={nv(values, "Lbeam", nv(values, "L", 12))}
          shape={pts.length >= 2 ? "polyline" : "fixed"}
          pts={pts.length >= 2 ? pts : undefined}
          MuPos={nv(values, "Mtop")}
          MuNeg={nv(values, "Msoil")}
          acero={sv(values, "asLong", 'Ø 1/2"')}
          As={sv(values, "AsLong")}
          cara="inferior entre apoyos · superior en extremos"
          unidad="t·m"
          leftLabel="Columna 1"
          rightLabel="Última columna"
          note="Columnas puntuales y reacción del suelo en el ancho B. Si es muro continuo, esta zona no gobierna: rige el voladizo transversal."
        />
      );
    }
  }
  if (kind === "platea") {
    const map: Record<string, { zona: string; key: string; b: string }> = {
      mIntX: { zona: "Platea — franja interior eje X", key: "mPtsIntX", b: "bIntX" },
      mEdgX: { zona: "Platea — franja de borde eje X", key: "mPtsEdgX", b: "bEdgX" },
      mIntY: { zona: "Platea — franja interior eje Y", key: "mPtsIntY", b: "bIntY" },
      mEdgY: { zona: "Platea — franja de borde eje Y", key: "mPtsEdgY", b: "bEdgY" },
    };
    const spec = map[part];
    if (spec) {
      const pts = unpackMomentos(sv(values, spec.key));
      const L = pts.length >= 2 ? pts[pts.length - 1].x : nv(values, part.includes("Y") ? "Ly" : "Lx", 16);
      return (
        <MomentoZonaFig
          zona={spec.zona}
          formula={`M(x) = w x²/2 − Σ Pu (x − xi)   ·   b = ${nv(values, spec.b, 5).toFixed(2)} m`}
          L={L}
          shape={pts.length >= 2 ? "polyline" : "fixed"}
          pts={pts.length >= 2 ? pts : undefined}
          MuPos={nv(values, `${part}Mpos`)}
          MuNeg={nv(values, `${part}Mneg`)}
          acero={sv(values, part.includes("Mpos") ? "asPos" : "asPos", sv(values, "asPos", 'Ø 1/2" inf. / Ø 1/2" sup.'))}
          As={sv(values, "AsPos")}
          cara="M− cara del suelo (malla inf.) · M+ vuelos (malla sup.)"
          unidad="t·m"
          leftLabel="Vuelo / borde"
          rightLabel="Vuelo / borde"
          note="Método de fajas. El acero por metro se toma del mayor Mu de las cuatro franjas, en cada cara."
        />
      );
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
  if (kind === "reservorioApoyado" || kind === "tanqueElevadoColumnas" || kind === "tanqueElevadoFuste") {
    const L = nv(values, kind === "reservorioApoyado" ? "HL" : "h1", 4);
    if (part === "mMuro") {
      const pts = unpackMomentos(sv(values, "mPtsEnv"));
      return (
        <MomentoZonaFig
          zona="Pared del reservorio — momento vertical (flexión)"
          formula="D_p·w''''+(Ec·e/R²)w=p(y)   ·   M_y=−D_p·w''   (envolvente hidrostática + sismo SRSS)"
          L={L}
          shape="polyline"
          pts={pts.length >= 2 ? pts : undefined}
          acero={sv(values, "asVert")}
          cara="base empotrada (M) → corona libre (M≈0)"
          unidad="t·m/m"
          leftLabel="Base (empotrada)"
          rightLabel="Corona (libre)"
          note="Lámina cilíndrica resuelta por integración numérica (equivalente a las tablas PCA). y medido desde la base."
        />
      );
    }
    if (part === "mAnillo") {
      const pts = unpackMomentos(sv(values, "nPtsEnv"));
      return (
        <MomentoZonaFig
          zona="Pared del reservorio — tensión de anillo (aro)"
          formula="N_θ = (Ec·e/R)·w(y)   (envolvente hidrostática + sismo SRSS)"
          L={L}
          shape="polyline"
          pts={pts.length >= 2 ? pts : undefined}
          acero={sv(values, "asHoriz")}
          cara="tracción — acero horizontal en ambas caras"
          unidad="t/m"
          leftLabel="Base (empotrada)"
          rightLabel="Corona (libre)"
          note="La tensión de anillo se anula en la base por el empotramiento con la losa de fondo (efecto de borde)."
        />
      );
    }
  }
  if (kind === "tanqueElevadoColumnas") {
    if (part === "mColumna") {
      const pts = unpackMomentos(sv(values, "mPtsColumna"));
      return (
        <MomentoZonaFig
          zona="Torre — columna más solicitada (diagrama exacto del modelo matricial)"
          formula="M(y) = √(My(y)²+Mz(y)²)   —   resultado directo del método de la rigidez directa (sismo), superpuesto a la carga axial de gravedad"
          L={nv(values, "Htorre", 14)}
          shape="polyline"
          pts={pts.length >= 2 ? pts : undefined}
          acero={sv(values, "asCol", "ver diseño P–M")}
          cara="tracción en la cara de sotavento bajo sismo"
          unidad="t·m"
          leftLabel="Base (empotrada)"
          rightLabel="Corona (bajo la cuba)"
          note="Diagrama de la columna gobernante, extraído nudo a nudo del análisis matricial 3D (no es una envolvente aproximada)."
        />
      );
    }
    if (part === "mViga") {
      const pts = unpackMomentos(sv(values, "mPtsViga"));
      return (
        <MomentoZonaFig
          zona="Torre — viga de arriostre más solicitada (diagrama exacto del modelo matricial)"
          formula="M(x) — resultado directo del elemento de anillo más solicitado bajo sismo"
          L={1}
          shape="polyline"
          pts={pts.length >= 2 ? pts : undefined}
          acero={sv(values, "asArr", "ver diseño")}
          cara="según el sentido del sismo — se arma simétrica en ambas caras"
          unidad="t·m"
          leftLabel="Columna izquierda"
          rightLabel="Columna derecha"
          note="Elemento entre dos columnas adyacentes en el nivel de arriostre más solicitado."
        />
      );
    }
  }
  return null;
}

