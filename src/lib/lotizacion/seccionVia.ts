/**
 * Corte transversal de vía para expediente: paquetes con trama, sardinel,
 * bombeo y cotas. La vertical del pavimento se exagera para que el espesor
 * se lea; las cotas siguen en metros reales.
 */
import { anchoSeccion, partesDeSeccion } from "./norma";
import type { DxfDoc } from "./dxf";
import type { Pavimento, Seccion } from "./tipos";

type Pt = { x: number; y: number };

type Prim =
  | { k: "poly"; pts: Pt[]; fill: string; stroke: string; sw: number }
  | { k: "line"; a: Pt; b: Pt; stroke: string; sw: number }
  | { k: "circ"; c: Pt; r: number; fill: string; stroke: string; sw: number }
  | { k: "text"; p: Pt; text: string; size: number; fill: string; anchor: "start" | "middle" | "end" };

export type DibujoSeccion = {
  viewBox: string;
  body: string;
  ancho: number;
  alto: number;
  prims: Prim[];
};

const INK = "#1c1c1c";
const VE = 4;
const BOMBEO = 0.02;

function nPav(p: Pavimento): Pavimento {
  const z = (v: number, d: number) => (Number.isFinite(v) && v >= 0 ? v : d);
  return {
    carpeta: z(p.carpeta, 0.05),
    base: z(p.base, 0.2),
    subbase: z(p.subbase, 0.25),
    veredaEsp: z(p.veredaEsp, 0.1),
    sardinel: z(p.sardinel, 0.15),
  };
}

function fmt(m: number): string {
  return m.toFixed(2);
}

function line(out: Prim[], a: Pt, b: Pt, sw = 0.012, stroke = INK) {
  out.push({ k: "line", a, b, stroke, sw });
}

function poly(out: Prim[], pts: Pt[], fill: string, sw = 0.014) {
  out.push({ k: "poly", pts, fill, stroke: INK, sw });
}

function txt(out: Prim[], x: number, y: number, text: string, size: number, anchor: "start" | "middle" | "end" = "middle") {
  out.push({ k: "text", p: { x, y }, text, size, fill: INK, anchor });
}

