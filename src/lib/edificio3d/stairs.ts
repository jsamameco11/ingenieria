import type { StairKind } from "./types";

export const STAIR_TYPES: {
  id: StairKind;
  name: string;
  clicks: number;
  width: number;
  hint: string;
}[] = [
  { id: "recta", name: "Recta · 1 tramo", clicks: 2, width: 1.2, hint: "Clic en arranque y luego en la llegada." },
  { id: "ele", name: "En L · 2 tramos", clicks: 3, width: 1.2, hint: "Arranque, esquina del descanso y llegada." },
  { id: "u", name: "En U · ida y vuelta", clicks: 2, width: 1.2, hint: "Arranque y llegada (el hueco queda entre ambos)." },
  { id: "caracol", name: "Caracol", clicks: 2, width: 1.0, hint: "Centro del ojo y un punto del radio." },
  { id: "tresTramos", name: "Tres tramos", clicks: 2, width: 1.2, hint: "Arranque y llegada opuesta; dos descansos." },
];

export function stairClicks(kind: StairKind) {
  return STAIR_TYPES.find((s) => s.id === kind)?.clicks ?? 2;
}

export function stairHint(kind: StairKind) {
  return STAIR_TYPES.find((s) => s.id === kind)?.hint ?? "";
}

export function stairFlights(
  kind: StairKind,
  pts: { x: number; y: number }[],
  width: number
): { a: { x: number; y: number }; b: { x: number; y: number } }[] {
  if (pts.length < 2) return [];
  if (kind === "recta") return [{ a: pts[0], b: pts[1] }];
  if (kind === "ele" && pts.length >= 3) {
    return [
      { a: pts[0], b: pts[1] },
      { a: pts[1], b: pts[2] },
    ];
  }
  if (kind === "u") {
    const a = pts[0];
    const b = pts[1];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const px = (-dy / L) * (width + 0.2);
    const py = (dx / L) * (width + 0.2);
    const c = { x: a.x + px, y: a.y + py };
    const d = { x: b.x + px, y: b.y + py };
    return [
      { a, b: { x: mx + (a.x - mx) * 0.15, y: my + (a.y - my) * 0.15 } },
      { a: c, b: d },
    ];
  }
  if (kind === "caracol") {
    const c = pts[0];
    const r = Math.max(0.7, Math.hypot(pts[1].x - c.x, pts[1].y - c.y));
    const n = 8;
    const out: { a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * Math.PI * 1.5;
      const t1 = ((i + 1) / n) * Math.PI * 1.5;
      out.push({
        a: { x: c.x + r * Math.cos(t0), y: c.y + r * Math.sin(t0) },
        b: { x: c.x + r * Math.cos(t1), y: c.y + r * Math.sin(t1) },
      });
    }
    return out;
  }
  const a = pts[0];
  const b = pts[1];
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const w = width + 0.15;
  const p1 = { x: a.x + nx * w, y: a.y + ny * w };
  const p2 = { x: b.x + nx * w, y: b.y + ny * w };
  return [
    { a, b: { x: mx + nx * w * 0.2, y: my + ny * w * 0.2 } },
    { a: p1, b: p2 },
    { a: { x: mx - nx * w * 0.2, y: my - ny * w * 0.2 }, b },
  ];
}
