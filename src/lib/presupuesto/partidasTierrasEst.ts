import type { Partida } from "./types";
import { p, r } from "./partidaBuilder";

/** Movimiento de tierras de edificación: especialidad estructuras (RN cap. 02). */
export const PARTIDAS_TIERRAS_EST: Partida[] = [
  p("estructuras", "02 Movimiento de tierras", "EST-02.01.05", "Excavación para platea de cimentación", "m³", r(["MO-OPM", 0.18], ["MO-PEO", 0.28], ["MO-OPE", 0.08], ["EQ-RET", 0.14], ["EQ-VOL", 0.16], ["EQ-HIN", 3])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.01.06", "Excavación para cisterna y tanques", "m³", r(["MO-OPE", 0.55], ["MO-PEO", 1.4], ["MO-OPM", 0.12], ["EQ-RET", 0.1], ["EQ-WIN", 0.08], ["EQ-HIN", 5])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.01.07", "Excavación para dados de zapata", "m³", r(["MO-OPE", 0.42], ["MO-PEO", 1.15], ["EQ-WIN", 0.06], ["EQ-HIN", 5])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.01.08", "Excavación en material semirocoso", "m³", r(["MO-OPM", 0.22], ["MO-OPE", 0.18], ["MO-PEO", 0.35], ["EQ-EXC", 0.16], ["EQ-COMW", 0.08], ["EQ-VOL", 0.18], ["EQ-HIN", 3])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.01.09", "Excavación a mano en zanja confinada", "m³", r(["MO-OPE", 0.55], ["MO-PEO", 1.8], ["EQ-WIN", 0.04], ["EQ-HIN", 5])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.01.10", "Entibado y apuntalamiento de zanjas", "m²", r(["MO-OPE", 0.28], ["MO-PEO", 0.35], ["MAT-MAD", 1.4], ["MAT-CLA", 0.08], ["EQ-HIN", 4])),

  p("estructuras", "02 Movimiento de tierras", "EST-02.02.04", "Cama de apoyo y afirmado de fondo de zapata", "m²", r(["MO-PEO", 0.12], ["MO-OPE", 0.04], ["MAT-AFIRM", 0.08], ["EQ-COM", 0.03], ["EQ-HIN", 4])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.02.05", "Relleno compactado de zanjas de cimiento", "m³", r(["MO-PEO", 0.42], ["MO-OPE", 0.1], ["EQ-COM", 0.22], ["EQ-HIN", 4])),

  p("estructuras", "02 Movimiento de tierras", "EST-02.03.02", "Eliminación de material excedente D=10 km", "m³", r(["MO-OPM", 0.1], ["EQ-VOL", 0.26], ["EQ-HIN", 2])),
  p("estructuras", "02 Movimiento de tierras", "EST-02.03.03", "Carguío de material excedente", "m³", r(["MO-OPM", 0.08], ["MO-PEO", 0.12], ["EQ-RET", 0.07], ["EQ-HIN", 3])),

  p("estructuras", "02 Movimiento de tierras", "EST-02.04.02", "Conformación y compactación de plataforma", "m²", r(["MO-OPM", 0.035], ["MO-PEO", 0.05], ["MO-TOPO", 0.008], ["EQ-MOT180", 0.018], ["EQ-ROD", 0.02], ["EQ-HIN", 3])),

  p("estructuras", "02 Movimiento de tierras", "EST-02.05.02", "Protección de talud con geotextil", "m²", r(["MO-OPE", 0.08], ["MO-PEO", 0.12], ["MAT-GEO", 1.08], ["EQ-HIN", 3])),

  p("estructuras", "02 Movimiento de tierras", "EST-02.07.01", "Agotamiento de napa / bombeo de excavación", "h", r(["MO-OPE", 1], ["MO-PEO", 0.5], ["EQ-BOMSUM", 1], ["EQ-HIN", 2])),
];
