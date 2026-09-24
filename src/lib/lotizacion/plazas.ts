import { area, cross, dist, lerp, norm, pointInPoly, sub, type V2 } from "./geom";
import type { CategoriaParque, EstiloParque } from "./tipos";

/**
 * Plazas internas, después de la recreación.
 * La cancha o el jardín ya ocupan su sitio. Cada plaza nace en el claro que queda
 * y abre bocas hacia las veredas del perímetro y hacia esa recreación.
 */

export type FrenteVereda = { borde: V2; dentro: V2; hacia: V2; largo: number };
export type PlazaInterna = {
  pts: V2[];
  centro: V2;
  forma: "circulo" | "octogono" | "capsula" | "abanico" | "rinon" | "gota" | "hexagono" | "cruz";
  bocas: V2[];
  juntas: [V2, V2][];
  centroPie: V2[];
};
export type RedPlazas = {
  plazas: PlazaInterna[];
  senderos: { a: V2; b: V2 }[];
};

function holgura(p: V2, poly: V2[]): number {
  if (!pointInPoly(p, poly)) return -1;
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ab = sub(b, a);
    const L2 = ab.x * ab.x + ab.y * ab.y || 1;
    let t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / L2;
    t = Math.max(0, Math.min(1, t));
    m = Math.min(m, Math.hypot(p.x - (a.x + ab.x * t), p.y - (a.y + ab.y * t)));
  }
  return m;
}

function local(c: V2, ang: number, x: number, y: number): V2 {
  const u = Math.cos(ang);
  const v = Math.sin(ang);
  return { x: c.x + u * x - v * y, y: c.y + v * x + u * y };
}

function disco(c: V2, r: number, n = 20): V2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  });
}

function octogono(c: V2, w: number, h: number, ang: number): V2[] {
  const hx = w / 2;
  const hy = h / 2;
  const k = Math.min(w, h) * 0.28;
  const loc = [
    [-hx + k, -hy],
    [hx - k, -hy],
    [hx, -hy + k],
    [hx, hy - k],
    [hx - k, hy],
    [-hx + k, hy],
    [-hx, hy - k],
    [-hx, -hy + k],
  ];
  return loc.map(([x, y]) => local(c, ang, x, y));
}

function capsula(c: V2, largo: number, ancho: number, ang: number): V2[] {
  const r = ancho / 2;
  const hl = Math.max(0.2, largo / 2 - r);
  const n = 7;
  const loc: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    loc.push({ x: hl + r * Math.cos(a), y: r * Math.sin(a) });
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / n;
    loc.push({ x: -hl + r * Math.cos(a), y: r * Math.sin(a) });
  }
  return loc.map((p) => local(c, ang, p.x, p.y));
}

function abanico(c: V2, r: number, ang: number, apertura = 2.2): V2[] {
  const n = 12;
  const loc: V2[] = [{ x: 0, y: 0 }];
  for (let i = 0; i <= n; i++) {
    const a = -apertura / 2 + (apertura * i) / n;
    loc.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return loc.map((p) => local(c, ang, p.x, p.y));
}

function dentro(pts: V2[], park: V2[], margen: number): boolean {
  return pts.length >= 3 && Math.abs(area(pts)) > 12 && pts.every((p) => holgura(p, park) >= margen);
}

function cruza(a: V2, b: V2, c: V2, d: V2): boolean {
  const den = cross(sub(b, a), sub(d, c));
  if (Math.abs(den) < 1e-9) return false;
  const t = cross(sub(c, a), sub(d, c)) / den;
  const u = cross(sub(c, a), sub(b, a)) / den;
  return t > 0.04 && t < 0.96 && u > 0.04 && u < 0.96;
}

function toca(pts: V2[], obs: V2[]): boolean {
  if (pts.some((p) => pointInPoly(p, obs)) || obs.some((p) => pointInPoly(p, pts))) return true;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    for (let j = 0; j < obs.length; j++) {
      if (cruza(a, b, obs[j], obs[(j + 1) % obs.length])) return true;
    }
  }
  return false;
}

function libre(pts: V2[], obstaculos: V2[][]): boolean {
  return !obstaculos.some((o) => o.length >= 3 && toca(pts, o));
}

