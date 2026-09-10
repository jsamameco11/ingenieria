import type { Partida } from "./types";
import { SUBTITULOS_POR_PREFIJO } from "./subtitulosCatalogo";

/** Títulos oficiales del Reglamento Nacional de Metrados (obras de edificación). */
export const RN = {
  arq01: "01 Trabajos preliminares",
  arq02: "02 Movimiento de tierras",
  e2exc: "02 Movimiento de tierras · Excavaciones",
  e2rel: "02 Movimiento de tierras · Rellenos",
  e2eli: "02 Movimiento de tierras · Eliminación de material",
  e2niv: "02 Movimiento de tierras · Nivelación y afirmado",
  e2tal: "02 Movimiento de tierras · Taludes",
  e2ctl: "02 Movimiento de tierras · Control y ensayos",
  e2ago: "02 Movimiento de tierras · Agotamiento",
  est02: "02 Movimiento de tierras",
  est03: "03 Obras de concreto simple",
  est04: "04 Obras de concreto armado",
  e3sol: "03 Obras de concreto simple · Solados y falso piso",
  e3cim: "03 Obras de concreto simple · Cimiento corrido",
  e3sob: "03 Obras de concreto simple · Sobrecimiento",
  e3cic: "03 Obras de concreto simple · Concreto ciclópeo",
  e3cur: "03 Obras de concreto simple · Curado",
  e4zap: "04 Obras de concreto armado · Zapatas",
  e4dad: "04 Obras de concreto armado · Dados de zapata",
  e4pla: "04 Obras de concreto armado · Platea de cimentación",
  e4vco: "04 Obras de concreto armado · Vigas de conexión",
  e4vci: "04 Obras de concreto armado · Vigas de cimentación",
  e4soa: "04 Obras de concreto armado · Sobrecimiento armado",
  e4col: "04 Obras de concreto armado · Columnas",
  e4vig: "04 Obras de concreto armado · Vigas",
  e4ali: "04 Obras de concreto armado · Losa aligerada",
  e4mac: "04 Obras de concreto armado · Losa maciza",
  e4plq: "04 Obras de concreto armado · Placas y muros",
  e4esc: "04 Obras de concreto armado · Escaleras",
  e4cis: "04 Obras de concreto armado · Cisterna y tanques",
  arq05: "05 Muros y tabiques de albañilería",
  arq06: "06 Revoques, enlucidos y cielorrasos",
  arq07: "07 Contrapisos y pisos",
  arq08: "08 Zócalos y revestimientos",
  arq09: "09 Carpintería de madera",
  arq10: "10 Carpintería metálica y cerrajería",
  arq11: "11 Vidrios y mamparas",
  arq12: "12 Pintura",
  arq13: "13 Cubiertas",
  arq14: "14 Jardinería",
  arq16: "16 Limpieza",

  s41: "Aparatos sanitarios y accesorios",
  s411: "Aparatos sanitarios y accesorios · Suministro de aparatos sanitarios",
  s412: "Aparatos sanitarios y accesorios · Suministro de accesorios",
  s413: "Aparatos sanitarios y accesorios · Instalación de aparatos sanitarios",
  s414: "Aparatos sanitarios y accesorios · Instalación de accesorios",
  s421: "Sistema de agua fría · Salida de agua fría",
  s422: "Sistema de agua fría · Redes de distribución",
  s423: "Sistema de agua fría · Redes de alimentación",
  s424: "Sistema de agua fría · Accesorios de redes de agua",
  s425: "Sistema de agua fría · Válvulas",
  s426: "Sistema de agua fría · Almacenamiento de agua",
  s427: "Sistema de agua fría · Equipos y otras instalaciones",
  s431: "Sistema de agua caliente · Salida de agua caliente",
  s432: "Sistema de agua caliente · Redes de distribución de agua caliente",
  s433: "Sistema de agua caliente · Accesorios de redes de agua caliente",
  s434: "Sistema de agua caliente · Válvulas",
  s435: "Sistema de agua caliente · Equipos de producción de agua caliente",
  s441: "Sistema contra incendio · Redes de alimentación",
  s442: "Sistema contra incendio · Accesorios",
  s443: "Sistema contra incendio · Suministro e instalación de gabinetes contra incendio",
  s444: "Sistema contra incendio · Suministro e instalación de junta antisísmica",
  s445: "Sistema contra incendio · Válvulas de sistema contra incendio",
  s446: "Sistema contra incendio · Instalaciones especiales",
  s451: "Sistema de drenaje pluvial · Red de recolección",
  s452: "Sistema de drenaje pluvial · Accesorios",
  s461: "Desagüe y ventilación · Salidas de desagüe",
  s462: "Desagüe y ventilación · Redes de derivación",
  s463: "Desagüe y ventilación · Redes colectoras",
  s464: "Desagüe y ventilación · Accesorios de redes colectoras",
  s4651: "Desagüe y ventilación · Cámaras de inspección — cajas de registro",
  s4652: "Desagüe y ventilación · Cámaras de inspección — buzones",
  s466: "Desagüe y ventilación · Instalaciones especiales",
  s47: "Varios",

  e51: "Conexión a la red externa de medidores",
  e521: "Salidas para alumbrado, tomacorrientes, fuerza y señales débiles · Salida",
  e522: "Salidas para alumbrado, tomacorrientes, fuerza y señales débiles · Canalizaciones, conductos o tuberías",
  e523: "Salidas para alumbrado, tomacorrientes, fuerza y señales débiles · Conductores y cables de energía en tuberías",
  e524: "Salidas para alumbrado, tomacorrientes, fuerza y señales débiles · Sistemas de conductos",
  e525: "Salidas para alumbrado, tomacorrientes, fuerza y señales débiles · Instalaciones expuestas",
  e526: "Salidas para alumbrado, tomacorrientes, fuerza y señales débiles · Tableros principales",
  e527: "Salidas para alumbrado, tomacorrientes, fuerza y señales débiles · Tablero de distribución",
  e528: "Salidas para alumbrado, tomacorrientes, fuerza y señales débiles · Dispositivos de maniobra y protección",
  e53: "Instalación de pararrayos",
  e54: "Instalación del sistema de puesta a tierra",
  e551: "Artefactos · Lámparas",
  e552: "Artefactos · Reflectores",
  e561: "Equipos eléctricos y mecánicos · Bomba para agua",
  e562: "Equipos eléctricos y mecánicos · Bombas para desagüe",
  e563: "Equipos eléctricos y mecánicos · Otras bombas",
  e564: "Equipos eléctricos y mecánicos · Grupos electrógenos",
  e565: "Equipos eléctricos y mecánicos · Sistema de recirculación",
  e566: "Equipos eléctricos y mecánicos · Ascensores y montacargas",
  e567: "Equipos eléctricos y mecánicos · Sistemas de parlantes",
  e568: "Equipos eléctricos y mecánicos · Sistema de música ambiental",
  e569: "Equipos eléctricos y mecánicos · Sistema de traducción simultánea",
  e5610: "Equipos eléctricos y mecánicos · Sistema de seguridad",
  e5611: "Equipos eléctricos y mecánicos · Proyectores y pantallas",
  e5612: "Equipos eléctricos y mecánicos · Campanas extractoras",
  e5613: "Equipos eléctricos y mecánicos · Sistema de vapor",
  e5614: "Equipos eléctricos y mecánicos · Sistema de aire comprimido",
  e5615: "Equipos eléctricos y mecánicos · Sistema de oxígeno",
  e5616: "Equipos eléctricos y mecánicos · Sistema de ventilación mecánica",
  e5617: "Equipos eléctricos y mecánicos · Sistema de vacío",
  e5618: "Equipos eléctricos y mecánicos · Sistema de aire acondicionado",
  eAts: "Equipos eléctricos y mecánicos · Transferencia automática",
  eUps: "Equipos eléctricos y mecánicos · UPS y respaldo",
  eSub: "Equipos eléctricos y mecánicos · Subestación y transformación",
  eMcc: "Equipos eléctricos y mecánicos · Tableros de potencia y MCC",
  eMot: "Equipos eléctricos y mecánicos · Motores y accionamientos",
  eIza: "Equipos eléctricos y mecánicos · Izaje y transporte",
  eFv: "Equipos eléctricos y mecánicos · Generación fotovoltaica",
  ePru: "Equipos eléctricos y mecánicos · Pruebas y puesta en marcha",
  eBio: "Equipos eléctricos y mecánicos · Equipamiento biomédico",
  prel: "Trabajos preliminares de instalaciones",

  c61: "Cableado estructurado en interiores de edificios",
  c611: "Cableado estructurado en interiores de edificios · Cables en tuberías",
  c62: "Canaletas, conductos y/o tuberías",
  c63: "Salida de comunicaciones",
  c64: "Conductores de comunicaciones",
  c65: "Patch panel",
  c66: "Rack de comunicaciones",
  c67: "Caja de pase para transformador",

  g71: "Instalaciones de gas · Tuberías — tubería a la vista",
  g712: "Instalaciones de gas · Tuberías — tubería con canaleta o por conducto",
  g713: "Instalaciones de gas · Tuberías — tubería montante",
  g721: "Instalaciones de gas · Artefactos (GLP o gas natural seco) — instalación de un artefacto",
  g722: "Instalaciones de gas · Artefactos (GLP o gas natural seco) — conversión de un artefacto",
  g73: "Instalaciones de gas · Accesorios",
  g741: "Instalaciones de gas · Ventilaciones — superior o inferior",
  g751: "Instalaciones de gas · Ductos de evacuación de humos para artefactos a gas",
  g76: "Instalaciones de gas · Gabinete de regulación",
} as const;

