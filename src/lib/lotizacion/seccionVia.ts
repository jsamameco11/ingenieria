/**
 * Cortes de vía: rasante, carpetas editables, persona en línea y vehículo a escala.
 * Lo usan el plano, el PDF A1 y el DXF. Cotas en metros.
 */
import { anchoSeccion, partesDeSeccion } from "./norma";
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

function persona(ox: number, pies: number, out: Prim[]) {
  const y = (h: number) => pies + h;
  const ink = "#1a1a1a";
  out.push({ k: "circ", c: { x: ox, y: y(1.63) }, r: 0.11, fill: "none", stroke: ink, sw: 0.02 });
  out.push({ k: "line", a: { x: ox, y: y(1.52) }, b: { x: ox, y: y(0.98) }, stroke: ink, sw: 0.028 });
  out.push({ k: "line", a: { x: ox, y: y(1.38) }, b: { x: ox - 0.32, y: y(1.08) }, stroke: ink, sw: 0.022 });
  out.push({ k: "line", a: { x: ox, y: y(1.38) }, b: { x: ox + 0.26, y: y(1.14) }, stroke: ink, sw: 0.022 });
  out.push({ k: "line", a: { x: ox, y: y(0.98) }, b: { x: ox - 0.18, y: y(0) }, stroke: ink, sw: 0.024 });
  out.push({ k: "line", a: { x: ox, y: y(0.98) }, b: { x: ox + 0.2, y: y(0) }, stroke: ink, sw: 0.024 });
}

function carroFrente(cx: number, rasante: number, anchoCarril: number, out: Prim[]) {
  const w = Math.min(1.7, Math.max(0.9, anchoCarril * 0.72));
  const h = 1.45 * (w / 1.7);
  const r = 0.28 * (w / 1.7);
  const x0 = cx - w / 2;
  const y0 = rasante + r * 0.15;
  const ink = "#1a1a1a";
  out.push({
    k: "poly",
    pts: [
      { x: x0 + w * 0.08, y: y0 + r },
      { x: x0 + w * 0.08, y: y0 + h * 0.42 },
      { x: x0 + w * 0.22, y: y0 + h * 0.72 },
      { x: x0 + w * 0.78, y: y0 + h * 0.72 },
      { x: x0 + w * 0.92, y: y0 + h * 0.42 },
      { x: x0 + w * 0.92, y: y0 + r },
    ],
    fill: "none",
    stroke: ink,
    sw: 0.03,
  });
  out.push({
    k: "poly",
    pts: [
      { x: x0 + w * 0.28, y: y0 + h * 0.46 },
      { x: x0 + w * 0.36, y: y0 + h * 0.66 },
      { x: x0 + w * 0.64, y: y0 + h * 0.66 },
      { x: x0 + w * 0.72, y: y0 + h * 0.46 },
    ],
    fill: "none",
    stroke: ink,
    sw: 0.02,
  });
  out.push({ k: "circ", c: { x: x0 + w * 0.22, y: y0 + r }, r, fill: "none", stroke: ink, sw: 0.025 });
  out.push({ k: "circ", c: { x: x0 + w * 0.78, y: y0 + r }, r, fill: "none", stroke: ink, sw: 0.025 });
}

function capasCalzada(x: number, w: number, ras: number, pav: Pavimento, out: Prim[]) {
  const capas = [
    { h: pav.carpeta, fill: "#3a3a3a", nombre: "Carpeta" },
    { h: pav.base, fill: "#8a8a8a", nombre: "Base" },
    { h: pav.subbase, fill: "#c2b295", nombre: "Subbase" },
  ];
  let y = ras;
  for (const c of capas) {
    if (c.h < 0.005) continue;
    out.push({
      k: "poly",
      pts: [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y - c.h },
        { x, y: y - c.h },
      ],
      fill: c.fill,
      stroke: "#1a1a1a",
      sw: 0.015,
    });
    y -= c.h;
  }
  return y;
}

