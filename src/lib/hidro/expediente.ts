import type { Kv } from "../memoria";

export type OrigenCaudal = "impuesto" | "aforo" | "hidrologia" | "riego" | "racional";

export const ORIGEN_Q: { id: OrigenCaudal; label: string }[] = [
  { id: "racional", label: "Método racional (esta hoja)" },
  { id: "hidrologia", label: "Estudio hidrológico (menú Hidrología)" },
  { id: "aforo", label: "Aforo de campo" },
  { id: "riego", label: "Demanda de riego (HID-11)" },
  { id: "impuesto", label: "Caudal dado por el expediente" },
];

export function labelOrigenQ(id: OrigenCaudal) {
  return ORIGEN_Q.find((o) => o.id === id)?.label ?? id;
}

export type MetaExpediente = {
  proyecto: string;
  ubicacion: string;
  profesional: string;
  cip: string;
  estacionSenamhi: string;
  codigoEstacion: string;
  periodoRegistro: string;
  cota: number;
  utmEste: number;
  utmNorte: number;
};

export const META_EXP_VACIA: MetaExpediente = {
  proyecto: "",
  ubicacion: "Perú",
  profesional: "Ingeniero civil",
  cip: "",
  estacionSenamhi: "",
  codigoEstacion: "",
  periodoRegistro: "",
  cota: 0,
  utmEste: 0,
  utmNorte: 0,
};

export function kvExpediente(m: MetaExpediente, extras: Kv[] = []): Kv[] {
  const rows: Kv[] = [
    { k: "Proyecto", v: m.proyecto || "—" },
    { k: "Ubicación", v: m.ubicacion || "—" },
    { k: "Profesional responsable", v: m.cip ? `${m.profesional} · CIP ${m.cip}` : m.profesional || "—" },
  ];
  if (m.estacionSenamhi.trim()) {
    rows.push({
      k: "Estación SENAMHI",
      v: m.codigoEstacion.trim() ? `${m.estacionSenamhi} (${m.codigoEstacion})` : m.estacionSenamhi,
    });
  }
  if (m.periodoRegistro.trim()) rows.push({ k: "Periodo de registro", v: m.periodoRegistro });
  if (m.cota) rows.push({ k: "Cota de emplazamiento", v: String(m.cota), u: "msnm" });
  if (m.utmEste && m.utmNorte) {
    rows.push({ k: "UTM WGS84", v: `${m.utmEste.toFixed(0)} E · ${m.utmNorte.toFixed(0)} N` });
  }
  return [...rows, ...extras];
}

export function textoOrigenQ(origen: OrigenCaudal, justificacion: string, Q: number, unidad = "m³/s") {
  const base = `El caudal de diseño (${Q} ${unidad}) se adopta por ${labelOrigenQ(origen).toLowerCase()}.`;
  return justificacion.trim() ? `${base} ${justificacion.trim()}` : base;
}
