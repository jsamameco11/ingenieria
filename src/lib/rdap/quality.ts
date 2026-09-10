import { QUALITY_DEFAULT } from "./criteria";
import type { AlertLevel, RdapProject, RunResult } from "./types";
import { longitudPipe, propsPipe } from "./model";

type FlowLink = { id: string; start: string; end: string; q: number; travelS: number };

function travelPipe(p: RdapProject, id: string, qAbs: number) {
  const t = p.pipes.find((x) => x.id === id);
  if (!t) return 1;
  const a = p.nodes.find((n) => n.id === t.start);
  const b = p.nodes.find((n) => n.id === t.end);
  const { L } = longitudPipe(t, a, b);
  const pr = propsPipe(t);
  const area = (Math.PI * pr.dM * pr.dM) / 4;
  const v = qAbs / Math.max(area, 1e-8);
  return L / Math.max(v, 1e-4);
}

function travelValve(p: RdapProject, id: string, qAbs: number) {
  const v = p.valves.find((x) => x.id === id);
  const dM = Math.max((v?.dnMm ?? 100) / 1000, 0.02);
  const area = (Math.PI * dM * dM) / 4;
  const vel = qAbs / Math.max(area, 1e-8);
  return 1.2 / Math.max(vel, 1e-4);
}

/**
 * Edad hidráulica y cloro residual (mezcla ponderada + decaimiento de 1.er orden).
 * C = C0 · e^(−kb t)  ·  kb en 1/s. Fuentes (reservorio/tanque) inyectan C0 y edad 0.
 */
export function resolverCalidad(
  p: RdapProject,
  links: { id: string; start: string; end: string; q: number }[],
): RunResult["quality"] {
  const qopt = p.quality ?? QUALITY_DEFAULT;
  const kb = Math.max(qopt.kbPerDay, 0) / 86400;
  const C0 = Math.max(qopt.sourceClMgL, 0);
  const flows: FlowLink[] = links.map((lk) => {
    const qAbs = Math.abs(lk.q);
    const isPipe = p.pipes.some((t) => t.id === lk.id);
    return {
      ...lk,
      travelS: isPipe ? travelPipe(p, lk.id, qAbs) : travelValve(p, lk.id, qAbs),
    };
  });

  const age = new Map<string, number>();
  const cl = new Map<string, number>();
  for (const n of p.nodes) {
    if (n.kind === "reservoir" || n.kind === "tank") {
      age.set(n.id, 0);
      cl.set(n.id, C0);
    } else {
      age.set(n.id, 0);
      cl.set(n.id, C0);
    }
  }

  for (let it = 0; it < 40; it++) {
    let maxD = 0;
    for (const n of p.nodes) {
      if (n.kind === "reservoir" || n.kind === "tank") continue;
      let qin = 0;
      let ageSum = 0;
      let clSum = 0;
      for (const lk of flows) {
        if (Math.abs(lk.q) < 1e-10) continue;
        const into = lk.q > 0 ? lk.end : lk.start;
        const from = lk.q > 0 ? lk.start : lk.end;
        if (into !== n.id) continue;
        const q = Math.abs(lk.q);
        const t = lk.travelS;
        qin += q;
        ageSum += q * ((age.get(from) ?? 0) + t / 3600);
        clSum += q * (cl.get(from) ?? 0) * Math.exp(-kb * t);
      }
      if (qin < 1e-10) {
        age.set(n.id, qopt.ageMaxH);
        cl.set(n.id, 0);
        continue;
      }
      const nextAge = ageSum / qin;
      const nextCl = clSum / qin;
      maxD = Math.max(maxD, Math.abs(nextAge - (age.get(n.id) ?? 0)), Math.abs(nextCl - (cl.get(n.id) ?? 0)));
      age.set(n.id, nextAge);
      cl.set(n.id, nextCl);
    }
    if (maxD < 1e-5) break;
  }

  const nodes = p.nodes.map((n) => {
    const ageH = age.get(n.id) ?? 0;
    const clMgL = cl.get(n.id) ?? 0;
    let status: AlertLevel = "OK";
    let note = "Residual y edad dentro de criterio.";
    if (n.kind === "reservoir" || n.kind === "tank") {
      note = `Fuente · C0 = ${C0} mg/L · edad 0 h.`;
    } else if (clMgL + 1e-9 < qopt.clMinMgL) {
      status = clMgL < qopt.clMinMgL * 0.4 ? "CRITICAL" : "WARNING";
      note = `Cloro ${clMgL.toFixed(2)} mg/L < mínimo ${qopt.clMinMgL} mg/L (OS.100).`;
    } else if (clMgL > qopt.clMaxMgL) {
      status = "WARNING";
      note = `Cloro ${clMgL.toFixed(2)} mg/L > máximo ${qopt.clMaxMgL} mg/L.`;
    } else if (ageH > qopt.ageMaxH) {
      status = "WARNING";
      note = `Edad ${ageH.toFixed(1)} h > ${qopt.ageMaxH} h.`;
    }
    return { id: n.id, ageH, clMgL, status, note };
  });

  const pipes = p.pipes.map((t) => {
    const lk = flows.find((x) => x.id === t.id);
    const from = (lk?.q ?? 0) >= 0 ? t.start : t.end;
    const tS = lk?.travelS ?? 0;
    return {
      id: t.id,
      travelMin: tS / 60,
      clOut: (cl.get(from) ?? 0) * Math.exp(-kb * tS),
    };
  });

  return { nodes, pipes };
}
