/** Motor de metrados zonificados: polígonos numerados que coinciden con la tabla. */

export type MetradoMaterial = "tierra" | "concreto" | "agua" | "carga";

export type Pt = [number, number];

export type MetradoZone = {
  n: number | string;
  label: string;
  material: MetradoMaterial;
  /** Polígono en metros (origen según `origin`, y positivo hacia arriba). */
  pts: Pt[];
  /** Centro del número; si falta, se usa el centroide. */
  badge?: Pt;
  /** Superficie curva (cúpula / agua): se traza como spline, no como polígono facetado. */
  smooth?: boolean;
};

export type MetradoArrow = {
  n?: number | string;
  label: string;
  from: Pt;
  to: Pt;
};

export type MetradoDim = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
};

export type MetradoLayout = {
  id: string;
  title: string;
  caption: string;
  origin: string;
  zones: MetradoZone[];
  arrows?: MetradoArrow[];
  dims?: MetradoDim[];
  /** Si es false, no se dibuja el terreno (cuba elevada: solo eje de revolución). */
  ground?: boolean;
};

export const MATERIAL_META: Record<
  MetradoMaterial,
  { label: string; fill: string; stroke: string }
> = {
  tierra: { label: "Tierra / relleno", fill: "#c4b48a", stroke: "#6e5a32" },
  concreto: { label: "Concreto", fill: "#d4cdc0", stroke: "#1a4473" },
  agua: { label: "Agua", fill: "#9ec5e8", stroke: "#2a5f86" },
  carga: { label: "Carga / fuerza", fill: "#f3e6d8", stroke: "#8b1e1e" },
};

export function centroid(pts: Pt[]): Pt {
  if (!pts.length) return [0, 0];
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const c = x1 * y2 - x2 * y1;
    a += c;
    cx += (x1 + x2) * c;
    cy += (y1 + y2) * c;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-12) {
    const sx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const sy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return [sx, sy];
  }
  return [cx / (6 * a), cy / (6 * a)];
}

export function polyArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function rect(x: number, y: number, w: number, h: number): Pt[] {
  if (w <= 1e-6 || h <= 1e-6) return [];
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

function tri(a: Pt, b: Pt, c: Pt): Pt[] {
  return [a, b, c];
}

/** Casquete esférico con polo abajo (cúpula invertida / agua sobre el fondo INTZE). y=0 en el polo. */
export function sampleSphereBowl(r: number, f: number, n = 80): Pt[] {
  const sag = Math.max(f, 1e-4);
  const Rs = (r * r + sag * sag) / (2 * sag);
  const yc = Rs;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * r;
    const y = yc - Math.sqrt(Math.max(0, Rs * Rs - x * x));
    pts.push([x, y]);
  }
  return pts;
}

/** Casquete esférico con polo arriba (cúpula de techo). yRing = cota del arranque. */
export function sampleSphereCrown(r: number, f: number, yRing: number, n = 80): Pt[] {
  const sag = Math.max(f, 1e-4);
  const Rs = (r * r + sag * sag) / (2 * sag);
  const yc = yRing + f - Rs;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * r;
    const y = yc + Math.sqrt(Math.max(0, Rs * Rs - x * x));
    pts.push([x, y]);
  }
  return pts;
}

/** Cáscara esférica de espesor radial uniforme t (mismo centro, Rs y Rs+t). Polo abajo. */
export function sphereBowlShell(r: number, f: number, t: number, n = 72): { inner: Pt[]; outer: Pt[]; closed: Pt[] } {
  const sag = Math.max(f, 1e-4);
  const thick = Math.max(t, 1e-4);
  const Rs = (r * r + sag * sag) / (2 * sag);
  const yc = Rs;
  const inner: Pt[] = [];
  const outer: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * r;
    const yin = yc - Math.sqrt(Math.max(0, Rs * Rs - x * x));
    inner.push([x, yin]);
    const ux = x / Rs;
    const uy = (yin - yc) / Rs;
    outer.push([x + thick * ux, yin + thick * uy]);
  }
  return { inner, outer, closed: [...inner, ...outer.slice().reverse()] };
}

