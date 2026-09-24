/**
 * DXF ASCII AutoCAD 2004 (AC1018).
 * El grupo 420 (color real) existe desde esta versión. AC1015 lo rechaza
 * y el archivo no abre. Cada objeto lleva asa, subclase y capa declarada.
 */

export type PuntoDxf = { x: number; y: number; bulge?: number };

const NL = "\r\n";

function n(v: number, d = 4): string {
  return Number.isFinite(v) ? v.toFixed(d) : "0.0000";
}

export function dxfTexto(s: string): string {
  return String(s)
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\x20-\x7E]/g, (ch) => {
      const c = ch.codePointAt(0) ?? 63;
      return `\\U+${c.toString(16).toUpperCase().padStart(4, "0")}`;
    });
}

function trueColor(hex: string): string[] {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return [];
  return ["420", String(parseInt(m[1], 16))];
}

function anillo(pts: PuntoDxf[]): PuntoDxf[] {
  const out: PuntoDxf[] = [];
  for (const p of pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const prev = out[out.length - 1];
    if (prev && Math.hypot(prev.x - p.x, prev.y - p.y) < 1e-4) continue;
    out.push(p);
  }
  if (out.length >= 2 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < 1e-4) out.pop();
  return out;
}

/** Contorno exterior antihorario. En AutoCAD un lazo horario se lee como hueco y el sombreado no se ve. */
function sentido(ring: PuntoDxf[]): PuntoDxf[] {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (area >= 0) return ring;
  const n = ring.length;
  const rev: PuntoDxf[] = [];
  for (let k = 0; k < n; k++) {
    const src = ring[n - 1 - k];
    const dueño = ring[((n - k - 2) % n + n) % n];
    const b = dueño.bulge;
    rev.push(b && Math.abs(b) > 1e-6 ? { x: src.x, y: src.y, bulge: -b } : { x: src.x, y: src.y });
  }
  return rev;
}

export class DxfDoc {
  private h = 0x1f;
  private ents: string[] = [];
  readonly capas: { name: string; color: number }[];
  private readonly model: string;
  private readonly paper: string;
  private readonly dict: string;
  private readonly grupos: string;

  constructor(capas: { name: string; color: number }[]) {
    const tiene0 = capas.some((c) => c.name === "0");
    this.capas = tiene0 ? capas : [{ name: "0", color: 7 }, ...capas];
    this.model = this.asa();
    this.paper = this.asa();
    this.dict = this.asa();
    this.grupos = this.asa();
  }

  private asa(): string {
    this.h += 1;
    return this.h.toString(16).toUpperCase();
  }

  private par(pairs: string[]): string {
    return pairs.join(NL) + NL;
  }

  private ent(tipo: string, capa: string, hex: string, sub: string, cuerpo: string[]): void {
    if (!this.capas.some((c) => c.name === capa)) this.capas.push({ name: capa, color: 7 });
    this.ents.push(
      this.par([
        "0",
        tipo,
        "5",
        this.asa(),
        "330",
        this.model,
        "100",
        "AcDbEntity",
        "8",
        capa,
        ...(trueColor(hex).length ? ["62", "7", ...trueColor(hex)] : []),
        "100",
        sub,
        ...cuerpo,
      ]),
    );
  }

  polilinea(capa: string, pts: PuntoDxf[], cerrada: boolean, hex = ""): void {
    const limpio = anillo(pts);
    const uso = cerrada ? limpio : pts.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (uso.length < 2) return;
    if (cerrada && uso.length < 3) return;
    const cuerpo = ["90", String(uso.length), "70", cerrada ? "1" : "0"];
    for (const p of uso) {
      cuerpo.push("10", n(p.x), "20", n(p.y));
      if (p.bulge && Math.abs(p.bulge) > 1e-6) cuerpo.push("42", p.bulge.toFixed(6));
    }
    this.ent("LWPOLYLINE", capa, hex, "AcDbPolyline", cuerpo);
  }

  linea(capa: string, a: PuntoDxf, b: PuntoDxf): void {
    this.ent("LINE", capa, "", "AcDbLine", ["10", n(a.x), "20", n(a.y), "30", "0.0", "11", n(b.x), "21", n(b.y), "31", "0.0"]);
  }

  circulo(capa: string, c: PuntoDxf, r: number): void {
    if (!(r > 0)) return;
    this.ent("CIRCLE", capa, "", "AcDbCircle", ["10", n(c.x), "20", n(c.y), "30", "0.0", "40", n(r)]);
  }

