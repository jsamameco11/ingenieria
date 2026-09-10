import type { RdapProject, ValidationIssue } from "./types";

export function validarRed(p: RdapProject): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const ids = new Set<string>();
  const nodes = new Map(p.nodes.map((n) => [n.id, n]));

  for (const n of p.nodes) {
    if (!n.id.trim()) out.push({ code: "E010", level: "ERROR", message: "Hay un nodo sin ID." });
    if (ids.has(n.id)) out.push({ code: "E011", level: "ERROR", message: `ID duplicado: ${n.id}.` });
    ids.add(n.id);
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
      out.push({ code: "E012", level: "ERROR", message: `Nodo ${n.id}: coordenadas inválidas.` });
    }
    if (!Number.isFinite(n.ground)) {
      out.push({ code: "E013", level: "ERROR", message: `Nodo ${n.id}: cota de terreno inválida.` });
    }
    if ((n.kind === "junction" || n.kind === "hydrant") && n.demandLs < 0) {
      out.push({ code: "W010", level: "WARNING", message: `Nodo ${n.id}: demanda negativa (${n.demandLs} L/s).` });
    }
    if (n.kind === "reservoir" && (n.reservoirHgl == null || !Number.isFinite(n.reservoirHgl))) {
      out.push({ code: "E014", level: "ERROR", message: `Reservorio ${n.id}: falta HGL de entrada.` });
    }
    if (n.cover != null && n.invert != null && n.cover < n.invert) {
      out.push({ code: "E015", level: "ERROR", message: `Nodo ${n.id}: cota de tapa menor que cota de fondo.` });
    }
  }

  const fuentes = p.nodes.filter((n) => n.kind === "reservoir" || n.kind === "tank");
  if (!fuentes.length) {
    out.push({ code: "E020", level: "ERROR", message: "La red no tiene reservorio ni tanque. No hay fuente de carga." });
  }

  for (const t of p.pipes) {
    if (ids.has(t.id)) out.push({ code: "E011", level: "ERROR", message: `ID duplicado: ${t.id}.` });
    ids.add(t.id);
    if (!nodes.has(t.start) || !nodes.has(t.end)) {
      out.push({ code: "E021", level: "ERROR", message: `Tubería ${t.id}: nodo de arranque o llegada inexistente.` });
    }
    if (t.start === t.end) out.push({ code: "E022", level: "ERROR", message: `Tubería ${t.id}: arranque = llegada.` });
    if (t.dnMm <= 0) out.push({ code: "E023", level: "ERROR", message: `Tubería ${t.id}: diámetro nulo.` });
    if (t.status === "closed") {
      out.push({ code: "W021", level: "WARNING", message: `Tubería ${t.id} está cerrada.` });
    }
  }

  for (const b of [...p.pumps, ...p.valves]) {
    if (!nodes.has(b.start) || !nodes.has(b.end)) {
      out.push({ code: "E024", level: "ERROR", message: `Equipo ${b.id}: nodos no existen.` });
    }
  }
  for (const b of p.pumps) {
    if (b.status === "on" && b.curve.length < 2) {
      out.push({ code: "E025", level: "ERROR", message: `Bomba ${b.id}: la curva necesita al menos 2 puntos (Q, H).` });
    }
  }

  const adj = new Map<string, string[]>();
  for (const n of p.nodes) adj.set(n.id, []);
  const links = [
    ...p.pipes.filter((t) => t.status === "open").map((t) => [t.start, t.end] as const),
    ...p.pumps.filter((b) => b.status === "on").map((b) => [b.start, b.end] as const),
    ...p.valves.filter((v) => v.status !== "closed").map((v) => [v.start, v.end] as const),
  ];
  for (const [a, b] of links) {
    adj.get(a)?.push(b);
    adj.get(b)?.push(a);
  }
  const seen = new Set<string>();
  const stack = fuentes.map((f) => f.id);
  for (const s of stack) seen.add(s);
  while (stack.length) {
    const u = stack.pop()!;
    for (const v of adj.get(u) ?? []) {
      if (!seen.has(v)) {
        seen.add(v);
        stack.push(v);
      }
    }
  }
  for (const n of p.nodes) {
    if (!seen.has(n.id)) {
      out.push({
        code: "E030",
        level: "ERROR",
        message: `Nodo ${n.id} está desconectado de toda fuente (reservorio/tanque).`,
      });
    }
  }

  const prvDown = new Map<string, string[]>();
  for (const v of p.valves) {
    if (v.status === "closed") continue;
    if ((v.kind === "prv" || v.kind === "psv") && v.setting <= 0) {
      out.push({ code: "W030", level: "WARNING", message: `${v.id}: consigna de presión ≤ 0 m.c.a.` });
    }
    if (v.kind === "prv") {
      const list = prvDown.get(v.end) ?? [];
      list.push(v.id);
      prvDown.set(v.end, list);
    }
  }
  const dir = new Map<string, string[]>();
  for (const n of p.nodes) dir.set(n.id, []);
  for (const t of p.pipes.filter((x) => x.status === "open")) dir.get(t.start)?.push(t.end);
  for (const b of p.pumps.filter((x) => x.status === "on")) dir.get(b.start)?.push(b.end);
  for (const v of p.valves.filter((x) => x.status !== "closed")) dir.get(v.start)?.push(v.end);
  const canWalk = (from: string, to: string) => {
    if (from === to) return true;
    const vis = new Set<string>([from]);
    const st = [from];
    while (st.length) {
      const u = st.pop()!;
      for (const v of dir.get(u) ?? []) {
        if (v === to) return true;
        if (!vis.has(v)) {
          vis.add(v);
          st.push(v);
        }
      }
    }
    return false;
  };
  const prvs = p.valves.filter((v) => v.kind === "prv" && v.status !== "closed");
  for (const up of prvs) {
    for (const down of prvs) {
      if (up.id === down.id) continue;
      if (up.end !== down.start && !canWalk(up.end, down.start)) continue;
      if (up.setting + 0.15 < down.setting) {
        out.push({
          code: "W033",
          level: "WARNING",
          message: `PRV en serie ${up.id} → ${down.id}: consigna de aguas arriba (${up.setting}) menor que la de aguas abajo (${down.setting}).`,
        });
      }
    }
  }
  for (const [nodeId, ids] of prvDown) {
    if (ids.length > 1) {
      out.push({
        code: "W031",
        level: "WARNING",
        message: `Hay ${ids.length} PRV (${ids.join(", ")}) controlando el mismo nudo ${nodeId}. Deje una sola ACTIVA o el solver puede oscilar.`,
      });
    }
  }
  return out;
}
