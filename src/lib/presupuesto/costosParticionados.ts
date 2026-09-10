import { etiquetaSubcapitulo, partesTituloCapitulo } from "./rnMetrados";
import type { CalcPresupuesto } from "./engine";
import type { LineaCalc } from "./engine";
import { KIND_ORDER } from "./types";
import type { RecursoKind } from "./types";

export type RubroParticionado = {
  id: string;
  titulo: string;
  mo: number;
  mat: number;
  maq: number;
  eq: number;
  directo: number;
  gg: number;
  total: number;
  partidas: number;
};

export type EtapaParticionado = {
  id: string;
  titulo: string;
  rubros: RubroParticionado[];
  mo: number;
  mat: number;
  maq: number;
  eq: number;
  directo: number;
  gg: number;
  total: number;
  partidas: number;
};

export type CostosParticionados = {
  etapas: EtapaParticionado[];
  mo: number;
  mat: number;
  maq: number;
  eq: number;
  directo: number;
  gg: number;
  utilidad: number;
  subtotal: number;
  igv: number;
  total: number;
};

function kindsDe(linea: LineaCalc) {
  const out: Record<RecursoKind, number> = { mo: 0, mat: 0, maq: 0, eq: 0 };
  for (const k of KIND_ORDER) {
    out[k] = linea.apu.porKind[k].subtotal * linea.linea.metrado;
  }
  return out;
}

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Etapa de obra y rubro interno (zapatas, vigas de cimentación, columnas, solados, …). */
export function clasificarEtapa(linea: LineaCalc): { etapaId: string; etapa: string; rubroId: string; rubro: string } {
  const codigo = linea.partida.codigo.toUpperCase();
  const desc = norm(linea.partida.descripcion);
  const cap = linea.partida.capitulo;
  const sub = etiquetaSubcapitulo(codigo) || partesTituloCapitulo(cap).nombre || cap;
  const pref = codigo.match(/^([A-Z]+)-(\d+)/);
  const familia = pref?.[1] ?? "";
  const n1 = pref?.[2] ?? "";

  const rubroDe = (id: string, titulo: string, etapaId: string, etapa: string) => ({
    etapaId,
    etapa,
    rubroId: id,
    rubro: titulo,
  });

  if (familia === "EST" && (n1 === "02" || /excav|relleno|eliminacion|afirmad|talud|agotamiento/.test(desc))) {
    return rubroDe(`est-tierras-${sub}`, sub || "Movimiento de tierras", "tierras", "Movimiento de tierras");
  }
  if (
    familia === "EST" &&
    (n1 === "03" ||
      /solado|falso piso|cimiento|sobrecimiento|ciclopeo|zapata|platea|viga de ciment|dado de zapata/.test(desc))
  ) {
    let rubro = sub || "Cimentación";
    if (/solado|falso piso/.test(desc)) rubro = "Solados y falso piso";
    else if (/viga de ciment/.test(desc)) rubro = "Vigas de cimentación";
    else if (/platea/.test(desc)) rubro = "Zapatas - Platea";
    else if (/zapata|dado/.test(desc)) rubro = "Zapatas - Platea";
    else if (/sobrecimiento/.test(desc)) rubro = "Sobrecimientos";
    else if (/cimiento corrido|cimiento/.test(desc)) rubro = "Cimientos corridos";
    else if (/ciclopeo/.test(desc)) rubro = "Concreto ciclópeo";
    return rubroDe(`cim-${rubro}`, rubro, "cimentacion", "Cimentación");
  }
  if (familia === "EST" && n1 === "04") {
    let rubro = sub || "Concreto armado";
    if (/zapata|platea|dado/.test(desc)) return rubroDe("cim-zapatas", "Zapatas - Platea", "cimentacion", "Cimentación");
    if (/viga de ciment/.test(desc)) return rubroDe("cim-vigas", "Vigas de cimentación", "cimentacion", "Cimentación");
    if (/columna/.test(desc)) rubro = "Columnas";
    else if (/viga/.test(desc)) rubro = "Vigas";
    else if (/losa aliger/.test(desc)) rubro = "Losas aligeradas";
    else if (/losa maciz|losa/.test(desc)) rubro = "Losas macizas";
    else if (/placa|muro/.test(desc)) rubro = "Placas y muros";
    else if (/escalera/.test(desc)) rubro = "Escaleras";
    else if (/cisterna|tanque/.test(desc)) rubro = "Cisterna y tanques";
    else if (/acero/.test(desc)) rubro = `Acero · ${rubro}`;
    else if (/encofr/.test(desc)) rubro = `Encofrados · ${rubro}`;
    return rubroDe(`est-${rubro}`, rubro, "estructura", "Estructura");
  }
  if (familia === "ARQ" && n1 === "01") {
    return rubroDe(`pre-${sub}`, sub || "Preliminares", "preliminares", "Preliminares y obras provisionales");
  }
  if (familia === "ARQ" && (n1 === "05" || /albanil|muro|tabique|dintel/.test(desc))) {
    return rubroDe(`alb-${sub}`, sub || "Albañilería", "albanileria", "Albañilería y muros");
  }
  if (familia === "ARQ" && (n1 === "06" || n1 === "07" || n1 === "08" || n1 === "12" || /tarrajeo|cielo|piso|pintura|mayolica|zocalo/.test(desc))) {
    return rubroDe(`aca-${sub}`, sub || "Acabados", "acabados", "Acabados");
  }
  if (familia === "ARQ" && (n1 === "09" || n1 === "10" || n1 === "11" || /puerta|ventana|mampara|vidrio/.test(desc))) {
    return rubroDe(`car-${sub}`, sub || "Carpintería y vidrios", "carpinteria", "Carpintería, ventanas y vidrios");
  }
  if (familia === "ARQ" && (n1 === "13" || n1 === "14" || n1 === "16")) {
    return rubroDe(`cub-${sub}`, sub || cap, "cubierta", "Coberturas, áreas verdes y limpieza");
  }
  if (familia === "IS" || familia === "S") {
    return rubroDe(`is-${sub || cap}`, sub || cap, "sanitarias", "Instalaciones sanitarias");
  }
  if (familia === "IE") {
    return rubroDe(`ie-${sub || cap}`, sub || cap, "electricas", "Instalaciones eléctricas");
  }
  if (familia === "COM") {
    return rubroDe(`com-${sub || cap}`, sub || cap, "comunicaciones", "Comunicaciones");
  }
  if (familia === "IM" || familia === "IEM") {
    return rubroDe(`im-${sub || cap}`, sub || cap, "mecanicas", "Instalaciones mecánicas y electromecánicas");
  }
  if (familia === "P" || familia === "CAR" || familia === "HAB") {
    return rubroDe(`via-${sub || cap}`, sub || cap, "vias", cap || "Vías y habilitaciones");
  }
  if (familia === "PTE" || familia === "HID") {
    return rubroDe(`obr-${sub || cap}`, sub || cap, "obras", cap || "Obras de arte e hidráulica");
  }
  const tit = partesTituloCapitulo(cap);
  return rubroDe(`${familia || "x"}-${tit.nombre || cap}`, tit.nombre || cap, familia.toLowerCase() || "otros", cap || "Otras partidas");
}

