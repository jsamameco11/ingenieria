import type {
  DestinoDescarga,
  DistribCanaleta,
  ElementoPluvial,
  EsquemaTecho,
  LadoPluvial,
} from "./canaleta";

export type Pt = { x: number; y: number };

export interface EjePlanta {
  label: string;
  v: number;
}

export interface CuencaResuelta {
  el: ElementoPluvial;
  poly: Pt[];
  x0: number;
  y0: number;
  w: number;
  d: number;
  nivel: number;
  lado: LadoPluvial;
  ejes: string;
  gutter: { a: Pt; b: Pt };
  gutters: { a: Pt; b: Pt }[];
  ridges: { a: Pt; b: Pt }[];
  falls: { a: Pt; b: Pt }[];
  bajantes: Pt[];
  labelAt: Pt;
  esquema: EsquemaTecho;
  distrib: DistribCanaleta;
}

export interface PlanoPluvial {
  items: CuencaResuelta[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  ejesX: EjePlanta[];
  ejesY: EjePlanta[];
  descarga: { poly: Pt[]; label: string; setback: number };
}

const EJES_X_CHICLAYO: EjePlanta[] = [
  { label: "A", v: 0 },
  { label: "A'", v: 3.6 },
  { label: "B", v: 8 },
  { label: "B'''", v: 14.2 },
  { label: "C", v: 16 },
  { label: "D", v: 22.5 },
];

const EJES_Y_CHICLAYO: EjePlanta[] = [
  { label: "1", v: 0 },
  { label: "4'", v: 10 },
  { label: "6", v: 16 },
  { label: "9", v: 24 },
  { label: "12", v: 32 },
  { label: "13", v: 35.6 },
  { label: "16", v: 48 },
];

const LETRAS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export function inferNivel(el: ElementoPluvial): number {
  if (typeof el.nivel === "number" && el.nivel > 0) return el.nivel;
  const t = el.descripcion.toLowerCase();
  if (/2\.?\s*°|2do|segundo|2\.\s*nivel/.test(t)) return 2;
  if (/3\.?\s*er|3er|tercer/.test(t)) return 3;
  return 1;
}

export function inferEjes(el: ElementoPluvial): string {
  if (el.ejes?.trim()) return el.ejes.trim();
  const m = el.descripcion.match(/ejes?\s+([^)]+)/i);
  return m ? m[1].trim() : "";
}

export function inferLado(el: ElementoPluvial): LadoPluvial {
  if (el.lado === "N" || el.lado === "S" || el.lado === "E" || el.lado === "O") return el.lado;
  return el.tipo === "piso" ? "S" : "S";
}

