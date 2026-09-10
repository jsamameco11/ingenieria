import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { loadPresupuesto } from "../lib/presupuesto/engine";
import { codigoIU, INDICES_UNIFICADOS, IU_BY_CODIGO } from "../lib/presupuesto/indicesUnificados";
import { claveSubcapitulo, compararCapitulos, etiquetaSubcapitulo, partesTituloCapitulo } from "../lib/presupuesto/rnMetrados";
import { ESPECIALIDAD_META, moneyMon, SISTEMA_CONTRATACION_META, type EspecialidadPre } from "../lib/presupuesto/types";
import { useUndoableState } from "../lib/undoHistory";
import {
  FRECUENCIA_META,
  LIMITE_ADICIONAL_MAXIMO_PCT,
  LIMITE_ADICIONAL_NIVEL1_PCT,
  LIMITE_ADICIONAL_NIVEL2_PCT,
  actualizarAdelantos,
  actualizarItem,
  actualizarMonomioManual,
  actualizarPeriodo,
  actualizarPlazoContractual,
  agregarItem,
  agregarItemFueraPresupuesto,
  agregarMonomioManual,
  calcularItem,
  calcularLiquidacionPeriodo,
  calcularPenalidadPeriodo,
  calcularReajustePeriodo,
  curvaSPorPeriodo,
  eliminarPeriodo,
  exportarValorizacionXlsx,
  exportFormulaManualPlantillaCsv,
  exportIndicesIrPlantillaCsv,
  exportPeriodoCsv,
  exportPlantillaCsv,
  exportProgramadoPlantillaCsv,
  factorRelacionPeriodo,
  fijarMonomiosManual,
  fijarProgramadoManual,
  fusionarEjecucionCsv,
  fusionarIndicesIrCsv,
  fusionarProgramadoCsv,
  generarInformeAdicional,
  generarInformeValorizacion,
  importarPartidasAlPeriodo,
  insumosDePeriodo,
  leerCsvEjecucion,
  leerCsvFormulaManual,
  leerCsvIndicesIr,
  leerCsvProgramado,
  limpiarProgramadoManual,
  loadValorizaciones,
  monomiosDesdeCsv,
  nuevoPeriodo,
  patchIndiceIrPeriodo,
  quitarItem,
  quitarMonomioManual,
  resumenAdelantos,
  resumenDePeriodo,
  saveValorizaciones,
  sumaCoeficientesManual,
  usarFormulaDelPresupuesto,
  usarFormulaManual,
  type FrecuenciaValorizacion,
  type ItemCalc,
} from "../lib/valorizaciones";
import { UndoButtons } from "../ui/UndoButtons";

type Vista = "tabla" | "materiales" | "adicionales" | "reajuste" | "curva" | "adelantos";

const KIND_LABEL: Record<string, string> = { mat: "Material", maq: "Maquinaria", eq: "Equipo" };

