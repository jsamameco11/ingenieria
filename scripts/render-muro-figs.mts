/**
 * Renderiza las figuras del muro de sostenimiento a SVG independientes para
 * poder revisarlas fuera de la aplicación.
 *
 *   npx tsx scripts/render-muro-figs.mts [carpeta]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MODULES } from "../src/lib/catalog";
import { muroSostenimiento } from "../src/lib/engines/muro/engine";
import { MuroSostenimientoFig } from "../src/components/MuroSostenimientoFig";

const salida = process.argv[2] ?? ".tmp-figs";
mkdirSync(salida, { recursive: true });

const mod = MODULES.find((m) => m.slug === "muro-sostenimiento")!;
const r = muroSostenimiento({ ...mod.defaults });
const values = { ...mod.defaults, ...r.dims };

const partes = ["esquema", "empujes", "estabilidad", "malla", "calor", "esfuerzos", "presiones", "despiece"];
for (const part of partes) {
  const html = renderToStaticMarkup(createElement(MuroSostenimientoFig, { values, part }));
  const svg = html.match(/<svg[\s\S]*<\/svg>/)?.[0];
  if (!svg) {
    console.log(`  FALLO ${part}: no se generó SVG`);
    continue;
  }
  const pie = html.match(/class="croquis-cap">([\s\S]*?)<\/p>/)?.[1] ?? "";
  const [, , w, h] = (svg.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 900 560").split(" ");
  const conFondo = svg.replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" `);
  writeFileSync(join(salida, `${part}.svg`), conFondo, "utf8");
  console.log(`  ok ${part}.svg  (${svg.length} bytes) — ${pie.replace(/<[^>]+>/g, "").slice(0, 110)}`);
}

writeFileSync(
  join(salida, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Figuras del muro</title>
<style>body{background:#e8e2d4;font:13px "IBM Plex Sans",sans-serif;margin:0;padding:18px}
figure{margin:0 0 26px;background:#fff;padding:10px;box-shadow:0 1px 4px #0003}
figcaption{font-weight:700;color:#163a63;margin-bottom:6px}img{display:block;width:1500px;max-width:100%}</style>
${partes.map((p) => `<figure><figcaption>${p}</figcaption><img src="${p}.svg"></figure>`).join("\n")}`,
  "utf8",
);
console.log(`\nAbre ${join(salida, "index.html")}`);
