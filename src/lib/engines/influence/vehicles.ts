/**
 * Trenes de ejes para líneas de influencia.
 * HL-93: AASHTO LRFD 3.6.1 (Manual de Puentes MTC 2018 adopta LRFD).
 * Pesos legales: Reglamento Nacional de Vehículos (MTC) — categorías M, N y O.
 * Distancias: tándem/trídem 1.30 m; batalla de rígido/tractor 4.00–4.50 m.
 */

export type Axle = { p: number; s: number };

export type FleetItem = {
  id: string;
  label: string;
  group: string;
  note: string;
  axles: Axle[];
  W: number;
};

const T = 1.3;

function train(id: string, label: string, group: string, note: string, pts: { p: number; gap?: number }[]): FleetItem {
  const axles: Axle[] = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) s += pts[i].gap ?? 0;
    axles.push({ p: pts[i].p, s });
  }
  const W = axles.reduce((a, x) => a + x.p, 0);
  return { id, label, group, note, axles, W };
}

/** 8-32-32 kip. */
export const HS20_AXLES: Axle[] = [
  { p: 3.63, s: 0 },
  { p: 14.51, s: 4.27 },
  { p: 14.51, s: 8.54 },
];

/** 25-25 kip a 1.20 m. */
export const TANDEM_AXLES: Axle[] = [
  { p: 11.34, s: 0 },
  { p: 11.34, s: 1.2 },
];

/** 0.64 kip/ft. */
export const W_LANE = 0.95;

