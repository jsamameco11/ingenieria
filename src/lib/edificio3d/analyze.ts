import { E_tm2, sectionProps } from "./materials";
import { mat12, mul12, norm3, R3, rotateLocalAxes, solveDense, vec, zeros } from "./math";
import { snapSupportsToFoundation, storyZ } from "./model";
import type {
  AnalysisResult,
  BuildingProject,
  ComboResult,
  EndForces,
  FootingResult,
  Frame,
  FrameSection,
  Load,
  Material,
  MemberResult,
  Node,
  PierResultant,
  Reaction,
} from "./types";

type Axes = { ex: { x: number; y: number; z: number }; ey: { x: number; y: number; z: number }; ez: { x: number; y: number; z: number }; L: number };

function nodeOf(p: BuildingProject, id: string) {
  return p.nodes.find((n) => n.id === id);
}

function matOf(p: BuildingProject, id: string): Material {
  return p.materials.find((m) => m.id === id) ?? p.materials[2] ?? p.materials[0];
}

function wallVirtualSection(p: BuildingProject, frame: Frame): FrameSection | null {
  if (!frame.sectionId.startsWith("__WALL__")) return null;
  const wallId = frame.sectionId.slice(8);
  const wall = p.walls.find((w) => w.id === wallId);
  if (!wall) return null;
  const ws = p.wallSections.find((s) => s.id === wall.sectionId);
  if (!ws) return null;
  const a = nodeOf(p, wall.nI);
  const b = nodeOf(p, wall.nJ);
  if (!a || !b) return null;
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const strip = Math.max(L / Math.max(wall.nDiv, 1), 0.1);
  return {
    id: frame.sectionId,
    name: "Franja de muro",
    kind: "rect",
    b: ws.t,
    h: strip,
    materialId: ws.materialId,
  };
}

function rigidVirtualSection(p: BuildingProject, frame: Frame): FrameSection | null {
  if (!frame.sectionId.startsWith("__RIGID__")) return null;
  const wallId = frame.sectionId.slice(9);
  const wall = p.walls.find((w) => w.id === wallId);
  const ws = wall ? p.wallSections.find((s) => s.id === wall.sectionId) : undefined;
  return {
    id: frame.sectionId,
    name: "Rígido de pier",
    kind: "rect",
    b: ws?.t ?? 0.2,
    h: 0.8,
    materialId: ws?.materialId ?? "C210",
  };
}

function frameSection(p: BuildingProject, frame: Frame): { sec: FrameSection; mat: Material } | null {
  const virt = wallVirtualSection(p, frame) ?? rigidVirtualSection(p, frame);
  const sec = virt ?? p.frameSections.find((s) => s.id === frame.sectionId);
  if (!sec) return null;
  const mat = matOf(p, sec.materialId);
  return { sec, mat };
}

function localAxes(a: Node, b: Node, angle: number): Axes {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const n = norm3(d.x, d.y, d.z);
  const axes = rotateLocalAxes({ x: n.x, y: n.y, z: n.z }, angle);
  return { ...axes, L: n.L };
}

/** Matriz 12×12 Euler-Bernoulli 3D (McGuire / CSI). */
function kLocal(E: number, G: number, A: number, Iy: number, Iz: number, J: number, L: number) {
  const K = mat12();
  const put = (i: number, j: number, v: number) => {
    K[i][j] += v;
  };
  const ea = (E * A) / L;
  const gj = (G * J) / L;
  put(0, 0, ea);
  put(0, 6, -ea);
  put(6, 6, ea);
  put(3, 3, gj);
  put(3, 9, -gj);
  put(9, 9, gj);
  const az = (12 * E * Iz) / L ** 3;
  const bz = (6 * E * Iz) / L ** 2;
  const cz = (4 * E * Iz) / L;
  const dz = (2 * E * Iz) / L;
  put(1, 1, az);
  put(1, 7, -az);
  put(7, 7, az);
  put(1, 5, bz);
  put(1, 11, bz);
  put(7, 5, -bz);
  put(7, 11, -bz);
  put(5, 5, cz);
  put(11, 11, cz);
  put(5, 11, dz);
  const ay = (12 * E * Iy) / L ** 3;
  const by = (6 * E * Iy) / L ** 2;
  const cy = (4 * E * Iy) / L;
  const dy = (2 * E * Iy) / L;
  put(2, 2, ay);
  put(2, 8, -ay);
  put(8, 8, ay);
  put(2, 4, -by);
  put(2, 10, -by);
  put(8, 4, by);
  put(8, 10, by);
  put(4, 4, cy);
  put(10, 10, cy);
  put(4, 10, dy);
  for (let i = 0; i < 12; i++) for (let j = 0; j < i; j++) K[i][j] = K[j][i];
  return K;
}

function TfromR(R: number[][]) {
  const T = mat12();
  for (let b = 0; b < 4; b++) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) T[b * 3 + i][b * 3 + j] = R[i][j];
  }
  return T;
}

function kGlobal(kL: number[][], R: number[][]) {
  const T = TfromR(R);
  const TK = mat12();
  const KG = mat12();
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      let s = 0;
      for (let k = 0; k < 12; k++) s += T[i][k] * kL[k][j];
      TK[i][j] = s;
    }
  }
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      let s = 0;
      for (let k = 0; k < 12; k++) s += TK[i][k] * T[j][k];
      KG[i][j] = s;
    }
  }
  return { KG, T };
}

