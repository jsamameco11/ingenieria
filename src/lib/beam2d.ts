/**
 * Viga continua 2D — método de rigideces (tipo SAP2000).
 * Convención: v positivo hacia abajo, θ horario positivo.
 * Momento de diseño: positivo = tracción inferior (vano); negativo = tracción superior (apoyo).
 */

import { layoutSteel, type BarDef } from "./types";

export type MemberKind = "span" | "cantilever";

export type BeamMember = {
  L: number;
  kind: MemberKind;
  label: string;
};

export type Pattern = {
  id: string;
  name: string;
  note: string;
  live: boolean[];
};

export type SamplePt = { x: number; M: number; V: number; e: number };

export type SpanSteel = {
  label: string;
  kind: MemberKind;
  Ln: number;
  MuPos: number;
  MuNegL: number;
  MuNegR: number;
  VuL: number;
  VuR: number;
  xInfL: number;
  xInfR: number;
  LteoNegL: number;
  LteoNegR: number;
  LteoPosL: number;
  LteoPosR: number;
  Lext: number;
  ld: number;
  LcorteNegL: number;
  LcorteNegR: number;
  LcortePosL: number;
  LcortePosR: number;
  AsFlexPos: number;
  AsFlexNegL: number;
  AsFlexNegR: number;
  AsMin: number;
  AsPos: number;
  AsNegL: number;
  AsNegR: number;
  AsProvPos: number;
  AsProvNegL: number;
  AsProvNegR: number;
  nPos: number;
  nNegL: number;
  nNegR: number;
  sPos: number;
  sNegL: number;
  sNegR: number;
  barsPos: string;
  barsNegL: string;
  barsNegR: string;
  phiMnPos: number;
  phiMnNegL: number;
  phiMnNegR: number;
  okPos: boolean;
  okNegL: boolean;
  okNegR: boolean;
  unit: string;
};

export type BeamResult = {
  members: BeamMember[];
  nodes: number[];
  support: boolean[];
  patterns: Pattern[];
  samples: SamplePt[];
  Mmax: number[];
  Mmin: number[];
  Vmax: number[];
  Vmin: number[];
  cases: { name: string; samples: SamplePt[] }[];
  steel: SpanSteel[];
  WD: number;
  WL: number;
  wuDL: number;
  wuLL: number;
  combo: string;
};

function gauss(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    let piv = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
    if (Math.abs(M[piv][k]) < 1e-18) {
      M[piv][k] = 1e-18;
    }
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
    [6 * a * L, 4 * EI / L, -6 * a * L, 2 * EI / L],
    [-12 * a, -6 * a * L, 12 * a, -6 * a * L],
    [6 * a * L, 2 * EI / L, -6 * a * L, 4 * EI / L],
  ];
}

/** Cargas nodales equivalentes de w uniforme (hacia abajo). */
function eqLoad(w: number, L: number): number[] {
  return [w * L / 2, (w * L * L) / 12, w * L / 2, -(w * L * L) / 12];
}

function solveCase(members: BeamMember[], support: boolean[], w: number[], endFix: boolean): SamplePt[] {
  const nM = members.length;
  const nN = nM + 1;
  const nDof = nN * 2;
  const K = Array.from({ length: nDof }, () => Array(nDof).fill(0));
  const P = Array(nDof).fill(0);
  const EI = 1e7;

  for (let e = 0; e < nM; e++) {
    const L = members[e].L;
    const ke = beamK(EI, L);
    const pe = eqLoad(w[e] ?? 0, L);
    const map = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let i = 0; i < 4; i++) {
      P[map[i]] -= pe[i];
      for (let j = 0; j < 4; j++) K[map[i]][map[j]] += ke[i][j];
    }
  }

  const rest = new Set<number>();
  for (let i = 0; i < nN; i++) {
    if (support[i]) rest.add(2 * i);
  }
  if (endFix) {
    if (support[0]) rest.add(1);
    if (support[nN - 1]) rest.add(2 * (nN - 1) + 1);
  }

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

  const pts: SamplePt[] = [];
  let x0 = 0;
  const ns = 16;
  for (let e = 0; e < nM; e++) {
    const L = members[e].L;
    const wE = w[e] ?? 0;
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
      const Vx = Vi - wE * xi;
      const Mx = Mi + Vi * xi - (wE * xi * xi) / 2;
      pts.push({ x: x0 + xi, M: Mx / 1000, V: Vx / 1000, e });
    }
    x0 += L;
  }
  return pts;
}

