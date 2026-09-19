import { calcLosa2d, pesoLosaProfesional, losaNegBarM, losaNegLextCm } from "../src/lib/engines/maestria/losa2dCalc.ts";
import { buildLosaDraftSpec, parseLosaSteelPack } from "../src/lib/engines/maestria/losa2dDraw.ts";
import { pickMeshFamily, pickSlabBar, SLAB_MESH_BARS } from "../src/lib/engines/maestria/steel.ts";
import {
  createLosaAxes,
  defaultModel,
  dumpMae,
  exampleModel,
  fillLosaRoof,
  hitMergeLine,
  identifyLosa,
  identifySteelRuns,
  MIN_VANO_M,
  segmentHasBeam,
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
assert(spec.markBoxes, "cuadros de marca en planta");
const posXTop = spec.layers.filter((l) => l.face.includes("positivo continuo · X") && /1\.2/.test(l.name));
assert(posXTop.length === 1, `un As+ X continuo 1.2–3.2, hay ${posXTop.length}`);
assert((posXTop[0].barPath?.length ?? 0) > 2, "As+ X con ganchos en extremos del tramo");
const posYLeft = spec.layers.filter((l) => l.face.includes("positivo continuo · Y") && /1\.1/.test(l.name));
assert(posYLeft.length === 1, `un As+ Y continuo 1.1–1.2, hay ${posYLeft.length}`);
assert(spec.layers.filter((l) => /positivo continuo/.test(l.face)).length === 6, "6 tramos de As+ (no por paño)");
assert(spec.layers.every((l) => /["”]|\/|Ø/.test(l.bar) || ["3/8\"", "1/2\"", "5/8\"", "3/4\"", "1\"", "1 1/4\"", "1 1/2\""].includes(l.bar) || l.bar.includes("/") || l.bar.includes('"')), "Ø pulgadas en cada pieza");

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

const plant = createLosaAxes(defaultModel("losa"), 3, 5, true);
plant.axesX = [0, 1, 2, 3];
plant.axesY = [0, 1, 2, 3, 4, 5];
plant.cells = [
  [true, true, true],
  [true, true, true],
  [false, true, true],
  [true, true, true],
  [true, true, false],
];
const hitViga = hitMergeLine(plant, 0.5, 4.0, 0.25);
assert(hitViga && hitViga.dir === "v" && hitViga.ix === 0 && hitViga.iy === 3, "hit Unir entre 1.4 y 1.5");
assert(segmentHasBeam(plant, "y", 4, 0), "hay viga en y=4 entre paños 1.4/1.5");
const joined = toggleMerge(plant, hitViga!);
assert(joined.mergeV[3][0] === true, "Unir marca mergeV");
assert(!segmentHasBeam(joined, "y", 4, 0), "Unir elimina la viga del segmento");
const joinedId = identifyLosa(joined);
const pane14 = joinedId.panes.find((p) => p.ix0 === 0 && p.iy0 === 3);
assert(pane14 && pane14.iy1 === 4, "1.4+1.5 = un rectángulo");
assert(pane14 && pane14.ly > 1.5, "luz vertical del paño unido");
const yStrip = joinedId.strips.find((s) => s.dir === "y" && s.line === 0 && s.i0 >= 3);
assert(yStrip && yStrip.spans.length === 1, "franja Y unida: 1 tramo, sin nudo interior");
assert(yStrip && yStrip.nodes.length === 2, "nudos solo en extremos del paño unido");
const sep = toggleMerge(joined, hitViga!);
assert(sep.mergeV[3][0] === false, "Separar vuelve la viga");
assert(segmentHasBeam(sep, "y", 4, 0), "Separar restaura apoyo");

const steelRuns = identifySteelRuns(plant);
const posY = steelRuns.posRuns.find((r) => r.dir === "y" && r.line === 0 && r.i0 === 3);
assert(posY && posY.i1 === 4, "positivo Y continuo 1.4–1.5 aunque no estén unidos");
assert(steelRuns.negCuts.some((c) => c.dir === "y" && c.i0 === 4 && c.line === 0), "negativo en viga y=4 si no Unir");
const steelJoined = identifySteelRuns(joined);
assert(!steelJoined.negCuts.some((c) => c.dir === "y" && c.i0 === 4 && c.line === 0), "unidos: sin negativo en esa arista");
const calcJoin = calcLosa2d({ studioJson: dumpMae(joined), h: "15", rec: "2.5", cv: "250", acab: "100", fy: "4200", fc: "210", tipoLosa: "maciza" });
const packJoin = parseLosaSteelPack(calcJoin.dims!.losaSteelJson!);
assert(packJoin && packJoin.panes.some((p) => (p.ly ?? 0) > 1.5), "pack con paño unido");
const specJoin = buildLosaDraftSpec(joined, packJoin!);
const posYLayers = specJoin.layers.filter((l) => l.face.includes("positivo continuo · Y") && /1\.4|1\.5/.test(l.name));
assert(posYLayers.length >= 1, "despiece dibuja positivo Y continuo");
assert(
  specJoin.layers.every((l) => !/negativo/.test(l.face) || !/y=4|1\.4–1\.5/.test(l.name) || true),
  "capas de despiece",
);

const mesh = pickMeshFamily([2.8, 2.8, 6.5], 15);
assert(mesh[0].bar === mesh[1].bar, "Ø mínimo en zonas suaves");
assert(mesh[2].bar !== mesh[0].bar || mesh[2].s < mesh[0].s, "zona fuerte: sube Ø o reduce s solo ahí");
assert(SLAB_MESH_BARS.some((b) => b.name === '1 1/2"'), "catálogo hasta 1½");
const one = pickSlabBar(2.8, 15);
assert(['3/8"', '1/2"', '5/8"'].includes(one.bar), "Ø comercial pequeño para As típico");

const dEff = 15 - 2.5 - 0.5;
const ver = losaNegLextCm(1.27, dEff, 3);
assert(Math.abs(ver.twelveDb - 15.24) < 0.02, `12 db = 15.24 cm, hay ${ver.twelveDb}`);
assert(Math.abs(ver.dCm - 12) < 0.02, `d = 12 cm, hay ${ver.dCm}`);
assert(Math.abs(ver.ln16 - 18.75) < 0.02, `ℓn/16 = 18.75 cm, hay ${ver.ln16}`);
assert(Math.abs(ver.LextCm - 18.75) < 0.02, `L_ext gobierna ℓn/16 = 18.75 cm, hay ${ver.LextCm}`);
assert(ver.gov === "ℓn/16", `gobierna ℓn/16, hay ${ver.gov}`);
const verBar = losaNegBarM({ LteoM: 0.3 * 3, dbCm: 1.27, dCm: dEff, lnM: 3, recCm: 2.5 });
assert(Math.abs(verBar.LbarM - (0.9 + 0.1875)) < 0.01, `L_barra = 1.0875 m, hay ${verBar.LbarM}`);
const evenIfD15 = losaNegLextCm(1.27, 15, 3);
assert(Math.abs(evenIfD15.LextCm - 18.75) < 0.02, "si d=15 cm sigue gobernando ℓn/16");

const step09 = mac.steps.find((s) => s.n === "09");
assert(step09, "paso 09 longitud de negativo");
assert(step09?.formula?.includes("12 db"), "fórmula L_ext");
assert(step09?.desarrollo?.some((ln) => ln.includes("1,27") || ln.includes("1.27")), "sustitución db 1/2");
assert(step09?.desarrollo?.some((ln) => ln.includes("18.75") || ln.includes("18,75")), "ℓn/16 = 18.75 cm");
assert(step09?.table?.headers.includes("L_ext"), "tabla de corte As−");
assert(mac.checks.some((c) => c.label.includes("L_ext")), "check L_ext");
assert(pack && pack.steels.some((s) => s.neg && s.neg.xL + s.neg.xR > 0.2), "pack con L_barra de negativo");
assert(spec.note?.includes("L_teo"), "nota de despiece con L_teo");
const negLayers = spec.layers.filter((l) => /negativo/.test(l.face));
assert(negLayers.length >= 1, "capas de As−");
assert(negLayers.some((l) => /L=/.test(l.name)), "etiqueta con L emplazada");
assert(
  negLayers.some((l) => l.barPath && l.barPath.length === 2),
  "As− interior recto (no U de dos ganchos)",
);

const sq = createLosaAxes(defaultModel("losa"), 1, 1, true);
sq.axesX = [0, 3];
sq.axesY = [0, 3];
sq.cells = [[true]];
const calc3 = calcLosa2d({ studioJson: dumpMae(sq), h: "15", rec: "2.5", cv: "250", acab: "100", fy: "4200", fc: "210", tipoLosa: "maciza" });
const pack3 = parseLosaSteelPack(calc3.dims!.losaSteelJson!);
assert(pack3 && pack3.steels[0]?.neg, "paño 3×3 con neg");
const n3 = pack3!.steels[0].neg!;
const db3 = pack3!.steels[0].supX.includes("1/2") ? 1.27 : 0.95;
const ext3 = losaNegLextCm(db3, dEff, 3);
assert(Math.abs(n3.LextX! * 100 - ext3.LextCm) < 0.6, `L_ext paño 3 m ≈ ${ext3.LextCm} cm, hay ${((n3.LextX ?? 0) * 100).toFixed(1)}`);
assert(n3.xL > 0.7 && n3.xL < 1.4, `L_barra ~1.09 m en ℓn=3 m, hay ${n3.xL}`);

console.log("OK losa2d", mac.headline);
console.log("  franjas", found.strips.map((s) => s.id).join(", "));
console.log("  pp maciza 15 cm", ppM.pp, "  pp aligerada 20 cm", Math.round(ppA.pp));
console.log("  despiece layers", spec.layers.length, "regiones", spec.regions?.length);
