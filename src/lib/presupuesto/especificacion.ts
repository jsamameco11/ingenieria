import type { EspecialidadPre, Insumo, LineaPresupuesto, Partida, RecursoKind } from "./types";
import { ESPECIALIDAD_META, JORNADA_BASE } from "./types";
import { calcularApu, partidaPorCodigo } from "./engine";
import { cuerpoDePartida, matsNota } from "./especificacionTexto";

/** Contexto de obra opcional para calcular el APU real de la partida (receta editada, precios y jornada del
 *  presupuesto). Sin contexto, se usa la receta y los precios de catálogo (modo "consultar catálogo"). */
export type ContextoApuObra = {
  linea?: LineaPresupuesto;
  precios?: Record<string, number>;
  insumosPropios?: Insumo[];
  jornada?: number;
};

export type LineaApuSpec = {
  kind: RecursoKind;
  codigo: string;
  nombre: string;
  und: string;
  cantidad: number;
};

export type EspecificacionTecnica = {
  codigo: string;
  titulo: string;
  especialidad: string;
  especialidadId: EspecialidadPre;
  capitulo: string;
  unidad: string;
  definicion: string;
  incluye: string[];
  noIncluye: string[];
  materiales: string;
  equipo: string;
  manoObra: string;
  procedimiento: string[];
  metrado: string;
  medicionPago: string;
  controlAceptacion: string[];
  normas: string[];
  apu: LineaApuSpec[];
};

const KIND_LABEL: Record<RecursoKind, string> = {
  mo: "Mano de obra",
  mat: "Material",
  maq: "Maquinaria",
  eq: "Equipo",
};

function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("es-PE", { maximumFractionDigits: 4 });
}

/** APU real de la partida: si se pasa `ctx.linea`, usa su receta editada (cuadrilla/rendimiento/insumos propios de
 *  la obra) y los precios y jornada del presupuesto; sin contexto, usa la receta y los precios de catálogo. */
export function apuDePartida(partida: Partida, ctx: ContextoApuObra = {}): LineaApuSpec[] {
  const calc = calcularApu(partida, ctx.precios ?? {}, ctx.linea?.receta, ctx.insumosPropios, ctx.jornada ?? JORNADA_BASE);
  return calc.recursos.map((r) => ({
    kind: r.insumo.kind,
    codigo: r.insumo.codigo,
    nombre: r.insumo.nombre,
    und: r.insumo.und,
    cantidad: r.cantidad,
  }));
}

function listaKind(apu: LineaApuSpec[], kinds: RecursoKind[], undPartida: string, vacio: string): string {
  const filas = apu.filter((x) => kinds.includes(x.kind));
  if (!filas.length) return vacio;
  return filas
    .map((x) => `${x.codigo} · ${x.nombre} (${fmt(x.cantidad)} ${x.und} por ${undPartida} de partida)`)
    .join("; ");
}

export function especificacionDe(partida: Partida, ctx: ContextoApuObra = {}): EspecificacionTecnica {
  const esp = ESPECIALIDAD_META[partida.especialidad];
  const apu = apuDePartida(partida, ctx);
  const cuerpo = cuerpoDePartida(partida);
  const materiales = listaKind(
    apu,
    ["mat"],
    partida.und,
    "Esta partida no consume material de catálogo: el alcance es mano de obra, equipo o protocolo.",
  );
  const equipo = listaKind(
    apu,
    ["eq", "maq"],
    partida.und,
    "Herramientas menores (EQ-HIN) si figuran en el APU; no hay equipo mayor en esta receta.",
  );
  const manoObra = listaKind(apu, ["mo"], partida.und, "Sin cuadrilla de catálogo (partida de suministro o protocolo).");
  return {
    codigo: partida.codigo,
    titulo: partida.descripcion,
    especialidad: `${esp.kicker} · ${esp.label}`,
    especialidadId: partida.especialidad,
    capitulo: partida.capitulo,
    unidad: partida.und,
    definicion: cuerpo.definicion,
    incluye: cuerpo.incluye,
    noIncluye: cuerpo.noIncluye,
    materiales: `${materiales} ${matsNota(apu, partida.und)}`,
    equipo: `${equipo} El porcentaje de herramientas menores, si existe, se aplica sobre la mano de obra del APU.`,
    manoObra,
    procedimiento: cuerpo.procedimiento,
    metrado: cuerpo.metrado,
    medicionPago: cuerpo.medicionPago,
    controlAceptacion: cuerpo.controlAceptacion,
    normas: cuerpo.normas,
    apu,
  };
}

export function especificacionPorCodigo(codigo: string): EspecificacionTecnica | null {
  const p = partidaPorCodigo(codigo);
  return p ? especificacionDe(p) : null;
}

export function etiquetaKind(kind: RecursoKind): string {
  return KIND_LABEL[kind];
}
