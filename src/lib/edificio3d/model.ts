import { defaultCombinations, defaultLoadPatterns, defaultSelfWeight } from "./loads";
import { defaultFrameSections, defaultMaterials, defaultSlabSections, defaultWallSections } from "./materials";
import { nextId } from "./math";
import type {
  BuildingProject,
  DiaphragmKind,
  DrawTool,
  EndOffset,
  Frame,
  GridLine,
  Load,
  LoadKind,
  Node,
  Release,
  Stair,
  StairKind,
  Story,
  Support,
  SupportKind,
  Wall,
} from "./types";
import { MAX_STORIES } from "./types";
import { stairFlights } from "./stairs";

export function emptyRelease(): Release {
  return { i: {}, j: {} };
}

export function emptyOffset(): EndOffset {
  return { i: 0, j: 0 };
}

export function supportFlags(kind: SupportKind) {
  if (kind === "empotrado") return { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true };
  if (kind === "movil") return { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false };
  if (kind === "rodilloX") return { ux: false, uy: true, uz: true, rx: false, ry: false, rz: false };
  if (kind === "rodilloY") return { ux: true, uy: false, uz: true, rx: false, ry: false, rz: false };
  if (kind === "rodilloZ") return { ux: true, uy: true, uz: false, rx: false, ry: false, rz: false };
  return { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false };
}

function grid(axis: "X" | "Y", name: string, coord: number): GridLine {
  return { id: `${axis}${name}`, name, axis, coord };
}

export function proyectoVacio(nStories = 2, h = 2.8): BuildingProject {
  const n = Math.max(1, Math.min(MAX_STORIES, nStories));
  const stories: Story[] = [];
  let z = 0;
  for (let i = 1; i <= n; i++) {
    z += h;
    stories.push({ id: `N${i}`, name: `N${i}`, height: h, elevation: z, diaphragm: "rigido" });
  }
  return {
    name: "Vivienda",
    materials: defaultMaterials(),
    frameSections: defaultFrameSections(),
    wallSections: defaultWallSections(),
    slabSections: defaultSlabSections(),
    stories,
    gridsX: [grid("X", "A", 0), grid("X", "B", 4), grid("X", "C", 8)],
    gridsY: [grid("Y", "1", 0), grid("Y", "2", 4)],
    nodes: [],
    frames: [],
    walls: [],
    slabs: [],
    stairs: [],
    supports: [],
    piers: [],
    patterns: defaultLoadPatterns(),
    loads: [],
    combinations: defaultCombinations(),
    qAdm: 15,
    soilGamma: 1.8,
    selfWeight: defaultSelfWeight(),
    seismic: {
      code: "e030",
      zona: 4,
      Z: 0.45,
      suelo: "S2",
      S: 1.15,
      Tp: 0.6,
      Tl: 2.0,
      U: 1,
      R0: 8,
      Ia: 1,
      Ip: 1,
      Ct: 35,
      liveFrac: 0.25,
      SDS: 1.0,
      Ie: 1,
      staticFx: 1,
      staticFy: 1,
      dynFx: 1,
      dynFy: 1,
      spectrumId: "e030-2025",
    },
  };
}

export function applyGridSetup(
  p: BuildingProject,
  xs: { name: string; coord: number }[],
  ys: { name: string; coord: number }[],
  nStories: number,
  h: number
) {
  p.gridsX = xs.map((g, i) => ({ id: `X${g.name || String.fromCharCode(65 + i)}`, name: g.name || String.fromCharCode(65 + i), axis: "X" as const, coord: g.coord }));
  p.gridsY = ys.map((g, i) => ({ id: `Y${g.name || String(i + 1)}`, name: g.name || String(i + 1), axis: "Y" as const, coord: g.coord }));
  setStoryCount(p, nStories, h);
}

export function rebuildElevations(p: BuildingProject) {
  let z = 0;
  for (const s of p.stories) {
    z += s.height;
    s.elevation = z;
  }
}

export function storyZ(p: BuildingProject, storyId: string) {
  if (storyId === "BASE") return 0;
  return p.stories.find((s) => s.id === storyId)?.elevation ?? 0;
}

export function storyBelow(p: BuildingProject, storyId: string) {
  const i = p.stories.findIndex((s) => s.id === storyId);
  if (i <= 0) return "BASE";
  return p.stories[i - 1].id;
}

