import { useMemo, useState } from "react";
import {
  C_ESCO_HIDRO,
  CN_TIPICOS,
  COWAN_IRREG,
  COWAN_MATERIAL,
  COWAN_OBSTRUC,
  COWAN_SECCION,
  COWAN_SINUOS,
  COWAN_VEGET,
  FINALIDAD_META,
  HIDROLOGICO_DEFAULT,
  SCOBEY_N,
  TIPO_CAUCE_LABEL,
  T_RETORNO_HIDRO,
  calcularHidrologico,
  type CriterioQ,
  type FinalidadEstudio,
  type HidrologicoInput,
  type TipoCauce,
} from "../lib/hidro/hidrologico";
import { ZONAS_IILA } from "../lib/hidro/canaleta";
import { fmt } from "../lib/num";
import { type MemoriaDoc } from "../lib/memoria";
import { Field, Num, Text } from "../ui/Field";
import { CalcDirtyNote, CalcularButton, MemoriaPendiente, useMemoriaOnCalcular } from "../ui/calcular";
import { Paper } from "../ui/Paper";
import { exportarWord } from "../lib/exportWord";
import { printMemoria } from "../lib/printDoc";

const hoy = new Date().toLocaleDateString("es-PE");

const CODIGO_FINALIDAD: Record<FinalidadEstudio, string> = {
  puente: "HID-13A",
  "defensa-riberena": "HID-13B",
  "badén-alcantarilla": "HID-13C",
  "mineria-aurifera": "HID-13D",
  "bocatoma-riego": "HID-13E",
  "captacion-industrial": "HID-13F",
  "estudio-general": "HID-13",
};

function defaultsFor(finalidad: FinalidadEstudio): HidrologicoInput {
  const m = FINALIDAD_META[finalidad];
  const base = { ...HIDROLOGICO_DEFAULT, finalidad, Tret: m.T };
  if (finalidad === "mineria-aurifera") {
    return {
      ...base,
      tipoCauce: "quebrada",
      C: 0.85,
      usarSCS: true,
      CN: 85,
      QdemandaLps: 25,
      horasOperacion: 16,
      fraccionCaptacion: 0.4,
      FSagua: 1.5,
      Tret: 50,
    };
  }
  if (finalidad === "puente") {
    return { ...base, tipoCauce: "rio", Tret: 100, bordeLibre: 1.5, usarSCS: true };
  }
  if (finalidad === "defensa-riberena") {
    return { ...base, tipoCauce: "rio", Tret: 50, bordeLibre: 1.0, usarSCS: true };
  }
  if (finalidad === "badén-alcantarilla") {
    return { ...base, tipoCauce: "quebrada", Tret: 25, bordeLibre: 0.8, Aha: 80 };
  }
  if (finalidad === "bocatoma-riego") {
    return { ...base, tipoCauce: "rio", Tret: 25, QdemandaLps: 50, horasOperacion: 12, fraccionCaptacion: 0.5 };
  }
  if (finalidad === "captacion-industrial") {
    return { ...base, tipoCauce: "rio", Tret: 25, QdemandaLps: 10, horasOperacion: 24, fraccionCaptacion: 0.35 };
  }
  return base;
}

