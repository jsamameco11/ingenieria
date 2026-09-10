import type { DesignCriteria, HammerOptions, QualityOptions, SolverOptions } from "./types";

export const CRITERIOS: DesignCriteria[] = [
  {
    id: "pe-os100-urbano",
    name: "Perú · OS.100 urbano (perfil editable)",
    norma: "RNE OS.100 · red de distribución",
    pMinMca: 10,
    pMaxMca: 50,
    vMinMs: 0.6,
    vMaxMs: 3,
    hfMaxMkm: 10,
    dnMinMm: 75,
    dnMaxMm: 400,
  },
  {
    id: "pe-rural",
    name: "Perú · red rural (perfil editable)",
    norma: "RNE OS.100 · OS.050",
    pMinMca: 7,
    pMaxMca: 50,
    vMinMs: 0.3,
    vMaxMs: 2.5,
    hfMaxMkm: 12,
    dnMinMm: 63,
    dnMaxMm: 250,
  },
  {
    id: "incendio",
    name: "Caudal de incendio (perfil editable)",
    norma: "RNE A.130 / criterio de proyecto",
    pMinMca: 14,
    pMaxMca: 70,
    vMinMs: 0.3,
    vMaxMs: 5,
    hfMaxMkm: 15,
    dnMinMm: 100,
    dnMaxMm: 400,
  },
];

export const SOLVER_DEFAULT: SolverOptions = {
  maxIter: 80,
  tolHeadM: 1e-5,
  tolFlowM3s: 1e-8,
};

export const NU_20C = 1.004e-6;

/** Residual típico de dosificación a la salida del reservorio (OS.100). */
export const QUALITY_DEFAULT: QualityOptions = {
  sourceClMgL: 0.8,
  kbPerDay: 0.5,
  clMinMgL: 0.5,
  clMaxMgL: 5,
  ageMaxH: 48,
};

/** Tiempo de cierre de proyecto para Joukowsky / Michaud. */
export const HAMMER_DEFAULT: HammerOptions = {
  tCloseS: 3,
};
