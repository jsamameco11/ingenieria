import type { BuildingProject, Combination, LoadPattern, SelfWeightOpts } from "./types";

export function defaultSelfWeight(): SelfWeightOpts {
  return {
    enabled: true,
    multiplier: 1,
    columns: true,
    beams: true,
    walls: true,
    slabs: true,
    stairs: true,
  };
}

export function normalizeSelfWeight(s: Partial<SelfWeightOpts> | undefined): SelfWeightOpts {
  return { ...defaultSelfWeight(), ...(s || {}) };
}

export type LoadPatternDef = LoadPattern & { group: string; groupLabel: string };

export const LOAD_PATTERN_CATALOG: LoadPatternDef[] = [
  { id: "CM", name: "CM · Muerto (peso propio)", selfWeight: true, gammaX: 0, gammaY: 0, gammaZ: -1, group: "grav", groupLabel: "Gravedad" },
  { id: "SD", name: "SD · Sobrecarga permanente", selfWeight: false, gammaX: 0, gammaY: 0, gammaZ: -1, group: "grav", groupLabel: "Gravedad" },
  { id: "TAB", name: "TAB · Tabiquería", selfWeight: false, gammaX: 0, gammaY: 0, gammaZ: -1, group: "grav", groupLabel: "Gravedad" },
  { id: "EQP", name: "EQP · Equipos", selfWeight: false, gammaX: 0, gammaY: 0, gammaZ: -1, group: "grav", groupLabel: "Gravedad" },
  { id: "CV", name: "CV · Vivo", selfWeight: false, gammaX: 0, gammaY: 0, gammaZ: -1, group: "vivo", groupLabel: "Vivas" },
  { id: "CVT", name: "CVT · Vivo de techo", selfWeight: false, gammaX: 0, gammaY: 0, gammaZ: -1, group: "vivo", groupLabel: "Vivas" },
  { id: "CVR", name: "CVR · Vivo reductible", selfWeight: false, gammaX: 0, gammaY: 0, gammaZ: -1, group: "vivo", groupLabel: "Vivas" },
  { id: "WX", name: "WX · Viento X", selfWeight: false, gammaX: 1, gammaY: 0, gammaZ: 0, group: "viento", groupLabel: "Viento" },
  { id: "WY", name: "WY · Viento Y", selfWeight: false, gammaX: 0, gammaY: 1, gammaZ: 0, group: "viento", groupLabel: "Viento" },
  { id: "EMP", name: "EMP · Empuje de tierras", selfWeight: false, gammaX: 1, gammaY: 0, gammaZ: 0, group: "suelo", groupLabel: "Suelo y fluidos" },
  { id: "HID", name: "HID · Hidrostática", selfWeight: false, gammaX: 1, gammaY: 0, gammaZ: 0, group: "suelo", groupLabel: "Suelo y fluidos" },
  { id: "TEMP", name: "TEMP · Temperatura", selfWeight: false, gammaX: 0, gammaY: 0, gammaZ: 0, group: "esp", groupLabel: "Especiales" },
  { id: "NTX", name: "NTX · Notional X", selfWeight: false, gammaX: 1, gammaY: 0, gammaZ: 0, group: "esp", groupLabel: "Especiales" },
  { id: "NTY", name: "NTY · Notional Y", selfWeight: false, gammaX: 0, gammaY: 1, gammaZ: 0, group: "esp", groupLabel: "Especiales" },
  { id: "SEX", name: "SEX · Sismo estático X", selfWeight: false, gammaX: 1, gammaY: 0, gammaZ: 0, group: "sis", groupLabel: "Sismo" },
  { id: "SEY", name: "SEY · Sismo estático Y", selfWeight: false, gammaX: 0, gammaY: 1, gammaZ: 0, group: "sis", groupLabel: "Sismo" },
  { id: "SDX", name: "SDX · Espectro de diseño X", selfWeight: false, gammaX: 1, gammaY: 0, gammaZ: 0, group: "sis", groupLabel: "Sismo" },
  { id: "SDY", name: "SDY · Espectro de diseño Y", selfWeight: false, gammaX: 0, gammaY: 1, gammaZ: 0, group: "sis", groupLabel: "Sismo" },
];

const DEFAULT_COMBOS: Combination[] = [
  { id: "U1", name: "1.4 CM + 1.7 CV", factors: { CM: 1.4, CV: 1.7 } },
  { id: "U2", name: "1.25 (CM + SD + CV)", factors: { CM: 1.25, SD: 1.25, CV: 1.25 } },
  { id: "U3", name: "1.25 (CM + CV) + WX", factors: { CM: 1.25, CV: 1.25, WX: 1 } },
  { id: "U4", name: "1.25 (CM + CV) + WY", factors: { CM: 1.25, CV: 1.25, WY: 1 } },
  { id: "SERV", name: "CM + SD + CV", factors: { CM: 1, SD: 1, CV: 1 } },
];

export function catalogGroups() {
  const map = new Map<string, { id: string; label: string; items: LoadPatternDef[] }>();
  for (const p of LOAD_PATTERN_CATALOG) {
    let g = map.get(p.group);
    if (!g) {
      g = { id: p.group, label: p.groupLabel, items: [] };
      map.set(p.group, g);
    }
    g.items.push(p);
  }
  return [...map.values()];
}

export function defaultLoadPatterns(): LoadPattern[] {
  return LOAD_PATTERN_CATALOG.filter((p) => !["SEX", "SEY", "SDX", "SDY"].includes(p.id)).map((p) => ({
    id: p.id,
    name: p.name,
    selfWeight: p.selfWeight,
    gammaX: p.gammaX,
    gammaY: p.gammaY,
    gammaZ: p.gammaZ,
  }));
}

