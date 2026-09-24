/**
 * Motor de aceras, ochavo y martillo de esquina.
 * Lo usan `proponer` y la previsualización. Los radios no se recalculan en otro archivo.
 *
 * Martillo (curva del sardinel en el cruce): radio mínimo 5.00 m en vía local
 * principal y 3.00 m en local secundaria o acceso exclusivo. En el cruce manda el mayor.
 * Ochavo: corte recto de la esquina de la manzana, 3.00 m sobre cada frente, o más
 * si el radio del sardinel menos la vereda lo exige para no angostar la acera.
 */
import type { Caja, V2 } from "./geom";
import { dist } from "./geom";
import { partesDeSeccion, radioEsquina } from "./norma";
import type { AjusteVia, Franja, LateralVia, Polilinea, PuntoPl, Seccion, TipoVia } from "./tipos";

const PASOS_ARCO = 16;
/** Longitud mínima del ochavo sobre cada frente de la manzana, en metros. */
export const OCHAVO_MIN = 3;

export type ParteVia = { tipo: Franja["tipo"]; a: number; b: number };

export type CallePuesta = {
  id: string;
  nombre: string;
  orientacion: "h" | "v";
  tipo: TipoVia;
  seccion: Seccion;
  ancho: number;
  radio: number;
  pos: number;
  span: number;
  veredaInicio: number;
  veredaFin: number;
  lateral: LateralVia;
  partes: ParteVia[];
};

export type BandaPuesta = {
  kind: "perim" | "doble";
  y: number;
  h: number;
  face: "n" | "s";
  band: number;
  calleAbajo: number | null;
  calleArriba: number | null;
};

export type ColPuesta = { x: number; w: number; i: number };

export type Esquina = {
  p: V2;
  sx: 1 | -1;
  sy: 1 | -1;
  wH: number;
  wV: number;
  R: number;
  Rp: number;
  /** Longitud del ochavo sobre cada frente, m. */
  ochavo: number;
  propA: V2;
  propB: V2;
  propBulge: number;
  sardA: V2;
  sardB: V2;
  sardBulge: number;
  muestraProp: V2[];
  muestraSard: V2[];
  vereda: V2[];
  /** Cuña de pista entre el sardinel y la calzada rectangular. */
  pista: V2[];
  /** Dos losetas, una por acceso, entre el sardinel y el estacionamiento o el jardín. */
  rampas: V2[][];
  pendientes: V2[][];
};

function bordes(sec: Seccion, lateral: LateralVia): { inicio: number; fin: number; partes: ParteVia[] } {
  const partesSrc = partesDeSeccion(sec);
  const partes: ParteVia[] = [];
  let cursor = 0;
  for (const parte of partesSrc) {
    const tipo = lateral === "jardin" && parte.tipo === "estacionamiento" ? "jardin" : parte.tipo;
    partes.push({ tipo, a: cursor, b: cursor + parte.ancho });
    cursor += parte.ancho;
  }
  const inicio = partes[0]?.tipo === "vereda" ? partes[0].b - partes[0].a : 0;
  const fin = partes.length && partes[partes.length - 1].tipo === "vereda" ? partes[partes.length - 1].b - partes[partes.length - 1].a : 0;
  return { inicio, fin, partes };
}

function resolver(id: string, baseTipo: TipoVia, base: Seccion, ajustes: AjusteVia[]) {
  const aj = ajustes.find((a) => a.id === id);
  const tipo = aj?.tipo ?? baseTipo;
  const lateral: LateralVia = tipo === "local-principal" ? "estacionamiento" : (aj?.lateral ?? "estacionamiento");
  const jardin = Math.max(1, aj?.jardin ?? 1.2);
  const pedido = aj?.seccion ?? base;
  const seccion: Seccion =
    lateral === "jardin" ? { ...pedido, estacionamiento: jardin, nEstacionamientos: 2 } : pedido;
  const b = bordes(seccion, lateral);
  return {
    tipo,
    seccion,
    lateral,
    ancho: b.partes.reduce((s, p) => s + (p.b - p.a), 0),
    radio: radioEsquina(tipo),
    veredaInicio: b.inicio,
    veredaFin: b.fin,
    partes: b.partes,
  };
}

