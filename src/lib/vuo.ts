/** Cuadro de Valores Unitarios Oficiales de Edificación — 7 partidas.
 *  R.D. N° 00015-2025-VIVIENDA/VMVU-DGPRVU (enero 2026) · R.M. N° 277-2025-VIVIENDA.
 *  El VU/m² es la suma de las siete columnas según la categoría predominante de cada rubro.
 */

export type CategVuo = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
export type VuoZona = "lima" | "costa" | "sierra" | "selva";
export type VuoRubro = "muros" | "techos" | "pisos" | "puertas" | "revest" | "banos" | "instala";
export type VuoCats = Record<VuoRubro, CategVuo>;

export const CATEG_VUO: CategVuo[] = ["A", "B", "C", "D", "E", "F", "G", "H"];
export const VUO_RUBROS: VuoRubro[] = ["muros", "techos", "pisos", "puertas", "revest", "banos", "instala"];

export const VUO_NORMA = "R.D. N° 00015-2025-VIVIENDA/VMVU-DGPRVU";
export const VUO_VIGENCIA = "Enero 2026 · valores por m² de área techada";

export const VUO_ZONA_META: Record<VuoZona, { label: string; anexo: string }> = {
  lima: { label: "Lima Metropolitana y Callao", anexo: "Cuadro Lima / Callao" },
  costa: { label: "Costa (excepto Lima y Callao)", anexo: "Cuadro Costa" },
  sierra: { label: "Sierra", anexo: "Cuadro Sierra" },
  selva: { label: "Selva", anexo: "Cuadro Selva" },
};

export const VUO_RUBRO_LABEL: Record<VuoRubro, string> = {
  muros: "1. Muros y columnas",
  techos: "2. Techos",
  pisos: "3. Pisos",
  puertas: "4. Puertas y ventanas",
  revest: "5. Revestimientos",
  banos: "6. Baños",
  instala: "7. Instalaciones eléctricas y sanitarias",
};

export const VUO_RUBRO_GRUPO: Record<VuoRubro, string> = {
  muros: "Estructuras",
  techos: "Estructuras",
  pisos: "Acabados",
  puertas: "Acabados",
  revest: "Acabados",
  banos: "Instalaciones",
  instala: "Instalaciones",
};

type Celda = { desc: string; valor: number };
type Fila = [number, number, number, number, number, number, number];

const RUBRO_I: Record<VuoRubro, number> = {
  muros: 0,
  techos: 1,
  pisos: 2,
  puertas: 3,
  revest: 4,
  banos: 5,
  instala: 6,
};

