import { calcLosa2d } from "../src/lib/engines/maestria/losa2dCalc.ts";
import { calcZapataCorrida } from "../src/lib/engines/maestria/zapataCalc.ts";
import { calcPlatea } from "../src/lib/engines/maestria/plateaCalc.ts";
import { punchGeom } from "../src/lib/engines/maestria/steel.ts";
import { invertBeam } from "../src/lib/engines/maestria/matrixBeam.ts";
import {
  createGridAxes,
  collectGradeBeams,
  clearGradeBeamRun,
  dumpMae,
  exampleModel,
  fillLosaRoof,
  hasGradeBeam,
  placeColsOnPainted,
  toggleGradeBeam,
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
assert(zap.dims?.asSup, "zapata acero superior");
const punch = JSON.parse(String(zap.dims?.punchJson));
assert(punch.col.x >= punch.col.t2 / 2 - 1e-6, "zapata pedestal X sobre la losa");
assert(punch.col.y >= punch.col.t1 / 2 - 1e-6, "zapata pedestal Y sobre la losa");
assert(Array.isArray(punch.segs) && punch.segs.length >= 2, "zapata b0 en segmentos");
console.log("ZAPATA", zap.headline, punch.kind, "b0", punch.b0);
assert(Number(zap.dims?.nBeams) >= 4, `zapata tramos VC, hay ${zap.dims?.nBeams}`);
assert(zap.steps.some((s) => s.n === "08" && /cimentación/i.test(s.title)), "paso 08 vigas de cimentación");

const pla = calcPlatea({ studioJson: dumpMae(exampleModel("platea")), t: "0.50", qadm: "1.5", Df: "1.2", gt: "1.8", sc: "0.3", Ks: "8", fc: "210", fy: "4200", rec: "7.5" });
assert(pla.steps.length >= 8, "platea steps");
assert(pla.dims?.punchJson, "platea punch");
console.log("PLATEA", pla.headline);

const z0 = exampleModel("zapata");
assert(z0.axesX.length === 5, "zapata ejemplo 4 vanos X");
assert(z0.axesY.length === 3, "zapata ejemplo 2 vanos Y");
const vc0 = collectGradeBeams(z0);
assert(vc0.length >= 4, `ejemplo L tiene vigas de cimentación, hay ${vc0.length}`);
const off = toggleGradeBeam(z0, { kind: "h", iAxis: 0, iCell: 0 });
assert(!hasGradeBeam(off, "h", 0, 0), "se puede borrar un tramo de VC");
assert(hasGradeBeam(z0, "h", 0, 0), "el ejemplo original conserva la viga");
assert(collectGradeBeams(off).length >= 1, "borrar un vano no elimina las demás vigas");
const zRun = clearGradeBeamRun(z0, vc0[0]);
assert(collectGradeBeams(zRun).length < vc0.length, "la etiqueta VC apaga ese tramo continuo");
assert(collectGradeBeams(zRun).length > 0, "las otras VC siguen");
const ib = invertBeam(8, 10, [
  { x: 2, P: 40 },
  { x: 6, P: 40 },
]);
assert(Math.abs(ib.Vend) < 0.05, `equilibrio V(L)=${ib.Vend}`);
assert(Math.abs(ib.pts[ib.pts.length - 1]?.M ?? 1) < 0.2, "M(L)≈0 extremos libres");
const zapOff = calcZapataCorrida({ studioJson: dumpMae(off), tipo: "columnas", qadm: "2", Df: "1.5", gt: "1.8", sc: "0.3", hf: "0.45", fc: "210", fy: "4200", rec: "7.5", bBeam: "0.4", hBeam: "0.6" });
assert(Number(zapOff.dims?.nBeams) >= 1, "el expediente sigue con las VC restantes");
const zGrid = createGridAxes(z0, 6, 1, { resetCells: false, paint: false });
assert(zGrid.axesX.length === 7, "6 vanos X → 7 ejes");
assert(zGrid.axesY.length === 2, "1 vano Y → 2 ejes");
assert(Math.abs(zGrid.axesX[1] - zGrid.axesX[0] - 4) < 1e-9, "conserva vano 4 m");
const zPaint = placeColsOnPainted(fillLosaRoof(zGrid, true), "zapata");
assert(zPaint.cols.length === 14, `columnas en nudos 7×2, hay ${zPaint.cols.length}`);

const dM = 0.574;
const pgCorner = punchGeom(0, 0, 0.4, 0.4, dM, 1.6, 8);
const b0Corner = (0.4 + dM / 2) + (0.4 + dM / 2);
assert(pgCorner.kind === "esquina", `esquina kind=${pgCorner.kind}`);
assert(Math.abs(pgCorner.b0 / 100 - b0Corner) < 0.03, `b0 esquina ${pgCorner.b0.toFixed(1)} cm vs ${(b0Corner * 100).toFixed(1)}`);
assert(pgCorner.cx >= 0.2 - 1e-6 && pgCorner.cy >= 0.2 - 1e-6, "pedestal de esquina asentado sobre la zapata");
assert(pgCorner.b0 > 120, `b0 esquina no puede ser el recorte a caballo (~98 cm), hay ${pgCorner.b0.toFixed(1)}`);
assert(pgCorner.segs.length === 2, `perímetro L de 2 lados, hay ${pgCorner.segs.length}`);

const pgInt = punchGeom(4, 1.2, 0.4, 0.4, dM, 2.4, 12);
assert(pgInt.kind === "interior", `interior kind=${pgInt.kind}`);
const b0Int = 2 * (0.4 + dM) + 2 * (0.4 + dM);
assert(Math.abs(pgInt.b0 / 100 - b0Int) < 0.04, `b0 interior ${pgInt.b0.toFixed(1)} vs ${(b0Int * 100).toFixed(1)}`);

console.log("OK engines");
