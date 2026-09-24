import { geoMuroVoladizo } from "./metradoZonas";
import { barByName } from "./types";

export type LeaderSide = "left" | "right" | "top" | "bottom";

export type SteelBarPt = { x: number; y: number };

export type SteelDraw = "dots" | "bar";

export type SteelLayer = {
  mark: number;
  name: string;
  face: string;
  bar: string;
  dbCm: number;
  sCm: number;
  nReal: number;
  asProv: number;
  asUnit: "cm²" | "cm²/m";
  /** As requerido por el cálculo de flexión / mín. (cm²/m o cm²). */
  asReq?: number;
  /** Longitud de desarrollo ℓd (cm). */
  ldCm?: number;
  /** Recubrimiento libre de esa cara (cm). */
  recCm?: number;
  color: string;
  side: LeaderSide;
  /** Cortes (círculos) o barra longitudinal en el plano de la sección. */
  draw?: SteelDraw;
  bars: SteelBarPt[];
  /** Polilínea de la barra en el plano (ganchos incluidos). */
  barPath?: SteelBarPt[];
  /** Varias polilíneas (p. ej. intradós + trasdós). */
  barPaths?: SteelBarPt[][];
  /** Punto de arranque de la cota-llamada (un lecho = una etiqueta). */
  attach?: SteelBarPt;
  callout?: { x: number; y: number; anchor: "start" | "middle" | "end" };
  /** Segunda línea de la marca (p. ej. "4 Ø" o "@ 10 cm"). Si falta, se usa @s cm. */
  qty?: string;
  /** Estribo: trazo fino, sin contorno ni tapas. El longitudinal lleva el grosor del Ø. */
  hair?: boolean;
};

export type SteelDim = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  side: LeaderSide;
  /** Cota de barra: trazo fino, sin placa, del orden del Ø dibujado. */
  tiny?: boolean;
};

export type SteelAnno = {
  x: number;
  y: number;
  text: string;
  anchor?: "start" | "middle" | "end";
  fill?: string;
  size?: number;
};

export type SteelSchedule = {
  caption: string;
  headers: string[];
  rows: string[][];
  note?: string;
};

export type SteelDraftSpec = {
  title: string;
  subtitle: string;
  caption: string;
  note: string;
  W: number;
  H: number;
  outline: string;
  cover?: string;
  soil?: string;
  soilFront?: string;
  groundY?: number;
  barScale?: number;
  /** Píxeles por metro, para la escala gráfica. */
  pxPerM?: number;
  /** Hoja grande (despiece de muro a escala de plano). */
  sheet?: "a1";
  /** Planta: sin terreno ni línea de suelo. */
  mode?: "section" | "plan";
  /** Pie de figura (si falta, se infiere según haya terreno o no). */
  footer?: string;
  dims: SteelDim[];
  layers: SteelLayer[];
  annos?: SteelAnno[];
  /** Polígonos extra (paños techo / huecos) en planta. */
  regions?: { points: string; fill?: string; stroke?: string; dash?: string; hatch?: boolean }[];
  /** Ejes o guías de planta. */
  guides?: { x1: number; y1: number; x2: number; y2: number; color?: string; dash?: string; width?: number }[];
  /** Oculta llamadas laterales (el cuadro de marcas basta). */
  hideCallouts?: boolean;
  /** Cajas compactas de marca + Ø pegadas a cada pieza (planta A1). */
  markBoxes?: boolean;
  /** Factor de afinado de varilla (0.55 = trazo fino profesional en planta). */
  lineScale?: number;
  /** Elevación larga: el alto del svg sigue la escala, sin el mínimo de las hojas altas. */
  layout?: "elevation";
  /** Cuadros de despiece (sustituyen la tabla genérica de lechos). */
  schedules?: SteelSchedule[];
};

export const STEEL_FLEX = "#8b1e1e";
export const STEEL_TEMP = "#1a4473";
export const STEEL_DIST = "#5a4a28";

export function nPerMeter(sCm: number) {
  return Math.max(1, Math.round(100 / Math.max(sCm, 1)));
}

export function asProvCm2m(asBar: number, sCm: number) {
  return (asBar / Math.max(sCm, 1e-6)) * 100;
}

export function nAlong(lengthCm: number, sCm: number) {
  return Math.max(2, Math.floor(lengthCm / Math.max(sCm, 1)) + 1);
}

export function nDraw(nReal: number, maxN = 11) {
  return Math.max(2, Math.min(nReal, maxN));
}

export function placeLine(ax: number, ay: number, bx: number, by: number, n: number): SteelBarPt[] {
  if (n <= 1) return [{ x: (ax + bx) / 2, y: (ay + by) / 2 }];
  return Array.from({ length: n }, (_, i) => ({
    x: ax + ((bx - ax) * i) / (n - 1),
    y: ay + ((by - ay) * i) / (n - 1),
  }));
}

export function barRadius(dbCm: number, sc: number) {
  return Math.max(2.6, Math.min(7.2, dbCm * sc * 0.62));
}

export function parseSteelText(text: string): { bar: string; s: number } {
  const raw = String(text || "");
  const barMatch = raw.match(/Ø\s*([^@·]+)/i);
  const sMatch = raw.match(/@\s*([\d.,]+)/);
  const bar = (barMatch?.[1] ?? '1/2"').replace(/inf\.|sup\.|cm.*/gi, "").trim() || '1/2"';
  const s = parseFloat((sMatch?.[1] ?? "20").replace(",", "."));
  return { bar, s: Number.isFinite(s) && s > 0 ? s : 20 };
}

export function hookBar(a: SteelBarPt, b: SteelBarPt, dir: "up" | "down" | "left" | "right", len: number): SteelBarPt[] {
  const d = { up: [0, -len], down: [0, len], left: [-len, 0], right: [len, 0] }[dir];
  return [a, b, { x: b.x + d[0], y: b.y + d[1] }];
}

export function midPoint(a: SteelBarPt, b: SteelBarPt): SteelBarPt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function layerFromBar(opts: {
  mark: number;
  name: string;
  face: string;
  barName: string;
  sCm: number;
  lengthCm: number;
  color: string;
  side: LeaderSide;
  a: SteelBarPt;
  b: SteelBarPt;
  maxDraw?: number;
}): SteelLayer {
  const bar = barByName(opts.barName);
  const nReal = nAlong(opts.lengthCm, opts.sCm);
  const bars = placeLine(opts.a.x, opts.a.y, opts.b.x, opts.b.y, nDraw(nReal, opts.maxDraw ?? 11));
  return {
    mark: opts.mark,
    name: opts.name,
    face: opts.face,
    bar: bar.name,
    dbCm: bar.db,
    sCm: opts.sCm,
    nReal,
    asProv: asProvCm2m(bar.as, opts.sCm),
    asUnit: "cm²/m",
    color: opts.color,
    side: opts.side,
    bars,
  };
}

function nv(v: Record<string, string>, k: string, fb = 0) {
  const s = String(v[k] ?? "").trim().replace(",", ".");
  if (s === "") return fb;
  const x = Number(s);
  return Number.isFinite(x) ? x : fb;
}

function sv(v: Record<string, string>, k: string, fb = "") {
  return String(v[k] ?? "").trim() || fb;
}

const FLEX = STEEL_FLEX;
const TEMP = STEEL_TEMP;
const DIST = STEEL_DIST;

function xyAt(x0: number, y0: number, x1: number, y1: number, t: number): SteelBarPt {
  return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
}

