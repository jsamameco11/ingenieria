import { dist, fmtCoord, fmtM, type V2 } from "./geom";
import type { Modelo, Trazo, UsoLote } from "./tipos";

const LOTE: Record<UsoLote, { fill: string; stroke: string }> = {
  vivienda: { fill: "#fbf8f2", stroke: "#3f382e" },
  recreacion: { fill: "#b7d0ae", stroke: "#2f5a34" },
  educacion: { fill: "#f0d7a4", stroke: "#7a5a1e" },
  otros: { fill: "#e4cbb8", stroke: "#6b4632" },
  "parque-zonal": { fill: "#c5d4c0", stroke: "#3d5c40" },
  residual: { fill: "#efe8dc", stroke: "#8a8172" },
};

const FRANJA: Record<string, { fill: string; stroke: string }> = {
  vereda: { fill: "#e7e0d4", stroke: "#b7ad9c" },
  estacionamiento: { fill: "#d7e3d4", stroke: "#8aa384" },
  calzada: { fill: "#c8c8c8", stroke: "#8d8d8d" },
  separador: { fill: "#9aaf90", stroke: "#6d805f" },
  "existente-vereda": { fill: "#d5e3f2", stroke: "#6d8eae" },
  "existente-calzada": { fill: "#c5d0dc", stroke: "#5d7386" },
  cerco: { fill: "none", stroke: "#1c1c1c" },
};

const USO_NOMBRE: Record<UsoLote, string> = {
  vivienda: "",
  recreacion: "RECREACIÓN PÚBLICA",
  educacion: "EDUCACIÓN",
  otros: "OTROS FINES",
  "parque-zonal": "PARQUE ZONAL",
  residual: "",
};

function poly(pts: V2[], fill: string, stroke: string, sw: number, dash?: string): Trazo {
  return { t: "poly", pts, fill, stroke, sw, dash };
}

function linea(a: V2, b: V2, stroke: string, sw: number, dash?: string): Trazo {
  return { t: "line", a, b, fill: "none", stroke, sw, dash };
}

function texto(p: V2, text: string, size: number, fill = "#1c1c1c"): Trazo {
  return { t: "text", p, text, size, fill, stroke: "none", sw: 0 };
}

export function trazosDe(m: Modelo): Trazo[] {
  const out: Trazo[] = [];
  for (const f of m.viasExistentes.flatMap((v) => v.franjas)) {
    const c = FRANJA[f.tipo] ?? FRANJA.vereda;
    out.push(poly(f.poly, c.fill, c.stroke, 0.25));
  }
  for (const f of m.franjas) {
    const c = FRANJA[f.tipo] ?? FRANJA.vereda;
    out.push(poly(f.poly, c.fill, c.stroke, 0.15));
  }
  const orden: UsoLote[] = ["residual", "parque-zonal", "otros", "educacion", "recreacion", "vivienda"];
  for (const uso of orden) {
    for (const lote of m.lotes.filter((l) => l.uso === uso)) {
      const c = LOTE[uso];
      const sw = uso === "vivienda" ? 0.35 : uso === "residual" ? 0.2 : 0.15;
      out.push(poly(lote.poly, c.fill, uso === "vivienda" ? c.stroke : c.fill, sw));
    }
  }
  for (const uso of ["recreacion", "educacion", "otros", "parque-zonal"] as UsoLote[]) {
    const ls = m.lotes.filter((l) => l.uso === uso);
    if (!ls.length) continue;
    const c = ls.reduce((s, l) => ({ x: s.x + l.centro.x * l.area, y: s.y + l.centro.y * l.area }), { x: 0, y: 0 });
    const a = ls.reduce((s, l) => s + l.area, 0);
    out.push(texto({ x: c.x / a, y: c.y / a }, USO_NOMBRE[uso], 4.2, LOTE[uso].stroke));
    out.push(texto({ x: c.x / a, y: c.y / a - 5.2 }, `${fmtM(a, 0)} m²`, 2.6, LOTE[uso].stroke));
  }
  if (m.lindero.length >= 3) {
    out.push(poly([...m.lindero, m.lindero[0]], "none", "#1a1a1a", m.cerco.length ? 0.45 : 0.9));
  }
  for (const tramo of m.cerco) out.push(poly(tramo, "none", "#1a1a1a", 1.35));
  for (const eje of m.ejes) {
    for (const seg of eje.partes) {
      if (seg.length >= 2) out.push(linea(seg[0], seg[1], "#8b1e1e", 0.28, "2.2 1.4"));
    }
    const seg = eje.partes[0];
    if (seg && seg.length >= 2) {
      const mid = { x: (seg[0].x + seg[1].x) / 2, y: (seg[0].y + seg[1].y) / 2 };
      out.push(texto(mid, eje.nombre, 2.8, "#8b1e1e"));
    }
  }
  for (const lot of m.lotes.filter((l) => l.uso === "vivienda")) {
    const size = Math.max(1.5, Math.min(3.1, lot.frente * 0.28));
    out.push(texto(lot.centro, lot.id, size));
    out.push(texto({ x: lot.centro.x, y: lot.centro.y - size * 1.15 }, fmtM(lot.area, 1), size * 0.72, "#5c564c"));
  }
  for (const ing of m.ingresos) {
    const tang = { x: -ing.hacia.y, y: ing.hacia.x };
    const a = { x: ing.pt.x + tang.x * (ing.ancho / 2), y: ing.pt.y + tang.y * (ing.ancho / 2) };
    const b = { x: ing.pt.x - tang.x * (ing.ancho / 2), y: ing.pt.y - tang.y * (ing.ancho / 2) };
    out.push(linea(a, b, "#8a6a32", 1.1));
    const poste = (p: V2) => linea(p, { x: p.x + ing.hacia.x * 3.2, y: p.y + ing.hacia.y * 3.2 }, "#8a6a32", 0.7);
    out.push(poste(a), poste(b));
    const punta = { x: ing.pt.x + ing.hacia.x * 9, y: ing.pt.y + ing.hacia.y * 9 };
    out.push(linea(ing.pt, punta, "#8a6a32", 0.55));
    out.push(texto({ x: punta.x, y: punta.y }, ing.nombre, 3.2, "#8a6a32"));
  }
  for (const via of m.viasExistentes) {
    for (const ln of via.lineas) {
      out.push(linea(ln.a, ln.b, "#1f4e79", 0.35, "1.2 1.1"));
      out.push(texto(ln.p, ln.nombre.split("—")[0].trim(), 2.4, "#1f4e79"));
    }
  }
  m.lindero.forEach((p, i) => {
    out.push(poly(
      [
        { x: p.x - 0.7, y: p.y - 0.7 },
        { x: p.x + 0.7, y: p.y - 0.7 },
        { x: p.x + 0.7, y: p.y + 0.7 },
        { x: p.x - 0.7, y: p.y + 0.7 },
      ],
      "#1a1a1a",
      "#1a1a1a",
      0.05,
    ));
    if (m.lindero.length <= 24) out.push(texto({ x: p.x + 2.2, y: p.y + 2.2 }, String(i + 1), 2.4));
  });
  return out;
}

