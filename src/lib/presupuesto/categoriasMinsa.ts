import { desdeEquipamiento } from "./partidasEquipamiento";

/** NTS N° 021-MINSA/DGSP-V.03 (RM 546-2011). Una categoría ≠ un hospital genérico. */

export const CATEGORIAS_MINSA = [
  "I-1",
  "I-2",
  "I-3",
  "I-4",
  "II-1",
  "II-2",
  "II-E",
  "III-1",
  "III-E",
  "III-2",
] as const;

export type CategoriaMinsa = (typeof CATEGORIAS_MINSA)[number];

export type MetaCategoriaMinsa = {
  id: CategoriaMinsa;
  plantillaId: string;
  nivel: 1 | 2 | 3;
  nombre: string;
  alias: string;
  obra: string;
  resumen: string;
  upss: string[];
  especialidades: string[];
  noTiene: string[];
  norma: string;
};

const RANK: Record<CategoriaMinsa, number> = {
  "I-1": 1,
  "I-2": 2,
  "I-3": 3,
  "I-4": 4,
  "II-1": 5,
  "II-2": 6,
  "II-E": 6,
  "III-1": 7,
  "III-E": 7,
  "III-2": 8,
};

export const CATEGORIA_MINSA_META: Record<CategoriaMinsa, MetaCategoriaMinsa> = {
  "I-1": {
    id: "I-1",
    plantillaId: "minsa-i-1",
    nivel: 1,
    nombre: "I-1 · Puesto de salud",
    alias: "Puesto de salud",
    obra: "Puesto de salud categoría I-1 — 1 piso, 140 m²",
    resumen:
      "Consulta externa básica. Sin médico especialista, sin laboratorio propio, sin internamiento, sin QX ni imagen.",
    upss: ["Consulta externa (atención ambulatoria básica)"],
    especialidades: ["Atención integral por profesional de salud no médico (técnico / enfermería según oferta)"],
    noTiene: [
      "Internamiento",
      "Emergencia 24 h",
      "Quirófano",
      "UCI",
      "Laboratorio propio",
      "Rayos X / TAC / RM",
      "Gases medicinales de red",
      "Grupo electrógeno / ATS",
      "Ascensor",
    ],
    norma: "NTS 021-MINSA/DGSP-V.03 · NTS 110-MINSA/DGIEM (1.er nivel)",
  },
  "I-2": {
    id: "I-2",
    plantillaId: "minsa-i-2",
    nivel: 1,
    nombre: "I-2 · Puesto / centro con médico",
    alias: "Puesto de salud con médico",
    obra: "Establecimiento I-2 — 1 piso, 320 m²",
    resumen: "Consulta externa con médico cirujano. Tópico, observación breve. Laboratorio tercerizado. Sin internamiento.",
    upss: ["Consulta externa con médico cirujano"],
    especialidades: ["Medicina general (médico cirujano)", "Enfermería", "Obstetricia según oferta"],
    noTiene: ["Internamiento 24 h", "Centro quirúrgico", "UCI", "TAC / RM", "Banco de sangre", "Planta de oxígeno"],
    norma: "NTS 021-MINSA/DGSP-V.03 · NTS 110-MINSA/DGIEM (1.er nivel)",
  },
  "I-3": {
    id: "I-3",
    plantillaId: "minsa-i-3",
    nivel: 1,
    nombre: "I-3 · Centro de salud",
    alias: "Centro de salud",
    obra: "Centro de salud I-3 — 2 pisos, 980 m²",
    resumen: "Consulta + patología clínica (propia o tercerizada). Odontología y laboratorio básico. Sin internamiento.",
    upss: ["Consulta externa", "Patología clínica (propia o tercerizada)"],
    especialidades: ["Medicina general", "Pediatría / Gineco-obstetricia según oferta", "Odontología", "Laboratorio clínico"],
    noTiene: ["Hospitalización 24 h", "Centro quirúrgico", "UCI", "TAC / RM", "Banco de sangre"],
    norma: "NTS 021-MINSA/DGSP-V.03 · NTS 110-MINSA/DGIEM (1.er nivel)",
  },
  "I-4": {
    id: "I-4",
    plantillaId: "minsa-i-4",
    nivel: 1,
    nombre: "I-4 · Centro de salud con internamiento",
    alias: "Centro de salud materno infantil / con internamiento",
    obra: "Centro de salud I-4 — 3 pisos, 1 850 m²",
    resumen: "Consulta, laboratorio, farmacia e internamiento limitado. Partos y observación. Sin UCI ni tomógrafo.",
    upss: ["Consulta externa", "Patología clínica", "Farmacia", "Internamiento / observación"],
    especialidades: ["Medicina general", "Gineco-obstetricia", "Pediatría", "Odontología", "Farmacia"],
    noTiene: ["UCI", "Centro quirúrgico de hospital", "TAC / RM / mamógrafo", "Planta PSA", "Banco de sangre completo"],
    norma: "NTS 021-MINSA/DGSP-V.03 · NTS 110-MINSA/DGIEM (1.er nivel)",
  },
  "II-1": {
    id: "II-1",
    plantillaId: "minsa-ii-1",
    nivel: 2,
    nombre: "II-1 · Hospital I",
    alias: "Hospital de atención general I",
    obra: "Hospital categoría II-1 — 4 pisos, 5 600 m²",
    resumen:
      "Hospital general: emergencia 24 h, hospitalización, centro obstétrico y quirúrgico, imágenes básicas y banco de sangre.",
    upss: [
      "Consulta externa",
      "Emergencia 24 h",
      "Hospitalización",
      "Centro obstétrico",
      "Centro quirúrgico",
      "Medicina de rehabilitación",
      "Diagnóstico por imágenes",
      "Patología clínica",
      "Farmacia",
      "Centro de hemoterapia y banco de sangre",
      "Nutrición y dietética",
      "Central de esterilización",
    ],
    especialidades: ["Medicina interna", "Cirugía general", "Gineco-obstetricia", "Pediatría", "Anestesiología", "Odontología"],
    noTiene: ["UCI completa", "TAC / RM", "Arco en C de rutina", "Planta PSA", "Medicina nuclear / radioterapia"],
    norma: "NTS 021-MINSA/DGSP-V.03 · NTS 113-MINSA/DGIEM (2.º nivel)",
  },
  "II-2": {
    id: "II-2",
    plantillaId: "minsa-ii-2",
    nivel: 2,
    nombre: "II-2 · Hospital II",
    alias: "Hospital de atención general II",
    obra: "Hospital categoría II-2 — 5 pisos, 9 800 m²",
    resumen: "Hospital II: UCI, TAC, arco en C, planta de oxígeno y más especialidades que el II-1.",
    upss: [
      "Todas las UPSS del II-1",
      "Unidad de cuidados intensivos",
      "Diagnóstico por imágenes de mayor complejidad (TAC)",
      "Planta de oxígeno / gases medicinales",
    ],
    especialidades: ["Las del II-1", "UCI / cuidados críticos", "Traumatología / otras especialidades según oferta"],
    noTiene: ["Resonador magnético de instituto", "Radioterapia", "Medicina nuclear"],
    norma: "NTS 021-MINSA/DGSP-V.03 · NTS 113-MINSA/DGIEM (2.º nivel)",
  },
  "II-E": {
    id: "II-E",
    plantillaId: "minsa-ii-e",
    nivel: 2,
    nombre: "II-E · Hospital especializado II",
    alias: "Hospital de atención especializada II",
    obra: "Hospital especializado II-E — 4 pisos, 6 200 m²",
    resumen: "Segundo nivel especializado (materno, oncológico, pediátrico, etc.). Equipamiento según la especialidad eje.",
    upss: ["Consulta externa especializada", "Hospitalización", "Apoyo diagnóstico de la especialidad", "Emergencia según perfil"],
    especialidades: ["Especialidad eje del establecimiento (no es hospital general)"],
    noTiene: ["Oferta general de un II-2 si no está en el perfil", "RM / radioterapia salvo que el perfil lo exija"],
    norma: "NTS 021-MINSA/DGSP-V.03 · NTS 113-MINSA/DGIEM (2.º nivel)",
  },
  "III-1": {
    id: "III-1",
    plantillaId: "minsa-iii-1",
    nivel: 3,
    nombre: "III-1 · Hospital III / nacional",
    alias: "Hospital de atención general III",
    obra: "Hospital categoría III-1 — 7 pisos, 18 500 m²",
    resumen: "Alta complejidad: UCI, RM, PSA, UPS y ATS de gran amperaje. Hospital nacional o regional de referencia.",
    upss: ["UPSS de hospital de alta complejidad", "UCI", "Imágenes avanzadas (TAC, RM)", "Gases medicinales centralizados"],
    especialidades: ["Especialidades y subespecialidades de hospital nacional / regional"],
    noTiene: ["No se asume radioterapia ni PET si el plano no los dibuja"],
    norma: "NTS 021-MINSA/DGSP-V.03 · NTS 119-MINSA/DGIEM (3.er nivel)",
  },
  "III-E": {
    id: "III-E",
    plantillaId: "minsa-iii-e",
    nivel: 3,
    nombre: "III-E · Instituto especializado",
    alias: "Instituto de atención especializada",
    obra: "Instituto especializado III-E — 6 pisos, 14 000 m²",
    resumen: "Tercer nivel especializado (cardiología, cáncer, neurología, etc.). Equipos de alta complejidad del perfil.",
    upss: ["Consulta y hospitalización de la especialidad", "UCI del perfil", "Imágenes y apoyo de alta complejidad"],
    especialidades: ["Especialidad eje del instituto"],
    noTiene: ["Oferta general de un hospital III-1 si no está en el perfil"],
    norma: "NTS 021-MINSA/DGSP-V.03 · NTS 119-MINSA/DGIEM (3.er nivel)",
  },
  "III-2": {
    id: "III-2",
    plantillaId: "minsa-iii-2",
    nivel: 3,
    nombre: "III-2 · Instituto nacional",
    alias: "Instituto especializado nacional",
    obra: "Instituto nacional III-2 — 8 pisos, 26 000 m²",
    resumen: "Máxima complejidad: instituto nacional (INEN, INCOR, etc.). Docencia, investigación y equipamiento de referencia.",
    upss: ["Todas las UPSS del perfil nacional", "Docencia e investigación", "Imágenes y terapia de máxima complejidad"],
    especialidades: ["Subespecialidades del instituto nacional", "Docencia e investigación"],
    noTiene: ["Nada se inventa: solo lo que el plano o el perfil del instituto justifique"],
    norma: "NTS 021-MINSA/DGSP-V.03 · NTS 119-MINSA/DGIEM (3.er nivel)",
  },
};

