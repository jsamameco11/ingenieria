import { proyectoVacio, puntosEjemplo } from "../src/lib/lotizacion/norma.ts";
import { leerCsv, leerDxf } from "../src/lib/lotizacion/importar.ts";
import { proponer } from "../src/lib/lotizacion/modelo.ts";
import { dxfDe } from "../src/lib/lotizacion/exportar.ts";
import { area, distPuntoPoligono, pointInPoly } from "../src/lib/lotizacion/geom.ts";
import { disenarParques, unirPanos } from "../src/lib/lotizacion/parque.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const csv = leerCsv("Numero;Este;Norte\n1;0;0\n2;240;0\n3;240;160\n4;0;160\n");
assert(csv.puntos.length === 4, "csv 4 vertices");
assert(Math.abs(csv.puntos[2].n - 160) < 1e-6, "norte 160");

const dxf = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
90
4
70
1
10
0
20
0
10
100
20
0
10
100
20
80
10
0
20
80
0
ENDSEC
0
EOF
`;
const deDxf = leerDxf(dxf);
assert(deDxf.puntos.length === 4, `dxf vertices ${deDxf.puntos.length} ${deDxf.aviso}`);
assert(Math.abs(area(deDxf.puntos.map((q) => ({ x: q.e, y: q.n }))) - 8000) < 1, "dxf area");

const p = proyectoVacio();
p.puntos = [
  { num: "1", e: 0, n: 0 },
  { num: "2", e: 240, n: 0 },
  { num: "3", e: 240, n: 160 },
  { num: "4", e: 0, n: 160 },
];
p.cierre = "cercada";
p.sinIngreso = false;
p.ingresos = [{ id: "ing-1", nombre: "Ingreso principal", arista: 0, distancia: 40, ancho: 8 }];
const m = proponer(p);
console.log(
  JSON.stringify(
    {
      ok: m.ok,
      motivo: m.motivo,
      bruta: m.areaBruta.toFixed(1),
      vias: m.areaVias.toFixed(1),
      lotes: m.areaLotes.toFixed(1),
      aportes: m.areaAportes.toFixed(1),
      residual: m.areaResidual.toFixed(1),
      sin: m.sinAsignar.toFixed(1),
      nLotes: m.lotes.filter((l) => l.uso === "vivienda").length,
      nManzanas: m.nManzanas,
      largo: m.largoManzana.toFixed(2),
      prof: m.profundidad.toFixed(2),
      seccion: m.seccionTotal.toFixed(2),
      aportesDet: m.aportes.map((a) => ({ c: a.concepto, req: a.requerido.toFixed(0), g: a.grafico.toFixed(0), e: a.estado })),
      fails: m.verificaciones.filter((v) => v.estado === "no-cumple").map((v) => v.id + " " + v.valor),
      obs: m.verificaciones.filter((v) => v.estado === "observacion").map((v) => v.id),
    },
    null,
    2,
  ),
);

assert(Math.abs(m.areaBruta - 240 * 160) < 1, `area ${m.areaBruta}`);
assert(m.lotes.some((l) => l.uso === "vivienda"), "hay lotes");
assert(m.largoManzana <= 300.05, "manzana <= 300");
assert(m.largoManzana + 0.05 >= 40, "manzana >= 40");
assert(m.areaVias > 100, "hay vias");
const rec = m.aportes.find((a) => a.concepto.startsWith("Recreación"));
assert(rec && (rec.grafico >= 800 || rec.estado.includes("Redención") || rec.estado.includes("No se")), "recreacion tratada");
const suma = m.areaVias + m.areaLotes + m.areaAportes + m.areaResidual;
assert(Math.abs(suma - m.areaBruta) < Math.max(40, m.areaBruta * 0.03), `cierre ${suma} vs ${m.areaBruta} sin ${m.sinAsignar}`);
assert(m.ingresos.length === 1, "ingreso");
assert(Math.abs(m.ingresos[0].pt.x - 40) < 0.2 && Math.abs(m.ingresos[0].pt.y) < 0.2, `ingreso en arista ${m.ingresos[0].pt.x},${m.ingresos[0].pt.y}`);
assert(m.cerco.length >= 1, "cerco con vano");
const dxfOut = dxfDe(m, p.meta);
assert(dxfOut.includes("LWPOLYLINE") && dxfOut.includes("EOF") && dxfOut.includes("MC-LOTE"), "dxf");
assert(area(m.lindero) > 0, "lindero");

const vend = m.lotes.filter((l) => l.uso === "vivienda");
const minFrente = Math.min(...vend.map((l) => l.frente));
const minArea = Math.min(...vend.map((l) => l.area));
assert(minFrente + 0.05 >= 8 * 0.9, `frente ${minFrente}`);
assert(minArea + 0.5 >= 160 * 0.92, `area lote ${minArea}`);

const ej = proyectoVacio();
ej.puntos = puntosEjemplo();
ej.cierre = "abierta";
ej.vias = [{
  id: "via-1",
  nombre: "Av. existente",
  pia: { num: "1", e: 990, n: 5080 },
  pea: { num: "2", e: 990, n: 5081.8 },
  eje: { num: "3", e: 990, n: 5084.6 },
  pea2: { num: "4", e: 990, n: 5087.4 },
  pia2: { num: "5", e: 990, n: 5089.2 },
}];
const m2 = proponer(ej);
assert(m2.areaBruta > 1000, "ejemplo area");
assert(m2.viasExistentes[0]?.completa, "seccion completa");
assert(m2.viasExistentes[0]?.ordenada, "seccion ordenada");
const suma2 = m2.areaVias + m2.areaLotes + m2.areaAportes + m2.areaResidual;
assert(Math.abs(suma2 - m2.areaBruta) < Math.max(80, m2.areaBruta * 0.04), `ejemplo cierre sin ${m2.sinAsignar.toFixed(1)}`);

function assertDentro(pts: { x: number; y: number }[], predio: { x: number; y: number }[], etiqueta: string) {
  for (const p of pts) {
    const d = pointInPoly(p, predio) ? 0 : distPuntoPoligono(p, predio);
    assert(d < 0.12, `${etiqueta} sale ${d.toFixed(3)} m en ${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }
}

