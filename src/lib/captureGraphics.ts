/** Captura SVG/canvas del paper como PNG para Word e impresión auxiliar. */

export type CapturedGraphic = {
  part?: string;
  caption: string;
  dataUrl: string;
};

function svgToDataUrl(svg: SVGSVGElement): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const vb = clone.viewBox?.baseVal;
      const w = Math.max(640, vb?.width || svg.clientWidth || 640);
      const h = Math.max(400, vb?.height || svg.clientHeight || 400);
      clone.setAttribute("width", String(w));
      clone.setAttribute("height", String(h));
      const xml = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 2;
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.fillStyle = "#fbf8f1";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/** Recorre `.paper` y captura cada croquis/diagrama visible. */
export async function capturePaperGraphics(root: ParentNode = document): Promise<CapturedGraphic[]> {
  const paper = root.querySelector(".paper");
  if (!paper) return [];
  const blocks = [...paper.querySelectorAll<HTMLElement>(".croquis, .diagram")];
  const out: CapturedGraphic[] = [];
  for (const el of blocks) {
    const svg = el.querySelector("svg");
    if (!svg) continue;
    const dataUrl = await svgToDataUrl(svg);
    if (!dataUrl) continue;
    const cap =
      el.querySelector(".croquis-cap")?.textContent?.trim() ||
      el.querySelector(".croquis-head")?.textContent?.trim() ||
      "Geometría del elemento";
    const part =
      el.getAttribute("data-fig-part") ||
      el.closest("[data-fig-part]")?.getAttribute("data-fig-part") ||
      undefined;
    out.push({ part, caption: cap, dataUrl });
  }
  return out;
}
