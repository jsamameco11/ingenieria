import { fmt, fmt0 } from "./types";
import type { Block, MemoriaDoc } from "./memoria";
import type { CategVuo, VuoCats, VuoZona } from "./vuo";
import {
  celdaVuo,
  omiteTechos,
  tituloCategVuo,
  totalVuoSol,
  VUO_NORMA,
  VUO_RUBRO_LABEL,
  VUO_RUBROS,
  VUO_VIGENCIA,
  VUO_ZONA_META,
} from "./vuo";

export type MaterialTas = "Concreto" | "Ladrillo" | "Liviano/Adobe";
export type EstadoTas = "Muy bueno" | "Bueno" | "Regular" | "Malo";
export type ModoTas = "vivienda" | "terreno";
export type TablaFd = "vivienda" | "comercio";
export type TipoLote = "1frente" | "2frentes" | "3frentes" | "pasadizo" | "servidumbre" | "restriccion" | "acuatico";

export const TIPO_LOTE_LABEL: Record<TipoLote, string> = {
  "1frente": "Lote de un frente (Art. 19)",
  "2frentes": "Lote de dos frentes",
  "3frentes": "Lote de tres frentes",
  pasadizo: "Lote con pasadizo común",
  servidumbre: "Lote con servidumbre / pasaje exclusivo",
  restriccion: "Restricción por uso de servidumbre",
  acuatico: "Terreno en tierra firme y medio acuático",
};

/** Claves de zonificación usadas en PDU municipales (RATDUS / Ley 31313 DUS) y certificados de parámetros. */
export const ZONA_OTRA = "__otra__";

export const ZONIFICACION_GRUPOS: { grupo: string; items: string[] }[] = [
  {
    grupo: "Residencial",
    items: [
      "Residencial Densidad Baja — RDB",
      "Residencial Densidad Baja Tipo 1 — RDB-1",
      "Residencial Densidad Baja Tipo 2 — RDB-2",
      "Residencial Densidad Baja Tipo 3 — RDB-3",
      "Residencial Densidad Baja Tipo 4 — RDB-4",
      "Residencial Densidad Baja Tipo 5 — RDB-5",
      "Residencial Densidad Media Baja — RDMB",
      "Residencial Densidad Media — RDM",
      "Residencial Densidad Media Tipo 1 — RDM-1",
      "Residencial Densidad Media Tipo 2 — RDM-2",
      "Residencial Densidad Media Tipo 3 — RDM-3",
      "Residencial Densidad Media Tipo 4 — RDM-4",
      "Residencial Densidad Media Tipo 5 — RDM-5",
      "Residencial Densidad Media Tipo 6 — RDM-6",
      "Residencial Densidad Media Alta — RDMA",
      "Residencial Densidad Alta — RDA",
      "Residencial Densidad Alta Tipo 1 — RDA-1",
      "Residencial Densidad Alta Tipo 2 — RDA-2",
      "Residencial Densidad Alta Tipo 3 — RDA-3",
      "Residencial Densidad Alta Tipo 4 — RDA-4",
      "Residencial Densidad Alta Tipo 5 — RDA-5",
      "Residencial Densidad Alta Tipo 6 — RDA-6",
      "Residencial Densidad Muy Baja / Campiña — RDMB-C",
      "Vivienda Taller — VT",
      "Residencial Mixto — RM",
      "Comercio Residencial — CR",
    ],
  },
  {
    grupo: "Comercial",
    items: [
      "Comercio Vecinal — CV",
      "Comercio Vecinal Tipo 1 — CV-1",
      "Comercio Vecinal Tipo 2 — CV-2",
      "Comercio Vecinal Tipo 3 — CV-3",
      "Comercio Local — CL",
      "Comercio Zonal — CZ",
      "Comercio Zonal Tipo 1 — CZ-1",
      "Comercio Zonal Tipo 2 — CZ-2",
      "Comercio Zonal Tipo 3 — CZ-3",
      "Comercio Metropolitano — CM",
      "Comercio Especializado — CE",
      "Comercio Intensivo — C5",
      "Corredor Comercial",
    ],
  },
  {
    grupo: "Industrial",
    items: [
      "Industria Elemental y Complementaria — I1",
      "Industria Liviana — I2",
      "Gran Industria / Industria Pesada — I3",
      "Industria Pesada Básica — I4",
      "Parque Industrial — PI",
    ],
  },
  {
    grupo: "Equipamiento y usos especiales",
    items: [
      "Recreación Pública — ZRP",
      "Habilitación Recreacional — ZHR",
      "Otros Usos — OU",
      "Usos Especiales — UE",
      "Educación — E / UEE",
      "Salud — H / UEH",
      "Otros Usos Especiales — OUE",
      "Servicios Públicos Complementarios — SPC",
      "Zona Monumental — ZM",
      "Zona de Tratamiento Especial — ZTE",
      "Zona de Reglamentación Especial — ZRE",
      "Cementerio — CEM",
      "Cuartel / instalación militar — CU",
      "Terminal terrestre / portuario / aeroportuario — T",
    ],
  },
  {
    grupo: "Protección, agrícola y reserva",
    items: [
      "Conservación y Protección Ecológica — CPE / ZPE",
      "Área Verde / Protección Vegetal — AV",
      "Zona Agrícola — ZA",
      "Zona Forestal — ZF",
      "Zona de Playa / ribera — ZP",
      "Preurbano / expansión urbana — PU",
      "Área Urbanizable de Reserva — AUR",
      "Zona de Riesgo No Mitigable — ZRNM",
      "Área Natural Protegida — ANP",
      "Sin zonificación / en trámite",
    ],
  },
];

export const ZONIFICACION_TODAS = ZONIFICACION_GRUPOS.flatMap((g) => g.items);

export function zonaEnCatalogo(v: string) {
  return ZONIFICACION_TODAS.includes(v);
}

export type FloorTas = {
  id: string;
  nombre: string;
  area: string;
  vu: string;
  ambientes: string;
  categVuo?: CategVuo;
  catMuros?: CategVuo;
  catTechos?: CategVuo;
  catPisos?: CategVuo;
  catPuertas?: CategVuo;
  catRevest?: CategVuo;
  catBanos?: CategVuo;
  catInstala?: CategVuo;
  /** +5 % desde el 5.° piso (nota del cuadro oficial). */
  plus5?: boolean;
};

export function catsDePiso(f: Pick<
  FloorTas,
  "categVuo" | "catMuros" | "catTechos" | "catPisos" | "catPuertas" | "catRevest" | "catBanos" | "catInstala"
>): VuoCats {
  const cat = (f.categVuo ?? "C") as CategVuo;
  return {
    muros: f.catMuros ?? cat,
    techos: f.catTechos ?? cat,
    pisos: f.catPisos ?? cat,
    puertas: f.catPuertas ?? cat,
    revest: f.catRevest ?? cat,
    banos: f.catBanos ?? cat,
    instala: f.catInstala ?? cat,
  };
}

export function catsTodasPiso(cat: CategVuo): Partial<FloorTas> {
  return {
    categVuo: cat,
    catMuros: cat,
    catTechos: cat,
    catPisos: cat,
    catPuertas: cat,
    catRevest: cat,
    catBanos: cat,
    catInstala: cat,
  };
}

