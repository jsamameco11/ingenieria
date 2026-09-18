import { barByName } from "../../types";
import {
  pathHook90Vec,
  ptsStr,
  STEEL_DIST,
  STEEL_FLEX,
  STEEL_TEMP,
  type SteelDraftSpec,
  type SteelLayer,
} from "../../steelDraft";
import { barWidth, toPx, viewBoxOf, type PlanBar } from "./drawCommon";
import {
  identifyLosa,
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
  steels: { id: string; infX: string; infY: string; supX: string; supY: string }[];
};

function parseBar(text: string, fallback = '3/8"') {
  const m = String(text || "").match(/Ø\s*([^@·]+)/i);
  const s = String(text || "").match(/@\s*([\d.,]+)/);
  const bar = (m?.[1] ?? fallback).replace(/inf\.|sup\.|cm.*/gi, "").trim() || fallback;
  const sp = parseFloat((s?.[1] ?? "20").replace(",", "."));
  return { bar: barByName(bar).name, db: barByName(bar).db, s: Number.isFinite(sp) && sp > 0 ? sp : 20, as: barByName(bar).as };
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
      edges: p.edges,
    })),
    voids: found.voids.map((v) => ({ id: v.id, x0: v.x0, y0: v.y0, x1: v.x1, y1: v.y1 })),
    axesX: m.axesX,
    axesY: m.axesY,
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

function hookedBar(
  a: { x: number; y: number },
  b: { x: number; y: number },
  inward: { x: number; y: number },
  bend: number,
  hook: number,
) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const left = pathHook90Vec(mid, a, inward, bend, hook).reverse();
  const right = pathHook90Vec(mid, b, inward, bend, hook);
  return [...left, ...right.slice(1)];
}