/** Cáscara esférica de espesor radial uniforme t. Polo arriba. */
export function sphereCrownShell(r: number, f: number, yRing: number, t: number, n = 72): { inner: Pt[]; outer: Pt[]; closed: Pt[] } {
  const sag = Math.max(f, 1e-4);
  const thick = Math.max(t, 1e-4);
  const Rs = (r * r + sag * sag) / (2 * sag);
  const yc = yRing + f - Rs;
  const inner: Pt[] = [];
  const outer: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * r;
    const yin = yc + Math.sqrt(Math.max(0, Rs * Rs - x * x));
    inner.push([x, yin]);
    const ux = x / Rs;
    const uy = (yin - yc) / Rs;
    outer.push([x + thick * ux, yin + thick * uy]);
  }
  return { inner, outer, closed: [...inner, ...outer.slice().reverse()] };
}

/* ─── Muro en voladizo ─── */

/** Geometría común (metros, y positivo hacia arriba, origen en la arista delantera de la pata a la cara inferior de la zapata). */
export type MuroVoladizoGeo = {
  H: number;
  D: number;
  A: number;
  C: number;
  F: number;
  Bp: number;
  esp: number;
  beta: number;
  hk?: number;
  bk?: number;
};

export function geoMuroVoladizo(p: MuroVoladizoGeo) {
  const F = Math.max(0.12, p.F);
  const Bp = Math.min(F, Math.max(0.05, p.Bp));
  const B = p.A + p.C + F;
  const B1 = Math.max(0, (F - Bp) / 2);
  const Hs = Math.max(0.05, p.H - p.esp);
  const hk = Math.max(0, p.hk ?? 0);
  const bk = hk > 0.02 ? Math.min(F, Math.max(0.25, p.bk ?? F)) : 0;
  const xStemF = p.C;
  const xStemB = p.C + F;
  const xTopF = p.C + B1;
  const xTopB = p.C + F - B1;
  const xKeyL = p.C;
  const xKeyR = p.C + bk;
  const wall: Pt[] = [
    [xTopF, p.H],
    [xTopB, p.H],
    [xStemB, p.esp],
    [B, p.esp],
    [B, 0],
  ];
  if (hk > 0.02) {
    wall.push([xKeyR, 0], [xKeyR, -hk], [xKeyL, -hk], [xKeyL, 0]);
  }
  wall.push([0, 0], [0, p.esp], [xStemF, p.esp]);
  return { F, Bp, B, B1, Hs, hk, bk, xStemF, xStemB, xTopF, xTopB, xKeyL, xKeyR, wall };
}

