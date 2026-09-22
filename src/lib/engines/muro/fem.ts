/**
 * Modelo de elementos finitos del muro en voladizo: fuste y zapata discretizados
 * con láminas MITC4 sobre resortes de Winkler sin tracción.
 *
 * Ejes globales:  X a lo largo del muro · Y del pie (puntera) hacia el talón ·
 * Z vertical hacia arriba, con origen en la superficie media de la zapata.
 *
 * El fuste tiene la cara frontal vertical y el talud hacia el relleno, así que
 * su superficie media es el plano Y = Ltoe + t_base/2 + ((t_top − t_base)/2)·Z/h_p.
 *
 * Solo se modela el concreto: el relleno entra como peso vertical sobre el
 * talón y como presión lateral sobre el trasdós del fuste y sobre el canto del
 * talón, que es la idealización de voladizos de la E.060 y del método de
 * Rankine con pantalla virtual.
 */

import {
  elementArea,
  localFrame,
  shellStressAt,
  surfaceLoad,
  type Vec3,
} from "../../fem/shell";
import {
  NDOF,
  elementDisp,
  prepareModel,
  solve,
  type FemModel,
  type FemShell,
  type PreparedModel,
} from "../../fem/solve";
import { woodArmer, type WoodArmer } from "../../fem/woodArmer";
import {
  presionEstatica,
  presionSismo,
  verticalTotal,
  type Perfil,
  type PerfilInput,
  type Sismo,
} from "./perfil";

export type MuroGeom = {
  /** Altura libre del fuste (m). */
  hp: number;
  /** Espesor de la zapata (m). */
  hf: number;
  /** Espesor del fuste en corona y en base (m). */
  ttop: number;
  tbase: number;
  /** Puntera y talón (m). */
  Ltoe: number;
  Lheel: number;
  /** Profundidad de desplante (m). */
  Df: number;
};

export const anchoZapata = (g: MuroGeom) => g.Ltoe + g.tbase + g.Lheel;
export const alturaTotal = (g: MuroGeom) => g.hp + g.hf;

export type FemOpciones = {
  /** Longitud del paño modelado (m). */
  Lpanel: number;
  nz: number;
  nToe: number;
  nHeel: number;
  nx: number;
  /** Condición en los bordes X del paño. */
  bordeX: "simetria" | "libre";
  /** Módulo de balasto vertical y horizontal (kN/m³). */
  ks: number;
  ksh: number;
  /** Módulo de elasticidad del concreto (kPa) y Poisson. */
  Ec: number;
  nu: number;
  sinTraccion: boolean;
};

export type Zona = "fuste" | "puntera" | "talon" | "nucleo";

export type ElemInfo = {
  idx: number;
  zona: Zona;
  t: number;
  /** Centro del elemento en globales. */
  cx: number;
  cy: number;
  cz: number;
  area: number;
  /** Ejes locales, para interpretar los signos de M. */
  ez: Vec3;
  /**
   * Tramo del fuste embebido en el canto de la zapata (de Z = 0 a Z = h_f/2).
   * Aporta la rigidez del nudo pero no recibe peso propio ni empuje: ese
   * volumen ya lo contabiliza el elemento de zapata que tiene debajo.
   */
  stub: boolean;
};

export type MuroMesh = {
  model: FemModel;
  info: ElemInfo[];
  /** Nodos en la base de la zapata (con resorte vertical). */
  nodosBase: number[];
  /** Índice de resorte vertical por nodo de la zapata. */
  resorteVert: Map<number, number>;
  yGrid: number[];
  zGrid: number[];
  xGrid: number[];
  /** Nodos: zapId[ix][iy] y fusteId[ix][iz] (iz = 0 comparte con la zapata). */
  zapId: number[][];
  fusteId: number[][];
  /** Elementos: elemZap[ix][iy] y elemFuste[ix][iz]. */
  elemZap: number[][];
  elemFuste: number[][];
  yStemBase: number;
  /** Cara de diseño de la puntera y del talón (m, en coordenada Y). */
  caraPuntera: number;
  caraTalon: number;
  /** Cota de la cara de diseño del fuste (arranque sobre la zapata). */
  caraFuste: number;
  B: number;
  H: number;
  geom: MuroGeom;
};

function linspace(a: number, b: number, n: number) {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(a + ((b - a) * i) / n);
  return out;
}

