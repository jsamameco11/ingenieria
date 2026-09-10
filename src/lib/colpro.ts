import { type ColproPt, type ColproSection, COLPRO_SECTIONS } from "./colpro-data";
import { BARS, beta1, fmt } from "./types";

export { COLPRO_SECTIONS };
export type { ColproSection, ColproPt };

const BAR_AS: Record<string, number> = {
  '3/8"': 0.71,
  '1/2"': 1.27,
  '5/8"': 1.99,
  '3/4"': 2.85,
  '1"': 5.07,
};

export function asFromSteel(steel: string): number {
  let total = 0;
  const re = /(\d+)\s*Ø\s*([\d\s/]+")/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(steel))) {
    const n = Number(m[1]);
    const key = m[2].replace(/\s+/g, "");
    total += n * (BAR_AS[key] ?? 0);
  }
  return Math.round(total * 100) / 100;
}

export function steelParts(steel: string): { n: number; bar: string; as: number }[] {
  const out: { n: number; bar: string; as: number }[] = [];
  const re = /(\d+)\s*Ø\s*([\d\s/]+")/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(steel))) {
    const n = Number(m[1]);
    const bar = m[2].replace(/\s+/g, "");
    out.push({ n, bar, as: n * (BAR_AS[bar] ?? 0) });
  }
  return out;
}

export function nBarsSteel(steel: string): number {
  return steelParts(steel).reduce((s, p) => s + p.n, 0);
}

export function sectionAs(s: ColproSection): number {
  return s.As > 0 ? s.As : asFromSteel(s.steel);
}

export function colproById(id: string): ColproSection | undefined {
  return COLPRO_SECTIONS.find((s) => s.id === id);
}

export function colproLabel(s: ColproSection): string {
  if (s.shape === "circ") return `Ø ${s.b} cm · ${s.steel}`;
  if (s.shape === "L") return `L ${s.b}×${s.h} cm · ${s.steel}`;
  if (s.shape === "T") return `T ${s.b}×${s.h} cm · ${s.steel}`;
  return `${s.b}×${s.h} cm · ${s.steel}`;
}

export const COLPRO_FORMAS = [
  { value: "rect", label: "Rectangular" },
  { value: "circ", label: "Circular" },
  { value: "L", label: "En L" },
  { value: "T", label: "En T" },
  { value: "custom", label: "Personalizada" },
];

export function colproOptionsFor(forma: string): { value: string; label: string }[] {
  if (forma === "custom") return [{ value: "custom", label: "Whitney — b, h y As libres" }];
  const shape = forma === "circ" || forma === "L" || forma === "T" || forma === "rect" ? forma : "rect";
  return COLPRO_SECTIONS.filter((s) => s.shape === shape).map((s) => ({
    value: s.id,
    label: colproLabel(s),
  }));
}

export function firstSectionId(forma: string): string {
  if (forma === "custom") return "custom";
  return COLPRO_SECTIONS.find((s) => s.shape === forma)?.id ?? "custom";
}

export const COLPRO_OPTIONS = colproOptionsFor("rect");

export function encodePts(pts: ColproPt[]): string {
  return pts.map(([p, m]) => `${p},${m}`).join(";");
}

export function decodePts(raw: string | undefined): ColproPt[] {
  if (!raw) return [];
  return raw.split(";").map((tok) => {
    const [a, b] = tok.split(",");
    return [Number(a), Number(b)] as ColproPt;
  }).filter(([p, m]) => Number.isFinite(p) && Number.isFinite(m));
}

/** φMn (t·m) en un P de compresión positivo; null si P queda fuera de la envolvente. */
export function mnAt(curve: ColproPt[], Pu: number): number | null {
  if (curve.length < 2) return null;
  const pMax = curve[0][0];
  const pMin = curve[curve.length - 1][0];
  if (Pu > pMax + 0.15) return null;
  if (Pu < pMin - 0.15) return null;
  const P = Math.min(pMax, Math.max(pMin, Pu));
  for (let i = 0; i < curve.length - 1; i++) {
    const [p1, m1] = curve[i];
    const [p2, m2] = curve[i + 1];
    const lo = Math.min(p1, p2);
    const hi = Math.max(p1, p2);
    if (P >= lo - 1e-9 && P <= hi + 1e-9) {
      const t = Math.abs(p2 - p1) < 1e-9 ? 0 : (P - p1) / (p2 - p1);
      return Math.abs(m1 + t * (m2 - m1));
    }
  }
  return Math.abs(curve[curve.length - 1][1]);
}