export const OPT_VIA = ["asfaltada", "concreto", "adoquinada", "afirmada", "empedrada", "tierra", "sin pavimento"];
export const OPT_ACCESOS = [
  "un acceso",
  "dos accesos",
  "tres accesos",
  "acceso peatonal",
  "acceso vehicular y peatonal",
  "sin acceso directo (servidumbre)",
];
export const OPT_AGUA = [
  "sí — red pública de agua potable",
  "sí — pozo propio",
  "sí — cisterna / camión cisterna",
  "no cuenta con agua potable",
];
export const OPT_DESAGUE = [
  "sí — red pública de alcantarillado",
  "sí — pozo séptico / biodigestor",
  "sí — letrina",
  "no cuenta con desagüe",
];
export const OPT_LUZ = [
  "sí — red pública de energía eléctrica",
  "sí — medidor propio",
  "sí — medidor compartido",
  "no cuenta con energía eléctrica",
];
export const OPT_TELEFONIA = [
  "sí — telefonía fija y móvil",
  "sí — telefonía móvil",
  "sí — internet / fibra óptica",
  "no cuenta",
];
export const OPT_FM = [
  { value: "1.00", label: "1.00 — sin mejoramiento" },
  { value: "1.05", label: "1.05 — mejoramiento ligero" },
  { value: "1.10", label: "1.10 — mejoramiento medio" },
  { value: "1.15", label: "1.15 — mejoramiento notable" },
  { value: "1.20", label: "1.20 — mejoramiento sustancial" },
  { value: "0.95", label: "0.95 — deterioro ligero" },
  { value: "0.90", label: "0.90 — deterioro notable" },
];
export const OPT_CIMENTACION = [
  "Zapatas de C°A°",
  "Cimiento corrido de concreto ciclópeo",
  "Cimiento corrido de concreto simple",
  "Platea de cimentación",
  "Pilotes",
  "Sobrecimiento de concreto",
  "Sin cimentación formal",
];
export const OPT_ESTRUCTURAS = [
  "Albañilería confinada",
  "Pórticos de concreto armado",
  "Placas de concreto armado",
  "Albañilería armada",
  "Albañilería simple",
  "Estructura metálica",
  "Adobe / quincha",
  "Madera",
  "Drywall",
];
export const OPT_TECHOS = [
  "Losa aligerada de C°A°",
  "Losa maciza de C°A°",
  "Calamina sobre tijerales de madera",
  "Calamina sobre viguería metálica",
  "Teja sobre madera",
  "Fibrocemento",
  "Sin techo",
];
export const OPT_MUROS = [
  "Albañilería / ladrillo",
  "Placas de concreto",
  "Adobe",
  "Quincha",
  "Drywall",
  "Madera",
  "Pirca",
];
export const OPT_INST_SAN = [
  "Tubería PVC de agua y desagüe",
  "Red empotrada de agua fría y caliente",
  "Agua fría empotrada, desagüe PVC",
  "Pozo séptico",
  "Sin instalaciones sanitarias",
];
export const OPT_INST_ELEC = [
  "Monofásica PVC empotrada",
  "Monofásica sobrepuesta",
  "Trifásica empotrada",
  "Sin instalación eléctrica",
];
export type CompTas = {
  id: string;
  dir: string;
  area: string;
  precio: string;
  zon: string;
  dist: string;
  ub: string;
  ent: string;
  sup: string;
  ser: string;
  fn: string;
};
export type VocTas = { id: string; desc: string; metrado: string; vu: string };
export type PhotoTas = { id: string; slot: string; caption: string; dataUrl: string; titulo?: string };

export function slotNivel(floorId: string) {
  return `nivel-${floorId}`;
}

export function esFotoNivel(slot: string) {
  return slot.startsWith("nivel-");
}

export function fotosDeNivel(photos: PhotoTas[], floorId: string) {
  return photos.filter((p) => p.slot === slotNivel(floorId));
}

export function padImg(n: number) {
  return String(n).padStart(2, "0");
}

/** Título editable, sin el código «Imagen 01.» ni comillas. */
export function tituloFoto(p: PhotoTas) {
  if (p.titulo?.trim()) return p.titulo.trim().replace(/^["«]|["»]$/g, "");
  const m = p.caption.match(/^(?:Imagen|Fig\.)\s*\d+\.\s*"?(.+?)"?\s*$/i);
  return (m?.[1] ?? p.caption).trim();
}

export function leyendaImagen(n: number, titulo: string) {
  const t = titulo.trim() || "Fotografía del inmueble";
  return `Imagen ${padImg(n)}. "${t}"`;
}

/** Numeración corrida de las fotos de arquitectura (todos los pisos). */
export function indiceImagenArquitectura(photos: PhotoTas[], floors: FloorTas[], photoId: string) {
  let n = 0;
  for (const f of floors) {
    for (const p of fotosDeNivel(photos, f.id)) {
      n += 1;
      if (p.id === photoId) return n;
    }
  }
  return n + 1;
}

export type TasacionInput = {
  modo: ModoTas;
  solicitante: string;
  telefono: string;
  tipoBien: string;
  uso: string;
  fecha: string;
  perito: string;
  tc: string;
  direccion: string;
  urb: string;
  region: string;
  provincia: string;
  distrito: string;
  calle: string;
  partida: string;
  gravamenes: string;
  zonificacion: string;
  acciones: string;
  At: string;
  perimetro: string;
  areaLibre: string;
  frente: string;
  nFrentes: string;
  frenteB: string;
  vauB: string;
  frenteC: string;
  vauC: string;
  anios: string;
  material: MaterialTas;
  estado: EstadoTas;
  cimentacion: string;
  estructuras: string;
  techos: string;
  muros: string;
  instSan: string;
  instElec: string;
  acabados1: string;
  acabados2: string;
  nAccesos: string;
  fachada: string;
  lindFrente: string;
  lindDer: string;
  lindIzq: string;
  lindPost: string;
  via: string;
  agua: string;
  desague: string;
  luz: string;
  telefonia: string;
  dPerdida: string;
  dValuac: string;
  dDeprec: string;
  dMant: string;
  dMercado: string;
  tipoLote: TipoLote;
  tablaFd: TablaFd;
  mz: string;
  lote: string;
  tipoUbic: string;
  declaratoria: string;
  hrpu: string;
  tasacionAnt: string;
  docsRef: string;
  fondo: string;
  loteX: string;
  loteY: string;
  pasaA: string;
  manzanaB: string;
  manzanaC: string;
  pasaD: string;
  vatu: string;
  phi: string;
  fm: string;
  vuoZona: VuoZona;
  floors: FloorTas[];
  comps: CompTas[];
  voc: VocTas[];
  photos: PhotoTas[];
};

const EST: EstadoTas[] = ["Muy bueno", "Bueno", "Regular", "Malo"];

/** Tabla Art. II.D.37 RNT — casa-habitación / viviendas / departamentos (%). */
const VIV: Record<number, Record<MaterialTas, [number, number, number, number]>> = {
  5: { Concreto: [0, 5, 10, 55], Ladrillo: [0, 8, 20, 60], "Liviano/Adobe": [5, 15, 30, 65] },
  10: { Concreto: [0, 5, 10, 55], Ladrillo: [3, 11, 23, 63], "Liviano/Adobe": [10, 20, 35, 70] },
  15: { Concreto: [3, 8, 13, 58], Ladrillo: [6, 14, 26, 66], "Liviano/Adobe": [15, 25, 40, 75] },
  20: { Concreto: [6, 11, 16, 61], Ladrillo: [9, 17, 29, 69], "Liviano/Adobe": [20, 30, 45, 80] },
  25: { Concreto: [9, 14, 19, 64], Ladrillo: [12, 20, 32, 72], "Liviano/Adobe": [25, 35, 50, 85] },
  30: { Concreto: [12, 17, 22, 67], Ladrillo: [15, 23, 35, 75], "Liviano/Adobe": [30, 40, 55, 90] },
  35: { Concreto: [15, 20, 25, 67], Ladrillo: [18, 26, 38, 75], "Liviano/Adobe": [35, 45, 60, 90] },
  40: { Concreto: [18, 23, 28, 73], Ladrillo: [21, 29, 41, 81], "Liviano/Adobe": [40, 50, 65, 100] },
  45: { Concreto: [21, 26, 31, 55], Ladrillo: [24, 32, 44, 60], "Liviano/Adobe": [45, 55, 70, 65] },
  50: { Concreto: [24, 29, 34, 55], Ladrillo: [27, 35, 47, 60], "Liviano/Adobe": [50, 60, 75, 65] },
  55: { Concreto: [27, 32, 37, 82], Ladrillo: [30, 38, 50, 90], "Liviano/Adobe": [55, 65, 80, 100] },
};