function has(d: string, ...keys: string[]) {
  return keys.some((k) => d.includes(k));
}

function capGas(d: string): string | null {
  if (!has(d, "gas") || has(d, "calentador", "terma eléctrica", "terma electrica")) return null;
  if (has(d, "conversión", "conversion")) return RN.g722;
  if (has(d, "ventilación", "ventilacion") && !has(d, "mecánica", "mecanica", "extractor")) return RN.g741;
  if (has(d, "humo", "evacuación de humos", "evacuacion de humos")) return RN.g751;
  if (has(d, "gabinete de regulación", "gabinete de regulacion", "medidor de gas")) return RN.g76;
  if (has(d, "accesorio")) return RN.g73;
  if (has(d, "montante")) return RN.g713;
  if (has(d, "canaleta", "por conducto")) return RN.g712;
  if (has(d, "tubería", "tuberia", "red de gas")) return RN.g71;
  if (has(d, "punto", "artefacto", "cocina")) return RN.g721;
  return RN.g71;
}

function capSan(codigo: string, d: string, fallback: string): string {
  const gas = capGas(d);
  if (gas && (codigo.startsWith("IS-07") || !has(d, "calentador", "aparato sanitario"))) {
    if (codigo.startsWith("IS-07") || has(d, "tubería de gas", "tuberia de gas", "red de gas", "artefacto a gas", "ventilación") || has(d, "gabinete de regulación", "gabinete de regulacion", "ducto de evacuación", "ducto de evacuacion")) {
      return gas;
    }
  }
  if (codigo.startsWith("IS-07")) return gas ?? RN.g71;
  if (has(d, "pluvial") && has(d, "accesorio", "codo")) return RN.s452;
  if (has(d, "pluvial", "sumidero") && has(d, "punto", "salida", "red", "tuber")) return RN.s451;
  if (has(d, "pluvial")) return RN.s451;
  if (has(d, "gabinete contra incendio", "gabinete contra")) return RN.s443;
  if (has(d, "junta antis")) return RN.s444;
  if (has(d, "contra incendio") && has(d, "válvula", "valvula")) return RN.s445;
  if (has(d, "contra incendio") && has(d, "accesorio")) return RN.s442;
  if (has(d, "contra incendio") && has(d, "red", "tubería", "tuberia", "acero")) return RN.s441;
  if (has(d, "extintor")) return RN.s446;
  if (has(d, "terma", "calentador", "termo")) return RN.s435;
  if (has(d, "caliente") && has(d, "punto", "salida")) return RN.s431;
  if (has(d, "caliente") && has(d, "válvula", "valvula")) return RN.s434;
  if (has(d, "caliente") && has(d, "accesorio")) return RN.s433;
  if (has(d, "caliente") && has(d, "red", "tubería", "tuberia", "cpvc", "ppr")) return RN.s432;
  if (has(d, "agua fría", "agua fria") && has(d, "punto", "salida")) return RN.s421;
  if (has(d, "montante", "alimentación", "alimentacion", "lecho", "by-pass", "bypass") && has(d, "agua", "pvc sap", "red")) return RN.s423;
  if (codigo.startsWith("IS-03.05") || (has(d, "montante") && has(d, "agua"))) return RN.s423;
  if (has(d, "válvula", "valvula", "llave de paso") && !has(d, "caliente", "incendio")) return RN.s425;
  if (has(d, "bomba") && !has(d, "desagüe", "desague", "incendio")) return RN.s427;
  if ((has(d, "tanque elevado", "tanque de agua", "cisterna") || (has(d, "tanque") && !has(d, "tanque bajo", "inodoro"))) && !has(d, "séptico", "septico", "bombeo")) return RN.s426;
  if (has(d, "accesorio de red", "unión", "union", "tee de agua", "codo de agua") && has(d, "agua")) return RN.s424;
  if (has(d, "red de agua fría", "red de agua fria", "pvc sap", "red de agua ppr", "red de agua de cobre") && !has(d, "caliente")) return RN.s422;
  if (has(d, "red de agua") && !has(d, "caliente", "desagüe", "desague")) return RN.s422;
  if (has(d, "buzón", "buzon")) return RN.s4652;
  if (has(d, "caja de registro")) return RN.s4651;
  if (has(d, "colector") && has(d, "accesorio")) return RN.s464;
  if (has(d, "colector", "uf ø110", "uf ø160", "uf ø200", "red de desagüe pvc uf ø110", "red de desague pvc uf ø110")) return RN.s463;
  if (has(d, "red de desagüe", "red de desague", "ramal", "sal ø", "deriv")) return RN.s462;
  if (has(d, "ventilación", "ventilacion") && has(d, "punto", "salida")) return RN.s461;
  if (has(d, "desagüe", "desague") && has(d, "punto", "salida", "sumidero")) return RN.s461;
  if (has(d, "grifería", "griferia", "accesorios de baño", "juego de accesorios")) {
    if (has(d, "suministro") && !has(d, "instal", "coloc")) return RN.s412;
    return RN.s414;
  }
  if (has(d, "cobre tipo", "canalización de cobre", "canalizacion de cobre") || codigo.startsWith("IS-08")) {
    if (has(d, "oxígeno", "oxigeno", "medicinal", "hospitalaria", "tipo l", "tipo k")) return RN.e5615;
    return RN.s422;
  }
  if (has(d, "inodoro", "lavatorio", "lavadero", "ducha", "urinario", "bidet", "tina", "lavamanos", "aparato sanitario")) {
    if (has(d, "suministro") && !has(d, "instal", "coloc")) return RN.s411;
    return RN.s413;
  }
  if (has(d, "prueba hidráulica", "prueba hidraulica", "trazo", "replanteo")) return RN.s47;
  if (codigo.startsWith("IS-00")) return RN.s47;
  if (codigo.startsWith("IS-01.01.01") || (codigo.startsWith("IS-01.01") && has(d, "fría", "fria"))) return RN.s421;
  if (codigo.startsWith("IS-01.01.02")) return RN.s431;
  if (codigo.startsWith("IS-01.02") || codigo.startsWith("IS-01.03")) return RN.s461;
  if (codigo.startsWith("IS-02.04") || codigo.startsWith("IS-02.03")) return RN.s414;
  if (codigo.startsWith("IS-02.02") || codigo.startsWith("IS-02.05")) return RN.s435;
  if (codigo.startsWith("IS-02")) return RN.s413;
  if (codigo.startsWith("IS-03.01.09") || has(d, "cpvc")) return RN.s432;
  if (codigo.startsWith("IS-03.01")) return RN.s422;
  if (codigo.startsWith("IS-03.02")) return has(d, "110") ? RN.s463 : RN.s462;
  if (codigo.startsWith("IS-03.03")) return RN.s4651;
  if (codigo.startsWith("IS-03.06")) return RN.s425;
  if (codigo.startsWith("IS-03.05")) return RN.s423;
  if (codigo.startsWith("IS-04.01") || codigo.startsWith("IS-04.02")) return RN.s426;
  if (codigo.startsWith("IS-04.03")) return RN.s425;
  if (codigo.startsWith("IS-08")) return RN.e5615;
  if (codigo.startsWith("IS-03")) return RN.s422;
  return Object.values(RN).includes(fallback as (typeof RN)[keyof typeof RN]) ? fallback : RN.s47;
}

