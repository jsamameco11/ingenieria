import { analizar } from "./analyze";
import { proyectoDemo, proyectoVacio, addColumnAt, addBeam, addLoad } from "./model";

export function sanityPortal() {
  const p = proyectoVacio(1, 3);
  p.stories[0].diaphragm = "flexible";
  addColumnAt(p, "N1", 0, 0, "COL30");
  addColumnAt(p, "N1", 4, 0, "COL30");
  addBeam(p, "N1", 0, 0, 4, 0, "V2550");
  const beam = p.frames.find((f) => f.kind === "beam");
  if (beam) addLoad(p, "puntual", "frame", beam.id, "CM", "GZ", { P: -1, a: 2 });
  for (const s of p.supports) {
    s.kind = "empotrado";
    Object.assign(s, { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true });
  }
  p.patterns[0].selfWeight = false;
  p.combinations = [{ id: "U", name: "CM", factors: { CM: 1 } }];
  return analizar(p);
}

export function sanityDemo() {
  return analizar(proyectoDemo());
}

export function sanityUniform() {
  const p = proyectoVacio(1, 3);
  p.stories[0].diaphragm = "flexible";
  addColumnAt(p, "N1", 0, 0, "COL30");
  addColumnAt(p, "N1", 4, 0, "COL30");
  addBeam(p, "N1", 0, 0, 4, 0, "V2550");
  const beam = p.frames.find((f) => f.kind === "beam");
  if (beam) addLoad(p, "lineal", "frame", beam.id, "CM", "GZ", { w1: -0.25 });
  for (const s of p.supports) {
    s.kind = "empotrado";
    Object.assign(s, { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true });
  }
  p.patterns[0].selfWeight = false;
  p.combinations = [{ id: "U", name: "CM", factors: { CM: 1 } }];
  return analizar(p);
}

export function sanityAxial() {
  const p = proyectoVacio(1, 3);
  p.stories[0].diaphragm = "flexible";
  addColumnAt(p, "N1", 0, 0, "COL30");
  const top = p.nodes.find((n) => n.z > 1);
  if (top) addLoad(p, "puntual", "node", top.id, "CM", "GZ", { P: -1 });
  p.patterns[0].selfWeight = false;
  p.combinations = [{ id: "U", name: "CM", factors: { CM: 1 } }];
  const ap = p.supports[0];
  if (ap) {
    ap.kind = "empotrado";
    ap.ux = ap.uy = ap.uz = ap.rx = ap.ry = ap.rz = true;
  }
  return analizar(p);
}
