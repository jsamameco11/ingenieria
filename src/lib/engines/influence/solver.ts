/**
 * Líneas de influencia de viga continua por rigideces (Euler–Bernoulli).
 * v hacia abajo, θ horario, M>0 tracción inferior. P hacia abajo.
 */

export type EndKind = "simple" | "empotrado" | "libre";

export type BeamModel = {
  spans: number[];
  izq: EndKind;
  der: EndKind;
};

export type SectionForce = { M: number; VL: number; VR: number; R: number[] };

export type Influence = {
  Ltot: number;
  xs: number;
  xi: number[];
  etaM: number[];
  etaVL: number[];
  etaVR: number[];
  etaR: number[][];
  supports: number[];
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

function pointFE(P: number, L: number, a: number) {
  const b = L - a;
  const L3 = L ** 3;
  const L2 = L ** 2;
  return [
    (P * b * b * (3 * a + b)) / L3,
    (P * a * b * b) / L2,
    (P * a * a * (a + 3 * b)) / L3,
    (-P * a * a * b) / L2,
  ];
}

export function parseBeam(raw: Record<string, string>): BeamModel {
  const nA = Math.max(2, Math.min(7, Math.round(Number(String(raw.nApoyos ?? "2").replace(",", ".")) || 2)));
  const nSpan = nA - 1;
  const spans: number[] = [];
  for (let i = 1; i <= nSpan; i++) {
    const rawL = i === 1 ? raw.L1 ?? raw.L : raw[`L${i}`];
    const v = Number(String(rawL ?? (i === 1 ? "30" : "25")).replace(",", ".")) || 0;
    spans.push(Math.max(0.5, v));
  }
  const izq = (raw.izq === "empotrado" || raw.izq === "libre" ? raw.izq : "simple") as EndKind;
  const der = (raw.der === "empotrado" || raw.der === "libre" ? raw.der : "simple") as EndKind;
  return { spans, izq, der };
}

export function supportXs(spans: number[]) {
  const xs = [0];
  let x = 0;
  for (const L of spans) {
    x += L;
    xs.push(x);
  }
  return xs;
}

function clamps(model: BeamModel) {
  const nN = model.spans.length + 1;
  const vFix = Array(nN).fill(true);
  const thFix = Array(nN).fill(false);
  if (model.izq === "empotrado") thFix[0] = true;
  if (model.izq === "libre") vFix[0] = false;
  if (model.der === "empotrado") thFix[nN - 1] = true;
  if (model.der === "libre") vFix[nN - 1] = false;
  if (!vFix.some(Boolean)) vFix[0] = true;
  return { vFix, thFix };
}

function analyze(model: BeamModel, xP: number, P: number): { pts: { x: number; M: number; V: number }[]; R: number[] } {
  const Ls = model.spans.map((L) => Math.max(L, 0.05));
  const nM = Ls.length;
  const nN = nM + 1;
  const nDof = nN * 2;
  const EI = 1e7;
  const K = Array.from({ length: nDof }, () => Array(nDof).fill(0));
  const Pn = Array(nDof).fill(0);
  const { vFix, thFix } = clamps(model);

  let acc = 0;
  let eLoad = 0;
  let aLoc = 0;
  for (let e = 0; e < nM; e++) {
    const L = Ls[e];
    if (xP >= acc - 1e-9 && xP <= acc + L + 1e-9) {
      eLoad = e;
      aLoc = Math.min(L, Math.max(0, xP - acc));
    }
    acc += L;
  }
  const Lload = Ls[eLoad];
  const pe = P !== 0 ? pointFE(P, Lload, aLoc) : [0, 0, 0, 0];

  for (let e = 0; e < nM; e++) {
    const L = Ls[e];
    const ke = beamK(EI, L);
    const map = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    const peE = e === eLoad ? pe : [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      Pn[map[i]] -= peE[i];
      for (let j = 0; j < 4; j++) K[map[i]][map[j]] += ke[i][j];
    }
  }

  const free: number[] = [];
  for (let n = 0; n < nN; n++) {
    if (!vFix[n]) free.push(2 * n);
    if (!thFix[n]) free.push(2 * n + 1);
  }
  const nf = free.length;
  const Kf = Array.from({ length: nf }, () => Array(nf).fill(0));
  const Pf = free.map((d) => Pn[d]);
  for (let i = 0; i < nf; i++) for (let j = 0; j < nf; j++) Kf[i][j] = K[free[i]][free[j]];
  const uf = nf ? gauss(Kf, Pf) : [];
  const u = Array(nDof).fill(0);
  free.forEach((d, i) => {
    u[d] = uf[i];
  });

  const R = Array(nN).fill(0);
  const pts: { x: number; M: number; V: number }[] = [];
  let x0 = 0;
  for (let e = 0; e < nM; e++) {
    const L = Ls[e];
    const ke = beamK(EI, L);
    const peE = e === eLoad ? pe : [0, 0, 0, 0];
    const ul = [u[2 * e], u[2 * e + 1], u[2 * e + 2], u[2 * e + 3]];
    const F = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      F[i] = peE[i];
      for (let j = 0; j < 4; j++) F[i] += ke[i][j] * ul[j];
    }
    const Vi = F[0];
    const Mi = -F[1];
    R[e] += F[0];
    R[e + 1] += F[2];
    const a = e === eLoad ? aLoc : -1;
    const samples = [0, L];
    if (a > 1e-6 && a < L - 1e-6) {
      samples.push(a - 1e-4, a + 1e-4);
    }
    for (let k = 1; k < 8; k++) samples.push((k / 8) * L);
    const loc = [...new Set(samples.map((v) => Math.min(L, Math.max(0, v))))].sort((p, q) => p - q);
    for (const xi of loc) {
      const loaded = a >= 0 && xi > a + 1e-8;
      const V = Vi - (loaded ? P : 0);
      const M = Mi + Vi * xi - (loaded ? P * (xi - a) : 0);
      pts.push({ x: x0 + xi, V, M });
    }
    x0 += L;
  }
  return { pts, R };
}

