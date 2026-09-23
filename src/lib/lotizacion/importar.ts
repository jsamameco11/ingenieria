import ExcelJS from "exceljs";
import type { Punto } from "./tipos";

export type LecturaPerimetro = {
  puntos: Punto[];
  aviso: string;
  arcos: boolean;
};

function numCampo(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "");
  if (!t) return null;
  const neg = t.startsWith("(") && t.endsWith(")");
  const s = neg ? t.slice(1, -1) : t;
  let n: number;
  if (s.includes(",") && s.includes(".")) n = Number(s.replace(/,/g, ""));
  else if (s.includes(",") && !s.includes(".")) n = Number(s.replace(",", "."));
  else n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

function separar(linea: string): string[] {
  if (linea.includes("\t")) return linea.split("\t");
  if (linea.includes(";")) return linea.split(";");
  if (linea.includes(",")) return linea.split(",");
  return linea.trim().split(/\s+/);
}

function esEncabezado(c: string[]): boolean {
  const u = c.map((x) => x.trim().toLowerCase()).join(" ");
  return /num|este|norte|punto|vertice|vértice|east|north|\bx\b|\by\b/.test(u);
}

function columnas(enc: string[]): { num: number; e: number; n: number } | null {
  const u = enc.map((x) => x.trim().toLowerCase());
  const idx = (re: RegExp) => u.findIndex((x) => re.test(x));
  let e = idx(/este|^e$|^x$|east/);
  let n = idx(/norte|^n$|^y$|north/);
  let num = idx(/num|punto|pto|vert|id|^n°|^no/);
  if (e < 0 || n < 0) {
    if (enc.length >= 3) {
      num = 0;
      e = 1;
      n = 2;
    } else if (enc.length >= 2) {
      num = -1;
      e = 0;
      n = 1;
    } else return null;
  }
  return { num, e, n };
}

export function leerCsv(texto: string): LecturaPerimetro {
  const lineas = texto
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("//"));
  if (!lineas.length) return { puntos: [], aviso: "El archivo no tiene filas.", arcos: false };
  const filas = lineas.map(separar);
  let start = 0;
  let cols = { num: 0, e: 1, n: 2 };
  if (esEncabezado(filas[0])) {
    const det = columnas(filas[0]);
    if (det) cols = det;
    start = 1;
  } else if (filas[0].length >= 2) {
    const det = columnas(filas[0].map((_, i) => (i === 0 ? "num" : i === 1 ? "este" : "norte")));
    if (filas[0].length === 2) cols = { num: -1, e: 0, n: 1 };
    else if (det && numCampo(filas[0][det.e] ?? "") === null) start = 1;
  }
  const puntos: Punto[] = [];
  for (let i = start; i < filas.length; i++) {
    const f = filas[i];
    const e = numCampo(f[cols.e] ?? "");
    const n = numCampo(f[cols.n] ?? "");
    if (e === null || n === null) continue;
    const numRaw = cols.num >= 0 ? (f[cols.num] ?? "").trim() : "";
    puntos.push({ num: numRaw || String(puntos.length + 1), e, n });
  }
  if (puntos.length >= 2) {
    const a = puntos[0];
    const b = puntos[puntos.length - 1];
    if (Math.hypot(a.e - b.e, a.n - b.n) < 0.01) puntos.pop();
  }
  return {
    puntos,
    aviso: puntos.length >= 3 ? `${puntos.length} vértices leídos.` : "Se necesitan al menos 3 vértices con Este y Norte.",
    arcos: false,
  };
}

type Grupo = { code: number; value: string };

function gruposDxf(texto: string): Grupo[] {
  const lines = texto.replace(/^\uFEFF/, "").split(/\r?\n/);
  const out: Grupo[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number.parseInt(lines[i].trim(), 10);
    if (!Number.isFinite(code)) {
      i -= 1;
      continue;
    }
    out.push({ code, value: lines[i + 1].trim() });
  }
  return out;
}

type PolyCand = { pts: Punto[]; cerrada: boolean; arcos: boolean };

function tomarPolilineas(gs: Grupo[]): PolyCand[] {
  const out: PolyCand[] = [];
  for (let i = 0; i < gs.length; i++) {
    if (gs[i].code !== 0) continue;
    const ent = gs[i].value.toUpperCase();
    if (ent === "LWPOLYLINE") {
      const pts: Punto[] = [];
      let cerrada = false;
      let arcos = false;
      let x: number | null = null;
      let j = i + 1;
      for (; j < gs.length; j++) {
        if (gs[j].code === 0) break;
        if (gs[j].code === 70 && (Number(gs[j].value) & 1) === 1) cerrada = true;
        if (gs[j].code === 42 && Math.abs(Number(gs[j].value)) > 1e-8) arcos = true;
        if (gs[j].code === 10) x = Number(gs[j].value);
        if (gs[j].code === 20 && x !== null && Number.isFinite(Number(gs[j].value))) {
          pts.push({ num: String(pts.length + 1), e: x, n: Number(gs[j].value) });
          x = null;
        }
      }
      if (pts.length >= 3) out.push({ pts, cerrada, arcos });
      i = j - 1;
    } else if (ent === "POLYLINE") {
      const pts: Punto[] = [];
      let cerrada = false;
      let arcos = false;
      let j = i + 1;
      for (; j < gs.length; j++) {
        if (gs[j].code === 0 && gs[j].value.toUpperCase() === "SEQEND") break;
        if (gs[j].code === 70 && gs[j - 1]?.code === 0) continue;
        if (gs[j].code === 0 && gs[j].value.toUpperCase() === "VERTEX") {
          let x: number | null = null;
          let y: number | null = null;
          let k = j + 1;
          for (; k < gs.length && gs[k].code !== 0; k++) {
            if (gs[k].code === 10) x = Number(gs[k].value);
            if (gs[k].code === 20) y = Number(gs[k].value);
            if (gs[k].code === 42 && Math.abs(Number(gs[k].value)) > 1e-8) arcos = true;
          }
          if (x !== null && y !== null) pts.push({ num: String(pts.length + 1), e: x, n: y });
          j = k - 1;
        } else if (gs[j].code === 70 && (Number(gs[j].value) & 1) === 1) cerrada = true;
      }
      if (pts.length >= 3) out.push({ pts, cerrada, arcos });
      i = j;
    }
  }
  return out;
}

