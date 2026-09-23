import { area, centroid, dist, ensureCCW, pointInPoly, type V2 } from "./geom";
import type { AjusteParque, CategoriaParque, Parque, PiezaParque } from "./tipos";

/**
 * Ornamentación del aporte de recreación (GH.020 Art. 29 y Art. 56.e).
 * El paño se apoya en su lado más largo. Todo el equipamiento arranca desde
 * ese extremo, con retiro de 2.00 m, y solo se dibuja si queda entero adentro.
 */

const RETIRO = 2;
const CESPED = "#6fa86a";
const CESPED_LINEA = "#4e7c4a";
const CANCHA = "#2f7a45";
const LINEA = "#f4f7f2";
const BANCA = "#7a4e2d";
const SENDERO = "#e4d2b0";
const FLOR = ["#d4537e", "#e6b325", "#f7f3ea"] as const;
const HOJA = "#3e7a45";
const TRONCO = "#6d4c32";
const COPA = "#2f6b3a";
const JUEGO = "#c4473a";
const JUEGO2 = "#3d6f9a";

type Campo = {
  nombre: string;
  largo: number;
  ancho: number;
  arco: number;
  profArco: number;
  rCentro: number;
  penal: [number, number];
  meta: [number, number];
  punto: number;
};

/** Del mayor al menor. Fútbol 11 recreativo, fútbol 7 y futsal (FIFA, largo 38–42 m). */
const CAMPOS: Campo[] = [
  { nombre: "Fútbol 11", largo: 90, ancho: 45, arco: 7.32, profArco: 2, rCentro: 9.15, penal: [16.5, 40.32], meta: [5.5, 18.32], punto: 11 },
  { nombre: "Fútbol 7", largo: 60, ancho: 40, arco: 5, profArco: 1.6, rCentro: 6, penal: [12, 26], meta: [4, 14], punto: 8 },
  { nombre: "Fulbito", largo: 38, ancho: 20, arco: 3, profArco: 1, rCentro: 3, penal: [6, 12], meta: [2, 6], punto: 6 },
];

type Marco = { o: V2; x: V2; y: V2; largo: number };

function marcoDe(poly: V2[]): Marco | null {
  if (poly.length < 3) return null;
  let bi = 0;
  let best = -1;
  for (let i = 0; i < poly.length; i++) {
    const L = dist(poly[i], poly[(i + 1) % poly.length]);
    if (L > best) {
      best = L;
      bi = i;
    }
  }
  if (best < 4) return null;
  const a = poly[bi];
  const b = poly[(bi + 1) % poly.length];
  const ux = (b.x - a.x) / best;
  const uy = (b.y - a.y) / best;
  let nx = -uy;
  let ny = ux;
  const medio = { x: (a.x + b.x) / 2 + nx * 0.6, y: (a.y + b.y) / 2 + ny * 0.6 };
  if (!pointInPoly(medio, poly)) {
    nx = -nx;
    ny = -ny;
  }
  return { o: a, x: { x: ux, y: uy }, y: { x: nx, y: ny }, largo: best };
}

function mundo(m: Marco, x: number, y: number): V2 {
  return { x: m.o.x + m.x.x * x + m.y.x * y, y: m.o.y + m.x.y * x + m.y.y * y };
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
    const d = Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
    if (d < m) m = d;
  }
  return m;
}

function cabe(pts: V2[], poly: V2[], margen = 0.15): boolean {
  return pts.length >= 1 && pts.every((p) => holgura(p, poly) >= margen);
}

function muestraRect(pts: V2[], paso: number): V2[] {
  const out = pts.slice();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const L = dist(a, b);
    const n = Math.max(1, Math.ceil(L / paso));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function disco(c: V2, r: number, n = 12): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return pts;
}

function pieza(capa: string, pts: V2[], fill: string, stroke: string, sw: number, cerrado: boolean, hatch = false): PiezaParque {
  return { capa, pts, fill, stroke, sw, cerrado, hatch };
}

type Local = (x: number, y: number) => V2;

function rectLocal(loc: Local, x: number, y: number, w: number, h: number): V2[] {
  return [loc(x, y), loc(x + w, y), loc(x + w, y + h), loc(x, y + h)];
}

