export type GrupoNoticias =
  | "Economía y producción"
  | "Tecnología y ciencia"
  | "Seguridad y justicia"
  | "Deporte"
  | "Mundo y sociedad"
  | "Política";

export type CategoriaNoticia = {
  id: string;
  numero: number;
  nombre: string;
  grupo: GrupoNoticias;
  descripcion: string;
  /** Color editorial de portadas. */
  color: string;
};

export const CATEGORIAS: CategoriaNoticia[] = [
  // ── Economía y producción ──
  { id: "industria", numero: 1, nombre: "Industria", grupo: "Economía y producción", descripcion: "Manufactura, minería, producción, parques industriales y cadenas de suministro en Perú y el mundo.", color: "#f59e0b" },
  { id: "economia-finanzas", numero: 2, nombre: "Economía y Finanzas", grupo: "Economía y producción", descripcion: "PBI, inflación, dólar, BCRP, MEF, bolsas, tasas y empleo.", color: "#10b981" },
  { id: "energia", numero: 3, nombre: "Energía", grupo: "Economía y producción", descripcion: "Petróleo, gas de Camisea, hidroeléctricas, solares, tarifas y transición energética.", color: "#eab308" },
  { id: "agricultura-alimentacion", numero: 4, nombre: "Agricultura y Alimentación", grupo: "Economía y producción", descripcion: "Agroexportación, arándanos, café, papa, riego, Midagri y precios en chacra.", color: "#22c55e" },
  { id: "emprendimiento-startups", numero: 5, nombre: "Emprendimiento y Startups", grupo: "Economía y producción", descripcion: "Mypes, startups peruanas, venture capital, e-commerce y formalización.", color: "#8b5cf6" },
  // ── Tecnología y ciencia ──
  { id: "tecnologia", numero: 6, nombre: "Tecnología", grupo: "Tecnología y ciencia", descripcion: "Lanzamientos, plataformas, semiconductores, telecomunicaciones y adopción digital.", color: "#3b82f6" },
  { id: "inteligencia-artificial", numero: 7, nombre: "Inteligencia Artificial", grupo: "Tecnología y ciencia", descripcion: "Modelos abiertos, regulación, adopción empresarial y riesgos.", color: "#6366f1" },
  { id: "ingenieria", numero: 8, nombre: "Ingeniería", grupo: "Tecnología y ciencia", descripcion: "Obras, puentes, represas, civil, mecánica, eléctrica y supervisión técnica.", color: "#f97316" },
  { id: "ciencias", numero: 9, nombre: "Ciencias", grupo: "Tecnología y ciencia", descripcion: "Física, química, biología, investigación universitaria y papers revisados.", color: "#14b8a6" },
  { id: "medicina-salud", numero: 10, nombre: "Medicina y Salud", grupo: "Tecnología y ciencia", descripcion: "Salud pública, hospitales, vacunas, brotes, nutrición y política sanitaria.", color: "#ef4444" },
  { id: "ciberseguridad", numero: 11, nombre: "Ciberseguridad", grupo: "Tecnología y ciencia", descripcion: "Ciberataques, ransomware, estafas digitales, protección de datos y banca.", color: "#0ea5e9" },
  { id: "espacio-astronomia", numero: 12, nombre: "Espacio y Astronomía", grupo: "Tecnología y ciencia", descripcion: "NASA, ESA, lanzamientos, satélite PerúSAT, eclipses y astronomía andina.", color: "#7c3aed" },
  // ── Seguridad y justicia ──
  { id: "delincuencia-seguridad-ciudadana", numero: 13, nombre: "Delincuencia y Seguridad Ciudadana", grupo: "Seguridad y justicia", descripcion: "Robos, homicidios, operativos PNP, serenazgo y percepción de inseguridad.", color: "#dc2626" },
  { id: "extorsion-sicariato", numero: 14, nombre: "Extorsión y Sicariato", grupo: "Seguridad y justicia", descripcion: "Cobro de cupos, amenazas a negocios y transportistas, sicariato y respuesta fiscal.", color: "#991b1b" },
  { id: "derechos-justicia", numero: 15, nombre: "Derechos y Justicia", grupo: "Seguridad y justicia", descripcion: "Poder Judicial, Fiscalía, juicios emblemáticos, DD.HH. y acceso a justicia.", color: "#475569" },
  // ── Deporte ──
  { id: "futbol-peruano", numero: 16, nombre: "Fútbol Peruano", grupo: "Deporte", descripcion: "Liga 1, selección peruana, Universitario, Alianza, Cristal, Melgar y Copa Perú.", color: "#16a34a" },
  { id: "futbol-extranjero", numero: 17, nombre: "Fútbol Extranjero", grupo: "Deporte", descripcion: "Champions, Libertadores, Premier, LaLiga, peruanos en el extranjero y mundiales.", color: "#0284c7" },
  // ── Mundo y sociedad ──
  { id: "geopolitica-global", numero: 18, nombre: "Geopolítica Global", grupo: "Mundo y sociedad", descripcion: "Potencias, guerras, ONU, OTAN, sanciones, cumbres y corredores comerciales.", color: "#334155" },
  { id: "geopolitica-regional-latam", numero: 19, nombre: "Geopolítica Regional (Latam)", grupo: "Mundo y sociedad", descripcion: "CAN, Mercosur, Alianza del Pacífico, migraciones, fronteras y elecciones vecinas.", color: "#0d9488" },
  { id: "noticias-cristianas-devocional", numero: 20, nombre: "Noticias Cristianas · Devocional del día", grupo: "Mundo y sociedad", descripcion: "Vida de iglesia, misiones y devocional diario con versículo.", color: "#a16207" },
  { id: "educacion", numero: 21, nombre: "Educación", grupo: "Mundo y sociedad", descripcion: "Colegios, universidades, Sunedu, admisión, docentes y brecha digital.", color: "#2563eb" },
  { id: "medio-ambiente-clima", numero: 22, nombre: "Medio Ambiente y Clima", grupo: "Mundo y sociedad", descripcion: "Fenómeno El Niño, lluvias, sequías, incendios, glaciares y contaminación.", color: "#059669" },
  { id: "transporte-infraestructura", numero: 23, nombre: "Transporte e Infraestructura", grupo: "Mundo y sociedad", descripcion: "Metro de Lima, puerto de Chancay, aeropuertos, carreteras y transporte urbano.", color: "#ea580c" },
  { id: "cultura-entretenimiento", numero: 24, nombre: "Cultura y Entretenimiento", grupo: "Mundo y sociedad", descripcion: "Cine peruano, música, libros, gastronomía, fiestas patronales y patrimonio.", color: "#db2777" },
  { id: "migracion", numero: 25, nombre: "Migración", grupo: "Mundo y sociedad", descripcion: "Migración venezolana, peruanos en el exterior, refugio, remesas y fronteras.", color: "#65a30d" },
  // ── Política ──
  { id: "politica-nacional", numero: 26, nombre: "Política Nacional", grupo: "Política", descripcion: "Gobierno central, Congreso, PCM, elecciones en Perú, partidos peruanos y reformas del Estado.", color: "#b91c1c" },
  { id: "politica-internacional", numero: 27, nombre: "Política Internacional", grupo: "Política", descripcion: "Gobiernos y elecciones del mundo (EE.UU., Europa, Asia), parlamentos y política interna de otros países. Sin solapamiento con Geopolítica Global: aquí el poder interno de cada país.", color: "#1d4ed8" },
  // ── Escándalos ──
  { id: "escandalo", numero: 28, nombre: "Escándalos", grupo: "Mundo y sociedad", descripcion: "Reportajes de corrupción, casos de alta visibilidad (ej. involucramiento de instituciones educativas, escándalos políticos), y crímenes que han marcado la opinión pública. Cada artículo debe atribuirse a fuentes oficiales y incluir bloque de verificación.", color: "#7f1d1d" },
];

export const catPorId = (id: string): CategoriaNoticia =>
  CATEGORIAS.find((c) => c.id === id) ?? CATEGORIAS[0];

export const GRUPOS: GrupoNoticias[] = [
  "Economía y producción",
  "Tecnología y ciencia",
  "Seguridad y justicia",
  "Deporte",
  "Mundo y sociedad",
  "Política",
];