export function ptsStr(pts: { x: number; y: number }[]) {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

function sampleArc(cx: number, cy: number, r: number, a0: number, a1: number, n = 12): SteelBarPt[] {
  const pts: SteelBarPt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** ℓd simplificado E.060 / ACI (cm): k·fy·db/√f'c, k=0,1508 (Ø≤3/4") ó 0,1885. */
export function steelLdCm(fy: number, fc: number, dbCm: number) {
  const k = dbCm > 1.91 ? 0.1885 : 0.1508;
  return Math.max(30, (k * fy * dbCm) / Math.max(Math.sqrt(Math.max(fc, 1)), 1));
}

/** Offset de polilínea abierta: `left`/`right` según el sentido de recorrido. */
export function offsetOpenPolyline(pts: SteelBarPt[], dist: number, side: "left" | "right"): SteelBarPt[] {
  if (pts.length < 2) return pts.map((p) => ({ ...p }));
  const sign = side === "left" ? 1 : -1;
  const nrm = (a: SteelBarPt, b: SteelBarPt) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    return { x: (sign * -dy) / L, y: (sign * dx) / L };
  };
  return pts.map((p, i) => {
    const n1 = nrm(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i === 0 ? 1 : i)]);
    const n2 = i === 0 || i === pts.length - 1 ? n1 : nrm(pts[i], pts[i + 1]);
    let nx = n1.x + n2.x;
    let ny = n1.y + n2.y;
    const L = Math.hypot(nx, ny) || 1;
    nx /= L;
    ny /= L;
    const miter = dist / Math.max(0.42, nx * n1.x + ny * n1.y);
    const d = Math.min(Math.abs(miter), dist * 2.4) * Math.sign(miter || 1);
    return { x: p.x + nx * d, y: p.y + ny * d };
  });
}

/** Recorta el arranque de una polilínea una distancia (recubrimiento de extremo). */
export function trimPolylineStart(pts: SteelBarPt[], dist: number): SteelBarPt[] {
  if (pts.length < 2 || dist <= 0) return pts;
  let left = dist;
  const out: SteelBarPt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg < 1e-6) continue;
    if (left <= 0) {
      if (!out.length) out.push(a);
      out.push(b);
      continue;
    }
    if (seg <= left) {
      left -= seg;
      continue;
    }
    const t = left / seg;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    out.push(b);
    left = 0;
  }
  return out.length >= 2 ? out : pts;
}

/** Polilínea con gancho 90° (radio interior tipo 6Ø, ramal 12Ø) según vector de gancho. */
export function pathHook90Vec(
  from: SteelBarPt,
  corner: SteelBarPt,
  hook: SteelBarPt,
  r: number,
  hookLen: number,
): SteelBarPt[] {
  const ux = from.x - corner.x;
  const uy = from.y - corner.y;
  const len = Math.hypot(ux, uy) || 1;
  const ix = ux / len;
  const iy = uy / len;
  const hl = Math.hypot(hook.x, hook.y) || 1;
  const ox = hook.x / hl;
  const oy = hook.y / hl;
  const rad = Math.min(r, len * 0.42, Math.max(hookLen, 1) * 0.85);
  const pEnter = { x: corner.x + ix * rad, y: corner.y + iy * rad };
  const pExit = { x: corner.x + ox * rad, y: corner.y + oy * rad };
  const cx = corner.x + (ix + ox) * rad;
  const cy = corner.y + (iy + oy) * rad;
  const a0 = Math.atan2(pEnter.y - cy, pEnter.x - cx);
  const a1 = Math.atan2(pExit.y - cy, pExit.x - cx);
  let da = a1 - a0;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const pEnd = { x: corner.x + ox * (rad + hookLen), y: corner.y + oy * (rad + hookLen) };
  return [from, pEnter, ...sampleArc(cx, cy, rad, a0, a0 + da, 14).slice(1), pEnd];
}

/** Polilínea con gancho 90° (radio interior tipo 6Ø, ramal 12Ø) muestreada para el plano. */
export function pathHook90(
  from: SteelBarPt,
  corner: SteelBarPt,
  toward: "right" | "left" | "up" | "down",
  r: number,
  hookLen: number,
): SteelBarPt[] {
  const d = { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } }[toward];
  return pathHook90Vec(from, corner, d, r, hookLen);
}

/** Polilínea que termina en gancho 90° sobre el último vértice. */
export function pathWithEndHook(
  pts: SteelBarPt[],
  toward: "right" | "left" | "up" | "down",
  r: number,
  hookLen: number,
): SteelBarPt[] {
  if (pts.length < 2) return pts;
  const hooked = pathHook90(pts[pts.length - 2], pts[pts.length - 1], toward, r, hookLen);
  return [...pts.slice(0, -1), ...hooked.slice(1)];
}

/** Continúa una polilínea (fuste) hasta un rincón interior y gancha 90°. */
export function appendHook90(
  pts: SteelBarPt[],
  corner: SteelBarPt,
  toward: "right" | "left" | "up" | "down",
  r: number,
  hookLen: number,
): SteelBarPt[] {
  if (!pts.length) return pathHook90(corner, { x: corner.x, y: corner.y + 8 }, toward, r, hookLen);
  const from = pts[pts.length - 1];
  if (Math.hypot(from.x - corner.x, from.y - corner.y) < 1.4) {
    return pts.length < 2 ? pathHook90(from, corner, toward, r, hookLen) : pathWithEndHook([...pts.slice(0, -1), corner], toward, r, hookLen);
  }
  return pathWithEndHook([...pts, corner], toward, r, hookLen);
}

/** Barra recta con gancho 90° en ambos extremos (lechos de zapata). */
export function pathBothHooks90(
  a: SteelBarPt,
  b: SteelBarPt,
  startToward: "right" | "left" | "up" | "down",
  endToward: "right" | "left" | "up" | "down",
  r: number,
  hookLen: number,
): SteelBarPt[] {
  const start = pathHook90(b, a, startToward, r, hookLen).reverse();
  const end = pathHook90(a, b, endToward, r, hookLen);
  return [...start.slice(0, -1), ...end.slice(1)];
}

/** Caja de marca pegada al acero, al lado indicado. */
export function calloutBeside(
  attach: SteelBarPt,
  side: "left" | "right" | "top" | "bottom",
  gap = 18,
): NonNullable<SteelLayer["callout"]> {
  if (side === "left") return { x: attach.x - gap, y: attach.y, anchor: "end" };
  if (side === "right") return { x: attach.x + gap, y: attach.y, anchor: "start" };
  if (side === "top") return { x: attach.x, y: attach.y - gap, anchor: "middle" };
  return { x: attach.x, y: attach.y + gap, anchor: "middle" };
}

