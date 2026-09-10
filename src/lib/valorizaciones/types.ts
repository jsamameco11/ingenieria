export type FrecuenciaValorizacion = "mensual" | "bimestral" | "trimestral";

export const FRECUENCIA_META: Record<FrecuenciaValorizacion, { label: string; dias: number }> = {
  mensual: { label: "Mensual", dias: 30 },
  bimestral: { label: "Bimestral", dias: 60 },
  trimestral: { label: "Trimestral", dias: 90 },
};

/** Contractual = viene del presupuesto. Adicional = prestación adicional (partida nueva fuera del contrato).
 *  Deductivo = presupuesto deductivo (vinculado a un adicional, o reducción de alcance) que se resta de lo valorizado. */
export type ItemTipo = "contractual" | "adicional" | "deductivo";

export type ValorItem = {
  id: string;
  codigo: string;
  descripcion: string;
  und: string;
  /** Capítulo del presupuesto (p. ej. «01 Trabajos preliminares»), fijado al importar del presupuesto. Se usa para
   *  agrupar la tabla de valorización por capítulo, igual que en la Hoja de Presupuesto. Vacío en ítems fuera de
   *  catálogo o en valorizaciones creadas antes de este agrupamiento (van sueltos, ver `agruparPorCapitulos`). */
  capitulo?: string;
  /** Etiqueta de la especialidad del presupuesto (p. ej. «Arquitectura»), fijada al importar. */
  especialidad?: string;
  /** Metrado total contratado (de la partida en el presupuesto). 0 en partidas adicionales/deductivas. */
  metradoContractual: number;
  precioUnitario: number;
  /** Acumulado ejecutado en valorizaciones anteriores (se recalcula al importar / al agregar el adicional). */
  metradoAnterior: number;
  /** Ejecutado en este periodo. Editable por el usuario. */
  metradoPeriodo: number;
  /** Código de catálogo de origen, para poder desglosar insumos (materiales/equipos). */
  origenCodigo?: string;
  tipo: ItemTipo;
  /** Solo para tipo "deductivo": código del adicional al que está vinculado (deductivo vinculado), si corresponde.
   *  Los deductivos vinculados se descuentan del presupuesto de adicionales al calcular el límite del 15 %
   *  (Ley N.° 32069, art. 64). Vacío = deductivo no vinculado (reducción de alcance del contrato original). */
  vinculadoA?: string;
};

export type ValorPeriodo = {
  id: string;
  numero: number;
  nombre: string;
  frecuencia: FrecuenciaValorizacion;
  desde: string;
  hasta: string;
  items: ValorItem[];
  estado: "abierta" | "cerrada";
  notas: string;
  /** Mes calendario (YYYY-MM) para el reajuste por índices unificados (D.S. 011-79-VC). */
  mesValorizacion: string;
  /** Instantánea de los índices Ir usados en el reajuste de este periodo (por código de IU). No se sobrescribe al cambiar la Fórmula polinómica en otro periodo. */
  indicesIrPeriodo?: Record<string, number>;
  /** Días calendario de plazo adicional sustentados en el informe de adicional de obra. */
  plazoAdicionalDias: number;
  sustentoPlazoAdicional: string;
  /** Número de resolución/aprobación del adicional, si ya se emitió (se imprime en el informe). */
  resolucionAprobacion: string;
  /** Monto (S/.) amortizado en este periodo por el adelanto directo. Editable; 0 si no se otorgó adelanto directo
   *  o si este periodo no amortiza (Ley N.° 32069, art. 180). */
  amortizacionDirecto: number;
  /** Monto (S/.) amortizado en este periodo por el adelanto para materiales e insumos, según su consumo real en
   *  obra (Ley N.° 32069, art. 181). */
  amortizacionMateriales: number;
  /** Días calendario de atraso injustificado imputable al contratista, acumulados a la fecha de esta valorización,
   *  para el cálculo de la penalidad por mora (Ley N.° 32069, art. 120). 0 = sin atraso o atraso justificado. */
  diasAtrasoInjustificado: number;
  /** Penalidad por mora del periodo, si se anula la fórmula automática y se registra un monto ya calculado/aprobado
   *  por la Entidad. undefined = usar el cálculo automático del art. 120. */
  penalidadMoraManual?: number;
};

/** Un monomio de una fórmula polinómica armada a mano en Valorizaciones (sin depender del presupuesto): el usuario
 *  elige el índice unificado, escribe el coeficiente de participación y el Io del mes base — igual que se lee un
 *  expediente técnico con la fórmula ya aprobada. */
export type MonomioManual = {
  id: string;
  /** "a".."h"; se asigna automáticamente al agregar la fila, editable. */
  letra: string;
  /** Código del índice unificado (INEI), FK a IU_BY_CODIGO. */
  codigoIU: number;
  /** Participación del monomio (0 a 1). La suma de todos los monomios debe ser 1.000. */
  coeficiente: number;
  /** Índice del mes base (Io) de este monomio. */
  io: number;
};

export type FormulaManualState = {
  /** true una vez que el usuario decide armar la fórmula a mano (aunque aún no tenga monomios). */
  creada: boolean;
  monomios: MonomioManual[];
};

export type AdelantosState = {
  /** Monto (S/., incluye IGV) del adelanto directo entregado. 0 = no se otorgó. */
  directoMonto: number;
  /** % del monto del contrato original que representó el adelanto directo (define la cuota de amortización). */
  directoPct: number;
  directoFecha: string;
  /** Monto (S/.) del adelanto para materiales e insumos entregado. 0 = no se otorgó. */
  materialesMonto: number;
  materialesFecha: string;
};

export type ValorizacionesState = {
  obra: string;
  periodos: ValorPeriodo[];
  selPeriodoId: string;
  /** Programado acumulado (S/., por periodo) importado manualmente por CSV, para la curva S. Si un periodo no
   *  tiene entrada aquí, la curva S usa el programado calculado del cronograma (Gantt/CPM). */
  programadoManual?: Record<string, number>;
  adelantos: AdelantosState;
  /** Plazo de ejecución contractual vigente, en días calendario (incluye ampliaciones aprobadas). Se usa para el
   *  factor F de la penalidad por mora: F = 0.40 si el plazo es ≤ 60 días, F = 0.25 si es mayor (art. 120). */
  plazoContractualDias: number;
  /** Origen de la fórmula polinómica para el reajuste: "presupuesto" usa la fórmula armada en Fórmula polinómica
   *  (PRE-02) a partir de las incidencias del APU; "manual" usa `formulaManual`, armada directamente aquí (por
   *  ejemplo, copiada del expediente técnico con el que se valorizará). */
  formulaOrigen: "presupuesto" | "manual";
  formulaManual: FormulaManualState;
};
