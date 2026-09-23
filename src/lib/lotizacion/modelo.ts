import {
  add,
  almost,
  area,
  areaAngulosAgudos,
  bbox,
  centroid,
  clipRect,
  clipSegment,
  dist,
  distPuntoPoligono,
  dot,
  ensureCCW,
  lerp,
  longestEdgeAngle,
  mul,
  norm,
  perimeter,
  pointAlong,
  pointInPoly,
  rotate,
  selfIntersects,
  sub,
  type Rect,
  type V2,
} from "./geom";
import {
  esquinasDe,
  polilineaManzana,
  polilineaSardinel,
  redondearLote,
  retroceso,
  tramaDe,
} from "./aceras";
import {
  anchoSeccion,
  calidadAlcanza,
  calidadExigida,
  etiquetaHab,
  filaVivienda,
  maxManzana,
  partesDeSeccion,
  radioEsquina,
} from "./norma";
import type {
  Criterios,
  Estado,
  Franja,
  IngresoGraf,
  LoteM,
  Modelo,
  Polilinea,
  ProyectoLot,
  UsoLote,
  Verificacion,
  ViaCampo,
  ViaGraficaExistente,
  ViaInterna,
} from "./tipos";

type Face = "n" | "s";
type Kind = "perim" | "doble";

type Work = {
  poly: V2[];
  area: number;
  frente: number;
  profundidad: number;
  centro: V2;
  grid: { band: number; col: number; side: number; index: number; kind: Kind };
  uso: UsoLote;
};

const CAMPOS: { k: ViaCampo; nombre: string }[] = [
  { k: "pia", nombre: "PIA — interno de acera (terreno)" },
  { k: "pea", nombre: "PEA — externo de acera (calzada)" },
  { k: "eje", nombre: "Eje de vía" },
  { k: "pea2", nombre: "PEA' — externo de la otra acera" },
  { k: "pia2", nombre: "PIA' — interno de la segunda acera" },
];

function ver(id: string, norma: string, texto: string, estado: Estado, valor: string): Verificacion {
  return { id, norma, texto, estado, valor };
}

function letraManzana(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function frenteSobre(rect: Rect, face: Face, poly: V2[]): number {
  const yLine = face === "n" ? rect.y + rect.h : rect.y;
  const y = face === "n" ? yLine - 0.08 : yLine + 0.08;
  const N = 24;
  let acc = 0;
  let prev = false;
  for (let i = 0; i <= N; i++) {
    const x = rect.x + (rect.w * i) / N;
    const ins = pointInPoly({ x, y }, poly);
    if (i > 0 && ins && prev) acc += rect.w / N;
    else if (i > 0 && ins !== prev) acc += rect.w / (2 * N);
    prev = ins;
  }
  return acc;
}

function fitDepth(span: number, target: number, dMin: number, dMax: number, W: number): { n: number; depth: number } {
  if (!(span > W + 10)) return { n: 0, depth: span };
  let best = { n: 0, depth: span, score: Infinity };
  for (let n = 1; n <= 24; n++) {
    const depth = (span / n - W) / 2;
    if (depth < 6) break;
    const inRange = depth >= dMin * 0.98 && depth <= dMax * 1.02;
    const score = Math.abs(depth - target) + (inRange ? 0 : 2500) + (depth + 0.05 < dMin ? 1800 : 0);
    if (score < best.score) best = { n, depth, score };
  }
  return best.n > 0 ? { n: best.n, depth: best.depth } : { n: 0, depth: span };
}

function fitLength(span: number, target: number, minL: number, maxL: number, W: number): { n: number; length: number } {
  let best = { n: 1, length: span, score: Infinity };
  for (let n = 1; n <= 40; n++) {
    const L = (span - (n - 1) * W) / n;
    if (L < 8) break;
    const inRange = L >= minL - 0.05 && L <= maxL + 0.05;
    const score = Math.abs(L - target) + (inRange ? 0 : 4000) + (L > maxL ? 6000 : 0);
    if (score < best.score) best = { n, length: L, score };
  }
  return best;
}

function runs(nums: number[]): number[][] {
  const s = [...nums].sort((a, b) => a - b);
  const out: number[][] = [];
  for (const n of s) {
    const last = out[out.length - 1];
    if (!last || n !== last[last.length - 1] + 1) out.push([n]);
    else last.push(n);
  }
  return out;
}

function suma(ls: Work[]): number {
  return ls.reduce((s, l) => s + l.area, 0);
}

function buscarVentana(works: Work[], need: number, minAncho: number, ambosLados: boolean): Work[] | null {
  if (need < 1) return [];
  const vivos = works.filter((w) => w.uso === "vivienda");
  const bands = [...new Set(vivos.map((w) => w.grid.band))];
  let best: Work[] | null = null;
  let bestScore = Infinity;
  for (const band of bands) {
    const en = vivos.filter((w) => w.grid.band === band);
    if (!en.length) continue;
    const kind = en[0].grid.kind;
    if (ambosLados && kind !== "doble") continue;
    const depthLote = en[0].profundidad;
    const alto = kind === "doble" && ambosLados ? depthLote * 2 : depthLote;
    if (minAncho > 0 && alto + 0.2 < minAncho) continue;
    const frente = Math.max(1, ...en.map((w) => w.frente));
    const colRuns = runs([...new Set(en.map((w) => w.grid.col))]);
    const indices = [...new Set(en.map((w) => w.grid.index))].sort((a, b) => a - b);
    for (const run of colRuns) {
      for (let a = 0; a < indices.length; a++) {
        for (let b = a; b < indices.length; b++) {
          const i0 = indices[a];
          const i1 = indices[b];
          if (i1 - i0 !== b - a) continue;
          const ancho = (i1 - i0 + 1) * frente;
          if (minAncho > 0 && Math.min(ancho, alto) + 0.2 < minAncho) continue;
          const grupo = en.filter((w) => run.includes(w.grid.col) && w.grid.index >= i0 && w.grid.index <= i1);
          const lados = ambosLados && kind === "doble" ? 2 : 1;
          if (ambosLados && kind === "doble") {
            const expected = run.length * (i1 - i0 + 1) * 2;
            if (grupo.length !== expected) continue;
          } else if (kind === "doble" && !ambosLados) {
            const side0 = grupo.filter((w) => w.grid.side === 0);
            if (side0.length !== run.length * (i1 - i0 + 1)) continue;
            grupo.splice(0, grupo.length, ...side0);
          }
          if (grupo.length !== run.length * (i1 - i0 + 1) * lados && !(kind === "doble" && !ambosLados)) continue;
          const ar = suma(grupo);
          if (ar + 0.5 < need * 0.9) continue;
          const corto = ar + 1 < need ? 500 : 0;
          const sobre = ar > need * 1.35 ? 8000 : 0;
          const score = Math.abs(ar - need) + sobre + corto;
          if (score < bestScore) {
            bestScore = score;
            best = grupo.slice();
          }
        }
      }
    }
  }
  return best;
}

function cercoConVanos(poly: V2[], vanos: { edge: number; d0: number; d1: number }[]): V2[][] {
  const out: V2[][] = [];
  let chain: V2[] = [];
  const brk = () => {
    if (chain.length >= 2) out.push(chain);
    chain = [];
  };
  const add = (p: V2) => {
    if (!chain.length || !almost(chain[chain.length - 1], p, 0.02)) chain.push(p);
  };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const L = dist(a, b);
    const gaps = vanos
      .filter((v) => v.edge === i)
      .map((v) => ({ d0: Math.max(0, Math.min(L, Math.min(v.d0, v.d1))), d1: Math.max(0, Math.min(L, Math.max(v.d0, v.d1))) }))
      .filter((v) => v.d1 - v.d0 > 0.05)
      .sort((p, q) => p.d0 - q.d0);
    const libres: { d0: number; d1: number }[] = [];
    let cursor = 0;
    for (const g of gaps) {
      if (g.d0 > cursor + 0.02) libres.push({ d0: cursor, d1: g.d0 });
      cursor = Math.max(cursor, g.d1);
    }
    if (cursor < L - 0.02) libres.push({ d0: cursor, d1: L });
    if (!libres.length) {
      brk();
      continue;
    }
    for (const seg of libres) {
      if (seg.d0 > 0.03) brk();
      add(lerp(a, b, seg.d0 / L));
      add(lerp(a, b, seg.d1 / L));
      if (seg.d1 < L - 0.03) brk();
    }
  }
  if (chain.length >= 2 && out.length && almost(chain[chain.length - 1], out[0][0], 0.05)) {
    out[0] = chain.concat(out[0].slice(1));
  } else if (chain.length >= 2) out.push(chain);
  return out;
}

