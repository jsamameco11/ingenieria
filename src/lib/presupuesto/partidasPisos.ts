import type { Partida } from "./types";
import { p, r } from "./partidaBuilder";

const CAP = "07 Contrapisos y pisos";
const CAP_ZOC = "08 Zócalos y revestimientos";

/** Contrapiso: factor = espesor en cm (base e=5 cm → cem 0.16, are 0.028). */
function contrapiso(codigo: string, desc: string, eCm: number): Partida {
  const f = eCm / 5;
  return p(
    "arquitectura",
    CAP,
    codigo,
    desc,
    "m²",
    r(
      ["MO-OPE", +(0.18 + 0.04 * f).toFixed(3)],
      ["MO-PEO", +(0.22 + 0.06 * f).toFixed(3)],
      ["MAT-CEM", +(0.16 * f).toFixed(3)],
      ["MAT-ARE", +(0.028 * f).toFixed(4)],
      ["MAT-AGU", +(0.012 * f).toFixed(4)],
      ["EQ-HIN", 5]
    )
  );
}

function pisoCer(
  codigo: string,
  desc: string,
  matId: string,
  opts?: { mo?: number; peo?: number; peg?: number; fra?: number; moId?: string }
): Partida {
  const mo = opts?.mo ?? 0.45;
  const peo = opts?.peo ?? 0.35;
  const peg = opts?.peg ?? 0.12;
  const fra = opts?.fra ?? 0.4;
  const moId = opts?.moId ?? "MO-ALB";
  return p(
    "arquitectura",
    CAP,
    codigo,
    desc,
    "m²",
    r([moId, mo], ["MO-PEO", peo], [matId, 1.08], ["MAT-PEG", peg], ["MAT-FRA", fra], ["EQ-HIN", 5])
  );
}

function pisoPor(
  codigo: string,
  desc: string,
  matId: string,
  opts?: { mo?: number; peo?: number; peg?: number; fra?: number }
): Partida {
  const mo = opts?.mo ?? 0.55;
  const peo = opts?.peo ?? 0.4;
  const peg = opts?.peg ?? 0.14;
  const fra = opts?.fra ?? 0.35;
  return p(
    "arquitectura",
    CAP,
    codigo,
    desc,
    "m²",
    r(["MO-ALB", mo], ["MO-PEO", peo], [matId, 1.08], ["MAT-PEGPOR", peg], ["MAT-FRA", fra], ["EQ-HIN", 5])
  );
}

function mayolicaMuro(
  codigo: string,
  desc: string,
  matId: string,
  opts?: { mo?: number; peo?: number; peg?: number; fra?: number }
): Partida {
  const mo = opts?.mo ?? 0.52;
  const peo = opts?.peo ?? 0.38;
  const peg = opts?.peg ?? 0.13;
  const fra = opts?.fra ?? 0.45;
  return p(
    "arquitectura",
    CAP_ZOC,
    codigo,
    desc,
    "m²",
    r(["MO-ALB", mo], ["MO-PEO", peo], [matId, 1.1], ["MAT-PEG", peg], ["MAT-FRA", fra], ["EQ-HIN", 5])
  );
}

function zocalo(codigo: string, desc: string, matId: string, peg = 0.02, fra = 0.05): Partida {
  return p(
    "arquitectura",
    CAP_ZOC,
    codigo,
    desc,
    "m",
    r(["MO-ALB", 0.12], ["MO-PEO", 0.08], [matId, 1.05], ["MAT-PEG", peg], ["MAT-FRA", fra], ["EQ-HIN", 5])
  );
}