function mergeGrid(segs: { a: number; b: number; n: number }[]) {
  const pts: number[] = [];
  for (const s of segs) {
    if (s.b - s.a < 1e-9) continue;
    const g = linspace(s.a, s.b, Math.max(1, s.n));
    for (const v of g) if (!pts.some((p) => Math.abs(p - v) < 1e-9)) pts.push(v);
  }
  return pts.sort((a, b) => a - b);
}

/** Construye la malla del muro. */
export function construirMalla(g: MuroGeom, o: FemOpciones): MuroMesh {
  const B = anchoZapata(g);
  const H = alturaTotal(g);
  const yStemBase = g.Ltoe + g.tbase / 2;

  const yGrid = mergeGrid([
    { a: 0, b: g.Ltoe, n: o.nToe },
    { a: g.Ltoe, b: yStemBase, n: 1 },
    { a: yStemBase, b: g.Ltoe + g.tbase, n: 1 },
    { a: g.Ltoe + g.tbase, b: B, n: o.nHeel },
  ]);
  // El fuste arranca en la cara superior de la zapata (Z = h_f/2) y se
  // prolonga hasta el plano medio (Z = 0) para materializar el nudo.
  const zArranque = g.hf / 2;
  const zGrid = mergeGrid([
    { a: 0, b: zArranque, n: 1 },
    { a: zArranque, b: zArranque + g.hp, n: o.nz },
  ]);
  const xGrid = linspace(0, o.Lpanel, o.nx);
  const espesorFuste = (z: number) =>
    z <= zArranque + 1e-9
      ? g.tbase
      : g.tbase + ((g.ttop - g.tbase) * (z - zArranque)) / Math.max(g.hp, 1e-9);

  const nodes: { x: number; y: number; z: number }[] = [];
  const zapId: number[][] = []; // [ix][iy]
  for (let ix = 0; ix < xGrid.length; ix++) {
    zapId.push([]);
    for (let iy = 0; iy < yGrid.length; iy++) {
      zapId[ix].push(nodes.length);
      nodes.push({ x: xGrid[ix], y: yGrid[iy], z: 0 });
    }
  }
  const iyStem = yGrid.findIndex((v) => Math.abs(v - yStemBase) < 1e-9);

  const fusteId: number[][] = []; // [ix][iz]
  for (let ix = 0; ix < xGrid.length; ix++) {
    fusteId.push([]);
    for (let iz = 0; iz < zGrid.length; iz++) {
      if (iz === 0) {
        fusteId[ix].push(zapId[ix][iyStem]);
        continue;
      }
      const z = zGrid[iz];
      fusteId[ix].push(nodes.length);
      nodes.push({ x: xGrid[ix], y: g.Ltoe + espesorFuste(z) / 2, z });
    }
  }

  const shells: FemShell[] = [];
  const info: ElemInfo[] = [];
  const push = (n: [number, number, number, number], t: number, zona: Zona, stub = false) => {
    const idx = shells.length;
    shells.push({ nodes: n, t, E: o.Ec, nu: o.nu, zona });
    const pts = n.map((i) => nodes[i]);
    const f = localFrame(pts);
    info.push({
      idx,
      zona,
      t,
      cx: pts.reduce((a, p) => a + p.x, 0) / 4,
      cy: pts.reduce((a, p) => a + p.y, 0) / 4,
      cz: pts.reduce((a, p) => a + p.z, 0) / 4,
      area: elementArea(pts),
      ez: f.ez,
      stub,
    });
  };

  const elemZap: number[][] = [];
  for (let ix = 0; ix < xGrid.length - 1; ix++) {
    elemZap.push([]);
    for (let iy = 0; iy < yGrid.length - 1; iy++) {
      const ym = (yGrid[iy] + yGrid[iy + 1]) / 2;
      const zona: Zona =
        ym < g.Ltoe - 1e-9 ? "puntera" : ym > g.Ltoe + g.tbase + 1e-9 ? "talon" : "nucleo";
      elemZap[ix].push(shells.length);
      push(
        [zapId[ix][iy], zapId[ix + 1][iy], zapId[ix + 1][iy + 1], zapId[ix][iy + 1]],
        g.hf,
        zona,
      );
    }
  }
  const elemFuste: number[][] = [];
  for (let ix = 0; ix < xGrid.length - 1; ix++) {
    elemFuste.push([]);
    for (let iz = 0; iz < zGrid.length - 1; iz++) {
      const zm = (zGrid[iz] + zGrid[iz + 1]) / 2;
      elemFuste[ix].push(shells.length);
      push(
        [fusteId[ix][iz], fusteId[ix + 1][iz], fusteId[ix + 1][iz + 1], fusteId[ix][iz + 1]],
        espesorFuste(zm),
        "fuste",
        zm < zArranque - 1e-9,
      );
    }
  }

  // Área tributaria de cada nodo de la zapata para los resortes de suelo.
  const trib = new Map<number, number>();
  info.forEach((e) => {
    if (e.zona === "fuste") return;
    for (const n of shells[e.idx].nodes) trib.set(n, (trib.get(n) ?? 0) + e.area / 4);
  });

  const model: FemModel = { nodes, shells, springs: [], supports: [] };
  const resorteVert = new Map<number, number>();
  const nodosBase: number[] = [];
  for (const [n, a] of [...trib.entries()].sort((p, q) => p[0] - q[0])) {
    resorteVert.set(n, model.springs.length);
    model.springs.push({ node: n, dof: 2, k: o.ks * a, noTension: o.sinTraccion });
    model.springs.push({ node: n, dof: 1, k: o.ksh * a });
    model.springs.push({ node: n, dof: 0, k: o.ksh * a });
    nodosBase.push(n);
  }

  if (o.bordeX === "simetria") {
    for (const iy of yGrid.keys()) {
      for (const ix of [0, xGrid.length - 1]) {
        for (const d of [0, 4, 5]) model.supports.push({ node: zapId[ix][iy], dof: d });
      }
    }
    for (const iz of zGrid.keys()) {
      for (const ix of [0, xGrid.length - 1]) {
        for (const d of [0, 4, 5]) model.supports.push({ node: fusteId[ix][iz], dof: d });
      }
    }
  } else {
    const ixMid = Math.floor((xGrid.length - 1) / 2);
    for (const iy of yGrid.keys()) model.supports.push({ node: zapId[ixMid][iy], dof: 0 });
    for (const iz of zGrid.keys()) model.supports.push({ node: fusteId[ixMid][iz], dof: 0 });
  }

  return {
    model,
    info,
    nodosBase,
    resorteVert,
    yGrid,
    zGrid,
    xGrid,
    zapId,
    fusteId,
    elemZap,
    elemFuste,
    yStemBase,
    caraPuntera: g.Ltoe,
    caraTalon: g.Ltoe + g.tbase,
    caraFuste: zArranque,
    B,
    H,
    geom: g,
  };
}

