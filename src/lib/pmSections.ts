import { barByName } from "./types";
import { finalizeSection, type BarPt, type Pt, type SectionModel } from "./pmFiber";

function rect(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

function circle(cx: number, cy: number, R: number, n = 48): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
}

function perimeterLen(poly: Pt[]): number {
  let L = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    L += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return L;
}

function pointAlong(poly: Pt[], sWant: number): Pt {
  const L = perimeterLen(poly);
  let s = ((sWant % L) + L) % L;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (s <= d || i === poly.length - 1) {
      const t = d < 1e-9 ? 0 : s / d;
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    }
    s -= d;
  }
  return poly[0];
}

function signedArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function unit(x: number, y: number): Pt {
  const n = Math.hypot(x, y) || 1;
  return { x: x / n, y: y / n };
}

/** Desplaza el contorno hacia adentro (recubrimiento), con normal local — no hacia el centroide. */
export function offsetPolygon(poly: Pt[], dist: number): Pt[] {
  const n = poly.length;
  if (n < 3 || dist === 0) return poly.map((p) => ({ ...p }));
  const ccw = signedArea(poly) >= 0;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = poly[(i + n - 1) % n];
    const cur = poly[i];
    const next = poly[(i + 1) % n];
    const e1 = unit(cur.x - prev.x, cur.y - prev.y);
    const e2 = unit(next.x - cur.x, next.y - cur.y);
    const n1 = ccw ? { x: -e1.y, y: e1.x } : { x: e1.y, y: -e1.x };
    const n2 = ccw ? { x: -e2.y, y: e2.x } : { x: e2.y, y: -e2.x };
    const bx = n1.x + n2.x;
    const by = n1.y + n2.y;
    const bis = unit(bx, by);
    const cos = Math.max(0.22, bis.x * n1.x + bis.y * n1.y);
    out.push({ x: cur.x + (bis.x * dist) / cos, y: cur.y + (bis.y * dist) / cos });
  }
  return out;
}

export function pointInPoly(poly: Pt[], p: Pt): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const hit = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-15) + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

export function barInside(outer: Pt[], holes: Pt[][], p: Pt): boolean {
  if (!pointInPoly(outer, p)) return false;
  return !holes.some((h) => h.length >= 3 && pointInPoly(h, p));
}

export function encodePoly(pts: Pt[]): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(";");
}

export function parsePolyText(raw: string): Pt[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  const pts: Pt[] = [];
  for (const line of text.split(/[\n;]+/)) {
    const t = line.trim();
    if (!t || t === "|") continue;
    const parts = t.split(/[,\t\s]+/).map((s) => Number(s.replace(",", "."))).filter((n) => Number.isFinite(n));
    if (parts.length >= 2) pts.push({ x: parts[0], y: parts[1] });
  }
  return pts;
}

