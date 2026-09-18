import { calcLosa2d, pesoLosaProfesional } from "../src/lib/engines/maestria/losa2dCalc.ts";
import { buildLosaDraftSpec, parseLosaSteelPack } from "../src/lib/engines/maestria/losa2dDraw.ts";
import {
  createLosaAxes,
  defaultModel,
  dumpMae,
  exampleModel,
  fillLosaRoof,
  hitMergeLine,
  identifyLosa,
  MIN_VANO_M,
  setSpan,
  toggleMerge,
} from "../src/lib/engines/maestria/types.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const ex = exampleModel("losa");
assert(ex.axesX[ex.axesX.length - 1] === 8.3, "Lx 8.30");
assert(ex.axesY[ex.axesY.length - 1] === 10, "Ly 10");
assert(ex.cells[0][1] === false, "hueco 1.0–4.40 × 0–5");
assert(ex.cells[0][0] && ex.cells[0][2] && ex.cells[1][0] && ex.cells[1][1] && ex.cells[1][2], "5 techos");

const found = identifyLosa(ex, "maciza");
assert(found.panes.length === 5, `5 paños, hay ${found.panes.length}`);
assert(found.voids.length === 1, "1 hueco");
assert(found.strips.length === 6, `6 franjas, hay ${found.strips.length}`);
assert(found.strips.filter((s) => s.dir === "x").length === 3, "3 franjas X (el hueco corta la fila inferior)");
assert(found.strips.filter((s) => s.dir === "y").length === 3, "3 franjas Y");

const hitOk = hitMergeLine(ex, 1.0, 7.5, 0.25);
assert(hitOk && hitOk.dir === "h", "unir entre 1.2 y 2.2 (línea x=1, y=5–10)");
const hitVoid = hitMergeLine(ex, 1.0, 2.5, 0.25);
assert(!hitVoid, "no une techo contra hueco");

const merged = toggleMerge(ex, hitOk!);
assert(merged.mergeH[1][0] === true, "mergeH de la línea interior");

const ax = setSpan([0, 4, 8], 0, 0.5);
assert(Math.abs(ax[1] - 0.5) < 1e-9, "vano 0.5 m");
const ax2 = setSpan(ax, 1, 1.2);
assert(Math.abs(ax2[2] - ax2[1] - 1.2) < 1e-9, "vano 1.2 m");
assert(MIN_VANO_M <= 0.3, "mínimo profesional 0.3 m");

const axes = createLosaAxes(ex, 3, 2, true);
assert(axes.cells.every((row) => row.every(Boolean)), "Crear ejes pinta techo");
assert(Math.abs(axes.axesX[1] - 1) < 1e-9, "conserva vano 1.0");

const ppM = pesoLosaProfesional({ tipo: "maciza", hCm: 15 });
assert(Math.abs(ppM.pp - 360) < 0.5, `maciza 360 kg/m², hay ${ppM.pp}`);
const ppA = pesoLosaProfesional({ tipo: "aligerada", hCm: 20, sCm: 40, bwCm: 10, hfCm: 5, relleno: "ladrillo" });
assert(ppA.pp < 2400 * 0.2 - 50, "aligerada más liviana que maciza 20 cm");
assert(ppA.pp > 250 && ppA.pp < 380, `aligerada ~300 kg/m², hay ${ppA.pp}`);

const mac = calcLosa2d({ studioJson: dumpMae(ex), h: "15", rec: "2.5", cv: "250", acab: "100", fy: "4200", fc: "210", tipoLosa: "maciza" });
assert(mac.steps[0].n === "01", "paso identificación");
assert(mac.headline.includes("5 paños"), mac.headline);
assert(mac.headline.includes("6 franjas"), mac.headline);
assert(mac.dims?.losaSteelJson, "losaSteelJson");
const pack = parseLosaSteelPack(mac.dims!.losaSteelJson!);
assert(pack && pack.steels.length === 5, "5 aceros de paño");
assert(pack && pack.voids.length === 1, "hueco en el pack");
const spec = buildLosaDraftSpec(ex, pack!);
assert(spec.regions && spec.regions.length >= 6, "regiones techo+hueco");
assert(spec.annos?.some((a) => a.text === "HUECO"), "etiqueta HUECO");
assert(spec.layers.some((l) => l.barPath && l.barPath.length > 2), "ganchos 90°");
assert(spec.title.includes("MACIZA"), spec.title);

const ali = calcLosa2d({
  studioJson: dumpMae(ex),
  h: "20",
  rec: "2.5",
  cv: "250",
  acab: "100",
  tab: "150",
  fy: "4200",
  fc: "210",
  tipoLosa: "aligerada",
  sAli: "40",
  bwAli: "10",
  hfAli: "5",
  relleno: "ladrillo",
});
assert(ali.headline.includes("aligerada"), ali.headline);
assert(ali.dims?.tipoLosa === "aligerada", "tipo en dims");
const ppStep = ali.steps.find((s) => s.n === "02");
assert(ppStep?.desarrollo?.some((ln) => ln.includes("Aligerada")), "paso peso aligerada");
assert(!String(ppStep?.result).includes("480"), "no usa pp de maciza 20 cm");

assert(defaultModel("losa").cells.every((row) => row.every(Boolean)), "default losa = techo");

const huecos = fillLosaRoof(createLosaAxes(ex, 3, 2, true), false);
assert(huecos.cells.every((row) => row.every((c) => !c)), "grilla hueca de control");
const fromHueco = calcLosa2d({
  studioJson: dumpMae(huecos),
  h: "15",
  rec: "2.5",
  cv: "250",
  acab: "100",
  fy: "4200",
  fc: "210",
  tipoLosa: "maciza",
});
assert(fromHueco.steps[0].n === "01", "no se aborta el expediente");
assert(fromHueco.headline.includes("6 paños"), fromHueco.headline);
const packHueco = parseLosaSteelPack(fromHueco.dims!.losaSteelJson!);
assert(packHueco && packHueco.steels.length === 6, "6 aceros al adoptar techo");
assert(packHueco && packHueco.steels.every((s) => /Ø/.test(s.infX) && /Ø/.test(s.supX)), "Ø en +X y −X");

const step07 = mac.steps.find((s) => s.n === "07");
assert(step07?.table?.headers.includes("As req"), "tabla Whitney con As req");
assert(step07?.desarrollo?.some((ln) => ln.includes("Rn")), "desarrollo Whitney con Rn");
assert(mac.steps.some((s) => s.n === "08"), "paso colocación");
assert(mac.extras?.[0]?.rows && mac.extras[0].rows.length >= 6, "cuadro de aceros con filas");

console.log("OK losa2d", mac.headline);
console.log("  franjas", found.strips.map((s) => s.id).join(", "));
console.log("  pp maciza 15 cm", ppM.pp, "  pp aligerada 20 cm", Math.round(ppA.pp));
console.log("  despiece layers", spec.layers.length, "regiones", spec.regions?.length);
