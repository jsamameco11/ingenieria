import type { RdapMaterial } from "./types";

export const MATERIALES: RdapMaterial[] = [
  {
    id: "pvc",
    name: "PVC",
    cHw: 150,
    roughnessMm: 0.0015,
    manningN: 0.009,
    pnBar: 10,
    norma: "NTP ISO 4422 / ISO 1452",
    sizes: [
      { dnMm: 63, odMm: 63, thkMm: 2.0, idMm: 59.0 },
      { dnMm: 75, odMm: 75, thkMm: 2.3, idMm: 70.4 },
      { dnMm: 90, odMm: 90, thkMm: 2.8, idMm: 84.4 },
      { dnMm: 110, odMm: 110, thkMm: 3.4, idMm: 103.2 },
      { dnMm: 160, odMm: 160, thkMm: 4.9, idMm: 150.2 },
      { dnMm: 200, odMm: 200, thkMm: 6.2, idMm: 187.6 },
      { dnMm: 250, odMm: 250, thkMm: 7.7, idMm: 234.6 },
      { dnMm: 315, odMm: 315, thkMm: 9.7, idMm: 295.6 },
    ],
  },
  {
    id: "hdpe",
    name: "HDPE PE100",
    cHw: 140,
    roughnessMm: 0.007,
    manningN: 0.009,
    pnBar: 10,
    norma: "NTP ISO 4427",
    sizes: [
      { dnMm: 75, odMm: 75, thkMm: 4.5, idMm: 66.0 },
      { dnMm: 90, odMm: 90, thkMm: 5.4, idMm: 79.2 },
      { dnMm: 110, odMm: 110, thkMm: 6.6, idMm: 96.8 },
      { dnMm: 160, odMm: 160, thkMm: 9.5, idMm: 141.0 },
      { dnMm: 200, odMm: 200, thkMm: 11.9, idMm: 176.2 },
    ],
  },
  {
    id: "hd",
    name: "Hierro dúctil",
    cHw: 130,
    roughnessMm: 0.25,
    manningN: 0.012,
    pnBar: 16,
    norma: "ISO 2531 / NTP 350.064",
    sizes: [
      { dnMm: 80, odMm: 98, thkMm: 6.0, idMm: 86.0 },
      { dnMm: 100, odMm: 118, thkMm: 6.1, idMm: 105.8 },
      { dnMm: 150, odMm: 170, thkMm: 6.3, idMm: 157.4 },
      { dnMm: 200, odMm: 222, thkMm: 6.4, idMm: 209.2 },
    ],
  },
  {
    id: "acero",
    name: "Acero",
    cHw: 120,
    roughnessMm: 0.045,
    manningN: 0.012,
    pnBar: 16,
    norma: "AWWA C200 / ASTM A53",
    sizes: [
      { dnMm: 100, odMm: 114.3, thkMm: 3.6, idMm: 107.1 },
      { dnMm: 150, odMm: 168.3, thkMm: 4.0, idMm: 160.3 },
      { dnMm: 200, odMm: 219.1, thkMm: 4.5, idMm: 210.1 },
    ],
  },
  {
    id: "hf",
    name: "Hierro fundido",
    cHw: 100,
    roughnessMm: 0.26,
    manningN: 0.013,
    pnBar: 10,
    norma: "ISO 2531 (referencial)",
    sizes: [
      { dnMm: 100, odMm: 118, thkMm: 7.2, idMm: 103.6 },
      { dnMm: 150, odMm: 170, thkMm: 7.8, idMm: 154.4 },
    ],
  },
  {
    id: "prfv",
    name: "PRFV",
    cHw: 140,
    roughnessMm: 0.01,
    manningN: 0.009,
    pnBar: 10,
    norma: "AWWA C950",
    sizes: [
      { dnMm: 200, odMm: 216, thkMm: 6.0, idMm: 204.0 },
      { dnMm: 250, odMm: 270, thkMm: 6.5, idMm: 257.0 },
    ],
  },
];

export function materialDe(id: string) {
  return MATERIALES.find((m) => m.id === id) ?? MATERIALES[0];
}

export function sizeDe(materialId: string, dnMm: number) {
  const mat = materialDe(materialId);
  return mat.sizes.find((s) => s.dnMm === dnMm) ?? mat.sizes.find((s) => s.dnMm >= dnMm) ?? mat.sizes[0];
}

export function idEfectivoMm(materialId: string, dnMm: number, idOverride: number | null) {
  if (idOverride && idOverride > 0) return idOverride;
  const mat = materialDe(materialId);
  const size = mat.sizes.find((s) => s.dnMm === dnMm) ?? mat.sizes.find((s) => s.dnMm >= dnMm);
  return size?.idMm ?? dnMm;
}
