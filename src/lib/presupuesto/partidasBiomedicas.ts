import type { Insumo, Partida, RecursoKind } from "./types";
import { p, r } from "./partidaBuilder";

/** Activos estratégicos de uso frecuente (MINSA-DIEM / OPMI). El código AE es el nombre oficial del listado. SIGA: grupo 65. */
const EQUIPOS: { n: string; nombre: string; precio: number; mo: number }[] = [
  { n: "01", nombre: "Monitor de funciones vitales", precio: 18500, mo: 6 },
  { n: "02", nombre: "Electrocardiógrafo de 12 derivaciones", precio: 9800, mo: 4 },
  { n: "03", nombre: "Desfibrilador / cardiodesfibrilador", precio: 22000, mo: 6 },
  { n: "04", nombre: "Ventilador mecánico de UCI", precio: 68000, mo: 10 },
  { n: "05", nombre: "Ventilador de transporte", precio: 42000, mo: 8 },
  { n: "06", nombre: "Bomba de infusión volumétrica", precio: 4200, mo: 2 },
  { n: "07", nombre: "Bomba de jeringa", precio: 3800, mo: 2 },
  { n: "08", nombre: "Cama hospitalaria eléctrica 3 funciones", precio: 8500, mo: 4 },
  { n: "09", nombre: "Cama de UCI con colchón antiescaras", precio: 18500, mo: 6 },
  { n: "10", nombre: "Cama pediátrica / cuna hospitalaria", precio: 6200, mo: 3 },
  { n: "11", nombre: "Incubadora neonatal", precio: 28000, mo: 8 },
  { n: "12", nombre: "Cuna térmica / servocuna", precio: 22000, mo: 6 },
  { n: "13", nombre: "Lámpara fototerapia neonatal", precio: 4500, mo: 3 },
  { n: "14", nombre: "Mesa quirúrgica hidráulica", precio: 32000, mo: 10 },
  { n: "15", nombre: "Lámpara quirúrgica de techo (equipo)", precio: 24000, mo: 8 },
  { n: "16", nombre: "Electrobisturí", precio: 14500, mo: 4 },
  { n: "17", nombre: "Aspirador quirúrgico", precio: 3800, mo: 3 },
  { n: "18", nombre: "Autoclave / esterilizador a vapor de red", precio: 42000, mo: 12 },
  { n: "19", nombre: "Autoclave de mesa 24 L", precio: 9800, mo: 4 },
  { n: "20", nombre: "Lavadora descontaminadora", precio: 38000, mo: 10 },
  { n: "21", nombre: "Selladora de bolsas para esterilización", precio: 2800, mo: 2 },
  { n: "22", nombre: "Rayos X convencional", precio: 145000, mo: 24 },
  { n: "23", nombre: "Rayos X portátil", precio: 62000, mo: 10 },
  { n: "24", nombre: "Arco en C", precio: 185000, mo: 16 },
  { n: "25", nombre: "Ecógrafo / ultrasonido", precio: 48000, mo: 8 },
  { n: "26", nombre: "Mamógrafo", precio: 220000, mo: 20 },
  { n: "27", nombre: "Tomógrafo computarizado", precio: 980000, mo: 40 },
  { n: "28", nombre: "Resonador magnético", precio: 2800000, mo: 60 },
  { n: "29", nombre: "Densitómetro óseo", precio: 85000, mo: 10 },
  { n: "30", nombre: "Analizador hematológico", precio: 42000, mo: 8 },
  { n: "31", nombre: "Analizador bioquímico", precio: 52000, mo: 8 },
  { n: "32", nombre: "Analizador de gases arteriales", precio: 28000, mo: 6 },
  { n: "33", nombre: "Centrífuga de laboratorio", precio: 6500, mo: 3 },
  { n: "34", nombre: "Microscopio binocular", precio: 4800, mo: 2 },
  { n: "35", nombre: "Cabina de bioseguridad clase II", precio: 18500, mo: 6 },
  { n: "36", nombre: "Cabina de flujo laminar", precio: 14500, mo: 6 },
  { n: "37", nombre: "Refrigeradora de sangre / banco", precio: 12500, mo: 5 },
  { n: "38", nombre: "Congeladora −20 °C laboratorio", precio: 6800, mo: 4 },
  { n: "39", nombre: "Titulador (AE laboratorio CNCC)", precio: 22000, mo: 6 },
  { n: "40", nombre: "Bidestilador de agua", precio: 8500, mo: 4 },
  { n: "41", nombre: "Concentrador de oxígeno 10 L/min", precio: 4200, mo: 3 },
  { n: "42", nombre: "Aspirador de secreciones", precio: 1800, mo: 2 },
  { n: "43", nombre: "Laringoscopio set", precio: 950, mo: 1 },
  { n: "44", nombre: "Carro de paro / crash cart", precio: 2800, mo: 2 },
  { n: "45", nombre: "Negatoscopio LED", precio: 650, mo: 1 },
  { n: "46", nombre: "Balanza pediátrica", precio: 850, mo: 1 },
  { n: "47", nombre: "Balanza de adulto con tallímetro", precio: 720, mo: 1 },
  { n: "48", nombre: "Otoscopio / oftalmoscopio set", precio: 1100, mo: 1 },
  { n: "49", nombre: "Doppler fetal", precio: 1450, mo: 1 },
  { n: "50", nombre: "Mesa ginecológica", precio: 3200, mo: 3 },
  { n: "51", nombre: "Lámpara de cuello de ganso", precio: 480, mo: 1 },
  { n: "52", nombre: "Equipo dental completo", precio: 18500, mo: 10 },
  { n: "53", nombre: "Autoclave odontológica", precio: 4200, mo: 3 },
  { n: "54", nombre: "Compresor odontológico", precio: 2800, mo: 3 },
  { n: "55", nombre: "Unidad de rehabilitación / camilla", precio: 2200, mo: 2 },
  { n: "56", nombre: "Equipo de ultrasonido terapéutico", precio: 3800, mo: 2 },
  { n: "57", nombre: "Electroestimulador TENS", precio: 1450, mo: 1 },
  { n: "58", nombre: "Lavadora de ropa hospitalaria 16 kg", precio: 12500, mo: 6 },
  { n: "59", nombre: "Secadora de ropa hospitalaria", precio: 9800, mo: 5 },
  { n: "60", nombre: "Caldera / generador de vapor hospitalario", precio: 45000, mo: 16 },
  { n: "61", nombre: "Marmita / olla de cocción hospitalaria", precio: 8500, mo: 6 },
  { n: "62", nombre: "Cámara frigorífica de nutrición", precio: 18500, mo: 8 },
  { n: "63", nombre: "Sillón de ruedas", precio: 650, mo: 1 },
  { n: "64", nombre: "Camilla de transporte", precio: 1450, mo: 1 },
  { n: "65", nombre: "Biombo hospitalario", precio: 380, mo: 1 },
  { n: "66", nombre: "Mesa de mayo / instrumental", precio: 420, mo: 1 },
  { n: "67", nombre: "Contenedor de residuos punzocortantes (estación)", precio: 180, mo: 0.5 },
  { n: "68", nombre: "Sistema de llamado de enfermería", precio: 18500, mo: 12 },
  { n: "69", nombre: "Refrigeradora de vacunas 2–8 °C (cadena de frío)", precio: 4800, mo: 3 },
  { n: "70", nombre: "Esfigmomanómetro aneroide de pedestal", precio: 380, mo: 0.5 },
  { n: "71", nombre: "Nebulizador a pistón", precio: 650, mo: 1 },
  { n: "72", nombre: "Mesa de curaciones / procedimiento", precio: 1850, mo: 2 },
  { n: "73", nombre: "Glucómetro de consultorio", precio: 280, mo: 0.4 },
  { n: "74", nombre: "Equipo de oxigenoterapia (flujómetro + humidificador)", precio: 420, mo: 1 },
  { n: "75", nombre: "Camilla de examen de consultorio", precio: 980, mo: 1 },
];

function i(id: string, kind: RecursoKind, codigo: string, nombre: string, und: string, precio: number, iu: number, categoria: string): Insumo {
  return { id, kind, codigo, nombre, und, precio, iu, categoria };
}

export const INSUMOS_BIOMEDICOS: Insumo[] = EQUIPOS.map((e) =>
  i(`MAT-AE${e.n}`, "mat", `AE-${e.n}`, `AE MINSA-DIEM: ${e.nombre}`, "und", e.precio, 11, "Equipamiento biomédico MINSA")
);

export const PARTIDAS_BIOMEDICAS: Partida[] = EQUIPOS.map((e) =>
  p(
    "mecanicas",
    "09 Equipamiento biomédico MINSA-DIEM",
    `IM-09.01.${e.n}`,
    `Suministro e instalación de ${e.nombre} (AE MINSA-DIEM · SIGA grupo 65)`,
    "und",
    r(["MO-BIO", e.mo], ["MO-ELE", Math.max(1, e.mo * 0.4)], ["MO-AYU", Math.max(1, e.mo * 0.5)], [`MAT-AE${e.n}`, 1], ["EQ-HIN", 3])
  )
);
