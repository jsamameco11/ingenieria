/**
 * Ensamblaje y resolución del sistema de elementos finitos.
 *
 * Almacenamiento skyline (perfil) con reordenamiento Cuthill–McKee inverso y
 * factorización LDL^T. La solución del sistema lineal es directa: no hay
 * tolerancias de convergencia iterativa.
 *
 * Los resortes de suelo pueden declararse `noTension`; en ese caso cada
 * combinación se resuelve con un lazo de contacto que desactiva los resortes
 * traccionados (despegue del talón). Con resortes no lineales la superposición
 * deja de ser válida, por eso cada combinación se resuelve con su propio vector
 * de carga ya factorizado.
 */

import { shellElementStiffness } from "./shell";

export type FemNode = { x: number; y: number; z: number };

/** Elemento lámina de 4 nodos con espesor y material propios. */
export type FemShell = {
  nodes: [number, number, number, number];
  t: number;
  E: number;
  nu: number;
  /** Etiqueta de zona para agrupar resultados (fuste, puntera, talón…). */
  zona: string;
};

/** Resorte concentrado nodal en dirección global (0..5 = u,v,w,θx,θy,θz). */
export type FemSpring = {
  node: number;
  dof: number;
  k: number;
  /** Solo trabaja a compresión (el desplazamiento positivo lo anula). */
  noTension?: boolean;
};

export type FemSupport = { node: number; dof: number };

export type FemModel = {
  nodes: FemNode[];
  shells: FemShell[];
  springs: FemSpring[];
  supports: FemSupport[];
};

export const NDOF = 6;

type Skyline = {
  /** Ecuación asignada a cada gdl global (−1 = restringido y eliminado). */
  eq: Int32Array;
  colHeight: Int32Array;
  diagIdx: Int32Array;
  n: number;
  size: number;
};

function adjacency(model: FemModel) {
  const n = model.nodes.length;
  const adj: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  for (const e of model.shells) {
    for (const a of e.nodes) for (const b of e.nodes) if (a !== b) adj[a].add(b);
  }
  return adj;
}

/** Cuthill–McKee inverso: reduce el ancho del perfil. */
function rcmOrder(model: FemModel) {
  const n = model.nodes.length;
  const adj = adjacency(model);
  const deg = adj.map((s) => s.size);
  const seen = new Uint8Array(n);
  const order: number[] = [];
  while (order.length < n) {
    let start = -1;
    for (let i = 0; i < n; i++) if (!seen[i] && (start < 0 || deg[i] < deg[start])) start = i;
    if (start < 0) break;
    const queue = [start];
    seen[start] = 1;
    for (let head = 0; head < queue.length; head++) {
      const v = queue[head];
      order.push(v);
      const nb = [...adj[v]].filter((w) => !seen[w]).sort((a, b) => deg[a] - deg[b]);
      for (const w of nb) {
        seen[w] = 1;
        queue.push(w);
      }
    }
  }
  order.reverse();
  const perm = Int32Array.from(order);
  const inv = new Int32Array(n);
  for (let i = 0; i < n; i++) inv[perm[i]] = i;
  return { perm, inv };
}

/**
 * Numera las ecuaciones en orden RCM eliminando los gdl restringidos, y calcula
 * el perfil. Eliminar en vez de penalizar mantiene el número de condición del
 * sistema en el rango de la propia rigidez (la rigidez ficticia de drilling es
 * ~1e−7 de la diagonal máxima, así que penalizar arruinaría la factorización).
 */
function buildSkyline(model: FemModel): Skyline {
  const { perm } = rcmOrder(model);
  const total = model.nodes.length * NDOF;
  const fixed = new Uint8Array(total);
  for (const s of model.supports) fixed[s.node * NDOF + s.dof] = 1;

  const eq = new Int32Array(total).fill(-1);
  let n = 0;
  for (const nd of perm) {
    for (let d = 0; d < NDOF; d++) {
      const g = nd * NDOF + d;
      if (!fixed[g]) eq[g] = n++;
    }
  }

  const colHeight = new Int32Array(n);
  for (const e of model.shells) {
    const g: number[] = [];
    for (const nd of e.nodes) {
      for (let d = 0; d < NDOF; d++) {
        const q = eq[nd * NDOF + d];
        if (q >= 0) g.push(q);
      }
    }
    for (const a of g) {
      for (const b of g) {
        const i = Math.max(a, b);
        const j = Math.min(a, b);
        if (i - j > colHeight[i]) colHeight[i] = i - j;
      }
    }
  }
  // La columna i ocupa [diagIdx[i] − colHeight[i], diagIdx[i]].
  const diagIdx = new Int32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += colHeight[i];
    diagIdx[i] = acc;
    acc += 1;
  }
  return { eq, colHeight, diagIdx, n, size: acc };
}

function factorLDL(sky: Skyline, values: Float64Array) {
  const { n, diagIdx, colHeight } = sky;
  for (let j = 0; j < n; j++) {
    const fj = j - colHeight[j];
    for (let i = fj; i < j; i++) {
      const fi = i - colHeight[i];
      const start = Math.max(fi, fj);
      let s = values[diagIdx[j] - (j - i)];
      for (let k = start; k < i; k++) {
        s -= values[diagIdx[i] - (i - k)] * values[diagIdx[j] - (j - k)] * values[diagIdx[k]];
      }
      values[diagIdx[j] - (j - i)] = s / values[diagIdx[i]];
    }
    let d = values[diagIdx[j]];
    for (let k = fj; k < j; k++) {
      const l = values[diagIdx[j] - (j - k)];
      d -= l * l * values[diagIdx[k]];
    }
    if (!Number.isFinite(d) || Math.abs(d) < 1e-30) return false;
    values[diagIdx[j]] = d;
  }
  return true;
}

