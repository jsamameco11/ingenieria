import type { Partida } from "./types";
import type { CuerpoSpec } from "./especificacionTexto";

type OutSpec = (partial: Partial<CuerpoSpec> & Pick<CuerpoSpec, "definicion" | "procedimiento">) => CuerpoSpec;

function has(d: string, ...xs: string[]) {
  return xs.some((x) => d.includes(x));
}

const NORMAS_DEP = [
  "Ficha IPD — cancha de usos múltiples 32,00 × 19,00 m (u otra geometría del plano)",
  "RNE CE.010 Pavimentos urbanos / E.060 Concreto armado",
  "Reglamento Nacional de Metrados para Obras de Edificación y Habilitaciones Urbanas",
];

function subDeportiva(codigo: string, d: string): string {
  if (/^P-08\.01/.test(codigo)) return "losa";
  if (/^P-08\.02\.04/.test(codigo) || has(d, "demarcación deportiva", "demarcacion deportiva")) return "demarcacion";
  if (/^P-08\.02\.05/.test(codigo) || has(d, "sistema acrílico", "sistema acrilico")) return "acrilico";
  if (/^P-08\.02\.06/.test(codigo) || has(d, "endurecedor", "cuarzo")) return "cuarzo";
  if (/^P-08\.02/.test(codigo) || has(d, "imprimante acrílico", "imprimante acrilico", "pintura acrílica de fondo", "pintura acrilica de fondo", "cemento pulido en losa")) {
    return "acabado";
  }
  if (/^P-08\.03/.test(codigo) || has(d, "junta aserrada")) return "junta";
  if (/^P-08\.04/.test(codigo) || has(d, "canaleta perimetral", "evacuación de cancha", "evacuacion de cancha", "caja de reunión de drenaje", "caja de reunion de drenaje")) {
    return "drenaje";
  }
  if (/^P-08\.05/.test(codigo) || has(d, "poste de cerco", "malla cribada", "malla olímpica", "malla olimpica", "malla / red de nylon", "cimiento corrido") && has(d, "cerco")) {
    return "cerco";
  }
  if (/^P-08\.06/.test(codigo) || /^P-09\.03/.test(codigo) || has(d, "aros de básquet", "aros de basquet", "red de vóley", "red de voley", "arcos de fulbito", "arcos de fútbol 7", "arcos de futbol 7", "banca metálica")) {
    return "equipo";
  }
  if (/^P-08\.07/.test(codigo) || /^P-10\.04/.test(codigo) || has(d, "proyector led", "poste metálico de iluminación", "poste metalico de iluminacion", "cableado subterráneo", "cableado subterraneo", "tablero de iluminación", "tablero de iluminacion", "caja de registro eléctrica", "caja de registro electrica")) {
    return "iluminacion";
  }
  if (/^P-08\.08/.test(codigo) || /^P-09/.test(codigo) || has(d, "grass sintético", "grass sintetico", "shock pad", "geotextil", "infill")) return "grass";
  if (/^P-08\.09/.test(codigo) || /^P-10\.02/.test(codigo) || has(d, "tribuna", "gradería", "graderia")) return "tribuna";
  if (/^P-08\.12/.test(codigo) || (has(d, "afirmado") && has(d, "losa deportiva"))) return "afirmado";
  if (/^P-10\.01/.test(codigo) || has(d, "cobertura metálica", "cobertura metalica", "calaminón", "calaminon", "anti-balón", "anti-balon", "bajada pluvial")) return "cobertura";
  if (/^P-10\.03/.test(codigo) || has(d, "bebedero", "marcador electrónico", "marcador electronico")) return "equipo_mayor";
  return "general";
}

