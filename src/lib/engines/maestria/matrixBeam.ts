/**
 * Viga-franja 2D — método de rigideces (equivalente de placa / pórtico equivalente).
 * Convención: v positivo hacia abajo, θ horario. M>0 = tracción inferior.
 * Unidades: t, m. EI se cancela en isostáticos y se usa relativo en hiperestáticos.
 */

export type StripPt = { x: number; M: number; V: number };

export type StripResult = {
  pts: StripPt[];
  Mmax: number;
  Mmin: number;
  Vmax: number;
  Vend: number;
  xMmax: number;
  xMmin: number;
};

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

function beamK(EI: number, L: number): number[][] {
  const a = EI / L ** 3;
  return [
    [12 * a, 6 * a * L, -12 * a, 6 * a * L],
    [6 * a * L, (4 * EI) / L, -6 * a * L, (2 * EI) / L],
    [-12 * a, -6 * a * L, 12 * a, -6 * a * L],
    [6 * a * L, (2 * EI) / L, -6 * a * L, (4 * EI) / L],
  ];
}

function eqLoad(w: number, L: number): number[] {
  return [(w * L) / 2, (w * L * L) / 12, (w * L) / 2, (-w * L * L) / 12];
}

export type SpanLoad = { L: number; w: number };
export type NodalFM = { i: number; P?: number; M?: number };

/**
 * @param supportV  v=0 en el nudo (apoyo simple o empotrado)
 * @param supportTh θ=0 (solo empotrado / muro)
 * @param nodal     P hacia abajo, M horario, en nudos
 */
export function solveStrip(spans: SpanLoad[], supportV: boolean[], supportTh: boolean[], nodal: NodalFM[] = []): StripResult {
  const nM = Math.max(1, spans.length);
  const nN = nM + 1;
  const nDof = nN * 2;
  const K = Array.from({ length: nDof }, () => Array(nDof).fill(0));
  const P = Array(nDof).fill(0);
  const EI = 1e7;
  const Ls = spans.map((s) => Math.max(s.L, 0.05));
  const ws = spans.map((s) => s.w);

  for (let e = 0; e < nM; e++) {
    const L = Ls[e];
    const ke = beamK(EI, L);
    const pe = eqLoad(ws[e] ?? 0, L);
    const map = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let i = 0; i < 4; i++) {
      P[map[i]] -= pe[i];
      for (let j = 0; j < 4; j++) K[map[i]][map[j]] += ke[i][j];
    }
  }
  for (const n of nodal) {
    const i = Math.max(0, Math.min(nN - 1, n.i));
    P[2 * i] -= n.P ?? 0;
    P[2 * i + 1] -= n.M ?? 0;
  }

  const rest = new Set<number>();
  for (let i = 0; i < nN; i++) {
    if (supportV[i]) rest.add(2 * i);
    if (supportTh[i]) rest.add(2 * i + 1);
  }
  if (rest.size >= nDof) rest.delete(nDof - 1);

  const free: number[] = [];
  for (let i = 0; i < nDof; i++) if (!rest.has(i)) free.push(i);
  const nf = free.length;
  const Kf = Array.from({ length: nf }, () => Array(nf).fill(0));
  const Pf = Array(nf).fill(0);
  for (let i = 0; i < nf; i++) {
    Pf[i] = P[free[i]];
    for (let j = 0; j < nf; j++) Kf[i][j] = K[free[i]][free[j]];
  }
  const uf = nf ? gauss(Kf, Pf) : [];
  const u = Array(nDof).fill(0);
  free.forEach((dof, i) => {
    u[dof] = uf[i];
  });

  const pts: StripPt[] = [];
  let x0 = 0;
  const ns = 16;
  for (let e = 0; e < nM; e++) {
    const L = Ls[e];
    const wE = ws[e] ?? 0;
    const ke = beamK(EI, L);
    const pe = eqLoad(wE, L);
    const ul = [u[2 * e], u[2 * e + 1], u[2 * e + 2], u[2 * e + 3]];
    const F = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      F[i] = pe[i];
      for (let j = 0; j < 4; j++) F[i] += ke[i][j] * ul[j];
    }
    const Vi = F[0];
    const Mi = -F[1];
    for (let s = 0; s <= ns; s++) {
      const xi = (s / ns) * L;
      pts.push({ x: x0 + xi, V: Vi - wE * xi, M: Mi + Vi * xi - (wE * xi * xi) / 2 });
    }
    x0 += L;
  }

  let Mmax = -1e9;
  let Mmin = 1e9;
  let Vmax = 0;
  let xMmax = 0;
  let xMmin = 0;
  for (const p of pts) {
    if (p.M > Mmax) {
      Mmax = p.M;
      xMmax = p.x;
    }
    if (p.M < Mmin) {
      Mmin = p.M;
      xMmin = p.x;
    }
    Vmax = Math.max(Vmax, Math.abs(p.V));
  }
  return { pts, Mmax, Mmin, Vmax, Vend: pts[pts.length - 1]?.V ?? 0, xMmax, xMmin };
}

/** Viga invertida rígida (suelo ↑, columnas ↓). w se calibra a ΣP/L si no se pasa. */
export function invertBeam(L: number, wIn: number, loads: { x: number; P: number; M?: number }[]): StripResult {
  const Luse = Math.max(L, 0.2);
  const sumP = loads.reduce((s, p) => s + p.P, 0);
  const w = Math.abs(wIn) > 1e-9 ? wIn : sumP / Luse;
  const xs = new Set<number>([0, Luse]);
  for (const p of loads) xs.add(Math.min(Luse, Math.max(0, p.x)));
  for (let i = 1; i < 24; i++) xs.add((i / 24) * Luse);
  const pts = [...xs].sort((a, b) => a - b).map((x) => {
    let V = w * x;
    let M = (w * x * x) / 2;
    for (const p of loads) {
      if (p.x <= x + 1e-8) {
        V -= p.P;
        M -= p.P * (x - p.x);
        M += p.M ?? 0;
      }
    }
    return { x, V, M };
  });
  let Mmax = -1e9;
  let Mmin = 1e9;
  let Vmax = 0;
  let xMmax = 0;
  let xMmin = 0;
  for (const p of pts) {
    if (p.M > Mmax) {
      Mmax = p.M;
      xMmax = p.x;
    }
    if (p.M < Mmin) {
      Mmin = p.M;
      xMmin = p.x;
    }
    Vmax = Math.max(Vmax, Math.abs(p.V));
  }
  return { pts, Mmax, Mmin, Vmax, Vend: pts[pts.length - 1]?.V ?? 0, xMmax, xMmin };
}

export function packPts(pts: { x: number; M: number }[]) {
  return pts.map((p) => `${p.x.toFixed(3)},${p.M.toFixed(3)}`).join(";");
}
