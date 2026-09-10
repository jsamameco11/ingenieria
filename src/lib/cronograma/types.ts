export type TaskMode = "auto" | "man";
export type ConstraintType = "ASAP" | "ALAP" | "MSO" | "MFO" | "SNET" | "SNLT" | "FNET" | "FNLT";
export type PredType = "FS" | "SS" | "FF" | "SF";
export type ZoomCrono = "day" | "week" | "month";

export type Predecessor = {
  id: string;
  type: PredType;
  lag: number;
};

export type Holiday = {
  date: string;
  name: string;
};

export type CalendarException = {
  date: string;
  working: boolean;
  name: string;
};

export type WorkCalendar = {
  name: string;
  /** Domingo=0 … Sábado=6 */
  weekDays: boolean[];
  hoursPerDay: number;
  startHour: string;
  endHour: string;
  lunchStart: string;
  lunchEnd: string;
  holidays: Holiday[];
  exceptions: CalendarException[];
};

export type CronoTask = {
  id: string;
  name: string;
  indent: number;
  mode: TaskMode;
  duration: number;
  start: string;
  finish: string;
  pred: Predecessor[];
  constraint: ConstraintType;
  constraintDate: string;
  metrado: number;
  und: string;
  rendimiento: number;
  crew: number;
  pct: number;
  notes: string;
  partidaCodigo?: string;
  resource: string;
  collapsed: boolean;
};

export type CronoComputed = CronoTask & {
  wbs: string;
  parentId: string | null;
  isSummary: boolean;
  isMilestone: boolean;
  es: string;
  ef: string;
  ls: string;
  lf: string;
  slack: number;
  freeFloat: number;
  critical: boolean;
  hidden: boolean;
};

export type CronogramaState = {
  proyecto: string;
  start: string;
  calendar: WorkCalendar;
  tasks: CronoTask[];
  zoom: ZoomCrono;
  /** presupuesto = extraído de las partidas; manual = Gantt vacío o armado a mano. */
  origen?: "presupuesto" | "manual";
};

export const CONSTRAINT_META: Record<ConstraintType, string> = {
  ASAP: "Lo antes posible",
  ALAP: "Lo más tarde posible",
  MSO: "Debe comenzar el",
  MFO: "Debe terminar el",
  SNET: "No comenzar antes del",
  SNLT: "No comenzar después del",
  FNET: "No terminar antes del",
  FNLT: "No terminar después del",
};

export const PRED_META: Record<PredType, string> = {
  FS: "Fin a comienzo (FC)",
  SS: "Comienzo a comienzo (CC)",
  FF: "Fin a fin (FF)",
  SF: "Comienzo a fin (CF)",
};