function applyReleases(kL: number[][], frame: Frame) {
  const mapI = { P: 0, V2: 1, V3: 2, T: 3, M2: 4, M3: 5 } as const;
  const mapJ = { P: 6, V2: 7, V3: 8, T: 9, M2: 10, M3: 11 } as const;
  const released: number[] = [];
  for (const [k, on] of Object.entries(frame.release.i)) if (on) released.push(mapI[k as keyof typeof mapI]);
  for (const [k, on] of Object.entries(frame.release.j)) if (on) released.push(mapJ[k as keyof typeof mapJ]);
  if (!released.length) return kL;
  const keep = [...Array(12).keys()].filter((i) => !released.includes(i));
  const nR = released.length;
  const Krr = zeros(nR);
  const Kkr = zeros(keep.length, nR);
  const Kkk = zeros(keep.length);
  for (let i = 0; i < nR; i++) for (let j = 0; j < nR; j++) Krr[i][j] = kL[released[i]][released[j]];
  for (let i = 0; i < keep.length; i++) {
    for (let j = 0; j < nR; j++) Kkr[i][j] = kL[keep[i]][released[j]];
    for (let j = 0; j < keep.length; j++) Kkk[i][j] = kL[keep[i]][keep[j]];
  }
  const KrrInv = zeros(nR);
  for (let i = 0; i < nR; i++) {
    const e = vec(nR);
    e[i] = 1;
    const col = solveDense(Krr.map((r) => Float64Array.from(r)), e);
    if (!col) return kL;
    for (let j = 0; j < nR; j++) KrrInv[j][i] = col[j];
  }
  const out = mat12();
  for (let i = 0; i < keep.length; i++) {
    for (let j = 0; j < keep.length; j++) {
      let s = Kkk[i][j];
      for (let a = 0; a < nR; a++) {
        let t = 0;
        for (let b = 0; b < nR; b++) t += KrrInv[a][b] * Kkr[j][b];
        s -= Kkr[i][a] * t;
      }
      out[keep[i]][keep[j]] = s;
    }
  }
  return out;
}

function applyOffset(KG: number[][], a: Node, b: Node, frame: Frame, axes: Axes) {
  const oi = frame.offset.i;
  const oj = frame.offset.j;
  if (oi < 1e-9 && oj < 1e-9) return KG;
  const ei = { x: axes.ex.x * oi, y: axes.ex.y * oi, z: axes.ex.z * oi };
  const ej = { x: -axes.ex.x * oj, y: -axes.ex.y * oj, z: -axes.ex.z * oj };
  const W = mat12();
  for (let i = 0; i < 12; i++) W[i][i] = 1;
  W[0][4] = ei.z;
  W[0][5] = -ei.y;
  W[1][3] = -ei.z;
  W[1][5] = ei.x;
  W[2][3] = ei.y;
  W[2][4] = -ei.x;
  W[6][10] = ej.z;
  W[6][11] = -ej.y;
  W[7][9] = -ej.z;
  W[7][11] = ej.x;
  W[8][9] = ej.y;
  W[8][10] = -ej.x;
  const WK = mat12();
  const out = mat12();
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
    let s = 0;
    for (let k = 0; k < 12; k++) s += W[k][i] * KG[k][j];
    WK[i][j] = s;
  }
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
    let s = 0;
    for (let k = 0; k < 12; k++) s += WK[i][k] * W[k][j];
    out[i][j] = s;
  }
  void a;
  void b;
  return out;
}

type DofRef = { eq: number; c: number };

function storyCentroid(p: BuildingProject, storyId: string) {
  const z = storyZ(p, storyId);
  const ns = p.nodes.filter((n) => Math.abs(n.z - z) < 0.03 && !n.reference);
  if (!ns.length) return { x: 0, y: 0 };
  return { x: ns.reduce((s, n) => s + n.x, 0) / ns.length, y: ns.reduce((s, n) => s + n.y, 0) / ns.length };
}

function restrained(p: BuildingProject, nodeId: string) {
  const s = p.supports.find((x) => x.nodeId === nodeId);
  if (!s || s.kind === "nudo") return [false, false, false, false, false, false];
  return [s.ux, s.uy, s.uz, s.rx, s.ry, s.rz];
}

function connectedIds(p: BuildingProject) {
  const ids = new Set<string>();
  for (const f of p.frames) {
    ids.add(f.nI);
    ids.add(f.nJ);
  }
  for (const s of p.slabs) for (const id of s.nodeIds) ids.add(id);
  for (const s of p.supports) ids.add(s.nodeId);
  return ids;
}

function buildDof(p: BuildingProject) {
  const eq = new Map<string, number>();
  const live = connectedIds(p);
  let n = 0;
  const take = (key: string) => {
    if (!eq.has(key)) eq.set(key, n++);
    return eq.get(key)!;
  };
  for (const st of p.stories) {
    const has = p.nodes.some((n) => live.has(n.id) && Math.abs(n.z - st.elevation) < 0.03);
    if (st.diaphragm === "rigido" && has) {
      take(`D:${st.id}:0`);
      take(`D:${st.id}:1`);
      take(`D:${st.id}:5`);
    }
  }
  for (const node of p.nodes) {
    if (!live.has(node.id)) continue;
    const rest = restrained(p, node.id);
    const st = p.stories.find((s) => Math.abs(s.elevation - node.z) < 0.03);
    const rigid = st?.diaphragm === "rigido";
    for (let d = 0; d < 6; d++) {
      if (rest[d]) continue;
      if (rigid && (d === 0 || d === 1 || d === 5)) continue;
      take(`${node.id}:${d}`);
    }
  }
  const map = (node: Node, d: number): DofRef[] => {
    const rest = restrained(p, node.id);
    if (rest[d]) return [];
    const st = p.stories.find((s) => Math.abs(s.elevation - node.z) < 0.03);
    if (st?.diaphragm === "rigido" && (d === 0 || d === 1 || d === 5)) {
      const c = storyCentroid(p, st.id);
      if (d === 0) {
        return [
          { eq: eq.get(`D:${st.id}:0`)!, c: 1 },
          { eq: eq.get(`D:${st.id}:5`)!, c: -(node.y - c.y) },
        ];
      }
      if (d === 1) {
        return [
          { eq: eq.get(`D:${st.id}:1`)!, c: 1 },
          { eq: eq.get(`D:${st.id}:5`)!, c: node.x - c.x },
        ];
      }
      return [{ eq: eq.get(`D:${st.id}:5`)!, c: 1 }];
    }
    const e = eq.get(`${node.id}:${d}`);
    return e === undefined ? [] : [{ eq: e, c: 1 }];
  };
  return { n, map };
}

