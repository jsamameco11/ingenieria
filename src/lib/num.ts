export const G = 9.81;

export function round(n: number, d = 3): number {
  if (!Number.isFinite(n)) return NaN;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function fmt(n: number, d = 3): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e6)) return n.toExponential(3);
  return n.toLocaleString("es-PE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
}

export function fmtFixed(n: number, d = 3): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-PE", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}