function viaGrafica(v: ProyectoLot["vias"][number]): ViaGraficaExistente {
  const presentes = CAMPOS.map((c) => ({ ...c, p: v[c.k] })).filter((c): c is { k: ViaCampo; nombre: string; p: NonNullable<(typeof v)["pia"]> } => !!c.p && Number.isFinite(c.p.e) && Number.isFinite(c.p.n));
  const anchos: { etiqueta: string; metros: number }[] = [];
  for (let i = 0; i < presentes.length - 1; i++) {
    const metros = Math.hypot(presentes[i + 1].p.e - presentes[i].p.e, presentes[i + 1].p.n - presentes[i].p.n);
    const etiqueta =
      i === 0 && presentes[i].k === "pia"
        ? "Vereda lado terreno"
        : presentes[i].k === "pea" && presentes[i + 1].k === "eje"
          ? "Semicalzada"
          : presentes[i].k === "eje"
            ? "Semicalzada opuesta"
            : presentes[i + 1].k === "pia2"
              ? "Vereda opuesta"
              : "Tramo";
    anchos.push({ etiqueta, metros });
  }
  let ordenada = true;
  let franjas: Franja[] = [];
  let lineas: ViaGraficaExistente["lineas"] = [];
  if (presentes.length >= 2) {
    const p0 = { x: presentes[0].p.e, y: presentes[0].p.n };
    const p1 = { x: presentes[presentes.length - 1].p.e, y: presentes[presentes.length - 1].p.n };
    const across = norm(sub(p1, p0));
    const along = { x: -across.y, y: across.x };
    const L = 36;
    let tPrev = -Infinity;
    const pts = presentes.map((c) => {
      const p = { x: c.p.e, y: c.p.n };
      const t = dot(sub(p, p0), across);
      if (t + 0.05 < tPrev) ordenada = false;
      tPrev = t;
      return { ...c, w: p };
    });
    lineas = pts.map((c) => ({
      nombre: c.nombre,
      p: c.w,
      a: add(c.w, mul(along, -L)),
      b: add(c.w, mul(along, L)),
    }));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i].w;
      const b = pts[i + 1].w;
      const d = mul(along, L);
      const vereda = pts[i].k === "pia" || pts[i + 1].k === "pia2";
      franjas.push({
        tipo: vereda ? "existente-vereda" : "existente-calzada",
        poly: [sub(a, d), add(a, d), add(b, d), sub(b, d)],
      });
    }
  }
  return { nombre: v.nombre, lineas, franjas, anchos, completa: presentes.length === 5, ordenada };
}

function rumboDeVia(p: ProyectoLot): number | null {
  if (p.cierre !== "abierta") return null;
  for (const v of p.vias) {
    if (!v.pia || !v.pia2) continue;
    const across = norm(sub({ x: v.pia2.e, y: v.pia2.n }, { x: v.pia.e, y: v.pia.n }));
    const along = { x: -across.y, y: across.x };
    return Math.atan2(along.y, along.x);
  }
  return null;
}

