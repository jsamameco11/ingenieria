import { G } from "../num";
import type { AlertLevel, EpsStep, HeadlossMethod, NodeResult, PipeResult, RdapProject, RdapScenario, RunResult, ValidationIssue, ValveMode } from "./types";
import { METHOD_LABEL, interpCurve, pipeDhfDQ, pipeHeadloss } from "./headloss";
import { esNudoDemanda, hglFijo, longitudPipe, propsPipe } from "./model";
import { validarRed } from "./topology";
import { actualizarModo, auditarPrvSerie, esControlPresion, hConsigPrv, hConsigPsv, modoInicial, notaModo, resolverConflictosPrv } from "./valves";
import { resolverCalidad } from "./quality";
import { resolverAriete } from "./hammer";

function solveDense(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    let piv = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
    if (Math.abs(M[piv][k]) < 1e-14) return null;
    [M[k], M[piv]] = [M[piv], M[k]];
    const d = M[k][k];
    for (let j = k; j <= n; j++) M[k][j] /= d;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = M[i][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  return M.map((row) => row[n]);
}

type Link = {
  id: string;
  kind: "pipe" | "pump" | "valve";
  start: string;
  end: string;
  closed: boolean;
  q: number;
  F: (q: number) => number;
  G: (q: number) => number;
};

function linksDe(p: RdapProject): Link[] {
  const nodes = new Map(p.nodes.map((n) => [n.id, n]));
  const out: Link[] = [];
  for (const t of p.pipes) {
    const a = nodes.get(t.start);
    const b = nodes.get(t.end);
    const { L } = longitudPipe(t, a, b);
    const pr = propsPipe(t);
    const closed = t.status === "closed" || L <= 0 || pr.dM <= 0;
    const common = { method: p.method, L, dM: pr.dM, C: pr.C, epsM: pr.epsM, n: pr.n, kMinor: t.minorK, nu: p.viscosityM2s };
    out.push({
      id: t.id,
      kind: "pipe",
      start: t.start,
      end: t.end,
      closed,
      q: 0.001,
      F: (q) => {
        const h = pipeHeadloss({ ...common, qM3s: q });
        return h.hf + h.hm;
      },
      G: (q) => Math.max(pipeDhfDQ({ ...common, qM3s: q }), 1e-10),
    });
  }
  for (const b of p.pumps) {
    out.push({
      id: b.id,
      kind: "pump",
      start: b.start,
      end: b.end,
      closed: b.status === "off" || b.curve.length < 2,
      q: 0.005,
      F: (q) => -interpCurve(b.curve, q * 1000),
      G: (q) => {
        const h1 = interpCurve(b.curve, q * 1000);
        const h2 = interpCurve(b.curve, q * 1000 + 0.2);
        const d = (h2 - h1) / 0.0002;
        return Math.max(1e-4, -d);
      },
    });
  }
  for (const v of p.valves) {
    const dM = Math.max((v.dnMm || 100) / 1000, 0.02);
    const kOpen = v.kind === "tcv" ? Math.max(v.setting, 0.05) : v.kind === "iso" ? 0.2 : 0.15;
    out.push({
      id: v.id,
      kind: "valve",
      start: v.start,
      end: v.end,
      closed: v.status === "closed",
      q: 0.001,
      F: (q) => {
        if (v.kind === "check" && q < 0) return 1e8 * q;
        const vel = q / ((Math.PI * dM * dM) / 4);
        return (kOpen * vel * Math.abs(vel)) / (2 * G);
      },
      G: (q) => {
        const a2 = (Math.PI * dM * dM) / 4;
        return Math.max(1e-8, (kOpen * Math.abs(q)) / (G * a2 * a2));
      },
    });
  }
  return out;
}

function aplicarDemandas(p: RdapProject, scale: number, hour: number | null, fire: boolean) {
  const map = new Map<string, number>();
  for (const n of p.nodes) {
    if (!esNudoDemanda(n)) continue;
    const pat = p.patterns.find((x) => x.id === n.patternId) ?? p.patterns[0];
    const m = hour == null ? 1 : (pat?.multipliers[hour] ?? 1);
    let q = (n.demandLs / 1000) * scale * m;
    if (fire && p.fireNodeId === n.id && p.fireLs > 0) q += p.fireLs / 1000;
    map.set(n.id, q);
  }
  return map;
}

function qDesdeContinuidad(nodeId: string, valveId: string, links: Link[], demand: Map<string, number>) {
  let q = demand.get(nodeId) ?? 0;
  for (const lk of links) {
    if (lk.id === valveId) continue;
    if (lk.start === nodeId) q += lk.q;
    if (lk.end === nodeId) q -= lk.q;
  }
  return q;
}

export function resolverEstacionario(
  p: RdapProject,
  scale = 1,
  hour: number | null = null,
  fire = false,
  scenario: RdapScenario = "custom",
): RunResult {
  const issues = validarRed(p);
  const errors = issues.filter((i) => i.level === "ERROR");
  const demand = aplicarDemandas(p, scale, hour, fire);
  const Hfix0 = new Map<string, number>();
  for (const n of p.nodes) {
    const h = hglFijo(n);
    if (h != null) Hfix0.set(n.id, h);
  }
  const H = new Map<string, number>();
  for (const n of p.nodes) H.set(n.id, Hfix0.get(n.id) ?? n.ground + 20);
  const links = linksDe(p);
  const modes = new Map<string, ValveMode>(p.valves.map((v) => [v.id, modoInicial(v)]));
  const causes: string[] = [];
  const prvAudit: ValidationIssue[] = [];
  const flips = new Map<string, number>();

  if (errors.length) {
    return pack(p, links, H, demand, {
      ok: false,
      iterations: 0,
      maxContErrLs: Infinity,
      maxHeadErrM: Infinity,
      toleranceHead: p.solver.tolHeadM,
      toleranceFlow: p.solver.tolFlowM3s,
      message: "NO CONVERGENTE — la red no pasó la validación previa.",
      causes: errors.map((e) => `${e.code}: ${e.message}`),
    }, issues, { scale, hour, fire, scenario }, modes, prvAudit);
  }

  let lastCont = Infinity;
  let lastHead = Infinity;
  let iter = 0;
  let ok = false;
  let statusPasses = 0;

  for (let outer = 1; outer <= 10; outer++) {
    const Hfix = new Map(Hfix0);
    for (const v of p.valves) {
      const mode = modes.get(v.id) ?? "OPEN";
      const up = p.nodes.find((n) => n.id === v.start);
      const down = p.nodes.find((n) => n.id === v.end);
      if (mode === "ACTIVE" && v.kind === "prv" && down && !Hfix0.has(down.id)) {
        Hfix.set(down.id, hConsigPrv(v, down));
        H.set(down.id, hConsigPrv(v, down));
      }
      if (mode === "ACTIVE" && v.kind === "psv" && up && !Hfix0.has(up.id)) {
        Hfix.set(up.id, hConsigPsv(v, up));
        H.set(up.id, hConsigPsv(v, up));
      }
    }
    const unknowns = p.nodes.filter((n) => esNudoDemanda(n) && !Hfix.has(n.id));
    const idx = new Map(unknowns.map((n, i) => [n.id, i]));

    ok = false;
    for (iter = 1; iter <= p.solver.maxIter; iter++) {
      for (const lk of links) {
        const v = lk.kind === "valve" ? p.valves.find((x) => x.id === lk.id) : undefined;
        const mode = v ? modes.get(v.id) ?? "OPEN" : "OPEN";
        if (lk.closed || mode === "CLOSED") {
          lk.q = 0;
          continue;
        }
        if (v && mode === "ACTIVE" && (v.kind === "prv" || v.kind === "psv")) continue;
        if (v && mode === "ACTIVE" && v.kind === "fcv") {
          lk.q = Math.max(v.setting, 0) / 1000;
          continue;
        }
        const hi = H.get(lk.start) ?? 0;
        const hj = H.get(lk.end) ?? 0;
        const dH = hi - hj;
        let q = lk.q;
        for (let s = 0; s < 12; s++) {
          const F = lk.F(q);
          const Gq = Math.max(lk.G(q), 1e-8);
          const step = (F - dH) / Gq;
          q -= Math.max(-0.05, Math.min(0.05, step));
        }
        if (!Number.isFinite(q)) q = 0;
        lk.q = q;
        if (v?.kind === "check" && lk.q < 0) lk.q = 0;
      }
      for (const lk of links) {
        const v = lk.kind === "valve" ? p.valves.find((x) => x.id === lk.id) : undefined;
        const mode = v ? modes.get(v.id) ?? "OPEN" : "OPEN";
        if (!v || mode !== "ACTIVE" || (v.kind !== "prv" && v.kind !== "psv")) continue;
        const nodeId = v.kind === "prv" ? v.end : v.start;
        lk.q = Math.max(0, qDesdeContinuidad(nodeId, v.id, links, demand));
      }

      const nj = unknowns.length;
      const J = Array.from({ length: nj }, () => Array(nj).fill(0));
      const r = Array(nj).fill(0);
      for (let i = 0; i < nj; i++) r[i] = -(demand.get(unknowns[i].id) ?? 0);

      for (const lk of links) {
        const v = lk.kind === "valve" ? p.valves.find((x) => x.id === lk.id) : undefined;
        const mode = v ? modes.get(v.id) ?? "OPEN" : "OPEN";
        if (lk.closed || mode === "CLOSED") continue;
        const activeCtrl = v && mode === "ACTIVE" && esControlPresion(v);
        const inv = activeCtrl ? 0 : 1 / Math.max(lk.G(lk.q), 1e-8);
        const si = idx.get(lk.start);
        const ei = idx.get(lk.end);
        if (si != null) r[si] -= lk.q;
        if (ei != null) r[ei] += lk.q;
        if (activeCtrl) continue;
        if (si != null) {
          J[si][si] += inv;
          if (ei != null) J[si][ei] -= inv;
        }
        if (ei != null) {
          J[ei][ei] += inv;
          if (si != null) J[ei][si] -= inv;
        }
      }

      const dH = nj ? solveDense(J, r) : [];
      if (nj && !dH) {
        causes.push("El sistema yacobiano es singular: revise PRV en serie, tuberías cerradas o fuentes.");
        break;
      }
      lastHead = 0;
      const damp = lastCont > 0.01 ? 0.45 : 0.85;
      for (let i = 0; i < nj; i++) {
        const step = Math.max(-15, Math.min(15, (dH?.[i] ?? 0) * damp));
        H.set(unknowns[i].id, (H.get(unknowns[i].id) ?? 0) + step);
        lastHead = Math.max(lastHead, Math.abs(step));
      }
      for (const [id, h] of Hfix) H.set(id, h);
      lastCont = 0;
      for (let i = 0; i < nj; i++) lastCont = Math.max(lastCont, Math.abs(r[i]));
      if (lastHead < p.solver.tolHeadM && lastCont < p.solver.tolFlowM3s) {
        ok = true;
        break;
      }
    }

    let changed = false;
    for (const v of p.valves) {
      const lk = links.find((x) => x.id === v.id);
      const current = modes.get(v.id) ?? "OPEN";
      const next = actualizarModo(
        v,
        current,
        H,
        lk?.q ?? 0,
        p.nodes.find((n) => n.id === v.start),
        p.nodes.find((n) => n.id === v.end),
      );
      if (next === current) continue;
      const nFlip = (flips.get(v.id) ?? 0) + 1;
      flips.set(v.id, nFlip);
      if (nFlip > 6) {
        if (!prvAudit.some((a) => a.code === "W034" && a.message.includes(v.id))) {
          prvAudit.push({
            code: "W034",
            level: "WARNING",
            message: `${v.id} oscila entre ${current} y ${next}. Se congela en ${current} (PRV en serie conflictiva).`,
          });
        }
        continue;
      }
      modes.set(v.id, next);
      changed = true;
    }
    const conflict = resolverConflictosPrv(p.valves, modes);
    if (conflict.changed) changed = true;
    for (const n of conflict.notes) {
      if (!prvAudit.some((a) => a.message === n.message)) prvAudit.push(n);
    }
    statusPasses = outer;
    if (!changed) break;
  }

  const reach = reachableDe(p, links);
  for (const n of auditarPrvSerie(p.valves, modes, reach)) {
    if (!prvAudit.some((a) => a.message === n.message)) prvAudit.push(n);
  }

  if (!ok && !causes.length) {
    causes.push("Datos incompletos o red mal condicionada.");
    causes.push("Tubería cerrada que aísla un sector.");
    causes.push("Demanda excesiva respecto a la fuente o al diámetro.");
    causes.push("PRV/PSV/FCV mal orientada o consigna inalcanzable.");
    causes.push("Curva de bomba plana o fuera de rango.");
  }

  const valveNote = p.valves.length
    ? ` · válvulas ${statusPasses} pasada${statusPasses === 1 ? "" : "s"} de estado`
    : "";

  return pack(
    p,
    links,
    H,
    demand,
    {
      ok,
      iterations: iter,
      maxContErrLs: lastCont * 1000,
      maxHeadErrM: lastHead,
      toleranceHead: p.solver.tolHeadM,
      toleranceFlow: p.solver.tolFlowM3s,
      message: ok
        ? `CONVERGENTE · ${iter} iteraciones · εH = ${p.solver.tolHeadM} m · εQ = ${p.solver.tolFlowM3s} m³/s${valveNote}`
        : "NO CONVERGENTE",
      causes,
    },
    issues,
    { scale, hour, fire, scenario },
    modes,
    prvAudit,
  );
}

function reachableDe(p: RdapProject, links: Link[]) {
  const adj = new Map<string, string[]>();
  for (const n of p.nodes) adj.set(n.id, []);
  const add = (a: string, b: string) => {
    adj.get(a)?.push(b);
  };
  for (const t of p.pipes) {
    if (t.status !== "closed") add(t.start, t.end);
  }
  for (const b of p.pumps) {
    if (b.status === "on") add(b.start, b.end);
  }
  for (const v of p.valves) {
    if (v.status !== "closed") add(v.start, v.end);
  }
  for (const lk of links) {
    if (lk.q > 1e-10) add(lk.start, lk.end);
    if (lk.q < -1e-10) add(lk.end, lk.start);
  }
  return (from: string, to: string) => {
    if (from === to) return true;
    const seen = new Set<string>([from]);
    const stack = [from];
    while (stack.length) {
      const u = stack.pop()!;
      for (const v of adj.get(u) ?? []) {
        if (v === to) return true;
        if (!seen.has(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }
    return false;
  };
}

function pack(
  p: RdapProject,
  links: Link[],
  H: Map<string, number>,
  demand: Map<string, number>,
  conv: RunResult["convergence"],
  issues: ValidationIssue[],
  ctx: { scale: number; hour: number | null; fire: boolean; scenario: RdapScenario },
  modes: Map<string, ValveMode> = new Map(),
  prvAudit: ValidationIssue[] = [],
): RunResult {
  const nodes: NodeResult[] = p.nodes.map((n) => {
    const hgl = H.get(n.id) ?? hglFijo(n) ?? n.ground;
    const pressureMca = hgl - n.ground;
    let status: AlertLevel = "OK";
    let note = "Dentro de criterio.";
    if (n.kind === "hydrant") {
      note = "Hidrante · se verifica como nudo de servicio (puede llevar Q incendio).";
    }
    if (n.kind === "reservoir" || n.kind === "tank") {
      note = n.kind === "reservoir"
        ? "Fuente · HGL fijo · la presión de servicio no aplica."
        : "Tanque · HGL = fondo + nivel · la presión de servicio no aplica.";
    } else if (pressureMca < p.criteria.pMinMca) {
      status = pressureMca < p.criteria.pMinMca * 0.5 ? "CRITICAL" : "WARNING";
      note = `Presión ${pressureMca.toFixed(2)} m.c.a. < mínimo ${p.criteria.pMinMca}.`;
    } else if (pressureMca > p.criteria.pMaxMca) {
      status = "WARNING";
      note = `Presión ${pressureMca.toFixed(2)} m.c.a. > máximo ${p.criteria.pMaxMca}.`;
    }
    return {
      id: n.id,
      demandLs: (demand.get(n.id) ?? 0) * 1000,
      hgl,
      pressureMca,
      status,
      note,
    };
  });

  const pipes: PipeResult[] = p.pipes.map((t) => {
    const lk = links.find((x) => x.id === t.id);
    const q = lk?.q ?? 0;
    const a = p.nodes.find((n) => n.id === t.start);
    const b = p.nodes.find((n) => n.id === t.end);
    const { L } = longitudPipe(t, a, b);
    const pr = propsPipe(t);
    const h = pipeHeadloss({
      method: p.method,
      qM3s: q,
      L,
      dM: pr.dM,
      C: pr.C,
      epsM: pr.epsM,
      n: pr.n,
      kMinor: t.minorK,
      nu: p.viscosityM2s,
    });
    const hf = Math.abs(h.hf + h.hm);
    const hfMkm = L > 0 ? (hf / L) * 1000 : 0;
    const v = Math.abs(h.v);
    let status: AlertLevel = t.status === "closed" ? "WARNING" : "OK";
    let note = t.status === "closed" ? "Cerrada." : "Dentro de criterio.";
    if (t.status === "open") {
      if (v > p.criteria.vMaxMs) {
        status = "CRITICAL";
        note = `Velocidad ${v.toFixed(2)} m/s > máximo ${p.criteria.vMaxMs}.`;
      } else if (v < p.criteria.vMinMs && Math.abs(q) > 1e-6) {
        status = "WARNING";
        note = `Velocidad ${v.toFixed(2)} m/s < mínimo ${p.criteria.vMinMs}.`;
      } else if (hfMkm > p.criteria.hfMaxMkm) {
        status = "WARNING";
        note = `Gradiente ${hfMkm.toFixed(2)} m/km > límite ${p.criteria.hfMaxMkm}.`;
      }
      if (t.dnMm < p.criteria.dnMinMm) {
        status = status === "OK" ? "WARNING" : status;
        note += ` DN ${t.dnMm} < mínimo ${p.criteria.dnMinMm} mm.`;
      }
    }
    return {
      id: t.id,
      qLs: q * 1000,
      velocity: v,
      hf,
      hfMkm,
      direction: Math.abs(q) < 1e-10 ? "null" : q > 0 ? "start-end" : "end-start",
      status,
      note,
    };
  });

  const pumps = p.pumps.map((b) => {
    const lk = links.find((x) => x.id === b.id);
    const qLs = (lk?.q ?? 0) * 1000;
    return { id: b.id, qLs, headM: interpCurve(b.curve, qLs) };
  });

  const valves = p.valves.map((v) => {
    const lk = links.find((x) => x.id === v.id);
    const mode = modes.get(v.id) ?? modoInicial(v);
    const up = p.nodes.find((n) => n.id === v.start);
    const down = p.nodes.find((n) => n.id === v.end);
    return {
      id: v.id,
      qLs: (lk?.q ?? 0) * 1000,
      headlossM: (H.get(v.start) ?? 0) - (H.get(v.end) ?? 0),
      mode,
      setting: v.setting,
      note: notaModo(v, mode, down, up),
    };
  });

  const quality = resolverCalidad(p, links);
  const nodeP = new Map(nodes.map((n) => [n.id, n.pressureMca]));
  const hammer = resolverAriete(p, pipes, nodeP);

  const alerts: ValidationIssue[] = [
    ...issues,
    ...prvAudit,
    ...nodes.filter((n) => n.status !== "OK").map((n) => ({
      code: n.status === "CRITICAL" ? "C001" : "W001",
      level: n.status === "CRITICAL" ? "ERROR" as const : "WARNING" as const,
      message: `${n.id}: ${n.note}`,
    })),
    ...pipes.filter((t) => t.status !== "OK").map((t) => ({
      code: t.status === "CRITICAL" ? "C002" : "W002",
      level: t.status === "CRITICAL" ? "ERROR" as const : "WARNING" as const,
      message: `${t.id}: ${t.note}`,
    })),
    ...quality.nodes.filter((n) => n.status !== "OK").map((n) => ({
      code: n.status === "CRITICAL" ? "C003" : "W040",
      level: n.status === "CRITICAL" ? "ERROR" as const : "WARNING" as const,
      message: `${n.id} calidad: ${n.note}`,
    })),
    ...hammer.pipes.filter((t) => !t.ok).map((t) => ({
      code: "C004",
      level: "ERROR" as const,
      message: `${t.id} ariete: ${t.note}`,
    })),
  ];

  const serviceQ = quality.nodes.filter((n) => {
    const nd = p.nodes.find((x) => x.id === n.id);
    return nd ? esNudoDemanda(nd) : false;
  });
  const press = nodes.filter((n) => {
    const nd = p.nodes.find((x) => x.id === n.id);
    return nd ? esNudoDemanda(nd) : false;
  }).map((n) => n.pressureMca);
  const demandLs = [...demand.values()].reduce((s, q) => s + q, 0) * 1000;
  let sourceLs = 0;
  for (const n of p.nodes) {
    if (esNudoDemanda(n)) continue;
    for (const lk of links) {
      if (lk.start === n.id) sourceLs += lk.q * 1000;
      if (lk.end === n.id) sourceLs -= lk.q * 1000;
    }
  }
  return {
    method: p.method,
    methodLabel: METHOD_LABEL[p.method as HeadlossMethod],
    g: G,
    viscosityM2s: p.viscosityM2s,
    convergence: conv,
    nodes,
    pipes,
    pumps,
    valves,
    alerts,
    dashboard: {
      nNodes: p.nodes.length,
      nPipes: p.pipes.length,
      nRes: p.nodes.filter((n) => n.kind === "reservoir").length,
      nTanks: p.nodes.filter((n) => n.kind === "tank").length,
      nPumps: p.pumps.length,
      nValves: p.valves.length,
      critical: alerts.filter((a) => a.level === "ERROR").length,
      warnings: alerts.filter((a) => a.level === "WARNING").length,
      pMin: press.length ? Math.min(...press) : 0,
      pMax: press.length ? Math.max(...press) : 0,
      vMax: pipes.length ? Math.max(...pipes.map((t) => t.velocity)) : 0,
      hfMax: pipes.length ? Math.max(...pipes.map((t) => t.hfMkm)) : 0,
      demandLs,
      sourceLs,
      balanceLs: sourceLs - demandLs,
      ageMaxH: serviceQ.length ? Math.max(...serviceQ.map((n) => n.ageH)) : 0,
      clMin: serviceQ.length ? Math.min(...serviceQ.map((n) => n.clMgL)) : 0,
      hammerMaxM: hammer.maxDH,
    },
    quality,
    hammer,
    prvAudit,
    scale: ctx.scale,
    hour: ctx.hour,
    scenario: ctx.scenario,
    fire: ctx.fire,
  };
}

export function resolverEps(p: RdapProject, hours = 24): EpsStep[] {
  const steps: EpsStep[] = [];
  const tanks = p.nodes.filter((n) => n.kind === "tank");
  const clone: RdapProject = { ...p, nodes: p.nodes.map((n) => ({ ...n })) };
  for (let h = 0; h < hours; h++) {
    const result = resolverEstacionario(clone, 1, h, false, "custom");
    const pat = clone.patterns[0]?.multipliers ?? [];
    const m = pat[h % Math.max(pat.length, 1)] ?? 1;
    for (const tk of tanks) {
      const node = clone.nodes.find((n) => n.id === tk.id);
      if (!node) continue;
      let qIn = 0;
      for (const t of result.pipes) {
        const pipe = clone.pipes.find((x) => x.id === t.id);
        if (!pipe) continue;
        if (pipe.end === tk.id) qIn += t.qLs / 1000;
        if (pipe.start === tk.id) qIn -= t.qLs / 1000;
      }
      for (const b of result.pumps) {
        const pump = clone.pumps.find((x) => x.id === b.id);
        if (!pump) continue;
        if (pump.end === tk.id) qIn += b.qLs / 1000;
        if (pump.start === tk.id) qIn -= b.qLs / 1000;
      }
      for (const v of result.valves) {
        const valve = clone.valves.find((x) => x.id === v.id);
        if (!valve) continue;
        if (valve.end === tk.id) qIn += v.qLs / 1000;
        if (valve.start === tk.id) qIn -= v.qLs / 1000;
      }
      const d = Math.max(node.tankDiameter ?? 1, 0.5);
      const area = (Math.PI * d * d) / 4;
      const dZ = (qIn * 3600) / area;
      const next = Math.min(node.tankMax ?? 99, Math.max(node.tankMin ?? 0, (node.tankLevel ?? 0) + dZ));
      node.tankLevel = next;
    }
    steps.push({ hour: h, multiplier: m, result });
  }
  return steps;
}

/** Caso de una tubería para auditoría del motor (Hazen–Williams SI). */
export function casoTuberiaSimple() {
  const L = 200;
  const C = 150;
  const dM = 0.1032;
  const q = 0.004;
  const r = (10.67 * L) / (C ** 1.852 * dM ** 4.87);
  const hf = r * q ** 1.852;
  return { L, C, dM, q, hf, v: q / ((Math.PI * dM * dM) / 4) };
}