function segmentoLibre(a: V2, b: V2, park: V2[], obstaculos: V2[][]): boolean {
  const pasos = 8;
  for (let i = 1; i < pasos; i++) {
    const p = lerp(a, b, i / pasos);
    if (!pointInPoly(p, park)) return false;
    if (obstaculos.some((o) => o.length >= 3 && pointInPoly(p, o))) return false;
  }
  return true;
}

function cortaBorde(centro: V2, poly: V2[], objetivo: V2): V2 {
  const dir = norm(sub(objetivo, centro));
  const lejos = { x: centro.x + dir.x * 40, y: centro.y + dir.y * 40 };
  let mejor: V2 | null = null;
  let mejorD = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const den = cross(sub(lejos, centro), sub(b, a));
    if (Math.abs(den) < 1e-9) continue;
    const t = cross(sub(a, centro), sub(b, a)) / den;
    const u = cross(sub(a, centro), sub(lejos, centro)) / den;
    if (t <= 0.02 || t >= 1 || u <= 0 || u >= 1) continue;
    const hit = lerp(centro, lejos, t);
    const d = dist(centro, hit);
    if (d < mejorD) {
      mejor = hit;
      mejorD = d;
    }
  }
  return mejor ?? centro;
}

/** Lados largos del parque: ahí está la vereda de la calle. */
export function frentesDeVereda(poly: V2[]): FrenteVereda[] {
  const out: FrenteVereda[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const largo = dist(a, b);
    if (largo < 8) continue;
    const e = norm(sub(b, a));
    const n1 = { x: -e.y, y: e.x };
    const n2 = { x: e.y, y: -e.x };
    const mid = lerp(a, b, 0.5);
    const hacia = pointInPoly({ x: mid.x + n1.x, y: mid.y + n1.y }, poly) ? n1 : n2;
    out.push({
      borde: mid,
      dentro: { x: mid.x + hacia.x * 0.06, y: mid.y + hacia.y * 0.06 },
      hacia,
      largo,
    });
  }
  return out.sort((a, b) => b.largo - a.largo).slice(0, 4);
}

function juntasDe(forma: PlazaInterna["forma"], centro: V2, pts: V2[], ang: number, radio: number): [V2, V2][] {
  const dentroDe = (p: V2) => pointInPoly(p, pts);
  const recortar = (a: V2, b: V2): [V2, V2] | null => (dentroDe(a) && dentroDe(b) ? [a, b] : null);
  const juntas: [V2, V2][] = [];
  if (forma === "circulo" || forma === "octogono" || forma === "abanico" || forma === "rinon" || forma === "gota" || forma === "hexagono" || forma === "cruz") {
    const n = forma === "octogono" ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI;
      const p1 = { x: centro.x + Math.cos(a) * radio * 0.28, y: centro.y + Math.sin(a) * radio * 0.28 };
      const p2 = { x: centro.x + Math.cos(a) * radio * 0.92, y: centro.y + Math.sin(a) * radio * 0.92 };
      const p3 = { x: centro.x - Math.cos(a) * radio * 0.92, y: centro.y - Math.sin(a) * radio * 0.92 };
      const j1 = recortar(p1, p2);
      const j2 = recortar(p1, p3);
      if (j1) juntas.push(j1);
      if (j2) juntas.push(j2);
    }
    return juntas;
  }
  for (const t of [-0.28, 0, 0.28]) {
    const a = local(centro, ang, -radio * 0.85, t * radio);
    const b = local(centro, ang, radio * 0.85, t * radio);
    const j = recortar(a, b);
    if (j) juntas.push(j);
  }
  return juntas;
}

function rinon(c: V2, r: number, ang: number): V2[] {
  const n = 18;
  const loc: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = -0.5 + (Math.PI * 2 * i) / n;
    const m = 1 - 0.28 * Math.max(0, Math.cos(a));
    loc.push({ x: r * m * Math.cos(a), y: r * 0.82 * Math.sin(a) });
  }
  return loc.map((p) => local(c, ang, p.x, p.y));
}