export function findNode(p: BuildingProject, x: number, y: number, z: number, tol = 0.02) {
  return p.nodes.find((n) => Math.abs(n.x - x) < tol && Math.abs(n.y - y) < tol && Math.abs(n.z - z) < tol);
}

export function ensureNode(p: BuildingProject, x: number, y: number, z: number, storyId: string, reference = false): Node {
  const hit = findNode(p, x, y, z);
  if (hit) {
    if (reference) hit.reference = true;
    return hit;
  }
  const node: Node = {
    id: nextId("N", p.nodes.map((n) => n.id)),
    x,
    y,
    z,
    storyId: z < 0.02 ? "BASE" : storyId,
    reference,
  };
  p.nodes.push(node);
  return node;
}

export function foundationNode(p: BuildingProject, x: number, y: number): Node {
  return ensureNode(p, x, y, 0, "BASE");
}

export function ensureBaseSupport(p: BuildingProject, node: Node, kind: SupportKind = "movil") {
  const base = node.z > 0.02 ? foundationNode(p, node.x, node.y) : node;
  if (p.supports.some((s) => s.nodeId === base.id)) return base;
  const flags = supportFlags(kind);
  p.supports.push({
    id: nextId("AP", p.supports.map((s) => s.id)),
    nodeId: base.id,
    kind,
    ...flags,
  });
  return base;
}

/** Los apoyos de pórtico van en z = 0 (cara de zapata), nunca en el último nivel. */
export function snapSupportsToFoundation(p: BuildingProject) {
  const kept: Support[] = [];
  const used = new Set<string>();
  for (const s of p.supports) {
    const n = p.nodes.find((x) => x.id === s.nodeId);
    if (!n) continue;
    const base = n.z <= 0.02 ? n : foundationNode(p, n.x, n.y);
    if (used.has(base.id)) continue;
    used.add(base.id);
    kept.push({ ...s, nodeId: base.id });
  }
  p.supports = kept;
}

export function snapXY(p: BuildingProject, x: number, y: number, extra: { x: number; y: number }[] = [], tol = 0.25) {
  const xs = [...p.gridsX.map((g) => g.coord), ...p.nodes.map((n) => n.x), ...extra.map((e) => e.x)];
  const ys = [...p.gridsY.map((g) => g.coord), ...p.nodes.map((n) => n.y), ...extra.map((e) => e.y)];
  let sx = x;
  let sy = y;
  let bx = tol;
  let by = tol;
  for (const v of xs) {
    const d = Math.abs(v - x);
    if (d < bx) {
      bx = d;
      sx = v;
    }
  }
  for (const v of ys) {
    const d = Math.abs(v - y);
    if (d < by) {
      by = d;
      sy = v;
    }
  }
  return { x: sx, y: sy };
}

export function addColumnAt(p: BuildingProject, storyId: string, x: number, y: number, sectionId = "COL30") {
  const zTop = storyZ(p, storyId);
  const below = storyBelow(p, storyId);
  const zBot = storyZ(p, below);
  const nJ = ensureNode(p, x, y, zTop, storyId);
  const nI = ensureNode(p, x, y, zBot, below);
  if (p.frames.some((f) => f.kind === "column" && f.nI === nI.id && f.nJ === nJ.id)) return nJ;
  p.frames.push({
    id: nextId("C", p.frames.map((f) => f.id)),
    kind: "column",
    nI: nI.id,
    nJ: nJ.id,
    sectionId,
    storyId,
    angle: 0,
    release: emptyRelease(),
    offset: emptyOffset(),
  });
  ensureBaseSupport(p, nI);
  if (zBot > 0.02) ensureBaseSupport(p, foundationNode(p, x, y));
  return nJ;
}

export function addBeam(p: BuildingProject, storyId: string, x1: number, y1: number, x2: number, y2: number, sectionId = "V2550") {
  if (Math.hypot(x2 - x1, y2 - y1) < 0.05) return null;
  const z = storyZ(p, storyId);
  const nI = ensureNode(p, x1, y1, z, storyId);
  const nJ = ensureNode(p, x2, y2, z, storyId);
  if (p.frames.some((f) => f.kind === "beam" && ((f.nI === nI.id && f.nJ === nJ.id) || (f.nI === nJ.id && f.nJ === nI.id)))) {
    return null;
  }
  const frame: Frame = {
    id: nextId("B", p.frames.map((f) => f.id)),
    kind: "beam",
    nI: nI.id,
    nJ: nJ.id,
    sectionId,
    storyId,
    angle: 0,
    release: emptyRelease(),
    offset: emptyOffset(),
  };
  p.frames.push(frame);
  return frame;
}