function areaCand(pts: Punto[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.e * b.n - b.e * a.n;
  }
  return Math.abs(s) / 2;
}

export function leerDxf(texto: string): LecturaPerimetro {
  const head = texto.slice(0, 80);
  if (head.includes("AutoCAD Binary DXF")) {
    return { puntos: [], aviso: "El DXF está en binario. En AutoCAD use Guardar como → DXF ASCII.", arcos: false };
  }
  const gs = gruposDxf(texto);
  let enEntidades = false;
  const ents: Grupo[] = [];
  for (let i = 0; i < gs.length; i++) {
    if (gs[i].code === 0 && gs[i].value.toUpperCase() === "SECTION" && gs[i + 1]?.code === 2 && gs[i + 1].value.toUpperCase() === "ENTITIES") {
      enEntidades = true;
      continue;
    }
    if (enEntidades && gs[i].code === 0 && gs[i].value.toUpperCase() === "ENDSEC") break;
    if (enEntidades) ents.push(gs[i]);
  }
  const fuente = ents.length ? ents : gs;
  const polys = tomarPolilineas(fuente).filter((p) => p.pts.length >= 3);
  if (!polys.length) {
    return {
      puntos: [],
      aviso: "No hay una polilínea cerrada en el DXF. Dibuje el perímetro como LWPOLYLINE cerrada y exporte de nuevo.",
      arcos: false,
    };
  }
  polys.sort((a, b) => areaCand(b.pts) - areaCand(a.pts));
  const mejor = polys[0];
  const pts = mejor.pts.slice();
  if (pts.length >= 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.hypot(a.e - b.e, a.n - b.n) < 0.01) pts.pop();
  }
  const arcos = polys.some((p) => p.arcos);
  const aviso = [
    `Perímetro tomado de la polilínea de mayor área (${pts.length} vértices, ${areaCand(pts).toFixed(1)} m²).`,
    polys.length > 1 ? `Se ignoraron ${polys.length - 1} polilíneas menores.` : "",
    !mejor.cerrada ? "La polilínea no estaba marcada como cerrada; se cierra con el primer vértice." : "",
    arcos ? "Hay arcos (bulge). El perímetro usa las cuerdas entre vértices." : "",
  ]
    .filter(Boolean)
    .join(" ");
  return { puntos: pts, aviso, arcos };
}

function esDwgBinario(buf: ArrayBuffer): boolean {
  const u = new Uint8Array(buf.slice(0, 6));
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return s.startsWith("AC10");
}

export async function leerArchivoPerimetro(file: File): Promise<LecturaPerimetro> {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith(".xlsx") || nombre.endsWith(".xls")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer() as unknown as ExcelJS.Buffer);
    const hoja = wb.worksheets[0];
    if (!hoja) return { puntos: [], aviso: "El libro no tiene hojas.", arcos: false };
    const lineas: string[] = [];
    hoja.eachRow((row) => {
      const vals = row.values as unknown[];
      const celdas = vals.slice(1).map((v) => {
        if (v == null) return "";
        if (typeof v === "object" && v && "result" in v) return String((v as { result: unknown }).result ?? "");
        if (typeof v === "object" && v && "text" in v) return String((v as { text: unknown }).text ?? "");
        return String(v);
      });
      lineas.push(celdas.join(";"));
    });
    const leido = leerCsv(lineas.join("\n"));
    return { ...leido, aviso: `Excel: ${leido.aviso}` };
  }
  const buf = await file.arrayBuffer();
  if (nombre.endsWith(".dwg") || esDwgBinario(buf)) {
    const texto = new TextDecoder("latin1").decode(buf.slice(0, 22));
    if (!texto.includes("SECTION") && esDwgBinario(buf)) {
      return {
        puntos: [],
        aviso:
          "Este archivo es un DWG binario. AutoCAD no publica ese formato. Guárdelo como DXF (Archivo → Guardar como → DXF de AutoCAD) y vuelva a cargarlo: se toma la polilínea cerrada de mayor área como perímetro.",
        arcos: false,
      };
    }
  }
  const texto = new TextDecoder("utf-8").decode(buf);
  if (nombre.endsWith(".dxf") || nombre.endsWith(".dwg") || /^\s*0\s*\n\s*SECTION/i.test(texto) || texto.includes("LWPOLYLINE")) {
    return leerDxf(texto);
  }
  return leerCsv(texto);
}
