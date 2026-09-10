import { G, round } from "../num";
import { geom, manningQ, manningV } from "./canal";

export type FormulaTc = "faa" | "kirpich";
export type TipoElemento = "cubierta" | "piso";
export type DestinoDescarga = "jardin" | "cuneta" | "red-pluvial" | "infiltracion";
/** Borde de la cuenca donde corre la canaleta en planta (norte = eje de menor Y). */
export type LadoPluvial = "N" | "S" | "E" | "O";
/** Pendiente de cubierta que se dibuja en planta. */
export type EsquemaTecho = "una-agua" | "dos-aguas" | "cuatro-aguas" | "azotea" | "shed";
/** Trazado de canaletas sobre la cuenca. */
export type DistribCanaleta =
  | "un-borde"
  | "dos-bordes"
  | "perimetral"
  | "perimetral-esquinas"
  | "central"
  | "en-L";

export const ESQUEMAS_TECHO: { id: EsquemaTecho; label: string }[] = [
  { id: "una-agua", label: "Techo a una agua" },
  { id: "dos-aguas", label: "Techo a dos aguas" },
  { id: "cuatro-aguas", label: "Techo a cuatro aguas" },
  { id: "azotea", label: "Azotea / cubierta plana" },
  { id: "shed", label: "Shed (diente de sierra)" },
];

export const DISTRIBs_CANALETA: { id: DistribCanaleta; label: string }[] = [
  { id: "un-borde", label: "Canaleta en un borde" },
  { id: "dos-bordes", label: "Canaletas en dos bordes opuestos" },
  { id: "perimetral", label: "Canaleta perimetral" },
  { id: "perimetral-esquinas", label: "Perimetral con bajantes en esquinas" },
  { id: "central", label: "Canaleta central (limahoya)" },
  { id: "en-L", label: "Canaletas en L (dos bordes adyacentes)" },
];

export interface IdfRow {
  tMin: number;
  intensidades: Record<number, number>;
}

export interface ElementoPluvial {
  id: string;
  codigo: string;
  descripcion: string;
  tipo: TipoElemento;
  C: number;
  L1: number;
  S1: number;
  L2: number;
  S2: number;
  A1: number;
  A2: number;
  b: number;
  y: number;
  S: number;
  n: number;
  holgura: number;
  holgura2: number;
  bPropuesto: number;
  hPropuesto: number;
  nBajantes: 1 | 2;
  /** Nivel de la edificación (1 = primer piso / cubierta baja). */
  nivel?: number;
  /** Borde de la cuenca donde se traza la canaleta. */
  lado?: LadoPluvial;
  /** Forma de cubierta (pendientes en planta). */
  esquemaTecho?: EsquemaTecho;
  /** Cómo se distribuyen las canaletas sobre la cuenca. */
  distrib?: DistribCanaleta;
  /** Esquina SO de la cuenca de aporte en planta (m). Y crece hacia el sur. */
  x0?: number;
  y0?: number;
  /** Ancho (este–oeste) y fondo (norte–sur) de la cuenca, m. */
  w?: number;
  d?: number;
  ejes?: string;
  /** Contorno no rectangular (p. ej. cubierta en L). */
  poly?: { x: number; y: number }[];
}

export interface DrenajeInput {
  proyecto: string;
  ubicacion: string;
  profesional: string;
  cip?: string;
  estacionSenamhi?: string;
  codigoEstacion?: string;
  periodoRegistro?: string;
  cotaCubierta?: number;
  cotaDescarga?: number;
  utmEste?: number;
  utmNorte?: number;
  materialCanaleta?: string;
  Lbajante?: number;
  nCodosBajante?: number;
  KcodoBajante?: number;
  nIila: number;
  tg: number;
  eg: number;
  bParam: number;
  Tret: number;
  tDisenoMin: number;
  usarTcComoDuracion: boolean;
  formulaTc: FormulaTc;
  destino: DestinoDescarga;
  distCimentacion: number;
  elementos: ElementoPluvial[];
}

