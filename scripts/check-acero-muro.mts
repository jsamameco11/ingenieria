import { muroContencionSismo } from "../src/lib/engines/murosTierra";
import { designFranja } from "../src/lib/engines/murosTierra";
import { elegirMalla } from "../src/lib/types";

function run(label: string, extra: Record<string, string>) {
  const r = muroContencionSismo({
    H: "4.6",
    hSat: "2",
    D: "0.8",
    A: "2",
    F: "0.65",
    Bp: "0.2",
    C: "1.2",
    esp: "0.4",
    beta: "10",
    gammaRelleno: "1.8",
    gammaConc: "2.5",
    gammaSat: "2",
    gammaW: "1",
    c: "0",
    phi: "32",
    phiBase: "2",
    cohesBase: "1",
    Kh: "0.3",
    Kv: "0.21",
    qFranja: "40",
    aFranja: "2",
    bFranja: "1",
    FSdesl: "1.5",
    FSvolt: "2",
    FScap: "2",
    FSdeslSis: "1.1",
    FSvoltSis: "1.5",
    fc: "210",
    fy: "4200",
    rec: "5",
    recZap: "7.5",
    ...extra,
  });
  const d = r.dims!;
  console.log("\n==", label, "==");
  console.log("H", d.H, "F", d.F, "MuStem", d.MuStem);
  console.log("trasdos", d.barAlma, "@", d.sAlma, "AsReq", d.AsAlma);
  console.log("intra", d.barIntra, "@", d.sIntra, "AsReq", d.AsIntra);
  console.log("temp", d.barTemp, "@", d.sTemp, "AsReq", d.AsTemp);
  for (const c of r.checks.filter((x) => /acero|Flexión del alma|horiz/i.test(x.label))) {
    console.log(`  ${c.ok ? "OK" : "NO"} ${c.label}: ${c.value} ${c.limit}`);
  }
}

run("catalogo phiBase=2 H=4.6 F=0.65", {});
run("phiBase=32", { phiBase: "32" });

const m47 = elegirMalla(47.83, 25);
console.log("\nelegirMalla(47.83)", m47.bar.name, "@", m47.s, "AsProv", m47.AsProv);

const fr = designFranja({ h_m: 0.65, rec_cm: 5, Mu: 20, Vu: 10, fc: 210, fy: 4200 });
console.log("franja Mu=20 t·m F=0.65", fr.text, "As", fr.As.toFixed(2), "AsProv", fr.AsProv.toFixed(2), "okM", fr.okM);