/** Tabla Art. II.D.37 — tiendas, depósitos, recreación, club, instituciones. */
const COM: Record<number, Record<MaterialTas, [number, number, number, number]>> = {
  5: { Concreto: [0, 5, 10, 55], Ladrillo: [0, 8, 20, 60], "Liviano/Adobe": [7, 17, 32, 67] },
  10: { Concreto: [0, 7, 12, 57], Ladrillo: [4, 12, 24, 64], "Liviano/Adobe": [12, 22, 37, 72] },
  15: { Concreto: [5, 10, 15, 60], Ladrillo: [8, 16, 28, 68], "Liviano/Adobe": [17, 27, 42, 77] },
  20: { Concreto: [8, 13, 18, 63], Ladrillo: [12, 20, 32, 72], "Liviano/Adobe": [22, 32, 47, 82] },
  25: { Concreto: [11, 16, 21, 66], Ladrillo: [16, 24, 36, 76], "Liviano/Adobe": [27, 37, 52, 87] },
  30: { Concreto: [14, 19, 24, 69], Ladrillo: [20, 28, 40, 80], "Liviano/Adobe": [32, 42, 57, 100] },
  35: { Concreto: [17, 22, 27, 72], Ladrillo: [24, 32, 44, 84], "Liviano/Adobe": [37, 47, 62, 100] },
  40: { Concreto: [20, 25, 30, 75], Ladrillo: [28, 36, 48, 88], "Liviano/Adobe": [42, 52, 67, 100] },
  45: { Concreto: [23, 28, 33, 78], Ladrillo: [32, 40, 52, 100], "Liviano/Adobe": [47, 57, 72, 100] },
  50: { Concreto: [26, 31, 36, 81], Ladrillo: [36, 44, 56, 100], "Liviano/Adobe": [52, 62, 77, 100] },
  55: { Concreto: [29, 34, 39, 84], Ladrillo: [40, 48, 60, 100], "Liviano/Adobe": [57, 67, 82, 100] },
};

const TRAMOS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function nStr(s: string, fb = 0) {
  const v = Number(String(s ?? "").replace(",", ".").trim());
  return Number.isFinite(v) ? v : fb;
}

export function moneyUSD(n: number) {
  return `US$ ${fmt(Math.round(n * 100) / 100, 2)}`;
}
export function moneyPEN(n: number) {
  return `S/ ${fmt(Math.round(n * 100) / 100, 2)}`;
}

/** Convierte un monto US$ (redondeado a 2 dec.) a soles con el TC del informe. */
function solesDe(usd: number, tc: number) {
  const u = Math.round(usd * 100) / 100;
  return Math.round(u * tc * 100) / 100;
}

function moneyPENdeUSD(usd: number, tc: number) {
  return `S/ ${fmt(solesDe(usd, tc), 2)}`;
}

const UNID = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const DECE = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const ESPE = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
const CENT = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function trescientos(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (c) parts.push(CENT[c]);
  if (r === 0) return parts.join(" ");
  if (r < 10) parts.push(UNID[r]);
  else if (r < 20) parts.push(ESPE[r - 10]);
  else if (r < 30) {
    parts.push(
      r === 20
        ? "VEINTE"
        : ["VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"][r - 21]
    );
  } else {
    const d = Math.floor(r / 10);
    const u = r % 10;
    parts.push(DECE[d]);
    if (u) parts.push("Y", UNID[u]);
  }
  return parts.join(" ");
}

export function n2usd(n: number) {
  const entero = Math.floor(Math.abs(n) + 1e-9);
  const cents = Math.round((Math.abs(n) - entero) * 100);
  const mill = Math.floor(entero / 1_000_000);
  const mil = Math.floor((entero % 1_000_000) / 1000);
  const res = entero % 1000;
  const bits: string[] = [];
  if (mill === 1) bits.push("UN MILLÓN");
  else if (mill > 1) bits.push(`${trescientos(mill)} MILLONES`);
  if (mil === 1) bits.push("MIL");
  else if (mil > 1) bits.push(`${trescientos(mil)} MIL`);
  if (res) bits.push(trescientos(res));
  if (!bits.length) bits.push("CERO");
  return `SON ${bits.join(" ")} ${String(cents).padStart(2, "0")}/100 DÓLARES AMERICANOS`;
}

export function fdRnt(anios: number, material: MaterialTas, estado: EstadoTas, tabla: TablaFd = "vivienda") {
  const tramo = TRAMOS.find((t) => anios <= t) ?? 55;
  const src = tabla === "comercio" ? COM : VIV;
  const row = src[tramo][material];
  const i = EST.indexOf(estado);
  return row[i < 0 ? 2 : i] / 100;
}

export function vtArt19(At: number, frente: number, vau: number) {
  const tresA2 = 3 * frente * frente;
  const plena = Math.min(At, tresA2);
  const exceso = Math.max(0, At - tresA2);
  const vtPlena = plena * vau;
  const vtExceso = exceso * 0.5 * vau;
  return { tresA2, plena, exceso, vtPlena, vtExceso, vt: vtPlena + vtExceso };
}

export function homologar(comps: CompTas[]) {
  const rows = comps
    .map((c) => {
      const area = nStr(c.area);
      const precio = nStr(c.precio);
      const vut = area > 0 ? precio / area : 0;
      const fz = nStr(c.zon, 1);
      const fd = nStr(c.dist, 1);
      const fu = nStr(c.ub, 1);
      const fe = nStr(c.ent, 1);
      const fs = nStr(c.sup, 1);
      const fser = nStr(c.ser, 1);
      const fn = nStr(c.fn, 1);
      const f = fz * fd * fu * fe * fs * fser * fn;
      return { ...c, area, precio, vut, f, vutH: vut * (f || 1) };
    })
    .filter((r) => r.vut > 0);
  const vau = rows.length ? rows.reduce((s, r) => s + r.vutH, 0) / rows.length : 0;
  return { rows, vau };
}

export const TAS_DEFAULTS: TasacionInput = {
  modo: "vivienda",
  solicitante: "GUEVARA CASTILLO NOE Y GUEVARA ELENA SHERLY",
  telefono: "+51 977747979",
  tipoBien: "INMUEBLE",
  uso: "Vivienda Unifamiliar",
  fecha: "21 de noviembre de 2024",
  perito: "VITALIANO BALLENA BANCES",
  tc: "3.80",
  direccion: "Urb. La Victoria Primer Sector Mz 39 Lote 4",
  urb: "Urb. La Victoria Primer Sector",
  region: "Lambayeque",
  provincia: "Chiclayo",
  distrito: "La Victoria",
  calle: "Paul Harris",
  partida: "P10011906",
  gravamenes: "No",
  zonificacion: "Residencial Densidad Alta Tipo 1 — RDA-1",
  acciones: "100",
  At: "111.70",
  perimetro: "63.87",
  areaLibre: "0",
  frente: "4.00",
  nFrentes: "1",
  frenteB: "0",
  vauB: "0",
  frenteC: "0",
  vauC: "0",
  anios: "46",
  material: "Concreto",
  estado: "Regular",
  cimentacion: "Zapatas de C°A°",
  estructuras: "Albañilería confinada",
  techos: "Losa aligerada de C°A°",
  muros: "Albañilería / ladrillo",
  instSan: "Tubería PVC de agua y desagüe",
  instElec: "Monofásica PVC empotrada",
  acabados1: "Piso porcelanato / cerámico, muros de ladrillo, tarrajeo, pintura, losa aligerada.",
  acabados2: "Piso cerámico, muros de ladrillo, tarrajeo, pintura, losa aligerada.",
  nAccesos: "un acceso",
  fachada: "Cercado en todo su perímetro; el frente principal colinda con la calle Paul Harris.",
  lindFrente: "Por el frente, hacia el norte, con la calle Paul Harris.",
  lindDer: "Por el lindero derecho, con propiedad de terceros.",
  lindIzq: "Por el lindero izquierdo, con propiedad de terceros.",
  lindPost: "Por el lindero posterior, hacia el oeste, con propiedad de terceros.",
  via: "asfaltada",
  agua: "sí — red pública de agua potable",
  desague: "sí — red pública de alcantarillado",
  luz: "sí — red pública de energía eléctrica",
  telefonia: "sí — telefonía fija y móvil",
  dPerdida: "2.00",
  dValuac: "0.20",
  dDeprec: "4.00",
  dMant: "2.00",
  dMercado: "11.80",
  tipoLote: "1frente",
  tablaFd: "vivienda",
  mz: "39",
  lote: "4",
  tipoUbic: "urbana",
  declaratoria: "No se exhibe",
  hrpu: "No se exhibe",
  tasacionAnt: "No se exhibe",
  docsRef: "Partida electrónica y documentación proporcionada por el solicitante.",
  fondo: "27.92",
  loteX: "6",
  loteY: "16",
  pasaA: "3",
  manzanaB: "35",
  manzanaC: "40",
  pasaD: "18",
  vatu: "",
  phi: "0.90",
  fm: "1.00",
  vuoZona: "costa",
  floors: [
    {
      id: "p1",
      nombre: "1° nivel",
      area: "83.78",
      vu: "380",
      categVuo: "C",
      ambientes: "Sala de recepción, lavandería, patio, tendal, sala, comedor, hall, baño, cocina y escalera al nivel superior.",
    },
    {
      id: "p2",
      nombre: "2° nivel",
      area: "83.78",
      vu: "380",
      categVuo: "C",
      ambientes: "Depósito, dormitorio 01, hall, dos baños, dormitorio principal, estar TV y escalera.",
    },
  ],
  comps: [
    { id: "c1", dir: "Calle Paul Harris N° 840", area: "210", precio: "200000", zon: "1.00", dist: "1.00", ub: "1.00", ent: "1.00", sup: "1.00", ser: "1.00", fn: "0.95" },
    { id: "c2", dir: "Calle Paul Harris N° 854", area: "224", precio: "160000", zon: "1.00", dist: "1.00", ub: "1.00", ent: "1.00", sup: "1.00", ser: "1.00", fn: "0.95" },
    { id: "c3", dir: "Calle Toparca N° 343", area: "210", precio: "150000", zon: "1.00", dist: "1.09", ub: "1.00", ent: "1.00", sup: "1.00", ser: "1.00", fn: "0.95" },
  ],
  voc: [{ id: "v1", desc: "Cerco perimétrico / portón", metrado: "1", vu: "400" }],
  photos: [
    { id: "f1", slot: "ubicacion", caption: "Fig. 01. Ubicación en Google Maps o plano de ubicación.", dataUrl: "" },
    { id: "f2", slot: "zonificacion", caption: "Fig. 02. Mapa de zonificación del plan de desarrollo urbano.", dataUrl: "" },
    { id: "f3", slot: "fachada", caption: "Fig. 03. Fachada principal del inmueble.", dataUrl: "" },
    { id: "f4", slot: "entorno", caption: "Fig. 04. Entorno del predio.", dataUrl: "" },
    { id: "f5", slot: "interior", caption: "Fig. 05. Ambientes interiores.", dataUrl: "" },
    {
      id: "n1a",
      slot: "nivel-p1",
      titulo: "Ambientes interiores del 1° nivel",
      caption: 'Imagen 01. "Ambientes interiores del 1° nivel"',
      dataUrl: "",
    },
    {
      id: "n2a",
      slot: "nivel-p2",
      titulo: "Ambientes interiores del 2° nivel",
      caption: 'Imagen 02. "Ambientes interiores del 2° nivel"',
      dataUrl: "",
    },
  ],
};

