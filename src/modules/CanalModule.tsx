import { useMemo, useState } from "react";
import {
  REVESTIMIENTOS,
  SECCION_LABEL,
  calcularCanal,
  type CanalModo,
  type SeccionTipo,
} from "../lib/hidro/canal";
import { ORIGEN_Q, labelOrigenQ, type OrigenCaudal } from "../lib/hidro/expediente";
import { fmt, fmtFixed } from "../lib/num";
import { paso, type MemoriaDoc } from "../lib/memoria";
import { Field, Num, Text } from "../ui/Field";
import { CalcDirtyNote, CalcularButton, MemoriaPendiente, useMemoriaOnCalcular } from "../ui/calcular";
import { Paper } from "../ui/Paper";
import { CanalEnergiaSvg, CanalSeccionSvg } from "../ui/diagrams";
import { exportarWord } from "../lib/exportWord";
import { printMemoria } from "../lib/printDoc";

const G = 9.81;

export function CanalModule() {
  const [meta, setMeta] = useState({
    proyecto: "Canal de conducción principal",
    tramo: "Tramo T-01 · km 0+000 – 0+250",
    ubicacion: "Perú",
    profesional: "Ingeniero civil",
    cip: "",
    Ltramo: 250,
    origenQ: "impuesto" as OrigenCaudal,
    justificacionQ: "Caudal de la demanda de riego (HID-11) o del aforo de la toma.",
  });
  const [modo, setModo] = useState<CanalModo>("verificar");
  const [revestId, setRevestId] = useState("concreto");
  const [tipo, setTipo] = useState<SeccionTipo>("trapezoidal");
  const [Q, setQ] = useState(0.53);
  const [S, setS] = useState(0.001);
  const [b, setB] = useState(0.6);
  const [z, setZ] = useState(1);
  const [D, setD] = useState(0.9);
  const [nOverride, setNOverride] = useState(false);
  const [n, setN] = useState(0.013);

  const revest = REVESTIMIENTOS.find((r) => r.id === revestId) ?? REVESTIMIENTOS[2];
  const nUse = nOverride ? n : revest.n;
  const r = useMemo(
    () => calcularCanal({ Q, n: nUse, S, tipo, b, z, D }, { modo, revestId }),
    [Q, nUse, S, tipo, b, z, D, modo, revestId]
  );
  const geo = r.inp;
  const Vmin = revest.Vmin;
  const Vmax = revest.Vmax;
  const okQ = Q > 0 && Math.abs(r.Qn - Q) / Q < 0.015;
  const okV = r.V >= Vmin && r.V <= Vmax;
  const okTau = r.tau <= revest.tauMax + 1e-6;
  const okYn = tipo === "circular" ? r.yn < D * 0.95 : true;

  const formulaGeom =
    geo.tipo === "trapezoidal"
      ? "A = (b + z y) y     P = b + 2 y √(1+z²)     T = b + 2 z y     R = A/P"
      : geo.tipo === "rectangular"
        ? "A = b y     P = b + 2y     T = b     R = A/P"
        : geo.tipo === "triangular"
          ? "A = z y²     P = 2 y √(1+z²)     T = 2 z y     R = A/P"
          : geo.tipo === "parabolica"
            ? "T = 2 k √y     A = (2/3) T y     P ≈ T + 8 y²/(3 T)     R = A/P"
            : "θ = 2 arccos((r−y)/r)     A = (r²/2)(θ − sen θ)     P = r θ     T = D sen(θ/2)";

  const doc: MemoriaDoc = useMemo(
    () => ({
      codigo: "HID-02",
      titulo: "Diseño hidráulico de canal abierto",
      norma: "Manning · Chow · USBR · Fortier–Scobey",
      blocks: [
        {
          type: "cover",
          kicker: "HID-02 · Hidráulica de canales · Memoria de cálculo",
          titulo: "Diseño hidráulico de canal abierto",
          subtitulo: `${SECCION_LABEL[geo.tipo]} · flujo uniforme · ${r.regimen} · revestimiento ${revest.label}`,
          meta: [
            { k: "Proyecto", v: meta.proyecto },
            { k: "Tramo / progresiva", v: meta.tramo },
            { k: "Longitud del tramo", v: `${fmt(meta.Ltramo, 0)} m` },
            { k: "Ubicación", v: meta.ubicacion },
            { k: "Profesional responsable", v: meta.cip ? `${meta.profesional} · CIP ${meta.cip}` : meta.profesional },
            { k: "Origen del caudal", v: labelOrigenQ(meta.origenQ) },
            { k: "Justificación de Q", v: meta.justificacionQ },
            { k: "Normas y referencias", v: "Manning (SI) · Chow 1959 · USBR freeboard · Fortier–Scobey" },
            { k: "Modo de cálculo", v: modo === "optima" ? "Diseño de sección hidráulicamente óptima" : "Verificación de sección propuesta" },
          ],
        },
        { type: "h2", text: "1. Objeto y alcance" },
        {
          type: "p",
          text: `La presente memoria dimensiona y verifica el tramo ${meta.tramo} (L = ${fmt(meta.Ltramo, 0)} m) a superficie libre en régimen permanente y uniforme. ${meta.justificacionQ} El caudal de diseño se adopta por ${labelOrigenQ(meta.origenQ).toLowerCase()}. Se determina el tirante normal por Manning, el tirante crítico por energía específica mínima, el borde libre USBR, y se contrastan velocidad y esfuerzo tractivo con el revestimiento (Fortier–Scobey).`,
        },
        {
          type: "list",
          items: [
            "Geometría exacta de la sección (rectangular, trapezoidal, triangular, circular o parabólica).",
            "Tirante normal yn por bisección de Q(y) = Qd, con tabla de iteración.",
            "Tirante crítico yc, pendiente crítica Sc, número de Froude y régimen.",
            "Energía específica E = y + V²/2g y rama de la curva E(y).",
            "Borde libre USBR, altura de excavación, espejo y área de revestimiento.",
            "Velocidad permisible y esfuerzo tractivo τ = γ R S frente al revestimiento adoptado.",
            "Sección hidráulicamente óptima (R = y/2) como control de economía de excavación.",
          ],
        },
        { type: "h2", text: "2. Bases de cálculo" },
        { type: "eq", text: "Q = (1/n) · A · R^{2/3} · S^{1/2}     (Manning, SI)", num: "1" },
        { type: "eq", text: "C = R^{1/6}/n     ·     Q = C A √(R S)     (Chézy equivalente)", num: "2" },
        { type: "eq", text: formulaGeom, num: "3" },
        { type: "eq", text: "Q² / g = A³ / T     (tirante crítico, energía específica mínima)", num: "4" },
        { type: "eq", text: "Fr = V / √(g D)     ·     D = A/T     ·     E = y + V²/(2g)", num: "5" },
        { type: "eq", text: "BL = 0.60 + 0.04 V √y     (USBR, BL ≥ 0.15 m)", num: "6" },
        { type: "eq", text: "τ = γ R S     ·     γ = 9 810 N/m³", num: "7" },
        {
          type: "note",
          text: "n se toma del catálogo de revestimiento (Chow / USBR). El tirante normal es el único que, en flujo uniforme, hace que la resistencia iguale el caudal de diseño. Fr < 1: subcrítico (lento); Fr > 1: supercrítico (rápido).",
        },
        { type: "h2", text: "3. Datos de diseño" },
        {
          type: "kv",
          rows: [
            { k: "Caudal de diseño Qd", v: `${fmt(Q, 3)}  (${fmt(Q * 1000, 1)} L/s)`, u: "m³/s" },
            { k: "Pendiente longitudinal S", v: `${fmtFixed(S, 5)}   ·   ${fmt(S * 100, 3)} %   ·   ${fmt(S * 1000, 2)} ‰`, u: "m/m" },
            { k: "Tipo de sección", v: SECCION_LABEL[geo.tipo], u: "—" },
            { k: "Revestimiento", v: revest.label, u: "—" },
            { k: "Coeficiente de Manning n", v: fmt(geo.n, 4), u: "—" },
            ...(geo.tipo !== "circular" && geo.tipo !== "triangular" && geo.tipo !== "parabolica"
              ? [{ k: "Ancho de solera b", v: fmt(geo.b, 3), u: "m" }]
              : []),
            ...(geo.tipo === "circular" ? [{ k: "Diámetro interior D", v: fmt(geo.D, 3), u: "m" }] : []),
            ...(geo.tipo === "parabolica" ? [{ k: "Factor parabólico k (T = 2k√y)", v: fmt(geo.z, 3), u: "m½" }] : []),
            ...(geo.tipo !== "rectangular" && geo.tipo !== "circular" && geo.tipo !== "parabolica"
              ? [{ k: "Talud z (horizontal:vertical)", v: `${fmt(geo.z, 2)} : 1`, u: "—" }]
              : []),
            { k: "Velocidad permisible (Fortier–Scobey)", v: `${fmt(Vmin, 2)} – ${fmt(Vmax, 2)}`, u: "m/s" },
            { k: "Esfuerzo tractivo admisible", v: fmt(revest.tauMax, 1), u: "N/m²" },
          ],
        },
        { type: "h2", text: "4. Procedimiento de cálculo" },
        paso(
          "4.1",
          "Tirante normal — bisección de Manning",
          "Buscar yn tal que Q(yn) = (1/n) A R^{2/3} S^{1/2} = Qd",
          `Se acota y ∈ (0, ymax) y se itera hasta |Q(y) − ${fmt(Q, 3)}| ≈ 0. Con n = ${fmt(geo.n, 4)} y S = ${fmtFixed(S, 5)}.`,
          `yn = ${fmtFixed(r.yn, 4)} m     ·     Q(yn) = ${fmt(r.Qn, 4)} m³/s     ·     error = ${fmt((100 * (r.Qn - Q)) / Math.max(Q, 1e-9), 2)} %`,
          "El tirante normal es la incógnita del flujo uniforme. No se asume; se resuelve."
        ),
        paso(
          "4.2",
          "Elementos hidráulicos a tirante normal",
          formulaGeom,
          `y = yn = ${fmtFixed(r.yn, 4)} m,  b = ${fmt(geo.b, 3)} m,  z = ${fmt(geo.z, 2)},  D = ${fmt(geo.D, 3)} m.`,
          `A = ${fmt(r.g.A, 4)} m²     P = ${fmt(r.g.P, 4)} m     R = ${fmt(r.g.R, 4)} m     T = ${fmt(r.g.T, 4)} m     Dhid = ${fmt(r.g.Dhid, 4)} m`,
          "Área mojada, perímetro, radio hidráulico y espejo son la base de Manning, Froude y del esfuerzo tractivo."
        ),
        paso(
          "4.3",
          "Comprobación de Manning, Chézy y velocidad",
          "Q = (1/n) A R^{2/3} S^{1/2}     ·     V = Q/A     ·     C = R^{1/6}/n",
          `(1/${fmt(geo.n, 4)}) × ${fmt(r.g.A, 4)} × ${fmt(r.g.R, 4)}^{2/3} × ${fmtFixed(S, 5)}^{1/2}`,
          `Q = ${fmt(r.Qn, 4)} m³/s     V = ${fmt(r.V, 3)} m/s     C = ${fmt(r.C, 1)}     Re = ${fmt(r.Re, 0)}`,
          `Re ≫ 4 000: flujo turbulento rugoso, dominio de validez de Manning. Límites del revestimiento: ${fmt(Vmin, 2)} ≤ V ≤ ${fmt(Vmax, 2)} m/s.`
        ),
        paso(
          "4.4",
          "Tirante crítico, pendiente crítica y régimen",
          "A³/T = Q²/g     ·     Sc = (n Vc / Rc^{2/3})²     ·     Fr = V/√(g D)",
          `Q²/g = ${fmt((Q * Q) / G, 5)} m⁵. Se itera yc hasta que A³/T iguale esa constante.`,
          `yc = ${fmtFixed(r.yc, 4)} m     Sc = ${fmtFixed(r.Sc, 6)}     Fr = ${fmt(r.Fr, 3)}     régimen ${r.regimen}`,
          r.regimen === "supercrítico"
            ? "Fr > 1: flujo rápido. Las ondas no viajan aguas arriba. Verificar transiciones, disipación y el salto hidráulico."
            : r.regimen === "crítico"
              ? "Fr ≈ 1: energía específica mínima. Inestable a pequeñas perturbaciones; evitar operar en crítico."
              : "Fr < 1: flujo lento. El tirante también depende de la condición de aguas abajo (curva de remanso si hay un control)."
        ),
        { type: "figure", part: "energia" },
        paso(
          "4.5",
          "Energía específica",
          "E = y + V²/(2g)",
          `En = ${fmtFixed(r.yn, 4)} + ${fmt(r.V, 3)}² / (2×${G})     ·     Emin (en yc) = ${fmtFixed(r.yc, 4)} + ${fmt(r.Vc, 3)}²/(2g)`,
          `E(yn) = ${fmt(r.E, 4)} m     ·     Emin = ${fmt(r.Emin, 4)} m     ·     holgura energética = ${fmt(r.E - r.Emin, 4)} m`,
          r.Fr > 1.05
            ? `Flujo supercrítico: el conjugado sequent es y2 = ½ yn (−1+√(1+8 Fr²)) = ${fmt(r.y2, 3)} m. Pérdida en el salto ΔE = (y2−y1)³/(4 y1 y2) = ${fmt(r.dEsalto, 4)} m.`
            : "En subcrítico la rama superior de E(y) es la de operación. Un remanso aguas abajo puede elevar el tirante por encima de yn."
        ),
        paso(
          "4.6",
          "Borde libre USBR y geometría de excavación",
          "BL = 0.60 + 0.04 V √y     (mín. 0.15 m)     ·     H = yn + BL",
          `BL = 0.60 + 0.04 × ${fmt(r.V, 3)} × √${fmtFixed(r.yn, 4)}`,
          `BL = ${fmt(r.BL, 3)} m     H = ${fmt(r.H, 3)} m     T_corona ≈ ${fmt(r.Ttop, 3)} m     Aexc = ${fmt(r.Aexc, 3)} m²     P_mojado = ${fmt(r.Alin, 3)} m/m`,
          `El borde libre cubre oleaje, tolerancia de construcción y aumento de n con el tiempo. Excavación: ${fmt(r.Aexc, 3)} m³/m (${fmt(r.Aexc * 1000, 1)} m³/km). Revestimiento ≈ ${fmt(r.Alin, 3)} m²/m.`
        ),
        paso(
          "4.7",
          "Esfuerzo tractivo y erosión",
          "τ = γ R S     ·     γ = 9 810 N/m³",
          `τ = 9810 × ${fmt(r.g.R, 4)} × ${fmtFixed(S, 5)}`,
          `τ = ${fmt(r.tau, 2)} N/m²     ·     τadm (${revest.label}) = ${fmt(revest.tauMax, 1)} N/m²`,
          okTau
            ? "El esfuerzo sobre el lecho no supera el admisible del revestimiento. En canales de tierra este es el control de diseño, no solo Vmáx."
            : "τ > τadm: riesgo de erosión. Suavizar la pendiente, ensanchar la sección o cambiar a revestimiento de mayor resistencia."
        ),
        { type: "h2", text: "5. Tabla de iteración de Manning (entorno de yn)" },
        {
          type: "p",
          text: "Cada fila evalúa la capacidad Q(y) con la geometría exacta. La fila marcada es el tirante normal. Sirve de auditoría: cualquier programa de canales debe poder reproducirla.",
        },
        {
          type: "table",
          caption: "Elementos hidráulicos vs tirante (flujo uniforme, Manning)",
          headers: ["", "y (m)", "y/yn", "A (m²)", "P (m)", "R (m)", "T (m)", "Q (m³/s)", "V (m/s)", "Fr", "E (m)"],
          rows: r.iter.map((f) => [
            Math.abs(f.y / Math.max(r.yn, 1e-9) - 1) < 0.03 ? "◀" : "",
            fmtFixed(f.y, 3),
            fmt(f.y / Math.max(r.yn, 1e-9), 2),
            fmt(f.A, 4),
            fmt(f.P, 3),
            fmt(f.R, 4),
            fmt(f.T, 3),
            fmt(f.Q, 4),
            fmt(f.V, 3),
            fmt(f.Fr, 3),
            fmt(f.E, 3),
          ]),
        },
        { type: "h2", text: "6. Sección hidráulicamente óptima" },
        {
          type: "p",
          text: `${r.opt.nota} Para este caudal, n y S, la sección óptima equivalente es b = ${fmt(r.bOpt, 3)} m y y = ${fmt(r.yOpt, 3)} m${geo.tipo === "circular" ? " (D de diseño a 0.80 de llenado)" : ""}. La sección adoptada ${Math.abs(geo.b - r.bOpt) / Math.max(r.bOpt, 0.05) < 0.12 ? "está próxima al óptimo" : "se aparta del óptimo: conviene justificar por trazado, servidumbre o método constructivo"}.`,
        },
        { type: "h2", text: "7. Verificaciones de servicio" },
        { type: "check", ok: okQ, text: `Manning reproduce Qd: Q(yn) = ${fmt(r.Qn, 4)} m³/s  vs  Qd = ${fmt(Q, 3)} m³/s.` },
        { type: "check", ok: okV, text: `Velocidad V = ${fmt(r.V, 3)} m/s  dentro de ${fmt(Vmin, 2)}–${fmt(Vmax, 2)} m/s (${revest.label}).` },
        { type: "check", ok: okTau, text: `Esfuerzo tractivo τ = ${fmt(r.tau, 2)} N/m²  ≤  τadm = ${fmt(revest.tauMax, 1)} N/m².` },
        {
          type: "check",
          ok: okYn,
          text: tipo === "circular" ? `Tirante yn = ${fmt(r.yn, 3)} m < 0.95 D = ${fmt(0.95 * D, 3)} m (no opera a tubo lleno).` : `Tirante de operación yn = ${fmt(r.yn, 3)} m con H = yn+BL = ${fmt(r.H, 3)} m.`,
        },
        { type: "check", ok: r.Qn < r.Qlleno, text: `Holgura de sección: Q(H) = ${fmt(r.Qlleno, 3)} m³/s  >  Qd  (capacidad con el borde libre inundado).` },
        { type: "check", ok: true, text: `S = ${fmtFixed(S, 5)}  ${S > r.Sc ? ">" : S < r.Sc ? "<" : "≈"}  Sc = ${fmtFixed(r.Sc, 6)}  →  régimen ${r.regimen} (Fr = ${fmt(r.Fr, 3)}).` },
        { type: "h2", text: "8. Adopción y conclusión" },
        {
          type: "p",
          text: `Se adopta un canal ${SECCION_LABEL[geo.tipo].toLowerCase()}${geo.tipo === "circular" ? ` de D = ${fmt(geo.D, 2)} m` : geo.tipo === "parabolica" ? ` de k = ${fmt(geo.z, 2)} m½` : ` de b = ${fmt(geo.b, 2)} m${geo.tipo !== "rectangular" ? ` y talud z = ${fmt(geo.z, 2)}:1` : ""}`}, revestido con ${revest.label} (n = ${fmt(geo.n, 3)}), pendiente S = ${fmtFixed(S, 5)} (${fmt(S * 1000, 2)} ‰). Tirante normal yn = ${fmt(r.yn, 3)} m, borde libre USBR ${fmt(r.BL, 2)} m, altura total H = ${fmt(r.H, 3)} m. Velocidad V = ${fmt(r.V, 2)} m/s, Fr = ${fmt(r.Fr, 2)} (${r.regimen}). ${okV && okTau && okQ ? "La sección cumple caudal, velocidad y tracción." : "Revisar pendiente, sección o revestimiento: hay un límite de servicio que no se cumple."}`,
        },
        {
          type: "note",
          text: "Verificar n de obra (acabado real), juntas, transiciones, entregas y el perfil de remanso si existe un control aguas abajo. Esta memoria no sustituye el replanteo ni el estudio de suelos del tramo.",
        },
      ],
    }),
    [meta, modo, revest, geo, r, Q, S, tipo, D, Vmin, Vmax, okQ, okV, okTau, okYn, formulaGeom]
  );
  const livePack = useMemo(
    () => ({ doc, r, geo, revest, Q, S, okV, okTau }),
    [doc, r, geo, revest, Q, S, okV, okTau]
  );
  const { doc: pack, dirty, calcular } = useMemoriaOnCalcular(livePack);
  const memoria = pack.doc;
  const view = pack;

  const setMetaK = (k: keyof typeof meta, v: string) => setMeta((s) => ({ ...s, [k]: v }));

  return (
    <>
      <aside id="app-panel" className="panel">
        <h2>Canal abierto</h2>
        <p className="lead">Ejemplo desarrollado. Edite los datos y pulse Calcular para actualizar el informe: Manning, régimen, USBR, tracción y sección óptima.</p>
        <CalcDirtyNote dirty={dirty} />
        <fieldset className="fieldset">
          <legend>Identificación</legend>
          <Field label="Proyecto"><Text value={meta.proyecto} onChange={(v) => setMetaK("proyecto", v)} /></Field>
          <Field label="Tramo / progresiva"><Text value={meta.tramo} onChange={(v) => setMetaK("tramo", v)} /></Field>
          <Field label="Ubicación"><Text value={meta.ubicacion} onChange={(v) => setMetaK("ubicacion", v)} /></Field>
          <Field label="Profesional"><Text value={meta.profesional} onChange={(v) => setMetaK("profesional", v)} /></Field>
          <Field label="CIP"><Text value={meta.cip} onChange={(v) => setMetaK("cip", v)} /></Field>
          <Field label="L tramo" unit="m"><Num value={meta.Ltramo} onChange={(v) => setMeta((s) => ({ ...s, Ltramo: v }))} /></Field>
          <Field label="Origen del caudal">
            <select value={meta.origenQ} onChange={(e) => setMeta((s) => ({ ...s, origenQ: e.target.value as OrigenCaudal }))}>
              {ORIGEN_Q.filter((o) => o.id !== "racional").map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Justificación de Q"><Text value={meta.justificacionQ} onChange={(v) => setMetaK("justificacionQ", v)} /></Field>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Criterio de diseño</legend>
          <Field label="Modo">
            <select value={modo} onChange={(e) => setModo(e.target.value as CanalModo)}>
              <option value="verificar">Verificar sección propuesta</option>
              <option value="optima">Diseñar sección hidráulicamente óptima</option>
            </select>
          </Field>
          <Field label="Revestimiento">
            <select
              value={revestId}
              onChange={(e) => {
                setRevestId(e.target.value);
                const rv = REVESTIMIENTOS.find((x) => x.id === e.target.value);
                if (rv && !nOverride) setN(rv.n);
              }}
            >
              {REVESTIMIENTOS.map((rv) => (
                <option key={rv.id} value={rv.id}>
                  {rv.grupo} — {rv.label} (n = {rv.n})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sección">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as SeccionTipo)}>
              <option value="trapezoidal">Trapezoidal</option>
              <option value="rectangular">Rectangular</option>
              <option value="triangular">Triangular</option>
              <option value="circular">Circular</option>
              <option value="parabolica">Parabólica</option>
            </select>
          </Field>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Hidráulica</legend>
          <div className="grid-2">
            <Field label="Qd" unit="m³/s"><Num value={Q} onChange={setQ} /></Field>
            <Field label="S" unit="m/m"><Num value={S} onChange={setS} /></Field>
            {tipo !== "circular" && tipo !== "triangular" && tipo !== "parabolica" && modo === "verificar" && (
              <Field label="b solera" unit="m"><Num value={b} onChange={setB} /></Field>
            )}
            {tipo !== "rectangular" && tipo !== "circular" && (
              <Field label={tipo === "parabolica" ? "k (T=2k√y)" : "z (H:V)"}>
                <Num value={z} onChange={setZ} />
              </Field>
            )}
            {tipo === "circular" && modo === "verificar" && (
              <Field label="D" unit="m"><Num value={D} onChange={setD} /></Field>
            )}
            <Field label="n Manning">
              <Num
                value={nUse}
                onChange={(v) => {
                  setNOverride(true);
                  setN(v);
                }}
              />
            </Field>
          </div>
          <p className="lead" style={{ marginTop: 8 }}>
            S = {fmt(S * 1000, 2)} ‰ = {fmt(S * 100, 3)} % · n catálogo {fmt(revest.n, 4)} · Vadm {fmt(Vmin, 2)}–{fmt(Vmax, 2)} m/s
          </p>
        </fieldset>
        <div className="actions">
          <CalcularButton onClick={calcular} dirty={dirty} />
          <button className="btn" disabled={!memoria} onClick={() => memoria && exportarWord(memoria)}>Exportar Word</button>
          <button className="btn secondary" disabled={!memoria} onClick={() => memoria && printMemoria(memoria.titulo)}>Imprimir / PDF</button>
        </div>
      </aside>
      {memoria ? <Paper
        doc={memoria}
        extra={
          <div className="croquis-board croquis-board-compact">
            <div className="croquis">
              <CanalSeccionSvg tipo={view.geo.tipo} b={view.geo.b} y={view.r.yn} z={view.geo.z} BL={view.r.BL} D={view.geo.D} T={view.r.g.T} />
            </div>
            <aside className="ficha">
              <div className="ficha-head">
                <span>Datos del canal</span>
                <span>HID-02</span>
              </div>
              <table>
                <tbody>
                  {(
                    [
                      ["Sección", SECCION_LABEL[view.geo.tipo], ""],
                      ["Revestimiento", view.revest.label, ""],
                      ["Qd", fmt(view.Q, 3), "m³/s"],
                      ["S", fmtFixed(view.S, 5), "m/m"],
                      ["n", fmt(view.geo.n, 4), "—"],
                      view.geo.tipo === "circular" ? ["D", fmt(view.geo.D, 2), "m"] : ["b", fmt(view.geo.b, 2), "m"],
                      ["yn", fmtFixed(view.r.yn, 3), "m"],
                      ["yc", fmtFixed(view.r.yc, 3), "m"],
                      ["V", fmt(view.r.V, 2), "m/s"],
                      ["Fr", fmt(view.r.Fr, 2), "—"],
                      ["BL USBR", fmt(view.r.BL, 2), "m"],
                      ["H = yn+BL", fmt(view.r.H, 2), "m"],
                      ["τ", fmt(view.r.tau, 1), "N/m²"],
                    ] as [string, string, string][]
                  ).map(([k, v, u]) => (
                    <tr key={k}>
                      <td className="k">{k}</td>
                      <td className="v">{v}</td>
                      <td className="u">{u}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </aside>
            <div className="ficha-adopt">
              <span>Sección adoptada</span>
              <strong>
                {SECCION_LABEL[view.geo.tipo]} · yn {fmt(view.r.yn, 2)} m · {view.r.regimen} · {view.okV && view.okTau ? "CUMPLE" : "REVISAR"}
              </strong>
            </div>
          </div>
        }
        renderFigure={(part) =>
          part === "energia" ? <CanalEnergiaSvg curva={view.r.curvaE} yn={view.r.yn} yc={view.r.yc} E={view.r.E} Emin={view.r.Emin} /> : null
        }
      /> : <MemoriaPendiente />}
    </>
  );
}
