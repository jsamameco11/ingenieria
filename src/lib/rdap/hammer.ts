import { G } from "../num";
import { HAMMER_DEFAULT } from "./criteria";
import { materialDe, sizeDe } from "./materials";
import { longitudPipe, propsPipe } from "./model";
import type { RdapProject, RunResult } from "./types";

const K_WATER = 2.19e9;
const RHO = 998;
const E_PA: Record<string, number> = {
  pvc: 3.0e9,
  hdpe: 8.0e8,
  hd: 1.7e11,
  acero: 2.1e11,
  hf: 1.0e11,
  prfv: 2.0e10,
};

/** Celeridad de onda (Korteweg): a = a0 / √(1 + (K/E)(D/e)). */
export function celeridadMs(materialId: string, dM: number, eM: number) {
  const E = E_PA[materialId] ?? E_PA.pvc;
  const a0 = Math.sqrt(K_WATER / RHO);
  const ratio = Math.max(dM / Math.max(eM, 1e-4), 1);
  return a0 / Math.sqrt(1 + (K_WATER / E) * ratio);
}

/**
 * Golpe de ariete de diseño (cierre / parada).
 * T ≤ 2L/a → Joukowsky  ΔH = a V / g
 * T > 2L/a → Michaud    ΔH = 2 L V / (g T)
 */
export function resolverAriete(
  p: RdapProject,
  pipeRows: { id: string; velocity: number }[],
  nodeP: Map<string, number>,
): RunResult["hammer"] {
  const T = Math.max((p.hammer ?? HAMMER_DEFAULT).tCloseS, 0.05);
  const pipes = p.pipes.map((t) => {
    const aN = p.nodes.find((n) => n.id === t.start);
    const bN = p.nodes.find((n) => n.id === t.end);
    const { L } = longitudPipe(t, aN, bN);
    const pr = propsPipe(t);
    const size = sizeDe(t.materialId, t.dnMm);
    const eM = (size?.thkMm ?? 3) / 1000;
    const aMs = celeridadMs(t.materialId, pr.dM, eM);
    const tCritS = (2 * Math.max(L, 1)) / Math.max(aMs, 1);
    const v = Math.abs(pipeRows.find((x) => x.id === t.id)?.velocity ?? 0);
    const jouk = (aMs * v) / G;
    const mich = (2 * Math.max(L, 1) * v) / (G * T);
    const rapid = T <= tCritS + 1e-9;
    const dHM = rapid ? jouk : mich;
    const pStat = Math.max(nodeP.get(t.start) ?? 0, nodeP.get(t.end) ?? 0, 0);
    const pTrans = pStat + dHM;
    const mat = materialDe(t.materialId);
    const pnMca = mat.pnBar * 10.197;
    const ok = pTrans <= pnMca + 1e-6;
    const method = rapid ? "joukowsky" as const : "michaud" as const;
    const note = ok
      ? `${method === "joukowsky" ? "Cierre rápido" : "Cierre lento"} · Ptrans ${pTrans.toFixed(1)} ≤ PN ${pnMca.toFixed(0)} m.c.a.`
      : `Ptrans ${pTrans.toFixed(1)} m.c.a. > PN ${mat.pnBar} bar (${pnMca.toFixed(0)} m). Alargar T, PN mayor o ventosa/anticolpe.`;
    return { id: t.id, aMs, tCritS, dHM, method, pStatMca: pStat, pTransMca: pTrans, pnMca, ok, note };
  });
  const worst = pipes.reduce((a, b) => (b.dHM > a.dHM ? b : a), pipes[0] ?? {
    id: "", aMs: 0, tCritS: 0, dHM: 0, method: "joukowsky" as const, pStatMca: 0, pTransMca: 0, pnMca: 0, ok: true, note: "",
  });
  return { pipes, worstId: worst.id, maxDH: worst.dHM };
}