function assembleAdd(K: Float64Array[], F: Float64Array, iRefs: DofRef[], jRefs: DofRef[], kij: number, fi: number) {
  for (const a of iRefs) {
    F[a.eq] += a.c * fi;
    for (const b of jRefs) K[a.eq][b.eq] += a.c * b.c * kij;
  }
}

function frameFixedEnd(p: BuildingProject, frame: Frame, patternId: string, axes: Axes, sec: FrameSection, mat: Material) {
  const fe = new Array(12).fill(0);
  const pat = p.patterns.find((x) => x.id === patternId);
  const L = axes.L;
  const sw = p.selfWeight ?? { enabled: true, multiplier: 1, columns: true, beams: true, walls: true, slabs: true, stairs: true };
  const swK = sw.enabled ? Math.max(0, sw.multiplier) : 0;
  if (pat?.selfWeight && swK > 0 && !frame.sectionId.startsWith("__WALL__") && !frame.sectionId.startsWith("__RIGID__")) {
    const kindOk = frame.kind === "column" ? sw.columns : sw.beams;
    if (kindOk) {
      const wG = mat.gamma * sec.b * sec.h * swK;
      addGlobalDist(fe, axes, 0, 0, -wG, L);
    }
  }
  if (frame.sectionId.startsWith("__WALL__")) {
    const wallId = frame.sectionId.slice(8);
    const wall = p.walls.find((w) => w.id === wallId);
    const ws = wall ? p.wallSections.find((s) => s.id === wall.sectionId) : undefined;
    if (pat?.selfWeight && swK > 0 && sw.walls && ws) {
      const a = nodeOf(p, wall!.nI)!;
      const b = nodeOf(p, wall!.nJ)!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const strip = len / Math.max(wall!.nDiv, 1);
      const wG = mat.gamma * ws.t * strip * swK;
      addGlobalDist(fe, axes, 0, 0, -wG, L);
    }
  }
  for (const ld of p.loads.filter((l) => l.patternId === patternId && l.target === "frame" && l.targetId === frame.id)) {
    addMemberLoad(fe, axes, ld, L);
  }
  return fe;
}

function dirGlobal(dir: Load["dir"], axes: Axes): { x: number; y: number; z: number } {
  if (dir === "GX") return { x: 1, y: 0, z: 0 };
  if (dir === "GY") return { x: 0, y: 1, z: 0 };
  if (dir === "GZ") return { x: 0, y: 0, z: 1 };
  if (dir === "LX") return axes.ex;
  if (dir === "LY") return axes.ey;
  return axes.ez;
}

function addGlobalDist(fe: number[], axes: Axes, wx: number, wy: number, wz: number, L: number) {
  const wL = wx * axes.ex.x + wy * axes.ex.y + wz * axes.ex.z;
  const w2 = wx * axes.ey.x + wy * axes.ey.y + wz * axes.ey.z;
  const w3 = wx * axes.ez.x + wy * axes.ez.y + wz * axes.ez.z;
  fe[0] += (wL * L) / 2;
  fe[6] += (wL * L) / 2;
  fe[1] += (w2 * L) / 2;
  fe[7] += (w2 * L) / 2;
  fe[5] += (w2 * L * L) / 12;
  fe[11] += -(w2 * L * L) / 12;
  fe[2] += (w3 * L) / 2;
  fe[8] += (w3 * L) / 2;
  fe[4] += -(w3 * L * L) / 12;
  fe[10] += (w3 * L * L) / 12;
}

