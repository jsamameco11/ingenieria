import type { Partida } from "./types";
import { p, r } from "./partidaBuilder";
import { RN } from "./rnMetrados";

/** Partidas que faltaban para completar títulos oficiales del Reglamento Nacional de Metrados. No sustituyen insumos existentes. */
export const PARTIDAS_RN_METRADOS: Partida[] = [
  p("sanitarias", RN.s411, "IS-04.1.1.01", "Suministro de inodoro tanque bajo", "und", r(["MO-GAS", 0.3], ["MO-AYU", 0.2], ["MAT-INOD", 1], ["EQ-HIN", 2])),
  p("sanitarias", RN.s412, "IS-04.1.2.01", "Suministro de juego de accesorios de baño", "und", r(["MO-GAS", 0.2], ["MO-AYU", 0.15], ["MAT-ACC", 1], ["EQ-HIN", 2])),
  p("sanitarias", RN.s424, "IS-04.2.4.01", "Accesorios de redes de agua fría (codos, tees y uniones PVC SAP)", "glb", r(["MO-GAS", 1.2], ["MO-AYU", 0.8], ["MAT-CODOAF", 12], ["MAT-CODO", 8], ["MAT-PEGV", 0.2], ["EQ-HIN", 4])),
  p("sanitarias", RN.s427, "IS-04.2.7.01", "Equipo de bombeo de agua fría 0.75 HP", "und", r(["MO-MEC", 6], ["MO-GAS", 3], ["MO-AYU", 4], ["MAT-BOMBA", 1], ["MAT-VALV", 2], ["MAT-PVC32", 6], ["EQ-HIN", 4])),
  p("sanitarias", RN.s433, "IS-04.3.3.01", "Accesorios de redes de agua caliente CPVC", "glb", r(["MO-GAS", 1.1], ["MO-AYU", 0.7], ["MAT-CODO", 10], ["MAT-PEGV", 0.18], ["EQ-HIN", 4])),
  p("sanitarias", RN.s434, "IS-04.3.4.01", "Válvula de agua caliente bronce ½\"", "und", r(["MO-GAS", 0.55], ["MO-AYU", 0.35], ["MAT-VALV", 1], ["EQ-HIN", 4])),
  p("sanitarias", RN.s442, "IS-04.4.2.01", "Accesorios de red contra incendio", "glb", r(["MO-MEC", 1.5], ["MO-AYU", 1], ["MAT-VALV", 2], ["EQ-HIN", 4])),
  p("sanitarias", RN.s444, "IS-04.4.4.01", "Suministro e instalación de junta antisísmica en red contra incendio", "und", r(["MO-MEC", 2.2], ["MO-AYU", 1.4], ["MAT-JUNTASI", 1], ["EQ-HIN", 4])),
  p("sanitarias", RN.s445, "IS-04.4.5.01", "Válvula de sistema contra incendio Ø2\"", "und", r(["MO-MEC", 1.8], ["MO-AYU", 1.2], ["MAT-VALV", 1], ["EQ-HIN", 4])),
  p("sanitarias", RN.s452, "IS-04.5.2.01", "Accesorios de drenaje pluvial (codos y uniones)", "glb", r(["MO-GAS", 1], ["MO-AYU", 0.7], ["MAT-CODO", 8], ["MAT-ANIL", 4], ["EQ-HIN", 4])),
  p("sanitarias", RN.s464, "IS-04.6.4.01", "Accesorios de redes colectoras de desagüe", "glb", r(["MO-GAS", 1.1], ["MO-AYU", 0.8], ["MAT-CODO", 6], ["MAT-ANIL", 6], ["EQ-HIN", 4])),
  p("sanitarias", RN.s4652, "IS-04.6.5.02", "Buzón de inspección de desagüe (edificación)", "und", r(["MO-GAS", 4], ["MO-PEO", 5], ["MAT-CEM", 3.5], ["MAT-TAPA", 1], ["EQ-HIN", 5])),
  p("sanitarias", RN.s466, "IS-04.6.6.01", "Instalaciones especiales de desagüe y ventilación", "glb", r(["MO-GAS", 2], ["MO-AYU", 1.5], ["MAT-TUBO", 8], ["EQ-HIN", 4])),

  p("electricas", RN.e53, "IE-05.3.01", "Instalación de pararrayos (mástil + bajada + conexión a tierra)", "und", r(["MO-TEC", 8], ["MO-ELE", 6], ["MO-PEO", 4], ["MAT-FY42", 12], ["MAT-CAB8", 18], ["EQ-HIN", 4])),

  p("comunicaciones", RN.c611, "COM-06.1.1.01", "Cables de comunicaciones en tuberías (cableado estructurado)", "m", r(["MO-TEL", 0.08], ["MO-AYU", 0.06], ["MAT-UTP", 1.05], ["MAT-TUBO", 1.05], ["EQ-HIN", 4])),
  p("comunicaciones", RN.c67, "COM-06.7.01", "Caja de pase para transformador de comunicaciones", "und", r(["MO-TEL", 1.8], ["MO-AYU", 1.2], ["MAT-CAJAE", 1], ["EQ-HIN", 4])),

  p("sanitarias", RN.g712, "IS-07.1.2.01", "Tubería de gas con canaleta o por conducto cobre Ø½\"", "m", r(["MO-GAS", 0.42], ["MO-AYU", 0.28], ["MAT-TUBGAS", 1.05], ["MAT-TUBO", 1.05], ["EQ-HIN", 5])),
  p("sanitarias", RN.g713, "IS-07.1.3.01", "Tubería montante de gas cobre Ø½\"", "m", r(["MO-GAS", 0.48], ["MO-AYU", 0.32], ["MAT-TUBGAS", 1.05], ["EQ-AND", 0.05], ["EQ-HIN", 5])),
  p("sanitarias", RN.g722, "IS-07.2.2.01", "Conversión de un artefacto a gas natural / GLP", "und", r(["MO-GAS", 3.2], ["MO-AYU", 1.8], ["MAT-VALV", 1], ["EQ-HIN", 4])),
  p("sanitarias", RN.g73, "IS-07.3.01", "Accesorios de red de gas", "glb", r(["MO-GAS", 1], ["MO-AYU", 0.7], ["MAT-VALV", 2], ["EQ-HIN", 4])),
  p("sanitarias", RN.g741, "IS-07.4.1.01", "Ventilación superior o inferior de gas", "und", r(["MO-GAS", 1.4], ["MO-AYU", 1], ["MAT-VENTGAS", 1], ["EQ-HIN", 4])),
  p("sanitarias", RN.g751, "IS-07.5.1.01", "Ducto de evacuación de humos para artefacto a gas", "m", r(["MO-GAS", 0.4], ["MO-AYU", 0.28], ["MAT-DUCTGAS", 1.05], ["EQ-HIN", 5])),
  p("sanitarias", RN.g76, "IS-07.6.01", "Gabinete de regulación de gas", "und", r(["MO-GAS", 4], ["MO-AYU", 2.5], ["MAT-GABGAS", 1], ["EQ-HIN", 4])),
];