function capEle(codigo: string, d: string, fallback: string): string {
  if (has(d, "pararrayos", "pararrayo")) return RN.e53;
  if (has(d, "puesta a tierra", "pozo a tierra", "copperweld")) return RN.e54;
  if (has(d, "grupo electrógeno", "grupo electrogeno")) return RN.e564;
  if (has(d, "ups")) return RN.eUps;
  if (has(d, "ats", "transferencia automática", "transferencia automatica", "transferencia de carga", "transferencia manual")) return RN.eAts;
  if (has(d, "reflector")) return RN.e552;
  if (has(d, "luminaria", "lámpara", "lampara", "foco", "plafón", "plafon", "tubo led", "spot", "aparato de iluminación", "aparato de iluminacion")) return RN.e551;
  if (has(d, "termomagnético", "termomagnetico", "diferencial", "interruptor unipolar", "dimmer") && !has(d, "tablero")) return RN.e528;
  if (has(d, "conductor", "thhn", "thw", "lsoh", "n2xoh") && !has(d, "punto", "salida")) return RN.e523;
  if (has(d, "tgbt", "tablero general", "tablero principal") && !has(d, "desde tablero")) return RN.e526;
  if (has(d, "tablero") && !has(d, "desde tablero", "circuitos interiores")) return RN.e527;
  if (has(d, "medidor")) return RN.e51;
  if (has(d, "alimentador", "acometida", "nyy", "n2xy") && !has(d, "thhn", "thw")) return RN.e51;
  if (has(d, "bandeja", "canaleta", "emt", "expuest", "aparente") && has(d, "canal")) return RN.e525;
  if (has(d, "bandeja", "sistema de conducto", "ducto de piso")) return RN.e524;
  if (has(d, "cable") && !has(d, "punto", "salida", "alimentador")) return RN.e523;
  if (has(d, "canalización", "canalizacion", "conduit", "tubería pvc-p", "tuberia pvc-p")) return RN.e522;
  if (has(d, "punto", "salida", "tomacorriente", "iluminación", "iluminacion", "timbre", "fuerza")) return RN.e521;
  if (codigo.startsWith("IE-00")) return RN.prel;
  if (codigo.startsWith("IE-01")) return RN.e521;
  if (codigo.startsWith("IE-02.03")) return RN.e528;
  if (codigo.startsWith("IE-02.02")) return RN.e51;
  if (codigo.startsWith("IE-02")) return RN.e527;
  if (codigo.startsWith("IE-03")) return RN.e54;
  if (codigo.startsWith("IE-04.10") || codigo.startsWith("IE-04.11") || codigo.startsWith("IE-04.05")) return RN.e523;
  if (codigo.startsWith("IE-04.04") || codigo.startsWith("IE-04.02")) return RN.e525;
  if (codigo.startsWith("IE-04.03") || codigo.startsWith("IE-04.12")) return RN.e522;
  if (codigo.startsWith("IE-04")) return RN.e51;
  if (codigo.startsWith("IE-05")) return has(d, "reflector", "proyector") ? RN.e552 : RN.e551;
  if (codigo.startsWith("IE-06.04")) return RN.eUps;
  if (codigo.startsWith("IE-06")) return RN.eAts;
  if (codigo.startsWith("IE-07")) return RN.e564;
  return Object.values(RN).includes(fallback as (typeof RN)[keyof typeof RN]) ? fallback : RN.e521;
}