function addMemberLoad(fe: number[], axes: Axes, ld: Load, L: number) {
  const g = dirGlobal(ld.dir, axes);
  if (ld.kind === "puntual") {
    const a = Math.max(0, Math.min(L, ld.a || L / 2));
    const b = L - a;
    const P = ld.P;
    const w2 = P * (g.x * axes.ey.x + g.y * axes.ey.y + g.z * axes.ey.z);
    const w3 = P * (g.x * axes.ez.x + g.y * axes.ez.y + g.z * axes.ez.z);
    const wL = P * (g.x * axes.ex.x + g.y * axes.ex.y + g.z * axes.ex.z);
    fe[0] += (wL * b) / L;
    fe[6] += (wL * a) / L;
    const f2i = (w2 * b * b * (3 * a + b)) / L ** 3;
    const f2j = (w2 * a * a * (a + 3 * b)) / L ** 3;
    fe[1] += f2i;
    fe[7] += f2j;
    fe[5] += (w2 * a * b * b) / L ** 2;
    fe[11] += -(w2 * a * a * b) / L ** 2;
    const f3i = (w3 * b * b * (3 * a + b)) / L ** 3;
    const f3j = (w3 * a * a * (a + 3 * b)) / L ** 3;
    fe[2] += f3i;
    fe[8] += f3j;
    fe[4] += -(w3 * a * b * b) / L ** 2;
    fe[10] += (w3 * a * a * b) / L ** 2;
    return;
  }
  const w1 = ld.kind === "lineal" ? ld.w1 : ld.w1;
  const w2 = ld.kind === "lineal" ? ld.w1 : ld.kind === "triangular" ? ld.w2 : ld.w2;
  const wx = ((w1 + w2) / 2) * g.x;
  const wy = ((w1 + w2) / 2) * g.y;
  const wz = ((w1 + w2) / 2) * g.z;
  addGlobalDist(fe, axes, wx, wy, wz, L);
  if (ld.kind === "triangular" || ld.kind === "trapezoidal" || ld.kind === "asimetrico") {
    const dw = w2 - w1;
    if (Math.abs(dw) > 1e-12) {
      const gx = (dw / 2) * g.x;
      const gy = (dw / 2) * g.y;
      const gz = (dw / 2) * g.z;
      const t2 = gx * axes.ey.x + gy * axes.ey.y + gz * axes.ey.z;
      const t3 = gx * axes.ez.x + gy * axes.ez.y + gz * axes.ez.z;
      fe[1] += (t2 * L * 1) / 10;
      fe[7] += (t2 * L * 4) / 10;
      fe[5] += (t2 * L * L) / 30;
      fe[11] += -(t2 * L * L) / 20;
      fe[2] += (t3 * L) / 10;
      fe[8] += (t3 * L * 4) / 10;
      fe[4] += -(t3 * L * L) / 30;
      fe[10] += (t3 * L * L) / 20;
    }
  }
}

function polygonArea(pts: { x: number; y: number }[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
}

function slabLoads(p: BuildingProject, patternId: string) {
  const nodal = new Map<string, { fx: number; fy: number; fz: number }>();
  const add = (id: string, fx: number, fy: number, fz: number) => {
    const v = nodal.get(id) ?? { fx: 0, fy: 0, fz: 0 };
    v.fx += fx;
    v.fy += fy;
    v.fz += fz;
    nodal.set(id, v);
  };
  const pat = p.patterns.find((x) => x.id === patternId);
  for (const slab of p.slabs) {
    const nodes = slab.nodeIds.map((id) => nodeOf(p, id)).filter((n): n is Node => !!n);
    if (nodes.length < 3) continue;
    const sec = p.slabSections.find((s) => s.id === slab.sectionId);
    const mat = sec ? matOf(p, sec.materialId) : matOf(p, "C210");
    const area = polygonArea(nodes);
    const share = 1 / nodes.length;
    const sw = p.selfWeight ?? { enabled: true, multiplier: 1, columns: true, beams: true, walls: true, slabs: true, stairs: true };
    const swK = sw.enabled && sw.slabs ? Math.max(0, sw.multiplier) : 0;
    if (pat?.selfWeight && sec && swK > 0) {
      const W = mat.gamma * sec.t * area * swK;
      for (const n of nodes) add(n.id, 0, 0, -W * share);
    }
    for (const ld of p.loads.filter((l) => l.patternId === patternId && l.target === "slab" && l.targetId === slab.id)) {
      const w = ld.kind === "asimetrico" ? (ld.w1 + ld.w2) / 2 : ld.w1;
      const g = ld.dir === "GX" ? [w * area, 0, 0] : ld.dir === "GY" ? [0, w * area, 0] : [0, 0, w * area];
      if (ld.kind === "asimetrico") {
        const n = nodes.length;
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 1 : i / (n - 1);
          const wi = ld.w1 + (ld.w2 - ld.w1) * t;
          add(nodes[i].id, (g[0] / w) * wi * share, (g[1] / w) * wi * share, (g[2] / w) * wi * share);
        }
      } else {
        for (const nd of nodes) add(nd.id, g[0] * share, g[1] * share, g[2] * share);
      }
    }
  }
  for (const stair of p.stairs) {
    const a = nodeOf(p, stair.nI);
    const b = nodeOf(p, stair.nJ);
    if (!a || !b) continue;
    const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const mat = matOf(p, stair.materialId);
    const sw = p.selfWeight ?? { enabled: true, multiplier: 1, columns: true, beams: true, walls: true, slabs: true, stairs: true };
    const swK = sw.enabled && sw.stairs ? Math.max(0, sw.multiplier) : 0;
    if (pat?.selfWeight && swK > 0) {
      const W = mat.gamma * stair.width * stair.t * L * swK;
      add(a.id, 0, 0, -W / 2);
      add(b.id, 0, 0, -W / 2);
    }
  }
  return nodal;
}

function assembleShell(p: BuildingProject, K: Float64Array[], dof: ReturnType<typeof buildDof>) {
  for (const slab of p.slabs) {
    const sec = p.slabSections.find((s) => s.id === slab.sectionId);
    if (!sec || sec.kind === "membrane" && slab.diaphragm === "rigido") continue;
    const nodes = slab.nodeIds.map((id) => nodeOf(p, id)).filter((n): n is Node => !!n);
    if (nodes.length < 3) continue;
    const mat = matOf(p, sec.materialId);
    const E = E_tm2(mat.E);
    const nu = mat.nu;
    const t = sec.t;
    const thick = sec.kind === "shellThick";
    const membraneOnly = sec.kind === "membrane";
    for (let i = 1; i < nodes.length - 1; i++) {
      const tri = [nodes[0], nodes[i], nodes[i + 1]];
      addTriangle(K, dof, tri, E, nu, t, thick, membraneOnly);
    }
  }
}