  texto(capa: string, x: number, y: number, h: number, value: string, hex = ""): void {
    const t = dxfTexto(value);
    if (!t.trim()) return;
    const alt = Math.max(h, 0.05);
    this.ent("TEXT", capa, hex, "AcDbText", [
      "10",
      n(x),
      "20",
      n(y),
      "30",
      "0.0",
      "40",
      n(alt, 3),
      "1",
      t,
      "100",
      "AcDbText",
    ]);
  }

  /** Relleno sólido por polilínea externa (92=3), el contorno que AutoCAD regenera sin recuperar el archivo. */
  hatch(capa: string, pts: PuntoDxf[], hex: string): void {
    const ring = sentido(anillo(pts));
    if (ring.length < 3 || ring.length > 4000) return;
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      area += a.x * b.y - b.x * a.y;
    }
    if (Math.abs(area) < 1e-4) return;
    const conBulge = ring.some((p) => p.bulge && Math.abs(p.bulge) > 1e-6);
    const cuerpo = [
      "10", "0.0", "20", "0.0", "30", "0.0",
      "210", "0.0", "220", "0.0", "230", "1.0",
      "2", "SOLID",
      "70", "1",
      "71", "0",
      "91", "1",
      "92", "3",
      "72", conBulge ? "1" : "0",
      "73", "1",
      "93", String(ring.length),
    ];
    for (const p of ring) {
      cuerpo.push("10", n(p.x), "20", n(p.y));
      if (conBulge) cuerpo.push("42", (p.bulge && Math.abs(p.bulge) > 1e-6 ? p.bulge : 0).toFixed(6));
    }
    cuerpo.push("97", "0", "75", "0", "76", "1", "98", "0");
    this.ent("HATCH", capa, hex, "AcDbHatch", cuerpo);
  }

  serializar(ext: { minX: number; minY: number; maxX: number; maxY: number }): string {
    const capas = this.capas
      .map((c) =>
        this.par(["0", "LAYER", "5", this.asa(), "100", "AcDbSymbolTableRecord", "100", "AcDbLayerTableRecord", "2", c.name, "70", "0", "62", String(c.color), "6", "CONTINUOUS"]),
      )
      .join("");
    const h = (pairs: string[]) => this.par(pairs);
    const head = [
      "0", "SECTION", "2", "HEADER",
      "9", "$ACADVER", "1", "AC1018",
      "9", "$HANDSEED", "5", "HANDSEED",
      "9", "$DWGCODEPAGE", "3", "ANSI_1252",
      "9", "$INSBASE", "10", "0.0", "20", "0.0", "30", "0.0",
      "9", "$INSUNITS", "70", "6",
      "9", "$MEASUREMENT", "70", "1",
      "9", "$FILLMODE", "70", "1",
      "9", "$CLAYER", "8", "0",
      "9", "$EXTMIN", "10", n(ext.minX), "20", n(ext.minY), "30", "0.0",
      "9", "$EXTMAX", "10", n(ext.maxX), "20", n(ext.maxY), "30", "0.0",
      "9", "$LIMMIN", "10", n(ext.minX), "20", n(ext.minY),
      "9", "$LIMMAX", "10", n(ext.maxX), "20", n(ext.maxY),
      "0", "ENDSEC",
      "0", "SECTION", "2", "CLASSES",
      "0", "ENDSEC",
    ];
    const tables = [
      "0", "SECTION", "2", "TABLES",
      "0", "TABLE", "2", "VPORT", "5", this.asa(), "100", "AcDbSymbolTable", "70", "1",
      "0", "VPORT", "5", this.asa(), "100", "AcDbSymbolTableRecord", "100", "AcDbViewportTableRecord",
      "2", "*ACTIVE", "70", "0",
      "10", "0.0", "20", "0.0", "11", "1.0", "21", "1.0",
      "12", n((ext.minX + ext.maxX) / 2), "22", n((ext.minY + ext.maxY) / 2),
      "13", "0.0", "23", "0.0", "14", "10.0", "24", "10.0",
      "15", "10.0", "25", "10.0", "16", "0.0", "26", "0.0", "36", "1.0",
      "17", "0.0", "27", "0.0", "37", "0.0",
      "40", n(Math.max(ext.maxY - ext.minY, 1)), "41", "1.5",
      "42", "50.0", "43", "0.0", "44", "0.0", "50", "0.0", "51", "0.0",
      "71", "0", "72", "1000", "73", "1", "74", "3", "75", "0", "76", "0", "77", "0", "78", "0",
      "0", "ENDTAB",
      "0", "TABLE", "2", "LTYPE", "5", this.asa(), "100", "AcDbSymbolTable", "70", "3",
      "0", "LTYPE", "5", this.asa(), "100", "AcDbSymbolTableRecord", "100", "AcDbLinetypeTableRecord",
      "2", "ByBlock", "70", "0", "3", "", "72", "65", "73", "0", "40", "0.0",
      "0", "LTYPE", "5", this.asa(), "100", "AcDbSymbolTableRecord", "100", "AcDbLinetypeTableRecord",
      "2", "ByLayer", "70", "0", "3", "", "72", "65", "73", "0", "40", "0.0",
      "0", "LTYPE", "5", this.asa(), "100", "AcDbSymbolTableRecord", "100", "AcDbLinetypeTableRecord",
      "2", "CONTINUOUS", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0.0",
      "0", "ENDTAB",
      "0", "TABLE", "2", "LAYER", "5", this.asa(), "100", "AcDbSymbolTable", "70", String(this.capas.length),
    ];
    const style = [
      "0", "ENDTAB",
      "0", "TABLE", "2", "STYLE", "5", this.asa(), "100", "AcDbSymbolTable", "70", "1",
      "0", "STYLE", "5", this.asa(), "100", "AcDbSymbolTableRecord", "100", "AcDbTextStyleTableRecord",
      "2", "STANDARD", "70", "0", "40", "0.0", "41", "1.0", "50", "0.0", "71", "0", "42", "2.5", "3", "txt.shx", "4", "",
      "0", "ENDTAB",
      "0", "TABLE", "2", "APPID", "5", this.asa(), "100", "AcDbSymbolTable", "70", "1",
      "0", "APPID", "5", this.asa(), "100", "AcDbSymbolTableRecord", "100", "AcDbRegAppTableRecord", "2", "ACAD", "70", "0",
      "0", "ENDTAB",
      "0", "TABLE", "2", "DIMSTYLE", "5", this.asa(), "100", "AcDbSymbolTable", "70", "1", "100", "AcDbDimStyleTable", "71", "0",
      "0", "DIMSTYLE", "5", this.asa(), "100", "AcDbSymbolTableRecord", "100", "AcDbDimStyleTableRecord", "2", "STANDARD", "70", "0",
      "0", "ENDTAB",
      "0", "TABLE", "2", "BLOCK_RECORD", "5", this.asa(), "100", "AcDbSymbolTable", "70", "2",
      "0", "BLOCK_RECORD", "5", this.model, "100", "AcDbSymbolTableRecord", "100", "AcDbBlockTableRecord", "2", "*MODEL_SPACE",
      "0", "BLOCK_RECORD", "5", this.paper, "100", "AcDbSymbolTableRecord", "100", "AcDbBlockTableRecord", "2", "*PAPER_SPACE",
      "0", "ENDTAB",
      "0", "ENDSEC",
      "0", "SECTION", "2", "BLOCKS",
      "0", "BLOCK", "5", this.asa(), "330", this.model, "100", "AcDbEntity", "8", "0", "100", "AcDbBlockBegin", "2", "*MODEL_SPACE", "70", "0", "10", "0.0", "20", "0.0", "30", "0.0", "3", "*MODEL_SPACE", "1", "",
      "0", "ENDBLK", "5", this.asa(), "330", this.model, "100", "AcDbEntity", "8", "0", "100", "AcDbBlockEnd",
      "0", "BLOCK", "5", this.asa(), "330", this.paper, "100", "AcDbEntity", "8", "0", "100", "AcDbBlockBegin", "2", "*PAPER_SPACE", "70", "0", "10", "0.0", "20", "0.0", "30", "0.0", "3", "*PAPER_SPACE", "1", "",
      "0", "ENDBLK", "5", this.asa(), "330", this.paper, "100", "AcDbEntity", "8", "0", "100", "AcDbBlockEnd",
      "0", "ENDSEC",
      "0", "SECTION", "2", "ENTITIES",
    ];
    const objects = [
      "0", "ENDSEC",
      "0", "SECTION", "2", "OBJECTS",
      "0", "DICTIONARY", "5", this.dict, "330", "0", "100", "AcDbDictionary", "281", "1",
      "3", "ACAD_GROUP", "350", this.grupos,
      "0", "DICTIONARY", "5", this.grupos, "330", this.dict, "100", "AcDbDictionary", "281", "1",
      "0", "ENDSEC",
      "0", "EOF",
    ];
    const seedFinal = (this.h + 16).toString(16).toUpperCase();
    const headerTxt = h(head).replace(`5${NL}HANDSEED`, `5${NL}${seedFinal}`);
    return headerTxt + h(tables) + capas + h(style) + this.ents.join("") + h(objects);
  }
}

