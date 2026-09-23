import type { Calidad, Criterios, Pavimento, ProyectoLot, Seccion, TipoHab, TipoVia } from "./tipos";

export const NORMA = "RNE GH.020 · D.S. N.° 006-2011-VIVIENDA";
export const NORMA_TH = "RNE TH.010 / TH.020 / TH.030 / TH.040";

export type FilaLote = {
  tipo: 1 | 2 | 3 | 4 | 5 | 6;
  area: number;
  frente: number;
  vivienda: string;
  rec: number;
  parque: number;
  edu: number;
  otros: number;
  nota: string;
};

/** TH.010 Art. 9 y Art. 10. Porcentajes sobre el área bruta materia de aporte. */
export const LOTES_VIVIENDA: FilaLote[] = [
  { tipo: 1, area: 450, frente: 15, vivienda: "Unifamiliar", rec: 8, parque: 2, edu: 2, otros: 1, nota: "Densidad baja R1" },
  { tipo: 2, area: 300, frente: 10, vivienda: "Unifamiliar", rec: 8, parque: 2, edu: 2, otros: 1, nota: "Densidad baja R2" },
  { tipo: 3, area: 160, frente: 8, vivienda: "Unifamiliar / multifamiliar", rec: 8, parque: 1, edu: 2, otros: 2, nota: "Densidad media R3" },
  { tipo: 4, area: 90, frente: 6, vivienda: "Unifamiliar / multifamiliar", rec: 8, parque: 0, edu: 2, otros: 3, nota: "Densidad media R4" },
  { tipo: 5, area: 0, frente: 0, vivienda: "Construcción simultánea", rec: 8, parque: 0, edu: 2, otros: 0, nota: "Sin limitación de lote. Programas de acceso a la vivienda." },
  { tipo: 6, area: 450, frente: 15, vivienda: "Multifamiliar", rec: 15, parque: 2, edu: 3, otros: 4, nota: "Densidad alta R5, R6 y R8" },
];

export function filaVivienda(tipo: 1 | 2 | 3 | 4 | 5 | 6): FilaLote {
  return LOTES_VIVIENDA[tipo - 1];
}

export type ParteSeccion = { tipo: "vereda" | "estacionamiento" | "calzada" | "separador"; ancho: number; etiqueta: string };

/** GH.020 Art. 8: dos módulos de calzada. Con separador, dos módulos a cada lado. */
export function partesDeSeccion(s: Seccion): ParteSeccion[] {
  const partes: ParteSeccion[] = [];
  const modulosPorLado = s.separador > 0.05 ? 2 : 1;
  const calzadaLado = s.moduloCalzada * (s.separador > 0.05 ? modulosPorLado : 2);
  if (s.nVeredas >= 1 && s.vereda > 0) partes.push({ tipo: "vereda", ancho: s.vereda, etiqueta: "Vereda" });
  if (s.nEstacionamientos >= 1 && s.estacionamiento > 0) partes.push({ tipo: "estacionamiento", ancho: s.estacionamiento, etiqueta: "Estacionamiento" });
  if (s.separador > 0.05) {
    partes.push({ tipo: "calzada", ancho: calzadaLado, etiqueta: "Calzada" });
    partes.push({ tipo: "separador", ancho: s.separador, etiqueta: "Separador" });
    partes.push({ tipo: "calzada", ancho: calzadaLado, etiqueta: "Calzada" });
  } else {
    partes.push({ tipo: "calzada", ancho: s.moduloCalzada * 2, etiqueta: "Calzada" });
  }
  if (s.nEstacionamientos >= 2 && s.estacionamiento > 0) partes.push({ tipo: "estacionamiento", ancho: s.estacionamiento, etiqueta: "Estacionamiento" });
  if (s.nVeredas >= 2 && s.vereda > 0) partes.push({ tipo: "vereda", ancho: s.vereda, etiqueta: "Vereda" });
  return partes.filter((p) => p.ancho > 0.01);
}

export function anchoSeccion(s: Seccion): number {
  return partesDeSeccion(s).reduce((a, p) => a + p.ancho, 0);
}

export function seccionPorTipo(tipo: TipoVia): Seccion {
  if (tipo === "local-principal") {
    return { vereda: 1.8, nVeredas: 2, moduloCalzada: 3.3, estacionamiento: 2.4, nEstacionamientos: 2, separador: 0 };
  }
  if (tipo === "acceso-exclusivo") {
    return { vereda: 0.9, nVeredas: 2, moduloCalzada: 2.7, estacionamiento: 0, nEstacionamientos: 0, separador: 0 };
  }
  return { vereda: 1.2, nVeredas: 2, moduloCalzada: 2.7, estacionamiento: 2.4, nEstacionamientos: 2, separador: 0 };
}

export function maxManzana(c: Criterios): number {
  if (c.tipoHab === "industrial" && c.tipoDensidad !== 4) return 400;
  if (c.tipoHab === "industrial" && c.tipoDensidad === 4) return 1000;
  return 300;
}

