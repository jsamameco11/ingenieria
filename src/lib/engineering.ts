export type FieldType = "number" | "select" | "text";

export type Field = {
  key: string;
  label: string;
  unit?: string;
  type: FieldType;
  group: string;
  step?: number;
  options?: { value: string; label: string }[];
};

export type CheckResult = {
  id: string;
  label: string;
  value: string;
  limit: string;
  ok: boolean;
  note?: string;
};

export type CalcStep = {
  title: string;
  formula: string;
  substitution: string;
  result: string;
  unit?: string;
  note?: string;
};

export type CalcOutput = {
  title: string;
  summary: string;
  geometry: Record<string, number | string>;
  steps: CalcStep[];
  checks: CheckResult[];
  steel?: { zone: string; bars: string; spacing?: string; As: string }[];
  notes: string[];
};

export type Inputs = Record<string, number | string>;

export const BARS = [
  { name: '3/8"', db: 0.95, As: 0.71 },
  { name: '1/2"', db: 1.27, As: 1.29 },
  { name: '5/8"', db: 1.59, As: 1.98 },
  { name: '3/4"', db: 1.91, As: 2.85 },
  { name: '7/8"', db: 2.22, As: 3.87 },
  { name: '1"', db: 2.54, As: 5.07 },
  { name: '1 1/8"', db: 2.86, As: 6.41 },
  { name: '1 3/8"', db: 3.49, As: 9.58 },
] as const;

export function fmt(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-PE", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function num(v: number | string | undefined, fallback = 0) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

export function deg(rad: number) {
  return (rad * 180) / Math.PI;
}

export function rad(degVal: number) {
  return (degVal * Math.PI) / 180;
}

export function beta1(fc: number) {
  if (fc <= 280) return 0.85;
  return Math.max(0.65, 0.85 - 0.05 * ((fc - 280) / 70));
}

export function pickBars(AsReq: number, barName = '5/8"') {
  const bar = BARS.find((b) => b.name === barName) ?? BARS[2];
  const n = Math.max(2, Math.ceil(AsReq / bar.As));
  return { n, bar, AsProv: n * bar.As };
}

export function spacingForAs(AsReq: number, bCm: number, barName = '5/8"') {
  const bar = BARS.find((b) => b.name === barName) ?? BARS[2];
  const s = (bar.As * bCm) / Math.max(AsReq, 0.001);
  const sAdopt = Math.min(20, Math.max(8, Math.floor(s / 0.5) * 0.5));
  return { bar, s, sAdopt, AsProv: (bar.As * bCm) / sAdopt };
}

export function coulombKa(phi: number, delta: number, beta: number, theta = 90) {
  const p = rad(phi);
  const d = rad(delta);
  const b = rad(beta);
  const t = rad(theta);
  const numera = Math.sin(t + p) ** 2;
  const inner =
    Math.sin(p + d) * Math.sin(p - b) / Math.max(Math.sin(t - d) * Math.sin(t + b), 1e-9);
  const den = Math.sin(t) ** 2 * Math.sin(t - d) * (1 + Math.sqrt(Math.max(inner, 0))) ** 2;
  return numera / Math.max(den, 1e-9);
}

export function rankineKa(phi: number) {
  return Math.tan(rad(45 - phi / 2)) ** 2;
}

export function mononobeOkabeKae(phi: number, delta: number, beta: number, kh: number, kv = 0, theta = 90) {
  const psi = Math.atan(kh / Math.max(1 - kv, 1e-6));
  const p = rad(phi);
  const d = rad(delta);
  const b = rad(beta);
  const t = rad(theta);
  const numera = Math.sin(t + p - psi) ** 2;
  const inner =
    (Math.sin(p + d) * Math.sin(p - b - psi)) /
    Math.max(Math.sin(t - d + psi) * Math.sin(t + b), 1e-9);
  const den =
    Math.cos(psi) *
    Math.sin(t) ** 2 *
    Math.sin(t - d + psi) *
    (1 + Math.sqrt(Math.max(inner, 0))) ** 2;
  return numera / Math.max(den, 1e-9);
}

export function whitneyFlexure(MuTm: number, bCm: number, dCm: number, fc: number, fy: number, phi = 0.9) {
  const MuKgCm = MuTm * 100000;
  const Ru = MuKgCm / (phi * bCm * dCm * dCm);
  const m = fy / (0.85 * fc);
  const disc = 1 - (2 * Ru) / (0.85 * fc);
  const rho = disc > 0 ? (0.85 * fc / fy) * (1 - Math.sqrt(disc)) : 0.021;
  const As = rho * bCm * dCm;
  const a = (As * fy) / (0.85 * fc * bCm);
  const Asmin = Math.max((0.8 * Math.sqrt(fc) / fy) * bCm * dCm, (14 / fy) * bCm * dCm);
  const rhoMax = 0.75 * (0.85 * beta1(fc) * (fc / fy) * (6000 / (6000 + fy)));
  return { Ru, rho, As, a, Asmin, AsUse: Math.max(As, Asmin), rhoMax, ok: rho <= rhoMax };
}

export function vcE060(fc: number, b: number, d: number) {
  return 0.53 * Math.sqrt(fc) * b * d;
}