function repartir(tramos: number[], deseados: number[], baseW: number, minTramo: number) {
  const sizes = tramos.slice();
  const anchos = deseados.slice();
  const avisos: string[] = [];
  for (let i = 0; i < anchos.length; i++) {
    const delta = anchos[i] - baseW;
    if (Math.abs(delta) < 0.001) continue;
    if (delta < 0) {
      sizes[i] += -delta / 2;
      sizes[i + 1] += -delta / 2;
      continue;
    }
    let left = delta;
    const take = (idx: number, want: number) => {
      const room = Math.max(0, sizes[idx] - minTramo);
      const got = Math.min(want, room);
      sizes[idx] -= got;
      return got;
    };
    const a = take(i, left / 2);
    const b = take(i + 1, left - a);
    const c = take(i, left - a - b);
    const taken = a + b + c;
    if (taken + 0.02 < delta) {
      anchos[i] = baseW + taken;
      avisos.push(
        `Una vía pidió ${ (baseW + delta).toFixed(2) } m y quedó en ${anchos[i].toFixed(2)} m para no dejar la manzana bajo ${minTramo.toFixed(0)} m.`,
      );
    }
  }
  return { sizes, anchos, avisos };
}

export function tramaDe(opts: {
  bb: Caja;
  baseW: number;
  baseTipo: TipoVia;
  baseSeccion: Seccion;
  nCallesH: number;
  nManzanasX: number;
  largo: number;
  D: number;
  Ds: number;
  ajustes: AjusteVia[];
  minTramo: number;
}): { bandas: BandaPuesta[]; cols: ColPuesta[]; hCalles: CallePuesta[]; vCalles: CallePuesta[]; avisos: string[] } {
  const nH = Math.max(1, opts.nCallesH);
  const nX = Math.max(1, opts.nManzanasX);
  const hRes = Array.from({ length: nH }, (_, k) => resolver(`h:${k}`, opts.baseTipo, opts.baseSeccion, opts.ajustes));
  const nV = Math.max(0, nX - 1);
  const vRes = Array.from({ length: nV }, (_, k) => resolver(`v:${k}`, opts.baseTipo, opts.baseSeccion, opts.ajustes));

  const mid = nH > 1 ? Array.from({ length: nH - 1 }, () => 2 * opts.D) : [];
  const lotH = opts.bb.h - nH * opts.baseW;
  const lastH = Math.max(0.2, lotH - opts.Ds - mid.reduce((s, n) => s + n, 0));
  const repH = repartir([opts.Ds, ...mid, lastH], hRes.map((r) => r.ancho), opts.baseW, opts.minTramo);

  const bandas: BandaPuesta[] = [];
  const hCalles: CallePuesta[] = [];
  let y = opts.bb.minY;
  let bandId = 0;
  for (let i = 0; i < repH.sizes.length; i++) {
    const h = Math.max(0.2, repH.sizes[i]);
    const face: "n" | "s" = i === 0 ? "n" : "s";
    const kind: BandaPuesta["kind"] = i === 0 || i === repH.sizes.length - 1 ? "perim" : "doble";
    bandas.push({
      kind,
      y,
      h,
      face: i === repH.sizes.length - 1 ? "s" : face,
      band: bandId++,
      calleAbajo: i > 0 ? i - 1 : null,
      calleArriba: i < nH ? i : null,
    });
    y += h;
    if (i < nH) {
      const r = hRes[i];
      const span = repH.anchos[i];
      hCalles.push({
        id: `h:${i}`,
        nombre: `Calle ${String(i + 1).padStart(2, "0")}`,
        orientacion: "h",
        ...r,
        ancho: span,
        pos: y,
        span,
        partes: bordes(r.seccion, r.lateral).partes.map((p) => ({
          ...p,
          a: (p.a / Math.max(r.ancho, 0.01)) * span,
          b: (p.b / Math.max(r.ancho, 0.01)) * span,
        })),
      });
      const escala = span / Math.max(r.ancho, 0.01);
      hCalles[hCalles.length - 1].veredaInicio = r.veredaInicio * escala;
      hCalles[hCalles.length - 1].veredaFin = r.veredaFin * escala;
      y += span;
    }
  }

  const anchosCol: number[] = [];
  for (let i = 0; i < nX; i++) {
    if (i < nX - 1) anchosCol.push(opts.largo);
    else {
      const usados = (nX - 1) * opts.largo + nV * opts.baseW;
      anchosCol.push(Math.max(0.2, opts.bb.w - usados));
    }
  }
  const repV = repartir(anchosCol, vRes.map((r) => r.ancho), opts.baseW, Math.max(opts.minTramo, 12));
  const cols: ColPuesta[] = [];
  const vCalles: CallePuesta[] = [];
  let x = opts.bb.minX;
  for (let i = 0; i < repV.sizes.length; i++) {
    const w = Math.max(0.2, repV.sizes[i]);
    cols.push({ x, w, i });
    x += w;
    if (i < nV) {
      const r = vRes[i];
      const span = repV.anchos[i];
      const escala = span / Math.max(r.ancho, 0.01);
      vCalles.push({
        id: `v:${i}`,
        nombre: `Jirón ${String(i + 1).padStart(2, "0")}`,
        orientacion: "v",
        ...r,
        ancho: span,
        pos: x,
        span,
        veredaInicio: r.veredaInicio * escala,
        veredaFin: r.veredaFin * escala,
        partes: bordes(r.seccion, r.lateral).partes.map((p) => ({
          tipo: p.tipo,
          a: p.a * escala,
          b: p.b * escala,
        })),
      });
      x += span;
    }
  }
  return { bandas, cols, hCalles, vCalles, avisos: [...repH.avisos, ...repV.avisos] };
}