export function calidadExigida(c: Criterios): Calidad | null {
  if (c.tipoHab === "vivienda" && c.tipoDensidad === 6) return "B";
  if (c.tipoHab === "vivienda-taller") return "C";
  if (c.tipoHab === "club") return "D";
  return null;
}

const RANK: Record<Calidad, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };

export function calidadAlcanza(tiene: Calidad, exigida: Calidad): boolean {
  return RANK[tiene] <= RANK[exigida];
}

export function etiquetaHab(t: TipoHab): string {
  switch (t) {
    case "vivienda":
      return "Habilitación para uso de vivienda";
    case "vivienda-taller":
      return "Habilitación vivienda-taller";
    case "club":
      return "Vivienda tipo club, temporal o vacacional";
    case "comercio":
      return "Comercio exclusivo";
    case "industrial":
      return "Habilitación industrial";
    case "especial":
      return "Usos especiales";
  }
}

/** Radio mínimo de la curva de la acera, medido al sardinel. En un cruce manda el mayor. */
export function radioEsquina(t: TipoVia): number {
  return t === "local-principal" ? 5 : 3;
}

export function etiquetaVia(t: TipoVia): string {
  switch (t) {
    case "local-principal":
      return "Vía local principal";
    case "local-secundaria":
      return "Vía local secundaria";
    case "acceso-exclusivo":
      return "Vía local secundaria de acceso exclusivo";
  }
}

/** Aplica el cuadro TH al cambiar tipo o densidad. La municipalidad puede redistribuir aportes (TH.010 Art. 10). */
export function criteriosDeNorma(tipoHab: TipoHab, densidad: Criterios["tipoDensidad"], via: TipoVia): Pick<
  Criterios,
  "frenteMin" | "areaMin" | "profundidad" | "aporteRec" | "aporteParque" | "aporteEdu" | "aporteOtros" | "loteNormativo" | "seccion" | "largoManzana" | "accesoUnico"
> {
  const sec = seccionPorTipo(via);
  if (tipoHab === "club") {
    return {
      frenteMin: 15,
      areaMin: 450,
      profundidad: 30,
      aporteRec: 0,
      aporteParque: 0,
      aporteEdu: 1,
      aporteOtros: 1,
      loteNormativo: 450,
      seccion: sec,
      largoManzana: 120,
      accesoUnico: false,
    };
  }
  if (tipoHab === "comercio" || tipoHab === "especial") {
    return {
      frenteMin: 8,
      areaMin: 160,
      profundidad: 20,
      aporteRec: 0,
      aporteParque: 0,
      aporteEdu: 0,
      aporteOtros: 0,
      loteNormativo: 160,
      seccion: sec,
      largoManzana: 120,
      accesoUnico: false,
    };
  }
  if (tipoHab === "industrial") {
    return {
      frenteMin: 15,
      areaMin: 300,
      profundidad: 30,
      aporteRec: 0,
      aporteParque: 0,
      aporteEdu: 0,
      aporteOtros: 0,
      loteNormativo: 300,
      seccion: { vereda: 1.8, nVeredas: 2, moduloCalzada: 3.6, estacionamiento: 3, nEstacionamientos: 2, separador: 0 },
      largoManzana: 200,
      accesoUnico: false,
    };
  }
  const f = filaVivienda(tipoHab === "vivienda-taller" ? 3 : densidad);
  const frente = f.frente > 0 ? f.frente : 6;
  const areaMin = f.area;
  const profundidad = areaMin > 0 ? Math.round((areaMin / frente) * 10) / 10 : 16;
  return {
    frenteMin: frente,
    areaMin,
    profundidad,
    aporteRec: f.rec,
    aporteParque: f.parque,
    aporteEdu: f.edu,
    aporteOtros: f.otros,
    loteNormativo: areaMin > 0 ? areaMin : 90,
    seccion: sec,
    largoManzana: 120,
    accesoUnico: via === "acceso-exclusivo",
  };
}

export function fechaHoy(): string {
  return new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function nid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}

export function puntoNum(n: number, e = 0, norte = 0) {
  return { num: String(n), e, n: norte };
}

export function viaVacia(nombre: string) {
  return {
    id: nid("via"),
    nombre,
    pia: null,
    pea: null,
    eje: null,
    pea2: null,
    pia2: null,
  };
}

export function pavimentoVacio(): Pavimento {
  return { carpeta: 0.05, base: 0.2, subbase: 0.25, veredaEsp: 0.1, sardinel: 0.15 };
}

