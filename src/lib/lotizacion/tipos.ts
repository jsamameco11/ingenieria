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

/** Lo que va entre la vereda y la calzada. El martillo del sardinel sigue siendo vereda. */
export type LateralVia = "estacionamiento" | "jardin";

/** Sección propia de una vía interna. El id es `h:0` (calle) o `v:0` (jirón). */
export type AjusteVia = {
  id: string;
  tipo: TipoVia;
  seccion: Seccion;
  /** Estacionamiento de 2.40 m (GH.020 Art. 9) o berma jardín de al menos 1.00 m. */
  lateral?: LateralVia;
  /** Ancho de la berma jardín, en metros. No baja de 1.00. */
  jardin?: number;
};

/** Espesores del corte, en metros. Se editan y recién entran al dibujo con Dibujar. */
export type Pavimento = {
  carpeta: number;
  base: number;
  subbase: number;
  veredaEsp: number;
  sardinel: number;
};

export type CorteVia = {
  letra: string;
  titulo: string;
  via: string;
  orientacion: "h" | "v";
  seccion: Seccion;
  lateral?: LateralVia;
  a: V2;
  b: V2;
  /** Eje de la calzada. La marca de corte se desliza entre estos dos puntos. */
  eje0?: V2;
  eje1?: V2;
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
  pavimento: Pavimento;
  /** Categoría elegida para cada parque. La clave es el centro del paño, en metros. */
  parques?: AjusteParque[];
  /** Cómo se arma el aporte de recreación. */
  modoParque?: ModoParque;
  /** Recorridos internos: rectos o con curvas suaves. */
  trazaVias?: "recta" | "curva";
};

export type CategoriaParque = "pasiva" | "activa";

export type EstiloParque = "organico" | "geometrico" | "lineal";

/** manzana: el parque ocupa la manzana completa. lotes: deja vivienda aledaña en la misma manzana. */
export type ModoParque = "manzana" | "lotes";

export type AjusteParque = {
  clave: string;
  categoria: CategoriaParque;
  estilo?: EstiloParque;
  /** Largo de la losa, en metros. Vacío: el motor elige según el claro. */
  largoCancha?: number;
  /** Ancho de la losa, en metros. */
  anchoCancha?: number;
};

export type PiezaParque = {
  capa: string;
  pts: V2[];
  fill: string;
  stroke: string;
  sw: number;
  cerrado: boolean;
  /** Relleno que en el DXF sale como HATCH sólido, del mismo color que en pantalla. */
  hatch?: boolean;
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
  tipo: "vereda" | "rampa" | "estacionamiento" | "jardin" | "calzada" | "separador" | "cerco" | "existente-vereda" | "existente-calzada";
  poly: V2[];
  /** Relleno de la curva: el DXF sale como arco (bulge), no como esta poligonal. */
  soloVista?: boolean;
  /** Pendiente de la rampa, en pares de puntos. */
  lineas?: V2[][];
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
  cortes: CorteVia[];
  pavimento: Pavimento;
  parques: Parque[];
};

export type Parque = {
  clave: string;
  categoria: CategoriaParque;
  estilo: EstiloParque;
  nombre: string;
  poly: V2[];
  area: number;
  piezas: PiezaParque[];
  textos: { p: V2; text: string; size: number; fill: string }[];
  nota: string;
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
  /** Centra el texto en la vertical, para la letra dentro de la burbuja de corte. */
  medio?: boolean;
  /** Se recorta al perímetro del predio (calzadas, veredas, ejes). */
  clip?: boolean;
};
