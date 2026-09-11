export type FieldKind = "number" | "select" | "text" | "textarea";

export type FieldDef = {
  key: string;
  label: string;
  unit?: string;
  group: string;
  kind?: FieldKind;
  step?: number;
  min?: number;
  max?: number;
  options?: { value: string; label: string; desc?: string }[];
  hint?: string;
  wide?: boolean;
  readOnly?: boolean;
};

export type CalcStep = {
  n: string;
  title: string;
  formula?: string;
  /** Versión en LaTeX de `formula`, renderizada con KaTeX (pantalla, impresión/PDF y Word). Si no está presente, se usa `formula` como texto plano. */
  formulaTex?: string;
  substitution?: string;
  result: string;
  note?: string;
  ok?: boolean;
  /** Líneas de desarrollo numérico (aritmética intermedia). */
  desarrollo?: string[];
  /** Cuadro de metrado o resumen, pegado al paso (estilo hoja de cálculo). */
  table?: { caption?: string; headers: string[]; rows: string[][] };
};

export type CalcCheck = {
  label: string;
  value: string;
  limit: string;
  ok: boolean;
};

export type CalcOutput = {
  steps: CalcStep[];
  checks: CalcCheck[];
  headline: string;
  adoption: string;
  extras?: { title: string; rows: string[][] }[];
  dims?: Record<string, string>;
};

export type Engine = (raw: Record<string, string>) => CalcOutput;

export type ModuleDef = {
  slug: string;
  title: string;
  short: string;
  specialty: string;
  norma: string;
  source: string;
  status: "ready";
  fields: FieldDef[];
  defaults: Record<string, string>;
  engine: string;
  diagram: string;
};

export function num(raw: Record<string, string>, key: string, fallback = 0) {
  const s = String(raw[key] ?? "").trim().replace(",", ".");
  if (s === "") return fallback;
  const v = Number(s);
  return Number.isFinite(v) ? v : fallback;
}

export function str(raw: Record<string, string>, key: string, fallback = "") {
  return String(raw[key] ?? fallback);
}

export function fmt(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-PE", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function fmt0(n: number) {
  return fmt(n, 0);
}

export function round5(n: number) {
  return Math.ceil(n / 5) * 5;
}

export function roundUp(n: number, step = 5) {
  return Math.ceil(n / step) * step;
}

export const BARS = [
  { name: '3/8"', db: 0.95, as: 0.71 },
  { name: '1/2"', db: 1.27, as: 1.29 },
  { name: '5/8"', db: 1.59, as: 1.99 },
  { name: '3/4"', db: 1.91, as: 2.84 },
  { name: '1"', db: 2.54, as: 5.07 },
  { name: '1 3/8"', db: 3.49, as: 9.58 },
];

export type BarDef = { name: string; db: number; as: number };

export const BAR_OPTIONS = BARS.map((b) => ({ value: b.name, label: `Ø ${b.name}` }));

export const SLAB_BAR_OPTIONS = [
  { value: '1/4"', label: 'Ø 1/4"' },
  { value: "8 mm", label: "Ø 8 mm" },
  ...BAR_OPTIONS,
];

/** E.060 10.9.1: ρg mín = 1 % en columnas. Elige n y Ø comercial sin bajar de Asmín. */
export function proponerAceroColumna(Ag: number, hSobreB = 1) {
  const Asmin = Math.max(0.01 * Math.max(Ag, 1), 0.01);
  const ns = hSobreB >= 1.8 ? [6, 8, 10, 12] : [4, 6, 8, 10, 12];
  const names = ['5/8"', '3/4"', '1"'] as const;
  let best: { n: number; name: string; As: number; rho: number; score: number } | null = null;
  for (const name of names) {
    const bar = barByName(name);
    for (const n of ns) {
      const As = n * bar.as;
      if (As + 1e-9 < Asmin) continue;
      const rho = As / Ag;
      if (rho > 0.04 + 1e-9) continue;
      const score = Math.abs(rho - 0.012) + (n > 8 ? 0.0015 : 0) + (name === '1"' ? 0.001 : 0);
      if (!best || score < best.score) best = { n, name, As, rho, score };
    }
  }
  if (!best) {
    const bar = barByName('1"');
    const n = Math.max(hSobreB >= 1.8 ? 6 : 4, Math.ceil(Asmin / bar.as));
    best = { n, name: '1"', As: n * bar.as, rho: (n * bar.as) / Ag, score: 9 };
  }
  return {
    n: best.n,
    name: best.name,
    As: best.As,
    Asmin,
    rho: best.rho,
    text: `${best.n} Ø ${best.name}`,
  };
}

