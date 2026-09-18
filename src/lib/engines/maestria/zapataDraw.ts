import { toPx, viewBoxOf } from "./drawCommon";
import { cellOn, colXY, nxOf, nyOf, type MaeModel } from "./types";

export function zapataOutline(m: MaeModel) {
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
