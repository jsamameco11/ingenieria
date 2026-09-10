import { CRITERIOS, HAMMER_DEFAULT, NU_20C, QUALITY_DEFAULT, SOLVER_DEFAULT } from "./criteria";
import { idEfectivoMm, materialDe } from "./materials";
import type { RdapNode, RdapPipe, RdapProject, RdapScenario, RunResult } from "./types";

export const SCENARIO_LABEL: Record<RdapScenario, string> = {
  qp: "Caudal promedio (Qp)",
  qmd: "Caudal máximo diario (Qmd)",
  qmh: "Caudal máximo horario (Qmh)",
  incendio: "Incendio + Qmh",
  custom: "Factor personalizado",
};

export function factorEscenario(p: RdapProject, s: RdapScenario) {
  if (s === "qmd") return p.qmdFactor;
  if (s === "qmh" || s === "incendio") return p.qmhFactor;
  return 1;
}

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}

export function proyectoVacio(): RdapProject {
  return {
    meta: {
      proyecto: "Red de distribución de agua potable",
      cliente: "EPS / Municipalidad",
      ubicacion: "Perú",
      profesional: "Ingeniero civil",
      revisor: "",
      fecha: new Date().toISOString().slice(0, 10),
      version: "1.0",
      datum: "WGS84",
      utmZone: "18S",
      units: "m",
      alcance: "Diseño y verificación hidráulica de la red de distribución de agua potable (RDAP), desde el reservorio o la impulsión hasta los nudos de servicio.",
      tipoSistema: "gravedad",
      tipoRed: "urbano",
      notas: "",
    },
    method: "hazen-williams",
    viscosityM2s: NU_20C,
    solver: { ...SOLVER_DEFAULT },
    criteria: { ...CRITERIOS[0] },
    quality: { ...QUALITY_DEFAULT },
    hammer: { ...HAMMER_DEFAULT },
    qmdFactor: 1.3,
    qmhFactor: 2.3,
    fireNodeId: "",
    fireLs: 5,
    nodes: [],
    pipes: [],
    pumps: [],
    valves: [],
    patterns: [
      {
        id: "PAT-01",
        name: "Residencial 24 h",
        multipliers: [0.4, 0.35, 0.3, 0.3, 0.35, 0.55, 0.9, 1.15, 1.2, 1.05, 0.95, 0.9, 0.95, 0.9, 0.85, 0.9, 1.05, 1.25, 1.3, 1.15, 0.95, 0.75, 0.6, 0.5],
      },
    ],
    topoPoints: [],
  };
}

export function nodoNuevo(id: string, kind: RdapNode["kind"] = "junction"): RdapNode {
  return {
    id,
    name: id,
    kind,
    x: 0,
    y: 0,
    ground: 100,
    cover: kind === "junction" || kind === "hydrant" ? 100 : null,
    invert: kind === "junction" || kind === "hydrant" ? 98.2 : null,
    depthManual: null,
    demandLs: 0,
    patternId: "PAT-01",
    description: "",
    reservoirHgl: kind === "reservoir" ? 110 : null,
    tankBottom: kind === "tank" ? 100 : null,
    tankMin: kind === "tank" ? 1 : null,
    tankMax: kind === "tank" ? 4 : null,
    tankDiameter: kind === "tank" ? 8 : null,
    tankLevel: kind === "tank" ? 2.5 : null,
  };
}

export function tuboNuevo(id: string, start: string, end: string): RdapPipe {
  return {
    id,
    name: id,
    start,
    end,
    lengthM: null,
    use3d: false,
    dnMm: 110,
    idMm: null,
    materialId: "pvc",
    cHw: null,
    roughnessMm: null,
    manningN: null,
    minorK: 0,
    status: "open",
  };
}

export function profundidadDe(n: RdapNode) {
  if (n.depthManual != null && Number.isFinite(n.depthManual)) return n.depthManual;
  const tapa = n.cover ?? n.ground;
  const fondo = n.invert;
  if (fondo == null) return null;
  return tapa - fondo;
}

