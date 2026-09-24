import {
  alcanceDePuntos,
  add,
  almost,
  area,
  areaAngulosAgudos,
  bbox,
  centroid,
  type Caja,
  clipByConvex,
  clipRect,
  clipSegment,
  dist,
  distPuntoPoligono,
  fmtM,
  dot,
  ensureCCW,
  lerp,
  longestEdgeAngle,
  mul,
  norm,
  perimeter,
  pointAlong,
  pointInPoly,
  rotate,
  selfIntersects,
  sub,
  type Rect,
  type V2,
} from "./geom";
import { esquinasDe, ochavarPoligono, polilineaSardinel, retroceso, tramaDe } from "./aceras";
import { disenarParques, unirPanos } from "./parque";
import {
  anchoSeccion,
  calidadAlcanza,
  calidadExigida,
  etiquetaHab,
  filaVivienda,
  maxManzana,
  partesDeSeccion,
  pavimentoVacio,
  radioEsquina,
} from "./norma";
import type {
  Criterios,
  Estado,
  Franja,
  CorteVia,
  IngresoGraf,
  LoteM,
  Modelo,
  Polilinea,
  ProyectoLot,
  UsoLote,
  Verificacion,
  ViaCampo,
  ViaGraficaExistente,
  ViaInterna,
} from "./tipos";

type Face = "n" | "s" | "e" | "w";
type Kind = "perim" | "doble";

type Work = {
  poly: V2[];
  area: number;
  frente: number;
  profundidad: number;
  centro: V2;
  grid: { band: number; col: number; side: number; index: number; kind: Kind };
  uso: UsoLote;
  /** Celda de diseño, en coordenadas locales, antes de recortar contra el lindero. */
  celda: Rect;
};

/** Mínimo de un lote de vivienda, también si el lindero lo deja en triángulo. */
const MIN_LOTE = 90;

const CAMPOS: { k: ViaCampo; nombre: string }[] = [
  { k: "pia", nombre: "PIA — interno de acera (terreno)" },
  { k: "pea", nombre: "PEA — externo de acera (calzada)" },
  { k: "eje", nombre: "Eje de vía" },
  { k: "pea2", nombre: "PEA' — externo de la otra acera" },
  { k: "pia2", nombre: "PIA' — interno de la segunda acera" },
];

function ver(id: string, norma: string, texto: string, estado: Estado, valor: string): Verificacion {
  return { id, norma, texto, estado, valor };
}

function letraManzana(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function frenteSobre(rect: Rect, face: Face, poly: V2[]): number {
  const vertical = face === "e" || face === "w";
  const N = 24;
  let acc = 0;
  let prev = false;
  const paso = (vertical ? rect.h : rect.w) / N;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = vertical ? (face === "e" ? rect.x + rect.w - 0.08 : rect.x + 0.08) : rect.x + rect.w * t;
    const y = vertical ? rect.y + rect.h * t : face === "n" ? rect.y + rect.h - 0.08 : rect.y + 0.08;
    const ins = pointInPoly({ x, y }, poly);
    if (i > 0 && ins && prev) acc += paso;
    else if (i > 0 && ins !== prev) acc += paso / 2;
    prev = ins;
  }
  return acc;
}

function fitDepth(span: number, target: number, dMin: number, dMax: number, W: number): { n: number; depth: number } {
  if (!(span > W + 10)) return { n: 0, depth: span };
  let best = { n: 0, depth: span, score: Infinity };
  for (let n = 1; n <= 24; n++) {
    const depth = (span / n - W) / 2;
    if (depth < 6) break;
    const inRange = depth >= dMin * 0.98 && depth <= dMax * 1.02;
    const score = Math.abs(depth - target) + (inRange ? 0 : 2500) + (depth + 0.05 < dMin ? 1800 : 0);
    if (score < best.score) best = { n, depth, score };
  }
  return best.n > 0 ? { n: best.n, depth: best.depth } : { n: 0, depth: span };
}

function fitLength(span: number, target: number, minL: number, maxL: number, W: number): { n: number; length: number } {
  let best = { n: 1, length: span, score: Infinity };
  for (let n = 1; n <= 40; n++) {
    const L = (span - (n - 1) * W) / n;
    if (L < 8) break;
    const inRange = L >= minL - 0.05 && L <= maxL + 0.05;
    const score = Math.abs(L - target) + (inRange ? 0 : 4000) + (L > maxL ? 6000 : 0);
    if (score < best.score) best = { n, length: L, score };
  }
  return best;
}

function unionRect(a: Rect, b: Rect): Rect {
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x + a.w, b.x + b.w);
  const y1 = Math.max(a.y + a.h, b.y + b.h);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function huella(grupo: { celda: Rect }[]): Rect {
  return grupo.reduce((r, g) => unionRect(r, g.celda), grupo[0].celda);
}

/** La celda casi no fue comida por el lindero: sirve para armar un aporte rectangular. */
function esRegular(w: Work): boolean {
  const cel = w.celda.w * w.celda.h;
  return cel > 8 && w.area + 0.5 >= cel * 0.9;
}

