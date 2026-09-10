import type { Insumo, RecursoKind } from "./types";

type Row = [string, RecursoKind, string, string, string, number, number, string];

function i(id: string, kind: RecursoKind, codigo: string, nombre: string, und: string, precio: number, iu: number, categoria: string): Insumo {
  return { id, kind, codigo, nombre, und, precio, iu, categoria };
}

/**
 * Acabados de presupuesto (CAPECO: pisos, vidriería, aluminio, carpintería).
 * Precios de referencia S/ Lima; no reproducen tablas de la revista.
 */
const RAW: Row[] = [
  // —— Vidrio plano (espesores y tipos) ——
  ["MAT-VID3", "mat", "MAT-800", "Vidrio claro recocido 3 mm", "m²", 32, 39, "Vidrios y aluminio"],
  ["MAT-VID5", "mat", "MAT-801", "Vidrio claro recocido 5 mm", "m²", 46, 39, "Vidrios y aluminio"],
  ["MAT-VID10", "mat", "MAT-802", "Vidrio claro recocido 10 mm", "m²", 92, 39, "Vidrios y aluminio"],
  ["MAT-VID12", "mat", "MAT-803", "Vidrio claro recocido 12 mm", "m²", 118, 39, "Vidrios y aluminio"],
  ["MAT-VIDBR4", "mat", "MAT-804", "Vidrio bronce 4 mm", "m²", 48, 39, "Vidrios y aluminio"],
  ["MAT-VIDBR6", "mat", "MAT-805", "Vidrio bronce 6 mm", "m²", 68, 39, "Vidrios y aluminio"],
  ["MAT-VIDGR4", "mat", "MAT-806", "Vidrio gris 4 mm", "m²", 48, 39, "Vidrios y aluminio"],
  ["MAT-VIDGR6", "mat", "MAT-807", "Vidrio gris 6 mm", "m²", 68, 39, "Vidrios y aluminio"],
  ["MAT-VIDREF6", "mat", "MAT-808", "Vidrio reflectivo 6 mm", "m²", 95, 39, "Vidrios y aluminio"],
  ["MAT-VIDOP6", "mat", "MAT-809", "Vidrio opaco / acidado 6 mm", "m²", 78, 39, "Vidrios y aluminio"],
  ["MAT-VIDCATH6", "mat", "MAT-810", "Vidrio catedral / ornamentado 6 mm", "m²", 62, 39, "Vidrios y aluminio"],
  ["MAT-VIDT6", "mat", "MAT-811", "Vidrio templado 6 mm", "m²", 115, 39, "Vidrios y aluminio"],
  ["MAT-VIDT10", "mat", "MAT-812", "Vidrio templado 10 mm", "m²", 175, 39, "Vidrios y aluminio"],
  ["MAT-VIDT12", "mat", "MAT-813", "Vidrio templado 12 mm", "m²", 210, 39, "Vidrios y aluminio"],
  ["MAT-VIDL44", "mat", "MAT-814", "Vidrio laminado 4+4 mm", "m²", 125, 39, "Vidrios y aluminio"],
  ["MAT-VIDL55", "mat", "MAT-815", "Vidrio laminado 5+5 mm", "m²", 145, 39, "Vidrios y aluminio"],
  ["MAT-VIDL88", "mat", "MAT-816", "Vidrio laminado 8+8 mm", "m²", 210, 39, "Vidrios y aluminio"],
  ["MAT-VIDDVH", "mat", "MAT-817", "DVH 6/12/6 mm (cámara 12 mm)", "m²", 185, 39, "Vidrios y aluminio"],
  ["MAT-VIDDVHT", "mat", "MAT-818", "DVH templado 6/12/6 mm", "m²", 245, 39, "Vidrios y aluminio"],
  ["MAT-ESP3", "mat", "MAT-819", "Espejo 3 mm", "m²", 52, 39, "Vidrios y aluminio"],
  ["MAT-ESP5", "mat", "MAT-820", "Espejo 5 mm", "m²", 78, 39, "Vidrios y aluminio"],
  ["MAT-ESP6", "mat", "MAT-821", "Espejo 6 mm", "m²", 92, 39, "Vidrios y aluminio"],
  ["MAT-SILN", "mat", "MAT-822", "Silicona neutra para vidrio (cartucho)", "und", 18, 39, "Vidrios y aluminio"],
  ["MAT-SILE", "mat", "MAT-823", "Silicona estructural para fachada (cartucho)", "und", 32, 39, "Vidrios y aluminio"],
  ["MAT-BURVID", "mat", "MAT-824", "Burlete de vidrio EPDM", "m", 6.5, 39, "Vidrios y aluminio"],
  ["MAT-JUNVID", "mat", "MAT-825", "Junquillo / tapajuntas de aluminio", "m", 8.5, 52, "Vidrios y aluminio"],

  // —— Aluminio: perfiles y carpintería ——
  ["MAT-ALU32", "mat", "MAT-826", "Perfil de aluminio serie 32", "m", 22, 52, "Vidrios y aluminio"],
  ["MAT-ALU42", "mat", "MAT-827", "Perfil de aluminio serie 42", "m", 28, 52, "Vidrios y aluminio"],
  ["MAT-ALU50", "mat", "MAT-828", "Perfil de aluminio serie 50", "m", 36, 52, "Vidrios y aluminio"],
  ["MAT-ALU80", "mat", "MAT-829", "Perfil de aluminio serie 80 (fachada)", "m", 58, 52, "Vidrios y aluminio"],
  ["MAT-ALUNAT", "mat", "MAT-830", "Perfil de aluminio natural (sin pintar)", "m", 16, 52, "Vidrios y aluminio"],
  ["MAT-ALUBL", "mat", "MAT-831", "Perfil de aluminio blanco electrostático", "m", 21, 52, "Vidrios y aluminio"],
  ["MAT-ALUNEG", "mat", "MAT-832", "Perfil de aluminio negro electrostático", "m", 24, 52, "Vidrios y aluminio"],
  ["MAT-VENCOR", "mat", "MAT-833", "Ventana corrediza de aluminio + vidrio 6 mm", "m²", 295, 52, "Vidrios y aluminio"],
  ["MAT-VENPRO", "mat", "MAT-834", "Ventana proyectante de aluminio + vidrio 6 mm", "m²", 320, 52, "Vidrios y aluminio"],
  ["MAT-VENOSC", "mat", "MAT-835", "Ventana oscilobatiente de aluminio + vidrio 6 mm", "m²", 365, 52, "Vidrios y aluminio"],
  ["MAT-VENFIX", "mat", "MAT-836", "Paño fijo de aluminio + vidrio 6 mm", "m²", 240, 52, "Vidrios y aluminio"],
  ["MAT-VENDVH", "mat", "MAT-837", "Ventana de aluminio + DVH 6/12/6 mm", "m²", 420, 52, "Vidrios y aluminio"],
  ["MAT-PUEALU", "mat", "MAT-838", "Puerta de aluminio + vidrio 6 mm", "m²", 380, 52, "Vidrios y aluminio"],
  ["MAT-PUEALUT", "mat", "MAT-839", "Puerta de aluminio + vidrio templado 8 mm", "m²", 480, 52, "Vidrios y aluminio"],
  ["MAT-MAM10", "mat", "MAT-840", "Mampara de ducha templado 10 mm", "und", 580, 39, "Vidrios y aluminio"],
  ["MAT-BARVID", "mat", "MAT-841", "Baranda de vidrio templado 10 mm + pasamano", "m", 420, 39, "Vidrios y aluminio"],
  ["MAT-FACHVID", "mat", "MAT-842", "Muro cortina / fachada de aluminio + vidrio", "m²", 650, 52, "Vidrios y aluminio"],
  ["MAT-CELALU", "mat", "MAT-843", "Celosía / reja de aluminio", "m²", 185, 52, "Vidrios y aluminio"],
  ["MAT-MOSCOR", "mat", "MAT-844", "Mosquitero corredizo de aluminio", "m²", 62, 52, "Vidrios y aluminio"],
  ["MAT-CIEALU", "mat", "MAT-845", "Cierre / chapuza de aluminio", "m", 14, 52, "Vidrios y aluminio"],
  ["MAT-ACCALU", "mat", "MAT-846", "Herraje para ventana de aluminio (juego)", "und", 38, 26, "Vidrios y aluminio"],

  // —— Pisos complementarios (mármol, granito, vinílico, epóxico) ——
  ["MAT-MAR2", "mat", "MAT-847", "Mármol pulido e=2 cm", "m²", 185, 64, "Pisos y revestimientos"],
  ["MAT-MAR3", "mat", "MAT-848", "Mármol pulido e=3 cm", "m²", 245, 64, "Pisos y revestimientos"],
  ["MAT-MARTRA", "mat", "MAT-849", "Travertino pulido e=2 cm", "m²", 165, 64, "Pisos y revestimientos"],
  ["MAT-GRA3", "mat", "MAT-850", "Granito pulido e=3 cm", "m²", 125, 64, "Pisos y revestimientos"],
  ["MAT-GRAESC", "mat", "MAT-851", "Granito para escalón (huella + contrapaso)", "m", 95, 64, "Pisos y revestimientos"],
  ["MAT-LAMAC5", "mat", "MAT-852", "Piso laminado AC5", "m²", 62, 41, "Pisos y revestimientos"],
  ["MAT-SPC4", "mat", "MAT-853", "Piso SPC / vinílico rígido 4 mm", "m²", 58, 16, "Pisos y revestimientos"],
  ["MAT-SPC5", "mat", "MAT-854", "Piso SPC / vinílico rígido 5 mm", "m²", 68, 16, "Pisos y revestimientos"],
  ["MAT-LVT2", "mat", "MAT-855", "Piso LVT autoadhesivo 2 mm", "m²", 38, 16, "Pisos y revestimientos"],
  ["MAT-LVT3", "mat", "MAT-856", "Piso LVT click 3 mm", "m²", 52, 16, "Pisos y revestimientos"],
  ["MAT-GOMA", "mat", "MAT-857", "Piso de caucho / goma 4 mm", "m²", 85, 16, "Pisos y revestimientos"],
  ["MAT-EPOXP", "mat", "MAT-858", "Piso epóxico autonivelante (suministro)", "m²", 48, 54, "Pisos y revestimientos"],
  ["MAT-ALFOM", "mat", "MAT-859", "Alfombra modular 50×50 cm", "m²", 72, 16, "Pisos y revestimientos"],
  ["MAT-PULIC", "mat", "MAT-860", "Pulido y sellado de concreto (insumo)", "m²", 18, 39, "Pisos y revestimientos"],
  ["MAT-NIVEL", "mat", "MAT-861", "Mortero autonivelante para piso", "bls", 38, 21, "Pisos y revestimientos"],
  ["MAT-FRAEPO", "mat", "MAT-862", "Fragua epóxica", "kg", 18, 39, "Pisos y revestimientos"],
  ["MAT-PERFVIN", "mat", "MAT-863", "Perfil de transición / guardaescopa vinílico", "m", 12, 16, "Pisos y revestimientos"],
  ["MAT-ZOCWOOD", "mat", "MAT-864", "Zócalo MDF / madera 8 cm", "m", 9.5, 41, "Pisos y revestimientos"],

  // —— Carpintería y cerrajería ——
  ["MAT-PUE60", "mat", "MAT-865", "Puerta contraplacada 0.60×2.10 m", "und", 280, 44, "Carpintería y cerrajería"],
  ["MAT-PUE100", "mat", "MAT-866", "Puerta contraplacada 1.00×2.10 m", "und", 420, 44, "Carpintería y cerrajería"],
  ["MAT-PUEMAD", "mat", "MAT-867", "Puerta de madera tornillo 0.90×2.10 m", "und", 680, 44, "Carpintería y cerrajería"],
  ["MAT-PUECED", "mat", "MAT-868", "Puerta de cedro 0.90×2.10 m", "und", 980, 44, "Carpintería y cerrajería"],
  ["MAT-PUECOR", "mat", "MAT-869", "Puerta corrediza de madera 0.90×2.10 m", "und", 750, 44, "Carpintería y cerrajería"],
  ["MAT-PUEPIV", "mat", "MAT-870", "Puerta pivotante de madera 1.00×2.40 m", "und", 1450, 44, "Carpintería y cerrajería"],
  ["MAT-PUEVAH", "mat", "MAT-871", "Puerta vaivén / sándwich 0.90×2.10 m", "und", 520, 44, "Carpintería y cerrajería"],
  ["MAT-PUECI60", "mat", "MAT-872", "Puerta contra incendio 60 min", "und", 1450, 26, "Carpintería y cerrajería"],
  ["MAT-PUECI120", "mat", "MAT-873", "Puerta contra incendio 120 min", "und", 2250, 26, "Carpintería y cerrajería"],
  ["MAT-VENMAD", "mat", "MAT-874", "Ventana de madera + vidrio 6 mm", "m²", 420, 44, "Carpintería y cerrajería"],
  ["MAT-CERJ4", "mat", "MAT-875", "Cerradura embutir 4 golpes", "und", 125, 26, "Carpintería y cerrajería"],
  ["MAT-CERDIG", "mat", "MAT-876", "Cerradura digital / biométrica", "und", 480, 26, "Carpintería y cerrajería"],
  ["MAT-BIS4", "mat", "MAT-877", "Bisagra 4\" × 4\"", "und", 8.5, 26, "Carpintería y cerrajería"],
  ["MAT-CIERRE", "mat", "MAT-878", "Cierra-puertas hidráulico", "und", 85, 26, "Carpintería y cerrajería"],
  ["MAT-PICIN", "mat", "MAT-879", "Manija inox para puerta", "und", 45, 26, "Carpintería y cerrajería"],
  ["MAT-PASAM", "mat", "MAT-880", "Pasador / pestillo de seguridad", "und", 18, 26, "Carpintería y cerrajería"],
  ["MAT-TOPE", "mat", "MAT-881", "Tope de puerta", "und", 8.5, 26, "Carpintería y cerrajería"],

  // —— Ladrillos y bloques ——
  ["MAT-KK8", "mat", "MAT-882", "Ladrillo KK 8 huecos Tipo III 24×13×9 cm (NTP 331.017)", "und", 0.78, 17, "Ladrillos y bloques"],
  ["MAT-TEJACO", "mat", "MAT-883", "Teja colonial", "und", 3.2, 17, "Ladrillos y bloques"],
  ["MAT-BLOQ20", "mat", "MAT-884", "Bloque de concreto 20×20×40 cm f'c 70 kg/cm² (NTP 339.621)", "und", 4.5, 17, "Ladrillos y bloques"],
  ["MAT-BLOQAL", "mat", "MAT-885", "Bloque de concreto aligerado 15×20×40 cm f'c 50 kg/cm²", "und", 3.4, 17, "Ladrillos y bloques"],
  ["MAT-LADPAST", "mat", "MAT-886", "Ladrillo pastelero", "und", 0.55, 17, "Ladrillos y bloques"],
  ["MAT-LADCAR", "mat", "MAT-887", "Ladrillo caravista", "und", 1.85, 17, "Ladrillos y bloques"],

  // —— Fletes, alumbrado y áreas verdes ——
  ["MAT-FLETEL", "mat", "MAT-888", "Flete local (viaje 6 m³)", "viaje", 180, 39, "Fletes y servicios"],
  ["MAT-FLETEI", "mat", "MAT-889", "Flete interprovincial (t)", "t", 95, 39, "Fletes y servicios"],
  ["MAT-FLETEM", "mat", "MAT-890", "Flete de maquinaria (viaje)", "viaje", 450, 39, "Fletes y servicios"],
  ["MAT-IZAJ", "mat", "MAT-891", "Izaje / montacargas (viaje)", "viaje", 320, 39, "Fletes y servicios"],
  ["MAT-POSTE12", "mat", "MAT-892", "Poste de concreto 12 m alumbrado público", "und", 1650, 62, "Alumbrado público y urbana"],
  ["MAT-LUMAP50", "mat", "MAT-893", "Luminaria LED alumbrado público 50 W", "und", 280, 11, "Alumbrado público y urbana"],
  ["MAT-LUMAP150", "mat", "MAT-894", "Luminaria LED alumbrado público 150 W", "und", 580, 11, "Alumbrado público y urbana"],
  ["MAT-BRAZOAP", "mat", "MAT-895", "Brazo / ménsula para luminaria AP", "und", 85, 51, "Alumbrado público y urbana"],
  ["MAT-CABLEAP4", "mat", "MAT-896", "Cable NYY 2×10 mm² alumbrado público", "m", 12, 19, "Alumbrado público y urbana"],
  ["MAT-ARBFRU", "mat", "MAT-897", "Árbol frutal h=1.80 m", "und", 38, 39, "Áreas verdes"],
  ["MAT-ARBOR", "mat", "MAT-898", "Arbusto ornamental h=0.80 m", "und", 18, 39, "Áreas verdes"],
  ["MAT-CESPSEM", "mat", "MAT-899", "Semilla de césped (kg)", "kg", 28, 39, "Áreas verdes"],
  ["MAT-TIERJ", "mat", "MAT-900", "Tierra agrícola / compost", "m³", 48, 39, "Áreas verdes"],
  ["MAT-MULCH", "mat", "MAT-901", "Cobertura / mulch", "m³", 65, 39, "Áreas verdes"],
  ["MAT-RIEGOG", "mat", "MAT-902", "Gotero y tubería de riego por goteo", "m", 6.5, 72, "Áreas verdes"],
];

export const INSUMOS_ACABADOS: Insumo[] = RAW.map((r) => i(...r));