function capCom(codigo: string, d: string, fallback: string): string {
  if (has(d, "patch panel", "patchpanel")) return RN.c65;
  if (has(d, "caja de pase")) return RN.c67;
  if (has(d, "rack") && !has(d, "patch")) return RN.c66;
  if (has(d, "perifoneo", "altavoz", "amplificador", "parlante")) return RN.e567;
  if (has(d, "acceso", "biométr", "biometric", "cerradura electro")) return RN.e5610;
  if (has(d, "cámara", "camara", "nvr", "cctv", "detector", "central de incendio", "central de alarma", "alarma contra", "estrobo", "estación manual", "estacion manual", "portería", "porteria", "intercomunic")) return RN.e5610;
  if (has(d, "cableado estructurado") && has(d, "tubería", "tuberia", "cables en")) return RN.c611;
  if (has(d, "cableado estructurado")) return RN.c61;
  if (has(d, "fibra")) return RN.c64;
  if (has(d, "ducto telefónico", "ducto telefonico", "canaleta", "conduit") && !has(d, "punto", "salida")) return RN.c62;
  if (has(d, "utp", "coaxial", "conductor") && !has(d, "punto", "salida")) return RN.c64;
  if (has(d, "punto", "salida", "data", "teléfono", "telefono", "tv")) return RN.c63;
  if (codigo.startsWith("COM-03.04") || codigo.startsWith("COM-03.05")) return RN.c65;
  if (codigo.startsWith("COM-03.02") || codigo.startsWith("COM-03.03")) return RN.c62;
  if (codigo.startsWith("COM-03")) return RN.c66;
  if (codigo.startsWith("COM-04") || codigo.startsWith("COM-05") || codigo.startsWith("COM-02") || codigo.startsWith("COM-06.0") || codigo.startsWith("COM-07")) return RN.e5610;
  if (codigo.startsWith("COM-08")) return RN.e567;
  if (codigo.startsWith("COM-01")) return RN.c63;
  return Object.values(RN).includes(fallback as (typeof RN)[keyof typeof RN]) ? fallback : RN.c63;
}

