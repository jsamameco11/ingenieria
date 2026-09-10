/** Sobrecargas mínimas de la Norma E.020 (kg/m²). Valores de Tabla 1 y Art. 6.4. */
export type UsoE020 = {
  id: string;
  grupo: string;
  label: string;
  sc: number;
  tabique: number;
};

export const USOS_E020: UsoE020[] = [
  { id: "vivienda", grupo: "Residencial", label: "Vivienda — dormitorios, salas, comedores, cocinas", sc: 200, tabique: 150 },
  { id: "escalera-viv", grupo: "Residencial", label: "Escaleras en vivienda", sc: 300, tabique: 0 },
  { id: "azotea-no", grupo: "Residencial", label: "Azotea no transitable", sc: 100, tabique: 0 },
  { id: "azotea-si", grupo: "Residencial", label: "Azotea / terraza transitable", sc: 200, tabique: 0 },
  { id: "oficina", grupo: "Oficinas", label: "Oficinas y despachos", sc: 250, tabique: 100 },
  { id: "archivo", grupo: "Oficinas", label: "Archivos y depósitos de documentos", sc: 500, tabique: 0 },
  { id: "aula", grupo: "Educación", label: "Centros de educación — aulas", sc: 250, tabique: 100 },
  { id: "corredor-pub", grupo: "Educación", label: "Corredores y escaleras de uso público", sc: 400, tabique: 0 },
  { id: "lectura", grupo: "Bibliotecas", label: "Bibliotecas — salas de lectura", sc: 300, tabique: 80 },
  { id: "biblio-estantes", grupo: "Bibliotecas", label: "Bibliotecas — estantes fijos (no apilables)", sc: 750, tabique: 0 },
  { id: "hospital-hab", grupo: "Salud", label: "Hospitales — habitaciones", sc: 200, tabique: 80 },
  { id: "hospital-qx", grupo: "Salud", label: "Hospitales — quirófanos y laboratorios", sc: 300, tabique: 80 },
  { id: "comercio", grupo: "Comercio", label: "Locales comerciales y tiendas", sc: 500, tabique: 50 },
  { id: "restaurante", grupo: "Comercio", label: "Restaurantes", sc: 400, tabique: 50 },
  { id: "asientos", grupo: "Reunión", label: "Teatros y cines — asientos fijos", sc: 400, tabique: 0 },
  { id: "asamblea", grupo: "Reunión", label: "Gimnasios y asambleas sin asientos fijos", sc: 500, tabique: 0 },
  { id: "estacionamiento", grupo: "Estacionamiento", label: "Estacionamiento de vehículos ligeros", sc: 250, tabique: 0 },
  { id: "estacionamiento-pesado", grupo: "Estacionamiento", label: "Estacionamiento de vehículos pesados", sc: 500, tabique: 0 },
  { id: "industria-ligera", grupo: "Industria", label: "Industria ligera", sc: 500, tabique: 0 },
  { id: "industria-pesada", grupo: "Industria", label: "Industria pesada", sc: 750, tabique: 0 },
  { id: "almacen-ligero", grupo: "Almacenaje", label: "Almacenaje ligero", sc: 500, tabique: 0 },
  { id: "almacen-estantes", grupo: "Almacenaje", label: "Almacenaje con estantes fijos (E.020 Art. 6.4)", sc: 750, tabique: 0 },
  { id: "almacen-apilable", grupo: "Almacenaje", label: "Almacenaje apilable / depósito pesado", sc: 750, tabique: 0 },
];

export const USO_VIVIENDA = USOS_E020[0];

export function usoE020(id: string) {
  return USOS_E020.find((u) => u.id === id) ?? USO_VIVIENDA;
}

/** Peso propio de losa (kg/m²), pesos unitarios E.020 / metrado típico. */
export function pesoLosa(tipo: string, h: number) {
  if (tipo === "maciza") return 2400 * h;
  if (tipo === "nervada") return 150 + 900 * h;
  return 150 + 800 * h;
}

export const ACABADOS = 100;
