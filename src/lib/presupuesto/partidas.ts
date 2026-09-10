import type { EspecialidadPre, Partida } from "./types";
import { p, r } from "./partidaBuilder";
import { PARTIDAS_OBRAS } from "./partidasObras";
import { PARTIDAS_INSTALACIONES } from "./partidasInstalaciones";
import { PARTIDAS_AMPLIADO } from "./partidasAmpliado";
import { PARTIDAS_BIOMEDICAS } from "./partidasBiomedicas";
import { PARTIDAS_PUENTES_SANEAMIENTO } from "./partidasPuentesSaneamiento";
import { PARTIDAS_ELECTROMECANICAS } from "./partidasElectromecanicas";
import { PARTIDAS_CATALOGO_DETALLE } from "./partidasCatalogoDetalle";
import { PARTIDAS_EQUIPAMIENTO } from "./partidasEquipamiento";
import { PARTIDAS_PUENTES } from "./partidasPuentes";
import { PARTIDAS_DEPORTIVAS } from "./partidasDeportivas";
import { PARTIDAS_PISOS } from "./partidasPisos";
import { PARTIDAS_RN_METRADOS } from "./partidasRnMetrados";
import { PARTIDAS_ESTRUCTURAS_ELEMENTOS } from "./partidasEstructurasElementos";
import { PARTIDAS_TIERRAS_EST } from "./partidasTierrasEst";
import { aplicarCapitulosRn, compararCapitulos, compararCodigoPartida } from "./rnMetrados";

