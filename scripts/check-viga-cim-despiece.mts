import { buildVigaCimentacionDespieceSpec } from "../src/lib/engines/maestria/vigaCimentacionDespiece.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const low = buildVigaCimentacionDespieceSpec({
  Lbeam: "16",
  bBeam: "0.4",
  hBeam: "0.60",
  recVC: "7.5",
  asVCInf: '7 Ø 1"',
  asVCSup: '4 Ø 5/8"',
  estVC: '2Ø 3/8"',
  sApoyoVC: "10",
  sCentroVC: "20",
  LzonaVC: "1.2",
  vcColsJson: JSON.stringify({ cols: [{ x: 4 }, { x: 8 }, { x: 12 }] }),
});

assert(low.layers.some((l) => /inferior/.test(l.name)), "hay inferior corrido");
assert(low.layers.some((l) => /superior corrido/.test(l.name)), "hay superior corrido");
assert(low.layers.some((l) => /en apoyos/.test(l.name)), "el resto del superior se corta en apoyos");
assert(low.layers.some((l) => /Estribos/.test(l.name)), "hay estribos");
assert(!low.layers.some((l) => /[Tt]emperatura/.test(l.name)), "sin temperatura si h=60 cm");
const est = low.layers.find((l) => /Estribos/.test(l.name))!;
assert(est.hair === true, "estribo en trazo fino");
assert(est.draw === "bar" && (est.barPaths?.length ?? 0) > 8, "estribos verticales, no puntos a media altura");
assert(est.barPaths!.every((p) => p.length === 2 && Math.abs(p[0].x - p[1].x) < 0.8), "estribo = trazo vertical");
assert(est.nReal > est.barPaths!.length || est.barPaths!.length > 8, "el metrado de estribos no se pierde");
const inf = low.layers.find((l) => /inferior/.test(l.name))!;
assert(inf.qty === "7 Ø" && inf.sCm === 0 && inf.nReal >= 2, "inferior en n Ø, mínimo 2 corridos");
assert((inf.barPaths?.length ?? 0) === 2, "el lecho inferior se lee como dos barras");
const xSpan = (pts: { x: number }[]) => Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
assert(inf.barPaths!.every((p) => xSpan(p) > (low.pxPerM ?? 0) * 14), "inferior corrido en toda la luz");
const sup = low.layers.find((l) => /superior corrido/.test(l.name))!;
assert(sup.nReal === 2 && (sup.barPaths?.length ?? 0) === 2, "dos superiores corridos");
assert(sup.barPaths!.every((p) => xSpan(p) > (low.pxPerM ?? 0) * 14), "superior corrido en toda la luz");
const extra = low.layers.find((l) => /en apoyos/.test(l.name))!;
assert(extra.nReal === 2 && (extra.barPaths?.length ?? 0) === 3, `adicional: un corte por apoyo, hay ${extra.barPaths?.length}`);
const yOf = (pts: { y: number }[]) => pts.reduce((s, p) => s + p.y, 0) / pts.length;
assert(yOf(sup.barPaths![0]) < yOf(inf.barPaths![0]) - 8, "el superior no comparte la altura del inferior");
const outlineY = low.outline.split(" ").map((s) => Number(s.split(",")[1]));
const hPx = Math.max(...outlineY) - Math.min(...outlineY);
assert(Math.abs(hPx / (low.pxPerM ?? 1) - 0.6) < 0.02, `peralte a la misma escala que L, hPx=${hPx.toFixed(1)}`);
assert(low.dims.some((d) => d.label === "h = 0.60 m"), "la cota vertical es el peralte, no la longitud");
assert(!low.annos?.some((a) => a.text === "16.00 m"), "no repetir L como si fuera el canto");

const deep = buildVigaCimentacionDespieceSpec({
  Lbeam: "12",
  bBeam: "0.5",
  hBeam: "0.75",
  recVC: "7.5",
  asVCInf: '4 Ø 3/4"',
  asVCSup: '2 Ø 1/2"',
  estVC: '2Ø 3/8"',
  sApoyoVC: "10",
  sCentroVC: "20",
  vcColsJson: JSON.stringify({ cols: [{ x: 4 }, { x: 8 }] }),
});
const temp = deep.layers.find((l) => /[Tt]emperatura/.test(l.name));
assert(temp, "temperatura si h=75 cm");
assert(temp!.bar === '1/2"' && temp!.nReal === 2, "temperatura 2 Ø 1/2\"");
assert(temp!.barPath && temp!.barPath.length >= 2, "temperatura corrida a media altura");
const deepSup = deep.layers.find((l) => /superior corrido/.test(l.name))!;
assert(deepSup.nReal === 2 && !deep.layers.some((l) => /en apoyos/.test(l.name)), "con 2 Ø superiores no hay corte adicional");
const deepH = deep.outline.split(" ").map((s) => Number(s.split(",")[1]));
const deepPx = Math.max(...deepH) - Math.min(...deepH);
assert(Math.abs(deepPx / (deep.pxPerM ?? 1) - 0.75) < 0.02, "h=0.75 m a escala");

console.log("OK viga cimentación despiece", low.layers.map((l) => `${l.mark} ${l.qty} ${l.bar}`).join(" · "));
console.log("  h=75 temp", temp!.bar, temp!.qty);
