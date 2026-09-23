import { area, bbox, centroid, clipPoly, cross, dist, ensureCCW, lerp, norm, pointInPoly, sub, type V2 } from "./geom";
import type { AjusteParque, CategoriaParque, EstiloParque, Parque, PiezaParque } from "./tipos";

/**
 * Parque dentro del aporte de recreación.
 * Primero el perímetro y la circulación; el césped es lo que queda entre recorridos.
 * Nada se acepta si sale del polígono.
 */

const CESPED = "#c5d6b6";
const CESPED_LINEA = "#7d9a72";
const SENDERO = "#e4dfd4";
const SENDERO_EJE = "#b7b1a6";
const PLAZA = "#d5cfc3";
const ARENA = "#e6d3a4";
const CANCHA = "#3c8f5c";
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
  { nombre: "Fútbol 7", largo: 50, ancho: 30, arco: 5, rCentro: 6 },
  { nombre: "Fulbito", largo: 32, ancho: 18, arco: 3, rCentro: 3 },
  { nombre: "Multiuso", largo: 20, ancho: 12, arco: 2, rCentro: 2 },
  { nombre: "Básquet", largo: 15, ancho: 8, arco: 1.8, rCentro: 1.8 },
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
    const p1 = { x: mid.x + n.x * 2.4, y: mid.y + n.y * 2.4 };
    const p2 = { x: mid.x - n.x * 2.4, y: mid.y - n.y * 2.4 };
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

