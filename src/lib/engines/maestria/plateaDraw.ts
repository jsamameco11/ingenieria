import { punchPlanSize, toPx, viewBoxOf, type PunchSpec } from "./drawCommon";
import { cellOn, colXY, nxOf, nyOf, type MaeModel } from "./types";

export function plateaOutline(m: MaeModel) {
  const { pad, sc } = viewBoxOf(m);
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  const ny = nyOf(m);
  const nx = nxOf(m);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      if (!cellOn(m, ix, iy)) continue;
      const a = toPx(m, m.axesX[ix], m.axesY[iy + 1], pad, sc);
      const b = toPx(m, m.axesX[ix + 1], m.axesY[iy], pad, sc);
      rects.push({ x: a.x, y: a.y, w: Math.max(2, b.x - a.x), h: Math.max(2, b.y - a.y) });
    }
  }
  const cols = m.cols.map((c) => {
    const p = colXY(m, c);
    const q = toPx(m, p.x, p.y, pad, sc);
    return { ...c, px: q.x, py: q.y, wx: Math.max(8, c.t2 * sc), wy: Math.max(8, c.t1 * sc) };
  });
  return { rects, cols, pad, sc };
}

export function punchToView(spec: PunchSpec, W = 560, H = 400) {
  const { L, B } = punchPlanSize(spec);
  const pad = { l: 56, r: 24, t: 28, b: 52 };
  const col = spec.col;
  const periSrc = spec.poly?.length
    ? spec.poly
    : [
        { x: col.x - col.t2 / 2, y: col.y - col.t1 / 2 },
        { x: col.x + col.t2 / 2, y: col.y - col.t1 / 2 },
        { x: col.x + col.t2 / 2, y: col.y + col.t1 / 2 },
        { x: col.x - col.t2 / 2, y: col.y + col.t1 / 2 },
      ];
  const xs = [...periSrc.map((p) => p.x), col.x - col.t2 / 2, col.x + col.t2 / 2];
  const ys = [...periSrc.map((p) => p.y), col.y - col.t1 / 2, col.y + col.t1 / 2];
  const padM = Math.max(col.t1, col.t2, spec.d || 0.35, 0.35) * 3.2;
  let x0 = Math.min(...xs) - padM;
  let x1 = Math.max(...xs) + padM;
  let y0 = Math.min(...ys) - padM;
  let y1 = Math.max(...ys) + padM;
  x0 = Math.max(-0.15, x0);
  y0 = Math.max(-0.15, y0);
  x1 = Math.min(L + 0.15, x1);
  y1 = Math.min(B + 0.15, y1);
  const spanX = Math.max(x1 - x0, 0.6);
  const spanY = Math.max(y1 - y0, 0.6);
  const sc = Math.min((W - pad.l - pad.r) / spanX, (H - pad.t - pad.b) / spanY);
  const xy = (x: number, y: number) => ({
    x: pad.l + (x - x0) * sc,
    y: pad.t + (y1 - y) * sc,
  });
  const px0 = Math.max(0, x0);
  const px1 = Math.min(L, x1);
  const py0 = Math.max(0, y0);
  const py1 = Math.min(B, y1);
  const outline = [xy(px0, py0), xy(px1, py0), xy(px1, py1), xy(px0, py1)];
  const full = [xy(0, 0), xy(L, 0), xy(L, B), xy(0, B)];
  const colPoly = [
    xy(col.x - col.t2 / 2, col.y - col.t1 / 2),
    xy(col.x + col.t2 / 2, col.y - col.t1 / 2),
    xy(col.x + col.t2 / 2, col.y + col.t1 / 2),
    xy(col.x - col.t2 / 2, col.y + col.t1 / 2),
  ];
  const onX0 = Math.max(0, col.x - col.t2 / 2);
  const onX1 = Math.min(L, col.x + col.t2 / 2);
  const onY0 = Math.max(0, col.y - col.t1 / 2);
  const onY1 = Math.min(B, col.y + col.t1 / 2);
  const colOn = [
    xy(onX0, onY0),
    xy(onX1, onY0),
    xy(onX1, onY1),
    xy(onX0, onY1),
  ];
  const colBox = {
    ...xy(col.x - col.t2 / 2, col.y + col.t1 / 2),
    w: Math.max(8, col.t2 * sc),
    h: Math.max(8, col.t1 * sc),
  };
  const peri = periSrc.map((p) => xy(p.x, p.y));
  const edges = {
    left: px0 <= 1e-6,
    bot: py0 <= 1e-6,
    right: Math.abs(px1 - L) <= 1e-6,
    top: Math.abs(py1 - B) <= 1e-6,
  };
  return { outline, full, col: colBox, colPoly, colOn, peri, sc, pad, W, H, x0, x1, y0, y1, L, B, edges, xy };
}