function atX(pts: { x: number; M: number; V: number }[], xs: number): { M: number; VL: number; VR: number } {
  const Ltot = pts[pts.length - 1]?.x || 0;
  const x = Math.min(Ltot, Math.max(0, xs));
  let VL = pts[0]?.V || 0;
  let VR = VL;
  let M = pts[0]?.M || 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (x < a.x - 1e-9) break;
    if (x <= b.x + 1e-9) {
      const t = (x - a.x) / Math.max(b.x - a.x, 1e-9);
      M = a.M + t * (b.M - a.M);
      VL = a.V;
      VR = b.V;
      if (Math.abs(b.x - a.x) > 1e-3) {
        VL = a.V + t * (b.V - a.V);
        VR = VL;
      }
      break;
    }
    VL = b.V;
    VR = b.V;
    M = b.M;
  }
  return { M, VL, VR };
}

export function etaMSimple(L: number, x: number, xi: number) {
  if (xi < -1e-9 || xi > L + 1e-9) return 0;
  return xi <= x ? (xi * (L - x)) / L : (x * (L - xi)) / L;
}

/** Cortante en x por P = 1 t en ξ. Caras: izq. ξ≤x → −ξ/L ; der. ξ≥x → (L−ξ)/L. Salto 1 en x. */
export function etaVSimple(L: number, x: number, xi: number, face?: "L" | "R") {
  if (xi < -1e-9 || xi > L + 1e-9) return 0;
  if (Math.abs(xi - x) <= 1e-12) {
    if (face === "R") return (L - x) / L;
    if (face === "L") return -x / L;
    return Math.abs(-x / L) >= Math.abs((L - x) / L) ? -x / L : (L - x) / L;
  }
  return xi < x ? -xi / L : (L - xi) / L;
}

