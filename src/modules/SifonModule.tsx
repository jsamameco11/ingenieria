import { useMemo, useState } from "react";
import { calcularSifon, diametroComercialPulg, diametroDesdeV, type SifonInput } from "../lib/hidro/sifon";
import { ORIGEN_Q, labelOrigenQ, type OrigenCaudal } from "../lib/hidro/expediente";
import { fmt } from "../lib/num";
import { paso, type MemoriaDoc } from "../lib/memoria";
import { Field, Num, Text } from "../ui/Field";
import { CalcDirtyNote, CalcularButton, MemoriaPendiente, useMemoriaOnCalcular } from "../ui/calcular";
import { Paper } from "../ui/Paper";
import { CanalTrapezSvg, SifonSvg } from "../ui/diagrams";
import { exportarWord } from "../lib/exportWord";
import { printMemoria } from "../lib/printDoc";

export function SifonModule() {
  const [meta, setMeta] = useState({
    proyecto: "Sifón invertido — cruce de depresión",
    ubicacion: "Perú",
    profesional: "Ingeniero civil",
    cip: "",
    origenQ: "impuesto" as OrigenCaudal,
    justificacionQ: "Caudal del canal de conducción (HID-02 / HID-11).",
  });
  const [inp, setInp] = useState<SifonInput>({
    Q: 0.53,
    nCanal: 0.017,
    nTubo: 0.013,
    Sentrada: 0.048,
    Ssalida: 0.058,
    zTalud: 1,
    bEntrada: 0.5,
    bSalida: 0.3,
    cotaFondoEntrada: 925,
    cotaFondoSalida: 923.85,
    Dpulg: 0,
    Vdiseno: 1.5,
    thetaEntDeg: 12,
    thetaSalDeg: 12,
    LinclinadaEnt: 5,
    Lhorizontal: 10,
    LinclinadaSal: 4,
    Stubo: 0.005,
    fDarcy: 0.025,
    Ke: 0.5,
    Ks: 1.0,
    nCodos: 2,
    Kcodo: 0.3,
    material: "Concreto armado / HDPE PE100",
    claseTubo: "PN 6 / f'c 210",
    recubrimiento: 1.2,
    nAire: 2,
    nLimpia: 2,
  });

  const r = useMemo(() => calcularSifon(inp), [inp]);
  const Dsug = diametroComercialPulg(diametroDesdeV(inp.Q, inp.Vdiseno));

  const doc: MemoriaDoc = useMemo(
    () => ({
      codigo: "HID-03",
      titulo: "Diseño hidráulico de sifón invertido",
      norma: "Manning · USBR · transiciones de alcantarilla",
      blocks: [
        {
          type: "cover",
          kicker: "HID-03 · Obra de arte · Memoria de cálculo",
          titulo: "Diseño hidráulico de un sifón invertido",
          subtitulo: "Canales de llegada y salida, tubería a presión, sello de agua y balance de energía",
          meta: [
            { k: "Proyecto", v: meta.proyecto },
            { k: "Ubicación", v: meta.ubicacion },
            { k: "Profesional responsable", v: meta.cip ? `${meta.profesional} · CIP ${meta.cip}` : meta.profesional },
            { k: "Caudal de diseño", v: `${fmt(inp.Q, 3)} m³/s` },
            { k: "Origen del caudal", v: labelOrigenQ(meta.origenQ) },
            { k: "Justificación", v: meta.justificacionQ },
            { k: "Material / clase", v: `${inp.material} · ${inp.claseTubo}` },
          ],
        },
        { type: "h2", text: "1. Objeto y alcance" },
        {
          type: "p",
          text: "El sifón invertido conduce el caudal bajo una depresión (vía, quebrada o cauce) trabajando a sección llena. Se dimensionan los canales de entrada y salida por Manning, se elige el diámetro de tubería para una velocidad de 1.5 a 3.0 m/s (evitar sedimentación y cavitación), se calculan transiciones, sello de agua y pérdidas, y se verifica que la carga disponible —con la cota de salida topografiada— sea mayor que la suma de pérdidas.",
        },
        { type: "h2", text: "2. Criterio de diseño" },
        {
          type: "p",
          text: `${meta.justificacionQ} El perfil de fondo se contrasta con la cota de salida de campo. Se prevén ${inp.nAire} válvulas de aire y ${inp.nLimpia} cámaras de limpia. Recubrimiento mínimo ${fmt(inp.recubrimiento, 2)} m.`,
        },
        { type: "h2", text: "3. Canal de entrada" },
        { type: "eq", text: "Q = (1/n) · A · R²⁄³ · S¹⁄²     ·     A = (b + z y) y", num: "1" },
        {
          type: "kv",
          rows: [
            { k: "Q", v: fmt(inp.Q, 3), u: "m³/s" },
            { k: "b de entrada", v: fmt(inp.bEntrada, 2), u: "m" },
            { k: "Talud z", v: fmt(inp.zTalud, 2), u: "—" },
            { k: "n (concreto)", v: fmt(inp.nCanal, 3), u: "—" },
            { k: "Pendiente S₁", v: fmt(inp.Sentrada, 4), u: "m/m" },
            { k: "Tirante normal y₁", v: fmt(r.y1, 4), u: "m" },
            { k: "Área A₁", v: fmt(r.g1.A, 4), u: "m²" },
            { k: "Perímetro P₁", v: fmt(r.g1.P, 4), u: "m" },
            { k: "Radio R₁", v: fmt(r.g1.R, 4), u: "m" },
            { k: "Espejo T₁", v: fmt(r.g1.T, 3), u: "m" },
            { k: "Velocidad V₁", v: fmt(r.V1, 3), u: "m/s" },
            { k: "Caudal de la sección Q′", v: fmt(r.Q1, 4), u: "m³/s" },
            { k: "Tirante crítico y_c", v: fmt(r.yc1, 4), u: "m" },
            { k: "Pendiente crítica S_c", v: fmt(r.Sc1, 5), u: "m/m" },
            { k: "Froude Fr₁", v: fmt(r.Fr1, 3), u: "—" },
            { k: "Régimen", v: r.regimenEnt },
            { k: "Borde libre", v: fmt(r.BL1, 3), u: "m" },
          ],
        },
        {
          type: "check",
          ok: r.Sc1 < inp.Sentrada,
          text: `S_c = ${fmt(r.Sc1, 5)} ${r.Sc1 < inp.Sentrada ? "<" : ">"} S = ${fmt(inp.Sentrada, 4)} → el canal de entrada trabaja en régimen ${r.regimenEnt}.`,
        },
        { type: "h2", text: "4. Canal de salida" },
        {
          type: "kv",
          rows: [
            { k: "b de salida", v: fmt(inp.bSalida, 2), u: "m" },
            { k: "Pendiente S₆", v: fmt(inp.Ssalida, 4), u: "m/m" },
            { k: "Tirante normal y₆", v: fmt(r.y6, 4), u: "m" },
            { k: "Velocidad V₆", v: fmt(r.V6, 3), u: "m/s" },
            { k: "Froude Fr₆", v: fmt(r.Fr6, 3), u: "—" },
            { k: "Régimen", v: r.regimenSal },
            { k: "Borde libre", v: fmt(r.BL6, 3), u: "m" },
          ],
        },
        { type: "h2", text: "5. Diámetro de la tubería" },
        paso(
          "5.1",
          "Diámetro teórico y comercial",
          "A = Q / V     ·     D = √(4A / π)",
          `A = ${fmt(inp.Q, 3)} / ${fmt(inp.Vdiseno, 2)} = ${fmt(inp.Q / Math.max(inp.Vdiseno, 1e-6), 4)} m²
D_req = √(4A/π) = ${fmt(r.Dreq, 3)} m    →    comercial ${Dsug}\"`,
          `D adoptado = ${r.Dpulg}\" = ${fmt(r.D, 3)} m    ·    A_t = ${fmt(r.At, 4)} m²    ·    V_t = ${fmt(r.Vt, 3)} m/s    ·    h_t = V²/2g = ${fmt(r.ht, 4)} m`,
          "V de 1.5 a 3.0 m/s evita sedimentación y cavitación. Si D comercial = 0 en datos, se toma el inmediatamente superior al teórico."
        ),
        {
          type: "check",
          ok: r.Vok,
          text: `V_t = ${fmt(r.Vt, 3)} m/s ${r.Vok ? "está" : "no está"} en el rango 1.2–3.5 m/s.`,
        },
        { type: "h2", text: "6. Longitud de transición" },
        { type: "eq", text: "L_t = (T₁ − D) / (2 tan θ)     con θ = 12.5°", num: "3" },
        {
          type: "p",
          text: "Como control adicional, en transiciones tipo alcantarilla se exige L_t ≥ 4D. Se adopta el mayor de ambos criterios, con un mínimo constructivo de 1.00 m.",
        },
        {
          type: "kv",
          rows: [
            { k: "Espejo T₁", v: fmt(r.T1, 3), u: "m" },
            { k: "L_t geométrica", v: fmt(r.LtGeom, 3), u: "m" },
            { k: "L_t ≥ 4D", v: fmt(r.LtAlcant, 3), u: "m" },
            { k: "Longitud de transición adoptada", v: fmt(r.Lt, 2), u: "m" },
          ],
        },
        { type: "h2", text: "7. Sello de agua y cotas de fondo" },
        {
          type: "p",
          text: "El sello evita ingreso de aire. Se toma el mayor entre 1.1 h_t, 1.5 h_t (límites de literatura) y 3\" (0.075 m) como mínimo constructivo. La profundidad de la clave respecto al NA no debe exceder 3/4 D en entrada ni D/2 en salida.",
        },
        {
          type: "kv",
          rows: [
            { k: "1.1 h_t", v: fmt(1.1 * r.ht, 4), u: "m" },
            { k: "1.5 h_t", v: fmt(1.5 * r.ht, 4), u: "m" },
            { k: "Mínimo 3\"", v: "0.075", u: "m" },
            { k: "Sello adoptado", v: fmt(r.sello, 3), u: "m" },
            { k: "Cota de fondo canal (1)", v: fmt(inp.cotaFondoEntrada, 3), u: "msnm" },
            { k: "Cota de nivel de agua (1)", v: fmt(r.cotaNA1, 3), u: "msnm" },
            { k: "Cota de fondo tubo en (2)", v: fmt(r.cotaFondo2, 3), u: "msnm" },
            { k: "Cota de fondo en (3) — pie de rampa", v: fmt(r.cota3, 3), u: "msnm" },
            { k: "Cota de fondo en (4) — tramo horizontal", v: fmt(r.cota4, 3), u: "msnm" },
            { k: "Cota teórica en (5)", v: fmt(r.cota5Teorica, 3), u: "msnm" },
            { k: "Cota de salida de campo", v: r.usaCotaCampo ? fmt(inp.cotaFondoSalida, 3) : "no ingresada", u: "msnm" },
            { k: "Desvío campo − teórico", v: fmt(r.desvioCotaSalida, 3), u: "m" },
            { k: "Cota de fondo en (5) adoptada", v: fmt(r.cota5, 3), u: "msnm" },
            { k: "P entrada = sello + h_t", v: fmt(r.Pentrada, 3), u: "m" },
            { k: "P máx entrada (3/4 D)", v: fmt(r.PmaxEnt, 3), u: "m" },
            { k: "P máx salida (D/2)", v: fmt(r.PmaxSal, 3), u: "m" },
          ],
        },
        {
          type: "check",
          ok: r.cumpleP,
          text: r.cumpleP
            ? `P = ${fmt(r.Pentrada, 3)} m ≤ ¾D = ${fmt(r.PmaxEnt, 3)} m.`
            : `P = ${fmt(r.Pentrada, 3)} m > ¾D = ${fmt(r.PmaxEnt, 3)} m. Aumentar D o reducir el sello/ángulo de ingreso.`,
        },
        {
          type: "check",
          ok: r.cumpleCotaCampo,
          text: r.usaCotaCampo
            ? r.cumpleCotaCampo
              ? `La cota de campo desvía ${fmt(Math.abs(r.desvioCotaSalida), 3)} m respecto del perfil teórico (tolerancia 0.15 m).`
              : `Desvío de ${fmt(Math.abs(r.desvioCotaSalida), 3)} m > 0.15 m. Ajustar rampas o replantear la topografía.`
            : "Falta la cota de salida de campo. El balance de energía usa solo el perfil teórico.",
        },
        { type: "h2", text: "8. Inclinación de rampas" },
        {
          type: "p",
          text: "Las rampas deben ser más planas que 2H:1V para permitir inspección y reducir pérdidas de entrada/salida.",
        },
        {
          type: "kv",
          rows: [
            { k: "Ángulo de ingreso", v: fmt(inp.thetaEntDeg, 1), u: "°" },
            { k: "Inclinación de ingreso", v: `${fmt(r.inclinEnt, 2)} : 1`, u: "H:V" },
            { k: "Ángulo de salida", v: fmt(inp.thetaSalDeg, 1), u: "°" },
            { k: "Inclinación de salida", v: `${fmt(r.inclinSal, 2)} : 1`, u: "H:V" },
          ],
        },
        {
          type: "check",
          ok: r.cumpleIncl,
          text: r.cumpleIncl
            ? "Ambas rampas son más planas que 2:1. Se aceptan."
            : "Alguna rampa es más empinada que 2:1. Suavizar el ángulo.",
        },
        { type: "h2", text: "9. Balance de energía" },
        { type: "eq", text: "h_e = K_e V²/2g     ·     h_s = K_s V²/2g     ·     h_f = f L V² / (D · 2g)", num: "4" },
        { type: "eq", text: "Σh = h_e + h_s + h_f + n_codos · K_c · V²/2g   ≤   H_disponible", num: "5" },
        paso(
          "9.1",
          "Pérdidas y carga disponible",
          "Σh = h_e + h_s + h_f + Σh_codos",
          `h_e = ${fmt(inp.Ke, 2)}×${fmt(r.ht, 4)} = ${fmt(r.he, 4)} m
h_s = ${fmt(inp.Ks, 2)}×${fmt(r.ht, 4)} = ${fmt(r.hs, 4)} m
h_f = ${fmt(inp.fDarcy, 3)} × ${fmt(r.Ltotal, 2)} × V² / (D · 2g) = ${fmt(r.hf, 4)} m
h_codos = ${fmt(inp.nCodos, 0)} × ${fmt(inp.Kcodo, 2)} × ${fmt(r.ht, 4)} = ${fmt(r.hcodos, 4)} m`,
          `Σh = ${fmt(r.hperd, 4)} m    ·    H_disp (cota de campo) = ${fmt(r.hdisp, 4)} m    ·    H_disp teórica = ${fmt(r.hdispTeorico, 4)} m`,
          r.cumpleEnergia
            ? "H_disp ≥ Σh: el sifón entrega el caudal de diseño con margen energético."
            : "H_disp < Σh: aumentar D, acortar L, reducir K o elevar la carga de llegada."
        ),
        {
          type: "check",
          ok: r.cumpleEnergia,
          text: r.cumpleEnergia
            ? `H disponible (${fmt(r.hdisp, 3)} m) ≥ Σh (${fmt(r.hperd, 3)} m). El sifón descarga el caudal de diseño.`
            : `H disponible (${fmt(r.hdisp, 3)} m) < Σh (${fmt(r.hperd, 3)} m). Aumentar D, acortar L o elevar la carga.`,
        },
        { type: "h2", text: "10. Conclusión" },
        {
          type: "p",
          text: `Se proyecta sifón invertido de Ø ${r.Dpulg}\" (${fmt(r.D, 3)} m), transiciones de ${fmt(r.Lt, 2)} m, sello de ${fmt(r.sello, 3)} m y tubería de ${fmt(r.Ltotal, 1)} m. Velocidad ${fmt(r.Vt, 2)} m/s. ${r.cumpleEnergia && r.Vok && r.cumpleIncl ? "El diseño cumple capacidad, sello e inclinaciones." : "Revisar los ítems que no cumplen antes de proceder a planos."}`,
        },
      ],
    }),
    [inp, meta, r, Dsug]
  );
  const livePack = useMemo(() => ({ doc, r, inp }), [doc, r, inp]);
  const { doc: pack, dirty, calcular } = useMemoriaOnCalcular(livePack);
  const memoria = pack.doc;

  const set = <K extends keyof SifonInput>(k: K, v: SifonInput[K]) => setInp((s) => ({ ...s, [k]: v }));

  return (
    <>
      <aside id="app-panel" className="panel">
        <h2>Sifón invertido</h2>
        <p className="lead">Ejemplo desarrollado. Edite los datos y pulse Calcular para actualizar el informe: canales, diámetro, transiciones y pérdidas.</p>
        <CalcDirtyNote dirty={dirty} />
        <fieldset className="fieldset">
          <legend>Identificación</legend>
          <Field label="Proyecto"><Text value={meta.proyecto} onChange={(v) => setMeta({ ...meta, proyecto: v })} /></Field>
          <Field label="Ubicación"><Text value={meta.ubicacion} onChange={(v) => setMeta({ ...meta, ubicacion: v })} /></Field>
          <Field label="CIP"><Text value={meta.cip} onChange={(v) => setMeta({ ...meta, cip: v })} /></Field>
          <Field label="Origen del caudal">
            <select value={meta.origenQ} onChange={(e) => setMeta({ ...meta, origenQ: e.target.value as OrigenCaudal })}>
              {ORIGEN_Q.filter((o) => o.id !== "racional").map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Justificación de Q"><Text value={meta.justificacionQ} onChange={(v) => setMeta({ ...meta, justificacionQ: v })} /></Field>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Canales</legend>
          <div className="grid-2">
            <Field label="Q" unit="m³/s"><Num value={inp.Q} onChange={(v) => set("Q", v)} /></Field>
            <Field label="n canal"><Num value={inp.nCanal} onChange={(v) => set("nCanal", v)} /></Field>
            <Field label="b entrada" unit="m"><Num value={inp.bEntrada} onChange={(v) => set("bEntrada", v)} /></Field>
            <Field label="b salida" unit="m"><Num value={inp.bSalida} onChange={(v) => set("bSalida", v)} /></Field>
            <Field label="z talud"><Num value={inp.zTalud} onChange={(v) => set("zTalud", v)} /></Field>
            <Field label="S entrada"><Num value={inp.Sentrada} onChange={(v) => set("Sentrada", v)} /></Field>
            <Field label="S salida"><Num value={inp.Ssalida} onChange={(v) => set("Ssalida", v)} /></Field>
            <Field label="Cota fondo 1" unit="msnm"><Num value={inp.cotaFondoEntrada} onChange={(v) => set("cotaFondoEntrada", v)} /></Field>
            <Field label="Cota fondo salida" unit="msnm"><Num value={inp.cotaFondoSalida} onChange={(v) => set("cotaFondoSalida", v)} /></Field>
          </div>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Tubería</legend>
          <div className="grid-2">
            <Field label="V diseño" unit="m/s"><Num value={inp.Vdiseno} onChange={(v) => set("Vdiseno", v)} /></Field>
            <Field label="D comercial" unit="pulg">
              <Num value={inp.Dpulg} onChange={(v) => set("Dpulg", v)} step="1" />
            </Field>
            <Field label="θ ingreso" unit="°"><Num value={inp.thetaEntDeg} onChange={(v) => set("thetaEntDeg", v)} /></Field>
            <Field label="θ salida" unit="°"><Num value={inp.thetaSalDeg} onChange={(v) => set("thetaSalDeg", v)} /></Field>
            <Field label="L rampa ent." unit="m"><Num value={inp.LinclinadaEnt} onChange={(v) => set("LinclinadaEnt", v)} /></Field>
            <Field label="L horizontal" unit="m"><Num value={inp.Lhorizontal} onChange={(v) => set("Lhorizontal", v)} /></Field>
            <Field label="L rampa sal." unit="m"><Num value={inp.LinclinadaSal} onChange={(v) => set("LinclinadaSal", v)} /></Field>
            <Field label="S tubo" unit="m/m"><Num value={inp.Stubo} onChange={(v) => set("Stubo", v)} /></Field>
            <Field label="f Darcy"><Num value={inp.fDarcy} onChange={(v) => set("fDarcy", v)} /></Field>
            <Field label="K entrada"><Num value={inp.Ke} onChange={(v) => set("Ke", v)} /></Field>
            <Field label="K salida"><Num value={inp.Ks} onChange={(v) => set("Ks", v)} /></Field>
            <Field label="N° codos"><Num value={inp.nCodos} onChange={(v) => set("nCodos", v)} step="1" /></Field>
            <Field label="K codo"><Num value={inp.Kcodo} onChange={(v) => set("Kcodo", v)} /></Field>
            <Field label="Recubrimiento" unit="m"><Num value={inp.recubrimiento} onChange={(v) => set("recubrimiento", v)} /></Field>
            <Field label="Válvulas de aire"><Num value={inp.nAire} onChange={(v) => set("nAire", v)} step="1" /></Field>
            <Field label="Cámaras de limpia"><Num value={inp.nLimpia} onChange={(v) => set("nLimpia", v)} step="1" /></Field>
          </div>
          <Field label="Material"><Text value={inp.material} onChange={(v) => set("material", v)} /></Field>
          <Field label="Clase / PN"><Text value={inp.claseTubo} onChange={(v) => set("claseTubo", v)} /></Field>
          <p className="lead">Si D comercial = 0, se adopta el diámetro sugerido ({Dsug}\"). La cota de salida de campo gobierna H_disp.</p>
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
          <>
            <SifonSvg D={pack.r.D} Lh={pack.inp.Lhorizontal} Le={pack.inp.LinclinadaEnt} Ls={pack.inp.LinclinadaSal} />
            <CanalTrapezSvg b={pack.inp.bEntrada} y={pack.r.y1} z={pack.inp.zTalud} BL={pack.r.BL1} />
          </>
        }
      />
      ) : <MemoriaPendiente />}
    </>
  );
}
