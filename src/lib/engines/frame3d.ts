/**
 * Motor de análisis matricial — método de la rigidez directa (Direct Stiffness
 * Method) para pórticos espaciales (3D). Formulación estándar de elemento
 * viga-columna de 12 GDL (Przemieniecki / McGuire-Gallagher-Fenves).
 * Unidades consistentes en toda la sesión de la app: t (fuerza), m (longitud).
 */

export type Node3D = { id: number; x: number; y: number; z: number; fixed?: boolean };

export type Element3D = {
  n1: number;
  n2: number;
  E: number;
  G: number;
  A: number;
  Iy: number;
  Iz: number;
  J: number;
  /** Multiplicador de rigidez (>>1 simula un enlace rígido; 1 = elemento real). */
  stiffMult?: number;
};

export type NodalLoad = { node: number; fx?: number; fy?: number; fz?: number; mx?: number; my?: number; mz?: number };

export type ElementForces = {
  N1: number; Vy1: number; Vz1: number; T1: number; My1: number; Mz1: number;
  N2: number; Vy2: number; Vz2: number; T2: number; My2: number; Mz2: number;
};

function zeros(n: number, m: number): number[][] {
  return Array.from({ length: n }, () => new Array(m).fill(0));
}

function localStiffness12(L: number, E: number, G: number, A: number, Iy: number, Iz: number, J: number): number[][] {
  const k = zeros(12, 12);
  const EAL = (E * A) / L;
  const GJL = (G * J) / L;
  const EIz = E * Iz, EIy = E * Iy;
  const L2 = L * L, L3 = L * L * L;

  k[0][0] = EAL; k[6][6] = EAL; k[0][6] = -EAL; k[6][0] = -EAL;
  k[3][3] = GJL; k[9][9] = GJL; k[3][9] = -GJL; k[9][3] = -GJL;

  // Flexión en el plano local x-y (usa Iz; DOF v=1,7 y θz=5,11)
  k[1][1] = (12 * EIz) / L3; k[7][7] = (12 * EIz) / L3; k[1][7] = -(12 * EIz) / L3; k[7][1] = -(12 * EIz) / L3;
  k[1][5] = (6 * EIz) / L2; k[5][1] = (6 * EIz) / L2; k[1][11] = (6 * EIz) / L2; k[11][1] = (6 * EIz) / L2;
  k[7][5] = -(6 * EIz) / L2; k[5][7] = -(6 * EIz) / L2; k[7][11] = -(6 * EIz) / L2; k[11][7] = -(6 * EIz) / L2;
  k[5][5] = (4 * EIz) / L; k[11][11] = (4 * EIz) / L; k[5][11] = (2 * EIz) / L; k[11][5] = (2 * EIz) / L;

  // Flexión en el plano local x-z (usa Iy; DOF w=2,8 y θy=4,10)
  k[2][2] = (12 * EIy) / L3; k[8][8] = (12 * EIy) / L3; k[2][8] = -(12 * EIy) / L3; k[8][2] = -(12 * EIy) / L3;
  k[2][4] = -(6 * EIy) / L2; k[4][2] = -(6 * EIy) / L2; k[2][10] = -(6 * EIy) / L2; k[10][2] = -(6 * EIy) / L2;
  k[8][4] = (6 * EIy) / L2; k[4][8] = (6 * EIy) / L2; k[8][10] = (6 * EIy) / L2; k[10][8] = (6 * EIy) / L2;
  k[4][4] = (4 * EIy) / L; k[10][10] = (4 * EIy) / L; k[4][10] = (2 * EIy) / L; k[10][4] = (2 * EIy) / L;

  return k;
}

/** Matriz de rotación 3x3 (ejes locales expresados en globales), luego expandida a 12x12 por bloques. */
function rotation3(n1: Node3D, n2: Node3D): number[][] {
  const dx = n2.x - n1.x, dy = n2.y - n1.y, dz = n2.z - n1.z;
  const L = Math.hypot(dx, dy, dz) || 1e-9;
  const ex = [dx / L, dy / L, dz / L];
  const ref = Math.abs(ex[2]) < 0.999 ? [0, 0, 1] : [1, 0, 0];
  const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (v: number[]) => { const n = Math.hypot(v[0], v[1], v[2]) || 1e-9; return [v[0] / n, v[1] / n, v[2] / n]; };
  const ey = norm(cross(ref, ex));
  const ez = norm(cross(ex, ey));
  return [ex, ey, ez];
}

function expandRotation(R3: number[][]): number[][] {
  const T = zeros(12, 12);
  for (let b = 0; b < 4; b++) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        T[b * 3 + i][b * 3 + j] = R3[i][j];
      }
    }
  }
  return T;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length, m = B[0].length, p = B.length;
  const C = zeros(n, m);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < p; k++) {
      const a = A[i][k];
      if (a === 0) continue;
      for (let j = 0; j < m; j++) C[i][j] += a * B[k][j];
    }
  }
  return C;
}

