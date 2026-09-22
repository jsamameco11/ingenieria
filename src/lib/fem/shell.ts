/**
 * Elemento lámina plana de 4 nodos (flat shell) = membrana Q4 en tensión plana
 * + flexión de placa MITC4 (Bathe–Dvorkin, deformación cortante supuesta, sin
 * bloqueo por cortante) + rigidez ficticia de giro normal (drilling).
 *
 * Convenio local: ex, ey en el plano del elemento; ez = normal.
 * Rotaciones de la normal: βx = θy, βy = −θx  (con u = z·βx, v = z·βy).
 * Momentos por unidad de longitud: M = Db·κ  →  M_xx > 0 tracciona la cara +z.
 */

export type Vec3 = { x: number; y: number; z: number };

export type ShellStress = {
  /** Momentos por unidad de longitud en ejes locales (kN·m/m). */
  mxx: number;
  myy: number;
  mxy: number;
  /** Cortantes por unidad de longitud (kN/m). */
  qx: number;
  qy: number;
};

const GP = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)];

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function dot(a: Vec3, b: Vec3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function norm(a: Vec3) {
  return Math.hypot(a.x, a.y, a.z);
}
function unit(a: Vec3): Vec3 {
  const n = norm(a) || 1;
  return { x: a.x / n, y: a.y / n, z: a.z / n };
}

/** Triedro local y coordenadas 2D del elemento (promedia la normal para cuads alabeados). */
export function localFrame(p: Vec3[]) {
  const d1 = sub(p[2], p[0]);
  const d2 = sub(p[3], p[1]);
  const ez = unit(cross(d1, d2));
  const e1 = unit(sub(p[1], p[0]));
  const ex = unit(sub(e1, { x: ez.x * dot(e1, ez), y: ez.y * dot(e1, ez), z: ez.z * dot(e1, ez) }));
  const ey = cross(ez, ex);
  const o = p[0];
  const xy = p.map((q) => {
    const r = sub(q, o);
    return { x: dot(r, ex), y: dot(r, ey) };
  });
  return { ex, ey, ez, o, xy };
}

function shapeAt(xi: number, eta: number) {
  const N = [
    0.25 * (1 - xi) * (1 - eta),
    0.25 * (1 + xi) * (1 - eta),
    0.25 * (1 + xi) * (1 + eta),
    0.25 * (1 - xi) * (1 + eta),
  ];
  const dNxi = [-0.25 * (1 - eta), 0.25 * (1 - eta), 0.25 * (1 + eta), -0.25 * (1 + eta)];
  const dNeta = [-0.25 * (1 - xi), -0.25 * (1 + xi), 0.25 * (1 + xi), 0.25 * (1 - xi)];
  return { N, dNxi, dNeta };
}

function jacobian(xy: { x: number; y: number }[], dNxi: number[], dNeta: number[]) {
  let j11 = 0;
  let j12 = 0;
  let j21 = 0;
  let j22 = 0;
  for (let i = 0; i < 4; i++) {
    j11 += dNxi[i] * xy[i].x;
    j12 += dNxi[i] * xy[i].y;
    j21 += dNeta[i] * xy[i].x;
    j22 += dNeta[i] * xy[i].y;
  }
  const det = j11 * j22 - j12 * j21;
  const inv = [j22 / det, -j12 / det, -j21 / det, j11 / det];
  return { j11, j12, j21, j22, det, inv };
}

/** Derivadas cartesianas de las funciones de forma. */
function dNxy(xy: { x: number; y: number }[], xi: number, eta: number) {
  const { dNxi, dNeta } = shapeAt(xi, eta);
  const J = jacobian(xy, dNxi, dNeta);
  const dx: number[] = [];
  const dy: number[] = [];
  for (let i = 0; i < 4; i++) {
    dx.push(J.inv[0] * dNxi[i] + J.inv[1] * dNeta[i]);
    dy.push(J.inv[2] * dNxi[i] + J.inv[3] * dNeta[i]);
  }
  return { dx, dy, det: J.det, J };
}

/** B de curvatura: κ = [∂βx/∂x, ∂βy/∂y, ∂βx/∂y + ∂βy/∂x] sobre (w, βx, βy). */
function bBending(xy: { x: number; y: number }[], xi: number, eta: number) {
  const { dx, dy, det } = dNxy(xy, xi, eta);
  const B = [new Float64Array(12), new Float64Array(12), new Float64Array(12)];
  for (let i = 0; i < 4; i++) {
    const c = i * 3;
    B[0][c + 1] = dx[i];
    B[1][c + 2] = dy[i];
    B[2][c + 1] = dy[i];
    B[2][c + 2] = dx[i];
  }
  return { B, det };
}

/**
 * B de cortante transversal MITC4 sobre (w, βx, βy).
 * γ_ξ se muestrea en A(0,−1) y C(0,+1); γ_η en D(−1,0) y B(+1,0).
 */
function bShearMITC(xy: { x: number; y: number }[], xi: number, eta: number) {
  const covariant = (xiT: number, etaT: number, which: "xi" | "eta") => {
    const { N, dNxi, dNeta } = shapeAt(xiT, etaT);
    const J = jacobian(xy, dNxi, dNeta);
    const row = new Float64Array(12);
    const dN = which === "xi" ? dNxi : dNeta;
    const xs = which === "xi" ? J.j11 : J.j21;
    const ys = which === "xi" ? J.j12 : J.j22;
    for (let i = 0; i < 4; i++) {
      const c = i * 3;
      row[c] += dN[i];
      row[c + 1] += N[i] * xs;
      row[c + 2] += N[i] * ys;
    }
    return row;
  };
  const gA = covariant(0, -1, "xi");
  const gC = covariant(0, 1, "xi");
  const gD = covariant(-1, 0, "eta");
  const gB = covariant(1, 0, "eta");

  const gXi = new Float64Array(12);
  const gEta = new Float64Array(12);
  for (let k = 0; k < 12; k++) {
    gXi[k] = 0.5 * (1 - eta) * gA[k] + 0.5 * (1 + eta) * gC[k];
    gEta[k] = 0.5 * (1 - xi) * gD[k] + 0.5 * (1 + xi) * gB[k];
  }

  const { dNxi, dNeta } = shapeAt(xi, eta);
  const J = jacobian(xy, dNxi, dNeta);
  const B = [new Float64Array(12), new Float64Array(12)];
  for (let k = 0; k < 12; k++) {
    B[0][k] = J.inv[0] * gXi[k] + J.inv[1] * gEta[k];
    B[1][k] = J.inv[2] * gXi[k] + J.inv[3] * gEta[k];
  }
  return { B, det: J.det };
}

/** B de membrana: ε = [∂u/∂x, ∂v/∂y, ∂u/∂y + ∂v/∂x] sobre (u, v). */
function bMembrane(xy: { x: number; y: number }[], xi: number, eta: number) {
  const { dx, dy, det } = dNxy(xy, xi, eta);
  const B = [new Float64Array(8), new Float64Array(8), new Float64Array(8)];
  for (let i = 0; i < 4; i++) {
    const c = i * 2;
    B[0][c] = dx[i];
    B[1][c + 1] = dy[i];
    B[2][c] = dy[i];
    B[2][c + 1] = dx[i];
  }
  return { B, det };
}

function addBtDB(K: Float64Array, n: number, B: Float64Array[], D: number[][], w: number) {
  const m = B.length;
  const DB: Float64Array[] = [];
  for (let r = 0; r < m; r++) {
    const row = new Float64Array(n);
    for (let c = 0; c < n; c++) {
      let s = 0;
      for (let k = 0; k < m; k++) s += D[r][k] * B[k][c];
      row[c] = s;
    }
    DB.push(row);
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let r = 0; r < m; r++) s += B[r][i] * DB[r][j];
      K[i * n + j] += w * s;
    }
  }
}