function addTriangle(
  K: Float64Array[],
  dof: ReturnType<typeof buildDof>,
  tri: Node[],
  E: number,
  nu: number,
  t: number,
  thick: boolean,
  membraneOnly: boolean
) {
  const [n1, n2, n3] = tri;
  const x21 = n2.x - n1.x;
  const y21 = n2.y - n1.y;
  const x31 = n3.x - n1.x;
  const y31 = n3.y - n1.y;
  const twoA = x21 * y31 - x31 * y21;
  const A = Math.abs(twoA) / 2;
  if (A < 1e-10) return;
  const s = Math.sign(twoA) || 1;
  const b1 = s * (n2.y - n3.y);
  const b2 = s * (n3.y - n1.y);
  const b3 = s * (n1.y - n2.y);
  const c1 = s * (n3.x - n2.x);
  const c2 = s * (n1.x - n3.x);
  const c3 = s * (n2.x - n1.x);
  const Em = E / (1 - nu * nu);
  const D = [
    [Em, Em * nu, 0],
    [Em * nu, Em, 0],
    [0, 0, Em * (1 - nu) / 2],
  ];
  const B = [
    [b1, 0, b2, 0, b3, 0],
    [0, c1, 0, c2, 0, c3],
    [c1, b1, c2, b2, c3, b3],
  ].map((row) => row.map((v) => v / (2 * A)));
  const km = zeros(6);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      let s2 = 0;
      for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) s2 += B[p][i] * D[p][q] * B[q][j];
      km[i][j] = s2 * t * A;
    }
  }
  const memDof = [0, 1];
  const ns = [n1, n2, n3];
  for (let a = 0; a < 3; a++) {
    for (let ia = 0; ia < 2; ia++) {
      const ra = dof.map(ns[a], memDof[ia]);
      for (let b = 0; b < 3; b++) {
        for (let ib = 0; ib < 2; ib++) {
          const rb = dof.map(ns[b], memDof[ib]);
          const kij = km[a * 2 + ia][b * 2 + ib];
          for (const u of ra) for (const v of rb) K[u.eq][v.eq] += u.c * v.c * kij;
        }
      }
    }
  }
  if (membraneOnly) return;
  const I = (t ** 3) / 12;
  const G = E / (2 * (1 + nu));
  const ks = thick ? (5 / 6) * G * t : (5 / 6) * G * t * 0.15;
  const Lf = [Math.hypot(n2.x - n1.x, n2.y - n1.y), Math.hypot(n3.x - n2.x, n3.y - n2.y), Math.hypot(n1.x - n3.x, n1.y - n3.y)];
  const kb = (E * I * A) / Math.max(A, 1e-6);
  const platePairs: [number, number][] = [
    [2, 2],
    [3, 3],
    [4, 4],
  ];
  for (let a = 0; a < 3; a++) {
    for (const [da] of platePairs) {
      const ra = dof.map(ns[a], da);
      const kdiag = da === 2 ? ks * A / 3 : kb / 3;
      for (const u of ra) K[u.eq][u.eq] += u.c * u.c * kdiag;
    }
    const nb = ns[(a + 1) % 3];
    const L = Lf[a] || 1;
    const kbeam = (12 * E * I) / L ** 3;
    const ra = dof.map(ns[a], 2);
    const rb = dof.map(nb, 2);
    for (const u of ra) {
      for (const v of ra) K[u.eq][v.eq] += u.c * v.c * kbeam;
      for (const v of rb) K[u.eq][v.eq] -= u.c * v.c * kbeam;
    }
    for (const u of rb) for (const v of rb) K[u.eq][v.eq] += u.c * v.c * kbeam;
  }
}

function nodeLoads(p: BuildingProject, patternId: string) {
  const map = new Map<string, number[]>();
  const add = (id: string, d: number, v: number) => {
    const row = map.get(id) ?? [0, 0, 0, 0, 0, 0];
    row[d] += v;
    map.set(id, row);
  };
  for (const ld of p.loads.filter((l) => l.patternId === patternId && l.target === "node")) {
    const d = ld.dir === "GX" ? 0 : ld.dir === "GY" ? 1 : 2;
    add(ld.targetId, d, ld.P || ld.w1);
  }
  return map;
}

