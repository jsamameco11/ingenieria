import { defaultCalendar, toISO } from "./calendar";
import type { CronoTask, CronogramaState } from "./types";

export function defaultCronograma(partial: Partial<CronogramaState> = {}): CronogramaState {
  const start = partial.start || toISO(new Date());
  const year = Number(start.slice(0, 4)) || new Date().getFullYear();
  const calBase = defaultCalendar(year);
  return {
    proyecto: partial.proyecto?.trim() ? partial.proyecto : "Cronograma de obra",
    start,
    zoom: partial.zoom ?? "week",
    tasks: partial.tasks ?? [],
    origen: partial.origen,
    calendar: partial.calendar
      ? { ...calBase, ...partial.calendar, weekDays: partial.calendar.weekDays ?? calBase.weekDays }
      : calBase,
  };
}

function taskCompleta(t: Partial<CronoTask>, start: string): CronoTask {
  return {
    id: t.id || `T${Math.random().toString(36).slice(2, 8)}`,
    name: t.name || "Tarea",
    indent: t.indent ?? 0,
    mode: t.mode === "man" ? "man" : "auto",
    duration: Number.isFinite(t.duration) ? Number(t.duration) : 1,
    start: t.start || start,
    finish: t.finish || start,
    pred: Array.isArray(t.pred) ? t.pred.filter((p) => p && p.id) : [],
    constraint: t.constraint ?? "ASAP",
    constraintDate: t.constraintDate ?? "",
    metrado: Number(t.metrado) || 0,
    und: t.und || "und",
    rendimiento: Number(t.rendimiento) || 0,
    crew: Number(t.crew) || 1,
    pct: Number(t.pct) || 0,
    notes: t.notes ?? "",
    partidaCodigo: t.partidaCodigo,
    resource: t.resource ?? "",
    collapsed: Boolean(t.collapsed),
  };
}

export function hydrateCronograma(raw: unknown): CronogramaState {
  const base = defaultCronograma();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<CronogramaState>;
  const start = typeof o.start === "string" && o.start ? o.start : base.start;
  return {
    ...base,
    ...o,
    start,
    proyecto: typeof o.proyecto === "string" && o.proyecto.trim() ? o.proyecto : base.proyecto,
    zoom: o.zoom === "day" || o.zoom === "month" ? o.zoom : "week",
    calendar: {
      ...base.calendar,
      ...(o.calendar ?? {}),
      weekDays: Array.isArray(o.calendar?.weekDays) && o.calendar.weekDays.length === 7 ? o.calendar.weekDays : base.calendar.weekDays,
      holidays: Array.isArray(o.calendar?.holidays) ? o.calendar.holidays : base.calendar.holidays,
      exceptions: Array.isArray(o.calendar?.exceptions) ? o.calendar.exceptions : base.calendar.exceptions,
    },
    tasks: Array.isArray(o.tasks) ? o.tasks.map((t) => taskCompleta(t, start)) : [],
    origen: o.origen === "manual" || o.origen === "presupuesto" ? o.origen : undefined,
  };
}