/** Contrapisos por espesor (pulgadas y métrico). ARQ-07.01.01 queda como e=2\" (5 cm). */
const CONTRAPISOS: Partida[] = [
  contrapiso("ARQ-07.01.03", "Contrapiso e=3\" (7.5 cm) mortero 1:5", 7.5),
  contrapiso("ARQ-07.01.04", "Contrapiso e=4\" (10 cm) mortero 1:5", 10),
  contrapiso("ARQ-07.01.05", "Contrapiso e=4 cm mortero 1:5", 4),
  contrapiso("ARQ-07.01.06", "Contrapiso e=6 cm mortero 1:5", 6),
  contrapiso("ARQ-07.01.07", "Contrapiso e=8 cm mortero 1:5", 8),
  contrapiso("ARQ-07.01.08", "Contrapiso e=10 cm mortero 1:5", 10),
  p(
    "arquitectura",
    CAP,
    "ARQ-07.01.09",
    "Contrapiso e=5 cm con malla Q-106 y polietileno",
    "m²",
    r(
      ["MO-OPE", 0.26],
      ["MO-PEO", 0.32],
      ["MAT-CEM", 0.16],
      ["MAT-ARE", 0.028],
      ["MAT-AGU", 0.012],
      ["MAT-MALLPISO", 1.05],
      ["MAT-POLIET", 1.1],
      ["EQ-HIN", 5]
    )
  ),
  p(
    "arquitectura",
    CAP,
    "ARQ-07.01.10",
    "Falso piso e=4\" (10 cm) f'c 100 kg/cm²",
    "m²",
    r(
      ["MO-OPE", 0.22],
      ["MO-PEO", 0.32],
      ["MAT-CEM", 0.3],
      ["MAT-ARE", 0.055],
      ["MAT-HORM", 0.075],
      ["MAT-MALLPISO", 1.05],
      ["MAT-POLIET", 1.1],
      ["EQ-MEZ", 0.055],
      ["EQ-HIN", 5]
    )
  ),
  p(
    "arquitectura",
    CAP,
    "ARQ-07.01.11",
    "Falso piso e=6\" (15 cm) f'c 100 kg/cm²",
    "m²",
    r(
      ["MO-OPE", 0.28],
      ["MO-PEO", 0.4],
      ["MAT-CEM", 0.42],
      ["MAT-ARE", 0.08],
      ["MAT-HORM", 0.11],
      ["MAT-MALLPISO", 1.05],
      ["MAT-POLIET", 1.1],
      ["EQ-MEZ", 0.07],
      ["EQ-HIN", 5]
    )
  ),
];