/** Descripciones predominantes del cuadro oficial (Costa / Lima; Selva E–G varían en muros). */
const DESC: Record<CategVuo, Record<VuoRubro, string>> = {
  A: {
    muros: "Estructuras laminares curvadas de concreto armado que incluyen en una sola armadura la cimentación y el techo. No se considera la columna de techos.",
    techos: "Losa o aligerado de concreto armado con luces libres mayores a 6 m y sobrecarga mayor a 300 kg/m² (deben cumplirse ambas).",
    pisos: "Mármol importado, piedras naturales importadas, porcelanato.",
    puertas: "Aluminio pesado con perfiles especiales; madera fina ornamental (caoba, cedro o pino selecto); vidrio insulado (DVH).",
    revest: "Mármol importado, madera fina (caoba o similar), baldosa acústica en techo o similar.",
    banos: "Baños completos de lujo importado con enchape fino (mármol o similar). Mínimo lavatorio, inodoro y ducha o tina.",
    instala: "Aire acondicionado, iluminación especial, ventilación forzada, hidroneumático, agua caliente y fría, intercomunicador, alarmas, ascensor, bombeo de agua y desagüe, teléfono.",
  },
  B: {
    muros: "Columnas, vigas y/o placas de concreto armado y/o metálicas.",
    techos: "Aligerados o losas de concreto armado inclinadas.",
    pisos: "Mármol nacional o reconstituido, parquet fino (olivo, chonta o similar), cerámica importada, madera fina.",
    puertas: "Aluminio o madera fina (caoba o similar) de diseño especial; vidrio tratado polarizado, curvado, laminado o templado.",
    revest: "Mármol nacional, madera fina (caoba o similar), enchapes en techos.",
    banos: "Baños completos importados con mayólica o cerámico decorativo importado.",
    instala: "Sistema de bombeo de agua potable, ascensor, teléfono, agua caliente y fría.",
  },
  C: {
    muros: "Placas de concreto e = 10 a 15 cm, o albañilería armada (ladrillo o similar) con columnas y vigas de amarre de concreto armado.",
    techos: "Aligerado o losas de concreto armado horizontales.",
    pisos: "Madera fina machihembrada, terrazo.",
    puertas: "Aluminio o madera fina (caoba o similar); vidrio tratado polarizado, laminado o templado.",
    revest: "Superficie caravista obtenida mediante encofrado especial, enchape en techos.",
    banos: "Baños completos nacionales con mayólica o cerámico nacional de color.",
    instala: "Igual al punto B, sin ascensor.",
  },
  D: {
    muros: "Ladrillo o similar sin elementos de concreto armado; drywall o similar (incluye techo). No se considera la columna de techos.",
    techos: "Calamina metálica o fibrocemento sobre viguería metálica / bambú.",
    pisos: "Parquet de 1.ª, lajas, cerámica nacional, loseta veneciana 40×40, piso laminado.",
    puertas: "Ventanas de aluminio; puertas de madera selecta; vidrio tratado transparente.",
    revest: "Enchape de madera o laminados, piedra o material vitrificado.",
    banos: "Baños completos nacionales blancos con mayólica blanca.",
    instala: "Agua fría, agua caliente, corriente trifásica, teléfono.",
  },
  E: {
    muros: "Adobe, tapial o quincha / bambú estructural.",
    techos: "Madera con material impermeabilizante / policarbonato.",
    pisos: "Parquet de 2.ª, loseta veneciana 30×30, lajas de cemento con canto rodado.",
    puertas: "Ventanas de fierro; puertas de madera selecta (caoba o similar); vidrio simple transparente.",
    revest: "Superficie de ladrillo caravista.",
    banos: "Baños con mayólica blanca parcial.",
    instala: "Agua fría, agua caliente, corriente monofásica, teléfono.",
  },
  F: {
    muros: "Madera (estoraque, pumaquiro, huayruro, machinga, copaiba, diablo fuerte, tornillo o similares) o drywall sin techo.",
    techos: "Calamina metálica, fibrocemento o teja sobre viguería de madera corriente.",
    pisos: "Loseta corriente, canto rodado, alfombra.",
    puertas: "Ventanas de fierro o aluminio industrial; puertas contraplacadas, MDF o HDF; vidrio simple transparente.",
    revest: "Tarrajeo frotachado y/o yeso moldurado, pintura lavable.",
    banos: "Baños blancos sin mayólica.",
    instala: "Agua fría, corriente monofásica, teléfono.",
  },
  G: {
    muros: "Pircado con mezcla de barro.",
    techos: "Madera rústica o caña con torta de barro.",
    pisos: "Loseta vinílica, cemento bruñado coloreado, tapizón.",
    puertas: "Madera corriente; marcos de puertas y ventanas de PVC o madera corriente.",
    revest: "Estucado de yeso y/o barro, pintura al temple o al agua.",
    banos: "Sanitarios básicos de losa de 2.ª, fierro fundido o granito.",
    instala: "Agua fría, corriente monofásica sin empotrar.",
  },
  H: {
    muros: "Mampostería rústica / madera corriente.",
    techos: "Sin techo.",
    pisos: "Cemento pulido, ladrillo corriente, entablado corriente.",
    puertas: "Madera rústica.",
    revest: "Pintado en ladrillo rústico, placa de concreto o similar.",
    banos: "Sin aparatos sanitarios.",
    instala: "Sin instalación eléctrica ni sanitaria.",
  },
};

function filaA(b: Fila, c: Fila): Fila {
  const f = c[0] > 0 ? b[0] / c[0] : 1;
  return b.map((v) => Math.round(v * f * 100) / 100) as Fila;
}

const B_COSTA: Fila = [648.79, 394.05, 347.99, 352.1, 379.51, 128.06, 369.56];
const C_COSTA: Fila = [418.29, 257.09, 208.58, 185.59, 287.53, 97.37, 268];
const B_LIMA: Fila = [655.34, 398.03, 351.51, 355.65, 383.34, 129.36, 380.17];
const C_LIMA: Fila = [422.52, 259.69, 210.68, 187.46, 290.44, 98.36, 277.58];
const B_SIERRA: Fila = [722.72, 375.79, 266.64, 285.24, 359.94, 127.66, 454.9];
const C_SIERRA: Fila = [429.97, 258.36, 222.34, 252.42, 287.48, 91.19, 267.56];
const B_SELVA: Fila = [757.02, 387.69, 472.57, 320.69, 380.26, 138.75, 469];
const C_SELVA: Fila = [516.5, 273.86, 226.48, 254.37, 262.1, 98.6, 280.96];