function dOf(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  return pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

export function losaSteelPlan(m: MaeModel, bars: { infX: string; infY: string; supX: string; supY: string }): PlanBar[] {
  const pack = packFromModel(m, bars);
  const { pad, sc } = viewBoxOf(m);
  const out: PlanBar[] = [];
  const xy = (x: number, y: number) => toPx(m, x, y, pad, sc);
  for (const p of pack.panes) {
    const st = pack.steels.find((s) => s.id === p.id) ?? { id: p.id, ...bars };
    const infX = parseBar(st.infX);
    const infY = parseBar(st.infY);
    const supX = parseBar(st.supX);
    const supY = parseBar(st.supY);
    const cx = (p.x0 + p.x1) / 2;
    const cy = (p.y0 + p.y1) / 2;
    const inset = 0.12;
    const ln4x = Math.min(p.lx / 4, Math.max(0.45, p.lx * 0.22));
    const ln4y = Math.min(p.ly / 4, Math.max(0.45, p.ly * 0.22));
    const yPos = p.y0 + p.ly * 0.38;
    const a = xy(p.x0 + inset, yPos);
    const b = xy(p.x1 - inset, yPos);
    const c = xy(cx, cy);
    const inwardX = perpInward(a, b, c);
    const bendX = Math.max(6, infX.db * sc * 0.08);
    const hookX = Math.max(10, infX.db * sc * 0.14);
    out.push({ d: dOf(hookedBar(a, b, inwardX, bendX, hookX)), sw: barWidth(infX.db || 0.95, 2.2), color: "#8b1e1e", label: `${p.id} +X Ø ${infX.bar}` });
    const xPos = p.x0 + p.lx * 0.38;
    const c0 = xy(xPos, p.y0 + inset);
    const c1 = xy(xPos, p.y1 - inset);
    const inwardY = perpInward(c0, c1, c);
    const bendY = Math.max(6, infY.db * sc * 0.08);
    const hookY = Math.max(10, infY.db * sc * 0.14);
    out.push({ d: dOf(hookedBar(c0, c1, inwardY, bendY, hookY)), sw: barWidth(infY.db || 0.95, 2.2), color: "#1a4473", label: `${p.id} +Y Ø ${infY.bar}` });
    if (p.edges?.L !== "libre") {
      const s0 = xy(p.x0 + inset, cy + 0.1);
      const s1 = xy(p.x0 + ln4x, cy + 0.1);
      out.push({ d: dOf(hookedBar(s0, s1, perpInward(s0, s1, c), bendX, hookX)), sw: barWidth(supX.db || 0.95, 2.0), color: "#5a4a28", label: `${p.id} −X Ø ${supX.bar}` });
    }
    if (p.edges?.R !== "libre") {
      const s0 = xy(p.x1 - ln4x, cy - 0.1);
      const s1 = xy(p.x1 - inset, cy - 0.1);
      out.push({ d: dOf(hookedBar(s0, s1, perpInward(s0, s1, c), bendX, hookX)), sw: barWidth(supX.db || 0.95, 2.0), color: "#5a4a28", label: `${p.id} −X Ø ${supX.bar}` });
    }
    if (p.edges?.B !== "libre") {
      const s0 = xy(cx + 0.1, p.y0 + inset);
      const s1 = xy(cx + 0.1, p.y0 + ln4y);
      out.push({ d: dOf(hookedBar(s0, s1, perpInward(s0, s1, c), bendY, hookY)), sw: barWidth(supY.db || 0.95, 2.0), color: "#5a4a28", label: `${p.id} −Y Ø ${supY.bar}` });
    }
    if (p.edges?.T !== "libre") {
      const s0 = xy(cx - 0.1, p.y1 - ln4y);
      const s1 = xy(cx - 0.1, p.y1 - inset);
      out.push({ d: dOf(hookedBar(s0, s1, perpInward(s0, s1, c), bendY, hookY)), sw: barWidth(supY.db || 0.95, 2.0), color: "#5a4a28", label: `${p.id} −Y Ø ${supY.bar}` });
    }
  }
  return out;
}

export function losaCaption(bars: { infX: string; infY: string; supX: string; supY: string }) {
  return `Inferior X ${bars.infX} (rojo) · Inferior Y ${bars.infY} (azul) · Superiores en apoyos ${bars.supX} / ${bars.supY}. Ganchos 90° en extremos. El despiece sigue la planta (ejes, techos y huecos).`;
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
  const attach = path[Math.floor(path.length / 2)] ?? { x: 0, y: 0 };
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

export function buildLosaDraftSpec(m: MaeModel, pack: LosaSteelPack, title?: string): SteelDraftSpec {
  const tipo = pack.tipo === "aligerada" ? "ALIGERADA" : "MACIZA";
  const extX0 = m.axesX[0];
  const extX1 = m.axesX[m.axesX.length - 1];
  const extY0 = m.axesY[0];
  const extY1 = m.axesY[m.axesY.length - 1];
  const Lx = extX1 - extX0;
  const Ly = extY1 - extY0;
  const padL = 128;
  const padR = 96;
  const padT = 64;
  const padB = 108;
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
  const guides = [
    ...m.axesX.map((x) => ({
      x1: xy(x, extY0).x,
      y1: xy(x, extY0).y,
      x2: xy(x, extY1).x,
      y2: xy(x, extY1).y,
      color: "#1a4473",
      width: 1.15,
    })),
    ...m.axesY.map((y) => ({
      x1: xy(extX0, y).x,
      y1: xy(extX0, y).y,
      x2: xy(extX1, y).x,
      y2: xy(extX1, y).y,
      color: "#1a4473",
      width: 1.15,
    })),
  ];
  const outline = panes[0]
    ? ptsStr([xy(panes[0].x0, panes[0].y0), xy(panes[0].x1, panes[0].y0), xy(panes[0].x1, panes[0].y1), xy(panes[0].x0, panes[0].y1)])
    : ptsStr([xy(extX0, extY0), xy(extX1, extY0), xy(extX1, extY1), xy(extX0, extY1)]);
  const layers: SteelLayer[] = [];
  let mark = 0;
  for (const p of panes) {
    const st = pack.steels.find((s) => s.id === p.id) ?? pack.steels[0];
    if (!st) continue;
    const infX = parseBar(st.infX);
    const infY = parseBar(st.infY);
    const supX = parseBar(st.supX);
    const supY = parseBar(st.supY);
    const cx = (p.x0 + p.x1) / 2;
    const cy = (p.y0 + p.y1) / 2;
    const c = xy(cx, cy);
    const inset = Math.max(0.08, (recCm / 100) * 0.6);
    const ln4x = Math.min(p.lx / 4, Math.max(0.4, p.lx * 0.22));
    const ln4y = Math.min(p.ly / 4, Math.max(0.4, p.ly * 0.22));
    const bend = Math.max(7, infX.db * sc * 0.07);
    const hook = Math.max(12, infX.db * sc * 0.16);
    const yPos = p.y0 + p.ly * 0.36;
    const a = xy(p.x0 + inset, yPos);
    const b = xy(p.x1 - inset, yPos);
    mark += 1;
    layers.push(
      repLayer({
        mark,
        name: `${p.id} inferior X`,
        face: "positivo centro · X",
        bar: infX.bar,
        sCm: infX.s,
        color: STEEL_FLEX,
        side: "bottom",
        path: hookedBar(a, b, perpInward(a, b, c), bend, hook),
        recCm,
      }),
    );
    const xPos = p.x0 + p.lx * 0.36;
    const c0 = xy(xPos, p.y0 + inset);
    const c1 = xy(xPos, p.y1 - inset);
    mark += 1;
    layers.push(
      repLayer({
        mark,
        name: `${p.id} inferior Y`,
        face: "positivo centro · Y",
        bar: infY.bar,
        sCm: infY.s,
        color: STEEL_DIST,
        side: "left",
        path: hookedBar(c0, c1, perpInward(c0, c1, c), bend, hook),
        recCm,
      }),
    );
    if (p.edges?.L !== "libre") {
      const s0 = xy(p.x0 + inset, cy + Math.min(0.12, p.ly * 0.04));
      const s1 = xy(p.x0 + ln4x, cy + Math.min(0.12, p.ly * 0.04));
      mark += 1;
      layers.push(
        repLayer({
          mark,
          name: `${p.id} superior X izq.`,
          face: "negativo apoyo · X",
          bar: supX.bar,
          sCm: supX.s,
          color: STEEL_TEMP,
          side: "top",
          path: hookedBar(s0, s1, perpInward(s0, s1, c), bend, hook),
          recCm,
        }),
      );
    }
    if (p.edges?.R !== "libre") {
      const s0 = xy(p.x1 - ln4x, cy - Math.min(0.12, p.ly * 0.04));
      const s1 = xy(p.x1 - inset, cy - Math.min(0.12, p.ly * 0.04));
      mark += 1;
      layers.push(
        repLayer({
          mark,
          name: `${p.id} superior X der.`,
          face: "negativo apoyo · X",
          bar: supX.bar,
          sCm: supX.s,
          color: STEEL_TEMP,
          side: "right",
          path: hookedBar(s0, s1, perpInward(s0, s1, c), bend, hook),
          recCm,
        }),
      );
    }
    if (p.edges?.B !== "libre") {
      const s0 = xy(cx + Math.min(0.12, p.lx * 0.04), p.y0 + inset);
      const s1 = xy(cx + Math.min(0.12, p.lx * 0.04), p.y0 + ln4y);
      mark += 1;
      layers.push(
        repLayer({
          mark,
          name: `${p.id} superior Y inf.`,
          face: "negativo apoyo · Y",
          bar: supY.bar,
          sCm: supY.s,
          color: STEEL_TEMP,
          side: "bottom",
          path: hookedBar(s0, s1, perpInward(s0, s1, c), bend, hook),
          recCm,
        }),
      );
    }
    if (p.edges?.T !== "libre") {
      const s0 = xy(cx - Math.min(0.12, p.lx * 0.04), p.y1 - ln4y);
      const s1 = xy(cx - Math.min(0.12, p.lx * 0.04), p.y1 - inset);
      mark += 1;
      layers.push(
        repLayer({
          mark,
          name: `${p.id} superior Y sup.`,
          face: "negativo apoyo · Y",
          bar: supY.bar,
          sCm: supY.s,
          color: STEEL_TEMP,
          side: "top",
          path: hookedBar(s0, s1, perpInward(s0, s1, c), bend, hook),
          recCm,
        }),
      );
    }
  }
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
    subtitle: "Misma grilla que el croquis · aceros emplazados por paño y por eje · gancho 90° en extremos",
    caption: layers.map((l) => `${l.mark} ${l.name} Ø ${l.bar} @ ${l.sCm.toFixed(0)} cm`).join("  ·  "),
    note: `h = ${(pack.h ?? 15).toFixed(0)} cm. El hueco no se arma. Negativo ~ℓn/4 en apoyos. Un Ø por lecho de cada paño, no un Ø global de planta.`,
    W,
    H,
    sheet: "a1",
    mode: "plan",
    pxPerM: sc,
    outline,
    regions,
    guides,
    hideCallouts: true,
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