export function bbox(poly: Pt[]) {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function centroid(poly: Pt[]): Pt {
  const n = Math.max(poly.length, 1);
  return {
    x: poly.reduce((s, p) => s + p.x, 0) / n,
    y: poly.reduce((s, p) => s + p.y, 0) / n,
  };
}

function rectPoly(x0: number, y0: number, w: number, d: number): Pt[] {
  return [
    { x: x0, y: y0 },
    { x: x0 + w, y: y0 },
    { x: x0 + w, y: y0 + d },
    { x: x0, y: y0 + d },
  ];
}

export function sizeFromHydraulics(el: ElementoPluvial, lado: LadoPluvial): { w: number; d: number } {
  const along = Math.max(el.L2, 1);
  const across = el.A1 > 0 ? Math.max(el.A1 / along, 1.2) : Math.max(el.L1, 2);
  if (lado === "E" || lado === "O") return { w: across, d: along };
  return { w: along, d: across };
}

function opuesto(lado: LadoPluvial): LadoPluvial {
  if (lado === "N") return "S";
  if (lado === "S") return "N";
  if (lado === "E") return "O";
  return "E";
}

function adyacente(lado: LadoPluvial): LadoPluvial {
  if (lado === "N" || lado === "S") return "E";
  return "S";
}

export function inferEsquema(el: ElementoPluvial): EsquemaTecho {
  if (el.esquemaTecho) return el.esquemaTecho;
  if (el.tipo === "piso") return "azotea";
  return "una-agua";
}

export function inferDistrib(el: ElementoPluvial): DistribCanaleta {
  if (el.distrib) return el.distrib;
  const esq = inferEsquema(el);
  if (esq === "dos-aguas") return "dos-bordes";
  if (esq === "cuatro-aguas") return "perimetral";
  return "un-borde";
}

function gutterOnLado(poly: Pt[], lado: LadoPluvial, L2: number): { a: Pt; b: Pt } {
  const b = bbox(poly);
  const L = Math.max(L2, 0.6);
  if (lado === "N") {
    const len = Math.min(L, Math.max(b.maxX - b.minX, 0.6));
    const x0 = b.minX + (b.maxX - b.minX - len) / 2;
    return { a: { x: x0, y: b.minY }, b: { x: x0 + len, y: b.minY } };
  }
  if (lado === "S") {
    const len = Math.min(L, Math.max(b.maxX - b.minX, 0.6));
    const x0 = b.minX + (b.maxX - b.minX - len) / 2;
    return { a: { x: x0, y: b.maxY }, b: { x: x0 + len, y: b.maxY } };
  }
  if (lado === "E") {
    const len = Math.min(L, Math.max(b.maxY - b.minY, 0.6));
    const y0 = b.minY + (b.maxY - b.minY - len) / 2;
    return { a: { x: b.maxX, y: y0 }, b: { x: b.maxX, y: y0 + len } };
  }
  const len = Math.min(L, Math.max(b.maxY - b.minY, 0.6));
  const y0 = b.minY + (b.maxY - b.minY - len) / 2;
  return { a: { x: b.minX, y: y0 }, b: { x: b.minX, y: y0 + len } };
}

function edgeFull(poly: Pt[], lado: LadoPluvial): { a: Pt; b: Pt } {
  const b = bbox(poly);
  if (lado === "N") return { a: { x: b.minX, y: b.minY }, b: { x: b.maxX, y: b.minY } };
  if (lado === "S") return { a: { x: b.minX, y: b.maxY }, b: { x: b.maxX, y: b.maxY } };
  if (lado === "E") return { a: { x: b.maxX, y: b.minY }, b: { x: b.maxX, y: b.maxY } };
  return { a: { x: b.minX, y: b.minY }, b: { x: b.minX, y: b.maxY } };
}

function guttersDe(poly: Pt[], lado: LadoPluvial, distrib: DistribCanaleta, L2: number): { a: Pt; b: Pt }[] {
  if (distrib === "dos-bordes") return [gutterOnLado(poly, lado, L2), gutterOnLado(poly, opuesto(lado), L2)];
  if (distrib === "perimetral" || distrib === "perimetral-esquinas") {
    return (["N", "S", "E", "O"] as LadoPluvial[]).map((l) => edgeFull(poly, l));
  }
  if (distrib === "en-L") return [gutterOnLado(poly, lado, L2), gutterOnLado(poly, adyacente(lado), L2)];
  if (distrib === "central") {
    const b = bbox(poly);
    if (lado === "N" || lado === "S") {
      const y = (b.minY + b.maxY) / 2;
      return [{ a: { x: b.minX, y }, b: { x: b.maxX, y } }];
    }
    const x = (b.minX + b.maxX) / 2;
    return [{ a: { x, y: b.minY }, b: { x, y: b.maxY } }];
  }
  return [gutterOnLado(poly, lado, L2)];
}

function ridgesDe(poly: Pt[], esquema: EsquemaTecho, lado: LadoPluvial): { a: Pt; b: Pt }[] {
  const b = bbox(poly);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  if (esquema === "dos-aguas") {
    if (lado === "N" || lado === "S") return [{ a: { x: b.minX, y: cy }, b: { x: b.maxX, y: cy } }];
    return [{ a: { x: cx, y: b.minY }, b: { x: cx, y: b.maxY } }];
  }
  if (esquema === "cuatro-aguas") {
    return [
      { a: { x: b.minX, y: b.minY }, b: { x: cx, y: cy } },
      { a: { x: b.maxX, y: b.minY }, b: { x: cx, y: cy } },
      { a: { x: b.maxX, y: b.maxY }, b: { x: cx, y: cy } },
      { a: { x: b.minX, y: b.maxY }, b: { x: cx, y: cy } },
    ];
  }
  if (esquema === "shed") {
    const y1 = b.minY + (b.maxY - b.minY) * 0.33;
    const y2 = b.minY + (b.maxY - b.minY) * 0.66;
    return [
      { a: { x: b.minX, y: y1 }, b: { x: b.maxX, y: y1 } },
      { a: { x: b.minX, y: y2 }, b: { x: b.maxX, y: y2 } },
    ];
  }
  return [];
}

function fallsDe(poly: Pt[], esquema: EsquemaTecho, lado: LadoPluvial): { a: Pt; b: Pt }[] {
  const b = bbox(poly);
  const n = esquema === "azotea" ? 3 : 5;
  const out: { a: Pt; b: Pt }[] = [];
  const inset = 0.35;
  if (esquema === "cuatro-aguas") {
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    out.push(
      { a: { x: cx, y: cy }, b: { x: cx, y: b.minY + inset } },
      { a: { x: cx, y: cy }, b: { x: cx, y: b.maxY - inset } },
      { a: { x: cx, y: cy }, b: { x: b.minX + inset, y: cy } },
      { a: { x: cx, y: cy }, b: { x: b.maxX - inset, y: cy } },
    );
    return out;
  }
  if (esquema === "dos-aguas") {
    if (lado === "N" || lado === "S") {
      for (let i = 1; i <= n; i++) {
        const x = b.minX + ((b.maxX - b.minX) * i) / (n + 1);
        out.push({ a: { x, y: (b.minY + b.maxY) / 2 }, b: { x, y: b.minY + inset } });
        out.push({ a: { x, y: (b.minY + b.maxY) / 2 }, b: { x, y: b.maxY - inset } });
      }
    } else {
      for (let i = 1; i <= n; i++) {
        const y = b.minY + ((b.maxY - b.minY) * i) / (n + 1);
        out.push({ a: { x: (b.minX + b.maxX) / 2, y }, b: { x: b.minX + inset, y } });
        out.push({ a: { x: (b.minX + b.maxX) / 2, y }, b: { x: b.maxX - inset, y } });
      }
    }
    return out;
  }
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    if (lado === "N") {
      const x = b.minX + (b.maxX - b.minX) * t;
      out.push({ a: { x, y: b.maxY - inset }, b: { x, y: b.minY + inset } });
    } else if (lado === "S") {
      const x = b.minX + (b.maxX - b.minX) * t;
      out.push({ a: { x, y: b.minY + inset }, b: { x, y: b.maxY - inset } });
    } else if (lado === "E") {
      const y = b.minY + (b.maxY - b.minY) * t;
      out.push({ a: { x: b.minX + inset, y }, b: { x: b.maxX - inset, y } });
    } else {
      const y = b.minY + (b.maxY - b.minY) * t;
      out.push({ a: { x: b.maxX - inset, y }, b: { x: b.minX + inset, y } });
    }
  }
  return out;
}

