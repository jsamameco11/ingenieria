import { writeFileSync, mkdirSync } from "node:fs";
import { estriboPantalla } from "../src/lib/engines/estriboPantalla.ts";
import { specEstriboPantalla } from "../src/lib/steelEngine.ts";
import { steelLdCm } from "../src/lib/steelDraft.ts";
import { barByName } from "../src/lib/types.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const raw: Record<string, string> = {
  H: "7", B: "4.7", D: "1.1", Lp: "1.1", tsup: "0.30", tinf: "0.90", N: "0.70",
  hparap: "1.5", bparap: "0.25", e1: "0.40", e2: "0.60", t1: "0.30", t2: "0.35",
  Ltab: "20", hviga: "1.5", skew: "0", hz: "1.5",
  gc: "2.4", gs: "1.925", phi: "30", delta: "0", beta: "0", theta: "90",
  qadm: "2.67", FS: "3", rocoso: "no", apoyo: "simple",
  PDC: "12", PDW: "1.8", PLL: "9.494", BR: "1.99", hBR: "1.8",
  WS: "0", CRSHTU: "0", eLosa: "0.30", gcs: "2.32",
  PGA: "0.3", FPGA: "1.2", fc: "210", fy: "4200", rec: "5", recZap: "7.5",
};

const out = estriboPantalla(raw);
const d = out.dims ?? {};
const spec = specEstriboPantalla({ ...raw, ...d });

const barP = barByName('3/4"');
const ld = steelLdCm(4200, 210, barP.db);
assert(ld > 30 && ld < 120, `ℓd 3/4" fuera de rango: ${ld}`);
assert(Number(d.yPa) > 2.2 && Number(d.yPa) < 2.5, `Pa debe estar a H/3 ≈ 2.33 m, yPa=${d.yPa}`);
assert(Math.abs(Number(d.yPae) - 0.6 * 7) < 0.02, `ΔPae a 0,6H=4.20 m, yPae=${d.yPae}`);
assert(Number(d.yW) > 1.5 && Number(d.yW) < 5, `ȳ PIR ${d.yW}`);
assert(Number(d.AsPantReq) > 0, "As pantalla");
assert(Number(d.AsPunReq) > 0, "As puntera");
assert(Number(d.AsTalReq) > 0, "As talón");

const marks = spec.layers.map((l) => l.mark);
assert(marks.join(",") === "1,2,3,4,5", `marcas ${marks}`);
for (const l of spec.layers) {
  assert(l.asReq != null && l.asReq > 0, `As req marca ${l.mark}`);
  assert(l.asProv + 1e-6 >= l.asReq * 0.98, `As disp ${l.asProv} < As req ${l.asReq} marca ${l.mark}`);
  assert(l.ldCm != null && l.ldCm >= 30, `ℓd marca ${l.mark}`);
  assert(l.recCm != null && l.recCm >= 4, `rec marca ${l.mark}`);
}

const outline = spec.outline.split(" ").map((p) => {
  const [x, y] = p.split(",").map(Number);
  return { x, y };
});
const xs = outline.map((p) => p.x);
const ys = outline.map((p) => p.y);
const bb = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
function insideLoose(x: number, y: number) {
  return x >= bb.x0 - 8 && x <= bb.x1 + 8 && y >= bb.y0 - 8 && y <= bb.y1 + 8;
}
for (const l of spec.layers) {
  const pts = [...(l.barPath ?? []), ...l.bars];
  const ok = pts.filter((p) => insideLoose(p.x, p.y)).length >= Math.max(1, pts.length - 2);
  assert(ok, `marca ${l.mark} sale del concreto`);
}

const stem = spec.layers[0].barPath ?? [];
const intra = spec.layers[1].barPath ?? [];
const pun = spec.layers[2].barPath ?? [];
const tal = spec.layers[3].barPath ?? [];
assert(stem.length >= 6, `trasdós demasiado corto (${stem.length})`);
assert(intra.length >= 6, `intradós demasiado corto (${intra.length})`);
const stemXs = stem.map((p) => p.x);
assert(Math.max(...stemXs) - Math.min(...stemXs) > 20, "trasdós debe recorrer el fuste y el gancho al talón");
const intraXs = intra.map((p) => p.x);
assert(Math.max(...intraXs) - Math.min(...intraXs) > 20, "intradós debe seguir el talud");

