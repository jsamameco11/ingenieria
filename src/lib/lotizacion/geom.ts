/** Geometría plana en metros. X = Este, Y = Norte. */

export type V2 = { x: number; y: number };

export function dist(a: V2, b: V2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function sub(a: V2, b: V2): V2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a: V2, b: V2): V2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function mul(a: V2, s: number): V2 {
  return { x: a.x * s, y: a.y * s };
}

export function dot(a: V2, b: V2): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: V2, b: V2): number {
  return a.x * b.y - a.y * b.x;
}

export function lerp(a: V2, b: V2, t: number): V2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function almost(a: V2, b: V2, eps = 0.002): boolean {
  return dist(a, b) <= eps;
}

export function norm(a: V2): V2 {
  const L = Math.hypot(a.x, a.y);
  if (L < 1e-12) return { x: 1, y: 0 };
  return { x: a.x / L, y: a.y / L };
}

export function signedArea(poly: V2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function area(poly: V2[]): number {
  return Math.abs(signedArea(poly));
}

export function perimeter(poly: V2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) s += dist(poly[i], poly[(i + 1) % poly.length]);
  return s;
}

export function centroid(poly: V2[]): V2 {
  const a = signedArea(poly);
  if (!poly.length) return { x: 0, y: 0 };
  if (Math.abs(a) < 1e-8) {
    const sx = poly.reduce((s, p) => s + p.x, 0);
    const sy = poly.reduce((s, p) => s + p.y, 0);
    return { x: sx / poly.length, y: sy / poly.length };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const k = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * k;
    cy += (p.y + q.y) * k;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export type Caja = { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number };

export function bbox(poly: V2[]): Caja {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!poly.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export function cajaDePuntos(pts: V2[]): Caja {
  return bbox(pts);
}

export function ensureOpen(poly: V2[]): V2[] {
  if (poly.length >= 2 && almost(poly[0], poly[poly.length - 1], 0.01)) return poly.slice(0, -1);
  return poly.slice();
}

export function ensureCCW(poly: V2[]): V2[] {
  const p = ensureOpen(poly);
  return signedArea(p) < 0 ? p.slice().reverse() : p;
}

export function pointInPoly(p: V2, poly: V2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const dy = b.y - a.y;
    if (Math.abs(dy) < 1e-15) continue;
    const hit = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / dy + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

export function rotate(p: V2, ang: number): V2 {
  const co = Math.cos(ang);
  const si = Math.sin(ang);
  return { x: p.x * co - p.y * si, y: p.x * si + p.y * co };
}

export function longestEdgeAngle(poly: V2[]): number {
  let best = 0;
  let bestL = -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const L = dist(a, b);
    if (L > bestL) {
      bestL = L;
      best = Math.atan2(b.y - a.y, b.x - a.x);
    }
  }
  return best;
}

export function projectOnSegment(p: V2, a: V2, b: V2): { pt: V2; t: number; d: number } {
  const ab = sub(b, a);
  const L2 = dot(ab, ab);
  const t = L2 < 1e-12 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / L2));
  const pt = lerp(a, b, t);
  return { pt, t, d: dist(p, pt) };
}

function orient(a: V2, b: V2, c: V2): number {
  return cross(sub(b, a), sub(c, a));
}

function segmentsIntersectProper(a: V2, b: V2, c: V2, d: V2): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (Math.abs(o1) < 1e-6 || Math.abs(o2) < 1e-6 || Math.abs(o3) < 1e-6 || Math.abs(o4) < 1e-6) return false;
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function selfIntersects(poly: V2[]): boolean {
  const n = poly.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const adj = Math.abs(i - j) <= 1 || (i === 0 && j === n - 1);
      if (adj) continue;
      if (segmentsIntersectProper(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true;
    }
  }
  return false;
}

export type Rect = { x: number; y: number; w: number; h: number };

export function rectPoly(r: Rect): V2[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

function lineHit(s: V2, e: V2, a: V2, b: V2): V2 | null {
  const d1 = sub(e, s);
  const d2 = sub(b, a);
  const den = cross(d1, d2);
  if (Math.abs(den) < 1e-12) return null;
  const t = cross(sub(a, s), d2) / den;
  return lerp(s, e, t);
}

export function cleanPoly(poly: V2[]): V2[] {
  const out: V2[] = [];
  for (const p of poly) {
    if (!out.length || !almost(out[out.length - 1], p, 0.004)) out.push(p);
  }
  if (out.length >= 2 && almost(out[0], out[out.length - 1], 0.004)) out.pop();
  return out.length >= 3 ? out : [];
}

/** Sutherland–Hodgman. El recorte es convexo y antihorario. */
export function clipPoly(subject: V2[], clip: V2[]): V2[] {
  let out = subject.slice();
  if (out.length < 3 || clip.length < 3) return [];
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const input = out;
    out = [];
    if (!input.length) break;
    for (let j = 0; j < input.length; j++) {
      const s = input[j];
      const e = input[(j + 1) % input.length];
      const sIn = cross(sub(b, a), sub(s, a)) >= -1e-7;
      const eIn = cross(sub(b, a), sub(e, a)) >= -1e-7;
      if (sIn && eIn) out.push(e);
      else if (sIn && !eIn) {
        const hit = lineHit(s, e, a, b);
        if (hit) out.push(hit);
      } else if (!sIn && eIn) {
        const hit = lineHit(s, e, a, b);
        if (hit) out.push(hit);
        out.push(e);
      }
    }
  }
  return cleanPoly(out);
}

export function clipRect(subject: V2[], r: Rect): V2[] {
  if (r.w <= 0.02 || r.h <= 0.02) return [];
  return clipPoly(subject, rectPoly(r));
}

export function pointAlong(poly: V2[], edge: number, distFromStart: number): { pt: V2; len: number } | null {
  if (edge < 0 || edge >= poly.length) return null;
  const a = poly[edge];
  const b = poly[(edge + 1) % poly.length];
  const len = dist(a, b);
  if (len < 1e-8) return null;
  const t = Math.max(0, Math.min(1, distFromStart / len));
  return { pt: lerp(a, b, t), len };
}

export function nearestEdge(poly: V2[], p: V2): { edge: number; distM: number; along: number; pt: V2; len: number } {
  let best = { edge: 0, distM: Infinity, along: 0, pt: poly[0] ?? p, len: 0 };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const pr = projectOnSegment(p, a, b);
    const len = dist(a, b);
    if (pr.d < best.distM) best = { edge: i, distM: pr.d, along: pr.t * len, pt: pr.pt, len };
  }
  return best;
}