export function barByName(name: string): BarDef {
  const extra: BarDef[] = [
    { name: '1/4"', db: 0.64, as: 0.32 },
    { name: "8 mm", db: 0.8, as: 0.5 },
  ];
  return BARS.find((b) => b.name === name) ?? extra.find((b) => b.name === name) ?? BARS[0];
}

export function layoutSteel(As: number, bar: BarDef, kind: "joist" | "slab", h = 15) {
  const need = Math.max(As, 0);
  if (kind === "joist") {
    const pick = layoutJoistBars(need, bar);
    return {
      n: pick.n,
      s: 0,
      AsProv: pick.AsProv,
      barName: pick.bar.name,
      text: `${pick.n} Ø ${pick.bar.name}`,
      detail: `${fmt(pick.AsProv, 2)} cm²`,
    };
  }
  const sMax = Math.min(3 * h, 45);
  const sNeed = (bar.as / Math.max(need, 1e-9)) * 100;
  const s = Math.max(8, Math.min(sMax, Math.floor(sNeed / 5) * 5 || 8));
  const AsProv = (bar.as / s) * 100;
  return { n: 0, s, AsProv, barName: bar.name, text: `Ø ${bar.name} @ ${s} cm`, detail: `${fmt(AsProv, 2)} cm²/m` };
}

/** Nervio: prioriza 1 barra de mayor Ø antes que 2 Ø 3/8″. */
export function layoutJoistBars(need: number, prefer?: BarDef) {
  const order = ['3/8"', '1/2"', '5/8"', '3/4"', '1"'];
  const start = prefer ? Math.max(0, order.indexOf(prefer.name)) : 0;
  const allowed = order.slice(start);
  const tryGroup = (maxN: number, names: string[]) => {
    const hits: { n: number; bar: BarDef; AsProv: number }[] = [];
    for (const name of names) {
      if (!allowed.includes(name)) continue;
      const b = barByName(name);
      const n = Math.max(1, Math.ceil(need / b.as - 1e-9));
      if (n <= maxN && n * b.as + 1e-9 >= need) hits.push({ n, bar: b, AsProv: n * b.as });
    }
    hits.sort((a, c) => a.n - c.n || a.AsProv - c.AsProv || a.bar.db - c.bar.db);
    return hits[0] ?? null;
  };
  const pick =
    tryGroup(1, ['3/8"', '1/2"', '5/8"', '3/4"', '1"']) ||
    tryGroup(2, ['1/2"', '5/8"', '3/4"', '1"']) ||
    tryGroup(3, ['1/2"', '5/8"', '3/4"', '1"']) ||
    tryGroup(4, ['5/8"', '3/4"', '1"']);
  if (pick) return pick;
  const b = barByName('1"');
  const n = Math.max(1, Math.ceil(need / b.as - 1e-9));
  return { n, bar: b, AsProv: n * b.as };
}

export function pickBars(As: number, prefer: string[] = ['1/2"', '5/8"', '3/4"']) {
  let best = { text: "—", n: 0, bar: BARS[1], s: 0 };
  for (const name of prefer) {
    const bar = BARS.find((b) => b.name === name)!;
    const n = Math.max(2, Math.ceil(As / bar.as));
    const used = n * bar.as;
    if (used >= As) {
      best = { text: `${n} Ø ${name}  (As = ${fmt(used, 2)} cm²)`, n, bar, s: 0 };
      break;
    }
  }
  return best;
}

export function spacingFor(As: number, barAs: number, b = 100) {
  const s = (barAs / Math.max(As, 1e-6)) * b;
  return Math.min(25, Math.max(8, Math.floor(s)));
}

export function rad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function beta1(fc: number) {
  if (fc <= 280) return 0.85;
  return Math.max(0.65, 0.85 - 0.05 * ((fc - 280) / 70));
}

export function Ec(fc: number) {
  return 15000 * Math.sqrt(fc);
}

export function fr(fc: number) {
  return 2 * Math.sqrt(fc);
}