export function buildInfluence(model: BeamModel, xs: number, nPts = 0): Influence {
  const Ltot = model.spans.reduce((a, b) => a + b, 0);
  const xSec = Math.min(Ltot, Math.max(0, xs));
  const n = nPts || Math.min(161, Math.max(81, Math.round(Ltot / 0.25) + 1));
  const set = new Set<number>();
  for (let i = 0; i < n; i++) set.add((i / (n - 1)) * Ltot);
  for (const s of supportXs(model.spans)) set.add(s);
  set.add(xSec);
  const xi = [...set].filter((v) => v >= -1e-12 && v <= Ltot + 1e-12).sort((a, b) => a - b);
  const etaM: number[] = [];
  const etaVL: number[] = [];
  const etaVR: number[] = [];
  const nN = model.spans.length + 1;
  const etaR = Array.from({ length: nN }, () => [] as number[]);
  const simple = model.spans.length === 1 && model.izq === "simple" && model.der === "simple";
  for (const x of xi) {
    if (simple) {
      etaM.push(etaMSimple(Ltot, xSec, x));
      etaVL.push(etaVSimple(Ltot, xSec, x, "L"));
      etaVR.push(etaVSimple(Ltot, xSec, x, "R"));
      etaR[0].push(x < -1e-9 || x > Ltot + 1e-9 ? 0 : (Ltot - x) / Ltot);
      etaR[1].push(x < -1e-9 || x > Ltot + 1e-9 ? 0 : x / Ltot);
      continue;
    }
    const sol = analyze(model, x, 1);
    const sec = atX(sol.pts, xSec);
    etaM.push(sec.M);
    etaVL.push(sec.VL);
    etaVR.push(sec.VR);
    for (let i = 0; i < nN; i++) etaR[i].push(sol.R[i] || 0);
  }
  return { Ltot, xs: xSec, xi, etaM, etaVL, etaVR, etaR, supports: supportXs(model.spans) };
}

function lerp(xs: number[], ys: number[], x: number) {
  if (x < xs[0] || x > xs[xs.length - 1]) return 0;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const t = (x - xs[lo]) / Math.max(xs[hi] - xs[lo], 1e-12);
  return ys[lo] + t * (ys[hi] - ys[lo]);
}

export function etaAt(inf: Influence, kind: "M" | "VL" | "VR" | "R", x: number, r = 0) {
  const ys = kind === "M" ? inf.etaM : kind === "VL" ? inf.etaVL : kind === "VR" ? inf.etaVR : inf.etaR[r] || inf.etaM;
  return lerp(inf.xi, ys, x);
}

export type TrainTerm = { i: number; p: number; s: number; xi: number; eta: number; contrib: number };

export function evalTrain(inf: Influence, axles: { p: number; s: number }[], s0: number, kind: "M" | "VL" | "VR" | "R", r = 0) {
  const rows: TrainTerm[] = [];
  let v = 0;
  axles.forEach((ax, i) => {
    const xi = s0 + ax.s;
    const eta = etaAt(inf, kind, xi, r);
    const contrib = ax.p * eta;
    v += contrib;
    rows.push({ i: i + 1, p: ax.p, s: ax.s, xi, eta, contrib });
  });
  return { v, rows };
}

export type Envelope = { max: number; min: number; sMax: number; sMin: number };

export function envelopeTrain(inf: Influence, axles: { p: number; s: number }[], kind: "M" | "VL" | "VR" | "R", r = 0): Envelope {
  if (!axles.length) return { max: 0, min: 0, sMax: 0, sMin: 0 };
  const last = axles[axles.length - 1].s;
  const step = Math.min(0.2, Math.max(0.08, inf.Ltot / 200));
  let max = -1e12;
  let min = 1e12;
  let sMax = 0;
  let sMin = 0;
  for (let s0 = -last - 1; s0 <= inf.Ltot + 1; s0 += step) {
    let v = 0;
    for (const ax of axles) v += ax.p * etaAt(inf, kind, s0 + ax.s, r);
    if (v > max) {
      max = v;
      sMax = s0;
    }
    if (v < min) {
      min = v;
      sMin = s0;
    }
  }
  if (max < -1e11) max = 0;
  if (min > 1e11) min = 0;
  return { max, min, sMax, sMin };
}

