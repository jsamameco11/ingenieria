import { svgDeTrazos, trazosDe, cajaModelo, fmtM } from "./dibujo";
import type { Meta, Modelo, Trazo } from "./tipos";
import { NORMA } from "./norma";

function dxfText(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, (ch) => {
    const c = ch.codePointAt(0) ?? 63;
    return `\\U+${c.toString(16).toUpperCase().padStart(4, "0")}`;
  });
}

const CAPAS: { name: string; color: number }[] = [
  { name: "MC-PERIMETRO", color: 7 },
  { name: "MC-CERCO", color: 7 },
  { name: "MC-EJE", color: 1 },
  { name: "MC-CALZADA", color: 8 },
  { name: "MC-VEREDA", color: 9 },
  { name: "MC-ESTACIONAMIENTO", color: 3 },
  { name: "MC-SEPARADOR", color: 3 },
  { name: "MC-LOTE", color: 7 },
  { name: "MC-MANZANA", color: 4 },
  { name: "MC-LOTE-TXT", color: 7 },
  { name: "MC-APORTE-REC", color: 3 },
  { name: "MC-APORTE-EDU", color: 2 },
  { name: "MC-APORTE-OTR", color: 30 },
  { name: "MC-APORTE-PZ", color: 3 },
  { name: "MC-RESIDUAL", color: 8 },
  { name: "MC-INGRESO", color: 2 },
  { name: "MC-VIA-EXISTENTE", color: 5 },
  { name: "MC-CAJETIN", color: 7 },
];

function capaDeUso(uso: string): string {
  switch (uso) {
    case "recreacion":
      return "MC-APORTE-REC";
    case "educacion":
      return "MC-APORTE-EDU";
    case "otros":
      return "MC-APORTE-OTR";
    case "parque-zonal":
      return "MC-APORTE-PZ";
    case "residual":
      return "MC-RESIDUAL";
    default:
      return "MC-LOTE";
  }
}

function capaFranja(tipo: string): string {
  if (tipo === "calzada" || tipo === "existente-calzada") return "MC-CALZADA";
  if (tipo === "vereda" || tipo === "existente-vereda") return "MC-VEREDA";
  if (tipo === "estacionamiento") return "MC-ESTACIONAMIENTO";
  if (tipo === "separador") return "MC-SEPARADOR";
  return "MC-VEREDA";
}

function lwpoly(capa: string, pts: { x: number; y: number; bulge?: number }[], cerrada: boolean): string {
  if (pts.length < 2) return "";
  const body = pts
    .map((p) => {
      const bulge = p.bulge && Math.abs(p.bulge) > 1e-6 ? `\n42\n${p.bulge.toFixed(6)}` : "";
      return `10\n${p.x.toFixed(4)}\n20\n${p.y.toFixed(4)}${bulge}`;
    })
    .join("\n");
  return `0\nLWPOLYLINE\n8\n${capa}\n90\n${pts.length}\n70\n${cerrada ? 1 : 0}\n${body}\n`;
}

function textEnt(capa: string, x: number, y: number, h: number, value: string): string {
  return `0\nTEXT\n8\n${capa}\n10\n${x.toFixed(4)}\n20\n${y.toFixed(4)}\n40\n${h.toFixed(3)}\n1\n${dxfText(value)}\n`;
}

