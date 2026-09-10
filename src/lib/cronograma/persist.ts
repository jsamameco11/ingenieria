import { loadPresupuesto, savePresupuesto } from "../presupuesto/engine";
import { cronogramaDesdePresupuesto, cronogramaVacioLigado } from "./desdePresupuesto";
import { hydrateCronograma } from "./state";
import type { CronogramaState } from "./types";

const LEGACY_KEY = "memorcalc-crono-v1";

export function loadCronograma(): CronogramaState {
  const pre = loadPresupuesto();
  const existente = pre.cronograma ? hydrateCronograma(pre.cronograma) : null;
  const tieneHojas = Boolean(existente?.tasks.some((t) => t.partidaCodigo));
  if (existente && (tieneHojas || existente.origen === "manual" || existente.tasks.length > 0)) {
    return { ...existente, proyecto: pre.obra || existente.proyecto, start: existente.start || pre.fecha };
  }

  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const old = hydrateCronograma(JSON.parse(raw));
      localStorage.removeItem(LEGACY_KEY);
      if (pre.lineas.length && !old.tasks.some((t) => t.partidaCodigo)) {
        const generated = cronogramaDesdePresupuesto(pre);
        savePresupuesto({ ...pre, cronograma: generated, obra: generated.proyecto });
        return generated;
      }
      savePresupuesto({ ...pre, cronograma: old });
      return old;
    }
  } catch {
    /* ignorar legado ilegible */
  }

  if (pre.lineas.length) {
    const generated = cronogramaDesdePresupuesto(pre);
    savePresupuesto({ ...pre, cronograma: generated });
    return generated;
  }
  return cronogramaVacioLigado(pre);
}

export function saveCronograma(s: CronogramaState) {
  const pre = loadPresupuesto();
  savePresupuesto({
    ...pre,
    obra: s.proyecto?.trim() ? s.proyecto : pre.obra,
    fecha: s.start || pre.fecha,
    cronograma: s,
  });
}

export function importarDesdePresupuesto(): CronogramaState {
  const pre = loadPresupuesto();
  const next = cronogramaDesdePresupuesto(pre);
  saveCronograma(next);
  return next;
}