export type CasoCarga = "CM" | "CV" | "CE" | "CS";

export type CargasInput = {
  geom: MuroGeom;
  perfilInput: PerfilInput;
  perfil: Perfil;
  sismo: Sismo;
  /** Peso específico del concreto (kN/m³). */
  gammaC: number;
  /** Peso específico del suelo delante de la puntera (kN/m³). */
  gammaFront: number;
  kh: number;
  kv: number;
  /**
   * Incluir el relleno sobre el talón en la masa inercial. Por defecto no: su
   * inercia ya está dentro de ΔPae y contarla otra vez la duplicaría.
   */
  inerciaRelleno: boolean;
  /** Incluir el 25 % de la sobrecarga en la inercia sísmica (E.030 art. 31). */
  inerciaSobrecarga: boolean;
};

/** Vectores de carga nodal por caso. */
export function construirCargas(mesh: MuroMesh, c: CargasInput) {
  const { model, info } = mesh;
  const nd = model.nodes.length * NDOF;
  const vec: Record<CasoCarga, Float64Array> = {
    CM: new Float64Array(nd),
    CV: new Float64Array(nd),
    CE: new Float64Array(nd),
    CS: new Float64Array(nd),
  };
  const g = c.geom;
  const H = mesh.H;
  /** Cota de la corona en el modelo; la profundidad vale z_corona − Z. */
  const zCorona = mesh.caraFuste + g.hp;

  const aplicar = (caso: CasoCarga, e: number, tr: (p: Vec3) => Vec3) => {
    const nodos = model.shells[e].nodes;
    const pts = nodos.map((i) => model.nodes[i]);
    const f = surfaceLoad(pts, tr);
    nodos.forEach((n, k) => {
      vec[caso][n * NDOF + 0] += f[k].x;
      vec[caso][n * NDOF + 1] += f[k].y;
      vec[caso][n * NDOF + 2] += f[k].z;
    });
  };

  // Peso específico total del relleno sobre el talón (sin sobrecarga) y su
  // subpresión en el fondo de la zapata.
  const svRelleno = verticalTotal({ ...c.perfilInput, q: 0 }, g.hp);
  const uFondo = c.perfil.uFondo;
  const pesoFrontal = Math.max(0, g.Df - g.hf) * c.gammaFront;

  info.forEach((e) => {
    const w = c.gammaC * e.t; // kN/m² de peso propio

    if (e.zona === "fuste") {
      if (!e.stub) vecAplicaFuste(e);
    } else {
      vecAplicaZapata(e);
    }

    function vecAplicaFuste(el: typeof e) {
      aplicar("CM", el.idx, () => ({ x: 0, y: 0, z: -w }));
      // Empuje lateral estático: profundidad medida desde la corona.
      aplicar("CE", el.idx, (p) => ({ x: 0, y: -presionEstatica(c.perfil, zCorona - p.z), z: 0 }));
      // Sismo: incremento dinámico + inercia del propio muro.
      aplicar("CS", el.idx, (p) => ({
        x: 0,
        y: -presionSismo(c.sismo, zCorona - p.z, H) - c.kh * w,
        z: c.kv * w,
      }));
    }

    function vecAplicaZapata(el: typeof e) {
      aplicar("CM", el.idx, () => ({ x: 0, y: 0, z: -w }));
      aplicar("CS", el.idx, () => ({ x: 0, y: -c.kh * w, z: c.kv * w }));
      // Subpresión del agua bajo la zapata.
      if (uFondo > 1e-9) aplicar("CM", el.idx, () => ({ x: 0, y: 0, z: uFondo }));

      if (el.zona === "talon") {
        aplicar("CM", el.idx, () => ({ x: 0, y: 0, z: -svRelleno }));
        aplicar("CV", el.idx, () => ({ x: 0, y: 0, z: -c.perfilInput.q }));
        const inercia = c.inerciaRelleno
          ? c.kh * (svRelleno + (c.inerciaSobrecarga ? 0.25 * c.perfilInput.q : 0))
          : 0;
        aplicar("CS", el.idx, () => ({ x: 0, y: -inercia, z: c.kv * svRelleno }));
      }
      if (el.zona === "puntera" && pesoFrontal > 1e-9) {
        aplicar("CM", el.idx, () => ({ x: 0, y: 0, z: -pesoFrontal }));
        aplicar("CS", el.idx, () => ({ x: 0, y: 0, z: c.kv * pesoFrontal }));
      }
    }
  });

  // Empuje sobre el canto vertical del talón (altura de la zapata), como carga
  // de línea repartida en los nodos del borde Y = B.
  const iyFin = mesh.yGrid.length - 1;
  const xs = mesh.xGrid;
  let Ecanto = 0;
  let Scanto = 0;
  const nSub = 24;
  for (let i = 0; i < nSub; i++) {
    const z0 = g.hp + (g.hf * i) / nSub;
    const z1 = g.hp + (g.hf * (i + 1)) / nSub;
    const zm = (z0 + z1) / 2;
    Ecanto += presionEstatica(c.perfil, zm) * (z1 - z0);
    Scanto += presionSismo(c.sismo, zm, H) * (z1 - z0);
  }
  for (let ix = 0; ix < xs.length; ix++) {
    const anchoTrib =
      (ix === 0 ? 0 : (xs[ix] - xs[ix - 1]) / 2) +
      (ix === xs.length - 1 ? 0 : (xs[ix + 1] - xs[ix]) / 2);
    const n = mesh.zapId[ix][iyFin];
    vec.CE[n * NDOF + 1] += -Ecanto * anchoTrib;
    vec.CS[n * NDOF + 1] += -Scanto * anchoTrib;
  }

  return vec;
}

