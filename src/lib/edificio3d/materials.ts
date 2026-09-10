import type { FrameSection, Material, SlabSection, WallSection } from "./types";

/** E = 15000 √f'c  (kg/cm²), RNE E.060 / ACI métrico. */
export function EcFromFc(fc: number) {
  return 15000 * Math.sqrt(Math.max(fc, 1));
}

export function materialConcreto(fc: number): Material {
  return {
    id: `C${fc}`,
    name: `Concreto f'c = ${fc} kg/cm²`,
    fc,
    E: EcFromFc(fc),
    nu: 0.2,
    gamma: 2.4,
    fy: 4200,
  };
}

export const DEFAULT_FCS = [140, 175, 210, 280, 350] as const;

export function defaultMaterials(): Material[] {
  return DEFAULT_FCS.map((fc) => materialConcreto(fc));
}

export function defaultFrameSections(): FrameSection[] {
  const m = "C210";
  return [
    { id: "COL25", name: "Columna 25×25", kind: "rect", b: 0.25, h: 0.25, materialId: m },
    { id: "COL30", name: "Columna 30×30", kind: "rect", b: 0.30, h: 0.30, materialId: m },
    { id: "COL40", name: "Columna 40×40", kind: "rect", b: 0.40, h: 0.40, materialId: m },
    { id: "COL2540", name: "Columna 25×40", kind: "rect", b: 0.25, h: 0.40, materialId: m },
    { id: "V2540", name: "Viga 25×40", kind: "rect", b: 0.25, h: 0.40, materialId: m },
    { id: "V2550", name: "Viga 25×50", kind: "rect", b: 0.25, h: 0.50, materialId: m },
    { id: "V3050", name: "Viga 30×50", kind: "rect", b: 0.30, h: 0.50, materialId: m },
    { id: "ESC2015", name: "Larguero 20×15", kind: "rect", b: 0.20, h: 0.15, materialId: m },
  ];
}

export function defaultWallSections(): WallSection[] {
  return [
    { id: "M15", name: "Muro 15 cm", t: 0.15, materialId: "C210" },
    { id: "M20", name: "Muro 20 cm", t: 0.20, materialId: "C210" },
    { id: "M25", name: "Muro 25 cm", t: 0.25, materialId: "C210" },
  ];
}

export function defaultSlabSections(): SlabSection[] {
  return [
    { id: "L15-MEM", name: "Losa 15 membrane", t: 0.15, kind: "membrane", materialId: "C210" },
    { id: "L15-THIN", name: "Losa 15 shell thin", t: 0.15, kind: "shellThin", materialId: "C210" },
    { id: "L15-THICK", name: "Losa 15 shell thick", t: 0.15, kind: "shellThick", materialId: "C210" },
    { id: "L20-MEM", name: "Losa 20 membrane", t: 0.20, kind: "membrane", materialId: "C210" },
    { id: "L20-THIN", name: "Losa 20 shell thin", t: 0.20, kind: "shellThin", materialId: "C210" },
    { id: "L20-THICK", name: "Losa 20 shell thick", t: 0.20, kind: "shellThick", materialId: "C210" },
  ];
}

export function sectionProps(sec: FrameSection) {
  if (sec.kind === "circ") {
    const d = sec.b;
    const r = d / 2;
    const A = Math.PI * r * r;
    const I = (Math.PI * d ** 4) / 64;
    const J = I * 2;
    return { A, Iy: I, Iz: I, J };
  }
  const A = sec.b * sec.h;
  const Iy = (sec.b * sec.h ** 3) / 12;
  const Iz = (sec.h * sec.b ** 3) / 12;
  const J = Iy + Iz;
  return { A, Iy, Iz, J };
}

/** kg/cm² → t/m² */
export function E_tm2(E_kgcm2: number) {
  return E_kgcm2 * 10;
}