export function insidePM(curve: ColproPt[], Pu: number, Mu: number): { ok: boolean; Mn: number } {
  const Mn = mnAt(curve, Pu);
  if (Mn == null) return { ok: false, Mn: 0 };
  return { ok: Math.abs(Mu) <= Mn + 0.02, Mn };
}

type Bar = { y: number; As: number };

function perimeterBars(b: number, h: number, n: number, cc: number): Bar[] {
  const nUse = Math.max(4, Math.round(n));
  const x0 = -b / 2 + cc;
  const x1 = b / 2 - cc;
  const y0 = -h / 2 + cc;
  const y1 = h / 2 - cc;
  const w = Math.max(x1 - x0, 1e-3);
  const ht = Math.max(y1 - y0, 1e-3);
  const per = 2 * (w + ht);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < nUse; i++) {
    let s = (i / nUse) * per;
    let x: number;
    let y: number;
    if (s <= w) {
      x = x0 + s;
      y = y1;
    } else if (s <= w + ht) {
      x = x1;
      y = y1 - (s - w);
    } else if (s <= 2 * w + ht) {
      x = x1 - (s - w - ht);
      y = y0;
    } else {
      x = x0;
      y = y0 + (s - 2 * w - ht);
    }
    pts.push({ x, y });
  }
  const map = new Map<string, number>();
  const asEach = 1;
  for (const p of pts) {
    const key = p.y.toFixed(2);
    map.set(key, (map.get(key) ?? 0) + asEach);
  }
  const tot = [...map.values()].reduce((a, v) => a + v, 0);
  return [...map.entries()].map(([k, v]) => ({ y: Number(k), As: v / tot }));
}