export function parseLuces(raw: string, nPanos: number, Ldef: number): number[] {
  const n = Math.max(1, Math.min(8, Math.round(nPanos)));
  const parts = raw
    .split(/[;,\s]+/)
    .map((t) => Number(t.replace(",", ".")))
    .filter((v) => Number.isFinite(v) && v > 0.3);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(parts[i] ?? Ldef);
  return out;
}

export function buildPatterns(nSpan: number, hasVolI: boolean, hasVolD: boolean): Pattern[] {
  const nM = nSpan + (hasVolI ? 1 : 0) + (hasVolD ? 1 : 0);
  const live = (fn: (i: number) => boolean): boolean[] => Array.from({ length: nM }, (_, i) => fn(i));
  const spanIndex = (i: number) => i - (hasVolI ? 1 : 0);
  const patterns: Pattern[] = [
    {
      id: "all",
      name: "CV en todos los tramos",
      note: "Carga viva llena. Referencia; rara vez gobierna el positivo de vano.",
      live: live(() => true),
    },
    {
      id: "odd",
      name: "Mu+ acero inferior · CV en paños impares (1, 3, 5…)",
      note: "Damero de vano: la CV en impares maximiza el momento positivo (tracción inferior) de esos paños.",
      live: live((i) => {
        const s = spanIndex(i);
        if (s < 0 || s >= nSpan) return false;
        return s % 2 === 0;
      }),
    },
    {
      id: "even",
      name: "Mu+ acero inferior · CV en paños pares (2, 4, 6…)",
      note: "Damero de vano: la CV en pares maximiza el momento positivo (tracción inferior) de esos paños.",
      live: live((i) => {
        const s = spanIndex(i);
        if (s < 0 || s >= nSpan) return false;
        return s % 2 === 1;
      }),
    },
  ];
  for (let k = 0; k < nSpan - 1; k++) {
    patterns.push({
      id: `adj-${k}`,
      name: `Mu− acero superior · CV en paños ${k + 1} y ${k + 2} (apoyo ${k + 2})`,
      note: "Damero de apoyo: CV en los dos paños que llegan al nudo. Maximiza el momento negativo (tracción superior).",
      live: live((i) => {
        const s = spanIndex(i);
        return s === k || s === k + 1;
      }),
    });
  }
  if (hasVolI) {
    patterns.push({
      id: "volI",
      name: "Mu− acero superior · CV en volado izquierdo",
      note: "Damero de apoyo de extremo: máximo negativo en el primer apoyo y cortante de arranque del volado.",
      live: live((i) => i === 0),
    });
  }
  if (hasVolD) {
    patterns.push({
      id: "volD",
      name: "Mu− acero superior · CV en volado derecho",
      note: "Damero de apoyo de extremo: máximo negativo en el último apoyo y cortante de arranque del volado.",
      live: live((i) => i === nM - 1),
    });
  }
  return patterns;
}

function asRect(MuKgCm: number, b: number, d: number, fc: number, fy: number): number {
  const phi = 0.9;
  let As = MuKgCm / (phi * fy * 0.9 * d);
  for (let i = 0; i < 10; i++) {
    const a = (As * fy) / (0.85 * fc * b);
    const jd = Math.max(0.65 * d, d - a / 2);
    As = MuKgCm / (phi * fy * jd);
  }
  return As;
}

