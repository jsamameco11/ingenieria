import { barByName } from "../../types";
import {
  nAlong,
  nDraw,
  pathBothHooks90,
  ptsStr,
  STEEL_FLEX,
  STEEL_TEMP,
  type SteelDraftSpec,
  type SteelLayer,
} from "../../steelDraft";
import { zapataPlantFromValues } from "./zapataDraw";
import { ldTension } from "./steel";

function nv(v: Record<string, string>, k: string, fb = 0) {
  const s = String(v[k] ?? "").trim().replace(",", ".");
  if (s === "") return fb;
  const x = Number(s);
  return Number.isFinite(x) ? x : fb;
}

function sv(v: Record<string, string>, k: string, fb = "") {
  return String(v[k] ?? "").trim() || fb;
}

function parseBar(text: string, fallback = '1/2"') {
  const m = String(text || "").match(/Ø\s*([^@·]+)/i);
  const s = String(text || "").match(/@\s*([\d.,]+)/);
  const bar = (m?.[1] ?? fallback).replace(/inf\.|sup\.|cm.*/gi, "").trim() || fallback;
  const sp = parseFloat((s?.[1] ?? "20").replace(",", "."));
  return { bar: barByName(bar).name, s: Number.isFinite(sp) && sp > 0 ? sp : 20, db: barByName(bar).db };
}

/** Radio de doblez profesional: proporcional al Ø pero acotado (no tubos). */
function bendR(dbCm: number, sc: number) {
  const dbM = dbCm / 100;
  return Math.min(7.5, Math.max(3.2, 2.2 * dbM * sc));
}

/** Ramal de gancho 90° corto y bien escalado (≠ ganchos gigantes). */
function hookLen(dbCm: number, sc: number) {
  const dbM = dbCm / 100;
  return Math.min(15, Math.max(7, 5.5 * dbM * sc));
}

function layer(opts: {
  mark: number;
  name: string;
  face: string;
  bar: string;
  sCm: number;
  color: string;
  side: SteelLayer["side"];
  paths: { x: number; y: number }[][];
  dots?: { x: number; y: number }[];
  recCm: number;
  nReal: number;
  ldCm?: number;
  callout?: SteelLayer["callout"];
}): SteelLayer {
  const def = barByName(opts.bar);
  const path = opts.paths[0] ?? [];
  const attach = path[Math.floor(path.length / 2)] ?? opts.dots?.[Math.floor((opts.dots?.length ?? 1) / 2)] ?? { x: 0, y: 0 };
  return {
    mark: opts.mark,
    name: opts.name,
    face: opts.face,
    bar: def.name,
    dbCm: def.db,
    sCm: opts.sCm,
    nReal: opts.nReal,
    asProv: (def.as / Math.max(opts.sCm, 1e-6)) * 100,
    asUnit: "cm²/m",
    recCm: opts.recCm,
    ldCm: opts.ldCm,
    color: opts.color,
    side: opts.side,
    draw: opts.paths.length ? "bar" : "dots",
    bars: opts.paths.length ? [attach] : (opts.dots ?? [attach]),
    barPath: path.length > 1 ? path : undefined,
    barPaths: opts.paths.filter((p) => p.length > 1),
    attach,
    callout: opts.callout,
  };
}

/**
 * Motor dedicado SOLO al cuadro de despiece de la zapata corrida (planta A1).
 * Separado del resto de motores: dibuja únicamente lo que cae dentro del
 * concreto de la zapata — transversales + longitudinal inf. + longitudinal sup. —
 * con cajas de marca compactas ancladas DENTRO de la zapata (nada en márgenes),
 * ganchos 90° cortos y varilla fina profesional (lineScale).
 */