function capMec(codigo: string, d: string, fallback: string): string {
  const gas = capGas(d);
  if (gas && (codigo.startsWith("IM-06") || has(d, "red de gas", "punto de gas", "tubería de gas", "tuberia de gas"))) return gas;
  if (codigo.startsWith("IM-00")) return RN.prel;
  if (codigo.startsWith("IM-09") || has(d, "biomédico", "biomedico", "minsa-diem")) return RN.eBio;
  if (has(d, "vacío clínico", "vacio clinico", "bomba de vacío", "bomba de vacio")) return RN.e5617;
  if (codigo.startsWith("IM-08") || has(d, "oxígeno", "oxigeno", "gases medicinal", "psa")) return RN.e5615;
  if (has(d, "ascensor", "montacarga")) return RN.e566;
  if (has(d, "aire acondicionado", "minisplit", "fan coil", "condensadora", "cassette", "piso-techo", "vrf", "vrv", "refrigeración") || codigo.startsWith("IM-05")) return RN.e5618;
  if (has(d, "extractor", "ventilación", "ventilacion") && !has(d, "gas")) return RN.e5616;
  if (has(d, "campana")) return RN.e5612;
  if (has(d, "gabinete contra")) return RN.s443;
  if (has(d, "contra incendio") && has(d, "bomba")) return RN.e563;
  if (has(d, "contra incendio") && has(d, "red", "tuber")) return RN.s441;
  if (has(d, "extintor")) return RN.s446;
  if (has(d, "bomba") && has(d, "desagüe", "desague", "aguas servidas")) return RN.e562;
  if (has(d, "bomba")) return RN.e561;
  if (has(d, "grupo electrógeno", "grupo electrogeno")) return RN.e564;
  if (codigo.startsWith("IM-06")) return RN.g721;
  if (codigo.startsWith("IM-04")) return RN.e566;
  if (codigo.startsWith("IM-03")) return RN.e5616;
  if (codigo.startsWith("IM-02.02")) return RN.s443;
  if (codigo.startsWith("IM-02.01")) return RN.s441;
  if (codigo.startsWith("IM-02")) return RN.s446;
  if (codigo.startsWith("IM-01")) return RN.e561;
  return fallback;
}

