import { specMuroVoladizo } from "../src/lib/steelDraft.ts";
import { layoutTanqueIntze } from "../src/lib/metradoZonas.ts";
import { tanqueElevadoColumnas, tanqueElevadoFuste, reservorioApoyado } from "../src/lib/engines/tanques.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const muro = specMuroVoladizo({
  H: "4", D: "0.8", A: "2", C: "1.2", F: "0.65", Bp: "0.28", esp: "0.4", beta: "0", hk: "0.9", bk: "0.65",
  barAlma: '5/8"', sAlma: "15", barIntra: '3/8"', sIntra: "15", barPata: '5/8"', sPata: "15",
  barTalon: '5/8"', sTalon: "15", barDist: '3/8"', sDist: "15", barTemp: '3/8"', sTemp: "20",
});
assert(muro.layers.length >= 8, "muro layers with dentellon");
assert(muro.layers.some((l) => l.name.includes("Zapata lecho inferior")), "foot bot");
assert(muro.layers.some((l) => l.name.includes("Dentellón cara suelo")), "key soil");
assert(muro.layers.some((l) => l.name.includes("Longitudinal dentellón")), "key longs");
assert(muro.layers.some((l) => l.draw === "dots" && l.name.includes("Transversal")), "transverse");
assert(muro.caption.includes("0.60"), `hk debe caparse a 0,60 m: ${muro.caption}`);

const outline = muro.outline.split(" ").map((p) => {
  const [x, y] = p.split(",").map(Number);
  return { x, y };
});
const x0 = Math.min(...outline.map((p) => p.x));
const x1 = Math.max(...outline.map((p) => p.x));
const y0 = Math.min(...outline.map((p) => p.y));
const y1 = Math.max(...outline.map((p) => p.y));
const yFootTop = y0 + ((4 - 0.4) / 4.6) * (y1 - y0);

const soil = muro.layers.find((l) => l.mark === 7);
const inner = muro.layers.find((l) => l.mark === 8);
const longs = muro.layers.find((l) => l.mark === 9);
const intra = muro.layers.find((l) => l.mark === 2);
assert(soil && inner && longs && intra, "capas dentellón");
assert(longs.draw === "dots", "longitudinales en corte");
assert(Math.min(...(inner.barPath ?? []).map((p) => p.y)) > yFootTop + 8, "cara interior no debe llegar al alma");
assert(Math.min(...(soil.barPath ?? []).map((p) => p.y)) < yFootTop - 20, "cara suelo debe entrar al alma");
const intraAtFoot = (intra.barPath ?? []).reduce((best, p) => (Math.abs(p.y - yFootTop) < Math.abs(best.y - yFootTop) ? p : best), (intra.barPath ?? [])[0]);
const soilAtFoot = (soil.barPath ?? []).reduce((best, p) => (Math.abs(p.y - yFootTop) < Math.abs(best.y - yFootTop) ? p : best), (soil.barPath ?? [])[0]);
assert(soilAtFoot.x > intraAtFoot.x + 6, `dowel debe quedar interior al intradós (${soilAtFoot.x.toFixed(1)} vs ${intraAtFoot.x.toFixed(1)})`);
for (const p of longs.bars) {
  assert(p.x > x0 + 4 && p.x < x1 - 4 && p.y < y1 - 4 && p.y > yFootTop, `longitudinal en el aire ${p.x},${p.y}`);
}
const plateW = 220;
for (const l of muro.layers) {
  const box = l.callout;
  const att = l.attach;
  if (!box || !att) continue;
  const dist = Math.hypot(box.x - att.x, box.y - att.y);
  assert(dist < 360, `placa ${l.mark} lejos del acero (${dist.toFixed(0)}px)`);
  const plateX = box.anchor === "end" ? box.x - plateW : box.anchor === "start" ? box.x : box.x - plateW / 2;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  assert(!(plateX < cx && plateX + plateW > cx && Math.abs(box.y - cy) < 40), `placa ${l.mark} tapa el centro del concreto`);
}
console.log("MURO", muro.layers.map((l) => `${l.mark} ${l.name}`).join(" | "));
console.log("  hk cap", muro.caption.match(/Dentellón[^·]+/)?.[0], "dowel x", soilAtFoot.x.toFixed(1), "intra x", intraAtFoot.x.toFixed(1));

const zonas = layoutTanqueIntze({ R: 4, rp: 2.4, h1: 4, hCono: 1.5, fInf: 0.8, tMuro: 0.25, HL: 4.5, fSup: 1.6 });
const agua = zonas.zones.find((z) => z.n === 6);
assert(agua && agua.pts.length > 10, "water curve sampled");
const cupInf = zonas.zones.find((z) => z.n === 4);
assert(cupInf && cupInf.pts.length > 20, "lower dome sampled");
console.log("INTZE zonas", zonas.zones.map((z) => `${z.n}:${z.pts.length}pts`).join(" "));

const raw = { V: "400", Htorre: "14", fc: "210", fy: "4200", zona: "3", uso: "A", suelo: "S2" };
const col = tanqueElevadoColumnas(raw);
assert(col.steps.some((s) => s.n === "09b"), "collar sup step");
assert(col.steps.some((s) => s.n === "16b"), "column steel step");
assert(col.steps.some((s) => s.n === "16c"), "beam levels step");
assert(col.steps.some((s) => s.table?.caption?.includes("Vigas de arriostre")), "beam table");
console.log("COLUMNAS", col.headline, "steps", col.steps.length);

const fus = tanqueElevadoFuste({ V: "600", Htorre: "16", fc: "210", fy: "4200", zona: "3", uso: "A", suelo: "S2" });
assert(fus.steps.some((s) => s.n === "16b" && s.title.includes("Confinamiento")), "fuste conf");
console.log("FUSTE", fus.headline, "steps", fus.steps.length);

const ap = reservorioApoyado({ V: "80", rHD: "0.85", fc: "210", fy: "4200", zona: "3", uso: "A", suelo: "S2" });
assert(ap.steps.some((s) => s.n === "13" && s.table?.caption?.includes("zona")), "wall zones apoyado");
assert(ap.steps.some((s) => s.n === "14" && (s.desarrollo?.length ?? 0) >= 3), "whitney vert");
console.log("APOYADO", ap.headline, "steps", ap.steps.length);

console.log("OK tanques-steel");
