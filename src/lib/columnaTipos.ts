import { type ColproSection, COLPRO_SECTIONS } from "./colpro-data";
import { nBarsSteel, sectionAs } from "./colpro";
import { barByName } from "./types";

export type ColumnaTipo = {
  id: string;
  shape: "rect" | "circ";
  b: number;
  h: number;
  steel: string;
  As: number;
  nBar: number;
  bar: string;
  rho: number;
  source: "catalogo" | "motor";
};

const RECT_SIZES: [number, number][] = [
  [25, 25], [30, 30], [35, 35], [40, 40], [45, 45], [50, 50], [55, 55], [60, 60], [70, 70], [80, 80], [90, 90], [100, 100],
  [25, 30], [25, 35], [25, 40], [25, 50], [25, 60], [25, 70], [25, 80],
  [30, 35], [30, 40], [30, 45], [30, 50], [30, 60], [30, 70], [30, 80],
  [35, 40], [35, 50], [35, 60], [35, 70], [35, 80],
  [40, 50], [40, 60], [40, 70], [40, 80], [40, 90],
  [45, 60], [45, 70], [50, 70], [50, 80], [50, 90], [50, 100],
  [60, 80], [60, 90], [60, 100], [70, 90], [80, 100],
];
const CIRC_D = [25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100];
const TARGETS = [0.01, 0.012, 0.015, 0.018, 0.02, 0.025, 0.03, 0.035, 0.04];
const BAR_NAMES = ['1/2"', '5/8"', '3/4"', '1"'] as const;

function rhoBand(rho: number): string {
  const p = rho * 100;
  if (p < 1.5) return "1.0-1.5";
  if (p < 2) return "1.5-2.0";
  if (p < 2.5) return "2.0-2.5";
  if (p < 3) return "2.5-3.0";
  return "3.0-4.0";
}

function pickSteel(Ag: number, minN: number, target: number): { n: number; bar: string; As: number; rho: number } | null {
  let best: { n: number; bar: string; As: number; rho: number; score: number } | null = null;
  const ns = [];
  for (let n = minN; n <= 24; n += 2) ns.push(n);
  for (const bar of BAR_NAMES) {
    const as1 = barByName(bar).as;
    for (const n of ns) {
      const As = n * as1;
      const rho = As / Ag;
      if (rho + 1e-9 < 0.01 || rho > 0.04 + 1e-9) continue;
      const score = Math.abs(rho - target) + (bar === '1"' ? 0.0006 : 0) + (bar === '1/2"' && Ag > 1600 ? 0.0012 : 0) + (n > 16 ? 0.0003 : 0);
      if (!best || score < best.score) best = { n, bar, As, rho, score };
    }
  }
  if (!best) return null;
  return { n: best.n, bar: best.bar, As: best.As, rho: best.rho };
}

