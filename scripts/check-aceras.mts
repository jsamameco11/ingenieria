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
assert(m.polilineas.some((p) => p.capa === "MC-OCHAVO" && p.pts.length >= 2), "falta el ochavo de esquina");
const ochavos = m.polilineas.filter((p) => p.capa === "MC-OCHAVO");
const cortaLote = m.lotes.some((l) =>
  ochavos.some((o) => l.poly.some((p) => o.pts.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 0.25))),
);
assert(cortaLote, "el ochavo no llega al lote");
const arco = m.polilineas.find((p) => p.capa === "MC-VEREDA" && p.pts[0]?.bulge);
if (arco && arco.pts[1]) {
  const a = arco.pts[0];
  const b = arco.pts[1];
  const theta = 4 * Math.atan(a.bulge ?? 0);
  const cuerda = Math.hypot(b.x - a.x, b.y - a.y);
  const radio = Math.abs(cuerda / (2 * Math.sin(theta / 2)));
  assert(Math.abs(radio - 3) < 0.2, `el martillo no está en 3.00 m: ${radio.toFixed(2)}`);
}
assert(m.viasInternas.every((v) => Math.abs(v.radio - 3) < 0.01), "la secundaria debe usar radio 3 m");

const id = m.viasInternas[0].id;
const anchoAntes = m.viasInternas[0].ancho;
const ancha = proponer({
  ...base,
  ajustesVias: [{ id, tipo: "local-principal", seccion: seccionPorTipo("local-principal") }],
});
const via = ancha.viasInternas.find((v) => v.id === id);
assert(via && via.ancho > anchoAntes + 0.4, `la vía no creció: ${via?.ancho} vs ${anchoAntes}`);
const conJardin = proponer({
  ...base,
  ajustesVias: [{ id, tipo: "local-secundaria", seccion: seccionPorTipo("local-secundaria"), lateral: "jardin", jardin: 1 }],
});
const viaJardin = conJardin.viasInternas.find((v) => v.id === id);
assert(viaJardin && viaJardin.ancho < anchoAntes - 1.5, `el jardín no angosta la vía: ${viaJardin?.ancho} vs ${anchoAntes}`);
assert(conJardin.franjas.some((f) => f.tipo === "jardin"), "no se graficó la berma jardín");
assert(conJardin.franjas.some((f) => f.tipo === "vereda" && f.soloVista), "el martillo no se dibuja como vereda");
assert(
  conJardin.franjas.some((f) => f.tipo === "vereda" && f.soloVista && (f.lineas?.length ?? 0) >= 8),
  "el martillo no tiene marco de sardinel",
);
assert(Math.abs(conJardin.sinAsignar) < Math.max(40, conJardin.areaBruta * 0.03), `el jardín no cierra el área ${conJardin.sinAsignar.toFixed(1)}`);
const pk = m.parques[0];
assert(pk && pk.piezas.some((p) => p.capa === "MC-PARQUE-LINEA"), "la cancha no tiene líneas");
assert(pk && pk.piezas.filter((p) => p.capa === "MC-PARQUE-CANCHA").length >= 1, "la cancha no se reservó");
assert(pk && /fútbol 7/i.test(pk.nota), pk?.nota ?? "sin parque");
assert(Math.abs((via?.radio ?? 0) - 5) < 0.01, "la principal debe usar radio 5 m");
const principalJardin = proponer({
  ...base,
  ajustesVias: [{ id, tipo: "local-principal", seccion: seccionPorTipo("local-principal"), lateral: "jardin", jardin: 1.2 }],
});
assert(!principalJardin.franjas.some((f) => f.tipo === "jardin"), "la vía principal no puede llevar jardín");
assert(principalJardin.franjas.some((f) => f.tipo === "estacionamiento"), "la vía principal debe llevar estacionamiento");
assert(ancha.areaLotes < m.areaLotes - 1, `las manzanas no cedieron área: ${ancha.areaLotes} vs ${m.areaLotes}`);