export type ShellMaterial = { E: number; nu: number; t: number };

/** Matrices constitutivas de placa: flexión Db, cortante Ds, membrana Dm. */
export function constitutive(mat: ShellMaterial) {
  const { E, nu, t } = mat;
  const D = (E * t ** 3) / (12 * (1 - nu * nu));
  const Db = [
    [D, D * nu, 0],
    [D * nu, D, 0],
    [0, 0, D * (1 - nu) / 2],
  ];
  const G = E / (2 * (1 + nu));
  const ks = 5 / 6;
  const Ds = [
    [ks * G * t, 0],
    [0, ks * G * t],
  ];
  const c = (E * t) / (1 - nu * nu);
  const Dm = [
    [c, c * nu, 0],
    [c * nu, c, 0],
    [0, 0, c * (1 - nu) / 2],
  ];
  return { Db, Ds, Dm, D, G };
}

/** Rigidez local 24×24 en orden [u,v,w,θx,θy,θz] por nodo. */
export function shellLocalStiffness(xy: { x: number; y: number }[], mat: ShellMaterial) {
  const { Db, Ds, Dm } = constitutive(mat);
  const Kb = new Float64Array(12 * 12);
  const Km = new Float64Array(8 * 8);
  let area = 0;
  for (const xi of GP) {
    for (const eta of GP) {
      const bb = bBending(xy, xi, eta);
      addBtDB(Kb, 12, bb.B, Db, bb.det);
      const bs = bShearMITC(xy, xi, eta);
      addBtDB(Kb, 12, bs.B, Ds, bs.det);
      const bm = bMembrane(xy, xi, eta);
      addBtDB(Km, 8, bm.B, Dm, bm.det);
      area += bb.det;
    }
  }

  const K = new Float64Array(24 * 24);
  // Membrana → (u, v)  ·  flexión → (w, βx=θy, βy=−θx)
  const memDof = [0, 1, 6, 7, 12, 13, 18, 19];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) K[memDof[i] * 24 + memDof[j]] += Km[i * 8 + j];
  }
  const bendDof = [2, 4, 3, 8, 10, 9, 14, 16, 15, 20, 22, 21];
  const bendSgn = [1, 1, -1, 1, 1, -1, 1, 1, -1, 1, 1, -1];
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      K[bendDof[i] * 24 + bendDof[j]] += bendSgn[i] * bendSgn[j] * Kb[i * 12 + j];
    }
  }

  // Rigidez ficticia de giro normal: evita la singularidad de θz en zonas coplanares.
  let maxDiag = 0;
  for (let i = 0; i < 24; i++) maxDiag = Math.max(maxDiag, K[i * 24 + i]);
  const kd = Math.max(maxDiag * 1e-7, 1e-9);
  for (const d of [5, 11, 17, 23]) K[d * 24 + d] += kd;

  return { K, area };
}

