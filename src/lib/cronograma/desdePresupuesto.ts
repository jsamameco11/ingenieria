import { calcularApu, partidaDeLinea } from "../presupuesto/engine";
import { ESPECIALIDAD_META, JORNADA_BASE } from "../presupuesto/types";
import type { EspecialidadPre, LineaPresupuesto, PresupuestoState } from "../presupuesto/types";
import { defaultCalendar, netHoursPerDay, toISO } from "./calendar";
import { durationFromRendimiento, emptyTask } from "./cpm";
import { defaultCronograma } from "./state";
import type { CronoTask, CronogramaState, PredType } from "./types";

type CapBucket = {
  cap: string;
  num: string;
  leaves: CronoTask[];
};

type Enlace = {
  destEsp: EspecialidadPre;
  destCap: string;
  origEsp: EspecialidadPre;
  origCap: string;
  type: PredType;
  lag: number;
  from: "first" | "last";
};

/** Lógica de obra: no encadena todas las partidas en una sola fila. */
const ENLACES: Enlace[] = [
  { destEsp: "arquitectura", destCap: "02", origEsp: "arquitectura", origCap: "01", type: "FS", lag: 0, from: "last" },
  { destEsp: "estructuras", destCap: "03", origEsp: "arquitectura", origCap: "02", type: "FS", lag: 0, from: "last" },
  { destEsp: "estructuras", destCap: "04", origEsp: "estructuras", origCap: "03", type: "FS", lag: 0, from: "last" },
  { destEsp: "arquitectura", destCap: "05", origEsp: "estructuras", origCap: "03", type: "FS", lag: 0, from: "last" },
  { destEsp: "arquitectura", destCap: "06", origEsp: "arquitectura", origCap: "05", type: "FS", lag: 1, from: "last" },
  { destEsp: "arquitectura", destCap: "07", origEsp: "arquitectura", origCap: "06", type: "FS", lag: 0, from: "last" },
  { destEsp: "arquitectura", destCap: "08", origEsp: "arquitectura", origCap: "07", type: "SS", lag: 2, from: "first" },
  { destEsp: "arquitectura", destCap: "09", origEsp: "arquitectura", origCap: "06", type: "FS", lag: 0, from: "last" },
  { destEsp: "arquitectura", destCap: "10", origEsp: "arquitectura", origCap: "05", type: "FS", lag: 2, from: "last" },
  { destEsp: "arquitectura", destCap: "11", origEsp: "arquitectura", origCap: "10", type: "FS", lag: 0, from: "last" },
  { destEsp: "arquitectura", destCap: "12", origEsp: "arquitectura", origCap: "06", type: "FS", lag: 3, from: "last" },
  { destEsp: "arquitectura", destCap: "12", origEsp: "arquitectura", origCap: "09", type: "FS", lag: 0, from: "last" },
  { destEsp: "arquitectura", destCap: "13", origEsp: "estructuras", origCap: "04", type: "SS", lag: 5, from: "first" },
  { destEsp: "arquitectura", destCap: "14", origEsp: "arquitectura", origCap: "02", type: "FS", lag: 0, from: "last" },
  { destEsp: "sanitarias", destCap: "01", origEsp: "arquitectura", origCap: "05", type: "SS", lag: 3, from: "first" },
  { destEsp: "sanitarias", destCap: "02", origEsp: "sanitarias", origCap: "01", type: "FS", lag: 0, from: "last" },
  { destEsp: "sanitarias", destCap: "03", origEsp: "sanitarias", origCap: "01", type: "SS", lag: 2, from: "first" },
  { destEsp: "sanitarias", destCap: "04", origEsp: "estructuras", origCap: "04", type: "SS", lag: 4, from: "first" },
  { destEsp: "electricas", destCap: "01", origEsp: "arquitectura", origCap: "05", type: "SS", lag: 4, from: "first" },
  { destEsp: "electricas", destCap: "04", origEsp: "electricas", origCap: "01", type: "SS", lag: 1, from: "first" },
  { destEsp: "electricas", destCap: "02", origEsp: "electricas", origCap: "04", type: "FS", lag: 0, from: "last" },
  { destEsp: "electricas", destCap: "05", origEsp: "arquitectura", origCap: "12", type: "SS", lag: 0, from: "first" },
  { destEsp: "comunicaciones", destCap: "01", origEsp: "electricas", origCap: "01", type: "SS", lag: 1, from: "first" },
  { destEsp: "mecanicas", destCap: "01", origEsp: "sanitarias", origCap: "04", type: "FS", lag: 0, from: "last" },
  { destEsp: "mecanicas", destCap: "02", origEsp: "estructuras", origCap: "04", type: "SS", lag: 8, from: "first" },
  { destEsp: "electromecanicas", destCap: "01", origEsp: "electricas", origCap: "02", type: "FS", lag: 0, from: "last" },
  { destEsp: "electromecanicas", destCap: "03", origEsp: "electromecanicas", origCap: "01", type: "SS", lag: 2, from: "first" },
  { destEsp: "electromecanicas", destCap: "04", origEsp: "electromecanicas", origCap: "03", type: "FS", lag: 0, from: "last" },
  { destEsp: "arquitectura", destCap: "16", origEsp: "arquitectura", origCap: "12", type: "FS", lag: 0, from: "last" },
  { destEsp: "arquitectura", destCap: "16", origEsp: "electricas", origCap: "05", type: "FS", lag: 0, from: "last" },
  { destEsp: "arquitectura", destCap: "16", origEsp: "arquitectura", origCap: "11", type: "FS", lag: 1, from: "last" },
  { destEsp: "arquitectura", destCap: "16", origEsp: "arquitectura", origCap: "09", type: "FS", lag: 0, from: "last" },

  { destEsp: "carreteras", destCap: "02", origEsp: "carreteras", origCap: "01", type: "FS", lag: 0, from: "last" },
  { destEsp: "carreteras", destCap: "04", origEsp: "carreteras", origCap: "02", type: "SS", lag: 5, from: "first" },
  { destEsp: "carreteras", destCap: "03", origEsp: "carreteras", origCap: "02", type: "FS", lag: 0, from: "last" },
  { destEsp: "carreteras", destCap: "05", origEsp: "carreteras", origCap: "03", type: "FS", lag: 0, from: "last" },
  { destEsp: "carreteras", destCap: "06", origEsp: "carreteras", origCap: "03", type: "FS", lag: 0, from: "last" },

  { destEsp: "puentes", destCap: "01", origEsp: "puentes", origCap: "00", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "02", origEsp: "puentes", origCap: "01", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "03", origEsp: "puentes", origCap: "01", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "04", origEsp: "puentes", origCap: "02", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "04", origEsp: "puentes", origCap: "03", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "05", origEsp: "puentes", origCap: "04", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "06", origEsp: "puentes", origCap: "04", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "07", origEsp: "puentes", origCap: "04", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "08", origEsp: "puentes", origCap: "02", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "08", origEsp: "puentes", origCap: "04", type: "SS", lag: 2, from: "first" },
  { destEsp: "puentes", destCap: "09", origEsp: "puentes", origCap: "04", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "10", origEsp: "puentes", origCap: "04", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "11", origEsp: "puentes", origCap: "04", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "12", origEsp: "puentes", origCap: "05", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "12", origEsp: "puentes", origCap: "06", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "12", origEsp: "puentes", origCap: "07", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "12", origEsp: "puentes", origCap: "08", type: "SS", lag: 3, from: "first" },
  { destEsp: "puentes", destCap: "13", origEsp: "puentes", origCap: "04", type: "SS", lag: 5, from: "first" },
  { destEsp: "puentes", destCap: "13", origEsp: "puentes", origCap: "12", type: "SS", lag: 0, from: "first" },
  { destEsp: "puentes", destCap: "14", origEsp: "puentes", origCap: "12", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "14", origEsp: "puentes", origCap: "13", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "15", origEsp: "puentes", origCap: "02", type: "FS", lag: 0, from: "last" },
  { destEsp: "puentes", destCap: "15", origEsp: "puentes", origCap: "14", type: "FS", lag: 0, from: "last" },

  { destEsp: "saneamiento", destCap: "02", origEsp: "saneamiento", origCap: "01", type: "FS", lag: 0, from: "last" },
  { destEsp: "saneamiento", destCap: "03", origEsp: "saneamiento", origCap: "02", type: "SS", lag: 2, from: "first" },
  { destEsp: "saneamiento", destCap: "04", origEsp: "saneamiento", origCap: "02", type: "SS", lag: 3, from: "first" },
  { destEsp: "saneamiento", destCap: "04", origEsp: "saneamiento", origCap: "03", type: "SS", lag: 1, from: "first" },
  { destEsp: "saneamiento", destCap: "05", origEsp: "saneamiento", origCap: "04", type: "FS", lag: 0, from: "last" },
  { destEsp: "saneamiento", destCap: "06", origEsp: "saneamiento", origCap: "03", type: "FS", lag: 0, from: "last" },
  { destEsp: "saneamiento", destCap: "06", origEsp: "saneamiento", origCap: "04", type: "FS", lag: 0, from: "last" },
  { destEsp: "saneamiento", destCap: "01", origEsp: "habilitaciones", origCap: "01", type: "SS", lag: 0, from: "first" },

  { destEsp: "hidraulica", destCap: "02", origEsp: "hidraulica", origCap: "01", type: "FS", lag: 0, from: "last" },
  { destEsp: "hidraulica", destCap: "03", origEsp: "hidraulica", origCap: "02", type: "FS", lag: 0, from: "last" },
  { destEsp: "hidraulica", destCap: "04", origEsp: "hidraulica", origCap: "02", type: "SS", lag: 8, from: "first" },
  { destEsp: "hidraulica", destCap: "05", origEsp: "hidraulica", origCap: "03", type: "SS", lag: 3, from: "first" },

  { destEsp: "habilitaciones", destCap: "02", origEsp: "habilitaciones", origCap: "01", type: "FS", lag: 0, from: "last" },
  { destEsp: "habilitaciones", destCap: "03", origEsp: "habilitaciones", origCap: "02", type: "SS", lag: 5, from: "first" },
  { destEsp: "habilitaciones", destCap: "04", origEsp: "habilitaciones", origCap: "01", type: "FS", lag: 2, from: "last" },
  { destEsp: "habilitaciones", destCap: "05", origEsp: "habilitaciones", origCap: "03", type: "SS", lag: 2, from: "first" },
  { destEsp: "habilitaciones", destCap: "05", origEsp: "habilitaciones", origCap: "04", type: "FS", lag: 0, from: "last" },
  { destEsp: "habilitaciones", destCap: "06", origEsp: "habilitaciones", origCap: "01", type: "FS", lag: 5, from: "last" },
  { destEsp: "habilitaciones", destCap: "06", origEsp: "habilitaciones", origCap: "05", type: "SS", lag: 1, from: "first" },
  { destEsp: "habilitaciones", destCap: "07", origEsp: "habilitaciones", origCap: "02", type: "FS", lag: 0, from: "last" },
  { destEsp: "habilitaciones", destCap: "07", origEsp: "habilitaciones", origCap: "06", type: "FS", lag: 0, from: "last" },

  { destEsp: "pavimentos", destCap: "02", origEsp: "pavimentos", origCap: "01", type: "FS", lag: 0, from: "last" },
  { destEsp: "pavimentos", destCap: "03", origEsp: "pavimentos", origCap: "02", type: "FS", lag: 0, from: "last" },
  { destEsp: "pavimentos", destCap: "04", origEsp: "pavimentos", origCap: "03", type: "FS", lag: 0, from: "last" },
  { destEsp: "pavimentos", destCap: "05", origEsp: "pavimentos", origCap: "03", type: "FS", lag: 0, from: "last" },
  { destEsp: "pavimentos", destCap: "06", origEsp: "pavimentos", origCap: "02", type: "SS", lag: 3, from: "first" },
  { destEsp: "pavimentos", destCap: "07", origEsp: "pavimentos", origCap: "04", type: "FS", lag: 0, from: "last" },
  { destEsp: "pavimentos", destCap: "07", origEsp: "pavimentos", origCap: "05", type: "FS", lag: 0, from: "last" },
  { destEsp: "pavimentos", destCap: "08", origEsp: "pavimentos", origCap: "03", type: "FS", lag: 0, from: "last" },
  { destEsp: "pavimentos", destCap: "09", origEsp: "pavimentos", origCap: "03", type: "FS", lag: 0, from: "last" },
  { destEsp: "pavimentos", destCap: "10", origEsp: "pavimentos", origCap: "08", type: "FS", lag: 2, from: "last" },
];