export function cuerpoDeportiva(
  p: Partida,
  t: string,
  d: string,
  und: string,
  datoFrase: string,
  comunNo: string[],
  out: OutSpec,
  normasBase: (p: Partida, extra: string[]) => string[],
): CuerpoSpec {
  const sub = subDeportiva(p.codigo, d);
  const no = [
    "Partidas de otra especialidad o de otro capítulo, aunque se ejecuten en el mismo frente de cancha.",
    "Trabajos no descritos en esta partida ni en su APU.",
    "Reparación de daños causados por terceros o por partidas posteriores.",
  ];

  switch (sub) {
    case "losa":
      return out({
        definicion: `Consiste en el vaciado de la losa de cancha «${t}» sobre la subbase o el afirmado ya aceptados, con la resistencia y el espesor de esta descripción (no el de pista urbana e=20 cm). Incluye dosificación, transporte, extendido, compactación con regla y vibrador, paños ≤ 3,00 m, curado y control de pendiente de drenaje (~1 %). El acero de malla electrosoldada de la receta queda en esta partida; el encofrado de borde, las juntas aserradas y la pintura se pagan en sus códigos.${datoFrase}`,
        incluye: [
          "Cemento, agregados, agua, malla electrosoldada y membrana de curado del APU.",
          "Vaciado, vibrado, paños según junta del plano y curado ≥7 días.",
          "Probetas y slump de esta losa.",
        ],
        noIncluye: ["Afirmado, encofrado de borde, junta aserrada, pintura acrílica y cerco.", ...no.slice(1)],
        procedimiento: [
          "Verificar cotas, pendiente (~1 % hacia canaleta) y densidad del afirmado aceptado. Humedecer el contacto. Colocar malla con recubrimiento.",
          `Vaciar el concreto${/210/.test(t) ? " f'c 210 kg/cm²" : /175/.test(t) ? " f'c 175 kg/cm²" : ""} en paños, con regla vibratoria o vibrador de inmersión. No se admite junta fría no prevista.`,
          "Fratasar. Cortar paños ≤ 3,00 × 2,50 m (o la retícula del plano) en el plazo del expediente (usualmente 6–12 h).",
          "Curar. No habilitar juego ni pintar antes de la resistencia y del plazo de curado.",
        ],
        metrado: "Se mide el área neta de losa ejecutada según cotas de plano (largo × ancho de cancha, sin cerco ni tribuna), en m². Recortes y desperdicio van en el P.U.",
        controlAceptacion: [
          `La losa se acepta con la resistencia a 28 días de «${t}», espesor mínimo de plano y pendiente de drenaje sin charcos.`,
          "Se rechaza nido, junta fría, espesor menor o fisura de retracción no sellaable según supervisión.",
        ],
        normas: normasBase(p, [...NORMAS_DEP, "NTP 339.186 / NTP 339.034 (probetas)", "ITF / IPD — planimetría de cancha (referencial)"]),
      });

    case "acabado":
      return out({
        definicion: `Consiste en el acabado de superficie de cancha «${t}»: pulido, imprimante o pintura acrílica antideslizante según esta descripción, sobre la losa ya curada, limpia y con juntas selladas. El sistema no se aplica sobre concreto fresco ni sobre polvo de lechada. Las líneas de juego se pagan en la partida de demarcación, salvo que esta descripción las incorpore.${datoFrase}`,
        incluye: ["Preparación de superficie, material del APU, manos indicadas y limpieza de juntas."],
        noIncluye: ["Demarcación de deportes, sistema acrílico 8 capas y junta aserrada, si son otro código.", ...no.slice(1)],
        procedimiento: [
          "Lavar la losa. Corregir lechada y grasa. Humedad residual según ficha del fabricante (típicamente < 5 %).",
          `Aplicar «${t}» con rodillo o equipo del oficio, en las manos de la partida, respetando tiempo de secado y temperatura (>10 °C, sin lluvia).`,
          "El acabado queda uniforme, antideslizante y sin charcos de pintura. No habilitar juego hasta el curado del recubrimiento.",
        ],
        normas: normasBase(p, [...NORMAS_DEP, "Ficha técnica del sistema acrílico / imprimante", "RNE A.010"]),
      });

    case "acrilico":
      return out({
        definicion: `Consiste en la aplicación del sistema acrílico deportivo de 8 capas «${t}» (resanado, cushion, color de fondo y líneas) sobre la losa ya curada, según ficha del fabricante y plano de arquitectura de cancha. No se reduce el número de capas ni se sustituye el sistema por pintura látex de obra.${datoFrase}`,
        incluye: ["Kit de 8 capas del APU, resane de fisuras capilares, cushion, color y líneas del sistema."],
        noIncluye: ["Losa de concreto, junta aserrada y cerco.", ...no.slice(1)],
        procedimiento: [
          "Ensayo de humedad y adherencia. Resanar fisuras. Lijar rebabas de junta.",
          "Aplicar la secuencia del fabricante (resanador, cushion, color, líneas) con consumo del APU.",
          "Respetar tiempos de curado entre capas. No jugar hasta el alta del fabricante (usualmente 7 días).",
        ],
        normas: normasBase(p, [...NORMAS_DEP, "ITF Court Pace / ficha del sistema acrílico", "ASTM (adherencia, referencial)"]),
      });

    case "cuarzo":
      return out({
        definicion: `Consiste en el espolvoreo e incorporación del endurecedor de superficie tipo cuarzo «${t}» sobre el concreto fresco de la losa de cancha, en la dosificación del APU, para aumentar abrasión y planicidad de juego. Se ejecuta en la misma jornada del vaciado, no sobre concreto fraguado.${datoFrase}`,
        procedimiento: [
          "Espolvorear el cuarzo sobre el concreto en estado fresco, en dos pases, con el consumo del APU.",
          "Incorporar con llana mecánica o de madera. No encharcar agua de curado sobre el endurecedor fresco.",
          "Curar. El acabado queda cerrado, sin zonas polvorientas ni desprendimiento del árido.",
        ],
        normas: normasBase(p, [...NORMAS_DEP, "Ficha del endurecedor mineral", "RNE E.060"]),
      });

    case "demarcacion":
      return out({
        definicion: `Consiste en el replanteo y pintado de las líneas de juego «${t}» (vóley, básquet y fulbito, o el deporte del plano) con pintura acrílica deportiva, anchos y colores de ficha IPD / plano de arquitectura. Un juego comprende el set completo de líneas de la cancha, no el metro lineal suelto.${datoFrase}`,
        incluye: ["Replanteo, cinta de enmascarar, pintura del APU y recorte de encuentros."],
        noIncluye: ["Pintura de fondo de losa y sistema acrílico 8 capas, si son otro código."],
        procedimiento: [
          "Replantear ejes según ficha IPD 32,00 × 19,00 m u otra geometría del plano. Verificar escuadra.",
          "Enmascarar. Pintar líneas del ancho de norma (típicamente 5 cm). Retirar cinta en fresco.",
          "Entregar el juego completo, legible y antideslizante, coincidente con aros, postes y arcos.",
        ],
        metrado: "Se cuenta cada juego completo de demarcación ejecutado y aceptado (una cancha = 1,00 juego, salvo que el plano desdoble deportes en partidas distintas).",
        normas: normasBase(p, [...NORMAS_DEP, "Reglamento FIVB / FIBA / FIFA (geometría de líneas, referencial)"]),
      });

    case "junta":
      return out({
        definicion: `Consiste en el aserrado de juntas de contracción «${t}» a 1/3 del espesor de la losa de cancha y el sello asfáltico o de poliuretano del APU, en la retícula ≤ 3,00 m del plano. Incluye soplado de la ranura y primer si el sello lo exige. No sustituye a la junta de dilatación perimetral si el plano la detalla aparte.${datoFrase}`,
        procedimiento: [
          "Aserrar en el plazo del expediente (6–12 h o cuando el concreto lo permita sin desmoronar labios).",
          "Profundidad ≥ 1/3 del espesor. Soplar y secar la ranura.",
          "Aplicar el sello del APU al ras, sin manchar la losa. No pintar encima del sello fresco.",
        ],
        metrado: "Se mide la longitud neta de junta aserrada y sellada según la retícula de plano, en metros lineales.",
        normas: normasBase(p, [...NORMAS_DEP, "ACI 302 / RNE E.060 (juntas de losa)", "Ficha del sello PU / asfáltico"]),
      });

    case "drenaje":
      return out({
        definicion: `Consiste en la ejecución del drenaje de cancha «${t}» (canaleta perimetral, caja de reunión o tubería de evacuación), con la sección, el diámetro y la pendiente del plano, para desalojar el agua de la losa o del grass sin encharcamiento. Incluye rejilla o tapa de la receta y conexión hasta el punto de descarga del expediente.${datoFrase}`,
        incluye: ["Concreto o tubería del APU, rejilla/tapa, cama de apoyo y prueba de escurrimiento."],
        noIncluye: ["Losa de cancha, cerco y red de desagüe de vestidores (IS), si son otro código."],
        procedimiento: [
          "Replantear cotas de invert y pendiente (mín. 0,5–1 % o la del plano). Excavar la caja o la zanja de la canaleta.",
          `Construir o instalar «${t}» con la sección de catálogo. Colocar rejilla al ras de losa, sin resalto de tropiezo.`,
          "Probar con agua: no debe quedar charco en cancha ni remanso en la caja. Entregar tapa o rejilla asegurada.",
        ],
        normas: normasBase(p, [...NORMAS_DEP, "RNE IS.010 (evacuación pluvial)", "RNE A.120 (resaltos y rejillas en circulación)"]),
      });

    case "cerco":
      return out({
        definicion: `Consiste en la ejecución del cerco de cancha «${t}»: cimiento o pedestal, poste tubular, malla (cribada, olímpica o nylon), marco, puerta o pintura anticorrosiva, según esta descripción y la altura de catálogo. Los postes se aploman, se espacian según plano (usualmente 2,50–3,00 m) y la malla se tensa sin bolsa. No se reduce la altura ni el calibre.${datoFrase}`,
        incluye: [
          "Elemento de esta descripción (cimiento, poste, malla, marco, puerta o pintura) con el material del APU.",
          "Anclaje, aplomado, tensado, soldadura o pernos y limpieza del frente.",
        ],
        noIncluye: ["Losa de juego, tribuna y alumbrado, salvo que esta partida los nombre.", ...no.slice(1)],
        procedimiento: [
          "Replantear el perímetro de cancha (32×19 m + retiro, o el del plano). Verificar interferencia con canaleta y tribuna.",
          `Ejecutar «${t}». Dados o cimiento con f'c de la partida. Postes a plomo. Malla tensada con alambre y marco de ángulo.`,
          "Puertas: chapa, tope y sentido de apertura hacia el exterior de la cancha si el plano no indica otra cosa.",
          "Pintura: desengrase, anticorrosivo y esmalte 2 manos en metal no galvanizado a vista. Entregar sin óxido ni bolsa en la malla.",
        ],
        controlAceptacion: [
          "Altura, calibre y cocada según catálogo. Desplome de poste ≤ 5 mm/m. Malla sin bolsa ni corte sin remate.",
          "Puertas operan, cierran y no invaden la calzada de juego.",
        ],
        normas: normasBase(p, [...NORMAS_DEP, "RNE E.090 (si el poste es estructural)", "NTP de malla galvanizada / ASTM A392 (referencial)"]),
      });

    case "equipo":
      return out({
        definicion: `Consiste en el suministro, anclaje, aplomado, tensado y entrega operativa del equipamiento de juego «${t}» (aros de básquet, postes de vóley, arcos de fulbito o fútbol 7, banca), con redes y herrajes de la ficha. Las dimensiones de tablero, aro o arco no se reducen. El pedestal de concreto de anclaje de esta receta queda en la partida.${datoFrase}`,
        incluye: ["Equipo de catálogo, anclaje, concreto de pedestal si está en el APU, red y pintado de fábrica o de obra."],
        noIncluye: ["Demarcación de líneas y cerco perimetral."],
        procedimiento: [
          "Replantear según ficha IPD / FIBA / FIVB / FIFA del deporte. Verificar escuadra con las líneas.",
          `Anclar «${t}» en pedestal o manga. Aplomar. Tensar redes. Proteger tablero y aro.`,
          "Prueba de juego: altura de aro 3,05 m en básquet adulto (o la del plano escolar), red de vóley a la cota de reglamento, arcos fijos sin bamboleo.",
        ],
        metrado:
          und === "par" || und === "juego"
            ? "Se cuenta el par o el juego completo instalado, alineado y aceptado (no se fracciona un solo arco o un solo poste)."
            : `Se mide en ${und} cada unidad instalada y aceptada.`,
        normas: normasBase(p, [...NORMAS_DEP, "Reglamento FIBA / FIVB / FIFA (dimensiones de equipo)", "RNE E.060 (pedestal de anclaje)"]),
      });

    case "iluminacion":
      return out({
        definicion: `Consiste en la ejecución de la iluminación de cancha «${t}»: poste, proyector LED IP65, cableado NYY, caja de registro o tablero con contactor y fotocelda, según esta descripción. El nivel de iluminancia y la uniformidad siguen el plano eléctrico y la ficha IPD (uso recreativo o competencia). No se sustituye potencia, IP ni sección de conductor.${datoFrase}`,
        incluye: ["Suministro e instalación del ítem, anclaje, conexionado, prueba de encendido y etiquetado."],
        noIncluye: ["Acometida de media tensión, pozo a tierra si es otro código, y proyectores de otra potencia."],
        procedimiento: [
          "Replantear postes (esquinas o costados según plano) y zanja de cableado fuera de la losa de juego.",
          `Instalar «${t}». Dados de poste con pernos. Cable NYY en ducto o tubo del APU. Tablero con protección y fotocelda.`,
          "Apuntar proyectores hacia cancha sin deslumbrar graderías. Medir encendido y continuidad. Entregar esquema unifilar as-built del tablero de cancha.",
        ],
        normas: normasBase(p, [...NORMAS_DEP, "CNE Utilización", "RNE EM.010", "IES RP-6 / ficha IPD de iluminancia (referencial)"]),
      });

    case "grass": {
      const capa = has(d, "geotextil")
        ? "el geotextil no tejido como separación y filtro bajo la cancha"
        : has(d, "hdpe")
          ? "el drenaje corrugado HDPE Ø110 mm con cama de grava"
          : has(d, "asfáltica", "asfaltica")
            ? "la base asfáltica e=4 cm de apoyo del sistema de grass"
            : has(d, "arena nivelada")
              ? "la capa de arena nivelada e=3 cm"
              : has(d, "shock", "elástica", "elastica")
                ? "la capa elástica / shock pad e=10–12 mm"
                : has(d, "infill", "sbr", "sílice", "silice")
                  ? "el relleno de caucho SBR y arena sílice (infill)"
                  : has(d, "demarcación incrustada", "demarcacion incrustada")
                    ? "la demarcación incrustada de fulbito / fútbol 7"
                    : has(d, "40 mm")
                      ? "el grass sintético 40 mm sobre losa, con sello de juntas"
                      : "el grass sintético 50–60 mm, con costura y pegado de rollos";
      return out({
        definicion: `Consiste en la ejecución de «${t}»: ${capa}, según ficha del fabricante y el plano de cancha. El pelo, el shock pad y el infill no se sustituyen por un sistema de menor altura ni por arena de cantera sin sílice redondeada. Cada capa se paga en su código; no se adelanta la capa siguiente sobre una base rechazada.${datoFrase}`,
        incluye: [
          "Material de esta capa (geotextil, HDPE, asfalto, arena, pad, rollo o infill) con desperdicio del APU.",
          "Costura, pegado de rollos, cepillado e infill si la partida los declara.",
        ],
        noIncluye: ["Cerco h=6 m, arcos de fútbol 7 y tribuna, si son otro código.", ...no.slice(1)],
        procedimiento: [
          "Verificar planimetría y pendiente de la base (±5 mm bajo regla de 3 m, o la del fabricante). No instalar sobre barro o charco.",
          has(d, "geotextil")
            ? "Tender geotextil con traslape ≥ 30 cm. Fijar sin arrugas."
            : has(d, "hdpe")
              ? "Tender drenaje HDPE en cama de grava, con pendiente hacia cajas. Envolver con geotextil si el plano lo pide."
              : has(d, "asfáltica", "asfaltica")
                ? "Extender y compactar la base asfáltica e=4 cm. Enfriar antes del pad."
                : has(d, "shock", "elástica", "elastica")
                  ? "Tender shock pad a tope, sin solape grueso. Pegar si el fabricante lo exige."
                  : has(d, "infill", "sbr", "sílice", "silice")
                    ? "Aplicar infill en capas, cepillar, compactar con equipo de infill. Dosificación del APU (kg/m²)."
                    : has(d, "demarcación incrustada", "demarcacion incrustada")
                      ? "Incrustar líneas blancas de fulbito / fútbol 7. No pintar látex sobre el pelo."
                      : "Tender rollos en el sentido del plano. Costura y pegado. Cortar perímetro. Cepillar.",
          "Prueba de peloteo y de drenaje (no debe quedar espejo de agua). Entregar ficha de lote y garantía del fabricante.",
        ],
        metrado: und === "juego"
          ? "Se cuenta el juego de líneas incrustadas completo por cancha."
          : und === "m"
            ? "Se mide la longitud neta de drenaje HDPE según trazo de plano, en metros."
            : "Se mide el área neta de cancha (juego + sobreancho de anclaje del plano), en m². Recortes de rollo van en el P.U.",
        normas: normasBase(p, [...NORMAS_DEP, "FIFA Quality / Quality Pro (referencial de grass)", "NTP ISO 9001 del fabricante", "EN 15330 (referencial)"]),
      });
    }

    case "tribuna":
      return out({
        definicion: `Consiste en la ejecución de la tribuna o gradería de cancha «${t}» (concreto ciclópeo de 3 o 5 gradas, pulido, baranda h=1,00 m o pintura), según sección de plano. La huella, la contrahuella y la longitud no se reducen. La baranda se ancla al concreto y se pinta; el pulido se ejecuta sobre concreto ya curado.${datoFrase}`,
        incluye: ["Material y mano de obra de esta descripción (ciclópeo, pulido, baranda o pintura)."],
        noIncluye: ["Losa de juego, cerco y cobertura, si son otro código."],
        procedimiento: [
          "Replantear la sección (huella/contrahuella del plano). Compactar la cama. Encofrar si la partida lo exige.",
          has(d, "baranda")
            ? "Anclar baranda h=1,00 m, aplomar, soldar o pernar, pintar anticorrosivo + esmalte."
            : has(d, "pintura", "látex", "latex")
              ? "Lavar, imprimar si aplica, dos manos de látex. No pintar sobre concreto húmedo."
              : has(d, "pulido")
                ? "Fratasar y pulir huellas y contrahuellas. Curar. Aristas vivas sin descascarar."
                : "Vaciar ciclópeo f'c 140 + 70 % PG (o el de la partida) por gradas. Compactar. Curar ≥7 días.",
          "Entregar gradas sin charco, con baranda continua en desniveles ≥ 1,00 m y sin canto cortante hacia la cancha.",
        ],
        metrado: und === "m"
          ? "Se mide la longitud de tribuna ejecutada según el frente de graderías del plano, en metros lineales (no el desarrollo de cada grada, salvo que el metrado del expediente lo desglose)."
          : `Se mide en ${und} según el plano.`,
        normas: normasBase(p, [...NORMAS_DEP, "RNE A.010 / A.130 (circulación y barandas)", "RNE E.060", "RNE A.120 si hay acceso PMR a graderías"]),
      });

    case "afirmado":
      return out({
        definicion: `Consiste en la conformación y compactación del afirmado «${t}» bajo la losa de cancha, e=10 cm o el de la descripción, con material granular del APU, hasta la cota de fondo de losa y la pendiente de drenaje (~1 %). No sustituye a la subbase ni a la losa de concreto.${datoFrase}`,
        procedimiento: [
          "Perfilar la subrasante aceptada. Extender el granular en tongada.",
          "Compactar con rodillo del APU ≥ 95 % de la densidad máxima (Proctor modificado o la del expediente).",
          "Verificar cota y pendiente. No vaciar losa sobre afirmado rechazado o saturado.",
        ],
        normas: normasBase(p, [...NORMAS_DEP, "MTC EG-2013 (afirmado)", "NTP 339.141 / ASTM D1557"]),
      });

    case "cobertura":
      return out({
        definicion: `Consiste en la fabricación, izaje y montaje de la cobertura de losa «${t}» (columnas, tijerales, calaminón, canaleta pluvial o malla anti-balón en faldones), según el plano de estructuras metálicas. Incluye pintura anticorrosiva de taller o de obra de la receta, pernos de anclaje y sello de cumbrera. No se reduce la pendiente ni el calibre de la plancha.${datoFrase}`,
        incluye: ["Acero o calaminón del APU, soldadura, izaje, pernos, pintura y canaleta/bajada si esta partida los declara."],
        noIncluye: ["Losa de cancha, tribuna de concreto y tablero eléctrico, si son otro código."],
        procedimiento: [
          "Verificar dados y pernos de anclaje. Montar columnas a plomo. Izaje de tijerales con equipo y andamio del APU.",
          `Colocar «${t}» con solape de plancha del fabricante. Canaletas y bajadas a cajas de cancha. Malla anti-balón tensada en faldones.`,
          "Pintar. Prueba de lluvia: no goteo sobre el área de juego. Entregar pernos torqueados y soldaduras sin poros a vista.",
        ],
        normas: normasBase(p, [...NORMAS_DEP, "RNE E.090 Estructuras metálicas", "AWS D1.1 (soldadura, referencial)", "Ficha de calaminón / cubierta"]),
      });

    case "equipo_mayor":
      return out({
        definicion: `Consiste en el suministro, anclaje, conexión y entrega operativa de «${t}» (bebedero de pedestal o marcador electrónico LED) en la plataforma deportiva, en el punto del plano, con acometida de agua o eléctrica de la receta. El modelo y la potencia no se sustituyen.${datoFrase}`,
        procedimiento: [
          "Verificar punto de agua / desagüe o alimentador eléctrico ya probado.",
          `Instalar «${t}» a plomo. Conectar. Siliconar o sellar encuentro con piso.`,
          has(d, "bebedero")
            ? "Probar caudal y desagüe. Entregar sin fugas, con desagüe a red o a pozo de la partida IS."
            : "Probar dígitos, alimentación y anclaje antivandálico. Entregar control y garantía.",
        ],
        normas: normasBase(p, [...NORMAS_DEP, "RNE IS.010 (bebedero)", "RNE EM.010 / CNE (marcador)", "RNE A.120 si el bebedero es accesible"]),
      });

    default:
      return out({
        definicion: `Consiste en la ejecución de «${t}» de la plataforma deportiva, según ficha IPD, planos de la especialidad y el expediente municipal o IOARR. El espesor y la resistencia de la losa de cancha (e=10–15 cm, f'c 175–210) no se sustituyen por los de pista urbana.${datoFrase}`,
        noIncluye: comunNo,
        procedimiento: [
          "Replantear ejes IPD (32×19 m u otra geometría del plano), pendientes de drenaje (~1 %) y paños de junta ≤ 3,00 m.",
          `Ejecutar «${t}» con el material, el espesor y el APU de esta partida.`,
          "Curar el concreto o asentar el grass según el ítem. No habilitar la cancha antes del plazo del expediente.",
          "Pruebas de iluminación, tensado de malla y replanteo de demarcación, si aplica a esta partida.",
        ],
        normas: normasBase(p, NORMAS_DEP),
      });
  }
}