export interface Comercial {
  b: number;
  h: number;
  label: string;
}

export interface BajanteComercial {
  nom: number;
  id: number;
}

export interface Hidrologia {
  a: number;
  K: number;
  tMin: number;
  I: number;
  idf: IdfRow[];
  periodos: number[];
}

export interface ResultadoElemento {
  el: ElementoPluvial;
  C: number;
  Tc1: number;
  Tc2: number;
  TcMin: number;
  TcHr: number;
  TcKirpich: number;
  tMin: number;
  I: number;
  Am2: number;
  Akm2: number;
  Qm3s: number;
  Qlps: number;
  QporBajante: number;
  P: number;
  Ahid: number;
  R: number;
  Qcap: number;
  V: number;
  hMin: number;
  bMin: number;
  FS: number;
  cumpleQ: boolean;
  cumpleProp: boolean;
  cumplePendiente: boolean;
  cumpleVel: boolean;
  cumpleLongitud: boolean;
  holguraReal: number;
  llenado: number;
  comercial: Comercial;
  QcapComercial: number;
  Vcomercial: number;
  yComercial: number;
  cumpleComercial: boolean;
  bajante: BajanteComercial;
  Qorificio: number;
  cumpleBajante: boolean;
  ok: boolean;
}

export interface DrenajeResultado {
  hidro: Hidrologia;
  items: ResultadoElemento[];
  Qtotal: number;
  ATotal: number;
  nOk: number;
  nFail: number;
}

export const PERIODOS_IDF = [2, 5, 10, 25, 50, 100, 500];
export const DURACIONES_IDF = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130];

export const C_TABLA = [
  { id: "techos", C: 0.95, label: "Techos y azoteas (CE.040 Tabla 1.b)" },
  { id: "metal", C: 0.9, label: "Cobertura liviana (calamina / metal / policarbonato)" },
  { id: "pav-asf", C: 0.9, label: "Pavimento asfáltico / concreto" },
  { id: "adoquin", C: 0.8, label: "Adoquinado" },
  { id: "grava", C: 0.5, label: "Grava compactada" },
  { id: "estacion", C: 0.85, label: "Estacionamiento pavimentado" },
  { id: "jardin", C: 0.2, label: "Jardines / áreas verdes" },
  { id: "mixto", C: 0.7, label: "Urbano mixto" },
];

export const ZONAS_IILA = [
  {
    id: "norte",
    label: "Costa norte (Lambayeque / Piura)",
    n: 0.432,
    b: 0.2,
    tg: 12.85,
    eg: 61.5,
    nota: "n de Tabla 3.b CE.040 zona norte; eg Subzona 9-3 Dm<30 km; tg interpolado Moyobamba–Progreso.",
  },
  {
    id: "centro",
    label: "Costa centro (Lima / Callao)",
    n: 0.5,
    b: 0.2,
    tg: 10,
    eg: 40,
    nota: "Valores de partida para costa centro; calibrar con estación SENAMHI del proyecto.",
  },
  {
    id: "sur",
    label: "Costa sur (Arequipa / Moquegua)",
    n: 0.55,
    b: 0.2,
    tg: 8,
    eg: 25,
    nota: "Costa sur más árida: e_g menor y T produce contrastes mayores. Verificar Tabla 3 CE.040.",
  },
  {
    id: "sierra",
    label: "Sierra",
    n: 0.55,
    b: 0.15,
    tg: 8,
    eg: 80,
    nota: "Valores de partida para sierra; verificar Tabla 3 CE.040 de la subzona.",
  },
  {
    id: "selva",
    label: "Selva (Moyobamba / clima semilluvioso)",
    n: 0.4,
    b: 0.15,
    tg: 15.2,
    eg: 120,
    nota: "t_g de Tabla 3.c código 193 Moyobamba. Intensidades altas: revisar T y t con SENAMHI local.",
  },
];

