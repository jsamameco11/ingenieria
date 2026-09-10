import type { EspecialidadPre, LineaPresupuesto, PresupuestoState } from "./types";
import { CATEGORIA_MINSA_META, detectarCategoriaMinsa, plantillaIdDeCategoria } from "./categoriasMinsa";
import { extrasDeHospital, SPECS_HOSPITALES } from "./plantillasHospitales";
import { PLANTILLAS_AMPLIADAS } from "./plantillasAmpliadas";
import { PLANTILLAS_PUENTES } from "./plantillasPuentes";
import { PLANTILLAS_DEPORTIVAS } from "./plantillasDeportivas";
import { ESPECIALIDADES } from "./types";
import { defaultPresupuesto, uid } from "./engine";
import { cronogramaDesdePresupuesto } from "../cronograma/desdePresupuesto";
import { esCodigoEquipamiento, codigoPartidaEquipamiento } from "./partidasEquipamiento";
import {
  libroDesdeLineas,
  libroDesdeSpec,
  lineasDesdeSpec,
  type MetradoLibro,
  type SpecMetrado,
} from "./metradoExcel";
import { PARTIDA_BY_CODIGO } from "./partidas";
import { RN } from "./rnMetrados";

export type CategoriaPlantilla =
  | "edificaciones"
  | "salud"
  | "carreteras"
  | "puentes"
  | "saneamiento"
  | "hidraulica"
  | "habilitaciones"
  | "pavimentos"
  | "deportivas";

export const CATEGORIA_PLANTILLA_META: Record<
  CategoriaPlantilla,
  { label: string; kicker: string; orden: number; blurb: string }
> = {
  edificaciones: {
    label: "Edificaciones",
    kicker: "EDI",
    orden: 1,
    blurb: "Vivienda, hospedaje, educación, comercio, oficinas y edificios públicos. Partidas RN Metrados por especialidad.",
  },
  salud: {
    label: "Salud MINSA",
    kicker: "MIN",
    orden: 2,
    blurb: "Una plantilla por categoría NTS 021: I-1 a III-2. Cada una trae programa de ambientes, hojas de metrado (datos, fórmula y reemplazo) y dotación distinta.",
  },
  carreteras: {
    label: "Carreteras",
    kicker: "CAR",
    orden: 3,
    blurb: "Caminos vecinales y carreteras MTC: afirmado, subbase, base, carpeta, drenaje, alcantarillas y señalización.",
  },
  puentes: {
    label: "Puentes",
    kicker: "PTE",
    orden: 4,
    blurb: "Una plantilla por tipología MTC / AASHTO: losa, vigas CA, pretensadas, cajón, mixto, acero, Bailey SS/DS/DD/TS, cantilever, atirantado, colgante, arco, marco, peatonal, pontón y madera. Catálogo PTE-.",
  },
  saneamiento: {
    label: "Saneamiento",
    kicker: "SAN",
    orden: 5,
    blurb: "Redes de agua potable y alcantarillado, HDPE, buzones, hidrantes, PTAR y reposición de pista.",
  },
  hidraulica: {
    label: "Hidráulica",
    kicker: "HID",
    orden: 6,
    blurb: "Presupuesto TPU de canal, bocatoma, desarenador, sifón, conducción HDPE, gaviones y defensa ribereña.",
  },
  habilitaciones: {
    label: "Habilitaciones urbanas",
    kicker: "HAB",
    orden: 7,
    blurb: "Presupuesto TPU de lotización, pistas, veredas PMR, drenaje pluvial, redes, parques y alumbrado público.",
  },
  pavimentos: {
    label: "Pistas y veredas",
    kicker: "PAV",
    orden: 8,
    blurb: "Presupuesto TPU / EG-2013 urbano: demolición, capas, carpeta o losa, veredas, PMR, sumideros y señalización.",
  },
  deportivas: {
    label: "Plataformas deportivas",
    kicker: "DEP",
    orden: 9,
    blurb: "Losa de usos múltiples IPD 32×19 m, cancha de grass sintético y complejo vecinal (losas + grass + cobertura + vestidores). Partidas y APU alineados a expedientes SEACE / IOARR e IPD.",
  },
};

export type PlantillaPresupuesto = {
  id: string;
  categoria: CategoriaPlantilla;
  nombre: string;
  obra: string;
  lugar: string;
  cliente: string;
  resumen: string;
  area: string;
  lineas: { codigo: string; metrado: number }[];
  categoriaMinsa?: import("./categoriasMinsa").CategoriaMinsa;
  spec?: SpecMetrado;
  gg?: number;
  utilidad?: number;
};

function L(codigo: string, metrado: number) {
  return { codigo, metrado };
}

type SpecEdif = SpecMetrado & {
  id: string;
  nombre: string;
  obra: string;
  cliente: string;
  resumen: string;
};

function lineasEdificio(s: SpecEdif) {
  return lineasDesdeSpec(s);
}

function specDe(s: SpecEdif): SpecMetrado {
  const { id: _id, nombre: _n, obra: _o, cliente: _c, resumen: _r, ...rest } = s;
  return rest;
}

export function edif(s: SpecEdif & { categoria?: CategoriaPlantilla; categoriaMinsa?: import("./categoriasMinsa").CategoriaMinsa }): PlantillaPresupuesto {
  const lineas = lineasEdificio(s);
  return {
    id: s.id,
    categoria: s.categoria ?? "edificaciones",
    nombre: s.nombre,
    obra: s.obra,
    lugar: "Lima, Perú",
    cliente: s.cliente,
    resumen: s.resumen,
    area: `${s.techada.toLocaleString("es-PE")} m² · ${s.pisos} ${s.pisos === 1 ? "piso" : "pisos"} · ${lineas.length} partidas`,
    lineas,
    categoriaMinsa: s.categoriaMinsa,
    spec: specDe(s),
    gg: 10,
    utilidad: 8,
  };
}

const UNIFAMILIAR = edif({
  id: "unifamiliar",
  nombre: "Vivienda unifamiliar",
  obra: "Vivienda unifamiliar de 2 pisos — 150 m²",
  cliente: "Propietario",
  resumen: "Casa de 2 niveles, 3 dormitorios y 2.5 baños. ARQ, EST, IS, IE, COM y bombeo.",
  terreno: 180,
  techada: 150,
  pisos: 2,
  sshh: 3,
  duchas: 2,
  inodoros: 3,
  lavatorios: 3,
  cocinas: 1,
  lavanderias: 1,
  termas: 2,
  drywallTab: 18,
  cieloYeso: 140,
  cieloDrywall: 0,
  pisoCeramico: 52,
  pisoCer45: 0,
  pisoPorc: 28,
  pisoGranito: 8,
  pisoVinil: 0,
  pisoPulido: 0,
  mayolicaSSHH: 32,
  mayolicaCocina: 8,
  p90: 5,
  p80: 3,
  p70: 3,
  pMetal: 1,
  ventanas: 22,
  mamparas: 2,
  baranda: 8,
  rejas: 0,
  cubCalamina: 0,
  cubTeja: 0,
  excavMasiva: 0,
  ilum: 42,
  toma: 36,
  tomaEsp: 4,
  tabGral: 1,
  tabDpto: 0,
  medidor: 1,
  pozo: 1,
  alimentador: 28,
  lum: 18,
  focos: 24,
  timbre: 1,
  tv: 6,
  tel: 2,
  data: 4,
  intercom: 0,
  porteria: 0,
  rack: 0,
  bombas: 1,
  extractores: 3,
  ciM: 0,
  gabCI: 0,
  ext: 3,
  bombaCI: 0,
  ascensor: 0,
  tanques: 1,
  cisterna: 1,
  placas: 0,
  losaMaciza: 0,
  cisternaEst: 0,
  extras: [
    L("IE-04.05.01", 180), // THHN 14 iluminación residencial
  ],
});

const MULTIFAMILIAR = edif({
  id: "multifamiliar",
  nombre: "Vivienda multifamiliar",
  obra: "Edificio multifamiliar 4 pisos — 8 departamentos",
  cliente: "Promotor inmobiliario",
  resumen: "8 dptos. ARQ, EST (placas), IS, IE, COM, IM con contra incendio y ascensor.",
  terreno: 240,
  techada: 720,
  pisos: 4,
  sshh: 16,
  duchas: 16,
  inodoros: 16,
  lavatorios: 16,
  cocinas: 8,
  lavanderias: 8,
  termas: 8,
  drywallTab: 85,
  cieloYeso: 0,
  cieloDrywall: 640,
  pisoCeramico: 220,
  pisoCer45: 0,
  pisoPorc: 140,
  pisoGranito: 48,
  pisoVinil: 0,
  pisoPulido: 0,
  mayolicaSSHH: 145,
  mayolicaCocina: 48,
  p90: 24,
  p80: 16,
  p70: 16,
  pMetal: 2,
  ventanas: 95,
  mamparas: 16,
  baranda: 86,
  rejas: 18,
  cubCalamina: 0,
  cubTeja: 0,
  excavMasiva: 0,
  ilum: 186,
  toma: 168,
  tomaEsp: 24,
  tabGral: 1,
  tabDpto: 8,
  medidor: 9,
  pozo: 2,
  alimentador: 95,
  lum: 72,
  focos: 96,
  timbre: 9,
  tv: 24,
  tel: 16,
  data: 32,
  intercom: 8,
  porteria: 1,
  rack: 1,
  bombas: 2,
  extractores: 16,
  ciM: 48,
  gabCI: 8,
  ext: 12,
  bombaCI: 1,
  ascensor: 1,
  tanques: 2,
  cisterna: 1,
  placas: 14,
  losaMaciza: 8.5,
  cisternaEst: 12,
});

