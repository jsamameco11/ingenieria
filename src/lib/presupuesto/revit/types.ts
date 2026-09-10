export type RevitCampo = "concreto_m3" | "encofrado_m2" | "acero_kg" | "area_planta_m2" | "longitud_m" | "unidad_und";

export type RevitRol =
  | "zapata"
  | "dado"
  | "viga_cimentacion"
  | "cimiento_corrido"
  | "sobrecimiento"
  | "columna"
  | "placa"
  | "muro_concreto"
  | "viga"
  | "losa_aligerada"
  | "losa_maciza"
  | "escalera"
  | "cisterna"
  | "solado"
  | "albanileria"
  | "acero_suelto"
  | "desconocido";

export type RevitFilaEstado =
  | "sugerida"
  | "revisar"
  | "aceptada"
  | "anexada"
  | "fuera_de_plantilla"
  | "sin_identificar"
  | "hueco_plantilla"
  | "hueco_modelo"
  | "conflicto";

export type RevitElemento = {
  uniqueId: string;
  marca: string;
  tipo: string;
  nivel: string;
  cantidades: Partial<Record<RevitCampo, number>>;
};

export type RevitGrupo = {
  grupoId: string;
  rol: RevitRol;
  categoriaRevit: string;
  familia: string;
  tipo: string;
  material: string;
  claseMaterial: "concreto_armado" | "concreto_simple" | "acero" | "albanileria" | "madera" | "otro";
  fc: number | null;
  nivel: string;
  nElementos: number;
  uniqueIds: string[];
  cantidades: Partial<Record<RevitCampo, number>>;
  elementos?: RevitElemento[];
  confianzaClasificacion: "alta" | "media" | "baja";
  motivo: string[];
  addinVersion?: string;
};

export type RevitPaquete = {
  schema: string;
  paqueteId: string;
  modelId?: string;
  exportadoEn: string;
  revit?: { version?: string; archivo?: string; modelId?: string };
  obra?: { nombre?: string; plantillaSugerida?: string };
  grupos: RevitGrupo[];
  omitidos?: { uniqueId: string; motivo: string }[];
  addinVersion?: string;
  resumen?: { categoria: string; n: number }[];
  cambios?: { nuevos: number; modificados: number; eliminados: number; iguales: number };
};

export type RevitFila = {
  id: string;
  grupoId: string;
  campo: RevitCampo;
  rol: RevitRol;
  familia: string;
  tipo: string;
  nivel: string;
  und: string;
  metrado: number;
  codigo: string | null;
  descripcion: string;
  estado: RevitFilaEstado;
  motivo: string;
  uniqueIds: string[];
  enPlantilla: boolean;
  /** Si se copió o creó a partir de un código RN, el APU sale de aquí. */
  origenCodigo?: string;
};

export type VinculoRevit = {
  origen: "revit";
  paqueteId?: string;
  revision?: number;
  grupoId: string;
  campo: RevitCampo;
  uniqueIds: string[];
  exportadoEn: string;
  metradoModelo: number;
  metradoManual?: boolean;
  ausenteEnModelo?: boolean;
};