function capNum(capitulo: string) {
  const m = capitulo.match(/^(\d{2})/);
  return m ? m[1] : "99";
}

function grupoCodigo(codigo: string) {
  const bits = codigo.split(".");
  return bits.length >= 2 ? `${bits[0]}.${bits[1]}` : codigo;
}

function crewDe(esp: EspecialidadPre) {
  if (esp === "carreteras" || esp === "pavimentos" || esp === "habilitaciones") return 8;
  if (esp === "puentes") return 8;
  if (esp === "estructuras" || esp === "hidraulica") return 6;
  if (esp === "arquitectura") return 5;
  return 4;
}

function addPred(task: CronoTask, id: string, type: PredType, lag: number) {
  if (!id || id === task.id) return;
  if (task.pred.some((p) => p.id === id && p.type === type)) return;
  task.pred.push({ id, type, lag });
}

function firstOf(map: Map<string, CronoTask[]>, esp: EspecialidadPre, cap: string) {
  const arr = map.get(`${esp}::${cap}`);
  return arr?.[0];
}

function lastOf(map: Map<string, CronoTask[]>, esp: EspecialidadPre, cap: string) {
  const arr = map.get(`${esp}::${cap}`);
  return arr && arr.length ? arr[arr.length - 1] : undefined;
}