function aristaKey(a: V2, b: V2): string {
  const q = (p: V2) => `${Math.round(p.x * 25)},${Math.round(p.y * 25)}`;
  const ka = q(a);
  const kb = q(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/** Une al vecino todo polígono de vivienda que no llega a 90 m². */
function absorberChicos(lista: Work[]) {
  const trabados = new Set<Work>();
  let guard = 0;
  while (guard++ < 120) {
    const chico = lista
      .filter((w) => w.uso === "vivienda" && w.area + 0.5 < MIN_LOTE && !trabados.has(w))
      .sort((a, b) => a.area - b.area)[0];
    if (!chico) break;
    const bordes = new Set<string>();
    for (let i = 0; i < chico.poly.length; i++) bordes.add(aristaKey(chico.poly[i], chico.poly[(i + 1) % chico.poly.length]));
    const vecino = lista
      .filter((w) => {
        if (w === chico || w.uso !== "vivienda") return false;
        for (let i = 0; i < w.poly.length; i++) {
          if (bordes.has(aristaKey(w.poly[i], w.poly[(i + 1) % w.poly.length]))) return true;
        }
        return false;
      })
      .sort((a, b) => b.area - a.area)[0];
    const unidos = vecino ? unirPanos([vecino.poly, chico.poly]) : [];
    if (!vecino || unidos.length !== 1) {
      trabados.add(chico);
      continue;
    }
    vecino.poly = unidos[0];
    vecino.area = Math.abs(area(unidos[0]));
    vecino.centro = centroid(unidos[0]);
    vecino.frente = Math.max(vecino.frente, chico.frente);
    vecino.profundidad = vecino.frente > 0.5 ? vecino.area / vecino.frente : vecino.profundidad;
    vecino.celda = unionRect(vecino.celda, chico.celda);
    lista.splice(lista.indexOf(chico), 1);
  }
  for (let i = lista.length - 1; i >= 0; i--) {
    if (lista[i].uso === "vivienda" && lista[i].area + 0.5 < MIN_LOTE) lista.splice(i, 1);
  }
}

/** Alarga el lote hacia el lindero. El lado de la calle y el lindero con el vecino no se mueven. */
function extenderRect(rect: Rect, bb: Caja, lado: { o: boolean; e: boolean; s: boolean; n: boolean }): Rect {
  const m = 12;
  let x0 = rect.x;
  let y0 = rect.y;
  let x1 = rect.x + rect.w;
  let y1 = rect.y + rect.h;
  if (lado.o) x0 = bb.minX - m;
  if (lado.e) x1 = bb.maxX + m;
  if (lado.s) y0 = bb.minY - m;
  if (lado.n) y1 = bb.maxY + m;
  return { x: x0, y: y0, w: Math.max(0.05, x1 - x0), h: Math.max(0.05, y1 - y0) };
}

function suma(ls: Work[]): number {
  return ls.reduce((s, l) => s + l.area, 0);
}

function buscarVentana(works: Work[], need: number, minAncho: number, ambosLados: boolean, terreno: V2[]): Work[] | null {
  if (need < 1) return [];
  const pool = works.filter((w) => w.uso === "vivienda");
  const rectos = pool.filter(esRegular);
  const vivos = rectos.length >= 3 ? rectos : pool;
  const bands = [...new Set(vivos.map((w) => w.grid.band))];
  let best: Work[] | null = null;
  let bestScore = Infinity;
  for (const band of bands) {
    const en = vivos.filter((w) => w.grid.band === band);
    if (!en.length) continue;
    const kind = en[0].grid.kind;
    if (ambosLados && kind !== "doble") continue;
    const depthLote = en[0].profundidad;
    const alto = kind === "doble" && ambosLados ? depthLote * 2 : depthLote;
    if (minAncho > 0 && alto + 0.2 < minAncho) continue;
    const frente = Math.max(1, ...en.map((w) => w.frente));
    const columnas = [...new Set(en.map((w) => w.grid.col))];
    const indices = [...new Set(en.map((w) => w.grid.index))].sort((a, b) => a - b);
    for (const col of columnas) {
      const run = [col];
      for (let a = 0; a < indices.length; a++) {
        for (let b = a; b < indices.length; b++) {
          const i0 = indices[a];
          const i1 = indices[b];
          if (i1 - i0 !== b - a) continue;
          const ancho = (i1 - i0 + 1) * frente;
          if (minAncho > 0 && Math.min(ancho, alto) + 0.2 < minAncho) continue;
          const grupo = en.filter((w) => run.includes(w.grid.col) && w.grid.index >= i0 && w.grid.index <= i1);
          const lados = ambosLados && kind === "doble" ? 2 : 1;
          if (ambosLados && kind === "doble") {
            const expected = run.length * (i1 - i0 + 1) * 2;
            if (grupo.length !== expected) continue;
          } else if (kind === "doble" && !ambosLados) {
            const side0 = grupo.filter((w) => w.grid.side === 0);
            if (side0.length !== run.length * (i1 - i0 + 1)) continue;
            grupo.splice(0, grupo.length, ...side0);
          }
          if (grupo.length !== run.length * (i1 - i0 + 1) * lados && !(kind === "doble" && !ambosLados)) continue;
          const ar = suma(grupo);
          const rect = huella(grupo);
          const lleno = rect.w * rect.h;
          const celdas = grupo.reduce((s, g) => s + g.celda.w * g.celda.h, 0);
          if (lleno > celdas * 1.02) continue;
          const recortado = clipRect(terreno, rect);
          const aRec = Math.abs(area(recortado));
          const mordido = lleno < 1 || aRec + 1 < lleno * 0.985 || recortado.length > 5;
          const corto = ar + 1 < need ? need - ar : 0;
          const sobre = ar > need * 1.2 ? ar - need : 0;
          const score = Math.abs(ar - need) + sobre + corto + (mordido ? 40000 : 0);
          if (score < bestScore) {
            bestScore = score;
            best = grupo.slice();
          }
        }
      }
    }
  }
  return best;
}

/** La manzana entera: ambos frentes, sin dejar lotes de vivienda en ese paño. */
function manzanaCompleta(works: Work[], need: number, minAncho: number, terreno: V2[]): Work[] | null {
  const grupos = new Map<string, Work[]>();
  for (const w of works) {
    if (w.uso !== "vivienda" || w.grid.kind !== "doble") continue;
    const k = `${w.grid.band}:${w.grid.col}`;
    const arr = grupos.get(k) ?? [];
    arr.push(w);
    grupos.set(k, arr);
  }
  let best: Work[] | null = null;
  let bestScore = Infinity;
  for (const grupo of grupos.values()) {
    if (!grupo.some((w) => w.grid.side === 0) || !grupo.some((w) => w.grid.side === 1)) continue;
    const rect = huella(grupo);
    const lleno = rect.w * rect.h;
    const celdas = grupo.reduce((s, g) => s + g.celda.w * g.celda.h, 0);
    if (lleno < 1 || lleno > celdas * 1.04) continue;
    if (minAncho > 0 && Math.min(rect.w, rect.h) + 0.2 < minAncho) continue;
    const recortado = clipRect(terreno, rect);
    const aRec = Math.abs(area(recortado));
    if (aRec < 400) continue;
    const mordido = aRec + 1 < lleno * 0.985 || recortado.length > 6;
    const ar = suma(grupo);
    const corto = ar + 1 < need ? need - ar : 0;
    const score = Math.abs(ar - need) + corto + (mordido ? 40000 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = grupo.slice();
    }
  }
  return best;
}

function cercoConVanos(poly: V2[], vanos: { edge: number; d0: number; d1: number }[]): V2[][] {
  const out: V2[][] = [];
  let chain: V2[] = [];
  const brk = () => {
    if (chain.length >= 2) out.push(chain);
    chain = [];
  };
  const add = (p: V2) => {
    if (!chain.length || !almost(chain[chain.length - 1], p, 0.02)) chain.push(p);
  };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const L = dist(a, b);
    const gaps = vanos
      .filter((v) => v.edge === i)
      .map((v) => ({ d0: Math.max(0, Math.min(L, Math.min(v.d0, v.d1))), d1: Math.max(0, Math.min(L, Math.max(v.d0, v.d1))) }))
      .filter((v) => v.d1 - v.d0 > 0.05)
      .sort((p, q) => p.d0 - q.d0);
    const libres: { d0: number; d1: number }[] = [];
    let cursor = 0;
    for (const g of gaps) {
      if (g.d0 > cursor + 0.02) libres.push({ d0: cursor, d1: g.d0 });
      cursor = Math.max(cursor, g.d1);
    }
    if (cursor < L - 0.02) libres.push({ d0: cursor, d1: L });
    if (!libres.length) {
      brk();
      continue;
    }
    for (const seg of libres) {
      if (seg.d0 > 0.03) brk();
      add(lerp(a, b, seg.d0 / L));
      add(lerp(a, b, seg.d1 / L));
      if (seg.d1 < L - 0.03) brk();
    }
  }
  if (chain.length >= 2 && out.length && almost(chain[chain.length - 1], out[0][0], 0.05)) {
    out[0] = chain.concat(out[0].slice(1));
  } else if (chain.length >= 2) out.push(chain);
  return out;
}

function viaGrafica(v: ProyectoLot["vias"][number]): ViaGraficaExistente {
  const presentes = CAMPOS.map((c) => ({ ...c, p: v[c.k] })).filter((c): c is { k: ViaCampo; nombre: string; p: NonNullable<(typeof v)["pia"]> } => !!c.p && Number.isFinite(c.p.e) && Number.isFinite(c.p.n));
  const anchos: { etiqueta: string; metros: number }[] = [];
  for (let i = 0; i < presentes.length - 1; i++) {
    const metros = Math.hypot(presentes[i + 1].p.e - presentes[i].p.e, presentes[i + 1].p.n - presentes[i].p.n);
    const etiqueta =
      i === 0 && presentes[i].k === "pia"
        ? "Vereda lado terreno"
        : presentes[i].k === "pea" && presentes[i + 1].k === "eje"
          ? "Semicalzada"
          : presentes[i].k === "eje"
            ? "Semicalzada opuesta"
            : presentes[i + 1].k === "pia2"
              ? "Vereda opuesta"
              : "Tramo";
    anchos.push({ etiqueta, metros });
  }
  let ordenada = true;
  let franjas: Franja[] = [];
  let lineas: ViaGraficaExistente["lineas"] = [];
  if (presentes.length >= 2) {
    const p0 = { x: presentes[0].p.e, y: presentes[0].p.n };
    const p1 = { x: presentes[presentes.length - 1].p.e, y: presentes[presentes.length - 1].p.n };
    const across = norm(sub(p1, p0));
    const along = { x: -across.y, y: across.x };
    const L = 36;
    let tPrev = -Infinity;
    const pts = presentes.map((c) => {
      const p = { x: c.p.e, y: c.p.n };
      const t = dot(sub(p, p0), across);
      if (t + 0.05 < tPrev) ordenada = false;
      tPrev = t;
      return { ...c, w: p };
    });
    lineas = pts.map((c) => ({
      nombre: c.nombre,
      p: c.w,
      a: add(c.w, mul(along, -L)),
      b: add(c.w, mul(along, L)),
    }));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i].w;
      const b = pts[i + 1].w;
      const d = mul(along, L);
      const vereda = pts[i].k === "pia" || pts[i + 1].k === "pia2";
      franjas.push({
        tipo: vereda ? "existente-vereda" : "existente-calzada",
        poly: [sub(a, d), add(a, d), add(b, d), sub(b, d)],
      });
    }
  }
  return { nombre: v.nombre, lineas, franjas, anchos, completa: presentes.length === 5, ordenada };
}