export function layoutMuroVoladizo(p: MuroVoladizoGeo): MetradoLayout {
  const { H, D, A, C, F, esp, beta } = p;
  const g = geoMuroVoladizo(p);
  const { B, B1, Hs, hk, bk, xStemF, xStemB, xTopF, xTopB, xKeyL, xKeyR } = g;
  const Ap = A + B1;
  const hCuna = Ap * Math.tan((beta * Math.PI) / 180);
  const yTop = esp + Hs;
  const yFill = yTop + hCuna;
  const hPunta = Math.max(0, D - esp);

  const relleno: Pt[] = [
    [xStemB, esp],
    [B, esp],
    [B, yFill],
    [xTopB, yFill],
    [xTopB, yTop],
  ];

  const alma: Pt[] = [
    [xStemF, esp],
    [xStemB, esp],
    [xTopB, yTop],
    [xTopF, yTop],
  ];

  const dentellon: Pt[] = hk > 0.02 ? rect(xKeyL, -hk, bk, hk) : [];

  const dims: MetradoDim[] = [
    { x1: 0, y1: 0, x2: C, y2: 0, label: `C=${C.toFixed(2)}` },
    { x1: C, y1: 0, x2: C + F, y2: 0, label: `F=${F.toFixed(2)}` },
    { x1: C + F, y1: 0, x2: B, y2: 0, label: `A=${A.toFixed(2)}` },
    { x1: 0, y1: 0, x2: 0, y2: H, label: `H=${H.toFixed(2)}` },
  ];
  if (hk > 0.02) {
    dims.push({ x1: xKeyL, y1: -hk, x2: xKeyL, y2: 0, label: `hk=${hk.toFixed(2)}` });
  }

  return {
    id: "metrado-muro-voladizo",
    title: "Identificación de zonas — metrado de pesos",
    caption:
      "Croquis de metrados por metro lineal. Cada número coincide con la fila de la tabla. El alma lleva talud (F en la base, B′ en coronación). Si el muro desliza se dispone dentellón bajo el fuste.",
    origin: "Pata (arista delantera)",
    zones: [
      { n: 1, label: "Relleno sobre talón + cuña", material: "tierra", pts: relleno },
      {
        n: 2,
        label: "Suelo sobre la puntera",
        material: "tierra",
        pts: hPunta > 0.02 ? rect(0, esp, C, hPunta) : [],
        badge: [C / 2, esp + Math.max(hPunta / 2, 0.18)],
      },
      { n: 3, label: "Zapata de concreto", material: "concreto", pts: rect(0, 0, B, esp), badge: [B * 0.42, esp * 0.5] },
      { n: 4, label: "Alma / fuste", material: "concreto", pts: alma, badge: [(xTopF + xStemB) / 2, esp + Hs * 0.55] },
      ...(hk > 0.02
        ? [{ n: 6, label: "Dentellón (taco)", material: "concreto" as const, pts: dentellon, badge: [(xKeyL + xKeyR) / 2, -hk * 0.55] as Pt }]
        : []),
    ],
    arrows: [
      {
        n: 5,
        label: "Pa,v",
        from: [B, yFill + Math.max(0.45, H * 0.08)],
        to: [B, yFill],
      },
    ],
    dims,
  };
}

/* ─── Estribo tipo pantalla ─── */