function fromCatalog(s: ColproSection): ColumnaTipo | null {
  if (s.shape !== "rect" && s.shape !== "circ") return null;
  const As = sectionAs(s);
  const Ag = s.shape === "circ" ? (Math.PI * (s.b / 2) ** 2) : s.b * s.h;
  if (Ag < 1) return null;
  const nBar = Math.max(s.shape === "circ" ? 6 : 4, nBarsSteel(s.steel));
  const parts = s.steel.match(/Ø\s*([\d\s/]+")/);
  const bar = (parts?.[1] ?? '3/4"').replace(/\s+/g, "");
  return {
    id: s.id,
    shape: s.shape,
    b: s.b,
    h: s.h,
    steel: s.steel.replace(/\s+/g, " ").trim(),
    As,
    nBar,
    bar,
    rho: As / Ag,
    source: "catalogo",
  };
}

function keyOf(t: { shape: string; b: number; h: number; steel: string }) {
  const st = t.steel.replace(/\s+/g, "").toLowerCase();
  return `${t.shape}|${t.b}x${t.h}|${st}`;
}

let CACHE: ColumnaTipo[] | null = null;

export function catalogoColumnas(): ColumnaTipo[] {
  if (CACHE) return CACHE;
  const list: ColumnaTipo[] = [];
  const seen = new Set<string>();
  for (const s of COLPRO_SECTIONS) {
    const t = fromCatalog(s);
    if (!t || t.rho < 0.009 || t.rho > 0.045) continue;
    const k = keyOf(t);
    if (seen.has(k)) continue;
    seen.add(k);
    list.push(t);
  }
  for (const [b, h] of RECT_SIZES) {
    const Ag = b * h;
    for (const tgt of TARGETS) {
      const pick = pickSteel(Ag, h / b >= 1.8 ? 6 : 4, tgt);
      if (!pick) continue;
      if (Math.abs(pick.rho - tgt) > 0.0045) continue;
      const steel = `${pick.n} Ø ${pick.bar}`;
      const t: ColumnaTipo = {
        id: `g-${b}x${h}-${pick.n}-${pick.bar.replace(/"/g, "")}`,
        shape: "rect",
        b,
        h,
        steel,
        As: Math.round(pick.As * 100) / 100,
        nBar: pick.n,
        bar: pick.bar,
        rho: pick.rho,
        source: "motor",
      };
      const k = keyOf(t);
      if (seen.has(k)) continue;
      seen.add(k);
      list.push(t);
    }
  }
  for (const D of CIRC_D) {
    const Ag = Math.PI * (D / 2) ** 2;
    for (const tgt of TARGETS) {
      const pick = pickSteel(Ag, 6, tgt);
      if (!pick) continue;
      if (Math.abs(pick.rho - tgt) > 0.0045) continue;
      const steel = `${pick.n} Ø ${pick.bar}`;
      const t: ColumnaTipo = {
        id: `g-D${D}-${pick.n}-${pick.bar.replace(/"/g, "")}`,
        shape: "circ",
        b: D,
        h: D,
        steel,
        As: Math.round(pick.As * 100) / 100,
        nBar: pick.n,
        bar: pick.bar,
        rho: pick.rho,
        source: "motor",
      };
      const k = keyOf(t);
      if (seen.has(k)) continue;
      seen.add(k);
      list.push(t);
    }
  }
  list.sort((a, b) => a.shape.localeCompare(b.shape) || a.b - b.b || a.h - b.h || a.rho - b.rho);
  CACHE = list;
  return list;
}

export function tipoById(id: string): ColumnaTipo | undefined {
  return catalogoColumnas().find((t) => t.id === id);
}

export function cuantiaBandOf(rho: number): string {
  return rhoBand(rho);
}

export const CUANTIA_BANDS = [
  { value: "todas", label: "Todas las cuantías (1 %–4 %)" },
  { value: "1.0-1.5", label: "ρg 1.0 % – 1.5 %" },
  { value: "1.5-2.0", label: "ρg 1.5 % – 2.0 %" },
  { value: "2.0-2.5", label: "ρg 2.0 % – 2.5 %" },
  { value: "2.5-3.0", label: "ρg 2.5 % – 3.0 %" },
  { value: "3.0-4.0", label: "ρg 3.0 % – 4.0 %" },
];

export function labelTipo(t: ColumnaTipo): string {
  const geom = t.shape === "circ" ? `Ø ${t.b} cm` : `${t.b}×${t.h} cm`;
  const rho = `${(t.rho * 100).toFixed(2)} %`;
  return `${geom} · ${t.steel} · ρg ${rho}`;
}

export function opcionesColumna(forma: string, band: string): { value: string; label: string }[] {
  if (forma === "custom") return [{ value: "custom", label: "Personalizada — el motor genera φPn–φMn" }];
  if (forma === "L" || forma === "T") {
    return COLPRO_SECTIONS.filter((s) => s.shape === forma).map((s) => ({
      value: s.id,
      label: `${s.shape} ${s.b}×${s.h} cm · ${s.steel.replace(/\s+/g, " ").trim()}`,
    }));
  }
  const shape = forma === "circ" ? "circ" : "rect";
  return catalogoColumnas()
    .filter((t) => t.shape === shape)
    .filter((t) => band === "todas" || band === "" || rhoBand(t.rho) === band)
    .map((t) => ({ value: t.id, label: labelTipo(t) }));
}

export function firstTipoId(forma: string, band: string): string {
  if (forma === "custom") return "custom";
  return opcionesColumna(forma, band)[0]?.value ?? "custom";
}

export function toColproSection(t: ColumnaTipo): ColproSection {
  return {
    id: t.id,
    name: labelTipo(t),
    shape: t.shape,
    b: t.b,
    h: t.h,
    steel: t.steel,
    As: t.As,
    m3: [],
    m2: [],
  };
}

export function resolveSection(id: string): ColproSection | undefined {
  const cat = COLPRO_SECTIONS.find((s) => s.id === id);
  if (cat) return cat;
  const t = tipoById(id);
  return t ? toColproSection(t) : undefined;
}

