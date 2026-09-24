import { dist, fmtCoord, fmtM, pointInPoly, type V2 } from "./geom";
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
  vereda: { fill: "#d6d6d6", stroke: "#8d8d8d" },
  rampa: { fill: "#a3534a", stroke: "#6e312b" },
  estacionamiento: { fill: "#5e5e5e", stroke: "#3a3a3a" },
  jardin: { fill: "#3dcf3a", stroke: "#1f8a1c" },
  calzada: { fill: "#b9b9b9", stroke: "#8a8a8a" },
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

function poly(pts: V2[], fill: string, stroke: string, sw: number, dash?: string, clip = false): Trazo {
  return { t: "poly", pts, fill, stroke, sw, dash, clip };
}

function linea(a: V2, b: V2, stroke: string, sw: number, dash?: string, clip = false): Trazo {
  return { t: "line", a, b, fill: "none", stroke, sw, dash, clip };
}

function texto(p: V2, text: string, size: number, fill = "#1c1c1c", medio = false): Trazo {
  return { t: "text", p, text, size, fill, stroke: "none", sw: 0, medio };
}

function corona(c: V2, r: number, n = 28): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return pts;
}

/** Desplaza la marca a lo largo del eje de la calzada. t = 0.5 es la posición de origen. */
export function corteEn(c: import("./tipos").CorteVia, t: number): import("./tipos").CorteVia {
  if (!c.eje0 || !c.eje1) return c;
  const u = Math.max(0, Math.min(1, t));
  const mid = { x: c.eje0.x + (c.eje1.x - c.eje0.x) * u, y: c.eje0.y + (c.eje1.y - c.eje0.y) * u };
  const cx = (c.a.x + c.b.x) / 2;
  const cy = (c.a.y + c.b.y) / 2;
  return {
    ...c,
    a: { x: c.a.x + mid.x - cx, y: c.a.y + mid.y - cy },
    b: { x: c.b.x + mid.x - cx, y: c.b.y + mid.y - cy },
  };
}

/** Marca de corte de presentación: burbuja con letra, flecha de vista y línea con extremos gruesos. */
export function simboloCorte(a: V2, b: V2, letra: string): Trazo[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const r = 3.4;
  const out: Trazo[] = [];
  const extremo = (p: V2, haciaDentro: number) => {
    out.push(poly(corona(p, r), "#ffffff", "#141414", 0.42));
    out.push(texto(p, letra, 2.5, "#141414", true));
    const base = r + 0.15;
    const punta = { x: p.x + nx * (base + 3.5), y: p.y + ny * (base + 3.5) };
    const ala = 1.25;
    out.push(
      poly(
        [
          punta,
          { x: p.x + nx * base + ux * ala, y: p.y + ny * base + uy * ala },
          { x: p.x + nx * base - ux * ala, y: p.y + ny * base - uy * ala },
        ],
        "#141414",
        "#141414",
        0.05,
      ),
    );
    const grueso = Math.min(6.5, len * 0.18);
    out.push(
      linea(
        { x: p.x + ux * haciaDentro * (r + 0.2), y: p.y + uy * haciaDentro * (r + 0.2) },
        { x: p.x + ux * haciaDentro * (r + grueso), y: p.y + uy * haciaDentro * (r + grueso) },
        "#141414",
        0.95,
      ),
    );
  };
  extremo(a, 1);
  extremo(b, -1);
  const hueco = r + 6.7;
  if (len > hueco * 2 + 1) {
    out.push(
      linea(
        { x: a.x + ux * hueco, y: a.y + uy * hueco },
        { x: b.x - ux * hueco, y: b.y - uy * hueco },
        "#141414",
        0.22,
      ),
    );
  }
  return out;
}

function muestrear(poly: V2[], paso: number, margen: number): { p: V2; dir: V2 }[] {
  if (poly.length < 3) return [];
  let bestL = 0;
  let bestI = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L > bestL) {
      bestL = L;
      bestI = i;
    }
  }
  const a = poly[bestI];
  const b = poly[(bestI + 1) % poly.length];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const c = poly.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
  c.x /= poly.length;
  c.y /= poly.length;
  const out: { p: V2; dir: V2 }[] = [];
  for (let t = -len / 2 + margen; t <= len / 2 - margen; t += paso) {
    const p = { x: c.x + dir.x * t, y: c.y + dir.y * t };
    if (pointInPoly(p, poly)) out.push({ p, dir });
  }
  return out;
}