export function dxfDe(m: Modelo, meta: Meta): string {
  const capas = CAPAS.map(
    (c) => `0\nLAYER\n2\n${c.name}\n70\n0\n62\n${c.color}\n6\nCONTINUOUS\n`,
  ).join("");
  const ents: string[] = [];
  if (m.lindero.length >= 3) ents.push(lwpoly("MC-PERIMETRO", [...m.lindero, m.lindero[0]], true));
  for (const tr of m.cerco) ents.push(lwpoly("MC-CERCO", tr, false));
  for (const f of m.franjas) {
    if (f.soloVista) continue;
    ents.push(lwpoly(capaFranja(f.tipo), [...f.poly, f.poly[0]], true));
  }
  for (const pl of m.polilineas ?? []) ents.push(lwpoly(pl.capa, pl.pts, pl.cerrada));
  for (const v of m.viasExistentes) {
    for (const f of v.franjas) ents.push(lwpoly(capaFranja(f.tipo), [...f.poly, f.poly[0]], true));
    for (const ln of v.lineas) {
      ents.push(lwpoly("MC-VIA-EXISTENTE", [ln.a, ln.b], false));
      ents.push(textEnt("MC-VIA-EXISTENTE", ln.p.x, ln.p.y, 1.6, ln.nombre.split("—")[0].trim()));
    }
  }
  for (const eje of m.ejes) {
    for (const seg of eje.partes) ents.push(lwpoly("MC-EJE", seg, false));
    const seg = eje.partes[0];
    if (seg && seg.length >= 2) {
      ents.push(textEnt("MC-EJE", (seg[0].x + seg[1].x) / 2, (seg[0].y + seg[1].y) / 2, 2.2, eje.nombre));
    }
  }
  for (const lot of m.lotes) {
    const capa = capaDeUso(lot.uso);
    if (lot.poly.length >= 3) ents.push(lwpoly(capa, [...lot.poly, lot.poly[0]], true));
    if (lot.uso === "vivienda") {
      ents.push(textEnt("MC-LOTE-TXT", lot.centro.x, lot.centro.y, 1.8, lot.id));
      ents.push(textEnt("MC-LOTE-TXT", lot.centro.x, lot.centro.y - 2.2, 1.2, `${lot.area.toFixed(2)} m2`));
    }
  }
  for (const ing of m.ingresos) {
    ents.push(textEnt("MC-INGRESO", ing.pt.x, ing.pt.y, 2.4, `${ing.nombre} E=${ing.pt.x.toFixed(3)} N=${ing.pt.y.toFixed(3)}`));
  }
  const nota = [
    meta.proyecto || "Habilitacion urbana",
    NORMA,
    `Area bruta ${m.areaBruta.toFixed(2)} m2`,
    `Lamina ${meta.lamina}`,
  ];
  const caja = cajaModelo(m);
  nota.forEach((line, i) => ents.push(textEnt("MC-CAJETIN", caja.minX, caja.minY - 6 - i * 4, 2.5, line)));

  return [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1024",
    "9",
    "$INSUNITS",
    "70",
    "6",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "TABLES",
    "0",
    "TABLE",
    "2",
    "LAYER",
    "70",
    String(CAPAS.length),
    capas.trimEnd(),
    "0",
    "ENDTAB",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    ents.join("").trimEnd(),
    "0",
    "ENDSEC",
    "0",
    "EOF",
    "",
  ].join("\n");
}

function escalaA1(w: number, h: number): number {
  const raw = Math.max(w / 0.7, h / 0.48) * 1.08;
  const opts = [100, 200, 250, 500, 750, 1000, 1250, 1500, 2000, 2500, 5000, 10000];
  return opts.find((s) => s >= raw) ?? Math.ceil(raw / 500) * 500;
}

