import { e030C, paramsSitio, Z_FACTOR } from "../e030/tablas";
import { normalizeSelfWeight } from "./loads";
import { nextId } from "./math";
import { storyZ } from "./model";
import type { BuildingProject, Load, SeismicCode, SeismicParams, SpectrumId } from "./types";

export const SEISMIC_CODES: { id: SeismicCode; name: string; note: string }[] = [
  { id: "e030", name: "Perú E.030 · RM 183-2026-VIVIENDA (2025/2026)", note: "V = Z U C S W / R. Espectro de diseño Sa(T) = Z·U·C(T)·S / R. Vivienda: 25 % CV." },
  { id: "asce7", name: "ASCE 7 / IBC (EE. UU.)", note: "Espectro de diseño SDS–SD1. Cs = SDS / (R/Ie)." },
  { id: "nsr10", name: "NSR-10 Colombia", note: "Cortante basal tipo ASCE, Aa y Fa del sitio." },
  { id: "nec", name: "NEC-SE-DS Ecuador", note: "V = (I Sa / R) W." },
  { id: "nch433", name: "NCh433 Chile", note: "Qo = C I Ao P / R*." },
  { id: "euro8", name: "Eurocódigo 8", note: "Fb = Sd(T1) m λ / q. Plantillas Tipo 1 y Tipo 2." },
];

export const SPECTRUM_TEMPLATES: { id: SpectrumId; name: string; code: SeismicCode; note: string }[] = [
  { id: "e030-2025", name: "Perú E.030 2025/2026 · RM 183-2026", code: "e030", note: "C(T) de Tabla N° 5: ramal 1+7,5(T/Tp), meseta 2,5, 2,5 Tp/T y 2,5 Tp TL/T². Sa = Z U C S / R." },
  { id: "asce7", name: "ASCE 7 / IBC — espectro de diseño", code: "asce7", note: "Sa = SDS (T≤Ts) y SD1/T (T>Ts). Reducción R/Ie." },
  { id: "nsr10", name: "NSR-10 Colombia — espectro de diseño", code: "nsr10", note: "Forma tipo Aa–Fa. Se usa SDS como Aa·Fa." },
  { id: "nec", name: "NEC-SE-DS Ecuador — espectro de diseño", code: "nec", note: "Sa elástico del sitio reducido por R." },
  { id: "nch433", name: "NCh433 Chile — espectro de diseño", code: "nch433", note: "C(T) acotado y Qo = C I A0 W / R*." },
  { id: "euro8-1", name: "Eurocódigo 8 — Tipo 1 (alta sismicidad)", code: "euro8", note: "Espectro Tipo 1, suelo C por defecto. Sd = ag S η / q." },
  { id: "euro8-2", name: "Eurocódigo 8 — Tipo 2 (moderada)", code: "euro8", note: "Espectro Tipo 2, periodos más cortos." },
];

export function defaultSeismic(): SeismicParams {
  const site = paramsSitio(4, "S2");
  return {
    code: "e030",
    zona: 4,
    Z: Z_FACTOR[4],
    suelo: "S2",
    S: site.S,
    Tp: site.Tp,
    Tl: site.Tl,
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
  };
}

export function normalizeSeismic(s: Partial<SeismicParams> | undefined): SeismicParams {
  const d = defaultSeismic();
  const next = { ...d, ...(s || {}) };
  next.staticFx = Number.isFinite(next.staticFx) ? next.staticFx : 1;
  next.staticFy = Number.isFinite(next.staticFy) ? next.staticFy : 1;
  next.dynFx = Number.isFinite(next.dynFx) ? next.dynFx : 1;
  next.dynFy = Number.isFinite(next.dynFy) ? next.dynFy : 1;
  if (!SPECTRUM_TEMPLATES.some((t) => t.id === next.spectrumId)) {
    next.spectrumId = next.code === "e030" ? "e030-2025" : next.code === "euro8" ? "euro8-1" : (next.code as SpectrumId);
  }
  return next;
}

export function applySpectrumTemplate(s: SeismicParams, id: SpectrumId): SeismicParams {
  const tpl = SPECTRUM_TEMPLATES.find((t) => t.id === id);
  return { ...s, spectrumId: id, code: tpl?.code ?? s.code };
}

