import { CATEGORIA_MINSA_META, type CategoriaMinsa } from "./categoriasMinsa";

export type AmbientePrograma = {
  upss: string;
  ambiente: string;
  n: number;
  areaUnd: number;
  nota: string;
};

export type ProgramaMinsa = {
  categoria: CategoriaMinsa;
  camas: number;
  consultorios: number;
  quirófanos: number;
  salasParto: number;
  cubiculosUci: number;
  ambientes: AmbientePrograma[];
};

function a(upss: string, ambiente: string, n: number, areaUnd: number, nota = ""): AmbientePrograma {
  return { upss, ambiente, n, areaUnd, nota };
}

function circ(techada: number, ambientes: AmbientePrograma[]): AmbientePrograma {
  const neto = ambientes.reduce((s, x) => s + x.n * x.areaUnd, 0);
  const resto = Math.max(0, Math.round((techada - neto) * 10) / 10);
  return a("Circulación", "Circulación, muros, ductos y vestíbulos", 1, resto, "Cierre a área techada de la plantilla (≈ 28–40 %).");
}

/** Programa tipo expediente MINSA / DGIEM. Semilla de metrados, no un hospital concreto. */
export const PROGRAMA_MINSA: Record<CategoriaMinsa, ProgramaMinsa> = {
  "I-1": {
    categoria: "I-1",
    camas: 0,
    consultorios: 1,
    quirófanos: 0,
    salasParto: 0,
    cubiculosUci: 0,
    ambientes: (() => {
      const x = [
        a("Admisión", "Espera / admisión", 1, 22, "Banca + ventanilla. Sin archivo clínico grande."),
        a("Consulta externa", "Consultorio / tópico", 1, 16, "Un solo ambiente polivalente."),
        a("Apoyo", "SS.HH. público PMR", 1, 5.5, "A.040 / NTS 110."),
        a("Apoyo", "SS.HH. personal", 1, 3.5, ""),
        a("Apoyo", "Depósito / botiquín", 1, 8, "Sin farmacia hospitalaria."),
        a("Administración", "Oficina / archivo", 1, 9, ""),
        a("Apoyo", "Cuarto de aseo y residuos", 1, 4, ""),
      ];
      return [...x, circ(140, x)];
    })(),
  },
  "I-2": {
    categoria: "I-2",
    camas: 0,
    consultorios: 2,
    quirófanos: 0,
    salasParto: 0,
    cubiculosUci: 0,
    ambientes: (() => {
      const x = [
        a("Admisión", "Espera / admisión", 1, 32, ""),
        a("Consulta externa", "Consultorio médico", 1, 16, "Médico cirujano."),
        a("Consulta externa", "Consultorio enfermería / obstétrica", 1, 14, ""),
        a("Consulta externa", "Tópico / observación breve", 1, 14, "Sin internamiento 24 h."),
        a("Apoyo", "SS.HH. público PMR", 2, 5, ""),
        a("Apoyo", "SS.HH. personal", 1, 4, ""),
        a("Apoyo", "Farmacia / botiquín", 1, 10, ""),
        a("Administración", "Jefatura / archivo", 1, 12, ""),
        a("Apoyo", "Residuos y aseo", 1, 5, ""),
      ];
      return [...x, circ(320, x)];
    })(),
  },
  "I-3": {
    categoria: "I-3",
    camas: 0,
    consultorios: 5,
    quirófanos: 0,
    salasParto: 0,
    cubiculosUci: 0,
    ambientes: (() => {
      const x = [
        a("Admisión", "Espera / admisión / caja", 1, 48, ""),
        a("Consulta externa", "Consultorio medicina", 2, 16, ""),
        a("Consulta externa", "Consultorio materno-infantil", 1, 16, ""),
        a("Consulta externa", "Consultorio odontología", 1, 14, "Sillón dental."),
        a("Consulta externa", "Tópico", 1, 16, ""),
        a("Patología clínica", "Toma de muestras / laboratorio básico", 1, 22, "Propio o tercerizado."),
        a("Apoyo", "Farmacia", 1, 16, ""),
        a("Apoyo", "SS.HH. público PMR", 4, 5, ""),
        a("Apoyo", "SS.HH. personal", 2, 4, ""),
        a("Administración", "Jefatura, estadística y archivo", 1, 28, ""),
        a("Apoyo", "Almacén / residuos / aseo", 1, 18, ""),
      ];
      return [...x, circ(980, x)];
    })(),
  },
  "I-4": {
    categoria: "I-4",
    camas: 12,
    consultorios: 8,
    quirófanos: 0,
    salasParto: 1,
    cubiculosUci: 0,
    ambientes: (() => {
      const x = [
        a("Admisión", "Espera / admisión", 1, 70, ""),
        a("Consulta externa", "Consultorios", 6, 16, "Medicina, GO, pediatría, odontología."),
        a("Consulta externa", "Tópico / curaciones", 1, 18, ""),
        a("Emergencia", "Observación / shock breve", 1, 28, "No es emergencia hospitalaria 24 h de II-1."),
        a("Internamiento", "Habitación 2 camas", 6, 22, "12 camas de internamiento limitado."),
        a("Centro obstétrico", "Sala de partos + prep", 1, 36, "Sin centro quirúrgico de hospital."),
        a("Patología clínica", "Laboratorio", 1, 32, ""),
        a("Farmacia", "Farmacia hospitalaria", 1, 24, ""),
        a("Apoyo", "SS.HH. público / paciente", 10, 5, ""),
        a("Apoyo", "SS.HH. personal", 4, 4, ""),
        a("Administración", "Jefatura, admisión, archivo", 1, 48, ""),
        a("Apoyo", "Cocina / office / residuos", 1, 40, ""),
        a("Central de esterilización", "Esterilización básica", 1, 18, ""),
      ];
      return [...x, circ(1850, x)];
    })(),
  },
  "II-1": {
    categoria: "II-1",
    camas: 60,
    consultorios: 16,
    quirófanos: 2,
    salasParto: 2,
    cubiculosUci: 0,
    ambientes: (() => {
      const x = [
        a("Admisión", "Hall / admisión / caja", 1, 140, ""),
        a("Consulta externa", "Consultorios", 16, 16, "4 especialidades básicas."),
        a("Emergencia", "Shock, tópico, observación", 1, 180, "24 h."),
        a("Hospitalización", "Habitación 2 camas", 30, 22, "60 camas."),
        a("Centro obstétrico", "Sala de partos", 2, 32, ""),
        a("Centro quirúrgico", "Quirófano", 2, 42, "Sin UCI completa."),
        a("Centro quirúrgico", "Recuperación / preparación", 1, 48, ""),
        a("Diagnóstico por imágenes", "Rayos X / ecografía", 1, 70, "Sin TAC."),
        a("Patología clínica", "Laboratorio", 1, 80, ""),
        a("Banco de sangre", "Hemoterapia", 1, 40, ""),
        a("Farmacia", "Farmacia central", 1, 50, ""),
        a("Nutrición", "Cocina dietética", 1, 70, ""),
        a("Central de esterilización", "CEYE", 1, 45, ""),
        a("Rehabilitación", "Terapia física", 1, 50, ""),
        a("Apoyo", "SS.HH. / vestuarios", 24, 5, ""),
        a("Administración", "Oficinas y archivo", 1, 120, ""),
      ];
      return [...x, circ(5600, x)];
    })(),
  },
  "II-2": {
    categoria: "II-2",
    camas: 120,
    consultorios: 24,
    quirófanos: 4,
    salasParto: 2,
    cubiculosUci: 8,
    ambientes: (() => {
      const x = [
        a("Admisión", "Hall / admisión", 1, 200, ""),
        a("Consulta externa", "Consultorios", 24, 16, ""),
        a("Emergencia", "Shock, tópico, observación", 1, 280, ""),
        a("Hospitalización", "Habitación 2 camas", 60, 22, "120 camas."),
        a("UCI", "Cubículo UCI", 8, 20, "Primera UCI de la categoría."),
        a("Centro obstétrico", "Sala de partos", 2, 36, ""),
        a("Centro quirúrgico", "Quirófano", 4, 42, ""),
        a("Centro quirúrgico", "Recuperación / CEYE sucio-limpio", 1, 90, ""),
        a("Diagnóstico por imágenes", "Rayos X / TAC / arco en C", 1, 160, ""),
        a("Patología clínica", "Laboratorio", 1, 110, ""),
        a("Banco de sangre", "Hemoterapia", 1, 55, ""),
        a("Farmacia", "Farmacia central", 1, 70, ""),
        a("Nutrición", "Cocina dietética", 1, 90, ""),
        a("Gases medicinales", "Central de gases / PSA", 1, 40, ""),
        a("Rehabilitación", "Terapia", 1, 70, ""),
        a("Apoyo", "SS.HH. / vestuarios", 36, 5, ""),
        a("Administración", "Oficinas", 1, 180, ""),
      ];
      return [...x, circ(9800, x)];
    })(),
  },
  "II-E": {
    categoria: "II-E",
    camas: 50,
    consultorios: 14,
    quirófanos: 2,
    salasParto: 0,
    cubiculosUci: 4,
    ambientes: (() => {
      const x = [
        a("Admisión", "Hall especializado", 1, 120, "Perfil del instituto (materno, oncológico, etc.)."),
        a("Consulta externa", "Consultorios de la especialidad", 14, 16, ""),
        a("Hospitalización", "Habitación 2 camas", 25, 24, "50 camas del perfil."),
        a("UCI", "Cubículo UCI del perfil", 4, 22, ""),
        a("Centro quirúrgico", "Quirófano de la especialidad", 2, 44, "Si el perfil opera."),
        a("Apoyo diagnóstico", "Imágenes / laboratorio del perfil", 1, 140, ""),
        a("Emergencia", "Emergencia del perfil", 1, 90, ""),
        a("Apoyo", "Farmacia / CEYE / office", 1, 80, ""),
        a("Apoyo", "SS.HH. / vestuarios", 16, 5, ""),
        a("Administración", "Oficinas y docencia básica", 1, 80, ""),
      ];
      return [...x, circ(6200, x)];
    })(),
  },
  "III-1": {
    categoria: "III-1",
    camas: 240,
    consultorios: 40,
    quirófanos: 8,
    salasParto: 3,
    cubiculosUci: 16,
    ambientes: (() => {
      const x = [
        a("Admisión", "Hall / admisión / referencia", 1, 320, "Hospital nacional / regional."),
        a("Consulta externa", "Consultorios", 40, 16, ""),
        a("Emergencia", "Shock, tópico, observación, trauma", 1, 480, ""),
        a("Hospitalización", "Habitación 2 camas", 120, 22, "240 camas."),
        a("UCI", "Cubículo UCI", 16, 22, ""),
        a("Centro obstétrico", "Sala de partos", 3, 36, ""),
        a("Centro quirúrgico", "Quirófano", 8, 44, ""),
        a("Centro quirúrgico", "Recuperación / CEYE", 1, 180, ""),
        a("Diagnóstico por imágenes", "RX / TAC / RM", 1, 320, ""),
        a("Patología clínica", "Laboratorio de alta complejidad", 1, 200, ""),
        a("Banco de sangre", "Hemoterapia", 1, 90, ""),
        a("Farmacia", "Farmacia central", 1, 110, ""),
        a("Nutrición", "Cocina dietética", 1, 140, ""),
        a("Gases medicinales", "PSA / centrales", 1, 70, ""),
        a("Rehabilitación", "Terapia", 1, 120, ""),
        a("Apoyo", "SS.HH. / vestuarios", 60, 5, ""),
        a("Administración", "Oficinas, docencia, archivo", 1, 280, ""),
      ];
      return [...x, circ(18500, x)];
    })(),
  },
  "III-E": {
    categoria: "III-E",
    camas: 160,
    consultorios: 28,
    quirófanos: 6,
    salasParto: 0,
    cubiculosUci: 12,
    ambientes: (() => {
      const x = [
        a("Admisión", "Hall del instituto", 1, 240, "Especialidad eje (cardiología, cáncer, etc.)."),
        a("Consulta externa", "Consultorios de subespecialidad", 28, 16, ""),
        a("Hospitalización", "Habitación 2 camas", 80, 24, "160 camas."),
        a("UCI", "Cubículo UCI del perfil", 12, 22, ""),
        a("Centro quirúrgico", "Quirófano de alta complejidad", 6, 46, ""),
        a("Apoyo diagnóstico", "Imágenes y laboratorio de instituto", 1, 360, ""),
        a("Docencia", "Aulas / simulación", 1, 160, ""),
        a("Apoyo", "Farmacia / CEYE / gases", 1, 180, ""),
        a("Apoyo", "SS.HH. / vestuarios", 40, 5, ""),
        a("Administración", "Oficinas e investigación", 1, 200, ""),
      ];
      return [...x, circ(14000, x)];
    })(),
  },
  "III-2": {
    categoria: "III-2",
    camas: 320,
    consultorios: 48,
    quirófanos: 12,
    salasParto: 0,
    cubiculosUci: 24,
    ambientes: (() => {
      const x = [
        a("Admisión", "Hall nacional / referencia", 1, 400, "INEN, INCOR u homólogo."),
        a("Consulta externa", "Consultorios", 48, 16, ""),
        a("Hospitalización", "Habitación 2 camas", 160, 22, "320 camas."),
        a("UCI", "Cubículo UCI", 24, 22, ""),
        a("Centro quirúrgico", "Quirófano", 12, 46, ""),
        a("Centro quirúrgico", "Recuperación / CEYE", 1, 260, ""),
        a("Diagnóstico por imágenes", "RX / TAC / RM / medicina nuclear*", 1, 480, "*Solo si el plano o el perfil lo dibuja."),
        a("Docencia e investigación", "Aulas, laboratorio docente, hemeroteca", 1, 320, ""),
        a("Apoyo", "Farmacia / cocina / gases / residuos", 1, 280, ""),
        a("Apoyo", "SS.HH. / vestuarios", 80, 5, ""),
        a("Administración", "Dirección, archivo, patrimonio", 1, 360, ""),
      ];
      return [...x, circ(26000, x)];
    })(),
  },
};

export function areaPrograma(p: ProgramaMinsa) {
  return p.ambientes.reduce((s, a) => s + a.n * a.areaUnd, 0);
}

export function textoPrograma(cat: CategoriaMinsa) {
  const p = PROGRAMA_MINSA[cat];
  const m = CATEGORIA_MINSA_META[cat];
  return [
    `${m.nombre}. ${m.norma}.`,
    `Programa semilla: ${p.consultorios} consultorio(s), ${p.camas} cama(s), ${p.quirófanos} quirófano(s), ${p.salasParto} sala(s) de partos, ${p.cubiculosUci} cubículo(s) UCI.`,
    `Área de ambientes + circulación = ${areaPrograma(p).toLocaleString("es-PE")} m² (cierra con el área techada de la plantilla).`,
    "El plano manda. Si un ambiente no existe en obra, se anula el metrado; no se rellena con otra categoría.",
  ];
}
