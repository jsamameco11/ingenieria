import type { Partida } from "../types";
import { PARTIDAS } from "../partidas";
import type { RevitCampo, RevitRol } from "./types";

const CAMPO_UND: Record<RevitCampo, string> = {
  concreto_m3: "m³",
  encofrado_m2: "m²",
  acero_kg: "kg",
  area_planta_m2: "m²",
  longitud_m: "m",
  unidad_und: "und",
};

const ROL_CLAVES: Record<RevitRol, string[]> = {
  zapata: ["zapata", "cimiento", "concreto"],
  dado: ["dado", "zapata", "concreto"],
  viga_cimentacion: ["viga de cimentación", "viga", "concreto"],
  cimiento_corrido: ["cimiento corrido", "cimiento", "concreto"],
  sobrecimiento: ["sobrecimiento", "concreto"],
  columna: ["columna", "concreto"],
  placa: ["placa", "muro de corte", "concreto"],
  muro_concreto: ["muro de concreto", "concreto"],
  viga: ["viga", "concreto"],
  losa_aligerada: ["losa aligerada", "losa", "concreto"],
  losa_maciza: ["losa maciza", "losa", "concreto"],
  escalera: ["escalera", "concreto"],
  cisterna: ["cisterna", "tanque", "concreto"],
  solado: ["solado", "falso piso", "concreto"],
  albanileria: ["muro", "ladrillo", "albañilería", "tabique", "king kong"],
  acero_suelto: ["acero", "fy"],
  desconocido: [],
};

const ROL_NOMBRE: Record<RevitRol, string> = {
  zapata: "zapata",
  dado: "dado",
  viga_cimentacion: "viga de cimentacion",
  cimiento_corrido: "cimiento corrido",
  sobrecimiento: "sobrecimiento",
  columna: "columna",
  placa: "placa",
  muro_concreto: "muro de concreto",
  viga: "viga",
  losa_aligerada: "losa aligerada",
  losa_maciza: "losa maciza",
  escalera: "escalera",
  cisterna: "cisterna",
  solado: "solado",
  albanileria: "albanileria",
  acero_suelto: "acero",
  desconocido: "",
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokens(...xs: string[]) {
  const stop = new Set(["the", "del", "de", "la", "el", "los", "las", "con", "para", "tipo", "mm", "cm"]);
  return xs
    .join(" ")
    .split(/[^a-z0-9ñ]+/i)
    .map((t) => norm(t))
    .filter((t) => t.length > 2 && !stop.has(t));
}

export type ConsultaSimilar = {
  familia: string;
  tipo: string;
  rol: RevitRol;
  campo: RevitCampo;
  und?: string;
};

/** Al menos `min` partidas del catálogo con la misma unidad y oficio del elemento no unido. */
export function partidasSimilares(q: ConsultaSimilar, pool: Partida[] = PARTIDAS, min = 2): Partida[] {
  const und = q.und || CAMPO_UND[q.campo];
  const keys = [...tokens(q.familia, q.tipo, ROL_NOMBRE[q.rol]), ...(ROL_CLAVES[q.rol] ?? []).map(norm)];
  const scored = pool.map((p) => {
    let s = 0;
    if (p.und === und) s += 10;
    const blob = norm(`${p.codigo} ${p.descripcion} ${p.capitulo}`);
    for (const k of keys) {
      if (k.length < 3) continue;
      if (blob.includes(k)) s += 4;
    }
    if (q.campo === "concreto_m3" && (blob.includes("concreto") || blob.includes("f'c") || blob.includes("fc "))) s += 5;
    if (q.campo === "encofrado_m2" && blob.includes("encofrado")) s += 8;
    if (q.campo === "acero_kg" && (blob.includes("acero") || blob.includes("fy"))) s += 8;
    if (q.campo === "area_planta_m2" && /muro|losa|piso|cobertura|calamin|tarrajeo/.test(blob)) s += 3;
    if (q.campo === "longitud_m" && /baranda|sardinel|tuber|canaleta|cumbrera/.test(blob)) s += 3;
    return { p, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const seen = new Set<string>();
  const out: Partida[] = [];
  for (const row of scored) {
    if (row.s <= 0) continue;
    if (seen.has(row.p.codigo)) continue;
    seen.add(row.p.codigo);
    out.push(row.p);
    if (out.length >= 6) break;
  }
  if (out.length < min) {
    for (const p of pool) {
      if (p.und !== und || seen.has(p.codigo)) continue;
      out.push(p);
      seen.add(p.codigo);
      if (out.length >= min) break;
    }
  }
  if (out.length < min) {
    for (const row of scored) {
      if (seen.has(row.p.codigo)) continue;
      out.push(row.p);
      seen.add(row.p.codigo);
      if (out.length >= min) break;
    }
  }
  return out.slice(0, Math.max(min, Math.min(6, out.length)));
}