/** Cerámicos: una partida por formato / acabado del catálogo. */
const CERAMICOS: Partida[] = [
  // —— 15 / 20 / 25 ——
  pisoCer("ARQ-07.10.01", "Piso cerámico 15×15 cm PEI III", "MAT-CER15", { mo: 0.52, peo: 0.4, fra: 0.5 }),
  pisoCer("ARQ-07.10.02", "Piso cerámico 20×20 cm PEI III beige", "MAT-CER20", { mo: 0.5, peo: 0.38, fra: 0.48 }),
  pisoCer("ARQ-07.10.03", "Piso cerámico 20×20 cm PEI III blanco", "MAT-CER20B", { mo: 0.5, peo: 0.38, fra: 0.48 }),
  pisoCer("ARQ-07.10.04", "Piso cerámico 20×20 cm PEI III gris", "MAT-CER20G", { mo: 0.5, peo: 0.38, fra: 0.48 }),
  pisoCer("ARQ-07.10.05", "Piso cerámico 25×25 cm PEI III beige", "MAT-CER25", { mo: 0.48, peo: 0.36, fra: 0.45 }),
  pisoCer("ARQ-07.10.06", "Piso cerámico 25×25 cm PEI III blanco", "MAT-CER25B", { mo: 0.48, peo: 0.36, fra: 0.45 }),
  pisoCer("ARQ-07.10.07", "Piso cerámico 33×33 cm PEI III beige", "MAT-CER3333", { mo: 0.46, peo: 0.35, fra: 0.42 }),

  // —— 30×30 (variantes de color; base ARQ-07.03.01 usa MAT-CER beige) ——
  pisoCer("ARQ-07.10.10", "Piso cerámico 30×30 cm PEI III blanco", "MAT-CER30B"),
  pisoCer("ARQ-07.10.11", "Piso cerámico 30×30 cm PEI III gris", "MAT-CER30G"),
  pisoCer("ARQ-07.10.12", "Piso cerámico 30×30 cm PEI III terracota", "MAT-CER30T"),
  pisoCer("ARQ-07.10.13", "Piso cerámico 30×30 cm PEI III imitación madera", "MAT-CER30M", { peg: 0.13 }),
  pisoCer("ARQ-07.10.14", "Piso cerámico 30×30 cm PEI IV antideslizante R11 (exterior)", "MAT-CERR11", {
    mo: 0.48,
    peo: 0.36,
    peg: 0.13,
  }),

  // —— 30×45 / 30×60 ——
  pisoCer("ARQ-07.10.20", "Piso cerámico 30×45 cm PEI III beige", "MAT-CER3045", { mo: 0.46, peo: 0.35 }),
  pisoCer("ARQ-07.10.21", "Piso cerámico 30×45 cm PEI III blanco", "MAT-CER3045B", { mo: 0.46, peo: 0.35 }),
  pisoCer("ARQ-07.10.22", "Piso cerámico 30×45 cm PEI III gris", "MAT-CER3045G", { mo: 0.46, peo: 0.35 }),
  pisoCer("ARQ-07.10.23", "Piso cerámico 30×60 cm PEI IV beige", "MAT-CER3060", { mo: 0.48, peo: 0.36, peg: 0.13, fra: 0.38 }),
  pisoCer("ARQ-07.10.24", "Piso cerámico 30×60 cm PEI IV blanco", "MAT-CER3060B", { mo: 0.48, peo: 0.36, peg: 0.13, fra: 0.38 }),
  pisoCer("ARQ-07.10.25", "Piso cerámico 30×60 cm PEI IV gris", "MAT-CER3060G", { mo: 0.48, peo: 0.36, peg: 0.13, fra: 0.38 }),
  pisoCer("ARQ-07.10.26", "Piso cerámico 30×60 cm PEI IV imitación madera", "MAT-CER3060M", {
    mo: 0.5,
    peo: 0.38,
    peg: 0.13,
    fra: 0.38,
  }),
  pisoCer("ARQ-07.10.27", "Piso cerámico 30×60 cm PEI IV antideslizante R11 (exterior)", "MAT-CER3060R11", {
    mo: 0.5,
    peo: 0.38,
    peg: 0.14,
  }),

  // —— 40 / 45 / 50 / 60 ——
  pisoCer("ARQ-07.10.30", "Piso cerámico 40×40 cm PEI IV beige", "MAT-CER40", { mo: 0.47, peo: 0.36, peg: 0.13, fra: 0.38 }),
  pisoCer("ARQ-07.10.31", "Piso cerámico 40×40 cm PEI IV blanco", "MAT-CER40B", { mo: 0.47, peo: 0.36, peg: 0.13, fra: 0.38 }),
  pisoCer("ARQ-07.10.32", "Piso cerámico 40×40 cm PEI IV gris", "MAT-CER40G", { mo: 0.47, peo: 0.36, peg: 0.13, fra: 0.38 }),
  pisoCer("ARQ-07.10.33", "Piso cerámico 45×45 cm PEI IV blanco", "MAT-CER45B", { mo: 0.48, peo: 0.36, peg: 0.13, fra: 0.38 }),
  pisoCer("ARQ-07.10.34", "Piso cerámico 45×45 cm PEI IV gris", "MAT-CER45G", { mo: 0.48, peo: 0.36, peg: 0.13, fra: 0.38 }),
  pisoCer("ARQ-07.10.35", "Piso cerámico 45×45 cm PEI IV imitación madera", "MAT-CER45M", {
    mo: 0.5,
    peo: 0.38,
    peg: 0.13,
    fra: 0.38,
  }),
  pisoCer("ARQ-07.10.36", "Piso cerámico 45×45 cm PEI III beige", "MAT-CER45III", { mo: 0.48, peo: 0.36, peg: 0.13 }),
  pisoCer("ARQ-07.10.37", "Piso cerámico 50×50 cm PEI IV beige", "MAT-CER50", { mo: 0.5, peo: 0.38, peg: 0.13, fra: 0.36 }),
  pisoCer("ARQ-07.10.38", "Piso cerámico 50×50 cm PEI IV blanco", "MAT-CER50B", { mo: 0.5, peo: 0.38, peg: 0.13, fra: 0.36 }),
  pisoCer("ARQ-07.10.39", "Piso cerámico 50×50 cm PEI IV gris", "MAT-CER50G", { mo: 0.5, peo: 0.38, peg: 0.13, fra: 0.36 }),
  pisoCer("ARQ-07.10.40", "Piso cerámico 60×60 cm PEI IV gris", "MAT-CER60", { mo: 0.52, peo: 0.4, peg: 0.14, fra: 0.35 }),
  pisoCer("ARQ-07.10.41", "Piso cerámico 60×60 cm PEI IV beige", "MAT-CER60B", { mo: 0.52, peo: 0.4, peg: 0.14, fra: 0.35 }),
  pisoCer("ARQ-07.10.42", "Piso cerámico 60×60 cm PEI IV blanco", "MAT-CER60W", { mo: 0.52, peo: 0.4, peg: 0.14, fra: 0.35 }),
  pisoCer("ARQ-07.10.43", "Piso cerámico 60×60 cm PEI IV imitación madera", "MAT-CER60M", {
    mo: 0.54,
    peo: 0.4,
    peg: 0.14,
    fra: 0.35,
  }),
  pisoCer("ARQ-07.10.44", "Piso cerámico 60×120 cm PEI IV mate cemento", "MAT-CER60120", {
    mo: 0.58,
    peo: 0.42,
    peg: 0.15,
    fra: 0.32,
  }),
  pisoCer("ARQ-07.10.45", "Piso cerámico 60×120 cm PEI IV imitación madera", "MAT-CER60120M", {
    mo: 0.58,
    peo: 0.42,
    peg: 0.15,
    fra: 0.32,
  }),

  // —— Mayólica como piso (ambientes húmedos) ——
  pisoCer("ARQ-07.10.50", "Piso de mayólica 20×20 cm (SS.HH. / cocina)", "MAT-MAY20", {
    moId: "MO-CER",
    mo: 0.5,
    peo: 0.36,
    peg: 0.13,
    fra: 0.45,
  }),
  pisoCer("ARQ-07.10.51", "Piso de mayólica 15×15 cm", "MAT-MAY15", {
    moId: "MO-CER",
    mo: 0.52,
    peo: 0.38,
    peg: 0.13,
    fra: 0.5,
  }),
  pisoCer("ARQ-07.10.52", "Piso de mayólica 30×30 cm", "MAT-MAY30", {
    moId: "MO-CER",
    mo: 0.48,
    peo: 0.36,
    peg: 0.13,
    fra: 0.42,
  }),
];