/** Diagrama φP–φM uniaxial (P a compresión +, t y t·m) para sección rectangular. */
export function whitneyPM(opts: {
  b: number;
  h: number;
  As: number;
  nBar: number;
  rec: number;
  fc: number;
  fy: number;
  db?: number;
}): ColproPt[] {
  const { b, h, As, nBar, rec, fc, fy } = opts;
  const db = opts.db ?? 1.91;
  const dest = 0.95;
  const cc = rec + dest + db / 2;
  const layers = perimeterBars(b, h, nBar, cc).map((L) => ({ y: L.y, As: L.As * As }));
  const Ag = b * h;
  const Es = 2_000_000;
  const ecu = 0.003;
  const b1 = beta1(fc);
  const Po = 0.85 * fc * (Ag - As) + fy * As;
  const phiC = 0.7;
  const Pnmax = 0.8 * phiC * Po;
  const cs: number[] = [];
  for (let i = 0; i <= 36; i++) cs.push(0.04 * h + (i / 36) * (3.2 * h));
  const raw: { P: number; M: number; et: number }[] = [];
  for (const c of cs) {
    const a = Math.min(b1 * c, h);
    const Cc = 0.85 * fc * b * a;
    let Pn = Cc;
    let Mn = Cc * (h / 2 - a / 2);
    let et = 0;
    for (const bar of layers) {
      const dComp = h / 2 - bar.y;
      const eps = ecu * (c - dComp) / Math.max(c, 1e-6);
      let fs = Math.max(-fy, Math.min(fy, Es * eps));
      if (dComp <= a) fs -= 0.85 * fc;
      Pn += bar.As * fs;
      Mn += bar.As * fs * bar.y;
      if (bar.y === Math.min(...layers.map((L) => L.y))) et = Math.max(et, -eps);
    }
    raw.push({ P: Pn, M: Math.abs(Mn), et });
  }
  const pts: ColproPt[] = [];
  pts.push([Pnmax / 1000, 0]);
  for (const r of raw) {
    let phi = phiC;
    if (r.et >= 0.005) phi = 0.9;
    else if (r.et > 0.002) phi = phiC + ((0.9 - phiC) * (r.et - 0.002)) / 0.003;
    let P = (phi * r.P) / 1000;
    const M = (phi * r.M) / 100000;
    if (P > Pnmax / 1000) {
      const t = (Pnmax / 1000) / Math.max(P, 1e-6);
      P = Pnmax / 1000;
      pts.push([P, M * t]);
    } else {
      pts.push([P, M]);
    }
  }
  const PnT = (0.9 * As * fy) / 1000;
  pts.push([-PnT, 0]);
  const seen = new Set<string>();
  const uniq: ColproPt[] = [];
  for (const p of pts) {
    const k = `${p[0].toFixed(2)}|${p[1].toFixed(2)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push([Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]);
  }
  uniq.sort((a, b) => b[0] - a[0]);
  return uniq;
}

/** Diagrama φP–φM con capas de acero en coordenadas y (cm, origen en el centroide). */
export function whitneyFromBars(opts: {
  b: number;
  h: number;
  bars: { y: number; As: number }[];
  fc: number;
  fy: number;
}): ColproPt[] {
  const { b, h, bars, fc, fy } = opts;
  const layers = bars.filter((L) => L.As > 1e-6);
  const As = layers.reduce((s, L) => s + L.As, 0);
  const Ag = b * h;
  const Es = 2_000_000;
  const ecu = 0.003;
  const b1 = beta1(fc);
  const Po = 0.85 * fc * (Ag - As) + fy * As;
  const phiC = 0.7;
  const Pnmax = 0.8 * phiC * Po;
  const yMin = layers.length ? Math.min(...layers.map((L) => L.y)) : -h / 2;
  const cs: number[] = [];
  for (let i = 0; i <= 36; i++) cs.push(0.04 * h + (i / 36) * (3.2 * h));
  const raw: { P: number; M: number; et: number }[] = [];
  for (const c of cs) {
    const a = Math.min(b1 * c, h);
    const Cc = 0.85 * fc * b * a;
    let Pn = Cc;
    let Mn = Cc * (h / 2 - a / 2);
    let et = 0;
    for (const bar of layers) {
      const dComp = h / 2 - bar.y;
      const eps = (ecu * (c - dComp)) / Math.max(c, 1e-6);
      let fs = Math.max(-fy, Math.min(fy, Es * eps));
      if (dComp <= a) fs -= 0.85 * fc;
      Pn += bar.As * fs;
      Mn += bar.As * fs * bar.y;
      if (Math.abs(bar.y - yMin) < 0.05) et = Math.max(et, -eps);
    }
    raw.push({ P: Pn, M: Math.abs(Mn), et });
  }
  const pts: ColproPt[] = [];
  pts.push([Pnmax / 1000, 0]);
  for (const r of raw) {
    let phi = phiC;
    if (r.et >= 0.005) phi = 0.9;
    else if (r.et > 0.002) phi = phiC + ((0.9 - phiC) * (r.et - 0.002)) / 0.003;
    let P = (phi * r.P) / 1000;
    const M = (phi * r.M) / 100000;
    if (P > Pnmax / 1000) {
      const t = Pnmax / 1000 / Math.max(P, 1e-6);
      P = Pnmax / 1000;
      pts.push([P, M * t]);
    } else {
      pts.push([P, M]);
    }
  }
  const PnT = (0.9 * As * fy) / 1000;
  pts.push([-PnT, 0]);
  const seen = new Set<string>();
  const uniq: ColproPt[] = [];
  for (const p of pts) {
    const k = `${p[0].toFixed(2)}|${p[1].toFixed(2)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push([Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]);
  }
  uniq.sort((a, b) => b[0] - a[0]);
  return uniq;
}

export function barDb(name: string): number {
  return BARS.find((b) => b.name === name)?.db ?? 1.91;
}

export function encodeDemands(rows: { p: number; m: number; name?: string }[]): string {
  return rows
    .map((r) => {
      const name = (r.name ?? "").replace(/[|,]/g, "/");
      return name ? `${r.p},${r.m},${name}` : `${r.p},${r.m}`;
    })
    .join("|");
}

export function decodeDemands(raw: string | undefined): { p: number; m: number; name?: string }[] {
  if (!raw) return [];
  return raw
    .split("|")
    .map((tok) => {
      const [a, b, ...rest] = tok.split(",");
      const name = rest.join(",").trim();
      return { p: Number(a), m: Number(b), name: name || undefined };
    })
    .filter((d) => Number.isFinite(d.p) && Number.isFinite(d.m));
}

export function fmtPtsTable(curve: ColproPt[]): string[][] {
  const rows: string[][] = [["Punto", "φPn (t)", "φMn (t·m)"]];
  curve.forEach((pt, i) => {
    rows.push([String(i + 1), fmt(pt[0], 2), fmt(pt[1], 2)]);
  });
  return rows;
}