/** Soles por m² de área techada, enero 2026. Fila A = proporción B/C del mismo cuadro (lujo laminar). */
const VAL: Record<VuoZona, Record<CategVuo, Fila>> = {
  costa: {
    A: filaA(B_COSTA, C_COSTA),
    B: B_COSTA,
    C: C_COSTA,
    D: [287.94, 212.4, 137.28, 119.95, 213.31, 67.55, 166.77],
    E: [278.45, 140.66, 121.1, 105.07, 163.66, 36.04, 105.56],
    F: [196.03, 50.26, 81.14, 89.9, 112.6, 21.19, 76.73],
    G: [147.63, 27.64, 55.41, 67.49, 79.37, 15.78, 42.2],
    H: [86.99, 19, 48.9, 36.46, 65.08, 10.85, 22.8],
  },
  lima: {
    A: filaA(B_LIMA, C_LIMA),
    B: B_LIMA,
    C: C_LIMA,
    D: [290.85, 214.54, 138.67, 121.17, 215.46, 68.23, 175.11],
    E: [281.26, 142.08, 122.32, 106.13, 165.31, 36.4, 110.62],
    F: [198.01, 50.77, 81.96, 90.81, 113.74, 21.4, 80.34],
    G: [149.12, 27.92, 55.97, 68.17, 80.18, 15.94, 45.96],
    H: [87.87, 19.19, 49.39, 36.82, 65.74, 10.96, 42.63],
  },
  sierra: {
    A: filaA(B_SIERRA, C_SIERRA),
    B: B_SIERRA,
    C: C_SIERRA,
    D: [311.96, 180.79, 143.88, 184.17, 237.93, 59.54, 199.09],
    E: [288.14, 136.82, 117.97, 108.02, 182, 36.43, 112.81],
    F: [226.2, 56.19, 97.57, 82.51, 151.41, 17.86, 62.78],
    G: [141.06, 44.89, 79.68, 63.81, 90.28, 15.18, 40.81],
    H: [83.11, 0, 59.6, 37.59, 67.07, 10.43, 24.04],
  },
  selva: {
    A: filaA(B_SELVA, C_SELVA),
    B: B_SELVA,
    C: C_SELVA,
    D: [381.51, 206.62, 148.62, 193.8, 223.58, 69.57, 204.84],
    E: [294.98, 180.14, 126, 129.9, 161.57, 47.17, 113.91],
    F: [234.22, 131.16, 101.66, 84.35, 122.5, 23.41, 77.02],
    G: [184.7, 60.31, 82.78, 68.8, 94.71, 19.9, 42.53],
    H: [159.98, 47.45, 68.44, 40.59, 79.15, 13.7, 25.1],
  },
};

export function esCategVuo(v: string): v is CategVuo {
  return CATEG_VUO.includes(v as CategVuo);
}

export function catsVuoDe(cat: CategVuo, extra?: Partial<VuoCats>): VuoCats {
  const base: VuoCats = {
    muros: cat,
    techos: cat,
    pisos: cat,
    puertas: cat,
    revest: cat,
    banos: cat,
    instala: cat,
  };
  return { ...base, ...extra };
}

export function celdaVuo(zona: VuoZona, cat: CategVuo, rubro: VuoRubro): Celda {
  return { desc: DESC[cat][rubro], valor: VAL[zona][cat][RUBRO_I[rubro]] };
}

/** A y D incluyen el techo en muros: no se suma la columna 2. */
export function omiteTechos(catMuros: CategVuo) {
  return catMuros === "A" || catMuros === "D";
}

export function totalVuoSol(zona: VuoZona, cats: VuoCats, plus5 = false) {
  let base = 0;
  for (const rubro of VUO_RUBROS) {
    if (rubro === "techos" && omiteTechos(cats.muros)) continue;
    base += celdaVuo(zona, cats[rubro], rubro).valor;
  }
  return plus5 ? Math.round(base * 1.05 * 100) / 100 : Math.round(base * 100) / 100;
}

export function vuoAUsd(sol: number, tc: number) {
  const t = tc > 0 ? tc : 3.8;
  return Math.round((sol / t) * 100) / 100;
}

export function zonaVuoDesdeRegion(region: string): VuoZona {
  const r = region.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\bcallao\b/.test(r) || r === "lima" || /^lima\b/.test(r)) return "lima";
  if (/loreto|ucayali|madre de dios|amazonas|san martin/.test(r)) return "selva";
  if (/cajamarca|huanuco|pasco|junin|huancavelica|ayacucho|apurimac|cusco|cuzco|puno|ancash/.test(r)) return "sierra";
  return "costa";
}

export function tituloCategVuo(cat: CategVuo) {
  const corto: Record<CategVuo, string> = {
    A: "Estructuras laminares de C°A°",
    B: "Pórticos / placas de C°A° o metálicas",
    C: "Albañilería confinada / placas 10–15 cm",
    D: "Albañilería simple o drywall (incluye techo)",
    E: "Adobe, tapial o quincha",
    F: "Madera selecta o drywall sin techo",
    G: "Pircado con barro",
    H: "Rústico / sin techo",
  };
  return `Categoría ${cat} — ${corto[cat]}`;
}