/** Corte T del muro en voladizo: alma con talud, longitudinal en el plano, temperatura en corte. */
export function specMuroVoladizo(values: Record<string, string>): SteelDraftSpec {
  const H = nv(values, "H", 4);
  const F = nv(values, "F", 0.4);
  const C = nv(values, "C", 1.2);
  const A = nv(values, "A", 2);
  const e = nv(values, "esp", 0.4);
  const Bp = nv(values, "Bp", 0.2);
  const beta = nv(values, "beta", 10);
  const hk = Math.min(0.6, Math.max(0, nv(values, "hk", 0)));
  const bkIn = nv(values, "bk", F);
  const D = nv(values, "D", 0.8);
  const rec = nv(values, "rec", 5);
  const recZap = nv(values, "recZap", 7.5);
  const barAlma = sv(values, "barAlma", '5/8"');
  const sAlma = nv(values, "sAlma", 15);
  const barPata = sv(values, "barPata", '5/8"');
  const sPata = nv(values, "sPata", 15);
  const barTalon = sv(values, "barTalon", '5/8"');
  const sTalon = nv(values, "sTalon", 15);
  const barTemp = sv(values, "barTemp", '3/8"');
  const sTemp = nv(values, "sTemp", 25);

  const g = geoMuroVoladizo({ H, D, A, C, F, Bp, esp: e, beta, hk, bk: bkIn });
  const { B, xStemF, xStemB, xTopF, xTopB, xKeyL, xKeyR, wall } = g;
  const hkUse = g.hk;
  const bkUse = g.bk;

  const padL = 300;
  const padR = 300;
  const padT = 88;
  const padB = 200;
  const spanY = H + Math.max(hkUse, 0.02);
  const sc = Math.min(1180 / Math.max(B, 1.05), 1320 / Math.max(spanY, 2.2));
  const W = Math.ceil(padL + B * sc + padR);
  const Ht = Math.ceil(padT + spanY * sc + padB);
  const ox = padL;
  const yTopWall = padT;
  const xy = (x: number, y: number) => ({ x: ox + x * sc, y: yTopWall + (H - y) * sc });
  const outline = ptsStr(wall.map(([x, y]) => xy(x, y)));
  const barScale = 1;

  const recS = (rec / 100) * sc;
  const recZ = (recZap / 100) * sc;
  const dbAlma = barByName(barAlma).db;
  const dbPata = barByName(barPata).db;
  const dbTalon = barByName(barTalon).db;
  const dbTemp = barByName(barTemp).db;
  const barIntraN = sv(values, "barIntra", barTemp);
  const sIntra = nv(values, "sIntra", Math.max(sTemp, 15));
  const dbIntra = barByName(barIntraN).db;
  const barDistN = sv(values, "barDist", barTemp);
  const sDist = nv(values, "sDist", 20);
  const dbDist = barByName(barDistN).db;
  const rAlma = Math.max(1.8, (dbAlma / 100) * sc * 0.5);
  const rIntra = Math.max(1.6, (dbIntra / 100) * sc * 0.5);
  const rTemp = Math.max(1.5, (dbTemp / 100) * sc * 0.5);
  const rPata = Math.max(1.7, (dbPata / 100) * sc * 0.5);
  const rTalon = Math.max(1.7, (dbTalon / 100) * sc * 0.5);
  const rDist = Math.max(1.6, (dbDist / 100) * sc * 0.5);
  const bendAlma = Math.max(8, 6 * (dbAlma / 100) * sc);
  const bendIntra = Math.max(7, 6 * (dbIntra / 100) * sc);
  const hookAlma = Math.max(22, 12 * (dbAlma / 100) * sc);
  const hookIntra = Math.max(20, 12 * (dbIntra / 100) * sc);
  const hookPata = Math.max(20, 12 * (dbPata / 100) * sc);
  const hookTalon = Math.max(20, 12 * (dbTalon / 100) * sc);

  const pTopF = xy(xTopF, H);
  const pTopB = xy(xTopB, H);
  const pBaseF = xy(xStemF, e);
  const pBaseB = xy(xStemB, e);
  const pP = xy(0, e);
  const pH = xy(B, e);
  const pP0 = xy(0, 0);
  const pH0 = xy(B, 0);
  const pSF0 = xy(xStemF, 0);
  const pSB0 = xy(xStemB, 0);

  const thF = Math.atan2(pTopF.x - pBaseF.x, pBaseF.y - pTopF.y);
  const thB = Math.atan2(pBaseB.x - pTopB.x, pBaseB.y - pTopB.y);
  const inF = recS / Math.max(Math.cos(thF), 0.72) + rIntra;
  const inB = recS / Math.max(Math.cos(thB), 0.72) + rAlma;
  const inFTemp = inF + rIntra + rTemp + Math.max(2.2, sc * 0.008);
  const inBTemp = inB + rAlma + rTemp + Math.max(2.2, sc * 0.008);

  const front = (t: number) => xyAt(pTopF.x + inF, pTopF.y + recS + rIntra, pBaseF.x + inF, pBaseF.y + recZ + rIntra, t);
  const back = (t: number) => xyAt(pTopB.x - inB, pTopB.y + recS + rAlma, pBaseB.x - inB, pBaseB.y + recZ + rAlma, t);
  const frontT = (t: number) => xyAt(pTopF.x + inFTemp, pTopF.y + recS + rTemp, pBaseF.x + inFTemp, pBaseF.y - recZ * 0.2, t);
  const backT = (t: number) => xyAt(pTopB.x - inBTemp, pTopB.y + recS + rTemp, pBaseB.x - inBTemp, pBaseB.y - recZ * 0.2, t);

  const topBack = back(0.02);
  const topFront = front(0.02);
  const ySoffit = xy(0, 0).y;
  const yBotMat = ySoffit - recZ - rPata;
  const yTopMat = pP.y + recZ + rDist;
  const intoBackBot: SteelBarPt = { x: pBaseB.x - inB, y: yBotMat };
  const intoFrontBot: SteelBarPt = { x: pBaseF.x + inF, y: yBotMat };
  const pathAlma = appendHook90(
    [topBack, { x: pBaseB.x - inB, y: pBaseB.y + recZ * 0.2 }],
    intoBackBot,
    "right",
    bendAlma,
    hookAlma,
  );
  const pathIntra = appendHook90(
    [topFront, { x: pBaseF.x + inF, y: pBaseF.y + recZ * 0.2 }],
    intoFrontBot,
    "left",
    bendIntra,
    hookIntra,
  );

  const xFootL = pP0.x + recZ + rPata;
  const xFootR = pH0.x - recZ - rTalon;
  const hookFoot = Math.min(Math.max(hookPata, hookTalon), Math.max(14, e * sc - 2 * recZ - rPata * 2));
  const pathFootBot = pathBothHooks90(
    { x: xFootL, y: yBotMat },
    { x: xFootR, y: yBotMat },
    "up",
    "up",
    Math.max(6, 6 * (dbPata / 100) * sc),
    hookFoot,
  );
  const pathFootTop = pathBothHooks90(
    { x: xFootL, y: yTopMat },
    { x: xFootR, y: yTopMat },
    "down",
    "down",
    Math.max(6, 6 * (dbDist / 100) * sc),
    hookFoot,
  );

  const coverPts: SteelBarPt[] = [
    { x: pTopF.x + recS, y: pTopF.y + recS },
    { x: pTopB.x - recS, y: pTopB.y + recS },
    { x: pBaseB.x - recS, y: pBaseB.y + recZ },
    { x: pH.x - recZ, y: pH.y + recZ },
    { x: pH0.x - recZ, y: pH0.y - recZ },
  ];
  if (hkUse > 0.02) {
    const kR0 = xy(xKeyR, 0);
    const kRb = xy(xKeyR, -hkUse);
    const kLb = xy(xKeyL, -hkUse);
    const kL0 = xy(xKeyL, 0);
    coverPts.push(
      { x: kR0.x - recZ, y: kR0.y - recZ },
      { x: kRb.x - recZ, y: kRb.y - recZ },
      { x: kLb.x + recZ, y: kLb.y - recZ },
      { x: kL0.x + recZ, y: kL0.y - recZ },
    );
  }
  coverPts.push(
    { x: pP0.x + recZ, y: pP0.y - recZ },
    { x: pP.x + recZ, y: pP.y + recZ },
    { x: pBaseF.x + recS, y: pBaseF.y + recZ },
  );

  const hFill = Math.tan((beta * Math.PI) / 180) * A;
  const yFillM = Math.min(H - 0.2, e + Math.max(0.18, hFill));
  const tFill = Math.min(0.88, Math.max(0.06, (yFillM - e) / Math.max(H - e, 0.2)));
  const pFillEnd = xy(B, yFillM);
  const pFillStem = xyAt(pTopB.x, pTopB.y, pBaseB.x, pBaseB.y, 1 - tFill);
  const yKeyBot = xy(0, -hkUse).y;
  const pD0 = xy(0, Math.min(Math.max(D, e + 0.08), H));
  const pDs = xy(xStemF, Math.min(Math.max(D, e + 0.08), H));
  const soil = `${pBaseB.x},${pBaseB.y} ${pH.x},${pH.y} ${pFillEnd.x},${pFillEnd.y} ${pFillStem.x},${pFillStem.y}`;
  const soilFront = `${pP0.x - 28},${pD0.y} ${pDs.x},${pDs.y} ${pBaseF.x},${pBaseF.y} ${pP.x},${pP.y} ${pP0.x},${pP0.y} ${pP0.x},${yKeyBot} ${pP0.x - 28},${yKeyBot}`;

  const nAlma = nAlong(100, sAlma);
  const nIntra = nAlong(100, sIntra);
  const nPata = nAlong(100, sPata);
  const nTalon = nAlong(100, sTalon);
  const nDist = nAlong(100, sDist);
  const nTempDraw = nDraw(nAlong(Math.max(H - e, 0.5) * 100, sTemp), 11);
  const tempFront = placeLine(frontT(0.06).x, frontT(0.06).y, frontT(0.9).x, frontT(0.9).y, nTempDraw);
  const tempBack = placeLine(backT(0.1).x, backT(0.1).y, backT(0.88).x, backT(0.88).y, Math.max(2, nTempDraw - 1));
  const nFootT = nDraw(nAlong(B * 100, sDist), 11);
  const transGap = Math.max(5.2, rDist * 2.2);
  const transTop = placeLine(xFootL + 14, yTopMat + transGap, xFootR - 14, yTopMat + transGap, nFootT);
  const transBot = placeLine(xFootL + 14, yBotMat - transGap, xFootR - 14, yBotMat - transGap, nFootT);
  const fyS = nv(values, "fy", 4200);
  const fcS = nv(values, "fc", 210);
  const ldAlma = steelLdCm(fyS, fcS, dbAlma);
  const ldIntra = steelLdCm(fyS, fcS, dbIntra);
  const ldPata = steelLdCm(fyS, fcS, dbPata);
  const ldTalon = steelLdCm(fyS, fcS, dbTalon);
  const ldTemp = steelLdCm(fyS, fcS, dbTemp);
  const asAlmaReq = nv(values, "AsAlma", asProvCm2m(barByName(barAlma).as, sAlma));
  const asIntraReq = nv(values, "AsIntra", asProvCm2m(barByName(barIntraN).as, sIntra));
  const asPataReq = nv(values, "AsPata", asProvCm2m(barByName(barPata).as, sPata));
  const asTalonReq = nv(values, "AsTalon", asProvCm2m(barByName(barTalon).as, sTalon));
  const asTempReq = nv(values, "AsTemp", asProvCm2m(barByName(barTemp).as, sTemp));
  const asDistReq = nv(values, "AsDist", asProvCm2m(barByName(barDistN).as, sDist));

  const temp: SteelLayer = {
    ...layerFromBar({
      mark: 3,
      name: "Temperatura / horiz.",
      face: "ambas caras del fuste",
      barName: barTemp,
      sCm: sTemp,
      lengthCm: Math.max(H - e, 0.5) * 100,
      color: TEMP,
      side: "left",
      a: tempFront[0],
      b: tempFront[tempFront.length - 1],
      maxDraw: nTempDraw,
    }),
    bars: [...tempFront, ...tempBack],
    draw: "dots",
    attach: tempFront[Math.min(6, tempFront.length - 1)] ?? tempFront[0],
      callout: calloutBeside(tempFront[Math.min(6, tempFront.length - 1)] ?? tempFront[0], "left", 22),
    asReq: asTempReq,
    ldCm: ldTemp,
    recCm: rec,
  };

  const attachLong = back(0.26);
  const attachIntra = front(0.26);
  const layers: SteelLayer[] = [
    {
      mark: 1,
      name: "Longitudinal trasdós",
      face: "trasdós · penetra y se apoya en lecho inf.",
      bar: barByName(barAlma).name,
      dbCm: dbAlma,
      sCm: sAlma,
      nReal: nAlma,
      asProv: asProvCm2m(barByName(barAlma).as, sAlma),
      asUnit: "cm²/m",
      asReq: asAlmaReq,
      ldCm: ldAlma,
      recCm: rec,
      color: FLEX,
      side: "right",
      draw: "bar",
      bars: [attachLong],
      barPath: pathAlma,
      barPaths: [pathAlma],
      attach: attachLong,
      callout: calloutBeside(attachLong, "right", 20),
    },
    {
      mark: 2,
      name: "Longitudinal intradós",
      face: "intradós · penetra y se apoya en lecho inf.",
      bar: barByName(barIntraN).name,
      dbCm: dbIntra,
      sCm: sIntra,
      nReal: nIntra,
      asProv: asProvCm2m(barByName(barIntraN).as, sIntra),
      asUnit: "cm²/m",
      asReq: asIntraReq,
      ldCm: ldIntra,
      recCm: rec,
      color: DIST,
      side: "left",
      draw: "bar",
      bars: [attachIntra],
      barPath: pathIntra,
      barPaths: [pathIntra],
      attach: attachIntra,
      callout: calloutBeside(attachIntra, "left", 20),
    },
    temp,
    {
      mark: 4,
      name: "Zapata lecho inferior",
      face: "continuo puntera–talón, ⊥ al alma",
      bar: barByName(barPata).name,
      dbCm: dbPata,
      sCm: sPata,
      nReal: nPata,
      asProv: asProvCm2m(barByName(barPata).as, sPata),
      asUnit: "cm²/m",
      asReq: asPataReq,
      ldCm: ldPata,
      recCm: recZap,
      color: FLEX,
      side: "left",
      draw: "bar",
      bars: [{ x: (xFootL + xFootR) / 2, y: yBotMat }],
      barPath: pathFootBot,
      attach: { x: xFootL + 12, y: yBotMat },
      callout: calloutBeside({ x: xFootL + 8, y: yBotMat }, "left", 22),
    },
    {
      mark: 5,
      name: "Zapata lecho superior",
      face: "continuo puntera–talón, ⊥ al alma",
      bar: barByName(barDistN).name,
      dbCm: dbDist,
      sCm: sDist,
      nReal: nDist,
      asProv: asProvCm2m(barByName(barDistN).as, sDist),
      asUnit: "cm²/m",
      asReq: asDistReq,
      ldCm: steelLdCm(fyS, fcS, dbDist),
      recCm: recZap,
      color: DIST,
      side: "left",
      draw: "bar",
      bars: [{ x: (xFootL + xFootR) / 2, y: yTopMat }],
      barPath: pathFootTop,
      attach: { x: xFootR - 28, y: yTopMat },
      callout: { x: xFootR - 12, y: yTopMat - 58, anchor: "end" },
    },
    {
      mark: 6,
      name: "Transversal de zapata",
      face: "⊥ a la franja, lechos inf. y sup.",
      bar: barByName(barTalon).name,
      dbCm: dbTalon,
      sCm: sTalon,
      nReal: nTalon,
      asProv: asProvCm2m(barByName(barTalon).as, sTalon),
      asUnit: "cm²/m",
      asReq: asTalonReq,
      ldCm: ldTalon,
      recCm: recZap,
      color: FLEX,
      side: "right",
      draw: "dots",
      bars: [...transTop, ...transBot],
      attach: transTop[Math.floor(transTop.length * 0.82)] ?? transTop[0],
      callout: { x: xFootR + 18, y: (yTopMat + yBotMat) / 2, anchor: "start" },
    },
  ];
  if (hkUse > 0.02) {
    const dbKey = barByName(sv(values, "barLlave", barPata)).db;
    const rKey = Math.max(1.7, (dbKey / 100) * sc * 0.5);
    const recK = recZ + rKey;
    const kLbot = xy(xKeyL, -hkUse);
    const kRbot = xy(xKeyR, -hkUse);
    const sKey = nv(values, "sLlave", sPata);
    const ldKeyPx = Math.min(
      (steelLdCm(fyS, fcS, dbKey) / 100) * sc,
      Math.max(0.4, (H - e) * 0.2) * sc,
    );
    const xFaceL = kLbot.x + recK;
    const xFaceR = kRbot.x - recK;
    const yKeyBotSteel = kLbot.y - recK;
    const gapBar = Math.max(11, rIntra + rKey + sc * 0.03);
    const xMidKey = (xFaceL + xFaceR) / 2;
    let xInnerKey = Math.min(xFaceR, pBaseB.x - inB - gapBar);
    const sepKey = rKey * 2 + rTemp * 2 + Math.max(6, sc * 0.022);
    if (xInnerKey - xFaceL < sepKey) xInnerKey = xFaceL + sepKey;
    const xStemIntraAt = (y: number) => {
      const yA = pTopF.y + recS + rIntra;
      const yB = pBaseF.y;
      const t = (y - yA) / Math.max(yB - yA, 1);
      return pTopF.x + inF + Math.max(0, Math.min(1, t)) * (pBaseF.x - pTopF.x);
    };
    const yDowelTop = Math.max(pBaseF.y - ldKeyPx, pTopF.y + recS + 28);
    const xDowelTop = xStemIntraAt(yDowelTop) + gapBar;
    const xDowelBase = xStemIntraAt(pBaseF.y) + gapBar;
    const yInnerHook = yBotMat - (rPata + rKey + Math.max(3.2, sc * 0.012));
    const bendKey = Math.max(7, 6 * (dbKey / 100) * sc);
    const hookKeyBot = Math.min(recK * 2.1, Math.max(10, (xInnerKey - xFaceL) * 0.28));
    const hookKeyFoot = Math.min(hookTalon, Math.max(16, e * sc * 0.38), A * sc * 0.26);
    const pathKeySoil = pathWithEndHook(
      [
        { x: xDowelTop, y: yDowelTop },
        { x: xDowelBase, y: pBaseF.y + recZ * 0.15 },
        { x: xFaceL, y: ySoffit - 2 },
        { x: xFaceL, y: yKeyBotSteel },
      ],
      "right",
      bendKey,
      hookKeyBot,
    );
    const pathKeyBend = pathWithEndHook(
      [
        { x: xInnerKey, y: yKeyBotSteel },
        { x: xInnerKey, y: yInnerHook },
      ],
      "right",
      bendKey,
      hookKeyFoot,
    );
    const insetDot = rKey + rTemp + Math.max(2.8, sc * 0.012);
    const xDotL = xFaceL + insetDot;
    const xDotR = xInnerKey - insetDot;
    const yDotBot = yKeyBotSteel - insetDot;
    const yDotTop = ySoffit - recK;
    const yDotMid = (yDotBot + yDotTop) / 2;
    const transKey =
      xDotR > xDotL + 2
        ? [
            { x: xDotL, y: yDotBot },
            { x: xDotR, y: yDotBot },
            { x: xDotL, y: yDotMid },
            { x: xDotR, y: yDotMid },
            { x: xDotL, y: yDotTop },
            { x: xDotR, y: yDotTop },
          ]
        : placeLine(xMidKey, yDotBot, xMidKey, yDotTop, 3);
    layers.push(
      {
        mark: 7,
        name: "Dentellón cara suelo",
        face: "pasivo · dowel al alma (capa interior)",
        bar: barByName(sv(values, "barLlave", barPata)).name,
        dbCm: dbKey,
        sCm: sKey,
        nReal: nAlong(100, sKey),
        asProv: asProvCm2m(barByName(sv(values, "barLlave", barPata)).as, sKey),
        asUnit: "cm²/m",
        asReq: nv(values, "AsLlave", asProvCm2m(barByName(sv(values, "barLlave", barPata)).as, sKey)),
        ldCm: steelLdCm(fyS, fcS, dbKey),
        recCm: recZap,
        color: FLEX,
        side: "right",
        draw: "bar",
        bars: [pathKeySoil[0]],
        barPath: pathKeySoil,
        barPaths: [pathKeySoil],
        attach: { x: xDowelBase, y: (yDowelTop + pBaseF.y) / 2 },
        callout: calloutBeside({ x: xDowelBase, y: (yDowelTop + pBaseF.y) / 2 }, "right", 22),
      },
      {
        mark: 8,
        name: "Dentellón con doblez",
        face: "cara interior · gancho 90° en zapata",
        bar: barByName(sv(values, "barLlave", barPata)).name,
        dbCm: dbKey,
        sCm: sKey,
        nReal: nAlong(100, sKey),
        asProv: asProvCm2m(barByName(sv(values, "barLlave", barPata)).as, sKey),
        asUnit: "cm²/m",
        asReq: nv(values, "AsLlave", asProvCm2m(barByName(sv(values, "barLlave", barPata)).as, sKey)),
        ldCm: steelLdCm(fyS, fcS, dbKey),
        recCm: recZap,
        color: DIST,
        side: "right",
        draw: "bar",
        bars: [pathKeyBend[0]],
        barPath: pathKeyBend,
        attach: { x: xInnerKey, y: (yKeyBotSteel + yInnerHook) / 2 },
        callout: calloutBeside({ x: xInnerKey, y: (yKeyBotSteel + yInnerHook) / 2 }, "right", 20),
      },
      {
        mark: 9,
        name: "Longitudinal dentellón",
        face: "∥ al muro · jaula interior del taco",
        bar: barByName(barTemp).name,
        dbCm: dbTemp,
        sCm: sTemp,
        nReal: nAlong(Math.max(bkUse, 0.25) * 100, sTemp),
        asProv: asProvCm2m(barByName(barTemp).as, sTemp),
        asUnit: "cm²/m",
        asReq: asTempReq,
        ldCm: ldTemp,
        recCm: recZap,
        color: TEMP,
        side: "left",
        draw: "dots",
        bars: transKey,
        attach: transKey[Math.floor(transKey.length / 2)] ?? transKey[0],
        callout: { x: xFaceL - 18, y: yKeyBotSteel + 8, anchor: "end" },
      },
    );
  }

  const yDim = ySoffit + 56 + (hkUse > 0.02 ? hkUse * sc + 10 : 0);
  const xHdim = pP0.x - 40;
  const dims: SteelDim[] = [
    { x1: pP0.x, y1: yDim, x2: pSF0.x, y2: yDim, label: `C = ${C.toFixed(2)} m`, side: "bottom" },
    { x1: pSF0.x, y1: yDim, x2: pSB0.x, y2: yDim, label: `F = ${F.toFixed(2)} m`, side: "top" },
    { x1: pSB0.x, y1: yDim, x2: pH0.x, y2: yDim, label: `A = ${A.toFixed(2)} m`, side: "bottom" },
    { x1: xHdim, y1: pTopF.y, x2: xHdim, y2: pP0.y, label: `H = ${H.toFixed(2)} m`, side: "left" },
    { x1: pH.x + 38, y1: pH.y, x2: pH.x + 38, y2: pH0.y, label: `e = ${e.toFixed(2)} m`, side: "right" },
    { x1: pTopF.x, y1: pTopF.y - 28, x2: pTopB.x, y2: pTopB.y - 28, label: `B′ = ${g.Bp.toFixed(2)} m`, side: "top" },
  ];
  if (hkUse > 0.02) {
    const kR = xy(xKeyR, 0);
    const kRb = xy(xKeyR, -hkUse);
    dims.push({ x1: kR.x + 28, y1: kRb.y, x2: kR.x + 28, y2: kR.y, label: `hk = ${hkUse.toFixed(2)} m`, side: "right" });
  }

  const annos: SteelAnno[] = [
    { x: (pTopF.x + pTopB.x) / 2, y: pTopF.y + 20, text: "Corona", anchor: "middle", fill: "#1a4473" },
    { x: front(0.42).x - 22, y: front(0.42).y, text: "Intradós", anchor: "end", fill: "#5a4a28" },
    { x: back(0.42).x + 24, y: back(0.42).y, text: "Trasdós", anchor: "start", fill: "#5a4a28" },
    { x: (pP.x + pBaseF.x) / 2, y: pP.y - 16, text: "Puntera", anchor: "middle", fill: "#1a4473" },
    { x: (pBaseB.x + pH.x) / 2, y: pH.y - 16, text: "Cimentación", anchor: "middle", fill: "#1a4473" },
  ];
  if (hkUse > 0.02) {
    const kC = xy((xKeyL + xKeyR) / 2, -hkUse * 0.5);
    annos.push({ x: kC.x, y: kC.y + 5, text: "Dentellón", anchor: "middle", fill: "#8b1e1e" });
  }

  return {
    title: "Corte de sección — despiece de aceros",
    subtitle: "Muro en voladizo · corte A-A · franja de 1,00 m · una marca por lecho",
    caption: `Trasdós Ø ${barAlma} @ ${sAlma.toFixed(0)} · Intradós Ø ${barIntraN} @ ${sIntra.toFixed(0)} · Zapata inf. Ø ${barPata} @ ${sPata.toFixed(0)} · Zapata sup. Ø ${barDistN} @ ${sDist.toFixed(0)} · Transv. zapata Ø ${barTalon} @ ${sTalon.toFixed(0)} · Temp. Ø ${barTemp} @ ${sTemp.toFixed(0)}${hkUse > 0.02 ? ` · Dentellón ${bkUse.toFixed(2)}×${hkUse.toFixed(2)} m` : ""}`,
    note: "Los dos verticales del alma penetran la zapata y se apoyan en el lecho inferior con gancho 90°. El taco lleva armadura propia: la cara de suelo entra al alma por una capa interior (sin coincidir con el intradós) y la cara interior se queda en la zapata con gancho 90°. Longitudinales del dentellón en corte, dentro del recubrimiento y desfasados de los verticales. hk típico 0,30–0,60 m.",
    W,
    H: Ht,
    outline,
    cover: ptsStr(coverPts),
    soil,
    soilFront,
    groundY: yKeyBot,
    barScale,
    pxPerM: sc,
    sheet: "a1",
    dims,
    layers,
    annos,
  };
}

