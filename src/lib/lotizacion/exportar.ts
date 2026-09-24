import { svgDeTrazos, trazosDe, cajaModelo, fmtM, grafismosPlanta, cartelaSvg, simboloCorte } from "./dibujo";
import { DxfDoc } from "./dxf";
import { dxfDeSeccion, svgSeccion } from "./seccionVia";
import type { Meta, Modelo, Trazo } from "./tipos";
import { NORMA, pavimentoVacio } from "./norma";

const CAPAS: { name: string; color: number }[] = [
  { name: "MC-PERIMETRO", color: 7 },
  { name: "MC-CERCO", color: 7 },
  { name: "MC-EJE", color: 1 },
  { name: "MC-CALZADA", color: 8 },
  { name: "MC-VEREDA", color: 9 },
  { name: "MC-OCHAVO", color: 7 },
  { name: "MC-ESTACIONAMIENTO", color: 8 },
  { name: "MC-JARDIN", color: 3 },
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
  { name: "MC-CORTE", color: 7 },
  { name: "MC-SECCION", color: 7 },
  { name: "MC-VEHICULO", color: 7 },
  { name: "MC-MARCAS", color: 7 },
  { name: "MC-PERSONA", color: 7 },
  { name: "MC-PARQUE-CESPED", color: 3 },
  { name: "MC-PARQUE-CANCHA", color: 3 },
  { name: "MC-PARQUE-LINEA", color: 7 },
  { name: "MC-PARQUE-SENDERO", color: 32 },
  { name: "MC-PARQUE-EMPALME", color: 32 },
  { name: "MC-PARQUE-BANCA", color: 32 },
  { name: "MC-PARQUE-FLOR", color: 1 },
  { name: "MC-PARQUE-ARBOL", color: 3 },
  { name: "MC-PARQUE-JUEGO", color: 1 },
  { name: "MC-PARQUE-PLAZA", color: 8 },
  { name: "MC-PARQUE-LUZ", color: 7 },
  { name: "MC-PARQUE-MOB", color: 7 },
  { name: "MC-PARQUE-TXT", color: 7 },
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
  if (tipo === "vereda" || tipo === "rampa" || tipo === "existente-vereda") return "MC-VEREDA";
  if (tipo === "estacionamiento") return "MC-ESTACIONAMIENTO";
  if (tipo === "jardin") return "MC-JARDIN";
  if (tipo === "separador") return "MC-SEPARADOR";
  return "MC-VEREDA";
}

