import { supabase, supabaseConfigured } from "../supabase";
import { calcularPresupuesto, defaultPresupuesto, migrarLineaTierrasEst } from "./engine";
import { sanitizarInsumosPropios } from "./insumosObra";
import { hydrateCronograma } from "../cronograma/state";
import { hydrateValorizaciones } from "../valorizaciones/state";
import type { PresupuestoArchivo, PresupuestoState } from "./types";

const BUCKET = "presupuestos";
const LOCAL_KEY = "memorcalc-ppto-archivos-v1";

export type PresupuestoDocumento = PresupuestoArchivo & { state: PresupuestoState };

function metaDe(
  state: PresupuestoState,
  id: string,
  nombre: string,
  savedAt: string,
  origen: "nube" | "local" = "local"
): PresupuestoArchivo {
  const calc = calcularPresupuesto(state);
  return {
    id,
    nombre,
    obra: state.obra,
    cliente: state.cliente,
    lugar: state.lugar,
    partidas: state.lineas.length,
    total: calc.total,
    savedAt,
    origen,
  };
}

export function nuevoId() {
  return crypto.randomUUID();
}

export function nombreArchivoSugerido(state: PresupuestoState) {
  const base = (state.archivoNombre || state.obra || "presupuesto").trim() || "presupuesto";
  return base.replace(/\.ppto\.json$/i, "").replace(/\.json$/i, "");
}

/** True si hay cliente Supabase (la nube puede fallar igual si falta schema.sql). */
export function nubeDisponible() {
  return Boolean(supabase);
}

function conTimeout<T>(p: PromiseLike<T>, ms = 12000, msg = "Supabase no respondió."): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(msg)), ms)),
  ]);
}

function payloadDe(state: PresupuestoState, id: string, nombre: string): PresupuestoState {
  return { ...state, archivoId: id, archivoNombre: nombre };
}

type LocalStore = Record<string, PresupuestoDocumento>;

function leerStore(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as LocalStore;
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function escribirStore(store: LocalStore) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
}

function guardarLocal(doc: PresupuestoDocumento) {
  const store = leerStore();
  store[doc.id] = { ...doc, origen: doc.origen ?? "local", state: payloadDe(doc.state, doc.id, doc.nombre) };
  escribirStore(store);
}

function listarLocal(): PresupuestoArchivo[] {
  return Object.values(leerStore())
    .map((d) => metaDe(hydrateState(d.state), d.id, d.nombre, d.savedAt, "local"))
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

function leerLocalDoc(id: string): PresupuestoDocumento | null {
  const d = leerStore()[id];
  if (!d) return null;
  const state = hydrateState(d.state);
  return {
    ...metaDe(state, d.id, d.nombre, d.savedAt, "local"),
    state: payloadDe(state, d.id, d.nombre),
  };
}

function borrarLocal(id: string) {
  const store = leerStore();
  delete store[id];
  escribirStore(store);
}

export function parseArchivo(raw: unknown): PresupuestoDocumento | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.state && typeof o.state === "object") {
    const state = hydrateState(o.state);
    const id = String(o.id || state.archivoId || nuevoId());
    const nombre = String(o.nombre || state.archivoNombre || state.obra || "Presupuesto");
    const savedAt = String(o.savedAt || new Date().toISOString());
    return { ...metaDe(state, id, nombre, savedAt), state: payloadDe(state, id, nombre) };
  }
  if (Array.isArray((o as PresupuestoState).lineas)) {
    const state = hydrateState(o);
    const id = state.archivoId || nuevoId();
    const nombre = state.archivoNombre || state.obra || "Presupuesto";
    const savedAt = new Date().toISOString();
    return { ...metaDe(state, id, nombre, savedAt), state: payloadDe(state, id, nombre) };
  }
  return null;
}

function hydrateState(partial: unknown): PresupuestoState {
  const current = defaultPresupuesto();
  const o = (partial && typeof partial === "object" ? partial : {}) as Partial<PresupuestoState>;
  return {
    ...current,
    ...o,
    lineas: Array.isArray(o.lineas) ? o.lineas.map(migrarLineaTierrasEst) : [],
    precios: o.precios && typeof o.precios === "object" ? o.precios : {},
    organigrama: Array.isArray(o.organigrama) ? o.organigrama : current.organigrama,
    formula: o.formula
      ? {
          ...current.formula,
          ...o.formula,
          indicesIo: { ...current.formula.indicesIo, ...(o.formula.indicesIo ?? {}) },
          indicesIr: { ...current.formula.indicesIr, ...(o.formula.indicesIr ?? {}) },
          destino: { ...current.formula.destino, ...(o.formula.destino ?? {}) },
          coeficientes: { ...current.formula.coeficientes, ...(o.formula.coeficientes ?? {}) },
          creada: typeof o.formula.creada === "boolean" ? o.formula.creada : Boolean(o.lineas?.length),
        }
      : current.formula,
    insumosPropios: sanitizarInsumosPropios(o.insumosPropios),
    moneda: o.moneda === "USD" || o.moneda === "EUR" || o.moneda === "PEN" ? o.moneda : current.moneda,
    tipoCambio: typeof o.tipoCambio === "number" && o.tipoCambio > 0 ? o.tipoCambio : current.tipoCambio,
    jornada: typeof o.jornada === "number" && o.jornada > 0 && o.jornada <= 24 ? o.jornada : current.jornada,
    sistemaContratacion:
      o.sistemaContratacion === "suma-alzada" || o.sistemaContratacion === "costo-mas-porcentaje"
        ? o.sistemaContratacion
        : o.sistemaContratacion === "precios-unitarios"
          ? o.sistemaContratacion
          : current.sistemaContratacion,
    cronograma: hydrateCronograma(o.cronograma),
    valorizaciones: hydrateValorizaciones(o.valorizaciones),
  };
}

