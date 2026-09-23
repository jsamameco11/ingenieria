import { barByName } from "../../types";
import {
  nAlong,
  pathBothHooks90,
  ptsStr,
  STEEL_FLEX,
  STEEL_TEMP,
  type SteelDraftSpec,
  type SteelLayer,
  type SteelDim,
} from "../../steelDraft";
import { zapataPlantFromValues, type ZapataPlanCell, type ZapataPlanCol } from "./zapataDraw";
import { ldTension, losaNegBarM } from "./steel";
import { clipHOnRects, clipVOnRects, orthoUnionOutline } from "./drawCommon";

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
  return Math.min(6.2, Math.max(2.6, 1.8 * dbM * sc));
}

/** Ramal de gancho 90° corto y bien escalado. */
function hookLen(dbCm: number, sc: number) {
  const dbM = dbCm / 100;
  return Math.min(12, Math.max(5.5, 4.4 * dbM * sc));
}

type Pt = { x: number; y: number };

function layer(opts: {
  mark: number;
  name: string;
  face: string;
  bar: string;
  sCm: number;
  color: string;
  side: SteelLayer["side"];
  paths: Pt[][];
  recCm: number;
  nReal: number;
  ldCm?: number;
  asReq?: number;
  callout?: SteelLayer["callout"];
}): SteelLayer {
  const def = barByName(opts.bar);
  const path = opts.paths[0] ?? [];
  const attach = path[Math.floor(path.length / 2)] ?? { x: 0, y: 0 };
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
    asReq: opts.asReq,
    recCm: opts.recCm,
    ldCm: opts.ldCm,
    color: opts.color,
    side: opts.side,
    draw: opts.paths.length ? "bar" : "dots",
    bars: opts.paths.length ? [attach] : [attach],
    barPath: path.length > 1 ? path : undefined,
    barPaths: opts.paths.filter((p) => p.length > 1),
    attach,
    callout: opts.callout,
  };
}

type Strip = {
  dir: "x" | "y";
  t0: number;
  t1: number;
  p0: number;
  p1: number;
  cells: ZapataPlanCell[];
};

/** Franjas de concreto corrido (solo paños pintados), fusionadas en X o en Y. */
function mergeStrips(cells: ZapataPlanCell[], dir: "x" | "y"): Strip[] {
  const sorted = [...cells].sort((a, b) => (dir === "x" ? a.x0 - b.x0 || a.y0 - b.y0 : a.y0 - b.y0 || a.x0 - b.x0));
  const strips: Strip[] = [];
  const taken = new Set<ZapataPlanCell>();
  for (const seed of sorted) {
    if (taken.has(seed)) continue;
    const s: Strip = {
      dir,
      t0: dir === "x" ? seed.x0 : seed.y0,
      t1: dir === "x" ? seed.x1 : seed.y1,
      p0: dir === "x" ? seed.y0 : seed.x0,
      p1: dir === "x" ? seed.y1 : seed.x1,
      cells: [seed],
    };
    taken.add(seed);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of sorted) {
        if (taken.has(c)) continue;
        const t0 = dir === "x" ? c.x0 : c.y0;
        const t1 = dir === "x" ? c.x1 : c.y1;
        const p0 = dir === "x" ? c.y0 : c.x0;
        const p1 = dir === "x" ? c.y1 : c.x1;
        const gap = t0 - s.t1;
        const overlapP = Math.max(0, Math.min(s.p1, p1) - Math.max(s.p0, p0));
        const minP = Math.min(s.p1 - s.p0, p1 - p0);
        if (gap <= 0.06 && gap >= -0.02 && overlapP >= 0.8 * Math.max(minP, 0.05)) {
          s.t1 = Math.max(s.t1, t1);
          s.p0 = Math.max(s.p0, p0);
          s.p1 = Math.min(s.p1, p1);
          s.cells.push(c);
          taken.add(c);
          grew = true;
        }
      }
    }
    strips.push(s);
  }
  return strips;
}

