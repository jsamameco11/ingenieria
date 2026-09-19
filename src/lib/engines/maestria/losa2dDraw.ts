import { barByName } from "../../types";
import { losaNegBarM } from "./steel";
import {
  pathBothHooks90,
  pathHook90,
  ptsStr,
  STEEL_DIST,
  STEEL_FLEX,
  STEEL_TEMP,
  type SteelBarPt,
  type SteelDraftSpec,
  type SteelLayer,
} from "../../steelDraft";
import { barWidth, toPx, viewBoxOf, type PlanBar } from "./drawCommon";
import {
  cellOn,
  identifyLosa,
  identifySteelRuns,
  mergedH,
  mergedV,
  nxOf,
  nyOf,
  type EdgeKind,
  type MaeModel,
} from "./types";

export type LosaSteelPane = {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  lx: number;
  ly: number;
  ix0?: number;
  iy0?: number;
  ix1?: number;
  iy1?: number;
  edges?: { L: EdgeKind; R: EdgeKind; B: EdgeKind; T: EdgeKind };
};

export type LosaSteelPack = {
  tipo?: string;
  h?: number;
  rec?: number;
  panes: LosaSteelPane[];
  voids: { id: string; x0: number; y0: number; x1: number; y1: number }[];
  axesX?: number[];
  axesY?: number[];
  mergeH?: boolean[][];
  mergeV?: boolean[][];
  steels: {
    id: string;
    infX: string;
    infY: string;
    supX: string;
    supY: string;
    asPosX?: number;
    asPosY?: number;
    asNegX?: number;
    asNegY?: number;
    neg?: {
      xL: number;
      xR: number;
      yB: number;
      yT: number;
      LextX?: number;
      LextY?: number;
      LteoXL?: number;
      LteoXR?: number;
      LteoYB?: number;
      LteoYT?: number;
    };
  }[];
};

function parseBar(text: string, fallback = '3/8"') {
  if (!text || text.trim() === "—" || !String(text).trim()) {
    const def = barByName(fallback);
    return { bar: def.name, db: def.db, s: 0, as: 0, empty: true as const };
  }
  const m = String(text || "").match(/Ø\s*([^@·]+)/i);
  const s = String(text || "").match(/@\s*([\d.,]+)/);
  const bar = (m?.[1] ?? fallback).replace(/inf\.|sup\.|cm.*/gi, "").trim() || fallback;
  const def = barByName(bar);
  const sp = parseFloat((s?.[1] ?? "20").replace(",", "."));
  return { bar: def.name, db: def.db, s: Number.isFinite(sp) && sp > 0 ? sp : 20, as: def.as, empty: false as const };
}

function packFromModel(m: MaeModel, bars: { infX: string; infY: string; supX: string; supY: string }): LosaSteelPack {
  const found = identifyLosa(m);
  return {
    panes: found.panes.map((p) => ({
      id: p.id,
      x0: p.x0,
      y0: p.y0,
      x1: p.x1,
      y1: p.y1,
      lx: p.lx,
      ly: p.ly,
      ix0: p.ix0,
      iy0: p.iy0,
      ix1: p.ix1,
      iy1: p.iy1,
      edges: p.edges,
    })),
    voids: found.voids.map((v) => ({ id: v.id, x0: v.x0, y0: v.y0, x1: v.x1, y1: v.y1 })),
    axesX: m.axesX,
    axesY: m.axesY,
    mergeH: m.mergeH,
    mergeV: m.mergeV,
    steels: found.panes.map((p) => ({ id: p.id, ...bars })),
  };
}

function perpInward(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  let px = -dy / L;
  let py = dx / L;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  if (px * (c.x - mx) + py * (c.y - my) < 0) {
    px = -px;
    py = -py;
  }
  return { x: px, y: py };
}

function dirToward(v: { x: number; y: number }): "right" | "left" | "up" | "down" {
  if (Math.abs(v.x) >= Math.abs(v.y)) return v.x >= 0 ? "right" : "left";
  return v.y >= 0 ? "down" : "up";
}