export function construirSeccion(sec: Seccion, pavIn: Pavimento, titulo: string, via: string): DibujoSeccion {
  const pav = nPav(pavIn);
  const partes = partesDeSeccion(sec);
  const W = Math.max(anchoSeccion(sec), 0.5);
  const prof = pav.carpeta + pav.base + pav.subbase;
  const margenX = 1.6;
  const techo = pav.sardinel + 2.15;
  const suelo = prof + 1.35;
  const alto = techo + suelo;
  const ancho = W + margenX + 0.8;
  const out: Prim[] = [];
  const rasVereda = pav.sardinel;
  let x = margenX;
  let primeraCalzada = true;
  for (const parte of partes) {
    if (parte.tipo === "vereda") {
      const y0 = rasVereda;
      const y1 = y0 - Math.max(pav.veredaEsp, 0.02);
      out.push({
        k: "poly",
        pts: [
          { x, y: y0 },
          { x: x + parte.ancho, y: y0 },
          { x: x + parte.ancho, y: y1 },
          { x, y: y1 },
        ],
        fill: "#efe6d6",
        stroke: "#1a1a1a",
        sw: 0.02,
      });
      persona(x + parte.ancho * 0.45, y0, out);
    } else if (parte.tipo === "separador") {
      out.push({
        k: "poly",
        pts: [
          { x, y: 0.04 },
          { x: x + parte.ancho, y: 0.04 },
          { x: x + parte.ancho, y: -0.25 },
          { x, y: -0.25 },
        ],
        fill: "#c5d4b8",
        stroke: "#1a1a1a",
        sw: 0.015,
      });
    } else {
      capasCalzada(x, parte.ancho, 0, pav, out);
      if (parte.tipo === "calzada") {
        const n = Math.max(1, Math.round(parte.ancho / Math.max(sec.moduloCalzada, 0.5)));
        const carril = parte.ancho / n;
        for (let i = 0; i < n; i++) carroFrente(x + carril * (i + 0.5), 0, carril, out);
        if (primeraCalzada) {
          primeraCalzada = false;
          let y = 0;
          const etiquetas = [
            ["Carpeta", pav.carpeta],
            ["Base", pav.base],
            ["Subbase", pav.subbase],
          ] as const;
          for (const [nombre, h] of etiquetas) {
            if (h < 0.005) continue;
            const ym = y - h / 2;
            out.push({ k: "line", a: { x: x - 0.15, y: ym }, b: { x: margenX - 0.35, y: ym }, stroke: "#1a1a1a", sw: 0.012 });
            out.push({
              k: "text",
              p: { x: 0.08, y: ym },
              text: `${nombre} ${h.toFixed(2)} m`,
              size: 0.16,
              fill: "#1a1a1a",
              anchor: "start",
            });
            y -= h;
          }
        }
      }
    }
    out.push({
      k: "text",
      p: { x: x + parte.ancho / 2, y: -prof - 0.28 },
      text: parte.etiqueta,
      size: 0.16,
      fill: "#1a1a1a",
      anchor: "middle",
    });
    out.push({
      k: "text",
      p: { x: x + parte.ancho / 2, y: -prof - 0.52 },
      text: `${parte.ancho.toFixed(2)} m`,
      size: 0.15,
      fill: "#1a1a1a",
      anchor: "middle",
    });
    out.push({ k: "line", a: { x, y: -prof - 0.08 }, b: { x, y: -prof - 0.7 }, stroke: "#1a1a1a", sw: 0.012 });
    x += parte.ancho;
  }
  out.push({ k: "line", a: { x, y: -prof - 0.08 }, b: { x, y: -prof - 0.7 }, stroke: "#1a1a1a", sw: 0.012 });
  out.push({ k: "line", a: { x: margenX, y: -prof - 0.7 }, b: { x: margenX + W, y: -prof - 0.7 }, stroke: "#1a1a1a", sw: 0.015 });
  out.push({
    k: "text",
    p: { x: margenX + W / 2, y: -prof - 0.95 },
    text: `Sección ${W.toFixed(2)} m`,
    size: 0.18,
    fill: "#1a1a1a",
    anchor: "middle",
  });

  let cursor = margenX;
  for (let i = 0; i < partes.length; i++) {
    const parte = partes[i];
    const junta = i < partes.length - 1 && (parte.tipo === "vereda" || partes[i + 1].tipo === "vereda");
    if (parte.tipo === "vereda" && pav.sardinel > 0.01) {
      const lado = i === 0 ? cursor + parte.ancho - 0.08 : cursor;
      const sx = i === 0 ? lado : lado;
      out.push({
        k: "poly",
        pts: [
          { x: sx, y: 0 },
          { x: sx + 0.12, y: 0 },
          { x: sx + 0.12, y: pav.sardinel },
          { x: sx, y: pav.sardinel },
        ],
        fill: "#d9d3c7",
        stroke: "#1a1a1a",
        sw: 0.015,
      });
    }
    if (junta && parte.tipo !== "vereda" && partes[i + 1]?.tipo === "vereda" && pav.sardinel > 0.01) {
      const sx = cursor + parte.ancho - 0.12;
      out.push({
        k: "poly",
        pts: [
          { x: sx, y: 0 },
          { x: sx + 0.12, y: 0 },
          { x: sx + 0.12, y: pav.sardinel },
          { x: sx, y: pav.sardinel },
        ],
        fill: "#d9d3c7",
        stroke: "#1a1a1a",
        sw: 0.015,
      });
    }
    cursor += parte.ancho;
  }

  out.push({
    k: "text",
    p: { x: margenX + W / 2, y: techo - 0.15 },
    text: titulo,
    size: 0.28,
    fill: "#1a1a1a",
    anchor: "middle",
  });
  out.push({
    k: "text",
    p: { x: margenX + W / 2, y: techo - 0.48 },
    text: via,
    size: 0.16,
    fill: "#333",
    anchor: "middle",
  });
  out.push({ k: "line", a: { x: margenX, y: 0 }, b: { x: margenX + W, y: 0 }, stroke: "#1a1a1a", sw: 0.02 });

  const body = primsASvg(out, alto);
  return { viewBox: `0 0 ${ancho.toFixed(3)} ${alto.toFixed(3)}`, body, ancho, alto, prims: out };
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function primsASvg(prims: Prim[], alto: number): string {
  const y = (v: number) => (alto - v).toFixed(3);
  return prims
    .map((p) => {
      if (p.k === "poly") {
        const pts = p.pts.map((q) => `${q.x.toFixed(3)},${y(q.y)}`).join(" ");
        return `<polygon points="${pts}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.sw}" stroke-linejoin="round" />`;
      }
      if (p.k === "line") {
        return `<line x1="${p.a.x.toFixed(3)}" y1="${y(p.a.y)}" x2="${p.b.x.toFixed(3)}" y2="${y(p.b.y)}" stroke="${p.stroke}" stroke-width="${p.sw}" />`;
      }
      if (p.k === "circ") {
        return `<circle cx="${p.c.x.toFixed(3)}" cy="${y(p.c.y)}" r="${p.r.toFixed(3)}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.sw}" />`;
      }
      return `<text x="${p.p.x.toFixed(3)}" y="${y(p.p.y)}" font-size="${p.size.toFixed(3)}" text-anchor="${p.anchor}" fill="${p.fill}" font-family="Arial, Helvetica, sans-serif">${esc(p.text)}</text>`;
    })
    .join("");
}

export function svgSeccion(sec: Seccion, pav: Pavimento, titulo: string, via: string): DibujoSeccion {
  return construirSeccion(sec, pav, titulo, via);
}

function dxfText(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, (ch) => {
    const c = ch.codePointAt(0) ?? 63;
    return `\\U+${c.toString(16).toUpperCase().padStart(4, "0")}`;
  });
}