export type SpectrumPoint = { T: number; C: number; Sa: number };

export function saAtPeriod(s: SeismicParams, T: number): { C: number; Sa: number } {
  const n = normalizeSeismic(s);
  const R = Math.max(n.R0 * n.Ia * n.Ip, 1);
  const t = Math.max(T, 0);
  if (n.spectrumId === "e030-2025" || n.code === "e030") {
    const C = Math.max(e030C(t, n.Tp, n.Tl), 0.25);
    return { C, Sa: (n.Z * n.U * C * n.S) / R };
  }
  if (n.spectrumId === "asce7" || n.spectrumId === "nsr10" || n.code === "asce7" || n.code === "nsr10") {
    const SDS = Math.max(n.SDS, 0.05);
    const SD1 = SDS * Math.max(n.Tp, 0.4);
    const Ts = SD1 / SDS;
    const T0 = 0.2 * Ts;
    let Sae = SDS;
    if (t <= T0) Sae = SDS * (0.4 + 0.6 * t / Math.max(T0, 1e-6));
    else if (t > Ts) Sae = SD1 / t;
    const Sa = (Sae * Math.max(n.Ie, 1)) / R;
    return { C: Sae, Sa };
  }
  if (n.spectrumId === "nec" || n.code === "nec") {
    const C = Math.max(e030C(t, Math.max(n.Tp, 0.4), Math.max(n.Tl, 1.5)), 0.25);
    const Sa = (n.Ie * Math.max(n.SDS, n.Z) * C) / (2.5 * R);
    return { C, Sa };
  }
  if (n.spectrumId === "nch433" || n.code === "nch433") {
    const C = Math.min((2.75 * n.Tp) / Math.max(t, n.Tp), 2.75);
    return { C, Sa: (n.Ie * n.Z * C) / R };
  }
  const type2 = n.spectrumId === "euro8-2";
  const Tb = type2 ? 0.05 : 0.15;
  const Tc = type2 ? 0.25 : 0.4;
  const Td = type2 ? 1.2 : 2.0;
  const Ssoil = Math.max(n.S, 1);
  const ag = Math.max(n.Z, 0.08);
  let eta = 2.5;
  if (t < Tb) eta = 1 + (t / Tb) * (2.5 - 1);
  else if (t > Tc && t <= Td) eta = 2.5 * (Tc / t);
  else if (t > Td) eta = 2.5 * (Tc * Td) / (t * t);
  const Sae = ag * Ssoil * eta;
  return { C: eta, Sa: Sae / R };
}

export function designSpectrum(s: SeismicParams, tMax = 4): SpectrumPoint[] {
  const pts: SpectrumPoint[] = [];
  for (let i = 0; i <= 80; i++) {
    const T = (i / 80) * tMax;
    const { C, Sa } = saAtPeriod(s, T);
    pts.push({ T, C, Sa });
  }
  return pts;
}

export type StoryForce = { storyId: string; z: number; w: number; Fx: number; Fy: number };

export type SeismicReport = {
  code: string;
  T: number;
  C: number;
  R: number;
  W: number;
  V: number;
  Vx: number;
  Vy: number;
  Vdyn: number;
  VdynX: number;
  VdynY: number;
  k: number;
  Sa: number;
  vmin: number;
  spectrumId: SpectrumId;
  spectrumName: string;
  spectrum: SpectrumPoint[];
  stories: StoryForce[];
  note: string;
};

