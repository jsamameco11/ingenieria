/** Dosificación empírica de obra (baldes). No sustituye ACI 211 de laboratorio. */

export type TipoMezclaObra = "concreto" | "hormigon" | "ciclopeo" | "pobre";
export type GeomObra = "volumen" | "losa" | "cimiento" | "zapata";

export type ElemObra = {
  id: string;
  label: string;
  fc: number;
  tipo: TipoMezclaObra;
  geom: GeomObra;
  a: number;
  p: number;
  h: number;
  pg: number;
  e: string;
  slump: string;
  nota: string;
  materiales: string;
};

export const ELEMENTOS_OBRA: ElemObra[] = [
  {
    id: "solado",
    label: "Solado de limpia",
    fc: 100,
    tipo: "pobre",
    geom: "losa",
    a: 0,
    p: 0,
    h: 12,
    pg: 0,
    e: "0.05",
    slump: "8",
    materiales: "cemento, hormigón y agua",
    nota: "Concreto pobre de limpieza bajo zapatas o plateas. No es estructural. Proporción habitual 1 : 10 a 1 : 12 (cemento : hormigón).",
  },
  {
    id: "cimiento",
    label: "Cimiento corrido",
    fc: 140,
    tipo: "hormigon",
    geom: "cimiento",
    a: 0,
    p: 0,
    h: 8,
    pg: 0,
    e: "0.40",
    slump: "8",
    materiales: "cemento, hormigón y agua",
    nota: "En vivienda la práctica peruana dosifica cimiento corrido con hormigón (agregado conjunto de río), no arena y piedra por separado. f′c nominal 100–140 kg/cm². Proporción 1 : 8 (a veces 1 : 10).",
  },
  {
    id: "sobrecimiento",
    label: "Sobrecimiento",
    fc: 140,
    tipo: "ciclopeo",
    geom: "cimiento",
    a: 0,
    p: 0,
    h: 8,
    pg: 30,
    e: "0.30",
    slump: "8",
    materiales: "cemento, hormigón, piedra grande y agua",
    nota: "Sobrecimiento ciclópeo: ≈ 70 % de concreto 1 : 8 y 30 % de piedra grande (máx. 8\"–10\"). f′c 140 kg/cm².",
  },
  {
    id: "vereda",
    label: "Vereda / sardinel",
    fc: 175,
    tipo: "concreto",
    geom: "losa",
    a: 2,
    p: 4,
    h: 0,
    pg: 0,
    e: "0.10",
    slump: "8",
    materiales: "cemento, arena, piedra y agua",
    nota: "Veredas y sardineles: f′c 175 kg/cm². Dosificación de obra 1 : 2 : 4.",
  },
  {
    id: "piso",
    label: "Piso / contrapiso",
    fc: 175,
    tipo: "concreto",
    geom: "losa",
    a: 2,
    p: 4,
    h: 0,
    pg: 0,
    e: "0.08",
    slump: "8",
    materiales: "cemento, arena, piedra y agua",
    nota: "Contrapiso o piso de concreto simple. f′c 175 kg/cm² (a veces 140 en interiores). 1 : 2 : 4.",
  },
  {
    id: "zapata",
    label: "Zapata aislada",
    fc: 210,
    tipo: "concreto",
    geom: "zapata",
    a: 2,
    p: 3,
    h: 0,
    pg: 0,
    e: "0.40",
    slump: "10",
    materiales: "cemento, arena, piedra y agua",
    nota: "Elemento estructural. f′c 210 kg/cm² (E.060). Dosificación de obra 1 : 2 : 3. Confirme con el plano de estructuras.",
  },
  {
    id: "zapata-corrida",
    label: "Zapata corrida",
    fc: 210,
    tipo: "concreto",
    geom: "cimiento",
    a: 2,
    p: 3,
    h: 0,
    pg: 0,
    e: "0.40",
    slump: "10",
    materiales: "cemento, arena, piedra y agua",
    nota: "Zapata corrida estructural (no confundir con cimiento corrido de hormigón). f′c 210 kg/cm². 1 : 2 : 3.",
  },
  {
    id: "columna",
    label: "Columna",
    fc: 210,
    tipo: "concreto",
    geom: "volumen",
    a: 2,
    p: 3,
    h: 0,
    pg: 0,
    e: "0.25",
    slump: "10",
    materiales: "cemento, arena, piedra y agua",
    nota: "Concreto estructural. f′c 210 kg/cm² o el de planos. 1 : 2 : 3. Slump 8–10 cm.",
  },
  {
    id: "viga",
    label: "Viga",
    fc: 210,
    tipo: "concreto",
    geom: "volumen",
    a: 2,
    p: 3,
    h: 0,
    pg: 0,
    e: "0.25",
    slump: "10",
    materiales: "cemento, arena, piedra y agua",
    nota: "Concreto estructural. f′c 210 kg/cm² o el de planos. 1 : 2 : 3.",
  },
  {
    id: "losa",
    label: "Losa / aligerado",
    fc: 210,
    tipo: "concreto",
    geom: "losa",
    a: 2,
    p: 3,
    h: 0,
    pg: 0,
    e: "0.20",
    slump: "10",
    materiales: "cemento, arena, piedra y agua",
    nota: "Losa maciza o aligerado. f′c 210 kg/cm². 1 : 2 : 3. El volumen es el de concreto, no el de la losa bruta si hay ladrillo hueco.",
  },
  {
    id: "muro",
    label: "Muro de concreto / placa",
    fc: 210,
    tipo: "concreto",
    geom: "losa",
    a: 2,
    p: 3,
    h: 0,
    pg: 0,
    e: "0.15",
    slump: "10",
    materiales: "cemento, arena, piedra y agua",
    nota: "Muro o placa. f′c 210 kg/cm² (o 175 en muros no sismorresistentes). 1 : 2 : 3.",
  },
  {
    id: "escalera",
    label: "Escalera",
    fc: 210,
    tipo: "concreto",
    geom: "volumen",
    a: 2,
    p: 3,
    h: 0,
    pg: 0,
    e: "0.15",
    slump: "10",
    materiales: "cemento, arena, piedra y agua",
    nota: "Escalera de concreto. f′c 210 kg/cm². 1 : 2 : 3.",
  },
  {
    id: "libre",
    label: "Proporción libre de obra",
    fc: 175,
    tipo: "concreto",
    geom: "volumen",
    a: 4,
    p: 4,
    h: 0,
    pg: 0,
    e: "0.10",
    slump: "8",
    materiales: "cemento, arena, piedra y agua (o hormigón, si cambia el tipo)",
    nota: "Usted fija la proporción o los baldes por bolsa (p. ej. 1 bolsa : 4 baldes de arena : 4 de piedra, balde de 20 L).",
  },
];

export function elemObra(id: string): ElemObra {
  return ELEMENTOS_OBRA.find((e) => e.id === id) ?? ELEMENTOS_OBRA[4]!;
}

export function acObra(fc: number) {
  const xs = [100, 140, 175, 210, 245, 280, 350];
  const ys = [0.8, 0.7, 0.62, 0.53, 0.47, 0.42, 0.38];
  if (fc <= xs[0]!) return ys[0]!;
  if (fc >= xs[xs.length - 1]!) return ys[ys.length - 1]!;
  for (let i = 1; i < xs.length; i++) {
    if (fc <= xs[i]!) {
      const t = (fc - xs[i - 1]!) / (xs[i]! - xs[i - 1]!);
      return ys[i - 1]! + t * (ys[i]! - ys[i - 1]!);
    }
  }
  return 0.53;
}

export const OPCIONES_ELEMENTO = ELEMENTOS_OBRA.map((e) => ({
  value: e.id,
  label: `${e.label}  ·  f′c ${e.fc}`,
}));
