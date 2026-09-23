import { dxfDe } from "../src/lib/lotizacion/exportar.ts";
import { proponer } from "../src/lib/lotizacion/modelo.ts";
import { proyectoVacio, puntosEjemplo, seccionPorTipo } from "../src/lib/lotizacion/norma.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = proyectoVacio();
base.puntos = puntosEjemplo();
const m = proponer(base);
assert(m.ok || m.lotes.some((l) => l.uso === "vivienda"), m.motivo);
assert(m.viasInternas.length >= 2, `vías internas ${m.viasInternas.length}`);
assert(m.franjas.some((f) => f.tipo === "vereda"), "sin veredas");
assert(m.polilineas.some((p) => p.capa === "MC-MANZANA" && p.pts.some((q) => q.bulge && Math.abs(q.bulge) > 0.2)), "la manzana no lleva arco");
assert(m.polilineas.some((p) => p.capa === "MC-VEREDA" && p.pts.some((q) => q.bulge)), "el sardinel no lleva arco");
assert(m.viasInternas.every((v) => Math.abs(v.radio - 3) < 0.01), "la secundaria debe usar radio 3 m");

const id = m.viasInternas[0].id;
const anchoAntes = m.viasInternas[0].ancho;
const ancha = proponer({
  ...base,
  ajustesVias: [{ id, tipo: "local-principal", seccion: seccionPorTipo("local-principal") }],
});
const via = ancha.viasInternas.find((v) => v.id === id);
assert(via && via.ancho > anchoAntes + 0.4, `la vía no creció: ${via?.ancho} vs ${anchoAntes}`);
assert(Math.abs((via?.radio ?? 0) - 5) < 0.01, "la principal debe usar radio 5 m");
assert(ancha.areaLotes < m.areaLotes - 1, `las manzanas no cedieron área: ${ancha.areaLotes} vs ${m.areaLotes}`);

const dxf = dxfDe(m, base.meta);
assert(dxf.includes("MC-MANZANA"), "falta capa de manzana");
assert(dxf.includes("\n42\n"), "el DXF no trae bulge de arco");
const manzanas = dxf.split("MC-MANZANA").length - 1;
assert(manzanas >= 1, "el DXF no separa manzanas");

console.log(`ok vías=${m.viasInternas.length} curvas=${m.polilineas.filter((p) => p.pts.some((q) => q.bulge)).length} lotes ${m.areaLotes.toFixed(0)} → ${ancha.areaLotes.toFixed(0)} m²`);
