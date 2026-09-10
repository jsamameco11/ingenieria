import { PARTIDA_BY_CODIGO, PARTIDAS, PLANTILLAS } from "../src/lib/presupuesto";
import { claveSubcapitulo, partesTituloCapitulo } from "../src/lib/presupuesto/rnMetrados";

const CIVIL = new Set([
  "arquitectura",
  "estructuras",
  "pavimentos",
  "saneamiento",
  "hidraulica",
  "puentes",
  "carreteras",
  "habilitaciones",
]);

function numCodigo(codigo: string): string {
  const m = codigo.match(/^[A-Za-zÁÉÍÓÚÜÑ]+-(\d+)/i);
  return m ? m[1].padStart(2, "0") : "";
}

const mismatches: string[] = [];
const sinTitulo: string[] = [];
const dup = new Map<string, number>();

for (const p of PARTIDAS) {
  dup.set(p.codigo, (dup.get(p.codigo) ?? 0) + 1);
  const nc = numCodigo(p.codigo);
  const nt = partesTituloCapitulo(p.capitulo).num;
  if (CIVIL.has(p.especialidad)) {
    if (!nc) sinTitulo.push(`${p.codigo} · ${p.especialidad} · cap="${p.capitulo}"`);
    else if (nt && nc !== nt) {
      mismatches.push(`${p.codigo} · código ${nc} ≠ título ${nt} «${p.capitulo}»`);
    } else if (!nt) sinTitulo.push(`${p.codigo} · ${p.especialidad} · cap="${p.capitulo}"`);
  }
}

const dups = [...dup.entries()].filter(([, n]) => n > 1);
const missing: string[] = [];
const plantillaMis: string[] = [];
for (const pl of PLANTILLAS) {
  const seen = new Set<string>();
  for (const l of pl.lineas) {
    const p = PARTIDA_BY_CODIGO[l.codigo];
    if (!p) {
      missing.push(`${pl.id} · falta ${l.codigo}`);
      continue;
    }
    if (seen.has(l.codigo)) plantillaMis.push(`${pl.id} · repetido ${l.codigo}`);
    seen.add(l.codigo);
    const nc = numCodigo(p.codigo);
    const nt = partesTituloCapitulo(p.capitulo).num;
    if (CIVIL.has(p.especialidad) && nc && nt && nc !== nt) {
      plantillaMis.push(`${pl.id} · ${l.codigo} en «${p.capitulo}»`);
    }
  }
}

console.log("=== CATÁLOGO ===");
console.log(`Partidas: ${PARTIDAS.length} · mismatch ${mismatches.length} · irregular ${sinTitulo.length} · dup ${dups.length}`);
mismatches.forEach((x) => console.log("  MIS", x));
sinTitulo.slice(0, 50).forEach((x) => console.log("  IRR", x));
dups.forEach(([c, n]) => console.log("  DUP", c, n));

console.log("\n=== PLANTILLAS ===");
console.log(`${PLANTILLAS.length} plantillas · faltan ${missing.length} · dudosas ${plantillaMis.length}`);
missing.forEach((x) => console.log("  NO", x));
plantillaMis.forEach((x) => console.log("  PLC", x));

const caps = new Map<string, Set<string>>();
for (const p of PARTIDAS) {
  const set = caps.get(p.especialidad) ?? new Set();
  set.add(p.capitulo);
  caps.set(p.especialidad, set);
}
console.log("\n=== TÍTULOS ===");
for (const [esp, set] of [...caps.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`\n[${esp}]`);
  [...set]
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
    .forEach((c) => {
      const items = PARTIDAS.filter((p) => p.especialidad === esp && p.capitulo === c);
      const prefs = [...new Set(items.map((p) => numCodigo(p.codigo) || "?"))].sort();
      console.log(`  ${String(items.length).padStart(3)}  ${c}  · ${prefs.join(",")}`);
    });
}
