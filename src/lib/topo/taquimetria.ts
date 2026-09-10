import { fmt, fmtFixed } from "../num";
import { paso, type MemoriaDoc } from "../memoria";

export type FilaTipo = "estacion" | "visada";
export type VerticalModo = "cenital" | "altura";
export type DiModo = "generatriz" | "estadia";
export type TopoModo = "taqui" | "libreta";

export type FilaTopo = {
  id: string;
  tipo: FilaTipo;
  est: string;
  pv: string;
  di: number;
  hzG: number;
  hzM: number;
  hzS: number;
  vzG: number;
  vzM: number;
  vzS: number;
  hi: number;
  lm: number;
  hs: number;
  hiHilo: number;
  cotaBm: number | null;
  obs: string;
};

export type TopoInput = {
  proyecto: string;
  ubicacion: string;
  fecha: string;
  instrumento: string;
  profesional: string;
  x0: number;
  y0: number;
  z0: number;
  az0: number;
  kEstadia: number;
  vertical: VerticalModo;
  diModo: DiModo;
  filas: FilaTopo[];
};

export type PuntoTopo = {
  id: string;
  est: string;
  pv: string;
  tipo: FilaTipo;
  hz: number;
  vz: number;
  alpha: number;
  di: number;
  dh: number;
  dv: number;
  hi: number;
  lm: number;
  az: number;
  x: number;
  y: number;
  z: number;
  obs: string;
  esEstacion: boolean;
};

export type TopoResult = {
  puntos: PuntoTopo[];
  estaciones: { nombre: string; x: number; y: number; z: number; hi: number }[];
  perfil: { pk: number; z: number; nombre: string }[];
  nVisadas: number;
  longRed: number;
  zMin: number;
  zMax: number;
  dz: number;
  ejemplo: PuntoTopo | null;
};

let seq = 1;
export function nid() {
  return `t${seq++}`;
}

export function dmsToDeg(g: number, m: number, s: number) {
  return (Number(g) || 0) + (Number(m) || 0) / 60 + (Number(s) || 0) / 3600;
}

export function wrap360(d: number) {
  const x = d % 360;
  return x < 0 ? x + 360 : x;
}

export function fmtDms(g: number, m: number, s: number) {
  return `${fmt(g, 0)}° ${fmt(m, 0)}′ ${fmt(s, 0)}″`;
}

export function fmtAz(d: number) {
  if (!Number.isFinite(d)) return "—";
  const w = wrap360(d);
  const g = Math.floor(w + 1e-9);
  const mf = (w - g) * 60;
  const m = Math.floor(mf + 1e-9);
  const s = (mf - m) * 60;
  return `${g}° ${m}′ ${fmt(s, 0)}″`;
}

function azNorth(dx: number, dy: number) {
  return wrap360((Math.atan2(dx, dy) * 180) / Math.PI);
}

function filaBase(partial: Partial<FilaTopo> & Pick<FilaTopo, "tipo" | "est">): FilaTopo {
  return {
    id: nid(),
    pv: "",
    di: 0,
    hzG: 0,
    hzM: 0,
    hzS: 0,
    vzG: 0,
    vzM: 0,
    vzS: 0,
    hi: 0,
    lm: 0,
    hs: 0,
    hiHilo: 0,
    cotaBm: null,
    obs: "",
    ...partial,
  };
}

export function filaEstacion(est: string, pv = "", hi = 1.4, cotaBm: number | null = null): FilaTopo {
  return filaBase({ tipo: "estacion", est, pv, hi, cotaBm });
}

export function filaVisada(est: string, pv: string, extra: Partial<FilaTopo> = {}): FilaTopo {
  return filaBase({ tipo: "visada", est, pv, ...extra });
}

