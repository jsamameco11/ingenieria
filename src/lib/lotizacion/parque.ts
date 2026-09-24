import { area, bbox, centroid, clipPoly, cross, dist, ensureCCW, lerp, norm, pointInPoly, sub, type V2 } from "./geom";
import { armarPlazas } from "./plazas";
import type { AjusteParque, CategoriaParque, EstiloParque, Parque, PiezaParque } from "./tipos";

/**
 * Parque dentro del aporte de recreación.
 * Primero el perímetro y la circulación; el césped es lo que queda entre recorridos.
 * Nada se acepta si sale del polígono.
 */

const CESPED = "#c5d6b6";
const SENDERO = "#d6d6d6";
const SENDERO_EJE = "#8d8d8d";
const PLAZA = "#d5cfc3";
const ARENA = "#e6d3a4";
const LINEA = "#f7f6f2";
const BANCA = "#6d5140";
const COPA = "#3d7a49";
const COPA2 = "#2c5c36";
const TRONCO = "#6a4b32";
const ARBUSTO = "#5c8a52";
const JUEGO = "#b55245";
const JUEGO2 = "#3d6d96";

type Campo = { nombre: string; largo: number; ancho: number; arco: number; rCentro: number };

const CAMPOS: Campo[] = [
  { nombre: "Fútbol 7", largo: 40, ancho: 22, arco: 4, rCentro: 4.5 },
  { nombre: "Fulbito", largo: 28, ancho: 16, arco: 2.6, rCentro: 2.6 },
  { nombre: "Multiuso", largo: 18, ancho: 10, arco: 1.8, rCentro: 1.8 },
  { nombre: "Básquet", largo: 14, ancho: 8, arco: 1.6, rCentro: 1.6 },
];

function pieza(capa: string, pts: V2[], fill: string, stroke: string, sw: number, cerrado: boolean): PiezaParque {
  return { capa, pts, fill, stroke, sw, cerrado, hatch: fill !== "none" };
}

function claveDe(poly: V2[]): string {
  const c = centroid(poly);
  return `${Math.round(c.x)}:${Math.round(c.y)}`;
}

function holgura(p: V2, poly: V2[]): number {
  if (!pointInPoly(p, poly)) return -1;
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const L2 = abx * abx + aby * aby || 1;
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / L2;
    t = Math.max(0, Math.min(1, t));
    m = Math.min(m, Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t)));
  }
  return m;
}

function esConvexo(poly: V2[]): boolean {
  let signo = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = poly[(i + 2) % poly.length];
    const z = cross(sub(b, a), sub(c, b));
    if (Math.abs(z) < 1e-6) continue;
    const s = Math.sign(z);
    if (!signo) signo = s;
    else if (s !== signo) return false;
  }
  return poly.length >= 3;
}

function recortar(subject: V2[], park: V2[]): V2[] {
  if (subject.length < 3) return [];
  if (Math.abs(area(subject)) >= 0.012 && subject.every((p) => pointInPoly(p, park))) return subject;
  if (esConvexo(park)) {
    const c = clipPoly(subject, ensureCCW(park));
    return area(c) > 0.35 ? c : [];
  }
  return subject.every((p) => holgura(p, park) >= 0.05) ? subject : [];
}

function disco(c: V2, r: number, n = 14): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return pts;
}

function tramo(a: V2, b: V2, ancho: number): V2[] {
  const e = norm(sub(b, a));
  const n = { x: -e.y * (ancho / 2), y: e.x * (ancho / 2) };
  return [
    { x: a.x + n.x, y: a.y + n.y },
    { x: b.x + n.x, y: b.y + n.y },
    { x: b.x - n.x, y: b.y - n.y },
    { x: a.x - n.x, y: a.y - n.y },
  ];
}

function recto(c: V2, w: number, h: number, ang: number): V2[] {
  const u = { x: Math.cos(ang), y: Math.sin(ang) };
  const v = { x: -u.y, y: u.x };
  const hw = w / 2;
  const hh = h / 2;
  const p = (sx: number, sy: number) => ({ x: c.x + u.x * hw * sx + v.x * hh * sy, y: c.y + u.y * hw * sx + v.y * hh * sy });
  return [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)];
}

function bezier(a: V2, b: V2, c: V2, n = 8): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    });
  }
  return pts;
}

function cubica(a: V2, c1: V2, c2: V2, b: V2, n = 12): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({
      x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
    });
  }
  return pts;
}

function meandro(a: V2, b: V2, signo = 1): V2[] {
  const L = dist(a, b);
  if (L < 2.2) return [a, b];
  const e = norm(sub(b, a));
  const n = { x: -e.y, y: e.x };
  const amp = Math.min(L * 0.24, 10) * (signo >= 0 ? 1 : -1);
  const c1 = { x: a.x + e.x * L * 0.3 + n.x * amp, y: a.y + e.y * L * 0.3 + n.y * amp };
  const c2 = { x: a.x + e.x * L * 0.7 - n.x * amp * 0.72, y: a.y + e.y * L * 0.7 - n.y * amp * 0.72 };
  return cubica(a, c1, c2, b, Math.max(8, Math.round(L / 2.4)));
}