function hojaDesdeLinea(
  linea: LineaPresupuesto,
  start: string,
  hours: number,
  jornada: number,
  precios: Record<string, number>,
  extras: PresupuestoState["insumosPropios"]
): { task: CronoTask; esp: EspecialidadPre; cap: string; num: string } | null {
  const partida = partidaDeLinea(linea);
  if (!partida || linea.metrado <= 0) return null;
  const apu = calcularApu(partida, precios, linea.receta, extras, jornada);
  const hh = apu.porKind.mo.items.reduce((s, r) => s + (r.insumo.id === "EQ-HIN" ? 0 : r.cantidad), 0);
  const crew = crewDe(partida.especialidad);
  const undPorDia = hh > 0 ? (hours * crew) / hh : 0;
  const rendimiento = undPorDia > 0 ? Math.round(undPorDia * 1000) / 1000 : linea.metrado > 0 ? Math.max(linea.metrado, 1) : 1;
  const duration = rendimiento > 0 && linea.metrado > 0 ? durationFromRendimiento(linea.metrado, rendimiento) : 1;
  const task = emptyTask(
    {
      id: `C-${linea.id}`,
      name: `${partida.codigo} · ${partida.descripcion}`,
      indent: 2,
      duration,
      metrado: linea.metrado,
      und: partida.und,
      rendimiento,
      crew,
      partidaCodigo: partida.codigo,
      resource: hh > 0 ? `Cuadrilla ${crew}` : "",
      notes: hh > 0 ? `${hh.toFixed(2)} hh / ${partida.und}` : "Sin mano de obra en el APU",
    },
    start
  );
  return { task, esp: partida.especialidad, cap: partida.capitulo, num: capNum(partida.capitulo) };
}