export const TAQUI_DEFAULTS: TopoInput = {
  proyecto: 'Mejoramiento canal "Gochirca"',
  ubicacion: "Anexo Gochirca · Tayabamba · Pataz",
  fecha: "Octubre 2002",
  instrumento: "Teodolito Wild · wincha 30 m · mira taquimétrica",
  profesional: "Ingeniero civil",
  x0: 0,
  y0: 0,
  z0: 3150,
  az0: 0,
  kEstadia: 100,
  vertical: "cenital",
  diModo: "generatriz",
  filas: [
    filaEstacion("A", "NM", 1.5, 3150),
    filaVisada("A", "1", { di: 39, hzG: 0, hzM: 3, hzS: 0, vzG: 87, vzM: 53, vzS: 30, lm: 1.5, obs: "Eje de río" }),
    filaVisada("A", "0", { di: 20, hzG: 1, hzM: 3, hzS: 20, vzG: 92, vzM: 22, vzS: 20, lm: 1.5, obs: "Eje de río — captación" }),
    filaVisada("A", "2", { di: 12, hzG: 80, hzM: 34, hzS: 0, vzG: 100, vzM: 4, vzS: 20, lm: 1.5, obs: "Costado de río" }),
    filaVisada("A", "3", { di: 23, hzG: 140, hzM: 32, hzS: 0, vzG: 95, vzM: 39, vzS: 0, lm: 1.5, obs: "Eje de canal — cascajo" }),
    filaVisada("A", "4", { di: 40, hzG: 144, hzM: 53, hzS: 30, vzG: 95, vzM: 19, vzS: 0, lm: 1.5, obs: "Eje de canal — cascajo" }),
    filaVisada("A", "5", { di: 60, hzG: 148, hzM: 12, hzS: 0, vzG: 94, vzM: 46, vzS: 30, lm: 1.5, obs: "Eje de canal — cascajo" }),
    filaVisada("A", "6", { di: 80, hzG: 150, hzM: 26, hzS: 30, vzG: 92, vzM: 50, vzS: 30, lm: 3, obs: "Eje de canal — cascajo" }),
    filaVisada("A", "B", { di: 92, hzG: 150, hzM: 35, hzS: 0, vzG: 95, vzM: 31, vzS: 20, lm: 1.5, obs: "Estación B" }),
    filaEstacion("B", "6", 1.31),
    filaVisada("B", "7", { di: 8, hzG: 138, hzM: 32, hzS: 20, vzG: 65, vzM: 11, vzS: 40, lm: 1.31, obs: "Eje de canal — cascajo" }),
    filaVisada("B", "8", { di: 28, hzG: 151, hzM: 39, hzS: 30, vzG: 85, vzM: 1, vzS: 0, lm: 1.31, obs: "Eje canal — tierra" }),
    filaVisada("B", "C", { di: 24, hzG: 152, hzM: 25, hzS: 20, vzG: 86, vzM: 49, vzS: 0, lm: 1.31, obs: "Borde canal — tierra" }),
    filaEstacion("C", "8", 1.4),
    filaVisada("C", "D", { di: 16, hzG: 29, hzM: 19, hzS: 20, vzG: 89, vzM: 51, vzS: 20, lm: 1.4, obs: "Borde canal — tierra" }),
    filaEstacion("D", "C", 1.42),
    filaVisada("D", "9", { di: 9, hzG: 145, hzM: 36, hzS: 0, vzG: 87, vzM: 23, vzS: 40, lm: 1.42, obs: "Eje canal tierra" }),
    filaVisada("D", "E", { di: 21, hzG: 156, hzM: 51, hzS: 0, vzG: 88, vzM: 2, vzS: 40, lm: 1.42, obs: "Borde canal — tierra" }),
    filaEstacion("E", "D", 1.42),
    filaVisada("E", "10", { di: 9, hzG: 151, hzM: 38, hzS: 0, vzG: 88, vzM: 31, vzS: 20, lm: 1.42, obs: "Eje canal — tierra" }),
    filaVisada("E", "11", { di: 29, hzG: 149, hzM: 58, hzS: 40, vzG: 90, vzM: 19, vzS: 30, lm: 1.3, obs: "Eje canal — tierra" }),
    filaVisada("E", "F", { di: 34, hzG: 153, hzM: 36, hzS: 20, vzG: 89, vzM: 24, vzS: 30, lm: 1.42, obs: "Borde canal" }),
    filaEstacion("F", "E", 1.35),
    filaVisada("F", "12", { di: 14, hzG: 195, hzM: 28, hzS: 40, vzG: 93, vzM: 34, vzS: 30, lm: 1.1, obs: "Eje canal — tierra" }),
    filaVisada("F", "13", { di: 34, hzG: 204, hzM: 54, hzS: 40, vzG: 90, vzM: 52, vzS: 20, lm: 2.6, obs: "Eje canal — tierra" }),
    filaVisada("F", "G", { di: 37, hzG: 207, hzM: 18, hzS: 0, vzG: 94, vzM: 17, vzS: 0, lm: 1.7, obs: "Borde canal" }),
    filaEstacion("G", "F", 1.4),
    filaVisada("G", "14", { di: 16, hzG: 206, hzM: 1, hzS: 30, vzG: 89, vzM: 0, vzS: 0, lm: 2.9, obs: "Eje canal — tierra" }),
    filaVisada("G", "H", { di: 20, hzG: 204, hzM: 32, hzS: 0, vzG: 91, vzM: 0, vzS: 0, lm: 1.4, obs: "Borde canal" }),
  ],
};

