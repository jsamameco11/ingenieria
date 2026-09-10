import type { Partida } from "./types";
import { p, r } from "./partidaBuilder";

/** Ampliación de edificaciones (libro de costos / RN Metrados). No mezclar con vial ni saneamiento urbano. */
const ARQ_EXTRA: Partida[] = [
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.01.03", "Desbroce y retiro de vegetación herbácea y arbustiva", "m²", r(["MO-PEO", 0.08], ["MO-OPE", 0.02], ["EQ-WIN", 0.015], ["EQ-HIN", 4])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.01.04", "Roce y tumba de árboles DAP ≤ 0.30 m", "und", r(["MO-OPE", 1.8], ["MO-PEO", 2.4], ["EQ-MOTOS", 1.2], ["MAT-DIE", 0.8], ["EQ-HIN", 4])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.01.05", "Roce y tumba de árboles DAP 0.30–0.60 m", "und", r(["MO-OPE", 3.2], ["MO-PEO", 4.0], ["EQ-MOTOS", 2.4], ["MAT-DIE", 1.6], ["EQ-WIN", 0.4], ["EQ-HIN", 4])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.01.06", "Roce y tumba de árboles DAP > 0.60 m", "und", r(["MO-OPE", 5.5], ["MO-PEO", 6.5], ["EQ-MOTOS", 4.0], ["MAT-DIE", 2.8], ["EQ-TRA", 0.6], ["EQ-HIN", 4])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.01.07", "Destoconado y extracción de raíces (tocones)", "und", r(["MO-OPM", 1.2], ["MO-PEO", 2.0], ["EQ-RET", 0.8], ["EQ-TRA", 0.5], ["MAT-DIE", 1.2], ["EQ-HIN", 3])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.01.08", "Despalme de capa vegetal e=0.20 m", "m³", r(["MO-OPM", 0.08], ["MO-PEO", 0.12], ["EQ-TRA", 0.06], ["EQ-VOL", 0.1], ["EQ-HIN", 3])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.01.09", "Acopio y eliminación de material vegetal D≤5 km", "m³", r(["MO-CHO", 0.1], ["MO-PEO", 0.15], ["EQ-VOL", 0.24], ["EQ-HIN", 2])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.01.10", "Emparvado y quema controlada de residuos vegetales (si autoriza)", "m³", r(["MO-PEO", 0.25], ["MO-OPE", 0.08], ["EQ-HIN", 3])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.02.03", "Demolición de vereda de concreto", "m²", r(["MO-OPE", 0.35], ["MO-PEO", 0.45], ["EQ-CORT", 0.08], ["EQ-HIN", 5])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.03.02", "Caseta de guardianía / almacén provisional", "und", r(["MO-CAR", 24], ["MO-PEO", 18], ["MAT-MAD", 180], ["MAT-CALA", 12], ["MAT-PINL", 2], ["EQ-HIN", 5])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.03.03", "Cercado perimétrico con malla raschel", "m", r(["MO-OPE", 0.18], ["MO-PEO", 0.22], ["MAT-MALLS", 1.8], ["MAT-MAD", 2.4], ["EQ-HIN", 4])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.04.01", "Andamio metálico tubular (alquiler)", "m²-mes", r(["MO-OPE", 0.12], ["MO-PEO", 0.18], ["EQ-ANDT", 1.2], ["EQ-HIN", 3])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.04.02", "Apuntalamiento con puntales metálicos", "m²-mes", r(["MO-ENC", 0.08], ["MO-PEO", 0.1], ["EQ-PUNT", 1.5], ["EQ-HIN", 3])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.05.01", "Implementación SSOMA de obra", "glb", r(["MO-SSO", 40], ["MO-VIG", 160], ["MAT-KITSSO", 12], ["MAT-CASCO", 12], ["MAT-CONO", 8], ["MAT-CINTS", 80], ["EQ-HIN", 2])),

  p("estructuras", "02 Movimiento de tierras", "EST-02.01.04", "Excavación en material conglomerado", "m³", r(["MO-OPE", 0.55], ["MO-PEO", 1.4], ["EQ-COMW", 0.08], ["EQ-HIN", 5])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.02.03", "Relleno con material seleccionado compactado", "m³", r(["MO-PEO", 0.4], ["MO-OPE", 0.1], ["MAT-RELL", 1.18], ["EQ-COM", 0.3], ["EQ-VOL", 0.1], ["EQ-HIN", 4])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.05.01", "Desquinche y perfilado de talud", "m²", r(["MO-PEO", 0.22], ["MO-OPE", 0.06], ["EQ-WIN", 0.03], ["EQ-HIN", 4])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.06.02", "Control topográfico de plataformas y taludes", "glb", r(["MO-TOPO", 24], ["MO-OPE", 16], ["MO-PEO", 16], ["EQ-NIV", 6], ["EQ-HIN", 3])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.06.03", "Ensayo de compactación Proctor / densímetro nuclear (campo)", "glb", r(["MO-LAB", 40], ["MO-PEO", 16], ["EQ-HIN", 2])),

  p("arquitectura", "05 Muros y tabiques", "ARQ-05.01.03", "Muro de ladrillo king kong artesanal Tipo IV 23×12×8 cm, aparejo soga e=12 cm, mortero 1:5", "m²", r(["MO-ALB", 0.58], ["MO-PEO", 0.72], ["MAT-KING", 44], ["MAT-CEM", 0.24], ["MAT-ARE", 0.038], ["MAT-AGU", 0.022], ["MAT-FY6", 0.16], ["MAT-ALAM", 0.012], ["EQ-HIN", 5])),
  p("arquitectura", "05 Muros y tabiques", "ARQ-05.05.01", "Muro de bloque de concreto 12×20×40 cm f'c 70 kg/cm², mortero 1:4", "m²", r(["MO-ALB", 0.48], ["MO-PEO", 0.55], ["MAT-BLOQ", 12.5], ["MAT-CEM", 0.18], ["MAT-ARE", 0.028], ["MAT-AGU", 0.016], ["MAT-FY6", 0.14], ["MAT-ALAM", 0.01], ["EQ-HIN", 5])),
  p("arquitectura", "05 Muros y tabiques", "ARQ-05.05.02", "Muro de bloque de concreto 15×20×40 cm f'c 70 kg/cm², mortero 1:4", "m²", r(["MO-ALB", 0.52], ["MO-PEO", 0.6], ["MAT-BLOQ15", 12.5], ["MAT-CEM", 0.2], ["MAT-ARE", 0.03], ["MAT-AGU", 0.018], ["MAT-FY6", 0.16], ["MAT-ALAM", 0.01], ["EQ-HIN", 5])),
  p("arquitectura", "05 Muros y tabiques", "ARQ-05.04.02", "Tabique drywall RF tipo X e=12.5 mm, placa 1.20×2.40 m, parante C 89 mm", "m²", r(["MO-DRY", 0.48], ["MO-AYU", 0.32], ["MAT-DRYRF", 2.2], ["MAT-PERC", 2.8], ["MAT-PERU", 0.9], ["MAT-TORND", 0.55], ["MAT-CINT", 1.3], ["MAT-MAS", 0.85], ["MAT-ESQ", 0.4], ["EQ-HIN", 4])),
  p("arquitectura", "05 Muros y tabiques", "ARQ-05.04.03", "Tabique drywall RH e=12.5 mm (placa verde 1.20×2.40 m), parante C 89 mm", "m²", r(["MO-DRY", 0.48], ["MO-AYU", 0.32], ["MAT-DRYR", 2.2], ["MAT-PERC", 2.8], ["MAT-PERU", 0.9], ["MAT-TORND", 0.55], ["MAT-CINT", 1.3], ["MAT-MAS", 0.85], ["MAT-ESQ", 0.4], ["EQ-HIN", 4])),
  p("arquitectura", "05 Muros y tabiques", "ARQ-05.06.01", "Dintel de concreto armado 0.15×0.20 m f'c 210 kg/cm², acero fy 4 200", "m", r(["MO-OPE", 0.45], ["MO-PEO", 0.4], ["MO-FIE", 0.15], ["MAT-CEM", 0.22], ["MAT-ARE", 0.014], ["MAT-PIE", 0.018], ["MAT-AGU", 0.008], ["MAT-FY42", 3.2], ["MAT-ALAM", 0.02], ["MAT-MAD", 0.8], ["EQ-HIN", 5])),

  p("arquitectura", "06 Revoques, enlucidos y cielorrasos", "ARQ-06.01.03", "Tarrajeo primario c/arena gruesa e=1.5 cm", "m²", r(["MO-ALB", 0.28], ["MO-PEO", 0.24], ["MAT-CEM", 0.11], ["MAT-ARE", 0.02], ["EQ-AND", 0.04], ["EQ-HIN", 5])),
  p("arquitectura", "06 Revoques, enlucidos y cielorrasos", "ARQ-06.01.04", "Enlucido fino c/arena fina e=0.5 cm", "m²", r(["MO-ALB", 0.22], ["MO-PEO", 0.16], ["MAT-CEM", 0.06], ["MAT-ARF", 0.01], ["EQ-HIN", 5])),
  p("arquitectura", "06 Revoques, enlucidos y cielorrasos", "ARQ-06.02.03", "Cielo raso metálico 60×60 cm", "m²", r(["MO-DRY", 0.38], ["MO-PEO", 0.25], ["MAT-CIELO", 1.08], ["MAT-PER", 2.2], ["EQ-AND", 0.07], ["EQ-HIN", 5])),
  p("arquitectura", "06 Revoques, enlucidos y cielorrasos", "ARQ-06.02.04", "Cielo raso acústico 60×60 cm", "m²", r(["MO-DRY", 0.4], ["MO-PEO", 0.26], ["MAT-BALAC", 1.08], ["MAT-PER", 2.2], ["EQ-AND", 0.07], ["EQ-HIN", 5])),
  p("arquitectura", "06 Revoques, enlucidos y cielorrasos", "ARQ-06.04.01", "Cornisa de yeso", "m", r(["MO-ESC", 0.22], ["MO-PEO", 0.12], ["MAT-YES", 1.8], ["EQ-AND", 0.04], ["EQ-HIN", 5])),

  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.01.02", "Falso piso e=8 cm f'c 100", "m²", r(["MO-OPE", 0.2], ["MO-PEO", 0.3], ["MAT-CEM", 0.26], ["MAT-ARE", 0.05], ["MAT-HORM", 0.065], ["EQ-MEZ", 0.05], ["EQ-HIN", 5])),
  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.02.02", "Piso de cemento pulido con endurecedor", "m²", r(["MO-ALB", 0.32], ["MO-PEO", 0.24], ["MAT-CEM", 0.16], ["MAT-ARF", 0.018], ["MAT-CUR", 0.02], ["EQ-HIN", 5])),
  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.03.04", "Piso de mayólica 20×20 cm", "m²", r(["MO-CER", 0.5], ["MO-PEO", 0.36], ["MAT-MAY20", 1.1], ["MAT-PEG", 0.13], ["MAT-FRA", 0.45], ["EQ-HIN", 5])),
  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.06.01", "Piso de parquet / entablado", "m²", r(["MO-PAR", 0.55], ["MO-PEO", 0.28], ["MAT-PARQ", 1.08], ["MAT-CLA", 0.12], ["MAT-BARN", 0.06], ["EQ-HIN", 5])),
  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.06.02", "Piso laminado AC4 sobre espuma", "m²", r(["MO-PAR", 0.28], ["MO-PEO", 0.18], ["MAT-LAM", 1.08], ["MAT-POLI", 1.05], ["EQ-HIN", 4])),
  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.07.01", "Piso de loseta hidráulica", "m²", r(["MO-ALB", 0.42], ["MO-PEO", 0.32], ["MAT-LOS", 1.08], ["MAT-CEM", 0.08], ["MAT-ARE", 0.012], ["EQ-HIN", 5])),
  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.08.01", "Piso de terrazo in situ pulido", "m²", r(["MO-ALB", 0.7], ["MO-PEO", 0.5], ["MAT-TER", 1.05], ["MAT-CEM", 0.1], ["EQ-PUL", 0.25], ["EQ-HIN", 5])),

  p("arquitectura", "08 Zócalos y revestimientos", "ARQ-08.01.02", "Zócalo de madera h=0.10 m", "m", r(["MO-CAR", 0.18], ["MO-PEO", 0.08], ["MAT-ZOCALOM", 1.05], ["MAT-CLA", 0.04], ["EQ-HIN", 5])),
  p("arquitectura", "08 Zócalos y revestimientos", "ARQ-08.01.03", "Zócalo cerámico h=0.10 m", "m", r(["MO-CER", 0.12], ["MO-PEO", 0.08], ["MAT-ZOC", 1.05], ["MAT-PEG", 0.02], ["EQ-HIN", 5])),
  p("arquitectura", "08 Zócalos y revestimientos", "ARQ-08.04.01", "Pintura epóxica en piso de SS.HH.", "m²", r(["MO-PIN", 0.35], ["MO-AYU", 0.18], ["MAT-EPOX", 0.12], ["EQ-HIN", 5])),
  p("arquitectura", "08 Zócalos y revestimientos", "ARQ-08.05.01", "Revestimiento de piedra laja en fachada", "m²", r(["MO-ALB", 0.85], ["MO-PEO", 0.55], ["MAT-RIPRAP", 0.04], ["MAT-CEM", 0.18], ["MAT-ARE", 0.025], ["EQ-AND", 0.08], ["EQ-HIN", 5])),
  p("arquitectura", "08 Zócalos y revestimientos", "ARQ-08.03.02", "Impermeabilización de azotea con manto 4 mm", "m²", r(["MO-IMP", 0.28], ["MO-PEO", 0.22], ["MAT-MEMB4", 1.12], ["MAT-BIT", 0.18], ["EQ-HIN", 4])),
  p("arquitectura", "08 Zócalos y revestimientos", "ARQ-08.03.03", "Impermeabilización con membrana de poliuretano", "m²", r(["MO-IMP", 0.32], ["MO-PEO", 0.2], ["MAT-POLIURE", 1.1], ["EQ-HIN", 4])),

  p("arquitectura", "09 Carpintería de madera", "ARQ-09.02.01", "Closet de melamina 1.80×2.10 m", "und", r(["MO-CAR", 6], ["MO-PEO", 2], ["MAT-CLOSET", 1], ["MAT-CERJ", 2], ["EQ-SIE", 0.8], ["EQ-HIN", 5])),
  p("arquitectura", "09 Carpintería de madera", "ARQ-09.03.01", "Puerta contra incendio 90 min", "und", r(["MO-HERR", 3.5], ["MO-PEO", 2], ["MAT-PUEC", 1], ["EQ-HIN", 4])),
  p("arquitectura", "09 Carpintería de madera", "ARQ-09.04.01", "Marco de madera para vano 0.90×2.10 m", "und", r(["MO-CAR", 1.8], ["MO-PEO", 0.8], ["MAT-CED", 12], ["MAT-CLA", 0.15], ["EQ-HIN", 5])),

  p("arquitectura", "10 Carpintería metálica y cerrajería", "ARQ-10.03.02", "Baranda de acero inoxidable h=0.90 m", "m", r(["MO-SOLD", 0.95], ["MO-PEO", 0.5], ["MAT-INOX", 1.15], ["EQ-SOL", 0.35], ["EQ-HIN", 5])),
  p("arquitectura", "10 Carpintería metálica y cerrajería", "ARQ-10.05.01", "Portón vehicular metálico 4.00×2.20 m", "und", r(["MO-HERR", 16], ["MO-SOLD", 8], ["MO-PEO", 10], ["MAT-PORTON", 1], ["MAT-PINA", 0.8], ["EQ-SOL", 4], ["EQ-HIN", 4])),
  p("arquitectura", "10 Carpintería metálica y cerrajería", "ARQ-10.06.01", "Cerco de malla olán h=2.00 m", "m", r(["MO-HERR", 0.45], ["MO-PEO", 0.4], ["MAT-MALLS", 2.2], ["MAT-FY42", 4], ["MAT-CEM", 0.12], ["EQ-HIN", 5])),

  p("arquitectura", "12 Pintura", "ARQ-12.02.02", "Pintura anticorrosiva + esmalte en metal", "m²", r(["MO-PIN", 0.32], ["MO-AYU", 0.14], ["MAT-PINA", 0.06], ["MAT-PINE", 0.08], ["EQ-HIN", 5])),
  p("arquitectura", "12 Pintura", "ARQ-12.04.01", "Barniz marino en carpintería de madera", "m²", r(["MO-PIN", 0.3], ["MO-AYU", 0.12], ["MAT-BARN", 0.08], ["EQ-HIN", 5])),
  p("arquitectura", "12 Pintura", "ARQ-12.05.01", "Pintura epóxica en muros de SS.HH.", "m²", r(["MO-PIN", 0.28], ["MO-AYU", 0.14], ["MAT-EPOX", 0.1], ["EQ-HIN", 5])),
  p("arquitectura", "12 Pintura", "ARQ-12.01.03", "Pintura látex lavable 3 manos", "m²", r(["MO-PIN", 0.24], ["MO-AYU", 0.12], ["MAT-PINW", 0.12], ["MAT-IMP", 0.035], ["EQ-AND", 0.03], ["EQ-HIN", 5])),

  p("arquitectura", "13 Cubiertas", "ARQ-13.03.01", "Cobertura de fibrocemento 4 mm", "m²", r(["MO-CAR", 0.32], ["MO-PEO", 0.38], ["MAT-FIBRO", 1.12], ["MAT-CLA", 0.07], ["EQ-AND", 0.06], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.04.01", "Canaleta de lluvia PVC Ø110 mm", "m", r(["MO-GAS", 0.28], ["MO-PEO", 0.2], ["MAT-CANALET", 1.05], ["MAT-CODO", 0.2], ["EQ-AND", 0.04], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.05.01", "Cumbrera de calamina galvanizada", "m", r(["MO-CAR", 0.22], ["MO-PEO", 0.18], ["MAT-CALA", 0.45], ["MAT-CLA", 0.04], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.01.02", "Suministro e instalación de calaminón TR-4 e=0.30 mm, galvanizado, c/tornillo autoperforante", "m²", r(["MO-CAR", 0.32], ["MO-PEO", 0.36], ["MAT-TR4030", 1.12], ["MAT-TORNCAL", 8], ["EQ-AND", 0.06], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.01.03", "Suministro e instalación de calaminón TR-4 e=0.40 mm, galvanizado, c/tornillo autoperforante", "m²", r(["MO-CAR", 0.34], ["MO-PEO", 0.38], ["MAT-TR4040", 1.12], ["MAT-TORNCAL", 8], ["EQ-AND", 0.06], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.01.04", "Suministro e instalación de calaminón TR-4 e=0.47 mm, galvanizado, c/tornillo autoperforante", "m²", r(["MO-CAR", 0.36], ["MO-PEO", 0.4], ["MAT-TR4047", 1.12], ["MAT-TORNCAL", 8], ["EQ-AND", 0.07], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.01.05", "Suministro e instalación de calaminón TR-5 e=0.30 mm, galvanizado, c/tornillo autoperforante", "m²", r(["MO-CAR", 0.34], ["MO-PEO", 0.38], ["MAT-TR5030", 1.12], ["MAT-TORNCAL", 8], ["EQ-AND", 0.06], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.01.06", "Suministro e instalación de calaminón TR-5 e=0.40 mm, galvanizado, c/tornillo autoperforante", "m²", r(["MO-CAR", 0.36], ["MO-PEO", 0.4], ["MAT-TR5040", 1.12], ["MAT-TORNCAL", 8], ["EQ-AND", 0.07], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.01.07", "Suministro e instalación de calaminón TR-5 e=0.50 mm, galvanizado, c/tornillo autoperforante", "m²", r(["MO-CAR", 0.38], ["MO-PEO", 0.42], ["MAT-TR5050", 1.12], ["MAT-TORNCAL", 9], ["EQ-AND", 0.07], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.01.08", "Suministro e instalación de calaminón TR-4 e=0.40 mm prelacado, c/tornillo autoperforante", "m²", r(["MO-CAR", 0.36], ["MO-PEO", 0.4], ["MAT-TR4040P", 1.12], ["MAT-TORNCAL", 8], ["EQ-AND", 0.07], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.01.09", "Suministro e instalación de calaminón TR-5 e=0.40 mm prelacado, c/tornillo autoperforante", "m²", r(["MO-CAR", 0.38], ["MO-PEO", 0.42], ["MAT-TR5040P", 1.12], ["MAT-TORNCAL", 9], ["EQ-AND", 0.07], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.05.02", "Cumbrera de calaminón TR-4, suministro e instalación", "m", r(["MO-CAR", 0.24], ["MO-PEO", 0.2], ["MAT-CUMTR4", 1.08], ["MAT-TORNCAL", 6], ["EQ-AND", 0.03], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.05.03", "Cumbrera de calaminón TR-5, suministro e instalación", "m", r(["MO-CAR", 0.26], ["MO-PEO", 0.22], ["MAT-CUMTR5", 1.08], ["MAT-TORNCAL", 6], ["EQ-AND", 0.03], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.06.01", "Limahoya / limatesa de calaminón TR-4", "m", r(["MO-CAR", 0.28], ["MO-PEO", 0.22], ["MAT-TR4040", 0.55], ["MAT-TORNCAL", 6], ["EQ-AND", 0.04], ["EQ-HIN", 5])),

  p("arquitectura", "14 Jardinería", "ARQ-14.01.01", "Tierra vegetal e=0.20 m", "m²", r(["MO-JARD", 0.12], ["MO-PEO", 0.18], ["MAT-TIER", 0.24], ["EQ-HIN", 3])),
  p("arquitectura", "14 Jardinería", "ARQ-14.02.01", "Césped en rollos", "m²", r(["MO-JARD", 0.18], ["MO-PEO", 0.12], ["MAT-CESP", 1.08], ["EQ-HIN", 3])),
  p("arquitectura", "14 Jardinería", "ARQ-14.03.01", "Plantación de árbol forestal h=2.50 m", "und", r(["MO-JARD", 0.8], ["MO-PEO", 0.6], ["MAT-ARBOL", 1], ["MAT-TIER", 0.08], ["EQ-HIN", 3])),
];

const EST_EXTRA: Partida[] = [
  p("estructuras", "03 Obras de concreto simple", "EST-03.01.03", "Solado de 3\" f'c=100 kg/cm²", "m²", r(["MO-CON", 0.16], ["MO-PEO", 0.24], ["MAT-CEM", 0.14], ["MAT-ARE", 0.032], ["MAT-PIE", 0.04], ["EQ-MEZ", 0.03], ["EQ-HIN", 5])),
  p("estructuras", "03 Obras de concreto simple", "EST-03.02.03", "Sobrecimiento de albañilería sólida h=0.30 m (sin armar)", "m", r(["MO-ALB", 0.55], ["MO-PEO", 0.45], ["MAT-SOL", 18], ["MAT-CEM", 0.28], ["MAT-ARE", 0.04], ["EQ-HIN", 5])),
  p("estructuras", "03 Obras de concreto simple", "EST-03.04.01", "Curado de concreto simple (membrana / agua)", "m²", r(["MO-PEO", 0.04], ["MO-OPE", 0.01], ["MAT-CUR", 0.02], ["EQ-HIN", 3])),
  p("estructuras", "03 Obras de concreto simple", "EST-03.05.01", "Concreto ciclópeo 50 % piedra f'c=100 kg/cm²", "m³", r(["MO-OPE", 1.3], ["MO-PEO", 2.0], ["MAT-CEM", 3.6], ["MAT-ARE", 0.32], ["MAT-HORM", 0.4], ["MAT-PIE", 0.55], ["EQ-MEZ", 0.25], ["EQ-HIN", 5])),

  p("estructuras", "04 Obras de concreto armado", "EST-04.01.11", "Concreto para zapatas f'c=175 kg/cm²", "m³", r(["MO-CON", 2.3], ["MO-PEO", 3.1], ["MAT-CEM", 7.4], ["MAT-ARE", 0.54], ["MAT-PIE", 0.94], ["MAT-AGU", 0.22], ["EQ-MEZ", 0.52], ["EQ-VIB", 0.32], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.12", "Concreto para columnas f'c=280 kg/cm²", "m³", r(["MO-CON", 3.9], ["MO-PEO", 4.3], ["MAT-CEM", 10.2], ["MAT-ARE", 0.5], ["MAT-PIE", 0.9], ["MAT-AGU", 0.2], ["MAT-ADIT", 1.2], ["EQ-MEZ", 0.62], ["EQ-VIB", 0.52], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.13", "Concreto para losa aligerada f'c=280 kg/cm²", "m³", r(["MO-CON", 3.3], ["MO-PEO", 3.9], ["MAT-CEM", 10.2], ["MAT-ARE", 0.5], ["MAT-PIE", 0.9], ["MAT-AGU", 0.2], ["MAT-ADIT", 1.1], ["EQ-MEZ", 0.58], ["EQ-VIB", 0.42], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.14", "Concreto premezclado f'c=210 kg/cm²", "m³", r(["MO-CON", 1.4], ["MO-PEO", 2.2], ["MAT-PREM", 1.05], ["MAT-CUR", 0.08], ["EQ-HORM", 0.18], ["EQ-VIB", 0.35], ["EQ-HIN", 4])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.15", "Concreto premezclado f'c=280 kg/cm²", "m³", r(["MO-CON", 1.5], ["MO-PEO", 2.3], ["MAT-PREM280", 1.05], ["MAT-CUR", 0.09], ["EQ-HORM", 0.2], ["EQ-VIB", 0.38], ["EQ-HIN", 4])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.16", "Concreto premezclado f'c=350 kg/cm²", "m³", r(["MO-CON", 1.6], ["MO-PEO", 2.4], ["MAT-PREM350", 1.05], ["MAT-CUR", 0.1], ["EQ-HORM", 0.22], ["EQ-VIB", 0.4], ["EQ-HIN", 4])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.02.06", "Acero de refuerzo fy=5 600 kg/cm² para elementos estructurales", "kg", r(["MO-FIE", 0.026], ["MO-PEO", 0.013], ["MAT-FY56", 1.05], ["MAT-ALAM", 0.014], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.03.05", "Encofrado y desencofrado para zapatas", "m²", r(["MO-ENC", 0.48], ["MO-PEO", 0.32], ["MAT-MAD", 1.5], ["MAT-FEN", 0.06], ["MAT-CLA", 0.12], ["MAT-DES", 0.025], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.03.06", "Encofrado y desencofrado para escaleras", "m²", r(["MO-ENC", 0.72], ["MO-PEO", 0.45], ["MAT-MAD", 2.4], ["MAT-FEN", 0.1], ["MAT-CLA", 0.18], ["EQ-AND", 0.06], ["EQ-HIN", 5])),
  p("estructuras", "03 Obras de concreto simple", "EST-04.03.07", "Encofrado de sobrecimiento de concreto simple (sin armar)", "m²", r(["MO-ENC", 0.42], ["MO-PEO", 0.28], ["MAT-MAD", 1.3], ["MAT-CLA", 0.1], ["MAT-DES", 0.02], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.06.01", "Junta de dilatación con sellador", "m", r(["MO-OPE", 0.18], ["MO-PEO", 0.12], ["MAT-JUNT", 1], ["EQ-HIN", 4])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.07.01", "Vigueta pretensada 15×15 cm colocada", "m", r(["MO-OPE", 0.12], ["MO-PEO", 0.18], ["MAT-VIGUETA", 1.05], ["EQ-HIN", 4])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.08.01", "Ladrillo hueco de techo 12×30×30", "m²", r(["MO-PEO", 0.11], ["MO-OPE", 0.035], ["MAT-PAND", 11.2], ["EQ-HIN", 4])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.09.01", "Pilote hincado Ø400 mm", "m", r(["MO-OPM", 0.35], ["MO-PEO", 0.4], ["MAT-CEM", 1.6], ["MAT-FY42", 12], ["EQ-PILO", 0.22], ["EQ-HIN", 3])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.10.01", "Malla electrosoldada Q-188 en losa aligerada", "m²", r(["MO-FIE", 0.08], ["MO-PEO", 0.06], ["MAT-MALL", 1.08], ["MAT-ALAM", 0.02], ["EQ-HIN", 4])),
];

const IS_EXTRA: Partida[] = [
  p("sanitarias", "01 Salidas de agua y desagüe", "IS-01.02.03", "Punto de desagüe pluvial Ø75–110 mm", "pnto", r(["MO-GAS", 1.3], ["MO-AYU", 0.95], ["MAT-PVC110", 2.5], ["MAT-CODO", 2], ["MAT-SUM", 1], ["EQ-HIN", 5])),
  p("sanitarias", "01 Salidas de agua y desagüe", "IS-01.03.01", "Punto de sumidero de piso 4\"", "pnto", r(["MO-GAS", 1.1], ["MO-AYU", 0.8], ["MAT-SUM", 1], ["MAT-UF160", 1.5], ["MAT-PEGV", 0.1], ["EQ-HIN", 5])),

  p("sanitarias", "02 Aparatos sanitarios y grifería", "IS-02.01.06", "Inodoro one piece colocado", "und", r(["MO-GAS", 2.8], ["MO-AYU", 1.6], ["MAT-INODH", 1], ["MAT-SIL", 0.5], ["MAT-FLEX", 1], ["EQ-HIN", 4])),
  p("sanitarias", "02 Aparatos sanitarios y grifería", "IS-02.01.07", "Urinario con fluxómetro", "und", r(["MO-GAS", 2.4], ["MO-AYU", 1.4], ["MAT-URI", 1], ["MAT-FLUX", 1], ["EQ-HIN", 4])),
  p("sanitarias", "02 Aparatos sanitarios y grifería", "IS-02.01.08", "Bidet colocado", "und", r(["MO-GAS", 2.0], ["MO-AYU", 1.2], ["MAT-BID", 1], ["MAT-GRIF", 1], ["MAT-SIF", 1], ["EQ-HIN", 4])),
  p("sanitarias", "02 Aparatos sanitarios y grifería", "IS-02.01.09", "Tina de acrílico colocada", "und", r(["MO-GAS", 4], ["MO-AYU", 3], ["MAT-TINA", 1], ["MAT-SIL", 1], ["EQ-HIN", 4])),
  p("sanitarias", "02 Aparatos sanitarios y grifería", "IS-02.03.01", "Juego de accesorios de baño", "und", r(["MO-GAS", 0.8], ["MO-AYU", 0.4], ["MAT-ACC", 1], ["EQ-HIN", 3])),
  p("sanitarias", "02 Aparatos sanitarios y grifería", "IS-02.04.01", "Grifería de lavatorio mezcladora", "und", r(["MO-GAS", 0.9], ["MO-AYU", 0.5], ["MAT-GRIFL", 1], ["EQ-HIN", 3])),
  p("sanitarias", "02 Aparatos sanitarios y grifería", "IS-02.04.02", "Grifería de ducha mezcladora", "und", r(["MO-GAS", 1.1], ["MO-AYU", 0.6], ["MAT-GRIFD", 1], ["EQ-HIN", 3])),

  p("sanitarias", "03 Redes interiores", "IS-03.01.03", "Red de agua fría PVC SAP Ø20 mm", "m", r(["MO-GAS", 0.2], ["MO-AYU", 0.16], ["MAT-TUBO", 1.05], ["MAT-CODO", 0.28], ["MAT-PEGV", 0.035], ["EQ-HIN", 5])),
  p("sanitarias", "03 Redes interiores", "IS-03.01.04", "Red de agua PPR Ø25 mm", "m", r(["MO-GAS", 0.24], ["MO-AYU", 0.18], ["MAT-PPR", 1.05], ["MAT-CODO", 0.22], ["EQ-HIN", 5])),
  p("sanitarias", "03 Redes interiores", "IS-03.01.05", "Red de agua de cobre Ø½\"", "m", r(["MO-GAS", 0.32], ["MO-AYU", 0.22], ["MAT-TUBC", 1.05], ["EQ-HIN", 5])),
  p("sanitarias", "03 Redes interiores", "IS-03.02.02", "Red de desagüe PVC UF Ø50 mm (ramales)", "m", r(["MO-GAS", 0.26], ["MO-AYU", 0.2], ["MAT-TUBO", 1.1], ["MAT-CODO", 0.25], ["EQ-HIN", 5])),
  p("sanitarias", "03 Redes interiores", "IS-03.05.01", "Montante de agua PVC SAP Ø32 mm", "m", r(["MO-GAS", 0.35], ["MO-AYU", 0.28], ["MAT-PVC32", 1.05], ["MAT-VALVB", 0.08], ["EQ-AND", 0.05], ["EQ-HIN", 5])),
  p("sanitarias", "03 Redes interiores", "IS-03.06.01", "Válvula de bronce compuerta ½\"", "und", r(["MO-GAS", 0.6], ["MO-AYU", 0.4], ["MAT-VALVB", 1], ["EQ-HIN", 4])),
];

const IE_EXTRA: Partida[] = [
  p("electricas", "01 Salidas", "IE-01.01.04", "Punto de interruptor de 3 vías", "pnto", r(["MO-ELE", 1.15], ["MO-AYU", 0.82], ["MAT-CAB14", 16], ["MAT-TUBO", 9], ["MAT-CAJAE", 1], ["MAT-INT3", 1], ["EQ-HIN", 5])),
  p("electricas", "01 Salidas", "IE-01.01.05", "Tomacorriente de intemperie", "pnto", r(["MO-ELE", 1.15], ["MO-AYU", 0.85], ["MAT-CAB", 12], ["MAT-TUBO25", 8], ["MAT-TOMA2", 1], ["EQ-HIN", 5])),
  p("electricas", "01 Salidas", "IE-01.04.01", "Punto de fuerza para motor / bomba", "pnto", r(["MO-TEC", 1.6], ["MO-AYU", 1.1], ["MAT-CAB10", 18], ["MAT-TUBO25", 12], ["MAT-TOMA", 1], ["EQ-HIN", 5])),

  p("electricas", "02 Tableros y protecciones", "IE-02.01.03", "Tablero trifásico 24 polos", "und", r(["MO-TEC", 8], ["MO-AYU", 5], ["MAT-TABTRI", 1], ["MAT-TERM", 16], ["MAT-DIF", 2], ["MAT-BREAK", 1], ["EQ-HIN", 4])),
  p("electricas", "02 Tableros y protecciones", "IE-02.02.02", "Medidor eléctrico trifásico", "und", r(["MO-TEC", 4], ["MO-AYU", 2.5], ["MAT-MEDT", 1], ["MAT-CAB8", 8], ["EQ-HIN", 4])),

  p("electricas", "04 Alimentador de acometida (calle → tablero general)", "IE-04.01.02", "Alimentador de acometida calle → TDG — cable NYY 3×16 mm² 0.6/1 kV", "m", r(["MO-TEC", 0.22], ["MO-AYU", 0.16], ["MAT-NYY", 1.05], ["MAT-TUBO25", 1.05], ["EQ-HIN", 4])),
  p("electricas", "04 Alimentador de acometida (calle → tablero general)", "IE-04.01.03", "Alimentador de acometida calle → TDG — cable N2XY 3×25 mm² XLPE 0.6/1 kV", "m", r(["MO-TEC", 0.26], ["MO-AYU", 0.18], ["MAT-N2XY", 1.05], ["MAT-TUBO25", 1.08], ["EQ-HIN", 4])),
  p("electricas", "05 Canalizaciones", "IE-04.02.01", "Bandeja portacables perforada 100×50 mm (canalización aparente)", "m", r(["MO-ELE", 0.28], ["MO-AYU", 0.22], ["MAT-BANDEJA", 1.05], ["EQ-HIN", 4])),
  p("electricas", "05 Canalizaciones", "IE-04.03.01", "Canalización empotrada PVC-P conduit Ø20 mm (3/4\") — circuitos interiores", "m", r(["MO-ELE", 0.16], ["MO-AYU", 0.14], ["MAT-TUBO", 1.05], ["EQ-TAL", 0.05], ["EQ-HIN", 4])),

  p("electricas", "05 Artefactos", "IE-05.01.03", "Luminaria LED exterior 50 W", "und", r(["MO-ELE", 0.7], ["MO-AYU", 0.45], ["MAT-LUML", 1], ["EQ-HIN", 3])),
  p("electricas", "05 Artefactos", "IE-05.01.04", "Reflector LED 100 W", "und", r(["MO-ELE", 0.85], ["MO-AYU", 0.5], ["MAT-REFL", 1], ["EQ-HIN", 3])),
  p("electricas", "05 Artefactos", "IE-05.02.01", "Luminaria de emergencia", "und", r(["MO-ELE", 0.55], ["MO-AYU", 0.35], ["MAT-EMER", 1], ["EQ-HIN", 3])),
];

const COM_EXTRA: Partida[] = [
  p("comunicaciones", "01 Salidas de señal", "COM-01.01.04", "Punto de citófono / portería", "pnto", r(["MO-TEL", 1.1], ["MO-AYU", 0.8], ["MAT-UTP", 20], ["MAT-TUBO", 8], ["MAT-CAJAE", 1], ["EQ-HIN", 5])),
  p("comunicaciones", "03 Cuarto de comunicaciones", "COM-03.02.01", "Canalización de fibra óptica 6 hilos", "m", r(["MO-TEL", 0.22], ["MO-AYU", 0.16], ["MAT-FIB", 1.05], ["MAT-DUCT", 1.02], ["EQ-HIN", 4])),
  p("comunicaciones", "03 Cuarto de comunicaciones", "COM-03.03.01", "Ducto telefónico PVC Ø50 mm", "m", r(["MO-TEL", 0.14], ["MO-PEO", 0.12], ["MAT-DUCT", 1.05], ["EQ-HIN", 4])),
];

const IM_EXTRA: Partida[] = [
  p("mecanicas", "01 Sistema de bombeo", "IM-01.01.02", "Bomba sumergible 2 HP instalada", "und", r(["MO-MEC", 8], ["MO-GAS", 4], ["MO-AYU", 5], ["MAT-BOMBASUM", 1], ["MAT-VALV", 2], ["MAT-PVC32", 8], ["EQ-HIN", 4])),
  p("mecanicas", "02 Sistema contra incendio", "IM-02.01.02", "Red contra incendio acero negro Ø2½\"", "m", r(["MO-MEC", 0.52], ["MO-SOLD", 0.4], ["MO-AYU", 0.35], ["MAT-TUBER", 1.12], ["EQ-SOL", 0.24], ["EQ-HIN", 5])),
  p("mecanicas", "03 Ventilación", "IM-03.02.01", "Ducto de ventilación de plancha galvanizada", "m²", r(["MO-MEC", 0.55], ["MO-AYU", 0.4], ["MAT-GALV", 1.12], ["MAT-SOLD", 0.08], ["EQ-HIN", 4])),
];

const PAV_EXTRA: Partida[] = [
  p("pavimentos", "01 Trabajos preliminares", "P-01.02.02", "Demolición de vereda de concreto existente", "m²", r(["MO-OPE", 0.22], ["MO-PEO", 0.28], ["EQ-DEMOL", 0.08], ["EQ-VOL", 0.04], ["EQ-HIN", 3])),
  p("pavimentos", "01 Trabajos preliminares", "P-01.02.03", "Demolición de sardinel existente", "m", r(["MO-OPE", 0.18], ["MO-PEO", 0.22], ["EQ-DEMOL", 0.05], ["EQ-VOL", 0.03], ["EQ-HIN", 3])),
  p("pavimentos", "01 Trabajos preliminares", "P-01.04.01", "Control de tránsito y desvíos provisionales", "glb", r(["MO-OPE", 12], ["MO-PEO", 18], ["MAT-CONO", 30], ["MAT-CINTS", 160], ["MAT-PINTV", 6], ["EQ-HIN", 3])),
  p("pavimentos", "01 Trabajos preliminares", "P-01.05.01", "Extracción de árboles y tocones", "und", r(["MO-PEO", 2.4], ["MO-OPM", 0.6], ["EQ-RET", 0.4], ["EQ-HIN", 3])),

  p("pavimentos", "02 Movimiento de tierras", "P-02.01.03", "Corte en material rocoso (martillo)", "m³", r(["MO-OPM", 0.28], ["MO-PEO", 0.18], ["EQ-EXC", 0.22], ["EQ-COMW", 0.14], ["EQ-VOL", 0.2], ["EQ-HIN", 2])),
  p("pavimentos", "02 Movimiento de tierras", "P-02.02.02", "Relleno con material de préstamo compactado", "m³", r(["MO-OPM", 0.1], ["MO-PEO", 0.14], ["MAT-RELL", 1.15], ["EQ-CAR", 0.08], ["EQ-ROD", 0.11], ["EQ-HIN", 2])),
  p("pavimentos", "02 Movimiento de tierras", "P-02.03.02", "Mejoramiento de subrasante con cemento", "m²", r(["MO-OPM", 0.04], ["MO-PEO", 0.06], ["MAT-CEM", 0.18], ["EQ-MOT", 0.022], ["EQ-ROD", 0.03], ["EQ-HIN", 3])),
  p("pavimentos", "02 Movimiento de tierras", "P-02.05.01", "Escarificado y reconformación de calzada", "m²", r(["MO-OPM", 0.028], ["MO-PEO", 0.035], ["EQ-MOT", 0.018], ["EQ-ROD", 0.022], ["EQ-HIN", 2])),

  p("pavimentos", "03 Subbase y base", "P-03.01.03", "Subbase granular e=15 cm compactada", "m²", r(["MO-OPM", 0.035], ["MO-PEO", 0.05], ["MAT-SUBB", 0.18], ["EQ-MOT", 0.018], ["EQ-ROD", 0.03], ["EQ-VOL", 0.025], ["EQ-HIN", 3])),
  p("pavimentos", "03 Subbase y base", "P-03.02.03", "Base granular e=25 cm compactada", "m²", r(["MO-OPM", 0.06], ["MO-PEO", 0.085], ["MAT-BASE", 0.31], ["EQ-MOT", 0.03], ["EQ-ROD", 0.05], ["EQ-VOL", 0.04], ["EQ-HIN", 3])),
  p("pavimentos", "03 Subbase y base", "P-03.05.01", "Afirmado e=15 cm compactado", "m²", r(["MO-OPM", 0.035], ["MO-PEO", 0.05], ["MAT-AFIRM", 0.18], ["EQ-MOT", 0.018], ["EQ-ROD", 0.028], ["EQ-VOL", 0.025], ["EQ-HIN", 3])),
  p("pavimentos", "03 Subbase y base", "P-03.05.02", "Afirmado e=20 cm compactado", "m²", r(["MO-OPM", 0.042], ["MO-PEO", 0.06], ["MAT-AFIRM", 0.24], ["EQ-MOT", 0.022], ["EQ-ROD", 0.032], ["EQ-VOL", 0.03], ["EQ-HIN", 3])),
  p("pavimentos", "03 Subbase y base", "P-03.06.01", "Geomalla biaxial en subrasante", "m²", r(["MO-OPE", 0.035], ["MO-PEO", 0.07], ["MAT-GEOMALLA", 1.1], ["EQ-HIN", 3])),
  p("pavimentos", "03 Subbase y base", "P-03.07.01", "Base asfáltica e=8 cm", "m²", r(["MO-ASF", 0.07], ["MO-OPM", 0.05], ["MO-PEO", 0.09], ["MAT-CAMP", 0.184], ["EQ-FIN", 0.028], ["EQ-ROD", 0.032], ["EQ-HIN", 3])),

  p("pavimentos", "04 Pavimento flexible", "P-04.01.03", "Imprimación asfáltica MC-70 1.0 L/m²", "m²", r(["MO-ASF", 0.028], ["MO-PEO", 0.035], ["MAT-MC70", 0.27], ["EQ-HIN", 3])),
  p("pavimentos", "04 Pavimento flexible", "P-04.02.03", "Carpeta asfáltica e=4 cm en caliente", "m²", r(["MO-ASF", 0.05], ["MO-OPE", 0.07], ["MO-PEO", 0.09], ["MAT-CAMP", 0.092], ["EQ-FIN", 0.022], ["EQ-ROD", 0.028], ["EQ-HIN", 3])),
  p("pavimentos", "04 Pavimento flexible", "P-04.02.04", "Carpeta asfáltica e=6 cm en caliente", "m²", r(["MO-ASF", 0.065], ["MO-OPE", 0.085], ["MO-PEO", 0.11], ["MAT-CAMP", 0.138], ["EQ-FIN", 0.026], ["EQ-ROD", 0.032], ["EQ-HIN", 3])),
  p("pavimentos", "04 Pavimento flexible", "P-04.04.01", "Slurry seal", "m²", r(["MO-ASF", 0.04], ["MO-PEO", 0.05], ["MAT-SLURRY", 1.05], ["EQ-HIN", 3])),
  p("pavimentos", "04 Pavimento flexible", "P-04.05.01", "Fresado de carpeta e=5 cm", "m²", r(["MO-OPM", 0.03], ["MO-PEO", 0.04], ["EQ-FRES", 0.018], ["EQ-VOL", 0.02], ["EQ-HIN", 2])),
  p("pavimentos", "04 Pavimento flexible", "P-04.06.01", "Tratamiento superficial bituminoso", "m²", r(["MO-ASF", 0.05], ["MO-PEO", 0.06], ["MAT-TSB", 1.05], ["MAT-CONF", 0.012], ["EQ-HIN", 3])),
  p("pavimentos", "04 Pavimento flexible", "P-04.07.01", "Riego de sello con gravilla (chip seal)", "m²", r(["MO-ASF", 0.045], ["MO-PEO", 0.055], ["MAT-EMUL", 0.18], ["MAT-CHIP", 0.012], ["EQ-HIN", 3])),
  p("pavimentos", "04 Pavimento flexible", "P-04.08.01", "Carpeta asfáltica en frío e=5 cm", "m²", r(["MO-ASF", 0.08], ["MO-PEO", 0.1], ["MAT-CAMP", 0.12], ["MAT-EMUL", 0.2], ["EQ-COM", 0.04], ["EQ-HIN", 3])),

  p("pavimentos", "05 Pavimento rígido", "P-05.01.03", "Losa de concreto f'c 280 e=15 cm", "m²", r(["MO-OPE", 0.38], ["MO-PEO", 0.46], ["MAT-PREM280", 0.16], ["MAT-MALL", 1.05], ["MAT-CUR", 0.05], ["EQ-HORM", 0.07], ["EQ-VIB", 0.07], ["EQ-HIN", 4])),
  p("pavimentos", "05 Pavimento rígido", "P-05.01.04", "Losa de concreto f'c 350 e=22 cm", "m²", r(["MO-OPE", 0.5], ["MO-PEO", 0.6], ["MAT-PREM350", 0.24], ["MAT-MALL", 1.05], ["MAT-CUR", 0.07], ["EQ-HORM", 0.09], ["EQ-VIB", 0.09], ["EQ-HIN", 4])),
  p("pavimentos", "05 Pavimento rígido", "P-05.04.01", "Pasadores de junta Ø25 mm c/60 cm", "m", r(["MO-FIE", 0.12], ["MO-PEO", 0.08], ["MAT-PASAD", 1.7], ["EQ-HIN", 4])),
  p("pavimentos", "05 Pavimento rígido", "P-05.05.01", "Encofrado de borde de losa", "m", r(["MO-ENC", 0.18], ["MO-PEO", 0.14], ["MAT-ENCOFB", 1], ["EQ-HIN", 4])),
  p("pavimentos", "05 Pavimento rígido", "P-05.06.01", "Curado químico de losa", "m²", r(["MO-OPE", 0.04], ["MO-PEO", 0.05], ["MAT-CUR", 0.08], ["EQ-HIN", 3])),

  p("pavimentos", "06 Obras complementarias", "P-06.01.02", "Sardinel tipo A f'c 175 (in situ)", "m", r(["MO-OPE", 0.42], ["MO-PEO", 0.48], ["MAT-CEM", 0.22], ["MAT-ARE", 0.016], ["MAT-PIE", 0.022], ["MAT-MAD", 0.6], ["EQ-MEZ", 0.04], ["EQ-HIN", 4])),
  p("pavimentos", "06 Obras complementarias", "P-06.01.03", "Sardinel tipo B / montable f'c 175", "m", r(["MO-OPE", 0.4], ["MO-PEO", 0.46], ["MAT-CEM", 0.2], ["MAT-ARE", 0.015], ["MAT-PIE", 0.02], ["MAT-MAD", 0.55], ["EQ-MEZ", 0.038], ["EQ-HIN", 4])),
  p("pavimentos", "06 Obras complementarias", "P-06.02.02", "Vereda de concreto f'c 175 e=15 cm", "m²", r(["MO-OPE", 0.38], ["MO-PEO", 0.44], ["MAT-CEM", 1.05], ["MAT-ARE", 0.055], ["MAT-PIE", 0.1], ["EQ-MEZ", 0.06], ["EQ-HIN", 4])),
  p("pavimentos", "06 Obras complementarias", "P-06.02.03", "Vereda de concreto f'c 175 e=8 cm", "m²", r(["MO-OPE", 0.28], ["MO-PEO", 0.34], ["MAT-CEM", 0.58], ["MAT-ARE", 0.032], ["MAT-PIE", 0.055], ["EQ-MEZ", 0.045], ["EQ-HIN", 4])),
  p("pavimentos", "06 Obras complementarias", "P-06.06.01", "Rampa PMR de concreto f'c 175", "m²", r(["MO-OPE", 0.55], ["MO-PEO", 0.5], ["MAT-CEM", 0.85], ["MAT-ARE", 0.045], ["MAT-PIE", 0.08], ["EQ-MEZ", 0.06], ["EQ-HIN", 4])),
  p("pavimentos", "06 Obras complementarias", "P-06.07.01", "Baldosa podotáctil 30×30 cm", "m²", r(["MO-ALB", 0.48], ["MO-PEO", 0.35], ["MAT-PODO", 1.08], ["MAT-PEG", 0.12], ["EQ-HIN", 5])),
  p("pavimentos", "06 Obras complementarias", "P-06.08.01", "Sumidero de concreto c/rejilla", "und", r(["MO-OPE", 4.5], ["MO-PEO", 5], ["MAT-SUMURB", 1], ["MAT-REJPLU", 1], ["MAT-CEM", 0.35], ["EQ-HIN", 4])),
  p("pavimentos", "06 Obras complementarias", "P-06.09.01", "Solado de apoyo bajo vereda e=5 cm", "m²", r(["MO-OPE", 0.16], ["MO-PEO", 0.22], ["MAT-PREM100", 0.055], ["EQ-MEZ", 0.03], ["EQ-HIN", 4])),

  p("pavimentos", "07 Señalización", "P-07.01.02", "Cruce peatonal (cebra) — pintura termoplástica extruida / spray reflectante blanca", "m²", r(["MO-OPE", 0.22], ["MO-PEO", 0.18], ["MAT-PINTV", 0.55], ["EQ-HIN", 3])),
  p("pavimentos", "07 Señalización", "P-07.01.03", "Símbolo vial termoplástico (flecha / STOP / ceda el paso) reflectante", "und", r(["MO-OPE", 0.8], ["MO-PEO", 0.5], ["MAT-PINTV", 1.2], ["EQ-HIN", 3])),
  p("pavimentos", "07 Señalización", "P-07.04.01", "Bolardo de concreto prefabricado h=0.80–1.00 m c/cimentación", "und", r(["MO-OPE", 0.5], ["MO-PEO", 0.6], ["MAT-BOLAR", 1], ["MAT-CEM", 0.06], ["EQ-HIN", 3])),
  p("pavimentos", "07 Señalización", "P-07.05.01", "Reductor de velocidad de concreto (badén) f'c 175", "m", r(["MO-OPE", 0.85], ["MO-PEO", 0.9], ["MAT-REDUC", 1], ["MAT-CEM", 0.12], ["EQ-HIN", 4])),
];

const SAN_EXTRA: Partida[] = [
  p("saneamiento", "03 Agua potable", "S-03.01.04", "Tubería PVC SAP Ø90 mm clase 7.5", "m", r(["MO-GAS", 0.25], ["MO-AYU", 0.2], ["MO-PEO", 0.16], ["MAT-PVC90", 1.05], ["MAT-ANIL", 0.2], ["MAT-PEGV", 0.04], ["EQ-HIN", 5])),
  p("saneamiento", "03 Agua potable", "S-03.01.05", "Tubería HDPE PE100 Ø90 mm", "m", r(["MO-GAS", 0.3], ["MO-AYU", 0.24], ["MO-PEO", 0.18], ["MAT-HDPE", 1.05], ["MAT-UNIONHDPE", 0.12], ["EQ-HIN", 5])),
  p("saneamiento", "03 Agua potable", "S-03.01.06", "Tubería HDPE PE100 Ø110 mm", "m", r(["MO-GAS", 0.34], ["MO-AYU", 0.26], ["MO-PEO", 0.2], ["MAT-HDPE110", 1.05], ["MAT-UNIONHDPE", 0.12], ["EQ-HIN", 5])),
  p("saneamiento", "03 Agua potable", "S-03.01.07", "Tubería HDPE PE100 Ø160 mm", "m", r(["MO-GAS", 0.42], ["MO-AYU", 0.32], ["MO-PEO", 0.24], ["MAT-HDPE160", 1.05], ["MAT-UNIONHDPE", 0.1], ["EQ-HIN", 5])),
  p("saneamiento", "03 Agua potable", "S-03.02.02", "Válvula de compuerta Ø110 mm c/caja", "und", r(["MO-GAS", 4], ["MO-AYU", 3], ["MAT-VALVG", 1], ["MAT-CAJ", 1], ["MAT-CEM", 0.25], ["EQ-HIN", 4])),
  p("saneamiento", "03 Agua potable", "S-03.02.03", "Válvula de aire Ø50 mm c/caja", "und", r(["MO-GAS", 2.8], ["MO-AYU", 2], ["MAT-VALVA", 1], ["MAT-CAJ", 1], ["EQ-HIN", 4])),
  p("saneamiento", "03 Agua potable", "S-03.06.02", "Hidrante contra incendio Ø75 mm (red urbana)", "und", r(["MO-GAS", 7], ["MO-AYU", 5], ["MO-PEO", 4], ["MAT-HIDRANTE", 1], ["MAT-PVC110", 2], ["MAT-CEM", 0.5], ["EQ-HIN", 4])),
  p("saneamiento", "03 Agua potable", "S-03.07.02", "Medidor de agua ¾\" con caja", "und", r(["MO-GAS", 2.4], ["MO-AYU", 1.8], ["MAT-MEDAP", 1], ["MAT-TUBO", 1.5], ["EQ-HIN", 4])),

  p("saneamiento", "04 Alcantarillado", "S-04.01.03", "Tubería PVC UF Ø250 mm", "m", r(["MO-GAS", 0.48], ["MO-AYU", 0.38], ["MO-PEO", 0.3], ["MAT-PVC250", 1.05], ["MAT-ANIL", 0.22], ["EQ-HIN", 5])),
  p("saneamiento", "04 Alcantarillado", "S-04.01.04", "Tubería PVC UF Ø315 mm", "m", r(["MO-GAS", 0.58], ["MO-AYU", 0.45], ["MO-PEO", 0.35], ["MAT-PVC315", 1.05], ["MAT-ANIL", 0.22], ["EQ-HIN", 5])),
  p("saneamiento", "04 Alcantarillado", "S-04.01.05", "Tubería de concreto simple Ø300 mm", "m", r(["MO-GAS", 0.55], ["MO-PEO", 0.7], ["MAT-TUBCS", 1.05], ["MAT-CEM", 0.08], ["EQ-HIN", 5])),
  p("saneamiento", "04 Alcantarillado", "S-04.01.06", "Tubería de concreto reforzado Ø400 mm", "m", r(["MO-GAS", 0.65], ["MO-PEO", 0.85], ["MAT-TUBCR", 1.05], ["MAT-CEM", 0.1], ["EQ-HIN", 5])),
  p("saneamiento", "04 Alcantarillado", "S-04.02.03", "Buzón de concreto tipo III h=3.00 m", "und", r(["MO-OPE", 10], ["MO-PEO", 14], ["MO-GAS", 2.2], ["MAT-CEM", 12], ["MAT-ARE", 0.75], ["MAT-PIE", 1.2], ["MAT-FY42", 52], ["MAT-TAPA", 1], ["MAT-ESC", 12], ["EQ-MEZ", 0.8], ["EQ-HIN", 5])),
  p("saneamiento", "04 Alcantarillado", "S-04.02.04", "Buzón prefabricado Ø1.20 m", "und", r(["MO-OPE", 4], ["MO-PEO", 6], ["MAT-BZ", 1], ["MAT-CEM", 0.4], ["EQ-GRU", 0.4], ["EQ-HIN", 4])),
  p("saneamiento", "04 Alcantarillado", "S-04.06.01", "Cámara de inspección prefabricada", "und", r(["MO-GAS", 5], ["MO-PEO", 6], ["MAT-CAMPREF", 1], ["MAT-CEM", 0.3], ["EQ-HIN", 4])),

  p("saneamiento", "05 Cámaras y tanques", "S-05.04.01", "Módulo compacto PTAR 50 habitantes", "und", r(["MO-MEC", 24], ["MO-GAS", 16], ["MO-PEO", 20], ["MAT-PTAR", 1], ["MAT-PVC110", 18], ["EQ-GRU", 4], ["EQ-HIN", 3])),
  p("saneamiento", "05 Cámaras y tanques", "S-05.05.01", "Lecho filtrante arena-grava", "m³", r(["MO-PEO", 0.8], ["MO-OPE", 0.2], ["MAT-FILTRO", 1.1], ["EQ-HIN", 4])),
  p("saneamiento", "05 Cámaras y tanques", "S-05.06.01", "Bomba sumergible de aguas servidas 2 HP", "und", r(["MO-MEC", 8], ["MO-GAS", 4], ["MAT-BOMBASUM", 1], ["MAT-VALV", 2], ["EQ-HIN", 4])),

  p("saneamiento", "06 Reposición de pista", "S-06.04.01", "Reposición de afirmado e=15 cm", "m²", r(["MO-OPM", 0.04], ["MO-PEO", 0.06], ["MAT-AFIRM", 0.18], ["EQ-COM", 0.05], ["EQ-HIN", 3])),
  p("saneamiento", "06 Reposición de pista", "S-06.05.01", "Corte y retiro de pavimento existente", "m²", r(["MO-OPE", 0.22], ["MO-PEO", 0.28], ["EQ-CORTA", 0.06], ["EQ-VOL", 0.04], ["EQ-HIN", 3])),
];

/** Carreteras (MTC / DG 2018). Códigos CAR — no usar ARQ ni HAB. */
const CAR: Partida[] = [
  p("carreteras", "01 Obras preliminares", "CAR-01.01.01", "Movilización y desmovilización de equipo vial", "glb", r(["MO-OPM", 24], ["MO-CHO", 16], ["EQ-RET", 8], ["EQ-MOT", 6], ["EQ-VOL", 8], ["EQ-HIN", 2])),
  p("carreteras", "01 Obras preliminares", "CAR-01.01.02", "Campamento y patio de máquinas", "glb", r(["MO-CAR", 40], ["MO-PEO", 60], ["MAT-MAD", 220], ["MAT-CALA", 40], ["MAT-MALLS", 80], ["EQ-HIN", 3])),
  p("carreteras", "01 Obras preliminares", "CAR-01.02.01", "Trazo, replanteo y control topográfico", "km", r(["MO-TOPO", 16], ["MO-OPE", 12], ["MO-PEO", 16], ["EQ-NIV", 4], ["EQ-HIN", 3])),
  p("carreteras", "01 Obras preliminares", "CAR-01.03.01", "Desbroce y limpieza de faja", "m²", r(["MO-PEO", 0.05], ["MO-OPM", 0.015], ["EQ-TRA", 0.012], ["EQ-HIN", 2])),
  p("carreteras", "01 Obras preliminares", "CAR-01.04.01", "Cartel de identificación MTC 3.60×2.40 m", "und", r(["MO-CAR", 12], ["MO-PEO", 10], ["MAT-MAD", 120], ["MAT-PINL", 2.5], ["MAT-FY42", 12], ["EQ-HIN", 4])),
  p("carreteras", "01 Obras preliminares", "CAR-01.05.01", "Desvío provisional de tránsito", "glb", r(["MO-OPE", 16], ["MO-PEO", 24], ["MAT-CONO", 40], ["MAT-CINTS", 200], ["MAT-PINTV", 8], ["EQ-HIN", 3])),
  p("carreteras", "01 Obras preliminares", "CAR-01.06.01", "Demolición de pavimento existente", "m²", r(["MO-OPE", 0.18], ["MO-PEO", 0.22], ["EQ-CORTA", 0.05], ["EQ-RET", 0.04], ["EQ-VOL", 0.05], ["EQ-HIN", 3])),

  p("carreteras", "02 Movimiento de tierras", "CAR-02.01.01", "Corte en material suelto hasta subrasante", "m³", r(["MO-OPM", 0.1], ["MO-PEO", 0.06], ["EQ-EXC", 0.09], ["EQ-VOL", 0.15], ["EQ-HIN", 2])),
  p("carreteras", "02 Movimiento de tierras", "CAR-02.01.02", "Corte en material suelto-rocoso", "m³", r(["MO-OPM", 0.16], ["MO-PEO", 0.1], ["EQ-EXC", 0.14], ["EQ-VOL", 0.18], ["EQ-HIN", 2])),
  p("carreteras", "02 Movimiento de tierras", "CAR-02.01.03", "Corte en roca fijas (con explosivos / martillo)", "m³", r(["MO-OPM", 0.28], ["MO-PEO", 0.18], ["EQ-EXC", 0.22], ["EQ-COMW", 0.15], ["EQ-VOL", 0.22], ["EQ-HIN", 2])),
  p("carreteras", "02 Movimiento de tierras", "CAR-02.02.01", "Terraplén con material de préstamo compactado", "m³", r(["MO-OPM", 0.09], ["MO-PEO", 0.12], ["MAT-RELL", 1.15], ["EQ-CAR", 0.07], ["EQ-ROD", 0.11], ["EQ-MOT", 0.05], ["EQ-HIN", 2])),
  p("carreteras", "02 Movimiento de tierras", "CAR-02.03.01", "Conformación y compactación de subrasante", "m²", r(["MO-OPM", 0.025], ["MO-PEO", 0.035], ["EQ-MOT", 0.022], ["EQ-ROD", 0.028], ["EQ-HIN", 2])),
  p("carreteras", "02 Movimiento de tierras", "CAR-02.04.01", "Eliminación de material excedente D=10 km", "m³", r(["MO-CHO", 0.11], ["EQ-VOL", 0.26], ["EQ-HIN", 2])),
  p("carreteras", "02 Movimiento de tierras", "CAR-02.05.01", "Escarificado y reconformación de afirmado", "m²", r(["MO-OPM", 0.03], ["MO-PEO", 0.04], ["EQ-MOT", 0.02], ["EQ-ROD", 0.025], ["EQ-HIN", 2])),
  p("carreteras", "02 Movimiento de tierras", "CAR-02.06.01", "Control de compactación (laboratorio de campo)", "glb", r(["MO-LAB", 80], ["MO-PEO", 40], ["EQ-HIN", 2])),

  p("carreteras", "03 Pavimento", "CAR-03.01.01", "Afirmado e=15 cm compactado (camino vecinal)", "m²", r(["MO-OPM", 0.032], ["MO-PEO", 0.048], ["MAT-AFIRM", 0.18], ["EQ-MOT", 0.018], ["EQ-VIBR", 0.028], ["EQ-VOL", 0.024], ["EQ-HIN", 3])),
  p("carreteras", "03 Pavimento", "CAR-03.01.02", "Afirmado e=20 cm compactado", "m²", r(["MO-OPM", 0.04], ["MO-PEO", 0.055], ["MAT-AFIRM", 0.24], ["EQ-MOT", 0.02], ["EQ-VIBR", 0.032], ["EQ-VOL", 0.03], ["EQ-HIN", 3])),
  p("carreteras", "03 Pavimento", "CAR-03.02.01", "Subbase granular e=20 cm (EG-2013)", "m²", r(["MO-OPM", 0.038], ["MO-PEO", 0.055], ["MAT-SUBB", 0.24], ["EQ-MOT", 0.02], ["EQ-ROD", 0.032], ["EQ-VOL", 0.028], ["EQ-HIN", 3])),
  p("carreteras", "03 Pavimento", "CAR-03.02.02", "Subbase granular e=25 cm", "m²", r(["MO-OPM", 0.044], ["MO-PEO", 0.065], ["MAT-SUBB", 0.3], ["EQ-MOT", 0.022], ["EQ-ROD", 0.038], ["EQ-VOL", 0.034], ["EQ-HIN", 3])),
  p("carreteras", "03 Pavimento", "CAR-03.03.01", "Base granular e=15 cm", "m²", r(["MO-OPM", 0.048], ["MO-PEO", 0.065], ["MAT-BASE", 0.19], ["EQ-MOT", 0.024], ["EQ-ROD", 0.038], ["EQ-VOL", 0.028], ["EQ-HIN", 3])),
  p("carreteras", "03 Pavimento", "CAR-03.03.02", "Base granular e=20 cm", "m²", r(["MO-OPM", 0.052], ["MO-PEO", 0.075], ["MAT-BASE", 0.25], ["EQ-MOT", 0.026], ["EQ-ROD", 0.042], ["EQ-VOL", 0.032], ["EQ-HIN", 3])),
  p("carreteras", "03 Pavimento", "CAR-03.04.01", "Imprimación asfáltica MC-70 1.0 L/m²", "m²", r(["MO-ASF", 0.028], ["MO-PEO", 0.035], ["MAT-MC70", 0.27], ["EQ-HIN", 3])),
  p("carreteras", "03 Pavimento", "CAR-03.04.02", "Riego de liga CSS-1h 0.5 L/m²", "m²", r(["MO-ASF", 0.018], ["MO-PEO", 0.025], ["MAT-EMUL", 0.14], ["EQ-HIN", 3])),
  p("carreteras", "03 Pavimento", "CAR-03.05.01", "Carpeta asfáltica en caliente e=5.0 cm", "m²", r(["MO-ASF", 0.055], ["MO-OPM", 0.05], ["MO-PEO", 0.09], ["MAT-CAMP", 0.115], ["EQ-FIN", 0.024], ["EQ-NEU", 0.028], ["EQ-HIN", 3])),
  p("carreteras", "03 Pavimento", "CAR-03.05.02", "Carpeta asfáltica en caliente e=7.5 cm", "m²", r(["MO-ASF", 0.07], ["MO-OPM", 0.065], ["MO-PEO", 0.11], ["MAT-CAMP", 0.172], ["EQ-FIN", 0.028], ["EQ-NEU", 0.032], ["EQ-HIN", 3])),
  p("carreteras", "03 Pavimento", "CAR-03.06.01", "Tratamiento superficial bicapa", "m²", r(["MO-ASF", 0.055], ["MO-PEO", 0.07], ["MAT-TSB", 1.08], ["MAT-CONF", 0.018], ["MAT-BIT", 0.22], ["EQ-HIN", 3])),
  p("carreteras", "03 Pavimento", "CAR-03.07.01", "Pavimento rígido f'c 280 e=20 cm (carretera)", "m²", r(["MO-OPE", 0.48], ["MO-PEO", 0.58], ["MAT-PREM280", 0.22], ["MAT-MALL", 1.05], ["MAT-CUR", 0.06], ["EQ-HORM", 0.08], ["EQ-VIB", 0.08], ["EQ-HIN", 4])),
  p("carreteras", "03 Pavimento", "CAR-03.08.01", "Berma afirmada e=15 cm", "m²", r(["MO-OPM", 0.035], ["MO-PEO", 0.05], ["MAT-AFIRM", 0.18], ["EQ-MOT", 0.018], ["EQ-ROD", 0.025], ["EQ-HIN", 3])),

  p("carreteras", "04 Drenaje y obras de arte", "CAR-04.01.01", "Cuneta triangular revestida f'c 175", "m", r(["MO-OPE", 0.52], ["MO-PEO", 0.62], ["MAT-CEM", 0.42], ["MAT-ARE", 0.028], ["MAT-PIE", 0.048], ["EQ-MEZ", 0.055], ["EQ-HIN", 4])),
  p("carreteras", "04 Drenaje y obras de arte", "CAR-04.01.02", "Cuneta prefabricada de concreto", "m", r(["MO-OPE", 0.28], ["MO-PEO", 0.35], ["MAT-CUNETAP", 1], ["MAT-CEM", 0.06], ["EQ-HIN", 4])),
  p("carreteras", "04 Drenaje y obras de arte", "CAR-04.02.01", "Badén de concreto f'c 210", "m", r(["MO-OPE", 0.72], ["MO-PEO", 0.82], ["MAT-CEM", 0.68], ["MAT-ARE", 0.042], ["MAT-PIE", 0.072], ["EQ-MEZ", 0.08], ["EQ-HIN", 4])),
  p("carreteras", "04 Drenaje y obras de arte", "CAR-04.03.01", "Alcantarilla metálica corrugada Ø600 mm", "m", r(["MO-OPE", 0.85], ["MO-PEO", 1.1], ["MAT-ALC600", 1.05], ["MAT-CEM", 0.15], ["EQ-HIN", 4])),
  p("carreteras", "04 Drenaje y obras de arte", "CAR-04.03.02", "Alcantarilla metálica corrugada Ø900 mm", "m", r(["MO-OPE", 1.05], ["MO-PEO", 1.35], ["MAT-ALC", 1.05], ["MAT-CEM", 0.2], ["EQ-HIN", 4])),
  p("carreteras", "04 Drenaje y obras de arte", "CAR-04.03.03", "Alcantarilla metálica corrugada Ø1 200 mm", "m", r(["MO-OPE", 1.35], ["MO-PEO", 1.7], ["MAT-ALC1200", 1.05], ["MAT-CEM", 0.28], ["EQ-HIN", 4])),
  p("carreteras", "04 Drenaje y obras de arte", "CAR-04.04.01", "Alcantarilla cajón 1.00×1.00 m", "m", r(["MO-OPE", 2.2], ["MO-PEO", 2.8], ["MO-FIE", 0.6], ["MAT-ALCBOX", 1], ["MAT-CEM", 0.4], ["EQ-HIN", 4])),
  p("carreteras", "04 Drenaje y obras de arte", "CAR-04.05.01", "Cabezal de alcantarilla f'c 210", "und", r(["MO-OPE", 8], ["MO-PEO", 10], ["MO-FIE", 2], ["MAT-CEM", 4.5], ["MAT-ARE", 0.28], ["MAT-PIE", 0.5], ["MAT-FY42", 32], ["EQ-MEZ", 0.4], ["EQ-HIN", 5])),
  p("carreteras", "04 Drenaje y obras de arte", "CAR-04.06.01", "Muro de gaviones 2.00×1.00×1.00 m", "m³", r(["MO-OPE", 1.2], ["MO-PEO", 1.8], ["MAT-GAVION", 0.52], ["MAT-PIEDGAV", 1.05], ["MAT-ALMGAV", 2.5], ["EQ-HIN", 4])),
  p("carreteras", "04 Drenaje y obras de arte", "CAR-04.07.01", "Muro de concreto armado f'c 210 (contención)", "m³", r(["MO-OPE", 3.2], ["MO-PEO", 3.8], ["MO-FIE", 0.5], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-FY42", 85], ["EQ-MEZ", 0.55], ["EQ-VIB", 0.4], ["EQ-HIN", 5])),

  p("carreteras", "05 Señalización y seguridad vial", "CAR-05.01.01", "Pintura vial termoplástica reflectante de eje de calzada (línea continua/discontinua)", "m", r(["MO-OPE", 0.035], ["MO-PEO", 0.045], ["MAT-PINTV", 0.16], ["EQ-HIN", 3])),
  p("carreteras", "05 Señalización y seguridad vial", "CAR-05.01.02", "Pintura vial termoplástica reflectante de borde de calzada", "m", r(["MO-OPE", 0.032], ["MO-PEO", 0.04], ["MAT-PINTV", 0.14], ["EQ-HIN", 3])),
  p("carreteras", "05 Señalización y seguridad vial", "CAR-05.02.01", "Tachas reflectivas bidireccionales", "und", r(["MO-OPE", 0.07], ["MO-PEO", 0.055], ["MAT-TACO", 1], ["MAT-BIT", 0.02], ["EQ-HIN", 3])),
  p("carreteras", "05 Señalización y seguridad vial", "CAR-05.03.01", "Señal vertical reglamentaria c/poste", "und", r(["MO-OPE", 1.6], ["MO-PEO", 1.3], ["MAT-POSTESEN", 1], ["MAT-REFLEC", 0.6], ["MAT-CEM", 0.18], ["EQ-HIN", 4])),
  p("carreteras", "05 Señalización y seguridad vial", "CAR-05.03.02", "Señal preventiva / informativa", "und", r(["MO-OPE", 1.7], ["MO-PEO", 1.4], ["MAT-POSTESEN", 1], ["MAT-REFLEC", 0.85], ["MAT-CEM", 0.2], ["EQ-HIN", 4])),
  p("carreteras", "05 Señalización y seguridad vial", "CAR-05.04.01", "Hito kilométrico de concreto", "und", r(["MO-OPE", 1.2], ["MO-PEO", 1.5], ["MAT-HITO", 1], ["MAT-CEM", 0.12], ["EQ-HIN", 4])),
  p("carreteras", "05 Señalización y seguridad vial", "CAR-05.05.01", "Defensa metálica tipo W-beam", "m", r(["MO-HERR", 0.35], ["MO-PEO", 0.4], ["MAT-DEFMET", 1.05], ["MAT-CEM", 0.08], ["EQ-HIN", 4])),
  p("carreteras", "05 Señalización y seguridad vial", "CAR-05.06.01", "Baranda de concreto en puente / alcantarilla", "m", r(["MO-OPE", 0.65], ["MO-PEO", 0.55], ["MAT-CEM", 0.28], ["MAT-FY42", 8], ["MAT-MAD", 1.2], ["EQ-HIN", 4])),

  p("carreteras", "06 Conservación vial", "CAR-06.01.01", "Bacheo asfáltico profundo", "m²", r(["MO-ASF", 0.4], ["MO-PEO", 0.45], ["MAT-CAMP", 0.16], ["MAT-EMUL", 0.22], ["EQ-COM", 0.1], ["EQ-HIN", 4])),
  p("carreteras", "06 Conservación vial", "CAR-06.02.01", "Motonivelado de afirmado existente", "m²", r(["MO-OPM", 0.012], ["MO-PEO", 0.015], ["EQ-MOT", 0.01], ["EQ-ROD", 0.008], ["EQ-HIN", 2])),
  p("carreteras", "06 Conservación vial", "CAR-06.03.01", "Sello de fisuras con asfalto", "m", r(["MO-ASF", 0.08], ["MO-PEO", 0.06], ["MAT-JUNT", 1], ["MAT-BIT", 0.04], ["EQ-HIN", 3])),
];

/** Hidráulica de canales, tomas y protección. Códigos HID — no mezclar con SAN ni CAR. */
const HID: Partida[] = [
  p("hidraulica", "01 Trabajos preliminares", "HID-01.01.01", "Trazo y replanteo de eje de canal", "m", r(["MO-TOPO", 0.03], ["MO-OPE", 0.045], ["MO-PEO", 0.06], ["EQ-NIV", 0.012], ["EQ-HIN", 4])),
  p("hidraulica", "01 Trabajos preliminares", "HID-01.02.01", "Desbroce de faja de canal", "m²", r(["MO-PEO", 0.055], ["MO-OPM", 0.015], ["EQ-RET", 0.012], ["EQ-HIN", 3])),
  p("hidraulica", "01 Trabajos preliminares", "HID-01.03.01", "Ataguía y desvío provisional del cauce", "glb", r(["MO-OPE", 24], ["MO-PEO", 40], ["MAT-RELL", 80], ["MAT-GEO", 120], ["EQ-RET", 8], ["EQ-VOL", 6], ["EQ-HIN", 3])),

  p("hidraulica", "02 Excavación y relleno", "HID-02.01.01", "Excavación de canal en material suelto", "m³", r(["MO-OPM", 0.12], ["MO-PEO", 0.18], ["EQ-RET", 0.1], ["EQ-VOL", 0.08], ["EQ-HIN", 3])),
  p("hidraulica", "02 Excavación y relleno", "HID-02.01.02", "Excavación de canal en material conglomerado", "m³", r(["MO-OPM", 0.18], ["MO-PEO", 0.25], ["EQ-EXC", 0.14], ["EQ-VOL", 0.12], ["EQ-HIN", 3])),
  p("hidraulica", "02 Excavación y relleno", "HID-02.02.01", "Perfilado de taludes de canal", "m²", r(["MO-PEO", 0.14], ["MO-OPE", 0.04], ["EQ-HIN", 4])),
  p("hidraulica", "02 Excavación y relleno", "HID-02.03.01", "Relleno compactado de espaldones", "m³", r(["MO-PEO", 0.4], ["MO-OPE", 0.1], ["EQ-COM", 0.2], ["EQ-HIN", 4])),
  p("hidraulica", "02 Excavación y relleno", "HID-02.04.01", "Eliminación de material excedente", "m³", r(["MO-CHO", 0.09], ["EQ-VOL", 0.22], ["EQ-HIN", 2])),

  p("hidraulica", "03 Revestimiento de canales", "HID-03.01.01", "Solado de canal f'c 140 e=5 cm", "m²", r(["MO-OPE", 0.22], ["MO-PEO", 0.3], ["MAT-CEM", 0.28], ["MAT-ARE", 0.045], ["MAT-PIE", 0.055], ["EQ-MEZ", 0.05], ["EQ-HIN", 5])),
  p("hidraulica", "03 Revestimiento de canales", "HID-03.02.01", "Revestimiento de concreto f'c 175 e=7.5 cm", "m²", r(["MO-OPE", 0.42], ["MO-PEO", 0.5], ["MAT-CEM", 0.55], ["MAT-ARE", 0.04], ["MAT-PIE", 0.07], ["MAT-MALLQ138", 1.05], ["EQ-MEZ", 0.07], ["EQ-HIN", 5])),
  p("hidraulica", "03 Revestimiento de canales", "HID-03.02.02", "Revestimiento de concreto f'c 210 e=10 cm", "m²", r(["MO-OPE", 0.5], ["MO-PEO", 0.58], ["MAT-CEM", 0.78], ["MAT-ARE", 0.05], ["MAT-PIE", 0.09], ["MAT-MALL", 1.05], ["EQ-MEZ", 0.09], ["EQ-HIN", 5])),
  p("hidraulica", "03 Revestimiento de canales", "HID-03.03.01", "Revestimiento de mampostería de piedra", "m²", r(["MO-ALB", 0.7], ["MO-PEO", 0.85], ["MAT-PIEDGAV", 0.18], ["MAT-CEM", 0.22], ["MAT-ARE", 0.03], ["EQ-HIN", 5])),
  p("hidraulica", "03 Revestimiento de canales", "HID-03.04.01", "Revestimiento con geomembrana HDPE 1 mm", "m²", r(["MO-OPE", 0.18], ["MO-PEO", 0.22], ["MAT-GEOMEM", 1.12], ["EQ-HIN", 4])),
  p("hidraulica", "03 Revestimiento de canales", "HID-03.05.01", "Junta de dilatación en canal revestido", "m", r(["MO-OPE", 0.16], ["MO-PEO", 0.12], ["MAT-JUNT", 1], ["EQ-HIN", 4])),
  p("hidraulica", "03 Revestimiento de canales", "HID-03.06.01", "Geotextil de protección bajo geomembrana", "m²", r(["MO-OPE", 0.04], ["MO-PEO", 0.08], ["MAT-GEO", 1.1], ["EQ-HIN", 3])),

  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.01.01", "Bocatoma de concreto armado f'c 210", "m³", r(["MO-OPE", 3.6], ["MO-PEO", 4.4], ["MO-FIE", 1.2], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-FY42", 95], ["EQ-MEZ", 0.58], ["EQ-VIB", 0.42], ["EQ-HIN", 5])),
  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.02.01", "Desarenador de concreto f'c 210", "m³", r(["MO-OPE", 3.4], ["MO-PEO", 4.2], ["MO-FIE", 1.0], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-FY42", 80], ["EQ-MEZ", 0.55], ["EQ-HIN", 5])),
  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.03.01", "Compuerta metálica deslizante 1.00×1.00 m", "und", r(["MO-HERR", 8], ["MO-MEC", 4], ["MO-PEO", 6], ["MAT-COMPU", 1], ["MAT-CEM", 0.4], ["EQ-SOL", 2], ["EQ-HIN", 4])),
  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.04.01", "Sifón invertido de concreto f'c 210", "m", r(["MO-OPE", 2.8], ["MO-PEO", 3.4], ["MO-FIE", 0.8], ["MAT-CEM", 2.2], ["MAT-FY42", 28], ["MAT-MAD", 4], ["EQ-MEZ", 0.2], ["EQ-HIN", 5])),
  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.05.01", "Alcantarilla hidráulica Ø900 mm", "m", r(["MO-OPE", 1.1], ["MO-PEO", 1.4], ["MAT-ALC", 1.05], ["MAT-CEM", 0.22], ["EQ-HIN", 4])),
  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.06.01", "Caída / rápido de concreto f'c 210", "m³", r(["MO-OPE", 3.5], ["MO-PEO", 4.2], ["MO-FIE", 0.9], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-FY42", 70], ["EQ-MEZ", 0.55], ["EQ-HIN", 5])),
  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.07.01", "Partidor de caudal de concreto", "m³", r(["MO-OPE", 3.3], ["MO-PEO", 4.0], ["MO-FIE", 0.8], ["MAT-CEM", 8.4], ["MAT-FY42", 65], ["EQ-MEZ", 0.5], ["EQ-HIN", 5])),
  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.08.01", "Aliviadero lateral de concreto", "m³", r(["MO-OPE", 3.4], ["MO-PEO", 4.1], ["MO-FIE", 0.85], ["MAT-CEM", 8.4], ["MAT-FY42", 72], ["EQ-MEZ", 0.52], ["EQ-HIN", 5])),

  p("hidraulica", "05 Drenaje y protección", "HID-05.01.01", "Cuneta de coronación en tierra", "m", r(["MO-PEO", 0.35], ["MO-OPE", 0.08], ["EQ-HIN", 4])),
  p("hidraulica", "05 Drenaje y protección", "HID-05.02.01", "Enrocado de protección (rip-rap)", "m³", r(["MO-OPE", 0.85], ["MO-PEO", 1.2], ["MAT-RIPRAP", 1.15], ["EQ-RET", 0.08], ["EQ-HIN", 4])),
  p("hidraulica", "05 Drenaje y protección", "HID-05.03.01", "Colchón de gaviones", "m²", r(["MO-OPE", 0.55], ["MO-PEO", 0.8], ["MAT-GAVION", 0.18], ["MAT-PIEDGAV", 0.35], ["EQ-HIN", 4])),
  p("hidraulica", "05 Drenaje y protección", "HID-05.04.01", "Geocelda de confinamiento en talud", "m²", r(["MO-OPE", 0.22], ["MO-PEO", 0.28], ["MAT-GEOCEL", 1.08], ["MAT-TIER", 0.05], ["EQ-HIN", 4])),
  p("hidraulica", "05 Drenaje y protección", "HID-05.05.01", "Dren de pie con geotextil y grava", "m", r(["MO-PEO", 0.45], ["MO-OPE", 0.12], ["MAT-GEO", 1.2], ["MAT-CONF", 0.08], ["EQ-HIN", 4])),
];

const HID_EXTRA: Partida[] = [
  p("hidraulica", "01 Trabajos preliminares", "HID-01.04.01", "Campamento y almacén de obra hidráulica", "glb", r(["MO-CAR", 32], ["MO-PEO", 28], ["MAT-MAD", 220], ["MAT-CALA", 16], ["MAT-PINL", 3], ["EQ-HIN", 4])),
  p("hidraulica", "01 Trabajos preliminares", "HID-01.05.01", "Cartel de identificación de obra hidráulica", "und", r(["MO-CAR", 10], ["MO-PEO", 8], ["MAT-MAD", 100], ["MAT-PINL", 2], ["EQ-HIN", 4])),
  p("hidraulica", "01 Trabajos preliminares", "HID-01.06.01", "Implementación SSOMA de obra hidráulica", "glb", r(["MO-SSO", 24], ["MO-VIG", 80], ["MAT-KITSSO", 8], ["MAT-CASCO", 10], ["MAT-CONO", 6], ["MAT-CINTS", 60], ["EQ-HIN", 2])),

  p("hidraulica", "02 Excavación y relleno", "HID-02.01.03", "Excavación de canal en roca (martillo)", "m³", r(["MO-OPM", 0.32], ["MO-PEO", 0.22], ["EQ-EXC", 0.24], ["EQ-COMW", 0.16], ["EQ-VOL", 0.18], ["EQ-HIN", 2])),
  p("hidraulica", "02 Excavación y relleno", "HID-02.05.01", "Agotamiento y bombeo de filtraciones", "día", r(["MO-OPE", 4], ["MO-PEO", 4], ["EQ-BOMSUM", 8], ["EQ-HIN", 3])),
  p("hidraulica", "02 Excavación y relleno", "HID-02.06.01", "Cama de apoyo de arena bajo revestimiento", "m³", r(["MO-PEO", 0.35], ["MO-OPE", 0.08], ["MAT-AREC", 1.12], ["EQ-HIN", 4])),

  p("hidraulica", "03 Revestimiento de canales", "HID-03.02.03", "Revestimiento de concreto f'c 210 e=12.5 cm", "m²", r(["MO-OPE", 0.58], ["MO-PEO", 0.66], ["MAT-CEM", 0.98], ["MAT-ARE", 0.06], ["MAT-PIE", 0.11], ["MAT-MALL", 1.05], ["EQ-MEZ", 0.1], ["EQ-HIN", 5])),
  p("hidraulica", "03 Revestimiento de canales", "HID-03.07.01", "Enlucido de canal f'c 140 e=1.5 cm", "m²", r(["MO-OPE", 0.22], ["MO-PEO", 0.18], ["MAT-CEM", 0.12], ["MAT-ARE", 0.018], ["EQ-HIN", 5])),
  p("hidraulica", "03 Revestimiento de canales", "HID-03.08.01", "Canal entubado HDPE PE100 Ø315 mm", "m", r(["MO-GAS", 0.55], ["MO-PEO", 0.7], ["MAT-HDPE315", 1.05], ["MAT-AREC", 0.08], ["EQ-HIN", 4])),
  p("hidraulica", "03 Revestimiento de canales", "HID-03.09.01", "Transición de ingreso / salida de concreto", "m³", r(["MO-OPE", 3.2], ["MO-PEO", 3.8], ["MO-FIE", 0.7], ["MAT-CEM", 8.2], ["MAT-ARE", 0.5], ["MAT-PIE", 0.88], ["MAT-FY42", 58], ["EQ-MEZ", 0.48], ["EQ-HIN", 5])),

  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.03.02", "Compuerta metálica deslizante 0.60×0.60 m", "und", r(["MO-HERR", 6], ["MO-MEC", 3], ["MO-PEO", 4], ["MAT-COMPU", 0.55], ["MAT-CEM", 0.28], ["EQ-SOL", 1.4], ["EQ-HIN", 4])),
  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.09.01", "Toma lateral / marco partidor", "und", r(["MO-OPE", 8], ["MO-PEO", 10], ["MO-HERR", 4], ["MAT-TOMALAT", 1], ["MAT-CEM", 0.8], ["EQ-HIN", 4])),
  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.10.01", "Aforador metálico tipo RBC", "und", r(["MO-HERR", 6], ["MO-OPE", 4], ["MO-PEO", 5], ["MAT-AFO", 1], ["MAT-CEM", 0.35], ["EQ-HIN", 4])),
  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.11.01", "Puente-canal de concreto armado f'c 210", "m³", r(["MO-OPE", 3.8], ["MO-PEO", 4.6], ["MO-FIE", 1.3], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-FY42", 110], ["EQ-MEZ", 0.6], ["EQ-VIB", 0.4], ["EQ-HIN", 5])),
  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.12.01", "Pozo de visita en sifón invertido", "und", r(["MO-OPE", 8], ["MO-PEO", 10], ["MAT-CAMPREF", 1], ["MAT-CEM", 1.2], ["MAT-TAPA", 1], ["EQ-HIN", 5])),
  p("hidraulica", "04 Obras de arte hidráulicas", "HID-04.13.01", "Cámara de carga de concreto f'c 210", "m³", r(["MO-OPE", 3.5], ["MO-PEO", 4.2], ["MO-FIE", 1.0], ["MAT-CEM", 8.4], ["MAT-FY42", 85], ["EQ-MEZ", 0.55], ["EQ-HIN", 5])),

  p("hidraulica", "05 Drenaje y protección", "HID-05.06.01", "Gavión caja 2.00×1.00×1.00 m", "und", r(["MO-OPE", 1.8], ["MO-PEO", 2.4], ["MAT-GAVION", 1], ["MAT-PIEDGAV", 0.85], ["EQ-HIN", 4])),
  p("hidraulica", "05 Drenaje y protección", "HID-05.07.01", "Muro de contención de concreto f'c 210", "m³", r(["MO-OPE", 3.4], ["MO-PEO", 4.1], ["MO-FIE", 1.1], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-FY42", 90], ["EQ-MEZ", 0.55], ["EQ-HIN", 5])),
  p("hidraulica", "05 Drenaje y protección", "HID-05.08.01", "Revegetación de taludes con tierra vegetal", "m²", r(["MO-JARD", 0.12], ["MO-PEO", 0.16], ["MAT-TIER", 0.08], ["MAT-CESP", 0.4], ["EQ-HIN", 3])),
  p("hidraulica", "05 Drenaje y protección", "HID-05.09.01", "Enrocado de pie de talud (rip-rap clase II)", "m³", r(["MO-OPE", 0.9], ["MO-PEO", 1.25], ["MAT-RIPRAP", 1.18], ["EQ-RET", 0.09], ["EQ-HIN", 4])),

  p("hidraulica", "06 Conducción entubada", "HID-06.01.01", "Tubería de conducción HDPE PE100 Ø160 mm", "m", r(["MO-GAS", 0.38], ["MO-PEO", 0.45], ["MAT-HDPE160", 1.05], ["MAT-AREC", 0.06], ["EQ-HIN", 4])),
  p("hidraulica", "06 Conducción entubada", "HID-06.02.01", "Válvula de control Ø110 mm", "und", r(["MO-GAS", 4], ["MO-MEC", 2], ["MO-PEO", 3], ["MAT-VALVG", 1], ["MAT-CEM", 0.25], ["EQ-HIN", 4])),
  p("hidraulica", "06 Conducción entubada", "HID-06.03.01", "Válvula de aire Ø50 mm", "und", r(["MO-GAS", 2.5], ["MO-PEO", 2], ["MAT-VALVA", 1], ["MAT-CEM", 0.12], ["EQ-HIN", 4])),
];

/** Habilitaciones urbanas, pistas y veredas. Códigos HAB — no usar CAR ni ARQ de edificio. */
const HAB: Partida[] = [
  p("habilitaciones", "01 Preliminares y lotización", "HAB-01.01.01", "Trazo y replanteo de lotes y vías", "m²", r(["MO-TOPO", 0.008], ["MO-OPE", 0.012], ["MO-PEO", 0.016], ["EQ-NIV", 0.003], ["EQ-HIN", 4])),
  p("habilitaciones", "01 Preliminares y lotización", "HAB-01.02.01", "Mojón de concreto para lotización", "und", r(["MO-OPE", 0.45], ["MO-PEO", 0.55], ["MAT-MOJON", 1], ["MAT-CEM", 0.04], ["EQ-HIN", 4])),
  p("habilitaciones", "01 Preliminares y lotización", "HAB-01.03.01", "Limpieza y desbroce de habilitación", "m²", r(["MO-PEO", 0.05], ["MO-OPM", 0.012], ["EQ-RET", 0.01], ["EQ-HIN", 3])),
  p("habilitaciones", "01 Preliminares y lotización", "HAB-01.04.01", "Movimiento de tierras para plataformas", "m³", r(["MO-OPM", 0.1], ["MO-PEO", 0.08], ["EQ-RET", 0.09], ["EQ-VOL", 0.14], ["EQ-HIN", 2])),
  p("habilitaciones", "01 Preliminares y lotización", "HAB-01.05.01", "Cartel de habilitación urbana", "und", r(["MO-CAR", 10], ["MO-PEO", 8], ["MAT-MAD", 100], ["MAT-PINL", 2], ["EQ-HIN", 4])),

  p("habilitaciones", "02 Pistas", "HAB-02.01.01", "Conformación de subrasante de pista", "m²", r(["MO-OPM", 0.028], ["MO-PEO", 0.038], ["EQ-MOT", 0.02], ["EQ-ROD", 0.028], ["EQ-HIN", 2])),
  p("habilitaciones", "02 Pistas", "HAB-02.02.01", "Subbase granular e=20 cm (pista urbana)", "m²", r(["MO-OPM", 0.04], ["MO-PEO", 0.06], ["MAT-SUBB", 0.24], ["EQ-MOT", 0.02], ["EQ-ROD", 0.035], ["EQ-VOL", 0.03], ["EQ-HIN", 3])),
  p("habilitaciones", "02 Pistas", "HAB-02.03.01", "Base granular e=15 cm (pista urbana)", "m²", r(["MO-OPM", 0.048], ["MO-PEO", 0.068], ["MAT-BASE", 0.19], ["EQ-MOT", 0.024], ["EQ-ROD", 0.04], ["EQ-VOL", 0.03], ["EQ-HIN", 3])),
  p("habilitaciones", "02 Pistas", "HAB-02.04.01", "Imprimación asfáltica de pista", "m²", r(["MO-ASF", 0.028], ["MO-PEO", 0.038], ["MAT-BIT", 0.3], ["EQ-HIN", 3])),
  p("habilitaciones", "02 Pistas", "HAB-02.05.01", "Carpeta asfáltica e=5 cm (pista urbana)", "m²", r(["MO-ASF", 0.058], ["MO-OPE", 0.075], ["MO-PEO", 0.095], ["MAT-CAMP", 0.115], ["EQ-FIN", 0.024], ["EQ-ROD", 0.03], ["EQ-HIN", 3])),
  p("habilitaciones", "02 Pistas", "HAB-02.05.02", "Carpeta asfáltica e=7.5 cm (pista colectora)", "m²", r(["MO-ASF", 0.072], ["MO-OPE", 0.095], ["MO-PEO", 0.115], ["MAT-CAMP", 0.172], ["EQ-FIN", 0.028], ["EQ-ROD", 0.035], ["EQ-HIN", 3])),
  p("habilitaciones", "02 Pistas", "HAB-02.06.01", "Pavimento rígido f'c 280 e=20 cm (pista)", "m²", r(["MO-OPE", 0.46], ["MO-PEO", 0.56], ["MAT-PREM280", 0.22], ["MAT-MALL", 1.05], ["MAT-CUR", 0.06], ["EQ-HORM", 0.08], ["EQ-VIB", 0.08], ["EQ-HIN", 4])),
  p("habilitaciones", "02 Pistas", "HAB-02.07.01", "Adoquinado vehicular e=8 cm", "m²", r(["MO-OPE", 0.42], ["MO-PEO", 0.52], ["MAT-ADOQ", 1.05], ["MAT-AREC", 0.04], ["EQ-COM", 0.06], ["EQ-HIN", 4])),
  p("habilitaciones", "02 Pistas", "HAB-02.08.01", "Junta aserrada y sellada en pista rígida", "m", r(["MO-OPE", 0.12], ["MO-PEO", 0.1], ["MAT-JUNT", 1], ["EQ-CORT", 0.08], ["EQ-HIN", 4])),

  p("habilitaciones", "03 Veredas y sardineles", "HAB-03.01.01", "Vereda de concreto f'c 175 e=10 cm", "m²", r(["MO-OPE", 0.33], ["MO-PEO", 0.4], ["MAT-CEM", 0.72], ["MAT-ARE", 0.04], ["MAT-PIE", 0.07], ["MAT-AGU", 0.018], ["EQ-MEZ", 0.05], ["EQ-HIN", 4])),
  p("habilitaciones", "03 Veredas y sardineles", "HAB-03.01.02", "Vereda de concreto f'c 175 e=12 cm", "m²", r(["MO-OPE", 0.36], ["MO-PEO", 0.42], ["MAT-CEM", 0.86], ["MAT-ARE", 0.048], ["MAT-PIE", 0.084], ["EQ-MEZ", 0.055], ["EQ-HIN", 4])),
  p("habilitaciones", "03 Veredas y sardineles", "HAB-03.01.03", "Vereda de concreto f'c 210 e=15 cm", "m²", r(["MO-OPE", 0.4], ["MO-PEO", 0.46], ["MAT-CEM", 1.15], ["MAT-ARE", 0.055], ["MAT-PIE", 0.1], ["EQ-MEZ", 0.065], ["EQ-HIN", 4])),
  p("habilitaciones", "03 Veredas y sardineles", "HAB-03.02.01", "Sardinel prefabricado tipo A", "m", r(["MO-OPE", 0.36], ["MO-PEO", 0.42], ["MAT-SARD", 1], ["MAT-CEM", 0.08], ["MAT-ARE", 0.012], ["EQ-HIN", 4])),
  p("habilitaciones", "03 Veredas y sardineles", "HAB-03.02.02", "Sardinel in situ f'c 175", "m", r(["MO-OPE", 0.44], ["MO-PEO", 0.5], ["MAT-CEM", 0.24], ["MAT-ARE", 0.016], ["MAT-PIE", 0.024], ["MAT-MAD", 0.65], ["EQ-MEZ", 0.04], ["EQ-HIN", 4])),
  p("habilitaciones", "03 Veredas y sardineles", "HAB-03.03.01", "Rampa PMR de concreto f'c 175", "m²", r(["MO-OPE", 0.55], ["MO-PEO", 0.5], ["MAT-CEM", 0.85], ["MAT-ARE", 0.045], ["MAT-PIE", 0.08], ["EQ-MEZ", 0.06], ["EQ-HIN", 4])),
  p("habilitaciones", "03 Veredas y sardineles", "HAB-03.04.01", "Baldosa podotáctil 30×30 cm", "m²", r(["MO-ALB", 0.48], ["MO-PEO", 0.35], ["MAT-PODO", 1.08], ["MAT-PEG", 0.12], ["EQ-HIN", 5])),
  p("habilitaciones", "03 Veredas y sardineles", "HAB-03.05.01", "Jardinera de concreto en berma", "m", r(["MO-OPE", 0.55], ["MO-PEO", 0.6], ["MAT-JARDINERA", 1], ["MAT-CEM", 0.1], ["EQ-HIN", 4])),
  p("habilitaciones", "03 Veredas y sardineles", "HAB-03.06.01", "Adoquinado peatonal e=6 cm", "m²", r(["MO-OPE", 0.38], ["MO-PEO", 0.45], ["MAT-ADOQ", 1.05], ["MAT-AREC", 0.035], ["EQ-HIN", 4])),

  p("habilitaciones", "04 Drenaje pluvial urbano", "HAB-04.01.01", "Sumidero urbano de concreto c/rejilla", "und", r(["MO-OPE", 4.5], ["MO-PEO", 5], ["MAT-SUMURB", 1], ["MAT-REJPLU", 1], ["MAT-CEM", 0.35], ["EQ-HIN", 4])),
  p("habilitaciones", "04 Drenaje pluvial urbano", "HAB-04.02.01", "Colector pluvial PVC UF Ø315 mm", "m", r(["MO-GAS", 0.5], ["MO-AYU", 0.4], ["MO-PEO", 0.32], ["MAT-PVC315", 1.05], ["MAT-ANIL", 0.22], ["EQ-HIN", 5])),
  p("habilitaciones", "04 Drenaje pluvial urbano", "HAB-04.03.01", "Cuneta de concreto en berma", "m", r(["MO-OPE", 0.5], ["MO-PEO", 0.58], ["MAT-CEM", 0.4], ["MAT-ARE", 0.028], ["MAT-PIE", 0.048], ["EQ-MEZ", 0.05], ["EQ-HIN", 4])),
  p("habilitaciones", "04 Drenaje pluvial urbano", "HAB-04.04.01", "Buzón pluvial de concreto h=1.50 m", "und", r(["MO-OPE", 6], ["MO-PEO", 8], ["MAT-CEM", 6.5], ["MAT-FY42", 28], ["MAT-TAPA", 1], ["MAT-REJPLU", 1], ["EQ-MEZ", 0.5], ["EQ-HIN", 5])),

  p("habilitaciones", "05 Áreas verdes", "HAB-05.01.01", "Tierra vegetal e=0.20 m en parques", "m²", r(["MO-JARD", 0.1], ["MO-PEO", 0.16], ["MAT-TIER", 0.24], ["EQ-HIN", 3])),
  p("habilitaciones", "05 Áreas verdes", "HAB-05.02.01", "Césped en rollos (parque / berma)", "m²", r(["MO-JARD", 0.16], ["MO-PEO", 0.12], ["MAT-CESP", 1.08], ["EQ-HIN", 3])),
  p("habilitaciones", "05 Áreas verdes", "HAB-05.03.01", "Plantación de árbol forestal", "und", r(["MO-JARD", 0.75], ["MO-PEO", 0.55], ["MAT-ARBOL", 1], ["MAT-TIER", 0.08], ["EQ-HIN", 3])),
  p("habilitaciones", "05 Áreas verdes", "HAB-05.04.01", "Red de riego por aspersión", "m", r(["MO-JARD", 0.18], ["MO-GAS", 0.12], ["MAT-RIEGO", 1.05], ["EQ-HIN", 4])),
  p("habilitaciones", "05 Áreas verdes", "HAB-05.05.01", "Módulo de juegos infantiles", "und", r(["MO-OPE", 16], ["MO-PEO", 20], ["MAT-JUEGO", 1], ["MAT-CEM", 2], ["EQ-HIN", 3])),
  p("habilitaciones", "05 Áreas verdes", "HAB-05.06.01", "Banca de concreto prefabricada", "und", r(["MO-OPE", 1.2], ["MO-PEO", 1.5], ["MAT-BANCO", 1], ["MAT-CEM", 0.08], ["EQ-HIN", 3])),
  p("habilitaciones", "05 Áreas verdes", "HAB-05.07.01", "Papelera urbana", "und", r(["MO-OPE", 0.6], ["MO-PEO", 0.5], ["MAT-PAPEL", 1], ["EQ-HIN", 3])),

  p("habilitaciones", "06 Alumbrado público", "HAB-06.01.01", "Poste de concreto pretensado 9 m c/cimentación f'c 175 y brazo", "und", r(["MO-ELE", 4], ["MO-PEO", 8], ["MAT-POSTE9", 1], ["MAT-CEM", 1.8], ["MAT-FY42", 12], ["EQ-GRU", 0.35], ["EQ-HIN", 4])),
  p("habilitaciones", "06 Alumbrado público", "HAB-06.02.01", "Luminaria LED 100 W alumbrado público (IP65, driver incluido)", "und", r(["MO-ELE", 1.4], ["MO-AYU", 1.0], ["MAT-LUMAP", 1], ["EQ-HIN", 3])),
  p("habilitaciones", "06 Alumbrado público", "HAB-06.03.01", "Red de alumbrado público — cable NYY 2×16 mm² 0.6/1 kV en ducto", "m", r(["MO-ELE", 0.16], ["MO-AYU", 0.14], ["MAT-CABLEAP", 1.05], ["MAT-DUCT", 0.4], ["EQ-HIN", 4])),
  p("habilitaciones", "06 Alumbrado público", "HAB-06.04.01", "Pozo a tierra de alumbrado público (varilla copperweld Ø16 mm × 2.40 m + sal)", "und", r(["MO-ELE", 3], ["MO-PEO", 5], ["MAT-PAT", 1], ["MAT-SALT", 30], ["MAT-CEM", 0.3], ["EQ-HIN", 4])),
  p("habilitaciones", "06 Alumbrado público", "HAB-06.05.01", "Tablero de control de alumbrado público (contactor + fotocelda + protecciones)", "und", r(["MO-TEC", 6], ["MO-AYU", 4], ["MAT-TAB", 1], ["MAT-CONT", 2], ["MAT-TERM", 4], ["EQ-HIN", 4])),

  p("habilitaciones", "07 Señalización urbana", "HAB-07.01.01", "Pintura vial termoplástica reflectante de eje / borde (línea 10–15 cm, blanco o amarillo)", "m", r(["MO-OPE", 0.045], ["MO-PEO", 0.05], ["MAT-PINTV", 0.2], ["EQ-HIN", 3])),
  p("habilitaciones", "07 Señalización urbana", "HAB-07.02.01", "Tacha reflectiva urbana (ojo de gato) policarbonato / cerámica", "und", r(["MO-OPE", 0.075], ["MO-PEO", 0.055], ["MAT-TACO", 1], ["EQ-HIN", 3])),
  p("habilitaciones", "07 Señalización urbana", "HAB-07.03.01", "Señal vertical urbana reflectiva grado ingeniería c/poste galvanizado", "und", r(["MO-OPE", 1.5], ["MO-PEO", 1.2], ["MAT-POSTESEN", 1], ["MAT-REFLEC", 0.55], ["MAT-CEM", 0.16], ["EQ-HIN", 4])),
  p("habilitaciones", "07 Señalización urbana", "HAB-07.04.01", "Bolardo de concreto", "und", r(["MO-OPE", 0.5], ["MO-PEO", 0.6], ["MAT-BOLAR", 1], ["MAT-CEM", 0.06], ["EQ-HIN", 3])),
  p("habilitaciones", "07 Señalización urbana", "HAB-07.05.01", "Semáforo vehicular LED 3 aspectos c/poste y controlador", "und", r(["MO-TEC", 12], ["MO-ELE", 8], ["MO-PEO", 10], ["MAT-SEMAF", 1], ["MAT-CEM", 0.8], ["EQ-HIN", 3])),
];

const HAB_EXTRA: Partida[] = [
  p("habilitaciones", "01 Preliminares y lotización", "HAB-01.06.01", "Cerco perimétrico provisional (malla raschel)", "m", r(["MO-OPE", 0.18], ["MO-PEO", 0.22], ["MAT-MALLS", 1.8], ["MAT-MAD", 2.4], ["EQ-HIN", 4])),
  p("habilitaciones", "01 Preliminares y lotización", "HAB-01.07.01", "Demolición de vereda y sardinel existentes", "m²", r(["MO-OPE", 0.24], ["MO-PEO", 0.3], ["EQ-DEMOL", 0.08], ["EQ-VOL", 0.04], ["EQ-HIN", 3])),
  p("habilitaciones", "01 Preliminares y lotización", "HAB-01.08.01", "Relleno compactado de plataforma urbana", "m³", r(["MO-OPM", 0.1], ["MO-PEO", 0.14], ["MAT-RELL", 1.15], ["EQ-CAR", 0.08], ["EQ-ROD", 0.11], ["EQ-HIN", 2])),
  p("habilitaciones", "01 Preliminares y lotización", "HAB-01.09.01", "Control de tránsito y desvíos en vía urbana", "glb", r(["MO-OPE", 10], ["MO-PEO", 14], ["MAT-CONO", 24], ["MAT-CINTS", 120], ["MAT-PINTV", 4], ["EQ-HIN", 3])),

  p("habilitaciones", "02 Pistas", "HAB-02.02.02", "Subbase granular e=25 cm (pista urbana)", "m²", r(["MO-OPM", 0.045], ["MO-PEO", 0.07], ["MAT-SUBB", 0.3], ["EQ-MOT", 0.022], ["EQ-ROD", 0.04], ["EQ-VOL", 0.035], ["EQ-HIN", 3])),
  p("habilitaciones", "02 Pistas", "HAB-02.03.02", "Base granular e=20 cm (pista urbana)", "m²", r(["MO-OPM", 0.055], ["MO-PEO", 0.08], ["MAT-BASE", 0.25], ["EQ-MOT", 0.028], ["EQ-ROD", 0.045], ["EQ-VOL", 0.035], ["EQ-HIN", 3])),
  p("habilitaciones", "02 Pistas", "HAB-02.09.01", "Riego de liga 0.5 L/m² (pista urbana)", "m²", r(["MO-ASF", 0.02], ["MO-PEO", 0.03], ["MAT-EMUL", 0.14], ["EQ-HIN", 3])),
  p("habilitaciones", "02 Pistas", "HAB-02.10.01", "Geotextil de separación en subrasante urbana", "m²", r(["MO-OPE", 0.04], ["MO-PEO", 0.08], ["MAT-GEO", 1.12], ["EQ-HIN", 3])),
  p("habilitaciones", "02 Pistas", "HAB-02.11.01", "Eliminación de material excedente D=10 km", "m³", r(["MO-CHO", 0.12], ["EQ-VOL", 0.28], ["EQ-HIN", 2])),

  p("habilitaciones", "03 Veredas y sardineles", "HAB-03.02.03", "Sardinel tipo B / montable f'c 175", "m", r(["MO-OPE", 0.4], ["MO-PEO", 0.46], ["MAT-CEM", 0.2], ["MAT-ARE", 0.015], ["MAT-PIE", 0.02], ["MAT-MAD", 0.55], ["EQ-MEZ", 0.038], ["EQ-HIN", 4])),
  p("habilitaciones", "03 Veredas y sardineles", "HAB-03.07.01", "Solado de apoyo bajo vereda e=5 cm", "m²", r(["MO-OPE", 0.16], ["MO-PEO", 0.22], ["MAT-PREM100", 0.055], ["EQ-MEZ", 0.03], ["EQ-HIN", 4])),
  p("habilitaciones", "03 Veredas y sardineles", "HAB-03.08.01", "Junta aserrada y sellada en vereda", "m", r(["MO-OPE", 0.1], ["MO-PEO", 0.08], ["MAT-JUNT", 1], ["EQ-CORT", 0.06], ["EQ-HIN", 4])),
  p("habilitaciones", "03 Veredas y sardineles", "HAB-03.09.01", "Vereda de concreto f'c 175 e=8 cm", "m²", r(["MO-OPE", 0.28], ["MO-PEO", 0.34], ["MAT-CEM", 0.58], ["MAT-ARE", 0.032], ["MAT-PIE", 0.055], ["EQ-MEZ", 0.045], ["EQ-HIN", 4])),

  p("habilitaciones", "04 Drenaje pluvial urbano", "HAB-04.02.02", "Colector pluvial concreto Ø400 mm", "m", r(["MO-GAS", 0.65], ["MO-PEO", 0.85], ["MAT-TUBCR", 1.05], ["MAT-CEM", 0.1], ["EQ-HIN", 5])),
  p("habilitaciones", "04 Drenaje pluvial urbano", "HAB-04.05.01", "Rejilla de sumidero de fierro fundido", "und", r(["MO-OPE", 1.2], ["MO-PEO", 1.4], ["MAT-REJPLU", 1], ["MAT-CEM", 0.08], ["EQ-HIN", 4])),
  p("habilitaciones", "04 Drenaje pluvial urbano", "HAB-04.06.01", "Cuneta triangular de concreto f'c 175", "m", r(["MO-OPE", 0.48], ["MO-PEO", 0.55], ["MAT-CEM", 0.38], ["MAT-ARE", 0.026], ["MAT-PIE", 0.044], ["EQ-MEZ", 0.048], ["EQ-HIN", 4])),

  p("habilitaciones", "05 Áreas verdes", "HAB-05.03.02", "Plantación de arbusto ornamental", "und", r(["MO-JARD", 0.35], ["MO-PEO", 0.28], ["MAT-ARBSH", 1], ["MAT-TIER", 0.03], ["EQ-HIN", 3])),
  p("habilitaciones", "05 Áreas verdes", "HAB-05.08.01", "Cerco de malla olímpica h=1.80 m (parque)", "m", r(["MO-OPE", 0.55], ["MO-PEO", 0.65], ["MAT-CERCOP", 1], ["MAT-CEM", 0.12], ["EQ-HIN", 4])),
  p("habilitaciones", "05 Áreas verdes", "HAB-05.09.01", "Piso de loseta 40×40 cm en plaza", "m²", r(["MO-ALB", 0.42], ["MO-PEO", 0.32], ["MAT-LOSETA", 1.08], ["MAT-AREC", 0.03], ["EQ-HIN", 4])),
  p("habilitaciones", "05 Áreas verdes", "HAB-05.10.01", "Red de riego por goteo", "m", r(["MO-JARD", 0.14], ["MO-GAS", 0.1], ["MAT-GOTEO", 1.05], ["EQ-HIN", 4])),

  p("habilitaciones", "06 Alumbrado público", "HAB-06.01.02", "Poste de concreto 9 m peatonal / berma", "und", r(["MO-ELE", 3.5], ["MO-PEO", 7], ["MAT-POSTE9", 1], ["MAT-CEM", 1.5], ["MAT-FY42", 10], ["EQ-GRU", 0.3], ["EQ-HIN", 4])),
  p("habilitaciones", "06 Alumbrado público", "HAB-06.02.02", "Luminaria LED peatonal 50 W IP65", "und", r(["MO-ELE", 1.2], ["MO-AYU", 0.9], ["MAT-LUMAP50", 1], ["EQ-HIN", 3])),
  p("habilitaciones", "06 Alumbrado público", "HAB-06.06.01", "Cámara de paso eléctrica urbana de concreto (tapa registro)", "und", r(["MO-ELE", 3], ["MO-PEO", 4], ["MAT-CAMPREF", 0.4], ["MAT-CEM", 0.45], ["MAT-TAPA", 1], ["EQ-HIN", 4])),

  p("habilitaciones", "07 Señalización urbana", "HAB-07.01.02", "Cruce peatonal (cebra) — pintura termoplástica extruida / spray reflectante blanca", "m²", r(["MO-OPE", 0.22], ["MO-PEO", 0.18], ["MAT-PINTV", 0.55], ["EQ-HIN", 3])),
  p("habilitaciones", "07 Señalización urbana", "HAB-07.06.01", "Reductor de velocidad de concreto", "m", r(["MO-OPE", 0.85], ["MO-PEO", 0.9], ["MAT-REDUC", 1], ["MAT-CEM", 0.12], ["EQ-HIN", 4])),
  p("habilitaciones", "07 Señalización urbana", "HAB-07.07.01", "Señal de nomenclatura de calle reflectiva c/poste", "und", r(["MO-OPE", 1.2], ["MO-PEO", 1], ["MAT-POSTESEN", 1], ["MAT-REFLEC", 0.35], ["MAT-CEM", 0.12], ["EQ-HIN", 4])),
];

export const PARTIDAS_OBRAS: Partida[] = [
  ...ARQ_EXTRA,
  ...EST_EXTRA,
  ...IS_EXTRA,
  ...IE_EXTRA,
  ...COM_EXTRA,
  ...IM_EXTRA,
  ...PAV_EXTRA,
  ...SAN_EXTRA,
  ...CAR,
  ...HID,
  ...HID_EXTRA,
  ...HAB,
  ...HAB_EXTRA,
];