const HOTEL = edif({
  id: "hotel",
  nombre: "Hotel",
  obra: "Hotel 3 estrellas — 40 habitaciones, 4 pisos",
  cliente: "Inversionista hotelero",
  resumen: "Lobby, restaurante, cocina, 40 hab. con baño. Placas, cisterna, CI, portería, rack y 2 ascensores.",
  terreno: 420,
  techada: 1680,
  pisos: 4,
  sshh: 48,
  duchas: 44,
  inodoros: 52,
  lavatorios: 56,
  cocinas: 2,
  lavanderias: 2,
  termas: 8,
  drywallTab: 280,
  cieloYeso: 0,
  cieloDrywall: 1520,
  pisoCeramico: 180,
  pisoCer45: 120,
  pisoPorc: 420,
  pisoGranito: 160,
  pisoVinil: 80,
  pisoPulido: 0,
  mayolicaSSHH: 420,
  mayolicaCocina: 95,
  p90: 48,
  p80: 12,
  p70: 48,
  pMetal: 4,
  ventanas: 220,
  mamparas: 40,
  baranda: 145,
  rejas: 24,
  cubCalamina: 0,
  cubTeja: 0,
  excavMasiva: 85,
  ilum: 420,
  toma: 380,
  tomaEsp: 36,
  tabGral: 1,
  tabDpto: 4,
  medidor: 2,
  pozo: 3,
  alimentador: 180,
  lum: 210,
  focos: 180,
  timbre: 42,
  tv: 48,
  tel: 44,
  data: 56,
  intercom: 8,
  porteria: 1,
  rack: 1,
  bombas: 3,
  extractores: 28,
  ciM: 95,
  gabCI: 12,
  ext: 24,
  bombaCI: 1,
  ascensor: 2,
  tanques: 2,
  cisterna: 1,
  placas: 28,
  losaMaciza: 22,
  cisternaEst: 28,
  extras: [
    L("IE-04.12.02", 420), // canalización Ø40 alimentadores de piso
    L("IE-04.11.02", 2800), // LSOH 2.5 mm² áreas públicas
    L("IE-04.11.03", 900), // LSOH 4 mm²
    L("IE-04.06.02", 160), // alimentador NYY 3×25
    L("IE-05.10.07", 48), // emergencia
  ],
});

const RESTAURANTE = edif({
  id: "restaurante",
  nombre: "Restaurante",
  obra: "Restaurante — salón, cocina y SS.HH. — 220 m²",
  cliente: "Operador gastronómico",
  resumen: "Un nivel: salón, cocina industrial, bar y SS.HH. públicos. Mayólica de cocina, extractores y red contra incendio ligera.",
  terreno: 280,
  techada: 220,
  pisos: 1,
  sshh: 4,
  duchas: 1,
  inodoros: 8,
  lavatorios: 8,
  cocinas: 4,
  lavanderias: 1,
  termas: 2,
  drywallTab: 35,
  cieloYeso: 0,
  cieloDrywall: 200,
  pisoCeramico: 40,
  pisoCer45: 0,
  pisoPorc: 95,
  pisoGranito: 18,
  pisoVinil: 0,
  pisoPulido: 22,
  mayolicaSSHH: 48,
  mayolicaCocina: 62,
  p90: 4,
  p80: 6,
  p70: 4,
  pMetal: 2,
  ventanas: 38,
  mamparas: 0,
  baranda: 0,
  rejas: 8,
  cubCalamina: 0,
  cubTeja: 0,
  excavMasiva: 12,
  ilum: 64,
  toma: 58,
  tomaEsp: 18,
  tabGral: 1,
  tabDpto: 0,
  medidor: 1,
  pozo: 1,
  alimentador: 36,
  lum: 42,
  focos: 18,
  timbre: 1,
  tv: 6,
  tel: 2,
  data: 8,
  intercom: 0,
  porteria: 0,
  rack: 0,
  bombas: 1,
  extractores: 8,
  ciM: 18,
  gabCI: 2,
  ext: 6,
  bombaCI: 0,
  ascensor: 0,
  tanques: 1,
  cisterna: 1,
  placas: 0,
  losaMaciza: 4,
  cisternaEst: 6,
});

const PLANTILLAS_HOSPITALES = SPECS_HOSPITALES.flatMap((s) => {
  const meta = CATEGORIA_MINSA_META[s.categoriaMinsa];
  const extras = extrasDeHospital(s.categoriaMinsa);
  const extrasEq = extras.filter((e) => esCodigoEquipamiento(e.codigo));
  const combo = {
    ...edif({
      ...s,
      id: meta.plantillaId,
      nombre: `${meta.nombre} — infraestructura + equipamiento`,
      obra: meta.obra,
      cliente: "MINSA / Gobierno regional",
      resumen: `${meta.resumen} ${meta.norma}. Obra civil, instalaciones, dotación EQ/MA/UT/MO/HE por UPSS, gases y planta de esta categoría. GG 10 % y utilidad 8 %.`,
      categoria: "salud",
      categoriaMinsa: s.categoriaMinsa,
      extras,
    }),
    gg: 10,
    utilidad: 8,
  };
  const civil = {
    ...edif({
      ...s,
      id: `${meta.plantillaId}-obra-civil`,
      nombre: `${meta.nombre} — solo obra civil e instalaciones`,
      obra: `${meta.obra} (sin equipamiento biomédico ni electromecánico de planta)`,
      cliente: "MINSA / Gobierno regional",
      resumen: `${meta.resumen} Solo ARQ, EST, IS, IE de salidas/tableros, COM e IM de bombeo/CI/ascensor. Sin EQ/MA/UT/MO/HE, IM-08, ATS ni grupo. GG 10 % y utilidad 8 %.`,
      categoria: "salud",
      categoriaMinsa: s.categoriaMinsa,
      extras: extras.filter((e) => !esCodigoEquipamiento(e.codigo)),
    }),
    gg: 10,
    utilidad: 8,
  };
  const equipo: PlantillaPresupuesto = {
    id: `${meta.plantillaId}-equipamiento`,
    categoria: "salud",
    nombre: `${meta.nombre} — solo equipamiento`,
    obra: `Dotación de equipamiento hospitalario por UPSS — ${meta.alias}`,
    lugar: "Lima, Perú",
    cliente: "MINSA / Gobierno regional",
    resumen: `Dotación EQ/MA/UT/MO/HE por UPSS, gastos generales de expediente (EQ-GG), gases (IM-08), ATS y grupo (IE-06 / IE-07) admitidos en ${s.categoriaMinsa}. GG 12 % y utilidad 8 % sobre costo directo. Sin obra civil.`,
    area: `${extrasEq.length} partidas de dotación`,
    lineas: extrasEq,
    categoriaMinsa: s.categoriaMinsa,
    gg: 12,
    utilidad: 8,
  };
  return [combo, civil, equipo];
});

const COLEGIO = edif({
  id: "colegio",
  nombre: "Colegio",
  obra: "Institución educativa — 12 aulas, 2 pisos, 1 480 m²",
  cliente: "MINEDU / UGEL",
  resumen: "Aulas, SS.HH. alumnos, dirección, patio y veredas. Piso cerámico/pulido, intercomunicador, CI y tanques.",
  terreno: 1800,
  techada: 1480,
  pisos: 2,
  sshh: 18,
  duchas: 4,
  inodoros: 36,
  lavatorios: 28,
  cocinas: 1,
  lavanderias: 1,
  termas: 2,
  drywallTab: 60,
  cieloYeso: 980,
  cieloDrywall: 280,
  pisoCeramico: 420,
  pisoCer45: 80,
  pisoPorc: 90,
  pisoGranito: 40,
  pisoVinil: 0,
  pisoPulido: 220,
  mayolicaSSHH: 210,
  mayolicaCocina: 18,
  p90: 28,
  p80: 16,
  p70: 18,
  pMetal: 4,
  ventanas: 210,
  mamparas: 2,
  baranda: 95,
  rejas: 48,
  cubCalamina: 0,
  cubTeja: 0,
  excavMasiva: 95,
  ilum: 280,
  toma: 220,
  tomaEsp: 18,
  tabGral: 1,
  tabDpto: 2,
  medidor: 1,
  pozo: 2,
  alimentador: 110,
  lum: 160,
  focos: 80,
  timbre: 14,
  tv: 14,
  tel: 8,
  data: 36,
  intercom: 6,
  porteria: 1,
  rack: 1,
  bombas: 2,
  extractores: 12,
  ciM: 55,
  gabCI: 8,
  ext: 18,
  bombaCI: 0,
  ascensor: 0,
  tanques: 2,
  cisterna: 1,
  placas: 12,
  losaMaciza: 10,
  cisternaEst: 16,
  extras: [
    L("P-06.01.01", 180),
    L("P-06.02.01", 420),
    L("P-06.03.01", 60),
    L("P-05.03.01", 280),
    L("ARQ-13.01.03", 90),
    L("ARQ-13.01.06", 30),
    L("ARQ-13.05.02", 28),
    L("ARQ-13.06.01", 18),
  ],
});