export function dxfDeSeccion(sec: Seccion, pav: Pavimento, titulo: string, via: string, ox: number, oy: number): string {
  const d = construirSeccion(sec, pav, titulo, via);
  const ents: string[] = [];
  const X = (x: number) => (ox + x).toFixed(4);
  const Y = (y: number) => (oy + y).toFixed(4);
  for (const p of d.prims) {
    if (p.k === "poly" && p.pts.length >= 2) {
      const body = p.pts.map((q) => `10\n${X(q.x)}\n20\n${Y(q.y)}`).join("\n");
      ents.push(`0\nLWPOLYLINE\n8\nMC-SECCION\n90\n${p.pts.length}\n70\n1\n${body}\n`);
    } else if (p.k === "line") {
      ents.push(`0\nLINE\n8\nMC-SECCION\n10\n${X(p.a.x)}\n20\n${Y(p.a.y)}\n11\n${X(p.b.x)}\n21\n${Y(p.b.y)}\n`);
    } else if (p.k === "circ") {
      const capa = p.r > 0.2 ? "MC-VEHICULO" : "MC-PERSONA";
      ents.push(`0\nCIRCLE\n8\n${capa}\n10\n${X(p.c.x)}\n20\n${Y(p.c.y)}\n40\n${p.r.toFixed(4)}\n`);
    } else if (p.k === "text") {
      ents.push(`0\nTEXT\n8\nMC-SECCION\n10\n${X(p.p.x)}\n20\n${Y(p.p.y)}\n40\n${Math.max(0.12, p.size).toFixed(3)}\n1\n${dxfText(p.text)}\n`);
    }
  }
  ents.push(`0\nTEXT\n8\nMC-SECCION\n10\n${X(1.6)}\n20\n${Y(d.alto - 0.2)}\n40\n0.35\n1\n${dxfText(`${titulo} ${via}`)}\n`);
  return ents.join("");
}
