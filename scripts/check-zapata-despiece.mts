import { calcZapataCorrida } from "../src/lib/engines/maestria/zapataCalc.ts";
import { buildZapataCorridaDespieceSpec } from "../src/lib/engines/maestria/zapataCorridaDespiece.ts";
import { dumpMae, exampleModel } from "../src/lib/engines/maestria/types.ts";
import { zapataPlantFromValues } from "../src/lib/engines/maestria/zapataDraw.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const studio = dumpMae(exampleModel("zapata"));
const zap = calcZapataCorrida({
  studioJson: studio,
  tipo: "columnas",
  qadm: "2",
  Df: "1.5",
  gt: "1.8",
  sc: "0.3",
  hf: "0.45",
  fc: "210",
  fy: "4200",
  rec: "7.5",
  bBeam: "0.4",
  hBeam: "0.6",
});
assert(zap.dims?.asPrin, "asPrin");
assert(zap.dims?.asDist, "asDist");
assert(zap.dims?.asSup, "asSup");
assert(zap.dims?.asPrinPanes, "asPrinPanes");
assert(zap.dims?.AsDist, "AsDist");
assert(Number(zap.dims?.AsPrin) > 0, "AsPrin > 0");
assert(Number(zap.dims?.AsDist) > 0, "AsDist > 0");

const values = { ...zap.dims, studioJson: studio, tipo: "columnas", rec: "7.5", fy: "4200", fc: "210" } as Record<string, string>;
const plant = zapataPlantFromValues(values);
const spec = buildZapataCorridaDespieceSpec(values);
const trans = spec.layers.find((l) => l.mark === 1);
const inf = spec.layers.find((l) => l.mark === 2);
const sup = spec.layers.find((l) => l.mark === 3);
assert(trans && inf && sup, "3 marcas");
assert((trans?.barPaths?.length ?? 0) === plant.cells.length, `trans=paños (${trans?.barPaths?.length} vs ${plant.cells.length})`);
assert((inf?.barPaths?.length ?? 0) >= 1, "al menos 1 inf continuo");
assert((inf?.barPaths?.length ?? 99) <= 3, `inf por franja, no por paño (${inf?.barPaths?.length})`);
assert((sup?.barPaths?.length ?? 0) >= 1, "al menos 1 sup");
assert((spec.lineScale ?? 1) <= 0.4, "varilla fina");
assert(spec.regions?.filter((r) => r.hatch).length === plant.cells.length, "regiones = paños");
assert(spec.dims.some((d) => /eje|L_teo/i.test(d.label)), "cota desde el eje al extremo de la barra");
assert(Number(zap.dims?.hBeam) + 1e-6 >= Number(zap.dims?.hPred) - 0.01, `h VC ${zap.dims?.hBeam} ≥ ℓn/7 ${zap.dims?.hPred}`);

const padL = 120;
const padT = 92;
const sc = spec.pxPerM ?? 1;
const recM = 0.075;
function worldOf(p: { x: number; y: number }) {
  return { x: plant.x0 + (p.x - padL) / sc, y: plant.y1 - (p.y - padT) / sc };
}
function inPainted(x: number, y: number) {
  return plant.cells.some((c) => x >= c.x0 - 0.12 && x <= c.x1 + 0.12 && y >= c.y0 - 0.12 && y <= c.y1 + 0.12);
}
for (const layer of spec.layers) {
  for (const path of layer.barPaths ?? []) {
    const mid = path[Math.floor(path.length / 2)];
    const w = worldOf(mid);
    assert(inPainted(w.x, w.y), `${layer.name} sale de la zapata (${w.x.toFixed(2)}, ${w.y.toFixed(2)})`);
  }
}

const infLen = (inf?.barPaths ?? []).map((p) => {
  const a = worldOf(p[0]);
  const b = worldOf(p[p.length - 1]);
  return Math.hypot(a.x - b.x, a.y - b.y);
});
const supLen = (sup?.barPaths ?? []).map((p) => {
  const a = worldOf(p[0]);
  const b = worldOf(p[p.length - 1]);
  return Math.hypot(a.x - b.x, a.y - b.y);
});
const maxInf = Math.max(...infLen, 0);
const maxSup = Math.max(...supLen, 0);
if ((sup?.barPaths?.length ?? 0) > 1) {
  assert(maxSup < maxInf - recM, `sup (${maxSup.toFixed(2)}) debe cortarse vs inf (${maxInf.toFixed(2)})`);
}
console.log("ZAPATA DESPIECE OK", {
  cells: plant.cells.length,
  trans: trans?.barPaths?.length,
  inf: inf?.barPaths?.length,
  sup: sup?.barPaths?.length,
  asPrin: zap.dims?.asPrin,
  asDist: zap.dims?.asDist,
  asSup: zap.dims?.asSup,
  hf: zap.dims?.hf,
  lineScale: spec.lineScale,
  maxInf: maxInf.toFixed(2),
  maxSup: maxSup.toFixed(2),
});
console.log(zap.headline);
for (const c of zap.checks) console.log((c.ok ? "OK " : "NO ") + c.label + "  " + c.value + " / " + c.limit);

{
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  mkdirSync(".tmp-figs", { recursive: true });
  const dOf = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const regions = (spec.regions ?? [])
    .map(
      (r) =>
        `<polygon points="${r.points}" fill="${r.fill ?? "#e8dcc0"}" stroke="${r.stroke ?? "#163a63"}" stroke-width="1.8"/>`,
    )
    .join("");
  const bars = spec.layers
    .flatMap((l) =>
      (l.barPaths ?? []).map(
        (p) =>
          `<path d="${dOf(p)}" fill="none" stroke="${l.color}" stroke-width="${l.mark === 1 ? 1.8 : 1.4}" stroke-linecap="round" stroke-linejoin="round"/>`,
      ),
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${spec.W} ${spec.H}" width="${spec.W}" height="${spec.H}">
<rect width="100%" height="100%" fill="#f4efe4"/>
${regions}${bars}
</svg>`;
  writeFileSync(join(".tmp-figs", "zapata-corrida-despiece.svg"), svg, "utf8");
  console.log("wrote .tmp-figs/zapata-corrida-despiece.svg");
}