function emptyRubro(id: string, titulo: string): RubroParticionado {
  return { id, titulo, mo: 0, mat: 0, maq: 0, eq: 0, directo: 0, gg: 0, total: 0, partidas: 0 };
}

function sumar(r: RubroParticionado, k: Record<RecursoKind, number>, gg: number) {
  r.mo += k.mo;
  r.mat += k.mat;
  r.maq += k.maq;
  r.eq += k.eq;
  r.directo += k.mo + k.mat + k.maq + k.eq;
  r.gg += gg;
  r.total = r.directo + r.gg;
  r.partidas += 1;
}

const ORDEN_ETAPA = [
  "preliminares",
  "tierras",
  "cimentacion",
  "estructura",
  "albanileria",
  "acabados",
  "carpinteria",
  "cubierta",
  "sanitarias",
  "electricas",
  "comunicaciones",
  "mecanicas",
  "vias",
  "obras",
];

export function costosParticionados(calc: CalcPresupuesto): CostosParticionados {
  const cd = calc.costoDirecto || 1;
  const etapasMap = new Map<string, EtapaParticionado>();
  for (const linea of calc.lineas) {
    const cls = clasificarEtapa(linea);
    const k = kindsDe(linea);
    const gg = calc.costoDirecto > 0 ? (linea.parcial / cd) * calc.gg : 0;
    let etapa = etapasMap.get(cls.etapaId);
    if (!etapa) {
      etapa = {
        id: cls.etapaId,
        titulo: cls.etapa,
        rubros: [],
        mo: 0,
        mat: 0,
        maq: 0,
        eq: 0,
        directo: 0,
        gg: 0,
        total: 0,
        partidas: 0,
      };
      etapasMap.set(cls.etapaId, etapa);
    }
    let rubro = etapa.rubros.find((r) => r.id === cls.rubroId);
    if (!rubro) {
      rubro = emptyRubro(cls.rubroId, cls.rubro);
      etapa.rubros.push(rubro);
    }
    sumar(rubro, k, gg);
    etapa.mo += k.mo;
    etapa.mat += k.mat;
    etapa.maq += k.maq;
    etapa.eq += k.eq;
    etapa.directo += linea.parcial;
    etapa.gg += gg;
    etapa.total = etapa.directo + etapa.gg;
    etapa.partidas += 1;
  }
  const etapas = [...etapasMap.values()].sort((a, b) => {
    const ia = ORDEN_ETAPA.indexOf(a.id);
    const ib = ORDEN_ETAPA.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.titulo.localeCompare(b.titulo, "es");
  });
  for (const e of etapas) {
    e.rubros.sort((a, b) => b.directo - a.directo);
  }
  return {
    etapas,
    mo: calc.porKindCd.mo,
    mat: calc.porKindCd.mat,
    maq: calc.porKindCd.maq,
    eq: calc.porKindCd.eq,
    directo: calc.costoDirecto,
    gg: calc.gg,
    utilidad: calc.utilidad,
    subtotal: calc.subtotal,
    igv: calc.igv,
    total: calc.total,
  };
}
