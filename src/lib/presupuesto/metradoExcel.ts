import { CATEGORIA_MINSA_META, type CategoriaMinsa } from "./categoriasMinsa";
import { PARTIDA_BY_CODIGO } from "./partidas";
import { codigoPartidaEquipamiento } from "./partidasEquipamiento";
import { areaPrograma, PROGRAMA_MINSA, textoPrograma } from "./programaMinsa";

export type SpecMetrado = {
  terreno: number;
  techada: number;
  pisos: number;
  sshh: number;
  duchas: number;
  inodoros: number;
  lavatorios: number;
  cocinas: number;
  lavanderias: number;
  termas: number;
  drywallTab: number;
  cieloYeso: number;
  cieloDrywall: number;
  pisoCeramico: number;
  pisoCer45: number;
  pisoPorc: number;
  pisoGranito: number;
  pisoVinil: number;
  pisoPulido: number;
  mayolicaSSHH: number;
  mayolicaCocina: number;
  p90: number;
  p80: number;
  p70: number;
  pMetal: number;
  ventanas: number;
  mamparas: number;
  baranda: number;
  rejas: number;
  cubCalamina: number;
  cubTeja: number;
  excavMasiva: number;
  ilum: number;
  toma: number;
  tomaEsp: number;
  tabGral: number;
  tabDpto: number;
  medidor: number;
  pozo: number;
  alimentador: number;
  lum: number;
  focos: number;
  timbre: number;
  tv: number;
  tel: number;
  data: number;
  intercom: number;
  porteria: number;
  rack: number;
  bombas: number;
  extractores: number;
  ciM: number;
  gabCI: number;
  ext: number;
  bombaCI: number;
  ascensor: number;
  tanques: number;
  cisterna: number;
  placas: number;
  losaMaciza: number;
  cisternaEst: number;
  extras?: { codigo: string; metrado: number }[];
};

export type MetradoFila = {
  codigo: string;
  descripcion: string;
  und: string;
  formula: string;
  reemplazo: string;
  metrado: number;
  norma: string;
  tipo: "dato" | "formula" | "semilla";
};

export type MetradoHoja = {
  id: string;
  nombre: string;
  procedimiento: string[];
  filas: MetradoFila[];
};

export type MetradoLibro = {
  titulo: string;
  subtitulo: string;
  norma: string;
  hojas: MetradoHoja[];
};

export function q(n: number, dec = 1) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const k = 10 ** dec;
  return Math.round(n * k) / k;
}

function n0(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-PE", { maximumFractionDigits: d });
}

function meta(codigo: string) {
  const p = PARTIDA_BY_CODIGO[codigo] ?? PARTIDA_BY_CODIGO[codigoPartidaEquipamiento(codigo)];
  return {
    descripcion: p?.descripcion ?? codigo,
    und: p?.und ?? "und",
  };
}

function fila(
  codigo: string,
  metrado: number,
  formula: string,
  reemplazo: string,
  norma: string,
  dec = 1,
  tipo: MetradoFila["tipo"] = "formula",
): MetradoFila {
  const m = meta(codigo);
  return { codigo, descripcion: m.descripcion, und: m.und, formula, reemplazo, metrado: q(metrado, dec), norma, tipo };
}

function dato(codigo: string, label: string, valor: number, und: string, nota: string): MetradoFila {
  return {
    codigo,
    descripcion: label,
    und,
    formula: "dato (celda de entrada)",
    reemplazo: n0(valor, 2),
    metrado: valor,
    norma: nota,
    tipo: "dato",
  };
}

export function intermediosEdificio(s: SpecMetrado) {
  const Ag = s.terreno;
  const At = s.techada;
  const n = Math.max(1, s.pisos);
  const excavCim = 0.14 * Ag + 0.03 * At;
  const excavZap = 0.065 * Ag * (1 + 0.12 * (n - 1));
  const relleno = 0.45 * (excavCim + excavZap);
  const elim = 0.55 * (excavCim + excavZap + s.excavMasiva);
  const solado = 0.2 * Ag;
  const falsoPiso = 0.42 * Ag;
  const cimCorr = 0.082 * Ag + 0.006 * At;
  const sobrecim = 0.038 * Ag;
  const ciclopeo = 0.018 * Ag;
  const zap = 0.036 * Ag * (1 + 0.14 * (n - 1));
  const col = 0.034 * At;
  const vig = 0.054 * At;
  const losaAli = Math.max(0, 0.074 * At - s.losaMaciza);
  const esc = 1.7 * n;
  const vigaCim = 0.016 * Ag * (1 + 0.08 * (n - 1));
  const dado = 0.007 * Ag * n;
  const pAgua = s.inodoros + s.lavatorios + s.duchas + s.cocinas + s.lavanderias;
  const pCal = s.duchas + s.cocinas + s.termas;
  const pDes = pAgua;
  return {
    Ag,
    At,
    n,
    excavCim,
    excavZap,
    relleno,
    elim,
    solado,
    falsoPiso,
    cimCorr,
    sobrecim,
    ciclopeo,
    zap,
    col,
    vig,
    losaAli,
    esc,
    vigaCim,
    dado,
    pAgua,
    pCal,
    pDes,
  };
}

export function lineasDesdeSpec(s: SpecMetrado): { codigo: string; metrado: number }[] {
  const skip = /^(D-|AMB-|P-|P0)/;
  const seen = new Set<string>();
  const out: { codigo: string; metrado: number }[] = [];
  for (const f of hojasEdificio(s).flatMap((h) => h.filas)) {
    if (!f.codigo || skip.test(f.codigo) || f.metrado <= 0 || seen.has(f.codigo)) continue;
    seen.add(f.codigo);
    out.push({ codigo: f.codigo, metrado: f.metrado });
  }
  return out;
}