/** Porcelanatos por formato. */
const PORCELANATOS: Partida[] = [
  pisoPor("ARQ-07.11.01", "Piso porcelanato 30×30 cm PEI IV mate beige", "MAT-POR30", { mo: 0.5, peo: 0.38 }),
  pisoPor("ARQ-07.11.02", "Piso porcelanato 30×30 cm PEI IV mate blanco", "MAT-POR30B", { mo: 0.5, peo: 0.38 }),
  pisoPor("ARQ-07.11.03", "Piso porcelanato 30×30 cm PEI IV mate gris", "MAT-POR30G", { mo: 0.5, peo: 0.38 }),
  pisoPor("ARQ-07.11.04", "Piso porcelanato 30×60 cm PEI IV mate beige", "MAT-POR3060", { mo: 0.52, peo: 0.38 }),
  pisoPor("ARQ-07.11.05", "Piso porcelanato 30×60 cm PEI IV mate blanco", "MAT-POR3060B", { mo: 0.52, peo: 0.38 }),
  pisoPor("ARQ-07.11.06", "Piso porcelanato 30×60 cm PEI IV mate gris", "MAT-POR3060G", { mo: 0.52, peo: 0.38 }),
  pisoPor("ARQ-07.11.07", "Piso porcelanato 30×60 cm PEI IV imitación madera", "MAT-POR3060M", { mo: 0.54, peo: 0.4 }),
  pisoPor("ARQ-07.11.08", "Piso porcelanato 30×60 cm PEI IV antideslizante R11 (exterior)", "MAT-POR3060R11", {
    mo: 0.54,
    peo: 0.4,
    peg: 0.15,
  }),
  pisoPor("ARQ-07.11.10", "Piso porcelanato 45×45 cm PEI IV mate beige", "MAT-POR45", { mo: 0.52, peo: 0.38 }),
  pisoPor("ARQ-07.11.11", "Piso porcelanato 45×45 cm PEI IV mate blanco", "MAT-POR45B", { mo: 0.52, peo: 0.38 }),
  pisoPor("ARQ-07.11.12", "Piso porcelanato 45×45 cm PEI IV mate gris", "MAT-POR45G", { mo: 0.52, peo: 0.38 }),
  pisoPor("ARQ-07.11.13", "Piso porcelanato 50×50 cm PEI IV mate beige", "MAT-POR50", { mo: 0.54, peo: 0.4 }),

  // —— 60×60 variantes (base ARQ-07.03.03 usa MAT-POR beige) ——
  pisoPor("ARQ-07.11.20", "Piso porcelanato 60×60 cm PEI IV mate blanco", "MAT-POR60B"),
  pisoPor("ARQ-07.11.21", "Piso porcelanato 60×60 cm PEI IV mate gris", "MAT-POR60G"),
  pisoPor("ARQ-07.11.22", "Piso porcelanato 60×60 cm PEI IV mate cemento", "MAT-POR60C"),
  pisoPor("ARQ-07.11.23", "Piso porcelanato 60×60 cm PEI IV mate negro", "MAT-POR60N"),
  pisoPor("ARQ-07.11.24", "Piso porcelanato 60×60 cm PEI IV imitación madera", "MAT-POR60M", { mo: 0.58, peo: 0.42 }),
  pisoPor("ARQ-07.11.25", "Piso porcelanato 60×60 cm PEI IV pulido mármol calacatta", "MAT-POR60CAL", {
    mo: 0.62,
    peo: 0.45,
    peg: 0.15,
    fra: 0.3,
  }),
  pisoPor("ARQ-07.11.26", "Piso porcelanato 60×60 cm PEI IV pulido mármol statuario", "MAT-POR60STA", {
    mo: 0.62,
    peo: 0.45,
    peg: 0.15,
    fra: 0.3,
  }),
  pisoPor("ARQ-07.11.27", "Piso porcelanato 60×60 cm PEI IV pulido mármol carrara", "MAT-POR60CAR", {
    mo: 0.62,
    peo: 0.45,
    peg: 0.15,
    fra: 0.3,
  }),
  pisoPor("ARQ-07.11.28", "Piso porcelanato 60×60 cm PEI IV mate travertino", "MAT-POR60TRA", { mo: 0.58, peo: 0.42 }),
  pisoPor("ARQ-07.11.29", "Piso porcelanato 60×60 cm PEI III mate beige (residencial ligero)", "MAT-POR60III", {
    mo: 0.52,
    peo: 0.38,
  }),
  pisoPor("ARQ-07.11.30", "Piso porcelanato 60×60 cm PEI V mate gris (alto tráfico)", "MAT-POR60V", {
    mo: 0.58,
    peo: 0.42,
    peg: 0.15,
  }),
  pisoPor("ARQ-07.11.31", "Piso porcelanato 60×60 cm PEI IV antideslizante R11 (exterior)", "MAT-POR60R11", {
    mo: 0.58,
    peo: 0.42,
    peg: 0.15,
  }),
  pisoPor("ARQ-07.11.32", "Piso porcelanato 60×60 cm PEI V antideslizante R11 (exterior)", "MAT-PORR11", {
    mo: 0.6,
    peo: 0.44,
    peg: 0.15,
  }),

  // —— 80 / 90 / grandes formatos ——
  pisoPor("ARQ-07.11.40", "Piso porcelanato 80×80 cm PEI IV pulido beige", "MAT-POR80", {
    mo: 0.65,
    peo: 0.48,
    peg: 0.16,
    fra: 0.28,
  }),
  pisoPor("ARQ-07.11.41", "Piso porcelanato 80×80 cm PEI IV pulido blanco", "MAT-POR80B", {
    mo: 0.65,
    peo: 0.48,
    peg: 0.16,
    fra: 0.28,
  }),
  pisoPor("ARQ-07.11.42", "Piso porcelanato 80×80 cm PEI IV pulido gris", "MAT-POR80G", {
    mo: 0.65,
    peo: 0.48,
    peg: 0.16,
    fra: 0.28,
  }),
  pisoPor("ARQ-07.11.43", "Piso porcelanato 80×80 cm PEI IV pulido negro", "MAT-POR80N", {
    mo: 0.65,
    peo: 0.48,
    peg: 0.16,
    fra: 0.28,
  }),
  pisoPor("ARQ-07.11.44", "Piso porcelanato 80×80 cm PEI IV pulido mármol calacatta", "MAT-POR80CAL", {
    mo: 0.68,
    peo: 0.5,
    peg: 0.16,
    fra: 0.28,
  }),
  pisoPor("ARQ-07.11.45", "Piso porcelanato 80×80 cm PEI IV mate cemento", "MAT-POR80C", {
    mo: 0.65,
    peo: 0.48,
    peg: 0.16,
    fra: 0.28,
  }),
  pisoPor("ARQ-07.11.46", "Piso porcelanato 80×80 cm PEI V mate gris (alto tráfico)", "MAT-POR80V", {
    mo: 0.68,
    peo: 0.5,
    peg: 0.16,
  }),
  pisoPor("ARQ-07.11.47", "Piso porcelanato 80×80 cm PEI IV imitación madera", "MAT-POR80M", {
    mo: 0.66,
    peo: 0.48,
    peg: 0.16,
  }),
  pisoPor("ARQ-07.11.50", "Piso porcelanato 90×90 cm PEI IV pulido beige rectificado", "MAT-POR90", {
    mo: 0.72,
    peo: 0.52,
    peg: 0.17,
    fra: 0.25,
  }),
  pisoPor("ARQ-07.11.51", "Piso porcelanato 90×90 cm PEI IV pulido mármol calacatta", "MAT-POR90CAL", {
    mo: 0.75,
    peo: 0.55,
    peg: 0.17,
    fra: 0.25,
  }),
  pisoPor("ARQ-07.11.52", "Piso porcelanato 90×90 cm PEI IV mate gris rectificado", "MAT-POR90G", {
    mo: 0.72,
    peo: 0.52,
    peg: 0.17,
    fra: 0.25,
  }),
  pisoPor("ARQ-07.11.53", "Piso porcelanato 90×90 cm PEI IV pulido blanco rectificado", "MAT-POR90B", {
    mo: 0.72,
    peo: 0.52,
    peg: 0.17,
    fra: 0.25,
  }),
  pisoPor("ARQ-07.11.60", "Piso porcelanato 60×120 cm PEI IV mate cemento", "MAT-POR120", {
    mo: 0.7,
    peo: 0.5,
    peg: 0.16,
    fra: 0.28,
  }),
  pisoPor("ARQ-07.11.61", "Piso porcelanato 60×120 cm PEI IV pulido blanco", "MAT-POR120B", {
    mo: 0.72,
    peo: 0.52,
    peg: 0.16,
    fra: 0.28,
  }),
  pisoPor("ARQ-07.11.62", "Piso porcelanato 60×120 cm PEI IV mate gris", "MAT-POR120G", {
    mo: 0.7,
    peo: 0.5,
    peg: 0.16,
    fra: 0.28,
  }),
  pisoPor("ARQ-07.11.63", "Piso porcelanato 60×120 cm PEI IV pulido calacatta", "MAT-POR120CAL", {
    mo: 0.75,
    peo: 0.55,
    peg: 0.17,
    fra: 0.25,
  }),
  pisoPor("ARQ-07.11.64", "Piso porcelanato 60×120 cm PEI IV imitación madera", "MAT-POR120M", {
    mo: 0.72,
    peo: 0.52,
    peg: 0.16,
  }),
  pisoPor("ARQ-07.11.65", "Piso porcelanato 60×120 cm PEI V mate gris", "MAT-POR120V", {
    mo: 0.75,
    peo: 0.55,
    peg: 0.17,
  }),
  pisoPor("ARQ-07.11.70", "Piso porcelanato listón 20×120 cm PEI IV imitación madera", "MAT-POR20120", {
    mo: 0.68,
    peo: 0.5,
    peg: 0.16,
  }),
  pisoPor("ARQ-07.11.71", "Piso porcelanato listón 15×120 cm PEI IV imitación madera", "MAT-POR15120", {
    mo: 0.7,
    peo: 0.52,
    peg: 0.16,
  }),
  pisoPor("ARQ-07.11.72", "Piso porcelanato listón 15×90 cm PEI IV imitación madera", "MAT-POR1590", {
    mo: 0.65,
    peo: 0.48,
    peg: 0.15,
  }),
  pisoPor("ARQ-07.11.73", "Piso porcelanato listón 20×90 cm PEI IV imitación madera", "MAT-POR2090", {
    mo: 0.65,
    peo: 0.48,
    peg: 0.15,
  }),
  pisoPor("ARQ-07.11.74", "Piso porcelanato listón 30×120 cm PEI IV imitación madera", "MAT-POR30120", {
    mo: 0.7,
    peo: 0.5,
    peg: 0.16,
  }),
  pisoPor("ARQ-07.11.80", "Piso porcelanato 100×100 cm PEI IV pulido beige rectificado", "MAT-POR100", {
    mo: 0.85,
    peo: 0.6,
    peg: 0.18,
    fra: 0.22,
  }),
  pisoPor("ARQ-07.11.81", "Piso porcelanato 100×100 cm PEI IV pulido mármol calacatta", "MAT-POR100CAL", {
    mo: 0.9,
    peo: 0.65,
    peg: 0.18,
    fra: 0.22,
  }),
  pisoPor("ARQ-07.11.82", "Piso porcelanato 120×120 cm PEI IV pulido beige rectificado", "MAT-POR120120", {
    mo: 0.95,
    peo: 0.7,
    peg: 0.2,
    fra: 0.2,
  }),
];