function capIem(codigo: string, d: string, fallback: string): string {
  if (has(d, "grupo electrógeno", "grupo electrogeno")) return RN.e564;
  if (has(d, "aire acondicionado")) return RN.e5618;
  if (has(d, "vacío", "vacio")) return RN.e5617;
  if (has(d, "ventilación", "ventilacion")) return RN.e5616;
  if (has(d, "oxígeno", "oxigeno")) return RN.e5615;
  if (has(d, "aire comprimido")) return RN.e5614;
  if (has(d, "vapor")) return RN.e5613;
  if (has(d, "campana")) return RN.e5612;
  if (has(d, "proyector", "pantalla")) return RN.e5611;
  if (has(d, "seguridad", "cctv")) return RN.e5610;
  if (has(d, "ascensor")) return RN.e566;
  if (has(d, "recircul")) return RN.e565;
  if (has(d, "bomba")) return RN.e561;
  if (has(d, "fotovoltaic")) return RN.eFv;
  if (has(d, "ups")) return RN.eUps;
  if (has(d, "ats", "transferencia")) return RN.eAts;
  if (has(d, "tablero general", "tgbt")) return RN.e526;
  if (has(d, "tablero")) return RN.e527;
  if (codigo.startsWith("IEM-00")) return RN.prel;
  if (codigo.startsWith("IEM-01")) return RN.eSub;
  if (codigo.startsWith("IEM-02")) return RN.eMcc;
  if (codigo.startsWith("IEM-03")) return RN.eAts;
  if (codigo.startsWith("IEM-04")) return RN.e564;
  if (codigo.startsWith("IEM-05")) return RN.eUps;
  if (codigo.startsWith("IEM-06")) return RN.eMot;
  if (codigo.startsWith("IEM-07")) return RN.eIza;
  if (codigo.startsWith("IEM-08")) return RN.e54;
  if (codigo.startsWith("IEM-09")) return RN.e524;
  if (codigo.startsWith("IEM-10")) return RN.ePru;
  if (codigo.startsWith("IEM-11")) return RN.eFv;
  return fallback;
}

function capCivil(p: Partida): string {
  const cap = p.capitulo;
  if (p.especialidad === "arquitectura") {
    if (cap.startsWith("01 ")) return RN.arq01;
    if (cap.startsWith("02 ")) return RN.arq02;
    if (cap.startsWith("05 ")) return RN.arq05;
    if (cap.startsWith("06 ")) return RN.arq06;
    if (cap.startsWith("07 ")) return RN.arq07;
    if (cap.startsWith("08 ")) return RN.arq08;
    if (cap.startsWith("09 ")) return RN.arq09;
    if (cap.startsWith("10 ")) return RN.arq10;
    if (cap.startsWith("11 ")) return RN.arq11;
    if (cap.startsWith("12 ")) return RN.arq12;
    if (cap.startsWith("13 ")) return RN.arq13;
    if (cap.startsWith("14 ")) return RN.arq14;
    if (cap.startsWith("16 ")) return RN.arq16;
  }
  if (p.especialidad === "estructuras") return capEst(p.codigo, p.descripcion.toLowerCase(), cap);
  return cap;
}