export function laneOnIL(inf: Influence, w: number, kind: "M" | "VL" | "VR" | "R", r = 0) {
  const br = laneBreakdown(inf, kind, w, r);
  return { pos: br.pos, neg: br.neg };
}

export type LaneSeg = { a: number; b: number; etaA: number; etaB: number; area: number; sign: "+" | "-" };

export function laneBreakdown(inf: Influence, kind: "M" | "VL" | "VR" | "R", w: number, r = 0) {
  const ys = kind === "M" ? inf.etaM : kind === "VL" ? inf.etaVL : kind === "VR" ? inf.etaVR : inf.etaR[r] || inf.etaM;
  const segs: LaneSeg[] = [];
  let Apos = 0;
  let Aneg = 0;
  const push = (a: number, b: number, etaA: number, etaB: number, area: number) => {
    if (Math.abs(area) < 1e-12 || b - a < 1e-12) return;
    const sign: "+" | "-" = area >= 0 ? "+" : "-";
    if (sign === "+") Apos += area;
    else Aneg += area;
    const last = segs[segs.length - 1];
    if (last && last.sign === sign && Math.abs(last.b - a) < 1e-8) {
      last.b = b;
      last.etaB = etaB;
      last.area += area;
      return;
    }
    segs.push({ a, b, etaA, etaB, area, sign });
  };
  for (let i = 1; i < inf.xi.length; i++) {
    const x0 = inf.xi[i - 1];
    const x1 = inf.xi[i];
    const dx = x1 - x0;
    const a = ys[i - 1];
    const b = ys[i];
    if (a >= 0 && b >= 0) push(x0, x1, a, b, 0.5 * (a + b) * dx);
    else if (a <= 0 && b <= 0) push(x0, x1, a, b, 0.5 * (a + b) * dx);
    else {
      const t = a / (a - b || 1e-12);
      const xz = x0 + Math.max(0, Math.min(1, t)) * dx;
      push(x0, xz, a, 0, 0.5 * a * (xz - x0));
      push(xz, x1, 0, b, 0.5 * b * (x1 - xz));
    }
  }
  return { segs, Apos, Aneg, pos: w * Apos, neg: w * Aneg };
}

export function packXY(xs: number[], ys: number[]) {
  const step = Math.max(1, Math.floor(xs.length / 80));
  const out: string[] = [];
  for (let i = 0; i < xs.length; i += step) out.push(`${xs[i].toFixed(3)},${ys[i].toFixed(4)}`);
  const last = xs.length - 1;
  if ((xs.length - 1) % step !== 0) out.push(`${xs[last].toFixed(3)},${ys[last].toFixed(4)}`);
  return out.join(";");
}

/** Campo de P=1: M[iLoad][iSec], V[iLoad][iSec]. Sirve para envolventes a lo largo de la viga. */
export type UnitField = {
  Ltot: number;
  xs: number[];
  M: number[][];
  V: number[][];
  supports: number[];
};

export type AlongEnv = {
  xs: number[];
  Mmax: number[];
  Mmin: number[];
  Vmax: number[];
  Vmin: number[];
};

function fieldGrid(model: BeamModel, nPts = 0) {
  const Ltot = model.spans.reduce((a, b) => a + b, 0);
  const n = nPts || Math.min(81, Math.max(41, Math.round(Ltot / 0.45) + 1));
  const set = new Set<number>();
  for (let i = 0; i < n; i++) set.add((i / (n - 1)) * Ltot);
  for (const s of supportXs(model.spans)) set.add(s);
  const xs = [...set].filter((v) => v >= -1e-12 && v <= Ltot + 1e-12).sort((a, b) => a - b);
  return { Ltot, xs };
}

function lerpCol(xs: number[], mat: number[][], iSec: number, xLoad: number) {
  if (xLoad < xs[0] - 1e-9 || xLoad > xs[xs.length - 1] + 1e-9) return 0;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= xLoad) lo = mid;
    else hi = mid;
  }
  const t = (xLoad - xs[lo]) / Math.max(xs[hi] - xs[lo], 1e-12);
  return mat[lo][iSec] + t * (mat[hi][iSec] - mat[lo][iSec]);
}

