import type { CraftFamily } from "./types";

export type Profession = {
  id: string;
  label: string;
  title: string;
  group: string;
};

export const PROFESSION_GROUPS = [
  "Arquitectura y urbanismo",
  "Ingeniería civil y afines",
  "Ingeniería del agua y del agro",
  "Ingeniería de la tierra y energía",
  "Ingeniería industrial y de procesos",
  "Ingeniería eléctrica y de sistemas",
  "Otras profesiones técnicas",
] as const;

export const PROFESSIONS: Profession[] = [
  { id: "arq", label: "Arquitecto(a)", title: "Arq.", group: "Arquitectura y urbanismo" },
  { id: "arq-urbanista", label: "Urbanista", title: "Arq.", group: "Arquitectura y urbanismo" },
  { id: "arq-paisajista", label: "Arquitecto(a) paisajista", title: "Arq.", group: "Arquitectura y urbanismo" },
  { id: "arq-interiores", label: "Diseñador(a) de interiores", title: "Dis. Int.", group: "Arquitectura y urbanismo" },
  { id: "icivil", label: "Ingeniero(a) civil", title: "Ing.", group: "Ingeniería civil y afines" },
  { id: "iestructural", label: "Ingeniero(a) estructural", title: "Ing.", group: "Ingeniería civil y afines" },
  { id: "igeotecnia", label: "Ingeniero(a) geotécnico(a)", title: "Ing.", group: "Ingeniería civil y afines" },
  { id: "ihidraulico", label: "Ingeniero(a) hidráulico(a)", title: "Ing.", group: "Ingeniería civil y afines" },
  { id: "itransportes", label: "Ingeniero(a) de transportes", title: "Ing.", group: "Ingeniería civil y afines" },
  { id: "icaminos", label: "Ingeniero(a) de caminos", title: "Ing.", group: "Ingeniería civil y afines" },
  { id: "iconstructivo", label: "Ingeniero(a) de la construcción", title: "Ing.", group: "Ingeniería civil y afines" },
  { id: "icatastral", label: "Ingeniero(a) catastral y geodesta", title: "Ing.", group: "Ingeniería civil y afines" },
  { id: "itopografo", label: "Ingeniero(a) topógrafo(a)", title: "Ing.", group: "Ingeniería civil y afines" },
  { id: "isanitario", label: "Ingeniero(a) sanitario(a)", title: "Ing.", group: "Ingeniería del agua y del agro" },
  { id: "iambiental", label: "Ingeniero(a) ambiental", title: "Ing.", group: "Ingeniería del agua y del agro" },
  { id: "iagricola", label: "Ingeniero(a) agrícola", title: "Ing.", group: "Ingeniería del agua y del agro" },
  { id: "iagronomo", label: "Ingeniero(a) agrónomo(a)", title: "Ing.", group: "Ingeniería del agua y del agro" },
  { id: "iforestal", label: "Ingeniero(a) forestal", title: "Ing.", group: "Ingeniería del agua y del agro" },
  { id: "ipesquero", label: "Ingeniero(a) pesquero(a)", title: "Ing.", group: "Ingeniería del agua y del agro" },
  { id: "izootecnista", label: "Ingeniero(a) zootecnista", title: "Ing.", group: "Ingeniería del agua y del agro" },
  { id: "ialimentos", label: "Ingeniero(a) de alimentos", title: "Ing.", group: "Ingeniería del agua y del agro" },
  { id: "igeologo", label: "Ingeniero(a) geólogo(a)", title: "Ing.", group: "Ingeniería de la tierra y energía" },
  { id: "iminas", label: "Ingeniero(a) de minas", title: "Ing.", group: "Ingeniería de la tierra y energía" },
  { id: "imetalurgista", label: "Ingeniero(a) metalurgista", title: "Ing.", group: "Ingeniería de la tierra y energía" },
  { id: "ipetroleo", label: "Ingeniero(a) de petróleo y gas", title: "Ing.", group: "Ingeniería de la tierra y energía" },
  { id: "ipetroquimico", label: "Ingeniero(a) petroquímico(a)", title: "Ing.", group: "Ingeniería de la tierra y energía" },
  { id: "ienergetico", label: "Ingeniero(a) energético(a)", title: "Ing.", group: "Ingeniería de la tierra y energía" },
  { id: "inuclear", label: "Ingeniero(a) nuclear", title: "Ing.", group: "Ingeniería de la tierra y energía" },
  { id: "iindustrial", label: "Ingeniero(a) industrial", title: "Ing.", group: "Ingeniería industrial y de procesos" },
  { id: "iquimico", label: "Ingeniero(a) químico(a)", title: "Ing.", group: "Ingeniería industrial y de procesos" },
  { id: "imecanico", label: "Ingeniero(a) mecánico(a)", title: "Ing.", group: "Ingeniería industrial y de procesos" },
  { id: "imecatronico", label: "Ingeniero(a) mecatrónico(a)", title: "Ing.", group: "Ingeniería industrial y de procesos" },
  { id: "inaval", label: "Ingeniero(a) naval", title: "Ing.", group: "Ingeniería industrial y de procesos" },
  { id: "iaeronautico", label: "Ingeniero(a) aeronáutico(a)", title: "Ing.", group: "Ingeniería industrial y de procesos" },
  { id: "imateriales", label: "Ingeniero(a) de materiales", title: "Ing.", group: "Ingeniería industrial y de procesos" },
  { id: "itextil", label: "Ingeniero(a) textil", title: "Ing.", group: "Ingeniería industrial y de procesos" },
  { id: "ielectrico", label: "Ingeniero(a) electricista", title: "Ing.", group: "Ingeniería eléctrica y de sistemas" },
  { id: "ielectronico", label: "Ingeniero(a) electrónico(a)", title: "Ing.", group: "Ingeniería eléctrica y de sistemas" },
  { id: "itelecom", label: "Ingeniero(a) de telecomunicaciones", title: "Ing.", group: "Ingeniería eléctrica y de sistemas" },
  { id: "isistemas", label: "Ingeniero(a) de sistemas", title: "Ing.", group: "Ingeniería eléctrica y de sistemas" },
  { id: "iinformatico", label: "Ingeniero(a) informático(a)", title: "Ing.", group: "Ingeniería eléctrica y de sistemas" },
  { id: "isoftware", label: "Ingeniero(a) de software", title: "Ing.", group: "Ingeniería eléctrica y de sistemas" },
  { id: "ibiomedico", label: "Ingeniero(a) biomédico(a)", title: "Ing.", group: "Ingeniería eléctrica y de sistemas" },
  { id: "iestadistico", label: "Ingeniero(a) estadístico(a)", title: "Ing.", group: "Otras profesiones técnicas" },
  { id: "icomercial", label: "Ingeniero(a) comercial", title: "Ing.", group: "Otras profesiones técnicas" },
  { id: "ieconomista", label: "Economista", title: "Eco.", group: "Otras profesiones técnicas" },
  { id: "constructor", label: "Constructor(a) civil / técnico(a) en edificación", title: "Tec.", group: "Otras profesiones técnicas" },
  { id: "topografo", label: "Técnico(a) topógrafo(a)", title: "Tec.", group: "Otras profesiones técnicas" },
  { id: "bachiller-civil", label: "Bachiller en Ingeniería Civil", title: "Bach.", group: "Otras profesiones técnicas" },
  { id: "estudiante", label: "Estudiante de ingeniería o arquitectura", title: "", group: "Otras profesiones técnicas" },
  { id: "otro", label: "Otra profesión", title: "", group: "Otras profesiones técnicas" },
];