function recoverForces(p: BuildingProject, U: Float64Array, dof: ReturnType<typeof buildDof>, patternId: string): MemberResult[] {
  const out: MemberResult[] = [];
  for (const frame of p.frames) {
    const pack = frameSection(p, frame);
    const a = nodeOf(p, frame.nI);
    const b = nodeOf(p, frame.nJ);
    if (!pack || !a || !b) continue;
    const axes = localAxes(a, b, frame.angle);
    if (axes.L < 1e-9) continue;
    const { A, Iy, Iz, J } = sectionProps(pack.sec);
    const E = E_tm2(pack.mat.E) * (frame.sectionId.startsWith("__RIGID__") ? 40 : 1);
    const G = E / (2 * (1 + pack.mat.nu));
    let kL = kLocal(E, G, A, Iy, Iz, J, axes.L);
    kL = applyReleases(kL, frame);
    const R = R3(axes.ex, axes.ey, axes.ez);
    const { T } = kGlobal(kL, R);
    const ug = new Array(12).fill(0);
    for (let d = 0; d < 6; d++) {
      for (const r of dof.map(a, d)) ug[d] += r.c * U[r.eq];
      for (const r of dof.map(b, d)) ug[6 + d] += r.c * U[r.eq];
    }
    const ul = new Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      let s = 0;
      for (let j = 0; j < 12; j++) s += T[j][i] * ug[j];
      ul[i] = s;
    }
    const fl = mul12(kL, ul);
    const fe = frameFixedEnd(p, frame, patternId, axes, pack.sec, pack.mat);
    for (let i = 0; i < 12; i++) fl[i] -= fe[i];
    const iF: EndForces = { P: fl[0], V2: fl[1], V3: fl[2], T: fl[3], M2: fl[4], M3: fl[5] };
    const jF: EndForces = { P: fl[6], V2: fl[7], V3: fl[8], T: fl[9], M2: fl[10], M3: fl[11] };
    out.push({
      id: frame.id,
      kind: frame.kind,
      storyId: frame.storyId,
      pierId: frame.pierId,
      i: iF,
      j: jF,
      Pmax: Math.max(Math.abs(iF.P), Math.abs(jF.P)),
      V2max: Math.max(Math.abs(iF.V2), Math.abs(jF.V2)),
      V3max: Math.max(Math.abs(iF.V3), Math.abs(jF.V3)),
      M2max: Math.max(Math.abs(iF.M2), Math.abs(jF.M2)),
      M3max: Math.max(Math.abs(iF.M3), Math.abs(jF.M3)),
    });
  }
  return out;
}

function pierResultants(p: BuildingProject, members: MemberResult[]): PierResultant[] {
  const groups = new Map<string, MemberResult[]>();
  for (const m of members.filter((x) => x.kind === "pierStrip" && x.pierId)) {
    const key = `${m.pierId}|${m.storyId}`;
    const arr = groups.get(key) ?? [];
    arr.push(m);
    groups.set(key, arr);
  }
  const out: PierResultant[] = [];
  for (const [key, arr] of groups) {
    const [pierId, storyId] = key.split("|");
    const pier = p.piers.find((x) => x.id === pierId);
    const acc = { P: 0, V2: 0, V3: 0, T: 0, M2: 0, M3: 0 };
    for (const m of arr) {
      acc.P += m.i.P;
      acc.V2 += m.i.V2;
      acc.V3 += m.i.V3;
      acc.T += m.i.T;
      acc.M2 += m.i.M2;
      acc.M3 += m.i.M3;
    }
    out.push({ pierId, storyId, name: pier?.name ?? pierId, ...acc });
  }
  return out;
}

function reactionsOf(p: BuildingProject, members: MemberResult[]): Reaction[] {
  const map = new Map<string, Reaction>();
  const add = (nodeId: string, fx: number, fy: number, fz: number, mx: number, my: number, mz: number) => {
    const r = map.get(nodeId) ?? { nodeId, fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 };
    r.fx += fx;
    r.fy += fy;
    r.fz += fz;
    r.mx += mx;
    r.my += my;
    r.mz += mz;
    map.set(nodeId, r);
  };
  for (const f of p.frames) {
    const m = members.find((x) => x.id === f.id);
    const a = nodeOf(p, f.nI);
    const b = nodeOf(p, f.nJ);
    if (!m || !a || !b) continue;
    const axes = localAxes(a, b, f.angle);
    const R = R3(axes.ex, axes.ey, axes.ez);
    const Fi = [m.i.P, m.i.V2, m.i.V3];
    const Fj = [m.j.P, m.j.V2, m.j.V3];
    const Mi = [m.i.T, m.i.M2, m.i.M3];
    const Mj = [m.j.T, m.j.M2, m.j.M3];
    const gi = [0, 0, 0];
    const gj = [0, 0, 0];
    const gmi = [0, 0, 0];
    const gmj = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        gi[i] += R[i][j] * Fi[j];
        gj[i] += R[i][j] * Fj[j];
        gmi[i] += R[i][j] * Mi[j];
        gmj[i] += R[i][j] * Mj[j];
      }
    }
    if (p.supports.some((s) => s.nodeId === a.id && s.kind !== "nudo")) add(a.id, -gi[0], -gi[1], -gi[2], -gmi[0], -gmi[1], -gmi[2]);
    if (p.supports.some((s) => s.nodeId === b.id && s.kind !== "nudo")) add(b.id, -gj[0], -gj[1], -gj[2], -gmj[0], -gmj[1], -gmj[2]);
  }
  return [...map.values()];
}