export const T_RETORNO = [
  { T: 2, uso: "Sistema menor residencial (OS.060)" },
  { T: 5, uso: "Edificación corriente / cubiertas de vivienda" },
  { T: 10, uso: "Edificación comercial, estacionamiento, cubiertas CE.040" },
  { T: 25, uso: "Sistema mayor / vías principales" },
  { T: 50, uso: "Infraestructura crítica / inundación urbana" },
  { T: 100, uso: "Verificación extraordinaria" },
];

export const COMERCIAL_CUBIERTA: Comercial[] = [
  { b: 10, h: 7.5, label: "100 × 75 mm" },
  { b: 12.5, h: 10, label: "125 × 100 mm" },
  { b: 15, h: 10, label: "150 × 100 mm" },
  { b: 15, h: 15, label: "150 × 150 mm" },
  { b: 20, h: 15, label: "200 × 150 mm" },
  { b: 20, h: 20, label: "200 × 200 mm" },
  { b: 25, h: 20, label: "250 × 200 mm" },
  { b: 30, h: 25, label: "300 × 250 mm" },
];

export const COMERCIAL_PISO: Comercial[] = [
  { b: 15, h: 15, label: "15 × 15 cm (concreto + rejilla)" },
  { b: 20, h: 15, label: "20 × 15 cm" },
  { b: 20, h: 20, label: "20 × 20 cm" },
  { b: 20, h: 25, label: "20 × 25 cm" },
  { b: 25, h: 20, label: "25 × 20 cm" },
  { b: 30, h: 25, label: "30 × 25 cm" },
  { b: 30, h: 30, label: "30 × 30 cm" },
];

export const BAJANTES: BajanteComercial[] = [
  { nom: 75, id: 72 },
  { nom: 90, id: 86 },
  { nom: 110, id: 103 },
  { nom: 160, id: 151 },
  { nom: 200, id: 188 },
];

export const DESTINOS: { id: DestinoDescarga; label: string }[] = [
  { id: "jardin", label: "Jardín / área verde (alejado de cimentación)" },
  { id: "cuneta", label: "Cuneta de vía" },
  { id: "red-pluvial", label: "Red pública de drenaje pluvial (OS.060)" },
  { id: "infiltracion", label: "Caja de infiltración / pozo seco" },
];

const CD_ORIFICIO = 0.62;
const S_MIN = 0.005;
const L_MAX_UNA_SALIDA = 12;
const V_MIN = 0.3;
const V_MAX_METAL = 3.5;
const V_MAX_CONCRETO = 4.5;
const Y_FRAC = 0.6;
const HOLGURA_MIN_CM = 2.5;
const DIST_CIM_MIN = 1.5;

export function calcA(tg: number, n: number, eg: number) {
  return (1 / tg) ** n * eg;
}

export function calcKg(eg: number) {
  return 22.5 * eg ** -0.85;
}

export function intensidad(a: number, K: number, T: number, tHr: number, b: number, n: number) {
  return a * (1 + K * Math.log10(T)) * (tHr + b) ** (n - 1);
}

/** FAA / CE.040 Tabla 2 — Tc en minutos. L en m, S en m/m. */
export function tcFAA(C: number, L: number, S: number) {
  if (L <= 0 || S <= 0) return 0;
  const hours = 0.7035 * (1.1 - C) * Math.sqrt(L) / S ** 0.333;
  return hours * 60;
}

/** Kirpich (CE.040 Tabla 2) — Tc en minutos. L en m, S en m/m. */
export function tcKirpich(L: number, S: number) {
  if (L <= 0 || S <= 0) return 0;
  return 0.0195 * L ** 0.77 * S ** -0.385;
}

export function curvaIdf(a: number, K: number, b: number, n: number): IdfRow[] {
  return DURACIONES_IDF.map((tMin) => ({
    tMin,
    intensidades: Object.fromEntries(
      PERIODOS_IDF.map((T) => [T, round(intensidad(a, K, T, tMin / 60, b, n), 2)])
    ),
  }));
}

export function redondearHExcel(hMin: number) {
  const x = Math.floor((hMin / 100) * 10) / 10 * 100;
  const rem = hMin - x;
  return x + (rem > 5 ? 15 : 10);
}