export const WORKPLACE_ROLES: { id: WorkplaceRoleId; label: string; hint: string }[] = [
  { id: "proyectista", label: "Proyectista / consultor(a)", hint: "Elabora expedientes, memorias y planos." },
  { id: "contratista", label: "Contratista / ejecutor de obra", hint: "Construye, presupuesta y programa la ejecución." },
  { id: "residente", label: "Residente de obra", hint: "Dirige la ejecución en campo." },
  { id: "supervisor", label: "Supervisor(a) / inspector(a)", hint: "Controla calidad, metrados y valorizaciones." },
  { id: "tasador", label: "Tasador(a) / perito", hint: "Valúa inmuebles y emite informes." },
  { id: "gerente", label: "Gerente de proyecto / PMI", hint: "Coordina plazo, costo y alcance." },
  { id: "funcionario", label: "Funcionario(a) público(a)", hint: "Entidad, municipalidad o ministerio." },
  { id: "docente", label: "Docente / investigador(a)", hint: "Universidad, instituto o centro de estudios." },
  { id: "estudiante", label: "Estudiante", hint: "Pregrado, maestría o colegiatura en trámite." },
  { id: "proveedor", label: "Proveedor / comercial", hint: "Materiales, equipos o servicios." },
  { id: "otro", label: "Otro", hint: "Indique su organización si aplica." },
];

