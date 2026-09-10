/** Tablas E.030 vigentes: RM 183-2026-VIVIENDA (4 zonas sísmicas, 5 perfiles de suelo S0–S4). */

export const Z_FACTOR: Record<1 | 2 | 3 | 4, number> = {
  1: 0.1,
  2: 0.25,
  3: 0.35,
  4: 0.45,
};

export const ZONA_DESC: Record<1 | 2 | 3 | 4, string> = {
  4: "Zona 4 — alta sismicidad (costa y borde occidental). El factor Z = 0,45 corresponde a la aceleración máxima en suelo rígido con 10 % de excedencia en 50 años (Tabla N° 1).",
  3: "Zona 3 — sismicidad media-alta. Factor Z = 0,35 (Tabla N° 1).",
  2: "Zona 2 — sismicidad intermedia. Factor Z = 0,25 (Tabla N° 1).",
  1: "Zona 1 — sismicidad baja (selva oriental). Factor Z = 0,10 (Tabla N° 1).",
};

export type SueloId = "S0" | "S1" | "S2" | "S3" | "S4" | "S5";

export const SUELOS: {
  value: SueloId;
  label: string;
  desc: string;
}[] = [
  {
    value: "S0",
    label: "S0 — Roca  (Vs30 ≥ 800 m/s)",
    desc: "Roca sana o con fracturación. Vs30 ≥ 800 m/s. Las mediciones corresponden al sitio o a la misma formación.",
  },
  {
    value: "S1",
    label: "S1 — Suelos muy rígidos  (550 ≤ Vs30 < 800 m/s)",
    desc: "Grava/arena muy densa o arcilla muy compacta. SPT N60 > 50; Su > 100 kPa.",
  },
  {
    value: "S2",
    label: "S2 — Suelos rígidos  (350 ≤ Vs30 < 550 m/s)",
    desc: "Arena densa o grava arenosa medianamente densa. SPT N60 30–50; Su 80–100 kPa. Sin Vs30 se toma el S máximo del intervalo, Tp = 0,6 s y TL = 2,0 s.",
  },
  {
    value: "S3",
    label: "S3 — Suelos intermedios  (200 ≤ Vs30 < 350 m/s)",
    desc: "Arena media a fina o suelo cohesivo intermedio. SPT N60 15–30; Su 50–80 kPa. Sin Vs30 se toma el S máximo, Tp = 0,9 s y TL = 1,60 s.",
  },
  {
    value: "S4",
    label: "S4 — Suelos blandos  (Vs30 < 200 m/s)",
    desc: "Arena suelta o suelo cohesivo blando. SPT N60 < 15; Su < 50 kPa. En zona 4 requiere análisis de respuesta de sitio (Tabla N° 4).",
  },
  {
    value: "S5",
    label: "S5 — Suelos excepcionales (no construir sin estudio)",
    desc: "Licuables, colapsables, orgánicos o condiciones geológicas desfavorables. Se prohíbe construir salvo estudio específico de sitio.",
  },
];

/** Factor S máximo del intervalo (nota Tabla 4: sin Vs30). S4 en Z4 exige estudio de sitio. */
const S_TABLA: Record<Exclude<SueloId, "S5">, Record<1 | 2 | 3 | 4, number | "sitio">> = {
  S0: { 4: 0.8, 3: 0.8, 2: 0.8, 1: 0.8 },
  S1: { 4: 1.0, 3: 1.0, 2: 1.0, 1: 1.0 },
  S2: { 4: 1.1, 3: 1.15, 2: 1.3, 1: 1.3 },
  S3: { 4: 1.2, 3: 1.2, 2: 1.4, 1: 1.6 },
  S4: { 4: "sitio", 3: 1.3, 2: 1.7, 1: 2.4 },
};

const TP_TL: Record<Exclude<SueloId, "S5">, { Tp: number; Tl: number }> = {
  S0: { Tp: 0.3, Tl: 3.0 },
  S1: { Tp: 0.4, Tl: 2.5 },
  S2: { Tp: 0.6, Tl: 2.0 },
  S3: { Tp: 0.9, Tl: 1.6 },
  S4: { Tp: 1.2, Tl: 1.6 },
};