/**
 * Extrae todas las partidas del presupuesto y arma EDT + red de antecesoras
 * (FC / CC) según secuencia de construcción, no una cadena única.
 */
export function cronogramaDesdePresupuesto(pre: PresupuestoState): CronogramaState {
  const start = pre.fecha || toISO(new Date());
  const year = Number(start.slice(0, 4)) || new Date().getFullYear();
  const calendar = pre.cronograma?.calendar ?? defaultCalendar(year);
  const hours = netHoursPerDay(calendar) || JORNADA_BASE;
  const jornada = pre.jornada > 0 ? pre.jornada : JORNADA_BASE;

  const hitoIni = emptyTask(
    { id: "H-ini", name: "Hito · Inicio de obra", indent: 0, duration: 0, notes: "Comienzo contractual" },
    start
  );
  const tasks: CronoTask[] = [hitoIni];
  const byEsp = new Map<EspecialidadPre, Map<string, CapBucket>>();

  for (const linea of pre.lineas) {
    const hoja = hojaDesdeLinea(linea, start, hours, jornada, pre.precios, pre.insumosPropios);
    if (!hoja) continue;
    let caps = byEsp.get(hoja.esp);
    if (!caps) {
      caps = new Map();
      byEsp.set(hoja.esp, caps);
    }
    let bucket = caps.get(hoja.num);
    if (!bucket) {
      bucket = { cap: hoja.cap, num: hoja.num, leaves: [] };
      caps.set(hoja.num, bucket);
    }
    bucket.leaves.push(hoja.task);
  }

  const leafMap = new Map<string, CronoTask[]>();
  const destConEnlace = new Set<string>();
  for (const e of ENLACES) destConEnlace.add(`${e.destEsp}::${e.destCap}`);

  /** Respaldo local cap→cap si el ENLACE cruzado no llega a aplicarse. */
  const pendingLocal: { dest: CronoTask; orig: CronoTask; key: string }[] = [];

  const orderedEsp = [...byEsp.keys()].sort(
    (a, b) => (ESPECIALIDAD_META[a]?.orden ?? 99) - (ESPECIALIDAD_META[b]?.orden ?? 99)
  );

  for (const esp of orderedEsp) {
    const meta = ESPECIALIDAD_META[esp];
    tasks.push(
      emptyTask(
        { id: `S-${esp}`, name: meta ? `${meta.kicker} · ${meta.label}` : esp, indent: 0, duration: 0, resource: "" },
        start
      )
    );
    const caps = [...byEsp.get(esp)!.values()].sort((a, b) => a.num.localeCompare(b.num));
    let prevLast: CronoTask | undefined;
    for (const bucket of caps) {
      tasks.push(
        emptyTask(
          { id: `S-${esp}-${bucket.num}`, name: bucket.cap, indent: 1, duration: 0, resource: "" },
          start
        )
      );
      const groups = new Map<string, CronoTask[]>();
      for (const leaf of bucket.leaves) {
        const g = grupoCodigo(leaf.partidaCodigo || leaf.name);
        const arr = groups.get(g) ?? [];
        arr.push(leaf);
        groups.set(g, arr);
      }
      const orderedGroups = [...groups.values()];
      let prevGroupLast: CronoTask | undefined;
      for (const group of orderedGroups) {
        const first = group[0];
        if (prevGroupLast) addPred(first, prevGroupLast.id, "FS", 0);
        for (let i = 1; i < group.length; i++) addPred(group[i], first.id, "SS", 0);
        prevGroupLast = group[group.length - 1];
        tasks.push(...group);
      }
      const key = `${esp}::${bucket.num}`;
      leafMap.set(key, bucket.leaves);
      if (prevLast && bucket.leaves[0]) {
        if (destConEnlace.has(key)) {
          // Puede haber ENLACE (a veces en orden inverso, p. ej. eléc. 02←04).
          // Solo usamos cadena local si ese enlace no se aplica (origen ausente).
          pendingLocal.push({ dest: bucket.leaves[0], orig: prevLast, key });
        } else {
          addPred(bucket.leaves[0], prevLast.id, "FS", 0);
        }
      }
      prevLast = bucket.leaves[bucket.leaves.length - 1];
    }
  }

  const enlacesAplicados = new Set<string>();
  for (const e of ENLACES) {
    const dest = firstOf(leafMap, e.destEsp, e.destCap);
    const orig = e.from === "first" ? firstOf(leafMap, e.origEsp, e.origCap) : lastOf(leafMap, e.origEsp, e.origCap);
    if (!dest || !orig) continue;
    addPred(dest, orig.id, e.type, e.lag);
    enlacesAplicados.add(`${e.destEsp}::${e.destCap}`);
  }

  for (const p of pendingLocal) {
    if (!enlacesAplicados.has(p.key)) addPred(p.dest, p.orig.id, "FS", 0);
  }

  const leaves = tasks.filter((t) => t.partidaCodigo);
  for (const leaf of leaves) {
    if (leaf.pred.length === 0) addPred(leaf, hitoIni.id, "FS", 0);
  }

  const hitoFin = emptyTask(
    { id: "H-fin", name: "Hito · Entrega de obra", indent: 0, duration: 0, notes: "Recepción y liquidación" },
    start
  );
  for (const esp of orderedEsp) {
    const caps = [...(byEsp.get(esp)?.values() ?? [])].sort((a, b) => a.num.localeCompare(b.num));
    const lastCap = caps[caps.length - 1];
    const last = lastCap?.leaves[lastCap.leaves.length - 1];
    if (last) addPred(hitoFin, last.id, "FS", 0);
  }
  tasks.push(hitoFin);

  return {
    proyecto: pre.obra || "Cronograma de obra",
    start,
    calendar,
    tasks,
    zoom: pre.cronograma?.zoom ?? "week",
    origen: "presupuesto",
  };
}