function vacio(ok: boolean, motivo: string, verificaciones: Verificacion[], parcial: Partial<Modelo> = {}): Modelo {
  return {
    ok,
    motivo,
    areaBruta: 0,
    perimetro: 0,
    areaVias: 0,
    areaLotes: 0,
    areaAportes: 0,
    areaResidual: 0,
    areaBaseAporte: 0,
    areaDescartadaArt31: 0,
    angulosAgudos: 0,
    sinAsignar: 0,
    aportes: [],
    lotes: [],
    franjas: [],
    ejes: [],
    lindero: [],
    cerco: [],
    viasExistentes: [],
    ingresos: [],
    verificaciones,
    seccionPartes: [],
    seccionTotal: 0,
    viasInternas: [],
    polilineas: [],
    largoManzana: 0,
    profundidad: 0,
    nManzanas: 0,
    rumboGrados: 0,
    ...parcial,
  };
}

export function proponer(p: ProyectoLot): Modelo {
  const pts = p.puntos.filter((q) => Number.isFinite(q.e) && Number.isFinite(q.n));
  const viasExistentes = p.vias.map(viaGrafica);
  if (pts.length < 3) {
    return vacio(false, "Falta el perímetro: cargue el CSV, el DXF o digite al menos tres vértices.", [
      ver("perimetro", "GH.020 Art. 56", "El plano de trazado exige el contorno del terreno con coordenadas.", "no-cumple", `${pts.length} vértices`),
    ], { viasExistentes });
  }
  let world = ensureCCW(pts.map((q) => ({ x: q.e, y: q.n })));
  if (world.length >= 2 && almost(world[0], world[world.length - 1], 0.01)) world = world.slice(0, -1);
  const bruta = area(world);
  const peri = perimeter(world);
  const cruza = selfIntersects(world);
  const checks: Verificacion[] = [];
  if (cruza) {
    checks.push(ver("cruce", "Geometría", "El perímetro se cruza a sí mismo. Corrija el orden de los vértices antes de modelar.", "no-cumple", fmtHa(bruta)));
    return vacio(false, "Perímetro cruzado.", checks, { areaBruta: bruta, perimetro: peri, lindero: world, viasExistentes });
  }
  if (bruta < 50) {
    checks.push(ver("area", "GH.020", "El área del polígono es insuficiente para una habilitación.", "no-cumple", `${bruta.toFixed(1)} m²`));
    return vacio(false, "Área insuficiente.", checks, { areaBruta: bruta, perimetro: peri, lindero: world, viasExistentes });
  }

  const c = p.criterios;
  const partes = partesDeSeccion(c.seccion);
  const W = anchoSeccion(c.seccion);
  const anguloVia = rumboDeVia(p);
  const ang = anguloVia ?? longestEdgeAngle(world);
  const centro = centroid(world);
  const toLocal = (q: V2) => rotate(sub(q, centro), -ang);
  const toWorld = (q: V2) => add(rotate(q, ang), centro);
  const local = world.map(toLocal);
  const bb = bbox(local);
  const frentePaso = c.frenteMin > 0 ? c.frenteMin : 6;
  const dObjetivo = c.profundidad > 1 ? c.profundidad : frentePaso * 2.5;
  const dMin = c.areaMin > 0 ? Math.max(10, c.areaMin / frentePaso) : Math.max(10, dObjetivo * 0.8);
  const dMax = Math.max(dObjetivo * 1.45, dMin * 1.05, 22);
  const tope = maxManzana(c);
  const objetivoL = Math.min(Math.max(c.largoManzana || 120, 40), tope);
  const depthFit = fitDepth(bb.h, dObjetivo, dMin, dMax, W);
  const lenFit = fitLength(bb.w, objetivoL, c.tipoHab === "industrial" ? 40 : 40, tope, W);

  const ingresos = ingresosDe(p, world, centro);
  const cerco = p.cierre === "cercada" ? cercoConVanos(world, ingresos.map((g) => ({ edge: g.arista, d0: g.distancia - g.ancho / 2, d1: g.distancia + g.ancho / 2 }))) : [];

  const rumboGrados = (Math.atan2(Math.sin(ang), Math.cos(ang)) * 180) / Math.PI;
  const azimut = (90 - rumboGrados + 360) % 360;

  if (depthFit.n < 1 || W < 4) {
    checks.push(
      ver(
        "cabida",
        "GH.020 Art. 8",
        "El predio no da cabida a una vía interna con la sección y la profundidad de lote indicadas.",
        "no-cumple",
        `Alto útil ${bb.h.toFixed(1)} m · sección ${W.toFixed(2)} m`,
      ),
    );
    return vacio(false, "No cabe la sección vial dentro del predio.", checks, {
      areaBruta: bruta,
      perimetro: peri,
      lindero: world,
      cerco,
      viasExistentes,
      ingresos,
      seccionPartes: partes,
      seccionTotal: W,
      rumboGrados: azimut,
    });
  }

  const D = depthFit.depth;
  const nStreets = depthFit.n;
  let errEje = 0;
  let ejeAplicado = false;
  if (p.cierre === "abierta") {
    const eje = p.vias.find((v) => v.eje)?.eje;
    if (eje) {
      const yE = toLocal({ x: eje.e, y: eje.n }).y;
      const pitch = 2 * D + W;
      const first = bb.minY + D + W / 2;
      const delta = yE - first;
      const k = Math.round(delta / pitch);
      const raw = delta - k * pitch;
      const lim = Math.max(4, D * 0.45);
      errEje = Math.max(-lim, Math.min(lim, raw));
      ejeAplicado = Math.abs(raw) <= lim + 0.01;
      if (Math.abs(raw) > lim) {
        checks.push(
          ver(
            "empalme-eje",
            "GH.020 Art. 5",
            "El eje preexistente no cae sobre una vía interna dentro de la tolerancia. Se alineó el rumbo; la transición de sección se detalla en pavimentos.",
            "observacion",
            `Desfase ${raw.toFixed(2)} m`,
          ),
        );
      }
    }
  }
  const Ds = D + errEje;

  const trama = tramaDe({
    bb,
    baseW: W,
    baseTipo: c.tipoVia,
    baseSeccion: c.seccion,
    nCallesH: nStreets,
    nManzanasX: lenFit.n,
    largo: lenFit.length,
    D,
    Ds,
    ajustes: p.ajustesVias ?? [],
    minTramo: Math.max(8, Math.min(D * 0.55, 14)),
  });
  const bandas = trama.bandas;
  const cols = trama.cols;
  const hCalles = trama.hCalles;
  const vCalles = trama.vCalles;
  const esquinas = esquinasDe(hCalles, vCalles);

  const works: Work[] = [];
  let mordidas = 0;
  for (const band of bandas) {
    const slices =
      band.kind === "perim"
        ? [{ y: band.y, h: band.h, face: band.face, side: 0 }]
        : [
            { y: band.y, h: band.h / 2, face: "s" as Face, side: 0 },
            { y: band.y + band.h / 2, h: band.h / 2, face: "n" as Face, side: 1 },
          ];
    for (const sl of slices) {
      for (const col of cols) {
        const n = Math.min(80, Math.max(1, Math.floor((col.w + 1e-6) / frentePaso)));
        const frente = col.w / n;
        for (let i = 0; i < n; i++) {
          const rect: Rect = { x: col.x + i * frente, y: sl.y, w: frente, h: sl.h };
          const clipped = clipRect(local, rect);
          if (clipped.length < 3) continue;
          const curvo = redondearLote(clipped, esquinas);
          const aRect = area(clipped);
          const aLot = area(curvo);
          mordidas += Math.max(0, aRect - aLot);
          if (aLot < 8) continue;
          const fEf = frenteSobre(rect, sl.face, local);
          const frenteOk = c.frenteMin > 0 ? fEf + 0.05 >= c.frenteMin * 0.9 : fEf >= Math.min(4, frente * 0.7);
          const areaOk = c.areaMin > 0 ? aLot + 0.5 >= c.areaMin * 0.92 : aLot >= 12;
          const uso: UsoLote = frenteOk && areaOk ? "vivienda" : "residual";
          const polyW = curvo.map(toWorld);
          works.push({
            poly: polyW,
            area: aLot,
            frente: fEf,
            profundidad: fEf > 0.5 ? aLot / fEf : sl.h,
            centro: centroid(polyW),
            grid: { band: band.band, col: col.i, side: sl.side, index: i, kind: band.kind },
            uso,
          });
        }
      }
    }
  }

  const agudos = areaAngulosAgudos(world);
  const baseAporte = Math.max(0, bruta - c.cesionPrimaria - c.reservaRegional - c.servidumbreAT - agudos.area);
  const pedidos: { uso: UsoLote; concepto: string; pct: number; minimo: number; minAncho: number; ambos: boolean }[] = [
    { uso: "recreacion", concepto: "Recreación pública", pct: c.aporteRec, minimo: 800, minAncho: 25, ambos: true },
    { uso: "parque-zonal", concepto: "Parques zonales", pct: c.aporteParque, minimo: c.loteNormativo, minAncho: 0, ambos: false },
    { uso: "educacion", concepto: "Ministerio de Educación", pct: c.aporteEdu, minimo: c.loteNormativo, minAncho: 0, ambos: false },
    { uso: "otros", concepto: "Otros fines", pct: c.aporteOtros, minimo: c.loteNormativo, minAncho: 0, ambos: false },
  ];
  const aportes = pedidos.map((ped) => {
    const requerido = (Math.max(0, ped.pct) / 100) * baseAporte;
    if (requerido < 1) {
      return { concepto: ped.concepto, pct: ped.pct, requerido: 0, grafico: 0, minimo: ped.minimo, estado: "No exigido para este tipo" };
    }
    if (ped.minimo > 0 && requerido + 0.5 < ped.minimo) {
      return {
        concepto: ped.concepto,
        pct: ped.pct,
        requerido,
        grafico: 0,
        minimo: ped.minimo,
        estado: "Redención en dinero: el cálculo no alcanza el mínimo (Art. 27)",
      };
    }
    let grupo = buscarVentana(works, requerido, ped.minAncho, ped.ambos);
    if (!grupo && ped.ambos) grupo = buscarVentana(works, requerido, ped.minAncho, false);
    if (!grupo || !grupo.length) {
      return {
        concepto: ped.concepto,
        pct: ped.pct,
        requerido,
        grafico: 0,
        minimo: ped.minimo,
        estado: "No se ubicó un lote regular con el ancho exigido. Ajuste profundidad o longitud de manzana.",
      };
    }
    for (const g of grupo) g.uso = ped.uso;
    const grafico = suma(grupo);
    const corto = grafico + 1 < requerido;
    return {
      concepto: ped.concepto,
      pct: ped.pct,
      requerido,
      grafico,
      minimo: ped.minimo,
      estado: corto ? "Grafiado por debajo del porcentaje exigido" : "Grafiado en el trazado",
    };
  });

  const manzanaClave = new Map<string, Work[]>();
  for (const w of works) {
    if (w.uso !== "vivienda") continue;
    const k = `${w.grid.band}:${w.grid.col}`;
    const arr = manzanaClave.get(k);
    if (arr) arr.push(w);
    else manzanaClave.set(k, [w]);
  }
  const manzanas = [...manzanaClave.entries()].map(([k, ls]) => {
    const cM = ls.reduce((s, l) => add(s, l.centro), { x: 0, y: 0 });
    return { k, ls, centro: mul(cM, 1 / ls.length) };
  });
  manzanas.sort((a, b) => b.centro.y - a.centro.y || a.centro.x - b.centro.x);
  const polilineas: Polilinea[] = [];
  const alMundo = (q: { x: number; y: number; bulge?: number }) => {
    const wpt = toWorld(q);
    return { x: wpt.x, y: wpt.y, bulge: q.bulge };
  };
  const contorno = new Map<string, Polilinea>();
  for (const band of bandas) {
    for (const col of cols) {
      const clipped = clipRect(local, { x: col.x, y: band.y, w: col.w, h: band.h });
      const pl = polilineaManzana(clipped, esquinas, "");
      if (pl) contorno.set(`${band.band}:${col.i}`, { ...pl, pts: pl.pts.map(alMundo) });
    }
  }
  for (const esq of esquinas) {
    const pl = polilineaSardinel(esq, "Sardinel");
    polilineas.push({ ...pl, pts: pl.pts.map(alMundo) });
  }
  const lotes: LoteM[] = [];
  manzanas.forEach((m, mi) => {
    const letra = letraManzana(mi);
    const bordeM = contorno.get(m.k);
    if (bordeM) polilineas.push({ ...bordeM, nombre: `Manzana ${letra}` });
    const orden = m.ls.slice().sort((a, b) => a.grid.index - b.grid.index || a.grid.side - b.grid.side);
    orden.forEach((w, i) => {
      lotes.push({
        id: `${letra}-${i + 1}`,
        manzana: letra,
        numero: i + 1,
        uso: "vivienda",
        poly: w.poly,
        area: w.area,
        frente: w.frente,
        profundidad: w.profundidad,
        centro: w.centro,
      });
    });
  });
  for (const w of works) {
    if (w.uso === "vivienda") continue;
    lotes.push({
      id: w.uso === "residual" ? "AR" : w.uso,
      manzana: "",
      numero: 0,
      uso: w.uso,
      poly: w.poly,
      area: w.area,
      frente: w.frente,
      profundidad: w.profundidad,
      centro: w.centro,
    });
  }

  const franjas: Franja[] = [];
  const ejes: { nombre: string; partes: V2[][] }[] = [];
  let areaVias = 0;
  const emitir = (rect: Rect, tipo: Franja["tipo"]) => {
    const clipped = clipRect(local, rect);
    if (clipped.length < 3) return;
    franjas.push({ tipo, poly: clipped.map(toWorld) });
  };
  const segmentoEje = (a: V2, b: V2, nombre: string) => {
    const partesEje = clipSegment(a, b, local).map((seg) => seg.map(toWorld));
    if (!partesEje.length) return;
    const prev = ejes.find((e) => e.nombre === nombre);
    if (prev) prev.partes.push(...partesEje);
    else ejes.push({ nombre, partes: partesEje });
  };
  const recortarX = (col: (typeof cols)[number], calle: (typeof hCalles)[number], borde: "s" | "n") => {
    let x0 = col.x;
    let x1 = col.x + col.w;
    const vereda = borde === "s" ? calle.veredaInicio : calle.veredaFin;
    if (vereda > 0.05) {
      const izq = vCalles[col.i - 1];
      const der = vCalles[col.i];
      if (izq) x0 += retroceso(Math.max(calle.radio, izq.radio), izq.veredaFin);
      if (der) x1 -= retroceso(Math.max(calle.radio, der.radio), der.veredaInicio);
    }
    return { x: x0, w: x1 - x0 };
  };
  const recortarY = (band: (typeof bandas)[number], calle: (typeof vCalles)[number]) => {
    let y0 = band.y;
    let y1 = band.y + band.h;
    if (band.calleAbajo !== null) {
      const abajo = hCalles[band.calleAbajo];
      y0 += retroceso(Math.max(calle.radio, abajo.radio), abajo.veredaFin);
    }
    if (band.calleArriba !== null) {
      const arriba = hCalles[band.calleArriba];
      y1 -= retroceso(Math.max(calle.radio, arriba.radio), arriba.veredaInicio);
    }
    return { y: y0, h: y1 - y0 };
  };

  for (const st of hCalles) {
    const row = clipRect(local, { x: bb.minX, y: st.pos, w: bb.w, h: st.span });
    areaVias += area(row);
    for (const fr of st.partes) {
      const alto = fr.b - fr.a;
      if (fr.tipo === "calzada" || fr.tipo === "separador") {
        emitir({ x: bb.minX, y: st.pos + fr.a, w: bb.w, h: alto }, fr.tipo);
      } else {
        const borde: "s" | "n" = fr.a < st.span / 2 ? "s" : "n";
        for (const col of cols) {
          const rec = recortarX(col, st, borde);
          if (rec.w > 0.15) emitir({ x: rec.x, y: st.pos + fr.a, w: rec.w, h: alto }, fr.tipo);
        }
      }
    }
    for (const fr of st.partes.filter((f) => f.tipo === "calzada")) {
      const yc = st.pos + (fr.a + fr.b) / 2;
      segmentoEje({ x: bb.minX, y: yc }, { x: bb.maxX, y: yc }, st.nombre);
    }
  }
  for (const st of vCalles) {
    for (const band of bandas) {
      const piece = clipRect(local, { x: st.pos, y: band.y, w: st.span, h: band.h });
      areaVias += area(piece);
    }
    for (const fr of st.partes) {
      const anchoFr = fr.b - fr.a;
      if (fr.tipo === "calzada" || fr.tipo === "separador") {
        emitir({ x: st.pos + fr.a, y: bb.minY, w: anchoFr, h: bb.h }, fr.tipo);
      } else {
        for (const band of bandas) {
          const rec = recortarY(band, st);
          if (rec.h > 0.15) emitir({ x: st.pos + fr.a, y: rec.y, w: anchoFr, h: rec.h }, fr.tipo);
        }
      }
    }
    for (const fr of st.partes.filter((f) => f.tipo === "calzada")) {
      const xc = st.pos + (fr.a + fr.b) / 2;
      segmentoEje({ x: xc, y: bb.minY }, { x: xc, y: bb.maxY }, st.nombre);
    }
  }
  areaVias += mordidas;
  for (const esq of esquinas) {
    if (esq.vereda.length >= 3) franjas.push({ tipo: "vereda", poly: esq.vereda.map(toWorld), soloVista: true });
  }
  const quad = (pts: V2[]): V2[] => pts.map(toWorld);
  const viasInternas: ViaInterna[] = [
    ...hCalles.map((st) => ({
      id: st.id,
      nombre: st.nombre,
      orientacion: "h" as const,
      tipo: st.tipo,
      ancho: st.ancho,
      radio: st.radio,
      hit: quad([
        { x: bb.minX, y: st.pos },
        { x: bb.maxX, y: st.pos },
        { x: bb.maxX, y: st.pos + st.span },
        { x: bb.minX, y: st.pos + st.span },
      ]),
    })),
    ...vCalles.map((st) => ({
      id: st.id,
      nombre: st.nombre,
      orientacion: "v" as const,
      tipo: st.tipo,
      ancho: st.ancho,
      radio: st.radio,
      hit: quad([
        { x: st.pos, y: bb.minY },
        { x: st.pos + st.span, y: bb.minY },
        { x: st.pos + st.span, y: bb.maxY },
        { x: st.pos, y: bb.maxY },
      ]),
    })),
  ];

  const areaLotes = lotes.filter((l) => l.uso === "vivienda").reduce((s, l) => s + l.area, 0);
  const areaAportes = lotes.filter((l) => l.uso !== "vivienda" && l.uso !== "residual").reduce((s, l) => s + l.area, 0);
  const areaResidual = lotes.filter((l) => l.uso === "residual").reduce((s, l) => s + l.area, 0);
  const sinAsignar = bruta - areaVias - areaLotes - areaAportes - areaResidual;

  const vendibles = lotes.filter((l) => l.uso === "vivienda");
  const peorFrente = vendibles.reduce((m, l) => Math.min(m, l.frente), Infinity);
  const peorArea = vendibles.reduce((m, l) => Math.min(m, l.area), Infinity);
  const largoDiseno = lenFit.length;

  checks.push(
    ver(
      "cierre",
      "GH.020 Art. 2 y 6",
      p.cierre === "abierta"
        ? "Habilitación abierta: las vías son de uso público y la trama continúa hacia las habilitaciones colindantes."
        : "Habilitación cercada: cerco sobre el lindero y vanos solo en los ingresos indicados. Las vías interiores se entregan según el régimen que apruebe la municipalidad.",
      "info",
      p.cierre === "abierta" ? "Abierta" : "Cercada",
    ),
  );
  checks.push(
    ver(
      "manzana",
      normaManzana(c),
      `Longitud de manzana de diseño ${largoDiseno.toFixed(2)} m. En residencial, entre intersecciones: mínimo 40 m y máximo 300 m, medidos en los extremos.`,
      largoDiseno <= tope + 0.05 && (largoDiseno + 0.05 >= 40 || bb.w < 40) ? "cumple" : "no-cumple",
      `${largoDiseno.toFixed(2)} m`,
    ),
  );
  if (c.tipoHab !== "industrial" && largoDiseno + 0.05 < 40 && bb.w + 0.05 < 40) {
    checks.push(ver("manzana-borde", "GH.020 Art. 15", "El frente del predio es menor de 40 m. No hay dos intersecciones internas que medir.", "observacion", `${bb.w.toFixed(1)} m`));
  }
  if (vendibles.length) {
    const frenteOk = c.frenteMin <= 0 || peorFrente + 0.05 >= c.frenteMin;
    const areaOk = c.areaMin <= 0 || peorArea + 0.5 >= c.areaMin;
    const frenteHolgado = c.frenteMin <= 0 || peorFrente + 0.05 >= c.frenteMin * 0.9;
    const areaHolgada = c.areaMin <= 0 || peorArea + 0.5 >= c.areaMin * 0.92;
    checks.push(
      ver(
        "lotes",
        "TH.010 Art. 9",
        `Lotes vendibles con frente desde ${peorFrente.toFixed(2)} m y área desde ${peorArea.toFixed(1)} m². El cuadro de referencia del tipo ${c.tipoDensidad} es ${c.frenteMin || "sin mínimo"} m y ${c.areaMin || "sin mínimo"} m². La municipalidad provincial puede fijar el lote normativo.`,
        frenteOk && areaOk ? "cumple" : frenteHolgado && areaHolgada ? "observacion" : "no-cumple",
        `${vendibles.length} lotes · ${manzanas.length} manzanas`,
      ),
    );
  } else {
    checks.push(ver("lotes", "TH.010 Art. 9", "No resultaron lotes vendibles con el frente y el área exigidos.", "no-cumple", "0 lotes"));
  }
  for (const ap of aportes) {
    const corto = ap.estado.includes("debajo");
    const malo = ap.estado.startsWith("No se ubicó");
    const redime = ap.estado.startsWith("Redención");
    const estado: Estado = malo ? "no-cumple" : redime || corto ? "observacion" : ap.requerido < 1 ? "info" : "cumple";
    checks.push(
      ver(
        `aporte-${ap.concepto}`,
        "GH.020 Art. 27 · TH.010 Art. 10",
        `${ap.concepto}: ${ap.pct}% del área base (${baseAporte.toFixed(0)} m²) = ${ap.requerido.toFixed(0)} m². Mínimo ${ap.minimo > 0 ? ap.minimo.toFixed(0) + " m²" : "—"}. ${ap.estado}.`,
        estado,
        ap.grafico > 0 ? `${ap.grafico.toFixed(0)} m² en plano` : ap.estado,
      ),
    );
  }
  if (agudos.n) {
    checks.push(
      ver(
        "art31",
        "GH.020 Art. 31",
        `Se descuentan del área de aportes los ángulos interiores menores de 45°, hasta 25 m sobre la bisectriz.`,
        "info",
        `${agudos.n} ángulos · ${agudos.area.toFixed(0)} m²`,
      ),
    );
  }
  const rec = aportes.find((a) => a.concepto.startsWith("Recreación"));
  const parques = lotes.filter((l) => l.uso === "recreacion");
  if (parques.length && vendibles.length) {
    let peor = 0;
    for (const lot of vendibles) {
      const d = Math.min(...parques.map((pk) => distPuntoPoligono(lot.centro, pk.poly)));
      if (d > peor) peor = d;
    }
    checks.push(
      ver(
        "dist-parque",
        "GH.020 Art. 28",
        "Ningún lote debe quedar a más de 300 m del área de recreación pública.",
        peor <= 300 ? "cumple" : "no-cumple",
        `Máximo ${peor.toFixed(0)} m`,
      ),
    );
  }
  if (rec && rec.grafico > 0) {
    checks.push(ver("ancho-parque", "GH.020 Art. 29", "El aporte de recreación se armó con ancho mínimo de 25 m, sin incluir la vereda de la sección vial.", rec.estado.startsWith("Grafiado") ? "cumple" : "observacion", "25 m"));
  }
  if (bruta > 100_000 && rec && rec.requerido >= 800) {
    checks.push(ver("concentrado", "GH.020 Art. 30", "Predio mayor de 10 ha: al menos el 30% de la recreación queda en un solo paño.", rec.grafico > 0 ? "cumple" : "observacion", rec.grafico > 0 ? "Un solo paño" : "Sin paño"));
  }
  const secEstado = evaluarSeccion(c, W);
  checks.push(secEstado);
  if (c.tipoHab === "industrial" && W + 0.01 < 16.8) {
    checks.push(ver("via-ind", "TH.030 Art. 13", "La vía local secundaria industrial tiene un ancho mínimo de 16.80 m.", "no-cumple", `${W.toFixed(2)} m`));
  }
  const exigida = calidadExigida(c);
  if (exigida) {
    checks.push(
      ver(
        "calidad",
        "TH.010 Art. 13",
        `Calidad mínima de obras exigida: tipo ${exigida}. Indicada: tipo ${c.calidad}.`,
        calidadAlcanza(c.calidad, exigida) ? "cumple" : "no-cumple",
        `Tipo ${c.calidad}`,
      ),
    );
  } else {
    checks.push(ver("calidad", "TH.010 Art. 11", `Calidad de obras indicada para el expediente: tipo ${c.calidad}.`, "info", `Tipo ${c.calidad}`));
  }
  if (c.tipoVia === "acceso-exclusivo") {
    const largoVia = Math.max(0, ...ejes.filter((e) => e.nombre.startsWith("Calle")).map((e) => e.partes.reduce((s, seg) => s + dist(seg[0], seg[1]), 0)));
    const topeVia = c.accesoUnico ? 50 : 100;
    checks.push(
      ver(
        "acceso-ex",
        "GH.020 Art. 11 y 13",
        c.accesoUnico
          ? "Acceso único: la vía no pasa de 50 m. Desde ahí hacen falta dos extremos, y en ningún caso más de 100 m. El extremo interior lleva plazoleta de volteo de 12 m."
          : "Vía de acceso exclusivo: longitud máxima 100 m y sección de circulación mínima 7.20 m.",
        largoVia <= topeVia + 0.5 ? "cumple" : "no-cumple",
        `${largoVia.toFixed(1)} m`,
      ),
    );
  }
  if (p.cierre === "abierta" && !p.vias.length) {
    checks.push(ver("vias-pre", "GH.020 Art. 5", "Habilitación abierta sin vías preexistentes cargadas. Si el predio empalma una sección existente, identifique PIA, PEA, eje, PEA' y PIA'.", "observacion", "Sin vías"));
  }
  for (const v of p.vias) {
    const g = viasExistentes.find((x) => x.nombre === v.nombre);
    checks.push(
      ver(
        `via-${v.id}`,
        "GH.020 Art. 5",
        g?.completa
          ? `${v.nombre}: sección identificada de acera a acera.${g.ordenada ? "" : " Los puntos no avanzan en un solo sentido; revise el orden."}`
          : `${v.nombre}: faltan puntos de la sección. Se requieren los cinco: PIA, PEA, eje, PEA' y PIA'.`,
        g?.completa && g.ordenada ? "cumple" : "observacion",
        g?.anchos.length ? g.anchos.map((a) => `${a.etiqueta} ${a.metros.toFixed(2)} m`).join(" · ") : "Incompleta",
      ),
    );
  }
  if (p.sinIngreso) {
    checks.push(ver("ingreso", "Acceso", "Sin pórtico de ingreso. El acceso queda definido solo por la continuidad de las vías.", "info", "Sin pórtico"));
  } else if (!ingresos.length) {
    checks.push(ver("ingreso", "Acceso", "No hay ingreso proyectado. Indique la arista y la distancia desde el vértice, o marque que no lleva pórtico.", "observacion", "Pendiente"));
  } else {
    checks.push(
      ver(
        "ingreso",
        "Acceso",
        `Ingresos sobre el lindero: ${ingresos.map((g) => `${g.nombre} a ${g.distancia.toFixed(2)} m del vértice, ancho ${g.ancho.toFixed(2)} m`).join("; ")}.`,
        "cumple",
        `${ingresos.length} ingreso${ingresos.length === 1 ? "" : "s"}`,
      ),
    );
  }
  if (Math.abs(sinAsignar) > Math.max(25, bruta * 0.025)) {
    checks.push(ver("balance", "Áreas", "La suma de vías, lotes, aportes y residual no cierra con el área bruta. Revise vértices repetidos o una sección demasiado ancha.", "observacion", `${sinAsignar.toFixed(0)} m² sin asignar`));
  } else {
    checks.push(ver("balance", "Áreas", "El área bruta cierra con vías, lotes, aportes y residual.", "cumple", `${sinAsignar.toFixed(1)} m² de diferencia`));
  }
  if (c.tipoHab === "club") {
    const libre = 1 - areaLotes / bruta;
    checks.push(
      ver(
        "club",
        "TH.010 Art. 24 a 31",
        "Vivienda tipo club: área bruta mínima 1 ha, máximo 25 viviendas por hectárea y área libre de uso común no menor del 60%. No se exige recreación pública; sí 1% educación y 1% otros fines.",
        bruta >= 10_000 && areaLotes / bruta <= 0.42 ? "cumple" : "observacion",
        `Libre ${(libre * 100).toFixed(0)}% · ${(vendibles.length / (bruta / 10000)).toFixed(1)} viv/ha`,
      ),
    );
  }
  if (anguloVia !== null) {
    checks.push(
      ver(
        "rumbo",
        "GH.020 Art. 5",
        ejeAplicado
          ? "La trama tomó el rumbo de la vía preexistente y una calzada interna pasó por su eje."
          : "La trama tomó el rumbo de la vía preexistente.",
        "info",
        `Azimut ${azimut.toFixed(2)}°`,
      ),
    );
  }
  for (const aviso of trama.avisos) {
    checks.push(ver(`ancho-${aviso.slice(0, 24)}`, "GH.020 Art. 8", aviso, "observacion", "Ancho limitado"));
  }
  const radiosUsados = [...new Set(viasInternas.map((v) => v.radio))].sort((a, b) => a - b);
  checks.push(
    ver(
      "radios",
      "GH.020",
      esquinas.length
        ? `Curva de la acera al sardinel: ${radiosUsados.map((r) => r.toFixed(2)).join(" m y ")} m. En cada cruce manda el mayor: 3.00 m en local secundaria o acceso exclusivo, y 5.00 m en local principal. La esquina de la manzana es concéntrica (R − vereda) para no angostar la acera.`
        : `Sin cruces internos. El radio exigible de la acera sigue siendo ${radioEsquina(c.tipoVia).toFixed(2)} m al sardinel.`,
      esquinas.length ? "cumple" : "info",
      esquinas.length ? `${esquinas.length} curvas` : `Radio ${radioEsquina(c.tipoVia).toFixed(2)} m`,
    ),
  );
  checks.push(
    ver(
      "nomenclatura",
      "GH.020 Art. 51 y 52",
      "Manzanas con letras y lotes con números, correlativos. Las calles y jirones llevan nomenclatura provisional hasta el pronunciamiento municipal.",
      "info",
      `${manzanas.length} manzanas`,
    ),
  );

  const hayFallo = checks.some((v) => v.estado === "no-cumple");
  return {
    ok: !hayFallo || vendibles.length > 0,
    motivo: hayFallo ? "Hay verificaciones que no cumplen. Puede confirmarlas solo si acepta las observaciones en el expediente." : "Estructura conforme al cuadro aplicado.",
    areaBruta: bruta,
    perimetro: peri,
    areaVias,
    areaLotes,
    areaAportes,
    areaResidual,
    areaBaseAporte: baseAporte,
    areaDescartadaArt31: agudos.area,
    angulosAgudos: agudos.n,
    sinAsignar,
    aportes,
    lotes,
    franjas,
    ejes,
    lindero: world,
    cerco,
    viasExistentes,
    ingresos,
    verificaciones: checks,
    seccionPartes: partes,
    seccionTotal: W,
    viasInternas,
    polilineas,
    largoManzana: largoDiseno,
    profundidad: D,
    nManzanas: manzanas.length,
    rumboGrados: azimut,
  };
}