/**
 * Serie de esfuerzos a lo largo de una línea de elementos, en la columna X
 * central para evitar los efectos de borde del paño.
 */
export type SerieEsfuerzo = {
  /** Coordenada del centro del elemento (Z para el fuste, Y para la zapata). */
  s: number;
  idx: number;
  myy: number;
  mxx: number;
  mxy: number;
  qy: number;
  supY: number;
  infY: number;
};

function ixCentral(mesh: MuroMesh) {
  return Math.floor((mesh.xGrid.length - 1) / 2);
}

export function serieFuste(mesh: MuroMesh, esf: EsfuerzoElem[]): SerieEsfuerzo[] {
  const ix = ixCentral(mesh);
  return mesh.elemFuste[ix].filter((idx) => !mesh.info[idx].stub).map((idx) => ({
    s: mesh.info[idx].cz,
    idx,
    myy: esf[idx].myy,
    mxx: esf[idx].mxx,
    mxy: esf[idx].mxy,
    qy: esf[idx].qy,
    supY: esf[idx].wa.supY,
    infY: esf[idx].wa.infY,
  }));
}

export function serieZapata(mesh: MuroMesh, esf: EsfuerzoElem[]): SerieEsfuerzo[] {
  const ix = ixCentral(mesh);
  return mesh.elemZap[ix].map((idx) => ({
    s: mesh.info[idx].cy,
    idx,
    myy: esf[idx].myy,
    mxx: esf[idx].mxx,
    mxy: esf[idx].mxy,
    qy: esf[idx].qy,
    supY: esf[idx].wa.supY,
    infY: esf[idx].wa.infY,
  }));
}