function gota(c: V2, r: number, ang: number): V2[] {
  const n = 16;
  const loc: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = 0.55 + 0.45 * Math.cos(a * 0.5);
    loc.push({ x: r * m * Math.cos(a), y: r * 0.7 * Math.sin(a) });
  }
  return loc.map((p) => local(c, ang, p.x, p.y));
}

function hexagono(c: V2, w: number, h: number, ang: number): V2[] {
  const loc = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return { x: (w / 2) * Math.cos(a), y: (h / 2) * Math.sin(a) };
  });
  return loc.map((p) => local(c, ang, p.x, p.y));
}

function cruz(c: V2, r: number, ang: number): V2[] {
  const a = r * 0.38;
  const b = r;
  const loc = [
    [-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a],
  ];
  return loc.map(([x, y]) => local(c, ang, x, y));
}

function formas(
  estilo: EstiloParque,
  c: V2,
  ang: number,
  escala: number,
): { forma: PlazaInterna["forma"]; pts: V2[]; radio: number }[] {
  const s = Math.max(0.72, Math.min(1.45, escala));
  const pack = (forma: PlazaInterna["forma"], pts: V2[], radio: number) => ({ forma, pts, radio: radio * s });
  const seis = [
    pack("octogono", octogono(c, 13 * s, 10.5 * s, ang), 6),
    pack("rinon", rinon(c, 6.4 * s, ang), 5.4),
    pack("abanico", abanico(c, 8.2 * s, ang), 5.6),
    pack("gota", gota(c, 7.2 * s, ang), 5),
    pack("hexagono", hexagono(c, 12 * s, 10 * s, ang), 5.5),
    pack("cruz", cruz(c, 6.2 * s, ang), 6.2),
    pack("capsula", capsula(c, 15 * s, 6.6 * s, ang), 6.4),
    pack("circulo", disco(c, 5.4 * s, 22), 5.4),
  ];
  const orden =
    estilo === "lineal"
      ? [6, 4, 1, 5, 3, 2, 0, 7]
      : estilo === "organico"
        ? [1, 3, 2, 5, 4, 6, 7, 0]
        : [5, 1, 3, 4, 2, 6, 0, 7];
  return orden.map((i) => seis[i]);
}

/**
 * Una o dos plazas en el claro que deja la recreación.
 * Los senderos salen de la vereda (borde del parque) y entran en la plaza.
 */