function barrido(a0: number, a1: number): number {
  let d = a1 - a0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) > Math.PI * 0.75) d -= Math.sign(d) * Math.PI * 2;
  return d;
}

function arco(c: V2, a: V2, b: V2, r: number): { pts: V2[]; bulge: number } {
  const a0 = Math.atan2(a.y - c.y, a.x - c.x);
  const a1 = Math.atan2(b.y - c.y, b.x - c.x);
  const d = barrido(a0, a1);
  const pts: V2[] = [];
  for (let i = 0; i <= PASOS_ARCO; i++) {
    const t = a0 + d * (i / PASOS_ARCO);
    pts.push({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) });
  }
  return { pts, bulge: Math.tan(d / 4) };
}

export function hacerEsquina(p: V2, sx: 1 | -1, sy: 1 | -1, wH: number, wV: number, R: number, vH = 1.2, vV = 1.2): Esquina | null {
  if (wH < 0.15 || wV < 0.15 || R < 0.5) return null;
  const L = Math.max(OCHAVO_MIN, R - Math.min(wH, wV));
  const propA = { x: p.x - sx * L, y: p.y };
  const propB = { x: p.x, y: p.y - sy * L };
  const cSard = { x: p.x + sx * (wV - R), y: p.y + sy * (wH - R) };
  const sardA = { x: p.x + sx * (wV - R), y: p.y + sy * wH };
  const sardB = { x: p.x + sx * wV, y: p.y + sy * (wH - R) };
  const primero = arco(cSard, sardA, sardB, R);
  const cruzA = { x: propA.x, y: p.y + sy * wH };
  const cruzB = { x: p.x + sx * wV, y: propB.y };
  const vereda: V2[] = [];
  const meter = (q: V2) => {
    if (!vereda.length || dist(vereda[vereda.length - 1], q) > 0.02) vereda.push(q);
  };
  meter(propA);
  meter(cruzA);
  for (const q of primero.pts) meter(q);
  meter(cruzB);
  meter(propB);
  const largo = 1.2;
  const parkH = Math.max(0.9, wH - vH);
  const parkV = Math.max(0.9, wV - vV);
  const loseta = (a: V2, b: V2, c: V2, d: V2): V2[] => [a, b, c, d];
  const padA = loseta(
    { x: p.x - sx * L, y: p.y + sy * vH },
    { x: p.x - sx * (L + largo), y: p.y + sy * vH },
    { x: p.x - sx * (L + largo), y: p.y + sy * (vH + parkH) },
    { x: p.x - sx * L, y: p.y + sy * (vH + parkH) },
  );
  const padB = loseta(
    { x: p.x + sx * vV, y: p.y - sy * L },
    { x: p.x + sx * (vV + parkV), y: p.y - sy * L },
    { x: p.x + sx * (vV + parkV), y: p.y - sy * (L + largo) },
    { x: p.x + sx * vV, y: p.y - sy * (L + largo) },
  );
  const surcos = (pad: V2[]): V2[][] => {
    const out: V2[][] = [];
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const a = { x: pad[0].x + (pad[1].x - pad[0].x) * t, y: pad[0].y + (pad[1].y - pad[0].y) * t };
      const b = { x: pad[3].x + (pad[2].x - pad[3].x) * t, y: pad[3].y + (pad[2].y - pad[3].y) * t };
      out.push([a, { x: a.x + (b.x - a.x) * 0.82, y: a.y + (b.y - a.y) * 0.82 }]);
    }
    return out;
  };
  const pendientes = [...surcos(padA), ...surcos(padB)];
  const esquinaPista = { x: p.x + sx * wV, y: p.y + sy * wH };
  const pista: V2[] = [];
  const meterPista = (q: V2) => {
    if (!pista.length || dist(pista[pista.length - 1], q) > 0.02) pista.push(q);
  };
  for (const q of primero.pts) meterPista(q);
  meterPista(esquinaPista);
  return {
    p, sx, sy, wH, wV, R,
    Rp: Math.max(0, R - Math.max(wH, wV)),
    ochavo: L,
    propA, propB, propBulge: 0,
    sardA: primero.pts[0], sardB: primero.pts[primero.pts.length - 1], sardBulge: primero.bulge,
    muestraProp: [propA, propB],
    muestraSard: primero.pts,
    vereda,
    pista,
    rampas: [padA, padB],
    pendientes,
  };
}