export function inconsistenciaCotas(n: RdapNode): string | null {
  const tapa = n.cover ?? n.ground;
  const fondo = n.invert;
  if (fondo == null) return null;
  if (tapa < fondo - 1e-6) return `Cota de tapa (${tapa}) menor que cota de fondo (${fondo}).`;
  const p = profundidadDe(n);
  if (p != null && n.depthManual != null && Math.abs(p - (tapa - fondo)) > 0.02) {
    return `Profundidad manual ${n.depthManual} m no coincide con tapa − fondo.`;
  }
  return null;
}

export function longitudPipe(p: RdapPipe, a?: RdapNode, b?: RdapNode) {
  if (p.lengthM != null && p.lengthM > 0) return { L: p.lengthM, origen: "manual" as const };
  if (!a || !b) return { L: 0, origen: "sin nodos" as const };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = (b.invert ?? b.ground) - (a.invert ?? a.ground);
  const Lxy = Math.hypot(dx, dy);
  if (p.use3d) return { L: Math.hypot(Lxy, dz), origen: "3D (X,Y,Z)" as const };
  return { L: Lxy, origen: "horizontal (X,Y)" as const };
}

export function propsPipe(p: RdapPipe) {
  const mat = materialDe(p.materialId);
  const idMm = idEfectivoMm(p.materialId, p.dnMm, p.idMm);
  return {
    mat,
    idMm,
    dM: idMm / 1000,
    C: p.cHw ?? mat.cHw,
    epsM: (p.roughnessMm ?? mat.roughnessMm) / 1000,
    n: p.manningN ?? mat.manningN,
  };
}

export function esNudoDemanda(n: { kind: string }) {
  return n.kind === "junction" || n.kind === "hydrant";
}

export function hglFijo(n: RdapNode): number | null {
  if (n.kind === "reservoir") return n.reservoirHgl ?? n.ground;
  if (n.kind === "tank") return (n.tankBottom ?? n.ground) + (n.tankLevel ?? 0);
  return null;
}

export function nextId(prefix: string, used: string[]) {
  let i = 1;
  while (used.includes(`${prefix}-${String(i).padStart(2, "0")}`)) i++;
  return `${prefix}-${String(i).padStart(2, "0")}`;
}

export function bombaNueva(id: string, start: string, end: string) {
  return {
    id,
    name: id,
    start,
    end,
    curve: [
      { qLs: 0, hM: 45 },
      { qLs: 8, hM: 40 },
      { qLs: 16, hM: 32 },
      { qLs: 24, hM: 20 },
    ],
    status: "on" as const,
  };
}

export function valvulaNueva(id: string, start: string, end: string) {
  return {
    id,
    name: id,
    start,
    end,
    kind: "prv" as const,
    setting: 15,
    dnMm: 100,
    status: "auto" as const,
  };
}

export function renombrarNodo(p: RdapProject, oldId: string, newId: string): RdapProject {
  const id = newId.trim();
  if (!id || id === oldId || p.nodes.some((n) => n.id === id)) return p;
  return {
    ...p,
    fireNodeId: p.fireNodeId === oldId ? id : p.fireNodeId,
    nodes: p.nodes.map((n) => (n.id === oldId ? { ...n, id, name: n.name === oldId ? id : n.name } : n)),
    pipes: p.pipes.map((t) => ({
      ...t,
      start: t.start === oldId ? id : t.start,
      end: t.end === oldId ? id : t.end,
    })),
    pumps: p.pumps.map((b) => ({
      ...b,
      start: b.start === oldId ? id : b.start,
      end: b.end === oldId ? id : b.end,
    })),
    valves: p.valves.map((v) => ({
      ...v,
      start: v.start === oldId ? id : v.start,
      end: v.end === oldId ? id : v.end,
    })),
  };
}

export function borrarNodo(p: RdapProject, id: string): RdapProject {
  return {
    ...p,
    nodes: p.nodes.filter((n) => n.id !== id),
    pipes: p.pipes.filter((t) => t.start !== id && t.end !== id),
    pumps: p.pumps.filter((b) => b.start !== id && b.end !== id),
    valves: p.valves.filter((v) => v.start !== id && v.end !== id),
    fireNodeId: p.fireNodeId === id ? "" : p.fireNodeId,
  };
}