export function HidrologicoModule({ finalidad = "estudio-general" }: { finalidad?: FinalidadEstudio }) {
  const finMeta = FINALIDAD_META[finalidad];
  const codigo = CODIGO_FINALIDAD[finalidad];
  const [meta, setMeta] = useState({
    proyecto: `Estudio hidrológico — ${finMeta.label}`,
    ubicacion: "Perú",
    profesional: "Ingeniero civil",
  });
  const [inp, setInp] = useState<HidrologicoInput>(() => defaultsFor(finalidad));
  const r = useMemo(() => calcularHidrologico({ ...inp, finalidad }), [inp, finalidad]);
  const zonaActiva = ZONAS_IILA.find((z) => z.id === inp.zonaId);
  const Tlabel = T_RETORNO_HIDRO.find((t) => t.T === inp.Tret)?.label ?? `${inp.Tret} años`;
  const Clabel = C_ESCO_HIDRO.find((c) => Math.abs(c.C - inp.C) < 1e-6)?.label ?? "C adoptado";
  const esAgua =
    finalidad === "mineria-aurifera" ||
    finalidad === "bocatoma-riego" ||
    finalidad === "captacion-industrial";

  const set = <K extends keyof HidrologicoInput>(k: K, v: HidrologicoInput[K]) =>
    setInp((s) => ({ ...s, [k]: v }));

  const applyZona = (zonaId: string) => {
    const z = ZONAS_IILA.find((x) => x.id === zonaId);
    if (!z) return set("zonaId", zonaId);
    setInp((s) => ({ ...s, zonaId, nIila: z.n, tg: z.tg, eg: z.eg, bParam: z.b }));
  };

  const doc: MemoriaDoc = useMemo(
    () => ({
      codigo,
      titulo: `Cálculo hidrológico — ${finMeta.label}`,
      norma: "Manning · Cowan · Racional · SCS · IILA–SENAMHI–UNI · MTC CE.040",
      blocks: [
        {
          type: "cover",
          kicker: `${codigo} · Hidrología de cauce · Memoria de cálculo`,
          titulo: `Cálculo hidrológico — ${TIPO_CAUCE_LABEL[inp.tipoCauce].toLowerCase()} · ${finMeta.label}`,
          subtitulo: finMeta.blurb,
          meta: [
            { k: "Proyecto", v: meta.proyecto },
            { k: "Ubicación", v: `${meta.ubicacion}${inp.departamento ? ` · ${inp.departamento}` : ""}${inp.provincia ? ` / ${inp.provincia}` : ""}${inp.distrito ? ` / ${inp.distrito}` : ""}` },
            { k: "Cauce", v: `${TIPO_CAUCE_LABEL[inp.tipoCauce]} · ${inp.rio}` },
            { k: "Finalidad", v: finMeta.label },
            { k: "Estación SENAMHI", v: `${inp.estacionSenamhi}${inp.codigoEstacion ? ` (${inp.codigoEstacion})` : ""}` },
            { k: "Zona IILA / elevación", v: `${zonaActiva?.label ?? inp.zonaId} · ${fmt(inp.elevacionMsnm, 0)} m s.n.m.` },
            { k: "Profesional", v: meta.profesional },
            { k: "Fecha", v: hoy },
            { k: "T retorno", v: Tlabel },
            { k: "Q avenida adoptado", v: `${fmt(r.Qadopt, 2)} m³/s` },
            { k: "Q estiaje / captación", v: `${fmt(r.QestiajeLps, 1)} L/s · capt. ${fmt(r.QcaptacionLps, 1)} L/s` },
            { k: "N.A.M.E. diseño", v: `${fmt(r.cotaNameNueva, 2)} m s.n.m.` },
          ],
        },
        { type: "h2", text: "1. Objeto, alcance y lagunas del Excel de partida" },
        {
          type: "p",
          text: "El archivo «Cálculo Hidrológico.xls» (Pack) estima Qmáx con tres métodos empíricos pensados para tirante de puente, pero deja la intensidad i como dato manual (p. ej. 140 mm/h) y no cubre estiaje, SENAMHI, SCS ni demanda de agua. Esta memoria completa esas lagunas para un expediente profesional presentable a municipalidad, MTC, ANA o autoridad minera.",
        },
        {
          type: "list",
          items: [
            "A — Sección y pendiente (Manning + n Cowan/Scobey) con huellas de N.A.M.E.",
            "B — Velocidad y área con aforo superficial y amplificación de tirante.",
            "C — Racional Q=C·I·A/360 con I(t,T) IILA–SENAMHI–UNI (no i suelta).",
            "D — SCS Curve Number (recomendado si A > 5 km² o cobertura minera/desmonte).",
            "E — Fórmula regional tipo Creager Q=C·A^n (opcional, contrastación).",
            "Estiaje / captación: Qestiaje≈Vs·Aactual y fracción concesionable vs demanda (L/s, m³/día).",
            "Entrega: Qavenida, N.A.M.E., tirante, velocidad, intradós (si aplica) y balance oferta/demanda.",
          ],
        },
        { type: "h2", text: "2. Identificación del cauce y finalidad" },
        {
          type: "kv",
          rows: [
            { k: "Tipo de cauce", v: TIPO_CAUCE_LABEL[inp.tipoCauce] },
            { k: "Nombre", v: inp.rio },
            { k: "Finalidad del estudio", v: `${finMeta.label} — ${finMeta.blurb}` },
            { k: "Área de cuenca", v: `${fmt(inp.Aha, 1)} ha (${fmt(inp.Aha / 100, 2)} km²)` },
            { k: "Desnivel / L cauce / S", v: `${fmt(inp.Hcuenca, 0)} m · ${fmt(inp.Lcuenca, 0)} m · S=${fmt(inp.Scuenca, 4)}` },
          ],
        },
        { type: "h2", text: "3. Datos SENAMHI / IILA exigibles en informe profesional" },
        {
          type: "p",
          text: "Sin estación, P24, zona IILA (n, tg, eg, b) y periodo de retorno justificado, el racional no es defendible. Calibre tg/eg con la estación pluviométrica más cercana o isoyetas CE.040; declare años de registro y límite de extrapolación de T.",
        },
        {
          type: "kv",
          rows: [
            { k: "Estación / código", v: `${inp.estacionSenamhi} · ${inp.codigoEstacion || "s/c"}` },
            { k: "Zona IILA", v: zonaActiva?.label ?? inp.zonaId },
            { k: "n, b, tg, eg", v: `${fmt(inp.nIila, 3)} · ${fmt(inp.bParam, 2)} h · ${fmt(inp.tg, 2)} · ${fmt(inp.eg, 1)} mm` },
            { k: "P24 máx. / Pma", v: `${fmt(inp.P24max, 1)} mm · ${fmt(inp.Pma, 0)} mm/año` },
            { k: "Años de registro", v: String(inp.anosRegistro) },
            { k: "Elevación / coords", v: `${fmt(inp.elevacionMsnm, 0)} m · ${inp.lat || "—"}°, ${inp.lon || "—"}°` },
            { k: "T retorno", v: Tlabel },
            { k: "I(t,T) calculada", v: `${fmt(r.I, 1)} mm/h (t=${fmt(r.tDisenoMin, 1)} min, Tc=${fmt(r.TcMin, 1)} min)` },
            { k: "Parámetros a, K", v: `a=${fmt(r.a, 3)} · K=${fmt(r.K, 3)}` },
          ],
        },
        ...(r.faltantes.length
          ? [
              {
                type: "note" as const,
                text: `Datos aún incompletos para expediente cerrado: ${r.faltantes.join("; ")}.`,
              },
            ]
          : [
              {
                type: "note" as const,
                text: "Carátula SENAMHI/ubicación completa para presentación. Siga calibrando tg/eg con boletines locales antes de planos definitivos.",
              },
            ]),
        { type: "h2", text: "4. Rugosidad n (Cowan y Scobey)" },
        {
          type: "p",
          text: "Se construye n por Cowan (suma de incrementos × sinuosidad) y se contrasta con Scobey. Se adopta el menor de ambos para no subestimar el caudal de avenida (n menor → Q mayor).",
        },
        {
          type: "kv",
          rows: [
            { k: "n Cowan", v: fmt(r.nCowan, 4) },
            { k: "n Scobey", v: fmt(r.nScobey, 4) },
            { k: "n adoptado", v: fmt(r.nAdopt, 4) },
          ],
        },
        { type: "h2", text: "5. Método A — sección y pendiente (Manning)" },
        {
          type: "eq",
          text: "Q = A · R^(2/3) · S^(1/2) / n    ·    R = A/P",
        },
        {
          type: "kv",
          rows: [
            { k: "Aa / P / R", v: `${fmt(inp.Aa, 2)} m² · ${fmt(inp.P, 2)} m · R=${fmt(r.Rh, 3)} m` },
            { k: "S / n", v: `${fmt(inp.S, 5)} · ${fmt(r.nAdopt, 4)}` },
            { k: "Cota N.A.M.E. huella", v: `${fmt(inp.cotaName, 2)} m s.n.m.` },
            { k: "Q Manning", v: `${fmt(r.Qmanning, 2)} m³/s` },
          ],
        },
        { type: "h2", text: "6. Método B — velocidad y área" },
        {
          type: "eq",
          text: "Ha = coef · Aa / Ba    ·    Va = Vs · Ha / h    ·    Q = Va · Aa",
        },
        {
          type: "kv",
          rows: [
            { k: "Ba / coef / Ha", v: `${fmt(inp.Ba, 2)} m · ${fmt(inp.coefHa, 2)} · Ha=${fmt(r.Ha, 3)} m` },
            { k: "Vs / h actual", v: `${fmt(inp.Vs, 2)} m/s · ${fmt(inp.hActual, 2)} m` },
            { k: "Va / Q vel-área", v: `${fmt(r.Va, 2)} m/s · ${fmt(r.Qvel, 2)} m³/s` },
          ],
        },
        { type: "h2", text: "7. Método C — racional + IDF SENAMHI/IILA" },
        {
          type: "p",
          text: `C = ${fmt(inp.C, 2)} (${Clabel}). Duración t = máx(10 min, Tc) salvo t fijo. La intensidad ya no es un dato suelto del Excel.`,
        },
        {
          type: "eq",
          text: "Q = C · I · A / 360    ·    I(t,T)=a·(1+K·log₁₀T)·(t+b)^(n−1)",
        },
        {
          type: "kv",
          rows: [
            { k: "I SENAMHI/IILA", v: `${fmt(r.I, 1)} mm/h` },
            { k: "I forzada (si >0)", v: inp.iForzada > 0 ? `${fmt(inp.iForzada, 1)} mm/h` : "No usada" },
            { k: "Q racional", v: `${fmt(inp.iForzada > 0 ? r.QracionalManual : r.Qracional, 2)} m³/s` },
          ],
        },
        { type: "h2", text: "8. Método D — SCS Curve Number" },
        {
          type: "p",
          text: inp.usarSCS
            ? `CN=${fmt(inp.CN, 0)}. P diseño=${fmt(r.Pscs, 1)} mm → escorrentía Qmm=${fmt(r.QmmScs, 1)} mm. Caudal punta con hidrograma triangular simplificado: Qscs=${fmt(r.Qscs, 2)} m³/s.`
            : "SCS desactivado. Actívelo para cuencas medianas, minería o cuando el racional no baste.",
        },
        ...(inp.usarRegional
          ? [
              { type: "h2" as const, text: "9. Método E — fórmula regional" },
              {
                type: "p" as const,
                text: `Q = C·A^n = ${fmt(inp.Ccreager, 1)} · (${fmt(inp.Aha / 100, 2)} km²)^${fmt(inp.nCreager, 2)} = ${fmt(r.Qregional, 2)} m³/s. Solo contrastación; no reemplaza aforo.`,
              },
            ]
          : []),
        { type: "h2", text: inp.usarRegional ? "10. Adopción del caudal de avenida" : "9. Adopción del caudal de avenida" },
        {
          type: "table",
          caption: "Caudales de avenida por método",
          headers: ["Método", "Q (m³/s)", "Nota"],
          rows: [
            ["A · Manning", fmt(r.Qmanning, 2), "Huellas de campo"],
            ["B · Velocidad-área", fmt(r.Qvel, 2), "Aforo + amplificación"],
            ["C · Racional + IDF", fmt(inp.iForzada > 0 ? r.QracionalManual : r.Qracional, 2), "SENAMHI/IILA"],
            ...(inp.usarSCS ? [["D · SCS CN", fmt(r.Qscs, 2), `CN=${fmt(inp.CN, 0)}`]] : []),
            ...(inp.usarRegional ? [["E · Regional", fmt(r.Qregional, 2), "Creager-like"]] : []),
            ["Adoptado", fmt(r.Qadopt, 2), r.criterioLabel],
          ],
        },
        {
          type: "p",
          text: `Volumen aproximado del hidrograma de avenida (triángulo 2·Tc): ${fmt(r.volumenAvenidaM3aprox, 0)} m³. Útil para lagunas de laminación o revisión de botaderos.`,
        },
        { type: "h2", text: "N.A.M.E. y tirante con Q adoptado" },
        {
          type: "kv",
          rows: [
            { k: "ΔA / ΔH", v: `${fmt(r.dA, 3)} m² · ${fmt(r.dH, 3)} m` },
            { k: "N.A.M.E. diseño", v: `${fmt(r.cotaNameNueva, 3)} m s.n.m.` },
            { k: "Tirante / velocidad", v: `${fmt(r.yName, 3)} m · ${fmt(r.Vadopt, 2)} m/s` },
            { k: "Cota mín. intradós (si puente)", v: `${fmt(r.cotaIntradósMin, 3)} m s.n.m. (BL=${fmt(inp.bordeLibre, 2)} m)` },
          ],
        },
        { type: "h2", text: "Estiaje, captación y balance de agua (minería / bocatoma / industria)" },
        {
          type: "p",
          text: "Para explotación aurífera u otra demanda, el Qmáx no basta: se necesita el caudal disponible en estiaje (aforo) y la fracción legalmente capturable (caudal ecológico / licencia ANA). El balance compara oferta capturable vs demanda×FS.",
        },
        {
          type: "table",
          caption: "Disponibilidad hídrica",
          headers: ["Magnitud", "Valor", "Unidad"],
          rows: [
            ["Área mojada actual (aprox.)", fmt(r.Aactual, 3), "m²"],
            ["Q estiaje (Vs·Aact)", fmt(r.QestiajeLps, 1), "L/s"],
            ["Fracción captación", fmt(inp.fraccionCaptacion * 100, 0), "%"],
            ["Q capturable", fmt(r.QcaptacionLps, 1), "L/s"],
            ["Demanda de proceso", fmt(r.QdemandaLps, 1), "L/s"],
            ["Demanda diaria", fmt(r.QdemandaM3dia, 1), "m³/día"],
            ["FS disponibilidad", fmt(inp.FSagua, 2), "—"],
            ["Oferta / (demanda·FS)", fmt(r.ratioOfertaDemanda, 2), "≥ 1 OK"],
          ],
        },
        {
          type: "check",
          ok: r.balanceOk,
          text: r.balanceOk
            ? `Balance hídrico satisfactorio: captación ${fmt(r.QcaptacionLps, 1)} L/s ≥ demanda×FS.`
            : `Balance insuficiente: captación ${fmt(r.QcaptacionLps, 1)} L/s < demanda×FS ${fmt(r.QdemandaLps * inp.FSagua, 1)} L/s.`,
        },
        { type: "h2", text: "Hoja de entrega para diseños posteriores" },
        {
          type: "table",
          caption: "Parámetros a transferir al diseño hidráulico / estructural / de proceso",
          headers: ["Parámetro", "Símbolo", "Valor", "Unidad"],
          rows: [
            ["Caudal de avenida", "Qdiseño", fmt(r.listoDiseno.Qdiseño, 2), "m³/s"],
            ["Periodo de retorno", "T", String(r.listoDiseno.T), "años"],
            ["Intensidad", "I", fmt(r.listoDiseno.I, 1), "mm/h"],
            ["Tiempo de concentración", "Tc", fmt(r.listoDiseno.Tc, 1), "min"],
            ["Cota N.A.M.E.", "N.A.M.E.", fmt(r.listoDiseno.N_AME, 3), "m s.n.m."],
            ["Tirante de avenida", "y", fmt(r.listoDiseno.tirante, 3), "m"],
            ["Velocidad media", "V", fmt(r.listoDiseno.velocidad, 2), "m/s"],
            ["Rugosidad", "n", fmt(r.listoDiseno.n, 4), "—"],
            ["Pendiente", "S", fmt(r.listoDiseno.S, 5), "m/m"],
            ["Borde libre", "BL", fmt(r.listoDiseno.bordeLibre, 2), "m"],
            ["Cota mín. intradós", "Z_intr", fmt(r.listoDiseno.cotaIntradós, 3), "m s.n.m."],
            ["Q estiaje", "Qest", fmt(r.listoDiseno.Qestiaje * 1000, 1), "L/s"],
            ["Q capturable", "Qcap", fmt(r.listoDiseno.Qcaptacion * 1000, 1), "L/s"],
            ["Ratio oferta/demanda", "η", fmt(r.listoDiseno.ratioOfertaDemanda, 2), "—"],
          ],
        },
        ...(r.avisos.length
          ? [
              { type: "h2" as const, text: "Notas" },
              { type: "list" as const, items: r.avisos },
            ]
          : []),
        { type: "h2", text: "Conclusión" },
        {
          type: "p",
          text: `Para el ${TIPO_CAUCE_LABEL[inp.tipoCauce].toLowerCase()} «${inp.rio}» (${finMeta.label.toLowerCase()}) se adopta Qavenida = ${fmt(r.Qadopt, 2)} m³/s (${r.criterioLabel.toLowerCase()}) con T = ${inp.Tret} años. N.A.M.E. de diseño = ${fmt(r.cotaNameNueva, 2)} m s.n.m. Caudal de estiaje ≈ ${fmt(r.QestiajeLps, 1)} L/s; captación admisible ≈ ${fmt(r.QcaptacionLps, 1)} L/s${esAgua ? ` frente a demanda ${fmt(r.QdemandaLps, 1)} L/s (${fmt(r.QdemandaM3dia, 0)} m³/día)` : ""}. Verifique con aforo SENAMHI/ANA y, en cuencas grandes, con hidrograma o modelo regional antes de emitir planos o solicitar licencia de uso de agua.`,
        },
      ],
    }),
    [meta, inp, r, zonaActiva, Tlabel, Clabel, finMeta, esAgua, codigo, finalidad]
  );

  const livePack = useMemo(() => ({ doc, inp, r }), [doc, inp, r]);
  const { doc: pack, dirty, calcular } = useMemoriaOnCalcular(livePack, finalidad);
  const memoria = pack.doc;

  return (
    <>
      <aside id="app-panel" className="panel">
        <h2>
          {codigo} · {finMeta.label}
        </h2>
        <p className="lead">
          {finMeta.blurb} Informe con SENAMHI/IILA, Manning, racional, SCS y hoja de entrega para diseño. Pulse Calcular
          para publicar la memoria.
        </p>
        <CalcDirtyNote dirty={dirty} />
        <fieldset className="fieldset">
          <legend>Carátula</legend>
          <Field label="Proyecto"><Text value={meta.proyecto} onChange={(v) => setMeta((m) => ({ ...m, proyecto: v }))} /></Field>
          <Field label="Ubicación"><Text value={meta.ubicacion} onChange={(v) => setMeta((m) => ({ ...m, ubicacion: v }))} /></Field>
          <Field label="Profesional"><Text value={meta.profesional} onChange={(v) => setMeta((m) => ({ ...m, profesional: v }))} /></Field>
          <Field label="Departamento"><Text value={inp.departamento} onChange={(v) => set("departamento", v)} /></Field>
          <Field label="Provincia"><Text value={inp.provincia} onChange={(v) => set("provincia", v)} /></Field>
          <Field label="Distrito"><Text value={inp.distrito} onChange={(v) => set("distrito", v)} /></Field>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Cauce</legend>
          <Field label="Tipo de cauce">
            <select value={inp.tipoCauce} onChange={(e) => set("tipoCauce", e.target.value as TipoCauce)}>
              {(Object.keys(TIPO_CAUCE_LABEL) as TipoCauce[]).map((k) => (
                <option key={k} value={k}>{TIPO_CAUCE_LABEL[k]}</option>
              ))}
            </select>
          </Field>
          <Field label="Nombre del cauce"><Text value={inp.rio} onChange={(v) => set("rio", v)} /></Field>
          <p className="lead" style={{ marginTop: 8 }}>
            Informe fijado: <strong>{finMeta.label}</strong>
          </p>
        </fieldset>
        <fieldset className="fieldset">
          <legend>SENAMHI / IILA</legend>
          <Field label="Estación SENAMHI"><Text value={inp.estacionSenamhi} onChange={(v) => set("estacionSenamhi", v)} /></Field>
          <Field label="Código estación"><Text value={inp.codigoEstacion} onChange={(v) => set("codigoEstacion", v)} /></Field>
          <Field label="Zona climática">
            <select value={inp.zonaId} onChange={(e) => applyZona(e.target.value)}>
              {ZONAS_IILA.map((z) => (
                <option key={z.id} value={z.id}>{z.label}</option>
              ))}
            </select>
          </Field>
          <div className="grid-2">
            <Field label="n IILA"><Num value={inp.nIila} onChange={(v) => set("nIila", v)} /></Field>
            <Field label="b" unit="h"><Num value={inp.bParam} onChange={(v) => set("bParam", v)} /></Field>
            <Field label="tg"><Num value={inp.tg} onChange={(v) => set("tg", v)} /></Field>
            <Field label="eg" unit="mm"><Num value={inp.eg} onChange={(v) => set("eg", v)} /></Field>
            <Field label="P24 máx." unit="mm"><Num value={inp.P24max} onChange={(v) => set("P24max", v)} /></Field>
            <Field label="P media anual" unit="mm"><Num value={inp.Pma} onChange={(v) => set("Pma", v)} /></Field>
            <Field label="Años registro"><Num value={inp.anosRegistro} onChange={(v) => set("anosRegistro", v)} step="1" /></Field>
            <Field label="Elevación" unit="m"><Num value={inp.elevacionMsnm} onChange={(v) => set("elevacionMsnm", v)} /></Field>
            <Field label="Latitud °"><Num value={inp.lat} onChange={(v) => set("lat", v)} /></Field>
            <Field label="Longitud °"><Num value={inp.lon} onChange={(v) => set("lon", v)} /></Field>
          </div>
          <Field label="T retorno">
            <select value={String(inp.Tret)} onChange={(e) => set("Tret", parseFloat(e.target.value))}>
              {T_RETORNO_HIDRO.map((t) => (
                <option key={t.T} value={t.T}>{t.label}</option>
              ))}
            </select>
          </Field>
        </fieldset>
        <fieldset className="fieldset">
          <legend>n Manning (Cowan / Scobey)</legend>
          <Field label="Material">
            <select value={inp.cowanMaterial} onChange={(e) => set("cowanMaterial", e.target.value as HidrologicoInput["cowanMaterial"])}>
              {Object.entries(COWAN_MATERIAL).map(([k, v]) => (
                <option key={k} value={k}>{k} — {v.label} ({v.n})</option>
              ))}
            </select>
          </Field>
          <Field label="Irregularidad">
            <select value={inp.cowanIrreg} onChange={(e) => set("cowanIrreg", e.target.value as HidrologicoInput["cowanIrreg"])}>
              {Object.entries(COWAN_IRREG).map(([k, v]) => (
                <option key={k} value={k}>{k} — {v.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Variación de sección">
            <select value={inp.cowanSeccion} onChange={(e) => set("cowanSeccion", e.target.value as HidrologicoInput["cowanSeccion"])}>
              {Object.entries(COWAN_SECCION).map(([k, v]) => (
                <option key={k} value={k}>{k} — {v.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Obstrucciones">
            <select value={inp.cowanObstruc} onChange={(e) => set("cowanObstruc", e.target.value as HidrologicoInput["cowanObstruc"])}>
              {Object.entries(COWAN_OBSTRUC).map(([k, v]) => (
                <option key={k} value={k}>{k} — {v.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Vegetación">
            <select value={inp.cowanVeget} onChange={(e) => set("cowanVeget", e.target.value as HidrologicoInput["cowanVeget"])}>
              {Object.entries(COWAN_VEGET).map(([k, v]) => (
                <option key={k} value={k}>{k} — {v.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Sinuosidad">
            <select value={inp.cowanSinuos} onChange={(e) => set("cowanSinuos", e.target.value as HidrologicoInput["cowanSinuos"])}>
              {Object.entries(COWAN_SINUOS).map(([k, v]) => (
                <option key={k} value={k}>{k} — {v.label} (×{v.m})</option>
              ))}
            </select>
          </Field>
          <Field label="n Scobey">
            <select value={String(inp.nScobey)} onChange={(e) => set("nScobey", parseFloat(e.target.value))}>
              {SCOBEY_N.map((x) => (
                <option key={x.n} value={x.n}>{x.n.toFixed(3)} — {x.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Forzar n" unit="—" note="0 = min(Cowan, Scobey)">
            <Num value={inp.forzarN} onChange={(v) => set("forzarN", v)} />
          </Field>
          <p className="lead" style={{ marginTop: 8 }}>
            n Cowan={fmt(r.nCowan, 4)} · Scobey={fmt(r.nScobey, 4)} · adoptado={fmt(r.nAdopt, 4)}
          </p>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Método A — sección y pendiente</legend>
          <div className="grid-2">
            <Field label="Cota N.A.M.E." unit="m"><Num value={inp.cotaName} onChange={(v) => set("cotaName", v)} /></Field>
            <Field label="Aa" unit="m²"><Num value={inp.Aa} onChange={(v) => set("Aa", v)} /></Field>
            <Field label="P" unit="m"><Num value={inp.P} onChange={(v) => set("P", v)} /></Field>
            <Field label="S"><Num value={inp.S} onChange={(v) => set("S", v)} /></Field>
            <Field label="Ba espejo" unit="m"><Num value={inp.Ba} onChange={(v) => set("Ba", v)} /></Field>
          </div>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Método B — velocidad y área / aforo</legend>
          <div className="grid-2">
            <Field label="Coef. Ha"><Num value={inp.coefHa} onChange={(v) => set("coefHa", v)} /></Field>
            <Field label="Vs" unit="m/s"><Num value={inp.Vs} onChange={(v) => set("Vs", v)} /></Field>
            <Field label="h actual" unit="m"><Num value={inp.hActual} onChange={(v) => set("hActual", v)} /></Field>
            <Field label="B actual" unit="m" note="Espejo en estiaje"><Num value={inp.Bactual} onChange={(v) => set("Bactual", v)} /></Field>
          </div>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Método C — cuenca y racional</legend>
          <div className="grid-2">
            <Field label="Área A" unit="ha"><Num value={inp.Aha} onChange={(v) => set("Aha", v)} /></Field>
            <Field label="C escorrentía">
              <select value={String(inp.C)} onChange={(e) => set("C", parseFloat(e.target.value))}>
                {C_ESCO_HIDRO.map((c) => (
                  <option key={c.id} value={c.C}>{c.id} · {c.C.toFixed(2)} — {c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="L cauce" unit="m"><Num value={inp.Lcuenca} onChange={(v) => set("Lcuenca", v)} /></Field>
            <Field label="S cuenca"><Num value={inp.Scuenca} onChange={(v) => set("Scuenca", v)} /></Field>
            <Field label="Desnivel H" unit="m"><Num value={inp.Hcuenca} onChange={(v) => set("Hcuenca", v)} /></Field>
            <Field label="i forzada" unit="mm/h" note="0 = solo IDF">
              <Num value={inp.iForzada} onChange={(v) => set("iForzada", v)} />
            </Field>
            <Field label="t fijo" unit="min"><Num value={inp.tMinFijo} onChange={(v) => set("tMinFijo", v)} step="1" /></Field>
          </div>
          <Field label="Duración t">
            <select value={inp.usarTc ? "tc" : "fijo"} onChange={(e) => set("usarTc", e.target.value === "tc")}>
              <option value="tc">t = máx(10 min, Tc Kirpich)</option>
              <option value="fijo">t fijo</option>
            </select>
          </Field>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Método D — SCS / CN</legend>
          <Field label="Usar SCS">
            <select value={inp.usarSCS ? "si" : "no"} onChange={(e) => set("usarSCS", e.target.value === "si")}>
              <option value="si">Sí (recomendado A≥5 km² / minería)</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Curve Number CN">
            <select value={String(inp.CN)} onChange={(e) => set("CN", parseFloat(e.target.value))}>
              {CN_TIPICOS.map((x) => (
                <option key={x.CN} value={x.CN}>{x.CN} — {x.label}</option>
              ))}
            </select>
          </Field>
          <Field label="P diseño" unit="mm" note="0 = desde P24 o I·t">
            <Num value={inp.PdisenoMm} onChange={(v) => set("PdisenoMm", v)} />
          </Field>
          {inp.usarSCS ? (
            <p className="lead" style={{ marginTop: 8 }}>
              Qscs={fmt(r.Qscs, 2)} m³/s · Qmm={fmt(r.QmmScs, 1)} mm · P={fmt(r.Pscs, 1)} mm
            </p>
          ) : null}
        </fieldset>
        <fieldset className="fieldset">
          <legend>Método E — regional (opcional)</legend>
          <Field label="Usar regional">
            <select value={inp.usarRegional ? "si" : "no"} onChange={(e) => set("usarRegional", e.target.value === "si")}>
              <option value="no">No</option>
              <option value="si">Sí · Q=C·A^n</option>
            </select>
          </Field>
          <div className="grid-2">
            <Field label="C Creager"><Num value={inp.Ccreager} onChange={(v) => set("Ccreager", v)} /></Field>
            <Field label="n exponente"><Num value={inp.nCreager} onChange={(v) => set("nCreager", v)} /></Field>
          </div>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Adopción y borde libre</legend>
          <Field label="Criterio Q">
            <select value={inp.criterio} onChange={(e) => set("criterio", e.target.value as CriterioQ)}>
              <option value="maximo">Máximo (conservador)</option>
              <option value="promedio">Promedio aritmético</option>
              <option value="ponderado">Media ponderada</option>
            </select>
          </Field>
          <div className="grid-2">
            <Field label="Peso A"><Num value={inp.wA} onChange={(v) => set("wA", v)} /></Field>
            <Field label="Peso B"><Num value={inp.wB} onChange={(v) => set("wB", v)} /></Field>
            <Field label="Peso C"><Num value={inp.wC} onChange={(v) => set("wC", v)} /></Field>
            <Field label="Peso D SCS"><Num value={inp.wD} onChange={(v) => set("wD", v)} /></Field>
            <Field label="Borde libre" unit="m"><Num value={inp.bordeLibre} onChange={(v) => set("bordeLibre", v)} /></Field>
            <Field label="Factor P"><Num value={inp.factorP} onChange={(v) => set("factorP", v)} /></Field>
          </div>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Demanda de agua (minería / bocatoma / industria)</legend>
          <div className="grid-2">
            <Field label="Q demanda" unit="L/s"><Num value={inp.QdemandaLps} onChange={(v) => set("QdemandaLps", v)} /></Field>
            <Field label="Horas operación" unit="h/d"><Num value={inp.horasOperacion} onChange={(v) => set("horasOperacion", v)} /></Field>
            <Field label="FS agua"><Num value={inp.FSagua} onChange={(v) => set("FSagua", v)} /></Field>
            <Field label="Fracción captación" note="0–1"><Num value={inp.fraccionCaptacion} onChange={(v) => set("fraccionCaptacion", v)} /></Field>
          </div>
          <p className="lead" style={{ marginTop: 8 }}>
            Estiaje {fmt(r.QestiajeLps, 1)} L/s · capt. {fmt(r.QcaptacionLps, 1)} L/s · demanda{" "}
            {fmt(r.QdemandaM3dia, 0)} m³/d · η={fmt(r.ratioOfertaDemanda, 2)}{" "}
            {r.balanceOk ? "OK" : "INSUFICIENTE"}
          </p>
        </fieldset>
        <div className="actions">
          <CalcularButton onClick={calcular} dirty={dirty} />
          <button type="button" className="btn" disabled={!memoria} onClick={() => memoria && void exportarWord(memoria)}>
            Exportar Word
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={!memoria}
            onClick={() => memoria && printMemoria(memoria.titulo)}
          >
            Imprimir / PDF
          </button>
        </div>
      </aside>
      {memoria ? <Paper doc={memoria} /> : <MemoriaPendiente />}
    </>
  );
}