const ARQ: Partida[] = [
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.01.01", "Trazo y replanteo de ejes", "m²", r(["MO-TOPO", 0.02], ["MO-OPE", 0.04], ["MO-PEO", 0.08], ["EQ-NIV", 0.01], ["EQ-HIN", 5])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.01.02", "Limpieza de terreno y desbroce superficial", "m²", r(["MO-PEO", 0.1], ["MO-OPE", 0.02], ["MO-OPM", 0.03], ["EQ-TRA", 0.008], ["EQ-HIN", 4])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.02.01", "Demolición de albañilería", "m³", r(["MO-OPE", 1.8], ["MO-PEO", 2.4], ["EQ-WIN", 0.15], ["EQ-HIN", 5])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.02.02", "Demolición de concreto simple", "m³", r(["MO-OPE", 2.2], ["MO-PEO", 2.8], ["EQ-CORT", 0.4], ["EQ-HIN", 5])),
  p("arquitectura", "01 Trabajos preliminares", "ARQ-01.03.01", "Cartel de obra 3.60×2.40 m", "und", r(["MO-CAR", 8], ["MO-PEO", 6], ["MAT-MAD", 80], ["MAT-PINL", 1.5], ["EQ-HIN", 5])),

  p("estructuras", "02 Movimiento de tierras", "EST-02.01.01", "Excavación masiva en material suelto", "m³", r(["MO-OPM", 0.15], ["MO-PEO", 0.2], ["EQ-RET", 0.12], ["EQ-VOL", 0.18], ["EQ-HIN", 3])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.01.02", "Excavación para cimientos corridos", "m³", r(["MO-OPE", 0.35], ["MO-PEO", 1.1], ["EQ-WIN", 0.05], ["EQ-HIN", 5])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.01.03", "Excavación para zapatas", "m³", r(["MO-OPE", 0.4], ["MO-PEO", 1.2], ["EQ-WIN", 0.06], ["EQ-HIN", 5])),
  p(
    "estructuras",
    "02 Movimiento de tierras",
    "EST-02.06.01",
    "Emparejado y nivelación de terreno (corte superficial, perfilado y compactación)",
    "m²",
    r(
      ["MO-TOPO", 0.018],
      ["MO-OPM", 0.09],
      ["MO-OPE", 0.04],
      ["MO-PEO", 0.12],
      ["EQ-TRAD8", 0.016],
      ["EQ-MOT180", 0.012],
      ["EQ-VIBR", 0.01],
      ["EQ-CAM", 0.008],
      ["EQ-NIV", 0.012],
      ["MAT-DIE", 0.085],
      ["MAT-AGU", 0.012],
      ["EQ-HIN", 4],
    ),
  ),
  p("estructuras", "02 Movimiento de tierras", "EST-02.02.01", "Relleno compactado con material propio", "m³", r(["MO-PEO", 0.45], ["MO-OPE", 0.1], ["EQ-COM", 0.25], ["EQ-HIN", 4])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.02.02", "Relleno compactado con material de préstamo", "m³", r(["MO-PEO", 0.35], ["MO-OPE", 0.08], ["MAT-SUBB", 1.15], ["EQ-COM", 0.28], ["EQ-VOL", 0.12], ["EQ-HIN", 4])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.03.01", "Eliminación de material excedente D=5 km", "m³", r(["MO-OPM", 0.08], ["EQ-VOL", 0.22], ["EQ-HIN", 2])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.04.01", "Nivelación y compactación de fondo de excavación", "m²", r(["MO-PEO", 0.08], ["MO-OPE", 0.03], ["EQ-COM", 0.04], ["EQ-HIN", 4])),

  p("arquitectura", "05 Muros y tabiques", "ARQ-05.01.01", "Muro de ladrillo KK 18 huecos Tipo V 24×13×9 cm, aparejo soga e=13 cm, mortero 1:5", "m²", r(["MO-ALB", 0.55], ["MO-PEO", 0.7], ["MAT-KK18", 42], ["MAT-CEM", 0.22], ["MAT-ARE", 0.035], ["MAT-AGU", 0.02], ["MAT-FY6", 0.18], ["MAT-ALAM", 0.012], ["EQ-HIN", 5])),
  p("arquitectura", "05 Muros y tabiques", "ARQ-05.01.02", "Muro de ladrillo KK 18 huecos Tipo V 24×13×9 cm, aparejo cabeza e=24 cm, mortero 1:5", "m²", r(["MO-ALB", 0.72], ["MO-PEO", 0.9], ["MAT-KK18", 84], ["MAT-CEM", 0.38], ["MAT-ARE", 0.055], ["MAT-AGU", 0.03], ["MAT-FY6", 0.22], ["MAT-ALAM", 0.018], ["EQ-HIN", 5])),
  p("arquitectura", "05 Muros y tabiques", "ARQ-05.02.01", "Tabique de ladrillo pandereta Tipo II 24×12×6 cm e=12 cm, mortero 1:5", "m²", r(["MO-ALB", 0.42], ["MO-PEO", 0.5], ["MAT-PAND", 38], ["MAT-CEM", 0.16], ["MAT-ARE", 0.025], ["MAT-AGU", 0.015], ["MAT-ALAM", 0.008], ["EQ-HIN", 5])),
  p("arquitectura", "05 Muros y tabiques", "ARQ-05.03.01", "Asentado de ladrillo sólido Tipo IV 24×14×6.5 cm en sobrecimiento, mortero 1:4", "m²", r(["MO-ALB", 0.5], ["MO-PEO", 0.6], ["MAT-SOL", 48], ["MAT-CEM", 0.2], ["MAT-ARE", 0.03], ["MAT-AGU", 0.018], ["MAT-ALAM", 0.01], ["EQ-HIN", 5])),
  p("arquitectura", "05 Muros y tabiques", "ARQ-05.04.01", "Tabique de drywall e=12.5 mm, placa 1.20×2.40 m, parante C 89 mm", "m²", r(["MO-DRY", 0.45], ["MO-AYU", 0.3], ["MAT-DRY", 2.2], ["MAT-PERC", 2.6], ["MAT-PERU", 0.85], ["MAT-TORND", 0.5], ["MAT-CINT", 1.2], ["MAT-MAS", 0.7], ["MAT-ESQ", 0.4], ["EQ-HIN", 4])),

  p("arquitectura", "06 Revoques, enlucidos y cielorrasos", "ARQ-06.01.01", "Tarrajeo de muros interiores e=1.5 cm", "m²", r(["MO-ALB", 0.32], ["MO-PEO", 0.28], ["MAT-CEM", 0.12], ["MAT-ARF", 0.018], ["MAT-AGU", 0.012], ["EQ-AND", 0.04], ["EQ-HIN", 5])),
  p("arquitectura", "06 Revoques, enlucidos y cielorrasos", "ARQ-06.01.02", "Tarrajeo de muros exteriores e=2.0 cm", "m²", r(["MO-ALB", 0.38], ["MO-PEO", 0.32], ["MAT-CEM", 0.16], ["MAT-ARF", 0.024], ["MAT-AGU", 0.014], ["EQ-AND", 0.06], ["EQ-HIN", 5])),
  p("arquitectura", "06 Revoques, enlucidos y cielorrasos", "ARQ-06.02.01", "Cielorraso con yeso e=1.5 cm", "m²", r(["MO-ALB", 0.35], ["MO-PEO", 0.25], ["MAT-YES", 8.5], ["MAT-ARF", 0.01], ["EQ-AND", 0.08], ["EQ-HIN", 5])),
  p("arquitectura", "06 Revoques, enlucidos y cielorrasos", "ARQ-06.02.02", "Cielorraso de drywall e=12.5 mm", "m²", r(["MO-DRY", 0.42], ["MO-PEO", 0.28], ["MAT-DRY", 1.08], ["MAT-PER", 2.8], ["EQ-AND", 0.06], ["EQ-HIN", 5])),
  p("arquitectura", "06 Revoques, enlucidos y cielorrasos", "ARQ-06.03.01", "Vestidura de columnas y vigas", "m²", r(["MO-ALB", 0.45], ["MO-PEO", 0.35], ["MAT-CEM", 0.14], ["MAT-ARF", 0.02], ["EQ-AND", 0.05], ["EQ-HIN", 5])),

  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.01.01", "Contrapiso e=2\" (5 cm) mortero 1:5", "m²", r(["MO-OPE", 0.22], ["MO-PEO", 0.28], ["MAT-CEM", 0.16], ["MAT-ARE", 0.028], ["MAT-AGU", 0.012], ["EQ-HIN", 5])),
  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.02.01", "Piso de cemento pulido e=1.5 cm", "m²", r(["MO-ALB", 0.28], ["MO-PEO", 0.22], ["MAT-CEM", 0.14], ["MAT-ARF", 0.016], ["EQ-HIN", 5])),
  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.03.01", "Piso cerámico 30×30 cm PEI III beige", "m²", r(["MO-ALB", 0.45], ["MO-PEO", 0.35], ["MAT-CER", 1.08], ["MAT-PEG", 0.12], ["MAT-FRA", 0.4], ["EQ-HIN", 5])),
  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.03.02", "Piso cerámico 45×45 cm PEI IV beige", "m²", r(["MO-ALB", 0.48], ["MO-PEO", 0.36], ["MAT-CER45", 1.08], ["MAT-PEG", 0.13], ["MAT-FRA", 0.38], ["EQ-HIN", 5])),
  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.03.03", "Piso porcelanato 60×60 cm PEI IV mate beige", "m²", r(["MO-ALB", 0.55], ["MO-PEO", 0.4], ["MAT-POR", 1.08], ["MAT-PEGPOR", 0.14], ["MAT-FRA", 0.35], ["EQ-HIN", 5])),
  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.04.01", "Piso de granito pulido", "m²", r(["MO-ALB", 0.65], ["MO-PEO", 0.45], ["MAT-GRA", 1.08], ["MAT-CEM", 0.08], ["EQ-HIN", 5])),
  p("arquitectura", "07 Contrapisos y pisos", "ARQ-07.05.01", "Piso vinílico en rollo", "m²", r(["MO-ALB", 0.22], ["MO-PEO", 0.18], ["MAT-PEG", 0.08], ["MAT-POLI", 1.05], ["EQ-HIN", 4])),

  p("arquitectura", "08 Zócalos y revestimientos", "ARQ-08.01.01", "Zócalo de mayólica h=0.10 m", "m", r(["MO-ALB", 0.12], ["MO-PEO", 0.08], ["MAT-ZOCMAY", 1.05], ["MAT-PEG", 0.02], ["MAT-FRA", 0.05], ["EQ-HIN", 5])),
  p("arquitectura", "08 Zócalos y revestimientos", "ARQ-08.02.01", "Mayólica en paredes de SS.HH.", "m²", r(["MO-ALB", 0.52], ["MO-PEO", 0.38], ["MAT-MAY20", 1.1], ["MAT-PEG", 0.13], ["MAT-FRA", 0.45], ["EQ-HIN", 5])),
  p("arquitectura", "08 Zócalos y revestimientos", "ARQ-08.02.02", "Mayólica en paredes de cocina", "m²", r(["MO-ALB", 0.5], ["MO-PEO", 0.36], ["MAT-MAY2540", 1.1], ["MAT-PEG", 0.13], ["MAT-FRA", 0.4], ["EQ-HIN", 5])),
  p("arquitectura", "08 Zócalos y revestimientos", "ARQ-08.03.01", "Impermeabilización de azotea con manto", "m²", r(["MO-OPE", 0.25], ["MO-PEO", 0.22], ["MAT-MEMB", 1.12], ["MAT-BIT", 0.15], ["EQ-HIN", 4])),

  p("arquitectura", "09 Carpintería de madera", "ARQ-09.01.01", "Puerta contraplacada 0.90×2.10 m c/marco", "und", r(["MO-CAR", 2.5], ["MO-PEO", 1.2], ["MAT-PUE", 1], ["MAT-CLA", 0.2], ["EQ-SIE", 0.3], ["EQ-HIN", 5])),
  p("arquitectura", "09 Carpintería de madera", "ARQ-09.01.02", "Puerta contraplacada 0.80×2.10 m c/marco", "und", r(["MO-CAR", 2.3], ["MO-PEO", 1.1], ["MAT-PUE80", 1], ["MAT-CLA", 0.18], ["EQ-HIN", 5])),
  p("arquitectura", "09 Carpintería de madera", "ARQ-09.01.03", "Puerta contraplacada 0.70×2.10 m SS.HH.", "und", r(["MO-CAR", 2.1], ["MO-PEO", 1.0], ["MAT-PUE70", 1], ["MAT-CLA", 0.16], ["EQ-HIN", 5])),

  p("arquitectura", "10 Carpintería metálica y cerrajería", "ARQ-10.01.01", "Ventana de aluminio con vidrio 6 mm", "m²", r(["MO-OPE", 1.1], ["MO-AYU", 0.8], ["MAT-VEN", 1], ["MAT-SIL", 0.4], ["EQ-HIN", 4])),
  p("arquitectura", "10 Carpintería metálica y cerrajería", "ARQ-10.02.01", "Puerta metálica de seguridad", "und", r(["MO-SOLD", 3], ["MO-PEO", 2], ["MAT-PUEM", 1], ["MAT-PINE", 0.15], ["EQ-SOL", 1.2], ["EQ-HIN", 4])),
  p("arquitectura", "10 Carpintería metálica y cerrajería", "ARQ-10.03.01", "Baranda de fierro pintada h=0.90 m", "m", r(["MO-SOLD", 0.85], ["MO-PEO", 0.55], ["MAT-FY42", 6.5], ["MAT-PINE", 0.08], ["EQ-SOL", 0.4], ["EQ-HIN", 5])),
  p("arquitectura", "10 Carpintería metálica y cerrajería", "ARQ-10.04.01", "Reja de fierro en vano", "m²", r(["MO-SOLD", 1.4], ["MO-PEO", 0.8], ["MAT-FY42", 18], ["MAT-PINE", 0.12], ["EQ-SOL", 0.6], ["EQ-HIN", 5])),

  p("arquitectura", "11 Vidrios y mamparas", "ARQ-11.01.01", "Vidrio claro 6 mm suministrado y colocado", "m²", r(["MO-VID", 0.45], ["MO-AYU", 0.35], ["MAT-VID", 1.05], ["MAT-SIL", 0.3], ["EQ-HIN", 4])),
  p("arquitectura", "11 Vidrios y mamparas", "ARQ-11.02.01", "Mampara de ducha de vidrio templado", "und", r(["MO-VID", 3], ["MO-AYU", 2], ["MAT-MAM", 1], ["MAT-SIL", 1], ["EQ-HIN", 4])),

  p("arquitectura", "12 Pintura", "ARQ-12.01.01", "Pintura látex en muros interiores 2 manos", "m²", r(["MO-PIN", 0.18], ["MO-AYU", 0.1], ["MAT-PINL", 0.085], ["MAT-IMP", 0.03], ["EQ-AND", 0.03], ["EQ-HIN", 5])),
  p("arquitectura", "12 Pintura", "ARQ-12.01.02", "Pintura látex en muros exteriores 2 manos", "m²", r(["MO-PIN", 0.22], ["MO-AYU", 0.12], ["MAT-PINL", 0.1], ["MAT-IMP", 0.04], ["EQ-AND", 0.05], ["EQ-HIN", 5])),
  p("arquitectura", "12 Pintura", "ARQ-12.02.01", "Pintura esmalte en carpintería", "m²", r(["MO-PIN", 0.28], ["MO-AYU", 0.12], ["MAT-PINE", 0.09], ["MAT-IMP", 0.04], ["EQ-HIN", 5])),
  p("arquitectura", "12 Pintura", "ARQ-12.03.01", "Temple en cielorraso", "m²", r(["MO-PIN", 0.14], ["MO-AYU", 0.1], ["MAT-TEM", 0.35], ["EQ-AND", 0.04], ["EQ-HIN", 5])),

  p("arquitectura", "13 Cubiertas", "ARQ-13.01.01", "Cobertura de calamina galvanizada e=0.30 mm sobre tijerales", "m²", r(["MO-CAR", 0.35], ["MO-PEO", 0.4], ["MAT-CALA", 1.12], ["MAT-TORNCAL", 8], ["EQ-AND", 0.06], ["EQ-HIN", 5])),
  p("arquitectura", "13 Cubiertas", "ARQ-13.02.01", "Cobertura de teja andina", "m²", r(["MO-ALB", 0.4], ["MO-PEO", 0.45], ["MAT-TEJA", 12.5], ["MAT-CEM", 0.08], ["EQ-AND", 0.07], ["EQ-HIN", 5])),

  p("arquitectura", "16 Limpieza", "ARQ-16.01.01", "Limpieza final de obra", "m²", r(["MO-PEO", 0.08], ["MO-OPE", 0.015], ["EQ-WIN", 0.01], ["EQ-HIN", 3])),
];