/** As de flexión (cm²). Si b > bw y a > hf, usa sección T (vano de vigueta). */
export function asFlex(MuTm: number, b: number, d: number, fc: number, fy: number, bw = b, hf = 1e9): number {
  const Mu = Math.max(0, MuTm) * 100000;
  if (Mu < 1 || d < 2) return 0;
  const Asb = asRect(Mu, b, d, fc, fy);
  const a = (Asb * fy) / (0.85 * fc * b);
  if (b <= bw + 0.05 || a <= hf + 0.05) return Asb;
  const phi = 0.9;
  const Cf = 0.85 * fc * (b - bw) * hf;
  const Mf = Cf * (d - hf / 2);
  const Mweb = Math.max(0, Mu / phi - Mf);
  const Asf = Cf / fy;
  return Asf + (Mweb < 1 ? 0 : asRect(Mweb * phi, bw, d, fc, fy));
}

export function phiMn(As: number, b: number, d: number, fc: number, fy: number, bw = b, hf = 1e9): number {
  if (As <= 0 || d < 2) return 0;
  const aRect = (As * fy) / (0.85 * fc * b);
  if (aRect <= hf + 0.05 || b <= bw + 0.05) {
    return (0.9 * As * fy * (d - aRect / 2)) / 100000;
  }
  const Asf = (0.85 * fc * (b - bw) * hf) / fy;
  const Asw = Math.max(0, As - Asf);
  const a = Asw > 0 ? (Asw * fy) / (0.85 * fc * bw) : hf;
  const Mn = Asf * fy * (d - hf / 2) + Asw * fy * (d - a / 2);
  return (0.9 * Mn) / 100000;
}

/** ld (cm) ACI 25.4.2.3 / E.060, ψt=ψe=ψs=λ=1. Barras > 3/4" usan el factor 20 en lugar de 25. */
export function ldCm(fy: number, fc: number, db: number): number {
  const k = db > 1.91 ? 0.1885 : 0.1508;
  const ratio = (k * fy) / Math.max(Math.sqrt(fc), 1);
  return Math.max(30, ratio * db);
}