function trama(out: Prim[], x: number, y0: number, w: number, h: number, paso: number, ang: number) {
  if (w < 0.05 || h < 0.04) return;
  const rad = (ang * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const px = -dy;
  const py = dx;
  const alcance = Math.hypot(w, h);
  const n = Math.ceil(alcance / paso);
  const cx = x + w / 2;
  const cy = y0 + h / 2;
  for (let i = -n; i <= n; i++) {
    const ox = cx + px * i * paso;
    const oy = cy + py * i * paso;
    const hits: Pt[] = [];
    const bordes: [Pt, Pt][] = [
      [{ x, y: y0 }, { x: x + w, y: y0 }],
      [{ x: x + w, y: y0 }, { x: x + w, y: y0 + h }],
      [{ x: x + w, y: y0 + h }, { x, y: y0 + h }],
      [{ x, y: y0 + h }, { x, y: y0 }],
    ];
    for (const [p, q] of bordes) {
      const rx = q.x - p.x;
      const ry = q.y - p.y;
      const den = dx * ry - dy * rx;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((p.x - ox) * ry - (p.y - oy) * rx) / den;
      const u = ((p.x - ox) * dy - (p.y - oy) * dx) / den;
      if (u >= -1e-6 && u <= 1 + 1e-6) hits.push({ x: ox + dx * t, y: oy + dy * t });
    }
    if (hits.length >= 2) line(out, hits[0], hits[1], 0.008, "#5c564c");
  }
}

function cotaH(out: Prim[], x0: number, x1: number, y: number, label: string) {
  if (x1 - x0 < 0.05) return;
  const t = 0.07;
  line(out, { x: x0, y: y + 0.28 }, { x: x0, y: y - 0.08 }, 0.01);
  line(out, { x: x1, y: y + 0.28 }, { x: x1, y: y - 0.08 }, 0.01);
  line(out, { x: x0, y }, { x: x1, y }, 0.012);
  line(out, { x: x0 - t, y: y + t }, { x: x0 + t, y: y - t }, 0.012);
  line(out, { x: x1 - t, y: y + t }, { x: x1 + t, y: y - t }, 0.012);
  txt(out, (x0 + x1) / 2, y + 0.06, label, Math.min(0.2, Math.max(0.11, (x1 - x0) * 0.22)));
}

function cotaV(out: Prim[], x: number, y0: number, y1: number, label: string) {
  const lo = Math.min(y0, y1);
  const hi = Math.max(y0, y1);
  if (hi - lo < 0.04) return;
  const t = 0.05;
  line(out, { x: x - 0.22, y: lo }, { x: x + 0.06, y: lo }, 0.01);
  line(out, { x: x - 0.22, y: hi }, { x: x + 0.06, y: hi }, 0.01);
  line(out, { x, y: lo }, { x, y: hi }, 0.012);
  line(out, { x: x - t, y: lo + t }, { x: x + t, y: lo - t }, 0.012);
  line(out, { x: x - t, y: hi + t }, { x: x + t, y: hi - t }, 0.012);
  txt(out, x - 0.1, (lo + hi) / 2, label, 0.13, "end");
}

function persona(ox: number, pies: number, out: Prim[]) {
  const y = (h: number) => pies + h;
  poly(out, [
    { x: ox - 0.11, y: y(0) },
    { x: ox - 0.04, y: y(0.72) },
    { x: ox + 0.04, y: y(0.72) },
    { x: ox + 0.13, y: y(0) },
    { x: ox + 0.05, y: y(0) },
    { x: ox + 0.02, y: y(0.62) },
    { x: ox - 0.03, y: y(0.62) },
    { x: ox - 0.04, y: y(0) },
  ], "#f4f1ea", 0.016);
  poly(out, [
    { x: ox - 0.16, y: y(0.95) },
    { x: ox - 0.05, y: y(1.22) },
    { x: ox + 0.05, y: y(1.22) },
    { x: ox + 0.18, y: y(0.92) },
    { x: ox + 0.08, y: y(0.78) },
    { x: ox - 0.08, y: y(0.78) },
  ], "#f4f1ea", 0.016);
  out.push({ k: "circ", c: { x: ox, y: y(1.38) }, r: 0.11, fill: "#f4f1ea", stroke: INK, sw: 0.016 });
  line(out, { x: ox - 0.02, y: y(1.18) }, { x: ox - 0.22, y: y(0.82) }, 0.016);
  line(out, { x: ox + 0.04, y: y(1.16) }, { x: ox + 0.2, y: y(0.86) }, 0.016);
}

function carroFrente(cx: number, rasante: number, anchoCarril: number, out: Prim[]) {
  const w = Math.min(1.65, Math.max(1.05, anchoCarril * 0.62));
  const h = 1.15 * (w / 1.65);
  const r = 0.22 * (w / 1.65);
  const x0 = cx - w / 2;
  const y0 = rasante;
  poly(out, [
    { x: x0 + w * 0.06, y: y0 + r * 0.85 },
    { x: x0 + w * 0.06, y: y0 + h * 0.48 },
    { x: x0 + w * 0.22, y: y0 + h * 0.78 },
    { x: x0 + w * 0.78, y: y0 + h * 0.78 },
    { x: x0 + w * 0.94, y: y0 + h * 0.48 },
    { x: x0 + w * 0.94, y: y0 + r * 0.85 },
  ], "#f7f7f7", 0.02);
  poly(out, [
    { x: x0 + w * 0.28, y: y0 + h * 0.5 },
    { x: x0 + w * 0.36, y: y0 + h * 0.72 },
    { x: x0 + w * 0.64, y: y0 + h * 0.72 },
    { x: x0 + w * 0.72, y: y0 + h * 0.5 },
  ], "#d5dde6", 0.012);
  out.push({ k: "circ", c: { x: x0 + w * 0.24, y: y0 + r }, r, fill: "#2a2a2a", stroke: INK, sw: 0.016 });
  out.push({ k: "circ", c: { x: x0 + w * 0.76, y: y0 + r }, r, fill: "#2a2a2a", stroke: INK, sw: 0.016 });
  out.push({ k: "circ", c: { x: x0 + w * 0.24, y: y0 + r }, r: r * 0.45, fill: "#cfcfcf", stroke: INK, sw: 0.01 });
  out.push({ k: "circ", c: { x: x0 + w * 0.76, y: y0 + r }, r: r * 0.45, fill: "#cfcfcf", stroke: INK, sw: 0.01 });
}

function pendiente(out: Prim[], x0: number, x1: number, y: number) {
  const mid = (x0 + x1) / 2;
  const punta = x1 > x0 ? x1 - 0.15 : x1 + 0.15;
  line(out, { x: x0, y: y + 0.22 }, { x: mid, y: y + 0.22 }, 0.012);
  line(out, { x: mid, y: y + 0.22 }, { x: punta, y: y + 0.05 }, 0.012);
  txt(out, mid, y + 0.28, "2%", 0.13);
}

export function construirSeccion(sec: Seccion, pavIn: Pavimento, titulo: string, via: string, lateral?: "estacionamiento" | "jardin"): DibujoSeccion {
  const pav = nPav(pavIn);
  const partes = partesDeSeccion(sec).map((p) =>
    lateral === "jardin" && p.tipo === "estacionamiento" ? { ...p, tipo: "jardin" as const, etiqueta: "Jardín" } : p,
  );
  const W = Math.max(anchoSeccion(sec), 0.5);
  const eCar = pav.carpeta * VE;
  const eBas = pav.base * VE;
  const eSub = pav.subbase * VE;
  const eVer = Math.max(pav.veredaEsp, 0.08) * VE;
  const hSard = Math.max(pav.sardinel, 0.12) * VE;
  const prof = eCar + eBas + eSub;
  const tierra = 0.55;
  const ml = 2.15;
  const mr = 0.45;
  const baseCotas = prof + tierra + 0.35;
  const techo = hSard + 1.85;
  const ancho = ml + W + mr;
  const out: Prim[] = [];
  const x0 = ml;
  const yTierra = -(prof + tierra);

  poly(out, [
    { x: x0 - 0.15, y: -prof },
    { x: x0 + W + 0.15, y: -prof },
    { x: x0 + W + 0.15, y: yTierra },
    { x: x0 - 0.15, y: yTierra },
  ], "#efe6d2", 0.012);
  trama(out, x0 - 0.15, yTierra, W + 0.3, tierra, 0.16, 50);
  line(out, { x: x0 - 0.2, y: -prof }, { x: x0 + W + 0.2, y: -prof }, 0.02);
  txt(out, x0 + W + 0.08, -prof + 0.04, "SR", 0.12, "start");

  let x = x0;
  let cotaPavimento = false;
  for (const parte of partes) {
    const w = parte.ancho;
    if (parte.tipo === "vereda") {
      poly(out, [
        { x, y: hSard },
        { x: x + w, y: hSard },
        { x: x + w, y: hSard - eVer },
        { x, y: hSard - eVer },
      ], "#f3efe6", 0.016);
      trama(out, x, hSard - eVer, w, eVer, 0.1, 45);
      persona(x + w * 0.42, hSard, out);
      txt(out, x + w / 2, hSard + 1.62, "VEREDA", 0.13);
    } else if (parte.tipo === "jardin") {
      poly(out, [
        { x, y: 0.08 },
        { x: x + w, y: 0.08 },
        { x: x + w, y: -0.22 },
        { x, y: -0.22 },
      ], "#d5e0c8", 0.014);
      trama(out, x, -0.22, w, 0.3, 0.1, -35);
      const mx = x + w / 2;
      out.push({ k: "circ", c: { x: mx, y: 0.42 }, r: Math.min(0.28, w * 0.28), fill: "#6f8f5a", stroke: INK, sw: 0.012 });
      line(out, { x: mx, y: 0.08 }, { x: mx, y: 0.22 }, 0.016, "#5c4030");
      txt(out, mx, 0.78, "JARDÍN", 0.12);
    } else if (parte.tipo === "separador") {
      poly(out, [
        { x, y: 0.12 },
        { x: x + w, y: 0.12 },
        { x: x + w, y: -0.28 },
        { x, y: -0.28 },
      ], "#d7e2cc", 0.014);
      trama(out, x, -0.28, w, 0.4, 0.1, 60);
      txt(out, x + w / 2, 0.28, "SEPARADOR", 0.12);
    } else {
      const esCalzada = parte.tipo === "calzada";
      const corona = esCalzada ? Math.max(w * BOMBEO * VE, 0.1) : Math.max(w * BOMBEO * VE * 0.5, 0.06);
      const yL = 0;
      const yR = 0;
      const yC = corona;
      poly(out, [
        { x, y: yL },
        { x: x + w / 2, y: yC },
        { x: x + w, y: yR },
        { x: x + w, y: yR - eCar },
        { x: x + w / 2, y: yC - eCar },
        { x, y: yL - eCar },
      ], "#3d3d3d", 0.014);
      poly(out, [
        { x, y: -eCar },
        { x: x + w, y: -eCar },
        { x: x + w, y: -eCar - eBas },
        { x, y: -eCar - eBas },
      ], "#b7b1a6", 0.012);
      trama(out, x, -eCar - eBas, w, eBas, 0.14, -50);
      poly(out, [
        { x, y: -eCar - eBas },
        { x: x + w, y: -eCar - eBas },
        { x: x + w, y: -prof },
        { x, y: -prof },
      ], "#c8b48a", 0.012);
      trama(out, x, -prof, w, eSub, 0.18, 25);
      const n = Math.max(1, Math.round(w / Math.max(sec.moduloCalzada, 0.5)));
      const carril = w / n;
      for (let i = 0; i < n; i++) carroFrente(x + carril * (i + 0.5), corona * 0.35, carril, out);
      if (esCalzada) {
        line(out, { x: x + w / 2, y: corona + 0.05 }, { x: x + w / 2, y: -prof }, 0.01, "#8a8a8a");
        pendiente(out, x + w / 2, x + 0.35, corona);
        pendiente(out, x + w / 2, x + w - 0.35, corona);
        txt(out, x + w / 2, corona + 1.35, "CALZADA", 0.14);
      } else {
        txt(out, x + w / 2, corona + 1.35, "ESTAC.", 0.13);
      }
      if (!cotaPavimento) {
        cotaPavimento = true;
        let y = 0;
        const filas: [string, number, number][] = [
          [`e=${fmt(pav.carpeta)}`, eCar, 0],
          [`e=${fmt(pav.base)}`, eBas, eCar],
          [`e=${fmt(pav.subbase)}`, eSub, eCar + eBas],
        ];
        for (const [label, h] of filas) {
          if (h < 0.03) continue;
          cotaV(out, x - 0.35, y, y - h, label);
          y -= h;
        }
        txt(out, x - 1.55, -eCar / 2, "Carpeta", 0.12, "start");
        txt(out, x - 1.55, -eCar - eBas / 2, "Base", 0.12, "start");
        txt(out, x - 1.55, -eCar - eBas - eSub / 2, "Subbase", 0.12, "start");
      }
    }
    x += w;
  }

  let cursor = x0;
  const sardAncho = 0.16;
  for (let i = 0; i < partes.length; i++) {
    const parte = partes[i];
    const next = partes[i + 1];
    const juntaVereda = parte.tipo === "vereda" || next?.tipo === "vereda";
    if (juntaVereda && pav.sardinel > 0.01) {
      const enBordeDer = parte.tipo === "vereda";
      const sx = enBordeDer ? cursor + parte.ancho - sardAncho : cursor;
      if (sx >= x0 - 0.01 && sx + sardAncho <= x0 + W + 0.01) {
        poly(out, [
          { x: sx, y: 0 },
          { x: sx + sardAncho, y: 0 },
          { x: sx + sardAncho, y: hSard },
          { x: sx, y: hSard },
        ], "#e4ddd0", 0.016);
        trama(out, sx, 0, sardAncho, hSard, 0.07, 45);
      }
    }
    cursor += parte.ancho;
  }

  line(out, { x: x0, y: 0 }, { x: x0 + W, y: 0 }, 0.01, "#9a9a9a");

  let dx = x0;
  for (const parte of partes) {
    cotaH(out, dx, dx + parte.ancho, -(baseCotas - 0.15), fmt(parte.ancho));
    dx += parte.ancho;
  }
  cotaH(out, x0, x0 + W, -(baseCotas + 0.55), `SECCIÓN  ${fmt(W)} m`);

  line(out, { x: 0.15, y: -baseCotas - 0.95 }, { x: ancho - 0.15, y: -baseCotas - 0.95 }, 0.02);
  line(out, { x: 0.15, y: -baseCotas - 0.95 }, { x: 0.15, y: techo - 0.12 }, 0.02);
  line(out, { x: ancho - 0.15, y: -baseCotas - 0.95 }, { x: ancho - 0.15, y: techo - 0.12 }, 0.02);
  line(out, { x: 0.15, y: techo - 0.12 }, { x: ancho - 0.15, y: techo - 0.12 }, 0.02);
  txt(out, x0 + W / 2, techo - 0.42, titulo, 0.28);
  txt(out, x0 + W / 2, techo - 0.72, via, 0.16);
  txt(out, x0 + W / 2, techo - 0.98, "Cotas en metros  ·  bombeo de calzada 2%  ·  vertical de pavimento ×4", 0.11);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const toma = (q: Pt) => {
    minX = Math.min(minX, q.x);
    minY = Math.min(minY, q.y);
    maxX = Math.max(maxX, q.x);
    maxY = Math.max(maxY, q.y);
  };
  for (const p of out) {
    if (p.k === "poly") p.pts.forEach(toma);
    else if (p.k === "line") { toma(p.a); toma(p.b); }
    else if (p.k === "circ") { toma({ x: p.c.x - p.r, y: p.c.y - p.r }); toma({ x: p.c.x + p.r, y: p.c.y + p.r }); }
    else toma(p.p);
  }
  const pad = 0.12;
  const dx0 = pad - minX;
  const dy0 = pad - minY;
  const mover = (q: Pt) => ({ x: q.x + dx0, y: q.y + dy0 });
  for (const p of out) {
    if (p.k === "poly") p.pts = p.pts.map(mover);
    else if (p.k === "line") { p.a = mover(p.a); p.b = mover(p.b); }
    else if (p.k === "circ") p.c = mover(p.c);
    else p.p = mover(p.p);
  }
  const anchoHoja = maxX - minX + pad * 2;
  const altoHoja = maxY - minY + pad * 2;
  const body = primsASvg(out, altoHoja);
  return { viewBox: `0 0 ${anchoHoja.toFixed(3)} ${altoHoja.toFixed(3)}`, body, ancho: anchoHoja, alto: altoHoja, prims: out };
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function primsASvg(prims: Prim[], alto: number): string {
  const yOf = (v: number) => (alto - v).toFixed(3);
  return prims
    .map((p) => {
      if (p.k === "poly") {
        const pts = p.pts.map((q) => `${q.x.toFixed(3)},${yOf(q.y)}`).join(" ");
        return `<polygon points="${pts}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.sw}" stroke-linejoin="miter" />`;
      }
      if (p.k === "line") {
        return `<line x1="${p.a.x.toFixed(3)}" y1="${yOf(p.a.y)}" x2="${p.b.x.toFixed(3)}" y2="${yOf(p.b.y)}" stroke="${p.stroke}" stroke-width="${p.sw}" />`;
      }
      if (p.k === "circ") {
        return `<circle cx="${p.c.x.toFixed(3)}" cy="${yOf(p.c.y)}" r="${p.r.toFixed(3)}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.sw}" />`;
      }
      return `<text x="${p.p.x.toFixed(3)}" y="${yOf(p.p.y)}" font-size="${p.size.toFixed(3)}" text-anchor="${p.anchor}" fill="${p.fill}" font-family="Arial, Helvetica, sans-serif">${esc(p.text)}</text>`;
    })
    .join("");
}

export function svgSeccion(sec: Seccion, pav: Pavimento, titulo: string, via: string, lateral?: "estacionamiento" | "jardin"): DibujoSeccion {
  return construirSeccion(sec, pav, titulo, via, lateral);
}

export function dxfDeSeccion(
  doc: DxfDoc,
  sec: Seccion,
  pav: Pavimento,
  titulo: string,
  via: string,
  ox: number,
  oy: number,
  lateral?: "estacionamiento" | "jardin",
  escala = 1,
): void {
  const d = construirSeccion(sec, pav, titulo, via, lateral);
  const s = escala > 0 ? escala : 1;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + y * s;
  for (const p of d.prims) {
    if (p.k === "poly" && p.pts.length >= 2) {
      doc.polilinea(
        "MC-SECCION",
        p.pts.map((q) => ({ x: X(q.x), y: Y(q.y) })),
        p.pts.length >= 3,
        p.fill !== "none" ? p.fill : "",
      );
    } else if (p.k === "line") {
      doc.linea("MC-SECCION", { x: X(p.a.x), y: Y(p.a.y) }, { x: X(p.b.x), y: Y(p.b.y) });
    } else if (p.k === "circ") {
      const capa = p.r > 0.18 * s || p.r > 0.18 ? "MC-VEHICULO" : "MC-PERSONA";
      doc.circulo(capa, { x: X(p.c.x), y: Y(p.c.y) }, p.r * s);
    } else if (p.k === "text") {
      doc.texto("MC-SECCION", X(p.p.x), Y(p.p.y), Math.max(0.12, p.size * s), p.text, p.fill);
    }
  }
}
