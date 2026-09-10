import type { Insumo, Partida, RecursoKind } from "./types";
import { p, r } from "./partidaBuilder";
import type { CategoriaMinsa } from "./categoriasMinsa";

/** Tipo de dotación del expediente (no mezclar con obra civil). */
export type TipoDotacion = "equipo" | "maquinaria" | "mobiliario" | "utensilio" | "herramienta" | "expediente";

type Row = {
  codigo: string;
  nombre: string;
  und: string;
  precio: number;
  mo: number;
  tipo: TipoDotacion;
  capitulo: string;
  upss: string;
  ambiente: string;
  desde: CategoriaMinsa;
  qty: number;
  escala: boolean;
};

const TIPO_LABEL: Record<TipoDotacion, string> = {
  equipo: "equipo",
  maquinaria: "maquinaria",
  mobiliario: "mobiliario",
  utensilio: "utensilio",
  herramienta: "herramienta",
  expediente: "partida de expediente",
};

function e(
  codigo: string,
  nombre: string,
  precio: number,
  mo: number,
  tipo: TipoDotacion,
  capitulo: string,
  upss: string,
  ambiente: string,
  desde: CategoriaMinsa,
  qty = 1,
  escala = false,
  und = "und",
): Row {
  return { codigo, nombre, und, precio, mo, tipo, capitulo, upss, ambiente, desde, qty, escala };
}