export const LIBRETA_DEFAULTS: TopoInput = {
  proyecto: "PRISABAR — San Miguel",
  ubicacion: "San Miguel",
  fecha: "Libreta de campo",
  instrumento: "Teodolito cenital · estadía K = 100 · mira",
  profesional: "Ingeniero civil",
  x0: 0,
  y0: 0,
  z0: 2250,
  az0: 0,
  kEstadia: 100,
  vertical: "cenital",
  diModo: "generatriz",
  filas: [
    filaEstacion("E1", "", 1.39, 2250),
    filaVisada("E1", "0+000", { hs: 1.34, hiHilo: 0.66, di: 98, hzG: 0, hzM: 0, hzS: 0, vzG: 88, vzM: 50, vzS: 0, hi: 1.39, lm: 2.09 }),
    filaVisada("E1", "0+020", { hs: 2.38, hiHilo: 1.63, di: 78, hzG: 1, hzM: 40, hzS: 0, vzG: 88, vzM: 45, vzS: 0, hi: 1.39, lm: 1.89 }),
    filaVisada("E1", "0+040", { hs: 2.38, hiHilo: 1.63, di: 59, hzG: 4, hzM: 28, hzS: 0, vzG: 86, vzM: 58, vzS: 0, hi: 1.39, lm: 3.3 }),
    filaVisada("E1", "0+060", { hs: 2.38, hiHilo: 1.63, di: 37, hzG: 6, hzM: 6, hzS: 0, vzG: 87, vzM: 25, vzS: 0, hi: 1.39, lm: 1.74 }),
    filaVisada("E1", "0+075", { hs: 2.28, hiHilo: 1.72, di: 8, hzG: 83, hzM: 28, hzS: 0, vzG: 104, vzM: 59, vzS: 0, hi: 1.39, lm: 1.89 }),
    filaVisada("E1", "a", { hs: 2.26, hiHilo: 1.74, di: 17, hzG: 82, hzM: 50, hzS: 0, vzG: 111, vzM: 35, vzS: 0, hi: 1.39, lm: 2.29 }),
    filaVisada("E1", "b", { hs: 2.73, hiHilo: 1.27, di: 18, hzG: 303, hzM: 30, hzS: 0, vzG: 57, vzM: 28, vzS: 0, hi: 1.39, lm: 1.865 }),
    filaVisada("E1", "c", { hs: 2.185, hiHilo: 1.815, di: 26, hzG: 254, hzM: 2, hzS: 0, vzG: 80, vzM: 25, vzS: 0, hi: 1.39, lm: 1.83 }),
    filaVisada("E1", "d", { hs: 2.16, hiHilo: 1.83, di: 44, hzG: 230, hzM: 0, hzS: 0, vzG: 86, vzM: 30, vzS: 0, hi: 1.39, lm: 0.72 }),
    filaVisada("E1", "det", { hs: 2.19, hiHilo: 1.81, di: 70.5, hzG: 214, hzM: 45, hzS: 0, vzG: 86, vzM: 37, vzS: 0, hi: 1.39, lm: 1.9 }),
    filaVisada("E1", "E2", { hs: 2.9, hiHilo: 1.1, di: 25, hzG: 217, hzM: 50, hzS: 0, vzG: 96, vzM: 57, vzS: 0, hi: 1.39, lm: 1.88, obs: "Estación E2" }),
    filaEstacion("E2", "E1", 1.2),
    filaVisada("E2", "0+130", { di: 26.5, hzG: 148, hzM: 0, hzS: 0, vzG: 99, vzM: 20, vzS: 0, hi: 1.2, lm: 1.735 }),
    filaVisada("E2", "0+150", { di: 57, hzG: 149, hzM: 10, hzS: 0, vzG: 96, vzM: 40, vzS: 0, hi: 1.2, lm: 1.685 }),
    filaVisada("E2", "E3", { di: 125, hzG: 145, hzM: 20, hzS: 0, vzG: 95, vzM: 10, vzS: 0, hi: 1.2, lm: 0.705, obs: "Estación E3" }),
  ],
};