function claveDe(poly: V2[]): string {
  const c = centroid(poly);
  return `${Math.round(c.x)}:${Math.round(c.y)}`;
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

type Puesto = { x: number; y: number; campo: Campo };

function buscarCampo(marco: Marco, poly: V2[]): Puesto | null {
  const loc = (x: number, y: number) => mundo(marco, x, y);
  for (const campo of CAMPOS) {
    for (const giro of [false, true]) {
      const largo = giro ? campo.ancho : campo.largo;
      const ancho = giro ? campo.largo : campo.ancho;
      const paso = 2;
      const xMax = marco.largo - RETIRO - campo.profArco - largo;
      for (let x = RETIRO + campo.profArco; x <= xMax + 0.01; x += paso) {
        const y = RETIRO;
        const caja = rectLocal(loc, x - campo.profArco, y, largo + 2 * campo.profArco, ancho);
        if (!cabe(muestraRect(caja, 3), poly, 0.12)) continue;
        return { x, y, campo: { ...campo, largo, ancho } };
      }
    }
  }
  return null;
}

function lineasCancha(loc: Local, p: Puesto, piezas: PiezaParque[]) {
  const { x, y, campo } = p;
  const add = (pts: V2[], sw = 0.12) => {
    if (pts.length >= 2) piezas.push(pieza("MC-PARQUE-LINEA", pts, "none", LINEA, sw, false));
  };
  const box = (x0: number, y0: number, w: number, h: number) => add([loc(x0, y0), loc(x0 + w, y0), loc(x0 + w, y0 + h), loc(x0, y0 + h), loc(x0, y0)]);
  add([loc(x, y), loc(x + campo.largo, y), loc(x + campo.largo, y + campo.ancho), loc(x, y + campo.ancho), loc(x, y)], 0.16);
  add([loc(x + campo.largo / 2, y), loc(x + campo.largo / 2, y + campo.ancho)], 0.12);
  const centro = loc(x + campo.largo / 2, y + campo.ancho / 2);
  piezas.push(pieza("MC-PARQUE-LINEA", disco(centro, campo.rCentro, 20), "none", LINEA, 0.12, true));
  piezas.push(pieza("MC-PARQUE-LINEA", disco(centro, 0.18, 8), LINEA, LINEA, 0.04, true));
  add([
    loc(x + campo.largo / 2 - 0.7, y + campo.ancho / 2),
    loc(x + campo.largo / 2 + 0.7, y + campo.ancho / 2),
  ]);
  add([
    loc(x + campo.largo / 2, y + campo.ancho / 2 - 0.7),
    loc(x + campo.largo / 2, y + campo.ancho / 2 + 0.7),
  ]);
  const penal = (desdeIzq: boolean) => {
    const [prof, anch] = campo.penal;
    const [pm, am] = campo.meta;
    const x0 = desdeIzq ? x : x + campo.largo - prof;
    const xm = desdeIzq ? x : x + campo.largo - pm;
    const y0 = y + (campo.ancho - anch) / 2;
    const ym = y + (campo.ancho - am) / 2;
    box(x0, y0, prof, anch);
    box(xm, ym, pm, am);
    const signo = desdeIzq ? 1 : -1;
    const spot = loc(x + (desdeIzq ? campo.punto : campo.largo - campo.punto), y + campo.ancho / 2);
    piezas.push(pieza("MC-PARQUE-LINEA", disco(spot, 0.12, 8), LINEA, LINEA, 0.03, true));
    const ya = y + campo.ancho / 2 - campo.arco / 2;
    const xLinea = desdeIzq ? x : x + campo.largo;
    const xExt = xLinea - signo * campo.profArco;
    add(
      [loc(xLinea, ya), loc(xExt, ya), loc(xExt, ya + campo.arco), loc(xLinea, ya + campo.arco)],
      0.18,
    );
  };
  penal(true);
  penal(false);
}

function flor(loc: Local, x: number, y: number, poly: V2[], piezas: PiezaParque[]) {
  const c = loc(x, y);
  const hojas = disco(c, 0.85, 10);
  const petalos = FLOR.map((color, i) => {
    const a = (i / FLOR.length) * Math.PI * 2;
    return { color, pts: disco({ x: c.x + Math.cos(a) * 0.38, y: c.y + Math.sin(a) * 0.38 }, 0.32, 8) };
  });
  const todo = [hojas, ...petalos.map((p) => p.pts)];
  if (!todo.every((pts) => cabe(pts, poly, 0.05))) return;
  piezas.push(pieza("MC-PARQUE-FLOR", hojas, HOJA, HOJA, 0.04, true, true));
  for (const p of petalos) piezas.push(pieza("MC-PARQUE-FLOR", p.pts, p.color, p.color, 0.03, true, true));
}

function arbol(loc: Local, x: number, y: number, poly: V2[], piezas: PiezaParque[]) {
  const c = loc(x, y);
  const copa = disco(c, 1.15, 12);
  const tronco = rectLocal(loc, x - 0.12, y - 0.35, 0.24, 0.7);
  if (!cabe(copa, poly, 0.05) || !cabe(tronco, poly, 0.02)) return;
  piezas.push(pieza("MC-PARQUE-ARBOL", copa, COPA, "#245233", 0.05, true, true));
  piezas.push(pieza("MC-PARQUE-ARBOL", tronco, TRONCO, TRONCO, 0.03, true, true));
}

function banca(loc: Local, x: number, y: number, poly: V2[], piezas: PiezaParque[]) {
  const pts = rectLocal(loc, x, y, 1.6, 0.45);
  if (!cabe(pts, poly, 0.08)) return;
  piezas.push(pieza("MC-PARQUE-BANCA", pts, BANCA, "#5c3a22", 0.05, true, true));
}

function juegos(loc: Local, x: number, y: number, poly: V2[], piezas: PiezaParque[]) {
  const columpio = [
    loc(x, y),
    loc(x + 0.7, y + 2.2),
    loc(x + 2.5, y + 2.2),
    loc(x + 3.2, y),
  ];
  const barra = [loc(x + 0.7, y + 2.2), loc(x + 2.5, y + 2.2)];
  const asiento = rectLocal(loc, x + 1.2, y + 1.05, 0.8, 0.12);
  const tobogan = [loc(x + 4.2, y + 1.8), loc(x + 6.4, y), loc(x + 7.1, y), loc(x + 4.8, y + 1.8)];
  if (cabe(muestraRect(rectLocal(loc, x, y, 3.2, 2.2), 1.2), poly, 0.1)) {
    piezas.push(pieza("MC-PARQUE-JUEGO", columpio, "none", JUEGO, 0.1, false));
    piezas.push(pieza("MC-PARQUE-JUEGO", barra, "none", JUEGO, 0.12, false));
    piezas.push(pieza("MC-PARQUE-BANCA", asiento, JUEGO, JUEGO, 0.03, true, true));
  }
  if (cabe(tobogan, poly, 0.1)) piezas.push(pieza("MC-PARQUE-JUEGO", tobogan, JUEGO2, "#2a5274", 0.06, true, true));
}

function cesped(poly: V2[], marco: Marco, piezas: PiezaParque[], ocupar: V2[] | null) {
  piezas.push(pieza("MC-PARQUE-CESPED", poly, CESPED, CESPED_LINEA, 0.08, true, true));
  const paso = Math.abs(area(poly)) > 2800 ? 3.6 : 2.4;
  const loc = (x: number, y: number) => mundo(marco, x, y);
  let n = 0;
  for (let x = 1.2; x < marco.largo - 1 && n < 420; x += paso) {
    for (let y = 1.2; y < 80 && n < 420; y += paso) {
      const a = loc(x, y);
      const b = loc(x + 0.45, y + 0.7);
      if (!cabe([a, b], poly, 0.2)) {
        if (y > 4 && !pointInPoly(a, poly)) break;
        continue;
      }
      if (ocupar && pointInPoly({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ocupar)) continue;
      piezas.push(pieza("MC-PARQUE-CESPED", [a, b], "none", CESPED_LINEA, 0.05, false));
      n++;
    }
  }
}

function disenarUno(poly: V2[], categoria: CategoriaParque, indice: number): Parque {
  const marco = marcoDe(poly);
  const nombre = `Parque ${indice + 1}`;
  const base: Parque = {
    clave: claveDe(poly),
    categoria,
    nombre,
    poly,
    area: Math.abs(area(poly)),
    piezas: [],
    textos: [],
    nota: "",
  };
  if (!marco) {
    base.nota = "El paño no tiene un lado útil para apoyar el diseño.";
    return base;
  }
  const loc = (x: number, y: number) => mundo(marco, x, y);
  const puesto = categoria === "activa" ? buscarCampo(marco, poly) : null;
  const ocupar = puesto ? rectLocal(loc, puesto.x, puesto.y, puesto.campo.largo, puesto.campo.ancho) : null;
  cesped(poly, marco, base.piezas, ocupar);

  if (puesto && ocupar) {
    base.piezas.push(pieza("MC-PARQUE-CANCHA", ocupar, CANCHA, "#1f5c34", 0.1, true, true));
    lineasCancha(loc, puesto, base.piezas);
    const { x, y, campo } = puesto;
    banca(loc, x + 2, Math.max(0.35, y - 1.15), poly, base.piezas);
    banca(loc, x + campo.largo / 2, Math.max(0.35, y - 1.15), poly, base.piezas);
    flor(loc, x + campo.largo + campo.profArco + 1.6, y + 1.6, poly, base.piezas);
    flor(loc, x - campo.profArco - 1.6, y + campo.ancho - 1.6, poly, base.piezas);
    arbol(loc, x + campo.largo / 2, y + campo.ancho + 2.4, poly, base.piezas);
    juegos(loc, x + campo.largo + campo.profArco + 2.2, y + 3, poly, base.piezas);
    const titulo = loc(x + campo.largo / 2, y + campo.ancho / 2 + 2.4);
    if (cabe([titulo], poly, 0.2)) {
      base.textos.push({ p: titulo, text: campo.nombre.toUpperCase(), size: 1.7, fill: LINEA });
    }
    const cotaL = loc(x + campo.largo / 2, Math.max(0.7, y - 0.7));
    const cotaA = loc(Math.max(0.8, x - 0.2), y + campo.ancho / 2);
    if (cabe([cotaL], poly, 0.05)) base.textos.push({ p: cotaL, text: `${campo.largo.toFixed(2)} m`, size: 1.25, fill: "#1c1c1c" });
    if (cabe([cotaA], poly, 0.05)) base.textos.push({ p: cotaA, text: `${campo.ancho.toFixed(2)} m`, size: 1.25, fill: "#1c1c1c" });
    base.nota = `${campo.nombre} ${campo.largo.toFixed(0)} × ${campo.ancho.toFixed(0)} m, arco ${campo.arco.toFixed(2)} m, punto de centro y áreas. Retiro ${RETIRO.toFixed(2)} m al lindero del aporte (GH.020 Art. 29).`;
    return base;
  }

  if (categoria === "activa") {
    juegos(loc, RETIRO, RETIRO, poly, base.piezas);
    banca(loc, RETIRO + 8, RETIRO, poly, base.piezas);
    flor(loc, RETIRO + 1.4, RETIRO + 5, poly, base.piezas);
    arbol(loc, RETIRO + 6, RETIRO + 5.5, poly, base.piezas);
    const titulo = loc(RETIRO + 2, RETIRO + 8);
    if (cabe([titulo], poly, 0.1)) base.textos.push({ p: titulo, text: "RECREACIÓN ACTIVA", size: 1.6, fill: "#1c3d24" });
    base.nota = "El paño no da cabida a una losa entera. Se equipa con juegos, banca y área verde, retirados 2.00 m del lindero.";
    return base;
  }

  const largoSendero = Math.min(marco.largo - 2 * RETIRO - 1, 36);
  const sendero = rectLocal(loc, RETIRO, RETIRO, Math.max(4, largoSendero), 1.5);
  if (largoSendero >= 4 && cabe(muestraRect(sendero, 2), poly, 0.1)) {
    base.piezas.push(pieza("MC-PARQUE-SENDERO", sendero, SENDERO, "#cbb892", 0.06, true, true));
    for (let s = RETIRO + 1.2; s < RETIRO + largoSendero - 1.5; s += 8) banca(loc, s, RETIRO + 1.85, poly, base.piezas);
  }
  flor(loc, RETIRO + 1.3, RETIRO + 4.2, poly, base.piezas);
  flor(loc, RETIRO + Math.min(largoSendero, 12), RETIRO + 4.6, poly, base.piezas);
  arbol(loc, RETIRO + 4, RETIRO + 6.2, poly, base.piezas);
  arbol(loc, RETIRO + 11, RETIRO + 6.5, poly, base.piezas);
  const titulo = loc(RETIRO + 3, RETIRO + 8.2);
  if (cabe([titulo], poly, 0.1)) base.textos.push({ p: titulo, text: "RECREACIÓN PASIVA", size: 1.6, fill: "#1c3d24" });
  base.nota = "Recreación pasiva: césped, sendero de 1.50 m, bancas, arriates y árboles. Sin cancha. Retiro 2.00 m al lindero (GH.020 Art. 56.e).";
  return base;
}

export function disenarParques(polys: V2[][], ajustes: AjusteParque[]): Parque[] {
  const panos = unirPanos(polys);
  return panos.map((poly, i) => {
    const clave = claveDe(poly);
    const elegido = ajustes.find((a) => a.clave === clave)?.categoria;
    const marco = marcoDe(poly);
    const cabeCancha = marco ? buscarCampo(marco, poly) !== null : false;
    const categoria: CategoriaParque = elegido ?? (cabeCancha ? "activa" : "pasiva");
    const parque = disenarUno(poly, categoria, i);
    parque.clave = clave;
    return parque;
  });
}