function solveLDL(sky: Skyline, values: Float64Array, rhs: Float64Array) {
  const { n, diagIdx, colHeight } = sky;
  const y = Float64Array.from(rhs);
  for (let i = 0; i < n; i++) {
    let s = y[i];
    for (let k = i - colHeight[i]; k < i; k++) s -= values[diagIdx[i] - (i - k)] * y[k];
    y[i] = s;
  }
  for (let i = 0; i < n; i++) y[i] /= values[diagIdx[i]];
  for (let j = n - 1; j >= 0; j--) {
    const v = y[j];
    for (let k = j - colHeight[j]; k < j; k++) y[k] -= values[diagIdx[j] - (j - k)] * v;
  }
  return y;
}

/** Rigideces de elemento cacheadas por forma relativa + material. */
const kCache = new Map<string, Float64Array>();

function shellK(pts: FemNode[], e: FemShell): Float64Array {
  const p0 = pts[0];
  const key = [
    e.t.toFixed(6),
    e.E.toFixed(3),
    e.nu.toFixed(4),
    ...pts.flatMap((p) => [p.x - p0.x, p.y - p0.y, p.z - p0.z].map((v) => v.toFixed(6))),
  ].join("|");
  const hit = kCache.get(key);
  if (hit) return hit;
  const { K } = shellElementStiffness(pts, { E: e.E, nu: e.nu, t: e.t });
  if (kCache.size > 5000) kCache.clear();
  kCache.set(key, K);
  return K;
}

/** Modelo preparado: perfil y rigidez elástica ensamblada una sola vez. */
export type PreparedModel = {
  model: FemModel;
  sky: Skyline;
  base: Float64Array;
  maxDiag: number;
};

export function prepareModel(model: FemModel): PreparedModel {
  const sky = buildSkyline(model);
  const base = new Float64Array(sky.size);
  const add = (gi: number, gj: number, v: number) => {
    const i = Math.max(gi, gj);
    const j = Math.min(gi, gj);
    base[sky.diagIdx[i] - (i - j)] += v;
  };
  for (const e of model.shells) {
    const pts = e.nodes.map((i) => model.nodes[i]);
    const K = shellK(pts, e);
    const g: number[] = [];
    for (const nd of e.nodes) for (let d = 0; d < NDOF; d++) g.push(sky.eq[nd * NDOF + d]);
    for (let a = 0; a < 24; a++) {
      if (g[a] < 0) continue;
      for (let b = 0; b < 24; b++) {
        if (g[b] < 0 || g[b] > g[a]) continue;
        const v = K[a * 24 + b];
        if (v !== 0) add(g[a], g[b], v);
      }
    }
  }
  let maxDiag = 0;
  for (let i = 0; i < sky.n; i++) maxDiag = Math.max(maxDiag, base[sky.diagIdx[i]]);
  return { model, sky, base, maxDiag: maxDiag || 1 };
}

export type SolveResult = {
  /** Desplazamientos globales, 6 por nodo. */
  u: Float64Array;
  /** Fuerza de cada resorte (kN), positiva = compresión sobre la estructura. */
  springForce: number[];
  springActive: boolean[];
  iteraciones: number;
  /** Factorización correcta y lazo de contacto asentado (ningún resorte traccionado). */
  ok: boolean;
  /** El lazo unilateral dejó de cambiar de estado antes del tope de iteraciones. */
  contacto: boolean;
};

/** Resuelve K·u = f con lazo de contacto para los resortes sin tracción. */
export function solve(prep: PreparedModel, loads: Float64Array, maxIter = 20): SolveResult {
  const { model, sky, base } = prep;
  const ndofTotal = model.nodes.length * NDOF;
  const springActive = model.springs.map(() => true);
  let u = new Float64Array(ndofTotal);
  let ok = true;
  let contacto = true;
  let iteraciones = 0;

  const rhs = new Float64Array(sky.n);
  for (let g = 0; g < ndofTotal; g++) {
    const q = sky.eq[g];
    if (q >= 0) rhs[q] = loads[g];
  }

  for (let it = 0; it < maxIter; it++) {
    iteraciones = it + 1;
    const values = Float64Array.from(base);
    model.springs.forEach((s, i) => {
      if (!springActive[i]) return;
      const q = sky.eq[s.node * NDOF + s.dof];
      if (q >= 0) values[sky.diagIdx[q]] += s.k;
    });
    if (!factorLDL(sky, values)) {
      ok = false;
      break;
    }
    const y = solveLDL(sky, values, rhs);
    u = new Float64Array(ndofTotal);
    for (let g = 0; g < ndofTotal; g++) {
      const q = sky.eq[g];
      u[g] = q >= 0 ? y[q] : 0;
    }

    let cambio = false;
    model.springs.forEach((s, i) => {
      if (!s.noTension) return;
      const disp = u[s.node * NDOF + s.dof];
      if (springActive[i] && disp > 1e-9) {
        springActive[i] = false;
        cambio = true;
      } else if (!springActive[i] && disp < -1e-9) {
        springActive[i] = true;
        cambio = true;
      }
    });
    if (!cambio) break;
    if (it === maxIter - 1) {
      contacto = false;
      ok = false;
    }
  }

  const springForce = model.springs.map((s, i) =>
    springActive[i] ? -s.k * u[s.node * NDOF + s.dof] : 0,
  );
  return { u, springForce, springActive, iteraciones, ok, contacto };
}

/** Extrae los 24 desplazamientos globales de un elemento. */
export function elementDisp(u: Float64Array, nodes: readonly number[]) {
  const ue: number[] = [];
  for (const nd of nodes) for (let d = 0; d < NDOF; d++) ue.push(u[nd * NDOF + d]);
  return ue;
}