function choca(pts: V2[], ocupados: { pts: V2[]; capa: string }[], salvo: string[] = []): boolean {
  const c = pts.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
  c.x /= pts.length;
  c.y /= pts.length;
  return ocupados.some((o) => !salvo.includes(o.capa) && o.pts.length >= 3 && pointInPoly(c, o.pts));
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

function disenarUno(poly: V2[], categoria: CategoriaParque, estiloIn: EstiloParque | undefined, indice: number): Parque {
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

  base.piezas.push(pieza("MC-PARQUE-CESPED", poly, CESPED, CESPED_LINEA, 0.1, true));

  const entradas = accesos(poly, centro);
  const anP = areaP > 2200 ? 3 : areaP > 900 ? 2.4 : 1.8;
  const anS = Math.max(1.8, anP - 0.6);
  const anT = 1.2;
  let eje: V2[] = [];

  const soltarTramo = (a: V2, b: V2, ancho: number) => {
    if (dist(a, b) < 0.8) return;
    const rec = poner("MC-PARQUE-SENDERO", tramo(a, b, ancho), SENDERO, "#c9c2b4", 0.05, true, true);
    if (!rec) return;
    poner("MC-PARQUE-SENDERO", [lerp(a, b, 0.08), lerp(a, b, 0.92)], "none", SENDERO_EJE, 0.04, false, false);
  };

  if (estilo === "geometrico" && esConvexo(poly)) {
    const loop = inset(poly, Math.min(5, Math.min(caja.w, caja.h) * 0.16));
    if (loop.length >= 4) {
      eje = loop;
      for (let i = 0; i < loop.length; i++) soltarTramo(loop[i], loop[(i + 1) % loop.length], anP);
      const c = centroid(loop);
      for (let i = 0; i < loop.length; i += Math.max(1, Math.floor(loop.length / 4))) {
        soltarTramo(c, loop[i], anS);
      }
    }
  }

  if (eje.length < 2 && entradas.length >= 1) {
    const a = entradas[0];
    const b = entradas[Math.min(entradas.length - 1, 1)] ?? centro;
    const lado = norm(sub(b, a));
    const perp = { x: -lado.y, y: lado.x };
    const desvio = estilo === "organico" ? Math.min(dist(a, b) * 0.22, 14) : estilo === "lineal" ? dist(a, b) * 0.04 : 0;
    const control = {
      x: (a.x + b.x) / 2 + perp.x * desvio,
      y: (a.y + b.y) / 2 + perp.y * desvio,
    };
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

  const nodo = eje.length ? eje[Math.floor(eje.length / 2)] : centro;
  const angEje = eje.length >= 2 ? Math.atan2(eje[eje.length - 1].y - eje[0].y, eje[eje.length - 1].x - eje[0].x) : 0;
  const ladoPlaza = Math.max(5.5, Math.min(estilo === "lineal" ? 14 : 18, Math.sqrt(Math.max(areaP, 1)) * 0.2));
  const plaza =
    estilo === "organico"
      ? disco(nodo, ladoPlaza * 0.42, 22)
      : estilo === "lineal"
        ? recto(nodo, ladoPlaza * 1.3, ladoPlaza * 0.55, angEje)
        : recto(nodo, ladoPlaza, ladoPlaza * 0.85, 0);
  const plazaOk = poner("MC-PARQUE-PLAZA", plaza, PLAZA, "#9c968b", 0.08, true, true, ["MC-PARQUE-SENDERO"]);
  if (plazaOk) base.textos.push({ p: nodo, text: "PLAZA", size: Math.min(2.2, ladoPlaza * 0.22), fill: "#3c3832" });

  let canchaNombre = "";
  if (categoria === "activa") {
    const dir = { x: Math.cos(angEje), y: Math.sin(angEje) };
    for (const campo of CAMPOS) {
      let puesto: V2 | null = null;
      const paso = 3;
      for (let x = caja.minX + 2; x < caja.maxX - 2 && !puesto; x += paso) {
        for (let y = caja.minY + 2; y < caja.maxY - 2 && !puesto; y += paso) {
          const c = { x, y };
          if (dist(c, nodo) < ladoPlaza * 0.9) continue;
          for (const giro of [false, true]) {
            const w = giro ? campo.ancho : campo.largo;
            const h = giro ? campo.largo : campo.ancho;
            const box = recto(c, w, h, angEje);
            if (!dentro(box, poly, 0.4) || choca(box, ocupados)) continue;
            const losa = poner("MC-PARQUE-CANCHA", box, CANCHA, "#1e5a34", 0.1, true, true);
            if (!losa) continue;
            puesto = c;
            const u = dir;
            const v = { x: -u.y, y: u.x };
            const linea = (p: V2, q: V2) => poner("MC-PARQUE-LINEA", [p, q], "none", LINEA, 0.1, false, false);
            const extremo = (s: number) => ({ x: c.x + u.x * (w / 2) * s, y: c.y + u.y * (w / 2) * s });
            const lado = (s: number, t: number) => ({
              x: c.x + u.x * (w / 2) * s + v.x * (h / 2) * t,
              y: c.y + u.y * (w / 2) * s + v.y * (h / 2) * t,
            });
            linea(lado(-1, -1), lado(1, -1));
            linea(lado(1, -1), lado(1, 1));
            linea(lado(1, 1), lado(-1, 1));
            linea(lado(-1, 1), lado(-1, -1));
            linea(lado(0, -1), lado(0, 1));
            const cir = disco(c, Math.min(campo.rCentro, h * 0.28), 16);
            if (dentro(cir, poly, 0.05)) poner("MC-PARQUE-LINEA", cir, "none", LINEA, 0.08, true, false);
            linea(extremo(-1), { x: extremo(-1).x - u.x * campo.arco, y: extremo(-1).y - u.y * campo.arco });
            canchaNombre = campo.nombre;
            base.textos.push({ p: { x: c.x, y: c.y + 1.2 }, text: campo.nombre.toUpperCase(), size: 1.5, fill: LINEA });
            break;
          }
        }
      }
      if (canchaNombre) break;
    }
  }

  const juegoAncho = areaP > 700 ? 7.2 : 5.2;
  const juegoAlto = areaP > 700 ? 5.2 : 3.8;
  const seg = 1.5;
  let juegosP: V2 | null = null;
  for (let k = 0; k < 24 && !juegosP; k++) {
    const ang = (k / 24) * Math.PI * 2;
    const radio = ladoPlaza * 0.85 + 6 + (k % 5);
    const c = alejar({ x: nodo.x + Math.cos(ang) * radio, y: nodo.y + Math.sin(ang) * radio }, poly, 3, centro);
    if (canchaNombre && dist(c, nodo) < ladoPlaza) continue;
    const pad = recto(c, juegoAncho + seg * 2, juegoAlto + seg * 2, angEje);
    if (!dentro(pad, poly, 0.25) || choca(pad, ocupados)) continue;
    poner("MC-PARQUE-JUEGO", pad, ARENA, "#c4b48a", 0.06, true, true);
    const columpio = recto({ x: c.x - 1.1, y: c.y }, 3.1, 0.16, angEje);
    poner("MC-PARQUE-JUEGO", columpio, JUEGO, JUEGO, 0.05, true, false);
    const tobogan = recto({ x: c.x + 1.6, y: c.y + 0.4 }, 2.2, 1.1, angEje + 0.4);
    poner("MC-PARQUE-JUEGO", tobogan, JUEGO2, "#2a5274", 0.05, true, false);
    base.textos.push({ p: { x: c.x, y: c.y - juegoAlto * 0.15 }, text: "JUEGOS", size: 1.35, fill: "#5c4630" });
    juegosP = c;
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
  base.nota = `Estilo ${estiloTxt}, ${categoria === "activa" ? "recreación activa" : "recreación pasiva"}. El perímetro manda: primero accesos y recorridos (principal ${anP.toFixed(2)} m, secundario ${anS.toFixed(2)} m, terciario ${anT.toFixed(2)} m, todos ≥ 1.20 m y continuos), después ${zonas.join(", ")}. El césped es el área que dejan los recorridos.`;
  return base;
}

export function disenarParques(polys: V2[][], ajustes: AjusteParque[]): Parque[] {
  const panos = unirPanos(polys);
  return panos.map((poly, i) => {
    const clave = claveDe(poly);
    const aj = ajustes.find((a) => a.clave === clave) ?? (panos.length === 1 ? ajustes[0] : undefined);
    const cabeCancha = esConvexo(poly) && Math.abs(area(poly)) > 280 && Math.min(bbox(poly).w, bbox(poly).h) > 16;
    const categoria: CategoriaParque = aj?.categoria ?? (cabeCancha ? "activa" : "pasiva");
    const parque = disenarUno(poly, categoria, aj?.estilo, i);
    parque.clave = clave;
    return parque;
  });
}