function recortarViasAlPredio(vias: ViaGraficaExistente[], predio: V2[]): ViaGraficaExistente[] {
  if (predio.length < 3) return vias;
  return vias.map((v) => ({
    ...v,
    franjas: v.franjas
      .map((f) => ({ ...f, poly: clipByConvex(predio, f.poly) }))
      .filter((f) => f.poly.length >= 3),
    lineas: v.lineas.flatMap((ln) => {
      const segs = clipSegment(ln.a, ln.b, predio);
      return segs.map((seg) => {
        const mid = { x: (seg[0].x + seg[1].x) / 2, y: (seg[0].y + seg[1].y) / 2 };
        return { ...ln, a: seg[0], b: seg[1], p: pointInPoly(ln.p, predio) ? ln.p : mid };
      });
    }),
  }));
}

function rumboDeVia(p: ProyectoLot): number | null {
  if (p.cierre !== "abierta") return null;
  for (const v of p.vias) {
    if (!v.pia || !v.pia2) continue;
    const across = norm(sub({ x: v.pia2.e, y: v.pia2.n }, { x: v.pia.e, y: v.pia.n }));
    const along = { x: -across.y, y: across.x };
    return Math.atan2(along.y, along.x);
  }
  return null;
}

function vacio(ok: boolean, motivo: string, verificaciones: Verificacion[], parcial: Partial<Modelo> = {}): Modelo {
  return {
    ok,
    motivo,
    areaBruta: 0,
    perimetro: 0,
    areaVias: 0,
    areaLotes: 0,
    areaAportes: 0,
    areaResidual: 0,
    areaBaseAporte: 0,
    areaDescartadaArt31: 0,
    angulosAgudos: 0,
    sinAsignar: 0,
    aportes: [],
    lotes: [],
    parques: [],
    franjas: [],
    ejes: [],
    lindero: [],
    cerco: [],
    viasExistentes: [],
    ingresos: [],
    verificaciones,
    seccionPartes: [],
    seccionTotal: 0,
    viasInternas: [],
    polilineas: [],
    cortes: [],
    pavimento: pavimentoVacio(),
    largoManzana: 0,
    profundidad: 0,
    nManzanas: 0,
    rumboGrados: 0,
    ...parcial,
  };
}

