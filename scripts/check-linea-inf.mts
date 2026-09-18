import { lineaInfluencia } from "../src/lib/engines/influence/engine.ts";
import { buildInfluence, envelopeTrain, parseBeam } from "../src/lib/engines/influence/solver.ts";
import { HS20_AXLES } from "../src/lib/engines/influence/vehicles.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const simple = lineaInfluencia({ nApoyos: "2", L: "30", x: "15", izq: "simple", der: "simple", flota: "hs20", efecto: "M", combinar: "servicio", nCarr: "1", IM: "0" });
const peakEta = 15 * 15 / 30;
assert(simple.checks.every((c) => c.ok || !c.label.startsWith("Isostático") || c.ok), simple.checks.map((c) => `${c.label}:${c.ok}`).join(" | "));
const iso = simple.checks.find((c) => c.label.startsWith("Isostático"));
assert(iso?.ok, `η_M pico isostático: ${iso?.value} vs ${iso?.limit} (esperado ${peakEta})`);

const inf = buildInfluence(parseBeam({ nApoyos: "2", L: "30", izq: "simple", der: "simple" }), 15);
const env = envelopeTrain(inf, HS20_AXLES, "M");
assert(env.max > 190 && env.max < 220, `HS-20 Mmáx @ x=15 L=30 = ${env.max} (esperado ~198–210 t·m)`);
const envV = envelopeTrain(inf, HS20_AXLES, "VL");
const vAbs = Math.max(Math.abs(envV.max), Math.abs(envV.min));
assert(vAbs > 8 && vAbs < 18, `HS-20 |V| @ medio = ${vAbs} (esperado ~10 t, η_V = ∂η_M/∂x)`);

const hl = lineaInfluencia({ nApoyos: "2", L: "30", x: "15", flota: "hl93", efecto: "M", combinar: "servicio", nCarr: "1", IM: "33", nVeh: "1" });
assert(hl.steps.length >= 8, "pasos HL-93");
assert(hl.headline.includes("M+"), hl.headline);
assert(hl.dims?.envMmax?.includes(","), "envolvente M+");
assert(hl.dims?.envVmax?.includes(","), "envolvente V+");
assert(hl.dims?.allMmax?.includes(","), "envolvente total");
assert(Number(hl.dims?.Mplus) > 200, `M+ tren ${hl.dims?.Mplus}`);
assert(Number(hl.dims?.allMplus) >= Number(hl.dims?.Mplus) - 0.1, "total ≥ tren");
assert(hl.dims?.nVeh === "1", "simple auto/1 veh");
assert(hl.dims?.s0used != null, "s0 usada");
assert(hl.dims?.instM?.includes(","), "M instantáneo");
assert(hl.steps.some((s) => s.title.includes("Análisis móvil")), "paso s0");
assert(hl.steps.some((s) => s.title.includes("trapecios") || (s.table?.caption || "").includes("trapecios")), "integral trapecios");

const moved = lineaInfluencia({ nApoyos: "2", L: "30", x: "15", flota: "hs20", efecto: "M", combinar: "servicio", nCarr: "1", IM: "0", nVeh: "1", s0: "0" });
assert(Number(moved.dims?.Ms0) < Number(simple.dims?.Ms0 || 999), `M en s0=0 debe ser menor que en crítica (${moved.dims?.Ms0} vs ${simple.dims?.Ms0})`);
assert(moved.adoption.includes("manual"), moved.adoption);

const cont = buildInfluence(parseBeam({ nApoyos: "3", L: "20", L2: "20", izq: "simple", der: "simple" }), 10);
const mid = cont.etaM[cont.xi.reduce((a, x, i) => (Math.abs(x - 10) < Math.abs(cont.xi[a] - 10) ? i : a), 0)];
assert(mid > 3.5 && mid < 4.5, `η_M continuo 2×20 m en x=10 = ${mid} (simple sería 5.0; ~0.203 PL = 4.06)`);

const cant = buildInfluence(parseBeam({ nApoyos: "2", L: "8", izq: "empotrado", der: "libre" }), 0);
const tip = cant.etaM[cant.etaM.length - 1];
assert(Math.abs(Math.abs(tip) - 8) < 0.35, `voladizo η_M empotramiento con P en punta ≈ ±L = ${tip}`);

const t3 = lineaInfluencia({ nApoyos: "3", L: "25", L2: "25", x: "12.5", flota: "t3s3", efecto: "M", combinar: "servicio", nCarr: "1", IM: "33" });
assert(t3.headline.length > 10, t3.headline);
assert(t3.dims?.ilM?.includes(","), "ilM packed");
assert(t3.dims?.nVeh === "2", "continuo automático 2 veh");
assert(t3.dims?.envMmin, "M− continuo");

const esp = lineaInfluencia({
  nApoyos: "2", L: "20", x: "10", flota: "especial", efecto: "V",
  ejeP1: "8", ejeP2: "12", ejeP3: "12", ejeD2: "4", ejeD3: "1.3",
});
assert(esp.headline.includes("|V|"), esp.headline);

console.log("simple", simple.headline);
console.log("HS20 M", env.max.toFixed(2), "V", vAbs.toFixed(2));
console.log("HL93", hl.headline);
console.log("cont η_M", mid.toFixed(3));
console.log("voladizo η_M punta", tip.toFixed(3));
console.log("T3S3", t3.headline);
console.log("OK linea-influencia");