const OFICINAS = edif({
  id: "oficinas",
  nombre: "Edificio de oficinas",
  obra: "Edificio de oficinas — 5 pisos, 2 000 m²",
  cliente: "Empresa inmobiliaria",
  resumen: "Open space, salas, SS.HH. por piso y hall. Drywall, data, CI, cisterna y un ascensor.",
  terreno: 480,
  techada: 2000,
  pisos: 5,
  sshh: 20,
  duchas: 4,
  inodoros: 24,
  lavatorios: 24,
  cocinas: 5,
  lavanderias: 1,
  termas: 5,
  drywallTab: 520,
  cieloYeso: 0,
  cieloDrywall: 1880,
  pisoCeramico: 80,
  pisoCer45: 0,
  pisoPorc: 380,
  pisoGranito: 140,
  pisoVinil: 620,
  pisoPulido: 0,
  mayolicaSSHH: 220,
  mayolicaCocina: 40,
  p90: 22,
  p80: 18,
  p70: 20,
  pMetal: 4,
  ventanas: 340,
  mamparas: 4,
  baranda: 160,
  rejas: 20,
  cubCalamina: 0,
  cubTeja: 0,
  excavMasiva: 70,
  ilum: 460,
  toma: 520,
  tomaEsp: 40,
  tabGral: 1,
  tabDpto: 5,
  medidor: 6,
  pozo: 3,
  alimentador: 210,
  lum: 240,
  focos: 80,
  timbre: 6,
  tv: 10,
  tel: 40,
  data: 160,
  intercom: 6,
  porteria: 1,
  rack: 1,
  bombas: 3,
  extractores: 22,
  ciM: 110,
  gabCI: 10,
  ext: 22,
  bombaCI: 1,
  ascensor: 1,
  tanques: 2,
  cisterna: 1,
  placas: 36,
  losaMaciza: 28,
  cisternaEst: 32,
});

const CENTRO_COMERCIAL = edif({
  id: "centro-comercial",
  nombre: "Centro comercial / galería",
  obra: "Galería comercial — 24 locales, 2 pisos, 1 620 m²",
  cliente: "Promotor comercial",
  resumen: "Locales, pasillos, SS.HH. públicos y patio de comidas. Porcelanato, CI, portería, rack y bombas.",
  terreno: 980,
  techada: 1620,
  pisos: 2,
  sshh: 14,
  duchas: 2,
  inodoros: 20,
  lavatorios: 20,
  cocinas: 6,
  lavanderias: 1,
  termas: 4,
  drywallTab: 310,
  cieloYeso: 0,
  cieloDrywall: 1480,
  pisoCeramico: 120,
  pisoCer45: 80,
  pisoPorc: 640,
  pisoGranito: 180,
  pisoVinil: 0,
  pisoPulido: 40,
  mayolicaSSHH: 160,
  mayolicaCocina: 85,
  p90: 28,
  p80: 24,
  p70: 14,
  pMetal: 6,
  ventanas: 190,
  mamparas: 2,
  baranda: 110,
  rejas: 42,
  cubCalamina: 0,
  cubTeja: 0,
  excavMasiva: 110,
  ilum: 340,
  toma: 300,
  tomaEsp: 48,
  tabGral: 1,
  tabDpto: 8,
  medidor: 26,
  pozo: 3,
  alimentador: 160,
  lum: 180,
  focos: 90,
  timbre: 4,
  tv: 16,
  tel: 28,
  data: 48,
  intercom: 8,
  porteria: 1,
  rack: 1,
  bombas: 3,
  extractores: 20,
  ciM: 88,
  gabCI: 10,
  ext: 28,
  bombaCI: 1,
  ascensor: 1,
  tanques: 2,
  cisterna: 1,
  placas: 18,
  losaMaciza: 24,
  cisternaEst: 26,
  extras: [
    L("P-06.02.01", 220),
    L("P-06.01.01", 90),
    L("P-05.03.01", 180),
    L("ARQ-13.01.03", 50),
    L("ARQ-13.01.08", 30),
    L("ARQ-13.05.02", 22),
  ],
});

const MERCADO = edif({
  id: "mercado",
  nombre: "Mercado de abastos",
  obra: "Mercado de abastos — 1 piso, 1 200 m²",
  cliente: "Municipalidad distrital",
  resumen: "Puestos, pasillos, SS.HH., desagües y cobertura de calamina. Piso pulido, CI ligera y redes sanitarias densas.",
  terreno: 1600,
  techada: 1200,
  pisos: 1,
  sshh: 10,
  duchas: 2,
  inodoros: 16,
  lavatorios: 16,
  cocinas: 8,
  lavanderias: 2,
  termas: 2,
  drywallTab: 20,
  cieloYeso: 0,
  cieloDrywall: 0,
  pisoCeramico: 80,
  pisoCer45: 0,
  pisoPorc: 0,
  pisoGranito: 0,
  pisoVinil: 0,
  pisoPulido: 720,
  mayolicaSSHH: 95,
  mayolicaCocina: 40,
  p90: 8,
  p80: 12,
  p70: 10,
  pMetal: 6,
  ventanas: 85,
  mamparas: 0,
  baranda: 0,
  rejas: 55,
  cubCalamina: 0,
  cubTeja: 0,
  excavMasiva: 160,
  ilum: 160,
  toma: 140,
  tomaEsp: 24,
  tabGral: 1,
  tabDpto: 0,
  medidor: 1,
  pozo: 2,
  alimentador: 85,
  lum: 90,
  focos: 40,
  timbre: 2,
  tv: 4,
  tel: 4,
  data: 8,
  intercom: 0,
  porteria: 0,
  rack: 0,
  bombas: 2,
  extractores: 14,
  ciM: 42,
  gabCI: 6,
  ext: 16,
  bombaCI: 0,
  ascensor: 0,
  tanques: 2,
  cisterna: 1,
  placas: 0,
  losaMaciza: 8,
  cisternaEst: 18,
  extras: [
    L("P-06.02.01", 180),
    L("P-06.01.01", 120),
    L("P-05.03.01", 240),
    L("S-04.03.01", 12),
    L("ARQ-13.01.03", 800),
    L("ARQ-13.01.07", 280),
    L("ARQ-13.01.08", 100),
    L("ARQ-13.05.02", 48),
    L("ARQ-13.05.03", 32),
    L("ARQ-13.06.01", 42),
  ],
});

const LOCAL_COMUNAL = edif({
  id: "local-comunal",
  nombre: "Local comunal",
  obra: "Local comunal / salón de usos múltiples — 360 m²",
  cliente: "Municipalidad / comunidad",
  resumen: "Salón, escenario, SS.HH. y cocina de apoyo. Un piso, cobertura de teja y tablero general.",
  terreno: 520,
  techada: 360,
  pisos: 1,
  sshh: 4,
  duchas: 0,
  inodoros: 8,
  lavatorios: 8,
  cocinas: 1,
  lavanderias: 1,
  termas: 1,
  drywallTab: 24,
  cieloYeso: 280,
  cieloDrywall: 40,
  pisoCeramico: 80,
  pisoCer45: 0,
  pisoPorc: 40,
  pisoGranito: 0,
  pisoVinil: 0,
  pisoPulido: 120,
  mayolicaSSHH: 48,
  mayolicaCocina: 12,
  p90: 6,
  p80: 4,
  p70: 4,
  pMetal: 2,
  ventanas: 48,
  mamparas: 0,
  baranda: 0,
  rejas: 12,
  cubCalamina: 0,
  cubTeja: 360,
  excavMasiva: 18,
  ilum: 48,
  toma: 36,
  tomaEsp: 6,
  tabGral: 1,
  tabDpto: 0,
  medidor: 1,
  pozo: 1,
  alimentador: 32,
  lum: 28,
  focos: 16,
  timbre: 1,
  tv: 2,
  tel: 2,
  data: 4,
  intercom: 0,
  porteria: 0,
  rack: 0,
  bombas: 1,
  extractores: 4,
  ciM: 12,
  gabCI: 2,
  ext: 6,
  bombaCI: 0,
  ascensor: 0,
  tanques: 1,
  cisterna: 1,
  placas: 0,
  losaMaciza: 3,
  cisternaEst: 5,
});

