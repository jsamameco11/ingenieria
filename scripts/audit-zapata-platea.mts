import { calcZapataCorrida } from "../src/lib/engines/maestria/zapataCalc.ts";
import { calcPlatea } from "../src/lib/engines/maestria/plateaCalc.ts";
import { dumpMae, exampleModel, paintedInertia, puCol, colXY } from "../src/lib/engines/maestria/types.ts";

const zraw = {
  studioJson: dumpMae(exampleModel("zapata")),
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
};
const z = calcZapataCorrida(zraw);
console.log("=== ZAPATA ===");
console.log(z.headline);
console.log(z.adoption);
for (const c of z.checks) console.log((c.ok ? "OK " : "NO ") + c.label + "  " + c.value + " / " + c.limit);
console.log("dims", {
  hf: z.dims?.hf,
  asLong: z.dims?.asLong,
  asPrin: z.dims?.asPrin,
  asSup: z.dims?.asSup,
  asVCInf: z.dims?.asVCInf,
  punchKind: z.dims?.punchKind,
  punchVu: z.dims?.punchVu,
  punchPhi: z.dims?.punchPhi,
});
const m = exampleModel("zapata");
const g = paintedInertia(m);
let sumP = 0;
let Mx = 0;
let My = 0;
for (const c of m.cols) {
  const p = puCol(c);
  const xy = colXY(m, c);
  sumP += p.Pserv;
  Mx += p.Pserv * (xy.y - g.yc);
  My += p.Pserv * (xy.x - g.xc);
}
console.log("geom", {
  A: g.A.toFixed(2),
  xc: g.xc.toFixed(2),
  yc: g.yc.toFixed(2),
  Ixx: g.Ixx.toFixed(2),
  Iyy: g.Iyy.toFixed(2),
  nCol: m.cols.length,
  sumP: sumP.toFixed(1),
  PA: (sumP / g.A).toFixed(2),
  ex: (My / sumP).toFixed(3),
  ey: (Mx / sumP).toFixed(3),
});

const praw = {
  studioJson: dumpMae(exampleModel("platea")),
  t: "0.50",
  qadm: "1.5",
  Df: "1.2",
  gt: "1.8",
  sc: "0.3",
  Ks: "8",
  fc: "210",
  fy: "4200",
  rec: "7.5",
};
const p = calcPlatea(praw);
console.log("\n=== PLATEA ===");
console.log(p.headline);
console.log(p.adoption);
for (const c of p.checks) console.log((c.ok ? "OK " : "NO ") + c.label + "  " + c.value + " / " + c.limit);
console.log("dims", {
  t: p.dims?.t,
  asInfX: p.dims?.asInfX,
  asInfY: p.dims?.asInfY,
  asSupX: p.dims?.asSupX,
  asSupY: p.dims?.asSupY,
  punchKind: p.dims?.punchKind,
  punchVu: p.dims?.punchVu,
});
const mp = exampleModel("platea");
const gp = paintedInertia(mp);
console.log("platea A", gp.A.toFixed(1), "nCol", mp.cols.length, "P3s", mp.cols.map((c) => c.P3).slice(0, 6));