/**
 * Valor de una magnitud en una coordenada, extrapolando linealmente desde los
 * centros de los dos elementos más próximos. MITC4 da esfuerzos constantes
 * dentro del elemento en la dirección del tramo, así que el centro es el punto
 * con precisión de segundo orden y la recta que une dos centros recupera el
 * valor en la cara del apoyo.
 */
export function valorEn(serie: SerieEsfuerzo[], s: number, key: keyof SerieEsfuerzo): number {
  if (!serie.length) return 0;
  if (serie.length === 1) return serie[0][key] as number;
  const orden = [...serie].sort((a, b) => Math.abs(a.s - s) - Math.abs(b.s - s));
  const a = orden[0];
  const b = orden.find((p) => Math.abs(p.s - a.s) > 1e-9) ?? orden[1];
  const va = a[key] as number;
  const vb = b[key] as number;
  if (Math.abs(b.s - a.s) < 1e-9) return va;
  return va + ((vb - va) * (s - a.s)) / (b.s - a.s);
}

export type Combinacion = {
  nombre: string;
  tipo: "ULS" | "SLS";
  factores: Partial<Record<CasoCarga, number>>;
  referencia: string;
};

/** Combinaciones de la E.060 §9.2 con empuje de tierras y sismo. */
export const COMBINACIONES: Combinacion[] = [
  { nombre: "1.4CM + 1.7CV", tipo: "ULS", factores: { CM: 1.4, CV: 1.7 }, referencia: "E.060 (9-1)" },
  { nombre: "1.4CM + 1.7CV + 1.7CE", tipo: "ULS", factores: { CM: 1.4, CV: 1.7, CE: 1.7 }, referencia: "E.060 9.2.4" },
  { nombre: "0.9CM + 1.7CE", tipo: "ULS", factores: { CM: 0.9, CE: 1.7 }, referencia: "E.060 9.2.4 · CM que reduce" },
  { nombre: "1.25(CM+CV) + 1.25CE + 1.0CS", tipo: "ULS", factores: { CM: 1.25, CV: 1.25, CE: 1.25, CS: 1.0 }, referencia: "E.060 (9-5) con CE" },
  { nombre: "0.9CM + 1.25CE + 1.0CS", tipo: "ULS", factores: { CM: 0.9, CE: 1.25, CS: 1.0 }, referencia: "E.060 (9-6) con CE" },
  { nombre: "CM + CV + CE (servicio)", tipo: "SLS", factores: { CM: 1, CV: 1, CE: 1 }, referencia: "E.050 §39.13 · estabilidad" },
];

export type EsfuerzoElem = {
  mxx: number;
  myy: number;
  mxy: number;
  qx: number;
  qy: number;
  wa: WoodArmer;
};

export type ResultadoCombo = {
  combo: Combinacion;
  esfuerzos: EsfuerzoElem[];
  /** Presión de contacto por nodo de la base (kPa, positiva a compresión). */
  presion: Map<number, number>;
  presionMax: number;
  despegue: number;
  iteraciones: number;
  ok: boolean;
  desplMax: number;
  /**
   * Deformada de la franja central de la malla: corrimiento horizontal del
   * fuste frente a la cota y asiento de la zapata frente a la abscisa (m).
   */
  deformada: { fuste: { s: number; d: number }[]; zapata: { s: number; d: number }[] };
};

export type Envolvente = {
  /** Máximos de Wood & Armer por elemento (kN·m/m) y cortante (kN/m). */
  supX: number[];
  supY: number[];
  infX: number[];
  infY: number[];
  q: number[];
  /** Combinación que gobierna cada máximo (índice en `combos`). */
  govSupY: number[];
  govInfY: number[];
};

export type MuroFemResultado = {
  mesh: MuroMesh;
  combos: ResultadoCombo[];
  envolvente: Envolvente;
  nElem: number;
  nNodos: number;
  nEcuaciones: number;
  ok: boolean;
  advertencias: string[];
};