export function buildZapataCorridaDespieceSpec(values: Record<string, string>): SteelDraftSpec {
  const plant = zapataPlantFromValues(values);
  const rec = nv(values, "rec", 7.5);
  const hf = nv(values, "hf", 0.45);
  const tipo = sv(values, "tipo", "muro");

  // Transversal = flexión del vuelo (⊥ al eje). Claves: asPrin / asTrans / asTr.
  const transB = parseBar(
    sv(values, "asPrin", sv(values, "asTrans", sv(values, "asTr", sv(values, "asPata", 'Ø 1/2" @ 15 cm')))),
    '1/2"',
  );
  // Longitudinal inferior continuo (∥ al eje).
  const longB = parseBar(sv(values, "asLong", sv(values, "asDist", 'Ø 1/2" @ 20 cm')), '1/2"');
  // Longitudinal superior con cortes.
  const supL = parseBar(sv(values, "asSup", sv(values, "asLong", 'Ø 1/2" @ 20 cm')), '1/2"');

  const Lx = Math.max(plant.x1 - plant.x0, 0.8);
  const Ly = Math.max(plant.y1 - plant.y0, 0.6);
  const padL = 120;
  const padR = 150;
  const padT = 92;
  const padB = 96;
  const sc = Math.min(1120 / Lx, 620 / Ly);
  const W = Math.ceil(padL + Lx * sc + padR);
  const H = Math.ceil(padT + Ly * sc + padB);
  const xy = (x: number, y: number) => ({
    x: padL + (x - plant.x0) * sc,
    y: padT + (plant.y1 - y) * sc,
  });

  // Rectángulo de concreto en pantalla (para confinar etiquetas).
  const x0s = xy(plant.x0, plant.y0).x;
  const x1s = xy(plant.x1, plant.y0).x;
  const yTopS = xy(plant.x0, plant.y1).y;
  const yBotS = xy(plant.x0, plant.y0).y;
  const xMid = (x0s + x1s) / 2;
  const clampX = (x: number) => Math.min(x1s - 78, Math.max(x0s + 78, x));
  const clampY = (y: number) => Math.min(yBotS - 30, Math.max(yTopS + 30, y));

  const recM = rec / 100;
  const fy = nv(values, "fy", 4200);
  const fc = nv(values, "fc", 210);
  const ldTrans = ldTension(fy, fc, transB.db);
  const ldInf = ldTension(fy, fc, longB.db);
  const ldSup = ldTension(fy, fc, supL.db);

  const rT = bendR(transB.db, sc);
  const hT = hookLen(transB.db, sc);
  const rL = bendR(longB.db, sc);
  const hL = hookLen(longB.db, sc);
  const rS = bendR(supL.db, sc);
  const hS = hookLen(supL.db, sc);

  const regions = plant.cells.map((c) => ({
    points: ptsStr([xy(c.x0, c.y0), xy(c.x1, c.y0), xy(c.x1, c.y1), xy(c.x0, c.y1)]),
    fill: "#e8dcc0",
    stroke: "#163a63",
    hatch: true,
  }));
  for (const col of plant.cols) {
    const hx = col.t2 / 2;
    const hy = col.t1 / 2;
    regions.push({
      points: ptsStr([
        xy(col.x - hx, col.y - hy),
        xy(col.x + hx, col.y - hy),
        xy(col.x + hx, col.y + hy),
        xy(col.x - hx, col.y + hy),
      ]),
      fill: "#c5d4e6",
      stroke: "#1a4473",
      hatch: false,
    });
  }

  // ── 1 · Transversales inferiores (⊥ al eje, un juego por metro) ──
  const transPaths: { x: number; y: number }[][] = [];
  const nTransReal = nAlong(Lx * 100, transB.s);
  const nTransShow = Math.min(nDraw(nTransReal, 26), 26);
  const xA = plant.x0 + recM;
  const xB = plant.x1 - recM;
  const yT0 = plant.y0 + recM;
  const yT1 = plant.y1 - recM;
  for (let i = 0; i < nTransShow; i++) {
    const t = nTransShow === 1 ? 0.5 : i / (nTransShow - 1);
    const x = xA + t * Math.max(xB - xA, 0.1);
    const a = xy(x, yT0);
    const b = xy(x, yT1);
    // Gancho corto hacia la derecha en ambos bordes de B (peine limpio).
    transPaths.push(pathBothHooks90(a, b, "right", "right", rT, hT));
  }

  // ── 2 · Longitudinal inferior continuo (∥ al eje) ──
  const longPaths: { x: number; y: number }[][] = [];
  const spanY = Math.max(Ly - 2 * recM, 0.12);
  const nLongReal = nAlong(spanY * 100, longB.s);
  const nLongShow = Math.min(nDraw(nLongReal, 6), 6);
  const xlA = plant.x0 + recM;
  const xlB = plant.x1 - recM;
  for (let i = 0; i < nLongShow; i++) {
    const t = nLongShow === 1 ? 0.5 : i / (nLongShow - 1);
    // Banda inferior del lecho (para no tapar transversales del centro).
    const y = plant.y0 + recM + t * spanY * 0.42;
    const a = xy(xlA, y);
    const b = xy(xlB, y);
    longPaths.push(pathBothHooks90(a, b, "up", "up", rL, hL));
  }

  // ── 3 · Longitudinal superior con cortes (∥ al eje, L_teo + ℓd) ──
  const colsX = [...plant.cols].sort((a, b) => a.x - b.x);
  const longSupPaths: { x: number; y: number }[][] = [];
  const nSupLReal = nAlong(spanY * 100, supL.s);
  const nSupLShow = Math.min(nDraw(nSupLReal, 4), 4);
  const dCm = Math.max(hf * 100 - rec, 12);
  const bands: { x0: number; x1: number }[] = [];
  if (colsX.length >= 2) {
    for (let i = 0; i < colsX.length; i++) {
      const col = colsX[i];
      const lnL = i === 0 ? 0 : col.x - colsX[i - 1].x;
      const lnR = i === colsX.length - 1 ? 0 : colsX[i + 1].x - col.x;
      const ln = Math.max(lnL, lnR, 0.5);
      const Lteo = 0.3 * ln;
      // Lbarra = L_teo + ℓd (E.060 12.2), con extensión mínima d.
      const Lbar = Lteo + Math.max(ldSup / 100, dCm / 100);
      const left = i === 0;
      const right = i === colsX.length - 1;
      const xa = left ? plant.x0 + recM : Math.max(plant.x0 + recM, col.x - Lbar);
      const xb = right ? plant.x1 - recM : Math.min(plant.x1 - recM, col.x + Lbar);
      if (xb - xa >= 0.25) bands.push({ x0: xa, x1: xb });
    }
  } else {
    bands.push({ x0: plant.x0 + recM, x1: plant.x1 - recM });
  }
  for (const band of bands) {
    if (band.x1 - band.x0 < 0.25) continue;
    for (let i = 0; i < nSupLShow; i++) {
      const t = nSupLShow === 1 ? 0.5 : i / (nSupLShow - 1);
      // Banda superior del lecho.
      const y = plant.y1 - recM - t * spanY * 0.32;
      const a = xy(band.x0, y);
      const b = xy(band.x1, y);
      longSupPaths.push(pathBothHooks90(a, b, "down", "down", rS, hS));
    }
  }

  // Cajas de marca confinadas al concreto (nada en márgenes ni sobre el pie A1).
  const ySupBox = clampY(yTopS + 30);
  const yInfBox = clampY(yBotS - 30);
  const yTraBox = clampY((yTopS + yBotS) / 2);
  const layers: SteelLayer[] = [
    layer({
      mark: 1,
      name: "Transversal inf. (vuelo)",
      face: "⊥ al eje · lecho inferior · ganchos 90° en bordes de B",
      bar: transB.bar,
      sCm: transB.s,
      color: STEEL_FLEX,
      side: "top",
      paths: transPaths,
      recCm: rec,
      nReal: nTransReal,
      ldCm: ldTrans,
      callout: { x: clampX(x0s + Math.max(150, (x1s - x0s) * 0.22)), y: yTraBox, anchor: "middle" },
    }),
    layer({
      mark: 2,
      name: "Longitudinal inf. continuo",
      face: "∥ al eje · lecho inferior · extremo a extremo, sin corte",
      bar: longB.bar,
      sCm: longB.s,
      color: STEEL_TEMP,
      side: "bottom",
      paths: longPaths,
      recCm: rec,
      nReal: nLongReal,
      ldCm: ldInf,
      callout: { x: clampX(xMid), y: yInfBox, anchor: "middle" },
    }),
    layer({
      mark: 3,
      name: "Longitudinal sup. (cortes)",
      face: "∥ al eje · lecho superior · L_teo + ℓd en apoyos y extremos",
      bar: supL.bar,
      sCm: supL.s,
      color: "#5a4a28",
      side: "top",
      paths: longSupPaths,
      recCm: rec,
      nReal: nSupLReal,
      ldCm: ldSup,
      callout: { x: clampX(xMid), y: ySupBox, anchor: "middle" },
    }),
  ];

  const guides = [
    ...plant.cells.flatMap((c) => [
      { x1: xy(c.x0, plant.y0).x, y1: xy(c.x0, plant.y0).y, x2: xy(c.x0, plant.y1).x, y2: xy(c.x0, plant.y1).y, color: "#1a4473", dash: "5 4", width: 0.9 },
      { x1: xy(c.x1, plant.y0).x, y1: xy(c.x1, plant.y0).y, x2: xy(c.x1, plant.y1).x, y2: xy(c.x1, plant.y1).y, color: "#1a4473", dash: "5 4", width: 0.9 },
    ]),
    ...plant.beams.map((b) => ({
      x1: xy(b.x0, b.y0).x,
      y1: xy(b.x0, b.y0).y,
      x2: xy(b.x1, b.y1).x,
      y2: xy(b.x1, b.y1).y,
      color: "#163a63",
      dash: undefined as string | undefined,
      width: 2.2,
    })),
  ];

  const annos = [
    ...plant.cells.map((c) => {
      const p = xy((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2);
      return { x: p.x, y: p.y - 14, text: c.id, anchor: "middle" as const, fill: "#163a63" };
    }),
    ...plant.cols.map((c) => {
      const p = xy(c.x, c.y);
      return { x: p.x, y: p.y - Math.max(10, (c.t1 * sc) / 2 + 10), text: c.id, anchor: "middle" as const, fill: "#1a4473" };
    }),
    ...plant.beams.map((b) => {
      const p = xy((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
      return { x: p.x, y: p.y - 12, text: b.id, anchor: "middle" as const, fill: "#163a63" };
    }),
  ];

  return {
    title: "PLANTA — DESPIECE DE ACEROS · ZAPATA CORRIDA · HOJA A1",
    subtitle:
      tipo === "columnas"
        ? "Transversal de vuelo + lecho inferior continuo + superior cortado (L_teo + ℓd)"
        : "Corrida de muro · transversal por metro + lechos ∥ al eje",
    caption: `1 Ø ${transB.bar} @ ${transB.s.toFixed(0)} cm transv. inf.   ·   2 Ø ${longB.bar} @ ${longB.s.toFixed(0)} cm inf. continuo   ·   3 Ø ${supL.bar} @ ${supL.s.toFixed(0)} cm sup. L_teo+ℓd   ·   h = ${hf.toFixed(2)} m   ·   ${plant.beams.length} VC`,
    note: "Despiece solo dentro del concreto de la zapata. 1 Transversal inferior ⊥ al eje (flexión del vuelo, gancho 90° corto en ambos bordes de B). 2 Longitudinal inferior ∥ continuo de extremo a extremo. 3 Longitudinal superior ∥ cortado en cada apoyo/extremo (L_teo 0,30 ℓn + ℓd). Recubrimiento ≥ 7,5 cm (E.060 7.7.1).",
    W,
    H,
    sheet: "a1",
    mode: "plan",
    pxPerM: sc,
    lineScale: 0.55,
    markBoxes: true,
    outline: ptsStr([xy(plant.x0, plant.y0), xy(plant.x1, plant.y0), xy(plant.x1, plant.y1), xy(plant.x0, plant.y1)]),
    regions,
    guides,
    dims: [
      { x1: xy(plant.x0, plant.y0).x, y1: xy(plant.x0, plant.y0).y + 28, x2: xy(plant.x1, plant.y0).x, y2: xy(plant.x0, plant.y0).y + 28, label: `L = ${Lx.toFixed(2)} m`, side: "bottom" },
      { x1: xy(plant.x0, plant.y0).x - 22, y1: xy(plant.x0, plant.y1).y, x2: xy(plant.x0, plant.y0).x - 22, y2: xy(plant.x0, plant.y0).y, label: `B = ${Ly.toFixed(2)} m`, side: "left" },
    ],
    layers,
    annos,
  };
}