export function manningRect(bCm: number, yCm: number, n: number, S: number) {
  const g = geom("rectangular", yCm / 100, bCm / 100, 0, 0);
  return { ...g, Q: manningQ(g, n, S), V: manningV(g, n, S) };
}

export function qOrificio(dMm: number, hM: number) {
  if (dMm <= 0 || hM <= 0) return 0;
  const d = dMm / 1000;
  return CD_ORIFICIO * (Math.PI / 4) * d * d * Math.sqrt(2 * G * hM);
}

export function elegirBajante(Qlps: number, yCm: number): { tubo: BajanteComercial; Qlps: number } {
  const h = Math.max(yCm, 3) / 100;
  for (const tubo of BAJANTES) {
    const Q = qOrificio(tubo.id, h) * 1000;
    if (Q + 1e-9 >= Qlps) return { tubo, Qlps: Q };
  }
  const last = BAJANTES[BAJANTES.length - 1];
  return { tubo: last, Qlps: qOrificio(last.id, h) * 1000 };
}

export function elegirComercial(tipo: TipoElemento, Qm3s: number, n: number, S: number): {
  sec: Comercial;
  y: number;
  Qcap: number;
  V: number;
  ok: boolean;
} {
  const catalogo = tipo === "piso" ? COMERCIAL_PISO : COMERCIAL_CUBIERTA;
  for (const sec of catalogo) {
    const yUse = Math.min(sec.h * Y_FRAC, sec.h - HOLGURA_MIN_CM);
    const m = manningRect(sec.b, yUse, n, S);
    const holgura = sec.h - yUse;
    if (m.Q + 1e-12 >= Qm3s && holgura + 1e-9 >= HOLGURA_MIN_CM) {
      return { sec, y: yUse, Qcap: m.Q, V: m.V, ok: true };
    }
  }
  const sec = catalogo[catalogo.length - 1];
  const yUse = sec.h * Y_FRAC;
  const m = manningRect(sec.b, yUse, n, S);
  return { sec, y: yUse, Qcap: m.Q, V: m.V, ok: m.Q >= Qm3s };
}

export function calcularHidrologia(inp: DrenajeInput, TcMinRef: number): Hidrologia {
  const a = round(calcA(inp.tg, inp.nIila, inp.eg), 3);
  const K = round(calcKg(inp.eg), 3);
  const tMin = inp.usarTcComoDuracion ? Math.max(10, TcMinRef) : inp.tDisenoMin;
  const I = intensidad(a, K, inp.Tret, tMin / 60, inp.bParam, inp.nIila);
  return {
    a,
    K,
    tMin,
    I: round(I, 2),
    idf: curvaIdf(a, K, inp.bParam, inp.nIila),
    periodos: PERIODOS_IDF,
  };
}

function tcDe(el: ElementoPluvial, formula: FormulaTc) {
  const raw1 = formula === "kirpich" ? tcKirpich(el.L1, el.S1) : tcFAA(el.C, el.L1, el.S1);
  const raw2 = formula === "kirpich" ? tcKirpich(el.L2, el.S2) : tcFAA(el.C, el.L2, el.S2);
  const Tc1 = formula === "faa" ? Math.round(raw1) : round(raw1, 1);
  const Tc2 = formula === "faa" ? Math.round(raw2) : round(raw2, 1);
  const TcMin = Tc1 + Tc2;
  return {
    Tc1,
    Tc2,
    TcMin: round(TcMin, 1),
    TcHr: round(TcMin / 60, 2),
    TcKirpich: round(tcKirpich(el.L1, el.S1) + tcKirpich(el.L2, el.S2), 1),
  };
}