function cinta(eje: V2[], ancho: number): V2[] {
  if (eje.length < 2) return [];
  const izq: V2[] = [];
  const der: V2[] = [];
  for (let i = 0; i < eje.length; i++) {
    const prev = eje[Math.max(0, i - 1)];
    const next = eje[Math.min(eje.length - 1, i + 1)];
    const e = norm(sub(next, prev));
    const nx = (-e.y * ancho) / 2;
    const ny = (e.x * ancho) / 2;
    izq.push({ x: eje[i].x + nx, y: eje[i].y + ny });
    der.push({ x: eje[i].x - nx, y: eje[i].y - ny });
  }
  return [...izq, ...der.reverse()];
}

function cruce(a: V2, b: V2, c: V2, d: V2): V2 | null {
  const den = cross(sub(b, a), sub(d, c));
  if (Math.abs(den) < 1e-9) return null;
  const t = cross(sub(c, a), sub(d, c)) / den;
  return lerp(a, b, t);
}

function inset(poly: V2[], d: number): V2[] {
  const ccw = ensureCCW(poly);
  const lineas: { p: V2; dir: V2 }[] = [];
  for (let i = 0; i < ccw.length; i++) {
    const a = ccw[i];
    const b = ccw[(i + 1) % ccw.length];
    const e = norm(sub(b, a));
    const inn = { x: -e.y, y: e.x };
    lineas.push({ p: { x: a.x + inn.x * d, y: a.y + inn.y * d }, dir: e });
  }
  const out: V2[] = [];
  for (let i = 0; i < lineas.length; i++) {
    const L1 = lineas[(i + lineas.length - 1) % lineas.length];
    const L2 = lineas[i];
    const hit = cruce(L1.p, { x: L1.p.x + L1.dir.x, y: L1.p.y + L1.dir.y }, L2.p, { x: L2.p.x + L2.dir.x, y: L2.p.y + L2.dir.y });
    if (hit && pointInPoly(hit, ccw) && holgura(hit, ccw) >= d * 0.35) out.push(hit);
  }
  return out.length >= 3 && area(out) > 36 ? out : [];
}

function alejar(p: V2, park: V2[], minH: number, centro: V2): V2 {
  if (pointInPoly(p, park) && holgura(p, park) >= minH) return p;
  for (let t = 0.12; t <= 1; t += 0.08) {
    const q = lerp(p, centro, t);
    if (pointInPoly(q, park) && holgura(q, park) >= minH) return q;
  }
  return centro;
}

function accesos(poly: V2[], centro: V2): V2[] {
  const out: { p: V2; L: number }[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const L = dist(a, b);
    if (L < 8) continue;
    const mid = lerp(a, b, 0.5);
    const e = norm(sub(b, a));
    const n = { x: -e.y, y: e.x };
    const p1 = { x: mid.x + n.x * 0.06, y: mid.y + n.y * 0.06 };
    const p2 = { x: mid.x - n.x * 0.06, y: mid.y - n.y * 0.06 };
    const p = pointInPoly(p1, poly) ? p1 : p2;
    if (pointInPoly(p, poly)) out.push({ p, L });
  }
  out.sort((a, b) => b.L - a.L);
  const elegidos = out.slice(0, 4).map((o) => o.p);
  if (elegidos.length === 1) {
    const a = elegidos[0];
    elegidos.push(alejar({ x: centro.x * 2 - a.x, y: centro.y * 2 - a.y }, poly, 2, centro));
  }
  if (!elegidos.length) elegidos.push(alejar(centro, poly, 1.5, centro));
  return elegidos;
}

function cruza(a: V2, b: V2, c: V2, d: V2): boolean {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const den = abx * cdy - aby * cdx;
  if (Math.abs(den) < 1e-9) return false;
  const t = ((c.x - a.x) * cdy - (c.y - a.y) * cdx) / den;
  const u = ((c.x - a.x) * aby - (c.y - a.y) * abx) / den;
  return t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98;
}

function choca(pts: V2[], ocupados: { pts: V2[]; capa: string }[], salvo: string[] = []): boolean {
  return ocupados.some((o) => {
    if (salvo.includes(o.capa) || o.pts.length < 3) return false;
    if (pts.some((p) => holgura(p, o.pts) > 0.2) || o.pts.some((p) => holgura(p, pts) > 0.2)) return true;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      for (let j = 0; j < o.pts.length; j++) {
        if (cruza(a, b, o.pts[j], o.pts[(j + 1) % o.pts.length])) return true;
      }
    }
    return false;
  });
}

function dentro(pts: V2[], park: V2[], margen = 0.12): boolean {
  return pts.every((p) => holgura(p, park) >= margen);
}