export function encodeBars(bars: BarPt[]): string {
  return bars.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.As.toFixed(3)}`).join(";");
}

export function parseBarsText(raw: string): BarPt[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  const bars: BarPt[] = [];
  for (const line of text.split(/[\n;]+/)) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split(/[,\t\s]+/).map((s) => Number(s.replace(",", "."))).filter((n) => Number.isFinite(n));
    if (parts.length >= 2) bars.push({ x: parts[0], y: parts[1], As: parts[2] > 0 ? parts[2] : 0 });
  }
  return bars;
}

export function parseHolesText(raw: string): Pt[][] {
  return String(raw ?? "")
    .split("|")
    .map(parsePolyText)
    .filter((h) => h.length >= 3);
}

function polyCentroid(poly: Pt[]): Pt {
  const a = signedArea(poly);
  if (Math.abs(a) < 1e-9) {
    const sx = poly.reduce((s, p) => s + p.x, 0);
    const sy = poly.reduce((s, p) => s + p.y, 0);
    const n = Math.max(poly.length, 1);
    return { x: sx / n, y: sy / n };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const c = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/** Si la barra queda fuera, la mete solo en X o solo en Y. Nunca en diagonal (eso desarma la retícula). */
export function projectBarInside(outer: Pt[], holes: Pt[][], p: Pt): Pt | null {
  if (barInside(outer, holes, p)) return p;
  const g = polyCentroid(outer);
  for (let t = 0.96; t >= 0.08; t -= 0.04) {
    const qx = { x: g.x + (p.x - g.x) * t, y: p.y };
    if (barInside(outer, holes, qx)) return qx;
  }
  for (let t = 0.96; t >= 0.08; t -= 0.04) {
    const qy = { x: p.x, y: g.y + (p.y - g.y) * t };
    if (barInside(outer, holes, qy)) return qy;
  }
  return null;
}

export function keepBars(outer: Pt[], holes: Pt[][], bars: BarPt[], minDist = 1.15): BarPt[] {
  const out: BarPt[] = [];
  for (const b of bars) {
    if (b.As <= 0) continue;
    const q = projectBarInside(outer, holes, { x: b.x, y: b.y });
    if (!q) continue;
    const s = { x: snapCm(q.x), y: snapCm(q.y), As: b.As };
    if (out.some((p) => Math.hypot(p.x - s.x, p.y - s.y) < minDist)) continue;
    out.push(s);
  }
  return out;
}

/** Recubrimiento al eje de barra, sin salir del espesor. cover < 0 = hacia afuera (cara interior). */
function fitCover(spanW: number, spanH: number, cover: number): number {
  const sign = cover < 0 ? -1 : 1;
  const mag = Math.abs(cover);
  const maxC = Math.min(spanW, spanH) / 2 - 0.35;
  return sign * Math.max(0.35, Math.min(mag, Math.max(maxC, 0.35)));
}

export function barsOnPerimeter(poly: Pt[], nBar: number, AsEach: number, cover: number): BarPt[] {
  const n = Math.max(0, Math.round(nBar));
  if (n <= 0 || AsEach <= 0 || poly.length < 3) return [];
  const inset = offsetPolygon(poly, Math.max(cover, 0.4));
  const L = perimeterLen(inset);
  if (L < 1e-6) return [];
  const bars: BarPt[] = [];
  for (let i = 0; i < n; i++) {
    const q = pointAlong(inset, (i + 0.5) * (L / n));
    const inside = projectBarInside(poly, [], q);
    if (inside) bars.push({ x: inside.x, y: inside.y, As: AsEach });
  }
  return bars;
}

/** Barras en retícula de perímetro: esquinas + lados alineados (no recorrido a ciegas). */
export function barsOnRect(x0: number, y0: number, x1: number, y1: number, nBar: number, AsEach: number, cover: number): BarPt[] {
  const n = Math.max(4, Math.round(nBar));
  const spanW = x1 - x0;
  const spanH = y1 - y0;
  const c = fitCover(spanW, spanH, cover);
  const xa = x0 + c;
  const xb = x1 - c;
  const ya = y0 + c;
  const yb = y1 - c;
  const w = xb - xa;
  const h = yb - ya;
  if (w < 0.2 || h < 0.2) return [];
  const per = 2 * (w + h);
  let nx = Math.max(2, Math.round((n * w) / per) + 1);
  let ny = Math.max(2, Math.round(n / 2 + 2 - nx));
  const count = () => 2 * (nx + ny - 2);
  while (count() < n) {
    if (w / Math.max(nx - 1, 1) >= h / Math.max(ny - 1, 1)) nx += 1;
    else ny += 1;
  }
  while (count() > n && (nx > 2 || ny > 2)) {
    if (w / Math.max(nx - 1, 1) <= h / Math.max(ny - 1, 1) && nx > 2) nx -= 1;
    else if (ny > 2) ny -= 1;
    else nx -= 1;
  }
  const pts: BarPt[] = [];
  const put = (x: number, y: number) => pts.push({ x, y, As: AsEach });
  for (let i = 0; i < nx; i++) {
    const x = xa + (i / Math.max(nx - 1, 1)) * w;
    put(x, ya);
    put(x, yb);
  }
  for (let j = 1; j < ny - 1; j++) {
    const y = ya + (j / Math.max(ny - 1, 1)) * h;
    put(xa, y);
    put(xb, y);
  }
  return pts;
}

function meshRect(x0: number, y0: number, x1: number, y1: number, sx: number, sy: number, AsEach: number, cover: number): BarPt[] {
  const c = fitCover(x1 - x0, y1 - y0, cover);
  const xa = x0 + c;
  const xb = x1 - c;
  const ya = y0 + c;
  const yb = y1 - c;
  if (xb - xa < 0.2 || yb - ya < 0.2) return [];
  const nx = Math.max(2, Math.round((xb - xa) / Math.max(sx, 4)) + 1);
  const ny = Math.max(2, Math.round((yb - ya) / Math.max(sy, 4)) + 1);
  const bars: BarPt[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const edge = i === 0 || i === nx - 1 || j === 0 || j === ny - 1;
      if (!edge) continue;
      bars.push({
        x: xa + (i / Math.max(nx - 1, 1)) * (xb - xa),
        y: ya + (j / Math.max(ny - 1, 1)) * (yb - ya),
        As: AsEach,
      });
    }
  }
  return bars;
}

export type SectionInput = {
  forma: string;
  b: number;
  h: number;
  tw: number;
  tf: number;
  tWall: number;
  rec: number;
  dest: number;
  bar: string;
  nBar: number;
  barBE: string;
  nBarBE: number;
  /** Barras de alma por tramo (entre núcleos). */
  nBarAlma?: number;
  /** Barras de ala / placa por tramo. Si falta, se usa nBarAlma. */
  nBarAla?: number;
  bBE: number;
  hBE: number;
  barMalla: string;
  sMalla: number;
  nInner: number;
  polyUser?: string;
  holesUser?: string;
  barsUser?: string;
};

export type SteelZone = {
  kind: "conf" | "alma";
  plate?: "ala" | "alma";
  along?: "x" | "y";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  label: string;
};

function snapCm(v: number) {
  return Math.round(v * 2) / 2;
}

function zoneOk(z: Pick<SteelZone, "x0" | "y0" | "x1" | "y1">) {
  return z.x1 - z.x0 >= 4 && z.y1 - z.y0 >= 4;
}

function tipLen(room: number, want: number, minBe: number) {
  if (room < minBe) return 0;
  if (room < minBe + 6) return room;
  return Math.min(Math.max(want, minBe), room - 6);
}

function insetFixed(x0: number, y0: number, x1: number, y1: number, cover: number) {
  const xa = snapCm(x0 + cover);
  const xb = snapCm(x1 - cover);
  const ya = snapCm(y0 + cover);
  const yb = snapCm(y1 - cover);
  if (xb - xa < 0.4 || yb - ya < 0.4) return null;
  return { xa, xb, ya, yb };
}

function barsInConf(x0: number, y0: number, x1: number, y1: number, nBar: number, As: number, cover: number): BarPt[] {
  const n = Math.max(0, Math.round(nBar));
  const box = insetFixed(x0, y0, x1, y1, cover);
  if (n <= 0 || As <= 0 || !box) return [];
  const { xa, xb, ya, yb } = box;
  const w = xb - xa;
  const h = yb - ya;
  if (n === 1) return [{ x: snapCm((xa + xb) / 2), y: snapCm((ya + yb) / 2), As }];
  if (n === 2) {
    return w >= h
      ? [
          { x: xa, y: snapCm((ya + yb) / 2), As },
          { x: xb, y: snapCm((ya + yb) / 2), As },
        ]
      : [
          { x: snapCm((xa + xb) / 2), y: ya, As },
          { x: snapCm((xa + xb) / 2), y: yb, As },
        ];
  }
  if (n === 3) {
    const mid = w >= h ? snapCm((ya + yb) / 2) : snapCm((xa + xb) / 2);
    return [0, 0.5, 1].map((t) =>
      w >= h ? { x: snapCm(xa + t * w), y: mid, As } : { x: mid, y: snapCm(ya + t * h), As },
    );
  }
  const per = 2 * (w + h);
  let nx = Math.max(2, Math.round((n * w) / per) + 1);
  let ny = Math.max(2, Math.round(n / 2 + 2 - nx));
  const count = () => 2 * (nx + ny - 2);
  while (count() < n) {
    if (w / Math.max(nx - 1, 1) >= h / Math.max(ny - 1, 1)) nx += 1;
    else ny += 1;
  }
  while (count() > n && (nx > 2 || ny > 2)) {
    if (w / Math.max(nx - 1, 1) <= h / Math.max(ny - 1, 1) && nx > 2) nx -= 1;
    else if (ny > 2) ny -= 1;
    else nx -= 1;
  }
  const pts: BarPt[] = [];
  for (let i = 0; i < nx; i++) {
    const x = snapCm(xa + (i / Math.max(nx - 1, 1)) * w);
    pts.push({ x, y: ya, As }, { x, y: yb, As });
  }
  for (let j = 1; j < ny - 1; j++) {
    const y = snapCm(ya + (j / Math.max(ny - 1, 1)) * h);
    pts.push({ x: xa, y, As }, { x: xb, y, As });
  }
  return pts;
}

/** n estaciones entre núcleos, dos caras, misma retícula X/Y que el confinamiento. */
function barsInPlate(z: SteelZone, nAlong: number, As: number, cover: number): BarPt[] {
  const n = Math.max(0, Math.round(nAlong));
  const box = insetFixed(z.x0, z.y0, z.x1, z.y1, cover);
  if (n <= 0 || As <= 0 || !box) return [];
  const { xa, xb, ya, yb } = box;
  const alongX = z.along ? z.along === "x" : xb - xa >= yb - ya;
  if (alongX && xb - xa < 2) return [];
  if (!alongX && yb - ya < 2) return [];
  const bars: BarPt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    if (alongX) {
      const x = snapCm(xa + t * (xb - xa));
      bars.push({ x, y: ya, As }, { x, y: yb, As });
    } else {
      const y = snapCm(ya + t * (yb - ya));
      bars.push({ x: xa, y, As }, { x: xb, y, As });
    }
  }
  return bars;
}

/** Núcleos en intersecciones y extremos + alma/ala entre ellos, retícula eje-alineada. */
export function profileZones(forma: string, d: { b: number; h: number; tw: number; tf: number; be: number; cover?: number }): SteelZone[] {
  const b = d.b;
  const h = d.h;
  const tw = d.tw;
  const tf = d.tf;
  const minBe = Math.max(8, 2 * (d.cover ?? 5) + 3);
  const zones: SteelZone[] = [];
  const add = (z: SteelZone) => {
    if (zoneOk(z)) zones.push(z);
  };

  if (forma === "C") {
    const room = b - tw;
    const be = tipLen(room, d.be, minBe);
    add({ kind: "conf", x0: 0, y0: 0, x1: tw, y1: tf, label: "Núcleo 1 · intersección" });
    if (be > 0) add({ kind: "conf", x0: b - be, y0: 0, x1: b, y1: tf, label: "Núcleo 2 · extremo ala" });
    add({ kind: "conf", x0: 0, y0: h - tf, x1: tw, y1: h, label: "Núcleo 3 · intersección" });
    if (be > 0) add({ kind: "conf", x0: b - be, y0: h - tf, x1: b, y1: h, label: "Núcleo 4 · extremo ala" });
    add({ kind: "alma", plate: "ala", along: "x", x0: tw, y0: 0, x1: be > 0 ? b - be : b, y1: tf, label: "Ala inferior" });
    add({ kind: "alma", plate: "alma", along: "y", x0: 0, y0: tf, x1: tw, y1: h - tf, label: "Alma" });
    add({ kind: "alma", plate: "ala", along: "x", x0: tw, y0: h - tf, x1: be > 0 ? b - be : b, y1: h, label: "Ala superior" });
    return zones;
  }

  if (forma === "L") {
    const beA = tipLen(b - tw, d.be, minBe);
    const beW = tipLen(h - tf, d.be, minBe);
    add({ kind: "conf", x0: 0, y0: 0, x1: tw, y1: tf, label: "Núcleo 1 · intersección" });
    if (beA > 0) add({ kind: "conf", x0: b - beA, y0: 0, x1: b, y1: tf, label: "Núcleo 2 · extremo ala" });
    if (beW > 0) add({ kind: "conf", x0: 0, y0: h - beW, x1: tw, y1: h, label: "Núcleo 3 · extremo alma" });
    add({ kind: "alma", plate: "ala", along: "x", x0: tw, y0: 0, x1: beA > 0 ? b - beA : b, y1: tf, label: "Ala" });
    add({ kind: "alma", plate: "alma", along: "y", x0: 0, y0: tf, x1: tw, y1: beW > 0 ? h - beW : h, label: "Alma" });
    return zones;
  }

  if (forma === "T") {
    const x0 = -b / 2;
    const beA = tipLen((b - tw) / 2, d.be, minBe);
    const beW = tipLen(h - tf, d.be, minBe);
    if (beW > 0) add({ kind: "conf", x0: -tw / 2, y0: 0, x1: tw / 2, y1: beW, label: "Núcleo 1 · extremo alma" });
    add({ kind: "conf", x0: -tw / 2, y0: h - tf, x1: tw / 2, y1: h, label: "Núcleo 2 · intersección" });
    if (beA > 0) add({ kind: "conf", x0, y0: h - tf, x1: x0 + beA, y1: h, label: "Núcleo 3 · extremo ala" });
    if (beA > 0) add({ kind: "conf", x0: x0 + b - beA, y0: h - tf, x1: x0 + b, y1: h, label: "Núcleo 4 · extremo ala" });
    add({ kind: "alma", plate: "alma", along: "y", x0: -tw / 2, y0: beW > 0 ? beW : 0, x1: tw / 2, y1: h - tf, label: "Alma" });
    add({ kind: "alma", plate: "ala", along: "x", x0: beA > 0 ? x0 + beA : x0, y0: h - tf, x1: -tw / 2, y1: h, label: "Ala izquierda" });
    add({ kind: "alma", plate: "ala", along: "x", x0: tw / 2, y0: h - tf, x1: beA > 0 ? x0 + b - beA : x0 + b, y1: h, label: "Ala derecha" });
    return zones;
  }

  if (forma === "I") {
    const x0 = -b / 2;
    const beA = tipLen((b - tw) / 2, d.be, minBe);
    add({ kind: "conf", x0: -tw / 2, y0: 0, x1: tw / 2, y1: tf, label: "Núcleo 1 · intersección" });
    add({ kind: "conf", x0: -tw / 2, y0: h - tf, x1: tw / 2, y1: h, label: "Núcleo 2 · intersección" });
    if (beA > 0) {
      add({ kind: "conf", x0, y0: 0, x1: x0 + beA, y1: tf, label: "Núcleo 3 · extremo ala" });
      add({ kind: "conf", x0: x0 + b - beA, y0: 0, x1: x0 + b, y1: tf, label: "Núcleo 4 · extremo ala" });
      add({ kind: "conf", x0, y0: h - tf, x1: x0 + beA, y1: h, label: "Núcleo 5 · extremo ala" });
      add({ kind: "conf", x0: x0 + b - beA, y0: h - tf, x1: x0 + b, y1: h, label: "Núcleo 6 · extremo ala" });
    }
    add({ kind: "alma", plate: "ala", along: "x", x0: beA > 0 ? x0 + beA : x0, y0: 0, x1: -tw / 2, y1: tf, label: "Ala inferior I" });
    add({ kind: "alma", plate: "ala", along: "x", x0: tw / 2, y0: 0, x1: beA > 0 ? x0 + b - beA : x0 + b, y1: tf, label: "Ala inferior D" });
    add({ kind: "alma", plate: "alma", along: "y", x0: -tw / 2, y0: tf, x1: tw / 2, y1: h - tf, label: "Alma" });
    add({ kind: "alma", plate: "ala", along: "x", x0: beA > 0 ? x0 + beA : x0, y0: h - tf, x1: -tw / 2, y1: h, label: "Ala superior I" });
    add({ kind: "alma", plate: "ala", along: "x", x0: tw / 2, y0: h - tf, x1: beA > 0 ? x0 + b - beA : x0 + b, y1: h, label: "Ala superior D" });
    return zones;
  }

  return zones;
}

export function placeProfileSteel(
  zones: SteelZone[],
  opts: { nConf: number; nAlma: number; nAla: number; cover: number; as1: number; asBE: number },
): BarPt[] {
  const bars: BarPt[] = [];
  for (const z of zones) {
    if (z.kind === "conf") bars.push(...barsInConf(z.x0, z.y0, z.x1, z.y1, opts.nConf, opts.asBE, opts.cover));
    else {
      const n = z.plate === "ala" ? opts.nAla : opts.nAlma;
      bars.push(...barsInPlate(z, n, opts.as1, opts.cover));
    }
  }
  return bars;
}

function meshByCount(x0: number, y0: number, x1: number, y1: number, nAlong: number, nFace: number, AsEach: number, cover: number): BarPt[] {
  const c = fitCover(x1 - x0, y1 - y0, cover);
  const xa = x0 + c;
  const xb = x1 - c;
  const ya = y0 + c;
  const yb = y1 - c;
  if (xb - xa < 0.2 || yb - ya < 0.2) return [];
  const alongX = xb - xa >= yb - ya;
  const nA = Math.max(2, Math.round(nAlong));
  const nF = Math.max(2, Math.round(nFace));
  const bars: BarPt[] = [];
  if (alongX) {
    for (let i = 0; i < nA; i++) {
      const x = xa + (i / Math.max(nA - 1, 1)) * (xb - xa);
      for (let j = 0; j < nF; j++) {
        const y = ya + (j / Math.max(nF - 1, 1)) * (yb - ya);
        bars.push({ x, y, As: AsEach });
      }
    }
  } else {
    for (let j = 0; j < nA; j++) {
      const y = ya + (j / Math.max(nA - 1, 1)) * (yb - ya);
      for (let i = 0; i < nF; i++) {
        const x = xa + (i / Math.max(nF - 1, 1)) * (xb - xa);
        bars.push({ x, y, As: AsEach });
      }
    }
  }
  return bars;
}

export function describeForma(forma: string): string {
  const map: Record<string, string> = {
    rect: "Rectangular",
    circ: "Circular",
    L: "En L",
    T: "En T",
    C: "En C (canal)",
    I: "En I / doble T",
    caja: "Caja / núcleo de ascensor",
    "muro-be": "Muro con elementos de borde",
    muro: "Muro rectangular",
    libre: "Section Designer (polígono libre)",
  };
  return map[forma] ?? forma;
}

/** Misma regla que el motor P–M–M: el tipo de elemento puede forzar caja o muro. */
export function resolvePmForma(tipo: string, formaPM: string, conBE = "si"): string {
  const forma = formaPM || "rect";
  if (forma === "libre") return "libre";
  if (tipo === "caja") return "caja";
  if (tipo === "nucleo" && forma !== "caja" && forma !== "C" && forma !== "I") return "caja";
  if (tipo === "muro" && (forma === "rect" || forma === "muro" || forma === "muro-be")) {
    return conBE === "no" ? "muro" : "muro-be";
  }
  return forma;
}

export function buildSection(inp: SectionInput): SectionModel {
  const rec = Math.max(inp.rec, 1.5);
  const dest = Math.max(inp.dest, 0.6);
  const db = barByName(inp.bar).db;
  const cover = rec + dest + db / 2;
  const as1 = barByName(inp.bar).as;
  const asBE = barByName(inp.barBE || inp.bar).as;
  const asM = barByName(inp.barMalla || '3/8"').as;
  const b = Math.max(inp.b, 8);
  const h = Math.max(inp.h, 8);
  const tw = Math.min(Math.max(inp.tw || 15, 8), Math.max(b - 2, 8));
  const tf = Math.min(Math.max(inp.tf || 15, 8), Math.max(h - 2, 8));
  const tWall = Math.min(Math.max(inp.tWall || 15, 8), Math.min(b, h) / 2 - 1);
  const nConf = Math.max(0, Math.round(inp.nBarBE || 4));
  const nAlma = Math.max(0, Math.round(inp.nBarAlma ?? 2));
  const nAla = Math.max(0, Math.round(inp.nBarAla ?? nAlma));
  const be = Math.min(Math.max(inp.bBE || 14, 8), 40);
  const forma = inp.forma;
  const shaped = (outer: Pt[], name: string) => {
    const zones = profileZones(forma, { b, h, tw, tf, be, cover });
    const bars = placeProfileSteel(zones, { nConf, nAlma, nAla, cover, as1, asBE });
    return finalizeSection(name, outer, [], keepBars(outer, [], bars, 1.15));
  };

  if (forma === "libre") {
    const outer = parsePolyText(inp.polyUser ?? "");
    const holes = parseHolesText(inp.holesUser ?? "");
    if (outer.length < 3) {
      const fallback = rect(-20, -20, 20, 20);
      const n = Math.max(4, Math.round(inp.nBar || 8));
      return finalizeSection("Section Designer (trazado)", fallback, [], barsOnPerimeter(fallback, n, as1, cover));
    }
    const parsed = parseBarsText(inp.barsUser ?? "").map((b) => ({
      ...b,
      As: b.As > 0 ? b.As : as1,
    }));
    const bars = parsed.filter((p) => p.As > 0 && barInside(outer, holes, p));
    const auto = bars.length === 0 ? keepBars(outer, holes, barsOnPerimeter(outer, Math.max(0, inp.nBar || 0), as1, cover)) : bars;
    return finalizeSection(`Section Designer · ${outer.length} vértices`, outer, holes, auto);
  }

  if (forma === "circ") {
    const D = b;
    const R = D / 2;
    const outer = circle(0, 0, R);
    const n = Math.max(6, Math.round(inp.nBar || 6));
    const Rc = Math.max(R - cover, 0.4);
    const bars: BarPt[] = Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { x: Rc * Math.cos(a), y: Rc * Math.sin(a), As: as1 };
    });
    return finalizeSection(`Ø ${D.toFixed(0)} cm`, outer, [], bars);
  }

  if (forma === "L") {
    const x0 = 0;
    const y0 = 0;
    const outer: Pt[] = [
      { x: x0, y: y0 },
      { x: x0 + b, y: y0 },
      { x: x0 + b, y: y0 + tf },
      { x: x0 + tw, y: y0 + tf },
      { x: x0 + tw, y: y0 + h },
      { x: x0, y: y0 + h },
    ];
    return shaped(outer, `L ${b.toFixed(0)}×${h.toFixed(0)} cm`);
  }

  if (forma === "T") {
    const x0 = -b / 2;
    const y0 = 0;
    const outer: Pt[] = [
      { x: x0, y: y0 + h - tf },
      { x: x0 + b, y: y0 + h - tf },
      { x: x0 + b, y: y0 + h },
      { x: x0, y: y0 + h },
    ];
    const web: Pt[] = [
      { x: -tw / 2, y: y0 },
      { x: tw / 2, y: y0 },
      { x: tw / 2, y: y0 + h - tf },
      { x: -tw / 2, y: y0 + h - tf },
    ];
    const flange = rect(x0, y0 + h - tf, x0 + b, y0 + h);
    const merged: Pt[] = [
      { x: -tw / 2, y: y0 },
      { x: tw / 2, y: y0 },
      { x: tw / 2, y: y0 + h - tf },
      { x: x0 + b, y: y0 + h - tf },
      { x: x0 + b, y: y0 + h },
      { x: x0, y: y0 + h },
      { x: x0, y: y0 + h - tf },
      { x: -tw / 2, y: y0 + h - tf },
    ];
    void outer;
    void web;
    void flange;
    return shaped(merged, `T ${b.toFixed(0)}×${h.toFixed(0)} cm`);
  }

  if (forma === "C") {
    const outer: Pt[] = [
      { x: 0, y: 0 },
      { x: b, y: 0 },
      { x: b, y: tf },
      { x: tw, y: tf },
      { x: tw, y: h - tf },
      { x: b, y: h - tf },
      { x: b, y: h },
      { x: 0, y: h },
    ];
    return shaped(outer, `C ${b.toFixed(0)}×${h.toFixed(0)} cm`);
  }

  if (forma === "I") {
    const x0 = -b / 2;
    const outer: Pt[] = [
      { x: x0, y: 0 },
      { x: x0 + b, y: 0 },
      { x: x0 + b, y: tf },
      { x: tw / 2, y: tf },
      { x: tw / 2, y: h - tf },
      { x: x0 + b, y: h - tf },
      { x: x0 + b, y: h },
      { x: x0, y: h },
      { x: x0, y: h - tf },
      { x: -tw / 2, y: h - tf },
      { x: -tw / 2, y: tf },
      { x: x0, y: tf },
    ];
    return shaped(outer, `I ${b.toFixed(0)}×${h.toFixed(0)} cm`);
  }

  if (forma === "caja") {
    const x0 = -b / 2;
    const y0 = -h / 2;
    const outer = rect(x0, y0, x0 + b, y0 + h);
    const xi = x0 + tWall;
    const yi = y0 + tWall;
    const holes = [rect(xi, yi, x0 + b - tWall, y0 + h - tWall)];
    const nOut = Math.max(8, inp.nBar || 12);
    const bars: BarPt[] = [...barsOnRect(x0, y0, x0 + b, y0 + h, nOut, as1, cover)];
    const nIn = Math.max(0, Math.round(inp.nInner || 0));
    if (nIn >= 4) {
      /* Cara interior: cover negativo entra al muro, no al hueco. */
      bars.push(...barsOnRect(xi, yi, x0 + b - tWall, y0 + h - tWall, nIn, as1, -cover));
    }
    const be = Math.min(Math.max(inp.bBE || 0, 0), tWall);
    const nBE = Math.max(0, Math.round(inp.nBarBE || 0));
    if (be >= 12 && nBE >= 4) {
      const corners: [number, number, number, number][] = [
        [x0, y0, x0 + be, y0 + be],
        [x0 + b - be, y0, x0 + b, y0 + be],
        [x0, y0 + h - be, x0 + be, y0 + h],
        [x0 + b - be, y0 + h - be, x0 + b, y0 + h],
      ];
      for (const [ax, ay, bx, by] of corners) {
        bars.push(...barsOnRect(ax, ay, bx, by, nBE, asBE, cover));
      }
    }
    return finalizeSection(`Caja ${b.toFixed(0)}×${h.toFixed(0)} × e ${tWall.toFixed(0)} cm`, outer, holes, keepBars(outer, holes, bars));
  }

  if (forma === "muro-be" || forma === "muro") {
    const x0 = -b / 2;
    const y0 = -h / 2;
    const outer = rect(x0, y0, x0 + b, y0 + h);
    const bars: BarPt[] = [];
    const bBE = Math.min(Math.max(inp.bBE || Math.min(b * 0.15, 60), 15), b / 2);
    const nBE = Math.max(4, Math.round(inp.nBarBE || 6));
    const sM = Math.max(inp.sMalla || 20, 8);
    if (forma === "muro-be" || (inp.nBarBE ?? 0) >= 4) {
      bars.push(...barsOnRect(x0, y0, x0 + bBE, y0 + h, nBE, asBE, cover));
      bars.push(...barsOnRect(x0 + b - bBE, y0, x0 + b, y0 + h, nBE, asBE, cover));
    }
    const web =
      nAlma >= 2
        ? meshByCount(x0 + bBE, y0, x0 + b - bBE, y0 + h, nAlma, 2, asM, cover)
        : meshRect(x0 + bBE, y0, x0 + b - bBE, y0 + h, sM, sM, asM, cover);
    bars.push(...web);
    const nPer = Math.max(0, Math.round(inp.nBar || 0));
    if (nPer >= 4 && forma === "muro") {
      bars.push(...barsOnRect(x0, y0, x0 + b, y0 + h, nPer, as1, cover));
    }
    const title = forma === "muro-be" ? `Muro ${b.toFixed(0)}×${h.toFixed(0)} cm + BE ${bBE.toFixed(0)} cm` : `Muro ${b.toFixed(0)}×${h.toFixed(0)} cm`;
    return finalizeSection(title, outer, [], keepBars(outer, [], bars));
  }

  const x0 = -b / 2;
  const y0 = -h / 2;
  const outer = rect(x0, y0, x0 + b, y0 + h);
  const n = Math.max(4, Math.round(inp.nBar || 4));
  const bars = keepBars(outer, [], barsOnRect(x0, y0, x0 + b, y0 + h, n, as1, cover));
  return finalizeSection(`${b.toFixed(0)}×${h.toFixed(0)} cm`, outer, [], bars);
}

export function steelZonesFor(inp: SectionInput): SteelZone[] {
  const forma = inp.forma;
  if (["L", "T", "C", "I"].includes(forma)) {
    const b = Math.max(inp.b, 8);
    const h = Math.max(inp.h, 8);
    const tw = Math.min(Math.max(inp.tw || 15, 8), Math.max(b - 2, 8));
    const tf = Math.min(Math.max(inp.tf || 15, 8), Math.max(h - 2, 8));
    const be = Math.min(Math.max(inp.bBE || 14, 8), 40);
    const rec = Math.max(inp.rec, 1.5);
    const dest = Math.max(inp.dest, 0.6);
    const cover = rec + dest + barByName(inp.bar).db / 2;
    return profileZones(forma, { b, h, tw, tf, be, cover });
  }
  if (forma === "muro-be" || forma === "muro") {
    const b = Math.max(inp.b, 8);
    const h = Math.max(inp.h, 8);
    const x0 = -b / 2;
    const y0 = -h / 2;
    const bBE = Math.min(Math.max(inp.bBE || Math.min(b * 0.15, 60), 15), b / 2);
    const zones: SteelZone[] = [
      { kind: "alma", x0: x0 + (forma === "muro-be" ? bBE : 0), y0, x1: x0 + b - (forma === "muro-be" ? bBE : 0), y1: y0 + h, label: "Alma / malla" },
    ];
    if (forma === "muro-be") {
      zones.unshift({ kind: "conf", x0, y0, x1: x0 + bBE, y1: y0 + h, label: "Confinamiento I" });
      zones.push({ kind: "conf", x0: x0 + b - bBE, y0, x1: x0 + b, y1: y0 + h, label: "Confinamiento J" });
    }
    return zones;
  }
  return [];
}

export function seedDesigner(inp: Omit<SectionInput, "forma"> & { forma: string }): { polyUser: string; holesUser: string; barsUser: string } {
  const src: SectionInput = { ...inp, forma: inp.forma === "libre" ? "rect" : inp.forma };
  const sec = buildSection(src);
  let outer = sec.outer;
  if (src.forma === "circ" && outer.length > 16) {
    const keep = 12;
    const step = outer.length / keep;
    outer = Array.from({ length: keep }, (_, i) => outer[Math.min(outer.length - 1, Math.round(i * step))]);
  }
  return {
    polyUser: encodePoly(outer),
    holesUser: sec.holes.map(encodePoly).join("|"),
    barsUser: encodeBars(sec.bars),
  };
}