const COMISARIA = edif({
  id: "comisaria",
  nombre: "Comisaría",
  obra: "Comisaría PNP — 2 pisos, 480 m²",
  cliente: "Ministerio del Interior",
  resumen: "Oficinas, calabozos, SS.HH., rejas y puertas metálicas. CI, intercomunicador y tablero de seguridad.",
  terreno: 360,
  techada: 480,
  pisos: 2,
  sshh: 8,
  duchas: 4,
  inodoros: 10,
  lavatorios: 10,
  cocinas: 1,
  lavanderias: 1,
  termas: 2,
  drywallTab: 40,
  cieloYeso: 220,
  cieloDrywall: 180,
  pisoCeramico: 90,
  pisoCer45: 0,
  pisoPorc: 60,
  pisoGranito: 20,
  pisoVinil: 40,
  pisoPulido: 80,
  mayolicaSSHH: 72,
  mayolicaCocina: 10,
  p90: 10,
  p80: 8,
  p70: 8,
  pMetal: 8,
  ventanas: 55,
  mamparas: 2,
  baranda: 28,
  rejas: 64,
  cubCalamina: 0,
  cubTeja: 0,
  excavMasiva: 22,
  ilum: 96,
  toma: 80,
  tomaEsp: 10,
  tabGral: 1,
  tabDpto: 1,
  medidor: 1,
  pozo: 2,
  alimentador: 48,
  lum: 42,
  focos: 28,
  timbre: 4,
  tv: 8,
  tel: 12,
  data: 24,
  intercom: 6,
  porteria: 1,
  rack: 1,
  bombas: 1,
  extractores: 8,
  ciM: 28,
  gabCI: 4,
  ext: 10,
  bombaCI: 0,
  ascensor: 0,
  tanques: 1,
  cisterna: 1,
  placas: 8,
  losaMaciza: 6,
  cisternaEst: 8,
  extras: [
    L("IE-04.12.02", 85), // canalización Ø40
    L("IE-04.11.02", 620), // LSOH 2.5 áreas públicas / calabozos
    L("IE-04.06.01", 48), // NYY 3×10 acometida tipada
    L("COM-04.01.01", 12), // CCTV interior
    L("COM-04.01.02", 6), // CCTV exterior
    L("IE-05.10.07", 16), // emergencia
  ],
});

const PISTA_FLEXIBLE: PlantillaPresupuesto = {
  id: "pista-flexible",
  categoria: "pavimentos",
  nombre: "Pista urbana asfáltica",
  obra: "Mejoramiento de pista urbana asfáltica — 400 m × 7.00 m",
  lugar: "Lima, Perú",
  cliente: "Municipalidad distrital",
  resumen: "TPU urbano: demolición, tierras, geotextil, subbase/base, imprimación MC-70, carpeta e=5 cm, veredas PMR, sumideros y señalización vial.",
  area: "2 800 m² de calzada · 960 m² de vereda · 400 m",
  lineas: [
    L("P-01.01.01", 1),
    L("P-01.01.02", 400),
    L("P-01.02.01", 3200),
    L("P-01.02.02", 240),
    L("P-01.02.03", 120),
    L("P-01.03.01", 1),
    L("P-01.04.01", 1),
    L("P-01.05.01", 8),
    L("P-02.01.01", 840),
    L("P-02.01.02", 180),
    L("P-02.02.01", 320),
    L("P-02.02.02", 160),
    L("P-02.03.01", 2800),
    L("P-02.03.02", 560),
    L("P-02.04.01", 520),
    L("P-02.05.01", 800),
    L("P-03.03.01", 1400),
    L("P-03.01.02", 2800),
    L("P-03.02.02", 2800),
    L("P-04.01.03", 2800),
    L("P-04.01.02", 2800),
    L("P-04.02.01", 2800),
    L("P-06.01.02", 800),
    L("P-06.09.01", 960),
    L("P-06.02.01", 960),
    L("P-06.06.01", 36),
    L("P-06.07.01", 28),
    L("P-06.08.01", 12),
    L("P-06.03.01", 400),
    L("P-06.05.01", 400),
    L("P-07.01.01", 1200),
    L("P-07.01.02", 48),
    L("P-07.01.03", 10),
    L("P-07.02.01", 80),
    L("P-07.03.01", 10),
    L("P-07.04.01", 16),
    L("P-07.05.01", 18),
  ],
};

const PISTA_RIGIDA: PlantillaPresupuesto = {
  id: "pista-rigida",
  categoria: "pavimentos",
  nombre: "Pavimento rígido",
  obra: "Pavimento de concreto f'c 280 e=20 cm — 220 m × 7.00 m",
  lugar: "Lima, Perú",
  cliente: "Municipalidad provincial",
  resumen: "TPU de losa: demolición, subrasante, subbase, losa e=20 cm, pasadores, juntas, curado, veredas PMR, sumideros y señalización.",
  area: "1 540 m² de losa · 528 m² de vereda · 220 m",
  lineas: [
    L("P-01.01.01", 1),
    L("P-01.01.02", 220),
    L("P-01.02.01", 1800),
    L("P-01.02.02", 160),
    L("P-01.02.03", 80),
    L("P-01.03.01", 1),
    L("P-01.04.01", 1),
    L("P-02.01.01", 460),
    L("P-02.02.01", 180),
    L("P-02.03.01", 1540),
    L("P-02.04.01", 280),
    L("P-03.01.01", 1540),
    L("P-03.03.01", 770),
    L("P-05.05.01", 440),
    L("P-05.01.01", 1540),
    L("P-05.04.01", 1540),
    L("P-05.02.01", 1540),
    L("P-05.06.01", 1540),
    L("P-06.01.03", 440),
    L("P-06.09.01", 528),
    L("P-06.02.01", 528),
    L("P-06.06.01", 24),
    L("P-06.07.01", 18),
    L("P-06.08.01", 8),
    L("P-06.03.01", 220),
    L("P-06.04.01", 12),
    L("P-07.01.01", 660),
    L("P-07.01.02", 28),
    L("P-07.01.03", 6),
    L("P-07.02.01", 44),
    L("P-07.03.01", 8),
    L("P-07.05.01", 12),
  ],
};

const VEREDAS: PlantillaPresupuesto = {
  id: "veredas-sardineles",
  categoria: "pavimentos",
  nombre: "Veredas y sardineles",
  obra: "Construcción de veredas y sardineles — 650 m de frente",
  lugar: "Lima, Perú",
  cliente: "Municipalidad distrital",
  resumen: "TPU peatonal: demolición, solado, sardinel A/B, vereda e=10 cm, rampas PMR, podotáctil, badenes, bolardos y cebra.",
  area: "650 m de frente · 1 300 m² de vereda",
  lineas: [
    L("P-01.01.01", 1),
    L("P-01.01.02", 650),
    L("P-01.02.01", 1400),
    L("P-01.02.02", 420),
    L("P-01.02.03", 280),
    L("P-01.03.01", 1),
    L("P-01.04.01", 1),
    L("P-01.05.01", 6),
    L("P-02.01.01", 180),
    L("P-02.03.01", 1300),
    L("P-02.04.01", 90),
    L("P-06.09.01", 1300),
    L("P-06.01.01", 420),
    L("P-06.01.02", 230),
    L("P-06.02.01", 1100),
    L("P-06.02.03", 200),
    L("P-06.06.01", 52),
    L("P-06.07.01", 40),
    L("P-06.04.01", 18),
    L("P-06.08.01", 8),
    L("P-07.01.01", 650),
    L("P-07.01.02", 36),
    L("P-07.03.01", 6),
    L("P-07.04.01", 24),
  ],
};

const RED_AGUA_DESAGUE: PlantillaPresupuesto = {
  id: "redes-agua-desague",
  categoria: "saneamiento",
  nombre: "Redes de agua y desagüe",
  obra: "Ampliación de redes de agua potable y alcantarillado — 8 cuadras",
  lugar: "Lima, Perú",
  cliente: "EPS / Municipalidad",
  resumen: "Zanjas, cama de arena, PVC SAP/UF, válvulas, buzones, conexiones domiciliarias, pruebas y reposición de pista.",
  area: "1 280 m de red · 64 lotes",
  lineas: [
    L("S-01.01.01", 1280),
    L("S-01.02.01", 1),
    L("S-02.01.02", 980),
    L("S-02.02.01", 165),
    L("S-02.03.01", 720),
    L("S-02.04.01", 260),
    L("S-03.01.03", 420),
    L("S-03.01.01", 860),
    L("S-03.02.01", 16),
    L("S-03.03.01", 860),
    L("S-03.04.01", 860),
    L("S-03.05.01", 64),
    L("S-03.07.01", 64),
    L("S-04.01.01", 980),
    L("S-04.01.02", 180),
    L("S-04.02.01", 18),
    L("S-04.02.02", 6),
    L("S-04.03.01", 64),
    L("S-04.04.01", 64),
    L("S-03.01.05", 180),
    L("S-03.02.02", 8),
    L("S-03.02.03", 6),
    L("S-04.01.03", 80),
    L("S-04.02.03", 2),
    L("S-04.05.01", 980),
    L("S-06.01.01", 220),
    L("S-06.02.01", 380),
    L("S-06.03.01", 160),
    L("S-06.05.01", 180),
  ],
};