export const FLEET: FleetItem[] = [
  train("hl93", "HL-93 (camión + tándem + carril)", "AASHTO LRFD", "AASHTO 3.6.1.2. Se envuelve camión+carril y tándem+carril; IM solo a ejes. En continuo, 3.6.1.3.1 (90 % de dos camiones).", []),
  train("hs20", "Camión de diseño HS-20 / HL-93", "AASHTO LRFD", "Ejes 8–32–32 kip = 3.63 + 14.51 + 14.51 t, separación 4.27 m.", [
    { p: 3.63 },
    { p: 14.51, gap: 4.27 },
    { p: 14.51, gap: 4.27 },
  ]),
  train("tandem", "Tándem de diseño HL-93", "AASHTO LRFD", "Dos ejes de 25 kip (11.34 t) a 1.20 m. AASHTO 3.6.1.2.3.", [
    { p: 11.34 },
    { p: 11.34, gap: 1.2 },
  ]),
  train("carril", "Carga de carril 0.95 t/m", "AASHTO LRFD", "9.3 N/mm = 0.95 t/m en las zonas adversas de la línea de influencia. Sin IM.", []),
  train("puntual", "Carga puntual P", "Estática", "Una carga concentrada. Recorre la viga; E = P η.", [
    { p: 10 },
  ]),
  train("m3n2", "M3 / N2 · 2 ejes (11 t)", "MTC · rígido", "RNV: eje delantero simple 7.0 t + posterior simple 4.0 t.", [
    { p: 7 },
    { p: 4, gap: 3.8 },
  ]),
  train("m3n3-2", "M3 / N3 · 2 ejes (18 t)", "MTC · rígido", "Delantero 7.0 t + posterior 11.0 t. Camión rígido C2.", [
    { p: 7 },
    { p: 11, gap: 4 },
  ]),
  train("c2", "Camión rígido C2 · 2 ejes (18 t)", "MTC · rígido", "Igual a M3/N3 de 2 ejes. Configuración C.", [
    { p: 7 },
    { p: 11, gap: 4 },
  ]),
  train("m3n3-3", "M3 / N3 · 3 ejes (25 t)", "MTC · rígido", "Delantero 7.0 t + tándem posterior 18.0 t. Camión rígido C3.", [
    { p: 7 },
    { p: 9, gap: 4 },
    { p: 9, gap: T },
  ]),
  train("c3", "Camión rígido C3 · 3 ejes (25 t)", "MTC · rígido", "Tándem posterior 1.30 m. Peso máximo 25 t.", [
    { p: 7 },
    { p: 9, gap: 4 },
    { p: 9, gap: T },
  ]),
  train("n3-4", "N3 · 4 ejes tándem–tándem (32 t)", "MTC · rígido", "Delantero tándem 14.0 t + posterior tándem 18.0 t.", [
    { p: 7 },
    { p: 7, gap: T },
    { p: 9, gap: 5 },
    { p: 9, gap: T },
  ]),
  train("n3-4alt", "N3 · 4 ejes alternativo (30 t)", "MTC · rígido", "Simple 7.0 + simple 7.0 + tándem posterior 18.0 t.", [
    { p: 7 },
    { p: 7, gap: 4 },
    { p: 9, gap: 4.5 },
    { p: 9, gap: T },
  ]),
  train("t2s1", "T2S1 · tractocamión + semirremolque (30 t)", "MTC · articulado", "T2 (18 t) + S1 simple 12 t.", [
    { p: 7 },
    { p: 11, gap: 4 },
    { p: 12, gap: 6 },
  ]),
  train("t2s2", "T2S2 · T2 + S2 tándem (36 t)", "MTC · articulado", "Tractor 18 t + semirremolque tándem 18 t.", [
    { p: 7 },
    { p: 11, gap: 4 },
    { p: 9, gap: 5.5 },
    { p: 9, gap: T },
  ]),
  train("t2s3", "T2S3 · T2 + S3 trídem (43 t)", "MTC · articulado", "Tractor 18 t + semirremolque trídem 25 t.", [
    { p: 7 },
    { p: 11, gap: 4 },
    { p: 8.33, gap: 5 },
    { p: 8.33, gap: T },
    { p: 8.34, gap: T },
  ]),
  train("t3s1", "T3S1 · T3 + S1 (37 t)", "MTC · articulado", "Tractor tándem 25 t + semirremolque simple 12 t.", [
    { p: 7 },
    { p: 9, gap: 4 },
    { p: 9, gap: T },
    { p: 12, gap: 6 },
  ]),
  train("t3s2", "T3S2 · T3 + S2 (43 t)", "MTC · articulado", "Tractor 25 t + semirremolque tándem 18 t.", [
    { p: 7 },
    { p: 9, gap: 4 },
    { p: 9, gap: T },
    { p: 9, gap: 5.5 },
    { p: 9, gap: T },
  ]),
  train("t3s3", "T3S3 · T3 + S3 (48 t)", "MTC · articulado", "Tractor 25 t + semirremolque trídem 25 t. Mayor legal articulado.", [
    { p: 7 },
    { p: 9, gap: 4 },
    { p: 9, gap: T },
    { p: 8.33, gap: 5 },
    { p: 8.33, gap: T },
    { p: 8.34, gap: T },
  ]),
  train("c2r1", "C2R1 · rígido + remolque (30 t)", "MTC · con remolque", "C2 (18 t) + R1 simple 12 t.", [
    { p: 7 },
    { p: 11, gap: 4 },
    { p: 12, gap: 5 },
  ]),
  train("c2r2", "C2R2 · C2 + R2 (36 t)", "MTC · con remolque", "Rígido 18 t + remolque dos ejes simples 18 t.", [
    { p: 7 },
    { p: 11, gap: 4 },
    { p: 9, gap: 5 },
    { p: 9, gap: 1.8 },
  ]),
  train("c2r3", "C2R3 · C2 + R3 (43 t)", "MTC · con remolque", "Rígido 18 t + remolque simple + tándem 25 t.", [
    { p: 7 },
    { p: 11, gap: 4 },
    { p: 7, gap: 5 },
    { p: 9, gap: 1.8 },
    { p: 9, gap: T },
  ]),
  train("c3r1", "C3R1 · C3 + R1 (37 t)", "MTC · con remolque", "Rígido tándem 25 t + remolque simple 12 t.", [
    { p: 7 },
    { p: 9, gap: 4 },
    { p: 9, gap: T },
    { p: 12, gap: 5 },
  ]),
  train("c3r2", "C3R2 · C3 + R2 (43 t)", "MTC · con remolque", "Rígido 25 t + remolque dos ejes simples 18 t.", [
    { p: 7 },
    { p: 9, gap: 4 },
    { p: 9, gap: T },
    { p: 9, gap: 5 },
    { p: 9, gap: 1.8 },
  ]),
  train("c3r3", "C3R3 · C3 + R3 (50 t)", "MTC · con remolque", "Rígido 25 t + remolque trídem 25 t. Verificar permiso especial MTC.", [
    { p: 7 },
    { p: 9, gap: 4 },
    { p: 9, gap: T },
    { p: 8.33, gap: 5 },
    { p: 8.33, gap: T },
    { p: 8.34, gap: T },
  ]),
  train("t2r1", "T2R1 · tractocamión + remolque (30 t)", "MTC · tractor + remolque", "T2 (18 t) + remolque simple 12 t (barra de tiro).", [
    { p: 7 },
    { p: 11, gap: 4 },
    { p: 12, gap: 7 },
  ]),
  train("t2r2", "T2R2 · T2 + remolque 2 ejes (36 t)", "MTC · tractor + remolque", "Tractor 18 t + remolque dos ejes 18 t.", [
    { p: 7 },
    { p: 11, gap: 4 },
    { p: 9, gap: 6.5 },
    { p: 9, gap: 1.8 },
  ]),
  train("t3r1", "T3R1 · T3 + remolque (37 t)", "MTC · tractor + remolque", "Tractor tándem 25 t + remolque simple 12 t.", [
    { p: 7 },
    { p: 9, gap: 4 },
    { p: 9, gap: T },
    { p: 12, gap: 7 },
  ]),
  train("t3r2", "T3R2 · T3 + remolque 2 ejes (43 t)", "MTC · tractor + remolque", "Tractor 25 t + remolque dos ejes 18 t. 5–6 ejes según tándem.", [
    { p: 7 },
    { p: 9, gap: 4 },
    { p: 9, gap: T },
    { p: 9, gap: 6.5 },
    { p: 9, gap: 1.8 },
  ]),
  train("bus2", "Bus 2 ejes (18 t)", "MTC · bus", "M3: delantero 7.0 t + posterior 11.0 t, batalla de ómnibus.", [
    { p: 7 },
    { p: 11, gap: 5.5 },
  ]),
  train("bus3", "Bus 3 ejes (25 t)", "MTC · bus", "Delantero 7.0 t + tándem 18.0 t.", [
    { p: 7 },
    { p: 9, gap: 5.5 },
    { p: 9, gap: T },
  ]),
  train("busart", "Bus articulado (29 t)", "MTC · bus", "Tres ejes simples 7 + 11 + 11 t. Fuelle entre 2º y 3º.", [
    { p: 7 },
    { p: 11, gap: 5.8 },
    { p: 11, gap: 6.2 },
  ]),
  train("multiple", "Vehículos múltiples (dos trenes T3S3)", "MTC · múltiple", "Dos T3S3 en el mismo sentido. Holgura mínima entre trenes (dato).", []),
  train("especial", "Vehículo especial (ejes de usuario)", "Especial", "Hasta 8 ejes. Pesos y separaciones de la ficha. Cargas especiales MTC / permiso.", []),
];