function bajantesDe(
  poly: Pt[],
  gutters: { a: Pt; b: Pt }[],
  n: 1 | 2,
  distrib: DistribCanaleta,
): Pt[] {
  const b = bbox(poly);
  if (distrib === "perimetral-esquinas") {
    return [
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY },
      { x: b.minX, y: b.maxY },
    ];
  }
  if (distrib === "perimetral") return gutters.map((g) => g.b);
  if (n === 2) return gutters.flatMap((g) => [g.a, g.b]);
  return gutters.map((g) => g.b);
}

function r1(n: number) {
  return Math.round(n * 10) / 10;
}

function looksLikeChiclayo(els: ElementoPluvial[]): boolean {
  const ids = new Set(els.map((e) => e.id));
  return ids.has("c1") && ids.has("c5") && ids.has("c6");
}

function ejesAuto(items: CuencaResuelta[]): { ejesX: EjePlanta[]; ejesY: EjePlanta[] } {
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (const it of items) {
    const b = bbox(it.poly);
    xs.add(r1(b.minX));
    xs.add(r1(b.maxX));
    ys.add(r1(b.minY));
    ys.add(r1(b.maxY));
  }
  const xSorted = [...xs].sort((a, b) => a - b);
  const ySorted = [...ys].sort((a, b) => a - b);
  return {
    ejesX: xSorted.map((v, i) => ({ label: LETRAS[i] ?? `X${i + 1}`, v })),
    ejesY: ySorted.map((v, i) => ({ label: String(i + 1), v })),
  };
}

function destinoLabel(destino: DestinoDescarga): string {
  if (destino === "cuneta") return "Descarga a cuneta de vía";
  if (destino === "red-pluvial") return "Descarga a red pluvial";
  if (destino === "infiltracion") return "Caja de infiltración";
  return "Descarga a jardín / área verde";
}

