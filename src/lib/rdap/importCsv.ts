import { nodoNuevo, tuboNuevo, zTerrenoDePuntos } from "./model";
import type { RdapProject } from "./types";

function filas(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(/[,;\t]/).map((c) => c.trim()));
}

export function importarNodosCsv(text: string, project: RdapProject): string {
  const rows = filas(text);
  if (rows.length < 2) return "El CSV de nodos no tiene filas.";
  const head = rows[0].map((h) => h.toLowerCase());
  const ix = (names: string[]) => names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1;
  const iId = ix(["id", "codigo", "point", "number"]);
  const iX = ix(["x", "este", "easting"]);
  const iY = ix(["y", "norte", "northing"]);
  const iZ = ix(["z", "cota", "ground", "elev"]);
  const iD = ix(["demanda", "demand", "q", "ls"]);
  const iT = ix(["tipo", "type", "kind"]);
  const iDesc = ix(["desc", "description", "nombre", "name"]);
  let n = 0;
  for (const row of rows.slice(1)) {
    const id = (iId >= 0 ? row[iId] : "") || `J-${String(n + 1).padStart(3, "0")}`;
    const x = parseFloat(row[iX] ?? "");
    const y = parseFloat(row[iY] ?? "");
    const z = parseFloat(row[iZ] ?? "");
    if (![x, y].every(Number.isFinite)) continue;
    const kindRaw = (iT >= 0 ? row[iT] : "junction").toLowerCase();
    const kind = kindRaw.includes("res") ? "reservoir" : kindRaw.includes("tan") ? "tank" : "junction";
    const node = project.nodes.find((q) => q.id === id) ?? nodoNuevo(id, kind);
    node.kind = kind;
    node.x = x;
    node.y = y;
    node.ground = Number.isFinite(z) ? z : zTerrenoDePuntos(x, y, project.topoPoints) ?? node.ground;
    node.cover = node.ground;
    node.invert = node.ground - 1.8;
    if (iD >= 0 && Number.isFinite(parseFloat(row[iD]))) node.demandLs = parseFloat(row[iD]);
    if (iDesc >= 0) node.description = row[iDesc] ?? "";
    if (kind === "reservoir") node.reservoirHgl = node.ground + 2;
    if (!project.nodes.some((q) => q.id === id)) project.nodes.push(node);
    n++;
  }
  return `Se leyeron ${n} nodos (CSV / Civil 3D puntos).`;
}

export function importarTuberiasCsv(text: string, project: RdapProject): string {
  const rows = filas(text);
  if (rows.length < 2) return "El CSV de tuberías no tiene filas.";
  const head = rows[0].map((h) => h.toLowerCase());
  const ix = (names: string[]) => names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1;
  const iId = ix(["id", "codigo"]);
  const iA = ix(["start", "desde", "from", "inicio"]);
  const iB = ix(["end", "hasta", "to", "fin"]);
  const iDn = ix(["dn", "diametro", "diameter"]);
  const iMat = ix(["material", "mat"]);
  const iL = ix(["l", "longitud", "length"]);
  let n = 0;
  for (const row of rows.slice(1)) {
    const a = row[iA] ?? "";
    const b = row[iB] ?? "";
    if (!a || !b) continue;
    const id = (iId >= 0 ? row[iId] : "") || `P-${String(n + 1).padStart(3, "0")}`;
    const t = project.pipes.find((q) => q.id === id) ?? tuboNuevo(id, a, b);
    t.start = a;
    t.end = b;
    if (iDn >= 0 && Number.isFinite(parseFloat(row[iDn]))) t.dnMm = parseFloat(row[iDn]);
    if (iMat >= 0 && row[iMat]) t.materialId = row[iMat].toLowerCase();
    if (iL >= 0 && Number.isFinite(parseFloat(row[iL])) && parseFloat(row[iL]) > 0) t.lengthM = parseFloat(row[iL]);
    else t.lengthM = null;
    if (!project.pipes.some((q) => q.id === id)) project.pipes.push(t);
    n++;
  }
  return `Se leyeron ${n} tuberías.`;
}

export function importarPuntosTopo(text: string, project: RdapProject): string {
  const rows = filas(text);
  if (rows.length < 2) return "El archivo de puntos no tiene filas.";
  const head = rows[0].map((h) => h.toLowerCase());
  const looksHead = head.some((h) => ["x", "y", "z", "este", "norte"].includes(h));
  const data = looksHead ? rows.slice(1) : rows;
  const iX = looksHead ? head.findIndex((h) => ["x", "este"].includes(h)) : 1;
  const iY = looksHead ? head.findIndex((h) => ["y", "norte"].includes(h)) : 2;
  const iZ = looksHead ? head.findIndex((h) => ["z", "cota"].includes(h)) : 3;
  const iId = looksHead ? head.findIndex((h) => ["id", "punto", "point"].includes(h)) : 0;
  const iD = looksHead ? head.findIndex((h) => ["desc", "description"].includes(h)) : 4;
  let n = 0;
  for (const row of data) {
    const x = parseFloat(row[iX] ?? "");
    const y = parseFloat(row[iY] ?? "");
    const z = parseFloat(row[iZ] ?? "");
    if (![x, y, z].every(Number.isFinite)) continue;
    const id = row[iId] || `PT-${n + 1}`;
    project.topoPoints.push({ id, x, y, z, desc: row[iD] ?? "" });
    n++;
  }
  return `Se leyeron ${n} puntos topográficos. Se construye una superficie TIN (malla) y la cota de un nudo nuevo se interpola en el triángulo.`;
}

export function importarLandXmlPuntos(xml: string, project: RdapProject): string {
  const pts = [...xml.matchAll(/<(?:CgPoint|P)[^>]*(?:name|id)="([^"]+)"[^>]*>([^<]+)<\//gi)];
  let n = 0;
  for (const m of pts) {
    const nums = m[2].trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
    if (nums.length < 3) continue;
    project.topoPoints.push({ id: m[1], x: nums[0], y: nums[1], z: nums[2], desc: "LandXML" });
    n++;
  }
  const list = xml.match(/<PntList3D[^>]*>([\s\S]*?)<\/PntList3D>/i);
  if (list) {
    const nums = list[1].trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
    for (let i = 0; i + 2 < nums.length; i += 3) {
      project.topoPoints.push({ id: `LX-${n + 1}`, x: nums[i], y: nums[i + 1], z: nums[i + 2], desc: "TIN" });
      n++;
    }
  }
  return n ? `LandXML: ${n} puntos leídos.` : "No se encontraron CgPoint ni PntList3D en el LandXML.";
}
