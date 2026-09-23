/**
 * Motores FEM dedicados de tanques y reservorios.
 *
 *  1. femCilindro     — lámina cilíndrica axisimétrica (1D, viga de Hermite + Winkler
 *                       de anillo). Reservorio circular y cuba INTZE.
 *  2. femMuroRect     — placa MITC4 de un muro de caja. Reservorio rectangular.
 *  3. femFusteCantilever — pórtico 3D de tubo anular en voladizo. Tanque elevado con fuste.
 *
 *  La torre de columnas usa solveFrame3D (pórtico espacial 12 GDL) en tanques.ts:
 *  es el cuarto motor, ya separado.
 *
 * Unidades: t, m  (E en t/m²).
 */

import { prepareModel, solve, elementDisp, type FemModel } from "../fem/solve";
import { shellStressAt, surfaceLoad } from "../fem/shell";
import { solveFrame3D, type Node3D, type Element3D, type NodalLoad } from "./frame3d";

const G = 9.81;

function EcTm2(fc: number) {
  return 15000 * Math.sqrt(Math.max(fc, 1)) * 10;
}

function gauss(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    let piv = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
    if (Math.abs(M[piv][k]) < 1e-18) M[piv][k] = 1e-18;
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

export type PuntoLaminaFem = { y: number; w: number; M: number; N: number; V: number };

/**
 * FEM 1D de la pared cilíndrica: D w'''' + k w = p(y), k = Ec t / R².
 * Elementos de viga de Hermite con matriz de Winkler consistente.
 * Base empotrada (w=θ=0), corona libre.
 */
export function femCilindro(opts: {
  H: number;
  R: number;
  t: number;
  fc: number;
  presion: (y: number) => number;
  nu?: number;
  nElem?: number;
}): { pts: PuntoLaminaFem[]; nNodos: number; nElem: number; Dp: number; kAnillo: number } {
  const H = Math.max(opts.H, 0.3);
  const nElem = Math.max(8, opts.nElem ?? 40);
  const nNodos = nElem + 1;
  const L = H / nElem;
  const nu = opts.nu ?? 0.15;
  const Ec = EcTm2(opts.fc);
  const t = Math.max(opts.t, 0.12);
  const R = Math.max(opts.R, 0.5);
  const Dp = (Ec * t ** 3) / (12 * (1 - nu * nu));
  const kA = (Ec * t) / (R * R);

  const EI = Dp;
  const a = EI / L ** 3;
  const kb = [
    [12 * a, 6 * a * L, -12 * a, 6 * a * L],
    [6 * a * L, 4 * EI / L, -6 * a * L, 2 * EI / L],
    [-12 * a, -6 * a * L, 12 * a, -6 * a * L],
    [6 * a * L, 2 * EI / L, -6 * a * L, 4 * EI / L],
  ];
  const c = (kA * L) / 420;
  const kw = [
    [156 * c, 22 * c * L, 54 * c, -13 * c * L],
    [22 * c * L, 4 * c * L * L, 13 * c * L, -3 * c * L * L],
    [54 * c, 13 * c * L, 156 * c, -22 * c * L],
    [-13 * c * L, -3 * c * L * L, -22 * c * L, 4 * c * L * L],
  ];

  const ndof = nNodos * 2;
  const K = Array.from({ length: ndof }, () => Array(ndof).fill(0));
  const F = Array(ndof).fill(0);
  for (let e = 0; e < nElem; e++) {
    const y0 = e * L;
    const y1 = y0 + L;
    const p0 = opts.presion(y0);
    const p1 = opts.presion(y1);
    const fe = [
      (L * (7 * p0 + 3 * p1)) / 20,
      (L * L * (3 * p0 + 2 * p1)) / 60,
      (L * (3 * p0 + 7 * p1)) / 20,
      (-L * L * (2 * p0 + 3 * p1)) / 60,
    ];
    const map = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let i = 0; i < 4; i++) {
      F[map[i]] += fe[i];
      for (let j = 0; j < 4; j++) K[map[i]][map[j]] += kb[i][j] + kw[i][j];
    }
  }

  const free: number[] = [];
  for (let i = 2; i < ndof; i++) free.push(i);
  const nf = free.length;
  const Kf = Array.from({ length: nf }, () => Array(nf).fill(0));
  const Ff = Array(nf).fill(0);
  for (let i = 0; i < nf; i++) {
    Ff[i] = F[free[i]];
    for (let j = 0; j < nf; j++) Kf[i][j] = K[free[i]][free[j]];
  }
  const uf = nf ? gauss(Kf, Ff) : [];
  const u = Array(ndof).fill(0);
  free.forEach((d, i) => {
    u[d] = uf[i];
  });

  // Momento de la curvatura de Hermite (lineal en el elemento) y cortante V = dM/dy.
  // kb·u solo da las fuerzas de flexión: omite la reacción del anillo y deja V escalonado.
  const kappa = (ul: number[], xi: number) => {
    const L2 = L * L;
    const d2 = [(-6 + 12 * xi) / L2, (-4 + 6 * xi) / L, (6 - 12 * xi) / L2, (-2 + 6 * xi) / L];
    return d2[0] * ul[0] + d2[1] * ul[1] + d2[2] * ul[2] + d2[3] * ul[3];
  };
  const dKappaDy = (ul: number[]) => {
    const L2 = L * L;
    const d3 = [12 / (L2 * L), 6 / L2, -12 / (L2 * L), 6 / L2];
    return d3[0] * ul[0] + d3[1] * ul[1] + d3[2] * ul[2] + d3[3] * ul[3];
  };
  let signoM = 0;
  const extremos: { y0: number; y1: number; w0: number; w1: number; M0: number; M1: number; V: number }[] = [];
  for (let e = 0; e < nElem; e++) {
    const ul = [u[2 * e], u[2 * e + 1], u[2 * e + 2], u[2 * e + 3]];
    const Fb = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) Fb[i] += kb[i][j] * ul[j];
    const Mc = EI * kappa(ul, 0);
    if (signoM === 0 && Math.abs(Fb[1]) > 1e-9 && Math.abs(Mc) > 1e-12) signoM = -Fb[1] * Mc >= 0 ? 1 : -1;
    const sM = signoM || 1;
    const M0 = sM * EI * kappa(ul, 0);
    const M1 = sM * EI * kappa(ul, 1);
    const V = sM * EI * dKappaDy(ul);
    extremos.push({ y0: e * L, y1: (e + 1) * L, w0: ul[0], w1: ul[2], M0, M1, V });
  }
  const pts: PuntoLaminaFem[] = [];
  for (let i = 0; i <= nElem; i++) {
    const izq = i > 0 ? extremos[i - 1] : null;
    const der = i < nElem ? extremos[i] : null;
    const y = i * L;
    const w = der ? der.w0 : izq!.w1;
    const M = izq && der ? 0.5 * (izq.M1 + der.M0) : der ? der.M0 : izq!.M1;
    const V = izq && der ? 0.5 * (izq.V + der.V) : der ? der.V : izq!.V;
    pts.push({ y, w, M, V, N: (Ec * t * w) / R });
  }
  if (!pts.length) pts.push({ y: 0, w: 0, M: 0, N: 0, V: 0 }, { y: H, w: 0, M: 0, N: 0, V: 0 });
  return { pts, nNodos, nElem, Dp, kAnillo: kA };
}

