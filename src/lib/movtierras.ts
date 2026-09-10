import { fmt } from "./num";

export type Pt = { x: number; y: number };

export type PerfilVia = "horizontal" | "bombeo" | "peralte";

export type SeccionInput = {
  zr: number;
  B: number;
  berma: number;
  pTrans: number;
  perfil: PerfilVia;
  nCorte: number;
  nRelleno: number;
  terreno: Pt[];
};

export type Franja = {
  x1: number;
  x2: number;
  t1: number;
  t2: number;
  v1: number;
  v2: number;
  kind: "corte" | "relleno";
  area: number;
};

export type SeccionResult = {
  terreno: Pt[];
  via: Pt[];
  catchL: Pt;
  catchR: Pt;
  pavL: Pt;
  pavR: Pt;
  eje: Pt;
  Ac: number;
  Ar: number;
  franjas: Franja[];
  hEje: number;
  hIzq: number;
  hDer: number;
  anchoObras: number;
};

export type Estacion = { pk: number; Ac: number; Ar: number };

export type VolumenInput = {
  estaciones: Estacion[];
  Fe: number;
  Fc: number;
};

export type TramoVol = {
  pk1: number;
  pk2: number;
  L: number;
  Ac1: number;
  Ac2: number;
  Ar1: number;
  Ar2: number;
  Vc: number;
  Vr: number;
};

export type VolumenResult = {
  tramos: TramoVol[];
  Vc: number;
  Vr: number;
  Vsuelto: number;
  Vcompact: number;
  prestamo: number;
  desmonte: number;
  masas: { pk: number; M: number; Madj: number }[];
  L: number;
};

export function fmtPk(m: number): string {
  const sign = m < 0 ? "−" : "";
  const a = Math.abs(m);
  const km = Math.floor(a / 1000 + 1e-12);
  const rest = a - km * 1000;
  return `${sign}${km}+${rest.toFixed(2).padStart(6, "0")}`;
}

export const TERRENO_LADERA: Pt[] = [
  { x: -10, y: 1593.8 },
  { x: -6, y: 1592.2 },
  { x: -3.5, y: 1591.1 },
  { x: 0, y: 1589.55 },
  { x: 3.5, y: 1587.9 },
  { x: 6, y: 1586.7 },
  { x: 10, y: 1585.2 },
];

/** Puntos del Excel f315101184 (Heb MERMA), progresiva 0+100. */
export const TERRENO_HEBMERMA: Pt[] = [
  { x: -4, y: 1590 },
  { x: -3.5, y: 1593 },
  { x: -3, y: 1598 },
  { x: -2.5, y: 1600 },
  { x: -2, y: 1585 },
  { x: -1.5, y: 1583 },
  { x: -1, y: 1594 },
  { x: -0.5, y: 1591 },
  { x: 0, y: 1589.4 },
  { x: 0.5, y: 1588 },
  { x: 1, y: 1586.5 },
  { x: 1.5, y: 1587 },
  { x: 2, y: 1587.5 },
  { x: 2.5, y: 1589 },
  { x: 3, y: 1592 },
  { x: 3.5, y: 1592.6 },
  { x: 4, y: 1592.8 },
];

/** Áreas del Excel ARVOL (vía Loja, km 0+000 a 0+160). */
export const ESTACIONES_ARVOL: Estacion[] = [
  { pk: 0, Ac: 39.14, Ar: 0 },
  { pk: 10, Ac: 44.15, Ar: 0 },
  { pk: 20, Ac: 36.57, Ar: 0 },
  { pk: 40, Ac: 17.91, Ar: 0 },
  { pk: 60, Ac: 14.65, Ar: 0 },
  { pk: 80, Ac: 12.92, Ar: 0 },
  { pk: 100, Ac: 2.98, Ar: 0 },
  { pk: 120, Ac: 0, Ar: 0.36 },
  { pk: 140, Ac: 0, Ar: 7.09 },
  { pk: 160, Ac: 11.81, Ar: 0 },
];

function finite(n: number, fb = 0) {
  return Number.isFinite(n) ? n : fb;
}

export function sortPts(pts: Pt[]): Pt[] {
  return [...pts]
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x);
}

export function interpY(poly: Pt[], x: number): number {
  if (poly.length === 0) return 0;
  if (x <= poly[0].x) return poly[0].y;
  if (x >= poly[poly.length - 1].x) return poly[poly.length - 1].y;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = b.x - a.x === 0 ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + t * (b.y - a.y);
    }
  }
  return poly[poly.length - 1].y;
}