export function defaultCombinations(): Combination[] {
  return DEFAULT_COMBOS.map((c) => ({ ...c, factors: { ...c.factors } }));
}

export function ensureCatalogPatterns(p: BuildingProject) {
  for (const def of LOAD_PATTERN_CATALOG) {
    if (["SEX", "SEY", "SDX", "SDY"].includes(def.id)) continue;
    if (p.patterns.some((x) => x.id === def.id)) continue;
    p.patterns.push({
      id: def.id,
      name: def.name,
      selfWeight: def.selfWeight,
      gammaX: def.gammaX,
      gammaY: def.gammaY,
      gammaZ: def.gammaZ,
    });
  }
}

export function patternLabel(id: string) {
  return LOAD_PATTERN_CATALOG.find((p) => p.id === id)?.name ?? id;
}

export type SelfWeightKind = "columns" | "beams" | "walls" | "slabs" | "stairs";

export function selfWeightOn(p: BuildingProject, kind: SelfWeightKind) {
  const o = normalizeSelfWeight(p.selfWeight);
  return o.enabled && o[kind];
}

export function selfWeightScale(p: BuildingProject) {
  const o = normalizeSelfWeight(p.selfWeight);
  return o.enabled ? Math.max(0, o.multiplier) : 0;
}

export type SelfWeightRow = { id: SelfWeightKind; label: string; n: number; volume: number; weight: number };

function frameVolume(p: BuildingProject, kind: "column" | "beam") {
  let V = 0;
  let n = 0;
  let W = 0;
  for (const f of p.frames) {
    if (f.kind !== kind) continue;
    if (f.sectionId.startsWith("__RIGID__") || f.sectionId.startsWith("__WALL__")) continue;
    const a = p.nodes.find((x) => x.id === f.nI);
    const b = p.nodes.find((x) => x.id === f.nJ);
    const sec = p.frameSections.find((s) => s.id === f.sectionId);
    const mat = sec ? p.materials.find((m) => m.id === sec.materialId) : undefined;
    if (!a || !b || !sec || !mat) continue;
    const vol = sec.b * sec.h * Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    V += vol;
    W += mat.gamma * vol;
    n++;
  }
  return { n, volume: V, weight: W };
}

/** W = γ · V. γ del concreto (t/m³). V = b·h·L (pórtico), t·A (losa), t·L·h (muro). */
export function concreteSelfWeight(p: BuildingProject) {
  const o = normalizeSelfWeight(p.selfWeight);
  const k = o.enabled ? o.multiplier : 0;
  const col = frameVolume(p, "column");
  const beam = frameVolume(p, "beam");
  let walls = { n: 0, volume: 0, weight: 0 };
  for (const w of p.walls) {
    const a = p.nodes.find((x) => x.id === w.nI);
    const b = p.nodes.find((x) => x.id === w.nJ);
    const sec = p.wallSections.find((s) => s.id === w.sectionId);
    const mat = sec ? p.materials.find((m) => m.id === sec.materialId) : undefined;
    const st = p.stories.find((s) => s.id === w.storyId);
    if (!a || !b || !sec || !mat) continue;
    const vol = sec.t * Math.hypot(b.x - a.x, b.y - a.y) * (st?.height ?? 2.8);
    walls.n++;
    walls.volume += vol;
    walls.weight += mat.gamma * vol;
  }
  let slabs = { n: 0, volume: 0, weight: 0 };
  for (const s of p.slabs) {
    const ns = s.nodeIds.map((id) => p.nodes.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
    if (ns.length < 3) continue;
    let A = 0;
    for (let i = 0; i < ns.length; i++) {
      const j = (i + 1) % ns.length;
      A += ns[i].x * ns[j].y - ns[j].x * ns[i].y;
    }
    const sec = p.slabSections.find((x) => x.id === s.sectionId);
    const mat = sec ? p.materials.find((m) => m.id === sec.materialId) : undefined;
    if (!sec || !mat) continue;
    const vol = sec.t * Math.abs(A) / 2;
    slabs.n++;
    slabs.volume += vol;
    slabs.weight += mat.gamma * vol;
  }
  let stairs = { n: 0, volume: 0, weight: 0 };
  for (const st of p.stairs) {
    const a = p.nodes.find((x) => x.id === st.nI);
    const b = p.nodes.find((x) => x.id === st.nJ);
    const mat = p.materials.find((m) => m.id === st.materialId);
    if (!a || !b || !mat) continue;
    const vol = st.width * st.t * Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    stairs.n++;
    stairs.volume += vol;
    stairs.weight += mat.gamma * vol;
  }
  const take = (kind: SelfWeightKind, label: string, raw: { n: number; volume: number; weight: number }): SelfWeightRow => ({
    id: kind,
    label,
    n: raw.n,
    volume: o[kind] ? raw.volume : 0,
    weight: o[kind] ? raw.weight * k : 0,
  });
  const rows = [
    take("columns", "Columnas", col),
    take("beams", "Vigas", beam),
    take("walls", "Muros / piers", walls),
    take("slabs", "Losas", slabs),
    take("stairs", "Escaleras", stairs),
  ];
  return {
    rows,
    volume: rows.reduce((a, r) => a + r.volume, 0),
    weight: rows.reduce((a, r) => a + r.weight, 0),
    gamma: p.materials[0]?.gamma ?? 2.4,
  };
}