export function puntosSvg(pts: V2[]): string {
  return pts.map((p) => `${p.x.toFixed(3)},${(-p.y).toFixed(3)}`).join(" ");
}

export function svgDeTrazos(trazos: Trazo[], extra = ""): string {
  const body = trazos
    .map((tr) => {
      if (tr.t === "poly" && tr.pts && tr.pts.length >= 2) {
        const dash = tr.dash ? ` stroke-dasharray="${tr.dash}"` : "";
        return `<polygon points="${puntosSvg(tr.pts)}" fill="${tr.fill}" stroke="${tr.stroke}" stroke-width="${tr.sw}" stroke-linejoin="round"${dash} />`;
      }
      if (tr.t === "line" && tr.a && tr.b) {
        const dash = tr.dash ? ` stroke-dasharray="${tr.dash}"` : "";
        return `<line x1="${tr.a.x.toFixed(3)}" y1="${(-tr.a.y).toFixed(3)}" x2="${tr.b.x.toFixed(3)}" y2="${(-tr.b.y).toFixed(3)}" stroke="${tr.stroke}" stroke-width="${tr.sw}"${dash} />`;
      }
      if (tr.t === "text" && tr.p && tr.text) {
        return `<text x="${tr.p.x.toFixed(3)}" y="${(-tr.p.y).toFixed(3)}" font-size="${(tr.size ?? 2).toFixed(2)}" text-anchor="middle" fill="${tr.fill}" font-family="Arial, Helvetica, sans-serif">${escapeXml(tr.text)}</text>`;
      }
      return "";
    })
    .join("");
  return body + extra;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function cajaModelo(m: Modelo): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } {
  const pts: V2[] = [...m.lindero];
  for (const l of m.lotes) pts.push(...l.poly);
  for (const v of m.viasExistentes) for (const ln of v.lineas) pts.push(ln.a, ln.b, ln.p);
  if (!pts.length) return { minX: 0, minY: 0, maxX: 10, maxY: 10, w: 10, h: 10 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (Math.hypot(p.x - (m.lindero[0]?.x ?? p.x), p.y - (m.lindero[0]?.y ?? p.y)) > 800 && m.lindero.length) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 10, maxY: 10, w: 10, h: 10 };
  return { minX, minY, maxX, maxY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

export function longitudEje(m: Modelo): number {
  return m.ejes.reduce((s, e) => s + e.partes.reduce((a, seg) => a + (seg.length >= 2 ? dist(seg[0], seg[1]) : 0), 0), 0);
}

export { fmtCoord, fmtM };