export function htmlA1(m: Modelo, meta: Meta, trazos: Trazo[]): string {
  const caja = cajaModelo(m);
  const esc = escalaA1(caja.w, caja.h);
  const pad = Math.max(caja.w, caja.h) * 0.08;
  const vb = `${(caja.minX - pad).toFixed(3)} ${(-(caja.maxY + pad)).toFixed(3)} ${(caja.w + pad * 2).toFixed(3)} ${(caja.h + pad * 2).toFixed(3)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${svgDeTrazos(trazos)}</svg>`;
  const filasArea = [
    ["Área bruta", m.areaBruta],
    ["Vías locales", m.areaVias],
    ["Lotes vendibles", m.areaLotes],
    ["Aportes", m.areaAportes],
    ["Residual", m.areaResidual],
  ]
    .map(
      ([n, v]) =>
        `<tr><td>${n}</td><td>${fmtM(Number(v), 2)}</td><td>${m.areaBruta > 0 ? ((Number(v) / m.areaBruta) * 100).toFixed(1) : "—"}%</td></tr>`,
    )
    .join("");
  const aportes = m.aportes
    .map((a) => `<li><b>${a.concepto}.</b> ${a.pct}% · requerido ${fmtM(a.requerido, 0)} m² · en plano ${fmtM(a.grafico, 0)} m². ${a.estado}</li>`)
    .join("");
  const seccion = m.seccionPartes.map((p) => `${p.etiqueta} ${fmtM(p.ancho, 2)}`).join(" · ");
  const verts = m.lindero
    .slice(0, 12)
    .map((p, i) => `<tr><td>${i + 1}</td><td>${p.x.toFixed(3)}</td><td>${p.y.toFixed(3)}</td></tr>`)
    .join("");
  const obs = m.verificaciones
    .filter((v) => v.estado === "no-cumple" || v.estado === "observacion")
    .map((v) => `<li><b>${v.estado === "no-cumple" ? "NO CUMPLE" : "OBS."}</b> ${v.norma}: ${v.texto}</li>`)
    .join("");
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${meta.lamina} · ${meta.proyecto}</title>
<style>
  @page { size: 841mm 594mm; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #1a1a1a; font-family: "Times New Roman", Times, serif; }
  .sheet { width: 825mm; height: 578mm; display: grid; grid-template-columns: 1fr 88mm; grid-template-rows: 1fr 46mm; border: 0.4mm solid #1a1a1a; }
  .plan { grid-column: 1; grid-row: 1; min-height: 0; border-right: 0.25mm solid #1a1a1a; border-bottom: 0.25mm solid #1a1a1a; }
  .plan svg { width: 100%; height: 100%; display: block; }
  .side { grid-column: 2; grid-row: 1; padding: 3mm 3.2mm; font-size: 8.5pt; line-height: 1.25; overflow: hidden; border-bottom: 0.25mm solid #1a1a1a; }
  .side h2 { font-size: 9pt; letter-spacing: 0.08em; margin: 0 0 2mm; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 2.5mm; }
  td, th { border-bottom: 0.15mm solid #cfc6b6; text-align: left; padding: 0.5mm 0.6mm; font-size: 8pt; }
  td:last-child, th:last-child { text-align: right; }
  ol, ul { margin: 0 0 2mm 3.5mm; padding: 0; }
  li { margin: 0 0 0.8mm; }
  .caja { grid-column: 1 / -1; grid-row: 2; display: grid; grid-template-columns: 1.4fr 1fr 0.8fr; }
  .caja section { padding: 2.4mm 3.5mm; border-right: 0.25mm solid #1a1a1a; }
  .caja section:last-child { border-right: 0; }
  .kicker { font-size: 8pt; letter-spacing: 0.14em; text-transform: uppercase; margin: 0; }
  h1 { font-size: 14pt; margin: 0.6mm 0; font-weight: 600; }
  .muted { color: #444; font-size: 8.5pt; margin: 0; }
  .esc { font-size: 12pt; letter-spacing: 0.06em; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="plan">${svg}</div>
    <aside class="side">
      <h2>Cuadro de áreas</h2>
      <table><tr><th>Concepto</th><th>m²</th><th>%</th></tr>${filasArea}</table>
      <h2>Sección vial</h2>
      <p>${seccion || "—"} · total ${fmtM(m.seccionTotal, 2)} m</p>
      <p>Manzana de diseño ${fmtM(m.largoManzana, 2)} m · profundidad de lote ${fmtM(m.profundidad, 2)} m</p>
      <h2>Aportes</h2>
      <ul>${aportes}</ul>
      <h2>Vértices</h2>
      <table><tr><th>N.°</th><th>Este</th><th>Norte</th></tr>${verts}</table>
      ${m.lindero.length > 12 ? `<p>Y ${m.lindero.length - 12} vértices más, en el DXF.</p>` : ""}
      ${obs ? `<h2>Observaciones</h2><ul>${obs}</ul>` : ""}
    </aside>
    <footer class="caja">
      <section>
        <p class="kicker">${NORMA}</p>
        <h1>${meta.proyecto || "Habilitación urbana"}</h1>
        <p class="muted">Plano de trazado y lotización · GH.020 Art. 56.c</p>
        <p class="muted">${[meta.ubicacion, meta.distrito, meta.provincia].filter(Boolean).join(" · ") || "Ubicación por consignar"}</p>
        <p class="muted">Propietario: ${meta.propietario || "—"}</p>
      </section>
      <section>
        <p class="kicker">Responsable</p>
        <p>${meta.profesional || "—"}</p>
        <p class="muted">CIP ${meta.cip || "—"}</p>
        <p class="muted">Nomenclatura provisional de vías (Art. 52). Manzanas en letras y lotes en números (Art. 51).</p>
        <p class="muted">Coordenadas Este, Norte, en metros. Norte de planta hacia arriba.</p>
      </section>
      <section>
        <p class="kicker">Lámina ${meta.lamina || "U-01"}</p>
        <p class="esc">Escala 1:${esc}</p>
        <p class="muted">Formato A1 · ${meta.fecha || ""}</p>
        <p class="muted">Azimut de trama ${m.rumboGrados.toFixed(2)}°</p>
        <p class="muted">${m.nManzanas} manzanas · ${m.lotes.filter((l) => l.uso === "vivienda").length} lotes</p>
      </section>
    </footer>
  </div>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body>
</html>`;
}

export function trazosPlano(m: Modelo): Trazo[] {
  return trazosDe(m);
}

export function descargarTexto(nombre: string, texto: string, mime: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([texto], { type: mime }));
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function imprimirA1(m: Modelo, meta: Meta) {
  const html = htmlA1(m, meta, trazosDe(m));
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => iframe.remove(), 60_000);
}
