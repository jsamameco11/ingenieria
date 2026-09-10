import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  CONSTRAINT_META,
  addDays,
  calendarDaysBetween,
  durationFromRendimiento,
  emptyTask,
  feriadosPeru,
  formatPred,
  hoursFromRange,
  importarDesdePresupuesto,
  indentTasks,
  isWorking,
  linkChain,
  linkTasks,
  loadCronograma,
  cronogramaVacioLigado,
  exportarCronogramaXlsx,
  netHoursPerDay,
  parseISO,
  parsePred,
  PRED_META,
  rendimientoFromDuration,
  resumenVinculo,
  saveCronograma,
  schedule,
  toISO,
  uidTask,
  unlinkPair,
  unlinkSelected,
  updateLink,
  wouldCycle,
  type ConstraintType,
  type CronoComputed,
  type CronogramaState,
  type Holiday,
  type PredType,
  type ZoomCrono,
} from "../lib/cronograma";
import { loadPresupuesto, moneyMon } from "../lib/presupuesto";
import { useUndoableState } from "../lib/undoHistory";
import { curvaSMensual } from "../lib/valorizaciones";
import { UndoButtons } from "../ui/UndoButtons";

const PX: Record<ZoomCrono, number> = { day: 28, week: 14, month: 4 };
const ROW_H = 28;

function tipoDesdeAsas(from: "S" | "F", to: "S" | "F"): PredType {
  if (from === "F" && to === "S") return "FS";
  if (from === "S" && to === "S") return "SS";
  if (from === "F" && to === "F") return "FF";
  return "SF";
}

function codo(x1: number, y1: number, x2: number, y2: number) {
  const mid = x1 < x2 ? (x1 + x2) / 2 : x1 + 16;
  if (Math.abs(y1 - y2) < 2) return `M ${x1} ${y1} H ${x2}`;
  if (x2 >= x1 + 14) return `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`;
  return `M ${x1} ${y1} H ${x1 + 12} V ${(y1 + y2) / 2} H ${x2 - 12} V ${y2} H ${x2}`;
}

function predLabel(t: CronoComputed, all: CronoComputed[]) {
  return formatPred(
    t.pred,
    all.map((x) => x)
  );
}