export function layoutEstriboPantallaDC(p: {
  H: number;
  B: number;
  D: number;
  Lp: number;
  tsup: number;
  tinf: number;
  N: number;
  hparap: number;
  bparap: number;
  e1: number;
  e2: number;
  t1: number;
  t2: number;
}): MetradoLayout {
  const { H, B, D, Lp, tsup, tinf, N, hparap, bparap, e1, e2, t1, t2 } = p;
  const xaBack = Lp + tinf;
  const xaFill = xaBack + t2;
  const xaParapF = xaFill - bparap;
  const xaSeatF = xaFill - bparap - N;
  const xaTrapF = xaBack - tsup;
  const hCajTop = H - hparap;
  const hCajBot = H - hparap - e1;
  const hChafBot = Math.max(D + 0.05, H - hparap - e1 - e2);
  const hTrap = Math.max(0, hChafBot - D);

  const layout: MetradoLayout = {
    id: "metrado-estribo-pantalla-dc",
    title: "Identificación de zonas — concreto DC (1 a 7)",
    caption:
      "Franja de 1,00 m. Los números 1–7 coinciden con el cuadro de metrado DC. Puntera A a la derecha (aguas); talón a la izquierda (relleno).",
    origin: "Puntera A (aguas)",
    zones: [
      {
        n: 1,
        label: "Parapeto",
        material: "concreto",
        pts: rect(xaParapF, hCajTop, bparap, hparap),
        badge: [(xaParapF + xaFill) / 2, hCajTop + hparap * 0.55],
      },
      {
        n: 2,
        label: "Cajuela",
        material: "concreto",
        pts: rect(xaSeatF, hCajBot, bparap + N, e1),
        badge: [(xaSeatF + xaFill) / 2, hCajBot + e1 * 0.55],
      },
      {
        n: 3,
        label: "Chaflán talón",
        material: "concreto",
        pts: [
          [xaBack, D],
          [xaFill, D],
          [xaFill, hCajBot],
          [xaBack, hChafBot],
        ],
        badge: [(xaBack + xaFill) / 2 + 0.12, (D + hCajBot) / 2],
      },
      {
        n: 4,
        label: "Pantalla rectangular",
        material: "concreto",
        pts: [
          [xaTrapF, hChafBot],
          [xaBack, hChafBot],
          [xaBack, hCajBot],
          [xaTrapF, hCajBot],
        ],
        badge: [(xaTrapF + xaBack) / 2, (hChafBot + hCajBot) / 2],
      },
      {
        n: 5,
        label: "Chaflán puntera",
        material: "concreto",
        pts: tri([xaTrapF, D], [Math.max(0, xaTrapF - t1), D], [xaTrapF, Math.min(D + e2, hChafBot)]),
        badge: [xaTrapF - t1 * 0.85 - 0.18, D + 0.22],
      },
      {
        n: 6,
        label: "Trapecio de talud",
        material: "concreto",
        pts:
          tinf > tsup + 1e-4 && hTrap > 1e-4
            ? [
                [Lp, D],
                [xaTrapF, D],
                [xaTrapF, hChafBot],
              ]
            : [],
        badge: [(Lp + xaTrapF) / 2 - 0.22, D + hTrap * 0.42],
      },
      {
        n: 7,
        label: "Zapata B × D",
        material: "concreto",
        pts: rect(0, 0, B, D),
        badge: [B * 0.52, D * 0.42],
      },
    ],
    dims: [
      { x1: 0, y1: 0, x2: B, y2: 0, label: `B=${B.toFixed(2)}` },
      { x1: 0, y1: 0, x2: 0, y2: H, label: `H=${H.toFixed(2)}` },
    ],
  };
  const flipX = (x: number) => B - x;
  return {
    ...layout,
    origin: "Puntera A (aguas, derecha)",
    zones: layout.zones.map((z) => ({
      ...z,
      pts: z.pts.map(([x, y]) => [flipX(x), y] as Pt),
      badge: z.badge ? ([flipX(z.badge[0]), z.badge[1]] as Pt) : undefined,
    })),
    dims: layout.dims?.map((d) => ({
      ...d,
      x1: flipX(d.x1),
      x2: flipX(d.x2),
    })),
  };
}

export function layoutEstriboPantallaEV(p: {
  H: number;
  B: number;
  D: number;
  Lp: number;
  tinf: number;
  t2: number;
  e2: number;
  hp: number;
}): MetradoLayout {
  const { H, B, D, Lp, tinf, t2, e2, hp } = p;
  const xaBack = Lp + tinf;
  const Ltalon = Math.max(0.1, B - xaBack);
  const yFillTop = H;
  return {
    id: "metrado-estribo-pantalla-ev",
    title: "Identificación de zonas — relleno EV (8 y 9)",
    caption:
      "Franja de 1,00 m. Los números 8 y 9 coinciden con el cuadro EV. LS1 es la sobrecarga equivalente sobre el talón.",
    origin: "Puntera A",
    zones: [
      {
        n: 8,
        label: "Relleno talón",
        material: "tierra",
        pts: [
          [xaBack + t2, D],
          [B, D],
          [B, yFillTop],
          [xaBack + t2, yFillTop],
        ],
      },
      {
        n: 9,
        label: "Cuña chaflán (suelo)",
        material: "tierra",
        pts: tri([xaBack, D + e2], [xaBack + t2, D], [xaBack + t2, D + e2]),
      },
      {
        n: "LS",
        label: "Sobrecarga LS1",
        material: "carga",
        pts: rect(xaBack, yFillTop, Ltalon, Math.max(hp, 0.15)),
      },
    ],
    dims: [
      { x1: xaBack, y1: 0, x2: B, y2: 0, label: `Ltalón=${Ltalon.toFixed(2)}` },
    ],
  };
}