function normaManzana(c: Criterios): string {
  return c.tipoHab === "industrial" ? "TH.030 Art. 13" : "GH.020 Art. 15";
}

function fmtHa(m2: number): string {
  return `${m2.toFixed(0)} m²`;
}

function evaluarSeccion(c: Criterios, W: number): Verificacion {
  const s = c.seccion;
  const fallos: string[] = [];
  if (c.tipoVia === "acceso-exclusivo") {
    if (W + 0.02 < 7.2) fallos.push("sección de circulación menor de 7.20 m");
  } else if (c.tipoVia === "local-principal") {
    if (s.nVeredas < 2 || s.vereda + 0.01 < 1.8) fallos.push("vereda mínima 1.80 m a cada lado");
    if (s.nEstacionamientos < 2 || s.estacionamiento + 0.01 < 2.4) fallos.push("estacionamiento a cada frente (Art. 9)");
    if (s.moduloCalzada + 0.01 < 2.7) fallos.push("módulo de calzada menor de 2.70 m");
  } else {
    if (s.nVeredas < 2 || s.vereda + 0.01 < 1.2) fallos.push("dos módulos de vereda (1.20 m) por frente");
    if (s.nEstacionamientos < 1 || (s.nEstacionamientos > 0 && s.estacionamiento + 0.01 < 2.4)) fallos.push("al menos un módulo de estacionamiento de 2.40 m");
    if (s.moduloCalzada + 0.01 < 2.7) fallos.push("dos módulos de calzada, mínimo 2.70 m");
  }
  const norma = c.tipoVia === "local-principal" ? "GH.020 Art. 8 y 9" : c.tipoVia === "acceso-exclusivo" ? "GH.020 Art. 11" : "GH.020 Art. 8 y 10";
  return ver(
    "seccion",
    norma,
    fallos.length ? `La sección no alcanza el mínimo: ${fallos.join("; ")}.` : `Sección ${W.toFixed(2)} m, dentro de los módulos del artículo 8.`,
    fallos.length ? "no-cumple" : "cumple",
    `${W.toFixed(2)} m`,
  );
}