/** Mayólica mural por formato. */
const MAYOLICAS_MURO: Partida[] = [
  mayolicaMuro("ARQ-08.10.01", "Mayólica mural 15×15 cm blanco brillante", "MAT-MAY15", { mo: 0.55, peo: 0.4, fra: 0.5 }),
  mayolicaMuro("ARQ-08.10.02", "Mayólica mural 15×15 cm beige", "MAT-MAY15B", { mo: 0.55, peo: 0.4, fra: 0.5 }),
  mayolicaMuro("ARQ-08.10.03", "Mayólica mural 20×20 cm beige", "MAT-MAY20B"),
  mayolicaMuro("ARQ-08.10.04", "Mayólica mural 20×20 cm gris", "MAT-MAY20G"),
  mayolicaMuro("ARQ-08.10.05", "Mayólica mural 20×20 cm celeste", "MAT-MAY20C"),
  mayolicaMuro("ARQ-08.10.06", "Mayólica mural 20×20 cm verde agua", "MAT-MAY20V"),
  mayolicaMuro("ARQ-08.10.07", "Mayólica mural 20×20 cm subway / metro blanco", "MAT-MAYSUB", { mo: 0.55, peo: 0.4 }),
  mayolicaMuro("ARQ-08.10.08", "Mayólica mural 20×25 cm blanco brillante", "MAT-MAY2025"),
  mayolicaMuro("ARQ-08.10.09", "Mayólica mural 20×30 cm blanco brillante", "MAT-MAY2030"),
  mayolicaMuro("ARQ-08.10.10", "Mayólica mural 20×30 cm beige", "MAT-MAY2030B"),
  mayolicaMuro("ARQ-08.10.11", "Mayólica mural 25×25 cm blanco brillante", "MAT-MAY25"),
  mayolicaMuro("ARQ-08.10.12", "Mayólica mural 25×25 cm beige", "MAT-MAY25B"),
  mayolicaMuro("ARQ-08.10.13", "Mayólica mural 25×40 cm blanco brillante", "MAT-MAY2540"),
  mayolicaMuro("ARQ-08.10.14", "Mayólica mural 25×40 cm beige", "MAT-MAY2540B"),
  mayolicaMuro("ARQ-08.10.15", "Mayólica mural 25×40 cm gris", "MAT-MAY2540G"),
  mayolicaMuro("ARQ-08.10.16", "Mayólica mural 25×40 cm decorada cocina", "MAT-MAY2540D", { peg: 0.14 }),
  mayolicaMuro("ARQ-08.10.20", "Mayólica mural 30×30 cm blanco brillante", "MAT-MAY30", { mo: 0.5, peo: 0.36, fra: 0.4 }),
  mayolicaMuro("ARQ-08.10.21", "Mayólica mural 30×30 cm beige", "MAT-MAY30B", { mo: 0.5, peo: 0.36, fra: 0.4 }),
  mayolicaMuro("ARQ-08.10.22", "Mayólica mural 30×30 cm gris", "MAT-MAY30G", { mo: 0.5, peo: 0.36, fra: 0.4 }),
  mayolicaMuro("ARQ-08.10.23", "Mayólica mural 30×45 cm blanco brillante", "MAT-MAY3045", { mo: 0.5, peo: 0.36, fra: 0.4 }),
  mayolicaMuro("ARQ-08.10.24", "Mayólica mural 30×45 cm beige", "MAT-MAY3045B", { mo: 0.5, peo: 0.36, fra: 0.4 }),
  mayolicaMuro("ARQ-08.10.25", "Mayólica mural 30×45 cm gris", "MAT-MAY3045G", { mo: 0.5, peo: 0.36, fra: 0.4 }),
  mayolicaMuro("ARQ-08.10.26", "Mayólica mural 30×60 cm blanco mate", "MAT-MAY3060", { mo: 0.52, peo: 0.38, fra: 0.38 }),
  mayolicaMuro("ARQ-08.10.27", "Mayólica mural 30×60 cm beige", "MAT-MAY3060B", { mo: 0.52, peo: 0.38, fra: 0.38 }),
  mayolicaMuro("ARQ-08.10.28", "Mayólica mural 30×60 cm gris", "MAT-MAY3060G", { mo: 0.52, peo: 0.38, fra: 0.38 }),
  mayolicaMuro("ARQ-08.10.29", "Mayólica mural 30×60 cm imitación mármol", "MAT-MAY3060M", {
    mo: 0.54,
    peo: 0.4,
    peg: 0.14,
    fra: 0.38,
  }),
  mayolicaMuro("ARQ-08.10.30", "Mayólica mural 40×40 cm blanco mate", "MAT-MAY40", { mo: 0.52, peo: 0.38, fra: 0.38 }),
  mayolicaMuro("ARQ-08.10.31", "Mayólica mural 40×40 cm beige", "MAT-MAY40B", { mo: 0.52, peo: 0.38, fra: 0.38 }),
  mayolicaMuro("ARQ-08.10.32", "Mayólica mural 45×45 cm blanco mate", "MAT-MAY45", { mo: 0.54, peo: 0.4, fra: 0.36 }),
  mayolicaMuro("ARQ-08.10.33", "Mayólica mural 60×60 cm blanco mate", "MAT-MAY60", { mo: 0.58, peo: 0.42, fra: 0.35 }),
  mayolicaMuro("ARQ-08.10.40", "Mosaico mayólica 2.5×2.5 cm sobre malla (baño)", "MAT-MAYMOS", {
    mo: 0.7,
    peo: 0.5,
    peg: 0.15,
    fra: 0.55,
  }),
  p(
    "arquitectura",
    CAP_ZOC,
    "ARQ-08.10.41",
    "Listelo / cenefa de mayólica 5×20 cm",
    "m",
    r(["MO-ALB", 0.15], ["MO-PEO", 0.1], ["MAT-MAYLIST", 1.05], ["MAT-PEG", 0.025], ["MAT-FRA", 0.06], ["EQ-HIN", 5])
  ),
];