export function dxfDe(m: Modelo, meta: Meta): string {
  const doc = new DxfDoc(CAPAS);
  if (m.lindero.length >= 3) doc.polilinea("MC-PERIMETRO", m.lindero, true);
  for (const tr of m.cerco) doc.polilinea("MC-CERCO", tr, false);
  for (const f of m.franjas) {
    if (f.soloVista) continue;
    doc.polilinea(capaFranja(f.tipo), f.poly, true);
  }
  for (const pl of m.polilineas ?? []) doc.polilinea(pl.capa, pl.pts, pl.cerrada);
  for (const v of m.viasExistentes) {
    for (const f of v.franjas) doc.polilinea(capaFranja(f.tipo), f.poly, true);
    for (const ln of v.lineas) {
      doc.polilinea("MC-VIA-EXISTENTE", [ln.a, ln.b], false);
      doc.texto("MC-VIA-EXISTENTE", ln.p.x, ln.p.y, 1.6, ln.nombre.split("—")[0].trim());
    }
  }
  for (const eje of m.ejes) {
    for (const seg of eje.partes) doc.polilinea("MC-EJE", seg, false);
    const seg = eje.partes[0];
    if (seg && seg.length >= 2) {
      doc.texto("MC-EJE", (seg[0].x + seg[1].x) / 2, (seg[0].y + seg[1].y) / 2, 2.2, eje.nombre);
    }
  }
  for (const lot of m.lotes) {
    const capa = capaDeUso(lot.uso);
    if (lot.poly.length >= 3) doc.polilinea(capa, lot.poly, true);
    if (lot.uso === "vivienda") {
      doc.texto("MC-LOTE-TXT", lot.centro.x, lot.centro.y, 1.8, lot.id);
      doc.texto("MC-LOTE-TXT", lot.centro.x, lot.centro.y - 2.2, 1.2, `${lot.area.toFixed(2)} m2`);
    } else if (lot.uso !== "residual") {
      const nombre = lot.uso === "recreacion" ? "RECREACION PUBLICA" : lot.uso === "educacion" ? "EDUCACION" : lot.uso === "otros" ? "OTROS FINES" : lot.uso.toUpperCase();
      doc.texto(capa, lot.centro.x, lot.centro.y, 2.2, nombre);
      doc.texto(capa, lot.centro.x, lot.centro.y - 2.6, 1.4, `${lot.area.toFixed(0)} m2`);
    } else {
      doc.texto(capa, lot.centro.x, lot.centro.y, 1.6, "RESIDUAL");
    }
  }
  for (const pk of m.parques ?? []) {
    for (const pz of pk.piezas) {
      if (pz.hatch && pz.pts.length >= 3) doc.hatch(pz.capa, pz.pts, pz.fill);
      const color = pz.fill !== "none" ? pz.fill : pz.stroke;
      if (pz.pts.length >= 2) doc.polilinea(pz.capa, pz.pts, pz.cerrado && pz.pts.length >= 3, color);
    }
    for (const t of pk.textos) doc.texto("MC-PARQUE-TXT", t.p.x, t.p.y, t.size, t.text, t.fill);
  }
  for (const ing of m.ingresos) {
    doc.texto("MC-INGRESO", ing.pt.x, ing.pt.y, 2.4, `${ing.nombre} E=${ing.pt.x.toFixed(3)} N=${ing.pt.y.toFixed(3)}`);
  }
  const nota = [
    meta.proyecto || "Habilitacion urbana",
    NORMA,
    `Area bruta ${m.areaBruta.toFixed(2)} m2`,
    `Lamina ${meta.lamina}`,
  ];
  const caja = cajaModelo(m);
  for (const corte of m.cortes ?? []) {
    for (const tr of simboloCorte(corte.a, corte.b, corte.letra)) {
      if (tr.t === "poly" && tr.pts && tr.pts.length >= 3) doc.polilinea("MC-CORTE", tr.pts, true);
      else if (tr.t === "line" && tr.a && tr.b) doc.polilinea("MC-CORTE", [tr.a, tr.b], false);
      else if (tr.t === "text" && tr.p && tr.text) doc.texto("MC-CORTE", tr.p.x, tr.p.y, tr.size ?? 2.2, tr.text);
    }
  }
  for (const sim of grafismosPlanta(m)) {
    doc.polilinea(sim.capa, sim.pts, true);
  }
  const pav = m.pavimento ?? pavimentoVacio();
  const cortes = m.cortes ?? [];
  const planW = Math.max(caja.maxX - caja.minX, 40);
  const planH = Math.max(caja.maxY - caja.minY, 40);
  const dibujos = cortes.map((corte) => ({
    corte,
    d: svgSeccion(corte.seccion, pav, `CORTE ${corte.titulo}`, corte.via, corte.lateral),
  }));
  const sep = planH * 0.03;
  const altoObj = dibujos.length ? (planH - sep * (dibujos.length - 1)) / dibujos.length : 0;
  const anchoObj = planW * 0.46;
  const escala = dibujos.length
    ? Math.min(...dibujos.map((item) => Math.min(altoObj / item.d.alto, anchoObj / item.d.ancho)))
    : 1;
  const colW = dibujos.reduce((m, item) => Math.max(m, item.d.ancho * escala), 0);
  const oxCorte = caja.maxX + planW * 0.05;
  let yCorte = caja.maxY;
  for (const item of dibujos) {
    const h = item.d.alto * escala;
    yCorte -= h;
    dxfDeSeccion(doc, item.corte.seccion, pav, `CORTE ${item.corte.titulo}`, item.corte.via, oxCorte, yCorte, item.corte.lateral, escala);
    yCorte -= sep;
  }
  const contenido = {
    minX: caja.minX,
    minY: Math.min(caja.minY, dibujos.length ? yCorte : caja.minY),
    maxX: caja.maxX + (dibujos.length ? planW * 0.05 + colW + planW * 0.03 : 8),
    maxY: caja.maxY,
  };
  const altoCont = contenido.maxY - contenido.minY;
  const esc = escalaA1(contenido.maxX - contenido.minX, altoCont);
  const hojaW = 0.841 * esc;
  const hojaH = 0.594 * esc;
  const margen = 0.012 * esc;
  const cajaH = 0.045 * esc;
  const ox = contenido.minX - margen - Math.max(0, hojaW - 2 * margen - (contenido.maxX - contenido.minX)) / 2;
  const oy = contenido.minY - cajaH - margen;
  doc.polilinea("MC-CAJETIN", [{ x: ox, y: oy }, { x: ox + hojaW, y: oy }, { x: ox + hojaW, y: oy + hojaH }, { x: ox, y: oy + hojaH }], true);
  doc.polilinea(
    "MC-CAJETIN",
    [
      { x: ox + margen * 0.45, y: oy + margen * 0.45 },
      { x: ox + hojaW - margen * 0.45, y: oy + margen * 0.45 },
      { x: ox + hojaW - margen * 0.45, y: oy + hojaH - margen * 0.45 },
      { x: ox + margen * 0.45, y: oy + hojaH - margen * 0.45 },
    ],
    true,
  );
  doc.polilinea("MC-CAJETIN", [{ x: ox, y: oy + cajaH }, { x: ox + hojaW, y: oy + cajaH }], false);
  const tx = Math.max(1.6, esc * 0.0032);
  nota.forEach((line, i) => doc.texto("MC-CAJETIN", ox + margen, oy + cajaH - tx * 1.6 - i * tx * 1.45, tx, line));
  doc.texto("MC-CAJETIN", ox + hojaW * 0.62, oy + cajaH * 0.62, tx * 1.35, `ESCALA 1:${esc}`);
  doc.texto("MC-CAJETIN", ox + hojaW * 0.62, oy + cajaH * 0.28, tx, "FORMATO A1  841 x 594 mm");
  doc.texto("MC-CAJETIN", ox + hojaW * 0.82, oy + cajaH * 0.62, tx, meta.fecha || "");
  doc.texto("MC-CAJETIN", ox + hojaW - margen * 3, oy + hojaH - margen * 2.2, tx * 1.4, "N");

  return doc.serializar({ minX: ox, minY: oy, maxX: ox + hojaW, maxY: oy + hojaH });
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${svgDeTrazos(trazos, "", m.lindero)}${cartelaSvg({ minE: caja.minX, minN: caja.minY, w: caja.w, h: caja.h })}</svg>`;
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
  const pav = m.pavimento ?? pavimentoVacio();
  const cortesHtml = (m.cortes ?? [])
    .map((c) => {
      const d = svgSeccion(c.seccion, pav, `CORTE ${c.titulo}`, c.via, c.lateral);
      return `<figure><svg xmlns="http://www.w3.org/2000/svg" viewBox="${d.viewBox}">${d.body}</svg><figcaption>Corte ${c.titulo} · ${c.via} · persona 1.75 m · vehículo a escala</figcaption></figure>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${meta.lamina} · ${meta.proyecto}</title>
<style>
  @page { size: 841mm 594mm; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #1a1a1a; font-family: "Segoe UI", Arial, sans-serif; }
  .sheet { width: 825mm; height: 578mm; display: grid; grid-template-columns: 1fr 92mm; grid-template-rows: 1fr 42mm; border: 0.55mm solid #1a1a1a; outline: 0.2mm solid #1a1a1a; outline-offset: -1.4mm; page-break-after: always; }
  .sheet.secs { display: block; height: auto; min-height: 578mm; padding: 8mm; }
  .sheet.secs h2 { font-size: 14pt; margin: 0 0 4mm; letter-spacing: 0.08em; text-transform: uppercase; }
  .sec-grid { display: flex; flex-wrap: wrap; gap: 8mm; }
  .sec-grid figure { margin: 0; width: 250mm; }
  .sec-grid svg { width: 100%; height: auto; background: #fff; }
  .sec-grid figcaption { font-size: 9pt; margin-top: 1.5mm; }
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
        <p class="muted">Escala gráfica y norte en la planta. Formato A1 · ${meta.fecha || ""}</p>
        <p class="muted">Azimut de trama ${m.rumboGrados.toFixed(2)}°</p>
        <p class="muted">${m.nManzanas} manzanas · ${m.lotes.filter((l) => l.uso === "vivienda").length} lotes</p>
      </section>
    </footer>
  </div>
  <div class="sheet secs">
    <h2>Cortes de vías · ${meta.lamina || "U-01"}</h2>
    <p class="muted">Carpetas editables del pavimento. Persona y vehículos a escala. Formato A1.</p>
    <div class="sec-grid">${cortesHtml || "<p>Sin vías internas.</p>"}</div>
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
  a.href = URL.createObjectURL(new Blob([texto], { type: `${mime};charset=us-ascii` }));
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