type NubeRow = {
  id: string;
  nombre: string;
  obra: string;
  cliente: string;
  lugar: string;
  partidas: number;
  total: number;
  payload: PresupuestoState;
  updated_at: string;
};

export async function listarNube(): Promise<PresupuestoArchivo[]> {
  const local = listarLocal();
  let nube: PresupuestoArchivo[] = [];
  if (supabase) {
    try {
      const { data, error } = await conTimeout(
        supabase
          .from("presupuesto_archivos")
          .select("id,nombre,obra,cliente,lugar,partidas,total,updated_at")
          .order("updated_at", { ascending: false })
      );
      if (!error) {
        nube = (data ?? []).map((r) => ({
          id: r.id,
          nombre: r.nombre,
          obra: r.obra ?? "",
          cliente: r.cliente ?? "",
          lugar: r.lugar ?? "",
          partidas: r.partidas ?? 0,
          total: Number(r.total) || 0,
          savedAt: r.updated_at,
          origen: "nube" as const,
        }));
      }
    } catch {
      nube = [];
    }
  }
  const map = new Map<string, PresupuestoArchivo>();
  for (const a of [...nube, ...local]) {
    const prev = map.get(a.id);
    if (!prev || (a.savedAt || "") > (prev.savedAt || "")) map.set(a.id, a);
  }
  return [...map.values()].sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export async function leerNube(id: string): Promise<PresupuestoDocumento | null> {
  if (supabase) {
    try {
      const { data, error } = await conTimeout(supabase.from("presupuesto_archivos").select("*").eq("id", id).maybeSingle());
      if (!error && data) {
        const row = data as NubeRow;
        const state = hydrateState(row.payload);
        return {
          id: row.id,
          nombre: row.nombre,
          obra: row.obra,
          cliente: row.cliente,
          lugar: row.lugar,
          partidas: row.partidas,
          total: Number(row.total) || 0,
          savedAt: row.updated_at,
          origen: "nube",
          state: payloadDe(state, row.id, row.nombre),
        };
      }
    } catch {
      /* local */
    }
  }
  return leerLocalDoc(id);
}

export async function borrarNube(id: string) {
  borrarLocal(id);
  if (!supabase) return;
  try {
    await conTimeout(supabase.from("presupuesto_archivos").delete().eq("id", id));
    await conTimeout(supabase.storage.from(BUCKET).remove([`${id}.ppto.json`])).catch(() => undefined);
  } catch {
    /* ok */
  }
}

async function guardarNube(doc: PresupuestoDocumento): Promise<void> {
  if (!supabase) throw new Error("Supabase no configurado");
  const row = {
    id: doc.id,
    nombre: doc.nombre,
    obra: doc.obra,
    cliente: doc.cliente,
    lugar: doc.lugar,
    fecha_obra: doc.state.fecha || null,
    partidas: doc.partidas,
    total: doc.total,
    payload: payloadDe(doc.state, doc.id, doc.nombre),
    storage_path: `${doc.id}.ppto.json`,
    updated_at: doc.savedAt,
  };
  const { error } = await conTimeout(supabase.from("presupuesto_archivos").upsert(row, { onConflict: "id" }));
  if (error) throw new Error(error.message);
  const blob = new Blob([JSON.stringify(row.payload)], { type: "application/json" });
  await conTimeout(
    supabase.storage.from(BUCKET).upload(`${doc.id}.ppto.json`, blob, {
      upsert: true,
      contentType: "application/json",
    })
  ).catch(() => undefined);
}

export type ResultadoGuardar = {
  doc: PresupuestoDocumento;
  origen: "nube" | "local";
};

export async function guardarArchivo(
  state: PresupuestoState,
  opts: { nombre?: string; como?: boolean } = {}
): Promise<ResultadoGuardar> {
  const nombre = (opts.nombre ?? nombreArchivoSugerido(state)).trim();
  if (!nombre) throw new Error("Indique el nombre del archivo.");
  const id = opts.como || !state.archivoId ? nuevoId() : state.archivoId;
  const savedAt = new Date().toISOString();
  const nextState = payloadDe(state, id, nombre);
  const base = metaDe(nextState, id, nombre, savedAt, "nube");
  const doc: PresupuestoDocumento = { ...base, state: nextState };

  if (supabaseConfigured && supabase) {
    try {
      await guardarNube(doc);
      guardarLocal({ ...doc, origen: "nube" });
      return { doc: { ...doc, origen: "nube" }, origen: "nube" };
    } catch {
      /* local siempre */
    }
  }

  const localDoc: PresupuestoDocumento = { ...doc, origen: "local" };
  guardarLocal(localDoc);
  return { doc: localDoc, origen: "local" };
}

export function mensajeGuardado(r: ResultadoGuardar) {
  return r.origen === "nube" ? "Guardado en Supabase." : "Guardado en este equipo (disponible sin nube).";
}
