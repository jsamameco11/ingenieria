import type { V2 } from "./geom";

export type Punto = { num: string; e: number; n: number };

export type TipoHab = "vivienda" | "vivienda-taller" | "club" | "comercio" | "industrial" | "especial";

export type TipoVia = "local-secundaria" | "local-principal" | "acceso-exclusivo";

export type Calidad = "A" | "B" | "C" | "D" | "E" | "F";

export type Seccion = {
  vereda: number;
  nVeredas: 1 | 2;
  moduloCalzada: number;
  estacionamiento: number;
  nEstacionamientos: 0 | 1 | 2;
  separador: number;
};

export type Criterios = {
  tipoHab: TipoHab;
  tipoDensidad: 1 | 2 | 3 | 4 | 5 | 6;
  tipoVia: TipoVia;
  seccion: Seccion;
  largoManzana: number;
  frenteMin: number;
  areaMin: number;
  profundidad: number;
  aporteRec: number;
  aporteParque: number;
  aporteEdu: number;
  aporteOtros: number;
  loteNormativo: number;
  cesionPrimaria: number;
  reservaRegional: number;
  servidumbreAT: number;
  calidad: Calidad;
  accesoUnico: boolean;
};

export type ViaCampo = "pia" | "pea" | "eje" | "pea2" | "pia2";

export type ViaExistente = {
  id: string;
  nombre: string;
  pia: Punto | null;
  pea: Punto | null;
  eje: Punto | null;
  pea2: Punto | null;
  pia2: Punto | null;
};

export type Ingreso = {
  id: string;
  nombre: string;
  arista: number;
  distancia: number;
  ancho: number;
};

/** Sección propia de una vía interna. El id es `h:0` (calle) o `v:0` (jirón). */
export type AjusteVia = {
  id: string;
  tipo: TipoVia;
  seccion: Seccion;
};

export type Meta = {
  proyecto: string;
  ubicacion: string;
  distrito: string;
  provincia: string;
  propietario: string;
  profesional: string;
  cip: string;
  fecha: string;
  lamina: string;
};

export type ProyectoLot = {
  meta: Meta;
  puntos: Punto[];
  cierre: "cercada" | "abierta";
  vias: ViaExistente[];
  sinIngreso: boolean;
  ingresos: Ingreso[];
  criterios: Criterios;
  /** Vías internas con sección distinta de la general. Vacío = todas iguales. */
  ajustesVias: AjusteVia[];
};

export type UsoLote = "vivienda" | "recreacion" | "educacion" | "otros" | "parque-zonal" | "residual";

export type Estado = "cumple" | "observacion" | "no-cumple" | "info";

export type Verificacion = {
  id: string;
  norma: string;
  texto: string;
  estado: Estado;
  valor: string;
};

export type LoteM = {
  id: string;
  manzana: string;
  numero: number;
  uso: UsoLote;
  poly: V2[];
  area: number;
  frente: number;
  profundidad: number;
  centro: V2;
};

export type Franja = {
  tipo: "vereda" | "estacionamiento" | "calzada" | "separador" | "cerco" | "existente-vereda" | "existente-calzada";
  poly: V2[];
  /** Relleno de la curva: el DXF sale como arco (bulge), no como esta poligonal. */
  soloVista?: boolean;
};

export type PuntoPl = { x: number; y: number; bulge?: number };

export type Polilinea = {
  capa: string;
  nombre: string;
  cerrada: boolean;
  pts: PuntoPl[];
};

export type ViaInterna = {
  id: string;
  nombre: string;
  orientacion: "h" | "v";
  tipo: TipoVia;
  ancho: number;
  radio: number;
  hit: V2[];
};

export type ViaGraficaExistente = {
  nombre: string;
  lineas: { nombre: string; a: V2; b: V2; p: V2 }[];
  franjas: Franja[];
  anchos: { etiqueta: string; metros: number }[];
  completa: boolean;
  ordenada: boolean;
};

export type IngresoGraf = {
  id: string;
  nombre: string;
  pt: V2;
  hacia: V2;
  ancho: number;
  arista: number;
  distancia: number;
};

export type AporteRes = {
  concepto: string;
  pct: number;
  requerido: number;
  grafico: number;
  minimo: number;
  estado: string;
};

export type Modelo = {
  ok: boolean;
  motivo: string;
  areaBruta: number;
  perimetro: number;
  areaVias: number;
  areaLotes: number;
  areaAportes: number;
  areaResidual: number;
  areaBaseAporte: number;
  areaDescartadaArt31: number;
  angulosAgudos: number;
  sinAsignar: number;
  aportes: AporteRes[];
  lotes: LoteM[];
  franjas: Franja[];
  ejes: { nombre: string; partes: V2[][] }[];
  lindero: V2[];
  cerco: V2[][];
  viasExistentes: ViaGraficaExistente[];
  ingresos: IngresoGraf[];
  verificaciones: Verificacion[];
  seccionPartes: { tipo: string; ancho: number; etiqueta: string }[];
  seccionTotal: number;
  viasInternas: ViaInterna[];
  polilineas: Polilinea[];
  largoManzana: number;
  profundidad: number;
  nManzanas: number;
  rumboGrados: number;
};

export type Trazo = {
  t: "poly" | "line" | "text";
  pts?: V2[];
  a?: V2;
  b?: V2;
  p?: V2;
  text?: string;
  fill: string;
  stroke: string;
  sw: number;
  dash?: string;
  size?: number;
};