/* ─── Estribo gravedad ─── */

export function layoutEstriboGravedadDC(p: {
  H: number;
  B: number;
  a: number;
  stem: number;
  N: number;
  tBack: number;
  bTalon: number;
  h: number;
  e: number;
  eLosa: number;
}): MetradoLayout {
  const { H, B, a, stem, N, tBack, bTalon, h, e, eLosa } = p;
  const Hstem = Math.max(0.05, H - e - h);
  const xAlma = a + stem;
  const xCaj = xAlma + N;
  return {
    id: "metrado-estribo-gravedad-dc",
    title: "Identificación de zonas — concreto DC",
    caption:
      "Cuerpos 1 a 4 del estribo de gravedad (franja 1,00 m). El número coincide con el cuadro DC. Origen en A (aguas).",
    origin: "Puntera A",
    zones: [
      {
        n: 1,
        label: "Alma triangular",
        material: "concreto",
        pts: tri([a, h], [xAlma, h], [xAlma, h + Hstem]),
      },
      { n: 2, label: "Cajuela N", material: "concreto", pts: rect(xAlma, h, N, Hstem) },
      { n: 3, label: "Asiento t", material: "concreto", pts: rect(xCaj, h, tBack, Math.max(0.05, H - h)) },
      { n: 4, label: "Zapata h·B", material: "concreto", pts: rect(0, 0, B, h) },
      {
        n: 5,
        label: "Losa de acercamiento",
        material: "concreto",
        pts: rect(B - bTalon, H - eLosa, bTalon, eLosa),
      },
    ],
    dims: [
      { x1: 0, y1: 0, x2: B, y2: 0, label: `B=${B.toFixed(2)}` },
      { x1: 0, y1: 0, x2: 0, y2: H, label: `H=${H.toFixed(2)}` },
    ],
  };
}

export function layoutEstriboGravedadEV(p: {
  H: number;
  B: number;
  a: number;
  bTalon: number;
  h: number;
  eLosa: number;
  hz: number;
  wSkew: number;
}): MetradoLayout {
  const { H, B, a, bTalon, h, eLosa, hz, wSkew } = p;
  const emb = Math.max(0, hz - h);
  const hFill = Math.max(0.05, H - eLosa - h);
  return {
    id: "metrado-estribo-gravedad-ev",
    title: "Identificación de zonas — relleno EV",
    caption:
      "Presión vertical del terreno: EV1 talón, EV2 puntera y EV3 cuña del talud. Franja 1,00 m, origen en A.",
    origin: "Puntera A",
    zones: [
      { n: 1, label: "EV1 talón", material: "tierra", pts: rect(B - bTalon, h, bTalon, hFill) },
      {
        n: 2,
        label: "EV2 puntera",
        material: "tierra",
        pts: emb > 0.02 ? rect(0, h, a, emb) : [],
        badge: [a / 2, h + Math.max(emb / 2, 0.2)],
      },
      {
        n: 3,
        label: "EV3 cuña tan S",
        material: "tierra",
        pts: wSkew > 0.02 && emb > 0.02 ? tri([a, h], [a + wSkew, h], [a, hz]) : [],
        badge: [a + wSkew * 0.25, h + emb * 0.4],
      },
    ],
  };
}

/* ─── Tanques ─── */

