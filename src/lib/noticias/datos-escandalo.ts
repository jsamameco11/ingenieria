import { art, type Noticia } from "./tipos";

const AVISO = "Caso en investigación: los hechos se presentan en modo condicional (presunto/posible/habría) a partir de denuncias y versiones oficiales. Ninguna persona es señalada como culpable. Esta nota se actualizará con el pronunciamiento fiscal o judicial.";

/** Escándalos · 1 categoría × 2 notas profundas. Lenguaje condicional en todo el texto. */
export const NOTICIAS_ESCANDALO: Noticia[] = [
  art("escandalo", 1,
    "Presunta implicancia de policías en el secuestro del hijo de un empresario minero",
    "La Fiscalía investiga si efectivos en actividad habrían filtrado los movimientos de la víctima. La PNP los separó del cargo mientras duren las diligencias.",
    [
      "La Fiscalía contra el Crimen Organizado investiga la presunta participación de efectivos policiales en el secuestro del hijo de un empresario minero del norte, liberado tras el pago de un rescate cuya cifra no ha sido confirmada oficialmente. El caso, ocurrido este mes, es tratado con reserva por las autoridades.",
      "Según la hipótesis fiscal preliminar —aún no corroborada—, los movimientos y rutinas de la víctima habrían sido filtrados a la banda desde el interior de una dependencia policial. La familia denunció que los secuestradores conocían horarios, rutas y hasta el blindaje del vehículo, datos que, según su abogado, solo manejaba un círculo reducido.",
      "Entre las evidencias en verificación figuran el registro de llamadas de los teléfonos incautados a tres detenidos, las imágenes de cámaras municipales que habrían captado una patrulla cerca del lugar del plagio y el testimonio de un colaborador eficaz cuya identidad se mantiene en reserva. Ninguno de estos elementos ha sido aún sometido a peritaje oficial, por lo que su valor probatorio está pendiente.",
      "La Policía Nacional informó, mediante comunicado, que dos suboficiales fueron separados de sus puestos y puestos a disposición de Inspectoría mientras duran las investigaciones. La institución afirmó que 'no encubrirá a ningún efectivo' y que colabora con el Ministerio Público, aunque precisó que la separación es una medida preventiva y no una sanción.",
      "El Ministerio del Interior anunció, por su parte, una auditoría a los protocolos de manejo de información sensible en las divisiones de secuestros. Voceros del sector señalaron que de confirmarse la filtración se trataría de un hecho aislado, versión que los familiares cuestionan y que la Fiscalía deberá esclarecer.",
      "Falta verificar el contenido de los teléfonos, el peritaje de las cámaras y la declaración ampliada del colaborador. Especialistas en seguridad consultados coinciden en que el caso pondrá a prueba los controles internos de la PNP. Esta redacción seguirá el expediente y actualizará la nota con cada pronunciamiento oficial.",
    ],
    [
      { medio: "Ministerio Público", nota: "Confirmación de investigación preliminar reservada." },
      { medio: "PNP – Dirección de Comunicación", nota: "Comunicado de separación preventiva de dos efectivos." },
      { medio: "Abogado de la familia", nota: "Declaraciones sobre la denuncia de filtración (versión de parte)." },
    ],
    "20 sep 2026",
    "Redacción Ingeniería",
    AVISO),
  art("escandalo", 2,
    "Padres denuncian presuntos excesos en la formación del Colegio Naval del Perú",
    "La Marina de Guerra abrió una investigación interna tras las denuncias de castigos físicos extremos. Los padres piden protocolos claros y supervisión externa.",
    [
      "Un grupo de padres de cadetes del Colegio Naval del Perú denunció presuntos excesos en los regímenes de instrucción física, que habrían incluido ejercicios prolongados hasta el agotamiento y sanciones colectivas. Las denuncias, difundidas primero en redes sociales, motivaron la apertura de una investigación interna en la institución.",
      "Según los testimonios recogidos —que esta redacción presenta como versiones aún no verificadas—, al menos cinco cadetes habrían requerido atención médica por deshidratación y lesiones musculares en las últimas semanas. Los padres afirman contar con certificados médicos y fotografías, documentos que habrían sido entregados a la Inspectoría naval.",
      "La evidencia en verificación incluye esos certificados, los videos grabados por los propios alumnos y el registro de atenciones de la enfermería del plantel. Ninguno ha sido peritado por una instancia independiente hasta el momento, por lo que no es posible establecer fehacientemente la magnitud de lo ocurrido.",
      "La Marina de Guerra respondió con un comunicado en el que asegura que la exigencia física forma parte de la formación naval, pero que 'ningún exceso está permitido'. Anunció la suspensión temporal de dos instructores y la revisión de los manuales de instrucción, sin calificar aún los hechos como falta.",
      "La Defensoría del Pueblo solicitó acceso al plantel y recomendó supervisión externa permanente en escuelas de formación militar y policial. Su vocero recordó que la disciplina no puede vulnerar la integridad de menores de edad, varios de los cadetes tienen 15 y 16 años.",
      "Está pendiente el informe de Inspectoría, el pronunciamiento de la Fiscalía de Familia y la opinión de un peritaje médico independiente. Exoficiales consultados señalan que el caso reabre el debate sobre los límites de la instrucción premilitar en el país.",
    ],
    [
      { medio: "Marina de Guerra del Perú", nota: "Comunicado sobre investigación interna y suspensión de instructores." },
      { medio: "Defensoría del Pueblo", nota: "Pedido de supervisión externa." },
      { medio: "Asociación de padres denunciantes", nota: "Testimonios y documentos entregados (versión de parte, en verificación)." },
    ],
    "19 sep 2026",
    "Redacción Ingeniería",
    AVISO),
];
