import { specAnilloViga, specCascaron1m, specColumnaCircular, specFustePared, specMuroVoladizo } from "../src/lib/steelDraft.ts";
import { layoutTanqueCircular, layoutTanqueIntze, layoutTanqueRect } from "../src/lib/metradoZonas.ts";
import { tanqueElevadoColumnas, tanqueElevadoFuste, reservorioApoyado, reservorioCuadrado } from "../src/lib/engines/tanques.ts";
import { femCilindro, femFusteCantilever, femMuroRect } from "../src/lib/engines/tanquesFem.ts";

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
const nums = zonas.zones.map((z) => z.n);
assert(new Set(nums).size === nums.filter((n, i) => nums.indexOf(n) === i).length || nums.includes(1), "zones exist");
const uniqueConcrete = zonas.zones.filter((z) => z.material === "concreto").map((z) => `${z.n}:${z.label}`);
assert(uniqueConcrete.filter((x, i, a) => a.indexOf(x) === i).length === uniqueConcrete.length, "no duplicate concrete labels");
const agua = zonas.zones.find((z) => z.label.startsWith("Agua"));
assert(agua && agua.n === 7 && agua.pts.length > 10, "water is zone 7 with sampled curve");
const anilloSup = zonas.zones.find((z) => z.label.includes("Anillo superior"));
const anilloInf = zonas.zones.find((z) => z.label.includes("Anillo inf"));
assert(anilloSup && anilloInf && anilloSup.n !== anilloInf.n, "rings have distinct numbers");
const cupInf = zonas.zones.find((z) => z.n === 4);
assert(cupInf && cupInf.pts.length > 20, "lower dome sampled");
assert(zonas.ground === false, "elevated cuba has no ground hatch");
console.log("INTZE zonas", zonas.zones.map((z) => `${z.n}:${z.label}`).join(" | "));

const circ = layoutTanqueCircular({ D: 8, HL: 3.5, H: 3.8, tMuro: 0.25, tLosa: 0.2, tDomo: 0.08, fDomo: 1.3 });
assert(circ.zones.length === 4, "circular 4 zones matching table");
assert(circ.ground === true, "apoyado has ground");
const rect = layoutTanqueRect({ Lx: 6, Ly: 5, HL: 3.2, H: 3.5, tMuro: 0.25, tTecho: 0.15, tLosa: 0.2 });
assert(rect.zones.filter((z) => z.n === 1).length === 2, "rect shows both walls");

const colSec = specColumnaCircular({ title: "Columna", dCm: 50, recCm: 4, nLong: 8, barLong: '3/4"', barEst: '3/8"', sEstCm: 10 });
assert(colSec.layers[0].nReal === 8 && colSec.layers[0].bars.length === 8, "8 longs around circle");
assert(colSec.layers[1].barPath && colSec.layers[1].barPath.length > 10, "circular stirrup");
const anillo = specAnilloViga({ title: "Anillo", bCm: 30, hCm: 40, recCm: 4, longText: '6 Ø 5/8"', estText: 'Ø 3/8" @ 15' });
assert(anillo.layers.length >= 2, "anillo layers");
assert(anillo.layers[0].bars.length >= 6, "anillo longs around section");
assert(anillo.layers.some((l) => l.barPath && l.barPath.length >= 6), "anillo closed stirrup");
assert(anillo.subtitle.includes("Anillo"), "anillo title");
assert(anillo.groundY == null && !anillo.soil, "anillo sin terreno");
const cup = specCascaron1m({ title: "Cúpula", hCm: 10, recCm: 3, intraText: 'Ø 3/8" @ 20', extraText: 'Ø 3/8" @ 20' });
assert(cup.layers[0].name.includes("intradós"), "cascaron intradós");
assert(cup.groundY == null, "cascaron sin terreno");
const fusP = specFustePared({ title: "Fuste", eCm: 25, recCm: 4, vertText: 'Ø 5/8" @ 15', horText: 'Ø 3/8" @ 15' });
assert(fusP.layers.length >= 3, "fuste inner outer horiz");
assert(fusP.layers[0].name.includes("interior"), "fuste cara interior");

const raw = { V: "400", Htorre: "14", fc: "210", fy: "4200", zona: "3", uso: "A", suelo: "S2" };
const col = tanqueElevadoColumnas(raw);
assert(col.steps.some((s) => s.n === "09b"), "collar sup step");
assert(col.steps.some((s) => s.n === "16b"), "column steel step");
assert(col.steps.some((s) => s.n === "16c"), "beam levels step");
assert(col.steps.some((s) => s.table?.caption?.includes("Vigas de arriostre")), "beam table");
assert(col.steps.some((s) => /Esbeltez y segundo orden/.test(s.title)), "slenderness step");
const dCol400 = Number(col.dims?.dCol ?? 99);
assert(dCol400 >= 0.40 && dCol400 <= 0.70, `columna 400 m³ Ø mínima, no métrica: ${dCol400} m`);
console.log("COLUMNAS", col.headline, col.adoption, "steps", col.steps.length);

const def150 = tanqueElevadoColumnas({ V: "150", Htorre: "14", fc: "210", fy: "4200", zona: "4", suelo: "S2", categoria: "B" });
const dCol150 = Number(def150.dims?.dCol ?? 99);
assert(dCol150 >= 0.40 && dCol150 <= 0.60, `default 150 m³ debe quedar Ø 40–60 cm, no 105: ${dCol150} m`);
console.log("DEFAULT 150", def150.adoption);

