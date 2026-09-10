import { PARTIDAS, PARTIDA_BY_CODIGO } from "../src/lib/presupuesto/partidas";
import {
  PLANTILLAS,
  especialidadesPlantilla,
  especialidadesRequeridas,
  type CategoriaPlantilla,
} from "../src/lib/presupuesto/plantillas";
import { claveSubcapitulo, partesTituloCapitulo } from "../src/lib/presupuesto/rnMetrados";
import { codigoPartidaEquipamiento } from "../src/lib/presupuesto/partidasEquipamiento";

type Issue = { plantilla?: string; codigo: string; kind: string; detail: string };

const PREF: Record<string, string> = {
  ARQ: "arquitectura",
  EST: "estructuras",
  IS: "sanitarias",
  IE: "electricas",
  COM: "comunicaciones",
  IM: "mecanicas",
  IEM: "electromecanicas",
  P: "pavimentos",
  S: "saneamiento",
  CAR: "carreteras",
  PTE: "puentes",
  HID: "hidraulica",
  HAB: "habilitaciones",
};

function prefijo(codigo: string) {
  const m = codigo.match(/^([A-Za-z]+)-/);
  return m ? m[1].toUpperCase() : "";
}

function numCodigo(codigo: string) {
  const m = codigo.match(/^[A-Za-z]+-(\d+)/);
  return m ? m[1].padStart(2, "0") : "";
}

const issues: Issue[] = [];
const catalogMis = [] as Issue[];

for (const p of PARTIDAS) {
  const pref = prefijo(p.codigo);
  const expectedEsp = PREF[pref];
  if (expectedEsp && p.especialidad !== expectedEsp && pref !== "EQ") {
    catalogMis.push({
      codigo: p.codigo,
      kind: "esp-catalogo",
      detail: `prefijo ${pref} → ${expectedEsp}, pero capitulo/esp = ${p.especialidad} · ${p.capitulo}`,
    });
  }
  const nCod = numCodigo(p.codigo);
  const nCap = partesTituloCapitulo(p.capitulo).num;
  if (nCod && nCap && nCod !== nCap && ["arquitectura", "estructuras", "pavimentos", "saneamiento", "carreteras", "hidraulica", "habilitaciones", "puentes"].includes(p.especialidad)) {
    catalogMis.push({
      codigo: p.codigo,
      kind: "titulo-catalogo",
      detail: `código ${nCod} bajo título «${p.capitulo}»`,
    });
  }
}

const missingCodes = new Map<string, string[]>();
const missingEsp: { id: string; categoria: CategoriaPlantilla; falta: string[] }[] = [];
const zeroMetrado: Issue[] = [];
const emptyPl: string[] = [];

for (const pl of PLANTILLAS) {
  if (!pl.lineas.length) emptyPl.push(pl.id);
  const seen = new Set<string>();
  for (const l of pl.lineas) {
    const codigo = codigoPartidaEquipamiento(l.codigo);
    if (seen.has(codigo)) {
      issues.push({ plantilla: pl.id, codigo, kind: "duplicada", detail: "aparece dos veces en la plantilla" });
    }
    seen.add(codigo);
    const p = PARTIDA_BY_CODIGO[codigo] ?? PARTIDA_BY_CODIGO[l.codigo];
    if (!p) {
      const arr = missingCodes.get(pl.id) ?? [];
      arr.push(l.codigo);
      missingCodes.set(pl.id, arr);
      continue;
    }
    if (!(l.metrado > 0)) {
      zeroMetrado.push({ plantilla: pl.id, codigo, kind: "metrado-0", detail: p.descripcion });
    }
  }
  const tiene = new Set(especialidadesPlantilla(pl));
  const debe = especialidadesRequeridas(pl);
  const falta = debe.filter((e) => !tiene.has(e));
  if (falta.length) missingEsp.push({ id: pl.id, categoria: pl.categoria, falta });
}

function dump(title: string, rows: string[]) {
  console.log(`\n=== ${title} (${rows.length}) ===`);
  for (const r of rows.slice(0, 80)) console.log(r);
  if (rows.length > 80) console.log(`… +${rows.length - 80} más`);
}

console.log(`Plantillas: ${PLANTILLAS.length}  ·  Partidas catálogo: ${PARTIDAS.length}`);
dump(
  "Catálogo: código vs título",
  catalogMis.map((x) => `${x.codigo}  ${x.kind}  ${x.detail}`),
);
dump(
  "Plantilla: código inexistente",
  [...missingCodes.entries()].flatMap(([id, cs]) => cs.map((c) => `${id}  ${c}`)),
);
dump(
  "Plantilla: especialidad faltante",
  missingEsp.map((x) => `${x.id}  [${x.categoria}]  falta ${x.falta.join(", ")}`),
);
dump(
  "Plantilla: metrado 0",
  zeroMetrado.map((x) => `${x.plantilla}  ${x.codigo}  ${x.detail}`),
);
dump("Plantilla vacía", emptyPl);
dump(
  "Plantilla: duplicada",
  issues.filter((x) => x.kind === "duplicada").map((x) => `${x.plantilla}  ${x.codigo}`),
);

const byCat = new Map<string, number>();
for (const pl of PLANTILLAS) byCat.set(pl.categoria, (byCat.get(pl.categoria) ?? 0) + 1);
console.log("\n=== Cobertura por categoría ===");
for (const [k, n] of [...byCat.entries()].sort()) console.log(`${k}: ${n}`);

const sample = PLANTILLAS.find((p) => p.id === "unifamiliar");
if (sample) {
  const caps = new Map<string, string[]>();
  for (const l of sample.lineas) {
    const p = PARTIDA_BY_CODIGO[l.codigo];
    if (!p) continue;
    const key = `${p.especialidad} · ${p.capitulo}`;
    const arr = caps.get(key) ?? [];
    arr.push(`${l.codigo} (${claveSubcapitulo(l.codigo)})`);
    caps.set(key, arr);
  }
  console.log("\n=== unifamiliar títulos ===");
  for (const [k, v] of caps) console.log(`${k}  →  ${v.length}  ${v.slice(0, 3).join(", ")}`);
}