export function analyzeContinuous(opts: {
  luces: number[];
  volI: number;
  volD: number;
  endFix: boolean;
  WD: number;
  WL: number;
  bw: number;
  bFlange?: number;
  d: number;
  h: number;
  fc: number;
  fy: number;
  bar: BarDef;
  kind: "joist" | "slab";
  asMin: number;
  hf?: number;
}): BeamResult {
  const luces = opts.luces.filter((L) => L > 0.3);
  const nSpan = Math.max(1, luces.length);
  const volI = opts.volI > 0.15 ? opts.volI : 0;
  const volD = opts.volD > 0.15 ? opts.volD : 0;
  const members: BeamMember[] = [];
  if (volI) members.push({ L: volI, kind: "cantilever", label: "Volado I" });
  luces.forEach((L, i) => members.push({ L, kind: "span", label: `Paño ${i + 1}` }));
  if (volD) members.push({ L: volD, kind: "cantilever", label: "Volado D" });

  const nN = members.length + 1;
  const support = Array(nN).fill(true);
  if (volI) support[0] = false;
  if (volD) support[nN - 1] = false;

  const nodes: number[] = [0];
  members.forEach((m) => nodes.push(nodes[nodes.length - 1] + m.L));

  const wuDL = 1.4 * opts.WD;
  const wuLL = 1.7 * opts.WL;
  const patterns = buildPatterns(nSpan, volI > 0, volD > 0);
  const cases: { name: string; samples: SamplePt[] }[] = [];

  for (const p of patterns) {
    const w = members.map((_, i) => wuDL + (p.live[i] ? wuLL : 0));
    cases.push({ name: p.name, samples: solveCase(members, support, w, opts.endFix) });
  }

  const ref = cases[0]?.samples ?? [];
  const Mmax = ref.map(() => -1e9);
  const Mmin = ref.map(() => 1e9);
  const Vmax = ref.map(() => -1e9);
  const Vmin = ref.map(() => 1e9);
  for (const c of cases) {
    c.samples.forEach((pt, i) => {
      Mmax[i] = Math.max(Mmax[i], pt.M);
      Mmin[i] = Math.min(Mmin[i], pt.M);
      Vmax[i] = Math.max(Vmax[i], pt.V);
      Vmin[i] = Math.min(Vmin[i], pt.V);
    });
  }

  const samples = ref.map((pt, i) => ({ x: pt.x, M: Mmax[i], V: Vmax[i], e: pt.e }));

  const interp = (arr: number[], x: number, e: number) => {
    const idx: number[] = [];
    for (let i = 0; i < ref.length; i++) if (ref[i].e === e) idx.push(i);
    if (!idx.length) return 0;
    const xs = idx.map((i) => ref[i].x);
    const vs = idx.map((i) => arr[i]);
    if (x <= xs[0]) return vs[0];
    if (x >= xs[xs.length - 1]) return vs[vs.length - 1];
    for (let i = 0; i < xs.length - 1; i++) {
      if (x >= xs[i] && x <= xs[i + 1]) {
        const span = Math.max(xs[i + 1] - xs[i], 1e-9);
        const t = (x - xs[i]) / span;
        return vs[i] * (1 - t) + vs[i + 1] * t;
      }
    }
    return vs[vs.length - 1];
  };

  const zeroCross = (arr: number[], xa: number, xb: number, e: number, want: "toNeg" | "toPos"): number | null => {
    const n = 40;
    let prevX = xa;
    let prev = interp(arr, xa, e);
    for (let i = 1; i <= n; i++) {
      const x = xa + ((xb - xa) * i) / n;
      const v = interp(arr, x, e);
      if (want === "toNeg" && prev >= 0 && v < 0) {
        const t = prev / (prev - v);
        return prevX + t * (x - prevX);
      }
      if (want === "toPos" && prev <= 0 && v > 0) {
        const t = prev / (prev - v);
        return prevX + t * (x - prevX);
      }
      prev = v;
      prevX = x;
    }
    return null;
  };

  const bPos = Math.max(opts.bFlange ?? opts.bw, opts.bw);
  const bNeg = opts.bw;
  const d = opts.d;
  const db = opts.bar.db;
  const hf = opts.hf ?? 1e9;
  const unit = opts.kind === "slab" ? "cm²/m" : "cm²";
  const steel: SpanSteel[] = [];
  const dd = d / 100;
  let xCursor = 0;

  for (let e = 0; e < members.length; e++) {
    const m = members[e];
    const Ln = m.L;
    const xa = xCursor;
    const xb = xCursor + Ln;
    const cant = m.kind === "cantilever";
    let MuPos = 0;
    for (let k = 0; k <= 24; k++) MuPos = Math.max(MuPos, interp(Mmax, xa + (Ln * k) / 24, e));
    const MuNegL = Math.max(0, -interp(Mmin, xa, e));
    const MuNegR = Math.max(0, -interp(Mmin, xb, e));
    const xVL = cant && e === 0 ? Math.max(xa, xb - dd) : Math.min(xb, xa + dd);
    const xVR = cant && e !== 0 ? Math.min(xb, xa + dd) : Math.max(xa, xb - dd);
    const VuL = Math.max(Math.abs(interp(Vmax, xVL, e)), Math.abs(interp(Vmin, xVL, e)));
    const VuR = Math.max(Math.abs(interp(Vmax, xVR, e)), Math.abs(interp(Vmin, xVR, e)));

    const zL = zeroCross(Mmin, xa, xb, e, "toPos");
    const zR = zeroCross(Mmin, xa, xb, e, "toNeg");
    /* Extremo simple: Mu− ≈ 0 y no hay cruce a negativo (Mmin va de − a +).
       El fallback Ln/4 solo aplica si SÍ hay momento de apoyo y no se halló inflexión. */
    const EPS_MU = 0.005;
    const hasNegL = MuNegL > EPS_MU;
    const hasNegR = MuNegR > EPS_MU;
    const LteoNegL = cant
      ? e === 0
        ? 0
        : Ln
      : hasNegL
        ? zL != null
          ? Math.max(0, zL - xa)
          : Ln * 0.25
        : 0;
    const LteoNegR = cant
      ? e === 0
        ? Ln
        : 0
      : hasNegR
        ? zR != null
          ? Math.max(0, xb - zR)
          : Ln * 0.25
        : 0;

    const zP1 = zeroCross(Mmax, xa, xb, e, "toPos");
    const zP2 = zeroCross(Mmax, xa, xb, e, "toNeg");
    const LteoPosL = zP1 != null ? Math.max(0, zP1 - xa) : cant ? 0 : Ln * 0.15;
    const LteoPosR = zP2 != null ? Math.max(0, xb - zP2) : cant ? 0 : Ln * 0.15;

    const AsFlexPos = asFlex(MuPos, bPos, d, opts.fc, opts.fy, bPos, hf);
    const AsFlexNegL = asFlex(MuNegL, bNeg, d, opts.fc, opts.fy, bNeg, 1e9);
    const AsFlexNegR = asFlex(MuNegR, bNeg, d, opts.fc, opts.fy, bNeg, 1e9);
    const AsMin = opts.asMin;
    const AsPos = Math.max(AsFlexPos, AsMin);
    const AsNegL = Math.max(AsFlexNegL, AsMin);
    const AsNegR = Math.max(AsFlexNegR, AsMin);
    const pPos = layoutSteel(AsPos, opts.bar, opts.kind, opts.h);
    const pNegL = layoutSteel(AsNegL, opts.bar, opts.kind, opts.h);
    const pNegR = layoutSteel(AsNegR, opts.bar, opts.kind, opts.h);
    const Lext = Math.max(Ln / 16, dd, 12 * (db / 100));
    const ld = ldCm(opts.fy, opts.fc, db) / 100;
    const LcorteNegL = cant
      ? e === 0
        ? 0
        : Ln
      : hasNegL
        ? Math.min(Ln * 0.45, Math.max(LteoNegL + Lext, ld))
        : ld;
    const LcorteNegR = cant
      ? e === 0
        ? Ln
        : 0
      : hasNegR
        ? Math.min(Ln * 0.45, Math.max(LteoNegR + Lext, ld))
        : ld;
    const LcortePosL = Math.min(Ln * 0.35, Math.max(LteoPosL + Math.max(dd, (12 * db) / 100), 0.15));
    const LcortePosR = Math.min(Ln * 0.35, Math.max(LteoPosR + Math.max(dd, (12 * db) / 100), 0.15));

    const mnPos = phiMn(pPos.AsProv, bPos, d, opts.fc, opts.fy, bPos, hf);
    const mnNegL = phiMn(pNegL.AsProv, bNeg, d, opts.fc, opts.fy);
    const mnNegR = phiMn(pNegR.AsProv, bNeg, d, opts.fc, opts.fy);

    steel.push({
      label: m.label,
      kind: m.kind,
      Ln,
      MuPos,
      MuNegL,
      MuNegR,
      VuL,
      VuR,
      xInfL: LteoNegL,
      xInfR: LteoNegR,
      LteoNegL,
      LteoNegR,
      LteoPosL,
      LteoPosR,
      Lext,
      ld,
      LcorteNegL,
      LcorteNegR,
      LcortePosL,
      LcortePosR,
      AsFlexPos,
      AsFlexNegL,
      AsFlexNegR,
      AsMin,
      AsPos,
      AsNegL,
      AsNegR,
      AsProvPos: pPos.AsProv,
      AsProvNegL: pNegL.AsProv,
      AsProvNegR: pNegR.AsProv,
      nPos: pPos.n,
      nNegL: pNegL.n,
      nNegR: pNegR.n,
      sPos: pPos.s,
      sNegL: pNegL.s,
      sNegR: pNegR.s,
      barsPos: `${pPos.text} (${pPos.detail})`,
      barsNegL: `${pNegL.text} (${pNegL.detail})`,
      barsNegR: `${pNegR.text} (${pNegR.detail})`,
      phiMnPos: mnPos,
      phiMnNegL: mnNegL,
      phiMnNegR: mnNegR,
      okPos: mnPos + 1e-6 >= MuPos,
      okNegL: mnNegL + 1e-6 >= MuNegL,
      okNegR: mnNegR + 1e-6 >= MuNegR,
      unit,
    });
    xCursor = xb;
  }

  return {
    members,
    nodes,
    support,
    patterns,
    samples,
    Mmax,
    Mmin,
    Vmax,
    Vmin,
    cases,
    steel,
    WD: opts.WD,
    WL: opts.WL,
    wuDL,
    wuLL,
    combo: "1.4 CM + 1.7 CV (damero)",
  };
}