export type FalloDxf = { donde: string; detalle: string };

/** Revisa que el texto sea un DXF de pares y que AutoCAD pueda leer entidades, capas y sombreados. */
export function auditarDxf(texto: string): FalloDxf[] {
  const fallos: FalloDxf[] = [];
  const lines = texto.split(/\r\n|\n/);
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  if (lines.length % 2 !== 0) fallos.push({ donde: "archivo", detalle: "cantidad impar de líneas: un grupo quedó sin valor" });
  const pares: { c: string; v: string }[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pares.push({ c: lines[i].trim(), v: lines[i + 1] });
  if (!pares.length || pares[0].c !== "0" || pares[0].v.trim() !== "SECTION") fallos.push({ donde: "inicio", detalle: "no abre con SECTION" });
  const fin = pares[pares.length - 1];
  if (!fin || fin.c !== "0" || fin.v.trim() !== "EOF") fallos.push({ donde: "fin", detalle: "no termina en EOF" });
  const ver = pares.find((_, i) => pares[i - 1]?.v.trim() === "$ACADVER");
  if (!ver || ver.v.trim() < "AC1018") fallos.push({ donde: "HEADER", detalle: `versión ${ver?.v.trim() ?? "ausente"}: el color real exige AC1018 o posterior` });
  const capas = new Set<string>();
  const asas = new Set<string>();
  for (let i = 0; i < pares.length; i++) {
    if (pares[i].c === "0" && pares[i].v.trim() === "LAYER") {
      const nom = pares.slice(i, i + 16).find((p) => p.c === "2");
      if (nom) capas.add(nom.v.trim());
    }
    if (pares[i].c === "5" && pares[i - 1]?.v.trim() !== "$HANDSEED") {
      const a = pares[i].v.trim();
      if (asas.has(a)) fallos.push({ donde: "asa", detalle: `asa repetida ${a}` });
      asas.add(a);
    }
  }
  if (!capas.has("0")) fallos.push({ donde: "LAYER", detalle: "falta la capa 0" });
  const tipos = new Set(["LWPOLYLINE", "LINE", "CIRCLE", "TEXT", "HATCH"]);
  for (let i = 0; i < pares.length; i++) {
    if (pares[i].c !== "0" || !tipos.has(pares[i].v.trim())) continue;
    const tipo = pares[i].v.trim();
    let j = i + 1;
    const ent: { c: string; v: string }[] = [];
    while (j < pares.length && !(pares[j].c === "0" && pares[j].v.trim() !== tipo)) {
      if (pares[j].c === "0") break;
      ent.push(pares[j]);
      j++;
    }
    const capa = ent.find((p) => p.c === "8")?.v.trim() ?? "";
    if (!capas.has(capa)) fallos.push({ donde: tipo, detalle: `capa no declarada: ${capa}` });
    if (!ent.some((p) => p.c === "5")) fallos.push({ donde: tipo, detalle: "entidad sin asa" });
    const owner = ent.find((p) => p.c === "330")?.v.trim() ?? "";
    if (!owner || !asas.has(owner)) fallos.push({ donde: tipo, detalle: `dueño ${owner || "ausente"} no está en el dibujo` });
    if (!ent.some((p) => p.c === "100" && p.v.trim() === "AcDbEntity")) fallos.push({ donde: tipo, detalle: "sin AcDbEntity" });
    if (tipo === "LWPOLYLINE") {
      const nverts = Number(ent.find((p) => p.c === "90")?.v);
      const nv = ent.filter((p) => p.c === "10").length;
      if (nverts !== nv) fallos.push({ donde: "LWPOLYLINE", detalle: `grupo 90 dice ${nverts} y hay ${nv} vértices` });
    }
    if (tipo === "HATCH") {
      const flag = ent.find((p) => p.c === "92")?.v.trim();
      const i93 = ent.findIndex((p) => p.c === "93");
      const i97 = ent.findIndex((p) => p.c === "97");
      const nAr = Number(ent[i93]?.v);
      const nv = ent.slice(i93 + 1, i97 < 0 ? ent.length : i97).filter((p) => p.c === "10").length;
      if (flag !== "3" || !(nAr >= 3) || nAr !== nv) fallos.push({ donde: "HATCH", detalle: `contorno 92=${flag} con ${nAr} vértices y ${nv} puntos` });
      if (!ent.some((p) => p.c === "2" && p.v.trim() === "SOLID")) fallos.push({ donde: "HATCH", detalle: "no es SOLID" });
    }
    if (tipo === "TEXT") {
      const val = ent.find((p) => p.c === "1")?.v ?? "";
      if (/[\r\n]/.test(val)) fallos.push({ donde: "TEXT", detalle: "el texto parte el par DXF" });
    }
  }
  return fallos;
}