function makePier(p: BuildingProject, storyId: string, hint: string) {
  const id = nextId("P", p.piers.map((x) => x.id));
  p.piers.push({ id, name: hint || id, storyId });
  return id;
}

export function addWall(
  p: BuildingProject,
  storyId: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sectionId = "M20",
  nDiv = 4,
  pierName?: string
) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 0.1) return null;
  const zTop = storyZ(p, storyId);
  const below = storyBelow(p, storyId);
  const zBot = storyZ(p, below);
  const nI = ensureNode(p, x1, y1, zTop, storyId);
  const nJ = ensureNode(p, x2, y2, zTop, storyId);
  const pierId = makePier(p, storyId, pierName || `Pier ${p.piers.length + 1}`);
  const wall: Wall = {
    id: nextId("W", p.walls.map((w) => w.id)),
    nI: nI.id,
    nJ: nJ.id,
    storyId,
    sectionId,
    pierId,
    nDiv: Math.max(1, Math.min(12, Math.round(nDiv))),
  };
  p.walls.push(wall);
  const nd = wall.nDiv;
  const botIds: string[] = [];
  const topIds: string[] = [];
  for (let i = 0; i <= nd; i++) {
    const t = i / nd;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    const top = ensureNode(p, x, y, zTop, storyId);
    const bot = ensureNode(p, x, y, zBot, below);
    topIds.push(top.id);
    botIds.push(bot.id);
    ensureBaseSupport(p, bot);
    p.frames.push({
      id: nextId("M", p.frames.map((f) => f.id)),
      kind: "pierStrip",
      nI: bot.id,
      nJ: top.id,
      sectionId: `__WALL__${wall.id}`,
      storyId,
      angle: Math.atan2(y2 - y1, x2 - x1),
      release: emptyRelease(),
      offset: emptyOffset(),
      pierId,
    });
  }
  for (let i = 0; i < nd; i++) {
    p.frames.push({
      id: nextId("R", p.frames.map((f) => f.id)),
      kind: "beam",
      nI: topIds[i],
      nJ: topIds[i + 1],
      sectionId: `__RIGID__${wall.id}`,
      storyId,
      angle: 0,
      release: emptyRelease(),
      offset: emptyOffset(),
      pierId,
    });
  }
  return wall;
}

export function addSlab(p: BuildingProject, storyId: string, pts: { x: number; y: number }[], sectionId = "L15-MEM", diaphragm: DiaphragmKind = "rigido") {
  if (pts.length < 3) return null;
  const z = storyZ(p, storyId);
  const nodeIds = pts.map((q) => ensureNode(p, q.x, q.y, z, storyId).id);
  const slab = {
    id: nextId("L", p.slabs.map((s) => s.id)),
    nodeIds,
    storyId,
    sectionId,
    diaphragm,
  };
  p.slabs.push(slab);
  const st = p.stories.find((s) => s.id === storyId);
  if (st) st.diaphragm = diaphragm;
  return slab;
}