function fechaCorta(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function ValorizacionesModule() {
  const { state, setState, undo, redo, canUndo, canRedo } = useUndoableState(() => loadValorizaciones());
  const [vista, setVista] = useState<Vista>("tabla");
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [frecSel, setFrecSel] = useState<FrecuenciaValorizacion>("mensual");
  const [desdeManual, setDesdeManual] = useState("");
  const [filtro, setFiltro] = useState("");
  const [msg, setMsg] = useState("");
  const [adicOpen, setAdicOpen] = useState(false);
  const [ayudaOpen, setAyudaOpen] = useState(false);
  const [ayudaIndicesOpen, setAyudaIndicesOpen] = useState(false);
  const [ayudaProgramadoOpen, setAyudaProgramadoOpen] = useState(false);
  const [ayudaFormulaOpen, setAyudaFormulaOpen] = useState(false);
  const [adicTipo, setAdicTipo] = useState<"adicional" | "deductivo">("adicional");
  const [adicDescripcion, setAdicDescripcion] = useState("");
  const [adicUnd, setAdicUnd] = useState("und");
  const [adicPu, setAdicPu] = useState(0);
  const [adicMetrado, setAdicMetrado] = useState(0);
  const [adicVinculado, setAdicVinculado] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const indicesFileRef = useRef<HTMLInputElement>(null);
  const programadoFileRef = useRef<HTMLInputElement>(null);
  const formulaFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveValorizaciones(state);
  }, [state]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  const pre = loadPresupuesto();
  const periodo = state.periodos.find((p) => p.id === state.selPeriodoId) || state.periodos[state.periodos.length - 1];

  const itemsCalc = useMemo(() => (periodo ? periodo.items.map(calcularItem) : []), [periodo]);
  const itemsContractuales = useMemo(() => itemsCalc.filter((i) => i.tipo === "contractual"), [itemsCalc]);
  const itemsFiltrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return itemsContractuales;
    return itemsContractuales.filter((i) => i.codigo.toLowerCase().includes(q) || i.descripcion.toLowerCase().includes(q));
  }, [itemsContractuales, filtro]);
  const bloques = useMemo(() => agruparPorCapitulos(itemsFiltrados), [itemsFiltrados]);
  const adicionales = useMemo(() => itemsCalc.filter((i) => i.tipo === "adicional"), [itemsCalc]);
  const deductivos = useMemo(() => itemsCalc.filter((i) => i.tipo === "deductivo"), [itemsCalc]);
  const resumen = useMemo(() => (periodo ? resumenDePeriodo(periodo, state.periodos, pre) : null), [periodo, state.periodos, pre]);
  const insumos = useMemo(() => (periodo ? insumosDePeriodo(periodo, pre) : []), [periodo, pre]);
  const curva = useMemo(
    () => curvaSPorPeriodo(pre, state.periodos, state.programadoManual),
    [pre, state.periodos, state.programadoManual],
  );
  const ultimoResumen = curva.puntos[curva.puntos.length - 1];
  const reajuste = useMemo(
    () => (periodo && resumen ? calcularReajustePeriodo(periodo, resumen.costoDirectoPeriodo, pre, state.formulaManual) : null),
    [periodo, resumen, pre, state.formulaManual],
  );
  const factorK = useMemo(() => (periodo ? factorRelacionPeriodo(periodo, pre) : 1), [periodo, pre]);
  const adelantosResumen = useMemo(
    () => (periodo && resumen ? resumenAdelantos(periodo, state.periodos, state.adelantos, resumen.totalPeriodo) : null),
    [periodo, resumen, state.periodos, state.adelantos],
  );
  const penalidad = useMemo(
    () =>
      periodo && resumen
        ? calcularPenalidadPeriodo(periodo, state.periodos, resumen.totalContractual, state.plazoContractualDias)
        : null,
    [periodo, resumen, state.periodos, state.plazoContractualDias],
  );
  const liquidacion = useMemo(
    () =>
      resumen && adelantosResumen && penalidad
        ? calcularLiquidacionPeriodo(resumen.totalPeriodo, reajuste?.aplicable ? reajuste.reajuste : 0, adelantosResumen, penalidad)
        : null,
    [resumen, adelantosResumen, penalidad, reajuste],
  );
  const historialAdelantos = useMemo(
    () =>
      state.periodos.map((p) => {
        const r = resumenDePeriodo(p, state.periodos, pre);
        return {
          periodo: p,
          adelantos: resumenAdelantos(p, state.periodos, state.adelantos, r.totalPeriodo),
          penalidad: calcularPenalidadPeriodo(p, state.periodos, r.totalContractual, state.plazoContractualDias),
        };
      }),
    [state.periodos, state.adelantos, state.plazoContractualDias, pre],
  );

  function crearPeriodo() {
    const p = nuevoPeriodo(state, pre, frecSel, desdeManual || undefined);
    setState((s) => ({ ...s, periodos: [...s.periodos, p], selPeriodoId: p.id }));
    setNuevoOpen(false);
    setDesdeManual("");
    setVista("tabla");
  }

  function refrescarDelPresupuesto() {
    if (!periodo) return;
    const items = importarPartidasAlPeriodo(periodo, state.periodos, pre);
    setState((s) => actualizarPeriodo(s, periodo.id, { items }));
    setMsg(`Se actualizaron ${items.length} partidas desde el presupuesto vigente.`);
  }

  function onMetrado(itemId: string, v: number) {
    if (!periodo) return;
    setState((s) => actualizarItem(s, periodo.id, itemId, { metradoPeriodo: Math.max(0, v) }));
  }

  function descargarCsv(csv: string, nombreArchivo: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarCsv() {
    if (!periodo) return;
    descargarCsv(exportPeriodoCsv(itemsCalc), `${periodo.nombre.replace(/[^a-z0-9]+/gi, "_")}.csv`);
  }

  function descargarPlantilla() {
    if (!periodo) return;
    const csv = exportPlantillaCsv(itemsCalc.map((it) => ({ codigo: it.codigo, descripcion: it.descripcion, und: it.und })));
    descargarCsv(csv, `${periodo.nombre.replace(/[^a-z0-9]+/gi, "_")}_plantilla.csv`);
  }

  function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !periodo) return;
    const reader = new FileReader();
    reader.onload = () => {
      const leidos = leerCsvEjecucion(String(reader.result || ""));
      if (!leidos.length) {
        setMsg("No se reconocieron columnas de código y metrado ejecutado en el archivo.");
        return;
      }
      const items = fusionarEjecucionCsv(periodo.items, leidos);
      setState((s) => actualizarPeriodo(s, periodo.id, { items }));
      setMsg(`Se importaron ${leidos.length} filas desde ${file.name}.`);
    };
    reader.readAsText(file, "utf-8");
  }

  function onArchivoIndices(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !periodo || !reajuste?.aplicable) return;
    const reader = new FileReader();
    reader.onload = () => {
      const leidos = leerCsvIndicesIr(String(reader.result || ""));
      if (!leidos.length) {
        setMsg("No se reconocieron columnas de monomio (letra/código IU) e índice Ir en el archivo.");
        return;
      }
      const { indicesIrPeriodo, aplicados, noEncontrados } = fusionarIndicesIrCsv(periodo, reajuste.monomios, leidos);
      setState((s) => actualizarPeriodo(s, periodo.id, { indicesIrPeriodo }));
      setMsg(
        `Se importaron ${aplicados} índice(s) Ir desde ${file.name}.` +
          (noEncontrados ? ` ${noEncontrados} fila(s) no calzaron con ningún monomio de la fórmula.` : ""),
      );
    };
    reader.readAsText(file, "utf-8");
  }

  function descargarPlantillaIndices() {
    if (!reajuste?.aplicable) return;
    descargarCsv(exportIndicesIrPlantillaCsv(reajuste.monomios), `${periodo?.nombre.replace(/[^a-z0-9]+/gi, "_") || "reajuste"}_indices.csv`);
  }

  function onArchivoFormula(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const leidos = leerCsvFormulaManual(String(reader.result || ""));
      if (!leidos.length) {
        setMsg("No se reconocieron columnas de código IU y coeficiente en el archivo.");
        return;
      }
      const monomios = monomiosDesdeCsv(leidos);
      setState((s) => fijarMonomiosManual(s, monomios));
      setMsg(`Se importó la fórmula (${monomios.length} monomio(s)) desde ${file.name}.`);
    };
    reader.readAsText(file, "utf-8");
  }

  function descargarPlantillaFormula() {
    descargarCsv(exportFormulaManualPlantillaCsv(state.formulaManual), "formula_polinomica.csv");
  }

  function onArchivoProgramado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const leidos = leerCsvProgramado(String(reader.result || ""));
      if (!leidos.length) {
        setMsg("No se reconocieron columnas de periodo/fecha y programado (% o S/.) en el archivo.");
        return;
      }
      const { patch, aplicados, noEncontrados } = fusionarProgramadoCsv(state.periodos, curva.totalContrato, leidos);
      if (!aplicados) {
        setMsg("Ninguna fila del archivo calzó con un periodo de valorización existente.");
        return;
      }
      setState((s) => fijarProgramadoManual(s, patch));
      setMsg(
        `Se importó el programado de ${aplicados} periodo(s) desde ${file.name}.` +
          (noEncontrados ? ` ${noEncontrados} fila(s) no se pudieron aplicar.` : ""),
      );
    };
    reader.readAsText(file, "utf-8");
  }

  function descargarPlantillaProgramado() {
    descargarCsv(exportProgramadoPlantillaCsv(curva.puntos), "curva_s_programado.csv");
  }

  function usarCronogramaProgramado() {
    if (!window.confirm("¿Volver a usar el programado calculado del cronograma (Gantt/CPM) en todos los periodos, descartando lo importado por CSV?")) return;
    setState((s) => limpiarProgramadoManual(s));
    setMsg("Se restauró el programado calculado del cronograma en todos los periodos.");
  }

  function alternarCierre() {
    if (!periodo) return;
    setState((s) => actualizarPeriodo(s, periodo.id, { estado: periodo.estado === "abierta" ? "cerrada" : "abierta" }));
  }

  function borrarPeriodo() {
    if (!periodo) return;
    if (!window.confirm(`¿Eliminar "${periodo.nombre}"? Esta acción no se puede deshacer.`)) return;
    setState((s) => eliminarPeriodo(s, periodo.id));
  }

  function abrirModalAdicional(tipo: "adicional" | "deductivo") {
    setAdicTipo(tipo);
    setAdicDescripcion("");
    setAdicUnd("und");
    setAdicPu(0);
    setAdicMetrado(0);
    setAdicVinculado("");
    setAdicOpen(true);
  }

  function confirmarAdicional() {
    if (!periodo) return;
    if (!adicDescripcion.trim()) {
      setMsg(`Ingrese la descripción de la partida ${adicTipo === "adicional" ? "adicional" : "deductiva"}.`);
      return;
    }
    const item = agregarItemFueraPresupuesto(periodo, state.periodos, adicTipo, {
      descripcion: adicDescripcion.trim(),
      und: adicUnd.trim() || "und",
      precioUnitario: adicPu,
      metradoPeriodo: adicMetrado,
      vinculadoA: adicVinculado,
    });
    setState((s) => agregarItem(s, periodo.id, item));
    setAdicOpen(false);
    setVista("adicionales");
    setMsg(`Partida ${adicTipo === "adicional" ? "adicional" : "deductiva"} «${item.codigo}» agregada.`);
  }

  function quitarPartidaExtra(itemId: string) {
    if (!periodo) return;
    if (!window.confirm("¿Quitar esta partida del periodo?")) return;
    setState((s) => quitarItem(s, periodo.id, itemId));
  }

  async function onGenerarInforme() {
    if (!periodo || !resumen) return;
    if (!adicionales.length) {
      setMsg("Agregue al menos una partida adicional antes de generar el informe.");
      return;
    }
    await generarInformeAdicional(periodo, resumen, adicionales, deductivos, pre);
    setMsg("Informe de adicional de obra generado (.docx).");
  }

  async function onGenerarInformeValorizacion() {
    if (!periodo || !resumen || !adelantosResumen || !penalidad || !reajuste || !liquidacion) return;
    await generarInformeValorizacion(
      periodo,
      resumen,
      itemsContractuales,
      adicionales,
      deductivos,
      adelantosResumen,
      state.adelantos,
      penalidad,
      reajuste,
      liquidacion,
      pre,
    );
    setMsg("Informe de valorización de obra generado (.docx).");
  }

  async function onExportarXlsx() {
    if (!periodo || !resumen || !adelantosResumen || !penalidad || !reajuste || !liquidacion) return;
    await exportarValorizacionXlsx(
      periodo,
      resumen,
      itemsContractuales,
      adicionales,
      deductivos,
      adelantosResumen,
      penalidad,
      reajuste,
      liquidacion,
      pre,
    );
    setMsg("Valorización exportada a Excel (.xlsx).");
  }

  function onAmortizacionDirecto(v: number) {
    if (!periodo) return;
    setState((s) => actualizarPeriodo(s, periodo.id, { amortizacionDirecto: Math.max(0, v) || 0 }));
  }

  function onAmortizacionMateriales(v: number) {
    if (!periodo) return;
    setState((s) => actualizarPeriodo(s, periodo.id, { amortizacionMateriales: Math.max(0, v) || 0 }));
  }

  function aplicarCuotaSugerida() {
    if (!periodo || !adelantosResumen) return;
    setState((s) => actualizarPeriodo(s, periodo.id, { amortizacionDirecto: adelantosResumen.cuotaDirectoSugerida }));
  }

  function onDiasAtraso(v: number) {
    if (!periodo) return;
    setState((s) => actualizarPeriodo(s, periodo.id, { diasAtrasoInjustificado: Math.max(0, Math.round(v)) || 0 }));
  }

  const NIVEL_TEXTO: Record<string, string> = {
    nivel1: `Los adicionales netos deflactados (${resumen?.pctAdicionalSobreContrato.toFixed(2)}%) están dentro del ${LIMITE_ADICIONAL_NIVEL1_PCT}% del contrato original: se aprueban a nivel administrativo de la Entidad (Ley N.° 32069, art. 64).`,
    nivel2: `Los adicionales netos deflactados (${resumen?.pctAdicionalSobreContrato.toFixed(2)}%) superan el ${LIMITE_ADICIONAL_NIVEL1_PCT}% y llegan hasta el ${LIMITE_ADICIONAL_NIVEL2_PCT}%: los autoriza el Titular de la Entidad, sujeto a disponibilidad presupuestal (Ley N.° 32069, art. 64).`,
    nivel3: `Los adicionales netos deflactados (${resumen?.pctAdicionalSobreContrato.toFixed(2)}%) superan el ${LIMITE_ADICIONAL_NIVEL2_PCT}% y llegan hasta el ${LIMITE_ADICIONAL_MAXIMO_PCT}%: requieren autorización previa de la Contraloría General de la República (Ley N.° 32069, art. 64).`,
    "supera-maximo": `Los adicionales netos deflactados (${resumen?.pctAdicionalSobreContrato.toFixed(2)}%) superan el ${LIMITE_ADICIONAL_MAXIMO_PCT}% del contrato original: ese exceso no procede como adicional ordinario, revise con el área legal (Ley N.° 32069, art. 64).`,
  };
  const alertaTexto = resumen && resumen.alertaAdicional !== "ninguna" ? NIVEL_TEXTO[resumen.alertaAdicional] : "";

  return (
    <section className="msp-shell valz-shell">
      <header className="msp-top">
        <div className="pre-brand">
          <span className="pre-mark">VAL</span>
          <div>
            <strong>Valorizaciones</strong>
            <p>Periodos, adicionales de obra y reajuste por índices unificados · {pre.obra || "Obra sin nombre"}</p>
          </div>
        </div>
        <div className="msp-kpis">
          <div>
            <span>Contrato</span>
            <b>{moneyMon(resumen?.totalContractual ?? 0, "PEN")}</b>
          </div>
          <div>
            <span>Valorizado acum.</span>
            <b>{moneyMon(resumen?.totalAcumulado ?? 0, "PEN")}</b>
          </div>
          <div>
            <span>Avance físico</span>
            <b>{(resumen?.avanceFisicoPct ?? 0).toFixed(1)} %</b>
          </div>
          <div>
            <span>Adicionales netos (deflat.)</span>
            <b className={resumen && resumen.pctAdicionalSobreContrato > LIMITE_ADICIONAL_NIVEL1_PCT ? "crit" : ""}>
              {(resumen?.pctAdicionalSobreContrato ?? 0).toFixed(1)} %
            </b>
          </div>
          <div>
            <span>Neto a pagar (periodo)</span>
            <b>{moneyMon(liquidacion?.montoNetoAPagar ?? 0, "PEN")}</b>
          </div>
          <div>
            <span>Periodo</span>
            <b>{periodo ? `N.° ${periodo.numero}` : "—"}</b>
          </div>
        </div>
      </header>

      {msg ? <p className="valz-msg">{msg}</p> : null}
      {alertaTexto ? (
        <p className={`valz-alert ${resumen?.alertaAdicional === "ninguna" ? "" : resumen?.alertaAdicional}`}>{alertaTexto}</p>
      ) : null}

      <div className="valz-periodos" role="tablist" aria-label="Periodos de valorización">
        {state.periodos.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === periodo?.id}
            className={`valz-periodo-tab ${p.id === periodo?.id ? "on" : ""} ${p.estado === "cerrada" ? "closed" : ""}`}
            onClick={() => setState((s) => ({ ...s, selPeriodoId: p.id }))}
          >
            <b>{p.nombre}</b>
            <span>
              {fechaCorta(p.desde)} – {fechaCorta(p.hasta)}
            </span>
            <em>{p.estado === "cerrada" ? "Cerrada" : "Abierta"}</em>
          </button>
        ))}
        <button type="button" className="valz-periodo-add" onClick={() => setNuevoOpen(true)}>
          + Periodo
        </button>
      </div>

      {!periodo ? (
        <div className="pre-empty valz-empty">
          <p>Aún no hay valorizaciones. Cree la primera para importar las partidas del presupuesto y registrar lo ejecutado.</p>
          <button type="button" className="btn primary" onClick={() => setNuevoOpen(true)}>
            Crear primera valorización
          </button>
        </div>
      ) : (
        <>
          <div className="msp-ribbon" role="toolbar">
            <fieldset>
              <legend>Periodo N.° {periodo.numero}</legend>
              <label>
                Nombre
                <input
                  value={periodo.nombre}
                  onChange={(e) => setState((s) => actualizarPeriodo(s, periodo.id, { nombre: e.target.value }))}
                />
              </label>
              <label>
                Desde
                <input
                  type="date"
                  value={periodo.desde}
                  onChange={(e) => setState((s) => actualizarPeriodo(s, periodo.id, { desde: e.target.value }))}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={periodo.hasta}
                  onChange={(e) => setState((s) => actualizarPeriodo(s, periodo.id, { hasta: e.target.value }))}
                />
              </label>
              <button type="button" className={periodo.estado === "cerrada" ? "on" : ""} onClick={alternarCierre}>
                {periodo.estado === "cerrada" ? "Reabrir" : "Cerrar periodo"}
              </button>
              <button type="button" onClick={borrarPeriodo}>
                Eliminar periodo
              </button>
            </fieldset>
            <fieldset>
              <legend>Edición</legend>
              <UndoButtons undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} />
            </fieldset>
            <fieldset>
              <legend>Datos</legend>
              <button type="button" onClick={refrescarDelPresupuesto} title="Trae las partidas y precios vigentes del presupuesto (APU)">
                Importar del presupuesto
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} title="Excel guardado como .csv: columnas Código y Metrado ejecutado">
                Importar Excel (.csv)
              </button>
              <button type="button" className="valz-help-btn" onClick={() => setAyudaOpen(true)} title="Cómo importar desde Excel/CSV">
                ?
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt" hidden onChange={onArchivo} />
              <button type="button" onClick={exportarCsv}>
                Exportar Excel (.csv)
              </button>
              <button
                type="button"
                onClick={() => void onGenerarInformeValorizacion()}
                title="Genera el informe de valorización de obra (.docx): datos generales, resumen, tabla de partidas y liquidación del periodo"
              >
                Generar informe de valorización
              </button>
              <button
                type="button"
                onClick={() => void onExportarXlsx()}
                title="Genera el libro de valorización (.xlsx) con el formato profesional de obra: carátula, tabla por especialidad/capítulo/subcapítulo con fórmulas y subtotales, resumen financiero y adicionales/deductivos"
              >
                Exportar valorización (.xlsx)
              </button>
            </fieldset>
            <fieldset>
              <legend>Adicionales / deductivos</legend>
              <button type="button" onClick={() => abrirModalAdicional("adicional")} title="Registra una prestación adicional (fuera del contrato original)">
                + Adicional
              </button>
              <button type="button" onClick={() => abrirModalAdicional("deductivo")} title="Registra un presupuesto deductivo (vinculado a un adicional o reducción de alcance)">
                + Deductivo
              </button>
              <button
                type="button"
                onClick={() => void onGenerarInforme()}
                disabled={!adicionales.length}
                title="Genera el informe de adicional de obra (.docx) con sustento técnico, presupuestal y legal"
              >
                Generar informe de adicional
              </button>
            </fieldset>
            <fieldset>
              <legend>Vista</legend>
              <button type="button" className={vista === "tabla" ? "on" : ""} onClick={() => setVista("tabla")}>
                Valorización de obra
              </button>
              <button type="button" className={vista === "materiales" ? "on" : ""} onClick={() => setVista("materiales")}>
                Materiales y equipos
              </button>
              <button type="button" className={vista === "adicionales" ? "on" : ""} onClick={() => setVista("adicionales")}>
                Adicionales y deductivos
              </button>
              <button type="button" className={vista === "reajuste" ? "on" : ""} onClick={() => setVista("reajuste")}>
                Reajuste (índices)
              </button>
              <button type="button" className={vista === "adelantos" ? "on" : ""} onClick={() => setVista("adelantos")}>
                Adelantos y penalidad
              </button>
              <button type="button" className={vista === "curva" ? "on" : ""} onClick={() => setVista("curva")}>
                Curva S
              </button>
            </fieldset>
          </div>

          {vista === "tabla" ? (
            <div className="msp-body valz-body">
              <div className="valz-dg-card" aria-label="Datos generales de la valorización">
                <div className="valz-dg-row">
                  <span>Obra</span>
                  <b>{pre.obra || "—"}</b>
                </div>
                <div className="valz-dg-row">
                  <span>Entidad</span>
                  <b>{pre.entidad || pre.cliente || "—"}</b>
                </div>
                <div className="valz-dg-row">
                  <span>Contratista</span>
                  <b>{pre.contratista || "—"}</b>
                </div>
                <div className="valz-dg-row">
                  <span>Residente de obra</span>
                  <b>{pre.residente || "—"}</b>
                </div>
                <div className="valz-dg-row">
                  <span>Supervisor / proyectista</span>
                  <b>{pre.proyectista || "—"}</b>
                </div>
                <div className="valz-dg-row">
                  <span>Ubicación</span>
                  <b>{[pre.distrito, pre.provincia, pre.departamento].filter(Boolean).join(", ") || pre.lugar || "—"}</b>
                </div>
                <div className="valz-dg-row">
                  <span>Valorización N.°</span>
                  <b>{periodo.numero}</b>
                </div>
                <div className="valz-dg-row">
                  <span>Periodo</span>
                  <b>
                    {fechaCorta(periodo.desde)} – {fechaCorta(periodo.hasta)}
                  </b>
                </div>
                <div className="valz-dg-row">
                  <span>Sistema de contratación</span>
                  <b>{SISTEMA_CONTRATACION_META[pre.sistemaContratacion] || pre.sistemaContratacion}</b>
                </div>
                <div className="valz-dg-row">
                  <span>Monto contractual (con IGV)</span>
                  <b>S/ {money2(resumen?.totalContractual ?? 0)}</b>
                </div>
              </div>

              <div className="valz-filter">
                <input placeholder="Buscar por código o descripción…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
                <span>
                  {itemsFiltrados.length} de {itemsContractuales.length} partidas contractuales
                  {adicionales.length || deductivos.length ? (
                    <>
                      {" "}
                      · {adicionales.length} adicional(es) y {deductivos.length} deductivo(s) en{" "}
                      <button type="button" className="valz-link-btn" onClick={() => setVista("adicionales")}>
                        Adicionales y deductivos
                      </button>
                    </>
                  ) : null}
                </span>
              </div>
              <div className="msp-sheet valz-sheet valz-sheet-pro">
                <table>
                  <thead>
                    <tr>
                      <th rowSpan={2}>Item</th>
                      <th rowSpan={2}>Descripción</th>
                      <th rowSpan={2}>Und</th>
                      <th rowSpan={2} className="n">
                        Metrado contract.
                      </th>
                      <th rowSpan={2} className="n">
                        P. Unit. (S/)
                      </th>
                      <th rowSpan={2} className="n">
                        Costo (S/)
                      </th>
                      <th colSpan={3} className="valz-th-group">
                        Mes anterior acumulado
                      </th>
                      <th colSpan={3} className="valz-th-group">
                        Actual · {periodo.nombre}
                      </th>
                      <th colSpan={3} className="valz-th-group">
                        Acumulado actual
                      </th>
                      <th colSpan={2} className="valz-th-group">
                        Saldo
                      </th>
                    </tr>
                    <tr>
                      <th className="n">Metrado</th>
                      <th className="n">Valoriz. (S/)</th>
                      <th className="n">%</th>
                      <th className="n">Metrado</th>
                      <th className="n">Valoriz. (S/)</th>
                      <th className="n">%</th>
                      <th className="n">Metrado</th>
                      <th className="n">Valoriz. (S/)</th>
                      <th className="n">%</th>
                      <th className="n">Metrado</th>
                      <th className="n">Costo (S/)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={17} className="pre-empty">
                          Sin partidas. Use «Importar del presupuesto» para traer las partidas del APU vigente.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {bloques.especialidades.map((bloque) => (
                          <Fragment key={bloque.label}>
                            <tr className="pre-row-esp">
                              <td colSpan={5}>
                                <span className={`pre-esp-dot pre-esp-${bloque.especialidad}`}>
                                  {ESPECIALIDAD_META[bloque.especialidad]?.kicker || bloque.label.slice(0, 3).toUpperCase()}
                                </span>
                                {bloque.label}
                              </td>
                              <td className="n mono">{money2(sumar(bloque.items, "montoContractual"))}</td>
                              <td colSpan={4} />
                              <td className="n mono">{money2(sumar(bloque.items, "montoPeriodo"))}</td>
                              <td colSpan={2} />
                              <td className="n mono">{money2(sumar(bloque.items, "montoAcumulado"))}</td>
                              <td colSpan={2} />
                              <td className="n mono">{money2(sumar(bloque.items, "saldoMonto"))}</td>
                            </tr>
                            {bloque.capitulos.map((cap) => (
                              <Fragment key={`${bloque.especialidad}-${cap.capitulo}`}>
                                <tr className="pre-row-cap">
                                  <td className="mono">{cap.num ? <span className="pre-lvl">{cap.num}</span> : null}</td>
                                  <td colSpan={4}>{cap.nombre}</td>
                                  <td className="n mono">{money2(sumar(cap.items, "montoContractual"))}</td>
                                  <td colSpan={4} />
                                  <td className="n mono">{money2(sumar(cap.items, "montoPeriodo"))}</td>
                                  <td colSpan={2} />
                                  <td className="n mono">{money2(sumar(cap.items, "montoAcumulado"))}</td>
                                  <td colSpan={2} />
                                  <td className="n mono">{money2(sumar(cap.items, "saldoMonto"))}</td>
                                </tr>
                                {cap.subs.map((sub) => (
                                  <Fragment key={`${bloque.especialidad}-${cap.capitulo}-${sub.clave}`}>
                                    {cap.subs.length > 1 && sub.clave !== "_" ? (
                                      <tr className="pre-row-sub">
                                        <td className="mono">
                                          <span className="pre-lvl sub">{sub.clave}</span>
                                        </td>
                                        <td colSpan={4}>{sub.titulo !== sub.clave ? sub.titulo : ""}</td>
                                        <td className="n mono">{money2(sumar(sub.items, "montoContractual"))}</td>
                                        <td colSpan={4} />
                                        <td className="n mono">{money2(sumar(sub.items, "montoPeriodo"))}</td>
                                        <td colSpan={2} />
                                        <td className="n mono">{money2(sumar(sub.items, "montoAcumulado"))}</td>
                                        <td colSpan={2} />
                                        <td className="n mono">{money2(sumar(sub.items, "saldoMonto"))}</td>
                                      </tr>
                                    ) : null}
                                    {sub.items.map((it) => (
                                      <FilaValorItem key={it.id} it={it} periodo={periodo} onMetrado={onMetrado} />
                                    ))}
                                  </Fragment>
                                ))}
                              </Fragment>
                            ))}
                          </Fragment>
                        ))}
                        {bloques.sinCapitulo.length ? (
                          <Fragment key="sin-capitulo">
                            <tr className="pre-row-cap">
                              <td className="mono" />
                              <td colSpan={4}>Sin capítulo (código fuera de catálogo)</td>
                              <td className="n mono">{money2(sumar(bloques.sinCapitulo, "montoContractual"))}</td>
                              <td colSpan={4} />
                              <td className="n mono">{money2(sumar(bloques.sinCapitulo, "montoPeriodo"))}</td>
                              <td colSpan={2} />
                              <td className="n mono">{money2(sumar(bloques.sinCapitulo, "montoAcumulado"))}</td>
                              <td colSpan={2} />
                              <td className="n mono">{money2(sumar(bloques.sinCapitulo, "saldoMonto"))}</td>
                            </tr>
                            {bloques.sinCapitulo.map((it) => (
                              <FilaValorItem key={it.id} it={it} periodo={periodo} onMetrado={onMetrado} />
                            ))}
                          </Fragment>
                        ) : null}
                      </>
                    )}
                  </tbody>
                  {resumen ? (
                    <tfoot>
                      <tr>
                        <td colSpan={10}>Costo directo (contractual + adicionales − deductivos)</td>
                        <td className="n mono">{money2(resumen.costoDirectoPeriodo)}</td>
                        <td colSpan={2} />
                        <td className="n mono">{money2(resumen.costoDirectoAcumulado)}</td>
                        <td colSpan={3} />
                      </tr>
                      {resumen.costoDirectoAdicionalAcumulado > 0 ? (
                        <tr>
                          <td colSpan={10}>· de los cuales, adicionales de obra</td>
                          <td className="n mono">{money2(resumen.costoDirectoAdicionalPeriodo)}</td>
                          <td colSpan={2} />
                          <td className="n mono">{money2(resumen.costoDirectoAdicionalAcumulado)}</td>
                          <td colSpan={3} />
                        </tr>
                      ) : null}
                      {resumen.costoDirectoDeductivoAcumulado > 0 ? (
                        <tr>
                          <td colSpan={10}>· de los cuales, deductivos de obra</td>
                          <td className="n mono">- {money2(resumen.costoDirectoDeductivoPeriodo)}</td>
                          <td colSpan={2} />
                          <td className="n mono">- {money2(resumen.costoDirectoDeductivoAcumulado)}</td>
                          <td colSpan={3} />
                        </tr>
                      ) : null}
                      <tr>
                        <td colSpan={10}>Gastos generales + Utilidad</td>
                        <td className="n mono">—</td>
                        <td colSpan={2} />
                        <td className="n mono">{money2(resumen.gg + resumen.utilidad)}</td>
                        <td colSpan={3} />
                      </tr>
                      <tr>
                        <td colSpan={10}>IGV</td>
                        <td className="n mono">—</td>
                        <td colSpan={2} />
                        <td className="n mono">{money2(resumen.igv)}</td>
                        <td colSpan={3} />
                      </tr>
                      <tr className="sum">
                        <td colSpan={10}>Valorización bruta</td>
                        <td className="n mono">{money2(resumen.totalPeriodo)}</td>
                        <td colSpan={2} />
                        <td className="n mono">{money2(resumen.totalAcumulado)}</td>
                        <td colSpan={3} />
                      </tr>
                      {reajuste?.aplicable ? (
                        <tr>
                          <td colSpan={10}>Reajuste por índices unificados (K = {reajuste.k.toFixed(4)})</td>
                          <td className="n mono">{money2(reajuste.reajuste)}</td>
                          <td colSpan={2} />
                          <td className="n mono">—</td>
                          <td colSpan={3} />
                        </tr>
                      ) : null}
                      {liquidacion && liquidacion.amortizacionDirecto > 0 ? (
                        <tr>
                          <td colSpan={10}>Amortización adelanto directo</td>
                          <td className="n mono">- {money2(liquidacion.amortizacionDirecto)}</td>
                          <td colSpan={2} />
                          <td className="n mono">—</td>
                          <td colSpan={3} />
                        </tr>
                      ) : null}
                      {liquidacion && liquidacion.amortizacionMateriales > 0 ? (
                        <tr>
                          <td colSpan={10}>Amortización adelanto de materiales</td>
                          <td className="n mono">- {money2(liquidacion.amortizacionMateriales)}</td>
                          <td colSpan={2} />
                          <td className="n mono">—</td>
                          <td colSpan={3} />
                        </tr>
                      ) : null}
                      {liquidacion && liquidacion.penalidad > 0 ? (
                        <tr>
                          <td colSpan={10}>Penalidad por mora (art. 120)</td>
                          <td className="n mono">- {money2(liquidacion.penalidad)}</td>
                          <td colSpan={2} />
                          <td className="n mono">—</td>
                          <td colSpan={3} />
                        </tr>
                      ) : null}
                      {liquidacion ? (
                        <tr className="sum">
                          <td colSpan={10}>Monto neto a pagar</td>
                          <td className="n mono">{money2(liquidacion.montoNetoAPagar)}</td>
                          <td colSpan={2} />
                          <td className="n mono">—</td>
                          <td colSpan={3} />
                        </tr>
                      ) : null}
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </div>
          ) : null}

          {vista === "materiales" ? (
            <div className="msp-body valz-body">
              <p className="valz-hint">
                Calendario de adquisición de materiales y utilización de equipos: cantidades derivadas del APU de cada
                partida × metrado ejecutado en «{periodo.nombre}».
              </p>
              <div className="msp-sheet valz-sheet">
                <table>
                  <thead>
                    <tr>
                      <th>Insumo</th>
                      <th>Tipo</th>
                      <th>Und</th>
                      <th className="n">Cantidad requerida</th>
                      <th className="n">Precio</th>
                      <th className="n">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insumos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="pre-empty">
                          Registre metrados ejecutados con partidas ligadas al catálogo para ver aquí materiales y equipos.
                        </td>
                      </tr>
                    ) : (
                      insumos.map((r) => (
                        <tr key={r.id}>
                          <td>{r.nombre}</td>
                          <td>{KIND_LABEL[r.kind] || r.kind}</td>
                          <td>{r.und}</td>
                          <td className="n mono">{r.cantidad.toLocaleString("es-PE")}</td>
                          <td className="n mono">{money2(r.precio)}</td>
                          <td className="n mono">{money2(r.monto)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {insumos.length ? (
                    <tfoot>
                      <tr className="sum">
                        <td colSpan={5}>Total del periodo</td>
                        <td className="n mono">{money2(insumos.reduce((s, r) => s + r.monto, 0))}</td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </div>
          ) : null}

          {vista === "adicionales" ? (
            <div className="msp-body valz-body">
              <p className="valz-hint">
                Prestaciones adicionales y presupuestos deductivos de este periodo, en tabla aparte del presupuesto
                contractual (Ley N.° 32069, art. 64 y Reglamento D.S. N.° 009-2025-EF, arts. 194-196). El «monto
                deflatado» lleva cada partida al nivel de precios del presupuesto base (factor K = {factorK.toFixed(4)} de
                este periodo), para compararla en igualdad de condiciones con el monto del contrato original.
              </p>
              <div className="valz-curva-kpis valz-adic-kpis">
                <div>
                  <span>Adicionales acum. (nominal)</span>
                  <b>{money2(resumen?.costoDirectoAdicionalAcumulado ?? 0)}</b>
                </div>
                <div>
                  <span>Deductivos acum. (nominal)</span>
                  <b>{money2(resumen?.costoDirectoDeductivoAcumulado ?? 0)}</b>
                </div>
                <div>
                  <span>Neto deflatado (acum.)</span>
                  <b>{money2(resumen?.costoDirectoAdicionalNetoAcumuladoDeflatado ?? 0)}</b>
                </div>
                <div>
                  <span>% sobre contrato original</span>
                  <b className={resumen && resumen.pctAdicionalSobreContrato > LIMITE_ADICIONAL_NIVEL1_PCT ? "crit" : ""}>
                    {(resumen?.pctAdicionalSobreContrato ?? 0).toFixed(2)}%
                  </b>
                </div>
              </div>
              {alertaTexto ? (
                <p className={`valz-alert ${resumen?.alertaAdicional === "ninguna" ? "" : resumen?.alertaAdicional}`}>{alertaTexto}</p>
              ) : (
                <p className="valz-hint">Sin adicionales netos registrados: no se activa ningún tramo de aprobación.</p>
              )}
              <div className="msp-sheet valz-sheet">
                <table>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      <th>Und</th>
                      <th className="n">Metrado periodo</th>
                      <th className="n">P.U. (fecha ejec.)</th>
                      <th className="n">Monto periodo</th>
                      <th className="n">Monto deflatado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {adicionales.length + deductivos.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="pre-empty">
                          Sin partidas adicionales ni deductivas en este periodo. Use «+ Adicional» o «+ Deductivo» en la
                          barra superior.
                        </td>
                      </tr>
                    ) : (
                      [...adicionales, ...deductivos].map((it) => (
                        <tr key={it.id} className={it.tipo === "deductivo" ? "valz-row-deduc" : "valz-row-adic"}>
                          <td className="mono">{it.codigo}</td>
                          <td>
                            <span className={`valz-badge ${it.tipo === "deductivo" ? "valz-badge-deductivo" : ""}`}>
                              {it.tipo === "deductivo" ? "Deductivo" : "Adicional"}
                            </span>
                          </td>
                          <td>
                            {it.descripcion}
                            {it.tipo === "deductivo" && it.vinculadoA ? <span className="valz-hint-inline"> · vinculado a {it.vinculadoA}</span> : null}
                          </td>
                          <td>{it.und}</td>
                          <td className="n mono">{it.metradoPeriodo.toLocaleString("es-PE")}</td>
                          <td className="n mono">{it.precioUnitario.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                          <td className="n mono">{money2(Math.abs(it.montoPeriodo))}</td>
                          <td className="n mono">{money2(Math.abs(it.montoPeriodo) / factorK)}</td>
                          <td>
                            <button type="button" className="valz-row-del" title="Quitar esta partida" onClick={() => quitarPartidaExtra(it.id)}>
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {vista === "reajuste" ? (
            <div className="msp-body valz-body">
              <p className="valz-hint">
                Reajuste de precios por fórmula polinómica (D.S. N.° 011-79-VC), con los índices unificados de precios de la
                construcción (INEI) del mes de esta valorización. La fórmula (monomios y coeficientes) puede venir del
                presupuesto («Fórmula polinómica», PRE-02) o armarse aquí desde cero — por ejemplo, la que ya trae el
                expediente técnico con el que se valorizará. El índice Ir de cada mes se puede escribir aquí o importar
                de un .csv, sin necesidad de digitarlo monomio por monomio.
              </p>
              <div className="valz-filter valz-csv-bar">
                <button
                  type="button"
                  className={state.formulaOrigen === "presupuesto" ? "on" : ""}
                  onClick={() => setState((s) => usarFormulaDelPresupuesto(s))}
                  title="Usa la fórmula armada en «Fórmula polinómica» (PRE-02), a partir de las incidencias del APU"
                >
                  Fórmula del presupuesto (PRE-02)
                </button>
                <button
                  type="button"
                  className={state.formulaOrigen === "manual" ? "on" : ""}
                  onClick={() => setState((s) => usarFormulaManual(s))}
                  title="Arma la fórmula aquí mismo, monomio por monomio (o impórtela de un .csv del expediente técnico)"
                >
                  Fórmula manual (expediente técnico)
                </button>
              </div>

              {state.formulaOrigen === "manual" ? (
                <>
                  <div className="valz-filter valz-csv-bar">
                    <button type="button" onClick={() => setState((s) => agregarMonomioManual(s))}>
                      + Monomio
                    </button>
                    <button type="button" onClick={() => formulaFileRef.current?.click()} title="CSV con columnas: Letra, Codigo IU, Coeficiente, Io">
                      Importar fórmula (.csv)
                    </button>
                    <button type="button" onClick={descargarPlantillaFormula}>
                      Descargar plantilla
                    </button>
                    <button type="button" className="valz-help-btn" onClick={() => setAyudaFormulaOpen(true)} title="Cómo armar o importar la fórmula manual">
                      ?
                    </button>
                    <input ref={formulaFileRef} type="file" accept=".csv,.txt" hidden onChange={onArchivoFormula} />
                    <span className={Math.abs(sumaCoeficientesManual(state.formulaManual) - 1) > 0.001 ? "crit" : ""}>
                      Σ coeficientes = {sumaCoeficientesManual(state.formulaManual).toFixed(3)}
                      {Math.abs(sumaCoeficientesManual(state.formulaManual) - 1) > 0.001 ? " (debe sumar 1.000)" : " ✓"}
                    </span>
                  </div>

                  {state.formulaManual.monomios.length === 0 ? (
                    <p className="pre-empty">
                      Aún no hay monomios. Use «+ Monomio» para agregarlos uno por uno, o «Importar fórmula (.csv)» para
                      traer de una vez la fórmula del expediente técnico.
                    </p>
                  ) : (
                    <div className="msp-sheet valz-sheet">
                      <table>
                        <thead>
                          <tr>
                            <th>Letra</th>
                            <th>Índice unificado</th>
                            <th className="n">Coeficiente</th>
                            <th className="n">Io (mes base)</th>
                            <th className="n">Ir (mes de esta valorización)</th>
                            <th className="n">Ir/Io</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {state.formulaManual.monomios.map((m) => {
                            const calc = reajuste?.monomios.find((rm) => rm.iu === m.codigoIU);
                            return (
                              <tr key={m.id}>
                                <td className="n">
                                  <input
                                    className="valz-letra-input"
                                    value={m.letra}
                                    maxLength={2}
                                    onChange={(e) => setState((s) => actualizarMonomioManual(s, m.id, { letra: e.target.value.toLowerCase() }))}
                                  />
                                </td>
                                <td>
                                  <select
                                    value={m.codigoIU}
                                    onChange={(e) =>
                                      setState((s) =>
                                        actualizarMonomioManual(s, m.id, {
                                          codigoIU: parseInt(e.target.value, 10),
                                          io: IU_BY_CODIGO[parseInt(e.target.value, 10)]?.io ?? m.io,
                                        }),
                                      )
                                    }
                                  >
                                    {INDICES_UNIFICADOS.map((iu) => (
                                      <option key={iu.codigo} value={iu.codigo}>
                                        {codigoIU(iu.codigo)} · {iu.simbolo} · {iu.nombre}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="n">
                                  <input
                                    type="number"
                                    min={0}
                                    max={1}
                                    step="0.001"
                                    value={m.coeficiente}
                                    onChange={(e) => setState((s) => actualizarMonomioManual(s, m.id, { coeficiente: parseFloat(e.target.value) || 0 }))}
                                  />
                                </td>
                                <td className="n">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={m.io}
                                    onChange={(e) => setState((s) => actualizarMonomioManual(s, m.id, { io: parseFloat(e.target.value) || 0 }))}
                                  />
                                </td>
                                <td className="n">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={calc?.ir ?? m.io}
                                    onChange={(e) =>
                                      setState((s) =>
                                        actualizarPeriodo(s, periodo.id, {
                                          indicesIrPeriodo: patchIndiceIrPeriodo(periodo, m.codigoIU, parseFloat(e.target.value) || 0),
                                        }),
                                      )
                                    }
                                  />
                                </td>
                                <td className="n mono">{(calc?.ratio ?? 1).toFixed(4)}</td>
                                <td>
                                  <button type="button" className="valz-row-del" title="Quitar monomio" onClick={() => setState((s) => quitarMonomioManual(s, m.id))}>
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : null}

              {!reajuste?.aplicable ? (
                state.formulaOrigen === "presupuesto" ? (
                  <p className="pre-empty">
                    Aún no se generó la fórmula polinómica del presupuesto. Vaya a «Fórmula polinómica» (PRE-02) y cree la
                    fórmula, o arme una fórmula manual aquí mismo con el botón de arriba.
                  </p>
                ) : null
              ) : (
                <>
                  <div className="valz-filter">
                    <label className="valz-mes-label">
                      Mes de esta valorización
                      <input
                        type="month"
                        value={periodo.mesValorizacion}
                        onChange={(e) => setState((s) => actualizarPeriodo(s, periodo.id, { mesValorizacion: e.target.value }))}
                      />
                    </label>
                    <span>{reajuste.texto}</span>
                  </div>
                  {state.formulaOrigen === "presupuesto" ? (
                    <div className="valz-filter valz-csv-bar">
                      <button type="button" onClick={() => indicesFileRef.current?.click()} title="CSV con columnas: Letra o Código IU, e Índice Ir">
                        Importar índices Ir (.csv)
                      </button>
                      <button type="button" onClick={descargarPlantillaIndices}>
                        Descargar plantilla
                      </button>
                      <button type="button" className="valz-help-btn" onClick={() => setAyudaIndicesOpen(true)} title="Cómo importar los índices Ir desde CSV">
                        ?
                      </button>
                      <input ref={indicesFileRef} type="file" accept=".csv,.txt" hidden onChange={onArchivoIndices} />
                    </div>
                  ) : null}
                  {state.formulaOrigen === "presupuesto" ? (
                    <div className="msp-sheet valz-sheet">
                      <table>
                        <thead>
                          <tr>
                            <th>Monomio</th>
                            <th>Índice unificado</th>
                            <th className="n">Coeficiente</th>
                            <th className="n">Io (mes base)</th>
                            <th className="n">Ir (mes de esta valorización)</th>
                            <th className="n">Ir/Io</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reajuste.monomios.map((m) => (
                            <tr key={m.iu}>
                              <td className="mono">{m.letra}</td>
                              <td>
                                IU {m.codigoIu} · {m.nombre}
                              </td>
                              <td className="n mono">{m.coeficiente.toFixed(3)}</td>
                              <td className="n mono">{m.io.toFixed(2)}</td>
                              <td className="n">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={m.ir}
                                  onChange={(e) =>
                                    setState((s) =>
                                      actualizarPeriodo(s, periodo.id, {
                                        indicesIrPeriodo: patchIndiceIrPeriodo(periodo, m.iu, parseFloat(e.target.value) || 0),
                                      }),
                                    )
                                  }
                                />
                              </td>
                              <td className="n mono">{m.ratio.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  <div className="msp-sheet valz-sheet">
                    <table>
                      <tfoot>
                        <tr>
                          <td colSpan={5}>Costo directo del periodo (base a reajustar)</td>
                          <td className="n mono">{money2(reajuste.costoDirectoBase)}</td>
                        </tr>
                        <tr>
                          <td colSpan={5}>Reajuste (K = {reajuste.k.toFixed(4)})</td>
                          <td className="n mono">{money2(reajuste.reajuste)}</td>
                        </tr>
                        <tr className="sum">
                          <td colSpan={5}>Costo directo reajustado</td>
                          <td className="n mono">{money2(reajuste.costoDirectoReajustado)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {vista === "adelantos" ? (
            <div className="msp-body valz-body">
              <p className="valz-hint">
                Amortización de adelantos y penalidad por mora (Ley N.° 32069, arts. 178-181 y 120). El adelanto
                directo se amortiza en cuotas proporcionales sobre el monto bruto de cada valorización; el de
                materiales, según su consumo real en obra. La penalidad se calcula por cada día de atraso
                injustificado imputable al contratista, hasta un tope del 10 % del monto contractual vigente.
              </p>
              <div className="msp-ribbon valz-adelantos-config" role="toolbar">
                <fieldset>
                  <legend>Adelanto directo</legend>
                  <label>
                    Monto otorgado (S/.)
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={state.adelantos.directoMonto}
                      onChange={(e) => setState((s) => actualizarAdelantos(s, { directoMonto: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    />
                  </label>
                  <label>
                    % del contrato original
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={state.adelantos.directoPct}
                      onChange={(e) => setState((s) => actualizarAdelantos(s, { directoPct: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    />
                  </label>
                  <label>
                    Fecha de entrega
                    <input
                      type="date"
                      value={state.adelantos.directoFecha}
                      onChange={(e) => setState((s) => actualizarAdelantos(s, { directoFecha: e.target.value }))}
                    />
                  </label>
                </fieldset>
                <fieldset>
                  <legend>Adelanto para materiales</legend>
                  <label>
                    Monto otorgado (S/.)
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={state.adelantos.materialesMonto}
                      onChange={(e) => setState((s) => actualizarAdelantos(s, { materialesMonto: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    />
                  </label>
                  <label>
                    Fecha de entrega
                    <input
                      type="date"
                      value={state.adelantos.materialesFecha}
                      onChange={(e) => setState((s) => actualizarAdelantos(s, { materialesFecha: e.target.value }))}
                    />
                  </label>
                </fieldset>
                <fieldset>
                  <legend>Plazo y penalidad</legend>
                  <label>
                    Plazo contractual vigente (días)
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={state.plazoContractualDias}
                      onChange={(e) => setState((s) => actualizarPlazoContractual(s, parseFloat(e.target.value) || 0))}
                    />
                  </label>
                  <span className="valz-hint-inline">
                    F = {penalidad ? penalidad.factorF.toFixed(2) : "0.40"} ({state.plazoContractualDias > 60 ? "obra, plazo > 60 días" : "plazo ≤ 60 días"})
                  </span>
                </fieldset>
              </div>

              <p className="valz-hint">Amortización y atraso de «{periodo.nombre}» (periodo seleccionado):</p>
              <div className="msp-ribbon valz-adelantos-config" role="toolbar">
                <fieldset>
                  <legend>Adelanto directo</legend>
                  <label>
                    Amortizado este periodo (S/.)
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={periodo.amortizacionDirecto}
                      disabled={periodo.estado === "cerrada"}
                      onChange={(e) => onAmortizacionDirecto(parseFloat(e.target.value) || 0)}
                    />
                  </label>
                  <button type="button" onClick={aplicarCuotaSugerida} disabled={periodo.estado === "cerrada"} title="Cuota proporcional sugerida según el % del adelanto y el monto bruto de este periodo">
                    Usar cuota sugerida ({money2(adelantosResumen?.cuotaDirectoSugerida ?? 0)})
                  </button>
                  <span className="valz-hint-inline">Saldo pendiente: S/ {money2(adelantosResumen?.saldoAdelantoDirecto ?? 0)}</span>
                </fieldset>
                <fieldset>
                  <legend>Adelanto de materiales</legend>
                  <label>
                    Amortizado este periodo (S/.)
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={periodo.amortizacionMateriales}
                      disabled={periodo.estado === "cerrada"}
                      onChange={(e) => onAmortizacionMateriales(parseFloat(e.target.value) || 0)}
                    />
                  </label>
                  <span className="valz-hint-inline">Saldo pendiente: S/ {money2(adelantosResumen?.saldoAdelantoMateriales ?? 0)}</span>
                </fieldset>
                <fieldset>
                  <legend>Penalidad por mora</legend>
                  <label>
                    Días de atraso injustificado
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={periodo.diasAtrasoInjustificado}
                      disabled={periodo.estado === "cerrada"}
                      onChange={(e) => onDiasAtraso(parseFloat(e.target.value) || 0)}
                    />
                  </label>
                  <span className={`valz-hint-inline ${penalidad?.topeAlcanzado ? "crit" : ""}`}>
                    Penalidad diaria: S/ {money2(penalidad?.penalidadDiaria ?? 0)} · este periodo: S/ {money2(penalidad?.penalidadPeriodo ?? 0)}
                    {penalidad?.topeAlcanzado ? " · TOPE DEL 10% ALCANZADO" : ""}
                  </span>
                </fieldset>
              </div>

              {liquidacion ? (
                <div className="valz-curva-kpis">
                  <div>
                    <span>Valorización bruta (con reajuste)</span>
                    <b>{money2(liquidacion.montoBruto)}</b>
                  </div>
                  <div>
                    <span>Amortizaciones + penalidad</span>
                    <b>- {money2(liquidacion.amortizacionDirecto + liquidacion.amortizacionMateriales + liquidacion.penalidad)}</b>
                  </div>
                  <div>
                    <span>Monto neto a pagar</span>
                    <b>{money2(liquidacion.montoNetoAPagar)}</b>
                  </div>
                </div>
              ) : null}

              <div className="msp-sheet valz-sheet">
                <table>
                  <thead>
                    <tr>
                      <th>Periodo</th>
                      <th className="n">Amortiz. directo</th>
                      <th className="n">Saldo directo</th>
                      <th className="n">Amortiz. materiales</th>
                      <th className="n">Saldo materiales</th>
                      <th className="n">Días atraso</th>
                      <th className="n">Penalidad periodo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialAdelantos.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="pre-empty">
                          Aún no hay periodos de valorización.
                        </td>
                      </tr>
                    ) : (
                      historialAdelantos.map((h) => (
                        <tr key={h.periodo.id} className={h.periodo.id === periodo.id ? "on" : ""}>
                          <td>{h.periodo.nombre}</td>
                          <td className="n mono">{money2(h.adelantos.amortizacionDirectoPeriodo)}</td>
                          <td className="n mono">{money2(h.adelantos.saldoAdelantoDirecto)}</td>
                          <td className="n mono">{money2(h.adelantos.amortizacionMaterialesPeriodo)}</td>
                          <td className="n mono">{money2(h.adelantos.saldoAdelantoMateriales)}</td>
                          <td className="n mono">{h.periodo.diasAtrasoInjustificado}</td>
                          <td className="n mono">{money2(h.penalidad.penalidadPeriodo)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {vista === "curva" ? (
            <div className="msp-body valz-body valz-curva-body">
              <p className="valz-hint">
                Calendario de avance de obra valorizado y curva «S»: programado según el cronograma (Gantt/CPM) frente a lo
                ejecutado y pagado en cada valorización. Si no tiene un cronograma armado, o prefiere el programado que ya
                trae de su expediente técnico, impórtelo directamente de un .csv (% o monto acumulado por periodo).
              </p>
              <div className="valz-filter valz-csv-bar">
                <button type="button" onClick={() => programadoFileRef.current?.click()} title="CSV con columnas: Periodo (o Hasta) y Programado acumulado (% o S/.)">
                  Importar programado (.csv)
                </button>
                <button type="button" onClick={descargarPlantillaProgramado}>
                  Descargar plantilla
                </button>
                <button type="button" className="valz-help-btn" onClick={() => setAyudaProgramadoOpen(true)} title="Cómo importar el programado desde CSV">
                  ?
                </button>
                {curva.puntos.some((p) => p.origenProgramado === "csv") ? (
                  <button type="button" onClick={usarCronogramaProgramado} title="Descarta el programado importado y vuelve a calcularlo del cronograma">
                    Usar cronograma (Gantt)
                  </button>
                ) : null}
                <input ref={programadoFileRef} type="file" accept=".csv,.txt" hidden onChange={onArchivoProgramado} />
              </div>
              <div className="valz-curva-kpis">
                <div>
                  <span>Programado a la fecha</span>
                  <b>{(ultimoResumen?.programadoAcumuladoPct ?? 0).toFixed(1)}%</b>
                </div>
                <div>
                  <span>Ejecutado a la fecha</span>
                  <b>{(ultimoResumen?.ejecutadoAcumuladoPct ?? 0).toFixed(1)}%</b>
                </div>
                <div>
                  <span>Desviación</span>
                  <b className={(ultimoResumen?.ejecutadoAcumuladoPct ?? 0) < (ultimoResumen?.programadoAcumuladoPct ?? 0) ? "crit" : ""}>
                    {((ultimoResumen?.ejecutadoAcumuladoPct ?? 0) - (ultimoResumen?.programadoAcumuladoPct ?? 0)).toFixed(1)} pp
                  </b>
                </div>
              </div>
              <CurvaSChart puntos={curva.puntos} />
              <div className="msp-sheet valz-sheet">
                <table>
                  <thead>
                    <tr>
                      <th>Periodo</th>
                      <th>Al</th>
                      <th className="n">Programado acum.</th>
                      <th className="n">% Prog.</th>
                      <th className="n">Ejecutado acum.</th>
                      <th className="n">% Ejec.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {curva.puntos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="pre-empty">
                          Importe partidas al Gantt (pestaña Cronograma) o el programado por «Importar programado (.csv)»
                          para calcular la curva S.
                        </td>
                      </tr>
                    ) : (
                      curva.puntos.map((p) => (
                        <tr key={p.periodoId} className={p.periodoId === periodo.id ? "on" : ""}>
                          <td>
                            {p.label}
                            {p.origenProgramado === "csv" ? <span className="valz-badge valz-badge-csv">CSV</span> : null}
                          </td>
                          <td className="mono">{fechaCorta(p.hasta)}</td>
                          <td className="n mono">{money2(p.programadoAcumuladoMonto)}</td>
                          <td className="n mono">{p.programadoAcumuladoPct.toFixed(1)}%</td>
                          <td className="n mono">{money2(p.ejecutadoAcumuladoMonto)}</td>
                          <td className="n mono">{p.ejecutadoAcumuladoPct.toFixed(1)}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}

      {nuevoOpen ? (
        <div className="msp-modal" role="dialog" aria-labelledby="valz-new-title">
          <div className="msp-modal-card">
            <header>
              <h3 id="valz-new-title">Nueva valorización</h3>
              <button type="button" onClick={() => setNuevoOpen(false)}>
                Cerrar
              </button>
            </header>
            <div className="msp-cal-grid">
              <label>
                Frecuencia
                <select value={frecSel} onChange={(e) => setFrecSel(e.target.value as FrecuenciaValorizacion)}>
                  {(Object.keys(FRECUENCIA_META) as FrecuenciaValorizacion[]).map((f) => (
                    <option key={f} value={f}>
                      {FRECUENCIA_META[f].label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fecha de inicio (opcional)
                <input type="date" value={desdeManual} onChange={(e) => setDesdeManual(e.target.value)} />
              </label>
            </div>
            <p className="valz-hint">
              Se importan automáticamente todas las partidas del presupuesto vigente, con el metrado ya ejecutado en
              valorizaciones anteriores como «metrado anterior».
            </p>
            <div className="valz-modal-actions">
              <button type="button" className="btn primary" onClick={crearPeriodo}>
                Crear valorización
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adicOpen ? (
        <div className="msp-modal" role="dialog" aria-labelledby="valz-adic-title">
          <div className="msp-modal-card">
            <header>
              <h3 id="valz-adic-title">{adicTipo === "adicional" ? "Prestación adicional de obra" : "Presupuesto deductivo"}</h3>
              <button type="button" onClick={() => setAdicOpen(false)}>
                Cerrar
              </button>
            </header>
            <div className="msp-cal-grid">
              <label style={{ gridColumn: "1 / -1" }}>
                Descripción
                <input
                  value={adicDescripcion}
                  onChange={(e) => setAdicDescripcion(e.target.value)}
                  placeholder={adicTipo === "adicional" ? "Descripción del trabajo adicional" : "Descripción de la partida que se deja de ejecutar"}
                />
              </label>
              <label>
                Unidad
                <input value={adicUnd} onChange={(e) => setAdicUnd(e.target.value)} />
              </label>
              <label>
                Precio unitario (S/)
                <input type="number" min={0} step="0.01" value={adicPu} onChange={(e) => setAdicPu(parseFloat(e.target.value) || 0)} />
              </label>
              <label>
                Metrado {adicTipo === "adicional" ? "ejecutado" : "deducido"} este periodo
                <input type="number" min={0} step="0.01" value={adicMetrado} onChange={(e) => setAdicMetrado(parseFloat(e.target.value) || 0)} />
              </label>
              {adicTipo === "deductivo" ? (
                <label style={{ gridColumn: "1 / -1" }}>
                  Código del adicional vinculado (opcional)
                  <input value={adicVinculado} onChange={(e) => setAdicVinculado(e.target.value)} placeholder="Ej. ADIC-1.1" />
                </label>
              ) : null}
            </div>
            <p className="valz-hint">
              Parcial estimado: {moneyMon(adicPu * adicMetrado, "PEN")}. El código se genera automáticamente (
              {adicTipo === "adicional" ? "ADIC" : "DEDUC"}-{periodo?.numero ?? 1}.N).
            </p>
            <div className="valz-modal-actions">
              <button type="button" className="btn primary" onClick={confirmarAdicional}>
                {adicTipo === "adicional" ? "Agregar partida adicional" : "Agregar partida deductiva"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ayudaOpen ? (
        <div className="msp-modal" role="dialog" aria-labelledby="valz-ayuda-title">
          <div className="msp-modal-card valz-ayuda-card">
            <header>
              <h3 id="valz-ayuda-title">Cómo importar el metrado ejecutado desde Excel</h3>
              <button type="button" onClick={() => setAyudaOpen(false)}>
                Cerrar
              </button>
            </header>
            <p>
              El archivo debe estar en formato <b>.csv</b> (texto separado por comas). En Excel: <b>Archivo → Guardar como →
              CSV UTF-8 (delimitado por comas)</b>. También se aceptan archivos separados por punto y coma o por tabulación
              (se detectan solos), y se puede editar el .csv directamente en Excel o en Google Sheets.
            </p>
            <p>
              La primera fila debe tener los <b>nombres de columna</b>. Se necesitan estas dos, con cualquiera de estos
              nombres (mayúsculas/minúsculas y tildes no importan):
            </p>
            <table className="valz-ayuda-table">
              <thead>
                <tr>
                  <th>Columna</th>
                  <th>Nombres aceptados</th>
                  <th>Obligatoria</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Código de partida</td>
                  <td className="mono">Código · Codigo · Item · Partida</td>
                  <td>Sí</td>
                </tr>
                <tr>
                  <td>Metrado ejecutado</td>
                  <td className="mono">Metrado periodo · Metrado ejecutado · Ejecutado · Metrado · Cantidad</td>
                  <td>Sí</td>
                </tr>
                <tr>
                  <td>Descripción</td>
                  <td className="mono">Descripción · Descripcion</td>
                  <td>No — solo si el código es nuevo</td>
                </tr>
                <tr>
                  <td>Unidad</td>
                  <td className="mono">Unidad · Und · Ud</td>
                  <td>No — solo si el código es nuevo</td>
                </tr>
                <tr>
                  <td>Precio unitario</td>
                  <td className="mono">Precio unitario · P.U. · Pu</td>
                  <td>No — solo si el código es nuevo</td>
                </tr>
              </tbody>
            </table>
            <p className="valz-hint">
              Si el <b>código</b> de una fila ya existe en la tabla de este periodo, solo se actualiza su metrado ejecutado
              (las demás columnas se ignoran). Si el código no existe, se agrega como <b>partida adicional</b> usando la
              descripción, unidad y precio unitario del archivo.
            </p>
            <p className="valz-hint">Ejemplo de contenido válido:</p>
            <pre className="valz-ayuda-ejemplo">{`Codigo,Descripcion,Unidad,Metrado periodo
ARQ-01.01.01,Trazo y replanteo de ejes,m2,180
ARQ-05.01.01,Muro de ladrillo KK,m2,84.5`}</pre>
            <div className="valz-modal-actions" style={{ justifyContent: "space-between" }}>
              <button type="button" onClick={descargarPlantilla} disabled={!periodo}>
                Descargar plantilla de este periodo
              </button>
              <button type="button" className="btn primary" onClick={() => setAyudaOpen(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ayudaIndicesOpen ? (
        <div className="msp-modal" role="dialog" aria-labelledby="valz-ayuda-ir-title">
          <div className="msp-modal-card valz-ayuda-card">
            <header>
              <h3 id="valz-ayuda-ir-title">Cómo importar los índices Ir desde Excel</h3>
              <button type="button" onClick={() => setAyudaIndicesOpen(false)}>
                Cerrar
              </button>
            </header>
            <p>
              El archivo debe estar en formato <b>.csv</b>. En Excel: <b>Archivo → Guardar como → CSV UTF-8 (delimitado por
              comas)</b>. Sirve para cargar de una sola vez el índice Ir del mes de todos los monomios de la fórmula
              polinómica, en vez de escribirlos uno por uno en la tabla.
            </p>
            <p>
              La primera fila debe tener los <b>nombres de columna</b>. Se necesitan estas dos, con cualquiera de estos
              nombres (mayúsculas/minúsculas y tildes no importan):
            </p>
            <table className="valz-ayuda-table">
              <thead>
                <tr>
                  <th>Columna</th>
                  <th>Nombres aceptados</th>
                  <th>Obligatoria</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Monomio</td>
                  <td className="mono">Letra · Código IU · Codigo · IU · Índice</td>
                  <td>Sí</td>
                </tr>
                <tr>
                  <td>Índice Ir</td>
                  <td className="mono">Ir · Índice Ir</td>
                  <td>Sí</td>
                </tr>
              </tbody>
            </table>
            <p className="valz-hint">
              Cada fila se calza con un monomio de la fórmula vigente por su <b>letra</b> (A, B, C…) o por su{" "}
              <b>código de índice unificado (IU)</b>; las filas que no calcen con ningún monomio se avisan y se ignoran. Use
              «Descargar plantilla» para obtener ya armadas las filas de la fórmula de este presupuesto.
            </p>
            <p className="valz-hint">Ejemplo de contenido válido:</p>
            <pre className="valz-ayuda-ejemplo">{`Letra,Codigo IU,Nombre,Io,Ir
A,47,Mano de obra,850.12,912.44
B,21,Cemento,610.30,634.02`}</pre>
            <div className="valz-modal-actions" style={{ justifyContent: "space-between" }}>
              <button type="button" onClick={descargarPlantillaIndices} disabled={!reajuste?.aplicable}>
                Descargar plantilla de este presupuesto
              </button>
              <button type="button" className="btn primary" onClick={() => setAyudaIndicesOpen(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ayudaFormulaOpen ? (
        <div className="msp-modal" role="dialog" aria-labelledby="valz-ayuda-formula-title">
          <div className="msp-modal-card valz-ayuda-card">
            <header>
              <h3 id="valz-ayuda-formula-title">Cómo armar o importar la fórmula manual</h3>
              <button type="button" onClick={() => setAyudaFormulaOpen(false)}>
                Cerrar
              </button>
            </header>
            <p>
              La fórmula manual sirve cuando no quiere depender del presupuesto (por ejemplo, valorizará con la fórmula
              polinómica ya aprobada en el expediente técnico). Puede armarla monomio por monomio con «+ Monomio», o
              importar de una sola vez un <b>.csv</b> con toda la fórmula (Archivo → Guardar como → CSV UTF-8 en Excel).
            </p>
            <p>
              La primera fila debe tener los <b>nombres de columna</b>:
            </p>
            <table className="valz-ayuda-table">
              <thead>
                <tr>
                  <th>Columna</th>
                  <th>Nombres aceptados</th>
                  <th>Obligatoria</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Letra</td>
                  <td className="mono">Letra · Monomio</td>
                  <td>No — se asigna sola si falta</td>
                </tr>
                <tr>
                  <td>Código IU</td>
                  <td className="mono">Codigo IU · IU · Índice · Codigo</td>
                  <td>Sí</td>
                </tr>
                <tr>
                  <td>Coeficiente</td>
                  <td className="mono">Coeficiente · Coef · Participación · %</td>
                  <td>Sí</td>
                </tr>
                <tr>
                  <td>Io (mes base)</td>
                  <td className="mono">Io · Índice Io</td>
                  <td>No — usa 100 si falta</td>
                </tr>
              </tbody>
            </table>
            <p className="valz-hint">
              La suma de los coeficientes debe ser 1.000 (100 %); si escribe un coeficiente mayor a 1 en el .csv (por
              ejemplo, 64.6), se interpreta como porcentaje y se divide entre 100 automáticamente. Importar la fórmula
              reemplaza por completo la fórmula manual vigente.
            </p>
            <p className="valz-hint">Ejemplo de contenido válido:</p>
            <pre className="valz-ayuda-ejemplo">{`Letra,Codigo IU,Nombre,Coeficiente,Io
a,47,Mano de obra,0.646,100
b,48,Maquinaria y equipo nacional,0.328,100
c,39,Índice general,0.026,100`}</pre>
            <div className="valz-modal-actions" style={{ justifyContent: "space-between" }}>
              <button type="button" onClick={descargarPlantillaFormula}>
                Descargar plantilla
              </button>
              <button type="button" className="btn primary" onClick={() => setAyudaFormulaOpen(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ayudaProgramadoOpen ? (
        <div className="msp-modal" role="dialog" aria-labelledby="valz-ayuda-prog-title">
          <div className="msp-modal-card valz-ayuda-card">
            <header>
              <h3 id="valz-ayuda-prog-title">Cómo importar el programado de la curva S desde Excel</h3>
              <button type="button" onClick={() => setAyudaProgramadoOpen(false)}>
                Cerrar
              </button>
            </header>
            <p>
              El archivo debe estar en formato <b>.csv</b>. En Excel: <b>Archivo → Guardar como → CSV UTF-8 (delimitado por
              comas)</b>. Permite fijar el programado acumulado de cada valorización sin necesidad de tener armado el
              cronograma (Gantt/CPM) del presupuesto: por ejemplo, con la curva S del expediente técnico aprobado.
            </p>
            <p>
              La primera fila debe tener los <b>nombres de columna</b>. Se necesita identificar el periodo y el valor
              programado:
            </p>
            <table className="valz-ayuda-table">
              <thead>
                <tr>
                  <th>Columna</th>
                  <th>Nombres aceptados</th>
                  <th>Obligatoria</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Periodo</td>
                  <td className="mono">Periodo · Valorización · Nombre · N.° · Número</td>
                  <td>Sí (o «Hasta»)</td>
                </tr>
                <tr>
                  <td>Hasta (fecha fin, AAAA-MM-DD)</td>
                  <td className="mono">Hasta · Al · Fecha</td>
                  <td>Sí (o «Periodo»)</td>
                </tr>
                <tr>
                  <td>Programado acumulado (%)</td>
                  <td className="mono">cualquier columna cuyo nombre incluya «%»</td>
                  <td>Sí (o el monto en S/.)</td>
                </tr>
                <tr>
                  <td>Programado acumulado (S/.)</td>
                  <td className="mono">Monto · S/. · Soles</td>
                  <td>Sí (o el % )</td>
                </tr>
              </tbody>
            </table>
            <p className="valz-hint">
              Cada fila se calza con un periodo existente por su <b>nombre</b>, su <b>número</b> o su fecha «Hasta»; las
              filas que no calcen se avisan y se ignoran — cree antes las valorizaciones necesarias. Use «Descargar
              plantilla» para obtener el programado calculado del cronograma vigente y solo ajustar los valores.
            </p>
            <p className="valz-hint">Ejemplo de contenido válido:</p>
            <pre className="valz-ayuda-ejemplo">{`Periodo,Hasta,Programado acumulado (%),Programado acumulado (S/.)
Valorización N.° 1,2026-01-31,18.50,92500.00
Valorización N.° 2,2026-02-28,41.00,205000.00`}</pre>
            <div className="valz-modal-actions" style={{ justifyContent: "space-between" }}>
              <button type="button" onClick={descargarPlantillaProgramado}>
                Descargar plantilla
              </button>
              <button type="button" className="btn primary" onClick={() => setAyudaProgramadoOpen(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type SubBloque = { clave: string; titulo: string; items: ItemCalc[] };
type CapBloque = { capitulo: string; num: string; nombre: string; items: ItemCalc[]; subs: SubBloque[] };
type EspBloque = { especialidad: EspecialidadPre; label: string; items: ItemCalc[]; capitulos: CapBloque[] };

const ESPECIALIDAD_POR_LABEL: Record<string, EspecialidadPre> = Object.fromEntries(
  (Object.entries(ESPECIALIDAD_META) as [EspecialidadPre, { label: string }][]).map(([key, meta]) => [meta.label, key]),
);

/** Agrupa las partidas contractuales por especialidad → capítulo → subcapítulo, igual que la Hoja de Presupuesto,
 *  a partir del capítulo/especialidad ya guardados en cada ítem (se fijan al importar del presupuesto). Las
 *  partidas sin capítulo (código fuera de catálogo, o valorizaciones creadas antes de este agrupamiento) van sueltas
 *  en un bloque final "Sin capítulo", sin romper lo ya registrado. */
function agruparPorCapitulos(items: ItemCalc[]): { especialidades: EspBloque[]; sinCapitulo: ItemCalc[] } {
  const porEsp = new Map<string, EspBloque>();
  const sinCapitulo: ItemCalc[] = [];
  for (const it of items) {
    if (!it.capitulo) {
      sinCapitulo.push(it);
      continue;
    }
    const label = it.especialidad || "Sin especialidad";
    let esp = porEsp.get(label);
    if (!esp) {
      esp = { especialidad: ESPECIALIDAD_POR_LABEL[label] || ("otros" as EspecialidadPre), label, items: [], capitulos: [] };
      porEsp.set(label, esp);
    }
    esp.items.push(it);
    let cap = esp.capitulos.find((c) => c.capitulo === it.capitulo);
    if (!cap) {
      const tit = partesTituloCapitulo(it.capitulo);
      cap = { capitulo: it.capitulo, num: tit.num, nombre: tit.nombre, items: [], subs: [] };
      esp.capitulos.push(cap);
    }
    cap.items.push(it);
  }
  for (const esp of porEsp.values()) {
    esp.capitulos.sort((a, b) => compararCapitulos(a.capitulo, b.capitulo));
    for (const cap of esp.capitulos) {
      const gruposSub = new Map<string, ItemCalc[]>();
      for (const it of cap.items) {
        const key = (it.origenCodigo ? claveSubcapitulo(it.origenCodigo) : "") || "_";
        const arr = gruposSub.get(key) ?? [];
        arr.push(it);
        gruposSub.set(key, arr);
      }
      cap.subs = [...gruposSub.entries()].map(([clave, subItems]) => ({
        clave,
        titulo: (subItems[0]?.origenCodigo ? etiquetaSubcapitulo(subItems[0].origenCodigo) : "") || clave,
        items: subItems,
      }));
    }
  }
  const especialidades = [...porEsp.values()].sort(
    (a, b) => (ESPECIALIDAD_META[a.especialidad]?.orden ?? 999) - (ESPECIALIDAD_META[b.especialidad]?.orden ?? 999),
  );
  return { especialidades, sinCapitulo };
}

function sumar(items: ItemCalc[], campo: "montoContractual" | "montoPeriodo" | "montoAcumulado" | "saldoMonto") {
  return items.reduce((s, it) => s + it[campo], 0);
}

function FilaValorItem({
  it,
  periodo,
  onMetrado,
}: {
  it: ItemCalc;
  periodo: { estado: "abierta" | "cerrada" };
  onMetrado: (itemId: string, v: number) => void;
}) {
  return (
    <tr className={it.avancePct >= 100 ? "sum" : ""}>
      <td className="mono">{it.codigo}</td>
      <td>{it.descripcion}</td>
      <td>{it.und}</td>
      <td className="n mono">{it.metradoContractual.toLocaleString("es-PE")}</td>
      <td className="n mono">{it.precioUnitario.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
      <td className="n mono">{money2(it.montoContractual)}</td>
      <td className="n mono">{it.metradoAnterior.toLocaleString("es-PE")}</td>
      <td className="n mono">{money2(it.montoAnterior)}</td>
      <td className="n mono">{pct1(it.avancePctAnterior)}</td>
      <td className="n">
        <input
          type="number"
          min={0}
          step="0.01"
          value={it.metradoPeriodo}
          disabled={periodo.estado === "cerrada"}
          onChange={(e) => onMetrado(it.id, parseFloat(e.target.value) || 0)}
        />
      </td>
      <td className="n mono">{money2(it.montoPeriodo)}</td>
      <td className="n mono">{pct1(it.avancePctPeriodo)}</td>
      <td className="n mono">{it.metradoAcumulado.toLocaleString("es-PE")}</td>
      <td className="n mono">{money2(it.montoAcumulado)}</td>
      <td className={`n mono ${it.avancePct >= 100 ? "crit" : ""}`}>{pct1(it.avancePct)}</td>
      <td className="n mono">{it.saldoMetrado.toLocaleString("es-PE")}</td>
      <td className="n mono">{money2(it.saldoMonto)}</td>
    </tr>
  );
}

function money2(n: number) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct1(n: number) {
  return `${n.toFixed(1)}%`;
}

function CurvaSChart({
  puntos,
}: {
  puntos: { label: string; programadoAcumuladoPct: number; ejecutadoAcumuladoPct: number }[];
}) {
  if (!puntos.length) return null;
  const W = 900;
  const H = 260;
  const pad = { l: 40, r: 16, t: 16, b: 34 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const n = puntos.length;
  const x = (i: number) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (pct: number) => pad.t + innerH - (Math.min(100, Math.max(0, pct)) / 100) * innerH;
  const pathOf = (get: (p: (typeof puntos)[number]) => number) =>
    puntos.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(get(p)).toFixed(1)}`).join(" ");

  return (
    <div className="valz-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Curva S programada versus ejecutada">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} className="valz-grid" />
            <text x={pad.l - 8} y={y(g) + 3} textAnchor="end" className="valz-axis">
              {g}%
            </text>
          </g>
        ))}
        {puntos.map((p, i) => (
          <text key={p.label} x={x(i)} y={H - 8} textAnchor="middle" className="valz-axis">
            {p.label}
          </text>
        ))}
        <path d={pathOf((p) => p.programadoAcumuladoPct)} className="valz-line prog" />
        <path d={pathOf((p) => p.ejecutadoAcumuladoPct)} className="valz-line ejec" />
        {puntos.map((p, i) => (
          <circle key={`p-${p.label}`} cx={x(i)} cy={y(p.programadoAcumuladoPct)} r={3.5} className="valz-dot prog" />
        ))}
        {puntos.map((p, i) => (
          <circle key={`e-${p.label}`} cx={x(i)} cy={y(p.ejecutadoAcumuladoPct)} r={3.5} className="valz-dot ejec" />
        ))}
      </svg>
      <div className="valz-legend">
        <span className="prog">Programado (Gantt/CPM)</span>
        <span className="ejec">Ejecutado (valorizado)</span>
      </div>
    </div>
  );
}