const dxf = dxfDe(m, base.meta);
assert(dxf.includes("MC-MANZANA"), "falta capa de manzana");
assert(/\n42\r?\n/.test(dxf), "el DXF no trae bulge de arco");
const manzanas = dxf.split("MC-MANZANA").length - 1;
assert(manzanas >= 1, "el DXF no separa manzanas");
assert(!m.lotes.some((l) => l.uso === "parque-zonal"), "parques zonales siguen como aporte aparte");
assert(m.cortes.length >= 2, `faltan cortes ${m.cortes.length}`);
assert(dxf.includes("MC-SECCION"), "el DXF no trae la sección");
assert(dxf.includes("MC-MARCAS"), "el DXF no trae las marcas del pavimento");
const edu = m.lotes.filter((l) => l.uso === "educacion").reduce((s, l) => s + l.area, 0);
const otros = m.lotes.filter((l) => l.uso === "otros").reduce((s, l) => s + l.area, 0);
if (edu > 0) assert(edu + 1 >= 400, `educación ${edu.toFixed(0)} m²`);
if (otros > 0) assert(otros + 1 >= 400, `otros ${otros.toFixed(0)} m²`);
assert(!m.lotes.some((l) => l.uso === "residual"), `quedan residuales ${m.areaResidual.toFixed(0)} m²`);
assert(m.lotes.filter((l) => l.uso === "vivienda").every((l) => l.area + 0.5 >= 90), "hay un lote de vivienda bajo 90 m²");
assert(m.lotes.filter((l) => l.uso === "educacion").length <= 1, "educación quedó en más de un paño");
assert(m.lotes.filter((l) => l.uso === "otros").length <= 1, "otros fines quedó en más de un paño");
const recs = m.lotes.filter((l) => l.uso === "recreacion");
assert(recs.length === 1, `recreación en ${recs.length} paños`);
assert(recs[0].poly.length <= 6, `recreación irregular, ${recs[0].poly.length} vértices`);
assert(Math.abs(m.sinAsignar) < Math.max(40, m.areaBruta * 0.03), `no cierra el área, sin asignar ${m.sinAsignar.toFixed(1)}`);
assert((m.parques[0]?.piezas.length ?? 0) > 8, `parque incompleto, ${m.parques[0]?.piezas.length ?? 0} piezas`);
const manzana = proyectoVacio();
manzana.puntos = puntosEjemplo();
manzana.modoParque = "manzana";
const mm = proponer(manzana);
const recM = mm.lotes.find((l) => l.uso === "recreacion");
assert(recM && recM.poly.length <= 6, "la manzana completa no sale rectangular");
assert(recM && Math.abs(recM.area - recs[0].area) > 40, `el modo manzana no cambia el parque: ${recM?.area.toFixed(0)} vs ${recs[0].area.toFixed(0)}`);
assert(Math.abs(mm.sinAsignar) < Math.max(40, mm.areaBruta * 0.03), `manzana no cierra ${mm.sinAsignar.toFixed(1)}`);
assert(m.cortes.length >= 2 && m.cortes.every((c) => Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y) > 20), "el corte no sale de la calzada");

const p90 = proyectoVacio();
p90.puntos = puntosEjemplo();
p90.criterios = { ...p90.criterios, areaMin: 90, frenteMin: 6, profundidad: 10 };
const m90 = proponer(p90);
const chicos = m90.lotes.filter((l) => l.uso === "vivienda" && l.area < 160);
assert(chicos.length > 4, `pocos lotes mínimos: ${chicos.length}`);
const deSeis = chicos.filter((l) => l.frente < 7.05);
assert(deSeis.length > chicos.length * 0.7, `el mínimo de 6 m no es la mayoría: ${deSeis.length}/${chicos.length}`);

console.log(`ok vías=${m.viasInternas.length} curvas=${m.polilineas.filter((p) => p.pts.some((q) => q.bulge)).length} lotes ${m.areaLotes.toFixed(0)} → ${ancha.areaLotes.toFixed(0)} m² · sin asignar ${m.sinAsignar.toFixed(1)} · 6x15 n=${deSeis.length}/${chicos.length} edu=${edu.toFixed(0)} otros=${otros.toFixed(0)} cortes=${m.cortes.length}`);