export function addStair(
  p: BuildingProject,
  storyFrom: string,
  storyTo: string,
  pts: { x: number; y: number }[],
  kind: StairKind = "recta",
  width = 1.2
) {
  if (pts.length < 2) return null;
  const z1 = storyZ(p, storyFrom);
  const z2 = storyZ(p, storyTo);
  const start = pts[0];
  const end = pts[pts.length - 1];
  const nI = ensureNode(p, start.x, start.y, z1, storyFrom);
  const nJ = ensureNode(p, end.x, end.y, z2, storyTo);
  const stair: Stair = {
    id: nextId("E", p.stairs.map((s) => s.id)),
    kind,
    nI: nI.id,
    nJ: nJ.id,
    storyFrom,
    storyTo,
    width,
    t: 0.15,
    sectionId: "ESC2015",
    materialId: "C210",
  };
  p.stairs.push(stair);
  const flights = stairFlights(kind, pts, width);
  const nF = Math.max(flights.length, 1);
  flights.forEach((fl, i) => {
    const za = z1 + ((z2 - z1) * i) / nF;
    const zb = z1 + ((z2 - z1) * (i + 1)) / nF;
    const stA = i === 0 ? storyFrom : storyTo;
    const a = ensureNode(p, fl.a.x, fl.a.y, za, stA);
    const b = ensureNode(p, fl.b.x, fl.b.y, zb, storyTo);
    const dx = fl.b.x - fl.a.x;
    const dy = fl.b.y - fl.a.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    const w = width / 2;
    const s1 = ensureNode(p, fl.a.x + nx * w, fl.a.y + ny * w, za, stA);
    const s2 = ensureNode(p, fl.b.x + nx * w, fl.b.y + ny * w, zb, storyTo);
    const s3 = ensureNode(p, fl.a.x - nx * w, fl.a.y - ny * w, za, stA);
    const s4 = ensureNode(p, fl.b.x - nx * w, fl.b.y - ny * w, zb, storyTo);
    const links: [string, string][] = [
      [s1.id, s2.id],
      [s3.id, s4.id],
      [a.id, b.id],
      [a.id, s1.id],
      [a.id, s3.id],
      [b.id, s2.id],
      [b.id, s4.id],
    ];
    for (const [i0, j0] of links) {
      if (i0 === j0) continue;
      if (p.frames.some((f) => (f.nI === i0 && f.nJ === j0) || (f.nI === j0 && f.nJ === i0))) continue;
      const ni = p.nodes.find((n) => n.id === i0);
      const nj = p.nodes.find((n) => n.id === j0);
      const landing = ni && nj && Math.abs(ni.z - nj.z) < 0.03;
      p.frames.push({
        id: nextId("E", p.frames.map((f) => f.id)),
        kind: landing ? "beam" : "stair",
        nI: i0,
        nJ: j0,
        sectionId: landing ? "V2540" : stair.sectionId,
        storyId: landing ? (ni?.storyId ?? storyTo) : storyTo,
        angle: 0,
        release: emptyRelease(),
        offset: emptyOffset(),
      });
    }
  });
  return stair;
}

export function editNode(p: BuildingProject, id: string, patch: Partial<Node>) {
  const n = p.nodes.find((x) => x.id === id);
  if (!n) return;
  if (patch.x !== undefined) n.x = patch.x;
  if (patch.y !== undefined) n.y = patch.y;
  if (patch.z !== undefined) n.z = patch.z;
  if (patch.label !== undefined) n.label = patch.label;
}

export function setNodeSupport(p: BuildingProject, nodeId: string, kind: SupportKind) {
  const node = p.nodes.find((n) => n.id === nodeId);
  const baseId = node && node.z > 0.02 ? foundationNode(p, node.x, node.y).id : nodeId;
  if (kind === "nudo") {
    p.supports = p.supports.filter((s) => s.nodeId !== baseId && s.nodeId !== nodeId);
    return;
  }
  addSupportAt(p, baseId, kind);
}

export function setNodeRestraint(p: BuildingProject, nodeId: string, dof: keyof Pick<Support, "ux" | "uy" | "uz" | "rx" | "ry" | "rz">, on: boolean) {
  let s = p.supports.find((x) => x.nodeId === nodeId);
  if (!s) {
    s = addSupportAt(p, nodeId, "nudo") ?? undefined;
    if (!s) return;
    s.kind = "nudo";
  }
  s[dof] = on;
  const { ux, uy, uz, rx, ry, rz } = s;
  if (ux && uy && uz && rx && ry && rz) s.kind = "empotrado";
  else if (ux && uy && uz && !rx && !ry && !rz) s.kind = "movil";
  else if (!ux && uy && uz && !rx && !ry && !rz) s.kind = "rodilloX";
  else if (ux && !uy && uz && !rx && !ry && !rz) s.kind = "rodilloY";
  else s.kind = "nudo";
}

export function addReference(p: BuildingProject, storyId: string, x: number, y: number) {
  const z = storyZ(p, storyId);
  return ensureNode(p, x, y, z, storyId, true);
}

