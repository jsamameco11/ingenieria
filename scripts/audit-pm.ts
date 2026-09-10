import { checkPoint, generateFiberPM } from "../src/lib/pmFiber";
import { generateRectPM } from "../src/lib/pmMotor";
import { buildPmSheets, sheetsToTsv } from "../src/lib/pmExport";
import { buildSection } from "../src/lib/pmSections";
import { barByName } from "../src/lib/types";

const bar = barByName('3/4"');
const dest = barByName('3/8"').db;
const fc = 210;
const fy = 4200;

const sec = buildSection({
  forma: "rect",
  b: 40,
  h: 40,
  tw: 20,
  tf: 20,
  tWall: 20,
  rec: 4,
  dest,
  bar: '3/4"',
  nBar: 8,
  barBE: '3/4"',
  nBarBE: 4,
  nBarAlma: 2,
  bBE: 14,
  hBE: 40,
  barMalla: '3/8"',
  sMalla: 20,
  nInner: 0,
});

const fib = generateFiberPM(sec, { fc, fy, code: "E060", spiral: false });
const As = 8 * bar.as;
const Ag = 40 * 40;
const PoKg = 0.85 * fc * (Ag - As) + fy * As;
const PoT = PoKg / 1000;
const PnmaxT = 0.8 * 0.7 * PoT;
const PnT = (0.9 * As * fy) / 1000;

const rect = generateRectPM({
  b: 40,
  h: 40,
  As,
  nBar: 8,
  rec: 4,
  fc,
  fy,
  db: bar.db,
  destDb: dest,
  code: "E060",
  spiral: false,
});

function peek(name: string, d: { pts: [number, number][]; rows: { et: number; phi: number; Pn: number; Mn: number }[] }) {
  const ets = d.rows.map((r) => r.et);
  const phis = [...new Set(d.rows.map((r) => r.phi.toFixed(3)))];
  const pMax = Math.max(...d.pts.map((p) => p[0]));
  const pMin = Math.min(...d.pts.map((p) => p[0]));
  const mMax = Math.max(...d.pts.map((p) => p[1]));
  console.log(
    `${name}: n=${d.pts.length}  P=[${pMin.toFixed(1)} … ${pMax.toFixed(1)}]  Mn,máx=${mMax.toFixed(2)}  et=[${Math.min(...ets).toFixed(4)} … ${Math.max(...ets).toFixed(4)}]  φ={${phis.join(", ")}}`,
  );
}

console.log("=== 40×40 · 8Ø3/4\" · fc 210 · E.060 estribada ===");
console.log("Ag", sec.Ag.toFixed(1), "As", sec.As.toFixed(2), "ρ%", ((sec.As / sec.Ag) * 100).toFixed(3));
console.log("Po mano", PoT.toFixed(2), "t   motor", fib.Po.toFixed(2), "t   Δ", (fib.Po - PoT).toFixed(3));
console.log("φPn,máx mano", PnmaxT.toFixed(2), "t   motor", fib.Pnmax.toFixed(2), "t   Δ", (fib.Pnmax - PnmaxT).toFixed(3));
console.log("Tracción 0.9 As fy", PnT.toFixed(2), "t   curva M3 min P", Math.min(...fib.m3.pts.map((p) => p[0])).toFixed(2));
console.log("M3+ Mn,máx", Math.max(...fib.m3.pts.map((p) => p[1])).toFixed(2), "  M2+ Mn,máx", Math.max(...fib.m2.pts.map((p) => p[1])).toFixed(2));
console.log("Δ M3 vs M2 (cuadrada)", (Math.max(...fib.m3.pts.map((p) => p[1])) - Math.max(...fib.m2.pts.map((p) => p[1]))).toFixed(3));
console.log("Whitney capas Mn,máx", Math.max(...rect.pts.map((p) => p[1])).toFixed(2), "  fibra", Math.max(...fib.m3.pts.map((p) => p[1])).toFixed(2));
peek("M3+", fib.m3);
peek("M2+", fib.m2);
peek("rectPM", rect);

const c = buildSection({
  forma: "C",
  b: 55,
  h: 70,
  tw: 20,
  tf: 18,
  tWall: 20,
  rec: 4,
  dest,
  bar: '3/4"',
  nBar: 12,
  barBE: '3/4"',
  nBarBE: 4,
  nBarAlma: 2,
  nBarAla: 2,
  bBE: 14,
  hBE: 18,
  barMalla: '3/8"',
  sMalla: 20,
  nInner: 0,
});
const fibC = generateFiberPM(c, { fc, fy, code: "E060", spiral: false });
console.log("\n=== C 55×70 ===");
console.log("Ag", c.Ag.toFixed(1), "As", c.As.toFixed(2), "Po", fibC.Po.toFixed(1), "φPn,máx", fibC.Pnmax.toFixed(1));
peek("C M3+", fibC.m3);
peek("C M2+", fibC.m2);
peek("C M3−", fibC.m3n);
peek("C M2−", fibC.m2n);

const phiSet = new Set(fib.m3.rows.map((r) => r.phi.toFixed(2)));
if (phiSet.size === 1 && [...phiSet][0] === "0.70") {
  console.log("\nALERTA: φ no transita (todas las filas φ=0.70). εt del acero extremo no se está leyendo.");
}

const mid = checkPoint(fib, fib.Pnmax * 0.5, 0, 0);
console.log("\nBresler axial 0.5 φPn,máx  D/C", mid.dc.toFixed(3), "método", mid.method, mid.ok ? "OK" : "FALLA");
const out = checkPoint(fib, fib.Pnmax * 1.2, 0, 0);
console.log("Bresler axial 1.2 φPn,máx  D/C", out.dc.toFixed(3), out.ok ? "debería fallar" : "fuera (correcto)");
const sheets = buildPmSheets({
  comma: true,
  meta: {
    titulo: "auditoría",
    norma: "E.060",
    seccion: sec.name,
    barras: `${sec.bars.length} barras`,
    Ag: fib.Ag,
    As: fib.As,
    rho: fib.rho,
    Po: fib.Po,
    Pnmax: fib.Pnmax,
    phiC: fib.phiC,
    alfa: fib.alfa,
    fc,
    fy,
  },
  fib,
  bars: sec.bars,
  demands: [],
});
const tsv = sheetsToTsv(sheets);
console.log("Export hojas", sheets.length, "caracteres TSV", tsv.length, "líneas", tsv.split("\n").length);
