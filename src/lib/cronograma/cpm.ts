import { addWorkingDays, addWorkingDuration, nextWorking, parseISO, toISO, workingDaysInclusive } from "./calendar";
import type { ConstraintType, CronoComputed, CronoTask, CronogramaState, Predecessor, PredType, WorkCalendar } from "./types";

export function uidTask() {
  return `T${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function emptyTask(partial: Partial<CronoTask> = {}, start = toISO(new Date())): CronoTask {
  return {
    id: uidTask(),
    name: "Nueva tarea",
    indent: 0,
    mode: "auto",
    duration: 1,
    start,
    finish: start,
    pred: [],
    constraint: "ASAP",
    constraintDate: "",
    metrado: 0,
    und: "und",
    rendimiento: 0,
    crew: 1,
    pct: 0,
    notes: "",
    resource: "",
    collapsed: false,
    ...partial,
  };
}

export type TreeNode = {
  task: CronoTask;
  parentId: string | null;
  children: string[];
  isSummary: boolean;
};

export function buildTree(tasks: CronoTask[]): { nodes: Map<string, TreeNode>; order: string[] } {
  const nodes = new Map<string, TreeNode>();
  const stack: CronoTask[] = [];
  for (const t of tasks) {
    while (stack.length && stack[stack.length - 1].indent >= t.indent) stack.pop();
    const parent = stack.length ? stack[stack.length - 1] : null;
    nodes.set(t.id, { task: t, parentId: parent?.id ?? null, children: [], isSummary: false });
    if (parent) {
      const p = nodes.get(parent.id)!;
      p.children.push(t.id);
      p.isSummary = true;
    }
    stack.push(t);
  }
  return { nodes, order: tasks.map((t) => t.id) };
}

export function wbsOf(tasks: CronoTask[], nodes: Map<string, TreeNode>) {
  const out = new Map<string, string>();
  const counters: Record<string, number> = { "": 0 };
  for (const t of tasks) {
    const n = nodes.get(t.id)!;
    const pk = n.parentId ?? "";
    counters[pk] = (counters[pk] ?? 0) + 1;
    const parentWbs = pk ? out.get(pk) ?? "" : "";
    out.set(t.id, parentWbs ? `${parentWbs}.${counters[pk]}` : String(counters[pk]));
  }
  return out;
}

function maxISO(a: string, b: string) {
  return a >= b ? a : b;
}
function minISO(a: string, b: string) {
  return a && a <= b ? a : b;
}

function applyConstraintStart(
  cal: WorkCalendar,
  constraint: ConstraintType,
  constraintDate: string,
  es: Date,
  duration: number
): Date {
  if (!constraintDate) return es;
  const c = parseISO(constraintDate);
  if (constraint === "MSO" || constraint === "SNET") return c > es ? c : constraint === "MSO" ? c : es;
  if (constraint === "SNLT") return c < es ? c : es;
  if (constraint === "MFO" || constraint === "FNLT") {
    const start = addWorkingDays(cal, c, -(Math.max(0, duration) - (duration > 0 ? 1 : 0)));
    if (constraint === "MFO") return start;
    return start < es ? start : es;
  }
  if (constraint === "FNET") {
    const start = addWorkingDays(cal, c, -(Math.max(0, duration) - (duration > 0 ? 1 : 0)));
    return start > es ? start : es;
  }
  return es;
}

function predFinish(pred: Predecessor, p: { es: string; ef: string }, cal: WorkCalendar) {
  if (pred.type === "FS") return addWorkingDays(cal, parseISO(p.ef), pred.lag);
  if (pred.type === "SS") return addWorkingDays(cal, parseISO(p.es), pred.lag);
  if (pred.type === "FF") return addWorkingDays(cal, parseISO(p.ef), pred.lag);
  return addWorkingDays(cal, parseISO(p.es), pred.lag);
}

export function schedule(state: CronogramaState): CronoComputed[] {
  const cal = state.calendar;
  const projectStart = nextWorking(cal, parseISO(state.start || toISO(new Date())));
  const { nodes, order } = buildTree(state.tasks);
  const wbs = wbsOf(state.tasks, nodes);
  const byId = new Map(state.tasks.map((t) => [t.id, t]));

  const esMap = new Map<string, string>();
  const efMap = new Map<string, string>();

  const visitFwd = (id: string, stack: Set<string>) => {
    if (esMap.has(id)) return;
    if (stack.has(id)) return;
    stack.add(id);
    const t = byId.get(id);
    const node = nodes.get(id);
    if (!t || !node) return;

    if (node.isSummary) {
      for (const c of node.children) visitFwd(c, stack);
      let es = "";
      let ef = "";
      for (const c of node.children) {
        const ces = esMap.get(c);
        const cef = efMap.get(c);
        if (ces) es = es ? minISO(es, ces) : ces;
        if (cef) ef = ef ? maxISO(ef, cef) : cef;
      }
      esMap.set(id, es || toISO(projectStart));
      efMap.set(id, ef || esMap.get(id)!);
      stack.delete(id);
      return;
    }

    for (const p of t.pred) visitFwd(p.id, stack);

    let es = projectStart;
    for (const p of t.pred) {
      const pes = esMap.get(p.id);
      const pef = efMap.get(p.id);
      if (!pes || !pef) continue;
      if (p.type === "FF" || p.type === "SF") {
        const from = predFinish(p, { es: pes, ef: pef }, cal);
        const dur = Math.max(0, t.duration);
        const start = dur <= 0 ? from : addWorkingDays(cal, from, -(dur - 1));
        if (start > es) es = start;
      } else if (p.type === "FS") {
        // Fin-Inicio: la sucesora no puede empezar antes del siguiente día hábil tras el fin de la predecesora
        // (+ lag). Se calcula y compara siempre contra `es`, sin depender de un umbral previo — de lo contrario,
        // cuando el candidato coincide exactamente con el `es` acumulado por otra predecesora, se pierde un día.
        const after = addWorkingDays(cal, parseISO(pef), p.lag + 1);
        if (after > es) es = after;
      } else {
        // Inicio-Inicio: la sucesora puede arrancar el mismo día que la predecesora + lag, sin día adicional.
        const next = addWorkingDays(cal, parseISO(pes), p.lag);
        if (next > es) es = next;
      }
    }

    es = nextWorking(cal, es);
    es = applyConstraintStart(cal, t.constraint, t.constraintDate, es, t.duration);
    es = nextWorking(cal, es);

    if (t.mode === "man" && t.start) {
      es = parseISO(t.start);
    }

    const dur = t.duration <= 0 ? 0 : t.duration;
    const ef = dur <= 0 ? es : addWorkingDuration(cal, es, dur);
    esMap.set(id, toISO(es));
    efMap.set(id, toISO(ef));
    stack.delete(id);
  };

  for (const id of order) visitFwd(id, new Set());

  let projectFinish = toISO(projectStart);
  for (const id of order) {
    const ef = efMap.get(id);
    if (ef && ef > projectFinish) projectFinish = ef;
  }

  const lsMap = new Map<string, string>();
  const lfMap = new Map<string, string>();

  const successors = new Map<string, { id: string; pred: Predecessor }[]>();
  for (const t of state.tasks) {
    for (const p of t.pred) {
      const arr = successors.get(p.id) ?? [];
      arr.push({ id: t.id, pred: p });
      successors.set(p.id, arr);
    }
  }

  const visitBwd = (id: string, stack: Set<string>) => {
    if (lfMap.has(id)) return;
    if (stack.has(id)) return;
    stack.add(id);
    const t = byId.get(id);
    const node = nodes.get(id);
    if (!t || !node) return;

    const succs = successors.get(id) ?? [];
    for (const s of succs) visitBwd(s.id, stack);
    if (node.isSummary) {
      for (const c of node.children) visitBwd(c, stack);
      let ls = "";
      let lf = "";
      for (const c of node.children) {
        const cls = lsMap.get(c);
        const clf = lfMap.get(c);
        if (cls) ls = ls ? minISO(ls, cls) : cls;
        if (clf) lf = lf ? maxISO(lf, clf) : clf;
      }
      lsMap.set(id, ls || esMap.get(id)!);
      lfMap.set(id, lf || efMap.get(id)!);
      stack.delete(id);
      return;
    }

    let lf = parseISO(projectFinish);
    if (succs.length === 0) {
      lf = parseISO(efMap.get(id) || projectFinish);
    } else {
      for (const s of succs) {
        const sls = lsMap.get(s.id);
        const slf = lfMap.get(s.id);
        if (!sls || !slf) continue;
        if (s.pred.type === "FS") {
          const cand = addWorkingDays(cal, parseISO(sls), -(s.pred.lag + 1));
          if (cand < lf) lf = cand;
        } else if (s.pred.type === "SS") {
          const cand = addWorkingDays(cal, parseISO(sls), -s.pred.lag);
          const dur = Math.max(0, t.duration);
          const finish = dur <= 0 ? cand : addWorkingDuration(cal, cand, dur);
          if (finish < lf) lf = finish;
        } else if (s.pred.type === "FF") {
          const cand = addWorkingDays(cal, parseISO(slf), -s.pred.lag);
          if (cand < lf) lf = cand;
        } else {
          const cand = addWorkingDays(cal, parseISO(slf), -s.pred.lag);
          if (cand < lf) lf = cand;
        }
      }
    }

    const dur = Math.max(0, t.duration);
    const ls = dur <= 0 ? lf : addWorkingDays(cal, lf, -(dur - 1));
    lsMap.set(id, toISO(nextWorking(cal, ls, -1)));
    lfMap.set(id, toISO(lf));
    stack.delete(id);
  };

  for (let i = order.length - 1; i >= 0; i--) visitBwd(order[i], new Set());

  const collapsedParents = new Set<string>();
  for (const t of state.tasks) {
    if (t.collapsed && nodes.get(t.id)?.isSummary) collapsedParents.add(t.id);
  }
  const hidden = new Set<string>();
  const hideDesc = (id: string) => {
    const n = nodes.get(id);
    if (!n) return;
    for (const c of n.children) {
      hidden.add(c);
      hideDesc(c);
    }
  };
  for (const id of collapsedParents) hideDesc(id);

  return state.tasks.map((t) => {
    const node = nodes.get(t.id)!;
    const es = esMap.get(t.id) || t.start;
    const ef = efMap.get(t.id) || t.finish;
    const ls = lsMap.get(t.id) || es;
    const lf = lfMap.get(t.id) || ef;
    // workingDaysInclusive cuenta ambos extremos; se resta 1 siempre para obtener días de holgura reales
    // (si ef===lf, cuenta 1 día y la holgura es 0; si hay un día hábil de margen, cuenta 2 y la holgura es 1).
    const slack = workingDaysInclusive(cal, ef, lf) - 1;
    const slackN = Number.isFinite(slack) ? Math.max(0, slack) : 0;
    const isSummary = node.isSummary;
    const succs = successors.get(t.id) ?? [];
    let freeFloat = slackN;
    if (!isSummary && succs.length) {
      let minSuccEs = "";
      for (const s of succs) {
        const ses = esMap.get(s.id);
        if (ses) minSuccEs = minSuccEs ? minISO(minSuccEs, ses) : ses;
      }
      if (minSuccEs) {
        const ff = workingDaysInclusive(cal, ef, minSuccEs) - 1;
        freeFloat = Math.max(0, Number.isFinite(ff) ? ff : 0);
      }
    }
    const isMilestone = !isSummary && t.duration <= 0;
    const start = isSummary || t.mode === "auto" ? es : t.start || es;
    const finish = isSummary || t.mode === "auto" ? ef : t.finish || ef;
    const duration = isSummary ? workingDaysInclusive(cal, start, finish) : t.duration;
    return {
      ...t,
      duration,
      start,
      finish,
      wbs: wbs.get(t.id) ?? "",
      parentId: node.parentId,
      isSummary,
      isMilestone,
      es,
      ef,
      ls,
      lf,
      slack: slackN,
      freeFloat,
      critical: !isSummary && slackN <= 0.05,
      hidden: hidden.has(t.id),
    };
  });
}

export function durationFromRendimiento(metrado: number, rendimiento: number) {
  if (!(rendimiento > 0) || !(metrado > 0)) return 1;
  return Math.max(1, Math.ceil(metrado / rendimiento - 1e-9));
}

export function rendimientoFromDuration(metrado: number, duration: number) {
  if (!(duration > 0) || !(metrado > 0)) return 0;
  return Math.round((metrado / duration) * 1000) / 1000;
}

export function indentTasks(tasks: CronoTask[], ids: string[], dir: 1 | -1) {
  const set = new Set(ids);
  return tasks.map((t) => (set.has(t.id) ? { ...t, indent: Math.max(0, t.indent + dir) } : t));
}

export function linkFs(tasks: CronoTask[], ids: string[]) {
  if (ids.length < 2) return tasks;
  const next = tasks.map((t) => ({ ...t, pred: t.pred.map((p) => ({ ...p })) }));
  for (let i = 1; i < ids.length; i++) {
    const prev = ids[i - 1];
    const cur = next.find((t) => t.id === ids[i]);
    if (!cur) continue;
    if (!cur.pred.some((p) => p.id === prev)) cur.pred.push({ id: prev, type: "FS", lag: 0 });
  }
  return next;
}

export function unlinkSelected(tasks: CronoTask[], ids: string[]) {
  const set = new Set(ids);
  return tasks.map((t) => (set.has(t.id) ? { ...t, pred: t.pred.filter((p) => !set.has(p.id)) } : t));
}

export function formatPred(pred: Predecessor[], tasks: CronoTask[]) {
  return pred
    .map((p) => {
      const i = tasks.findIndex((t) => t.id === p.id);
      const n = i >= 0 ? i + 1 : "?";
      const lag = p.lag === 0 ? "" : p.lag > 0 ? `+${p.lag}` : `${p.lag}`;
      return p.type === "FS" && !lag ? String(n) : `${n}${p.type}${lag}`;
    })
    .join(";");
}

export function parsePred(text: string, tasks: CronoTask[]): Predecessor[] {
  const out: Predecessor[] = [];
  for (const raw of text.split(/[;,\s]+/).filter(Boolean)) {
    const m = raw.match(/^(\d+)(FS|SS|FF|SF)?([+-]\d+)?$/i);
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1;
    const t = tasks[idx];
    if (!t) continue;
    out.push({
      id: t.id,
      type: ((m[2] || "FS").toUpperCase() as Predecessor["type"]),
      lag: m[3] ? parseInt(m[3], 10) : 0,
    });
  }
  return out;
}

/** Hay ciclo si el predecesor ya depende, directa o indirectamente, del sucesor. */
export function wouldCycle(tasks: CronoTask[], successorId: string, predecessorId: string): boolean {
  if (successorId === predecessorId) return true;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const stack = [predecessorId];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === successorId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const t = byId.get(id);
    if (!t) continue;
    for (const p of t.pred) stack.push(p.id);
  }
  return false;
}

export function linkTasks(
  tasks: CronoTask[],
  predecessorId: string,
  successorId: string,
  type: PredType = "FS",
  lag = 0,
): CronoTask[] {
  if (!predecessorId || !successorId || predecessorId === successorId) return tasks;
  const { nodes } = buildTree(tasks);
  if (nodes.get(predecessorId)?.isSummary || nodes.get(successorId)?.isSummary) return tasks;
  if (wouldCycle(tasks, successorId, predecessorId)) return tasks;
  return tasks.map((t) => {
    if (t.id !== successorId) return t;
    const pred = t.pred.filter((p) => p.id !== predecessorId);
    pred.push({ id: predecessorId, type, lag });
    return { ...t, pred };
  });
}

export function unlinkPair(tasks: CronoTask[], predecessorId: string, successorId: string): CronoTask[] {
  return tasks.map((t) => (t.id !== successorId ? t : { ...t, pred: t.pred.filter((p) => p.id !== predecessorId) }));
}

export function updateLink(
  tasks: CronoTask[],
  predecessorId: string,
  successorId: string,
  patch: Partial<Pick<Predecessor, "type" | "lag">>,
): CronoTask[] {
  return tasks.map((t) => {
    if (t.id !== successorId) return t;
    return {
      ...t,
      pred: t.pred.map((p) => (p.id === predecessorId ? { ...p, ...patch } : p)),
    };
  });
}

export function linkChain(tasks: CronoTask[], ids: string[], type: PredType = "FS", lag = 0): CronoTask[] {
  let next = tasks;
  for (let i = 1; i < ids.length; i++) {
    next = linkTasks(next, ids[i - 1], ids[i], type, lag);
  }
  return next;
}