function svauPasadizo(vatu: number, a: number, d: number) {
  const fa = a / 3 >= 1 ? 1 : a / 3;
  const calc = vatu * fa * (1 - 0.01 * d);
  const floor = 0.5 * vatu;
  const svau = calc < floor ? floor : calc;
  return { fa, calc, floor, svau, ok: calc >= floor };
}

export function calcTerreno(inp: TasacionInput, vau: number, At: number, frente: number) {
  const tipo: TipoLote = inp.tipoLote || (inp.nFrentes === "3" ? "3frentes" : inp.nFrentes === "2" ? "2frentes" : "1frente");
  const depto = /departamento/i.test(inp.uso);
  const art = vtArt19(At, frente, vau);
  const rows: string[][] = [];
  let VT = art.vt;
  let vtNota = `Art. 19 RNT — triple cuadrado del frente: 3a² = ${fmt(art.tresA2, 2)} m². Área a 100 % VAU = ${fmt(art.plena, 2)} m²; exceso a 50 % = ${fmt(art.exceso, 2)} m².`;

  if (depto && (tipo === "1frente" || tipo === "acuatico")) {
    VT = At * vau;
    vtNota = "Departamento: no se aplica remanente del Art. 19. VT = At × VAU.";
    rows.push(["Departamento (At × VAU)", fmt(At, 2), "100", fmt(VT, 2)]);
    return { tipo, art, VT, vtNota, rows };
  }

  if (tipo === "2frentes") {
    const aB = nStr(inp.frenteB, frente);
    const vauB = nStr(inp.vauB, vau);
    const sum = frente + aB || 1;
    const fA = Math.round((frente / sum) * 100) / 100;
    const fB = Math.round((aB / sum) * 100) / 100;
    const propA = vtArt19(At * fA, frente, vau);
    const propB = vtArt19(At * fB, aB, vauB);
    const uniA = vtArt19(At, frente, vau);
    const uniB = vtArt19(At, aB, vauB);
    VT = Math.max(propA.vt, propB.vt, uniA.vt, uniB.vt);
    vtNota = `Dos frentes: se valúa por área proporcional a cada frente y como frente único. Se adopta el mayor VTT (${moneyUSD(VT)}).`;
    rows.push(
      [`Proporcional frente A (${fmt(fA * 100, 0)} %)`, fmt(At * fA, 2), "—", fmt(propA.vt, 2)],
      [`Proporcional frente B (${fmt(fB * 100, 0)} %)`, fmt(At * fB, 2), "—", fmt(propB.vt, 2)],
      ["Frente único A (todo el lote)", fmt(At, 2), "—", fmt(uniA.vt, 2)],
      ["Frente único B (todo el lote)", fmt(At, 2), "—", fmt(uniB.vt, 2)],
      ["Valor adoptado (máximo)", fmt(At, 2), "—", fmt(VT, 2)]
    );
  } else if (tipo === "3frentes") {
    const aB = nStr(inp.frenteB, 0);
    const aC = nStr(inp.frenteC, 0);
    const sum = frente + aB + aC || 1;
    const vauB = nStr(inp.vauB, vau);
    const vauC = nStr(inp.vauC, vau);
    const fA = Math.round((frente / sum) * 100) / 100;
    const fB = Math.round((aB / sum) * 100) / 100;
    const fC = Math.round((aC / sum) * 100) / 100;
    const pA = vtArt19(At * fA, frente, vau);
    const pB = vtArt19(At * fB, aB, vauB);
    const pC = vtArt19(At * fC, aC, vauC);
    const sumProp = pA.vt + pB.vt + pC.vt;
    const uA = vtArt19(At, frente, vau);
    const uB = vtArt19(At, aB, vauB);
    const uC = vtArt19(At, aC, vauC);
    VT = Math.max(sumProp, uA.vt, uB.vt, uC.vt);
    vtNota = `Tres frentes: suma de áreas proporcionales vs. cada frente único. Se adopta el mayor VTT (${moneyUSD(VT)}).`;
    rows.push(
      ["Suma proporcional A+B+C", fmt(At, 2), "—", fmt(sumProp, 2)],
      ["Frente único A", fmt(At, 2), "—", fmt(uA.vt, 2)],
      ["Frente único B", fmt(At, 2), "—", fmt(uB.vt, 2)],
      ["Frente único C", fmt(At, 2), "—", fmt(uC.vt, 2)],
      ["Valor adoptado (máximo)", fmt(At, 2), "—", fmt(VT, 2)]
    );
  } else if (tipo === "pasadizo") {
    const x = nStr(inp.loteX);
    const y = nStr(inp.loteY);
    const a = nStr(inp.pasaA);
    const b = nStr(inp.manzanaB);
    const c = nStr(inp.manzanaC);
    const d = nStr(inp.pasaD);
    const vatu = nStr(inp.vatu, vau);
    const s = svauPasadizo(vatu, a, d);
    const vade = vtArt19(x * y, x, s.svau);
    const vapcP = vtArt19(a * (d + x), a, vatu);
    const den = b * c - a * (d + x);
    const coef = den > 0 ? (x * y) / den : 0;
    const vapc = coef * vapcP.vt;
    VT = vade.vt + vapc;
    vtNota = `Pasadizo común: SVAU = VATU × mín(1, a/3) × (1 − 0.01d) ≥ 0.50 VATU → ${fmt(s.svau, 2)} US$/m². VADE + VAPC proporcional.`;
    rows.push(
      ["SVAU adoptado", "—", "—", fmt(s.svau, 2) + " US$/m²"],
      ["VADE (dominio exclusivo x·y)", fmt(x * y, 2), "—", fmt(vade.vt, 2)],
      ["VAPC parcial (pasaje a(d+x))", fmt(a * (d + x), 2), "—", fmt(vapcP.vt, 2)],
      [`VAPC × coeficiente ${fmt(coef, 3)}`, "—", "—", fmt(vapc, 2)],
      ["VTT = VADE + VAPC", fmt(x * y, 2), "—", fmt(VT, 2)]
    );
  } else if (tipo === "servidumbre") {
    const x = nStr(inp.loteX);
    const a = nStr(inp.pasaA);
    const b = nStr(inp.manzanaB);
    const c = nStr(inp.manzanaC);
    const d = nStr(inp.pasaD);
    const vatu = nStr(inp.vatu, vau);
    const s = svauPasadizo(vatu, a, d);
    const svau1 = 0.8 * s.svau;
    const vade = vtArt19(x * b, b, svau1);
    const vapcP = vtArt19(a * d, a, vatu);
    const den = b * c - a * d;
    const coef = den > 0 ? (x * b) / den : 0;
    const vapc = coef * vapcP.vt;
    VT = vade.vt + vapc;
    vtNota = `Servidumbre: SVAU1 = 0.80 × SVAU = ${fmt(svau1, 2)} US$/m² (mín. 0.40 VATU). VADE sobre x·b + VAPC de a·d.`;
    rows.push(
      ["SVAU / SVAU1 (×0.80)", "—", "—", `${fmt(s.svau, 2)} / ${fmt(svau1, 2)}`],
      ["VADE (x·b)", fmt(x * b, 2), "—", fmt(vade.vt, 2)],
      ["VAPC parcial (a·d)", fmt(a * d, 2), "—", fmt(vapcP.vt, 2)],
      [`VAPC × coeficiente ${fmt(coef, 3)}`, "—", "—", fmt(vapc, 2)],
      ["VTT = VADE + VAPC", "—", "—", fmt(VT, 2)]
    );
  } else if (tipo === "restriccion") {
    const b = nStr(inp.manzanaB, nStr(inp.fondo, frente));
    const d = nStr(inp.pasaD, nStr(inp.fondo));
    const vatu = nStr(inp.vatu, vau);
    const phi = nStr(inp.phi, 0.9);
    const base = vtArt19(b * d, b, vatu);
    VT = base.vt * phi;
    vtNota = `Restricción por servidumbre: VTT = Art. 19 (b·d) × Φ. Φ = ${fmt(phi, 2)}.`;
    rows.push(
      ["Área b·d a VAU", fmt(b * d, 2), "100/50", fmt(base.vt, 2)],
      [`Castigo Φ = ${fmt(phi, 2)}`, "—", "—", fmt(VT, 2)]
    );
  } else {
    rows.push(
      ["Área a 100 % VAU (hasta 3a²)", fmt(art.plena, 2), "100", fmt(art.vtPlena, 2)],
      ["Exceso (50 % VAU)", fmt(art.exceso, 2), "50", fmt(art.vtExceso, 2)],
      ["Valor total del terreno", fmt(At, 2), "—", fmt(VT, 2)]
    );
    if (tipo === "acuatico") {
      vtNota = `Terreno en tierra firme y medio acuático: se aplica Art. 19 sobre a·b con VAU de la franja en tierra. ${vtNota}`;
    }
  }

  return { tipo, art, VT, vtNota, rows };
}