/** Sección rectangular de viga: lecho de tracción, montantes y estribo. */
export function specVigaRect(values: Record<string, string>): SteelDraftSpec {
  const b = nv(values, "b", 25);
  const h = nv(values, "h", 50);
  const rec = nv(values, "rec", 5);
  const nLong = Math.max(2, Math.round(nv(values, "nLong", 3)));
  const barLong = sv(values, "barLong", '1/2"');
  const barEst = sv(values, "barEst", '3/8"');
  const dest = nv(values, "dest", barByName(barEst).db);
  const asLong = sv(values, "asLong", "");
  const W = 640;
  const Ht = 360;
  const sc = Math.min(5.2, 220 / Math.max(h, 20), 180 / Math.max(b, 15));
  const w = b * sc;
  const ht = h * sc;
  const sx = 150;
  const sy = 48;
  const recPx = rec * sc;
  const destPx = dest * sc;
  const rLong = barRadius(barByName(barLong).db, sc);
  const off = recPx + destPx + rLong;
  const inf = placeLine(sx + off, sy + ht - off, sx + w - off, sy + ht - off, nLong);
  const sup = placeLine(sx + off, sy + off, sx + w - off, sy + off, 2);
  const bar = barByName(barLong);
  const est = barByName(barEst);

  const layers: SteelLayer[] = [
    {
      mark: 1,
      name: "Lecho de tracción",
      face: "inferior",
      bar: bar.name,
      dbCm: bar.db,
      sCm: nLong > 1 ? (b - 2 * rec - dest) / (nLong - 1) : b,
      nReal: nLong,
      asProv: nLong * bar.as,
      asUnit: "cm²",
      color: FLEX,
      side: "bottom",
      bars: inf,
    },
    {
      mark: 2,
      name: "Montantes / compresión",
      face: "superior",
      bar: bar.name,
      dbCm: bar.db,
      sCm: b - 2 * rec,
      nReal: 2,
      asProv: 2 * bar.as,
      asUnit: "cm²",
      color: DIST,
      side: "top",
      bars: sup,
    },
    {
      mark: 3,
      name: "Estribo",
      face: "perímetro",
      bar: est.name,
      dbCm: est.db,
      sCm: nv(values, "sAd", nv(values, "sApoyo", 10)),
      nReal: 1,
      asProv: est.as,
      asUnit: "cm²",
      color: TEMP,
      side: "right",
      draw: "bar",
      bars: [{ x: sx + w - recPx - destPx / 2, y: sy + recPx + destPx / 2 }],
      barPath: closedStirrup(sx + recPx + destPx / 2, sy + recPx + destPx / 2, sx + w - recPx - destPx / 2, sy + ht - recPx - destPx / 2, Math.max(10, 6 * est.db * sc)),
    },
  ];

  const outline = `${sx},${sy} ${sx + w},${sy} ${sx + w},${sy + ht} ${sx},${sy + ht}`;
  const inner = recPx + destPx / 2;
  const cover = `${sx + inner},${sy + inner} ${sx + w - inner},${sy + inner} ${sx + w - inner},${sy + ht - inner} ${sx + inner},${sy + ht - inner}`;

  return {
    title: "Corte de sección — despiece de aceros",
    subtitle: `Viga ${b.toFixed(0)} × ${h.toFixed(0)} cm · una marca por lecho`,
    caption: `Tracción: ${nLong} Ø ${bar.name} (Ø=${bar.db.toFixed(2)} cm)${asLong ? ` · As = ${asLong}` : ""} · Estribos Ø ${est.name}`,
    note: "Lecho inferior = acero de flexión. Estribo = acero de corte. Recubrimiento y Ø dibujados a escala.",
    W,
    H: Ht,
    outline,
    cover,
    dims: [
      { x1: sx, y1: sy + ht + 16, x2: sx + w, y2: sy + ht + 16, label: `b = ${b.toFixed(0)} cm`, side: "bottom" },
      { x1: sx - 20, y1: sy, x2: sx - 20, y2: sy + ht, label: `h = ${h.toFixed(0)} cm`, side: "left" },
      { x1: sx + w + 12, y1: sy + ht - recPx, x2: sx + w + 12, y2: sy + ht, label: `r = ${rec.toFixed(1)} cm`, side: "right" },
    ],
    layers,
  };
}