function hookGeom(dbCm: number, sc: number) {
  const dbM = Math.max(dbCm, 0.95) / 100;
  return {
    r: Math.max(8, 6 * dbM * sc * 2.4),
    hook: Math.max(18, 12 * dbM * sc * 2.4),
  };
}

/** Gancho 90° hacia el interior del paño. Mismo lado en ambos extremos (C), nunca U enfrentada. */
function barPoly(
  a: SteelBarPt,
  b: SteelBarPt,
  inward: { x: number; y: number },
  dbCm: number,
  sc: number,
  hookA: boolean,
  hookB: boolean,
) {
  const { r, hook } = hookGeom(dbCm, sc);
  const t = dirToward(inward);
  if (hookA && hookB) return pathBothHooks90(a, b, t, t, r, hook);
  if (!hookA && !hookB) return [a, b];
  if (hookA) return pathHook90(b, a, t, r, hook).reverse();
  return pathHook90(a, b, t, r, hook);
}

function dOf(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  return pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function skipMergedAxis(m: MaeModel, dir: "x" | "y", axis: number, cell: number) {
  if (dir === "x") {
    return axis > 0 && axis < nxOf(m) && cellOn(m, axis - 1, cell) && cellOn(m, axis, cell) && mergedH(m, axis - 1, cell);
  }
  return axis > 0 && axis < nyOf(m) && cellOn(m, cell, axis - 1) && cellOn(m, cell, axis) && mergedV(m, cell, axis - 1);
}

function paneOfCell(pack: LosaSteelPack, m: MaeModel, ix: number, iy: number) {
  const hit = pack.panes.find(
    (p) =>
      (p.ix0 != null && ix >= p.ix0 && ix <= (p.ix1 ?? p.ix0) && iy >= (p.iy0 ?? 0) && iy <= (p.iy1 ?? p.iy0 ?? 0)) ||
      (m.axesX[ix] + 1e-6 >= p.x0 && m.axesX[ix + 1] - 1e-6 <= p.x1 && m.axesY[iy] + 1e-6 >= p.y0 && m.axesY[iy + 1] - 1e-6 <= p.y1),
  );
  return hit ?? pack.panes[0];
}

function steelOf(pack: LosaSteelPack, id: string | undefined) {
  return pack.steels.find((s) => s.id === id) ?? pack.steels[0];
}

function isFreeEdge(kind?: EdgeKind) {
  return kind === "libre" || kind === "discontinuo";
}

function paneNegBarM(pack: LosaSteelPack, pan: LosaSteelPane | undefined, dir: "x" | "y", side: "L" | "R" | "B" | "T") {
  if (!pan) return 0;
  const st = steelOf(pack, pan.id);
  const stored = st?.neg;
  if (stored) {
    if (dir === "x") return side === "L" ? stored.xL : stored.xR;
    return side === "B" ? stored.yB : stored.yT;
  }
  const ln = dir === "x" ? pan.lx : pan.ly;
  const parsed = parseBar(dir === "x" ? st?.supX ?? "" : st?.supY ?? "");
  if (parsed.empty) return 0;
  const recCm = pack.rec ?? 2.5;
  const dCm = Math.max((pack.h ?? 15) - recCm - 0.5, 6);
  const edge =
    side === "L" ? isFreeEdge(pan.edges?.L) : side === "R" ? isFreeEdge(pan.edges?.R) : side === "B" ? isFreeEdge(pan.edges?.B) : isFreeEdge(pan.edges?.T);
  return losaNegBarM({ LteoM: 0.3 * ln, dbCm: parsed.db, dCm, lnM: ln, recCm, edge }).LbarM;
}

function nearEdge(coord: number, edge: number, recM: number) {
  return Math.abs(coord - edge) <= Math.max(recM + 0.08, 0.14);
}

type DrawnBar = {
  path: { x: number; y: number }[];
  db: number;
  s: number;
  bar: string;
  color: string;
  name: string;
  face: string;
  side: SteelLayer["side"];
  asReq?: number;
  Lbar?: number;
};

type BarPick = { st: ReturnType<typeof parseBar>; as: number; pan?: LosaSteelPane };

function govOf(items: BarPick[]): BarPick | null {
  const live = items.filter((c) => !c.st.empty);
  if (!live.length) return null;
  return live.reduce((a, b) => {
    if (b.as > a.as + 1e-9) return b;
    if (a.as > b.as + 1e-9) return a;
    if (b.st.db > a.st.db + 1e-9) return b;
    if (b.st.s && a.st.s && b.st.s < a.st.s - 1e-9) return b;
    return a;
  });
}

function paneIdsOf(items: { pan?: LosaSteelPane }[]) {
  const ids: string[] = [];
  for (const it of items) {
    const id = it.pan?.id;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids.join("–") || "techo";
}

function collectDrawnBars(
  m: MaeModel,
  pack: LosaSteelPack,
  xy: (x: number, y: number) => { x: number; y: number },
  sc: number,
  recCm: number,
): DrawnBar[] {
  const paneIdx = pack.panes
    .filter((p) => p.ix0 != null && p.iy0 != null && p.ix1 != null && p.iy1 != null)
    .map((p) => ({ id: p.id, ix0: p.ix0!, iy0: p.iy0!, ix1: p.ix1!, iy1: p.iy1! }));
  const runs = identifySteelRuns(m, paneIdx.length ? paneIdx : undefined);
  const inset = Math.max(0.08, (recCm / 100) * 0.6);
  const recM = Math.max(0.025, recCm / 100);
  const out: DrawnBar[] = [];
  const nx = nxOf(m);
  const ny = nyOf(m);

  for (const run of runs.posRuns) {
    if (run.dir === "x") {
      const iy = run.line;
      const y = m.axesY[iy] + (m.axesY[iy + 1] - m.axesY[iy]) * 0.28;
      const cells: BarPick[] = [];
      for (let ix = run.i0; ix <= run.i1; ix++) {
        const pan = paneOfCell(pack, m, ix, iy);
        const st = steelOf(pack, pan?.id);
        cells.push({ pan, st: parseBar(st?.infX ?? ""), as: st?.asPosX ?? 0 });
      }
      const gov = govOf(cells);
      if (!gov) continue;
      const x0 = m.axesX[run.i0] + inset;
      const x1 = m.axesX[run.i1 + 1] - inset;
      if (x1 - x0 < 0.08) continue;
      const cy = (m.axesY[iy] + m.axesY[iy + 1]) / 2;
      const a = xy(x0, y);
      const b = xy(x1, y);
      const inward = perpInward(a, b, xy((x0 + x1) / 2, cy));
      out.push({
        path: barPoly(a, b, inward, gov.st.db, sc, true, true),
        db: gov.st.db,
        s: gov.st.s,
        bar: gov.st.bar,
        color: STEEL_FLEX,
        name: `As+ X · ${paneIdsOf(cells)}`,
        face: "positivo continuo · X",
        side: "bottom",
        asReq: gov.as || undefined,
        Lbar: x1 - x0,
      });
    } else {
      const ix = run.line;
      const x = m.axesX[ix] + (m.axesX[ix + 1] - m.axesX[ix]) * 0.28;
      const cells: BarPick[] = [];
      for (let iy = run.i0; iy <= run.i1; iy++) {
        const pan = paneOfCell(pack, m, ix, iy);
        const st = steelOf(pack, pan?.id);
        cells.push({ pan, st: parseBar(st?.infY ?? ""), as: st?.asPosY ?? 0 });
      }
      const gov = govOf(cells);
      if (!gov) continue;
      const y0 = m.axesY[run.i0] + inset;
      const y1 = m.axesY[run.i1 + 1] - inset;
      if (y1 - y0 < 0.08) continue;
      const cx = (m.axesX[ix] + m.axesX[ix + 1]) / 2;
      const a = xy(x, y0);
      const b = xy(x, y1);
      const inward = perpInward(a, b, xy(cx, (y0 + y1) / 2));
      out.push({
        path: barPoly(a, b, inward, gov.st.db, sc, true, true),
        db: gov.st.db,
        s: gov.st.s,
        bar: gov.st.bar,
        color: STEEL_DIST,
        name: `As+ Y · ${paneIdsOf(cells)}`,
        face: "positivo continuo · Y",
        side: "left",
        asReq: gov.as || undefined,
        Lbar: y1 - y0,
      });
    }
  }

  for (const cut of runs.negCuts) {
    if (cut.dir === "x") {
      const ax = cut.i0;
      const iy = cut.line;
      const left = ax > 0 && cellOn(m, ax - 1, iy);
      const right = ax < nx && cellOn(m, ax, iy);
      if (!left && !right) continue;
      const panL = left ? paneOfCell(pack, m, ax - 1, iy) : undefined;
      const panR = right ? paneOfCell(pack, m, ax, iy) : undefined;
      const stL = steelOf(pack, panL?.id);
      const stR = steelOf(pack, panR?.id);
      const pickL: BarPick = { pan: panL, st: parseBar(stL?.supX ?? ""), as: stL?.asNegX ?? 0 };
      const pickR: BarPick = { pan: panR, st: parseBar(stR?.supX ?? ""), as: stR?.asNegX ?? 0 };
      const gov = govOf([pickL, pickR]);
      if (!gov) continue;
      const LbarL = left ? paneNegBarM(pack, panL, "x", "R") : 0;
      const LbarR = right ? paneNegBarM(pack, panR, "x", "L") : 0;
      const xLeft = left && panL ? Math.max(m.axesX[ax] - LbarL, panL.x0 + inset) : m.axesX[ax] + inset;
      const xRight = right && panR ? Math.min(m.axesX[ax] + LbarR, panR.x1 - inset) : m.axesX[ax] - inset;
      if (xRight - xLeft < 0.08) continue;
      const y = m.axesY[iy] + (m.axesY[iy + 1] - m.axesY[iy]) * 0.62;
      const cy = (m.axesY[iy] + m.axesY[iy + 1]) / 2;
      const a = xy(xLeft, y);
      const b = xy(xRight, y);
      const inward = perpInward(a, b, xy((xLeft + xRight) / 2, cy));
      const hookA = left && panL ? nearEdge(xLeft, panL.x0, recM) && isFreeEdge(panL.edges?.L) : isFreeEdge(panR?.edges?.L);
      const hookB = right && panR ? nearEdge(xRight, panR.x1, recM) && isFreeEdge(panR.edges?.R) : isFreeEdge(panL?.edges?.R);
      const Lbar = (left ? LbarL : 0) + (right ? LbarR : 0);
      out.push({
        path: barPoly(a, b, inward, gov.st.db, sc, Boolean(hookA), Boolean(hookB)),
        db: gov.st.db,
        s: gov.st.s,
        bar: gov.st.bar,
        color: STEEL_TEMP,
        name: `As− X · ${paneIdsOf([pickL, pickR])} · L=${Lbar.toFixed(2)} m`,
        face: "negativo apoyo · X",
        side: "top",
        asReq: gov.as || undefined,
        Lbar,
      });
    } else {
      const ay = cut.i0;
      const ix = cut.line;
      const bot = ay > 0 && cellOn(m, ix, ay - 1);
      const top = ay < ny && cellOn(m, ix, ay);
      if (!bot && !top) continue;
      const panB = bot ? paneOfCell(pack, m, ix, ay - 1) : undefined;
      const panT = top ? paneOfCell(pack, m, ix, ay) : undefined;
      const stB = steelOf(pack, panB?.id);
      const stT = steelOf(pack, panT?.id);
      const pickB: BarPick = { pan: panB, st: parseBar(stB?.supY ?? ""), as: stB?.asNegY ?? 0 };
      const pickT: BarPick = { pan: panT, st: parseBar(stT?.supY ?? ""), as: stT?.asNegY ?? 0 };
      const gov = govOf([pickB, pickT]);
      if (!gov) continue;
      const LbarB = bot ? paneNegBarM(pack, panB, "y", "T") : 0;
      const LbarT = top ? paneNegBarM(pack, panT, "y", "B") : 0;
      const yBot = bot && panB ? Math.max(m.axesY[ay] - LbarB, panB.y0 + inset) : m.axesY[ay] + inset;
      const yTop = top && panT ? Math.min(m.axesY[ay] + LbarT, panT.y1 - inset) : m.axesY[ay] - inset;
      if (yTop - yBot < 0.08) continue;
      const x = m.axesX[ix] + (m.axesX[ix + 1] - m.axesX[ix]) * 0.62;
      const cx = (m.axesX[ix] + m.axesX[ix + 1]) / 2;
      const a = xy(x, yBot);
      const b = xy(x, yTop);
      const inward = perpInward(a, b, xy(cx, (yBot + yTop) / 2));
      const hookA = bot && panB ? nearEdge(yBot, panB.y0, recM) && isFreeEdge(panB.edges?.B) : isFreeEdge(panT?.edges?.B);
      const hookB = top && panT ? nearEdge(yTop, panT.y1, recM) && isFreeEdge(panT.edges?.T) : isFreeEdge(panB?.edges?.T);
      const Lbar = (bot ? LbarB : 0) + (top ? LbarT : 0);
      out.push({
        path: barPoly(a, b, inward, gov.st.db, sc, Boolean(hookA), Boolean(hookB)),
        db: gov.st.db,
        s: gov.st.s,
        bar: gov.st.bar,
        color: STEEL_TEMP,
        name: `As− Y · ${paneIdsOf([pickB, pickT])} · L=${Lbar.toFixed(2)} m`,
        face: "negativo apoyo · Y",
        side: "right",
        asReq: gov.as || undefined,
        Lbar,
      });
    }
  }
  return out;
}

export function losaSteelPlan(m: MaeModel, bars: { infX: string; infY: string; supX: string; supY: string }): PlanBar[] {
  const pack = packFromModel(m, bars);
  const { pad, sc } = viewBoxOf(m);
  const xy = (x: number, y: number) => toPx(m, x, y, pad, sc);
  return collectDrawnBars(m, pack, xy, sc, 2.5).map((b) => ({
    d: dOf(b.path),
    sw: barWidth(b.db || 0.95, 2.2),
    color: b.color,
    label: `${b.name} Ø ${b.bar}`,
  }));
}

export function losaCaption(bars: { infX: string; infY: string; supX: string; supY: string }) {
  return `As+ inferior continuo (gancho 90° en extremos). As− superior continuo sobre el apoyo, sin doblez interior; gancho 90° solo en extremo de análisis. X inf ${bars.infX} · Y inf ${bars.infY} · −X ${bars.supX} · −Y ${bars.supY}.`;
}

function repLayer(opts: {
  mark: number;
  name: string;
  face: string;
  bar: string;
  sCm: number;
  color: string;
  side: SteelLayer["side"];
  path: { x: number; y: number }[];
  asReq?: number;
  recCm?: number;
}): SteelLayer {
  const def = barByName(opts.bar);
  const path = opts.path;
  const attach = path[Math.max(1, Math.min(path.length - 2, Math.floor(path.length / 2)))] ?? path[0] ?? { x: 0, y: 0 };
  return {
    mark: opts.mark,
    name: opts.name,
    face: opts.face,
    bar: def.name,
    dbCm: def.db,
    sCm: opts.sCm,
    nReal: Math.max(1, Math.round(100 / Math.max(opts.sCm, 1))),
    asProv: (def.as / Math.max(opts.sCm, 1e-6)) * 100,
    asUnit: "cm²/m",
    asReq: opts.asReq,
    recCm: opts.recCm,
    color: opts.color,
    side: opts.side,
    draw: "bar",
    bars: [attach],
    barPath: path.length > 1 ? path : undefined,
    attach,
  };
}

function placeMarkBoxes(layers: SteelLayer[], W: number, H: number) {
  const boxW = 124;
  const boxH = 40;
  const placed: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  const hits = (x: number, y: number) => placed.some((p) => Math.abs(p.x - x) < boxW - 8 && Math.abs(p.y - y) < boxH - 6);
  for (const l of layers) {
    const key = `${l.face}|${l.bar}|${l.sCm.toFixed(0)}`;
    const pos = /positivo/.test(l.face);
    if (!pos && seen.has(key)) {
      l.callout = undefined;
      continue;
    }
    seen.add(key);
    const att = l.attach ?? { x: 80, y: 80 };
    let ox = 0;
    let oy = 0;
    if (l.side === "bottom") oy = 28;
    else if (l.side === "top") oy = -28;
    else if (l.side === "left") ox = -62;
    else ox = 62;
    let x = att.x + ox;
    let y = att.y + oy;
    let n = 0;
    while (hits(x, y) && n < 14) {
      y += l.side === "top" ? -14 : 14;
      n += 1;
    }
    x = Math.max(22 + boxW / 2, Math.min(W - 22 - boxW / 2, x));
    y = Math.max(30 + boxH / 2, Math.min(H - 58 - boxH / 2, y));
    l.callout = { x, y, anchor: "middle" };
    placed.push({ x, y });
  }
}

export function buildLosaDraftSpec(m: MaeModel, pack: LosaSteelPack, title?: string): SteelDraftSpec {
  const tipo = pack.tipo === "aligerada" ? "ALIGERADA" : "MACIZA";
  const extX0 = m.axesX[0];
  const extX1 = m.axesX[m.axesX.length - 1];
  const extY0 = m.axesY[0];
  const extY1 = m.axesY[m.axesY.length - 1];
  const Lx = extX1 - extX0;
  const Ly = extY1 - extY0;
  const padL = 148;
  const padR = 132;
  const padT = 78;
  const padB = 118;
  const sc = Math.min(920 / Math.max(Lx, 1.2), 680 / Math.max(Ly, 1.2));
  const W = Math.ceil(padL + Lx * sc + padR);
  const H = Math.ceil(padT + Ly * sc + padB);
  const xy = (x: number, y: number) => ({ x: padL + (x - extX0) * sc, y: padT + (extY1 - y) * sc });
  const recCm = pack.rec ?? 2.5;
  const panes = pack.panes.length ? pack.panes : identifyLosa(m).panes;
  const voids = pack.voids.length ? pack.voids : identifyLosa(m).voids.map((v) => ({ id: v.id, x0: v.x0, y0: v.y0, x1: v.x1, y1: v.y1 }));
  const regions = [
    ...panes.map((p) => ({
      points: ptsStr([xy(p.x0, p.y0), xy(p.x1, p.y0), xy(p.x1, p.y1), xy(p.x0, p.y1)]),
      fill: "#e4d7b8",
      hatch: true,
    })),
    ...voids.map((v) => ({
      points: ptsStr([xy(v.x0, v.y0), xy(v.x1, v.y0), xy(v.x1, v.y1), xy(v.x0, v.y1)]),
      fill: "#f4efe4",
      hatch: false,
      dash: "6 4",
    })),
  ];
  const guides: { x1: number; y1: number; x2: number; y2: number; color: string; width: number }[] = [];
  const nx = nxOf(m);
  const ny = nyOf(m);
  for (let i = 0; i < m.axesX.length; i++) {
    for (let iy = 0; iy < ny; iy++) {
      if (skipMergedAxis(m, "x", i, iy)) continue;
      const a = xy(m.axesX[i], m.axesY[iy]);
      const b = xy(m.axesX[i], m.axesY[iy + 1]);
      guides.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: "#1a4473", width: 1.15 });
    }
  }
  for (let i = 0; i < m.axesY.length; i++) {
    for (let ix = 0; ix < nx; ix++) {
      if (skipMergedAxis(m, "y", i, ix)) continue;
      const a = xy(m.axesX[ix], m.axesY[i]);
      const b = xy(m.axesX[ix + 1], m.axesY[i]);
      guides.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: "#1a4473", width: 1.15 });
    }
  }
  const outline = panes[0]
    ? ptsStr([xy(panes[0].x0, panes[0].y0), xy(panes[0].x1, panes[0].y0), xy(panes[0].x1, panes[0].y1), xy(panes[0].x0, panes[0].y1)])
    : ptsStr([xy(extX0, extY0), xy(extX1, extY0), xy(extX1, extY1), xy(extX0, extY1)]);
  const drawn = collectDrawnBars(m, pack, xy, sc, recCm);
  const layers: SteelLayer[] = drawn.map((b, i) =>
    repLayer({
      mark: i + 1,
      name: b.name,
      face: b.face,
      bar: b.bar,
      sCm: b.s || 20,
      color: b.color,
      side: b.side,
      path: b.path,
      recCm,
      asReq: b.asReq,
    }),
  );
  placeMarkBoxes(layers, W, H);
  const annos = [
    ...panes.map((p) => {
      const q = xy((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2);
      return { x: q.x, y: q.y + 4, text: p.id, anchor: "middle" as const, fill: "#163a63" };
    }),
    ...voids.map((v) => {
      const q = xy((v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2);
      return { x: q.x, y: q.y + 4, text: "HUECO", anchor: "middle" as const, fill: "#8b1e1e" };
    }),
    ...m.axesX.map((x) => {
      const q = xy(x, extY0);
      return { x: q.x, y: H - 38, text: x.toFixed(2), anchor: "middle" as const, fill: "#5a4a28" };
    }),
    ...m.axesY.map((y) => {
      const q = xy(extX0, y);
      return { x: 18, y: q.y + 4, text: y.toFixed(2), anchor: "start" as const, fill: "#5a4a28" };
    }),
  ];
  return {
    title: title ?? `PLANTA — DESPIECE DE LOSA ${tipo} (2 DIRECCIONES)`,
    subtitle: "As+ continuo · gancho 90° en extremos  ·  As− sin doblez interior · gancho 90° solo en extremo de análisis  ·  Ø en pulgadas",
    caption: layers.map((l) => `${l.mark} Ø ${l.bar} @ ${l.sCm.toFixed(0)} cm`).join("  ·  "),
    note: `h = ${(pack.h ?? 15).toFixed(0)} cm. Despiece en planta (no corte de vigueta): una pieza por tramo, no por paño. As+ inferior continuo hasta hueco o borde, gancho 90° hacia el interior en ambos extremos. As− superior = L_teo + máx(12 db, d, ℓn/16) en un solo acero sobre el apoyo, recto en interiores; gancho 90° de un lado solo si el extremo es borde libre o hueco. Grosor proporcional al Ø.`,
    W,
    H,
    sheet: "a1",
    mode: "plan",
    pxPerM: sc,
    outline,
    regions,
    guides,
    hideCallouts: true,
    markBoxes: true,
    dims: [
      { x1: xy(extX0, extY0).x, y1: xy(extX0, extY0).y + 22, x2: xy(extX1, extY0).x, y2: xy(extX0, extY0).y + 22, label: `Lx = ${Lx.toFixed(2)} m`, side: "bottom" },
      { x1: xy(extX0, extY0).x - 18, y1: xy(extX0, extY1).y, x2: xy(extX0, extY0).x - 18, y2: xy(extX0, extY0).y, label: `Ly = ${Ly.toFixed(2)} m`, side: "left" },
    ],
    layers,
    annos,
  };
}

export function parseLosaSteelPack(raw: string | undefined): LosaSteelPack | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as LosaSteelPack;
    if (!Array.isArray(j.panes) || !Array.isArray(j.steels)) return null;
    return j;
  } catch {
    return null;
  }
}
