import type { RdapNode, RdapValve, ValveCommand, ValveKind, ValveMode } from "./types";

export const VALVE_LABEL: Record<ValveKind, string> = {
  prv: "PRV · reductora de presión",
  psv: "PSV · sostenedora de presión",
  fcv: "FCV · control de caudal",
  tcv: "TCV · estranguladora",
  check: "Check · unidireccional",
  iso: "Aislamiento",
};

export function comandoValvula(v: RdapValve): ValveCommand {
  if (v.status === "closed") return "closed";
  if (v.status === "auto") return "auto";
  return "open";
}

export function esControlPresion(v: RdapValve) {
  return v.kind === "prv" || v.kind === "psv" || v.kind === "fcv";
}

export function hConsigPrv(v: RdapValve, down: RdapNode | undefined) {
  return (down?.ground ?? 0) + v.setting;
}

export function hConsigPsv(v: RdapValve, up: RdapNode | undefined) {
  return (up?.ground ?? 0) + v.setting;
}

/** Arranque: PRV/PSV/FCV en automático parten ACTIVAS (como EPANET). */
export function modoInicial(v: RdapValve): ValveMode {
  const cmd = comandoValvula(v);
  if (cmd === "closed") return "CLOSED";
  if (cmd === "open") return "OPEN";
  if (esControlPresion(v)) return "ACTIVE";
  return "OPEN";
}

/**
 * Actualiza el estado de una válvula de control (Rossman / EPANET).
 * PRV: no deja que P aguas abajo supere la consigna.
 * PSV: no deja que P aguas arriba caiga bajo la consigna.
 * FCV: no deja que Q supere la consigna.
 */
export function actualizarModo(
  v: RdapValve,
  mode: ValveMode,
  H: Map<string, number>,
  q: number,
  up: RdapNode | undefined,
  down: RdapNode | undefined,
): ValveMode {
  const cmd = comandoValvula(v);
  if (cmd === "closed") return "CLOSED";
  if (cmd === "open") return "OPEN";

  const H1 = H.get(v.start) ?? 0;
  const H2 = H.get(v.end) ?? 0;
  const Htol = 0.04;
  const Qtol = 1e-8;

  if (v.kind === "check") return q < -Qtol ? "CLOSED" : "OPEN";
  if (v.kind === "iso" || v.kind === "tcv") return "OPEN";

  if (v.kind === "prv") {
    const Hset = hConsigPrv(v, down);
    if (q < -Qtol) return "CLOSED";
    if (H1 + Htol < Hset) return "OPEN";
    if (H2 > Hset + Htol) return "ACTIVE";
    if (mode === "OPEN" && H2 >= Hset - Htol) return "ACTIVE";
    if (mode === "ACTIVE" && H1 + Htol >= Hset) return "ACTIVE";
    return "OPEN";
  }

  if (v.kind === "psv") {
    const Hset = hConsigPsv(v, up);
    if (q < -Qtol) return "CLOSED";
    if (H1 < Hset - Htol) return "ACTIVE";
    if (H1 > Hset + Htol) return "OPEN";
    return mode === "CLOSED" ? "OPEN" : mode;
  }

  if (v.kind === "fcv") {
    const Qset = Math.max(v.setting, 0) / 1000;
    if (q < -Qtol) return "CLOSED";
    if (q > Qset + 1e-6) return "ACTIVE";
    return "OPEN";
  }

  return "OPEN";
}

/**
 * Si dos o más PRV quedan ACTIVE sobre el mismo nudo, se queda la de menor
 * consigna (la más restrictiva) y las demás pasan a OPEN. Evita yacobiano singular.
 */
