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
assert(low.layers.some((l) => /superior/.test(l.name)), "hay superior en apoyos");
assert(low.layers.some((l) => /Estribos/.test(l.name)), "hay estribos");
assert(!low.layers.some((l) => /[Tt]emperatura/.test(l.name)), "sin temperatura si h=60 cm");
const est = low.layers.find((l) => /Estribos/.test(l.name))!;
assert(est.draw === "bar" && (est.barPaths?.length ?? 0) > 8, "estribos verticales, no puntos a media altura");
assert(est.barPaths!.every((p) => p.length === 2 && Math.abs(p[0].x - p[1].x) < 0.8), "estribo = trazo vertical");
const inf = low.layers.find((l) => /inferior/.test(l.name))!;
assert(inf.qty === "7 Ø" && inf.sCm === 0, "inferior en n Ø, no @ 0 cm");
const sup = low.layers.find((l) => /superior/.test(l.name))!;
assert((sup.barPaths?.length ?? 0) === 3, `un corte por apoyo, hay ${sup.barPaths?.length}`);
const midY = inf.barPath![0].y;
assert(
  sup.barPaths!.every((p) => Math.abs((p[0].y + p[1].y) / 2 - midY) > 20),
  "el superior no comparte la altura del inferior",
);

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

console.log("OK viga cimentación despiece", low.layers.map((l) => `${l.mark} ${l.qty} ${l.bar}`).join(" · "));
console.log("  h=75 temp", temp!.bar, temp!.qty);