/** Matriz de rotación 24×24 (global → local) por bloques de 3. */
function rotationBlocks(ex: Vec3, ey: Vec3, ez: Vec3) {
  return [
    [ex.x, ex.y, ex.z],
    [ey.x, ey.y, ey.z],
    [ez.x, ez.y, ez.z],
  ];
}

/** Rigidez global 24×24 del elemento lámina. */
export function shellElementStiffness(p: Vec3[], mat: ShellMaterial) {
  const f = localFrame(p);
  const { K: Kl, area } = shellLocalStiffness(f.xy, mat);
  const T = rotationBlocks(f.ex, f.ey, f.ez);

  // Kg = R^T Kl R con R block-diag(T) 8 veces.
  const R = new Float64Array(24 * 24);
  for (let b = 0; b < 8; b++) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) R[(b * 3 + i) * 24 + (b * 3 + j)] = T[i][j];
    }
  }
  const tmp = new Float64Array(24 * 24);
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      let s = 0;
      for (let k = 0; k < 24; k++) s += Kl[i * 24 + k] * R[k * 24 + j];
      tmp[i * 24 + j] = s;
    }
  }
  const Kg = new Float64Array(24 * 24);
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      let s = 0;
      for (let k = 0; k < 24; k++) s += R[k * 24 + i] * tmp[k * 24 + j];
      Kg[i * 24 + j] = s;
    }
  }
  return { K: Kg, frame: f, area };
}

