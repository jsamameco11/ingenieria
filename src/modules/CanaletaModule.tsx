import { useMemo, useState } from "react";
import {
  C_TABLA,
  CD_BAJANTE,
  DESTINOS,
  DISTRIBs_CANALETA,
  DIST_CIMIENTOS_MIN,
  ESQUEMAS_TECHO,
  EJEMPLO_CHICLAYO,
  L_MAX_SALIDA,
  S_MIN_CANALETA,
  T_RETORNO,
  Y_FRACCION,
  ZONAS_IILA,
  calcularDrenaje,
  elegirBajante,
  nuevoElemento,
  type DestinoDescarga,
  type DistribCanaleta,
  type DrenajeInput,
  type ElementoPluvial,
  type EsquemaTecho,
  type FormulaTc,
  type LadoPluvial,
  type TipoElemento,
} from "../lib/hidro/canaleta";
import { colocarNuevoElemento } from "../lib/hidro/emplazamiento";
import { fmt, fmtFixed } from "../lib/num";
import { paso, type MemoriaDoc } from "../lib/memoria";
import { Field, Num, Text } from "../ui/Field";
import { CalcDirtyNote, CalcularButton, MemoriaPendiente, useMemoriaOnCalcular } from "../ui/calcular";
import { Paper } from "../ui/Paper";
import { BajanteSvg, CanaletaSvg, TrazadoPluvialSvg } from "../ui/diagrams";
import { EmplazamientoPluvialSvg } from "../ui/EmplazamientoPluvial";
import { exportarWord } from "../lib/exportWord";
import { printMemoria } from "../lib/printDoc";

const hoy = new Date().toLocaleDateString("es-PE");

const DESTINO_TXT: Record<DestinoDescarga, string> = {
  jardin: "jardín o área verde, a no menos de 1.5 m de la cimentación",
  cuneta: "cuneta de vía",
  "red-pluvial": "red pública de drenaje pluvial, con conexión según OS.060",
  infiltracion: "caja de infiltración o pozo seco, fuera de la zona de influencia de la zapata",
};