function capEst(codigo: string, d: string, fallback: string): string {
  if (codigo.startsWith("EST-02") || codigo.startsWith("ARQ-02") || fallback.startsWith("02 ")) {
    if (has(d, "agotamiento", "bombeo", "napa")) return RN.e2ago;
    if (has(d, "proctor", "topográf", "topograf", "ensayo", "emparejado")) return RN.e2ctl;
    if (has(d, "talud", "desquinche", "geotextil")) return RN.e2tal;
    if (has(d, "nivelación", "nivelacion", "afirmado", "plataforma", "cama de apoyo")) return RN.e2niv;
    if (has(d, "eliminación", "eliminacion", "carguío", "carguio")) return RN.e2eli;
    if (has(d, "relleno")) return RN.e2rel;
    if (has(d, "excav", "entibado")) return RN.e2exc;
    return RN.est02;
  }
  if (has(d, "platea")) return RN.e4pla;
  if (has(d, "dado")) return RN.e4dad;
  if (has(d, "zapata")) return RN.e4zap;
  if (has(d, "viga de conexión", "vigas de conexión", "viga de conexion", "vigas de conexion")) return RN.e4vco;
  if (has(d, "viga de cimentación", "vigas de cimentación", "viga de cimentacion", "vigas de cimentacion")) return RN.e4vci;
  if (has(d, "sobrecimiento armado")) return RN.e4soa;
  if (has(d, "columna")) return RN.e4col;
  if (has(d, "aligerada") || has(d, "ladrillo hueco de techo", "vigueta")) return RN.e4ali;
  if (has(d, "losa maciza")) return RN.e4mac;
  if (has(d, "placa", "muro de concreto", "muro de corte")) return RN.e4plq;
  if (has(d, "escalera")) return RN.e4esc;
  if (has(d, "cisterna", "tanque")) return RN.e4cis;
  if (has(d, "viga")) return RN.e4vig;
  if (has(d, "ciclópeo", "ciclopeo")) return RN.e3cic;
  if (has(d, "cimiento corrido")) return RN.e3cim;
  if (has(d, "sobrecimiento")) return RN.e3sob;
  if (has(d, "solado", "falso piso")) return RN.e3sol;
  if (has(d, "curado") && (codigo.startsWith("EST-03") || has(d, "simple"))) return RN.e3cur;
  if (codigo.startsWith("EST-03")) return RN.est03;
  if (codigo.startsWith("EST-04") || fallback.includes("concreto armado")) return RN.est04;
  if (fallback.includes("concreto simple")) return RN.est03;
  return fallback;
}

export function capituloOficial(p: Partida): string {
  const d = p.descripcion.toLowerCase();
  if (p.especialidad === "sanitarias") return capSan(p.codigo, d, p.capitulo);
  if (p.especialidad === "electricas") return capEle(p.codigo, d, p.capitulo);
  if (p.especialidad === "comunicaciones") return capCom(p.codigo, d, p.capitulo);
  if (p.especialidad === "mecanicas") return capMec(p.codigo, d, p.capitulo);
  if (p.especialidad === "electromecanicas") return capIem(p.codigo, d, p.capitulo);
  return capCivil(p);
}

export function aplicarCapitulosRn(partidas: Partida[]): Partida[] {
  return partidas.map((p) => {
    const cap = capituloOficial(p);
    return cap === p.capitulo ? p : { ...p, capitulo: cap };
  });
}

const RN_TITULOS = Object.values(RN);

const EST_ORDEN: Record<string, number> = {
  [RN.e2exc]: 201,
  [RN.e2rel]: 202,
  [RN.e2eli]: 203,
  [RN.e2niv]: 204,
  [RN.e2tal]: 205,
  [RN.e2ctl]: 206,
  [RN.e2ago]: 207,
  [RN.est02]: 299,
  [RN.e3sol]: 301,
  [RN.e3cim]: 302,
  [RN.e3sob]: 303,
  [RN.e3cic]: 304,
  [RN.e3cur]: 305,
  [RN.est03]: 399,
  [RN.e4zap]: 401,
  [RN.e4dad]: 402,
  [RN.e4pla]: 403,
  [RN.e4vco]: 404,
  [RN.e4vci]: 405,
  [RN.e4soa]: 406,
  [RN.e4col]: 407,
  [RN.e4vig]: 408,
  [RN.e4ali]: 409,
  [RN.e4mac]: 410,
  [RN.e4plq]: 411,
  [RN.e4esc]: 412,
  [RN.e4cis]: 413,
  [RN.est04]: 499,
};

/** Clave comparable: primero el número del título (01…16), luego el índice RN, luego el texto. */
export function ordenCapitulo(cap: string): string {
  const n = cap.match(/^(\d+)/);
  const est = EST_ORDEN[cap];
  if (n && est != null) return `0.${n[1].padStart(4, "0")}.${String(est).padStart(4, "0")}`;
  if (n) return `0.${n[1].padStart(4, "0")}.5000`;
  const i = RN_TITULOS.indexOf(cap as (typeof RN)[keyof typeof RN]);
  if (i >= 0) return `1.${String(i).padStart(4, "0")}`;
  return `2.${cap}`;
}