const trap = proyectoVacio();
trap.puntos = [
  { num: "1", e: 0, n: 0 },
  { num: "2", e: 220, n: 0 },
  { num: "3", e: 170, n: 130 },
  { num: "4", e: 40, n: 110 },
];
trap.cierre = "cercada";
trap.sinIngreso = false;
trap.ingresos = [{ id: "ing-1", nombre: "Ingreso", arista: 0, distancia: 40, ancho: 8 }];
trap.vias = [{
  id: "via-n",
  nombre: "Vía colindante",
  pia: { num: "a", e: -20, n: 140 },
  pea: { num: "b", e: -20, n: 136 },
  eje: { num: "c", e: -20, n: 132 },
  pea2: { num: "d", e: -20, n: 128 },
  pia2: { num: "e", e: -20, n: 124 },
}];
const mt = proponer(trap);
assert(mt.lindero.length >= 3, "trap lindero");
for (const f of mt.franjas) assertDentro(f.poly, mt.lindero, `franja ${f.tipo}`);
for (const v of mt.viasInternas) if (v.hit.length) assertDentro(v.hit, mt.lindero, `hit ${v.nombre}`);
for (const v of mt.viasExistentes) {
  for (const f of v.franjas) assertDentro(f.poly, mt.lindero, `existente ${v.nombre}`);
  for (const ln of v.lineas) assertDentro([ln.a, ln.b], mt.lindero, `linea ${ln.nombre}`);
}

const enorme = proyectoVacio();
enorme.puntos = [
  { num: "1", e: 0, n: 0 },
  { num: "2", e: 3500, n: 0 },
  { num: "3", e: 3500, n: 200 },
  { num: "4", e: 0, n: 200 },
];
const t0 = performance.now();
const me = proponer(enorme);
const ms = performance.now() - t0;
assert(!me.ok, "predio de 3.5 km no se modela");
assert(me.lotes.length === 0, "sin trama sobredimensionada");
assert(me.motivo.includes("demasiada distancia"), me.motivo);
assert(me.verificaciones.some((v) => v.id === "alcance" && v.estado === "no-cumple"), "aviso de alcance");
assert(ms < 200, `el rechazo tardó ${ms.toFixed(0)} ms`);

const justo = proyectoVacio();
justo.puntos = puntosEjemplo().map((q) => ({ ...q, e: q.e + 250000, n: q.n + 8600000 }));
const mj = proponer(justo);
assert(!mj.verificaciones.some((v) => v.id === "alcance"), "las coordenadas UTM no disparan el tope");
assert(mj.lotes.length > 0, `UTM de predio chico debe lotizar: ${mj.motivo}`);

const unidos = unirPanos([
  [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
  [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }],
]);
assert(unidos.length === 1, `unión de paños ${unidos.length}`);
assert(Math.abs(area(unidos[0]) - 200) < 1, `área unida ${area(unidos[0])}`);

function todoDentro(parque: { poly: { x: number; y: number }[]; piezas: { pts: { x: number; y: number }[] }[] }, nombre: string) {
  for (const pz of parque.piezas) {
    for (const q of pz.pts) {
      const d = pointInPoly(q, parque.poly) ? 0 : distPuntoPoligono(q, parque.poly);
      assert(d < 0.05, `${nombre} sale ${d.toFixed(3)} en ${q.x.toFixed(2)},${q.y.toFixed(2)}`);
    }
  }
}

const losa = disenarParques(
  [[
    { x: 0, y: 0 },
    { x: 80, y: 0 },
    { x: 80, y: 50 },
    { x: 0, y: 50 },
  ]],
  [],
);
assert(losa.length === 1 && losa[0].categoria === "activa", "80×50 es recreación activa");
assert(/fútbol 7/i.test(losa[0].nota), losa[0].nota);
assert(losa[0].piezas.some((p) => p.capa === "MC-PARQUE-CANCHA" && p.hatch), "hatch de cancha");
todoDentro(losa[0], "losa");

const jardin = disenarParques(
  [[
    { x: 0, y: 0 },
    { x: 22, y: 0 },
    { x: 22, y: 16 },
    { x: 0, y: 16 },
  ]],
  [{ clave: "11:8", categoria: "pasiva" }],
);
assert(jardin[0].categoria === "pasiva", "jardín pasivo");
assert(!jardin[0].piezas.some((p) => p.capa === "MC-PARQUE-CANCHA"), "sin cancha en pasiva");
todoDentro(jardin[0], "jardín");

assert(dxfOut.includes("HATCH"), "DXF con hatch de parque");
assert(dxfOut.includes("MC-PARQUE-CESPED"), "capa de césped");
assert(dxfOut.includes("420"), "color real en el DXF");

console.log("lotizacion ok", vend.length, "lotes", m.nManzanas, "manzanas", "ejemplo", m2.lotes.filter((l) => l.uso === "vivienda").length, "parques", m.parques.length);