export function calcTasacion(inp: TasacionInput) {
  const tc = nStr(inp.tc, 3.8);
  const At = nStr(inp.At, 0);
  const frente = nStr(inp.frente, 0);
  const anios = nStr(inp.anios, 0);
  const fd = fdRnt(anios, inp.material, inp.estado, inp.tablaFd || "vivienda");
  const homo = homologar(inp.comps);
  const vau = homo.vau || 640;
  const terr = calcTerreno(inp, vau, At, frente);
  const art = terr.art;
  const VT = terr.VT;
  const vtNota = terr.vtNota;

  const floors = inp.floors.map((f) => {
    const area = nStr(f.area);
    const vu = nStr(f.vu);
    const vsn = area * vu;
    const ve = vsn * (1 - fd);
    return { ...f, area, vu, vsn, ve };
  });
  const VSN = floors.reduce((s, f) => s + f.vsn, 0);
  const VE = floors.reduce((s, f) => s + f.ve, 0);
  const voc = inp.voc.map((v) => {
    const m = nStr(v.metrado);
    const vu = nStr(v.vu);
    return { ...v, m, vu, val: m * vu * (1 - fd) };
  });
  const VOC = voc.reduce((s, v) => s + v.val, 0);
  const VOCbruto = voc.reduce((s, v) => s + v.m * v.vu, 0);
  const areaTech = floors.reduce((s, f) => s + f.area, 0);
  const areaLibre = Math.max(0, At - (floors[0]?.area ?? 0));

  const d1 = nStr(inp.dPerdida) / 100;
  const d2 = nStr(inp.dValuac) / 100;
  const d3 = nStr(inp.dDeprec) / 100;
  const d4 = nStr(inp.dMant) / 100;
  const d5 = nStr(inp.dMercado) / 100;
  const dTot = d1 + d2 + d3 + d4 + d5;
  const fm = nStr(inp.fm, 1);

  const vivienda = inp.modo === "vivienda";
  const VEaj = VE * fm;
  const VOCaj = VOC * fm;
  const VSNtot = VSN + VOCbruto;
  const VC = VT + (vivienda ? VEaj + VOCaj : 0);
  const VRM = VC * (1 - dTot);
  const acciones = nStr(inp.acciones, 100) / 100;
  const VCprop = VC * acciones;
  const VRMprop = VRM * acciones;

  return {
    tc,
    At,
    frente,
    anios,
    fd,
    vau,
    homo,
    art,
    vtNota,
    terr,
    VT,
    floors,
    VSN,
    VE,
    VEaj,
    voc,
    VOC,
    VOCaj,
    VOCbruto,
    VSNtot,
    fm,
    areaTech,
    areaLibre,
    dTot,
    VC,
    VRM,
    VCprop,
    VRMprop,
    acciones,
    vivienda,
  };
}

function photoBlocks(
  photos: PhotoTas[],
  slot: string,
  placeholder = "Inserte la fotografía en el recuadro",
  opts?: { numberedFrom?: number; fallback?: boolean; fallbackTitulo?: string }
): Block[] {
  const list = photos.filter((p) => p.slot === slot);
  if (!list.length) {
    if (!opts?.fallback) return [];
    const n = opts.numberedFrom ?? 1;
    return [{ type: "photo", src: "", caption: leyendaImagen(n, opts.fallbackTitulo ?? "Ambientes interiores"), placeholder }];
  }
  return list.map((p, i) => ({
    type: "photo" as const,
    src: p.dataUrl,
    caption: opts?.numberedFrom != null ? leyendaImagen(opts.numberedFrom + i, tituloFoto(p)) : p.caption,
    placeholder,
  }));
}