/** Código AE (IM-09.01.NN) → categoría mínima que lo tiene en plantilla / catálogo filtrado. */
const AE_DESDE: Record<string, CategoriaMinsa> = {
  "01": "I-3",
  "02": "I-2",
  "03": "I-4",
  "04": "II-2",
  "05": "II-1",
  "06": "I-4",
  "07": "II-2",
  "08": "I-4",
  "09": "II-2",
  "10": "I-4",
  "11": "II-1",
  "12": "II-1",
  "13": "I-4",
  "14": "II-1",
  "15": "II-1",
  "16": "II-1",
  "17": "II-1",
  "18": "II-1",
  "19": "I-2",
  "20": "II-1",
  "21": "I-4",
  "22": "II-1",
  "23": "I-4",
  "24": "II-2",
  "25": "I-3",
  "26": "II-2",
  "27": "II-2",
  "28": "III-1",
  "29": "III-1",
  "30": "I-3",
  "31": "I-3",
  "32": "II-2",
  "33": "I-3",
  "34": "I-3",
  "35": "II-1",
  "36": "III-1",
  "37": "II-1",
  "38": "I-3",
  "39": "III-1",
  "40": "III-1",
  "41": "I-2",
  "42": "I-1",
  "43": "I-2",
  "44": "I-3",
  "45": "I-4",
  "46": "I-1",
  "47": "I-1",
  "48": "I-1",
  "49": "I-2",
  "50": "I-2",
  "51": "I-1",
  "52": "I-3",
  "53": "I-3",
  "54": "I-3",
  "55": "I-3",
  "56": "I-3",
  "57": "I-3",
  "58": "I-4",
  "59": "II-1",
  "60": "II-2",
  "61": "II-1",
  "62": "II-2",
  "63": "I-1",
  "64": "I-1",
  "65": "I-1",
  "66": "I-4",
  "67": "I-1",
  "68": "I-4",
  "69": "I-1",
  "70": "I-1",
  "71": "I-1",
  "72": "I-1",
  "73": "I-1",
  "74": "I-1",
  "75": "I-1",
};