export function compararCapitulos(a: string, b: string): number {
  const ka = ordenCapitulo(a);
  const kb = ordenCapitulo(b);
  if (ka !== kb) return ka.localeCompare(kb, "es");
  return a.localeCompare(b, "es");
}

/** ARQ-14.03.01 → [14, 3, 1] para orden natural (01 antes que 14). */
export function compararCodigoPartida(a: string, b: string): number {
  const bits = (s: string) => {
    const m = s.match(/^([A-Za-zÁÉÍÓÚÜÑ]+)-(.+)$/i);
    return { pref: (m?.[1] ?? "").toUpperCase(), rest: m?.[2] ?? s };
  };
  const A = bits(a);
  const B = bits(b);
  const ep = A.pref.localeCompare(B.pref, "es");
  if (ep) return ep;
  const na = A.rest.split(/[.\-]/);
  const nb = B.rest.split(/[.\-]/);
  const len = Math.max(na.length, nb.length);
  for (let i = 0; i < len; i++) {
    const x = na[i];
    const y = nb[i];
    if (x == null) return -1;
    if (y == null) return 1;
    const nx = parseInt(x, 10);
    const ny = parseInt(y, 10);
    if (Number.isFinite(nx) && Number.isFinite(ny) && nx !== ny) return nx - ny;
    const c = x.localeCompare(y, "es", { numeric: true });
    if (c) return c;
  }
  return a.localeCompare(b, "es", { numeric: true });
}

export function partesTituloCapitulo(cap: string): { num: string; nombre: string } {
  const m = cap.match(/^(\d+)\s+(.+)$/);
  return m ? { num: m[1].padStart(2, "0"), nombre: m[2] } : { num: "", nombre: cap };
}

/** Segunda cifra del código (ARQ-01.02.03 o IS-04.2.4.01 → 01.02 / 04.02). */
export function claveSubcapitulo(codigo: string): string {
  const m = codigo.match(/^[A-Za-zÁÉÍÓÚÜÑ]+-((?:\d+\.)*\d+)/i);
  if (!m) return "";
  const nums = m[1].split(".").map((n) => n.padStart(2, "0"));
  if (nums.length >= 2) return `${nums[0]}.${nums[1]}`;
  return nums[0] ?? "";
}

const SUBTITULO_ARQ: Record<string, string> = {
  "01.01": "Trazo, limpieza y desbroce",
  "01.02": "Demoliciones",
  "01.03": "Obras provisionales",
  "01.04": "Andamios y apuntalamiento",
  "01.05": "SSOMA de obra",
  "02.01": "Excavaciones",
  "02.02": "Rellenos",
  "02.03": "Eliminación de material",
  "02.04": "Nivelación y afirmado",
  "02.06": "Emparejado de plataforma",
  "05.01": "Muros de albañilería",
  "05.02": "Elementos de amarre",
  "05.03": "Veredas",
  "05.04": "Tabiques livianos",
  "06.01": "Tarrajeos",
  "06.02": "Cielorrasos",
  "06.03": "Impermeabilización",
  "07.01": "Contrapisos y falso piso",
  "07.02": "Piso pulido",
  "07.03": "Pisos cerámicos",
  "07.04": "Pisos de granito",
  "07.05": "Pisos vinílicos",
  "08.01": "Zócalos",
  "08.02": "Mayólicas y revestimientos",
  "08.03": "Cubierta de azotea",
  "09.01": "Puertas de madera",
  "10.01": "Ventanas",
  "10.02": "Puertas metálicas",
  "10.03": "Barandas",
  "10.04": "Rejas",
  "11.02": "Mamparas",
  "12.01": "Pintura látex",
  "12.02": "Pintura esmalte",
  "12.03": "Pintura de cielo",
  "13.01": "Cobertura de calamina",
  "13.02": "Cobertura de teja",
  "13.04": "Aleros",
  "14.01": "Tierra vegetal",
  "14.02": "Césped",
  "14.03": "Plantación",
  "16.01": "Limpieza final",
};

export function etiquetaSubcapitulo(codigo: string): string {
  const pref = codigo.match(/^([A-Za-zÁÉÍÓÚÜÑ]+)-/i)?.[1]?.toUpperCase() ?? "";
  const clave = claveSubcapitulo(codigo);
  return SUBTITULOS_POR_PREFIJO[pref]?.[clave] ?? SUBTITULO_ARQ[clave] ?? "";
}