/** Esfuerzos locales (M, Q por metro) en un punto natural del elemento. */
export function shellStressAt(
  p: Vec3[],
  mat: ShellMaterial,
  ug: number[],
  xi: number,
  eta: number,
): ShellStress {
  const f = localFrame(p);
  const T = rotationBlocks(f.ex, f.ey, f.ez);
  // Desplazamientos locales.
  const ul = new Float64Array(24);
  for (let b = 0; b < 8; b++) {
    for (let i = 0; i < 3; i++) {
      let s = 0;
      for (let j = 0; j < 3; j++) s += T[i][j] * ug[b * 3 + j];
      ul[b * 3 + i] = s;
    }
  }
  const bendDof = [2, 4, 3, 8, 10, 9, 14, 16, 15, 20, 22, 21];
  const bendSgn = [1, 1, -1, 1, 1, -1, 1, 1, -1, 1, 1, -1];
  const ub = new Float64Array(12);
  for (let i = 0; i < 12; i++) ub[i] = bendSgn[i] * ul[bendDof[i]];

  const { Db, Ds } = constitutive(mat);
  const bb = bBending(f.xy, xi, eta);
  const kap = [0, 0, 0];
  for (let r = 0; r < 3; r++) {
    let s = 0;
    for (let c = 0; c < 12; c++) s += bb.B[r][c] * ub[c];
    kap[r] = s;
  }
  const bs = bShearMITC(f.xy, xi, eta);
  const gam = [0, 0];
  for (let r = 0; r < 2; r++) {
    let s = 0;
    for (let c = 0; c < 12; c++) s += bs.B[r][c] * ub[c];
    gam[r] = s;
  }
  return {
    mxx: Db[0][0] * kap[0] + Db[0][1] * kap[1],
    myy: Db[1][0] * kap[0] + Db[1][1] * kap[1],
    mxy: Db[2][2] * kap[2],
    qx: Ds[0][0] * gam[0],
    qy: Ds[1][1] * gam[1],
  };
}

/**
 * Cargas nodales consistentes de una carga de superficie (kN/m²) definida en
 * ejes globales y variable sobre el elemento. `traction(pt)` devuelve el vector
 * de tracción en el punto físico `pt` de la superficie media.
 */
export function surfaceLoad(p: Vec3[], traction: (pt: Vec3) => Vec3) {
  const f = localFrame(p);
  const out: Vec3[] = [0, 1, 2, 3].map(() => ({ x: 0, y: 0, z: 0 }));
  for (const xi of GP) {
    for (const eta of GP) {
      const { N, dNxi, dNeta } = shapeAt(xi, eta);
      const J = jacobian(f.xy, dNxi, dNeta);
      const pt: Vec3 = { x: 0, y: 0, z: 0 };
      for (let i = 0; i < 4; i++) {
        pt.x += N[i] * p[i].x;
        pt.y += N[i] * p[i].y;
        pt.z += N[i] * p[i].z;
      }
      const tr = traction(pt);
      for (let i = 0; i < 4; i++) {
        const w = N[i] * J.det;
        out[i].x += w * tr.x;
        out[i].y += w * tr.y;
        out[i].z += w * tr.z;
      }
    }
  }
  return out;
}

/** Área del elemento (integración 2×2). */
export function elementArea(p: Vec3[]) {
  const f = localFrame(p);
  let a = 0;
  for (const xi of GP) {
    for (const eta of GP) {
      const { dNxi, dNeta } = shapeAt(xi, eta);
      a += jacobian(f.xy, dNxi, dNeta).det;
    }
  }
  return a;
}