export function resolverConflictosPrv(
  valves: RdapValve[],
  modes: Map<string, ValveMode>,
): { changed: boolean; notes: { code: string; level: "WARNING"; message: string }[] } {
  const notes: { code: string; level: "WARNING"; message: string }[] = [];
  let changed = false;
  const byDown = new Map<string, RdapValve[]>();
  for (const v of valves) {
    if (v.kind !== "prv" || v.status === "closed") continue;
    if ((modes.get(v.id) ?? "OPEN") !== "ACTIVE") continue;
    const list = byDown.get(v.end) ?? [];
    list.push(v);
    byDown.set(v.end, list);
  }
  for (const [nodeId, list] of byDown) {
    if (list.length < 2) continue;
    const ranked = [...list].sort((a, b) => a.setting - b.setting);
    const keep = ranked[0];
    for (const v of ranked.slice(1)) {
      if (modes.get(v.id) !== "OPEN") {
        modes.set(v.id, "OPEN");
        changed = true;
      }
    }
    notes.push({
      code: "W032",
      level: "WARNING",
      message: `Dos o más PRV ACTIVE en ${nodeId} (${list.map((v) => v.id).join(", ")}). Se deja ACTIVE ${keep.id} (consigna ${keep.setting} m.c.a.) y las demás OPEN.`,
    });
  }
  return { changed, notes };
}

/** PRV en serie: la consigna de aguas arriba debe dejar margen sobre la de aguas abajo. */
export function auditarPrvSerie(
  valves: RdapValve[],
  modes: Map<string, ValveMode>,
  reachable: (from: string, to: string) => boolean,
): { code: string; level: "WARNING"; message: string }[] {
  const notes: { code: string; level: "WARNING"; message: string }[] = [];
  const prvs = valves.filter((v) => v.kind === "prv" && v.status !== "closed");
  for (const up of prvs) {
    for (const down of prvs) {
      if (up.id === down.id) continue;
      const linked = up.end === down.start || reachable(up.end, down.start);
      if (!linked) continue;
      const mUp = modes.get(up.id) ?? "OPEN";
      const mDown = modes.get(down.id) ?? "OPEN";
      if (up.setting + 0.15 < down.setting) {
        notes.push({
          code: "W033",
          level: "WARNING",
          message: `PRV en serie ${up.id} → ${down.id}: la consigna de aguas arriba (${up.setting} m.c.a.) es menor que la de aguas abajo (${down.setting}). La de abajo no puede regular.`,
        });
      } else if (mUp === "ACTIVE" && mDown === "ACTIVE" && Math.abs(up.setting - down.setting) < 0.2) {
        notes.push({
          code: "W035",
          level: "WARNING",
          message: `PRV en serie ${up.id} y ${down.id} ACTIVE con consignas casi iguales (${up.setting} / ${down.setting}). Una de las dos suele quedar OPEN.`,
        });
      }
    }
  }
  return notes;
}

export function notaModo(v: RdapValve, mode: ValveMode, down?: RdapNode, up?: RdapNode) {
  if (mode === "CLOSED") {
    return v.kind === "check" || v.kind === "prv" || v.kind === "psv"
      ? "CERRADA · no admite flujo inverso."
      : "CERRADA.";
  }
  if (v.kind === "prv") {
    return mode === "ACTIVE"
      ? `ACTIVA · P aguas abajo fijada a ${v.setting} m.c.a. (HGL = ${hConsigPrv(v, down).toFixed(2)} m).`
      : "ABIERTA · la carga de aguas arriba no alcanza la consigna; no reduce.";
  }
  if (v.kind === "psv") {
    return mode === "ACTIVE"
      ? `ACTIVA · P aguas arriba sostenida a ${v.setting} m.c.a. (HGL = ${hConsigPsv(v, up).toFixed(2)} m).`
      : "ABIERTA · la presión de aguas arriba supera la consigna.";
  }
  if (v.kind === "fcv") {
    return mode === "ACTIVE"
      ? `ACTIVA · caudal limitado a ${v.setting} L/s.`
      : "ABIERTA · el caudal natural no llega a la consigna.";
  }
  if (v.kind === "tcv") return `ABIERTA · K = ${v.setting}.`;
  return "ABIERTA.";
}