function segHit(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
  if (t < 1e-6 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

function extendTerreno(pts: Pt[], extra = 8): Pt[] {
  const t = sortPts(pts);
  if (t.length === 0) return t;
  if (t.length === 1) {
    return [
      { x: t[0].x - extra, y: t[0].y },
      t[0],
      { x: t[0].x + extra, y: t[0].y },
    ];
  }
  return [{ x: t[0].x - extra, y: t[0].y }, ...t, { x: t[t.length - 1].x + extra, y: t[t.length - 1].y }];
}

function shoot(origin: Pt, left: boolean, cut: boolean, n: number, terreno: Pt[]): Pt {
  const nv = Math.max(0.1, n);
  const zs = terreno.map((p) => p.y);
  const zMin = Math.min(...zs) - 1;
  const zMax = Math.max(...zs) + 1;
  const H = Math.min(20, Math.max(0.8, cut ? zMax - origin.y : origin.y - zMin));
  const xLim = left ? terreno[0].x : terreno[terreno.length - 1].x;
  const end: Pt = {
    x: origin.x + (left ? -1 : 1) * nv * H,
    y: origin.y + (cut ? 1 : -1) * H,
  };
  let best: Pt | null = null;
  let bestD = Infinity;
  for (let i = 0; i < terreno.length - 1; i++) {
    const hit = segHit(origin, end, terreno[i], terreno[i + 1]);
    if (!hit) continue;
    const d = Math.hypot(hit.x - origin.x, hit.y - origin.y);
    if (d < bestD) {
      bestD = d;
      best = hit;
    }
  }
  if (best) return best;
  const xEnd = left ? Math.max(end.x, xLim) : Math.min(end.x, xLim);
  return { x: xEnd, y: interpY(terreno, xEnd) };
}

function yViaAt(x: number, zr: number, B: number, pTrans: number, perfil: PerfilVia): number {
  const i = Math.abs(pTrans) / 100;
  const half = B / 2;
  if (perfil === "horizontal" || half < 1e-6) return zr;
  if (perfil === "bombeo") {
    const dx = Math.min(Math.abs(x), half);
    return zr - i * dx;
  }
  return zr - Math.sign(pTrans || 1) * i * x;
}

function clipPoly(poly: Pt[], x0: number, x1: number): Pt[] {
  const a = Math.min(x0, x1);
  const b = Math.max(x0, x1);
  const inner = poly.filter((p) => p.x > a + 1e-9 && p.x < b - 1e-9);
  return [{ x: a, y: interpY(poly, a) }, ...inner, { x: b, y: interpY(poly, b) }];
}

export function franjasPerfil(terreno: Pt[], via: Pt[]): Franja[] {
  const xs = [...new Set([...terreno.map((p) => p.x), ...via.map((p) => p.x)])].sort((a, b) => a - b);
  const out: Franja[] = [];
  const push = (x1: number, x2: number, t1: number, t2: number, v1: number, v2: number) => {
    const dx = x2 - x1;
    if (dx < 1e-9) return;
    const h1 = t1 - v1;
    const h2 = t2 - v2;
    if (Math.abs(h1) < 1e-9 && Math.abs(h2) < 1e-9) return;
    if (h1 >= 0 && h2 >= 0) {
      out.push({ x1, x2, t1, t2, v1, v2, kind: "corte", area: ((h1 + h2) / 2) * dx });
      return;
    }
    if (h1 <= 0 && h2 <= 0) {
      out.push({ x1, x2, t1, t2, v1, v2, kind: "relleno", area: ((-h1 - h2) / 2) * dx });
      return;
    }
    const t = h1 / (h1 - h2);
    const xm = x1 + t * dx;
    const ymT = t1 + t * (t2 - t1);
    const ymV = v1 + t * (v2 - v1);
    push(x1, xm, t1, ymT, v1, ymV);
    push(xm, x2, ymT, t2, ymV, v2);
  };
  for (let i = 0; i < xs.length - 1; i++) {
    const x1 = xs[i];
    const x2 = xs[i + 1];
    push(x1, x2, interpY(terreno, x1), interpY(terreno, x2), interpY(via, x1), interpY(via, x2));
  }
  return out;
}

export function calcularSeccion(raw: SeccionInput): SeccionResult {
  const zr = finite(raw.zr, 1589.4);
  const B = Math.max(1, finite(raw.B, 7));
  const berma = Math.max(0, finite(raw.berma, 0.5));
  const pTrans = finite(raw.pTrans, 2);
  const nCorte = Math.max(0.2, finite(raw.nCorte, 1));
  const nRelleno = Math.max(0.2, finite(raw.nRelleno, 1.5));
  const terreno = extendTerreno(raw.terreno.length ? raw.terreno : TERRENO_LADERA);
  const eje: Pt = { x: 0, y: zr };
  const pavL: Pt = { x: -B / 2, y: yViaAt(-B / 2, zr, B, pTrans, raw.perfil) };
  const pavR: Pt = { x: B / 2, y: yViaAt(B / 2, zr, B, pTrans, raw.perfil) };
  const bermL: Pt = { x: pavL.x - berma, y: pavL.y };
  const bermR: Pt = { x: pavR.x + berma, y: pavR.y };
  const tol = 0.02;
  const tL = interpY(terreno, bermL.x);
  const tR = interpY(terreno, bermR.x);
  const catchL =
    tL > bermL.y + tol
      ? shoot(bermL, true, true, nCorte, terreno)
      : tL < bermL.y - tol
        ? shoot(bermL, true, false, nRelleno, terreno)
        : { x: bermL.x, y: tL };
  const catchR =
    tR > bermR.y + tol
      ? shoot(bermR, false, true, nCorte, terreno)
      : tR < bermR.y - tol
        ? shoot(bermR, false, false, nRelleno, terreno)
        : { x: bermR.x, y: tR };
  const viaRaw: Pt[] = [catchL, bermL, pavL, eje, pavR, bermR, catchR];
  const via: Pt[] = [];
  for (const p of viaRaw) {
    const last = via[via.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.005) via.push(p);
  }
  const x0 = Math.min(catchL.x, catchR.x);
  const x1 = Math.max(catchL.x, catchR.x);
  const franjas = franjasPerfil(clipPoly(terreno, x0, x1), via);
  const Ac = franjas.filter((f) => f.kind === "corte").reduce((s, f) => s + f.area, 0);
  const Ar = franjas.filter((f) => f.kind === "relleno").reduce((s, f) => s + f.area, 0);
  return {
    terreno: clipPoly(terreno, x0 - 2.5, x1 + 2.5),
    via,
    catchL,
    catchR,
    pavL,
    pavR,
    eje,
    Ac,
    Ar,
    franjas,
    hEje: interpY(terreno, 0) - zr,
    hIzq: interpY(terreno, pavL.x) - pavL.y,
    hDer: interpY(terreno, pavR.x) - pavR.y,
    anchoObras: catchR.x - catchL.x,
  };
}

export function calcularVolumenes(raw: VolumenInput): VolumenResult {
  const Fe = Math.max(1, finite(raw.Fe, 1.25));
  const Fc = Math.min(1, Math.max(0.5, finite(raw.Fc, 0.9)));
  const est = [...raw.estaciones]
    .filter((e) => Number.isFinite(e.pk))
    .sort((a, b) => a.pk - b.pk)
    .map((e) => ({ pk: e.pk, Ac: Math.max(0, finite(e.Ac)), Ar: Math.max(0, finite(e.Ar)) }));
  const tramos: TramoVol[] = [];
  for (let i = 0; i < est.length - 1; i++) {
    const a = est[i];
    const b = est[i + 1];
    const L = b.pk - a.pk;
    if (L <= 0) continue;
    tramos.push({
      pk1: a.pk,
      pk2: b.pk,
      L,
      Ac1: a.Ac,
      Ac2: b.Ac,
      Ar1: a.Ar,
      Ar2: b.Ar,
      Vc: ((a.Ac + b.Ac) / 2) * L,
      Vr: ((a.Ar + b.Ar) / 2) * L,
    });
  }
  const Vc = tramos.reduce((s, t) => s + t.Vc, 0);
  const Vr = tramos.reduce((s, t) => s + t.Vr, 0);
  const Vsuelto = Vc * Fe;
  const Vcompact = Vc * Fc;
  const prestamo = Math.max(0, Vr - Vcompact);
  const desmonte = Math.max(0, Vcompact - Vr);
  const masas: VolumenResult["masas"] = [];
  if (est.length) {
    let M = 0;
    let Madj = 0;
    masas.push({ pk: est[0].pk, M: 0, Madj: 0 });
    for (const t of tramos) {
      M += t.Vc - t.Vr;
      Madj += t.Vc * Fc - t.Vr;
      masas.push({ pk: t.pk2, M, Madj });
    }
  }
  const L = est.length >= 2 ? est[est.length - 1].pk - est[0].pk : 0;
  return { tramos, Vc, Vr, Vsuelto, Vcompact, prestamo, desmonte, masas, L };
}

export function textoH(h: number): string {
  if (Math.abs(h) < 0.015) return "rasante ≈ terreno";
  return h > 0 ? `corte ${fmt(h, 2)} m` : `relleno ${fmt(-h, 2)} m`;
}
