import * as pdfjs from "pdfjs-dist/build/pdf.mjs";
import type { PaginaRaster } from "./types";

import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export const MAX_PAGINAS = 40;
/** Tope de láminas cobradas y leídas en un solo pago (todos los lotes). */
export const MAX_HOJAS_COBRO = 80;
const MAX_LADO = 1400;
const JPEG_Q = 0.68;

export function claveArchivoPdf(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/** Cuenta las hojas reales del PDF al recibirlo (sin rasterizar). */
export async function contarHojasPdf(file: File): Promise<number> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  try {
    return Math.max(1, Number(pdf.numPages) || 1);
  } finally {
    await pdf.destroy();
  }
}

export async function rasterizarPdfs(files: File[], maxPaginas = MAX_PAGINAS): Promise<PaginaRaster[]> {
  const out: PaginaRaster[] = [];
  for (const file of files) {
    if (out.length >= maxPaginas) break;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const n = Math.min(pdf.numPages, maxPaginas - out.length);
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(MAX_LADO / Math.max(base.width, base.height), 1.65);
      const viewport = page.getViewport({ scale: Math.max(0.6, scale) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      out.push({
        file: file.name,
        page: i,
        dataUrl: canvas.toDataURL("image/jpeg", JPEG_Q),
      });
    }
  }
  return out;
}