export function paramsSitio(zona: 1 | 2 | 3 | 4, suelo: SueloId) {
  if (suelo === "S5") {
    return {
      S: 0,
      Tp: 0,
      Tl: 0,
      sitio: true,
      note: "Perfil S5: no se permite edificar sin estudio específico de sitio. No se genera espectro normativo.",
    };
  }
  const rawS = S_TABLA[suelo][zona];
  const { Tp, Tl } = TP_TL[suelo];
  if (rawS === "sitio") {
    return {
      S: 1.2,
      Tp,
      Tl,
      sitio: true,
      note: "S4 en zona 4 requiere análisis de respuesta de sitio (Tabla N° 4). Se muestra S = 1,20 solo como referencia conservadora de S3; no sustituye el estudio.",
    };
  }
  return {
    S: rawS,
    Tp,
    Tl,
    sitio: false,
    note: `Tabla N° 4 y N° 5 (sin Vs30: extremo conservador). S = ${rawS.toFixed(2).replace(".", ",")} · Tp = ${Tp.toFixed(1).replace(".", ",")} s · TL = ${Tl.toFixed(1).replace(".", ",")} s.`,
  };
}

export const CATEGORIAS = [
  {
    value: "A1",
    label: "A1 — Esenciales (salud 2.° y 3.er nivel)",
    U: 1.5,
    desc: "Establecimientos de salud públicos y privados del segundo y tercer nivel (MINSA). En zonas 3 y 4 las nuevas edificaciones A1 llevan aislamiento sísmico en la base y U = 1,0.",
  },
  {
    value: "A1-aislado",
    label: "A1 con aislamiento sísmico (zonas 3 y 4)  ·  U = 1,0",
    U: 1.0,
    desc: "Edificación esencial A1 con aislamiento sísmico en la base, obligatorio en zonas 3 y 4. Factor U = 1,0 (nota Tabla N° 7).",
  },
  {
    value: "A2",
    label: "A2 — Esenciales (emergencia, gobierno y refugio)",
    U: 1.5,
    desc: "Edificaciones esenciales para emergencias, gobierno y refugio: salud no A1, puertos, aeropuertos, municipales, bomberos, FF.AA., electricidad, agua, educación superior, depósitos de inflamables o tóxicos y archivos esenciales del Estado.",
  },
  {
    value: "B",
    label: "B — Importantes",
    U: 1.3,
    desc: "Gran afluencia de público o patrimonio valioso: cines, teatros, estadios, centros comerciales, terminales, penitenciarías, museos, bibliotecas y almacenes de abastecimiento.",
  },
  {
    value: "C",
    label: "C — Comunes (viviendas, oficinas, hoteles)",
    U: 1.0,
    desc: "Edificaciones comunes: viviendas, oficinas, hoteles, restaurantes, depósitos e industrias cuya falla no acarree incendios o fugas de contaminantes.",
  },
] as const;

export const SISTEMAS = [
  { value: "acero-smf", label: "Acero: pórticos especiales a momento (SMF)", R0: 8, Ct: 35 },
  { value: "acero-imf", label: "Acero: pórticos intermedios a momento (IMF)", R0: 5, Ct: 35 },
  { value: "acero-omf", label: "Acero: pórticos ordinarios a momento (OMF)", R0: 4, Ct: 35 },
  { value: "acero-scbf", label: "Acero: arriostrados concéntricos especiales (SCBF)", R0: 7, Ct: 45 },
  { value: "acero-ocbf", label: "Acero: arriostrados concéntricos ordinarios (OCBF)", R0: 4, Ct: 45 },
  { value: "acero-ebf", label: "Acero: arriostrados excéntricos (EBF)", R0: 8, Ct: 45 },
  { value: "ca-porticos", label: "Concreto armado: pórticos", R0: 8, Ct: 35 },
  { value: "ca-dual", label: "Concreto armado: dual", R0: 7, Ct: 60 },
  { value: "ca-muros", label: "Concreto armado: muros estructurales", R0: 6, Ct: 60 },
  { value: "ca-emdl", label: "Concreto armado: muros de ductilidad limitada (EMDL)", R0: 3.5, Ct: 60 },
  { value: "alba", label: "Albañilería armada o confinada", R0: 3, Ct: 60 },
  { value: "madera", label: "Madera", R0: 7, Ct: 45 },
  { value: "pendulo", label: "Péndulo invertido", R0: 2.5, Ct: 35 },
] as const;