/** Franja de 1,00 m (losa, zapata, muro de tanque): lechos inf./sup. */
export function specFranja1m(opts: {
  title: string;
  hCm: number;
  recCm: number;
  infText: string;
  supText?: string;
  distText?: string;
  infName?: string;
  infFace?: string;
  supName?: string;
  supFace?: string;
  distName?: string;
  distFace?: string;
}): SteelDraftSpec {
  const inf = parseSteelText(opts.infText);
  const sup = opts.supText ? parseSteelText(opts.supText) : null;
  const dist = opts.distText ? parseSteelText(opts.distText) : null;
  const W = 640;
  const Ht = 300;
  const L = 100;
  const hCm = Math.max(opts.hCm, 6);
  const recCm = Math.min(opts.recCm, Math.max(1.5, hCm * 0.22));
  const scx = 360 / L;
  const scy = Math.min(4.2, 140 / Math.max(hCm, 8));
  const sx = 130;
  const sy = 56;
  const w = L * scx;
  const ht = hCm * scy;
  const recPx = recCm * scy;
  const rInf = barRadius(barByName(inf.bar).db, Math.max(scy, 2.2));
  const infBars = layerFromBar({
    mark: 1,
    name: opts.infName ?? "Lecho inferior",
    face: opts.infFace ?? "cara interior",
    barName: inf.bar,
    sCm: inf.s,
    lengthCm: L,
    color: FLEX,
    side: "bottom",
    a: { x: sx + recPx + rInf, y: sy + ht - recPx - rInf },
    b: { x: sx + w - recPx - rInf, y: sy + ht - recPx - rInf },
  });
  const layers: SteelLayer[] = [infBars];
  if (sup) {
    const rSup = barRadius(barByName(sup.bar).db, Math.max(scy, 2.2));
    layers.push(
      layerFromBar({
        mark: 2,
        name: opts.supName ?? "Lecho superior",
        face: opts.supFace ?? "cara exterior",
        barName: sup.bar,
        sCm: sup.s,
        lengthCm: L,
        color: TEMP,
        side: "top",
        a: { x: sx + recPx + rSup, y: sy + recPx + rSup },
        b: { x: sx + w - recPx - rSup, y: sy + recPx + rSup },
      }),
    );
  }
  if (dist) {
    const rD = barRadius(barByName(dist.bar).db, Math.max(scy, 2));
    layers.push(
      layerFromBar({
        mark: layers.length + 1,
        name: opts.distName ?? "Distribución / temp.",
        face: opts.distFace ?? "90° al principal",
        barName: dist.bar,
        sCm: dist.s,
        lengthCm: hCm,
        color: DIST,
        side: "right",
        a: { x: sx + w / 2, y: sy + recPx + rD },
        b: { x: sx + w / 2, y: sy + ht - recPx - rD },
        maxDraw: 5,
      }),
    );
  }
  return {
    title: "Corte de sección — despiece de aceros",
    subtitle: opts.title,
    caption: layers.map((l) => `${l.mark} Ø ${l.bar} @ ${l.sCm.toFixed(0)} cm`).join("  ·  "),
    note: "Franja de 1,00 m. Una marca por lecho. Los círculos son barras cortadas por el plano de la sección.",
    footer: "Franja de 1,00 m · recubrimiento y Ø dibujados a escala",
    W,
    H: Ht,
    outline: `${sx},${sy} ${sx + w},${sy} ${sx + w},${sy + ht} ${sx},${sy + ht}`,
    cover: `${sx + recPx},${sy + recPx} ${sx + w - recPx},${sy + recPx} ${sx + w - recPx},${sy + ht - recPx} ${sx + recPx},${sy + ht - recPx}`,
    dims: [
      { x1: sx, y1: sy + ht + 16, x2: sx + w, y2: sy + ht + 16, label: "1,00 m", side: "bottom" },
      { x1: sx - 18, y1: sy, x2: sx - 18, y2: sy + ht, label: `h = ${hCm.toFixed(1)} cm`, side: "left" },
    ],
    layers,
  };
}