export function encodeBeam(r: BeamResult): string {
  return JSON.stringify({
    nodes: r.nodes,
    support: r.support,
    members: r.members,
    x: r.samples.map((p) => p.x),
    Mmax: r.Mmax,
    Mmin: r.Mmin,
    Vmax: r.Vmax,
    Vmin: r.Vmin,
    patterns: r.patterns.map((p) => ({ id: p.id, name: p.name, live: p.live })),
    steel: r.steel.map((s) => ({
      label: s.label,
      kind: s.kind,
      Ln: s.Ln,
      MuPos: s.MuPos,
      MuNegL: s.MuNegL,
      MuNegR: s.MuNegR,
      VuL: s.VuL,
      VuR: s.VuR,
      LteoNegL: s.LteoNegL,
      LteoNegR: s.LteoNegR,
      LteoPosL: s.LteoPosL,
      LteoPosR: s.LteoPosR,
      Lext: s.Lext,
      ld: s.ld,
      LcorteNegL: s.LcorteNegL,
      LcorteNegR: s.LcorteNegR,
      AsPos: s.AsPos,
      AsNegL: s.AsNegL,
      AsNegR: s.AsNegR,
      nPos: s.nPos,
      nNegL: s.nNegL,
      nNegR: s.nNegR,
      sPos: s.sPos,
      sNegL: s.sNegL,
      sNegR: s.sNegR,
      barsPos: s.barsPos,
      barsNegL: s.barsNegL,
      barsNegR: s.barsNegR,
      unit: s.unit,
    })),
  });
}