export function proyectoVacio(): ProyectoLot {
  const criteriosBase = criteriosDeNorma("vivienda", 3, "local-secundaria");
  return {
    meta: {
      proyecto: "Habilitación urbana",
      ubicacion: "",
      distrito: "",
      provincia: "",
      propietario: "",
      profesional: "",
      cip: "",
      fecha: fechaHoy(),
      lamina: "U-01",
    },
    puntos: [],
    cierre: "abierta",
    vias: [],
    sinIngreso: false,
    ingresos: [],
    ajustesVias: [],
    pavimento: pavimentoVacio(),
    modoParque: "lotes",
    criterios: {
      tipoHab: "vivienda",
      tipoDensidad: 3,
      tipoVia: "local-secundaria",
      cesionPrimaria: 0,
      reservaRegional: 0,
      servidumbreAT: 0,
      calidad: "B",
      ...criteriosBase,
    },
  };
}

/** Polígono de trabajo, unos 250 m × 170 m, levemente irregular. */
export function puntosEjemplo() {
  return [
    { num: "1", e: 1000, n: 5000 },
    { num: "2", e: 1248.5, n: 5014.2 },
    { num: "3", e: 1262.4, n: 5176.8 },
    { num: "4", e: 1088.0, n: 5194.5 },
    { num: "5", e: 986.6, n: 5092.0 },
  ];
}

/** GH.020 Art. 54 a 60. Esta lámina cubre el diseño urbano; el resto queda identificado para el expediente. */
export const ESTRUCTURA_EXPEDIENTE: { norma: string; item: string; lamina: string }[] = [
  { norma: "Art. 56", item: "Plano de localización y trazado y lotización, con lotes, aportes, vías, secciones y ejes", lamina: "Esta lámina" },
  { norma: "Art. 37", item: "Planeamiento integral, cuando el predio no colinda con trama habilitada o se ejecuta por etapas", lamina: "Según el caso" },
  { norma: "Art. 57", item: "Pavimentos: ejes, perfiles longitudinales, secciones viales y especificaciones", lamina: "Lámina complementaria" },
  { norma: "Art. 56.e", item: "Ornamentación de parques", lamina: "Si hay recreación pública" },
  { norma: "Art. 58", item: "Redes eléctricas: primaria, secundaria, transformación y detalles", lamina: "Lámina complementaria" },
  { norma: "Art. 60", item: "Redes sanitarias: agua, alcantarillado, almacenamiento y detalles", lamina: "Lámina complementaria" },
  { norma: "Art. 59", item: "Red de gas", lamina: "Si corresponde" },
  { norma: "Art. 55.h", item: "Redes de comunicaciones", lamina: "Lámina complementaria" },
  { norma: "Art. 43", item: "Mobiliario del habilitador: luminarias, basureros, bancas, hidrantes y señalización", lamina: "Partida de obra" },
  { norma: "Art. 51", item: "Nomenclatura: letras en manzanas y números en lotes, ambos correlativos", lamina: "Esta lámina" },
];

export function firmar(p: ProyectoLot): string {
  const r = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : "");
  const pts = p.puntos.map((q) => `${q.num}:${r(q.e)},${r(q.n)}`).join(";");
  const vias = p.vias
    .map((v) =>
      [v.nombre, v.pia, v.pea, v.eje, v.pea2, v.pia2]
        .map((x) => (x && typeof x === "object" ? `${r(x.e)},${r(x.n)}` : String(x ?? "")))
        .join("/"),
    )
    .join("|");
  const ing = p.ingresos.map((i) => `${i.arista}:${r(i.distancia)}:${r(i.ancho)}`).join("|");
  const aj = (p.ajustesVias ?? [])
    .map((a) => `${a.id}:${a.tipo}:${r(a.seccion.vereda)}:${a.seccion.nVeredas}:${r(a.seccion.moduloCalzada)}:${r(a.seccion.estacionamiento)}:${a.seccion.nEstacionamientos}:${r(a.seccion.separador)}`)
    .join("|");
  const c = p.criterios;
  const pq = (p.parques ?? []).map((a) => `${a.clave}:${a.categoria}:${a.estilo ?? ""}`).join("|");
  const pv = p.pavimento ?? pavimentoVacio();
  return [
    pts,
    p.cierre,
    p.sinIngreso ? "sin" : "con",
    vias,
    ing,
    aj,
    c.tipoHab,
    c.tipoDensidad,
    c.tipoVia,
    c.largoManzana,
    c.frenteMin,
    c.areaMin,
    c.profundidad,
    c.aporteRec,
    c.aporteParque,
    c.aporteEdu,
    c.aporteOtros,
    c.loteNormativo,
    c.cesionPrimaria,
    c.reservaRegional,
    c.servidumbreAT,
    c.calidad,
    c.accesoUnico,
    c.seccion.vereda,
    c.seccion.nVeredas,
    c.seccion.moduloCalzada,
    c.seccion.estacionamiento,
    c.seccion.nEstacionamientos,
    c.seccion.separador,
    r(pv.carpeta),
    r(pv.base),
    r(pv.subbase),
    r(pv.veredaEsp),
    r(pv.sardinel),
    p.modoParque ?? "lotes",
    pq,
  ].join("#");
}