/** Sustituye el vértice de esquina por el corte recto del ochavo, si cae sobre los dos frentes. */
export function ochavarPoligono(poly: V2[], cortes: { p: V2; a: V2; b: V2 }[]): V2[] {
  if (poly.length < 3 || !cortes.length) return poly;
  const enLado = (v: V2, extremo: V2, q: V2) => {
    const lado = dist(extremo, v);
    if (lado < dist(v, q) + 0.2) return false;
    return Math.abs(dist(extremo, q) + dist(q, v) - lado) < 0.4;
  };
  const out: V2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const v = poly[i];
    const esq = cortes.find((e) => dist(e.p, v) < 0.55);
    if (!esq) {
      empujar(out, v);
      continue;
    }
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const next = poly[(i + 1) % poly.length];
    if (!enLado(v, prev, esq.a) && !enLado(v, next, esq.a)) {
      empujar(out, v);
      continue;
    }
    if (!enLado(v, prev, esq.b) && !enLado(v, next, esq.b)) {
      empujar(out, v);
      continue;
    }
    const directo = dist(prev, esq.a) + dist(next, esq.b);
    const seq = directo <= dist(prev, esq.b) + dist(next, esq.a) ? [esq.a, esq.b] : [esq.b, esq.a];
    for (const q of seq) empujar(out, q);
  }
  return out.length >= 3 ? out : poly;
}

function hastaCalzada(partes: ParteVia[], lado: "inicio" | "fin"): number {
  const calzada = lado === "inicio" ? partes.find((p) => p.tipo === "calzada") : [...partes].reverse().find((p) => p.tipo === "calzada");
  if (!calzada) return lado === "inicio" ? (partes[0]?.b ?? 0) : 0;
  const fin = partes[partes.length - 1]?.b ?? 0;
  return lado === "inicio" ? calzada.a : fin - calzada.b;
}