export function decodeBeam(raw: string | undefined): {
  nodes: number[];
  support: boolean[];
  members: BeamMember[];
  x: number[];
  Mmax: number[];
  Mmin: number[];
  Vmax: number[];
  Vmin: number[];
  patterns: { id?: string; name: string; live: boolean[] }[];
  steel: {
    label: string;
    kind?: MemberKind;
    Ln: number;
    MuPos?: number;
    MuNegL?: number;
    MuNegR?: number;
    VuL?: number;
    VuR?: number;
    LteoNegL: number;
    LteoNegR?: number;
    LteoPosL?: number;
    LteoPosR?: number;
    Lext: number;
    ld: number;
    LcorteNegL: number;
    LcorteNegR: number;
    AsPos?: number;
    AsNegL?: number;
    AsNegR?: number;
    nPos?: number;
    nNegL?: number;
    nNegR?: number;
    sPos?: number;
    sNegL?: number;
    sNegR?: number;
    barsPos?: string;
    barsNegL?: string;
    barsNegR?: string;
    unit?: string;
  }[];
} | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!Array.isArray(o?.nodes) || !Array.isArray(o?.Mmax)) return null;
    return o;
  } catch {
    return null;
  }
}

export type DespieceExtra = {
  i: number;
  label: string;
  nAdd: number;
  x0: number;
  x1: number;
  Lteo: number;
  ld: number;
  Lbar: number;
  text: string;
};

export type DespieceNeg = {
  node: number;
  x: number;
  n: number;
  s: number;
  text: string;
  Lleft: number;
  Lright: number;
  LteoL: number;
  LteoR: number;
  ld: number;
  Lbar: number;
  hookL: boolean;
  hookR: boolean;
};

export type DespiecePlan = {
  kind: "joist" | "slab";
  bar: string;
  unifyPos: boolean;
  nBase: number;
  sBase: number;
  labelBase: string;
  extras: DespieceExtra[];
  negs: DespieceNeg[];
  note: string;
};

function modeBy(
  vals: number[],
  prefer: "min" | "max"
): number {
  const m = new Map<number, number>();
  for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1);
  let best = vals[0] ?? 0;
  let c = -1;
  for (const [v, k] of m) {
    const betterCount = k > c;
    const tie = k === c && (prefer === "min" ? v < best : v > best);
    if (betterCount || tie) {
      best = v;
      c = k;
    }
  }
  return best;
}