const ALCANTARILLADO: PlantillaPresupuesto = {
  id: "alcantarillado",
  categoria: "saneamiento",
  nombre: "Alcantarillado con buzones",
  obra: "Colector de desagüe Ø200 mm — 620 m",
  lugar: "Lima, Perú",
  cliente: "EPS",
  resumen: "Excavación mecanizada, tubería UF Ø200, buzones tipo I y II, pruebas de hermeticidad y reposición.",
  area: "620 m de colector",
  lineas: [
    L("S-01.01.01", 620),
    L("S-02.01.02", 620),
    L("S-02.02.01", 95),
    L("S-02.03.01", 430),
    L("S-02.04.01", 190),
    L("S-04.01.02", 620),
    L("S-04.02.01", 12),
    L("S-04.02.02", 8),
    L("S-04.05.01", 620),
    L("S-06.02.01", 210),
    L("S-06.03.01", 80),
  ],
};

const AGUA_POTABLE: PlantillaPresupuesto = {
  id: "agua-potable",
  categoria: "saneamiento",
  nombre: "Red de agua potable",
  obra: "Línea de agua PVC SAP Ø110 / Ø160 — 740 m",
  lugar: "Lima, Perú",
  cliente: "EPS",
  resumen: "Tubería SAP, válvulas, hidrante, desinfección, medidores y conexiones domiciliarias.",
  area: "740 m de red · 48 conexiones",
  lineas: [
    L("S-01.01.01", 740),
    L("S-02.01.02", 480),
    L("S-02.02.01", 82),
    L("S-02.03.01", 360),
    L("S-02.04.01", 120),
    L("S-03.01.01", 520),
    L("S-03.01.02", 220),
    L("S-03.02.01", 10),
    L("S-03.03.01", 740),
    L("S-03.04.01", 740),
    L("S-03.05.01", 48),
    L("S-03.06.01", 4),
    L("S-03.06.02", 2),
    L("S-03.07.01", 48),
    L("S-03.07.02", 48),
    L("S-06.01.01", 96),
    L("S-06.02.01", 180),
    L("S-06.05.01", 120),
  ],
};

const CARRETERA_VECINAL: PlantillaPresupuesto = {
  id: "carretera-vecinal",
  categoria: "carreteras",
  nombre: "Camino vecinal afirmado",
  obra: "Mejoramiento de camino vecinal — 5.00 km × 6.00 m",
  lugar: "Sierra / Costa, Perú",
  cliente: "Gobierno regional / municipalidad",
  resumen: "Faja, corte, terraplén, afirmado e=20 cm, cunetas, alcantarillas Ø600/900, badenes, señales y motonivelado.",
  area: "5.00 km · 30 000 m² de calzada",
  lineas: [
    L("CAR-01.01.01", 1),
    L("CAR-01.01.02", 1),
    L("CAR-01.02.01", 5),
    L("CAR-01.03.01", 50000),
    L("CAR-01.04.01", 2),
    L("CAR-01.05.01", 1),
    L("CAR-02.01.01", 12500),
    L("CAR-02.01.02", 2800),
    L("CAR-02.02.01", 8200),
    L("CAR-02.03.01", 32500),
    L("CAR-02.04.01", 6800),
    L("CAR-02.06.01", 1),
    L("CAR-03.01.02", 30000),
    L("CAR-03.08.01", 5000),
    L("CAR-04.01.01", 4200),
    L("CAR-04.02.01", 80),
    L("CAR-04.03.01", 48),
    L("CAR-04.03.02", 24),
    L("CAR-04.05.01", 16),
    L("CAR-04.06.01", 120),
    L("CAR-05.03.01", 28),
    L("CAR-05.03.02", 12),
    L("CAR-05.04.01", 10),
    L("CAR-06.02.01", 30000),
  ],
};

const CARRETERA_ASFALTADA: PlantillaPresupuesto = {
  id: "carretera-asfaltada",
  categoria: "carreteras",
  nombre: "Carretera asfaltada EG-2013",
  obra: "Rehabilitación de carretera — 3.20 km × 6.60 m",
  lugar: "Costa, Perú",
  cliente: "Provías / Gobierno regional",
  resumen: "Subbase, base, imprimación, carpeta e=5 cm, berma, cunetas, alcantarillas, defensa metálica y pintura vial.",
  area: "3.20 km · 21 120 m² de carpeta",
  lineas: [
    L("CAR-01.01.01", 1),
    L("CAR-01.02.01", 3.2),
    L("CAR-01.03.01", 28800),
    L("CAR-01.04.01", 2),
    L("CAR-01.05.01", 1),
    L("CAR-01.06.01", 4200),
    L("CAR-02.01.01", 6400),
    L("CAR-02.02.01", 3800),
    L("CAR-02.03.01", 22400),
    L("CAR-02.04.01", 2900),
    L("CAR-02.06.01", 1),
    L("CAR-03.02.01", 21120),
    L("CAR-03.03.02", 21120),
    L("CAR-03.04.01", 21120),
    L("CAR-03.04.02", 21120),
    L("CAR-03.05.01", 21120),
    L("CAR-03.08.01", 3840),
    L("CAR-04.01.01", 2800),
    L("CAR-04.03.02", 36),
    L("CAR-04.03.03", 12),
    L("CAR-04.04.01", 8),
    L("CAR-04.05.01", 18),
    L("CAR-05.01.01", 3200),
    L("CAR-05.01.02", 6400),
    L("CAR-05.02.01", 160),
    L("CAR-05.03.01", 22),
    L("CAR-05.05.01", 180),
  ],
};

const CANAL_RIEGO: PlantillaPresupuesto = {
  id: "canal-riego",
  categoria: "hidraulica",
  nombre: "Canal de riego revestido",
  obra: "Canal de riego f'c 175 e=7.5 cm — 2.00 km",
  lugar: "Costa, Perú",
  cliente: "Comisión de usuarios / gobierno regional",
  resumen: "TPU de canal: campamento, excavación, solado, revestimiento, juntas, obras de arte, entubado HDPE, gaviones y revegetación.",
  area: "2.00 km · sección 1.20 × 0.80 m",
  lineas: [
    L("HID-01.04.01", 1),
    L("HID-01.05.01", 1),
    L("HID-01.06.01", 1),
    L("HID-01.01.01", 2000),
    L("HID-01.02.01", 12000),
    L("HID-01.03.01", 1),
    L("HID-02.01.01", 2800),
    L("HID-02.01.02", 420),
    L("HID-02.01.03", 120),
    L("HID-02.02.01", 4800),
    L("HID-02.03.01", 680),
    L("HID-02.04.01", 1100),
    L("HID-02.05.01", 18),
    L("HID-02.06.01", 240),
    L("HID-03.01.01", 2400),
    L("HID-03.02.01", 4800),
    L("HID-03.02.02", 800),
    L("HID-03.05.01", 200),
    L("HID-03.07.01", 5600),
    L("HID-03.09.01", 24),
    L("HID-03.08.01", 180),
    L("HID-04.03.02", 6),
    L("HID-04.03.01", 4),
    L("HID-04.06.01", 18),
    L("HID-04.07.01", 8),
    L("HID-04.09.01", 6),
    L("HID-04.10.01", 3),
    L("HID-04.11.01", 12),
    L("HID-05.01.01", 1800),
    L("HID-05.03.01", 240),
    L("HID-05.05.01", 160),
    L("HID-05.06.01", 28),
    L("HID-05.08.01", 900),
    L("HID-05.09.01", 45),
  ],
};