function ingresosDe(p: ProyectoLot, poly: V2[], centro: V2): IngresoGraf[] {
  if (p.sinIngreso) return [];
  const out: IngresoGraf[] = [];
  p.ingresos.forEach((ing, i) => {
    const hit = pointAlong(poly, ing.arista, ing.distancia);
    if (!hit) return;
    const a = poly[ing.arista];
    const b = poly[(ing.arista + 1) % poly.length];
    const dir = norm(sub(b, a));
    let hacia = { x: -dir.y, y: dir.x };
    if (dot(hacia, sub(centro, hit.pt)) < 0) hacia = mul(hacia, -1);
    out.push({
      id: ing.id,
      nombre: ing.nombre || `Ingreso ${i + 1}`,
      pt: hit.pt,
      hacia,
      ancho: Math.max(3, ing.ancho || 8),
      arista: ing.arista,
      distancia: Math.max(0, Math.min(hit.len, ing.distancia)),
    });
  });
  return out;
}

export function referenciaDensidad(c: Criterios): string {
  if (c.tipoHab === "vivienda" || c.tipoHab === "vivienda-taller") {
    const f = filaVivienda(c.tipoHab === "vivienda-taller" ? 3 : c.tipoDensidad);
    return `${etiquetaHab(c.tipoHab)} · tipo ${c.tipoHab === "vivienda-taller" ? 3 : c.tipoDensidad} · ${f.nota}`;
  }
  return etiquetaHab(c.tipoHab);
}