export function CronogramaModule() {
  const { state, setState, undo, redo, canUndo, canRedo } = useUndoableState(() => loadCronograma());
  const [vista, setVista] = useState<"gantt" | "pert" | "valorizado">("gantt");
  const [sel, setSel] = useState<string[]>([]);
  const [calOpen, setCalOpen] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [linkType, setLinkType] = useState<PredType>("FS");
  const [linkLag, setLinkLag] = useState(0);
  const [selLink, setSelLink] = useState<{ pred: string; succ: string } | null>(null);
  const [drag, setDrag] = useState<null | { fromId: string; from: "S" | "F"; x: number; y: number }>(null);
  const [linkMsg, setLinkMsg] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<HTMLDivElement>(null);
  const ganttInnerRef = useRef<HTMLDivElement>(null);
  const ganttRowsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(drag);
  const syncing = useRef(false);
  dragRef.current = drag;

  useEffect(() => {
    saveCronograma(state);
  }, [state]);

  const patch = (p: Partial<CronogramaState>) => setState((s) => ({ ...s, ...p }));
  const computed = useMemo(() => schedule(state), [state]);
  const visible = computed.filter((t) => !t.hidden);
  const vinculo = useMemo(() => resumenVinculo(loadPresupuesto(), state), [state]);

  const range = useMemo(() => {
    const starts = computed.map((t) => t.start).filter(Boolean);
    const finishes = computed.map((t) => t.finish).filter(Boolean);
    const min = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : state.start;
    const max = finishes.length ? finishes.reduce((a, b) => (a > b ? a : b)) : state.start;
    const from = addDays(parseISO(min || state.start), -3);
    const to = addDays(parseISO(max || state.start), 21);
    return { from: toISO(from), to: toISO(to), days: calendarDaysBetween(toISO(from), toISO(to)) + 1 };
  }, [computed, state.start]);

  const px = PX[state.zoom];
  const today = toISO(new Date());
  const todayX = calendarDaysBetween(range.from, today) * px;
  const width = Math.max(800, range.days * px);

  const projectStart = computed.length ? computed.reduce((a, t) => (t.start && t.start < a ? t.start : a), computed[0].start) : state.start;
  const projectFinish = computed.length
    ? computed.reduce((a, t) => (t.finish && t.finish > a ? t.finish : a), computed[0].finish)
    : state.start;
  const critCount = computed.filter((t) => t.critical).length;
  const durProy = useMemo(() => {
    if (!projectStart || !projectFinish) return 0;
    // Plazo de obra en días calendario (como se pacta contractualmente en Perú), del inicio a la conclusión real
    // del proyecto — no la duración de la primera fila (que suele ser un hito de 0 días, ej. "Inicio de obra").
    return calendarDaysBetween(projectStart, projectFinish) + 1;
  }, [projectStart, projectFinish]);

  const pct = computed.length
    ? computed.filter((t) => !t.isSummary).reduce((s, t) => s + t.pct, 0) / Math.max(1, computed.filter((t) => !t.isSummary).length)
    : 0;

  const onSheetScroll = () => {
    if (syncing.current || !sheetRef.current || !ganttRef.current) return;
    syncing.current = true;
    ganttRef.current.scrollTop = sheetRef.current.scrollTop;
    syncing.current = false;
  };
  const onGanttScroll = () => {
    if (syncing.current || !sheetRef.current || !ganttRef.current) return;
    syncing.current = true;
    sheetRef.current.scrollTop = ganttRef.current.scrollTop;
    syncing.current = false;
  };

  const selected = computed.filter((t) => sel.includes(t.id));
  const inspectTask = selLink ? computed.find((t) => t.id === selLink.succ) : selected.length === 1 ? selected[0] : null;
  const inspectRel = selLink && inspectTask ? inspectTask.pred.find((p) => p.id === selLink.pred) : null;
  const idNum = (id: string) => computed.findIndex((t) => t.id === id) + 1;

  const geomOf = (t: CronoComputed, row: number) => {
    const x = calendarDaysBetween(range.from, t.start) * px;
    const w = t.isMilestone ? 0 : Math.max((calendarDaysBetween(t.start, t.finish) + 1) * px, 8);
    const y = row * ROW_H + ROW_H / 2;
    return { x, w, y, s: x, f: x + w };
  };

  const xyEnGantt = (e: PointerEvent<HTMLElement> | { clientX: number; clientY: number }) => {
    const box = ganttRowsRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };

  const crearVinculo = (predId: string, succId: string, type: PredType, lag = 0) => {
    const pred = computed.find((t) => t.id === predId);
    const succ = computed.find((t) => t.id === succId);
    if (!pred || !succ) return;
    if (pred.isSummary || succ.isSummary) {
      setLinkMsg("Vincule actividades, no resúmenes. El resumen toma fechas de sus hijos.");
      return;
    }
    if (wouldCycle(state.tasks, succId, predId)) {
      setLinkMsg("Ese vínculo formaría un ciclo. Primavera/Project lo rechazan igual.");
      return;
    }
    patch({ tasks: linkTasks(state.tasks, predId, succId, type, lag) });
    setSelLink({ pred: predId, succ: succId });
    setLinkMsg(`${PRED_META[type]} · ${idNum(predId)} → ${idNum(succId)}${lag ? ` · demora ${lag} d` : ""}`);
  };

  const startDrag = (e: PointerEvent<HTMLElement>, id: string, end: "S" | "F") => {
    e.preventDefault();
    e.stopPropagation();
    if (!ganttRowsRef.current) return;
    const next = { fromId: id, from: end, ...xyEnGantt(e) };
    dragRef.current = next;
    setDrag(next);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const next = { ...d, ...xyEnGantt(e) };
    dragRef.current = next;
    setDrag(next);
  };

  const endDrag = (e: PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    const svg = ganttRowsRef.current?.querySelector(".msp-links") as SVGElement | null;
    if (svg) svg.style.pointerEvents = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (svg) svg.style.pointerEvents = "";
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    const h = el?.closest("[data-crono-end]") as HTMLElement | null;
    const grow = el?.closest("[data-crono-row]") as HTMLElement | null;
    const toId = h?.dataset.cronoId || grow?.dataset.cronoRow;
    let toEnd = (h?.dataset.cronoEnd as "S" | "F" | undefined) || undefined;
    if (!toEnd && toId && grow) {
      const bar = grow.querySelector(".msp-bar, .msp-mile") as HTMLElement | null;
      if (bar) {
        const r = bar.getBoundingClientRect();
        toEnd = e.clientX < r.left + r.width / 2 ? "S" : "F";
      } else toEnd = "S";
    }
    if (toId && toEnd && toId !== d.fromId) {
      crearVinculo(d.fromId, toId, tipoDesdeAsas(d.from, toEnd), linkLag);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      const tag = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]");
      if (tag) return;
      if (!selLink) return;
      e.preventDefault();
      patch({ tasks: unlinkPair(state.tasks, selLink.pred, selLink.succ) });
      setSelLink(null);
      setLinkMsg("Vínculo eliminado.");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selLink, state.tasks]);

  const updateTask = (id: string, p: Partial<CronoComputed>) => {
    patch({
      tasks: state.tasks.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...p };
        if (p.metrado !== undefined || p.rendimiento !== undefined) {
          const metrado = p.metrado ?? t.metrado;
          const rend = p.rendimiento ?? t.rendimiento;
          if (t.mode === "auto" && rend > 0 && metrado > 0) next.duration = durationFromRendimiento(metrado, rend);
        }
        if (p.duration !== undefined && t.metrado > 0 && p.rendimiento === undefined) {
          next.rendimiento = rendimientoFromDuration(t.metrado, p.duration);
        }
        return next;
      }),
    });
  };

  const insertTask = (kind: "task" | "milestone" | "summary") => {
    const after = sel[0] ? state.tasks.findIndex((t) => t.id === sel[0]) : state.tasks.length - 1;
    const at = after >= 0 ? after + 1 : state.tasks.length;
    const indent = after >= 0 ? state.tasks[after].indent : 0;
    const t = emptyTask(
      {
        id: uidTask(),
        name: kind === "milestone" ? "Hito" : kind === "summary" ? "Resumen" : "Nueva tarea",
        indent,
        duration: kind === "milestone" ? 0 : 5,
      },
      state.start
    );
    const tasks = [...state.tasks];
    tasks.splice(at, 0, t);
    patch({ tasks });
    setSel([t.id]);
  };

  const removeSel = () => {
    if (!sel.length) return;
    const ban = new Set(sel);
    patch({
      tasks: state.tasks
        .filter((t) => !ban.has(t.id))
        .map((t) => ({ ...t, pred: t.pred.filter((p) => !ban.has(p.id)) })),
    });
    setSel([]);
  };

  const headers = useMemo(() => {
    const days: { iso: string; label: string; month: string; working: boolean }[] = [];
    let d = parseISO(range.from);
    const end = parseISO(range.to);
    while (d <= end) {
      const iso = toISO(d);
      days.push({
        iso,
        label: state.zoom === "month" ? String(d.getDate()) : String(d.getDate()),
        month: d.toLocaleDateString("es-PE", { month: "short", year: "numeric" }),
        working: isWorking(state.calendar, d),
      });
      d = addDays(d, 1);
    }
    return days;
  }, [range.from, range.to, state.calendar, state.zoom]);

  const monthSpans = useMemo(() => {
    const spans: { month: string; count: number }[] = [];
    for (const h of headers) {
      const last = spans[spans.length - 1];
      if (last && last.month === h.month) last.count += 1;
      else spans.push({ month: h.month, count: 1 });
    }
    return spans;
  }, [headers]);

  const addHoliday = () => {
    if (!holidayDate) return;
    const holidays: Holiday[] = [
      ...state.calendar.holidays.filter((h) => h.date !== holidayDate),
      { date: holidayDate, name: holidayName || "Feriado" },
    ].sort((a, b) => a.date.localeCompare(b.date));
    patch({ calendar: { ...state.calendar, holidays } });
    setHolidayDate("");
    setHolidayName("");
  };

  const loadFeriados = (year: number) => {
    const extra = feriadosPeru(year);
    const map = new Map(state.calendar.holidays.map((h) => [h.date, h]));
    for (const h of extra) map.set(h.date, h);
    patch({ calendar: { ...state.calendar, holidays: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)) } });
  };

  return (
    <section className="msp-shell">
      <header className="msp-top">
        <div className="pre-brand">
          <span className="pre-mark">CRO</span>
          <div>
            <strong>Cronograma de obra</strong>
            <p>
              Misma obra que el presupuesto APU y la fórmula polinómica
              {vinculo.obra ? ` · ${vinculo.obra}` : ""} · {vinculo.importadas}/{vinculo.validas} partidas
              {vinculo.faltan ? ` · faltan ${vinculo.faltan}` : ""}
            </p>
          </div>
        </div>
        <div className="msp-kpis">
          <div>
            <span>Inicio</span>
            <b>{projectStart || "—"}</b>
          </div>
          <div>
            <span>Fin</span>
            <b>{projectFinish || "—"}</b>
          </div>
          <div>
            <span>Duración</span>
            <b>{durProy || "—"} d</b>
          </div>
          <div>
            <span>Avance</span>
            <b>{pct.toFixed(0)} %</b>
          </div>
          <div>
            <span>Críticas</span>
            <b>{critCount}</b>
          </div>
        </div>
      </header>

      <div className="msp-ribbon" role="toolbar">
        <fieldset>
          <legend>Proyecto</legend>
          <label>
            Nombre
            <input value={state.proyecto} onChange={(e) => patch({ proyecto: e.target.value })} />
          </label>
          <label>
            Fecha de inicio
            <input type="date" value={state.start} onChange={(e) => patch({ start: e.target.value })} />
          </label>
          <button
            type="button"
            className="on"
            title="Extrae todas las partidas del presupuesto actual y arma la red de antecesoras (FC/CC)"
            onClick={() => importar()}
          >
            Importar todas las partidas
          </button>
          <button
            type="button"
            onClick={() => {
              if (state.tasks.length && !window.confirm("¿Vaciar el Gantt? El presupuesto y la fórmula no se modifican.")) return;
              setState(cronogramaVacioLigado(loadPresupuesto()));
              setSel([]);
            }}
          >
            Nuevo
          </button>
        </fieldset>
        <fieldset>
          <legend>Edición</legend>
          <UndoButtons undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} />
        </fieldset>
        <fieldset>
          <legend>Tareas</legend>
          <button type="button" onClick={() => insertTask("task")}>
            Insertar
          </button>
          <button type="button" onClick={() => insertTask("milestone")}>
            Hito
          </button>
          <button type="button" onClick={() => insertTask("summary")}>
            Resumen
          </button>
          <button type="button" onClick={removeSel} disabled={!sel.length}>
            Eliminar
          </button>
          <button type="button" onClick={() => patch({ tasks: indentTasks(state.tasks, sel, 1) })} disabled={!sel.length}>
            Sangrar
          </button>
          <button type="button" onClick={() => patch({ tasks: indentTasks(state.tasks, sel, -1) })} disabled={!sel.length}>
            Anular sangría
          </button>
        </fieldset>
        <fieldset>
          <legend>Programación</legend>
          <label className="msp-link-type">
            Tipo
            <select value={linkType} onChange={(e) => setLinkType(e.target.value as PredType)} title="Tipo de relación P6/Project">
              {(Object.keys(PRED_META) as PredType[]).map((k) => (
                <option key={k} value={k}>
                  {PRED_META[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="msp-link-type">
            Demora
            <input
              type="number"
              value={linkLag}
              onChange={(e) => setLinkLag(parseInt(e.target.value, 10) || 0)}
              title="Días de demora (+) o adelanto (−)"
            />
          </label>
          <button
            type="button"
            disabled={sel.length < 2}
            title="Une las actividades seleccionadas en el orden de selección (como Vincular de Project)"
            onClick={() => {
              const ids = sel.filter((id) => {
                const t = computed.find((x) => x.id === id);
                return Boolean(t && !t.isSummary);
              });
              if (ids.length < 2) {
                setLinkMsg("Seleccione dos o más actividades (no resúmenes) en el orden de la red.");
                return;
              }
              const next = linkChain(state.tasks, ids, linkType, linkLag);
              patch({ tasks: next });
              setSelLink({ pred: ids[ids.length - 2], succ: ids[ids.length - 1] });
              setLinkMsg(`Cadena ${PRED_META[linkType]} · ${ids.length} actividades${linkLag ? ` · demora ${linkLag} d` : ""}.`);
            }}
          >
            Vincular
          </button>
          <button type="button" onClick={() => patch({ tasks: unlinkSelected(state.tasks, sel) })} disabled={!sel.length}>
            Desvincular
          </button>
          <button type="button" onClick={() => setCalOpen(true)}>
            Calendario y feriados
          </button>
          <button
            type="button"
            title="Descarga el Gantt en tabla, la curva S mensual y el calendario de avance valorizado por partida en un solo libro .xlsx"
            onClick={() => void exportarCronogramaXlsx({ ...loadPresupuesto(), cronograma: state })}
          >
            Exportar Excel (.xlsx)
          </button>
        </fieldset>
        {vista === "gantt" ? (
          <fieldset>
            <legend>Escala</legend>
            {(["day", "week", "month"] as ZoomCrono[]).map((z) => (
              <button key={z} type="button" className={state.zoom === z ? "on" : ""} onClick={() => patch({ zoom: z })}>
                {z === "day" ? "Día" : z === "week" ? "Semana" : "Mes"}
              </button>
            ))}
          </fieldset>
        ) : null}
        <fieldset>
          <legend>Vista</legend>
          <button type="button" className={vista === "gantt" ? "on" : ""} onClick={() => setVista("gantt")}>
            Diagrama de Gantt
          </button>
          <button type="button" className={vista === "pert" ? "on" : ""} onClick={() => setVista("pert")}>
            Red PERT-CPM
          </button>
          <button type="button" className={vista === "valorizado" ? "on" : ""} onClick={() => setVista("valorizado")}>
            Cronograma valorizado (Curva S)
          </button>
        </fieldset>
      </div>

      {vista === "pert" ? <PertCpmView tasks={computed} /> : null}
      {vista === "valorizado" ? <CronogramaValorizadoView /> : null}

      {vista === "gantt" ? (
      <div className="msp-body">
        <div className="msp-sheet" ref={sheetRef} onScroll={onSheetScroll}>
          <table>
            <thead>
              <tr>
                <th className="n">ID</th>
                <th>Modo</th>
                <th>EDT</th>
                <th>Nombre de tarea</th>
                <th className="n">Dur.</th>
                <th>Comienzo</th>
                <th>Fin</th>
                <th>Predecesoras</th>
                <th>Und</th>
                <th className="n">Metrado</th>
                <th className="n">Rend. /d</th>
                <th className="n">Cuadr.</th>
                <th className="n">%</th>
                <th>Restricción</th>
                <th>Holgura</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={15} className="pre-empty">
                    Importe el presupuesto o inserte tareas. Las partidas se desglosan por especialidad y capítulo, con
                    duración según metrado y rendimiento.
                  </td>
                </tr>
              ) : (
                visible.map((t) => {
                  const raw = state.tasks.find((x) => x.id === t.id)!;
                  const on = sel.includes(t.id);
                  return (
                    <tr
                      key={t.id}
                      className={`${on ? "on" : ""} ${t.critical ? "crit" : ""} ${t.isSummary ? "sum" : ""}`}
                      onClick={(e) => {
                        if (e.shiftKey || e.ctrlKey || e.metaKey) {
                          setSel((s) => (s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id]));
                        } else setSel([t.id]);
                      }}
                    >
                      <td className="n mono">{idNum(t.id)}</td>
                      <td>
                        <select
                          value={raw.mode}
                          onChange={(e) => updateTask(t.id, { mode: e.target.value as "auto" | "man" })}
                        >
                          <option value="auto">Auto</option>
                          <option value="man">Man.</option>
                        </select>
                      </td>
                      <td className="mono">{t.wbs}</td>
                      <td>
                        <div className="msp-name" style={{ paddingLeft: t.indent * 16 }}>
                          {t.isSummary ? (
                            <button
                              type="button"
                              className="msp-twisty"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTask(t.id, { collapsed: !raw.collapsed });
                              }}
                            >
                              {raw.collapsed ? "▸" : "▾"}
                            </button>
                          ) : t.isMilestone ? (
                            <span className="msp-dia">◆</span>
                          ) : (
                            <span className="msp-bar-ico" />
                          )}
                          <input
                            value={raw.name}
                            onChange={(e) => updateTask(t.id, { name: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </td>
                      <td className="n">
                        {t.isSummary ? (
                          <span className="mono">{t.duration} d</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            value={raw.duration}
                            onChange={(e) => updateTask(t.id, { duration: parseFloat(e.target.value) || 0 })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </td>
                      <td className="mono">{t.start}</td>
                      <td className="mono">{t.finish}</td>
                      <td>
                        {t.isSummary ? (
                          "—"
                        ) : (
                          <input
                            value={predLabel(t, computed)}
                            onChange={(e) => updateTask(t.id, { pred: parsePred(e.target.value, computed) })}
                            onClick={(e) => e.stopPropagation()}
                            title="Ej. 3;5FS+2;8SS"
                          />
                        )}
                      </td>
                      <td>
                        <input value={raw.und} onChange={(e) => updateTask(t.id, { und: e.target.value })} onClick={(e) => e.stopPropagation()} />
                      </td>
                      <td className="n">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={raw.metrado}
                          onChange={(e) => updateTask(t.id, { metrado: parseFloat(e.target.value) || 0 })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="n">
                        <input
                          type="number"
                          min={0}
                          step="0.001"
                          value={raw.rendimiento}
                          onChange={(e) => updateTask(t.id, { rendimiento: parseFloat(e.target.value) || 0 })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="n">
                        <input
                          type="number"
                          min={1}
                          value={raw.crew}
                          onChange={(e) => updateTask(t.id, { crew: parseFloat(e.target.value) || 1 })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="n">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={raw.pct}
                          onChange={(e) => updateTask(t.id, { pct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td>
                        <select
                          value={raw.constraint}
                          onChange={(e) => updateTask(t.id, { constraint: e.target.value as ConstraintType })}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(Object.keys(CONSTRAINT_META) as ConstraintType[]).map((k) => (
                            <option key={k} value={k}>
                              {CONSTRAINT_META[k]}
                            </option>
                          ))}
                        </select>
                        {raw.constraint !== "ASAP" && raw.constraint !== "ALAP" ? (
                          <input
                            type="date"
                            value={raw.constraintDate}
                            onChange={(e) => updateTask(t.id, { constraintDate: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : null}
                      </td>
                      <td className="n mono">{t.isSummary ? "—" : t.slack}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="msp-gantt" ref={ganttRef} onScroll={onGanttScroll}>
          <div className="msp-gantt-inner" ref={ganttInnerRef} style={{ width }}>
            <div className="msp-gantt-head">
              <div className="msp-gantt-months">
                {monthSpans.map((m) => (
                  <div key={m.month} style={{ width: m.count * px }}>
                    {m.month}
                  </div>
                ))}
              </div>
              <div className="msp-gantt-days">
                {headers.map((h) => (
                  <div
                    key={h.iso}
                    className={`${h.working ? "" : "off"} ${h.iso === today ? "today" : ""}`}
                    style={{ width: px }}
                    title={h.iso}
                  >
                    {state.zoom === "month" ? "" : h.label}
                  </div>
                ))}
              </div>
            </div>
            <div className={`msp-gantt-rows${drag ? " dragging" : ""}`} ref={ganttRowsRef} style={{ height: visible.length * ROW_H }}>
              {visible.map((t, row) => {
                const g = geomOf(t, row);
                const w = Math.max(g.w, t.isMilestone ? 0 : 8);
                return (
                  <div
                    key={t.id}
                    className={`msp-grow ${sel.includes(t.id) ? "on" : ""}`}
                    data-crono-row={t.id}
                    onClick={() => {
                      setSel([t.id]);
                      setSelLink(null);
                    }}
                  >
                    {headers.map((h) => (
                      <i key={h.iso} className={h.working ? "" : "off"} style={{ width: px }} />
                    ))}
                    {t.isMilestone ? (
                      <em className="msp-mile" style={{ left: g.x }}>
                        ◆
                      </em>
                    ) : (
                      <b
                        className={`msp-bar ${t.isSummary ? "sum" : ""} ${t.critical ? "crit" : ""}`}
                        style={{ left: g.x, width: w }}
                        title={`${t.name} · ${t.start} → ${t.finish}`}
                      >
                        <i style={{ width: `${t.pct}%` }} />
                        <span>{t.name}</span>
                      </b>
                    )}
                  </div>
                );
              })}
              {todayX >= 0 && todayX <= width ? <div className="msp-today" style={{ left: todayX }} /> : null}
              <svg className="msp-links" width={width} height={visible.length * ROW_H} aria-hidden>
                <defs>
                  <marker id="crono-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                    <path d="M0,0 L8,3 L0,6 Z" fill="#1b3650" />
                  </marker>
                  <marker id="crono-arrow-on" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                    <path d="M0,0 L8,3 L0,6 Z" fill="#8a6a32" />
                  </marker>
                  <marker id="crono-arrow-crit" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                    <path d="M0,0 L8,3 L0,6 Z" fill="#c00000" />
                  </marker>
                </defs>
                {visible.flatMap((succ, si) => {
                  const gS = geomOf(succ, si);
                  return succ.pred.flatMap((p) => {
                    const pi = visible.findIndex((x) => x.id === p.id);
                    if (pi < 0) return [];
                    const pred = visible[pi];
                    const gP = geomOf(pred, pi);
                    const x1 = p.type === "SS" || p.type === "SF" ? gP.s : gP.f;
                    const x2 = p.type === "FF" || p.type === "SF" ? gS.f : gS.s;
                    const d = codo(x1, gP.y, x2, gS.y);
                    const on = selLink?.pred === p.id && selLink.succ === succ.id;
                    const crit = pred.critical && succ.critical;
                    const cls = on ? "on" : crit ? "crit" : "";
                    return [
                      <path key={`h-${p.id}-${succ.id}`} className="hit" d={d} onClick={(e) => {
                        e.stopPropagation();
                        setSelLink({ pred: p.id, succ: succ.id });
                        setSel([p.id, succ.id]);
                      }} />,
                      <path
                        key={`${p.id}-${succ.id}`}
                        d={d}
                        className={cls}
                        markerEnd={`url(#${on ? "crono-arrow-on" : crit ? "crono-arrow-crit" : "crono-arrow"})`}
                      />,
                    ];
                  });
                })}
                {drag
                  ? (() => {
                      const fi = visible.findIndex((x) => x.id === drag.fromId);
                      if (fi < 0) return null;
                      const g = geomOf(visible[fi], fi);
                      const x1 = drag.from === "S" ? g.s : g.f;
                      return <path className="rubber" d={codo(x1, g.y, drag.x, drag.y)} />;
                    })()
                  : null}
              </svg>
              <div className="msp-handles-layer" style={{ height: visible.length * ROW_H }}>
                {visible.map((t, row) => {
                  if (t.isSummary) return null;
                  const g = geomOf(t, row);
                  return (
                    <span key={t.id}>
                      <button
                        type="button"
                        className="msp-handle s"
                        data-crono-id={t.id}
                        data-crono-end="S"
                        style={{ top: row * ROW_H + 9, left: g.s - 5 }}
                        title="Comienzo · arrastre hasta el comienzo o el fin de otra actividad"
                        onPointerDown={(e) => startDrag(e, t.id, "S")}
                        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && moveDrag(e)}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                      />
                      <button
                        type="button"
                        className="msp-handle f"
                        data-crono-id={t.id}
                        data-crono-end="F"
                        style={{ top: row * ROW_H + 9, left: g.f - 5 }}
                        title="Fin · arrastre hasta el comienzo o el fin de otra actividad"
                        onPointerDown={(e) => startDrag(e, t.id, "F")}
                        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && moveDrag(e)}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                      />
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {vista === "gantt" ? (
      <aside className="msp-inspector">
        {inspectRel && selLink ? (
          <>
            <div>
              <span>Relación</span>
              <b>
                {idNum(selLink.pred)} → {idNum(selLink.succ)} · {PRED_META[inspectRel.type]}
              </b>
            </div>
            <label>
              Tipo
              <select
                value={inspectRel.type}
                onChange={(e) =>
                  patch({
                    tasks: updateLink(state.tasks, selLink.pred, selLink.succ, { type: e.target.value as PredType }),
                  })
                }
              >
                {(Object.keys(PRED_META) as PredType[]).map((k) => (
                  <option key={k} value={k}>
                    {PRED_META[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Demora
              <input
                type="number"
                value={inspectRel.lag}
                onChange={(e) =>
                  patch({
                    tasks: updateLink(state.tasks, selLink.pred, selLink.succ, { lag: parseInt(e.target.value, 10) || 0 }),
                  })
                }
              />
            </label>
            <button
              type="button"
              onClick={() => {
                patch({ tasks: unlinkPair(state.tasks, selLink.pred, selLink.succ) });
                setSelLink(null);
                setLinkMsg("Vínculo eliminado.");
              }}
            >
              Quitar vínculo
            </button>
          </>
        ) : inspectTask ? (
          <>
            <div>
              <span>{inspectTask.isSummary ? "Resumen" : inspectTask.isMilestone ? "Hito" : "Actividad"}</span>
              <b>
                {idNum(inspectTask.id)}. {inspectTask.name}
              </b>
            </div>
            <div>
              <span>CPM</span>
              <b>
                ES {inspectTask.es} · EF {inspectTask.ef} · LS {inspectTask.ls} · LF {inspectTask.lf}
              </b>
            </div>
            <div>
              <span>Holgura</span>
              <b>
                total {inspectTask.slack} d · libre {inspectTask.freeFloat} d
                {inspectTask.critical ? " · crítica" : ""}
              </b>
            </div>
            {!inspectTask.isSummary ? (
              <div className="msp-inspector-preds">
                <span>Predecesoras</span>
                {inspectTask.pred.length ? (
                  <ul>
                    {inspectTask.pred.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelLink({ pred: p.id, succ: inspectTask.id });
                            setSel([p.id, inspectTask.id]);
                          }}
                        >
                          {idNum(p.id)} {PRED_META[p.type]}
                          {p.lag ? ` ${p.lag > 0 ? "+" : ""}${p.lag}d` : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <b>Ninguna · arrastre el círculo de una barra hasta esta</b>
                )}
              </div>
            ) : (
              <b>El resumen no lleva vínculos: roll-up de hijos.</b>
            )}
          </>
        ) : (
          <p>
            Arrastre el círculo de una barra a otra para crear un vínculo (FC, CC, FF o CF). Seleccione dos o más filas y pulse
            Vincular. Clic en una flecha para editar tipo y demora. Supr borra el vínculo seleccionado.
          </p>
        )}
      </aside>
      ) : null}

      <footer className="msp-status">
        <span className={vinculo.faltan ? "msp-vinculo warn" : "msp-vinculo"}>
          {vinculo.validas === 0
            ? "Sin partidas en el presupuesto. Cargue una plantilla o agregue partidas en PRE-01."
            : vinculo.faltan
              ? `${vinculo.faltan} partida${vinculo.faltan === 1 ? "" : "s"} del presupuesto sin tarea. Use Importar todas las partidas.`
              : `Presupuesto ligado · ${vinculo.importadas} partidas con antecesoras`}
        </span>
        <span>{state.calendar.name}</span>
        <span>
          {state.calendar.startHour}–{state.calendar.endHour} · almuerzo {state.calendar.lunchStart}–{state.calendar.lunchEnd} ·{" "}
          {netHoursPerDay(state.calendar).toFixed(1)} h/d
        </span>
        <span>{state.calendar.holidays.length} feriados</span>
        <span>
          {selected.length === 1
            ? `${selected[0].name} · holgura ${selected[0].slack} d${selected[0].critical ? " · crítica" : ""}`
            : `${selected.length} tareas`}
        </span>
        <span className={linkMsg ? "msp-vinculo" : ""}>{linkMsg || "Arrastre círculo → círculo para vincular (como Project / P6)"}</span>
      </footer>

      {calOpen ? (
        <div className="msp-modal" role="dialog" aria-labelledby="cal-title">
          <div className="msp-modal-card">
            <header>
              <h3 id="cal-title">Calendario laboral</h3>
              <button type="button" onClick={() => setCalOpen(false)}>
                Cerrar
              </button>
            </header>
            <div className="msp-cal-grid">
              <label>
                Nombre
                <input
                  value={state.calendar.name}
                  onChange={(e) => patch({ calendar: { ...state.calendar, name: e.target.value } })}
                />
              </label>
              <label>
                Hora de ingreso
                <input
                  type="time"
                  value={state.calendar.startHour}
                  onChange={(e) => patch({ calendar: { ...state.calendar, startHour: e.target.value } })}
                />
              </label>
              <label>
                Hora de salida
                <input
                  type="time"
                  value={state.calendar.endHour}
                  onChange={(e) => patch({ calendar: { ...state.calendar, endHour: e.target.value } })}
                />
              </label>
              <label>
                Almuerzo desde
                <input
                  type="time"
                  value={state.calendar.lunchStart}
                  onChange={(e) => patch({ calendar: { ...state.calendar, lunchStart: e.target.value } })}
                />
              </label>
              <label>
                Almuerzo hasta
                <input
                  type="time"
                  value={state.calendar.lunchEnd}
                  onChange={(e) => patch({ calendar: { ...state.calendar, lunchEnd: e.target.value } })}
                />
              </label>
              <label>
                Horas / día (neto)
                <input readOnly value={netHoursPerDay(state.calendar).toFixed(2)} />
              </label>
            </div>
            <p className="msp-hint">
              Jornada bruta {hoursFromRange(state.calendar.startHour, state.calendar.endHour).toFixed(1)} h menos almuerzo.
              Las duraciones se programan en días laborables de este calendario.
            </p>
            <div className="msp-week">
              {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d, i) => (
                <label key={d}>
                  <input
                    type="checkbox"
                    checked={state.calendar.weekDays[i]}
                    onChange={() => {
                      const weekDays = [...state.calendar.weekDays];
                      weekDays[i] = !weekDays[i];
                      patch({ calendar: { ...state.calendar, weekDays } });
                    }}
                  />
                  {d}
                </label>
              ))}
            </div>
            <div className="msp-hol-add">
              <input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
              <input placeholder="Nombre del feriado" value={holidayName} onChange={(e) => setHolidayName(e.target.value)} />
              <button type="button" onClick={addHoliday}>
                Agregar feriado
              </button>
              <button type="button" onClick={() => loadFeriados(new Date().getFullYear())}>
                Feriados {new Date().getFullYear()}
              </button>
              <button type="button" onClick={() => loadFeriados(new Date().getFullYear() + 1)}>
                Feriados {new Date().getFullYear() + 1}
              </button>
            </div>
            <div className="pre-table-wrap">
              <table className="pre-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Feriado / excepción</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.calendar.holidays.map((h) => (
                    <tr key={h.date}>
                      <td className="mono">{h.date}</td>
                      <td>{h.name}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            patch({
                              calendar: {
                                ...state.calendar,
                                holidays: state.calendar.holidays.filter((x) => x.date !== h.date),
                              },
                            })
                          }
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );

  function importar() {
    const pre = loadPresupuesto();
    if (!pre.lineas.length) {
      window.alert("El presupuesto no tiene partidas. Cargue una plantilla o agréguelas en Presupuesto y APU.");
      return;
    }
    if (
      state.tasks.some((t) => t.partidaCodigo) &&
      !window.confirm(
        "Se extraerán todas las partidas del presupuesto actual y se armará la red de antecesoras (FC y CC). El Gantt actual se reemplaza. El APU y la fórmula polinómica no cambian."
      )
    ) {
      return;
    }
    setState(importarDesdePresupuesto());
    setSel([]);
  }
}

const PERT_NODE_W = 172;
const PERT_NODE_H = 78;
const PERT_GAP_X = 64;
const PERT_GAP_Y = 22;
const PERT_PAD = 24;

function d2(iso: string) {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function layoutPert(nodes: CronoComputed[]) {
  const ids = new Set(nodes.map((n) => n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const levelOf = new Map<string, number>();
  const level = (id: string, guard: Set<string>): number => {
    if (levelOf.has(id)) return levelOf.get(id)!;
    if (guard.has(id)) return 0;
    guard.add(id);
    const t = byId.get(id);
    const preds = t ? t.pred.filter((p) => ids.has(p.id)) : [];
    const lvl = preds.length ? Math.max(...preds.map((p) => level(p.id, guard) + 1)) : 0;
    levelOf.set(id, lvl);
    return lvl;
  };
  for (const n of nodes) level(n.id, new Set());
  const byLevel = new Map<number, string[]>();
  for (const n of nodes) {
    const lvl = levelOf.get(n.id) ?? 0;
    const arr = byLevel.get(lvl) ?? [];
    arr.push(n.id);
    byLevel.set(lvl, arr);
  }
  const pos = new Map<string, { x: number; y: number }>();
  let maxRows = 0;
  for (const [lvl, idsAtLevel] of byLevel) {
    idsAtLevel.forEach((id, row) => {
      pos.set(id, { x: PERT_PAD + lvl * (PERT_NODE_W + PERT_GAP_X), y: PERT_PAD + row * (PERT_NODE_H + PERT_GAP_Y) });
    });
    maxRows = Math.max(maxRows, idsAtLevel.length);
  }
  return { pos, cols: byLevel.size || 1, rows: maxRows || 1 };
}

function PertCpmView({ tasks }: { tasks: CronoComputed[] }) {
  const nodes = tasks.filter((t) => !t.isSummary);
  const { pos, cols, rows } = useMemo(() => layoutPert(nodes), [nodes]);
  const width = PERT_PAD * 2 + cols * (PERT_NODE_W + PERT_GAP_X);
  const height = PERT_PAD * 2 + rows * (PERT_NODE_H + PERT_GAP_Y);
  const idNum = (id: string) => nodes.findIndex((t) => t.id === id) + 1;
  const critLen = nodes.filter((t) => t.critical).length;

  if (!nodes.length) {
    return (
      <div className="msp-body pert-body">
        <p className="pre-empty">Importe partidas o inserte actividades en el Gantt para ver la red PERT-CPM.</p>
      </div>
    );
  }

  return (
    <div className="msp-body pert-body">
      <div className="pert-legend">
        <p>
          Cada nodo (AON): fila superior <b>ES</b> inicio próximo · <b>Dur</b> · <b>EF</b> fin próximo. Fila inferior{" "}
          <b>LS</b> inicio lejano · <b>Hol</b> holgura · <b>LF</b> fin lejano. En rojo, la <b>ruta crítica</b> (holgura 0) ·{" "}
          {critLen} actividad{critLen === 1 ? "" : "es"} crítica{critLen === 1 ? "" : "s"}.
        </p>
      </div>
      <div className="pert-scroll">
        <div className="pert-canvas" style={{ width, height }}>
          <svg className="pert-links" width={width} height={height} aria-hidden>
            <defs>
              <marker id="pert-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L8,3 L0,6 Z" fill="#1b3650" />
              </marker>
              <marker id="pert-arrow-crit" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L8,3 L0,6 Z" fill="#c00000" />
              </marker>
            </defs>
            {nodes.flatMap((t) =>
              t.pred
                .filter((p) => pos.has(p.id))
                .map((p) => {
                  const from = pos.get(p.id)!;
                  const to = pos.get(t.id)!;
                  const x1 = from.x + PERT_NODE_W;
                  const y1 = from.y + PERT_NODE_H / 2;
                  const x2 = to.x;
                  const y2 = to.y + PERT_NODE_H / 2;
                  const predT = nodes.find((n) => n.id === p.id);
                  const crit = Boolean(predT?.critical && t.critical);
                  return (
                    <path
                      key={`${p.id}-${t.id}`}
                      d={codo(x1, y1, x2, y2)}
                      className={crit ? "crit" : ""}
                      markerEnd={`url(#${crit ? "pert-arrow-crit" : "pert-arrow"})`}
                    />
                  );
                }),
            )}
          </svg>
          {nodes.map((t) => {
            const p = pos.get(t.id)!;
            return (
              <div
                key={t.id}
                className={`pert-node ${t.critical ? "crit" : ""} ${t.isMilestone ? "mile" : ""}`}
                style={{ left: p.x, top: p.y, width: PERT_NODE_W, height: PERT_NODE_H }}
                title={`${t.name} · ${t.es} → ${t.ef} · holgura ${t.slack} d`}
              >
                <div className="pert-row top">
                  <span>{d2(t.es)}</span>
                  <span>{t.duration}d</span>
                  <span>{d2(t.ef)}</span>
                </div>
                <div className="pert-name">
                  {idNum(t.id)}. {t.name}
                </div>
                <div className="pert-row bot">
                  <span>{d2(t.ls)}</span>
                  <span>{t.slack}</span>
                  <span>{d2(t.lf)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CronogramaValorizadoView() {
  const pre = loadPresupuesto();
  const { puntos, totalContrato } = curvaSMensual(pre);
  const hoyKey = toISO(new Date()).slice(0, 7);
  const idxHoy = puntos.findIndex((p) => p.key === hoyKey);
  const actual = idxHoy >= 0 ? puntos[idxHoy] : puntos[puntos.length - 1];

  if (!puntos.length) {
    return (
      <div className="msp-body pert-body">
        <p className="pre-empty">Importe partidas al Gantt (con precios del APU) para calcular el cronograma valorizado y la curva S.</p>
      </div>
    );
  }

  return (
    <div className="msp-body valz-body">
      <div className="valz-curva-kpis">
        <div>
          <span>Monto total del contrato</span>
          <b>{moneyMon(totalContrato, "PEN")}</b>
        </div>
        <div>
          <span>Programado a la fecha</span>
          <b>{moneyMon(actual?.programadoAcumulado ?? 0, "PEN")}</b>
        </div>
        <div>
          <span>% programado a la fecha</span>
          <b>{(actual?.programadoPct ?? 0).toFixed(1)}%</b>
        </div>
      </div>
      <SCurveChart puntos={puntos} />
      <div className="msp-sheet valz-sheet">
        <table>
          <thead>
            <tr>
              <th>Mes</th>
              <th className="n">Valorización programada del mes</th>
              <th className="n">Acumulado</th>
              <th className="n">% acumulado</th>
            </tr>
          </thead>
          <tbody>
            {puntos.map((p) => (
              <tr key={p.key} className={p.key === hoyKey ? "on" : ""}>
                <td>{p.label}</td>
                <td className="n mono">{moneyMon(p.programadoPeriodo, "PEN")}</td>
                <td className="n mono">{moneyMon(p.programadoAcumulado, "PEN")}</td>
                <td className="n mono">{p.programadoPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="valz-hint">
        Esta curva es el <b>programado</b> según el Gantt/CPM. Para compararla contra lo realmente ejecutado y pagado, registre
        las valorizaciones en «Valorizaciones» (PRE-07).
      </p>
    </div>
  );
}

function SCurveChart({
  puntos,
}: {
  puntos: { label: string; programadoPeriodo: number; programadoAcumulado: number; programadoPct: number }[];
}) {
  const W = 900;
  const H = 280;
  const pad = { l: 50, r: 16, t: 16, b: 40 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const n = puntos.length;
  const maxPeriodo = Math.max(1, ...puntos.map((p) => p.programadoPeriodo));
  const barW = Math.min(34, (innerW / Math.max(1, n)) * 0.5);
  const x = (i: number) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yPct = (pct: number) => pad.t + innerH - (Math.min(100, Math.max(0, pct)) / 100) * innerH;
  const yBar = (v: number) => pad.t + innerH - (v / maxPeriodo) * innerH * 0.55;
  const path = puntos.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${yPct(p.programadoPct).toFixed(1)}`).join(" ");

  return (
    <div className="valz-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Curva S programada">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={yPct(g)} y2={yPct(g)} className="valz-grid" />
            <text x={pad.l - 8} y={yPct(g) + 3} textAnchor="end" className="valz-axis">
              {g}%
            </text>
          </g>
        ))}
        {puntos.map((p, i) => (
          <rect
            key={`b-${p.label}-${i}`}
            x={x(i) - barW / 2}
            y={yBar(p.programadoPeriodo)}
            width={barW}
            height={Math.max(0, pad.t + innerH - yBar(p.programadoPeriodo))}
            className="valz-bar"
          />
        ))}
        <path d={path} className="valz-line prog" />
        {puntos.map((p, i) => (
          <circle key={`d-${p.label}-${i}`} cx={x(i)} cy={yPct(p.programadoPct)} r={3.5} className="valz-dot prog" />
        ))}
        {puntos.map((p, i) => (
          <text key={`t-${p.label}-${i}`} x={x(i)} y={H - 10} textAnchor="middle" className="valz-axis">
            {p.label}
          </text>
        ))}
      </svg>
      <div className="valz-legend">
        <span className="bar">Valorización programada del mes</span>
        <span className="prog">Curva S acumulada</span>
      </div>
    </div>
  );
}