export function fleetById(id: string) {
  return FLEET.find((f) => f.id === id) || FLEET[0];
}

export function fleetOptions() {
  return FLEET.map((f) => ({ value: f.id, label: f.label, desc: f.group }));
}

export function specialAxles(raw: Record<string, string>): Axle[] {
  const axles: Axle[] = [];
  let s = 0;
  for (let i = 1; i <= 8; i++) {
    const p = Number(String(raw[`ejeP${i}`] ?? "").replace(",", ".")) || 0;
    if (i > 1) s += Number(String(raw[`ejeD${i}`] ?? "").replace(",", ".")) || 0;
    if (p > 0.05) axles.push({ p, s });
  }
  return axles;
}

export function multipleAxles(gap: number): Axle[] {
  const one = fleetById("t3s3").axles;
  const last = one[one.length - 1]?.s || 0;
  const off = last + Math.max(4, gap);
  return [...one, ...one.map((a) => ({ p: a.p, s: a.s + off }))];
}

export function dualAxles(axles: Axle[], gapRearToLead: number): Axle[] {
  if (!axles.length) return [];
  const last = axles[axles.length - 1]?.s || 0;
  const lead2 = last + Math.max(4, gapRearToLead);
  return [...axles, ...axles.map((a) => ({ p: a.p, s: a.s + lead2 }))];
}

export function dualHs20(gapRearToLead: number): Axle[] {
  return dualAxles(HS20_AXLES, Math.max(15, gapRearToLead));
}
