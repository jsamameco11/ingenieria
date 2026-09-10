import { useMemo, useState } from "react";
import {
  BOCA_ALC,
  C_CUENCA_VIA,
  N_MANNING_ALC,
  T_RETORNO_VIA,
  calcularAlcantarilla,
  type AlcantarillaInput,
  type TipoBoca,
} from "../lib/hidro/alcantarilla";
import { ZONAS_IILA } from "../lib/hidro/canaleta";
import { fmt, fmtFixed } from "../lib/num";
import { paso, type MemoriaDoc } from "../lib/memoria";
import { Field, Num, Text } from "../ui/Field";
import { CalcDirtyNote, CalcularButton, MemoriaPendiente, useMemoriaOnCalcular } from "../ui/calcular";
import { Paper } from "../ui/Paper";
import { CajaSvg } from "../ui/diagrams";
import { exportarWord } from "../lib/exportWord";
import { printMemoria } from "../lib/printDoc";

const hoy = new Date().toLocaleDateString("es-PE");

const INP0: AlcantarillaInput = {
  Qforzado: 0,
  n: 0.013,
  S: 0.01,
  tipo: "caja",
  B: 1.2,
  H: 1.0,
  D: 1.0,
  L: 12,
  nBarriles: 1,
  TW: 0.4,
  tipoBoca: "escuadra",
  HW_D_max: 1.5,
  zonaId: "centro",
  nIila: 0.5,
  tg: 10,
  eg: 40,
  bParam: 0.2,
  Tret: 25,
  Aha: 18,
  C: 0.5,
  Lcuenca: 650,
  Scuenca: 0.03,
  usarTc: true,
  tMin: 10,
  estacionSenamhi: "Lima",
  codigoEstacion: "000474",
  periodoRegistro: "1991–2020",
  cotaRasante: 112.40,
  cotaFondo: 110.85,
  sesgoDeg: 0,
  origenQ: "racional",
  justificacionQ: "Cuenca afluente menor de 5 km²; se aplica el método racional CE.040.",
};