export function proponer(p: ProyectoLot): Modelo {
  const pts = p.puntos.filter((q) => Number.isFinite(q.e) && Number.isFinite(q.n));
  if (pts.length < 3) {
    return vacio(false, "Falta el perímetro: cargue el CSV, el DXF o digite al menos tres vértices.", [
      ver("perimetro", "GH.020 Art. 56", "El plano de trazado exige el contorno del terreno con coordenadas.", "no-cumple", `${pts.length} vértices`),
    ], { viasExistentes: p.vias.map(viaGrafica) });
  }
  const crudos = pts.map((q) => ({ x: q.e, y: q.n }));
  const alcance = alcanceDePuntos(crudos);
  let world = ensureCCW(crudos);
  if (world.length >= 2 && almost(world[0], world[world.length - 1], 0.01)) world = world.slice(0, -1);
  if (!alcance.ok) {
    const texto = "Hay demasiada distancia entre los vértices. Modifique el perímetro para poder proceder.";
    const valor = alcance.lado ? `${fmtM(alcance.lado.metros, 0)} m` : `${fmtM(Math.max(alcance.ancho, alcance.alto), 0)} m`;
    return vacio(false, texto, [
      ver("alcance", "Geometría", texto, "no-cumple", valor),
    ], { lindero: world, perimetro: perimeter(world) });
  }
  const viasExistentes = recortarViasAlPredio(p.vias.map(viaGrafica), world);
  const bruta = area(world);
  const peri = perimeter(world);
  const cruza = selfIntersects(world);
  const checks: Verificacion[] = [];
  if (cruza) {
    checks.push(ver("cruce", "Geometría", "El perímetro se cruza a sí mismo. Corrija el orden de los vértices antes de modelar.", "no-cumple", fmtHa(bruta)));
    return vacio(false, "Perímetro cruzado.", checks, { areaBruta: bruta, perimetro: peri, lindero: world, viasExistentes });
  }
  if (bruta < 50) {
    checks.push(ver("area", "GH.020", "El área del polígono es insuficiente para una habilitación.", "no-cumple", `${bruta.toFixed(1)} m²`));
    return vacio(false, "Área insuficiente.", checks, { areaBruta: bruta, perimetro: peri, lindero: world, viasExistentes });
  }

  const c = p.criterios;
  const partes = partesDeSeccion(c.seccion);
  const W = anchoSeccion(c.seccion);
  const anguloVia = rumboDeVia(p);
  const ang = anguloVia ?? longestEdgeAngle(world);
  const centro = centroid(world);
  const toLocal = (q: V2) => rotate(sub(q, centro), -ang);
  const toWorld = (q: V2) => add(rotate(q, ang), centro);
  const local = world.map(toLocal);
  const bb = bbox(local);
  const anchoMin = Math.max(6, c.frenteMin > 0 ? c.frenteMin : 6);
  const areaPiso = Math.max(MIN_LOTE, c.areaMin > 0 ? c.areaMin : MIN_LOTE);
  const largoMin = Math.max(10, c.profundidad > 1 ? c.profundidad : 10);
  const fondo = Math.max(largoMin, areaPiso / anchoMin);
  const frenteDiseno = anchoMin;
  const dObjetivo = fondo;
  const dMin = Math.max(6, fondo * 0.96);
  const dMax = Math.max(dMin, fondo * 1.06);
  const tope = maxManzana(c);
  const objetivoL = Math.min(Math.max(c.largoManzana || 120, 40), tope);
  const depthFit = fitDepth(bb.h, dObjetivo, dMin, dMax, W);
  const lenFit = fitLength(bb.w, objetivoL, c.tipoHab === "industrial" ? 40 : 40, tope, W);

  const ingresos = ingresosDe(p, world, centro);
  const cerco = p.cierre === "cercada" ? cercoConVanos(world, ingresos.map((g) => ({ edge: g.arista, d0: g.distancia - g.ancho / 2, d1: g.distancia + g.ancho / 2 }))) : [];

  const rumboGrados = (Math.atan2(Math.sin(ang), Math.cos(ang)) * 180) / Math.PI;
  const azimut = (90 - rumboGrados + 360) % 360;

  if (depthFit.n < 1 || W < 4) {
    checks.push(
      ver(
        "cabida",
        "GH.020 Art. 8",
        "El predio no da cabida a una vía interna con la sección y la profundidad de lote indicadas.",
        "no-cumple",
        `Alto útil ${bb.h.toFixed(1)} m · sección ${W.toFixed(2)} m`,
      ),
    );
    return vacio(false, "No cabe la sección vial dentro del predio.", checks, {
      areaBruta: bruta,
      perimetro: peri,
      lindero: world,
      cerco,
      viasExistentes,
      ingresos,
      seccionPartes: partes,
      seccionTotal: W,
      rumboGrados: azimut,
    });
  }

  const D = depthFit.depth;
  const nStreets = depthFit.n;
  let errEje = 0;
  let ejeAplicado = false;
  if (p.cierre === "abierta") {
    const eje = p.vias.find((v) => v.eje)?.eje;
    if (eje) {
      const yE = toLocal({ x: eje.e, y: eje.n }).y;
      const pitch = 2 * D + W;
      const first = bb.minY + D + W / 2;
      const delta = yE - first;
      const k = Math.round(delta / pitch);
      const raw = delta - k * pitch;
      const lim = Math.max(4, D * 0.45);
      errEje = Math.max(-lim, Math.min(lim, raw));
      ejeAplicado = Math.abs(raw) <= lim + 0.01;
      if (Math.abs(raw) > lim) {
        checks.push(
          ver(
            "empalme-eje",
            "GH.020 Art. 5",
            "El eje preexistente no cae sobre una vía interna dentro de la tolerancia. Se alineó el rumbo; la transición de sección se detalla en pavimentos.",
            "observacion",
            `Desfase ${raw.toFixed(2)} m`,
          ),
        );
      }
    }
  }
  const Ds = D + errEje;

  const trama = tramaDe({
    bb,
    baseW: W,
    baseTipo: c.tipoVia,
    baseSeccion: c.seccion,
    nCallesH: nStreets,
    nManzanasX: lenFit.n,
    largo: lenFit.length,
    D,
    Ds,
    ajustes: p.ajustesVias ?? [],
    minTramo: Math.max(8, Math.min(D * 0.55, 14)),
  });
  const bandas = trama.bandas;
  const cols = trama.cols;
  const hCalles = trama.hCalles;
  const vCalles = trama.vCalles;
  const esquinas = esquinasDe(hCalles, vCalles);

  const works: Work[] = [];
  const volcar = (
    crudas: { calle: Rect; i: number }[],
    face: Face,
    side: number,
    bandN: number,
    colI: number,
    kind: Kind,
    marca: (i: number) => { o: boolean; e: boolean; s: boolean; n: boolean },
  ) => {
    const armar = (calle: Rect, lado: { o: boolean; e: boolean; s: boolean; n: boolean }) => {
      const rect = extenderRect(calle, bb, lado);
      const poly = clipRect(local, rect);
      return { calle, rect, poly, area: poly.length >= 3 ? area(poly) : 0 };
    };
    const piezas = crudas.map((celda) => ({ ...armar(celda.calle, marca(celda.i)), i: celda.i }));
    const fundirPieza = (i: number, j: number) => {
      const calle = unionRect(piezas[i].calle, piezas[j].calle);
      const a = marca(piezas[i].i);
      const b = marca(piezas[j].i);
      const hecho = armar(calle, { o: a.o || b.o, e: a.e || b.e, s: a.s || b.s, n: a.n || b.n });
      piezas[i] = { ...hecho, i: piezas[i].i };
      piezas.splice(j, 1);
    };
    for (let k = piezas.length - 1; k >= 1; k--) {
      if (piezas[k].area + 0.5 >= areaPiso) continue;
      fundirPieza(k - 1, k);
    }
    if (piezas.length >= 2 && piezas[0].area + 0.5 < areaPiso) fundirPieza(0, 1);
    piezas.forEach((pz, idx) => {
      if (pz.poly.length < 3 || pz.area < 8) return;
      const fEf = frenteSobre(pz.calle, face, local);
      const polyW = pz.poly.map(toWorld);
      works.push({
        poly: polyW,
        area: pz.area,
        frente: fEf,
        profundidad: fEf > 0.5 ? pz.area / fEf : face === "e" || face === "w" ? pz.calle.w : pz.calle.h,
        centro: centroid(polyW),
        grid: { band: bandN, col: colI, side, index: idx, kind },
        uso: "vivienda",
        celda: pz.calle,
      });
    });
  };
  for (const band of bandas) {
    const sur = band.calleAbajo === null;
    const norte = band.calleArriba === null;
    for (const col of cols) {
      const cabeTapa = col.w >= fondo * 2 + frenteDiseno && band.h + 0.02 >= frenteDiseno;
      const tapa = cabeTapa ? fondo : 0;
      if (tapa > 0) {
        const nT = Math.min(80, Math.max(1, Math.floor((band.h + 0.02) / frenteDiseno)));
        const oeste: { calle: Rect; i: number }[] = [];
        const este: { calle: Rect; i: number }[] = [];
        let yCursor = band.y;
        for (let i = 0; i < nT; i++) {
          const hLot = i === nT - 1 ? band.y + band.h - yCursor : frenteDiseno;
          oeste.push({ calle: { x: col.x, y: yCursor, w: tapa, h: Math.max(0.05, hLot) }, i });
          este.push({ calle: { x: col.x + col.w - tapa, y: yCursor, w: tapa, h: Math.max(0.05, hLot) }, i });
          if (i < nT - 1) yCursor += frenteDiseno;
        }
        const primera = (i: number) => i === 0;
        const ultima = (i: number) => i === nT - 1;
        volcar(oeste, "w", 2, band.band, col.i, band.kind, (i) => ({
          o: col.i === 0,
          e: false,
          s: sur && primera(i),
          n: norte && ultima(i),
        }));
        volcar(este, "e", 3, band.band, col.i, band.kind, (i) => ({
          o: false,
          e: col.i === cols.length - 1,
          s: sur && primera(i),
          n: norte && ultima(i),
        }));
      }
      const medioX = col.x + tapa;
      const medioW = col.w - tapa * 2;
      if (medioW < frenteDiseno * 0.8) continue;
      const slices =
        band.kind === "perim"
          ? [{ y: band.y, h: band.h, face: band.face as Face, side: 0 }]
          : [
              { y: band.y, h: band.h / 2, face: "s" as Face, side: 0 },
              { y: band.y + band.h / 2, h: band.h / 2, face: "n" as Face, side: 1 },
            ];
      for (const sl of slices) {
        const n = Math.min(80, Math.max(1, Math.floor((medioW + 0.02) / frenteDiseno)));
        const crudas: { calle: Rect; i: number }[] = [];
        let xCursor = medioX;
        for (let i = 0; i < n; i++) {
          const wLot = i === n - 1 ? medioX + medioW - xCursor : frenteDiseno;
          crudas.push({ calle: { x: xCursor, y: sl.y, w: Math.max(0.05, wLot), h: sl.h }, i });
          if (i < n - 1) xCursor += frenteDiseno;
        }
        volcar(crudas, sl.face, sl.side, band.band, col.i, band.kind, (i) => ({
          o: tapa === 0 && i === 0 && col.i === 0,
          e: tapa === 0 && i === n - 1 && col.i === cols.length - 1,
          s: sur,
          n: norte,
        }));
      }
    }
  }

  absorberChicos(works);

  const agudos = areaAngulosAgudos(world);
  const baseAporte = Math.max(0, bruta - c.cesionPrimaria - c.reservaRegional - c.servidumbreAT - agudos.area);
  const pedidos: { uso: UsoLote; concepto: string; pct: number; minimo: number; minAncho: number; ambos: boolean; piso: number }[] = [
    {
      uso: "recreacion",
      concepto: "Recreación pública (incluye parques zonales)",
      pct: Math.max(0, c.aporteRec) + Math.max(0, c.aporteParque),
      minimo: 800,
      minAncho: 25,
      ambos: true,
      piso: 0,
    },
    { uso: "educacion", concepto: "Educación", pct: c.aporteEdu, minimo: 400, minAncho: 0, ambos: false, piso: 400 },
    { uso: "otros", concepto: "Otros fines", pct: c.aporteOtros, minimo: 400, minAncho: 0, ambos: false, piso: 400 },
  ];
  const aportes = pedidos.map((ped) => {
    const requerido = (Math.max(0, ped.pct) / 100) * baseAporte;
    const objetivo = Math.max(requerido, ped.pct > 0 ? ped.piso : 0);
    if (requerido < 1) {
      return { concepto: ped.concepto, pct: ped.pct, requerido: 0, grafico: 0, minimo: ped.minimo, estado: "No exigido para este tipo" };
    }
    if (ped.piso < 1 && ped.minimo > 0 && requerido + 0.5 < ped.minimo) {
      return {
        concepto: ped.concepto,
        pct: ped.pct,
        requerido,
        grafico: 0,
        minimo: ped.minimo,
        estado: "Redención en dinero: el cálculo no alcanza el mínimo (Art. 27)",
      };
    }
    const completa = ped.uso === "recreacion" && (p.modoParque ?? "lotes") === "manzana";
    let grupo = completa ? manzanaCompleta(works, objetivo, ped.minAncho, local) : null;
    if (!grupo) grupo = buscarVentana(works, objetivo, ped.minAncho, ped.ambos, local);
    if (!grupo && ped.ambos) grupo = buscarVentana(works, objetivo, ped.minAncho, false, local);
    if (!grupo || !grupo.length) {
      return {
        concepto: ped.concepto,
        pct: ped.pct,
        requerido,
        grafico: 0,
        minimo: ped.minimo,
        estado: "No se ubicó un lote regular con el ancho exigido. Ajuste profundidad o longitud de manzana.",
      };
    }
    const rect = huella(grupo);
    const polyL = clipRect(local, rect);
    if (polyL.length >= 3) {
      const poly = polyL.map(toWorld);
      const quitar = new Set(grupo);
      for (const w of works) {
        if (w.uso !== "vivienda") continue;
        const mismaManzana = completa && w.grid.band === grupo[0].grid.band && w.grid.col === grupo[0].grid.col;
        if (mismaManzana || pointInPoly(w.centro, poly)) quitar.add(w);
      }
      for (let i = works.length - 1; i >= 0; i--) if (quitar.has(works[i])) works.splice(i, 1);
      works.push({
        poly,
        area: Math.abs(area(polyL)),
        frente: Math.min(rect.w, rect.h),
        profundidad: Math.max(rect.w, rect.h),
        centro: centroid(poly),
        grid: { ...grupo[0].grid, index: 0 },
        uso: ped.uso,
        celda: rect,
      });
    } else {
      for (const g of grupo) g.uso = ped.uso;
    }
    const grafico = polyL.length >= 3 ? Math.abs(area(polyL)) : suma(grupo);
    const bajoPiso = ped.piso > 0 && grafico + 1 < ped.piso;
    const corto = grafico + 1 < requerido;
    return {
      concepto: ped.concepto,
      pct: ped.pct,
      requerido,
      grafico,
      minimo: ped.minimo,
      estado: bajoPiso
        ? "Grafiado por debajo de 400 m²"
        : corto
          ? "Grafiado por debajo del porcentaje exigido"
          : "Grafiado en el trazado",
    };
  });

  const manzanaClave = new Map<string, Work[]>();
  for (const w of works) {
    if (w.uso !== "vivienda") continue;
    const k = `${w.grid.band}:${w.grid.col}`;
    const arr = manzanaClave.get(k);
    if (arr) arr.push(w);
    else manzanaClave.set(k, [w]);
  }
  const manzanas = [...manzanaClave.entries()].map(([k, ls]) => {
    const cM = ls.reduce((s, l) => add(s, l.centro), { x: 0, y: 0 });
    return { k, ls, centro: mul(cM, 1 / ls.length) };
  });
  manzanas.sort((a, b) => b.centro.y - a.centro.y || a.centro.x - b.centro.x);
  const polilineas: Polilinea[] = [];
  const alMundo = (q: { x: number; y: number; bulge?: number }) => {
    const wpt = toWorld(q);
    return { x: wpt.x, y: wpt.y, bulge: q.bulge };
  };
  const contorno = new Map<string, Polilinea>();
  for (const band of bandas) {
    for (const col of cols) {
      const rect = extenderRect({ x: col.x, y: band.y, w: col.w, h: band.h }, bb, {
        o: col.i === 0,
        e: col.i === cols.length - 1,
        s: band.calleAbajo === null,
        n: band.calleArriba === null,
      });
      const clipped = clipRect(local, rect);
      if (clipped.length < 3) continue;
      const conOchavo = ochavarPoligono(
        clipped,
        esquinas.map((e) => ({ p: e.p, a: e.propA, b: e.propB })),
      );
      contorno.set(`${band.band}:${col.i}`, {
        capa: "MC-MANZANA",
        nombre: "",
        cerrada: true,
        pts: conOchavo.map((q) => {
          const w = toWorld(q);
          return { x: w.x, y: w.y };
        }),
      });
    }
  }
  for (const esq of esquinas) {
    const pl = polilineaSardinel(esq, "Sardinel");
    polilineas.push({ ...pl, pts: pl.pts.map(alMundo) });
    const a = toWorld(esq.propA);
    const b = toWorld(esq.propB);
    polilineas.push({
      capa: "MC-OCHAVO",
      nombre: `Ochavo ${esq.ochavo.toFixed(2)} m`,
      cerrada: false,
      pts: [
        { x: a.x, y: a.y },
        { x: b.x, y: b.y },
      ],
    });
  }
  const lotes: LoteM[] = [];
  manzanas.forEach((m, mi) => {
    const letra = letraManzana(mi);
    const bordeM = contorno.get(m.k);
    if (bordeM) polilineas.push({ ...bordeM, nombre: `Manzana ${letra}` });
    const orden = m.ls.slice().sort((a, b) => a.grid.index - b.grid.index || a.grid.side - b.grid.side);
    orden.forEach((w, i) => {
      lotes.push({
        id: `${letra}-${i + 1}`,
        manzana: letra,
        numero: i + 1,
        uso: "vivienda",
        poly: ochavarPoligono(
          w.poly,
          esquinas.map((e) => ({ p: toWorld(e.p), a: toWorld(e.propA), b: toWorld(e.propB) })),
        ),
        area: w.area,
        frente: w.frente,
        profundidad: w.profundidad,
        centro: w.centro,
      });
    });
  });
  for (const w of works) {
    if (w.uso === "vivienda") continue;
    lotes.push({
      id: w.uso === "residual" ? "AR" : w.uso,
      manzana: "",
      numero: 0,
      uso: w.uso,
      poly: w.poly,
      area: w.area,
      frente: w.frente,
      profundidad: w.profundidad,
      centro: w.centro,
    });
  }

  const franjas: Franja[] = [];
  const ejes: { nombre: string; partes: V2[][] }[] = [];
  let areaVias = 0;
  const emitir = (rect: Rect, tipo: Franja["tipo"]) => {
    const clipped = clipRect(local, rect);
    if (clipped.length < 3) return;
    franjas.push({ tipo, poly: clipped.map(toWorld) });
  };
  const segmentoEje = (a: V2, b: V2, nombre: string) => {
    const partesEje = clipSegment(a, b, local).map((seg) => seg.map(toWorld));
    if (!partesEje.length) return;
    const prev = ejes.find((e) => e.nombre === nombre);
    if (prev) prev.partes.push(...partesEje);
    else ejes.push({ nombre, partes: partesEje });
  };
  const recortarX = (col: (typeof cols)[number], calle: (typeof hCalles)[number], borde: "s" | "n", holgura: number) => {
    let x0 = col.x;
    let x1 = col.x + col.w;
    const vereda = borde === "s" ? calle.veredaInicio : calle.veredaFin;
    if (vereda > 0.05) {
      const izq = vCalles[col.i - 1];
      const der = vCalles[col.i];
      if (izq) x0 += retroceso(Math.max(calle.radio, izq.radio), izq.veredaFin) + holgura;
      if (der) x1 -= retroceso(Math.max(calle.radio, der.radio), der.veredaInicio) + holgura;
    }
    return { x: x0, w: x1 - x0 };
  };
  const recortarY = (band: (typeof bandas)[number], calle: (typeof vCalles)[number], holgura: number) => {
    let y0 = band.y;
    let y1 = band.y + band.h;
    if (band.calleAbajo !== null) {
      const abajo = hCalles[band.calleAbajo];
      y0 += retroceso(Math.max(calle.radio, abajo.radio), abajo.veredaFin) + holgura;
    }
    if (band.calleArriba !== null) {
      const arriba = hCalles[band.calleArriba];
      y1 -= retroceso(Math.max(calle.radio, arriba.radio), arriba.veredaInicio) + holgura;
    }
    return { y: y0, h: y1 - y0 };
  };

  for (const st of hCalles) {
    const row = clipRect(local, { x: bb.minX, y: st.pos, w: bb.w, h: st.span });
    areaVias += area(row);
    for (const fr of st.partes) {
      const alto = fr.b - fr.a;
      if (fr.tipo === "calzada" || fr.tipo === "separador") {
        emitir({ x: bb.minX, y: st.pos + fr.a, w: bb.w, h: alto }, fr.tipo);
      } else {
        const borde: "s" | "n" = fr.a < st.span / 2 ? "s" : "n";
        const holgura = fr.tipo === "vereda" ? -0.35 : fr.tipo === "estacionamiento" || fr.tipo === "jardin" ? 0.35 : 0.2;
        for (const col of cols) {
          const rec = recortarX(col, st, borde, holgura);
          if (rec.w > 0.15) emitir({ x: rec.x, y: st.pos + fr.a, w: rec.w, h: alto }, fr.tipo);
        }
      }
    }
    for (const fr of st.partes.filter((f) => f.tipo === "calzada")) {
      const yc = st.pos + (fr.a + fr.b) / 2;
      segmentoEje({ x: bb.minX, y: yc }, { x: bb.maxX, y: yc }, st.nombre);
    }
  }
  for (const st of vCalles) {
    for (const band of bandas) {
      const piece = clipRect(local, { x: st.pos, y: band.y, w: st.span, h: band.h });
      areaVias += area(piece);
    }
    for (const fr of st.partes) {
      const anchoFr = fr.b - fr.a;
      if (fr.tipo === "calzada" || fr.tipo === "separador") {
        emitir({ x: st.pos + fr.a, y: bb.minY, w: anchoFr, h: bb.h }, fr.tipo);
      } else {
        const holgura = fr.tipo === "vereda" ? -0.35 : fr.tipo === "estacionamiento" || fr.tipo === "jardin" ? 0.35 : 0.2;
        for (const band of bandas) {
          const rec = recortarY(band, st, holgura);
          if (rec.h > 0.15) emitir({ x: st.pos + fr.a, y: rec.y, w: anchoFr, h: rec.h }, fr.tipo);
        }
      }
    }
    for (const fr of st.partes.filter((f) => f.tipo === "calzada")) {
      const xc = st.pos + (fr.a + fr.b) / 2;
      segmentoEje({ x: xc, y: bb.minY }, { x: xc, y: bb.maxY }, st.nombre);
    }
  }
  for (const esq of esquinas) {
    if (esq.vereda.length >= 3) {
      const marco: V2[][] = [];
      const sardinel = esq.vereda.slice(1, -1).map(toWorld);
      for (let i = 0; i < sardinel.length - 1; i++) marco.push([sardinel[i], sardinel[i + 1]]);
      if (esq.vereda.length >= 2) marco.push([toWorld(esq.vereda[0]), toWorld(esq.vereda[esq.vereda.length - 1])]);
      franjas.push({ tipo: "vereda", poly: esq.vereda.map(toWorld), soloVista: true, lineas: marco });
    }
    if (esq.pista.length >= 3) {
      franjas.push({ tipo: "calzada", poly: esq.pista.map(toWorld), soloVista: true });
    }
  }
  const hitVia = (rect: Rect): V2[] => {
    const clipped = clipRect(local, rect);
    return (clipped.length >= 3 ? clipped : []).map(toWorld);
  };
  const viasInternas: ViaInterna[] = [
    ...hCalles.map((st) => ({
      id: st.id,
      nombre: st.nombre,
      orientacion: "h" as const,
      tipo: st.tipo,
      ancho: st.ancho,
      radio: st.radio,
      hit: hitVia({ x: bb.minX, y: st.pos, w: bb.w, h: st.span }),
    })),
    ...vCalles.map((st) => ({
      id: st.id,
      nombre: st.nombre,
      orientacion: "v" as const,
      tipo: st.tipo,
      ancho: st.ancho,
      radio: st.radio,
      hit: hitVia({ x: st.pos, y: bb.minY, w: st.span, h: bb.h }),
    })),
  ];

  const cortesOchavo = esquinas.map((e) => ({ p: toWorld(e.p), a: toWorld(e.propA), b: toWorld(e.propB) }));
  let areaOchavo = 0;
  for (const lote of lotes) {
    const antes = lote.area;
    const next = ochavarPoligono(lote.poly, cortesOchavo);
    if (next === lote.poly || next.length < 3) continue;
    lote.poly = next;
    lote.area = area(next);
    lote.centro = centroid(next);
    areaOchavo += Math.max(0, antes - lote.area);
  }
  areaVias += areaOchavo;
  for (const ap of aportes) {
    const uso = ap.concepto.startsWith("Recreación")
      ? "recreacion"
      : ap.concepto.startsWith("Educación")
        ? "educacion"
        : ap.concepto.startsWith("Otros")
          ? "otros"
          : "";
    if (!uso) continue;
    ap.grafico = lotes.filter((l) => l.uso === uso).reduce((s, l) => s + l.area, 0);
  }

  const areaLotes = lotes.filter((l) => l.uso === "vivienda").reduce((s, l) => s + l.area, 0);
  const areaAportes = lotes.filter((l) => l.uso !== "vivienda" && l.uso !== "residual").reduce((s, l) => s + l.area, 0);
  const areaResidual = lotes.filter((l) => l.uso === "residual").reduce((s, l) => s + l.area, 0);
  const sinAsignar = bruta - areaVias - areaLotes - areaAportes - areaResidual;

  const vendibles = lotes.filter((l) => l.uso === "vivienda");
  const largoDiseno = lenFit.length;

  checks.push(
    ver(
      "cierre",
      "GH.020 Art. 2 y 6",
      p.cierre === "abierta"
        ? "Habilitación abierta: las vías son de uso público y la trama continúa hacia las habilitaciones colindantes."
        : "Habilitación cercada: cerco sobre el lindero y vanos solo en los ingresos indicados. Las vías interiores se entregan según el régimen que apruebe la municipalidad.",
      "info",
      p.cierre === "abierta" ? "Abierta" : "Cercada",
    ),
  );
  checks.push(
    ver(
      "manzana",
      normaManzana(c),
      `Longitud de manzana de diseño ${largoDiseno.toFixed(2)} m. En residencial, entre intersecciones: mínimo 40 m y máximo 300 m, medidos en los extremos.`,
      largoDiseno <= tope + 0.05 && (largoDiseno + 0.05 >= 40 || bb.w < 40) ? "cumple" : "no-cumple",
      `${largoDiseno.toFixed(2)} m`,
    ),
  );
  if (c.tipoHab !== "industrial" && largoDiseno + 0.05 < 40 && bb.w + 0.05 < 40) {
    checks.push(ver("manzana-borde", "GH.020 Art. 15", "El frente del predio es menor de 40 m. No hay dos intersecciones internas que medir.", "observacion", `${bb.w.toFixed(1)} m`));
  }
  if (vendibles.length) {
    const deCuadro = vendibles.filter(
      (l) => (c.frenteMin <= 0 || l.frente + 0.05 >= c.frenteMin * 0.9) && (c.areaMin <= 0 || l.area + 0.5 >= c.areaMin * 0.9),
    );
    const muestra = deCuadro.length ? deCuadro : vendibles;
    const peorFrente = muestra.reduce((m, l) => Math.min(m, l.frente), Infinity);
    const peorArea = vendibles.reduce((m, l) => Math.min(m, l.area), Infinity);
    const bajo90 = peorArea + 0.5 < MIN_LOTE;
    const frenteOk = c.frenteMin <= 0 || peorFrente + 0.05 >= c.frenteMin;
    const areaOk = c.areaMin <= 0 || muestra.reduce((m, l) => Math.min(m, l.area), Infinity) + 0.5 >= c.areaMin;
    const deBorde = vendibles.length - deCuadro.length;
    checks.push(
      ver(
        "lotes",
        "TH.010 Art. 9",
        `Lotes de vivienda desde ${peorArea.toFixed(1)} m². El cuadro del tipo ${c.tipoDensidad} es ${c.frenteMin || "sin mínimo"} m de frente y ${c.areaMin || "sin mínimo"} m²; la municipalidad provincial puede fijar el lote normativo. En el lindero se acepta el triángulo, con ${MIN_LOTE} m² como único mínimo.${deBorde > 0 ? ` ${deBorde} lote${deBorde === 1 ? "" : "s"} de borde quedan por debajo del cuadro y siguen como vivienda.` : ""}`,
        bajo90 ? "no-cumple" : frenteOk && areaOk ? "cumple" : "observacion",
        `${vendibles.length} lotes · ${manzanas.length} manzanas`,
      ),
    );
  } else {
    checks.push(ver("lotes", "TH.010 Art. 9", "No resultaron lotes vendibles con el frente y el área exigidos.", "no-cumple", "0 lotes"));
  }
  for (const ap of aportes) {
    const corto = ap.estado.includes("debajo");
    const malo = ap.estado.startsWith("No se ubicó");
    const redime = ap.estado.startsWith("Redención");
    const estado: Estado = malo ? "no-cumple" : redime || corto ? "observacion" : ap.requerido < 1 ? "info" : "cumple";
    checks.push(
      ver(
        `aporte-${ap.concepto}`,
        "GH.020 Art. 27 · TH.010 Art. 10",
        `${ap.concepto}: ${ap.pct}% del área base (${baseAporte.toFixed(0)} m²) = ${ap.requerido.toFixed(0)} m². Mínimo ${ap.minimo > 0 ? ap.minimo.toFixed(0) + " m²" : "—"}. ${ap.estado}.`,
        estado,
        ap.grafico > 0 ? `${ap.grafico.toFixed(0)} m² en plano` : ap.estado,
      ),
    );
  }
  if (agudos.n) {
    checks.push(
      ver(
        "art31",
        "GH.020 Art. 31",
        `Se descuentan del área de aportes los ángulos interiores menores de 45°, hasta 25 m sobre la bisectriz.`,
        "info",
        `${agudos.n} ángulos · ${agudos.area.toFixed(0)} m²`,
      ),
    );
  }
  const rec = aportes.find((a) => a.concepto.startsWith("Recreación"));
  const parques = lotes.filter((l) => l.uso === "recreacion");
  if (parques.length && vendibles.length) {
    let peor = 0;
    for (const lot of vendibles) {
      const d = Math.min(...parques.map((pk) => distPuntoPoligono(lot.centro, pk.poly)));
      if (d > peor) peor = d;
    }
    checks.push(
      ver(
        "dist-parque",
        "GH.020 Art. 28",
        "Ningún lote debe quedar a más de 300 m del área de recreación pública.",
        peor <= 300 ? "cumple" : "no-cumple",
        `Máximo ${peor.toFixed(0)} m`,
      ),
    );
  }
  if (rec && rec.grafico > 0) {
    checks.push(ver("ancho-parque", "GH.020 Art. 29", "El aporte de recreación se armó con ancho mínimo de 25 m, sin incluir la vereda de la sección vial.", rec.estado.startsWith("Grafiado") ? "cumple" : "observacion", "25 m"));
  }
  if (bruta > 100_000 && rec && rec.requerido >= 800) {
    checks.push(ver("concentrado", "GH.020 Art. 30", "Predio mayor de 10 ha: al menos el 30% de la recreación queda en un solo paño.", rec.grafico > 0 ? "cumple" : "observacion", rec.grafico > 0 ? "Un solo paño" : "Sin paño"));
  }
  const secEstado = evaluarSeccion(c, W);
  checks.push(secEstado);
  if (c.tipoHab === "industrial" && W + 0.01 < 16.8) {
    checks.push(ver("via-ind", "TH.030 Art. 13", "La vía local secundaria industrial tiene un ancho mínimo de 16.80 m.", "no-cumple", `${W.toFixed(2)} m`));
  }
  const exigida = calidadExigida(c);
  if (exigida) {
    checks.push(
      ver(
        "calidad",
        "TH.010 Art. 13",
        `Calidad mínima de obras exigida: tipo ${exigida}. Indicada: tipo ${c.calidad}.`,
        calidadAlcanza(c.calidad, exigida) ? "cumple" : "no-cumple",
        `Tipo ${c.calidad}`,
      ),
    );
  } else {
    checks.push(ver("calidad", "TH.010 Art. 11", `Calidad de obras indicada para el expediente: tipo ${c.calidad}.`, "info", `Tipo ${c.calidad}`));
  }
  if (c.tipoVia === "acceso-exclusivo") {
    const largoVia = Math.max(0, ...ejes.filter((e) => e.nombre.startsWith("Calle")).map((e) => e.partes.reduce((s, seg) => s + dist(seg[0], seg[1]), 0)));
    const topeVia = c.accesoUnico ? 50 : 100;
    checks.push(
      ver(
        "acceso-ex",
        "GH.020 Art. 11 y 13",
        c.accesoUnico
          ? "Acceso único: la vía no pasa de 50 m. Desde ahí hacen falta dos extremos, y en ningún caso más de 100 m. El extremo interior lleva plazoleta de volteo de 12 m."
          : "Vía de acceso exclusivo: longitud máxima 100 m y sección de circulación mínima 7.20 m.",
        largoVia <= topeVia + 0.5 ? "cumple" : "no-cumple",
        `${largoVia.toFixed(1)} m`,
      ),
    );
  }
  if (p.cierre === "abierta" && !p.vias.length) {
    checks.push(ver("vias-pre", "GH.020 Art. 5", "Habilitación abierta sin vías preexistentes cargadas. Si el predio empalma una sección existente, identifique PIA, PEA, eje, PEA' y PIA'.", "observacion", "Sin vías"));
  }
  for (const v of p.vias) {
    const g = viasExistentes.find((x) => x.nombre === v.nombre);
    checks.push(
      ver(
        `via-${v.id}`,
        "GH.020 Art. 5",
        g?.completa
          ? `${v.nombre}: sección identificada de acera a acera.${g.ordenada ? "" : " Los puntos no avanzan en un solo sentido; revise el orden."}`
          : `${v.nombre}: faltan puntos de la sección. Se requieren los cinco: PIA, PEA, eje, PEA' y PIA'.`,
        g?.completa && g.ordenada ? "cumple" : "observacion",
        g?.anchos.length ? g.anchos.map((a) => `${a.etiqueta} ${a.metros.toFixed(2)} m`).join(" · ") : "Incompleta",
      ),
    );
  }
  if (p.sinIngreso) {
    checks.push(ver("ingreso", "Acceso", "Sin pórtico de ingreso. El acceso queda definido solo por la continuidad de las vías.", "info", "Sin pórtico"));
  } else if (!ingresos.length) {
    checks.push(ver("ingreso", "Acceso", "No hay ingreso proyectado. Indique la arista y la distancia desde el vértice, o marque que no lleva pórtico.", "observacion", "Pendiente"));
  } else {
    checks.push(
      ver(
        "ingreso",
        "Acceso",
        `Ingresos sobre el lindero: ${ingresos.map((g) => `${g.nombre} a ${g.distancia.toFixed(2)} m del vértice, ancho ${g.ancho.toFixed(2)} m`).join("; ")}.`,
        "cumple",
        `${ingresos.length} ingreso${ingresos.length === 1 ? "" : "s"}`,
      ),
    );
  }
  if (Math.abs(sinAsignar) > Math.max(25, bruta * 0.025)) {
    checks.push(ver("balance", "Áreas", "La suma de vías, lotes, aportes y residual no cierra con el área bruta. Revise vértices repetidos o una sección demasiado ancha.", "observacion", `${sinAsignar.toFixed(0)} m² sin asignar`));
  } else {
    checks.push(ver("balance", "Áreas", "El área bruta cierra con vías, lotes, aportes y residual.", "cumple", `${sinAsignar.toFixed(1)} m² de diferencia`));
  }
  if (c.tipoHab === "club") {
    const libre = 1 - areaLotes / bruta;
    checks.push(
      ver(
        "club",
        "TH.010 Art. 24 a 31",
        "Vivienda tipo club: área bruta mínima 1 ha, máximo 25 viviendas por hectárea y área libre de uso común no menor del 60%. No se exige recreación pública; sí 1% educación y 1% otros fines.",
        bruta >= 10_000 && areaLotes / bruta <= 0.42 ? "cumple" : "observacion",
        `Libre ${(libre * 100).toFixed(0)}% · ${(vendibles.length / (bruta / 10000)).toFixed(1)} viv/ha`,
      ),
    );
  }
  if (anguloVia !== null) {
    checks.push(
      ver(
        "rumbo",
        "GH.020 Art. 5",
        ejeAplicado
          ? "La trama tomó el rumbo de la vía preexistente y una calzada interna pasó por su eje."
          : "La trama tomó el rumbo de la vía preexistente.",
        "info",
        `Azimut ${azimut.toFixed(2)}°`,
      ),
    );
  }
  for (const aviso of trama.avisos) {
    checks.push(ver(`ancho-${aviso.slice(0, 24)}`, "GH.020 Art. 8", aviso, "observacion", "Ancho limitado"));
  }
  const radiosUsados = [...new Set(viasInternas.map((v) => v.radio))].sort((a, b) => a - b);
  checks.push(
    ver(
      "radios",
      "GH.020",
      esquinas.length
        ? `Martillo del sardinel: ${radiosUsados.map((r) => r.toFixed(2)).join(" m y ")} m. La curva es vereda: el estacionamiento o el jardín se cortan en la tangente y no entran al retorno. En cada cruce manda el mayor radio: 3.00 m en local secundaria o acceso exclusivo, y 5.00 m en local principal. Ochavo recto de 3.00 m sobre cada frente.`
        : `Sin cruces internos. El radio exigible de la acera sigue siendo ${radioEsquina(c.tipoVia).toFixed(2)} m al sardinel.`,
      esquinas.length ? "cumple" : "info",
      esquinas.length ? `${esquinas.length} curvas` : `Radio ${radioEsquina(c.tipoVia).toFixed(2)} m`,
    ),
  );
  const conJardin = [...hCalles, ...vCalles].filter((st) => st.lateral === "jardin");
  if (conJardin.length) {
    checks.push(
      ver(
        "jardin-via",
        "GH.020 Art. 9",
        `Berma jardín en lugar del módulo de estacionamiento: ${conJardin.map((v) => `${v.nombre} ${v.seccion.estacionamiento.toFixed(2)} m`).join(", ")}. El ancho no baja de 1.00 m y el martillo del cruce permanece en la vereda.`,
        "observacion",
        `${conJardin.length} vía(s)`,
      ),
    );
  }
  checks.push(
    ver(
      "nomenclatura",
      "GH.020 Art. 51 y 52",
      "Manzanas con letras y lotes con números, correlativos. Las calles y jirones llevan nomenclatura provisional hasta el pronunciamiento municipal.",
      "info",
      `${manzanas.length} manzanas`,
    ),
  );

  const ornato = disenarParques(
    lotes.filter((l) => l.uso === "recreacion" || l.uso === "parque-zonal").map((l) => l.poly),
    p.parques ?? [],
    p.trazaVias ?? "recta",
  );
  ornato.forEach((pk, i) => {
    checks.push(ver(`parque-${i + 1}`, "GH.020 Art. 29 y 56.e", `${pk.nombre}. ${pk.nota}`, "info", pk.categoria === "activa" ? "Recreación activa" : "Recreación pasiva"));
  });

  const hayFallo = checks.some((v) => v.estado === "no-cumple");
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const cortes: CorteVia[] = [...hCalles, ...vCalles].map((st, i) => {
    const letra = letras[i] ?? String(i + 1);
    const fuera = 8;
    const medioCol = cols[Math.floor(cols.length / 2)];
    const medioBan = bandas[Math.floor(bandas.length / 2)];
    if (st.orientacion === "h") {
      const x = medioCol ? medioCol.x + medioCol.w / 2 : bb.minX + bb.w / 2;
      const yc = st.pos + st.span / 2;
      return {
        letra,
        titulo: `${letra}-${letra}`,
        via: st.nombre,
        orientacion: "h" as const,
        seccion: st.seccion,
        lateral: st.lateral,
        a: toWorld({ x, y: st.pos - fuera }),
        b: toWorld({ x, y: st.pos + st.span + fuera }),
        eje0: toWorld({ x: bb.minX + 6, y: yc }),
        eje1: toWorld({ x: bb.maxX - 6, y: yc }),
      };
    }
    const y = medioBan ? medioBan.y + medioBan.h / 2 : bb.minY + bb.h / 2;
    const xc = st.pos + st.span / 2;
    return {
      letra,
      titulo: `${letra}-${letra}`,
      via: st.nombre,
      orientacion: "v" as const,
      seccion: st.seccion,
      lateral: st.lateral,
      a: toWorld({ x: st.pos - fuera, y }),
      b: toWorld({ x: st.pos + st.span + fuera, y }),
      eje0: toWorld({ x: xc, y: bb.minY + 6 }),
      eje1: toWorld({ x: xc, y: bb.maxY - 6 }),
    };
  });
  return {
    ok: !hayFallo || vendibles.length > 0,
    motivo: hayFallo ? "Hay verificaciones que no cumplen. Puede confirmarlas solo si acepta las observaciones en el expediente." : "Estructura conforme al cuadro aplicado.",
    areaBruta: bruta,
    perimetro: peri,
    areaVias,
    areaLotes,
    areaAportes,
    areaResidual,
    areaBaseAporte: baseAporte,
    areaDescartadaArt31: agudos.area,
    angulosAgudos: agudos.n,
    sinAsignar,
    aportes,
    lotes,
    parques: ornato,
    franjas,
    ejes,
    lindero: world,
    cerco,
    viasExistentes,
    ingresos,
    verificaciones: checks,
    seccionPartes: partes,
    seccionTotal: W,
    viasInternas,
    polilineas,
    largoManzana: largoDiseno,
    profundidad: D,
    nManzanas: manzanas.length,
    rumboGrados: azimut,
    cortes,
    pavimento: { ...pavimentoVacio(), ...(p.pavimento ?? {}) },
  };
}