const CODIGO_DESDE: Record<string, CategoriaMinsa> = {
  "IM-08.01.01": "II-2",
  "IM-08.01.02": "III-1",
  "IM-08.01.03": "III-1",
  "IM-08.01.04": "II-1",
  "IM-08.02.01": "II-1",
  "IM-08.02.02": "II-1",
  "IM-08.02.03": "II-1",
  "IM-08.02.04": "II-1",
  "IM-08.03.01": "II-1",
  "IM-08.03.02": "II-1",
  "IM-08.04.01": "II-1",
  "IM-08.04.02": "II-1",
  "IE-06.01.01": "I-4",
  "IE-06.01.02": "I-4",
  "IE-06.01.03": "II-1",
  "IE-06.01.04": "II-1",
  "IE-06.01.05": "II-2",
  "IE-06.02.01": "III-1",
  "IE-06.02.02": "III-1",
  "IE-06.02.03": "III-2",
  "IE-06.03.01": "I-3",
  "IE-06.04.01": "II-2",
  "IE-06.04.02": "III-1",
  "IE-07.01.01": "I-4",
  "IE-07.01.02": "I-4",
  "IE-07.01.03": "II-1",
  "IE-07.01.04": "II-1",
  "IE-07.01.05": "II-2",
  "IE-07.01.06": "II-2",
  "IE-07.01.07": "III-1",
  "IE-07.01.08": "III-1",
  "IE-07.02.01": "I-4",
  "IE-07.02.02": "II-1",
};