function storyWeight(p: BuildingProject, storyId: string) {
  const z = storyZ(p, storyId);
  const sw = normalizeSelfWeight(p.selfWeight);
  const k = sw.enabled ? Math.max(0, sw.multiplier) : 0;
  let w = 0;
  for (const f of p.frames.filter((x) => x.storyId === storyId && !x.sectionId.startsWith("__RIGID__"))) {
    const wallLike = f.sectionId.startsWith("__WALL__") || f.kind === "pierStrip";
    if (wallLike && !sw.walls) continue;
    if (!wallLike && f.kind === "column" && !sw.columns) continue;
    if (!wallLike && f.kind !== "column" && !sw.beams) continue;
    const a = p.nodes.find((n) => n.id === f.nI);
    const b = p.nodes.find((n) => n.id === f.nJ);
    const sec = p.frameSections.find((s) => s.id === f.sectionId);
    const mat = sec ? p.materials.find((m) => m.id === sec.materialId) : undefined;
    if (!a || !b || !sec || !mat) continue;
    w += mat.gamma * sec.b * sec.h * Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) * k;
  }
  for (const s of p.slabs.filter((x) => x.storyId === storyId)) {
    if (!sw.slabs) continue;
    const ns = s.nodeIds.map((id) => p.nodes.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
    if (ns.length < 3) continue;
    let A = 0;
    for (let i = 0; i < ns.length; i++) {
      const j = (i + 1) % ns.length;
      A += ns[i].x * ns[j].y - ns[j].x * ns[i].y;
    }
    const sec = p.slabSections.find((x) => x.id === s.sectionId);
    const mat = sec ? p.materials.find((m) => m.id === sec.materialId) : undefined;
    if (sec && mat) w += mat.gamma * sec.t * Math.abs(A) / 2 * k;
  }
  for (const ld of p.loads) {
    if (ld.target === "slab") {
      const sl = p.slabs.find((x) => x.id === ld.targetId && x.storyId === storyId);
      if (!sl) continue;
      const ns = sl.nodeIds.map((id) => p.nodes.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
      let A = 0;
      for (let i = 0; i < ns.length; i++) {
        const j = (i + 1) % ns.length;
        A += ns[i].x * ns[j].y - ns[j].x * ns[i].y;
      }
      const area = Math.abs(A) / 2;
      const frac = ld.patternId === "CV" || ld.patternId === "CVT" || ld.patternId === "CVR" ? p.seismic.liveFrac : 1;
      w += Math.abs(ld.w1) * area * frac;
    }
  }
  void z;
  return Math.max(w, 0.01);
}

function periodApprox(p: BuildingProject, s: SeismicParams) {
  const H = p.stories.reduce((a, st) => a + st.height, 0);
  return Math.pow(Math.max(H, 1) / Math.max(s.Ct, 1), 0.75);
}

export function computeSeismic(p: BuildingProject): SeismicReport {
  const s = normalizeSeismic(p.seismic);
  const T = periodApprox(p, s);
  const R = Math.max(s.R0 * s.Ia * s.Ip, 1);
  const { C, Sa } = saAtPeriod(s, T);
  const k = T < 0.5 ? 1 : T <= 2.5 ? 0.75 + 0.5 * T : 2;
  const stories = p.stories.map((st) => ({
    storyId: st.id,
    z: st.elevation,
    w: storyWeight({ ...p, seismic: s }, st.id),
    Fx: 0,
    Fy: 0,
  }));
  const W = stories.reduce((a, st) => a + st.w, 0);
  const V = Sa * W;
  const Vx = V * s.staticFx;
  const Vy = V * s.staticFy;
  const vmin = s.Ia < 0.999 || s.Ip < 0.999 ? 0.9 : 0.8;
  const Vdyn0 = Math.max(Sa * W, vmin * V);
  const VdynX = Vdyn0 * s.dynFx;
  const VdynY = Vdyn0 * s.dynFy;
  const denom = stories.reduce((a, st) => a + st.w * st.z ** k, 0) || 1;
  for (const st of stories) {
    const share = (st.w * st.z ** k) / denom;
    st.Fx = Vx * share;
    st.Fy = Vy * share;
  }
  const tpl = SPECTRUM_TEMPLATES.find((t) => t.id === s.spectrumId);
  const note = s.spectrumId === "e030-2025"
    ? `E.030 RM 183-2026: V = Z U C S W / R. Estático con factor X=${s.staticFx} e Y=${s.staticFy}. Dinámico: espectro de diseño; Vdin ≥ ${vmin.toFixed(2)} V (regular 0,80 / irregular 0,90).`
    : `${tpl?.note ?? ""} Factores estáticos X=${s.staticFx} Y=${s.staticFy}. Espectro ${tpl?.name ?? s.spectrumId}.`;
  return {
    code: SEISMIC_CODES.find((c) => c.id === s.code)?.name ?? s.code,
    T,
    C,
    R,
    W,
    V,
    Vx,
    Vy,
    Vdyn: Vdyn0,
    VdynX,
    VdynY,
    k,
    Sa,
    vmin,
    spectrumId: s.spectrumId,
    spectrumName: tpl?.name ?? s.spectrumId,
    spectrum: designSpectrum(s),
    stories,
    note,
  };
}

function ensurePattern(p: BuildingProject, id: string, name: string, gx: number, gy: number) {
  let pat = p.patterns.find((x) => x.id === id);
  if (!pat) {
    pat = { id, name, selfWeight: false, gammaX: gx, gammaY: gy, gammaZ: 0 };
    p.patterns.push(pat);
  } else {
    pat.name = name;
    pat.gammaX = gx;
    pat.gammaY = gy;
  }
}

function ensureCombo(p: BuildingProject, id: string, name: string, factors: Record<string, number>) {
  const prev = p.combinations.find((c) => c.id === id);
  if (prev) {
    prev.name = name;
    prev.factors = factors;
    return;
  }
  p.combinations.push({ id, name, factors });
}

export function applySeismicToModel(p: BuildingProject): SeismicReport {
  p.seismic = normalizeSeismic(p.seismic);
  const rep = computeSeismic(p);
  p.loads = p.loads.filter((l) => !["SEX", "SEY", "SDX", "SDY"].includes(l.patternId));
  ensurePattern(p, "SEX", "SEX · Sismo estático X", 1, 0);
  ensurePattern(p, "SEY", "SEY · Sismo estático Y", 0, 1);
  ensurePattern(p, "SDX", "SDX · Espectro de diseño X", 1, 0);
  ensurePattern(p, "SDY", "SDY · Espectro de diseño Y", 0, 1);
  const addNodeLoads = (patternId: string, dir: "GX" | "GY", forceOf: (st: StoryForce) => number) => {
    for (const st of rep.stories) {
      const nodes = p.nodes.filter((n) => Math.abs(n.z - st.z) < 0.04 && !n.reference);
      if (!nodes.length) continue;
      const share = forceOf(st) / nodes.length;
      for (const n of nodes) {
        const ld: Load = {
          id: nextId("Q", p.loads.map((x) => x.id)),
          patternId,
          kind: "puntual",
          target: "node",
          targetId: n.id,
          dir,
          w1: 0,
          w2: 0,
          a: 0,
          b: 1,
          P: share,
          label: `${patternId} ${st.storyId}`,
        };
        p.loads.push(ld);
      }
    }
  };
  const dynScaleX = rep.Vx > 1e-9 ? rep.VdynX / rep.Vx : 0;
  const dynScaleY = rep.Vy > 1e-9 ? rep.VdynY / rep.Vy : 0;
  addNodeLoads("SEX", "GX", (st) => st.Fx);
  addNodeLoads("SEY", "GY", (st) => st.Fy);
  addNodeLoads("SDX", "GX", (st) => st.Fx * dynScaleX);
  addNodeLoads("SDY", "GY", (st) => st.Fy * dynScaleY);
  ensureCombo(p, "SX1", "1.25(CM+CV)+SEX", { CM: 1.25, CV: 1.25, SEX: 1 });
  ensureCombo(p, "SX2", "1.25(CM+CV)−SEX", { CM: 1.25, CV: 1.25, SEX: -1 });
  ensureCombo(p, "SY1", "1.25(CM+CV)+SEY", { CM: 1.25, CV: 1.25, SEY: 1 });
  ensureCombo(p, "SY2", "1.25(CM+CV)−SEY", { CM: 1.25, CV: 1.25, SEY: -1 });
  ensureCombo(p, "DX1", "1.25(CM+CV)+SDX", { CM: 1.25, CV: 1.25, SDX: 1 });
  ensureCombo(p, "DY1", "1.25(CM+CV)+SDY", { CM: 1.25, CV: 1.25, SDY: 1 });
  return rep;
}