export function armarPlazas(opts: {
  poly: V2[];
  categoria: CategoriaParque;
  estilo: EstiloParque;
  obstaculos: V2[][];
  /** Centro de la cancha o de los juegos: solo para buscar el claro al lado. */
  ancla: V2 | null;
  /** Punto de la circulación de la recreación, fuera de la cancha, al que llega un acceso. */
  recreo: V2 | null;
  /** Más puntos del anillo o del paseo. Se enlaza el más cercano que quede libre. */
  enlaces?: V2[];
  angulo: number;
}): RedPlazas {
  const frentes = frentesDeVereda(opts.poly);
  const plazas: PlazaInterna[] = [];
  const usados: V2[] = [];
  const cupo = opts.categoria === "activa" ? 2 : 2;
  const sitios: { c: V2; ang: number }[] = [];
  for (const f of frentes) {
    for (const d of [9, 13, 17]) sitios.push({ c: { x: f.dentro.x + f.hacia.x * d, y: f.dentro.y + f.hacia.y * d }, ang: Math.atan2(f.hacia.y, f.hacia.x) });
  }
  const ancla = opts.ancla ?? opts.recreo;
  if (ancla) {
    const ang = opts.angulo;
    const n = { x: -Math.sin(ang), y: Math.cos(ang) };
    for (const s of [-1, 1]) {
      for (const d of [16, 22]) sitios.push({ c: { x: ancla.x + n.x * s * d, y: ancla.y + n.y * s * d }, ang });
    }
  }
  for (const sitio of sitios) {
    if (plazas.length >= cupo) break;
    if (!pointInPoly(sitio.c, opts.poly) || holgura(sitio.c, opts.poly) < 4) continue;
    if (usados.some((u) => dist(u, sitio.c) < 11)) continue;
    if (opts.obstaculos.some((o) => o.length >= 3 && pointInPoly(sitio.c, o))) continue;
    const escala = holgura(sitio.c, opts.poly) / 8;
    for (const intento of formas(opts.estilo, sitio.c, sitio.ang, escala)) {
      if (!dentro(intento.pts, opts.poly, 1.1) || !libre(intento.pts, opts.obstaculos)) continue;
      const metas = [
        ...frentes.map((f) => f.dentro),
        ...(opts.recreo ? [opts.recreo] : []),
        ...usados,
      ];
      const bocas = metas
        .map((m) => cortaBorde(sitio.c, intento.pts, m))
        .filter((b, i, arr) => arr.findIndex((q) => dist(q, b) < 1.2) === i)
        .slice(0, 4);
      plazas.push({
        pts: intento.pts,
        centro: sitio.c,
        forma: intento.forma,
        bocas,
        juntas: juntasDe(intento.forma, sitio.c, intento.pts, sitio.ang, intento.radio),
        centroPie: disco(sitio.c, Math.max(0.7, intento.radio * 0.16), 12),
      });
      usados.push(sitio.c);
      break;
    }
  }

  const senderos: { a: V2; b: V2 }[] = [];
  const ya = (a: V2, b: V2) => senderos.some((s) => (dist(s.a, a) < 0.8 && dist(s.b, b) < 0.8) || (dist(s.a, b) < 0.8 && dist(s.b, a) < 0.8));
  const unir = (a: V2, b: V2): boolean => {
    if (dist(a, b) < 1.2 || ya(a, b)) return dist(a, b) < 1.2;
    if (segmentoLibre(a, b, opts.poly, opts.obstaculos)) {
      senderos.push({ a, b });
      return true;
    }
    const e = norm(sub(b, a));
    const n = { x: -e.y, y: e.x };
    const medio = lerp(a, b, 0.5);
    for (const salto of [6, 12, 18, 26]) {
      for (const s of [1, -1]) {
        const q = { x: medio.x + n.x * s * salto, y: medio.y + n.y * s * salto };
        if (!pointInPoly(q, opts.poly) || holgura(q, opts.poly) < 1.2) continue;
        if (segmentoLibre(a, q, opts.poly, opts.obstaculos) && segmentoLibre(q, b, opts.poly, opts.obstaculos)) {
          senderos.push({ a, b: q }, { a: q, b });
          return true;
        }
      }
    }
    return false;
  };
  const sobreVereda = (f: FrenteVereda) => ({
    x: f.borde.x + f.hacia.x * 1.45,
    y: f.borde.y + f.hacia.y * 1.45,
  });
  for (const plaza of plazas) {
    const frente = frentes.reduce((m, f) => (dist(f.dentro, plaza.centro) < dist(m.dentro, plaza.centro) ? f : m), frentes[0]);
    if (frente) {
      const boca = cortaBorde(plaza.centro, plaza.pts, frente.dentro);
      unir(sobreVereda(frente), lerp(boca, plaza.centro, 0.22));
    }
    const segundo = frentes.filter((f) => !frente || dist(f.borde, frente.borde) > 6).sort((a, b) => dist(a.dentro, plaza.centro) - dist(b.dentro, plaza.centro))[0];
    if (segundo && dist(sobreVereda(segundo), plaza.centro) < 28) {
      const boca = cortaBorde(plaza.centro, plaza.pts, segundo.dentro);
      unir(sobreVereda(segundo), lerp(boca, plaza.centro, 0.22));
    }
    const metas = [...(opts.enlaces ?? []), ...(opts.recreo ? [opts.recreo] : [])].sort(
      (a, b) => dist(a, plaza.centro) - dist(b, plaza.centro),
    );
    for (const meta of metas) {
      const boca = cortaBorde(plaza.centro, plaza.pts, meta);
      if (unir(lerp(boca, plaza.centro, 0.22), meta)) break;
    }
  }
  if (plazas.length === 2) {
    const a = cortaBorde(plazas[0].centro, plazas[0].pts, plazas[1].centro);
    const b = cortaBorde(plazas[1].centro, plazas[1].pts, plazas[0].centro);
    unir(lerp(a, plazas[0].centro, 0.4), lerp(b, plazas[1].centro, 0.4));
  }
  return { plazas, senderos };
}