function pkMeters(name: string): number | null {
  const m = String(name).trim().match(/^(\d+)\+(\d+)$/);
  if (!m) return null;
  return Number(m[1]) * 1000 + Number(m[2]);
}

export function calcularTaquimetria(inp: TopoInput): TopoResult {
  const pts: PuntoTopo[] = [];
  const known = new Map<string, { x: number; y: number; z: number }>();
  let cur = "";
  let curX = inp.x0;
  let curY = inp.y0;
  let curZ = inp.z0;
  let curHi = 1.4;
  let zeroAz = inp.az0;
  let first = true;
  const estaciones: TopoResult["estaciones"] = [];

  const occupy = (nombre: string, hi: number, backsight: string, cotaBm: number | null, hzBs: number) => {
    const prev = known.get(nombre);
    if (prev) {
      curX = prev.x;
      curY = prev.y;
      curZ = prev.z;
    } else if (first) {
      curX = inp.x0;
      curY = inp.y0;
      curZ = inp.z0;
      known.set(nombre, { x: curX, y: curY, z: curZ });
    }
    if (cotaBm != null && Number.isFinite(cotaBm)) curZ = cotaBm;
    curHi = hi > 0 ? hi : curHi;
    cur = nombre;
    const bs = known.get(backsight);
    if (bs && (prev || first)) {
      zeroAz = wrap360(azNorth(bs.x - curX, bs.y - curY) - hzBs);
    } else if (first) {
      zeroAz = inp.az0;
    }
    first = false;
    const i = estaciones.findIndex((e) => e.nombre === nombre);
    const rec = { nombre, x: curX, y: curY, z: curZ, hi: curHi };
    if (i >= 0) estaciones[i] = rec;
    else estaciones.push(rec);
  };

  for (const f of inp.filas) {
    if (f.tipo === "estacion") {
      occupy(f.est.trim() || "E", f.hi, f.pv.trim(), f.cotaBm, dmsToDeg(f.hzG, f.hzM, f.hzS));
      continue;
    }
    if (!cur) occupy(f.est.trim() || "E1", f.hi || 1.4, "", first ? inp.z0 : null, 0);

    const hz = dmsToDeg(f.hzG, f.hzM, f.hzS);
    const vz = dmsToDeg(f.vzG, f.vzM, f.vzS);
    const alpha = inp.vertical === "cenital" ? 90 - vz : vz;
    const ar = (alpha * Math.PI) / 180;
    const stadia = inp.kEstadia * Math.max(0, f.hs - f.hiHilo);
    const di = inp.diModo === "estadia" && stadia > 0 ? stadia : f.di > 0 ? f.di : stadia;
    const dh = di * Math.cos(ar) ** 2;
    const dv = di * Math.sin(ar) * Math.cos(ar);
    const hiUse = f.hi > 0 ? f.hi : curHi;
    const lm = f.lm;
    const z = curZ + hiUse + dv - lm;
    const az = wrap360(zeroAz + hz);
    const arAz = (az * Math.PI) / 180;
    const x = curX + dh * Math.sin(arAz);
    const y = curY + dh * Math.cos(arAz);
    const pv = f.pv.trim() || `P${pts.length + 1}`;
    const p: PuntoTopo = {
      id: f.id,
      est: cur,
      pv,
      tipo: "visada",
      hz,
      vz,
      alpha,
      di,
      dh,
      dv,
      hi: hiUse,
      lm,
      az,
      x,
      y,
      z,
      obs: f.obs,
      esEstacion: estaciones.some((e) => e.nombre === pv),
    };
    pts.push(p);
    known.set(pv, { x, y, z });
  }

  const estNames = new Set(estaciones.map((e) => e.nombre));
  for (const p of pts) p.esEstacion = estNames.has(p.pv);

  const vis = pts.filter((p) => Number.isFinite(p.z));
  const zs = vis.map((p) => p.z);
  const zMin = zs.length ? Math.min(inp.z0, ...zs) : inp.z0;
  const zMax = zs.length ? Math.max(inp.z0, ...zs) : inp.z0;

  const perfil: TopoResult["perfil"] = [];
  const withPk = vis
    .map((p) => ({ p, pk: pkMeters(p.pv) }))
    .filter((t): t is { p: PuntoTopo; pk: number } => t.pk != null);
  if (withPk.length >= 2) {
    for (const t of withPk.sort((a, b) => a.pk - b.pk)) perfil.push({ pk: t.pk, z: t.p.z, nombre: t.p.pv });
  } else {
    const eje = vis.filter((p) => /eje/i.test(p.obs) || /^\d+$/.test(p.pv));
    const seqP = eje.length >= 2 ? eje : vis;
    let acc = 0;
    seqP.forEach((p, i) => {
      if (i > 0) acc += p.dh;
      perfil.push({ pk: acc, z: p.z, nombre: p.pv });
    });
  }

  return {
    puntos: pts,
    estaciones,
    perfil,
    nVisadas: pts.length,
    longRed: pts.reduce((s, p) => s + (Number.isFinite(p.dh) ? p.dh : 0), 0),
    zMin,
    zMax,
    dz: zMax - zMin,
    ejemplo: pts[0] ?? null,
  };
}

