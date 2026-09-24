import { calcLosa2d } from "../src/lib/engines/maestria/losa2dCalc.ts";
import { calcZapataCorrida } from "../src/lib/engines/maestria/zapataCalc.ts";
import { calcPlatea } from "../src/lib/engines/maestria/plateaCalc.ts";
import { punchGeom } from "../src/lib/engines/maestria/steel.ts";
import { invertBeam } from "../src/lib/engines/maestria/matrixBeam.ts";
import { clipHOnRects, orthoUnionOutline } from "../src/lib/engines/maestria/drawCommon.ts";
import { buildZapataCorridaDespieceSpec } from "../src/lib/engines/maestria/zapataCorridaDespiece.ts";
import { buildPlateaDespieceSpec } from "../src/lib/engines/maestria/plateaDespiece.ts";
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
assert(Array.isArray(punch.slab) && punch.slab.length >= 1, "zapata punch con losa pintada");
console.log("ZAPATA", zap.headline, punch.kind, "b0", punch.b0);
assert(Number(zap.dims?.nBeams) >= 4, `zapata tramos VC, hay ${zap.dims?.nBeams}`);
assert(zap.steps.some((s) => s.n === "08" && /cimentación/i.test(s.title)), "paso 08 vigas de cimentación");
assert(/^\d+\s*Ø/.test(String(zap.dims?.asVCInf ?? "")), `VC inf. es n Ø, hay ${zap.dims?.asVCInf}`);
assert(zap.checks.some((c) => /qmáx/i.test(c.label)), "zapata verifica qmáx ≤ σn");
const punchStep = zap.steps.find((s) => s.n === "07");
const esq = punchStep?.table?.rows.find((r) => r[1] === "esquina");
assert(esq && Number(esq[2]) >= 1.24, `α de esquina 1.25, hay ${esq?.join(" | ")}`);

const pla = calcPlatea({ studioJson: dumpMae(exampleModel("platea")), t: "0.50", qadm: "1.5", Df: "1.2", gt: "1.8", sc: "0.3", Ks: "8", fc: "210", fy: "4200", rec: "7.5" });
assert(pla.steps.length >= 13, "platea steps incl. VC ℓn/7");
assert(pla.dims?.punchJson, "platea punch");
assert(pla.dims?.vPtsIntX && pla.dims?.vPtsEdgY, "platea V por franja");
assert(pla.dims?.mPtsIntX && pla.dims?.mPts, "platea M franjas y VC");
assert(Number(pla.dims?.hBeam) + 1e-6 >= Number(pla.dims?.hPred) - 0.01, `platea h=${pla.dims?.hBeam} ≥ ℓn/7=${pla.dims?.hPred}`);
const punchP = JSON.parse(String(pla.dims?.punchJson));
assert(Array.isArray(punchP.slab) && punchP.slab.length >= 1, "platea punch con losa pintada");
assert(/^\d+\s*Ø/.test(String(pla.dims?.asVCInf ?? "")), `platea VC inf. es n Ø, hay ${pla.dims?.asVCInf}`);
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

const zL = exampleModel("zapata");
const zRects: { x0: number; y0: number; x1: number; y1: number }[] = [];
for (let iy = 0; iy < zL.axesY.length - 1; iy++) {
  for (let ix = 0; ix < zL.axesX.length - 1; ix++) {
    if (!zL.cells[iy]?.[ix]) continue;
    zRects.push({ x0: zL.axesX[ix], y0: zL.axesY[iy], x1: zL.axesX[ix + 1], y1: zL.axesY[iy + 1] });
  }
}
const Lpoly = orthoUnionOutline(zRects);
assert(Lpoly.length >= 6, `contorno L tiene ≥6 vértices, hay ${Lpoly.length}`);
const yVoid = (zL.axesY[1] + zL.axesY[2]) / 2;
const segsVoid = clipHOnRects(yVoid, zL.axesX[0], zL.axesX[zL.axesX.length - 1], zRects, 0.05);
assert(segsVoid.every((s) => s.x1 - s.x0 < 5), `barra en el hueco de la L no cruza 16 m, hay ${JSON.stringify(segsVoid)}`);
const draftZ = buildZapataCorridaDespieceSpec({ studioJson: dumpMae(zL), tipo: "columnas", hf: "0.70", rec: "7.5", fy: "4200", fc: "210" });
assert((draftZ.outline.match(/,/g) ?? []).length >= 6, `despiece L: outline con ≥6 puntos, hay ${draftZ.outline}`);
const draftP = buildPlateaDespieceSpec({ studioJson: dumpMae(exampleModel("platea")), t: "0.50", rec: "7.5" });
assert(draftP.layers.length >= 4, "platea despiece 4 mallas");
assert(draftP.dims.some((d) => /eje|L_teo/i.test(d.label)), "platea cota eje→extremo");
assert((draftP.schedules?.length ?? 0) >= 2, "platea cuadro por paño y taller");
assert((draftP.schedules?.[0].rows.length ?? 0) >= 4, "platea una fila de acero por paño");
assert(draftP.layers.every((l) => (l.barPaths?.length ?? 0) >= 2), "platea barras dibujadas por paño");
assert(draftZ.dims.some((d) => /eje|L_teo/i.test(d.label)), "zapata cota eje→extremo");

console.log("OK engines");