type WorkplaceRoleId =
  | "proyectista"
  | "contratista"
  | "residente"
  | "supervisor"
  | "tasador"
  | "funcionario"
  | "docente"
  | "estudiante"
  | "proveedor"
  | "gerente"
  | "otro";

export const PRACTICE_MODES = [
  { id: "independiente", label: "Ejercicio independiente" },
  { id: "empresa", label: "Empresa privada" },
  { id: "estado", label: "Estado / entidad pública" },
  { id: "academia", label: "Universidad o instituto" },
  { id: "ong", label: "ONG / cooperación" },
] as const;

export const INTEREST_RUBROS = [
  { id: "estructuras", label: "Estructuras y edificaciones" },
  { id: "puentes", label: "Puentes" },
  { id: "hidraulica", label: "Hidráulica" },
  { id: "hidrologia", label: "Hidrología" },
  { id: "saneamiento", label: "Agua potable y saneamiento" },
  { id: "geotecnia", label: "Geotecnia y suelos" },
  { id: "viales", label: "Carreteras y caminos" },
  { id: "pavimentos", label: "Pavimentos" },
  { id: "mezclas", label: "Diseño de mezclas" },
  { id: "presupuestos", label: "Presupuestos y APU" },
  { id: "tasaciones", label: "Tasaciones" },
  { id: "topografia", label: "Topografía" },
  { id: "electricas", label: "Instalaciones eléctricas" },
  { id: "electromecanicas", label: "Instalaciones electromecánicas" },
  { id: "mov-tierras", label: "Movimiento de tierras" },
  { id: "interiores", label: "Diseño de interiores" },
  { id: "arquitectura", label: "Arquitectura y urbanismo" },
] as const;

export const CRAFT_FAMILIES: { id: Exclude<CraftFamily, "">; label: string; hint: string }[] = [
  {
    id: "ingeniero",
    label: "Ingeniero(a)",
    hint: "Civil, estructural, sanitario, hidráulico, geotécnico y demás ramas.",
  },
  {
    id: "arquitecto",
    label: "Arquitecto(a)",
    hint: "Arquitectura, urbanismo o paisaje.",
  },
  {
    id: "interiores",
    label: "Diseñador(a) de interiores",
    hint: "Acondicionamiento interior, mobiliario y ambientación.",
  },
  {
    id: "otro",
    label: "Otro",
    hint: "Técnico, estudiante, constructor, economista u otra profesión.",
  },
];

export function professionsForFamily(family: CraftFamily): Profession[] {
  if (family === "interiores") return PROFESSIONS.filter((p) => p.id === "arq-interiores");
  if (family === "arquitecto") {
    return PROFESSIONS.filter((p) => p.group === "Arquitectura y urbanismo" && p.id !== "arq-interiores");
  }
  if (family === "ingeniero") {
    return PROFESSIONS.filter((p) => p.group.startsWith("Ingeniería"));
  }
  if (family === "otro") {
    return PROFESSIONS.filter((p) => p.group === "Otras profesiones técnicas" || p.id === "otro");
  }
  return PROFESSIONS;
}

export function craftFamilyOfProfession(id: string): CraftFamily {
  if (id === "arq-interiores") return "interiores";
  const p = professionById(id);
  if (!p) return "";
  if (p.group === "Arquitectura y urbanismo") return "arquitecto";
  if (p.group.startsWith("Ingeniería")) return "ingeniero";
  return "otro";
}

export function professionById(id: string): Profession | undefined {
  return PROFESSIONS.find((p) => p.id === id);
}