const ROWS: Row[] = [
  e("EQ-GG-001", "Movilización y desmovilización del contratista de equipamiento", 8500, 16, "expediente", "00 Gastos generales de la dotación", "Expediente", "Obra / almacén de equipos", "I-1", 1, false, "glb"),
  e("EQ-GG-002", "Transporte nacional, embalaje y seguro de equipos", 12500, 8, "expediente", "00 Gastos generales de la dotación", "Expediente", "Origen–obra", "I-1", 1, false, "glb"),
  e("EQ-GG-003", "Instalación, anclaje sísmico y conexiones de la dotación", 9800, 24, "expediente", "00 Gastos generales de la dotación", "Expediente", "Ambientes de UPSS", "I-1", 1, false, "glb"),
  e("EQ-GG-004", "Capacitación al personal asistencial y de mantenimiento", 4200, 16, "expediente", "00 Gastos generales de la dotación", "Expediente", "Sala de capacitación", "I-1", 1, false, "glb"),
  e("EQ-GG-005", "Pruebas, protocolos de aceptación y puesta en marcha", 5600, 20, "expediente", "00 Gastos generales de la dotación", "Expediente", "Ambientes de UPSS", "I-1", 1, false, "glb"),
  e("EQ-GG-006", "Manuales, garantías, as-built y registro patrimonial", 2800, 10, "expediente", "00 Gastos generales de la dotación", "Expediente", "Administración", "I-1", 1, false, "glb"),
  e("EQ-GG-007", "Retiro de embalajes y limpieza de ambientes de montaje", 1800, 12, "expediente", "00 Gastos generales de la dotación", "Expediente", "Ambientes de UPSS", "I-1", 1, false, "glb"),
  e("EQ-GG-008", "Señalética, rotulado y códigos de patrimonio de equipos", 1600, 8, "expediente", "00 Gastos generales de la dotación", "Expediente", "Ambientes de UPSS", "I-1", 1, false, "glb"),

  e("EQ-ME-001", "Camilla clínica", 980, 1, "equipo", "01 Mobiliario y equipos clínicos", "Consulta externa", "Consultorio", "I-1", 2, true),
  e("EQ-ME-002", "Cama hospitalaria mecánica", 3200, 3, "equipo", "01 Mobiliario y equipos clínicos", "Hospitalización", "Habitación", "I-4", 8, true),
  e("EQ-ME-003", "Cama eléctrica hospitalaria 3 funciones", 8500, 4, "equipo", "01 Mobiliario y equipos clínicos", "Hospitalización", "Habitación", "I-4", 4, true),
  e("EQ-ME-004", "Camilla de transporte", 1450, 1, "equipo", "01 Mobiliario y equipos clínicos", "Consulta externa", "Pasillo / tópico", "I-1", 1, true),
  e("EQ-ME-005", "Camilla de emergencia", 2800, 2, "equipo", "01 Mobiliario y equipos clínicos", "Emergencia", "Shock trauma", "I-4", 2, true),
  e("EQ-ME-006", "Mesa de operaciones / quirúrgica", 32000, 10, "equipo", "01 Mobiliario y equipos clínicos", "Centro quirúrgico", "Quirófano", "II-1", 1, true),
  e("EQ-ME-007", "Mesa Mayo", 420, 1, "equipo", "01 Mobiliario y equipos clínicos", "Centro quirúrgico", "Quirófano", "I-4", 2, true),
  e("EQ-ME-008", "Mesa auxiliar hospitalaria", 380, 1, "equipo", "01 Mobiliario y equipos clínicos", "Hospitalización", "Habitación", "I-4", 4, true),
  e("EQ-ME-009", "Mesa de examen", 980, 1, "equipo", "01 Mobiliario y equipos clínicos", "Consulta externa", "Consultorio", "I-1", 2, true),
  e("EQ-ME-010", "Mesa ginecológica", 3200, 3, "equipo", "01 Mobiliario y equipos clínicos", "Consulta externa", "Consultorio GO", "I-2", 1, true),
  e("EQ-ME-011", "Silla de ruedas", 650, 1, "equipo", "01 Mobiliario y equipos clínicos", "Consulta externa", "Admisión / pasillo", "I-1", 1, true),
  e("EQ-ME-012", "Silla de ruedas para ducha", 780, 1, "equipo", "01 Mobiliario y equipos clínicos", "Hospitalización", "SS.HH. paciente", "I-4", 2, true),
  e("EQ-ME-013", "Andador", 180, 0.4, "equipo", "01 Mobiliario y equipos clínicos", "Rehabilitación", "Sala de terapia", "I-3", 2, true),
  e("EQ-ME-014", "Muletas (par)", 85, 0.3, "equipo", "01 Mobiliario y equipos clínicos", "Rehabilitación", "Sala de terapia", "I-3", 2, true),
  e("EQ-ME-015", "Bastón", 45, 0.2, "equipo", "01 Mobiliario y equipos clínicos", "Rehabilitación", "Sala de terapia", "I-3", 2, true),
  e("EQ-ME-016", "Cama de UCI con colchón antiescaras", 18500, 6, "equipo", "01 Mobiliario y equipos clínicos", "UCI", "Cubículo UCI", "II-2", 4, true),
  e("EQ-ME-017", "Cama pediátrica / cuna hospitalaria", 6200, 3, "equipo", "01 Mobiliario y equipos clínicos", "Hospitalización", "Habitación pediátrica", "I-4", 2, true),
  e("EQ-ME-018", "Camilla de curaciones", 1850, 2, "equipo", "01 Mobiliario y equipos clínicos", "Consulta externa", "Tópico", "I-1", 1, true),
  e("EQ-ME-019", "Camilla gineco-obstétrica de partos", 8500, 4, "equipo", "01 Mobiliario y equipos clínicos", "Centro obstétrico", "Sala de partos", "I-4", 1, true),
  e("EQ-ME-020", "Silla de espera para acompañante", 220, 0.3, "mobiliario", "01 Mobiliario y equipos clínicos", "Consulta externa", "Sala de espera", "I-1", 6, true),
  e("EQ-ME-021", "Biombo hospitalario de 3 cuerpos", 380, 1, "equipo", "01 Mobiliario y equipos clínicos", "Consulta externa", "Consultorio", "I-1", 2, true),
  e("EQ-ME-022", "Porta suero de 4 ganchos", 160, 0.4, "equipo", "01 Mobiliario y equipos clínicos", "Hospitalización", "Habitación", "I-4", 6, true),
  e("EQ-ME-023", "Escalera de 2 peldaños clínica", 95, 0.3, "equipo", "01 Mobiliario y equipos clínicos", "Consulta externa", "Consultorio", "I-1", 2, true),
  e("EQ-ME-024", "Hamaca / camilla de yeso", 1450, 1, "equipo", "01 Mobiliario y equipos clínicos", "Emergencia", "Sala de procedimientos", "II-1", 1, true),
  e("EQ-ME-025", "Cama bariátrica", 14500, 6, "equipo", "01 Mobiliario y equipos clínicos", "Hospitalización", "Habitación", "II-2", 1, true),

  e("MO-ME-001", "Escritorio clínico", 480, 1, "mobiliario", "01 Mobiliario y equipos clínicos", "Consulta externa", "Consultorio", "I-1", 2, true),
  e("MO-ME-002", "Sillón de médico", 280, 0.5, "mobiliario", "01 Mobiliario y equipos clínicos", "Consulta externa", "Consultorio", "I-1", 2, true),
  e("MO-ME-003", "Banqueta de paciente", 95, 0.3, "mobiliario", "01 Mobiliario y equipos clínicos", "Consulta externa", "Consultorio", "I-1", 2, true),
  e("MO-ME-004", "Vitrina clínica con llave", 980, 1, "mobiliario", "01 Mobiliario y equipos clínicos", "Consulta externa", "Consultorio", "I-1", 1, true),
  e("MO-ME-005", "Mueble de curaciones", 1250, 2, "mobiliario", "01 Mobiliario y equipos clínicos", "Consulta externa", "Tópico", "I-1", 1, true),
  e("MO-ME-006", "Velador hospitalario", 220, 0.5, "mobiliario", "01 Mobiliario y equipos clínicos", "Hospitalización", "Habitación", "I-4", 8, true),
  e("MO-ME-007", "Ropero de paciente", 380, 1, "mobiliario", "01 Mobiliario y equipos clínicos", "Hospitalización", "Habitación", "I-4", 8, true),
  e("MO-ME-008", "Sofá de acompañante", 650, 1, "mobiliario", "01 Mobiliario y equipos clínicos", "Hospitalización", "Habitación", "I-4", 4, true),
  e("MO-CX-001", "Módulo de admisión / ventanilla", 1850, 3, "mobiliario", "01 Mobiliario y equipos clínicos", "Consulta externa", "Admisión", "I-1", 1, true),
  e("MO-CX-002", "Archivador clínico 4 gavetas", 720, 1, "mobiliario", "01 Mobiliario y equipos clínicos", "Consulta externa", "Archivo", "I-1", 1, true),
  e("MO-CX-003", "Banca de espera 3 cuerpos", 480, 1, "mobiliario", "01 Mobiliario y equipos clínicos", "Consulta externa", "Sala de espera", "I-1", 3, true),

  e("EQ-DX-001", "Ecógrafo / ultrasonido", 48000, 8, "equipo", "02 Diagnóstico por imágenes", "Diagnóstico por imágenes", "Sala de ecografía", "I-3", 1, true),
  e("EQ-DX-002", "Equipo de rayos X fijo", 145000, 24, "equipo", "02 Diagnóstico por imágenes", "Diagnóstico por imágenes", "Sala de RX", "II-1", 1, false),
  e("EQ-DX-003", "Equipo de rayos X portátil", 62000, 10, "equipo", "02 Diagnóstico por imágenes", "Diagnóstico por imágenes", "Hospitalización / emergencia", "I-4", 1, true),
  e("EQ-DX-004", "Mamógrafo", 220000, 20, "equipo", "02 Diagnóstico por imágenes", "Diagnóstico por imágenes", "Sala de mama", "II-2", 1, false),
  e("EQ-DX-005", "Tomógrafo computarizado", 980000, 40, "equipo", "02 Diagnóstico por imágenes", "Diagnóstico por imágenes", "Sala de TAC", "II-2", 1, false),
  e("EQ-DX-006", "Resonador magnético", 2800000, 60, "equipo", "02 Diagnóstico por imágenes", "Diagnóstico por imágenes", "Sala de RM", "III-1", 1, false),
  e("EQ-DX-007", "Arco en C", 185000, 16, "equipo", "02 Diagnóstico por imágenes", "Centro quirúrgico", "Quirófano", "II-2", 1, false),
  e("EQ-DX-008", "Densitómetro óseo", 85000, 10, "equipo", "02 Diagnóstico por imágenes", "Diagnóstico por imágenes", "Sala de densitometría", "III-1", 1, false),
  e("EQ-DX-009", "Electrocardiógrafo de 12 derivaciones", 9800, 4, "equipo", "02 Diagnóstico por imágenes", "Consulta externa", "Consultorio / tópico", "I-2", 1, true),
  e("EQ-DX-010", "Holter de 24 h", 6500, 2, "equipo", "02 Diagnóstico por imágenes", "Consulta externa", "Cardiología", "II-1", 1, true),
  e("EQ-DX-011", "Espirómetro", 4200, 2, "equipo", "02 Diagnóstico por imágenes", "Consulta externa", "Consultorio", "I-3", 1, true),
  e("EQ-DX-012", "Monitor multiparámetro", 18500, 6, "equipo", "02 Diagnóstico por imágenes", "Emergencia", "Observación / UCI", "I-3", 2, true),
  e("EQ-DX-013", "Pulsioxímetro de dedo / mesa", 850, 0.5, "equipo", "02 Diagnóstico por imágenes", "Consulta externa", "Consultorio / tópico", "I-1", 2, true),
  e("EQ-DX-014", "Doppler fetal", 1450, 1, "equipo", "02 Diagnóstico por imágenes", "Consulta externa", "Consultorio GO", "I-2", 1, true),
  e("EQ-DX-015", "Electroencefalógrafo", 28000, 8, "equipo", "02 Diagnóstico por imágenes", "Consulta externa", "Neurología", "II-2", 1, false),
  e("EQ-DX-016", "Negatoscopio LED", 650, 1, "equipo", "02 Diagnóstico por imágenes", "Diagnóstico por imágenes", "Sala de lectura", "I-4", 2, true),
  e("EQ-DX-017", "Ecógrafo portátil de emergencia", 18500, 4, "equipo", "02 Diagnóstico por imágenes", "Emergencia", "Shock trauma", "II-1", 1, true),
  e("EQ-DX-018", "Prueba de esfuerzo / ergómetro", 22000, 8, "equipo", "02 Diagnóstico por imágenes", "Consulta externa", "Cardiología", "II-2", 1, false),
  e("EQ-DX-019", "Audiómetro", 6800, 3, "equipo", "02 Diagnóstico por imágenes", "Consulta externa", "Otorrino", "I-3", 1, true),
  e("EQ-DX-020", "Lámpara de hendidura", 14500, 4, "equipo", "02 Diagnóstico por imágenes", "Consulta externa", "Oftalmología", "I-3", 1, true),

  e("EQ-EM-001", "Desfibrilador / cardiodesfibrilador", 22000, 6, "equipo", "03 Emergencia y UCI", "Emergencia", "Shock trauma", "I-4", 1, true),
  e("EQ-EM-002", "Carro de paro / crash cart", 2800, 2, "equipo", "03 Emergencia y UCI", "Emergencia", "Shock trauma", "I-3", 1, true),
  e("EQ-EM-003", "Ventilador mecánico de UCI", 68000, 10, "equipo", "03 Emergencia y UCI", "UCI", "Cubículo UCI", "II-2", 2, true),
  e("EQ-EM-004", "Aspirador de secreciones", 1800, 2, "equipo", "03 Emergencia y UCI", "Emergencia", "Tópico / observación", "I-1", 1, true),
  e("EQ-EM-005", "Monitor multiparámetro de UCI", 22000, 6, "equipo", "03 Emergencia y UCI", "UCI", "Cubículo UCI", "II-2", 4, true),
  e("EQ-EM-006", "Electrocardiógrafo de emergencia", 9800, 4, "equipo", "03 Emergencia y UCI", "Emergencia", "Shock trauma", "I-4", 1, true),
  e("EQ-EM-007", "Bomba de infusión volumétrica", 4200, 2, "equipo", "03 Emergencia y UCI", "UCI", "Cubículo UCI", "I-4", 4, true),
  e("EQ-EM-008", "Bomba de jeringa", 3800, 2, "equipo", "03 Emergencia y UCI", "UCI", "Cubículo UCI", "II-2", 4, true),
  e("EQ-EM-009", "Incubadora neonatal", 28000, 8, "equipo", "03 Emergencia y UCI", "Neonatología", "UCIN", "II-1", 2, true),
  e("EQ-EM-010", "Cuna térmica / servocuna", 22000, 6, "equipo", "03 Emergencia y UCI", "Neonatología", "Sala de partos / UCIN", "II-1", 2, true),
  e("EQ-EM-011", "Lámpara cialítica de emergencia", 4800, 3, "equipo", "03 Emergencia y UCI", "Emergencia", "Sala de procedimientos", "I-4", 1, true),
  e("EQ-EM-012", "Camilla de emergencia con ruedas", 2800, 2, "equipo", "03 Emergencia y UCI", "Emergencia", "Admisión de emergencia", "I-4", 2, true),
  e("EQ-EM-013", "Monitor desfibrilador", 28000, 8, "equipo", "03 Emergencia y UCI", "Emergencia", "Shock trauma", "II-1", 1, true),
  e("EQ-EM-014", "Aspirador quirúrgico de emergencia", 3800, 3, "equipo", "03 Emergencia y UCI", "Emergencia", "Sala de procedimientos", "II-1", 1, true),
  e("EQ-EM-015", "Humidificador de oxígeno", 280, 0.5, "equipo", "03 Emergencia y UCI", "Emergencia", "Observación", "I-1", 2, true),
  e("EQ-EM-016", "Ventilador de transporte", 42000, 8, "equipo", "03 Emergencia y UCI", "Emergencia", "Ambulancia / shock", "II-1", 1, true),
  e("EQ-EM-017", "Laringoscopio set adulto/pediátrico", 950, 1, "equipo", "03 Emergencia y UCI", "Emergencia", "Carro de paro", "I-2", 1, true),
  e("EQ-EM-018", "Concentrador de oxígeno 10 L/min", 4200, 3, "equipo", "03 Emergencia y UCI", "Emergencia", "Observación", "I-2", 1, true),
  e("EQ-EM-019", "Equipo de oxigenoterapia (flujómetro + humidificador)", 420, 1, "equipo", "03 Emergencia y UCI", "Emergencia", "Observación", "I-1", 2, true),
  e("EQ-EM-020", "Collar cervical / inmovilizador set", 180, 0.3, "utensilio", "03 Emergencia y UCI", "Emergencia", "Shock trauma", "I-2", 2, true),

  e("EQ-CQ-001", "Mesa quirúrgica hidráulica", 32000, 10, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 1, true),
  e("EQ-CQ-002", "Lámpara quirúrgica de techo", 24000, 8, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 1, true),
  e("EQ-CQ-003", "Máquina de anestesia", 85000, 16, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 1, true),
  e("EQ-CQ-004", "Electrobisturí", 14500, 4, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 1, true),
  e("EQ-CQ-005", "Torre laparoscópica", 185000, 16, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-2", 1, false),
  e("EQ-CQ-006", "Torre de endoscopia", 145000, 14, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Sala de endoscopía", "II-2", 1, false),
  e("EQ-CQ-007", "Aspirador quirúrgico", 3800, 3, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 2, true),
  e("EQ-CQ-008", "Arco en C de quirófano", 185000, 16, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-2", 1, false),
  e("EQ-CQ-009", "Monitor multiparámetro de anestesia", 22000, 6, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 1, true),
  e("EQ-CQ-010", "Calentador de fluidos", 4800, 2, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 1, true),
  e("EQ-CQ-011", "Manta térmica", 1850, 1, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 2, true),
  e("EQ-CQ-012", "Lavador ultrasónico", 8500, 4, "equipo", "04 Centro quirúrgico", "CEyE", "Área sucia", "II-1", 1, true),
  e("EQ-CQ-013", "Esterilizador de instrumental de mesa", 9800, 4, "equipo", "04 Centro quirúrgico", "CEyE", "Esterilización", "I-4", 1, true),
  e("EQ-CQ-014", "Mesa de instrumental", 680, 1, "mobiliario", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 2, true),
  e("EQ-CQ-015", "Mesa Mayo de quirófano", 420, 1, "mobiliario", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 2, true),
  e("EQ-CQ-016", "Lámpara quirúrgica de pedestal", 8500, 4, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano de emergencia", "I-4", 1, true),
  e("EQ-CQ-017", "Bomba de infusión de quirófano", 4200, 2, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 2, true),
  e("EQ-CQ-018", "Desfibrilador de quirófano", 22000, 6, "equipo", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 1, true),
  e("MO-CQ-001", "Banqueta de cirujano", 280, 0.5, "mobiliario", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 3, true),
  e("MO-CQ-002", "Porta cubetas / riñonera de pie", 160, 0.4, "mobiliario", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 2, true),
  e("MO-CQ-003", "Reloj de pared clínico", 85, 0.2, "mobiliario", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 1, true),
  e("MO-CQ-004", "Pizarra de conteo de gasas", 220, 0.5, "mobiliario", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 1, true),
  e("MO-CQ-005", "Perchero de bata / calzado de área", 180, 0.4, "mobiliario", "04 Centro quirúrgico", "Centro quirúrgico", "Vestidores", "II-1", 2, true),
  e("MO-CQ-006", "Mueble de anestesia", 1850, 2, "mobiliario", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 1, true),
  e("MO-CQ-007", "Carro de lencería quirúrgica", 680, 1, "mobiliario", "04 Centro quirúrgico", "Centro quirúrgico", "Área limpia", "II-1", 1, true),
  e("MO-CQ-008", "Mesa de preparación de paciente", 980, 1, "mobiliario", "04 Centro quirúrgico", "Centro quirúrgico", "Pre-anestesia", "II-1", 1, true),
  e("UT-CQ-001", "Set de instrumental de cirugía general", 2800, 1, "utensilio", "04 Centro quirúrgico", "Centro quirúrgico", "CEyE / quirófano", "II-1", 2, true),
  e("UT-CQ-002", "Set de instrumental de cesárea", 2200, 1, "utensilio", "04 Centro quirúrgico", "Centro obstétrico", "Sala de partos", "I-4", 1, true),
  e("UT-CQ-003", "Set de curación estéril", 180, 0.3, "utensilio", "04 Centro quirúrgico", "Consulta externa", "Tópico", "I-1", 6, true),
  e("UT-CQ-004", "Riñonera de acero inoxidable", 45, 0.2, "utensilio", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "I-4", 6, true),
  e("UT-CQ-005", "Cubeta de instrumental con tapa", 65, 0.2, "utensilio", "04 Centro quirúrgico", "CEyE", "Empaque", "I-4", 8, true),
  e("UT-CQ-006", "Porta agujas / pinzas set básico", 220, 0.3, "utensilio", "04 Centro quirúrgico", "Centro quirúrgico", "CEyE", "I-4", 4, true),
  e("UT-CQ-007", "Separadores set", 380, 0.4, "utensilio", "04 Centro quirúrgico", "Centro quirúrgico", "CEyE", "II-1", 2, true),
  e("UT-CQ-008", "Valvas abdominales set", 650, 0.5, "utensilio", "04 Centro quirúrgico", "Centro quirúrgico", "CEyE", "II-1", 2, true),
  e("UT-CQ-009", "Caja de instrumental perforada", 280, 0.3, "utensilio", "04 Centro quirúrgico", "CEyE", "Esterilización", "I-4", 6, true),
  e("UT-CQ-010", "Contenedor rígido de esterilización", 850, 0.5, "utensilio", "04 Centro quirúrgico", "CEyE", "Esterilización", "II-1", 4, true),
  e("UT-CQ-011", "Lámpara frontal quirúrgica", 680, 0.5, "utensilio", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 2, true),
  e("UT-CQ-012", "Asta de suero de quirófano", 160, 0.3, "utensilio", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 2, true),
  e("UT-CQ-013", "Balde de patada de acero", 95, 0.2, "utensilio", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 2, true),
  e("UT-CQ-014", "Reloj de isquemia / torniquete", 1450, 1, "utensilio", "04 Centro quirúrgico", "Centro quirúrgico", "Quirófano", "II-1", 1, true),
  e("UT-CQ-015", "Set de parto (caja)", 980, 0.8, "utensilio", "04 Centro quirúrgico", "Centro obstétrico", "Sala de partos", "I-4", 2, true),

  e("EQ-LAB-001", "Analizador hematológico", 42000, 8, "equipo", "05 Patología clínica", "Patología clínica", "Área de hematología", "I-3", 1, true),
  e("EQ-LAB-002", "Analizador bioquímico", 52000, 8, "equipo", "05 Patología clínica", "Patología clínica", "Área de química", "I-3", 1, true),
  e("EQ-LAB-003", "Analizador de electrolitos", 18500, 6, "equipo", "05 Patología clínica", "Patología clínica", "Área de química", "I-3", 1, true),
  e("EQ-LAB-004", "Microscopio binocular", 4800, 2, "equipo", "05 Patología clínica", "Patología clínica", "Área de microscopía", "I-3", 1, true),
  e("EQ-LAB-005", "Centrífuga de laboratorio", 6500, 3, "equipo", "05 Patología clínica", "Patología clínica", "Área de toma / proceso", "I-3", 1, true),
  e("EQ-LAB-006", "Estufa de laboratorio", 4200, 3, "equipo", "05 Patología clínica", "Patología clínica", "Área de cultivos", "I-3", 1, true),
  e("EQ-LAB-007", "Incubadora de laboratorio", 6800, 3, "equipo", "05 Patología clínica", "Patología clínica", "Área de cultivos", "I-3", 1, true),
  e("EQ-LAB-008", "Refrigeradora de laboratorio 2–8 °C", 4800, 3, "equipo", "05 Patología clínica", "Patología clínica", "Área de reactivos", "I-3", 1, true),
  e("EQ-LAB-009", "Congeladora −20 °C de laboratorio", 6800, 4, "equipo", "05 Patología clínica", "Patología clínica", "Área de reactivos", "I-3", 1, true),
  e("EQ-LAB-010", "Autoclave de laboratorio", 14500, 6, "equipo", "05 Patología clínica", "Patología clínica", "Área de descontaminación", "I-3", 1, true),
  e("EQ-LAB-011", "Cabina de bioseguridad clase II", 18500, 6, "equipo", "05 Patología clínica", "Patología clínica", "Área de microbiología", "II-1", 1, true),
  e("EQ-LAB-012", "Balanza analítica", 2800, 2, "equipo", "05 Patología clínica", "Patología clínica", "Área de preparación", "I-3", 1, true),
  e("EQ-LAB-013", "Baño María", 1450, 1, "equipo", "05 Patología clínica", "Patología clínica", "Área de química", "I-3", 1, true),
  e("EQ-LAB-014", "Agitador magnético", 680, 0.8, "equipo", "05 Patología clínica", "Patología clínica", "Área de preparación", "I-3", 1, true),
  e("EQ-LAB-015", "Destilador / bidestilador de agua", 8500, 4, "equipo", "05 Patología clínica", "Patología clínica", "Área de agua", "I-3", 1, true),
  e("EQ-LAB-016", "Analizador de gases arteriales", 28000, 6, "equipo", "05 Patología clínica", "Patología clínica", "UCI / laboratorio", "II-2", 1, true),
  e("EQ-LAB-017", "Cabina de flujo laminar", 14500, 6, "equipo", "05 Patología clínica", "Patología clínica", "Área estéril", "III-1", 1, false),
  e("EQ-LAB-018", "Contador de colonias", 850, 0.5, "equipo", "05 Patología clínica", "Patología clínica", "Microbiología", "II-1", 1, true),
  e("EQ-LAB-019", "Vortex / agitador de tubos", 420, 0.4, "equipo", "05 Patología clínica", "Patología clínica", "Área de proceso", "I-3", 1, true),
  e("EQ-LAB-020", "Pipetas automáticas set", 980, 0.5, "utensilio", "05 Patología clínica", "Patología clínica", "Área de proceso", "I-3", 2, true),
  e("EQ-LAB-021", "Refrigeradora de sangre / banco", 12500, 5, "equipo", "05 Patología clínica", "Banco de sangre", "Cuarto frío", "II-1", 1, true),
  e("EQ-LAB-022", "Glucómetro de consultorio", 280, 0.4, "equipo", "05 Patología clínica", "Consulta externa", "Consultorio / tópico", "I-1", 1, true),

  e("EQ-OD-001", "Unidad dental completa", 18500, 10, "equipo", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 1, true),
  e("EQ-OD-002", "Sillón odontológico", 8500, 6, "equipo", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 1, true),
  e("EQ-OD-003", "Compresor odontológico", 2800, 3, "equipo", "06 Odontología", "Odontología", "Cuarto de máquinas dental", "I-3", 1, true),
  e("EQ-OD-004", "Autoclave odontológico", 4200, 3, "equipo", "06 Odontología", "Odontología", "Esterilización dental", "I-3", 1, true),
  e("EQ-OD-005", "Equipo de rayos X dental", 14500, 6, "equipo", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 1, true),
  e("EQ-OD-006", "Radiovisiógrafo", 8500, 3, "equipo", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 1, true),
  e("EQ-OD-007", "Lámpara de fotocurado", 850, 0.8, "equipo", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 1, true),
  e("EQ-OD-008", "Ultrasonido dental", 2200, 2, "equipo", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 1, true),
  e("EQ-OD-009", "Amalgamador", 680, 0.8, "equipo", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 1, true),
  e("EQ-OD-010", "Cámara intraoral", 1850, 1, "equipo", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 1, true),
  e("EQ-OD-011", "Aspirador dental", 1450, 2, "equipo", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 1, true),
  e("EQ-OD-012", "Vibrador de yeso", 420, 0.5, "equipo", "06 Odontología", "Odontología", "Laboratorio dental", "I-3", 1, true),
  e("EQ-OD-013", "Compresora de laboratorio dental", 1850, 2, "maquinaria", "06 Odontología", "Odontología", "Laboratorio dental", "I-3", 1, true),
  e("EQ-OD-014", "Lámpara odontológica de brazo", 980, 1, "equipo", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 1, true),
  e("EQ-OD-015", "Mobiliario clínico odontológico (módulo)", 3200, 4, "mobiliario", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 1, true),
  e("EQ-OD-016", "Negatoscopio dental", 280, 0.4, "equipo", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 1, true),
  e("EQ-OD-017", "Pieza de alta / baja set", 1450, 1, "utensilio", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 2, true),
  e("EQ-OD-018", "Eyector / cánulas set", 120, 0.3, "utensilio", "06 Odontología", "Odontología", "Gabinete dental", "I-3", 4, true),

  e("EQ-CE-001", "Autoclave de vapor de red", 42000, 12, "equipo", "07 Esterilización / CEyE", "CEyE", "Sala de autoclaves", "II-1", 1, true),
  e("EQ-CE-002", "Esterilizador de baja temperatura", 68000, 12, "equipo", "07 Esterilización / CEyE", "CEyE", "Sala de autoclaves", "II-2", 1, false),
  e("EQ-CE-003", "Lavadora ultrasónica", 8500, 4, "equipo", "07 Esterilización / CEyE", "CEyE", "Área sucia", "II-1", 1, true),
  e("EQ-CE-004", "Lavadora descontaminadora de instrumental", 38000, 10, "equipo", "07 Esterilización / CEyE", "CEyE", "Área sucia", "II-1", 1, true),
  e("EQ-CE-005", "Selladora de bolsas para esterilización", 2800, 2, "equipo", "07 Esterilización / CEyE", "CEyE", "Empaque", "I-4", 1, true),
  e("EQ-CE-006", "Secadora de instrumental", 6500, 3, "equipo", "07 Esterilización / CEyE", "CEyE", "Área sucia", "II-1", 1, true),
  e("EQ-CE-007", "Termodesinfectadora", 52000, 12, "equipo", "07 Esterilización / CEyE", "CEyE", "Área sucia", "II-2", 1, false),
  e("EQ-CE-008", "Carro de transporte de CEyE", 980, 1, "mobiliario", "07 Esterilización / CEyE", "CEyE", "Circulación", "I-4", 2, true),
  e("EQ-CE-009", "Mesa de preparación de CEyE", 850, 1, "mobiliario", "07 Esterilización / CEyE", "CEyE", "Área sucia", "I-4", 1, true),
  e("EQ-CE-010", "Mesa de empaque", 850, 1, "mobiliario", "07 Esterilización / CEyE", "CEyE", "Empaque", "I-4", 1, true),
  e("EQ-CE-011", "Autoclave de mesa 24 L", 9800, 4, "equipo", "07 Esterilización / CEyE", "CEyE", "Esterilización de consultorio", "I-2", 1, true),
  e("EQ-CE-012", "Estantería de material estéril", 680, 1, "mobiliario", "07 Esterilización / CEyE", "CEyE", "Almacén estéril", "I-4", 2, true),
  e("EQ-CE-013", "Indicadores biológicos / incubadora", 1450, 1, "equipo", "07 Esterilización / CEyE", "CEyE", "Control de calidad", "II-1", 1, true),
  e("EQ-CE-014", "Guante de calor / manoplas set", 85, 0.2, "utensilio", "07 Esterilización / CEyE", "CEyE", "Sala de autoclaves", "I-4", 2, true),
  e("EQ-CE-015", "Carro de lencería sucia", 520, 1, "mobiliario", "07 Esterilización / CEyE", "CEyE", "Área sucia", "I-4", 1, true),

  e("EQ-CX-001", "Balanza de adulto con tallímetro", 720, 1, "equipo", "08 Consulta externa", "Consulta externa", "Consultorio", "I-1", 1, true),
  e("EQ-CX-002", "Balanza pediátrica", 850, 1, "equipo", "08 Consulta externa", "Consulta externa", "CRED / pediatría", "I-1", 1, true),
  e("EQ-CX-003", "Otoscopio / oftalmoscopio set", 1100, 1, "equipo", "08 Consulta externa", "Consulta externa", "Consultorio", "I-1", 1, true),
  e("EQ-CX-004", "Esfigmomanómetro aneroide de pedestal", 380, 0.5, "equipo", "08 Consulta externa", "Consulta externa", "Consultorio", "I-1", 1, true),
  e("EQ-CX-005", "Nebulizador a pistón", 650, 1, "equipo", "08 Consulta externa", "Consulta externa", "Tópico", "I-1", 1, true),
  e("EQ-CX-006", "Lámpara de cuello de ganso", 480, 1, "equipo", "08 Consulta externa", "Consulta externa", "Consultorio", "I-1", 1, true),
  e("EQ-CX-007", "Refrigeradora de vacunas 2–8 °C", 4800, 3, "equipo", "08 Consulta externa", "Inmunizaciones", "Cadena de frío", "I-1", 1, true),
  e("EQ-CX-008", "Termómetro clínico infrarrojo", 180, 0.3, "equipo", "08 Consulta externa", "Consulta externa", "Triaje", "I-1", 2, true),
  e("EQ-CX-009", "Cinta métrica / infantómetro", 95, 0.2, "utensilio", "08 Consulta externa", "Consulta externa", "CRED", "I-1", 2, true),
  e("EQ-CX-010", "Negatoscopio de consultorio", 380, 0.5, "equipo", "08 Consulta externa", "Consulta externa", "Consultorio", "I-2", 1, true),
  e("EQ-CX-011", "Equipo de curación de tópico", 420, 0.8, "utensilio", "08 Consulta externa", "Consulta externa", "Tópico", "I-1", 2, true),
  e("EQ-CX-012", "Espejo vaginal set", 85, 0.2, "utensilio", "08 Consulta externa", "Consulta externa", "Consultorio GO", "I-2", 4, true),
  e("EQ-CX-013", "Martillo de reflejos", 45, 0.2, "utensilio", "08 Consulta externa", "Consulta externa", "Consultorio", "I-1", 1, true),
  e("EQ-CX-014", "Linterna clínica", 35, 0.2, "utensilio", "08 Consulta externa", "Consulta externa", "Consultorio", "I-1", 2, true),
  e("EQ-CX-015", "Camilla de examen de consultorio", 980, 1, "equipo", "08 Consulta externa", "Consulta externa", "Consultorio", "I-1", 2, true),
  e("EQ-CX-016", "Sistema de llamado de enfermería (módulo)", 18500, 12, "equipo", "08 Consulta externa", "Hospitalización", "Habitaciones / control", "I-4", 1, true),
  e("EQ-CX-017", "Tensiómetro digital de mesa", 220, 0.3, "equipo", "08 Consulta externa", "Consulta externa", "Triaje", "I-1", 1, true),
  e("EQ-CX-018", "Estetoscopio clínico", 85, 0.2, "utensilio", "08 Consulta externa", "Consulta externa", "Consultorio", "I-1", 2, true),
  e("EQ-CX-019", "Caja de curación de acero", 65, 0.2, "utensilio", "08 Consulta externa", "Consulta externa", "Tópico", "I-1", 3, true),
  e("EQ-CX-020", "Lámpara de exploración LED", 680, 0.8, "equipo", "08 Consulta externa", "Consulta externa", "Consultorio", "I-1", 1, true),

  e("EQ-HO-001", "Colchón antiescaras", 850, 0.5, "equipo", "09 Hospitalización", "Hospitalización", "Habitación", "I-4", 4, true),
  e("EQ-HO-002", "Baranda de cama par", 180, 0.4, "utensilio", "09 Hospitalización", "Hospitalización", "Habitación", "I-4", 8, true),
  e("EQ-HO-003", "Comoda / silla sanitaria", 280, 0.5, "equipo", "09 Hospitalización", "Hospitalización", "Habitación", "I-4", 2, true),
  e("EQ-HO-004", "Mesa de comer sobre cama", 220, 0.4, "mobiliario", "09 Hospitalización", "Hospitalización", "Habitación", "I-4", 8, true),
  e("EQ-HO-005", "Lámpara de cabecera", 95, 0.3, "equipo", "09 Hospitalización", "Hospitalización", "Habitación", "I-4", 8, true),
  e("EQ-HO-006", "Carro de medicación", 1850, 2, "equipo", "09 Hospitalización", "Hospitalización", "Control de enfermería", "I-4", 1, true),
  e("EQ-HO-007", "Carro de curaciones de piso", 980, 1, "equipo", "09 Hospitalización", "Hospitalización", "Control de enfermería", "I-4", 1, true),
  e("EQ-HO-008", "Lavamanos clínico portátil", 420, 1, "equipo", "09 Hospitalización", "Hospitalización", "Control de enfermería", "I-4", 1, true),
  e("EQ-HO-009", "Reloj de control de enfermería", 85, 0.2, "mobiliario", "09 Hospitalización", "Hospitalización", "Control de enfermería", "I-4", 1, true),
  e("EQ-HO-010", "Pizarra de censo de pacientes", 180, 0.4, "mobiliario", "09 Hospitalización", "Hospitalización", "Control de enfermería", "I-4", 1, true),
  e("EQ-HO-011", "Cuna de colecho / nido", 680, 1, "equipo", "09 Hospitalización", "Hospitalización", "Habitación materno", "I-4", 2, true),
  e("EQ-HO-012", "Báscula de cama", 1850, 1, "equipo", "09 Hospitalización", "Hospitalización", "Habitación", "II-1", 1, true),
  e("EQ-HO-013", "Grúa de traslado de pacientes", 8500, 4, "equipo", "09 Hospitalización", "Hospitalización", "Habitación / rehabilitación", "II-1", 1, true),
  e("EQ-HO-014", "Dispensador de alcohol / jabón set", 85, 0.2, "utensilio", "09 Hospitalización", "Hospitalización", "Habitación / pasillo", "I-4", 8, true),
  e("EQ-HO-015", "Contenedor de residuos punzocortantes (estación)", 180, 0.5, "utensilio", "09 Hospitalización", "Hospitalización", "Puesto de enfermería", "I-1", 2, true),

  e("EQ-UC-001", "Monitor central de UCI", 42000, 10, "equipo", "10 UCI y críticos", "UCI", "Control de UCI", "II-2", 1, false),
  e("EQ-UC-002", "Bomba de infusión de UCI (estación)", 4200, 2, "equipo", "10 UCI y críticos", "UCI", "Cubículo UCI", "II-2", 6, true),
  e("EQ-UC-003", "Aspirador de UCI", 2200, 2, "equipo", "10 UCI y críticos", "UCI", "Cubículo UCI", "II-2", 2, true),
  e("EQ-UC-004", "Carro de paro de UCI", 2800, 2, "equipo", "10 UCI y críticos", "UCI", "Control de UCI", "II-2", 1, true),
  e("EQ-UC-005", "Ecógrafo de UCI / FAST", 18500, 4, "equipo", "10 UCI y críticos", "UCI", "Control de UCI", "II-2", 1, false),
  e("EQ-UC-006", "Cama de UCI eléctrica", 18500, 6, "equipo", "10 UCI y críticos", "UCI", "Cubículo UCI", "II-2", 4, true),
  e("EQ-UC-007", "Colchón de aire de UCI", 2200, 1, "equipo", "10 UCI y críticos", "UCI", "Cubículo UCI", "II-2", 4, true),
  e("EQ-UC-008", "Bomba de nutrición enteral", 2800, 2, "equipo", "10 UCI y críticos", "UCI", "Cubículo UCI", "II-2", 2, true),
  e("EQ-UC-009", "Calentador de sangre", 6500, 3, "equipo", "10 UCI y críticos", "UCI", "Cubículo UCI", "II-2", 1, true),
  e("EQ-UC-010", "EEG continuo / BIS", 18500, 6, "equipo", "10 UCI y críticos", "UCI", "Cubículo UCI", "III-1", 1, false),
  e("EQ-UC-011", "Máquina de hemofiltración", 85000, 16, "equipo", "10 UCI y críticos", "UCI", "Cubículo UCI", "III-1", 1, false),
  e("EQ-UC-012", "Lámpara de examen de UCI", 680, 0.8, "equipo", "10 UCI y críticos", "UCI", "Cubículo UCI", "II-2", 4, true),

  e("EQ-NE-001", "Lámpara de fototerapia neonatal", 4500, 3, "equipo", "11 Neonatología", "Neonatología", "UCIN", "I-4", 1, true),
  e("EQ-NE-002", "Monitor neonatal", 16500, 5, "equipo", "11 Neonatología", "Neonatología", "UCIN", "II-1", 2, true),
  e("EQ-NE-003", "Ventilador neonatal", 72000, 10, "equipo", "11 Neonatología", "Neonatología", "UCIN", "II-2", 1, true),
  e("EQ-NE-004", "Balanza neonatal", 850, 1, "equipo", "11 Neonatología", "Neonatología", "UCIN", "I-4", 1, true),
  e("EQ-NE-005", "Aspirador neonatal", 1450, 1, "equipo", "11 Neonatología", "Neonatología", "UCIN", "I-4", 1, true),
  e("EQ-NE-006", "Reanimador neonatal (T-piece)", 4200, 2, "equipo", "11 Neonatología", "Neonatología", "Sala de partos", "I-4", 1, true),
  e("EQ-NE-007", "Cuna de transporte neonatal", 8500, 4, "equipo", "11 Neonatología", "Neonatología", "UCIN", "II-1", 1, true),
  e("EQ-NE-008", "Bilirubinómetro", 3800, 2, "equipo", "11 Neonatología", "Neonatología", "UCIN", "II-1", 1, true),
  e("EQ-NE-009", "Lactario / extractor de leche", 1450, 1, "equipo", "11 Neonatología", "Neonatología", "Lactario", "I-4", 1, true),
  e("EQ-NE-010", "Refrigeradora de leche materna", 1850, 2, "equipo", "11 Neonatología", "Neonatología", "Lactario", "I-4", 1, true),

  e("EQ-FA-001", "Estantería de farmacia (módulo)", 680, 1, "mobiliario", "12 Farmacia", "Farmacia", "Almacén de medicamentos", "I-4", 4, true),
  e("EQ-FA-002", "Refrigeradora de medicamentos 2–8 °C", 3200, 3, "equipo", "12 Farmacia", "Farmacia", "Cadena de frío", "I-4", 1, true),
  e("EQ-FA-003", "Mostrador de dispensación", 1850, 3, "mobiliario", "12 Farmacia", "Farmacia", "Ventanilla", "I-4", 1, true),
  e("EQ-FA-004", "Balanza de farmacia", 850, 1, "equipo", "12 Farmacia", "Farmacia", "Área de preparación", "I-4", 1, true),
  e("EQ-FA-005", "Campana de flujo para preparación", 12500, 6, "equipo", "12 Farmacia", "Farmacia", "Área estéril", "II-1", 1, false),
  e("EQ-FA-006", "Carro de distribución de medicamentos", 980, 1, "equipo", "12 Farmacia", "Farmacia", "Circulación", "I-4", 1, true),
  e("EQ-FA-007", "Caja fuerte de psicotrópicos", 1450, 1, "mobiliario", "12 Farmacia", "Farmacia", "Área restringida", "I-4", 1, true),
  e("EQ-FA-008", "Computadora / lector de farmacia", 2200, 2, "equipo", "12 Farmacia", "Farmacia", "Ventanilla", "I-4", 1, true),
  e("EQ-FA-009", "Termómetro registrador de cadena de frío", 280, 0.4, "equipo", "12 Farmacia", "Farmacia", "Cadena de frío", "I-4", 1, true),
  e("EQ-FA-010", "Contenedor de medicamentos vencidos", 180, 0.3, "utensilio", "12 Farmacia", "Farmacia", "Almacén", "I-4", 2, true),
  e("EQ-FA-011", "Mesa de fraccionamiento", 520, 1, "mobiliario", "12 Farmacia", "Farmacia", "Área de preparación", "I-4", 1, true),
  e("EQ-FA-012", "Sello / rotuladora de dosis", 380, 0.5, "equipo", "12 Farmacia", "Farmacia", "Área de preparación", "I-4", 1, true),

  e("EQ-HD-001", "Máquina de hemodiálisis", 85000, 16, "equipo", "13 Hemodiálisis", "Hemodiálisis", "Puesto de diálisis", "II-2", 4, true),
  e("EQ-HD-002", "Sillón de hemodiálisis", 4200, 3, "mobiliario", "13 Hemodiálisis", "Hemodiálisis", "Puesto de diálisis", "II-2", 4, true),
  e("EQ-HD-003", "Osmosis inversa de diálisis", 42000, 12, "equipo", "13 Hemodiálisis", "Hemodiálisis", "Sala de tratamiento de agua", "II-2", 1, false),
  e("EQ-HD-004", "Monitor de diálisis / báscula", 1850, 2, "equipo", "13 Hemodiálisis", "Hemodiálisis", "Puesto de diálisis", "II-2", 2, true),
  e("EQ-HD-005", "Carro de emergencia de diálisis", 2800, 2, "equipo", "13 Hemodiálisis", "Hemodiálisis", "Control", "II-2", 1, false),
  e("EQ-HD-006", "Refrigeradora de concentrados", 1850, 2, "equipo", "13 Hemodiálisis", "Hemodiálisis", "Almacén", "II-2", 1, false),
  e("EQ-HD-007", "Lavamanos clínico de diálisis", 420, 1, "equipo", "13 Hemodiálisis", "Hemodiálisis", "Puesto de diálisis", "II-2", 2, true),
  e("EQ-HD-008", "Tanque de agua tratada", 6500, 4, "equipo", "13 Hemodiálisis", "Hemodiálisis", "Sala de agua", "II-2", 1, false),
  e("EQ-HD-009", "Analizador de agua de diálisis", 4800, 2, "equipo", "13 Hemodiálisis", "Hemodiálisis", "Sala de agua", "II-2", 1, false),
  e("EQ-HD-010", "Desfibrilador de sala de diálisis", 22000, 6, "equipo", "13 Hemodiálisis", "Hemodiálisis", "Control", "II-2", 1, false),

  e("EQ-RE-001", "Camilla de rehabilitación", 2200, 2, "equipo", "14 Rehabilitación", "Rehabilitación", "Sala de terapia", "I-3", 2, true),
  e("EQ-RE-002", "Equipo de ultrasonido terapéutico", 3800, 2, "equipo", "14 Rehabilitación", "Rehabilitación", "Sala de terapia", "I-3", 1, true),
  e("EQ-RE-003", "Electroestimulador TENS", 1450, 1, "equipo", "14 Rehabilitación", "Rehabilitación", "Sala de terapia", "I-3", 1, true),
  e("EQ-RE-004", "Bicicleta estática clínica", 1850, 2, "equipo", "14 Rehabilitación", "Rehabilitación", "Sala de terapia", "I-3", 1, true),
  e("EQ-RE-005", "Paralelas de marcha", 2200, 3, "equipo", "14 Rehabilitación", "Rehabilitación", "Sala de marcha", "I-3", 1, true),
  e("EQ-RE-006", "Espejo de rehabilitación", 380, 1, "mobiliario", "14 Rehabilitación", "Rehabilitación", "Sala de marcha", "I-3", 1, true),
  e("EQ-RE-007", "Set de pesas y bandas", 280, 0.5, "utensilio", "14 Rehabilitación", "Rehabilitación", "Sala de terapia", "I-3", 1, true),
  e("EQ-RE-008", "Tina de hidromasaje / tanque de Hubbard", 8500, 6, "equipo", "14 Rehabilitación", "Rehabilitación", "Hidroterapia", "II-1", 1, false),
  e("EQ-RE-009", "Equipo de magnetoterapia", 4200, 2, "equipo", "14 Rehabilitación", "Rehabilitación", "Sala de terapia", "I-3", 1, true),
  e("EQ-RE-010", "Camilla de tracción cervical/lumbar", 3200, 2, "equipo", "14 Rehabilitación", "Rehabilitación", "Sala de terapia", "II-1", 1, true),
  e("EQ-RE-011", "Rampas y escaleras de reeducación", 1450, 2, "equipo", "14 Rehabilitación", "Rehabilitación", "Sala de marcha", "I-3", 1, true),
  e("EQ-RE-012", "Sillón de fisioterapia", 680, 1, "mobiliario", "14 Rehabilitación", "Rehabilitación", "Sala de terapia", "I-3", 2, true),

  e("EQ-CM-001", "Cocina industrial / cocina de bloque", 12500, 8, "maquinaria", "15 Nutrición y cocina", "Nutrición", "Cocina", "I-4", 1, true),
  e("EQ-CM-002", "Refrigeradora industrial", 6800, 4, "maquinaria", "15 Nutrición y cocina", "Nutrición", "Cámara / cocina", "I-4", 1, true),
  e("EQ-CM-003", "Congeladora industrial", 7200, 4, "maquinaria", "15 Nutrición y cocina", "Nutrición", "Cámara", "I-4", 1, true),
  e("EQ-CM-004", "Marmita / olla de cocción hospitalaria", 8500, 6, "maquinaria", "15 Nutrición y cocina", "Nutrición", "Cocina", "II-1", 1, true),
  e("EQ-CM-005", "Cámara frigorífica de nutrición", 18500, 8, "maquinaria", "15 Nutrición y cocina", "Nutrición", "Cámara", "II-2", 1, false),
  e("EQ-CM-006", "Licuadora industrial", 1450, 1, "maquinaria", "15 Nutrición y cocina", "Nutrición", "Cocina", "I-4", 1, true),
  e("EQ-CM-007", "Mesón de acero inoxidable", 1850, 2, "mobiliario", "15 Nutrición y cocina", "Nutrición", "Cocina", "I-4", 2, true),
  e("EQ-CM-008", "Campana extractora de cocina", 3200, 4, "equipo", "15 Nutrición y cocina", "Nutrición", "Cocina", "I-4", 1, true),
  e("EQ-CM-009", "Carro de distribución de dietas", 1450, 2, "equipo", "15 Nutrición y cocina", "Nutrición", "Office de piso", "I-4", 2, true),
  e("EQ-CM-010", "Lavavajillas industrial", 8500, 6, "maquinaria", "15 Nutrición y cocina", "Nutrición", "Office", "II-1", 1, true),
  e("EQ-CM-011", "Balanza de cocina", 280, 0.4, "equipo", "15 Nutrición y cocina", "Nutrición", "Cocina", "I-4", 1, true),
  e("EQ-CM-012", "Anaquel de cocina de acero", 680, 1, "mobiliario", "15 Nutrición y cocina", "Nutrición", "Cocina", "I-4", 2, true),

  e("MA-LV-001", "Lavadora industrial / hospitalaria 16 kg", 12500, 6, "maquinaria", "16 Lavandería", "Lavandería", "Sala de lavado", "I-4", 1, true),
  e("MA-LV-002", "Secadora industrial / hospitalaria", 9800, 5, "maquinaria", "16 Lavandería", "Lavandería", "Sala de secado", "I-4", 1, true),
  e("MA-LV-003", "Calandra / planchadora", 14500, 8, "maquinaria", "16 Lavandería", "Lavandería", "Sala de planchado", "II-1", 1, false),
  e("MA-LV-004", "Centrífuga de ropa", 6500, 4, "maquinaria", "16 Lavandería", "Lavandería", "Sala de lavado", "II-1", 1, false),
  e("MA-LV-005", "Carro de lencería limpia", 520, 1, "mobiliario", "16 Lavandería", "Lavandería", "Área limpia", "I-4", 2, true),
  e("MA-LV-006", "Carro de lencería sucia", 520, 1, "mobiliario", "16 Lavandería", "Lavandería", "Área sucia", "I-4", 2, true),
  e("MA-LV-007", "Mesa de doblado", 380, 1, "mobiliario", "16 Lavandería", "Lavandería", "Área limpia", "I-4", 1, true),
  e("MA-LV-008", "Estantería de lencería", 480, 1, "mobiliario", "16 Lavandería", "Lavandería", "Almacén limpio", "I-4", 2, true),

  e("MA-MT-001", "Compresor de aire de mantenimiento", 4200, 4, "maquinaria", "17 Mantenimiento", "Mantenimiento", "Taller", "I-3", 1, true),
  e("MA-MT-002", "Grupo electrógeno de respaldo (dotación)", 19800, 8, "maquinaria", "17 Mantenimiento", "Mantenimiento", "Casa de fuerza", "I-4", 1, false),
  e("MA-MT-003", "Bomba de agua de reserva", 2800, 3, "maquinaria", "17 Mantenimiento", "Mantenimiento", "Casa de bombas", "I-3", 1, true),
  e("MA-MT-004", "Hidrocompresor", 1850, 2, "maquinaria", "17 Mantenimiento", "Mantenimiento", "Casa de bombas", "I-3", 1, true),
  e("MA-MT-005", "Soldadora eléctrica", 1450, 2, "maquinaria", "17 Mantenimiento", "Mantenimiento", "Taller", "I-3", 1, true),
  e("MA-MT-006", "Taladro de banco", 850, 1, "maquinaria", "17 Mantenimiento", "Mantenimiento", "Taller", "I-3", 1, true),
  e("MA-MT-007", "Escalera telescópica de mantenimiento", 380, 0.5, "herramienta", "17 Mantenimiento", "Mantenimiento", "Taller", "I-1", 1, true),
  e("MA-MT-008", "Gata hidráulica", 420, 0.5, "herramienta", "17 Mantenimiento", "Mantenimiento", "Taller", "I-3", 1, true),
  e("EQ-MT-001", "Multímetro / pinza amperimétrica", 280, 0.3, "herramienta", "17 Mantenimiento", "Mantenimiento", "Taller eléctrico", "I-1", 1, true),
  e("EQ-MT-002", "Megóhmetro", 850, 0.5, "herramienta", "17 Mantenimiento", "Mantenimiento", "Taller eléctrico", "I-3", 1, true),
  e("EQ-MT-003", "Detector de gases", 1450, 1, "equipo", "17 Mantenimiento", "Mantenimiento", "Taller", "I-4", 1, true),
  e("EQ-MT-004", "Aspiradora industrial", 680, 0.8, "equipo", "17 Mantenimiento", "Servicios generales", "Cuarto de limpieza", "I-1", 1, true),
  e("HE-MT-001", "Juego de llaves combinadas", 180, 0.3, "herramienta", "17 Mantenimiento", "Mantenimiento", "Taller", "I-1", 1, true),
  e("HE-MT-002", "Juego de destornilladores aislados", 95, 0.2, "herramienta", "17 Mantenimiento", "Mantenimiento", "Taller", "I-1", 1, true),
  e("HE-MT-003", "Alicates / corte set", 85, 0.2, "herramienta", "17 Mantenimiento", "Mantenimiento", "Taller", "I-1", 1, true),
  e("HE-MT-004", "Taladro percutor portátil", 380, 0.5, "herramienta", "17 Mantenimiento", "Mantenimiento", "Taller", "I-1", 1, true),
  e("HE-MT-005", "Amoladora angular", 220, 0.4, "herramienta", "17 Mantenimiento", "Mantenimiento", "Taller", "I-3", 1, true),
  e("HE-MT-006", "Nivel láser", 420, 0.4, "herramienta", "17 Mantenimiento", "Mantenimiento", "Taller", "I-3", 1, true),
  e("HE-MT-007", "Caja de herramientas con ruedas", 380, 0.5, "herramienta", "17 Mantenimiento", "Mantenimiento", "Taller", "I-1", 1, true),
  e("HE-MT-008", "Extensión industrial 25 m", 85, 0.2, "herramienta", "17 Mantenimiento", "Mantenimiento", "Taller", "I-1", 2, true),
  e("HE-MT-009", "Lámpara portátil recargable", 65, 0.2, "herramienta", "17 Mantenimiento", "Mantenimiento", "Taller", "I-1", 2, true),
  e("HE-MT-010", "Equipo de EPP de mantenimiento (estación)", 280, 0.3, "utensilio", "17 Mantenimiento", "Mantenimiento", "Taller", "I-1", 1, true),

  e("EQ-RS-001", "Contenedor de residuos biocontaminados 120 L", 280, 0.4, "utensilio", "18 Residuos sólidos", "Residuos", "Cuarto de residuos", "I-1", 2, true),
  e("EQ-RS-002", "Contenedor de residuos comunes 120 L", 180, 0.3, "utensilio", "18 Residuos sólidos", "Residuos", "Cuarto de residuos", "I-1", 2, true),
  e("EQ-RS-003", "Contenedor de punzocortantes (estación mural)", 85, 0.2, "utensilio", "18 Residuos sólidos", "Residuos", "Puestos de enfermería", "I-1", 4, true),
  e("EQ-RS-004", "Carro de recolección de residuos", 680, 1, "equipo", "18 Residuos sólidos", "Residuos", "Circulación", "I-3", 1, true),
  e("EQ-RS-005", "Prensa / compactadora de residuos", 8500, 6, "maquinaria", "18 Residuos sólidos", "Residuos", "Cuarto de residuos", "II-1", 1, false),
  e("EQ-RS-006", "Lavadero de contenedores", 1450, 2, "equipo", "18 Residuos sólidos", "Residuos", "Cuarto de residuos", "I-4", 1, true),
  e("EQ-RS-007", "Balanza de residuos", 420, 0.5, "equipo", "18 Residuos sólidos", "Residuos", "Cuarto de residuos", "I-4", 1, true),
  e("EQ-RS-008", "Señalética de residuos hospitalarios set", 180, 0.4, "utensilio", "18 Residuos sólidos", "Residuos", "UPSS", "I-1", 1, true),

  e("MO-OF-001", "Escritorio administrativo", 480, 1, "mobiliario", "19 Oficina y administración", "Administración", "Oficina", "I-1", 2, true),
  e("MO-OF-002", "Silla ergonómica de oficina", 280, 0.4, "mobiliario", "19 Oficina y administración", "Administración", "Oficina", "I-1", 2, true),
  e("MO-OF-003", "Archivador 4 gavetas", 720, 1, "mobiliario", "19 Oficina y administración", "Administración", "Archivo", "I-1", 1, true),
  e("MO-OF-004", "Mesa de reuniones 6 puestos", 1450, 2, "mobiliario", "19 Oficina y administración", "Administración", "Sala de reuniones", "I-3", 1, true),
  e("MO-OF-005", "Pizarra acrílica", 180, 0.4, "mobiliario", "19 Oficina y administración", "Administración", "Sala de reuniones", "I-1", 1, true),
  e("EQ-OF-001", "Computadora de escritorio administrativa", 2200, 2, "equipo", "19 Oficina y administración", "Administración", "Oficina", "I-1", 2, true),
  e("EQ-OF-002", "Impresora multifuncional", 1450, 1, "equipo", "19 Oficina y administración", "Administración", "Oficina", "I-1", 1, true),
  e("EQ-OF-003", "Escáner de documentos", 850, 1, "equipo", "19 Oficina y administración", "Administración", "Admisión / archivo", "I-2", 1, true),
  e("EQ-OF-004", "Teléfono IP / conmutador de mesa", 280, 0.5, "equipo", "19 Oficina y administración", "Administración", "Oficina", "I-1", 2, true),
  e("EQ-OF-005", "Reloj de control de asistencia", 680, 1, "equipo", "19 Oficina y administración", "Administración", "Ingreso de personal", "I-3", 1, true),

  e("EQ-AL-001", "Estantería de almacén (módulo)", 480, 1, "mobiliario", "20 Almacén", "Almacén", "Almacén general", "I-1", 3, true),
  e("EQ-AL-002", "Pallet / tarima de plástico", 85, 0.2, "utensilio", "20 Almacén", "Almacén", "Almacén general", "I-3", 6, true),
  e("EQ-AL-003", "Montacargas manual / transpaleta", 1450, 1, "maquinaria", "20 Almacén", "Almacén", "Almacén general", "I-4", 1, true),
  e("EQ-AL-004", "Balanza de plataforma", 850, 1, "equipo", "20 Almacén", "Almacén", "Almacén general", "I-3", 1, true),
  e("EQ-AL-005", "Escalera de almacén", 220, 0.4, "herramienta", "20 Almacén", "Almacén", "Almacén general", "I-1", 1, true),
  e("EQ-AL-006", "Contenedor de insumos (caja plástica)", 45, 0.2, "utensilio", "20 Almacén", "Almacén", "Almacén general", "I-1", 8, true),
  e("EQ-AL-007", "Escritorio de almacenero", 380, 1, "mobiliario", "20 Almacén", "Almacén", "Oficina de almacén", "I-3", 1, true),
  e("EQ-AL-008", "Extintor PQS 6 kg de almacén", 85, 0.3, "equipo", "20 Almacén", "Almacén", "Almacén general", "I-1", 2, true),

  e("EQ-SS-001", "Carro de limpieza hospitalaria", 380, 0.8, "equipo", "21 Servicios generales", "Servicios generales", "Cuarto de limpieza", "I-1", 1, true),
  e("EQ-SS-002", "Aspiradora / enceradora", 1450, 1, "equipo", "21 Servicios generales", "Servicios generales", "Cuarto de limpieza", "I-3", 1, true),
  e("EQ-SS-003", "Tacho pedal de acero 20 L", 85, 0.2, "utensilio", "21 Servicios generales", "Servicios generales", "SS.HH. / consultorio", "I-1", 4, true),
  e("EQ-SS-004", "Dispensador de toallas / jabón set", 65, 0.2, "utensilio", "21 Servicios generales", "Servicios generales", "SS.HH.", "I-1", 4, true),
  e("EQ-SS-005", "Señalética de circulación hospitalaria set", 280, 0.5, "utensilio", "21 Servicios generales", "Servicios generales", "Pasillos", "I-1", 1, true),
  e("EQ-SS-006", "Banca de vestuario de personal", 280, 0.5, "mobiliario", "21 Servicios generales", "Servicios generales", "Vestidores", "I-3", 2, true),
  e("EQ-SS-007", "Casillero de personal 6 puertas", 680, 1, "mobiliario", "21 Servicios generales", "Servicios generales", "Vestidores", "I-3", 2, true),
  e("EQ-SS-008", "Bebedero de pasillo", 850, 1, "equipo", "21 Servicios generales", "Servicios generales", "Sala de espera", "I-3", 1, true),
];

const RANK: Record<CategoriaMinsa, number> = {
  "I-1": 1,
  "I-2": 2,
  "I-3": 3,
  "I-4": 4,
  "II-1": 5,
  "II-2": 6,
  "II-E": 6,
  "III-1": 7,
  "III-E": 7,
  "III-2": 8,
};

const FACTOR: Record<CategoriaMinsa, number> = {
  "I-1": 1,
  "I-2": 1,
  "I-3": 1,
  "I-4": 2,
  "II-1": 3,
  "II-2": 4,
  "II-E": 3,
  "III-1": 6,
  "III-E": 5,
  "III-2": 8,
};

function i(id: string, kind: RecursoKind, codigo: string, nombre: string, und: string, precio: number, iu: number, categoria: string): Insumo {
  return { id, kind, codigo, nombre, und, precio, iu, categoria };
}

function insumoIdDe(codigo: string) {
  return `MAT-${codigo.replace(/-/g, "")}`;
}

function capDe(capitulo: string) {
  const m = capitulo.match(/^(\d{2})/);
  return m?.[1] ?? "99";
}

/** Código de partida RN (EQ-01.01.01). El código MINSA-DIEM (EQ-ME-001) va en la descripción. */
const PARTIDA_DE_MINSA: Record<string, string> = {};
const MINSA_DE_PARTIDA: Record<string, string> = {};
{
  const seq = new Map<string, number>();
  for (const row of ROWS) {
    const cap = capDe(row.capitulo);
    const n = (seq.get(cap) ?? 0) + 1;
    seq.set(cap, n);
    const partida = `EQ-${cap}.01.${String(n).padStart(2, "0")}`;
    PARTIDA_DE_MINSA[row.codigo] = partida;
    MINSA_DE_PARTIDA[partida] = row.codigo;
  }
}

export function codigoPartidaEquipamiento(codigo: string) {
  if (PARTIDA_DE_MINSA[codigo]) return PARTIDA_DE_MINSA[codigo];
  return codigo;
}

export function esCodigoEquipamiento(codigo: string) {
  return /^(IM-08\.|IM-09\.|IE-06\.|IE-07\.|EQ-\d{2}\.)/.test(codigo) || /^(EQ-|MA-|UT-|MO-|HE-)/.test(codigo);
}

function tituloDe(row: Row) {
  const n = row.nombre.trim();
  const lower = n.charAt(0).toLocaleLowerCase("es") + n.slice(1);
  const tag = `MINSA-DIEM ${row.codigo}`;
  if (row.tipo === "expediente") return `${n} (${tag})`;
  if (row.tipo === "utensilio" || row.tipo === "herramienta") return `Suministro de ${lower} (${tag})`;
  return `Suministro e instalación de ${lower} (${tag})`;
}

function alcanceInsumo(row: Row) {
  return `${row.nombre} (${TIPO_LABEL[row.tipo]} · ${row.upss} · ${row.ambiente} · MINSA-DIEM ${row.codigo})`;
}

export const INSUMOS_EQUIPAMIENTO: Insumo[] = ROWS.map((row) =>
  i(insumoIdDe(row.codigo), "mat", row.codigo, alcanceInsumo(row), row.und, row.precio, 11, "Equipamiento hospitalario por UPSS")
);

export const PARTIDAS_EQUIPAMIENTO: Partida[] = ROWS.map((row) => {
  const moBio = Math.max(0.2, row.mo);
  const moEle = row.tipo === "expediente" ? 0 : Math.max(0.2, row.mo * 0.35);
  const moAyu = Math.max(0.2, row.mo * 0.4);
  const receta =
    row.tipo === "expediente"
      ? r(["MO-BIO", moBio], ["MO-TEC", Math.max(2, row.mo * 0.4)], ["EQ-HIN", 3])
      : r(["MO-BIO", moBio], ["MO-ELE", moEle], ["MO-AYU", moAyu], [insumoIdDe(row.codigo), 1], ["EQ-HIN", 3]);
  return p("equipamiento", row.capitulo, PARTIDA_DE_MINSA[row.codigo], tituloDe(row), row.und, receta);
});

const DESDE = Object.fromEntries(
  ROWS.flatMap((row) => {
    const partida = PARTIDA_DE_MINSA[row.codigo];
    return [
      [row.codigo, row.desde],
      [partida, row.desde],
    ];
  }),
) as Record<string, CategoriaMinsa>;

export function desdeEquipamiento(codigo: string): CategoriaMinsa | null {
  return DESDE[codigo] ?? DESDE[PARTIDA_DE_MINSA[codigo]] ?? null;
}

export function fichaEquipamiento(codigo: string) {
  const minsa = MINSA_DE_PARTIDA[codigo] ?? codigo;
  const row = ROWS.find((x) => x.codigo === minsa);
  if (!row) return null;
  return {
    codigo: PARTIDA_DE_MINSA[row.codigo],
    codigoMinsa: row.codigo,
    nombre: row.nombre,
    unidad: row.und,
    especialidad: row.upss,
    ambiente: row.ambiente,
    tipo: row.tipo,
    capitulo: row.capitulo,
    categoriaMinima: row.desde,
  };
}

function qtyEn(row: Row, cat: CategoriaMinsa) {
  if (RANK[cat] < RANK[row.desde]) return 0;
  if (!row.escala) return row.qty;
  return Math.max(1, Math.round(row.qty * FACTOR[cat]));
}

/** Semilla por categoría NTS 021. El plano manda en PRE-00. */
export function extrasEquipamiento(cat: CategoriaMinsa): { codigo: string; metrado: number }[] {
  return ROWS.map((row) => ({ codigo: PARTIDA_DE_MINSA[row.codigo], metrado: qtyEn(row, cat) })).filter((x) => x.metrado > 0);
}

export const CATALOGO_EQUIPAMIENTO_N = ROWS.length;