export function calcularElemento(el: ElementoPluvial, hidro: Hidrologia, formulaTc: FormulaTc): ResultadoElemento {
  const tc = tcDe(el, formulaTc);
  const tMin = hidro.tMin;
  const I = hidro.I;
  const Am2 = el.A1 + el.A2;
  const Akm2 = Am2 / 1e6;
  const Qm3s = 0.278 * el.C * I * Akm2;
  const Qlps = Qm3s * 1000;
  const nBaj = el.nBajantes >= 2 ? 2 : 1;
  const QporBajante = Qlps / nBaj;

  const m = manningRect(el.b, el.y, el.n, el.S);
  const hMin = el.y + el.holgura + el.holgura2;
  const cumpleQ = m.Q + 1e-12 >= Qm3s;
  const cumpleProp = el.bPropuesto + 1e-9 >= el.b && el.hPropuesto + 1e-9 >= hMin;
  const cumplePendiente = el.S + 1e-12 >= S_MIN;
  const vMax = el.tipo === "piso" ? V_MAX_CONCRETO : V_MAX_METAL;
  const cumpleVel = m.V >= V_MIN && m.V <= vMax;
  const LporSalida = el.L2 / nBaj;
  const cumpleLongitud = LporSalida <= L_MAX_UNA_SALIDA + 1e-9;
  const holguraReal = el.hPropuesto - el.y;
  const llenado = el.hPropuesto > 0 ? el.y / el.hPropuesto : 0;

  const comercial = elegirComercial(el.tipo, Qm3s, el.n, el.S);
  const baj = elegirBajante(QporBajante, el.y);
  const cumpleBajante = baj.Qlps + 1e-9 >= QporBajante;
  const FS = Qm3s > 0 ? m.Q / Qm3s : Infinity;
  const ok = cumpleQ && cumpleProp && cumplePendiente && cumpleBajante && comercial.ok;

  return {
    el,
    C: el.C,
    ...tc,
    tMin,
    I,
    Am2: round(Am2, 2),
    Akm2,
    Qm3s,
    Qlps: round(Qlps, 3),
    QporBajante: round(QporBajante, 3),
    P: m.P,
    Ahid: m.A,
    R: m.R,
    Qcap: m.Q,
    V: m.V,
    hMin,
    bMin: el.b,
    FS,
    cumpleQ,
    cumpleProp,
    cumplePendiente,
    cumpleVel,
    cumpleLongitud,
    holguraReal,
    llenado,
    comercial: comercial.sec,
    QcapComercial: comercial.Qcap,
    Vcomercial: comercial.V,
    yComercial: comercial.y,
    cumpleComercial: comercial.ok,
    bajante: baj.tubo,
    Qorificio: baj.Qlps,
    cumpleBajante,
    ok,
  };
}

export function calcularDrenaje(inp: DrenajeInput): DrenajeResultado {
  const tcMax = Math.max(
    10,
    ...inp.elementos.map((el) => tcDe(el, inp.formulaTc).TcMin)
  );
  const hidro = calcularHidrologia(inp, tcMax);
  const items = inp.elementos.map((el) => calcularElemento(el, hidro, inp.formulaTc));
  const Qtotal = items.reduce((s, it) => s + it.Qlps, 0);
  const ATotal = items.reduce((s, it) => s + it.Am2, 0);
  return {
    hidro,
    items,
    Qtotal,
    ATotal,
    nOk: items.filter((it) => it.ok).length,
    nFail: items.filter((it) => !it.ok).length,
  };
}

/** Compatibilidad con el módulo de una sola canaleta. */
export interface CanaletaInput {
  proyecto: string;
  ubicacion: string;
  profesional: string;
  elemento: string;
  C: number;
  nIila: number;
  tg: number;
  eg: number;
  bParam: number;
  Tret: number;
  tDisenoMin: number;
  usarTcComoDuracion: boolean;
  L1: number;
  S1: number;
  L2: number;
  S2: number;
  A1: number;
  A2: number;
  b: number;
  y: number;
  S: number;
  n: number;
  holgura: number;
  holgura2: number;
  bPropuesto: number;
  hPropuesto: number;
}

