import rawTables from "./tables.json";

export type FcPeaje = { code: string; nombre: string; m: number[] };

const tables = rawTables as {
  cov: (string | number)[][];
  fcLig: FcPeaje[];
  fcPes: FcPeaje[];
};

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Setiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export type VehKey = "auto" | "camioneta" | "cr" | "micro" | "bus" | "c2e" | "c3e";

export const VEH: {
  key: VehKey;
  label: string;
  ligero: boolean;
  pasajero: boolean;
  cov: number;
}[] = [
  { key: "auto", label: "Automóvil", ligero: true, pasajero: true, cov: 0 },
  { key: "camioneta", label: "Camioneta", ligero: true, pasajero: true, cov: 1 },
  { key: "cr", label: "C.R.", ligero: true, pasajero: true, cov: 1 },
  { key: "micro", label: "Micro", ligero: true, pasajero: true, cov: 2 },
  { key: "bus", label: "Bus Grande", ligero: true, pasajero: true, cov: 3 },
  { key: "c2e", label: "Camión 2E", ligero: false, pasajero: false, cov: 4 },
  { key: "c3e", label: "Camión 3E", ligero: false, pasajero: false, cov: 5 },
];

export const ZONAS = ["Costa", "Sierra", "Selva"] as const;
export const TOPOS = [
  { value: "A", label: "Accidentado" },
  { value: "O", label: "Ondulado" },
  { value: "L", label: "Llano" },
] as const;
export const SUPERFICIES = [
  { value: "AFI", label: "Afirmado" },
  { value: "ASF", label: "Asfaltado" },
  { value: "SAF", label: "Sin afirmar" },
  { value: "TRO", label: "Trocha" },
] as const;
export const ESTADOS = [
  { value: "B", label: "Bueno" },
  { value: "R", label: "Regular" },
  { value: "M", label: "Malo" },
] as const;

export const INTERVENCION: { value: string; label: string; pct: number }[] = [
  { value: "mejoramiento", label: "Mejoramiento", pct: 15 },
  { value: "rehabilitacion", label: "Rehabilitación", pct: 10 },
  { value: "mantenimiento", label: "Mantenimiento periódico", pct: 5 },
];

export const FC_LIG = tables.fcLig;
export const FC_PES = tables.fcPes;

export type CovRow = {
  region: string;
  topo: string;
  sup: string;
  est: string;
  vals: number[];
};

export const COV: CovRow[] = (tables.cov as (string | number)[][]).map((r) => ({
  region: String(r[0]),
  topo: String(r[1]),
  sup: String(r[2]),
  est: String(r[3]),
  vals: r.slice(4).map(Number),
}));

export function lookupCov(region: string, topo: string, sup: string, est: string): number[] | null {
  const hit = COV.find((c) => c.region === region && c.topo === topo && c.sup === sup && c.est === est);
  return hit ? hit.vals : null;
}

export function fcOf(list: FcPeaje[], code: string, mesIdx: number): number {
  const p = list.find((x) => x.code === code);
  if (!p) return 1;
  return p.m[Math.max(0, Math.min(11, mesIdx))] ?? 1;
}