export function addSupportAt(p: BuildingProject, nodeId: string, kind: SupportKind = "movil") {
  const node = p.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const base = node.z <= 0.02 ? node : foundationNode(p, node.x, node.y);
  const prev = p.supports.find((s) => s.nodeId === base.id);
  const flags = supportFlags(kind);
  if (prev) {
    prev.kind = kind;
    Object.assign(prev, flags);
    return prev;
  }
  const s: Support = {
    id: nextId("AP", p.supports.map((x) => x.id)),
    nodeId: base.id,
    kind,
    ...flags,
  };
  p.supports.push(s);
  return s;
}

export function addSupportXY(p: BuildingProject, x: number, y: number, kind: SupportKind = "movil") {
  const base = foundationNode(p, x, y);
  return addSupportAt(p, base.id, kind);
}

export function addLoad(
  p: BuildingProject,
  kind: LoadKind,
  target: Load["target"],
  targetId: string,
  patternId: string,
  dir: Load["dir"],
  values: { w1?: number; w2?: number; a?: number; b?: number; P?: number }
) {
  const load: Load = {
    id: nextId("Q", p.loads.map((l) => l.id)),
    patternId,
    kind,
    target,
    targetId,
    dir,
    w1: values.w1 ?? 0,
    w2: values.w2 ?? values.w1 ?? 0,
    a: values.a ?? 0,
    b: values.b ?? 1,
    P: values.P ?? 0,
  };
  p.loads.push(load);
  return load;
}

export function copyStory(p: BuildingProject, fromId: string, toId: string) {
  const zFrom = storyZ(p, fromId);
  const zTo = storyZ(p, toId);
  const map = new Map<string, string>();
  for (const n of p.nodes.filter((x) => x.storyId === fromId || Math.abs(x.z - zFrom) < 0.02)) {
    const nn = ensureNode(p, n.x, n.y, zTo, toId, n.reference);
    map.set(n.id, nn.id);
  }
  for (const f of p.frames.filter((x) => x.storyId === fromId && x.kind !== "pierStrip")) {
    const a = p.nodes.find((n) => n.id === f.nI);
    const b = p.nodes.find((n) => n.id === f.nJ);
    if (!a || !b) continue;
    if (f.kind === "column") {
      addColumnAt(p, toId, b.x, b.y, f.sectionId);
      continue;
    }
    if (f.kind === "beam" && f.sectionId.startsWith("__RIGID__")) continue;
    addBeam(p, toId, a.x, a.y, b.x, b.y, f.sectionId);
  }
  for (const w of p.walls.filter((x) => x.storyId === fromId)) {
    const a = p.nodes.find((n) => n.id === w.nI);
    const b = p.nodes.find((n) => n.id === w.nJ);
    if (!a || !b) continue;
    addWall(p, toId, a.x, a.y, b.x, b.y, w.sectionId, w.nDiv, w.pierId);
  }
  for (const s of p.slabs.filter((x) => x.storyId === fromId)) {
    const pts = s.nodeIds
      .map((id) => p.nodes.find((n) => n.id === id))
      .filter((n): n is Node => !!n)
      .map((n) => ({ x: n.x, y: n.y }));
    addSlab(p, toId, pts, s.sectionId, s.diaphragm);
  }
  void map;
}

export function setStoryCount(p: BuildingProject, n: number, h = 2.8) {
  const count = Math.max(1, Math.min(MAX_STORIES, n));
  while (p.stories.length < count) {
    const i = p.stories.length + 1;
    p.stories.push({ id: `N${i}`, name: `N${i}`, height: h, elevation: 0, diaphragm: "rigido" });
  }
  if (p.stories.length > count) {
    const keep = new Set(p.stories.slice(0, count).map((s) => s.id));
    p.stories = p.stories.slice(0, count);
    p.frames = p.frames.filter((f) => keep.has(f.storyId));
    p.walls = p.walls.filter((w) => keep.has(w.storyId));
    p.slabs = p.slabs.filter((s) => keep.has(s.storyId));
    p.piers = p.piers.filter((x) => keep.has(x.storyId));
    const zMax = p.stories[p.stories.length - 1]?.elevation ?? 0;
    rebuildElevations(p);
    const zTop = p.stories[p.stories.length - 1]?.elevation ?? 0;
    p.nodes = p.nodes.filter((n) => n.z <= zTop + 0.02);
    void zMax;
  }
  rebuildElevations(p);
}

export function addGridX(p: BuildingProject, coord: number) {
  const name = String.fromCharCode(65 + p.gridsX.length);
  p.gridsX.push(grid("X", name, coord));
  p.gridsX.sort((a, b) => a.coord - b.coord);
}