/** Una franja longitudinal por banda de concreto: la dirección más alargada. */
function longStripsOf(cells: ZapataPlanCell[]): Strip[] {
  if (!cells.length) return [];
  const xS = mergeStrips(cells, "x");
  const longX = xS.filter((s) => s.cells.length > 1 || s.t1 - s.t0 >= (s.p1 - s.p0) * 0.95);
  const used = new Set<ZapataPlanCell>();
  for (const s of longX) for (const c of s.cells) used.add(c);
  const rest = cells.filter((c) => !used.has(c));
  const yS = mergeStrips(rest, "y").filter((s) => s.cells.length > 1 || s.t1 - s.t0 >= (s.p1 - s.p0) * 0.95);
  for (const s of yS) for (const c of s.cells) used.add(c);
  const out = [...longX, ...yS];
  for (const c of cells) {
    if (used.has(c)) continue;
    const dx = c.x1 - c.x0;
    const dy = c.y1 - c.y0;
    const dir: "x" | "y" = dx >= dy ? "x" : "y";
    out.push({
      dir,
      t0: dir === "x" ? c.x0 : c.y0,
      t1: dir === "x" ? c.x1 : c.y1,
      p0: dir === "x" ? c.y0 : c.x0,
      p1: dir === "x" ? c.y1 : c.x1,
      cells: [c],
    });
  }
  return out;
}

function colOnStrip(col: ZapataPlanCol, s: Strip, pad = 0.08) {
  const t = s.dir === "x" ? col.x : col.y;
  const p = s.dir === "x" ? col.y : col.x;
  return t >= s.t0 - pad && t <= s.t1 + pad && p >= s.p0 - pad && p <= s.p1 + pad;
}

function mergeBands(bands: { t0: number; t1: number }[]) {
  const arr = bands.filter((b) => b.t1 - b.t0 >= 0.18).sort((a, b) => a.t0 - b.t0);
  const out: { t0: number; t1: number }[] = [];
  for (const b of arr) {
    const last = out[out.length - 1];
    if (last && b.t0 <= last.t1 + 0.05) last.t1 = Math.max(last.t1, b.t1);
    else out.push({ ...b });
  }
  return out;
}

function paneBarMap(raw: string): Map<string, ReturnType<typeof parseBar>> {
  const map = new Map<string, ReturnType<typeof parseBar>>();
  if (!raw.trim()) return map;
  try {
    const j = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(j)) {
      if (!v) continue;
      const parsed = parseBar(v);
      map.set(k, parsed);
      map.set(k.replace(/^P/i, ""), parsed);
      map.set(k.replace("-", ","), parsed);
      map.set(k.replace(",", "-"), parsed);
    }
  } catch {
    /* ignore */
  }
  return map;
}

function keysOfCell(id: string) {
  const compact = id.replace(/^P/i, "");
  return [id, compact, compact.replace("-", ","), compact.replace(",", "-")];
}

function barOfCell(cell: ZapataPlanCell, map: Map<string, ReturnType<typeof parseBar>>, fb: ReturnType<typeof parseBar>) {
  for (const k of keysOfCell(cell.id)) {
    const hit = map.get(k);
    if (hit) return hit;
  }
  return fb;
}

function calloutOf(paths: Pt[][], fallback: Pt, dy = -16): NonNullable<SteelLayer["callout"]> {
  const path = paths[Math.min(paths.length - 1, Math.floor(paths.length / 2))] ?? [];
  const p = path[Math.floor(path.length / 2)] ?? fallback;
  return { x: p.x, y: p.y + dy, anchor: "middle" };
}

/**
 * Motor dedicado SOLO al cuadro de despiece de la zapata corrida (planta A1).
 * Acero únicamente sobre paños pintados (nunca el rectángulo envolvente).
 * A lo largo: un Ø representativo continuo por franja de concreto.
 * A lo ancho: un Ø por paño, según el diseño de ese paño.
 * Lecho inf. sin corte; lecho sup. cortado L_teo + ℓd, proporcional en cada apoyo.
 */