export function layoutTanqueCircular(p: {
  D: number;
  HL: number;
  H: number;
  tMuro: number;
  tLosa: number;
  tDomo: number;
  fDomo: number;
}): MetradoLayout {
  const { D, HL, H, tMuro, tLosa, tDomo, fDomo } = p;
  const R = D / 2;
  const y0 = tLosa;
  const yTop = y0 + H;
  const crown = sphereCrownShell(R, fDomo, yTop, tDomo, 96);
  const hAn = Math.max(0.28, tMuro + 0.1);
  const muro: Pt[] = [
    [R, y0],
    [R + tMuro, y0],
    [R + tMuro, yTop],
    [R + tMuro + 0.12, yTop],
    [R + tMuro + 0.12, yTop + hAn * 0.55],
    [R - 0.04, yTop + hAn * 0.55],
    [R - 0.04, yTop],
    [R, yTop],
  ];
  return {
    id: "metrado-tanque-circular",
    title: "Identificación de zonas — pesos propios",
    caption:
      "Media sección de la cuba circular apoyada. El muro y la cúpula se dibujan como cáscaras de espesor real; el ensanche de coronación es la viga collarín. Cada número identifica el elemento del metrado.",
    origin: "Eje del tanque",
    ground: true,
    dims: [
      { x1: R, y1: y0 + H * 0.45, x2: R + tMuro, y2: y0 + H * 0.45, label: `e=${(tMuro * 100).toFixed(0)} cm` },
    ],
    zones: [
      { n: 1, label: "Muro cilíndrico", material: "concreto", pts: muro, badge: [R + tMuro + 0.32, y0 + H * 0.55] },
      {
        n: 2,
        label: "Cúpula de techo",
        material: "concreto",
        pts: crown.closed,
        badge: [R * 0.55, yTop + fDomo + tDomo * 0.4],
      },
      { n: 3, label: "Losa de fondo", material: "concreto", pts: rect(0, 0, R + tMuro + 0.18, tLosa), badge: [R * 0.45, tLosa * 0.45] },
      { n: 4, label: "Agua almacenada", material: "agua", pts: rect(0, y0, R, HL), badge: [R * 0.42, y0 + HL * 0.45] },
    ],
  };
}

export function layoutTanqueRect(p: {
  Lx: number;
  Ly: number;
  HL: number;
  H: number;
  tMuro: number;
  tTecho: number;
  tLosa: number;
}): MetradoLayout {
  const { Ly, HL, H, tMuro, tTecho, tLosa } = p;
  const L = Ly;
  const y0 = tLosa;
  const yTop = y0 + H;
  return {
    id: "metrado-tanque-rect",
    title: "Identificación de zonas — pesos propios",
    caption:
      "Corte transversal (luz corta Ly). Se ven ambos muros, la losa de techo, la losa de fondo y el agua. Cada número identifica el elemento del metrado.",
    origin: "Eje del corte",
    ground: true,
    dims: [
      { x1: -tMuro, y1: y0 + H * 0.5, x2: 0, y2: y0 + H * 0.5, label: `e=${(tMuro * 100).toFixed(0)} cm` },
    ],
    zones: [
      { n: 1, label: "Muros perimetrales", material: "concreto", pts: rect(-tMuro, y0, tMuro, H), badge: [-tMuro - 0.22, y0 + H * 0.55] },
      { n: 1, label: "Muros perimetrales", material: "concreto", pts: rect(L, y0, tMuro, H), badge: [L + tMuro + 0.22, y0 + H * 0.55] },
      { n: 2, label: "Losa de techo", material: "concreto", pts: rect(-tMuro, yTop, L + 2 * tMuro, tTecho), badge: [L * 0.5, yTop + tTecho * 0.55] },
      { n: 3, label: "Losa de fondo", material: "concreto", pts: rect(-tMuro, 0, L + 2 * tMuro, tLosa), badge: [L * 0.5, tLosa * 0.45] },
      { n: 4, label: "Agua almacenada", material: "agua", pts: rect(0, y0, L, HL), badge: [L * 0.5, y0 + HL * 0.45] },
    ],
  };
}