export function calcularCanaleta(inp: CanaletaInput) {
  const r = calcularDrenaje({
    proyecto: inp.proyecto,
    ubicacion: inp.ubicacion,
    profesional: inp.profesional,
    nIila: inp.nIila,
    tg: inp.tg,
    eg: inp.eg,
    bParam: inp.bParam,
    Tret: inp.Tret,
    tDisenoMin: inp.tDisenoMin,
    usarTcComoDuracion: inp.usarTcComoDuracion,
    formulaTc: "faa",
    destino: "jardin",
    distCimentacion: 2,
    elementos: [
      {
        id: "1",
        codigo: "C-1",
        descripcion: inp.elemento,
        tipo: "cubierta",
        C: inp.C,
        L1: inp.L1,
        S1: inp.S1,
        L2: inp.L2,
        S2: inp.S2,
        A1: inp.A1,
        A2: inp.A2,
        b: inp.b,
        y: inp.y,
        S: inp.S,
        n: inp.n,
        holgura: inp.holgura,
        holgura2: inp.holgura2,
        bPropuesto: inp.bPropuesto,
        hPropuesto: inp.hPropuesto,
        nBajantes: 1,
      },
    ],
  });
  const it = r.items[0];
  return {
    a: r.hidro.a,
    K: r.hidro.K,
    Tc1: it.Tc1,
    Tc2: it.Tc2,
    TcMin: it.TcMin,
    TcHr: it.TcHr,
    tMin: it.tMin,
    I: it.I,
    Am2: it.Am2,
    Akm2: it.Akm2,
    Qm3s: it.Qm3s,
    Qlps: it.Qlps,
    P: it.P,
    Ahid: it.Ahid,
    R: it.R,
    Qcap: it.Qcap,
    V: it.V,
    hMin: it.hMin,
    cumpleQ: it.cumpleQ,
    cumpleProp: it.cumpleProp,
    idf: r.hidro.idf,
    periodos: r.hidro.periodos,
    FS: it.FS,
  };
}

export function nuevoElemento(i: number): ElementoPluvial {
  return {
    id: `e-${Date.now()}-${i}`,
    codigo: `C-${i} R`,
    descripcion: `Canaleta de cubierta ${i}`,
    tipo: "cubierta",
    C: 0.95,
    L1: 8,
    S1: 0.15,
    L2: 8,
    S2: 0.01,
    A1: 40,
    A2: 1.2,
    b: 5,
    y: 5,
    S: 0.01,
    n: 0.012,
    holgura: 5,
    holgura2: 5,
    bPropuesto: 15,
    hPropuesto: 20,
    nBajantes: 1,
    nivel: 1,
    lado: "S",
    esquemaTecho: "una-agua",
    distrib: "un-borde",
  };
}