const fus = tanqueElevadoFuste({ V: "600", Htorre: "16", fc: "210", fy: "4200", zona: "3", uso: "A", suelo: "S2" });
assert(fus.steps.some((s) => s.n === "16b" && s.title.includes("Confinamiento")), "fuste conf");
console.log("FUSTE", fus.headline, "steps", fus.steps.length);

const ap = reservorioApoyado({ V: "80", rHD: "0.85", fc: "210", fy: "4200", zona: "3", uso: "A", suelo: "S2" });
assert(ap.steps.some((s) => s.n === "13" && s.table?.caption?.includes("zona")), "wall zones apoyado");
assert(ap.steps.some((s) => s.n === "14" && (s.desarrollo?.length ?? 0) >= 3), "whitney vert");
assert(ap.steps.some((s) => /Motor FEM/.test(s.title)), "apoyado FEM step");
assert(Number(ap.dims?.femElem ?? 0) >= 8, `apoyado femElem ${ap.dims?.femElem}`);
console.log("APOYADO", ap.headline, "steps", ap.steps.length, "FEM", ap.dims?.femElem, "elem");

const recRes = reservorioCuadrado({ V: "80", rHB: "0.85", rLB: "1.2", fc: "210", fy: "4200", zona: "3", uso: "A", suelo: "S2" });
assert(recRes.steps.some((s) => /MITC4/.test(s.title) || /Motor FEM/.test(s.title)), "rect FEM step");
assert(recRes.dims?.mPtsVert && recRes.dims.mPtsVert.includes(","), "rect vertical M diagram packed");
console.log("RECTANGULAR", recRes.headline, "FEM", recRes.dims?.femElem, "elem ok", recRes.dims?.femOk);
assert(recRes.dims?.femOk === "1", "rect femOk");
assert(Number(recRes.dims?.MhorEsq ?? 0) > Number(recRes.dims?.MhorVano ?? 0), `rect memoria esquina ${recRes.dims?.MhorEsq} vs vano ${recRes.dims?.MhorVano}`);

assert(col.steps.some((s) => /Motor FEM de la torre/.test(s.title)), "columnas FEM step");
assert(Number(col.dims?.femNodos ?? 0) >= 8, `columnas nudos ${col.dims?.femNodos}`);
assert(fus.steps.some((s) => /Motor FEM del fuste/.test(s.title)), "fuste FEM step");
assert(Number(fus.dims?.femElem ?? 0) >= 6, `fuste elem ${fus.dims?.femElem}`);
assert(fus.dims?.mPtsFuste && fus.dims.mPtsFuste.split(";").length >= 6, "fuste M(z) has FEM samples");
{
  const Mfem = Number(fus.dims?.Mvolteo ?? 0);
  const Mclosed = Math.hypot(Number(fus.dims?.Pi ?? 0) * Number(fus.dims?.hiIBP ?? 0), Number(fus.dims?.Pc ?? 0) * Number(fus.dims?.hcIBP ?? 0));
  assert(Mclosed > 0 && Math.abs(Mfem - Mclosed) / Mclosed < 0.03, `fuste memoria M ${Mfem} vs brazo ${Mclosed}`);
}

const lam = femCilindro({ H: 4, R: 4, t: 0.25, fc: 210, presion: (y) => Math.max(0, 4 - y) });
assert(lam.pts.length >= 10, "femCilindro pts");
assert(Math.abs(lam.pts[0].w) < 1e-9, "cilindro base w=0");
assert(Math.max(...lam.pts.map((p) => Math.abs(p.N))) > 0.1, "cilindro N hidro");

const muroF = femMuroRect({ L: 5, H: 3.5, t: 0.25, fc: 210, presion: (z) => Math.max(0, 3.2 - z), techo: true, nx: 6, nz: 8 });
assert(muroF.ok, "femMuroRect ok");
assert(muroF.nElem === 6 * 8, `muro nElem ${muroF.nElem}`);
assert(muroF.MhorEsq > muroF.MhorVano, `esquina ${muroF.MhorEsq} debe superar vano ${muroF.MhorVano}`);
assert(Math.abs(muroF.mHor[0]?.M ?? 0) > 1e-4, "mHor no dummy en esquina");
assert(Math.abs(muroF.mVert[0]?.M ?? 0) > 1e-4, "mVert no dummy en base");

const fusF = femFusteCantilever({
  H: 16, Dext: 4, Dint: 3.5, fc: 210,
  Pi: 80, Pc: 20, hI: 18, hC: 19.5,
  Wshaft: 200, Wtop: 600, WiTotal: 800, nElem: 8,
});
assert(fusF.T > 0.05 && fusF.T < 2, `fuste T ${fusF.T}`);
assert(fusF.Mbase > 10, `fuste Mbase ${fusF.Mbase}`);
assert(Math.abs(fusF.Mbase - Math.hypot(80 * 18, 20 * 19.5)) / Math.hypot(80 * 18, 20 * 19.5) < 0.03, `fuste M vs hi ${fusF.Mbase}`);
assert(fusF.deltaTop > 0, "fuste deltaTop");

console.log("OK tanques-steel");
