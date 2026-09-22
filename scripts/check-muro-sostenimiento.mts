/**
 * Verificación del motor de muro de sostenimiento (expediente §1–§9).
 * Ejecutar con:  npx tsx scripts/check-muro-sostenimiento.mts
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MODULES } from "../src/lib/catalog";
import { muroSostenimiento } from "../src/lib/engines/muro/engine";
import { MuroSostenimientoFig } from "../src/components/MuroSostenimientoFig";

let fails = 0;
function assert(cond: boolean, msg: string, extra = "") {
  if (cond) console.log(`  ok   ${msg}${extra ? "  " + extra : ""}`);
  else {
    fails++;
    console.log(`  FAIL ${msg}${extra ? "  " + extra : ""}`);
  }
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1e-9, Math.abs(b));

const mod = MODULES.find((m) => m.slug === "muro-sostenimiento");
console.log("\n── Catálogo ──");
assert(!!mod, "el módulo está registrado");
if (!mod) process.exit(1);
{
  const claves = new Set(mod.fields.map((f) => f.key));
  const faltan = Object.keys(mod.defaults).filter((k) => !claves.has(k));
  assert(faltan.length === 0, "todo default tiene campo", faltan.join(", "));
  const sinDefault = mod.fields.filter((f) => !(f.key in mod.defaults)).map((f) => f.key);
  assert(sinDefault.length === 0, "todo campo tiene default", sinDefault.join(", "));
  assert(mod.engine === "muroSostenimiento" && mod.diagram === "muroSostenimiento", "motor y diagrama cableados");
}

const base = { ...mod.defaults };

console.log("\n── Corrida por defecto ──");
const t0 = Date.now();
const r = muroSostenimiento(base);
const ms = Date.now() - t0;
console.log(`       ${ms} ms · ${r.steps.length} pasos · ${r.checks.length} verificaciones`);
assert(ms < 6000, "la corrida completa tarda menos de 6 s", `${ms} ms`);
assert(r.steps.length >= 20, "el expediente tiene todas las secciones");
assert(r.steps.every((s) => s.result && s.result !== "—"), "ningún paso queda sin resultado");
{
  const nan = r.steps.filter((s) => /NaN|Infinity|undefined/.test(JSON.stringify(s)));
  assert(nan.length === 0, "no hay NaN ni Infinity en los pasos", nan.map((s) => s.n).join(", "));
}
assert(!!r.dims?.muroGeom && !!r.dims?.muroFem && !!r.dims?.muroAcero, "las figuras reciben sus datos");
{
  const g = JSON.parse(r.dims!.muroGeom);
  assert(near(g.B, 4.95, 1e-6), "B = 4.95 m", String(g.B));
  assert(near(g.H, 5.5, 1e-6), "H = 5.50 m", String(g.H));
  assert(g.diagrama.length === 61, "el diagrama de presiones tiene 61 puntos");
  assert(g.dcl.bloques.length >= 3 && Number.isFinite(g.dcl.q1), "el cuerpo libre llega a la figura de estabilidad");
  const f = JSON.parse(r.dims!.muroFem);
  // La figura dibuja la sección transversal, así que basta la franja central.
  assert(
    f.nElem > 100 && f.zapata.length + f.fuste.length === f.nElem / (f.nx || 1),
    "la malla llega a las figuras",
    `${f.nElem} elementos · franja de ${f.zapata.length}+${f.fuste.length}`,
  );
  assert(
    f.zapata.every((c: { y0: number; y1: number }) => c.y1 > c.y0) && f.fuste.every((c: { z0: number; z1: number }) => c.z1 > c.z0),
    "las celdas de la malla tienen extensión positiva",
  );
  assert(f.presion.length === f.zapata.length + 1 && f.presion.every((p: { fem: number }) => Number.isFinite(p.fem)),
    "la presión de contacto viene nodo a nodo", `${f.presion.length} nodos`);
  const ac = JSON.parse(r.dims!.muroAcero);
  assert(!!ac.fuste.bar && ac.fuste.ld > 0 && ac.temp.sH > 0, "el despiece recibe barras, ℓd y mallas mínimas");
}
assert(r.checks.every((c) => c.ok), "el ejemplo por defecto cumple todas las verificaciones",
  r.checks.filter((c) => !c.ok).map((c) => c.label).join(", "));
console.log(`       ${r.headline}`);
console.log(`       ${r.adoption}`);
for (const c of r.checks) console.log(`       ${c.ok ? "✓" : "✗"} ${c.label}: ${c.value} (${c.limit})`);

console.log("\n── Coherencia analítico / FEM en el fuste ──");
{
  const paso = r.steps.find((s) => s.n === "20")!;
  const fila = paso.table!.rows[0];
  const anal = Number(fila[1].replace(/[^\d.,-]/g, "").replace(",", ""));
  const fem = Number(fila[2].replace(/[^\d.,-]/g, "").replace(",", ""));
  console.log(`       fuste: analítico ${anal} · FEM ${fem} kN·m/m`);
  assert(near(fem, anal, 0.05), "el fuste coincide dentro del 5 % (voladizo isostático)");
}

console.log("\n── Selector de método ──");
{
  const rf = muroSostenimiento({ ...base, metodoDiseno: "fem" });
  assert(rf.dims?.metodoDiseno === "fem", "el selector queda registrado");
  assert(/envolvente FEM/.test(rf.headline), "el titular refleja el método FEM", rf.headline);
  assert(/ANALÍTICO/.test(r.steps.find((s) => s.n === "14")!.result), "por defecto gobierna el analítico");
  assert(/ELEMENTOS FINITOS/.test(rf.steps.find((s) => s.n === "14")!.result), "con FEM gobierna la envolvente");
  const mismoFuste = rf.steps.find((s) => s.n === "15")!.result === r.steps.find((s) => s.n === "15")!.result;
  assert(mismoFuste, "el fuste sale igual por las dos vías (mismo Mu)");
}

console.log("\n── Figuras ──");
{
  const PARTES = ["esquema", "empujes", "estabilidad", "malla", "calor", "esfuerzos", "presiones", "despiece"];
  const dibujar = (res: ReturnType<typeof muroSostenimiento>, entrada: Record<string, string>, part: string) =>
    renderToStaticMarkup(createElement(MuroSostenimientoFig, { values: { ...entrada, ...res.dims }, part }));
  for (const part of PARTES) {
    const svg = dibujar(r, base, part);
    const tieneSvg = /<svg[\s\S]*<\/svg>/.test(svg);
    // Una coordenada NaN hace que el navegador descarte el elemento entero sin
    // avisar, así que es el fallo que más importa detectar aquí.
    const coordenadaMala = /(NaN|Infinity)/.test(svg);
    assert(tieneSvg && !coordenadaMala, `la figura "${part}" se dibuja`, coordenadaMala ? "tiene coordenadas NaN/Infinity" : tieneSvg ? "" : "no emite SVG");
  }
  // Casos límite que antes rompían la geometría del croquis.
  const limites: [string, Record<string, string>][] = [
    ["sin uña", { unaProf: "0", unaAncho: "0" }],
    ["sin puntera", { Ltoe: "0" }],
    ["sin sobrecarga ni sismo", { q: "0", kh: "0" }],
    ["con nivel freático", { nf: "1.5" }],
    ["cuatro estratos y talud", { esp1: "1.5", esp2: "1.5", esp3: "1.5", esp4: "1.5", cap2: "Arena", cap3: "Grava", cap4: "Arcilla", talud: "12" }],
  ];
  for (const [nombre, patch] of limites) {
    const entrada = { ...base, ...patch };
    const res = muroSostenimiento(entrada);
    const malo = PARTES.filter((p) => /(NaN|Infinity)/.test(dibujar(res, entrada, p)));
    assert(malo.length === 0, `las figuras aguantan: ${nombre}`, malo.join(", "));
  }
  // Escala 1:1: 1 m horizontal y 1 m vertical tienen que medir lo mismo en el SVG.
  {
    const svg = dibujar(r, base, "esquema");
    const g = JSON.parse(r.dims!.muroGeom);
    const cotaB = svg.match(/B = [\d.]+ m[\s\S]*?x="([\d.]+)"[\s\S]*?x="([\d.]+)"/);
    // La barra gráfica de 1 m es el trazo más fiable: dos x separados por sc.
    const barra = svg.match(/<line x1="([\d.]+)" y1="18" x2="([\d.]+)" y2="18"/);
    if (barra) {
      const sc = Number(barra[2]) - Number(barra[1]);
      assert(sc > 40, "la barra gráfica de 1 m existe", `${sc.toFixed(1)} px/m`);
      const aroundH = svg.slice(Math.max(0, svg.indexOf("H = ") - 900), svg.indexOf("H = "));
      const verts = [...aroundH.matchAll(/y1="([\d.]+)"[^>]*y2="([\d.]+)"/g)]
        .map((m) => Math.abs(Number(m[2]) - Number(m[1])))
        .filter((h) => h > 80);
      const hPx = verts.length ? Math.max(...verts) : 0;
      assert(hPx > 0 && near(hPx / sc, g.H, 0.03), "H vertical = H real a escala 1:1", `${(hPx / sc).toFixed(2)} m vs ${g.H} m`);
      const aroundB = svg.slice(Math.max(0, svg.indexOf("B = ") - 900), svg.indexOf("B = "));
      const hors = [...aroundB.matchAll(/x1="([\d.]+)"[^>]*x2="([\d.]+)"/g)]
        .map((m) => Math.abs(Number(m[2]) - Number(m[1])))
        .filter((w) => w > 80);
      const bPx = hors.length ? Math.max(...hors) : 0;
      assert(bPx > 0 && near(bPx / sc, g.B, 0.03), "B horizontal = B real a escala 1:1", `${(bPx / sc).toFixed(2)} m vs ${g.B} m`);
    } else {
      assert(false, "la barra gráfica de 1 m existe");
    }
    assert(!/(NaN|Infinity)/.test(svg), "el esquema no tiene coordenadas rotas");
    const fusteX = Number(svg.match(/<text x="([\d.]+)"[^>]*>FUSTE/)?.[1] ?? 0);
    assert(fusteX > 150 && fusteX < 250, "FUSTE está escrito sobre el fuste, no sobre el relleno", String(fusteX));
  }
  {
    const est = dibujar(r, base, "estabilidad");
    assert(/Eh 10[.,]5/.test(est), "el DCL rotula Eh en Tnf", est.match(/Eh [^<]+/)?.[0] ?? "");
    assert(!/Eh 103/.test(est), "el DCL no deja el kN crudo en las flechas");
    const pres = dibujar(r, base, "presiones");
    assert(/q_adm = 25/.test(pres), "el eje de presiones está en Tnf/m²", pres.match(/q_adm = [^<]+/)?.[0] ?? "");
    assert(!/q_adm = 245/.test(pres), "el eje de presiones no imprime kPa como si fueran Tnf/m²");
  }
}

console.log("\n── Despiece respaldado por la E.060 ──");
{
  const ac = JSON.parse(r.dims!.muroAcero);
  assert(Array.isArray(ac.piezas) && ac.piezas.length >= 6, "el cuadro trae las posiciones ①–⑥ como mínimo", String(ac.piezas?.length));
  for (const p of ac.piezas ?? []) {
    assert(p.L > 0 && p.tramos.every((t: { L: number }) => t.L >= 0), `posición ${p.pos} tiene longitudes positivas`);
    const suma = (p.tramos as { L: number }[]).reduce((a, t) => a + t.L, 0);
    assert(near(suma, p.L, 0.15) || p.forma === "U" || p.pts.length === 0, `posición ${p.pos}: Σ tramos ≈ L corte`, `${suma.toFixed(2)} vs ${p.L.toFixed(2)}`);
  }
  assert(ac.fuste.ld >= 0.3, "ℓd del fuste respeta el mínimo de 0.30 m", String(ac.fuste.ld));
  const svg = renderToStaticMarkup(createElement(MuroSostenimientoFig, { values: { ...base, ...r.dims }, part: "despiece" }));
  assert(/Cuadro de despiece/.test(svg), "la figura lleva el cuadro de despiece");
  assert((ac.piezas as { pos: string }[]).every((p) => svg.includes(p.pos)), "cada posición del cuadro se dibuja");
}

console.log("\n── Sensibilidad física ──");
{
  const alto = muroSostenimiento({ ...base, hp: "7" });
  const g0 = JSON.parse(r.dims!.muroGeom);
  const g1 = JSON.parse(alto.dims!.muroGeom);
  assert(g1.Eh > g0.Eh, "más altura, más empuje", `${g1.Eh.toFixed(1)} > ${g0.Eh.toFixed(1)}`);

  const conAgua = muroSostenimiento({ ...base, nf: "2" });
  const gw = JSON.parse(conAgua.dims!.muroGeom);
  assert(gw.Eh > g0.Eh, "con nivel freático el empuje crece", `${gw.Eh.toFixed(1)} > ${g0.Eh.toFixed(1)}`);

  const sinSismo = muroSostenimiento({ ...base, kh: "0" });
  const gs = JSON.parse(sinSismo.dims!.muroGeom);
  assert(near(gs.dPae, 0, 1e-9), "kh = 0 anula el incremento dinámico");

  const reposo = muroSostenimiento({ ...base, condicion: "reposo" });
  const gr = JSON.parse(reposo.dims!.muroGeom);
  assert(gr.Eh > g0.Eh, "el reposo K₀ empuja más que el activo Ka", `${gr.Eh.toFixed(1)} > ${g0.Eh.toFixed(1)}`);

  const fsDesl = (x: Record<string, string>) =>
    Number(muroSostenimiento({ ...base, ...x }).checks
      .find((c) => c.label.includes("deslizamiento sísmico"))!.value.replace(",", ""));
  const fsSin = fsDesl({ unaProf: "0", unaAncho: "0" });
  const fsCon = fsDesl({ unaProf: "0.9", unaAncho: "0.4" });
  assert(fsCon > fsSin, "la uña mejora el FS al deslizamiento sísmico", `${fsCon} > ${fsSin}`);

  const sinPasivo = fsDesl({ usarPasivo: "no" });
  assert(sinPasivo < fsDesl({}), "despreciar el pasivo es más conservador", `${sinPasivo} < ${fsDesl({})}`);

  const mo = muroSostenimiento({ ...base, metodoSismo: "mononobe", deltaMuro: "21" });
  assert(/Mononobe/.test(mo.steps.find((s) => s.n === "06")!.formula ?? ""), "Mononobe–Okabe completo disponible");
}

console.log("\n── Robustez ──");
{
  const casos: [string, Record<string, string>][] = [
    ["sin puntera", { Ltoe: "0" }],
    ["sin talón", { Lheel: "0.2" }],
    ["sin sobrecarga", { q: "0" }],
    ["NF en la corona", { nf: "0" }],
    ["cuatro estratos", { esp1: "1.5", esp2: "1.5", esp3: "1.5", esp4: "1.5", cap2: "Arena", cap3: "Grava", cap4: "Arcilla", phi2: "28", phi3: "36", phi4: "0", coh4: "30" }],
    ["talud 15°", { talud: "15" }],
    ["talud imposible (35° > φ)", { talud: "35" }],
    ["Coulomb con δ", { metodoK: "coulomb", deltaMuro: "21" }],
    ["malla gruesa", { nz: "6", nToe: "2", nHeel: "4", nx: "2" }],
    ["malla fina", { nz: "32", nToe: "10", nHeel: "26", nx: "4" }],
    ["bordes libres", { bordeX: "libre" }],
    ["resortes bilaterales", { sinTraccion: "no" }],
    ["muro muy esbelto", { hp: "8", Lheel: "1.5", Ltoe: "0.4" }],
    ["barras impuestas", { barFuste: '3/4"', barZap: '5/8"' }],
  ];
  for (const [nombre, patch] of casos) {
    try {
      const out = muroSostenimiento({ ...base, ...patch });
      const malo = /NaN|Infinity/.test(JSON.stringify(out.steps) + JSON.stringify(out.checks));
      assert(!malo && out.steps.length >= 20, nombre, malo ? "produce NaN/Infinity" : "");
    } catch (e) {
      assert(false, nombre, String(e));
    }
  }
}

console.log(fails === 0 ? "\n✔ Muro de sostenimiento: todas las verificaciones pasan\n" : `\n✖ ${fails} verificaciones fallidas\n`);
process.exit(fails === 0 ? 0 : 1);
