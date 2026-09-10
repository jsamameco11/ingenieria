import { loadPresupuesto, savePresupuesto } from "../presupuesto/engine";
import { hydrateValorizaciones } from "./state";
import type { ValorizacionesState } from "./types";

export function loadValorizaciones(): ValorizacionesState {
  const pre = loadPresupuesto();
  return hydrateValorizaciones(pre.valorizaciones);
}

export function saveValorizaciones(s: ValorizacionesState) {
  const pre = loadPresupuesto();
  savePresupuesto({ ...pre, valorizaciones: s });
}