export const EJEMPLO_CHICLAYO: ElementoPluvial[] = [
  {
    id: "c1",
    codigo: "C-1 R",
    descripcion: "Cubierta 1.er nivel (ejes C–D–6–9)",
    tipo: "cubierta",
    C: 0.95,
    L1: 5.27,
    S1: 0.15,
    L2: 11.39,
    S2: 0.01,
    A1: 62.49,
    A2: 2.25,
    b: 5,
    y: 5,
    S: 0.01,
    n: 0.012,
    holgura: 5,
    holgura2: 5,
    bPropuesto: 15,
    hPropuesto: 20,
    nBajantes: 1,
    nivel: 1,
    lado: "E",
    x0: 16,
    y0: 16,
    w: 6.5,
    d: 8,
    ejes: "C–D–6–9",
    esquemaTecho: "una-agua",
    distrib: "un-borde",
  },
  {
    id: "c2",
    codigo: "C-2 R",
    descripcion: "Cubierta 2.° nivel (ejes 1–4'–B–C)",
    tipo: "cubierta",
    C: 0.95,
    L1: 11.88,
    S1: 0.15,
    L2: 8.68,
    S2: 0.01,
    A1: 114.5,
    A2: 1.66,
    b: 5,
    y: 7,
    S: 0.01,
    n: 0.012,
    holgura: 5,
    holgura2: 5,
    bPropuesto: 15,
    hPropuesto: 25,
    nBajantes: 1,
    nivel: 2,
    lado: "N",
    x0: 8,
    y0: 0,
    w: 8,
    d: 10,
    ejes: "1–4'–B–C",
    esquemaTecho: "dos-aguas",
    distrib: "dos-bordes",
  },
  {
    id: "c3",
    codigo: "C-3 R",
    descripcion: "Cubierta 1.er nivel (ejes C–B–4'–12)",
    tipo: "cubierta",
    C: 0.95,
    L1: 22.66,
    S1: 0.15,
    L2: 12.66,
    S2: 0.01,
    A1: 249.87,
    A2: 2.13,
    b: 5,
    y: 13,
    S: 0.01,
    n: 0.012,
    holgura: 5,
    holgura2: 6,
    bPropuesto: 15,
    hPropuesto: 30,
    nBajantes: 2,
    nivel: 1,
    lado: "O",
    x0: 8,
    y0: 10,
    w: 8,
    d: 22,
    ejes: "C–B–4'–12",
    poly: [
      { x: 8, y: 10 },
      { x: 16, y: 10 },
      { x: 16, y: 24 },
      { x: 14.2, y: 24 },
      { x: 14.2, y: 32 },
      { x: 8, y: 32 },
    ],
    esquemaTecho: "una-agua",
    distrib: "un-borde",
  },
  {
    id: "c4",
    codigo: "C-4 R",
    descripcion: "Cubierta 1.er nivel (ejes C–B'''–9–12)",
    tipo: "cubierta",
    C: 0.95,
    L1: 9.65,
    S1: 0.15,
    L2: 1.8,
    S2: 0.01,
    A1: 11.98,
    A2: 1.95,
    b: 5,
    y: 5,
    S: 0.01,
    n: 0.012,
    holgura: 5,
    holgura2: 5,
    bPropuesto: 15,
    hPropuesto: 20,
    nBajantes: 1,
    nivel: 1,
    lado: "E",
    x0: 14.2,
    y0: 24,
    w: 1.8,
    d: 8,
    ejes: "C–B'''–9–12",
    esquemaTecho: "shed",
    distrib: "un-borde",
  },
  {
    id: "c5",
    codigo: "C-5 R",
    descripcion: "Cubierta 1.er nivel (ejes A–A'–12–13)",
    tipo: "cubierta",
    C: 0.95,
    L1: 3.95,
    S1: 0.15,
    L2: 2.96,
    S2: 0.01,
    A1: 11.75,
    A2: 0.5,
    b: 5,
    y: 5,
    S: 0.01,
    n: 0.012,
    holgura: 5,
    holgura2: 5,
    bPropuesto: 15,
    hPropuesto: 20,
    nBajantes: 1,
    nivel: 1,
    lado: "S",
    x0: 0,
    y0: 32,
    w: 3.6,
    d: 3.6,
    ejes: "A–A'–12–13",
    esquemaTecho: "cuatro-aguas",
    distrib: "perimetral-esquinas",
  },
  {
    id: "c6",
    codigo: "C-6 R",
    descripcion: "Estacionamiento 1.er nivel (ejes A–C–12–16)",
    tipo: "piso",
    C: 0.95,
    L1: 14.35,
    S1: 0.01,
    L2: 11.65,
    S2: 0.01,
    A1: 297,
    A2: 3.5,
    b: 10,
    y: 9,
    S: 0.01,
    n: 0.017,
    holgura: 5,
    holgura2: 5,
    bPropuesto: 20,
    hPropuesto: 25,
    nBajantes: 1,
    nivel: 1,
    lado: "S",
    x0: 0,
    y0: 32,
    w: 16,
    d: 16,
    ejes: "A–C–12–16",
    esquemaTecho: "azotea",
    distrib: "un-borde",
  },
];

export const S_MIN_CANALETA = S_MIN;
export const L_MAX_SALIDA = L_MAX_UNA_SALIDA;
export const DIST_CIMIENTOS_MIN = DIST_CIM_MIN;
export const Y_FRACCION = Y_FRAC;
export const CD_BAJANTE = CD_ORIFICIO;