function resolverPoly(el: ElementoPluvial, lado: LadoPluvial, fallback: { x0: number; y0: number }): Pt[] {
  if (el.poly && el.poly.length >= 3) return el.poly;
  const size = sizeFromHydraulics(el, lado);
  const w = el.w && el.w > 0 ? el.w : size.w;
  const d = el.d && el.d > 0 ? el.d : size.d;
  const x0 = typeof el.x0 === "number" ? el.x0 : fallback.x0;
  const y0 = typeof el.y0 === "number" ? el.y0 : fallback.y0;
  return rectPoly(x0, y0, w, d);
}

function toCuenca(el: ElementoPluvial, poly: Pt[]): CuencaResuelta {
  const lado = inferLado(el);
  const esquema = inferEsquema(el);
  const distrib = inferDistrib(el);
  const b = bbox(poly);
  const gutters = guttersDe(poly, lado, distrib, el.L2);
  const gutter = gutters[0] ?? gutterOnLado(poly, lado, el.L2);
  return {
    el,
    poly,
    x0: b.minX,
    y0: b.minY,
    w: b.maxX - b.minX,
    d: b.maxY - b.minY,
    nivel: inferNivel(el),
    lado,
    ejes: inferEjes(el),
    gutter,
    gutters,
    ridges: ridgesDe(poly, esquema, lado),
    falls: fallsDe(poly, esquema, lado),
    bajantes: bajantesDe(poly, gutters, el.nBajantes, distrib),
    labelAt: centroid(poly),
    esquema,
    distrib,
  };
}

export function resolverEmplazamiento(
  elementos: ElementoPluvial[],
  destino: DestinoDescarga,
  distCim: number,
): PlanoPluvial {
  const hasCoord = elementos.some(
    (e) => typeof e.x0 === "number" || (e.poly && e.poly.length >= 3)
  );

  let cursorX = 0;
  const items: CuencaResuelta[] = elementos.map((el, i) => {
    const lado = inferLado(el);
    let fallback = { x0: cursorX, y0: 0 };
    if (!hasCoord) {
      if (el.tipo === "piso") {
        fallback = { x0: 0, y0: 14 };
      } else {
        const size = sizeFromHydraulics(el, lado);
        fallback = { x0: cursorX, y0: 0 };
        cursorX += size.w + 1.2;
      }
    } else if (typeof el.x0 !== "number" && !(el.poly && el.poly.length >= 3)) {
      fallback = { x0: cursorX + i * 2, y0: 0 };
    }
    return toCuenca(el, resolverPoly(el, lado, fallback));
  });

  const allPts = items.flatMap((it) => it.poly);
  const raw = bbox(allPts.length ? allPts : [{ x: 0, y: 0 }, { x: 10, y: 10 }]);
  const setback = Math.max(distCim, 0);
  const pad = 1.2;
  const descargaH = Math.max(4, raw.maxX - raw.minX > 20 ? 5 : 4);
  const descarga = {
    poly: rectPoly(raw.minX, raw.maxY + setback, Math.max(raw.maxX - raw.minX, 8), descargaH),
    label: destinoLabel(destino),
    setback,
  };
  const disc = bbox(descarga.poly);

  const bounds = {
    minX: Math.min(raw.minX, disc.minX) - pad,
    minY: raw.minY - pad,
    maxX: Math.max(raw.maxX, disc.maxX) + pad,
    maxY: Math.max(raw.maxY, disc.maxY) + pad,
  };

  const ejes = looksLikeChiclayo(elementos)
    ? { ejesX: EJES_X_CHICLAYO, ejesY: EJES_Y_CHICLAYO }
    : ejesAuto(items);

  return { items, bounds, ejesX: ejes.ejesX, ejesY: ejes.ejesY, descarga };
}

export function colocarNuevoElemento(el: ElementoPluvial, existentes: ElementoPluvial[]): ElementoPluvial {
  const plano = resolverEmplazamiento(existentes, "jardin", 2);
  const lado = inferLado(el);
  const { w, d } = sizeFromHydraulics(el, lado);
  return {
    ...el,
    nivel: el.nivel ?? 1,
    lado,
    x0: plano.bounds.maxX + 0.4,
    y0: plano.items[0]?.y0 ?? 0,
    w,
    d,
  };
}