function normaManzana(c: Criterios): string {
  return c.tipoHab === "industrial" ? "TH.030 Art. 13" : "GH.020 Art. 15";
}

function fmtHa(m2: number): string {
  return `${m2.toFixed(0)} m²`;
}

function evaluarSeccion(c: Criterios, W: number): Verificacion {
  const s = c.seccion;
  const fallos: string[] = [];
  if (c.tipoVia === "acceso-exclusivo") {
    if (W + 0.02 < 7.2) fallos.push("sección de circulación menor de 7.20 m");
  } else if (c.tipoVia === "local-principal") {
    if (s.nVeredas < 2 || s.vereda + 0.01 < 1.8) fallos.push("vereda mínima 1.80 m a cada lado");
    if (s.nEstacionamientos < 2 || s.estacionamiento + 0.01 < 2.4) fallos.push("estacionamiento a cada frente (Art. 9)");
    if (s.moduloCalzada + 0.01 < 2.7) fallos.push("módulo de calzada menor de 2.70 m");
  } else {
    if (s.nVeredas < 2 || s.vereda + 0.01 < 1.2) fallos.push("dos módulos de vereda (1.20 m) por frente");
    if (s.nEstacionamientos < 1 || (s.nEstacionamientos > 0 && s.estacionamiento + 0.01 < 2.4)) fallos.push("al menos un módulo de estacionamiento de 2.40 m");
    if (s.moduloCalzada + 0.01 < 2.7) fallos.push("dos módulos de calzada, mínimo 2.70 m");
  }
  const norma = c.tipoVia === "local-principal" ? "GH.020 Art. 8 y 9" : c.tipoVia === "acceso-exclusivo" ? "GH.020 Art. 11" : "GH.020 Art. 8 y 10";
  return ver(
    "seccion",
    norma,
    fallos.length ? `La sección no alcanza el mínimo: ${fallos.join("; ")}.` : `Sección ${W.toFixed(2)} m, dentro de los módulos del artículo 8.`,
    fallos.length ? "no-cumple" : "cumple",
    `${W.toFixed(2)} m`,
  );
}