function analyzeFoundation(p: BuildingProject, reactions: Reaction[]): FootingResult[] {
  const qAdm = p.qAdm;
  const out: FootingResult[] = [];
  const wallBase = new Set<string>();
  for (const w of p.walls) {
    const a = nodeOf(p, w.nI);
    const b = nodeOf(p, w.nJ);
    if (!a || !b) continue;
    const below = p.nodes.filter((n) => n.z < 0.03 && onSegment(n.x, n.y, a.x, a.y, b.x, b.y));
    for (const n of below) wallBase.add(n.id);
  }
  const used = new Set<string>();
  for (const w of p.walls) {
    const a = nodeOf(p, w.nI);
    const b = nodeOf(p, w.nJ);
    if (!a || !b) continue;
    const bases = p.nodes.filter((n) => n.z < 0.03 && onSegment(n.x, n.y, a.x, a.y, b.x, b.y));
    const recs = reactions.filter((r) => bases.some((n) => n.id === r.nodeId));
    if (!recs.length) continue;
    recs.forEach((r) => used.add(r.nodeId));
    const P = recs.reduce((s, r) => s + Math.max(-r.fz, 0), 0);
    const Mx = recs.reduce((s, r) => s + r.my, 0);
    const My = recs.reduce((s, r) => s + r.mx, 0);
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const B = Math.max(0.4, Math.ceil((P / Math.max(qAdm * L, 1e-6)) * 20) / 20);
    const qmax = P / (B * L) + (6 * Math.abs(Mx)) / (B * L * L) + (6 * Math.abs(My)) / (B * B * L);
    const qmin = P / (B * L) - (6 * Math.abs(Mx)) / (B * L * L) - (6 * Math.abs(My)) / (B * B * L);
    out.push({
      nodeId: recs[0].nodeId,
      kind: "corrida",
      P,
      Mx,
      My,
      B,
      L,
      qmax,
      qmin,
      qAdm,
      eX: P > 1e-6 ? Mx / P : 0,
      eY: P > 1e-6 ? My / P : 0,
      ok: qmax <= qAdm * 1.001 && qmin >= -0.05 * qAdm,
      note: `Zapata corrida del muro ${w.id}. Cada extremo y subdivisión apoyado.`,
    });
  }
  for (const r of reactions) {
    if (used.has(r.nodeId) || wallBase.has(r.nodeId)) continue;
    const P = Math.max(-r.fz, 0);
    const Mx = r.my;
    const My = r.mx;
    const Areq = P / Math.max(qAdm, 1e-6);
    let B = Math.max(0.6, Math.ceil(Math.sqrt(Areq) * 20) / 20);
    let L = B;
    const eX = P > 1e-6 ? Mx / P : 0;
    const eY = P > 1e-6 ? My / P : 0;
    if (Math.abs(eX) > L / 6) L = Math.ceil((6 * Math.abs(eX) + 0.1) * 20) / 20;
    if (Math.abs(eY) > B / 6) B = Math.ceil((6 * Math.abs(eY) + 0.1) * 20) / 20;
    const qmax = P / (B * L) * (1 + 6 * Math.abs(eX) / L + 6 * Math.abs(eY) / B);
    const qmin = P / (B * L) * (1 - 6 * Math.abs(eX) / L - 6 * Math.abs(eY) / B);
    out.push({
      nodeId: r.nodeId,
      kind: "aislada",
      P,
      Mx,
      My,
      B,
      L,
      qmax,
      qmin,
      qAdm,
      eX,
      eY,
      ok: qmax <= qAdm * 1.001 && qmin >= -0.05 * qAdm,
      note: "Zapata aislada bajo columna. Cargas transmitidas tras el análisis del pórtico.",
    });
  }
  return out;
}

function onSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 1e-9) return Math.hypot(x - x1, y - y1) < 0.08;
  const t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / (L * L);
  if (t < -0.02 || t > 1.02) return false;
  const px = x1 + t * (x2 - x1);
  const py = y1 + t * (y2 - y1);
  return Math.hypot(x - px, y - py) < 0.08;
}

function solvePattern(p: BuildingProject, patternId: string) {
  const dof = buildDof(p);
  const K = zeros(dof.n);
  const F = vec(dof.n);
  for (const frame of p.frames) {
    const pack = frameSection(p, frame);
    const a = nodeOf(p, frame.nI);
    const b = nodeOf(p, frame.nJ);
    if (!pack || !a || !b) continue;
    const axes = localAxes(a, b, frame.angle);
    if (axes.L < 1e-9) continue;
    const { A, Iy, Iz, J } = sectionProps(pack.sec);
    const E = E_tm2(pack.mat.E) * (frame.sectionId.startsWith("__RIGID__") ? 40 : 1);
    const G = E / (2 * (1 + pack.mat.nu));
    let kL = kLocal(E, G, A, Iy, Iz, J, axes.L);
    kL = applyReleases(kL, frame);
    const R = R3(axes.ex, axes.ey, axes.ez);
    let { KG } = kGlobal(kL, R);
    KG = applyOffset(KG, a, b, frame, axes);
    const fe = frameFixedEnd(p, frame, patternId, axes, pack.sec, pack.mat);
    const feG = new Array(12).fill(0);
    const T = TfromR(R);
    for (let i = 0; i < 12; i++) {
      let s = 0;
      for (let j = 0; j < 12; j++) s += T[i][j] * fe[j];
      feG[i] = s;
    }
    const nodes = [a, b];
    for (let ia = 0; ia < 2; ia++) {
      for (let da = 0; da < 6; da++) {
        const ra = dof.map(nodes[ia], da);
        const i = ia * 6 + da;
        for (const u of ra) F[u.eq] += u.c * feG[i];
        for (let ib = 0; ib < 2; ib++) {
          for (let db = 0; db < 6; db++) {
            const rb = dof.map(nodes[ib], db);
            const j = ib * 6 + db;
            assembleAdd(K, F, ra, rb, KG[i][j], 0);
          }
        }
      }
    }
  }
  assembleShell(p, K, dof);
  const area = slabLoads(p, patternId);
  for (const [id, v] of area) {
    const n = nodeOf(p, id);
    if (!n) continue;
    for (const r of dof.map(n, 0)) F[r.eq] += r.c * v.fx;
    for (const r of dof.map(n, 1)) F[r.eq] += r.c * v.fy;
    for (const r of dof.map(n, 2)) F[r.eq] += r.c * v.fz;
  }
  const nl = nodeLoads(p, patternId);
  for (const [id, row] of nl) {
    const n = nodeOf(p, id);
    if (!n) continue;
    for (let d = 0; d < 6; d++) for (const r of dof.map(n, d)) F[r.eq] += r.c * row[d];
  }
  for (let i = 0; i < dof.n; i++) if (Math.abs(K[i][i]) < 1e-10) K[i][i] = 1;
  const U = solveDense(K, F);
  return { U, dof };
}