export function buildZapataCorridaDespieceSpec(values: Record<string, string>): SteelDraftSpec {
  const plant = zapataPlantFromValues(values);
  const rec = nv(values, "rec", 7.5);
  const hf = nv(values, "hf", 0.45);
  const tipo = sv(values, "tipo", "muro");
  const transFb = parseBar(
    sv(values, "asPrin", sv(values, "asTrans", sv(values, "asTr", sv(values, "asPata", 'Ø 1/2" @ 15 cm')))),
    '1/2"',
  );
  const longB = parseBar(sv(values, "asDist", sv(values, "asLong", 'Ø 1/2" @ 20 cm')), '1/2"');
  const supL = parseBar(sv(values, "asSup", sv(values, "asDist", 'Ø 1/2" @ 20 cm')), '1/2"');
  const paneMap = paneBarMap(sv(values, "asPrinPanes"));

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

  const recM = rec / 100;
  const cells = plant.cells.map((c) => ({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }));
  const fy = nv(values, "fy", 4200);
  const fc = nv(values, "fc", 210);
  const ldTrans = ldTension(fy, fc, transFb.db);
  const ldInf = ldTension(fy, fc, longB.db);
  const ldSup = ldTension(fy, fc, supL.db);
  const dCm = Math.max(hf * 100 - rec, 12);
  const asPrinReq = nv(values, "AsPrin", 0);
  const asDistReq = nv(values, "AsDist", 0.0018 * 100 * hf * 100);

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

  const strips = longStripsOf(plant.cells);
  const cellDir = new Map<ZapataPlanCell, "x" | "y">();
  for (const s of strips) for (const c of s.cells) {
    const prev = cellDir.get(c);
    if (!prev) cellDir.set(c, s.dir);
    else if (s.dir !== prev) {
      const dx = c.x1 - c.x0;
      const dy = c.y1 - c.y0;
      cellDir.set(c, dx >= dy ? "x" : "y");
    }
  }

  // ── 1 · Transversal: UN acero por paño pintado, ⊥ al eje de esa franja ──
  const transPaths: Pt[][] = [];
  let nTransReal = 0;
  for (const c of plant.cells) {
    const st = barOfCell(c, paneMap, transFb);
    const dir = cellDir.get(c) ?? ((c.x1 - c.x0) >= (c.y1 - c.y0) ? "x" : "y");
    const longM = dir === "x" ? c.x1 - c.x0 : c.y1 - c.y0;
    nTransReal += nAlong(longM * 100, st.s);
    if (dir === "x") {
      const x = (c.x0 + c.x1) / 2;
      for (const seg of clipVOnRects(x, c.y0 + recM, c.y1 - recM, cells, recM)) {
        if (seg.y1 - seg.y0 < 0.08) continue;
        transPaths.push(pathBothHooks90(xy(x, seg.y0), xy(x, seg.y1), "right", "right", bendR(st.db, sc), hookLen(st.db, sc)));
      }
    } else {
      const y = (c.y0 + c.y1) / 2;
      for (const seg of clipHOnRects(y, c.x0 + recM, c.x1 - recM, cells, recM)) {
        if (seg.x1 - seg.x0 < 0.08) continue;
        transPaths.push(pathBothHooks90(xy(seg.x0, y), xy(seg.x1, y), "up", "up", bendR(st.db, sc), hookLen(st.db, sc)));
      }
    }
  }

  // ── 2 · Longitudinal inf.: UN acero por franja, continuo, sin corte ──
  const longPaths: Pt[][] = [];
  let nLongReal = 0;
  for (const s of strips) {
    const spanP = Math.max(s.p1 - s.p0 - 2 * recM, 0.1);
    nLongReal += nAlong(spanP * 100, longB.s);
    const p = s.p0 + recM + spanP * 0.38;
    const t0 = s.t0 + recM;
    const t1 = s.t1 - recM;
    if (t1 - t0 < 0.12) continue;
    if (s.dir === "x") {
      for (const seg of clipHOnRects(p, t0, t1, cells, recM)) {
        if (seg.x1 - seg.x0 < 0.12) continue;
        longPaths.push(pathBothHooks90(xy(seg.x0, p), xy(seg.x1, p), "up", "up", rL, hL));
      }
    } else {
      for (const seg of clipVOnRects(p, t0, t1, cells, recM)) {
        if (seg.y1 - seg.y0 < 0.12) continue;
        longPaths.push(pathBothHooks90(xy(p, seg.y0), xy(p, seg.y1), "right", "right", rL, hL));
      }
    }
  }

  // ── 3 · Longitudinal sup.: UN acero por franja, cortado L_teo+ℓd en cada apoyo ──
  const longSupPaths: Pt[][] = [];
  const axisDims: SteelDim[] = [];
  let nSupLReal = 0;
  let dimmed = false;
  const cols = [...plant.cols];
  for (const s of strips) {
    const spanP = Math.max(s.p1 - s.p0 - 2 * recM, 0.1);
    nSupLReal += nAlong(spanP * 100, supL.s);
    const p = s.p0 + recM + spanP * 0.72;
    const tEdge0 = s.t0 + recM;
    const tEdge1 = s.t1 - recM;
    if (tEdge1 - tEdge0 < 0.12) continue;
    const stations = [...new Set(cols.filter((c) => colOnStrip(c, s)).map((c) => (s.dir === "x" ? c.x : c.y)))]
      .filter((t) => t >= s.t0 - 0.05 && t <= s.t1 + 0.05)
      .sort((a, b) => a - b);
    const bands: { t0: number; t1: number }[] = [];
    if (stations.length >= 1) {
      for (let i = 0; i < stations.length; i++) {
        const ct = stations[i];
        const lnL = i === 0 ? Math.max(ct - s.t0, 0.4) : Math.max(ct - stations[i - 1], 0.4);
        const lnR = i === stations.length - 1 ? Math.max(s.t1 - ct, 0.4) : Math.max(stations[i + 1] - ct, 0.4);
        const ln = Math.max(lnL, lnR, 0.4);
        const Lteo = 0.3 * ln;
        const cut = losaNegBarM({
          LteoM: Lteo,
          dbCm: supL.db,
          dCm,
          lnM: ln,
          recCm: rec,
          edge: ct - s.t0 < 0.4 || s.t1 - ct < 0.4,
        });
        const Lbar = Math.min(Lteo + Math.max(cut.LextM, ldSup / 100), 0.35 * ln + ldSup / 100, 0.45 * ln);
        const atL = ct - tEdge0 <= 0.4;
        const atR = tEdge1 - ct <= 0.4;
        const ta = atL ? tEdge0 : Math.max(tEdge0, ct - Lbar);
        const tb = atR ? tEdge1 : Math.min(tEdge1, ct + Lbar);
        if (tb - ta >= 0.18) bands.push({ t0: ta, t1: tb });
        if (!dimmed && tb - ct > 0.15) {
          if (s.dir === "x") {
            const yD = xy(ct, p).y - 16;
            axisDims.push({
              x1: xy(ct, p).x, y1: yD, x2: xy(tb, p).x, y2: yD,
              label: `eje→ext. ${(tb - ct).toFixed(2)} m (L_teo+ℓd)`,
              side: "top", tiny: true,
            });
            if (ct - ta > 0.15) {
              axisDims.push({
                x1: xy(ta, p).x, y1: yD, x2: xy(ct, p).x, y2: yD,
                label: `${(ct - ta).toFixed(2)} m`,
                side: "top", tiny: true,
              });
            }
          } else {
            const xD = xy(p, ct).x + 16;
            axisDims.push({
              x1: xD, y1: xy(p, ct).y, x2: xD, y2: xy(p, tb).y,
              label: `eje→ext. ${(tb - ct).toFixed(2)} m (L_teo+ℓd)`,
              side: "right", tiny: true,
            });
          }
          dimmed = true;
        }
      }
    } else {
      bands.push({ t0: tEdge0, t1: tEdge1 });
    }
    for (const band of mergeBands(bands)) {
      if (s.dir === "x") {
        for (const seg of clipHOnRects(p, band.t0, band.t1, cells, recM)) {
          if (seg.x1 - seg.x0 < 0.18) continue;
          longSupPaths.push(pathBothHooks90(xy(seg.x0, p), xy(seg.x1, p), "down", "down", rS, hS));
        }
      } else {
        for (const seg of clipVOnRects(p, band.t0, band.t1, cells, recM)) {
          if (seg.y1 - seg.y0 < 0.18) continue;
          longSupPaths.push(pathBothHooks90(xy(p, seg.y0), xy(p, seg.y1), "left", "left", rS, hS));
        }
      }
    }
  }

  const midPlant = xy((plant.x0 + plant.x1) / 2, (plant.y0 + plant.y1) / 2);
  const layers: SteelLayer[] = [
    layer({
      mark: 1,
      name: "Transversal inf. (vuelo)",
      face: "⊥ al eje · un Ø por paño · lecho inf. · ganchos 90° en B",
      bar: transFb.bar,
      sCm: transFb.s,
      color: STEEL_FLEX,
      side: "top",
      paths: transPaths,
      recCm: rec,
      nReal: nTransReal,
      ldCm: ldTrans,
      asReq: asPrinReq || undefined,
      callout: calloutOf(transPaths, midPlant, -14),
    }),
    layer({
      mark: 2,
      name: "Longitudinal inf. continuo",
      face: "∥ al eje · un Ø por franja · lecho inf. · sin corte",
      bar: longB.bar,
      sCm: longB.s,
      color: STEEL_TEMP,
      side: "bottom",
      paths: longPaths,
      recCm: rec,
      nReal: nLongReal,
      ldCm: ldInf,
      asReq: asDistReq || undefined,
      callout: calloutOf(longPaths, midPlant, 16),
    }),
    layer({
      mark: 3,
      name: "Longitudinal sup. (cortes)",
      face: "∥ al eje · un Ø por franja · lecho sup. · L_teo + ℓd en cada apoyo",
      bar: supL.bar,
      sCm: supL.s,
      color: "#5a4a28",
      side: "top",
      paths: longSupPaths,
      recCm: rec,
      nReal: nSupLReal,
      ldCm: ldSup,
      asReq: asDistReq || undefined,
      callout: calloutOf(longSupPaths, midPlant, -18),
    }),
  ];

  const guides = [
    ...plant.cells.flatMap((c) => [
      { x1: xy(c.x0, c.y0).x, y1: xy(c.x0, c.y0).y, x2: xy(c.x0, c.y1).x, y2: xy(c.x0, c.y1).y, color: "#1a4473", dash: "5 4", width: 0.8 },
      { x1: xy(c.x1, c.y0).x, y1: xy(c.x1, c.y0).y, x2: xy(c.x1, c.y1).x, y2: xy(c.x1, c.y1).y, color: "#1a4473", dash: "5 4", width: 0.8 },
      { x1: xy(c.x0, c.y0).x, y1: xy(c.x0, c.y0).y, x2: xy(c.x1, c.y0).x, y2: xy(c.x1, c.y0).y, color: "#1a4473", dash: "5 4", width: 0.8 },
      { x1: xy(c.x0, c.y1).x, y1: xy(c.x0, c.y1).y, x2: xy(c.x1, c.y1).x, y2: xy(c.x1, c.y1).y, color: "#1a4473", dash: "5 4", width: 0.8 },
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

  const outlinePts = (() => {
    const poly = orthoUnionOutline(cells);
    const use = poly.length >= 3 ? poly : [
      { x: plant.x0, y: plant.y0 },
      { x: plant.x1, y: plant.y0 },
      { x: plant.x1, y: plant.y1 },
      { x: plant.x0, y: plant.y1 },
    ];
    return use.map((p) => xy(p.x, p.y));
  })();

  return {
    title: "PLANTA — DESPIECE DE ACEROS · ZAPATA CORRIDA · HOJA A1",
    subtitle:
      tipo === "columnas"
        ? "Un transversal por paño  ·  inf. continuo por franja  ·  sup. cortado (L_teo + ℓd)"
        : "Corrida de muro · un transversal por paño · lechos ∥ al eje",
    caption: `1 Ø ${transFb.bar} @ ${transFb.s.toFixed(0)} cm transv. inf. (1/paño)   ·   2 Ø ${longB.bar} @ ${longB.s.toFixed(0)} cm inf. continuo   ·   3 Ø ${supL.bar} @ ${supL.s.toFixed(0)} cm sup. L_teo+ℓd   ·   h = ${hf.toFixed(2)} m   ·   ${plant.cells.length} paños`,
    note: "Solo concreto pintado. 1 Transversal inferior: un Ø por paño según su Mu de vuelo, gancho 90° en bordes de B. 2 Longitudinal inferior: un Ø por franja, continuo de extremo a extremo, sin corte. 3 Longitudinal superior: un Ø por franja, cortado en cada apoyo (L_teo 0,30 ℓn + ℓd, proporcional al vano). Recubrimiento ≥ 7,5 cm (E.060 7.7.1).",
    W,
    H,
    sheet: "a1",
    mode: "plan",
    pxPerM: sc,
    lineScale: 0.32,
    markBoxes: true,
    outline: ptsStr(outlinePts.length ? outlinePts : [xy(plant.x0, plant.y0), xy(plant.x1, plant.y0), xy(plant.x1, plant.y1), xy(plant.x0, plant.y1)]),
    regions,
    guides,
    dims: [
      { x1: xy(plant.x0, plant.y0).x, y1: xy(plant.x0, plant.y0).y + 28, x2: xy(plant.x1, plant.y0).x, y2: xy(plant.x0, plant.y0).y + 28, label: `L = ${Lx.toFixed(2)} m`, side: "bottom" },
      { x1: xy(plant.x0, plant.y0).x - 22, y1: xy(plant.x0, plant.y1).y, x2: xy(plant.x0, plant.y0).x - 22, y2: xy(plant.x0, plant.y0).y, label: `B = ${Ly.toFixed(2)} m`, side: "left" },
      ...axisDims,
    ],
    layers,
    annos,
  };
}
