import { useMemo, useState } from "react";
import {
  C_CUNETA,
  N_CUNETA,
  calcularCuneta,
  type CunetaInput,
} from "../lib/hidro/cuneta";
import { T_RETORNO_VIA } from "../lib/hidro/alcantarilla";
import { ZONAS_IILA } from "../lib/hidro/canaleta";
import { fmt, fmtFixed } from "../lib/num";
import { paso, type MemoriaDoc } from "../lib/memoria";
import { Field, Num, Text } from "../ui/Field";
import { CalcDirtyNote, CalcularButton, MemoriaPendiente, useMemoriaOnCalcular } from "../ui/calcular";
import { Paper } from "../ui/Paper";
import { CunetaSvg } from "../ui/diagrams";
import { exportarWord } from "../lib/exportWord";
import { printMemoria } from "../lib/printDoc";

const hoy = new Date().toLocaleDateString("es-PE");

const INP0: CunetaInput = {
  Qforzado: 0,
  n: 0.016,
  S: 0.005,
  tipo: "triangular",
  zIzq: 2,
  zDer: 4,
  b: 0.3,
  yMax: 0.35,
  Tmax: 1.0,
  zonaId: "centro",
  nIila: 0.5,
  tg: 10,
  eg: 40,
  bParam: 0.2,
  Tret: 10,
  Ltramo: 200,
  Bcalzada: 3.75,
  Ccalzada: 0.9,
  Htalud: 8,
  Ctalud: 0.4,
  usarTc: true,
  tMin: 10,
  estacionSenamhi: "Lima",
  codigoEstacion: "000474",
  periodoRegistro: "1991–2020",
  cotaRasante: 112.40,
  Stransversal: 0.02,
  progresiva: "km 12+340 – 12+540",
};