export function CanaletaModule() {
  const [inp, setInp] = useState<DrenajeInput>({
    proyecto: "Drenaje pluvial de cubiertas y estacionamiento",
    ubicacion: "Chiclayo, Lambayeque",
    profesional: "Ingeniero civil",
    cip: "",
    estacionSenamhi: "Chiclayo",
    codigoEstacion: "103044",
    periodoRegistro: "1991–2020",
    cotaCubierta: 32.4,
    cotaDescarga: 29.8,
    utmEste: 630450,
    utmNorte: 9256120,
    materialCanaleta: "PVC liso / metal prelacado",
    Lbajante: 8.5,
    nCodosBajante: 2,
    KcodoBajante: 0.9,
    nIila: 0.432,
    tg: 12.85,
    eg: 61.5,
    bParam: 0.2,
    Tret: 10,
    tDisenoMin: 10,
    usarTcComoDuracion: false,
    formulaTc: "faa",
    destino: "jardin",
    distCimentacion: 2,
    elementos: EJEMPLO_CHICLAYO.map((e) => ({ ...e })),
  });
  const [selId, setSelId] = useState(EJEMPLO_CHICLAYO[0].id);

  const r = useMemo(() => calcularDrenaje(inp), [inp]);
  const sel = inp.elementos.find((e) => e.id === selId) ?? inp.elementos[0];
  const it = r.items.find((x) => x.el.id === sel?.id) ?? r.items[0];
  const zonaActiva = ZONAS_IILA.find(
    (z) => z.n === inp.nIila && z.tg === inp.tg && z.eg === inp.eg
  );

  const baj1 = it ? elegirBajante(it.Qlps, sel.y) : null;
  const baj2 = it ? elegirBajante(it.Qlps / 2, sel.y) : null;

  const doc: MemoriaDoc = useMemo(() => {
    if (!sel || !it) {
      return { codigo: "HID-01", titulo: "Drenaje pluvial", norma: "RNE CE.040", blocks: [] };
    }
    const Tuso = T_RETORNO.find((t) => t.T === inp.Tret)?.uso ?? "Periodo de retorno de proyecto";
    const vMax = sel.tipo === "piso" ? 4.5 : 3.5;
    const material = sel.tipo === "piso" ? "concreto con rejilla" : "metal / PVC liso";
    const todosOk = r.nFail === 0;
    return {
      codigo: "HID-01",
      titulo: "Diseño de drenaje pluvial de cubiertas",
      norma: "RNE CE.040 · OS.060 · Manning",
      blocks: [
        {
          type: "cover",
          kicker: "HID-01 · Drenaje pluvial · Memoria de cálculo",
          titulo: "Diseño de drenaje pluvial de cubiertas y áreas pavimentadas",
          subtitulo:
            "Método racional CE.040, intensidad IILA–SENAMHI–UNI, canaletas por Manning con holgura y bajantes por orificio",
          meta: [
            { k: "Proyecto", v: inp.proyecto },
            { k: "Ubicación", v: inp.ubicacion },
            { k: "Profesional responsable", v: inp.cip ? `${inp.profesional} · CIP ${inp.cip}` : inp.profesional },
            { k: "Estación SENAMHI", v: inp.codigoEstacion ? `${inp.estacionSenamhi} (${inp.codigoEstacion})` : inp.estacionSenamhi || zonaActiva?.label || "Zona IILA" },
            { k: "Periodo de registro", v: inp.periodoRegistro || "—" },
            { k: "Cota cubierta / descarga", v: `${fmt(inp.cotaCubierta ?? 0, 2)} / ${fmt(inp.cotaDescarga ?? 0, 2)} msnm` },
            { k: "Fecha", v: hoy },
            { k: "Normas de referencia", v: "RNE CE.040 Drenaje Pluvial · RNE OS.060 · Manning · FAA (Tabla 2 CE.040)" },
            { k: "Periodo de retorno T", v: `${inp.Tret} años — ${Tuso}` },
            { k: "Elementos dimensionados", v: `${r.items.length} canaletas / canales de piso` },
            { k: "Caudal total de cubiertas", v: `${fmt(r.Qtotal, 3)} L/s  (${fmt(r.ATotal, 1)} m² de aporte)` },
          ],
        },
        { type: "h2", text: "1. Objeto y alcance" },
        {
          type: "p",
          text: "La presente memoria dimensiona el sistema de drenaje pluvial de la edificación: canaletas de cubierta, canal de piso del estacionamiento, salidas y bajantes. El caudal de diseño se obtiene con el método racional, aplicable a cuencas de área menor a 5 km² según CE.040. La intensidad se calcula con la fórmula IILA–SENAMHI–UNI modificada (t < 3 h). Cada canaleta se verifica a superficie libre con Manning, dejando holgura (freeboard) para que el agua no trabaje a sección llena. Las bajantes se dimensionan como orificio a la salida de la canaleta, con diámetros comerciales de PVC.",
        },
        {
          type: "list",
          items: [
            "Coeficiente de escorrentía C según Tabla 1.b de CE.040 (techos, pavimentos, jardines).",
            "Intensidad I(t,T) con IILA–SENAMHI–UNI modificada y curvas IDF del emplazamiento.",
            "Tiempo de concentración por la Federal Aviation Administration (Tabla 2 CE.040), con Kirpich como control.",
            "Duración de diseño t = 10 min en cubiertas de pequeña inercia (práctica CE.040 para áreas pequeñas), salvo que se adopte t = Tc.",
            "Verificación hidráulica por Manning, holgura y diámetros comerciales de bajante.",
          ],
        },
        { type: "h2", text: "2. Marco normativo" },
        {
          type: "kv",
          rows: [
            { k: "RNE CE.040 Drenaje Pluvial", v: "Hidrología de diseño, C, Tc, fórmula IILA y criterios de evacuación en edificaciones." },
            { k: "RNE OS.060 Drenaje Pluvial", v: "Aplica si la descarga se conecta a la red urbana (periodo de retorno del colector, sumideros)." },
            { k: "Estudio de la Hidrología del Perú, Tomo III", v: "Parámetros t_g y e_g de estaciones pluviométricas (SENAMHI / IILA–UNI)." },
            { k: "Manning (SI)", v: "Capacidad de canaletas y canales de piso a superficie libre." },
            { k: "Buena práctica de edificación", v: "Holgura 30–40 % de H, pendiente 0.5–1 %, una salida cada 10–12 m, no descargar junto a la cimentación." },
          ],
        },
        {
          type: "note",
          text: "CE.040 rige el sistema en predio (cubiertas, patios, estacionamiento). OS.060 rige la red pública a la que se entrega el caudal. Ambos se citan porque la descarga no puede diseñarse ignorando el destino final.",
        },
        { type: "h2", text: "3. Criterios de diseño adoptados" },
        {
          type: "table",
          caption: "Tabla 1. Criterios de proyecto",
          headers: ["Parámetro", "Valor adoptado", "Fundamento"],
          rows: [
            ["Periodo de retorno T", `${inp.Tret} años`, Tuso],
            ["Duración de lluvia t", `${r.hidro.tMin} min`, inp.usarTcComoDuracion ? "t = max(10 min, Tc)" : "t mínimo 10 min para cubiertas (CE.040, áreas pequeñas)"],
            ["Fórmula de Tc", inp.formulaTc === "faa" ? "FAA (Tabla 2 CE.040)" : "Kirpich (Tabla 2 CE.040)", "Flujo superficial urbano en cubiertas y patios"],
            ["Pendiente mínima de canaleta", `${fmt(S_MIN_CANALETA * 100, 1)} %  (${fmt(S_MIN_CANALETA, 3)} m/m)`, "0.5 % mínimo de obra; 1 % recomendado"],
            ["Holgura", "a + a₂ ≈ 5 + 5 cm, o y ≤ 0.60 H", "La canaleta no trabaja llena: hojas, oleaje y picos"],
            ["Longitud máxima a una salida", `${L_MAX_SALIDA} m`, "Si el tramo es mayor, se colocan dos bajantes (una en cada extremo)"],
            ["Descarga", DESTINO_TXT[inp.destino], `Distancia a cimentación: ${fmt(inp.distCimentacion, 2)} m (mínimo ${DIST_CIMIENTOS_MIN} m)`],
            ["Material de canaleta", inp.materialCanaleta || "—", "Justifica n de Manning y el catálogo comercial"],
            ["Bajante vertical", `L = ${fmt(inp.Lbajante ?? 0, 1)} m · ${inp.nCodosBajante ?? 0} codos`, "Pérdidas menores se restan de la carga del orificio"],
            ["Estación SENAMHI", inp.estacionSenamhi || zonaActiva?.label || "—", inp.periodoRegistro || "Calibrar n, tg y eg con la estación del predio"],
          ],
        },
        { type: "h2", text: "4. Hidrología — CE.040" },
        { type: "h3", text: "4.1 Coeficiente de escorrentía C" },
        {
          type: "p",
          text: "C se toma de la Tabla 1.b de CE.040 según el revestimiento de cada cuenca de aporte. En cubiertas y azoteas el valor de cálculo es 0.95 (casi toda la lluvia llega a la canaleta). En cobertura liviana de calamina puede usarse 0.90. El estacionamiento se calcula con el C de su superficie (pavimento 0.85–0.95). El área se mide en planta (proyección horizontal), no sobre el faldón inclinado.",
        },
        { type: "h3", text: "4.2 Intensidad — fórmula IILA–SENAMHI–UNI modificada" },
        { type: "eq", text: "I(t, T) = a · (1 + K · log₁₀ T) · (t + b)ⁿ⁻¹     (t < 3 h)", num: "1" },
        { type: "eq", text: "a = (1 / t_g)ⁿ · e_g", num: "2" },
        { type: "eq", text: "K′_g = 22.5 · e_g⁻⁰·⁸⁵", num: "3" },
        paso(
          "4.2.1",
          "Parámetro de intensidad a",
          "a = (1 / t_g)ⁿ · e_g",
          `a = (1 / ${fmt(inp.tg, 2)})^${fmt(inp.nIila, 3)} × ${fmt(inp.eg, 1)}`,
          `a = ${fmt(r.hidro.a, 3)} mm`,
          "Se redondea a tres decimales porque a alimenta toda la familia de curvas IDF."
        ),
        paso(
          "4.2.2",
          "Parámetro de frecuencia K′_g",
          "K′_g = 22.5 · e_g⁻⁰·⁸⁵",
          `K′_g = 22.5 × ${fmt(inp.eg, 1)}⁻⁰·⁸⁵`,
          `K′_g = ${fmt(r.hidro.K, 3)}`,
          "K crece cuando e_g es menor (climas más secos): una misma T produce intensidades más contrastadas."
        ),
        {
          type: "kv",
          rows: [
            { k: "Zona IILA", v: zonaActiva?.label ?? "Parámetros ingresados por el proyectista" },
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
            "Calibrar n, b, t_g y e_g con la Tabla 3 de CE.040 y la estación SENAMHI más cercana. No copiar parámetros de otra región.",
        },
        { type: "h3", text: "4.3 Curvas intensidad–duración–frecuencia" },
        {
          type: "table",
          caption: `Tabla 2. Intensidades I(t,T) en mm/h — a = ${fmt(r.hidro.a, 3)} mm, K = ${fmt(r.hidro.K, 3)}`,
          headers: ["t (min)", ...r.hidro.periodos.map((T) => `${T} años`)],
          rows: r.hidro.idf.map((row) => [
            String(row.tMin),
            ...r.hidro.periodos.map((T) => fmtFixed(row.intensidades[T], 2)),
          ]),
        },
        paso(
          "4.3",
          "Intensidad de diseño",
          "I(t, T) = a · (1 + K · log₁₀ T) · (t + b)ⁿ⁻¹",
          `I = ${fmt(r.hidro.a, 3)} × (1 + ${fmt(r.hidro.K, 3)} × log₁₀ ${fmt(inp.Tret, 0)}) × (${fmt(r.hidro.tMin, 0)}/60 + ${fmt(inp.bParam, 2)})^(${fmt(inp.nIila, 3)} − 1)`,
          `I = ${fmt(r.hidro.I, 2)} mm/h   para T = ${fmt(inp.Tret, 0)} años y t = ${fmt(r.hidro.tMin, 0)} min`,
          inp.usarTcComoDuracion
            ? "La duración es el tiempo de concentración (no menor de 10 min), coherente con el viaje del hidrograma."
            : "En cubiertas de poca inercia se evalúa I a t = 10 min (fila de la tabla IDF). El Tc se reporta como control: usarlo como duración baja I y es menos conservador."
        ),
        { type: "h2", text: "5. Cuadro general del sistema" },
        {
          type: "p",
          text: `Se dimensionan ${r.items.length} elementos. El caudal total hacia ${DESTINO_TXT[inp.destino]} es ${fmt(r.Qtotal, 3)} L/s, con un área de aporte de ${fmt(r.ATotal, 1)} m². Cada fila se verifica por capacidad (Qcap ≥ Qd), holgura, pendiente y diámetro de bajante. La figura de emplazamiento muestra las cuencas en planta, el trazo de cada canaleta sobre su borde de descarga y las bajantes; el elemento desarrollado en el §6 aparece resaltado.`,
        },
        {
          type: "table",
          caption: "Tabla 3. Resumen hidráulico de canaletas y canal de piso",
          headers: ["Elem.", "Tipo", "A (m²)", "Qd (L/s)", "Sección (cm)", "Qcap (L/s)", "Ø baj. (mm)", "n°", "Verif."],
          rows: r.items.map((x) => [
            x.el.codigo,
            x.el.tipo === "piso" ? "Piso" : "Cubierta",
            fmt(x.Am2, 2),
            fmt(x.Qlps, 3),
            `${fmt(x.el.bPropuesto, 0)}×${fmt(x.el.hPropuesto, 0)}`,
            fmt(x.Qcap * 1000, 3),
            String(x.bajante.nom),
            String(x.el.nBajantes),
            x.ok ? "CUMPLE" : "REVISAR",
          ]),
        },
        {
          type: "check",
          ok: todosOk,
          text: todosOk
            ? `Los ${r.nOk} elementos cumplen capacidad, holgura, pendiente mínima y bajante.`
            : `${r.nFail} elemento(s) no cumplen. Revisar sección, pendiente, número de bajantes o diámetro.`,
        },
        { type: "h2", text: `6. Cálculo detallado — ${sel.codigo}` },
        {
          type: "p",
          text: `${sel.descripcion}${sel.ejes ? ` · ejes ${sel.ejes}` : ""}${sel.nivel ? ` · nivel ${sel.nivel}` : ""}. Superficie de cálculo: ${material}. C = ${fmt(sel.C, 2)}. El área de aporte es la suma de la cuenca (A1) y de la propia canaleta (A2), ambas en proyección horizontal.`,
        },
        { type: "h3", text: "6.1 Tiempo de concentración" },
        {
          type: "p",
          text:
            inp.formulaTc === "faa"
              ? "Se emplea la fórmula de la Federal Aviation Administration (Tabla 2 CE.040) para flujo superficial en cuencas urbanas. El tiempo total es la suma del recorrido sobre la cubierta o patio y a lo largo de la canaleta."
              : "Se emplea Kirpich (Tabla 2 CE.040), habitual en cuencas rurales y como control de la FAA en tramos cortos. El tiempo total es la suma de los dos tramos.",
        },
        {
          type: "eq",
          text:
            inp.formulaTc === "faa"
              ? "T_c = 0.7035 · (1.1 − C) · L⁰·⁵ / S⁰·³³³   (h)     →     T_c [min] = 60 · T_c"
              : "T_c = 0.0195 · L⁰·⁷⁷ · S⁻⁰·³⁸⁵     (min, L en m, S en m/m)",
          num: "4",
        },
        { type: "eq", text: "T_c = T_c1 (aporte) + T_c2 (canaleta)", num: "5" },
        paso(
          "6.1.1",
          "Tiempo de concentración en el aporte",
          inp.formulaTc === "faa"
            ? "T_c1 = 60 · 0.7035 · (1.1 − C) · L₁⁰·⁵ / S₁⁰·³³³"
            : "T_c1 = 0.0195 · L₁⁰·⁷⁷ · S₁⁻⁰·³⁸⁵",
          `L₁ = ${fmt(sel.L1, 2)} m    S₁ = ${fmt(sel.S1, 3)} m/m    C = ${fmt(sel.C, 2)}`,
          `T_c1 = ${fmt(it.Tc1, inp.formulaTc === "faa" ? 0 : 1)} min`,
          "Pendientes altas (techo) acortan T_c1. En patio o estacionamiento casi plano, T_c1 crece."
        ),
        paso(
          "6.1.2",
          "Tiempo en la canaleta y total",
          "T_c = T_c1 + T_c2",
          `L₂ = ${fmt(sel.L2, 2)} m    S₂ = ${fmt(sel.S2, 3)} m/m`,
          `T_c2 = ${fmt(it.Tc2, inp.formulaTc === "faa" ? 0 : 1)} min    →    T_c = ${fmt(it.TcMin, 1)} min = ${fmt(it.TcHr, 2)} h`,
          `Kirpich de control: T_c = ${fmt(it.TcKirpich, 1)} min. Si T_c > 3 h no aplicaría la IILA de t < 3 h.`
        ),
        {
          type: "check",
          ok: it.cumpleLongitud,
          text: it.cumpleLongitud
            ? `Longitud por salida L₂/n = ${fmt(sel.L2 / sel.nBajantes, 2)} m ≤ ${L_MAX_SALIDA} m. No se exige una bajante adicional por longitud.`
            : `El tramo L₂ = ${fmt(sel.L2, 2)} m supera ${L_MAX_SALIDA} m con ${sel.nBajantes} salida(s). Colocar dos bajantes (una en cada extremo) para bajar tirante y evitar rebose.`,
        },
        { type: "h3", text: "6.2 Caudal de diseño — método racional" },
        { type: "eq", text: "Q = 0.278 · C · I · A", num: "6" },
        {
          type: "p",
          text: "Q en m³/s, C adimensional, I en mm/h y A en km². El factor 0.278 convierte al Sistema Internacional.",
        },
        paso(
          "6.2",
          "Caudal por método racional",
          "Q = 0.278 · C · I · A    con A en km²",
          `A = (${fmt(sel.A1, 2)} + ${fmt(sel.A2, 2)}) / 10⁶ = ${it.Akm2.toExponential(4)} km²
Q = 0.278 × ${fmt(sel.C, 2)} × ${fmt(it.I, 2)} × ${it.Akm2.toExponential(4)}`,
          `Q = ${it.Qm3s.toExponential(4)} m³/s  =  ${fmt(it.Qlps, 3)} L/s`,
          `Con ${sel.nBajantes} bajante(s) el caudal por salida es ${fmt(it.QporBajante, 3)} L/s.`
        ),
        { type: "h3", text: "6.3 Verificación hidráulica — Manning" },
        {
          type: "p",
          text: "La canaleta trabaja a superficie libre, no a presión. Se calcula la capacidad con el tirante de trabajo y, no con la altura total H. Esa diferencia es la holgura.",
        },
        { type: "eq", text: "Q = (1/n) · A · R²⁄³ · S¹⁄²", num: "7" },
        { type: "eq", text: "A = b·y     ·     P = b + 2y     ·     R = A / P", num: "8" },
        paso(
          "6.3.1",
          "Geometría de la sección de cálculo",
          "A = b y    ·    P = b + 2y    ·    R = A/P",
          `b = ${fmt(sel.b, 1)} cm = ${fmt(sel.b / 100, 3)} m    y = ${fmt(sel.y, 1)} cm = ${fmt(sel.y / 100, 3)} m
A = ${fmt(sel.b / 100, 3)} × ${fmt(sel.y / 100, 3)}    P = ${fmt(sel.b / 100, 3)} + 2×${fmt(sel.y / 100, 3)}`,
          `A = ${fmt(it.Ahid, 5)} m²    P = ${fmt(it.P, 3)} m    R = ${fmt(it.R, 5)} m`,
          "La sección de cálculo es el tirante hidráulico de trabajo, no la sección comercial propuesta."
        ),
        paso(
          "6.3.2",
          "Capacidad por Manning",
          "Q = (1/n) · A · R²⁄³ · S¹⁄²",
          `n = ${fmt(sel.n, 3)} (${material})    S = ${fmt(sel.S, 4)} m/m = ${fmt(sel.S * 100, 2)} %
Q = (1/${fmt(sel.n, 3)}) × ${fmt(it.Ahid, 5)} × ${fmt(it.R, 5)}²⁄³ × ${fmt(sel.S, 4)}¹⁄²`,
          `Q_cap = ${it.Qcap.toExponential(4)} m³/s = ${fmt(it.Qcap * 1000, 3)} L/s    ·    V = ${fmt(it.V, 3)} m/s    ·    Q_cap/Q_d = ${fmt(it.FS, 2)}`,
          it.cumpleQ
            ? "La capacidad supera el caudal de diseño: la sección de cálculo es suficiente."
            : "Q_cap < Q_d: aumentar b, y o la pendiente, o reducir n (material más liso)."
        ),
        {
          type: "check",
          ok: it.cumpleQ,
          text: it.cumpleQ
            ? `La sección de cálculo evacua el caudal de diseño (Qcap = ${fmt(it.Qcap * 1000, 3)} L/s ≥ Qd = ${fmt(it.Qlps, 3)} L/s).`
            : `La sección de cálculo es insuficiente (Qcap = ${fmt(it.Qcap * 1000, 3)} L/s < Qd = ${fmt(it.Qlps, 3)} L/s).`,
        },
        {
          type: "check",
          ok: it.cumplePendiente,
          text: it.cumplePendiente
            ? `Pendiente S = ${fmt(sel.S * 100, 2)} % ≥ ${fmt(S_MIN_CANALETA * 100, 1)} % mínima.`
            : `Pendiente S = ${fmt(sel.S * 100, 2)} % menor que 0.5 %. Corregir montaje o aumentar sección.`,
        },
        {
          type: "check",
          ok: it.cumpleVel,
          text: it.cumpleVel
            ? `Velocidad V = ${fmt(it.V, 3)} m/s dentro de ${fmt(0.3, 1)}–${fmt(vMax, 1)} m/s para ${material}.`
            : `Velocidad V = ${fmt(it.V, 3)} m/s fuera del rango ${fmt(0.3, 1)}–${fmt(vMax, 1)} m/s. Ajustar pendiente o rugosidad.`,
        },
        { type: "h3", text: "6.4 Holgura y sección propuesta" },
        {
          type: "p",
          text: "La holgura (freeboard) es el espacio libre entre el nivel máximo del agua y el borde superior de la canaleta. No se diseña para que vaya llena: ese colchón cubre lluvias mayores al evento de diseño, hojas y polvo, oleaje por viento y errores de pendiente. Criterio de edificación: tirante máximo del 60 % de H (holgura del 40 %), nunca menor de 25 mm. En la hoja de origen se suman dos holguras de unos 5 cm (operación y ondas/obstrucción).",
        },
        { type: "eq", text: "h_mín = y + a + a₂     ·     y ≤ 0.60 H", num: "9" },
        paso(
          "6.4",
          "Altura mínima con holguras y sección propuesta",
          "h_mín = y + a + a₂",
          `h_mín = ${fmt(sel.y, 0)} + ${fmt(sel.holgura, 0)} + ${fmt(sel.holgura2, 0)} = ${fmt(it.hMin, 0)} cm
Propuesto: b = ${fmt(sel.bPropuesto, 0)} cm    H = ${fmt(sel.hPropuesto, 0)} cm
Llenado y/H = ${fmt(it.llenado * 100, 0)} %    holgura real = ${fmt(it.holguraReal, 1)} cm`,
          `Se adopta ${sel.tipo === "piso" ? "canal de concreto con rejilla" : "canaleta"} ${fmt(sel.bPropuesto, 0)} × ${fmt(sel.hPropuesto, 0)} cm.`,
          `Frase de plano: la canaleta conduce el caudal de proyecto con tirante máximo del ${fmt(Y_FRACCION * 100, 0)} % de su altura total, dejando holgura como margen de seguridad.`
        ),
        {
          type: "check",
          ok: it.cumpleProp,
          text: it.cumpleProp
            ? `La sección propuesta ${fmt(sel.bPropuesto, 0)} × ${fmt(sel.hPropuesto, 0)} cm cubre el mínimo ${fmt(sel.b, 0)} × ${fmt(it.hMin, 0)} cm.`
            : "La sección propuesta no cubre las dimensiones mínimas.",
        },
        { type: "h3", text: "6.5 Sección comercial a 60 % de llenado" },
        {
          type: "p",
          text: "Independientemente de la sección de cálculo, se busca la menor sección comercial que, trabajando a y = 0.60 H, evacúe Qd. Ese es el procedimiento de las guías de drenaje de edificación: se tantean anchos 100, 125, 150, 200 mm (o 15–30 cm en concreto) y se verifica Manning.",
        },
        {
          type: "kv",
          rows: [
            { k: "Sección comercial sugerida", v: it.comercial.label },
            { k: "Tirante de trabajo y = 0.60 H", v: fmt(it.yComercial, 1), u: "cm" },
            { k: "Qcap comercial", v: fmt(it.QcapComercial * 1000, 3), u: "L/s" },
            { k: "Velocidad comercial", v: fmt(it.Vcomercial, 3), u: "m/s" },
          ],
        },
        {
          type: "check",
          ok: it.cumpleComercial,
          text: it.cumpleComercial
            ? `La sección comercial ${it.comercial.label} evacúa Qd con holgura del ${fmt((1 - Y_FRACCION) * 100, 0)} %.`
            : "Ninguna sección del catálogo comercial alcanza Qd a 60 % de llenado. Subir pendiente o partir el área en dos sistemas.",
        },
        { type: "h3", text: "6.6 Salida y bajante" },
        {
          type: "p",
          text: "La boca de salida se modela como orificio circular bajo carga igual al tirante de la canaleta. El tubo vertical no va a sección llena (necesita núcleo de aire); el cuello de botella es la boca, no la fricción del tramo vertical. Se elige el menor PVC comercial cuyo Q de orificio sea ≥ caudal por bajante.",
        },
        { type: "eq", text: `Q = C_d · (π d² / 4) · √(2 g y)     C_d = ${CD_BAJANTE}`, num: "10" },
        paso(
          "6.6",
          "Diámetro de bajante",
          "Q = 0.62 · (π d² / 4) · √(2 g y)",
          `Q por bajante = ${fmt(it.QporBajante, 3)} L/s    y = ${fmt(sel.y, 1)} cm    ${sel.nBajantes} salida(s)
Ø adoptado ${it.bajante.nom} mm (diámetro interior de cálculo ${it.bajante.id} mm)`,
          `Q_orificio = ${fmt(it.Qorificio, 2)} L/s  ${it.cumpleBajante ? "≥" : "<"}  ${fmt(it.QporBajante, 3)} L/s`,
          "Colocar rejilla o coladera en la boca. Incluir rebose de alivio si hay cielorraso o riesgo de filtración."
        ),
        {
          type: "check",
          ok: it.cumpleBajante,
          text: it.cumpleBajante
            ? `Bajante PVC Ø ${it.bajante.nom} mm suficiente para ${fmt(it.QporBajante, 3)} L/s.`
            : `Ø ${it.bajante.nom} mm no alcanza. Aumentar diámetro o el número de bajantes.`,
        },
        paso(
          "6.6.1",
          "Desarrollo vertical de la bajante",
          "H_disp = z_cubierta − z_descarga     ·     Σh = f (L/D) V²/2g + n_codos K V²/2g",
          (() => {
            const d = it.bajante.id / 1000;
            const A = (Math.PI * d * d) / 4;
            const V = A > 0 ? it.QporBajante / 1000 / A : 0;
            const ht = (V * V) / (2 * 9.81);
            const Lb = inp.Lbajante ?? 0;
            const nC = inp.nCodosBajante ?? 0;
            const Kc = inp.KcodoBajante ?? 0.9;
            const z1 = inp.cotaCubierta ?? 0;
            const z2 = inp.cotaDescarga ?? 0;
            const hf = (0.025 * Lb / Math.max(d, 0.02)) * ht;
            const hk = nC * Kc * ht;
            const H = Math.max(z1 - z2, sel.y / 100);
            return `H_disp = ${fmt(z1, 2)} − ${fmt(z2, 2)} = ${fmt(H, 2)} m
V = ${fmt(V, 2)} m/s    h_t = ${fmt(ht, 3)} m    h_f = ${fmt(hf, 3)} m    h_codos = ${fmt(hk, 3)} m`;
          })(),
          (() => {
            const d = it.bajante.id / 1000;
            const A = (Math.PI * d * d) / 4;
            const V = A > 0 ? it.QporBajante / 1000 / A : 0;
            const ht = (V * V) / (2 * 9.81);
            const Lb = inp.Lbajante ?? 0;
            const nC = inp.nCodosBajante ?? 0;
            const Kc = inp.KcodoBajante ?? 0.9;
            const z1 = inp.cotaCubierta ?? 0;
            const z2 = inp.cotaDescarga ?? 0;
            const hf = (0.025 * Lb / Math.max(d, 0.02)) * ht;
            const hk = nC * Kc * ht;
            const H = Math.max(z1 - z2, sel.y / 100);
            return `Σh = ${fmt(hf + hk, 3)} m  ${hf + hk <= H ? "≤" : ">"}  H_disp = ${fmt(H, 2)} m`;
          })(),
          "La boca sigue gobernando el gasto. El tramo vertical se verifica para que la carga topográfica cubra fricción y codos. Si Σh > H_disp, subir Ø o acortar el desarrollo."
        ),
        { type: "h3", text: "6.7 Caso 1 (una bajante) frente a Caso 2 (dos bajantes)" },
        {
          type: "p",
          text: "En vivienda y en cubiertas largas conviene comparar un sistema que junta todo el caudal en una salida (Caso 1) con dos sistemas o dos extremos (Caso 2). El Caso 2 reduce atoros, reboses y tirante, y facilita el mantenimiento. El Caso 1 es válido si el tramo es corto y se usa Ø holgado.",
        },
        {
          type: "table",
          caption: `Tabla 4. Comparación de salidas para ${sel.codigo} (Qd = ${fmt(it.Qlps, 3)} L/s)`,
          headers: ["Caso", "Q por salida", "Ø mínimo", "L por salida", "Comentario"],
          rows: [
            [
              "1 — una bajante",
              `${fmt(it.Qlps, 3)} L/s`,
              baj1 ? `Ø ${baj1.tubo.nom} mm` : "—",
              `${fmt(sel.L2, 2)} m`,
              sel.L2 > L_MAX_SALIDA ? "Tramo largo: no recomendable" : "Válido si hay buena pendiente y rejilla",
            ],
            [
              "2 — dos bajantes",
              `${fmt(it.Qlps / 2, 3)} L/s`,
              baj2 ? `Ø ${baj2.tubo.nom} mm` : "—",
              `${fmt(sel.L2 / 2, 2)} m`,
              "Más robusto ante obstrucción. Recomendado si L > 10–12 m o hay hojas.",
            ],
          ],
        },
        {
          type: "note",
          text:
            sel.nBajantes === 2
              ? "En este elemento se adoptó el Caso 2 (dos bajantes). Si se busca uniformidad de obra, usar el mayor Ø de las dos columnas en todas las bajantes del edificio."
              : "En este elemento se adoptó el Caso 1. Si el tramo se alarga en obra o hay vegetación, pasar a dos salidas sin cambiar la canaleta.",
        },
        { type: "h2", text: "7. Verificaciones de conjunto" },
        {
          type: "check",
          ok: inp.distCimentacion >= DIST_CIMIENTOS_MIN,
          text:
            inp.distCimentacion >= DIST_CIMIENTOS_MIN
              ? `La descarga se aleja ${fmt(inp.distCimentacion, 2)} m de la cimentación (≥ ${DIST_CIMIENTOS_MIN} m).`
              : `La distancia a cimentación (${fmt(inp.distCimentacion, 2)} m) es menor de ${DIST_CIMIENTOS_MIN} m. Prolongar tubería enterrada o cambiar el punto de descarga.`,
        },
        {
          type: "table",
          caption: "Tabla 5. Chequeos por elemento",
          headers: ["Elem.", "Qcap≥Qd", "Sección", "Pendiente", "Velocidad", "Longitud", "Bajante"],
          rows: r.items.map((x) => [
            x.el.codigo,
            x.cumpleQ ? "Sí" : "No",
            x.cumpleProp ? "Sí" : "No",
            x.cumplePendiente ? "Sí" : "No",
            x.cumpleVel ? "Sí" : "No",
            x.cumpleLongitud ? "Sí" : "No",
            x.cumpleBajante ? `Ø ${x.bajante.nom}` : "No",
          ]),
        },
        { type: "h2", text: "8. Recomendaciones constructivas" },
        {
          type: "list",
          items: [
            "Pendiente de canaleta: 0.5 % mínimo (5 mm/m) a 1 % recomendado (10 mm/m), continua hacia la salida, sin puntos bajos.",
            "Soportes cada 0.60–0.80 m; más juntos en cubiertas grandes o zonas de viento.",
            "Juntas y uniones con sellador neutro o PU de exterior. Verificar caídas en obra con nivel.",
            "Rejilla o coladera en cada boca para hojas. Prever registro de limpieza.",
            "Rebose controlado (boca de alivio) cuando hay cielorraso o riesgo de filtración al muro.",
            `No descargar junto a la zapata: mínimo ${DIST_CIMIENTOS_MIN}–2.0 m, o tubería enterrada hasta ${DESTINO_TXT[inp.destino]}.`,
            "Si se entrega a la red pública, coordinar cota, caudal y periodo de retorno con OS.060 y la EPS o municipalidad.",
            "En estacionamiento, la canaleta de concreto con rejilla debe quedar al ras del pavimento, con pendiente del piso hacia la rejilla y sin contrapestes que encharquen.",
            "Uniformar diámetros de bajante en el edificio (el mayor de los calculados) para simplificar mantenimiento y reposición.",
          ],
        },
        { type: "h2", text: "9. Conclusión" },
        {
          type: "p",
          text: `Para T = ${inp.Tret} años y t = ${r.hidro.tMin} min, la intensidad de diseño es ${fmt(r.hidro.I, 2)} mm/h (${inp.ubicacion}). El sistema evacua ${fmt(r.Qtotal, 3)} L/s desde ${fmt(r.ATotal, 1)} m². El elemento desarrollado (${sel.codigo}) tiene Qd = ${fmt(it.Qlps, 3)} L/s, sección propuesta ${fmt(sel.bPropuesto, 0)} × ${fmt(sel.hPropuesto, 0)} cm en ${material} (n = ${fmt(sel.n, 3)}, S = ${fmt(sel.S, 3)}) y bajante PVC Ø ${it.bajante.nom} mm (${sel.nBajantes} salida${sel.nBajantes > 1 ? "s" : ""}). El conjunto resulta ${todosOk ? "hidráulicamente suficiente según CE.040, Manning y los criterios de holgura" : "con observaciones: redimensionar los elementos marcados REVISAR antes de plano de obra"}.`,
        },
      ],
    };
  }, [inp, r, sel, it, zonaActiva, baj1, baj2]);
  const livePack = useMemo(() => ({ doc, inp, r }), [doc, inp, r]);
  const { doc: pack, dirty, calcular } = useMemoriaOnCalcular(livePack);
  const memoria = pack.doc;
  const pubSel = pack.inp.elementos.find((e) => e.id === selId) ?? pack.inp.elementos[0];
  const pubIt = pack.r.items.find((x) => x.el.id === pubSel?.id) ?? pack.r.items[0];

  const setHidro = <K extends keyof DrenajeInput>(k: K, v: DrenajeInput[K]) =>
    setInp((s) => ({ ...s, [k]: v }));

  const setEl = <K extends keyof ElementoPluvial>(k: K, v: ElementoPluvial[K]) => {
    if (!sel) return;
    setInp((s) => ({
      ...s,
      elementos: s.elementos.map((e) => {
        if (e.id !== sel.id) return e;
        const next = { ...e, [k]: v };
        if (k === "x0" || k === "y0" || k === "w" || k === "d") delete next.poly;
        return next;
      }),
    }));
  };

  const addEl = () => {
    const n = inp.elementos.length + 1;
    const e = colocarNuevoElemento(nuevoElemento(n), inp.elementos);
    setInp((s) => ({ ...s, elementos: [...s.elementos, e] }));
    setSelId(e.id);
  };

  const delEl = () => {
    if (inp.elementos.length <= 1 || !sel) return;
    const next = inp.elementos.filter((e) => e.id !== sel.id);
    setInp((s) => ({ ...s, elementos: next }));
    setSelId(next[0].id);
  };

  const figurasMemoria =
    pubSel && pubIt ? (
      <>
        <EmplazamientoPluvialSvg
          elementos={pack.inp.elementos}
          selId={pubSel.id}
          destino={pack.inp.destino}
          distCimentacion={pack.inp.distCimentacion}
        />
        <CanaletaSvg b={pubSel.bPropuesto} h={pubSel.hPropuesto} y={pubSel.y} />
        <BajanteSvg dNom={pubIt.bajante.nom} nBajantes={pubSel.nBajantes} />
        <TrazadoPluvialSvg caso={pubSel.nBajantes === 2 ? 2 : 1} />
      </>
    ) : null;

  const loadEjemplo = () => {
    const els = EJEMPLO_CHICLAYO.map((e) => ({ ...e }));
    setInp((s) => ({
      ...s,
      proyecto: "Drenaje pluvial de cubiertas y estacionamiento",
      ubicacion: "Chiclayo, Lambayeque",
      nIila: 0.432,
      tg: 12.85,
      eg: 61.5,
      bParam: 0.2,
      Tret: 10,
      elementos: els,
    }));
    setSelId(els[0].id);
  };

  return (
    <>
      <aside id="app-panel" className="panel panel-canaleta">
        <h2>Drenaje pluvial</h2>
        <p className="lead">Ejemplo Chiclayo desarrollado. Edite los datos y pulse Calcular para actualizar el informe (CE.040 · IDF IILA · Manning).</p>
        <CalcDirtyNote dirty={dirty} />

        <fieldset className="fieldset">
          <legend>Identificación</legend>
          <Field label="Proyecto"><Text value={inp.proyecto} onChange={(v) => setHidro("proyecto", v)} /></Field>
          <Field label="Ubicación"><Text value={inp.ubicacion} onChange={(v) => setHidro("ubicacion", v)} /></Field>
          <Field label="Profesional"><Text value={inp.profesional} onChange={(v) => setHidro("profesional", v)} /></Field>
          <Field label="CIP"><Text value={inp.cip ?? ""} onChange={(v) => setHidro("cip", v)} /></Field>
          <Field label="Estación SENAMHI"><Text value={inp.estacionSenamhi ?? ""} onChange={(v) => setHidro("estacionSenamhi", v)} /></Field>
          <div className="grid-2">
            <Field label="Código estación"><Text value={inp.codigoEstacion ?? ""} onChange={(v) => setHidro("codigoEstacion", v)} /></Field>
            <Field label="Periodo registro"><Text value={inp.periodoRegistro ?? ""} onChange={(v) => setHidro("periodoRegistro", v)} /></Field>
            <Field label="Cota cubierta" unit="msnm"><Num value={inp.cotaCubierta ?? 0} onChange={(v) => setHidro("cotaCubierta", v)} /></Field>
            <Field label="Cota descarga" unit="msnm"><Num value={inp.cotaDescarga ?? 0} onChange={(v) => setHidro("cotaDescarga", v)} /></Field>
            <Field label="UTM Este" unit="m"><Num value={inp.utmEste ?? 0} onChange={(v) => setHidro("utmEste", v)} /></Field>
            <Field label="UTM Norte" unit="m"><Num value={inp.utmNorte ?? 0} onChange={(v) => setHidro("utmNorte", v)} /></Field>
            <Field label="L bajante" unit="m"><Num value={inp.Lbajante ?? 0} onChange={(v) => setHidro("Lbajante", v)} /></Field>
            <Field label="Codos bajante"><Num value={inp.nCodosBajante ?? 0} onChange={(v) => setHidro("nCodosBajante", v)} step="1" /></Field>
          </div>
          <Field label="Material canaleta"><Text value={inp.materialCanaleta ?? ""} onChange={(v) => setHidro("materialCanaleta", v)} /></Field>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Hidrología · CE.040</legend>
          <Field label="Zona IILA">
            <select
              value={zonaActiva?.id ?? ""}
              onChange={(e) => {
                const z = ZONAS_IILA.find((x) => x.id === e.target.value);
                if (!z) return;
                setInp((s) => ({ ...s, nIila: z.n, bParam: z.b, tg: z.tg, eg: z.eg }));
              }}
            >
              <option value="">Personalizado</option>
              {ZONAS_IILA.map((z) => (
                <option key={z.id} value={z.id}>{z.label}</option>
              ))}
            </select>
          </Field>
          <div className="grid-2">
            <Field label="n IILA" unit="—"><Num value={inp.nIila} onChange={(v) => setHidro("nIila", v)} /></Field>
            <Field label="b" unit="h"><Num value={inp.bParam} onChange={(v) => setHidro("bParam", v)} /></Field>
            <Field label="t_g"><Num value={inp.tg} onChange={(v) => setHidro("tg", v)} /></Field>
            <Field label="e_g" unit="mm"><Num value={inp.eg} onChange={(v) => setHidro("eg", v)} /></Field>
            <Field label="T retorno" unit="años"><Num value={inp.Tret} onChange={(v) => setHidro("Tret", v)} step="1" /></Field>
            <Field label="t diseño" unit="min"><Num value={inp.tDisenoMin} onChange={(v) => setHidro("tDisenoMin", v)} step="1" /></Field>
          </div>
          <Field label="Fórmula de Tc">
            <select value={inp.formulaTc} onChange={(e) => setHidro("formulaTc", e.target.value as FormulaTc)}>
              <option value="faa">FAA · Tabla 2 CE.040</option>
              <option value="kirpich">Kirpich · Tabla 2 CE.040</option>
            </select>
          </Field>
          <label className="field" style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={inp.usarTcComoDuracion}
              onChange={(e) => setHidro("usarTcComoDuracion", e.target.checked)}
            />
            <span>Usar T<sub>c</sub> como duración (en vez de t mínimo)</span>
          </label>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Descarga</legend>
          <Field label="Destino">
            <select value={inp.destino} onChange={(e) => setHidro("destino", e.target.value as DestinoDescarga)}>
              {DESTINOS.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Distancia a cimentación" unit="m">
            <Num value={inp.distCimentacion} onChange={(v) => setHidro("distCimentacion", v)} />
          </Field>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Elementos del sistema</legend>
          <div className="chips">
            {inp.elementos.map((e) => {
              const item = r.items.find((x) => x.el.id === e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  className={`chip${e.id === sel?.id ? " on" : ""}`}
                  onClick={() => setSelId(e.id)}
                >
                  {e.codigo}{item && !item.ok ? " !" : ""}
                </button>
              );
            })}
          </div>
          <EmplazamientoPluvialSvg
            elementos={inp.elementos}
            selId={sel?.id}
            destino={inp.destino}
            distCimentacion={inp.distCimentacion}
            onSelect={setSelId}
            compact={true}
          />
          <p className="pluvial-plan-caption">
            Planta de emplazamiento. Clic en una cuenca para seleccionarla. Elija el esquema de techo y la distribución de canaletas del elemento.
          </p>
          <div className="actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn secondary" onClick={addEl}>Añadir canaleta</button>
            <button type="button" className="btn secondary" onClick={delEl} disabled={inp.elementos.length <= 1}>Quitar</button>
            <button type="button" className="btn secondary" onClick={loadEjemplo}>Ejemplo Chiclayo (6)</button>
          </div>
        </fieldset>

        {sel ? (
          <fieldset className="fieldset">
            <legend>{sel.codigo}</legend>
            <Field label="Código"><Text value={sel.codigo} onChange={(v) => setEl("codigo", v)} /></Field>
            <Field label="Descripción"><Text value={sel.descripcion} onChange={(v) => setEl("descripcion", v)} /></Field>
            <Field label="Ejes"><Text value={sel.ejes ?? ""} onChange={(v) => setEl("ejes", v)} /></Field>
            <div className="grid-2">
              <Field label="Nivel">
                <Num value={sel.nivel ?? 1} onChange={(v) => setEl("nivel", Math.max(1, Math.round(v)))} />
              </Field>
              <Field label="Lado canaleta">
                <select
                  value={sel.lado ?? "S"}
                  onChange={(e) => setEl("lado", e.target.value as LadoPluvial)}
                >
                  <option value="N">Norte (eje menor)</option>
                  <option value="S">Sur</option>
                  <option value="E">Este</option>
                  <option value="O">Oeste</option>
                </select>
              </Field>
              <Field label="Esquema de techo">
                <select
                  value={sel.esquemaTecho ?? (sel.tipo === "piso" ? "azotea" : "una-agua")}
                  onChange={(e) => {
                    const esquemaTecho = e.target.value as EsquemaTecho;
                    const distrib: DistribCanaleta =
                      esquemaTecho === "dos-aguas"
                        ? "dos-bordes"
                        : esquemaTecho === "cuatro-aguas"
                          ? "perimetral"
                          : sel.distrib ?? "un-borde";
                    setInp((s) => ({
                      ...s,
                      elementos: s.elementos.map((el) => (el.id === sel.id ? { ...el, esquemaTecho, distrib } : el)),
                    }));
                  }}
                >
                  {ESQUEMAS_TECHO.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Distribución de canaletas">
                <select
                  value={sel.distrib ?? "un-borde"}
                  onChange={(e) => setEl("distrib", e.target.value as DistribCanaleta)}
                >
                  {DISTRIBs_CANALETA.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="X esquina" unit="m"><Num value={sel.x0 ?? 0} onChange={(v) => setEl("x0", v)} /></Field>
              <Field label="Y esquina" unit="m"><Num value={sel.y0 ?? 0} onChange={(v) => setEl("y0", v)} /></Field>
              <Field label="Ancho cuenca" unit="m"><Num value={sel.w ?? sel.L2} onChange={(v) => setEl("w", v)} /></Field>
              <Field label="Fondo cuenca" unit="m"><Num value={sel.d ?? sel.L1} onChange={(v) => setEl("d", v)} /></Field>
            </div>
            <Field label="Tipo">
              <select
                value={sel.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as TipoElemento;
                  setInp((s) => ({
                    ...s,
                    elementos: s.elementos.map((el) =>
                      el.id === sel.id
                        ? { ...el, tipo, n: tipo === "piso" ? 0.017 : 0.012, C: tipo === "piso" ? 0.9 : 0.95 }
                        : el
                    ),
                  }));
                }}
              >
                <option value="cubierta">Canaleta de cubierta</option>
                <option value="piso">Canal de piso (concreto + rejilla)</option>
              </select>
            </Field>
            <Field label="Superficie C">
              <select value={String(sel.C)} onChange={(e) => setEl("C", parseFloat(e.target.value))}>
                {C_TABLA.map((c) => (
                  <option key={c.id} value={c.C}>{c.label} ({c.C})</option>
                ))}
              </select>
            </Field>
            <div className="grid-2">
              <Field label="L₁ aporte" unit="m"><Num value={sel.L1} onChange={(v) => setEl("L1", v)} /></Field>
              <Field label="S₁" unit="m/m"><Num value={sel.S1} onChange={(v) => setEl("S1", v)} /></Field>
              <Field label="L₂ canaleta" unit="m"><Num value={sel.L2} onChange={(v) => setEl("L2", v)} /></Field>
              <Field label="S₂" unit="m/m"><Num value={sel.S2} onChange={(v) => setEl("S2", v)} /></Field>
              <Field label="A₁ cuenca" unit="m²"><Num value={sel.A1} onChange={(v) => setEl("A1", v)} /></Field>
              <Field label="A₂ canaleta" unit="m²"><Num value={sel.A2} onChange={(v) => setEl("A2", v)} /></Field>
            </div>
            <div className="grid-2">
              <Field label="b cálculo" unit="cm"><Num value={sel.b} onChange={(v) => setEl("b", v)} /></Field>
              <Field label="y cálculo" unit="cm"><Num value={sel.y} onChange={(v) => setEl("y", v)} /></Field>
              <Field label="S canal" unit="m/m"><Num value={sel.S} onChange={(v) => setEl("S", v)} /></Field>
              <Field label="n Manning"><Num value={sel.n} onChange={(v) => setEl("n", v)} /></Field>
              <Field label="Holgura a" unit="cm"><Num value={sel.holgura} onChange={(v) => setEl("holgura", v)} /></Field>
              <Field label="Holgura a₂" unit="cm"><Num value={sel.holgura2} onChange={(v) => setEl("holgura2", v)} /></Field>
              <Field label="b propuesto" unit="cm"><Num value={sel.bPropuesto} onChange={(v) => setEl("bPropuesto", v)} /></Field>
              <Field label="H propuesto" unit="cm"><Num value={sel.hPropuesto} onChange={(v) => setEl("hPropuesto", v)} /></Field>
            </div>
            <Field label="Bajantes">
              <select
                value={sel.nBajantes}
                onChange={(e) => setEl("nBajantes", Number(e.target.value) === 2 ? 2 : 1)}
              >
                <option value={1}>Caso 1 · una bajante</option>
                <option value={2}>Caso 2 · dos bajantes</option>
              </select>
            </Field>
            {it ? (
              <p className="lead" style={{ marginTop: 8 }}>
                Qd = {fmt(it.Qlps, 3)} L/s · Qcap = {fmt(it.Qcap * 1000, 3)} L/s · Ø {it.bajante.nom} mm · {it.ok ? "CUMPLE" : "REVISAR"}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        <div className="actions">
          <CalcularButton onClick={calcular} dirty={dirty} />
          <button className="btn" disabled={!memoria} onClick={() => memoria && exportarWord(memoria)}>Exportar Word</button>
          <button className="btn secondary" disabled={!memoria} onClick={() => memoria && printMemoria(memoria.titulo)}>Imprimir / PDF</button>
        </div>
      </aside>
      {memoria ? (
        <Paper doc={memoria} extra={figurasMemoria} />
      ) : (
        <MemoriaPendiente />
      )}
    </>
  );
}