export function buildUnitField(model: BeamModel, nPts = 0): UnitField {
  const { Ltot, xs } = fieldGrid(model, nPts);
  const nS = xs.length;
  const M = Array.from({ length: nS }, () => Array(nS).fill(0));
  const V = Array.from({ length: nS }, () => Array(nS).fill(0));
  const simple = model.spans.length === 1 && model.izq === "simple" && model.der === "simple";
  for (let j = 0; j < nS; j++) {
    const xi = xs[j];
    if (simple) {
      for (let i = 0; i < nS; i++) {
        M[j][i] = etaMSimple(Ltot, xs[i], xi);
        const vL = etaVSimple(Ltot, xs[i], xi, "L");
        const vR = etaVSimple(Ltot, xs[i], xi, "R");
        V[j][i] = Math.abs(vL) >= Math.abs(vR) ? vL : vR;
      }
      continue;
    }
    const sol = analyze(model, xi, 1);
    for (let i = 0; i < nS; i++) {
      const s = atX(sol.pts, xs[i]);
      M[j][i] = s.M;
      V[j][i] = Math.abs(s.VL) >= Math.abs(s.VR) ? s.VL : s.VR;
    }
  }
  return { Ltot, xs, M, V, supports: supportXs(model.spans) };
}

export function emptyAlong(xs: number[]): AlongEnv {
  const z = xs.map(() => 0);
  return { xs, Mmax: z.slice(), Mmin: z.slice(), Vmax: z.slice(), Vmin: z.slice() };
}

/** M(x) y V(x) con el tren anclado: 1.er eje en s0. */
export function forceAlong(field: UnitField, axles: { p: number; s: number }[], s0: number) {
  const n = field.xs.length;
  const M = Array(n).fill(0);
  const V = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (const ax of axles) {
      M[i] += ax.p * lerpCol(field.xs, field.M, i, s0 + ax.s);
      V[i] += ax.p * lerpCol(field.xs, field.V, i, s0 + ax.s);
    }
  }
  return { xs: field.xs, M, V };
}

export function envelopeAlong(field: UnitField, axles: { p: number; s: number }[]): AlongEnv {
  const n = field.xs.length;
  const out = emptyAlong(field.xs);
  if (!axles.length) return out;
  out.Mmax = Array(n).fill(-1e12);
  out.Mmin = Array(n).fill(1e12);
  out.Vmax = Array(n).fill(-1e12);
  out.Vmin = Array(n).fill(1e12);
  const last = axles[axles.length - 1].s;
  const step = Math.min(0.25, Math.max(0.1, field.Ltot / 140));
  for (let s0 = -last - 1; s0 <= field.Ltot + 1; s0 += step) {
    for (let i = 0; i < n; i++) {
      let m = 0;
      let v = 0;
      for (const ax of axles) {
        const xi = s0 + ax.s;
        m += ax.p * lerpCol(field.xs, field.M, i, xi);
        v += ax.p * lerpCol(field.xs, field.V, i, xi);
      }
      if (m > out.Mmax[i]) out.Mmax[i] = m;
      if (m < out.Mmin[i]) out.Mmin[i] = m;
      if (v > out.Vmax[i]) out.Vmax[i] = v;
      if (v < out.Vmin[i]) out.Vmin[i] = v;
    }
  }
  for (let i = 0; i < n; i++) {
    if (out.Mmax[i] < -1e11) out.Mmax[i] = 0;
    if (out.Mmin[i] > 1e11) out.Mmin[i] = 0;
    if (out.Vmax[i] < -1e11) out.Vmax[i] = 0;
    if (out.Vmin[i] > 1e11) out.Vmin[i] = 0;
  }
  return out;
}

