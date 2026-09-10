import type { RdapProject } from "./types";

export type TinTri = { a: number; b: number; c: number };

function circuncirculo(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  const r2 = (ux - ax) ** 2 + (uy - ay) ** 2;
  return { ux, uy, r2 };
}

function bary(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(d) < 1e-14) return null;
  const u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d;
  const v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
  return { u, v, w: 1 - u - v };
}

/** TIN por Delaunay (Bowyer–Watson). Superficie a partir de puntos COGO / CSV / LandXML. */
export function tinDe(pts: RdapProject["topoPoints"]) {
  const clean = pts.filter((p, i, arr) => arr.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.05) === i);
  if (clean.length < 3) return { pts: clean, tris: [] as TinTri[] };
  const xs = clean.map((p) => p.x);
  const ys = clean.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const dx = Math.max(maxX - minX, 1);
  const dy = Math.max(maxY - minY, 1);
  const d = Math.max(dx, dy) * 20;
  const mx = (minX + maxX) / 2;
  const my = (minY + maxY) / 2;
  const superPts = [
    { id: "_s0", x: mx - d, y: my - d, z: 0, desc: "" },
    { id: "_s1", x: mx + d, y: my - d, z: 0, desc: "" },
    { id: "_s2", x: mx, y: my + d, z: 0, desc: "" },
  ];
  const all = [...clean, ...superPts];
  const n0 = clean.length;
  let tris: TinTri[] = [{ a: n0, b: n0 + 1, c: n0 + 2 }];
  for (let i = 0; i < n0; i++) {
    const p = all[i];
    const bad: number[] = [];
    for (let t = 0; t < tris.length; t++) {
      const tr = tris[t];
      const A = all[tr.a];
      const B = all[tr.b];
      const C = all[tr.c];
      const circ = circuncirculo(A.x, A.y, B.x, B.y, C.x, C.y);
      if (circ && (p.x - circ.ux) ** 2 + (p.y - circ.uy) ** 2 <= circ.r2 + 1e-9) bad.push(t);
    }
    const edges: [number, number][] = [];
    for (const t of bad) {
      const tr = tris[t];
      edges.push([tr.a, tr.b], [tr.b, tr.c], [tr.c, tr.a]);
    }
    const unique: [number, number][] = [];
    for (const [u, v] of edges) {
      const dup = edges.filter(([a, b]) => (a === u && b === v) || (a === v && b === u)).length;
      if (dup === 1) unique.push([u, v]);
    }
    tris = tris.filter((_, t) => !bad.includes(t));
    for (const [u, v] of unique) tris.push({ a: u, b: v, c: i });
  }
  const final = tris.filter((t) => t.a < n0 && t.b < n0 && t.c < n0);
  return { pts: clean, tris: final };
}

export function interpolarTin(x: number, y: number, pts: RdapProject["topoPoints"]) {
  const tin = tinDe(pts);
  for (const t of tin.tris) {
    const A = tin.pts[t.a];
    const B = tin.pts[t.b];
    const C = tin.pts[t.c];
    const w = bary(x, y, A.x, A.y, B.x, B.y, C.x, C.y);
    if (w && w.u >= -1e-5 && w.v >= -1e-5 && w.w >= -1e-5) return w.u * A.z + w.v * B.z + w.w * C.z;
  }
  return null;
}

export function rangoCotas(pts: RdapProject["topoPoints"]) {
  if (!pts.length) return { zmin: 0, zmax: 1 };
  const zs = pts.map((p) => p.z);
  return { zmin: Math.min(...zs), zmax: Math.max(...zs) };
}

export function colorCota(z: number, zmin: number, zmax: number) {
  const t = Math.max(0, Math.min(1, (z - zmin) / (zmax - zmin || 1)));
  const r = Math.round(45 + t * 140);
  const g = Math.round(120 - t * 70);
  const b = Math.round(70 - t * 40);
  return `rgb(${r},${g},${b})`;
}
