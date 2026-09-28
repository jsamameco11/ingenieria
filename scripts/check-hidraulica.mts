/**
 * Contrasta la memoria de agua y desagüe con el desarrollo del expediente
 * y con los criterios de diseño. Ejecutar con: npx tsx scripts/check-hidraulica.mts
 */
import fs from "node:fs";
import ExcelJS from "exceljs";
import { leerArchivoAgua, leerTextoAgua } from "../src/lib/lotizacion/importarAgua";
import {
  camaraDe,
  caudalesDe,
  colebrook,
  datosAguaBase,
  datosDesagueBase,
  hazenS,
  lineaDesagueDe,
  potenciaPozo,
} from "../src/lib/lotizacion/hidraulica";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
function cerca(a: number, b: number, tol: number, msg: string) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg}: ${a} frente a ${b}`);
}

const agua = datosAguaBase();
const des = datosDesagueBase();
const cau = caudalesDe([594], agua);
cerca(cau.filas[0].hab, 2744, 0, "habitantes de 594 lotes");
cerca(cau.tot.qp, 4.76, 0.001, "Qp");
cerca(cau.tot.qmd, 6.19, 0.001, "Qmd");
cerca(cau.qDiseno, cau.tot.qcmh * 1.1, 0.02, "diseño con infiltración");
cerca(cau.volReg, 0.25 * cau.tot.qp * 86.4, 0.02, "regulación 25 % del día medio");
assert(cau.volReservorio === cau.volReg + 50, "reservorio = regulación + incendio");

const pot = potenciaPozo(agua, 28);
cerca(pot.V.d8, 1.205, 0.01, "V 8\"");
cerca(pot.V.d12, 0.485, 0.01, "V 12\"");
cerca(pot.re, 181658, 800, "Reynolds del pozo");
cerca(pot.f, 0.016, 0.0004, "f de Colebrook");
cerca(pot.hm, 2.21, 0.05, "pérdidas menores del pozo");
cerca(pot.hf, 12.74, 0.15, "hf del pozo");
cerca(pot.H, 86.05, 0.2, "altura manométrica");
cerca(pot.pKw, 29.63, 0.15, "potencia de bomba");
cerca(pot.pMotorKw, 35.48, 0.2, "potencia de motor");
assert(pot.veredictos.every((x) => x.ok), "el pozo de 28 L/s cumple velocidad, Reynolds y clase");
assert(pot.comercial >= pot.pMotorHp, "el motor comercial cubre la potencia");

const lam = colebrook(1800, 0.0015 / 172);
cerca(lam.f, 64 / 1800, 1e-9, "f laminar");
assert(lam.regimen === "laminar", "Re 1800 es laminar");

const cam = camaraDe(4.76, des, 1.3, 1.8);
cerca(cam.a, 3, 1e-9, "a = 30/10");
cerca(cam.K, 3.343, 0.002, "K");
cerca(cam.K1, 4.798, 0.01, "K1");
cerca(cam.qb, 15.99, 0.05, "Qb de la cámara");
cerca(cam.vUtil, 3.55, 0.05, "volumen útil");
cerca(cam.tRetMax, 30, 0.05, "retención máxima");
cerca(cam.tRetMin, 10, 0.05, "retención mínima");
assert(cam.qb > cam.qMaxc, "la bomba vence el caudal máximo");
assert(cam.veredictos.every((x) => x.ok), "la cámara con 594 lotes cumple");

const hEst = des.cotaDescarga - des.cotaSuccion;
const lin = lineaDesagueDe(cam.qb, des, hEst, true);
assert(lin.V >= 0.6 && lin.V <= 2, `velocidad de desagüe ${lin.V}`);
assert(lin.tubo.ext < 315, "el caudal de 594 lotes no adopta 315 mm");
assert(lin.hdt <= lin.tubo.pnM, "la HDT cabe en la clase");
const sInt = hazenS(cam.qb, des.cPvc, lin.tubo.int);
const sExt = hazenS(cam.qb, des.cPvc, lin.tubo.ext);
assert(sInt > sExt, "el interior pierde más que el exterior");
cerca(lin.hp, (999.1 * 9.81 * (cam.qb / 1000) * lin.hdt) / (0.692 * 1000) * 1.341 / 0.85, 0.05, "HP con eficiencia en decimal");
assert(lin.pMaxDiseno > lin.hdt, "el golpe se suma a la altura dinámica");
assert(Math.abs(lin.DeCelda - (3 * 0.025 + 2 * 0.0053)) < 1e-9, "la celda del golpe conserva su De");

const vacio = camaraDe(0, des, 1.3, 1.8);
assert(vacio.veredictos.length === 0, "sin caudal la cámara no marca observado");
assert(lineaDesagueDe(0, des, hEst, true).veredictos.length === 0, "sin caudal la impulsión no marca observado");

const csv = leerTextoAgua("Etapa;Lotes\nI;400\nII;194\nDensidad;4,62\nDotación;150\nk1;1,3\nPozo 01;28\nPozo 02;25");
assert(csv.lotes.join() === "400,194", "columna Lotes");
cerca(csv.agua.densidad ?? 0, 4.62, 0.001, "densidad importada");
cerca(csv.agua.dotacion ?? 0, 150, 0.001, "dotación importada");
cerca(csv.agua.k1 ?? 0, 1.3, 0.001, "k1 importado");
assert(csv.pozos[0]?.qb === 28 && csv.pozos[1]?.qb === 25, "pozos importados");

const sueltos = leerTextoAgua("594\n120\n");
assert(sueltos.lotes.join() === "594,120", "cantidades por fila");

const libro = new ExcelJS.Workbook();
const lotesHoja = libro.addWorksheet("LOTES");
lotesHoja.getCell("B2").value = "1° ETAPA";
lotesHoja.getCell("F2").value = "2° ETAPA";
lotesHoja.getCell("D3").value = 39;
lotesHoja.getCell("D4").value = 20;
lotesHoja.getCell("H3").value = 22;
lotesHoja.getCell("H4").value = 26;
const caudalHoja = libro.addWorksheet("caudal total");
caudalHoja.getCell("B3").value = "Densidad de Vivienda (hab/viv)";
caudalHoja.getCell("D3").value = 4.62;
caudalHoja.getCell("B10").value = "LOTES";
caudalHoja.getCell("C11").value = { formula: "LOTES!D39" };
caudalHoja.getCell("B34").value = "POZO 01";
caudalHoja.getCell("C34").value = "Qb =";
caudalHoja.getCell("D34").value = 28;
const buf = await libro.xlsx.writeBuffer();
const archivo = new File([buf], "expediente.xlsx");
const xlsx = await leerArchivoAgua(archivo);
assert(xlsx.lotes.join() === "59,48", `etapas del Excel: ${xlsx.lotes.join()}`);
cerca(xlsx.agua.densidad ?? 0, 4.62, 0.001, "densidad del Excel");
assert(xlsx.pozos[0]?.qb === 28, "pozo del Excel");

const chiclayo = "c:/Users/Renzo/Downloads/CALCULO CHICLAYO BONITO.xlsx";
if (fs.existsSync(chiclayo)) {
  const real = await leerArchivoAgua(new File([fs.readFileSync(chiclayo)], "chiclayo.xlsx"));
  assert(real.lotes.join() === "605,696,636,607,608,773,653,538,437", `etapas chiclayo ${real.lotes.join()}`);
  cerca(real.agua.densidad ?? 0, 4.62, 0.001, "densidad chiclayo");
  cerca(real.agua.dotacion ?? 0, 150, 0.001, "dotación chiclayo");
  assert(real.pozos.length === 3 && real.pozos[0].qb === 28, `pozos chiclayo ${JSON.stringify(real.pozos)}`);
  console.log("chiclayo", real.lotes, real.aviso);
}

console.log("hidraulica ok", {
  qp: cau.tot.qp,
  H: pot.H.toFixed(2),
  kW: pot.pKw.toFixed(2),
  qb: cam.qb.toFixed(2),
  tubo: `${lin.tubo.nombre} ${lin.tubo.clase}`,
  V: lin.V.toFixed(2),
  hp: lin.hp.toFixed(2),
  pMax: lin.pMaxDiseno.toFixed(1),
});