function closedStirrup(x0: number, y0: number, x1: number, y1: number, hook: number): SteelBarPt[] {
  const hk = Math.min(hook, Math.abs(x1 - x0) * 0.35, Math.abs(y1 - y0) * 0.35);
  return [
    { x: x1 - hk, y: y1 },
    { x: x1, y: y1 },
    { x: x1, y: y0 },
    { x: x0, y: y0 },
    { x: x0, y: y1 },
    { x: x1, y: y1 },
    { x: x1, y: y1 - hk },
  ];
}

function circlePoly(cx: number, cy: number, r: number, n = 48) {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

function parseNBar(text: string, fbN = 6, fbBar = '5/8"') {
  const raw = String(text || "");
  const nMatch = raw.match(/(\d+)\s*Ø/i) ?? raw.match(/(\d+)\s*ø/i);
  const parsed = parseSteelText(raw.includes("Ø") || raw.includes("ø") ? raw : `Ø ${raw}`);
  return { n: nMatch ? Math.max(4, Number(nMatch[1])) : fbN, bar: parsed.bar || fbBar };
}

/** Cáscara de 1,00 m (cúpula o cono): lechos intradós y extradós. */
export function specCascaron1m(opts: {
  title: string;
  hCm: number;
  recCm: number;
  intraText: string;
  extraText: string;
  distText?: string;
}): SteelDraftSpec {
  const spec = specFranja1m({
    title: opts.title,
    hCm: opts.hCm,
    recCm: opts.recCm,
    infText: opts.intraText,
    supText: opts.extraText,
    distText: opts.distText,
    infName: "Meridional intradós",
    infFace: "cara del líquido",
    supName: "Meridional extradós",
    supFace: "cara exterior",
    distName: "Anillo / paralelo",
    distFace: "90° al meridiano",
  });
  return {
    ...spec,
    note: "Franja meridional de 1,00 m. Intradós (cara del líquido) e extradós. Los círculos son barras cortadas por el plano de la sección.",
    footer: "Cáscara · intradós / extradós · recubrimiento y Ø a escala",
  };
}

/** Viga anillo / collarín: sección rectangular con longitudinales perimetrales y estribo cerrado. */
export function specAnilloViga(opts: {
  title: string;
  bCm: number;
  hCm: number;
  recCm: number;
  longText: string;
  estText?: string;
}): SteelDraftSpec {
  const parsed = parseNBar(opts.longText, 6, parseSteelText(opts.longText.includes("Ø") ? opts.longText : `Ø ${opts.longText}`).bar);
  const est = parseSteelText(opts.estText ?? 'Ø 3/8" @ 15');
  const b = Math.max(16, opts.bCm);
  const h = Math.max(16, opts.hCm);
  const rec = Math.min(opts.recCm, Math.max(2, Math.min(b, h) * 0.22));
  const W = 640;
  const Ht = 360;
  const sc = Math.min(5.2, 220 / Math.max(h, 20), 180 / Math.max(b, 15));
  const w = b * sc;
  const ht = h * sc;
  const sx = 150;
  const sy = 48;
  const recPx = rec * sc;
  const dest = barByName(est.bar).db;
  const destPx = dest * sc;
  const bar = barByName(parsed.bar);
  const rLong = barRadius(bar.db, sc);
  const off = recPx + destPx + rLong;
  const n = Math.max(4, parsed.n);
  const nSide = n >= 8 ? 2 : n >= 6 ? 1 : 0;
  const remain = Math.max(4, n - 2 * nSide);
  const nBot = Math.ceil(remain / 2);
  const nTop = remain - nBot;
  const inf = placeLine(sx + off, sy + ht - off, sx + w - off, sy + ht - off, nBot);
  const sup = placeLine(sx + off, sy + off, sx + w - off, sy + off, Math.max(2, nTop));
  const left = nSide ? placeLine(sx + off, sy + off + (ht - 2 * off) * 0.28, sx + off, sy + ht - off - (ht - 2 * off) * 0.28, nSide) : [];
  const right = nSide ? placeLine(sx + w - off, sy + off + (ht - 2 * off) * 0.28, sx + w - off, sy + ht - off - (ht - 2 * off) * 0.28, nSide) : [];
  const longs = [...inf, ...sup, ...left, ...right];
  const ix = sx + recPx + destPx / 2;
  const iy = sy + recPx + destPx / 2;
  const jx = sx + w - recPx - destPx / 2;
  const jy = sy + ht - recPx - destPx / 2;
  const layers: SteelLayer[] = [
    {
      mark: 1,
      name: "Longitudinales",
      face: "perímetro del anillo",
      bar: bar.name,
      dbCm: bar.db,
      sCm: n > 1 ? (2 * (b + h) - 8 * rec) / n : b,
      nReal: n,
      asProv: n * bar.as,
      asUnit: "cm²",
      color: FLEX,
      side: "bottom",
      bars: longs,
    },
    {
      mark: 2,
      name: "Estribo cerrado",
      face: "confinamiento",
      bar: est.bar,
      dbCm: dest,
      sCm: est.s,
      nReal: 1,
      asProv: barByName(est.bar).as,
      asUnit: "cm²",
      color: TEMP,
      side: "right",
      draw: "bar",
      bars: [{ x: jx, y: iy }],
      barPath: closedStirrup(ix, iy, jx, jy, Math.max(10, 6 * dest * sc)),
    },
  ];
  const outline = `${sx},${sy} ${sx + w},${sy} ${sx + w},${sy + ht} ${sx},${sy + ht}`;
  const inner = recPx + destPx / 2;
  const cover = `${sx + inner},${sy + inner} ${sx + w - inner},${sy + inner} ${sx + w - inner},${sy + ht - inner} ${sx + inner},${sy + ht - inner}`;
  return {
    title: "Corte de sección — despiece de aceros",
    subtitle: `${opts.title} · ${b.toFixed(0)} × ${h.toFixed(0)} cm`,
    caption: `${n} Ø ${bar.name}  ·  estribos Ø ${est.bar} @ ${est.s.toFixed(0)} cm`,
    note: "Anillo a tracción de aro: longitudinales en el perímetro y estribo cerrado. Recubrimiento y Ø a escala.",
    footer: "Viga anillo · estribo cerrado · recubrimiento y Ø a escala",
    W,
    H: Ht,
    outline,
    cover,
    dims: [
      { x1: sx, y1: sy + ht + 16, x2: sx + w, y2: sy + ht + 16, label: `b = ${b.toFixed(0)} cm`, side: "bottom" },
      { x1: sx - 20, y1: sy, x2: sx - 20, y2: sy + ht, label: `h = ${h.toFixed(0)} cm`, side: "left" },
      { x1: sx + w + 12, y1: sy + ht - recPx, x2: sx + w + 12, y2: sy + ht, label: `r = ${rec.toFixed(1)} cm`, side: "right" },
    ],
    layers,
  };
}

/** Columna circular: longitudinales en el perímetro y estribo circular. */
export function specColumnaCircular(opts: {
  title: string;
  dCm: number;
  recCm: number;
  nLong: number;
  barLong: string;
  barEst: string;
  sEstCm: number;
}): SteelDraftSpec {
  const W = 560;
  const Ht = 420;
  const d = Math.max(20, opts.dCm);
  const rec = opts.recCm;
  const sc = Math.min(6.4, 220 / d);
  const r = (d / 2) * sc;
  const cx = 250;
  const cy = 190;
  const recPx = rec * sc;
  const bar = barByName(opts.barLong);
  const est = barByName(opts.barEst);
  const rBar = r - recPx - barRadius(bar.db, sc) - est.db * sc * 0.4;
  const n = Math.max(6, opts.nLong);
  const nShow = nDraw(n, 16);
  const longs = Array.from({ length: nShow }, (_, i) => {
    const a = (2 * Math.PI * i) / nShow - Math.PI / 2;
    return { x: cx + rBar * Math.cos(a), y: cy + rBar * Math.sin(a) };
  });
  const rEst = r - recPx - (est.db * sc) / 2;
  const estPath = Array.from({ length: 36 }, (_, i) => {
    const a = (2 * Math.PI * i) / 35 - Math.PI / 2;
    return { x: cx + rEst * Math.cos(a), y: cy + rEst * Math.sin(a) };
  });
  const layers: SteelLayer[] = [
    {
      mark: 1,
      name: "Longitudinales",
      face: "perímetro",
      bar: bar.name,
      dbCm: bar.db,
      sCm: (Math.PI * (d - 2 * rec)) / n,
      nReal: n,
      asProv: n * bar.as,
      asUnit: "cm²",
      color: FLEX,
      side: "right",
      bars: longs,
    },
    {
      mark: 2,
      name: "Estribo circular",
      face: "confinamiento",
      bar: est.name,
      dbCm: est.db,
      sCm: opts.sEstCm,
      nReal: 1,
      asProv: est.as,
      asUnit: "cm²",
      color: TEMP,
      side: "left",
      draw: "bar",
      bars: [{ x: cx + rEst, y: cy }],
      barPath: estPath,
    },
  ];
  return {
    title: "Corte de sección — despiece de aceros",
    subtitle: opts.title,
    caption: `${n} Ø ${bar.name}  ·  estribos Ø ${est.name} @ ${opts.sEstCm.toFixed(0)} cm`,
    note: "Sección circular. Los círculos son las longitudinales cortadas por el plano; el estribo cierra el núcleo.",
    footer: "Columna circular · estribo perimetral · recubrimiento y Ø a escala",
    W,
    H: Ht,
    outline: circlePoly(cx, cy, r),
    cover: circlePoly(cx, cy, r - recPx),
    dims: [
      { x1: cx - r, y1: cy + r + 22, x2: cx + r, y2: cy + r + 22, label: `Ø = ${d.toFixed(0)} cm`, side: "bottom" },
      { x1: cx + r + 16, y1: cy - r, x2: cx + r + 16, y2: cy - r + recPx, label: `r = ${rec.toFixed(1)} cm`, side: "right" },
    ],
    layers,
  };
}

/** Pared del fuste (franja 1,00 m): verticales interior/exterior y horizontales. */
export function specFustePared(opts: {
  title: string;
  eCm: number;
  recCm: number;
  vertText: string;
  horText: string;
}): SteelDraftSpec {
  const spec = specFranja1m({
    title: opts.title,
    hCm: opts.eCm,
    recCm: opts.recCm,
    infText: opts.vertText,
    supText: opts.vertText,
    distText: opts.horText,
    infName: "Vertical interior",
    infFace: "cara interior",
    supName: "Vertical exterior",
    supFace: "cara exterior",
    distName: "Horizontal / anillo",
    distFace: "circunferencia del fuste",
  });
  return { ...spec, footer: "Fuste · dos capas verticales · anillo horizontal a escala" };
}

export function centroid(pts: SteelBarPt[]) {
  if (!pts.length) return { x: 0, y: 0 };
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}