export type FemMuroRectResult = {
  mVert: { x: number; M: number }[];
  vVert: { x: number; M: number }[];
  mHor: { x: number; M: number }[];
  vHor: { x: number; M: number }[];
  MvertMax: number;
  MhorEsq: number;
  MhorVano: number;
  Vmax: number;
  nNodos: number;
  nElem: number;
  ok: boolean;
  nx: number;
  nz: number;
  cellsMxx: number[];
  cellsMyy: number[];
};

/**
 * FEM de placa MITC4 de un muro de reservorio rectangular.
 * Plano y–z, presión hacia +x.
 * Base: empotrada (6 GDL).
 * Esquinas verticales: nudo monolítico de caja — ux=uy=0 y θz=0
 *   (el muro perpendicular anula la traslación y el giro de esquina en planta).
 * Corona: ux=0 si hay losa de techo (apoyo simple).
 * Esfuerzos: promedio 2×2 Gauss (superconvergente) y extrapolación lineal
 *   desde los dos centros más próximos hasta la cara del apoyo (igual que
 *   valorEn del muro de sostenimiento): MITC4 no debe muestrearse en ξ=±1.
 */
export function femMuroRect(opts: {
  L: number;
  H: number;
  t: number;
  fc: number;
  presion: (z: number) => number;
  techo?: boolean;
  nx?: number;
  nz?: number;
  nu?: number;
}): FemMuroRectResult {
  const L = Math.max(opts.L, 0.8);
  const H = Math.max(opts.H, 0.5);
  const t = Math.max(opts.t, 0.12);
  const nx = Math.max(4, opts.nx ?? 10);
  const nz = Math.max(6, opts.nz ?? 12);
  const Ec = EcTm2(opts.fc);
  const nu = opts.nu ?? 0.2;
  const empty: FemMuroRectResult = {
    mVert: [{ x: 0, M: 0 }, { x: H, M: 0 }],
    vVert: [{ x: 0, M: 0 }, { x: H, M: 0 }],
    mHor: [{ x: 0, M: 0 }, { x: L, M: 0 }],
    vHor: [{ x: 0, M: 0 }, { x: L, M: 0 }],
    MvertMax: 0, MhorEsq: 0, MhorVano: 0, Vmax: 0,
    nNodos: 0, nElem: 0, ok: false,
    nx: 0, nz: 0, cellsMxx: [], cellsMyy: [],
  };

  const nodes: { x: number; y: number; z: number }[] = [];
  const id: number[][] = [];
  for (let iz = 0; iz <= nz; iz++) {
    id.push([]);
    for (let ix = 0; ix <= nx; ix++) {
      id[iz].push(nodes.length);
      nodes.push({ x: 0, y: (ix / nx) * L, z: (iz / nz) * H });
    }
  }
  const shells: FemModel["shells"] = [];
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      shells.push({
        nodes: [id[iz][ix], id[iz][ix + 1], id[iz + 1][ix + 1], id[iz + 1][ix]],
        t, E: Ec, nu, zona: "muro",
      });
    }
  }
  const supports: FemModel["supports"] = [];
  for (let ix = 0; ix <= nx; ix++) {
    const n = id[0][ix];
    for (let d = 0; d < 6; d++) supports.push({ node: n, dof: d });
  }
  for (let iz = 1; iz <= nz; iz++) {
    for (const ix of [0, nx]) {
      supports.push({ node: id[iz][ix], dof: 0 });
      supports.push({ node: id[iz][ix], dof: 1 });
      supports.push({ node: id[iz][ix], dof: 5 });
    }
  }
  if (opts.techo) {
    for (let ix = 1; ix < nx; ix++) supports.push({ node: id[nz][ix], dof: 0 });
  }

  const model: FemModel = { nodes, shells, springs: [], supports };
  let prep;
  try {
    prep = prepareModel(model);
  } catch {
    return empty;
  }
  const loads = new Float64Array(nodes.length * 6);
  for (const sh of shells) {
    const pts = sh.nodes.map((i) => nodes[i]);
    const fe = surfaceLoad(pts, (pt) => ({ x: opts.presion(pt.z), y: 0, z: 0 }));
    sh.nodes.forEach((ni, k) => {
      loads[ni * 6 + 0] += fe[k].x;
      loads[ni * 6 + 1] += fe[k].y;
      loads[ni * 6 + 2] += fe[k].z;
    });
  }
  const res = solve(prep, loads);
  if (!res.ok) return { ...empty, nNodos: nodes.length, nElem: shells.length };

  const mat = { E: Ec, nu, t };
  const at = (iz: number, ix: number, xi: number, eta: number) => {
    const sh = shells[iz * nx + ix];
    const pts = sh.nodes.map((i) => nodes[i]);
    return shellStressAt(pts, mat, elementDisp(res.u, sh.nodes), xi, eta);
  };

  type Cell = { iy: number; iz: number; mxx: number; myy: number; qx: number; qy: number; zc: number; yc: number };
  const g = 1 / Math.sqrt(3);
  const cells: Cell[] = [];
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const gp = [at(iz, ix, -g, -g), at(iz, ix, g, -g), at(iz, ix, g, g), at(iz, ix, -g, g)];
      const avg = (k: "mxx" | "myy" | "qx" | "qy") => 0.25 * (gp[0][k] + gp[1][k] + gp[2][k] + gp[3][k]);
      cells.push({
        iy: ix, iz,
        mxx: avg("mxx"), myy: avg("myy"), qx: avg("qx"), qy: avg("qy"),
        zc: (iz + 0.5) * (H / nz),
        yc: (ix + 0.5) * (L / nx),
      });
    }
  }

  const colC = Math.floor(nx / 2);
  const extrap = (s: number, s1: number, v1: number, s2: number, v2: number) => {
    const ds = s2 - s1;
    if (Math.abs(ds) < 1e-12) return v1;
    return v1 + ((v2 - v1) * (s - s1)) / ds;
  };
  const perfil = (muestras: { s: number; m: number; v: number }[], s0: number, s1: number) => {
    const a = muestras[0];
    const b = muestras[1] ?? a;
    const c = muestras[muestras.length - 2] ?? a;
    const d = muestras[muestras.length - 1];
    const m = [{ x: s0, M: extrap(s0, a.s, a.m, b.s, b.m) }];
    const v = [{ x: s0, M: extrap(s0, a.s, a.v, b.s, b.v) }];
    for (const p of muestras) {
      m.push({ x: p.s, M: p.m });
      v.push({ x: p.s, M: p.v });
    }
    m.push({ x: s1, M: extrap(s1, c.s, c.m, d.s, d.m) });
    v.push({ x: s1, M: extrap(s1, c.s, c.v, d.s, d.v) });
    return { m, v };
  };
  const vert = perfil(
    Array.from({ length: nz }, (_, iz) => {
      const cell = cells[iz * nx + colC];
      return { s: cell.zc, m: cell.myy, v: cell.qy };
    }),
    0,
    H,
  );
  const mVert = vert.m;
  const vVert = vert.v;
  const rowP = Math.min(nz - 1, Math.max(0, Math.round(0.25 * nz)));
  const hor = perfil(
    Array.from({ length: nx }, (_, ix) => {
      const cell = cells[rowP * nx + ix];
      return { s: cell.yc, m: cell.mxx, v: cell.qx };
    }),
    0,
    L,
  );
  const mHor = hor.m;
  const vHor = hor.v;

  let MhorEsq = 0;
  for (let iz = 0; iz < nz; iz++) {
    const fila = perfil(
      Array.from({ length: nx }, (_, ix) => {
        const cell = cells[iz * nx + ix];
        return { s: cell.yc, m: cell.mxx, v: cell.qx };
      }),
      0,
      L,
    );
    MhorEsq = Math.max(MhorEsq, Math.abs(fila.m[0].M), Math.abs(fila.m[fila.m.length - 1].M));
  }
  const MvertMax = Math.max(...mVert.map((p) => Math.abs(p.M)), 0);
  const MhorVano = Math.max(...Array.from({ length: nz }, (_, iz) => Math.abs(cells[iz * nx + colC].mxx)), 0);
  const Vmax = Math.max(...vVert.map((p) => Math.abs(p.M)), ...cells.map((c) => Math.hypot(c.qx, c.qy)), 0);

  return {
    mVert, vVert, mHor, vHor,
    MvertMax, MhorEsq, MhorVano, Vmax,
    nNodos: nodes.length, nElem: shells.length, ok: true,
    nx, nz,
    cellsMxx: cells.map((c) => c.mxx),
    cellsMyy: cells.map((c) => c.myy),
  };
}

