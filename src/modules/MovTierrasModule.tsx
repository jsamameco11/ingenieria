import { useMemo, useState } from "react";
import {
  calcularSeccion,
  calcularVolumenes,
  ESTACIONES_ARVOL,
  fmtPk,
  TERRENO_HEBMERMA,
  TERRENO_LADERA,
  textoH,
  type Estacion,
  type PerfilVia,
  type Pt,
  type SeccionInput,
} from "../lib/movtierras";
import { fmt } from "../lib/num";
import { paso, type MemoriaDoc } from "../lib/memoria";
import { Field, Num, Text } from "../ui/Field";
import { CalcDirtyNote, CalcularButton, MemoriaPendiente, useMemoriaOnCalcular } from "../ui/calcular";
import { Paper } from "../ui/Paper";
import { DiagramaMasasSvg, SeccionMovSvg } from "../ui/movtierrasSvg";
import { exportarWord } from "../lib/exportWord";
import { printMemoria } from "../lib/printDoc";

function nSafe(v: number, fb: number) {
  return Number.isFinite(v) ? v : fb;
}

export function MovTierrasModule({ modo }: { modo: "seccion" | "volumenes" }) {
  return modo === "seccion" ? <SeccionView /> : <VolumenesView />;
}

function SeccionView() {
  const [meta, setMeta] = useState({
    proyecto: "Carretera / acceso vial",
    progresiva: "0+100",
    profesional: "Ingeniero civil",
  });
  const [inp, setInp] = useState<SeccionInput>({
    zr: 1589.4,
    B: 7,
    berma: 0.5,
    pTrans: 2,
    perfil: "bombeo",
    nCorte: 1,
    nRelleno: 1.5,
    terreno: TERRENO_LADERA.map((p) => ({ ...p })),
  });
  const r = useMemo(() => calcularSeccion(inp), [inp]);
  const set = <K extends keyof SeccionInput>(k: K, v: SeccionInput[K]) => setInp((s) => ({ ...s, [k]: v }));

  const setPt = (i: number, patch: Partial<Pt>) => {
    setInp((s) => {
      const terreno = s.terreno.map((p, j) => (j === i ? { ...p, ...patch } : p));
      return { ...s, terreno };
    });
  };

  const doc: MemoriaDoc = useMemo(
    () => ({
      codigo: "MOV-SEC-01",
      titulo: "Sección transversal de movimiento de tierras",
      norma: "MTC DG-2018 · áreas por trapecios",
      blocks: [
        {
          type: "cover",
          kicker: "Movimiento de tierras",
          titulo: "Sección transversal para carretera",
          subtitulo: `${meta.progresiva}  ·  Ac = ${fmt(r.Ac, 2)} m²  ·  Ar = ${fmt(r.Ar, 2)} m²`,
          meta: [
            { k: "Proyecto", v: meta.proyecto },
            { k: "Progresiva", v: meta.progresiva },
            { k: "Profesional", v: meta.profesional },
          ],
        },
        { type: "h2", text: "1. Criterio" },
        {
          type: "p",
          text: "La sección compara el terreno natural con la subrasante de la vía (calzada, bermas y taludes). Donde el terreno queda por encima de la rasante hay corte; donde queda por debajo, relleno. Las áreas se obtienen por trapecios entre abscisas consecutivas, cortando en el cruce de rasante (método del Excel ARVOL y de la hoja de sección transversal).",
        },
        { type: "eq", text: "h(x) = z_terreno(x) − z_vía(x)", num: "1" },
        { type: "eq", text: "A = Σ ½ (hᵢ + hᵢ₊₁) · Δx    (positivo = corte, negativo = relleno)", num: "2" },
        { type: "eq", text: "Talud n:1  →  Δx = n · Δz     (n horizontal por 1 vertical)", num: "3" },
        { type: "figure", part: "seccion" },
        { type: "h2", text: "2. Datos de la vía" },
        {
          type: "kv",
          rows: [
            { k: "Cota de rasante en el eje", v: fmt(inp.zr, 2), u: "m" },
            { k: "Ancho de calzada B", v: fmt(inp.B, 2), u: "m" },
            { k: "Berma a cada lado", v: fmt(inp.berma, 2), u: "m" },
            {
              k: "Perfil transversal",
              v:
                inp.perfil === "horizontal"
                  ? "Rasante horizontal"
                  : inp.perfil === "bombeo"
                    ? `Bombeo ${fmt(inp.pTrans, 1)} % a ambos lados`
                    : `Peralte ${fmt(inp.pTrans, 1)} %`,
            },
            { k: "Talud de corte", v: `${fmt(inp.nCorte, 2)} : 1`, u: "H:V" },
            { k: "Talud de relleno", v: `${fmt(inp.nRelleno, 2)} : 1`, u: "H:V" },
          ],
        },
        { type: "h2", text: "3. Terreno natural" },
        {
          type: "table",
          caption: "Puntos de la polilínea de terreno (offset respecto al eje, cota)",
          headers: ["Punto", "x (m)", "Cota (m)", "h = z − vía (m)"],
          rows: inp.terreno.map((p, i) => {
            const viaY =
              Math.abs(p.x) <= inp.B / 2 + inp.berma + 0.01
                ? r.via.length
                  ? interpLocal(r.via, p.x)
                  : inp.zr
                : interpLocal(r.via, p.x);
            return [String(i + 1), fmt(p.x, 2), fmt(p.y, 2), fmt(p.y - viaY, 2)];
          }),
        },
        { type: "h2", text: "4. Desarrollo del cálculo" },
        paso(
          "4.1",
          "Rasante en calzada y bermas",
          inp.perfil === "bombeo"
            ? "z(x) = zr − i · |x|     |x| ≤ B/2"
            : inp.perfil === "peralte"
              ? "z(x) = zr − i · x"
              : "z(x) = zr",
          `zr = ${fmt(inp.zr, 2)} m    B = ${fmt(inp.B, 2)} m    i = ${fmt(inp.pTrans / 100, 4)}`,
          `Borde izq ${fmt(r.pavL.x, 2)} m → ${fmt(r.pavL.y, 2)} m    ·    borde der ${fmt(r.pavR.x, 2)} m → ${fmt(r.pavR.y, 2)} m`,
          "El bombéo (2 % típico) baja ambos hombros respecto del eje. El peralte se usa en curva."
        ),
        paso(
          "4.2",
          "Intersección de taludes con el terreno (puntos de catch)",
          "Desde el extremo de berma se dispara el talud de corte (hacia arriba) o de relleno (hacia abajo) hasta cortar la polilínea del terreno.",
          `n_corte = ${fmt(inp.nCorte, 2)}    n_relleno = ${fmt(inp.nRelleno, 2)}    berma = ${fmt(inp.berma, 2)} m`,
          `Catch izq (${fmt(r.catchL.x, 2)} ; ${fmt(r.catchL.y, 2)})    ·    catch der (${fmt(r.catchR.x, 2)} ; ${fmt(r.catchR.y, 2)})    ·    ancho de obras ${fmt(r.anchoObras, 2)} m`,
          "Si el terreno ya coincide con la berma, no hay talud. El Excel ARVOL dibuja estos laterales para AutoCAD (hojas PLINEAS / TEXTOS)."
        ),
        paso(
          "4.3",
          "Áreas de corte y relleno por trapecios",
          "Entre cada par de abscisas: si h no cambia de signo, A = ½(h₁+h₂)Δx. Si cruza cero, se parte en el punto de rasante.",
          `Eje: ${textoH(r.hEje)}    ·    hombro izq: ${textoH(r.hIzq)}    ·    hombro der: ${textoH(r.hDer)}`,
          `Ac = ${fmt(r.Ac, 2)} m²    ·    Ar = ${fmt(r.Ar, 2)} m²`,
          "Para 1.00 m de vía estas áreas coinciden numéricamente con un «volumen» de 1 m³ por metro. El Excel de sección deja las celdas de volumen para completarlas con el área × longitud del tramo."
        ),
        {
          type: "table",
          caption: "Franjas con área ≥ 0.05 m²",
          headers: ["De x", "A x", "Tipo", "Área (m²)"],
          rows: r.franjas
            .filter((f) => f.area >= 0.05)
            .map((f) => [fmt(f.x1, 2), fmt(f.x2, 2), f.kind === "corte" ? "Corte" : "Relleno", fmt(f.area, 2)]),
        },
        { type: "h2", text: "5. Lectura de la sección" },
        {
          type: "check",
          ok: r.Ac + r.Ar > 0.05,
          text: `Áreas obtenidas: corte ${fmt(r.Ac, 2)} m² y relleno ${fmt(r.Ar, 2)} m².`,
        },
        {
          type: "p",
          text:
            r.Ac >= r.Ar
              ? `En ${meta.progresiva} gobierna el corte (ladera arriba a la izquierda en el ejemplo). El material excavado se lleva a rellenos aguas abajo o a depósito, con el factor de esponjamiento del módulo de volúmenes.`
              : `En ${meta.progresiva} gobierna el relleno. Habrá que traer material de un corte cercano o de un préstamo, compactado al Fc del módulo de volúmenes.`,
        },
        { type: "h2", text: "6. Adopción" },
        {
          type: "p",
          text: `Sección ${meta.progresiva}: calzada ${fmt(inp.B, 2)} m, bermas ${fmt(inp.berma, 2)} m, taludes ${fmt(inp.nCorte, 1)}:1 (corte) y ${fmt(inp.nRelleno, 1)}:1 (relleno). Ac = ${fmt(r.Ac, 2)} m², Ar = ${fmt(r.Ar, 2)} m². Ancho de obras ${fmt(r.anchoObras, 2)} m.`,
        },
        {
          type: "note",
          text: "Verificar taludes con el estudio de suelos (φ, c) y con la DG-2018 del MTC antes de fijar n. En roca el talud de corte puede ser 0.25:1 a 0.5:1; en suelos flojos 1.5:1 a 2:1.",
        },
      ],
    }),
    [inp, meta, r]
  );
  const livePack = useMemo(() => ({ doc, r, inp, meta }), [doc, r, inp, meta]);
  const { doc: pack, dirty, calcular } = useMemoriaOnCalcular(livePack);
  const memoria = pack.doc;

  return (
    <>
      <aside id="app-panel" className="panel">
        <h2>Sección transversal</h2>
        <p className="lead">Ejemplo desarrollado. Edite el terreno o la rasante y pulse Calcular para actualizar el informe (corte, relleno y taludes).</p>
        <CalcDirtyNote dirty={dirty} />
        <fieldset className="fieldset">
          <legend>Identificación</legend>
          <Field label="Proyecto">
            <Text value={meta.proyecto} onChange={(v) => setMeta({ ...meta, proyecto: v })} />
          </Field>
          <Field label="Progresiva">
            <Text value={meta.progresiva} onChange={(v) => setMeta({ ...meta, progresiva: v })} />
          </Field>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Vía</legend>
          <div className="grid-2">
            <Field label="Cota rasante" unit="m">
              <Num value={inp.zr} onChange={(v) => set("zr", nSafe(v, inp.zr))} step="0.01" />
            </Field>
            <Field label="Calzada B" unit="m">
              <Num value={inp.B} onChange={(v) => set("B", nSafe(v, inp.B))} step="0.1" />
            </Field>
            <Field label="Berma" unit="m">
              <Num value={inp.berma} onChange={(v) => set("berma", nSafe(v, inp.berma))} step="0.1" />
            </Field>
            <Field label="Pend. transv." unit="%">
              <Num value={inp.pTrans} onChange={(v) => set("pTrans", nSafe(v, inp.pTrans))} step="0.1" />
            </Field>
            <Field label="Talud corte" unit="H:1">
              <Num value={inp.nCorte} onChange={(v) => set("nCorte", nSafe(v, inp.nCorte))} step="0.1" />
            </Field>
            <Field label="Talud relleno" unit="H:1">
              <Num value={inp.nRelleno} onChange={(v) => set("nRelleno", nSafe(v, inp.nRelleno))} step="0.1" />
            </Field>
          </div>
          <Field label="Perfil">
            <select value={inp.perfil} onChange={(e) => set("perfil", e.target.value as PerfilVia)}>
              <option value="bombeo">Bombeo (ambos lados)</option>
              <option value="peralte">Peralte de curva</option>
              <option value="horizontal">Rasante horizontal</option>
            </select>
          </Field>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Terreno (offset, cota)</legend>
          <div className="chips">
            <button type="button" className="chip" onClick={() => set("terreno", TERRENO_LADERA.map((p) => ({ ...p })))}>
              Ladera tipo
            </button>
            <button
              type="button"
              className="chip"
              onClick={() =>
                setInp((s) => ({
                  ...s,
                  zr: 1589.4,
                  B: 7,
                  berma: 0.5,
                  perfil: "horizontal",
                  terreno: TERRENO_HEBMERMA.map((p) => ({ ...p })),
                }))
              }
            >
              Ejemplo Excel 0+100
            </button>
          </div>
          <table className="mini-table">
            <thead>
              <tr>
                <th>x</th>
                <th>cota</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {inp.terreno.map((p, i) => (
                <tr key={i}>
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      value={p.x}
                      onChange={(e) => setPt(i, { x: parseFloat(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={p.y}
                      onChange={(e) => setPt(i, { y: parseFloat(e.target.value) })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => setInp((s) => ({ ...s, terreno: s.terreno.filter((_, j) => j !== i) }))}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="chip"
            onClick={() =>
              setInp((s) => {
                const last = s.terreno[s.terreno.length - 1] ?? { x: 0, y: s.zr };
                return { ...s, terreno: [...s.terreno, { x: last.x + 2, y: last.y }] };
              })
            }
          >
            + punto
          </button>
        </fieldset>
        <div className="actions">
          <CalcularButton onClick={calcular} dirty={dirty} />
          <button className="btn" disabled={!memoria} onClick={() => memoria && exportarWord(memoria)}>
            Exportar Word
          </button>
          <button className="btn secondary" disabled={!memoria} onClick={() => memoria && printMemoria(memoria.titulo)}>
            Imprimir / PDF
          </button>
        </div>
      </aside>
      {memoria ? <Paper
        doc={memoria}
        renderFigure={(part) =>
          part === "seccion" ? (
            <SeccionMovSvg r={pack.r} zr={pack.inp.zr} B={pack.inp.B} nCorte={pack.inp.nCorte} nRelleno={pack.inp.nRelleno} pkLabel={pack.meta.progresiva} />
          ) : null
        }
      /> : <MemoriaPendiente />}
    </>
  );
}

function interpLocal(poly: Pt[], x: number) {
  if (!poly.length) return 0;
  if (x <= poly[0].x) return poly[0].y;
  if (x >= poly[poly.length - 1].x) return poly[poly.length - 1].y;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + t * (b.y - a.y);
    }
  }
  return poly[poly.length - 1].y;
}

function VolumenesView() {
  const [meta, setMeta] = useState({
    proyecto: "Acceso al CAL-7 (ejemplo ARVOL)",
    tramo: "km 0+000 – 0+160",
    profesional: "Ingeniero civil",
  });
  const [Fe, setFe] = useState(1.25);
  const [Fc, setFc] = useState(0.9);
  const [estaciones, setEstaciones] = useState<Estacion[]>(ESTACIONES_ARVOL.map((e) => ({ ...e })));
  const r = useMemo(() => calcularVolumenes({ estaciones, Fe, Fc }), [estaciones, Fe, Fc]);

  const setEst = (i: number, patch: Partial<Estacion>) => {
    setEstaciones((rows) => rows.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  };

  const doc: MemoriaDoc = useMemo(
    () => ({
      codigo: "MOV-VOL-01",
      titulo: "Cálculo de volúmenes de movimiento de tierras",
      norma: "MTC DG-2018 · promedio de áreas extremas",
      blocks: [
        {
          type: "cover",
          kicker: "Movimiento de tierras",
          titulo: "Volúmenes de corte y relleno",
          subtitulo: `${meta.tramo}  ·  Vc = ${fmt(r.Vc, 1)} m³  ·  Vr = ${fmt(r.Vr, 1)} m³`,
          meta: [
            { k: "Proyecto", v: meta.proyecto },
            { k: "Tramo", v: meta.tramo },
            { k: "Profesional", v: meta.profesional },
          ],
        },
        { type: "h2", text: "1. Criterio" },
        {
          type: "p",
          text: "Entre dos secciones se usa el promedio de áreas extremas (método de las áreas medias), el mismo del Excel ARVOL de cálculo de volúmenes: el volumen del prisma es el área media por la distancia entre progresivas. No se requiere la sección de mitad de tramo. El prismoidal (L/6)(A₁+4Am+A₂) se reserva cuando hay sección intermedia; si Am = (A₁+A₂)/2 ambos coinciden.",
        },
        { type: "eq", text: "V = ½ (Aᵢ + Aᵢ₊₁) · Lᵢ", num: "1" },
        { type: "eq", text: "V_suelto = Vc · Fe     ·     V_compactado = Vc · Fc", num: "2" },
        { type: "eq", text: "Préstamo = máx(0, Vr − Vc·Fc)     ·     Desmonte = máx(0, Vc·Fc − Vr)", num: "3" },
        { type: "h2", text: "2. Factores del material" },
        {
          type: "kv",
          rows: [
            { k: "Factor de esponjamiento Fe", v: fmt(Fe, 2), u: "banco → suelto", hint: "Típico 1.20–1.40 en material común." },
            { k: "Factor banco-compactado Fc", v: fmt(Fc, 2), u: "banco → compacto", hint: "Típico 0.80–0.95. El relleno se mide compactado." },
            { k: "Longitud del tramo", v: fmt(r.L, 2), u: "m" },
            { k: "Estaciones", v: String(estaciones.length) },
          ],
        },
        { type: "h2", text: "3. Desarrollo del cálculo" },
        paso(
          "3.1",
          "Volumen de un tramo (áreas medias)",
          "Vcᵢ = ½ (Acᵢ + Acᵢ₊₁) Lᵢ     ·     Vrᵢ = ½ (Arᵢ + Arᵢ₊₁) Lᵢ",
          r.tramos[0]
            ? `Tramo 1: Ac = ${fmt(r.tramos[0].Ac1, 2)} y ${fmt(r.tramos[0].Ac2, 2)} m²    L = ${fmt(r.tramos[0].L, 2)} m`
            : "—",
          r.tramos[0]
            ? `Vc₁ = ${fmt(r.tramos[0].Vc, 1)} m³    ·    Vr₁ = ${fmt(r.tramos[0].Vr, 1)} m³`
            : "Ingrese al menos dos estaciones",
          r.tramos[0]
            ? `Comprobación ARVOL: (${fmt(r.tramos[0].Ac1, 2)} + ${fmt(r.tramos[0].Ac2, 2)}) / 2 × ${fmt(r.tramos[0].L, 2)} = ${fmt(r.tramos[0].Vc, 2)} m³.`
            : undefined
        ),
        {
          type: "table",
          caption: "Volúmenes parciales y acumulados (m³)",
          headers: ["De", "A", "L (m)", "Ac med (m²)", "Ar med (m²)", "Vc (m³)", "Vr (m³)"],
          rows: r.tramos.map((t) => [
            fmtPk(t.pk1),
            fmtPk(t.pk2),
            fmt(t.L, 2),
            fmt((t.Ac1 + t.Ac2) / 2, 2),
            fmt((t.Ar1 + t.Ar2) / 2, 2),
            fmt(t.Vc, 1),
            fmt(t.Vr, 1),
          ]),
        },
        paso(
          "3.2",
          "Totales de corte y relleno",
          "Vc = Σ Vcᵢ     ·     Vr = Σ Vrᵢ",
          `${r.tramos.length} tramos    ·    L = ${fmt(r.L, 2)} m`,
          `Vc = ${fmt(r.Vc, 1)} m³    ·    Vr = ${fmt(r.Vr, 1)} m³`,
          "El corte se expresa en banco (terreno natural). El relleno se expresa compactado en el cuerpo de la vía."
        ),
        paso(
          "3.3",
          "Esponjamiento, compactación, préstamo y desmonte",
          "Suelto = Vc·Fe     Compactado = Vc·Fc     Préstamo = Vr − Vc·Fc     (si > 0)",
          `Fe = ${fmt(Fe, 2)}    Fc = ${fmt(Fc, 2)}    Vc·Fc = ${fmt(r.Vcompact, 1)} m³    Vr = ${fmt(r.Vr, 1)} m³`,
          r.prestamo > r.desmonte
            ? `Falta material: préstamo ${fmt(r.prestamo, 1)} m³`
            : `Sobra material: desmonte / depósito ${fmt(r.desmonte, 1)} m³`,
          "Fe convierte banco a estado suelto (acarreo). Fc convierte banco a estado compactado (lo que realmente llena el relleno). No se usa Fe para el balance de masas."
        ),
        { type: "figure", part: "masas" },
        {
          type: "p",
          text: "El diagrama de masas (Brückner) acumula (Vc·Fc − Vr). Arriba de cero hay exceso de corte (acarreo hacia adelante o depósito). Debajo, déficit que exige préstamo o acarreo desde atrás. Los tramos horizontales entre dos cortes con la línea cero marcan el acarreo libre.",
        },
        {
          type: "table",
          caption: "Ordenadas del diagrama de masas",
          headers: ["Progresiva", "M = Σ(Vc−Vr) m³", "M* = Σ(Vc·Fc−Vr) m³"],
          rows: r.masas.map((m) => [fmtPk(m.pk), fmt(m.M, 1), fmt(m.Madj, 1)]),
        },
        { type: "h2", text: "4. Verificaciones" },
        {
          type: "check",
          ok: r.tramos.length > 0,
          text: `Se calcularon ${r.tramos.length} tramos entre ${estaciones.length} estaciones.`,
        },
        {
          type: "check",
          ok: Fe >= 1 && Fe <= 1.6,
          text: `Fe = ${fmt(Fe, 2)} (rango usual 1.10 a 1.50 en suelos comunes).`,
        },
        {
          type: "check",
          ok: Fc > 0.7 && Fc <= 1,
          text: `Fc = ${fmt(Fc, 2)} (el compactado no puede superar el banco si hay contracción).`,
        },
        { type: "h2", text: "5. Adopción y metrados" },
        {
          type: "p",
          text: `En ${meta.tramo}: corte en banco ${fmt(r.Vc, 0)} m³, relleno compactado ${fmt(r.Vr, 0)} m³. Material de corte aprovechable compactado ${fmt(r.Vcompact, 0)} m³. ${
            r.prestamo > 0.5
              ? `Se requiere préstamo de ${fmt(r.prestamo, 0)} m³.`
              : `El corte cubre el relleno; desmonte ${fmt(r.desmonte, 0)} m³ a depósito.`
          } Acarreo en estado suelto: ${fmt(r.Vsuelto, 0)} m³.`,
        },
        {
          type: "note",
          text: "Los metrados de corte, relleno, préstamo y desmonte deben cuadrar con el presupuesto (partidas 02.00 movimiento de tierras). Verificar contra topografía de obra y contra la DG-2018 vigente.",
        },
      ],
    }),
    [estaciones, Fe, Fc, meta, r]
  );
  const livePack = useMemo(() => ({ doc, r }), [doc, r]);
  const { doc: pack, dirty, calcular } = useMemoriaOnCalcular(livePack);
  const memoria = pack.doc;

  return (
    <>
      <aside id="app-panel" className="panel">
        <h2>Volúmenes</h2>
        <p className="lead">Ejemplo ARVOL desarrollado. Edite las estaciones y pulse Calcular para actualizar el informe (masas y balance).</p>
        <CalcDirtyNote dirty={dirty} />
        <fieldset className="fieldset">
          <legend>Identificación</legend>
          <Field label="Proyecto">
            <Text value={meta.proyecto} onChange={(v) => setMeta({ ...meta, proyecto: v })} />
          </Field>
          <Field label="Tramo">
            <Text value={meta.tramo} onChange={(v) => setMeta({ ...meta, tramo: v })} />
          </Field>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Material</legend>
          <div className="grid-2">
            <Field label="Esponjamiento Fe">
              <Num value={Fe} onChange={(v) => setFe(nSafe(v, Fe))} step="0.01" />
            </Field>
            <Field label="Banco→compacto Fc">
              <Num value={Fc} onChange={(v) => setFc(nSafe(v, Fc))} step="0.01" />
            </Field>
          </div>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Estaciones (PK, Ac, Ar)</legend>
          <div className="chips">
            <button type="button" className="chip" onClick={() => setEstaciones(ESTACIONES_ARVOL.map((e) => ({ ...e })))}>
              Ejemplo ARVOL
            </button>
          </div>
          <table className="mini-table">
            <thead>
              <tr>
                <th>PK m</th>
                <th>Ac</th>
                <th>Ar</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {estaciones.map((e, i) => (
                <tr key={i}>
                  <td>
                    <input
                      type="number"
                      step="1"
                      value={e.pk}
                      onChange={(ev) => setEst(i, { pk: parseFloat(ev.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={e.Ac}
                      onChange={(ev) => setEst(i, { Ac: parseFloat(ev.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={e.Ar}
                      onChange={(ev) => setEst(i, { Ar: parseFloat(ev.target.value) })}
                    />
                  </td>
                  <td>
                    <button type="button" className="chip" onClick={() => setEstaciones((rows) => rows.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="chip"
            onClick={() =>
              setEstaciones((rows) => {
                const last = rows[rows.length - 1] ?? { pk: 0, Ac: 0, Ar: 0 };
                return [...rows, { pk: last.pk + 20, Ac: last.Ac, Ar: last.Ar }];
              })
            }
          >
            + estación
          </button>
        </fieldset>
        <div className="actions">
          <CalcularButton onClick={calcular} dirty={dirty} />
          <button className="btn" disabled={!memoria} onClick={() => memoria && exportarWord(memoria)}>
            Exportar Word
          </button>
          <button className="btn secondary" disabled={!memoria} onClick={() => memoria && printMemoria(memoria.titulo)}>
            Imprimir / PDF
          </button>
        </div>
      </aside>
      {memoria ? <Paper
        doc={memoria}
        extra={
          pack.r.tramos[0] ? (
            <div className="note">
              Primer tramo: ½ ({fmt(pack.r.tramos[0].Ac1, 2)} + {fmt(pack.r.tramos[0].Ac2, 2)}) × {fmt(pack.r.tramos[0].L, 1)} ={" "}
              {fmt(pack.r.tramos[0].Vc, 1)} m³ de corte. Totales Vc = {fmt(pack.r.Vc, 0)} m³ · Vr = {fmt(pack.r.Vr, 0)} m³.
            </div>
          ) : null
        }
        renderFigure={(part) => (part === "masas" ? <DiagramaMasasSvg r={pack.r} /> : null)}
      /> : <MemoriaPendiente />}
    </>
  );
}