export function esCategoriaMinsa(v: string | null | undefined): v is CategoriaMinsa {
  return !!v && (CATEGORIAS_MINSA as readonly string[]).includes(v);
}

export function rankMinsa(cat: CategoriaMinsa) {
  return RANK[cat];
}

function desdeDeCodigo(codigo: string): CategoriaMinsa | null {
  const ae = codigo.match(/^IM-09\.01\.(\d{2})$/);
  if (ae) return AE_DESDE[ae[1]] ?? null;
  return CODIGO_DESDE[codigo] ?? null;
}

/** Si no hay regla, el código es de obra general y entra en todas las categorías. */
export function partidaPermitidaEnCategoria(codigo: string, cat: CategoriaMinsa) {
  const desde = desdeDeCodigo(codigo) ?? desdeEquipamiento(codigo);
  if (!desde) return true;
  return RANK[cat] >= RANK[desde];
}

export function detectarCategoriaMinsa(...textos: string[]): CategoriaMinsa | null {
  const t = textos.join(" ").toLowerCase().replace(/\s+/g, " ");
  const rules: [RegExp, CategoriaMinsa][] = [
    [/\biii[\s.-]*2\b|\biii[\s.-]*ii\b|instituto nacional|inen\b|incor\b|inn\b/, "III-2"],
    [/\biii[\s.-]*e\b|instituto especializado/, "III-E"],
    [/\biii[\s.-]*1\b|\biii[\s.-]*i\b|hospital nacional|hospital regional de referencia/, "III-1"],
    [/\bii[\s.-]*e\b|hospital especializado/, "II-E"],
    [/\bii[\s.-]*2\b|\bii[\s.-]*ii\b|hospital ii\b/, "II-2"],
    [/\bii[\s.-]*1\b|\bii[\s.-]*i\b|hospital i\b/, "II-1"],
    [/\bi[\s.-]*4\b|centro de salud.*(intern|materno)|csm i[\s.-]*4/, "I-4"],
    [/\bi[\s.-]*3\b|centro de salud(?!.*(intern|materno))/, "I-3"],
    [/\bi[\s.-]*2\b|puesto.*m[eé]dico/, "I-2"],
    [/\bi[\s.-]*1\b|puesto de salud/, "I-1"],
  ];
  for (const [re, cat] of rules) {
    if (re.test(t)) return cat;
  }
  return null;
}

export function plantillaIdDeCategoria(cat: CategoriaMinsa) {
  return CATEGORIA_MINSA_META[cat].plantillaId;
}

