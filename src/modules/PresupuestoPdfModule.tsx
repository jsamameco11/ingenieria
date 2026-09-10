import { useMemo, useState } from "react";
import { PDF_SOLES, generarDesdePlanos, registerPayment } from "../lib/billing";
import { printMemoria } from "../lib/printDoc";
import { fusionarLecturas, llamarGrok, partidasDeEspecialidad } from "../lib/planos/cliente";
import { MAX_HOJAS_COBRO, MAX_PAGINAS, claveArchivoPdf, contarHojasPdf, rasterizarPdfs } from "../lib/planos/rasterPdf";
import type { LecturaGrok, LotePdf } from "../lib/planos/types";
import { calcularPresupuesto } from "../lib/presupuesto/engine";
import type { PresupuestoState } from "../lib/presupuesto/types";
import {
  CATEGORIA_MINSA_META,
  CATEGORIAS_MINSA,
  detectarCategoriaMinsa,
  esCategoriaMinsa,
  type CategoriaMinsa,
} from "../lib/presupuesto/categoriasMinsa";
import {
  CATEGORIA_PLANTILLA_META,
  PLANTILLAS,
  especialidadesDeTipo,
  identificarPlantilla,
  plantillaPorId,
  type CategoriaPlantilla,
} from "../lib/presupuesto/plantillas";
import { ESPECIALIDAD_META, ESPECIALIDADES, type EspecialidadPre } from "../lib/presupuesto/types";
import { useAuth } from "../ui/AuthProvider";
import { PayBox } from "../ui/PayBox";
import { EXPEDIENTE_PDF_HOJAS, PresupuestoPrint } from "./PresupuestoPrint";

function loteId() {
  return `lote-${Math.random().toString(36).slice(2, 9)}`;
}

function loteVacio(especialidad: EspecialidadPre = "electricas"): LotePdf {
  return { id: loteId(), especialidad, files: [] };
}