function extraRange(
  xa: number,
  xb: number,
  Ln: number,
  LteoPosL: number,
  LteoPosR: number,
  ld: number,
  Lext: number
) {
  const embed = Math.max(ld, Lext, 0.15);
  const tL = Number.isFinite(LteoPosL) ? LteoPosL : Ln * 0.15;
  const tR = Number.isFinite(LteoPosR) ? LteoPosR : Ln * 0.15;
  const xTeo0 = xa + Math.min(Math.max(tL, 0), Ln * 0.45);
  const xTeo1 = xb - Math.min(Math.max(tR, 0), Ln * 0.45);
  const Lteo = Math.max(0.2, xTeo1 - xTeo0);
  const x0 = Math.max(xa, xTeo0 - embed);
  const x1 = Math.min(xb, xTeo1 + embed);
  return { x0, x1, Lteo, ld, Lbar: Math.max(0.2, x1 - x0) };
}

type SteelPack = NonNullable<ReturnType<typeof decodeBeam>>["steel"][number];

function parseLayText(t: string | undefined): { n: number; name: string } | null {
  const m = /(\d+)\s*Ø\s*([^(\s]+)/.exec(t ?? "");
  if (!m) return null;
  const raw = m[2].replace(/["”]/g, "").trim();
  const name = raw.endsWith('"') ? raw : `${raw}"`;
  return { n: Number(m[1]) || 1, name };
}

export function planDespiece(
  nodes: number[],
  members: BeamMember[],
  steel: SteelPack[],
  bar: BarDef,
  kind: "joist" | "slab",
  _bApoyo?: number
): DespiecePlan {
  const rows = steel.map((st, i) => {
    const As = st.AsPos ?? 0;
    const lay = layoutSteel(As, bar, kind);
    const parsed = parseLayText(st.barsPos);
    const n = kind === "joist" ? (st.nPos ?? parsed?.n ?? lay.n) : 0;
    const s = kind === "slab" ? (st.sPos ?? lay.s) : 0;
    const barName = kind === "joist" ? (parsed?.name ?? lay.barName) : bar.name;
    return { i, st, n, s, As, barName, xa: nodes[i] ?? 0, xb: nodes[i + 1] ?? (nodes[i] ?? 0) + st.Ln };
  });

  if (!rows.length) {
    return {
      kind,
      bar: bar.name,
      unifyPos: false,
      nBase: kind === "joist" ? 1 : 0,
      sBase: 20,
      labelBase: kind === "joist" ? `1 Ø ${bar.name} continuo` : `Ø ${bar.name} @ 20 cm continuo`,
      extras: [],
      negs: [],
      note: "Sin paños de diseño.",
    };
  }
  let unifyPos = false;
  let nBase = 1;
  let sBase = 20;
  let barBase = bar.name;
  let extras: DespieceExtra[] = [];

  if (kind === "joist") {
    const keys = rows.map((r) => `${r.n}|${r.barName}`);
    const counts = new Map<string, number>();
    for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
    let majKey = keys[0];
    let majC = -1;
    for (const [k, c] of counts) {
      if (c > majC || (c === majC && rows.find((r) => `${r.n}|${r.barName}` === k)!.As < rows.find((r) => `${r.n}|${r.barName}` === majKey)!.As)) {
        majKey = k;
        majC = c;
      }
    }
    const nMaxAs = rows.reduce((a, r) => (r.As > a.As ? r : a), rows[0]);
    const higher = rows.filter((r) => r.As > (rows.find((x) => `${x.n}|${x.barName}` === majKey)?.As ?? 0) + 0.04);
    unifyPos = higher.length >= 2;
    if (unifyPos) {
      nBase = nMaxAs.n;
      barBase = nMaxAs.barName;
    } else {
      nBase = Number(majKey.split("|")[0]);
      barBase = majKey.split("|").slice(1).join("|");
      const AsBase = rows.find((r) => `${r.n}|${r.barName}` === majKey)?.As ?? 0;
      extras = rows
        .filter((r) => r.As > AsBase + 0.04)
        .map((r) => {
          const rng = extraRange(r.xa, r.xb, r.st.Ln, r.st.LteoPosL ?? r.st.Ln * 0.15, r.st.LteoPosR ?? r.st.Ln * 0.15, r.st.ld, r.st.Lext);
          const add = layoutSteel(Math.max(0.05, r.As - AsBase), bar, "joist");
          return {
            i: r.i,
            label: members[r.i]?.label ?? r.st.label,
            nAdd: add.n,
            ...rng,
            text: `+${add.text}`,
          };
        });
    }
  } else {
    const ss = rows.map((r) => (r.s > 0 ? r.s : layoutSteel(r.As, bar, "slab").s));
    const sMaj = modeBy(ss, "max");
    const sMin = Math.min(...ss);
    const higher = rows.filter((_, i) => ss[i] < sMaj - 0.4);
    unifyPos = higher.length >= 2;
    sBase = unifyPos ? sMin : sMaj;
    barBase = bar.name;
    if (!unifyPos) {
      extras = rows
        .filter((_, i) => ss[i] < sBase - 0.4)
        .map((r) => {
          const sLocal = ss[r.i] > 0 ? ss[r.i] : layoutSteel(r.As, bar, "slab").s;
          const rng = extraRange(r.xa, r.xb, r.st.Ln, r.st.LteoPosL ?? r.st.Ln * 0.15, r.st.LteoPosR ?? r.st.Ln * 0.15, r.st.ld, r.st.Lext);
          return {
            i: r.i,
            label: members[r.i]?.label ?? r.st.label,
            nAdd: 1,
            ...rng,
            text: `Ø ${bar.name} @ ${sLocal.toFixed(0)} cm`,
          };
        });
    }
  }

  const labelBase =
    kind === "joist" ? `${nBase} Ø ${barBase} continuo` : `Ø ${barBase} @ ${sBase.toFixed(0)} cm continuo`;

  const negs: DespieceNeg[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const left = steel[i - 1];
    const right = steel[i];
    if (!left && !right) continue;
    const AsL = left?.AsNegR ?? 0;
    const AsR = right?.AsNegL ?? 0;
    if (AsL < 0.05 && AsR < 0.05) continue;
    const AsGov = Math.max(AsL, AsR);
    const layGov = layoutSteel(AsGov, bar, kind);
    const fromText = AsL >= AsR ? parseLayText(left?.barsNegR) : parseLayText(right?.barsNegL);
    const n = kind === "joist" ? (fromText?.n ?? layGov.n) : 0;
    const s = kind === "slab" ? layGov.s : 0;
    const name = kind === "joist" ? (fromText?.name ?? layGov.barName) : bar.name;
    const Lleft = left?.LcorteNegR ?? 0;
    const Lright = right?.LcorteNegL ?? 0;
    if (Lleft < 0.05 && Lright < 0.05) continue;
    const Lbar = Math.max(Lleft, 0) + Math.max(Lright, 0);
    const layText = kind === "joist" ? `${n} Ø ${name}` : `Ø ${bar.name} @ ${s.toFixed(0)} cm`;
    negs.push({
      node: i,
      x: nodes[i] ?? 0,
      n,
      s,
      text: `${layText}, L = ${Lbar.toFixed(2)} m`,
      Lleft,
      Lright,
      LteoL: left?.LteoNegR ?? left?.LteoNegL ?? 0,
      LteoR: right?.LteoNegL ?? 0,
      ld: left?.ld ?? right?.ld ?? 0.4,
      Lbar,
      hookL: i === 0,
      hookR: i === nodes.length - 1,
    });
  }

  let note: string;
  if (kind === "joist" ? extras.length === 0 : rows.every((r) => Math.abs((r.s || sBase) - sBase) < 0.4)) {
    note = `Todos los paños llevan el mismo As+. Se coloca ${labelBase} en toda la longitud.`;
  } else if (unifyPos) {
    note = `En dos o más paños el As+ es mayor que en el resto. Se uniformiza a ${labelBase}.`;
  } else {
    const names = extras.map((e) => e.label).join(" y ");
    note = `La mayoría lleva ${labelBase}. En ${names} se añade acero adicional con L = L teórica + 2 ld.`;
  }

  return { kind, bar: barBase, unifyPos, nBase, sBase, labelBase, extras, negs, note };
}

