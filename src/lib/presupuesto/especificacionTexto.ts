import type { EspecialidadPre, Partida, RecursoKind } from "./types";
import { ESPECIALIDAD_META } from "./types";
import { cuerpoDeportiva } from "./especificacionDeportiva";

export type CuerpoSpec = {
  definicion: string;
  incluye: string[];
  noIncluye: string[];
  procedimiento: string[];
  metrado: string;
  medicionPago: string;
  controlAceptacion: string[];
  normas: string[];
};

type Fam =
  | "trazo"
  | "limpieza"
  | "demolicion"
  | "cartel"
  | "cercado"
  | "caseta"
  | "ssoma"
  | "andamio"
  | "excavacion"
  | "relleno"
  | "eliminacion"
  | "emparejado"
  | "talud"
  | "concreto"
  | "acero"
  | "encofrado"
  | "aligerado"
  | "albanileria"
  | "drywall"
  | "dintel"
  | "tarrajeo"
  | "cielorraso"
  | "piso"
  | "zocalo"
  | "revestimiento"
  | "impermeabilizacion"
  | "pintura"
  | "carpinteria"
  | "metal"
  | "cubierta"
  | "jardineria"
  | "sanitario_punto"
  | "sanitario_aparato"
  | "sanitario_red"
  | "electrico_punto"
  | "tablero"
  | "conductor"
  | "canalizacion"
  | "luminaria"
  | "tierra"
  | "comunicaciones"
  | "incendio"
  | "hvac"
  | "pavimento"
  | "deportiva"
  | "saneamiento"
  | "carretera"
  | "puente"
  | "hidraulica"
  | "habilitacion"
  | "equipamiento"
  | "electromecanica"
  | "prueba"
  | "generico";

function has(d: string, ...xs: string[]) {
  return xs.some((x) => d.includes(x));
}