/** Resuelve todas las combinaciones y arma la envolvente de diseño. */
export function resolverMuroFem(
  mesh: MuroMesh,
  cargas: Record<CasoCarga, Float64Array>,
  opciones: FemOpciones,
): MuroFemResultado {
  const prep: PreparedModel = prepareModel(mesh.model);
  const nE = mesh.info.length;
  const advertencias: string[] = [];
  const combos: ResultadoCombo[] = [];
  let ok = true;

  for (const combo of COMBINACIONES) {
    const f = new Float64Array(mesh.model.nodes.length * NDOF);
    for (const [caso, factor] of Object.entries(combo.factores)) {
      const src = cargas[caso as CasoCarga];
      for (let i = 0; i < f.length; i++) f[i] += (factor as number) * src[i];
    }
    const r = solve(prep, f);
    if (!r.ok) {
      ok = false;
      advertencias.push(`La combinación "${combo.nombre}" no pudo resolverse.`);
    }

    const esfuerzos: EsfuerzoElem[] = mesh.info.map((e) => {
      const sh = mesh.model.shells[e.idx];
      const pts = sh.nodes.map((i) => mesh.model.nodes[i]);
      const st = shellStressAt(pts, { E: sh.E, nu: sh.nu, t: sh.t }, elementDisp(r.u, sh.nodes), 0, 0);
      return { ...st, wa: woodArmer(st) };
    });

    // Presión de contacto a partir de la reacción de los resortes verticales.
    const presion = new Map<number, number>();
    let presionMax = 0;
    let despegue = 0;
    for (const n of mesh.nodosBase) {
      const idx = mesh.resorteVert.get(n)!;
      const k = mesh.model.springs[idx].k;
      const area = opciones.ks > 1e-9 ? k / opciones.ks : 0;
      const p = area > 1e-9 ? r.springForce[idx] / area : 0;
      presion.set(n, p);
      presionMax = Math.max(presionMax, p);
      if (!r.springActive[idx]) despegue++;
    }
    let desplMax = 0;
    for (let i = 0; i < mesh.model.nodes.length; i++) {
      desplMax = Math.max(desplMax, Math.hypot(r.u[i * NDOF], r.u[i * NDOF + 1], r.u[i * NDOF + 2]));
    }

    /*
     * Deformada de la franja central: en el fuste interesa el corrimiento
     * horizontal (eje Y, el que se compara con h_p/150) y en la zapata el
     * asiento (eje Z, el que explica el reparto de presiones del balasto).
     */
    const ixc = ixCentral(mesh);
    const deformada = {
      fuste: mesh.fusteId[ixc].map((n, iz) => ({ s: mesh.zGrid[iz], d: r.u[n * NDOF + 1] })),
      zapata: mesh.zapId[ixc].map((n, iy) => ({ s: mesh.yGrid[iy], d: r.u[n * NDOF + 2] })),
    };

    combos.push({
      combo,
      esfuerzos,
      presion,
      presionMax,
      despegue,
      iteraciones: r.iteraciones,
      ok: r.ok,
      desplMax,
      deformada,
    });
  }

  const uls = combos.filter((c) => c.combo.tipo === "ULS");
  const env: Envolvente = {
    supX: new Array(nE).fill(0),
    supY: new Array(nE).fill(0),
    infX: new Array(nE).fill(0),
    infY: new Array(nE).fill(0),
    q: new Array(nE).fill(0),
    govSupY: new Array(nE).fill(0),
    govInfY: new Array(nE).fill(0),
  };
  uls.forEach((c, ic) => {
    c.esfuerzos.forEach((s, ie) => {
      if (s.wa.supX > env.supX[ie]) env.supX[ie] = s.wa.supX;
      if (s.wa.infX > env.infX[ie]) env.infX[ie] = s.wa.infX;
      if (s.wa.supY > env.supY[ie]) {
        env.supY[ie] = s.wa.supY;
        env.govSupY[ie] = ic;
      }
      if (s.wa.infY > env.infY[ie]) {
        env.infY[ie] = s.wa.infY;
        env.govInfY[ie] = ic;
      }
      const q = Math.hypot(s.qx, s.qy);
      if (q > env.q[ie]) env.q[ie] = q;
    });
  });

  return {
    mesh,
    combos,
    envolvente: env,
    nElem: nE,
    nNodos: mesh.model.nodes.length,
    nEcuaciones: prep.sky.n,
    ok,
    advertencias,
  };
}
