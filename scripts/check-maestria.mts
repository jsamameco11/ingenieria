import { calcLosa2d } from "../src/lib/engines/maestria/losa2dCalc.ts";
import { calcZapataCorrida } from "../src/lib/engines/maestria/zapataCalc.ts";
import { calcPlatea } from "../src/lib/engines/maestria/plateaCalc.ts";
import {
  createGridAxes,
  dumpMae,
  exampleModel,
  fillLosaRoof,
  placeColsOnPainted,
} from "../src/lib/engines/maestria/types.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const losa = calcLosa2d({ studioJson: dumpMae(exampleModel("losa")), h: "15", rec: "2.5", cm: "500", cv: "250", fy: "4200", fc: "210" });
assert(losa.steps.length >= 6, "losa steps");
assert(losa.checks.some((c) => c.label.includes("paños") || c.ok), "losa checks");
console.log("LOSA", losa.headline);

const zap = calcZapataCorrida({ studioJson: dumpMae(exampleModel("zapata")), tipo: "columnas", qadm: "2", Df: "1.5", gt: "1.8", sc: "0.3", hf: "0.45", fc: "210", fy: "4200", rec: "7.5", bBeam: "0.4", hBeam: "0.6" });
assert(zap.steps.length >= 6, "zapata steps");
assert(zap.dims?.punchJson, "zapata punch");
console.log("ZAPATA", zap.headline);

const pla = calcPlatea({ studioJson: dumpMae(exampleModel("platea")), t: "0.50", qadm: "1.5", Df: "1.2", gt: "1.8", sc: "0.3", Ks: "8", fc: "210", fy: "4200", rec: "7.5" });
assert(pla.steps.length >= 8, "platea steps");
assert(pla.dims?.punchJson, "platea punch");
console.log("PLATEA", pla.headline);

const z0 = exampleModel("zapata");
assert(z0.axesX.length === 5, "zapata ejemplo 4 vanos X");
assert(z0.axesY.length === 3, "zapata ejemplo 2 vanos Y");
const zGrid = createGridAxes(z0, 6, 1, { resetCells: false, paint: false });
assert(zGrid.axesX.length === 7, "6 vanos X → 7 ejes");
assert(zGrid.axesY.length === 2, "1 vano Y → 2 ejes");
assert(Math.abs(zGrid.axesX[1] - zGrid.axesX[0] - 4) < 1e-9, "conserva vano 4 m");
const zPaint = placeColsOnPainted(fillLosaRoof(zGrid, true), "zapata");
assert(zPaint.cols.length === 14, `columnas en nudos 7×2, hay ${zPaint.cols.length}`);

console.log("OK engines");
