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
assert(m.polilineas.some((p) => p.capa === "MC-MANZANA" && p.pts.length >= 4), "la manzana no sale como polilínea");
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
assert(!m.lotes.some((l) => l.uso === "parque-zonal"), "parques zonales siguen como aporte aparte");
assert(m.cortes.length >= 2, `faltan cortes ${m.cortes.length}`);
assert(dxf.includes("MC-SECCION"), "el DXF no trae la sección");
assert(dxf.includes("MC-VEHICULO") || dxf.includes("MC-PERSONA"), "el DXF no trae persona o vehículo");
const edu = m.lotes.filter((l) => l.uso === "educacion").reduce((s, l) => s + l.area, 0);
const otros = m.lotes.filter((l) => l.uso === "otros").reduce((s, l) => s + l.area, 0);
if (edu > 0) assert(edu + 1 >= 400, `educación ${edu.toFixed(0)} m²`);
if (otros > 0) assert(otros + 1 >= 400, `otros ${otros.toFixed(0)} m²`);

const p90 = proyectoVacio();
p90.puntos = puntosEjemplo();
p90.criterios = { ...p90.criterios, areaMin: 90, frenteMin: 8, profundidad: 15 };
const m90 = proponer(p90);
const chicos = m90.lotes.filter((l) => l.uso === "vivienda" && l.area < 160);
assert(chicos.length > 4, `pocos lotes mínimos: ${chicos.length}`);
const deSeis = chicos.filter((l) => l.frente < 7.05);
assert(deSeis.length > chicos.length * 0.7, `el mínimo de 6 m no es la mayoría: ${deSeis.length}/${chicos.length}`);

console.log(`ok vías=${m.viasInternas.length} curvas=${m.polilineas.filter((p) => p.pts.some((q) => q.bulge)).length} lotes ${m.areaLotes.toFixed(0)} → ${ancha.areaLotes.toFixed(0)} m² · sin asignar ${m.sinAsignar.toFixed(1)} · 6x15 n=${deSeis.length}/${chicos.length} edu=${edu.toFixed(0)} otros=${otros.toFixed(0)} cortes=${m.cortes.length}`);