/** Une paños de recreación que comparten lado, para tener un solo parque. */
export function unirPanos(polys: V2[][]): V2[][] {
  const q = (p: V2) => `${Math.round(p.x * 50)},${Math.round(p.y * 50)}`;
  const kof = (a: V2, b: V2) => {
    const ka = q(a);
    const kb = q(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  const bag = new Map<string, { a: V2; b: V2; n: number }>();
  for (const poly of polys) {
    if (poly.length < 3) continue;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (q(a) === q(b)) continue;
      const k = kof(a, b);
      const prev = bag.get(k);
      if (prev) prev.n += 1;
      else bag.set(k, { a, b, n: 1 });
    }
  }
  const edges = [...bag.values()].filter((e) => e.n === 1);
  const adj = new Map<string, { key: string; pt: V2 }[]>();
  const push = (ka: string, kb: string, pt: V2) => {
    const arr = adj.get(ka) ?? [];
    arr.push({ key: kb, pt });
    adj.set(ka, arr);
  };
  for (const e of edges) {
    push(q(e.a), q(e.b), e.b);
    push(q(e.b), q(e.a), e.a);
  }
  const used = new Set<string>();
  const loops: V2[][] = [];
  for (const e of edges) {
    const ek = kof(e.a, e.b);
    if (used.has(ek)) continue;
    const loop: V2[] = [e.a];
    used.add(ek);
    let prev = q(e.a);
    let cur = q(e.b);
    loop.push(e.b);
    let guard = 0;
    while (cur !== q(e.a) && guard++ < 8000) {
      const nxt = (adj.get(cur) ?? []).find((n) => n.key !== prev);
      if (!nxt) break;
      const kk = kof(loop[loop.length - 1], nxt.pt);
      if (nxt.key === q(e.a)) {
        used.add(kk);
        break;
      }
      if (used.has(kk)) break;
      used.add(kk);
      loop.push(nxt.pt);
      prev = cur;
      cur = nxt.key;
    }
    if (loop.length >= 3 && Math.abs(area(loop)) > 30) loops.push(ensureCCW(loop));
  }
  const sumaIn = polys.reduce((s, p) => s + Math.abs(area(p)), 0);
  const sumaOut = loops.reduce((s, p) => s + Math.abs(area(p)), 0);
  if (!loops.length || sumaOut < sumaIn * 0.7) return polys.filter((p) => p.length >= 3 && Math.abs(area(p)) > 30).map((p) => ensureCCW(p));
  return loops;
}

function rumboLargo(poly: V2[]): number {
  let best = 0;
  let ang = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const L = dist(a, b);
    if (L > best) {
      best = L;
      ang = Math.atan2(b.y - a.y, b.x - a.x);
    }
  }
  return ang;
}

function ptLocal(c: V2, ang: number, x: number, y: number): V2 {
  const u = Math.cos(ang);
  const v = Math.sin(ang);
  return { x: c.x + u * x - v * y, y: c.y + v * x + u * y };
}

function colocarCancha(
  poly: V2[],
  centro: V2,
  ang0: number,
  dentroFn: (pts: V2[], park: V2[], margen?: number) => boolean,
  medida?: { largo?: number; ancho?: number },
): { c: V2; ang: number; largo: number; ancho: number; campo: Campo } | null {
  const caja = bbox(poly);
  const pedido =
    medida?.largo && medida.ancho && medida.largo >= 12 && medida.ancho >= 8 && medida.largo <= 70 && medida.ancho <= 45
      ? [{ nombre: "Losa", largo: medida.largo, ancho: medida.ancho, arco: Math.min(4, medida.ancho * 0.18), rCentro: Math.min(4.5, medida.ancho * 0.18) }]
      : [];
  const lista = [...pedido, ...CAMPOS];
  for (const ang of [ang0, ang0 + Math.PI / 2]) {
    for (const campo of lista) {
      let mejor: { c: V2; d: number } | null = null;
      for (let x = caja.minX + 3; x < caja.maxX - 3; x += 4) {
        for (let y = caja.minY + 3; y < caja.maxY - 3; y += 4) {
          const c = { x, y };
          const exterior = recto(c, campo.largo + 6.6, campo.ancho + 6.6, ang);
          if (!dentroFn(exterior, poly, 0.15)) continue;
          const d = dist(c, centro);
          if (!mejor || d < mejor.d) mejor = { c, d };
        }
      }
      if (mejor) return { c: mejor.c, ang, largo: campo.largo, ancho: campo.ancho, campo };
    }
  }
  return null;
}

function equiparJuegos(
  c: V2,
  ang: number,
  areaP: number,
  poly: V2[],
  textos: { p: V2; text: string; size: number; fill: string }[],
  poner: (capa: string, pts: V2[], fill: string, stroke: string, sw: number, cerrado?: boolean, ocupa?: boolean, salvo?: string[]) => V2[] | null,
  dentroFn: (pts: V2[], park: V2[], margen?: number) => boolean,
  chocaFn: (pts: V2[], ocupados: { pts: V2[]; capa: string }[], salvo?: string[]) => boolean,
  ocupados: { pts: V2[]; capa: string }[],
): V2 | null {
  const w = areaP > 700 ? 9.4 : 7.4;
  const h = areaP > 700 ? 6.6 : 5.2;
  const pad = recto(c, w, h, ang);
  if (!dentroFn(pad, poly, 0.15) || chocaFn(pad, ocupados)) return null;
  poner("MC-PARQUE-JUEGO", pad, ARENA, "#1a1a1a", 0.07, true, true);
  const barra = (x: number, y: number, lw: number, lh: number, fill: string) => {
    poner("MC-PARQUE-JUEGO", recto(ptLocal(c, ang, x, y), lw, lh, ang), fill, "#1a1a1a", 0.045, true, false);
  };
  barra(-2.3, -0.85, 0.1, 2.1, "#2c2c2c");
  barra(-2.3, 0.85, 0.1, 2.1, "#2c2c2c");
  barra(-0.5, -0.85, 0.1, 2.1, "#2c2c2c");
  barra(-0.5, 0.85, 0.1, 2.1, "#2c2c2c");
  barra(-1.4, 0, 2.05, 0.1, "#2c2c2c");
  barra(-1.95, -0.2, 0.42, 0.14, JUEGO);
  barra(-0.85, -0.2, 0.42, 0.14, JUEGO);
  barra(1.15, 0.45, 0.85, 1.05, JUEGO2);
  barra(2.15, -0.2, 1.45, 0.42, "#d5e6f2");
  barra(0.7, -0.55, 0.08, 0.85, "#2c2c2c");
  barra(1.05, -0.55, 0.08, 0.85, "#2c2c2c");
  barra(0.2, 1.35, 1.2, 0.1, "#c47a2c");
  barra(-0.3, 1.75, 0.1, 0.75, "#c47a2c");
  barra(0.7, 1.75, 0.1, 0.75, "#c47a2c");
  textos.push({ p: ptLocal(c, ang, 0, -h / 2 + 0.85), text: "JUEGOS", size: 1.15, fill: "#5c4630" });
  return c;
}