export function laneAlong(field: UnitField, w: number) {
  const n = field.xs.length;
  const Mpos = Array(n).fill(0);
  const Mneg = Array(n).fill(0);
  const Vpos = Array(n).fill(0);
  const Vneg = Array(n).fill(0);
  const acc = (ys: number[], iSec: number, pos: number[], neg: number[]) => {
    for (let j = 1; j < n; j++) {
      const dx = field.xs[j] - field.xs[j - 1];
      const a = ys[j - 1];
      const b = ys[j];
      if (a >= 0 && b >= 0) pos[iSec] += 0.5 * (a + b) * dx;
      else if (a <= 0 && b <= 0) neg[iSec] += 0.5 * (a + b) * dx;
      else {
        const t = a / (a - b || 1e-12);
        const xz = Math.max(0, Math.min(1, t));
        const left = 0.5 * a * xz * dx;
        const right = 0.5 * b * (1 - xz) * dx;
        if (a > 0) {
          pos[iSec] += left;
          neg[iSec] += right;
        } else {
          neg[iSec] += left;
          pos[iSec] += right;
        }
      }
    }
  };
  for (let i = 0; i < n; i++) {
    acc(field.M.map((row) => row[i]), i, Mpos, Mneg);
    acc(field.V.map((row) => row[i]), i, Vpos, Vneg);
  }
  return {
    Mpos: Mpos.map((v) => w * v),
    Mneg: Mneg.map((v) => w * v),
    Vpos: Vpos.map((v) => w * v),
    Vneg: Vneg.map((v) => w * v),
  };
}

export function combAlong(
  env: AlongEnv,
  lane: { Mpos: number[]; Mneg: number[]; Vpos: number[]; Vneg: number[] },
  im: number,
  withLane: boolean,
  k = 1,
): AlongEnv {
  const f = k * (1 + im);
  const lf = withLane ? k : 0;
  return {
    xs: env.xs,
    Mmax: env.Mmax.map((v, i) => f * v + lf * lane.Mpos[i]),
    Mmin: env.Mmin.map((v, i) => f * v + lf * lane.Mneg[i]),
    Vmax: env.Vmax.map((v, i) => f * v + lf * lane.Vpos[i]),
    Vmin: env.Vmin.map((v, i) => f * v + lf * lane.Vneg[i]),
  };
}

export function scaleAlong(env: AlongEnv, f: number): AlongEnv {
  return {
    xs: env.xs,
    Mmax: env.Mmax.map((v) => f * v),
    Mmin: env.Mmin.map((v) => f * v),
    Vmax: env.Vmax.map((v) => f * v),
    Vmin: env.Vmin.map((v) => f * v),
  };
}

export function mergeAlong(a: AlongEnv, b: AlongEnv): AlongEnv {
  return {
    xs: a.xs,
    Mmax: a.Mmax.map((v, i) => Math.max(v, b.Mmax[i] ?? v)),
    Mmin: a.Mmin.map((v, i) => Math.min(v, b.Mmin[i] ?? v)),
    Vmax: a.Vmax.map((v, i) => Math.max(v, b.Vmax[i] ?? v)),
    Vmin: a.Vmin.map((v, i) => Math.min(v, b.Vmin[i] ?? v)),
  };
}

export function peakAlong(env: AlongEnv) {
  const iMp = env.Mmax.reduce((a, v, i) => (v > env.Mmax[a] ? i : a), 0);
  const iMn = env.Mmin.reduce((a, v, i) => (v < env.Mmin[a] ? i : a), 0);
  const iVp = env.Vmax.reduce((a, v, i) => (v > env.Vmax[a] ? i : a), 0);
  const iVn = env.Vmin.reduce((a, v, i) => (v < env.Vmin[a] ? i : a), 0);
  return {
    Mplus: env.Mmax[iMp],
    xMplus: env.xs[iMp],
    Mminus: env.Mmin[iMn],
    xMminus: env.xs[iMn],
    Vplus: env.Vmax[iVp],
    xVplus: env.xs[iVp],
    Vminus: env.Vmin[iVn],
    xVminus: env.xs[iVn],
    Vabs: Math.max(Math.abs(env.Vmax[iVp]), Math.abs(env.Vmin[iVn])),
  };
}