export const TCP: { depto: string; zona: string; r: [number, number, number, number] }[] = [
  { depto: "PERÚ", zona: "", r: [1.7, 1.6, 1.5, 1.3] },
  { depto: "Callao", zona: "Costa", r: [2.6, 2.3, 2.1, 1.8] },
  { depto: "Ica", zona: "Costa", r: [1.7, 1.5, 1.3, 1.2] },
  { depto: "La Libertad", zona: "Costa", r: [1.8, 1.7, 1.5, 1.3] },
  { depto: "Lima", zona: "Costa", r: [1.9, 1.7, 1.5, 1.3] },
  { depto: "Moquegua", zona: "Costa", r: [1.7, 1.6, 1.4, 1.3] },
  { depto: "Piura", zona: "Costa", r: [1.3, 1.2, 1.1, 0.9] },
  { depto: "Tacna", zona: "Costa", r: [3.0, 2.7, 2.4, 2.1] },
  { depto: "Tumbes", zona: "Costa", r: [2.8, 2.6, 2.3, 2.0] },
  { depto: "Ancash", zona: "Sierra", r: [1.0, 0.9, 0.8, 0.7] },
  { depto: "Apurímac", zona: "Sierra", r: [0.9, 1.0, 1.0, 1.0] },
  { depto: "Arequipa", zona: "Sierra", r: [1.8, 1.7, 1.5, 1.3] },
  { depto: "Ayacucho", zona: "Sierra", r: [0.1, 0.3, 0.4, 0.4] },
  { depto: "Cajamarca", zona: "Sierra", r: [1.2, 1.2, 1.1, 0.9] },
  { depto: "Cusco", zona: "Sierra", r: [1.2, 1.2, 1.1, 1.0] },
  { depto: "Huancavelica", zona: "Sierra", r: [0.9, 1.0, 0.9, 0.9] },
  { depto: "Huánuco", zona: "Sierra", r: [2.0, 1.8, 1.7, 1.6] },
  { depto: "Junín", zona: "Sierra", r: [1.2, 1.2, 1.0, 0.9] },
  { depto: "Pasco", zona: "Sierra", r: [0.4, 0.6, 0.5, 0.4] },
  { depto: "Puno", zona: "Sierra", r: [1.2, 1.2, 1.1, 1.0] },
  { depto: "Amazonas", zona: "Selva", r: [1.9, 1.8, 1.7, 1.5] },
  { depto: "Loreto", zona: "Selva", r: [2.5, 2.2, 2.0, 1.9] },
  { depto: "Madre de Dios", zona: "Selva", r: [3.3, 2.9, 2.6, 2.3] },
  { depto: "San Martín", zona: "Selva", r: [3.7, 3.3, 2.9, 2.6] },
  { depto: "Ucayali", zona: "Selva", r: [3.7, 3.3, 2.9, 2.5] },
];

export const PBI: { depto: string; r: number }[] = [
  { depto: "PERÚ", r: 0.9 },
  { depto: "Cusco", r: 4.4 },
  { depto: "Ica", r: 3.8 },
  { depto: "La Libertad", r: 1.7 },
  { depto: "Ucayali", r: 2.3 },
  { depto: "Moquegua", r: -1.3 },
  { depto: "Arequipa", r: 0.2 },
  { depto: "Apurímac", r: 5.3 },
  { depto: "Piura", r: 2.0 },
  { depto: "San Martín", r: 3.6 },
  { depto: "Ayacucho", r: 11.0 },
  { depto: "Amazonas", r: 3.5 },
  { depto: "Madre de Dios", r: -2.7 },
  { depto: "Cajamarca", r: 7.1 },
  { depto: "Ancash", r: 0.1 },
  { depto: "Tumbes", r: 2.2 },
  { depto: "Lima", r: 0.4 },
  { depto: "Puno", r: 3.4 },
  { depto: "Lambayeque", r: 3.0 },
  { depto: "Junín", r: -2.3 },
  { depto: "Loreto", r: 2.2 },
  { depto: "Huánuco", r: 0.6 },
  { depto: "Pasco", r: -4.8 },
  { depto: "Tacna", r: -1.3 },
  { depto: "Huancavelica", r: 3.6 },
];

export function tcpDepto(depto: string): number {
  const hit = TCP.find((t) => t.depto.toLowerCase() === depto.toLowerCase());
  return hit ? hit.r[3] : 1.3;
}

export function pbiDepto(depto: string): number {
  const hit = PBI.find((t) => t.depto.toLowerCase() === depto.toLowerCase());
  return hit ? hit.r : 0.9;
}

export const ANCHO_SAF = [
  { imd: "< 15 veh./día", ancho: "3.50 – 4.00", costa: 12000, selva: 15000, desc: "Lastrado, subrasante y obras de arte mínimas." },
  { imd: "15 – 30 veh./día", ancho: "3.50 – 5.00", costa: 15000, selva: 18000, desc: "Lastrado con puentes hasta 15 m y drenaje." },
  { imd: "30 – 50 veh./día", ancho: "3.50 – 6.00", costa: 20000, selva: 25000, desc: "Lastrado con puentes hasta 20 m y drenaje." },
];