export function esquinasDe(hCalles: CallePuesta[], vCalles: CallePuesta[]): Esquina[] {
  const out: Esquina[] = [];
  for (const hc of hCalles) {
    for (const vc of vCalles) {
      const R = Math.max(hc.radio, vc.radio);
      const h0 = hastaCalzada(hc.partes, "inicio");
      const h1 = hastaCalzada(hc.partes, "fin");
      const v0 = hastaCalzada(vc.partes, "inicio");
      const v1 = hastaCalzada(vc.partes, "fin");
      const seeds = [
        { x: vc.pos, y: hc.pos, sx: 1 as const, sy: 1 as const, wV: v0, wH: h0, vV: vc.veredaInicio, vH: hc.veredaInicio },
        { x: vc.pos + vc.span, y: hc.pos, sx: -1 as const, sy: 1 as const, wV: v1, wH: h0, vV: vc.veredaFin, vH: hc.veredaInicio },
        { x: vc.pos, y: hc.pos + hc.span, sx: 1 as const, sy: -1 as const, wV: v0, wH: h1, vV: vc.veredaInicio, vH: hc.veredaFin },
        { x: vc.pos + vc.span, y: hc.pos + hc.span, sx: -1 as const, sy: -1 as const, wV: v1, wH: h1, vV: vc.veredaFin, vH: hc.veredaFin },
      ];
      for (const s of seeds) {
        const e = hacerEsquina({ x: s.x, y: s.y }, s.sx, s.sy, s.wH, s.wV, R, s.vH, s.vV);
        if (e) out.push(e);
      }
    }
  }
  return out;
}

function empujar(out: V2[], p: V2) {
  if (!out.length || dist(out[out.length - 1], p) > 0.015) out.push(p);
}

export function redondearLote(poly: V2[], esquinas: Esquina[]): V2[] {
  if (poly.length < 3 || !esquinas.length) return poly;
  const out: V2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const v = poly[i];
    const esq = esquinas.find((e) => dist(e.p, v) < 0.12);
    if (!esq) {
      empujar(out, v);
      continue;
    }
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const next = poly[(i + 1) % poly.length];
    const directo = dist(prev, esq.propA) + dist(next, esq.propB);
    const inverso = dist(prev, esq.propB) + dist(next, esq.propA);
    const seq = directo <= inverso ? esq.muestraProp : esq.muestraProp.slice().reverse();
    for (const p of seq) empujar(out, p);
  }
  return out.length >= 3 ? out : poly;
}

export function polilineaManzana(poly: V2[], esquinas: Esquina[], nombre: string): Polilinea | null {
  if (poly.length < 3) return null;
  const pts: PuntoPl[] = [];
  let curva = false;
  for (let i = 0; i < poly.length; i++) {
    const v = poly[i];
    const esq = esquinas.find((e) => dist(e.p, v) < 0.12);
    if (!esq) {
      pts.push({ x: v.x, y: v.y });
      continue;
    }
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const next = poly[(i + 1) % poly.length];
    const directo = dist(prev, esq.propA) + dist(next, esq.propB);
    const a = directo <= dist(prev, esq.propB) + dist(next, esq.propA) ? esq.propA : esq.propB;
    const b = a === esq.propA ? esq.propB : esq.propA;
    const bulge = a === esq.propA ? esq.propBulge : -esq.propBulge;
    pts.push({ x: a.x, y: a.y, bulge });
    pts.push({ x: b.x, y: b.y });
    curva = true;
  }
  if (!curva || pts.length < 3) return null;
  return { capa: "MC-MANZANA", nombre, cerrada: true, pts };
}

export function polilineaSardinel(e: Esquina, nombre: string): Polilinea {
  return {
    capa: "MC-VEREDA",
    nombre,
    cerrada: false,
    pts: [
      { x: e.sardA.x, y: e.sardA.y, bulge: e.sardBulge },
      { x: e.sardB.x, y: e.sardB.y },
    ],
  };
}

export function retroceso(R: number, veredaCruce: number): number {
  return Math.max(0, R - veredaCruce);
}