function rectaOrientada(p: V2, dir: V2, largo: number, ancho: number): V2[] {
  const nx = -dir.y;
  const ny = dir.x;
  const hx = dir.x * (largo / 2);
  const hy = dir.y * (largo / 2);
  const wx = nx * (ancho / 2);
  const wy = ny * (ancho / 2);
  return [
    { x: p.x - hx - wx, y: p.y - hy - wy },
    { x: p.x + hx - wx, y: p.y + hy - wy },
    { x: p.x + hx + wx, y: p.y + hy + wy },
    { x: p.x - hx + wx, y: p.y - hy + wy },
  ];
}

function caja(poly: V2[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Cruces peatonales y flechas de carril, en trazo fino blanco. */
export function grafismosPlanta(m: Modelo): { capa: string; pts: V2[]; fill: string; stroke: string; sw: number }[] {
  const out: { capa: string; pts: V2[]; fill: string; stroke: string; sw: number }[] = [];
  const calzadas = m.franjas.filter((f) => f.tipo === "calzada" && !f.soloVista && f.poly.length >= 3);
  const marca = (pts: V2[]) => out.push({ capa: "MC-MARCAS", pts, fill: "#f7f7f7", stroke: "none", sw: 0.02 });
  for (const f of calzadas) {
    const box = caja(f.poly);
    const horizontal = box.w >= box.h;
    const dir = horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 };
    const ancho = horizontal ? box.h : box.w;
    const cy = (box.minY + box.maxY) / 2;
    const cx = (box.minX + box.maxX) / 2;
    const cebra = (along: number) => {
      const n = Math.max(4, Math.round(ancho / 0.55));
      for (let i = 0; i < n; i += 2) {
        const off = -ancho / 2 + (i + 0.5) * (ancho / n);
        const c = horizontal
          ? { x: along, y: cy + off }
          : { x: cx + off, y: along };
        const stripe = rectaOrientada(c, dir, 0.28, (ancho / n) * 0.62);
        if (stripe.every((q) => pointInPoly(q, f.poly))) marca(stripe);
      }
    };
    const flecha = (along: number, sentido: number) => {
      const d = { x: dir.x * sentido, y: dir.y * sentido };
      const carril = Math.min(ancho / 4, 1.15);
      const p = horizontal ? { x: along, y: cy + carril } : { x: cx + carril, y: along };
      const asta = rectaOrientada(p, d, 1.7, 0.07);
      const punta = { x: p.x + d.x * 1.15, y: p.y + d.y * 1.15 };
      const base = { x: p.x + d.x * 0.35, y: p.y + d.y * 0.35 };
      const ala = 0.38;
      const nrm = { x: -d.y, y: d.x };
      const cabeza = [
        punta,
        { x: base.x + nrm.x * ala, y: base.y + nrm.y * ala },
        { x: base.x - nrm.x * ala, y: base.y - nrm.y * ala },
      ];
      if (asta.every((q) => pointInPoly(q, f.poly))) marca(asta);
      if (cabeza.every((q) => pointInPoly(q, f.poly))) marca(cabeza);
    };
    const cruces = calzadas.filter((g) => g !== f && (caja(g.poly).w >= caja(g.poly).h) !== horizontal);
    const puestos: number[] = [];
    for (const g of cruces) {
      const gb = caja(g.poly);
      if (horizontal) {
        if (gb.maxX < box.minX + 1 || gb.minX > box.maxX - 1) continue;
        if (gb.minY > cy + 1 || gb.maxY < cy - 1) continue;
        puestos.push(gb.minX - 2.2, gb.maxX + 2.2);
      } else {
        if (gb.maxY < box.minY + 1 || gb.minY > box.maxY - 1) continue;
        if (gb.minX > cx + 1 || gb.maxX < cx - 1) continue;
        puestos.push(gb.minY - 2.2, gb.maxY + 2.2);
      }
    }
    const dentro = (t: number) => (horizontal ? t > box.minX + 1.2 && t < box.maxX - 1.2 : t > box.minY + 1.2 && t < box.maxY - 1.2);
    for (const t of puestos) if (dentro(t)) cebra(t);
    const orden = puestos.filter(dentro).sort((a, b) => a - b);
    const tramos = [horizontal ? box.minX : box.minY, ...orden, horizontal ? box.maxX : box.maxY];
    for (let i = 0; i < tramos.length - 1; i++) {
      const a = tramos[i];
      const b = tramos[i + 1];
      if (b - a < 8) continue;
      flecha((a + b) / 2, 1);
    }
  }
  for (const f of m.franjas) {
    if (f.soloVista || f.poly.length < 3) continue;
    if (f.tipo === "estacionamiento") {
      const muestras = muestrear(f.poly, 6.2, 3.2);
      muestras.forEach((s, i) => {
        if (i % 2 === 0) {
          const divisor = rectaOrientada(s.p, { x: -s.dir.y, y: s.dir.x }, 2.15, 0.06);
          if (divisor.every((q) => pointInPoly(q, f.poly))) {
            out.push({ capa: "MC-ESTACIONAMIENTO", pts: divisor, fill: "#f4f4f2", stroke: "#f4f4f2", sw: 0.02 });
          }
        }
      });
    } else if (f.tipo === "jardin" || f.tipo === "vereda") {
      continue;
    }
  }
  return out;
}

export function trazosDe(m: Modelo): Trazo[] {
  const out: Trazo[] = [];
  for (const f of m.viasExistentes.flatMap((v) => v.franjas)) {
    const c = FRANJA[f.tipo] ?? FRANJA.vereda;
    out.push(poly(f.poly, c.fill, "#1a1a1a", 0.08, undefined, true));
  }
  for (const f of m.franjas) {
    if (f.soloVista || f.tipo === "vereda") continue;
    const c = FRANJA[f.tipo] ?? FRANJA.vereda;
    const costura = f.tipo === "calzada" || f.tipo === "estacionamiento" || f.tipo === "jardin";
    out.push(poly(f.poly, c.fill, costura ? c.fill : "#1a1a1a", costura ? 0.02 : 0.07, undefined, true));
    for (const ln of f.lineas ?? []) {
      if (ln.length >= 2) out.push(linea(ln[0], ln[1], f.tipo === "rampa" ? "#f2f2f2" : "#5c574e", 0.04, undefined, true));
    }
  }
  const orden: UsoLote[] = ["residual", "parque-zonal", "otros", "educacion", "recreacion", "vivienda"];
  for (const uso of orden) {
    for (const lote of m.lotes.filter((l) => l.uso === uso)) {
      const c = LOTE[uso];
      if (lote.uso === "residual") continue;
      out.push(poly(lote.poly, c.fill, "#1a1a1a", uso === "vivienda" ? 0.12 : 0.1));
    }
  }
  for (const f of m.franjas) {
    if (!f.soloVista || f.tipo !== "calzada" || f.poly.length < 3) continue;
    out.push(poly(f.poly, FRANJA.calzada.fill, FRANJA.calzada.fill, 0.1, undefined, true));
  }
  for (const f of m.franjas) {
    if (f.tipo !== "vereda" || f.poly.length < 3) continue;
    out.push(poly(f.poly, FRANJA.vereda.fill, FRANJA.vereda.fill, 0.14, undefined, true));
    if (!f.soloVista) continue;
    for (const ln of f.lineas ?? []) {
      if (ln.length >= 2) out.push(linea(ln[0], ln[1], "#1a1a1a", 0.06));
    }
  }
  for (const lote of m.lotes) {
    if (lote.uso === "vivienda") continue;
    if ((m.parques ?? []).some((pk) => pointInPoly(lote.centro, pk.poly))) continue;
    const nombre = USO_NOMBRE[lote.uso] || (lote.uso === "residual" ? "RESIDUAL" : "");
    if (!nombre) continue;
    const size = Math.max(1.6, Math.min(4.8, Math.sqrt(Math.max(lote.area, 1)) * 0.16));
    out.push(texto(lote.centro, nombre, size, LOTE[lote.uso].stroke));
    out.push(texto({ x: lote.centro.x, y: lote.centro.y - size * 1.25 }, `${fmtM(lote.area, 0)} m²`, size * 0.62, LOTE[lote.uso].stroke));
  }
  for (const pk of m.parques ?? []) {
    for (const pz of pk.piezas) {
      if (!pz.cerrado && pz.pts.length >= 2) {
        for (let i = 0; i < pz.pts.length - 1; i++) out.push(linea(pz.pts[i], pz.pts[i + 1], pz.stroke, pz.sw));
      } else if (pz.pts.length >= 3) {
        out.push(poly(pz.pts, pz.fill, pz.stroke, pz.sw));
      }
    }
    for (const t of pk.textos) out.push(texto(t.p, t.text, t.size, t.fill));
  }
  if (m.lindero.length >= 3) {
    out.push(poly([...m.lindero, m.lindero[0]], "none", "#1a1a1a", m.cerco.length ? 0.28 : 0.42));
  }
  for (const tramo of m.cerco) out.push(poly(tramo, "none", "#1a1a1a", 1.35));
  for (const eje of m.ejes) {
    const seg = eje.partes[0];
    if (seg && seg.length >= 2) {
      const mid = { x: (seg[0].x + seg[1].x) / 2, y: (seg[0].y + seg[1].y) / 2 };
      out.push(texto(mid, eje.nombre, 2.2, "#3a3a3a"));
    }
  }
  for (const sim of grafismosPlanta(m)) {
    out.push(poly(sim.pts, sim.fill, sim.stroke, sim.sw));
  }
  for (const lot of m.lotes.filter((l) => l.uso === "vivienda")) {
    const size = Math.max(1.6, Math.min(3.1, Math.sqrt(Math.max(lot.area, 1)) * 0.18));
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
      out.push(linea(ln.a, ln.b, "#1f4e79", 0.35, "1.2 1.1", true));
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
  for (const corte of m.cortes ?? []) out.push(...simboloCorte(corte.a, corte.b, corte.letra));
  return out;
}

/** Norte y escala gráfica, en metros de planta. Sirve en pantalla y en el A1. */
export function cartelaSvg(view: { minE: number; minN: number; w: number; h: number }): string {
  const sw = Math.max(view.w, view.h) / 520;
  const nice = [5, 10, 20, 25, 50, 100, 200, 500, 1000].find((n) => n >= view.w / 5) ?? 2000;
  const sx = view.minE + view.w * 0.04;
  const sy = view.minN + view.h * 0.05;
  const xf = (e: number) => e.toFixed(3);
  const yf = (n: number) => (-n).toFixed(3);
  const partes = 4;
  const paso = nice / partes;
  const alto = sw * 5.4;
  let barras = "";
  for (let i = 0; i < partes; i++) {
    const x0 = sx + i * paso;
    barras += `<rect x="${xf(x0)}" y="${yf(sy + alto)}" width="${paso.toFixed(3)}" height="${alto.toFixed(3)}" fill="${i % 2 === 0 ? "#1a1a1a" : "#f4f1ea"}" stroke="#1a1a1a" stroke-width="${(sw * 0.65).toFixed(3)}" />`;
  }
  const marcas = [0, nice / 2, nice]
    .map((m, i) => {
      const anchor = i === 0 ? "start" : i === 2 ? "end" : "middle";
      const etiqueta = i === 2 ? `${m} m` : String(m);
      return `<text x="${xf(sx + m)}" y="${yf(sy - sw * 2.4)}" text-anchor="${anchor}" font-size="${(sw * 8.5).toFixed(2)}" fill="#1a1a1a" font-family="Segoe UI, Arial, sans-serif">${etiqueta}</text>`;
    })
    .join("");
  const titulo = `<text x="${xf(sx)}" y="${yf(sy + alto + sw * 7.5)}" font-size="${(sw * 6.6).toFixed(2)}" fill="#1a1a1a" font-family="Segoe UI, Arial, sans-serif" letter-spacing="${(sw * 0.45).toFixed(2)}">ESCALA GRÁFICA</text>`;
  const r = view.h * 0.028;
  const cx = view.minE + view.w * 0.91;
  const cy = view.minN + view.h * 0.9;
  const norte = `${xf(cx)},${yf(cy + r * 1.35)} ${xf(cx - r * 0.46)},${yf(cy - r * 0.05)} ${xf(cx + r * 0.46)},${yf(cy - r * 0.05)}`;
  const sur = `${xf(cx)},${yf(cy - r * 1.15)} ${xf(cx - r * 0.46)},${yf(cy + r * 0.05)} ${xf(cx + r * 0.46)},${yf(cy + r * 0.05)}`;
  const rosa = `<circle cx="${xf(cx)}" cy="${yf(cy)}" r="${(r * 1.55).toFixed(3)}" fill="#f7f4ee" stroke="#1a1a1a" stroke-width="${(sw * 1.15).toFixed(3)}" />
    <polygon points="${norte}" fill="#1a1a1a" />
    <polygon points="${sur}" fill="#f7f4ee" stroke="#1a1a1a" stroke-width="${(sw * 0.75).toFixed(3)}" />
    <line x1="${xf(cx - r * 1.7)}" y1="${yf(cy)}" x2="${xf(cx + r * 1.7)}" y2="${yf(cy)}" stroke="#1a1a1a" stroke-width="${(sw * 0.45).toFixed(3)}" />
    <line x1="${xf(cx)}" y1="${yf(cy - r * 1.7)}" x2="${xf(cx)}" y2="${yf(cy + r * 1.7)}" stroke="#1a1a1a" stroke-width="${(sw * 0.45).toFixed(3)}" />
    <text x="${xf(cx)}" y="${yf(cy + r * 2.15)}" text-anchor="middle" font-size="${(r * 0.95).toFixed(2)}" fill="#1a1a1a" font-family="Segoe UI, Arial, sans-serif" font-weight="700">N</text>`;
  return `<g>${barras}${marcas}${titulo}</g><g>${rosa}</g>`;
}

export function puntosSvg(pts: V2[]): string {
  return pts.map((p) => `${p.x.toFixed(3)},${(-p.y).toFixed(3)}`).join(" ");
}

export function svgDeTrazos(trazos: Trazo[], extra = "", predio?: V2[]): string {
  const render = (list: Trazo[]) =>
    list
      .map((tr) => {
        if (tr.t === "poly" && tr.pts && tr.pts.length >= 2) {
          const dash = tr.dash ? ` stroke-dasharray="${tr.dash}"` : "";
          return `<polygon points="${puntosSvg(tr.pts)}" fill="${tr.fill}" stroke="${tr.stroke}" stroke-width="${tr.sw}" stroke-linejoin="round" stroke-linecap="round"${dash} />`;
        }
        if (tr.t === "line" && tr.a && tr.b) {
          const dash = tr.dash ? ` stroke-dasharray="${tr.dash}"` : "";
          return `<line x1="${tr.a.x.toFixed(3)}" y1="${(-tr.a.y).toFixed(3)}" x2="${tr.b.x.toFixed(3)}" y2="${(-tr.b.y).toFixed(3)}" stroke="${tr.stroke}" stroke-width="${tr.sw}" stroke-linecap="round"${dash} />`;
        }
        if (tr.t === "text" && tr.p && tr.text) {
          const medio = tr.medio ? ` dominant-baseline="central" font-weight="700"` : "";
          return `<text x="${tr.p.x.toFixed(3)}" y="${(-tr.p.y).toFixed(3)}" font-size="${(tr.size ?? 2).toFixed(2)}" text-anchor="middle"${medio} fill="${tr.fill}" font-family="Arial, Helvetica, sans-serif">${escapeXml(tr.text)}</text>`;
        }
        return "";
      })
      .join("");
  const vias = predio && predio.length >= 3 ? trazos.filter((t) => t.clip) : [];
  const rest = predio && predio.length >= 3 ? trazos.filter((t) => !t.clip) : trazos;
  if (vias.length && predio && predio.length >= 3) {
    const clip = `<defs><clipPath id="lz-predio"><polygon points="${puntosSvg(predio)}" /></clipPath></defs>`;
    return `${clip}<g clip-path="url(#lz-predio)">${render(vias)}</g>${render(rest)}${extra}`;
  }
  return render(trazos) + extra;
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
