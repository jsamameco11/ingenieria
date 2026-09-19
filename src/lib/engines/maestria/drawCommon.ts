import { dumpGrid, type GridModel } from "../../layoutGrid";
import { dumpMae, extent, kindLabel, nxOf, nyOf, type MaeCol, type MaeMode, type MaeModel } from "./types";

export function maeToGrid(m: MaeModel, placed = true): GridModel {
  return {
    axesX: m.axesX,
    axesY: m.axesY,
    panes: m.cells,
    cols: m.cols.map((c) => ({
      ix: c.ix,
      iy: c.iy,
      t1: c.t1,
      t2: c.t2,
      P1: c.P1,
      P2: c.P2,
      P3: c.P3,
      M1: c.M1,
      M2: c.M2,
      M3: c.M3,
    })),
    placed,
  } as GridModel;
}

export function dumpBoth(m: MaeModel) {
  return { studioJson: dumpMae(m), gridJson: dumpGrid(maeToGrid(m, true)) };
}

export type PlanBar = {
  d: string;
  sw: number;
  color: string;
  label: string;
};

export type PunchSpec = {
  L?: number;
  B?: number;
  Lx?: number;
  Ly?: number;
  d: number;
  col: { x: number; y: number; t1: number; t2: number; id: string };
  poly: { x: number; y: number }[];
  segs?: { x1: number; y1: number; x2: number; y2: number }[];
  Vu: number;
  phiVn: number;
  b0: number;
  kind: string;
  ok: boolean;
};

export function punchPlanSize(spec: PunchSpec) {
  const L = [spec.L, spec.Lx].map(Number).find((v) => Number.isFinite(v) && v > 0) ?? 1;
  const B = [spec.B, spec.Ly].map(Number).find((v) => Number.isFinite(v) && v > 0) ?? 1;
  return { L, B };
}

export function barWidth(dbCm: number, scale: number) {
  return Math.max(2.4, Math.min(14, dbCm * scale * 1.15));
}

export function parsePunch(raw: string | undefined): PunchSpec | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as PunchSpec;
  } catch {
    return null;
  }
}

export function colAtHit(m: MaeModel, ix: number, iy: number): MaeCol | undefined {
  return m.cols.find((c) => c.ix === ix && c.iy === iy);
}

export function nearestAxis(m: MaeModel, x: number, y: number, tol: number) {
  let bestX = { i: -1, d: 1e9 };
  m.axesX.forEach((ax, i) => {
    const d = Math.abs(ax - x);
    if (d < bestX.d) bestX = { i, d };
  });
  let bestY = { i: -1, d: 1e9 };
  m.axesY.forEach((ay, i) => {
    const d = Math.abs(ay - y);
    if (d < bestY.d) bestY = { i, d };
  });
  const hitX = bestX.d <= tol;
  const hitY = bestY.d <= tol;
  return { hitX, hitY, iX: bestX.i, iY: bestY.i, dX: bestX.d, dY: bestY.d };
}

export function cellHit(m: MaeModel, x: number, y: number) {
  const nx = nxOf(m);
  const ny = nyOf(m);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      if (x >= m.axesX[ix] && x <= m.axesX[ix + 1] && y >= m.axesY[iy] && y <= m.axesY[iy + 1]) {
        return { ix, iy };
      }
    }
  }
  return null;
}

export function modeHint(mode: MaeMode) {
  if (mode === "losa") {
    return "1) Crear ejes (todos los paños quedan techo). 2) Paño on/off = pulse un paño verde para marcarlo hueco. 3) Unir/separar = clic en la línea interior entre dos techos: quita la viga y fusiona el paño. 4) Apoyo = viga / muro / libre.";
  }
  if (mode === "zapata") {
    return "1) Vanos X / Vanos Y = número de tramos (1 a 12). 2) Crear grilla rehace los ejes. 3) Cada vano se acota abajo (ℓx, ℓy). 4) Pintar planta. 5) Viga cim.: clic en un tramo grueso para borrarlo (uno a uno) o en un borde discontinuo para colocarlo. El vacío no es estructura. 6) Columnas en nudos. En la ficha: esquinera / borde mete el pedestal entero en la zapata (punzonamiento αs=20/30). Clic en una columna abre P1…M3.";
  }
  return "1) Vanos X / Vanos Y definen la malla. 2) Crear grilla. 3) Pintar platea. 4) Columnas en nudos. Esquinera / borde: pedestal entero sobre el concreto para punzonamiento. El gráfico muestra b0, Vu, φVn y OK/NO.";
}

export function axisCaption(m: MaeModel) {
  return `Ejes X: ${m.axisXKind.map(kindLabel).join(" · ")}    ·    Ejes Y: ${m.axisYKind.map(kindLabel).join(" · ")}`;
}

export function viewBoxOf(m: MaeModel, pad = 48) {
  const e = extent(m);
  const sc = Math.min(640 / Math.max(e.Lx, 1), 420 / Math.max(e.Ly, 1));
  return { pad, sc, W: pad * 2 + e.Lx * sc + 8, H: pad * 2 + e.Ly * sc + 8, e };
}

export function toPx(m: MaeModel, x: number, y: number, pad: number, sc: number) {
  const e = extent(m);
  return { x: pad + (x - e.x0) * sc, y: pad + (e.y1 - y) * sc };
}