function extraer(desc: string) {
  const fc = desc.match(/f[''′]?c\s*[=:]?\s*(\d+)/i)?.[1];
  const fy = desc.match(/fy\s*[=:]?\s*([\d.\s]+)/i)?.[1]?.replace(/\s+/g, " ").trim();
  const e = desc.match(/\be\s*=\s*([\d.,]+\s*(?:cm|mm|m|"|''))/i)?.[1];
  const h = desc.match(/\bh\s*=\s*([^,;]+)/i)?.[1]?.trim();
  const diam = desc.match(/[Øø]\s*([\d./–\-]+\s*(?:mm|pulg|"|''))/i)?.[1];
  const dist = desc.match(/\bD\s*=\s*([\d.,]+\s*km)/i)?.[1];
  const dim = desc.match(/(\d+[.,]?\d*)\s*[×xX]\s*(\d+[.,]?\d*)(?:\s*[×xX]\s*(\d+[.,]?\d*))?\s*(cm|mm|m)?/);
  return {
    fc: fc ? `f'c = ${fc} kg/cm²` : "",
    fy: fy ? `fy = ${fy} kg/cm²` : "",
    e: e ? `espesor ${e}` : "",
    h: h ? h : "",
    diam: diam ? `Ø ${diam}` : "",
    dist: dist || "",
    dim: dim ? dim[0].replace(/x/gi, "×") : "",
  };
}

function codigoCap(codigo: string) {
  const m = codigo.match(/^([A-Z]+)-(\d{2})(?:\.(\d{2}))?/);
  return { letra: m?.[1] ?? "", cap: m?.[2] ?? "", sub: m?.[3] ?? "" };
}

function familiaDe(p: Partida): Fam {
  const d = p.descripcion.toLowerCase();
  const { letra, cap, sub } = codigoCap(p.codigo);

  if (p.especialidad === "equipamiento" || /^(EQ-|MA-|UT-|MO-|HE-)/.test(p.codigo)) return "equipamiento";
  if (has(d, "hipot", "aislamiento de media", "termografía", "relés de protección", "prueba hidrostática", "prueba de") && has(d, "protocolo", "ensayo", "prueba", "certific")) return "prueba";

  if (has(d, "trazo", "replanteo")) return "trazo";
  if (has(d, "desbroce", "limpieza de terreno", "retiro de vegetación")) return "limpieza";
  if (has(d, "demolic")) return "demolicion";
  if (has(d, "cartel de obra")) return "cartel";
  if (has(d, "cercado", "cerco de", "malla raschel", "malla olán")) return "cercado";
  if (has(d, "caseta de obra", "caseta de guardian", "guardianía", "campamento de obra", "campamento")) return "caseta";
  if (has(d, "ssoma", "seguridad y salud")) return "ssoma";
  if (has(d, "andamio", "apuntalamiento", "puntal")) return "andamio";
  if (has(d, "emparejado", "nivelación de terreno", "corte superficial")) return "emparejado";
  if (has(d, "desquinche", "talud", "perfilado de talud")) return "talud";
  if (has(d, "eliminación", "eliminacion", "transporte de material excedente", "d=5", "d=10")) return "eliminacion";
  if (has(d, "relleno", "compactac") && !has(d, "pavimento", "afirmado")) return "relleno";
  if (has(d, "excav")) return "excavacion";

  if (/^P-08\.|^P-09\.|^P-10\./.test(p.codigo) || has(d, "losa deportiva", "grass sintético", "grass sintetico", "demarcación deportiva", "demarcacion deportiva", "plataforma deportiva", "cancha de fulbito", "shock pad")) {
    return "deportiva";
  }

  if (has(d, "calamin", "tr-4", "tr4", "tr-5", "tr5", "trapezoidal", "teja andina", "cumbrera", "limahoya", "limatesa", "fibrocemento") || (has(d, "cobertura", "cubierta") && (letra === "ARQ" || p.especialidad === "arquitectura"))) {
    return "cubierta";
  }
  if (has(d, "césped", "cesped", "tierra vegetal", "plantación de árbol", "plantacion de arbol", "jardinería", "jardineria", "árbol forestal")) return "jardineria";

  if (has(d, "encofrado", "desencofrado")) return "encofrado";
  if (has(d, "acero fy", "acero estructural", "fy 4")) return "acero";
  if (has(d, "ladrillo hueco de techo") || (has(d, "aligerado") && p.und === "m²" && has(d, "15×", "15x", "techo"))) return "aligerado";
  if (has(d, "concreto", "f'c", "f´c", "solado", "falso piso", "cimiento", "sobrecimiento", "ciclópeo", "ciclopeo")) return "concreto";
  if (has(d, "dintel")) return "dintel";
  if (has(d, "drywall")) return "drywall";
  if (has(d, "muro de ladrillo", "tabique de ladrillo", "king kong", "pandereta", "asentado de ladrillo", "bloque de concreto")) return "albanileria";

  if (has(d, "tarrajeo", "enlucido", "vestidura")) return "tarrajeo";
  if (has(d, "cielorraso", "cielo raso", "cornisa")) return "cielorraso";
  if (has(d, "impermeabil")) return "impermeabilizacion";
  if (has(d, "zócalo", "zocalo")) return "zocalo";
  if (has(d, "mayólica en pared", "revestimiento de piedra", "laqueado")) return "revestimiento";
  if (has(d, "pintura", "barniz", "esmalte", "látex", "latex", "epóxica")) return "pintura";
  if (has(d, "contrapiso", "piso de", "porcelanato", "cerámico", "ceramico", "parquet", "laminado", "terrazo", "vinílico", "vinilico", "granito", "loseta")) return "piso";

  if (has(d, "puerta contraplacada", "closet", "marco de madera", "carpintería de madera")) return "carpinteria";
  if (has(d, "ventana", "puerta metálica", "baranda", "portón", "cerrajería", "aluminio")) return "metal";

  if (has(d, "inodoro", "lavatorio", "ducha", "lavadero", "urinal", "grifería", "griferia", "bidet", "tanque elevado", "calentador")) return "sanitario_aparato";
  if (has(d, "punto de agua", "punto de desagüe", "punto de desague", "punto de ventilación", "punto de desague")) return "sanitario_punto";
  if ((p.especialidad === "sanitarias" || letra === "IS") && has(d, "tuber", "colector", "ramal", "cámara", "camara", "caja registro", "válvula", "valvula")) return "sanitario_red";

  if (p.especialidad === "comunicaciones" || letra === "COM" || has(d, "utp", "fibra óptica", "fibra optica", "cctv", "nvr", "access point", "cat 6")) return "comunicaciones";

  if (has(d, "tablero", "tda", "tdg", "tgbt", "mcc") || has(d, "medidor eléctrico", "medidor electrico")) return "tablero";
  if (has(d, "luminaria", "plafón", "proyector", "foco", "spot", "downlight", "reflector")) return "luminaria";
  if (has(d, "puesta a tierra", "pozo de tierra", "malla de tierra", "electrod")) return "tierra";
  if (has(d, "thw", "thhn", "conductor", "alimentador", "n2x", "nyy") || ((letra === "IE" || letra === "IEM") && has(d, "cable"))) return "conductor";
  if (has(d, "pvc-p", "canalización", "canalizacion", "emt", "imc", "bandeja", "tubería conduit")) return "canalizacion";
  if (has(d, "punto de", "tomacorriente", "interruptor", "salida de") && (p.especialidad === "electricas" || letra === "IE" || p.und === "pnto")) return "electrico_punto";

  if (has(d, "sprinkler", "incendio", "hidrante", "siamés", "siames", "detector de humo", "estrobo", "nfpa")) return "incendio";
  if ((letra === "IM" && cap === "09") || has(d, "minsa-diem", "biomédic", "biomedic", "siga grupo 65")) return "equipamiento";
  if (p.especialidad === "mecanicas" || letra === "IM" || has(d, "aire acondicionado", "chiller", "ducto", "ventilador", "split")) return "hvac";
  if (p.especialidad === "electromecanicas" || letra === "IEM") return "electromecanica";
  if (p.especialidad === "pavimentos" || letra === "P" || has(d, "carpeta asfáltica", "afirmado", "sardinel", "vereda", "base granular")) return "pavimento";
  if (p.especialidad === "saneamiento" || letra === "S") return "saneamiento";
  if (p.especialidad === "carreteras" || letra === "CAR") return "carretera";
  if (p.especialidad === "puentes" || letra === "PTE") return "puente";
  if (p.especialidad === "hidraulica" || letra === "HID") return "hidraulica";
  if (p.especialidad === "habilitaciones" || letra === "HAB") return "habilitacion";

  if (letra === "ARQ" && cap === "01") return "limpieza";
  if (letra === "ARQ" && cap === "02") return "excavacion";
  if (letra === "ARQ" && cap === "05") return "albanileria";
  if (letra === "ARQ" && cap === "06") return "tarrajeo";
  if (letra === "ARQ" && cap === "07") return "piso";
  if (letra === "ARQ" && cap === "08") return "revestimiento";
  if (letra === "ARQ" && cap === "09") return "carpinteria";
  if (letra === "ARQ" && cap === "10") return "metal";
  if (letra === "ARQ" && cap === "11") return "metal";
  if (letra === "ARQ" && cap === "12") return "pintura";
  if (letra === "ARQ" && cap === "13") return "cubierta";
  if (letra === "ARQ" && cap === "14") return "jardineria";
  if (letra === "ARQ" && cap === "16") return "limpieza";
  if (letra === "EST" && cap === "03") return "concreto";
  if (letra === "EST" && cap === "04" && sub === "02") return "acero";
  if (letra === "EST" && cap === "04" && sub === "03") return "encofrado";
  if (letra === "EST" && cap === "04") return "concreto";
  if (letra === "IS") return "sanitario_red";
  if (letra === "IE") return "electrico_punto";
  if (p.especialidad === "estructuras") return "concreto";
  if (p.especialidad === "electricas") return "electrico_punto";
  if (p.especialidad === "sanitarias") return "sanitario_red";
  if (p.especialidad === "arquitectura") return "albanileria";

  return "generico";
}

function titulo(p: Partida) {
  return p.descripcion.replace(/\s+/g, " ").trim();
}

function esp(p: Partida) {
  return ESPECIALIDAD_META[p.especialidad as EspecialidadPre]?.label ?? p.especialidad;
}

function matsNota(apu: { kind: RecursoKind }[], und: string) {
  const mats = apu.filter((x) => x.kind === "mat");
  if (!mats.length) return "Esta partida no consume material de catálogo: el alcance es mano de obra, equipo, protocolo o suministro ya valorado en otro ítem.";
  return `Los materiales del APU se dosifican por cada ${und} de partida. Diámetro, sección, resistencia, espesor y norma no se aproximan. Equivalente técnico solo con aprobación escrita de supervisión.`;
}

function pago(und: string, tituloPartida: string) {
  return `Se paga la cantidad ejecutada, medida y aceptada por supervisión, en ${und}, al precio unitario de contrato de la partida «${tituloPartida}». El P.U. cubre la receta del APU (mano de obra, materiales, maquinaria, equipo, desperdicios, transporte interno y pruebas de la partida). No hay pago doble por el mismo frente ni valorización de recortes o desperdicio.`;
}

function controlBase(p: Partida): string[] {
  return [
    `La partida se acepta cuando lo ejecutado coincide con «${titulo(p)}», la unidad ${p.und} y el metrado de planos (cuadro > corte > planta).`,
    "No se admite equivalente de diámetro, sección, resistencia, potencia ni modelo si el catálogo y el plano ya fijaron el ítem.",
    "El frente queda limpio, alineado y sin daño al elemento adyacente. Se paga solo lo ejecutado y aceptado.",
  ];
}

function normasBase(_p: Partida, extra: string[]): string[] {
  const base = [
    "Reglamento Nacional de Metrados para Obras de Edificación y Habilitaciones Urbanas",
    "Reglamento Nacional de Edificaciones (RNE), edición vigente",
    "Especificaciones técnicas del expediente, planos de la especialidad y memoria descriptiva",
  ];
  return [...base, ...extra.filter(Boolean)];
}

function metradoUnd(und: string, d: string): string {
  if (und === "m") {
    if (has(d, "tuber", "conductor", "canaliz", "cobre", "utp", "fibra", "baranda", "zócalo", "zocalo", "sardinel")) {
      return "Se mide la longitud neta ejecutada según eje o trazo del plano, en metros lineales. Incluye solapes de fábrica previstos en el APU. Recortes y desperdicio no se miden aparte.";
    }
    return "Se mide la longitud neta ejecutada según eje, trazo o desarrollo del elemento, en metros lineales.";
  }
  if (und === "m²") {
    return "Se mide el área neta ejecutada según cotas de plano. No se descuentan vanos menores de 0,25 m² salvo que la partida o el Reglamento de Metrados lo indiquen. Juntas, recortes y desperdicio van en el P.U.";
  }
  if (und === "m³") {
    return "Se mide el volumen geométrico del elemento o de la sección tipificada, sin esponjamiento. El transporte, el desperdicio y la merma están en el P.U.";
  }
  if (und === "kg") {
    return "Se mide el peso teórico según despiece o cuantía de los planos estructurales, con el recargo de la partida si está escrito. No se paga el peso de balanza de recortes.";
  }
  if (und === "pnto") {
    return "Se cuenta cada punto o salida completa según el cuadro de cargas o el plano de instalaciones (el cuadro prevalece sobre el conteo visual). Incluye lo que la descripción de la partida declara (caja, tramo de acometida, conductor o aparato).";
  }
  if (und === "und") {
    return "Se cuenta cada unidad suministrada, colocada, probada y entregada operativa, incluyendo anclajes y conexiones que la descripción incorpore.";
  }
  if (und === "juego" || und === "par") {
    return "Se cuenta el juego o el par completo, instalado, alineado y aceptado. No se fracciona un solo elemento del juego.";
  }
  if (und === "glb") {
    return "Una sola unidad global por el alcance descrito. No se fracciona salvo valorización proporcional aprobada por supervisión.";
  }
  if (und === "km") return "Se mide el eje de la vía o de la red, en kilómetros, según la poligonal del expediente.";
  if (und.includes("mes")) return `Se mide en ${und} según el tiempo de permanencia efectivo en obra, certificado por supervisión.`;
  return `Se mide en ${und} según el plano, el metrado del presupuesto y el Reglamento Nacional de Metrados.`;
}

function cuerpo(p: Partida, fam: Fam): CuerpoSpec {
  const t = titulo(p);
  const d = t.toLowerCase();
  const x = extraer(t);
  const und = p.und;
  const cap = p.capitulo;
  const especialidad = esp(p);
  const dato = [x.fc, x.fy, x.e, x.h && `aparejo/altura ${x.h}`, x.diam, x.dim, x.dist].filter(Boolean).join("; ");
  const datoFrase = dato ? ` Características de catálogo: ${dato}.` : "";
  const comunNo = [
    "Partidas de otra especialidad o de otro capítulo, aunque se ejecuten en el mismo frente.",
    "Trabajos no descritos en esta partida ni en su APU.",
    "Reparación de daños causados por terceros o por partidas posteriores.",
  ];

  const out = (partial: Partial<CuerpoSpec> & Pick<CuerpoSpec, "definicion" | "procedimiento">): CuerpoSpec => ({
    incluye: partial.incluye ?? [
      `Suministro, transporte interno y colocación de todo lo necesario para ejecutar «${t}».`,
      "Cuadrilla, herramientas menores y equipo del APU.",
      "Pruebas, limpieza del frente y retiro de recortes propios de la partida.",
    ],
    noIncluye: partial.noIncluye ?? comunNo,
    metrado: partial.metrado ?? metradoUnd(und, d),
    medicionPago: partial.medicionPago ?? pago(und, t),
    controlAceptacion: partial.controlAceptacion ?? controlBase(p),
    normas: partial.normas ?? normasBase(p, []),
    definicion: partial.definicion,
    procedimiento: partial.procedimiento,
  });

  switch (fam) {
    case "trazo":
      return out({
        definicion: `Consiste en el trazo y replanteo de los ejes, niveles y puntos de control de la obra «${t}», sobre el terreno o la plataforma ya despejada, de acuerdo con los planos de ${especialidad} y el capítulo ${cap}. Incluye la materialización de benchmarks, estacas, yeso o cal, y la verificación de escuadras, alineamientos y cotas.${datoFrase}`,
        incluye: [
          "Estación total o nivel de ingeniero, mira, estacas, yeso/cal y puntos de referencia (BM).",
          "Acta de replanteo y croquis de ejes entregado a supervisión.",
        ],
        noIncluye: ["Movimiento de tierras, excavación o concreto, que se pagan en sus partidas.", ...comunNo.slice(1)],
        procedimiento: [
          "Revisar planos de arquitectura y estructuras, verificar coherencia de ejes y cotas.",
          "Materializar un BM de obra ligado a la red o al BM del expediente. Protegerlo durante toda la ejecución.",
          "Trazar ejes principales y secundarios. Marcar sobre terreno o sobrecimiento con yeso, clavos o tinta.",
          "Comprobar escuadras (3-4-5 o estación), distancias y niveles. Corregir desviaciones mayores a la tolerancia del plano (±5 mm en ejes de edificación, salvo otra indicación).",
          "Entregar croquis de replanteo firmado. No iniciar excavación ni asentado sin conformidad de supervisión.",
        ],
        normas: normasBase(p, ["RNE E.030 / E.050 (si aplica al control de cotas)", "Buenas prácticas de topografía de obra"]),
      });
    case "limpieza":
      return out({
        definicion: `Consiste en la limpieza, desbroce y retiro de la capa vegetal, raíces, escombros y residuos superficiales en el área de «${t}», según el plano de movimiento de tierras y el capítulo ${cap}. El terreno queda despejado y listo para trazo, emparejado o excavación. No se mezcla material orgánico con relleno estructural.${datoFrase}`,
        incluye: ["Corte de vegetación, retiro de raíces y acopio fuera de la plataforma.", "Carga y transporte interno hasta el depósito indicado en obra (el hauling a botadero se paga en eliminación si existe esa partida)."],
        noIncluye: ["Excavación masiva, emparejado con tractor D8 ni eliminación a botadero, salvo que esta partida lo declare.", ...comunNo.slice(1)],
        procedimiento: [
          "Delimitar el área a limpiar con el plano de movimiento de tierras. Proteger árboles o linderos que el expediente conserve.",
          "Retirar vegetación, raíces y escombros con peones y, si el APU lo contempla, maquinaria liviana o tractor.",
          "Acopiar material orgánico fuera de la plataforma. No usarlo como relleno de cimentación.",
          "Barrido y entrega del terreno despejado, sin pozos ni tocones, listo para la partida siguiente.",
        ],
        normas: normasBase(p, ["RNE CE.010 (si es habilitación)", "Normas ambientales locales de disposición de residuales orgánicos"]),
      });
    case "demolicion":
      return out({
        definicion: `Consiste en la demolición controlada de «${t}», el retiro de escombros y la preparación del frente para la obra nueva, según planos y el capítulo ${cap}. Se ejecuta sin dañar estructuras o instalaciones que permanecen. El volumen o el área se ciñe a lo demolido realmente, no al elemento teórico si hay variación de espesor.${datoFrase}`,
        incluye: ["Corte, picado, apuntalamiento provisional si hace falta, carga de escombro a 20 m y limpieza del frente."],
        noIncluye: ["Eliminación a botadero fuera de obra (partida de eliminación), ni reconstrucción del elemento demolido."],
        procedimiento: [
          "Identificar instalaciones vivas. Cortar servicios. Apuntalar elementos contiguos que deban permanecer.",
          "Demoler con herramienta manual o equipo de corte del APU, de arriba hacia abajo, sin impacto indiscriminado sobre estructura existente.",
          "Separar fierro, madera y escombro. Humedecer para control de polvo.",
          "Cargar escombro, limpiar el frente y entregar el área libre de puntas y restos sueltos.",
        ],
        controlAceptacion: [
          ...controlBase(p),
          "No se acepta sobre-demolición del elemento que permanece. Los daños se reponen a costo del contratista.",
        ],
        normas: normasBase(p, ["RNE E.060 (si hay estructura adyacente)", "Plan de demolición y SSOMA de obra"]),
      });
    case "cartel":
      return out({
        definicion: `Consiste en el suministro, armado, pintura, rotulado e instalación del ${t}, en el lugar indicado por el expediente o la entidad, con la información de obra, contratista, modalidad y plazos. Incluye postes, fundaciones simples, riostras y mantenimiento de legibilidad durante la obra.${datoFrase}`,
        procedimiento: [
          "Verificar dimensiones del cartel en la descripción (no reducir el área de aviso).",
          "Fabricar estructura de madera o metal según APU, pintar fondo y rotular con vinil o pintura de tráfico.",
          "Cimentar postes, aplomar, tensar riostras y colocar a altura de lectura desde la vía.",
          "Mantener legible. Reponer si el clima o el vandalismo lo deterioran, mientras dure la obra.",
        ],
        normas: normasBase(p, ["Manual de identidad de la entidad contratante", "Normas municipales de publicidad en vía pública"]),
      });
    case "cercado":
      return out({
        definicion: `Consiste en el suministro e instalación de «${t}» para cerrar el predio o el frente de trabajo, con la altura, malla y postes indicados en la descripción. Incluye dados de concreto, tensores y puertas peatonales si el APU y la descripción las contemplan.${datoFrase}`,
        procedimiento: [
          "Replantear el perímetro. Excavar dados. Colocar postes a plomo con el espaciamiento del plano o del APU.",
          "Tensar malla, fijar con alambre o grampas, colocar tensores en esquinas.",
          "Instalar acceso de obra. Señalizar SSOMA.",
          "Entregar el cerco continuo, sin claros, a la altura de la partida.",
        ],
      });
    case "caseta":
      return out({
        definicion: `Consiste en el armado e instalación de «${t}» como instalación provisional de obra (guardianía, almacén o similar), con la carpintería, cubierta y cerramientos del APU. Se desmonta al finalizar si el expediente no la deja definitiva.${datoFrase}`,
        procedimiento: [
          "Nivelar plataforma. Armar estructura según despiece del APU.",
          "Colocar cerramientos, puerta, cubierta y pintura.",
          "Entregar operativa (cerradura, ventilación). Mantener mientras dure la obra.",
        ],
      });
    case "ssoma":
      return out({
        definicion: `Consiste en la implementación del sistema de seguridad y salud en el trabajo de la obra («${t}»): inducción, EPP, señalización, botiquín, extintores, registros y vigilancia según el plan SSOMA y la Ley N.° 29783. Es un alcance global de obra, no un metrado de partida de producción.${datoFrase}`,
        procedimiento: [
          "Presentar el plan SSOMA y el IPERC a supervisión antes del inicio.",
          "Entregar EPP, señalizar frentes, instalar botiquín y puntos de emergencia.",
          "Inducción a todo personal. Charlas diarias. Registro de asistencia y accidentes.",
          "Mantener el sistema hasta la liquidación. No se paga si no hay evidencia documental.",
        ],
        normas: normasBase(p, ["Ley N.° 29783 y su reglamento", "DS 011-2019-TR / normativa vigente de construcción civil"]),
      });
    case "andamio":
      return out({
        definicion: `Consiste en el montaje, uso, mantenimiento y desmontaje de «${t}» para habilitar frentes en altura o apuntalar encofrados, según el APU y las normas de andamios. La unidad ${und} refleja el área y el tiempo de permanencia.${datoFrase}`,
        procedimiento: [
          "Revisar terreno de apoyo. Montar módulos a plomo, con diagonales, barandas y rodapié.",
          "Anclar al edificio o lastrar. No cargar más allá de la capacidad del fabricante.",
          "Inspección diaria. Desmontar en orden inverso al término del frente.",
        ],
        normas: normasBase(p, ["NTP de andamios / OSHA referencial", "Plan SSOMA de trabajo en altura"]),
      });
    case "excavacion":
      return out({
        definicion: `Consiste en la excavación de «${t}» hasta las cotas, anchos y taludes de los planos de ${especialidad}, en el material que describe la partida (suelto, conglomerado, cimiento o zapata). Incluye el perfilado del fondo y de los taludes, el control topográfico y el acopio o carga del material. No incluye el relleno ni la eliminación, que se pagan aparte.${datoFrase}`,
        incluye: [
          "Excavación, perfilado, control de cotas y carga a borde de zanja o acopio interno (20 m).",
          "Entibado menor o talud de seguridad si el APU o el estudio de suelos lo exigen para esta partida.",
        ],
        noIncluye: ["Relleno compactado, concreto de limpieza, acero, ni eliminación a botadero.", "Agotamiento de napa, salvo que la descripción lo incorpore."],
        procedimiento: [
          "Replantear ejes y cotas de fondo con nivel. Verificar interferencias de redes.",
          "Excavar con la cuadrilla y el equipo del APU (manual o maquinaria) sin sobre-excavar el fondo de cimentación.",
          "Perfilar taludes. Si aparece napa o suelo distinto al supuesto, detener y notificar a supervisión.",
          "Limpiar el fondo, compactar la cama si el plano lo pide y entregar cotas para solado o concreto.",
        ],
        controlAceptacion: [
          ...controlBase(p),
          "Tolerancia de fondo: ±2 cm respecto de la cota de plano, salvo otra indicación del estudio de suelos.",
          "Se rechaza el fondo remoldeado, saturado o con material suelto no retirado.",
        ],
        normas: normasBase(p, ["RNE E.050 Suelos y cimentaciones", "Estudio de mecánica de suelos del expediente"]),
      });
    case "relleno":
      return out({
        definicion: `Consiste en el relleno y compactación de «${t}» con el material que indica la partida (propio, préstamo o seleccionado), en capas, hasta la cota de plano, con la densidad exigida por el expediente o, en su defecto, ≥95 % de la máxima dens. Proctor modificado en rellenos estructurales de edificación.${datoFrase}`,
        incluye: ["Extendido en tongadas, humedad de compactación, compactación y control de densidad."],
        noIncluye: ["Excavación, eliminación de excedente ni concreto sobre el relleno."],
        procedimiento: [
          "Aprobar el material (granulometría, plasticidad). Humedecer o orear hasta humedad óptima.",
          "Extender en tongadas de 15–20 cm (o la que fije el expediente). Compactar con el equipo del APU.",
          "Ensayo de densidad de campo (cono de arena o nuclear) según frecuencia del expediente.",
          "Perfilar la cota final. No colocar concreto sobre relleno no aceptado.",
        ],
        normas: normasBase(p, ["RNE E.050", "NTP 339.141 / ASTM D698–D1557 (Proctor)", "MTC EG-2013 (si el expediente lo cita)"]),
      });
    case "eliminacion":
      return out({
        definicion: `Consiste en la carga, transporte y disposición de material excedente de «${t}» hasta el botadero autorizado, a la distancia de acarreo de la descripción${x.dist ? ` (${x.dist})` : ""}. Incluye peajes, batea y limpieza de vías de la obra. El volumen se mide en banco (sin esponjamiento de pago).${datoFrase}`,
        procedimiento: [
          "Cargar con el equipo del APU. Cubrir la batea en vía pública.",
          "Transportar al botadero autorizado. No botar en cauces ni predios ajenos.",
          "Registrar viajes si supervisión lo pide. Limpiar el frente de carga.",
        ],
        normas: normasBase(p, ["Ordenanzas municipales de escombros", "Reglamento Nacional de Metrados (volumen en banco)"]),
      });
    case "emparejado":
      return out({
        definicion: `Consiste en el emparejado, corte superficial, perfilado y compactación de la plataforma de «${t}», hasta las cotas y pendientes del plano de movimiento de tierras. Incluye el control topográfico, el riego a humedad óptima y la compactación de la capa superficial. No sustituye a la excavación masiva ni al relleno de zanjas.${datoFrase}`,
        procedimiento: [
          "Replantear cotas de plataforma con topógrafo y nivel. Fijar BM y estacas de control.",
          "Ejecutar corte superficial y empuje con el tractor del APU (p. ej. D8T si está en la receta) sin sobre-excavar.",
          "Perfilar con motoniveladora hasta pendiente y tolerancia del plano (±2 cm en plataforma, salvo otra indicación).",
          "Humedecer con cisterna. Compactar con rodillo del APU en pasadas traslapadas hasta la densidad exigida (≥95 % dens. máx. Mod. o la del expediente).",
          "Verificar cotas finales. No recibir áreas con baches, ondulaciones o humedad fuera de rango.",
        ],
        normas: normasBase(p, ["RNE E.050 / CE.010", "MTC EG-2013 (ensayos de compactación)", "NTP 339.141 / ASTM D698–D1557"]),
      });
    case "talud":
      return out({
        definicion: `Consiste en el desquinche, perfilado y acabado del talud de «${t}», según la inclinación del plano o del estudio de suelos, dejando la superficie estable, sin bloques sueltos ni sobre-excavación del pie.${datoFrase}`,
        procedimiento: [
          "Marcar la línea de talud. Retirar bloques inestables de arriba hacia abajo.",
          "Perfilar con herramienta o equipo liviano. No socavar el pie.",
          "Entregar el talud limpio, con la pendiente de plano, listo para protección si hay partida de revestimiento.",
        ],
        normas: normasBase(p, ["RNE E.050", "Estudio de suelos — sección de taludes"]),
      });
    case "concreto":
      return out({
        definicion: `Consiste en el suministro, dosificación, transporte, vaciado, compactación y curado del concreto de la partida «${t}»${x.fc ? `, ${x.fc}` : ""}${x.e ? `, ${x.e}` : ""}, en el elemento estructural o de concreto simple que describe el catálogo, de acuerdo con los planos de estructuras, el RNE E.060 y el capítulo ${cap}. El acero de refuerzo y el encofrado se pagan en sus partidas, salvo que esta descripción los incorpore.${datoFrase}`,
        incluye: [
          "Cemento, agregados, agua, aditivo si está en el APU, vaciado, vibrado y curado.",
          "Probetas y control de slump de esta partida.",
        ],
        noIncluye: ["Acero fy, encofrado, excavación y relleno, salvo que la descripción los nombre.", "Concreto de otro elemento (no se vacía zapata con la partida de columna)."],
        procedimiento: [
          `Verificar que el fondo, el encofrado y el acero del elemento «${t}» estén aceptados. Humedecer el contacto. No vaciar si hay agua estancada o tierra suelta.`,
          `Dosificar el concreto${x.fc ? ` ${x.fc}` : " de la resistencia de la partida"} con los materiales del APU. Controlar slump y temperatura. Rechazar amasadas fuera de especificación.`,
          "Vaciar por tongadas. Compactar con vibrador de inmersión del APU, sin tocar el acero en exceso ni disgregar el concreto contra el encofrado.",
          "Acabar la superficie según el elemento (rasado en losas, plomo en fustes). Curar ≥7 días (agua, membrana o la del expediente).",
          "Tomar probetas según NTP. No descimbrar ni cargar el elemento antes de la resistencia de plano.",
        ],
        controlAceptacion: [
          ...controlBase(p),
          `Resistencia a 28 días${x.fc ? ` (${x.fc})` : ""} según NTP. Se rechaza el vaciado si el slump, la temperatura o la dosificación salen de especificación.`,
          "Geometría, recubrimiento y cota según plano. Hormigueros, nidos y juntas frías no previstas se pican y reparan a costo del contratista.",
        ],
        normas: normasBase(p, ["RNE E.060 Concreto armado", "NTP 339.186 / NTP 339.034 (probetas)", "ACI 318 (referencial)"]),
      });
    case "acero":
      return out({
        definicion: `Consiste en el suministro, habilitado, figurado, colocación y amarre del acero de refuerzo de «${t}»${x.fy ? `, ${x.fy}` : " fy 4 200 kg/cm²"}, según el despiece de los planos estructurales. Se paga el kilogramo teórico del despiece aceptado. No se sustituye diámetro ni grado.${datoFrase}`,
        incluye: ["Corte, figureo, acarreo interno, colocación, dados de recubrimiento y alambre de amarre del APU."],
        noIncluye: ["Concreto y encofrado del mismo elemento.", "Mallas o aceros de otra partida (zapatas vs. columnas)."],
        procedimiento: [
          "Cuantificar el despiece. Cortar y figurar según diámetros y ganchos del plano. Etiquetar por elemento.",
          `Colocar el acero de «${t}» con el recubrimiento E.060. Amarre en cada cruce o según plano. Dados y separadores.`,
          "No soldar fy 4200 salvo detalle. Empalmes por traslape en la zona y longitud del plano.",
          "Inspección de supervisión antes del vaciado. El acero sucio de tierra o aceite se limpia o se rechaza.",
        ],
        normas: normasBase(p, ["RNE E.060", "NTP 341.031 (barras de acero)", "ASTM A615 (referencial)"]),
      });
    case "encofrado":
      return out({
        definicion: `Consiste en el armado, alineado, apuntalado, desmolde y desencofrado de «${t}», con madera, fenólico o el sistema del APU, para dar al concreto la geometría, el plomo y el acabado de los planos. Incluye desmoldante, puntales y andamio de la receta. El concreto y el acero se pagan aparte.${datoFrase}`,
        procedimiento: [
          `Armar el encofrado de «${t}» a escuadra y plomo, con contraventoe. Verificar cotas y recubrimiento.`,
          "Aplicar desmoldante. Sellar juntas para evitar pérdida de lechada.",
          "Recibir el encofrado con supervisión antes del vaciado. Corregir pandeos.",
          "Descimbrar al plazo del plano o E.060 (no antes). Desclavar sin golpear aristas. Limpiar y reutilizar si el APU lo supone.",
        ],
        normas: normasBase(p, ["RNE E.060 (plazos de descimbrado)", "Buenas prácticas de encofrados de edificación"]),
      });
    case "aligerado":
      return out({
        definicion: `Consiste en el suministro y colocación de «${t}» (ladrillo hueco de techo) sobre el encofrado de losa aligerada, según la dirección de viguetas del plano, dejando las viguetas y la capa de compresión libres de ladrillo. No incluye concreto ni acero.${datoFrase}`,
        procedimiento: [
          "Verificar que el encofrado de losa esté recibido. Humedecer el ladrillo.",
          "Colocar las piezas a tope, alineadas, sin invadir el ancho de vigueta.",
          "Retirar piezas rotas. Entregar la losa lista para acero de temperatura y vaciado.",
        ],
      });
    case "albanileria": {
      const soga = has(d, "soga");
      const cabeza = has(d, "cabeza");
      const pandereta = has(d, "pandereta");
      const solido = has(d, "sólido", "solido");
      const bloque = has(d, "bloque");
      const artesanal = has(d, "artesanal");
      const tipoV = has(d, "tipo v");
      const tipoIv = has(d, "tipo iv");
      const tipoIi = has(d, "tipo ii");
      const espesor = cabeza ? "24 cm (aparejo de cabeza)" : soga && artesanal ? "12 cm (aparejo de soga)" : soga ? "13 cm (aparejo de soga)" : pandereta ? "12 cm" : bloque && has(d, "15×20") ? "15 cm" : bloque && has(d, "12×20") ? "12 cm" : solido ? "espesor del ladrillo sólido asentado" : "el de la unidad y el aparejo de la partida";
      const unidadTxt = pandereta
        ? "ladrillo pandereta Tipo II 24×12×6 cm (NTP 331.017), solo para tabique no portante"
        : solido
          ? "ladrillo sólido Tipo IV 24×14×6.5 cm (NTP 331.017, f'b ≥ 130 kg/cm²)"
          : bloque && has(d, "15×20")
            ? "bloque de concreto 15×20×40 cm, f'c 70 kg/cm² (NTP 339.621)"
            : bloque && has(d, "12×20")
              ? "bloque de concreto 12×20×40 cm, f'c 70 kg/cm² (NTP 339.621)"
              : artesanal
                ? "ladrillo king kong artesanal Tipo IV 23×12×8 cm (f'b ≥ 130 kg/cm²); no sustituir por industrial Tipo V sin recálculo"
                : "ladrillo King Kong 18 huecos Tipo V 24×13×9 cm (NTP 331.017, f'b ≥ 175 kg/cm²)";
      const mortero = solido || bloque ? "1:4" : "1:5";
      const juntas = "1,0 a 1,5 cm (horizontal y vertical), llenas y enrasadas";
      return out({
        definicion: `Consiste en el asentado de «${t}» en albañilería ${pandereta ? "de tabique (no portante)" : "confinada según RNE E.070"}, con ${unidadTxt}. Espesor de muro: ${espesor}. Mortero cemento Portland tipo I : arena gruesa ${mortero}, juntas de ${juntas}. El tarrajeo, el dintel y el concreto de columnas o soleras se pagan en sus partidas.${datoFrase}`,
        incluye: [
          `${unidadTxt}. Desperdicio del APU (no se mide aparte).`,
          `Mortero ${mortero} (cemento Portland tipo I, arena gruesa y agua) y andamio menor.`,
          pandereta ? "Amarre con alambre N° 16 en encuentros." : "Mechas de acero Ø 6 mm fy 4 200 y alambre N° 16 de amarre a columnas de confinamiento, según E.070 y el APU.",
        ],
        noIncluye: [
          "Tarrajeo, pintura, dintel, alféizar y vanos (el vano se descuenta según el Reglamento Nacional de Metrados).",
          "Concreto de confinamiento (columnas, vigas soleras y dados).",
          pandereta ? "Uso como muro portante: esta unidad no se acepta en muros estructurales." : "Ladrillo de clase inferior a la partida (p. ej. Tipo III en un muro especificado Tipo V).",
        ],
        procedimiento: [
          `Humedecer la base (sobrecimiento o losa) y las unidades 1–2 h antes del asentado. Trazar ejes, paños y espesor ${espesor}.`,
          `Preparar mortero ${mortero} con cemento Portland tipo I y arena gruesa. Asentar «${t}» con el aparejo de la partida, trabazón en encuentros y juntas de ${juntas}. No asentar unidades fracturadas ni con eflorescencia.`,
          "Verificar plomo y nivel cada 3–4 hiladas. En muros confinados, colocar mechas Ø 6 mm a columnas cada 2 hiladas o según el detalle E.070.",
          "Dejar esperas en vanos para dinteles (apoyo mín. 15 cm por jamba, salvo plano). Limpiar rebabas. Curar 3 días. No cargar el muro ni tarrajear antes de 24 h.",
        ],
        controlAceptacion: [
          ...controlBase(p),
          `Unidad: ${unidadTxt}. Se rechaza lote sin sello de planta o con f'b menor al de la clase.`,
          "Plomo ≤ 5 mm en 2,50 m. Hiladas horizontales. Juntas > 2 cm, mortero empobrecido o unidades fisuradas: rechazo del paño.",
        ],
        normas: normasBase(p, [
          "RNE E.070 Albañilería",
          tipoV || tipoIv || tipoIi ? "NTP 331.017 (ladrillos de arcilla cocida: clases I a V)" : "NTP 331.017 / NTP 331.018",
          bloque ? "NTP 339.621 (bloques de concreto)" : "NTP 331.018 (métodos de ensayo de ladrillos)",
          "Reglamento Nacional de Metrados — muros y tabiques",
        ]),
      });
    }
    case "drywall":
      return out({
        definicion: `Consiste en el suministro y armado de «${t}», tabique de placas de yeso-cartón 1.20×2.40 m${has(d, "rf") || has(d, "tipo x") ? " tipo X (RF, resistente al fuego)" : has(d, "rh") || has(d, "verde") ? " RH (resistentes a humedad, cara verde)" : " estándar 12.5 mm (ASTM C1396)"}, sobre parantes C 89×35×0.45 mm y rieles U 92×25×0.45 mm galvanizados, a 0,40 o 0,60 m. Incluye tornillos, cinta de junta, masilla, esquinero y lijado. Pintura y piso se pagan aparte.${datoFrase}`,
        incluye: [
          "Placas de ambas caras (2.20 m² de placa por m² de tabique, con desperdicio del APU).",
          "Parante C 89 mm, riel U 92 mm, tornillo 6×1\", cinta 50 mm, masilla y esquinero del APU.",
        ],
        noIncluye: ["Pintura, zócalo, aislamiento acústico (salvo que el APU lo nombre) y estructura de cielo raso."],
        procedimiento: [
          "Replantear el tabique. Fijar riel U al piso y al techo cada 0,60 m. Aplomar.",
          "Montar parantes C a 0,40 m (RF/RH o si hay cerámica) o 0,60 m. Pasar instalaciones antes de cerrar la segunda cara.",
          `Colocar la placa de «${t}» en traba, tornillos al tercio (≈ 30 cm) a no menos de 10 mm del borde. No juntar cuatro esquinas en un punto.`,
          "Cinta, masilla en tres manos, esquinero y lijado. Entregar listo para pintura, sin ondulaciones ni tornillos saltados.",
        ],
        normas: normasBase(p, ["RNE A.010", "ASTM C1396 / ficha del fabricante de la placa", "Recomendaciones AIS / Gyplac o equivalente"]),
      });
    case "dintel":
      return out({
        definicion: `Consiste en el concreto armado del «${t}» sobre vanos de albañilería, con la sección de la descripción${x.dim ? ` (${x.dim})` : ""}, incluyendo acero, encofrado, vaciado y curado de este elemento.${datoFrase}`,
        procedimiento: [
          "Encofrar el dintel con el apoyo mínimo sobre jambas que indique el plano (no menor de 15 cm por lado, salvo detalle).",
          "Colocar el acero de la partida. Vaciar concreto, compactar y curar.",
          "Descimbrar al plazo. No cargar el vano (puerta/ventana) antes de tiempo.",
        ],
        normas: normasBase(p, ["RNE E.060", "RNE E.070"]),
      });
    case "tarrajeo":
      return out({
        definicion: `Consiste en el revoque o enlucido de «${t}»${x.e ? `, ${x.e}` : ""}, con mortero de la receta, sobre muros, columnas o vigas ya asentados o vaciados, dejando la superficie aplomada, plana y lista para pintura o revestimiento. No cubre mayólica ni pintura.${datoFrase}`,
        procedimiento: [
          "Humedecer el soporte. Picar concreto liso. Colocar cintas o maestras a plomo.",
          `Aplicar el mortero de «${t}» en el espesor de la partida. Reglear. Repasar cantos y encuentros.`,
          "Curar 3 días. Entregar sin fisuras de retracción generalizadas ni ondulaciones mayores a 3 mm con regla de 2 m.",
        ],
        normas: normasBase(p, ["RNE A.010", "Reglamento Nacional de Metrados — revoques"]),
      });
    case "cielorraso":
      return out({
        definicion: `Consiste en el suministro e instalación de «${t}»${x.e || x.dim ? ` (${[x.e, x.dim].filter(Boolean).join(", ")})` : ""}, con la placa, yeso o bandeja de la descripción, incluyendo estructura de cuelgue, nivelación y recortes de luminarias si el plano los ubica. Pintura se paga aparte salvo que la partida la nombre.${datoFrase}`,
        procedimiento: [
          "Replantear nivel de cielo. Fijar cuelgues o perfiles al forjado.",
          "Colocar placas o aplicar yeso según la partida. Nivelar. Recortar penetraciones.",
          "Masillar juntas. Entregar plano, sin desniveles visibles, listo para pintura o luminarias.",
        ],
      });
    case "piso":
      return out({
        definicion: `Consiste en el suministro y colocación de «${t}»${x.e ? `, ${x.e}` : ""}${x.dim ? `, formato ${x.dim}` : ""}, sobre el contrapiso o la losa ya aceptados, con la pendiente hacia sumideros que indiquen los planos. Incluye pegamento o mortero, corte, nivelación, junta y fraguado del APU. Zócalo y pintura de pared se pagan aparte.${datoFrase}`,
        incluye: ["Capa de pega, piezas, cortes, junta, fragua o pulido según el tipo de piso, y limpieza final."],
        noIncluye: ["Contrapiso o falso piso, zócalo, impermeabilización de azotea y umbrales, salvo que esta partida los nombre."],
        procedimiento: [
          "Verificar que el soporte esté limpio, curado y con la pendiente de plano. Humedecer si es mortero.",
          `Trazar ejes. Colocar «${t}» con la pega del APU, alineado, sin cejas. Respetar junta de 1–3 mm en cerámicos/porcelanato.`,
          "Cortar piezas en perímetro y alrededor de aparatos. No usar recortes irregulares en paños vistos.",
          "Fraguar, limpiar, proteger el piso hasta la entrega. En cemento pulido, llaleado y curado; en parquet, lijado y barniz del APU.",
        ],
        controlAceptacion: [
          ...controlBase(p),
          "Cejas ≤ 1 mm. Pendiente hacia desagüe. Piezas fisuradas o de tono distinto al lote se rechazan.",
        ],
        normas: normasBase(p, ["RNE A.010", "NTP de cerámicos / porcelanato aplicables", "Reglamento Nacional de Metrados — pisos"]),
      });
    case "zocalo":
      return out({
        definicion: `Consiste en el suministro y colocación de «${t}»${x.h ? `, ${x.h}` : ""}, al pie de muros, con la pieza, madera o cerámico de la descripción, alineado y sellado. Se mide en metros lineales de desarrollo, descontando vanos.${datoFrase}`,
        procedimiento: [
          "Verificar piso terminado. Trazar altura constante.",
          "Cortar y colocar el zócalo con pega o clavo del APU. Empalmes a 45° en esquinas vistas.",
          "Sellar junta piso-zócalo. Limpiar. Entregar continuo y a nivel.",
        ],
      });
    case "revestimiento":
      return out({
        definicion: `Consiste en el revestimiento de paramentos de «${t}», con el material de la descripción (mayólica, piedra u otro), sobre muro tarrajeado o preparado, incluyendo pega, junta y recortes.${datoFrase}`,
        procedimiento: [
          "Preparar el soporte aplomado. Trazar hiladas.",
          "Colocar el revestimiento con la pega del APU. Nivelar. Cortar encuentros.",
          "Fraguar, limpiar y entregar sin cejas ni piezas saltadas.",
        ],
      });
    case "impermeabilizacion":
      return out({
        definicion: `Consiste en la impermeabilización de «${t}»${x.e ? `, ${x.e}` : ""}, sobre la losa o el sustrato ya pendienteado, con el manto, membrana o sistema de la descripción. Incluye imprimación, traslapes, remates en encuentros y prueba de estanqueidad. El contrapiso de protección se paga aparte si existe como partida.${datoFrase}`,
        procedimiento: [
          "Limpiar y secar el sustrato. Corregir cantos y media caña en encuentros.",
          "Aplicar imprimante. Colocar el manto o la membrana con el traslape del fabricante (mín. 10 cm).",
          "Rematar desagües, antepechos y juntas. No perforar el sistema después de colocado.",
          "Prueba de agua 24–48 h. Reparar fisuras. Entregar acta de estanqueidad.",
        ],
        normas: normasBase(p, ["RNE A.010 / IS.010", "Ficha técnica del manto o membrana"]),
      });
    case "pintura":
      return out({
        definicion: `Consiste en la preparación de superficie y el pintado de «${t}», con el tipo de pintura, el número de manos y el acabado de la descripción. Incluye lijado, masilla de corrección menor, protección de pisos y limpieza. No cubre tarrajeo nuevo.${datoFrase}`,
        procedimiento: [
          "Proteger pisos y carpintería. Lijar, despintar zonas flojas, masillar fisuras capilares.",
          "Imprimar si el APU lo contempla. Aplicar las manos de «${t}» con rodillo o brocha, respetando tiempo de secado.",
          "Repasar cantos. Entregar sin chorreaduras, sin diferencias de tono y con aristas vivas cubiertas.",
        ],
        normas: normasBase(p, ["RNE A.010", "NTP de pinturas aplicables"]),
      });
    case "carpinteria":
      return out({
        definicion: `Consiste en el suministro, habilitación e instalación de «${t}»${x.dim ? `, dimensiones ${x.dim}` : ""}, con madera, melamina o el material de la descripción, incluyendo marco, hoja, herrajes del APU, plomo, holguras y ajuste de cierre. Vidrio y cerrajería especial se pagan aparte si son otra partida.${datoFrase}`,
        procedimiento: [
          "Verificar vano (plomo, nivel, diagonales). No forzar un marco en vano fuera de escuadra sin corrección previa.",
          `Instalar «${t}» con tacos o espuma, aplomar, acuñar y fijar. Colocar herrajes.`,
          "Ajustar holguras, cierre y pestillo. Proteger hasta la entrega. Retocar cantos.",
        ],
        normas: normasBase(p, ["RNE A.010 / A.130 (si es puerta cortafuego)", "NTP de puertas y herrajes"]),
      });
    case "metal":
      return out({
        definicion: `Consiste en el suministro, fabricación e instalación de «${t}»${x.dim ? `, ${x.dim}` : ""}, en aluminio, acero u otro metal de la descripción, con vidrio, soldadura o anclajes del APU. Incluye plomo, sellado perimetral y herrajes.${datoFrase}`,
        procedimiento: [
          "Medir el vano real. Fabricar o ajustar el elemento. Protección anticorrosiva si es acero.",
          "Anclar al vano. Aplomar. Colocar vidrio con junquillo o silicona estructural según la partida.",
          "Sellar perímetro. Verificar apertura, cierre y estanqueidad al agua de lluvia en ventanas.",
        ],
        normas: normasBase(p, ["RNE E.090 (si es estructural)", "RNE A.010", "NTP de aluminio y vidrio"]),
      });
    case "cubierta": {
      const perfil = /tr-?5/i.test(t) ? "TR-5" : /tr-?4/i.test(t) ? "TR-4" : /teja/i.test(t) ? "teja" : /fibro/i.test(t) ? "fibrocemento" : /cumbrera/i.test(t) ? "cumbrera" : /limahoya|limatesa/i.test(t) ? "limahoya" : "plancha";
      const tornillo = has(d, "autoperforante", "tornillo") || /tr-?[45]/i.test(t) || perfil === "cumbrera" || perfil === "limahoya";
      const prelacado = has(d, "prelac", "pre pint", "prepint");
      const espesor = x.e || (t.match(/e\s*=\s*[\d.,]+\s*mm/i)?.[0] ?? "");
      const fichaPerfil =
        perfil === "TR-4"
          ? "Perfil trapezoidal TR-4 (4 ondas): ancho útil típico 0,85–1,00 m y altura de onda según ficha (~35–40 mm). No se sustituye por TR-5."
          : perfil === "TR-5"
            ? "Perfil trapezoidal TR-5 (5 ondas): mayor inercia que TR-4; el vano entre correas es el de la ficha del espesor contratado. No se sustituye por TR-4."
            : perfil === "teja"
              ? "Teja andina o la de la descripción, con amarre y mortero de caballete según APU."
              : perfil === "fibrocemento"
                ? "Plancha de fibrocemento del espesor de catálogo, con solape de ficha."
                : "Plancha o accesorio de cubierta del perfil de esta partida.";
      return out({
        definicion: `Consiste en el suministro e instalación de «${t}» sobre tijerales o correas ya aceptados. ${fichaPerfil}${espesor ? ` Espesor de plancha: ${espesor}.` : ""} Recubrimiento ${prelacado ? "galvanizado + prelacado (no se admite solo zinc si la partida pide color de fábrica)" : "galvanizado (zinc); no se admite plancha negra ni espesor menor"}. Incluye recortes, solape de fábrica, fijaciones${tornillo ? " con tornillo autoperforante y arandela de neopreno" : ""} y sellado de perforaciones. Cumbrera, limahoya, canaleta y bajante se pagan en su código si no están en esta descripción.${datoFrase}`,
        incluye: [
          "Plancha, teja o accesorio del perfil y espesor de catálogo, con desperdicio del APU (traslape lateral y de cabecera).",
          tornillo
            ? "Tornillo autoperforante con arandela de neopreno, en la cresta de la onda, sin ovalar la perforación. Densidad según APU (6–9 und/m² en faldón; 4–6 und/m en cumbrera)."
            : "Fijaciones del APU (clavo, gancho o tornillo según la receta).",
          "Recortes en limahoyas, limatesas, vanos y aleros. Retiro de viruta galvanizada para no oxidar el zinc.",
        ],
        noIncluye: [
          "Estructura de tijerales, correas, cumbrera, canaleta y bajante, salvo que esta partida los nombre.",
          "Cielo raso, aislamiento térmico, pintura de estructura y red de tierra de cubierta, si son otro código.",
        ],
        procedimiento: [
          "Verificar pendiente mínima: calaminón galvanizado ≥ 15 % (o la del plano / ficha). Tijerales a plomo, correas alineadas y con el espaciamiento de la ficha del espesor. No montar sobre madera verde ni sobre nudo en el apoyo.",
          perfil.startsWith("TR")
            ? `Trazar hiladas de agua. Colocar el calaminón ${perfil} a favor del viento dominante. Solape lateral ≥ 1 onda completa; solape de cabecera ≥ 150 mm (o el de ficha si es mayor). El zinc o el prelacado queda hacia el exterior. No pisar el valle.`
            : perfil === "cumbrera" || perfil === "limahoya"
              ? `Colocar el accesorio «${t}» centrado en el encuentro, con solape ≥ 150 mm entre tramos y sello en el solape. Fijar a las dos aguas.`
              : "Trazar hiladas. Colocar planchas o tejas con el solape del fabricante. No caminar sobre el valle de la onda.",
          tornillo
            ? "Fijar en la cresta (nunca en el valle) con tornillo autoperforante y arandela de neopreno. Apretar hasta sellar, sin aplastar la onda ni cortar la arandela. En alero y cumbrera densificar según ficha de viento."
            : "Fijar según el APU. No ovalar perforaciones.",
          "Rematar aleros y encuentros con muros. Prueba de estanqueidad (manguera o primera lluvia). Entregar sin viruta, sin plancha abollada y con el color de fábrica si es prelacado.",
        ],
        metrado:
          und === "m"
            ? "Se mide la longitud neta de cumbrera, limahoya, limatesa o canaleta ejecutada, en metros. Recortes y solapes van en el P.U."
            : "Se mide el área de cubierta en desarrollo de faldón según plano, en m². Traslapes y desperdicio van en el P.U.; no se paga el área de solape dos veces.",
        controlAceptacion: [
          `El perfil y el espesor coinciden con «${t}». No se acepta plancha abollada, con óxido de transporte, espesor menor ni cambio TR-4 ↔ TR-5.`,
          "Fijaciones en cresta, arandela comprimida sin cortar. No hay gotera en solapes ni en tornillos.",
          "Pendiente, alineación de hiladas y sentido del solape según plano y viento. Viruta galvanizada retirada.",
        ],
        normas: normasBase(p, [
          "RNE A.010 (cubiertas y pendiente)",
          "Ficha del fabricante TR-4 / TR-5 (solape, vano de correa y carga de viento)",
          "NTP 341.031 / ASTM A653 (plancha de acero galvanizado, recubrimiento referencial G60–G90)",
        ]),
      });
    }
    case "jardineria":
      return out({
        definicion: `Consiste en la ejecución de «${t}» de jardinería o áreas verdes: tierra vegetal, césped, plantación u otro de esta descripción, según el plano de arquitectura paisajista. El espesor de tierra y la especie no se sustituyen.${datoFrase}`,
        procedimiento: [
          "Verificar que el relleno estructural esté aceptado. No colocar tierra vegetal sobre escombro.",
          `Ejecutar «${t}» con el espesor o la unidad de la partida. Riego de asiento.`,
          "Entregar cubierto, alineado y con tutor si es árbol. Reponer fallas de prendimiento en el plazo del expediente.",
        ],
        normas: normasBase(p, ["RNE A.010 / CE.010 (áreas verdes)", "Expediente de paisajismo"]),
      });
    case "sanitario_punto":
      return out({
        definicion: `Consiste en la ejecución de «${t}»${x.diam ? `, ${x.diam}` : ""}, desde la red o el ramal hasta la salida en el ambiente, incluyendo tubería, accesorios, empotrado o aparente según plano, prueba y taponado hasta la colocación del aparato. Cada punto se cuenta completo según el Reglamento de Metrados de instalaciones sanitarias.${datoFrase}`,
        incluye: ["Tubería y accesorios del APU, ganchos, prueba hidrostática del tramo y señalización de la salida."],
        noIncluye: ["Aparato sanitario, grifería y ramales de otra especialidad (agua contra incendio, gases)."],
        procedimiento: [
          "Replantear la salida según plano de sanitarias (altura de grifo, inodoro, desagüe).",
          `Tender «${t}» con pendiente en desagües (mín. 1 % en horizontales, salvo plano) y sin codo de 90° innecesario.`,
          "Unir con pegamento, termo-fusión o rosca según material. Empotrar o fijar. Tapar la boca.",
          "Prueba hidrostática del circuito. Reparar fugas. Entregar el punto listo para el aparato.",
        ],
        normas: normasBase(p, ["RNE IS.010", "NTP ISO 4422 / NTP de PVC-SAP / CPVC", "Reglamento Nacional de Metrados — instalaciones sanitarias"]),
      });
    case "sanitario_aparato":
      return out({
        definicion: `Consiste en el suministro, colocación, conexión y entrega operativa de «${t}», sobre el punto sanitario ya ejecutado, incluyendo empaque, flexibles, sifón y grifería que la descripción incorpore. Se prueba la estanqueidad y el desagüe antes de la recepción.${datoFrase}`,
        procedimiento: [
          "Verificar que el punto (agua y desagüe) esté probado y a la altura de plano.",
          `Colocar «${t}» a nivel, fijar, conectar flexibles y desagüe. Siliconar encuentro con piso o muro.`,
          "Probar llenado, descarga y grifería. Entregar sin fugas, con tapa y herrajes completos.",
        ],
        normas: normasBase(p, ["RNE IS.010", "RNE A.120 (si es accesibilidad)", "Ficha técnica del aparato"]),
      });
    case "sanitario_red":
      return out({
        definicion: `Consiste en el suministro e instalación de «${t}»${x.diam ? `, ${x.diam}` : ""} como red, ramal, cámara o accesorio de las instalaciones sanitarias, según la planta y el perfil hidráulico. Incluye excavación de zanja menor si el APU la contempla, cama de apoyo, unión, relleno localizado y prueba.${datoFrase}`,
        procedimiento: [
          "Replantear trazo y pendiente. Excavar zanja si corresponde. Colocar cama de arena.",
          `Instalar «${t}» con uniones del sistema. Verificar pendiente y alineamiento.`,
          "Prueba hidrostática o de humo según el fluido. Rellenar sin golpear el tubo.",
          "Registrar cajas, cámaras y tapas al nivel de piso terminado.",
        ],
        normas: normasBase(p, ["RNE IS.010", "OS.070 / OS.090 (si es red pública)", "NTP ISO 4427 / NTP 399.162"]),
      });
    case "electrico_punto":
      return out({
        definicion: `Consiste en la ejecución de «${t}» como salida eléctrica completa según el cuadro de cargas y el plano de instalaciones eléctricas: caja, tramo de canalización de acometida de la partida, conductor de la partida y dispositivo si la descripción lo incluye. El cuadro de cargas prevalece sobre el conteo visual de símbolos.${datoFrase}`,
        procedimiento: [
          "Replantear la caja a la altura de norma o plano (tomacorriente, interruptor, salida de lumínica).",
          "Empotrar o fijar caja. Conectar el tramo de canalización y el conductor de esta partida.",
          "Identificar fase, neutro y tierra. Dejar largo de espera. Tapar hasta el aparato.",
          "Continuidad y polaridad. No energizar hasta el megado del circuito.",
        ],
        normas: normasBase(p, ["CNE Utilización", "RNE EM.010", "Reglamento Nacional de Metrados — instalaciones eléctricas"]),
      });
    case "tablero":
      return out({
        definicion: `Consiste en el suministro, montaje, conexionado y rotulado de «${t}», con la envolvente, barras, interruptores y bornes de la descripción y del unifilar. Incluye anclaje, tierra de protección y protocolo de operación mecánica. El cableado de circuitos se paga en sus partidas de conductor.${datoFrase}`,
        procedimiento: [
          "Anclar el gabinete a plomo. Verificar IP y sentido de barras.",
          "Instalar interruptores según unifilar. Torque de bornes. Rotular circuitos.",
          "Conectar alimentador y PE. Prueba de aislamiento y operación de protecciones.",
          "Entregar diagrama as-built en la puerta interior y protocolo.",
        ],
        normas: normasBase(p, ["CNE Utilización", "RNE EM.010", "IEC 61439 (tableros)"]),
      });
    case "conductor":
      return out({
        definicion: `Consiste en el tendido, identificado, conexionado y prueba de «${t}»${x.diam ? `, ${x.diam}` : ""}, en la canalización ya instalada, según el unifilar (sección, número de hilos y circuito). Los recortes y el desperdicio van en el P.U.; se mide la longitud efectiva tendida.${datoFrase}`,
        procedimiento: [
          "Verificar que la canalización esté soplada y con guía. No exceder ocupación del CNE.",
          `Tender «${t}» sin forzar radios menores a norma. Identificar L1-L2-L3-N-PE en ambos extremos.`,
          "Terminales a presión o estañado según calibre. Torque en tablero.",
          "Megado y continuidad. No energizar si el aislamiento es menor al exigido por el CNE.",
        ],
        normas: normasBase(p, ["CNE Utilización 2011", "RNE EM.010", "NTP 370.002 / IEC 60364"]),
      });
    case "canalizacion":
      return out({
        definicion: `Consiste en el suministro e instalación de «${t}»${x.diam ? `, ${x.diam}` : ""}, empotrado, aparente o en bandeja según plano, incluyendo curvas, uniones, cajas de paso de la receta y fijaciones. No se reduce el diámetro ni el ancho respecto del plano.${datoFrase}`,
        procedimiento: [
          "Replantear el trazo. Cortar a escuadra, desbarbar y unir con accesorio del mismo Ø o ancho.",
          "Empotrar o fijar con abrazadera cada 1,50 m como máximo (o la del CNE). Prensaestopa en tablero.",
          "Soplar y pasar guía. Tapar boquillas hasta el cableado.",
        ],
        normas: normasBase(p, ["CNE Utilización", "RNE EM.010"]),
      });
    case "luminaria":
      return out({
        definicion: `Consiste en el suministro, montaje, conexionado y entrega encendida de «${t}», en el punto de iluminación ya ejecutado, con el tipo, potencia e IP de la descripción. Incluye tornillería del fabricante y conexión fase-neutro-tierra.${datoFrase}`,
        procedimiento: [
          "Verificar caja, polaridad y continuidad antes de abrir el embalaje.",
          `Fijar «${t}» al techo, cielo o ménsula. En intemperie usar prensaestopa e IP de la partida.`,
          "Conectar. Nivelar. Encender. Registrar lux si el expediente lo pide.",
        ],
        normas: normasBase(p, ["CNE Utilización", "RNE EM.010 / EM.080", "Ficha IES del fabricante"]),
      });
    case "tierra":
      return out({
        definicion: `Consiste en la ejecución de «${t}» como sistema de puesta a tierra: electrodo, conductor de bajada, registro, conector y medición de resistencia. El valor objetivo es el del expediente o, en su defecto, el del CNE para el tipo de instalación.${datoFrase}`,
        procedimiento: [
          "Excavar o hincar el electrodo. Humectar y mejorar terreno si el APU contempla bentonita o similar.",
          "Conectar conductor de Cu desnudo con soldadura exotérmica o conector homologado. Registro visitables.",
          "Medir resistencia con telurómetro. Completar malla o electrodos si no se alcanza el valor de plano.",
        ],
        normas: normasBase(p, ["CNE Utilización", "IEEE 80 (referencial en mallas)", "RNE EM.010"]),
      });
    case "comunicaciones":
      return out({
        definicion: `Consiste en el suministro, tendido, terminación, etiquetado y certificación de «${t}», según el plano de comunicaciones y las normas TIA/ISO aplicables. Incluye conectores, patch o fusión de la receta. El rack y el activo se pagan en sus partidas si están separados.${datoFrase}`,
        procedimiento: [
          "Replantear ruta o unidad de rack. Respetar radio de curvatura de UTP/fibra.",
          `Tender y terminar «${t}» (punch-down, crimpado o fusión). Etiquetar ambos extremos.`,
          "Certificar enlace (Fluke Cat 6/6A u OTDR). Registrar mapa y pérdida.",
          "Entregar certificación y as-built del cuarto de comunicaciones.",
        ],
        normas: normasBase(p, ["ANSI/TIA-568 / ISO-IEC 11801", "NFPA 72 (si es detección)", "RNE EM.010"]),
      });
    case "incendio":
      return out({
        definicion: `Consiste en el suministro e instalación de «${t}» del sistema contra incendio, según el plano A.130 / NFPA aplicable, incluyendo soportes, uniones, señalización y prueba del componente. No se desplaza un rociador o un hidrante fuera de la tolerancia normativa sin supervisión.${datoFrase}`,
        procedimiento: [
          "Replantear según plano de incendio. Verificar cobertura y altura.",
          `Instalar «${t}» con la tubería, cable o soporte del APU. Soportes sísmicos si el expediente los pide.`,
          "Flush, prueba hidrostática o de lazo según el sistema (tubería 200 psi / 2 h o la del expediente; lazo abierto/corto en detección).",
          "Señalizar. Entregar protocolo y capacitación al personal de obra.",
        ],
        normas: normasBase(p, ["RNE A.130", "NFPA 13 / 14 / 20 / 72 según el ítem", "CNE Utilización (bombas y tableros)"]),
      });
    case "hvac":
      return out({
        definicion: `Consiste en el suministro, montaje, conexionado y puesta en marcha de «${t}» de las instalaciones mecánicas o de climatización, según planos de mecánica, caudal o capacidad de la descripción. Incluye anclajes antivibratorios y aislamiento de la receta.${datoFrase}`,
        procedimiento: [
          "Verificar dados, desagüe de condensado y alimentador eléctrico.",
          `Montar «${t}». Conectar ductos o tuberías. Vacío y carga de refrigerante si aplica.`,
          "Prueba de caudal, temperatura y estanqueidad. Entregar protocolo y garantía.",
        ],
        normas: normasBase(p, ["RNE EM.030 / EM.010", "ASHRAE (referencial)", "Ficha del fabricante"]),
      });
    case "pavimento":
      return out({
        definicion: `Consiste en la ejecución de «${t}» como pavimento, vereda, sardinel o capa de la sección vial urbana, según el expediente y las EG-2013 / CE.010. Incluye perfilado, compactación o vaciado, juntas y curado que la partida contemple.${datoFrase}`,
        procedimiento: [
          "Replantear rasante y bordes. Verificar densidad de la capa inferior aceptada.",
          `Ejecutar «${t}» con el material y el espesor de la descripción. Compactar o vaciar según el tipo.`,
          "Cortar juntas en rígido. Curar. No abrir al tráfico antes del plazo del expediente.",
        ],
        normas: normasBase(p, ["MTC EG-2013", "RNE CE.010", "Reglamento Nacional de Metrados — habilitaciones"]),
      });
    case "deportiva":
      return cuerpoDeportiva(p, t, d, und, datoFrase, comunNo, out, normasBase);
    case "saneamiento":
      return out({
        definicion: `Consiste en la ejecución de «${t}» de saneamiento urbano (agua, alcantarillado, buzón, conexión domiciliaria u otro del catálogo SAN), según planta, perfil y especificaciones OS/IS. Incluye zanja, cama, tubería o estructura, prueba y relleno de la receta.${datoFrase}`,
        procedimiento: [
          "Replantear eje y pendiente. Entibar si la profundidad lo exige.",
          `Instalar «${t}» sobre cama aprobada. Uniones según material (HDPE, PVC, concreto).`,
          "Prueba de presión o de infiltración. Relleno compactado en tongadas a los costados del tubo.",
          "Tapa de buzón al nivel de rasante. As-built de cota de tapa e invert.",
        ],
        normas: normasBase(p, ["RNE IS.010", "OS.070 / OS.090", "NTP ISO 4427", "Guía UBS MVCS (si aplica)"]),
      });
    case "carretera":
      return out({
        definicion: `Consiste en la ejecución de «${t}» de carretera, según el Manual de carreteras MTC, las EG-2013 y la sección típica del expediente. El metrado sigue el eje o la sección tipificada; no se paga esponjamiento ni desperdicio aparte.${datoFrase}`,
        procedimiento: [
          "Replantear eje, subrasante y taludes. Control topográfico de la jornada.",
          `Ejecutar «${t}» con el equipo y el material del APU. Respetar espesores y grados de compactación EG-2013.`,
          "Ensayos de frecuencia del expediente. Corregir zonas rechazadas antes de la capa siguiente.",
        ],
        normas: normasBase(p, ["MTC EG-2013", "MTC Manual de carreteras", "RNE (si hay obras de arte menores)"]),
      });
    case "puente":
      return out({
        definicion: `Consiste en la ejecución de «${t}» de la especialidad puentes, según el plano de puente, el Manual de puentes MTC y las EG-2013. El acero, el concreto, los apoyos o la superestructura se ciñen a esta descripción; no se mezclan elementos de otro vano o de otra partida.${datoFrase}`,
        procedimiento: [
          "Replantear ejes de estribos, pilas o superestructura. Control topográfico diario.",
          `Ejecutar «${t}» por etapas (excavación, armado, vaciado, montaje o tensado según el ítem).`,
          "Respetar curado, descimbrado y secuencia de lanzamiento o izaje del plano.",
          "Prueba de carga si el expediente MTC la exige. Entregar as-built y protocolos.",
        ],
        normas: normasBase(p, ["MTC Manual de puentes", "MTC EG-2013", "AASHTO LRFD (referencial)", "RNE E.060 / E.090"]),
      });
    case "hidraulica":
      return out({
        definicion: `Consiste en la ejecución de «${t}» de obra hidráulica (canal, toma, desarenador, sifón u otro del catálogo HID), según la sección hidráulica, la pendiente y las cotas del expediente.${datoFrase}`,
        procedimiento: [
          "Replantear eje hidráulico y plantilla. Verificar BM de riego o de cauce.",
          `Construir «${t}» con el revestimiento o el concreto de la partida. Juntas y sellos según plano.`,
          "Prueba de estanqueidad en tramos revestidos. Entregar pendiente y sección.",
        ],
        normas: normasBase(p, ["Criterios ANA / autoridad de aguas", "USBR / criterios de canales (referencial)", "RNE IS.010 si hay conducción a presión"]),
      });
    case "habilitacion":
      return out({
        definicion: `Consiste en la ejecución de «${t}» de habilitación urbana (pista, vereda, sardinel, agua, desagüe, electrificación o áreas verdes según el catálogo), de acuerdo con CE.010 y el plano de lotización.${datoFrase}`,
        procedimiento: [
          "Replantear alineamientos de lotización y rasantes.",
          `Ejecutar «${t}» con la sección y los materiales de la partida.`,
          "Coordinar interferencias entre especialidades. Entregar cotas de tapa y bordes de sardinel.",
        ],
        normas: normasBase(p, ["RNE CE.010", "EG-2013", "IS.010 / EM.010 según el ítem"]),
      });
    case "electromecanica":
      return out({
        definicion: `Consiste en el suministro, montaje, conexionado, pruebas y entrega operativa de «${t}» de la planta electromecánica (subestación, transformación, MCC, ATS, grupo, canalización de potencia u otro del catálogo IEM), según unifilar, plano de planta y ficha del fabricante. No se reduce kVA, amperaje, sección ni tensión.${datoFrase}`,
        incluye: ["Equipo o conductor de la receta, anclaje, terminales, rotulado y protocolo de la partida."],
        noIncluye: ["Obra civil de caseta, dado o fosa si está en otro código; tableros de otra tensión; capacitación global si es EQ-00."],
        procedimiento: [
          "Verificar dado, izaje, distancias de seguridad CNE y tierra de protección antes de descargar el equipo.",
          `Montar «${t}» según ficha. Torque de bornes. Identificar fases y PE.`,
          "Ensayos de la partida (aislamiento, hipot, transferencia, arranque en vacío). Entregar protocolo y as-built del unifilar.",
        ],
        normas: normasBase(p, ["CNE Suministro / Utilización", "RNE EM.010", "IEC 60076 / IEC 61439 / IEC 60947 según el ítem"]),
      });
    case "equipamiento":
      return out({
        definicion: `Consiste en el suministro, traslado interno, instalación, anclaje, conexión y entrega operativa de «${t}», en el ambiente de la UPSS o local indicado, de acuerdo con la ficha técnica, el listado AE MINSA-DIEM / SIGA si aplica, y el capítulo ${cap}. No se sustituye modelo, capacidad ni código. La obra civil de soporte (punto eléctrico, gases, desagüe) debe estar liberada.${datoFrase}`,
        incluye: ["Embalaje hasta el ambiente, anclaje, conexión de lo que la ficha indica, prueba en vacío y acta de recepción."],
        noIncluye: ["Obra civil, tableros generales, capacitación global EQ-00 y patrimonio si están en otras partidas."],
        procedimiento: [
          "Verificar que el ambiente esté liberado (punto eléctrico, gases, desagüe, clima, anclaje).",
          "Recepcionar contra packing list y garantía. Rechazar golpe o accesorio faltante.",
          `Instalar «${t}». Anclaje sísmico si el expediente lo pide. Conectar solo lo de la ficha.`,
          "Protocolo de aceptación, manuales y código patrimonial. Capacitación si está en esta partida o en EQ-00.",
        ],
        normas: normasBase(p, ["NTS N.° 021-MINSA/DGSP-V.03", "NTS N.° 110/113/119-MINSA", "Listado AE MINSA-DIEM / OPMI", "IEC 60601 (si es electromédico)"]),
      });
    case "prueba":
      return out({
        definicion: `Consiste en la ejecución del ensayo o protocolo «${t}», con instrumento calibrado, sobre el sistema ya instalado, registrando valores contra la norma o el expediente. Sin protocolo firmado no hay valorización de esta partida.${datoFrase}`,
        procedimiento: [
          "Aislar el circuito o el tramo. Verificar ausencia de tensión o de presión según el ensayo.",
          `Ejecutar «${t}» con el instrumento del APU, calibrado.`,
          "Registrar, comparar con la NTP/IEC/expediente y levantar observaciones antes de poner en servicio.",
        ],
      });
    default:
      return out({
        definicion: `Consiste en la ejecución de la partida «${t}» (código ${p.codigo}), del capítulo ${cap} de ${especialidad}, conforme a los planos de la especialidad, el Reglamento Nacional de Metrados y la receta del análisis de precios unitarios. El alcance es exactamente el de esta descripción: no se amplía a ítems de otro código ni se reduce el contenido del APU.${datoFrase} Unidad de medición: ${und}.`,
        procedimiento: [
          `Replantear el frente de «${t}» según el plano de ${especialidad} y las cotas escritas.`,
          "Suministrar los materiales, la cuadrilla y el equipo del APU. No sustituir diámetro, sección, espesor, resistencia ni potencia.",
          "Ejecutar el trabajo con la secuencia propia del oficio (preparación del soporte, colocación, compactación o conexionado, acabado).",
          "Realizar las pruebas de la especialidad (nivel, plomo, estanqueidad, continuidad u otra aplicable).",
          `Medir en ${und} y dejar el frente limpio para la partida siguiente. Entregar a supervisión con la evidencia de control.`,
        ],
        normas: normasBase(p, normasExtraEspecialidad(p.especialidad, d)),
      });
  }
}

function normasExtraEspecialidad(espId: EspecialidadPre, d: string): string[] {
  if (espId === "electricas" || has(d, "conductor", "tablero", "thw")) return ["CNE Utilización", "RNE EM.010"];
  if (espId === "electromecanicas") return ["CNE Suministro / Utilización", "RNE EM.010", "IEC 61439 / IEC 60076"];
  if (espId === "sanitarias") return ["RNE IS.010"];
  if (espId === "estructuras") return ["RNE E.060", "NTP 339.186"];
  if (espId === "arquitectura") return ["RNE A.010 / E.070"];
  if (espId === "comunicaciones") return ["ANSI/TIA-568", "RNE EM.010"];
  if (espId === "carreteras" || espId === "pavimentos") return ["MTC EG-2013"];
  if (espId === "puentes") return ["MTC Manual de puentes", "EG-2013"];
  return [];
}

export function cuerpoDePartida(p: Partida): CuerpoSpec {
  return cuerpo(p, familiaDe(p));
}

/** Solo para control de calidad de fichas PRE-05. */
export function familiaDePartida(p: Partida): Fam {
  return familiaDe(p);
}

export { matsNota };