export function hojasEdificio(s: SpecMetrado): MetradoHoja[] {
  const x = intermediosEdificio(s);
  const { Ag, At, n } = x;

  const datos: MetradoHoja = {
    id: "00",
    nombre: "00 DATOS",
    procedimiento: [
      "Hoja de entrada, igual que las celdas amarillas de un Excel de metrados.",
      "Ag = área de terreno. At = área techada total (suma de pisos). n = número de niveles.",
      "Los acabados, aparatos y salidas eléctricas son datos de programa (conteo de planos o semilla de plantilla). No se inventan con un % si el plano ya los dibuja.",
      "Las hojas 01 a 06 toman estas celdas. Si cambia Ag, At o n, se recalculan excavación, concreto, acero, pintura y tuberías.",
    ],
    filas: [
      dato("D-AG", "Área de terreno Ag", Ag, "m²", "Lote / plataforma. Trazo, limpieza y cimientos corridos."),
      dato("D-AT", "Área techada At", At, "m²", "Suma de pisos. Albañilería, losas, pintura, IS e IE."),
      dato("D-N", "Número de niveles n", n, "und", "Escala zapatas, columnas, escaleras y tableros."),
      dato("D-SSHH", "Ambientes SS.HH.", s.sshh, "und", "Programa. Cada baño arrastra mayólica, desagüe y puntos."),
      dato("D-IN", "Inodoros", s.inodoros, "und", "Conteo de aparatos (plano sanitario)."),
      dato("D-LV", "Lavatorios", s.lavatorios, "und", "Conteo de aparatos."),
      dato("D-DU", "Duchas", s.duchas, "und", "Conteo de aparatos."),
      dato("D-CO", "Puntos de cocina", s.cocinas, "und", "Lavadero / cocina / office."),
      dato("D-LA", "Lavaderos de ropa", s.lavanderias, "und", ""),
      dato("D-TE", "Termas / calentadores", s.termas, "und", "Agua caliente + circuito eléctrico."),
      dato("D-IL", "Salidas de iluminación", s.ilum, "pto", "Semilla ≈ At/5 en clínica, At/8 en vivienda. El plano manda."),
      dato("D-TO", "Tomacorrientes", s.toma, "pto", "Semilla ≈ 0,9 × iluminación."),
      dato("D-TX", "Tomas especiales", s.tomaEsp, "pto", "Fuerza, equipos, climatización."),
    ],
  };

  const arq: MetradoHoja = {
    id: "01",
    nombre: "01 ARQ",
    procedimiento: [
      "1. Preliminares: trazo, limpieza y desbroce = Ag (m² de lote).",
      "2. Cerco provisional = 0,28 × √Ag × 4 (perímetro de un lote cuadrado equivalente).",
      "3. Muro de albañilería = 1,12·At; tarrajeo = 1,38·At; pintura látex = 1,55·At (caras + desperdicio RN Metrados).",
      "4. Pisos, mayólicas, puertas y ventanas son dato de programa (celdas de 00 DATOS / planos de acabados).",
      "5. El movimiento de tierras (excavación, relleno y eliminación) se metra en la hoja 02 EST.",
    ],
    filas: [
      fila("ARQ-01.01.01", Ag, "=Ag", n0(Ag), "RN Metrados · trazo de ejes", 0),
      fila("ARQ-01.01.02", Ag, "=Ag", n0(Ag), "Limpieza del lote", 0),
      fila("ARQ-01.01.03", Ag, "=Ag", n0(Ag), "Desbroce superficial", 0),
      fila("ARQ-01.03.01", At > 900 ? 2 : 1, "=SI(At>900;2;1)", `${At > 900 ? 2 : 1}`, "Un cartel; dos si At > 900 m²", 0),
      fila("ARQ-01.03.03", 0.28 * Math.sqrt(Ag) * 4, "=0,28×√Ag×4", `0,28×√${n0(Ag)}×4`, "Cerco provisional sobre perímetro equivalente", 0),
      fila("ARQ-01.04.01", 0.35 * At, "=0,35×At", `0,35×${n0(At)}`, "Andamios / protección de fachada", 0),
      fila("ARQ-01.05.01", 1, "1", "1", "SSOMA global de obra", 0),
      fila("ARQ-05.01.01", 1.12 * At, "=1,12×At", `1,12×${n0(At)}`, "Muro albañilería (incluye vanos netos típicos)", 0),
      fila("ARQ-05.01.02", 0.17 * At, "=0,17×At", `0,17×${n0(At)}`, "Muro de tabique / antepecho", 0),
      fila("ARQ-05.02.01", 0.26 * At, "=0,26×At", `0,26×${n0(At)}`, "Solque / columna de amarre albañilería", 0),
      fila("ARQ-05.03.01", 0.14 * Ag, "=0,14×Ag", `0,14×${n0(Ag)}`, "Vereda perimetral", 0),
      fila("ARQ-05.04.01", s.drywallTab, "dato drywallTab", n0(s.drywallTab), "Tabique drywall de programa", 0, "dato"),
      fila("ARQ-06.01.01", 1.38 * At, "=1,38×At", `1,38×${n0(At)}`, "Tarrajeo de muros (2 caras + desperdicio)", 0),
      fila("ARQ-06.01.02", 0.58 * At, "=0,58×At", `0,58×${n0(At)}`, "Tarrajeo de cielos", 0),
      fila("ARQ-06.01.03", 1.38 * At, "=1,38×At", `1,38×${n0(At)}`, "Tarrajeo fino / primario", 0),
      fila("ARQ-06.02.01", s.cieloYeso, "dato cieloYeso", n0(s.cieloYeso), "Cielo yeso de programa", 0, "dato"),
      fila("ARQ-06.02.02", s.cieloDrywall, "dato cieloDrywall", n0(s.cieloDrywall), "Cielo drywall (clínica / hospital)", 0, "dato"),
      fila("ARQ-06.03.01", 0.3 * At, "=0,30×At", `0,30×${n0(At)}`, "Impermeabilización de azotea / SS.HH.", 0),
      fila("ARQ-07.01.01", 0.62 * At, "=0,62×At", `0,62×${n0(At)}`, "Contrapiso", 0),
      fila("ARQ-07.01.02", 0.22 * Ag, "=0,22×Ag", `0,22×${n0(Ag)}`, "Falso piso exterior / patio", 0),
      fila("ARQ-07.02.01", s.pisoPulido, "dato pisoPulido", n0(s.pisoPulido), "Piso pulido (circulación / depósito)", 0, "dato"),
      fila("ARQ-07.03.01", s.pisoCeramico, "dato pisoCeramico", n0(s.pisoCeramico), "Cerámico 30×30", 0, "dato"),
      fila("ARQ-07.03.02", s.pisoCer45, "dato pisoCer45", n0(s.pisoCer45), "Cerámico 45×45", 0, "dato"),
      fila("ARQ-07.03.03", s.pisoPorc, "dato pisoPorc", n0(s.pisoPorc), "Porcelanato", 0, "dato"),
      fila("ARQ-07.04.01", s.pisoGranito, "dato pisoGranito", n0(s.pisoGranito), "Granito (hall / escalera)", 0, "dato"),
      fila("ARQ-07.05.01", s.pisoVinil, "dato pisoVinil", n0(s.pisoVinil), "Vinílico hospitalario", 0, "dato"),
      fila("ARQ-08.01.01", 0.32 * At, "=0,32×At", `0,32×${n0(At)}`, "Zócalo", 0),
      fila("ARQ-08.02.01", s.mayolicaSSHH, "dato mayolicaSSHH", n0(s.mayolicaSSHH), "≈ 9–11 m²/baño (piso+muros)", 0, "dato"),
      fila("ARQ-08.02.02", s.mayolicaCocina, "dato mayolicaCocina", n0(s.mayolicaCocina), "Salpicadero / office", 0, "dato"),
      fila("ARQ-08.03.01", At / n, "=At/n", `${n0(At)}/${n}`, "Cubierta / azotea de un nivel tipo", 0),
      fila("ARQ-09.01.01", s.p90, "dato p90", n0(s.p90), "Puerta 0,90", 0, "dato"),
      fila("ARQ-09.01.02", s.p80, "dato p80", n0(s.p80), "Puerta 0,80", 0, "dato"),
      fila("ARQ-09.01.03", s.p70, "dato p70", n0(s.p70), "Puerta 0,70", 0, "dato"),
      fila("ARQ-10.01.01", s.ventanas, "dato ventanas", n0(s.ventanas), "m² de vano de ventana", 1, "dato"),
      fila("ARQ-10.02.01", s.pMetal, "dato pMetal", n0(s.pMetal), "Puerta metálica", 0, "dato"),
      fila("ARQ-10.03.01", s.baranda, "dato baranda", n0(s.baranda), "ml baranda / pasamano", 1, "dato"),
      fila("ARQ-10.04.01", s.rejas, "dato rejas", n0(s.rejas), "m² rejas", 1, "dato"),
      fila("ARQ-11.02.01", s.mamparas, "dato mamparas", n0(s.mamparas), "und mampara", 0, "dato"),
      fila("ARQ-12.01.01", 1.55 * At, "=1,55×At", `1,55×${n0(At)}`, "Pintura látex muros", 0),
      fila("ARQ-12.01.02", 0.72 * At, "=0,72×At", `0,72×${n0(At)}`, "Pintura de cielos", 0),
      fila("ARQ-12.02.01", 0.09 * At, "=0,09×At", `0,09×${n0(At)}`, "Pintura esmalte (puertas / metal)", 0),
      fila("ARQ-12.03.01", s.cieloYeso + s.cieloDrywall, "=cieloYeso+cieloDrywall", `${n0(s.cieloYeso)}+${n0(s.cieloDrywall)}`, "Pintura de cielo especial", 0),
      fila("ARQ-13.01.01", s.cubCalamina, "dato cubCalamina", n0(s.cubCalamina), "", 0, "dato"),
      fila("ARQ-13.02.01", s.cubTeja, "dato cubTeja", n0(s.cubTeja), "", 0, "dato"),
      fila("ARQ-13.04.01", (0.16 * At) / n, "=0,16×At/n", `0,16×${n0(At)}/${n}`, "Alero / cobertura ligera", 0),
      fila("ARQ-14.01.01", 0.12 * Ag, "=0,12×Ag", `0,12×${n0(Ag)}`, "Sardinel / jardín", 0),
      fila("ARQ-14.02.01", 0.1 * Ag, "=0,10×Ag", `0,10×${n0(Ag)}`, "Área verde", 0),
      fila("ARQ-14.03.01", Math.max(2, Math.round(Ag / 60)), "=MAX(2;REDONDEAR(Ag/60;0))", `Ag/60 → ${Math.max(2, Math.round(Ag / 60))}`, "Árboles / puntos de riego", 0),
      fila("ARQ-16.01.01", At, "=At", n0(At), "Limpieza final de obra", 0),
    ],
  };

  const est: MetradoHoja = {
    id: "02",
    nombre: "02 EST",
    procedimiento: [
      "Orden RN: movimiento de tierras (excavación, relleno, eliminación y fondo), luego concreto simple, luego concreto armado por elemento.",
      "Luego concreto armado por elemento: zapatas → dados → platea → vigas de conexión → vigas de cimentación → columnas → vigas → losas → placas → escaleras → cisterna.",
      "Cada elemento lleva concreto, acero fy=4 200, encofrado y curado. La platea solo entra si el proyecto la tiene (dato = 0 por defecto).",
      "Volúmenes tipo Excel de predimensionamiento. No reemplazan el plano de estructuras.",
      "Acero: 72 kg/m³ zapata, 118 kg/m³ viga de cimentación / conexión, 128 kg/m³ columna, 118 kg/m³ viga, 92 kg/m³ losa, 138 kg/m³ placa.",
    ],
    filas: [
      fila("EST-02.01.01", s.excavMasiva, "dato excavMasiva", n0(s.excavMasiva), "Corte de plataforma (plano de movimiento de tierras)", 1, "dato"),
      fila("EST-02.01.02", x.excavCim, "=0,14×Ag+0,03×At", `0,14×${n0(Ag)}+0,03×${n0(At)}`, "Zanja de cimiento corrido", 1),
      fila("EST-02.01.03", x.excavZap, "=0,065×Ag×(1+0,12×(n−1))", `0,065×${n0(Ag)}×(1+0,12×${n - 1})`, "Cajas de zapata", 1),
      fila("EST-02.01.07", 2.4 * x.dado, "=2,4×Vdado", `2,4×${n0(x.dado)}`, "Excavación de dados", 1),
      fila("EST-02.01.06", 1.8 * s.cisternaEst, "=1,8×Vcisterna", `1,8×${n0(s.cisternaEst)}`, "Excavación de cisterna", 1),
      fila("EST-02.01.10", 2.6 * x.excavCim, "=2,6×exc.cim", `2,6×${n0(x.excavCim)}`, "Entibado de zanjas", 0),
      fila("EST-02.02.01", x.relleno, "=0,45×(exc.cim+exc.zap)", `0,45×(${n0(x.excavCim)}+${n0(x.excavZap)})`, "Relleno con material propio", 1),
      fila("EST-02.02.04", x.zap > 0 ? x.zap / 0.55 : 0, "=Vzap/0,55", x.zap > 0 ? `${n0(x.zap)}/0,55` : "0", "Cama de apoyo de zapata", 0),
      fila("EST-02.02.05", 0.35 * x.excavCim, "=0,35×exc.cim", `0,35×${n0(x.excavCim)}`, "Relleno de zanja de cimiento", 1),
      fila("EST-02.03.01", x.elim, "=0,55×(exc.cim+exc.zap+masiva)", `0,55×(${n0(x.excavCim)}+${n0(x.excavZap)}+${n0(s.excavMasiva)})`, "Eliminación D=5 km", 1),
      fila("EST-02.03.03", x.elim, "=exc.eliminación", n0(x.elim), "Carguío de excedente", 1),
      fila("EST-02.04.01", 0.28 * Ag, "=0,28×Ag", `0,28×${n0(Ag)}`, "Nivelación de fondo / plataforma", 0),
      fila("EST-03.01.01", x.solado, "=0,20×Ag", `0,20×${n0(Ag)}`, "Solado de limpieza", 1),
      fila("EST-03.01.02", x.falsoPiso, "=0,42×Ag", `0,42×${n0(Ag)}`, "Falso piso", 0),
      fila("EST-03.02.01", x.cimCorr, "=0,082×Ag+0,006×At", `0,082×${n0(Ag)}+0,006×${n0(At)}`, "Cimiento corrido", 1),
      fila("EST-03.02.02", x.sobrecim, "=0,038×Ag", `0,038×${n0(Ag)}`, "Sobrecimiento simple (sin armar)", 1),
      fila("EST-03.03.01", x.ciclopeo, "=0,018×Ag", `0,018×${n0(Ag)}`, "Ciclópeo / relleno de piedra", 1),
      fila("EST-03.04.01", x.solado + x.falsoPiso, "=solado+falso piso", `${n0(x.solado)}+${n0(x.falsoPiso)}`, "Curado de concreto simple", 0),
      fila("EST-04.01.01", x.zap, "=0,036×Ag×(1+0,14×(n−1))", `0,036×${n0(Ag)}×(1+0,14×${n - 1})`, "Concreto de zapata", 1),
      fila("EST-04.02.01", 72 * x.zap, "=72×Vzap", `72×${n0(x.zap)}`, "kg acero zapata", 0),
      fila("EST-04.03.05", 6.2 * x.zap, "=6,2×Vzap", `6,2×${n0(x.zap)}`, "m² encofrado zapata", 0),
      fila("EST-04.20.01", 6.2 * x.zap, "=área encofrada zapata", `6,2×${n0(x.zap)}`, "Curado de zapatas", 0),
      fila("EST-04.01.09", x.dado, "=0,007×Ag×n", `0,007×${n0(Ag)}×${n}`, "Dados / pedestales", 1),
      fila("EST-04.26.01", 110 * x.dado, "=110×Vdado", `110×${n0(x.dado)}`, "kg acero dado", 0),
      fila("EST-04.26.02", 7.2 * x.dado, "=7,2×Vdado", `7,2×${n0(x.dado)}`, "m² encofrado dado", 0),
      fila("EST-04.20.02", 7.2 * x.dado, "=área encofrada dado", `7,2×${n0(x.dado)}`, "Curado de dados", 0),
      fila("EST-04.21.01", 0, "dato platea (m³)", "0", "Platea solo si el proyecto la tiene", 1, "dato"),
      fila("EST-04.21.02", 0, "92×Vplatea", "0", "kg acero platea", 0),
      fila("EST-04.21.03", 0, "borde platea", "0", "m² encofrado de borde", 0),
      fila("EST-04.20.03", 0, "área platea", "0", "Curado de platea", 0),
      fila("EST-04.22.01", 0.01 * Ag * (1 + 0.06 * (n - 1)), "=0,010×Ag×(1+0,06×(n−1))", `0,010×${n0(Ag)}×(1+0,06×${n - 1})`, "Viga de conexión", 1),
      fila("EST-04.22.02", 118 * 0.01 * Ag * (1 + 0.06 * (n - 1)), "=118×Vconex", `118×${n0(0.01 * Ag * (1 + 0.06 * (n - 1)))}`, "kg acero viga de conexión", 0),
      fila("EST-04.22.03", 8.4 * 0.01 * Ag * (1 + 0.06 * (n - 1)), "=8,4×Vconex", `8,4×${n0(0.01 * Ag * (1 + 0.06 * (n - 1)))}`, "m² encofrado viga de conexión", 0),
      fila("EST-04.20.04", 8.4 * 0.01 * Ag * (1 + 0.06 * (n - 1)), "=área viga de conexión", `8,4×${n0(0.01 * Ag * (1 + 0.06 * (n - 1)))}`, "Curado viga de conexión", 0),
      fila("EST-04.01.08", x.vigaCim, "=0,016×Ag×(1+0,08×(n−1))", `0,016×${n0(Ag)}×(1+0,08×${n - 1})`, "Viga de cimentación", 1),
      fila("EST-04.23.01", 118 * x.vigaCim, "=118×Vvcim", `118×${n0(x.vigaCim)}`, "kg acero viga de cimentación", 0),
      fila("EST-04.23.02", 8.4 * x.vigaCim, "=8,4×Vvcim", `8,4×${n0(x.vigaCim)}`, "m² encofrado viga de cimentación", 0),
      fila("EST-04.20.05", 8.4 * x.vigaCim, "=área viga de cimentación", `8,4×${n0(x.vigaCim)}`, "Curado viga de cimentación", 0),
      fila("EST-04.01.02", x.col, "=0,034×At", `0,034×${n0(At)}`, "Concreto de columna", 1),
      fila("EST-04.02.02", 128 * x.col, "=128×Vcol", `128×${n0(x.col)}`, "kg acero columna", 0),
      fila("EST-04.03.01", 7.8 * x.col, "=7,8×Vcol", `7,8×${n0(x.col)}`, "m² encofrado columna", 0),
      fila("EST-04.20.06", 7.8 * x.col, "=área columna", `7,8×${n0(x.col)}`, "Curado de columnas", 0),
      fila("EST-04.01.03", x.vig, "=0,054×At", `0,054×${n0(At)}`, "Concreto de viga", 1),
      fila("EST-04.02.03", 118 * x.vig, "=118×Vvig", `118×${n0(x.vig)}`, "kg acero viga", 0),
      fila("EST-04.03.02", 8.2 * x.vig, "=8,2×Vvig", `8,2×${n0(x.vig)}`, "m² encofrado viga", 0),
      fila("EST-04.20.07", 8.2 * x.vig, "=área viga", `8,2×${n0(x.vig)}`, "Curado de vigas", 0),
      fila("EST-04.01.04", x.losaAli, "=MAX(0;0,074×At−losaMaciza)", `MAX(0;0,074×${n0(At)}−${n0(s.losaMaciza)})`, "Losa aligerada", 1),
      fila("EST-04.02.04", 92 * x.losaAli, "=92×VlosaAli", `92×${n0(x.losaAli)}`, "kg acero losa aligerada", 0),
      fila("EST-04.03.03", x.losaAli > 0 ? At : 0, "=SI(losaAli>0;At;0)", x.losaAli > 0 ? n0(At) : "0", "m² encofrado losa aligerada", 0),
      fila("EST-04.04.01", x.losaAli > 0 ? At : 0, "=SI(losaAli>0;At;0)", x.losaAli > 0 ? n0(At) : "0", "Ladrillo hueco de techo", 0),
      fila("EST-04.20.08", x.losaAli > 0 ? At : 0, "=área losa aligerada", x.losaAli > 0 ? n0(At) : "0", "Curado losa aligerada", 0),
      fila("EST-04.01.07", s.losaMaciza, "dato losaMaciza", n0(s.losaMaciza), "Losa maciza (QX, tanque, rampa)", 1, "dato"),
      fila("EST-04.24.01", 92 * s.losaMaciza, "=92×VlosaMac", `92×${n0(s.losaMaciza)}`, "kg acero losa maciza", 0),
      fila("EST-04.03.04", 9.5 * s.losaMaciza, "=9,5×VlosaMac", `9,5×${n0(s.losaMaciza)}`, "m² encofrado losa maciza", 0),
      fila("EST-04.20.09", 9.5 * s.losaMaciza, "=área losa maciza", `9,5×${n0(s.losaMaciza)}`, "Curado losa maciza", 0),
      fila("EST-04.01.05", s.placas, "dato placas", n0(s.placas), "m³ de placa / muro de corte", 1, "dato"),
      fila("EST-04.02.05", 138 * s.placas, "=138×Vplaca", `138×${n0(s.placas)}`, "kg acero placa", 0),
      fila("EST-04.26.04", 9.5 * s.placas, "=9,5×Vplaca", `9,5×${n0(s.placas)}`, "m² encofrado placa", 0),
      fila("EST-04.20.10", 9.5 * s.placas, "=área placa", `9,5×${n0(s.placas)}`, "Curado de placas", 0),
      fila("EST-04.01.06", x.esc, "=1,7×n", `1,7×${n}`, "Concreto de escalera por tramo-nivel", 1),
      fila("EST-04.26.03", 130 * x.esc, "=130×Vesc", `130×${n0(x.esc)}`, "kg acero escalera", 0),
      fila("EST-04.03.06", 12 * n, "=12×n", `12×${n}`, "m² encofrado escalera", 0),
      fila("EST-04.20.11", 12 * n, "=área escalera", `12×${n}`, "Curado de escaleras", 0),
      fila("EST-04.01.10", s.cisternaEst, "dato cisternaEst", n0(s.cisternaEst), "m³ cisterna estructural", 1, "dato"),
      fila("EST-04.26.05", 140 * s.cisternaEst, "=140×Vcis", `140×${n0(s.cisternaEst)}`, "kg acero cisterna", 0),
      fila("EST-04.26.06", 8.8 * s.cisternaEst, "=8,8×Vcis", `8,8×${n0(s.cisternaEst)}`, "m² encofrado cisterna", 0),
      fila("EST-04.20.13", 8.8 * s.cisternaEst, "=área cisterna", `8,8×${n0(s.cisternaEst)}`, "Curado de cisterna", 0),
    ],
  };

  const is: MetradoHoja = {
    id: "03",
    nombre: "03 IS",
    procedimiento: [
      "Puntos de agua fría = inodoros + lavatorios + duchas + cocinas + lavanderías.",
      "Puntos de agua caliente = duchas + cocinas + termas.",
      "Puntos de desagüe = mismos aparatos de agua fría. Salida de ventilación = n.º de SS.HH.",
      "Red de agua fría (ml) = 0,28·At + 6·SS.HH. Red de desagüe = 0,18·At + 4·SS.HH.",
      "Red de agua caliente = 0,14·At + 4·SS.HH. si hay puntos de AC. Montante / alimentación = 3,5·n si n≥2.",
      "Agua contra incendio (IS-03.01.02) solo si n≥3 o At>800 m².",
      "Aparatos se metran uno a uno (und). No se estima por m². Títulos y subtítulos según Reglamento Nacional de Metrados.",
    ],
    filas: [
      fila("IS-00.01.01", At, "=At", n0(At), "Plano sanitario / pruebas", 0),
      fila("IS-01.01.01", x.pAgua, "=IN+LV+DU+CO+LA", `${s.inodoros}+${s.lavatorios}+${s.duchas}+${s.cocinas}+${s.lavanderias}`, "Puntos de agua fría", 0),
      fila("IS-01.01.02", x.pCal, "=DU+CO+TE", `${s.duchas}+${s.cocinas}+${s.termas}`, "Puntos de agua caliente", 0),
      fila("IS-01.02.01", x.pDes, "=IN+LV+DU+CO+LA", `${s.inodoros}+${s.lavatorios}+${s.duchas}+${s.cocinas}+${s.lavanderias}`, "Puntos de desagüe", 0),
      fila("IS-01.02.02", s.sshh, "=SS.HH.", n0(s.sshh), "Ventilación / salida de techo", 0),
      fila("IS-02.01.01", s.inodoros, "dato inodoros", n0(s.inodoros), "Aparato", 0, "dato"),
      fila("IS-02.01.02", s.lavatorios, "dato lavatorios", n0(s.lavatorios), "Aparato", 0, "dato"),
      fila("IS-02.01.03", s.duchas, "dato duchas", n0(s.duchas), "Aparato", 0, "dato"),
      fila("IS-02.01.04", s.cocinas, "dato cocinas", n0(s.cocinas), "Aparato", 0, "dato"),
      fila("IS-02.01.05", s.lavanderias, "dato lavanderias", n0(s.lavanderias), "Aparato", 0, "dato"),
      fila("IS-02.02.01", s.termas, "dato termas", n0(s.termas), "Terma / calentador", 0, "dato"),
      fila("IS-02.03.01", s.sshh, "=SS.HH.", n0(s.sshh), "Accesorios de baño por ambiente", 0),
      fila("IS-03.01.01", 0.28 * At + 6 * s.sshh, "=0,28×At+6×SS.HH.", `0,28×${n0(At)}+6×${s.sshh}`, "ml agua fría · redes de distribución", 0),
      fila("IS-03.01.09", x.pCal > 0 ? 0.14 * At + 4 * s.sshh : 0, "=SI(pCal>0;0,14×At+4×SS.HH.;0)", x.pCal > 0 ? `0,14×${n0(At)}+4×${s.sshh}` : "0", "ml agua caliente · redes de distribución", 0),
      fila("IS-03.05.01", n >= 2 ? 3.5 * n : 0, "=SI(n≥2;3,5×n;0)", n >= 2 ? `3,5×${n}` : "0", "Montante · redes de alimentación", 0),
      fila("IS-04.2.4.01", 1, "1", "1", "Accesorios de redes de agua (glb)", 0),
      fila("IS-03.01.02", n >= 3 || At > 800 ? 0.12 * At : 0, "=SI(n≥3 ó At>800;0,12×At;0)", n >= 3 || At > 800 ? `0,12×${n0(At)}` : "0", "Red contra incendio sanitaria", 0),
      fila("IS-04.4.4.01", n >= 3 || At > 800 ? Math.max(2, n) : 0, "=SI(n≥3 ó At>800;MAX(2;n);0)", n >= 3 || At > 800 ? `${Math.max(2, n)}` : "0", "Junta antisísmica CI", 0),
      fila("IS-03.02.01", 0.18 * At + 4 * s.sshh, "=0,18×At+4×SS.HH.", `0,18×${n0(At)}+4×${s.sshh}`, "ml desagüe · redes colectoras", 0),
      fila("IS-03.02.02", 0.12 * At + 3 * s.sshh, "=0,12×At+3×SS.HH.", `0,12×${n0(At)}+3×${s.sshh}`, "ml ramales · redes de derivación", 0),
      fila("IS-03.03.01", Math.max(2, Math.round(s.sshh * 0.45) + n), "=MAX(2;REDONDEAR(0,45×SS.HH.;0)+n)", `${Math.max(2, Math.round(s.sshh * 0.45) + n)}`, "Cajas de registro", 0),
      fila("IS-01.02.03", Math.max(1, Math.round(At / 90)), "=MAX(1;REDONDEAR(At/90;0))", `${Math.max(1, Math.round(At / 90))}`, "Salidas de drenaje pluvial", 0),
      fila("IS-03.04.01", 0.28 * At + 6 * s.sshh, "=0,28×At+6×SS.HH.", `0,28×${n0(At)}+6×${s.sshh}`, "ml ventilación / montantes", 0),
      fila("IS-04.01.01", s.tanques, "dato tanques", n0(s.tanques), "Tanque elevado", 0, "dato"),
      fila("IS-04.02.01", s.cisterna, "dato cisterna", n0(s.cisterna), "Cisterna (und de equipo, no m³)", 0, "dato"),
      fila("IS-04.03.01", 1, "1", "1", "Llave de paso general", 0),
      fila("IM-06.02.01", s.cocinas > 0 ? 8 + 5 * s.cocinas : 0, "=SI(cocinas>0;8+5×cocinas;0)", s.cocinas > 0 ? `8+5×${s.cocinas}` : "0", "ml tubería de gas a la vista", 0),
      fila("IS-07.4.1.01", s.cocinas, "dato cocinas", n0(s.cocinas), "Ventilación de gas", 0, "dato"),
    ],
  };

  const ie: MetradoHoja = {
    id: "04",
    nombre: "04 IE",
    procedimiento: [
      "Salidas de iluminación y tomas son conteo de plano (hoja DATOS). Semilla clínica ≈ At/5 puntos de luz.",
      "Canalización Ø20 = 0,45·At + 8·SS.HH.  Ø16 = 0,35·At + 6·SS.HH.",
      "THW-90 2,5 mm² = 1,8·At + 20·SS.HH.  THW 4 mm² = 0,55·At + 8·SS.HH.  THHN 12 AWG = 0,9·At + 12·SS.HH.",
      "Salidas de emergencia = 6 % de la iluminación (mínimo 1). Punto de fuerza de bomba / reserva = At/35.",
      "Tablero general, medidor y pozos de tierra son dato (1 por acometida típica; más en hospital).",
    ],
    filas: [
      fila("IE-00.01.01", At, "=At", n0(At), "Plano eléctrico / pruebas", 0),
      fila("IE-01.01.01", s.ilum, "dato ilum", n0(s.ilum), "Salida de iluminación", 0, "dato"),
      fila("IE-01.01.02", s.toma, "dato toma", n0(s.toma), "Tomacorriente", 0, "dato"),
      fila("IE-01.01.03", s.tomaEsp, "dato tomaEsp", n0(s.tomaEsp), "Toma especial / fuerza", 0, "dato"),
      fila("IE-01.02.01", s.termas, "dato termas", n0(s.termas), "Circuito de terma", 0, "dato"),
      fila("IE-01.03.01", s.timbre, "dato timbre", n0(s.timbre), "Timbre / llamado", 0, "dato"),
      fila("IE-02.01.01", s.tabGral, "dato tabGral", n0(s.tabGral), "Tablero general", 0, "dato"),
      fila("IE-02.01.02", s.tabDpto, "dato tabDpto", n0(s.tabDpto), "Tablero de piso / departamento", 0, "dato"),
      fila("IE-02.02.01", s.medidor, "dato medidor", n0(s.medidor), "Medidor", 0, "dato"),
      fila("IE-03.01.01", s.pozo, "dato pozo", n0(s.pozo), "Pozo a tierra", 0, "dato"),
      fila("IE-05.3.01", n >= 4 || At > 1500 ? 1 : 0, "=SI(n≥4 ó At>1500;1;0)", n >= 4 || At > 1500 ? "1" : "0", "Pararrayos", 0),
      fila("IE-04.01.01", s.alimentador, "dato alimentador", n0(s.alimentador), "ml acometida calle → TDG", 0, "dato"),
      fila("IE-05.01.01", s.lum, "dato lum", n0(s.lum), "Luminaria", 0, "dato"),
      fila("IE-05.01.02", s.focos, "dato focos", n0(s.focos), "Lámpara / foco", 0, "dato"),
      fila("IE-05.02.01", Math.max(1, Math.round(s.ilum * 0.06)), "=MAX(1;REDONDEAR(0,06×ilum;0))", `${Math.max(1, Math.round(s.ilum * 0.06))}`, "Salida de emergencia", 0),
      fila("IE-01.05.01", Math.max(1, Math.round(At / 35)), "=MAX(1;REDONDEAR(At/35;0))", `${Math.max(1, Math.round(At / 35))}`, "Reserva / fuerza de bomba", 0),
      fila("IE-04.03.03", 0.45 * At + 8 * s.sshh, "=0,45×At+8×SS.HH.", `0,45×${n0(At)}+8×${s.sshh}`, "ml tubería Ø20", 0),
      fila("IE-04.12.01", 0.35 * At + 6 * s.sshh, "=0,35×At+6×SS.HH.", `0,35×${n0(At)}+6×${s.sshh}`, "ml tubería Ø16", 0),
      fila("IE-04.10.02", 1.8 * At + 20 * s.sshh, "=1,8×At+20×SS.HH.", `1,8×${n0(At)}+20×${s.sshh}`, "m THW-90 2,5 mm²", 0),
      fila("IE-04.10.03", 0.55 * At + 8 * s.sshh, "=0,55×At+8×SS.HH.", `0,55×${n0(At)}+8×${s.sshh}`, "m THW-90 4 mm²", 0),
      fila("IE-04.05.02", 0.9 * At + 12 * s.sshh, "=0,90×At+12×SS.HH.", `0,90×${n0(At)}+12×${s.sshh}`, "m THHN 12 AWG", 0),
    ],
  };

  const comIm: MetradoHoja = {
    id: "05",
    nombre: "05 COM · IM",
    procedimiento: [
      "TV, teléfono, data, intercom, portería y rack son conteo de plano (puntos + gabinetes).",
      "Bomba de agua: und de equipo. Si hay al menos una bomba, se incluye el control (IM-01.02.01 = 1).",
      "Red contra incendio (ml), gabinetes y extintores son dato de programa / RNE A.130.",
      "Extractores = ambientes húmedos + QX + laboratorio. Ascensor = 0 si n < 4, salvo hospital I-4 en adelante.",
      "IM-00.01.01 (plano mecánico) = At. Rejillas / difusores ≈ At/40.",
    ],
    filas: [
      fila("COM-01.01.01", s.tv, "dato tv", n0(s.tv), "Punto TV", 0, "dato"),
      fila("COM-01.01.02", s.tel, "dato tel", n0(s.tel), "Punto teléfono", 0, "dato"),
      fila("COM-01.01.03", s.data, "dato data", n0(s.data), "Punto data", 0, "dato"),
      fila("COM-02.01.01", s.intercom, "dato intercom", n0(s.intercom), "Intercomunicador", 0, "dato"),
      fila("COM-02.02.01", s.porteria, "dato porteria", n0(s.porteria), "Portería / control de acceso", 0, "dato"),
      fila("COM-03.01.01", s.rack, "dato rack", n0(s.rack), "Rack / gabinete", 0, "dato"),
      fila("COM-03.04.01", s.rack, "dato rack", n0(s.rack), "Patch panel 24 puertos", 0, "dato"),
      fila("COM-06.1.1.01", s.data > 0 ? 18 * s.data : 0, "=SI(data>0;18×data;0)", s.data > 0 ? `18×${s.data}` : "0", "Cables en tuberías (estructurado)", 0),
      fila("IM-01.01.01", s.bombas, "dato bombas", n0(s.bombas), "Bomba de agua", 0, "dato"),
      fila("IM-01.02.01", s.bombas > 0 ? 1 : 0, "=SI(bombas>0;1;0)", s.bombas > 0 ? "1" : "0", "Tablero / control de bombas", 0),
      fila("IM-02.01.01", s.ciM, "dato ciM", n0(s.ciM), "ml red contra incendio", 0, "dato"),
      fila("IM-02.02.01", s.gabCI, "dato gabCI", n0(s.gabCI), "Gabinete CI", 0, "dato"),
      fila("IM-02.03.01", s.ext, "dato ext", n0(s.ext), "Extintor", 0, "dato"),
      fila("IM-02.04.01", s.bombaCI, "dato bombaCI", n0(s.bombaCI), "Bomba contra incendio", 0, "dato"),
      fila("IM-03.01.01", s.extractores, "dato extractores", n0(s.extractores), "Extractor", 0, "dato"),
      fila("IM-04.01.01", s.ascensor, "dato ascensor", n0(s.ascensor), "Ascensor", 0, "dato"),
      fila("IM-00.01.01", At, "=At", n0(At), "Plano mecánico / pruebas", 0),
      fila("IM-05.01.02", Math.max(1, Math.round(At / 40)), "=MAX(1;REDONDEAR(At/40;0))", `${Math.max(1, Math.round(At / 40))}`, "Rejilla / difusor", 0),
      fila("IM-06.01.01", s.cocinas, "dato cocinas", n0(s.cocinas), "Punto de gas / campana", 0, "dato"),
    ],
  };

  const extras = (s.extras ?? []).filter((e) => e.metrado > 0);
  const extraHoja: MetradoHoja | null = extras.length
    ? {
        id: "06",
        nombre: "06 EXTRAS · DOTACIÓN",
        procedimiento: [
          "Partidas que no salen de Ag/At/n: equipamiento por UPSS, gases medicinales, grupo electrógeno, ATS, veredas o ítems de la especialidad.",
          "En salud, la cantidad es semilla por categoría NTS 021. El plano y el listado MINSA-DIEM mandan.",
          "Si el código no entra en esta categoría, no aparece (filtro partidaPermitidaEnCategoria).",
        ],
        filas: extras.map((e) => {
          const m = meta(e.codigo);
          return {
            codigo: e.codigo,
            descripcion: m.descripcion,
            und: m.und,
            formula: "semilla de categoría / extras de plantilla",
            reemplazo: n0(e.metrado, 2),
            metrado: e.metrado,
            norma: "Ajustar con plano, listado de equipos y UPSS reales.",
            tipo: "semilla" as const,
          };
        }),
      }
    : null;

  return extraHoja ? [datos, arq, est, is, ie, comIm, extraHoja] : [datos, arq, est, is, ie, comIm];
}

