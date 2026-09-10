import { MODULES } from "../src/lib/catalog";
import { asentamientos } from "../src/lib/engines/geotecnia";

const m = MODULES.find((x) => x.slug === "asentamientos")!;
const r = asentamientos(m.defaults);
console.log(r.headline);
console.log(r.adoption);
console.log("steps", r.steps.length);
for (const s of r.steps) console.log(s.n, s.title);
console.log("checks", r.checks.map((c) => `${c.ok ? "OK" : "NO"} ${c.label}`).join(" | "));
console.log("fields", m.fields.length);