export function normalizarProyecto(raw: unknown): RdapProject {
  const base = proyectoVacio();
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Partial<RdapProject>;
  return {
    ...base,
    ...d,
    meta: { ...base.meta, ...(d.meta ?? {}) },
    solver: { ...base.solver, ...(d.solver ?? {}) },
    criteria: { ...base.criteria, ...(d.criteria ?? {}) },
    quality: { ...base.quality, ...(d.quality ?? {}) },
    hammer: { ...base.hammer, ...(d.hammer ?? {}) },
    qmdFactor: d.qmdFactor ?? base.qmdFactor,
    qmhFactor: d.qmhFactor ?? base.qmhFactor,
    fireNodeId: d.fireNodeId ?? base.fireNodeId,
    fireLs: d.fireLs ?? base.fireLs,
    nodes: d.nodes ?? [],
    pipes: d.pipes ?? [],
    pumps: d.pumps ?? [],
    valves: (d.valves ?? []).map((v) => ({
      ...valvulaNueva(v.id || "V-01", v.start || "", v.end || ""),
      ...v,
      dnMm: v.dnMm && v.dnMm > 0 ? v.dnMm : 100,
      status:
        v.status === "closed" ? "closed"
          : v.status === "open" && (v.kind === "tcv" || v.kind === "check" || v.kind === "iso") ? "open"
            : v.status === "auto" || v.status === "open" ? (v.status === "open" && (v.kind === "prv" || v.kind === "psv" || v.kind === "fcv") ? "auto" : v.status)
              : "auto",
    })),
    patterns: d.patterns?.length ? d.patterns : base.patterns,
    topoPoints: d.topoPoints ?? [],
  };
}

export function csvResultados(p: RdapProject, r: RunResult) {
  const nodos = [
    "id,tipo,nombre,x,y,z_terreno,qd_ls,hgl_m,p_mca,estado,nota",
    ...r.nodes.map((n) => {
      const nd = p.nodes.find((x) => x.id === n.id);
      return [n.id, nd?.kind ?? "", nd?.name ?? "", nd?.x ?? "", nd?.y ?? "", nd?.ground ?? "", n.demandLs, n.hgl, n.pressureMca, n.status, `"${n.note.replaceAll('"', "'")}"`].join(",");
    }),
  ].join("\n");
  const tubos = [
    "id,desde,hasta,q_ls,v_ms,hf_m,i_m_km,sentido,estado,nota",
    ...r.pipes.map((t) => {
      const tp = p.pipes.find((x) => x.id === t.id);
      return [t.id, tp?.start ?? "", tp?.end ?? "", t.qLs, t.velocity, t.hf, t.hfMkm, t.direction, t.status, `"${t.note.replaceAll('"', "'")}"`].join(",");
    }),
  ].join("\n");
  const valvulas = [
    "id,tipo,desde,hasta,consigna,comando,modo,q_ls,dh_m,nota",
    ...r.valves.map((v) => {
      const vv = p.valves.find((x) => x.id === v.id);
      return [v.id, vv?.kind ?? "", vv?.start ?? "", vv?.end ?? "", v.setting, vv?.status ?? "", v.mode, v.qLs, v.headlossM, `"${v.note.replaceAll('"', "'")}"`].join(",");
    }),
  ].join("\n");
  const calidad = [
    "id,edad_h,cl_mg_l,estado,nota",
    ...r.quality.nodes.map((n) => [n.id, n.ageH, n.clMgL, n.status, `"${n.note.replaceAll('"', "'")}"`].join(",")),
  ].join("\n");
  const ariete = [
    "id,a_ms,t_crit_s,metodo,dh_m,p_stat,p_trans,pn_m,ok,nota",
    ...r.hammer.pipes.map((t) => [t.id, t.aMs, t.tCritS, t.method, t.dHM, t.pStatMca, t.pTransMca, t.pnMca, t.ok ? 1 : 0, `"${t.note.replaceAll('"', "'")}"`].join(",")),
  ].join("\n");
  return { nodos, tubos, valvulas, calidad, ariete };
}

export function zTerrenoDePuntos(x: number, y: number, pts: RdapProject["topoPoints"]) {
  if (!pts.length) return null;
  let wsum = 0;
  let zsum = 0;
  for (const p of pts) {
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d2 < 1e-8) return p.z;
    const w = 1 / d2;
    wsum += w;
    zsum += w * p.z;
  }
  return zsum / wsum;
}