function ae(n: string, qty: number) {
  return { codigo: `IM-09.01.${n}`, metrado: qty };
}

/** Semilla de plantilla: cantidades típicas, no un hospital concreto. El plano manda en PRE-00. */
export function extrasMinsa(cat: CategoriaMinsa): { codigo: string; metrado: number }[] {
  const out: { codigo: string; metrado: number }[] = [];
  const add = (codigo: string, metrado: number) => {
    if (metrado <= 0 || !partidaPermitidaEnCategoria(codigo, cat)) return;
    const prev = out.find((e) => e.codigo === codigo);
    if (prev) prev.metrado = metrado;
    else out.push({ codigo, metrado });
  };

  if (RANK[cat] >= RANK["I-1"]) {
    add(ae("42", 1).codigo, 1);
    add(ae("46", 1).codigo, 1);
    add(ae("47", 1).codigo, 1);
    add(ae("48", 1).codigo, 1);
    add(ae("51", 1).codigo, RANK[cat] >= RANK["I-3"] ? 4 : 2);
    add(ae("63", 1).codigo, RANK[cat] >= RANK["II-1"] ? 8 : 1);
    add(ae("64", 1).codigo, RANK[cat] >= RANK["I-4"] ? 4 : 1);
    add(ae("65", 1).codigo, RANK[cat] >= RANK["I-3"] ? 6 : 2);
    add(ae("67", 1).codigo, RANK[cat] >= RANK["I-4"] ? 8 : 2);
    add("IM-09.01.69", RANK[cat] >= RANK["I-3"] ? 2 : 1);
    add("IM-09.01.70", RANK[cat] >= RANK["I-3"] ? 4 : 1);
    add("IM-09.01.71", RANK[cat] >= RANK["I-2"] ? 2 : 1);
    add("IM-09.01.72", RANK[cat] >= RANK["I-3"] ? 3 : 1);
    add("IM-09.01.73", 1);
    add("IM-09.01.74", RANK[cat] >= RANK["I-4"] ? 4 : 1);
    add("IM-09.01.75", RANK[cat] >= RANK["I-3"] ? 4 : 1);
  }
  if (RANK[cat] >= RANK["I-2"]) {
    add("IM-09.01.02", 1);
    add("IM-09.01.19", 1);
    add("IM-09.01.41", RANK[cat] >= RANK["I-4"] ? 3 : 1);
    add("IM-09.01.43", 1);
    add("IM-09.01.49", 1);
    add("IM-09.01.50", RANK[cat] >= RANK["I-4"] ? 2 : 1);
  }
  if (RANK[cat] >= RANK["I-3"]) {
    add("IM-09.01.01", RANK[cat] >= RANK["II-1"] ? 12 : 2);
    add("IM-09.01.25", RANK[cat] >= RANK["II-1"] ? 3 : 1);
    add("IM-09.01.30", 1);
    add("IM-09.01.31", 1);
    add("IM-09.01.33", 1);
    add("IM-09.01.34", 1);
    add("IM-09.01.38", 1);
    add("IM-09.01.44", RANK[cat] >= RANK["II-1"] ? 4 : 1);
    add("IM-09.01.52", 1);
    add("IM-09.01.53", 1);
    add("IM-09.01.54", 1);
    add("IM-09.01.55", 2);
    add("IM-09.01.56", 1);
    add("IM-09.01.57", 1);
    add("IE-06.03.01", 1);
  }
  if (RANK[cat] >= RANK["I-4"]) {
    add("IM-09.01.03", RANK[cat] >= RANK["II-1"] ? 4 : 1);
    add("IM-09.01.06", RANK[cat] >= RANK["II-1"] ? 16 : 4);
    add("IM-09.01.08", RANK[cat] >= RANK["II-1"] ? 40 : 12);
    add("IM-09.01.10", RANK[cat] >= RANK["II-1"] ? 8 : 4);
    add("IM-09.01.13", 2);
    add("IM-09.01.21", 1);
    add("IM-09.01.23", 1);
    add("IM-09.01.45", 2);
    add("IM-09.01.58", 1);
    add("IM-09.01.66", RANK[cat] >= RANK["II-1"] ? 6 : 2);
    add("IM-09.01.68", 1);
    add("IE-06.01.01", 1);
    add("IE-07.01.01", 1);
    add("IE-07.02.01", 4);
  }
  if (RANK[cat] >= RANK["II-1"]) {
    add("IM-09.01.05", 2);
    add("IM-09.01.11", 4);
    add("IM-09.01.12", 3);
    add("IM-09.01.14", 2);
    add("IM-09.01.15", 2);
    add("IM-09.01.16", 2);
    add("IM-09.01.17", 3);
    add("IM-09.01.18", 2);
    add("IM-09.01.20", 1);
    add("IM-09.01.22", 1);
    add("IM-09.01.35", 1);
    add("IM-09.01.37", 2);
    add("IM-09.01.59", 1);
    add("IM-09.01.61", 2);
    add("IM-08.01.04", 1);
    add("IM-08.02.01", 24);
    add("IM-08.02.02", 16);
    add("IM-08.02.03", 16);
    add("IM-08.02.04", 4);
    add("IM-08.03.01", 4);
    add("IM-08.03.02", 2);
    add("IM-08.04.01", 1);
    add("IM-08.04.02", 1);
    add("IE-06.01.03", 1);
    add("IE-07.01.04", 1);
    add("IE-07.02.02", 1);
  }
  if (RANK[cat] >= RANK["II-2"]) {
    add("IM-09.01.04", 8);
    add("IM-09.01.07", 10);
    add("IM-09.01.09", 10);
    add("IM-09.01.24", 1);
    add("IM-09.01.26", 1);
    add("IM-09.01.27", 1);
    add("IM-09.01.32", 2);
    add("IM-09.01.60", 1);
    add("IM-09.01.62", 1);
    add("IM-08.01.01", 1);
    add("IE-06.01.05", 1);
    add("IE-06.04.01", 1);
    add("IE-07.01.05", 1);
  }
  if (RANK[cat] >= RANK["III-1"]) {
    add("IM-09.01.28", 1);
    add("IM-09.01.29", 1);
    add("IM-09.01.36", 2);
    add("IM-09.01.39", 1);
    add("IM-09.01.40", 1);
    add("IM-08.01.02", 1);
    add("IM-08.01.03", 1);
    add("IE-06.02.01", 1);
    add("IE-06.04.02", 1);
    add("IE-07.01.07", 1);
  }
  if (cat === "III-2") {
    add("IE-06.02.03", 1);
    add("IE-07.01.08", 1);
    add("IM-09.01.04", 16);
    add("IM-09.01.08", 80);
    add("IM-09.01.27", 2);
  }
  return out;
}