const BOCATOMA: PlantillaPresupuesto = {
  id: "bocatoma-desarenador",
  categoria: "hidraulica",
  nombre: "Bocatoma y desarenador",
  obra: "Obra de toma con desarenador, compuertas y sifón",
  lugar: "Sierra, Perú",
  cliente: "Proyecto de irrigación",
  resumen: "TPU de toma: ataguía, agotamiento, bocatoma, desarenador, compuertas, sifón, aliviadero, enrocado, gaviones y geomembrana.",
  area: "Obra de arte · Q ≈ 0.8 m³/s",
  lineas: [
    L("HID-01.04.01", 1),
    L("HID-01.05.01", 1),
    L("HID-01.06.01", 1),
    L("HID-01.01.01", 180),
    L("HID-01.02.01", 2400),
    L("HID-01.03.01", 1),
    L("HID-02.01.02", 420),
    L("HID-02.01.03", 85),
    L("HID-02.04.01", 180),
    L("HID-02.05.01", 24),
    L("HID-04.01.01", 85),
    L("HID-04.02.01", 42),
    L("HID-04.03.01", 3),
    L("HID-04.03.02", 2),
    L("HID-04.04.01", 28),
    L("HID-04.08.01", 12),
    L("HID-04.09.01", 2),
    L("HID-04.10.01", 1),
    L("HID-04.12.01", 2),
    L("HID-04.13.01", 18),
    L("HID-03.04.01", 180),
    L("HID-03.06.01", 180),
    L("HID-03.09.01", 16),
    L("HID-05.02.01", 65),
    L("HID-05.03.01", 80),
    L("HID-05.04.01", 120),
    L("HID-05.06.01", 18),
    L("HID-05.07.01", 22),
    L("HID-05.09.01", 28),
    L("HID-06.01.01", 80),
    L("HID-06.02.01", 2),
  ],
};

const DEFENSA_RIBERENA: PlantillaPresupuesto = {
  id: "defensa-riberena",
  categoria: "hidraulica",
  nombre: "Defensa ribereña",
  obra: "Protección de cauce con gaviones y enrocado — 420 m",
  lugar: "Sierra / selva, Perú",
  cliente: "Gobierno regional / ANA",
  resumen: "TPU de defensa: ataguía, excavación, gavión caja, colchón, rip-rap, muro, geocelda, dren de pie y revegetación.",
  area: "420 m de margen · 2 100 m² de protección",
  lineas: [
    L("HID-01.04.01", 1),
    L("HID-01.05.01", 1),
    L("HID-01.06.01", 1),
    L("HID-01.01.01", 420),
    L("HID-01.02.01", 6300),
    L("HID-01.03.01", 1),
    L("HID-02.01.01", 980),
    L("HID-02.01.02", 220),
    L("HID-02.03.01", 360),
    L("HID-02.04.01", 410),
    L("HID-02.05.01", 12),
    L("HID-05.01.01", 380),
    L("HID-05.06.01", 85),
    L("HID-05.03.01", 840),
    L("HID-05.02.01", 180),
    L("HID-05.09.01", 95),
    L("HID-05.07.01", 48),
    L("HID-05.04.01", 620),
    L("HID-05.05.01", 320),
    L("HID-05.08.01", 1680),
    L("HID-03.04.01", 240),
    L("HID-03.06.01", 240),
  ],
};

const HABILITACION_URBANA: PlantillaPresupuesto = {
  id: "habilitacion-urbana",
  categoria: "habilitaciones",
  nombre: "Habilitación urbana 2 ha",
  obra: "Habilitación urbana — 2.00 ha · 40 lotes",
  lugar: "Lima, Perú",
  cliente: "Promotor inmobiliario / municipalidad",
  resumen: "TPU de habilitación: lotización, pistas, veredas PMR, drenaje pluvial, redes de agua/desagüe, parque, alumbrado y señalización.",
  area: "20 000 m² · 40 lotes · 480 m de vías",
  lineas: [
    L("HAB-01.01.01", 20000),
    L("HAB-01.02.01", 48),
    L("HAB-01.03.01", 20000),
    L("HAB-01.04.01", 4200),
    L("HAB-01.05.01", 1),
    L("HAB-01.06.01", 620),
    L("HAB-01.07.01", 180),
    L("HAB-01.08.01", 860),
    L("HAB-01.09.01", 1),
    L("HAB-02.01.01", 3360),
    L("HAB-02.10.01", 1680),
    L("HAB-02.02.01", 3360),
    L("HAB-02.03.01", 3360),
    L("HAB-02.04.01", 3360),
    L("HAB-02.09.01", 3360),
    L("HAB-02.05.01", 2800),
    L("HAB-02.05.02", 560),
    L("HAB-02.11.01", 920),
    L("HAB-03.07.01", 1440),
    L("HAB-03.01.01", 1440),
    L("HAB-03.08.01", 480),
    L("HAB-03.02.01", 720),
    L("HAB-03.02.03", 240),
    L("HAB-03.03.01", 48),
    L("HAB-03.04.01", 36),
    L("HAB-03.05.01", 120),
    L("HAB-04.01.01", 16),
    L("HAB-04.05.01", 16),
    L("HAB-04.02.01", 200),
    L("HAB-04.02.02", 80),
    L("HAB-04.04.01", 8),
    L("HAB-04.06.01", 180),
    L("HAB-05.01.01", 1800),
    L("HAB-05.02.01", 1600),
    L("HAB-05.03.01", 40),
    L("HAB-05.03.02", 80),
    L("HAB-05.04.01", 180),
    L("HAB-05.10.01", 220),
    L("HAB-05.05.01", 1),
    L("HAB-05.06.01", 8),
    L("HAB-05.07.01", 6),
    L("HAB-05.08.01", 85),
    L("HAB-05.09.01", 220),
    L("HAB-06.01.01", 16),
    L("HAB-06.02.01", 16),
    L("HAB-06.01.02", 8),
    L("HAB-06.02.02", 8),
    L("HAB-06.03.01", 480),
    L("HAB-06.04.01", 8),
    L("HAB-06.05.01", 1),
    L("HAB-06.06.01", 6),
    L("HAB-07.01.01", 960),
    L("HAB-07.01.02", 64),
    L("HAB-07.02.01", 48),
    L("HAB-07.03.01", 12),
    L("HAB-07.04.01", 16),
    L("HAB-07.06.01", 12),
    L("HAB-07.07.01", 8),
    L("S-01.01.01", 960),
    L("S-02.01.02", 720),
    L("S-02.02.01", 120),
    L("S-02.03.01", 540),
    L("S-03.01.01", 480),
    L("S-03.05.01", 40),
    L("S-04.01.01", 480),
    L("S-04.02.01", 10),
    L("S-04.04.01", 40),
  ],
};

const PISTAS_VEREDAS: PlantillaPresupuesto = {
  id: "pistas-y-veredas",
  categoria: "habilitaciones",
  nombre: "Pistas y veredas 800 m",
  obra: "Construcción de pistas y veredas — 800 m × 7.00 m",
  lugar: "Lima, Perú",
  cliente: "Municipalidad distrital",
  resumen: "TPU municipal: demolición, subbase/base, carpeta e=5 cm, veredas PMR, sardinel, drenaje pluvial, alumbrado y señalización.",
  area: "5 600 m² de pista · 2 400 m² de vereda",
  lineas: [
    L("HAB-01.01.01", 8000),
    L("HAB-01.03.01", 8000),
    L("HAB-01.05.01", 1),
    L("HAB-01.06.01", 400),
    L("HAB-01.07.01", 520),
    L("HAB-01.08.01", 640),
    L("HAB-01.09.01", 1),
    L("HAB-02.01.01", 5600),
    L("HAB-02.10.01", 2800),
    L("HAB-02.02.01", 5600),
    L("HAB-02.03.02", 5600),
    L("HAB-02.04.01", 5600),
    L("HAB-02.09.01", 5600),
    L("HAB-02.05.01", 5600),
    L("HAB-02.11.01", 480),
    L("HAB-03.07.01", 2400),
    L("HAB-03.01.01", 2160),
    L("HAB-03.09.01", 240),
    L("HAB-03.08.01", 800),
    L("HAB-03.02.01", 1200),
    L("HAB-03.02.03", 400),
    L("HAB-03.03.01", 64),
    L("HAB-03.04.01", 48),
    L("HAB-04.01.01", 20),
    L("HAB-04.05.01", 20),
    L("HAB-04.02.01", 180),
    L("HAB-04.04.01", 6),
    L("HAB-04.03.01", 400),
    L("HAB-04.06.01", 400),
    L("HAB-06.01.01", 20),
    L("HAB-06.02.01", 20),
    L("HAB-06.03.01", 800),
    L("HAB-06.04.01", 8),
    L("HAB-06.05.01", 1),
    L("HAB-06.06.01", 8),
    L("HAB-07.01.01", 2400),
    L("HAB-07.01.02", 80),
    L("HAB-07.02.01", 80),
    L("HAB-07.03.01", 10),
    L("HAB-07.04.01", 20),
    L("HAB-07.06.01", 16),
    L("HAB-07.07.01", 8),
  ],
};