const yFootTop = 80 + (7 - 1.1) * (spec.pxPerM ?? 1);
const yFootBot = 80 + 7 * (spec.pxPerM ?? 1);
const stemInFoot = stem.filter((p) => p.y > yFootTop + 12 && p.y < yFootBot);
const intraInFoot = intra.filter((p) => p.y > yFootTop + 12 && p.y < yFootBot);
assert(stemInFoot.length >= 4, `trasdós no ancla en la zapata (${stemInFoot.length})`);
assert(intraInFoot.length >= 4, `intradós no ancla en la zapata (${intraInFoot.length})`);
assert(Math.min(...stem.map((p) => p.x)) < Math.min(...stemInFoot.map((p) => p.x)) + 80, "gancho trasdós hacia el talón");
assert(Math.max(...intra.map((p) => p.x)) > Math.max(...intra.filter((p) => p.y < yFootTop).map((p) => p.x)) - 5, "gancho intradós hacia la puntera");

const punY = pun.map((p) => p.y);
const talY = tal.map((p) => p.y);
assert(Math.max(...punY) - Math.min(...punY) > 16, "puntera debe tener ganchos en los extremos");
assert(Math.max(...talY) - Math.min(...talY) > 16, "talón debe tener ganchos en los extremos");

const temp = spec.layers[4];
const xStemL = Math.min(...stem.map((p) => p.x));
const xStemR = Math.max(...intra.filter((p) => p.y < yFootTop + 4).map((p) => p.x));
const underStem = (temp.bars ?? []).filter((p) => p.x > xStemL - 20 && p.x < xStemR + 20);
assert(underStem.length >= 2, `falta temperatura/continuidad bajo el fuste (${underStem.length})`);

for (const l of spec.layers) {
  const box = l.callout;
  const att = l.attach;
  if (!box || !att) continue;
  const dist = Math.hypot(box.x - att.x, box.y - att.y);
  assert(dist < 360, `placa ${l.mark} lejos del acero (${dist.toFixed(0)} px)`);
}

const paso38 = out.steps.find((s) => s.n === "38");
assert(paso38?.result.includes("As req"), "paso 38 As");
assert(paso38?.note?.includes("trasdós") || paso38?.note?.includes("tierra"), "paso 38 cara");

console.log("OK estribo steel");
console.log("  yPa", d.yPa, "yPae", d.yPae, "yW", d.yW, "PIR", d.PIR, "dPae", d.dPae);
console.log("  As pant/pun/tal", d.AsPantReq, d.AsPunReq, d.AsTalReq);
console.log("  asPant", d.asPant, "asPun", d.asPun, "asTal", d.asTal);
console.log("  layers", spec.layers.map((l) => `${l.mark}:${l.name} Ø${l.bar}@${l.sCm} As ${l.asReq}→${l.asProv.toFixed(2)} ℓd=${l.ldCm?.toFixed(0)}`).join(" | "));
console.log("  headline", out.headline);

const svgPaths = spec.layers
  .filter((l) => l.barPath && l.barPath.length > 1)
  .map((l) => {
    const d = l.barPath!.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    return `<path d="${d}" fill="none" stroke="${l.color}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  })
  .join("\n");
const svgDots = spec.layers
  .filter((l) => l.draw === "dots")
  .flatMap((l) => l.bars.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" fill="${l.color}" stroke="#120808"/>`))
  .join("\n");
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f4efe4">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${spec.W} ${spec.H}" width="${spec.W}" height="${spec.H}">
<rect width="${spec.W}" height="${spec.H}" fill="#f4efe4"/>
${spec.soil ? `<polygon points="${spec.soil}" fill="#cbb892" opacity="0.7"/>` : ""}
<polygon points="${spec.outline}" fill="#d9d2c3" stroke="#163a63" stroke-width="2.6"/>
${spec.cover ? `<polygon points="${spec.cover}" fill="none" stroke="#7a6240" stroke-dasharray="6 3"/>` : ""}
${svgPaths}
${svgDots}
</svg></body>`;
mkdirSync("tmp-mae-verify", { recursive: true });
writeFileSync("tmp-mae-verify/estribo-despiece.svg.html", html);
console.log("wrote tmp-mae-verify/estribo-despiece.svg.html", spec.W, spec.H);