function transpose(A: number[][]): number[][] {
  const n = A.length, m = A[0].length;
  const T = zeros(m, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) T[j][i] = A[i][j];
  return T;
}

/** Resuelve A x = b por eliminación gaussiana con pivoteo parcial. */
function solveLinear(Ain: number[][], bin: number[]): number[] {
  const n = Ain.length;
  const A = Ain.map((r) => r.slice());
  const b = bin.slice();
  for (let col = 0; col < n; col++) {
    let piv = col;
    let best = Math.abs(A[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > best) { best = Math.abs(A[r][col]); piv = r; }
    }
    if (piv !== col) { [A[col], A[piv]] = [A[piv], A[col]]; [b[col], b[piv]] = [b[piv], b[col]]; }
    const d = A[col][col];
    if (Math.abs(d) < 1e-12) continue;
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / d;
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < n; c++) s -= A[r][c] * x[c];
    x[r] = Math.abs(A[r][r]) < 1e-12 ? 0 : s / A[r][r];
  }
  return x;
}

export type FrameResult = {
  disp: Map<number, number[]>;
  forces: ElementForces[];
};

/** Ensambla y resuelve el pórtico espacial completo por rigidez directa. */
export function solveFrame3D(nodes: Node3D[], elements: Element3D[], loads: NodalLoad[]): FrameResult {
  const idOf = new Map(nodes.map((n, i) => [n.id, i]));
  const ndof = nodes.length * 6;
  const K = zeros(ndof, ndof);
  const F = new Array(ndof).fill(0);

  const elemData = elements.map((el) => {
    const n1 = nodes[idOf.get(el.n1)!];
    const n2 = nodes[idOf.get(el.n2)!];
    const L = Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z);
    const mult = el.stiffMult ?? 1;
    const kLocal = localStiffness12(L, el.E * mult, el.G * mult, el.A, el.Iy, el.Iz, el.J);
    const R3 = rotation3(n1, n2);
    const T = expandRotation(R3);
    const Tt = transpose(T);
    const kGlobal = matMul(matMul(Tt, kLocal), T);
    return { n1, n2, L, T, kLocal, kGlobal };
  });

  elements.forEach((el, ei) => {
    const i1 = idOf.get(el.n1)!;
    const i2 = idOf.get(el.n2)!;
    const map = [...Array(6).keys()].map((d) => i1 * 6 + d).concat([...Array(6).keys()].map((d) => i2 * 6 + d));
    const kg = elemData[ei].kGlobal;
    for (let a = 0; a < 12; a++) {
      for (let bb = 0; bb < 12; bb++) {
        K[map[a]][map[bb]] += kg[a][bb];
      }
    }
  });

  loads.forEach((ld) => {
    const i = idOf.get(ld.node);
    if (i === undefined) return;
    F[i * 6 + 0] += ld.fx ?? 0;
    F[i * 6 + 1] += ld.fy ?? 0;
    F[i * 6 + 2] += ld.fz ?? 0;
    F[i * 6 + 3] += ld.mx ?? 0;
    F[i * 6 + 4] += ld.my ?? 0;
    F[i * 6 + 5] += ld.mz ?? 0;
  });

  const fixedDof = new Set<number>();
  nodes.forEach((n, i) => {
    if (n.fixed) for (let d = 0; d < 6; d++) fixedDof.add(i * 6 + d);
  });
  const freeIdx: number[] = [];
  for (let i = 0; i < ndof; i++) if (!fixedDof.has(i)) freeIdx.push(i);

  const Kr = freeIdx.map((r) => freeIdx.map((c) => K[r][c]));
  const Fr = freeIdx.map((r) => F[r]);
  const ur = solveLinear(Kr, Fr);

  const u = new Array(ndof).fill(0);
  freeIdx.forEach((gi, li) => { u[gi] = ur[li]; });

  const disp = new Map<number, number[]>();
  nodes.forEach((n, i) => disp.set(n.id, u.slice(i * 6, i * 6 + 6)));

  const forces: ElementForces[] = elements.map((el, ei) => {
    const i1 = idOf.get(el.n1)!;
    const i2 = idOf.get(el.n2)!;
    const uGlobal = [...u.slice(i1 * 6, i1 * 6 + 6), ...u.slice(i2 * 6, i2 * 6 + 6)];
    const T = elemData[ei].T;
    const uLocal = matMul(T, uGlobal.map((v) => [v])).map((r) => r[0]);
    const kLocal = elemData[ei].kLocal;
    const fLocal = matMul(kLocal, uLocal.map((v) => [v])).map((r) => r[0]);
    return {
      N1: -fLocal[0], Vy1: -fLocal[1], Vz1: -fLocal[2], T1: -fLocal[3], My1: -fLocal[4], Mz1: -fLocal[5],
      N2: fLocal[6], Vy2: fLocal[7], Vz2: fLocal[8], T2: fLocal[9], My2: fLocal[10], Mz2: fLocal[11],
    };
  });

  return { disp, forces };
}
