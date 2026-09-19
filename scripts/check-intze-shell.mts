import { sphereBowlShell, layoutTanqueIntze } from "../src/lib/metradoZonas.ts";

const s = sphereBowlShell(3.38, 1.13, 0.12, 72);
let minT = 1e9, maxT = 0;
for (let i = 0; i < s.inner.length; i++) {
  const [xi, yi] = s.inner[i], [xo, yo] = s.outer[i];
  const t = Math.hypot(xo - xi, yo - yi);
  minT = Math.min(minT, t);
  maxT = Math.max(maxT, t);
}
console.log("t min/max/target", minT.toFixed(5), maxT.toFixed(5), "0.12");
const L = layoutTanqueIntze({
  R: 5.625, rp: 3.38, h1: 4.92, hCono: 2.03, fInf: 1.13,
  tMuro: 0.375, tDomoInf: 0.12, tDomoSup: 0.08, HL: 5.63,
});
console.log(L.zones.map((z) => `${z.n} ${z.label} pts=${z.pts.length}`).join("\n"));