export function hojaProgramaMinsa(cat: CategoriaMinsa): MetradoHoja {
  const p = PROGRAMA_MINSA[cat];
  const m = CATEGORIA_MINSA_META[cat];
  return {
    id: "P0",
    nombre: "P0 PROGRAMA",
    procedimiento: textoPrograma(cat),
    filas: [
      ...p.ambientes.map((a, i) => ({
        codigo: `AMB-${String(i + 1).padStart(2, "0")}`,
        descripcion: `${a.upss} · ${a.ambiente}`,
        und: "m²",
        formula: `${a.n} × ${n0(a.areaUnd, 1)}`,
        reemplazo: `${a.n} × ${n0(a.areaUnd, 1)} = ${n0(a.n * a.areaUnd, 1)}`,
        metrado: q(a.n * a.areaUnd, 1),
        norma: a.nota || m.norma,
        tipo: "semilla" as const,
      })),
      {
        codigo: "AMB-Σ",
        descripcion: "Suma de ambientes (cierra con At)",
        und: "m²",
        formula: "SUMA(ambientes)",
        reemplazo: n0(areaPrograma(p), 1),
        metrado: q(areaPrograma(p), 1),
        norma: `${m.obra}. Circulación incluida.`,
        tipo: "formula",
      },
      dato("P-CAM", "Camas de internamiento", p.camas, "und", "0 en I-1 a I-3. I-4 en adelante."),
      dato("P-CX", "Consultorios", p.consultorios, "und", "Consulta externa del programa."),
      dato("P-QX", "Quirófanos", p.quirófanos, "und", "0 hasta I-4. Desde II-1."),
      dato("P-SP", "Salas de partos", p.salasParto, "und", ""),
      dato("P-UCI", "Cubículos UCI", p.cubiculosUci, "und", "Desde II-2."),
    ],
  };
}