const PARQUE_URBANO: PlantillaPresupuesto = {
  id: "parque-urbano",
  categoria: "habilitaciones",
  nombre: "Parque urbano y plaza",
  obra: "Mejoramiento de parque vecinal — 3 200 m²",
  lugar: "Lima, Perú",
  cliente: "Municipalidad distrital",
  resumen: "TPU de área verde: veredas, loseta, césped, árboles, riego, juegos, mobiliario, cerco, alumbrado peatonal y accesibilidad PMR.",
  area: "3 200 m² de parque · 420 m² de plaza",
  lineas: [
    L("HAB-01.01.01", 3200),
    L("HAB-01.03.01", 3200),
    L("HAB-01.05.01", 1),
    L("HAB-01.07.01", 180),
    L("HAB-03.07.01", 480),
    L("HAB-03.01.01", 380),
    L("HAB-03.06.01", 160),
    L("HAB-03.03.01", 28),
    L("HAB-03.04.01", 22),
    L("HAB-05.09.01", 420),
    L("HAB-05.01.01", 2200),
    L("HAB-05.02.01", 2000),
    L("HAB-05.03.01", 36),
    L("HAB-05.03.02", 90),
    L("HAB-05.04.01", 180),
    L("HAB-05.10.01", 260),
    L("HAB-05.05.01", 1),
    L("HAB-05.06.01", 12),
    L("HAB-05.07.01", 8),
    L("HAB-05.08.01", 140),
    L("HAB-04.01.01", 4),
    L("HAB-06.01.02", 10),
    L("HAB-06.02.02", 10),
    L("HAB-06.03.01", 220),
    L("HAB-06.04.01", 4),
    L("HAB-07.01.02", 18),
    L("HAB-07.04.01", 8),
  ],
};

const PLANTILLAS_SEMILLA: PlantillaPresupuesto[] = [
  UNIFAMILIAR,
  MULTIFAMILIAR,
  HOTEL,
  RESTAURANTE,
  ...PLANTILLAS_HOSPITALES,
  COLEGIO,
  OFICINAS,
  CENTRO_COMERCIAL,
  MERCADO,
  LOCAL_COMUNAL,
  COMISARIA,
  PISTA_FLEXIBLE,
  PISTA_RIGIDA,
  VEREDAS,
  RED_AGUA_DESAGUE,
  ALCANTARILLADO,
  AGUA_POTABLE,
  CARRETERA_VECINAL,
  CARRETERA_ASFALTADA,
  CANAL_RIEGO,
  BOCATOMA,
  DEFENSA_RIBERENA,
  HABILITACION_URBANA,
  PISTAS_VEREDAS,
  PARQUE_URBANO,
  ...PLANTILLAS_AMPLIADAS,
  ...PLANTILLAS_PUENTES,
  ...PLANTILLAS_DEPORTIVAS,
];

export function plantillasAgrupadas() {
  const cats = (Object.keys(CATEGORIA_PLANTILLA_META) as CategoriaPlantilla[]).sort(
    (a, b) => CATEGORIA_PLANTILLA_META[a].orden - CATEGORIA_PLANTILLA_META[b].orden
  );
  return cats.map((categoria) => ({
    categoria,
    meta: CATEGORIA_PLANTILLA_META[categoria],
    items: PLANTILLAS.filter((p) => p.categoria === categoria),
  }));
}

export const ESPECIALIDADES_POR_TIPO: Record<CategoriaPlantilla, EspecialidadPre[]> = {
  edificaciones: ["arquitectura", "estructuras", "sanitarias", "electricas", "comunicaciones", "mecanicas"],
  salud: ["arquitectura", "estructuras", "sanitarias", "electricas", "comunicaciones", "mecanicas", "equipamiento", "electromecanicas"],
  carreteras: ["carreteras", "pavimentos", "hidraulica", "estructuras"],
  puentes: ["puentes", "estructuras", "hidraulica"],
  saneamiento: ["saneamiento", "estructuras", "mecanicas"],
  hidraulica: ["hidraulica", "estructuras"],
  habilitaciones: ["habilitaciones", "saneamiento"],
  pavimentos: ["pavimentos"],
  deportivas: ["pavimentos", "arquitectura", "estructuras", "sanitarias", "electricas"],
};

const FOCO_SOLO_PROPIO = new Set([
  "limpieza-de-terreno",
  "movimiento-de-tierras",
  "parques-jardines-y-areas-verdes",
]);

const IEM_EN_EDIFICIO = new Set([
  "hotel",
  "multifamiliar",
  "centro-comercial",
  "comisaria",
  "colegio",
  "oficinas",
  "mercado",
]);

const SEMILLA_ESP: Partial<Record<EspecialidadPre, { codigo: string; metrado: number }[]>> = {
  electromecanicas: [
    { codigo: "IEM-00.01.01", metrado: 80 },
    { codigo: "IEM-03.01.01", metrado: 1 },
    { codigo: "IEM-04.01.09", metrado: 1 },
  ],
  pavimentos: [
    { codigo: "P-01.01.01", metrado: 1 },
    { codigo: "P-03.01.02", metrado: 400 },
    { codigo: "P-04.02.01", metrado: 400 },
  ],
  hidraulica: [
    { codigo: "HID-01.01.01", metrado: 80 },
    { codigo: "HID-04.05.01", metrado: 2 },
  ],
  estructuras: [
    { codigo: "EST-03.01.01", metrado: 40 },
    { codigo: "EST-03.03.01", metrado: 12 },
  ],
  mecanicas: [
    { codigo: "IM-00.01.01", metrado: 1 },
    { codigo: "IM-01.01.01", metrado: 1 },
  ],
  sanitarias: [
    { codigo: "IS-00.01.01", metrado: 1 },
    { codigo: "IS-01.01.01", metrado: 6 },
    { codigo: "IS-01.02.01", metrado: 6 },
    { codigo: "IS-02.01.01", metrado: 2 },
    { codigo: "IS-03.01.01", metrado: 18 },
    { codigo: "IS-03.02.01", metrado: 16 },
    { codigo: "IS-03.05.01", metrado: 8 },
  ],
  electricas: [
    { codigo: "IE-00.01.01", metrado: 1 },
    { codigo: "IE-01.01.01", metrado: 8 },
    { codigo: "IE-03.01.01", metrado: 1 },
    { codigo: "IE-05.01.01", metrado: 8 },
  ],
  arquitectura: [{ codigo: "ARQ-01.05.01", metrado: 1 }],
  comunicaciones: [{ codigo: "COM-01.01.01", metrado: 4 }],
  saneamiento: [
    { codigo: "S-01.01.01", metrado: 80 },
    { codigo: "S-03.01.01", metrado: 60 },
    { codigo: "S-04.01.01", metrado: 60 },
  ],
  equipamiento: [],
};

/** Bloques RN que una plantilla completa de edificación / salud / deportiva debe traer. */
const BLOQUES_RN: { especialidad: EspecialidadPre; capitulo: string; codigo: string; metrado: number }[] = [
  { especialidad: "sanitarias", capitulo: RN.s421, codigo: "IS-01.01.01", metrado: 6 },
  { especialidad: "sanitarias", capitulo: RN.s422, codigo: "IS-03.01.01", metrado: 18 },
  { especialidad: "sanitarias", capitulo: RN.s423, codigo: "IS-03.05.01", metrado: 8 },
  { especialidad: "sanitarias", capitulo: RN.s461, codigo: "IS-01.02.01", metrado: 6 },
  { especialidad: "sanitarias", capitulo: RN.s413, codigo: "IS-02.01.01", metrado: 2 },
  { especialidad: "electricas", capitulo: RN.e521, codigo: "IE-01.01.01", metrado: 8 },
  { especialidad: "electricas", capitulo: RN.e54, codigo: "IE-03.01.01", metrado: 1 },
  { especialidad: "electricas", capitulo: RN.e551, codigo: "IE-05.01.01", metrado: 8 },
];

export function especialidadesRequeridas(pl: PlantillaPresupuesto): EspecialidadPre[] {
  if (pl.id.endsWith("-obra-civil") || pl.id.endsWith("-equipamiento")) return especialidadesPlantilla(pl);
  if (FOCO_SOLO_PROPIO.has(pl.id)) return especialidadesPlantilla(pl);
  const base = [...(ESPECIALIDADES_POR_TIPO[pl.categoria] ?? [])];
  if (pl.categoria === "edificaciones" && IEM_EN_EDIFICIO.has(pl.id)) base.push("electromecanicas");
  if (pl.categoria === "salud" && !pl.id.includes("-obra") && !pl.id.includes("-equip")) {
    /* plantilla MINSA completa */
  }
  return base;
}