export function informeTasacion(inp: TasacionInput): MemoriaDoc {
  const r = calcTasacion(inp);
  const pct = fmt(nStr(inp.acciones, 100), 0);
  const veVoc = r.VEaj + r.VOCaj;
  const finalidad = `El objetivo del presente informe de tasación es determinar el Valor Comercial y de Realización del ${pct} % de los activos para la determinación del precio mínimo a ser tomado en cuenta por ${inp.solicitante}, de conformidad con el Reglamento Nacional de Tasaciones del Perú vigente, aprobado mediante la Resolución Ministerial N° 172-2016-Vivienda, modificado con R.M. N° 424-2017-Vivienda, y las pautas de la SBS (Res. SBS N° 880-97 y modificatorias).`;

  const blocks: Block[] = [
    {
      type: "cover",
      kicker: "Informe de tasación · RNT del Perú",
      titulo: "Informe de tasación",
      subtitulo: `${inp.uso} · ${inp.direccion}`,
      meta: [
        { k: "Solicitante", v: inp.solicitante },
        { k: "Tipo de bien", v: inp.tipoBien },
        { k: "Uso actual", v: inp.uso },
        { k: "Teléfono", v: inp.telefono },
        { k: "Fecha de tasación", v: inp.fecha },
        { k: "Tipo de cambio", v: `1 US$ = S/ ${fmt(r.tc, 2)}` },
        { k: "Participación valuada", v: `${pct} %` },
        { k: "Perito tasador", v: inp.perito },
      ],
    },
    {
      type: "kpis",
      items: r.vivienda
        ? [
            { label: "Valor comercial", value: moneyUSD(r.VCprop), hint: moneyPENdeUSD(r.VCprop, r.tc) },
            { label: "Valor de realización", value: moneyUSD(r.VRMprop), hint: moneyPENdeUSD(r.VRMprop, r.tc) },
            { label: "Valor del terreno", value: moneyUSD(r.VT), hint: `${fmt(r.At, 2)} m²` },
            { label: "Edificación + VOC", value: moneyUSD(veVoc), hint: `${fmt(r.areaTech, 2)} m² techados` },
          ]
        : [
            { label: "Valor comercial", value: moneyUSD(r.VCprop), hint: moneyPENdeUSD(r.VCprop, r.tc) },
            { label: "Valor de realización", value: moneyUSD(r.VRMprop), hint: moneyPENdeUSD(r.VRMprop, r.tc) },
            { label: "Valor del terreno", value: moneyUSD(r.VT), hint: `${fmt(r.At, 2)} m²` },
            { label: "Participación", value: `${pct} %`, hint: TIPO_LOTE_LABEL[r.terr.tipo] },
          ],
    },
    { type: "h2", text: "Cuadro resumen de valores" },
    {
      type: "table",
      variant: "valores",
      headers: r.vivienda
        ? ["Descripción", "VT US$", "VE+VOC US$", "V Comercial US$", "VSNuevo US$", "VRM US$"]
        : ["Descripción", "VT US$", "V Comercial US$", "VRM US$"],
      rows: r.vivienda
        ? [
            [inp.tipoBien, fmt(r.VT, 2), fmt(veVoc, 2), fmt(r.VC, 2), fmt(r.VSNtot, 2), fmt(r.VRM, 2)],
            [`Participación ${pct} %`, "—", "—", fmt(r.VCprop, 2), "—", fmt(r.VRMprop, 2)],
            ["TOTAL (dólares americanos)", fmt(r.VT, 2), fmt(veVoc, 2), fmt(r.VCprop, 2), fmt(r.VSNtot, 2), fmt(r.VRMprop, 2)],
            [
              "TOTAL (soles)",
              fmt(solesDe(r.VT, r.tc), 2),
              fmt(solesDe(veVoc, r.tc), 2),
              fmt(solesDe(r.VCprop, r.tc), 2),
              fmt(solesDe(r.VSNtot, r.tc), 2),
              fmt(solesDe(r.VRMprop, r.tc), 2),
            ],
          ]
        : [
            [inp.tipoBien, fmt(r.VT, 2), fmt(r.VC, 2), fmt(r.VRM, 2)],
            [`Participación ${pct} %`, "—", fmt(r.VCprop, 2), fmt(r.VRMprop, 2)],
            ["TOTAL (dólares)", fmt(r.VT, 2), fmt(r.VCprop, 2), fmt(r.VRMprop, 2)],
            [
              "TOTAL (soles)",
              fmt(solesDe(r.VT, r.tc), 2),
              fmt(solesDe(r.VCprop, r.tc), 2),
              fmt(solesDe(r.VRMprop, r.tc), 2),
            ],
          ],
    },
    { type: "h2", text: "Ficha del inmueble" },
    {
      type: "table",
      variant: "text",
      headers: ["Dato", "Valor"],
      rows: [
        ["Tipo / uso", `${inp.tipoBien} / ${inp.uso}`],
        ["Ubicación", `${inp.direccion}, ${inp.distrito}`],
        ["Área terreno", `${fmt(r.At, 2)} m²`],
        ...(r.vivienda
          ? [
              ["Área construida", `${fmt(r.areaTech, 2)} m²`],
              ["Número de pisos", `${inp.floors.length}`],
              ["Antigüedad", `${fmt0(r.anios)} años`],
              ["Material predominante", inp.material],
              ["Estado actual", inp.estado],
              ["Declaratoria de fábrica", inp.declaratoria],
            ]
          : []),
        ["Gravámenes", inp.gravamenes],
        ["Zonificación", inp.zonificacion],
        ["Tipo de lote (RNT)", TIPO_LOTE_LABEL[r.terr.tipo]],
        ["Perito responsable", inp.perito],
      ],
    },
    { type: "h2", text: "1. Objetivo de la tasación" },
    { type: "h3", text: "1.1 Finalidad" },
    { type: "p", text: finalidad },
    { type: "h3", text: "1.2 Instrucciones recibidas" },
    {
      type: "p",
      text: "Recibimos por encargo del cliente, las instrucciones para realizar la valuación del inmueble y se contó con la debida autorización correspondiente por parte del cliente para la inspección al inmueble.",
    },
    { type: "h3", text: "1.3 Detalle de la labor realizada" },
    {
      type: "p",
      text: `Se realizó la valuación a fecha ${inp.fecha}, y se recopiló, evaluó y analizó la documentación administrativa-legal y registral proporcionada, que se precisa en el ítem 2.10 (documentación sustentatoria).`,
    },
    { type: "h2", text: "2. Datos del inmueble" },
    { type: "h3", text: "2.1 Ubicación" },
    {
      type: "p",
      text: `El presente inmueble de ${inp.uso} está emplazado en ${inp.direccion} — región ${inp.region} — provincia ${inp.provincia} — distrito ${inp.distrito}. Frente principal: ${inp.calle}.`,
    },
    ...photoBlocks(inp.photos, "ubicacion", "FOTO DE UBICACIÓN DEL BIEN INMUEBLE, GOOGLE MAPS O PLANO DE UBICACIÓN"),
    { type: "h3", text: "2.2 Descripción" },
    { type: "p", text: `La ${inp.uso} ${inp.fachada}` },
    { type: "h3", text: "2.3 Uso actual del inmueble" },
    { type: "p", text: inp.uso },
    { type: "h3", text: "2.4 Inscripción en los Registros Públicos" },
    {
      type: "p",
      text: `Inscrito en los Registros Públicos de ${inp.provincia} en la Ficha Registral N° ${inp.partida}. Gravámenes y cargas: ${inp.gravamenes}.`,
    },
    { type: "h3", text: "2.5 Infraestructura de servicios urbanos" },
    {
      type: "p",
      text: `El predio posee por el frente principal en la ${inp.calle} una vía ${inp.via}. El inmueble tiene conexión a ${inp.agua}, ${inp.desague}, y posee servicios de luz (${inp.luz}) y telefonía (${inp.telefonia}). Accesos: ${inp.nAccesos}.`,
    },
    { type: "h3", text: "2.6 Área del terreno" },
    {
      type: "p",
      text: `Área del terreno: ${fmt(r.At, 2)} m². Perímetro: ${fmt(nStr(inp.perimetro), 2)} ml.${r.vivienda ? ` Área techada: ${fmt(r.areaTech, 2)} m².` : ""} Frente: ${fmt(r.frente, 2)} m. Fondo: ${fmt(nStr(inp.fondo), 2)} m.`,
    },
    { type: "p", text: "Nota: según ficha registral." },
    { type: "p", text: `Zonificación: ${inp.zonificacion}.` },
    ...photoBlocks(inp.photos, "zonificacion", "FOTO DE ZONIFICACIÓN DEL BIEN INMUEBLE"),
    { type: "h3", text: "2.7 Linderos" },
    {
      type: "kv",
      rows: [
        { k: "Frente", v: inp.lindFrente },
        { k: "Derecho", v: inp.lindDer },
        { k: "Izquierdo", v: inp.lindIzq },
        { k: "Posterior", v: inp.lindPost },
      ],
    },
  ];

  if (r.vivienda) {
    blocks.push({ type: "h3", text: "2.8 Distribución" });
    blocks.push({
      type: "p",
      text: `La ${inp.uso} de ${inp.floors.length} nivel(es), los cuales se especifican a continuación.`,
    });
    let nImg = 1;
    inp.floors.forEach((f) => {
      blocks.push({ type: "h3", text: `Arquitectura — ${f.nombre}` });
      blocks.push({ type: "p", text: `${f.ambientes} Área techada de este nivel: ${fmt(nStr(f.area), 2)} m².` });
      const nFotos = fotosDeNivel(inp.photos, f.id).length;
      blocks.push(
        ...photoBlocks(inp.photos, slotNivel(f.id), `FOTO DE AMBIENTES — ${f.nombre.toUpperCase()}`, {
          numberedFrom: nImg,
          fallback: true,
          fallbackTitulo: `Ambientes interiores del ${f.nombre}`,
        })
      );
      nImg += Math.max(1, nFotos);
    });
    blocks.push({ type: "h3", text: "2.9 Especificaciones técnicas" });
    blocks.push({ type: "h3", text: "2.9.1 Edificaciones" });
    blocks.push({
      type: "p",
      text: "El inmueble se ha construido mayoritariamente con las siguientes características técnicas:",
    });
    blocks.push({
      type: "kv",
      rows: [
        { k: "Cimentación", v: inp.cimentacion },
        { k: "Estructuras", v: inp.estructuras },
        { k: "Techos", v: inp.techos },
        { k: "Muros", v: inp.muros },
        { k: "Instalaciones sanitarias", v: inp.instSan },
        { k: "Instalaciones eléctricas", v: inp.instElec },
        { k: "Acabados 1° nivel", v: inp.acabados1 },
        { k: "Acabados otros niveles", v: inp.acabados2 },
      ],
    });
    blocks.push({ type: "h3", text: "2.9.2 Áreas construidas" });
    blocks.push({
      type: "p",
      text: `Las edificaciones constan de las siguientes áreas construidas. El valor unitario de construcción se sustenta en el Cuadro de Valores Unitarios Oficiales de Edificación (${VUO_NORMA}, ${VUO_ZONA_META[inp.vuoZona ?? "costa"].anexo} — ${VUO_ZONA_META[inp.vuoZona ?? "costa"].label}, ${VUO_VIGENCIA}). El VU/m² es la suma de las siete partidas según la categoría predominante de cada rubro (muros y columnas, techos, pisos, puertas y ventanas, revestimientos, baños e instalaciones eléctricas y sanitarias). En categorías A y D no se suma la columna de techos. El VU adoptado para la tasación es editable y puede diferir del oficial si el perito usa valor de mercado.`,
    });
    const zona = inp.vuoZona ?? "costa";
    blocks.push({
      type: "table",
      variant: "wide",
      caption: `Valores unitarios oficiales · 7 partidas · ${VUO_NORMA}`,
      headers: [
        "Nivel",
        "1. Muros",
        "2. Techos",
        "3. Pisos",
        "4. P/V",
        "5. Revest.",
        "6. Baños",
        "7. Inst. E/S",
        "VU of. S/m²",
        "VU adopt. US$/m²",
      ],
      rows: r.floors.map((f) => {
        const cats = catsDePiso(f);
        const tot = totalVuoSol(zona, cats, !!f.plus5);
        return [
          f.nombre,
          ...VUO_RUBROS.map((rubro) => {
            if (rubro === "techos" && omiteTechos(cats.muros)) return `${cats.muros} —`;
            return `${cats[rubro]} ${fmt(celdaVuo(zona, cats[rubro], rubro).valor, 2)}`;
          }),
          `${fmt(tot, 2)}${f.plus5 ? " (+5 %)" : ""}`,
          fmt(f.vu, 2),
        ];
      }),
    });
    inp.floors.forEach((f) => {
      const cat = (f.categVuo ?? "C") as CategVuo;
      const cats = catsDePiso(f);
      blocks.push({
        type: "p",
        text: `${f.nombre}: ${tituloCategVuo(cat)}. Área techada ${fmt(nStr(f.area), 2)} m².${f.plus5 ? " Se aplica +5 % desde el 5.° piso." : ""}`,
      });
      blocks.push({
        type: "kv",
        rows: VUO_RUBROS.map((rubro) => ({
          k: VUO_RUBRO_LABEL[rubro],
          v:
            rubro === "techos" && omiteTechos(cats.muros)
              ? `${cats.muros} · No se suma (la categoría de muros ya incluye el techo).`
              : `${cats[rubro]} · ${celdaVuo(zona, cats[rubro], rubro).desc}`,
        })),
      });
    });
    blocks.push({ type: "h3", text: "2.9.3 Antigüedad y estado de conservación" });
    blocks.push({
      type: "p",
      text: `De conformidad con el RNT y la tabla del Art. II.D.37 (${inp.tablaFd === "comercio" ? "tiendas, depósitos e instituciones" : "casa-habitación, viviendas y departamentos"}), para ${fmt0(r.anios)} años, material ${inp.material} y estado ${inp.estado}, corresponde FD = ${fmt(r.fd * 100, 1)} %.`,
    });
  }

  blocks.push(
    { type: "h3", text: "2.10 Documentación" },
    {
      type: "p",
      text: `Se contó con la siguiente documentación del inmueble: ${inp.docsRef} Partida electrónica N° ${inp.partida}. HR/PU: ${inp.hrpu}. Tasación anterior: ${inp.tasacionAnt}. Declaratoria de fábrica: ${inp.declaratoria}.`,
    },
    { type: "h3", text: "2.11 Gravámenes" },
    { type: "p", text: inp.gravamenes },
    { type: "h2", text: "3. Reglamentación empleada" },
    {
      type: "p",
      text: "La presente valuación se efectúa en concordancia con lo dispuesto en el Reglamento Nacional de Tasaciones del Perú R.M. N° 172-2016-Vivienda, que consiste en la determinación del valor de todos sus componentes, en términos de terreno, edificaciones, obras complementarias y valores intangibles, aplicándosele a los valores físicos, según el caso, los factores de depreciación (FD) por antigüedad y estado de conservación correspondientes.",
    },
    { type: "h2", text: "4. Deducciones para el valor de realización" },
    {
      type: "p",
      text: "El Valor de Realización en el Mercado es el valor neto del inmueble que se esperaría recuperar como consecuencia de la eventual venta del bien, en la situación como está, descontando los castigos y cargos por los conceptos indicados a continuación:",
    },
    {
      type: "table",
      headers: ["Concepto", "%"],
      rows: [
        ["Gastos por pérdida y deterioro", fmt(nStr(inp.dPerdida), 2)],
        ["Gastos de valuación para realización", fmt(nStr(inp.dValuac), 2)],
        ["Depreciación durante la ejecución", fmt(nStr(inp.dDeprec), 2)],
        ["Mantenimiento", fmt(nStr(inp.dMant), 2)],
        ["Ajuste de mercado (plazo ~180 días)", fmt(nStr(inp.dMercado), 2)],
        ["TOTAL deducciones", fmt(r.dTot * 100, 2)],
      ],
    },
    { type: "note", text: "NOTA: La entidad considerará las deducciones de su conocimiento, para así obtener un valor de realización final." },
    { type: "h2", text: "5. Valuación" },
    { type: "h3", text: `5.1 Valor del terreno (VT) — ${TIPO_LOTE_LABEL[r.terr.tipo]}` },
    {
      type: "p",
      text: "El análisis de los valores comerciales del mercado inmobiliario de compra-venta de terrenos similares en cuanto a ubicación, forma, servicios y entorno urbano, permite determinar el valor comercial unitario del terreno.",
    },
    {
      type: "table",
      variant: "text",
      caption: "Ubicación de terrenos comparables",
      headers: ["Inmueble", "Área m²", "Precio US$", "VUT US$/m²"],
      rows: r.homo.rows.map((c) => [c.dir, fmt(c.area, 2), fmt(c.precio, 0), fmt(c.vut, 2)]),
    },
    {
      type: "table",
      variant: "wide",
      caption: "Homologación de valores unitarios",
      headers: ["Inmueble", "Ub", "Ent", "Sup", "Ser", "Zon", "Dist", "FN", "F", "VUT homol."],
      rows: r.homo.rows.map((c) => [
        c.dir,
        fmt(nStr(c.ub, 1), 2),
        fmt(nStr(c.ent, 1), 2),
        fmt(nStr(c.sup, 1), 2),
        fmt(nStr(c.ser, 1), 2),
        fmt(nStr(c.zon, 1), 2),
        fmt(nStr(c.dist, 1), 2),
        fmt(nStr(c.fn, 1), 2),
        fmt(c.f, 3),
        fmt(c.vutH, 2),
      ]),
    },
    {
      type: "paso",
      n: "01",
      titulo: "Valor unitario homologado",
      formula: "VAU = promedio (VUT × Fub × Fent × Fsup × Fser × Fzon × Fdist × FN)",
      sustituye: r.homo.rows.map((c) => `${fmt(c.vut, 2)} × ${fmt(c.f, 3)} = ${fmt(c.vutH, 2)}`).join("  ·  ") || "Sin comparables: se usa VAU de trabajo.",
      resultado: `${fmt(r.vau, 2)} US$/m²`,
    },
    {
      type: "paso",
      n: "02",
      titulo: "Aplicación del Art. 19 RNT (triple cuadrado del frente)",
      formula: "VT = mín(At, 3a²)·VAU + máx(0, At − 3a²)·0.50·VAU",
      sustituye: `At = ${fmt(r.At, 2)} m²  ·  a = ${fmt(r.frente, 2)} m  ·  3a² = ${fmt(r.art.tresA2, 2)} m²  ·  VAU = ${fmt(r.vau, 2)}`,
      resultado: `${moneyUSD(r.VT)}  (${moneyPENdeUSD(r.VT, r.tc)})`,
      interpreta: r.vtNota,
    },
    {
      type: "table",
      caption: "Valor total de terreno",
      headers: ["Criterio", "m²", "% VAU", "US$"],
      rows: r.terr.rows,
    }
  );

  if (r.vivienda) {
    blocks.push(
      { type: "h3", text: "5.2 Valor de las edificaciones (VE)" },
      {
        type: "p",
        text: `El valor de las edificaciones se obtiene del VU adoptado por nivel, sustentado en el cuadro oficial ${VUO_NORMA} (${VUO_VIGENCIA}) y, de ser el caso, ajustado a valor de mercado por el perito. FD = ${fmt(r.fd * 100, 1)} %. VE = Σ (área_i × VU_i) × (1 − FD).`,
      },
      {
        type: "table",
        variant: "valores",
        caption: "Metrado por nivel (se puede añadir otro piso)",
        headers: ["Nivel", "Área m²", "VU US$/m²", "VSN US$", "VE = VSN(1−FD)"],
        rows: [
          ...r.floors.map((f) => [f.nombre, fmt(f.area, 2), fmt(f.vu, 2), fmt(f.vsn, 2), fmt(f.ve, 2)]),
          ["Total", fmt(r.areaTech, 2), "—", fmt(r.VSN, 2), fmt(r.VE, 2)],
        ],
      },
      {
        type: "paso",
        n: "03",
        titulo: "Depreciación RNT y valor de edificación",
        formula: "FD = f(antigüedad, material, estado)    VE = VSN × (1 − FD)",
        sustituye: `FD = ${fmt(r.fd * 100, 1)} %    VSN = ${fmt(r.VSN, 2)}    1 − FD = ${fmt(1 - r.fd, 3)}`,
        resultado: moneyUSD(r.VE),
      },
      { type: "h3", text: "5.3 Valor de las obras complementarias (OC) + instalaciones fijas (IF)" },
      {
        type: "table",
        headers: ["Partida", "Metrado", "VU US$", "Valor dep. US$"],
        rows: r.voc.length ? r.voc.map((v) => [v.desc, fmt(v.m, 2), fmt(v.vu, 2), fmt(v.val, 2)]) : [["—", "—", "—", "0.00"]],
      },
      { type: "h3", text: "5.4 Valor similar a nuevo (VSN)" },
      {
        type: "p",
        text: `Se refiere al valor del inmueble, sin considerar el terreno y sin tener en consideración su depreciación. VSN = ${moneyUSD(r.VSNtot)}.`,
      },
      { type: "h3", text: "5.5 Factor de mejoramiento / desmejoramiento" },
      {
        type: "p",
        text: `Este factor se usa para reflejar de mejor manera las condiciones actuales del bien, sea por ubicación, entorno de desarrollo y actividad vinculante. Se aplica solo a las edificaciones y obras complementarias. Fm = ${fmt(r.fm, 2)}.`,
      },
      {
        type: "paso",
        n: "04",
        titulo: "Aplicación de Fm",
        formula: "(VE + VOC) × Fm",
        sustituye: `(${fmt(r.VE, 2)} + ${fmt(r.VOC, 2)}) × ${fmt(r.fm, 2)}`,
        resultado: moneyUSD(veVoc),
      },
      { type: "h3", text: "5.6 Valor comercial del predio (VC)" },
      {
        type: "p",
        text: "El valor comercial del predio (VC) será igual a la sumatoria del valor del terreno (VT), más el valor de las edificaciones (VE) y el de las obras complementarias (VOC + IF), ya afectados por el factor de mejoramiento (Fm).",
      },
      {
        type: "paso",
        n: "05",
        titulo: "Valor comercial",
        formula: "VC = VT + (VE + VOC) × Fm",
        sustituye: `${fmt(r.VT, 2)} + ${fmt(veVoc, 2)}`,
        resultado: `${moneyUSD(r.VC)}  ·  ${moneyPENdeUSD(r.VC, r.tc)}`,
        interpreta: n2usd(r.VCprop),
      }
    );
  } else {
    blocks.push(
      {
        type: "paso",
        n: "03",
        titulo: "Valor comercial del terreno",
        formula: "VC = VT",
        sustituye: "Solo terreno: no se valúa edificación.",
        resultado: `${moneyUSD(r.VC)}  ·  ${moneyPENdeUSD(r.VC, r.tc)}`,
        interpreta: n2usd(r.VCprop),
      }
    );
  }

  blocks.push(
    { type: "h3", text: r.vivienda ? "5.7 Valor de realización en el mercado (VRM)" : "5.4 Valor de realización en el mercado (VRM)" },
    {
      type: "paso",
      n: r.vivienda ? "06" : "04",
      titulo: "Valor de realización",
      formula: "VRM = VC × (1 − Σ deducciones)",
      sustituye: `VC = ${fmt(r.VC, 2)}    Σd = ${fmt(r.dTot * 100, 2)} %    participación = ${pct} %`,
      resultado: `${moneyUSD(r.VRMprop)}  ·  ${moneyPENdeUSD(r.VRMprop, r.tc)}`,
      interpreta: n2usd(r.VRMprop),
    },
    { type: "h2", text: "6. Conclusiones" },
    {
      type: "p",
      text: `Como perito tasador, se concluye que el valor comercial del ${pct} % del inmueble es ${moneyUSD(r.VCprop)} (${moneyPENdeUSD(r.VCprop, r.tc)}) y el valor de realización ${moneyUSD(r.VRMprop)} (${moneyPENdeUSD(r.VRMprop, r.tc)}), a la fecha ${inp.fecha}.`,
    },
    { type: "list", items: [
      "La presente valuación se ha efectuado siguiendo las normas establecidas y con libertad de criterio.",
      "Los valores consignados surgen del análisis de inmuebles de la base de datos con similares características a las del bien considerado.",
      `Perito: ${inp.perito}. Norma: R.M. N° 172-2016-Vivienda y R.M. N° 424-2017-Vivienda.`,
    ]},
    {
      type: "firma",
      perito: inp.perito,
      fecha: inp.fecha,
      lugar: `${inp.distrito}, ${inp.provincia}`,
    },
    { type: "h2", text: "7. Panel fotográfico" },
    {
      type: "p",
      text: r.vivienda
        ? "Fachada, entorno y anexos. Las fotografías de arquitectura de cada nivel figuran en el ítem 2.8 Distribución."
        : "Fachada, entorno y anexos del predio tasado.",
    },
    {
      type: "gallery",
      items: (() => {
        const slots = ["fachada", "entorno", "interior", "anexo"] as const;
        const ph: Record<(typeof slots)[number], string> = {
          fachada: "FOTO DE FACHADA",
          entorno: "FOTO DEL ENTORNO DEL PREDIO",
          interior: "FOTO DE INTERIORES",
          anexo: "FOTO ANEXA",
        };
        const items: { src: string; caption: string; placeholder?: string }[] = [];
        for (const slot of slots) {
          const list = inp.photos.filter((p) => p.slot === slot);
          if (list.length) {
            for (const p of list) items.push({ src: p.dataUrl, caption: p.caption, placeholder: ph[slot] });
          } else if (slot === "fachada" || slot === "entorno") {
            items.push({
              src: "",
              caption: slot === "fachada" ? "Fig. 01. Fachada del inmueble." : "Fig. 02. Entorno del predio.",
              placeholder: ph[slot],
            });
          }
        }
        return items;
      })(),
    },
  );

  return {
    codigo: r.vivienda ? "TAS-EDIF" : "TAS-TERR",
    titulo: r.vivienda ? "Informe de tasación" : "Informe de tasación de terreno",
    norma: "R.M. 172-2016-Vivienda · RNT",
    blocks,
  };
}