export const IA_OPTS = [
  { value: "reg", Ia: 1, label: "Regular — sin irregularidad en altura", desc: "Ia = 1,00. La estructura no presenta las irregularidades de la Tabla N° 11." },
  { value: "blando", Ia: 0.75, label: "Piso blando o piso débil  ·  Ia = 0,75", desc: "Rigidez de un entrepiso < 70 % del superior o < 80 % del promedio de tres superiores; o resistencia < 80 % del entrepiso superior." },
  { value: "ext-rig", Ia: 0.5, label: "Irregularidad extrema de rigidez o resistencia  ·  Ia = 0,50", desc: "Rigidez < 60 % del superior o < 70 % del promedio de tres; o resistencia < 65 % del superior. Restringida según categoría y zona (Tabla N° 13)." },
  { value: "masa", Ia: 0.9, label: "Irregularidad de masa o peso  ·  Ia = 0,90", desc: "El peso de un piso es mayor que 1,5 veces el de un piso adyacente (no aplica en azoteas ni sótanos)." },
  { value: "geom", Ia: 0.9, label: "Irregularidad geométrica vertical  ·  Ia = 0,90", desc: "La dimensión en planta del sistema resistente es > 1,3 veces la del piso adyacente." },
  { value: "disc", Ia: 0.8, label: "Discontinuidad en los sistemas resistentes  ·  Ia = 0,80", desc: "Desalineamiento vertical > 25 % de la dimensión del elemento que resiste más del 10 % del cortante." },
  { value: "disc-ext", Ia: 0.6, label: "Discontinuidad extrema  ·  Ia = 0,60", desc: "Los elementos discontinuos resisten más del 25 % del cortante total. Irregularidad extrema (Tabla N° 13)." },
] as const;

export const IP_OPTS = [
  { value: "reg", Ip: 1, label: "Regular — sin irregularidad en planta", desc: "Ip = 1,00. La estructura no presenta las irregularidades de la Tabla N° 12." },
  { value: "tors", Ip: 0.75, label: "Irregularidad torsional  ·  Ip = 0,75", desc: "Δmáx > 1,3 Δprom (con excentricidad accidental) en diafragma rígido, y Δmáx > 50 % del límite de la Tabla N° 14." },
  { value: "tors-ext", Ip: 0.6, label: "Irregularidad torsional extrema  ·  Ip = 0,60", desc: "Δmáx > 1,5 Δprom. Irregularidad extrema (Tabla N° 13)." },
  { value: "esquina", Ip: 0.9, label: "Esquinas entrantes  ·  Ip = 0,90", desc: "Esquinas entrantes > 20 % de la dimensión total en planta en ambas direcciones." },
  { value: "diaf", Ip: 0.85, label: "Discontinuidad del diafragma  ·  Ip = 0,85", desc: "Aberturas > 50 % del área bruta del diafragma, o sección neta resistente < 50 %." },
  { value: "nopar", Ip: 0.9, label: "Sistemas no paralelos  ·  Ip = 0,90", desc: "Elementos resistentes no paralelos (no aplica si el ángulo es < 30° o resisten < 10 % del cortante)." },
] as const;

export function e030C(t: number, Tp: number, Tl: number): number {
  if (!(Tp > 0) || !(Tl > 0) || t < 0) return 0;
  if (t < 0.2 * Tp) return 1 + 7.5 * (t / Tp);
  if (t <= Tp) return 2.5;
  if (t < Tl) return (2.5 * Tp) / t;
  return (2.5 * Tp * Tl) / (t * t);
}