function completarPlantilla(pl: PlantillaPresupuesto): PlantillaPresupuesto {
  const tiene = new Set(especialidadesPlantilla(pl));
  const extras: { codigo: string; metrado: number }[] = [];
  const used = new Set(pl.lineas.map((l) => l.codigo));
  for (const esp of especialidadesRequeridas(pl)) {
    if (tiene.has(esp)) continue;
    for (const sem of SEMILLA_ESP[esp] ?? []) {
      if (used.has(sem.codigo)) continue;
      extras.push(sem);
      used.add(sem.codigo);
    }
  }
  const esObraCompleta =
    (pl.categoria === "edificaciones" || pl.categoria === "salud" || pl.categoria === "deportivas") &&
    !FOCO_SOLO_PROPIO.has(pl.id) &&
    !pl.id.endsWith("-obra-civil") &&
    !pl.id.endsWith("-equipamiento");
  if (esObraCompleta) {
    const caps = new Set(
      [...pl.lineas, ...extras]
        .map((l) => PARTIDA_BY_CODIGO[l.codigo]?.capitulo)
        .filter((c): c is string => Boolean(c)),
    );
    const req = new Set(especialidadesRequeridas(pl));
    for (const bloque of BLOQUES_RN) {
      if (!req.has(bloque.especialidad)) continue;
      if (caps.has(bloque.capitulo)) continue;
      if (used.has(bloque.codigo)) continue;
      extras.push({ codigo: bloque.codigo, metrado: bloque.metrado });
      used.add(bloque.codigo);
      caps.add(bloque.capitulo);
    }
  }
  if (!extras.length) return pl;
  const lineas = [...pl.lineas, ...extras];
  return { ...pl, lineas, area: `${pl.area} · ${lineas.length} partidas` };
}

export const PLANTILLAS: PlantillaPresupuesto[] = PLANTILLAS_SEMILLA.map(completarPlantilla);

export function especialidadesDeTipo(tipo: CategoriaPlantilla): EspecialidadPre[] {
  return ESPECIALIDADES_POR_TIPO[tipo] ?? ESPECIALIDADES;
}

export function especialidadesPlantilla(pl: PlantillaPresupuesto): EspecialidadPre[] {
  const seen = new Set<EspecialidadPre>();
  for (const l of pl.lineas) {
    if (l.codigo.startsWith("ARQ-")) seen.add("arquitectura");
    else if (l.codigo.startsWith("EST-")) seen.add("estructuras");
    else if (l.codigo.startsWith("IS-")) seen.add("sanitarias");
    else if (l.codigo.startsWith("IE-")) seen.add("electricas");
    else if (l.codigo.startsWith("COM-")) seen.add("comunicaciones");
    else if (l.codigo.startsWith("IEM-")) seen.add("electromecanicas");
    else if (esCodigoEquipamiento(l.codigo) || l.codigo.startsWith("EQ-")) seen.add("equipamiento");
    else if (l.codigo.startsWith("IM-")) seen.add("mecanicas");
    else if (l.codigo.startsWith("P-")) seen.add("pavimentos");
    else if (l.codigo.startsWith("S-")) seen.add("saneamiento");
    else if (l.codigo.startsWith("CAR-")) seen.add("carreteras");
    else if (l.codigo.startsWith("PTE-")) seen.add("puentes");
    else if (l.codigo.startsWith("HID-")) seen.add("hidraulica");
    else if (l.codigo.startsWith("HAB-")) seen.add("habilitaciones");
  }
  return ESPECIALIDADES.filter((e) => seen.has(e));
}

export function plantillaPorId(id: string) {
  if (id === "hospital") return PLANTILLAS.find((p) => p.id === "minsa-i-4");
  return PLANTILLAS.find((p) => p.id === id);
}

export function aplicarPlantilla(id: string, params?: Partial<PresupuestoState>): PresupuestoState | null {
  const pl = plantillaPorId(id);
  if (!pl) return null;
  const lineas: LineaPresupuesto[] = pl.lineas.map((l) => ({
    id: uid(),
    codigo: codigoPartidaEquipamiento(l.codigo),
    metrado: l.metrado,
  }));
  const next: PresupuestoState = {
    ...defaultPresupuesto(),
    ...params,
    obra: params?.obra?.trim() ? params.obra : pl.obra,
    lugar: params?.lugar?.trim() ? params.lugar : pl.lugar,
    cliente: params?.cliente?.trim() ? params.cliente : pl.cliente,
    gg: params?.gg ?? pl.gg ?? 10,
    utilidad: params?.utilidad ?? pl.utilidad ?? 8,
    lineas,
    plantillaId: pl.id,
  };
  return { ...next, cronograma: cronogramaDesdePresupuesto(next) };
}

export function libroDePlantilla(pl: PlantillaPresupuesto): MetradoLibro {
  if (pl.spec) {
    return libroDesdeSpec({
      titulo: pl.nombre,
      resumen: pl.resumen,
      categoria: pl.categoria,
      spec: pl.spec,
      categoriaMinsa: pl.categoriaMinsa,
    });
  }
  return libroDesdeLineas({
    titulo: pl.nombre,
    resumen: pl.resumen,
    categoria: pl.categoria,
    lineas: pl.lineas,
    categoriaMinsa: pl.categoriaMinsa,
  });
}

/** Elige la plantilla de expediente a partir de la obra, los archivos y el tipo de proyecto. */
export function identificarPlantilla(opts: {
  obra?: string;
  archivos?: string[];
  tipo?: CategoriaPlantilla | "";
  lecturaTexto?: string;
}): string {
  const t = `${opts.obra || ""} ${(opts.archivos || []).join(" ")} ${opts.lecturaTexto || ""}`.toLowerCase();
  const minsa = detectarCategoriaMinsa(opts.obra || "", ...(opts.archivos || []), opts.lecturaTexto || "");
  if (minsa && (!opts.tipo || opts.tipo === "salud")) return plantillaIdDeCategoria(minsa);
  let id = "unifamiliar";
  if (/bailey|beiley|beily/.test(t)) {
    if (/\bts\b|triple.?single/.test(t)) id = "puente-bailey-ts-36m";
    else if (/\bdd\b|double.?double/.test(t)) id = "puente-bailey-dd-30m";
    else if (/\bds\b|double.?single/.test(t)) id = "puente-bailey-ds-21m";
    else id = "puente-bailey-ss-12m";
  } else if (/cantilever|voladizo/.test(t)) id = "puente-cantilever-80m";
  else if (/atirantad|stay.?cable/.test(t)) id = "puente-atirantado-120m";
  else if (/colgante|suspend/.test(t)) id = "puente-colgante-180m";
  else if (/peatonal|pasarela/.test(t)) id = "puente-peatonal-acero-24m";
  else if (/pont[oó]n|flotante/.test(t)) id = "ponton-flotante-20m";
  else if (/marco integral|caj[oó]n empotrado/.test(t)) id = "puente-marco-integral-10m";
  else if (/madera/.test(t) && /puente/.test(t)) id = "puente-madera-rural-12m";
  else if (/arco/.test(t) && /acero|met[aá]lic/.test(t)) id = "puente-arco-acero-55m";
  else if (/arco/.test(t) && /puente/.test(t)) id = "puente-arco-concreto-50m";
  else if (/celos[ií]a|warren|pratt/.test(t)) id = "puente-acero-celosia-45m";
  else if (/mixto|alma llena|placa|plate girder/.test(t) && /puente/.test(t)) {
    id = /mixto/.test(t) ? "puente-mixto-35m" : "puente-acero-alma-llena-30m";
  } else if (/caj[oó]n/.test(t) && /puente/.test(t)) id = "puente-cajon-40m";
  else if (/aashto|pretens/.test(t) && /puente/.test(t)) id = "puente-pretensadas-aashto-32m";
  else if (/postens/.test(t) && /puente/.test(t)) id = "puente-vigas-postensadas-25m";
  else if (/puente/.test(t)) id = "puente-losa-apoyada-12m";
  else if (/carretera|vecinal|asfalt/.test(t)) id = "carretera-vecinal";
  else if (/pista|vereda|paviment/.test(t)) id = "pistas-y-veredas";
  else if (/habilitaci|lotizaci|urbaniz/.test(t)) id = "habilitacion-urbana";
  else if (/canal|bocatoma|riego|ribere/.test(t)) id = "canal-riego";
  else if (/agua|desag|saneam|is-0/.test(t)) id = "redes-agua-desague";
  else if (/colegio|escolar|ii\.?ee|aula/.test(t) && !/electric/.test(t)) id = "colegio";
  else if (/hospital|posta|essalud|minsa|salud/.test(t)) id = "minsa-i-4";
  else if (/hotel|hospedaje/.test(t)) id = "hotel";
  else if (/oficina|institucional|publico/.test(t)) id = PLANTILLAS.find((p) => /oficina/.test(p.id) || /oficina/.test(p.nombre.toLowerCase()))?.id || "multifamiliar";
  else if (/comercio|tienda|galeria/.test(t)) id = PLANTILLAS.find((p) => /comercio/.test(p.id) || /comer/.test(p.nombre.toLowerCase()))?.id || "multifamiliar";
  else if (/multi|edificio|residencial|conjunto|torre/.test(t)) id = "multifamiliar";
  else if (/losa|deportiv|grass|cancha/.test(t)) id = PLANTILLAS.find((p) => p.categoria === "deportivas")?.id || "unifamiliar";
  else id = "unifamiliar";

  if (opts.tipo) {
    const pl = plantillaPorId(id);
    if (!pl || pl.categoria !== opts.tipo) {
      const first = PLANTILLAS.find((p) => p.categoria === opts.tipo);
      if (first) return first.id;
    }
  }
  return plantillaPorId(id) ? id : "unifamiliar";
}