const PROC_RUBRO: Record<string, string[]> = {
  edificaciones: [
    "Excel tipo vivienda / edificio: hoja DATOS → ARQ → EST → IS → IE → COM/IM → presupuesto.",
    "Coeficientes de concreto y acero son de predimensionamiento (Morales / expediente tipo). El plano de estructuras manda.",
  ],
  salud: [
    "Igual que un expediente MINSA: primero el programa de ambientes (UPSS), luego metrados de obra, luego dotación EQ/MA/UT por ambiente.",
    "I-1 no tiene internamiento ni QX. II-1 abre emergencia 24 h y quirófano. II-2 abre UCI y TAC. III-1 abre RM y PSA.",
  ],
  carreteras: [
    "Metrado de vía = longitud × ancho de calzada (o de cada capa). Afirmado, subbase, base y carpeta se metran en m² o m³ según partida.",
    "Drenaje: ml de cuneta = L. Alcantarillas: und × luz. Señales: und. El eje del plano manda.",
  ],
  puentes: [
    "Metrado por elemento: estribos (m³), vigas (und o m³), losa (m²), baranda (ml), apoyos (und), enfoque (m³).",
    "Cada tipología (losa, CA, pretensada, cajón, Bailey…) trae solo las partidas PTE- de esa familia.",
  ],
  saneamiento: [
    "Red = longitud de tramo × (excavación, cama, tubería, relleno, prueba). Buzón = und. Empalme predial = und.",
    "PTAR / UBS: módulos × familia. No se estima por m² de terreno.",
  ],
  hidraulica: [
    "Canal: L × sección (excavación, revestimiento, junta). Bocatoma y desarenador: und / m³ de concreto.",
    "Conducción HDPE: ml. Gavión: m³. El perfil hidráulico manda.",
  ],
  habilitaciones: [
    "Loteo: und de lote + ml de vía. Pistas/veredas: m². Redes: ml. Alumbrado: und de poste. Parque: m².",
  ],
  pavimentos: [
    "Demolición (m²/m³) → capas (m² o m³) → carpeta o losa (m²) → vereda PMR (m²) → sumidero (und) → señalización (m²/und).",
  ],
  deportivas: [
    "Losa IPD: m² de cancha 32×19 (608 m²) + ml de cerco, canaleta, cimiento y sobrecimiento + und de postes, aros y arcos. Grass: m² de rollo, shock pad e infill + ml de drenaje HDPE. Complejo: suma de losas + grass + cobertura + m² de vestidores.",
    "La losa de cancha es e=10–15 cm f'c 175–210, no la losa de pista e=20 cm. Juntas ≤ 3.00 m. Pendiente de drenaje ≈ 1 %.",
  ],
};