export const ANCHO_AF_REHAB = [
  { imd: "< 20 veh./día", ancho: "3.50 – 4.00", costa: 15000, selva: 20000 },
  { imd: "20 – 40 veh./día", ancho: "3.50 – 4.00", costa: 20000, selva: 25000 },
  { imd: "40 – 60 veh./día", ancho: "3.50 – 5.50", costa: 25000, selva: 35000 },
  { imd: "60 – 80 veh./día", ancho: "3.50 – 5.50", costa: 35000, selva: 50000 },
  { imd: "80 – 100 veh./día", ancho: "3.50 – 5.50", costa: 50000, selva: 65000 },
  { imd: "100 – 150 veh./día", ancho: "3.50 – 5.50", costa: 65000, selva: 100000 },
  { imd: "150 – 200 veh./día", ancho: "3.50 – 5.50", costa: 100000, selva: 125000 },
];

export const ANCHO_AF_MEJORA = [
  { imd: "< 50 veh./día", ancho: "3.50 – 4.50", costa: 45000, selva: 60000 },
  { imd: "50 – 100 veh./día", ancho: "3.50 – 5.50", costa: 60000, selva: 75000 },
  { imd: "100 – 150 veh./día", ancho: "3.50 – 5.50", costa: 75000, selva: 125000 },
  { imd: "150 – 200 veh./día", ancho: "3.50 – 5.50", costa: 125000, selva: 145000 },
];

export const GLOSARIO: { t: string; d: string }[] = [
  { t: "Afirmado", d: "Estructura de una o más capas de material seleccionado, extendido y compactado sobre la subrasante." },
  { t: "Afirmado estabilizado", d: "Afirmado mejorado con productos químicos, asfalto, cemento u otros ligantes." },
  { t: "Alcantarilla", d: "Obra de arte del drenaje, construida transversal al eje de la vía." },
  { t: "Badén", d: "Estructura que permite el paso de agua y sedimentos sobre la calzada." },
  { t: "Berma", d: "Franja longitudinal adyacente a la calzada, zona de seguridad y estacionamiento ocasional." },
  { t: "Bombeo", d: "Pendiente transversal de la calzada a ambos lados del eje para evacuar el agua." },
  { t: "Calzada", d: "Superficie de la vía sobre la que transitan los vehículos." },
  { t: "Camino vecinal", d: "Camino rural de acceso a poblaciones pequeñas y predios rurales." },
  { t: "COV", d: "Costo de operación vehicular (US$/veh-km) según región, topografía, superficie y estado. Tablas HDM-III / MTC." },
  { t: "IMD / IMDa", d: "Índice medio diario (anual). Volumen promedio de vehículos por día en ambos sentidos." },
  { t: "IMDS", d: "Índice medio diario semanal de la muestra de conteo: Σ Vi / 7." },
  { t: "FC / FCE", d: "Factor de corrección estacional de una estación de peaje cercana (ligeros y pesados)." },
  { t: "Tráfico generado", d: "Demanda adicional inducida por la mejora. En mejoramiento se toma 15 % del tráfico normal (MTC)." },
  { t: "Regla de la mitad", d: "El beneficio del tráfico generado es la mitad del ahorro de COV, porque el usuario no existía sin proyecto." },
  { t: "VAN", d: "Valor actual neto del flujo incremental a precios sociales. Tasa SNIP histórica 10 %." },
  { t: "TIR", d: "Tasa interna de retorno del flujo neto. Se compara con la tasa de descuento social." },
  { t: "B/C", d: "Relación beneficio / costo: VPN de beneficios sobre VPN de inversión y O&M incrementales." },
  { t: "Precios sociales", d: "Precios de mercado corregidos con factores de conversión (inversión 0.79, O&M 0.75 en la guía)." },
];