export function layoutTanqueIntze(p: {
  R: number;
  rp: number;
  h1: number;
  hCono: number;
  fInf: number;
  fSup?: number;
  tMuro: number;
  tDomoInf?: number;
  tDomoSup?: number;
  HL: number;
}): MetradoLayout {
  const { R, rp, h1, hCono, fInf, tMuro, HL } = p;
  const fSup = p.fSup ?? R / 6;
  const tInf = p.tDomoInf ?? Math.max(0.12, tMuro * 0.4);
  const tSup = p.tDomoSup ?? Math.max(0.08, tMuro * 0.25);
  const yCono = fInf;
  const yCil = fInf + hCono;
  const yTop = yCil + h1;
  const yWater = yCil + Math.min(Math.max(HL - hCono * 0.35, h1 * 0.92), h1);

  const bowl = sphereBowlShell(rp, fInf, tInf, 96);
  const crown = sphereCrownShell(R, fSup, yTop, tSup, 96);

  const Ls = Math.hypot(R - rp, hCono) || 1;
  const nx = hCono / Ls;
  const ny = -(R - rp) / Ls;
  const cone: Pt[] = [
    [rp, yCono],
    [R, yCil],
    [R + tMuro, yCil],
    [rp + tMuro * nx, yCono + tMuro * ny],
  ];

  const bAn = 0.3;
  const hAn = 0.4;
  const anilloInf: Pt[] = [
    [rp - 0.04, yCono - hAn * 0.35],
    [rp + bAn, yCono - hAn * 0.35],
    [rp + bAn, yCono + hAn * 0.65],
    [rp - 0.04, yCono + hAn * 0.65],
  ];
  const anilloSup: Pt[] = rect(R - 0.04, yCil - 0.12, tMuro + 0.24, 0.28);

  const water: Pt[] = [
    ...bowl.inner,
    [R, yCil],
    [R, yWater],
    [0, yWater],
  ];

  const ringOuter = bowl.outer[bowl.outer.length - 1];
  return {
    id: "metrado-tanque-intze",
    title: "Identificación de zonas — pesos de la cuba INTZE",
    caption:
      "Media sección de la cuba tipo INTZE (eje de revolución a la izquierda). Cada cáscara se dibuja con su espesor real: pared cilíndrica, tronco de cono, cúpulas esféricas concéntricas y anillos. El n.º coincide con la tabla de metrado.",
    origin: "Eje de la cuba",
    ground: false,
    dims: [
      {
        x1: ringOuter[0],
        y1: ringOuter[1],
        x2: rp,
        y2: yCono,
        label: `e inf.=${(tInf * 100).toFixed(0)} cm`,
      },
      {
        x1: R,
        y1: yCil + h1 * 0.5,
        x2: R + tMuro,
        y2: yCil + h1 * 0.5,
        label: `e=${(tMuro * 100).toFixed(0)} cm`,
      },
    ],
    zones: [
      { n: 1, label: "Pared cilíndrica", material: "concreto", pts: rect(R, yCil, tMuro, h1), badge: [R + tMuro + 0.35, yCil + h1 * 0.55] },
      { n: 2, label: "Fondo cónico", material: "concreto", pts: cone, badge: [(R + rp) / 2 + tMuro + 0.32, yCono + hCono * 0.55] },
      {
        n: 3,
        label: "Cúpula superior",
        material: "concreto",
        pts: crown.closed,
        badge: [R * 0.52, yTop + fSup * 0.62],
      },
      {
        n: 4,
        label: "Cúpula inferior",
        material: "concreto",
        pts: bowl.closed,
        badge: [rp * 0.48, fInf * 0.42],
      },
      { n: 5, label: "Anillo inf. (inflexión)", material: "concreto", pts: anilloInf, badge: [rp + bAn + 0.28, yCono + 0.06] },
      { n: 6, label: "Anillo superior", material: "concreto", pts: anilloSup, badge: [R + tMuro + 0.42, yCil + 0.16] },
      {
        n: 7,
        label: "Agua almacenada",
        material: "agua",
        pts: water,
        badge: [R * 0.38, yCil + Math.min(h1, Math.max(0.4, yWater - yCil)) * 0.48],
      },
    ],
  };
}
