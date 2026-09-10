import type { Partida } from "./types";
import { p, r } from "./partidaBuilder";

/** Desglose por elemento: concreto, acero, encofrado y curado. */
export const PARTIDAS_ESTRUCTURAS_ELEMENTOS: Partida[] = [
  p("estructuras", "04 Obras de concreto armado", "EST-04.20.01", "Curado de concreto en zapatas", "m²", r(["MO-PEO", 0.04], ["MO-OPE", 0.012], ["MAT-CUR", 0.025], ["EQ-HIN", 3])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.26.01", "Acero de refuerzo fy=4 200 kg/cm² para dados de zapata", "kg", r(["MO-FIE", 0.024], ["MO-PEO", 0.012], ["MAT-FY42", 1.05], ["MAT-ALAM", 0.013], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.26.02", "Encofrado y desencofrado para dados de zapata", "m²", r(["MO-ENC", 0.5], ["MO-PEO", 0.32], ["MAT-MAD", 1.6], ["MAT-CLA", 0.12], ["MAT-DES", 0.025], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.20.02", "Curado de concreto en dados de zapata", "m²", r(["MO-PEO", 0.04], ["MO-OPE", 0.012], ["MAT-CUR", 0.025], ["EQ-HIN", 3])),

  p("estructuras", "04 Obras de concreto armado", "EST-04.21.01", "Concreto para platea de cimentación f'c=210 kg/cm²", "m³", r(["MO-OPE", 2.6], ["MO-PEO", 3.3], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-AGU", 0.21], ["EQ-MEZ", 0.52], ["EQ-VIB", 0.4], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.21.02", "Acero de refuerzo fy=4 200 kg/cm² para platea de cimentación", "kg", r(["MO-FIE", 0.022], ["MO-PEO", 0.012], ["MAT-FY42", 1.05], ["MAT-ALAM", 0.012], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.21.03", "Encofrado de borde para platea de cimentación", "m²", r(["MO-ENC", 0.42], ["MO-PEO", 0.28], ["MAT-MAD", 1.4], ["MAT-CLA", 0.1], ["MAT-DES", 0.02], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.20.03", "Curado de concreto en platea de cimentación", "m²", r(["MO-PEO", 0.035], ["MO-OPE", 0.01], ["MAT-CUR", 0.022], ["EQ-HIN", 3])),

  p("estructuras", "04 Obras de concreto armado", "EST-04.22.01", "Concreto para vigas de conexión f'c=210 kg/cm²", "m³", r(["MO-OPE", 2.7], ["MO-PEO", 3.3], ["MAT-CEM", 8.4], ["MAT-ARE", 0.52], ["MAT-PIE", 0.92], ["MAT-AGU", 0.21], ["EQ-MEZ", 0.5], ["EQ-VIB", 0.36], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.22.02", "Acero de refuerzo fy=4 200 kg/cm² para vigas de conexión", "kg", r(["MO-FIE", 0.025], ["MO-PEO", 0.013], ["MAT-FY42", 1.05], ["MAT-ALAM", 0.014], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.22.03", "Encofrado y desencofrado para vigas de conexión", "m²", r(["MO-ENC", 0.52], ["MO-PEO", 0.34], ["MAT-MAD", 1.7], ["MAT-CLA", 0.13], ["MAT-DES", 0.025], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.20.04", "Curado de concreto en vigas de conexión", "m²", r(["MO-PEO", 0.04], ["MO-OPE", 0.012], ["MAT-CUR", 0.025], ["EQ-HIN", 3])),

  p("estructuras", "04 Obras de concreto armado", "EST-04.23.01", "Acero de refuerzo fy=4 200 kg/cm² para vigas de cimentación", "kg", r(["MO-FIE", 0.025], ["MO-PEO", 0.013], ["MAT-FY42", 1.05], ["MAT-ALAM", 0.014], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.23.02", "Encofrado y desencofrado para vigas de cimentación", "m²", r(["MO-ENC", 0.5], ["MO-PEO", 0.33], ["MAT-MAD", 1.65], ["MAT-CLA", 0.12], ["MAT-DES", 0.025], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.20.05", "Curado de concreto en vigas de cimentación", "m²", r(["MO-PEO", 0.04], ["MO-OPE", 0.012], ["MAT-CUR", 0.025], ["EQ-HIN", 3])),

  p("estructuras", "04 Obras de concreto armado", "EST-04.25.01", "Concreto para sobrecimiento armado f'c=175 kg/cm²", "m³", r(["MO-OPE", 2.4], ["MO-PEO", 2.9], ["MAT-CEM", 7.4], ["MAT-ARE", 0.5], ["MAT-PIE", 0.88], ["MAT-AGU", 0.22], ["EQ-MEZ", 0.45], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.25.02", "Acero de refuerzo fy=4 200 kg/cm² para sobrecimiento armado", "kg", r(["MO-FIE", 0.02], ["MO-PEO", 0.01], ["MAT-FY42", 1.05], ["MAT-ALAM", 0.01], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.25.03", "Encofrado y desencofrado para sobrecimiento armado", "m²", r(["MO-ENC", 0.44], ["MO-PEO", 0.28], ["MAT-MAD", 1.35], ["MAT-CLA", 0.1], ["MAT-DES", 0.02], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.20.12", "Curado de concreto en sobrecimiento armado", "m²", r(["MO-PEO", 0.04], ["MO-OPE", 0.012], ["MAT-CUR", 0.025], ["EQ-HIN", 3])),

  p("estructuras", "04 Obras de concreto armado", "EST-04.20.06", "Curado de concreto en columnas", "m²", r(["MO-PEO", 0.045], ["MO-OPE", 0.014], ["MAT-CUR", 0.03], ["EQ-HIN", 3])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.20.07", "Curado de concreto en vigas", "m²", r(["MO-PEO", 0.04], ["MO-OPE", 0.012], ["MAT-CUR", 0.028], ["EQ-HIN", 3])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.20.08", "Curado de concreto en losa aligerada", "m²", r(["MO-PEO", 0.035], ["MO-OPE", 0.01], ["MAT-CUR", 0.022], ["EQ-HIN", 3])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.20.09", "Curado de concreto en losa maciza", "m²", r(["MO-PEO", 0.035], ["MO-OPE", 0.01], ["MAT-CUR", 0.022], ["EQ-HIN", 3])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.24.01", "Acero de refuerzo fy=4 200 kg/cm² para losa maciza", "kg", r(["MO-FIE", 0.024], ["MO-PEO", 0.012], ["MAT-FY42", 1.05], ["MAT-ALAM", 0.013], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.26.04", "Encofrado y desencofrado para placas y muros", "m²", r(["MO-ENC", 0.5], ["MO-PEO", 0.34], ["MAT-MAD", 1.7], ["MAT-FEN", 0.07], ["MAT-CLA", 0.13], ["EQ-AND", 0.06], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.20.10", "Curado de concreto en placas y muros", "m²", r(["MO-PEO", 0.04], ["MO-OPE", 0.012], ["MAT-CUR", 0.026], ["EQ-HIN", 3])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.26.03", "Acero de refuerzo fy=4 200 kg/cm² para escaleras", "kg", r(["MO-FIE", 0.028], ["MO-PEO", 0.014], ["MAT-FY42", 1.05], ["MAT-ALAM", 0.015], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.20.11", "Curado de concreto en escaleras", "m²", r(["MO-PEO", 0.045], ["MO-OPE", 0.014], ["MAT-CUR", 0.03], ["EQ-HIN", 3])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.26.05", "Acero de refuerzo fy=4 200 kg/cm² para cisterna", "kg", r(["MO-FIE", 0.028], ["MO-PEO", 0.014], ["MAT-FY42", 1.05], ["MAT-ALAM", 0.015], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.26.06", "Encofrado y desencofrado para cisterna", "m²", r(["MO-ENC", 0.58], ["MO-PEO", 0.38], ["MAT-MAD", 1.9], ["MAT-FEN", 0.08], ["MAT-CLA", 0.14], ["MAT-DES", 0.03], ["EQ-HIN", 5])),
  p("estructuras", "04 Obras de concreto armado", "EST-04.20.13", "Curado de concreto en cisterna", "m²", r(["MO-PEO", 0.045], ["MO-OPE", 0.014], ["MAT-CUR", 0.03], ["EQ-HIN", 3])),
];
