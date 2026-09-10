import type { Holiday, WorkCalendar } from "./types";

export function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export function feriadosPeru(year: number): Holiday[] {
  const easter = easterSunday(year);
  const jueves = addDays(easter, -3);
  const viernes = addDays(easter, -2);
  return [
    { date: `${year}-01-01`, name: "Año Nuevo" },
    { date: toISO(jueves), name: "Jueves Santo" },
    { date: toISO(viernes), name: "Viernes Santo" },
    { date: `${year}-05-01`, name: "Día del Trabajo" },
    { date: `${year}-06-07`, name: "Batalla de Arica y Día de la Bandera" },
    { date: `${year}-06-29`, name: "San Pedro y San Pablo" },
    { date: `${year}-07-28`, name: "Fiestas Patrias" },
    { date: `${year}-07-29`, name: "Fiestas Patrias" },
    { date: `${year}-08-06`, name: "Batalla de Junín" },
    { date: `${year}-08-30`, name: "Santa Rosa de Lima" },
    { date: `${year}-10-08`, name: "Combate de Angamos" },
    { date: `${year}-11-01`, name: "Todos los Santos" },
    { date: `${year}-12-08`, name: "Inmaculada Concepción" },
    { date: `${year}-12-09`, name: "Batalla de Ayacucho" },
    { date: `${year}-12-25`, name: "Navidad" },
  ];
}

/** Computus — domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function defaultCalendar(startYear = new Date().getFullYear()): WorkCalendar {
  const holidays = [...feriadosPeru(startYear), ...feriadosPeru(startYear + 1)];
  return {
    // Régimen de construcción civil (CAPECO-FTCCP): jornada de lunes a sábado, 8 h/día (ver PRE-06).
    name: "Calendario de obra · Perú (Lun–Sáb, 8 h)",
    weekDays: [false, true, true, true, true, true, true],
    hoursPerDay: 8,
    startHour: "08:00",
    endHour: "17:00",
    lunchStart: "12:00",
    lunchEnd: "13:00",
    holidays,
    exceptions: [],
  };
}

export function isWorking(cal: WorkCalendar, date: Date | string) {
  const iso = typeof date === "string" ? date : toISO(date);
  const d = typeof date === "string" ? parseISO(date) : date;
  const ex = cal.exceptions.find((x) => x.date === iso);
  if (ex) return ex.working;
  if (cal.holidays.some((h) => h.date === iso)) return false;
  return Boolean(cal.weekDays[d.getDay()]);
}

export function nextWorking(cal: WorkCalendar, date: Date, dir = 1) {
  let cur = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let guard = 0;
  while (!isWorking(cal, cur) && guard < 800) {
    cur = addDays(cur, dir);
    guard += 1;
  }
  return cur;
}

/** Duración n días: el fin es el n-ésimo día laborable contando el inicio. */
export function addWorkingDuration(cal: WorkCalendar, start: Date | string, durationDays: number) {
  let cur = nextWorking(cal, typeof start === "string" ? parseISO(start) : start);
  if (durationDays <= 0) return cur;
  let left = durationDays - 1;
  while (left > 0) {
    cur = addDays(cur, 1);
    if (isWorking(cal, cur)) left -= 1;
  }
  return cur;
}

export function addWorkingDays(cal: WorkCalendar, start: Date | string, days: number) {
  let cur = typeof start === "string" ? parseISO(start) : new Date(start);
  if (days === 0) return cur;
  const dir = days > 0 ? 1 : -1;
  let left = Math.abs(days);
  while (left > 0) {
    cur = addDays(cur, dir);
    if (isWorking(cal, cur)) left -= 1;
  }
  return cur;
}

export function workingDaysInclusive(cal: WorkCalendar, start: Date | string, finish: Date | string) {
  let a = typeof start === "string" ? parseISO(start) : start;
  const b = typeof finish === "string" ? parseISO(finish) : finish;
  if (a > b) return 0;
  let n = 0;
  while (a <= b) {
    if (isWorking(cal, a)) n += 1;
    a = addDays(a, 1);
  }
  return n;
}

export function calendarDaysBetween(a: string, b: string) {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86400000);
}

export function hoursFromRange(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh + em / 60 - (sh + sm / 60));
}

export function netHoursPerDay(cal: WorkCalendar) {
  const bruto = hoursFromRange(cal.startHour, cal.endHour);
  const lunch = hoursFromRange(cal.lunchStart, cal.lunchEnd);
  return Math.max(0.5, bruto - lunch);
}