export function partidasSinTarea(pre: PresupuestoState, crono: CronogramaState) {
  const ids = new Set(crono.tasks.map((t) => t.id));
  return pre.lineas.filter((l) => partidaDeLinea(l) && !ids.has(`C-${l.id}`));
}

export function resumenVinculo(pre: PresupuestoState, crono: CronogramaState) {
  const validas = pre.lineas.filter((l) => partidaDeLinea(l));
  const importadas = validas.filter((l) => crono.tasks.some((t) => t.id === `C-${l.id}`)).length;
  const faltan = Math.max(0, validas.length - importadas);
  return { validas: validas.length, importadas, faltan, obra: pre.obra };
}

export function cronogramaVacioLigado(pre: PresupuestoState): CronogramaState {
  return defaultCronograma({
    proyecto: pre.obra || "Cronograma de obra",
    start: pre.fecha || toISO(new Date()),
    calendar: pre.cronograma?.calendar,
    zoom: pre.cronograma?.zoom,
    origen: "manual",
  });
}

/** true si alguna antecesora forma un ciclo. */
export function hayCiclo(tasks: CronoTask[]): boolean {
  const ids = new Set(tasks.map((t) => t.id));
  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    adj.set(
      t.id,
      t.pred.filter((p) => ids.has(p.id)).map((p) => p.id)
    );
  }
  const seen = new Set<string>();
  const stack = new Set<string>();
  const dfs = (id: string): boolean => {
    if (stack.has(id)) return true;
    if (seen.has(id)) return false;
    stack.add(id);
    for (const p of adj.get(id) ?? []) {
      if (dfs(p)) return true;
    }
    stack.delete(id);
    seen.add(id);
    return false;
  };
  return tasks.some((t) => dfs(t.id));
}