function combineVec(parts: { U: Float64Array | null; factor: number }[], n: number) {
  const U = vec(n);
  for (const p of parts) {
    if (!p.U) continue;
    for (let i = 0; i < n; i++) U[i] += p.factor * p.U[i];
  }
  return U;
}

function nodeDisps(p: BuildingProject, U: Float64Array, dof: ReturnType<typeof buildDof>) {
  return p.nodes.map((n) => {
    const u = [0, 0, 0, 0, 0, 0];
    for (let d = 0; d < 6; d++) for (const r of dof.map(n, d)) u[d] += r.c * U[r.eq];
    return { id: n.id, ux: u[0], uy: u[1], uz: u[2], rx: u[3], ry: u[4], rz: u[5] };
  });
}

export function analizar(p: BuildingProject): AnalysisResult {
  const t0 = performance.now();
  snapSupportsToFoundation(p);
  if (!p.nodes.length || !p.frames.length) {
    return { ok: false, message: "No hay pórtico que analizar. Coloque columnas y vigas.", combos: [] };
  }
  if (!p.supports.length) {
    return { ok: false, message: "No hay apoyos. En la base debe existir al menos un apoyo móvil o empotrado.", combos: [] };
  }
  const patterns: Record<string, ReturnType<typeof solvePattern>> = {};
  try {
    for (const pat of p.patterns) {
      const sol = solvePattern(p, pat.id);
      if (!sol.U) return { ok: false, message: `Sistema singular en ${pat.id}. Revise apoyos, diafragmas o elementos sueltos.`, combos: [] };
      patterns[pat.id] = sol;
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Error en el ensamblaje.", combos: [] };
  }
  const n = Object.values(patterns)[0]?.dof.n ?? 0;
  const combos: ComboResult[] = [];
  for (const c of p.combinations) {
    const parts = Object.entries(c.factors).map(([id, factor]) => ({ U: patterns[id]?.U ?? null, factor }));
    const U = combineVec(parts, n);
    const dof = Object.values(patterns)[0].dof;
    const membersMix: MemberResult[] = [];
    const memberMap = new Map<string, MemberResult>();
    for (const [id, factor] of Object.entries(c.factors)) {
      const sol = patterns[id];
      if (!sol?.U) continue;
      const ms = recoverForces(p, sol.U, sol.dof, id);
      for (const m of ms) {
        const acc = memberMap.get(m.id);
        if (!acc) {
          memberMap.set(m.id, scaleMember(m, factor));
        } else {
          addMember(acc, m, factor);
        }
      }
    }
    for (const m of memberMap.values()) membersMix.push(m);
    const reactions = reactionsOf(p, membersMix);
    combos.push({
      comboId: c.id,
      name: c.name,
      nodes: nodeDisps(p, U, dof),
      members: membersMix,
      reactions,
      piers: pierResultants(p, membersMix),
      footings: analyzeFoundation(p, reactions),
      periodNote: "Estático lineal — método de rigideces 3D. Sin modal en esta pasada.",
      nDof: n,
      nNodes: p.nodes.length,
      elapsedMs: 0,
    });
  }
  const elapsed = performance.now() - t0;
  for (const c of combos) c.elapsedMs = elapsed;
  return {
    ok: true,
    message: `Análisis matricial 3D listo · ${n} GDL · ${p.nodes.length} nudos · ${elapsed.toFixed(0)} ms`,
    combos,
  };
}

function scaleMember(m: MemberResult, f: number): MemberResult {
  const s = (e: EndForces): EndForces => ({ P: e.P * f, V2: e.V2 * f, V3: e.V3 * f, T: e.T * f, M2: e.M2 * f, M3: e.M3 * f });
  const i = s(m.i);
  const j = s(m.j);
  return {
    ...m,
    i,
    j,
    Pmax: Math.max(Math.abs(i.P), Math.abs(j.P)),
    V2max: Math.max(Math.abs(i.V2), Math.abs(j.V2)),
    V3max: Math.max(Math.abs(i.V3), Math.abs(j.V3)),
    M2max: Math.max(Math.abs(i.M2), Math.abs(j.M2)),
    M3max: Math.max(Math.abs(i.M3), Math.abs(j.M3)),
  };
}

function addMember(acc: MemberResult, m: MemberResult, f: number) {
  const addE = (a: EndForces, b: EndForces) => {
    a.P += b.P * f;
    a.V2 += b.V2 * f;
    a.V3 += b.V3 * f;
    a.T += b.T * f;
    a.M2 += b.M2 * f;
    a.M3 += b.M3 * f;
  };
  addE(acc.i, m.i);
  addE(acc.j, m.j);
  acc.Pmax = Math.max(Math.abs(acc.i.P), Math.abs(acc.j.P));
  acc.V2max = Math.max(Math.abs(acc.i.V2), Math.abs(acc.j.V2));
  acc.V3max = Math.max(Math.abs(acc.i.V3), Math.abs(acc.j.V3));
  acc.M2max = Math.max(Math.abs(acc.i.M2), Math.abs(acc.j.M2));
  acc.M3max = Math.max(Math.abs(acc.i.M3), Math.abs(acc.j.M3));
}