export type FemFusteResult = {
  mPts: { x: number; M: number }[];
  vPts: { x: number; M: number }[];
  nPts: { x: number; M: number }[];
  T: number;
  kEff: number;
  delta: number;
  deltaTop: number;
  Mbase: number;
  Vbase: number;
  nNodos: number;
  nElem: number;
};

/**
 * FEM de fuste: pórtico 3D de un tubo anular en voladizo (elementos viga-columna
 * de 12 GDL). La cuba se representa con nudos maestros en hi y hc, unidos a la
 * corona por enlaces rígidos (×300), igual que la torre de columnas: Pi y Pc
 * actúan en el centro de masa, no recortadas a H.
 * Periodo por rigidez k = 1/δ bajo carga unitaria en hi.
 */
export function femFusteCantilever(opts: {
  H: number;
  Dext: number;
  Dint: number;
  fc: number;
  Pi: number;
  Pc: number;
  hI: number;
  hC: number;
  Wshaft: number;
  Wtop?: number;
  WiTotal: number;
  nElem?: number;
}): FemFusteResult {
  const H = Math.max(opts.H, 1);
  const nElem = Math.max(6, opts.nElem ?? 16);
  const Dext = Math.max(opts.Dext, 0.8);
  const Dint = Math.max(0.2, Math.min(opts.Dint, Dext - 0.1));
  const A = (Math.PI / 4) * (Dext * Dext - Dint * Dint);
  const I = (Math.PI / 64) * (Dext ** 4 - Dint ** 4);
  const J = 2 * I;
  const E = EcTm2(opts.fc);
  const Gc = E / (2 * 1.2);
  const dz = H / nElem;
  const nodes: Node3D[] = [];
  for (let i = 0; i <= nElem; i++) {
    nodes.push({ id: i + 1, x: 0, y: 0, z: i * dz, fixed: i === 0 });
  }
  const elements: Element3D[] = [];
  for (let i = 0; i < nElem; i++) {
    elements.push({ n1: i + 1, n2: i + 2, E, G: Gc, A, Iy: I, Iz: I, J });
  }
  const crownId = nElem + 1;
  const nodeOnShaft = (z: number) => {
    const i = Math.max(0, Math.min(nElem, Math.round(z / dz)));
    return i + 1;
  };
  let nextId = nElem + 2;
  const ensureHeight = (z: number) => {
    if (z <= H + 0.01) return nodeOnShaft(z);
    const existing = nodes.find((n) => n.id >= crownId && Math.abs(n.z - z) < 0.02);
    if (existing) return existing.id;
    const id = nextId++;
    nodes.push({ id, x: 0, y: 0, z, fixed: false });
    elements.push({ n1: crownId, n2: id, E, G: Gc, A, Iy: I, Iz: I, J, stiffMult: 300 });
    return id;
  };
  const nI = ensureHeight(Math.max(opts.hI, H));
  const nC = ensureHeight(Math.max(opts.hC, H));

  const unit = solveFrame3D(nodes, elements, [{ node: nI, fx: 1 }]);
  const dxUnit = Math.abs(unit.disp.get(nI)?.[0] ?? 1e-9);
  const kEff = 1 / Math.max(dxUnit, 1e-12);
  const T = 2 * Math.PI * Math.sqrt(Math.max(opts.WiTotal, 1) / G / Math.max(kEff, 1e-6));

  const gravLoads: NodalLoad[] = [];
  const wNode = Math.max(opts.Wshaft, 0) / nElem;
  for (let i = 1; i <= nElem; i++) gravLoads.push({ node: i + 1, fz: -wNode });
  if ((opts.Wtop ?? 0) > 0) gravLoads.push({ node: crownId, fz: -(opts.Wtop ?? 0) });
  const imp = solveFrame3D(nodes, elements, [...gravLoads, { node: nI, fx: opts.Pi }]);
  const conv = solveFrame3D(nodes, elements, [{ node: nC, fx: opts.Pc }]);

  const mPts: { x: number; M: number }[] = [];
  const vPts: { x: number; M: number }[] = [];
  const nPts: { x: number; M: number }[] = [];
  for (let e = 0; e < nElem; e++) {
    const fImp = imp.forces[e];
    const fConv = conv.forces[e];
    const z = e * dz;
    const Mi = Math.hypot(fImp.My1, fImp.Mz1);
    const Mc = Math.hypot(fConv.My1, fConv.Mz1);
    const Vi = Math.hypot(fImp.Vy1, fImp.Vz1);
    const Vc = Math.hypot(fConv.Vy1, fConv.Vz1);
    mPts.push({ x: z, M: Math.sqrt(Mi * Mi + Mc * Mc) });
    vPts.push({ x: z, M: Math.sqrt(Vi * Vi + Vc * Vc) });
    nPts.push({ x: z, M: Math.abs(fImp.N1) });
  }
  const lastI = imp.forces[nElem - 1];
  const lastC = conv.forces[nElem - 1];
  const Mtop = Math.sqrt(Math.hypot(lastI.My2, lastI.Mz2) ** 2 + Math.hypot(lastC.My2, lastC.Mz2) ** 2);
  const Vtop = Math.sqrt(Math.hypot(lastI.Vy2, lastI.Vz2) ** 2 + Math.hypot(lastC.Vy2, lastC.Vz2) ** 2);
  mPts.push({ x: H, M: Mtop });
  vPts.push({ x: H, M: Vtop });
  nPts.push({ x: H, M: Math.abs(lastI.N2) });

  const Mbase = mPts[0]?.M ?? 0;
  const Vbase = vPts[0]?.M ?? 0;
  const Vsrss = Math.hypot(opts.Pi, opts.Pc);
  const delta = Vsrss / Math.max(kEff, 1e-9);
  const dxI = Math.abs(imp.disp.get(crownId)?.[0] ?? 0);
  const dxC = Math.abs(conv.disp.get(crownId)?.[0] ?? 0);
  const deltaTop = Math.sqrt(dxI * dxI + dxC * dxC);

  return {
    mPts, vPts, nPts, T, kEff, delta, deltaTop, Mbase, Vbase,
    nNodos: nodes.length, nElem,
  };
}