function ponerPlazas(
  poly: V2[],
  categoria: CategoriaParque,
  estilo: EstiloParque,
  ocupados: { pts: V2[]; capa: string }[],
  ancla: V2 | null,
  recreo: V2 | null,
  enlaces: V2[],
  angulo: number,
  poner: (capa: string, pts: V2[], fill: string, stroke: string, sw: number, cerrado?: boolean, ocupa?: boolean, salvo?: string[]) => V2[] | null,
  soltarTramo: (a: V2, b: V2, ancho: number) => void,
  base: Parque,
): { centro: V2; lado: number } | null {
  const obs = ocupados.filter((o) => o.capa === "MC-PARQUE-CANCHA" || o.capa === "MC-PARQUE-JUEGO").map((o) => o.pts);
  const red = armarPlazas({ poly, categoria, estilo, obstaculos: obs, ancla, recreo, enlaces, angulo });
  if (!red.plazas.length) return null;
  for (const tr of red.senderos) soltarTramo(tr.a, tr.b, 2.2);
  let mayor: { centro: V2; lado: number } | null = null;
  for (const plaza of red.plazas) {
    const dib = poner("MC-PARQUE-PLAZA", plaza.pts, PLAZA, "#1a1a1a", 0.07, true, true, ["MC-PARQUE-SENDERO"]);
    if (!dib) continue;
    const lado = Math.sqrt(Math.abs(area(dib)) / Math.PI) * 2;
    if (!mayor || lado > mayor.lado) mayor = { centro: plaza.centro, lado };
    if (plaza.centroPie.length >= 3) poner("MC-PARQUE-PLAZA", plaza.centroPie, "#c4b8a4", "#1a1a1a", 0.04, true, false);
    for (const [a, b] of plaza.juntas) poner("MC-PARQUE-PLAZA", [a, b], "none", "#6e6a62", 0.045, false, false);
    base.textos.push({ p: plaza.centro, text: "PLAZA", size: Math.min(1.5, lado * 0.16), fill: "#3c3832" });
  }
  for (const tr of red.senderos) {
    poner("MC-PARQUE-EMPALME", disco(tr.a, 1.05, 16), SENDERO, SENDERO, 0.02, true, false);
    poner("MC-PARQUE-EMPALME", disco(tr.b, 1.05, 16), SENDERO, SENDERO, 0.02, true, false);
  }
  return mayor;
}