const EST: Partida[] = [
  p("estructuras", "03 Obras de concreto simple", "EST-03.01.01", "Solado de 4\" f'c=100 kg/cm²", "m²", r(["MO-OPE", 0.18], ["MO-PEO", 0.28], ["MAT-CEM", 0.18], ["MAT-ARE", 0.04], ["MAT-PIE", 0.05], ["MAT-AGU", 0.025], ["EQ-MEZ", 0.04], ["EQ-HIN", 5])),
  p("estructuras", "03 Obras de concreto simple", "EST-03.01.02", "Falso piso e=10 cm f'c=100 kg/cm²", "m²", r(["MO-OPE", 0.22], ["MO-PEO", 0.35], ["MAT-CEM", 0.32], ["MAT-ARE", 0.06], ["MAT-HORM", 0.08], ["MAT-AGU", 0.04], ["EQ-MEZ", 0.06], ["EQ-HIN", 5])),
  p("estructuras", "03 Obras de concreto simple", "EST-03.02.01", "Cimiento corrido f'c=100 kg/cm²", "m³", r(["MO-OPE", 1.6], ["MO-PEO", 2.4], ["MAT-CEM", 5.2], ["MAT-ARE", 0.48], ["MAT-HORM", 0.9], ["MAT-AGU", 0.22], ["EQ-MEZ", 0.35], ["EQ-HIN", 5])),
  p("estructuras", "03 Obras de concreto simple", "EST-03.02.02", "Sobrecimiento de concreto simple f'c=140 kg/cm² (sin armar)", "m³", r(["MO-OPE", 2.1], ["MO-PEO", 2.6], ["MO-ENC", 0.8], ["MAT-CEM", 6.4], ["MAT-ARE", 0.5], ["MAT-PIE", 0.85], ["MAT-AGU", 0.24], ["MAT-MAD", 12], ["EQ-MEZ", 0.4], ["EQ-HIN", 5])),
  p("estructuras", "03 Obras de concreto simple", "EST-03.03.01", "Concreto ciclópeo 30 % piedra f'c=100 kg/cm²", "m³", r(["MO-OPE", 1.4], ["MO-PEO", 2.2], ["MAT-CEM", 4.4], ["MAT-ARE", 0.4], ["MAT-HORM", 0.55], ["MAT-PIE", 0.35], ["MAT-AGU", 0.2], ["EQ-MEZ", 0.3], ["EQ-HIN", 5])),

  p("estructuras", "04 Obras de concreto armado", "EST-04.01.01", "Concreto para zapatas f'c=210 kg/cm²", "m³", r(["MO-OPE", 2.4], ["MO-PEO", 3.2], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-AGU", 0.21], ["MAT-CUR", 0.08], ["EQ-MEZ", 0.55], ["EQ-VIB", 0.35], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.02", "Concreto para columnas f'c=210 kg/cm²", "m³", r(["MO-OPE", 3.8], ["MO-PEO", 4.2], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-AGU", 0.21], ["MAT-CUR", 0.1], ["EQ-MEZ", 0.6], ["EQ-VIB", 0.5], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.03", "Concreto para vigas f'c=210 kg/cm²", "m³", r(["MO-OPE", 3.5], ["MO-PEO", 4.0], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-AGU", 0.21], ["MAT-CUR", 0.1], ["EQ-MEZ", 0.58], ["EQ-VIB", 0.45], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.04", "Concreto para losa aligerada f'c=210 kg/cm²", "m³", r(["MO-OPE", 3.2], ["MO-PEO", 3.8], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-AGU", 0.21], ["MAT-CUR", 0.12], ["EQ-MEZ", 0.55], ["EQ-VIB", 0.4], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.05", "Concreto para placas y muros f'c=210 kg/cm²", "m³", r(["MO-OPE", 3.6], ["MO-PEO", 4.1], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-AGU", 0.21], ["EQ-MEZ", 0.58], ["EQ-VIB", 0.48], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.06", "Concreto para escaleras f'c=210 kg/cm²", "m³", r(["MO-OPE", 4.2], ["MO-PEO", 4.5], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-AGU", 0.21], ["EQ-MEZ", 0.6], ["EQ-VIB", 0.4], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.07", "Concreto para losa maciza f'c=210 kg/cm²", "m³", r(["MO-OPE", 3.0], ["MO-PEO", 3.6], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-AGU", 0.21], ["MAT-CUR", 0.12], ["EQ-MEZ", 0.55], ["EQ-VIB", 0.42], ["EQ-BCO", 0.08], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.08", "Concreto para vigas de cimentación f'c=210 kg/cm²", "m³", r(["MO-OPE", 2.8], ["MO-PEO", 3.4], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-AGU", 0.21], ["EQ-MEZ", 0.52], ["EQ-VIB", 0.38], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.09", "Concreto para dados de zapata f'c=210 kg/cm²", "m³", r(["MO-OPE", 2.6], ["MO-PEO", 3.3], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-AGU", 0.21], ["EQ-MEZ", 0.5], ["EQ-VIB", 0.32], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.01.10", "Concreto para cisterna y tanques f'c=210 kg/cm²", "m³", r(["MO-OPE", 3.8], ["MO-PEO", 4.4], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-AGU", 0.21], ["MAT-MEMB", 0.4], ["EQ-MEZ", 0.58], ["EQ-VIB", 0.45], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.02.01", "Acero de refuerzo fy=4 200 kg/cm² para zapatas", "kg", r(["MO-FIE", 0.022], ["MO-PEO", 0.012], ["MAT-FY42", 1.05], ["MAT-ALAM", 0.012], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.02.02", "Acero de refuerzo fy=4 200 kg/cm² para columnas", "kg", r(["MO-FIE", 0.028], ["MO-PEO", 0.014], ["MAT-FY42", 1.05], ["MAT-ALAM", 0.015], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.02.03", "Acero de refuerzo fy=4 200 kg/cm² para vigas", "kg", r(["MO-FIE", 0.026], ["MO-PEO", 0.013], ["MAT-FY42", 1.05], ["MAT-ALAM", 0.014], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.02.04", "Acero de refuerzo fy=4 200 kg/cm² para losa aligerada", "kg", r(["MO-FIE", 0.024], ["MO-PEO", 0.012], ["MAT-FY42", 1.05], ["MAT-ALAM", 0.013], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.02.05", "Acero de refuerzo fy=4 200 kg/cm² para placas y muros", "kg", r(["MO-FIE", 0.03], ["MO-PEO", 0.015], ["MAT-FY42", 1.05], ["MAT-ALAM", 0.016], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.03.01", "Encofrado y desencofrado para columnas", "m²", r(["MO-ENC", 0.55], ["MO-PEO", 0.35], ["MAT-MAD", 1.8], ["MAT-FEN", 0.08], ["MAT-CLA", 0.15], ["MAT-DES", 0.03], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.03.02", "Encofrado y desencofrado para vigas", "m²", r(["MO-ENC", 0.62], ["MO-PEO", 0.4], ["MAT-MAD", 2.1], ["MAT-FEN", 0.09], ["MAT-CLA", 0.16], ["MAT-DES", 0.03], ["EQ-AND", 0.05], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.03.03", "Encofrado y desencofrado para losa aligerada", "m²", r(["MO-ENC", 0.38], ["MO-PEO", 0.28], ["MAT-MAD", 1.2], ["MAT-FEN", 0.05], ["MAT-CLA", 0.1], ["EQ-AND", 0.08], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.03.04", "Encofrado y desencofrado para losa maciza", "m²", r(["MO-ENC", 0.42], ["MO-PEO", 0.3], ["MAT-MAD", 1.4], ["MAT-FEN", 0.07], ["MAT-CLA", 0.12], ["EQ-AND", 0.08], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.04.01", "Ladrillo hueco de techo 15×30×30 para losa aligerada", "m²", r(["MO-PEO", 0.12], ["MO-OPE", 0.04], ["MAT-PAND", 11.2], ["EQ-HIN", 4])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.05.01", "Concreto para muro de concreto armado f'c=210 kg/cm²", "m³", r(["MO-OPE", 3.4], ["MO-PEO", 4.0], ["MO-FIE", 0.4], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-AGU", 0.21], ["EQ-MEZ", 0.55], ["EQ-VIB", 0.45], ["EQ-HIN", 5])),
];

const IS: Partida[] = [
  p("sanitarias", "01 Salidas de agua y desagüe", "IS-01.01.01", "Punto de agua fría PVC SAP Ø20 mm", "pnto", r(["MO-GAS", 1.2], ["MO-AYU", 0.9], ["MAT-TUBO", 6], ["MAT-CODO", 4], ["MAT-PEGV", 0.15], ["EQ-HIN", 5])),
  p("sanitarias", "01 Salidas de agua y desagüe", "IS-01.01.02", "Punto de agua caliente CPVC Ø20 mm", "pnto", r(["MO-GAS", 1.3], ["MO-AYU", 0.95], ["MAT-CPVC", 6], ["MAT-CODO", 4], ["MAT-PEGV", 0.18], ["EQ-HIN", 5])),
  p("sanitarias", "01 Salidas de agua y desagüe", "IS-01.02.01", "Punto de desagüe PVC Ø50–110 mm", "pnto", r(["MO-GAS", 1.4], ["MO-AYU", 1.0], ["MAT-UF160", 3.5], ["MAT-CODO", 3], ["MAT-PEGV", 0.12], ["EQ-HIN", 5])),
  p("sanitarias", "01 Salidas de agua y desagüe", "IS-01.02.02", "Punto de ventilación PVC Ø50 mm", "pnto", r(["MO-GAS", 0.9], ["MO-AYU", 0.7], ["MAT-TUBO", 4], ["MAT-CODO", 2], ["MAT-PEGV", 0.08], ["EQ-HIN", 5])),

  p("sanitarias", "02 Aparatos sanitarios y grifería", "IS-02.01.01", "Inodoro tanque bajo colocado", "und", r(["MO-GAS", 2.5], ["MO-AYU", 1.5], ["MAT-INOD", 1], ["MAT-SIL", 0.5], ["MAT-FLEX", 1], ["EQ-HIN", 4])),
  p("sanitarias", "02 Aparatos sanitarios y grifería", "IS-02.01.02", "Lavatorio de pedestal colocado", "und", r(["MO-GAS", 2.0], ["MO-AYU", 1.2], ["MAT-LAV", 1], ["MAT-GRIF", 1], ["MAT-SIF", 1], ["EQ-HIN", 4])),
  p("sanitarias", "02 Aparatos sanitarios y grifería", "IS-02.01.03", "Ducha cromada colocada", "und", r(["MO-GAS", 1.4], ["MO-AYU", 0.8], ["MAT-DUCH", 1], ["EQ-HIN", 4])),
  p("sanitarias", "02 Aparatos sanitarios y grifería", "IS-02.01.04", "Lavadero de cocina colocado", "und", r(["MO-GAS", 2.2], ["MO-AYU", 1.4], ["MAT-LAVC", 1], ["MAT-GRIFC", 1], ["MAT-SIF", 1], ["EQ-HIN", 4])),
  p("sanitarias", "02 Aparatos sanitarios y grifería", "IS-02.01.05", "Lavadero de ropa colocado", "und", r(["MO-GAS", 1.8], ["MO-AYU", 1.1], ["MAT-LAVR", 1], ["MAT-GRIF", 1], ["MAT-SIF", 1], ["EQ-HIN", 4])),
  p("sanitarias", "02 Aparatos sanitarios y grifería", "IS-02.02.01", "Terma eléctrica 50 L instalada", "und", r(["MO-GAS", 3], ["MO-ELE", 1.5], ["MO-AYU", 2], ["MAT-TERMO", 1], ["MAT-VALV", 1], ["MAT-FLEX", 2], ["EQ-HIN", 4])),

  p("sanitarias", "03 Redes interiores", "IS-03.01.01", "Red de agua fría PVC SAP Ø25 mm", "m", r(["MO-GAS", 0.22], ["MO-AYU", 0.18], ["MAT-PVC25", 1.05], ["MAT-CODO", 0.25], ["MAT-PEGV", 0.04], ["EQ-HIN", 5])),
  p("sanitarias", "03 Redes interiores", "IS-03.01.02", "Red de agua fría PVC SAP Ø32 mm", "m", r(["MO-GAS", 0.25], ["MO-AYU", 0.2], ["MAT-PVC32", 1.05], ["MAT-CODO", 0.22], ["MAT-PEGV", 0.045], ["EQ-HIN", 5])),
  p("sanitarias", "03 Redes interiores", "IS-03.02.01", "Red de desagüe PVC UF Ø110 mm", "m", r(["MO-GAS", 0.3], ["MO-AYU", 0.24], ["MAT-PVC110", 1.05], ["MAT-ANIL", 0.2], ["EQ-HIN", 5])),
  p("sanitarias", "03 Redes interiores", "IS-03.03.01", "Caja de registro 12\"×24\"", "und", r(["MO-GAS", 2.2], ["MO-PEO", 1.8], ["MAT-CAJ", 1], ["MAT-CEM", 0.25], ["MAT-ARE", 0.02], ["EQ-HIN", 5])),
  p("sanitarias", "03 Redes interiores", "IS-03.04.01", "Prueba hidráulica de red de agua", "m", r(["MO-GAS", 0.08], ["MO-AYU", 0.08], ["EQ-BOM", 0.04], ["EQ-HIN", 3])),

  p("sanitarias", "04 Tanques y cisternas", "IS-04.01.01", "Tanque elevado 1 100 L colocado", "und", r(["MO-GAS", 6], ["MO-PEO", 8], ["MAT-TANE", 1], ["MAT-TUBO", 8], ["MAT-VALV", 2], ["MAT-CODO", 6], ["EQ-AND", 0.5], ["EQ-HIN", 4])),
  p("sanitarias", "04 Tanques y cisternas", "IS-04.02.01", "Cisterna 2 500 L colocada", "und", r(["MO-GAS", 8], ["MO-PEO", 10], ["MAT-CIST", 1], ["MAT-PVC32", 12], ["MAT-VALV", 3], ["EQ-HIN", 4])),
  p("sanitarias", "04 Tanques y cisternas", "IS-04.03.01", "Llave de paso general y by-pass", "und", r(["MO-GAS", 2.5], ["MO-AYU", 1.5], ["MAT-GRIF", 2], ["MAT-VALV", 1], ["MAT-PVC25", 2], ["EQ-HIN", 4])),
];

const IE: Partida[] = [
  p("electricas", "01 Salidas", "IE-01.01.01", "Punto de iluminación empotrado", "pnto", r(["MO-ELE", 1.1], ["MO-AYU", 0.8], ["MAT-CAB14", 14], ["MAT-TUBO", 8], ["MAT-CAJAE", 1], ["MAT-INT", 1], ["EQ-TAL", 0.15], ["EQ-HIN", 5])),
  p("electricas", "01 Salidas", "IE-01.01.02", "Punto de tomacorriente empotrado", "pnto", r(["MO-ELE", 1.0], ["MO-AYU", 0.75], ["MAT-CAB", 14], ["MAT-TUBO", 8], ["MAT-CAJAE", 1], ["MAT-TOMA", 1], ["EQ-TAL", 0.15], ["EQ-HIN", 5])),
  p("electricas", "01 Salidas", "IE-01.01.03", "Punto de tomacorriente especial (cocina / lavadora)", "pnto", r(["MO-ELE", 1.3], ["MO-AYU", 0.9], ["MAT-CAB10", 16], ["MAT-TUBO25", 10], ["MAT-CAJAE", 1], ["MAT-TOMA", 1], ["EQ-HIN", 5])),
  p("electricas", "01 Salidas", "IE-01.02.01", "Salida para terma / calentador", "pnto", r(["MO-ELE", 1.4], ["MO-AYU", 1.0], ["MAT-CAB10", 12], ["MAT-TUBO25", 8], ["MAT-TOMA", 1], ["EQ-HIN", 5])),
  p("electricas", "01 Salidas", "IE-01.03.01", "Punto de timbre", "pnto", r(["MO-ELE", 0.8], ["MO-AYU", 0.6], ["MAT-CAB14", 10], ["MAT-TUBO", 6], ["MAT-CAJAE", 1], ["EQ-HIN", 5])),

  p("electricas", "02 Tableros y protecciones", "IE-02.01.01", "Tablero de distribución 12 polos (empotrado) c/termomagnéticos y diferencial", "und", r(["MO-TEC", 5], ["MO-AYU", 3], ["MAT-TAB", 1], ["MAT-TERM", 8], ["MAT-DIF", 1], ["MAT-BREAK", 1], ["MAT-CAB8", 8], ["EQ-HIN", 4])),
  p("electricas", "02 Tableros y protecciones", "IE-02.01.02", "Tablero de departamento 8 polos", "und", r(["MO-ELE", 4], ["MO-AYU", 2], ["MAT-TAB", 1], ["MAT-TERM", 6], ["MAT-DIF", 1], ["MAT-CAB", 6], ["EQ-HIN", 4])),
  p("electricas", "02 Tableros y protecciones", "IE-02.02.01", "Medidor eléctrico monofásico (caja + acometida de medidor)", "und", r(["MO-TEC", 3], ["MO-AYU", 2], ["MAT-MED", 1], ["MAT-CAB8", 6], ["EQ-HIN", 4])),

  p("electricas", "03 Puesta a tierra", "IE-03.01.01", "Pozo a tierra 2.40 m con varilla copperweld Ø5/8\" + sal industrial", "und", r(["MO-ELE", 4], ["MO-PEO", 6], ["MAT-PAT", 1], ["MAT-SALT", 40], ["MAT-CEM", 0.4], ["MAT-CAB8", 8], ["EQ-HIN", 4])),

  p("electricas", "04 Alimentador de acometida (calle → tablero general)", "IE-04.01.01", "Alimentador de acometida calle → tablero general — cable NYY / TWU 4×10 mm² 0.6/1 kV", "m", r(["MO-TEC", 0.18], ["MO-AYU", 0.14], ["MAT-CABLE4", 1.05], ["MAT-TUBO25", 1.05], ["EQ-HIN", 4])),

  p("electricas", "07 Artefactos", "IE-05.01.01", "Luminaria LED empotrada 18 W (driver incluido)", "und", r(["MO-ELE", 0.45], ["MO-AYU", 0.3], ["MAT-LUM", 1], ["EQ-HIN", 3])),
  p("electricas", "07 Artefactos", "IE-05.01.02", "Foco LED 12 W E27 colocado", "und", r(["MO-ELE", 0.2], ["MO-AYU", 0.12], ["MAT-FOC", 1], ["EQ-HIN", 3])),
];

const COM: Partida[] = [
  p("comunicaciones", "01 Salidas de señal", "COM-01.01.01", "Punto de TV (coaxial RG-6)", "pnto", r(["MO-TEL", 0.9], ["MO-AYU", 0.7], ["MAT-COAX", 16], ["MAT-TUBO", 8], ["MAT-KITTV", 1], ["MAT-CAJAE", 1], ["EQ-HIN", 5])),
  p("comunicaciones", "01 Salidas de señal", "COM-01.01.02", "Punto de teléfono", "pnto", r(["MO-TEL", 0.85], ["MO-AYU", 0.65], ["MAT-UTP", 14], ["MAT-TUBO", 8], ["MAT-RJ45", 1], ["MAT-CAJAE", 1], ["EQ-HIN", 5])),
  p("comunicaciones", "01 Salidas de señal", "COM-01.01.03", "Punto de data / red Cat 6", "pnto", r(["MO-TEL", 1.0], ["MO-AYU", 0.75], ["MAT-UTP", 18], ["MAT-TUBO", 8], ["MAT-RJ45", 1], ["MAT-CAJAE", 1], ["EQ-HIN", 5])),

  p("comunicaciones", "02 Portería e intercomunicación", "COM-02.01.01", "Intercomunicador por departamento", "und", r(["MO-TEL", 3.5], ["MO-AYU", 2], ["MAT-INTER", 1], ["MAT-UTP", 20], ["EQ-HIN", 4])),
  p("comunicaciones", "02 Portería e intercomunicación", "COM-02.02.01", "Portería electrónica con cámara", "und", r(["MO-TEL", 6], ["MO-AYU", 4], ["MAT-INTER", 1], ["MAT-CAM", 1], ["MAT-UTP", 30], ["EQ-HIN", 4])),

  p("comunicaciones", "03 Cuarto de comunicaciones", "COM-03.01.01", "Rack 12 U + switch 8 puertos", "und", r(["MO-TEL", 5], ["MO-AYU", 3], ["MAT-RACK", 1], ["MAT-SWITCH", 1], ["MAT-UTP", 12], ["EQ-HIN", 4])),
];

const IM: Partida[] = [
  p("mecanicas", "01 Sistema de bombeo", "IM-01.01.01", "Bomba centrífuga 0.75 HP instalada", "und", r(["MO-MEC", 6], ["MO-GAS", 3], ["MO-AYU", 4], ["MAT-BOMBA", 1], ["MAT-VALV", 2], ["MAT-PVC32", 6], ["EQ-HIN", 4])),
  p("mecanicas", "01 Sistema de bombeo", "IM-01.02.01", "Tablero de control de bombas", "und", r(["MO-TEC", 4], ["MO-MEC", 2], ["MAT-TAB", 1], ["MAT-TERM", 2], ["MAT-CAB10", 8], ["EQ-HIN", 4])),

  p("mecanicas", "02 Sistema contra incendio", "IM-02.01.01", "Red contra incendio acero negro Ø2\"", "m", r(["MO-MEC", 0.45], ["MO-SOLD", 0.35], ["MO-AYU", 0.3], ["MAT-TUBER", 1.05], ["EQ-SOL", 0.2], ["EQ-HIN", 5])),
  p("mecanicas", "02 Sistema contra incendio", "IM-02.02.01", "Gabinete contra incendio 45 mm c/manguera", "und", r(["MO-MEC", 4], ["MO-AYU", 3], ["MAT-HID", 1], ["MAT-MANG", 1], ["EQ-HIN", 4])),
  p("mecanicas", "02 Sistema contra incendio", "IM-02.03.01", "Extintor PQS 6 kg colocado", "und", r(["MO-OPE", 0.4], ["MO-AYU", 0.3], ["MAT-EXT", 1], ["EQ-HIN", 3])),
  p("mecanicas", "02 Sistema contra incendio", "IM-02.04.01", "Bomba contra incendio 5 HP", "und", r(["MO-MEC", 12], ["MO-TEC", 6], ["MO-AYU", 8], ["MAT-BOMINC", 1], ["MAT-VALV", 4], ["MAT-TUBER", 8], ["EQ-HIN", 4])),

  p("mecanicas", "03 Ventilación", "IM-03.01.01", "Extractor de aire Ø150 mm", "und", r(["MO-MEC", 2.5], ["MO-ELE", 1], ["MO-AYU", 1.5], ["MAT-EXTRACT", 1], ["MAT-CAB", 4], ["EQ-HIN", 4])),

  p("mecanicas", "04 Transporte vertical", "IM-04.01.01", "Ascensor 6 pasajeros suministro e instalación", "und", r(["MO-MEC", 80], ["MO-TEC", 40], ["MO-AYU", 60], ["MAT-ASC", 1], ["EQ-GRU", 16], ["EQ-ELEV", 24], ["EQ-HIN", 3])),
];

const PAV: Partida[] = [
  p("pavimentos", "01 Trabajos preliminares", "P-01.01.01", "Movilización y desmovilización de equipo", "glb", r(["MO-OPM", 16], ["MO-CHO", 8], ["EQ-RET", 4], ["EQ-VOL", 4], ["EQ-HIN", 2])),
  p("pavimentos", "01 Trabajos preliminares", "P-01.01.02", "Trazo y replanteo de vía", "m", r(["MO-TOPO", 0.04], ["MO-OPE", 0.06], ["MO-PEO", 0.08], ["EQ-NIV", 0.02], ["EQ-HIN", 4])),
  p("pavimentos", "01 Trabajos preliminares", "P-01.02.01", "Desbroce y limpieza de terreno", "m²", r(["MO-PEO", 0.06], ["MO-OPM", 0.02], ["EQ-RET", 0.015], ["EQ-HIN", 3])),
  p("pavimentos", "01 Trabajos preliminares", "P-01.03.01", "Cartel de identificación de obra", "und", r(["MO-CAR", 10], ["MO-PEO", 8], ["MAT-MAD", 100], ["MAT-PINL", 2], ["EQ-HIN", 4])),

  p("pavimentos", "02 Movimiento de tierras", "P-02.01.01", "Corte en material suelto hasta subrasante", "m³", r(["MO-OPM", 0.12], ["MO-PEO", 0.08], ["EQ-RET", 0.1], ["EQ-VOL", 0.16], ["EQ-HIN", 2])),
  p("pavimentos", "02 Movimiento de tierras", "P-02.01.02", "Corte en material suelto-rocoso", "m³", r(["MO-OPM", 0.18], ["MO-PEO", 0.12], ["EQ-EXC", 0.16], ["EQ-VOL", 0.2], ["EQ-HIN", 2])),
  p("pavimentos", "02 Movimiento de tierras", "P-02.02.01", "Relleno compactado para terraplén", "m³", r(["MO-OPM", 0.1], ["MO-PEO", 0.15], ["EQ-CAR", 0.08], ["EQ-ROD", 0.12], ["EQ-MOT", 0.06], ["EQ-HIN", 2])),
  p("pavimentos", "02 Movimiento de tierras", "P-02.03.01", "Conformación y compactación de subrasante", "m²", r(["MO-OPM", 0.03], ["MO-PEO", 0.04], ["EQ-MOT", 0.025], ["EQ-ROD", 0.03], ["EQ-HIN", 2])),
  p("pavimentos", "02 Movimiento de tierras", "P-02.04.01", "Eliminación de material excedente D=10 km", "m³", r(["MO-CHO", 0.12], ["EQ-VOL", 0.28], ["EQ-HIN", 2])),

  p("pavimentos", "03 Subbase y base", "P-03.01.01", "Subbase granular e=20 cm compactada", "m²", r(["MO-OPM", 0.04], ["MO-PEO", 0.06], ["MAT-SUBB", 0.24], ["EQ-MOT", 0.02], ["EQ-ROD", 0.035], ["EQ-VOL", 0.03], ["EQ-HIN", 3])),
  p("pavimentos", "03 Subbase y base", "P-03.01.02", "Subbase granular e=25 cm compactada", "m²", r(["MO-OPM", 0.045], ["MO-PEO", 0.07], ["MAT-SUBB", 0.3], ["EQ-MOT", 0.022], ["EQ-ROD", 0.04], ["EQ-VOL", 0.035], ["EQ-HIN", 3])),
  p("pavimentos", "03 Subbase y base", "P-03.02.01", "Base granular e=15 cm compactada", "m²", r(["MO-OPM", 0.05], ["MO-PEO", 0.07], ["MAT-BASE", 0.19], ["EQ-MOT", 0.025], ["EQ-ROD", 0.04], ["EQ-VOL", 0.03], ["EQ-HIN", 3])),
  p("pavimentos", "03 Subbase y base", "P-03.02.02", "Base granular e=20 cm compactada", "m²", r(["MO-OPM", 0.055], ["MO-PEO", 0.08], ["MAT-BASE", 0.25], ["EQ-MOT", 0.028], ["EQ-ROD", 0.045], ["EQ-VOL", 0.035], ["EQ-HIN", 3])),
  p("pavimentos", "03 Subbase y base", "P-03.03.01", "Geotextil de separación en subrasante", "m²", r(["MO-OPE", 0.04], ["MO-PEO", 0.08], ["MAT-GEO", 1.12], ["EQ-HIN", 3])),
  p("pavimentos", "03 Subbase y base", "P-03.04.01", "Base granular estabilizada con cemento", "m²", r(["MO-OPM", 0.06], ["MO-PEO", 0.09], ["MAT-BASE", 0.22], ["MAT-CEM", 0.35], ["EQ-MOT", 0.03], ["EQ-ROD", 0.045], ["EQ-HIN", 3])),

  p("pavimentos", "04 Pavimento flexible", "P-04.01.01", "Imprimación asfáltica 1.2 L/m²", "m²", r(["MO-OPE", 0.03], ["MO-PEO", 0.04], ["MAT-BIT", 0.32], ["EQ-HIN", 3])),
  p("pavimentos", "04 Pavimento flexible", "P-04.01.02", "Riego de liga 0.5 L/m²", "m²", r(["MO-OPE", 0.02], ["MO-PEO", 0.03], ["MAT-EMUL", 0.14], ["EQ-HIN", 3])),
  p("pavimentos", "04 Pavimento flexible", "P-04.02.01", "Carpeta asfáltica e=5 cm en caliente", "m²", r(["MO-OPM", 0.06], ["MO-OPE", 0.08], ["MO-PEO", 0.1], ["MAT-CAMP", 0.115], ["EQ-FIN", 0.025], ["EQ-ROD", 0.03], ["EQ-HIN", 3])),
  p("pavimentos", "04 Pavimento flexible", "P-04.02.02", "Carpeta asfáltica e=7.5 cm en caliente", "m²", r(["MO-OPM", 0.075], ["MO-OPE", 0.1], ["MO-PEO", 0.12], ["MAT-CAMP", 0.172], ["EQ-FIN", 0.03], ["EQ-ROD", 0.035], ["EQ-HIN", 3])),
  p("pavimentos", "04 Pavimento flexible", "P-04.03.01", "Bacheo asfáltico", "m²", r(["MO-OPE", 0.35], ["MO-PEO", 0.4], ["MAT-CAMP", 0.14], ["MAT-EMUL", 0.2], ["EQ-COM", 0.08], ["EQ-HIN", 4])),

  p("pavimentos", "05 Pavimento rígido", "P-05.01.01", "Losa de concreto f'c 280 e=20 cm", "m²", r(["MO-OPE", 0.45], ["MO-PEO", 0.55], ["MAT-CEM", 1.85], ["MAT-ARE", 0.09], ["MAT-PIE", 0.16], ["MAT-AGU", 0.04], ["MAT-MALL", 1.05], ["MAT-CUR", 0.06], ["EQ-MEZ", 0.12], ["EQ-VIB", 0.08], ["EQ-HIN", 4])),
  p("pavimentos", "05 Pavimento rígido", "P-05.01.02", "Losa de concreto f'c 280 e=25 cm", "m²", r(["MO-OPE", 0.52], ["MO-PEO", 0.62], ["MAT-CEM", 2.3], ["MAT-ARE", 0.11], ["MAT-PIE", 0.2], ["MAT-AGU", 0.05], ["MAT-MALL", 1.05], ["MAT-CUR", 0.07], ["EQ-MEZ", 0.14], ["EQ-VIB", 0.1], ["EQ-HIN", 4])),
  p("pavimentos", "05 Pavimento rígido", "P-05.02.01", "Junta aserrada y sellada", "m", r(["MO-OPE", 0.12], ["MO-PEO", 0.1], ["MAT-JUNT", 1], ["EQ-CORT", 0.08], ["EQ-HIN", 4])),
  p("pavimentos", "05 Pavimento rígido", "P-05.03.01", "Adoquinado de concreto e=8 cm sobre arena", "m²", r(["MO-OPE", 0.4], ["MO-PEO", 0.5], ["MAT-ADOQ", 1.05], ["MAT-AREC", 0.04], ["EQ-COM", 0.06], ["EQ-HIN", 4])),

  p("pavimentos", "06 Obras complementarias", "P-06.01.01", "Sardinel de concreto f'c 175", "m", r(["MO-OPE", 0.35], ["MO-PEO", 0.4], ["MAT-SARD", 1], ["MAT-CEM", 0.08], ["MAT-ARE", 0.012], ["EQ-HIN", 4])),
  p("pavimentos", "06 Obras complementarias", "P-06.02.01", "Vereda de concreto f'c 175 e=10 cm", "m²", r(["MO-OPE", 0.32], ["MO-PEO", 0.38], ["MAT-CEM", 0.72], ["MAT-ARE", 0.04], ["MAT-PIE", 0.07], ["MAT-AGU", 0.018], ["EQ-MEZ", 0.05], ["EQ-HIN", 4])),
  p("pavimentos", "06 Obras complementarias", "P-06.03.01", "Cuneta de concreto f'c 175", "m", r(["MO-OPE", 0.55], ["MO-PEO", 0.65], ["MAT-CEM", 0.45], ["MAT-ARE", 0.03], ["MAT-PIE", 0.05], ["EQ-MEZ", 0.06], ["EQ-HIN", 4])),
  p("pavimentos", "06 Obras complementarias", "P-06.04.01", "Badén de concreto f'c 210", "m", r(["MO-OPE", 0.7], ["MO-PEO", 0.8], ["MAT-CEM", 0.65], ["MAT-ARE", 0.04], ["MAT-PIE", 0.07], ["EQ-MEZ", 0.08], ["EQ-HIN", 4])),
  p("pavimentos", "06 Obras complementarias", "P-06.05.01", "Berma afirmada e=15 cm", "m²", r(["MO-OPM", 0.04], ["MO-PEO", 0.06], ["MAT-SUBB", 0.18], ["EQ-MOT", 0.02], ["EQ-ROD", 0.03], ["EQ-HIN", 3])),

  p("pavimentos", "07 Señalización", "P-07.01.01", "Pintura vial termoplástica reflectante de eje y borde (línea continua/discontinua 10–15 cm)", "m", r(["MO-OPE", 0.04], ["MO-PEO", 0.05], ["MAT-PINTV", 0.18], ["EQ-HIN", 3])),
  p("pavimentos", "07 Señalización", "P-07.02.01", "Tachas reflectivas", "und", r(["MO-OPE", 0.08], ["MO-PEO", 0.06], ["MAT-TACO", 1], ["MAT-BIT", 0.02], ["EQ-HIN", 3])),
  p("pavimentos", "07 Señalización", "P-07.03.01", "Señal vertical reglamentaria", "und", r(["MO-OPE", 1.5], ["MO-PEO", 1.2], ["MAT-PINL", 0.2], ["MAT-FY42", 8], ["MAT-CEM", 0.15], ["EQ-HIN", 4])),
];

const SAN: Partida[] = [
  p("saneamiento", "01 Trabajos preliminares", "S-01.01.01", "Trazo y replanteo de redes", "m", r(["MO-TOPO", 0.035], ["MO-OPE", 0.05], ["MO-PEO", 0.07], ["EQ-NIV", 0.015], ["EQ-HIN", 4])),
  p("saneamiento", "01 Trabajos preliminares", "S-01.02.01", "Desvío provisional de servicios", "glb", r(["MO-GAS", 8], ["MO-PEO", 12], ["MAT-PVC110", 20], ["EQ-BOM", 4], ["EQ-HIN", 4])),

  p("saneamiento", "02 Excavación y relleno", "S-02.01.01", "Excavación de zanja en material suelto", "m³", r(["MO-OPE", 0.25], ["MO-PEO", 0.85], ["EQ-WIN", 0.04], ["EQ-HIN", 5])),
  p("saneamiento", "02 Excavación y relleno", "S-02.01.02", "Excavación de zanja con maquinaria", "m³", r(["MO-OPM", 0.12], ["MO-PEO", 0.2], ["EQ-RET", 0.1], ["EQ-HIN", 3])),
  p("saneamiento", "02 Excavación y relleno", "S-02.02.01", "Cama de apoyo de arena e=10 cm", "m³", r(["MO-PEO", 0.55], ["MO-OPE", 0.12], ["MAT-AREC", 1.12], ["EQ-HIN", 4])),
  p("saneamiento", "02 Excavación y relleno", "S-02.03.01", "Relleno compactado de zanja", "m³", r(["MO-PEO", 0.5], ["MO-OPE", 0.1], ["EQ-COM", 0.22], ["EQ-HIN", 4])),
  p("saneamiento", "02 Excavación y relleno", "S-02.04.01", "Eliminación de material excedente", "m³", r(["MO-CHO", 0.08], ["EQ-VOL", 0.2], ["EQ-HIN", 2])),

  p("saneamiento", "03 Agua potable", "S-03.01.01", "Tubería PVC SAP Ø110 mm clase 7.5", "m", r(["MO-GAS", 0.28], ["MO-AYU", 0.22], ["MO-PEO", 0.18], ["MAT-PVC110", 1.05], ["MAT-ANIL", 0.2], ["MAT-PEGV", 0.04], ["EQ-HIN", 5])),
  p("saneamiento", "03 Agua potable", "S-03.01.02", "Tubería PVC SAP Ø160 mm clase 7.5", "m", r(["MO-GAS", 0.35], ["MO-AYU", 0.28], ["MO-PEO", 0.22], ["MAT-PVC160", 1.05], ["MAT-ANIL", 0.2], ["MAT-PEGV", 0.05], ["EQ-HIN", 5])),
  p("saneamiento", "03 Agua potable", "S-03.01.03", "Tubería PVC SAP Ø63 mm clase 7.5", "m", r(["MO-GAS", 0.22], ["MO-AYU", 0.18], ["MO-PEO", 0.14], ["MAT-TUBO", 1.05], ["MAT-ANIL", 0.18], ["MAT-PEGV", 0.035], ["EQ-HIN", 5])),
  p("saneamiento", "03 Agua potable", "S-03.02.01", "Válvula de control Ø110 mm c/caja", "und", r(["MO-GAS", 3.5], ["MO-AYU", 2.5], ["MAT-GRIF", 1], ["MAT-CAJ", 1], ["MAT-CEM", 0.2], ["EQ-HIN", 4])),
  p("saneamiento", "03 Agua potable", "S-03.03.01", "Prueba hidráulica de red de agua", "m", r(["MO-GAS", 0.08], ["MO-AYU", 0.08], ["EQ-BOM", 0.04], ["EQ-HIN", 3])),
  p("saneamiento", "03 Agua potable", "S-03.04.01", "Desinfección de red de agua", "m", r(["MO-GAS", 0.04], ["MO-AYU", 0.04], ["MAT-CLOR", 0.015], ["EQ-HIN", 3])),
  p("saneamiento", "03 Agua potable", "S-03.05.01", "Conexión domiciliaria de agua Ø20 mm", "und", r(["MO-GAS", 4], ["MO-AYU", 3], ["MAT-TUBO", 8], ["MAT-GRIF", 1], ["MAT-CODO", 4], ["MAT-CAJ", 1], ["EQ-HIN", 5])),
  p("saneamiento", "03 Agua potable", "S-03.06.01", "Hidrante contra incendio Ø75 mm", "und", r(["MO-GAS", 6], ["MO-AYU", 4], ["MO-PEO", 3], ["MAT-GRIF", 1], ["MAT-PVC110", 2], ["MAT-CEM", 0.4], ["EQ-HIN", 4])),
  p("saneamiento", "03 Agua potable", "S-03.07.01", "Medidor de agua ½\" con caja", "und", r(["MO-GAS", 2.2], ["MO-AYU", 1.6], ["MAT-GRIF", 1], ["MAT-CAJ", 1], ["MAT-TUBO", 1.5], ["EQ-HIN", 4])),

  p("saneamiento", "04 Alcantarillado", "S-04.01.01", "Tubería PVC UF Ø160 mm", "m", r(["MO-GAS", 0.32], ["MO-AYU", 0.25], ["MO-PEO", 0.2], ["MAT-UF160", 1.05], ["MAT-ANIL", 0.22], ["EQ-HIN", 5])),
  p("saneamiento", "04 Alcantarillado", "S-04.01.02", "Tubería PVC UF Ø200 mm", "m", r(["MO-GAS", 0.4], ["MO-AYU", 0.32], ["MO-PEO", 0.25], ["MAT-PVC200", 1.05], ["MAT-ANIL", 0.22], ["EQ-HIN", 5])),
  p("saneamiento", "04 Alcantarillado", "S-04.02.01", "Buzón de concreto tipo I h=1.50 m", "und", r(["MO-OPE", 6], ["MO-PEO", 8], ["MO-GAS", 1.5], ["MAT-CEM", 6.5], ["MAT-ARE", 0.45], ["MAT-PIE", 0.7], ["MAT-FY42", 28], ["MAT-TAPA", 1], ["MAT-ESC", 6], ["EQ-MEZ", 0.5], ["EQ-HIN", 5])),
  p("saneamiento", "04 Alcantarillado", "S-04.02.02", "Buzón de concreto tipo II h=2.00 m", "und", r(["MO-OPE", 7.5], ["MO-PEO", 10], ["MO-GAS", 1.8], ["MAT-CEM", 8.2], ["MAT-ARE", 0.55], ["MAT-PIE", 0.9], ["MAT-FY42", 36], ["MAT-TAPA", 1], ["MAT-ESC", 8], ["EQ-MEZ", 0.6], ["EQ-HIN", 5])),
  p("saneamiento", "04 Alcantarillado", "S-04.03.01", "Caja de registro 12\"×24\"", "und", r(["MO-GAS", 2.2], ["MO-PEO", 1.8], ["MAT-CAJ", 1], ["MAT-CEM", 0.25], ["MAT-ARE", 0.02], ["EQ-HIN", 5])),
  p("saneamiento", "04 Alcantarillado", "S-04.04.01", "Conexión domiciliaria de desagüe Ø160 mm", "und", r(["MO-GAS", 5], ["MO-AYU", 4], ["MAT-UF160", 6], ["MAT-CODO", 3], ["MAT-CAJ", 1], ["EQ-HIN", 5])),
  p("saneamiento", "04 Alcantarillado", "S-04.05.01", "Prueba de hermeticidad de desagüe", "m", r(["MO-GAS", 0.06], ["MO-AYU", 0.06], ["EQ-BOM", 0.03], ["EQ-HIN", 3])),

  p("saneamiento", "05 Cámaras y tanques", "S-05.01.01", "Cámara de bombeo de concreto f'c 210", "m³", r(["MO-OPE", 3.5], ["MO-PEO", 4.2], ["MO-FIE", 1.2], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-FY42", 90], ["MAT-MAD", 8], ["EQ-MEZ", 0.55], ["EQ-VIB", 0.4], ["EQ-HIN", 5])),
  p("saneamiento", "05 Cámaras y tanques", "S-05.02.01", "Cisterna de concreto armado f'c 210", "m³", r(["MO-OPE", 3.8], ["MO-PEO", 4.5], ["MO-FIE", 1.4], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-FY42", 110], ["MAT-MEMB", 1.2], ["EQ-MEZ", 0.6], ["EQ-VIB", 0.45], ["EQ-HIN", 5])),
  p("saneamiento", "05 Cámaras y tanques", "S-05.03.01", "Tanque séptico de concreto f'c 175", "m³", r(["MO-OPE", 3.2], ["MO-PEO", 4.0], ["MO-FIE", 0.9], ["MAT-CEM", 7.2], ["MAT-ARE", 0.5], ["MAT-PIE", 0.88], ["MAT-FY42", 70], ["EQ-MEZ", 0.5], ["EQ-HIN", 5])),

  p("saneamiento", "06 Reposición de pista", "S-06.01.01", "Reposición de vereda de concreto", "m²", r(["MO-OPE", 0.35], ["MO-PEO", 0.4], ["MAT-CEM", 0.72], ["MAT-ARE", 0.04], ["MAT-PIE", 0.07], ["EQ-MEZ", 0.05], ["EQ-HIN", 4])),
  p("saneamiento", "06 Reposición de pista", "S-06.02.01", "Reposición de carpeta asfáltica e=5 cm", "m²", r(["MO-OPE", 0.28], ["MO-PEO", 0.32], ["MAT-CAMP", 0.12], ["MAT-EMUL", 0.15], ["EQ-COM", 0.06], ["EQ-HIN", 4])),
  p("saneamiento", "06 Reposición de pista", "S-06.03.01", "Reposición de sardinel de concreto", "m", r(["MO-OPE", 0.38], ["MO-PEO", 0.42], ["MAT-SARD", 1], ["MAT-CEM", 0.08], ["MAT-ARE", 0.012], ["EQ-HIN", 4])),
];

export const PARTIDAS: Partida[] = aplicarCapitulosRn([
  ...ARQ,
  ...EST,
  ...IS,
  ...IE,
  ...COM,
  ...IM,
  ...PAV,
  ...SAN,
  ...PARTIDAS_OBRAS,
  ...PARTIDAS_INSTALACIONES,
  ...PARTIDAS_AMPLIADO,
  ...PARTIDAS_BIOMEDICAS,
  ...PARTIDAS_PUENTES_SANEAMIENTO,
  ...PARTIDAS_ELECTROMECANICAS,
  ...PARTIDAS_CATALOGO_DETALLE,
  ...PARTIDAS_EQUIPAMIENTO,
  ...PARTIDAS_PUENTES,
  ...PARTIDAS_DEPORTIVAS,
  ...PARTIDAS_PISOS,
  ...PARTIDAS_RN_METRADOS,
  ...PARTIDAS_ESTRUCTURAS_ELEMENTOS,
  ...PARTIDAS_TIERRAS_EST,
]);

export const PARTIDA_BY_CODIGO: Record<string, Partida> = Object.fromEntries(PARTIDAS.map((x) => [x.codigo, x]));

export function capitulosDe(esp: EspecialidadPre) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of PARTIDAS) {
    if (item.especialidad !== esp) continue;
    if (seen.has(item.capitulo)) continue;
    seen.add(item.capitulo);
    out.push(item.capitulo);
  }
  return out.sort(compararCapitulos);
}

export function partidasAgrupadas(esp?: EspecialidadPre | "todas") {
  const list = !esp || esp === "todas" ? PARTIDAS : PARTIDAS.filter((x) => x.especialidad === esp);
  const map = new Map<string, Partida[]>();
  for (const item of list) {
    const key = `${item.especialidad}::${item.capitulo}`;
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return [...map.entries()]
    .map(([key, items]) => ({
      key,
      especialidad: items[0].especialidad,
      capitulo: items[0].capitulo,
      items: [...items].sort((a, b) => compararCodigoPartida(a.codigo, b.codigo)),
    }))
    .sort((a, b) => {
      if (a.especialidad !== b.especialidad) return a.especialidad.localeCompare(b.especialidad);
      return compararCapitulos(a.capitulo, b.capitulo);
    });
}