export function textoCategoriaParaPrompt(cat: CategoriaMinsa) {
  const m = CATEGORIA_MINSA_META[cat];
  return [
    `CATEGORÍA MINSA DECLARADA: ${m.id} — ${m.nombre}`,
    `Norma: ${m.norma}`,
    `UPSS mínimas: ${m.upss.join("; ")}`,
    `Especialidades típicas: ${m.especialidades.join("; ")}`,
    `Esta categoría NO asume: ${m.noTiene.join("; ")}`,
    "El catálogo de dotación (EQ-/MA-/UT-/MO-/HE- por UPSS, más IM-08, IE-06 e IE-07) ya viene filtrado a esta categoría.",
    "IM-09 (AE MINSA-DIEM) sigue en el catálogo oficial. La plantilla de equipamiento usa EQ-ME, EQ-DX, EQ-EM, EQ-CQ, EQ-LAB, EQ-OD, EQ-CE y no médicos (CM, LV, MT, RS, OF, AL, SS).",
    "Si el plano muestra un equipo de categoría superior, va a no_catalogadas. No lo metas en una partida «parecida».",
    "No rellenes con la plantilla. El plano manda. La categoría solo evita inventar equipos que este tipo no tiene.",
  ].join("\n");
}

export function textoReglasMinsaSistema() {
  return CATEGORIAS_MINSA.map((id) => {
    const m = CATEGORIA_MINSA_META[id];
    return `${id} (${m.alias}): UPSS ${m.upss.join(", ")}. No tiene: ${m.noTiene.join(", ")}.`;
  }).join("\n");
}