export function CunetaModule() {
  const [meta, setMeta] = useState({
    proyecto: "Cuneta de berma — drenaje longitudinal de vía",
    ubicacion: "Costa centro, Perú",
    profesional: "Ingeniero civil",
    cip: "",
  });
  const [inp, setInp] = useState<CunetaInput>(INP0);
  const r = useMemo(() => calcularCuneta(inp), [inp]);
  const zonaActiva = ZONAS_IILA.find((z) => z.id === inp.zonaId);
  const Tuso = T_RETORNO_VIA.find((t) => t.T === inp.Tret)?.uso ?? "Periodo de retorno de proyecto";
  const nUso = N_CUNETA.find((x) => Math.abs(x.n - inp.n) < 1e-6)?.label ?? "n adoptado por el proyectista";
  const seccionTxt =
    inp.tipo === "triangular"
      ? `triangular, taludes ${fmt(inp.zIzq, 1)}:1 (calzada) y ${fmt(inp.zDer, 1)}:1 (talud)`
      : `trapezoidal, solera b = ${fmt(inp.b, 2)} m, taludes ${fmt(inp.zIzq, 1)}:1 y ${fmt(inp.zDer, 1)}:1`;

  const doc: MemoriaDoc = useMemo(
    () => ({
      codigo: "HID-05",
      titulo: "Diseño hidráulico de cuneta",
      norma: "MTC DG-2018 · CE.040 · Manning · IILA–SENAMHI–UNI",
      blocks: [
        {
          type: "cover",
          kicker: "HID-05 · Drenaje longitudinal · Memoria de cálculo",
          titulo: "Diseño hidráulico de cuneta de vía",
          subtitulo:
            "Aporte de calzada y talud, IDF IILA–SENAMHI–UNI, Manning con taludes asimétricos y verificación de tirante, velocidad y espejo sobre el pavimento",
          meta: [
            { k: "Proyecto", v: meta.proyecto },
            { k: "Ubicación", v: meta.ubicacion },
            { k: "Profesional responsable", v: meta.cip ? `${meta.profesional} · CIP ${meta.cip}` : meta.profesional },
            { k: "Estación SENAMHI", v: inp.codigoEstacion ? `${inp.estacionSenamhi} (${inp.codigoEstacion})` : inp.estacionSenamhi || zonaActiva?.label || "—" },
            { k: "Periodo de registro", v: inp.periodoRegistro || "—" },
            { k: "Progresiva", v: inp.progresiva || "—" },
            { k: "Cota rasante", v: `${fmt(inp.cotaRasante, 2)} msnm` },
            { k: "Pendiente transversal", v: `${fmt(inp.Stransversal * 100, 1)} %` },
            { k: "Fecha", v: hoy },
            { k: "Normas de referencia", v: "MTC DG-2018 · RNE CE.040 · Manning · Estudio Hidrológico del Perú (IILA–SENAMHI–UNI)" },
            { k: "Periodo de retorno T", v: `${inp.Tret} años — ${Tuso}` },
            { k: "Sección", v: seccionTxt },
            { k: "Caudal de diseño Qd", v: `${fmt(r.Qd, 4)} m³/s  (${fmt(r.Qd * 1000, 2)} L/s)` },
          ],
        },
        { type: "h2", text: "1. Objeto y alcance" },
        {
          type: "p",
          text: "La presente memoria dimensiona la cuneta longitudinal que recoge el escurrimiento de media calzada y del talud adyacente, entre dos descargas (alcantarilla, sumidero o punto bajo). El caudal se obtiene con el método racional. La intensidad se calcula con la fórmula IILA–SENAMHI–UNI, con parámetros de zona climática calibrables a la estación SENAMHI del tramo. La sección —triangular de berma o trapezoidal revestida— se verifica por Manning: el tirante no debe rebasar el borde de pavimento, la velocidad debe quedar entre los límites del revestimiento y el espejo sobre la calzada (spread) no debe invadir el carril más allá de Tmáx.",
        },
        {
          type: "list",
          items: [
            "Área de aporte = Ltramo × (ancho que drena de calzada + ancho de talud que aporta).",
            "C ponderado por áreas: C = (Ccalzada·Acalzada + Ctalud·Atalud) / A.",
            "Qd = C · I · A / 360, con A en hectáreas.",
            "Geometría asimétrica: el talud lado calzada (zᵢ, usualmente 2:1 a 4:1 en cuneta de berma) no se promedia con el talud de relleno (zᵈ).",
            "Verificación: yₙ ≤ ymáx, Vmín ≤ V ≤ Vmáx y espejo T ≤ Tmáx.",
          ],
        },
        { type: "h2", text: "2. Marco normativo" },
        {
          type: "kv",
          rows: [
            { k: "MTC — Manual de Diseño Geométrico", v: "Cunetas de berma, revestimiento, pendiente longitudinal mínima y descarga a obras de arte." },
            { k: "RNE CE.040 Drenaje Pluvial", v: "Método racional, C, Tc y fórmula IILA para cuencas pequeñas (tramo de vía)." },
            { k: "Estudio de la Hidrología del Perú, Tomo III", v: "Parámetros t_g y e_g SENAMHI / IILA–UNI." },
            { k: "Manning (SI)", v: "Capacidad de la sección triangular o trapezoidal a superficie libre." },
          ],
        },
        {
          type: "note",
          text: "En vía, T = 10 años es habitual para el drenaje longitudinal menor; T = 25 años se reserva a la alcantarilla de cruce. Calibrar n, b, t_g y e_g con la estación SENAMHI del tramo.",
        },
        { type: "h2", text: "3. Criterios de diseño adoptados" },
        {
          type: "table",
          caption: "Tabla 1. Criterios de proyecto",
          headers: ["Parámetro", "Valor adoptado", "Fundamento"],
          rows: [
            ["Periodo de retorno T", `${inp.Tret} años`, Tuso],
            ["Duración de lluvia t", `${fmt(r.tMin, 0)} min`, inp.usarTc ? "t = máx(10 min, Tc Kirpich del tramo)" : `t fijo ${fmt(inp.tMin, 0)} min (mínimo 10 min)`],
            ["Longitud entre descargas", `${fmt(inp.Ltramo, 0)} m`, "Tramo de cuneta hasta el punto de descarga"],
            ["Ancho de calzada que drena", `${fmt(inp.Bcalzada, 2)} m`, "Media calzada o ancho hasta la pendiente transversal que vierte a la cuneta"],
            ["Ancho de talud que aporta", `${fmt(inp.Htalud, 2)} m`, "Proyección horizontal del talud que escurre hacia la cuneta"],
            ["n Manning", fmt(inp.n, 3), nUso],
            ["Tirante máximo ymáx", `${fmt(inp.yMax, 2)} m`, "Borde de pavimento / coronación de la cuneta"],
            ["Espejo máximo Tmáx", `${fmt(inp.Tmax, 2)} m`, "Invasión máxima sobre la calzada (spread)"],
            ["Velocidad", `${fmt(r.Vmin, 2)} – ${fmt(r.Vmax, 2)} m/s`, inp.n >= 0.022 ? "Tierra / revestimiento rugoso: evitar erosión" : "Concreto: 0.30 m/s evita depósito; 4 m/s evita abrasión"],
          ],
        },
        { type: "h2", text: "4. Hidrología — aporte de calzada y talud" },
        { type: "h3", text: "4.1 Área y coeficiente ponderado" },
        { type: "eq", text: "Acalzada = L · Bcalzada     ·     Atalud = L · Btalud     ·     A = Acalzada + Atalud", num: "1" },
        { type: "eq", text: "C = (Ccalzada · Acalzada + Ctalud · Atalud) / A", num: "2" },
        paso(
          "4.1",
          "Áreas de aporte y C ponderado",
          "A = L (Bcalzada + Btalud)     ·     C ponderado por áreas",
          `Acalzada = ${fmt(inp.Ltramo, 0)} × ${fmt(inp.Bcalzada, 2)} = ${fmt(r.Acalzada, 1)} m²
Atalud = ${fmt(inp.Ltramo, 0)} × ${fmt(inp.Htalud, 2)} = ${fmt(r.Atalud, 1)} m²
C = (${fmt(inp.Ccalzada, 2)} × ${fmt(r.Acalzada, 1)} + ${fmt(inp.Ctalud, 2)} × ${fmt(r.Atalud, 1)}) / ${fmt(r.Am2, 1)}`,
          `A = ${fmt(r.Am2, 1)} m² = ${fmt(r.Aha, 4)} ha     ·     C = ${fmt(r.C, 3)}`,
          "El pavimento aporta casi toda la lluvia (C ≈ 0.90). El talud reduce C según su cobertura."
        ),
        { type: "h3", text: "4.2 Intensidad — fórmula IILA–SENAMHI–UNI modificada" },
        { type: "eq", text: "I(t, T) = a · (1 + K · log₁₀ T) · (t + b)ⁿ⁻¹     (t < 3 h)", num: "3" },
        { type: "eq", text: "a = (1 / t_g)ⁿ · e_g     ·     K′_g = 22.5 · e_g⁻⁰·⁸⁵", num: "4" },
        paso(
          "4.2.1",
          "Parámetro de intensidad a",
          "a = (1 / t_g)ⁿ · e_g",
          `a = (1 / ${fmt(inp.tg, 2)})^${fmt(inp.nIila, 3)} × ${fmt(inp.eg, 1)}`,
          `a = ${fmt(r.a, 3)} mm`,
          "Se redondea a tres decimales porque a alimenta toda la familia de curvas IDF."
        ),
        paso(
          "4.2.2",
          "Parámetro de frecuencia K′_g",
          "K′_g = 22.5 · e_g⁻⁰·⁸⁵",
          `K′_g = 22.5 × ${fmt(inp.eg, 1)}⁻⁰·⁸⁵`,
          `K′_g = ${fmt(r.Kfreq, 3)}`,
          "K crece cuando e_g es menor (climas más secos)."
        ),
        {
          type: "kv",
          rows: [
            { k: "Zona IILA / SENAMHI", v: zonaActiva?.label ?? "Parámetros ingresados por el proyectista" },
            { k: "n (Tabla 3.b CE.040)", v: fmt(inp.nIila, 3), u: "—" },
            { k: "b parámetro de tiempo", v: fmt(inp.bParam, 2), u: "h" },
            { k: "t_g", v: fmt(inp.tg, 2), u: "—" },
            { k: "e_g", v: fmt(inp.eg, 1), u: "mm" },
            { k: "T", v: fmt(inp.Tret, 0), u: "años" },
          ],
        },
        {
          type: "note",
          text:
            zonaActiva?.nota ??
            "Calibrar n, b, t_g y e_g con la Tabla 3 de CE.040 y la estación SENAMHI más cercana.",
        },
        {
          type: "table",
          caption: `Tabla 2. Intensidades I(t,T) en mm/h — a = ${fmt(r.a, 3)} mm, K = ${fmt(r.Kfreq, 3)}`,
          headers: ["t (min)", ...r.periodos.map((T) => `${T} años`)],
          rows: r.idf.map((row) => [String(row.tMin), ...r.periodos.map((T) => fmtFixed(row.intensidades[T], 2))]),
        },
        paso(
          "4.3",
          "Tiempo de concentración e intensidad de diseño",
          "Kirpich: Tc = 0.0195 L⁰·⁷⁷ S⁻⁰·³⁸⁵     ·     FAA: Tc = 0.7035 (1.1−C) √L / S¹⁄³  (h → min)",
          `L = ${fmt(inp.Ltramo, 0)} m    S = ${fmt(inp.S, 4)} m/m    Tc Kirpich = ${fmt(r.TcKir, 1)} min    Tc FAA = ${fmt(r.TcFaa, 1)} min`,
          `Se adopta Tc = ${fmt(r.Tc, 1)} min (Kirpich, flujo por cuneta)    ·    t = ${fmt(r.tMin, 0)} min    ·    I = ${fmt(r.I, 2)} mm/h`,
          "En tramos cortos el piso de 10 min gobierna. FAA se reporta como control (flujo superficial sobre pavimento)."
        ),
        paso(
          "4.4",
          "Caudal de la cuneta",
          "Q = C · I · A / 360",
          `Q = ${fmt(r.C, 3)} × ${fmt(r.I, 2)} × ${fmt(r.Aha, 4)} / 360`,
          `Q_racional = ${fmt(r.Qrac, 4)} m³/s = ${fmt(r.Qrac * 1000, 2)} L/s`,
          inp.Qforzado > 0
            ? `Se adopta caudal forzado Qd = ${fmt(r.Qd, 4)} m³/s. El racional queda como control.`
            : "Qd es el racional. Si hay un tramo más largo o una quebrada que descarga a la cuneta, forzar Q o aumentar L."
        ),
        {
          type: "table",
          caption: "Tabla 3. Resumen hidrológico",
          headers: ["Magnitud", "Símbolo", "Valor", "Unidad"],
          rows: [
            ["Área de calzada", "Acalzada", fmt(r.Acalzada, 1), "m²"],
            ["Área de talud", "Atalud", fmt(r.Atalud, 1), "m²"],
            ["Área total", "A", `${fmt(r.Am2, 1)} (${fmt(r.Aha, 4)} ha)`, "m²"],
            ["C ponderado", "C", fmt(r.C, 3), "—"],
            ["Tiempo de concentración", "Tc", fmt(r.Tc, 1), "min"],
            ["Duración de diseño", "t", fmt(r.tMin, 0), "min"],
            ["Intensidad", "I", fmt(r.I, 2), "mm/h"],
            ["Caudal de diseño", "Qd", fmt(r.Qd, 4), "m³/s"],
          ],
        },
        { type: "h2", text: "5. Geometría de la sección" },
        {
          type: "p",
          text: `Cuneta ${seccionTxt}. El lado calzada es el que define el espejo sobre el pavimento (spread ≈ yₙ · zᵢ). El lado talud es más tendido para encajar el relleno y aumentar la capacidad.`,
        },
        { type: "eq", text: inp.tipo === "triangular" ? "A = ½ y² (zᵢ + zᵈ)     ·     P = y (√(1+zᵢ²) + √(1+zᵈ²))     ·     T = y (zᵢ + zᵈ)" : "A = y [b + ½ y (zᵢ + zᵈ)]     ·     P = b + y (√(1+zᵢ²) + √(1+zᵈ²))", num: "5" },
        { type: "h2", text: "6. Desarrollo del cálculo hidráulico" },
        paso(
          "6.1",
          "Tirante normal por bisección de Manning",
          "Q = (1/n) · A · R²⁄³ · S¹⁄²     ·     se busca y tal que Q(y) = Qd",
          `n = ${fmt(inp.n, 3)}    S = ${fmt(inp.S, 4)}    zᵢ = ${fmt(inp.zIzq, 2)}    zᵈ = ${fmt(inp.zDer, 2)}${inp.tipo === "trapezoidal" ? `    b = ${fmt(inp.b, 2)} m` : ""}`,
          `yₙ = ${fmt(r.yn, 4)} m    ·    A = ${fmt(r.g.A, 4)} m²    ·    P = ${fmt(r.g.P, 4)} m    ·    R = ${fmt(r.g.R, 4)} m    ·    T = ${fmt(r.g.T, 3)} m`,
          "Los taludes no se promedian: la cuneta de vía es asimétrica. El talud suave agranda el espejo."
        ),
        paso(
          "6.2",
          "Velocidad, Froude y tirante crítico",
          "V = Q/A     ·     Fr = V / √(g D)     ·     y_c de Q²/g = A³/T",
          `Qₙ = ${fmt(r.Qn, 4)} m³/s    A = ${fmt(r.g.A, 4)} m²    D = A/T = ${fmt(r.g.Dhid, 4)} m`,
          `V = ${fmt(r.V, 3)} m/s    ·    Fr = ${fmt(r.Fr, 3)}    ·    y_c = ${fmt(r.yc, 4)} m`,
          `Límites del revestimiento: ${fmt(r.Vmin, 2)} ≤ V ≤ ${fmt(r.Vmax, 2)} m/s. ${r.Fr < 1 ? "Régimen subcrítico (típico en cuneta de berma)." : "Régimen supercrítico: vigilar erosión en cambios de pendiente y en la descarga."}`
        ),
        paso(
          "6.3",
          "Capacidad al borde de pavimento y espejo",
          "Q_cap = Manning (y = ymáx)     ·     spread ≈ yₙ · zᵢ",
          `ymáx = ${fmt(inp.yMax, 3)} m    zᵢ = ${fmt(inp.zIzq, 2)}    Tmáx = ${fmt(inp.Tmax, 2)} m`,
          `Q_cap = ${fmt(r.Qcap, 4)} m³/s    ·    yₙ / ymáx = ${fmt((r.yn / inp.yMax) * 100, 1)} %    ·    espejo = ${fmt(r.spread, 3)} m`,
          r.cumpleTirante
            ? "El tirante de diseño no rebasa el borde de pavimento."
            : "yₙ > ymáx: ampliar taludes, solera, pendiente o revestir (menor n), o acortar el tramo entre descargas."
        ),
        {
          type: "table",
          caption: "Tabla 4. Verificaciones hidráulicas",
          headers: ["Verificación", "Resultado", "Criterio", "Cumple"],
          rows: [
            ["Tirante vs borde de pavimento", `yₙ = ${fmt(r.yn, 3)} m`, `≤ ymáx = ${fmt(inp.yMax, 3)} m`, r.cumpleTirante ? "Sí" : "No"],
            ["Capacidad a ymáx", `${fmt(r.Qcap, 4)} m³/s`, `≥ Qd = ${fmt(r.Qd, 4)} m³/s`, r.Qcap >= r.Qd ? "Sí" : "No"],
            ["Velocidad mínima", `${fmt(r.V, 3)} m/s`, `≥ ${fmt(r.Vmin, 2)} m/s`, r.cumpleVelMin ? "Sí" : "No"],
            ["Velocidad máxima", `${fmt(r.V, 3)} m/s`, `≤ ${fmt(r.Vmax, 2)} m/s`, r.cumpleVelMax ? "Sí" : "No"],
            ["Espejo sobre calzada", `${fmt(r.spread, 3)} m`, `≤ Tmáx = ${fmt(inp.Tmax, 2)} m`, r.cumpleSpread ? "Sí" : "No"],
          ],
        },
        {
          type: "check",
          ok: r.cumpleTirante,
          text: `yₙ = ${fmt(r.yn, 3)} m ${r.cumpleTirante ? "≤" : ">"} ymáx = ${fmt(inp.yMax, 3)} m.`,
        },
        {
          type: "check",
          ok: r.cumpleVelMin && r.cumpleVelMax,
          text: `V = ${fmt(r.V, 3)} m/s (recomendado ${fmt(r.Vmin, 2)}–${fmt(r.Vmax, 2)} m/s para este revestimiento).`,
        },
        {
          type: "check",
          ok: r.cumpleSpread,
          text: `Espejo sobre calzada = ${fmt(r.spread, 3)} m ${r.cumpleSpread ? "≤" : ">"} Tmáx = ${fmt(inp.Tmax, 2)} m.`,
        },
        { type: "h2", text: "7. Conclusión" },
        {
          type: "p",
          text: `Cuneta ${seccionTxt}, n = ${fmt(inp.n, 3)}, S = ${fmt(inp.S, 4)}. Aporte ${fmt(r.Aha, 4)} ha (L = ${fmt(inp.Ltramo, 0)} m), Qd = ${fmt(r.Qd, 4)} m³/s (${fmt(r.Qd * 1000, 1)} L/s) para T = ${inp.Tret} años e I = ${fmt(r.I, 2)} mm/h. Tirante ${fmt(r.yn, 3)} m, velocidad ${fmt(r.V, 2)} m/s, espejo ${fmt(r.spread, 2)} m. ${
            r.cumpleTirante && r.cumpleVelMin && r.cumpleVelMax && r.cumpleSpread
              ? "Cumple tirante, velocidad y espejo. Se recomienda detallar juntas, descargas y transiciones en el plano de obra."
              : "No cumple uno o más criterios: ajustar sección, revestimiento, pendiente o longitud entre descargas, o revisar C y la estación SENAMHI."
          }`,
        },
      ],
    }),
    [inp, meta, r, zonaActiva, Tuso, nUso, seccionTxt]
  );
  const livePack = useMemo(() => ({ doc, inp, r }), [doc, inp, r]);
  const { doc: pack, dirty, calcular } = useMemoriaOnCalcular(livePack);
  const memoria = pack.doc;

  const set = <K extends keyof CunetaInput>(k: K, v: CunetaInput[K]) => setInp((s) => ({ ...s, [k]: v }));

  return (
    <>
      <aside id="app-panel" className="panel">
        <h2>Cuneta</h2>
        <p className="lead">
          Memoria profesional: aporte de calzada y talud, IDF IILA–SENAMHI, Manning y verificación de tirante, velocidad y espejo. Edite los datos y pulse Calcular.
        </p>
        <CalcDirtyNote dirty={dirty} />
        <fieldset className="fieldset">
          <legend>Identificación</legend>
          <Field label="Proyecto"><Text value={meta.proyecto} onChange={(v) => setMeta({ ...meta, proyecto: v })} /></Field>
          <Field label="Ubicación"><Text value={meta.ubicacion} onChange={(v) => setMeta({ ...meta, ubicacion: v })} /></Field>
          <Field label="Profesional"><Text value={meta.profesional} onChange={(v) => setMeta({ ...meta, profesional: v })} /></Field>
          <Field label="CIP"><Text value={meta.cip} onChange={(v) => setMeta({ ...meta, cip: v })} /></Field>
          <Field label="Estación SENAMHI"><Text value={inp.estacionSenamhi} onChange={(v) => set("estacionSenamhi", v)} /></Field>
          <div className="grid-2">
            <Field label="Código estación"><Text value={inp.codigoEstacion} onChange={(v) => set("codigoEstacion", v)} /></Field>
            <Field label="Periodo registro"><Text value={inp.periodoRegistro} onChange={(v) => set("periodoRegistro", v)} /></Field>
            <Field label="Progresiva"><Text value={inp.progresiva} onChange={(v) => set("progresiva", v)} /></Field>
            <Field label="Cota rasante" unit="msnm"><Num value={inp.cotaRasante} onChange={(v) => set("cotaRasante", v)} /></Field>
            <Field label="S transversal" unit="m/m"><Num value={inp.Stransversal} onChange={(v) => set("Stransversal", v)} /></Field>
          </div>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Hidrología · SENAMHI / IILA</legend>
          <Field label="Zona IILA">
            <select
              value={zonaActiva?.id ?? inp.zonaId}
              onChange={(e) => {
                const z = ZONAS_IILA.find((x) => x.id === e.target.value);
                if (!z) return;
                setInp((s) => ({ ...s, zonaId: z.id, nIila: z.n, bParam: z.b, tg: z.tg, eg: z.eg }));
              }}
            >
              {ZONAS_IILA.map((z) => (
                <option key={z.id} value={z.id}>{z.label}</option>
              ))}
            </select>
          </Field>
          <div className="grid-2">
            <Field label="n IILA" unit="—"><Num value={inp.nIila} onChange={(v) => set("nIila", v)} /></Field>
            <Field label="b" unit="h"><Num value={inp.bParam} onChange={(v) => set("bParam", v)} /></Field>
            <Field label="t_g"><Num value={inp.tg} onChange={(v) => set("tg", v)} /></Field>
            <Field label="e_g" unit="mm"><Num value={inp.eg} onChange={(v) => set("eg", v)} /></Field>
            <Field label="T retorno" unit="años"><Num value={inp.Tret} onChange={(v) => set("Tret", v)} step="1" /></Field>
            <Field label="t diseño" unit="min"><Num value={inp.tMin} onChange={(v) => set("tMin", v)} step="1" /></Field>
          </div>
          <Field label="Duración t">
            <select value={inp.usarTc ? "tc" : "fijo"} onChange={(e) => set("usarTc", e.target.value === "tc")}>
              <option value="tc">t = máx(10 min, Tc Kirpich)</option>
              <option value="fijo">t fijo (mínimo 10 min)</option>
            </select>
          </Field>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Aporte (calzada + talud)</legend>
          <div className="grid-2">
            <Field label="L tramo" unit="m"><Num value={inp.Ltramo} onChange={(v) => set("Ltramo", v)} /></Field>
            <Field label="Ancho calzada" unit="m"><Num value={inp.Bcalzada} onChange={(v) => set("Bcalzada", v)} /></Field>
            <Field label="C calzada">
              <select value={String(inp.Ccalzada)} onChange={(e) => set("Ccalzada", parseFloat(e.target.value))}>
                {C_CUNETA.map((c) => (
                  <option key={`c-${c.C}`} value={c.C}>{c.C.toFixed(2)} — {c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Ancho talud" unit="m"><Num value={inp.Htalud} onChange={(v) => set("Htalud", v)} /></Field>
            <Field label="C talud">
              <select value={String(inp.Ctalud)} onChange={(e) => set("Ctalud", parseFloat(e.target.value))}>
                {C_CUNETA.map((c) => (
                  <option key={`t-${c.C}`} value={c.C}>{c.C.toFixed(2)} — {c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Q forzado" unit="m³/s" note="0 = usar el caudal racional">
              <Num value={inp.Qforzado} onChange={(v) => set("Qforzado", v)} />
            </Field>
          </div>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Sección de la cuneta</legend>
          <Field label="Tipo">
            <select value={inp.tipo} onChange={(e) => set("tipo", e.target.value as CunetaInput["tipo"])}>
              <option value="triangular">Triangular (berma)</option>
              <option value="trapezoidal">Trapezoidal</option>
            </select>
          </Field>
          <Field label="n Manning">
            <select value={String(inp.n)} onChange={(e) => set("n", parseFloat(e.target.value))}>
              {N_CUNETA.map((x) => (
                <option key={x.n} value={x.n}>{x.n.toFixed(3)} — {x.label}</option>
              ))}
            </select>
          </Field>
          <div className="grid-2">
            <Field label="S"><Num value={inp.S} onChange={(v) => set("S", v)} /></Field>
            <Field label="y máx" unit="m"><Num value={inp.yMax} onChange={(v) => set("yMax", v)} /></Field>
            <Field label="z calzada"><Num value={inp.zIzq} onChange={(v) => set("zIzq", v)} /></Field>
            <Field label="z talud"><Num value={inp.zDer} onChange={(v) => set("zDer", v)} /></Field>
            {inp.tipo === "trapezoidal" && (
              <Field label="b solera" unit="m"><Num value={inp.b} onChange={(v) => set("b", v)} /></Field>
            )}
            <Field label="T máx espejo" unit="m"><Num value={inp.Tmax} onChange={(v) => set("Tmax", v)} /></Field>
          </div>
        </fieldset>
        <div className="actions">
          <CalcularButton onClick={calcular} dirty={dirty} />
          <button className="btn" disabled={!memoria} onClick={() => memoria && exportarWord(memoria)}>Exportar Word</button>
          <button className="btn secondary" disabled={!memoria} onClick={() => memoria && printMemoria(memoria.titulo)}>Imprimir / PDF</button>
        </div>
      </aside>
      {memoria ? (
        <Paper
          doc={memoria}
          extra={
            <CunetaSvg
              zIzq={pack.inp.zIzq}
              zDer={pack.inp.zDer}
              y={pack.r.yn}
              b={pack.inp.b}
              tipo={pack.inp.tipo}
              yMax={pack.inp.yMax}
            />
          }
        />
      ) : (
        <MemoriaPendiente />
      )}
    </>
  );
}
