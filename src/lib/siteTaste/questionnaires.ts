export type FieldKind = "select" | "multi" | "text" | "number";

export type OnboardingField = {
  id: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: { id: string; label: string }[];
  placeholder?: string;
  hint?: string;
};

export type SiteQuestionnaire = {
  code: string;
  brand: string;
  title: string;
  lead: string;
  why: string;
  fields: OnboardingField[];
};

const AGE: OnboardingField = {
  id: "age",
  label: "Edad",
  kind: "number",
  required: true,
  hint: "Entre 16 y 99 años.",
};

const CITY: OnboardingField = {
  id: "city",
  label: "Ciudad o distrito donde trabaja o reside",
  kind: "text",
  required: true,
  placeholder: "Ej. Lima, Arequipa, Trujillo",
};

export const SITE_QUESTIONNAIRES: Record<string, SiteQuestionnaire> = {
  INGENIERIA: {
    code: "INGENIERIA",
    brand: "Ingeniería",
    title: "Ficha profesional",
    lead: "Indique si es ingeniero, arquitecto o técnico para ordenar memorias de cálculo, expedientes y la plaza de Compras.",
    why: "El servicio gratuito se personaliza con su oficio y territorio. Estas preguntas se hacen una sola vez. No vendemos su ficha a terceros.",
    fields: [
      {
        id: "role",
        label: "¿Cuál es su oficio principal?",
        kind: "select",
        required: true,
        options: [
          { id: "ingeniero", label: "Ingeniero(a)" },
          { id: "arquitecto", label: "Arquitecto(a)" },
          { id: "tecnico", label: "Técnico(a) o delineante" },
          { id: "residente", label: "Residente o supervisor de obra" },
          { id: "estudiante", label: "Estudiante de ingeniería o arquitectura" },
          { id: "otro", label: "Otro" },
        ],
      },
      {
        id: "specialty",
        label: "Especialidad con la que trabaja más",
        kind: "select",
        required: true,
        options: [
          { id: "civil", label: "Ingeniería civil" },
          { id: "estructuras", label: "Estructuras / memorias de cálculo" },
          { id: "sanitaria", label: "Sanitaria e hidráulica" },
          { id: "electrica", label: "Eléctrica o mecánica" },
          { id: "geotecnia", label: "Geotecnia y suelos" },
          { id: "arquitectura", label: "Arquitectura y diseño" },
          { id: "urbano", label: "Urbanismo o catastro" },
          { id: "otro", label: "Otra" },
        ],
      },
      {
        id: "docs",
        label: "Documentos que elabora o consulta",
        kind: "multi",
        required: true,
        options: [
          { id: "memorias", label: "Memorias de cálculo" },
          { id: "expedientes", label: "Expedientes técnicos" },
          { id: "metrados", label: "Metrados y presupuestos" },
          { id: "planos", label: "Planos" },
          { id: "especificaciones", label: "Especificaciones técnicas" },
        ],
      },
      {
        id: "tools",
        label: "Software que usa con más frecuencia",
        kind: "multi",
        required: true,
        options: [
          { id: "excel", label: "Excel / hojas de cálculo" },
          { id: "etabs", label: "ETABS" },
          { id: "sap", label: "SAP2000" },
          { id: "revit", label: "Revit / BIM" },
          { id: "civil3d", label: "Civil 3D" },
          { id: "safe", label: "SAFE" },
          { id: "msproject", label: "MS Project / Primavera" },
          { id: "otro", label: "Otro software" },
        ],
      },
      AGE,
      CITY,
      { id: "organization", label: "Estudio, empresa o universidad", kind: "text", placeholder: "Razón social o institución" },
    ],
  },
  CONTRATACIONES: {
    code: "CONTRATACIONES",
    brand: "Contrataciones",
    title: "Perfil de contratación pública",
    lead: "Indique su rol en el mercado de contrataciones para mostrar oportunidades, bases y alertas acordes.",
    why: "Las preguntas permiten filtrar convocatorias y avisos a su rubro. El uso es interno y gratuito; sirve para personalizar el tablero.",
    fields: [
      {
        id: "role",
        label: "¿Cuál es su rol principal?",
        kind: "select",
        required: true,
        options: [
          { id: "postor", label: "Postor / empresa ejecutora" },
          { id: "consultor", label: "Consultor o proyectista" },
          { id: "funcionario", label: "Funcionario de entidad" },
          { id: "abogado", label: "Abogado o asesor legal" },
          { id: "analista", label: "Analista de licitaciones" },
          { id: "estudiante", label: "Estudiante o tesista" },
          { id: "otro", label: "Otro" },
        ],
      },
      {
        id: "regime",
        label: "¿En qué régimen opera con más frecuencia?",
        kind: "select",
        required: true,
        options: [
          { id: "osce", label: "OSCE / OECE — contratación pública" },
          { id: "municipal", label: "Municipalidades y gobiernos locales" },
          { id: "regional", label: "Gobiernos regionales" },
          { id: "privado", label: "Privado / invitaciones" },
          { id: "mixto", label: "Público y privado" },
        ],
      },
      {
        id: "rubros",
        label: "Rubros de interés",
        kind: "multi",
        required: true,
        options: [
          { id: "obras", label: "Obras" },
          { id: "consultoria", label: "Consultoría de obras" },
          { id: "bienes", label: "Bienes" },
          { id: "servicios", label: "Servicios" },
          { id: "ti", label: "Tecnología e informática" },
          { id: "salud", label: "Salud" },
          { id: "educacion", label: "Educación" },
        ],
      },
      { id: "organization", label: "Entidad o empresa", kind: "text", placeholder: "Razón social o entidad" },
      AGE,
      CITY,
      {
        id: "seeking",
        label: "¿Qué necesita ver primero?",
        kind: "select",
        required: true,
        options: [
          { id: "alertas", label: "Alertas de convocatorias" },
          { id: "bases", label: "Bases y expedientes" },
          { id: "analisis", label: "Análisis de mercado" },
          { id: "documentos", label: "Modelos de documentos" },
        ],
      },
      {
        id: "experience_years",
        label: "Años de experiencia en contrataciones",
        kind: "number",
      },
    ],
  },
  ODONTOMEDIC: {
    code: "ODONTOMEDIC",
    brand: "Odontomedic",
    title: "Perfil clínico y de práctica",
    lead: "Esta ficha ordena contenidos, insumos y avisos según su práctica odontológica.",
    why: "El servicio es gratuito y se personaliza con su especialidad y territorio. Los datos no se publican en el directorio sin su consentimiento.",
    fields: [
      {
        id: "role",
        label: "¿Usted es…?",
        kind: "select",
        required: true,
        options: [
          { id: "odontologo", label: "Cirujano dentista" },
          { id: "especialista", label: "Especialista" },
          { id: "auxiliar", label: "Auxiliar o higienista" },
          { id: "clinica", label: "Administración de clínica" },
          { id: "estudiante", label: "Estudiante de odontología" },
          { id: "paciente", label: "Paciente o familiar" },
        ],
      },
      {
        id: "specialty",
        label: "Especialidad o área de mayor práctica",
        kind: "select",
        required: true,
        options: [
          { id: "general", label: "Odontología general" },
          { id: "ortodoncia", label: "Ortodoncia" },
          { id: "implantes", label: "Implantología" },
          { id: "endodoncia", label: "Endodoncia" },
          { id: "periodoncia", label: "Periodoncia" },
          { id: "cirugia", label: "Cirugía bucal" },
          { id: "pediatrico", label: "Odontopediatría" },
          { id: "estetica", label: "Estética / rehabilitación" },
          { id: "otro", label: "Otra" },
        ],
      },
      {
        id: "practice",
        label: "Modalidad de ejercicio",
        kind: "select",
        required: true,
        options: [
          { id: "consulta", label: "Consulta propia" },
          { id: "clinica", label: "Clínica o cadena" },
          { id: "hospital", label: "Hospital o MINSA / EsSalud" },
          { id: "docencia", label: "Docencia" },
        ],
      },
      AGE,
      CITY,
      { id: "organization", label: "Consultorio, clínica o institución", kind: "text" },
      {
        id: "interests",
        label: "Temas de interés",
        kind: "multi",
        required: true,
        options: [
          { id: "insumos", label: "Insumos y equipos" },
          { id: "cursos", label: "Cursos y congresos" },
          { id: "software", label: "Software clínico" },
          { id: "protocolos", label: "Protocolos clínicos" },
        ],
      },
    ],
  },
  CASA_PALABRA: {
    code: "CASA_PALABRA",
    brand: "Casa de la Palabra",
    title: "Perfil de lectura y comunidad",
    lead: "Para ofrecer lecturas, planes y recursos acordes a su fe y a su ritmo de estudio.",
    why: "La confesión se declara aquí, solo en esta página, para personalizar el contenido. No se usa para clasificarlo en las demás aplicaciones del ecosistema.",
    fields: [
      {
        id: "confession",
        label: "¿Qué profesión de fe le representa mejor?",
        kind: "select",
        required: true,
        options: [
          { id: "catolico", label: "Católico(a)" },
          { id: "evangelico", label: "Evangélico(a) / protestante" },
          { id: "cristiano", label: "Cristiano(a) no denominacional" },
          { id: "adventista", label: "Adventista del séptimo día" },
          { id: "pentecostal", label: "Pentecostal" },
          { id: "bautista", label: "Bautista" },
          { id: "ortodoxo", label: "Ortodoxo(a)" },
          { id: "mormon", label: "Santo de los Últimos Días (mormón)" },
          { id: "testigo", label: "Testigo de Jehová" },
          { id: "buscador", label: "Estoy conociendo la fe" },
          { id: "otro", label: "Otra" },
        ],
      },
      {
        id: "role",
        label: "¿Cómo participa en su comunidad?",
        kind: "select",
        required: true,
        options: [
          { id: "miembro", label: "Miembro o feligrés" },
          { id: "lider", label: "Líder de grupo o escuela" },
          { id: "pastor", label: "Pastor(a) o sacerdote" },
          { id: "maestro", label: "Maestro(a) de Biblia" },
          { id: "joven", label: "Ministerio de jóvenes" },
          { id: "personal", label: "Lectura personal" },
        ],
      },
      {
        id: "frequency",
        label: "Frecuencia de lectura bíblica",
        kind: "select",
        required: true,
        options: [
          { id: "diaria", label: "Diaria" },
          { id: "semanal", label: "Varias veces por semana" },
          { id: "ocasional", label: "Ocasional" },
          { id: "inicio", label: "Estoy comenzando" },
        ],
      },
      {
        id: "translation",
        label: "Traducción o versión que prefiere",
        kind: "select",
        options: [
          { id: "rvr60", label: "Reina-Valera 1960" },
          { id: "nvi", label: "NVI" },
          { id: "dhh", label: "Dios Habla Hoy" },
          { id: "tla", label: "Traducción en lenguaje actual" },
          { id: "nblh", label: "NBLA" },
          { id: "jerusalen", label: "Biblia de Jerusalén" },
          { id: "latinoamericana", label: "Latinoamericana" },
          { id: "otra", label: "Otra" },
        ],
      },
      {
        id: "interests",
        label: "Qué desea encontrar aquí",
        kind: "multi",
        required: true,
        options: [
          { id: "estudio", label: "Estudio bíblico" },
          { id: "devocional", label: "Devocionales" },
          { id: "predicacion", label: "Predicación" },
          { id: "jovenes", label: "Contenido para jóvenes" },
          { id: "familia", label: "Familia y matrimonio" },
          { id: "audio", label: "Audio y música" },
        ],
      },
      AGE,
      CITY,
      {
        id: "canon",
        label: "Énfasis de lectura",
        kind: "select",
        options: [
          { id: "ambos", label: "Antiguo y Nuevo Testamento" },
          { id: "nt", label: "Sobre todo Nuevo Testamento" },
          { id: "at", label: "Sobre todo Antiguo Testamento" },
          { id: "salmos", label: "Salmos y sabiduría" },
        ],
      },
    ],
  },
  LINKEDIN_JOB: {
    code: "LINKEDIN_JOB",
    brand: "LinkedIn Job",
    title: "Perfil laboral",
    lead: "Para ordenar convocatorias, avisos y el CV según su situación profesional.",
    why: "El directorio es gratuito. Estas respuestas afinan matching y categorías; no se envían a empleadores sin que usted postule.",
    fields: [
      {
        id: "status",
        label: "Situación actual",
        kind: "select",
        required: true,
        options: [
          { id: "busca", label: "Busco empleo" },
          { id: "abierto", label: "Empleado(a), abierto a ofertas" },
          { id: "contrata", label: "Contrato talento" },
          { id: "red", label: "Solo networking" },
          { id: "estudiante", label: "Estudiante o egresado reciente" },
        ],
      },
      {
        id: "industry",
        label: "Rubro o industria",
        kind: "select",
        required: true,
        options: [
          { id: "ingenieria", label: "Ingeniería y construcción" },
          { id: "ti", label: "Tecnología" },
          { id: "salud", label: "Salud" },
          { id: "educacion", label: "Educación" },
          { id: "comercio", label: "Comercio y ventas" },
          { id: "admin", label: "Administración y finanzas" },
          { id: "legal", label: "Legal" },
          { id: "otro", label: "Otro" },
        ],
      },
      {
        id: "level",
        label: "Nivel de experiencia",
        kind: "select",
        required: true,
        options: [
          { id: "junior", label: "Junior / primeros años" },
          { id: "semi", label: "Semi senior" },
          { id: "senior", label: "Senior" },
          { id: "lider", label: "Liderazgo o gerencia" },
        ],
      },
      {
        id: "mode",
        label: "Modalidad que busca",
        kind: "select",
        required: true,
        options: [
          { id: "presencial", label: "Presencial" },
          { id: "remoto", label: "Remoto" },
          { id: "hibrido", label: "Híbrido" },
          { id: "indistinto", label: "Indistinto" },
        ],
      },
      AGE,
      CITY,
      { id: "occupation", label: "Cargo u oficio que desempeña", kind: "text", required: true, placeholder: "Ej. analista, residente de obra" },
      {
        id: "experience_years",
        label: "Años de experiencia laboral",
        kind: "number",
      },
    ],
  },
  FOLIO_PDF: {
    code: "FOLIO_PDF",
    brand: "Folio PDF",
    title: "Uso profesional de documentos",
    lead: "Para mostrar herramientas, avisos de la plaza y sugerencias según el tipo de documento que trabaja.",
    why: "Folio es gratuito en su plan base. La ficha evita publicidad genérica y prioriza lo que usted abre, firma o publica.",
    fields: [
      {
        id: "role",
        label: "Oficio principal",
        kind: "select",
        required: true,
        options: [
          { id: "estudiante", label: "Estudiante" },
          { id: "oficina", label: "Oficina / administración" },
          { id: "ingeniero", label: "Ingeniería o arquitectura" },
          { id: "abogado", label: "Derecho" },
          { id: "docente", label: "Docencia" },
          { id: "salud", label: "Salud" },
          { id: "comercio", label: "Comercio" },
          { id: "otro", label: "Otro" },
        ],
      },
      {
        id: "use",
        label: "Uso más frecuente en Folio",
        kind: "multi",
        required: true,
        options: [
          { id: "editar", label: "Editar PDF" },
          { id: "firmar", label: "Firmar" },
          { id: "comprimir", label: "Comprimir" },
          { id: "escanear", label: "Escanear" },
          { id: "estudiar", label: "Leer y anotar" },
          { id: "plaza", label: "Compras / publicar avisos" },
        ],
      },
      {
        id: "docs",
        label: "Documentos que maneja con más frecuencia",
        kind: "multi",
        required: true,
        options: [
          { id: "contratos", label: "Contratos" },
          { id: "expedientes", label: "Expedientes técnicos" },
          { id: "facturas", label: "Facturas y constancias" },
          { id: "academicos", label: "Material académico" },
          { id: "planos", label: "Planos" },
        ],
      },
      AGE,
      CITY,
      { id: "organization", label: "Empresa o institución", kind: "text" },
      {
        id: "frequency",
        label: "Frecuencia de uso",
        kind: "select",
        options: [
          { id: "diario", label: "Todos los días" },
          { id: "semanal", label: "Varias veces por semana" },
          { id: "ocasional", label: "Ocasional" },
        ],
      },
    ],
  },
  MERCAGO: {
    code: "MERCAGO",
    brand: "MercaGo",
    title: "Perfil de compra y venta",
    lead: "Para mostrar anuncios, categorías y vendedores cercanos a lo que usted hace.",
    why: "MercaGo es un servicio gratuito de vitrina. Preguntamos oficio y categorías para no inundar el inicio con avisos ajenos a su actividad.",
    fields: [
      {
        id: "occupation",
        label: "¿A qué se dedica?",
        kind: "text",
        required: true,
        placeholder: "Oficio, oficio de la empresa o actividad",
      },
      {
        id: "side",
        label: "En MercaGo usted…",
        kind: "select",
        required: true,
        options: [
          { id: "compra", label: "Compra" },
          { id: "vende", label: "Vende" },
          { id: "ambos", label: "Compra y vende" },
        ],
      },
      {
        id: "categories",
        label: "Categorías de interés",
        kind: "multi",
        required: true,
        options: [
          { id: "vehiculos", label: "Vehículos" },
          { id: "inmuebles", label: "Inmuebles" },
          { id: "empleos", label: "Empleos y servicios" },
          { id: "hogar", label: "Hogar" },
          { id: "tecnologia", label: "Tecnología" },
          { id: "moda", label: "Moda" },
          { id: "industria", label: "Industria y oficio" },
          { id: "otros", label: "Otros" },
        ],
      },
      {
        id: "ticket",
        label: "Rango habitual de precio que busca o publica",
        kind: "select",
        options: [
          { id: "bajo", label: "Hasta S/ 200" },
          { id: "medio", label: "S/ 200 a S/ 2 000" },
          { id: "alto", label: "S/ 2 000 a S/ 20 000" },
          { id: "mayor", label: "Más de S/ 20 000" },
        ],
      },
      AGE,
      CITY,
      { id: "organization", label: "Nombre comercial o empresa (si aplica)", kind: "text" },
      {
        id: "seeking",
        label: "¿Qué busca hoy?",
        kind: "select",
        required: true,
        options: [
          { id: "ofertas", label: "Ofertas cercanas" },
          { id: "insumos", label: "Insumos para mi oficio" },
          { id: "clientes", label: "Clientes para vender" },
          { id: "explorar", label: "Explorar el mercado" },
        ],
      },
    ],
  },
};

export const INGENIERIA_TOOLS = [
  { id: "excel", label: "Excel / hojas de cálculo" },
  { id: "etabs", label: "ETABS" },
  { id: "sap", label: "SAP2000" },
  { id: "revit", label: "Revit / BIM" },
  { id: "civil3d", label: "Civil 3D" },
  { id: "safe", label: "SAFE" },
  { id: "msproject", label: "MS Project / Primavera" },
  { id: "otro", label: "Otro software" },
];

export const INGENIERIA_BUY_CATS = [
  { id: "Construcción", label: "Construcción" },
  { id: "Software", label: "Software" },
  { id: "Educación", label: "Educación" },
  { id: "Servicios", label: "Servicios profesionales" },
  { id: "Tecnología", label: "Tecnología" },
  { id: "Oficina", label: "Oficina técnica" },
  { id: "Diseño", label: "Diseño" },
  { id: "Inmuebles", label: "Inmuebles" },
  { id: "Legal", label: "Legal" },
];

export function questionnaireOf(code: string): SiteQuestionnaire | null {
  return SITE_QUESTIONNAIRES[code] || null;
}