export function addGridY(p: BuildingProject, coord: number) {
  const name = String(p.gridsY.length + 1);
  p.gridsY.push(grid("Y", name, coord));
  p.gridsY.sort((a, b) => a.coord - b.coord);
}

export function deleteSelection(p: BuildingProject, kind: string, id: string) {
  if (kind === "frame") p.frames = p.frames.filter((f) => f.id !== id);
  if (kind === "wall") {
    const w = p.walls.find((x) => x.id === id);
    p.walls = p.walls.filter((x) => x.id !== id);
    if (w) {
      p.frames = p.frames.filter((f) => f.pierId !== w.pierId || f.kind !== "pierStrip");
      p.frames = p.frames.filter((f) => f.sectionId !== `__RIGID__${w.id}`);
    }
  }
  if (kind === "slab") p.slabs = p.slabs.filter((s) => s.id !== id);
  if (kind === "stair") {
    p.stairs = p.stairs.filter((s) => s.id !== id);
    p.frames = p.frames.filter((f) => !(f.kind === "stair" && f.id.startsWith("E")));
  }
  if (kind === "support") p.supports = p.supports.filter((s) => s.id !== id);
  if (kind === "load") p.loads = p.loads.filter((l) => l.id !== id);
  if (kind === "node") {
    const n = p.nodes.find((x) => x.id === id);
    if (n?.reference) p.nodes = p.nodes.filter((x) => x.id !== id);
  }
}

export function proyectoDemo(): BuildingProject {
  const p = proyectoVacio(2, 2.8);
  p.name = "Vivienda 2 pisos — ejemplo";
  const xs = p.gridsX.map((g) => g.coord);
  const ys = p.gridsY.map((g) => g.coord);
  for (const st of p.stories) {
    for (const x of xs) for (const y of ys) addColumnAt(p, st.id, x, y, "COL30");
    for (const y of ys) {
      for (let i = 0; i < xs.length - 1; i++) addBeam(p, st.id, xs[i], y, xs[i + 1], y, "V2550");
    }
    for (const x of xs) {
      for (let i = 0; i < ys.length - 1; i++) addBeam(p, st.id, x, ys[i], x, ys[i + 1], "V2550");
    }
    addSlab(
      p,
      st.id,
      [
        { x: xs[0], y: ys[0] },
        { x: xs[xs.length - 1], y: ys[0] },
        { x: xs[xs.length - 1], y: ys[ys.length - 1] },
        { x: xs[0], y: ys[ys.length - 1] },
      ],
      "L15-MEM",
      "rigido"
    );
  }
  addWall(p, "N1", 0, 0, 4, 0, "M20", 4, "P1-X");
  addWall(p, "N2", 0, 0, 4, 0, "M20", 4, "P1-X");
  addStair(p, "N1", "N2", [{ x: 8, y: 0 }, { x: 8, y: 4 }], "recta", 1.2);
  for (const s of p.slabs) {
    addLoad(p, "area", "slab", s.id, "CV", "GZ", { w1: 0.2 });
  }
  snapSupportsToFoundation(p);
  return p;
}

export function toolHint(tool: DrawTool) {
  const map: Record<DrawTool, string> = {
    select: "Seleccione un nudo, viga, columna, muro o losa.",
    column: "Clic en un cruce de ejes para colocar una columna en el nivel activo.",
    beam: "Clic inicial y clic final para una viga en el plano del nivel.",
    wall: "Dos clics definen el eje del muro (pier). Se subdivide y apoya en cimentación.",
    slab: "Tres o más clics; cierre cerca del primero. Membrane / shell thin / thick.",
    stair: "Elija el tipo y luego el arranque. Según el tipo: 2 o 3 clics.",
    support: "Clic en un nudo de cimentación. Por defecto móvil; puede pasar a empotrado.",
    ref: "Clic para un punto de referencia auxiliar (no estructural).",
    loadPoint: "Clic en viga o nudo: carga puntual.",
    loadLine: "Clic en viga: carga uniforme lineal.",
    loadTri: "Clic en viga: carga triangular.",
    loadTrap: "Clic en viga: carga trapezoidal.",
    loadArea: "Clic en losa: carga de área (viva o asimétrica).",
  };
  return map[tool];
}
