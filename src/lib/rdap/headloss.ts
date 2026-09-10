import { G } from "../num";
import type { HeadlossMethod } from "./types";

/** Exponente Hazen–Williams (formulación SI usada por el motor). */
export const HW_N = 1.852;
/** Coeficiente SI: Q en m³/s, D en m, L en m → hf en m. Documentado en la memoria. */
export const HW_K = 10.67;

export const METHOD_LABEL: Record<HeadlossMethod, string> = {
  "hazen-williams": "Hazen–Williams (SI, K = 10.67, n = 1.852)",
  "darcy-weisbach": "Darcy–Weisbach + Swamee–Jain",
  manning: "Manning a sección llena (Rh = D/4)",
};

export function areaM2(dM: number) {
  return (Math.PI * dM * dM) / 4;
}

export function hwR(L: number, C: number, dM: number) {
  const c = Math.max(C, 1);
  const d = Math.max(dM, 1e-6);
  return (HW_K * Math.max(L, 0)) / (c ** HW_N * d ** 4.87);
}

export function dwF(Re: number, epsM: number, dM: number) {
  const d = Math.max(dM, 1e-6);
  const re = Math.max(Re, 1);
  const arg = epsM / (3.7 * d) + 5.74 / re ** 0.9;
  const den = Math.log10(Math.max(arg, 1e-12));
  return 0.25 / (den * den);
}

export function manningR(L: number, n: number, dM: number) {
  const d = Math.max(dM, 1e-6);
  const rh = d / 4;
  const a = areaM2(d);
  return (n * n * Math.max(L, 0)) / (rh ** (4 / 3) * a * a);
}

export function pipeHeadloss(opts: {
  method: HeadlossMethod;
  qM3s: number;
  L: number;
  dM: number;
  C: number;
  epsM: number;
  n: number;
  kMinor: number;
  nu: number;
}) {
  const q = opts.qM3s;
  const a = areaM2(opts.dM);
  const v = a > 0 ? q / a : 0;
  const g = G;
  const hm = opts.kMinor * (v * v) / (2 * g);
  let hf = 0;
  if (opts.method === "hazen-williams") {
    const r = hwR(opts.L, opts.C, opts.dM);
    const mag = Math.abs(q);
    hf = mag < 1e-14 ? 0 : r * mag ** (HW_N - 1) * q;
  } else if (opts.method === "darcy-weisbach") {
    const re = (Math.abs(v) * opts.dM) / Math.max(opts.nu, 1e-10);
    const f = dwF(re, opts.epsM, opts.dM);
    hf = f * (opts.L / Math.max(opts.dM, 1e-6)) * (v * Math.abs(v)) / (2 * g);
  } else {
    const r = manningR(opts.L, opts.n, opts.dM);
    hf = r * q * Math.abs(q);
  }
  return { hf, hm: Math.sign(q || 1) * Math.abs(hm), v, area: a };
}

export function pipeDhfDQ(opts: {
  method: HeadlossMethod;
  qM3s: number;
  L: number;
  dM: number;
  C: number;
  epsM: number;
  n: number;
  kMinor: number;
  nu: number;
}) {
  const q = Math.max(Math.abs(opts.qM3s), 1e-8);
  const a = areaM2(opts.dM);
  const g = G;
  const dHm = opts.kMinor * (Math.abs(opts.qM3s) / (a * a)) / g;
  if (opts.method === "hazen-williams") {
    const r = hwR(opts.L, opts.C, opts.dM);
    return HW_N * r * q ** (HW_N - 1) + dHm;
  }
  if (opts.method === "manning") {
    const r = manningR(opts.L, opts.n, opts.dM);
    return 2 * r * q + dHm;
  }
  const v = q / a;
  const re = (v * opts.dM) / Math.max(opts.nu, 1e-10);
  const f = dwF(re, opts.epsM, opts.dM);
  const k = f * (opts.L / Math.max(opts.dM, 1e-6)) / (2 * g * a * a);
  return 2 * k * q + dHm;
}

export function interpCurve(curve: { qLs: number; hM: number }[], qLs: number) {
  if (!curve.length) return 0;
  const pts = [...curve].sort((a, b) => a.qLs - b.qLs);
  if (qLs <= pts[0].qLs) return pts[0].hM;
  const last = pts[pts.length - 1];
  if (qLs >= last.qLs) return last.hM;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (qLs <= b.qLs) {
      const t = (qLs - a.qLs) / Math.max(b.qLs - a.qLs, 1e-9);
      return a.hM + t * (b.hM - a.hM);
    }
  }
  return last.hM;
}
