import type { EspecialidadPre } from "../presupuesto/types";

export type ConfianzaPlano = "alta" | "media" | "baja";

export type FuentePlano = "cuadro" | "unifilar" | "leyenda" | "planta" | "criterio";

export type LineaGrok = {
  codigo: string;
  metrado: number;
  fuente: FuentePlano;
  confianza: ConfianzaPlano;
  nota: string;
};

export type NoCatalogada = {
  que_se_vio: string;
  unidad: string;
  cantidad: number;
  por_que_no_entra: string;
};

export type PausasGrok = {
  a1?: { catalogo_n_declarado?: number; catalogo_n_contado?: number; capitulos?: string[]; resultado?: string };
  b0?: string[];
  b1?: {
    n_torres?: number | null;
    n_pisos?: number | null;
    n_unidades?: number | null;
    tipico?: string;
    factor_usado?: string;
    resultado?: string;
  };
  c1?: { asignadas?: number; sin_codigo?: number; sin_cantidad?: number; resultado?: string };
  d1?: string[];
};

export type LecturaGrok = {
  obra_leida: string;
  especialidad: string;
  escala: string;
  lineas: LineaGrok[];
  no_catalogadas: NoCatalogada[];
  hallazgos: string[];
  revision: string[];
  pausas_ejecutadas?: PausasGrok;
};

export type PaginaRaster = {
  file: string;
  page: number;
  dataUrl: string;
};

export type LotePdf = {
  id: string;
  especialidad: EspecialidadPre;
  files: File[];
};