const ZOCALOS: Partida[] = [
  zocalo("ARQ-08.11.01", "Zócalo de mayólica h=0.10 m (8×20 cm) blanco", "MAT-ZOCMAY"),
  zocalo("ARQ-08.11.02", "Zócalo de mayólica h=0.10 m (10×20 cm) blanco", "MAT-ZOCMAY10"),
  zocalo("ARQ-08.11.03", "Zócalo de mayólica h=0.10 m (8×30 cm) blanco", "MAT-ZOCMAY30"),
  zocalo("ARQ-08.11.04", "Zócalo cerámico h=0.10 m (8×30 cm) beige", "MAT-ZOC"),
  zocalo("ARQ-08.11.05", "Zócalo cerámico h=0.10 m (8×30 cm) blanco", "MAT-ZOCC30"),
  zocalo("ARQ-08.11.06", "Zócalo cerámico h=0.10 m (8×45 cm) beige", "MAT-ZOCC45"),
  zocalo("ARQ-08.11.07", "Zócalo cerámico h=0.10 m (8×60 cm) beige", "MAT-ZOCC60"),
  zocalo("ARQ-08.11.08", "Zócalo de porcelanato h=0.10 m (8×60 cm) beige", "MAT-ZOCPOR", 0.025, 0.04),
  zocalo("ARQ-08.11.09", "Zócalo de porcelanato h=0.10 m (8×45 cm) beige", "MAT-ZOCPOR45", 0.025, 0.04),
  zocalo("ARQ-08.11.10", "Zócalo de porcelanato h=0.10 m (8×80 cm) beige", "MAT-ZOCPOR80", 0.025, 0.04),
  zocalo("ARQ-08.11.11", "Zócalo de porcelanato h=0.10 m (8×120 cm) beige", "MAT-ZOCPOR120", 0.025, 0.04),
];

export const PARTIDAS_PISOS: Partida[] = [
  ...CONTRAPISOS,
  ...CERAMICOS,
  ...PORCELANATOS,
  ...MAYOLICAS_MURO,
  ...ZOCALOS,
];
