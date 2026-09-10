import type { Insumo, RecursoKind } from "./types";

type Row = [string, RecursoKind, string, string, string, number, number, string];

function i(id: string, kind: RecursoKind, codigo: string, nombre: string, und: string, precio: number, iu: number, categoria: string): Insumo {
  return { id, kind, codigo, nombre, und, precio, iu, categoria };
}

/**
 * Insumos de puertas, ventanas, perfiles y vidrios (nombres técnicos de obra).
 * «Luna cruda» = vidrio recocido float. Espejo = luna plateada.
 * Precios de referencia S/ Lima; catálogo editable.
 */
const RAW: Row[] = [
  ["MAT-ESPUMAPU", "mat", "MAT-1900", "Espuma de poliuretano expansiva para marcos (botella 750 ml)", "und", 18, 39, "Carpintería y cerrajería"],
  ["MAT-TACOMAD", "mat", "MAT-1901", "Taco de madera / tarugo de fijación de marco", "und", 0.8, 43, "Carpintería y cerrajería"],
  ["MAT-ANCLAALU", "mat", "MAT-1902", "Anclaje / tornillo de fijación para carpintería de aluminio", "und", 1.2, 37, "Vidrios y aluminio"],
  ["MAT-JUNQMAD", "mat", "MAT-1903", "Junquillo de madera 12×12 mm", "m", 4.5, 43, "Carpintería y cerrajería"],
  ["MAT-PASADOR", "mat", "MAT-1904", "Pasador embutir / pestillo de dos hojas", "und", 22, 26, "Carpintería y cerrajería"],
  ["MAT-CIERRP", "mat", "MAT-1905", "Cierrapuertas hidráulico brazo paralelo", "und", 95, 26, "Carpintería y cerrajería"],

  ["MAT-PUECP60", "mat", "MAT-1910", "Puerta contraplacada 1 hoja 0.60×2.10 m, e=35 mm, cara triplay okumé 3.2 mm, alma de listones, c/marco", "und", 275, 44, "Carpintería y cerrajería"],
  ["MAT-PUECP90H220", "mat", "MAT-1911", "Puerta contraplacada 1 hoja 0.90×2.20 m, e=35 mm, cara triplay okumé 3.2 mm, c/marco", "und", 420, 44, "Carpintería y cerrajería"],
  ["MAT-PUECP100H220", "mat", "MAT-1912", "Puerta contraplacada 1 hoja 1.00×2.20 m, e=40 mm, cara triplay okumé 3.2 mm, c/marco", "und", 480, 44, "Carpintería y cerrajería"],
  ["MAT-PUECP2H120", "mat", "MAT-1913", "Puerta contraplacada 2 hojas 1.20×2.10 m (0.60+0.60), e=35 mm, c/marco", "und", 620, 44, "Carpintería y cerrajería"],
  ["MAT-PUECP2H140", "mat", "MAT-1914", "Puerta contraplacada 2 hojas 1.40×2.10 m (0.70+0.70), e=35 mm, c/marco", "und", 720, 44, "Carpintería y cerrajería"],
  ["MAT-PUECP2H160", "mat", "MAT-1915", "Puerta contraplacada 2 hojas 1.60×2.10 m (0.80+0.80), e=35 mm, c/marco", "und", 820, 44, "Carpintería y cerrajería"],
  ["MAT-PUECP2H180", "mat", "MAT-1916", "Puerta contraplacada 2 hojas 1.80×2.10 m (0.90+0.90), e=40 mm, c/marco", "und", 960, 44, "Carpintería y cerrajería"],
  ["MAT-PUECP2H200", "mat", "MAT-1917", "Puerta contraplacada 2 hojas 2.00×2.10 m (1.00+1.00), e=40 mm, c/marco", "und", 1080, 44, "Carpintería y cerrajería"],

  ["MAT-PUEMDF90", "mat", "MAT-1920", "Puerta de tablero MDF 18 mm 1 hoja 0.90×2.10 m, c/marco de pino", "und", 310, 44, "Carpintería y cerrajería"],
  ["MAT-PUEHDF90", "mat", "MAT-1921", "Puerta de tablero HDF 5.5 mm sobre alma 1 hoja 0.90×2.10 m, c/marco", "und", 295, 44, "Carpintería y cerrajería"],
  ["MAT-PUEMEL90", "mat", "MAT-1922", "Puerta de melamina 18 mm 1 hoja 0.90×2.10 m, canto ABS, c/marco", "und", 340, 44, "Carpintería y cerrajería"],
  ["MAT-PUEENT90", "mat", "MAT-1923", "Puerta entablerada de madera 1 hoja 0.90×2.10 m, e=40 mm, c/marco", "und", 780, 44, "Carpintería y cerrajería"],
  ["MAT-PUECAO90", "mat", "MAT-1924", "Puerta de madera caoba 1 hoja 0.90×2.10 m, e=45 mm, c/marco", "und", 1450, 44, "Carpintería y cerrajería"],
  ["MAT-PUEPIN90", "mat", "MAT-1925", "Puerta de madera pino 1 hoja 0.90×2.10 m, e=40 mm, c/marco", "und", 520, 44, "Carpintería y cerrajería"],
  ["MAT-PUETOR2H", "mat", "MAT-1926", "Puerta de madera tornillo 2 hojas 1.60×2.10 m, e=45 mm, c/marco", "und", 1380, 44, "Carpintería y cerrajería"],
  ["MAT-PUECED2H", "mat", "MAT-1927", "Puerta de madera cedro 2 hojas 1.80×2.10 m, e=45 mm, c/marco", "und", 2100, 44, "Carpintería y cerrajería"],
  ["MAT-PUEPLEG90", "mat", "MAT-1928", "Puerta plegable de madera / MDF 0.90×2.10 m, 4 tablillas, riel superior", "und", 480, 44, "Carpintería y cerrajería"],
  ["MAT-PUEPVC90", "mat", "MAT-1929", "Puerta de PVC 1 hoja 0.90×2.10 m, panel sándwich, c/marco", "und", 560, 44, "Carpintería y cerrajería"],
  ["MAT-PUEPVC2H", "mat", "MAT-1930", "Puerta de PVC 2 hojas 1.60×2.10 m, panel sándwich, c/marco", "und", 980, 44, "Carpintería y cerrajería"],
  ["MAT-PUEMET90", "mat", "MAT-1931", "Puerta metálica 1 hoja 0.90×2.10 m, chapa galvanizada e=0.80 mm, alma PU, c/marco", "und", 720, 26, "Carpintería y cerrajería"],
  ["MAT-PUEMET2H", "mat", "MAT-1932", "Puerta metálica 2 hojas 1.60×2.10 m, chapa galvanizada e=0.80 mm, c/marco", "und", 1280, 26, "Carpintería y cerrajería"],
  ["MAT-PUEVID90", "mat", "MAT-1933", "Puerta de madera 1 hoja 0.90×2.10 m con luna (vidrio recocido float 4 mm) 0.40×1.00 m", "und", 620, 44, "Carpintería y cerrajería"],
  ["MAT-PUEVID2H", "mat", "MAT-1934", "Puerta de madera 2 hojas 1.60×2.10 m con luna (vidrio recocido float 4 mm)", "und", 1180, 44, "Carpintería y cerrajería"],
  ["MAT-PUEALU1H", "mat", "MAT-1935", "Puerta de aluminio serie 42 1 hoja 0.90×2.10 m + vidrio recocido float 6 mm", "und", 890, 52, "Vidrios y aluminio"],
  ["MAT-PUEALU2H", "mat", "MAT-1936", "Puerta de aluminio serie 42 2 hojas 1.60×2.10 m + vidrio recocido float 6 mm", "und", 1580, 52, "Vidrios y aluminio"],
  ["MAT-PUEALUT1H", "mat", "MAT-1937", "Puerta de aluminio serie 50 1 hoja 0.90×2.10 m + vidrio templado 8 mm", "und", 1280, 52, "Vidrios y aluminio"],

  ["MAT-VENALU25C", "mat", "MAT-1940", "Ventana corrediza de aluminio serie 25 + vidrio recocido float 4 mm", "m²", 245, 52, "Vidrios y aluminio"],
  ["MAT-VENALU32C", "mat", "MAT-1941", "Ventana corrediza de aluminio serie 32 + vidrio recocido float 6 mm", "m²", 295, 52, "Vidrios y aluminio"],
  ["MAT-VENALU42C", "mat", "MAT-1942", "Ventana corrediza de aluminio serie 42 + vidrio recocido float 6 mm", "m²", 335, 52, "Vidrios y aluminio"],
  ["MAT-VENALU50C", "mat", "MAT-1943", "Ventana corrediza de aluminio serie 50 + vidrio recocido float 6 mm", "m²", 385, 52, "Vidrios y aluminio"],
  ["MAT-VENALU32B1", "mat", "MAT-1944", "Ventana batiente 1 hoja de aluminio serie 32 + vidrio recocido float 6 mm", "m²", 340, 52, "Vidrios y aluminio"],
  ["MAT-VENALU32B2", "mat", "MAT-1945", "Ventana batiente 2 hojas de aluminio serie 32 + vidrio recocido float 6 mm", "m²", 365, 52, "Vidrios y aluminio"],
  ["MAT-VENALU42P", "mat", "MAT-1946", "Ventana proyectante de aluminio serie 42 + vidrio recocido float 6 mm", "m²", 355, 52, "Vidrios y aluminio"],
  ["MAT-VENALU42O", "mat", "MAT-1947", "Ventana oscilobatiente de aluminio serie 42 + vidrio recocido float 6 mm", "m²", 410, 52, "Vidrios y aluminio"],
  ["MAT-VENALU50F", "mat", "MAT-1948", "Paño fijo de aluminio serie 50 + vidrio recocido float 6 mm", "m²", 275, 52, "Vidrios y aluminio"],
  ["MAT-VENALU50DVH", "mat", "MAT-1949", "Ventana corrediza de aluminio serie 50 + DVH 6/12/6 mm", "m²", 520, 52, "Vidrios y aluminio"],
  ["MAT-VENALU50TEM", "mat", "MAT-1950", "Ventana corrediza de aluminio serie 50 + vidrio templado 8 mm", "m²", 465, 52, "Vidrios y aluminio"],
  ["MAT-VENPVC4", "mat", "MAT-1951", "Ventana corrediza de PVC + vidrio recocido float 4 mm", "m²", 265, 52, "Vidrios y aluminio"],
  ["MAT-VENPVC6", "mat", "MAT-1952", "Ventana corrediza de PVC + vidrio recocido float 6 mm", "m²", 310, 52, "Vidrios y aluminio"],
  ["MAT-VENPVCDVH", "mat", "MAT-1953", "Ventana de PVC + DVH 6/12/6 mm", "m²", 480, 52, "Vidrios y aluminio"],
  ["MAT-VENFIE4", "mat", "MAT-1954", "Ventana de fierro / acero 1 hoja + vidrio recocido float 4 mm", "m²", 220, 26, "Vidrios y aluminio"],
  ["MAT-VENFIE6", "mat", "MAT-1955", "Ventana de fierro / acero 2 hojas + vidrio recocido float 6 mm", "m²", 255, 26, "Vidrios y aluminio"],
  ["MAT-VENCEL", "mat", "MAT-1956", "Ventana de celosía / persiana de aluminio (sin vidrio)", "m²", 195, 52, "Vidrios y aluminio"],
  ["MAT-VENMAD4", "mat", "MAT-1957", "Ventana de madera 1 hoja + vidrio recocido float 4 mm", "m²", 380, 44, "Carpintería y cerrajería"],
  ["MAT-VENMAD6", "mat", "MAT-1958", "Ventana de madera 2 hojas + vidrio recocido float 6 mm", "m²", 450, 44, "Carpintería y cerrajería"],
  ["MAT-VENOSCU6", "mat", "MAT-1959", "Ventana de aluminio serie 32 + vidrio opaco / acidado 6 mm", "m²", 355, 52, "Vidrios y aluminio"],
  ["MAT-VENESP4", "mat", "MAT-1960", "Ventana de aluminio serie 32 + espejo plateado 4 mm (luna espejo)", "m²", 340, 52, "Vidrios y aluminio"],

  ["MAT-FLOAT8", "mat", "MAT-1965", "Vidrio recocido float 8 mm (luna cruda / vidrio recocido)", "m²", 72, 39, "Vidrios y aluminio"],
  ["MAT-TEMP8", "mat", "MAT-1966", "Vidrio de seguridad templado 8 mm (NTP 333.001)", "m²", 145, 39, "Vidrios y aluminio"],
  ["MAT-LAM33", "mat", "MAT-1967", "Vidrio laminado de seguridad 3+3 mm (PVB 0.38 mm)", "m²", 112, 39, "Vidrios y aluminio"],
  ["MAT-LAM66", "mat", "MAT-1968", "Vidrio laminado de seguridad 6+6 mm (PVB 0.38 mm)", "m²", 165, 39, "Vidrios y aluminio"],
  ["MAT-DVH8128", "mat", "MAT-1969", "Unidad de vidrio aislante DVH 8/12/8 mm", "m²", 245, 39, "Vidrios y aluminio"],
  ["MAT-ESPLUNA4", "mat", "MAT-1970", "Espejo plateado 4 mm (luna espejo, canto pulido)", "m²", 68, 39, "Vidrios y aluminio"],
  ["MAT-VIDSER6", "mat", "MAT-1971", "Vidrio serigrafiado / esmaltado 6 mm", "m²", 95, 39, "Vidrios y aluminio"],
  ["MAT-VIDPOL6", "mat", "MAT-1972", "Vidrio polarizado / control solar 6 mm", "m²", 88, 39, "Vidrios y aluminio"],

  ["MAT-VENGIL6", "mat", "MAT-1973", "Ventana guillotina de aluminio serie 32 + vidrio recocido float 6 mm", "m²", 370, 52, "Vidrios y aluminio"],
  ["MAT-VENBAS6", "mat", "MAT-1974", "Ventana basculante de aluminio serie 32 + vidrio recocido float 6 mm", "m²", 350, 52, "Vidrios y aluminio"],
  ["MAT-VENALU32C3", "mat", "MAT-1975", "Ventana corrediza 3 hojas de aluminio serie 32 + vidrio recocido float 6 mm", "m²", 355, 52, "Vidrios y aluminio"],
  ["MAT-VENALU42B1", "mat", "MAT-1976", "Ventana batiente 1 hoja de aluminio serie 42 + vidrio recocido float 6 mm", "m²", 375, 52, "Vidrios y aluminio"],
  ["MAT-VENALU42B2", "mat", "MAT-1977", "Ventana batiente 2 hojas de aluminio serie 42 + vidrio recocido float 6 mm", "m²", 400, 52, "Vidrios y aluminio"],
  ["MAT-VENALU50DVHT", "mat", "MAT-1978", "Ventana corrediza de aluminio serie 50 + DVH templado 6/12/6 mm", "m²", 590, 52, "Vidrios y aluminio"],
  ["MAT-PUETEM10", "mat", "MAT-1979", "Puerta de vidrio templado 10 mm 0.90×2.10 m, herrajes pivot / patch fitting inox, sin marco", "und", 1450, 39, "Vidrios y aluminio"],
  ["MAT-PUETEM2H", "mat", "MAT-1980", "Puerta de vidrio templado 10 mm 2 hojas 1.60×2.10 m, herrajes pivot / patch fitting inox", "und", 2680, 39, "Vidrios y aluminio"],
  ["MAT-PUECP80H220", "mat", "MAT-1981", "Puerta contraplacada 1 hoja 0.80×2.20 m, e=35 mm, cara triplay okumé 3.2 mm, c/marco", "und", 390, 44, "Carpintería y cerrajería"],
  ["MAT-PUECP90H240", "mat", "MAT-1982", "Puerta contraplacada 1 hoja 0.90×2.40 m, e=40 mm, cara triplay okumé 3.2 mm, c/marco", "und", 480, 44, "Carpintería y cerrajería"],
  ["MAT-VENMADB1", "mat", "MAT-1983", "Ventana batiente 1 hoja de madera + vidrio recocido float 4 mm", "m²", 400, 44, "Carpintería y cerrajería"],
  ["MAT-VENMADB2", "mat", "MAT-1984", "Ventana batiente 2 hojas de madera + vidrio recocido float 6 mm", "m²", 470, 44, "Carpintería y cerrajería"],
  ["MAT-PERFPVC", "mat", "MAT-1985", "Perfil de PVC para ventana / puerta (marco / hoja)", "m", 24, 52, "Vidrios y aluminio"],
];

export const INSUMOS_PUERTAS_VENTANAS: Insumo[] = RAW.map((row) => i(...row));