export function hojaSemillaLineas(
  nombre: string,
  procedimiento: string[],
  lineas: { codigo: string; metrado: number }[],
): MetradoHoja {
  return {
    id: "S1",
    nombre,
    procedimiento,
    filas: lineas.map((l) => {
      const m = meta(l.codigo);
      return {
        codigo: l.codigo,
        descripcion: m.descripcion,
        und: m.und,
        formula: "semilla de plantilla (ajustar con plano)",
        reemplazo: n0(l.metrado, 2),
        metrado: l.metrado,
        norma: "El metrado definitivo sale de planos, secciones y RN Metrados.",
        tipo: "semilla" as const,
      };
    }),
  };
}

export function libroDesdeSpec(opts: {
  titulo: string;
  resumen: string;
  categoria: string;
  spec: SpecMetrado;
  categoriaMinsa?: CategoriaMinsa;
}): MetradoLibro {
  const hojas = hojasEdificio(opts.spec);
  if (opts.categoriaMinsa) {
    hojas.unshift(hojaProgramaMinsa(opts.categoriaMinsa));
  }
  const meta = opts.categoriaMinsa ? CATEGORIA_MINSA_META[opts.categoriaMinsa] : null;
  return {
    titulo: opts.titulo,
    subtitulo: opts.resumen,
    norma: meta?.norma ?? "RN Metrados · expediente tipo (hojas como Excel de metrados)",
    hojas,
  };
}

export function libroDesdeLineas(opts: {
  titulo: string;
  resumen: string;
  categoria: string;
  lineas: { codigo: string; metrado: number }[];
  categoriaMinsa?: CategoriaMinsa;
}): MetradoLibro {
  const proc = PROC_RUBRO[opts.categoria] ?? [
    "Esta plantilla es una semilla de partidas. El metrado se ajusta con el plano, el eje o la sección típica.",
  ];
  const hojas = [hojaSemillaLineas("S1 SEMILLA", proc, opts.lineas)];
  if (opts.categoriaMinsa) hojas.unshift(hojaProgramaMinsa(opts.categoriaMinsa));
  const meta = opts.categoriaMinsa ? CATEGORIA_MINSA_META[opts.categoriaMinsa] : null;
  return {
    titulo: opts.titulo,
    subtitulo: opts.resumen,
    norma: meta?.norma ?? "Semilla de expediente. Revise cada fila contra el plano.",
    hojas,
  };
}