export function AlcantarillaModule() {
  const [meta, setMeta] = useState({
    proyecto: "Alcantarilla tipo cajón — cruce de vía",
    ubicacion: "Costa centro, Perú",
    profesional: "Ingeniero civil",
    cip: "",
  });
  const [inp, setInp] = useState<AlcantarillaInput>(INP0);
  const r = useMemo(() => calcularAlcantarilla(inp), [inp]);
  const zonaActiva = ZONAS_IILA.find((z) => z.id === inp.zonaId);
  const Tuso = T_RETORNO_VIA.find((t) => t.T === inp.Tret)?.uso ?? "Periodo de retorno de proyecto";
  const Cuso = C_CUENCA_VIA.find((c) => Math.abs(c.C - inp.C) < 1e-6)?.label ?? "C adoptado por el proyectista";
  const seccionTxt =
    inp.tipo === "caja"
      ? `cajón ${fmt(inp.B, 2)} × ${fmt(inp.H, 2)} m`
      : `circular Ø ${fmt(inp.D, 2)} m`;
  const nBtxt = inp.nBarriles > 1 ? `, ${inp.nBarriles} caños` : "";

  const doc: MemoriaDoc = useMemo(
    () => ({
      codigo: "HID-04",
      titulo: "Diseño hidráulico de alcantarilla tipo cajón",
      norma: "MTC DG-2018 · FHWA HDS-5 · CE.040 · IILA–SENAMHI–UNI",
      blocks: [
        {
          type: "cover",
          kicker: "HID-04 · Drenaje de vías · Memoria de cálculo",
          titulo: "Diseño hidráulico de alcantarilla tipo cajón",
          subtitulo:
            "Hidrología racional con IDF IILA–SENAMHI–UNI y verificación hidráulica por Manning y control de entrada/salida FHWA HDS-5",
          meta: [
            { k: "Proyecto", v: meta.proyecto },
            { k: "Ubicación", v: meta.ubicacion },
            { k: "Profesional responsable", v: meta.cip ? `${meta.profesional} · CIP ${meta.cip}` : meta.profesional },
            { k: "Estación SENAMHI", v: inp.codigoEstacion ? `${inp.estacionSenamhi} (${inp.codigoEstacion})` : inp.estacionSenamhi || zonaActiva?.label || "—" },
            { k: "Periodo de registro", v: inp.periodoRegistro || "—" },
            { k: "Cota rasante / fondo", v: `${fmt(inp.cotaRasante, 2)} / ${fmt(inp.cotaFondo, 2)} msnm` },
            { k: "Origen del caudal", v: inp.origenQ === "racional" ? "Método racional (esta hoja)" : inp.justificacionQ || inp.origenQ },
            { k: "Fecha", v: hoy },
            { k: "Normas de referencia", v: "MTC DG-2018 · FHWA HDS-5 · RNE CE.040 · Estudio Hidrológico del Perú (IILA–SENAMHI–UNI)" },
            { k: "Periodo de retorno T", v: `${inp.Tret} años — ${Tuso}` },
            { k: "Sección propuesta", v: `${seccionTxt}${nBtxt}, L = ${fmt(inp.L, 1)} m` },
            { k: "Caudal de diseño Qd", v: `${fmt(r.Qd, 3)} m³/s` },
          ],
        },
        { type: "h2", text: "1. Objeto y alcance" },
        {
          type: "p",
          text: "La presente memoria dimensiona una alcantarilla de cruce bajo la vía para evacuar el caudal de diseño de la cuenca afluente sin que la carga en la boca (HW) rebase el criterio de servicio de la rasante. El caudal se obtiene con el método racional, aplicable a cuencas menores de 5 km² (CE.040). La intensidad proviene de la fórmula IILA–SENAMHI–UNI modificada, con parámetros de zona climática calibrables a la estación SENAMHI del emplazamiento. La sección se verifica a superficie libre por Manning y a carga por control de entrada (cartas FHWA HDS-5) y control de salida (pérdidas de entrada más fricción).",
        },
        {
          type: "list",
          items: [
            "Hidrología: Qd = C · I · A / 360, con A en hectáreas, I en mm/h y C de la cobertura de la cuenca.",
            "Intensidad I(t,T) con IILA–SENAMHI–UNI (t < 3 h) y curvas IDF del emplazamiento.",
            "Tiempo de concentración por Kirpich (CE.040 Tabla 2); duración de diseño t = máx(10 min, Tc).",
            "Hidráulica: capacidad a sección llena (Manning), tirante normal y crítico, HW por control de entrada y de salida.",
            "Criterio de servicio: HW/D (o HW/H) ≤ valor máximo del proyectista, habitualmente 1.2 a 1.5 para no afectar la rasante (MTC / FHWA).",
          ],
        },
        { type: "h2", text: "2. Marco normativo" },
        {
          type: "kv",
          rows: [
            { k: "MTC — Manual de Diseño Geométrico de Carreteras", v: "Criterios de drenaje transversal, periodo de retorno según categoría de vía y gabarit de la rasante." },
            { k: "FHWA HDS-5 Hydraulic Design of Highway Culverts", v: "Control de entrada (cartas) y control de salida (energía: Ke, fricción Manning, tirante de salida)." },
            { k: "RNE CE.040 Drenaje Pluvial", v: "Método racional, C, Tc y fórmula IILA para cuencas pequeñas." },
            { k: "Estudio de la Hidrología del Perú, Tomo III", v: "Parámetros t_g y e_g de estaciones pluviométricas SENAMHI / IILA–UNI." },
            { k: "Manning (SI)", v: "Capacidad a superficie libre y pérdida de fricción en el caño." },
          ],
        },
        {
          type: "note",
          text: "Los parámetros n, b, t_g y e_g de la zona IILA son de partida. En expediente definitivo se calibran con la estación SENAMHI más cercana (isoyetas, subzona CE.040 Tabla 3) y, si existe, con el estudio hidrológico del tramo.",
        },
        { type: "h2", text: "3. Criterios de diseño adoptados" },
        {
          type: "table",
          caption: "Tabla 1. Criterios de proyecto",
          headers: ["Parámetro", "Valor adoptado", "Fundamento"],
          rows: [
            ["Periodo de retorno T", `${inp.Tret} años`, Tuso],
            ["Duración de lluvia t", `${fmt(r.tMin, 0)} min`, inp.usarTc ? "t = máx(10 min, Tc Kirpich)" : `t de diseño fijado: ${fmt(inp.tMin, 0)} min (mínimo 10 min)`],
            ["Coeficiente C", fmt(inp.C, 2), Cuso],
            ["Área de cuenca A", `${fmt(inp.Aha, 2)} ha`, "Cuenca afluente al cruce (planta)"],
            ["n Manning del caño", fmt(inp.n, 3), N_MANNING_ALC.find((x) => Math.abs(x.n - inp.n) < 1e-6)?.label ?? "Adoptado por el proyectista"],
            ["Tipo de boca", r.boca.label, `Ke = ${fmt(r.Ke, 2)} (HDS-5)`],
            ["(HW/D)máx", fmt(inp.HW_D_max, 2), "Límite de remanso respecto de la rasante; 1.5 es habitual en vías vecinales"],
            ["Tirante de salida TW", `${fmt(inp.TW, 2)} m`, "Tirante en el cauce aguas abajo (o (yc+D)/2 si es mayor)"],
            ["Número de caños", String(r.nB), r.nB > 1 ? "Caudal repartido en partes iguales" : "Un solo caño"],
          ],
        },
        { type: "h2", text: "4. Hidrología — método racional e IDF SENAMHI" },
        { type: "h3", text: "4.1 Caudal de diseño" },
        { type: "eq", text: "Qd = C · I · A / 360     (A en ha, I en mm/h, Qd en m³/s)", num: "1" },
        {
          type: "p",
          text: "El método racional supone lluvia uniforme sobre la cuenca y duración igual al tiempo de concentración. Es el procedimiento habitual para alcantarillas de vías con A < 5 km². Si el proyectista dispone de un caudal de aforo o de un estudio hidrológico propio, puede forzar Qd; en caso contrario gobierna el racional.",
        },
        { type: "h3", text: "4.2 Intensidad — fórmula IILA–SENAMHI–UNI modificada" },
        { type: "eq", text: "I(t, T) = a · (1 + K · log₁₀ T) · (t + b)ⁿ⁻¹     (t < 3 h)", num: "2" },
        { type: "eq", text: "a = (1 / t_g)ⁿ · e_g     ·     K′_g = 22.5 · e_g⁻⁰·⁸⁵", num: "3" },
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
          "K crece cuando e_g es menor (climas más secos): una misma T produce intensidades más contrastadas."
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
            "Calibrar n, b, t_g y e_g con la Tabla 3 de CE.040 y la estación SENAMHI más cercana. No copiar parámetros de otra región.",
        },
        { type: "h3", text: "4.3 Curvas intensidad–duración–frecuencia" },
        {
          type: "table",
          caption: `Tabla 2. Intensidades I(t,T) en mm/h — a = ${fmt(r.a, 3)} mm, K = ${fmt(r.Kfreq, 3)}`,
          headers: ["t (min)", ...r.periodos.map((T) => `${T} años`)],
          rows: r.idf.map((row) => [String(row.tMin), ...r.periodos.map((T) => fmtFixed(row.intensidades[T], 2))]),
        },
        paso(
          "4.3",
          "Tiempo de concentración e intensidad de diseño",
          "Tc = 0.0195 · L⁰·⁷⁷ · S⁻⁰·³⁸⁵     (Kirpich, L en m, S en m/m, Tc en min)",
          `L = ${fmt(inp.Lcuenca, 0)} m    S = ${fmt(inp.Scuenca, 4)} m/m    Tc = ${fmt(r.Tc, 1)} min    t = máx(10, Tc) = ${fmt(r.tMin, 0)} min`,
          `I = ${fmt(r.I, 2)} mm/h   para T = ${fmt(inp.Tret, 0)} años y t = ${fmt(r.tMin, 0)} min`,
          "Kirpich representa el viaje por cauce natural o quebrada. El piso de 10 min evita intensidades irreales en cuencas muy cortas."
        ),
        paso(
          "4.4",
          "Caudal racional de la cuenca",
          "Q = C · I · A / 360",
          `Q = ${fmt(inp.C, 2)} × ${fmt(r.I, 2)} × ${fmt(inp.Aha, 2)} / 360`,
          `Q_racional = ${fmt(r.Qrac, 3)} m³/s`,
          inp.Qforzado > 0
            ? `Se adopta caudal forzado Qd = ${fmt(r.Qd, 3)} m³/s (aforo o estudio hidrológico). El racional queda como control.`
            : "No hay caudal forzado: Qd es el racional. Verificar C y A con la cobertura y la cartografía del tramo."
        ),
        {
          type: "table",
          caption: "Tabla 3. Resumen hidrológico",
          headers: ["Magnitud", "Símbolo", "Valor", "Unidad"],
          rows: [
            ["Área de cuenca", "A", fmt(inp.Aha, 2), "ha"],
            ["Coeficiente de escorrentía", "C", fmt(inp.C, 2), "—"],
            ["Longitud del cauce", "L", fmt(inp.Lcuenca, 0), "m"],
            ["Pendiente media de cuenca", "S", fmt(inp.Scuenca, 4), "m/m"],
            ["Tiempo de concentración", "Tc", fmt(r.Tc, 1), "min"],
            ["Duración de diseño", "t", fmt(r.tMin, 0), "min"],
            ["Intensidad", "I", fmt(r.I, 2), "mm/h"],
            ["Caudal racional", "Q", fmt(r.Qrac, 3), "m³/s"],
            ["Caudal de diseño", "Qd", fmt(r.Qd, 3), "m³/s"],
          ],
        },
        { type: "h2", text: "5. Geometría de la alcantarilla" },
        {
          type: "p",
          text: `Se propone una alcantarilla ${seccionTxt}${nBtxt}, longitud ${fmt(inp.L, 1)} m (ancho de plataforma más taludes) y pendiente ${fmt(inp.S, 4)} m/m, alineada con el cauce. La boca es ${r.boca.label.toLowerCase()}. El caudal por caño es Qb = Qd / n = ${fmt(r.Qb, 3)} m³/s.`,
        },
        {
          type: "table",
          caption: "Tabla 4. Datos geométricos e hidráulicos de la sección",
          headers: ["Parámetro", "Valor", "Unidad"],
          rows: [
            ["Tipo", inp.tipo === "caja" ? "Cajón rectangular de concreto" : "Circular", "—"],
            ...(inp.tipo === "caja"
              ? [
                  ["Ancho interior B", fmt(inp.B, 2), "m"],
                  ["Alto interior H", fmt(inp.H, 2), "m"],
                ]
              : [["Diámetro interior D", fmt(inp.D, 2), "m"]]),
            ["Número de caños", String(r.nB), "—"],
            ["Longitud L", fmt(inp.L, 2), "m"],
            ["Pendiente S", fmt(inp.S, 4), "m/m"],
            ["Área a sección llena (1 caño)", fmt(r.At1, 3), "m²"],
            ["Radio hidráulico lleno R", fmt(r.gLleno.R, 3), "m"],
            ["n Manning", fmt(inp.n, 3), "—"],
            ["Ke de la boca", fmt(r.Ke, 2), "—"],
          ],
        },
        { type: "h2", text: "6. Desarrollo del cálculo hidráulico" },
        paso(
          "6.1",
          "Capacidad a sección llena (Manning)",
          "Q = (1/n) · A · R²⁄³ · S¹⁄²",
          inp.tipo === "caja"
            ? `A = B × H = ${fmt(inp.B, 2)} × ${fmt(inp.H, 2)} = ${fmt(r.At1, 3)} m²    R = A/P = ${fmt(r.gLleno.R, 3)} m`
            : `A = π D²/4 = ${fmt(r.At1, 3)} m²    R = ${fmt(r.gLleno.R, 3)} m`,
          `Q_lleno (1 caño) = ${fmt(r.Qlleno1, 3)} m³/s    ·    Q_lleno total = ${fmt(r.Qlleno, 3)} m³/s    comparado con Qd = ${fmt(r.Qd, 3)} m³/s`,
          r.cumpleCapacidad
            ? "La sección llena evacua el caudal de diseño. Queda margen para holgura y para el control de carga en la boca."
            : "Capacidad insuficiente: ampliar B y H, agregar un caño o aumentar la pendiente."
        ),
        paso(
          "6.2",
          "Tirante normal, crítico y régimen",
          "yₙ de Manning    ·    y_c de Q²/g = A³/T    ·    Fr = V / √(g D)",
          `Qb = ${fmt(r.Qb, 3)} m³/s    n = ${fmt(inp.n, 3)}    S = ${fmt(inp.S, 4)}`,
          `yₙ = ${fmt(r.yn, 3)} m    y_c = ${fmt(r.yc, 3)} m    Vₙ = ${fmt(r.Vn, 3)} m/s    Fr = ${fmt(r.Fr, 3)}`,
          `Régimen aguas abajo: ${r.controlYn}. Si yₙ < y_c el flujo es supercrítico y suele gobernar la boca (entrada). Si yₙ > y_c gobierna la fricción / salida.`
        ),
        {
          type: "p",
          text: "FHWA HDS-5 exige calcular la carga en la entrada por dos mecanismos independientes y adoptar el mayor HW: (a) control de entrada, función solo de la geometría de la boca y de Q/(A√D); (b) control de salida, suma de la carga de velocidad, la pérdida de entrada Ke y la fricción a lo largo de L, más el tirante de salida.",
        },
        paso(
          "6.3",
          "Control de entrada — cartas FHWA HDS-5",
          "No sumergida: HW/D = K [Q/(A √D)]ᴹ     ·     Sumergida: HW/D = c [Q/(A √D)]² + Y",
          `Q/(A√D) = ${fmt(r.qAd, 3)} (unidades inglesas de carta)    K = ${fmt(r.boca.K, 3)}    M = ${fmt(r.boca.M, 3)}    c = ${fmt(r.boca.c, 4)}    Y = ${fmt(r.boca.Y, 2)}`,
          `HW_entrada = ${fmt(r.HWentrada, 3)} m    ·    HW/D = ${fmt(r.HWentrada / (inp.tipo === "caja" ? inp.H : inp.D), 2)}`,
          "Los coeficientes K, M, c, Y corresponden a la forma de boca (escuadra, alerones o abocinada). La carta se evalúa en unidades inglesas y el HW se devuelve en metros."
        ),
        paso(
          "6.4",
          "Control de salida — energía (Manning + Ke)",
          "H = [1 + Ke + 2g n² L / R⁴⁄³] · V²/2g     ·     HW = H + hₒ − L S",
          `V = Qb/A = ${fmt(r.Vt, 3)} m/s    h_t = V²/2g = ${fmt(r.ht, 4)} m    h_e = Ke h_t = ${fmt(r.he, 4)} m    h_f = ${fmt(r.hf, 4)} m
hₒ = máx(TW, (y_c+D)/2) = ${fmt(Math.max(inp.TW, (r.yc + (inp.tipo === "caja" ? inp.H : inp.D)) / 2), 3)} m`,
          `HW_salida = ${fmt(r.HWsalida, 3)} m`,
          "hₒ es el mayor entre el tirante de cola TW y (yc+D)/2, que representa la recuperación de carga a la salida cuando el cauce no ahoga el caño."
        ),
        paso(
          "6.5",
          "Carga de diseño en la boca",
          "HW = máx(HW_entrada, HW_salida)     ·     se compara con (HW/D)máx",
          `HW_entrada = ${fmt(r.HWentrada, 3)} m    HW_salida = ${fmt(r.HWsalida, 3)} m    gobierna ${r.controlHW}`,
          `HW = ${fmt(r.HW, 3)} m    ·    HW/D = ${fmt(r.HW_D, 2)}    (límite ${fmt(inp.HW_D_max, 2)})`,
          r.cumpleHW
            ? "El remanso no compromete la rasante según el criterio adoptado."
            : "HW/D supera el límite: abocinar la boca (baja Ke), ampliar la sección, agregar un caño o bajar la rasante del cauce."
        ),
        {
          type: "table",
          caption: "Tabla 5. Verificaciones hidráulicas",
          headers: ["Verificación", "Resultado", "Criterio", "Cumple"],
          rows: [
            [
              "Capacidad a sección llena",
              `${fmt(r.Qlleno, 3)} m³/s`,
              `≥ Qd = ${fmt(r.Qd, 3)} m³/s`,
              r.cumpleCapacidad ? "Sí" : "No",
            ],
            [
              "Carga en la boca HW/D",
              fmt(r.HW_D, 2),
              `≤ ${fmt(inp.HW_D_max, 2)}`,
              r.cumpleHW ? "Sí" : "No",
            ],
            [
              "Control que gobierna HW",
              r.controlHW,
              "El mayor de entrada y salida",
              "—",
            ],
            [
              "Régimen en el caño",
              `yₙ ${fmt(r.yn, 3)} m · Fr ${fmt(r.Fr, 2)}`,
              r.controlYn,
              "—",
            ],
            [
              "Sumergencia",
              r.sumergida ? "yₙ > 0.80 H — tiende a trabajar a presión" : "Superficie libre",
              "Si se sumerge, priorizar cartas de entrada",
              r.sumergida ? "Revisar" : "OK",
            ],
          ],
        },
        {
          type: "check",
          ok: r.cumpleCapacidad,
          text: r.cumpleCapacidad
            ? `Q_lleno = ${fmt(r.Qlleno, 3)} m³/s ≥ Qd = ${fmt(r.Qd, 3)} m³/s.`
            : `Capacidad insuficiente: Q_lleno = ${fmt(r.Qlleno, 3)} < Qd = ${fmt(r.Qd, 3)} m³/s. Ampliar la sección, la pendiente o el número de caños.`,
        },
        {
          type: "check",
          ok: r.cumpleHW,
          text: `HW/D = ${fmt(r.HW_D, 2)} ${r.cumpleHW ? "≤" : ">"} ${fmt(inp.HW_D_max, 2)} (control por ${r.controlHW}).`,
        },
        paso(
          "6.6",
          "Rasante de vía frente a la carga en la boca",
          "z_NA = z_fondo + HW     ·     holgura = z_rasante − z_NA ≥ 0.30 m",
          `z_fondo = ${fmt(inp.cotaFondo, 2)} msnm    HW = ${fmt(r.HW, 3)} m    z_rasante = ${fmt(inp.cotaRasante, 2)} msnm
Sesgo ${fmt(inp.sesgoDeg, 0)}° → L_efectiva = ${fmt(r.Lefect, 2)} m`,
          inp.cotaRasante > 0
            ? `z_NA = ${fmt(r.cotaNA, 2)} msnm    holgura = ${fmt(r.libreRasante, 2)} m`
            : "Ingrese cota de rasante y de fondo para contrastar HW con la vía.",
          r.cumpleRasante
            ? "La rasante queda 0.30 m por encima del NA de diseño. El cruce no sobrepasa la calzada."
            : "La carga invade la rasante. Bajar el fondo, ampliar la sección o abocinar la boca."
        ),
        {
          type: "check",
          ok: r.cumpleRasante,
          text: r.cumpleRasante
            ? `Holgura a rasante = ${fmt(r.libreRasante, 2)} m ≥ 0.30 m.`
            : `Holgura a rasante = ${fmt(r.libreRasante, 2)} m < 0.30 m. Revisar cotas de campo.`,
        },
        {
          type: "note",
          text: r.sumergida
            ? "El tirante normal supera el 80 % de la altura: la alcantarilla tiende a trabajar sumergida. El HW de cartas de entrada es el dato de servicio para la rasante."
            : "El flujo se mantiene con superficie libre. El control de salida con Manning es representativo si yₙ > y_c; si no, gobierna la boca.",
        },
        { type: "h2", text: "7. Conclusión" },
        {
          type: "p",
          text: `Se propone alcantarilla ${seccionTxt}${nBtxt}, L = ${fmt(inp.L, 1)} m, S = ${fmt(inp.S, 4)}, boca ${r.boca.label.toLowerCase()}. El caudal de diseño es Qd = ${fmt(r.Qd, 3)} m³/s (T = ${inp.Tret} años, I = ${fmt(r.I, 2)} mm/h, A = ${fmt(inp.Aha, 2)} ha). HW = ${fmt(r.HW, 3)} m (HW/D = ${fmt(r.HW_D, 2)}). ${
            r.cumpleCapacidad && r.cumpleHW
              ? "Cumple capacidad a sección llena y el criterio de carga en la entrada. Se recomienda detallar aletas, losa de fondo y disipación a la salida en el plano de obra."
              : "No cumple uno o más criterios: ajustar geometría, boca, número de caños o revisar la hidrología (C, A, estación SENAMHI)."
          }`,
        },
      ],
    }),
    [inp, meta, r, zonaActiva, Tuso, Cuso, seccionTxt, nBtxt]
  );
  const livePack = useMemo(() => ({ doc, inp, r }), [doc, inp, r]);
  const { doc: pack, dirty, calcular } = useMemoriaOnCalcular(livePack);
  const memoria = pack.doc;

  const set = <K extends keyof AlcantarillaInput>(k: K, v: AlcantarillaInput[K]) =>
    setInp((s) => ({ ...s, [k]: v }));

  return (
    <>
      <aside id="app-panel" className="panel">
        <h2>Alcantarilla</h2>
        <p className="lead">
          Memoria profesional: cuenca e IDF IILA–SENAMHI, método racional, Manning y control de entrada/salida FHWA HDS-5. Edite los datos y pulse Calcular.
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
            <Field label="Cota rasante" unit="msnm"><Num value={inp.cotaRasante} onChange={(v) => set("cotaRasante", v)} /></Field>
            <Field label="Cota fondo" unit="msnm"><Num value={inp.cotaFondo} onChange={(v) => set("cotaFondo", v)} /></Field>
            <Field label="Sesgo" unit="°"><Num value={inp.sesgoDeg} onChange={(v) => set("sesgoDeg", v)} /></Field>
          </div>
          <Field label="Origen del caudal">
            <select value={inp.origenQ} onChange={(e) => set("origenQ", e.target.value as AlcantarillaInput["origenQ"])}>
              <option value="racional">Método racional (esta hoja)</option>
              <option value="hidrologia">Estudio hidrológico</option>
              <option value="aforo">Aforo de campo</option>
              <option value="impuesto">Caudal del expediente</option>
            </select>
          </Field>
          <Field label="Justificación de Q"><Text value={inp.justificacionQ} onChange={(v) => set("justificacionQ", v)} /></Field>
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
            <select
              value={inp.usarTc ? "tc" : "fijo"}
              onChange={(e) => set("usarTc", e.target.value === "tc")}
            >
              <option value="tc">t = máx(10 min, Tc Kirpich)</option>
              <option value="fijo">t fijo (mínimo 10 min)</option>
            </select>
          </Field>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Cuenca afluente</legend>
          <div className="grid-2">
            <Field label="Área A" unit="ha"><Num value={inp.Aha} onChange={(v) => set("Aha", v)} /></Field>
            <Field label="C escorrentía">
              <select
                value={String(inp.C)}
                onChange={(e) => set("C", parseFloat(e.target.value))}
              >
                {C_CUENCA_VIA.map((c) => (
                  <option key={c.C} value={c.C}>{c.C.toFixed(2)} — {c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="L cauce" unit="m"><Num value={inp.Lcuenca} onChange={(v) => set("Lcuenca", v)} /></Field>
            <Field label="S cuenca"><Num value={inp.Scuenca} onChange={(v) => set("Scuenca", v)} /></Field>
            <Field label="Q forzado" unit="m³/s" note="0 = usar el caudal racional">
              <Num value={inp.Qforzado} onChange={(v) => set("Qforzado", v)} />
            </Field>
          </div>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Geometría del cajón</legend>
          <Field label="Tipo">
            <select value={inp.tipo} onChange={(e) => set("tipo", e.target.value as "caja" | "circular")}>
              <option value="caja">Cajón rectangular</option>
              <option value="circular">Circular</option>
            </select>
          </Field>
          <Field label="Boca">
            <select value={inp.tipoBoca} onChange={(e) => set("tipoBoca", e.target.value as TipoBoca)}>
              {BOCA_ALC.map((b) => (
                <option key={b.id} value={b.id}>{b.label} (Ke = {b.Ke})</option>
              ))}
            </select>
          </Field>
          <Field label="n Manning">
            <select
              value={String(inp.n)}
              onChange={(e) => set("n", parseFloat(e.target.value))}
            >
              {N_MANNING_ALC.map((x) => (
                <option key={x.n} value={x.n}>{x.n.toFixed(3)} — {x.label}</option>
              ))}
            </select>
          </Field>
          <div className="grid-2">
            <Field label="S caño"><Num value={inp.S} onChange={(v) => set("S", v)} /></Field>
            <Field label="L" unit="m"><Num value={inp.L} onChange={(v) => set("L", v)} /></Field>
            {inp.tipo === "caja" ? (
              <>
                <Field label="B" unit="m"><Num value={inp.B} onChange={(v) => set("B", v)} /></Field>
                <Field label="H" unit="m"><Num value={inp.H} onChange={(v) => set("H", v)} /></Field>
              </>
            ) : (
              <Field label="D" unit="m"><Num value={inp.D} onChange={(v) => set("D", v)} /></Field>
            )}
            <Field label="N° caños"><Num value={inp.nBarriles} onChange={(v) => set("nBarriles", v)} step="1" /></Field>
            <Field label="TW salida" unit="m"><Num value={inp.TW} onChange={(v) => set("TW", v)} /></Field>
            <Field label="HW/D máx"><Num value={inp.HW_D_max} onChange={(v) => set("HW_D_max", v)} /></Field>
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
            pack.inp.tipo === "caja" ? (
              <CajaSvg B={pack.inp.B} H={pack.inp.H} nBarriles={pack.inp.nBarriles} />
            ) : null
          }
        />
      ) : (
        <MemoriaPendiente />
      )}
    </>
  );
}