export function PresupuestoPdfModule() {
  const { user, session, profile, openGoogle, refreshPlan } = useAuth();
  const [obra, setObra] = useState("");
  const [cliente, setCliente] = useState("");
  const [lugar, setLugar] = useState("");
  const [tipoProyecto, setTipoProyecto] = useState<CategoriaPlantilla | "">("");
  const [plantillaId, setPlantillaId] = useState("");
  const [categoriaMinsa, setCategoriaMinsa] = useState<CategoriaMinsa | "">("");
  const [lotes, setLotes] = useState<LotePdf[]>([loteVacio("electricas")]);
  const [hojas, setHojas] = useState<Record<string, number>>({});
  const [contando, setContando] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [lectura, setLectura] = useState<LecturaGrok | null>(null);
  const [generado, setGenerado] = useState<PresupuestoState | null>(null);

  const files = useMemo(() => lotes.flatMap((l) => l.files), [lotes]);
  const hojasDetectadas = useMemo(
    () => files.reduce((s, f) => s + Math.max(0, hojas[claveArchivoPdf(f)] || 0), 0),
    [files, hojas],
  );
  const pendientesConteo = files.some((f) => hojas[claveArchivoPdf(f)] == null);
  const pageCount = useMemo(() => {
    let n = 0;
    for (const lote of lotes) {
      const delLote = lote.files.reduce((s, f) => s + Math.max(0, hojas[claveArchivoPdf(f)] || 0), 0);
      n += Math.min(delLote, MAX_PAGINAS);
    }
    return Math.min(n, MAX_HOJAS_COBRO);
  }, [lotes, hojas]);
  const total = pageCount * PDF_SOLES;
  const truncado = hojasDetectadas > pageCount;
  const plantilla = plantillaId ? plantillaPorId(plantillaId) : undefined;
  const plantillaDetectada = useMemo(() => {
    if (plantilla) return plantilla;
    return plantillaPorId(
      identificarPlantilla({
        obra,
        archivos: files.map((f) => f.name),
        tipo: tipoProyecto,
      }),
    );
  }, [plantilla, obra, files, tipoProyecto]);
  const calcGenerado = useMemo(() => (generado ? calcularPresupuesto(generado) : null), [generado]);
  const plantillaUsada = generado?.plantillaId ? plantillaPorId(generado.plantillaId) : plantillaDetectada;
  const especialidadesTipo = tipoProyecto ? especialidadesDeTipo(tipoProyecto) : ESPECIALIDADES;
  const especialidadesMenu = useMemo(() => {
    const pref = new Set(especialidadesTipo);
    return {
      preferidas: ESPECIALIDADES.filter((e) => pref.has(e)),
      otras: ESPECIALIDADES.filter((e) => !pref.has(e)),
    };
  }, [especialidadesTipo]);
  const usadas = new Set(lotes.map((l) => l.especialidad));
  const libres = [...especialidadesTipo, ...ESPECIALIDADES.filter((e) => !especialidadesTipo.includes(e))].filter(
    (e) => !usadas.has(e),
  );
  const plantillasTipo = tipoProyecto ? PLANTILLAS.filter((p) => p.categoria === tipoProyecto) : PLANTILLAS;
  const tiposProyecto = (Object.keys(CATEGORIA_PLANTILLA_META) as CategoriaPlantilla[]).sort(
    (a, b) => CATEGORIA_PLANTILLA_META[a].orden - CATEGORIA_PLANTILLA_META[b].orden,
  );

  function setLote(id: string, patch: Partial<LotePdf>) {
    setLotes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function mergeFiles(prev: File[], next: File[]) {
    const out = [...prev];
    for (const f of next) {
      if (!out.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) {
        out.push(f);
      }
    }
    return out;
  }

  function quitarArchivo(loteId: string, fileIndex: number) {
    setLotes((prev) =>
      prev.map((l) => {
        if (l.id !== loteId) return l;
        const removed = l.files[fileIndex];
        if (removed) {
          const k = claveArchivoPdf(removed);
          setHojas((h) => {
            const next = { ...h };
            delete next[k];
            return next;
          });
        }
        return { ...l, files: l.files.filter((_, i) => i !== fileIndex) };
      }),
    );
    setLectura(null);
    setGenerado(null);
    setOk("");
    setErr("");
  }

  async function agregarArchivos(loteId: string, incoming: File[]) {
    if (!incoming.length) return;
    setLotes((prev) => prev.map((l) => (l.id === loteId ? { ...l, files: mergeFiles(l.files, incoming) } : l)));
    setLectura(null);
    setGenerado(null);
    setOk("");
    setErr("");
    setContando(true);
    try {
      const updates: Record<string, number> = {};
      for (const f of incoming) {
        const k = claveArchivoPdf(f);
        try {
          updates[k] = await contarHojasPdf(f);
        } catch {
          updates[k] = 0;
          setErr(`No se pudieron contar las hojas de «${f.name}». Vuelva a adjuntarlo.`);
        }
      }
      setHojas((prev) => ({ ...prev, ...updates }));
    } finally {
      setContando(false);
    }
  }

  function aplicarTipo(next: CategoriaPlantilla | "") {
    setTipoProyecto(next);
    setPlantillaId("");
    setLectura(null);
    setGenerado(null);
    setOk("");
    if (!next) return;
    const primera = especialidadesDeTipo(next)[0];
    if (primera) {
      setLotes((prev) => prev.map((l, i) => (i === 0 ? { ...l, especialidad: primera } : l)));
    }
    if (next === "salud") setCategoriaMinsa((prev) => prev || "I-4");
  }

  function aplicarPlantillaSel(id: string) {
    setPlantillaId(id);
    setLectura(null);
    setGenerado(null);
    setOk("");
    const pl = plantillaPorId(id);
    if (!pl) return;
    setTipoProyecto(pl.categoria);
    setObra((prev) => prev.trim() || pl.obra);
    setCliente((prev) => prev.trim() || pl.cliente);
    setLugar((prev) => prev.trim() || pl.lugar);
    if (pl.categoriaMinsa) setCategoriaMinsa(pl.categoriaMinsa);
  }

  async function generar(chargeId: string) {
    if (!user || !session?.access_token) {
      openGoogle();
      return;
    }
    if (!chargeId.startsWith("chr_")) {
      setErr("Falta el cargo Culqi. Pague la lectura por hoja para continuar.");
      return;
    }
    const activos = lotes.filter((l) => l.files.length);
    if (!activos.length) {
      setErr("Adjunte los PDF por especialidad. Cada lote usa solo el catálogo de esa especialidad.");
      return;
    }
    if (contando || pendientesConteo || pageCount < 1) {
      setErr("Espere a que se cuenten las hojas de cada PDF. El precio es por lámina.");
      return;
    }
    setErr("");
    setOk("");
    setLectura(null);
    setGenerado(null);
    try {
      const lecturas: LecturaGrok[] = [];
      const catMinsa =
        esCategoriaMinsa(categoriaMinsa) ? categoriaMinsa : detectarCategoriaMinsa(obra, ...activos.flatMap((l) => l.files.map((f) => f.name)));
      for (const lote of activos) {
        const meta = ESPECIALIDAD_META[lote.especialidad];
        const nCat = partidasDeEspecialidad(lote.especialidad, catMinsa).length;
        setBusy(`Rasterizando ${meta.label} (hasta ${MAX_PAGINAS} láminas)…`);
        const pages = await rasterizarPdfs(lote.files);
        if (!pages.length) throw new Error(`No se rasterizó el PDF de ${meta.label}.`);

        setBusy(`Fase 0: catálogo ${meta.kicker} (${nCat} partidas). Luego lectura de ${pages.length} láminas…`);
        lecturas.push(
          await llamarGrok({
            obra: obra.trim(),
            cliente: cliente.trim() || profile?.full_name || "",
            lugar: lugar.trim(),
            files: lote.files.map((f) => f.name),
            pages,
            especialidad: lote.especialidad,
            categoriaMinsa: catMinsa,
            chargeId,
            accessToken: session.access_token,
          }),
        );
      }

      const grok = fusionarLecturas(lecturas);
      setLectura(grok);

      if (chargeId.startsWith("chr_")) await registerPayment({
        userId: user.id,
        email: user.email || "",
        kind: "pdf",
        amount: total,
        voucher: chargeId,
        pdfCount: pageCount,
        meta: {
          obra: obra.trim() || grok.obra_leida || "Presupuesto desde planos",
          cliente: cliente.trim(),
          lugar: lugar.trim(),
          tipo: tipoProyecto || "",
          plantilla: plantillaId || "",
          lotes: activos.map((l) => ({
            especialidad: l.especialidad,
            files: l.files.map((f) => ({ name: f.name, hojas: hojas[claveArchivoPdf(f)] || 0 })),
          })),
          motor: "ia",
          partidas: grok.lineas.length,
        },
      }).catch(() => undefined);

      setBusy("Identificando plantilla y conectando partidas del expediente…");
      const state = await generarDesdePlanos({
        userId: user.id,
        obra: obra.trim() || grok.obra_leida || "Presupuesto desde planos PDF",
        cliente: cliente.trim() || profile?.full_name || "",
        lugar: lugar.trim(),
        files,
        lectura: grok,
        seedPlantilla: plantillaId || undefined,
        tipo: tipoProyecto,
      });
      await refreshPlan();
      setGenerado(state);
      if (state.plantillaId) {
        setPlantillaId(state.plantillaId);
        const pl = plantillaPorId(state.plantillaId);
        if (pl) setTipoProyecto(pl.categoria);
      }
      const extras = state.lineas.length - grok.lineas.length;
      setOk(
        `Expediente listo: plantilla «${plantillaPorId(state.plantillaId || "")?.nombre || state.plantillaId || "obra"}». ` +
          `${state.lineas.length} partidas conectadas (${grok.lineas.length} con metrado de plano` +
          `${extras > 0 ? `, ${extras} de plantilla o adicionales de catálogo` : ""}). ` +
          `${grok.no_catalogadas.length ? `${grok.no_catalogadas.length} ítems vistos sin código propio (mapeados o anotados; no se inventaron partidas). ` : ""}` +
          `Elija ir a la hoja de presupuesto o exportar el PDF del expediente.`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo completar el pedido.");
    } finally {
      setBusy("");
    }
  }

  function irAHojaPresupuesto() {
    window.dispatchEvent(new CustomEvent("mcd-go", { detail: { page: "presupuestos" } }));
  }

  function exportarExpedientePdf() {
    if (!generado) return;
    window.setTimeout(() => printMemoria(`Expediente de presupuesto — ${generado.obra || "obra"}`), 50);
  }

  return (
    <>
    <div className="pdf-shell" data-guest-ok>
      <header className="pdf-hero">
        <p className="doc-kicker">PRE-00 · expediente desde planos</p>
        <h2>Presupuesto desde PDF</h2>
        <p>
          El programa identifica la <b>plantilla de expediente</b> (vivienda, edificio, vía, puente, MINSA, …), conecta
          todas sus partidas con los metrados leídos y, si el plano pide algo más, añade la partida del catálogo. Al
          terminar puede abrir la hoja de presupuesto o exportar un PDF con formación (CD, GG, utilidad, subtotal, IGV),
          planilla de metrados, APU, relación de insumos y costos particionados por etapa. Lectura con IA: S/ {PDF_SOLES}{" "}
          por hoja.
        </p>
      </header>

      <div className="pdf-grid">
        <section className="pdf-main">
          <div className="pdf-fields">
            <label>
              Tipo de proyecto
              <select
                value={tipoProyecto}
                onChange={(e) => aplicarTipo((e.target.value || "") as CategoriaPlantilla | "")}
              >
                <option value="">Seleccione el tipo (según plantillas)</option>
                {tiposProyecto.map((id) => (
                  <option key={id} value={id}>
                    {CATEGORIA_PLANTILLA_META[id].kicker} · {CATEGORIA_PLANTILLA_META[id].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Plantilla
              <select value={plantillaId} onChange={(e) => aplicarPlantillaSel(e.target.value)}>
                <option value="">Detectar automáticamente</option>
                {plantillasTipo.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Obra
              <input value={obra} onChange={(e) => setObra(e.target.value)} placeholder="Conjunto residencial, vivienda, I.E., vía, etc." />
            </label>
            <label>
              Cliente
              <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Promotor o entidad" />
            </label>
            <label>
              Lugar
              <input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Distrito y departamento" />
            </label>
            {tipoProyecto === "salud" || plantilla?.categoriaMinsa ? (
              <label>
                Categoría MINSA
                <select
                  value={categoriaMinsa}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCategoriaMinsa(esCategoriaMinsa(v) ? v : "");
                    setLectura(null);
                    setOk("");
                  }}
                >
                  <option value="">No aplica / no declarada</option>
                  {CATEGORIAS_MINSA.map((id) => (
                    <option key={id} value={id}>
                      {CATEGORIA_MINSA_META[id].nombre}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {tipoProyecto ? (
            <p className="pdf-note">
              {CATEGORIA_PLANTILLA_META[tipoProyecto].blurb}
              {plantilla
                ? ` Plantilla: ${plantilla.nombre}.`
                : plantillaDetectada
                  ? ` Se usará la plantilla «${plantillaDetectada.nombre}» si no elige otra.`
                  : ""}
            </p>
          ) : plantillaDetectada ? (
            <p className="pdf-note">
              Plantilla identificada internamente: <b>{plantillaDetectada.nombre}</b>. Puede cambiar el tipo o la
              plantilla antes de pagar.
            </p>
          ) : null}
          {categoriaMinsa ? (
            <p className="pdf-note">
              Catálogo de equipos (IM-08, IM-09, IEM, ATS y grupos) filtrado a {CATEGORIA_MINSA_META[categoriaMinsa].nombre}.{" "}
              {CATEGORIA_MINSA_META[categoriaMinsa].resumen}
            </p>
          ) : null}

          <h3>PDF por especialidad</h3>
          <p className="pdf-note">
            Un lote = una especialidad y sus láminas. El agente lee solo el catálogo de esa especialidad. Hasta{" "}
            {MAX_PAGINAS} láminas por lote. Al adjuntar un PDF se cuentan sus hojas; el precio es S/ {PDF_SOLES} por
            hoja de todos los archivos.
          </p>
          {lotes.map((lote) => {
            const catVista = esCategoriaMinsa(categoriaMinsa) ? categoriaMinsa : null;
            const nCat = partidasDeEspecialidad(lote.especialidad, catVista).length;
            const meta = ESPECIALIDAD_META[lote.especialidad];
            return (
              <article key={lote.id} className="pdf-lote">
                <div className="pdf-lote-head">
                  <label>
                    Especialidad
                    <select
                      value={lote.especialidad}
                      onChange={(e) => {
                        setLote(lote.id, { especialidad: e.target.value as EspecialidadPre });
                        setLectura(null);
                        setOk("");
                      }}
                    >
                      <optgroup label={tipoProyecto ? CATEGORIA_PLANTILLA_META[tipoProyecto].label : "Especialidades"}>
                        {especialidadesMenu.preferidas.map((esp) => (
                          <option key={esp} value={esp} disabled={esp !== lote.especialidad && usadas.has(esp)}>
                            {ESPECIALIDAD_META[esp].kicker} · {ESPECIALIDAD_META[esp].label}
                          </option>
                        ))}
                      </optgroup>
                      {especialidadesMenu.otras.length ? (
                        <optgroup label="Otras especialidades">
                          {especialidadesMenu.otras.map((esp) => (
                            <option key={esp} value={esp} disabled={esp !== lote.especialidad && usadas.has(esp)}>
                              {ESPECIALIDAD_META[esp].kicker} · {ESPECIALIDAD_META[esp].label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </select>
                  </label>
                  <p className="pdf-lote-cat">
                    Catálogo que recibirá el agente: <b>{nCat}</b> partidas {meta.kicker}
                  </p>
                  {lotes.length > 1 ? (
                    <button
                      type="button"
                      className="pdf-lote-del"
                      onClick={() => {
                        setLotes((prev) => prev.filter((l) => l.id !== lote.id));
                        setLectura(null);
                      }}
                    >
                      Quitar lote
                    </button>
                  ) : null}
                </div>
                <label className="pdf-drop">
                  Planos PDF de {meta.label}
                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={(e) => {
                      const incoming = Array.from(e.target.files ?? []);
                      void agregarArchivos(lote.id, incoming);
                      e.target.value = "";
                    }}
                  />
                  <span>
                    {lote.files.length
                      ? `${lote.files.length} archivo${lote.files.length === 1 ? "" : "s"} · ${lote.files.reduce((s, f) => s + (hojas[claveArchivoPdf(f)] || 0), 0)} hoja${lote.files.reduce((s, f) => s + (hojas[claveArchivoPdf(f)] || 0), 0) === 1 ? "" : "s"}`
                      : "Seleccione solo los PDF de esta especialidad"}
                  </span>
                </label>
                {lote.files.length ? (
                  <ul className="pdf-file-list">
                    {lote.files.map((f, i) => {
                      const n = hojas[claveArchivoPdf(f)];
                      return (
                      <li key={`${f.name}-${f.size}-${f.lastModified}-${i}`}>
                        <span title={f.name}>
                          {f.name}
                          <small className="pdf-file-pages">
                            {n == null ? " · contando hojas…" : n < 1 ? " · no se leyeron las hojas" : ` · ${n} hoja${n === 1 ? "" : "s"}`}
                          </small>
                        </span>
                        <button
                          type="button"
                          className="pdf-file-del"
                          aria-label={`Quitar ${f.name}`}
                          onClick={() => quitarArchivo(lote.id, i)}
                        >
                          Quitar
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                ) : null}
              </article>
            );
          })}
          {libres.length ? (
            <button
              type="button"
              className="pdf-add-esp"
              onClick={() => setLotes((prev) => [...prev, loteVacio(libres[0])])}
            >
              + Agregar otra especialidad
            </button>
          ) : null}

          {files.length ? (
            <table className="pdf-files">
              <thead>
                <tr>
                  <th>Especialidad</th>
                  <th>Archivo</th>
                  <th>Hojas</th>
                  <th>Tarifa</th>
                  <th className="pdf-files-actions">Acción</th>
                </tr>
              </thead>
              <tbody>
                {lotes.flatMap((l) =>
                  l.files.map((f, i) => {
                    const n = hojas[claveArchivoPdf(f)];
                    const cobrables = n && n > 0 ? n : 0;
                    return (
                    <tr key={`${l.id}-${f.name}-${f.size}-${f.lastModified}-${i}`}>
                      <td>{ESPECIALIDAD_META[l.especialidad].kicker}</td>
                      <td>{f.name}</td>
                      <td>{n == null ? "…" : n < 1 ? "—" : n}</td>
                      <td>{cobrables ? `S/ ${(cobrables * PDF_SOLES).toLocaleString("es-PE")}` : "—"}</td>
                      <td className="pdf-files-actions">
                        <button
                          type="button"
                          className="pdf-file-del"
                          aria-label={`Eliminar ${f.name}`}
                          onClick={() => quitarArchivo(l.id, i)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                    );
                  }),
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    {files.length} archivo{files.length === 1 ? "" : "s"} · {pageCount} lámina{pageCount === 1 ? "" : "s"}
                    {truncado ? ` (de ${hojasDetectadas} detectadas)` : ""}
                  </td>
                  <td>{pageCount}</td>
                  <td colSpan={2}>S/ {total.toLocaleString("es-PE")}</td>
                </tr>
              </tfoot>
            </table>
          ) : null}
          {truncado ? (
            <p className="pdf-note">
              Se detectaron {hojasDetectadas} hojas. El cobro y la lectura cubren {pageCount} láminas (máximo {MAX_PAGINAS} por
              especialidad y {MAX_HOJAS_COBRO} por pago).
            </p>
          ) : null}

          {lectura ? (
            <div className="pdf-hallazgos">
              <h3>Lectura</h3>
              <p>
                {lectura.obra_leida ? `${lectura.obra_leida} · ` : ""}
                {lectura.especialidad || "especialidad por confirmar"}
                {lectura.escala ? ` · escala ${lectura.escala}` : ""} · {lectura.lineas.length} partidas del catálogo
                {lectura.no_catalogadas.length ? ` · ${lectura.no_catalogadas.length} sin partida` : ""}
              </p>
              {lectura.no_catalogadas.length ? (
                <ul>
                  {lectura.no_catalogadas.slice(0, 8).map((x) => (
                    <li key={x.que_se_vio}>
                      Sin código: {x.que_se_vio} ({x.cantidad} {x.unidad}) — {x.por_que_no_entra}
                    </li>
                  ))}
                </ul>
              ) : null}
              {lectura.revision.length ? (
                <ul>
                  {lectura.revision.slice(0, 8).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {ok ? <p className="mcd-ok">{ok}</p> : null}
          {generado && calcGenerado ? (
            <div className="pdf-result">
              <h3>Expediente de presupuesto</h3>
              <p>
                Plantilla <b>{plantillaUsada?.nombre || generado.plantillaId || "obra"}</b>
                {plantillaUsada ? ` · ${plantillaUsada.resumen || CATEGORIA_PLANTILLA_META[plantillaUsada.categoria].label}` : ""}.{" "}
                {generado.lineas.length} partidas · CD S/ {calcGenerado.costoDirecto.toLocaleString("es-PE", { maximumFractionDigits: 2 })} ·
                Total S/ {calcGenerado.total.toLocaleString("es-PE", { maximumFractionDigits: 2 })} (incluye GG, utilidad e IGV).
              </p>
              <div className="pdf-result-actions">
                <button type="button" className="btn" onClick={irAHojaPresupuesto}>
                  Ir a hoja de presupuesto
                </button>
                <button type="button" className="btn secondary" onClick={exportarExpedientePdf}>
                  Exportar PDF del expediente
                </button>
              </div>
              <p className="pdf-note">
                El PDF incluye: hoja de presupuesto (CD, GG, utilidad, subtotal, IGV), presupuesto detallado, planilla
                de metrados, análisis de costo unitario, relación de insumos (materiales, mano de obra y maquinaria) y
                costos particionados por etapa de construcción.
              </p>
            </div>
          ) : null}
        </section>
        <PayBox
          kind="pdf"
          pdfCount={pageCount}
          pdfFiles={files.length}
          counting={contando || pendientesConteo}
          onPaid={(chargeId) => generar(chargeId)}
          busy={busy}
          error={err}
        />
      </div>
    </div>
    {generado && calcGenerado ? (
      <PresupuestoPrint state={generado} calc={calcGenerado} hojas={[...EXPEDIENTE_PDF_HOJAS]} />
    ) : null}
    </>
  );
}
