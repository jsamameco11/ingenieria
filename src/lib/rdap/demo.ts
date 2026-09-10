import { CRITERIOS } from "./criteria";
import { nodoNuevo, proyectoVacio, tuboNuevo, valvulaNueva } from "./model";
import type { RdapProject } from "./types";

/** Sector tipo I-3 / red urbana menor: reservorio + anillo + ramal. */
export function proyectoDemo(): RdapProject {
  const p = proyectoVacio();
  p.meta.proyecto = "RDAP sector El Mirador — red de distribución";
  p.meta.ubicacion = "Lima, Perú";
  p.meta.alcance = "Diseño y verificación de la red de distribución del sector El Mirador, desde el reservorio apoyado R-01 hasta la punta de red J-05, con anillo de manzanas A–C y PRV V-01 (consigna 10 m.c.a.) en la cámara J-06 que alimenta la zona baja.";
  p.meta.tipoSistema = "gravedad";
  p.meta.tipoRed = "urbano";
  p.criteria = { ...CRITERIOS[1] };
  p.fireNodeId = "J-05";
  p.fireLs = 5;
  const r = nodoNuevo("R-01", "reservoir");
  r.x = 0;
  r.y = 80;
  r.ground = 118;
  r.reservoirHgl = 117.4;
  r.description = "Reservorio apoyado · nivel de agua";
  const j1 = nodoNuevo("J-01");
  Object.assign(j1, { x: 120, y: 80, ground: 104.2, cover: 104.2, invert: 102.4, demandLs: 0.55, description: "Cámara de llegada" });
  const j2 = nodoNuevo("J-02");
  Object.assign(j2, { x: 260, y: 140, ground: 102.8, cover: 102.8, invert: 101.1, demandLs: 0.72, description: "Nudo Mz A" });
  const j3 = nodoNuevo("J-03");
  Object.assign(j3, { x: 400, y: 80, ground: 101.5, cover: 101.5, invert: 99.8, demandLs: 0.64, description: "Nudo Mz B" });
  const j4 = nodoNuevo("J-04");
  Object.assign(j4, { x: 260, y: 20, ground: 102.1, cover: 102.1, invert: 100.4, demandLs: 0.48, description: "Nudo Mz C" });
  const j5 = nodoNuevo("J-05");
  Object.assign(j5, { x: 520, y: 40, ground: 100.4, cover: 100.4, invert: 98.8, demandLs: 0.41, description: "Punta de red · zona PRV" });
  const j6 = nodoNuevo("J-06");
  Object.assign(j6, { x: 460, y: 60, ground: 100.8, cover: 100.8, invert: 99.1, demandLs: 0, description: "Cámara PRV zona baja" });
  p.nodes = [r, j1, j2, j3, j4, j5, j6];
  const pipes = [
    ["P-01", "R-01", "J-01", 160],
    ["P-02", "J-01", "J-02", 110],
    ["P-03", "J-02", "J-03", 110],
    ["P-04", "J-03", "J-04", 90],
    ["P-05", "J-04", "J-01", 110],
    ["P-06", "J-03", "J-06", 90],
  ] as const;
  p.pipes = pipes.map(([id, a, b, dn]) => {
    const t = tuboNuevo(id, a, b);
    t.dnMm = dn;
    t.materialId = "pvc";
    return t;
  });
  const prv = valvulaNueva("V-01", "J-06", "J-05");
  prv.name = "PRV zona baja";
  prv.kind = "prv";
  prv.setting = 10;
  prv.dnMm = 90;
  prv.status = "auto";
  p.valves = [prv];
  p.topoPoints = [];
  for (let x = -40; x <= 560; x += 80) {
    for (let y = -20; y <= 180; y += 50) {
      const z = 118 - 0.028 * x - 0.012 * y + 0.35 * Math.sin(x / 90) * Math.cos(y / 70);
      p.topoPoints.push({ id: `PT-${p.topoPoints.length + 1}`, x, y, z: Math.round(z * 100) / 100, desc: "TIN" });
    }
  }
  return p;
}