function ingresosDe(p: ProyectoLot, poly: V2[], centro: V2): IngresoGraf[] {
  if (p.sinIngreso) return [];
  const out: IngresoGraf[] = [];
  p.ingresos.forEach((ing, i) => {
    const hit = pointAlong(poly, ing.arista, ing.distancia);
    if (!hit) return;
    const a = poly[ing.arista];
    const b = poly[(ing.arista + 1) % poly.length];
    const dir = norm(sub(b, a));
    let hacia = { x: -dir.y, y: dir.x };
    if (dot(hacia, sub(centro, hit.pt)) < 0) hacia = mul(hacia, -1);
    out.push({
      id: ing.id,
      nombre: ing.nombre || `Ingreso ${i + 1}`,
      pt: hit.pt,
      hacia,
      ancho: Math.max(3, ing.ancho || 8),
      arista: ing.arista,
      distancia: Math.max(0, Math.min(hit.len, ing.distancia)),
    });
  });
  return out;
}

export function referenciaDensidad(c: Criterios): string {
  if (c.tipoHab === "vivienda" || c.tipoHab === "vivienda-taller") {
    const f = filaVivienda(c.tipoHab === "vivienda-taller" ? 3 : c.tipoDensidad);
    return `${etiquetaHab(c.tipoHab)} · tipo ${c.tipoHab === "vivienda-taller" ? 3 : c.tipoDensidad} · ${f.nota}`;
  }
  return etiquetaHab(c.tipoHab);
}