export function informeTopo(modo: TopoModo, inp: TopoInput, r: TopoResult): MemoriaDoc {
  const codigo = modo === "taqui" ? "TOP-01" : "TOP-02";
  const titulo =
    modo === "taqui" ? "Levantamiento taquimétrico" : "Libreta de radiación y coordenadas";
  const ej = r.ejemplo;
  const alphaTxt = inp.vertical === "cenital" ? "α = 90° − V" : "α = V";
  return {
    codigo,
    titulo,
    norma: "Taquimetría de estadía · cartera de campo",
    blocks: [
      {
        type: "cover",
        kicker: `${codigo} · Topografía · Memoria de cálculo`,
        titulo,
        subtitulo: `${r.nVisadas} visadas · ${r.estaciones.length} estaciones · ΔH = ${fmt(r.dz, 2)} m`,
        meta: [
          { k: "Proyecto", v: inp.proyecto },
          { k: "Ubicación", v: inp.ubicacion },
          { k: "Fecha del levantamiento", v: inp.fecha },
          { k: "Instrumental", v: inp.instrumento },
          { k: "Profesional responsable", v: inp.profesional },
          { k: "Ángulo vertical", v: inp.vertical === "cenital" ? "Cenital (0° en el cénit, 90° en el horizonte)" : "De altura (0° en el horizonte)" },
          { k: "Distancia generatriz", v: inp.diModo === "estadia" ? `K · (HS − HI)  con K = ${inp.kEstadia}` : "Di de wincha / estadía ya reducida a generatriz" },
        ],
      },
      { type: "h2", text: "1. Objeto y alcance" },
      {
        type: "p",
        text:
          modo === "taqui"
            ? "La presente memoria reduce la cartera taquimétrica de campo: distancias generatrices, ángulos horizontales y verticales en grados-minutos-segundos, altura de instrumento y lectura de mira. Se obtienen distancia horizontal, desnivel y cota de cada punto visado, y se transportan coordenadas locales estación a estación con el azimut de espalda."
            : "La presente memoria procesa la libreta de radiación: hilos estadimétricos, distancia generatriz, ángulos cenitales y horizontales. Reduce a distancia horizontal y desnivel por las fórmulas clásicas de estadía, calcula cotas y proyecta coordenadas X (este) Y (norte) desde el origen de la primera estación, orientando cada ocupación con la visada de espalda.",
      },
      {
        type: "list",
        items: [
          "Conversión sexagesimal a decimal y ángulo de pendiente α.",
          "Reducción taquimétrica Dh = Di cos² α y Dv = Di sen α cos α.",
          "Cota del punto visado: Zp = Zest + Hi + Dv − Lm.",
          "Azimut = azimut de cero de círculo + Hz, con transporte por espalda.",
          "X = Xest + Dh sen Az    ·    Y = Yest + Dh cos Az  (Az desde el norte, sentido horario).",
        ],
      },
      { type: "h2", text: "2. Bases de cálculo" },
      { type: "eq", text: "Hz° = g + m/60 + s/3600", num: "1" },
      { type: "eq", text: alphaTxt, num: "2" },
      { type: "eq", text: "Dh = Di · cos² α", num: "3" },
      { type: "eq", text: "Dv = Di · sen α · cos α  =  ½ Di sen 2α", num: "4" },
      { type: "eq", text: "Zp = Zest + Hi + Dv − Lm", num: "5" },
      { type: "eq", text: "X = Xest + Dh sen Az     Y = Yest + Dh cos Az", num: "6" },
      {
        type: "note",
        text: "Di es la distancia generatriz (K·s si se lee estadía). Las fórmulas con cos² α ya incorporan la reducción al horizonte; no se vuelve a multiplicar por cos α. El teodolito Wild y similares leen el vertical cenital: horizonte = 90°, cénit = 0°.",
      },
      { type: "h2", text: "3. Desarrollo — visada tipo" },
      ...(ej
        ? [
            paso(
              "3.1",
              `Ángulos de la visada ${ej.est} → ${ej.pv}`,
              "Hz° = g + m/60 + s/3600     ·     α = 90° − V",
              `Hz = ${fmtFixed(ej.hz, 4)}°     V = ${fmtFixed(ej.vz, 4)}°`,
              `α = ${fmtFixed(ej.alpha, 4)}°`,
              Math.abs(ej.alpha) > 20
                ? "Pendiente fuerte: la estadía pierde precisión; conviene wincha o EDM."
                : "Pendiente moderada, adecuada para taquimetría de estadía."
            ),
            paso(
              "3.2",
              "Reducción al horizonte",
              "Dh = Di cos² α     ·     Dv = Di sen α cos α",
              `Di = ${fmt(ej.di, 3)} m    α = ${fmtFixed(ej.alpha, 4)}°`,
              `Dh = ${fmtFixed(ej.dh, 3)} m    ·    Dv = ${fmtFixed(ej.dv, 3)} m`
            ),
            paso(
              "3.3",
              "Cota del punto visado",
              "Zp = Zest + Hi + Dv − Lm",
              `Hi = ${fmt(ej.hi, 3)} m    Lm = ${fmt(ej.lm, 3)} m    Dv = ${fmtFixed(ej.dv, 3)} m`,
              `Z(${ej.pv}) = ${fmtFixed(ej.z, 3)} m`
            ),
            paso(
              "3.4",
              "Proyección y coordenadas",
              "Az = Az₀ + Hz     ·     ΔX = Dh sen Az     ·     ΔY = Dh cos Az",
              `Az = ${fmtAz(ej.az)}     Dh = ${fmtFixed(ej.dh, 3)} m`,
              `X = ${fmtFixed(ej.x, 3)} m    ·    Y = ${fmtFixed(ej.y, 3)} m`,
              "X positivo al este, Y positivo al norte. El cero de círculo de la primera estación se toma con azimut Az₀."
            ),
          ]
        : [{ type: "p" as const, text: "Ingrese al menos una visada en la cartera." }]),
      { type: "h2", text: "4. Cartera reducida" },
      {
        type: "table",
        caption: "Reducción taquimétrica y coordenadas locales (m)",
        headers: ["Est.", "P.V.", "Di", "Hz", "α", "Dh", "Dv", "Hi", "Lm", "Z", "X", "Y"],
        rows: r.puntos.map((p) => [
          p.est,
          p.pv,
          fmt(p.di, 2),
          fmtAz(p.hz),
          `${fmt(p.alpha, 2)}°`,
          fmt(p.dh, 2),
          fmt(p.dv, 2),
          fmt(p.hi, 2),
          fmt(p.lm, 2),
          fmt(p.z, 2),
          fmt(p.x, 2),
          fmt(p.y, 2),
        ]),
      },
      { type: "h2", text: "5. Estaciones" },
      {
        type: "table",
        caption: "Coordenadas de ocupación",
        headers: ["Estación", "X (E)", "Y (N)", "Z", "Hi"],
        rows: r.estaciones.map((e) => [e.nombre, fmt(e.x, 3), fmt(e.y, 3), fmt(e.z, 3), fmt(e.hi, 2)]),
      },
      { type: "figure", part: "perfil" },
      { type: "h2", text: "6. Perfil del eje" },
      {
        type: "table",
        caption: r.perfil.some((p) => pkMeters(p.nombre) != null)
          ? "Progresivas del eje (0+000) y cotas"
          : "Perfil desarrollado con distancia horizontal acumulada",
        headers: ["Punto", "PK (m)", "Cota (m)"],
        rows: r.perfil.map((p) => [p.nombre, fmt(p.pk, 2), fmt(p.z, 2)]),
      },
      {
        type: "check",
        ok: r.nVisadas > 0 && r.puntos.every((p) => p.di > 0),
        text: `${r.nVisadas} visadas reducidas. Longitud de radiaciones Σ Dh = ${fmt(r.longRed, 2)} m.`,
      },
      {
        type: "check",
        ok: r.puntos.filter((p) => Math.abs(p.alpha) > 25).length === 0,
        text:
          r.puntos.filter((p) => Math.abs(p.alpha) > 25).length === 0
            ? "Ninguna visada supera 25° de pendiente: la estadía es aplicable."
            : `${r.puntos.filter((p) => Math.abs(p.alpha) > 25).length} visada(s) con |α| > 25°. Preferir wincha o distancia electrónica.`,
      },
      { type: "h2", text: "7. Conclusión" },
      {
        type: "p",
        text: `Se reduce la cartera del proyecto ${inp.proyecto} con ${r.estaciones.length} ocupación(es) y ${r.nVisadas} visadas. Cotas entre ${fmt(r.zMin, 2)} y ${fmt(r.zMax, 2)} m (desnivel ${fmt(r.dz, 2)} m). El plano local queda originado en (${fmt(inp.x0, 2)}; ${fmt(inp.y0, 2)}) con norte de trabajo Az₀ = ${fmtAz(inp.az0)}.`,
      },
    ],
  };
}