function disenarUno(
  poly: V2[],
  categoria: CategoriaParque,
  estiloIn: EstiloParque | undefined,
  indice: number,
  medida?: { largo?: number; ancho?: number },
): Parque {
  const areaP = Math.abs(area(poly));
  const caja = bbox(poly);
  const aspecto = caja.w / Math.max(caja.h, 0.01);
  const estilo: EstiloParque =
    estiloIn ?? (aspecto > 2.15 || aspecto < 0.46 ? "lineal" : areaP > 1800 ? "geometrico" : "organico");
  const centro = centroid(poly);
  const nombre = `Parque ${indice + 1}`;
  const base: Parque = {
    clave: claveDe(poly),
    categoria,
    estilo,
    nombre,
    poly,
    area: areaP,
    piezas: [],
    textos: [],
    nota: "",
  };
  const ocupados: { pts: V2[]; capa: string }[] = [];
  const poner = (capa: string, pts: V2[], fill: string, stroke: string, sw: number, cerrado = true, ocupa = true, salvo: string[] = []) => {
    if (cerrado) {
      const rec = recortar(pts, poly);
      if (rec.length < 3) return null;
      if (ocupa && choca(rec, ocupados, salvo)) return null;
      const pz = pieza(capa, rec, fill, stroke, sw, true);
      base.piezas.push(pz);
      if (ocupa && fill !== "none") ocupados.push({ pts: rec, capa });
      return rec;
    }
    if (!pts.every((p) => pointInPoly(p, poly))) return null;
    base.piezas.push(pieza(capa, pts, fill, stroke, sw, false));
    return pts;
  };

  base.piezas.push(pieza("MC-PARQUE-CESPED", poly, CESPED, "#1a1a1a", 0.08, true));

  const entradas = accesos(poly, centro);
  const anP = areaP > 2200 ? 3 : areaP > 900 ? 2.4 : 1.8;
  const anS = Math.max(1.8, anP - 0.6);
  const anT = 1.2;
  let eje: V2[] = [];

  const soltarTramo = (a: V2, b: V2, ancho: number) => {
    if (dist(a, b) < 0.45) return;
    const eje = estilo === "organico" ? meandro(a, b, Math.sin(a.x * 0.17 + b.y * 0.13) >= 0 ? 1 : -1) : [a, b];
    const rec = poner("MC-PARQUE-SENDERO", estilo === "organico" ? cinta(eje, ancho) : tramo(a, b, ancho), SENDERO, SENDERO, 0.02, true, true, ["MC-PARQUE-SENDERO"]);
    if (!rec) return;
    if (eje.length >= 2) poner("MC-PARQUE-SENDERO", [eje[0], eje[eje.length - 1]], "none", SENDERO_EJE, 0.03, false, false);
  };

  const empalme = (c: V2, ancho: number) => {
    poner("MC-PARQUE-EMPALME", disco(c, ancho * 0.46, 18), SENDERO, SENDERO, 0.02, true, false);
  };

  const paseoPerimetral = () => {
    const d = anP / 2 + 0.06;
    const loop = inset(poly, d);
    const red: V2[] = [];
    if (loop.length >= 3) {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        soltarTramo(a, b, anP);
        empalme(a, anP);
        red.push(a, lerp(a, b, 0.5));
      }
    }
    return red;
  };

  const rumbo = rumboLargo(poly);
  const cancha = categoria === "activa" ? colocarCancha(poly, centro, rumbo, dentro, medida) : null;
  let nodo = centro;
  let angEje = rumbo;
  let ladoPlaza = Math.max(6, Math.min(estilo === "lineal" ? 11 : 13, Math.sqrt(Math.max(areaP, 1)) * 0.16));
  let plazaOk = false;
  let canchaNombre = "";
  let juegosP: V2 | null = null;

  const local = (c: V2, ang: number, x: number, y: number) => ptLocal(c, ang, x, y);
  const lineaBlanca = (a: V2, b: V2) => poner("MC-PARQUE-LINEA", [a, b], "none", LINEA, 0.18, false, false);

  if (cancha) {
    const { c, ang, largo: L, ancho: A, campo } = cancha;
    angEje = ang;
    canchaNombre = campo.nombre;
    const mitadA = recto(local(c, ang, -L / 4, 0), L / 2, A, ang);
    const mitadB = recto(local(c, ang, L / 4, 0), L / 2, A, ang);
    poner("MC-PARQUE-CANCHA", mitadA, "#2f8a4c", "#145c32", 0.06, true, true);
    poner("MC-PARQUE-CANCHA", mitadB, "#277843", "#145c32", 0.06, true, true);
    const P = (x: number, y: number) => local(c, ang, x, y);
    const hl = L / 2;
    const ha = A / 2;
    lineaBlanca(P(-hl, -ha), P(hl, -ha));
    lineaBlanca(P(hl, -ha), P(hl, ha));
    lineaBlanca(P(hl, ha), P(-hl, ha));
    lineaBlanca(P(-hl, ha), P(-hl, -ha));
    lineaBlanca(P(0, -ha), P(0, ha));
    const rCir = Math.min(campo.rCentro, A * 0.2);
    poner("MC-PARQUE-LINEA", disco(c, rCir, 28), "none", LINEA, 0.16, true, false);
    poner("MC-PARQUE-LINEA", disco(c, 0.18, 8), LINEA, LINEA, 0.04, true, false);
    const penD = L * (16.5 / 105);
    const penW = Math.min(A * 0.62, A * (40.32 / 68));
    const areaD = L * (5.5 / 105);
    const areaW = Math.min(penW * 0.55, A * (18.32 / 68));
    const punto = L * (11 / 105);
    for (const s of [-1, 1]) {
      lineaBlanca(P(s * (hl - penD), -penW / 2), P(s * (hl - penD), penW / 2));
      lineaBlanca(P(s * hl, -penW / 2), P(s * (hl - penD), -penW / 2));
      lineaBlanca(P(s * hl, penW / 2), P(s * (hl - penD), penW / 2));
      lineaBlanca(P(s * (hl - areaD), -areaW / 2), P(s * (hl - areaD), areaW / 2));
      lineaBlanca(P(s * hl, -areaW / 2), P(s * (hl - areaD), -areaW / 2));
      lineaBlanca(P(s * hl, areaW / 2), P(s * (hl - areaD), areaW / 2));
      poner("MC-PARQUE-LINEA", disco(P(s * (hl - punto), 0), 0.16, 8), LINEA, LINEA, 0.03, true, false);
      const arco = Math.min(campo.arco, A * 0.22);
      lineaBlanca(P(s * hl, -arco / 2), P(s * (hl + 0.7), -arco / 2));
      lineaBlanca(P(s * hl, arco / 2), P(s * (hl + 0.7), arco / 2));
      lineaBlanca(P(s * (hl + 0.7), -arco / 2), P(s * (hl + 0.7), arco / 2));
      const rEsq = Math.max(0.45, Math.min(1, A * 0.03));
      for (const t of [-1, 1]) {
        const esq = P(s * hl, t * ha);
        const arcoE = disco(esq, rEsq, 8).filter((q) => {
          const dx = (q.x - c.x) * Math.cos(ang) + (q.y - c.y) * Math.sin(ang);
          const dy = -(q.x - c.x) * Math.sin(ang) + (q.y - c.y) * Math.cos(ang);
          return Math.abs(dx) <= hl + 0.02 && Math.abs(dy) <= ha + 0.02;
        });
        if (arcoE.length >= 3) poner("MC-PARQUE-LINEA", arcoE, "none", LINEA, 0.12, false, false);
      }
    }
    base.textos.push({ p: P(0, ha + 1.8), text: campo.nombre.toUpperCase(), size: 1.7, fill: "#143d24" });
    const redPerimetral = paseoPerimetral();

    const sep = 0.9;
    const anCamino = Math.max(2.2, anS);
    const offA = ha + sep + anCamino / 2;
    const offL = hl + sep + anCamino / 2;
    const ring = [P(-offL, -offA), P(offL, -offA), P(offL, offA), P(-offL, offA)];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const e = norm(sub(b, a));
      soltarTramo({ x: a.x - e.x * 0.35, y: a.y - e.y * 0.35 }, { x: b.x + e.x * 0.35, y: b.y + e.y * 0.35 }, anCamino);
      empalme(a, anCamino);
    }
    const bordesCancha = ring.map((p, i) => lerp(p, ring[(i + 1) % ring.length], 0.5));
    const perimetro = redPerimetral.length ? redPerimetral : bordesCancha;
    for (const medio of bordesCancha) {
      const meta = perimetro.reduce((m, p) => (dist(p, medio) < dist(m, medio) ? p : m), perimetro[0]);
      if (dist(medio, meta) > 1.2 && dist(medio, meta) < 18) {
        soltarTramo(medio, meta, anS);
        empalme(medio, anCamino);
        empalme(meta, anP);
      }
    }
    eje = bordesCancha;
    if (eje.length < 2) eje = [P(-offL, 0), P(offL, 0)];
    const estancias = bordesCancha
      .map((p) => ({ p, h: holgura(p, poly) }))
      .filter((s) => s.h > 3.2)
      .sort((a, b) => b.h - a.h);
    const apartar = (p: V2, d: number) => {
      const n = norm(sub(p, c));
      return { x: p.x + n.x * d, y: p.y + n.y * d };
    };
    for (const sitio of estancias) {
      if (plazaOk && dist(sitio.p, nodo) < ladoPlaza + 3) continue;
      for (const d of [4, 6.5, 9]) {
        const q = apartar(sitio.p, d);
        if (!pointInPoly(q, poly)) continue;
        juegosP = equiparJuegos(q, ang, areaP, poly, base.textos, poner, dentro, choca, ocupados);
        if (juegosP) break;
      }
      if (juegosP) break;
    }
    if (!juegosP) {
      for (let x = caja.minX + 5; x < caja.maxX - 5 && !juegosP; x += 7) {
        for (let y = caja.minY + 5; y < caja.maxY - 5 && !juegosP; y += 7) {
          const q = { x, y };
          if (dist(q, c) < Math.hypot(hl, ha) + 3) continue;
          if (plazaOk && dist(q, nodo) < ladoPlaza + 2) continue;
          juegosP = equiparJuegos(q, ang, areaP, poly, base.textos, poner, dentro, choca, ocupados);
        }
      }
    }
    const puesta = ponerPlazas(poly, categoria, estilo, ocupados, c, bordesCancha[0] ?? c, bordesCancha, ang, poner, soltarTramo, base);
    if (puesta) {
      plazaOk = true;
      nodo = puesta.centro;
      ladoPlaza = puesta.lado;
    }
  } else {
    const redPasiva = paseoPerimetral();
    if (redPasiva.length >= 4) {
      const c = centroid(redPasiva);
      const rLoop = Math.min(caja.w, caja.h) * (estilo === "organico" ? 0.18 : 0.12);
      const nudos = estilo === "organico" ? 7 : 4;
      const anillo: V2[] = [];
      for (let i = 0; i < nudos; i++) {
        const a = (i / nudos) * Math.PI * 2;
        anillo.push(alejar({ x: c.x + Math.cos(a) * rLoop, y: c.y + Math.sin(a) * rLoop }, poly, anS / 2 + 0.4, c));
      }
      for (let i = 0; i < anillo.length; i++) {
        soltarTramo(anillo[i], anillo[(i + 1) % anillo.length], anS);
        empalme(anillo[i], anS);
      }
      for (let i = 0; i < redPasiva.length; i += Math.max(1, Math.floor(redPasiva.length / (estilo === "organico" ? 6 : 4)))) {
        const meta = anillo.reduce((m, p) => (dist(p, redPasiva[i]) < dist(m, redPasiva[i]) ? p : m), anillo[0]);
        soltarTramo(meta, redPasiva[i], anS);
        empalme(redPasiva[i], anP);
      }
      for (const extra of entradas) {
        const meta = anillo.reduce((m, p) => (dist(p, extra) < dist(m, extra) ? p : m), anillo[0]);
        if (dist(meta, extra) > 2) soltarTramo(meta, extra, anT);
      }
      eje = anillo;
    }
    if (eje.length < 2 && entradas.length >= 1) {
      const a = entradas[0];
      const b = entradas[Math.min(entradas.length - 1, 1)] ?? centro;
      const lado = norm(sub(b, a));
      const perp = { x: -lado.y, y: lado.x };
      const desvio = estilo === "organico" ? Math.min(dist(a, b) * 0.22, 14) : estilo === "lineal" ? dist(a, b) * 0.04 : 0;
      const control = { x: (a.x + b.x) / 2 + perp.x * desvio, y: (a.y + b.y) / 2 + perp.y * desvio };
      const curva = (estilo === "geometrico" ? [a, centro, b] : bezier(a, b, control, 8)).map((p) => alejar(p, poly, anP / 2 + 0.35, centro));
      eje = curva;
      for (let i = 0; i < curva.length - 1; i++) soltarTramo(curva[i], curva[i + 1], anP);
      if (entradas.length > 2) {
        for (const extra of entradas.slice(2)) {
          const cerca = eje.reduce((m, p) => (dist(p, extra) < dist(m, extra) ? p : m), eje[0]);
          soltarTramo(cerca, alejar(extra, poly, anS / 2 + 0.3, centro), anS);
        }
      }
    }
    nodo = eje.length ? eje[Math.floor(eje.length / 2)] : centro;
    angEje = eje.length >= 2 ? Math.atan2(eje[eje.length - 1].y - eje[0].y, eje[eje.length - 1].x - eje[0].x) : rumbo;
    const puesta = ponerPlazas(poly, categoria, estilo, ocupados, null, nodo, eje, angEje, poner, soltarTramo, base);
    if (puesta) {
      plazaOk = true;
      nodo = puesta.centro;
      ladoPlaza = puesta.lado;
    }
    for (let k = 0; k < 16 && !juegosP; k++) {
      const a = (k / 16) * Math.PI * 2;
      const q = alejar({ x: nodo.x + Math.cos(a) * (ladoPlaza + 7), y: nodo.y + Math.sin(a) * (ladoPlaza + 7) }, poly, 3.5, centro);
      if (holgura(q, poly) < 3.5) continue;
      juegosP = equiparJuegos(q, angEje, areaP, poly, base.textos, poner, dentro, choca, ocupados);
    }
  }

  const descansos: V2[] = [];
  if (eje.length >= 3) {
    for (let i = 1; i < eje.length - 1; i += estilo === "lineal" ? 1 : 2) {
      if (descansos.length >= 4) break;
      const p = eje[i];
      const prev = eje[Math.max(0, i - 1)];
      const next = eje[Math.min(eje.length - 1, i + 1)];
      const dir = norm(sub(next, prev));
      const n = { x: -dir.y, y: dir.x };
      const signo = i % 2 === 0 ? 1 : -1;
      const largo = estilo === "lineal" ? 6.5 : 4.2;
      const q = alejar({ x: p.x + n.x * signo * largo, y: p.y + n.y * signo * largo }, poly, 1.3, centro);
      if (dist(q, nodo) < ladoPlaza * 0.55) continue;
      if (juegosP && dist(q, juegosP) < 4) continue;
      soltarTramo(p, q, anT);
      const banca = recto(q, 1.7, 0.48, Math.atan2(dir.y, dir.x));
      if (dentro(banca, poly, 0.08) && !choca(banca, ocupados)) {
        poner("MC-PARQUE-BANCA", banca, BANCA, "#4e392c", 0.04, true, true);
        descansos.push(q);
        const mesa = recto({ x: q.x + n.x * signo * 1.3, y: q.y + n.y * signo * 1.3 }, 0.8, 0.8, 0);
        if (dentro(mesa, poly, 0.05)) poner("MC-PARQUE-MOB", mesa, "#8d6a45", "#6a4e32", 0.04, true, false);
      }
    }
  }

  let arboles = 0;
  const arbol = (c: V2, r = 1.35) => {
    if (arboles > 64) return;
    if (holgura(c, poly) < r + 0.25) return;
    if (ocupados.some((o) => pointInPoly(c, o.pts))) return;
    const copa = disco(c, r, 16);
    if (!dentro(copa, poly, 0.02)) return;
    poner("MC-PARQUE-ARBOL", copa, COPA, "#245233", 0.04, true, false);
    poner("MC-PARQUE-ARBOL", disco(c, r * 0.62, 12), COPA2, COPA2, 0.03, true, false);
    poner("MC-PARQUE-ARBOL", disco(c, 0.16, 8), TRONCO, TRONCO, 0.02, true, false);
    arboles++;
  };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const L = dist(a, b);
    const e = norm(sub(b, a));
    const n1 = { x: -e.y, y: e.x };
    const n2 = { x: e.y, y: -e.x };
    const prueba = { x: lerp(a, b, 0.5).x + n1.x, y: lerp(a, b, 0.5).y + n1.y };
    const inn = pointInPoly(prueba, poly) ? n1 : n2;
    for (let s = 3.2; s < L - 2; s += 7.5) {
      const p = lerp(a, b, s / L);
      arbol({ x: p.x + inn.x * 2.5, y: p.y + inn.y * 2.5 }, 1.45);
    }
  }
  for (const d of descansos) arbol({ x: d.x + 1.8, y: d.y + 1.1 }, 1.7);
  if (plazaOk) arbol(alejar({ x: nodo.x + ladoPlaza * 0.55, y: nodo.y + ladoPlaza * 0.2 }, poly, 1.6, centro), 1.8);
  const grupo = alejar({ x: centro.x + caja.w * 0.12, y: centro.y - caja.h * 0.1 }, poly, 2.2, centro);
  for (const g of [
    { x: 0, y: 0 },
    { x: 2.1, y: 0.6 },
    { x: -1.6, y: 1.4 },
    { x: 0.4, y: -1.8 },
  ]) {
    arbol({ x: grupo.x + g.x, y: grupo.y + g.y }, 1.15);
  }

  let arb = 0;
  for (let i = 0; i < poly.length && arb < 28; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (dist(a, b) < 12) continue;
    const e = norm(sub(b, a));
    const n1 = { x: -e.y, y: e.x };
    const n2 = { x: e.y, y: -e.x };
    const mid = lerp(a, b, 0.35);
    const inn = pointInPoly({ x: mid.x + n1.x, y: mid.y + n1.y }, poly) ? n1 : n2;
    for (let k = 0; k < 4; k++) {
      const c = { x: mid.x + inn.x * (3.6 + (k % 2)) + e.x * k * 0.7, y: mid.y + inn.y * (3.6 + (k % 2)) + e.y * k * 0.7 };
      const m = disco(c, 0.55, 8);
      if (dentro(m, poly, 0.05) && !choca(m, ocupados)) {
        poner("MC-PARQUE-FLOR", m, ARBUSTO, "#3f6b3c", 0.03, true, false);
        arb++;
      }
    }
  }

  if (eje.length >= 2) {
    let recorrido = 0;
    for (let i = 0; i < eje.length - 1; i++) recorrido += dist(eje[i], eje[i + 1]);
    const pasoLuz = Math.max(10, Math.min(16, recorrido / 6));
    let acumulado = pasoLuz * 0.5;
    for (let i = 0; i < eje.length - 1; i++) {
      const L = dist(eje[i], eje[i + 1]);
      while (acumulado <= L) {
        const p = lerp(eje[i], eje[i + 1], acumulado / L);
        if (pointInPoly(p, poly) && holgura(p, poly) > 0.4) {
          poner("MC-PARQUE-LUZ", disco(p, 0.38, 10), "#f4f1ea", "#2a2a2a", 0.05, true, false);
          const e = norm(sub(eje[i + 1], eje[i]));
          poner(
            "MC-PARQUE-LUZ",
            [
              { x: p.x - e.y * 0.7, y: p.y + e.x * 0.7 },
              { x: p.x + e.y * 0.7, y: p.y - e.x * 0.7 },
            ],
            "none",
            "#2a2a2a",
            0.04,
            false,
            false,
          );
        }
        acumulado += pasoLuz;
      }
      acumulado -= L;
    }
  }

  if (entradas[0]) {
    const e = entradas[0];
    const rack = recto(alejar({ x: e.x + 1.6, y: e.y + 1.1 }, poly, 1, centro), 2.3, 0.7, angEje);
    if (dentro(rack, poly, 0.08)) poner("MC-PARQUE-MOB", rack, "#eceae4", "#3a3a3a", 0.05, true, false);
    const tacho = disco(alejar({ x: nodo.x + 1.4, y: nodo.y - 1.1 }, poly, 0.6, centro), 0.32, 8);
    if (dentro(tacho, poly, 0.02)) poner("MC-PARQUE-MOB", tacho, "#3e3e3e", "#1c1c1c", 0.03, true, false);
  }

  const estiloTxt = estilo === "organico" ? "orgánico" : estilo === "geometrico" ? "geométrico" : "lineal";
  const zonas = [
    "circulación jerárquica",
    plazaOk ? "plaza" : "",
    canchaNombre ? canchaNombre.toLowerCase() : "",
    juegosP ? "juegos con zona de seguridad" : "",
    descansos.length ? "descanso" : "",
    "árboles de borde, grupo y sombra",
    "arbustos",
    "luminarias sobre el recorrido",
  ].filter(Boolean);
  base.nota = `Estilo ${estiloTxt}, ${categoria === "activa" ? "recreación activa" : "recreación pasiva"}. Una sola vereda perimetral. Los recorridos internos empalman en curva con esa vereda. ${zonas.join(", ")}. ${canchaNombre ? `Losa ${canchaNombre.toLowerCase()} con anillo que empalma a la vereda.` : "El césped es el área que dejan los recorridos."}`;
  return base;
}

export function disenarParques(polys: V2[][], ajustes: AjusteParque[], traza: "recta" | "curva" = "recta"): Parque[] {
  const panos = unirPanos(polys);
  return panos.map((poly, i) => {
    const clave = claveDe(poly);
    const aj = ajustes.find((a) => a.clave === clave) ?? (panos.length === 1 ? ajustes[0] : undefined);
    const cabeCancha = esConvexo(poly) && Math.abs(area(poly)) > 280 && Math.min(bbox(poly).w, bbox(poly).h) > 16;
    const categoria: CategoriaParque = aj?.categoria ?? (cabeCancha ? "activa" : "pasiva");
    const estilo = aj?.estilo ?? (traza === "curva" ? "organico" : undefined);
    const parque = disenarUno(poly, categoria, estilo, i, { largo: aj?.largoCancha, ancho: aj?.anchoCancha });
    parque.clave = clave;
    return parque;
  });
}