export function distPuntoPoligono(p: V2, poly: V2[]): number {
  if (poly.length < 3) return Infinity;
  if (pointInPoly(p, poly)) return 0;
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const pr = projectOnSegment(p, poly[i], poly[(i + 1) % poly.length]);
    if (pr.d < m) m = pr.d;
  }
  return m;
}

export function clipSegment(a: V2, b: V2, poly: V2[]): V2[][] {
  if (poly.length < 3) return [];
  const ts = [0, 1];
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i];
    const d = poly[(i + 1) % poly.length];
    const d1 = sub(b, a);
    const d2 = sub(d, c);
    const den = cross(d1, d2);
    if (Math.abs(den) < 1e-12) continue;
    const t = cross(sub(c, a), d2) / den;
    const u = cross(sub(c, a), d1) / den;
    if (t > 0.001 && t < 0.999 && u >= -0.001 && u <= 1.001) ts.push(t);
  }
  ts.sort((p, q) => p - q);
  const uniq: number[] = [];
  for (const t of ts) {
    if (!uniq.length || t - uniq[uniq.length - 1] > 1e-4) uniq.push(t);
  }
  const out: V2[][] = [];
  for (let i = 0; i < uniq.length - 1; i++) {
    const t0 = uniq[i];
    const t1 = uniq[i + 1];
    const mid = lerp(a, b, (t0 + t1) / 2);
    if (pointInPoly(mid, poly)) out.push([lerp(a, b, t0), lerp(a, b, t1)]);
  }
  return out;
}

/** Ángulos interiores menores de 45°: área a descontar del cómputo de aportes (GH.020 Art. 31). */
export function areaAngulosAgudos(poly: V2[]): { area: number; n: number } {
  const p = ensureCCW(poly);
  let excl = 0;
  let n = 0;
  for (let i = 0; i < p.length; i++) {
    const prev = p[(i - 1 + p.length) % p.length];
    const cur = p[i];
    const next = p[(i + 1) % p.length];
    const v1 = sub(cur, prev);
    const v2 = sub(next, cur);
    const interior = Math.PI - Math.atan2(cross(v1, v2), dot(v1, v2));
    if (interior >= (45 * Math.PI) / 180 || interior <= 0.02) continue;
    const lado = Math.min(dist(prev, cur), dist(cur, next), 25);
    excl += lado * lado * Math.tan(interior / 2);
    n++;
  }
  return { area: Math.max(0, excl), n };
}

export function fmtM(n: number, d = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtCoord(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-PE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
